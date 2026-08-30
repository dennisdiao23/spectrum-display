const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dbUtil = require('./db');

const ROOT = path.join(__dirname, '..');
const UPLOAD_DIR = path.join(ROOT, 'uploads', 'products');

function inventoryMapRows(db) {
  return db.prepare(`
    SELECT m.product_id, m.pitch, m.item_id, p.name AS product_name, p.series_id, p.brand_id
    FROM product_inventory_map m
    JOIN products p ON p.id = m.product_id
  `).all();
}

function attachInventoryToCatalog(db, catalog) {
  const inv = require('./inventory');
  let items = [];
  let maps = [];
  try {
    items = db.prepare('SELECT * FROM inventory_items').all();
    maps = db.prepare('SELECT * FROM product_inventory_map').all();
  } catch (e) {
    return catalog;
  }
  return inv.applyToCatalog(catalog, maps, items);
}

function attachMapsToListedProducts(db, products) {
  const inv = require('./inventory');
  let maps = [];
  try {
    maps = db.prepare('SELECT product_id, pitch, item_id FROM product_inventory_map').all();
  } catch (e) {
    return products;
  }
  return inv.attachMapsToProducts(products, maps);
}

function listInventoryItems(db) {
  const inv = require('./inventory');
  const brands = {};
  db.prepare('SELECT id, name FROM brands').all().forEach(function (b) { brands[b.id] = b.name; });
  const items = db.prepare('SELECT * FROM inventory_items ORDER BY name COLLATE NOCASE, pitch').all();
  const byItem = inv.mapsByItem(inventoryMapRows(db));
  return items.map(function (row) {
    return inv.formatItem(row, brands[row.brand_id], byItem[String(row.id)] || []);
  });
}

function getInventoryItemDetail(db, id) {
  const inv = require('./inventory');
  const row = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(id);
  if (!row) return null;
  const brand = row.brand_id
    ? db.prepare('SELECT name FROM brands WHERE id = ?').get(row.brand_id)
    : null;
  const maps = db.prepare(`
    SELECT m.product_id, m.pitch, m.item_id, p.name AS product_name, p.series_id, p.brand_id
    FROM product_inventory_map m
    JOIN products p ON p.id = m.product_id
    WHERE m.item_id = ?
  `).all(id);
  const byItem = inv.mapsByItem(maps);
  const moves = db.prepare(
    'SELECT * FROM inventory_item_moves WHERE item_id = ? ORDER BY datetime(created_at) DESC, id DESC LIMIT 40'
  ).all(id);
  return { item: inv.formatItem(row, brand && brand.name, byItem[String(row.id)] || []), moves: moves };
}

