'use strict';

const fs = require('fs');
const path = require('path');
const { hasPerm } = require('./admin-roles');

const chatAi = require('./chat-ai');

const ROOT = path.join(__dirname, '..');
const HISTORY = 20;
const BODY_MAX = 8000;
const queues = new Map();

async function currentAiName(store) {
  try {
    return chatAi.aiNameFromRow(await store.peekChatAiSettings());
  } catch (e) {
    return chatAi.DEFAULT_AI_NAME;
  }
}

function welcomeMessage(name) {
  const bot = chatAi.normalizeAiName(name);
  return 'Hi — I\'m ' + bot + '. I can search and draft anything you can do here: inventory, vendors, purchase orders, quotes, orders, invoices, and customers. I never save the final record. I prepare a draft, send it here for review, and you open it and save. Try: “Make a PO for [vendor] from low stock.”';
}

const WELCOME = welcomeMessage(chatAi.DEFAULT_AI_NAME);

const NO_KEY_COPY =
  'I can draft a PO from low stock without an AI key — try “Make a PO for [vendor] from low stock.” ' +
  'Attach a CSV to draft an invoice or PO. For everything else, add an API key in Settings → Chat / AI. ' +
  'I still will not save the final record; you review and save.';

function nowIso() {
  return new Date().toISOString();
}

function trim(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max || 240);
}

