function isControlProduct(p) {
  const t = String((p && p.type) || '').toLowerCase();
  return t === 'control' || (p && p.brandId === 'novastar') || !!(p && p.subtype);
}

function pitchKey(value) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (isFinite(n) && String(value).trim() !== '') return String(n);
  return String(value).trim();
}

function defaultLowAt(control) {
  return control ? 2 : 8;
}

function binStatus(qty, lowAt) {
  const q = Math.max(0, Number(qty) || 0);
  const low = Math.max(0, Number(lowAt) || 0);
  if (q <= 0) return 'out';
  if (q <= low) return 'low';
  return 'ok';
}

function worstStatus(statuses) {
  if ((statuses || []).indexOf('out') !== -1) return 'out';
  if ((statuses || []).indexOf('low') !== -1) return 'low';
  return 'ok';
}

function binsForProduct(product, stockRows) {
  const control = isControlProduct(product);
  let pitches = control
    ? ['']
    : (product.pitches || []).map(pitchKey).filter(function (p, i, a) { return p && a.indexOf(p) === i; });
  if (!pitches.length) pitches = [''];
  const byPitch = {};
  (stockRows || []).forEach(function (r) {
    byPitch[pitchKey(r.pitch)] = r;
  });
  return pitches.map(function (pitch) {
    const row = byPitch[pitch];
    const qty = row ? Number(row.qty) || 0 : 0;
    const lowAt = row && row.low_at != null ? Number(row.low_at) : defaultLowAt(control);
    return {
      pitch: pitch,
      label: pitch ? ('P' + pitch) : (control ? 'Each' : 'Stock'),
      qty: qty,
      lowAt: lowAt,
      unit: control ? 'each' : 'panels',
      status: binStatus(qty, lowAt)
    };
  });
}

function summarize(bins) {
  const list = bins || [];
  const total = list.reduce(function (s, b) { return s + (Number(b.qty) || 0); }, 0);
  const statuses = list.map(function (b) { return b.status; });
  let status = 'ok';
  if (total <= 0) status = 'out';
  else if (statuses.indexOf('out') !== -1 || statuses.indexOf('low') !== -1) status = 'low';
  return {
    total: total,
    status: status,
    unit: list[0] ? list[0].unit : 'panels'
  };
}

function applyKind(kind, qtyInput, current) {
  const k = String(kind || '').toLowerCase();
  const cur = Math.max(0, Number(current) || 0);
  const n = Number(qtyInput);
  if (!isFinite(n)) throw new Error('Enter a quantity.');
  if (k === 'count') {
    if (n < 0 || Math.round(n) !== n) throw new Error('Count must be a whole number 0 or more.');
    return { next: n, delta: n - cur };
  }
  if (n <= 0 || Math.round(n) !== n) throw new Error('Quantity must be a whole number greater than 0.');
  if (k === 'receive') return { next: cur + n, delta: n };
  if (k === 'sell' || k === 'damage') {
    const next = Math.max(0, cur - n);
    return { next: next, delta: next - cur };
  }
  throw new Error('Use receive, sell, damage, or count.');
}

function inventoryItem(product, stockRows) {
  const bins = binsForProduct(product, stockRows);
  const sum = summarize(bins);
  return {
    dbId: product.dbId,
    id: product.id,
    name: product.name,
    brandId: product.brandId,
    brandName: product.brandName,
    type: product.type,
    pitches: product.pitches || [],
    control: isControlProduct(product),
    image: product.image || '',
    total: sum.total,
    status: sum.status,
    unit: sum.unit,
    bins: bins
  };
}

module.exports = {
  isControlProduct,
  pitchKey,
  defaultLowAt,
  binStatus,
  binsForProduct,
  summarize,
  applyKind,
  inventoryItem
};
