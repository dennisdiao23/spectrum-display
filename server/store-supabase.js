const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
const dbUtil = require('./db');
const img = require('./image');

const BUCKET = 'product-images';

function throwIf(error, fallback) {
  if (!error) return;
  throw new Error(error.message || fallback || 'Supabase error');
}

async function seedAdminRoles(supabase) {
  const { count, error } = await supabase.from('admin_roles').select('id', { count: 'exact', head: true });
  if (error) throwIf(error, 'Could not read admin roles.');
  if (count) return;
  const { error: insErr } = await supabase.from('admin_roles').insert([
    { slug: 'owner', name: 'Owner', website_access: 'edit', inventory_access: 'edit', locked: true },
    { slug: 'website', name: 'Website', website_access: 'edit', inventory_access: 'view', locked: false },
    { slug: 'inventory', name: 'Inventory', website_access: 'none', inventory_access: 'edit', locked: false }
  ]);
  throwIf(insErr, 'Could not seed admin roles.');
}

function createSupabaseStore() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const adminSecret = process.env.SPECTRUM_ADMIN_SECRET || '';
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: adminSecret ? { headers: { 'x-spectrum-admin': adminSecret } } : {}
  });

  async function seedIfEmpty() {
    const { error } = await supabase.from('products').select('id', { count: 'exact', head: true });
    throwIf(error, 'Could not read products. Run server/supabase-schema.sql in the Supabase SQL editor.');
    try {
      await upsertMissingCatalog();
    } catch (e) {
      console.error('Could not backfill missing catalog series:', e.message || e);
    }

    const { count: adminCount, error: aErr } = await supabase.from('admins').select('id', { count: 'exact', head: true });
    throwIf(aErr, 'Could not read admins table.');
    if (!adminCount) {
      const email = (process.env.ADMIN_EMAIL || 'admin@spectrumdisplay.com').trim().toLowerCase();
      const password = process.env.ADMIN_PASSWORD || 'ChangeMe!Admin';
      const name = process.env.ADMIN_NAME || 'Spectrum Admin';
      const { error: insErr } = await supabase.from('admins').insert({
        email,
        name,
        password_hash: bcrypt.hashSync(password, 10),
        role: 'owner'
      });
      throwIf(insErr, 'Could not seed admin account.');
      console.log('Seeded admin account: ' + email);
    }

    try {
      await seedAdminRoles(supabase);
    } catch (e) {
      console.error('Could not seed admin roles:', e.message || e);
    }

    try {
      await supabase.storage.createBucket(BUCKET, { public: true });
    } catch (e) { /* bucket may already exist */ }

    try {
      await fillMissingProductDetails();
    } catch (e) {
      console.error('Could not fill product details:', e.message || e);
    }

    try {
      await rewriteExistingCabinetCopy();
    } catch (e) {
      console.error('Could not rename cabinet copy to panel:', e.message || e);
    }

    try {
      await migrateLegacyInventory();
    } catch (e) {
      console.error('Could not migrate inventory bins to SKUs:', e.message || e);
    }

    try {
      await ensureCatalogSkus();
    } catch (e) {
      console.error('Could not seed inventory SKUs from website products:', e.message || e);
    }
  }

  async function upsertMissingCatalog() {
    const brands = dbUtil.loadSeedBrands();
    const { data: existingRows, error: eErr } = await supabase.from('products').select('brand_id, series_id');
    throwIf(eErr, 'Could not read products for catalog backfill.');
    const have = {};
    (existingRows || []).forEach(function (r) {
      have[r.brand_id + '/' + r.series_id] = true;
    });
    let added = 0;
    for (let bi = 0; bi < brands.length; bi++) {
      const brand = brands[bi];
      const { error: bErr } = await supabase.from('brands').upsert({
        id: brand.id,
        name: brand.name,
        tagline: brand.tagline || ''
      });
      throwIf(bErr, 'Could not seed brand ' + brand.id);
      const rows = [];
      (brand.series || []).forEach(function (s, si) {
        if (have[brand.id + '/' + s.id]) return;
        const isControl = s.type === 'control' || brand.id === 'novastar' || !!s.subtype;
        rows.push({
          brand_id: brand.id,
          series_id: s.id,
          name: s.name,
          pitches: s.pitches || [],
          price_per_m2: Number(isControl ? (s.priceEach || s.pricePerM2) : s.pricePerM2) || 0,
          weight_per_m2: s.weightPerM2 || 0,
          power_avg: s.powerAvg || 0,
          power_max: s.powerMax || 0,
          cabinet_w: isControl ? 0 : (s.cabinetW || 0.5),
          cabinet_h: isControl ? 0 : (s.cabinetH || 0.5),
          type: isControl ? 'control' : (s.type || 'Fixed'),
          description: s.description || '',
          badge: s.badge || '',
          image: s.image || '',
          gallery: [],
          details: dbUtil.detailsFromSeries(s),
          sort_order: bi * 40 + si
        });
      });
      if (rows.length) {
        const { error: pErr } = await supabase.from('products').insert(rows);
        throwIf(pErr, 'Could not backfill products for ' + brand.id);
        added += rows.length;
      }
    }
    if (added) console.log('Added ' + added + ' missing catalog series from seed files');
  }

  async function fillMissingProductDetails() {
    const packPath = path.join(__dirname, 'product-details.json');
    if (!fs.existsSync(packPath)) return;
    const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));
    const byKey = {};
    pack.forEach(function (r) {
      byKey[r.brand_id + '/' + r.series_id] = r.details || {};
    });
    const { data: products, error } = await supabase.from('products').select('id, brand_id, series_id, details');
    throwIf(error, 'Could not read products for details fill.');
    for (let i = 0; i < (products || []).length; i++) {
      const row = products[i];
      const extra = byKey[row.brand_id + '/' + row.series_id];
      if (!extra) continue;
      const current = dbUtil.parseDetails(row);
      const next = dbUtil.mergeProductDetails(current, extra);
      if (JSON.stringify(next) === JSON.stringify(current)) continue;
      const { error: upErr } = await supabase.from('products').update({ details: next }).eq('id', row.id);
      throwIf(upErr, 'Could not fill product details for ' + row.series_id);
    }
  }

  async function rewriteExistingCabinetCopy() {
    const { data: products, error } = await supabase
      .from('products')
      .select('id, description, badge, details');
    throwIf(error, 'Could not read products for cabinet-to-panel copy.');
    let n = 0;
    for (let i = 0; i < (products || []).length; i++) {
      const row = products[i];
      const desc = dbUtil.rewriteCabinetCopy(row.description || '');
      const badge = dbUtil.rewriteCabinetCopy(row.badge || '');
      const details = dbUtil.rewriteCabinetCopy(dbUtil.parseDetails(row));
      if (
        desc === (row.description || '') &&
        badge === (row.badge || '') &&
        JSON.stringify(details) === JSON.stringify(dbUtil.parseDetails(row))
      ) {
        continue;
      }
      const { error: upErr } = await supabase
        .from('products')
        .update({ description: desc, badge: badge, details: details })
        .eq('id', row.id);
      throwIf(upErr, 'Could not rename cabinet copy for product ' + row.id);
      n += 1;
    }
    if (n) console.log('Renamed cabinet copy to panel on ' + n + ' products');
  }

  async function migrateLegacyInventory() {
    const inv = require('./inventory');
    const { count: itemCount, error: cErr } = await supabase
      .from('inventory_items')
      .select('id', { count: 'exact', head: true });
    if (cErr) return;
    if (itemCount) return;
    const { data: stocks, error: sErr } = await supabase.from('inventory_stock').select('*');
    if (sErr || !(stocks || []).length) return;
    const products = await listProductsUnmapped();
    const byId = {};
    products.forEach(function (p) { byId[String(p.dbId)] = p; });
    const keyToItemId = {};
    for (let i = 0; i < stocks.length; i++) {
      const row = stocks[i];
      const product = byId[String(row.product_id)];
      const pitch = inv.pitchKey(row.pitch);
      const control = product ? inv.isControlProduct(product) : !pitch;
      const unit = control ? 'each' : 'panels';
      const { data: created, error: iErr } = await supabase.from('inventory_items').insert({
        sku: inv.suggestedSku({
          brandId: product && product.brandId,
          seriesId: product && product.id,
          name: product ? inv.skuNameFromProduct(product, pitch) : ('Item ' + row.product_id),
          pitch: pitch
        }),
        name: product ? inv.skuNameFromProduct(product, pitch) : ('Item ' + row.product_id),
        brand_id: product ? (product.brandId || '') : '',
        pitch: pitch,
        unit: unit,
        qty: Math.max(0, Number(row.qty) || 0),
        low_at: row.low_at != null ? Number(row.low_at) : inv.defaultLowAt(unit),
        price: inv.priceFromProduct(product),
        notes: '',
        updated_at: row.updated_at || new Date().toISOString()
      }).select('id').single();
      throwIf(iErr, 'Could not migrate inventory item.');
      keyToItemId[String(row.product_id) + '|' + pitch] = created.id;
      if (product) {
        const { error: mErr } = await supabase.from('product_inventory_map').upsert({
          product_id: Number(row.product_id),
          pitch: pitch,
          item_id: created.id
        }, { onConflict: 'product_id,pitch' });
        throwIf(mErr, 'Could not map migrated inventory item.');
      }
    }
    const { data: moves } = await supabase.from('inventory_moves').select('*').order('id');
    for (let i = 0; i < (moves || []).length; i++) {
      const m = moves[i];
      const itemId = keyToItemId[String(m.product_id) + '|' + inv.pitchKey(m.pitch)];
      if (!itemId) continue;
      const { error: mvErr } = await supabase.from('inventory_item_moves').insert({
        item_id: itemId,
        kind: String(m.kind || ''),
        qty_delta: Number(m.qty_delta) || 0,
        qty_after: Number(m.qty_after) || 0,
        note: m.note || '',
        admin_email: m.admin_email || '',
        created_at: m.created_at || new Date().toISOString()
      });
      throwIf(mvErr, 'Could not migrate inventory history.');
    }
    console.log('Migrated ' + stocks.length + ' catalog stock bins into inventory items');
  }

  async function listProductsUnmapped() {
    const { data: brands, error: bErr } = await supabase.from('brands').select('id, name');
    throwIf(bErr);
    const brandMap = {};
    (brands || []).forEach(function (b) { brandMap[b.id] = b; });
    const { data: products, error: pErr } = await supabase
      .from('products')
      .select('*')
      .order('brand_id')
      .order('sort_order')
      .order('name');
    throwIf(pErr);
    return (products || []).map(function (row) { return dbUtil.rowToProduct(row, brandMap[row.brand_id]); });
  }

  async function ensureCatalogSkus() {
    const inv = require('./inventory');
    const { data: items, error: iErr } = await supabase.from('inventory_items').select('id, sku, name, brand_id, pitch');
    if (iErr) return;
    const taken = {};
    (items || []).forEach(function (row) {
      const sku = inv.normalizeSku(row.sku);
      if (sku) taken[sku] = true;
    });
    const stamp = new Date().toISOString();
    for (let i = 0; i < (items || []).length; i++) {
      const row = items[i];
      if (inv.normalizeSku(row.sku)) continue;
      const sku = inv.uniqueSku(inv.suggestedSku({
        brandId: row.brand_id,
        name: row.name,
        pitch: row.pitch
      }), taken);
      taken[sku] = true;
      const { error: uErr } = await supabase.from('inventory_items').update({ sku: sku, updated_at: stamp }).eq('id', row.id);
      throwIf(uErr, 'Could not save inventory SKU.');
    }
    const products = await listProductsUnmapped();
    const { data: maps, error: mErr } = await supabase.from('product_inventory_map').select('product_id, pitch');
    if (mErr) return;
    const { data: skuRows } = await supabase.from('inventory_items').select('sku');
    const plan = inv.catalogSkuPlan(products, maps || [], (skuRows || []).map(function (r) { return r.sku; }));
    for (let i = 0; i < plan.length; i++) {
      const row = plan[i];
      const { data: created, error: cErr } = await supabase.from('inventory_items').insert({
        sku: row.sku,
        name: row.name,
        brand_id: row.brandId,
        pitch: row.pitch,
        unit: row.unit,
        qty: 0,
        low_at: row.lowAt,
        price: row.price,
        notes: '',
        updated_at: stamp
      }).select('id').single();
      throwIf(cErr, 'Could not create inventory SKU ' + row.sku);
      const { error: mapErr } = await supabase.from('product_inventory_map').upsert({
        product_id: Number(row.productId),
        pitch: row.pitch,
        item_id: created.id
      }, { onConflict: 'product_id,pitch' });
      throwIf(mapErr, 'Could not map inventory SKU ' + row.sku);
    }
    if (plan.length) console.log('Created ' + plan.length + ' inventory SKUs from website products');
  }

  async function loadInventoryMaps() {
    const { data, error } = await supabase
      .from('product_inventory_map')
      .select('product_id, pitch, item_id, products(name, series_id, brand_id)');
    if (error) {
      const { data: plain, error: pErr } = await supabase
        .from('product_inventory_map')
        .select('product_id, pitch, item_id');
      throwIf(pErr, 'Could not read inventory links.');
      return plain || [];
    }
    return (data || []).map(function (row) {
      const p = row.products || {};
      return {
        product_id: row.product_id,
        pitch: row.pitch,
        item_id: row.item_id,
        product_name: p.name || '',
        series_id: p.series_id || '',
        brand_id: p.brand_id || ''
      };
    });
  }

  async function attachInventoryToCatalog(catalog) {
    const inv = require('./inventory');
    const { data: items, error: iErr } = await supabase.from('inventory_items').select('*');
    if (iErr) return catalog;
    const { data: maps, error: mErr } = await supabase.from('product_inventory_map').select('*');
    if (mErr) return catalog;
    return inv.applyToCatalog(catalog, maps || [], items || []);
  }

  async function attachMapsToListedProducts(products) {
    const inv = require('./inventory');
    const { data: maps, error } = await supabase
      .from('product_inventory_map')
      .select('product_id, pitch, item_id');
    if (error) return products;
    return inv.attachMapsToProducts(products, maps || []);
  }

  async function formatInventoryRow(row, maps) {
    const inv = require('./inventory');
    let brandName = row.brand_id || '';
    if (row.brand_id) {
      const { data: brand } = await supabase.from('brands').select('name').eq('id', row.brand_id).maybeSingle();
      if (brand && brand.name) brandName = brand.name;
    }
    return inv.formatItem(row, brandName, maps || []);
  }

  async function getInventoryItemDetail(id) {
    const inv = require('./inventory');
    const { data: row, error } = await supabase.from('inventory_items').select('*').eq('id', id).maybeSingle();
    throwIf(error, 'Could not read inventory.');
    if (!row) return null;
    const maps = (await loadInventoryMaps()).filter(function (m) {
      return String(m.item_id) === String(id);
    });
    const byItem = inv.mapsByItem(maps);
    const { data: moves, error: mErr } = await supabase
      .from('inventory_item_moves')
      .select('*')
      .eq('item_id', id)
      .order('created_at', { ascending: false })
      .limit(40);
    throwIf(mErr, 'Could not read inventory history.');
    return { item: await formatInventoryRow(row, byItem[String(row.id)] || []), moves: moves || [] };
  }

  return {
    name: 'supabase',
    ready: seedIfEmpty(),
    async getCatalogStock() {
      const inv = require('./inventory');
      const { data: items, error: iErr } = await supabase.from('inventory_items').select('*');
      if (iErr) return {};
      const { data: maps, error: mErr } = await supabase.from('product_inventory_map').select('*');
      if (mErr) return {};
      return inv.catalogStock(maps || [], items || []);
    },
    async getCatalog() {
      const { data: brands, error: bErr } = await supabase.from('brands').select('id, name, tagline').order('name');
      throwIf(bErr);
      const { data: products, error: pErr } = await supabase.from('products').select('*').order('sort_order').order('name');
      throwIf(pErr);
      const byBrand = {};
      (brands || []).forEach((b) => {
        byBrand[b.id] = { name: b.name, tagline: b.tagline || '', series: [] };
      });
      (products || []).forEach((row) => {
        if (dbUtil.isProductHidden(row)) return;
        if (!byBrand[row.brand_id]) {
          byBrand[row.brand_id] = { name: row.brand_id, tagline: '', series: [] };
        }
        byBrand[row.brand_id].series.push(dbUtil.rowToProduct(row, { name: byBrand[row.brand_id].name }));
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
      return attachInventoryToCatalog(byBrand);
    },
    async listProducts() {
      const products = await listProductsUnmapped();
      return attachMapsToListedProducts(products);
    },
    async getProduct(id) {
      const { data: row, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
      throwIf(error);
      if (!row) return null;
      const { data: brand } = await supabase.from('brands').select('id, name').eq('id', row.brand_id).maybeSingle();
      const product = dbUtil.rowToProduct(row, brand);
      await attachMapsToListedProducts([product]);
      return product;
    },
    async getProductByBrandSeries(brand, series) {
      const { data: row, error } = await supabase
        .from('products')
        .select('*')
        .eq('brand_id', brand)
        .eq('series_id', series)
        .maybeSingle();
      throwIf(error);
      if (!row) return null;
      return this.getProduct(row.id);
    },
    async listBrands() {
      const { data, error } = await supabase.from('brands').select('id, name, tagline').order('name');
      throwIf(error);
      return data || [];
    },
    async ensureBrand(id, name, tagline) {
      const { data: existing, error } = await supabase.from('brands').select('id').eq('id', id).maybeSingle();
      throwIf(error);
      if (!existing) {
        const { error: insErr } = await supabase.from('brands').insert({ id, name: name || id, tagline: tagline || '' });
        throwIf(insErr);
      } else if (name) {
        const patch = { name };
        if (tagline != null) patch.tagline = tagline;
        const { error: upErr } = await supabase.from('brands').update(patch).eq('id', id);
        throwIf(upErr);
      }
      return id;
    },
    async insertProduct(p) {
      const { data, error } = await supabase.from('products').insert({
        brand_id: p.brandId,
        series_id: p.seriesId,
        name: p.name,
        pitches: p.pitches,
        price_per_m2: p.price,
        weight_per_m2: p.weight,
        power_avg: p.powerAvg,
        power_max: p.powerMax,
        cabinet_w: p.cabinetW,
        cabinet_h: p.cabinetH,
        type: p.type,
        description: p.description,
        badge: p.badge,
        image: p.image,
        gallery: p.gallery,
        details: p.details || {},
        sort_order: 0
      }).select('id').single();
      throwIf(error);
      return this.getProduct(data.id);
    },
    async updateProduct(id, p) {
      const { error } = await supabase.from('products').update({
        brand_id: p.brandId,
        series_id: p.seriesId,
        name: p.name,
        pitches: p.pitches,
        price_per_m2: p.price,
        weight_per_m2: p.weight,
        power_avg: p.powerAvg,
        power_max: p.powerMax,
        cabinet_w: p.cabinetW,
        cabinet_h: p.cabinetH,
        type: p.type,
        description: p.description,
        badge: p.badge,
        image: p.image,
        gallery: p.gallery,
        details: p.details || {},
        updated_at: new Date().toISOString()
      }).eq('id', id);
      throwIf(error);
      return this.getProduct(id);
    },
    async deleteProduct(id) {
      const { data, error } = await supabase.from('products').delete().eq('id', id).select('id');
      throwIf(error);
      return !!(data && data.length);
    },
    async setProductHidden(id, hidden) {
      const { data, error } = await supabase
        .from('products')
        .update({ hidden: !!hidden, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('id');
      throwIf(error);
      if (!data || !data.length) return null;
      return this.getProduct(id);
    },
    async getRawProduct(id) {
      const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
      throwIf(error);
      return data || null;
    },
    async attachRole(admin) {
      if (!admin) return null;
      const { data } = await supabase.from('admin_roles').select('*').eq('slug', admin.role).maybeSingle();
      if (!data) return admin;
      return Object.assign({}, admin, {
        role_name: data.name,
        website_access: data.website_access,
        inventory_access: data.inventory_access,
        role_locked: data.locked
      });
    },
    async getAdminByEmail(email) {
      const { data, error } = await supabase.from('admins').select('*').eq('email', email).maybeSingle();
      throwIf(error);
      return this.attachRole(data);
    },
    async createSession(token, adminId, expiresAt) {
      const { error } = await supabase.from('sessions').insert({
        token,
        admin_id: adminId,
        expires_at: expiresAt
      });
      throwIf(error);
    },
    async getSession(token) {
      const { data, error } = await supabase
        .from('sessions')
        .select('expires_at, admins ( id, email, name, role )')
        .eq('token', token)
        .maybeSingle();
      throwIf(error);
      if (!data || !data.admins) return null;
      const admin = await this.attachRole({
        id: data.admins.id,
        email: data.admins.email,
        name: data.admins.name,
        role: data.admins.role,
        expires_at: data.expires_at
      });
      return admin;
    },
    async deleteSession(token) {
      const { error } = await supabase.from('sessions').delete().eq('token', token);
      throwIf(error);
    },
    async listAdmins() {
      const { publicAdmin } = require('./admin-roles');
      const { data, error } = await supabase.from('admins').select('id, email, name, role, created_at').order('name');
      throwIf(error);
      const out = [];
      for (const row of data || []) {
        out.push(publicAdmin(await this.attachRole(row)));
      }
      return out;
    },
    async createAdmin(input) {
      const { publicAdmin } = require('./admin-roles');
      const { data, error } = await supabase.from('admins').insert({
        email: input.email,
        name: input.name,
        password_hash: input.passwordHash,
        role: input.role
      }).select('id, email, name, role, created_at').single();
      throwIf(error);
      return publicAdmin(await this.attachRole(data));
    },
    async updateAdmin(id, input) {
      const { publicAdmin } = require('./admin-roles');
      const { data: current, error: cErr } = await supabase.from('admins').select('*').eq('id', id).maybeSingle();
      throwIf(cErr);
      if (!current) return null;
      const patch = {};
      if (input.name != null) patch.name = input.name;
      if (input.role != null) patch.role = input.role;
      if (input.passwordHash) patch.password_hash = input.passwordHash;
      const { data, error } = await supabase.from('admins').update(patch).eq('id', id)
        .select('id, email, name, role, created_at').single();
      throwIf(error);
      return publicAdmin(await this.attachRole(data));
    },
    async deleteAdmin(id) {
      const { error: sErr } = await supabase.from('sessions').delete().eq('admin_id', id);
      throwIf(sErr);
      const { data, error } = await supabase.from('admins').delete().eq('id', id).select('id');
      throwIf(error);
      return !!(data && data.length);
    },
    async countAdminsByRole(role) {
      const { count, error } = await supabase.from('admins').select('id', { count: 'exact', head: true }).eq('role', role);
      throwIf(error);
      return Number(count) || 0;
    },
    async listRoles() {
      const { publicRole } = require('./admin-roles');
      await seedAdminRoles(supabase);
      const { data, error } = await supabase.from('admin_roles').select('*').order('name');
      throwIf(error);
      const { data: admins } = await supabase.from('admins').select('role');
      const counts = {};
      (admins || []).forEach(function (row) {
        counts[row.role] = (counts[row.role] || 0) + 1;
      });
      return (data || []).sort(function (a, b) {
        if (!!b.locked !== !!a.locked) return a.locked ? -1 : 1;
        return String(a.name).localeCompare(String(b.name));
      }).map(function (row) {
        return publicRole(row, counts[row.slug] || 0);
      });
    },
    async getRole(id) {
      const { publicRole } = require('./admin-roles');
      const { data, error } = await supabase.from('admin_roles').select('*').eq('id', id).maybeSingle();
      throwIf(error);
      if (!data) return null;
      const { count } = await supabase.from('admins').select('id', { count: 'exact', head: true }).eq('role', data.slug);
      return publicRole(data, count);
    },
    async getRoleBySlug(slug) {
      const { publicRole } = require('./admin-roles');
      const { data, error } = await supabase.from('admin_roles').select('*').eq('slug', slug).maybeSingle();
      throwIf(error);
      return data ? publicRole(data, 0) : null;
    },
    async createRole(input) {
      const { accessLevel, slugifyRole, publicRole } = require('./admin-roles');
      let slug = slugifyRole(input.name);
      let n = 2;
      while (true) {
        const { data } = await supabase.from('admin_roles').select('id').eq('slug', slug).maybeSingle();
        if (!data) break;
        slug = slugifyRole(input.name) + '-' + n;
        n += 1;
      }
      const { data, error } = await supabase.from('admin_roles').insert({
        slug: slug,
        name: input.name,
        website_access: accessLevel(input.website),
        inventory_access: accessLevel(input.inventory),
        locked: false
      }).select('*').single();
      throwIf(error);
      return publicRole(data, 0);
    },
    async updateRole(id, input) {
      const { accessLevel, publicRole } = require('./admin-roles');
      const { data: current, error: cErr } = await supabase.from('admin_roles').select('*').eq('id', id).maybeSingle();
      throwIf(cErr);
      if (!current) return null;
      const patch = { name: input.name != null ? input.name : current.name };
      if (current.locked) {
        patch.website_access = 'edit';
        patch.inventory_access = 'edit';
      } else {
        patch.website_access = accessLevel(input.website != null ? input.website : current.website_access);
        patch.inventory_access = accessLevel(input.inventory != null ? input.inventory : current.inventory_access);
      }
      const { data, error } = await supabase.from('admin_roles').update(patch).eq('id', id).select('*').single();
      throwIf(error);
      const { count } = await supabase.from('admins').select('id', { count: 'exact', head: true }).eq('role', current.slug);
      return publicRole(data, count);
    },
    async deleteRole(id) {
      const { data: current, error: cErr } = await supabase.from('admin_roles').select('*').eq('id', id).maybeSingle();
      throwIf(cErr);
      if (!current) return { ok: false, reason: 'missing' };
      if (current.locked) return { ok: false, reason: 'locked' };
      const { count } = await supabase.from('admins').select('id', { count: 'exact', head: true }).eq('role', current.slug);
      if (count) return { ok: false, reason: 'in-use', userCount: count };
      const { error } = await supabase.from('admin_roles').delete().eq('id', id);
      throwIf(error);
      return { ok: true };
    },
    async listAccounts() {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, name, role, company, phone, created_at, updated_at')
        .order('created_at', { ascending: false });
      throwIf(error, 'Could not list accounts.');
      const [tiers, overrides] = await Promise.all([
        this.listPriceTiers(),
        supabase.from('account_price_overrides').select('user_id, markup_pct')
      ]);
      if (overrides.error) console.error('account_price_overrides', overrides.error.message);
      const overrideMap = {};
      (overrides.data || []).forEach(function (row) {
        overrideMap[row.user_id] = Number(row.markup_pct);
      });
      return (data || []).map(function (row) {
        const role = row.role === 'dealer' || row.role === 'sales' ? row.role : 'customer';
        const typePct = Number(tiers[role]) || 0;
        const hasOverride = Object.prototype.hasOwnProperty.call(overrideMap, row.id);
        const overridePct = hasOverride ? overrideMap[row.id] : null;
        return Object.assign({}, row, {
          type_markup_pct: typePct,
          markup_override_pct: overridePct,
          effective_markup_pct: hasOverride ? overridePct : typePct
        });
      });
    },
    async getAccount(id) {
      const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
      throwIf(error, 'Could not load account.');
      if (!profile) return null;
      const [projects, panels, orders] = await Promise.all([
        supabase.from('saved_projects').select('*').eq('user_id', id).order('updated_at', { ascending: false }),
        supabase.from('custom_panels').select('*').eq('user_id', id).order('updated_at', { ascending: false }),
        supabase.from('orders').select('*').eq('user_id', id).order('created_at', { ascending: false })
      ]);
      if (projects.error) console.error('saved_projects', projects.error.message);
      if (panels.error) console.error('custom_panels', panels.error.message);
      if (orders.error) console.error('orders', orders.error.message);
      const tiers = await this.listPriceTiers();
      const role = profile.role === 'dealer' || profile.role === 'sales' ? profile.role : 'customer';
      const { data: overrideRow, error: overrideErr } = await supabase
        .from('account_price_overrides')
        .select('markup_pct')
        .eq('user_id', id)
        .maybeSingle();
      if (overrideErr) console.error('account_price_overrides', overrideErr.message);
      const typePct = Number(tiers[role]) || 0;
      const hasOverride = !!(overrideRow && overrideRow.markup_pct != null);
      const overridePct = hasOverride ? Number(overrideRow.markup_pct) : null;
      profile.type_markup_pct = typePct;
      profile.markup_override_pct = overridePct;
      profile.effective_markup_pct = hasOverride ? overridePct : typePct;
      return {
        profile: profile,
        projects: projects.error ? [] : (projects.data || []),
        panels: panels.error ? [] : (panels.data || []),
        orders: orders.error ? [] : (orders.data || [])
      };
    },
    async updateAccount(id, patch) {
      const allowed = { updated_at: new Date().toISOString() };
      if (patch.role === 'customer' || patch.role === 'dealer' || patch.role === 'sales') {
        allowed.role = patch.role;
      }
      if (patch.name != null) allowed.name = String(patch.name).trim();
      if (patch.company != null) allowed.company = String(patch.company).trim();
      if (patch.phone != null) allowed.phone = String(patch.phone).trim();
      const { data, error } = await supabase
        .from('profiles')
        .update(allowed)
        .eq('id', id)
        .select('*')
        .maybeSingle();
      throwIf(error, 'Could not update account.');
      if (Object.prototype.hasOwnProperty.call(patch, 'markup_pct')) {
        await this.setAccountMarkup(id, patch.markup_pct);
      }
      return this.getAccount(id).then(function (account) {
        return account && account.profile;
      });
    },
    clampMarkupPct: function (value) {
      if (value == null || value === '') return null;
      const n = Number(value);
      if (!Number.isFinite(n)) return null;
      return Math.max(-50, Math.min(500, Math.round(n * 100) / 100));
    },
    async listPriceTiers() {
      const { data, error } = await supabase.from('price_tiers').select('role, markup_pct');
      throwIf(error, 'Could not load price tiers.');
      const map = { customer: 0, dealer: 0, sales: 0 };
      (data || []).forEach(function (row) {
        if (row.role === 'customer' || row.role === 'dealer' || row.role === 'sales') {
          const n = Number(row.markup_pct);
          map[row.role] = Number.isFinite(n) ? n : 0;
        }
      });
      return map;
    },
    async savePriceTiers(tiers) {
      const now = new Date().toISOString();
      const rows = ['customer', 'dealer', 'sales'].map(function (role) {
        const pct = this.clampMarkupPct(tiers && tiers[role]);
        return {
          role: role,
          markup_pct: pct == null ? 0 : pct,
          updated_at: now
        };
      }, this);
      const { error } = await supabase.from('price_tiers').upsert(rows);
      throwIf(error, 'Could not save price tiers.');
      return this.listPriceTiers();
    },
    async setAccountMarkup(id, value) {
      if (value == null || value === '') {
        const { error } = await supabase.from('account_price_overrides').delete().eq('user_id', id);
        throwIf(error, 'Could not clear account markup.');
        return null;
      }
      const pct = this.clampMarkupPct(value);
      if (pct == null) throw new Error('Markup % must be a number.');
      const { error } = await supabase.from('account_price_overrides').upsert({
        user_id: id,
        markup_pct: pct,
        updated_at: new Date().toISOString()
      });
      throwIf(error, 'Could not save account markup.');
      return pct;
    },
    async saveContactInquiry(inquiry) {
      const { error } = await supabase.from('contact_inquiries').insert({
        name: inquiry.name,
        company: inquiry.company || '',
        email: inquiry.email,
        phone: inquiry.phone || '',
        project_type: inquiry.projectType || '',
        message: inquiry.message || ''
      });
      throwIf(error, 'Could not save the inquiry.');
      return true;
    },
    async listInventory() {
      const inv = require('./inventory');
      const { data: items, error } = await supabase
        .from('inventory_items')
        .select('*')
        .order('name')
        .order('pitch');
      throwIf(error, 'Could not read inventory.');
      const [maps, brandRows] = await Promise.all([
        loadInventoryMaps(),
        supabase.from('brands').select('id, name')
      ]);
      if (brandRows.error) throwIf(brandRows.error, 'Could not read brands.');
      const brandNames = {};
      (brandRows.data || []).forEach(function (b) {
        brandNames[b.id] = b.name;
      });
      const byItem = inv.mapsByItem(maps);
      return (items || []).map(function (row) {
        return inv.formatItem(row, brandNames[row.brand_id] || row.brand_id || '', byItem[String(row.id)] || []);
      });
    },
    async getInventoryItem(id) {
      return getInventoryItemDetail(id);
    },
    async createInventoryItem(payload) {
      const inv = require('./inventory');
      const input = inv.normalizeItemInput(payload);
      const { data: skuRows } = await supabase.from('inventory_items').select('sku');
      const taken = {};
      (skuRows || []).forEach(function (r) {
        if (r.sku) taken[inv.normalizeSku(r.sku)] = true;
      });
      input.sku = inv.uniqueSku(input.sku || inv.suggestedSku({
        brandId: input.brandId,
        name: input.name,
        pitch: input.pitch
      }), taken);
      const stamp = new Date().toISOString();
      const fields = Object.assign(inv.dbFieldsFromInput(input), {
        created_at: stamp,
        updated_at: stamp
      });
      const { data, error } = await supabase.from('inventory_items').insert(fields).select('id').single();
      throwIf(error, 'Could not create inventory item.');
      if (input.qty) {
        const { error: mErr } = await supabase.from('inventory_item_moves').insert({
          item_id: data.id,
          kind: 'count',
          qty_delta: input.qty,
          qty_after: input.qty,
          note: 'Opening qty',
          admin_email: ''
        });
        throwIf(mErr, 'Could not save inventory history.');
      }
      return getInventoryItemDetail(data.id);
    },
    async updateInventoryItem(id, payload) {
      const inv = require('./inventory');
      const { data: current, error: cErr } = await supabase.from('inventory_items').select('*').eq('id', id).maybeSingle();
      throwIf(cErr, 'Could not read inventory.');
      if (!current) return null;
      const input = inv.normalizeItemInput(payload, { patch: true });
      const patch = { updated_at: new Date().toISOString() };
      if (input.sku != null) {
        if (!input.sku) throw new Error('SKU is required.');
        const { data: clash, error: clashErr } = await supabase
          .from('inventory_items')
          .select('id')
          .eq('sku', input.sku)
          .neq('id', id)
          .maybeSingle();
        throwIf(clashErr, 'Could not check SKU.');
        if (clash) throw new Error('That SKU is already in use.');
        patch.sku = input.sku;
      }
      if (input.name != null) patch.name = input.name;
      if (input.brandId != null) patch.brand_id = input.brandId;
      if (input.pitch != null) patch.pitch = input.pitch;
      if (input.unit != null) patch.unit = input.unit;
      if (input.lowAt != null) patch.low_at = input.lowAt;
      if (input.price != null) patch.price = input.price;
      if (input.cost != null) patch.cost = input.cost;
      if (input.dealerNet != null) patch.dealer_net = input.dealerNet;
      if (input.weight != null) patch.weight = input.weight;
      if (input.panelW != null) patch.panel_w = input.panelW;
      if (input.panelH != null) patch.panel_h = input.panelH;
      if (input.description != null) patch.description = input.description;
      if (input.image != null) patch.image = input.image;
      if (input.notes != null) patch.notes = input.notes;
      const { error } = await supabase.from('inventory_items').update(patch).eq('id', id);
      throwIf(error, 'Could not save inventory item.');
      return getInventoryItemDetail(id);
    },
    async deleteInventoryItem(id) {
      const inv = require('./inventory');
      const { data: current, error: cErr } = await supabase
        .from('inventory_items')
        .select('qty')
        .eq('id', id)
        .maybeSingle();
      throwIf(cErr, 'Could not read inventory.');
      if (!current) return false;
      const { count, error: mErr } = await supabase
        .from('inventory_item_moves')
        .select('id', { count: 'exact', head: true })
        .eq('item_id', id);
      throwIf(mErr, 'Could not read inventory history.');
      inv.assertCanDelete(current, count || 0);
      const { data, error } = await supabase.from('inventory_items').delete().eq('id', id).select('id');
      throwIf(error, 'Could not delete inventory item.');
      return !!(data && data.length);
    },
    async adjustInventory(id, payload, adminEmail) {
      const inv = require('./inventory');
      const { data: current, error: cErr } = await supabase.from('inventory_items').select('*').eq('id', id).maybeSingle();
      throwIf(cErr, 'Could not read inventory.');
      if (!current) return null;
      const curQty = Math.max(0, Number(current.qty) || 0);
      const nextLow = payload && payload.lowAt != null && payload.lowAt !== ''
        ? Math.max(0, Math.round(Number(payload.lowAt)))
        : Number(current.low_at);
      if (!isFinite(nextLow)) throw new Error('Low-at must be a number.');
      const change = inv.applyKind(payload && payload.kind, payload && payload.qty, curQty);
      const stamp = new Date().toISOString();
      const { error: uErr } = await supabase.from('inventory_items').update({
        qty: change.next,
        low_at: nextLow,
        updated_at: stamp
      }).eq('id', id);
      throwIf(uErr, 'Could not save inventory.');
      const { error: mErr } = await supabase.from('inventory_item_moves').insert({
        item_id: Number(id),
        kind: String(payload.kind || '').toLowerCase(),
        qty_delta: change.delta,
        qty_after: change.next,
        note: String((payload && payload.note) || '').trim().slice(0, 240),
        admin_email: String(adminEmail || '').trim().slice(0, 120)
      });
      throwIf(mErr, 'Could not save inventory history.');
      return getInventoryItemDetail(id);
    },
    async setProductInventoryMaps(productId, maps) {
      const inv = require('./inventory');
      const product = await this.getProduct(productId);
      if (!product) return null;
      const rows = inv.normalizeMaps(maps);
      const { error: dErr } = await supabase.from('product_inventory_map').delete().eq('product_id', productId);
      throwIf(dErr, 'Could not update inventory links.');
      if (rows.length) {
        const { error: iErr } = await supabase.from('product_inventory_map').insert(rows.map(function (row) {
          return { product_id: Number(productId), pitch: row.pitch, item_id: row.itemId };
        }));
        throwIf(iErr, 'Could not save inventory links.');
      }
      return this.getProduct(productId);
    },
    async listCompanyCustomers() {
      const cc = require('./company-customers');
      const { data, error } = await supabase
        .from('company_customers')
        .select('*')
        .order('company_name', { ascending: true })
        .order('contact_last', { ascending: true });
      throwIf(error, 'Could not list customers.');
      return (data || []).map(cc.formatCustomer);
    },
    async getCompanyCustomer(id) {
      const cc = require('./company-customers');
      const { data, error } = await supabase.from('company_customers').select('*').eq('id', id).maybeSingle();
      throwIf(error, 'Could not load customer.');
      return cc.formatCustomer(data);
    },
    async createCompanyCustomer(payload) {
      const cc = require('./company-customers');
      const input = cc.normalizeCustomer(payload);
      const fields = cc.forSupabase(cc.dbFields(input));
      const stamp = new Date().toISOString();
      fields.created_at = stamp;
      fields.updated_at = stamp;
      const { data, error } = await supabase.from('company_customers').insert(fields).select('*').single();
      throwIf(error, 'Could not add customer.');
      return cc.formatCustomer(data);
    },
    async updateCompanyCustomer(id, payload) {
      const cc = require('./company-customers');
      const input = cc.normalizeCustomer(payload);
      const fields = cc.forSupabase(cc.dbFields(input));
      fields.updated_at = new Date().toISOString();
      const { data, error } = await supabase.from('company_customers').update(fields).eq('id', id).select('*').maybeSingle();
      throwIf(error, 'Could not save customer.');
      return cc.formatCustomer(data);
    },
    async deleteCompanyCustomer(id) {
      const { data, error } = await supabase.from('company_customers').delete().eq('id', id).select('id');
      throwIf(error, 'Could not delete customer.');
      return !!(data && data.length);
    },
    async listSalesDocs(type) {
      const sales = require('./company-sales');
      let q = supabase.from('company_sales_docs').select('*').order('id', { ascending: false });
      if (type) q = q.eq('type', type);
      const { data, error } = await q;
      throwIf(error, 'Could not list sales documents.');
      const ids = (data || []).map(function (row) { return row.id; });
      let linesByDoc = {};
      if (ids.length) {
        const { data: lines, error: lErr } = await supabase
          .from('company_sales_lines')
          .select('*')
          .in('doc_id', ids)
          .order('sort_order', { ascending: true });
        throwIf(lErr, 'Could not list sales lines.');
        (lines || []).forEach(function (line) {
          const key = String(line.doc_id);
          if (!linesByDoc[key]) linesByDoc[key] = [];
          linesByDoc[key].push(line);
        });
      }
      return (data || []).map(function (row) {
        return sales.formatDoc(row, linesByDoc[String(row.id)] || []);
      });
    },
    async getSalesDoc(id) {
      const sales = require('./company-sales');
      const { data, error } = await supabase.from('company_sales_docs').select('*').eq('id', id).maybeSingle();
      throwIf(error, 'Could not load sales document.');
      if (!data) return null;
      const { data: lines, error: lErr } = await supabase
        .from('company_sales_lines')
        .select('*')
        .eq('doc_id', id)
        .order('sort_order', { ascending: true });
      throwIf(lErr, 'Could not load sales lines.');
      return sales.formatDoc(data, lines || []);
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
      const existingRows = await supabase.from('company_sales_docs').select('number').eq('type', input.type);
      throwIf(existingRows.error, 'Could not assign document number.');
      if (!input.number) {
        input.number = sales.nextDocNumber((existingRows.data || []).map(function (r) { return r.number; }), input.type);
      }
      const { data: taken } = await supabase.from('company_sales_docs').select('id').eq('number', input.number).maybeSingle();
      if (taken) throw new Error('That document number is already used.');
      const fields = sales.dbDocFields(input);
      const stamp = new Date().toISOString();
      fields.created_at = stamp;
      fields.updated_at = stamp;
      const { data, error } = await supabase.from('company_sales_docs').insert(fields).select('*').single();
      throwIf(error, 'Could not create sales document.');
      if (input.lines.length) {
        const { error: lErr } = await supabase.from('company_sales_lines').insert(input.lines.map(function (line, i) {
          return {
            doc_id: data.id,
            sku: line.sku,
            description: line.description,
            qty: line.qty,
            unit_price: line.unitPrice,
            sort_order: i
          };
        }));
        throwIf(lErr, 'Could not save line items.');
      }
      return this.getSalesDoc(data.id);
    },
    async updateSalesDoc(id, payload) {
      const sales = require('./company-sales');
      const current = await this.getSalesDoc(id);
      if (!current) return null;
      const input = sales.normalizeDoc(Object.assign({}, payload, {
        type: payload.type || current.type,
        number: payload.number || current.number
      }));
      const { data: taken } = await supabase.from('company_sales_docs').select('id').eq('number', input.number).neq('id', id).maybeSingle();
      if (taken) throw new Error('That document number is already used.');
      const fields = sales.dbDocFields(input);
      fields.updated_at = new Date().toISOString();
      const { error } = await supabase.from('company_sales_docs').update(fields).eq('id', id);
      throwIf(error, 'Could not save sales document.');
      const { error: dErr } = await supabase.from('company_sales_lines').delete().eq('doc_id', id);
      throwIf(dErr, 'Could not replace line items.');
      if (input.lines.length) {
        const { error: lErr } = await supabase.from('company_sales_lines').insert(input.lines.map(function (line, i) {
          return {
            doc_id: Number(id),
            sku: line.sku,
            description: line.description,
            qty: line.qty,
            unit_price: line.unitPrice,
            sort_order: i
          };
        }));
        throwIf(lErr, 'Could not save line items.');
      }
      return this.getSalesDoc(id);
    },
    async deleteSalesDoc(id) {
      await supabase.from('company_sales_lines').delete().eq('doc_id', id);
      const { data, error } = await supabase.from('company_sales_docs').delete().eq('id', id).select('id');
      throwIf(error, 'Could not delete sales document.');
      return !!(data && data.length);
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
      return this.createSalesDoc(next);
    },
    async saveUpload(file) {
      const prepared = await img.prepareUpload(file);
      const name = Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex') + prepared.ext;
      const objectPath = 'products/' + name;
      const { error } = await supabase.storage.from(BUCKET).upload(objectPath, prepared.buffer, {
        contentType: prepared.contentType,
        upsert: false
      });
      throwIf(error, 'Could not upload image to Supabase Storage.');
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
      return data.publicUrl;
    }
  };
}

module.exports = { createSupabaseStore };
