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

function idOf(value) {
  if (value == null || value === '') return '';
  return String(value);
}

function rowUntracked(row) {
  if (!row) return false;
  if (bool(row.untracked)) return true;
  return String(row.type || row.kind || '').toLowerCase() === 'partner';
}

function isHomeWarehouse(row) {
  if (!row) return false;
  return locationKind(row.type || row.kind) === 'warehouse' && !rowUntracked(row);
}

function addressFrom(kind, src) {
  const row = src || {};
  if (kind !== 'warehouse') {
    return { street: '', street2: '', city: '', state: '', zip: '', country: '' };
  }
  return {
    street: trim(row.street, 240),
    street2: trim(row.street2 != null ? row.street2 : row.street_2, 240),
    city: trim(row.city, 80),
    state: trim(row.state, 80),
    zip: trim(row.zip, 20),
    country: trim(row.country, 80)
  };
}

function addressText(addr) {
  const a = addr || {};
  const street = [a.street, a.street2].filter(Boolean).join(', ');
  const cityLine = [a.city, [a.state, a.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [street, cityLine, a.country].filter(Boolean).join('\n');
}

function parentIdFrom(src, kind) {
  if (kind !== 'bin') return '';
  const raw = src.parentId != null ? src.parentId : src.parent_id;
  return String(raw || '').trim();
}

function normalizeWarehouse(input, opts) {
  const src = input || {};
  const name = trim(src.name, 160);
  if (!name) throw new Error('Name the location.');
  const kind = locationKind(src.kind || src.type);
  const parentId = parentIdFrom(src, kind);
  if (kind === 'bin' && !parentId) throw new Error('Pick a warehouse for this bin.');
  const vendorId = src.vendorId != null ? src.vendorId : src.vendor_id;
  const vendor = kind === 'warehouse' ? String(vendorId || '').trim() : '';
  let untracked = false;
  if (kind === 'warehouse' && vendor) {
    untracked = bool(src.untracked != null ? src.untracked : src.doNotTrack);
  }
  const addr = addressFrom(kind, src);
  const out = {
    name: name,
    type: kind,
    kind: kind,
    parentId: parentId,
    vendorId: vendor,
    untracked: untracked,
    notes: trim(src.notes, 2000),
    street: addr.street,
    street2: addr.street2,
    city: addr.city,
    state: addr.state,
    zip: addr.zip,
    country: addr.country
  };
  const existing = (opts && opts.existing) || [];
  const selfId = opts && opts.id != null ? String(opts.id) : '';
  if (kind === 'bin') {
    const parent = existing.find(function (row) { return String(row.id) === parentId; });
    if (!parent) throw new Error('Parent warehouse not found.');
    if (locationKind(parent.type || parent.kind) !== 'warehouse') {
      throw new Error('A bin has to live in a warehouse.');
    }
    if (selfId && String(parent.id) === selfId) throw new Error('A bin cannot be its own warehouse.');
    const clash = existing.find(function (row) {
      if (selfId && String(row.id) === selfId) return false;
      if (locationKind(row.type || row.kind) !== 'bin') return false;
      if (String(row.parent_id != null ? row.parent_id : row.parentId) !== parentId) return false;
      return String(row.name || '').trim().toLowerCase() === name.toLowerCase();
    });
    if (clash) throw new Error('That bin already exists in this warehouse.');
  }
  return out;
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
  const parentId = kind === 'bin'
    ? idOf(row.parent_id != null ? row.parent_id : (row.parentId != null ? row.parentId : extraBits.parentId))
    : '';
  const vendorId = kind === 'warehouse' ? (row.vendor_id || extraBits.vendorId || '') : '';
  const untracked = kind === 'warehouse' && vendorId ? rowUntracked(row) : false;
  const itemCount = extraBits.itemCount != null ? Number(extraBits.itemCount) || 0 : 0;
  const qty = extraBits.qty != null ? Math.max(0, Number(extraBits.qty) || 0) : 0;
  const stock = locationStockStatus(untracked, extraBits);
  const addr = addressFrom(kind, row);
  return {
    id: row.id,
    name: row.name || '',
    type: kind,
    kind: kind,
    typeLabel: kindLabel(kind),
    parentId: parentId,
    parentName: extraBits.parentName || '',
    vendorId: vendorId,
    vendorName: vendorId ? (extraBits.vendorName || row.vendor_name || '') : '',
    untracked: untracked,
    tracked: !untracked,
    notes: row.notes || '',
    street: addr.street,
    street2: addr.street2,
    city: addr.city,
    state: addr.state,
    zip: addr.zip,
    country: addr.country,
    address: addressText(addr),
    itemCount: itemCount,
    qty: qty,
    ownQty: qty,
    ownItemCount: itemCount,
    hasChildBins: false,
    hasLow: !!extraBits.hasLow,
    status: stock.status,
    statusLabel: stock.statusLabel,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

function decorateWarehouses(list) {
  const rows = (list || []).filter(Boolean);
  const byId = {};
  rows.forEach(function (row) { byId[String(row.id)] = row; });
  rows.forEach(function (row) {
    if (row.kind !== 'bin') {
      if (row.kind === 'warehouse' && row.vendorName) {
        row.typeLabel = 'Warehouse · ' + row.vendorName;
      }
      return;
    }
    const parent = row.parentId ? byId[String(row.parentId)] : null;
    if (parent) {
      row.parentName = parent.name || '';
      row.vendorId = parent.vendorId || '';
      row.vendorName = parent.vendorName || '';
      row.untracked = !!parent.untracked;
      row.tracked = !row.untracked;
      row.typeLabel = row.parentName ? ('Bin · ' + row.parentName) : 'Bin';
    } else {
      row.typeLabel = 'Bin';
    }
    const stock = locationStockStatus(row.untracked, {
      itemCount: row.itemCount,
      qty: row.qty,
      hasLow: row.hasLow
    });
    row.status = stock.status;
    row.statusLabel = stock.statusLabel;
  });
  rows.forEach(function (row) {
    if (row.kind !== 'warehouse') return;
    const kids = rows.filter(function (child) {
      return child.kind === 'bin' && String(child.parentId) === String(row.id);
    });
    row.hasChildBins = kids.length > 0;
    row.ownQty = row.qty;
    row.ownItemCount = row.itemCount;
    kids.forEach(function (child) {
      row.qty += Number(child.qty) || 0;
      row.itemCount += Number(child.itemCount) || 0;
      if (child.hasLow) row.hasLow = true;
    });
    const stock = locationStockStatus(row.untracked, {
      itemCount: row.itemCount,
      qty: row.qty,
      hasLow: row.hasLow
    });
    row.status = stock.status;
    row.statusLabel = stock.statusLabel;
  });
  return rows;
}

function sortGrouped(list) {
  const rows = (list || []).slice();
  function byName(a, b) {
    return String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true, sensitivity: 'base' });
  }
  const warehouses = rows.filter(function (row) { return row.kind === 'warehouse'; }).sort(byName);
  const customs = rows.filter(function (row) { return row.kind === 'custom'; }).sort(byName);
  const bins = rows.filter(function (row) { return row.kind === 'bin'; });
  const used = {};
  const out = [];
  warehouses.forEach(function (wh) {
    out.push(wh);
    bins.filter(function (bin) { return String(bin.parentId) === String(wh.id); }).sort(byName).forEach(function (bin) {
      used[String(bin.id)] = true;
      out.push(bin);
    });
  });
  bins.filter(function (bin) { return !used[String(bin.id)]; }).sort(byName).forEach(function (bin) {
    out.push(bin);
  });
  customs.forEach(function (row) { out.push(row); });
  return out;
}

function childIdsOf(list, warehouseId) {
  const id = String(warehouseId);
  return (list || []).filter(function (row) {
    return locationKind(row.type || row.kind) === 'bin' && String(row.parent_id != null ? row.parent_id : row.parentId) === id;
  }).map(function (row) { return row.id; });
}

function dbFields(input) {
  return {
    name: input.name,
    type: input.type,
    parent_id: input.parentId ? input.parentId : null,
    vendor_id: input.vendorId ? input.vendorId : null,
    untracked: input.untracked ? 1 : 0,
    notes: input.notes,
    street: input.street || '',
    street2: input.street2 || '',
    city: input.city || '',
    state: input.state || '',
    zip: input.zip || '',
    country: input.country || ''
  };
}

function forSupabase(fields) {
  const out = Object.assign({}, fields);
  if (out.parent_id != null && out.parent_id !== '') out.parent_id = Number(out.parent_id);
  else out.parent_id = null;
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
  isHomeWarehouse,
  addressFrom,
  addressText,
  normalizeWarehouse,
  formatWarehouse,
  decorateWarehouses,
  sortGrouped,
  childIdsOf,
  locationStockStatus,
  dbFields,
  forSupabase
};
