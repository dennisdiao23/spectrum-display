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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeLine(input, index) {
  const src = input || {};
  const warehouseId = src.warehouseId != null ? src.warehouseId : (src.warehouse_id != null ? src.warehouse_id : src.locationId);
  return {
    poLineId: src.poLineId != null ? src.poLineId : (src.po_line_id || ''),
    itemId: src.itemId != null ? src.itemId : (src.item_id || ''),
    sku: trim(src.sku, 80),
    product: trim(src.product || src.name, 160),
    poQty: money(src.poQty != null ? src.poQty : (src.po_qty != null ? src.po_qty : src.qty)),
    qtyReceived: money(src.qtyReceived != null ? src.qtyReceived : (src.qty_received != null ? src.qty_received : src.received)),
    warehouseId: warehouseId ? String(warehouseId).trim() : '',
    sortOrder: index
  };
}

function normalizeLines(list) {
  return (Array.isArray(list) ? list : []).map(normalizeLine).filter(function (line) {
    return line.sku || line.product || line.poQty || line.qtyReceived;
  });
}

function normalizeReceipt(input) {
  const src = input || {};
  const lines = normalizeLines(src.lines);
  const vendorId = src.vendorId != null ? src.vendorId : src.vendor_id;
  const vendorName = trim(src.vendorName || src.vendor_name, 160);
  if (!vendorId && !vendorName) throw new Error('Choose a vendor.');
  const received = lines.filter(function (line) { return line.qtyReceived > 0; });
  if (!received.length) throw new Error('Enter a received quantity for at least one line.');
  received.forEach(function (line) {
    if (!line.sku && !line.itemId) throw new Error('Each received line needs a SKU.');
  });
  const warehouseId = src.warehouseId != null ? src.warehouseId : (src.warehouse_id != null ? src.warehouse_id : src.locationId);
  return {
    number: trim(src.number, 40),
    vendorId: vendorId ? String(vendorId) : '',
    vendorName: vendorName,
    poId: src.poId != null ? String(src.poId) : String(src.po_id || ''),
    poNumber: trim(src.poNumber || src.po_number, 40),
    receiptDate: trim(src.receiptDate || src.receipt_date, 20) || todayIso(),
    warehouseId: warehouseId ? String(warehouseId).trim() : '',
    memo: trim(src.memo || src.notes, 2000),
    lines: lines,
    status: 'received'
  };
}

function formatLine(row) {
  if (!row) return null;
  return {
    id: row.id,
    poLineId: row.po_line_id == null ? '' : String(row.po_line_id),
    itemId: row.item_id == null ? '' : String(row.item_id),
    sku: row.sku || '',
    product: row.product || '',
    poQty: money(row.po_qty),
    qtyReceived: money(row.qty_received),
    warehouseId: row.warehouse_id == null ? '' : String(row.warehouse_id)
  };
}

function formatReceipt(row, lines, extra) {
  if (!row) return null;
  const bits = extra || {};
  const items = (lines || []).map(formatLine).filter(Boolean);
  const totalReceived = money(items.reduce(function (sum, line) { return sum + line.qtyReceived; }, 0));
  const warehouseId = row.warehouse_id == null ? '' : String(row.warehouse_id);
  return {
    id: row.id,
    number: row.number || '',
    vendorId: row.vendor_id == null ? '' : String(row.vendor_id),
    vendorName: row.vendor_name || '',
    poId: row.po_id == null ? '' : String(row.po_id),
    poNumber: row.po_number || '',
    receiptDate: row.receipt_date || '',
    warehouseId: warehouseId,
    locationId: warehouseId,
    warehouseName: bits.warehouseName || row.warehouse_name || '',
    memo: row.memo || '',
    status: row.status || 'received',
    lines: items,
    totalReceived: totalReceived,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

function dbReceiptFields(input) {
  return {
    number: input.number,
    vendor_id: input.vendorId ? Number(input.vendorId) : null,
    vendor_name: input.vendorName,
    po_id: input.poId ? Number(input.poId) : null,
    po_number: input.poNumber,
    receipt_date: input.receiptDate,
    warehouse_id: input.warehouseId ? Number(input.warehouseId) : null,
    memo: input.memo,
    status: input.status || 'received'
  };
}

function nextReceiptNumber(existing) {
  let max = 1000;
  (existing || []).forEach(function (n) {
    const m = String(n || '').toUpperCase().match(/^RS-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return 'RS-' + (max + 1);
}

function snapshotFromVendor(vendor) {
  if (!vendor) return {};
  return {
    vendorId: vendor.id,
    vendorName: vendor.displayName || vendor.companyName || ''
  };
}

module.exports = {
  normalizeReceipt,
  normalizeLine,
  normalizeLines,
  formatReceipt,
  formatLine,
  dbReceiptFields,
  nextReceiptNumber,
  snapshotFromVendor,
  todayIso
};
