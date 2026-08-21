const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
const dbUtil = require('./db');

const SEED_PATH = path.join(__dirname, 'seed-catalog.json');
const BUCKET = 'product-images';

function throwIf(error, fallback) {
  if (!error) return;
  throw new Error(error.message || fallback || 'Supabase error');
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
    const { count, error } = await supabase.from('products').select('id', { count: 'exact', head: true });
    throwIf(error, 'Could not read products. Run server/supabase-schema.sql in the Supabase SQL editor.');
    if (!count) {
      const brands = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
      for (let bi = 0; bi < brands.length; bi++) {
        const brand = brands[bi];
        const { error: bErr } = await supabase.from('brands').upsert({
          id: brand.id,
          name: brand.name,
          tagline: brand.tagline || ''
        });
        throwIf(bErr, 'Could not seed brand ' + brand.id);
        const rows = (brand.series || []).map((s, si) => ({
          brand_id: brand.id,
          series_id: s.id,
          name: s.name,
          pitches: s.pitches || [],
          price_per_m2: s.pricePerM2 || 0,
          weight_per_m2: s.weightPerM2 || 0,
          power_avg: s.powerAvg || 0,
          power_max: s.powerMax || 0,
          cabinet_w: s.cabinetW || 0.5,
          cabinet_h: s.cabinetH || 0.5,
          type: s.type || 'Fixed',
          description: s.description || '',
          badge: s.badge || '',
          image: s.image || '',
          gallery: [],
          sort_order: bi * 20 + si
        }));
        if (rows.length) {
          const { error: pErr } = await supabase.from('products').insert(rows);
          throwIf(pErr, 'Could not seed products for ' + brand.id);
        }
      }
      console.log('Seeded Supabase catalog from server/seed-catalog.json');
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
        password_hash: bcrypt.hashSync(password, 10)
      });
      throwIf(insErr, 'Could not seed admin account.');
      console.log('Seeded admin account: ' + email);
    }

    try {
      await supabase.storage.createBucket(BUCKET, { public: true });
    } catch (e) { /* bucket may already exist */ }
  }

  return {
    name: 'supabase',
    ready: seedIfEmpty(),
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
        if (!byBrand[row.brand_id]) {
          byBrand[row.brand_id] = { name: row.brand_id, tagline: '', series: [] };
        }
        byBrand[row.brand_id].series.push(dbUtil.rowToProduct(row, { name: byBrand[row.brand_id].name }));
      });
      return byBrand;
    },
    async listProducts() {
      const { data: brands, error: bErr } = await supabase.from('brands').select('id, name');
      throwIf(bErr);
      const brandMap = {};
      (brands || []).forEach((b) => { brandMap[b.id] = b; });
      const { data: products, error: pErr } = await supabase
        .from('products')
        .select('*')
        .order('brand_id')
        .order('sort_order')
        .order('name');
      throwIf(pErr);
      return (products || []).map((row) => dbUtil.rowToProduct(row, brandMap[row.brand_id]));
    },
    async getProduct(id) {
      const { data: row, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
      throwIf(error);
      if (!row) return null;
      const { data: brand } = await supabase.from('brands').select('id, name').eq('id', row.brand_id).maybeSingle();
      return dbUtil.rowToProduct(row, brand);
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
    async getRawProduct(id) {
      const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
      throwIf(error);
      return data || null;
    },
    async getAdminByEmail(email) {
      const { data, error } = await supabase.from('admins').select('*').eq('email', email).maybeSingle();
      throwIf(error);
      return data || null;
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
        .select('expires_at, admins ( id, email, name )')
        .eq('token', token)
        .maybeSingle();
      throwIf(error);
      if (!data || !data.admins) return null;
      return {
        id: data.admins.id,
        email: data.admins.email,
        name: data.admins.name,
        expires_at: data.expires_at
      };
    },
    async deleteSession(token) {
      const { error } = await supabase.from('sessions').delete().eq('token', token);
      throwIf(error);
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
    async saveUpload(file) {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.jpg';
      const name = Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex') + safeExt;
      const objectPath = 'products/' + name;
      const { error } = await supabase.storage.from(BUCKET).upload(objectPath, file.buffer, {
        contentType: file.mimetype || 'image/jpeg',
        upsert: false
      });
      throwIf(error, 'Could not upload image to Supabase Storage.');
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
      return data.publicUrl;
    }
  };
}

module.exports = { createSupabaseStore };
