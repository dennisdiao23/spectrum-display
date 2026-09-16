const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const gmail = require('./gmail');

const ROOT = path.join(__dirname, '..');
const STAFF_UPLOAD_ROOT = path.join(ROOT, 'uploads', 'staff');

const ACCOUNT_TYPES = ['email', 'phone', 'other'];

function trim(value, max) {
  let s = String(value == null ? '' : value).trim();
  if (max && s.length > max) s = s.slice(0, max);
  return s;
}

function accountType(value) {
  const t = String(value || 'other').toLowerCase().trim();
  return ACCOUNT_TYPES.indexOf(t) === -1 ? 'other' : t;
}

function ensureStaffProfile(db) {
  const cols = [
    ['first_name', "TEXT NOT NULL DEFAULT ''"],
    ['last_name', "TEXT NOT NULL DEFAULT ''"],
    ['job_title', "TEXT NOT NULL DEFAULT ''"],
    ['phone', "TEXT NOT NULL DEFAULT ''"],
    ['mobile', "TEXT NOT NULL DEFAULT ''"],
    ['personal_email', "TEXT NOT NULL DEFAULT ''"],
    ['notes', "TEXT NOT NULL DEFAULT ''"],
    ['photo_url', "TEXT NOT NULL DEFAULT ''"],
    ['street', "TEXT NOT NULL DEFAULT ''"],
    ['street2', "TEXT NOT NULL DEFAULT ''"],
    ['city', "TEXT NOT NULL DEFAULT ''"],
    ['state', "TEXT NOT NULL DEFAULT ''"],
    ['zip', "TEXT NOT NULL DEFAULT ''"],
    ['country', "TEXT NOT NULL DEFAULT 'United States'"],
    ['updated_at', "TEXT NOT NULL DEFAULT ''"]
  ];
  cols.forEach(function (pair) {
    try {
      db.exec('ALTER TABLE admins ADD COLUMN ' + pair[0] + ' ' + pair[1]);
    } catch (e) { /* already present */ }
  });
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_company_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'other',
      label TEXT NOT NULL DEFAULT '',
      username TEXT NOT NULL DEFAULT '',
      secret_enc TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_admin_company_accounts_admin ON admin_company_accounts(admin_id);
    CREATE TABLE IF NOT EXISTS admin_staff_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      mime TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_admin_staff_files_admin ON admin_staff_files(admin_id);
  `);
}

function profileFromRow(row) {
  if (!row) return {};
  return {
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    jobTitle: row.job_title || '',
    phone: row.phone || '',
    mobile: row.mobile || '',
    personalEmail: row.personal_email || '',
    notes: row.notes || '',
    photoUrl: row.photo_url || '',
    street: row.street || '',
    street2: row.street2 || '',
    city: row.city || '',
    state: row.state || '',
    zip: row.zip || '',
    country: row.country || '',
    updatedAt: row.updated_at || ''
  };
}

function normalizeProfile(input) {
  const src = input || {};
  return {
    first_name: trim(src.firstName || src.first_name, 80),
    last_name: trim(src.lastName || src.last_name, 80),
    job_title: trim(src.jobTitle || src.job_title, 80),
    phone: trim(src.phone, 40),
    mobile: trim(src.mobile, 40),
    personal_email: trim(src.personalEmail || src.personal_email, 160).toLowerCase(),
    notes: trim(src.notes, 4000),
    photo_url: trim(src.photoUrl || src.photo_url, 400),
    street: trim(src.street, 160),
    street2: trim(src.street2, 160),
    city: trim(src.city, 80),
    state: trim(src.state, 40),
    zip: trim(src.zip, 20),
    country: trim(src.country, 80) || 'United States'
  };
}

function formatAccount(row, withSecret) {
  if (!row) return null;
  let secret = '';
  if (withSecret) {
    try {
      secret = row.secret_enc ? gmail.decryptSecret(row.secret_enc) : '';
    } catch (e) {
      secret = '';
    }
  }
  return {
    id: row.id,
    adminId: row.admin_id,
    type: accountType(row.type),
    label: row.label || '',
    username: row.username || '',
    secret: secret,
    hasSecret: !!(row.secret_enc && String(row.secret_enc).trim()),
    notes: row.notes || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

function normalizeAccount(input, current) {
  const src = input || {};
  const cur = current || {};
  const secretIn = src.secret != null ? String(src.secret) : null;
  let secretEnc = cur.secret_enc || '';
  if (secretIn != null) {
    secretEnc = secretIn.trim() ? gmail.encryptSecret(secretIn.trim()) : '';
  }
  const label = trim(src.label, 120);
  const type = accountType(src.type);
  const username = trim(src.username, 160);
  if (!label && !username) throw new Error('Enter a label or username for the account.');
  return {
    type: type,
    label: label || (type === 'email' ? 'Email account' : type === 'phone' ? 'Company phone' : 'Account'),
    username: username,
    secret_enc: secretEnc,
    notes: trim(src.notes, 2000)
  };
}

function formatFile(row) {
  if (!row) return null;
  return {
    id: row.id,
    adminId: row.admin_id,
    name: row.name || '',
    url: row.url || '',
    size: Number(row.size) || 0,
    mime: row.mime || '',
    createdAt: row.created_at || ''
  };
}

function staffUploadDir(adminId) {
  const id = String(adminId || '').replace(/[^0-9]/g, '');
  if (!id) throw new Error('Invalid user.');
  const dir = path.join(STAFF_UPLOAD_ROOT, id);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function safeFileName(name) {
  const base = path.basename(String(name || 'file')).replace(/[^\w.\- ()+]+/g, '_').slice(0, 120);
  return base || 'file';
}

function writeStaffUpload(adminId, file) {
  if (!file || !file.buffer) throw new Error('No file uploaded.');
  if (file.buffer.length > 24 * 1024 * 1024) throw new Error('File is too large (max 24 MB).');
  const dir = staffUploadDir(adminId);
  const ext = path.extname(file.originalname || '') || '';
  const stamp = Date.now().toString(36);
  const rand = crypto.randomBytes(4).toString('hex');
  const name = safeFileName((file.originalname || 'file').replace(ext, '')) + '-' + stamp + '-' + rand + ext;
  fs.writeFileSync(path.join(dir, name), file.buffer);
  return {
    name: safeFileName(file.originalname || name),
    url: '/uploads/staff/' + String(adminId).replace(/[^0-9]/g, '') + '/' + name,
    size: file.buffer.length,
    mime: String(file.mimetype || '').slice(0, 120)
  };
}

function removeLocalStaffFile(url) {
  const rel = String(url || '').replace(/^\/+/, '');
  if (!/^uploads\/staff\/\d+\//.test(rel) || rel.includes('..')) return;
  const abs = path.join(ROOT, rel);
  try {
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch (e) { /* ignore */ }
}

function enrichPublicAdmin(admin, row) {
  if (!admin) return null;
  const profile = profileFromRow(row || {});
  const display = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
  return Object.assign({}, admin, {
    photoUrl: profile.photoUrl,
    firstName: profile.firstName,
    lastName: profile.lastName,
    jobTitle: profile.jobTitle,
    phone: profile.phone,
    mobile: profile.mobile,
    displayName: display || admin.name || admin.email || ''
  });
}

function formatStaffDetail(adminPublic, row, accounts, files) {
  const profile = profileFromRow(row || {});
  return Object.assign({}, adminPublic, profile, {
    accounts: (accounts || []).map(function (a) { return formatAccount(a, true); }),
    files: (files || []).map(formatFile)
  });
}

function sqliteApi(db) {
  const { nowIso } = require('./db');
  const { publicAdmin } = require('./admin-roles');

  function adminRow(id) {
    return db.prepare(`
      SELECT a.*, r.name AS role_name, r.website_access, r.inventory_access, r.menu_access, r.locked AS role_locked
      FROM admins a LEFT JOIN admin_roles r ON r.slug = a.role
      WHERE a.id = ?
    `).get(id) || null;
  }

  function listAccounts(adminId) {
    return db.prepare(
      'SELECT * FROM admin_company_accounts WHERE admin_id = ? ORDER BY type COLLATE NOCASE, label COLLATE NOCASE, id'
    ).all(adminId);
  }

  function listFiles(adminId) {
    return db.prepare(
      'SELECT * FROM admin_staff_files WHERE admin_id = ? ORDER BY created_at DESC, id DESC'
    ).all(adminId);
  }

  return {
    async getStaffDetail(id) {
      const row = adminRow(id);
      if (!row) return null;
      return formatStaffDetail(enrichPublicAdmin(publicAdmin(row), row), row, listAccounts(id), listFiles(id));
    },
    async updateStaffProfile(id, input) {
      const row = adminRow(id);
      if (!row) return null;
      const profile = normalizeProfile(input);
      const name = trim(input && input.name, 120) || row.name;
      const role = trim(input && input.role, 40) || row.role;
      const email = input && input.email != null ? trim(input.email, 160).toLowerCase() : row.email;
      const hash = input && input.passwordHash ? input.passwordHash : row.password_hash;
      const stamp = nowIso();
      db.prepare(`
        UPDATE admins SET
          email = ?, name = ?, role = ?, password_hash = ?,
          first_name = ?, last_name = ?, job_title = ?, phone = ?, mobile = ?,
          personal_email = ?, notes = ?, photo_url = ?,
          street = ?, street2 = ?, city = ?, state = ?, zip = ?, country = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        email, name, role, hash,
        profile.first_name, profile.last_name, profile.job_title, profile.phone, profile.mobile,
        profile.personal_email, profile.notes, profile.photo_url || row.photo_url || '',
        profile.street, profile.street2, profile.city, profile.state, profile.zip, profile.country,
        stamp, id
      );
      return this.getStaffDetail(id);
    },
    async setStaffPhoto(id, file) {
      const row = adminRow(id);
      if (!row) return null;
      const saved = writeStaffUpload(id, file);
      if (row.photo_url) removeLocalStaffFile(row.photo_url);
      db.prepare('UPDATE admins SET photo_url = ?, updated_at = ? WHERE id = ?')
        .run(saved.url, nowIso(), id);
      return this.getStaffDetail(id);
    },
    async clearStaffPhoto(id) {
      const row = adminRow(id);
      if (!row) return null;
      if (row.photo_url) removeLocalStaffFile(row.photo_url);
      db.prepare('UPDATE admins SET photo_url = ?, updated_at = ? WHERE id = ?')
        .run('', nowIso(), id);
      return this.getStaffDetail(id);
    },
    async listStaffAccounts(adminId) {
      return listAccounts(adminId).map(function (a) { return formatAccount(a, true); });
    },
    async createStaffAccount(adminId, input) {
      if (!adminRow(adminId)) return null;
      const data = normalizeAccount(input, null);
      const stamp = nowIso();
      const info = db.prepare(`
        INSERT INTO admin_company_accounts (admin_id, type, label, username, secret_enc, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(adminId, data.type, data.label, data.username, data.secret_enc, data.notes, stamp, stamp);
      const row = db.prepare('SELECT * FROM admin_company_accounts WHERE id = ?').get(info.lastInsertRowid);
      return formatAccount(row, true);
    },
    async updateStaffAccount(adminId, accountId, input) {
      const current = db.prepare(
        'SELECT * FROM admin_company_accounts WHERE id = ? AND admin_id = ?'
      ).get(accountId, adminId);
      if (!current) return null;
      const data = normalizeAccount(input, current);
      const stamp = nowIso();
      db.prepare(`
        UPDATE admin_company_accounts
        SET type = ?, label = ?, username = ?, secret_enc = ?, notes = ?, updated_at = ?
        WHERE id = ? AND admin_id = ?
      `).run(data.type, data.label, data.username, data.secret_enc, data.notes, stamp, accountId, adminId);
      const row = db.prepare('SELECT * FROM admin_company_accounts WHERE id = ?').get(accountId);
      return formatAccount(row, true);
    },
    async deleteStaffAccount(adminId, accountId) {
      const info = db.prepare(
        'DELETE FROM admin_company_accounts WHERE id = ? AND admin_id = ?'
      ).run(accountId, adminId);
      return info.changes > 0;
    },
    async listStaffFiles(adminId) {
      return listFiles(adminId).map(formatFile);
    },
    async addStaffFile(adminId, file) {
      if (!adminRow(adminId)) return null;
      const saved = writeStaffUpload(adminId, file);
      const stamp = nowIso();
      const info = db.prepare(`
        INSERT INTO admin_staff_files (admin_id, name, url, size, mime, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(adminId, saved.name, saved.url, saved.size, saved.mime, stamp);
      const row = db.prepare('SELECT * FROM admin_staff_files WHERE id = ?').get(info.lastInsertRowid);
      return formatFile(row);
    },
    async deleteStaffFile(adminId, fileId) {
      const row = db.prepare(
        'SELECT * FROM admin_staff_files WHERE id = ? AND admin_id = ?'
      ).get(fileId, adminId);
      if (!row) return false;
      removeLocalStaffFile(row.url);
      db.prepare('DELETE FROM admin_staff_files WHERE id = ? AND admin_id = ?').run(fileId, adminId);
      return true;
    }
  };
}