function money(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function llmConfigured() {
  return !!(
    process.env.OPENAI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.SPECTRUM_CHAT_AI_KEY
  );
}

async function llmReady(store) {
  const runtime = await chatAi.resolveRuntime(store, 'copilot');
  return !!(runtime && runtime.ok);
}

function canReadInventory(admin) {
  return hasPerm(admin, 'inventory', 'view') || hasPerm(admin, 'website', 'view');
}

function canSeeCrm(admin) {
  return hasPerm(admin, 'crm', 'view') ||
    hasPerm(admin, 'leads', 'view') ||
    hasPerm(admin, 'pipeline', 'view') ||
    hasPerm(admin, 'activities', 'view');
}

function canEditInventory(admin) {
  return hasPerm(admin, 'inventory', 'edit');
}

function compactItem(item) {
  if (!item) return null;
  return {
    id: item.id,
    sku: item.sku || '',
    name: item.name || '',
    status: item.status || '',
    qty: Number(item.qty) || 0,
    lowAt: Number(item.lowAt) || 0,
    cost: Number(item.cost) || 0,
    price: Number(item.price) || 0,
    unit: item.unit || '',
    brandName: item.brandName || '',
    category: item.category || '',
    locations: (item.locations || []).map(function (loc) {
      return {
        name: loc.warehouseName || loc.locationName || '',
        qty: Number(loc.qty) || 0,
        vendorId: loc.vendorId || '',
        vendorName: loc.vendorName || ''
      };
    })
  };
}

function compactVendor(v) {
  if (!v) return null;
  return {
    id: v.id,
    displayName: v.displayName || '',
    companyName: v.companyName || '',
    email: v.email || '',
    phone: v.phone || ''
  };
}

function compactCustomer(c) {
  if (!c) return null;
  return {
    id: c.id,
    displayName: c.displayName || '',
    companyName: c.companyName || '',
    email: c.email || '',
    phone: c.phone || ''
  };
}

function compactDoc(d) {
  if (!d) return null;
  return {
    id: d.id,
    type: d.type || '',
    number: d.number || '',
    status: d.status || '',
    customerName: d.customerName || '',
    total: d.total,
    lineCount: (d.lines || []).length
  };
}

function compactPo(d) {
  if (!d) return null;
  return {
    id: d.id,
    number: d.number || '',
    status: d.status || '',
    vendorName: d.vendorName || '',
    vendorId: d.vendorId || '',
    total: d.total,
    lineCount: (d.lines || []).length
  };
}

function compactCrmLead(lead) {
  if (!lead) return null;
  return {
    id: lead.id,
    kind: 'lead',
    name: lead.displayName || lead.companyName || '',
    companyName: lead.companyName || '',
    email: lead.email || '',
    status: lead.status || '',
    source: lead.source || '',
    leadKind: lead.kind || 'project',
    ownerName: lead.ownerName || '',
    path: '/company/crm/leads/' + lead.id
  };
}

function compactCrmDeal(deal) {
  if (!deal) return null;
  return {
    id: deal.id,
    kind: 'deal',
    title: deal.title || '',
    companyName: deal.companyName || '',
    stage: deal.stage || '',
    value: Number(deal.value) || 0,
    probability: deal.effectiveProbability != null ? deal.effectiveProbability : deal.probability,
    weightedValue: deal.weightedValue,
    dealKind: deal.kind || 'project',
    path: '/company/crm/pipeline/' + deal.id
  };
}

function crmMentionNote(text) {
  const found = String(text || '').match(/@(lead|deal)\/(\d+)/gi);
  if (!found || !found.length) return '';
  return 'Referenced CRM records: ' + found.join(', ') + '. Use get_record with kind lead or deal, or search_crm.';
}

function hay(row) {
  return String(row || '').toLowerCase();
}

function matchesQuery(parts, query) {
  const q = hay(query);
  if (!q) return true;
  return parts.join(' ').toLowerCase().indexOf(q) !== -1;
}

function findVendor(vendors, hint) {
  const q = hay(hint);
  if (!q) return null;
  const list = vendors || [];
  let hit = list.find(function (v) {
    return hay(v.id) === q || hay(v.displayName) === q || hay(v.companyName) === q;
  });
  if (hit) return hit;
  hit = list.find(function (v) {
    return hay(v.displayName).indexOf(q) !== -1 || hay(v.companyName).indexOf(q) !== -1;
  });
  return hit || null;
}

function itemTiedToVendor(item, vendorId) {
  return (item.locations || []).some(function (loc) {
    return String(loc.vendorId) === String(vendorId);
  });
}

function isLowOrOut(item) {
  const st = String(item && item.status || '');
  return st === 'low' || st === 'out';
}

function restockQty(item) {
  const qty = Math.max(0, Number(item && item.qty) || 0);
  const low = Math.max(0, Number(item && item.lowAt) || 0);
  return Math.max(1, low - qty);
}

function shareToken(kind, label, reviewPath) {
  return '[share|' + String(kind || 'Draft').replace(/\|/g, '/') + '|' +
    String(label || 'Review').replace(/\|/g, '/') + '|' + reviewPath + ']';
}

function draftToken(token, kind, label, reviewPath) {
  return '[copilot-draft|' + token + '|' + kind + '|' +
    String(label || 'Draft').replace(/\|/g, '/') + '|' + reviewPath + ']';
}

function reviewPathFor(kind, token, payload) {
  const q = '?copilot=' + encodeURIComponent(token);
  const src = payload || {};
  if (kind === 'po' || kind === 'po_patch') {
    if (src.id) return '/company/inventory/purchase-orders/' + src.id + q;
    return '/company/inventory/purchase-orders/new' + q;
  }
  if (kind === 'invoice' || kind === 'invoice_patch') {
    if (src.id) return '/company/sales/invoices/' + src.id + q;
    return '/company/sales/invoices/new' + q;
  }
  if (kind === 'order' || kind === 'order_patch') {
    if (src.id) return '/company/sales/orders/' + src.id + q;
    return '/company/sales/orders/new' + q;
  }
  if (kind === 'quote' || kind === 'quote_patch') {
    if (src.id) return '/company/sales/quotes/' + src.id + q;
    return '/company/sales/quotes/new' + q;
  }
  if (kind === 'inventory' || kind === 'inventory_patch') {
    if (src.id) return '/company/inventory/' + src.id + q;
    return '/company/inventory' + q + '&draft=inventory';
  }
  if (kind === 'customer' || kind === 'customer_patch') {
    if (src.id) return '/company/customers/' + src.id + q;
    return '/company/customers' + q + '&draft=customer';
  }
  if (kind === 'vendor' || kind === 'vendor_patch') {
    if (src.id) return '/company/inventory/vendors/' + src.id + q;
    return '/company/inventory/vendors' + q + '&draft=vendor';
  }
  if (kind === 'warehouse' || kind === 'warehouse_patch') {
    if (src.id) return '/company/inventory/locations/' + src.id + q;
    return '/company/inventory/locations' + q + '&draft=warehouse';
  }
  if (kind === 'receipt') return '/company/inventory/receipt-shipments' + q + '&draft=receipt';
  return '/company' + q;
}

function kindLabel(kind) {
  const map = {
    po: 'Purchase order',
    po_patch: 'Purchase order',
    invoice: 'Invoice',
    invoice_patch: 'Invoice',
    order: 'Sales order',
    order_patch: 'Sales order',
    quote: 'Sales quote',
    quote_patch: 'Sales quote',
    inventory: 'Inventory',
    inventory_patch: 'Inventory',
    customer: 'Customer',
    customer_patch: 'Customer',
    vendor: 'Vendor',
    vendor_patch: 'Vendor',
    warehouse: 'Location',
    warehouse_patch: 'Location',
    receipt: 'Receipt shipment'
  };
  return map[kind] || 'Draft';
}

async function saveAndCard(store, admin, roomId, kind, payload, summary) {
  const token = await store.saveCopilotDraft(admin, roomId, kind, payload, summary);
  const reviewPath = reviewPathFor(kind, token, payload);
  const label = summary || ('Draft ' + kindLabel(kind));
  const body = (summary ? summary + '\n\n' : '') +
    'Open this to review. I will not save it — you save when it looks right.\n\n' +
    draftToken(token, kind, label, reviewPath) + '\n' +
    shareToken(kindLabel(kind), label, reviewPath);
  return { token: token, body: body, reviewPath: reviewPath };
}

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_customers',
      description: 'Search company customers by name, company, email, or phone.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_inventory',
      description: 'Search inventory by SKU, name, brand, or status (low, out, ok, special).',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          status: { type: 'string', description: 'low, out, ok, special, or empty for any' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_vendors',
      description: 'Search vendors by name, company, or email.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_sales_docs',
      description: 'Search quotes, sales orders, or invoices.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          type: { type: 'string', description: 'quote, order, invoice, or empty for all' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_purchase_orders',
      description: 'Search purchase orders by number or vendor.',
      parameters: { type: 'object', properties: { query: { type: 'string' } } }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_crm',
      description: 'Search CRM leads and deals by name, company, email, or @lead/id / @deal/id.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          kind: { type: 'string', description: 'lead, deal, or empty for both' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_record',
      description: 'Get one record the staff member can open.',
      parameters: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            description: 'customer, inventory, vendor, quote, order, invoice, po, warehouse, lead, deal'
          },
          id: { type: 'string' }
        },
        required: ['kind', 'id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'draft_low_stock_po',
      description: 'Prepare a purchase order for a vendor from every low or out-of-stock item tied to that vendor. Does not save the PO. Sends a draft to chat for the staff member to review and save.',
      parameters: {
        type: 'object',
        properties: {
          vendor: { type: 'string', description: 'Vendor name, company, or id' }
        },
        required: ['vendor']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'fetch_page',
      description: 'Fetch a public http(s) URL and return title, description, and image URLs. Use this to draft an inventory item from a product page. Do not invent specs that are not on the page.',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string' } },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'draft_record',
      description: 'Prepare a new or updated record for staff review. Never saves. kind is customer, vendor, inventory, quote, order, invoice, po, warehouse, or receipt. For updates pass id. Leave unknown prices, qty, and warranty empty — do not invent them.',
      parameters: {
        type: 'object',
        properties: {
          kind: { type: 'string' },
          id: { type: 'string', description: 'Existing id when proposing an update' },
          summary: { type: 'string' },
          payload: { type: 'object' }
        },
        required: ['kind', 'payload']
      }
    }
  }
];

