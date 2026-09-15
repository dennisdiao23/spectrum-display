/**
 * Stripe Checkout for invoice pay links (ACH and/or card).
 * Uses REST + fetch — no Stripe SDK dependency.
 */

function secretKey() {
  return String(process.env.STRIPE_SECRET_KEY || '').trim();
}

function webhookSecret() {
  return String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
}

function isConfigured() {
  return !!secretKey();
}

function publicOrigin() {
  return String(process.env.WWW_ORIGIN || process.env.PUBLIC_ORIGIN || 'https://www.spectrumdisplay.com')
    .trim()
    .replace(/\/$/, '') || 'https://www.spectrumdisplay.com';
}

function moneyToCents(amount) {
  return Math.round(Number(amount) * 100);
}

async function stripeRequest(method, path, params) {
  const key = secretKey();
  if (!key) {
    const err = new Error('Stripe is not set up. Add STRIPE_SECRET_KEY on Railway.');
    err.code = 'stripe_setup';
    err.status = 400;
    throw err;
  }
  const body = params ? new URLSearchParams() : null;
  if (params) {
    Object.keys(params).forEach(function (keyName) {
      const val = params[keyName];
      if (val == null) return;
      if (typeof val === 'object' && !Array.isArray(val)) {
        Object.keys(val).forEach(function (sub) {
          if (val[sub] == null) return;
          body.append(keyName + '[' + sub + ']', String(val[sub]));
        });
      } else if (Array.isArray(val)) {
        val.forEach(function (item, i) {
          if (item == null) return;
          if (typeof item === 'object') {
            Object.keys(item).forEach(function (sub) {
              if (item[sub] == null) return;
              body.append(keyName + '[' + i + '][' + sub + ']', String(item[sub]));
            });
          } else {
            body.append(keyName + '[' + i + ']', String(item));
          }
        });
      } else {
        body.append(keyName, String(val));
      }
    });
  }
  const res = await fetch('https://api.stripe.com/v1' + path, {
    method: method,
    headers: {
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body ? body.toString() : undefined
  });
  const data = await res.json().catch(function () { return {}; });
  if (!res.ok) {
    const msg = (data.error && data.error.message) || ('Stripe HTTP ' + res.status);
    const err = new Error(msg);
    err.status = res.status;
    err.code = (data.error && data.error.code) || 'stripe_error';
    throw err;
  }
  return data;
}

/**
 * Flatten nested objects for Stripe form encoding (line_items[0][price_data][...]).
 */
function flatten(prefix, value, out) {
  if (value == null) return;
  if (Array.isArray(value)) {
    value.forEach(function (item, i) {
      flatten(prefix + '[' + i + ']', item, out);
    });
    return;
  }
  if (typeof value === 'object') {
    Object.keys(value).forEach(function (k) {
      flatten(prefix + '[' + k + ']', value[k], out);
    });
    return;
  }
  out[prefix] = value;
}

async function stripeForm(method, path, obj) {
  const flat = {};
  Object.keys(obj || {}).forEach(function (k) {
    const v = obj[k];
    if (v != null && typeof v === 'object') flatten(k, v, flat);
    else if (v != null) flat[k] = v;
  });
  return stripeRequest(method, path, flat);
}

async function createInvoiceCheckout(opts) {
  const payments = require('./company-payments');
  const principal = payments.money(opts.principalAmount);
  const fee = payments.money(opts.feeAmount);
  if (!(principal > 0)) throw new Error('Payment amount must be greater than zero.');
  const methods = opts.paymentMethodTypes || ['card'];
  const lineItems = [
    {
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: moneyToCents(principal),
        product_data: {
          name: opts.invoiceLabel || 'Invoice payment',
          description: opts.description || undefined
        }
      }
    }
  ];
  if (fee > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: moneyToCents(fee),
        product_data: {
          name: 'Card processing fee',
          description: 'Processing fee (not applied to invoice balance)'
        }
      }
    });
  }
  const origin = publicOrigin();
  const token = opts.payToken;
  const session = await stripeForm('POST', '/checkout/sessions', {
    mode: 'payment',
    success_url: origin + '/pay/' + token + '?paid=1&session_id={CHECKOUT_SESSION_ID}',
    cancel_url: origin + '/pay/' + token + '?cancelled=1',
    client_reference_id: String(opts.payLinkId || token),
    customer_email: opts.email || undefined,
    payment_method_types: methods,
    line_items: lineItems,
    metadata: {
      pay_token: String(token || ''),
      pay_link_id: String(opts.payLinkId || ''),
      invoice_id: String(opts.invoiceId || ''),
      customer_id: String(opts.customerId || ''),
      principal_amount: String(principal),
      fee_amount: String(fee),
      fee_percent: String(opts.feePercent || 0)
    },
    payment_intent_data: {
      metadata: {
        pay_token: String(token || ''),
        invoice_id: String(opts.invoiceId || ''),
        customer_id: String(opts.customerId || ''),
        principal_amount: String(principal),
        fee_amount: String(fee)
      }
    }
  });
  return session;
}

function timingSafeEqual(a, b) {
  const crypto = require('crypto');
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyWebhookSignature(rawBody, signatureHeader) {
  const secret = webhookSecret();
  if (!secret) {
    const err = new Error('STRIPE_WEBHOOK_SECRET is not set.');
    err.status = 400;
    throw err;
  }
  const crypto = require('crypto');
  const parts = String(signatureHeader || '').split(',').reduce(function (acc, part) {
    const kv = part.split('=');
    if (kv.length === 2) {
      const k = kv[0].trim();
      if (!acc[k]) acc[k] = [];
      acc[k].push(kv[1].trim());
    }
    return acc;
  }, {});
  const timestamp = parts.t && parts.t[0];
  const signatures = parts.v1 || [];
  if (!timestamp || !signatures.length) {
    const err = new Error('Missing Stripe signature.');
    err.status = 400;
    throw err;
  }
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) {
    const err = new Error('Stripe webhook timestamp too old.');
    err.status = 400;
    throw err;
  }
  const signed = timestamp + '.' + String(rawBody || '');
  const expected = crypto.createHmac('sha256', secret).update(signed, 'utf8').digest('hex');
  const ok = signatures.some(function (sig) { return timingSafeEqual(sig, expected); });
  if (!ok) {
    const err = new Error('Invalid Stripe webhook signature.');
    err.status = 400;
    throw err;
  }
  return JSON.parse(String(rawBody || '{}'));
}

async function retrieveCheckoutSession(sessionId) {
  return stripeRequest('GET', '/checkout/sessions/' + encodeURIComponent(sessionId) + '?expand[]=payment_intent', null);
}

module.exports = {
  isConfigured,
  secretKey,
  webhookSecret,
  publicOrigin,
  siteOrigin: publicOrigin,
  createInvoiceCheckout,
  verifyWebhookSignature,
  retrieveCheckoutSession
};
