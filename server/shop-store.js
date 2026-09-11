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
  ships_novastar: 'Ships from NovaStar',
  ships_gloshine: 'Ships from Gloshine',
  incoming: 'Incoming',
  built_to_order: 'Built to order',
  quote: 'Request quote'
};

/** Warehouse origin stays on the product for staff; do not show "Ships from …" on the public store. */
function publicLeadLabel(lead) {
  if (!lead || String(lead).indexOf('ships_') === 0) return '';
  return LEAD_LABELS[lead] || '';
}

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

function isLocalHostname(host) {
  const h = String(host || '').toLowerCase().replace(/:\d+$/, '');
  return h === 'localhost' || h === '127.0.0.1' || h === '::1';
}

function storeProductPath(handle) {
  const h = String(handle || '').replace(/^\/+|\/+$/g, '');
  if (process.env.NODE_ENV === 'production') return storeOrigin() + '/products/' + h;
  return '/store/products/' + h;
}

function wwwStoreRedirectTarget(req) {
  if (!req || isStoreHost(req) || isLocalHostname(req.hostname)) return '';
  if (process.env.NODE_ENV !== 'production') return '';
  if (String(process.env.STORE_HOST_REDIRECT || '1') === '0') return '';
  const p = String(req.path || '');
  let rest = '';
  if (p === '/store.html') rest = '/';
  else if (p === '/store' || p === '/store/') rest = '/';
  else if (p.indexOf('/store/') === 0) rest = p.slice('/store'.length);
  else return '';
  const qsIndex = String(req.url || '').indexOf('?');
  const qs = qsIndex >= 0 ? req.url.slice(qsIndex) : '';
  return storeOrigin() + rest + qs;
}

function blockedFromStore(product) {
  const brand = String((product && product.brandId) || '').toLowerCase();
  const name = String((product && product.name) || '').toLowerCase();
  if (brand === 'element' || /\belement\b/.test(name)) return true;
  if (brand === 'diao' || /\bdiao\b/.test(name)) return true;
  if (/\bmicroled\b|\bmicro-led\b|\bhome tv\b/.test(name)) return true;
  return false;
}

