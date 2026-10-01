/**
 * Settings → Price level.
 * Stores a named adjustment. Does not change inventory sell price, dealer net, quotes, or the website.
 * Net price reads Dealer net. The item has no separate net price.
 */

const CUSTOMER_TYPES = ['Retail/Commercial', 'Residential', 'AV Integrator', 'Dealer'];
const PRODUCT_TYPES = ['LED Panel', 'Control', 'Receiving Card', 'Processor', 'Accessory', 'Service', 'Spare'];
const PRICE_TYPES = ['sell', 'dealer', 'net'];
const MODES = ['all', 'type', 'specific'];
const DIRS = ['increase', 'decrease'];
const ROUNDINGS = ['none', 'dime', 'dollar'];

function throwIf(error, fallback) {
  if (!error) return;
  throw new Error(error.message || fallback || 'Could not save the price level.');
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  return [];
}

function cleanText(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max || 120);
}

function cleanIdList(value) {
  const out = [];
  const seen = {};
  asArray(value).forEach(function (raw) {
    const n = Math.round(Number(raw));
    if (!isFinite(n) || n <= 0 || seen[n]) return;
    seen[n] = true;
    out.push(n);
  });
  return out;
}

function cleanTypes(value, allowed) {
  const allow = {};
  (allowed || []).forEach(function (name) { allow[name] = true; });
  const out = [];
  const seen = {};
  asArray(value).forEach(function (raw) {
    const name = cleanText(raw, 80);
    if (!name || seen[name]) return;
    if (allowed && !allow[name]) return;
    seen[name] = true;
    out.push(name);
  });
  return out;
}

function cleanPct(value) {
  const n = Number(value);
  if (!isFinite(n) || n < 0) return 0;
  return Math.round(Math.min(n, 1000) * 100) / 100;
}

function oneOf(value, allowed, fallback) {
  const v = String(value || '').trim().toLowerCase();
  return allowed.indexOf(v) === -1 ? fallback : v;
}

