/**
 * Public US store catalog — flags live on existing products.details.
 * Never exposes dealer nets or on-hand integers.
 */

const COLLECTIONS = [
  { id: 'fine_pitch', slug: 'fine-pitch', label: 'Fine pitch', mode: 'configure' },
  { id: 'poster', slug: 'poster', label: 'Poster', mode: 'configure' },
  { id: 'fixed', slug: 'fixed', label: 'Fixed', mode: 'configure' },
  { id: 'rental', slug: 'rental', label: 'Rental Panel', mode: 'configure' },
  { id: 'outdoor', slug: 'outdoor', label: 'Outdoor', mode: 'configure' },
  { id: 'control', slug: 'control', label: 'Controller', mode: 'buy' },
  { id: 'spares', slug: 'spares', label: 'Spares', mode: 'buy' },
  { id: 'accessories', slug: 'accessories', label: 'Accessories', mode: 'buy' }
];

const COLLECTION_BY_ID = {};
const COLLECTION_BY_SLUG = {};
COLLECTIONS.forEach(function (c) {
  COLLECTION_BY_ID[c.id] = c;
  COLLECTION_BY_SLUG[c.slug] = c;
});

const LEAD_LABELS = {
  ships_azusa: 'Ships from Azusa',
  incoming: 'Incoming',
  built_to_order: 'Built to order',
  quote: 'Request quote'
};

const SUBTYPE_LABELS = {
  'all-in-one': 'Processors',
  sending: 'Senders',
  playback: 'Playback',
  'receiving-card': 'Spares',
  accessories: 'Accessories',
  fiber: 'Fiber',
  cable: 'Cables',
  case: 'Cases',
  mount: 'Mounts',
  module: 'Modules',
  psu: 'PSUs'
};

function asBool(value) {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'on';
}

function variantNumericId(raw) {
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return '';
  const m = s.match(/(\d{5,})\s*$/);
  return m ? m[1] : (/^\d+$/.test(s) ? s : '');
}

function shopHostname() {
  const raw = String(process.env.SHOPIFY_SHOP || 'n0eg5t-nw.myshopify.com').trim();
  return raw.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
}

function wwwOrigin() {
  return String(process.env.WWW_ORIGIN || 'https://www.spectrumdisplay.com').replace(/\/$/, '');
}

function storeOrigin() {
  return String(process.env.STORE_ORIGIN || 'https://store.spectrumdisplay.com').replace(/\/$/, '');
}

function isStoreHost(req) {
  const host = String((req && req.hostname) || '').toLowerCase().replace(/:\d+$/, '');
  return host === 'store.spectrumdisplay.com' || host === 'store.localhost' || host.indexOf('store.') === 0;
}

function blockedFromStore(product) {
  const brand = String((product && product.brandId) || '').toLowerCase();
  const name = String((product && product.name) || '').toLowerCase();
  if (brand === 'element' || /\belement\b/.test(name)) return true;
  if (brand === 'diao' || /\bdiao\b/.test(name)) return true;
  if (/\bmicroled\b|\bmicro-led\b|\bhome tv\b/.test(name)) return true;
  return false;
}

function detailsOf(product) {
  const d = product && product.details;
  return d && typeof d === 'object' && !Array.isArray(d) ? d : {};
}