function anthropicTools() {
  return TOOLS.map(function (t) {
    const fn = t.function;
    return {
      name: fn.name,
      description: fn.description,
      input_schema: fn.parameters || { type: 'object', properties: {} }
    };
  });
}

function openaiTools() {
  return TOOLS;
}

function geminiTools() {
  return [{
    functionDeclarations: TOOLS.map(function (t) {
      const fn = t.function;
      return {
        name: fn.name,
        description: fn.description,
        parameters: fn.parameters
      };
    })
  }];
}

async function runTool(store, admin, roomId, name, args) {
  const a = args || {};
  if (name === 'search_customers') {
    const rows = await store.listCompanyCustomers();
    const q = trim(a.query, 80);
    return (rows || []).filter(function (c) {
      return matchesQuery([c.displayName, c.companyName, c.email, c.phone, c.contactName], q);
    }).slice(0, 20).map(compactCustomer);
  }
  if (name === 'search_inventory') {
    if (!canReadInventory(admin)) return { error: 'No inventory access.' };
    const rows = await store.listInventory();
    const q = trim(a.query, 80);
    const st = trim(a.status, 20).toLowerCase();
    return (rows || []).filter(function (item) {
      if (st && String(item.status || '') !== st) return false;
      return matchesQuery([item.sku, item.name, item.brandName, item.description, item.category], q || ' ');
    }).slice(0, 30).map(compactItem);
  }
  if (name === 'search_vendors') {
    if (!canReadInventory(admin)) return { error: 'No vendor access.' };
    const rows = await store.listVendors();
    const q = trim(a.query, 80);
    return (rows || []).filter(function (v) {
      return matchesQuery([v.displayName, v.companyName, v.email, v.phone], q);
    }).slice(0, 20).map(compactVendor);
  }
  if (name === 'search_sales_docs') {
    const type = trim(a.type, 20).toLowerCase();
    const filter = type === 'quote' || type === 'order' || type === 'invoice' ? type : '';
    const rows = await store.listSalesDocs(filter);
    const q = trim(a.query, 80);
    return (rows || []).filter(function (d) {
      return matchesQuery([d.number, d.customerName, d.status, d.type], q || ' ');
    }).slice(0, 20).map(compactDoc);
  }
  if (name === 'search_purchase_orders') {
    if (!canReadInventory(admin)) return { error: 'No purchase order access.' };
    const rows = await store.listPurchaseOrders();
    const q = trim(a.query, 80);
    return (rows || []).filter(function (d) {
      return matchesQuery([d.number, d.vendorName, d.status], q || ' ');
    }).slice(0, 20).map(compactPo);
  }
  if (name === 'search_crm') {
    if (!canSeeCrm(admin)) return { error: 'No CRM access.' };
    const q = trim(a.query, 80);
    const kind = trim(a.kind, 20).toLowerCase();
    const out = [];
    if (kind !== 'deal' && typeof store.listCrmLeads === 'function') {
      const leads = await store.listCrmLeads();
      (leads || []).forEach(function (lead) {
        if (lead.mergedIntoId) return;
        if (!matchesQuery([lead.displayName, lead.companyName, lead.email, lead.kind, 'lead', '@lead/' + lead.id], q || ' ')) return;
        out.push(compactCrmLead(lead));
      });
    }
    if (kind !== 'lead' && typeof store.listCrmDeals === 'function') {
      const deals = await store.listCrmDeals();
      (deals || []).forEach(function (deal) {
        if (!matchesQuery([deal.title, deal.companyName, deal.email, deal.kind, 'deal', '@deal/' + deal.id], q || ' ')) return;
        out.push(compactCrmDeal(deal));
      });
    }
    return out.slice(0, 24);
  }
  if (name === 'get_record') {
    return getRecord(store, admin, trim(a.kind, 40), a.id);
  }
  if (name === 'draft_low_stock_po') {
    return draftLowStockPo(store, admin, roomId, a.vendor);
  }
  if (name === 'fetch_page') {
    return fetchPage(a.url);
  }
  if (name === 'draft_record') {
    return draftRecord(store, admin, roomId, a.kind, a.id, a.payload, a.summary);
  }
  return { error: 'Unknown tool.' };
}

