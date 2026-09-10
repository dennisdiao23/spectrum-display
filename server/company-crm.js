function trim(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max || 240);
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function idOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function splitName(name) {
  const bits = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!bits.length) return { first: '', last: '' };
  if (bits.length === 1) return { first: bits[0], last: '' };
  return { first: bits[0], last: bits.slice(1).join(' ') };
}

const LEAD_STATUSES = ['new', 'working', 'qualified', 'converted', 'lost'];
const DEAL_STAGES = ['new', 'qualified', 'quoted', 'negotiation', 'won', 'lost'];
const ACTIVITY_TYPES = ['note', 'call', 'email', 'meeting', 'task'];
const LEAD_SOURCES = ['website', 'dealer', 'manual', 'referral', 'other'];
const CLOSE_REASONS = ['price', 'timing', 'competitor', 'no_budget', 'other'];
const CRM_SALES_EMAIL = 'sales@spectrumdisplay.com';
const LEAD_CSV_HEADERS = [
  'companyName', 'contactFirst', 'contactLast', 'email', 'phone', 'mobile', 'website',
  'source', 'status', 'ownerName', 'projectType', 'city', 'state', 'country', 'notes'
];

function leadStatus(value) {
  const v = String(value || 'new').toLowerCase().trim();
  return LEAD_STATUSES.indexOf(v) === -1 ? 'new' : v;
}

function dealStage(value) {
  const v = String(value || 'new').toLowerCase().trim();
  return DEAL_STAGES.indexOf(v) === -1 ? 'new' : v;
}

function activityType(value) {
  const v = String(value || 'note').toLowerCase().trim();
  return ACTIVITY_TYPES.indexOf(v) === -1 ? 'note' : v;
}

function leadSource(value) {
  const v = String(value || 'manual').toLowerCase().trim();
  return LEAD_SOURCES.indexOf(v) === -1 ? 'other' : v;
}

function closeReason(value) {
  const v = String(value || '').toLowerCase().trim().replace(/\s+/g, '_');
  if (!v) return '';
  if (v === 'no-budget') return 'no_budget';
  return CLOSE_REASONS.indexOf(v) === -1 ? 'other' : v;
}

function closeReasonLabel(value) {
  const v = closeReason(value);
  if (v === 'price') return 'Price';
  if (v === 'timing') return 'Timing';
  if (v === 'competitor') return 'Competitor';
  if (v === 'no_budget') return 'No budget';
  if (v === 'other') return 'Other';
  return '';
}

function messageDirection(value) {
  return String(value || '').toLowerCase() === 'out' ? 'out' : 'in';
}

function normalizeMessage(input) {
  const src = input || {};
  const body = trim(src.body || src.bodyText || src.body_text, 8000);
  const subject = trim(src.subject, 200);
  if (!body && !subject) throw new Error('Write a subject or message.');
  return {
    leadId: idOrNull(src.leadId != null ? src.leadId : src.lead_id),
    dealId: idOrNull(src.dealId != null ? src.dealId : src.deal_id),
    activityId: idOrNull(src.activityId != null ? src.activityId : src.activity_id),
    direction: messageDirection(src.direction),
    fromEmail: trim(src.fromEmail || src.from_email, 160).toLowerCase(),
    toEmail: trim(src.toEmail || src.to_email, 160).toLowerCase(),
    subject: subject,
    body: body,
    source: trim(src.source, 40) || 'compose'
  };
}

function formatMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    leadId: row.lead_id || null,
    dealId: row.deal_id || null,
    activityId: row.activity_id || null,
    direction: row.direction || 'in',
    fromEmail: row.from_email || '',
    toEmail: row.to_email || '',
    subject: row.subject || '',
    body: row.body || '',
    source: row.source || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

function messageDbFields(input) {
  return {
    lead_id: input.leadId,
    deal_id: input.dealId,
    activity_id: input.activityId,
    direction: input.direction,
    from_email: input.fromEmail,
    to_email: input.toEmail,
    subject: input.subject,
    body: input.body,
    source: input.source
  };
}

