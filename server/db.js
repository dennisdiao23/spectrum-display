const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'spectrum.db');
const SEED_PATH = path.join(__dirname, 'seed-catalog.json');

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
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (brand_id, series_id),
      FOREIGN KEY (brand_id) REFERENCES brands(id)
    );
  `);
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
  const count = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  if (count > 0) return;
  const brands = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  const insertBrand = db.prepare('INSERT OR IGNORE INTO brands (id, name, tagline) VALUES (?, ?, ?)');
  const insertProduct = db.prepare(`
    INSERT INTO products (
      brand_id, series_id, name, pitches, price_per_m2, weight_per_m2,
      power_avg, power_max, cabinet_w, cabinet_h, type, description, badge,
      image, gallery, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?)
  `);
  const stamp = nowIso();
  db.exec('BEGIN');
  try {
    brands.forEach((brand, bi) => {
      insertBrand.run(brand.id, brand.name, brand.tagline || '');
      (brand.series || []).forEach((s, si) => {
        insertProduct.run(
          brand.id,
          s.id,
          s.name,
          JSON.stringify(s.pitches || []),
          s.pricePerM2 || 0,
          s.weightPerM2 || 0,
          s.powerAvg || 0,
          s.powerMax || 0,
          s.cabinetW || 0.5,
          s.cabinetH || 0.5,
          s.type || 'Fixed',
          s.description || '',
          s.badge || '',
          s.image || '',
          bi * 20 + si,
          stamp,
          stamp
        );
      });
    });
    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (e) { /* ignore */ }
    throw err;
  }
  console.log('Seeded product catalog from server/seed-catalog.json');
}

function parseJson(value, fallback) {
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value || '');
  } catch {
    return fallback;
  }
}

function rowToProduct(row, brand) {
  const pitches = parseJson(row.pitches, []);
  const gallery = parseJson(row.gallery, []);
  return {
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
    type: row.type || 'Fixed',
    description: row.description || '',
    badge: row.badge || null,
    image: row.image || '',
    gallery: gallery,
    pitchLabel: pitches.length
      ? pitches[0] + (pitches.length > 1 ? '–' + pitches[pitches.length - 1] : '') + ' mm'
      : '',
    priceLabel: 'From $' + Number(row.price_per_m2 || 0).toLocaleString()
  };
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
  getCatalog,
  listProducts,
  getProduct,
  rowToProduct,
  nowIso,
  parseJson
};
