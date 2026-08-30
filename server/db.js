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
  try { db.exec('PRAGMA foreign_keys = ON'); } catch (e) { /* ignore */ }
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'owner',
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
      hidden INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (brand_id, series_id),
      FOREIGN KEY (brand_id) REFERENCES brands(id)
    );
  `);
  try { db.exec("ALTER TABLE products ADD COLUMN details TEXT NOT NULL DEFAULT '{}'"); } catch (e) { /* already present */ }
  try { db.exec('ALTER TABLE products ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0'); } catch (e) { /* already present */ }
  try { db.exec("ALTER TABLE admins ADD COLUMN role TEXT NOT NULL DEFAULT 'owner'"); } catch (e) { /* already present */ }
  seedAdminRoles(db);
  ensureCompanyCustomers(db);
  ensureCompanySales(db);
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      pitch TEXT NOT NULL DEFAULT '',
      qty INTEGER NOT NULL DEFAULT 0,
      low_at INTEGER NOT NULL DEFAULT 8,
      updated_at TEXT NOT NULL,
      UNIQUE (product_id, pitch),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS inventory_moves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      pitch TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL,
      qty_delta INTEGER NOT NULL,
      qty_after INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      admin_email TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS inventory_stock_product_idx ON inventory_stock (product_id);
    CREATE INDEX IF NOT EXISTS inventory_moves_product_idx ON inventory_moves (product_id, created_at);
    CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      brand_id TEXT NOT NULL DEFAULT '',
      pitch TEXT NOT NULL DEFAULT '',
      unit TEXT NOT NULL DEFAULT 'panels',
      qty INTEGER NOT NULL DEFAULT 0,
      low_at INTEGER NOT NULL DEFAULT 8,
      price REAL NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS inventory_item_moves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      qty_delta INTEGER NOT NULL,
      qty_after INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      admin_email TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS product_inventory_map (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      pitch TEXT NOT NULL DEFAULT '',
      item_id INTEGER NOT NULL,
      UNIQUE (product_id, pitch),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS inventory_items_brand_idx ON inventory_items (brand_id, name);
    CREATE INDEX IF NOT EXISTS inventory_item_moves_item_idx ON inventory_item_moves (item_id, created_at);
    CREATE INDEX IF NOT EXISTS product_inventory_map_item_idx ON product_inventory_map (item_id);
  `);
  try { db.exec("ALTER TABLE inventory_items ADD COLUMN sku TEXT NOT NULL DEFAULT ''"); } catch (e) { /* already present */ }
  [
    "ALTER TABLE inventory_items ADD COLUMN description TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE inventory_items ADD COLUMN cost REAL NOT NULL DEFAULT 0",
    "ALTER TABLE inventory_items ADD COLUMN dealer_net REAL NOT NULL DEFAULT 0",
    "ALTER TABLE inventory_items ADD COLUMN weight REAL NOT NULL DEFAULT 0",
    "ALTER TABLE inventory_items ADD COLUMN panel_w REAL NOT NULL DEFAULT 0",
    "ALTER TABLE inventory_items ADD COLUMN panel_h REAL NOT NULL DEFAULT 0",
    "ALTER TABLE inventory_items ADD COLUMN image TEXT NOT NULL DEFAULT ''"
  ].forEach(function (sql) {
    try { db.exec(sql); } catch (e) { /* already present */ }
  });
  migrateLegacyInventory(db);
  return db;
}

