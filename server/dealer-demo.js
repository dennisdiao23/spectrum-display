/**
 * One demo dealer on the live portal. Reset puts that company back to the
 * starting rows. Other dealers cannot call it.
 */

const bcrypt = require('bcryptjs');

const DEMO_PASSWORD = 'demo_only';
const DEMO_USERS = [
  { email: 'demo@spectrumdisplay.com', name: 'Dana Demo' },
  { email: 'demo.sales@spectrumdisplay.com', name: 'Sam Sales' },
  { email: 'demo.pm@spectrumdisplay.com', name: 'Pat Project' }
];

function isDemoEmail(email) {
  const want = String(email || '').trim().toLowerCase();
  return DEMO_USERS.some(function (row) { return row.email === want; });
}

function companyFields() {
  return {
    companyName: 'Demo Dealer',
    displayName: 'Demo Dealer',
    contactFirst: 'Dana',
    contactLast: 'Demo',
    email: 'demo@spectrumdisplay.com',
    phone: '(512) 555-0148',
    website: 'https://www.spectrumdisplay.com',
    taxId: 'DEMO-000',
    customerType: 'Dealer',
    billStreet: '100 Demo Ave',
    billCity: 'Austin',
    billState: 'TX',
    billZip: '78701',
    billCountry: 'United States',
    shipSame: true,
    paymentTerms: 'Net 30'
  };
}

function throwIf(error, message) {
  if (!error) return;
  throw new Error(message || error.message || 'Could not reset the demo.');
}

