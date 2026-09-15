/**
 * Customer payments applied to invoices.
 * Card processing fees are tracked in a separate ledger — never as invoice lines.
 */

function trim(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max || 240);
}

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function bool(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function token() {
  const crypto = require('crypto');
  return crypto.randomBytes(24).toString('hex');
}

function defaultCardFeePercent() {
  const n = Number(process.env.STRIPE_CARD_FEE_PERCENT);
  return Number.isFinite(n) && n >= 0 ? n : 3;
}

function cardFeeAmount(principal, percent) {
  const p = money(principal);
  const rate = Number(percent);
  if (!(p > 0) || !Number.isFinite(rate) || rate <= 0) return 0;
  return money(p * (rate / 100));
}

function normalizeMethod(value) {
  const m = trim(value, 40).toLowerCase();
  if (m === 'ach' || m === 'us_bank_account' || m === 'bank') return 'ACH';
  if (m === 'credit card' || m === 'card' || m === 'creditcard') return 'Credit card';
  if (m === 'wire' || m === 'wire transfer') return 'Wire';
  if (m === 'check' || m === 'cheque') return 'Check';
  if (m === 'stripe') return 'Stripe';
  return trim(value, 40) || 'Check';
}

function stripeMethodsForCustomer(paymentMethod) {
  const m = normalizeMethod(paymentMethod);
  if (m === 'Credit card') return ['card'];
  if (m === 'ACH') return ['us_bank_account'];
  return [];
}

function onlinePayEnabled(paymentMethod) {
  return stripeMethodsForCustomer(paymentMethod).length > 0;
}

function normalizeApplications(list) {
  return (Array.isArray(list) ? list : []).map(function (row) {
    const invoiceId = row && (row.invoiceId != null ? row.invoiceId : row.invoice_id);
    const amount = money(row && row.amount);
    if (!invoiceId || !(amount > 0)) return null;
    return { invoiceId: Number(invoiceId), amount: amount };
  }).filter(Boolean);
}

function normalizePayment(input) {
  const src = input || {};
  const amount = money(src.amount);
  if (!(amount > 0)) throw new Error('Enter a payment amount greater than zero.');
  const customerId = src.customerId != null ? src.customerId : src.customer_id;
  if (!customerId) throw new Error('Select a customer.');
  const applications = normalizeApplications(src.applications || src.apps);
  const applied = money(applications.reduce(function (sum, a) { return sum + a.amount; }, 0));
  if (applied - amount > 0.009) {
    throw new Error('Applied amount cannot exceed the payment total.');
  }
  return {
    customerId: Number(customerId),
    paymentDate: trim(src.paymentDate || src.payment_date, 20) || todayIso(),
    amount: amount,
    method: normalizeMethod(src.method || src.paymentMethod || src.payment_method),
    reference: trim(src.reference || src.ref, 120),
    memo: trim(src.memo || src.notes, 2000),
    source: trim(src.source, 40) || 'manual',
    stripePaymentIntentId: trim(src.stripePaymentIntentId || src.stripe_payment_intent_id, 120),
    stripeCheckoutSessionId: trim(src.stripeCheckoutSessionId || src.stripe_checkout_session_id, 120),
    status: trim(src.status, 20).toLowerCase() === 'void' ? 'void' : 'posted',
    applications: applications,
    cardFeeAmount: money(src.cardFeeAmount != null ? src.cardFeeAmount : src.card_fee_amount),
    cardFeePercent: money(src.cardFeePercent != null ? src.cardFeePercent : src.card_fee_percent),
    payLinkId: src.payLinkId != null ? src.payLinkId : (src.pay_link_id || null)
  };
}

function formatPayment(row, applications) {
  if (!row) return null;
  const apps = (applications || []).map(function (a) {
    return {
      id: a.id,
      invoiceId: a.invoice_id,
      invoiceNumber: a.invoice_number || '',
      amount: money(a.amount)
    };
  });
  const applied = money(apps.reduce(function (sum, a) { return sum + a.amount; }, 0));
  return {
    id: row.id,
    customerId: row.customer_id,
    paymentDate: row.payment_date || '',
    amount: money(row.amount),
    method: row.method || '',
    reference: row.reference || '',
    memo: row.memo || '',
    source: row.source || 'manual',
    stripePaymentIntentId: row.stripe_payment_intent_id || '',
    stripeCheckoutSessionId: row.stripe_checkout_session_id || '',
    status: row.status || 'posted',
    cardFeeAmount: money(row.card_fee_amount),
    cardFeePercent: money(row.card_fee_percent),
    payLinkId: row.pay_link_id || null,
    applications: apps,
    amountApplied: applied,
    unapplied: money(Math.max(0, money(row.amount) - applied)),
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

function formatCardFeeEntry(row) {
  if (!row) return null;
  return {
    id: row.id,
    paymentId: row.payment_id,
    customerId: row.customer_id,
    invoiceId: row.invoice_id,
    feeAmount: money(row.fee_amount),
    feePercent: money(row.fee_percent),
    stripeChargeId: row.stripe_charge_id || '',
    status: row.status || 'charged',
    createdAt: row.created_at || ''
  };
}

function formatPayLink(row) {
  if (!row) return null;
  return {
    id: row.id,
    token: row.token || '',
    invoiceId: row.invoice_id,
    customerId: row.customer_id,
    minAmount: money(row.min_amount),
    balanceAtCreate: money(row.balance_at_create),
    collectMode: row.collect_mode || 'full',
    status: row.status || 'open',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

function depositMinFromCustomer(customer, balance) {
  const bal = money(balance);
  if (!(bal > 0)) return 0;
  const mode = trim(customer && (customer.invoiceCollectDefault || customer.invoice_collect_default), 20).toLowerCase();
  if (mode !== 'deposit') return money(bal);
  const kind = trim(customer && (customer.invoiceDepositKind || customer.invoice_deposit_kind), 20).toLowerCase() || 'percent';
  const value = money(customer && (customer.invoiceDepositValue != null ? customer.invoiceDepositValue : customer.invoice_deposit_value));
  let min = bal;
  if (kind === 'amount') min = value;
  else min = money(bal * ((value > 0 ? value : 30) / 100));
  if (min < 0.01) min = 0.01;
  if (min > bal) min = bal;
  return min;
}

function resolveCardFeePercent(customer) {
  const custom = customer && (customer.cardFeePercent != null ? customer.cardFeePercent : customer.card_fee_percent);
  if (custom != null && custom !== '' && Number.isFinite(Number(custom)) && Number(custom) >= 0) {
    return money(custom);
  }
  return defaultCardFeePercent();
}

function shouldPassCardFee(customer) {
  if (!customer) return false;
  if (normalizeMethod(customer.paymentMethod || customer.payment_method) !== 'Credit card') return false;
  return bool(customer.passCardFee != null ? customer.passCardFee : customer.pass_card_fee);
}

module.exports = {
  money,
  trim,
  bool,
  todayIso,
  token,
  defaultCardFeePercent,
  cardFeeAmount,
  normalizeMethod,
  stripeMethodsForCustomer,
  onlinePayEnabled,
  normalizePayment,
  normalizeApplications,
  formatPayment,
  formatCardFeeEntry,
  formatPayLink,
  depositMinFromCustomer,
  resolveCardFeePercent,
  shouldPassCardFee
};