async function fetchPage(rawUrl) {
  const url = String(rawUrl || '').trim();
  if (!/^https?:\/\//i.test(url)) return { error: 'URL must start with http:// or https://' };
  const ac = new AbortController();
  const t = setTimeout(function () { ac.abort(); }, 8000);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      headers: { 'User-Agent': 'SpectrumCopilot/1.0' },
      redirect: 'follow'
    });
    const html = String(await res.text()).slice(0, 200000);
    function meta(name) {
      const re = new RegExp('<meta[^>]+(?:property|name)=["\\\']' + name + '["\\\'][^>]+content=["\\\']([^"\\\']+)["\\\']', 'i');
      const re2 = new RegExp('<meta[^>]+content=["\\\']([^"\\\']+)["\\\'][^>]+(?:property|name)=["\\\']' + name + '["\\\']', 'i');
      const m = html.match(re) || html.match(re2);
      return m ? m[1].trim() : '';
    }
    const title = ((html.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1] || '').trim();
    return {
      url: url,
      status: res.status,
      title: title || meta('og:title'),
      description: meta('description') || meta('og:description'),
      image: meta('og:image'),
      siteName: meta('og:site_name')
    };
  } catch (err) {
    return { error: 'Could not fetch that page.' };
  } finally {
    clearTimeout(t);
  }
}

async function getRecord(store, admin, kind, id) {
  const k = String(kind || '').toLowerCase();
  if (k === 'customer') return compactCustomer(await store.getCompanyCustomer(id));
  if (k === 'inventory') {
    if (!canReadInventory(admin)) return { error: 'No inventory access.' };
    const data = await store.getInventoryItem(id);
    return compactItem(data && data.item);
  }
  if (k === 'vendor') {
    if (!canReadInventory(admin)) return { error: 'No vendor access.' };
    return compactVendor(await store.getVendor(id));
  }
  if (k === 'po') {
    if (!canReadInventory(admin)) return { error: 'No purchase order access.' };
    return compactPo(await store.getPurchaseOrder(id));
  }
  if (k === 'quote' || k === 'order' || k === 'invoice') {
    const doc = await store.getSalesDoc(id);
    return compactDoc(doc);
  }
  if (k === 'warehouse') {
    if (!canReadInventory(admin)) return { error: 'No location access.' };
    const wh = await store.getWarehouse(id);
    if (!wh) return null;
    return { id: wh.id, name: wh.name, kind: wh.kind || wh.type, vendorId: wh.vendorId || '', vendorName: wh.vendorName || '' };
  }
  if (k === 'lead') {
    if (!canSeeCrm(admin)) return { error: 'No CRM access.' };
    if (typeof store.getCrmLead !== 'function') return { error: 'CRM is not available.' };
    return compactCrmLead(await store.getCrmLead(id));
  }
  if (k === 'deal') {
    if (!canSeeCrm(admin)) return { error: 'No CRM access.' };
    if (typeof store.getCrmDeal !== 'function') return { error: 'CRM is not available.' };
    return compactCrmDeal(await store.getCrmDeal(id));
  }
  return { error: 'Unknown kind.' };
}

async function draftLowStockPo(store, admin, roomId, vendorHint) {
  if (!canEditInventory(admin)) {
    return { error: 'You need inventory edit access to draft a purchase order.' };
  }
  const vendors = await store.listVendors();
  const vendor = findVendor(vendors, vendorHint);
  if (!vendor) {
    const names = (vendors || []).slice(0, 12).map(function (v) {
      return v.displayName || v.companyName;
    }).filter(Boolean);
    return {
      error: 'Could not match that vendor.',
      hint: names.length ? ('Known vendors include: ' + names.join(', ')) : 'No vendors on file.'
    };
  }
  const items = await store.listInventory();
  const lines = (items || []).filter(function (item) {
    return itemTiedToVendor(item, vendor.id) && isLowOrOut(item) && !item.inactive;
  }).map(function (item) {
    const qty = restockQty(item);
    const rate = money(item.cost);
    return {
      itemId: String(item.id),
      product: item.name || item.sku || '',
      sku: item.sku || '',
      description: (item.status === 'out' ? 'Out of stock' : 'Low stock') +
        ' · on hand ' + (Number(item.qty) || 0) +
        ' · low at ' + (Number(item.lowAt) || 0),
      qty: qty,
      rate: rate,
      ourHands: Number(item.qty) || 0,
      lowAt: Number(item.lowAt) || 0
    };
  });
  if (!lines.length) {
    return {
      error: 'No low or out-of-stock items are tied to ' + (vendor.displayName || vendor.companyName) +
        '. Low stock uses each item’s on-hand vs low-at, and the item must have a location assigned to this vendor.'
    };
  }
  const snap = require('./purchase-orders').snapshotFromVendor(vendor);
  const payload = {
    vendorId: String(vendor.id),
    vendorName: snap.vendorName || vendor.displayName || vendor.companyName || '',
    vendorEmail: snap.vendorEmail || vendor.email || '',
    mailingAddress: snap.mailingAddress || '',
    status: 'open',
    issueDate: nowIso().slice(0, 10),
    notes: 'Prepared by ' + (await currentAiName(store)) + ' from low stock for ' + (vendor.displayName || vendor.companyName) +
      '. Review qty and cost before saving.',
    lines: lines
  };
  const summary = 'Draft PO for ' + payload.vendorName + ' · ' + lines.length +
    ' low-stock line' + (lines.length === 1 ? '' : 's') + '. Not saved yet.';
  const card = await saveAndCard(store, admin, roomId, 'po', payload, summary);
  await store.logCopilotAudit(admin, roomId, 'draft_low_stock_po', {
    vendorId: vendor.id,
    lineCount: lines.length,
    token: card.token
  });
  return { ok: true, summary: summary, lineCount: lines.length, token: card.token, body: card.body };
}

