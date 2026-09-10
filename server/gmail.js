const crypto = require('crypto');
const { parseEmails } = require('./company-emails');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid'
].join(' ');
const OAUTH_COOKIE = 'sd_gmail_oauth';
const STATE_TTL_MS = 12 * 60 * 1000;

function env(name, fallback) {
  const value = process.env[name];
  return value == null || value === '' ? fallback : value;
}

function gmailConfigured() {
  return !!(process.env.GOOGLE_GMAIL_CLIENT_ID && process.env.GOOGLE_GMAIL_CLIENT_SECRET);
}

function tokenSecret() {
  return env(
    'GMAIL_TOKEN_SECRET',
    env('SPECTRUM_ADMIN_SECRET', 'spectrum-gmail-dev-secret')
  );
}

function tokenKey() {
  return crypto.createHash('sha256').update(tokenSecret()).digest();
}

function encryptSecret(value) {
  const text = String(value || '');
  if (!text) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', tokenKey(), iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decryptSecret(value) {
  const raw = String(value || '');
  if (!raw) return '';
  const buf = Buffer.from(raw, 'base64');
  if (buf.length < 29) throw new Error('Stored Gmail access is invalid.');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', tokenKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

function publicBase(req) {
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http')
    .split(',')[0]
    .trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '')
    .split(',')[0]
    .trim();
  if (!host) return 'http://localhost:3000';
  return proto + '://' + host;
}

function redirectUri(req) {
  return publicBase(req) + '/api/admin/gmail/callback';
}

function safeReturnPath(value) {
  let path = String(value || '/company').split('#')[0];
  if (path.charAt(0) !== '/') path = '/' + path;
  if (path.indexOf('/company') !== 0) return '/company';
  if (path.indexOf('//') !== -1 || path.indexOf('\\') !== -1) return '/company';
  return path.slice(0, 400);
}

function signState(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', tokenSecret()).update(body).digest('base64url');
  return body + '.' + sig;
}

function readState(value) {
  const raw = String(value || '');
  const dot = raw.lastIndexOf('.');
  if (dot < 1) throw new Error('Google sign-in expired. Connect Gmail again.');
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = crypto.createHmac('sha256', tokenSecret()).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('Google sign-in expired. Connect Gmail again.');
  }
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (!payload || Date.now() - Number(payload.ts || 0) > STATE_TTL_MS) {
    throw new Error('Google sign-in expired. Connect Gmail again.');
  }
  return payload;
}

function oauthCookieOpts() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: STATE_TTL_MS,
    path: '/'
  };
}

function authUrl(req, admin, returnPath) {
  if (!gmailConfigured()) {
    const err = new Error('Gmail send is not set up on the server yet.');
    err.code = 'gmail_setup';
    throw err;
  }
  const nonce = crypto.randomBytes(16).toString('hex');
  const state = signState({
    adminId: String(admin.id),
    nonce: nonce,
    ts: Date.now(),
    returnPath: safeReturnPath(returnPath)
  });
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_GMAIL_CLIENT_ID,
    redirect_uri: redirectUri(req),
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: state
  });
  return {
    url: 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString(),
    state: state,
    cookie: nonce
  };
}

function returnUrl(req, returnPath, query) {
  const path = safeReturnPath(returnPath);
  const url = new URL(path, publicBase(req));
  Object.keys(query || {}).forEach(function (key) {
    if (query[key] != null && query[key] !== '') url.searchParams.set(key, query[key]);
  });
  return url.pathname + url.search;
}

function encodeHeader(value) {
  const text = String(value || '').replace(/[\r\n]+/g, ' ').trim();
  if (!text) return '';
  if (/^[\x20-\x7E]*$/.test(text)) return text;
  return '=?UTF-8?B?' + Buffer.from(text, 'utf8').toString('base64') + '?=';
}

function formatAddress(email, name) {
  const addr = String(email || '').trim();
  if (!addr) return '';
  const label = String(name || '').replace(/[\r\n]+/g, ' ').trim();
  if (!label) return addr;
  return encodeHeader(label) + ' <' + addr + '>';
}

function wrapBase64(value) {
  const raw = String(value || '');
  const lines = [];
  for (let i = 0; i < raw.length; i += 76) lines.push(raw.slice(i, i + 76));
  return lines.join('\r\n');
}

