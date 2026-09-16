const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const CACHE_DIR = path.join(ROOT, 'data', 'img-cache');
const UPLOAD_DIR = path.join(ROOT, 'uploads', 'products');
const MAX_WIDTH = 1600;
const FETCH_MS = 12000;
const MAX_BYTES = 24 * 1024 * 1024;

let sharpLib = null;
try {
  sharpLib = require('sharp');
} catch (e) {
  sharpLib = null;
}

function hasSharp() {
  return !!sharpLib;
}

async function toWebp(buffer, width) {
  if (!sharpLib) return null;
  const w = Math.min(MAX_WIDTH, Math.max(32, Number(width) || 1000));
  return sharpLib(buffer, { failOn: 'none', animated: false })
    .rotate()
    .resize({ width: w, height: w, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();
}

function allowedLocalPath(rel) {
  const cleaned = String(rel || '').replace(/^\/+/, '').replace(/\\/g, '/').split('?')[0].split('#')[0];
  if (cleaned.includes('..') || path.isAbsolute(cleaned)) return null;
  if (!/^(assets|uploads\/products)\//.test(cleaned)) return null;
  const abs = path.resolve(ROOT, cleaned);
  const assetsRoot = path.resolve(ROOT, 'assets') + path.sep;
  const uploadRoot = path.resolve(ROOT, 'uploads', 'products') + path.sep;
  if (abs === path.resolve(ROOT, 'assets') || abs === path.resolve(ROOT, 'uploads', 'products')) return null;
  if (abs.startsWith(assetsRoot) || abs.startsWith(uploadRoot)) return abs;
  return null;
}

function allowedRemoteUrl(raw) {
  let parsed;
  try {
    parsed = new URL(String(raw || ''));
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password) return null;
  const host = parsed.hostname.toLowerCase();
  if (!host.endsWith('.supabase.co')) return null;
  if (!parsed.pathname.includes('/storage/v1/object/public/product-images/')) return null;
  return parsed.toString();
}

function fetchHttps(url) {
  return new Promise(function (resolve, reject) {
    const req = https.get(url, { timeout: FETCH_MS }, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400) {
        res.resume();
        reject(new Error('Unexpected redirect'));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error('Image HTTP ' + res.statusCode));
        return;
      }
      const chunks = [];
      let size = 0;
      res.on('data', function (c) {
        size += c.length;
        if (size > MAX_BYTES) {
          req.destroy();
          reject(new Error('Image too large'));
          return;
        }
        chunks.push(c);
      });
      res.on('end', function () { resolve(Buffer.concat(chunks)); });
      res.on('error', reject);
    });
    req.on('timeout', function () {
      req.destroy();
      reject(new Error('Image fetch timeout'));
    });
    req.on('error', reject);
  });
}

function cacheKey(src, width) {
  return crypto.createHash('sha1').update(String(width) + '|' + String(src)).digest('hex') + '.webp';
}

async function loadSource(src) {
  const remote = allowedRemoteUrl(src);
  if (remote) return fetchHttps(remote);
  const local = allowedLocalPath(src);
  if (local && fs.existsSync(local)) return fs.readFileSync(local);
  throw new Error('Image source not allowed.');
}

function sniffType(buf) {
  if (!buf || buf.length < 12) return '';
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (buf.slice(0, 3).toString('ascii') === 'GIF') return 'image/gif';
  return '';
}

function extForType(type, originalname) {
  if (type === 'image/jpeg') return '.jpg';
  if (type === 'image/png') return '.png';
  if (type === 'image/webp') return '.webp';
  if (type === 'image/gif') return '.gif';
  const fromName = path.extname(originalname || '').toLowerCase();
  if (fromName === '.jpeg') return '.jpg';
  if (fromName === '.jpg' || fromName === '.png' || fromName === '.webp' || fromName === '.gif') return fromName;
  return '.jpg';
}

async function displayBuffer(src, width) {
  const w = Math.min(MAX_WIDTH, Math.max(32, Number(width) || 1000));
  const key = cacheKey(src, w);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const dest = path.join(CACHE_DIR, key);
  if (fs.existsSync(dest)) {
    const cached = fs.readFileSync(dest);
    return { buffer: cached, type: sniffType(cached) || 'image/webp' };
  }
  const original = await loadSource(src);
  const out = (await toWebp(original, w)) || original;
  try { fs.writeFileSync(dest, out); } catch (e) { /* ignore cache write */ }
  return { buffer: out, type: sniffType(out) || 'image/webp' };
}

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  return UPLOAD_DIR;
}

function newUploadName(ext) {
  const suffix = String(ext || '.jpg').toLowerCase();
  const safe = suffix === '.jpeg' ? '.jpg' : (suffix.charAt(0) === '.' ? suffix : '.' + suffix);
  return Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex') + safe;
}

function sanitizeUploadName(name) {
  const raw = String(name || '').split(/[\\/]/).pop().split('?')[0].split('#')[0];
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]/g, '');
  if (!cleaned || cleaned === '.' || cleaned === '..') return '';
  return cleaned;
}

