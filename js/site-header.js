/**
 * Spectrum Display — header (Sign in / Language hover menus)
 * Header markup is static in HTML so it never jumps on load.
 */
(function () {
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function canHover() {
    return window.matchMedia && window.matchMedia('(hover: hover)').matches;
  }

  function closeAll(except) {
    $all('.site-drop.is-open').forEach(function (el) {
      if (el !== except) el.classList.remove('is-open');
    });
  }

  function bindDrop(wrap) {
    if (!wrap) return;
    var btn = wrap.querySelector('.site-util');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      if (canHover()) return;
      e.preventDefault();
      e.stopPropagation();
      var open = wrap.classList.contains('is-open');
      closeAll();
      if (!open) wrap.classList.add('is-open');
    });
  }

  function applyAuth() {
    var header = $('.site-header');
    if (!header) return;
    var session = window.SpectrumAuth && SpectrumAuth.getSession && SpectrumAuth.getSession();
    var on = !!session;
    document.documentElement.classList.toggle('is-logged-in', on);
    header.classList.toggle('is-logged-in', on);
    var name = session ? (session.name || session.email || '') : '';
    var nameEl = $('#hdr-user-name');
    var namePanel = $('#hdr-user-name-panel');
    var roleEl = $('#hdr-user-role');
    if (nameEl) nameEl.textContent = name;
    if (namePanel) namePanel.textContent = name;
    if (roleEl) {
      roleEl.textContent = session
        ? (session.role === 'dealer' ? 'Dealer / Integrator' : 'Customer / End user')
        : '';
    }
  }

  function applyLangLabel() {
    var label = $('#hdr-lang-label');
    var lang = (window.SpectrumI18n && SpectrumI18n.lang) || localStorage.getItem('spectrumLang') || 'en';
    var names = { en: 'English', es: 'Español', fr: 'Français', ko: '한국어', ja: '日本語', zh: '中文' };
    if (label) label.textContent = names[lang] || 'English';
    $all('[data-set-lang]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-set-lang') === lang);
    });
  }

  function icon(path) {
    return '<svg fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24" aria-hidden="true">' + path + '</svg>';
  }

  function injectTabbar() {
    if ($('#site-tabbar') || !document.body) return;
    var nav = document.createElement('nav');
    nav.className = 'site-tabbar';
    nav.id = 'site-tabbar';
    nav.setAttribute('aria-label', 'Main');
    nav.innerHTML =
      '<a href="products.html" data-tab="products">' +
        icon('<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 4.5h6v6h-6v-6zm9 0h6v6h-6v-6zm-9 9h6v6h-6v-6zm9 0h6v6h-6v-6z"/>') +
        '<span data-i18n="nav.products">Products</span></a>' +
      '<a href="solutions.html" data-tab="solutions">' +
        icon('<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h12A2.25 2.25 0 0120.25 6v8.25A2.25 2.25 0 0118 16.5H6a2.25 2.25 0 01-2.25-2.25V6zM8.25 19.5h7.5"/>') +
        '<span data-i18n="nav.solutions">Solutions</span></a>' +
      '<a href="designer.html" data-tab="designer">' +
        icon('<path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zM16.862 4.487L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/>') +
        '<span data-i18n="nav.tabDesigner">Calculator</span></a>' +
      '<a href="account.html" data-tab="account">' +
        icon('<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 7.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 19.5a7.5 7.5 0 0115 0"/>') +
        '<span data-i18n="nav.account">Account</span></a>';
    document.body.appendChild(nav);

    var file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    var tab = '';
    if (file === 'products.html' || file === 'product.html') tab = 'products';
    else if (file === 'solutions.html') tab = 'solutions';
    else if (file === 'designer.html') tab = 'designer';
    else if (file === 'account.html') tab = 'account';
    $all('[data-tab]', nav).forEach(function (a) {
      var on = tab && a.getAttribute('data-tab') === tab;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function chevron() {
    return '<svg class="site-nav-chevron" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>';
  }

  var PRODUCT_MEGA = {
    popular: {
      title: 'Popular',
      lead: 'Most requested LED cabinets for new walls and upgrades.',
      items: [
        { name: 'Discovery Series', href: 'product.html?brand=trt&series=discovery', tag: 'TRT' },
        { name: 'LedPoster', href: 'product.html?brand=trt&series=ledposter', tag: 'TRT' },
        { name: 'Fine Pitch COB', href: 'product.html?brand=bako&series=finepitch', tag: 'BAKO' },
        { name: 'MV Ultra (Rental)', href: 'product.html?brand=gloshine&series=mvultra', tag: 'GLO' },
        { name: 'Diamond Rental', href: 'product.html?brand=bako&series=diamond', tag: 'BAKO' },
        { name: 'DIAO Pro Fixed', href: 'product.html?brand=diao&series=pro', tag: 'DIAO' }
      ]
    },
    cob: {
      title: 'COB',
      lead: 'Chip-on-board cabinets for close viewing and high contrast.',
      items: [
        { name: 'Discovery Series', href: 'product.html?brand=trt&series=discovery', tag: 'TRT' },
        { name: 'Fine Pitch COB', href: 'product.html?brand=bako&series=finepitch', tag: 'BAKO' }
      ]
    },
    rental: {
      title: 'Rental',
      lead: 'Lightweight touring panels for events, stages, and XR.',
      items: [
        { name: 'MV Ultra (Rental)', href: 'product.html?brand=gloshine&series=mvultra', tag: 'GLO' },
        { name: 'Diamond Rental', href: 'product.html?brand=bako&series=diamond', tag: 'BAKO' },
        { name: 'Element Rental', href: 'product.html?brand=element&series=rental', tag: 'ELT' }
      ]
    },
    indoor: {
      title: 'Indoor Fine Pitch',
      lead: 'Control rooms, retail, lobbies, and broadcast walls.',
      items: [
        { name: 'Discovery Series', href: 'product.html?brand=trt&series=discovery', tag: 'TRT' },
        { name: 'Fine Pitch COB', href: 'product.html?brand=bako&series=finepitch', tag: 'BAKO' },
        { name: 'LedPoster', href: 'product.html?brand=trt&series=ledposter', tag: 'TRT' },
        { name: 'DIAO Pro Fixed', href: 'product.html?brand=diao&series=pro', tag: 'DIAO' },
        { name: 'Element Creative / XR', href: 'product.html?brand=element&series=creative', tag: 'ELT' }
      ]
    },
    outdoor: {
      title: 'Outdoor',
      lead: 'High-brightness façades, DOOH, and outdoor spectaculars.',
      items: [
        { name: 'DN Outdoor', href: 'product.html?brand=gloshine&series=dn', tag: 'GLO' },
        { name: 'DIAO Value', href: 'product.html?brand=diao&series=value', tag: 'DIAO' }
      ]
    }
  };

  function productGridHtml(items) {
    return items.map(function (item) {
      return '<a href="' + item.href + '"><span class="site-mega-dot">' + item.tag + '</span><span>' + item.name + '</span></a>';
    }).join('');
  }

  function megaProductsInnerHtml() {
    return (
      '<div class="site-mega-products">' +
        '<div class="site-mega-cats" role="tablist">' +
          '<button type="button" class="site-mega-cat is-active" data-cat="popular">Popular <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg></button>' +
          '<button type="button" class="site-mega-cat" data-cat="cob">COB <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg></button>' +
          '<button type="button" class="site-mega-cat" data-cat="rental">Rental <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg></button>' +
          '<button type="button" class="site-mega-cat" data-cat="indoor">Indoor Fine Pitch <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg></button>' +
          '<button type="button" class="site-mega-cat" data-cat="outdoor">Outdoor <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg></button>' +
        '</div>' +
        '<div class="site-mega-body">' +
          '<h3 data-mega-title>Popular</h3>' +
          '<p data-mega-lead>Most requested LED cabinets for new walls and upgrades.</p>' +
          '<div class="site-mega-grid" data-mega-grid></div>' +
        '</div>' +
      '</div>' +
      '<div class="site-mega-foot">' +
        '<a href="products.html">View all products →</a>' +
        '<a href="designer.html">LED Wall Calculator →</a>' +
      '</div>'
    );
  }

  function megaCatFromUrl() {
    var cat = (new URLSearchParams(location.search).get('cat') || '').toLowerCase();
    var map = { cob: 'cob', rental: 'rental', indoor: 'indoor', outdoor: 'outdoor', 'micro-led': 'indoor' };
    return map[cat] || 'popular';
  }

  function renderProductMega(key) {
    var data = PRODUCT_MEGA[key] || PRODUCT_MEGA.popular;
    $all('[data-mega-title]').forEach(function (el) { el.textContent = data.title; });
    $all('[data-mega-lead]').forEach(function (el) { el.textContent = data.lead; });
    $all('[data-mega-grid]').forEach(function (el) { el.innerHTML = productGridHtml(data.items); });
    $all('.site-mega-cat').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-cat') === key);
    });
  }

  function injectMobileProductBrowse() {
    var host = $('#mobile-product-mega');
    if (!host || host.getAttribute('data-ready')) return;
    host.setAttribute('data-ready', '1');
    host.innerHTML = megaProductsInnerHtml();
  }

  function injectNav() {
    var nav = $('#site-nav');
    if (!nav) return;
    var file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    nav.innerHTML =
      '<div class="site-nav-item" data-mega="products">' +
        '<button type="button" class="site-nav-link' + (file === 'products.html' || file === 'product.html' ? ' is-active' : '') + '" aria-expanded="false" aria-haspopup="true">' +
          '<span data-i18n="nav.products">Products</span>' + chevron() +
        '</button>' +
      '</div>' +
      '<a class="site-nav-link" href="products.html?cat=micro-led" data-i18n="nav.microLed">Micro LED TV</a>' +
      '<a class="site-nav-link" href="products.html?cat=cob" data-i18n="nav.cob">COB</a>' +
      '<div class="site-nav-item" data-mega="solutions">' +
        '<button type="button" class="site-nav-link' + (file === 'solutions.html' ? ' is-active' : '') + '" aria-expanded="false" aria-haspopup="true">' +
          '<span data-i18n="nav.solutions">Solutions</span>' + chevron() +
        '</button>' +
      '</div>' +
      '<a class="site-nav-link' + (file === 'designer.html' ? ' is-active' : '') + '" href="designer.html" data-i18n="nav.designer">LED Wall Calculator</a>';

    var header = $('.site-header');
    if (!header || $('#site-mega-products')) return;

    var prod = document.createElement('div');
    prod.id = 'site-mega-products';
    prod.className = 'site-mega-panel';
    prod.innerHTML = megaProductsInnerHtml();
    header.appendChild(prod);
    renderProductMega(megaCatFromUrl());

    var sol = document.createElement('div');
    sol.id = 'site-mega-solutions';
    sol.className = 'site-mega-panel';
    sol.innerHTML =
      '<div class="site-mega-solutions">' +
        '<div class="site-mega-col">' +
          '<h4>By industry</h4>' +
          '<a href="solutions.html#corporate">Corporate</a>' +
          '<a href="solutions.html#control-rooms">Control rooms</a>' +
          '<a href="solutions.html#retail">Retail</a>' +
          '<a href="solutions.html#education">Education</a>' +
          '<a href="solutions.html#broadcast">Broadcast</a>' +
          '<a href="solutions.html#sports">Sports & events</a>' +
          '<a href="solutions.html#worship">House of worship</a>' +
          '<a href="solutions.html#hospitality">Hospitality</a>' +
        '</div>' +
        '<div class="site-mega-col">' +
          '<h4>By audience</h4>' +
          '<a href="solutions.html#integrators">Integrators & dealers</a>' +
          '<a href="solutions.html#end-users">End users</a>' +
          '<a href="solutions.html#rental-houses">Rental houses</a>' +
          '<div class="mega-sub">Applications</div>' +
          '<a href="products.html?cat=indoor">Indoor fine pitch</a>' +
          '<a href="products.html?cat=outdoor">Outdoor</a>' +
          '<a href="products.html?cat=rental">Rental & touring</a>' +
        '</div>' +
        '<div class="site-mega-col">' +
          '<h4>Technologies</h4>' +
          '<a href="products.html?cat=cob">COB</a>' +
          '<a href="products.html?cat=micro-led">Micro LED TV</a>' +
          '<a href="solutions.html#fine-pitch">Fine pitch walls</a>' +
          '<a href="brands.html">Our brands</a>' +
        '</div>' +
        '<div class="site-mega-col">' +
          '<h4>Tools</h4>' +
          '<a href="designer.html">LED Wall Calculator</a>' +
          '<a href="support.html">Support</a>' +
          '<a href="contact.html">Contact Sales</a>' +
          '<a href="account.html">Sign in</a>' +
        '</div>' +
      '</div>' +
      '<div class="site-mega-foot">' +
        '<a href="solutions.html">Explore all solutions →</a>' +
        '<a href="contact.html">Talk to sales →</a>' +
      '</div>';
    header.appendChild(sol);
  }

  function injectSalesCta() {
    var utils = $('.site-utils');
    if (!utils || utils.querySelector('.site-cta')) return;
    var contact = utils.querySelector('a.site-util[href="contact.html"]');
    var html =
      '<a href="support.html" class="site-util site-support-link"><span data-i18n="nav.support">Support</span></a>' +
      '<a href="contact.html" class="site-cta" data-i18n="nav.contactSales">Contact Sales</a>' +
      '<a href="contact.html" class="site-util site-contact-icon" aria-label="Contact Sales">' +
        '<svg fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>' +
      '</a>';
    if (contact) {
      contact.insertAdjacentHTML('beforebegin', html);
      contact.remove();
    } else {
      var lang = $('#hdr-lang-drop');
      if (lang) lang.insertAdjacentHTML('beforebegin', html);
      else utils.insertAdjacentHTML('afterbegin', html);
    }
  }

  function closeMegas() {
    $all('.site-mega-panel.is-open').forEach(function (el) { el.classList.remove('is-open'); });
    $all('.site-nav-item.is-open').forEach(function (el) {
      el.classList.remove('is-open');
      var btn = el.querySelector('.site-nav-link');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  }

  function placeMega(panel, item) {
    if (!panel || !item) return;
    var header = $('.site-header');
    var top = header ? header.getBoundingClientRect().bottom : item.getBoundingClientRect().bottom;
    var label = item.querySelector('.site-nav-link span') || item;
    var triggerLeft = label.getBoundingClientRect().left;
    var gutter = 16;
    var preferred = Math.min(72 * 16, window.innerWidth - gutter * 2);
    var roomRight = window.innerWidth - triggerLeft - gutter;
    var left = triggerLeft;
    var width = preferred;
    if (roomRight >= 480) {
      width = Math.min(preferred, roomRight);
    } else {
      left = Math.max(gutter, window.innerWidth - preferred - gutter);
      width = Math.min(preferred, window.innerWidth - left - gutter);
    }
    panel.style.top = Math.round(top) + 'px';
    panel.style.left = Math.round(left) + 'px';
    panel.style.width = Math.round(width) + 'px';
    panel.style.right = 'auto';
    panel.style.transform = 'none';
  }

  function bindMegas() {
    var header = $('.site-header');
    if (!header) return;
    var closeTimer = null;
    function cancelClose() { if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; } }
    function scheduleClose() {
      cancelClose();
      closeTimer = setTimeout(closeMegas, 180);
    }
    $all('.site-nav-item[data-mega]').forEach(function (item) {
      var name = item.getAttribute('data-mega');
      var panel = name === 'products' ? $('#site-mega-products') : $('#site-mega-solutions');
      var btn = item.querySelector('.site-nav-link');
      function open() {
        cancelClose();
        closeMegas();
        closeAll();
        item.classList.add('is-open');
        if (btn) btn.setAttribute('aria-expanded', 'true');
        if (panel) {
          panel.classList.add('is-open');
          placeMega(panel, item);
        }
      }
      item.addEventListener('mouseenter', open);
      item.addEventListener('focusin', open);
      if (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          if (item.classList.contains('is-open')) closeMegas();
          else open();
        });
      }
    });
    $all('.site-mega-panel').forEach(function (panel) {
      panel.addEventListener('mouseenter', cancelClose);
      panel.addEventListener('mouseleave', scheduleClose);
    });
    var nav = $('#site-nav');
    if (nav) {
      nav.addEventListener('mouseleave', function (e) {
        var next = e.relatedTarget;
        if (next && next.closest && next.closest('.site-mega-panel')) return;
        scheduleClose();
      });
      $all('a.site-nav-link', nav).forEach(function (a) {
        a.addEventListener('mouseenter', closeMegas);
      });
    }
    $all('.site-mega-cat').forEach(function (btn) {
      btn.addEventListener('mouseenter', function () { renderProductMega(btn.getAttribute('data-cat')); });
      btn.addEventListener('click', function () { renderProductMega(btn.getAttribute('data-cat')); });
    });
    $all('.site-utils .site-drop, .site-support-link, .site-cta').forEach(function (el) {
      el.addEventListener('mouseenter', closeMegas);
    });
    window.addEventListener('resize', function () {
      var openItem = $('.site-nav-item.is-open');
      if (!openItem) return;
      var name = openItem.getAttribute('data-mega');
      var panel = name === 'products' ? $('#site-mega-products') : $('#site-mega-solutions');
      placeMega(panel, openItem);
    });
  }

  function bindSearch() {
    var wrap = $('#hdr-search-drop');
    if (!wrap) return;
    bindDrop(wrap);
    var input = $('#hdr-search-input');
    var results = $('#hdr-search-results');
    function matches(p, q) {
      var hay = [p.name, p.brandName, p.description, p.type, p.id].join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    }
    if (input) {
      input.addEventListener('input', function () { render(input.value); });
      wrap.addEventListener('mouseenter', function () {
        closeMegas();
        setTimeout(function () { input.focus(); }, 40);
      });
    }
    function render(q) {
      if (!results) return;
      q = (q || '').trim().toLowerCase();
      if (!q) {
        results.innerHTML = '';
        return;
      }
      var catalog = window.SPECTRUM_PRODUCT_LIST || [];
      if (!catalog.length) {
        results.innerHTML = '<a href="products.html?q=' + encodeURIComponent(q) + '">Search “' + q.replace(/[<>]/g, '') + '”</a>';
        return;
      }
      var list = catalog.filter(function (p) {
        return matches(p, q);
      }).slice(0, 8);
      if (!list.length) {
        results.innerHTML = '<div class="site-search-empty">No matching products</div>';
        return;
      }
      results.innerHTML = list.map(function (p) {
        var href = 'product.html?brand=' + encodeURIComponent(p.brandId) + '&series=' + encodeURIComponent(p.id);
        return '<a href="' + href + '">' + (p.brandName || '') + ' · ' + p.name + '</a>';
      }).join('');
    }
    var form = $('#hdr-search-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        var q = ((input && input.value) || '').trim();
        if (!q) e.preventDefault();
      });
    }
  }

  function boot() {
    injectTabbar();
    injectNav();
    injectMobileProductBrowse();
    renderProductMega(megaCatFromUrl());
    injectSalesCta();
    var header = $('.site-header');
    if (!header) return;

    bindDrop($('#hdr-signin-drop'));
    bindDrop($('#hdr-lang-drop'));
    bindSearch();
    bindMegas();

    $all('[data-set-lang]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var code = btn.getAttribute('data-set-lang');
        if (window.SpectrumI18n && SpectrumI18n.setLang) SpectrumI18n.setLang(code);
        else {
          localStorage.setItem('spectrumLang', code);
          location.reload();
        }
      });
    });

    var logout = $('#hdr-logout');
    if (logout) {
      logout.addEventListener('click', function () {
        var done = function () { location.href = 'index.html'; };
        if (window.SpectrumAuth && SpectrumAuth.logout) {
          Promise.resolve(SpectrumAuth.logout()).then(done).catch(done);
        } else {
          done();
        }
      });
    }

    var menuBtn = $('#hdr-menu-btn');
    if (menuBtn) {
      menuBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        header.classList.toggle('is-nav-open');
      });
    }

    document.addEventListener('click', function (e) {
      if (header.contains(e.target) && (e.target.closest && e.target.closest('.site-drop, #hdr-menu-btn, .site-nav-item, .site-mega-panel'))) return;
      closeAll();
      closeMegas();
      header.classList.remove('is-nav-open');
    });

    applyAuth();
    applyLangLabel();
    window.addEventListener('spectrum:auth', applyAuth);
    if (window.SpectrumAuth && SpectrumAuth.ready) {
      SpectrumAuth.ready.then(applyAuth);
    }

    var cart = [];
    try { cart = JSON.parse(localStorage.getItem('spectrumCart') || '[]'); } catch (err) { cart = []; }
    var count = cart.reduce(function (s, i) { return s + (i.qty || 1); }, 0);
    $all('#cart-count').forEach(function (el) { el.textContent = String(count); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
