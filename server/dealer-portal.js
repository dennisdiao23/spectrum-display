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
  return publicDealerDoc(doc);
}

function publicDealerDoc(doc) {
  if (!doc) return null;
  return {
    id: doc.id,
    type: doc.type || 'quote',
    typeLabel: doc.typeLabel || (doc.type === 'order' ? 'Sales Order' : 'Sales Quote'),
    number: doc.number || '',
    status: doc.status || 'draft',
    issueDate: doc.issueDate || '',
    poNumber: doc.poNumber || '',
    paymentTerms: doc.paymentTerms || '',
    customerId: doc.customerId || '',
    customerName: doc.customerName || '',
    customerEmail: doc.customerEmail || '',
    notes: doc.notes || '',
    billStreet: doc.billStreet || '',
    billCity: doc.billCity || '',
    billState: doc.billState || '',
    billZip: doc.billZip || '',
    billCountry: doc.billCountry || '',
    shipStreet: doc.shipStreet || '',
    shipCity: doc.shipCity || '',
    shipState: doc.shipState || '',
    shipZip: doc.shipZip || '',
    shipCountry: doc.shipCountry || '',
    subtotal: Number(doc.subtotal) || 0,
    tax: Number(doc.tax) || 0,
    total: Number(doc.total) || 0,
    createdAt: doc.createdAt || '',
    updatedAt: doc.updatedAt || '',
    lines: (doc.lines || []).map(function (line) {
      return {
        sku: line.sku || '',
        item: line.item || '',
        description: line.description || '',
        qty: line.qty,
        unitPrice: line.unitPrice,
        amount: line.amount
      };
    })
  };
}

function formatDealerUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email || '',
    name: row.name || '',
    customerId: row.customer_id == null ? (row.customerId || '') : String(row.customer_id),
    applicationId: row.application_id == null ? (row.applicationId || '') : String(row.application_id),
    active: row.active === false || row.active === 0 || row.active === '0' ? false : true,
    createdAt: row.created_at || row.createdAt || ''
  };
}

function publicDealerCustomer(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyName: row.companyName || '',
    displayName: row.displayName || '',
    contactFirst: row.contactFirst || '',
    contactLast: row.contactLast || '',
    email: row.email || '',
    phone: row.phone || '',
    website: row.website || '',
    taxId: row.taxId || '',
    billStreet: row.billStreet || '',
    billStreet2: row.billStreet2 || '',
    billCity: row.billCity || '',
    billState: row.billState || '',
    billZip: row.billZip || '',
    billCountry: row.billCountry || '',
    shipSame: row.shipSame !== false,
    shipStreet: row.shipStreet || '',
    shipStreet2: row.shipStreet2 || '',
    shipCity: row.shipCity || '',
    shipState: row.shipState || '',
    shipZip: row.shipZip || '',
    shipCountry: row.shipCountry || ''
  };
}

function formatDealerFile(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name || '',
    url: row.url || '',
    createdAt: row.created_at || row.createdAt || ''
  };
}

async function websiteSavedFor(store, email) {
  const empty = { projects: [], panels: [] };
  if (!email || !store.listAccounts || !store.getAccount) return empty;
  try {
    const accounts = await store.listAccounts();
    const hit = (accounts || []).find(function (row) {
      return String(row.email || '').toLowerCase() === String(email).toLowerCase();
    });
    if (!hit || !hit.id) return empty;
    const account = await store.getAccount(hit.id);
    const projects = ((account && account.projects) || []).map(function (row) {
      return {
        id: row.id,
        source: 'account',
        title: ((row.brand_name || row.brandName || '') + ' ' + (row.series_name || row.seriesName || 'Design')).trim(),
        brand: row.brand || '',
        series: row.series || '',
        pitch: row.pitch,
        width: row.width,
        height: row.height,
        cabinets: row.cabinets,
        savedAt: row.updated_at || row.created_at || ''
      };
    });
    const panels = ((account && account.panels) || []).map(function (row) {
      return {
        id: row.id,
        source: 'account',
        name: row.name || 'Custom Panel',
        w: row.w,
        h: row.h,
        pitch: row.pitch,
        type: row.type || '',
        savedAt: row.updated_at || row.created_at || ''
      };
    });
    return { projects: projects, panels: panels };
  } catch (_err) {
    return empty;
  }
}

