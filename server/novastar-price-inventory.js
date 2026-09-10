/**
 * Apply NovaStar MAP + vendor-warehouse Available onto inventory, website, and store.
 *
 * MAP → inventory sell price and website/store MSRP (priceEach).
 * Available → qty at the untracked "NovaStar Warehouse" only (not Azusa).
 * Warehouse-only SKUs with no MAP are not in the JSON and are not imported.
 */

const fs = require('fs');
const path = require('path');

const PACK_PATH = path.join(__dirname, 'novastar-price-inventory.json');
const VENDOR_NAME = 'NovaStar';
const WAREHOUSE_NAME = 'NovaStar Warehouse';
const SOURCE_NOTE = 'NovaStar price list 2026-09-08 · warehouse 2026-08-31';

const MODEL_ALIASES = {
  'mx6000 pro chassis': 'mx6000-pro',
  'mx2000 pro chassis': 'mx2000-pro',
  'h2 master': 'h2',
  'h5 master': 'h5',
  'h9 master': 'h9',
  'h15 master': 'h15',
  'h20 master': 'h20',
  'cvt10-s': 'cvt10',
  'cvt10 pro-s': 'cvt10-pro',
  'cvt4k-s': 'cvt4k',
  'msd300-1': 'msd300',
  'msd600-1': 'msd600'
};

const MODEL_SKIP = {
  'cvt10-m': true,
  'cvt10 pro-m': true,
  'cvt4k-m': true,
  'h2-t master': true,
  'h2-z master': true,
  'h5-t master': true,
  'h5-z master': true,
  'h9-t master': true,
  'h9 (enhanced) master': true,
  'h15 (enhanced) master': true,
  'mx30-sf': true,
  'et4s-g (p2) mainframe': true,
  'et4s-g (a4) mainframe': true,
  'et16s-g (2a4) mainframe': true,
  'et16s-g (3a4) mainframe': true,
  'et16s-g (4a4) mainframe': true,
  'a8s pro': true,
  'xa10': true
};

function loadPack() {
  return JSON.parse(fs.readFileSync(PACK_PATH, 'utf8'));
}

