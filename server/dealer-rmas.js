/**
 * Dealer return request. The dealer submits it. Spectrum reads it in Company.
 * This does not create a credit, a replacement order, or a shipping label.
 */

const path = require('path');

const REASONS = {
  defective: 'Defective',
  wrong: 'Wrong item',
  damaged: 'Damaged',
  other: 'Other'
};

function trim(value, max) {
  const text = String(value == null ? '' : value).trim();
  return max ? text.slice(0, max) : text;
}

function nowIso() {
  return new Date().toISOString();
}

function throwIf(error, message) {
  if (!error) return;
  throw new Error(message || error.message || 'Request failed.');
}

function dealerCustomerId(user) {
  const id = user && (user.customerId || user.customer_id);
  return id == null ? '' : String(id);
}

function reasonLabel(code) {
  return REASONS[code] || 'Other';
}

function parseLines(raw) {
  let list = raw;
  if (typeof raw === 'string') {
    try { list = JSON.parse(raw || '[]'); } catch (err) { list = []; }
  }
  if (!Array.isArray(list)) return [];
  return list.map(function (line) {
    return {
      sku: trim(line && line.sku, 80),
      qty: Math.max(0, Math.round(Number(line && line.qty) || 0))
    };
  }).filter(function (line) { return line.sku && line.qty > 0; });
}

function readInput(body) {
  const reason = trim(body && body.reason, 20);
  if (!REASONS[reason]) throw Object.assign(new Error('Choose a reason.'), { code: 'invalid' });
  const lines = parseLines(body && body.lines).slice(0, 40);
  if (!lines.length) throw Object.assign(new Error('Add at least one SKU and quantity.'), { code: 'invalid' });
  return {
    orderRef: trim(body && body.orderRef, 80),
    reason: reason,
    lines: lines,
    notes: trim(body && body.notes, 4000)
  };
}

