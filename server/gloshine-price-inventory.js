/**
 * Apply Gloshine LA warehouse qty + USD/pcs onto inventory (and store lead).
 *
 * USD/pcs → inventory Local warehouse cost (Los Angeles). Not dealer net, not MAP.
 * Qty → untracked "Gloshine US Warehouse" only (not Azusa).
 * Does not overwrite inventory sell price, Cost, dealer net, or website $/m².
 * Curve / corner / Mini / Plus stay on separate SKUs when the sheet prices differ.
 */

const fs = require('fs');
const path = require('path');

const PACK_PATH = path.join(__dirname, 'gloshine-price-inventory.json');
const VENDOR_NAME = 'Gloshine';
const WAREHOUSE_NAME = 'Gloshine US Warehouse';
const SOURCE_NOTE = 'Gloshine LA warehouse 2026-09-01';
const BRAND_ID = 'gloshine';

function loadPack() {
  return JSON.parse(fs.readFileSync(PACK_PATH, 'utf8'));
}

function indexProducts(products) {
  const bySeries = new Map();
  (products || []).forEach(function (p) {
    const brand = String((p && (p.brandId || p.brand_id)) || '');
    if (brand !== BRAND_ID) return;
    const id = p.id || p.series_id;
    if (id) bySeries.set(String(id), p);
  });
  return bySeries;
}

function catalogSkuFor(product, pitch) {
  const inv = require('./inventory');
  return inv.suggestedSku({
    brandId: product.brandId || BRAND_ID,
    seriesId: product.id,
    name: product.name,
    pitch: pitch
  });
}

function moneyOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

function hasUsd(row) {
  return row && row.usdPcs != null && row.usdPcs !== '';
}

function qtyInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

function sizeMeters(size) {
  const m = String(size || '').toLowerCase().match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/);
  if (!m) return { w: 0, h: 0 };
  return { w: Number(m[1]) / 1000, h: Number(m[2]) / 1000 };
}

function isGloshineVendor(row) {
  const company = String((row && (row.company_name || row.companyName)) || '').trim().toLowerCase();
  const display = String((row && (row.display_name || row.displayName)) || '').trim().toLowerCase();
  return company === 'gloshine' || display === 'gloshine';
}

function isGloshineWarehouse(row) {
  const name = String((row && row.name) || '').trim();
  if (/^gloshine us warehouse$/i.test(name)) return true;
  if (/gloshine/i.test(name) && /(los angeles|\bla\b|us warehouse)/i.test(name)) return true;
  return false;
}

