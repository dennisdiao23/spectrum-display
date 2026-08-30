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

function unitOf(value) {
  return String(value || '').toLowerCase() === 'each' ? 'each' : 'panels';
}

function defaultLowAt(unit) {
  return unitOf(unit) === 'each' ? 2 : 8;
}

function binStatus(qty, lowAt) {
  const q = Math.max(0, Number(qty) || 0);
  const low = Math.max(0, Number(lowAt) || 0);
  if (q <= 0) return 'out';
  if (q <= low) return 'low';
  return 'ok';
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

function skuNameFromProduct(product, pitch) {
  const name = String((product && product.name) || 'Item').trim() || 'Item';
  const p = pitchKey(pitch);
  return p ? (name + ' P' + p) : name;
}

function skuToken(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28);
}

function normalizeSku(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9._-]/g, '')
    .slice(0, 64);
}

function suggestedSku(parts) {
  const brand = skuToken(parts && parts.brandId).slice(0, 10) || 'INV';
  const series = skuToken((parts && (parts.seriesId || parts.name)) || '') || 'ITEM';
  const p = pitchKey(parts && parts.pitch);
  return p ? (brand + '-' + series + '-P' + p) : (brand + '-' + series);
}

function uniqueSku(base, taken) {
  const used = taken || {};
  let sku = normalizeSku(base) || 'INV-ITEM';
  if (!used[sku]) return sku;
  let n = 2;
  while (used[sku + '-' + n]) n += 1;
  return sku + '-' + n;
}

function slotsForProduct(product) {
  if (isControlProduct(product)) return [''];
  const pitches = (product.pitches || []).map(pitchKey).filter(function (p, i, a) {
    return p && a.indexOf(p) === i;
  });
  return pitches.length ? pitches : [''];
}

function catalogSkuPlan(products, existingMaps, existingSkus) {
  const haveMap = {};
  (existingMaps || []).forEach(function (m) {
    haveMap[String(m.product_id) + '|' + pitchKey(m.pitch)] = true;
  });
  const taken = {};
  (existingSkus || []).forEach(function (sku) {
    const key = normalizeSku(sku);
    if (key) taken[key] = true;
  });
  const create = [];
  (products || []).forEach(function (product) {
    slotsForProduct(product).forEach(function (pitch) {
      if (haveMap[String(product.dbId) + '|' + pitch]) return;
      const sku = uniqueSku(suggestedSku({
        brandId: product.brandId,
        seriesId: product.id,
        name: product.name,
        pitch: pitch
      }), taken);
      taken[sku] = true;
      const control = isControlProduct(product);
      const unit = control || !pitch ? 'each' : 'panels';
      create.push({
        productId: product.dbId,
        name: skuNameFromProduct(product, pitch),
        brandId: product.brandId || '',
        pitch: pitch,
        unit: unit,
        sku: sku,
        price: priceFromProduct(product),
        lowAt: defaultLowAt(unit)
      });
    });
  });
  return create;
}

function priceFromProduct(product) {
  if (!product) return 0;
  if (isControlProduct(product)) return Number(product.priceEach || product.pricePerM2) || 0;
  return Number(product.pricePerM2) || 0;
}

function normalizeItemInput(body, opts) {
  const patch = !!(opts && opts.patch);
  const src = body || {};
  const out = {};
  if (!patch || src.name != null) {
    const name = String(src.name || '').trim();
    if (!name) throw new Error('Name is required.');
    out.name = name.slice(0, 160);
  }
  if (!patch || src.sku != null) {
    out.sku = normalizeSku(src.sku);
  }
  if (!patch || src.brandId != null || src.brand_id != null) {
    out.brandId = String(src.brandId != null ? src.brandId : (src.brand_id || '')).trim().slice(0, 80);
  }
  if (!patch || src.unit != null) {
    out.unit = unitOf(src.unit);
  }
  if (!patch || src.pitch != null) {
    out.pitch = pitchKey(src.pitch);
  }
  if (!patch || src.qty != null) {
    if (src.qty == null || src.qty === '') {
      if (!patch) out.qty = 0;
    } else {
      const qty = Math.round(Number(src.qty));
      if (!isFinite(qty) || qty < 0) throw new Error('Quantity must be 0 or more.');
      out.qty = qty;
    }
  }
  if (!patch || src.lowAt != null || src.low_at != null) {
    const raw = src.lowAt != null ? src.lowAt : src.low_at;
    if (raw == null || raw === '') {
      if (!patch) out.lowAt = defaultLowAt(out.unit || src.unit);
    } else {
      const low = Math.round(Number(raw));
      if (!isFinite(low) || low < 0) throw new Error('Low-at must be 0 or more.');
      out.lowAt = low;
    }
  }
  if (!patch || src.price != null) {
    const price = src.price == null || src.price === '' ? 0 : Number(src.price);
    if (!isFinite(price) || price < 0) throw new Error('Price must be 0 or more.');
    out.price = price;
  }
  if (!patch || src.notes != null) {
    out.notes = String(src.notes || '').trim().slice(0, 500);
  }
  if (!patch && out.lowAt == null) out.lowAt = defaultLowAt(out.unit);
  if (!patch && out.qty == null) out.qty = 0;
  if (!patch && out.price == null) out.price = 0;
  if (!patch && out.notes == null) out.notes = '';
  if (!patch && out.brandId == null) out.brandId = '';
  if (!patch && out.pitch == null) out.pitch = '';
  if (!patch && out.unit == null) out.unit = 'panels';
  if (!patch && !out.sku) {
    out.sku = suggestedSku({
      brandId: out.brandId,
      seriesId: src.seriesId || src.series_id,
      name: out.name,
      pitch: out.pitch
    });
  }
  return out;
}

