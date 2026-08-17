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
          image, gallery, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `).run(
        p.brandId, p.seriesId, p.name, JSON.stringify(p.pitches), p.price, p.weight,
        p.powerAvg, p.powerMax, p.cabinetW, p.cabinetH, p.type, p.description, p.badge,
        p.image, JSON.stringify(p.gallery), stamp, stamp
      );
      return dbUtil.getProduct(db, info.lastInsertRowid);
    },
    async updateProduct(id, p) {
      db.prepare(`
        UPDATE products SET
          brand_id = ?, series_id = ?, name = ?, pitches = ?, price_per_m2 = ?,
          weight_per_m2 = ?, power_avg = ?, power_max = ?, cabinet_w = ?, cabinet_h = ?,
          type = ?, description = ?, badge = ?, image = ?, gallery = ?, updated_at = ?
        WHERE id = ?
      `).run(
        p.brandId, p.seriesId, p.name, JSON.stringify(p.pitches), p.price, p.weight,
        p.powerAvg, p.powerMax, p.cabinetW, p.cabinetH, p.type, p.description, p.badge,
        p.image, JSON.stringify(p.gallery), dbUtil.nowIso(), id
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