module.exports = {
  ACCOUNT_TYPES,
  ensureStaffProfile,
  profileFromRow,
  normalizeProfile,
  formatAccount,
  normalizeAccount,
  formatFile,
  enrichPublicAdmin,
  formatStaffDetail,
  writeStaffUpload,
  removeLocalStaffFile,
  sqliteApi,
  supabaseApi
};

function nowIsoFallback() {
  try { return require('./db').nowIso(); } catch (e) { return new Date().toISOString(); }
}

function supabaseApi(supabase, throwIf) {
  const { publicAdmin } = require('./admin-roles');

  async function attach(admin) {
    if (!admin) return null;
    const { data } = await supabase.from('admin_roles').select('*').eq('slug', admin.role).maybeSingle();
    if (!data) return admin;
    return Object.assign({}, admin, {
      role_name: data.name,
      website_access: data.website_access,
      inventory_access: data.inventory_access,
      menu_access: data.menu_access,
      role_locked: data.locked
    });
  }

  async function loadAccounts(adminId) {
    const { data, error } = await supabase
      .from('admin_company_accounts')
      .select('*')
      .eq('admin_id', adminId)
      .order('type')
      .order('label');
    throwIf(error);
    return data || [];
  }

  async function loadFiles(adminId) {
    const { data, error } = await supabase
      .from('admin_staff_files')
      .select('*')
      .eq('admin_id', adminId)
      .order('created_at', { ascending: false });
    throwIf(error);
    return data || [];
  }

  return {
    async getStaffDetail(id) {
      const { data, error } = await supabase.from('admins').select('*').eq('id', id).maybeSingle();
      throwIf(error);
      if (!data) return null;
      const row = await attach(data);
      return formatStaffDetail(
        enrichPublicAdmin(publicAdmin(row), row),
        row,
        await loadAccounts(id),
        await loadFiles(id)
      );
    },
    async updateStaffProfile(id, input) {
      const { data: current, error: cErr } = await supabase.from('admins').select('*').eq('id', id).maybeSingle();
      throwIf(cErr);
      if (!current) return null;
      const profile = normalizeProfile(input);
      const patch = Object.assign({}, profile, {
        name: trim(input && input.name, 120) || current.name,
        role: trim(input && input.role, 40) || current.role,
        email: input && input.email != null ? trim(input.email, 160).toLowerCase() : current.email,
        updated_at: nowIsoFallback()
      });
      if (!profile.photo_url) patch.photo_url = current.photo_url || '';
      if (input && input.passwordHash) patch.password_hash = input.passwordHash;
      const { error } = await supabase.from('admins').update(patch).eq('id', id);
      throwIf(error);
      return this.getStaffDetail(id);
    },
    async setStaffPhoto(id, file) {
      const detail = await this.getStaffDetail(id);
      if (!detail) return null;
      const saved = writeStaffUpload(id, file);
      if (detail.photoUrl) removeLocalStaffFile(detail.photoUrl);
      const { error } = await supabase.from('admins').update({
        photo_url: saved.url,
        updated_at: nowIsoFallback()
      }).eq('id', id);
      throwIf(error);
      return this.getStaffDetail(id);
    },
    async clearStaffPhoto(id) {
      const detail = await this.getStaffDetail(id);
      if (!detail) return null;
      if (detail.photoUrl) removeLocalStaffFile(detail.photoUrl);
      const { error } = await supabase.from('admins').update({
        photo_url: '',
        updated_at: nowIsoFallback()
      }).eq('id', id);
      throwIf(error);
      return this.getStaffDetail(id);
    },
    async listStaffAccounts(adminId) {
      return (await loadAccounts(adminId)).map(function (a) { return formatAccount(a, true); });
    },
    async createStaffAccount(adminId, input) {
      if (!(await this.getStaffDetail(adminId))) return null;
      const data = normalizeAccount(input, null);
      const stamp = nowIsoFallback();
      const { data: row, error } = await supabase.from('admin_company_accounts').insert({
        admin_id: adminId,
        type: data.type,
        label: data.label,
        username: data.username,
        secret_enc: data.secret_enc,
        notes: data.notes,
        created_at: stamp,
        updated_at: stamp
      }).select('*').single();
      throwIf(error);
      return formatAccount(row, true);
    },
    async updateStaffAccount(adminId, accountId, input) {
      const { data: current, error: cErr } = await supabase
        .from('admin_company_accounts')
        .select('*')
        .eq('id', accountId)
        .eq('admin_id', adminId)
        .maybeSingle();
      throwIf(cErr);
      if (!current) return null;
      const data = normalizeAccount(input, current);
      const { data: row, error } = await supabase.from('admin_company_accounts').update({
        type: data.type,
        label: data.label,
        username: data.username,
        secret_enc: data.secret_enc,
        notes: data.notes,
        updated_at: nowIsoFallback()
      }).eq('id', accountId).eq('admin_id', adminId).select('*').single();
      throwIf(error);
      return formatAccount(row, true);
    },
    async deleteStaffAccount(adminId, accountId) {
      const { data, error } = await supabase
        .from('admin_company_accounts')
        .delete()
        .eq('id', accountId)
        .eq('admin_id', adminId)
        .select('id');
      throwIf(error);
      return !!(data && data.length);
    },
    async listStaffFiles(adminId) {
      return (await loadFiles(adminId)).map(formatFile);
    },
    async addStaffFile(adminId, file) {
      if (!(await this.getStaffDetail(adminId))) return null;
      const saved = writeStaffUpload(adminId, file);
      const { data: row, error } = await supabase.from('admin_staff_files').insert({
        admin_id: adminId,
        name: saved.name,
        url: saved.url,
        size: saved.size,
        mime: saved.mime,
        created_at: nowIsoFallback()
      }).select('*').single();
      throwIf(error);
      return formatFile(row);
    },
    async deleteStaffFile(adminId, fileId) {
      const { data: row, error: rErr } = await supabase
        .from('admin_staff_files')
        .select('*')
        .eq('id', fileId)
        .eq('admin_id', adminId)
        .maybeSingle();
      throwIf(rErr);
      if (!row) return false;
      removeLocalStaffFile(row.url);
      const { data, error } = await supabase
        .from('admin_staff_files')
        .delete()
        .eq('id', fileId)
        .eq('admin_id', adminId)
        .select('id');
      throwIf(error);
      return !!(data && data.length);
    }
  };
}
