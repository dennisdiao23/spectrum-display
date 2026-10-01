/**
 * A lead Spectrum sends to one dealer. The dealer can accept or decline it.
 * The dealer cannot add their own jobs here. Those stay in deal registration.
 */

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

function asId(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : value;
}

function statusLabel(status) {
  if (status === 'accepted') return 'Accepted';
  if (status === 'declined') return 'Declined';
  return 'New';
}

function readInput(body) {
  const project = trim(body && body.project, 160);
  if (!project) throw Object.assign(new Error('Add a project name.'), { code: 'invalid' });
  const customerId = trim(body && (body.customerId || body.customer_id), 40);
  if (!customerId) throw Object.assign(new Error('Choose a dealer.'), { code: 'invalid' });
  return {
    customerId: customerId,
    project: project,
    contactName: trim(body && (body.contactName || body.contact_name), 120),
    contactEmail: trim(body && (body.contactEmail || body.contact_email), 160),
    contactPhone: trim(body && (body.contactPhone || body.contact_phone), 40),
    city: trim(body && body.city, 80),
    state: trim(body && body.state, 40),
    interest: trim(body && body.interest, 240),
    notes: trim(body && body.notes, 4000)
  };
}

function readReply(body) {
  return trim(body && (body.note || body.replyNote || body.reply_note), 2000);
}