function nextLead(details, qty) {
  const cur = String((details && details.store_lead) || '').trim();
  if (cur) return cur;
  if ((Number(qty) || 0) > 0) return 'ships_gloshine';
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
      sku, name, brand_id, category, pitch, unit, panel_type, packaging_type, qty, low_at, price, cost, dealer_net,
      local_warehouse_cost, weight, panel_w, panel_h, description, image, notes, created_at, updated_at
    ) VALUES (?, ?, ?, 'LED Panel', ?, 'panels', ?, '', 0, 0, 0, 0, 0, ?, 0, ?, ?, '', '', ?, ?, ?)
  `);
  const updateItem = db.prepare(
    'UPDATE inventory_items SET local_warehouse_cost = ?, pitch = ?, unit = ?, updated_at = ? WHERE id = ?'
  );
  const getMap = db.prepare('SELECT * FROM product_inventory_map WHERE product_id = ? AND pitch = ?');
  const insertMap = db.prepare(
    'INSERT INTO product_inventory_map (product_id, pitch, item_id) VALUES (?, ?, ?)'
  );
  const getProductRow = db.prepare('SELECT * FROM products WHERE id = ?');
  const updateProduct = db.prepare(
    'UPDATE products SET details = ?, updated_at = ? WHERE id = ?'
  );

  let itemCount = 0;
  let qtyCount = 0;
  let webCount = 0;

  db.exec('BEGIN');
  try {
    (pack.rows || []).forEach(function (row) {
      if (!row || !row.name) return;
      const pitch = inv.pitchKey(row.pitch);
      const product = row.mapToCatalog && row.seriesId ? bySeries.get(String(row.seriesId)) : null;
      const hint = inv.normalizeSku(row.skuHint || '');

      let item = null;
      if (product && row.mapToCatalog) {
        const mapped = mapByProduct[String(product.dbId) + '|' + pitch];
        if (mapped) {
          item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(mapped.item_id);
        }
        if (!item) item = bySku[inv.normalizeSku(catalogSkuFor(product, pitch))] || null;
      }
      if (!item && hint) item = bySku[hint] || null;

      if (!item) {
        const sku = inv.uniqueSku(
          product && row.mapToCatalog ? catalogSkuFor(product, pitch) : (row.skuHint || 'GLO-ITEM'),
          taken
        );
        taken[sku] = true;
        const name = product && row.mapToCatalog ? inv.skuNameFromProduct(product, pitch) : row.name;
        const dim = sizeMeters(row.size);
        const info = insertItem.run(
          sku,
          name,
          BRAND_ID,
          pitch,
          row.panelType || '',
          hasUsd(row) ? moneyOrZero(row.usdPcs) : 0,
          dim.w,
          dim.h,
          SOURCE_NOTE,
          stamp,
          stamp
        );
        item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(info.lastInsertRowid);
        bySku[inv.normalizeSku(sku)] = item;
      } else {
        const local = hasUsd(row)
          ? moneyOrZero(row.usdPcs)
          : moneyOrZero(item.local_warehouse_cost);
        const nextPitch = inv.pitchKey(item.pitch) || pitch;
        const nextUnit = item.unit || 'panels';
        updateItem.run(local, nextPitch, nextUnit, stamp, item.id);
        item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(item.id);
        if (item.sku) bySku[inv.normalizeSku(item.sku)] = item;
      }
      itemCount += 1;

      upsertItemLocationSqlite(db, item.id, warehouseId, qtyInt(row.qty), stamp);
      qtyCount += 1;

      if (product && product.dbId && row.mapToCatalog) {
        const existingMap = getMap.get(product.dbId, pitch);
        if (!existingMap) {
          insertMap.run(product.dbId, pitch, item.id);
          mapByProduct[String(product.dbId) + '|' + pitch] = {
            product_id: product.dbId,
            pitch: pitch,
            item_id: item.id
          };
        }
        const prow = getProductRow.get(product.dbId);
        if (prow) {
          const details = dbUtil.parseDetails(prow);
          const lead = nextLead(details, row.qty);
          if (lead && details.store_lead !== lead) {
            details.store_lead = lead;
            updateProduct.run(JSON.stringify(details), stamp, product.dbId);
            webCount += 1;
          }
        }
      }
    });
    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (e) { /* ignore */ }
    throw err;
  }

  console.log(
    'Gloshine LA warehouse: ' + itemCount + ' inventory SKUs, ' +
    webCount + ' store lead updates, ' + qtyCount + ' Gloshine US warehouse bins'
  );
  return { itemCount: itemCount, webCount: webCount, qtyCount: qtyCount };
}

function ensureVendorSqlite(db, stamp) {
  const rows = db.prepare('SELECT * FROM inventory_vendors').all();
  const found = rows.find(isGloshineVendor);
  if (found) return found.id;
  const info = db.prepare(`
    INSERT INTO inventory_vendors (
      company_name, display_name, website, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    VENDOR_NAME,
    VENDOR_NAME,
    'https://gloshine.com',
    'Vendor warehouse partner for LED panels (Los Angeles).',
    stamp,
    stamp
  );
  return info.lastInsertRowid;
}