async function draftRecord(store, admin, roomId, kindRaw, id, payload, summary) {
  let kind = String(kindRaw || '').toLowerCase().replace(/-/g, '_');
  if (kind === 'purchase_order' || kind === 'purchaseorder') kind = 'po';
  if (kind === 'sales_order') kind = 'order';
  if (kind === 'location') kind = 'warehouse';
  const data = Object.assign({}, payload || {});
  if (id) data.id = id;
  const updating = !!(data.id);
  if (updating) kind = kind.indexOf('_patch') === -1 ? (kind + '_patch') : kind;

  const needsInv = /^(po|inventory|vendor|warehouse|receipt)/.test(kind);
  if (needsInv && updating && !canEditInventory(admin)) {
    return { error: 'You need inventory edit access to propose this change.' };
  }
  if (needsInv && !updating && !canEditInventory(admin) && kind !== 'po_patch') {
    if (!canReadInventory(admin) && kind.indexOf('po') === 0) {
      return { error: 'You need inventory access to draft a purchase order.' };
    }
    if (!canEditInventory(admin) && (kind === 'po' || kind === 'inventory' || kind === 'vendor' || kind === 'warehouse' || kind === 'receipt')) {
      return { error: 'You need inventory edit access to draft this. You can still search.' };
    }
  }
  if (!Object.keys(data).length) return { error: 'Nothing to draft.' };

  const label = summary || ((updating ? 'Update ' : 'New ') + kindLabel(kind) +
    (data.vendorName || data.customerName || data.name || data.displayName || data.number
      ? (' · ' + (data.vendorName || data.customerName || data.name || data.displayName || data.number))
      : ''));
  const card = await saveAndCard(store, admin, roomId, kind, data, label + '. Not saved yet.');
  await store.logCopilotAudit(admin, roomId, 'draft_record', { kind: kind, token: card.token, updating: updating });
  return { ok: true, summary: label, token: card.token, body: card.body };
}

function parseCsvText(text) {
  const raw = String(text || '').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter(function (row) { return row.trim(); });
  if (lines.length < 2) return [];
  const delim = (lines[0].split('\t').length > lines[0].split(',').length) ? '\t' : ',';
  function split(row) {
    const out = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '"') {
        if (q && row[i + 1] === '"') { cur += '"'; i++; }
        else q = !q;
      } else if (ch === delim && !q) {
        out.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  }
  const headers = split(lines[0]).map(function (h) { return h.toLowerCase().replace(/[^a-z0-9]+/g, ''); });
  return lines.slice(1).map(function (line) {
    const cols = split(line);
    const row = {};
    headers.forEach(function (h, i) { row[h] = cols[i] || ''; });
    return row;
  }).filter(function (row) {
    return Object.keys(row).some(function (k) { return row[k]; });
  });
}

function col(row, names) {
  for (let i = 0; i < names.length; i++) {
    const key = names[i];
    if (row[key] != null && String(row[key]).trim()) return String(row[key]).trim();
  }
  return '';
}

function spreadsheetLines(rows) {
  return (rows || []).map(function (row) {
    const qty = money(col(row, ['qty', 'quantity', 'qtyordered', 'orderqty']) || 1) || 1;
    const rate = money(col(row, ['rate', 'cost', 'unitcost', 'unitprice', 'price', 'net']));
    return {
      sku: col(row, ['sku', 'item', 'itemsku', 'part', 'partnumber']),
      product: col(row, ['product', 'name', 'itemname', 'productservice']),
      description: col(row, ['description', 'desc', 'details']),
      qty: qty,
      rate: rate,
      unitPrice: rate
    };
  }).filter(function (line) {
    return line.sku || line.product || line.description;
  });
}

