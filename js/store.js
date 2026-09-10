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
      { label: 'What’s New', href: href('/#whats-new'), img: '/assets/store/whats-new.webp?v=rail3d', key: 'new' },
      { label: 'Controller', href: href('/collections/control'), img: '/assets/store/controller.webp?v=rail3d', key: 'control' },
      { label: 'Rental Panel', href: href('/collections/rental'), img: '/assets/store/rental-panel.webp?v=rail3d', key: 'rental' },
      { label: 'Poster', href: href('/collections/poster'), img: '/assets/store/poster.webp?v=rail3d', key: 'poster' },
      { label: 'Spares', href: href('/collections/spares'), img: '/assets/store/spares.webp?v=rail3d', key: 'spares' },
      { label: 'Accessories', href: href('/collections/accessories'), img: '/assets/store/accessories.webp?v=rail3d', key: 'accessories' }
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
        if (e.key === 'Escape') overlay.classList.remove('is-on');
      });
    }
    if (input) {
      input.oninput = function () { renderSearch(input.value); };
    }
    document.body.addEventListener('click', function (e) {
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
    var sub = $('#shop-subnav-row');
    if (sub) {
      var links = [{ label: 'What’s New', slug: '', href: href('/') }].concat(collections().map(function (c) {
        return { label: c.label, slug: c.slug, href: href('/collections/' + c.slug) };
      }));
      links.push({ label: 'Design a wall', slug: 'design', href: www('/led-wall-calculator'), ext: true });
      sub.innerHTML = links.map(function (item) {
        var on = route.slug && item.slug === route.slug;
        return '<a class="' + (on ? 'is-on' : '') + '" href="' + esc(item.href) + '"' +
          (item.ext ? '' : ' data-shop-link') + '>' + esc(item.label) + '</a>';
      }).join('');
    }
    var account = $('[data-account]');
    if (account) account.href = www('/account.html');
    var integrator = $('[data-integrator]');
    if (integrator) integrator.href = www('/contact.html');
    var word = $('[data-home]');
    if (word) word.href = href('/');
    var cart = $('[data-cart]');
    if (cart) cart.href = href('/cart');
    $all('footer a[href^="/store"]').forEach(function (a) {
      var path = a.getAttribute('href').replace(/^\/store/, '') || '/';
      a.href = href(path);
      a.setAttribute('data-shop-link', '');
    });
    $all('footer a[href="https://www.spectrumdisplay.com/products.html"]').forEach(function (a) { a.href = www('/products.html'); });
    $all('footer a[href="https://www.spectrumdisplay.com/account.html"]').forEach(function (a) { a.href = www('/account.html'); });
    $all('footer a[href="https://www.spectrumdisplay.com/contact.html"]').forEach(function (a) { a.href = www('/contact.html'); });
    $all('footer a[href="https://www.spectrumdisplay.com/led-wall-calculator"]').forEach(function (a) { a.href = www('/led-wall-calculator'); });
    updateCartBadge();
  }

  function cta(p) {
    if (p.mode === 'configure') {
      return '<a class="shop-btn" href="' + esc(p.configureUrl) + '">Configure wall</a>';
    }
    if (p.hasOptions) {
      return '<a class="shop-btn" href="' + esc(href('/products/' + p.handle)) + '" data-shop-link>Select</a>';
    }
    if (p.canAddToCart) {
      return '<button class="shop-btn" type="button" data-add="' + esc(p.handle) + '">Add to cart</button>';
    }
    return '<button class="shop-btn is-off" type="button" disabled>Add to cart</button>';
  }

  function cardHtml(p, opts) {
    opts = opts || {};
    var photo = imgSrc(p.image, 'card');
    return '<article class="shop-card">' +
      (opts.caption ? '<div class="shop-caption">' + esc(opts.caption) + '</div>' : '') +
      '<div class="shop-card-media">' +
        (photo ? '<img src="' + esc(photo) + '" alt="">' : '') +
        '<div class="shop-card-hover">' +
          '<a class="shop-ghost" href="' + esc(href('/products/' + p.handle)) + '" data-shop-link>Learn more</a>' +
        '</div>' +
      '</div>' +
      '<h3>' + esc(p.name) + '</h3>' +
      '<div class="shop-sku">' + esc(p.sku || p.brandName || '') + '</div>' +
      '<p>' + esc(p.description || '') + '</p>' +
      '<div class="shop-chips">' + (p.chips || []).map(function (c) {
        return '<span class="shop-chip">' + esc(c) + '</span>';
      }).join('') + '</div>' +
      (p.priceLabel ? '<div class="shop-price">' + esc(p.priceLabel) + '</div>' : '') +
      '<div class="shop-lead">' + esc(p.leadLabel || '') + '</div>' +
      cta(p) +
    '</article>';
  }

  function bindAddButtons(root) {
    $all('[data-add]', root || document).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var p = byHandle(btn.getAttribute('data-add'));
        if (!p || !p.canAddToCart || !p.variants.length) return;
        SpectrumStoreCart.add({
          variantId: p.variants[0].id,
          handle: p.handle,
          name: p.name,
          sku: p.sku,
          image: p.image,
          priceLabel: p.priceLabel
        }, 1);
        updateCartBadge();
        go('/cart');
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
        '<div class="shop-section-head"><h2 class="shop-h">Take a look at <em>what’s new</em></h2></div>' +
        '<div class="shop-editorial">' + featured.map(function (p) {
          var photo = imgSrc(p.image, 'card');
          return '<a class="shop-ed-card" href="' + esc(href('/products/' + p.handle)) + '" data-shop-link>' +
            (photo ? '<img src="' + esc(photo) + '" alt="">' : '') +
            '<div class="shop-ed-copy"><div class="shop-new">New</div><h3>' + esc(p.name) + '</h3><p>' +
            esc(p.description || '') + '</p></div></a>';
        }).join('') + '</div></div></section>';
    }
    if (arrived.length) {
      html += '<section class="shop-section"><div class="shop-wrap">' +
        '<div class="shop-section-head"><div>' +
        (state.catalog.receivedThisWeek ? '<p class="shop-eyebrow">Received this week</p>' : '') +
        '<h2 class="shop-h">Just <em>arrived</em></h2></div></div>' +
        '<div class="shop-hscroll">' + arrived.map(function (p) { return cardHtml(p); }).join('') +
        '</div></div></section>';
    }
    html += '<section class="shop-section"><div class="shop-wrap">' +
      '<div class="shop-section-head"><h2 class="shop-h">Shop <em>control</em></h2></div>' +
      '<div class="shop-grid">' + (control.slice(0, 8).map(function (p) { return cardHtml(p); }).join('') ||
        '<p class="shop-empty">Control boxes will appear here as they are published.</p>') +
      '</div></div></section>';
    html += '<section class="shop-section"><div class="shop-wrap">' +
      '<div class="shop-section-head"><h2 class="shop-h">Shop <em>spares &amp; accessories</em></h2></div>' +
      '<div class="shop-grid">' + (spares.slice(0, 8).map(function (p) { return cardHtml(p); }).join('') ||
        '<p class="shop-empty">Spares and accessories will appear here as they are published.</p>') +
      '</div></div></section>';
    html += '<div class="shop-wrap"><a class="shop-design" href="' + esc(www('/led-wall-calculator')) + '">' +
      '<div class="shop-design-copy"><p class="shop-eyebrow">Design a wall</p>' +
      '<h2>Configure a custom LED wall on spectrumdisplay.com</h2>' +
      '<p>Cabinets are quoted by the wall — size, pitch, and receiving cards included. This store sells control boxes, spares, and packaged kits.</p>' +
      '<span class="shop-btn" style="max-width:14rem">Configure wall</span></div>' +
      '<div class="shop-design-art" aria-hidden="true"></div></a>' +
      '<p class="shop-quiet">Custom walls are quoted on spectrumdisplay.com. New walls include receiving cards. This store sells control boxes, spares, and packaged kits.</p></div>';
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
      all: 'All',
      'all-in-one': 'Processors',
      sending: 'Senders',
      playback: 'Playback',
      'receiving-card': 'Spares',
      accessories: 'Accessories',
      fiber: 'Fiber',
      other: 'Other'
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
    var title = col ? col.label : slug;
    var html = '<section class="shop-section"><div class="shop-wrap">' +
      '<h1 class="shop-h">' + esc(title) + '</h1>' +
      subtypePills(list) +
      '<div class="shop-grid">' + (filtered.map(function (p) { return cardHtml(p); }).join('') ||
        '<p class="shop-empty">Nothing in this collection yet.</p>') +
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
      $('#shop-main').innerHTML = '<div class="shop-wrap shop-page"><h1>Product not found</h1><p><a href="' + esc(href('/')) + '" data-shop-link>Back to store</a></p></div>';
      return;
    }
    state.qty = 1;
    state.variantId = (p.variants[0] && p.variants[0].id) || '';
    var photos = [p.image].concat(p.gallery || []).filter(Boolean);
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
        '<div class="shop-lead">' + esc(p.leadLabel) + (p.mode === 'buy' ? ' | Parcel when the Shopify profile allows' : '') + '</div>' +
        (p.hasOptions ? '<div class="shop-filters" style="margin:.8rem 0">' + p.variants.map(function (v, i) {
          return '<button type="button" class="shop-pill' + (i === 0 ? ' is-on' : '') + '" data-variant="' + esc(v.id) + '">' + esc(v.title) + '</button>';
        }).join('') + '</div>' : '') +
        (p.mode === 'buy' ? '<div class="shop-qty"><button type="button" data-qty="-1" aria-label="Less">−</button><span data-qty-val>1</span><button type="button" data-qty="1" aria-label="More">+</button></div>' : '') +
        (p.mode === 'configure'
          ? '<a class="shop-btn" href="' + esc(p.configureUrl) + '">Configure wall</a>'
          : (p.canAddToCart
            ? '<button class="shop-btn" type="button" id="pdp-add">Add to cart</button>'
            : '<button class="shop-btn is-off" type="button" disabled>Add to cart</button>')) +
        '<div class="shop-chips" style="margin-top:1rem">' + (p.chips || []).map(function (c) {
          return '<span class="shop-chip">' + esc(c) + '</span>';
        }).join('') + '</div>' +
        '<p style="color:#4b5563;line-height:1.5">' + esc(p.description) + '</p>' +
        (p.replacementOnly
          ? '<div class="shop-note"><strong>Replacement only.</strong> New Spectrum walls already include receiving cards in the cabinet price.</div>'
          : '') +
        '<div class="shop-note"><strong>In the box</strong> — unit as listed. Warranty: manufacturer coverage plus Spectrum’s 3-year support layer (COB 3+5 only on selected COB panels). ' +
        (p.mode === 'buy'
          ? 'Oversized LED freight is confirmed by Spectrum before the truck is booked. Small control and spare orders ship parcel.'
          : 'Custom walls are quoted on spectrumdisplay.com. Cabinets ship freight from Azusa after the quote is accepted.') +
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
          image: p.image,
          priceLabel: p.priceLabel
        }, state.qty);
        updateCartBadge();
        go('/cart');
      };
    }
  }

  function renderCart() {
    var items = SpectrumStoreCart.read();
    var ready = !!(shop() && items.length);
    var html = '<div class="shop-wrap shop-cart-page"><h1 class="shop-h">Cart</h1>';
    if (!items.length) {
      html += '<p class="shop-empty">Your cart is empty.</p><p><a class="shop-btn" style="max-width:12rem" href="' + esc(href('/')) + '" data-shop-link>Continue shopping</a></p>';
    } else {
      html += items.map(function (line) {
        return '<div class="shop-cart-line">' +
          (line.image ? '<img src="' + esc(imgSrc(line.image, 'thumb')) + '" alt="">' : '<div></div>') +
          '<div><strong>' + esc(line.name) + '</strong><div class="shop-sku">' + esc(line.sku) + ' · qty ' + esc(line.qty) + '</div></div>' +
          '<div>' + esc(line.priceLabel || '') + '</div></div>';
      }).join('');
      html += '<p class="shop-quiet">Checkout opens Shopify. Spectrum does not collect cards on this page. Oversized LED freight is confirmed by Spectrum before the truck is booked. Small control and spare orders ship parcel.</p>';
      if (ready) {
        html += '<a class="shop-btn" style="max-width:16rem" href="' + esc(SpectrumStoreCart.checkoutUrl(shop())) + '">Check out</a>';
      } else {
        html += '<button class="shop-btn is-off" type="button" disabled>Check out</button>' +
          '<p class="shop-quiet">Checkout is not connected yet. Catalog stays visible — no payment is taken on this site.</p>';
      }
    }
    html += '</div>';
    $('#shop-main').innerHTML = html;
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
    $('#shop-main').innerHTML = '<div class="shop-wrap shop-page"><p class="shop-empty">Loading…</p></div>';
    if (!src) {
      $('#shop-main').innerHTML = '<div class="shop-wrap shop-page"><h1>Not found</h1></div>';
      return;
    }
    fetch(src, { headers: { Accept: 'text/html' } }).then(function (res) { return res.text(); }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var article = doc.querySelector('.war-card') || doc.querySelector('article');
      var title = (doc.querySelector('h1') && doc.querySelector('h1').textContent) || slug;
      $('#shop-main').innerHTML = '<div class="shop-wrap shop-page"><h1>' + esc(title) + '</h1>' +
        (article ? article.innerHTML : '<p>See the full policy on spectrumdisplay.com.</p>') + '</div>';
    }).catch(function () {
      $('#shop-main').innerHTML = '<div class="shop-wrap shop-page"><h1>Policy</h1><p>Open the full page on <a href="' + esc(www('/' + slug + '.html')) + '">spectrumdisplay.com</a>.</p></div>';
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
        (p.image ? '<img src="' + esc(imgSrc(p.image, 'thumb')) + '" alt="">' : '') +
        '<span><strong>' + esc(p.name) + '</strong><div class="shop-sku">' + esc(p.sku) + '</div></span></a>';
    }).join('') || '<p class="shop-empty">No matches.</p>';
    $all('#shop-search-hits a').forEach(function (a) {
      a.addEventListener('click', function () {
        $('#shop-search').classList.remove('is-on');
      });
    });
  }

  function setTitle(route) {
    var t = 'US Store | Spectrum Display';
    if (route.name === 'collection') t = (route.slug || 'Collection') + ' | Spectrum Store';
    if (route.name === 'product') {
      var p = byHandle(route.handle);
      if (p) t = p.name + ' | Spectrum Store';
    }
    if (route.name === 'cart') t = 'Cart | Spectrum Store';
    document.title = t;
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
      else if (route.name === 'cart') renderCart();
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
    window.addEventListener('popstate', render);
    window.addEventListener('spectrum:store-cart', updateCartBadge);
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