function inferCollection(product) {
  const details = detailsOf(product);
  const raw = String(details.store_collection || product.store_collection || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (raw === 'hidden') return 'hidden';
  if (COLLECTION_BY_ID[raw]) return raw;
  const subtype = String(details.subtype || product.subtype || '').toLowerCase();
  const type = String(product.type || '').toLowerCase();
  const blob = (subtype + ' ' + (product.id || '') + ' ' + (product.name || '') + ' ' + (details.family || '')).toLowerCase();
  if (type === 'control' || subtype || product.brandId === 'novastar') {
    if (subtype === 'receiving-card' || details.replacementOnly || /receiving/.test(blob)) return 'spares';
    if (subtype === 'accessories' || subtype === 'fiber' || subtype === 'cable' || subtype === 'case' || subtype === 'mount') return 'accessories';
    if (/module|psu|power supply/.test(blob) && /spare|replacement/.test(blob)) return 'spares';
    if (/fiber converter|cvt\d|mfn300|mon300|ns060|mth310|dis-300/.test(blob)) return 'accessories';
    return 'control';
  }
  if (/cable|flight case|mount|clamp|connector/.test(blob)) return 'accessories';
  if (type === 'rental') return 'rental';
  if (type === 'outdoor') return 'outdoor';
  const cats = (product.cats || []).join(' ').toLowerCase();
  if (type === 'poster' || /\bposter/.test(cats + ' ' + blob)) return 'poster';
  const pitches = Array.isArray(product.pitches) ? product.pitches.map(Number).filter(function (n) { return n > 0; }) : [];
  const minPitch = pitches.length ? Math.min.apply(null, pitches) : 99;
  if (minPitch <= 1.56 || /\bcob\b|fine.?pitch/.test(cats + ' ' + blob)) return 'fine_pitch';
  return 'fixed';
}

function collectionMode(id) {
  return (COLLECTION_BY_ID[id] && COLLECTION_BY_ID[id].mode) || 'configure';
}

function parseVariants(details) {
  const out = [];
  const raw = details.shopify_variants;
  if (Array.isArray(raw)) {
    raw.forEach(function (row) {
      const id = variantNumericId(row && (row.id || row.variant_id || row.shopify_variant_id));
      if (!id) return;
      out.push({ id: id, title: String((row && row.title) || 'Default').trim() || 'Default' });
    });
  }
  if (!out.length) {
    const one = variantNumericId(details.shopify_variant_id);
    if (one) out.push({ id: one, title: 'Default' });
  }
  return out;
}

function mappedQty(stockByProduct, dbId) {
  const pitches = stockByProduct && stockByProduct[String(dbId)];
  if (!pitches || typeof pitches !== 'object') return null;
  const keys = Object.keys(pitches);
  if (!keys.length) return null;
  let total = 0;
  keys.forEach(function (k) {
    total += Math.max(0, Number(pitches[k] && pitches[k].qty) || 0);
  });
  return total;
}

function publicPrice(product, mode) {
  if (mode !== 'buy') return 0;
  const details = detailsOf(product);
  const n = Number(details.priceEach != null ? details.priceEach : product.priceEach);
  return n > 0 ? n : 0;
}

function specChips(product, mode) {
  const details = detailsOf(product);
  const chips = [];
  if (mode === 'buy') {
    chips.push('Sold each');
    if (details.family) chips.push(String(details.family));
    else if (details.subtype && SUBTYPE_LABELS[details.subtype]) chips.push(SUBTYPE_LABELS[details.subtype]);
    if (details.maxPixels) chips.push((Number(details.maxPixels) / 1e6).toFixed(1).replace(/\.0$/, '') + 'M px');
    if (details.outputs) chips.push(String(details.outputs).split('·')[0].trim());
  } else {
    const pitches = product.pitches || [];
    if (pitches.length) {
      chips.push(
        pitches[0] + (pitches.length > 1 ? '–' + pitches[pitches.length - 1] : '') + ' mm'
      );
    }
    if (product.type) chips.push(String(product.type));
    chips.push('Quote');
  }
  return chips.filter(Boolean).slice(0, 3);
}

function toPublicCard(product, opts) {
  opts = opts || {};
  const details = detailsOf(product);
  const collection = inferCollection(product);
  if (collection === 'hidden') return null;
  const col = COLLECTION_BY_ID[collection];
  if (!col) return null;
  const mode = col.mode;
  const variants = parseVariants(details);
  const shopifySell = asBool(details.shopify_sell != null ? details.shopify_sell : product.shopify_sell);
  const featured = asBool(details.store_featured != null ? details.store_featured : product.store_featured);
  let lead = String(details.store_lead || product.store_lead || '').toLowerCase();
  if (!LEAD_LABELS[lead]) lead = mode === 'buy' ? 'ships_azusa' : 'quote';
  const qty = mappedQty(opts.stock, product.dbId);
  const mappedOut = qty === 0;
  if (shopifySell && mappedOut && lead !== 'built_to_order') lead = 'quote';
  const shop = opts.shop || '';
  const canCart = mode === 'buy'
    && shopifySell
    && variants.length > 0
    && !!shop
    && (!mappedOut || lead === 'built_to_order');
  const handle = String(details.shopify_handle || product.shopify_handle || product.id || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') || String(product.id || product.dbId);
  const replacementOnly = !!(details.replacementOnly || details.subtype === 'receiving-card' || collection === 'spares' && details.subtype === 'receiving-card');
  const price = publicPrice(product, mode);
  return {
    id: product.id,
    dbId: product.dbId,
    handle: handle,
    name: product.name,
    sku: details.model || product.id,
    brandId: product.brandId,
    brandName: product.brandName,
    description: String(product.lead || product.description || '').trim(),
    image: product.image || '',
    gallery: Array.isArray(product.gallery) ? product.gallery : [],
    collection: collection,
    collectionSlug: col.slug,
    mode: mode,
    featured: featured,
    lead: lead,
    leadLabel: LEAD_LABELS[lead],
    subtype: details.subtype || '',
    subtypeLabel: SUBTYPE_LABELS[details.subtype] || '',
    replacementOnly: replacementOnly || details.subtype === 'receiving-card',
    shopifySell: shopifySell,
    variants: canCart || (mode === 'buy' && variants.length) ? variants.map(function (v) { return { id: v.id, title: v.title }; }) : [],
    hasOptions: variants.length > 1,
    canAddToCart: canCart,
    price: price,
    priceLabel: mode === 'buy' ? (price ? ('$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : '') : '',
    chips: specChips(product, mode),
    pitches: product.pitches || [],
    type: product.type || '',
    family: details.family || '',
    outputs: details.outputs || '',
    inputs: details.inputs || '',
    features: Array.isArray(details.features) ? details.features : (product.features || []),
    bestFor: details.bestFor || '',
    configureUrl: wwwOrigin() + '/led-wall-calculator?brand=' + encodeURIComponent(product.brandId || '') + '&series=' + encodeURIComponent(product.id || '')
  };
}

function receivedThisWeek(receipts) {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return (receipts || []).some(function (row) {
    const stamp = Date.parse(row.receiptDate || row.receipt_date || row.createdAt || row.created_at || '');
    return Number.isFinite(stamp) && stamp >= cutoff;
  });
}

async function buildCatalog(store) {
  const shop = shopHostname();
  const [products, stock, receipts] = await Promise.all([
    store.listProducts(),
    store.getCatalogStock().catch(function () { return {}; }),
    store.listReceiptShipments ? store.listReceiptShipments().catch(function () { return []; }) : Promise.resolve([])
  ]);
  const cards = [];
  (products || []).forEach(function (p) {
    if (!p || p.hidden) return;
    if (blockedFromStore(p)) return;
    const card = toPublicCard(p, { stock: stock, shop: shop });
    if (card) cards.push(card);
  });
  const counts = {};
  COLLECTIONS.forEach(function (c) { counts[c.slug] = 0; });
  cards.forEach(function (c) { counts[c.collectionSlug] = (counts[c.collectionSlug] || 0) + 1; });
  return {
    shop: shop,
    checkoutReady: !!shop,
    wwwOrigin: wwwOrigin(),
    storeOrigin: storeOrigin(),
    receivedThisWeek: receivedThisWeek(receipts),
    collections: COLLECTIONS.map(function (c) {
      return { id: c.id, slug: c.slug, label: c.label, mode: c.mode, count: counts[c.slug] || 0 };
    }),
    products: cards
  };
}

function storeHandleOf(product) {
  const details = detailsOf(product);
  return String(details.shopify_handle || product.shopify_handle || product.id || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') || String(product.id || product.dbId || '');
}

function toAdminStoreItem(product) {
  if (!product) return null;
  const details = detailsOf(product);
  const storedCollection = String(details.store_collection || product.store_collection || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  const collection = inferCollection(product);
  const blocked = blockedFromStore(product);
  const websiteHidden = !!product.hidden;
  const storeHidden = collection === 'hidden';
  const col = COLLECTION_BY_ID[collection];
  const featured = asBool(details.store_featured != null ? details.store_featured : product.store_featured);
  const shopifySell = asBool(details.shopify_sell != null ? details.shopify_sell : product.shopify_sell);
  const handle = storeHandleOf(product);
  let visibility = 'shown';
  let visibilityLabel = 'Shown';
  if (blocked) {
    visibility = 'blocked';
    visibilityLabel = 'Blocked';
  } else if (websiteHidden) {
    visibility = 'website_hidden';
    visibilityLabel = 'Website hidden';
  } else if (storeHidden) {
    visibility = 'hidden';
    visibilityLabel = 'Hidden';
  }
  let collectionLabel = 'Auto';
  if (storeHidden) collectionLabel = 'Hidden';
  else if (col) collectionLabel = storedCollection ? col.label : col.label + ' (Auto)';
  return {
    dbId: product.dbId,
    id: product.id,
    name: product.name,
    brandId: product.brandId,
    brandName: product.brandName,
    type: product.type,
    image: product.image || '',
    hidden: websiteHidden,
    store_collection: storedCollection === 'hidden' || COLLECTION_BY_ID[storedCollection] ? storedCollection : '',
    store_featured: featured,
    store_lead: String(details.store_lead || product.store_lead || ''),
    shopify_sell: shopifySell,
    shopify_variant_id: String(details.shopify_variant_id || product.shopify_variant_id || ''),
    shopify_product_id: String(details.shopify_product_id || product.shopify_product_id || ''),
    shopify_handle: String(details.shopify_handle || product.shopify_handle || ''),
    collection: collection,
    collectionLabel: collectionLabel,
    collectionMode: col ? col.mode : '',
    storeBlocked: blocked,
    storeShown: visibility === 'shown',
    storeVisibility: visibility,
    storeVisibilityLabel: visibilityLabel,
    featured: featured,
    handle: handle,
    storePath: '/store/products/' + handle
  };
}

function applyStoreFlags(details, body) {
  const next = details && typeof details === 'object' ? details : {};
  if (!body) return next;
  if (Object.prototype.hasOwnProperty.call(body, 'shopify_sell') || Object.prototype.hasOwnProperty.call(body, 'shopifySell')) {
    next.shopify_sell = asBool(body.shopify_sell != null ? body.shopify_sell : body.shopifySell);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'store_featured') || Object.prototype.hasOwnProperty.call(body, 'storeFeatured')) {
    next.store_featured = asBool(body.store_featured != null ? body.store_featured : body.storeFeatured);
  }
  ['shopify_product_id', 'shopify_variant_id', 'shopify_handle', 'store_collection', 'store_lead', 'store_icon'].forEach(function (key) {
    const camel = key.replace(/_([a-z])/g, function (_, ch) { return ch.toUpperCase(); });
    if (Object.prototype.hasOwnProperty.call(body, key) || Object.prototype.hasOwnProperty.call(body, camel)) {
      next[key] = String(body[key] != null ? body[key] : body[camel] || '').trim();
    }
  });
  if (next.store_collection) {
    next.store_collection = next.store_collection.toLowerCase().replace(/-/g, '_');
    if (next.store_collection !== 'hidden' && !COLLECTION_BY_ID[next.store_collection]) next.store_collection = '';
  }
  if (Object.prototype.hasOwnProperty.call(body, 'store_hidden') || Object.prototype.hasOwnProperty.call(body, 'storeHidden')) {
    if (asBool(body.store_hidden != null ? body.store_hidden : body.storeHidden)) {
      next.store_collection = 'hidden';
    } else if (String(next.store_collection || '') === 'hidden') {
      next.store_collection = '';
    }
  }
  if (next.store_lead && !LEAD_LABELS[next.store_lead]) next.store_lead = '';
  if (Object.prototype.hasOwnProperty.call(body, 'shopify_variants')) {
    try {
      next.shopify_variants = typeof body.shopify_variants === 'string'
        ? JSON.parse(body.shopify_variants || '[]')
        : body.shopify_variants;
    } catch (e) {
      /* keep previous */
    }
  }
  return next;
}

module.exports = {
  COLLECTIONS,
  COLLECTION_BY_SLUG,
  shopHostname,
  wwwOrigin,
  storeOrigin,
  isStoreHost,
  blockedFromStore,
  inferCollection,
  buildCatalog,
  applyStoreFlags,
  toAdminStoreItem,
  asBool,
  variantNumericId
};
