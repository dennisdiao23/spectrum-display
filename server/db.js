const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'spectrum.db');
const SEED_PATH = path.join(__dirname, 'seed-catalog.json');
const NOVASTAR_SEED_PATH = path.join(__dirname, 'novastar-seed.json');
const CONTROL_DETAIL_KEYS = [
  'subtype', 'replacementOnly', 'family', 'model', 'maxPixels', 'outputs', 'inputs',
  'bestFor', 'bestWith', 'priceEach', 'latency', 'hdr', 'chips', 'downloads', 'downloadVersion'
];

function loadSeedBrands() {
  const brands = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  if (fs.existsSync(NOVASTAR_SEED_PATH)) {
    try {
      brands.push(JSON.parse(fs.readFileSync(NOVASTAR_SEED_PATH, 'utf8')));
    } catch (e) { /* skip bad seed */ }
  }
  return brands;
}

function rewriteCabinetCopy(value) {
  if (typeof value === 'string') {
    return value
      .replace(/\bCabinets\b/g, 'Panels')
      .replace(/\bCabinet\b/g, 'Panel')
      .replace(/\bcabinets\b/g, 'panels')
      .replace(/\bcabinet\b/g, 'panel');
  }
  if (Array.isArray(value)) return value.map(rewriteCabinetCopy);
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).forEach(function (k) {
      out[k] = rewriteCabinetCopy(value[k]);
    });
    return out;
  }
  return value;
}

function detailsFromSeries(s) {
  const details = {};
  if (!s || typeof s !== 'object') return details;
  ['cats', 'specTable', 'lead', 'sourceUrl', 'features'].concat(CONTROL_DETAIL_KEYS).forEach(function (k) {
    if (s[k] != null) details[k] = s[k];
  });
  if (s.type === 'control' || s.subtype) {
    details.priceEach = Number(s.priceEach || s.pricePerM2) || 0;
    if (!details.cats || !details.cats.length) {
      details.cats = ['control'].concat(s.subtype ? [s.subtype] : []);
      if (s.subtype === 'receiving-card') details.cats.push('receiving-cards');
    }
  }
  return details;
}

function nowIso() {
  return new Date().toISOString();
}

function openDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  try { db.exec('PRAGMA journal_mode = WAL'); } catch (e) { /* ignore */ }
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      admin_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (admin_id) REFERENCES admins(id)
    );
    CREATE TABLE IF NOT EXISTS brands (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tagline TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_id TEXT NOT NULL,
      series_id TEXT NOT NULL,
      name TEXT NOT NULL,
      pitches TEXT NOT NULL DEFAULT '[]',
      price_per_m2 REAL NOT NULL DEFAULT 0,
      weight_per_m2 REAL DEFAULT 0,
      power_avg REAL DEFAULT 0,
      power_max REAL DEFAULT 0,
      cabinet_w REAL DEFAULT 0.5,
      cabinet_h REAL DEFAULT 0.5,
      type TEXT DEFAULT 'Fixed',
      description TEXT DEFAULT '',
      badge TEXT DEFAULT '',
      image TEXT DEFAULT '',
      gallery TEXT NOT NULL DEFAULT '[]',
      details TEXT NOT NULL DEFAULT '{}',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (brand_id, series_id),
      FOREIGN KEY (brand_id) REFERENCES brands(id)
    );
  `);
  try { db.exec("ALTER TABLE products ADD COLUMN details TEXT NOT NULL DEFAULT '{}'"); } catch (e) { /* already present */ }
  return db;
}

function seedAdmin(db) {
  const row = db.prepare('SELECT id FROM admins LIMIT 1').get();
  if (row) return;
  const email = (process.env.ADMIN_EMAIL || 'admin@spectrumdisplay.com').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe!Admin';
  const name = process.env.ADMIN_NAME || 'Spectrum Admin';
  db.prepare(
    'INSERT INTO admins (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)'
  ).run(email, name, bcrypt.hashSync(password, 10), nowIso());
  console.log('Seeded admin account: ' + email);
}

function seedCatalog(db) {
  upsertMissingCatalog(db);
}

function upsertMissingCatalog(db) {
  const brands = loadSeedBrands();
  const insertBrand = db.prepare('INSERT OR IGNORE INTO brands (id, name, tagline) VALUES (?, ?, ?)');
  const hasProduct = db.prepare('SELECT id FROM products WHERE brand_id = ? AND series_id = ?');
  const insertProduct = db.prepare(`
    INSERT INTO products (
      brand_id, series_id, name, pitches, price_per_m2, weight_per_m2,
      power_avg, power_max, cabinet_w, cabinet_h, type, description, badge,
      image, gallery, details, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?)
  `);
  const stamp = nowIso();
  let added = 0;
  db.exec('BEGIN');
  try {
    brands.forEach((brand, bi) => {
      insertBrand.run(brand.id, brand.name, brand.tagline || '');
      (brand.series || []).forEach((s, si) => {
        if (hasProduct.get(brand.id, s.id)) return;
        const isControl = s.type === 'control' || brand.id === 'novastar' || !!s.subtype;
        insertProduct.run(
          brand.id,
          s.id,
          s.name,
          JSON.stringify(s.pitches || []),
          Number(isControl ? (s.priceEach || s.pricePerM2) : s.pricePerM2) || 0,
          s.weightPerM2 || 0,
          s.powerAvg || 0,
          s.powerMax || 0,
          isControl ? 0 : (s.cabinetW || 0.5),
          isControl ? 0 : (s.cabinetH || 0.5),
          isControl ? 'control' : (s.type || 'Fixed'),
          s.description || '',
          s.badge || '',
          s.image || '',
          JSON.stringify(detailsFromSeries(s)),
          bi * 40 + si,
          stamp,
          stamp
        );
        added += 1;
      });
    });
    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (e) { /* ignore */ }
    throw err;
  }
  if (added) console.log('Added ' + added + ' missing catalog series from seed files');
}

function fillMissingProductDetails(db) {
  const packPath = path.join(__dirname, 'product-details.json');
  if (!fs.existsSync(packPath)) return;
  let pack = [];
  try { pack = JSON.parse(fs.readFileSync(packPath, 'utf8')); } catch (e) { return; }
  const byKey = {};
  pack.forEach(function (r) {
    byKey[r.brand_id + '/' + r.series_id] = r.details || {};
  });
  const rows = db.prepare('SELECT id, brand_id, series_id, details FROM products').all();
  const upd = db.prepare('UPDATE products SET details = ? WHERE id = ?');
  rows.forEach(function (row) {
    const extra = byKey[row.brand_id + '/' + row.series_id];
    if (!extra) return;
    const current = parseDetails(row);
    const next = mergeProductDetails(current, extra);
    if (JSON.stringify(next) !== JSON.stringify(current)) {
      upd.run(JSON.stringify(next), row.id);
    }
  });
}

function rewriteExistingCabinetCopy(db) {
  const rows = db.prepare('SELECT id, description, badge, details FROM products').all();
  const upd = db.prepare(
    'UPDATE products SET description = ?, badge = ?, details = ?, updated_at = ? WHERE id = ?'
  );
  let n = 0;
  rows.forEach(function (row) {
    const desc = rewriteCabinetCopy(row.description || '');
    const badge = rewriteCabinetCopy(row.badge || '');
    const details = rewriteCabinetCopy(parseDetails(row));
    if (
      desc === (row.description || '') &&
      badge === (row.badge || '') &&
      JSON.stringify(details) === JSON.stringify(parseDetails(row))
    ) {
      return;
    }
    upd.run(desc, badge, JSON.stringify(details), nowIso(), row.id);
    n += 1;
  });
  if (n) console.log('Renamed cabinet copy to panel on ' + n + ' products');
}

function parseJson(value, fallback) {
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value || '');
  } catch {
    return fallback;
  }
}

function parseDetails(row) {
  const raw = row && row.details;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  const d = parseJson(raw, {});
  return d && typeof d === 'object' && !Array.isArray(d) ? d : {};
}

function mergeProductDetails(current, incoming) {
  const cur = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
  const extra = incoming && typeof incoming === 'object' && !Array.isArray(incoming) ? incoming : {};
  const next = Object.assign({}, extra, cur);
  if (!(cur.cats && cur.cats.length) && extra.cats) next.cats = extra.cats;
  ['specTable', 'lead', 'sourceUrl', 'features'].forEach(function (k) {
    if ((cur[k] == null || (Array.isArray(cur[k]) && !cur[k].length)) && extra[k] != null) next[k] = extra[k];
  });
  return next;
}

function isControlRow(row, details) {
  const type = String((row && row.type) || '').toLowerCase();
  return type === 'control' || (row && row.brand_id === 'novastar') || !!(details && details.subtype);
}

function rowToProduct(row, brand) {
  const pitches = parseJson(row.pitches, []);
  const gallery = parseJson(row.gallery, []);
  const details = rewriteCabinetCopy(parseDetails(row));
  const control = isControlRow(row, details);
  const unitPrice = control
    ? (Number(details.priceEach != null ? details.priceEach : row.price_per_m2) || 0)
    : (Number(row.price_per_m2) || 0);
  const product = {
    dbId: row.id,
    id: row.series_id,
    brandId: row.brand_id,
    brandName: brand ? brand.name : row.brand_id,
    name: row.name,
    pitches: pitches,
    pricePerM2: row.price_per_m2,
    weightPerM2: row.weight_per_m2,
    powerAvg: row.power_avg,
    powerMax: row.power_max,
    cabinetW: row.cabinet_w,
    cabinetH: row.cabinet_h,
    type: control ? 'control' : (row.type || 'Fixed'),
    description: rewriteCabinetCopy(row.description || ''),
    badge: row.badge ? rewriteCabinetCopy(row.badge) : null,
    image: row.image || '',
    gallery: gallery,
    details: details,
    cats: Array.isArray(details.cats) ? details.cats : [],
    pitchLabel: pitches.length
      ? pitches[0] + (pitches.length > 1 ? '–' + pitches[pitches.length - 1] : '') + ' mm'
      : (control ? (details.family || 'Control') : ''),
    priceLabel: unitPrice ? 'From $' + Number(unitPrice).toLocaleString() : 'Request quote'
  };
  if (control) product.priceEach = unitPrice;
  ['specTable', 'lead', 'sourceUrl', 'features'].concat(CONTROL_DETAIL_KEYS).forEach(function (k) {
    if (details[k] != null) product[k] = details[k];
  });
  return product;
}

function getCatalog(db) {
  const brands = db.prepare('SELECT id, name, tagline FROM brands ORDER BY name').all();
  const products = db.prepare('SELECT * FROM products ORDER BY sort_order, name').all();
  const byBrand = {};
  brands.forEach((b) => {
    byBrand[b.id] = { name: b.name, tagline: b.tagline || '', series: [] };
  });
  products.forEach((row) => {
    if (!byBrand[row.brand_id]) {
      byBrand[row.brand_id] = { name: row.brand_id, tagline: '', series: [] };
    }
    const item = rowToProduct(row, { name: byBrand[row.brand_id].name });
    byBrand[row.brand_id].series.push(item);
  });
  Object.keys(byBrand).forEach(function (id) {
    const brand = byBrand[id];
    if (id === 'novastar' || (brand.series || []).some(function (s) { return s.type === 'control'; })) {
      brand.kind = 'control';
    }
  });
  return byBrand;
}

function listProducts(db) {
  const brands = {};
  db.prepare('SELECT id, name FROM brands').all().forEach((b) => { brands[b.id] = b; });
  return db.prepare('SELECT * FROM products ORDER BY brand_id, sort_order, name').all()
    .map((row) => rowToProduct(row, brands[row.brand_id]));
}

function getProduct(db, id) {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!row) return null;
  const brand = db.prepare('SELECT id, name FROM brands WHERE id = ?').get(row.brand_id);
  return rowToProduct(row, brand);
}

module.exports = {
  openDb,
  seedAdmin,
  seedCatalog,
  upsertMissingCatalog,
  loadSeedBrands,
  detailsFromSeries,
  fillMissingProductDetails,
  rewriteCabinetCopy,
  rewriteExistingCabinetCopy,
  getCatalog,
  listProducts,
  getProduct,
  rowToProduct,
  parseDetails,
  mergeProductDetails,
  nowIso,
  parseJson
};
