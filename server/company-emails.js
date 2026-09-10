function trim(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max || 240);
}

const PARTY = { customer: 'customer', vendor: 'vendor' };
const DOC = { quote: 'quote', order: 'order', invoice: 'invoice', po: 'po' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmails(value) {
  const raw = Array.isArray(value) ? value.join(',') : String(value || '');
  const parts = raw.split(/[;,]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  const out = [];
  const seen = {};
  parts.forEach(function (part) {
    const m = part.match(/<([^>]+)>/);
    const email = String(m ? m[1] : part).trim().toLowerCase();
    if (!EMAIL_RE.test(email) || seen[email]) return;
    seen[email] = true;
    out.push(email);
  });
  return out.slice(0, 20);
}

function emailsText(value) {
  return parseEmails(value).join(', ');
}

function normalizePartyKind(value) {
  const k = String(value || '').trim().toLowerCase();
  if (k === 'customer' || k === 'vendor') return k;
  throw new Error('Choose a customer or vendor for this email.');
}

function normalizeDocKind(value) {
  const t = String(value || '').trim().toLowerCase();
  if (!t) return '';
  if (DOC[t]) return t;
  throw new Error('Unknown document type.');
}

function partyIdNum(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error('Select a customer or vendor first.');
  return Math.floor(n);
}

function optionalId(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function safeFilename(value) {
  const raw = String(value || 'document.pdf').trim() || 'document.pdf';
  const name = raw.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').slice(0, 80);
  return /\.pdf$/i.test(name) ? name : name + '.pdf';
}

function normalizeRecord(input) {
  const src = input || {};
  const to = parseEmails(src.to || src.toEmails || src.to_emails);
  if (!to.length) throw new Error('Add at least one To address.');
  const body = trim(src.body || src.bodyText || src.body_text, 8000);
  if (!body) throw new Error('Write a message before sending.');
  return {
    partyKind: normalizePartyKind(src.partyKind || src.party_kind),
    partyId: partyIdNum(src.partyId || src.party_id),
    docKind: normalizeDocKind(src.docKind || src.doc_kind),
    docId: optionalId(src.docId || src.doc_id),
    docNumber: trim(src.docNumber || src.doc_number, 80),
    toEmails: to.join(', '),
    ccEmails: emailsText(src.cc || src.ccEmails || src.cc_emails),
    bccEmails: emailsText(src.bcc || src.bccEmails || src.bcc_emails),
    subject: trim(src.subject, 200) || 'Spectrum Display',
    bodyText: body,
    filename: src.filename ? safeFilename(src.filename) : '',
    pdfBase64: trim(src.pdfBase64 || src.pdf_base64, 12 * 1024 * 1024),
    sentByEmail: trim(src.sentByEmail || src.sent_by_email, 160).toLowerCase(),
    sentByName: trim(src.sentByName || src.sent_by_name, 160)
  };
}

function formatEmail(row) {
  if (!row) return null;
  return {
    id: row.id,
    partyKind: row.party_kind,
    partyId: row.party_id,
    docKind: row.doc_kind || '',
    docId: row.doc_id || null,
    docNumber: row.doc_number || '',
    to: row.to_emails || '',
    cc: row.cc_emails || '',
    bcc: row.bcc_emails || '',
    subject: row.subject || '',
    body: row.body_text || '',
    filename: row.filename || '',
    hasPdf: !!(row.filename || row.has_pdf),
    sentByEmail: row.sent_by_email || '',
    sentByName: row.sent_by_name || '',
    createdAt: row.created_at
  };
}

const LIST_COLS = 'id, party_kind, party_id, doc_kind, doc_id, doc_number, to_emails, cc_emails, bcc_emails, subject, body_text, filename, sent_by_email, sent_by_name, created_at';

function ensureCompanyEmails(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS company_emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      party_kind TEXT NOT NULL,
      party_id INTEGER NOT NULL,
      doc_kind TEXT NOT NULL DEFAULT '',
      doc_id INTEGER,
      doc_number TEXT NOT NULL DEFAULT '',
      to_emails TEXT NOT NULL DEFAULT '',
      cc_emails TEXT NOT NULL DEFAULT '',
      bcc_emails TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL DEFAULT '',
      body_text TEXT NOT NULL DEFAULT '',
      filename TEXT NOT NULL DEFAULT '',
      pdf_base64 TEXT NOT NULL DEFAULT '',
      sent_by_email TEXT NOT NULL DEFAULT '',
      sent_by_name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS company_emails_party_idx
      ON company_emails (party_kind, party_id, created_at);
  `);
}

function missingTable(err) {
  const msg = String((err && err.message) || err || '');
  return /company_emails|does not exist|schema cache/i.test(msg);
}

function sqliteApi(db) {
  const nowIso = require('./db').nowIso;
  return {
    async listCompanyEmails(partyKind, partyId) {
      const kind = normalizePartyKind(partyKind);
      const id = partyIdNum(partyId);
      const rows = db.prepare(
        'SELECT ' + LIST_COLS + ' FROM company_emails WHERE party_kind = ? AND party_id = ? ORDER BY datetime(created_at) DESC, id DESC'
      ).all(kind, id);
      return rows.map(formatEmail);
    },
    async getCompanyEmail(id) {
      const row = db.prepare('SELECT ' + LIST_COLS + ' FROM company_emails WHERE id = ?').get(id);
      return formatEmail(row);
    },
    async getCompanyEmailPdf(id) {
      const row = db.prepare('SELECT filename, pdf_base64 FROM company_emails WHERE id = ?').get(id);
      if (!row) return null;
      const b64 = String(row.pdf_base64 || '');
      if (!b64) return { filename: row.filename || 'document.pdf', buffer: null };
      return {
        filename: row.filename || 'document.pdf',
        buffer: Buffer.from(b64, 'base64')
      };
    },
    async createCompanyEmail(payload) {
      const input = normalizeRecord(payload);
      const stamp = nowIso();
      const info = db.prepare(`
        INSERT INTO company_emails (
          party_kind, party_id, doc_kind, doc_id, doc_number,
          to_emails, cc_emails, bcc_emails, subject, body_text,
          filename, pdf_base64, sent_by_email, sent_by_name, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        input.partyKind, input.partyId, input.docKind, input.docId, input.docNumber,
        input.toEmails, input.ccEmails, input.bccEmails, input.subject, input.bodyText,
        input.filename, input.pdfBase64, input.sentByEmail, input.sentByName, stamp
      );
      return this.getCompanyEmail(info.lastInsertRowid);
    }
  };
}

function supabaseApi(supabase, throwIf) {
  return {
    async listCompanyEmails(partyKind, partyId) {
      const kind = normalizePartyKind(partyKind);
      const id = partyIdNum(partyId);
      const { data, error } = await supabase
        .from('company_emails')
        .select(LIST_COLS)
        .eq('party_kind', kind)
        .eq('party_id', id)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });
      if (error && missingTable(error)) return [];
      throwIf(error, 'Could not load emails.');
      return (data || []).map(formatEmail);
    },
    async getCompanyEmail(id) {
      const { data, error } = await supabase
        .from('company_emails')
        .select(LIST_COLS)
        .eq('id', id)
        .maybeSingle();
      if (error && missingTable(error)) return null;
      throwIf(error, 'Could not load email.');
      return formatEmail(data);
    },
    async getCompanyEmailPdf(id) {
      const { data, error } = await supabase
        .from('company_emails')
        .select('filename, pdf_base64')
        .eq('id', id)
        .maybeSingle();
      if (error && missingTable(error)) return null;
      throwIf(error, 'Could not load email PDF.');
      if (!data) return null;
      const b64 = String(data.pdf_base64 || '');
      if (!b64) return { filename: data.filename || 'document.pdf', buffer: null };
      return {
        filename: data.filename || 'document.pdf',
        buffer: Buffer.from(b64, 'base64')
      };
    },
    async createCompanyEmail(payload) {
      const input = normalizeRecord(payload);
      const stamp = new Date().toISOString();
      const { data, error } = await supabase.from('company_emails').insert({
        party_kind: input.partyKind,
        party_id: input.partyId,
        doc_kind: input.docKind,
        doc_id: input.docId,
        doc_number: input.docNumber,
        to_emails: input.toEmails,
        cc_emails: input.ccEmails,
        bcc_emails: input.bccEmails,
        subject: input.subject,
        body_text: input.bodyText,
        filename: input.filename,
        pdf_base64: input.pdfBase64,
        sent_by_email: input.sentByEmail,
        sent_by_name: input.sentByName,
        created_at: stamp
      }).select(LIST_COLS).single();
      if (error && missingTable(error)) {
        throw new Error('Email history is not set up in the database yet.');
      }
      throwIf(error, 'Could not save sent email.');
      return formatEmail(data);
    }
  };
}

module.exports = {
  PARTY,
  parseEmails,
  emailsText,
  normalizeRecord,
  formatEmail,
  ensureCompanyEmails,
  sqliteApi,
  supabaseApi
};