function pricedBookItems(items) {
  return (items || []).map(publicPriceBookItem).filter(function (item) {
    return item && Number(item.dealerNet) > 0;
  });
}

function noCustomerError() {
  const err = new Error('Spectrum has not linked a company customer yet.');
  err.code = 'no_customer';
  return err;
}

async function resolveDealerCustomerId(store, user) {
  if (user && user.customerId) return user.customerId;
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
  return listDealerDocsFor(store, user, 'quote');
}

async function listDealerDocsFor(store, user, type) {
  const customerId = await resolveDealerCustomerId(store, user);
  if (!customerId) return [];
  const kind = type === 'order' ? 'order' : 'quote';
  const docs = await store.listSalesDocs(kind);
  return (docs || []).filter(function (doc) {
    return String(doc.customerId) === String(customerId);
  }).map(publicDealerDoc);
}

async function getDealerDocFor(store, user, id) {
  const customerId = await resolveDealerCustomerId(store, user);
  if (!customerId) return null;
  const doc = await store.getSalesDoc(id);
  if (!doc || String(doc.customerId) !== String(customerId)) return null;
  if (doc.type !== 'quote' && doc.type !== 'order') return null;
  return publicDealerDoc(doc);
}

async function pricedLinesFromPayload(store, payload) {
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
  return { notes: notes, lines: lines };
}

async function createDealerQuoteFor(store, user, payload) {
  return createDealerDocFor(store, user, 'quote', payload);
}

async function createDealerDocFor(store, user, type, payload) {
  const kind = type === 'order' ? 'order' : 'quote';
  const customerId = await resolveDealerCustomerId(store, user);
  if (!customerId) throw noCustomerError();
  const priced = await pricedLinesFromPayload(store, payload);
  if (!priced.notes && !priced.lines.length) throw new Error('Add a note or at least one SKU.');
  const app = await store.getDealerApplicationForUser({
    userId: user && user.websiteUserId,
    email: user && user.email
  });
  const extra = (kind === 'order' ? 'Order from Dealer Portal' : 'Requested from Dealer Portal') +
    (app && app.companyName ? ' (' + app.companyName + ')' : '');
  const created = await store.createSalesDoc({
    type: kind,
    customerId: customerId,
    customerEmail: (user && user.email) || '',
    poNumber: trim((payload && payload.poNumber) || '', 80),
    notes: extra + (priced.notes ? '\n' + priced.notes : ''),
    paymentTerms: trim((payload && payload.paymentTerms) || '', 80) || '30% deposit / balance before ship',
    status: 'draft',
    lines: priced.lines,
    rep: (user && user.name) || 'Dealer Portal'
  });
  return publicDealerDoc(created);
}

async function updateDealerDocFor(store, user, id, payload) {
  const current = await store.getSalesDoc(id);
  const customerId = await resolveDealerCustomerId(store, user);
  if (!current || !customerId || String(current.customerId) !== String(customerId)) return null;
  if (current.type !== 'quote' && current.type !== 'order') return null;
  if (current.status !== 'draft') {
    const err = new Error('Spectrum already has this document. Staff will finish it in Company.');
    err.code = 'not_draft';
    throw err;
  }
  const priced = await pricedLinesFromPayload(store, payload);
  if (!priced.notes && !priced.lines.length && !(payload && payload.poNumber)) {
    throw new Error('Add a note or at least one SKU.');
  }
  const updated = await store.updateSalesDoc(id, {
    type: current.type,
    number: current.number,
    customerId: customerId,
    customerEmail: current.customerEmail || (user && user.email) || '',
    poNumber: payload && payload.poNumber != null ? trim(payload.poNumber, 80) : current.poNumber,
    notes: priced.notes || current.notes,
    paymentTerms: (payload && payload.paymentTerms != null)
      ? (trim(payload.paymentTerms, 80) || current.paymentTerms)
      : current.paymentTerms,
    status: 'draft',
    lines: priced.lines.length ? priced.lines : current.lines
  });
  return publicDealerDoc(updated);
}