function normalizeModel(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\u00d7/g, 'x')
    .replace(/\s*\(us\)\s*/gi, ' ')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugifyModel(value) {
  return normalizeModel(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function indexProducts(products) {
  const bySeries = new Map();
  (products || []).forEach(function (p) {
    const brand = String((p && (p.brandId || p.brand_id)) || '');
    if (brand !== 'novastar') return;
    const id = p.id || p.series_id;
    if (id) bySeries.set(String(id), p);
  });
  return bySeries;
}

function matchSeries(model, bySeries) {
  const n = normalizeModel(model);
  if (!n || MODEL_SKIP[n]) return null;
  if (Object.prototype.hasOwnProperty.call(MODEL_ALIASES, n)) {
    const id = MODEL_ALIASES[n];
    return bySeries.has(id) ? id : null;
  }

  const candidates = [n];
  if (/\s+chassis$/.test(n)) candidates.push(n.replace(/\s+chassis$/, '').trim());
  if (/\s+master$/.test(n)) candidates.push(n.replace(/\s+master$/, '').trim());
  if (/-s$/.test(n) && !/-m$/.test(n)) candidates.push(n.replace(/-s$/, '').trim());

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (!c || MODEL_SKIP[c]) continue;
    if (MODEL_ALIASES[c] && bySeries.has(MODEL_ALIASES[c])) return MODEL_ALIASES[c];
    const slug = slugifyModel(c);
    if (slug && bySeries.has(slug)) return slug;
    const values = Array.from(bySeries.values());
    for (let j = 0; j < values.length; j++) {
      const p = values[j];
      const modelN = normalizeModel(p.model || (p.details && p.details.model) || '');
      const nameN = normalizeModel(String(p.name || '').replace(/^novastar\s+/i, ''));
      if (modelN && modelN === c) return p.id || p.series_id;
      if (nameN && nameN === c) return p.id || p.series_id;
    }
  }
  return null;
}

function listSkuFromModel(model) {
  const inv = require('./inventory');
  const token = String(model || '')
    .toUpperCase()
    .replace(/\u00d7/g, 'X')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return inv.normalizeSku('NS-' + token) || 'NS-ITEM';
}

function catalogSkuFor(product) {
  const inv = require('./inventory');
  return inv.suggestedSku({
    brandId: product.brandId || 'novastar',
    seriesId: product.id,
    name: product.name,
    pitch: ''
  });
}

function previewMatches(products) {
  const bySeries = indexProducts(products);
  const pack = loadPack();
  return (pack.rows || []).map(function (row) {
    return {
      no: row.no,
      model: row.model,
      map: row.map,
      available: row.available,
      seriesId: matchSeries(row.model, bySeries)
    };
  });
}

function money(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function qtyInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

function isNovastarVendor(row) {
  const company = String((row && (row.company_name || row.companyName)) || '').trim().toLowerCase();
  const display = String((row && (row.display_name || row.displayName)) || '').trim().toLowerCase();
  return company === 'novastar' || display === 'novastar';
}

function isNovastarWarehouse(row) {
  return /^novastar warehouse$/i.test(String((row && row.name) || '').trim());
}

function nextLead(details, available) {
  const cur = String((details && details.store_lead) || '').trim();
  if (cur) return cur;
  if ((Number(available) || 0) > 0) return 'ships_novastar';
  return cur;
}

function applySqlite(db) {
  const inv = require('./inventory');
  const dbUtil = require('./db');
  const pack = loadPack();
  const products = dbUtil.listProducts(db);
  const bySeries = indexProducts(products);
  const stamp = dbUtil.nowIso();

  const vendorId = ensureVendorSqlite(db, stamp);
  const warehouseId = ensureWarehouseSqlite(db, vendorId, stamp);

  const items = db.prepare('SELECT * FROM inventory_items').all();
  const bySku = {};
  const taken = {};
  items.forEach(function (it) {
    const sku = inv.normalizeSku(it.sku);
    if (sku) {
      bySku[sku] = it;
      taken[sku] = true;
    }
  });
  const maps = db.prepare('SELECT * FROM product_inventory_map').all();
  const mapByProduct = {};
  maps.forEach(function (m) {
    mapByProduct[String(m.product_id) + '|' + inv.pitchKey(m.pitch)] = m;
  });

  const insertItem = db.prepare(`
    INSERT INTO inventory_items (
      sku, name, brand_id, pitch, unit, panel_type, packaging_type, qty, low_at, price, cost, dealer_net,
      weight, panel_w, panel_h, description, image, notes, created_at, updated_at
    ) VALUES (?, ?, 'novastar', '', 'each', '', '', 0, 0, ?, 0, ?, 0, 0, 0, '', '', ?, ?, ?)
  `);
  const updateItem = db.prepare(
    'UPDATE inventory_items SET price = ?, dealer_net = ?, unit = ?, updated_at = ? WHERE id = ?'
  );
  const getMap = db.prepare('SELECT * FROM product_inventory_map WHERE product_id = ? AND pitch = ?');
  const insertMap = db.prepare(
    'INSERT INTO product_inventory_map (product_id, pitch, item_id) VALUES (?, ?, ?)'
  );
  const getProductRow = db.prepare('SELECT * FROM products WHERE id = ?');
  const updateProduct = db.prepare(
    'UPDATE products SET price_per_m2 = ?, details = ?, updated_at = ? WHERE id = ?'
  );

  let itemCount = 0;
  let qtyCount = 0;
  let webCount = 0;

  db.exec('BEGIN');
  try {
    (pack.rows || []).forEach(function (row) {
      if (!row || !row.model || !(Number(row.map) > 0)) return;
      const seriesId = matchSeries(row.model, bySeries);
      const product = seriesId ? bySeries.get(seriesId) : null;
      const price = money(row.map);
      const dealerNet = row.distUs != null ? money(row.distUs) : 0;

      let item = null;
      if (product) {
        const mapped = mapByProduct[String(product.dbId) + '|'];
        if (mapped) {
          item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(mapped.item_id);
        }
        if (!item) {
          item = bySku[inv.normalizeSku(catalogSkuFor(product))] || null;
        }
      }
      if (!item) {
        item = bySku[listSkuFromModel(row.model)] || null;
      }

      if (!item) {
        const sku = inv.uniqueSku(
          product ? catalogSkuFor(product) : listSkuFromModel(row.model),
          taken
        );
        taken[sku] = true;
        const name = product ? inv.skuNameFromProduct(product, '') : row.model;
        const info = insertItem.run(sku, name, price, dealerNet, SOURCE_NOTE, stamp, stamp);
        item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(info.lastInsertRowid);
        bySku[inv.normalizeSku(sku)] = item;
      } else {
        const nextDealer = row.distUs != null ? dealerNet : (Number(item.dealer_net) || 0);
        updateItem.run(price, nextDealer, 'each', stamp, item.id);
        item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(item.id);
        if (item.sku) bySku[inv.normalizeSku(item.sku)] = item;
      }
      itemCount += 1;

      if (row.available != null) {
        upsertItemLocationSqlite(db, item.id, warehouseId, qtyInt(row.available), stamp);
        qtyCount += 1;
      }

      if (product && product.dbId) {
        const existingMap = getMap.get(product.dbId, '');
        if (!existingMap) {
          insertMap.run(product.dbId, '', item.id);
          mapByProduct[String(product.dbId) + '|'] = { product_id: product.dbId, pitch: '', item_id: item.id };
        }
        const prow = getProductRow.get(product.dbId);
        if (prow) {
          const details = dbUtil.parseDetails(prow);
          details.priceEach = price;
          details.store_lead = nextLead(details, row.available);
          updateProduct.run(price, JSON.stringify(details), stamp, product.dbId);
          webCount += 1;
        }
      }
    });
    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (e) { /* ignore */ }
    throw err;
  }

  console.log(
    'NovaStar price list: ' + itemCount + ' inventory SKUs, ' +
    webCount + ' website/store series, ' + qtyCount + ' NovaStar warehouse bins'
  );
  return { itemCount: itemCount, webCount: webCount, qtyCount: qtyCount };
}

function ensureVendorSqlite(db, stamp) {
  const rows = db.prepare('SELECT * FROM inventory_vendors').all();
  const found = rows.find(isNovastarVendor);
  if (found) return found.id;
  const info = db.prepare(`
    INSERT INTO inventory_vendors (
      company_name, display_name, website, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    VENDOR_NAME,
    VENDOR_NAME,
    'https://www.novastar.tech',
    'Vendor warehouse partner for control gear.',
    stamp,
    stamp
  );
  return info.lastInsertRowid;
}

function ensureWarehouseSqlite(db, vendorId, stamp) {
  const rows = db.prepare('SELECT * FROM inventory_warehouses').all();
  let found = rows.find(isNovastarWarehouse);
  if (!found) {
    found = rows.find(function (row) {
      return String(row.vendor_id) === String(vendorId) && /novastar/i.test(row.name || '');
    });
  }
  if (found) {
    db.prepare(
      'UPDATE inventory_warehouses SET vendor_id = ?, untracked = 1, type = ?, updated_at = ? WHERE id = ?'
    ).run(vendorId, 'warehouse', stamp, found.id);
    return found.id;
  }
  const info = db.prepare(`
    INSERT INTO inventory_warehouses (
      name, type, vendor_id, untracked, notes, street, street2, city, state, zip, country, created_at, updated_at
    ) VALUES (?, 'warehouse', ?, 1, ?, '', '', '', '', '', '', ?, ?)
  `).run(
    WAREHOUSE_NAME,
    vendorId,
    'Untracked NovaStar vendor warehouse. Available qty from 2026-08-31 snapshot. Not Spectrum Azusa.',
    stamp,
    stamp
  );
  return info.lastInsertRowid;
}

function upsertItemLocationSqlite(db, itemId, warehouseId, qty, stamp) {
  const existing = db.prepare(
    'SELECT * FROM inventory_item_locations WHERE item_id = ? AND warehouse_id = ?'
  ).get(itemId, warehouseId);
  if (existing) {
    db.prepare(
      'UPDATE inventory_item_locations SET qty = ?, updated_at = ? WHERE id = ?'
    ).run(qty, stamp, existing.id);
  } else {
    db.prepare(`
      INSERT INTO inventory_item_locations (item_id, warehouse_id, bin, qty, created_at, updated_at)
      VALUES (?, ?, '', ?, ?, ?)
    `).run(itemId, warehouseId, qty, stamp, stamp);
  }
  const inv = require('./inventory');
  const locs = db.prepare(`
    SELECT l.*, w.untracked, w.vendor_id, w.type AS warehouse_type
    FROM inventory_item_locations l
    JOIN inventory_warehouses w ON w.id = l.warehouse_id
    WHERE l.item_id = ?
  `).all(itemId);
  const spectrumQty = inv.spectrumQtyFromLocations(locs.map(function (row) {
    return inv.formatLocation(row);
  }));
  db.prepare('UPDATE inventory_items SET qty = ?, updated_at = ? WHERE id = ?').run(spectrumQty, stamp, itemId);
}

function throwIf(error, fallback) {
  if (!error) return;
  throw new Error(error.message || fallback || 'Supabase error');
}

async function applySupabase(supabase) {
  const inv = require('./inventory');
  const dbUtil = require('./db');
  const pack = loadPack();
  const { data: productRows, error: pErr } = await supabase
    .from('products')
    .select('*')
    .eq('brand_id', 'novastar');
  throwIf(pErr, 'Could not read NovaStar products.');
  const products = (productRows || []).map(function (row) {
    return dbUtil.rowToProduct(row, { name: 'NovaStar' });
  });
  const bySeries = indexProducts(products);

  const vendorId = await ensureVendorSupabase(supabase);
  const warehouseId = await ensureWarehouseSupabase(supabase, vendorId);
  const stamp = new Date().toISOString();

  const { data: itemRows, error: iErr } = await supabase.from('inventory_items').select('*');
  throwIf(iErr, 'Could not read inventory items.');
  const bySku = {};
  const taken = {};
  (itemRows || []).forEach(function (it) {
    const sku = inv.normalizeSku(it.sku);
    if (sku) {
      bySku[sku] = it;
      taken[sku] = true;
    }
  });
  const { data: maps, error: mErr } = await supabase.from('product_inventory_map').select('*');
  throwIf(mErr, 'Could not read inventory maps.');
  const mapByProduct = {};
  (maps || []).forEach(function (m) {
    mapByProduct[String(m.product_id) + '|' + inv.pitchKey(m.pitch)] = m;
  });
  const itemById = {};
  (itemRows || []).forEach(function (it) { itemById[String(it.id)] = it; });

  let itemCount = 0;
  let qtyCount = 0;
  let webCount = 0;

  for (let i = 0; i < (pack.rows || []).length; i++) {
    const row = pack.rows[i];
    if (!row || !row.model || !(Number(row.map) > 0)) continue;
    const seriesId = matchSeries(row.model, bySeries);
    const product = seriesId ? bySeries.get(seriesId) : null;
    const price = money(row.map);
    const dealerNet = row.distUs != null ? money(row.distUs) : 0;

    let item = null;
    if (product) {
      const mapped = mapByProduct[String(product.dbId) + '|'];
      if (mapped) item = itemById[String(mapped.item_id)] || null;
      if (!item) item = bySku[inv.normalizeSku(catalogSkuFor(product))] || null;
    }
    if (!item) item = bySku[listSkuFromModel(row.model)] || null;

    if (!item) {
      const sku = inv.uniqueSku(
        product ? catalogSkuFor(product) : listSkuFromModel(row.model),
        taken
      );
      taken[sku] = true;
      const name = product ? inv.skuNameFromProduct(product, '') : row.model;
      const { data: created, error: cErr } = await supabase.from('inventory_items').insert({
        sku: sku,
        name: name,
        brand_id: 'novastar',
        pitch: '',
        unit: 'each',
        qty: 0,
        low_at: 0,
        price: price,
        cost: 0,
        dealer_net: dealerNet,
        notes: SOURCE_NOTE,
        updated_at: stamp
      }).select('*').single();
      throwIf(cErr, 'Could not create inventory SKU ' + sku);
      item = created;
      bySku[inv.normalizeSku(sku)] = item;
      itemById[String(item.id)] = item;
    } else {
      const nextDealer = row.distUs != null ? dealerNet : (Number(item.dealer_net) || 0);
      const { data: updated, error: uErr } = await supabase.from('inventory_items').update({
        price: price,
        dealer_net: nextDealer,
        unit: 'each',
        updated_at: stamp
      }).eq('id', item.id).select('*').single();
      throwIf(uErr, 'Could not update inventory SKU ' + (item.sku || item.id));
      item = updated;
      if (item.sku) bySku[inv.normalizeSku(item.sku)] = item;
      itemById[String(item.id)] = item;
    }
    itemCount += 1;

    if (row.available != null) {
      await upsertItemLocationSupabase(supabase, item.id, warehouseId, qtyInt(row.available));
      qtyCount += 1;
    }

    if (product && product.dbId) {
      if (!mapByProduct[String(product.dbId) + '|']) {
        const { error: mapErr } = await supabase.from('product_inventory_map').upsert({
          product_id: Number(product.dbId),
          pitch: '',
          item_id: item.id
        }, { onConflict: 'product_id,pitch' });
        throwIf(mapErr, 'Could not map ' + product.id);
        mapByProduct[String(product.dbId) + '|'] = {
          product_id: product.dbId,
          pitch: '',
          item_id: item.id
        };
      }
      const { data: prow, error: prErr } = await supabase
        .from('products')
        .select('id, details, price_per_m2')
        .eq('id', product.dbId)
        .maybeSingle();
      throwIf(prErr, 'Could not read product ' + product.id);
      if (prow) {
        const details = dbUtil.parseDetails(prow);
        details.priceEach = price;
        details.store_lead = nextLead(details, row.available);
        const { error: upErr } = await supabase.from('products').update({
          price_per_m2: price,
          details: details,
          updated_at: stamp
        }).eq('id', prow.id);
        throwIf(upErr, 'Could not price product ' + product.id);
        webCount += 1;
      }
    }
  }

  console.log(
    'NovaStar price list: ' + itemCount + ' inventory SKUs, ' +
    webCount + ' website/store series, ' + qtyCount + ' NovaStar warehouse bins'
  );
  return { itemCount: itemCount, webCount: webCount, qtyCount: qtyCount };
}

async function ensureVendorSupabase(supabase) {
  const { data, error } = await supabase.from('inventory_vendors').select('id, company_name, display_name');
  throwIf(error, 'Could not read vendors.');
  const found = (data || []).find(isNovastarVendor);
  if (found) return found.id;
  const stamp = new Date().toISOString();
  const { data: created, error: insErr } = await supabase.from('inventory_vendors').insert({
    company_name: VENDOR_NAME,
    display_name: VENDOR_NAME,
    website: 'https://www.novastar.tech',
    notes: 'Vendor warehouse partner for control gear.',
    created_at: stamp,
    updated_at: stamp
  }).select('id').single();
  throwIf(insErr, 'Could not create NovaStar vendor.');
  return created.id;
}

async function ensureWarehouseSupabase(supabase, vendorId) {
  const { data, error } = await supabase.from('inventory_warehouses').select('*');
  throwIf(error, 'Could not read warehouses.');
  let found = (data || []).find(isNovastarWarehouse);
  if (!found) {
    found = (data || []).find(function (row) {
      return String(row.vendor_id) === String(vendorId) && /novastar/i.test(row.name || '');
    });
  }
  const stamp = new Date().toISOString();
  if (found) {
    const { error: upErr } = await supabase.from('inventory_warehouses').update({
      vendor_id: Number(vendorId),
      untracked: true,
      type: 'warehouse',
      updated_at: stamp
    }).eq('id', found.id);
    throwIf(upErr, 'Could not update NovaStar warehouse.');
    return found.id;
  }
  const { data: created, error: insErr } = await supabase.from('inventory_warehouses').insert({
    name: WAREHOUSE_NAME,
    type: 'warehouse',
    vendor_id: Number(vendorId),
    untracked: true,
    notes: 'Untracked NovaStar vendor warehouse. Available qty from 2026-08-31 snapshot. Not Spectrum Azusa.',
    created_at: stamp,
    updated_at: stamp
  }).select('id').single();
  throwIf(insErr, 'Could not create NovaStar warehouse.');
  return created.id;
}

async function upsertItemLocationSupabase(supabase, itemId, warehouseId, qty) {
  const inv = require('./inventory');
  const stamp = new Date().toISOString();
  const { data: existing, error: eErr } = await supabase
    .from('inventory_item_locations')
    .select('*')
    .eq('item_id', itemId)
    .eq('warehouse_id', warehouseId)
    .maybeSingle();
  throwIf(eErr, 'Could not read NovaStar warehouse qty.');
  if (existing) {
    const { error } = await supabase.from('inventory_item_locations').update({
      qty: qty,
      updated_at: stamp
    }).eq('id', existing.id);
    throwIf(error, 'Could not update NovaStar warehouse qty.');
  } else {
    const { error } = await supabase.from('inventory_item_locations').insert({
      item_id: Number(itemId),
      warehouse_id: Number(warehouseId),
      bin: '',
      qty: qty,
      created_at: stamp,
      updated_at: stamp
    });
    throwIf(error, 'Could not save NovaStar warehouse qty.');
  }
  const { data: locRows, error: lErr } = await supabase
    .from('inventory_item_locations')
    .select('*, inventory_warehouses(untracked, vendor_id, type, name)')
    .eq('item_id', itemId);
  throwIf(lErr, 'Could not sync Azusa qty.');
  const locs = (locRows || []).map(function (row) {
    const w = row.inventory_warehouses || {};
    return inv.formatLocation({
      id: row.id,
      item_id: row.item_id,
      warehouse_id: row.warehouse_id,
      bin: row.bin,
      qty: row.qty,
      untracked: w.untracked,
      vendor_id: w.vendor_id,
      warehouse_type: w.type,
      warehouse_name: w.name
    });
  });
  const spectrumQty = inv.spectrumQtyFromLocations(locs);
  const { error: qErr } = await supabase.from('inventory_items').update({
    qty: spectrumQty,
    updated_at: stamp
  }).eq('id', itemId);
  throwIf(qErr, 'Could not sync Azusa qty.');
}

module.exports = {
  PACK_PATH,
  VENDOR_NAME,
  WAREHOUSE_NAME,
  loadPack,
  normalizeModel,
  matchSeries,
  previewMatches,
  applySqlite,
  applySupabase
};
