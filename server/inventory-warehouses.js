function trim(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max || 240);
}

const TYPES = ['spectrum', 'partner'];
const DEFAULT_SPECTRUM_NAME = 'Spectrum Warehouse';

function warehouseType(value) {
  const t = String(value || '').trim().toLowerCase();
  return t === 'partner' ? 'partner' : 'spectrum';
}

function typeLabel(type) {
  return warehouseType(type) === 'partner' ? 'Partner Warehouse' : 'Spectrum Warehouse';
}

function normalizeWarehouse(input) {
  const src = input || {};
  const name = trim(src.name, 160);
  if (!name) throw new Error('Name the warehouse.');
  const type = warehouseType(src.type);
  const vendorId = src.vendorId != null ? src.vendorId : src.vendor_id;
  const vendor = vendorId ? String(vendorId).trim() : '';
  if (type === 'partner' && !vendor) {
    throw new Error('Pick a vendor for a partner warehouse.');
  }
  return {
    name: name,
    type: type,
    vendorId: type === 'partner' ? vendor : '',
    notes: trim(src.notes, 2000)
  };
}

function formatWarehouse(row, extra) {
  if (!row) return null;
  const type = warehouseType(row.type);
  const extraBits = extra || {};
  return {
    id: row.id,
    name: row.name || '',
    type: type,
    typeLabel: typeLabel(type),
    vendorId: type === 'partner' ? (row.vendor_id || extraBits.vendorId || '') : '',
    vendorName: type === 'partner' ? (extraBits.vendorName || row.vendor_name || '') : '',
    notes: row.notes || '',
    itemCount: extraBits.itemCount != null ? Number(extraBits.itemCount) || 0 : 0,
    qty: extraBits.qty != null ? Math.max(0, Number(extraBits.qty) || 0) : 0,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

function dbFields(input) {
  return {
    name: input.name,
    type: input.type,
    vendor_id: input.vendorId ? input.vendorId : null,
    notes: input.notes
  };
}

function forSupabase(fields) {
  const out = Object.assign({}, fields);
  if (out.vendor_id != null && out.vendor_id !== '') out.vendor_id = Number(out.vendor_id);
  else out.vendor_id = null;
  return out;
}

module.exports = {
  TYPES,
  DEFAULT_SPECTRUM_NAME,
  warehouseType,
  typeLabel,
  normalizeWarehouse,
  formatWarehouse,
  dbFields,
  forSupabase
};
