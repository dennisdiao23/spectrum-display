/**
 * Supabase payment methods — mirror of SQLite payment ledger.
 * Card fees go to company_card_fee_entries only (never invoice lines).
 */
const pay = require("./company-payments");
const ops = require("./payment-ops");

function attachPaymentMethods(api, supabase, throwIf) {
  async function invoiceAmountPaid(invoiceId) {
    const { data: apps, error } = await supabase
      .from("company_payment_applications")
      .select("amount, payment_id")
      .eq("invoice_id", invoiceId);
    throwIf(error);
    if (!apps || !apps.length) return 0;
    const ids = apps.map(function (a) { return a.payment_id; });
    const { data: payments, error: pErr } = await supabase
      .from("company_customer_payments")
      .select("id, status")
      .in("id", ids);
    throwIf(pErr);
    const posted = {};
    (payments || []).forEach(function (p) { if (p.status === "posted") posted[p.id] = true; });
    return pay.money(apps.reduce(function (sum, a) {
      return sum + (posted[a.payment_id] ? Number(a.amount) || 0 : 0);
    }, 0));
  }

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

  api.enrichSalesDoc = async function (doc) {
    if (!doc) return doc;
    if (doc.type !== "invoice") {
      return Object.assign({}, doc, { amountPaid: 0, balanceDue: pay.money(doc.total), paymentsApplied: 0 });
    }
    return ops.enrichInvoice(doc, await invoiceAmountPaid(doc.id));
  };

  api.listCustomerPayments = async function (customerId) {
    const { data, error } = await supabase
      .from("company_customer_payments")
      .select("*")
      .eq("customer_id", customerId)
      .order("payment_date", { ascending: false })
      .order("id", { ascending: false });
    throwIf(error);
    const out = [];
    for (let i = 0; i < (data || []).length; i++) {
      const row = data[i];
      const { data: apps, error: aErr } = await supabase
        .from("company_payment_applications")
        .select("*, company_sales_docs(number)")
        .eq("payment_id", row.id);
      throwIf(aErr);
      const mapped = (apps || []).map(function (a) {
        return Object.assign({}, a, {
          invoice_number: a.company_sales_docs && a.company_sales_docs.number
        });
      });
      out.push(pay.formatPayment(row, mapped));
    }
    return out;
  };

  api.getCustomerPayment = async function (id) {
    const { data, error } = await supabase.from("company_customer_payments").select("*").eq("id", id).maybeSingle();
    throwIf(error);
    if (!data) return null;
    const { data: apps, error: aErr } = await supabase
      .from("company_payment_applications")
      .select("*, company_sales_docs(number)")
      .eq("payment_id", id);
    throwIf(aErr);
    const mapped = (apps || []).map(function (a) {
      return Object.assign({}, a, { invoice_number: a.company_sales_docs && a.company_sales_docs.number });
    });
    return pay.formatPayment(data, mapped);
  };

  api.refreshInvoicePaymentStatus = async function (invoiceId) {
    const doc = await _getSalesDoc(invoiceId);
    if (!doc || doc.type !== "invoice") return doc;
    const paid = await invoiceAmountPaid(invoiceId);
    const next = ops.nextInvoiceStatus(doc, paid);
    if (next && next !== doc.status) {
      const { error } = await supabase.from("company_sales_docs").update({ status: next, updated_at: new Date().toISOString() }).eq("id", invoiceId);
      throwIf(error);
    }
    return this.enrichSalesDoc(await _getSalesDoc(invoiceId));
  };

  api.createCustomerPayment = async function (payload) {
    const input = pay.normalizePayment(payload);
    const customer = await this.getCompanyCustomer(input.customerId);
    if (!customer) throw new Error("Customer not found.");
    const stamp = new Date().toISOString();
    const row = {
      customer_id: input.customerId,
      payment_date: input.paymentDate,
      amount: input.amount,
      method: input.method,
      reference: input.reference,
      memo: input.memo,
      source: input.source,
      stripe_payment_intent_id: input.stripePaymentIntentId,
      stripe_checkout_session_id: input.stripeCheckoutSessionId,
      status: input.status,
      card_fee_amount: input.cardFeeAmount,
      card_fee_percent: input.cardFeePercent,
      pay_link_id: input.payLinkId,
      created_at: stamp,
      updated_at: stamp
    };
    const { data, error } = await supabase.from("company_customer_payments").insert(row).select("*").single();
    throwIf(error);
    const paymentId = data.id;
    for (let i = 0; i < input.applications.length; i++) {
      const app = input.applications[i];
      const inv = await _getSalesDoc(app.invoiceId);
      if (!inv || inv.type !== "invoice") throw new Error("Invoice not found for payment application.");
      if (Number(inv.customerId) !== Number(input.customerId)) throw new Error("Invoice does not belong to this customer.");
      const { error: aErr } = await supabase.from("company_payment_applications").insert({
        payment_id: paymentId,
        invoice_id: app.invoiceId,
        amount: app.amount,
        created_at: stamp
      });
      throwIf(aErr);
    }
    if (input.cardFeeAmount > 0) {
      const invoiceId = input.applications[0] ? input.applications[0].invoiceId : null;
      const { error: fErr } = await supabase.from("company_card_fee_entries").insert({
        payment_id: paymentId,
        customer_id: input.customerId,
        invoice_id: invoiceId,
        fee_amount: input.cardFeeAmount,
        fee_percent: input.cardFeePercent,
        stripe_charge_id: input.stripePaymentIntentId || "",
        status: "charged",
        created_at: stamp
      });
      throwIf(fErr);
    }
    for (let i = 0; i < input.applications.length; i++) {
      await this.refreshInvoicePaymentStatus(input.applications[i].invoiceId);
    }
    return this.getCustomerPayment(paymentId);
  };

  api.voidCustomerPayment = async function (id) {
    const current = await this.getCustomerPayment(id);
    if (!current) return null;
    if (current.status === "void") return current;
    const stamp = new Date().toISOString();
    const { error } = await supabase.from("company_customer_payments").update({ status: "void", updated_at: stamp }).eq("id", id);
    throwIf(error);
    await supabase.from("company_card_fee_entries").update({ status: "refunded" }).eq("payment_id", id);
    for (let i = 0; i < (current.applications || []).length; i++) {
      await this.refreshInvoicePaymentStatus(current.applications[i].invoiceId);
    }
    return this.getCustomerPayment(id);
  };

  api.listOpenInvoicesForCustomer = async function (customerId) {
    const docs = await this.listSalesDocs("invoice");
    return docs.filter(function (d) {
      return String(d.customerId) === String(customerId) && d.status !== "void" && d.status !== "draft" && d.balanceDue > 0.009;
    });
  };

  // Reuse sqlite implementations for pay-link/checkout/webhook by requiring the sqlite file is not possible.
  // Implement pay link + checkout + apply here (copying sqlite flow with supabase writes).
  const sqliteAttach = require("./store-payments-sqlite");
  // Build a tiny fake db adapter? Too heavy.
  // Inline pay-link methods:

  api.createInvoicePayLink = async function (opts) {
    const doc = await this.enrichSalesDoc(await _getSalesDoc(opts.invoiceId));
    if (!doc || doc.type !== "invoice") throw new Error("Invoice not found.");
    if (!doc.customerId) throw new Error("Invoice has no customer.");
    if (doc.balanceDue <= 0) throw new Error("Invoice is already paid.");
    const customer = await this.getCompanyCustomer(doc.customerId);
    if (!customer) throw new Error("Customer not found.");
    if (!pay.onlinePayEnabled(customer.paymentMethod)) {
      throw new Error("Online pay requires the customer payment method to be ACH or Credit card.");
    }
    let minAmount = pay.money(opts.minAmount);
    const collectMode = String(opts.collectMode || customer.invoiceCollectDefault || "full").toLowerCase() === "deposit" ? "deposit" : "full";
    if (!(minAmount > 0)) {
      minAmount = collectMode === "deposit" ? pay.depositMinFromCustomer(customer, doc.balanceDue) : doc.balanceDue;
    }
    if (minAmount > doc.balanceDue) minAmount = doc.balanceDue;
    if (minAmount < 0.01) minAmount = Math.min(0.01, doc.balanceDue);
    const stamp = new Date().toISOString();
    const token = pay.token();
    const { data, error } = await supabase.from("company_invoice_pay_links").insert({
      token: token,
      invoice_id: doc.id,
      customer_id: Number(doc.customerId),
      min_amount: minAmount,
      balance_at_create: doc.balanceDue,
      collect_mode: collectMode,
      status: "open",
      created_at: stamp,
      updated_at: stamp
    }).select("*").single();
    throwIf(error);
    const link = pay.formatPayLink(data);
    const stripe = require("./stripe-billing");
    return {
      link: link,
      payUrl: stripe.publicOrigin() + "/pay/" + link.token,
      invoice: doc,
      customer: customer
    };
  };

  api.getInvoicePayLinkByToken = async function (token) {
    const { data: row, error } = await supabase.from("company_invoice_pay_links").select("*").eq("token", token).maybeSingle();
    throwIf(error);
    if (!row) return null;
    const link = pay.formatPayLink(row);
    const invoice = await this.enrichSalesDoc(await _getSalesDoc(link.invoiceId));
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
      stripeReady: require("./stripe-billing").isConfigured()
    };
  };

  api.startInvoiceCheckout = async function (token, principalAmount) {
    const detail = await this.getInvoicePayLinkByToken(token);
    if (!detail || !detail.link) throw new Error("Pay link not found.");
    if (detail.link.status !== "open") throw new Error("This pay link is no longer open.");
    if (!detail.invoice || detail.balanceDue <= 0) throw new Error("Invoice is already paid.");
    let principal = pay.money(principalAmount);
    if (!(principal > 0)) principal = detail.minAmount;
    if (principal + 0.001 < detail.minAmount) throw new Error("Minimum payment for this invoice is $" + detail.minAmount.toFixed(2) + ".");
    if (principal - detail.balanceDue > 0.009) throw new Error("Payment cannot exceed the balance due.");
    const feePercent = detail.passCardFee ? detail.feePercent : 0;
    const feeAmount = detail.passCardFee ? pay.cardFeeAmount(principal, feePercent) : 0;
    const stripe = require("./stripe-billing");
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
      invoiceLabel: "Invoice " + (detail.invoice.number || detail.invoice.id),
      description: "Payment toward invoice " + (detail.invoice.number || "")
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
    if (!session || session.mode !== "payment") return null;
    if (session.payment_status !== "paid" && session.status !== "complete") return null;
    const meta = session.metadata || {};
    const intentId = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent && session.payment_intent.id) || "";
    if (intentId) {
      const { data: existing } = await supabase.from("company_customer_payments").select("id").or("stripe_payment_intent_id.eq." + intentId + ",stripe_checkout_session_id.eq." + session.id).maybeSingle();
      if (existing) return this.getCustomerPayment(existing.id);
    }
    const invoiceId = Number(meta.invoice_id);
    const customerId = Number(meta.customer_id);
    const principal = pay.money(meta.principal_amount);
    const feeAmount = pay.money(meta.fee_amount);
    const feePercent = pay.money(meta.fee_percent);
    if (!invoiceId || !customerId || !(principal > 0)) throw new Error("Stripe session missing invoice payment metadata.");
    const payment = await this.createCustomerPayment({
      customerId: customerId,
      paymentDate: pay.todayIso(),
      amount: principal,
      method: (session.payment_method_types || []).indexOf("us_bank_account") !== -1 ? "ACH" : "Credit card",
      reference: session.id,
      memo: "Paid online via Stripe",
      source: "stripe",
      stripePaymentIntentId: intentId,
      stripeCheckoutSessionId: session.id,
      cardFeeAmount: feeAmount,
      cardFeePercent: feePercent,
      payLinkId: meta.pay_link_id ? Number(meta.pay_link_id) : null,
      applications: [{ invoiceId: invoiceId, amount: principal }]
    });
    if (meta.pay_link_id) {
      await supabase.from("company_invoice_pay_links").update({ status: "paid", updated_at: new Date().toISOString() }).eq("id", Number(meta.pay_link_id));
    } else if (meta.pay_token) {
      await supabase.from("company_invoice_pay_links").update({ status: "paid", updated_at: new Date().toISOString() }).eq("token", meta.pay_token);
    }
    return payment;
  };

  api.listCardFeeEntries = async function (opts) {
    opts = opts || {};
    let q = supabase.from("company_card_fee_entries").select("*").order("id", { ascending: false }).limit(Math.min(500, Number(opts.limit) || 100));
    if (opts.customerId) q = q.eq("customer_id", opts.customerId);
    const { data, error } = await q;
    throwIf(error);
    return (data || []).map(pay.formatCardFeeEntry);
  };
}

module.exports = { attachPaymentMethods };