function createSqliteStore() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const db = dbUtil.openDb();
  dbUtil.seedAdmin(db);
  dbUtil.seedCatalog(db);
  dbUtil.fillMissingProductDetails(db);
  dbUtil.rewriteExistingCabinetCopy(db);
  dbUtil.ensureCatalogSkus(db);

  return {
    name: 'sqlite',
    async getCatalog() {
      const catalog = dbUtil.getCatalog(db);
      attachInventoryToCatalog(db, catalog);
      return catalog;
    },
    async getCatalogStock() {
      const inv = require('./inventory');
      try {
        const items = db.prepare('SELECT * FROM inventory_items').all();
        const maps = db.prepare('SELECT * FROM product_inventory_map').all();
        return inv.catalogStock(maps, items);
      } catch {
        return {};
      }
    },
    async listProducts() {
      const products = dbUtil.listProducts(db);
      attachMapsToListedProducts(db, products);
      return products;
    },
    async getProduct(id) {
      const product = dbUtil.getProduct(db, id);
      if (!product) return null;
      attachMapsToListedProducts(db, [product]);
      return product;
    },
    async getProductByBrandSeries(brand, series) {
      const row = db.prepare('SELECT * FROM products WHERE brand_id = ? AND series_id = ?').get(brand, series);
      if (!row) return null;
      return dbUtil.getProduct(db, row.id);
    },
    async listBrands() {
      return db.prepare('SELECT id, name, tagline FROM brands ORDER BY name').all();
    },
    async ensureBrand(id, name, tagline) {
      const existing = db.prepare('SELECT id FROM brands WHERE id = ?').get(id);
      if (!existing) {
        db.prepare('INSERT INTO brands (id, name, tagline) VALUES (?, ?, ?)').run(id, name || id, tagline || '');
      } else if (name) {
        db.prepare('UPDATE brands SET name = COALESCE(?, name), tagline = COALESCE(?, tagline) WHERE id = ?')
          .run(name, tagline == null ? null : tagline, id);
      }
      return id;
    },
    async insertProduct(p) {
      const stamp = dbUtil.nowIso();
      const info = db.prepare(`
        INSERT INTO products (
          brand_id, series_id, name, pitches, price_per_m2, weight_per_m2,
          power_avg, power_max, cabinet_w, cabinet_h, type, description, badge,
          image, gallery, details, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `).run(
        p.brandId, p.seriesId, p.name, JSON.stringify(p.pitches), p.price, p.weight,
        p.powerAvg, p.powerMax, p.cabinetW, p.cabinetH, p.type, p.description, p.badge,
        p.image, JSON.stringify(p.gallery), JSON.stringify(p.details || {}), stamp, stamp
      );
      return dbUtil.getProduct(db, info.lastInsertRowid);
    },
    async updateProduct(id, p) {
      db.prepare(`
        UPDATE products SET
          brand_id = ?, series_id = ?, name = ?, pitches = ?, price_per_m2 = ?,
          weight_per_m2 = ?, power_avg = ?, power_max = ?, cabinet_w = ?, cabinet_h = ?,
          type = ?, description = ?, badge = ?, image = ?, gallery = ?, details = ?, updated_at = ?
        WHERE id = ?
      `).run(
        p.brandId, p.seriesId, p.name, JSON.stringify(p.pitches), p.price, p.weight,
        p.powerAvg, p.powerMax, p.cabinetW, p.cabinetH, p.type, p.description, p.badge,
        p.image, JSON.stringify(p.gallery), JSON.stringify(p.details || {}), dbUtil.nowIso(), id
      );
      return dbUtil.getProduct(db, id);
    },
    async deleteProduct(id) {
      const info = db.prepare('DELETE FROM products WHERE id = ?').run(id);
      return info.changes > 0;
    },
    async setProductHidden(id, hidden) {
      const info = db.prepare('UPDATE products SET hidden = ?, updated_at = ? WHERE id = ?')
        .run(hidden ? 1 : 0, dbUtil.nowIso(), id);
      if (!info.changes) return null;
      const product = dbUtil.getProduct(db, id);
      if (product) attachMapsToListedProducts(db, [product]);
      return product;
    },
    async getRawProduct(id) {
      return db.prepare('SELECT * FROM products WHERE id = ?').get(id) || null;
    },
    async getAdminByEmail(email) {
      return db.prepare('SELECT * FROM admins WHERE email = ?').get(email) || null;
    },
    async createSession(token, adminId, expiresAt) {
      db.prepare('INSERT INTO sessions (token, admin_id, expires_at) VALUES (?, ?, ?)').run(token, adminId, expiresAt);
    },
    async getSession(token) {
      return db.prepare(`
        SELECT a.id, a.email, a.name, s.expires_at
        FROM sessions s JOIN admins a ON a.id = s.admin_id
        WHERE s.token = ?
      `).get(token) || null;
    },
    async deleteSession(token) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    },
    async listAccounts() {
      return [];
    },
    async getAccount() {
      return null;
    },
    async updateAccount() {
      throw new Error('Account management requires Supabase.');
    },
    async listPriceTiers() {
      return { customer: 0, dealer: 0, sales: 0 };
    },
    async savePriceTiers() {
      throw new Error('Price tiers require Supabase.');
    },
    async setAccountMarkup() {
      throw new Error('Account markup requires Supabase.');
    },
    async saveContactInquiry() {
      return true;
    },
    async listInventory() {
      return listInventoryItems(db);
    },
    async getInventoryItem(id) {
      return getInventoryItemDetail(db, id);
    },
    async createInventoryItem(payload) {
      const inv = require('./inventory');
      const input = inv.normalizeItemInput(payload);
      const taken = {};
      db.prepare('SELECT sku FROM inventory_items').all().forEach(function (r) {
        if (r.sku) taken[inv.normalizeSku(r.sku)] = true;
      });
      input.sku = inv.uniqueSku(input.sku || inv.suggestedSku({
        brandId: input.brandId,
        name: input.name,
        pitch: input.pitch
      }), taken);
      const stamp = dbUtil.nowIso();
      const fields = inv.dbFieldsFromInput(input);
      const info = db.prepare(`
        INSERT INTO inventory_items (
          sku, name, brand_id, pitch, unit, qty, low_at, price, cost, dealer_net,
          weight, panel_w, panel_h, description, image, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        fields.sku, fields.name, fields.brand_id, fields.pitch, fields.unit, fields.qty,
        fields.low_at, fields.price, fields.cost, fields.dealer_net, fields.weight,
        fields.panel_w, fields.panel_h, fields.description, fields.image, fields.notes,
        stamp, stamp
      );
      if (input.qty) {
        db.prepare(`
          INSERT INTO inventory_item_moves (
            item_id, kind, qty_delta, qty_after, note, admin_email, created_at
          ) VALUES (?, 'count', ?, ?, 'Opening qty', '', ?)
        `).run(info.lastInsertRowid, input.qty, input.qty, stamp);
      }
      return getInventoryItemDetail(db, info.lastInsertRowid);
    },
    async updateInventoryItem(id, payload) {
      const inv = require('./inventory');
      const current = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(id);
      if (!current) return null;
      const input = inv.normalizeItemInput(payload, { patch: true });
      const next = {
        sku: input.sku != null && input.sku !== '' ? input.sku : (current.sku || ''),
        name: input.name != null ? input.name : current.name,
        brandId: input.brandId != null ? input.brandId : (current.brand_id || ''),
        pitch: input.pitch != null ? input.pitch : inv.pitchKey(current.pitch),
        unit: input.unit != null ? input.unit : inv.unitOf(current.unit),
        lowAt: input.lowAt != null ? input.lowAt : Number(current.low_at),
        price: input.price != null ? input.price : Number(current.price) || 0,
        cost: input.cost != null ? input.cost : Number(current.cost) || 0,
        dealerNet: input.dealerNet != null ? input.dealerNet : Number(current.dealer_net) || 0,
        weight: input.weight != null ? input.weight : Number(current.weight) || 0,
        panelW: input.panelW != null ? input.panelW : Number(current.panel_w) || 0,
        panelH: input.panelH != null ? input.panelH : Number(current.panel_h) || 0,
        description: input.description != null ? input.description : (current.description || ''),
        image: input.image != null ? input.image : (current.image || ''),
        notes: input.notes != null ? input.notes : (current.notes || '')
      };
      if (!next.sku) {
        next.sku = inv.suggestedSku({ brandId: next.brandId, name: next.name, pitch: next.pitch });
      }
      const clash = db.prepare('SELECT id FROM inventory_items WHERE sku = ? AND id != ?').get(next.sku, id);
      if (clash) throw new Error('That SKU is already in use.');
      db.prepare(`
        UPDATE inventory_items SET
          sku = ?, name = ?, brand_id = ?, pitch = ?, unit = ?, low_at = ?, price = ?,
          cost = ?, dealer_net = ?, weight = ?, panel_w = ?, panel_h = ?,
          description = ?, image = ?, notes = ?, updated_at = ?
        WHERE id = ?
      `).run(
        next.sku, next.name, next.brandId, next.pitch, next.unit, next.lowAt, next.price,
        next.cost, next.dealerNet, next.weight, next.panelW, next.panelH,
        next.description, next.image, next.notes, dbUtil.nowIso(), id
      );
      return getInventoryItemDetail(db, id);
    },
    async deleteInventoryItem(id) {
      const inv = require('./inventory');
      const current = db.prepare('SELECT qty FROM inventory_items WHERE id = ?').get(id);
      if (!current) return false;
      const history = db.prepare('SELECT COUNT(*) AS n FROM inventory_item_moves WHERE item_id = ?').get(id).n;
      inv.assertCanDelete(current, history);
      const info = db.prepare('DELETE FROM inventory_items WHERE id = ?').run(id);
      return info.changes > 0;
    },
    async adjustInventory(id, payload, adminEmail) {
      const inv = require('./inventory');
      const current = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(id);
      if (!current) return null;
      const curQty = Math.max(0, Number(current.qty) || 0);
      const nextLow = payload && payload.lowAt != null && payload.lowAt !== ''
        ? Math.max(0, Math.round(Number(payload.lowAt)))
        : Number(current.low_at);
      if (!isFinite(nextLow)) throw new Error('Low-at must be a number.');
      const change = inv.applyKind(payload && payload.kind, payload && payload.qty, curQty);
      const stamp = dbUtil.nowIso();
      db.exec('BEGIN');
      try {
        db.prepare(
          'UPDATE inventory_items SET qty = ?, low_at = ?, updated_at = ? WHERE id = ?'
        ).run(change.next, nextLow, stamp, id);
        db.prepare(`
          INSERT INTO inventory_item_moves (
            item_id, kind, qty_delta, qty_after, note, admin_email, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          String(payload.kind || '').toLowerCase(),
          change.delta,
          change.next,
          String((payload && payload.note) || '').trim().slice(0, 240),
          String(adminEmail || '').trim().slice(0, 120),
          stamp
        );
        db.exec('COMMIT');
      } catch (err) {
        try { db.exec('ROLLBACK'); } catch (e) { /* ignore */ }
        throw err;
      }
      return getInventoryItemDetail(db, id);
    },
    async setProductInventoryMaps(productId, maps) {
      const inv = require('./inventory');
      const product = dbUtil.getProduct(db, productId);
      if (!product) return null;
      const rows = inv.normalizeMaps(maps);
      db.exec('BEGIN');
      try {
        db.prepare('DELETE FROM product_inventory_map WHERE product_id = ?').run(productId);
        const insert = db.prepare(
          'INSERT INTO product_inventory_map (product_id, pitch, item_id) VALUES (?, ?, ?)'
        );
        rows.forEach(function (row) {
          const item = db.prepare('SELECT id FROM inventory_items WHERE id = ?').get(row.itemId);
          if (!item) throw new Error('Inventory item not found.');
          insert.run(productId, row.pitch, row.itemId);
        });
        db.exec('COMMIT');
      } catch (err) {
        try { db.exec('ROLLBACK'); } catch (e) { /* ignore */ }
        throw err;
      }
      const updated = dbUtil.getProduct(db, productId);
      attachMapsToListedProducts(db, [updated]);
      return updated;
    },
    async saveUpload(file) {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.jpg';
      const name = Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex') + safeExt;
      fs.writeFileSync(path.join(UPLOAD_DIR, name), file.buffer);
      return '/uploads/products/' + name;
    }
  };
}

module.exports = { createSqliteStore };
