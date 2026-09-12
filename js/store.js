/**
 * Spectrum US Store — UniFi-style custom storefront.
 * Catalog from /api/store/catalog. Checkout via Shopify cart permalink.
 */
(function () {
  var BASE = (location.hostname === 'store.spectrumdisplay.com' || location.hostname.indexOf('store.') === 0)
    ? ''
    : '/store';
  var WWW = 'https://www.spectrumdisplay.com';
  var state = {
    catalog: null,
    filter: 'all',
    collectionSlug: '',
    qty: 1,
    variantId: ''
  };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function href(path) {
    if (!path) path = '/';
    if (path.charAt(0) !== '/') path = '/' + path;
    if (/^https?:/i.test(path)) return path;
    return BASE + path;
  }
  function www(path) {
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return path || '/';
    return WWW + (path || '/');
  }
  function imgSrc(src, kind) {
    if (!src) return '';
    if (window.spectrumDisplayImage) return window.spectrumDisplayImage(src, kind || 'card');
    return src.charAt(0) === '/' ? src : '/' + src;
  }
  function photoFor(p, kind) {
    if (window.spectrumProductPhoto) return window.spectrumProductPhoto(p, kind || 'card');
    return imgSrc(p && p.image, kind);
  }
  function photoOrFallback(p) {
    if (p && p.image) return p.image;
    return (window.spectrumProductPhotoFallback && window.spectrumProductPhotoFallback(p)) || '';
  }

  function t(key, fallback) {
    if (window.SpectrumI18n && typeof SpectrumI18n.t === 'function') {
      var v = SpectrumI18n.t(key);
      if (v && v !== key) return v;
    }
    return fallback || key;
  }

  var LANG_LABELS = {
    en: 'US (English)',
    es: 'US (Español)',
    fr: 'US (Français)',
    ko: 'US (한국어)',
    ja: 'US (日本語)',
    zh: 'US (中文)'
  };

  function colLabel(slug, fallback) {
    var key = 'store.col.' + slug;
    return t(key, fallback || slug);
  }

  function parseRoute() {
    var raw = location.pathname || '/';
    if (BASE && raw.indexOf(BASE) === 0) raw = raw.slice(BASE.length) || '/';
    raw = raw.replace(/\/+$/, '') || '/';
    if (raw === '/') return { name: 'home' };
    var parts = raw.split('/').filter(Boolean);
    if (parts[0] === 'collections' && parts[1]) return { name: 'collection', slug: parts[1] };
    if (parts[0] === 'products' && parts[1]) return { name: 'product', handle: decodeURIComponent(parts[1]) };
    if (parts[0] === 'cart') return { name: 'cart' };
    if (parts[0] === 'pages' && parts[1]) return { name: 'page', slug: parts[1] };
    return { name: 'home' };
  }

  function go(path, replace) {
    var url = href(path);
    if (replace) history.replaceState({}, '', url);
    else history.pushState({}, '', url);
    render();
    window.scrollTo(0, 0);
  }

  function products() {
    return (state.catalog && state.catalog.products) || [];
  }
  function collections() {
    return (state.catalog && state.catalog.collections) || [];
  }
  function byHandle(handle) {
    var h = String(handle || '').toLowerCase();
    return products().filter(function (p) { return p.handle === h || p.id === h; })[0] || null;
  }
  function inCollection(slug) {
    return products().filter(function (p) { return p.collectionSlug === slug; });
  }
  function shop() {
    return (state.catalog && state.catalog.shop) || '';
  }

  function railIcon(item) {
    if (item.img) {
      return '<img class="shop-rail-icon" src="' + esc(item.img) + '" alt="" width="80" height="80">';
    }
    return '';
  }

  function railItems() {
    return [
      { label: t('store.whatsNew', 'What’s New'), href: href('/#whats-new'), img: '/assets/store/whats-new.webp?v=rail3d', key: 'new' },
      { label: t('store.col.control', 'Controller'), href: href('/collections/control'), img: '/assets/store/controller.webp?v=rail3d', key: 'control' },
      { label: t('store.col.rental', 'Rental Panel'), href: href('/collections/rental'), img: '/assets/store/rental-panel.webp?v=rail3d', key: 'rental' },
      { label: t('store.col.poster', 'Poster'), href: href('/collections/poster'), img: '/assets/store/poster.webp?v=rail3d', key: 'poster' },
      { label: t('store.col.spares', 'Spares'), href: href('/collections/spares'), img: '/assets/store/spares.webp?v=rail3d', key: 'spares' },
      { label: t('store.col.accessories', 'Accessories'), href: href('/collections/accessories'), img: '/assets/store/accessories.webp?v=rail3d', key: 'accessories' }
    ];
  }

  function updateCartBadge() {
    var n = window.SpectrumStoreCart ? SpectrumStoreCart.count() : 0;
    $all('[data-cart-count]').forEach(function (el) {
      el.textContent = String(n);
      el.classList.toggle('is-on', n > 0);
    });
  }

  function bindChrome() {
    var searchBtn = $('[data-open-search]');
    var overlay = $('#shop-search');
    var input = $('#shop-search-input');
    if (searchBtn && overlay) {
      searchBtn.onclick = function () {
        overlay.classList.add('is-on');
        if (input) setTimeout(function () { input.focus(); }, 30);
      };
    }
    if (overlay) {
      overlay.onclick = function (e) {
        if (e.target === overlay) overlay.classList.remove('is-on');
      };
      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        var settings = $('[data-shop-settings]');
        if (settings && settings.classList.contains('is-open')) {
          closeSettings();
          return;
        }
        if (document.body.classList.contains('shop-cart-open')) {
          closeCartDrawer();
          return;
        }
        overlay.classList.remove('is-on');
      });
    }
    if (input) {
      input.oninput = function () { renderSearch(input.value); };
    }
    document.body.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.shop-card-cta, .shop-btn, [data-add]')) return;
      var a = e.target.closest && e.target.closest('a[data-shop-link]');
      if (!a) return;
      var url = a.getAttribute('href') || '';
      if (a.target === '_blank' || /^(https?:|mailto:|tel:)/i.test(url)) return;
      if (url.indexOf(BASE) !== 0 && url.charAt(0) === '/' && BASE) return;
      e.preventDefault();
      var path = url;
      if (BASE && path.indexOf(BASE) === 0) path = path.slice(BASE.length) || '/';
      go(path);
    });
  }

  function renderChrome(route) {
    var collectionMode = route.name === 'collection' || route.name === 'product';
    document.body.classList.toggle('shop-collection-mode', collectionMode);
    var rail = $('#shop-rail-row');
    if (rail) {
      rail.innerHTML = railItems().map(function (item) {
        var on = (route.name === 'home' && item.key === 'new') || (route.slug === item.key);
        return '<a class="shop-rail-item' + (on ? ' is-on' : '') + '" href="' + esc(item.href) + '"' +
          (item.ext ? '' : ' data-shop-link') + '>' + railIcon(item) + '<span>' + esc(item.label) + '</span></a>';
      }).join('');
    }
    var searchBtn = $('[data-open-search]');
    if (searchBtn) searchBtn.setAttribute('aria-label', t('store.search', 'Search'));
    var cartBtn = $('[data-cart]');
    if (cartBtn) cartBtn.setAttribute('aria-label', t('store.cart', 'Cart'));
    var accountBtn = $('[data-account]');
    if (accountBtn) accountBtn.setAttribute('aria-label', t('store.account', 'Account'));
    var settingsBtn = $('[data-open-settings]');
    if (settingsBtn) settingsBtn.setAttribute('aria-label', t('store.settings', 'Settings'));
    var settingsPop = $('#shop-settings-pop');
    if (settingsPop) settingsPop.setAttribute('aria-label', t('store.settings', 'Settings'));
    var themeGroup = $('.shop-theme-seg');
    if (themeGroup) themeGroup.setAttribute('aria-label', t('store.theme', 'Theme'));
    var langSel = $('#shop-lang-select');
    if (langSel) langSel.setAttribute('aria-label', t('store.language', 'Language'));
    var cartClose = $('[data-cart-close]');
    if (cartClose) cartClose.setAttribute('aria-label', t('store.close', 'Close'));

    var sub = $('#shop-subnav-row');
    if (sub) {
      var links = [{ label: t('store.whatsNew', 'What’s New'), slug: '', href: href('/') }].concat(collections().map(function (c) {
        return { label: colLabel(c.slug, c.label), slug: c.slug, href: href('/collections/' + c.slug) };
      }));
      links.push({ label: t('store.designWall', 'Design a wall'), slug: 'design', href: www('/led-wall-calculator'), ext: true });
      sub.innerHTML = links.map(function (item) {
        var on = route.slug && item.slug === route.slug;
        return '<a class="' + (on ? 'is-on' : '') + '" href="' + esc(item.href) + '"' +
          (item.ext ? '' : ' data-shop-link') + '>' + esc(item.label) + '</a>';
      }).join('');
    }
    var account = $('[data-account]');
    if (account) account.href = www('/account.html');
    var integrator = $('[data-integrator]');
    if (integrator) integrator.href = www('/contact');
    var word = $('[data-home]');
    if (word) word.href = href('/');
    var cart = $('[data-cart]');
    if (cart) cart.href = href('/cart');
    $all('footer a[href^="/store"]').forEach(function (a) {
      var path = a.getAttribute('href').replace(/^\/store/, '') || '/';
      a.href = href(path);
      a.setAttribute('data-shop-link', '');
    });
    $all('footer a[href="https://www.spectrumdisplay.com/products.html"], footer a[href="https://www.spectrumdisplay.com/products"]').forEach(function (a) { a.href = www('/products'); });
    $all('footer a[href="https://www.spectrumdisplay.com/account.html"]').forEach(function (a) { a.href = www('/account.html'); });
    $all('footer a[href="https://www.spectrumdisplay.com/contact.html"], footer a[href="https://www.spectrumdisplay.com/contact"]').forEach(function (a) { a.href = www('/contact'); });
    $all('footer a[href="https://www.spectrumdisplay.com/led-wall-calculator"]').forEach(function (a) { a.href = www('/led-wall-calculator'); });
    updateCartBadge();
  }

  function fillCartDrawer() {
    var body = $('#shop-cart-body');
    var foot = $('#shop-cart-foot');
    if (!body || !foot) return;
    var items = SpectrumStoreCart.read();
    var ready = !!(shop() && items.length);
    if (!items.length) {
      body.innerHTML = '<p class="shop-empty">' + esc(t('store.cartEmpty', 'Your cart is empty.')) + '</p>';
      foot.innerHTML = '<button type="button" class="shop-btn" data-cart-close>' +
        esc(t('store.continueShopping', 'Continue shopping')) + '</button>';
      return;
    }
    body.innerHTML = items.map(function (line) {
      var qty = Math.max(1, Number(line.qty) || 1);
      return '<div class="shop-cart-line">' +
        (line.image ? '<img src="' + esc(imgSrc(line.image, 'thumb')) + '" alt="">' : '<div class="shop-cart-line-ph"></div>') +
        '<div><strong>' + esc(line.name) + '</strong>' +
          '<div class="shop-sku">' + esc(line.sku || '') + '</div>' +
          '<div class="shop-cart-qty">' +
            '<button type="button" data-cart-qty="-1" data-id="' + esc(line.variantId) + '" aria-label="' + esc(t('store.less', 'Less')) + '">−</button>' +
            '<span>' + esc(qty) + '</span>' +
            '<button type="button" data-cart-qty="1" data-id="' + esc(line.variantId) + '" aria-label="' + esc(t('store.more', 'More')) + '">+</button>' +
          '</div></div>' +
        '<div class="shop-cart-line-price">' + esc(line.priceLabel || '') + '</div></div>';
    }).join('');
    var checkout = ready
      ? '<a class="shop-btn" href="' + esc(SpectrumStoreCart.checkoutUrl(shop())) + '">' + esc(t('store.checkOut', 'Check out')) + '</a>'
      : '<button class="shop-btn is-off" type="button" disabled>' + esc(t('store.checkOut', 'Check out')) + '</button>' +
        '<p class="shop-quiet">' + esc(t('store.checkoutOffline', 'Checkout is not connected yet. Catalog stays visible — no payment is taken on this site.')) + '</p>';
    foot.innerHTML = '<p class="shop-quiet">' + esc(t('store.checkoutNote', 'Checkout opens Shopify. Spectrum does not collect cards on this page. Oversized LED freight is confirmed by Spectrum before the truck is booked. Small control and spare orders ship parcel.')) + '</p>' + checkout;
  }

  function openCartDrawer() {
    fillCartDrawer();
    document.body.classList.add('shop-cart-open');
    var drawer = $('#shop-cart-drawer');
    if (drawer) drawer.setAttribute('aria-hidden', 'false');
    var close = $('[data-cart-close]');
    if (close) close.focus();
  }

  function closeCartDrawer() {
    document.body.classList.remove('shop-cart-open');
    var drawer = $('#shop-cart-drawer');
    if (drawer) drawer.setAttribute('aria-hidden', 'true');
    if (parseRoute().name === 'cart') {
      history.replaceState({}, '', href('/'));
    }
  }

  function closeSettings() {
    var wrap = $('[data-shop-settings]');
    var btn = $('[data-open-settings]');
    var pop = $('#shop-settings-pop');
    if (wrap) wrap.classList.remove('is-open');
    if (pop) pop.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function syncThemeSeg() {
    var pref = (window.SpectrumStoreTheme && SpectrumStoreTheme.getPref()) || 'system';
    $all('[data-theme]').forEach(function (b) {
      var on = b.getAttribute('data-theme') === pref;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  function bindSettings() {
    var wrap = $('[data-shop-settings]');
    var btn = $('[data-open-settings]');
    var pop = $('#shop-settings-pop');
    var sel = $('#shop-lang-select');
    if (!wrap || !btn || !pop) return;

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (wrap.classList.contains('is-open')) closeSettings();
      else {
        wrap.classList.add('is-open');
        pop.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
        syncThemeSeg();
      }
    });
    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) closeSettings();
    });
    $all('[data-theme]', pop).forEach(function (b) {
      b.addEventListener('click', function () {
        if (window.SpectrumStoreTheme) SpectrumStoreTheme.setPref(b.getAttribute('data-theme'));
        syncThemeSeg();
      });
    });
    if (sel && !sel.dataset.bound) {
      sel.dataset.bound = '1';
      var langs = (window.SpectrumI18n && SpectrumI18n.langs) || [
        { code: 'en' }, { code: 'es' }, { code: 'fr' }, { code: 'ko' }, { code: 'ja' }, { code: 'zh' }
      ];
      sel.innerHTML = langs.map(function (l) {
        return '<option value="' + esc(l.code) + '">' + esc(LANG_LABELS[l.code] || l.label || l.code) + '</option>';
      }).join('');
      sel.value = (window.SpectrumI18n && SpectrumI18n.lang) || 'en';
      sel.addEventListener('change', function () {
        if (window.SpectrumI18n && SpectrumI18n.setLang) SpectrumI18n.setLang(sel.value);
        else {
          try { localStorage.setItem('spectrumLang', sel.value); } catch (err) {}
          location.reload();
        }
      });
    }
    syncThemeSeg();
  }

  function bindCartDrawer() {
    var cart = $('[data-cart]');
    if (cart) {
      cart.addEventListener('click', function (e) {
        e.preventDefault();
        openCartDrawer();
      });
    }
    var scrim = $('#shop-cart-scrim');
    if (scrim) scrim.addEventListener('click', closeCartDrawer);
    var drawer = $('#shop-cart-drawer');
    if (drawer) {
      drawer.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('[data-cart-close]')) {
          e.preventDefault();
          closeCartDrawer();
          return;
        }
        var btn = e.target.closest && e.target.closest('[data-cart-qty]');
        if (!btn) return;
        var id = btn.getAttribute('data-id');
        var delta = Number(btn.getAttribute('data-cart-qty')) || 0;
        var line = SpectrumStoreCart.read().filter(function (item) {
          return String(item.variantId) === String(id);
        })[0];
        var next = Math.max(0, (Number(line && line.qty) || 1) + delta);
        SpectrumStoreCart.setQty(id, next);
      });
    }
  }

  function cta(p) {
    if (p.mode === 'configure') {
      return '<a class="shop-btn" href="' + esc(p.configureUrl) + '">' + esc(t('store.configureWall', 'Configure wall')) + '</a>';
    }
    if (p.hasOptions) {
      return '<a class="shop-btn" href="' + esc(href('/products/' + p.handle)) + '" data-shop-link>' +
        esc(t('store.select', 'Select')) + '</a>';
    }
    if (p.canAddToCart) {
      return '<button class="shop-btn" type="button" data-add="' + esc(p.handle) + '">' +
        esc(t('store.addToCart', 'Add to cart')) + '</button>';
    }
    return '<button class="shop-btn is-off" type="button" disabled>' +
      esc(t('store.addToCart', 'Add to cart')) + '</button>';
  }

  function leadLine(p) {
    var label = String((p && p.leadLabel) || '');
    if (!label || /^ships from/i.test(label) || /^ships_/.test(String((p && p.lead) || ''))) return '';
    return '<div class="shop-lead">' + esc(label) + '</div>';
  }

  function cardHtml(p, opts) {
    opts = opts || {};
    var photo = photoFor(p, 'card');
    var chips = (p.chips || []).filter(Boolean);
    return '<article class="shop-card">' +
      '<a class="shop-card-main" href="' + esc(href('/products/' + p.handle)) + '" data-shop-link>' +
        (opts.caption ? '<div class="shop-caption">' + esc(opts.caption) + '</div>' : '') +
        '<div class="shop-card-media">' +
          (photo ? '<img src="' + esc(photo) + '" alt="">' : '') +
        '</div>' +
        '<h3>' + esc(p.name) + '</h3>' +
        '<div class="shop-sku">' + esc(p.sku || p.brandName || '') + '</div>' +
        '<p>' + esc(p.description || '') + '</p>' +
        (chips.length ? '<div class="shop-chips">' + chips.map(function (c) {
          return '<span class="shop-chip">' + esc(c) + '</span>';
        }).join('') + '</div>' : '') +
        (p.priceLabel ? '<div class="shop-price">' + esc(p.priceLabel) + '</div>' : '') +
        leadLine(p) +
      '</a>' +
      '<div class="shop-card-cta">' + cta(p) + '</div>' +
    '</article>';
  }

  function bindAddButtons(root) {
    $all('[data-add]', root || document).forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var p = byHandle(btn.getAttribute('data-add'));
        if (!p || !p.canAddToCart || !p.variants.length) return;
        SpectrumStoreCart.add({
          variantId: p.variants[0].id,
          handle: p.handle,
          name: p.name,
          sku: p.sku,
          image: photoOrFallback(p),
          priceLabel: p.priceLabel
        }, 1);
        if (window.SpectrumAnalytics && SpectrumAnalytics.track) SpectrumAnalytics.track('add_to_cart');
        updateCartBadge();
        openCartDrawer();
      });
    });
  }

  function renderHome() {
    var featured = products().filter(function (p) { return p.featured; });
    var buy = products().filter(function (p) { return p.mode === 'buy'; });
    var control = inCollection('control');
    var spares = products().filter(function (p) { return p.collectionSlug === 'spares' || p.collectionSlug === 'accessories'; });
    var arrived = buy.filter(function (p) { return !p.featured; }).slice(0, 8);
    var html = '';
    if (featured.length) {
      html += '<section class="shop-section" id="whats-new"><div class="shop-wrap">' +
        '<div class="shop-section-head"><h2 class="shop-h">' + t('store.homeWhatsNew', 'Take a look at <em>what’s new</em>') + '</h2></div>' +
        '<div class="shop-editorial">' + featured.map(function (p) {
          var photo = photoFor(p, 'card');
          return '<a class="shop-ed-card" href="' + esc(href('/products/' + p.handle)) + '" data-shop-link>' +
            (photo ? '<img src="' + esc(photo) + '" alt="">' : '') +
            '<div class="shop-ed-copy"><div class="shop-new">' + esc(t('store.new', 'New')) + '</div><h3>' + esc(p.name) + '</h3><p>' +
            esc(p.description || '') + '</p></div></a>';
        }).join('') + '</div></div></section>';
    }
    if (arrived.length) {
      html += '<section class="shop-section"><div class="shop-wrap">' +
        '<div class="shop-section-head"><div>' +
        (state.catalog.receivedThisWeek ? '<p class="shop-eyebrow">' + esc(t('store.receivedThisWeek', 'Received this week')) + '</p>' : '') +
        '<h2 class="shop-h">' + t('store.homeArrived', 'Just <em>arrived</em>') + '</h2></div></div>' +
        '<div class="shop-hscroll">' + arrived.map(function (p) { return cardHtml(p); }).join('') +
        '</div></div></section>';
    }
    html += '<section class="shop-section"><div class="shop-wrap">' +
      '<div class="shop-section-head"><h2 class="shop-h">' + t('store.homeControl', 'Shop <em>control</em>') + '</h2></div>' +
      '<div class="shop-grid">' + (control.slice(0, 8).map(function (p) { return cardHtml(p); }).join('') ||
        '<p class="shop-empty">' + esc(t('store.emptyControl', 'Control boxes will appear here as they are published.')) + '</p>') +
      '</div></div></section>';
    html += '<section class="shop-section"><div class="shop-wrap">' +
      '<div class="shop-section-head"><h2 class="shop-h">' + t('store.homeSpares', 'Shop <em>spares &amp; accessories</em>') + '</h2></div>' +
      '<div class="shop-grid">' + (spares.slice(0, 8).map(function (p) { return cardHtml(p); }).join('') ||
        '<p class="shop-empty">' + esc(t('store.emptySpares', 'Spares and accessories will appear here as they are published.')) + '</p>') +
      '</div></div></section>';
    html += '<div class="shop-wrap"><a class="shop-design" href="' + esc(www('/led-wall-calculator')) + '">' +
      '<div class="shop-design-copy"><p class="shop-eyebrow">' + esc(t('store.designEyebrow', 'Design a wall')) + '</p>' +
      '<h2>' + esc(t('store.designH2', 'Configure a custom LED wall on spectrumdisplay.com')) + '</h2>' +
      '<p>' + esc(t('store.designP', 'Cabinets are quoted by the wall — size, pitch, and receiving cards included. This store sells control boxes, spares, and packaged kits.')) + '</p>' +
      '<span class="shop-btn" style="max-width:14rem">' + esc(t('store.configureWall', 'Configure wall')) + '</span></div>' +
      '<div class="shop-design-art" aria-hidden="true"></div></a>' +
      '<p class="shop-quiet">' + esc(t('store.quietWalls', 'Custom walls are quoted on spectrumdisplay.com. New walls include receiving cards. This store sells control boxes, spares, and packaged kits.')) + '</p></div>';
    $('#shop-main').innerHTML = html;
    bindAddButtons($('#shop-main'));
  }

  function subtypePills(list) {
    var counts = { all: list.length };
    list.forEach(function (p) {
      var key = p.subtype || 'other';
      counts[key] = (counts[key] || 0) + 1;
    });
    var labels = {
      all: t('store.filterAll', 'All'),
      'all-in-one': t('store.filterProcessors', 'Processors'),
      sending: t('store.filterSenders', 'Senders'),
      playback: t('store.filterPlayback', 'Playback'),
      'receiving-card': t('store.filterSpares', 'Spares'),
      accessories: t('store.filterAccessories', 'Accessories'),
      fiber: t('store.filterFiber', 'Fiber'),
      other: t('store.filterOther', 'Other')
    };
    var keys = Object.keys(counts).filter(function (k) { return k === 'all' || (counts[k] && k !== 'other') || (k === 'other' && counts.other && Object.keys(counts).length > 2); });
    if (keys.length <= 2) return '';
    return '<div class="shop-filters">' + keys.map(function (k) {
      var on = state.filter === k || (k === 'all' && state.filter === 'all');
      return '<button type="button" class="shop-pill' + (on ? ' is-on' : '') + '" data-filter="' + esc(k) + '">' +
        esc(labels[k] || k) + ' (' + counts[k] + ')</button>';
    }).join('') + '</div>';
  }

  function renderCollection(slug) {
    var col = collections().filter(function (c) { return c.slug === slug; })[0];
    var list = inCollection(slug);
    var filtered = list;
    if (state.filter && state.filter !== 'all') {
      filtered = list.filter(function (p) { return (p.subtype || 'other') === state.filter; });
    }
    var title = col ? colLabel(col.slug, col.label) : colLabel(slug, slug);
    var html = '<section class="shop-section"><div class="shop-wrap">' +
      '<h1 class="shop-h">' + esc(title) + '</h1>' +
      subtypePills(list) +
      '<div class="shop-grid">' + (filtered.map(function (p) { return cardHtml(p); }).join('') ||
        '<p class="shop-empty">' + esc(t('store.emptyCollection', 'Nothing in this collection yet.')) + '</p>') +
      '</div></div></section>';
    $('#shop-main').innerHTML = html;
    $all('[data-filter]').forEach(function (btn) {
      btn.onclick = function () {
        state.filter = btn.getAttribute('data-filter') || 'all';
        renderCollection(slug);
      };
    });
    bindAddButtons($('#shop-main'));
  }

  function renderProduct(handle) {
    var p = byHandle(handle);
    if (!p) {
      $('#shop-main').innerHTML = '<div class="shop-wrap shop-page"><h1>' + esc(t('store.productNotFound', 'Product not found')) +
        '</h1><p><a href="' + esc(href('/')) + '" data-shop-link>' + esc(t('store.backToStore', 'Back to store')) + '</a></p></div>';
      return;
    }
    state.qty = 1;
    state.variantId = (p.variants[0] && p.variants[0].id) || '';
    var photos = [p.image].concat(p.gallery || []).filter(Boolean);
    if (!photos.length) {
      var fallback = photoOrFallback(p);
      if (fallback) photos = [fallback];
    }
    var photo = imgSrc(photos[0], 'card');
    var html = '<div class="shop-wrap"><div class="shop-pdp">' +
      '<div><div class="shop-pdp-photo">' + (photo ? '<img id="pdp-photo" src="' + esc(photo) + '" alt="">' : '') + '</div>' +
      (photos.length > 1 ? '<div class="shop-thumbs">' + photos.map(function (src, i) {
        return '<button type="button" data-photo="' + esc(imgSrc(src, 'card')) + '" class="' + (i === 0 ? 'is-on' : '') + '"><img src="' + esc(imgSrc(src, 'thumb')) + '" alt=""></button>';
      }).join('') + '</div>' : '') + '</div>' +
      '<div>' +
        '<h1>' + esc(p.name) + '</h1>' +
        '<div class="shop-sku">' + esc(p.sku) + '</div>' +
        (p.priceLabel ? '<div class="shop-price" style="margin-top:.6rem">' + esc(p.priceLabel) + '</div>' : '') +
        leadLine(p) +
        (p.hasOptions ? '<div class="shop-filters" style="margin:.8rem 0">' + p.variants.map(function (v, i) {
          return '<button type="button" class="shop-pill' + (i === 0 ? ' is-on' : '') + '" data-variant="' + esc(v.id) + '">' + esc(v.title) + '</button>';
        }).join('') + '</div>' : '') +
        (p.mode === 'buy' ? '<div class="shop-qty"><button type="button" data-qty="-1" aria-label="' + esc(t('store.less', 'Less')) + '">−</button><span data-qty-val>1</span><button type="button" data-qty="1" aria-label="' + esc(t('store.more', 'More')) + '">+</button></div>' : '') +
        (p.mode === 'configure'
          ? '<a class="shop-btn" href="' + esc(p.configureUrl) + '">' + esc(t('store.configureWall', 'Configure wall')) + '</a>'
          : (p.canAddToCart
            ? '<button class="shop-btn" type="button" id="pdp-add">' + esc(t('store.addToCart', 'Add to cart')) + '</button>'
            : '<button class="shop-btn is-off" type="button" disabled>' + esc(t('store.addToCart', 'Add to cart')) + '</button>')) +
        '<div class="shop-chips" style="margin-top:1rem">' + (p.chips || []).map(function (c) {
          return '<span class="shop-chip">' + esc(c) + '</span>';
        }).join('') + '</div>' +
        '<p class="shop-pdp-desc">' + esc(p.description) + '</p>' +
        (p.replacementOnly
          ? '<div class="shop-note"><strong>' + esc(t('store.replacementOnly', 'Replacement only.')) + '</strong> ' +
            esc(t('store.replacementNote', 'New Spectrum walls already include receiving cards in the cabinet price.')) + '</div>'
          : '') +
        '<div class="shop-note"><strong>' + esc(t('store.inTheBox', 'In the box')) + '</strong>' +
        esc(t('store.inTheBoxRest', ' — unit as listed. Warranty: manufacturer coverage plus Spectrum’s 3-year support layer (COB 3+5 only on selected COB panels). ')) +
        esc(p.mode === 'buy'
          ? t('store.freightBuy', 'Oversized LED freight is confirmed by Spectrum before the truck is booked. Small control and spare orders ship parcel.')
          : t('store.freightConfigure', 'Custom walls are quoted on spectrumdisplay.com. Cabinets ship freight from Azusa after the quote is accepted.')) +
        '</div>' +
      '</div></div></div>';
    $('#shop-main').innerHTML = html;
    $all('[data-photo]').forEach(function (btn) {
      btn.onclick = function () {
        $all('[data-photo]').forEach(function (b) { b.classList.remove('is-on'); });
        btn.classList.add('is-on');
        var img = $('#pdp-photo');
        if (img) img.src = btn.getAttribute('data-photo');
      };
    });
    $all('[data-variant]').forEach(function (btn) {
      btn.onclick = function () {
        $all('[data-variant]').forEach(function (b) { b.classList.remove('is-on'); });
        btn.classList.add('is-on');
        state.variantId = btn.getAttribute('data-variant');
      };
    });
    $all('[data-qty]').forEach(function (btn) {
      btn.onclick = function () {
        state.qty = Math.max(1, state.qty + Number(btn.getAttribute('data-qty')));
        var el = $('[data-qty-val]');
        if (el) el.textContent = String(state.qty);
      };
    });
    var add = $('#pdp-add');
    if (add) {
      add.onclick = function () {
        var vid = state.variantId || (p.variants[0] && p.variants[0].id);
        if (!vid) return;
        SpectrumStoreCart.add({
          variantId: vid,
          handle: p.handle,
          name: p.name,
          sku: p.sku,
          image: photoOrFallback(p),
          priceLabel: p.priceLabel
        }, state.qty);
        if (window.SpectrumAnalytics && SpectrumAnalytics.track) SpectrumAnalytics.track('add_to_cart');
        updateCartBadge();
        openCartDrawer();
      };
    }
  }

  var POLICY_SRC = {
    shipping: '/shipping.html',
    returns: '/shipping.html',
    warranty: '/warranty.html',
    privacy: '/privacy.html',
    terms: '/terms.html'
  };

  function renderPage(slug) {
    var src = POLICY_SRC[slug];
    $('#shop-main').innerHTML = '<div class="shop-wrap shop-page"><p class="shop-empty">' + esc(t('store.loading', 'Loading…')) + '</p></div>';
    if (!src) {
      $('#shop-main').innerHTML = '<div class="shop-wrap shop-page"><h1>' + esc(t('store.notFound', 'Not found')) + '</h1></div>';
      return;
    }
    fetch(src, { headers: { Accept: 'text/html' } }).then(function (res) { return res.text(); }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var article = doc.querySelector('.war-card') || doc.querySelector('article');
      var title = (doc.querySelector('h1') && doc.querySelector('h1').textContent) || slug;
      $('#shop-main').innerHTML = '<div class="shop-wrap shop-page"><h1>' + esc(title) + '</h1>' +
        (article ? article.innerHTML : '<p>' + esc(t('store.seePolicy', 'See the full policy on spectrumdisplay.com.')) + '</p>') + '</div>';
    }).catch(function () {
      $('#shop-main').innerHTML = '<div class="shop-wrap shop-page"><h1>' + esc(t('store.policy', 'Policy')) +
        '</h1><p>' + esc(t('store.openFullPage', 'Open the full page on')) +
        ' <a href="' + esc(www('/' + slug + '.html')) + '">spectrumdisplay.com</a>.</p></div>';
    });
  }

  function renderSearch(q) {
    var box = $('#shop-search-hits');
    if (!box) return;
    q = String(q || '').trim().toLowerCase();
    if (!q) { box.innerHTML = ''; return; }
    var hits = products().filter(function (p) {
      return (p.name + ' ' + p.sku + ' ' + p.brandName + ' ' + p.description).toLowerCase().indexOf(q) !== -1;
    }).slice(0, 8);
    box.innerHTML = hits.map(function (p) {
      return '<a href="' + esc(href('/products/' + p.handle)) + '" data-shop-link>' +
        (photoFor(p, 'thumb') ? '<img src="' + esc(photoFor(p, 'thumb')) + '" alt="">' : '') +
        '<span><strong>' + esc(p.name) + '</strong><div class="shop-sku">' + esc(p.sku) + '</div></span></a>';
    }).join('') || '<p class="shop-empty">' + esc(t('store.noMatches', 'No matches.')) + '</p>';
    $all('#shop-search-hits a').forEach(function (a) {
      a.addEventListener('click', function () {
        $('#shop-search').classList.remove('is-on');
      });
    });
  }

  function setTitle(route) {
    var suffix = t('store.titleSuffix', 'Spectrum Store');
    var title = t('store.title', 'US Store | Spectrum Display');
    if (route.name === 'collection') title = colLabel(route.slug, route.slug || t('store.collection', 'Collection')) + ' | ' + suffix;
    if (route.name === 'product') {
      var p = byHandle(route.handle);
      if (p) title = p.name + ' | ' + suffix;
    }
    if (route.name === 'cart') title = t('store.titleCart', 'Cart | Spectrum Store');
    document.title = title;
  }

  function render() {
    var route = parseRoute();
    renderChrome(route);
    setTitle(route);
    if (route.name === 'collection') {
      if (state.collectionSlug !== route.slug) {
        state.collectionSlug = route.slug;
        state.filter = 'all';
      }
      renderCollection(route.slug);
    } else {
      state.collectionSlug = '';
      state.filter = 'all';
      if (route.name === 'product') renderProduct(route.handle);
      else if (route.name === 'cart') {
        renderHome();
        openCartDrawer();
      }
      else if (route.name === 'page') renderPage(route.slug);
      else renderHome();
    }
    if (location.hash === '#whats-new') {
      var el = document.getElementById('whats-new');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function boot() {
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') WWW = '';
    bindChrome();
    bindSettings();
    bindCartDrawer();
    window.addEventListener('popstate', render);
    window.addEventListener('spectrum:store-cart', function () {
      updateCartBadge();
      if (document.body.classList.contains('shop-cart-open')) fillCartDrawer();
    });
    fetch('/api/store/catalog', { headers: { Accept: 'application/json' } })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        state.catalog = data && data.ok ? data : { products: [], collections: [], shop: '' };
        if (state.catalog.wwwOrigin && WWW === 'https://www.spectrumdisplay.com') WWW = state.catalog.wwwOrigin;
        render();
      })
      .catch(function () {
        state.catalog = { products: [], collections: [], shop: '' };
        render();
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
