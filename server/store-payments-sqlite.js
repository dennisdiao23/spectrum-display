const pay = require('./company-payments');
const ops = require('./payment-ops');
const dbUtil = require('./db');

function attachPaymentMethods(api, db) {

  // Enrich invoices with amountPaid / balanceDue on read.
  const _getSalesDoc = api.getSalesDoc.bind(api);
  const _listSalesDocs = api.listSalesDocs.bind(api);
  api.getSalesDoc = async function (id) {
    return this.enrichSalesDoc(await _getSalesDoc(id));
  };
  api.listSalesDocs = async function (type) {
    const docs = await _listSalesDocs(type);
    const self = this;
    return Promise.all(docs.map(function (d) { return self.enrichSalesDoc(d); }));
  };

  api.invoiceAmountPaid = function (invoiceId) {
    const row = db.prepare(`
      SELECT COALESCE(SUM(a.amount), 0) AS paid
      FROM company_payment_applications a
      JOIN company_customer_payments p ON p.id = a.payment_id
      WHERE a.invoice_id = ? AND p.status = 'posted'
    `).get(invoiceId);
    return pay.money(row && row.paid);
  };

  api.enrichSalesDoc = async function (doc) {
    if (!doc) return doc;
    if (doc.type !== 'invoice') {
      return Object.assign({}, doc, {
        amountPaid: 0,
        balanceDue: pay.money(doc.total),
        paymentsApplied: 0
      });
    }
    return ops.enrichInvoice(doc, this.invoiceAmountPaid(doc.id));
  };

  api.listCustomerPayments = async function (customerId) {
    const rows = db.prepare(
      'SELECT * FROM company_customer_payments WHERE customer_id = ? ORDER BY payment_date DESC, id DESC'
    ).all(customerId);
    return rows.map(function (row) {
      const apps = db.prepare(`
        SELECT a.*, d.number AS invoice_number
        FROM company_payment_applications a
        LEFT JOIN company_sales_docs d ON d.id = a.invoice_id
        WHERE a.payment_id = ?
        ORDER BY a.id
      `).all(row.id);
      return pay.formatPayment(row, apps);
    });
  };

  api.getCustomerPayment = async function (id) {
    const row = db.prepare('SELECT * FROM company_customer_payments WHERE id = ?').get(id);
    if (!row) return null;
    const apps = db.prepare(`
      SELECT a.*, d.number AS invoice_number
      FROM company_payment_applications a
      LEFT JOIN company_sales_docs d ON d.id = a.invoice_id
      WHERE a.payment_id = ?
      ORDER BY a.id
    `).all(row.id);
    return pay.formatPayment(row, apps);
  };

  api.refreshInvoicePaymentStatus = async function (invoiceId) {
    const doc = await this.getSalesDoc(invoiceId);
    if (!doc || doc.type !== 'invoice') return doc;
    const paid = this.invoiceAmountPaid(invoiceId);
    const next = ops.nextInvoiceStatus(doc, paid);
    if (next && next !== doc.status) {
      db.prepare('UPDATE company_sales_docs SET status = ?, updated_at = ? WHERE id = ?')
        .run(next, dbUtil.nowIso(), invoiceId);
    }
    return this.enrichSalesDoc(await this.getSalesDoc(invoiceId));
  };

  api.createCustomerPayment = async function (payload) {
    const input = pay.normalizePayment(payload);
    const customer = await this.getCompanyCustomer(input.customerId);
    if (!customer) throw new Error('Customer not found.');
    const stamp = dbUtil.nowIso();
    const info = db.prepare(`
      INSERT INTO company_customer_payments (
        customer_id, payment_date, amount, method, reference, memo, source,
        stripe_payment_intent_id, stripe_checkout_session_id, status,
        card_fee_amount, card_fee_percent, pay_link_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.customerId,
      input.paymentDate,
      input.amount,
      input.method,
      input.reference,
      input.memo,
      input.source,
      input.stripePaymentIntentId,
      input.stripeCheckoutSessionId,
      input.status,
      input.cardFeeAmount,
      input.cardFeePercent,
      input.payLinkId,
      stamp,
      stamp
    );
    const paymentId = info.lastInsertRowid;
    const insertApp = db.prepare(
      'INSERT INTO company_payment_applications (payment_id, invoice_id, amount, created_at) VALUES (?, ?, ?, ?)'
    );
    const touched = {};
    const self = this;
    input.applications.forEach(function (app) {
      const inv = db.prepare('SELECT id, type, customer_id FROM company_sales_docs WHERE id = ?').get(app.invoiceId);
      if (!inv || inv.type !== 'invoice') throw new Error('Invoice not found for payment application.');
      if (Number(inv.customer_id) !== Number(input.customerId)) {
        throw new Error('Invoice does not belong to this customer.');
      }
      insertApp.run(paymentId, app.invoiceId, app.amount, stamp);
      touched[app.invoiceId] = true;
    });

    if (input.cardFeeAmount > 0) {
      const invoiceId = input.applications[0] ? input.applications[0].invoiceId : null;
      db.prepare(`
        INSERT INTO company_card_fee_entries (
          payment_id, customer_id, invoice_id, fee_amount, fee_percent, stripe_charge_id, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'charged', ?)
      `).run(
        paymentId,
        input.customerId,
        invoiceId,
        input.cardFeeAmount,
        input.cardFeePercent,
        input.stripePaymentIntentId || '',
        stamp
      );
    }

    await Promise.all(Object.keys(touched).map(function (id) {
      return self.refreshInvoicePaymentStatus(Number(id));
    }));
    return this.getCustomerPayment(paymentId);
  };

  api.voidCustomerPayment = async function (id) {
    const row = db.prepare('SELECT * FROM company_customer_payments WHERE id = ?').get(id);
    if (!row) return null;
    if (row.status === 'void') return this.getCustomerPayment(id);
    const apps = db.prepare('SELECT invoice_id FROM company_payment_applications WHERE payment_id = ?').all(id);
    db.prepare('UPDATE company_customer_payments SET status = ?, updated_at = ? WHERE id = ?')
      .run('void', dbUtil.nowIso(), id);
    db.prepare("UPDATE company_card_fee_entries SET status = 'refunded' WHERE payment_id = ?").run(id);
    const self = this;
    await Promise.all(apps.map(function (a) {
      return self.refreshInvoicePaymentStatus(a.invoice_id);
    }));
    return this.getCustomerPayment(id);
  };

  api.listOpenInvoicesForCustomer = async function (customerId) {
    const docs = await this.listSalesDocs('invoice');
    const out = [];
    for (let i = 0; i < docs.length; i++) {
      const d = docs[i];
      if (String(d.customerId) !== String(customerId)) continue;
      if (d.status === 'void' || d.status === 'draft') continue;
      const enriched = await this.enrichSalesDoc(d);
      if (enriched.balanceDue > 0.009) out.push(enriched);
    }
    return out;
  };

  api.createInvoicePayLink = async function (opts) {
    const doc = await this.enrichSalesDoc(await this.getSalesDoc(opts.invoiceId));
    if (!doc || doc.type !== 'invoice') throw new Error('Invoice not found.');
    if (!doc.customerId) throw new Error('Invoice has no customer.');
    if (doc.balanceDue <= 0) throw new Error('Invoice is already paid.');
    const customer = await this.getCompanyCustomer(doc.customerId);
    if (!customer) throw new Error('Customer not found.');
    if (!pay.onlinePayEnabled(customer.paymentMethod)) {
      throw new Error('Online pay requires the customer payment method to be ACH or Credit card.');
    }
    let minAmount = pay.money(opts.minAmount);
    const collectMode = String(opts.collectMode || customer.invoiceCollectDefault || 'full').toLowerCase() === 'deposit'
      ? 'deposit'
      : 'full';
    if (!(minAmount > 0)) {
      minAmount = collectMode === 'deposit'
        ? pay.depositMinFromCustomer(customer, doc.balanceDue)
        : doc.balanceDue;
    }
    if (minAmount > doc.balanceDue) minAmount = doc.balanceDue;
    if (minAmount < 0.01) minAmount = Math.min(0.01, doc.balanceDue);
    const stamp = dbUtil.nowIso();
    const token = pay.token();
    const info = db.prepare(`
      INSERT INTO company_invoice_pay_links (
        token, invoice_id, customer_id, min_amount, balance_at_create, collect_mode, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?)
    `).run(token, doc.id, Number(doc.customerId), minAmount, doc.balanceDue, collectMode, stamp, stamp);
    const link = pay.formatPayLink(db.prepare('SELECT * FROM company_invoice_pay_links WHERE id = ?').get(info.lastInsertRowid));
    const stripe = require('./stripe-billing');
    return {
      link: link,
      payUrl: stripe.publicOrigin() + '/pay/' + link.token,
      invoice: doc,
      customer: customer
    };
  };

  api.getInvoicePayLinkByToken = async function (token) {
    const row = db.prepare('SELECT * FROM company_invoice_pay_links WHERE token = ?').get(token);
    if (!row) return null;
    const link = pay.formatPayLink(row);
    const invoice = await this.enrichSalesDoc(await this.getSalesDoc(link.invoiceId));
    const customer = await this.getCompanyCustomer(link.customerId);
    const balance = invoice ? invoice.balanceDue : 0;
    const minAmount = pay.money(Math.min(link.minAmount, balance > 0 ? balance : link.minAmount));
    const passFee = pay.shouldPassCardFee(customer);
    const feePercent = passFee ? pay.resolveCardFeePercent(customer) : 0;
    return {
      link: link,
      invoice: invoice,
      customer: customer ? {
        id: customer.id,
        displayName: customer.displayName,
        companyName: customer.companyName,
        email: customer.email,
        paymentMethod: customer.paymentMethod,
        passCardFee: passFee
      } : null,
      balanceDue: balance,
      minAmount: minAmount,
      maxAmount: balance,
      feePercent: feePercent,
      passCardFee: passFee,
      paymentMethodTypes: pay.stripeMethodsForCustomer(customer && customer.paymentMethod),
      stripeReady: require('./stripe-billing').isConfigured()
    };
  };

  api.startInvoiceCheckout = async function (token, principalAmount) {
    const detail = await this.getInvoicePayLinkByToken(token);
    if (!detail || !detail.link) throw new Error('Pay link not found.');
    if (detail.link.status !== 'open') throw new Error('This pay link is no longer open.');
    if (!detail.invoice || detail.balanceDue <= 0) throw new Error('Invoice is already paid.');
    let principal = pay.money(principalAmount);
    if (!(principal > 0)) principal = detail.minAmount;
    if (principal + 0.001 < detail.minAmount) {
      throw new Error('Minimum payment for this invoice is $' + detail.minAmount.toFixed(2) + '.');
    }
    if (principal - detail.balanceDue > 0.009) {
      throw new Error('Payment cannot exceed the balance due.');
    }
    const feePercent = detail.passCardFee ? detail.feePercent : 0;
    const feeAmount = detail.passCardFee ? pay.cardFeeAmount(principal, feePercent) : 0;
    const stripe = require('./stripe-billing');
    const session = await stripe.createInvoiceCheckout({
      payToken: token,
      payLinkId: detail.link.id,
      invoiceId: detail.invoice.id,
      customerId: detail.customer && detail.customer.id,
      email: detail.customer && detail.customer.email,
      principalAmount: principal,
      feeAmount: feeAmount,
      feePercent: feePercent,
      paymentMethodTypes: detail.paymentMethodTypes,
      invoiceLabel: 'Invoice ' + (detail.invoice.number || detail.invoice.id),
      description: 'Payment toward invoice ' + (detail.invoice.number || '')
    });
    return {
      checkoutUrl: session.url,
      sessionId: session.id,
      principalAmount: principal,
      feeAmount: feeAmount,
      chargeTotal: pay.money(principal + feeAmount)
    };
  };

  api.applyStripeCheckoutSession = async function (session) {
    if (!session || session.mode !== 'payment') return null;
    if (session.payment_status !== 'paid' && session.status !== 'complete') return null;
    const meta = session.metadata || {};
    const intentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : (session.payment_intent && session.payment_intent.id) || '';
    if (intentId) {
      const existing = db.prepare(
        'SELECT id FROM company_customer_payments WHERE stripe_payment_intent_id = ? OR stripe_checkout_session_id = ?'
      ).get(intentId, session.id);
      if (existing) return this.getCustomerPayment(existing.id);
    } else {
      const existing = db.prepare(
        'SELECT id FROM company_customer_payments WHERE stripe_checkout_session_id = ?'
      ).get(session.id);
      if (existing) return this.getCustomerPayment(existing.id);
    }
    const invoiceId = Number(meta.invoice_id);
    const customerId = Number(meta.customer_id);
    const principal = pay.money(meta.principal_amount);
    const feeAmount = pay.money(meta.fee_amount);
    const feePercent = pay.money(meta.fee_percent);
    if (!invoiceId || !customerId || !(principal > 0)) {
      throw new Error('Stripe session missing invoice payment metadata.');
    }
    const payment = await this.createCustomerPayment({
      customerId: customerId,
      paymentDate: pay.todayIso(),
      amount: principal,
      method: (session.payment_method_types || []).indexOf('us_bank_account') !== -1 ? 'ACH' : 'Credit card',
      reference: session.id,
      memo: 'Paid online via Stripe',
      source: 'stripe',
      stripePaymentIntentId: intentId,
      stripeCheckoutSessionId: session.id,
      cardFeeAmount: feeAmount,
      cardFeePercent: feePercent,
      payLinkId: meta.pay_link_id ? Number(meta.pay_link_id) : null,
      applications: [{ invoiceId: invoiceId, amount: principal }]
    });
    if (meta.pay_link_id) {
      db.prepare("UPDATE company_invoice_pay_links SET status = 'paid', updated_at = ? WHERE id = ?")
        .run(dbUtil.nowIso(), Number(meta.pay_link_id));
    } else if (meta.pay_token) {
      db.prepare("UPDATE company_invoice_pay_links SET status = 'paid', updated_at = ? WHERE token = ?")
        .run(dbUtil.nowIso(), meta.pay_token);
    }
    return payment;
  };

  api.listCardFeeEntries = async function (opts) {
    opts = opts || {};
    let sql = 'SELECT * FROM company_card_fee_entries';
    const params = [];
    if (opts.customerId) {
      sql += ' WHERE customer_id = ?';
      params.push(opts.customerId);
    }
    sql += ' ORDER BY id DESC LIMIT ?';
    params.push(Math.min(500, Number(opts.limit) || 100));
    const stmt = db.prepare(sql);
    return stmt.all.apply(stmt, params).map(pay.formatCardFeeEntry);
  };
}

module.exports = { attachPaymentMethods };
