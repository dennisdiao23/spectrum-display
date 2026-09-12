const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dbUtil = require('./db');
const img = require('./image');

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
  const locs = locationsByItem(db);
  return items.map(function (row) {
    return inv.formatItem(row, brands[row.brand_id], byItem[String(row.id)] || [], locs[String(row.id)] || []);
  });
}

function locationJoinSql() {
  return `
    SELECT l.*, w.name AS warehouse_name, w.type AS warehouse_type, w.vendor_id, w.untracked,
      w.parent_id,
      p.name AS parent_name, p.type AS parent_type, p.vendor_id AS parent_vendor_id, p.untracked AS parent_untracked,
      COALESCE(v.display_name, v.company_name, pv.display_name, pv.company_name, '') AS vendor_name
    FROM inventory_item_locations l
    JOIN inventory_warehouses w ON w.id = l.warehouse_id
    LEFT JOIN inventory_warehouses p ON p.id = w.parent_id
    LEFT JOIN inventory_vendors v ON v.id = w.vendor_id
    LEFT JOIN inventory_vendors pv ON pv.id = p.vendor_id
  `;
}

function locationsByItem(db) {
  const inv = require('./inventory');
  const out = {};
  try {
    db.prepare(locationJoinSql() + ' ORDER BY w.type, w.name COLLATE NOCASE, l.id').all().forEach(function (row) {
      const key = String(row.item_id);
      (out[key] = out[key] || []).push(inv.formatLocation(row));
    });
  } catch (e) { /* tables may not exist yet */ }
  return out;
}

function locationsForItem(db, itemId) {
  const inv = require('./inventory');
  try {
    return db.prepare(locationJoinSql() + ' WHERE l.item_id = ? ORDER BY w.type, w.name COLLATE NOCASE, l.id')
      .all(itemId)
      .map(inv.formatLocation);
  } catch (e) {
    return [];
  }
}

function defaultSpectrumWarehouse(db) {
  const wh = require('./inventory-warehouses');
  const rows = db.prepare(
    'SELECT * FROM inventory_warehouses ORDER BY id'
  ).all();
  const prefer = rows.filter(wh.isHomeWarehouse);
  const row = prefer[0] || rows.filter(function (r) { return !wh.rowUntracked(r) && wh.locationKind(r.type) !== 'bin'; })[0] || rows[0];
  if (!row) throw new Error('Add a tracked location first.');
  return row;
}

function warehouseIsUntracked(db, row) {
  const wh = require('./inventory-warehouses');
  if (!row) return false;
  if (wh.locationKind(row.type) === 'bin' && row.parent_id) {
    const parent = db.prepare('SELECT * FROM inventory_warehouses WHERE id = ?').get(row.parent_id);
    return parent ? wh.rowUntracked(parent) : false;
  }
  return wh.rowUntracked(row);
}

function resolveWarehouse(db, warehouseId, opts) {
  const trackedOnly = !!(opts && (opts.spectrumOnly || opts.trackedOnly));
  if (warehouseId) {
    const row = db.prepare('SELECT * FROM inventory_warehouses WHERE id = ?').get(warehouseId);
    if (!row) throw new Error('Location not found.');
    if (trackedOnly && warehouseIsUntracked(db, row)) return defaultSpectrumWarehouse(db);
    return row;
  }
  return defaultSpectrumWarehouse(db);
}

function countTrackedWarehouses(db, exceptId) {
  const wh = require('./inventory-warehouses');
  return db.prepare('SELECT * FROM inventory_warehouses').all().filter(function (row) {
    if (exceptId != null && String(row.id) === String(exceptId)) return false;
    return wh.isHomeWarehouse(row);
  }).length;
}

function findOrCreateBin(db, parentId, name, stamp) {
  const label = String(name || '').trim();
  if (!label || !parentId) return null;
  const existing = db.prepare(`
    SELECT * FROM inventory_warehouses
    WHERE type = 'bin' AND parent_id = ? AND lower(name) = lower(?)
  `).get(parentId, label);
  if (existing) return existing;
  const info = db.prepare(`
    INSERT INTO inventory_warehouses (
      name, type, parent_id, vendor_id, untracked, notes, street, street2, city, state, zip, country, created_at, updated_at
    ) VALUES (?, 'bin', ?, NULL, 0, '', '', '', '', '', '', '', ?, ?)
  `).run(label, parentId, stamp, stamp);
  return db.prepare('SELECT * FROM inventory_warehouses WHERE id = ?').get(info.lastInsertRowid);
}

function resolveLocationTarget(db, warehouseId, binText) {
  const wh = require('./inventory-warehouses');
  const warehouse = resolveWarehouse(db, warehouseId);
  const bin = String(binText || '').trim();
  if (!bin) return warehouse;
  if (wh.locationKind(warehouse.type) === 'bin') return warehouse;
  return findOrCreateBin(db, warehouse.id, bin, dbUtil.nowIso()) || warehouse;
}

function syncItemSpectrumQty(db, itemId, stamp) {
  const inv = require('./inventory');
  const locs = locationsForItem(db, itemId);
  const qty = inv.spectrumQtyFromLocations(locs);
  db.prepare('UPDATE inventory_items SET qty = ?, updated_at = ? WHERE id = ?').run(qty, stamp, itemId);
  return qty;
}