function buildMimeMessage(opts) {
  const fromEmail = String(opts.fromEmail || '').trim();
  const to = parseEmails(opts.to);
  if (!fromEmail) throw new Error('Connect Gmail to send from your own inbox.');
  if (!to.length) throw new Error('Add at least one To address.');
  const cc = parseEmails(opts.cc);
  const bcc = parseEmails(opts.bcc);
  const subject = String(opts.subject || '').trim() || 'Spectrum Display';
  const text = String(opts.body || opts.text || '');
  const attachments = (opts.attachments || []).filter(function (file) {
    return file && file.filename && file.content;
  });
  const headers = [
    'From: ' + formatAddress(fromEmail, opts.fromName),
    'To: ' + to.join(', '),
    cc.length ? 'Cc: ' + cc.join(', ') : '',
    bcc.length ? 'Bcc: ' + bcc.join(', ') : '',
    'Subject: ' + encodeHeader(subject),
    'MIME-Version: 1.0'
  ].filter(Boolean);

  let body;
  if (!attachments.length) {
    headers.push('Content-Type: text/plain; charset=UTF-8');
    headers.push('Content-Transfer-Encoding: base64');
    body = wrapBase64(Buffer.from(text, 'utf8').toString('base64'));
  } else {
    const boundary = 'sd_' + crypto.randomBytes(12).toString('hex');
    headers.push('Content-Type: multipart/mixed; boundary="' + boundary + '"');
    const parts = [
      '--' + boundary,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      wrapBase64(Buffer.from(text, 'utf8').toString('base64'))
    ];
    attachments.forEach(function (file) {
      const filename = String(file.filename || 'document.pdf').replace(/"/g, '');
      const content = Buffer.isBuffer(file.content)
        ? file.content
        : Buffer.from(String(file.content || ''), 'utf8');
      const type = String(file.contentType || 'application/pdf');
      parts.push('--' + boundary);
      parts.push('Content-Type: ' + type + '; name="' + filename + '"');
      parts.push('Content-Disposition: attachment; filename="' + filename + '"');
      parts.push('Content-Transfer-Encoding: base64');
      parts.push('');
      parts.push(wrapBase64(content.toString('base64')));
    });
    parts.push('--' + boundary + '--');
    body = parts.join('\r\n');
  }
  return headers.join('\r\n') + '\r\n\r\n' + body;
}

function encodeRaw(mime) {
  return Buffer.from(String(mime || ''), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function googleForm(url, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString()
  });
  const data = await res.json().catch(function () { return {}; });
  if (!res.ok) {
    const err = new Error(data.error_description || data.error || 'Google sign-in failed.');
    err.code = data.error || 'gmail_oauth';
    throw err;
  }
  return data;
}

async function exchangeCode(req, code) {
  const data = await googleForm('https://oauth2.googleapis.com/token', {
    code: code,
    client_id: process.env.GOOGLE_GMAIL_CLIENT_ID,
    client_secret: process.env.GOOGLE_GMAIL_CLIENT_SECRET,
    redirect_uri: redirectUri(req),
    grant_type: 'authorization_code'
  });
  if (!data.refresh_token) {
    const err = new Error('Google did not return offline access. Connect Gmail again and click Allow.');
    err.code = 'gmail_reconnect';
    throw err;
  }
  const profile = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: 'Bearer ' + data.access_token }
  }).then(function (res) { return res.json(); });
  const email = String(profile.email || '').trim().toLowerCase();
  if (!email) throw new Error('Google did not return a Gmail address.');
  return {
    gmailEmail: email,
    refreshToken: data.refresh_token,
    accessToken: data.access_token || '',
    accessExpiresAt: new Date(Date.now() + Number(data.expires_in || 3600) * 1000).toISOString()
  };
}

function gmailError(message, code) {
  const err = new Error(message);
  err.code = code;
  return err;
}

async function refreshAccess(account) {
  const data = await googleForm('https://oauth2.googleapis.com/token', {
    client_id: process.env.GOOGLE_GMAIL_CLIENT_ID,
    client_secret: process.env.GOOGLE_GMAIL_CLIENT_SECRET,
    refresh_token: account.refreshToken,
    grant_type: 'refresh_token'
  });
  return {
    refreshToken: data.refresh_token || account.refreshToken,
    accessToken: data.access_token,
    accessExpiresAt: new Date(Date.now() + Number(data.expires_in || 3600) * 1000).toISOString()
  };
}