function formatRow(row, extras) {
  if (!row) return null;
  const extra = extras || {};
  const status = row.status || 'sent';
  const out = {
    id: String(row.id),
    number: row.number || '',
    customerId: row.customer_id == null ? '' : String(row.customer_id),
    project: row.project || '',
    contactName: row.contact_name || '',
    contactEmail: row.contact_email || '',
    contactPhone: row.contact_phone || '',
    city: row.city || '',
    state: row.state || '',
    interest: row.interest || '',
    notes: row.notes || '',
    status: status,
    statusLabel: statusLabel(status),
    replyNote: row.reply_note || '',
    repliedAt: row.replied_at || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
  if (extra.admin) out.dealerName = extra.dealerName || '';
  return out;
}

function nextNumberFrom(numbers) {
  let max = 1000;
  (numbers || []).forEach(function (number) {
    const match = String(number || '').match(/^LD-(\d+)$/i);
    if (match) max = Math.max(max, Number(match[1]) || 0);
  });
  return 'LD-' + (max + 1);
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

async function assertDealer(store, customerId) {
  if (!store || typeof store.getCompanyCustomer !== 'function') {
    throw Object.assign(new Error('Choose a dealer.'), { code: 'invalid' });
  }
  const customer = await store.getCompanyCustomer(customerId);
  if (!customer || String(customer.customerType || '').trim().toLowerCase() !== 'dealer') {
    throw Object.assign(new Error('Choose a dealer.'), { code: 'invalid' });
  }
  return customer;
}

function ensureDealerLeads(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dealer_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL,
      project TEXT NOT NULL DEFAULT '',
      contact_name TEXT NOT NULL DEFAULT '',
      contact_email TEXT NOT NULL DEFAULT '',
      contact_phone TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT '',
      interest TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'sent',
      reply_note TEXT NOT NULL DEFAULT '',
      replied_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS dealer_leads_customer_idx ON dealer_leads (customer_id, created_at);
  `);
}

function sqliteApi(db, store) {
  function getRow(id) {
    return db.prepare('SELECT * FROM dealer_leads WHERE id = ?').get(id);
  }
  function reply(user, id, status, body) {
    const row = getRow(id);
    if (!row || String(row.customer_id) !== dealerCustomerId(user)) return null;
    if (row.status !== 'sent') {
      throw Object.assign(new Error('This lead is already answered.'), { code: 'invalid' });
    }
    const stamp = nowIso();
    db.prepare(`
      UPDATE dealer_leads
      SET status = ?, reply_note = ?, replied_at = ?, updated_at = ?
      WHERE id = ?
    `).run(status, readReply(body), stamp, stamp, id);
    return formatRow(getRow(id));
  }
  return {
    async listDealerLeads() {
      const names = await dealerNames(store);
      return db.prepare('SELECT * FROM dealer_leads ORDER BY datetime(created_at) DESC, id DESC').all().map(function (row) {
        return formatRow(row, { admin: true, dealerName: names[String(row.customer_id)] || '' });
      });
    },
    async createDealerLead(body) {
      const input = readInput(body);
      await assertDealer(store, input.customerId);
      const numbers = db.prepare('SELECT number FROM dealer_leads').all().map(function (row) { return row.number; });
      const stamp = nowIso();
      const info = db.prepare(`
        INSERT INTO dealer_leads (
          number, customer_id, project, contact_name, contact_email, contact_phone,
          city, state, interest, notes, status, reply_note, replied_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', '', '', ?, ?)
      `).run(
        nextNumberFrom(numbers),
        asId(input.customerId),
        input.project,
        input.contactName,
        input.contactEmail,
        input.contactPhone,
        input.city,
        input.state,
        input.interest,
        input.notes,
        stamp,
        stamp
      );
      const names = await dealerNames(store);
      const row = getRow(info.lastInsertRowid);
      return formatRow(row, { admin: true, dealerName: names[String(row.customer_id)] || '' });
    },
    async listPortalLeads(user) {
      const customerId = dealerCustomerId(user);
      if (!customerId) return [];
      return db.prepare(
        'SELECT * FROM dealer_leads WHERE customer_id = ? ORDER BY datetime(created_at) DESC, id DESC'
      ).all(customerId).map(function (row) { return formatRow(row); });
    },
    async getPortalLead(user, id) {
      const row = getRow(id);
      if (!row || String(row.customer_id) !== dealerCustomerId(user)) return null;
      return formatRow(row);
    },
    async acceptPortalLead(user, id, body) {
      return reply(user, id, 'accepted', body);
    },
    async declinePortalLead(user, id, body) {
      return reply(user, id, 'declined', body);
    }
  };
}

function supabaseApi(supabase, store) {
  async function getRow(id) {
    const { data, error } = await supabase.from('dealer_leads').select('*').eq('id', id).maybeSingle();
    throwIf(error, 'Could not load this lead.');
    return data;
  }
  async function reply(user, id, status, body) {
    const row = await getRow(id);
    if (!row || String(row.customer_id) !== dealerCustomerId(user)) return null;
    if (row.status !== 'sent') {
      throw Object.assign(new Error('This lead is already answered.'), { code: 'invalid' });
    }
    const stamp = nowIso();
    const { data, error } = await supabase.from('dealer_leads').update({
      status: status,
      reply_note: readReply(body),
      replied_at: stamp,
      updated_at: stamp
    }).eq('id', id).select('*').single();
    throwIf(error, 'Could not save this lead.');
    return formatRow(data);
  }
  return {
    async listDealerLeads() {
      const names = await dealerNames(store);
      const { data, error } = await supabase.from('dealer_leads').select('*').order('created_at', { ascending: false });
      throwIf(error, 'Could not load leads.');
      return (data || []).map(function (row) {
        return formatRow(row, { admin: true, dealerName: names[String(row.customer_id)] || '' });
      });
    },
    async createDealerLead(body) {
      const input = readInput(body);
      await assertDealer(store, input.customerId);
      const { data: existing, error: listError } = await supabase.from('dealer_leads').select('number');
      throwIf(listError, 'Could not save this lead.');
      const stamp = nowIso();
      const fields = {
        number: nextNumberFrom((existing || []).map(function (row) { return row.number; })),
        customer_id: asId(input.customerId),
        project: input.project,
        contact_name: input.contactName,
        contact_email: input.contactEmail,
        contact_phone: input.contactPhone,
        city: input.city,
        state: input.state,
        interest: input.interest,
        notes: input.notes,
        status: 'sent',
        reply_note: '',
        replied_at: '',
        created_at: stamp,
        updated_at: stamp
      };
      const { data, error } = await supabase.from('dealer_leads').insert(fields).select('*').single();
      throwIf(error, 'Could not save this lead.');
      const names = await dealerNames(store);
      return formatRow(data, { admin: true, dealerName: names[String(data.customer_id)] || '' });
    },
    async listPortalLeads(user) {
      const customerId = dealerCustomerId(user);
      if (!customerId) return [];
      const { data, error } = await supabase.from('dealer_leads').select('*').eq('customer_id', customerId).order('created_at', { ascending: false });
      throwIf(error, 'Could not load your leads.');
      return (data || []).map(function (row) { return formatRow(row); });
    },
    async getPortalLead(user, id) {
      const row = await getRow(id);
      if (!row || String(row.customer_id) !== dealerCustomerId(user)) return null;
      return formatRow(row);
    },
    async acceptPortalLead(user, id, body) {
      return reply(user, id, 'accepted', body);
    },
    async declinePortalLead(user, id, body) {
      return reply(user, id, 'declined', body);
    }
  };
}

module.exports = {
  ensureDealerLeads: ensureDealerLeads,
  sqliteApi: sqliteApi,
  supabaseApi: supabaseApi
};