function slugifyId(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function mmToMeters(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n > 20 ? n / 1000 : n;
}

/** Independent of website `products.hidden`. Missing key = listed (legacy catalog). */
function isStoreListed(product) {
  if (!product) return false;
  const details = detailsOf(product);
  if (Object.prototype.hasOwnProperty.call(details, 'store_listed')) {
    return asBool(details.store_listed);
  }
  if (Object.prototype.hasOwnProperty.call(product, 'store_listed')) {
    return asBool(product.store_listed);
  }
  return true;
}

function catalogTypeFromInventory(item) {
  const cat = String((item && item.category) || '').toLowerCase();
  const panel = String((item && item.panelType) || '').toLowerCase();
  const blob = (cat + ' ' + panel + ' ' + ((item && item.name) || '') + ' ' + ((item && item.sku) || '')).toLowerCase();
  if (cat === 'receiving card' || cat === 'spare' || /\breceiving card|\bspares?\b/.test(blob)) {
    return {
      type: 'control',
      collection: 'spares',
      subtype: /receiving/.test(blob) ? 'receiving-card' : '',
      cats: ['control', 'spares'].concat(/receiving/.test(blob) ? ['receiving-cards'] : [])
    };
  }
  if (cat === 'accessory' || /\baccessor/.test(blob)) {
    return { type: 'control', collection: 'accessories', subtype: 'accessories', cats: ['control', 'accessories'] };
  }
  if (
    cat === 'control' ||
    cat === 'processor' ||
    String((item && item.brandId) || '').toLowerCase() === 'novastar' ||
    /\bcontroller|\bprocessor|\bnovastar|\bcontrol\b/.test(blob)
  ) {
    return { type: 'control', collection: 'control', subtype: '', cats: ['control'] };
  }
  if (/\brental/.test(blob)) return { type: 'rental', collection: 'rental', subtype: '', cats: ['rental'] };
  if (/\boutdoor/.test(blob)) return { type: 'outdoor', collection: 'outdoor', subtype: '', cats: ['outdoor'] };
  if (/\bposter/.test(blob)) return { type: 'poster', collection: 'poster', subtype: '', cats: ['poster'] };
  return { type: 'Fixed', collection: '', subtype: '', cats: [] };
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
    leadLabel: publicLeadLabel(lead),
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
    if (!p || !isStoreListed(p)) return;
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
  const listed = isStoreListed(product);
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
    store_listed: listed,
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
    storePath: storeProductPath(handle)
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
  if (Object.prototype.hasOwnProperty.call(body, 'store_listed') || Object.prototype.hasOwnProperty.call(body, 'storeListed')) {
    next.store_listed = asBool(body.store_listed != null ? body.store_listed : body.storeListed);
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

function mappedProductsForItem(item, products) {
  const maps = (item && item.maps) || [];
  const byId = {};
  (products || []).forEach(function (p) {
    if (p && p.dbId != null) byId[String(p.dbId)] = p;
  });
  const out = [];
  const seen = {};
  maps.forEach(function (m) {
    const id = String(m.productId != null ? m.productId : m.product_id || '');
    if (!id || seen[id]) return;
    seen[id] = true;
    if (byId[id]) out.push(byId[id]);
  });
  return out;
}

function inventoryListingOptions(items, products) {
  return (items || []).map(function (item) {
    const mapped = mappedProductsForItem(item, products);
    const listed = mapped.find(isStoreListed) || null;
    const primary = listed || mapped[0] || null;
    return {
      id: item.id,
      sku: item.sku || '',
      name: item.name || '',
      brandId: item.brandId || '',
      brandName: item.brandName || '',
      category: item.category || '',
      pitch: item.pitch || '',
      pitchLabel: item.pitchLabel || '',
      image: item.image || '',
      price: Number(item.price) || 0,
      mapped: mapped.length > 0,
      listed: !!listed,
      listedProductId: listed ? listed.dbId : null,
      listedProductName: listed ? listed.name : '',
      mappedProductId: primary ? primary.dbId : null,
      mappedProductName: primary ? primary.name : ''
    };
  });
}

async function uniqueSeriesId(store, brandId, preferred) {
  const base = slugifyId(preferred) || 'inv-item';
  let candidate = base;
  let n = 2;
  while (await store.getProductByBrandSeries(brandId, candidate)) {
    candidate = (base.slice(0, 40) + '-' + n).slice(0, 48);
    n += 1;
    if (n > 80) {
      candidate = ('inv-' + Date.now()).slice(0, 48);
      break;
    }
  }
  return candidate;
}

async function createCatalogFromInventory(store, item) {
  const kind = catalogTypeFromInventory(item);
  const brandId = slugifyId(item.brandId) || slugifyId(item.brandName) || 'inventory';
  const brandName = String(item.brandName || item.brandId || 'Inventory').trim() || brandId;
  await store.ensureBrand(brandId, brandName);
  const seriesId = await uniqueSeriesId(store, brandId, item.sku || item.name || ('inv-' + item.id));
  const pitchNum = Number(item.pitch);
  const pitches = (kind.type === 'control')
    ? []
    : (Number.isFinite(pitchNum) && pitchNum > 0 ? [pitchNum] : []);
  const details = {
    store_listed: true,
    model: String(item.sku || '').trim()
  };
  if (kind.cats && kind.cats.length) details.cats = kind.cats.slice();
  if (kind.collection) details.store_collection = kind.collection;
  if (kind.type === 'control') {
    details.subtype = kind.subtype || '';
    details.priceEach = Number(item.price) || 0;
    if (!details.cats || !details.cats.length) details.cats = ['control'];
  }
  const product = await store.insertProduct({
    brandId: brandId,
    seriesId: seriesId,
    name: String(item.name || item.sku || 'Store item').trim() || 'Store item',
    pitches: pitches,
    price: Number(item.price) || 0,
    weight: Number(item.weight) || 0,
    powerAvg: 0,
    powerMax: 0,
    cabinetW: mmToMeters(item.panelW),
    cabinetH: mmToMeters(item.panelH),
    type: kind.type,
    description: String(item.description || '').trim(),
    badge: '',
    image: item.image || '',
    gallery: [],
    details: details
  });
  if (product && product.dbId) {
    await store.setProductHidden(product.dbId, true);
    await store.setProductInventoryMaps(product.dbId, [{
      pitch: item.pitch || '',
      itemId: item.id
    }]);
    return store.getProduct(product.dbId);
  }
  return product;
}

async function addListingFromInventory(store, inventoryId) {
  const detail = await store.getInventoryItem(inventoryId);
  const item = detail && detail.item;
  if (!item) {
    const err = new Error('Inventory item not found.');
    err.status = 404;
    throw err;
  }
  const products = await store.listProducts();
  const mapped = mappedProductsForItem(item, products);
  const listed = mapped.find(isStoreListed);
  if (listed) {
    return { product: toAdminStoreItem(listed), created: false, alreadyListed: true };
  }
  if (mapped[0]) {
    const details = Object.assign({}, detailsOf(mapped[0]), { store_listed: true });
    if (String(details.store_collection || '') === 'hidden') details.store_collection = '';
    const product = await store.updateProductDetails(mapped[0].dbId, details);
    return { product: toAdminStoreItem(product), created: false, alreadyListed: false };
  }
  const product = await createCatalogFromInventory(store, item);
  return { product: toAdminStoreItem(product), created: true, alreadyListed: false };
}

async function unlistStoreProduct(store, productId) {
  const existing = await store.getRawProduct(productId);
  if (!existing) return null;
  const dbUtil = require('./db');
  const details = applyStoreFlags(Object.assign({}, dbUtil.parseDetails(existing)), { store_listed: false });
  const product = await store.updateProductDetails(productId, details);
  return product ? toAdminStoreItem(product) : null;
}

module.exports = {
  COLLECTIONS,
  COLLECTION_BY_ID,
  COLLECTION_BY_SLUG,
  shopHostname,
  wwwOrigin,
  storeOrigin,
  isStoreHost,
  wwwStoreRedirectTarget,
  storeProductPath,
  blockedFromStore,
  isStoreListed,
  catalogTypeFromInventory,
  inferCollection,
  publicPrice,
  storeHandleOf,
  buildCatalog,
  applyStoreFlags,
  toAdminStoreItem,
  inventoryListingOptions,
  addListingFromInventory,
  unlistStoreProduct,
  asBool,
  variantNumericId
};
