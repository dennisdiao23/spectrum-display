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
    convertedCustomerId: idOrNull(src.convertedCustomerId != null ? src.convertedCustomerId : src.converted_customer_id)
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
    converted_customer_id: input.convertedCustomerId
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
    quoteId: idOrNull(src.quoteId != null ? src.quoteId : src.quote_id)
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
    quote_id: input.quoteId
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
    createdByName: trim(src.createdByName || src.created_by_name, 120)
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
    created_by_name: input.createdByName
  };
}

function forSupabase(fields) {
  const out = Object.assign({}, fields);
  ['converted_customer_id', 'lead_id', 'customer_id', 'quote_id', 'deal_id'].forEach(function (key) {
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
    customerType: lead.projectType || (lead.source === 'dealer' ? 'Dealer' : ''),
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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS company_crm_activities_due_idx ON company_crm_activities (due_at, done_at);
    CREATE INDEX IF NOT EXISTS company_crm_activities_lead_idx ON company_crm_activities (lead_id);
    CREATE INDEX IF NOT EXISTS company_crm_activities_deal_idx ON company_crm_activities (deal_id);
  `);
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
    ORDER BY id DESC LIMIT 1
  `).get(sourceKey);
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
      lead.deals = db.prepare('SELECT * FROM company_crm_deals WHERE lead_id = ? ORDER BY id DESC').all(id).map(formatDeal);
      lead.activities = db.prepare(
        'SELECT * FROM company_crm_activities WHERE lead_id = ? ORDER BY datetime(created_at) DESC, id DESC'
      ).all(id).map(formatActivity);
      return lead;
    },
    async createCrmLead(payload) {
      const input = normalizeLead(payload);
      const id = insertRow(db, 'company_crm_leads', leadDbFields(input));
      return this.getCrmLead(id);
    },
    async updateCrmLead(id, payload) {
      const current = db.prepare('SELECT id FROM company_crm_leads WHERE id = ?').get(id);
      if (!current) return null;
      const input = normalizeLead(payload);
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
      if (existing) {
        const merged = normalizeLead(Object.assign({}, formatLead(existing), input, {
          status: existing.status || 'new',
          notes: [existing.notes, input.notes].filter(Boolean).join('\n\n').slice(0, 4000)
        }));
        updateRow(db, 'company_crm_leads', existing.id, leadDbFields(merged));
        return this.getCrmLead(existing.id);
      }
      return this.createCrmLead(input);
    },
    async convertCrmLead(id) {
      const lead = await this.getCrmLead(id);
      if (!lead) return null;
      if (lead.convertedCustomerId) {
        const customer = await store.getCompanyCustomer(lead.convertedCustomerId);
        return { lead: lead, customer: customer };
      }
      const customer = await store.createCompanyCustomer(customerPayloadFromLead(lead));
      const next = normalizeLead(Object.assign({}, lead, {
        status: 'converted',
        convertedCustomerId: customer.id
      }));
      updateRow(db, 'company_crm_leads', id, leadDbFields(next));
      db.prepare(
        'UPDATE company_crm_deals SET customer_id = ?, updated_at = ? WHERE lead_id = ? AND (customer_id IS NULL OR customer_id = 0)'
      ).run(customer.id, nowIso(), id);
      return { lead: await this.getCrmLead(id), customer: customer };
    },
    async listCrmDeals() {
      return db.prepare(
        'SELECT * FROM company_crm_deals ORDER BY datetime(updated_at) DESC, id DESC'
      ).all().map(formatDeal);
    },
    async getCrmDeal(id) {
      const deal = formatDeal(db.prepare('SELECT * FROM company_crm_deals WHERE id = ?').get(id));
      if (!deal) return null;
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
      const [deals, activities] = await Promise.all([
        supabase.from('company_crm_deals').select('*').eq('lead_id', id).order('id', { ascending: false }),
        supabase.from('company_crm_activities').select('*').eq('lead_id', id).order('created_at', { ascending: false })
      ]);
      throwIf(deals.error, 'Could not list deals.');
      throwIf(activities.error, 'Could not list activities.');
      lead.deals = (deals.data || []).map(formatDeal);
      lead.activities = (activities.data || []).map(formatActivity);
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
      const input = normalizeLead(payload);
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
          return status !== 'converted' && status !== 'lost';
        }) || null;
        if (existing) {
          const merged = normalizeLead(Object.assign({}, formatLead(existing), input, {
            status: existing.status || 'new',
            notes: [existing.notes, input.notes].filter(Boolean).join('\n\n').slice(0, 4000)
          }));
          return this.updateCrmLead(existing.id, merged);
        }
      }
      return this.createCrmLead(input);
    },
    async convertCrmLead(id) {
      const lead = await this.getCrmLead(id);
      if (!lead) return null;
      if (lead.convertedCustomerId) {
        const customer = await store.getCompanyCustomer(lead.convertedCustomerId);
        return { lead: lead, customer: customer };
      }
      const customer = await store.createCompanyCustomer(customerPayloadFromLead(lead));
      const next = await this.updateCrmLead(id, Object.assign({}, lead, {
        status: 'converted',
        convertedCustomerId: customer.id
      }));
      await supabase
        .from('company_crm_deals')
        .update({ customer_id: customer.id, updated_at: nowIso() })
        .eq('lead_id', id)
        .is('customer_id', null);
      return { lead: next, customer: customer };
    },
    async listCrmDeals() {
      const { data, error } = await supabase
        .from('company_crm_deals')
        .select('*')
        .order('updated_at', { ascending: false })
        .order('id', { ascending: false });
      throwIf(error, 'Could not list deals.');
      return (data || []).map(formatDeal);
    },
    async getCrmDeal(id) {
      const { data, error } = await supabase.from('company_crm_deals').select('*').eq('id', id).maybeSingle();
      throwIf(error, 'Could not load deal.');
      const deal = formatDeal(data);
      if (!deal) return null;
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
  normalizeLead,
  formatLead,
  leadDbFields,
  normalizeDeal,
  formatDeal,
  dealDbFields,
  normalizeActivity,
  formatActivity,
  activityDbFields,
  forSupabase,
  leadFromInquiry,
  customerPayloadFromLead,
  dealFromLead,
  ensureCompanyCrm,
  sqliteApi,
  supabaseApi,
  crmDashboardCounts
};
