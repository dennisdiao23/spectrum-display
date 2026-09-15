const pay = require('./company-payments');

function invoiceTotal(doc) {
  if (!doc) return 0;
  return pay.money(doc.total != null ? doc.total : doc.grandTotal);
}

function enrichInvoice(doc, amountPaid) {
  if (!doc) return doc;
  const total = invoiceTotal(doc);
  const paid = pay.money(amountPaid);
  const balance = pay.money(Math.max(0, total - paid));
  const out = Object.assign({}, doc, {
    amountPaid: paid,
    balanceDue: balance,
    paymentsApplied: paid
  });
  if (doc.type === 'invoice' && out.status !== 'void' && out.status !== 'draft') {
    if (balance <= 0.009 && total > 0) out.status = 'paid';
    else if (out.status === 'paid' && balance > 0.009) out.status = 'sent';
  }
  return out;
}

function nextInvoiceStatus(doc, amountPaid) {
  if (!doc || doc.type !== 'invoice') return doc && doc.status;
  if (doc.status === 'void' || doc.status === 'draft') return doc.status;
  const total = invoiceTotal(doc);
  const paid = pay.money(amountPaid);
  const balance = pay.money(Math.max(0, total - paid));
  if (balance <= 0.009 && total > 0) return 'paid';
  if (doc.status === 'paid' && balance > 0.009) return 'sent';
  return doc.status || 'sent';
}

module.exports = { invoiceTotal, enrichInvoice, nextInvoiceStatus };
