const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const CACHE_DIR = path.join(ROOT, 'data', 'img-cache');
const MAX_WIDTH = 1600;
const FETCH_MS = 12000;
const MAX_BYTES = 12 * 1024 * 1024;

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
  const cleaned = String(rel || '').replace(/^\/+/, '').replace(/\\/g, '/');
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
  if (!buf || buf.length < 12) return 'image/webp';
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (buf.slice(0, 3).toString('ascii') === 'GIF') return 'image/gif';
  return 'image/webp';
}

async function displayBuffer(src, width) {
  const w = Math.min(MAX_WIDTH, Math.max(32, Number(width) || 1000));
  const key = cacheKey(src, w);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const dest = path.join(CACHE_DIR, key);
  if (fs.existsSync(dest)) {
    const cached = fs.readFileSync(dest);
    return { buffer: cached, type: sniffType(cached) };
  }
  const original = await loadSource(src);
  const out = (await toWebp(original, w)) || original;
  try { fs.writeFileSync(dest, out); } catch (e) { /* ignore cache write */ }
  return { buffer: out, type: sniffType(out) };
}

async function prepareUpload(file) {
  const buffer = file && file.buffer;
  if (!buffer || !buffer.length) throw new Error('Missing image file.');
  if (!sharpLib) {
    return {
      buffer: buffer,
      ext: path.extname(file.originalname || '').toLowerCase() || '.jpg',
      contentType: file.mimetype || 'image/jpeg'
    };
  }
  const display = await toWebp(buffer, 1400);
  return { buffer: display, ext: '.webp', contentType: 'image/webp' };
}

module.exports = {
  hasSharp,
  toWebp,
  prepareUpload,
  displayBuffer,
  allowedRemoteUrl,
  allowedLocalPath
};