function formatItem(row, brandName, maps) {
  const unit = unitOf(row && row.unit);
  const qty = Math.max(0, Number(row && row.qty) || 0);
  const lowAt = row && row.low_at != null ? Number(row.low_at) : defaultLowAt(unit);
  const pitch = pitchKey(row && row.pitch);
  return {
    id: row && row.id,
    sku: (row && row.sku) || '',
    name: (row && row.name) || '',
    brandId: (row && row.brand_id) || '',
    brandName: brandName || (row && row.brand_id) || '',
    pitch: pitch,
    pitchLabel: pitch ? ('P' + pitch) : (unit === 'each' ? 'Each' : '—'),
    unit: unit,
    qty: qty,
    lowAt: lowAt,
    price: Number(row && row.price) || 0,
    notes: (row && row.notes) || '',
    status: binStatus(qty, lowAt),
    updatedAt: row && row.updated_at,
    maps: maps || []
  };
}

function publicLink(item) {
  if (!item) return null;
  const unit = unitOf(item.unit);
  return {
    price: Number(item.price) || 0,
    unit: unit
  };
}

function stockLink(item) {
  if (!item) return null;
  const unit = unitOf(item.unit);
  const qty = Math.max(0, Number(item.qty) || 0);
  const lowAt = item.low_at != null ? Number(item.low_at) : (item.lowAt != null ? Number(item.lowAt) : defaultLowAt(unit));
  return {
    qty: qty,
    status: binStatus(qty, lowAt),
    unit: unit
  };
}

function cheapestMappedPrice(pitchInventory) {
  const map = pitchInventory || {};
  let min = 0;
  Object.keys(map).forEach(function (key) {
    const n = Number(map[key] && map[key].price) || 0;
    if (n > 0 && (!min || n < min)) min = n;
  });
  return min;
}

function applyToCatalog(catalog, maps, items) {
  const byId = {};
  (items || []).forEach(function (it) {
    byId[String(it.id)] = it;
  });
  Object.keys(catalog || {}).forEach(function (brandId) {
    ((catalog[brandId] && catalog[brandId].series) || []).forEach(function (series) {
      const inv = {};
      (maps || []).forEach(function (m) {
        if (String(m.product_id) !== String(series.dbId)) return;
        const item = byId[String(m.item_id)];
        if (!item) return;
        inv[pitchKey(m.pitch)] = publicLink(item);
      });
      series.pitchInventory = inv;
      const mapped = cheapestMappedPrice(inv);
      if (mapped > 0) {
        if (series.type === 'control') series.priceEach = mapped;
        series.priceLabel = 'From $' + mapped.toLocaleString();
      }
    });
  });
  return catalog;
}

function catalogStock(maps, items) {
  const byId = {};
  (items || []).forEach(function (it) {
    byId[String(it.id)] = it;
  });
  const out = {};
  (maps || []).forEach(function (m) {
    const item = byId[String(m.item_id)];
    const link = stockLink(item);
    if (!link) return;
    const pid = String(m.product_id);
    if (!out[pid]) out[pid] = {};
    out[pid][pitchKey(m.pitch)] = link;
  });
  return out;
}

function mapsByProduct(maps) {
  const out = {};
  (maps || []).forEach(function (m) {
    const key = String(m.product_id);
    (out[key] = out[key] || []).push({
      pitch: pitchKey(m.pitch),
      itemId: m.item_id
    });
  });
  return out;
}

function mapsByItem(maps) {
  const out = {};
  (maps || []).forEach(function (m) {
    const key = String(m.item_id);
    (out[key] = out[key] || []).push({
      productId: m.product_id,
      productName: m.product_name || '',
      seriesId: m.series_id || '',
      brandId: m.brand_id || '',
      pitch: pitchKey(m.pitch)
    });
  });
  return out;
}

function attachMapsToProducts(products, maps) {
  const byProduct = mapsByProduct(maps);
  (products || []).forEach(function (p) {
    p.inventoryMaps = byProduct[String(p.dbId)] || [];
  });
  return products;
}

function normalizeMaps(list) {
  const seen = {};
  const out = [];
  (list || []).forEach(function (row) {
    const pitch = pitchKey(row && (row.pitch != null ? row.pitch : row.pitchKey));
    const itemId = row && (row.itemId != null ? row.itemId : row.item_id);
    if (seen[pitch]) return;
    seen[pitch] = true;
    if (itemId == null || itemId === '') return;
    const id = Number(itemId);
    if (!isFinite(id) || id <= 0) throw new Error('Pick a valid inventory item.');
    out.push({ pitch: pitch, itemId: id });
  });
  return out;
}

module.exports = {
  isControlProduct,
  pitchKey,
  unitOf,
  defaultLowAt,
  binStatus,
  applyKind,
  skuNameFromProduct,
  skuToken,
  normalizeSku,
  suggestedSku,
  uniqueSku,
  slotsForProduct,
  catalogSkuPlan,
  priceFromProduct,
  normalizeItemInput,
  formatItem,
  publicLink,
  stockLink,
  cheapestMappedPrice,
  applyToCatalog,
  catalogStock,
  mapsByProduct,
  mapsByItem,
  attachMapsToProducts,
  normalizeMaps
};