function writeLocalUpload(name, buffer) {
  const safe = sanitizeUploadName(name);
  if (!safe) throw new Error('Could not save image file.');
  if (!buffer || !buffer.length) throw new Error('Missing image file.');
  ensureUploadDir();
  fs.writeFileSync(path.join(UPLOAD_DIR, safe), buffer);
  return '/uploads/products/' + safe;
}

function objectNameFromUrl(src) {
  const raw = String(src || '').trim();
  if (!raw) return '';
  try {
    if (/^https?:/i.test(raw)) {
      const u = new URL(raw);
      return sanitizeUploadName(decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || ''));
    }
  } catch (e) { /* fall through */ }
  const cleaned = raw.split('?')[0].split('#')[0];
  return sanitizeUploadName(cleaned.split('/').filter(Boolean).pop() || '');
}

function normalizePublicPath(src) {
  const raw = String(src || '').trim();
  if (!raw) return '';
  if (/^https?:/i.test(raw)) return raw;
  const cleaned = raw.replace(/\\/g, '/').replace(/^\.\//, '');
  return cleaned.charAt(0) === '/' ? cleaned.split('?')[0] : '/' + cleaned.split('?')[0];
}

function isAssetPath(src) {
  const p = normalizePublicPath(src);
  return /^\/assets\//i.test(p);
}

function isUploadPath(src) {
  const p = normalizePublicPath(src);
  return /^\/uploads\/products\//i.test(p);
}

function localFileExists(src) {
  const abs = allowedLocalPath(src);
  return !!(abs && fs.existsSync(abs));
}

function storageUrlForName(name) {
  const safe = sanitizeUploadName(name);
  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  if (!base || !safe) return '';
  return base + '/storage/v1/object/public/product-images/products/' + safe;
}

function publicUploadUrl(saved) {
  if (!saved) return '';
  if (typeof saved === 'string') return saved;
  return String(saved.publicUrl || saved.url || '');
}

function storageUploadUrl(saved) {
  if (!saved || typeof saved === 'string') return '';
  return String(saved.storageUrl || '');
}

async function prepareUpload(file) {
  const buffer = file && file.buffer;
  if (!buffer || !buffer.length) throw new Error('Missing image file.');
  const type = sniffType(buffer) || file.mimetype || 'image/jpeg';
  return {
    buffer: buffer,
    ext: extForType(type, file.originalname),
    contentType: type
  };
}

function knownStorageMap(details, storageByPublic) {
  const map = Object.assign({}, storageByPublic || {});
  const d = details && typeof details === 'object' ? details : {};
  function remember(pub, stor) {
    const s = String(stor || '').trim();
    if (!s) return;
    if (pub) map[String(pub)] = s;
    const n = objectNameFromUrl(pub) || objectNameFromUrl(s);
    if (n) map[n] = s;
  }
  remember(null, d.storageImage);
  (Array.isArray(d.storageGallery) ? d.storageGallery : []).forEach(function (s) {
    remember(null, s);
  });
  Object.keys(storageByPublic || {}).forEach(function (pub) {
    remember(pub, storageByPublic[pub]);
  });
  return map;
}

function lookupStorage(src, map) {
  if (!src || !map) return '';
  if (map[src]) return map[src];
  const n = objectNameFromUrl(src);
  if (n && map[n]) return map[n];
  return '';
}

async function writeRemoteToLocal(remote, name) {
  const safe = sanitizeUploadName(name) || newUploadName('.jpg');
  const dest = '/uploads/products/' + safe;
  if (!localFileExists(dest)) {
    const buf = await fetchHttps(remote);
    writeLocalUpload(safe, buf);
  }
  return dest;
}

async function ensureLocalPublicCopy(src, knownStorage) {
  const raw = String(src || '').trim();
  if (!raw) return { publicUrl: '', storageUrl: '' };

  const remote = allowedRemoteUrl(raw);
  if (remote) {
    const name = objectNameFromUrl(remote) || newUploadName('.jpg');
    try {
      const publicUrl = await writeRemoteToLocal(remote, name);
      return { publicUrl: publicUrl, storageUrl: remote };
    } catch (err) {
      console.error('Could not copy product photo locally:', err.message || err);
      return { publicUrl: remote, storageUrl: remote };
    }
  }

  const localRel = normalizePublicPath(raw);
  if (isAssetPath(localRel)) {
    return { publicUrl: raw, storageUrl: allowedRemoteUrl(knownStorage) || '' };
  }

  if (isUploadPath(localRel)) {
    const name = objectNameFromUrl(localRel);
    const storage = allowedRemoteUrl(knownStorage) || allowedRemoteUrl(storageUrlForName(name)) || '';
    if (!localFileExists(localRel) && storage) {
      try {
        await writeRemoteToLocal(storage, name);
        return { publicUrl: localRel, storageUrl: storage };
      } catch (err) {
        console.error('Could not restore product photo:', err.message || err);
        return { publicUrl: storage, storageUrl: storage };
      }
    }
    return { publicUrl: localRel, storageUrl: storage };
  }

  return { publicUrl: raw, storageUrl: allowedRemoteUrl(knownStorage) || '' };
}

function preferLocalOrRemote(src, knownStorage) {
  const local = String(src || '').trim();
  if (!local) return '';
  const pathRel = normalizePublicPath(local);
  if (isUploadPath(pathRel) && !localFileExists(pathRel)) {
    const remote = allowedRemoteUrl(knownStorage) || allowedRemoteUrl(storageUrlForName(objectNameFromUrl(pathRel)));
    if (remote) return remote;
  }
  return pathRel || local;
}

function samePublicUrl(a, b) {
  const x = String(a || '').trim();
  const y = String(b || '').trim();
  if (x === y) return true;
  if (/^https?:/i.test(x) || /^https?:/i.test(y)) return x === y;
  const nx = x ? (x.charAt(0) === '/' ? x : '/' + x) : '';
  const ny = y ? (y.charAt(0) === '/' ? y : '/' + y) : '';
  return nx === ny;
}

function galleriesEqual(a, b) {
  const x = Array.isArray(a) ? a : [];
  const y = Array.isArray(b) ? b : [];
  if (x.length !== y.length) return false;
  for (let i = 0; i < x.length; i += 1) {
    if (!samePublicUrl(x[i], y[i])) return false;
  }
  return true;
}

function storageListsEqual(a, b) {
  return galleriesEqual(
    Array.isArray(a) ? a : (a ? [a] : []),
    Array.isArray(b) ? b : (b ? [b] : [])
  );
}

function mediaNeedsPersist(rowImage, rowGallery, details, next) {
  const d = details && typeof details === 'object' ? details : {};
  if (!samePublicUrl(rowImage, next.image)) return true;
  if (!galleriesEqual(rowGallery, next.gallery)) return true;
  if (String(d.storageImage || '') !== String(next.storageImage || '')) return true;
  if (!storageListsEqual(d.storageGallery, next.storageGallery)) return true;
  return false;
}

function applyStorageToDetails(details, media) {
  const next = details && typeof details === 'object' ? details : {};
  if (!media) return next;
  if (Object.prototype.hasOwnProperty.call(media, 'storageImage')) {
    const value = String(media.storageImage || '').trim();
    if (value) next.storageImage = value;
    else delete next.storageImage;
  }
  if (Object.prototype.hasOwnProperty.call(media, 'storageGallery')) {
    const list = Array.isArray(media.storageGallery)
      ? media.storageGallery.map(function (u) { return String(u || '').trim(); }).filter(Boolean)
      : [];
    if (list.length) next.storageGallery = list;
    else delete next.storageGallery;
  }
  return next;
}

async function materializeMedia(media, opts) {
  const image = String((media && media.image) || '').trim();
  const gallery = Array.isArray(media && media.gallery)
    ? media.gallery.map(function (url) { return String(url || '').trim(); }).filter(Boolean)
    : [];
  const details = (opts && opts.details) || {};
  const map = knownStorageMap(details, (opts && opts.storageByPublic) || {});

  async function one(src) {
    return ensureLocalPublicCopy(src, lookupStorage(src, map) || allowedRemoteUrl(src) || '');
  }

  const hero = image ? await one(image) : { publicUrl: '', storageUrl: '' };
  const gals = [];
  for (let i = 0; i < gallery.length; i += 1) {
    gals.push(await one(gallery[i]));
  }
  const publicGallery = gals.map(function (g) { return g.publicUrl; }).filter(Boolean);
  const storageGallery = [];
  gals.forEach(function (g) {
    if (g.storageUrl && g.storageUrl !== hero.storageUrl && storageGallery.indexOf(g.storageUrl) === -1) {
      storageGallery.push(g.storageUrl);
    }
  });
  return {
    image: hero.publicUrl,
    gallery: publicGallery,
    storageImage: hero.storageUrl || '',
    storageGallery: storageGallery
  };
}

function catalogMediaUrls(rowImage, rowGallery, details) {
  const d = details && typeof details === 'object' ? details : {};
  const map = knownStorageMap(d, {});
  const image = preferLocalOrRemote(rowImage, lookupStorage(rowImage, map) || d.storageImage);
  const gallery = (Array.isArray(rowGallery) ? rowGallery : []).map(function (url) {
    return preferLocalOrRemote(url, lookupStorage(url, map));
  }).filter(Boolean);
  return { image: image, gallery: gallery };
}

module.exports = {
  hasSharp,
  toWebp,
  prepareUpload,
  displayBuffer,
  allowedRemoteUrl,
  allowedLocalPath,
  ensureUploadDir,
  newUploadName,
  writeLocalUpload,
  publicUploadUrl,
  storageUploadUrl,
  ensureLocalPublicCopy,
  preferLocalOrRemote,
  materializeMedia,
  applyStorageToDetails,
  mediaNeedsPersist,
  galleriesEqual,
  samePublicUrl,
  catalogMediaUrls,
  UPLOAD_DIR,
  MAX_BYTES
};