function migrateLegacyInventory(db) {
  const inv = require('./inventory');
  let itemCount = 0;
  try {
    itemCount = db.prepare('SELECT COUNT(*) AS n FROM inventory_items').get().n;
  } catch (e) {
    return;
  }
  if (itemCount) return;
  let stocks = [];
  try {
    stocks = db.prepare('SELECT * FROM inventory_stock').all();
  } catch (e) {
    return;
  }
  if (!stocks.length) return;
  const products = {};
  listProducts(db).forEach(function (p) { products[String(p.dbId)] = p; });
  const stamp = nowIso();
  const keyToItemId = {};
  db.exec('BEGIN');
  try {
    stocks.forEach(function (row) {
      const product = products[String(row.product_id)];
      const pitch = inv.pitchKey(row.pitch);
      const control = product ? inv.isControlProduct(product) : !pitch;
      const unit = control ? 'each' : 'panels';
      const name = product ? inv.skuNameFromProduct(product, pitch) : ('Item ' + row.product_id);
      const info = db.prepare(`
        INSERT INTO inventory_items (
          sku, name, brand_id, pitch, unit, qty, low_at, price, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)
      `).run(
        inv.suggestedSku({
          brandId: product && product.brandId,
          seriesId: product && product.id,
          name: name,
          pitch: pitch
        }),
        name,
        product ? (product.brandId || '') : '',
        pitch,
        unit,
        Math.max(0, Number(row.qty) || 0),
        row.low_at != null ? Number(row.low_at) : inv.defaultLowAt(unit),
        inv.priceFromProduct(product),
        row.updated_at || stamp,
        stamp
      );
      const itemId = info.lastInsertRowid;
      keyToItemId[String(row.product_id) + '|' + pitch] = itemId;
      if (product) {
        db.prepare(
          'INSERT OR IGNORE INTO product_inventory_map (product_id, pitch, item_id) VALUES (?, ?, ?)'
        ).run(row.product_id, pitch, itemId);
      }
    });
    let moves = [];
    try {
      moves = db.prepare('SELECT * FROM inventory_moves ORDER BY id').all();
    } catch (e) { /* ignore */ }
    moves.forEach(function (m) {
      const itemId = keyToItemId[String(m.product_id) + '|' + inv.pitchKey(m.pitch)];
      if (!itemId) return;
      db.prepare(`
        INSERT INTO inventory_item_moves (
          item_id, kind, qty_delta, qty_after, note, admin_email, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        itemId,
        String(m.kind || ''),
        Number(m.qty_delta) || 0,
        Number(m.qty_after) || 0,
        m.note || '',
        m.admin_email || '',
        m.created_at || stamp
      );
    });
    db.exec('COMMIT');
    console.log('Migrated ' + stocks.length + ' catalog stock bins into inventory items');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (e) { /* ignore */ }
    console.error('Could not migrate inventory bins:', err.message || err);
  }
}

function fillEmptySkus(db) {
  const inv = require('./inventory');
  const items = db.prepare('SELECT id, sku, name, brand_id, pitch FROM inventory_items').all();
  const taken = {};
  items.forEach(function (row) {
    const sku = inv.normalizeSku(row.sku);
    if (sku) taken[sku] = true;
  });
  const update = db.prepare('UPDATE inventory_items SET sku = ?, updated_at = ? WHERE id = ?');
  const stamp = nowIso();
  items.forEach(function (row) {
    if (inv.normalizeSku(row.sku)) return;
    const sku = inv.uniqueSku(inv.suggestedSku({
      brandId: row.brand_id,
      name: row.name,
      pitch: row.pitch
    }), taken);
    taken[sku] = true;
    update.run(sku, stamp, row.id);
  });
}

function ensureCatalogSkus(db) {
  const inv = require('./inventory');
  fillEmptySkus(db);
  const maps = db.prepare('SELECT product_id, pitch FROM product_inventory_map').all();
  const skus = db.prepare('SELECT sku FROM inventory_items').all().map(function (r) { return r.sku; });
  const plan = inv.catalogSkuPlan(listProducts(db), maps, skus);
  if (!plan.length) {
    try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_sku_uidx ON inventory_items (sku)'); } catch (e) { /* ignore */ }
    return plan.length;
  }
  const stamp = nowIso();
  const insertItem = db.prepare(`
    INSERT INTO inventory_items (
      sku, name, brand_id, pitch, unit, qty, low_at, price, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, '', ?, ?)
  `);
  const insertMap = db.prepare(
    'INSERT OR IGNORE INTO product_inventory_map (product_id, pitch, item_id) VALUES (?, ?, ?)'
  );
  db.exec('BEGIN');
  try {
    plan.forEach(function (row) {
      const info = insertItem.run(
        row.sku, row.name, row.brandId, row.pitch, row.unit, row.lowAt, row.price, stamp, stamp
      );
      insertMap.run(row.productId, row.pitch, info.lastInsertRowid);
    });
    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (e) { /* ignore */ }
    console.error('Could not seed inventory SKUs:', err.message || err);
    return 0;
  }
  try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_sku_uidx ON inventory_items (sku)'); } catch (e) { /* ignore */ }
  console.log('Created ' + plan.length + ' inventory SKUs from website products');
  return plan.length;
}

function seedAdminRoles(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      website_access TEXT NOT NULL DEFAULT 'none',
      inventory_access TEXT NOT NULL DEFAULT 'none',
      locked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);
  const count = db.prepare('SELECT COUNT(*) AS n FROM admin_roles').get();
  if (count && count.n) return;
  const stamp = nowIso();
  const insert = db.prepare(
    'INSERT INTO admin_roles (slug, name, website_access, inventory_access, locked, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  insert.run('owner', 'Owner', 'edit', 'edit', 1, stamp);
  insert.run('website', 'Website', 'edit', 'view', 0, stamp);
  insert.run('inventory', 'Inventory', 'none', 'edit', 0, stamp);
}

function ensureCompanyCustomers(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS company_customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL DEFAULT '',
      contact_first TEXT NOT NULL DEFAULT '',
      contact_last TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      mobile TEXT NOT NULL DEFAULT '',
      website TEXT NOT NULL DEFAULT '',
      tax_id TEXT NOT NULL DEFAULT '',
      payment_terms TEXT NOT NULL DEFAULT 'Net 30',
      bill_street TEXT NOT NULL DEFAULT '',
      bill_city TEXT NOT NULL DEFAULT '',
      bill_state TEXT NOT NULL DEFAULT '',
      bill_zip TEXT NOT NULL DEFAULT '',
      bill_country TEXT NOT NULL DEFAULT 'United States',
      ship_same INTEGER NOT NULL DEFAULT 1,
      ship_street TEXT NOT NULL DEFAULT '',
      ship_city TEXT NOT NULL DEFAULT '',
      ship_state TEXT NOT NULL DEFAULT '',
      ship_zip TEXT NOT NULL DEFAULT '',
      ship_country TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS company_customers_name_idx ON company_customers (company_name, contact_last);
  `);
}

function ensureCompanySales(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS company_sales_docs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      number TEXT NOT NULL UNIQUE,
      customer_id INTEGER,
      customer_name TEXT NOT NULL DEFAULT '',
      customer_email TEXT NOT NULL DEFAULT '',
      po_number TEXT NOT NULL DEFAULT '',
      issue_date TEXT NOT NULL DEFAULT '',
      due_date TEXT NOT NULL DEFAULT '',
      payment_terms TEXT NOT NULL DEFAULT 'Net 30',
      status TEXT NOT NULL DEFAULT 'draft',
      tax_rate REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      bill_street TEXT NOT NULL DEFAULT '',
      bill_city TEXT NOT NULL DEFAULT '',
      bill_state TEXT NOT NULL DEFAULT '',
      bill_zip TEXT NOT NULL DEFAULT '',
      bill_country TEXT NOT NULL DEFAULT 'United States',
      ship_street TEXT NOT NULL DEFAULT '',
      ship_city TEXT NOT NULL DEFAULT '',
      ship_state TEXT NOT NULL DEFAULT '',
      ship_zip TEXT NOT NULL DEFAULT '',
      ship_country TEXT NOT NULL DEFAULT 'United States',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS company_sales_docs_type_idx ON company_sales_docs (type, issue_date);
    CREATE TABLE IF NOT EXISTS company_sales_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_id INTEGER NOT NULL,
      sku TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      qty REAL NOT NULL DEFAULT 0,
      unit_price REAL NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (doc_id) REFERENCES company_sales_docs(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS company_sales_lines_doc_idx ON company_sales_lines (doc_id, sort_order);
  `);
}

function seedAdmin(db) {
  const row = db.prepare('SELECT id FROM admins LIMIT 1').get();
  if (row) return;
  const email = (process.env.ADMIN_EMAIL || 'admin@spectrumdisplay.com').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe!Admin';
  const name = process.env.ADMIN_NAME || 'Spectrum Admin';
  db.prepare(
    'INSERT INTO admins (email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(email, name, bcrypt.hashSync(password, 10), 'owner', nowIso());
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

function isProductHidden(row) {
  if (!row) return false;
  return row.hidden === true || row.hidden === 1 || Number(row.hidden) === 1;
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
    hidden: isProductHidden(row),
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
    if (isProductHidden(row)) return;
    if (!byBrand[row.brand_id]) {
      byBrand[row.brand_id] = { name: row.brand_id, tagline: '', series: [] };
    }
    const item = rowToProduct(row, { name: byBrand[row.brand_id].name });
    byBrand[row.brand_id].series.push(item);
  });
  Object.keys(byBrand).forEach(function (id) {
    if (!(byBrand[id].series && byBrand[id].series.length)) delete byBrand[id];
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
  seedAdminRoles,
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
  isProductHidden,
  parseDetails,
  mergeProductDetails,
  nowIso,
  parseJson,
  ensureCatalogSkus,
  ensureCompanyCustomers,
  ensureCompanySales
};
