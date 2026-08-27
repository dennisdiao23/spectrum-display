require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { getStore } = require('./store');
const { sendContactEmail, sendDealerInquiryEmail, mailConfigured } = require('./mail');

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

const dealerInquiryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: function (_req, file, cb) {
    const ok = /^(application\/pdf|image\/(jpeg|png))$/i.test(file.mimetype || '');
    cb(ok ? null : new Error('Resale certificate must be PDF, JPG, or PNG (max 10MB).'), ok);
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
  app.use(function (req, res, next) {
    const host = String(req.hostname || '').toLowerCase();
    const file = String(req.path || '').toLowerCase();
    const privatePage = file === '/admin.html' || file === '/cart.html' || file === '/account.html';
    if (host.endsWith('.up.railway.app') || privatePage) {
      res.set('X-Robots-Tag', 'noindex, nofollow');
    }
    next();
  });
  app.use('/uploads', express.static(path.join(ROOT, 'uploads')));

  const SITE = 'https://www.spectrumdisplay.com';

  function xmlEscape(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function sitemapUrl(loc, changefreq, priority, lastmod) {
    return (
      '  <url>\n' +
      '    <loc>' + xmlEscape(loc) + '</loc>\n' +
      (lastmod ? '    <lastmod>' + lastmod + '</lastmod>\n' : '') +
      '    <changefreq>' + changefreq + '</changefreq>\n' +
      '    <priority>' + priority + '</priority>\n' +
      '  </url>\n'
    );
  }

  app.get('/sitemap.xml', async function (_req, res) {
    const today = new Date().toISOString().slice(0, 10);
    let xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    [
      ['/', 'weekly', '1.0'],
      ['/products.html', 'weekly', '0.9'],
      ['/control.html', 'weekly', '0.8'],
      ['/solutions.html', 'monthly', '0.8'],
      ['/designer.html', 'monthly', '0.8'],
      ['/dealer.html', 'monthly', '0.7'],
      ['/contact.html', 'monthly', '0.7'],
      ['/support.html', 'monthly', '0.6'],
      ['/warranty.html', 'monthly', '0.6'],
      ['/shipping.html', 'monthly', '0.6'],
      ['/privacy.html', 'monthly', '0.5'],
      ['/terms.html', 'monthly', '0.5']
    ].forEach(function (page) {
      xml += sitemapUrl(SITE + page[0], page[1], page[2], today);
    });
    try {
      const products = await store.listProducts();
      products.forEach(function (product) {
        const loc =
          SITE +
          '/product.html?brand=' +
          encodeURIComponent(product.brandId) +
          '&series=' +
          encodeURIComponent(product.id);
        xml += sitemapUrl(loc, 'weekly', '0.7', today);
      });
    } catch (err) {
      console.error('Could not add products to sitemap:', err.message || err);
    }
    xml += '</urlset>\n';
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  });

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

  const contactHits = new Map();
  function contactRateLimited(ip) {
    const now = Date.now();
    const windowMs = 60 * 60 * 1000;
    const list = (contactHits.get(ip) || []).filter((t) => now - t < windowMs);
    if (list.length >= 5) {
      contactHits.set(ip, list);
      return true;
    }
    list.push(now);
    contactHits.set(ip, list);
    return false;
  }

  app.post('/api/contact', async function (req, res, next) {
    try {
      if (String(req.body.website || '').trim()) {
        return res.json({ ok: true });
      }
      const ip = String(req.ip || req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
      if (contactRateLimited(ip)) {
        return res.status(429).json({ ok: false, error: 'Too many messages. Please try again later.' });
      }
      const inquiry = {
        name: String(req.body.name || '').trim().slice(0, 120),
        company: String(req.body.company || '').trim().slice(0, 160),
        email: String(req.body.email || '').trim().slice(0, 160),
        phone: String(req.body.phone || '').trim().slice(0, 60),
        projectType: String(req.body.projectType || '').trim().slice(0, 160),
        message: String(req.body.message || '').trim().slice(0, 4000)
      };
      if (!inquiry.name) return res.status(400).json({ ok: false, error: 'Name is required.' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inquiry.email)) {
        return res.status(400).json({ ok: false, error: 'A valid email is required.' });
      }
      try {
        await store.saveContactInquiry(inquiry);
      } catch (err) {
        console.error('Could not store contact inquiry:', err.message || err);
      }
      if (!mailConfigured()) {
        return res.status(503).json({
          ok: false,
          error: 'The contact form is not connected to email yet. Please try again later.'
        });
      }
      await sendContactEmail(inquiry);
      res.json({ ok: true });
    } catch (err) {
      console.error('Contact form error:', err.message || err);
      res.status(502).json({ ok: false, error: 'Could not send the message. Please try again.' });
    }
  });

  function parseListField(value) {
    if (Array.isArray(value)) {
      return value.map(String).map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 20);
    }
    if (value == null || value === '') return [];
    const raw = String(value).trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(String).map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 20);
      }
    } catch (_) { /* comma-separated */ }
    return raw.split(/[,|]/).map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 20);
  }

  function parseAddressFields(prefix, body) {
    function field(key) {
      const flat = body[prefix + '_' + key];
      return flat != null ? String(flat).trim().slice(0, 200) : '';
    }
    return {
      line1: field('line1'),
      line2: field('line2'),
      city: field('city'),
      state: field('state'),
      postal_code: field('postal_code'),
      country: field('country') || 'US'
    };
  }

  function truthy(value) {
    return value === true || value === 'true' || value === '1' || value === 'on' || value === 'yes';
  }

  app.post('/api/dealer-inquiry', dealerInquiryUpload.single('resale_certificate'), async function (req, res) {
    try {
      if (String(req.body.website || '').trim()) {
        return res.json({ ok: true });
      }
      const ip = String(req.ip || req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
      if (contactRateLimited(ip)) {
        return res.status(429).json({ ok: false, error: 'Too many messages. Please try again later.' });
      }
      const body = req.body || {};
      const companyAddress = parseAddressFields('company_address', body);
      const app = {
        contact_name: String(body.contact_name || '').trim().slice(0, 120),
        email: String(body.email || '').trim().slice(0, 160).toLowerCase(),
        phone: String(body.phone || '').trim().slice(0, 60),
        company_name: String(body.company_name || '').trim().slice(0, 160),
        website: String(body.website_url || body.company_website || '').trim().slice(0, 200),
        tax_id: String(body.tax_id || '').trim().slice(0, 80),
        years_in_business: String(body.years_in_business || '').trim().slice(0, 40),
        business_type: parseListField(body.business_type),
        primary_verticals: parseListField(body.primary_verticals),
        typical_job_size_m2: String(body.typical_job_size_m2 || '').trim().slice(0, 40),
        company_address: companyAddress,
        references_text: String(body.references_text || '').trim().slice(0, 4000),
        resale_certificate_name: ''
      };
      if (!app.contact_name) return res.status(400).json({ ok: false, error: 'Contact name is required.' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(app.email)) {
        return res.status(400).json({ ok: false, error: 'A valid email is required.' });
      }
      if (!app.company_name) return res.status(400).json({ ok: false, error: 'Company name is required.' });
      if (!app.phone) return res.status(400).json({ ok: false, error: 'Phone is required.' });
      if (!app.tax_id) return res.status(400).json({ ok: false, error: 'Tax ID is required.' });
      if (!companyAddress.line1 || !companyAddress.city || !companyAddress.state || !companyAddress.postal_code) {
        return res.status(400).json({ ok: false, error: 'Full company address is required.' });
      }
      const attachments = [];
      if (req.file && req.file.buffer) {
        const ext = path.extname(req.file.originalname || '').toLowerCase() || '.pdf';
        const safeName = 'resale-certificate' + (['.pdf', '.jpg', '.jpeg', '.png'].includes(ext) ? ext : '.pdf');
        app.resale_certificate_name = safeName;
        attachments.push({
          filename: safeName,
          content: req.file.buffer,
          contentType: req.file.mimetype || 'application/octet-stream'
        });
      }
      if (!mailConfigured()) {
        return res.status(503).json({
          ok: false,
          error: 'The dealer form is not connected to email yet. Please try again later or email sales@spectrumdisplay.com.'
        });
      }
      await sendDealerInquiryEmail(app, attachments);
      res.json({ ok: true });
    } catch (err) {
      console.error('Dealer inquiry error:', err.message || err);
      res.status(502).json({ ok: false, error: 'Could not send the application. Please try again.' });
    }
  });

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

  app.get('/api/admin/accounts', requireAdmin, async function (_req, res, next) {
    try {
      res.json({ ok: true, accounts: await store.listAccounts() });
    } catch (err) { next(err); }
  });

  app.get('/api/admin/accounts/:id', requireAdmin, async function (req, res, next) {
    try {
      const account = await store.getAccount(req.params.id);
      if (!account) return res.status(404).json({ ok: false, error: 'Account not found.' });
      res.json({ ok: true, account: account });
    } catch (err) { next(err); }
  });

  app.put('/api/admin/accounts/:id', requireAdmin, async function (req, res, next) {
    try {
      const body = req.body || {};
      const role = String(body.role || '').trim();
      if (role && role !== 'customer' && role !== 'dealer' && role !== 'sales') {
        return res.status(400).json({ ok: false, error: 'Account type must be customer, dealer, or sales.' });
      }
      const patch = {
        role: role || undefined,
        name: body.name,
        company: body.company,
        phone: body.phone
      };
      if (Object.prototype.hasOwnProperty.call(body, 'markup_pct')) {
        patch.markup_pct = body.markup_pct;
      }
      const updated = await store.updateAccount(req.params.id, patch);
      if (!updated) return res.status(404).json({ ok: false, error: 'Account not found.' });
      res.json({ ok: true, profile: updated });
    } catch (err) { next(err); }
  });

  app.get('/api/admin/price-tiers', requireAdmin, async function (_req, res, next) {
    try {
      res.json({ ok: true, tiers: await store.listPriceTiers() });
    } catch (err) { next(err); }
  });

  app.put('/api/admin/price-tiers', requireAdmin, async function (req, res, next) {
    try {
      const body = req.body || {};
      const tiers = await store.savePriceTiers(body.tiers || body);
      res.json({ ok: true, tiers: tiers });
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
