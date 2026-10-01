/**
 * Add Transtech Discovery V1 COB and Discovery M SMD rows to inventory.
 *
 * Cabinet USD/m² → Cost on the panel SKU (same basis as panel sell price).
 * Module USD/pc → Cost on the spare-module SKU.
 * Does not set sell price, dealer net, or local warehouse cost.
 * Does not link these SKUs to the website.
 * Runs once. Deleting a SKU later does not bring it back.
 */

const fs = require('fs');
const path = require('path');

const PACK_PATH = path.join(__dirname, 'trt-discovery-price-inventory.json');
const PATCH_ID = 'trt_discovery_price_20260811';
const BRAND_ID = 'trt';
const PANEL_NOTE = 'Transtech price list 2026-08-11, EXW. Cost is the cabinet price in USD per m². That price includes power and the receiving card. It does not include a sending card or packaging. 2-year warranty. The spare module is its own SKU.';
const MODULE_NOTE = 'Transtech price list 2026-08-11, EXW. Cost is the module price in USD per piece. Spare modules are not included free with the cabinet. 2-year warranty.';

function loadPack() {
  return JSON.parse(fs.readFileSync(PACK_PATH, 'utf8'));
}

function money(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

function noteFor(row) {
  return row && row.kind === 'module' ? MODULE_NOTE : PANEL_NOTE;
}

function fieldsFor(row) {
  const inv = require('./inventory');
  return {
    sku: inv.normalizeSku(row.sku),
    name: String(row.name || '').trim(),
    pitch: inv.pitchKey(row.pitch),
    unit: inv.unitOf(row.unit),
    category: row.category || (row.kind === 'module' ? 'Spare' : 'LED Panel'),
    panelType: row.panelType || '',
    packagingType: row.packagingType || '',
    panelW: money(row.panelW),
    panelH: money(row.panelH),
    cost: money(row.cost),
    description: String(row.description || '').trim(),
    notes: noteFor(row)
  };
}

function applySqlite(db) {
  const dbUtil = require('./db');
  const pack = loadPack();
  const stamp = dbUtil.nowIso();
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_patches (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);
  const done = db.prepare('SELECT 1 AS n FROM schema_patches WHERE id = ?').get(PATCH_ID);
  if (done) return { added: 0, skipped: true };

  const taken = {};
  db.prepare('SELECT sku FROM inventory_items').all().forEach(function (it) {
    const sku = require('./inventory').normalizeSku(it.sku);
    if (sku) taken[sku] = true;
  });

  const insertItem = db.prepare(`
    INSERT INTO inventory_items (
      sku, name, brand_id, category, pitch, unit, panel_type, packaging_type, qty, low_at, price, cost, dealer_net,
      local_warehouse_cost, weight, panel_w, panel_h, description, image, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, 0, 0, 0, ?, ?, ?, '', ?, ?, ?)
  `);

  let added = 0;
  db.exec('BEGIN');
  try {
    (pack.rows || []).forEach(function (row) {
      const fields = fieldsFor(row);
      if (!fields.sku || !fields.name || !(fields.cost > 0)) return;
      if (taken[fields.sku]) return;
      insertItem.run(
        fields.sku,
        fields.name,
        BRAND_ID,
        fields.category,
        fields.pitch,
        fields.unit,
        fields.panelType,
        fields.packagingType,
        fields.cost,
        fields.panelW,
        fields.panelH,
        fields.description,
        fields.notes,
        stamp,
        stamp
      );
      taken[fields.sku] = true;
      added += 1;
    });
    db.prepare('INSERT INTO schema_patches (id, applied_at) VALUES (?, ?)').run(PATCH_ID, stamp);
    db.exec('COMMIT');
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch (err) { /* already closed */ }
    throw e;
  }
  if (added) console.log('Transtech Discovery price list: added ' + added + ' inventory items');
  return { added: added, skipped: false };
}

function throwIf(error, fallback) {
  if (!error) return;
  throw new Error(error.message || fallback || 'Supabase error');
}

async function markerState(supabase) {
  const { data, error } = await supabase.from('schema_patches').select('id').eq('id', PATCH_ID).maybeSingle();
  if (error) return { known: false, done: false };
  return { known: true, done: !!(data && data.id) };
}

async function applySupabase(supabase) {
  const pack = loadPack();
  const stamp = new Date().toISOString();
  const state = await markerState(supabase);
  if (state.done) return { added: 0, skipped: true };

  const { data: itemRows, error: iErr } = await supabase.from('inventory_items').select('sku');
  throwIf(iErr, 'Could not read inventory items.');
  const taken = {};
  (itemRows || []).forEach(function (it) {
    const sku = require('./inventory').normalizeSku(it.sku);
    if (sku) taken[sku] = true;
  });

  let added = 0;
  for (let i = 0; i < (pack.rows || []).length; i++) {
    const fields = fieldsFor(pack.rows[i]);
    if (!fields.sku || !fields.name || !(fields.cost > 0)) continue;
    if (taken[fields.sku]) continue;
    const { error: cErr } = await supabase.from('inventory_items').insert({
      sku: fields.sku,
      name: fields.name,
      brand_id: BRAND_ID,
      category: fields.category,
      pitch: fields.pitch,
      unit: fields.unit,
      panel_type: fields.panelType,
      packaging_type: fields.packagingType,
      qty: 0,
      low_at: 0,
      price: 0,
      cost: fields.cost,
      dealer_net: 0,
      local_warehouse_cost: 0,
      panel_w: fields.panelW,
      panel_h: fields.panelH,
      description: fields.description,
      notes: fields.notes,
      updated_at: stamp
    });
    throwIf(cErr, 'Could not create inventory SKU ' + fields.sku);
    taken[fields.sku] = true;
    added += 1;
  }

  if (state.known) {
    const { error: mErr } = await supabase.from('schema_patches').insert({
      id: PATCH_ID,
      applied_at: stamp
    });
    throwIf(mErr, 'Could not record Discovery price list.');
  }
  if (added) console.log('Transtech Discovery price list: added ' + added + ' inventory items');
  return { added: added, skipped: false };
}

module.exports = {
  PATCH_ID,
  loadPack,
  applySqlite,
  applySupabase
};
