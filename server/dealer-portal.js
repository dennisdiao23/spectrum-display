const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DEALER_UPLOAD_DIR = path.join(ROOT, 'uploads', 'dealer');

const STATUSES = ['pending', 'approved', 'rejected'];

function nowIso() {
  return new Date().toISOString();
}

function trim(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max || 240);
}

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_err) {
    return fallback;
  }
}

function asList(value) {
  if (Array.isArray(value)) {
    return value.map(function (item) { return String(item).trim(); }).filter(Boolean).slice(0, 20);
  }
  if (value == null || value === '') return [];
  const parsed = parseJson(value, null);
  if (Array.isArray(parsed)) {
    return parsed.map(function (item) { return String(item).trim(); }).filter(Boolean).slice(0, 20);
  }
  return String(value).split(/[,|]/).map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 20);
}

function asAddress(value) {
  const src = parseJson(value, value && typeof value === 'object' ? value : {}) || {};
  return {
    line1: trim(src.line1 || src.street, 200),
    line2: trim(src.line2 || src.street2, 200),
    city: trim(src.city, 80),
    state: trim(src.state, 80),
    postal_code: trim(src.postal_code || src.postalCode || src.zip, 20),
    country: trim(src.country, 80) || 'US'
  };
}

function truthy(value) {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 't' || value === 'on' || value === 'yes';
}

function splitName(name) {
  const bits = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!bits.length) return { first: '', last: '' };
  if (bits.length === 1) return { first: bits[0], last: '' };
  return { first: bits[0], last: bits.slice(1).join(' ') };
}

function statusOf(value) {
  const v = String(value || 'pending').toLowerCase().trim();
  return STATUSES.indexOf(v) === -1 ? 'pending' : v;
}

function alreadyDealerError() {
  const err = new Error('This email is already an authorized dealer.');
  err.code = 'already_dealer';
  return err;
}

function missingTableError(error) {
  const msg = String((error && error.message) || error || '');
  const code = String((error && error.code) || '');
  if (code === '42P01' || /dealer_applications/i.test(msg) && /does not exist|schema cache|could not find/i.test(msg)) {
    return new Error('Dealer applications are not set up yet. Run the dealer portal migration.');
  }
  return null;
}

function throwIfMissing(error, fallback) {
  const missing = missingTableError(error);
  if (missing) throw missing;
  if (error) throw new Error(error.message || fallback || 'Dealer portal error');
}