function parseXlsxBuffer(buf) {
  let xlsx;
  try { xlsx = require('xlsx'); } catch (e) { return null; }
  const wb = xlsx.read(buf, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const json = xlsx.utils.sheet_to_json(sheet, { defval: '' });
  return json.map(function (row) {
    const out = {};
    Object.keys(row).forEach(function (k) {
      out[String(k).toLowerCase().replace(/[^a-z0-9]+/g, '')] = row[k];
    });
    return out;
  });
}

async function readAttachment(message) {
  const url = message && message.attachmentUrl;
  if (!url) return null;
  const name = String(message.attachmentName || url).toLowerCase();
  const type = String(message.attachmentType || '');
  let buf = null;
  if (url.indexOf('/uploads/chat/') === 0) {
    const filePath = path.join(ROOT, url.replace(/^\//, ''));
    if (fs.existsSync(filePath)) buf = fs.readFileSync(filePath);
  }
  if (!buf && /^https?:\/\//i.test(url)) {
    try {
      const res = await fetch(url);
      if (res.ok) buf = Buffer.from(await res.arrayBuffer());
    } catch (e) { /* ignore */ }
  }
  if (!buf) return { name: name, type: type, url: url };
  return { name: name, type: type, url: url, buffer: buf };
}

async function maybeParseAttachment(store, admin, roomId, message, userText) {
  const file = await readAttachment(message);
  if (!file || !file.buffer) return null;
  const name = file.name;
  const isCsv = /\.csv$/.test(name) || file.type === 'file' && /csv/.test(name);
  const isXlsx = /\.xlsx$/.test(name);
  let rows = null;
  if (isCsv) rows = parseCsvText(file.buffer.toString('utf8'));
  else if (isXlsx) rows = parseXlsxBuffer(file.buffer);
  if (!rows || !rows.length) return null;
  const lines = spreadsheetLines(rows);
  if (!lines.length) return null;
  const text = hay(userText);
  const wantPo = /\b(po|purchase order|vendor)\b/.test(text);
  if (wantPo) {
    if (!canEditInventory(admin)) return 'You need inventory edit access to draft a PO from this file.';
    const vendorHint = col(rows[0], ['vendor', 'vendorname', 'company']) || '';
    const vendors = await store.listVendors();
    const vendor = findVendor(vendors, vendorHint);
    const payload = {
      vendorId: vendor ? String(vendor.id) : '',
      vendorName: vendor ? (vendor.displayName || vendor.companyName) : vendorHint,
      status: 'open',
      issueDate: nowIso().slice(0, 10),
      notes: 'Prepared by ' + (await currentAiName(store)) + ' from ' + (message.attachmentName || 'spreadsheet') + '. Review before saving.',
      lines: lines
    };
    if (!payload.vendorId && !payload.vendorName) {
      return 'This spreadsheet has line items, but I need a vendor name to draft a PO. Tell me the vendor.';
    }
    const card = await saveAndCard(
      store, admin, roomId, 'po', payload,
      'Draft PO' + (payload.vendorName ? (' for ' + payload.vendorName) : '') +
        ' · ' + lines.length + ' lines from the spreadsheet. Not saved yet.'
    );
    return card.body;
  }
  const customerHint = col(rows[0], ['customer', 'customername', 'company', 'billto']);
  const payload = {
    type: /\binvoice\b/.test(text) ? 'invoice' : (/\border\b/.test(text) ? 'order' : 'invoice'),
    customerName: customerHint,
    status: 'draft',
    issueDate: nowIso().slice(0, 10),
    notes: 'Prepared by ' + (await currentAiName(store)) + ' from ' + (message.attachmentName || 'spreadsheet') + '. Review before saving.',
    lines: lines.map(function (line) {
      return { sku: line.sku, description: line.description || line.product, qty: line.qty, unitPrice: line.unitPrice };
    })
  };
  if (!payload.customerName) {
    return 'This spreadsheet has line items. Tell me the customer (or say it is a PO for a vendor) and I will draft it for review.';
  }
  const card = await saveAndCard(
    store, admin, roomId, payload.type, payload,
    'Draft ' + payload.type + ' for ' + payload.customerName + ' · ' + lines.length +
      ' lines from the spreadsheet. Not saved yet.'
  );
  return card.body;
}

function wantsLowStockPo(text) {
  const t = hay(text);
  const po = /\b(po|purchase order|p\.o\.?)\b/.test(t);
  const low = /\b(low[ -]?stock|low at|reorder|below min|out of stock|low items)\b/.test(t);
  return po && low;
}

function vendorHintFromText(text) {
  const m = String(text || '').match(/(?:po|purchase order|p\.o\.?)\s+(?:for\s+)?(.+?)(?:\s+from|\s+with|\s+using|\s+of)\b/i)
    || String(text || '').match(/\bfor\s+(.+?)(?:\s+from|\s+using|\s+with)\s+(?:all|low|the|out)/i)
    || String(text || '').match(/\b(?:from|for)\s+(.+)$/i);
  if (!m) return '';
  return m[1].replace(/\b(all of the|all the|the|low[ -]?stock.*|out of stock.*)/gi, '').trim();
}

function systemPrompt(admin, name) {
  const who = (admin && (admin.name || admin.email)) || 'Staff';
  const bot = chatAi.normalizeAiName(name);
  return [
    'You are ' + bot + ' inside Spectrum Display’s company admin chat.',
    'You help ' + who + ' with inventory, vendors, purchase orders, customers, quotes, orders, invoices, and CRM leads and deals.',
    'You can do anything they can do in this app, but you MUST NOT save, send, email, delete, or finalize any record.',
    'Prepare a draft and send it to chat for review. They open it and save it themselves.',
    'Never invent prices, stock qty, warranty years, or people\'s names. If unknown, leave blank and say so.',
    'Use tools to look up live data. When the user wants a PO from low stock for a vendor, call draft_low_stock_po.',
    'When they mention @lead/id or @deal/id, call get_record or search_crm.',
    'When you create a draft via a tool, include the tool\'s body text in your reply so the review card appears.',
    'If you lack permission, say so. Do not pretend a save happened.'
  ].join(' ');
}

function toOpenAiMessages(admin, history, userText, fileNote, name) {
  const msgs = [{ role: 'system', content: systemPrompt(admin, name) }];
  (history || []).forEach(function (m) {
    if (!m || m.isDeleted) return;
    const content = trim(m.body, 1500);
    if (!content) return;
    if (m.isCopilot) msgs.push({ role: 'assistant', content: content });
    else if (m.userId) msgs.push({ role: 'user', content: content });
  });
  let latest = userText || '';
  if (fileNote) latest += '\n\n' + fileNote;
  const crmNote = crmMentionNote(latest);
  if (crmNote) latest += '\n\n' + crmNote;
  msgs.push({ role: 'user', content: latest || '(see attachment)' });
  return msgs;
}

function toAnthropicMessages(history, userText, fileNote) {
  const raw = [];
  (history || []).forEach(function (m) {
    if (!m || m.isDeleted) return;
    const content = trim(m.body, 1500);
    if (!content) return;
    if (m.isCopilot) raw.push({ role: 'assistant', content: content });
    else if (m.userId) raw.push({ role: 'user', content: content });
  });
  let latest = userText || '';
  if (fileNote) latest += '\n\n' + fileNote;
  const crmNote = crmMentionNote(latest);
  if (crmNote) latest += '\n\n' + crmNote;
  raw.push({ role: 'user', content: latest || '(see attachment)' });
  const out = [];
  raw.forEach(function (m) {
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += '\n\n' + m.content;
    else out.push({ role: m.role, content: m.content });
  });
  if (out.length && out[0].role !== 'user') {
    out.unshift({ role: 'user', content: '(continue)' });
  }
  return out;
}

async function callOpenAi(apiKey, model, messages, tools) {
  const key = String(apiKey || '').trim();
  if (!key) return null;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: messages,
      tools: tools,
      tool_choice: 'auto',
      temperature: 0.2
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('Copilot model error: ' + trim(err, 200));
  }
  return res.json();
}

async function callAnthropic(apiKey, model, system, messages) {
  const key = String(apiKey || '').trim();
  if (!key) return null;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 2048,
      temperature: 0.2,
      system: system,
      tools: anthropicTools(),
      messages: messages
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('Copilot model error: ' + trim(err, 200));
  }
  return res.json();
}

async function callGemini(apiKey, model, messages, file) {
  const key = String(apiKey || '').trim();
  if (!key) return null;
  const contents = [];
  messages.forEach(function (m) {
    if (m.role === 'system') return;
    const role = m.role === 'assistant' ? 'model' : 'user';
    if (m.tool_calls) return;
    if (m.role === 'tool') {
      contents.push({
        role: 'user',
        parts: [{ text: 'Tool ' + (m.name || '') + ' result: ' + m.content }]
      });
      return;
    }
    contents.push({ role: role, parts: [{ text: String(m.content || '') }] });
  });
  if (file && file.buffer && (/image/.test(file.type || '') || /\.(png|jpe?g|webp|gif)$/.test(file.name || ''))) {
    const last = contents[contents.length - 1];
    last.parts.push({
      inline_data: {
        mime_type: /png/.test(file.name) ? 'image/png' : (/webp/.test(file.name) ? 'image/webp' : 'image/jpeg'),
        data: file.buffer.toString('base64')
      }
    });
  }
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(model || 'gemini-2.0-flash') +
      ':generateContent?key=' + encodeURIComponent(key),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: messages[0] && messages[0].content }] },
        contents: contents,
        tools: geminiTools(),
        generationConfig: { temperature: 0.2 }
      })
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error('Copilot model error: ' + trim(err, 200));
  }
  return res.json();
}

