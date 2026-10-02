/**
 * A lead Spectrum sends to one dealer. The dealer can accept or decline it.
 * After they accept, both sides share the same pipeline stage.
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

const PIPELINE = [
  { id: 'new', label: 'New' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'quoted', label: 'Quoted' },
  { id: 'negotiation', label: 'Negotiation' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' }
];

function statusLabel(status) {
  if (status === 'accepted') return 'Accepted';
  if (status === 'declined') return 'Declined';
  if (status === 'reassigned') return 'Reassigned';
  return 'Waiting';
}

function stageLabel(stage) {
  const hit = PIPELINE.find(function (item) { return item.id === stage; });
  return hit ? hit.label : '';
}

function pipelineStage(value) {
  const v = String(value || '').toLowerCase().trim();
  const hit = PIPELINE.find(function (item) { return item.id === v; });
  if (!hit) throw Object.assign(new Error('Choose a stage.'), { code: 'invalid' });
  return hit.id;
}

function leadStatusForStage(stage) {
  if (stage === 'lost') return 'lost';
  if (stage === 'won') return 'converted';
  if (stage === 'new') return 'working';
  return 'qualified';
}

function actorName(actor) {
  return trim((actor && (actor.name || actor.email)) || '', 120);
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
    crmLeadId: row.crm_lead_id ? String(row.crm_lead_id) : '',
    crmDealId: row.crm_deal_id ? String(row.crm_deal_id) : '',
    stage: row.stage || '',
    stageLabel: stageLabel(row.stage || ''),
    stageUpdatedAt: row.stage_updated_at || '',
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

async function assertDealerLogin(store, customerId) {
  if (!store || typeof store.listDealerUsersForCustomer !== 'function') return;
  const users = await store.listDealerUsersForCustomer(customerId);
  const active = (users || []).some(function (user) { return user && user.active !== false; });
  if (!active) {
    throw Object.assign(new Error('This dealer cannot sign in yet. Add a portal login on the dealer first.'), { code: 'invalid' });
  }
}

async function dealerLabel(store, customerId) {
  if (!store || typeof store.getCompanyCustomer !== 'function') return 'Dealer';
  const customer = await store.getCompanyCustomer(customerId);
  return (customer && (customer.displayName || customer.companyName)) || 'Dealer';
}

async function syncAcceptedLead(store, saved, opts) {
  if (!saved || !saved.crmLeadId || !store || typeof store.getCrmLead !== 'function') return null;
  const lead = await store.getCrmLead(saved.crmLeadId);
  if (!lead) return null;
  const open = (lead.deals || []).find(function (deal) { return deal.stage !== 'won' && deal.stage !== 'lost'; });
  let deal = open || null;
  if (deal) {
    if (deal.stage !== 'new') deal = await store.updateCrmDeal(deal.id, { stage: 'new' });
  } else if (typeof store.createCrmDeal === 'function') {
    deal = await store.createCrmDeal({
      leadId: lead.id,
      stage: 'new',
      title: (lead.companyName || lead.displayName || saved.project || 'Lead') + ' deal'
    });
  }
  if (typeof store.updateCrmLead === 'function') {
    await store.updateCrmLead(lead.id, { status: 'working' });
  }
  const name = await dealerLabel(store, saved.customerId);
  if (!(opts && opts.silent) && typeof store.createCrmActivity === 'function') {
    await store.createCrmActivity({
      type: 'note',
      subject: name + ' accepted this lead',
      body: saved.replyNote || '',
      leadId: lead.id,
      dealId: deal && deal.id,
      done: true,
      createdByName: name
    });
  }
  return deal && deal.id;
}

async function syncDeclinedLead(store, saved) {
  if (!saved || !saved.crmLeadId || !store || typeof store.createCrmActivity !== 'function') return;
  const name = await dealerLabel(store, saved.customerId);
  await store.createCrmActivity({
    type: 'note',
    subject: name + ' declined this lead',
    body: saved.replyNote || '',
    leadId: saved.crmLeadId,
    done: true,
    createdByName: name
  });
}

async function syncMovedLead(store, saved, stage) {
  if (!saved || !saved.crmLeadId || !store) return;
  if (saved.crmDealId && typeof store.getCrmDeal === 'function' && typeof store.updateCrmDeal === 'function') {
    const deal = await store.getCrmDeal(saved.crmDealId);
    if (deal && deal.stage !== stage) await store.updateCrmDeal(saved.crmDealId, { stage: stage });
  }
  if (typeof store.updateCrmLead === 'function') {
    await store.updateCrmLead(saved.crmLeadId, { status: leadStatusForStage(stage) });
  }
  if (typeof store.createCrmActivity === 'function') {
    const name = await dealerLabel(store, saved.customerId);
    await store.createCrmActivity({
      type: 'note',
      subject: name + ' moved this to ' + stageLabel(stage),
      leadId: saved.crmLeadId,
      dealId: saved.crmDealId || null,
      done: true,
      createdByName: name
    });
  }
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
  ['crm_lead_id INTEGER', 'crm_deal_id INTEGER', "stage TEXT NOT NULL DEFAULT ''", "stage_updated_at TEXT NOT NULL DEFAULT ''"].forEach(function (column) {
    try { db.exec('ALTER TABLE dealer_leads ADD COLUMN ' + column); } catch (err) { /* already present */ }
  });
  db.exec('CREATE INDEX IF NOT EXISTS dealer_leads_crm_lead_idx ON dealer_leads (crm_lead_id);');
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
    const nextStage = status === 'accepted' ? 'new' : '';
    db.prepare(`
      UPDATE dealer_leads
      SET status = ?, reply_note = ?, replied_at = ?, stage = ?, stage_updated_at = ?, updated_at = ?
      WHERE id = ?
    `).run(status, readReply(body), stamp, nextStage, nextStage ? stamp : '', stamp, id);
    return formatRow(getRow(id));
  }
  return {
    async listDealerLeads() {
      const names = await dealerNames(store);
      return db.prepare("SELECT * FROM dealer_leads WHERE status != 'reassigned' ORDER BY datetime(created_at) DESC, id DESC").all().map(function (row) {
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'accepted', '', '', ?, ?)
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
      db.prepare("UPDATE dealer_leads SET stage = 'new', stage_updated_at = ? WHERE id = ?").run(stamp, info.lastInsertRowid);
      const names = await dealerNames(store);
      const row = getRow(info.lastInsertRowid);
      return formatRow(row, { admin: true, dealerName: names[String(row.customer_id)] || '' });
    },
    async listPortalLeads(user) {
      const customerId = dealerCustomerId(user);
      if (!customerId) return [];
      const waiting = db.prepare("SELECT id FROM dealer_leads WHERE customer_id = ? AND status = 'sent'").all(customerId);
      for (let i = 0; i < waiting.length; i += 1) {
        const stamp = nowIso();
        db.prepare(
          "UPDATE dealer_leads SET status = 'accepted', stage = CASE WHEN stage = '' THEN 'new' ELSE stage END, stage_updated_at = CASE WHEN stage_updated_at = '' THEN ? ELSE stage_updated_at END, updated_at = ? WHERE id = ?"
        ).run(stamp, stamp, waiting[i].id);
        const opened = formatRow(getRow(waiting[i].id));
        const dealId = await syncAcceptedLead(store, opened, { silent: true });
        if (dealId && !opened.crmDealId) {
          db.prepare('UPDATE dealer_leads SET crm_deal_id = ? WHERE id = ?').run(asId(dealId), waiting[i].id);
        }
      }
      return db.prepare(
        "SELECT * FROM dealer_leads WHERE customer_id = ? AND status != 'reassigned' ORDER BY datetime(created_at) DESC, id DESC"
      ).all(customerId).map(function (row) { return formatRow(row); });
    },
    async getPortalLead(user, id) {
      const row = getRow(id);
      if (!row || String(row.customer_id) !== dealerCustomerId(user) || row.status === 'reassigned') return null;
      return formatRow(row);
    },
    async acceptPortalLead(user, id, body) {
      const saved = reply(user, id, 'accepted', body);
      if (!saved) return null;
      const dealId = await syncAcceptedLead(store, saved);
      if (dealId) {
        db.prepare('UPDATE dealer_leads SET crm_deal_id = ?, updated_at = ? WHERE id = ?').run(asId(dealId), nowIso(), id);
      }
      return formatRow(getRow(id));
    },
    async declinePortalLead(user, id, body) {
      const saved = reply(user, id, 'declined', body);
      if (!saved) return null;
      await syncDeclinedLead(store, saved);
      return saved;
    },
    async setPortalLeadStage(user, id, body) {
      const row = getRow(id);
      if (!row || String(row.customer_id) !== dealerCustomerId(user) || row.status === 'reassigned') return null;
      if (row.status !== 'accepted' && row.status !== 'sent') {
        throw Object.assign(new Error('This lead is closed.'), { code: 'invalid' });
      }
      if (row.status === 'sent') {
        db.prepare("UPDATE dealer_leads SET status = 'accepted', stage = CASE WHEN stage = '' THEN 'new' ELSE stage END, updated_at = ? WHERE id = ?").run(nowIso(), id);
      }
      const current = getRow(id);
      const stage = pipelineStage(body && body.stage);
      if (current.stage === stage) return formatRow(current);
      const stamp = nowIso();
      db.prepare('UPDATE dealer_leads SET stage = ?, stage_updated_at = ?, updated_at = ? WHERE id = ?').run(stage, stamp, stamp, id);
      const saved = formatRow(getRow(id));
      await syncMovedLead(store, saved, stage);
      return formatRow(getRow(id));
    },
    async sendCrmLeadToDealer(leadId, body, actor) {
      const lead = typeof store.getCrmLead === 'function' ? await store.getCrmLead(leadId) : null;
      if (!lead) return null;
      const customerId = trim(body && (body.customerId || body.customer_id), 40);
      await assertDealer(store, customerId);
      await assertDealerLogin(store, customerId);
      const stamp = nowIso();
      db.prepare(
        "UPDATE dealer_leads SET status = 'reassigned', updated_at = ? WHERE crm_lead_id = ? AND status IN ('sent', 'accepted')"
      ).run(stamp, asId(lead.id));
      const numbers = db.prepare('SELECT number FROM dealer_leads').all().map(function (row) { return row.number; });
      const project = trim(lead.companyName || lead.displayName || lead.projectType || 'Lead', 160) || 'Lead';
      const note = trim(body && (body.notes || body.note), 4000);
      const info = db.prepare(`
        INSERT INTO dealer_leads (
          number, customer_id, project, contact_name, contact_email, contact_phone,
          city, state, interest, notes, status, reply_note, replied_at,
          crm_lead_id, crm_deal_id, stage, stage_updated_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'accepted', '', '', ?, NULL, 'new', ?, ?, ?)
      `).run(
        nextNumberFrom(numbers),
        asId(customerId),
        project,
        trim(lead.contactName || [lead.contactFirst, lead.contactLast].filter(Boolean).join(' '), 120),
        trim(lead.email, 160),
        trim(lead.phone || lead.mobile, 40),
        trim(lead.city, 80),
        trim(lead.state, 40),
        trim(lead.projectType, 240),
        note,
        asId(lead.id),
        stamp,
        stamp,
        stamp
      );
      const placed = formatRow(getRow(info.lastInsertRowid));
      const dealId = await syncAcceptedLead(store, placed, { silent: true });
      if (dealId) {
        db.prepare('UPDATE dealer_leads SET crm_deal_id = ?, updated_at = ? WHERE id = ?').run(asId(dealId), nowIso(), info.lastInsertRowid);
      }
      const name = await dealerLabel(store, customerId);
      if (typeof store.createCrmActivity === 'function') {
        await store.createCrmActivity({
          type: 'note',
          subject: 'Sent to ' + name,
          body: note,
          leadId: lead.id,
          done: true,
          createdByName: actorName(actor) || 'Company'
        });
      }
      return store.getCrmLead(lead.id);
    },
    async attachCrmDealerHandoffs(leads) {
      const list = Array.isArray(leads) ? leads : (leads ? [leads] : []);
      const names = await dealerNames(store);
      const map = {};
      db.prepare(
        "SELECT * FROM dealer_leads WHERE crm_lead_id IS NOT NULL AND status != 'reassigned' ORDER BY datetime(created_at) DESC, id DESC"
      ).all().forEach(function (row) {
        const key = String(row.crm_lead_id);
        if (map[key]) return;
        map[key] = formatRow(row, { admin: true, dealerName: names[String(row.customer_id)] || '' });
      });
      list.forEach(function (lead) {
        if (!lead) return;
        lead.dealerHandoff = map[String(lead.id)] || null;
      });
      return Array.isArray(leads) ? list : (list[0] || null);
    },
    async mirrorCrmDealStage(deal) {
      if (!deal || deal.id == null) return;
      const row = db.prepare(
        "SELECT * FROM dealer_leads WHERE crm_deal_id = ? AND status = 'accepted' ORDER BY id DESC LIMIT 1"
      ).get(asId(deal.id));
      if (!row || (row.stage || '') === (deal.stage || '')) return;
      const stamp = nowIso();
      db.prepare('UPDATE dealer_leads SET stage = ?, stage_updated_at = ?, updated_at = ? WHERE id = ?').run(deal.stage || '', stamp, stamp, row.id);
      if (!row.crm_lead_id || typeof store.updateCrmLead !== 'function') return;
      await store.updateCrmLead(row.crm_lead_id, { status: leadStatusForStage(deal.stage) });
      if (typeof store.createCrmActivity === 'function') {
        await store.createCrmActivity({
          type: 'note',
          subject: 'Moved to ' + (stageLabel(deal.stage) || 'New'),
          leadId: row.crm_lead_id,
          dealId: deal.id,
          done: true,
          createdByName: 'Company'
        });
      }
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
    const nextStage = status === 'accepted' ? 'new' : '';
    const { data, error } = await supabase.from('dealer_leads').update({
      status: status,
      reply_note: readReply(body),
      replied_at: stamp,
      stage: nextStage,
      stage_updated_at: nextStage ? stamp : '',
      updated_at: stamp
    }).eq('id', id).select('*').single();
    throwIf(error, 'Could not save this lead.');
    return formatRow(data);
  }
  return {
    async listDealerLeads() {
      const names = await dealerNames(store);
      const { data, error } = await supabase.from('dealer_leads').select('*').neq('status', 'reassigned').order('created_at', { ascending: false });
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
        status: 'accepted',
        reply_note: '',
        replied_at: '',
        stage: 'new',
        stage_updated_at: stamp,
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
      const waiting = await supabase.from('dealer_leads').select('*').eq('customer_id', customerId).eq('status', 'sent');
      throwIf(waiting.error, 'Could not load your leads.');
      for (let i = 0; i < (waiting.data || []).length; i += 1) {
        const row = waiting.data[i];
        const stamp = nowIso();
        const opened = await supabase.from('dealer_leads').update({
          status: 'accepted',
          stage: row.stage || 'new',
          stage_updated_at: row.stage_updated_at || stamp,
          updated_at: stamp
        }).eq('id', row.id).select('*').single();
        throwIf(opened.error, 'Could not load your leads.');
        const saved = formatRow(opened.data);
        const dealId = await syncAcceptedLead(store, saved, { silent: true });
        if (dealId && !saved.crmDealId) {
          await supabase.from('dealer_leads').update({ crm_deal_id: asId(dealId) }).eq('id', row.id);
        }
      }
      const { data, error } = await supabase.from('dealer_leads').select('*').eq('customer_id', customerId).neq('status', 'reassigned').order('created_at', { ascending: false });
      throwIf(error, 'Could not load your leads.');
      return (data || []).map(function (row) { return formatRow(row); });
    },
    async getPortalLead(user, id) {
      const row = await getRow(id);
      if (!row || String(row.customer_id) !== dealerCustomerId(user) || row.status === 'reassigned') return null;
      return formatRow(row);
    },
    async acceptPortalLead(user, id, body) {
      const saved = await reply(user, id, 'accepted', body);
      if (!saved) return null;
      const dealId = await syncAcceptedLead(store, saved);
      if (dealId) {
        const { data, error } = await supabase.from('dealer_leads').update({
          crm_deal_id: asId(dealId),
          updated_at: nowIso()
        }).eq('id', id).select('*').single();
        throwIf(error, 'Could not save this lead.');
        return formatRow(data);
      }
      return saved;
    },
    async declinePortalLead(user, id, body) {
      const saved = await reply(user, id, 'declined', body);
      if (!saved) return null;
      await syncDeclinedLead(store, saved);
      return saved;
    },
    async setPortalLeadStage(user, id, body) {
      let row = await getRow(id);
      if (!row || String(row.customer_id) !== dealerCustomerId(user) || row.status === 'reassigned') return null;
      if (row.status !== 'accepted' && row.status !== 'sent') {
        throw Object.assign(new Error('This lead is closed.'), { code: 'invalid' });
      }
      if (row.status === 'sent') {
        const opened = await supabase.from('dealer_leads').update({
          status: 'accepted',
          stage: row.stage || 'new',
          updated_at: nowIso()
        }).eq('id', id).select('*').single();
        throwIf(opened.error, 'Could not save this lead.');
        row = opened.data;
      }
      const stage = pipelineStage(body && body.stage);
      if ((row.stage || '') === stage) return formatRow(row);
      const stamp = nowIso();
      const { data, error } = await supabase.from('dealer_leads').update({
        stage: stage,
        stage_updated_at: stamp,
        updated_at: stamp
      }).eq('id', id).select('*').single();
      throwIf(error, 'Could not save this lead.');
      const saved = formatRow(data);
      await syncMovedLead(store, saved, stage);
      return saved;
    },
    async sendCrmLeadToDealer(leadId, body, actor) {
      const lead = typeof store.getCrmLead === 'function' ? await store.getCrmLead(leadId) : null;
      if (!lead) return null;
      const customerId = trim(body && (body.customerId || body.customer_id), 40);
      await assertDealer(store, customerId);
      await assertDealerLogin(store, customerId);
      const stamp = nowIso();
      const { error: closeError } = await supabase.from('dealer_leads').update({
        status: 'reassigned',
        updated_at: stamp
      }).eq('crm_lead_id', asId(lead.id)).in('status', ['sent', 'accepted']);
      throwIf(closeError, 'Could not send this lead.');
      const { data: existing, error: listError } = await supabase.from('dealer_leads').select('number');
      throwIf(listError, 'Could not send this lead.');
      const project = trim(lead.companyName || lead.displayName || lead.projectType || 'Lead', 160) || 'Lead';
      const note = trim(body && (body.notes || body.note), 4000);
      const fields = {
        number: nextNumberFrom((existing || []).map(function (row) { return row.number; })),
        customer_id: asId(customerId),
        project: project,
        contact_name: trim(lead.contactName || [lead.contactFirst, lead.contactLast].filter(Boolean).join(' '), 120),
        contact_email: trim(lead.email, 160),
        contact_phone: trim(lead.phone || lead.mobile, 40),
        city: trim(lead.city, 80),
        state: trim(lead.state, 40),
        interest: trim(lead.projectType, 240),
        notes: note,
        status: 'accepted',
        reply_note: '',
        replied_at: '',
        crm_lead_id: asId(lead.id),
        stage: 'new',
        stage_updated_at: stamp,
        created_at: stamp,
        updated_at: stamp
      };
      const { data: inserted, error } = await supabase.from('dealer_leads').insert(fields).select('*').single();
      throwIf(error, 'Could not send this lead.');
      const placed = formatRow(inserted);
      const dealId = await syncAcceptedLead(store, placed, { silent: true });
      if (dealId) {
        await supabase.from('dealer_leads').update({ crm_deal_id: asId(dealId), updated_at: nowIso() }).eq('id', inserted.id);
      }
      const name = await dealerLabel(store, customerId);
      if (typeof store.createCrmActivity === 'function') {
        await store.createCrmActivity({
          type: 'note',
          subject: 'Sent to ' + name,
          body: note,
          leadId: lead.id,
          done: true,
          createdByName: actorName(actor) || 'Company'
        });
      }
      return store.getCrmLead(lead.id);
    },
    async attachCrmDealerHandoffs(leads) {
      const list = Array.isArray(leads) ? leads : (leads ? [leads] : []);
      const names = await dealerNames(store);
      const { data, error } = await supabase.from('dealer_leads').select('*').not('crm_lead_id', 'is', null).neq('status', 'reassigned').order('created_at', { ascending: false });
      throwIf(error, 'Could not load leads.');
      const map = {};
      (data || []).forEach(function (row) {
        const key = String(row.crm_lead_id);
        if (map[key]) return;
        map[key] = formatRow(row, { admin: true, dealerName: names[String(row.customer_id)] || '' });
      });
      list.forEach(function (lead) {
        if (!lead) return;
        lead.dealerHandoff = map[String(lead.id)] || null;
      });
      return Array.isArray(leads) ? list : (list[0] || null);
    },
    async mirrorCrmDealStage(deal) {
      if (!deal || deal.id == null) return;
      const { data, error } = await supabase.from('dealer_leads').select('*').eq('crm_deal_id', asId(deal.id)).eq('status', 'accepted').order('id', { ascending: false }).limit(1);
      throwIf(error, 'Could not save this lead.');
      const row = data && data[0];
      if (!row || (row.stage || '') === (deal.stage || '')) return;
      const stamp = nowIso();
      const saved = await supabase.from('dealer_leads').update({
        stage: deal.stage || '',
        stage_updated_at: stamp,
        updated_at: stamp
      }).eq('id', row.id);
      throwIf(saved.error, 'Could not save this lead.');
      if (!row.crm_lead_id || typeof store.updateCrmLead !== 'function') return;
      await store.updateCrmLead(row.crm_lead_id, { status: leadStatusForStage(deal.stage) });
      if (typeof store.createCrmActivity === 'function') {
        await store.createCrmActivity({
          type: 'note',
          subject: 'Moved to ' + (stageLabel(deal.stage) || 'New'),
          leadId: row.crm_lead_id,
          dealId: deal.id,
          done: true,
          createdByName: 'Company'
        });
      }
    }
  };
}

module.exports = {
  ensureDealerLeads: ensureDealerLeads,
  sqliteApi: sqliteApi,
  supabaseApi: supabaseApi
};