async function gmailSendRaw(accessToken, raw) {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw: raw })
  });
  const data = await res.json().catch(function () { return {}; });
  if (!res.ok) {
    const msg = data.error && data.error.message ? data.error.message : 'Gmail rejected the message.';
    const err = gmailError(msg, res.status === 401 ? 'gmail_reconnect' : 'gmail_send');
    err.status = res.status;
    throw err;
  }
  return data;
}

function localDeliver(opts) {
  const { saveLocalOutbox } = require('./mail');
  return Object.assign(
    { provider: 'local' },
    saveLocalOutbox({
      from: formatAddress(opts.fromEmail, opts.fromName) || opts.fromEmail,
      to: opts.to,
      cc: opts.cc,
      bcc: opts.bcc,
      subject: opts.subject,
      text: opts.body || opts.text,
      attachments: opts.attachments
    })
  );
}

async function sendWithGmailAccount(store, admin, opts) {
  const account = await store.getAdminGmailAccount(admin.id);
  if (!account) {
    throw gmailError('Connect Gmail to send from your own inbox.', 'gmail_required');
  }
  const mail = Object.assign({}, opts, {
    fromEmail: account.gmailEmail,
    fromName: (admin && admin.name) || ''
  });
  if (!gmailConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      throw gmailError('Gmail send is not set up on the server yet.', 'gmail_setup');
    }
    return Object.assign(localDeliver(mail), { fromEmail: account.gmailEmail });
  }
  let tokens = {
    refreshToken: account.refreshToken,
    accessToken: account.accessToken,
    accessExpiresAt: account.accessExpiresAt
  };
  const expires = Date.parse(account.accessExpiresAt || '') || 0;
  if (!tokens.accessToken || expires < Date.now() + 60000) {
    try {
      tokens = await refreshAccess(account);
      await store.saveAdminGmailAccount(admin.id, {
        gmailEmail: account.gmailEmail,
        refreshToken: tokens.refreshToken,
        accessToken: tokens.accessToken,
        accessExpiresAt: tokens.accessExpiresAt
      });
    } catch (err) {
      if (String(err.code || '').indexOf('invalid') !== -1 || /invalid_grant/i.test(err.message || '')) {
        await store.deleteAdminGmailAccount(admin.id);
        throw gmailError('Gmail access expired. Connect Gmail again.', 'gmail_reconnect');
      }
      throw err;
    }
  }
  const mime = buildMimeMessage(mail);
  try {
    await gmailSendRaw(tokens.accessToken, encodeRaw(mime));
  } catch (err) {
    if (err.code === 'gmail_reconnect') {
      try {
        tokens = await refreshAccess(Object.assign({}, account, tokens));
        await store.saveAdminGmailAccount(admin.id, {
          gmailEmail: account.gmailEmail,
          refreshToken: tokens.refreshToken,
          accessToken: tokens.accessToken,
          accessExpiresAt: tokens.accessExpiresAt
        });
        await gmailSendRaw(tokens.accessToken, encodeRaw(mime));
        return { provider: 'gmail', fromEmail: account.gmailEmail };
      } catch (retryErr) {
        await store.deleteAdminGmailAccount(admin.id);
        throw gmailError('Gmail access expired. Connect Gmail again.', 'gmail_reconnect');
      }
    }
    throw err;
  }
  return { provider: 'gmail', fromEmail: account.gmailEmail };
}

function publicGmailStatus(account, configured) {
  return {
    configured: !!configured,
    connected: !!(account && account.gmailEmail),
    email: account && account.gmailEmail ? account.gmailEmail : ''
  };
}

module.exports = {
  OAUTH_COOKIE,
  gmailConfigured,
  encryptSecret,
  decryptSecret,
  authUrl,
  readState,
  exchangeCode,
  oauthCookieOpts,
  returnUrl,
  safeReturnPath,
  buildMimeMessage,
  encodeRaw,
  sendWithGmailAccount,
  publicGmailStatus
};