function sqliteApi(db) {
  return {
    async wipeDealerPortalData(customerId) {
      const id = Number(customerId);
      const walls = db.prepare('SELECT id FROM installed_walls WHERE customer_id = ?').all(id);
      walls.forEach(function (wall) {
        db.prepare('DELETE FROM installed_wall_serials WHERE wall_id = ?').run(wall.id);
        db.prepare('DELETE FROM installed_wall_spares WHERE wall_id = ?').run(wall.id);
      });
      db.prepare('DELETE FROM installed_walls WHERE customer_id = ?').run(id);
      const docs = db.prepare("SELECT id FROM company_sales_docs WHERE customer_id = ? AND type IN ('quote', 'order')").all(id);
      docs.forEach(function (doc) {
        db.prepare('DELETE FROM company_sales_lines WHERE doc_id = ?').run(doc.id);
      });
      db.prepare("DELETE FROM company_sales_docs WHERE customer_id = ? AND type IN ('quote', 'order')").run(id);
      db.prepare('DELETE FROM deal_registrations WHERE customer_id = ?').run(id);
      db.prepare('DELETE FROM dealer_leads WHERE customer_id = ?').run(id);
      db.prepare('DELETE FROM dealer_rmas WHERE customer_id = ?').run(id);
      db.prepare('DELETE FROM dealer_projects WHERE customer_id = ?').run(id);
      db.prepare('DELETE FROM dealer_custom_panels WHERE customer_id = ?').run(id);
      try { db.prepare('DELETE FROM dealer_requests WHERE customer_id = ?').run(id); } catch (err) {}
      try { db.prepare('DELETE FROM dealer_files WHERE customer_id = ?').run(id); } catch (err) {}
      const keep = DEMO_USERS.map(function (row) { return row.email; });
      db.prepare('SELECT id, email FROM dealer_users WHERE customer_id = ?').all(id).forEach(function (user) {
        if (keep.indexOf(String(user.email || '').toLowerCase()) !== -1) return;
        db.prepare('DELETE FROM dealer_sessions WHERE dealer_user_id = ?').run(user.id);
        db.prepare('DELETE FROM dealer_users WHERE id = ?').run(user.id);
      });
    },
    async touchDealerLogin(id, name, passwordHash) {
      db.prepare('UPDATE dealer_users SET name = ?, password_hash = ?, active = 1, updated_at = ? WHERE id = ?')
        .run(name, passwordHash, new Date().toISOString(), id);
    },
    async saveDealerDemoProject(customerId, userId, title, payload) {
      const stamp = new Date().toISOString();
      db.prepare(
        'INSERT INTO dealer_projects (customer_id, dealer_user_id, title, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(Number(customerId), userId || null, title, JSON.stringify(payload || {}), stamp, stamp);
    },
    async saveDealerDemoPanel(customerId, userId, name, payload) {
      const stamp = new Date().toISOString();
      db.prepare(
        'INSERT INTO dealer_custom_panels (customer_id, dealer_user_id, name, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(Number(customerId), userId || null, name, JSON.stringify(payload || {}), stamp, stamp);
    }
  };
}

function supabaseApi(supabase) {
  return {
    async wipeDealerPortalData(customerId) {
      const id = Number(customerId);
      const walls = await supabase.from('installed_walls').select('id').eq('customer_id', id);
      throwIf(walls.error, 'Could not load installed walls.');
      const wallIds = (walls.data || []).map(function (row) { return row.id; });
      if (wallIds.length) {
        throwIf((await supabase.from('installed_wall_serials').delete().in('wall_id', wallIds)).error, 'Could not clear wall serials.');
        throwIf((await supabase.from('installed_wall_spares').delete().in('wall_id', wallIds)).error, 'Could not clear spare kits.');
      }
      throwIf((await supabase.from('installed_walls').delete().eq('customer_id', id)).error, 'Could not clear installed walls.');
      const docs = await supabase.from('company_sales_docs').select('id').eq('customer_id', id).in('type', ['quote', 'order']);
      throwIf(docs.error, 'Could not load quotes and orders.');
      const docIds = (docs.data || []).map(function (row) { return row.id; });
      if (docIds.length) {
        throwIf((await supabase.from('company_sales_lines').delete().in('doc_id', docIds)).error, 'Could not clear document lines.');
        throwIf((await supabase.from('company_sales_docs').delete().in('id', docIds)).error, 'Could not clear quotes and orders.');
      }
      throwIf((await supabase.from('deal_registrations').delete().eq('customer_id', id)).error, 'Could not clear registrations.');
      throwIf((await supabase.from('dealer_leads').delete().eq('customer_id', id)).error, 'Could not clear leads.');
      throwIf((await supabase.from('dealer_rmas').delete().eq('customer_id', id)).error, 'Could not clear RMAs.');
      throwIf((await supabase.from('dealer_projects').delete().eq('customer_id', id)).error, 'Could not clear projects.');
      throwIf((await supabase.from('dealer_custom_panels').delete().eq('customer_id', id)).error, 'Could not clear saved panels.');
      const requests = await supabase.from('dealer_requests').delete().eq('customer_id', id);
      if (requests.error && !/does not exist|schema cache/i.test(requests.error.message || '')) throwIf(requests.error, 'Could not clear requests.');
      const files = await supabase.from('dealer_files').delete().eq('customer_id', id);
      if (files.error && !/does not exist|schema cache/i.test(files.error.message || '')) throwIf(files.error, 'Could not clear files.');
      const keep = DEMO_USERS.map(function (row) { return row.email; });
      const users = await supabase.from('dealer_users').select('id, email').eq('customer_id', id);
      throwIf(users.error, 'Could not load portal logins.');
      for (const user of users.data || []) {
        if (keep.indexOf(String(user.email || '').toLowerCase()) !== -1) continue;
        await supabase.from('dealer_sessions').delete().eq('dealer_user_id', user.id);
        throwIf((await supabase.from('dealer_users').delete().eq('id', user.id)).error, 'Could not remove an extra login.');
      }
    },
    async touchDealerLogin(id, name, passwordHash) {
      throwIf((await supabase.from('dealer_users').update({
        name: name,
        password_hash: passwordHash,
        active: true,
        updated_at: new Date().toISOString()
      }).eq('id', id)).error, 'Could not update the demo login.');
    },
    async saveDealerDemoProject(customerId, userId, title, payload) {
      const stamp = new Date().toISOString();
      throwIf((await supabase.from('dealer_projects').insert({
        customer_id: Number(customerId),
        dealer_user_id: userId || null,
        title: title,
        payload: JSON.stringify(payload || {}),
        created_at: stamp,
        updated_at: stamp
      })).error, 'Could not save a demo project.');
    },
    async saveDealerDemoPanel(customerId, userId, name, payload) {
      const stamp = new Date().toISOString();
      throwIf((await supabase.from('dealer_custom_panels').insert({
        customer_id: Number(customerId),
        dealer_user_id: userId || null,
        name: name,
        payload: JSON.stringify(payload || {}),
        created_at: stamp,
        updated_at: stamp
      })).error, 'Could not save a demo panel.');
    }
  };
}

async function ensureCustomer(store) {
  const fields = companyFields();
  const rows = store.listCompanyCustomers ? await store.listCompanyCustomers() : [];
  const hit = (rows || []).find(function (row) {
    return String(row.email || '').toLowerCase() === fields.email;
  });
  if (!hit) return store.createCompanyCustomer(fields);
  return store.updateCompanyCustomer(hit.id, Object.assign({}, hit, fields));
}

async function ensureUsers(store, customerId) {
  const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const users = [];
  for (const person of DEMO_USERS) {
    const existing = await store.getDealerUserByEmail(person.email);
    const owner = existing && (existing.customer_id != null ? existing.customer_id : existing.customerId);
    if (existing && String(owner) !== String(customerId)) {
      throw new Error(person.email + ' already belongs to another company.');
    }
    if (existing) {
      await store.touchDealerLogin(existing.id, person.name, hash);
      users.push({ id: existing.id, email: person.email, name: person.name, customerId: customerId });
    } else {
      const created = await store.createDealerUser({
        email: person.email,
        name: person.name,
        passwordHash: hash,
        customerId: customerId,
        applicationId: null
      });
      users.push({ id: created.id, email: person.email, name: person.name, customerId: customerId });
    }
  }
  return users;
}

async function resetDealerDemo(store) {
  const customer = await ensureCustomer(store);
  await store.wipeDealerPortalData(customer.id);
  const users = await ensureUsers(store, customer.id);
  const actor = users[0];
  const book = await store.getDealerPriceBook();
  const sku = (book && book[0] && book[0].sku) || '';

  const registrations = [
    { endCustomer: 'City Hall', jobName: 'City hall', siteStreet: '10 Main St', siteCity: 'Austin', siteState: 'TX', selling: 'Indoor wall', status: 'submitted' },
    { endCustomer: 'City Museum', jobName: 'Museum', siteStreet: '20 Oak Ave', siteCity: 'Austin', siteState: 'TX', selling: 'Indoor wall', status: 'protected' },
    { endCustomer: 'Grand Hotel', jobName: 'Hotel lobby', siteStreet: '30 Pine Rd', siteCity: 'Austin', siteState: 'TX', selling: 'Indoor wall', status: 'declined' }
  ];
  for (const row of registrations) {
    const saved = await store.createDealRegistration(actor, row);
    if (row.status === 'protected') await store.acceptDealRegistration(saved.id, { name: 'Demo' }, { protectUntil: '2027-10-02' });
    if (row.status === 'declined') await store.declineDealRegistration(saved.id, { name: 'Demo' }, { reason: 'Another dealer already registered this job.' });
  }

  const leads = [
    { project: 'Stadium', contactName: 'Jamie', contactEmail: 'jamie@stadium.test', city: 'Austin', state: 'TX', interest: 'Outdoor wall', stage: 'new' },
    { project: 'Arena', contactName: 'Pat', contactEmail: 'pat@arena.test', city: 'Dallas', state: 'TX', interest: 'Indoor wall', stage: 'qualified' },
    { project: 'Theater', contactName: 'Sam', contactEmail: 'sam@theater.test', city: 'Houston', state: 'TX', interest: 'Lobby wall', stage: 'quoted' }
  ];
  for (const row of leads) {
    const saved = await store.createDealerLead(Object.assign({ customerId: customer.id }, row));
    if (row.stage !== 'new') await store.setPortalLeadStage(actor, saved.id, { stage: row.stage });
  }

  const line = sku ? [{ sku: sku, qty: 2 }] : [];
  const quotes = [
    { poNumber: 'PO-DEMO-1', notes: 'City hall quote', shipDate: '' },
    { poNumber: 'PO-DEMO-2', notes: 'Museum quote', shipDate: '' },
    { poNumber: 'PO-DEMO-3', notes: 'Hotel lobby quote', shipDate: '' }
  ];
  for (const row of quotes) {
    await store.createDealerDoc(actor, 'quote', { poNumber: row.poNumber, notes: row.notes, lines: line });
  }
  const orders = [
    { poNumber: 'PO-DEMO-4', notes: 'City hall order', shipDate: '2026-06-01', wallName: 'City hall wall', serial: 'CAB-1001', street: '10 Main St', city: 'Austin' },
    { poNumber: 'PO-DEMO-5', notes: 'Museum order', shipDate: '2026-07-01', wallName: 'Museum wall', serial: 'CAB-1002', street: '20 Oak Ave', city: 'Austin' },
    { poNumber: 'PO-DEMO-6', notes: 'Hotel lobby order', shipDate: '2026-08-01', wallName: 'Hotel wall', serial: 'CAB-1003', street: '30 Pine Rd', city: 'Austin' }
  ];
  for (const row of orders) {
    const doc = await store.createDealerDoc(actor, 'order', { poNumber: row.poNumber, notes: row.notes, shipDate: row.shipDate, lines: line });
    const wall = await store.createInstalledWallFromOrder(doc.id);
    await store.updateInstalledWall(wall.id, {
      wallName: row.wallName,
      endCustomer: 'Demo Dealer',
      installer: 'Dana Demo',
      pitch: '1.56',
      shipDate: row.shipDate,
      siteStreet: row.street,
      siteCity: row.city,
      siteState: 'TX',
      siteZip: '78701',
      siteCountry: 'United States',
      serials: [{ kind: 'cabinet', serial: row.serial }],
      spares: sku ? [{ sku: sku, qty: 2 }] : []
    });
  }

  const rmas = [
    { orderRef: 'PO-DEMO-4', reason: 'defective', notes: 'One cabinet will not light.' },
    { orderRef: 'PO-DEMO-5', reason: 'damaged', notes: 'Corner was crushed in transit.' },
    { orderRef: 'PO-DEMO-6', reason: 'wrong', notes: 'Pitch does not match the order.' }
  ];
  for (const row of rmas) {
    await store.createPortalRma(actor, {
      orderRef: row.orderRef,
      reason: row.reason,
      notes: row.notes,
      lines: [{ sku: sku || 'DEMO-PANEL', qty: 1 }]
    });
  }

  const projects = [
    { title: 'Lobby wall', width: '12', height: '7', pitch: '1.25', cabinets: '48' },
    { title: 'Museum wall', width: '16', height: '9', pitch: '1.56', cabinets: '64' },
    { title: 'Hotel wall', width: '10', height: '6', pitch: '1.88', cabinets: '36' }
  ];
  for (const row of projects) {
    await store.saveDealerDemoProject(customer.id, actor.id, row.title, {
      brandName: 'Spectrum',
      seriesName: 'XP Series',
      brand: 'spectrum',
      series: 'xp',
      pitch: row.pitch,
      width: row.width,
      height: row.height,
      cabinets: row.cabinets,
      unit: 'ft'
    });
  }
  const panels = [
    { name: 'Lobby cabinet', w: '500', h: '500', pitch: '1.25', weight: '7.2' },
    { name: 'Museum cabinet', w: '500', h: '1000', pitch: '1.56', weight: '11.4' },
    { name: 'Hotel cabinet', w: '600', h: '337.5', pitch: '1.88', weight: '6.8' }
  ];
  for (const row of panels) {
    await store.saveDealerDemoPanel(customer.id, actor.id, row.name, {
      name: row.name,
      w: row.w,
      h: row.h,
      pitch: row.pitch,
      type: 'indoor',
      weight: row.weight,
      pavg: '120',
      pmax: '280'
    });
  }
  return { customerId: customer.id, email: actor.email };
}

module.exports = { isDemoEmail, resetDealerDemo, sqliteApi, supabaseApi };