function formatApplication(row, opts) {
  if (!row) return null;
  const admin = !!(opts && opts.admin);
  const self = !!(opts && opts.self);
  const reveal = admin || self;
  const addr = asAddress(row.company_address);
  const out = {
    id: row.id,
    contactName: row.contact_name || '',
    email: row.email || '',
    phone: row.phone || '',
    companyName: row.company_name || '',
    website: row.website || '',
    taxId: reveal ? (row.tax_id || '') : '',
    yearsInBusiness: row.years_in_business || '',
    companySize: row.company_size || '',
    businessType: asList(row.business_type),
    primaryVerticals: asList(row.primary_verticals),
    typicalJobSizeM2: row.typical_job_size_m2 || '',
    companyAddress: reveal ? addr : { city: addr.city, state: addr.state, country: addr.country },
    referencesText: reveal ? (row.references_text || '') : '',
    certifyAuthorized: truthy(row.certify_authorized),
    agreeTermsPrivacy: truthy(row.agree_terms_privacy),
    marketingOptIn: truthy(row.marketing_opt_in),
    resaleCertificateName: row.resale_certificate_name || '',
    resaleCertificateUrl: reveal ? (row.resale_certificate_url || '') : '',
    userId: admin ? (row.user_id || '') : '',
    crmLeadId: admin ? (row.crm_lead_id || null) : undefined,
    status: statusOf(row.status),
    dealerTier: row.dealer_tier || 'authorized',
    paymentTerms: row.payment_terms || 'prepaid_30_70',
    holdHours: Number(row.hold_hours) || 48,
    customerId: reveal ? (row.customer_id || null) : undefined,
    reviewedAt: row.reviewed_at || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
  if (admin) {
    out.notesInternal = row.notes_internal || '';
    out.reviewedBy = row.reviewed_by || '';
  }
  return out;
}

function portalMePayload(user, application) {
  const canSee = !!(user && (user.role === 'dealer' || user.role === 'sales'));
  const pending = !!(application && application.status === 'pending' && !canSee);
  const preferred = !!(application && application.dealerTier === 'preferred');
  const holdHours = (application && application.holdHours) || 48;
  let roleLabel = 'Customer';
  if (canSee) roleLabel = user.role === 'sales' ? 'Sales' : 'Dealer';
  else if (pending) roleLabel = 'Application pending';
  return {
    role: (user && user.role) || 'customer',
    roleLabel: roleLabel,
    application: application,
    canSeeNets: canSee,
    canSeeStock: canSee,
    pending: pending,
    overview: {
      companyName: (application && application.companyName) || (user && user.company) || '',
      contactName: (application && application.contactName) || (user && user.name) || '',
      email: (application && application.email) || (user && user.email) || '',
      tierLabel: canSee ? (preferred ? 'Preferred' : 'Authorized') : '',
      paymentLabel: '30% deposit / balance before ship',
      holdHours: holdHours,
      holdLabel: holdHours + '-hour hold (policy)'
    }
  };
}

function publicDealerQuote(doc) {
  if (!doc) return null;
  return {
    id: doc.id,
    number: doc.number || '',
    status: doc.status || 'draft',
    issueDate: doc.issueDate || '',
    total: Number(doc.total) || 0,
    notes: doc.notes || '',
    lines: (doc.lines || []).map(function (line) {
      return {
        sku: line.sku || '',
        item: line.item || '',
        qty: line.qty,
        unitPrice: line.unitPrice,
        amount: line.amount
      };
    })
  };
}

function noCustomerError() {
  const err = new Error('Spectrum has not linked a company customer yet.');
  err.code = 'no_customer';
  return err;
}

async function resolveDealerCustomerId(store, user) {
  const app = await store.getDealerApplicationForUser({
    userId: user && user.id,
    email: user && user.email
  });
  if (app && app.customerId) return app.customerId;
  const email = trim((user && user.email) || '', 160).toLowerCase();
  if (!email || !store.listCompanyCustomers) return null;
  try {
    const customers = await store.listCompanyCustomers();
    const hit = (customers || []).find(function (row) {
      return String(row.email || '').toLowerCase() === email;
    });
    return hit && hit.id ? hit.id : null;
  } catch (_err) {
    return null;
  }
}

async function listDealerQuotesFor(store, user) {
  const customerId = await resolveDealerCustomerId(store, user);
  if (!customerId) return [];
  const docs = await store.listSalesDocs('quote');
  return (docs || []).filter(function (doc) {
    return String(doc.customerId) === String(customerId);
  }).map(publicDealerQuote);
}

async function createDealerQuoteFor(store, user, payload) {
  const customerId = await resolveDealerCustomerId(store, user);
  if (!customerId) throw noCustomerError();
  const body = payload || {};
  const notes = trim(body.notes, 2000);
  const rawLines = Array.isArray(body.lines) ? body.lines : [];
  const book = {};
  (await store.getDealerPriceBook()).forEach(function (item) {
    if (item && item.sku) book[item.sku] = item;
  });
  const lines = [];
  rawLines.forEach(function (line) {
    const sku = trim(line && line.sku, 80);
    if (!sku) return;
    const item = book[sku];
    if (!item) throw new Error('Unknown SKU ' + sku + '.');
    const qty = Number(line && line.qty);
    const n = Number.isFinite(qty) && qty > 0 ? qty : 1;
    lines.push({
      sku: sku,
      item: item.name || sku,
      description: [item.brand, item.pitchLabel || item.pitch].filter(Boolean).join(' · '),
      qty: n,
      unitPrice: Number(item.dealerNet) || 0
    });
  });
  if (!notes && !lines.length) throw new Error('Add a note or at least one SKU.');
  const app = await store.getDealerApplicationForUser({
    userId: user && user.id,
    email: user && user.email
  });
  const extra = 'Requested from Dealer Portal' + (app && app.companyName ? ' (' + app.companyName + ')' : '');
  const created = await store.createSalesDoc({
    type: 'quote',
    customerId: customerId,
    customerEmail: (user && user.email) || '',
    notes: extra + (notes ? '\n' + notes : ''),
    paymentTerms: '30% deposit / balance before ship',
    status: 'draft',
    lines: lines,
    rep: 'Dealer Portal'
  });
  return publicDealerQuote(created);
}

function publicPriceBookItem(item) {
  if (!item) return null;
  const inactive = item.inactive === true || item.inactive === 1 || item.inactive === '1';
  if (inactive) return null;
  const qty = item.websiteQty != null ? Number(item.websiteQty) : Number(item.qty) || 0;
  const locLabels = [];
  (item.locations || []).forEach(function (loc) {
    const name = loc.warehouseName || loc.locationName || loc.warehouse || '';
    const city = loc.city || loc.warehouseCity || '';
    const label = [name, city].filter(Boolean).join(' · ');
    if (label && locLabels.indexOf(label) === -1) locLabels.push(label);
  });
  const warehouse = item.warehouse || item.location || locLabels[0] || '';
  return {
    sku: item.sku || '',
    name: item.name || '',
    brand: item.brandName || item.brandId || '',
    pitch: item.pitch || '',
    pitchLabel: item.pitchLabel || '',
    unit: item.unit || '',
    dealerNet: Number(item.dealerNet) || 0,
    listPrice: Number(item.price) || 0,
    qty: Math.max(0, Number(qty) || 0),
    status: item.status || '',
    warehouse: warehouse,
    locations: locLabels,
    image: item.image || ''
  };
}

function normalizeApplicationInput(input) {
  const src = input || {};
  const email = trim(src.email, 160).toLowerCase();
  const contactName = trim(src.contactName || src.contact_name, 120);
  const companyName = trim(src.companyName || src.company_name, 160);
  const phone = trim(src.phone, 60);
  const taxId = trim(src.taxId || src.tax_id, 80);
  const addr = asAddress(src.companyAddress || src.company_address);
  if (!contactName) throw new Error('Contact name is required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid email is required.');
  if (!companyName) throw new Error('Company name is required.');
  if (!phone) throw new Error('Phone is required.');
  if (!taxId) throw new Error('Tax ID is required.');
  if (!addr.line1 || !addr.city || !addr.state || !addr.postal_code) {
    throw new Error('Full company address is required.');
  }
  return {
    contactName: contactName,
    email: email,
    phone: phone,
    companyName: companyName,
    website: trim(src.website, 200),
    taxId: taxId,
    yearsInBusiness: trim(src.yearsInBusiness || src.years_in_business, 40),
    companySize: trim(src.companySize || src.company_size, 40),
    businessType: asList(src.businessType || src.business_type),
    primaryVerticals: asList(src.primaryVerticals || src.primary_verticals),
    typicalJobSizeM2: trim(src.typicalJobSizeM2 || src.typical_job_size_m2, 40),
    companyAddress: addr,
    referencesText: trim(src.referencesText || src.references_text, 4000),
    certifyAuthorized: truthy(src.certifyAuthorized != null ? src.certifyAuthorized : src.certify_authorized),
    agreeTermsPrivacy: truthy(src.agreeTermsPrivacy != null ? src.agreeTermsPrivacy : src.agree_terms_privacy),
    marketingOptIn: truthy(src.marketingOptIn != null ? src.marketingOptIn : src.marketing_opt_in),
    resaleCertificateName: trim(src.resaleCertificateName || src.resale_certificate_name, 200),
    resaleCertificateUrl: trim(src.resaleCertificateUrl || src.resale_certificate_url, 400),
    userId: trim(src.userId || src.user_id, 80),
    crmLeadId: src.crmLeadId != null ? src.crmLeadId : src.crm_lead_id
  };
}

function sqliteFields(input) {
  return {
    contact_name: input.contactName,
    email: input.email,
    phone: input.phone,
    company_name: input.companyName,
    website: input.website,
    tax_id: input.taxId,
    years_in_business: input.yearsInBusiness,
    company_size: input.companySize,
    business_type: JSON.stringify(input.businessType),
    primary_verticals: JSON.stringify(input.primaryVerticals),
    typical_job_size_m2: input.typicalJobSizeM2,
    company_address: JSON.stringify(input.companyAddress),
    references_text: input.referencesText,
    certify_authorized: input.certifyAuthorized ? 1 : 0,
    agree_terms_privacy: input.agreeTermsPrivacy ? 1 : 0,
    marketing_opt_in: input.marketingOptIn ? 1 : 0,
    resale_certificate_name: input.resaleCertificateName,
    resale_certificate_url: input.resaleCertificateUrl,
    user_id: input.userId || '',
    crm_lead_id: input.crmLeadId ? Number(input.crmLeadId) : null
  };
}

function supabaseFields(input) {
  const crmLeadId = Number(input.crmLeadId);
  return {
    contact_name: input.contactName,
    email: input.email,
    phone: input.phone,
    company_name: input.companyName,
    website: input.website,
    tax_id: input.taxId,
    years_in_business: input.yearsInBusiness,
    company_size: input.companySize,
    business_type: input.businessType,
    primary_verticals: input.primaryVerticals,
    typical_job_size_m2: input.typicalJobSizeM2,
    company_address: input.companyAddress,
    references_text: input.referencesText,
    certify_authorized: !!input.certifyAuthorized,
    agree_terms_privacy: !!input.agreeTermsPrivacy,
    marketing_opt_in: !!input.marketingOptIn,
    resale_certificate_name: input.resaleCertificateName,
    resale_certificate_url: input.resaleCertificateUrl,
    user_id: input.userId || '',
    crm_lead_id: Number.isFinite(crmLeadId) && crmLeadId > 0 ? crmLeadId : null
  };
}

function saveResaleFile(file) {
  if (!file || !file.buffer) return { name: '', url: '' };
  fs.mkdirSync(DEALER_UPLOAD_DIR, { recursive: true });
  const ext = path.extname(file.originalname || '').toLowerCase();
  const safeExt = ['.pdf', '.jpg', '.jpeg', '.png'].indexOf(ext) !== -1 ? ext : '.pdf';
  const name = Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex') + safeExt;
  fs.writeFileSync(path.join(DEALER_UPLOAD_DIR, name), file.buffer);
  return {
    name: trim(file.originalname, 200) || ('resale-certificate' + safeExt),
    url: '/uploads/dealer/' + name
  };
}

async function findWebsiteAccount(store, email) {
  try {
    const accounts = await store.listAccounts();
    return (accounts || []).find(function (row) {
      return String(row.email || '').toLowerCase() === email;
    }) || null;
  } catch (_err) {
    return null;
  }
}

async function assertNotAlreadyDealer(store, email) {
  const account = await findWebsiteAccount(store, email);
  if (account && (account.role === 'dealer' || account.role === 'sales')) {
    throw alreadyDealerError();
  }
}

async function maybePatchProfile(store, input) {
  if (!input.userId) return;
  try {
    await store.updateAccount(input.userId, {
      company: input.companyName,
      phone: input.phone,
      name: input.contactName
    });
  } catch (_err) { /* SQLite has no website accounts */ }
}

async function linkApprovedDealer(store, app) {
  const email = String(app.email || '').toLowerCase();
  const bits = splitName(app.contactName);
  let customerId = app.customerId || null;

  const account = await findWebsiteAccount(store, email);
  if (account && account.id) {
    try {
      if (account.role !== 'dealer' && account.role !== 'sales') {
        await store.updateAccount(account.id, {
          role: 'dealer',
          company: app.companyName || account.company || '',
          phone: app.phone || account.phone || '',
          name: app.contactName || account.name || ''
        });
      } else if (app.companyName || app.phone) {
        await store.updateAccount(account.id, {
          company: app.companyName || account.company || '',
          phone: app.phone || account.phone || '',
          name: app.contactName || account.name || ''
        });
      }
    } catch (err) {
      console.error('Dealer approve: website account', err.message || err);
    }
  }

  try {
    const leads = await store.listCrmLeads();
    const lead = (leads || []).find(function (row) {
      const key = String(row.sourceKey || '').toLowerCase();
      const leadEmail = String(row.email || '').toLowerCase();
      return key === 'dealer:' + email || (leadEmail === email && row.source === 'dealer');
    });
    if (lead && lead.id) {
      if (lead.convertedCustomerId) {
        customerId = customerId || lead.convertedCustomerId;
      } else if (lead.status !== 'converted') {
        const result = await store.convertCrmLead(lead.id);
        if (result && result.customer && result.customer.id) {
          customerId = result.customer.id;
          try {
            await store.updateCompanyCustomer(customerId, Object.assign({}, result.customer, {
              customerType: 'Dealer',
              taxId: app.taxId || result.customer.taxId || ''
            }));
          } catch (err) {
            console.error('Dealer approve: customer type', err.message || err);
          }
        }
      }
    }
  } catch (err) {
    console.error('Dealer approve: CRM lead', err.message || err);
  }

  if (!customerId) {
    const addr = app.companyAddress || {};
    try {
      const customer = await store.createCompanyCustomer({
        companyName: app.companyName || '',
        displayName: app.companyName || app.contactName || '',
        contactFirst: bits.first,
        contactLast: bits.last,
        email: email,
        phone: app.phone || '',
        website: app.website || '',
        taxId: app.taxId || '',
        billStreet: addr.line1 || '',
        billStreet2: addr.line2 || '',
        billCity: addr.city || '',
        billState: addr.state || '',
        billZip: addr.postal_code || '',
        billCountry: addr.country === 'US' ? 'United States' : (addr.country || 'United States'),
        shipSame: true,
        source: 'dealer',
        customerType: 'Dealer',
        notes: app.referencesText || ''
      });
      if (customer && customer.id) customerId = customer.id;
    } catch (err) {
      console.error('Dealer approve: create customer', err.message || err);
    }
  }

  return { customerId: customerId };
}

async function revertDealerAccount(store, app) {
  const email = String(app.email || '').toLowerCase();
  const account = await findWebsiteAccount(store, email);
  if (account && account.role === 'dealer') {
    try {
      await store.updateAccount(account.id, { role: 'customer' });
    } catch (err) {
      console.error('Dealer reject: website account', err.message || err);
    }
  }
}

function ensureDealerPortal(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dealer_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      company_name TEXT NOT NULL DEFAULT '',
      website TEXT NOT NULL DEFAULT '',
      tax_id TEXT NOT NULL DEFAULT '',
      years_in_business TEXT NOT NULL DEFAULT '',
      company_size TEXT NOT NULL DEFAULT '',
      business_type TEXT NOT NULL DEFAULT '[]',
      primary_verticals TEXT NOT NULL DEFAULT '[]',
      typical_job_size_m2 TEXT NOT NULL DEFAULT '',
      company_address TEXT NOT NULL DEFAULT '{}',
      references_text TEXT NOT NULL DEFAULT '',
      certify_authorized INTEGER NOT NULL DEFAULT 0,
      agree_terms_privacy INTEGER NOT NULL DEFAULT 0,
      marketing_opt_in INTEGER NOT NULL DEFAULT 0,
      resale_certificate_name TEXT NOT NULL DEFAULT '',
      resale_certificate_url TEXT NOT NULL DEFAULT '',
      user_id TEXT NOT NULL DEFAULT '',
      crm_lead_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      dealer_tier TEXT NOT NULL DEFAULT 'authorized',
      payment_terms TEXT NOT NULL DEFAULT 'prepaid_30_70',
      hold_hours INTEGER NOT NULL DEFAULT 48,
      customer_id INTEGER,
      notes_internal TEXT NOT NULL DEFAULT '',
      reviewed_at TEXT NOT NULL DEFAULT '',
      reviewed_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS dealer_applications_email_idx ON dealer_applications (email, status);
    CREATE INDEX IF NOT EXISTS dealer_applications_status_idx ON dealer_applications (status, created_at);
  `);
}

function sqliteApi(db, store) {
  function getRow(id) {
    return db.prepare('SELECT * FROM dealer_applications WHERE id = ?').get(id);
  }

  return {
    async createDealerApplication(payload) {
      const input = normalizeApplicationInput(payload);
      await assertNotAlreadyDealer(store, input.email);
      const approved = db.prepare(
        "SELECT * FROM dealer_applications WHERE lower(email) = ? AND status = 'approved' ORDER BY id DESC LIMIT 1"
      ).get(input.email);
      if (approved) throw alreadyDealerError();
      const pending = db.prepare(
        "SELECT * FROM dealer_applications WHERE lower(email) = ? AND status = 'pending' ORDER BY id DESC LIMIT 1"
      ).get(input.email);
      if (pending) {
        return { application: formatApplication(pending, { admin: true }), duplicate: true };
      }
      await maybePatchProfile(store, input);
      const fields = sqliteFields(input);
      const stamp = nowIso();
      const keys = Object.keys(fields);
      const info = db.prepare(
        'INSERT INTO dealer_applications (' + keys.join(', ') +
        ', status, dealer_tier, payment_terms, hold_hours, notes_internal, reviewed_at, reviewed_by, created_at, updated_at) VALUES (' +
        keys.map(function () { return '?'; }).join(', ') +
        ", 'pending', 'authorized', 'prepaid_30_70', 48, '', '', '', ?, ?)"
      ).run(...keys.map(function (k) { return fields[k]; }).concat([stamp, stamp]));
      return { application: formatApplication(getRow(info.lastInsertRowid), { admin: true }), duplicate: false };
    },
    async listDealerApplications(opts) {
      const want = opts && opts.status ? String(opts.status).toLowerCase() : '';
      const rows = STATUSES.indexOf(want) !== -1
        ? db.prepare('SELECT * FROM dealer_applications WHERE status = ? ORDER BY datetime(created_at) DESC, id DESC').all(want)
        : db.prepare('SELECT * FROM dealer_applications ORDER BY datetime(created_at) DESC, id DESC').all();
      return rows.map(function (row) { return formatApplication(row, { admin: true }); });
    },
    async getDealerApplication(id) {
      return formatApplication(getRow(id), { admin: true });
    },
    async attachDealerApplicationCrmLead(id, leadId) {
      const n = Number(leadId);
      if (!id || !Number.isFinite(n) || n <= 0) return this.getDealerApplication(id);
      db.prepare('UPDATE dealer_applications SET crm_lead_id = ?, updated_at = ? WHERE id = ?').run(n, nowIso(), id);
      return formatApplication(getRow(id), { admin: true });
    },
    async getDealerApplicationForUser(opts) {
      const userId = trim((opts && opts.userId) || '', 80);
      const email = trim((opts && opts.email) || '', 160).toLowerCase();
      if (!userId && !email) return null;
      let row = null;
      if (userId && email) {
        row = db.prepare(
          "SELECT * FROM dealer_applications WHERE (user_id != '' AND user_id = ?) OR lower(email) = ? ORDER BY datetime(created_at) DESC, id DESC LIMIT 1"
        ).get(userId, email);
      } else if (userId) {
        row = db.prepare(
          "SELECT * FROM dealer_applications WHERE user_id != '' AND user_id = ? ORDER BY datetime(created_at) DESC, id DESC LIMIT 1"
        ).get(userId);
      } else {
        row = db.prepare(
          'SELECT * FROM dealer_applications WHERE lower(email) = ? ORDER BY datetime(created_at) DESC, id DESC LIMIT 1'
        ).get(email);
      }
      return formatApplication(row, { self: true });
    },
    async approveDealerApplication(id, actor) {
      const row = getRow(id);
      if (!row) return null;
      const app = formatApplication(row, { admin: true });
      if (app.status === 'approved') return app;
      const linked = await linkApprovedDealer(store, app);
      const stamp = nowIso();
      db.prepare(`
        UPDATE dealer_applications
        SET status = 'approved', customer_id = ?, reviewed_at = ?, reviewed_by = ?, updated_at = ?
        WHERE id = ?
      `).run(linked.customerId || null, stamp, trim((actor && (actor.name || actor.email)) || '', 160), stamp, id);
      return formatApplication(getRow(id), { admin: true });
    },
    async rejectDealerApplication(id, actor, notes) {
      const row = getRow(id);
      if (!row) return null;
      const app = formatApplication(row, { admin: true });
      if (app.status === 'approved') await revertDealerAccount(store, app);
      const stamp = nowIso();
      db.prepare(`
        UPDATE dealer_applications
        SET status = 'rejected', notes_internal = ?, reviewed_at = ?, reviewed_by = ?, updated_at = ?
        WHERE id = ?
      `).run(
        trim(notes != null ? notes : app.notesInternal, 4000),
        stamp,
        trim((actor && (actor.name || actor.email)) || '', 160),
        stamp,
        id
      );
      return formatApplication(getRow(id), { admin: true });
    },
    async getDealerPriceBook() {
      const items = await store.listInventory();
      return (items || []).map(publicPriceBookItem).filter(Boolean);
    },
    async getDealerPortalMe(user) {
      const application = await this.getDealerApplicationForUser({
        userId: user && user.id,
        email: user && user.email
      });
      return portalMePayload(user, application);
    },
    async listDealerQuotes(user) {
      return listDealerQuotesFor(store, user);
    },
    async createDealerQuote(user, payload) {
      return createDealerQuoteFor(store, user, payload);
    }
  };
}

function supabaseApi(supabase, store) {
  async function fetchRow(id) {
    const { data, error } = await supabase.from('dealer_applications').select('*').eq('id', id).maybeSingle();
    throwIfMissing(error, 'Could not load dealer application.');
    return data;
  }

  return {
    async createDealerApplication(payload) {
      const input = normalizeApplicationInput(payload);
      await assertNotAlreadyDealer(store, input.email);
      const existingRes = await supabase
        .from('dealer_applications')
        .select('*')
        .ilike('email', input.email)
        .in('status', ['pending', 'approved'])
        .order('id', { ascending: false })
        .limit(8);
      throwIfMissing(existingRes.error, 'Could not check dealer applications.');
      const approved = (existingRes.data || []).find(function (row) { return row.status === 'approved'; });
      if (approved) throw alreadyDealerError();
      const pending = (existingRes.data || []).find(function (row) { return row.status === 'pending'; });
      if (pending) {
        return { application: formatApplication(pending, { admin: true }), duplicate: true };
      }
      await maybePatchProfile(store, input);
      const fields = supabaseFields(input);
      const stamp = nowIso();
      fields.status = 'pending';
      fields.dealer_tier = 'authorized';
      fields.payment_terms = 'prepaid_30_70';
      fields.hold_hours = 48;
      fields.notes_internal = '';
      fields.reviewed_by = '';
      fields.created_at = stamp;
      fields.updated_at = stamp;
      const { data, error } = await supabase.from('dealer_applications').insert(fields).select('*').single();
      throwIfMissing(error, 'Could not save dealer application.');
      return { application: formatApplication(data, { admin: true }), duplicate: false };
    },
    async listDealerApplications(opts) {
      let query = supabase.from('dealer_applications').select('*').order('created_at', { ascending: false }).order('id', { ascending: false });
      const raw = opts && opts.status ? String(opts.status).toLowerCase() : '';
      if (STATUSES.indexOf(raw) !== -1) query = query.eq('status', raw);
      const { data, error } = await query;
      throwIfMissing(error, 'Could not list dealer applications.');
      return (data || []).map(function (row) { return formatApplication(row, { admin: true }); });
    },
    async getDealerApplication(id) {
      return formatApplication(await fetchRow(id), { admin: true });
    },
    async attachDealerApplicationCrmLead(id, leadId) {
      const n = Number(leadId);
      if (!id || !Number.isFinite(n) || n <= 0) return this.getDealerApplication(id);
      const { error } = await supabase
        .from('dealer_applications')
        .update({ crm_lead_id: n, updated_at: nowIso() })
        .eq('id', id);
      throwIfMissing(error, 'Could not link CRM lead.');
      return this.getDealerApplication(id);
    },
    async getDealerApplicationForUser(opts) {
      const userId = trim((opts && opts.userId) || '', 80);
      const email = trim((opts && opts.email) || '', 160).toLowerCase();
      if (!userId && !email) return null;
      const results = [];
      if (userId) {
        const byUser = await supabase
          .from('dealer_applications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(1);
        throwIfMissing(byUser.error, 'Could not load dealer application.');
        if (byUser.data && byUser.data[0]) results.push(byUser.data[0]);
      }
      if (email) {
        const byEmail = await supabase
          .from('dealer_applications')
          .select('*')
          .eq('email', email)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(1);
        throwIfMissing(byEmail.error, 'Could not load dealer application.');
        if (byEmail.data && byEmail.data[0]) results.push(byEmail.data[0]);
      }
      if (!results.length) return null;
      results.sort(function (a, b) {
        const at = String(a.created_at || '');
        const bt = String(b.created_at || '');
        if (at === bt) return (Number(b.id) || 0) - (Number(a.id) || 0);
        return at < bt ? 1 : -1;
      });
      return formatApplication(results[0], { self: true });
    },
    async approveDealerApplication(id, actor) {
      const row = await fetchRow(id);
      if (!row) return null;
      const app = formatApplication(row, { admin: true });
      if (app.status === 'approved') return app;
      const linked = await linkApprovedDealer(store, app);
      const stamp = nowIso();
      const { data, error } = await supabase
        .from('dealer_applications')
        .update({
          status: 'approved',
          customer_id: linked.customerId || null,
          reviewed_at: stamp,
          reviewed_by: trim((actor && (actor.name || actor.email)) || '', 160),
          updated_at: stamp
        })
        .eq('id', id)
        .select('*')
        .maybeSingle();
      throwIfMissing(error, 'Could not approve dealer application.');
      return formatApplication(data, { admin: true });
    },
    async rejectDealerApplication(id, actor, notes) {
      const row = await fetchRow(id);
      if (!row) return null;
      const app = formatApplication(row, { admin: true });
      if (app.status === 'approved') await revertDealerAccount(store, app);
      const stamp = nowIso();
      const { data, error } = await supabase
        .from('dealer_applications')
        .update({
          status: 'rejected',
          notes_internal: trim(notes != null ? notes : app.notesInternal, 4000),
          reviewed_at: stamp,
          reviewed_by: trim((actor && (actor.name || actor.email)) || '', 160),
          updated_at: stamp
        })
        .eq('id', id)
        .select('*')
        .maybeSingle();
      throwIfMissing(error, 'Could not reject dealer application.');
      return formatApplication(data, { admin: true });
    },
    async getDealerPriceBook() {
      const items = await store.listInventory();
      return (items || []).map(publicPriceBookItem).filter(Boolean);
    },
    async getDealerPortalMe(user) {
      const application = await this.getDealerApplicationForUser({
        userId: user && user.id,
        email: user && user.email
      });
      return portalMePayload(user, application);
    },
    async listDealerQuotes(user) {
      return listDealerQuotesFor(store, user);
    },
    async createDealerQuote(user, payload) {
      return createDealerQuoteFor(store, user, payload);
    }
  };
}

module.exports = {
  ensureDealerPortal,
  sqliteApi,
  supabaseApi,
  formatApplication,
  publicPriceBookItem,
  saveResaleFile,
  alreadyDealerError
};
