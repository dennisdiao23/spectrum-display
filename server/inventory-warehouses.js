function trim(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max || 240);
}

function bool(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

const KINDS = ['bin', 'warehouse', 'custom'];
const DEFAULT_NAME = 'Spectrum Warehouse';

function locationKind(value) {
  const t = String(value || '').trim().toLowerCase();
  if (t === 'bin') return 'bin';
  if (t === 'custom') return 'custom';
  return 'warehouse';
}

function kindLabel(kind) {
  const k = locationKind(kind);
  if (k === 'bin') return 'Bin';
  if (k === 'custom') return 'Custom';
  return 'Warehouse';
}

function rowUntracked(row) {
  if (!row) return false;
  if (bool(row.untracked)) return true;
  return String(row.type || row.kind || '').toLowerCase() === 'partner';
}

function normalizeWarehouse(input) {
  const src = input || {};
  const name = trim(src.name, 160);
  if (!name) throw new Error('Name the location.');
  const kind = locationKind(src.kind || src.type);
  const vendorId = src.vendorId != null ? src.vendorId : src.vendor_id;
  const vendor = kind === 'warehouse' ? String(vendorId || '').trim() : '';
  let untracked = false;
  if (kind === 'warehouse' && vendor) {
    untracked = bool(src.untracked != null ? src.untracked : src.doNotTrack);
  }
  return {
    name: name,
    type: kind,
    kind: kind,
    vendorId: vendor,
    untracked: untracked,
    notes: trim(src.notes, 2000)
  };
}

function locationStockStatus(untracked, extraBits) {
  const itemCount = extraBits.itemCount != null ? Number(extraBits.itemCount) || 0 : 0;
  const qty = extraBits.qty != null ? Math.max(0, Number(extraBits.qty) || 0) : 0;
  const hasLow = !!extraBits.hasLow;
  if (untracked && itemCount > 0) {
    return { status: 'untracked', statusLabel: 'Untracked' };
  }
  if (hasLow) {
    return { status: 'low', statusLabel: 'Low' };
  }
  if (qty > 0) {
    return { status: 'ok', statusLabel: 'In stock' };
  }
  return { status: 'empty', statusLabel: 'Empty' };
}

function formatWarehouse(row, extra) {
  if (!row) return null;
  const extraBits = extra || {};
  const kind = locationKind(row.type || row.kind);
  const vendorId = kind === 'warehouse' ? (row.vendor_id || extraBits.vendorId || '') : '';
  const untracked = kind === 'warehouse' && vendorId ? rowUntracked(row) : false;
  const itemCount = extraBits.itemCount != null ? Number(extraBits.itemCount) || 0 : 0;
  const qty = extraBits.qty != null ? Math.max(0, Number(extraBits.qty) || 0) : 0;
  const stock = locationStockStatus(untracked, extraBits);
  return {
    id: row.id,
    name: row.name || '',
    type: kind,
    kind: kind,
    typeLabel: kindLabel(kind),
    vendorId: vendorId,
    vendorName: vendorId ? (extraBits.vendorName || row.vendor_name || '') : '',
    untracked: untracked,
    tracked: !untracked,
    notes: row.notes || '',
    itemCount: itemCount,
    qty: qty,
    hasLow: !!extraBits.hasLow,
    status: stock.status,
    statusLabel: stock.statusLabel,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

function dbFields(input) {
  return {
    name: input.name,
    type: input.type,
    vendor_id: input.vendorId ? input.vendorId : null,
    untracked: input.untracked ? 1 : 0,
    notes: input.notes
  };
}

function forSupabase(fields) {
  const out = Object.assign({}, fields);
  if (out.vendor_id != null && out.vendor_id !== '') out.vendor_id = Number(out.vendor_id);
  else out.vendor_id = null;
  out.untracked = !!fields.untracked;
  return out;
}

module.exports = {
  TYPES: KINDS,
  KINDS,
  DEFAULT_SPECTRUM_NAME: DEFAULT_NAME,
  DEFAULT_NAME,
  locationKind,
  kindLabel,
  warehouseType: locationKind,
  typeLabel: kindLabel,
  rowUntracked,
  normalizeWarehouse,
  formatWarehouse,
  dbFields,
  forSupabase
};
