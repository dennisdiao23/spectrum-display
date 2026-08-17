require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { getStore } = require('./store');

const ROOT = path.join(__dirname, '..');
const COOKIE = 'spectrum_admin';
const SESSION_DAYS = 7;
const PORT = Number(process.env.PORT || 3000);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 8 },
  fileFilter: function (_req, file, cb) {
    const ok = /^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype || '');
    cb(ok ? null : new Error('Only JPG, PNG, WebP, or GIF images are allowed.'), ok);
  }
});

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function parseJson(value, fallback) {
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value || '');
  } catch {
    return fallback;
  }
}

function parsePitches(value) {
  if (Array.isArray(value)) {
    return value.map(Number).filter((n) => Number.isFinite(n) && n > 0);
  }
  return String(value || '')
    .split(/[, ]+/)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
}

function mmToMeters(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0.5;
  return n > 20 ? n / 1000 : n;
}

async function main() {
  const store = await getStore();

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use('/uploads', express.static(path.join(ROOT, 'uploads')));

  async function currentAdmin(req) {
    const token = req.cookies[COOKIE];
    if (!token) return null;
    const row = await store.getSession(token);
    if (!row) return null;
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await store.deleteSession(token);
      return null;
    }
    return row;
  }

  async function requireAdmin(req, res, next) {
    try {
      const admin = await currentAdmin(req);
      if (!admin) return res.status(401).json({ ok: false, error: 'Admin sign-in required.' });
      req.admin = admin;
      next();
    } catch (err) {
      next(err);
    }
  }

  async function saveFiles(files) {
    const uploaded = files || {};
    let imageUrl = '';
    const gallery = [];
    if (uploaded.image && uploaded.image[0]) {
      imageUrl = await store.saveUpload(uploaded.image[0]);
    }
    if (uploaded.gallery) {
      for (const file of uploaded.gallery) {
        gallery.push(await store.saveUpload(file));
      }
    }
    return { imageUrl, gallery };
  }

  async function productPayload(body, files, existing) {
    const name = String(body.name || '').trim();
    if (!name) throw new Error('Product name is required.');
    const brandId = slugify(body.brandId || body.brand_id || body.brandName || body.brand_name);
    const brandName = String(body.brandName || body.brand_name || '').trim();
    if (!brandId && !brandName) throw new Error('Brand is required.');
    const resolvedBrand = await store.ensureBrand(
      brandId || slugify(brandName),
      brandName || brandId,
      body.tagline
    );
    const seriesId = slugify(body.seriesId || body.series_id || name);
    if (!seriesId) throw new Error('Series / model id is required.');
    const pitches = parsePitches(body.pitches);
    if (!pitches.length) throw new Error('Add at least one pixel pitch.');
    const existingGallery = existing ? parseJson(existing.gallery, []) : [];
    let image = existing ? (existing.image || '') : '';
    const saved = await saveFiles(files);
    if (saved.imageUrl) image = saved.imageUrl;
    else if (body.imageUrl) image = String(body.imageUrl).trim();
    const gallery = existingGallery.concat(saved.gallery);
    return {
      brandId: resolvedBrand,
      seriesId,
      name,
      pitches,
      price: Number(body.pricePerM2 || body.price_per_m2) || 0,
      weight: Number(body.weightPerM2 || body.weight_per_m2) || 0,
      powerAvg: Number(body.powerAvg || body.power_avg) || 0,
      powerMax: Number(body.powerMax || body.power_max) || 0,
      cabinetW: mmToMeters(body.cabinetWmm || body.cabinet_w || body.cabinetW),
      cabinetH: mmToMeters(body.cabinetHmm || body.cabinet_h || body.cabinetH),
      type: String(body.type || 'Fixed').trim() || 'Fixed',
      description: String(body.description || '').trim(),
      badge: String(body.badge || '').trim(),
      image,
      gallery
    };
  }

  app.get('/api/config', function (_req, res) {
    res.json({
      ok: true,
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ''
    });
  });

  app.get('/api/catalog', async function (_req, res, next) {
    try {
      res.json({ ok: true, products: await store.getCatalog() });
    } catch (err) { next(err); }
  });

  app.get('/api/products', async function (_req, res, next) {
    try {
      res.json({ ok: true, products: await store.listProducts() });
    } catch (err) { next(err); }
  });

  app.get('/api/products/:brand/:series', async function (req, res, next) {
    try {
      const product = await store.getProductByBrandSeries(req.params.brand, req.params.series);
      if (!product) return res.status(404).json({ ok: false, error: 'Product not found.' });
      res.json({ ok: true, product: product, brandName: product.brandName });
    } catch (err) { next(err); }
  });

  app.get('/api/admin/me', async function (req, res, next) {
    try {
      const admin = await currentAdmin(req);
      if (!admin) return res.json({ ok: false, admin: null });
      res.json({ ok: true, admin: { id: admin.id, email: admin.email, name: admin.name } });
    } catch (err) { next(err); }
  });

  app.post('/api/admin/login', async function (req, res, next) {
    try {
      const email = String(req.body.email || '').trim().toLowerCase();
      const password = String(req.body.password || '');
      const admin = await store.getAdminByEmail(email);
      if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
        return res.status(401).json({ ok: false, error: 'Invalid email or password.' });
      }
      const token = crypto.randomBytes(24).toString('hex');
      const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
      await store.createSession(token, admin.id, expires);
      res.cookie(COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: SESSION_DAYS * 86400000
      });
      res.json({ ok: true, admin: { id: admin.id, email: admin.email, name: admin.name } });
    } catch (err) { next(err); }
  });

  app.post('/api/admin/logout', async function (req, res, next) {
    try {
      const token = req.cookies[COOKIE];
      if (token) await store.deleteSession(token);
      res.clearCookie(COOKIE);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  app.get('/api/admin/brands', requireAdmin, async function (_req, res, next) {
    try {
      res.json({ ok: true, brands: await store.listBrands() });
    } catch (err) { next(err); }
  });

  app.get('/api/admin/products', requireAdmin, async function (_req, res, next) {
    try {
      res.json({ ok: true, products: await store.listProducts() });
    } catch (err) { next(err); }
  });

  app.get('/api/admin/products/:id', requireAdmin, async function (req, res, next) {
    try {
      const product = await store.getProduct(req.params.id);
      if (!product) return res.status(404).json({ ok: false, error: 'Product not found.' });
      res.json({ ok: true, product: product });
    } catch (err) { next(err); }
  });

  const productUpload = upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'gallery', maxCount: 6 }
  ]);

  app.post('/api/admin/products', requireAdmin, productUpload, async function (req, res, next) {
    try {
      const p = await productPayload(req.body, req.files, null);
      const product = await store.insertProduct(p);
      res.json({ ok: true, product: product });
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: err.message && /unique|duplicate/i.test(err.message)
          ? 'A product with that brand and series id already exists.'
          : (err.message || 'Could not save product.')
      });
    }
  });

  app.put('/api/admin/products/:id', requireAdmin, productUpload, async function (req, res, next) {
    try {
      const existing = await store.getRawProduct(req.params.id);
      if (!existing) return res.status(404).json({ ok: false, error: 'Product not found.' });
      const p = await productPayload(req.body, req.files, existing);
      const product = await store.updateProduct(req.params.id, p);
      res.json({ ok: true, product: product });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message || 'Could not update product.' });
    }
  });

  app.delete('/api/admin/products/:id', requireAdmin, async function (req, res, next) {
    try {
      const ok = await store.deleteProduct(req.params.id);
      if (!ok) return res.status(404).json({ ok: false, error: 'Product not found.' });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  app.use(express.static(ROOT));

  app.use(function (err, _req, res, _next) {
    res.status(400).json({ ok: false, error: err.message || 'Upload failed.' });
  });

  app.listen(PORT, '0.0.0.0', function () {
    console.log('Spectrum Display running on port ' + PORT);
    console.log('Admin: /admin.html');
  });
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