function upsertItemLocation(db, itemId, warehouseId, bin, qty, stamp) {
  const existing = db.prepare(
    'SELECT * FROM inventory_item_locations WHERE item_id = ? AND warehouse_id = ?'
  ).get(itemId, warehouseId);
  if (existing) {
    db.prepare(
      'UPDATE inventory_item_locations SET bin = ?, qty = ?, updated_at = ? WHERE id = ?'
    ).run(bin == null ? existing.bin : bin, qty, stamp, existing.id);
    return existing.id;
  }
  const info = db.prepare(`
    INSERT INTO inventory_item_locations (item_id, warehouse_id, bin, qty, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(itemId, warehouseId, bin || '', qty, stamp, stamp);
  return info.lastInsertRowid;
}

function applyLocationChange(db, itemId, payload, adminEmail) {
  const inv = require('./inventory');
  const current = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(itemId);
  if (!current) return null;
  const warehouse = resolveWarehouse(db, payload && payload.warehouseId, {
    spectrumOnly: !!(payload && payload.spectrumOnly)
  });
  let loc = db.prepare(
    'SELECT * FROM inventory_item_locations WHERE item_id = ? AND warehouse_id = ?'
  ).get(itemId, warehouse.id);
  if (!loc) {
    const stamp0 = dbUtil.nowIso();
    upsertItemLocation(db, itemId, warehouse.id, '', 0, stamp0);
    loc = db.prepare(
      'SELECT * FROM inventory_item_locations WHERE item_id = ? AND warehouse_id = ?'
    ).get(itemId, warehouse.id);
  }
  const curQty = Math.max(0, Number(loc.qty) || 0);
  const nextLow = payload && payload.lowAt != null && payload.lowAt !== ''
    ? Math.max(0, Math.round(Number(payload.lowAt)))
    : Number(current.low_at);
  if (!isFinite(nextLow)) throw new Error('Low-at must be a number.');
  const change = inv.applyKind(payload && payload.kind, payload && payload.qty, curQty);
  const stamp = dbUtil.nowIso();
  const noteBits = [String((payload && payload.note) || '').trim()].filter(Boolean);
  if (warehouse.name) noteBits.unshift(warehouse.name);
  db.prepare(
    'UPDATE inventory_item_locations SET qty = ?, updated_at = ? WHERE id = ?'
  ).run(change.next, stamp, loc.id);
  db.prepare('UPDATE inventory_items SET low_at = ?, updated_at = ? WHERE id = ?')
    .run(nextLow, stamp, itemId);
  syncItemSpectrumQty(db, itemId, stamp);
  db.prepare(`
    INSERT INTO inventory_item_moves (
      item_id, kind, qty_delta, qty_after, note, admin_email, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    itemId,
    String((payload && payload.kind) || '').toLowerCase(),
    change.delta,
    change.next,
    noteBits.join(' · ').slice(0, 240),
    String(adminEmail || '').trim().slice(0, 120),
    stamp
  );
  return true;
}

function warehouseStats(db) {
  const rows = db.prepare(`
    SELECT
      l.warehouse_id,
      SUM(CASE WHEN l.qty > 0 THEN 1 ELSE 0 END) AS item_count,
      COALESCE(SUM(l.qty), 0) AS qty,
      COALESCE(SUM(
        CASE
          WHEN l.qty > 0 AND COALESCE(i.low_at, 0) > 0 AND l.qty <= i.low_at THEN 1 ELSE 0
        END
      ), 0) AS low_count
    FROM inventory_item_locations l
    JOIN inventory_items i ON i.id = l.item_id
    GROUP BY l.warehouse_id
  `).all();
  const out = {};
  rows.forEach(function (row) {
    out[String(row.warehouse_id)] = {
      itemCount: row.item_count,
      qty: row.qty,
      hasLow: Number(row.low_count) > 0
    };
  });
  return out;
}

function formatWarehouseRow(db, row, allRows, statsMap, vendorNames) {
  const wh = require('./inventory-warehouses');
  if (!row) return null;
  const stats = (statsMap || warehouseStats(db))[String(row.id)] || { itemCount: 0, qty: 0, hasLow: false };
  let vendorName = '';
  const vendorId = row.vendor_id;
  if (vendorId) {
    if (vendorNames && vendorNames[String(vendorId)]) vendorName = vendorNames[String(vendorId)];
    else {
      const vendor = db.prepare('SELECT display_name, company_name FROM inventory_vendors WHERE id = ?').get(vendorId);
      vendorName = vendor ? (vendor.display_name || vendor.company_name || '') : '';
    }
  }
  let parentName = '';
  if (row.parent_id && allRows) {
    const parent = allRows.find(function (r) { return String(r.id) === String(row.parent_id); });
    parentName = parent ? parent.name : '';
  } else if (row.parent_id) {
    const parent = db.prepare('SELECT name FROM inventory_warehouses WHERE id = ?').get(row.parent_id);
    parentName = parent ? parent.name : '';
  }
  return wh.formatWarehouse(row, {
    itemCount: stats.itemCount,
    qty: stats.qty,
    hasLow: stats.hasLow,
    vendorName: vendorName,
    parentName: parentName,
    parentId: row.parent_id || ''
  });
}

function listFormattedWarehouses(db) {
  const wh = require('./inventory-warehouses');
  const rows = db.prepare('SELECT * FROM inventory_warehouses ORDER BY id').all();
  const stats = warehouseStats(db);
  const formatted = rows.map(function (row) { return formatWarehouseRow(db, row, rows, stats); });
  return wh.sortGrouped(wh.decorateWarehouses(formatted));
}

function receiptWarehouseName(db, id) {
  if (!id) return '';
  const row = db.prepare('SELECT name FROM inventory_warehouses WHERE id = ?').get(id);
  return row ? row.name : '';
}

function formatSqliteReceipt(db, row, lines) {
  const rs = require('./receipt-shipments');
  return rs.formatReceipt(row, lines, { warehouseName: receiptWarehouseName(db, row.warehouse_id) });
}

function poWarehouseForShipFrom(db, shipFrom) {
  const po = require('./purchase-orders');
  const id = po.locationIdFromShipFrom(shipFrom);
  if (!id) return null;
  return db.prepare('SELECT * FROM inventory_warehouses WHERE id = ?').get(id);
}

const INVENTORY_BULK_MOVE_KINDS = ['receive'];

function formatInventoryMoveRow(row) {
  return {
    id: row.id,
    itemId: row.item_id,
    itemName: row.item_name || '',
    itemSku: row.item_sku || '',
    kind: row.kind || '',
    qtyDelta: Number(row.qty_delta) || 0,
    qtyAfter: row.qty_after,
    note: row.note || '',
    adminEmail: row.admin_email || '',
    createdAt: row.created_at || ''
  };
}

function listInventoryRecentMoves(db, limit, opts) {
  const exclude = (opts && opts.excludeKinds) || [];
  const cap = Math.max(1, Math.min(Number(limit) || 25, 500));
  let sql = `
    SELECT m.*, i.name AS item_name, i.sku AS item_sku
    FROM inventory_item_moves m
    JOIN inventory_items i ON i.id = m.item_id
  `;
  const params = [];
  if (exclude.length) {
    sql += ' WHERE m.kind NOT IN (' + exclude.map(function () { return '?'; }).join(', ') + ')';
    params.push.apply(params, exclude);
  }
  sql += ' ORDER BY datetime(m.created_at) DESC, m.id DESC LIMIT ?';
  params.push(cap);
  return db.prepare(sql).all(...params).map(formatInventoryMoveRow);
}

function listInventoryActivity(db, limit) {
  const cap = Math.max(1, Math.min(Number(limit) || 25, 100));
  const moves = listInventoryRecentMoves(db, cap * 2, { excludeKinds: INVENTORY_BULK_MOVE_KINDS.slice() });
  const edits = db.prepare(`
    SELECT id, name, sku, updated_at, created_at
    FROM inventory_items
    WHERE datetime(updated_at) > datetime(created_at, '+1 second')
    ORDER BY datetime(updated_at) DESC, id DESC
    LIMIT ?
  `).all(cap * 2);
  const rows = moves.map(function (m) {
    return {
      type: 'move',
      id: 'move-' + m.id,
      itemId: m.itemId,
      itemName: m.itemName,
      itemSku: m.itemSku,
      kind: m.kind,
      qtyDelta: m.qtyDelta,
      qtyAfter: m.qtyAfter,
      note: m.note,
      adminEmail: m.adminEmail,
      createdAt: m.createdAt
    };
  }).concat(edits.map(function (row) {
    return {
      type: 'edit',
      id: 'edit-' + row.id,
      itemId: row.id,
      itemName: row.name || '',
      itemSku: row.sku || '',
      kind: 'edit',
      qtyDelta: 0,
      qtyAfter: null,
      note: 'Item updated',
      adminEmail: '',
      createdAt: row.updated_at || row.created_at || ''
    };
  }));
  rows.sort(function (a, b) {
    return String(b.createdAt).localeCompare(String(a.createdAt));
  });
  return rows.slice(0, cap);
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
  return {
    item: inv.formatItem(row, brand && brand.name, byItem[String(row.id)] || [], locationsForItem(db, id)),
    moves: moves
  };
}

function createSqliteStore() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const db = dbUtil.openDb();
  dbUtil.seedAdmin(db);
  dbUtil.seedCatalog(db);
  dbUtil.fillMissingProductDetails(db);
  dbUtil.refreshSeedProductMedia(db);
  dbUtil.rewriteExistingCabinetCopy(db);
  dbUtil.ensureCatalogSkus(db);
  dbUtil.ensureInventoryWarehouses(db);
  try {
    require('./novastar-price-inventory').applySqlite(db);
  } catch (e) {
    console.error('Could not apply NovaStar price list:', e.message || e);
  }
  try {
    require('./gloshine-price-inventory').applySqlite(db);
  } catch (e) {
    console.error('Could not apply Gloshine LA warehouse list:', e.message || e);
  }

  const api = {
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
        const locs = locationsByItem(db);
        const formatted = items.map(function (row) {
          return inv.formatItem(row, '', [], locs[String(row.id)] || []);
        });
        return inv.catalogStock(maps, formatted);
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
      return db.prepare(`
        SELECT b.*, (
          SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id
        ) AS product_count
        FROM brands b
        ORDER BY name COLLATE NOCASE
      `).all().map(function (row) {
        return dbUtil.formatBrand(row);
      });
    },
    async getBrand(id) {
      const row = db.prepare('SELECT * FROM brands WHERE id = ?').get(id);
      if (!row) return null;
      const n = db.prepare('SELECT COUNT(*) AS n FROM products WHERE brand_id = ?').get(id);
      return dbUtil.formatBrand(row, { productCount: n && n.n });
    },
    async createBrand(input) {
      const id = String(input.id || '').trim();
      if (!id) throw new Error('Brand id is required.');
      db.prepare(
        'INSERT INTO brands (id, name, tagline, logo, description, image, hidden) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(
        id,
        input.name || id,
        input.tagline || '',
        input.logo || '',
        input.description || '',
        input.image || '',
        input.hidden ? 1 : 0
      );
      return this.getBrand(id);
    },
    async updateBrand(id, input) {
      const current = db.prepare('SELECT * FROM brands WHERE id = ?').get(id);
      if (!current) return null;
      db.prepare(
        'UPDATE brands SET name = ?, tagline = ?, logo = ?, description = ?, image = ?, hidden = ? WHERE id = ?'
      ).run(
        input.name != null ? input.name : current.name,
        input.tagline != null ? input.tagline : (current.tagline || ''),
        input.logo != null ? input.logo : (current.logo || ''),
        input.description != null ? input.description : (current.description || ''),
        input.image != null ? input.image : (current.image || ''),
        input.hidden != null ? (input.hidden ? 1 : 0) : (current.hidden ? 1 : 0),
        id
      );
      return this.getBrand(id);
    },
    async deleteBrand(id) {
      const current = db.prepare('SELECT id FROM brands WHERE id = ?').get(id);
      if (!current) return { ok: false, reason: 'missing' };
      const n = db.prepare('SELECT COUNT(*) AS n FROM products WHERE brand_id = ?').get(id);
      if (n && n.n) return { ok: false, reason: 'in-use', productCount: n.n };
      db.prepare('DELETE FROM brands WHERE id = ?').run(id);
      return { ok: true };
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
      const sortOrder = p.sortOrder == null ? 0 : Number(p.sortOrder) || 0;
      const info = db.prepare(`
        INSERT INTO products (
          brand_id, series_id, name, pitches, price_per_m2, weight_per_m2,
          power_avg, power_max, cabinet_w, cabinet_h, type, description, badge,
          image, gallery, details, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        p.brandId, p.seriesId, p.name, JSON.stringify(p.pitches), p.price, p.weight,
        p.powerAvg, p.powerMax, p.cabinetW, p.cabinetH, p.type, p.description, p.badge,
        p.image, JSON.stringify(p.gallery), JSON.stringify(p.details || {}), sortOrder, stamp, stamp
      );
      dbUtil.forgetCatalogTombstone(db, p.brandId, p.seriesId);
      return dbUtil.getProduct(db, info.lastInsertRowid);
    },
    async updateProduct(id, p) {
      const sortOrder = p.sortOrder == null ? null : Number(p.sortOrder) || 0;
      if (sortOrder == null) {
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
      } else {
        db.prepare(`
          UPDATE products SET
            brand_id = ?, series_id = ?, name = ?, pitches = ?, price_per_m2 = ?,
            weight_per_m2 = ?, power_avg = ?, power_max = ?, cabinet_w = ?, cabinet_h = ?,
            type = ?, description = ?, badge = ?, image = ?, gallery = ?, details = ?,
            sort_order = ?, updated_at = ?
          WHERE id = ?
        `).run(
          p.brandId, p.seriesId, p.name, JSON.stringify(p.pitches), p.price, p.weight,
          p.powerAvg, p.powerMax, p.cabinetW, p.cabinetH, p.type, p.description, p.badge,
          p.image, JSON.stringify(p.gallery), JSON.stringify(p.details || {}), sortOrder, dbUtil.nowIso(), id
        );
      }
      return dbUtil.getProduct(db, id);
    },
    async deleteProduct(id) {
      const row = db.prepare('SELECT brand_id, series_id FROM products WHERE id = ?').get(id);
      if (!row) return false;
      db.exec('BEGIN');
      try {
        dbUtil.rememberCatalogTombstone(db, row.brand_id, row.series_id);
        const info = db.prepare('DELETE FROM products WHERE id = ?').run(id);
        db.exec('COMMIT');
        return info.changes > 0;
      } catch (err) {
        try { db.exec('ROLLBACK'); } catch (e) { /* ignore */ }
        throw err;
      }
    },
    async setProductHidden(id, hidden) {
      const info = db.prepare('UPDATE products SET hidden = ?, updated_at = ? WHERE id = ?')
        .run(hidden ? 1 : 0, dbUtil.nowIso(), id);
      if (!info.changes) return null;
      const product = dbUtil.getProduct(db, id);
      if (product) attachMapsToListedProducts(db, [product]);
      return product;
    },
    async updateProductDetails(id, details) {
      const info = db.prepare('UPDATE products SET details = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(details || {}), dbUtil.nowIso(), id);
      if (!info.changes) return null;
      const product = dbUtil.getProduct(db, id);
      if (product) attachMapsToListedProducts(db, [product]);
      return product;
    },
    async getRawProduct(id) {
      return db.prepare('SELECT * FROM products WHERE id = ?').get(id) || null;
    },
    async getAdminByEmail(email) {
      return db.prepare(`
        SELECT a.*, r.name AS role_name, r.website_access, r.inventory_access, r.locked AS role_locked
        FROM admins a LEFT JOIN admin_roles r ON r.slug = a.role
        WHERE a.email = ?
      `).get(email) || null;
    },
    async createSession(token, adminId, expiresAt) {
      db.prepare('INSERT INTO sessions (token, admin_id, expires_at) VALUES (?, ?, ?)').run(token, adminId, expiresAt);
    },
    async getSession(token) {
      return db.prepare(`
        SELECT a.id, a.email, a.name, a.role, s.expires_at,
          r.name AS role_name, r.website_access, r.inventory_access, r.menu_access, r.locked AS role_locked
        FROM sessions s
        JOIN admins a ON a.id = s.admin_id
        LEFT JOIN admin_roles r ON r.slug = a.role
        WHERE s.token = ?
      `).get(token) || null;
    },
    async deleteSession(token) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    },
    adminWithRole(id) {
      return db.prepare(`
        SELECT a.id, a.email, a.name, a.role, a.created_at,
          r.name AS role_name, r.website_access, r.inventory_access, r.menu_access, r.locked AS role_locked
        FROM admins a LEFT JOIN admin_roles r ON r.slug = a.role
        WHERE a.id = ?
      `).get(id) || null;
    },
    async listAdmins() {
      const { publicAdmin } = require('./admin-roles');
      return db.prepare(`
        SELECT a.id, a.email, a.name, a.role, a.created_at,
          r.name AS role_name, r.website_access, r.inventory_access, r.menu_access, r.locked AS role_locked
        FROM admins a LEFT JOIN admin_roles r ON r.slug = a.role
        ORDER BY a.name COLLATE NOCASE, a.email
      `).all().map(publicAdmin);
    },
    async createAdmin(input) {
      const { publicAdmin } = require('./admin-roles');
      const info = db.prepare(
        'INSERT INTO admins (email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(input.email, input.name, input.passwordHash, input.role, dbUtil.nowIso());
      return publicAdmin(this.adminWithRole(info.lastInsertRowid));
    },
    async updateAdmin(id, input) {
      const { publicAdmin } = require('./admin-roles');
      const current = db.prepare('SELECT * FROM admins WHERE id = ?').get(id);
      if (!current) return null;
      const name = input.name != null ? input.name : current.name;
      const role = input.role != null ? input.role : current.role;
      const hash = input.passwordHash || current.password_hash;
      db.prepare('UPDATE admins SET name = ?, role = ?, password_hash = ? WHERE id = ?').run(name, role, hash, id);
      return publicAdmin(this.adminWithRole(id));
    },
    async deleteAdmin(id) {
      db.prepare('DELETE FROM sessions WHERE admin_id = ?').run(id);
      const info = db.prepare('DELETE FROM admins WHERE id = ?').run(id);
      return info.changes > 0;
    },
    async countAdminsByRole(role) {
      const row = db.prepare('SELECT COUNT(*) AS n FROM admins WHERE role = ?').get(role);
      return Number(row && row.n) || 0;
    },
    async listRoles() {
      const { publicRole } = require('./admin-roles');
      const counts = {};
      db.prepare('SELECT role, COUNT(*) AS n FROM admins GROUP BY role').all().forEach(function (row) {
        counts[row.role] = Number(row.n) || 0;
      });
      return db.prepare(
        'SELECT * FROM admin_roles ORDER BY locked DESC, name COLLATE NOCASE'
      ).all().map(function (row) {
        return publicRole(row, counts[row.slug] || 0);
      });
    },
    async getRole(id) {
      const { publicRole } = require('./admin-roles');
      const row = db.prepare('SELECT * FROM admin_roles WHERE id = ?').get(id);
      if (!row) return null;
      const n = db.prepare('SELECT COUNT(*) AS n FROM admins WHERE role = ?').get(row.slug);
      return publicRole(row, n && n.n);
    },
    async getRoleBySlug(slug) {
      const { publicRole } = require('./admin-roles');
      const row = db.prepare('SELECT * FROM admin_roles WHERE slug = ?').get(slug);
      if (!row) return null;
      return publicRole(row, 0);
    },
    async createRole(input) {
      const { accessLevel, slugifyRole, publicRole, OWNER_ROLE_SLUG } = require('./admin-roles');
      let slug = slugifyRole(input.name);
      if (slug === OWNER_ROLE_SLUG) throw new Error('Owner is a built-in role.');
      let n = 2;
      while (db.prepare('SELECT id FROM admin_roles WHERE slug = ?').get(slug)) {
        slug = slugifyRole(input.name) + '-' + n;
        n += 1;
      }
      const menuJson = input.menuJson || '{}';
      const info = db.prepare(
        'INSERT INTO admin_roles (slug, name, website_access, inventory_access, menu_access, locked, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)'
      ).run(slug, input.name, accessLevel(input.website), accessLevel(input.inventory), menuJson, dbUtil.nowIso());
      return publicRole(db.prepare('SELECT * FROM admin_roles WHERE id = ?').get(info.lastInsertRowid), 0);
    },
    async updateRole(id, input) {
      const { accessLevel, publicRole } = require('./admin-roles');
      const current = db.prepare('SELECT * FROM admin_roles WHERE id = ?').get(id);
      if (!current) return null;
      const name = current.locked ? current.name : (input.name != null ? input.name : current.name);
      const website = current.locked ? 'edit' : accessLevel(input.website != null ? input.website : current.website_access);
      const inventory = current.locked ? 'edit' : accessLevel(input.inventory != null ? input.inventory : current.inventory_access);
      const menuJson = current.locked ? current.menu_access : (input.menuJson != null ? input.menuJson : current.menu_access);
      db.prepare('UPDATE admin_roles SET name = ?, website_access = ?, inventory_access = ?, menu_access = ? WHERE id = ?')
        .run(name, website, inventory, menuJson || '{}', id);
      const n = db.prepare('SELECT COUNT(*) AS n FROM admins WHERE role = ?').get(current.slug);
      return publicRole(db.prepare('SELECT * FROM admin_roles WHERE id = ?').get(id), n && n.n);
    },
    async deleteRole(id) {
      const current = db.prepare('SELECT * FROM admin_roles WHERE id = ?').get(id);
      if (!current) return { ok: false, reason: 'missing' };
      if (current.locked) return { ok: false, reason: 'locked' };
      const n = db.prepare('SELECT COUNT(*) AS n FROM admins WHERE role = ?').get(current.slug);
      if (n && n.n) return { ok: false, reason: 'in-use', userCount: n.n };
      db.prepare('DELETE FROM admin_roles WHERE id = ?').run(id);
      return { ok: true };
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
    async listInventoryActivity(limit) {
      return listInventoryActivity(db, limit);
    },
    async listInventoryRecentMoves(limit, opts) {
      return listInventoryRecentMoves(db, limit, opts);
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
      const warehouse = resolveLocationTarget(db, input.warehouseId, input.bin);
      const locQty = Math.max(0, Number(input.qty) || 0);
      const itemQty = warehouseIsUntracked(db, warehouse) ? 0 : locQty;
      const info = db.prepare(`
        INSERT INTO inventory_items (
          sku, name, brand_id, category, pitch, unit, panel_type, packaging_type, qty, low_at, price, cost, dealer_net,
          local_warehouse_cost, weight, panel_w, panel_h, description, image, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        fields.sku, fields.name, fields.brand_id, fields.category || '', fields.pitch, fields.unit, fields.panel_type || '',
        fields.packaging_type || '', itemQty,
        fields.low_at, fields.price, fields.cost, fields.dealer_net,
        fields.local_warehouse_cost != null ? fields.local_warehouse_cost : 0, fields.weight,
        fields.panel_w, fields.panel_h, fields.description, fields.image, fields.notes,
        stamp, stamp
      );
      upsertItemLocation(db, info.lastInsertRowid, warehouse.id, '', locQty, stamp);
      if (locQty) {
        db.prepare(`
          INSERT INTO inventory_item_moves (
            item_id, kind, qty_delta, qty_after, note, admin_email, created_at
          ) VALUES (?, 'count', ?, ?, ?, '', ?)
        `).run(info.lastInsertRowid, locQty, locQty, warehouse.name + ' · Opening qty', stamp);
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
        panelType: input.panelType != null ? input.panelType : (current.panel_type || ''),
        packagingType: input.packagingType != null ? input.packagingType : (current.packaging_type || ''),
        lowAt: input.lowAt != null ? input.lowAt : Number(current.low_at),
        price: input.price != null ? input.price : Number(current.price) || 0,
        cost: input.cost != null ? input.cost : Number(current.cost) || 0,
        localWarehouseCost: input.localWarehouseCost != null ? input.localWarehouseCost : Number(current.local_warehouse_cost) || 0,
        dealerNet: input.dealerNet != null ? input.dealerNet : Number(current.dealer_net) || 0,
        weight: input.weight != null ? input.weight : Number(current.weight) || 0,
        panelW: input.panelW != null ? input.panelW : Number(current.panel_w) || 0,
        panelH: input.panelH != null ? input.panelH : Number(current.panel_h) || 0,
        description: input.description != null ? input.description : (current.description || ''),
        image: input.image != null ? input.image : (current.image || ''),
        notes: input.notes != null ? input.notes : (current.notes || ''),
        category: inv.resolveItemCategory(input.category, current.category, {
          sku: input.sku != null && input.sku !== '' ? input.sku : (current.sku || ''),
          name: input.name != null ? input.name : current.name,
          brandId: input.brandId != null ? input.brandId : (current.brand_id || ''),
          unit: input.unit != null ? input.unit : inv.unitOf(current.unit)
        })
      };
      if (!next.sku) throw new Error('SKU is required.');
      const clash = db.prepare('SELECT id FROM inventory_items WHERE sku = ? AND id != ?').get(next.sku, id);
      if (clash) throw new Error('That SKU is already in use.');
      db.prepare(`
        UPDATE inventory_items SET
          sku = ?, name = ?, brand_id = ?, category = ?, pitch = ?, unit = ?, panel_type = ?, packaging_type = ?,
          low_at = ?, price = ?,
          cost = ?, dealer_net = ?, local_warehouse_cost = ?, weight = ?, panel_w = ?, panel_h = ?,
          description = ?, image = ?, notes = ?, updated_at = ?
        WHERE id = ?
      `).run(
        next.sku, next.name, next.brandId, next.category, next.pitch, next.unit, next.panelType, next.packagingType,
        next.lowAt, next.price,
        next.cost, next.dealerNet, next.localWarehouseCost, next.weight, next.panelW, next.panelH,
        next.description, next.image, next.notes, dbUtil.nowIso(), id
      );
      if (input.warehouseId || input.bin != null) {
        const stamp = dbUtil.nowIso();
        const locs = locationsForItem(db, id);
        const primary = inv.pickPrimaryLocation(locs);
        const warehouse = resolveLocationTarget(
          db,
          input.warehouseId || (primary && primary.warehouseId),
          input.bin
        );
        if (primary && String(primary.warehouseId) === String(warehouse.id)) {
          db.prepare('UPDATE inventory_item_locations SET bin = ?, updated_at = ? WHERE id = ?')
            .run('', stamp, primary.id);
        } else if (primary && !db.prepare(
          'SELECT id FROM inventory_item_locations WHERE item_id = ? AND warehouse_id = ?'
        ).get(id, warehouse.id)) {
          db.prepare('UPDATE inventory_item_locations SET warehouse_id = ?, bin = ?, updated_at = ? WHERE id = ?')
            .run(warehouse.id, '', stamp, primary.id);
          syncItemSpectrumQty(db, id, stamp);
        } else if (!primary) {
          upsertItemLocation(db, id, warehouse.id, '', 0, stamp);
          syncItemSpectrumQty(db, id, stamp);
        } else {
          db.prepare('UPDATE inventory_item_locations SET bin = ?, updated_at = ? WHERE id = ?')
            .run('', stamp, primary.id);
        }
      }
      return getInventoryItemDetail(db, id);
    },
    async deleteInventoryItem(id) {
      const inv = require('./inventory');
      const detail = getInventoryItemDetail(db, id);
      if (!detail) return false;
      const history = db.prepare('SELECT COUNT(*) AS n FROM inventory_item_moves WHERE item_id = ?').get(id).n;
      inv.assertCanDelete(detail.item, history);
      const info = db.prepare('DELETE FROM inventory_items WHERE id = ?').run(id);
      return info.changes > 0;
    },
    async setInventoryInactive(id, inactive) {
      const inv = require('./inventory');
      const detail = getInventoryItemDetail(db, id);
      if (!detail) return null;
      const on = !(inactive === false || inactive === 0 || inactive === '0' || inactive === 'false');
      if (on) inv.assertCanInactivate(detail.item);
      db.prepare('UPDATE inventory_items SET inactive = ?, updated_at = ? WHERE id = ?')
        .run(on ? 1 : 0, dbUtil.nowIso(), id);
      return getInventoryItemDetail(db, id);
    },
    async adjustInventory(id, payload, adminEmail) {
      db.exec('BEGIN');
      try {
        const ok = applyLocationChange(db, id, payload || {}, adminEmail);
        if (!ok) {
          db.exec('ROLLBACK');
          return null;
        }
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
    async listCompanyCustomers() {
      const cc = require('./company-customers');
      return db.prepare(
        'SELECT * FROM company_customers ORDER BY company_name COLLATE NOCASE, contact_last COLLATE NOCASE, id DESC'
      ).all().map(cc.formatCustomer);
    },
    async getCompanyCustomer(id) {
      const cc = require('./company-customers');
      const customer = cc.formatCustomer(db.prepare('SELECT * FROM company_customers WHERE id = ?').get(id));
      if (!customer) return null;
      customer.contacts = await this.listCustomerContacts(id);
      return customer;
    },
    async _upsertCustomerPrimaryContact(customerId, customerInput) {
      const pc = require('./party-contacts');
      const contacts = await this.listCustomerContacts(customerId);
      const existing = contacts.find(function (c) { return c.isPrimary; }) || contacts[0] || null;
      const payload = pc.primaryPayloadFromCustomer(customerInput, existing);
      if (!pc.hasContactIdentity(payload)) return;
      if (existing) await this.updateCustomerContact(customerId, existing.id, payload);
      else await this.createCustomerContact(customerId, payload);
    },
    async createCompanyCustomer(payload) {
      const cc = require('./company-customers');
      const input = cc.normalizeCustomer(payload);
      const fields = cc.dbFields(input);
      const stamp = dbUtil.nowIso();
      const keys = Object.keys(fields);
      const info = db.prepare(
        'INSERT INTO company_customers (' + keys.join(', ') + ', created_at, updated_at) VALUES (' +
        keys.map(function () { return '?'; }).join(', ') + ', ?, ?)'
      ).run(...keys.map(function (k) { return fields[k]; }).concat([stamp, stamp]));
      await this._upsertCustomerPrimaryContact(info.lastInsertRowid, input);
      return this.getCompanyCustomer(info.lastInsertRowid);
    },
    async updateCompanyCustomer(id, payload) {
      const cc = require('./company-customers');
      const current = db.prepare('SELECT id FROM company_customers WHERE id = ?').get(id);
      if (!current) return null;
      const input = cc.normalizeCustomer(payload);
      const fields = cc.dbFields(input);
      const keys = Object.keys(fields);
      db.prepare(
        'UPDATE company_customers SET ' + keys.map(function (k) { return k + ' = ?'; }).join(', ') + ', updated_at = ? WHERE id = ?'
      ).run(...keys.map(function (k) { return fields[k]; }).concat([dbUtil.nowIso(), id]));
      await this._upsertCustomerPrimaryContact(id, input);
      return this.getCompanyCustomer(id);
    },
    async deleteCompanyCustomer(id) {
      const info = db.prepare('DELETE FROM company_customers WHERE id = ?').run(id);
      return info.changes > 0;
    },
    async listCustomerContacts(customerId) {
      const pc = require('./party-contacts');
      const rows = db.prepare(
        'SELECT * FROM company_customer_contacts WHERE customer_id = ? ORDER BY is_primary DESC, sort_order, id'
      ).all(customerId);
      return rows.map(pc.formatContact);
    },
    async getCustomerContact(customerId, contactId) {
      const pc = require('./party-contacts');
      return pc.formatContact(db.prepare(
        'SELECT * FROM company_customer_contacts WHERE id = ? AND customer_id = ?'
      ).get(contactId, customerId));
    },
    _clearCustomerPrimary(customerId, exceptId) {
      if (exceptId) {
        db.prepare('UPDATE company_customer_contacts SET is_primary = 0 WHERE customer_id = ? AND id <> ?')
          .run(customerId, exceptId);
      } else {
        db.prepare('UPDATE company_customer_contacts SET is_primary = 0 WHERE customer_id = ?').run(customerId);
      }
    },
    async createCustomerContact(customerId, payload) {
      const parent = db.prepare('SELECT id FROM company_customers WHERE id = ?').get(customerId);
      if (!parent) return null;
      const pc = require('./party-contacts');
      const input = pc.normalizeContact(payload);
      const fields = pc.dbFields(input);
      if (input.isPrimary) this._clearCustomerPrimary(customerId);
      const stamp = dbUtil.nowIso();
      const keys = Object.keys(fields);
      const info = db.prepare(
        'INSERT INTO company_customer_contacts (' + keys.join(', ') + ', customer_id, created_at, updated_at) VALUES (' +
        keys.map(function () { return '?'; }).join(', ') + ', ?, ?, ?)'
      ).run(...keys.map(function (k) { return fields[k]; }).concat([customerId, stamp, stamp]));
      return this.getCustomerContact(customerId, info.lastInsertRowid);
    },
    async updateCustomerContact(customerId, contactId, payload) {
      const current = db.prepare('SELECT id FROM company_customer_contacts WHERE id = ? AND customer_id = ?')
        .get(contactId, customerId);
      if (!current) return null;
      const pc = require('./party-contacts');
      const input = pc.normalizeContact(payload);
      const fields = pc.dbFields(input);
      if (input.isPrimary) this._clearCustomerPrimary(customerId, contactId);
      const keys = Object.keys(fields);
      db.prepare(
        'UPDATE company_customer_contacts SET ' + keys.map(function (k) { return k + ' = ?'; }).join(', ') +
        ', updated_at = ? WHERE id = ? AND customer_id = ?'
      ).run(...keys.map(function (k) { return fields[k]; }).concat([dbUtil.nowIso(), contactId, customerId]));
      return this.getCustomerContact(customerId, contactId);
    },
    async deleteCustomerContact(customerId, contactId) {
      const info = db.prepare('DELETE FROM company_customer_contacts WHERE id = ? AND customer_id = ?')
        .run(contactId, customerId);
      return info.changes > 0;
    },
    async listSalesDocs(type) {
      const sales = require('./company-sales');
      const rows = type
        ? db.prepare('SELECT * FROM company_sales_docs WHERE type = ? ORDER BY id DESC').all(type)
        : db.prepare('SELECT * FROM company_sales_docs ORDER BY id DESC').all();
      return rows.map(function (row) {
        const lines = db.prepare('SELECT * FROM company_sales_lines WHERE doc_id = ? ORDER BY sort_order, id').all(row.id);
        return sales.formatDoc(row, lines);
      });
    },
    async getSalesDoc(id) {
      const sales = require('./company-sales');
      const row = db.prepare('SELECT * FROM company_sales_docs WHERE id = ?').get(id);
      if (!row) return null;
      const lines = db.prepare('SELECT * FROM company_sales_lines WHERE doc_id = ? ORDER BY sort_order, id').all(row.id);
      return sales.formatDoc(row, lines);
    },
    async createSalesDoc(payload) {
      const sales = require('./company-sales');
      const input = sales.normalizeDoc(payload);
      if (input.customerId) {
        const customer = await this.getCompanyCustomer(input.customerId);
        if (customer) {
          const snap = sales.snapshotFromCustomer(customer);
          if (!input.customerName) input.customerName = snap.customerName;
          if (!input.customerEmail) input.customerEmail = snap.customerEmail;
          if (!input.paymentTerms) input.paymentTerms = snap.paymentTerms;
          ['billStreet', 'billCity', 'billState', 'billZip', 'billCountry',
            'shipStreet', 'shipCity', 'shipState', 'shipZip', 'shipCountry'].forEach(function (key) {
            if (!input[key] && snap[key]) input[key] = snap[key];
          });
        }
      }
      const existing = db.prepare('SELECT number FROM company_sales_docs WHERE type = ?').all(input.type).map(function (r) { return r.number; });
      if (!input.number) input.number = sales.nextDocNumber(existing, input.type);
      if (db.prepare('SELECT id FROM company_sales_docs WHERE number = ?').get(input.number)) {
        throw new Error('That document number is already used.');
      }
      const fields = sales.dbDocFields(input);
      const stamp = dbUtil.nowIso();
      const info = db.prepare(`
        INSERT INTO company_sales_docs (
          type, number, customer_id, customer_name, customer_email, po_number, so_number,
          rep, account_no, ship_date, ship_via, tracking,
          issue_date, due_date, payment_terms, status, tax_rate, discount, notes,
          bill_street, bill_city, bill_state, bill_zip, bill_country,
          ship_street, ship_city, ship_state, ship_zip, ship_country, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        fields.type, fields.number, fields.customer_id, fields.customer_name, fields.customer_email,
        fields.po_number, fields.so_number, fields.rep, fields.account_no, fields.ship_date, fields.ship_via, fields.tracking,
        fields.issue_date, fields.due_date, fields.payment_terms, fields.status,
        fields.tax_rate, fields.discount, fields.notes,
        fields.bill_street, fields.bill_city, fields.bill_state, fields.bill_zip, fields.bill_country,
        fields.ship_street, fields.ship_city, fields.ship_state, fields.ship_zip, fields.ship_country,
        stamp, stamp
      );
      const insertLine = db.prepare(
        'INSERT INTO company_sales_lines (doc_id, sku, item, description, qty, unit_price, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      input.lines.forEach(function (line, i) {
        insertLine.run(info.lastInsertRowid, line.sku, line.item || '', line.description, line.qty, line.unitPrice, i);
      });
      const created = await this.getSalesDoc(info.lastInsertRowid);
      if (created && created.type === 'order') {
        try { await this.ensureOrderChatRoom(created); } catch (e) { console.error('chat order room', e); }
      }
      return created;
    },
    async updateSalesDoc(id, payload) {
      const sales = require('./company-sales');
      const current = db.prepare('SELECT * FROM company_sales_docs WHERE id = ?').get(id);
      if (!current) return null;
      const input = sales.normalizeDoc(Object.assign({}, payload, { type: payload.type || current.type, number: payload.number || current.number }));
      const taken = db.prepare('SELECT id FROM company_sales_docs WHERE number = ? AND id != ?').get(input.number, id);
      if (taken) throw new Error('That document number is already used.');
      const fields = sales.dbDocFields(input);
      db.prepare(`
        UPDATE company_sales_docs SET
          type = ?, number = ?, customer_id = ?, customer_name = ?, customer_email = ?, po_number = ?,
          so_number = ?, rep = ?, account_no = ?, ship_date = ?, ship_via = ?, tracking = ?,
          issue_date = ?, due_date = ?, payment_terms = ?, status = ?, tax_rate = ?, discount = ?, notes = ?,
          bill_street = ?, bill_city = ?, bill_state = ?, bill_zip = ?, bill_country = ?,
          ship_street = ?, ship_city = ?, ship_state = ?, ship_zip = ?, ship_country = ?, updated_at = ?
        WHERE id = ?
      `).run(
        fields.type, fields.number, fields.customer_id, fields.customer_name, fields.customer_email,
        fields.po_number, fields.so_number, fields.rep, fields.account_no, fields.ship_date, fields.ship_via, fields.tracking,
        fields.issue_date, fields.due_date, fields.payment_terms, fields.status,
        fields.tax_rate, fields.discount, fields.notes,
        fields.bill_street, fields.bill_city, fields.bill_state, fields.bill_zip, fields.bill_country,
        fields.ship_street, fields.ship_city, fields.ship_state, fields.ship_zip, fields.ship_country,
        dbUtil.nowIso(), id
      );
      db.prepare('DELETE FROM company_sales_lines WHERE doc_id = ?').run(id);
      const insertLine = db.prepare(
        'INSERT INTO company_sales_lines (doc_id, sku, item, description, qty, unit_price, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      input.lines.forEach(function (line, i) {
        insertLine.run(id, line.sku, line.item || '', line.description, line.qty, line.unitPrice, i);
      });
      const updated = await this.getSalesDoc(id);
      if (updated && updated.type === 'order') {
        try { await this.ensureOrderChatRoom(updated); } catch (e) { console.error('chat order room', e); }
      }
      return updated;
    },
    async deleteSalesDoc(id) {
      db.prepare('DELETE FROM company_sales_lines WHERE doc_id = ?').run(id);
      const info = db.prepare('DELETE FROM company_sales_docs WHERE id = ?').run(id);
      return info.changes > 0;
    },
    async listPrintForms() {
      const pf = require('./print-forms');
      const rows = db.prepare('SELECT type, template_json FROM company_print_forms').all();
      const byType = {};
      rows.forEach(function (row) {
        byType[row.type] = pf.parseStored(row.type, row.template_json);
      });
      const forms = {};
      pf.TYPES.forEach(function (type) {
        forms[type] = byType[type] || pf.defaultTemplate(type);
      });
      return forms;
    },
    async getPrintForm(type) {
      const pf = require('./print-forms');
      const t = pf.normalizeType(type);
      const row = db.prepare('SELECT template_json FROM company_print_forms WHERE type = ?').get(t);
      return pf.parseStored(t, row && row.template_json);
    },
    async savePrintForm(type, template) {
      const pf = require('./print-forms');
      const t = pf.normalizeType(type);
      const clean = pf.normalizeTemplate(t, template);
      db.prepare(`
        INSERT INTO company_print_forms (type, template_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(type) DO UPDATE SET template_json = excluded.template_json, updated_at = excluded.updated_at
      `).run(t, JSON.stringify(clean), dbUtil.nowIso());
      return clean;
    },
    async listVendors() {
      const vn = require('./inventory-vendors');
      return db.prepare(
        'SELECT * FROM inventory_vendors ORDER BY company_name COLLATE NOCASE, display_name COLLATE NOCASE, id DESC'
      ).all().map(vn.formatVendor);
    },
    async getVendor(id) {
      const vn = require('./inventory-vendors');
      const vendor = vn.formatVendor(db.prepare('SELECT * FROM inventory_vendors WHERE id = ?').get(id));
      if (!vendor) return null;
      vendor.contacts = await this.listVendorContacts(id);
      return vendor;
    },
    async createVendor(payload) {
      const vn = require('./inventory-vendors');
      const input = vn.normalizeVendor(payload);
      const fields = vn.dbFields(input);
      const stamp = dbUtil.nowIso();
      const keys = Object.keys(fields);
      const values = keys.map(function (k) { return fields[k]; }).concat([stamp, stamp]);
      const info = db.prepare(
        'INSERT INTO inventory_vendors (' + keys.join(', ') + ', created_at, updated_at) VALUES (' +
        keys.map(function () { return '?'; }).join(', ') + ', ?, ?)'
      ).run(...values);
      return this.getVendor(info.lastInsertRowid);
    },
    async updateVendor(id, payload) {
      const vn = require('./inventory-vendors');
      const current = db.prepare('SELECT id FROM inventory_vendors WHERE id = ?').get(id);
      if (!current) return null;
      const input = vn.normalizeVendor(payload);
      const fields = vn.dbFields(input);
      const keys = Object.keys(fields);
      const values = keys.map(function (k) { return fields[k]; }).concat([dbUtil.nowIso(), id]);
      db.prepare(
        'UPDATE inventory_vendors SET ' + keys.map(function (k) { return k + ' = ?'; }).join(', ') + ', updated_at = ? WHERE id = ?'
      ).run(...values);
      return this.getVendor(id);
    },
    async deleteVendor(id) {
      const info = db.prepare('DELETE FROM inventory_vendors WHERE id = ?').run(id);
      return info.changes > 0;
    },
    async listVendorContacts(vendorId) {
      const pc = require('./party-contacts');
      const rows = db.prepare(
        'SELECT * FROM inventory_vendor_contacts WHERE vendor_id = ? ORDER BY is_primary DESC, sort_order, id'
      ).all(vendorId);
      return rows.map(pc.formatContact);
    },
    async getVendorContact(vendorId, contactId) {
      const pc = require('./party-contacts');
      return pc.formatContact(db.prepare(
        'SELECT * FROM inventory_vendor_contacts WHERE id = ? AND vendor_id = ?'
      ).get(contactId, vendorId));
    },
    _clearVendorPrimary(vendorId, exceptId) {
      if (exceptId) {
        db.prepare('UPDATE inventory_vendor_contacts SET is_primary = 0 WHERE vendor_id = ? AND id <> ?')
          .run(vendorId, exceptId);
      } else {
        db.prepare('UPDATE inventory_vendor_contacts SET is_primary = 0 WHERE vendor_id = ?').run(vendorId);
      }
    },
    async createVendorContact(vendorId, payload) {
      const parent = db.prepare('SELECT id FROM inventory_vendors WHERE id = ?').get(vendorId);
      if (!parent) return null;
      const pc = require('./party-contacts');
      const input = pc.normalizeContact(payload);
      const fields = pc.dbFields(input);
      if (input.isPrimary) this._clearVendorPrimary(vendorId);
      const stamp = dbUtil.nowIso();
      const keys = Object.keys(fields);
      const info = db.prepare(
        'INSERT INTO inventory_vendor_contacts (' + keys.join(', ') + ', vendor_id, created_at, updated_at) VALUES (' +
        keys.map(function () { return '?'; }).join(', ') + ', ?, ?, ?)'
      ).run(...keys.map(function (k) { return fields[k]; }).concat([vendorId, stamp, stamp]));
      return this.getVendorContact(vendorId, info.lastInsertRowid);
    },
    async updateVendorContact(vendorId, contactId, payload) {
      const current = db.prepare('SELECT id FROM inventory_vendor_contacts WHERE id = ? AND vendor_id = ?')
        .get(contactId, vendorId);
      if (!current) return null;
      const pc = require('./party-contacts');
      const input = pc.normalizeContact(payload);
      const fields = pc.dbFields(input);
      if (input.isPrimary) this._clearVendorPrimary(vendorId, contactId);
      const keys = Object.keys(fields);
      db.prepare(
        'UPDATE inventory_vendor_contacts SET ' + keys.map(function (k) { return k + ' = ?'; }).join(', ') +
        ', updated_at = ? WHERE id = ? AND vendor_id = ?'
      ).run(...keys.map(function (k) { return fields[k]; }).concat([dbUtil.nowIso(), contactId, vendorId]));
      return this.getVendorContact(vendorId, contactId);
    },
    async deleteVendorContact(vendorId, contactId) {
      const info = db.prepare('DELETE FROM inventory_vendor_contacts WHERE id = ? AND vendor_id = ?')
        .run(contactId, vendorId);
      return info.changes > 0;
    },
    async listPurchaseOrders() {
      const po = require('./purchase-orders');
      return db.prepare('SELECT * FROM purchase_orders ORDER BY id DESC').all().map(function (row) {
        const lines = db.prepare('SELECT * FROM purchase_order_lines WHERE po_id = ? ORDER BY sort_order, id').all(row.id);
        return po.formatPo(row, lines, { warehouse: poWarehouseForShipFrom(db, row.ship_from) });
      });
    },
    async getPurchaseOrder(id) {
      const po = require('./purchase-orders');
      const row = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id);
      if (!row) return null;
      const lines = db.prepare('SELECT * FROM purchase_order_lines WHERE po_id = ? ORDER BY sort_order, id').all(row.id);
      return po.formatPo(row, lines, { warehouse: poWarehouseForShipFrom(db, row.ship_from) });
    },
    async createPurchaseOrder(payload) {
      const po = require('./purchase-orders');
      const input = po.normalizePo(payload);
      if (input.vendorId) {
        const vendor = await this.getVendor(input.vendorId);
        if (vendor) {
          const snap = po.snapshotFromVendor(vendor);
          if (!input.vendorName) input.vendorName = snap.vendorName;
          if (!input.vendorEmail) input.vendorEmail = snap.vendorEmail;
          if (!input.mailingAddress) input.mailingAddress = snap.mailingAddress;
        }
      }
      const existing = db.prepare('SELECT number FROM purchase_orders').all().map(function (r) { return r.number; });
      if (!input.number) input.number = po.nextPoNumber(existing);
      if (db.prepare('SELECT id FROM purchase_orders WHERE number = ?').get(input.number)) {
        throw new Error('That purchase order number is already used.');
      }
      const fields = po.dbPoFields(input);
      const stamp = dbUtil.nowIso();
      const info = db.prepare(`
        INSERT INTO purchase_orders (
          number, vendor_id, vendor_name, vendor_email, status, issue_date, due_date,
          ship_via, ship_from, permit_no, mailing_address, ship_to_customer_id, ship_to_name, shipping_address,
          notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        fields.number, fields.vendor_id, fields.vendor_name, fields.vendor_email, fields.status,
        fields.issue_date, fields.due_date, fields.ship_via, fields.ship_from, fields.permit_no, fields.mailing_address,
        fields.ship_to_customer_id, fields.ship_to_name, fields.shipping_address, fields.notes, stamp, stamp
      );
      const insertLine = db.prepare(
        'INSERT INTO purchase_order_lines (po_id, item_id, product, sku, description, qty, unit_cost, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      );
      input.lines.forEach(function (line, i) {
        insertLine.run(info.lastInsertRowid, line.itemId || null, line.product, line.sku, line.description, line.qty, line.rate, i);
      });
      return this.getPurchaseOrder(info.lastInsertRowid);
    },
    async updatePurchaseOrder(id, payload) {
      const po = require('./purchase-orders');
      const current = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id);
      if (!current) return null;
      const input = po.normalizePo(Object.assign({}, payload, { number: payload.number || current.number }));
      const taken = db.prepare('SELECT id FROM purchase_orders WHERE number = ? AND id != ?').get(input.number, id);
      if (taken) throw new Error('That purchase order number is already used.');
      const fields = po.dbPoFields(input);
      db.prepare(`
        UPDATE purchase_orders SET
          number = ?, vendor_id = ?, vendor_name = ?, vendor_email = ?, status = ?,
          issue_date = ?, due_date = ?, ship_via = ?, ship_from = ?, permit_no = ?, mailing_address = ?,
          ship_to_customer_id = ?, ship_to_name = ?, shipping_address = ?, notes = ?, updated_at = ?
        WHERE id = ?
      `).run(
        fields.number, fields.vendor_id, fields.vendor_name, fields.vendor_email, fields.status,
        fields.issue_date, fields.due_date, fields.ship_via, fields.ship_from, fields.permit_no, fields.mailing_address,
        fields.ship_to_customer_id, fields.ship_to_name, fields.shipping_address, fields.notes,
        dbUtil.nowIso(), id
      );
      db.prepare('DELETE FROM purchase_order_lines WHERE po_id = ?').run(id);
      const insertLine = db.prepare(
        'INSERT INTO purchase_order_lines (po_id, item_id, product, sku, description, qty, unit_cost, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      );
      input.lines.forEach(function (line, i) {
        insertLine.run(id, line.itemId || null, line.product, line.sku, line.description, line.qty, line.rate, i);
      });
      return this.getPurchaseOrder(id);
    },
    async deletePurchaseOrder(id) {
      db.prepare('DELETE FROM purchase_order_lines WHERE po_id = ?').run(id);
      const info = db.prepare('DELETE FROM purchase_orders WHERE id = ?').run(id);
      return info.changes > 0;
    },
    async listReceiptShipments() {
      const rs = require('./receipt-shipments');
      return db.prepare('SELECT * FROM receipt_shipments ORDER BY id DESC').all().map(function (row) {
        const lines = db.prepare('SELECT * FROM receipt_shipment_lines WHERE receipt_id = ? ORDER BY sort_order, id').all(row.id);
        return formatSqliteReceipt(db, row, lines);
      });
    },
    async getReceiptShipment(id) {
      const row = db.prepare('SELECT * FROM receipt_shipments WHERE id = ?').get(id);
      if (!row) return null;
      const lines = db.prepare('SELECT * FROM receipt_shipment_lines WHERE receipt_id = ? ORDER BY sort_order, id').all(row.id);
      return formatSqliteReceipt(db, row, lines);
    },
    async createReceiptShipment(payload, adminEmail) {
      const rs = require('./receipt-shipments');
      const input = rs.normalizeReceipt(payload);
      if (input.vendorId) {
        const vendor = await this.getVendor(input.vendorId);
        if (vendor && !input.vendorName) input.vendorName = rs.snapshotFromVendor(vendor).vendorName;
      }
      if (input.poId) {
        const po = await this.getPurchaseOrder(input.poId);
        if (po && !input.poNumber) input.poNumber = po.number;
      }
      const existing = db.prepare('SELECT number FROM receipt_shipments').all().map(function (r) { return r.number; });
      if (!input.number) input.number = rs.nextReceiptNumber(existing);
      if (db.prepare('SELECT id FROM receipt_shipments WHERE number = ?').get(input.number)) {
        throw new Error('That receipt number is already used.');
      }
      const defaultWh = resolveWarehouse(db, input.warehouseId);
      input.warehouseId = String(defaultWh.id);
      const fields = rs.dbReceiptFields(input);
      const stamp = dbUtil.nowIso();
      const noteBase = input.poNumber ? (input.number + ' / ' + input.poNumber) : input.number;
      const findSku = db.prepare('SELECT id, name, sku, qty FROM inventory_items WHERE lower(sku) = lower(?)');
      db.exec('BEGIN');
      try {
        const info = db.prepare(`
          INSERT INTO receipt_shipments (
            number, vendor_id, vendor_name, po_id, po_number, receipt_date, warehouse_id, memo, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          fields.number, fields.vendor_id, fields.vendor_name, fields.po_id, fields.po_number,
          fields.receipt_date, fields.warehouse_id, fields.memo, fields.status, stamp, stamp
        );
        const receiptId = info.lastInsertRowid;
        const insertLine = db.prepare(
          'INSERT INTO receipt_shipment_lines (receipt_id, po_line_id, item_id, sku, product, po_qty, qty_received, warehouse_id, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        input.lines.forEach(function (line, i) {
          let itemId = line.itemId || '';
          let product = line.product;
          let sku = line.sku;
          const destId = line.warehouseId || input.warehouseId;
          if (line.qtyReceived > 0) {
            if (!itemId && sku) {
              const row = findSku.get(sku);
              if (!row) throw new Error('SKU not found: ' + sku);
              itemId = row.id;
              if (!product) product = row.name;
              sku = row.sku;
            }
            if (!itemId) throw new Error('SKU not found for a received line.');
            const dest = resolveWarehouse(db, destId);
            const ok = applyLocationChange(db, itemId, {
              kind: 'receive',
              qty: line.qtyReceived,
              warehouseId: dest.id,
              note: noteBase
            }, adminEmail);
            if (!ok) throw new Error('Inventory item not found.');
          }
          insertLine.run(
            receiptId, line.poLineId || null, itemId || null, sku, product, line.poQty, line.qtyReceived,
            destId || null, i
          );
        });
        db.exec('COMMIT');
        return this.getReceiptShipment(receiptId);
      } catch (err) {
        try { db.exec('ROLLBACK'); } catch (e) { /* ignore */ }
        throw err;
      }
    },
    async listWarehouses() {
      return listFormattedWarehouses(db);
    },
    async getWarehouse(id) {
      const wh = require('./inventory-warehouses');
      const rows = db.prepare('SELECT * FROM inventory_warehouses ORDER BY id').all();
      const row = rows.find(function (r) { return String(r.id) === String(id); });
      if (!row) return null;
      const stats = warehouseStats(db);
      const warehouse = wh.decorateWarehouses(rows.map(function (r) {
        return formatWarehouseRow(db, r, rows, stats);
      })).find(function (r) { return String(r.id) === String(id); });
      if (!warehouse) return null;
      const childIds = rows.filter(function (r) {
        return String(r.parent_id) === String(id);
      }).map(function (r) { return String(r.id); });
      const idSet = {};
      idSet[String(id)] = true;
      childIds.forEach(function (cid) { idSet[cid] = true; });
      const childName = {};
      rows.forEach(function (r) {
        if (String(r.parent_id) === String(id)) childName[String(r.id)] = r.name;
      });
      warehouse.items = [];
      listInventoryItems(db).forEach(function (item) {
        (item.locations || []).forEach(function (loc) {
          if (!(idSet[String(loc.warehouseId)] && Number(loc.qty) > 0)) return;
          warehouse.items.push({
            id: item.id,
            sku: item.sku,
            name: item.name,
            qty: loc.qty,
            bin: loc.kind === 'bin' && String(loc.warehouseId) !== String(id) ? (loc.locationName || '') : (childName[String(loc.warehouseId)] || ''),
            locationId: loc.warehouseId,
            unit: item.unit
          });
        });
      });
      return warehouse;
    },
    async createWarehouse(payload) {
      const wh = require('./inventory-warehouses');
      const existing = db.prepare('SELECT * FROM inventory_warehouses').all();
      const input = wh.normalizeWarehouse(payload, { existing: existing });
      if (input.vendorId) {
        const vendor = db.prepare('SELECT id FROM inventory_vendors WHERE id = ?').get(input.vendorId);
        if (!vendor) throw new Error('Vendor not found.');
      }
      const fields = wh.dbFields(input);
      const stamp = dbUtil.nowIso();
      const info = db.prepare(`
        INSERT INTO inventory_warehouses (name, type, parent_id, vendor_id, untracked, notes, street, street2, city, state, zip, country, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        fields.name, fields.type, fields.parent_id, fields.vendor_id, fields.untracked, fields.notes,
        fields.street, fields.street2, fields.city, fields.state, fields.zip, fields.country,
        stamp, stamp
      );
      return this.getWarehouse(info.lastInsertRowid);
    },
    async updateWarehouse(id, payload) {
      const wh = require('./inventory-warehouses');
      const current = db.prepare('SELECT * FROM inventory_warehouses WHERE id = ?').get(id);
      if (!current) return null;
      const existing = db.prepare('SELECT * FROM inventory_warehouses').all();
      const input = wh.normalizeWarehouse(payload, { existing: existing, id: id });
      if (wh.isHomeWarehouse(current) && input.untracked && !countTrackedWarehouses(db, id)) {
        throw new Error('Keep at least one tracked location.');
      }
      if (wh.locationKind(current.type) === 'warehouse' && input.kind === 'bin') {
        const kids = db.prepare('SELECT id FROM inventory_warehouses WHERE parent_id = ?').all(id);
        if (kids.length) throw new Error('Move or delete bins in this warehouse first.');
      }
      if (input.vendorId) {
        const vendor = db.prepare('SELECT id FROM inventory_vendors WHERE id = ?').get(input.vendorId);
        if (!vendor) throw new Error('Vendor not found.');
      }
      const fields = wh.dbFields(input);
      db.prepare(
        'UPDATE inventory_warehouses SET name = ?, type = ?, parent_id = ?, vendor_id = ?, untracked = ?, notes = ?, street = ?, street2 = ?, city = ?, state = ?, zip = ?, country = ?, updated_at = ? WHERE id = ?'
      ).run(
        fields.name, fields.type, fields.parent_id, fields.vendor_id, fields.untracked, fields.notes,
        fields.street, fields.street2, fields.city, fields.state, fields.zip, fields.country,
        dbUtil.nowIso(), id
      );
      const items = db.prepare('SELECT DISTINCT item_id FROM inventory_item_locations WHERE warehouse_id = ?').all(id);
      const stamp = dbUtil.nowIso();
      items.forEach(function (row) { syncItemSpectrumQty(db, row.item_id, stamp); });
      return this.getWarehouse(id);
    },
    async deleteWarehouse(id) {
      const wh = require('./inventory-warehouses');
      const current = db.prepare('SELECT * FROM inventory_warehouses WHERE id = ?').get(id);
      if (!current) return false;
      const kids = db.prepare('SELECT id FROM inventory_warehouses WHERE parent_id = ?').all(id);
      if (kids.length) throw new Error('Move or delete bins in this warehouse first.');
      if (wh.isHomeWarehouse(current) && !countTrackedWarehouses(db, id)) {
        throw new Error('Keep at least one tracked location.');
      }
      const stock = db.prepare(
        'SELECT COALESCE(SUM(qty), 0) AS qty FROM inventory_item_locations WHERE warehouse_id = ?'
      ).get(id).qty;
      if (stock > 0) throw new Error('Transfer or count this location to zero before deleting it.');
      db.prepare('DELETE FROM inventory_item_locations WHERE warehouse_id = ?').run(id);
      const info = db.prepare('DELETE FROM inventory_warehouses WHERE id = ?').run(id);
      return info.changes > 0;
    },
    async transferWarehouseStock(fromId, payload, adminEmail) {
      const from = db.prepare('SELECT * FROM inventory_warehouses WHERE id = ?').get(fromId);
      if (!from) return null;
      const toId = payload && (payload.toLocationId != null ? payload.toLocationId : payload.toWarehouseId);
      if (!toId || String(toId) === String(fromId)) throw new Error('Pick a different location.');
      const to = db.prepare('SELECT * FROM inventory_warehouses WHERE id = ?').get(toId);
      if (!to) throw new Error('Destination location not found.');
      const itemId = payload && (payload.itemId != null ? payload.itemId : payload.item_id);
      if (!itemId) throw new Error('Pick an item.');
      const qty = Math.round(Number(payload && payload.qty));
      if (!isFinite(qty) || qty <= 0) throw new Error('Quantity must be a whole number greater than 0.');
      const src = db.prepare(
        'SELECT * FROM inventory_item_locations WHERE item_id = ? AND warehouse_id = ?'
      ).get(itemId, fromId);
      const have = src ? Math.max(0, Number(src.qty) || 0) : 0;
      if (have < qty) throw new Error('Only ' + have + ' at this location.');
      const dest = db.prepare(
        'SELECT * FROM inventory_item_locations WHERE item_id = ? AND warehouse_id = ?'
      ).get(itemId, toId);
      const destQty = dest ? Math.max(0, Number(dest.qty) || 0) : 0;
      const stamp = dbUtil.nowIso();
      const email = String(adminEmail || '').trim().slice(0, 120);
      db.exec('BEGIN');
      try {
        upsertItemLocation(db, itemId, fromId, src ? src.bin : '', have - qty, stamp);
        upsertItemLocation(db, itemId, toId, dest ? dest.bin : '', destQty + qty, stamp);
        syncItemSpectrumQty(db, itemId, stamp);
        db.prepare(`
          INSERT INTO inventory_item_moves (
            item_id, kind, qty_delta, qty_after, note, admin_email, created_at
          ) VALUES (?, 'transfer', ?, ?, ?, ?, ?)
        `).run(itemId, -qty, have - qty, 'To ' + to.name, email, stamp);
        db.prepare(`
          INSERT INTO inventory_item_moves (
            item_id, kind, qty_delta, qty_after, note, admin_email, created_at
          ) VALUES (?, 'transfer', ?, ?, ?, ?, ?)
        `).run(itemId, qty, destQty + qty, 'From ' + from.name, email, stamp);
        db.exec('COMMIT');
      } catch (err) {
        try { db.exec('ROLLBACK'); } catch (e) { /* ignore */ }
        throw err;
      }
      return this.getWarehouse(fromId);
    },
    async getCompanyProfile() {
      const ca = require('./company-accounts');
      return ca.formatProfile(db.prepare('SELECT * FROM company_profile WHERE id = 1').get());
    },
    async saveCompanyProfile(payload) {
      const ca = require('./company-accounts');
      const input = ca.normalizeProfile(payload);
      const fields = ca.profileDbFields(input);
      const stamp = dbUtil.nowIso();
      const current = db.prepare('SELECT id FROM company_profile WHERE id = 1').get();
      if (!current) {
        db.prepare(`
          INSERT INTO company_profile (
            id, legal_name, dba, phone, email, website, street, street2, city, state, zip, country, tax_id, notes, created_at, updated_at
          ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          fields.legal_name, fields.dba, fields.phone, fields.email, fields.website,
          fields.street, fields.street2, fields.city, fields.state, fields.zip, fields.country,
          fields.tax_id, fields.notes, stamp, stamp
        );
      } else {
        db.prepare(`
          UPDATE company_profile SET
            legal_name = ?, dba = ?, phone = ?, email = ?, website = ?,
            street = ?, street2 = ?, city = ?, state = ?, zip = ?, country = ?,
            tax_id = ?, notes = ?, updated_at = ?
          WHERE id = 1
        `).run(
          fields.legal_name, fields.dba, fields.phone, fields.email, fields.website,
          fields.street, fields.street2, fields.city, fields.state, fields.zip, fields.country,
          fields.tax_id, fields.notes, stamp
        );
      }
      return this.getCompanyProfile();
    },
    async listCompanyAccounts() {
      const ca = require('./company-accounts');
      return db.prepare('SELECT * FROM company_accounts ORDER BY name COLLATE NOCASE, id DESC').all()
        .map(function (row) { return ca.formatAccount(row, { includePassword: false }); });
    },
    async getCompanyAccount(id) {
      const ca = require('./company-accounts');
      return ca.formatAccount(db.prepare('SELECT * FROM company_accounts WHERE id = ?').get(id));
    },
    async createCompanyAccount(payload) {
      const ca = require('./company-accounts');
      const input = ca.normalizeAccount(payload);
      const fields = ca.accountDbFields(input);
      const stamp = dbUtil.nowIso();
      const keys = Object.keys(fields);
      const values = keys.map(function (k) { return fields[k]; }).concat([stamp, stamp]);
      const info = db.prepare(
        'INSERT INTO company_accounts (' + keys.join(', ') + ', created_at, updated_at) VALUES (' +
        keys.map(function () { return '?'; }).join(', ') + ', ?, ?)'
      ).run(...values);
      return this.getCompanyAccount(info.lastInsertRowid);
    },
    async updateCompanyAccount(id, payload) {
      const ca = require('./company-accounts');
      const current = db.prepare('SELECT id FROM company_accounts WHERE id = ?').get(id);
      if (!current) return null;
      const input = ca.normalizeAccount(payload);
      const fields = ca.accountDbFields(input);
      const keys = Object.keys(fields);
      const values = keys.map(function (k) { return fields[k]; }).concat([dbUtil.nowIso(), id]);
      db.prepare(
        'UPDATE company_accounts SET ' + keys.map(function (k) { return k + ' = ?'; }).join(', ') + ', updated_at = ? WHERE id = ?'
      ).run(...values);
      return this.getCompanyAccount(id);
    },
    async deleteCompanyAccount(id) {
      const info = db.prepare('DELETE FROM company_accounts WHERE id = ?').run(id);
      return info.changes > 0;
    },
    async convertSalesDoc(id, type) {
      const current = await this.getSalesDoc(id);
      if (!current) return null;
      const next = Object.assign({}, current, {
        type: type,
        number: '',
        status: 'draft',
        id: undefined
      });
      if (type === 'invoice' && current.type === 'order' && !next.soNumber) {
        next.soNumber = current.number;
      }
      return this.createSalesDoc(next);
    },
    async getColumnPrefs(adminId) {
      const { parseColPrefs } = require('./column-prefs');
      const row = db.prepare('SELECT prefs FROM admin_column_prefs WHERE admin_id = ?').get(adminId);
      return parseColPrefs(row && row.prefs);
    },
    async getOwnerColumnPrefs() {
      const owner = db.prepare("SELECT id FROM admins WHERE role = 'owner' ORDER BY id ASC LIMIT 1").get();
      if (!owner) return {};
      return this.getColumnPrefs(owner.id);
    },
    async saveColumnPrefs(adminId, prefs) {
      const { sanitizeColPrefs, parseColPrefs } = require('./column-prefs');
      const json = JSON.stringify(sanitizeColPrefs(prefs));
      db.prepare(`
        INSERT INTO admin_column_prefs (admin_id, prefs, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(admin_id) DO UPDATE SET prefs = excluded.prefs, updated_at = excluded.updated_at
      `).run(adminId, json, dbUtil.nowIso());
      return parseColPrefs(json);
    },
    async saveUpload(file) {
      const prepared = await img.prepareUpload(file);
      const name = Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex') + prepared.ext;
      fs.writeFileSync(path.join(UPLOAD_DIR, name), prepared.buffer);
      return '/uploads/products/' + name;
    },
    async getDashboardHome(admin) {
      return require('./dashboard-home').getSqliteDashboardHome(db, admin);
    }
  };
  Object.assign(api, require('./walls').sqliteApi(db));
  Object.assign(api, require('./company-chat').sqliteApi(db));
  Object.assign(api, require('./company-crm').sqliteApi(db, api));
  Object.assign(api, require('./company-emails').sqliteApi(db));
  Object.assign(api, require('./gmail-accounts').sqliteApi(db));
  Object.assign(api, require('./dealer-portal').sqliteApi(db, api));
  Object.assign(api, require('./site-analytics').sqliteApi(db));
  return api;
}

module.exports = { createSqliteStore };