function cleanDate(value) {
  const s = cleanText(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function money(value) {
  const n = Number(value);
  if (!isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

function applyRound(value, rounding) {
  const n = Number(value);
  if (!isFinite(n) || n < 0) return 0;
  if (rounding === 'dollar') return Math.round(n);
  if (rounding === 'dime') return Math.round(n * 10) / 10;
  return Math.round(n * 100) / 100;
}

function applyPct(base, dir, pct) {
  const n = Number(base);
  if (!isFinite(n)) return 0;
  const p = cleanPct(pct);
  const factor = dir === 'increase' ? (1 + p / 100) : (1 - p / 100);
  return n * factor;
}

function normalizeInput(src) {
  const body = src || {};
  const name = cleanText(body.name, 120);
  if (!name) throw new Error('Name the price level.');
  const customerMode = oneOf(body.customerMode || body.customer_mode, MODES, 'all');
  const productMode = oneOf(body.productMode || body.product_mode, MODES, 'all');
  const brands = [];
  const seenBrand = {};
  asArray(body.brands).forEach(function (row) {
    const brandId = cleanText(row && (row.brandId || row.brand_id), 40);
    if (!brandId || seenBrand[brandId]) return;
    seenBrand[brandId] = true;
    brands.push({
      brandId: brandId,
      adjustDir: oneOf(row.adjustDir || row.adjust_dir, DIRS, 'decrease'),
      adjustPct: cleanPct(row.adjustPct != null ? row.adjustPct : row.adjust_pct)
    });
  });
  return {
    name: name,
    customerMode: customerMode,
    customerTypes: customerMode === 'type' ? cleanTypes(body.customerTypes || body.customer_types, CUSTOMER_TYPES) : [],
    customerIds: customerMode === 'specific' ? cleanIdList(body.customerIds || body.customer_ids) : [],
    productMode: productMode,
    productTypes: productMode === 'type' ? cleanTypes(body.productTypes || body.product_types, null) : [],
    itemIds: productMode === 'specific' ? cleanIdList(body.itemIds || body.item_ids) : [],
    priceType: oneOf(body.priceType || body.price_type, PRICE_TYPES, 'sell'),
    adjustDir: oneOf(body.adjustDir || body.adjust_dir, DIRS, 'decrease'),
    adjustPct: cleanPct(body.adjustPct != null ? body.adjustPct : body.adjust_pct),
    rounding: oneOf(body.rounding, ROUNDINGS, 'none'),
    startDate: cleanDate(body.startDate || body.start_date),
    endDate: cleanDate(body.endDate || body.end_date),
    brands: brands,
    overrides: cleanIdList(asArray(body.overrides).map(function (row) { return row && (row.itemId || row.item_id); })).map(function (itemId) {
      const row = asArray(body.overrides).find(function (entry) {
        return Math.round(Number(entry && (entry.itemId || entry.item_id))) === itemId;
      }) || {};
      return { itemId: itemId, adjustedPrice: money(row.adjustedPrice != null ? row.adjustedPrice : row.adjusted_price) };
    })
  };
}

function formatLevel(row, extras) {
  const extra = extras || {};
  return {
    id: row.id,
    name: row.name || '',
    customerMode: row.customer_mode || 'all',
    customerTypes: asArray(row.customer_types),
    customerIds: extra.customerIds || [],
    productMode: row.product_mode || 'all',
    productTypes: asArray(row.product_types),
    itemIds: extra.itemIds || [],
    priceType: row.price_type || 'sell',
    adjustDir: row.adjust_dir || 'decrease',
    adjustPct: Number(row.adjust_pct) || 0,
    rounding: row.rounding || 'none',
    startDate: row.start_date || '',
    endDate: row.end_date || '',
    brands: extra.brands || [],
    overrides: extra.overrides || [],
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

function basePrice(item, priceType) {
  if (!item) return 0;
  if (priceType === 'sell') return money(item.price);
  return money(item.dealerNet != null ? item.dealerNet : item.dealer_net);
}

function adjustedPrice(level, item) {
  const rule = level || {};
  const brandId = String((item && (item.brandId || item.brand_id)) || '');
  let next = applyPct(basePrice(item, rule.priceType), rule.adjustDir, rule.adjustPct);
  (rule.brands || []).forEach(function (line) {
    if (String(line.brandId) !== brandId) return;
    next = applyPct(next, line.adjustDir, line.adjustPct);
  });
  next = applyRound(next, rule.rounding);
  const itemId = item && (item.id != null ? item.id : item.itemId);
  const hit = (rule.overrides || []).find(function (row) {
    return String(row.itemId) === String(itemId);
  });
  if (hit && hit.adjustedPrice != null && hit.adjustedPrice !== '') return money(hit.adjustedPrice);
  return next;
}

function ensureSqlite(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS price_levels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT '',
      customer_mode TEXT NOT NULL DEFAULT 'all',
      customer_types TEXT NOT NULL DEFAULT '[]',
      product_mode TEXT NOT NULL DEFAULT 'all',
      product_types TEXT NOT NULL DEFAULT '[]',
      price_type TEXT NOT NULL DEFAULT 'sell',
      adjust_dir TEXT NOT NULL DEFAULT 'decrease',
      adjust_pct REAL NOT NULL DEFAULT 0,
      rounding TEXT NOT NULL DEFAULT 'none',
      start_date TEXT NOT NULL DEFAULT '',
      end_date TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS price_level_customers (
      level_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      PRIMARY KEY (level_id, customer_id)
    );
    CREATE TABLE IF NOT EXISTS price_level_items (
      level_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      PRIMARY KEY (level_id, item_id)
    );
    CREATE TABLE IF NOT EXISTS price_level_brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level_id INTEGER NOT NULL,
      brand_id TEXT NOT NULL DEFAULT '',
      adjust_dir TEXT NOT NULL DEFAULT 'decrease',
      adjust_pct REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS price_level_overrides (
      level_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      adjusted_price REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (level_id, item_id)
    );
  `);
}

function childMapsSqlite(db) {
  const customers = {};
  const items = {};
  const brands = {};
  const overrides = {};
  db.prepare('SELECT level_id, customer_id FROM price_level_customers').all().forEach(function (row) {
    const key = String(row.level_id);
    if (!customers[key]) customers[key] = [];
    customers[key].push(row.customer_id);
  });
  db.prepare('SELECT level_id, item_id FROM price_level_items').all().forEach(function (row) {
    const key = String(row.level_id);
    if (!items[key]) items[key] = [];
    items[key].push(row.item_id);
  });
  db.prepare('SELECT level_id, brand_id, adjust_dir, adjust_pct FROM price_level_brands ORDER BY id').all().forEach(function (row) {
    const key = String(row.level_id);
    if (!brands[key]) brands[key] = [];
    brands[key].push({ brandId: row.brand_id, adjustDir: row.adjust_dir, adjustPct: Number(row.adjust_pct) || 0 });
  });
  db.prepare('SELECT level_id, item_id, adjusted_price FROM price_level_overrides').all().forEach(function (row) {
    const key = String(row.level_id);
    if (!overrides[key]) overrides[key] = [];
    overrides[key].push({ itemId: row.item_id, adjustedPrice: Number(row.adjusted_price) || 0 });
  });
  return { customers: customers, items: items, brands: brands, overrides: overrides };
}

function extrasFor(maps, id) {
  const key = String(id);
  return {
    customerIds: maps.customers[key] || [],
    itemIds: maps.items[key] || [],
    brands: maps.brands[key] || [],
    overrides: maps.overrides[key] || []
  };
}

function listSqlite(db) {
  ensureSqlite(db);
  const maps = childMapsSqlite(db);
  return db.prepare('SELECT * FROM price_levels ORDER BY name COLLATE NOCASE, id').all().map(function (row) {
    return formatLevel(row, extrasFor(maps, row.id));
  });
}

function getSqlite(db, id) {
  ensureSqlite(db);
  const row = db.prepare('SELECT * FROM price_levels WHERE id = ?').get(Number(id));
  if (!row) return null;
  return formatLevel(row, extrasFor(childMapsSqlite(db), row.id));
}

function writeChildrenSqlite(db, id, input) {
  db.prepare('DELETE FROM price_level_customers WHERE level_id = ?').run(id);
  db.prepare('DELETE FROM price_level_items WHERE level_id = ?').run(id);
  db.prepare('DELETE FROM price_level_brands WHERE level_id = ?').run(id);
  db.prepare('DELETE FROM price_level_overrides WHERE level_id = ?').run(id);
  const addCustomer = db.prepare('INSERT INTO price_level_customers (level_id, customer_id) VALUES (?, ?)');
  const addItem = db.prepare('INSERT INTO price_level_items (level_id, item_id) VALUES (?, ?)');
  const addBrand = db.prepare('INSERT INTO price_level_brands (level_id, brand_id, adjust_dir, adjust_pct) VALUES (?, ?, ?, ?)');
  const addOverride = db.prepare('INSERT INTO price_level_overrides (level_id, item_id, adjusted_price) VALUES (?, ?, ?)');
  input.customerIds.forEach(function (customerId) { addCustomer.run(id, customerId); });
  input.itemIds.forEach(function (itemId) { addItem.run(id, itemId); });
  input.brands.forEach(function (line) { addBrand.run(id, line.brandId, line.adjustDir, line.adjustPct); });
  input.overrides.forEach(function (line) { addOverride.run(id, line.itemId, line.adjustedPrice); });
}

function saveSqlite(db, id, src) {
  ensureSqlite(db);
  const input = normalizeInput(src);
  const stamp = require('./db').nowIso();
  const existingId = Number(id);
  db.exec('BEGIN');
  try {
    let levelId = existingId;
    if (levelId > 0) {
      const info = db.prepare(`
        UPDATE price_levels SET
          name = ?, customer_mode = ?, customer_types = ?, product_mode = ?, product_types = ?,
          price_type = ?, adjust_dir = ?, adjust_pct = ?, rounding = ?, start_date = ?, end_date = ?, updated_at = ?
        WHERE id = ?
      `).run(
        input.name, input.customerMode, JSON.stringify(input.customerTypes),
        input.productMode, JSON.stringify(input.productTypes),
        input.priceType, input.adjustDir, input.adjustPct, input.rounding,
        input.startDate, input.endDate, stamp, levelId
      );
      if (!info.changes) throw new Error('Price level not found.');
    } else {
      const info = db.prepare(`
        INSERT INTO price_levels (
          name, customer_mode, customer_types, product_mode, product_types,
          price_type, adjust_dir, adjust_pct, rounding, start_date, end_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        input.name, input.customerMode, JSON.stringify(input.customerTypes),
        input.productMode, JSON.stringify(input.productTypes),
        input.priceType, input.adjustDir, input.adjustPct, input.rounding,
        input.startDate, input.endDate, stamp, stamp
      );
      levelId = info.lastInsertRowid;
    }
    writeChildrenSqlite(db, levelId, input);
    db.exec('COMMIT');
    return getSqlite(db, levelId);
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (e) { /* already closed */ }
    throw err;
  }
}

function deleteSqlite(db, id) {
  ensureSqlite(db);
  const levelId = Number(id);
  db.prepare('DELETE FROM price_level_customers WHERE level_id = ?').run(levelId);
  db.prepare('DELETE FROM price_level_items WHERE level_id = ?').run(levelId);
  db.prepare('DELETE FROM price_level_brands WHERE level_id = ?').run(levelId);
  db.prepare('DELETE FROM price_level_overrides WHERE level_id = ?').run(levelId);
  const info = db.prepare('DELETE FROM price_levels WHERE id = ?').run(levelId);
  return info.changes > 0;
}

async function loadChildrenSupabase(supabase) {
  const customers = await supabase.from('price_level_customers').select('level_id, customer_id');
  throwIf(customers.error, 'Could not read price level customers.');
  const items = await supabase.from('price_level_items').select('level_id, item_id');
  throwIf(items.error, 'Could not read price level products.');
  const brands = await supabase.from('price_level_brands').select('level_id, brand_id, adjust_dir, adjust_pct, id').order('id');
  throwIf(brands.error, 'Could not read brand adjustments.');
  const overrides = await supabase.from('price_level_overrides').select('level_id, item_id, adjusted_price');
  throwIf(overrides.error, 'Could not read adjusted prices.');
  const maps = { customers: {}, items: {}, brands: {}, overrides: {} };
  (customers.data || []).forEach(function (row) {
    const key = String(row.level_id);
    if (!maps.customers[key]) maps.customers[key] = [];
    maps.customers[key].push(row.customer_id);
  });
  (items.data || []).forEach(function (row) {
    const key = String(row.level_id);
    if (!maps.items[key]) maps.items[key] = [];
    maps.items[key].push(row.item_id);
  });
  (brands.data || []).forEach(function (row) {
    const key = String(row.level_id);
    if (!maps.brands[key]) maps.brands[key] = [];
    maps.brands[key].push({ brandId: row.brand_id, adjustDir: row.adjust_dir, adjustPct: Number(row.adjust_pct) || 0 });
  });
  (overrides.data || []).forEach(function (row) {
    const key = String(row.level_id);
    if (!maps.overrides[key]) maps.overrides[key] = [];
    maps.overrides[key].push({ itemId: row.item_id, adjustedPrice: Number(row.adjusted_price) || 0 });
  });
  return maps;
}

async function listSupabase(supabase) {
  const { data, error } = await supabase.from('price_levels').select('*').order('name');
  throwIf(error, 'Could not read price levels.');
  const maps = await loadChildrenSupabase(supabase);
  return (data || []).map(function (row) { return formatLevel(row, extrasFor(maps, row.id)); });
}

async function getSupabase(supabase, id) {
  const { data, error } = await supabase.from('price_levels').select('*').eq('id', Number(id)).maybeSingle();
  throwIf(error, 'Could not read the price level.');
  if (!data) return null;
  const maps = await loadChildrenSupabase(supabase);
  return formatLevel(data, extrasFor(maps, data.id));
}

async function writeChildrenSupabase(supabase, id, input) {
  const levelId = Number(id);
  let res = await supabase.from('price_level_customers').delete().eq('level_id', levelId);
  throwIf(res.error, 'Could not update customers.');
  res = await supabase.from('price_level_items').delete().eq('level_id', levelId);
  throwIf(res.error, 'Could not update products.');
  res = await supabase.from('price_level_brands').delete().eq('level_id', levelId);
  throwIf(res.error, 'Could not update brand adjustments.');
  res = await supabase.from('price_level_overrides').delete().eq('level_id', levelId);
  throwIf(res.error, 'Could not update adjusted prices.');
  if (input.customerIds.length) {
    res = await supabase.from('price_level_customers').insert(input.customerIds.map(function (customerId) {
      return { level_id: levelId, customer_id: customerId };
    }));
    throwIf(res.error, 'Could not save customers.');
  }
  if (input.itemIds.length) {
    res = await supabase.from('price_level_items').insert(input.itemIds.map(function (itemId) {
      return { level_id: levelId, item_id: itemId };
    }));
    throwIf(res.error, 'Could not save products.');
  }
  if (input.brands.length) {
    res = await supabase.from('price_level_brands').insert(input.brands.map(function (line) {
      return { level_id: levelId, brand_id: line.brandId, adjust_dir: line.adjustDir, adjust_pct: line.adjustPct };
    }));
    throwIf(res.error, 'Could not save brand adjustments.');
  }
  if (input.overrides.length) {
    res = await supabase.from('price_level_overrides').insert(input.overrides.map(function (line) {
      return { level_id: levelId, item_id: line.itemId, adjusted_price: line.adjustedPrice };
    }));
    throwIf(res.error, 'Could not save adjusted prices.');
  }
}

function rowFromInput(input, stamp, isNew) {
  const row = {
    name: input.name,
    customer_mode: input.customerMode,
    customer_types: input.customerTypes,
    product_mode: input.productMode,
    product_types: input.productTypes,
    price_type: input.priceType,
    adjust_dir: input.adjustDir,
    adjust_pct: input.adjustPct,
    rounding: input.rounding,
    start_date: input.startDate,
    end_date: input.endDate,
    updated_at: stamp
  };
  if (isNew) row.created_at = stamp;
  return row;
}

async function saveSupabase(supabase, id, src) {
  const input = normalizeInput(src);
  const stamp = new Date().toISOString();
  const existingId = Number(id);
  let levelId = existingId;
  if (levelId > 0) {
    const { data, error } = await supabase.from('price_levels').update(rowFromInput(input, stamp, false)).eq('id', levelId).select('id').maybeSingle();
    throwIf(error, 'Could not save the price level.');
    if (!data) throw new Error('Price level not found.');
  } else {
    const { data, error } = await supabase.from('price_levels').insert(rowFromInput(input, stamp, true)).select('id').single();
    throwIf(error, 'Could not create the price level.');
    levelId = data.id;
  }
  await writeChildrenSupabase(supabase, levelId, input);
  return getSupabase(supabase, levelId);
}

async function deleteSupabase(supabase, id) {
  const levelId = Number(id);
  await writeChildrenSupabase(supabase, levelId, { customerIds: [], itemIds: [], brands: [], overrides: [] });
  const { error } = await supabase.from('price_levels').delete().eq('id', levelId);
  throwIf(error, 'Could not delete the price level.');
  return true;
}

module.exports = {
  CUSTOMER_TYPES,
  PRODUCT_TYPES,
  ensureSqlite,
  normalizeInput,
  adjustedPrice,
  basePrice,
  listSqlite,
  getSqlite,
  saveSqlite,
  deleteSqlite,
  listSupabase,
  getSupabase,
  saveSupabase,
  deleteSupabase
};