function geminiText(data) {
  const cand = data && data.candidates && data.candidates[0];
  const parts = cand && cand.content && cand.content.parts || [];
  const texts = [];
  const calls = [];
  parts.forEach(function (p) {
    if (p.text) texts.push(p.text);
    if (p.functionCall) {
      calls.push({
        name: p.functionCall.name,
        args: p.functionCall.args || {}
      });
    }
  });
  return { text: texts.join('\n').trim(), calls: calls };
}

async function runLlmTurn(store, admin, roomId, history, userText, file, runtime) {
  const fileNote = file
    ? ('Attached file: ' + (file.name || 'file') + (file.type === 'image' || /\.(png|jpe?g|webp|gif)$/.test(file.name || '') ? ' (image)' : ''))
    : '';
  const extraBodies = [];
  const provider = runtime && runtime.provider;
  const apiKey = runtime && runtime.apiKey;
  const model = runtime && runtime.model;
  if (!apiKey) return '';
  const name = await currentAiName(store);

  if (provider === 'anthropic') {
    let messages = toAnthropicMessages(history, userText, fileNote);
    const system = systemPrompt(admin, name);
    for (let i = 0; i < 5; i++) {
      const data = await callAnthropic(apiKey, model, system, messages);
      const content = (data && data.content) || [];
      const texts = [];
      const calls = [];
      content.forEach(function (p) {
        if (p && p.type === 'text' && p.text) texts.push(p.text);
        if (p && p.type === 'tool_use') calls.push(p);
      });
      if (!calls.length) {
        extraBodies.push(texts.join('\n'));
        break;
      }
      messages.push({ role: 'assistant', content: content });
      const results = [];
      for (let c = 0; c < calls.length; c++) {
        const call = calls[c];
        const result = await runTool(store, admin, roomId, call.name, call.input || {});
        if (result && result.body) extraBodies.push(result.body);
        results.push({
          type: 'tool_result',
          tool_use_id: call.id,
          content: JSON.stringify(result && result.body
            ? { ok: result.ok, summary: result.summary, error: result.error }
            : result)
        });
      }
      messages.push({ role: 'user', content: results });
    }
  } else if (provider === 'google') {
    let messages = toOpenAiMessages(admin, history, userText, fileNote, name);
    const data = await callGemini(apiKey, model, messages, file);
    const parsed = geminiText(data);
    for (let i = 0; i < (parsed.calls || []).length && i < 5; i++) {
      const call = parsed.calls[i];
      const result = await runTool(store, admin, roomId, call.name, call.args);
      if (result && result.body) extraBodies.push(result.body);
      messages.push({
        role: 'tool',
        name: call.name,
        content: JSON.stringify(result && result.body ? { ok: result.ok, summary: result.summary, error: result.error } : result)
      });
    }
    if (parsed.calls && parsed.calls.length) {
      const data2 = await callGemini(apiKey, model, messages, null);
      const parsed2 = geminiText(data2);
      extraBodies.push(parsed2.text || '');
    } else {
      extraBodies.push(parsed.text || '');
    }
  } else {
    let messages = toOpenAiMessages(admin, history, userText, fileNote, name);
    for (let i = 0; i < 5; i++) {
      const data = await callOpenAi(apiKey, model, messages, openaiTools());
      const choice = data && data.choices && data.choices[0] && data.choices[0].message;
      if (!choice) break;
      const calls = choice.tool_calls || [];
      if (!calls.length) {
        extraBodies.push(choice.content || '');
        break;
      }
      messages.push(choice);
      for (let c = 0; c < calls.length; c++) {
        const call = calls[c];
        const fn = call.function || {};
        let args = {};
        try { args = JSON.parse(fn.arguments || '{}'); } catch (e) { args = {}; }
        const result = await runTool(store, admin, roomId, fn.name, args);
        if (result && result.body) extraBodies.push(result.body);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          name: fn.name,
          content: JSON.stringify(result && result.body ? { ok: result.ok, summary: result.summary, error: result.error } : result)
        });
      }
    }
  }
  const seen = {};
  const parts = extraBodies.map(function (s) { return String(s || '').trim(); }).filter(function (s) {
    if (!s || seen[s]) return false;
    seen[s] = true;
    return true;
  });
  return parts.join('\n\n').trim();
}