function ensureWarehouseSqlite(db, vendorId, stamp) {
  const rows = db.prepare('SELECT * FROM inventory_warehouses').all();
  let found = rows.find(isGloshineWarehouse);
  if (!found) {
    found = rows.find(function (row) {
      return String(row.vendor_id) === String(vendorId) && /gloshine/i.test(row.name || '');
    });
  }
  if (found) {
    db.prepare(
      'UPDATE inventory_warehouses SET vendor_id = ?, untracked = 1, type = ?, city = ?, state = ?, country = ?, updated_at = ? WHERE id = ?'
    ).run(vendorId, 'warehouse', 'Los Angeles', 'CA', 'US', stamp, found.id);
    return found.id;
  }
  const info = db.prepare(`
    INSERT INTO inventory_warehouses (
      name, type, vendor_id, untracked, notes, street, street2, city, state, zip, country, created_at, updated_at
    ) VALUES (?, 'warehouse', ?, 1, ?, '', '', ?, ?, '', ?, ?, ?)
  `).run(
    WAREHOUSE_NAME,
    vendorId,
    'Untracked Gloshine US warehouse (Los Angeles). Qty from 2026-09-01 snapshot. Not Spectrum Azusa.',
    'Los Angeles',
    'CA',
    'US',
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
    .eq('brand_id', BRAND_ID);
  throwIf(pErr, 'Could not read Gloshine products.');
  const products = (productRows || []).map(function (row) {
    return dbUtil.rowToProduct(row, { name: 'Gloshine' });
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
    if (!row || !row.name) continue;
    const pitch = inv.pitchKey(row.pitch);
    const product = row.mapToCatalog && row.seriesId ? bySeries.get(String(row.seriesId)) : null;
    const hint = inv.normalizeSku(row.skuHint || '');

    let item = null;
    if (product && row.mapToCatalog) {
      const mapped = mapByProduct[String(product.dbId) + '|' + pitch];
      if (mapped) item = itemById[String(mapped.item_id)] || null;
      if (!item) item = bySku[inv.normalizeSku(catalogSkuFor(product, pitch))] || null;
    }
    if (!item && hint) item = bySku[hint] || null;

    if (!item) {
      const sku = inv.uniqueSku(
        product && row.mapToCatalog ? catalogSkuFor(product, pitch) : (row.skuHint || 'GLO-ITEM'),
        taken
      );
      taken[sku] = true;
      const name = product && row.mapToCatalog ? inv.skuNameFromProduct(product, pitch) : row.name;
      const dim = sizeMeters(row.size);
      const { data: created, error: cErr } = await supabase.from('inventory_items').insert({
        sku: sku,
        name: name,
        brand_id: BRAND_ID,
        category: 'LED Panel',
        pitch: pitch,
        unit: 'panels',
        panel_type: row.panelType || '',
        qty: 0,
        low_at: 0,
        price: 0,
        cost: 0,
        dealer_net: 0,
        local_warehouse_cost: hasUsd(row) ? moneyOrZero(row.usdPcs) : 0,
        panel_w: dim.w,
        panel_h: dim.h,
        notes: SOURCE_NOTE,
        updated_at: stamp
      }).select('*').single();
      throwIf(cErr, 'Could not create inventory SKU ' + sku);
      item = created;
      bySku[inv.normalizeSku(sku)] = item;
      itemById[String(item.id)] = item;
    } else {
      const local = hasUsd(row)
        ? moneyOrZero(row.usdPcs)
        : moneyOrZero(item.local_warehouse_cost);
      const nextPitch = inv.pitchKey(item.pitch) || pitch;
      const { data: updated, error: uErr } = await supabase.from('inventory_items').update({
        local_warehouse_cost: local,
        pitch: nextPitch,
        unit: item.unit || 'panels',
        updated_at: stamp
      }).eq('id', item.id).select('*').single();
      throwIf(uErr, 'Could not update inventory SKU ' + (item.sku || item.id));
      item = updated;
      if (item.sku) bySku[inv.normalizeSku(item.sku)] = item;
      itemById[String(item.id)] = item;
    }
    itemCount += 1;

    await upsertItemLocationSupabase(supabase, item.id, warehouseId, qtyInt(row.qty));
    qtyCount += 1;

    if (product && product.dbId && row.mapToCatalog) {
      if (!mapByProduct[String(product.dbId) + '|' + pitch]) {
        const { error: mapErr } = await supabase.from('product_inventory_map').upsert({
          product_id: Number(product.dbId),
          pitch: pitch,
          item_id: item.id
        }, { onConflict: 'product_id,pitch' });
        throwIf(mapErr, 'Could not map ' + product.id + ' P' + pitch);
        mapByProduct[String(product.dbId) + '|' + pitch] = {
          product_id: product.dbId,
          pitch: pitch,
          item_id: item.id
        };
      }
      const { data: prow, error: prErr } = await supabase
        .from('products')
        .select('id, details')
        .eq('id', product.dbId)
        .maybeSingle();
      throwIf(prErr, 'Could not read product ' + product.id);
      if (prow) {
        const details = dbUtil.parseDetails(prow);
        const lead = nextLead(details, row.qty);
        if (lead && details.store_lead !== lead) {
          details.store_lead = lead;
          const { error: upErr } = await supabase.from('products').update({
            details: details,
            updated_at: stamp
          }).eq('id', prow.id);
          throwIf(upErr, 'Could not update lead for ' + product.id);
          webCount += 1;
        }
      }
    }
  }

  console.log(
    'Gloshine LA warehouse: ' + itemCount + ' inventory SKUs, ' +
    webCount + ' store lead updates, ' + qtyCount + ' Gloshine US warehouse bins'
  );
  return { itemCount: itemCount, webCount: webCount, qtyCount: qtyCount };
}

async function ensureVendorSupabase(supabase) {
  const { data, error } = await supabase.from('inventory_vendors').select('id, company_name, display_name');
  throwIf(error, 'Could not read vendors.');
  const found = (data || []).find(isGloshineVendor);
  if (found) return found.id;
  const stamp = new Date().toISOString();
  const { data: created, error: insErr } = await supabase.from('inventory_vendors').insert({
    company_name: VENDOR_NAME,
    display_name: VENDOR_NAME,
    website: 'https://gloshine.com',
    notes: 'Vendor warehouse partner for LED panels (Los Angeles).',
    created_at: stamp,
    updated_at: stamp
  }).select('id').single();
  throwIf(insErr, 'Could not create Gloshine vendor.');
  return created.id;
}

async function ensureWarehouseSupabase(supabase, vendorId) {
  const { data, error } = await supabase.from('inventory_warehouses').select('*');
  throwIf(error, 'Could not read warehouses.');
  let found = (data || []).find(isGloshineWarehouse);
  if (!found) {
    found = (data || []).find(function (row) {
      return String(row.vendor_id) === String(vendorId) && /gloshine/i.test(row.name || '');
    });
  }
  const stamp = new Date().toISOString();
  if (found) {
    const { error: upErr } = await supabase.from('inventory_warehouses').update({
      vendor_id: Number(vendorId),
      untracked: true,
      type: 'warehouse',
      city: 'Los Angeles',
      state: 'CA',
      country: 'US',
      updated_at: stamp
    }).eq('id', found.id);
    throwIf(upErr, 'Could not update Gloshine warehouse.');
    return found.id;
  }
  const { data: created, error: insErr } = await supabase.from('inventory_warehouses').insert({
    name: WAREHOUSE_NAME,
    type: 'warehouse',
    vendor_id: Number(vendorId),
    untracked: true,
    notes: 'Untracked Gloshine US warehouse (Los Angeles). Qty from 2026-09-01 snapshot. Not Spectrum Azusa.',
    city: 'Los Angeles',
    state: 'CA',
    country: 'US',
    created_at: stamp,
    updated_at: stamp
  }).select('id').single();
  throwIf(insErr, 'Could not create Gloshine warehouse.');
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
  throwIf(eErr, 'Could not read Gloshine warehouse qty.');
  if (existing) {
    const { error } = await supabase.from('inventory_item_locations').update({
      qty: qty,
      updated_at: stamp
    }).eq('id', existing.id);
    throwIf(error, 'Could not update Gloshine warehouse qty.');
  } else {
    const { error } = await supabase.from('inventory_item_locations').insert({
      item_id: Number(itemId),
      warehouse_id: Number(warehouseId),
      bin: '',
      qty: qty,
      created_at: stamp,
      updated_at: stamp
    });
    throwIf(error, 'Could not save Gloshine warehouse qty.');
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
  applySqlite,
  applySupabase
};
