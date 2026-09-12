/**
 * Company → Website → Products: card-list editor for catalog products, brands, and pictures.
 */
(function (global) {
  'use strict';

  var H = {
    api: null,
    esc: function (v) {
      return String(v == null ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    },
    canEdit: function () { return true; },
    isMobile: function () { return false; },
    onChanged: null,
    fitTabs: null
  };

  var TAB_MAX = 12;
  var PRODUCT_FIELD_IDS = [
    'wc-product-id', 'wc-brand-id', 'wc-brand-name', 'wc-name', 'wc-series', 'wc-type', 'wc-subtype',
    'wc-badge', 'wc-cats', 'wc-lead', 'wc-description', 'wc-spec', 'wc-pitches', 'wc-price',
    'wc-weight', 'wc-power-avg', 'wc-power-max', 'wc-cab-w', 'wc-cab-h', 'wc-family', 'wc-model',
    'wc-max-pixels', 'wc-outputs', 'wc-inputs', 'wc-best-for', 'wc-hidden',
    'wc-shopify-sell', 'wc-store-featured', 'wc-store-collection', 'wc-store-lead',
    'wc-shopify-variant-id', 'wc-shopify-product-id', 'wc-shopify-handle'
  ];

  var S = {
    mode: 'products',
    pane: 'edit',
    products: [],
    brands: [],
    selected: '',
    creating: false,
    gallery: [],
    bound: false,
    loading: false,
    openTabs: [],
    activeTab: 'overview',
    tabCache: {},
    tabLabels: {},
    inventoryItems: [],
    inventoryLoaded: false,
    mapGen: 0
  };

  var TYPES = ['Fixed', 'Rental', 'Outdoor', 'Poster', 'Creative', 'All-in-one', 'Transparent', 'control'];
  var SUBTYPES = [
    ['all-in-one', 'All-in-one processor'],
    ['sending', 'Sending box'],
    ['playback', 'Playback / NovaLCT'],
    ['receiving-card', 'Receiving card (spare)'],
    ['accessories', 'Accessories / fiber']
  ];

  function $(id) { return document.getElementById(id); }

  function esc(v) { return H.esc(v); }

  function canEdit() {
    return typeof H.canEdit === 'function' ? !!H.canEdit('website') : true;
  }

  function canEditInventory() {
    return typeof H.canEdit === 'function' ? !!H.canEdit('inventory') : false;
  }

  function mediaSrc(src) {
    var s = String(src || '');
    if (!s) return '';
    if (/^(https?:|data:|\/)/i.test(s)) return s;
    return '/' + s;
  }

  function showError(msg) {
    var el = $('wc-error');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('hidden', !msg);
  }

  function productById(id) {
    var sid = String(id || '');
    for (var i = 0; i < S.products.length; i += 1) {
      if (String(S.products[i].dbId) === sid) return S.products[i];
    }
    return null;
  }

  function brandById(id) {
    var sid = String(id || '');
    for (var i = 0; i < S.brands.length; i += 1) {
      if (String(S.brands[i].id) === sid) return S.brands[i];
    }
    return null;
  }

  function productLiveUrl(p) {
    if (!p) return '/products';
    return '/products/' + encodeURIComponent(p.id);
  }

  function brandLiveUrl(b) {
    if (!b) return '/products';
    return '/products?brand=' + encodeURIComponent(b.id);
  }

  function galleryFor(p) {
    var urls = [];
    if (p && p.image) urls.push(p.image);
    ((p && p.gallery) || []).forEach(function (url) {
      if (url && urls.indexOf(url) === -1) urls.push(url);
    });
    return urls;
  }

  function isControl(p) {
    if (!p) return false;
    if (p.brandId === 'novastar' || p.type === 'control') return true;
    if (p.type) return false;
    return !!p.subtype;
  }

  function setModeButtons() {
    var wrap = $('control-section');
    if (!wrap) return;
    wrap.querySelectorAll('[data-wc-mode]').forEach(function (btn) {
      var on = btn.getAttribute('data-wc-mode') === S.mode;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    wrap.querySelectorAll('[data-wc-pane]').forEach(function (btn) {
      var on = btn.getAttribute('data-wc-pane') === S.pane;
      btn.classList.toggle('is-on', on);
    });
    var add = $('wc-add');
    if (add) {
      add.hidden = S.mode === 'pictures' || !canEdit();
      add.textContent = S.mode === 'brands' ? 'Add brand' : 'Add product';
    }
    syncRightChrome();
  }

  function showOverview() {
    stashActiveTab();
    S.activeTab = 'overview';
    S.creating = false;
    S.selected = '';
    S.pane = 'edit';
    setLiveLink('/products');
    refreshPreview('/products');
    setModeButtons();
    renderList();
    renderWcTabs();
  }

  function syncRightChrome() {
    var productTabs = S.mode === 'products';
    var onOverview = productTabs && S.activeTab === 'overview';
    var tabBar = $('wc-tab-bar');
    var overview = $('wc-overview-panel');
    var editor = $('wc-editor');
    var preview = $('wc-preview');
    if (tabBar) tabBar.classList.toggle('hidden', !productTabs);
    if (overview) overview.classList.toggle('hidden', !onOverview || S.pane === 'preview');
    if (editor) editor.classList.toggle('hidden', onOverview || S.pane === 'preview');
    if (preview) preview.classList.toggle('hidden', S.pane !== 'preview');
  }

  function tabLabel(id) {
    if (id === 'new') return S.tabLabels.new || 'New product';
    if (S.tabLabels[id]) return S.tabLabels[id];
    var p = productById(id);
    return (p && p.name) || 'Product';
  }

  function fitWcTabs() {
    if (typeof H.fitTabs === 'function') {
      H.fitTabs('wc-tab-strip', 'data-wc-tab-id');
      return;
    }
    var strip = $('wc-tab-strip');
    if (!strip) return;
    var tabs = Array.prototype.slice.call(strip.querySelectorAll('.inv-browser-tab'));
    tabs.forEach(function (tab) {
      tab.style.flex = '';
      tab.style.width = '';
      tab.style.minWidth = '';
      tab.style.maxWidth = '';
    });
  }

  function renderWcTabs() {
    var strip = $('wc-tab-strip');
    if (!strip) return;
    var html = '<button type="button" class="inv-browser-tab' +
      (S.activeTab === 'overview' ? ' is-active' : '') +
      '" data-wc-tab-id="overview" role="tab" aria-selected="' + (S.activeTab === 'overview' ? 'true' : 'false') + '">' +
      '<span class="inv-browser-tab-label">Overview</span></button>';
    S.openTabs.forEach(function (id) {
      var active = String(S.activeTab) === String(id);
      html += '<button type="button" class="inv-browser-tab' + (active ? ' is-active' : '') +
        '" data-wc-tab-id="' + esc(id) + '" role="tab" aria-selected="' + (active ? 'true' : 'false') + '">' +
        '<span class="inv-browser-tab-label">' + esc(tabLabel(id)) + '</span>' +
        '<span class="inv-browser-tab-close" data-wc-tab-close="' + esc(id) + '" aria-label="Close tab" role="button" tabindex="-1">×</span></button>';
    });
    strip.innerHTML = html;
    fitWcTabs();
  }

  function readProductSnapshot() {
    var fields = {};
    PRODUCT_FIELD_IDS.forEach(function (id) {
      var el = $(id);
      if (!el) return;
      fields[id] = el.type === 'checkbox' ? el.checked : el.value;
    });
    return {
      fields: fields,
      gallery: S.gallery.slice(),
      features: collectFeatures(),
      maps: currentMapSelection()
    };
  }

  function applyProductSnapshot(snap) {
    if (!snap) return;
    if (snap.gallery) S.gallery = snap.gallery.slice();
    var wrap = $('wc-gallery');
    if (wrap) wrap.innerHTML = renderGalleryStrip(S.gallery);
    if (snap.fields) {
      Object.keys(snap.fields).forEach(function (id) {
        var el = $(id);
        if (!el) return;
        if (el.type === 'checkbox') el.checked = !!snap.fields[id];
        else el.value = snap.fields[id];
      });
    }
    if (snap.features) rebuildFeatures(snap.features);
    toggleTypeFields();
    S.pendingMaps = snap.maps || null;
  }

  function rebuildFeatures(features) {
    var host = $('wc-features');
    if (!host) return;
    var tmp = document.createElement('div');
    tmp.innerHTML = featuresHtml(features);
    var next = tmp.querySelector('#wc-features');
    if (next) host.parentNode.replaceChild(next, host);
  }

  function stashActiveTab() {
    if (S.mode !== 'products') return;
    if (!S.activeTab || S.activeTab === 'overview') return;
    if (!$('wc-product-form')) return;
    S.tabCache[String(S.activeTab)] = readProductSnapshot();
    var nameEl = $('wc-name');
    if (nameEl && String(nameEl.value || '').trim()) {
      S.tabLabels[String(S.activeTab)] = String(nameEl.value).trim();
    }
  }

  function fillProductEditor(id, opts) {
    opts = opts || {};
    S.creating = id === 'new';
    S.selected = S.creating ? '' : String(id || '');
    var snap = opts.skipCache ? null : S.tabCache[String(id)];
    if (S.creating) renderProductEditor(null, snap);
    else renderProductEditor(productById(S.selected), snap);
  }

  function activateWcTab(id, opts) {
    opts = opts || {};
    var sid = String(id || 'overview');
    if (sid === S.activeTab && !opts.force) {
      S.mode = 'products';
      setModeButtons();
      renderList();
      if (!opts.skipTabBar) renderWcTabs();
      return;
    }
    if (sid !== S.activeTab) stashActiveTab();
    S.mode = 'products';
    S.activeTab = sid;
    if (sid === 'overview') {
      S.creating = false;
      S.selected = '';
      setLiveLink('/products');
      refreshPreview('/products');
    } else {
      fillProductEditor(sid, opts);
    }
    setModeButtons();
    renderList();
    if (!opts.skipTabBar) renderWcTabs();
  }

  function openWcTab(id, opts) {
    opts = opts || {};
    var sid = String(id || 'new');
    if (sid === 'overview') {
      showOverview();
      return;
    }
    if (S.openTabs.indexOf(sid) === -1) {
      if (S.openTabs.length >= TAB_MAX) {
        var dropped = S.openTabs.shift();
        delete S.tabCache[dropped];
        delete S.tabLabels[dropped];
      }
      S.openTabs.push(sid);
    }
    activateWcTab(sid, opts);
  }

  function closeWcTab(id) {
    var sid = String(id);
    var idx = S.openTabs.indexOf(sid);
    if (idx === -1) return;
    if (String(S.activeTab) === sid) stashActiveTab();
    S.openTabs.splice(idx, 1);
    delete S.tabCache[sid];
    delete S.tabLabels[sid];
    if (String(S.activeTab) === sid) {
      if (S.openTabs.length) activateWcTab(S.openTabs[Math.min(idx, S.openTabs.length - 1)]);
      else showOverview();
    } else {
      renderList();
      renderWcTabs();
    }
  }

  function afterWcSave(product) {
    if (!product || !product.dbId) return;
    var newId = String(product.dbId);
    var oldId = S.activeTab === 'new' ? 'new' : String(S.selected || S.activeTab || '');
    if (oldId && oldId !== newId) {
      var idx = S.openTabs.indexOf(oldId);
      if (idx !== -1) S.openTabs[idx] = newId;
      else if (S.openTabs.indexOf(newId) === -1) S.openTabs.push(newId);
      delete S.tabCache[oldId];
      delete S.tabLabels[oldId];
    } else if (S.openTabs.indexOf(newId) === -1) {
      S.openTabs.push(newId);
    }
    S.activeTab = newId;
    S.creating = false;
    S.selected = newId;
    delete S.tabCache[newId];
    S.tabLabels[newId] = product.name || 'Product';
    renderProductEditor(productById(newId) || product, null);
    setModeButtons();
    renderList();
    renderWcTabs();
  }

  function setLiveLink(href) {
    var a = $('wc-open-live');
    if (!a) return;
    a.href = href || '#';
    a.classList.toggle('is-off', !href || href === '#');
  }

  function renderList() {
    var list = $('wc-list');
    if (!list) return;
    if (S.mode === 'brands') {
      list.innerHTML = S.brands.map(function (b) {
        var on = String(S.selected) === String(b.id) ? ' is-on' : '';
        var thumb = mediaSrc(b.logo || b.image);
        var photo = thumb
          ? '<img src="' + esc(thumb) + '" alt="">'
          : '<span class="wc-thumb-fallback">' + esc((b.name || '?').slice(0, 1)) + '</span>';
        return '<button type="button" class="wc-row' + on + '" data-wc-id="' + esc(b.id) + '">' +
          '<span class="wc-thumb">' + photo + '</span>' +
          '<span class="wc-row-copy">' +
            '<strong>' + esc(b.name) + '</strong>' +
            '<em>' + esc(b.tagline || (b.productCount + ' products')) +
              (b.hidden ? ' · Hidden' : '') + '</em>' +
          '</span></button>';
      }).join('') || '<p class="wc-empty">No brands yet.</p>';
      return;
    }
    if (S.mode === 'pictures') {
      var cards = [];
      S.products.forEach(function (p) {
        galleryFor(p).forEach(function (url, i) {
          cards.push(
            '<button type="button" class="wc-pic" data-wc-pic-id="' + esc(p.dbId) + '">' +
              '<img src="' + esc(mediaSrc(url)) + '" alt="">' +
              '<span>' + esc(p.name) + (i === 0 ? ' · Hero' : '') + '</span>' +
            '</button>'
          );
        });
      });
      list.innerHTML = cards.join('') || '<p class="wc-empty">No pictures on website products yet. Open a product and add photos.</p>';
      return;
    }
    list.innerHTML = S.products.map(function (p) {
      var on = String(S.activeTab) === String(p.dbId) ? ' is-on' : '';
      var thumb = mediaSrc(p.image || (p.gallery && p.gallery[0]) || '');
      var photo = thumb
        ? '<img src="' + esc(thumb) + '" alt="">'
        : '<span class="wc-thumb-fallback">' + esc((p.name || '?').slice(0, 1)) + '</span>';
      return '<button type="button" class="wc-row' + on + '" data-wc-id="' + esc(p.dbId) + '">' +
        '<span class="wc-thumb">' + photo + '</span>' +
        '<span class="wc-row-copy">' +
          '<strong>' + esc(p.name) + '</strong>' +
          '<em>' + esc(p.brandName || p.brandId) + ' · ' + esc(p.type || '') +
            (p.hidden ? ' · Hidden' : '') + '</em>' +
        '</span></button>';
    }).join('') || '<p class="wc-empty">No website products yet.</p>';
    if (S.openTabs.indexOf('new') !== -1) {
      list.insertAdjacentHTML('afterbegin',
        '<button type="button" class="wc-row' + (S.activeTab === 'new' ? ' is-on' : '') + '" data-wc-id="new">' +
          '<span class="wc-thumb"><span class="wc-thumb-fallback">+</span></span>' +
          '<span class="wc-row-copy"><strong>New product</strong><em>Not saved</em></span></button>'
      );
    }
  }

  function optionList(items, value) {
    return items.map(function (item) {
      var id = Array.isArray(item) ? item[0] : item;
      var label = Array.isArray(item) ? item[1] : item;
      var sel = String(id) === String(value || '') ? ' selected' : '';
      return '<option value="' + esc(id) + '"' + sel + '>' + esc(label) + '</option>';
    }).join('');
  }

  function field(id, label, inner, span) {
    return '<div class="' + (span ? 'wc-span' : '') + '"><label for="' + id + '">' + esc(label) + '</label>' + inner + '</div>';
  }

  function input(id, value, extra) {
    extra = extra || {};
    return '<input id="' + id + '" type="' + (extra.type || 'text') + '" value="' + esc(value || '') + '"' +
      (extra.placeholder ? ' placeholder="' + esc(extra.placeholder) + '"' : '') +
      (extra.step ? ' step="' + extra.step + '"' : '') +
      (extra.min != null ? ' min="' + extra.min + '"' : '') +
      (extra.required ? ' required' : '') + '>';
  }

  function textarea(id, value, rows) {
    return '<textarea id="' + id + '" rows="' + (rows || 3) + '">' + esc(value || '') + '</textarea>';
  }

  function renderGalleryStrip(urls) {
    return (urls || []).map(function (url, i) {
      return '<div class="wc-shot' + (i === 0 ? ' is-hero' : '') + '" data-wc-shot="' + i + '">' +
        '<img src="' + esc(mediaSrc(url)) + '" alt="">' +
        '<span class="wc-shot-label">' + (i === 0 ? 'Hero' : String(i + 1)) + '</span>' +
        '<span class="wc-shot-tools">' +
          '<button type="button" data-wc-shot-hero="' + i + '">Hero</button>' +
          '<button type="button" data-wc-shot-up="' + i + '"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
          '<button type="button" data-wc-shot-down="' + i + '"' + (i === urls.length - 1 ? ' disabled' : '') + '>↓</button>' +
          '<button type="button" data-wc-shot-del="' + i + '">Remove</button>' +
        '</span></div>';
    }).join('');
  }

  function renderGallery(urls) {
    return '<div class="wc-gallery" id="wc-gallery">' + renderGalleryStrip(urls) + '</div>' +
      '<label class="wc-shot wc-shot-add">' +
        '<input id="wc-gallery-files" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple>' +
        '<span>Add photos</span>' +
      '</label>';
  }

  function featuresHtml(features) {
    var rows = (features && features.length ? features : [{ title: '', text: '' }]).map(function (f, i) {
      return '<div class="wc-feat" data-wc-feat="' + i + '">' +
        input('wc-feat-title-' + i, f.title || '', { placeholder: 'Feature title' }) +
        textarea('wc-feat-text-' + i, f.text || '', 2) +
        '<button type="button" class="wc-mini" data-wc-feat-del="' + i + '">Remove</button></div>';
    }).join('');
    return '<div id="wc-features">' + rows + '</div><button type="button" class="wc-mini" id="wc-feat-add">Add feature</button>';
  }

  function specText(table) {
    return ((table || [])).map(function (row) {
      return (Array.isArray(row) ? row : [row]).join(' | ');
    }).join('\n');
  }

  function collectFeatures() {
    var wrap = $('wc-features');
    if (!wrap) return [];
    var out = [];
    wrap.querySelectorAll('.wc-feat').forEach(function (row) {
      var titleEl = row.querySelector('input');
      var textEl = row.querySelector('textarea');
      var title = String((titleEl && titleEl.value) || '').trim();
      var text = String((textEl && textEl.value) || '').trim();
      if (title || text) out.push({ title: title, text: text });
    });
    return out;
  }

  function metersToMm(n) {
    var v = Number(n) || 0;
    if (!v) return '';
    return v > 20 ? String(v) : String(Math.round(v * 1000));
  }

  function storeBlock(p) {
    var collection = (p && (p.store_collection || p.storeCollection)) || '';
    var lead = (p && (p.store_lead || p.storeLead)) || '';
    var collections = [
      ['', 'Auto from type'],
      ['fine_pitch', 'Fine pitch'],
      ['poster', 'Poster'],
      ['fixed', 'Fixed'],
      ['rental', 'Rental Panel'],
      ['outdoor', 'Outdoor'],
      ['control', 'Controller'],
      ['spares', 'Spares'],
      ['accessories', 'Accessories'],
      ['hidden', 'Hidden from store']
    ];
    var leads = [
      ['', 'Default'],
      ['ships_azusa', 'Ships from Azusa'],
      ['ships_novastar', 'Ships from NovaStar'],
      ['ships_gloshine', 'Ships from Gloshine'],
      ['incoming', 'Incoming'],
      ['built_to_order', 'Built to order'],
      ['quote', 'Request quote']
    ];
    return '<div class="wc-store-card">' +
      '<h3>US Store</h3>' +
      '<p class="wc-note">Shopify Checkout only. Cabinets stay Configure wall. Website → Store → Sync to Shopify fills the variant ID. Street/MAP only.</p>' +
      '<label class="wc-check"><input id="wc-shopify-sell" type="checkbox"' +
        (p && (p.shopify_sell || p.shopifySell) ? ' checked' : '') +
        '> Buy now on the US Store (requires variant ID)</label>' +
      '<label class="wc-check"><input id="wc-store-featured" type="checkbox"' +
        (p && (p.store_featured || p.storeFeatured) ? ' checked' : '') +
        '> Featured on What’s New</label>' +
      '<div class="wc-grid">' +
        field('wc-store-collection', 'Store collection', '<select id="wc-store-collection">' + optionList(collections, collection) + '</select>') +
        field('wc-store-lead', 'Lead time label', '<select id="wc-store-lead">' + optionList(leads, lead) + '</select>') +
        field('wc-shopify-variant-id', 'Shopify variant ID', input('wc-shopify-variant-id', p && (p.shopify_variant_id || p.shopifyVariantId), { placeholder: '3957…' })) +
        field('wc-shopify-product-id', 'Shopify product ID', input('wc-shopify-product-id', p && (p.shopify_product_id || p.shopifyProductId))) +
        field('wc-shopify-handle', 'Shopify handle', input('wc-shopify-handle', p && (p.shopify_handle || p.shopifyHandle), { placeholder: 'vx400-pro' }), true) +
      '</div></div>';
  }

  function renderProductEditor(p, snap) {
    var editor = $('wc-editor');
    if (!editor) return;
    S.gallery = p ? galleryFor(p) : [];
    var brandOpts = S.brands.map(function (b) { return [b.id, b.name]; });
    var typeVal = p && isControl(p) ? 'control' : ((p && p.type) || 'Fixed');
    var cats = ((p && p.cats) || []).join(' ');
    var features = (p && p.features) || [];
    var hidden = !!(p && p.hidden);
    editor.innerHTML =
      '<form id="wc-product-form" class="wc-form">' +
        '<input type="hidden" id="wc-product-id" value="' + esc(p && p.dbId ? p.dbId : '') + '">' +
        renderGallery(S.gallery) +
        '<div class="wc-grid">' +
          field('wc-brand-id', 'Brand', '<select id="wc-brand-id">' + optionList(brandOpts, p && p.brandId) + '</select>') +
          field('wc-brand-name', 'Or new brand name', input('wc-brand-name', '', { placeholder: 'Leave blank to use selected brand' })) +
          field('wc-name', 'Product / series name', input('wc-name', p && p.name, { required: true })) +
          field('wc-series', 'URL slug', input('wc-series', p && p.id, { placeholder: 'auto from name' })) +
          field('wc-type', 'Type', '<select id="wc-type">' + optionList(TYPES.map(function (t) {
            return t === 'control' ? ['control', 'Control'] : t;
          }), typeVal) + '</select>') +
          field('wc-subtype', 'Control subtype', '<select id="wc-subtype">' + optionList([['', '—']].concat(SUBTYPES), p && p.subtype) + '</select>') +
          field('wc-badge', 'Badge', input('wc-badge', p && p.badge, { placeholder: 'Exclusive, Rental…' })) +
          field('wc-cats', 'Categories', input('wc-cats', cats, { placeholder: 'cob indoor-rental posters' }), true) +
          field('wc-lead', 'Lead (top of product page)', textarea('wc-lead', p && p.lead, 3), true) +
          field('wc-description', 'Short description', textarea('wc-description', p && p.description, 3), true) +
        '</div>' +
        '<h3>Key features</h3>' + featuresHtml(features) +
        field('wc-spec', 'Spec table (one row per line, cells split with | )', textarea('wc-spec', specText(p && p.specTable), 8), true) +
        '<div class="wc-grid" id="wc-panel-fields">' +
          field('wc-pitches', 'Pixel pitches (mm)', input('wc-pitches', ((p && p.pitches) || []).join(', '), { placeholder: '1.25, 1.56' })) +
          field('wc-price', 'Fallback price', input('wc-price', p && (isControl(p) ? p.priceEach : p.pricePerM2), { type: 'number', min: 0, step: 1 })) +
          field('wc-weight', 'Weight kg / m²', input('wc-weight', p && p.weightPerM2, { type: 'number', min: 0, step: 0.1 })) +
          field('wc-power-avg', 'Power avg W / m²', input('wc-power-avg', p && p.powerAvg, { type: 'number', min: 0, step: 1 })) +
          field('wc-power-max', 'Power peak W / m²', input('wc-power-max', p && p.powerMax, { type: 'number', min: 0, step: 1 })) +
          field('wc-cab-w', 'Panel W (mm)', input('wc-cab-w', p ? metersToMm(p.cabinetW) : '500', { type: 'number', min: 1, step: 0.5 })) +
          field('wc-cab-h', 'Panel H (mm)', input('wc-cab-h', p ? metersToMm(p.cabinetH) : '500', { type: 'number', min: 1, step: 0.5 })) +
        '</div>' +
        '<div class="wc-grid" id="wc-control-fields">' +
          field('wc-family', 'Family', input('wc-family', p && p.family)) +
          field('wc-model', 'Model', input('wc-model', p && p.model)) +
          field('wc-max-pixels', 'Max pixels', input('wc-max-pixels', p && p.maxPixels)) +
          field('wc-outputs', 'Outputs', input('wc-outputs', p && p.outputs)) +
          field('wc-inputs', 'Inputs', input('wc-inputs', p && p.inputs)) +
          field('wc-best-for', 'Best for', input('wc-best-for', p && p.bestFor), true) +
        '</div>' +
        storeBlock(p) +
        '<label class="wc-check"><input id="wc-hidden" type="checkbox"' + (hidden ? ' checked' : '') + '> Hide from the public website</label>' +
        '<div class="wc-map-card" id="wc-inventory-map"></div>' +
        '<p id="wc-form-error" class="wc-form-error hidden"></p>' +
        '<div class="wc-actions">' +
          (canEdit() ? '<button type="submit" class="wc-btn-primary">Save</button>' : '') +
          (p && p.dbId && canEdit() ? '<button type="button" class="wc-btn" id="wc-hide">' + (hidden ? 'Show on website' : 'Hide') + '</button>' : '') +
          (p && p.dbId && canEdit() ? '<button type="button" class="wc-btn wc-btn-danger" id="wc-delete">Delete</button>' : '') +
        '</div>' +
      '</form>';
    toggleTypeFields();
    if (snap) applyProductSnapshot(snap);
    renderInventoryMap(p);
    var liveP = p;
    if (snap && snap.fields) {
      liveP = {
        brandId: snap.fields['wc-brand-id'] || (p && p.brandId),
        id: snap.fields['wc-series'] || (p && p.id)
      };
    }
    setLiveLink(liveP && liveP.id ? productLiveUrl(liveP) : '/products');
    refreshPreview(liveP && liveP.id ? productLiveUrl(liveP) : '/products');
  }

  function toggleTypeFields() {
    var type = ($('wc-type') || {}).value || '';
    var control = type === 'control';
    var panel = $('wc-panel-fields');
    var ctl = $('wc-control-fields');
    var sub = $('wc-subtype');
    if (panel) panel.classList.toggle('hidden', control);
    if (ctl) ctl.classList.toggle('hidden', !control);
    if (sub && sub.parentElement) sub.parentElement.classList.toggle('hidden', !control);
  }

  function inventoryList() {
    if (S.inventoryItems && S.inventoryItems.length) return S.inventoryItems;
    if (typeof H.inventoryItems === 'function') return H.inventoryItems() || [];
    return S.inventoryItems || [];
  }

  function skuOptionLabel(item) {
    var qty = item && item.qty != null ? String(item.qty) : '';
    return (item.sku ? (item.sku + ' · ') : '') +
      (item.name || 'Item') +
      (item.pitchLabel && item.pitchLabel !== '—' ? (' · ' + item.pitchLabel) : '') +
      (qty !== '' ? (' · ' + qty) : '');
  }

  function mapSlotsForProduct(product) {
    var type = ($('wc-type') || {}).value || (product && product.type) || '';
    var brandId = ($('wc-brand-id') || {}).value || (product && product.brandId) || '';
    if (type === 'control' || brandId === 'novastar') return [''];
    var raw = ($('wc-pitches') || {}).value;
    var pitches = raw != null
      ? String(raw).split(/[,\s]+/).map(function (p) { return p.trim(); }).filter(Boolean)
      : ((product && product.pitches) || []).map(function (p) { return String(p); });
    return pitches.length ? pitches : [''];
  }

  function currentMapSelection() {
    var rows = [];
    var wrap = $('wc-inventory-map');
    if (!wrap) return rows;
    wrap.querySelectorAll('[data-wc-map-pitch]').forEach(function (sel) {
      rows.push({ pitch: sel.getAttribute('data-wc-map-pitch'), itemId: sel.value });
    });
    return rows;
  }

  async function ensureInventory() {
    if (S.inventoryLoaded && S.inventoryItems.length) return S.inventoryItems;
    try {
      var data = await H.api('/api/admin/inventory');
      S.inventoryItems = (data && data.items) || [];
      S.inventoryLoaded = true;
    } catch (err) {
      S.inventoryItems = inventoryList();
      S.inventoryLoaded = true;
    }
    return S.inventoryItems;
  }

  function fillInventoryMap(product) {
    var card = $('wc-inventory-map');
    if (!card) return;
    var pid = ($('wc-product-id') || {}).value || (product && product.dbId) || '';
    if (!pid) {
      card.innerHTML = '<h3>Inventory links</h3><p class="wc-note">Save this product first, then link warehouse SKUs for stock and price.</p>';
      return;
    }
    var maps = {};
    (S.pendingMaps || (product && product.inventoryMaps) || []).forEach(function (m) {
      maps[String(m.pitch || '')] = String(m.itemId || m.item_id || '');
    });
    S.pendingMaps = null;
    var slots = mapSlotsForProduct(product);
    var items = inventoryList();
    var rows = slots.map(function (pitch) {
      var label = pitch ? ('P' + pitch) : (mapSlotsForProduct(product)[0] === '' && (($('wc-type') || {}).value === 'control' || (product && isControl(product))) ? 'This product' : 'Stock');
      var selected = maps[pitch] || '';
      var options = ['<option value="">Not linked</option>'].concat(items.filter(function (item) {
        if (!(item && item.inactive)) return true;
        return selected && String(item.id) === String(selected);
      }).map(function (item) {
        return '<option value="' + esc(item.id) + '"' + (String(item.id) === String(selected) ? ' selected' : '') + '>' +
          esc(skuOptionLabel(item)) + '</option>';
      }));
      return '<div class="wc-map-row">' +
        '<span class="wc-map-label">' + esc(label) + '</span>' +
        '<select data-wc-map-pitch="' + esc(pitch) + '">' + options.join('') + '</select>' +
        (canEditInventory()
          ? '<button type="button" class="wc-mini" data-wc-create-pitch="' + esc(pitch) + '">Create SKU</button>'
          : '') +
        '</div>';
    }).join('');
    card.innerHTML = '<h3>Inventory links</h3>' +
      '<p class="wc-note">Each pixel pitch can show stock and price from one inventory SKU. Unmapped pitches stay on the page as content only.</p>' +
      '<p id="wc-map-msg" class="hidden wc-note"></p>' +
      rows;
  }

  function renderInventoryMap(product) {
    var card = $('wc-inventory-map');
    if (!card) return;
    var pid = ($('wc-product-id') || {}).value || (product && product.dbId) || '';
    if (!pid) {
      fillInventoryMap(product);
      return;
    }
    S.mapGen += 1;
    var gen = S.mapGen;
    card.innerHTML = '<h3>Inventory links</h3><p class="wc-note">Loading warehouse SKUs…</p>';
    ensureInventory().then(function () {
      if (gen !== S.mapGen) return;
      fillInventoryMap(productById(pid) || product);
    }).catch(function () {
      if (gen !== S.mapGen) return;
      fillInventoryMap(productById(pid) || product);
    });
  }

  function showMapMsg(text, ok) {
    var el = $('wc-map-msg');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'wc-note' + (ok ? ' wc-ok' : ' wc-bad');
    el.classList.toggle('hidden', !text);
  }

  async function saveProductMaps() {
    var pid = ($('wc-product-id') || {}).value;
    if (!pid || !canEdit()) return;
    var wrap = $('wc-inventory-map');
    if (!wrap || !wrap.querySelector('[data-wc-map-pitch]')) return;
    try {
      var data = await H.api('/api/admin/products/' + encodeURIComponent(pid) + '/maps', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maps: currentMapSelection() })
      });
      if (data.product) {
        var i;
        for (i = 0; i < S.products.length; i += 1) {
          if (String(S.products[i].dbId) === String(data.product.dbId)) {
            S.products[i] = data.product;
            break;
          }
        }
      }
      showMapMsg('Links saved.', true);
    } catch (err) {
      showMapMsg(err.message || 'Could not save links.', false);
    }
  }

  async function createSkuForPitch(pitch) {
    var name = ((($('wc-name') || {}).value) || 'Item').trim() + (pitch ? (' P' + pitch) : '');
    var created = await H.api('/api/admin/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name,
        brandId: ($('wc-brand-id') || {}).value,
        pitch: pitch,
        unit: pitch ? 'panels' : 'each',
        price: ($('wc-price') || {}).value || 0,
        qty: 0
      })
    });
    S.inventoryLoaded = false;
    await ensureInventory();
    if (typeof H.reloadInventory === 'function') {
      try { await H.reloadInventory(); } catch (err) {}
    }
    var sel = document.querySelector('#wc-inventory-map [data-wc-map-pitch="' + pitch + '"]');
    if (sel && created.item) {
      var opt = document.createElement('option');
      opt.value = created.item.id;
      opt.textContent = skuOptionLabel(created.item);
      sel.appendChild(opt);
      sel.value = String(created.item.id);
    }
    await saveProductMaps();
  }

  function renderBrandEditor(b) {
    var editor = $('wc-editor');
    if (!editor) return;
    editor.innerHTML =
      '<form id="wc-brand-form" class="wc-form">' +
        '<input type="hidden" id="wc-brand-edit-id" value="' + esc(b && b.id ? b.id : '') + '">' +
        '<div class="wc-brand-media">' +
          '<label class="wc-media-card">Logo' +
            (b && b.logo ? '<img src="' + esc(mediaSrc(b.logo)) + '" alt="">' : '<span class="wc-media-empty">No logo</span>') +
            '<input id="wc-brand-logo" type="file" accept="image/jpeg,image/png,image/webp,image/gif">' +
            (b && b.logo ? '<label class="wc-check"><input id="wc-clear-logo" type="checkbox"> Remove logo</label>' : '') +
          '</label>' +
          '<label class="wc-media-card">Cover' +
            (b && b.image ? '<img src="' + esc(mediaSrc(b.image)) + '" alt="">' : '<span class="wc-media-empty">No cover</span>') +
            '<input id="wc-brand-cover" type="file" accept="image/jpeg,image/png,image/webp,image/gif">' +
            (b && b.image ? '<label class="wc-check"><input id="wc-clear-cover" type="checkbox"> Remove cover</label>' : '') +
          '</label>' +
        '</div>' +
        '<div class="wc-grid">' +
          field('wc-b-name', 'Brand name', input('wc-b-name', b && b.name, { required: true })) +
          field('wc-b-tagline', 'Tagline', input('wc-b-tagline', b && b.tagline)) +
          field('wc-b-desc', 'Description', textarea('wc-b-desc', b && b.description, 5), true) +
        '</div>' +
        '<label class="wc-check"><input id="wc-b-hidden" type="checkbox"' + (b && b.hidden ? ' checked' : '') + '> Hide this brand on the website</label>' +
        '<p id="wc-form-error" class="wc-form-error hidden"></p>' +
        '<div class="wc-actions">' +
          (canEdit() ? '<button type="submit" class="wc-btn-primary">Save brand</button>' : '') +
          (b && b.id && canEdit() ? '<button type="button" class="wc-btn wc-btn-danger" id="wc-brand-delete">Delete</button>' : '') +
        '</div>' +
      '</form>';
    setLiveLink(b && b.id ? brandLiveUrl(b) : '/products');
    refreshPreview(b && b.id ? brandLiveUrl(b) : '/products');
  }

  function renderPicturesHelp() {
    var editor = $('wc-editor');
    if (!editor) return;
    editor.innerHTML = '<div class="wc-help"><h3>Pictures</h3><p>Every photo on website product pages. Click a picture on the left to open that product and change, reorder, or set the hero.</p></div>';
    setLiveLink('/products');
    refreshPreview('/products');
  }

  function refreshPreview(href) {
    var frame = $('wc-preview');
    if (!frame) return;
    var next = href || '/products';
    if (S.pane === 'preview') frame.src = next;
    else frame.setAttribute('data-src', next);
  }

  function showFormError(msg) {
    var el = $('wc-form-error');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('hidden', !msg);
  }

  function selectProduct(id, opts) {
    opts = opts || {};
    if (opts.pane) S.pane = opts.pane;
    openWcTab(id || 'new', opts);
  }

  function selectBrand(id) {
    S.creating = id === 'new';
    S.selected = S.creating ? '' : String(id || '');
    S.mode = 'brands';
    setModeButtons();
    renderList();
    renderBrandEditor(S.creating ? null : brandById(S.selected));
  }

  function mutateGallery(fn) {
    S.gallery = fn(S.gallery.slice());
    var wrap = $('wc-gallery');
    if (wrap) wrap.innerHTML = renderGalleryStrip(S.gallery);
  }

  async function saveProduct(e) {
    e.preventDefault();
    showFormError('');
    var fd = new FormData();
    var editingId = ($('wc-product-id') || {}).value || '';
    var newBrand = (($('wc-brand-name') || {}).value || '').trim();
    fd.append('brandId', newBrand ? '' : (($('wc-brand-id') || {}).value || ''));
    fd.append('brandName', newBrand);
    fd.append('name', (($('wc-name') || {}).value || '').trim());
    fd.append('seriesId', (($('wc-series') || {}).value || '').trim());
    var typeVal = ($('wc-type') || {}).value || 'Fixed';
    fd.append('type', typeVal);
    fd.append('subtype', typeVal === 'control' ? (($('wc-subtype') || {}).value || '') : '');
    fd.append('badge', ($('wc-badge') || {}).value || '');
    fd.append('cats', ($('wc-cats') || {}).value || '');
    fd.append('lead', ($('wc-lead') || {}).value || '');
    fd.append('description', ($('wc-description') || {}).value || '');
    fd.append('features', JSON.stringify(collectFeatures()));
    fd.append('specTable', JSON.stringify(parseSpecFromText(($('wc-spec') || {}).value || '')));
    fd.append('pitches', ($('wc-pitches') || {}).value || '');
    fd.append('pricePerM2', ($('wc-price') || {}).value || '0');
    fd.append('priceEach', ($('wc-price') || {}).value || '0');
    fd.append('weightPerM2', ($('wc-weight') || {}).value || '');
    fd.append('powerAvg', ($('wc-power-avg') || {}).value || '');
    fd.append('powerMax', ($('wc-power-max') || {}).value || '');
    fd.append('cabinetWmm', ($('wc-cab-w') || {}).value || '');
    fd.append('cabinetHmm', ($('wc-cab-h') || {}).value || '');
    fd.append('family', ($('wc-family') || {}).value || '');
    fd.append('model', ($('wc-model') || {}).value || '');
    fd.append('maxPixels', ($('wc-max-pixels') || {}).value || '');
    fd.append('outputs', ($('wc-outputs') || {}).value || '');
    fd.append('inputs', ($('wc-inputs') || {}).value || '');
    fd.append('bestFor', ($('wc-best-for') || {}).value || '');
    fd.append('shopify_sell', ($('wc-shopify-sell') || {}).checked ? '1' : '0');
    fd.append('store_featured', ($('wc-store-featured') || {}).checked ? '1' : '0');
    fd.append('store_collection', ($('wc-store-collection') || {}).value || '');
    fd.append('store_lead', ($('wc-store-lead') || {}).value || '');
    fd.append('shopify_variant_id', ($('wc-shopify-variant-id') || {}).value || '');
    fd.append('shopify_product_id', ($('wc-shopify-product-id') || {}).value || '');
    fd.append('shopify_handle', ($('wc-shopify-handle') || {}).value || '');
    var keep = S.gallery.filter(function (url) { return url && url.indexOf('blob:') !== 0; });
    fd.append('galleryKeep', JSON.stringify(keep));
    if (keep[0]) fd.append('heroUrl', keep[0]);
    if (!keep.length) fd.append('clearImage', '1');
    var fileInput = $('wc-gallery-files');
    Array.from((fileInput && fileInput.files) || []).forEach(function (file) {
      fd.append('gallery', file);
    });
    try {
      var url = editingId ? '/api/admin/products/' + encodeURIComponent(editingId) : '/api/admin/products';
      var data = await H.api(url, { method: editingId ? 'PUT' : 'POST', body: fd });
      var hiddenOn = !!($('wc-hidden') || {}).checked;
      if (data.product && !!data.product.hidden !== hiddenOn) {
        await H.api('/api/admin/products/' + encodeURIComponent(data.product.dbId) + '/visibility', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hidden: hiddenOn })
        });
      }
      await load();
      if (data.product) afterWcSave(data.product);
      if (typeof H.onChanged === 'function') H.onChanged();
    } catch (err) {
      showFormError(err.message || 'Could not save product.');
    }
  }

  function parseSpecFromText(text) {
    return String(text || '').split(/\n+/).map(function (line) {
      return line.split('|').map(function (cell) { return cell.trim(); });
    }).filter(function (row) {
      return row.some(function (cell) { return cell; });
    });
  }

  async function saveBrand(e) {
    e.preventDefault();
    showFormError('');
    var fd = new FormData();
    var editingId = ($('wc-brand-edit-id') || {}).value || '';
    fd.append('name', (($('wc-b-name') || {}).value || '').trim());
    fd.append('tagline', ($('wc-b-tagline') || {}).value || '');
    fd.append('description', ($('wc-b-desc') || {}).value || '');
    fd.append('hidden', ($('wc-b-hidden') || {}).checked ? '1' : '0');
    var logo = $('wc-brand-logo');
    var cover = $('wc-brand-cover');
    if (logo && logo.files && logo.files[0]) fd.append('logo', logo.files[0]);
    if (cover && cover.files && cover.files[0]) fd.append('image', cover.files[0]);
    if (($('wc-clear-logo') || {}).checked) fd.append('clearLogo', '1');
    if (($('wc-clear-cover') || {}).checked) fd.append('clearImage', '1');
    try {
      var url = editingId ? '/api/admin/brands/' + encodeURIComponent(editingId) : '/api/admin/brands';
      var data = await H.api(url, { method: editingId ? 'PUT' : 'POST', body: fd });
      await load();
      if (data.brand) selectBrand(data.brand.id);
      if (typeof H.onChanged === 'function') H.onChanged();
    } catch (err) {
      showFormError(err.message || 'Could not save brand.');
    }
  }

  function onClick(e) {
    var closeTab = e.target.closest('[data-wc-tab-close]');
    if (closeTab) {
      e.preventDefault();
      e.stopPropagation();
      closeWcTab(closeTab.getAttribute('data-wc-tab-close'));
      return;
    }
    var tabBtn = e.target.closest('[data-wc-tab-id]');
    if (tabBtn) {
      var tabId = tabBtn.getAttribute('data-wc-tab-id');
      if (tabId === 'overview') showOverview();
      else activateWcTab(tabId);
      return;
    }
    var createSku = e.target.closest('[data-wc-create-pitch]');
    if (createSku) {
      createSkuForPitch(createSku.getAttribute('data-wc-create-pitch') || '').catch(function (err) {
        showMapMsg(err.message || 'Could not create SKU.', false);
      });
      return;
    }
    var modeBtn = e.target.closest('[data-wc-mode]');
    if (modeBtn) {
      if (S.mode === 'products') stashActiveTab();
      S.mode = modeBtn.getAttribute('data-wc-mode') || 'products';
      S.creating = false;
      S.pane = 'edit';
      if (S.mode === 'brands') {
        S.selected = '';
        if (S.brands[0]) selectBrand(S.brands[0].id);
        else {
          setModeButtons();
          renderList();
          renderBrandEditor(null);
        }
      } else if (S.mode === 'pictures') {
        S.selected = '';
        setModeButtons();
        renderList();
        renderPicturesHelp();
      } else if (S.openTabs.length && S.activeTab && S.activeTab !== 'overview') {
        activateWcTab(S.activeTab);
      } else if (S.openTabs.length) {
        activateWcTab(S.openTabs[S.openTabs.length - 1]);
      } else {
        showOverview();
      }
      return;
    }
    var paneBtn = e.target.closest('[data-wc-pane]');
    if (paneBtn) {
      S.pane = paneBtn.getAttribute('data-wc-pane') || 'edit';
      setModeButtons();
      var frame = $('wc-preview');
      if (S.pane === 'preview' && frame) {
        var href = ($('wc-open-live') || {}).href || frame.getAttribute('data-src') || '/products';
        if (frame.src !== href) frame.src = href;
      }
      return;
    }
    var add = e.target.closest('#wc-add');
    if (add) {
      if (S.mode === 'brands') selectBrand('new');
      else selectProduct('new');
      return;
    }
    var pic = e.target.closest('[data-wc-pic-id]');
    if (pic) {
      selectProduct(pic.getAttribute('data-wc-pic-id'));
      return;
    }
    var row = e.target.closest('[data-wc-id]');
    if (row && row.closest('#wc-list')) {
      var id = row.getAttribute('data-wc-id');
      if (S.mode === 'brands') selectBrand(id);
      else selectProduct(id);
      return;
    }
    var hero = e.target.closest('[data-wc-shot-hero]');
    if (hero) {
      var hi = Number(hero.getAttribute('data-wc-shot-hero'));
      mutateGallery(function (urls) {
        if (!urls[hi]) return urls;
        var item = urls.splice(hi, 1)[0];
        urls.unshift(item);
        return urls;
      });
      return;
    }
    var up = e.target.closest('[data-wc-shot-up]');
    if (up) {
      var ui = Number(up.getAttribute('data-wc-shot-up'));
      mutateGallery(function (urls) {
        if (ui < 1) return urls;
        var tmp = urls[ui - 1];
        urls[ui - 1] = urls[ui];
        urls[ui] = tmp;
        return urls;
      });
      return;
    }
    var down = e.target.closest('[data-wc-shot-down]');
    if (down) {
      var di = Number(down.getAttribute('data-wc-shot-down'));
      mutateGallery(function (urls) {
        if (di >= urls.length - 1) return urls;
        var tmp2 = urls[di + 1];
        urls[di + 1] = urls[di];
        urls[di] = tmp2;
        return urls;
      });
      return;
    }
    var delShot = e.target.closest('[data-wc-shot-del]');
    if (delShot) {
      var si = Number(delShot.getAttribute('data-wc-shot-del'));
      mutateGallery(function (urls) {
        urls.splice(si, 1);
        return urls;
      });
      return;
    }
    var featAdd = e.target.closest('#wc-feat-add');
    if (featAdd) {
      var wrap = $('wc-features');
      if (!wrap) return;
      var n = wrap.querySelectorAll('.wc-feat').length;
      wrap.insertAdjacentHTML('beforeend',
        '<div class="wc-feat" data-wc-feat="' + n + '">' +
          input('wc-feat-title-' + n, '', { placeholder: 'Feature title' }) +
          textarea('wc-feat-text-' + n, '', 2) +
          '<button type="button" class="wc-mini" data-wc-feat-del="' + n + '">Remove</button></div>'
      );
      return;
    }
    var featDel = e.target.closest('[data-wc-feat-del]');
    if (featDel) {
      var feat = featDel.closest('.wc-feat');
      if (feat) feat.remove();
      return;
    }
  }

  async function onSubmit(e) {
    if (e.target && e.target.id === 'wc-product-form') return saveProduct(e);
    if (e.target && e.target.id === 'wc-brand-form') return saveBrand(e);
  }

  async function onActionClick(e) {
    var hide = e.target.closest('#wc-hide');
    if (hide) {
      var pid = ($('wc-product-id') || {}).value;
      if (!pid) return;
      var p = productById(pid);
      try {
        await H.api('/api/admin/products/' + encodeURIComponent(pid) + '/visibility', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hidden: !(p && p.hidden) })
        });
        await load();
        afterWcSave(productById(pid) || { dbId: pid });
        if (typeof H.onChanged === 'function') H.onChanged();
      } catch (err) {
        showFormError(err.message);
      }
      return;
    }
    var del = e.target.closest('#wc-delete');
    if (del) {
      var did = ($('wc-product-id') || {}).value;
      if (!did || !global.confirm('Delete this product page?')) return;
      try {
        await H.api('/api/admin/products/' + encodeURIComponent(did), { method: 'DELETE' });
        closeWcTab(did);
        S.selected = '';
        await load();
        if (S.activeTab === 'overview' || !S.openTabs.length) showOverview();
        if (typeof H.onChanged === 'function') H.onChanged();
      } catch (err) {
        showFormError(err.message);
      }
      return;
    }
    var bdel = e.target.closest('#wc-brand-delete');
    if (bdel) {
      var bid = ($('wc-brand-edit-id') || {}).value;
      if (!bid || !global.confirm('Delete this brand? Products must be moved first.')) return;
      try {
        await H.api('/api/admin/brands/' + encodeURIComponent(bid), { method: 'DELETE' });
        S.selected = '';
        await load();
        renderBrandEditor(null);
        if (typeof H.onChanged === 'function') H.onChanged();
      } catch (err) {
        showFormError(err.message);
      }
    }
  }

  function onChange(e) {
    if (e.target && e.target.id === 'wc-type') {
      toggleTypeFields();
      renderInventoryMap(productById(S.selected));
    }
    if (e.target && e.target.getAttribute('data-wc-map-pitch') != null) {
      saveProductMaps();
    }
  }

  function initSplit() {
    var split = $('wc-split');
    var resizer = $('wc-split-resizer');
    if (!split || !resizer || resizer._wcBound) return;
    resizer._wcBound = true;
    var KEY = 'spectrum-wc-left';
    function apply(px) {
      var w = Math.max(220, Math.min(px, 640));
      split.style.setProperty('--wc-left-w', w + 'px');
      try { localStorage.setItem(KEY, String(w)); } catch (err) {}
    }
    try {
      var saved = parseInt(localStorage.getItem(KEY), 10);
      if (saved >= 220) apply(saved);
    } catch (err) {}
    var drag = false;
    resizer.addEventListener('pointerdown', function (ev) {
      drag = true;
      resizer.setPointerCapture(ev.pointerId);
    });
    resizer.addEventListener('pointermove', function (ev) {
      if (!drag) return;
      var rect = split.getBoundingClientRect();
      apply(ev.clientX - rect.left);
    });
    resizer.addEventListener('pointerup', function () { drag = false; });
  }

  function bind() {
    if (S.bound) return;
    var section = $('control-section');
    if (!section) return;
    S.bound = true;
    section.addEventListener('click', onClick);
    section.addEventListener('click', onActionClick);
    section.addEventListener('submit', onSubmit);
    section.addEventListener('change', onChange);
    initSplit();
  }

  async function load() {
    var section = $('control-section');
    if (!section) return;
    showError('');
    S.loading = true;
    try {
      var pack = await Promise.all([
        H.api('/api/admin/products'),
        H.api('/api/admin/brands'),
        H.api('/api/admin/inventory').catch(function () { return { items: [] }; })
      ]);
      S.products = pack[0].products || [];
      S.brands = pack[1].brands || [];
      S.inventoryItems = pack[2].items || [];
      S.inventoryLoaded = true;
      setModeButtons();
      renderList();
      if (S.mode === 'pictures') renderPicturesHelp();
      else if (S.mode === 'brands') {
        if (S.creating) renderBrandEditor(null);
        else if (S.selected) renderBrandEditor(brandById(S.selected));
        else if (S.brands[0]) selectBrand(S.brands[0].id);
        else renderBrandEditor(null);
      } else {
        renderWcTabs();
        if (S.activeTab === 'overview' || !S.activeTab) {
          S.activeTab = 'overview';
          S.creating = false;
          S.selected = '';
          setLiveLink('/products');
          refreshPreview('/products');
          syncRightChrome();
        } else if (S.activeTab !== 'new' && !productById(S.activeTab)) {
          closeWcTab(S.activeTab);
        }
      }
    } catch (err) {
      showError(err.message || 'Could not load website products.');
    }
    S.loading = false;
  }

  global.SpectrumWebsiteControl = {
    boot: function (helpers) {
      H = Object.assign(H, helpers || {});
      bind();
    },
    load: load
  };
})(window);
