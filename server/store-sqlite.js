const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dbUtil = require('./db');

const ROOT = path.join(__dirname, '..');
const UPLOAD_DIR = path.join(ROOT, 'uploads', 'products');

function createSqliteStore() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const db = dbUtil.openDb();
  dbUtil.seedAdmin(db);
  dbUtil.seedCatalog(db);
  dbUtil.fillMissingProductDetails(db);
  dbUtil.rewriteExistingCabinetCopy(db);

  return {
    name: 'sqlite',
    async getCatalog() { return dbUtil.getCatalog(db); },
    async listProducts() { return dbUtil.listProducts(db); },
    async getProduct(id) { return dbUtil.getProduct(db, id); },
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
      const inv = require('./inventory');
      const products = dbUtil.listProducts(db);
      const stocks = db.prepare('SELECT * FROM inventory_stock').all();
      const byProduct = {};
      stocks.forEach(function (row) {
        const key = String(row.product_id);
        (byProduct[key] = byProduct[key] || []).push(row);
      });
      return products.map(function (p) {
        return inv.inventoryItem(p, byProduct[String(p.dbId)] || []);
      });
    },
    async getInventoryProduct(id) {
      const inv = require('./inventory');
      const product = dbUtil.getProduct(db, id);
      if (!product) return null;
      const stocks = db.prepare('SELECT * FROM inventory_stock WHERE product_id = ?').all(id);
      const moves = db.prepare(
        'SELECT * FROM inventory_moves WHERE product_id = ? ORDER BY datetime(created_at) DESC, id DESC LIMIT 40'
      ).all(id);
      return { item: inv.inventoryItem(product, stocks), moves: moves };
    },
    async adjustInventory(id, payload, adminEmail) {
      const inv = require('./inventory');
      const product = dbUtil.getProduct(db, id);
      if (!product) return null;
      const pitch = inv.pitchKey(payload && payload.pitch);
      const control = inv.isControlProduct(product);
      if (!control) {
        const allowed = (product.pitches || []).map(inv.pitchKey);
        if (pitch && allowed.indexOf(pitch) === -1) {
          throw new Error('That pitch is not on this series.');
        }
      } else if (pitch) {
        throw new Error('Control gear is stocked as each, not by pitch.');
      }
      const current = db.prepare(
        'SELECT qty, low_at FROM inventory_stock WHERE product_id = ? AND pitch = ?'
      ).get(id, pitch);
      const curQty = current ? Number(current.qty) || 0 : 0;
      const nextLow = payload && payload.lowAt != null && payload.lowAt !== ''
        ? Math.max(0, Math.round(Number(payload.lowAt)))
        : (current && current.low_at != null ? Number(current.low_at) : inv.defaultLowAt(control));
      if (!isFinite(nextLow)) throw new Error('Low-at must be a number.');
      const change = inv.applyKind(payload && payload.kind, payload && payload.qty, curQty);
      const stamp = dbUtil.nowIso();
      db.exec('BEGIN');
      try {
        db.prepare(`
          INSERT INTO inventory_stock (product_id, pitch, qty, low_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(product_id, pitch) DO UPDATE SET
            qty = excluded.qty, low_at = excluded.low_at, updated_at = excluded.updated_at
        `).run(id, pitch, change.next, nextLow, stamp);
        db.prepare(`
          INSERT INTO inventory_moves (
            product_id, pitch, kind, qty_delta, qty_after, note, admin_email, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          pitch,
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
      return this.getInventoryProduct(id);
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
