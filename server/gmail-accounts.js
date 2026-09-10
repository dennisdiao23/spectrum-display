const gmail = require('./gmail');

function adminIdNum(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error('Staff account not found.');
  return Math.floor(n);
}

function formatAccount(row) {
  if (!row) return null;
  let refreshToken = '';
  let accessToken = '';
  try {
    refreshToken = gmail.decryptSecret(row.refresh_token);
    accessToken = gmail.decryptSecret(row.access_token);
  } catch (err) {
    return null;
  }
  if (!refreshToken) return null;
  return {
    adminId: row.admin_id,
    gmailEmail: String(row.gmail_email || '').trim().toLowerCase(),
    refreshToken: refreshToken,
    accessToken: accessToken,
    accessExpiresAt: row.access_expires_at || ''
  };
}

function ensureAdminGmailAccounts(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_gmail_accounts (
      admin_id INTEGER PRIMARY KEY,
      gmail_email TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      access_token TEXT NOT NULL DEFAULT '',
      access_expires_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
    );
  `);
}

function sqliteApi(db) {
  const nowIso = require('./db').nowIso;
  return {
    async getAdminGmailAccount(adminId) {
      const id = adminIdNum(adminId);
      const row = db.prepare('SELECT * FROM admin_gmail_accounts WHERE admin_id = ?').get(id);
      return formatAccount(row);
    },
    async getAdminGmailStatus(adminId) {
      const account = await this.getAdminGmailAccount(adminId);
      if (!account) return null;
      return { adminId: account.adminId, gmailEmail: account.gmailEmail };
    },
    async saveAdminGmailAccount(adminId, input) {
      const id = adminIdNum(adminId);
      const email = String((input && input.gmailEmail) || '').trim().toLowerCase();
      if (!email) throw new Error('Google did not return a Gmail address.');
      const refresh = String((input && input.refreshToken) || '');
      if (!refresh) throw new Error('Google did not return offline access. Connect Gmail again.');
      const stamp = nowIso();
      db.prepare(`
        INSERT INTO admin_gmail_accounts (
          admin_id, gmail_email, refresh_token, access_token, access_expires_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(admin_id) DO UPDATE SET
          gmail_email = excluded.gmail_email,
          refresh_token = excluded.refresh_token,
          access_token = excluded.access_token,
          access_expires_at = excluded.access_expires_at,
          updated_at = excluded.updated_at
      `).run(
        id,
        email,
        gmail.encryptSecret(refresh),
        gmail.encryptSecret(input.accessToken || ''),
        String((input && input.accessExpiresAt) || ''),
        stamp
      );
      return this.getAdminGmailAccount(id);
    },
    async deleteAdminGmailAccount(adminId) {
      const id = adminIdNum(adminId);
      db.prepare('DELETE FROM admin_gmail_accounts WHERE admin_id = ?').run(id);
      return true;
    }
  };
}

function missingTable(err) {
  const msg = String((err && err.message) || err || '');
  return /admin_gmail_accounts|does not exist|schema cache/i.test(msg);
}

function supabaseApi(supabase, throwIf) {
  return {
    async getAdminGmailAccount(adminId) {
      const id = adminIdNum(adminId);
      const { data, error } = await supabase
        .from('admin_gmail_accounts')
        .select('*')
        .eq('admin_id', id)
        .maybeSingle();
      if (error && missingTable(error)) return null;
      throwIf(error, 'Could not load Gmail connection.');
      return formatAccount(data);
    },
    async getAdminGmailStatus(adminId) {
      const account = await this.getAdminGmailAccount(adminId);
      if (!account) return null;
      return { adminId: account.adminId, gmailEmail: account.gmailEmail };
    },
    async saveAdminGmailAccount(adminId, input) {
      const id = adminIdNum(adminId);
      const email = String((input && input.gmailEmail) || '').trim().toLowerCase();
      if (!email) throw new Error('Google did not return a Gmail address.');
      const refresh = String((input && input.refreshToken) || '');
      if (!refresh) throw new Error('Google did not return offline access. Connect Gmail again.');
      const stamp = new Date().toISOString();
      const { error } = await supabase.from('admin_gmail_accounts').upsert({
        admin_id: id,
        gmail_email: email,
        refresh_token: gmail.encryptSecret(refresh),
        access_token: gmail.encryptSecret((input && input.accessToken) || ''),
        access_expires_at: (input && input.accessExpiresAt) || null,
        updated_at: stamp
      }, { onConflict: 'admin_id' });
      if (error && missingTable(error)) {
        throw new Error('Gmail connections are not set up in the database yet.');
      }
      throwIf(error, 'Could not save Gmail connection.');
      return this.getAdminGmailAccount(id);
    },
    async deleteAdminGmailAccount(adminId) {
      const id = adminIdNum(adminId);
      const { error } = await supabase.from('admin_gmail_accounts').delete().eq('admin_id', id);
      if (error && missingTable(error)) return true;
      throwIf(error, 'Could not disconnect Gmail.');
      return true;
    }
  };
}

module.exports = {
  ensureAdminGmailAccounts,
  sqliteApi,
  supabaseApi
};
