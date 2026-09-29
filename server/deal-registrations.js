/**
 * Named-job registration. A dealer submits one end-customer job.
 * Spectrum accepts it for a dated protection window. That is not a territory.
 */

function trim(value, max) {
  const text = String(value == null ? '' : value).trim();
  return max ? text.slice(0, max) : text;
}

function nowIso() {
  return new Date().toISOString();
}

function todayYmd() {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
  } catch (err) {
    return new Date().toISOString().slice(0, 10);
  }
}

function addDays(ymd, days) {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(String(ymd || '')) ? ymd : todayYmd();
  const d = new Date(base + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + (Number(days) || 0));
  return d.toISOString().slice(0, 10);
}

function normName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function namesMatch(a, b) {
  if (!a || !b || a.length < 3 || b.length < 3) return false;
  return a === b;
}

function siteKey(row) {
  const street = normName(row.siteStreet || row.site_street);
  const city = normName(row.siteCity || row.site_city);
  const state = normName(row.siteState || row.site_state);
  if (street.length < 4 || !city) return '';
  return street + '|' + city + '|' + state;
}

function sameNamedJob(a, b) {
  const end = namesMatch(normName(a.endCustomer || a.end_customer), normName(b.endCustomer || b.end_customer));
  if (!end) return false;
  const job = namesMatch(normName(a.jobName || a.job_name), normName(b.jobName || b.job_name));
  const siteA = siteKey(a);
  const siteB = siteKey(b);
  const site = !!(siteA && siteB && siteA === siteB);
  return job || site;
}

function liveStatus(row, today) {
  const status = String((row && (row.status)) || 'submitted');
  const until = String((row && (row.protectUntil || row.protect_until)) || '').slice(0, 10);
  if (status === 'protected' && until && until < (today || todayYmd())) return 'expired';
  return status;
}

function throwIf(error, message) {
  if (!error) return;
  const err = new Error(message || error.message || 'Request failed.');
  throw err;
}

function ensureDealRegistrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS deal_registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL,
      dealer_user_id INTEGER,
      end_customer TEXT NOT NULL DEFAULT '',
      job_name TEXT NOT NULL DEFAULT '',
      site_street TEXT NOT NULL DEFAULT '',
      site_city TEXT NOT NULL DEFAULT '',
      site_state TEXT NOT NULL DEFAULT '',
      selling TEXT NOT NULL DEFAULT '',
      expected_date TEXT NOT NULL DEFAULT '',
      contact_name TEXT NOT NULL DEFAULT '',
      contact_email TEXT NOT NULL DEFAULT '',
      contact_phone TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'submitted',
      protect_until TEXT NOT NULL DEFAULT '',
      decline_reason TEXT NOT NULL DEFAULT '',
      reviewed_at TEXT NOT NULL DEFAULT '',
      reviewed_by TEXT NOT NULL DEFAULT '',
      quote_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS deal_registrations_customer_idx ON deal_registrations (customer_id, status);
    CREATE INDEX IF NOT EXISTS deal_registrations_status_idx ON deal_registrations (status, protect_until);
  `);
}

function readInput(body) {
  const endCustomer = trim(body && body.endCustomer, 160);
  const jobName = trim(body && body.jobName, 160);
  const siteStreet = trim(body && body.siteStreet, 160);
  const siteCity = trim(body && body.siteCity, 80);
  const siteState = trim(body && body.siteState, 40);
  const selling = trim(body && body.selling, 240);
  if (!endCustomer) throw Object.assign(new Error('Enter the end customer company.'), { code: 'invalid' });
  if (!jobName) throw Object.assign(new Error('Enter the job name.'), { code: 'invalid' });
  if (!siteStreet || !siteCity || !siteState) {
    throw Object.assign(new Error('Enter the job site street, city, and state.'), { code: 'invalid' });
  }
  if (!selling) throw Object.assign(new Error('Say what you are selling.'), { code: 'invalid' });
  return {
    endCustomer: endCustomer,
    jobName: jobName,
    siteStreet: siteStreet,
    siteCity: siteCity,
    siteState: siteState,
    selling: selling,
    expectedDate: trim(body && body.expectedDate, 20),
    contactName: trim(body && body.contactName, 120),
    contactEmail: trim(body && body.contactEmail, 160),
    contactPhone: trim(body && body.contactPhone, 40),
    notes: trim(body && body.notes, 4000)
  };
}

function formatRow(row, extras) {
  if (!row) return null;
  const extra = extras || {};
  const status = liveStatus(row);
  const out = {
    id: String(row.id),
    number: row.number || '',
    customerId: row.customer_id == null ? '' : String(row.customer_id),
    endCustomer: row.end_customer || '',
    jobName: row.job_name || '',
    siteStreet: row.site_street || '',
    siteCity: row.site_city || '',
    siteState: row.site_state || '',
    selling: row.selling || '',
    expectedDate: row.expected_date || '',
    contactName: row.contact_name || '',
    contactEmail: row.contact_email || '',
    contactPhone: row.contact_phone || '',
    notes: row.notes || '',
    status: status,
    protectUntil: row.protect_until || '',
    declineReason: row.decline_reason || '',
    quoteId: row.quote_id == null ? '' : String(row.quote_id),
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
  if (extra.admin) out.dealerName = extra.dealerName || '';
  if (extra.admin) out.possibleMatch = !!extra.possibleMatch;
  return out;
}

function nextNumberFrom(numbers) {
  let max = 1000;
  (numbers || []).forEach(function (number) {
    const m = String(number || '').match(/^DR-(\d+)$/i);
    if (m) max = Math.max(max, Number(m[1]) || 0);
  });
  return 'DR-' + (max + 1);
}

async function dealerNames(store) {
  const map = {};
  if (!store || typeof store.listCompanyCustomers !== 'function') return map;
  const rows = await store.listCompanyCustomers();
  (rows || []).forEach(function (c) {
    map[String(c.id)] = c.displayName || c.companyName || '';
  });
  return map;
}

function dealerCustomerId(user) {
  const id = user && (user.customerId || user.customer_id);
  return id == null ? '' : String(id);
}

function protectedConflict(rows, input, ignoreId) {
  return (rows || []).find(function (row) {
    if (ignoreId && String(row.id) === String(ignoreId)) return false;
    if (liveStatus(row) !== 'protected') return false;
    return sameNamedJob(row, input);
  });
}

function markPossible(rows) {
  return (rows || []).map(function (row) {
    const hit = (rows || []).some(function (other) {
      if (String(other.id) === String(row.id)) return false;
      if (String(other.customer_id) === String(row.customer_id)) return false;
      const otherStatus = liveStatus(other);
      if (otherStatus !== 'submitted' && otherStatus !== 'protected') return false;
      return sameNamedJob(row, other);
    });
    return Object.assign({}, row, { possible_match: hit });
  });
}

function quoteBlobMatches(reg, probe) {
  const end = normName(reg.end_customer || reg.endCustomer);
  const job = normName(reg.job_name || reg.jobName);
  const street = normName(reg.site_street || reg.siteStreet);
  const city = normName(reg.site_city || reg.siteCity);
  const blob = normName([
    probe.customerName,
    probe.shipText,
    probe.notes,
    probe.billText
  ].join(' '));
  if (!blob) return false;
  if (end.length >= 3 && blob.indexOf(end) !== -1) return true;
  if (job.length >= 3 && blob.indexOf(job) !== -1 && city && blob.indexOf(city) !== -1) return true;
  if (street.length >= 4 && city && blob.indexOf(street) !== -1 && blob.indexOf(city) !== -1) return true;
  return false;
}

function sqliteApi(db, store) {
  function allRows() {
    return db.prepare('SELECT * FROM deal_registrations ORDER BY datetime(created_at) DESC, id DESC').all();
  }
  function getRow(id) {
    return db.prepare('SELECT * FROM deal_registrations WHERE id = ?').get(id);
  }
  function expireStale() {
    const today = todayYmd();
    db.prepare(`
      UPDATE deal_registrations
      SET status = 'expired', updated_at = ?
      WHERE status = 'protected' AND protect_until != '' AND protect_until < ?
    `).run(nowIso(), today);
  }
  async function present(row, admin) {
    if (!row) return null;
    const names = admin ? await dealerNames(store) : {};
    const marked = admin ? markPossible(allRows()).find(function (r) { return String(r.id) === String(row.id); }) : null;
    return formatRow(row, {
      admin: !!admin,
      dealerName: names[String(row.customer_id)] || '',
      possibleMatch: !!(marked && marked.possible_match)
    });
  }

  return {
    async listDealRegistrations() {
      expireStale();
      const names = await dealerNames(store);
      return markPossible(allRows()).map(function (row) {
        return formatRow(row, {
          admin: true,
          dealerName: names[String(row.customer_id)] || '',
          possibleMatch: !!row.possible_match
        });
      });
    },
    async listDealerDealRegistrations(user) {
      expireStale();
      const customerId = dealerCustomerId(user);
      if (!customerId) return [];
      return db.prepare(
        'SELECT * FROM deal_registrations WHERE customer_id = ? ORDER BY datetime(created_at) DESC, id DESC'
      ).all(customerId).map(function (row) { return formatRow(row); });
    },
    async getDealRegistration(id) {
      expireStale();
      return present(getRow(id), true);
    },
    async getDealerDealRegistration(user, id) {
      expireStale();
      const row = getRow(id);
      if (!row || String(row.customer_id) !== dealerCustomerId(user)) return null;
      return formatRow(row);
    },
    async createDealRegistration(user, body) {
      expireStale();
      const customerId = dealerCustomerId(user);
      if (!customerId) {
        throw Object.assign(new Error('This portal login is not linked to a dealer company.'), { code: 'no_customer' });
      }
      const input = readInput(body);
      const clash = protectedConflict(allRows(), input, '');
      if (clash) {
        throw Object.assign(new Error('This job is already registered.'), { code: 'protected' });
      }
      const numbers = db.prepare('SELECT number FROM deal_registrations').all().map(function (row) { return row.number; });
      const stamp = nowIso();
      const info = db.prepare(`
        INSERT INTO deal_registrations (
          number, customer_id, dealer_user_id, end_customer, job_name, site_street, site_city, site_state,
          selling, expected_date, contact_name, contact_email, contact_phone, notes,
          status, protect_until, decline_reason, reviewed_at, reviewed_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', '', '', '', '', ?, ?)
      `).run(
        nextNumberFrom(numbers),
        customerId,
        user && user.id ? user.id : null,
        input.endCustomer,
        input.jobName,
        input.siteStreet,
        input.siteCity,
        input.siteState,
        input.selling,
        input.expectedDate,
        input.contactName,
        input.contactEmail,
        input.contactPhone,
        input.notes,
        stamp,
        stamp
      );
      return formatRow(getRow(info.lastInsertRowid));
    },
    async acceptDealRegistration(id, actor, body) {
      expireStale();
      const row = getRow(id);
      if (!row) return null;
      if (liveStatus(row) === 'protected') return present(row, true);
      const until = trim(body && body.protectUntil, 20) || addDays(todayYmd(), 90);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(until) || until < todayYmd()) {
        throw Object.assign(new Error('Pick a protection end date that is today or later.'), { code: 'invalid' });
      }
      const clash = protectedConflict(allRows(), row, row.id);
      if (clash) {
        throw Object.assign(new Error('Another dealer already has this named job protected.'), { code: 'protected' });
      }
      const stamp = nowIso();
      db.prepare(`
        UPDATE deal_registrations
        SET status = 'protected', protect_until = ?, reviewed_at = ?, reviewed_by = ?, updated_at = ?
        WHERE id = ?
      `).run(until, stamp, trim((actor && (actor.name || actor.email)) || '', 160), stamp, id);
      return present(getRow(id), true);
    },
    async declineDealRegistration(id, actor, body) {
      const row = getRow(id);
      if (!row) return null;
      const reason = trim(body && (body.reason || body.declineReason), 1000);
      if (!reason) throw Object.assign(new Error('Enter a reason the dealer can read.'), { code: 'invalid' });
      const stamp = nowIso();
      db.prepare(`
        UPDATE deal_registrations
        SET status = 'declined', decline_reason = ?, protect_until = '', reviewed_at = ?, reviewed_by = ?, updated_at = ?
        WHERE id = ?
      `).run(reason, stamp, trim((actor && (actor.name || actor.email)) || '', 160), stamp, id);
      return present(getRow(id), true);
    },
    async attachDealRegistrationQuote(user, registrationId, quoteId) {
      const row = getRow(registrationId);
      const customerId = dealerCustomerId(user);
      if (!row || String(row.customer_id) !== customerId) return null;
      if (liveStatus(row) !== 'protected') {
        throw Object.assign(new Error('Request a quote after Spectrum protects this job.'), { code: 'invalid' });
      }
      db.prepare('UPDATE deal_registrations SET quote_id = ?, updated_at = ? WHERE id = ?')
        .run(quoteId || null, nowIso(), registrationId);
      return formatRow(getRow(registrationId));
    },
    async matchDealRegistrations(probe) {
      expireStale();
      const names = await dealerNames(store);
      const customerId = probe && probe.customerId ? String(probe.customerId) : '';
      return allRows().filter(function (row) {
        if (liveStatus(row) !== 'protected') return false;
        if (customerId && String(row.customer_id) === customerId) return false;
        return quoteBlobMatches(row, probe || {});
      }).map(function (row) {
        return {
          id: String(row.id),
          number: row.number,
          dealerName: names[String(row.customer_id)] || 'A dealer',
          endCustomer: row.end_customer || '',
          jobName: row.job_name || '',
          protectUntil: row.protect_until || '',
          siteCity: row.site_city || '',
          siteState: row.site_state || ''
        };
      });
    }
  };
}

function supabaseApi(supabase, store) {
  async function allRows() {
    const { data, error } = await supabase.from('deal_registrations').select('*').order('created_at', { ascending: false });
    throwIf(error, 'Could not load deal registrations.');
    return data || [];
  }
  async function expireStale(rows) {
    const today = todayYmd();
    const stale = (rows || []).filter(function (row) {
      return row.status === 'protected' && row.protect_until && String(row.protect_until).slice(0, 10) < today;
    });
    for (let i = 0; i < stale.length; i++) {
      const { error } = await supabase.from('deal_registrations').update({
        status: 'expired',
        updated_at: nowIso()
      }).eq('id', stale[i].id);
      throwIf(error, 'Could not expire a deal registration.');
      stale[i].status = 'expired';
    }
  }
  async function present(row, admin) {
    if (!row) return null;
    const names = admin ? await dealerNames(store) : {};
    const rows = admin ? markPossible(await allRows()) : [];
    const marked = rows.find(function (r) { return String(r.id) === String(row.id); });
    return formatRow(row, {
      admin: !!admin,
      dealerName: names[String(row.customer_id)] || '',
      possibleMatch: !!(marked && marked.possible_match)
    });
  }

  return {
    async listDealRegistrations() {
      const rows = await allRows();
      await expireStale(rows);
      const fresh = await allRows();
      const names = await dealerNames(store);
      return markPossible(fresh).map(function (row) {
        return formatRow(row, {
          admin: true,
          dealerName: names[String(row.customer_id)] || '',
          possibleMatch: !!row.possible_match
        });
      });
    },
    async listDealerDealRegistrations(user) {
      const customerId = dealerCustomerId(user);
      if (!customerId) return [];
      const { data, error } = await supabase.from('deal_registrations').select('*').eq('customer_id', customerId).order('created_at', { ascending: false });
      throwIf(error, 'Could not load your deal registrations.');
      await expireStale(data || []);
      const again = await supabase.from('deal_registrations').select('*').eq('customer_id', customerId).order('created_at', { ascending: false });
      throwIf(again.error, 'Could not load your deal registrations.');
      return (again.data || []).map(function (row) { return formatRow(row); });
    },
    async getDealRegistration(id) {
      const { data, error } = await supabase.from('deal_registrations').select('*').eq('id', id).maybeSingle();
      throwIf(error, 'Could not load this deal registration.');
      return present(data, true);
    },
    async getDealerDealRegistration(user, id) {
      const row = await this.getDealRegistration(id);
      if (!row || String(row.customerId) !== dealerCustomerId(user)) return null;
      delete row.dealerName;
      delete row.possibleMatch;
      return row;
    },
    async createDealRegistration(user, body) {
      const customerId = dealerCustomerId(user);
      if (!customerId) {
        throw Object.assign(new Error('This portal login is not linked to a dealer company.'), { code: 'no_customer' });
      }
      const input = readInput(body);
      const rows = await allRows();
      await expireStale(rows);
      const fresh = await allRows();
      if (protectedConflict(fresh, input, '')) {
        throw Object.assign(new Error('This job is already registered.'), { code: 'protected' });
      }
      const stamp = nowIso();
      const fields = {
        number: nextNumberFrom(fresh.map(function (row) { return row.number; })),
        customer_id: Number(customerId),
        dealer_user_id: user && user.id ? Number(user.id) : null,
        end_customer: input.endCustomer,
        job_name: input.jobName,
        site_street: input.siteStreet,
        site_city: input.siteCity,
        site_state: input.siteState,
        selling: input.selling,
        expected_date: input.expectedDate,
        contact_name: input.contactName,
        contact_email: input.contactEmail,
        contact_phone: input.contactPhone,
        notes: input.notes,
        status: 'submitted',
        protect_until: '',
        decline_reason: '',
        reviewed_at: '',
        reviewed_by: '',
        created_at: stamp,
        updated_at: stamp
      };
      const { data, error } = await supabase.from('deal_registrations').insert(fields).select('*').single();
      throwIf(error, 'Could not save this deal registration.');
      return formatRow(data);
    },
    async acceptDealRegistration(id, actor, body) {
      const { data, error } = await supabase.from('deal_registrations').select('*').eq('id', id).maybeSingle();
      throwIf(error, 'Could not load this deal registration.');
      if (!data) return null;
      const until = trim(body && body.protectUntil, 20) || addDays(todayYmd(), 90);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(until) || until < todayYmd()) {
        throw Object.assign(new Error('Pick a protection end date that is today or later.'), { code: 'invalid' });
      }
      const rows = await allRows();
      if (protectedConflict(rows, data, data.id)) {
        throw Object.assign(new Error('Another dealer already has this named job protected.'), { code: 'protected' });
      }
      const stamp = nowIso();
      const updated = await supabase.from('deal_registrations').update({
        status: 'protected',
        protect_until: until,
        reviewed_at: stamp,
        reviewed_by: trim((actor && (actor.name || actor.email)) || '', 160),
        updated_at: stamp
      }).eq('id', id).select('*').single();
      throwIf(updated.error, 'Could not protect this job.');
      return present(updated.data, true);
    },
    async declineDealRegistration(id, actor, body) {
      const reason = trim(body && (body.reason || body.declineReason), 1000);
      if (!reason) throw Object.assign(new Error('Enter a reason the dealer can read.'), { code: 'invalid' });
      const stamp = nowIso();
      const updated = await supabase.from('deal_registrations').update({
        status: 'declined',
        decline_reason: reason,
        protect_until: '',
        reviewed_at: stamp,
        reviewed_by: trim((actor && (actor.name || actor.email)) || '', 160),
        updated_at: stamp
      }).eq('id', id).select('*').single();
      throwIf(updated.error, 'Could not decline this job.');
      if (!updated.data) return null;
      return present(updated.data, true);
    },
    async attachDealRegistrationQuote(user, registrationId, quoteId) {
      const { data, error } = await supabase.from('deal_registrations').select('*').eq('id', registrationId).maybeSingle();
      throwIf(error, 'Could not load this deal registration.');
      if (!data || String(data.customer_id) !== dealerCustomerId(user)) return null;
      if (liveStatus(data) !== 'protected') {
        throw Object.assign(new Error('Request a quote after Spectrum protects this job.'), { code: 'invalid' });
      }
      const updated = await supabase.from('deal_registrations').update({
        quote_id: quoteId || null,
        updated_at: nowIso()
      }).eq('id', registrationId).select('*').single();
      throwIf(updated.error, 'Could not link the quote.');
      return formatRow(updated.data);
    },
    async matchDealRegistrations(probe) {
      const rows = await allRows();
      await expireStale(rows);
      const fresh = await allRows();
      const names = await dealerNames(store);
      const customerId = probe && probe.customerId ? String(probe.customerId) : '';
      return fresh.filter(function (row) {
        if (liveStatus(row) !== 'protected') return false;
        if (customerId && String(row.customer_id) === customerId) return false;
        return quoteBlobMatches(row, probe || {});
      }).map(function (row) {
        return {
          id: String(row.id),
          number: row.number,
          dealerName: names[String(row.customer_id)] || 'A dealer',
          endCustomer: row.end_customer || '',
          jobName: row.job_name || '',
          protectUntil: row.protect_until || '',
          siteCity: row.site_city || '',
          siteState: row.site_state || ''
        };
      });
    }
  };
}

module.exports = {
  ensureDealRegistrations,
  sqliteApi,
  supabaseApi,
  sameNamedJob,
  quoteBlobMatches,
  liveStatus,
  nextNumberFrom,
  addDays
};
