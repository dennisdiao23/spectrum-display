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

const STATUSES = ['open', 'closed', 'cancelled'];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeStatus(value) {
  const s = String(value || '').trim().toLowerCase();
  return STATUSES.indexOf(s) !== -1 ? s : 'open';
}

function normalizeLine(input, index) {
  const src = input || {};
  const qty = money(src.qty == null ? 1 : src.qty);
  const rate = money(src.rate != null ? src.rate : (src.unitCost != null ? src.unitCost : src.unit_cost));
  return {
    itemId: src.itemId != null ? src.itemId : src.item_id || '',
    product: trim(src.product || src.productService || src.product_service, 160),
    sku: trim(src.sku, 80),
    description: trim(src.description, 400),
    qty: qty,
    rate: rate,
    amount: money(qty * rate),
    sortOrder: index
  };
}

function normalizeLines(list) {
  return (Array.isArray(list) ? list : []).map(normalizeLine).filter(function (line) {
    return line.product || line.sku || line.description || line.qty || line.rate;
  });
}

function totalsFrom(lines) {
  const total = money(lines.reduce(function (sum, line) { return sum + line.amount; }, 0));
  return { total: total };
}

function nextPoNumber(existing) {
  let max = 1000;
  (existing || []).forEach(function (n) {
    const m = String(n || '').toUpperCase().match(/^PO-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return 'PO-' + (max + 1);
}

function normalizePo(input) {
  const src = input || {};
  const lines = normalizeLines(src.lines);
  const totals = totalsFrom(lines);
  const vendorId = src.vendorId != null ? src.vendorId : src.vendor_id;
  const vendorName = trim(src.vendorName || src.vendor_name, 160);
  if (!vendorId && !vendorName) {
    throw new Error('Choose a vendor.');
  }
  return {
    number: trim(src.number, 40),
    vendorId: vendorId ? String(vendorId) : '',
    vendorName: vendorName,
    vendorEmail: trim(src.vendorEmail || src.vendor_email, 240).toLowerCase(),
    status: normalizeStatus(src.status),
    issueDate: trim(src.issueDate || src.issue_date, 20) || todayIso(),
    dueDate: trim(src.dueDate || src.due_date, 20),
    shipVia: trim(src.shipVia || src.ship_via, 80),
    permitNo: trim(src.permitNo || src.permit_no, 80),
    mailingAddress: trim(src.mailingAddress || src.mailing_address, 800),
    shipToCustomerId: src.shipToCustomerId != null ? String(src.shipToCustomerId) : String(src.ship_to_customer_id || ''),
    shipToName: trim(src.shipToName || src.ship_to_name, 160),
    shippingAddress: trim(src.shippingAddress || src.shipping_address, 800),
    notes: trim(src.notes || src.memo, 2000),
    lines: lines,
    total: totals.total
  };
}

function formatLine(row) {
  if (!row) return null;
  const qty = money(row.qty);
  const rate = money(row.unit_cost != null ? row.unit_cost : row.rate);
  return {
    id: row.id,
    itemId: row.item_id == null ? '' : String(row.item_id),
    product: row.product || '',
    sku: row.sku || '',
    description: row.description || '',
    qty: qty,
    rate: rate,
    amount: money(qty * rate)
  };
}

function formatPo(row, lines) {
  if (!row) return null;
  const items = (lines || []).map(formatLine).filter(Boolean);
  const totals = totalsFrom(items);
  return {
    id: row.id,
    number: row.number || '',
    vendorId: row.vendor_id == null ? '' : String(row.vendor_id),
    vendorName: row.vendor_name || '',
    vendorEmail: row.vendor_email || '',
    status: row.status || 'open',
    issueDate: row.issue_date || '',
    dueDate: row.due_date || '',
    shipVia: row.ship_via || '',
    permitNo: row.permit_no || '',
    mailingAddress: row.mailing_address || '',
    shipToCustomerId: row.ship_to_customer_id == null ? '' : String(row.ship_to_customer_id),
    shipToName: row.ship_to_name || '',
    shippingAddress: row.shipping_address || '',
    notes: row.notes || '',
    lines: items,
    total: totals.total,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

function dbPoFields(input) {
  return {
    number: input.number,
    vendor_id: input.vendorId ? Number(input.vendorId) : null,
    vendor_name: input.vendorName,
    vendor_email: input.vendorEmail,
    status: input.status,
    issue_date: input.issueDate,
    due_date: input.dueDate,
    ship_via: input.shipVia,
    permit_no: input.permitNo,
    mailing_address: input.mailingAddress,
    ship_to_customer_id: input.shipToCustomerId ? Number(input.shipToCustomerId) : null,
    ship_to_name: input.shipToName,
    shipping_address: input.shippingAddress,
    notes: input.notes
  };
}

function snapshotFromVendor(vendor) {
  if (!vendor) return {};
  return {
    vendorId: vendor.id,
    vendorName: vendor.displayName || vendor.companyName || '',
    vendorEmail: vendor.email || '',
    mailingAddress: vendor.mailingAddress || ''
  };
}

module.exports = {
  normalizePo,
  formatPo,
  formatLine,
  dbPoFields,
  nextPoNumber,
  snapshotFromVendor,
  todayIso
};