function csvEscape(value) {
  const s = String(value == null ? '' : value);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function leadsToCsv(leads) {
  const rows = [LEAD_CSV_HEADERS.join(',')];
  (leads || []).forEach(function (lead) {
    rows.push(LEAD_CSV_HEADERS.map(function (key) { return csvEscape(lead[key] || ''); }).join(','));
  });
  return rows.join('\n') + '\n';
}

function parseCsvText(text) {
  const src = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter(function (r) {
    return r.some(function (c) { return String(c || '').trim(); });
  });
}

function csvHeaderKey(name) {
  const n = String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  const map = {
    company: 'companyName',
    companyname: 'companyName',
    first: 'contactFirst',
    firstname: 'contactFirst',
    contactfirst: 'contactFirst',
    last: 'contactLast',
    lastname: 'contactLast',
    contactlast: 'contactLast',
    email: 'email',
    phone: 'phone',
    mobile: 'mobile',
    website: 'website',
    source: 'source',
    status: 'status',
    owner: 'ownerName',
    ownername: 'ownerName',
    project: 'projectType',
    projecttype: 'projectType',
    city: 'city',
    state: 'state',
    country: 'country',
    notes: 'notes',
    note: 'notes'
  };
  return map[n] || '';
}

function leadsFromCsv(text) {
  const table = parseCsvText(text);
  if (!table.length) return [];
  const keys = table[0].map(csvHeaderKey);
  if (!keys.some(Boolean)) throw new Error('CSV needs a header row (company, email, name).');
  return table.slice(1).map(function (cells) {
    const out = {};
    keys.forEach(function (key, i) {
      if (key) out[key] = String(cells[i] == null ? '' : cells[i]).trim();
    });
    return out;
  }).filter(function (row) {
    return row.companyName || row.contactFirst || row.contactLast || row.email || row.phone;
  });
}

function sameText(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function isOpenLead(lead) {
  return !lead.mergedIntoId && lead.status !== 'lost';
}

function leadMatchesDuplicate(lead, email, companyName, excludeId) {
  if (!lead || lead.mergedIntoId) return false;
  if (excludeId && String(lead.id) === String(excludeId)) return false;
  const mail = String(email || '').trim().toLowerCase();
  const company = String(companyName || '').trim();
  if (mail && lead.email && sameText(lead.email, mail)) return true;
  if (company && lead.companyName && sameText(lead.companyName, company)) return true;
  return false;
}

function fillEmptyLeadFields(target, source) {
  const out = Object.assign({}, target);
  [
    'companyName', 'contactFirst', 'contactLast', 'email', 'phone', 'mobile', 'website',
    'ownerName', 'projectType', 'city', 'state', 'country', 'source'
  ].forEach(function (key) {
    if (!out[key] && source[key]) out[key] = source[key];
  });
  if (!out.convertedCustomerId && source.convertedCustomerId) {
    out.convertedCustomerId = source.convertedCustomerId;
    out.status = 'converted';
  }
  out.notes = [target.notes, source.notes].filter(Boolean).join('\n\n').slice(0, 4000);
  out.displayName = leadDisplayName(out);
  return out;
}

function inquiryMessageFromLead(lead, extra) {
  const src = extra || {};
  const body = trim(src.body || src.notes || lead.notes, 8000);
  if (!body) return null;
  const source = lead.source === 'dealer' ? 'dealer' : (lead.source === 'website' ? 'website' : 'system');
  return {
    leadId: lead.id,
    direction: 'in',
    fromEmail: lead.email || '',
    toEmail: CRM_SALES_EMAIL,
    subject: src.subject || (source === 'dealer' ? 'Dealer inquiry' : 'Website inquiry'),
    body: body,
    source: source
  };
}

function leadDisplayName(input) {
  const company = trim(input.companyName || input.company_name, 160);
  const first = trim(input.contactFirst || input.contact_first, 80);
  const last = trim(input.contactLast || input.contact_last, 80);
  const contact = [first, last].filter(Boolean).join(' ');
  return trim(input.displayName || input.display_name, 160) || company || contact || trim(input.email, 160) || 'Lead';
}

function normalizeLead(input) {
  const src = input || {};
  const companyName = trim(src.companyName || src.company_name, 160);
  let first = trim(src.contactFirst || src.contact_first, 80);
  let last = trim(src.contactLast || src.contact_last, 80);
  const contactName = trim(src.contactName || src.contact_name, 160);
  if (!first && !last && contactName) {
    const bits = splitName(contactName);
    first = bits.first.slice(0, 80);
    last = bits.last.slice(0, 80);
  }
  const email = trim(src.email, 160).toLowerCase();
  const displayName = leadDisplayName({
    companyName: companyName,
    contactFirst: first,
    contactLast: last,
    displayName: src.displayName || src.display_name,
    email: email
  });
  if (!companyName && !first && !last && !email && !trim(src.phone, 40)) {
    throw new Error('Enter a company, contact name, email, or phone.');
  }
  return {
    companyName: companyName,
    displayName: displayName,
    contactFirst: first,
    contactLast: last,
    email: email,
    phone: trim(src.phone, 40),
    mobile: trim(src.mobile, 40),
    website: trim(src.website, 200),
    source: leadSource(src.source),
    sourceKey: trim(src.sourceKey || src.source_key, 200),
    status: leadStatus(src.status),
    ownerName: trim(src.ownerName || src.owner_name, 120),
    projectType: trim(src.projectType || src.project_type, 160),
    city: trim(src.city, 80),
    state: trim(src.state, 80),
    country: trim(src.country, 80) || 'United States',
    notes: trim(src.notes, 4000),
    convertedCustomerId: idOrNull(src.convertedCustomerId != null ? src.convertedCustomerId : src.converted_customer_id),
    mergedIntoId: idOrNull(src.mergedIntoId != null ? src.mergedIntoId : src.merged_into_id)
  };
}

function formatLead(row) {
  if (!row) return null;
  const first = row.contact_first || '';
  const last = row.contact_last || '';
  const contact = [first, last].filter(Boolean).join(' ').trim();
  const company = row.company_name || '';
  return {
    id: row.id,
    companyName: company,
    displayName: row.display_name || company || contact || row.email || 'Lead',
    contactFirst: first,
    contactLast: last,
    contactName: contact,
    email: row.email || '',
    phone: row.phone || '',
    mobile: row.mobile || '',
    website: row.website || '',
    source: row.source || 'manual',
    sourceKey: row.source_key || '',
    status: row.status || 'new',
    ownerName: row.owner_name || '',
    projectType: row.project_type || '',
    city: row.city || '',
    state: row.state || '',
    country: row.country || '',
    notes: row.notes || '',
    convertedCustomerId: row.converted_customer_id || null,
    mergedIntoId: row.merged_into_id || null,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

function leadDbFields(input) {
  return {
    company_name: input.companyName,
    display_name: input.displayName,
    contact_first: input.contactFirst,
    contact_last: input.contactLast,
    email: input.email,
    phone: input.phone,
    mobile: input.mobile,
    website: input.website,
    source: input.source,
    source_key: input.sourceKey,
    status: input.status,
    owner_name: input.ownerName,
    project_type: input.projectType,
    city: input.city,
    state: input.state,
    country: input.country,
    notes: input.notes,
    converted_customer_id: input.convertedCustomerId,
    merged_into_id: input.mergedIntoId
  };
}

function normalizeDeal(input) {
  const src = input || {};
  const title = trim(src.title, 160);
  const companyName = trim(src.companyName || src.company_name, 160);
  if (!title && !companyName) throw new Error('Enter a deal name or company.');
  return {
    title: title || companyName || 'Deal',
    companyName: companyName,
    contactName: trim(src.contactName || src.contact_name, 160),
    email: trim(src.email, 160).toLowerCase(),
    stage: dealStage(src.stage),
    value: Math.max(0, num(src.value)),
    expectedClose: trim(src.expectedClose || src.expected_close, 20),
    ownerName: trim(src.ownerName || src.owner_name, 120),
    notes: trim(src.notes, 4000),
    leadId: idOrNull(src.leadId != null ? src.leadId : src.lead_id),
    customerId: idOrNull(src.customerId != null ? src.customerId : src.customer_id),
    quoteId: idOrNull(src.quoteId != null ? src.quoteId : src.quote_id),
    wonReason: closeReason(src.wonReason != null ? src.wonReason : src.won_reason),
    lostReason: closeReason(src.lostReason != null ? src.lostReason : src.lost_reason)
  };
}

function formatDeal(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title || '',
    companyName: row.company_name || '',
    contactName: row.contact_name || '',
    email: row.email || '',
    stage: row.stage || 'new',
    value: num(row.value),
    expectedClose: row.expected_close || '',
    ownerName: row.owner_name || '',
    notes: row.notes || '',
    leadId: row.lead_id || null,
    customerId: row.customer_id || null,
    quoteId: row.quote_id || null,
    quoteNumber: row.quote_number || row.quoteNumber || '',
    quoteTotal: num(row.quote_total != null ? row.quote_total : row.quoteTotal),
    wonReason: row.won_reason || '',
    lostReason: row.lost_reason || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

function dealDbFields(input) {
  return {
    title: input.title,
    company_name: input.companyName,
    contact_name: input.contactName,
    email: input.email,
    stage: input.stage,
    value: input.value,
    expected_close: input.expectedClose,
    owner_name: input.ownerName,
    notes: input.notes,
    lead_id: input.leadId,
    customer_id: input.customerId,
    quote_id: input.quoteId,
    won_reason: input.wonReason,
    lost_reason: input.lostReason
  };
}

function normalizeActivity(input) {
  const src = input || {};
  const type = activityType(src.type);
  const subject = trim(src.subject, 200) || (type === 'note' ? 'Note' : type.charAt(0).toUpperCase() + type.slice(1));
  const leadId = idOrNull(src.leadId != null ? src.leadId : src.lead_id);
  const dealId = idOrNull(src.dealId != null ? src.dealId : src.deal_id);
  const customerId = idOrNull(src.customerId != null ? src.customerId : src.customer_id);
  let doneAt = trim(src.doneAt || src.done_at, 40);
  if (src.done === true || src.done === 1 || src.done === '1') {
    doneAt = doneAt || new Date().toISOString();
  }
  if (src.done === false || src.done === 0 || src.done === '0') doneAt = '';
  return {
    type: type,
    subject: subject,
    body: trim(src.body, 4000),
    dueAt: trim(src.dueAt || src.due_at, 40),
    doneAt: doneAt,
    leadId: leadId,
    dealId: dealId,
    customerId: customerId,
    createdByName: trim(src.createdByName || src.created_by_name, 120),
    assignedTo: trim(src.assignedTo || src.assigned_to, 120)
  };
}

function formatActivity(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type || 'note',
    subject: row.subject || '',
    body: row.body || '',
    dueAt: row.due_at || '',
    doneAt: row.done_at || '',
    leadId: row.lead_id || null,
    dealId: row.deal_id || null,
    customerId: row.customer_id || null,
    createdByName: row.created_by_name || '',
    assignedTo: row.assigned_to || '',
    leadName: row.lead_name || row.leadName || '',
    dealTitle: row.deal_title || row.dealTitle || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

function activityDbFields(input) {
  return {
    type: input.type,
    subject: input.subject,
    body: input.body,
    due_at: input.dueAt,
    done_at: input.doneAt,
    lead_id: input.leadId,
    deal_id: input.dealId,
    customer_id: input.customerId,
    created_by_name: input.createdByName,
    assigned_to: input.assignedTo
  };
}

function forSupabase(fields) {
  const out = Object.assign({}, fields);
  ['converted_customer_id', 'merged_into_id', 'lead_id', 'customer_id', 'quote_id', 'deal_id', 'activity_id'].forEach(function (key) {
    if (!Object.prototype.hasOwnProperty.call(out, key)) return;
    if (out[key] == null) out[key] = null;
  });
  return out;
}

function leadFromInquiry(inquiry) {
  const src = inquiry || {};
  const name = trim(src.name || src.contact_name, 160);
  const bits = splitName(name);
  const email = trim(src.email, 160).toLowerCase();
  const source = leadSource(src.source || 'website');
  const sourceKey = trim(src.sourceKey || src.source_key, 200) || (email ? source + ':' + email : '');
  const notes = trim(src.notes || src.message, 4000);
  return normalizeLead({
    companyName: src.company || src.companyName || src.company_name,
    contactFirst: bits.first,
    contactLast: bits.last,
    email: email,
    phone: src.phone,
    website: src.website,
    source: source,
    sourceKey: sourceKey,
    status: 'new',
    projectType: src.projectType || src.project_type,
    city: src.city,
    state: src.state,
    country: src.country,
    notes: notes
  });
}

function customerPayloadFromLead(lead) {
  return {
    companyName: lead.companyName || '',
    displayName: lead.displayName || '',
    contactFirst: lead.contactFirst || '',
    contactLast: lead.contactLast || '',
    email: lead.email || '',
    phone: lead.phone || '',
    mobile: lead.mobile || '',
    website: lead.website || '',
    billCity: lead.city || '',
    billState: lead.state || '',
    billCountry: lead.country || 'United States',
    shipSame: true,
    source: lead.source || '',
    salesRep: lead.ownerName || '',
    customerType: lead.projectType || '',
    notes: lead.notes || ''
  };
}

function dealFromLead(lead, extra) {
  const src = extra || {};
  return {
    title: src.title || (lead.companyName ? lead.companyName + ' deal' : lead.displayName || 'Deal'),
    companyName: lead.companyName || '',
    contactName: lead.contactName || [lead.contactFirst, lead.contactLast].filter(Boolean).join(' '),
    email: lead.email || '',
    stage: src.stage || 'new',
    value: src.value,
    expectedClose: src.expectedClose,
    ownerName: src.ownerName || lead.ownerName || '',
    notes: src.notes || '',
    leadId: lead.id,
    customerId: lead.convertedCustomerId || src.customerId || null
  };
}

function nowIso() {
  return new Date().toISOString();
}

function ensureCompanyCrm(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS company_crm_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL DEFAULT '',
      display_name TEXT NOT NULL DEFAULT '',
      contact_first TEXT NOT NULL DEFAULT '',
      contact_last TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      mobile TEXT NOT NULL DEFAULT '',
      website TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'manual',
      source_key TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'new',
      owner_name TEXT NOT NULL DEFAULT '',
      project_type TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT 'United States',
      notes TEXT NOT NULL DEFAULT '',
      converted_customer_id INTEGER,
      merged_into_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS company_crm_leads_status_idx ON company_crm_leads (status, updated_at);
    CREATE INDEX IF NOT EXISTS company_crm_leads_email_idx ON company_crm_leads (email);
    CREATE INDEX IF NOT EXISTS company_crm_leads_source_key_idx ON company_crm_leads (source_key);
    CREATE TABLE IF NOT EXISTS company_crm_deals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT '',
      company_name TEXT NOT NULL DEFAULT '',
      contact_name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      stage TEXT NOT NULL DEFAULT 'new',
      value REAL NOT NULL DEFAULT 0,
      expected_close TEXT NOT NULL DEFAULT '',
      owner_name TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      lead_id INTEGER,
      customer_id INTEGER,
      quote_id INTEGER,
      won_reason TEXT NOT NULL DEFAULT '',
      lost_reason TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS company_crm_deals_stage_idx ON company_crm_deals (stage, expected_close);
    CREATE INDEX IF NOT EXISTS company_crm_deals_lead_idx ON company_crm_deals (lead_id);
    CREATE TABLE IF NOT EXISTS company_crm_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'note',
      subject TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      due_at TEXT NOT NULL DEFAULT '',
      done_at TEXT NOT NULL DEFAULT '',
      lead_id INTEGER,
      deal_id INTEGER,
      customer_id INTEGER,
      created_by_name TEXT NOT NULL DEFAULT '',
      assigned_to TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS company_crm_activities_due_idx ON company_crm_activities (due_at, done_at);
    CREATE INDEX IF NOT EXISTS company_crm_activities_lead_idx ON company_crm_activities (lead_id);
    CREATE INDEX IF NOT EXISTS company_crm_activities_deal_idx ON company_crm_activities (deal_id);
    CREATE TABLE IF NOT EXISTS company_crm_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER,
      deal_id INTEGER,
      activity_id INTEGER,
      direction TEXT NOT NULL DEFAULT 'in',
      from_email TEXT NOT NULL DEFAULT '',
      to_email TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'compose',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS company_crm_messages_lead_idx ON company_crm_messages (lead_id, created_at);
  `);
  [
    'ALTER TABLE company_crm_leads ADD COLUMN merged_into_id INTEGER',
    "ALTER TABLE company_crm_deals ADD COLUMN won_reason TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE company_crm_deals ADD COLUMN lost_reason TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE company_crm_activities ADD COLUMN assigned_to TEXT NOT NULL DEFAULT ''"
  ].forEach(function (sql) {
    try { db.exec(sql); } catch (e) { /* already present */ }
  });
}

function insertRow(db, table, fields) {
  const stamp = nowIso();
  const keys = Object.keys(fields);
  const info = db.prepare(
    'INSERT INTO ' + table + ' (' + keys.join(', ') + ', created_at, updated_at) VALUES (' +
    keys.map(function () { return '?'; }).join(', ') + ', ?, ?)'
  ).run(...keys.map(function (k) { return fields[k]; }).concat([stamp, stamp]));
  return info.lastInsertRowid;
}

function updateRow(db, table, id, fields) {
  const keys = Object.keys(fields);
  db.prepare(
    'UPDATE ' + table + ' SET ' + keys.map(function (k) { return k + ' = ?'; }).join(', ') + ', updated_at = ? WHERE id = ?'
  ).run(...keys.map(function (k) { return fields[k]; }).concat([nowIso(), id]));
}

function openLeadBySourceKey(db, sourceKey) {
  if (!sourceKey) return null;
  return db.prepare(`
    SELECT * FROM company_crm_leads
    WHERE source_key = ? AND status NOT IN ('converted', 'lost')
      AND (merged_into_id IS NULL OR merged_into_id = 0)
    ORDER BY id DESC LIMIT 1
  `).get(sourceKey);
}

function sqliteAttachQuotes(db, deals) {
  return (deals || []).map(function (deal) {
    if (!deal || !deal.quoteId) return deal;
    const row = db.prepare('SELECT id, number FROM company_sales_docs WHERE id = ?').get(deal.quoteId);
    if (!row) return deal;
    deal.quoteNumber = row.number || '';
    const tot = db.prepare(
      'SELECT COALESCE(SUM(qty * unit_price), 0) AS n FROM company_sales_lines WHERE doc_id = ?'
    ).get(deal.quoteId);
    deal.quoteTotal = tot ? Number(tot.n) || 0 : 0;
    return deal;
  });
}

function sqliteListMessages(db, leadId) {
  return db.prepare(
    'SELECT * FROM company_crm_messages WHERE lead_id = ? ORDER BY datetime(created_at) ASC, id ASC'
  ).all(leadId).map(formatMessage);
}

function sqliteApi(db, store) {
  return {
    async listCrmLeads() {
      return db.prepare(
        'SELECT * FROM company_crm_leads ORDER BY datetime(updated_at) DESC, id DESC'
      ).all().map(formatLead);
    },
    async getCrmLead(id) {
      const lead = formatLead(db.prepare('SELECT * FROM company_crm_leads WHERE id = ?').get(id));
      if (!lead) return null;
      lead.deals = sqliteAttachQuotes(db, db.prepare('SELECT * FROM company_crm_deals WHERE lead_id = ? ORDER BY id DESC').all(id).map(formatDeal));
      lead.activities = db.prepare(
        'SELECT * FROM company_crm_activities WHERE lead_id = ? ORDER BY datetime(created_at) DESC, id DESC'
      ).all(id).map(formatActivity);
      lead.messages = sqliteListMessages(db, id);
      lead.duplicates = db.prepare('SELECT * FROM company_crm_leads ORDER BY id DESC').all()
        .map(formatLead)
        .filter(function (row) {
          return leadMatchesDuplicate(row, lead.email, lead.companyName, lead.id);
        });
      return lead;
    },
    async createCrmLead(payload) {
      const input = normalizeLead(payload);
      const id = insertRow(db, 'company_crm_leads', leadDbFields(input));
      return this.getCrmLead(id);
    },
    async updateCrmLead(id, payload) {
      const current = formatLead(db.prepare('SELECT * FROM company_crm_leads WHERE id = ?').get(id));
      if (!current) return null;
      const input = normalizeLead(Object.assign({}, current, payload));
      updateRow(db, 'company_crm_leads', id, leadDbFields(input));
      return this.getCrmLead(id);
    },
    async deleteCrmLead(id) {
      const info = db.prepare('DELETE FROM company_crm_leads WHERE id = ?').run(id);
      return info.changes > 0;
    },
    async upsertCrmLeadFromInquiry(inquiry) {
      const input = leadFromInquiry(inquiry);
      const existing = openLeadBySourceKey(db, input.sourceKey);
      let lead;
      if (existing) {
        const merged = normalizeLead(Object.assign({}, formatLead(existing), input, {
          status: existing.status || 'new',
          notes: [existing.notes, input.notes].filter(Boolean).join('\n\n').slice(0, 4000)
        }));
        updateRow(db, 'company_crm_leads', existing.id, leadDbFields(merged));
        lead = await this.getCrmLead(existing.id);
      } else {
        lead = await this.createCrmLead(input);
      }
      const inbound = inquiryMessageFromLead(lead, {
        notes: input.notes,
        subject: inquiry && inquiry.subject
      });
      if (inbound) await this.createCrmMessage(inbound);
      return this.getCrmLead(lead.id);
    },
    async findCrmDuplicates(query) {
      const src = query || {};
      const email = trim(src.email, 160).toLowerCase();
      const companyName = trim(src.companyName || src.company_name, 160);
      const excludeId = idOrNull(src.excludeId != null ? src.excludeId : src.exclude_id);
      if (!email && !companyName) return [];
      return db.prepare('SELECT * FROM company_crm_leads ORDER BY datetime(updated_at) DESC, id DESC').all()
        .map(formatLead)
        .filter(function (row) {
          return leadMatchesDuplicate(row, email, companyName, excludeId);
        });
    },
    async importCrmLeads(rows) {
      const created = [];
      const errors = [];
      (rows || []).forEach(function (row, i) {
        try {
          const input = normalizeLead(row);
          const id = insertRow(db, 'company_crm_leads', leadDbFields(input));
          created.push(id);
        } catch (err) {
          errors.push({ row: i + 1, error: err.message || 'Could not import row.' });
        }
      });
      return { created: created.length, errors: errors };
    },
    async mergeCrmLeads(fromId, intoId) {
      const from = formatLead(db.prepare('SELECT * FROM company_crm_leads WHERE id = ?').get(fromId));
      const into = formatLead(db.prepare('SELECT * FROM company_crm_leads WHERE id = ?').get(intoId));
      if (!from || !into) return null;
      if (String(from.id) === String(into.id)) throw new Error('Choose a different lead to merge into.');
      if (from.mergedIntoId) throw new Error('That lead was already merged.');
      const next = normalizeLead(fillEmptyLeadFields(into, from));
      updateRow(db, 'company_crm_leads', into.id, leadDbFields(next));
      const stamp = nowIso();
      db.prepare('UPDATE company_crm_deals SET lead_id = ?, updated_at = ? WHERE lead_id = ?').run(into.id, stamp, from.id);
      db.prepare('UPDATE company_crm_activities SET lead_id = ?, updated_at = ? WHERE lead_id = ?').run(into.id, stamp, from.id);
      db.prepare('UPDATE company_crm_messages SET lead_id = ?, updated_at = ? WHERE lead_id = ?').run(into.id, stamp, from.id);
      updateRow(db, 'company_crm_leads', from.id, leadDbFields(normalizeLead(Object.assign({}, from, {
        status: 'lost',
        mergedIntoId: into.id,
        notes: ('Merged into lead #' + into.id + (from.notes ? '\n\n' + from.notes : '')).slice(0, 4000)
      }))));
      return this.getCrmLead(into.id);
    },
    async convertCrmLead(id, opts) {
      const options = opts || {};
      if (options.mergeIntoId && String(options.mergeIntoId) !== String(id)) {
        const merged = await this.mergeCrmLeads(id, options.mergeIntoId);
        if (!merged) return null;
        id = merged.id;
      }
      let lead = await this.getCrmLead(id);
      if (!lead) return null;
      let customer = null;
      if (lead.convertedCustomerId) {
        customer = await store.getCompanyCustomer(lead.convertedCustomerId);
      } else {
        customer = await store.createCompanyCustomer(customerPayloadFromLead(lead));
        const next = normalizeLead(Object.assign({}, lead, {
          status: 'converted',
          convertedCustomerId: customer.id
        }));
        updateRow(db, 'company_crm_leads', id, leadDbFields(next));
        db.prepare(
          'UPDATE company_crm_deals SET customer_id = ?, updated_at = ? WHERE lead_id = ? AND (customer_id IS NULL OR customer_id = 0)'
        ).run(customer.id, nowIso(), id);
        lead = await this.getCrmLead(id);
      }
      let quote = null;
      if (options.createQuote && customer && customer.id) {
        quote = await store.createSalesDoc({
          type: 'quote',
          customerId: customer.id,
          notes: lead.notes || '',
          status: 'draft'
        });
        const deals = lead.deals || [];
        if (deals.length) {
          await this.updateCrmDeal(deals[0].id, { quoteId: quote.id, customerId: customer.id, stage: deals[0].stage === 'new' ? 'quoted' : deals[0].stage });
        } else {
          await this.createCrmDeal({
            title: (lead.companyName || lead.displayName || 'Lead') + ' deal',
            companyName: lead.companyName,
            contactName: lead.contactName,
            email: lead.email,
            ownerName: lead.ownerName,
            leadId: lead.id,
            customerId: customer.id,
            quoteId: quote.id,
            value: options.value,
            stage: 'quoted'
          });
        }
        lead = await this.getCrmLead(id);
      }
      return { lead: lead, customer: customer, quote: quote };
    },
    async listCrmDeals() {
      return sqliteAttachQuotes(db, db.prepare(
        'SELECT * FROM company_crm_deals ORDER BY datetime(updated_at) DESC, id DESC'
      ).all().map(formatDeal));
    },
    async getCrmDeal(id) {
      const deal = formatDeal(db.prepare('SELECT * FROM company_crm_deals WHERE id = ?').get(id));
      if (!deal) return null;
      sqliteAttachQuotes(db, [deal]);
      deal.activities = db.prepare(
        'SELECT * FROM company_crm_activities WHERE deal_id = ? ORDER BY datetime(created_at) DESC, id DESC'
      ).all(id).map(formatActivity);
      if (deal.leadId) deal.lead = formatLead(db.prepare('SELECT * FROM company_crm_leads WHERE id = ?').get(deal.leadId));
      return deal;
    },
    async createCrmDeal(payload) {
      let input = normalizeDeal(payload);
      if (input.leadId) {
        const lead = formatLead(db.prepare('SELECT * FROM company_crm_leads WHERE id = ?').get(input.leadId));
        if (!lead) throw new Error('Lead not found.');
        input = normalizeDeal(Object.assign({}, dealFromLead(lead, payload), payload, { leadId: lead.id }));
      }
      const id = insertRow(db, 'company_crm_deals', dealDbFields(input));
      return this.getCrmDeal(id);
    },
    async updateCrmDeal(id, payload) {
      const current = db.prepare('SELECT * FROM company_crm_deals WHERE id = ?').get(id);
      if (!current) return null;
      const input = normalizeDeal(Object.assign({}, formatDeal(current), payload));
      updateRow(db, 'company_crm_deals', id, dealDbFields(input));
      return this.getCrmDeal(id);
    },
    async deleteCrmDeal(id) {
      const info = db.prepare('DELETE FROM company_crm_deals WHERE id = ?').run(id);
      return info.changes > 0;
    },
    async listCrmActivities() {
      return db.prepare(
        'SELECT * FROM company_crm_activities ORDER BY CASE WHEN done_at = \'\' THEN 0 ELSE 1 END, due_at, datetime(created_at) DESC, id DESC'
      ).all().map(formatActivity);
    },
    async getCrmActivity(id) {
      return formatActivity(db.prepare('SELECT * FROM company_crm_activities WHERE id = ?').get(id));
    },
    async createCrmActivity(payload) {
      const input = normalizeActivity(payload);
      const id = insertRow(db, 'company_crm_activities', activityDbFields(input));
      return this.getCrmActivity(id);
    },
    async updateCrmActivity(id, payload) {
      const current = db.prepare('SELECT * FROM company_crm_activities WHERE id = ?').get(id);
      if (!current) return null;
      const input = normalizeActivity(Object.assign({}, formatActivity(current), payload));
      updateRow(db, 'company_crm_activities', id, activityDbFields(input));
      return this.getCrmActivity(id);
    },
    async deleteCrmActivity(id) {
      const info = db.prepare('DELETE FROM company_crm_activities WHERE id = ?').run(id);
      return info.changes > 0;
    },
    async listCrmMessages(leadId) {
      return sqliteListMessages(db, leadId);
    },
    async createCrmMessage(payload) {
      const input = normalizeMessage(payload);
      if (!input.leadId) throw new Error('Lead is required.');
      const id = insertRow(db, 'company_crm_messages', messageDbFields(input));
      return formatMessage(db.prepare('SELECT * FROM company_crm_messages WHERE id = ?').get(id));
    },
    async listCrmReminders() {
      return db.prepare(`
        SELECT a.*, l.display_name AS lead_name, d.title AS deal_title
        FROM company_crm_activities a
        LEFT JOIN company_crm_leads l ON l.id = a.lead_id
        LEFT JOIN company_crm_deals d ON d.id = a.deal_id
        WHERE (a.done_at IS NULL OR a.done_at = '')
          AND a.due_at IS NOT NULL AND a.due_at != ''
        ORDER BY datetime(a.due_at) ASC, a.id ASC
        LIMIT 20
      `).all().map(formatActivity);
    },
    async listCrmAssignees() {
      const admins = await store.listAdmins();
      return (admins || []).map(function (row) {
        return {
          id: row.id,
          name: row.name || '',
          email: row.email || '',
          label: row.name || row.email || 'Staff'
        };
      }).filter(function (row) { return row.label; });
    }
  };
}

function supabaseApi(supabase, store) {
  const throwIf = function (error, fallback) {
    if (!error) return;
    throw new Error(error.message || fallback || 'Supabase error');
  };

  async function fetchLeadRow(id) {
    const { data, error } = await supabase.from('company_crm_leads').select('*').eq('id', id).maybeSingle();
    throwIf(error, 'Could not load lead.');
    return data;
  }

  async function attachQuotes(deals) {
    const list = deals || [];
    const ids = [];
    list.forEach(function (deal) {
      if (deal && deal.quoteId && ids.indexOf(deal.quoteId) === -1) ids.push(deal.quoteId);
    });
    if (!ids.length) return list;
    const { data, error } = await supabase.from('company_sales_docs').select('id, number').in('id', ids);
    throwIf(error, 'Could not load quotes.');
    const map = {};
    (data || []).forEach(function (row) { map[row.id] = row; });
    list.forEach(function (deal) {
      const row = deal.quoteId ? map[deal.quoteId] : null;
      if (!row) return;
      deal.quoteNumber = row.number || '';
    });
    return list;
  }

  async function listMessages(leadId) {
    const { data, error } = await supabase
      .from('company_crm_messages')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });
    throwIf(error, 'Could not list messages.');
    return (data || []).map(formatMessage);
  }

  return {
    async listCrmLeads() {
      const { data, error } = await supabase
        .from('company_crm_leads')
        .select('*')
        .order('updated_at', { ascending: false })
        .order('id', { ascending: false });
      throwIf(error, 'Could not list leads.');
      return (data || []).map(formatLead);
    },
    async getCrmLead(id) {
      const data = await fetchLeadRow(id);
      const lead = formatLead(data);
      if (!lead) return null;
      const [deals, activities, messages, allLeads] = await Promise.all([
        supabase.from('company_crm_deals').select('*').eq('lead_id', id).order('id', { ascending: false }),
        supabase.from('company_crm_activities').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
        supabase.from('company_crm_messages').select('*').eq('lead_id', id).order('created_at', { ascending: true }),
        supabase.from('company_crm_leads').select('*').order('id', { ascending: false })
      ]);
      throwIf(deals.error, 'Could not list deals.');
      throwIf(activities.error, 'Could not list activities.');
      throwIf(messages.error, 'Could not list messages.');
      throwIf(allLeads.error, 'Could not list leads.');
      lead.deals = await attachQuotes((deals.data || []).map(formatDeal));
      lead.activities = (activities.data || []).map(formatActivity);
      lead.messages = (messages.data || []).map(formatMessage);
      lead.duplicates = (allLeads.data || []).map(formatLead).filter(function (row) {
        return leadMatchesDuplicate(row, lead.email, lead.companyName, lead.id);
      });
      return lead;
    },
    async createCrmLead(payload) {
      const input = normalizeLead(payload);
      const fields = forSupabase(leadDbFields(input));
      const stamp = nowIso();
      fields.created_at = stamp;
      fields.updated_at = stamp;
      const { data, error } = await supabase.from('company_crm_leads').insert(fields).select('*').single();
      throwIf(error, 'Could not add lead.');
      return this.getCrmLead(data.id);
    },
    async updateCrmLead(id, payload) {
      const current = formatLead(await fetchLeadRow(id));
      if (!current) return null;
      const input = normalizeLead(Object.assign({}, current, payload));
      const fields = forSupabase(leadDbFields(input));
      fields.updated_at = nowIso();
      const { data, error } = await supabase.from('company_crm_leads').update(fields).eq('id', id).select('*').maybeSingle();
      throwIf(error, 'Could not save lead.');
      if (!data) return null;
      return this.getCrmLead(id);
    },
    async deleteCrmLead(id) {
      const { data, error } = await supabase.from('company_crm_leads').delete().eq('id', id).select('id');
      throwIf(error, 'Could not delete lead.');
      return !!(data && data.length);
    },
    async upsertCrmLeadFromInquiry(inquiry) {
      const input = leadFromInquiry(inquiry);
      let lead = null;
      if (input.sourceKey) {
        const { data, error } = await supabase
          .from('company_crm_leads')
          .select('*')
          .eq('source_key', input.sourceKey)
          .order('id', { ascending: false })
          .limit(8);
        throwIf(error, 'Could not match lead.');
        const existing = (data || []).find(function (row) {
          const status = String(row.status || '').toLowerCase();
          return status !== 'converted' && status !== 'lost' && !row.merged_into_id;
        }) || null;
        if (existing) {
          const merged = normalizeLead(Object.assign({}, formatLead(existing), input, {
            status: existing.status || 'new',
            notes: [existing.notes, input.notes].filter(Boolean).join('\n\n').slice(0, 4000)
          }));
          lead = await this.updateCrmLead(existing.id, merged);
        }
      }
      if (!lead) lead = await this.createCrmLead(input);
      const inbound = inquiryMessageFromLead(lead, {
        notes: input.notes,
        subject: inquiry && inquiry.subject
      });
      if (inbound) await this.createCrmMessage(inbound);
      return this.getCrmLead(lead.id);
    },
    async findCrmDuplicates(query) {
      const src = query || {};
      const email = trim(src.email, 160).toLowerCase();
      const companyName = trim(src.companyName || src.company_name, 160);
      const excludeId = idOrNull(src.excludeId != null ? src.excludeId : src.exclude_id);
      if (!email && !companyName) return [];
      const { data, error } = await supabase.from('company_crm_leads').select('*').order('updated_at', { ascending: false });
      throwIf(error, 'Could not list leads.');
      return (data || []).map(formatLead).filter(function (row) {
        return leadMatchesDuplicate(row, email, companyName, excludeId);
      });
    },
    async importCrmLeads(rows) {
      const created = [];
      const errors = [];
      for (let i = 0; i < (rows || []).length; i++) {
        try {
          const lead = await this.createCrmLead(rows[i]);
          created.push(lead.id);
        } catch (err) {
          errors.push({ row: i + 1, error: err.message || 'Could not import row.' });
        }
      }
      return { created: created.length, errors: errors };
    },
    async mergeCrmLeads(fromId, intoId) {
      const from = formatLead(await fetchLeadRow(fromId));
      const into = formatLead(await fetchLeadRow(intoId));
      if (!from || !into) return null;
      if (String(from.id) === String(into.id)) throw new Error('Choose a different lead to merge into.');
      if (from.mergedIntoId) throw new Error('That lead was already merged.');
      await this.updateCrmLead(into.id, fillEmptyLeadFields(into, from));
      const stamp = nowIso();
      const fromDeals = await supabase.from('company_crm_deals').update({ lead_id: into.id, updated_at: stamp }).eq('lead_id', from.id);
      throwIf(fromDeals.error, 'Could not move deals.');
      const fromActs = await supabase.from('company_crm_activities').update({ lead_id: into.id, updated_at: stamp }).eq('lead_id', from.id);
      throwIf(fromActs.error, 'Could not move activities.');
      const fromMail = await supabase.from('company_crm_messages').update({ lead_id: into.id, updated_at: stamp }).eq('lead_id', from.id);
      throwIf(fromMail.error, 'Could not move email.');
      await this.updateCrmLead(from.id, Object.assign({}, from, {
        status: 'lost',
        mergedIntoId: into.id,
        notes: ('Merged into lead #' + into.id + (from.notes ? '\n\n' + from.notes : '')).slice(0, 4000)
      }));
      return this.getCrmLead(into.id);
    },
    async convertCrmLead(id, opts) {
      const options = opts || {};
      if (options.mergeIntoId && String(options.mergeIntoId) !== String(id)) {
        const merged = await this.mergeCrmLeads(id, options.mergeIntoId);
        if (!merged) return null;
        id = merged.id;
      }
      let lead = await this.getCrmLead(id);
      if (!lead) return null;
      let customer = null;
      if (lead.convertedCustomerId) {
        customer = await store.getCompanyCustomer(lead.convertedCustomerId);
      } else {
        customer = await store.createCompanyCustomer(customerPayloadFromLead(lead));
        lead = await this.updateCrmLead(id, Object.assign({}, lead, {
          status: 'converted',
          convertedCustomerId: customer.id
        }));
        await supabase
          .from('company_crm_deals')
          .update({ customer_id: customer.id, updated_at: nowIso() })
          .eq('lead_id', id)
          .is('customer_id', null);
        lead = await this.getCrmLead(id);
      }
      let quote = null;
      if (options.createQuote && customer && customer.id) {
        quote = await store.createSalesDoc({
          type: 'quote',
          customerId: customer.id,
          notes: lead.notes || '',
          status: 'draft'
        });
        const deals = lead.deals || [];
        if (deals.length) {
          await this.updateCrmDeal(deals[0].id, {
            quoteId: quote.id,
            customerId: customer.id,
            stage: deals[0].stage === 'new' ? 'quoted' : deals[0].stage
          });
        } else {
          await this.createCrmDeal({
            title: (lead.companyName || lead.displayName || 'Lead') + ' deal',
            companyName: lead.companyName,
            contactName: lead.contactName,
            email: lead.email,
            ownerName: lead.ownerName,
            leadId: lead.id,
            customerId: customer.id,
            quoteId: quote.id,
            value: options.value,
            stage: 'quoted'
          });
        }
        lead = await this.getCrmLead(id);
      }
      return { lead: lead, customer: customer, quote: quote };
    },
    async listCrmDeals() {
      const { data, error } = await supabase
        .from('company_crm_deals')
        .select('*')
        .order('updated_at', { ascending: false })
        .order('id', { ascending: false });
      throwIf(error, 'Could not list deals.');
      return attachQuotes((data || []).map(formatDeal));
    },
    async getCrmDeal(id) {
      const { data, error } = await supabase.from('company_crm_deals').select('*').eq('id', id).maybeSingle();
      throwIf(error, 'Could not load deal.');
      const deal = formatDeal(data);
      if (!deal) return null;
      await attachQuotes([deal]);
      const acts = await supabase
        .from('company_crm_activities')
        .select('*')
        .eq('deal_id', id)
        .order('created_at', { ascending: false });
      throwIf(acts.error, 'Could not list activities.');
      deal.activities = (acts.data || []).map(formatActivity);
      if (deal.leadId) {
        const leadRow = await fetchLeadRow(deal.leadId);
        deal.lead = formatLead(leadRow);
      }
      return deal;
    },
    async createCrmDeal(payload) {
      let input = normalizeDeal(payload);
      if (input.leadId) {
        const lead = formatLead(await fetchLeadRow(input.leadId));
        if (!lead) throw new Error('Lead not found.');
        input = normalizeDeal(Object.assign({}, dealFromLead(lead, payload), payload, { leadId: lead.id }));
      }
      const fields = forSupabase(dealDbFields(input));
      const stamp = nowIso();
      fields.created_at = stamp;
      fields.updated_at = stamp;
      const { data, error } = await supabase.from('company_crm_deals').insert(fields).select('*').single();
      throwIf(error, 'Could not add deal.');
      return this.getCrmDeal(data.id);
    },
    async updateCrmDeal(id, payload) {
      const { data: current, error: curErr } = await supabase.from('company_crm_deals').select('*').eq('id', id).maybeSingle();
      throwIf(curErr, 'Could not load deal.');
      if (!current) return null;
      const input = normalizeDeal(Object.assign({}, formatDeal(current), payload));
      const fields = forSupabase(dealDbFields(input));
      fields.updated_at = nowIso();
      const { data, error } = await supabase.from('company_crm_deals').update(fields).eq('id', id).select('*').maybeSingle();
      throwIf(error, 'Could not save deal.');
      if (!data) return null;
      return this.getCrmDeal(id);
    },
    async deleteCrmDeal(id) {
      const { data, error } = await supabase.from('company_crm_deals').delete().eq('id', id).select('id');
      throwIf(error, 'Could not delete deal.');
      return !!(data && data.length);
    },
    async listCrmActivities() {
      const { data, error } = await supabase
        .from('company_crm_activities')
        .select('*')
        .order('created_at', { ascending: false });
      throwIf(error, 'Could not list activities.');
      return (data || []).map(formatActivity);
    },
    async getCrmActivity(id) {
      const { data, error } = await supabase.from('company_crm_activities').select('*').eq('id', id).maybeSingle();
      throwIf(error, 'Could not load activity.');
      return formatActivity(data);
    },
    async createCrmActivity(payload) {
      const input = normalizeActivity(payload);
      const fields = forSupabase(activityDbFields(input));
      const stamp = nowIso();
      fields.created_at = stamp;
      fields.updated_at = stamp;
      const { data, error } = await supabase.from('company_crm_activities').insert(fields).select('*').single();
      throwIf(error, 'Could not add activity.');
      return formatActivity(data);
    },
    async updateCrmActivity(id, payload) {
      const { data: current, error: curErr } = await supabase.from('company_crm_activities').select('*').eq('id', id).maybeSingle();
      throwIf(curErr, 'Could not load activity.');
      if (!current) return null;
      const input = normalizeActivity(Object.assign({}, formatActivity(current), payload));
      const fields = forSupabase(activityDbFields(input));
      fields.updated_at = nowIso();
      const { data, error } = await supabase.from('company_crm_activities').update(fields).eq('id', id).select('*').maybeSingle();
      throwIf(error, 'Could not save activity.');
      return formatActivity(data);
    },
    async deleteCrmActivity(id) {
      const { data, error } = await supabase.from('company_crm_activities').delete().eq('id', id).select('id');
      throwIf(error, 'Could not delete activity.');
      return !!(data && data.length);
    },
    async listCrmMessages(leadId) {
      return listMessages(leadId);
    },
    async createCrmMessage(payload) {
      const input = normalizeMessage(payload);
      if (!input.leadId) throw new Error('Lead is required.');
      const fields = forSupabase(messageDbFields(input));
      const stamp = nowIso();
      fields.created_at = stamp;
      fields.updated_at = stamp;
      const { data, error } = await supabase.from('company_crm_messages').insert(fields).select('*').single();
      throwIf(error, 'Could not save email.');
      return formatMessage(data);
    },
    async listCrmReminders() {
      const { data, error } = await supabase
        .from('company_crm_activities')
        .select('*')
        .eq('done_at', '')
        .neq('due_at', '')
        .order('due_at', { ascending: true })
        .limit(20);
      throwIf(error, 'Could not list reminders.');
      const acts = (data || []).map(formatActivity);
      const leadIds = [];
      const dealIds = [];
      acts.forEach(function (act) {
        if (act.leadId && leadIds.indexOf(act.leadId) === -1) leadIds.push(act.leadId);
        if (act.dealId && dealIds.indexOf(act.dealId) === -1) dealIds.push(act.dealId);
      });
      const [leads, deals] = await Promise.all([
        leadIds.length
          ? supabase.from('company_crm_leads').select('id, display_name').in('id', leadIds)
          : Promise.resolve({ data: [], error: null }),
        dealIds.length
          ? supabase.from('company_crm_deals').select('id, title').in('id', dealIds)
          : Promise.resolve({ data: [], error: null })
      ]);
      throwIf(leads.error, 'Could not list leads.');
      throwIf(deals.error, 'Could not list deals.');
      const leadMap = {};
      const dealMap = {};
      (leads.data || []).forEach(function (row) { leadMap[row.id] = row.display_name; });
      (deals.data || []).forEach(function (row) { dealMap[row.id] = row.title; });
      acts.forEach(function (act) {
        act.leadName = act.leadId ? (leadMap[act.leadId] || '') : '';
        act.dealTitle = act.dealId ? (dealMap[act.dealId] || '') : '';
      });
      return acts;
    },
    async listCrmAssignees() {
      const admins = await store.listAdmins();
      return (admins || []).map(function (row) {
        return {
          id: row.id,
          name: row.name || '',
          email: row.email || '',
          label: row.name || row.email || 'Staff'
        };
      }).filter(function (row) { return row.label; });
    }
  };
}

function crmDashboardCounts(leads, deals, activities) {
  const leadList = leads || [];
  const dealList = deals || [];
  const actList = activities || [];
  const openStatuses = { new: 1, working: 1, qualified: 1 };
  const openStages = { new: 1, qualified: 1, quoted: 1, negotiation: 1 };
  let openLeads = 0;
  leadList.forEach(function (row) {
    if (openStatuses[row.status]) openLeads += 1;
  });
  let pipelineValue = 0;
  let openDeals = 0;
  dealList.forEach(function (row) {
    if (openStages[row.stage]) {
      openDeals += 1;
      pipelineValue += Number(row.value) || 0;
    }
  });
  const now = Date.now();
  let overdue = 0;
  actList.forEach(function (row) {
    if (row.doneAt) return;
    if (!row.dueAt) return;
    const due = Date.parse(row.dueAt);
    if (Number.isFinite(due) && due < now) overdue += 1;
  });
  return {
    leads: leadList.length,
    openLeads: openLeads,
    deals: dealList.length,
    openDeals: openDeals,
    pipelineValue: pipelineValue,
    activities: actList.length,
    overdueActivities: overdue
  };
}

module.exports = {
  LEAD_STATUSES,
  DEAL_STAGES,
  ACTIVITY_TYPES,
  CLOSE_REASONS,
  CRM_SALES_EMAIL,
  LEAD_CSV_HEADERS,
  normalizeLead,
  formatLead,
  leadDbFields,
  normalizeDeal,
  formatDeal,
  dealDbFields,
  normalizeActivity,
  formatActivity,
  activityDbFields,
  normalizeMessage,
  formatMessage,
  forSupabase,
  leadFromInquiry,
  customerPayloadFromLead,
  dealFromLead,
  closeReason,
  closeReasonLabel,
  leadsToCsv,
  leadsFromCsv,
  ensureCompanyCrm,
  sqliteApi,
  supabaseApi,
  crmDashboardCounts
};
