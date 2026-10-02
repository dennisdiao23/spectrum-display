/**
 * Settings → Brands price rules.
 * Sell price is cost increased by a percent.
 * Dealer and Integrator are cost increased by a percent, or sell price decreased by a percent.
 * Retail/Commercial and Residential use Sell price. Dealer and AV Integrator use their own price.
 * A customer can store a different percent per brand. Inventory prices change only when someone confirms it.
 */

const PRODUCT_TYPES = ['LED Panel', 'Control', 'Receiving Card', 'Processor', 'Accessory', 'Service', 'Spare'];
const PRICE_KEYS = ['sell', 'dealer', 'integrator'];

function throwIf(error, fallback) {
  if (!error) return;
  throw new Error(error.message || fallback || 'Could not save brand prices.');
}

function cleanText(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max || 80);
}

function cleanPct(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!isFinite(n) || n < 0) return 0;
  return Math.round(Math.min(n, 1000) * 100) / 100;
}

function money(value) {
  const n = Number(value);
  if (!isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

function applyPct(base, dir, pct) {
  const n = Number(base);
  if (!isFinite(n)) return 0;
  const p = cleanPct(pct) || 0;
  const factor = dir === 'decrease' ? (1 - p / 100) : (1 + p / 100);
  return money(Math.max(0, n * factor));
}

function priceKeyForType(customerType) {
  const t = String(customerType || '').trim().toLowerCase();
  if (t === 'dealer') return 'dealer';
  if (t === 'av integrator' || t === 'integrator') return 'integrator';
  return 'sell';
}

function priceLabel(key) {
  if (key === 'dealer') return 'Dealer price';
  if (key === 'integrator') return 'Integrator price';
  return 'Sell price';
}

function lockedBasis(priceKey, basis) {
  if (priceKey === 'sell') return { basis: 'cost', adjustDir: 'increase' };
  if (String(basis || '').toLowerCase() === 'sell') return { basis: 'sell', adjustDir: 'decrease' };
  return { basis: 'cost', adjustDir: 'increase' };
}

function defaultRule(priceKey, productType) {
  const lock = lockedBasis(priceKey, priceKey === 'sell' ? 'cost' : 'sell');
  return {
    productType: productType || '',
    priceKey: priceKey,
    basis: lock.basis,
    adjustDir: lock.adjustDir,
    adjustPct: 0
  };
}

function normalizeRules(rows) {
  const out = [];
  const seen = {};
  (Array.isArray(rows) ? rows : []).forEach(function (row) {
    const priceKey = PRICE_KEYS.indexOf(String(row && (row.priceKey || row.price_key) || '').toLowerCase()) === -1
      ? ''
      : String(row.priceKey || row.price_key).toLowerCase();
    if (!priceKey) return;
    const productType = cleanText(row.productType != null ? row.productType : row.product_type, 80);
    const key = productType.toLowerCase() + '\n' + priceKey;
    if (seen[key]) return;
    seen[key] = true;
    const lock = lockedBasis(priceKey, row.basis);
    const pct = cleanPct(row.adjustPct != null ? row.adjustPct : row.adjust_pct);
    out.push({
      productType: productType,
      priceKey: priceKey,
      basis: lock.basis,
      adjustDir: lock.adjustDir,
      adjustPct: pct == null ? 0 : pct
    });
  });
  return out;
}

function normalizeOverrides(rows) {
  const out = [];
  const seen = {};
  (Array.isArray(rows) ? rows : []).forEach(function (row) {
    const brandId = cleanText(row && (row.brandId || row.brand_id), 40);
    if (!brandId || seen[brandId]) return;
    const pct = cleanPct(row.adjustPct != null ? row.adjustPct : row.adjust_pct);
    if (pct == null) return;
    seen[brandId] = true;
    out.push({ brandId: brandId, adjustPct: pct });
  });
  return out;
}

function ruleFor(rules, brandId, productType, priceKey) {
  const type = cleanText(productType, 80);
  const list = (rules || []).filter(function (row) {
    return String(row.brandId || '') === String(brandId || '') && row.priceKey === priceKey;
  });
  const specific = type ? list.find(function (row) { return row.productType === type; }) : null;
  return specific || list.find(function (row) { return !row.productType; }) || null;
}

function brandHasRules(rules, brandId) {
  return (rules || []).some(function (row) { return String(row.brandId) === String(brandId); });
}

function sameMoney(a, b) {
  return Math.round(money(a) * 100) === Math.round(money(b) * 100);
}

function priceChanges(items, rules, brandId, brandName) {
  const id = cleanText(brandId, 40);
  const stamped = normalizeRules(rules).map(function (rule) {
    return Object.assign({ brandId: id }, rule);
  });
  const changes = [];
  let skippedNoCost = 0;
  (items || []).forEach(function (item) {
    if (!item || String(item.brandId || item.brand_id || '') !== id) return;
    const cost = money(item.cost);
    if (!(cost > 0)) {
      skippedNoCost += 1;
      return;
    }
    const next = pricesFromCost(stamped, id, item.category || '', cost);
    const sellOld = money(item.price);
    const dealerOld = money(item.dealerNet != null ? item.dealerNet : item.dealer_net);
    const integratorOld = money(item.integratorPrice != null ? item.integratorPrice : item.integrator_price);
    if (sameMoney(sellOld, next.sell) && sameMoney(dealerOld, next.dealer) && sameMoney(integratorOld, next.integrator)) return;
    changes.push({
      id: item.id,
      name: item.name || '',
      sku: item.sku || '',
      brand: brandName || id,
      cost: cost,
      sellOld: sellOld,
      sellNew: next.sell,
      dealerOld: dealerOld,
      dealerNew: next.dealer,
      integratorOld: integratorOld,
      integratorNew: next.integrator
    });
  });
  changes.sort(function (a, b) {
    return String(a.sku).localeCompare(String(b.sku)) || String(a.name).localeCompare(String(b.name));
  });
  return { changes: changes, skippedNoCost: skippedNoCost };
}

function pricesFromCost(rules, brandId, productType, cost, pctByKey) {
  const overrides = pctByKey || {};
  const sellRule = ruleFor(rules, brandId, productType, 'sell') || defaultRule('sell', '');
  const sellPct = overrides.sell != null ? overrides.sell : sellRule.adjustPct;
  const sell = applyPct(cost, 'increase', sellPct);
  function side(key) {
    const rule = ruleFor(rules, brandId, productType, key) || defaultRule(key, '');
    const pct = overrides[key] != null ? overrides[key] : rule.adjustPct;
    if (rule.basis === 'sell') return applyPct(sell, 'decrease', pct);
    return applyPct(cost, 'increase', pct);
  }
  return { sell: sell, dealer: side('dealer'), integrator: side('integrator') };
}

function describeRule(rule) {
  if (!rule) return 'Not set';
  const pct = Number(rule.adjustPct) || 0;
  if (rule.priceKey === 'sell' || rule.basis === 'cost') return 'Cost, increase ' + pct + '%';
  return 'Sell price, decrease ' + pct + '%';
}

function customerPriceNote(customerType) {
  const key = priceKeyForType(customerType);
  if (key === 'dealer') return 'This customer uses Dealer price.';
  if (key === 'integrator') return 'This customer uses Integrator price.';
  return 'This customer uses Sell price. Retail and Residential use Sell price.';
}

function unitPriceForCustomer(item, customer, rules) {
  if (!item) return 0;
  if (!customer) return money(item.price);
  const key = priceKeyForType(customer.customerType);
  const brandId = item.brandId || item.brand_id || '';
  const hit = (customer.priceOverrides || []).find(function (row) {
    return String(row.brandId) === String(brandId);
  });
  if (hit && brandHasRules(rules, brandId)) {
    const pctByKey = {};
    pctByKey[key] = hit.adjustPct;
    return pricesFromCost(rules, brandId, item.category || '', item.cost, pctByKey)[key];
  }
  if (key === 'dealer') return money(item.dealerNet != null ? item.dealerNet : item.dealer_net);
  if (key === 'integrator') {
    const n = item.integratorPrice != null ? item.integratorPrice : item.integrator_price;
    if (n != null && n !== '') return money(n);
  }
  return money(item.price);
}

function formatRule(row) {
  return {
    brandId: row.brand_id || row.brandId || '',
    productType: row.product_type || row.productType || '',
    priceKey: row.price_key || row.priceKey || 'sell',
    basis: row.basis || 'cost',
    adjustDir: row.adjust_dir || row.adjustDir || 'increase',
    adjustPct: Number(row.adjust_pct != null ? row.adjust_pct : row.adjustPct) || 0
  };
}

function formatOverride(row) {
  return {
    customerId: row.customer_id || row.customerId,
    brandId: row.brand_id || row.brandId || '',
    adjustPct: Number(row.adjust_pct != null ? row.adjust_pct : row.adjustPct) || 0
  };
}

function attachOverrides(customers, overrides) {
  const by = {};
  (overrides || []).forEach(function (row) {
    const id = String(row.customerId);
    if (!by[id]) by[id] = [];
    by[id].push({ brandId: row.brandId, adjustPct: row.adjustPct });
  });
  (customers || []).forEach(function (customer) {
    if (!customer) return;
    customer.priceOverrides = by[String(customer.id)] || [];
  });
  return customers;
}

function ensureSqlite(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS brand_price_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_id TEXT NOT NULL,
      product_type TEXT NOT NULL DEFAULT '',
      price_key TEXT NOT NULL,
      basis TEXT NOT NULL DEFAULT 'cost',
      adjust_dir TEXT NOT NULL DEFAULT 'increase',
      adjust_pct REAL NOT NULL DEFAULT 0,
      UNIQUE (brand_id, product_type, price_key)
    );
    CREATE TABLE IF NOT EXISTS customer_brand_price_overrides (
      customer_id INTEGER NOT NULL,
      brand_id TEXT NOT NULL,
      adjust_pct REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (customer_id, brand_id)
    );
  `);
  try { db.exec('ALTER TABLE inventory_items ADD COLUMN integrator_price REAL NOT NULL DEFAULT 0'); } catch (e) { /* already present */ }
}

function listSqlite(db) {
  return db.prepare('SELECT * FROM brand_price_rules ORDER BY brand_id, product_type, price_key').all().map(formatRule);
}

function saveSqlite(db, brandId, rows) {
  const id = cleanText(brandId, 40);
  if (!id) throw new Error('Brand is required.');
  const rules = normalizeRules(rows);
  const del = db.prepare('DELETE FROM brand_price_rules WHERE brand_id = ?');
  const add = db.prepare(`
    INSERT INTO brand_price_rules (brand_id, product_type, price_key, basis, adjust_dir, adjust_pct)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  db.exec('BEGIN');
  try {
    del.run(id);
    rules.forEach(function (rule) {
      add.run(id, rule.productType, rule.priceKey, rule.basis, rule.adjustDir, rule.adjustPct);
    });
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return listSqlite(db).filter(function (rule) { return rule.brandId === id; });
}

function listOverridesSqlite(db) {
  return db.prepare('SELECT * FROM customer_brand_price_overrides').all().map(formatOverride);
}

function saveOverridesSqlite(db, customerId, rows) {
  const id = Math.round(Number(customerId));
  if (!id) return [];
  const overrides = normalizeOverrides(rows);
  db.prepare('DELETE FROM customer_brand_price_overrides WHERE customer_id = ?').run(id);
  const add = db.prepare('INSERT INTO customer_brand_price_overrides (customer_id, brand_id, adjust_pct) VALUES (?, ?, ?)');
  overrides.forEach(function (row) { add.run(id, row.brandId, row.adjustPct); });
  return overrides;
}

async function listSupabase(supabase) {
  const { data, error } = await supabase.from('brand_price_rules').select('*').order('brand_id');
  throwIf(error, 'Could not load brand prices.');
  return (data || []).map(formatRule);
}

async function saveSupabase(supabase, brandId, rows) {
  const id = cleanText(brandId, 40);
  if (!id) throw new Error('Brand is required.');
  const rules = normalizeRules(rows);
  let res = await supabase.from('brand_price_rules').delete().eq('brand_id', id);
  throwIf(res.error, 'Could not save brand prices.');
  if (rules.length) {
    res = await supabase.from('brand_price_rules').insert(rules.map(function (rule) {
      return {
        brand_id: id,
        product_type: rule.productType,
        price_key: rule.priceKey,
        basis: rule.basis,
        adjust_dir: rule.adjustDir,
        adjust_pct: rule.adjustPct
      };
    }));
    throwIf(res.error, 'Could not save brand prices.');
  }
  const all = await listSupabase(supabase);
  return all.filter(function (rule) { return rule.brandId === id; });
}

async function listOverridesSupabase(supabase) {
  const { data, error } = await supabase.from('customer_brand_price_overrides').select('*');
  throwIf(error, 'Could not load customer price percents.');
  return (data || []).map(formatOverride);
}

async function saveOverridesSupabase(supabase, customerId, rows) {
  const id = Math.round(Number(customerId));
  if (!id) return [];
  const overrides = normalizeOverrides(rows);
  let res = await supabase.from('customer_brand_price_overrides').delete().eq('customer_id', id);
  throwIf(res.error, 'Could not save the customer percent.');
  if (overrides.length) {
    res = await supabase.from('customer_brand_price_overrides').insert(overrides.map(function (row) {
      return { customer_id: id, brand_id: row.brandId, adjust_pct: row.adjustPct };
    }));
    throwIf(res.error, 'Could not save the customer percent.');
  }
  return overrides;
}

module.exports = {
  PRODUCT_TYPES: PRODUCT_TYPES,
  PRICE_KEYS: PRICE_KEYS,
  priceKeyForType: priceKeyForType,
  priceLabel: priceLabel,
  defaultRule: defaultRule,
  normalizeRules: normalizeRules,
  normalizeOverrides: normalizeOverrides,
  ruleFor: ruleFor,
  brandHasRules: brandHasRules,
  priceChanges: priceChanges,
  pricesFromCost: pricesFromCost,
  describeRule: describeRule,
  customerPriceNote: customerPriceNote,
  unitPriceForCustomer: unitPriceForCustomer,
  attachOverrides: attachOverrides,
  ensureSqlite: ensureSqlite,
  listSqlite: listSqlite,
  saveSqlite: saveSqlite,
  listOverridesSqlite: listOverridesSqlite,
  saveOverridesSqlite: saveOverridesSqlite,
  listSupabase: listSupabase,
  saveSupabase: saveSupabase,
  listOverridesSupabase: listOverridesSupabase,
  saveOverridesSupabase: saveOverridesSupabase
};