function publicBookLocation(loc) {
  if (!loc) return null;
  const name = loc.locationName || loc.warehouseName || '';
  if (!name) return null;
  return {
    name: name,
    type: loc.typeLabel || loc.kindLabel || loc.kind || '',
    qty: Math.max(0, Number(loc.qty) || 0),
    tracked: !(loc.untracked === true || loc.tracked === false)
  };
}

function bookOnHandQty(item) {
  const ours = Math.max(0, Number(item && item.qty) || 0);
  if (ours > 0) return ours;
  const vendor = item && item.untrackedQty != null ? item.untrackedQty : (item && item.partnerQty);
  return Math.max(0, Number(vendor) || 0);
}

function publicPriceBookItem(item) {
  if (!item) return null;
  const inactive = item.inactive === true || item.inactive === 1 || item.inactive === '1';
  if (inactive) return null;
  const locations = [];
  (item.locations || []).forEach(function (loc) {
    const row = publicBookLocation(loc);
    if (row) locations.push(row);
  });
  const gallery = Array.isArray(item.gallery) ? item.gallery : [];
  const image = item.image || gallery[0] || '';
  return {
    sku: item.sku || '',
    name: item.name || '',
    brand: item.brandName || item.brandId || '',
    category: item.category || '',
    description: item.description || '',
    pitch: item.pitch || '',
    pitchLabel: item.pitchLabel || '',
    unit: item.unit || '',
    panelType: item.panelType || '',
    packagingType: item.packagingType || '',
    dealerNet: Number(item.dealerNet) || 0,
    listPrice: Number(item.price) || 0,
    qty: bookOnHandQty(item),
    lowAt: Math.max(0, Number(item.lowAt) || 0),
    status: item.status || '',
    warehouse: item.warehouse || item.location || (locations[0] && locations[0].name) || '',
    bin: item.bin || '',
    locations: locations,
    image: image
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
  if (account && account.id && (app.companyName || app.phone || app.contactName)) {
    try {
      await store.updateAccount(account.id, {
        company: app.companyName || account.company || '',
        phone: app.phone || account.phone || '',
        name: app.contactName || account.name || ''
      });
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
    CREATE TABLE IF NOT EXISTS dealer_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      customer_id INTEGER,
      application_id INTEGER,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS dealer_users_customer_idx ON dealer_users (customer_id);
    CREATE TABLE IF NOT EXISTS dealer_sessions (
      token TEXT PRIMARY KEY,
      dealer_user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (dealer_user_id) REFERENCES dealer_users(id)
    );
    CREATE TABLE IF NOT EXISTS dealer_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      dealer_user_id INTEGER,
      name TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS dealer_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      dealer_user_id INTEGER,
      title TEXT NOT NULL DEFAULT '',
      payload TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS dealer_custom_panels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      dealer_user_id INTEGER,
      name TEXT NOT NULL DEFAULT '',
      payload TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
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
      return pricedBookItems(items);
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
    },
    async getDealerUserByEmail(email) {
      const row = db.prepare('SELECT * FROM dealer_users WHERE lower(email) = ?').get(trim(email, 160).toLowerCase());
      return row || null;
    },
    async getDealerUser(id) {
      return db.prepare('SELECT * FROM dealer_users WHERE id = ?').get(id) || null;
    },
    async listDealerUsersForApplication(applicationId) {
      return db.prepare(
        'SELECT * FROM dealer_users WHERE application_id = ? ORDER BY datetime(created_at) DESC, id DESC'
      ).all(applicationId).map(formatDealerUser);
    },
    async listDealerUsersForCustomer(customerId) {
      return db.prepare(
        'SELECT * FROM dealer_users WHERE customer_id = ? ORDER BY datetime(created_at) DESC, id DESC'
      ).all(customerId).map(formatDealerUser);
    },
    async createDealerUser(input) {
      const email = trim(input && input.email, 160).toLowerCase();
      const name = trim(input && input.name, 120);
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid email is required.');
      if (!name) throw new Error('Name is required.');
      if (!(input && input.passwordHash)) throw new Error('Password is required.');
      const existing = db.prepare('SELECT id FROM dealer_users WHERE lower(email) = ?').get(email);
      if (existing) throw new Error('That portal login already exists.');
      const stamp = nowIso();
      const info = db.prepare(`
        INSERT INTO dealer_users (email, name, password_hash, customer_id, application_id, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      `).run(email, name, input.passwordHash, input.customerId || null, input.applicationId || null, stamp, stamp);
      return formatDealerUser(db.prepare('SELECT * FROM dealer_users WHERE id = ?').get(info.lastInsertRowid));
    },
    async updateDealerUserPassword(id, passwordHash) {
      const row = db.prepare('SELECT * FROM dealer_users WHERE id = ?').get(id);
      if (!row) return null;
      db.prepare('UPDATE dealer_users SET password_hash = ?, updated_at = ? WHERE id = ?').run(passwordHash, nowIso(), id);
      return formatDealerUser(db.prepare('SELECT * FROM dealer_users WHERE id = ?').get(id));
    },
    async createDealerUserSession(token, dealerUserId, expiresAt) {
      db.prepare('INSERT INTO dealer_sessions (token, dealer_user_id, expires_at) VALUES (?, ?, ?)').run(token, dealerUserId, expiresAt);
    },
    async getDealerUserSession(token) {
      const row = db.prepare(`
        SELECT u.*, s.expires_at AS session_expires_at
        FROM dealer_sessions s JOIN dealer_users u ON u.id = s.dealer_user_id
        WHERE s.token = ?
      `).get(token);
      if (!row) return null;
      const user = formatDealerUser(row);
      user.expires_at = row.session_expires_at;
      user.password_hash = row.password_hash;
      return user;
    },
    async deleteDealerUserSession(token) {
      db.prepare('DELETE FROM dealer_sessions WHERE token = ?').run(token);
    },
    async listDealerDocs(user, type) {
      return listDealerDocsFor(store, user, type);
    },
    async getDealerDoc(user, id) {
      return getDealerDocFor(store, user, id);
    },
    async createDealerDoc(user, type, payload) {
      return createDealerDocFor(store, user, type, payload);
    },
    async updateDealerDoc(user, id, payload) {
      return updateDealerDocFor(store, user, id, payload);
    },
    async getDealerCompany(user) {
      const customerId = await resolveDealerCustomerId(store, user);
      const customer = customerId && store.getCompanyCustomer ? await store.getCompanyCustomer(customerId) : null;
      const application = await this.getDealerApplicationForUser({ email: user && user.email });
      const files = customerId
        ? db.prepare('SELECT * FROM dealer_files WHERE customer_id = ? ORDER BY datetime(created_at) DESC, id DESC').all(customerId).map(formatDealerFile)
        : [];
      return { user: formatDealerUser(user), customer: publicDealerCustomer(customer), application: application, files: files };
    },
    async updateDealerCompany(user, payload) {
      const customerId = await resolveDealerCustomerId(store, user);
      if (!customerId || !store.getCompanyCustomer) throw noCustomerError();
      const current = await store.getCompanyCustomer(customerId);
      if (!current) throw noCustomerError();
      const body = payload || {};
      const keys = ['companyName', 'displayName', 'contactFirst', 'contactLast', 'phone', 'website', 'taxId',
        'billStreet', 'billStreet2', 'billCity', 'billState', 'billZip', 'billCountry', 'shipSame',
        'shipStreet', 'shipStreet2', 'shipCity', 'shipState', 'shipZip', 'shipCountry'];
      const next = Object.assign({}, current);
      keys.forEach(function (key) {
        if (body[key] != null) next[key] = body[key];
      });
      return publicDealerCustomer(await store.updateCompanyCustomer(customerId, next));
    },
    async addDealerFile(user, file) {
      const customerId = await resolveDealerCustomerId(store, user);
      if (!customerId) throw noCustomerError();
      const saved = saveResaleFile(file);
      const info = db.prepare(
        'INSERT INTO dealer_files (customer_id, dealer_user_id, name, url, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(customerId, user && user.id || null, saved.name, saved.url, nowIso());
      return formatDealerFile(db.prepare('SELECT * FROM dealer_files WHERE id = ?').get(info.lastInsertRowid));
    },
    async listDealerProjects(user) {
      const customerId = await resolveDealerCustomerId(store, user);
      const rows = customerId
        ? db.prepare('SELECT * FROM dealer_projects WHERE customer_id = ? ORDER BY datetime(updated_at) DESC, id DESC').all(customerId)
        : [];
      const portalRows = rows.map(function (row) {
        return { id: 'portal-' + row.id, source: 'portal', title: row.title || 'Design', payload: parseJson(row.payload, {}), savedAt: row.updated_at || row.created_at };
      });
      const site = await websiteSavedFor(store, user && user.email);
      return portalRows.concat(site.projects);
    },
    async listDealerCustomPanels(user) {
      const customerId = await resolveDealerCustomerId(store, user);
      const rows = customerId
        ? db.prepare('SELECT * FROM dealer_custom_panels WHERE customer_id = ? ORDER BY datetime(updated_at) DESC, id DESC').all(customerId)
        : [];
      const portalRows = rows.map(function (row) {
        return Object.assign({ id: 'portal-' + row.id, source: 'portal', savedAt: row.updated_at }, parseJson(row.payload, {}), { name: row.name || 'Custom Panel' });
      });
      const site = await websiteSavedFor(store, user && user.email);
      return portalRows.concat(site.panels);
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
      return pricedBookItems(items);
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
    },
    async getDealerUserByEmail(email) {
      const { data, error } = await supabase.from('dealer_users').select('*').eq('email', trim(email, 160).toLowerCase()).maybeSingle();
      throwIfMissing(error, 'Could not load portal login.');
      return data || null;
    },
    async getDealerUser(id) {
      const { data, error } = await supabase.from('dealer_users').select('*').eq('id', id).maybeSingle();
      throwIfMissing(error, 'Could not load portal login.');
      return data || null;
    },
    async listDealerUsersForApplication(applicationId) {
      const { data, error } = await supabase.from('dealer_users').select('*').eq('application_id', applicationId).order('created_at', { ascending: false });
      throwIfMissing(error, 'Could not list portal logins.');
      return (data || []).map(formatDealerUser);
    },
    async listDealerUsersForCustomer(customerId) {
      const { data, error } = await supabase.from('dealer_users').select('*').eq('customer_id', customerId).order('created_at', { ascending: false });
      throwIfMissing(error, 'Could not list portal logins.');
      return (data || []).map(formatDealerUser);
    },
    async createDealerUser(input) {
      const email = trim(input && input.email, 160).toLowerCase();
      const name = trim(input && input.name, 120);
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid email is required.');
      if (!name) throw new Error('Name is required.');
      if (!(input && input.passwordHash)) throw new Error('Password is required.');
      const existing = await this.getDealerUserByEmail(email);
      if (existing) throw new Error('That portal login already exists.');
      const stamp = nowIso();
      const { data, error } = await supabase.from('dealer_users').insert({
        email: email,
        name: name,
        password_hash: input.passwordHash,
        customer_id: input.customerId || null,
        application_id: input.applicationId || null,
        active: true,
        created_at: stamp,
        updated_at: stamp
      }).select('*').single();
      throwIfMissing(error, 'Could not create portal login.');
      return formatDealerUser(data);
    },
    async updateDealerUserPassword(id, passwordHash) {
      const { data, error } = await supabase.from('dealer_users').update({
        password_hash: passwordHash,
        updated_at: nowIso()
      }).eq('id', id).select('*').maybeSingle();
      throwIfMissing(error, 'Could not update portal password.');
      return formatDealerUser(data);
    },
    async createDealerUserSession(token, dealerUserId, expiresAt) {
      const { error } = await supabase.from('dealer_sessions').insert({
        token: token,
        dealer_user_id: dealerUserId,
        expires_at: expiresAt
      });
      throwIfMissing(error, 'Could not start portal session.');
    },
    async getDealerUserSession(token) {
      const { data, error } = await supabase.from('dealer_sessions').select('expires_at, dealer_users(*)').eq('token', token).maybeSingle();
      throwIfMissing(error, 'Could not load portal session.');
      const row = data && (data.dealer_users || data.dealer_user);
      if (!row) return null;
      const user = formatDealerUser(row);
      user.expires_at = data.expires_at;
      user.password_hash = row.password_hash;
      return user;
    },
    async deleteDealerUserSession(token) {
      const { error } = await supabase.from('dealer_sessions').delete().eq('token', token);
      throwIfMissing(error, 'Could not sign out.');
    },
    async listDealerDocs(user, type) {
      return listDealerDocsFor(store, user, type);
    },
    async getDealerDoc(user, id) {
      return getDealerDocFor(store, user, id);
    },
    async createDealerDoc(user, type, payload) {
      return createDealerDocFor(store, user, type, payload);
    },
    async updateDealerDoc(user, id, payload) {
      return updateDealerDocFor(store, user, id, payload);
    },
    async getDealerCompany(user) {
      const customerId = await resolveDealerCustomerId(store, user);
      const customer = customerId && store.getCompanyCustomer ? await store.getCompanyCustomer(customerId) : null;
      const application = await this.getDealerApplicationForUser({ email: user && user.email });
      const { data, error } = customerId
        ? await supabase.from('dealer_files').select('*').eq('customer_id', customerId).order('created_at', { ascending: false })
        : { data: [], error: null };
      throwIfMissing(error, 'Could not load company files.');
      return {
        user: formatDealerUser(user),
        customer: publicDealerCustomer(customer),
        application: application,
        files: (data || []).map(formatDealerFile)
      };
    },
    async updateDealerCompany(user, payload) {
      const customerId = await resolveDealerCustomerId(store, user);
      if (!customerId || !store.getCompanyCustomer) throw noCustomerError();
      const current = await store.getCompanyCustomer(customerId);
      if (!current) throw noCustomerError();
      const body = payload || {};
      const keys = ['companyName', 'displayName', 'contactFirst', 'contactLast', 'phone', 'website', 'taxId',
        'billStreet', 'billStreet2', 'billCity', 'billState', 'billZip', 'billCountry', 'shipSame',
        'shipStreet', 'shipStreet2', 'shipCity', 'shipState', 'shipZip', 'shipCountry'];
      const next = Object.assign({}, current);
      keys.forEach(function (key) {
        if (body[key] != null) next[key] = body[key];
      });
      return publicDealerCustomer(await store.updateCompanyCustomer(customerId, next));
    },
    async addDealerFile(user, file) {
      const customerId = await resolveDealerCustomerId(store, user);
      if (!customerId) throw noCustomerError();
      const saved = saveResaleFile(file);
      const { data, error } = await supabase.from('dealer_files').insert({
        customer_id: customerId,
        dealer_user_id: user && user.id || null,
        name: saved.name,
        url: saved.url,
        created_at: nowIso()
      }).select('*').single();
      throwIfMissing(error, 'Could not save the file.');
      return formatDealerFile(data);
    },
    async listDealerProjects(user) {
      const customerId = await resolveDealerCustomerId(store, user);
      const { data, error } = customerId
        ? await supabase.from('dealer_projects').select('*').eq('customer_id', customerId).order('updated_at', { ascending: false })
        : { data: [], error: null };
      throwIfMissing(error, 'Could not load projects.');
      const portalRows = (data || []).map(function (row) {
        return { id: 'portal-' + row.id, source: 'portal', title: row.title || 'Design', payload: row.payload || {}, savedAt: row.updated_at || row.created_at };
      });
      const site = await websiteSavedFor(store, user && user.email);
      return portalRows.concat(site.projects);
    },
    async listDealerCustomPanels(user) {
      const customerId = await resolveDealerCustomerId(store, user);
      const { data, error } = customerId
        ? await supabase.from('dealer_custom_panels').select('*').eq('customer_id', customerId).order('updated_at', { ascending: false })
        : { data: [], error: null };
      throwIfMissing(error, 'Could not load custom panels.');
      const portalRows = (data || []).map(function (row) {
        return Object.assign({ id: 'portal-' + row.id, source: 'portal', savedAt: row.updated_at }, row.payload || {}, { name: row.name || 'Custom Panel' });
      });
      const site = await websiteSavedFor(store, user && user.email);
      return portalRows.concat(site.panels);
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