function formatRow(row, extras) {
  if (!row) return null;
  const extra = extras || {};
  const lines = parseLines(row.lines_json != null ? row.lines_json : row.lines);
  const reason = row.reason || 'other';
  const out = {
    id: String(row.id),
    number: row.number || '',
    customerId: row.customer_id == null ? '' : String(row.customer_id),
    orderRef: row.order_ref || '',
    reason: reason,
    reasonLabel: reasonLabel(reason),
    lines: lines,
    notes: row.notes || '',
    status: row.status || 'submitted',
    photoName: row.photo_name || '',
    photoUrl: row.photo_url
      ? (extra.admin
        ? '/api/admin/dealer-rmas/' + row.id + '/photo'
        : '/api/dealer/rmas/' + row.id + '/photo')
      : '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
  if (extra.admin) out.dealerName = extra.dealerName || '';
  return out;
}

function nextNumberFrom(numbers) {
  let max = 1000;
  (numbers || []).forEach(function (number) {
    const match = String(number || '').match(/^RMA-(\d+)$/i);
    if (match) max = Math.max(max, Number(match[1]) || 0);
  });
  return 'RMA-' + (max + 1);
}

async function dealerNames(store) {
  const map = {};
  if (!store || typeof store.listCompanyCustomers !== 'function') return map;
  const rows = await store.listCompanyCustomers();
  (rows || []).forEach(function (customer) {
    map[String(customer.id)] = customer.displayName || customer.companyName || '';
  });
  return map;
}

function ensureDealerRmas(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dealer_rmas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL,
      dealer_user_id INTEGER,
      order_ref TEXT NOT NULL DEFAULT '',
      reason TEXT NOT NULL DEFAULT 'other',
      lines_json TEXT NOT NULL DEFAULT '[]',
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'submitted',
      photo_name TEXT NOT NULL DEFAULT '',
      photo_url TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS dealer_rmas_customer_idx ON dealer_rmas (customer_id, created_at);
  `);
  const cols = db.prepare('PRAGMA table_info(dealer_rmas)').all().map(function (col) { return col.name; });
  if (cols.indexOf('photo_name') === -1) db.exec("ALTER TABLE dealer_rmas ADD COLUMN photo_name TEXT NOT NULL DEFAULT ''");
  if (cols.indexOf('photo_url') === -1) db.exec("ALTER TABLE dealer_rmas ADD COLUMN photo_url TEXT NOT NULL DEFAULT ''");
}

function pictureFile(file) {
  if (!file || !file.buffer) return null;
  const mime = String(file.mimetype || '').toLowerCase();
  let ext = path.extname(file.originalname || '').toLowerCase();
  if (ext !== '.jpg' && ext !== '.jpeg' && ext !== '.png') {
    if (mime === 'image/png') ext = '.png';
    else if (mime === 'image/jpeg' || mime === 'image/jpg') ext = '.jpg';
    else return null;
    file.originalname = String(file.originalname || 'picture').replace(/\.[^.]+$/, '') + ext;
  }
  return file;
}

async function storePicture(file, customerId, supabase) {
  const picture = pictureFile(file);
  if (!picture) return null;
  const portal = require('./dealer-portal');
  return portal.saveDealerUpload(picture, customerId, supabase);
}

function sqliteApi(db, store) {
  function allRows() {
    return db.prepare('SELECT * FROM dealer_rmas ORDER BY datetime(created_at) DESC, id DESC').all();
  }
  function getRow(id) {
    return db.prepare('SELECT * FROM dealer_rmas WHERE id = ?').get(id);
  }
  return {
    async listDealerRmas() {
      const names = await dealerNames(store);
      return allRows().map(function (row) {
        return formatRow(row, { admin: true, dealerName: names[String(row.customer_id)] || '' });
      });
    },
    async listPortalRmas(user) {
      const customerId = dealerCustomerId(user);
      if (!customerId) return [];
      return db.prepare(
        'SELECT * FROM dealer_rmas WHERE customer_id = ? ORDER BY datetime(created_at) DESC, id DESC'
      ).all(customerId).map(function (row) { return formatRow(row); });
    },
    async getPortalRma(user, id) {
      const row = getRow(id);
      if (!row || String(row.customer_id) !== dealerCustomerId(user)) return null;
      return formatRow(row);
    },
    async createPortalRma(user, body, file) {
      const customerId = dealerCustomerId(user);
      if (!customerId) {
        throw Object.assign(new Error('This portal login is not linked to a dealer company.'), { code: 'no_customer' });
      }
      const input = readInput(body);
      const picture = await storePicture(file, customerId, null);
      if (file && !picture) throw Object.assign(new Error('Picture must be a JPG or PNG.'), { code: 'invalid' });
      const numbers = db.prepare('SELECT number FROM dealer_rmas').all().map(function (row) { return row.number; });
      const stamp = nowIso();
      const info = db.prepare(`
        INSERT INTO dealer_rmas (
          number, customer_id, dealer_user_id, order_ref, reason, lines_json, notes, status,
          photo_name, photo_url, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?, ?, ?)
      `).run(
        nextNumberFrom(numbers),
        customerId,
        user && user.id ? user.id : null,
        input.orderRef,
        input.reason,
        JSON.stringify(input.lines),
        input.notes,
        picture ? picture.name : '',
        picture ? picture.url : '',
        stamp,
        stamp
      );
      return formatRow(getRow(info.lastInsertRowid));
    },
    async readPortalRmaPhoto(user, id) {
      const row = getRow(id);
      if (!row || String(row.customer_id) !== dealerCustomerId(user) || !row.photo_url) return null;
      const portal = require('./dealer-portal');
      return {
        name: row.photo_name || 'picture',
        url: row.photo_url,
        buffer: await portal.readDealerBytes(row.photo_url, null)
      };
    },
    async readDealerRmaPhoto(id) {
      const row = getRow(id);
      if (!row || !row.photo_url) return null;
      const portal = require('./dealer-portal');
      return {
        name: row.photo_name || 'picture',
        url: row.photo_url,
        buffer: await portal.readDealerBytes(row.photo_url, null)
      };
    }
  };
}

function supabaseApi(supabase, store) {
  async function allRows() {
    const { data, error } = await supabase.from('dealer_rmas').select('*').order('created_at', { ascending: false });
    throwIf(error, 'Could not load RMAs.');
    return data || [];
  }
  return {
    async listDealerRmas() {
      const names = await dealerNames(store);
      const rows = await allRows();
      return rows.map(function (row) {
        return formatRow(row, { admin: true, dealerName: names[String(row.customer_id)] || '' });
      });
    },
    async listPortalRmas(user) {
      const customerId = dealerCustomerId(user);
      if (!customerId) return [];
      const { data, error } = await supabase.from('dealer_rmas').select('*').eq('customer_id', customerId).order('created_at', { ascending: false });
      throwIf(error, 'Could not load your RMAs.');
      return (data || []).map(function (row) { return formatRow(row); });
    },
    async getPortalRma(user, id) {
      const { data, error } = await supabase.from('dealer_rmas').select('*').eq('id', id).maybeSingle();
      throwIf(error, 'Could not load this RMA.');
      if (!data || String(data.customer_id) !== dealerCustomerId(user)) return null;
      return formatRow(data);
    },
    async createPortalRma(user, body, file) {
      const customerId = dealerCustomerId(user);
      if (!customerId) {
        throw Object.assign(new Error('This portal login is not linked to a dealer company.'), { code: 'no_customer' });
      }
      const input = readInput(body);
      const picture = await storePicture(file, customerId, supabase);
      if (file && !picture) throw Object.assign(new Error('Picture must be a JPG or PNG.'), { code: 'invalid' });
      const rows = await allRows();
      const stamp = nowIso();
      const fields = {
        number: nextNumberFrom(rows.map(function (row) { return row.number; })),
        customer_id: Number(customerId),
        dealer_user_id: user && user.id ? Number(user.id) : null,
        order_ref: input.orderRef,
        reason: input.reason,
        lines_json: JSON.stringify(input.lines),
        notes: input.notes,
        status: 'submitted',
        photo_name: picture ? picture.name : '',
        photo_url: picture ? picture.url : '',
        created_at: stamp,
        updated_at: stamp
      };
      const { data, error } = await supabase.from('dealer_rmas').insert(fields).select('*').single();
      throwIf(error, 'Could not save this RMA.');
      return formatRow(data);
    },
    async readPortalRmaPhoto(user, id) {
      const { data, error } = await supabase.from('dealer_rmas').select('*').eq('id', id).maybeSingle();
      throwIf(error, 'Could not load this picture.');
      if (!data || String(data.customer_id) !== dealerCustomerId(user) || !data.photo_url) return null;
      const portal = require('./dealer-portal');
      return {
        name: data.photo_name || 'picture',
        url: data.photo_url,
        buffer: await portal.readDealerBytes(data.photo_url, supabase)
      };
    },
    async readDealerRmaPhoto(id) {
      const { data, error } = await supabase.from('dealer_rmas').select('*').eq('id', id).maybeSingle();
      throwIf(error, 'Could not load this picture.');
      if (!data || !data.photo_url) return null;
      const portal = require('./dealer-portal');
      return {
        name: data.photo_name || 'picture',
        url: data.photo_url,
        buffer: await portal.readDealerBytes(data.photo_url, supabase)
      };
    }
  };
}

module.exports = {
  ensureDealerRmas: ensureDealerRmas,
  sqliteApi: sqliteApi,
  supabaseApi: supabaseApi
};
