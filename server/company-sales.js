function trim(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max || 240);
}

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : (fallback || 0);
}

function money(value) {
  return Math.round(num(value) * 100) / 100;
}

const TYPES = { quote: 'quote', order: 'order', invoice: 'invoice' };
const PREFIX = { quote: 'SQ', order: 'SO', invoice: 'INV' };
const STATUSES = {
  quote: ['draft', 'sent', 'accepted', 'expired', 'void'],
  order: ['draft', 'confirmed', 'fulfilled', 'cancelled'],
  invoice: ['draft', 'sent', 'paid', 'overdue', 'void']
};

function typeLabel(type) {
  if (type === 'quote') return 'Sales Quote';
  if (type === 'invoice') return 'Invoice';
  return 'Sales Order';
}

function normalizeType(value) {
  const t = String(value || '').trim().toLowerCase();
  if (t === 'quote' || t === 'order' || t === 'invoice') return t;
  throw new Error('Choose Sales Quote, Sales Order, or Invoice.');
}

function normalizeStatus(type, value) {
  const allowed = STATUSES[type] || STATUSES.order;
  const s = String(value || '').trim().toLowerCase();
  if (allowed.indexOf(s) !== -1) return s;
  return 'draft';
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeLine(input, index) {
  const src = input || {};
  const qty = money(src.qty == null ? 1 : src.qty);
  const unitPrice = money(src.unitPrice != null ? src.unitPrice : src.unit_price);
  return {
    sku: trim(src.sku, 80),
    description: trim(src.description, 400),
    qty: qty,
    unitPrice: unitPrice,
    amount: money(qty * unitPrice),
    sortOrder: index
  };
}

function normalizeLines(list) {
  return (Array.isArray(list) ? list : []).map(normalizeLine).filter(function (line) {
    return line.sku || line.description || line.qty || line.unitPrice;
  });
}

function totalsFrom(lines, discount, taxRate) {
  const subtotal = money(lines.reduce(function (sum, line) { return sum + line.amount; }, 0));
  const disc = Math.max(0, money(discount));
  const rate = Math.max(0, money(taxRate));
  const taxable = Math.max(0, subtotal - disc);
  const tax = money(taxable * (rate / 100));
  return {
    subtotal: subtotal,
    discount: disc,
    taxRate: rate,
    tax: tax,
    total: money(taxable + tax)
  };
}

function nextDocNumber(existing, type) {
  const prefix = PREFIX[type] || 'SO';
  let max = 1000;
  (existing || []).forEach(function (n) {
    const m = String(n || '').toUpperCase().match(new RegExp('^' + prefix + '-(\\d+)$'));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return prefix + '-' + (max + 1);
}

function normalizeDoc(input) {
  const src = input || {};
  const type = normalizeType(src.type);
  const lines = normalizeLines(src.lines);
  const taxRate = src.taxRate != null ? src.taxRate : src.tax_rate;
  const discount = src.discount;
  const totals = totalsFrom(lines, discount, taxRate);
  const customerId = src.customerId != null ? src.customerId : src.customer_id;
  const customerName = trim(src.customerName || src.customer_name, 160);
  if (!customerId && !customerName) {
    throw new Error('Select a customer or enter a customer name.');
  }
  return {
    type: type,
    number: trim(src.number, 40),
    customerId: customerId ? String(customerId) : '',
    customerName: customerName,
    customerEmail: trim(src.customerEmail || src.customer_email, 160).toLowerCase(),
    poNumber: trim(src.poNumber || src.po_number, 80),
    issueDate: trim(src.issueDate || src.issue_date, 20) || todayIso(),
    dueDate: trim(src.dueDate || src.due_date, 20),
    paymentTerms: trim(src.paymentTerms || src.payment_terms, 80) || 'Net 30',
    status: normalizeStatus(type, src.status),
    taxRate: totals.taxRate,
    discount: totals.discount,
    notes: trim(src.notes, 2000),
    billStreet: trim(src.billStreet || src.bill_street, 240),
    billCity: trim(src.billCity || src.bill_city, 80),
    billState: trim(src.billState || src.bill_state, 80),
    billZip: trim(src.billZip || src.bill_zip, 20),
    billCountry: trim(src.billCountry || src.bill_country, 80) || 'United States',
    shipStreet: trim(src.shipStreet || src.ship_street, 240),
    shipCity: trim(src.shipCity || src.ship_city, 80),
    shipState: trim(src.shipState || src.ship_state, 80),
    shipZip: trim(src.shipZip || src.ship_zip, 20),
    shipCountry: trim(src.shipCountry || src.ship_country, 80) || 'United States',
    lines: lines,
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totals.total
  };
}

function formatLine(row) {
  if (!row) return null;
  const qty = money(row.qty);
  const unitPrice = money(row.unit_price);
  return {
    id: row.id,
    sku: row.sku || '',
    description: row.description || '',
    qty: qty,
    unitPrice: unitPrice,
    amount: money(qty * unitPrice)
  };
}

function formatDoc(row, lines) {
  if (!row) return null;
  const items = (lines || []).map(formatLine).filter(Boolean);
  const totals = totalsFrom(items, row.discount, row.tax_rate);
  return {
    id: row.id,
    type: row.type,
    typeLabel: typeLabel(row.type),
    number: row.number || '',
    customerId: row.customer_id == null ? '' : String(row.customer_id),
    customerName: row.customer_name || '',
    customerEmail: row.customer_email || '',
    poNumber: row.po_number || '',
    issueDate: row.issue_date || '',
    dueDate: row.due_date || '',
    paymentTerms: row.payment_terms || 'Net 30',
    status: row.status || 'draft',
    taxRate: totals.taxRate,
    discount: totals.discount,
    notes: row.notes || '',
    billStreet: row.bill_street || '',
    billCity: row.bill_city || '',
    billState: row.bill_state || '',
    billZip: row.bill_zip || '',
    billCountry: row.bill_country || '',
    shipStreet: row.ship_street || '',
    shipCity: row.ship_city || '',
    shipState: row.ship_state || '',
    shipZip: row.ship_zip || '',
    shipCountry: row.ship_country || '',
    lines: items,
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totals.total,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

function dbDocFields(input) {
  return {
    type: input.type,
    number: input.number,
    customer_id: input.customerId ? Number(input.customerId) : null,
    customer_name: input.customerName,
    customer_email: input.customerEmail,
    po_number: input.poNumber,
    issue_date: input.issueDate,
    due_date: input.dueDate,
    payment_terms: input.paymentTerms,
    status: input.status,
    tax_rate: input.taxRate,
    discount: input.discount,
    notes: input.notes,
    bill_street: input.billStreet,
    bill_city: input.billCity,
    bill_state: input.billState,
    bill_zip: input.billZip,
    bill_country: input.billCountry,
    ship_street: input.shipStreet,
    ship_city: input.shipCity,
    ship_state: input.shipState,
    ship_zip: input.shipZip,
    ship_country: input.shipCountry
  };
}

function snapshotFromCustomer(customer) {
  if (!customer) return {};
  return {
    customerId: customer.id,
    customerName: customer.displayName || customer.companyName || customer.contactName || '',
    customerEmail: customer.email || '',
    paymentTerms: customer.paymentTerms || 'Net 30',
    billStreet: customer.billStreet || '',
    billCity: customer.billCity || '',
    billState: customer.billState || '',
    billZip: customer.billZip || '',
    billCountry: customer.billCountry || 'United States',
    shipStreet: customer.shipStreet || customer.billStreet || '',
    shipCity: customer.shipCity || customer.billCity || '',
    shipState: customer.shipState || customer.billState || '',
    shipZip: customer.shipZip || customer.billZip || '',
    shipCountry: customer.shipCountry || customer.billCountry || 'United States'
  };
}

module.exports = {
  TYPES,
  STATUSES,
  typeLabel,
  normalizeType,
  normalizeDoc,
  formatDoc,
  formatLine,
  dbDocFields,
  nextDocNumber,
  snapshotFromCustomer,
  todayIso
};
