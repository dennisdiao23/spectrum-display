/**
 * Push priced buy-mode SKUs into Shopify and save variant IDs.
 * Street/MAP only — never dealer net, FOB, or warehouse cost.
 * Does not track Shopify inventory; our store catalog still gates Add to cart.
 */

const shopStore = require('./shop-store');
const dbUtil = require('./db');

const API_VERSION = '2024-10';

function adminToken() {
  return String(process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || process.env.SHOPIFY_ADMIN_TOKEN || '').trim();
}

function isConfigured() {
  return !!(shopStore.shopHostname() && adminToken());
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function money(n) {
  return (Math.round(Number(n) * 100) / 100).toFixed(2);
}

function imageUrl(product) {
  const src = String((product && product.image) || '').trim();
  if (!src) return '';
  if (/^https?:\/\//i.test(src)) return src;
  return shopStore.wwwOrigin() + (src.charAt(0) === '/' ? src : '/' + src);
}

function skuOf(product) {
  const details = product.details && typeof product.details === 'object' ? product.details : {};
  return String(details.model || product.sku || product.name || product.id || '').trim();
}

function shopifyErrorMessage(data, status) {
  if (!data) return 'Shopify HTTP ' + status;
  if (typeof data.errors === 'string') return data.errors;
  if (data.errors) {
    try { return JSON.stringify(data.errors); } catch (e) { /* ignore */ }
  }
  if (data.error) return String(data.error);
  return 'Shopify HTTP ' + status;
}

async function shopifyFetch(pathname, method, body) {
  const shop = shopStore.shopHostname();
  const token = adminToken();
  if (!shop || !token) {
    const err = new Error('Shopify Admin is not set up on the server yet.');
    err.code = 'setup';
    err.status = 400;
    throw err;
  }
  let attempt = 0;
  while (attempt < 5) {
    attempt += 1;
    const res = await fetch('https://' + shop + '/admin/api/' + API_VERSION + pathname, {
      method: method || 'GET',
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 429) {
      const wait = Number(res.headers.get('Retry-After')) || 2;
      await sleep(Math.max(1, wait) * 1000);
      continue;
    }
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      const err = new Error(shopifyErrorMessage(data, res.status));
      err.status = res.status;
      throw err;
    }
    return data;
  }
  const err = new Error('Shopify rate limited. Try Sync again in a minute.');
  err.status = 429;
  throw err;
}

async function findProductByHandle(handle) {
  const data = await shopifyFetch('/products.json?handle=' + encodeURIComponent(handle) + '&limit=1', 'GET');
  const list = (data && data.products) || [];
  return list[0] || null;
}

async function findProductById(id) {
  const raw = String(id || '').replace(/\D/g, '');
  if (!raw) return null;
  try {
    const data = await shopifyFetch('/products/' + raw + '.json', 'GET');
    return (data && data.product) || null;
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

function firstVariant(shopifyProduct) {
  const vars = (shopifyProduct && shopifyProduct.variants) || [];
  return vars[0] || null;
}

function buildCreatePayload(product, price) {
  const handle = shopStore.storeHandleOf(product);
  const collection = shopStore.inferCollection(product);
  const col = shopStore.COLLECTION_BY_ID[collection];
  const img = imageUrl(product);
  const payload = {
    product: {
      title: String(product.name || handle),
      body_html: String(product.description || product.lead || '').trim(),
      vendor: String(product.brandName || product.brandId || ''),
      product_type: (col && col.label) || 'Controller',
      handle: handle,
      status: 'active',
      tags: [product.brandName, col && col.label].filter(Boolean).join(', '),
      variants: [{
        price: money(price),
        sku: skuOf(product),
        inventory_management: null,
        inventory_policy: 'continue',
        requires_shipping: true,
        taxable: true
      }]
    }
  };
  if (img && /^https:\/\//i.test(img)) payload.product.images = [{ src: img }];
  return payload;
}

function needsVariantUpdate(variant, price, sku) {
  if (!variant) return true;
  const samePrice = Number(variant.price) === Number(price);
  const sameSku = String(variant.sku || '') === String(sku || '');
  return !samePrice || !sameSku;
}

function detailsWithShopify(product, shopifyProduct) {
  const details = Object.assign({}, dbUtil.parseDetails({ details: product.details }));
  const variant = firstVariant(shopifyProduct);
  details.shopify_product_id = String((shopifyProduct && shopifyProduct.id) || '');
  details.shopify_variant_id = String((variant && variant.id) || '');
  details.shopify_handle = String((shopifyProduct && shopifyProduct.handle) || shopStore.storeHandleOf(product));
  details.shopify_sell = true;
  return details;
}

function isPricedBuySku(product) {
  if (!product || product.hidden) return false;
  if (shopStore.blockedFromStore(product)) return false;
  const collection = shopStore.inferCollection(product);
  const col = shopStore.COLLECTION_BY_ID[collection];
  if (!col || col.mode !== 'buy') return false;
  return shopStore.publicPrice(product, 'buy') > 0;
}

async function upsertShopifyProduct(product) {
  const price = shopStore.publicPrice(product, 'buy');
  const handle = shopStore.storeHandleOf(product);
  let remote = await findProductById(product.shopify_product_id || (product.details && product.details.shopify_product_id));
  if (!remote) remote = await findProductByHandle(handle);
  if (!remote) {
    const created = await shopifyFetch('/products.json', 'POST', buildCreatePayload(product, price));
    return created && created.product;
  }
  const variant = firstVariant(remote);
  const sku = skuOf(product);
  if (variant && needsVariantUpdate(variant, price, sku)) {
    await shopifyFetch('/variants/' + variant.id + '.json', 'PUT', {
      variant: { id: variant.id, price: money(price), sku: sku }
    });
    remote = await findProductById(remote.id) || remote;
  }
  return remote;
}

async function syncPricedBuyProducts(store) {
  if (!isConfigured()) {
    const err = new Error('Shopify Admin is not set up on the server yet.');
    err.code = 'setup';
    err.status = 400;
    throw err;
  }
  const products = await store.listProducts();
  const eligible = (products || []).filter(isPricedBuySku);
  const created = [];
  const updated = [];
  const errors = [];
  for (let i = 0; i < eligible.length; i += 1) {
    const product = eligible[i];
    try {
      const hadId = !!(product.shopify_variant_id || (product.details && product.details.shopify_variant_id));
      const remote = await upsertShopifyProduct(product);
      const variant = firstVariant(remote);
      if (!remote || !variant) {
        errors.push({ id: product.id, name: product.name, error: 'Shopify returned no variant.' });
        continue;
      }
      const details = detailsWithShopify(product, remote);
      await store.updateProductDetails(product.dbId, details);
      const row = { id: product.id, name: product.name, variantId: String(variant.id), handle: remote.handle };
      if (hadId) updated.push(row);
      else created.push(row);
    } catch (err) {
      errors.push({ id: product.id, name: product.name, error: err.message || String(err) });
    }
    if (i + 1 < eligible.length) await sleep(350);
  }
  return {
    ok: errors.length === 0,
    shop: shopStore.shopHostname(),
    eligible: eligible.length,
    created: created.length,
    updated: updated.length,
    failed: errors.length,
    products: created.concat(updated),
    errors: errors
  };
}

function status() {
  return {
    ok: true,
    configured: isConfigured(),
    shop: shopStore.shopHostname() || '',
    storeOrigin: shopStore.storeOrigin()
  };
}

module.exports = {
  isConfigured,
  status,
  isPricedBuySku,
  buildCreatePayload,
  money,
  syncPricedBuyProducts
};