async function replyToChat(store, admin, room, userMessage) {
  const roomId = room && room.id;
  if (!roomId) return;
  const key = String(roomId);
  const prev = queues.get(key) || Promise.resolve();
  const next = prev.then(function () {
    return replyOnce(store, admin, room, userMessage);
  }).catch(function (err) {
    console.error('copilot reply', err);
    return store.appendCopilotMessage(
      admin,
      roomId,
      'I could not finish that: ' + (err.message || 'something went wrong') + '.'
    );
  });
  queues.set(key, next);
  return next;
}

async function replyOnce(store, admin, room, userMessage) {
  const roomId = room.id;
  const text = String((userMessage && userMessage.body) || '').trim();
  await store.logCopilotAudit(admin, roomId, 'chat', { body: trim(text, 400) });

  if (wantsLowStockPo(text)) {
    const vendor = vendorHintFromText(text);
    const result = await draftLowStockPo(store, admin, roomId, vendor);
    if (result && result.body) {
      await store.appendCopilotMessage(admin, roomId, result.body);
      return;
    }
    if (result && result.error) {
      await store.appendCopilotMessage(admin, roomId, result.error + (result.hint ? ('\n' + result.hint) : ''));
      return;
    }
  }

  const parsed = await maybeParseAttachment(store, admin, roomId, userMessage, text);
  if (typeof parsed === 'string' && parsed) {
    await store.appendCopilotMessage(admin, roomId, parsed);
    return;
  }

  if (!(await llmReady(store))) {
    if (parsed) return;
    await store.appendCopilotMessage(admin, roomId, NO_KEY_COPY);
    return;
  }

  const packed = await store.listChatMessages(admin, roomId, { limit: HISTORY });
  const history = (packed && packed.messages) || [];
  const file = await readAttachment(userMessage);
  const runtime = await chatAi.resolveRuntime(store, 'copilot');
  let reply = await runLlmTurn(store, admin, roomId, history, text, file, runtime);
  if (!reply) {
    reply = 'I did not have a draft to send. Ask me to look something up, or to prepare a PO, invoice, or inventory item for review.';
  }
  if (reply.length > BODY_MAX) reply = reply.slice(0, BODY_MAX - 1) + '…';
  await store.appendCopilotMessage(admin, roomId, reply);
}

async function discardDraft(store, admin, token) {
  const draft = await store.getCopilotDraft(admin, token);
  if (!draft) throw httpError(404, 'Draft not found.');
  if (Number(draft.userId) !== Number(admin.id)) throw httpError(403, 'That draft is not yours.');
  await store.resolveCopilotDraft(admin, token, 'discarded', null);
  await store.logCopilotAudit(admin, draft.roomId, 'discard', { token: token });
  return { ok: true };
}

async function getDraft(store, admin, token) {
  const draft = await store.getCopilotDraft(admin, token);
  if (!draft) throw httpError(404, 'Draft not found.');
  if (Number(draft.userId) !== Number(admin.id)) throw httpError(403, 'That draft is not yours.');
  return draft;
}

module.exports = {
  WELCOME,
  welcomeMessage,
  llmConfigured,
  llmReady,
  replyToChat,
  discardDraft,
  getDraft,
  draftLowStockPo
};
