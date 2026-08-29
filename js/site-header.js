/**
 * Spectrum Display — header (Sign in goes to account; Language / mega menus open on click)
 * Header markup is static in HTML so it never jumps on load.
 */
(function () {
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function absUrl(href) {
    if (!href) return href;
    if (/^(https?:|mailto:|tel:|#|\/)/i.test(href)) return href;
    return '/' + href;
  }

  function pathFile() {
    return (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  }

  function onCalculatorPath() {
    var p = (location.pathname || '').toLowerCase().replace(/\/$/, '') || '/';
    var file = pathFile();
    return file === 'designer.html' || file === 'led-wall-calculator' || p === '/led-wall-calculator';
  }

  function onSolutionsPath() {
    var p = (location.pathname || '').toLowerCase().replace(/\/$/, '') || '/';
    if (
      p === '/retail-hospitality' ||
      p === '/worship' ||
      p === '/corporate' ||
      p === '/events-xr' ||
      p === '/outdoor' ||
      p === '/home-theater' ||
      p === '/solutions' ||
      p === '/solutions.html'
    ) return true;
    return p.indexOf('/solutions/') === 0;
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
      e.preventDefault();
      e.stopPropagation();
      var open = wrap.classList.contains('is-open');
      closeAll();
      closeMegas();
      if (!open) {
        wrap.classList.add('is-open');
        var input = wrap.querySelector('input');
        if (input) setTimeout(function () { input.focus(); }, 40);
      }
    });
  }

  /** Guests go straight to account.html; signed-in users keep the account dropdown. */
  function bindSigninDrop(wrap) {
    if (!wrap) return;
    var btn = wrap.querySelector('.site-util');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var session = window.SpectrumAuth && SpectrumAuth.getSession && SpectrumAuth.getSession();
      if (!session) {
        closeAll();
        closeMegas();
        location.href = '/account.html';
        return;
      }
      var open = wrap.classList.contains('is-open');
      closeAll();
      closeMegas();
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
        ? ((window.SpectrumAuth && SpectrumAuth.roleLabel && SpectrumAuth.roleLabel(session.role)) || 'Customer')
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
      '<a href="/products.html" data-tab="products">' +
        icon('<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 4.5h6v6h-6v-6zm9 0h6v6h-6v-6zm-9 9h6v6h-6v-6zm9 0h6v6h-6v-6z"/>') +
        '<span data-i18n="nav.products">Products</span></a>' +
      '<a href="/retail-hospitality" data-tab="solutions">' +
        icon('<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h12A2.25 2.25 0 0120.25 6v8.25A2.25 2.25 0 0118 16.5H6a2.25 2.25 0 01-2.25-2.25V6zM8.25 19.5h7.5"/>') +
        '<span data-i18n="nav.solutions">Solutions</span></a>' +
      '<a href="/led-wall-calculator" data-tab="designer">' +
        icon('<path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zM16.862 4.487L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/>') +
        '<span data-i18n="nav.tabDesigner">Calculator</span></a>' +
      '<a href="/account.html" data-tab="account">' +
        icon('<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 7.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 19.5a7.5 7.5 0 0115 0"/>') +
        '<span data-i18n="nav.account">Account</span></a>';
    document.body.appendChild(nav);

    var file = pathFile();
    var tab = '';
    if (file === 'products.html' || file === 'product.html') tab = 'products';
    else if (onSolutionsPath()) tab = 'solutions';
    else if (onCalculatorPath()) tab = 'designer';
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

  var MEGA_CAT_CHEVRON = '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>';

  var SERIES_IMG = {
    discovery: 'assets/products/discovery.jpg',
    ledposter: 'assets/products/ledposter.jpg',
    mvultra: 'assets/products/gloshine/mvultra-hero.png',
    dnin: 'assets/products/gloshine/dnin-hero.png',
    dn: 'assets/products/gloshine/dnout-hero.png',
    vanish: 'assets/products/gloshine/vanish-hero.png',
    vamax: 'assets/products/gloshine/vamax-hero.png',
    cbmax: 'assets/products/gloshine/cbmax-hero.png',
    crmax: 'assets/products/gloshine/crmax-hero.png',
    af2: 'assets/products/gloshine/af2-hero.png',
    aw: 'assets/products/gloshine/aw-hero.png',
    blade: 'assets/products/gloshine/blade-hero.png',
    gposter: 'assets/products/gloshine/gposter-hero.png',
    gposterplus: 'assets/products/gloshine/gposterplus-hero.png',
    arpro: 'assets/products/gloshine/arpro-hero.png',
    cfpro: 'assets/products/gloshine/cfpro-hero.png',
    cfpro2: 'assets/products/gloshine/cfpro2-hero.png',
    rbb: 'assets/products/gloshine/rbb-hero.png',
    ur: 'assets/products/gloshine/ur-hero.png',
    carbon: 'assets/products/gloshine/carbon-hero.png',
    mvpro: 'assets/products/gloshine/mvpro-hero.webp',
    mt55: 'assets/products/gloshine/mt55-hero.png',
    mt2: 'assets/products/gloshine/mt2-hero.png',
    mtedge: 'assets/products/gloshine/mtedge-hero.png',
    cs2: 'assets/products/gloshine/cs2-hero.png',
    mr: 'assets/products/gloshine/mr-hero.png',
    ra2: 'assets/products/gloshine/ra2-hero.png',
    zs3: 'assets/products/gloshine/zs3-hero.png',
    zspro: 'assets/products/gloshine/zspro-hero.png',
    gp: 'assets/products/gloshine/gp-hero.png',
    legend: 'assets/products/gloshine/legend-hero.webp',
    finepitch: 'assets/products/finepitch.jpg',
    pro: 'assets/products/diao-pro.jpg',
    value: 'assets/products/diao-value.jpg',
    rental: 'assets/products/element-rental.jpg',
    creative: 'assets/products/element-creative.jpg',
    'vx400-pro': 'assets/products/novastar/vx400-pro.svg',
    'vx600-pro': 'assets/products/novastar/vx600-pro.svg',
    'vx1000-pro': 'assets/products/novastar/vx1000-pro.svg',
    'vx2000-pro': 'assets/products/novastar/vx2000-pro.svg',
    ku20: 'assets/products/novastar/ku20.svg',
    mx20: 'assets/products/novastar/mx20.svg',
    mx30: 'assets/products/novastar/mx30.svg',
    'mx40-pro': 'assets/products/novastar/mx40-pro.svg',
    msd300: 'assets/products/novastar/msd300.svg',
    msd600: 'assets/products/novastar/msd600.svg',
    mctrl300: 'assets/products/novastar/mctrl300.svg',
    mctrl600: 'assets/products/novastar/mctrl600.svg',
    'mctrl660-pro': 'assets/products/novastar/mctrl660-pro.svg',
    mctrl4k: 'assets/products/novastar/mctrl4k.svg',
    'tu15-pro': 'assets/products/novastar/tu15-pro.svg',
    'tu20-pro': 'assets/products/novastar/tu20-pro.svg',
    'tu4k-pro': 'assets/products/novastar/tu4k-pro.svg',
    tb60: 'assets/products/novastar/tb60.svg'
  };

  function imageForHref(href) {
    var m = (href || '').match(/series=([^&]+)/);
    if (!m) return '';
    return absUrl(SERIES_IMG[decodeURIComponent(m[1])] || '');
  }

  var MEGA_CATS = [
    { id: 'indoor-rental', label: 'Indoor rental' },
    { id: 'outdoor-rental', label: 'Outdoor rental' },
    { id: 'cob', label: 'Fine pitch / COB' },
    { id: 'fixed-indoor', label: 'Fixed indoor' },
    { id: 'posters', label: 'Posters' },
    { id: 'transparent', label: 'Transparent' },
    { id: 'outdoor-fixed', label: 'Outdoor fixed' },
    { id: 'creative', label: 'Creative / XR' },
    { id: 'control', label: 'Control systems' }
  ];

  var PRODUCT_MEGA = {
    'indoor-rental': {
      title: 'Indoor rental',
      lead: 'Touring cabinets for indoor stages, events, and studios.',
      items: [
        { name: 'MV Ultra', href: 'product.html?brand=gloshine&series=mvultra', tag: 'GLO' },
        { name: 'DN Indoor', href: 'product.html?brand=gloshine&series=dnin', tag: 'GLO' },
        { name: 'AR Pro', href: 'product.html?brand=gloshine&series=arpro', tag: 'GLO' },
        { name: 'RB-B', href: 'product.html?brand=gloshine&series=rbb', tag: 'GLO' },
        { name: 'Carbon II', href: 'product.html?brand=gloshine&series=carbon', tag: 'GLO' },
        { name: 'MV Pro', href: 'product.html?brand=gloshine&series=mvpro', tag: 'GLO' },
        { name: 'MT55/62', href: 'product.html?brand=gloshine&series=mt55', tag: 'GLO' },
        { name: 'CF Pro', href: 'product.html?brand=gloshine&series=cfpro', tag: 'GLO' },
        { name: 'Element Rental', href: 'product.html?brand=element&series=rental', tag: 'ELT' }
      ]
    },
    'outdoor-rental': {
      title: 'Outdoor rental',
      lead: 'IP-rated touring panels for festivals, façades, and outdoor stages.',
      items: [
        { name: 'DN Outdoor', href: 'product.html?brand=gloshine&series=dn', tag: 'GLO' },
        { name: 'Vanish Transparent', href: 'product.html?brand=gloshine&series=vanish', tag: 'GLO' },
        { name: 'VA MAX', href: 'product.html?brand=gloshine&series=vamax', tag: 'GLO' },
        { name: 'CB MAX', href: 'product.html?brand=gloshine&series=cbmax', tag: 'GLO' },
        { name: 'CR MAX', href: 'product.html?brand=gloshine&series=crmax', tag: 'GLO' },
        { name: 'UR Carbon', href: 'product.html?brand=gloshine&series=ur', tag: 'GLO' },
        { name: 'AR Pro', href: 'product.html?brand=gloshine&series=arpro', tag: 'GLO' },
        { name: 'Legend', href: 'product.html?brand=gloshine&series=legend', tag: 'GLO' },
        { name: 'ZS Pro II', href: 'product.html?brand=gloshine&series=zspro', tag: 'GLO' }
      ]
    },
    cob: {
      title: 'Fine pitch / COB',
      lead: 'Close-view COB and fine-pitch cabinets for control rooms and retail.',
      items: [
        { name: 'Discovery Series', href: 'product.html?brand=trt&series=discovery', tag: 'TRT' },
        { name: 'Fine Pitch COB', href: 'product.html?brand=bako&series=finepitch', tag: 'BAKO' },
        { name: 'AF II Fine Pitch', href: 'product.html?brand=gloshine&series=af2', tag: 'GLO' },
        { name: 'AW Fine Pitch', href: 'product.html?brand=gloshine&series=aw', tag: 'GLO' }
      ]
    },
    'fixed-indoor': {
      title: 'Fixed indoor',
      lead: 'Wall-mount indoor cabinets for lobbies, meeting rooms, and broadcast.',
      items: [
        { name: 'Discovery Series', href: 'product.html?brand=trt&series=discovery', tag: 'TRT' },
        { name: 'Fine Pitch COB', href: 'product.html?brand=bako&series=finepitch', tag: 'BAKO' },
        { name: 'AF II Fine Pitch', href: 'product.html?brand=gloshine&series=af2', tag: 'GLO' },
        { name: 'AW Fine Pitch', href: 'product.html?brand=gloshine&series=aw', tag: 'GLO' },
        { name: 'Blade', href: 'product.html?brand=gloshine&series=blade', tag: 'GLO' },
        { name: 'RA II', href: 'product.html?brand=gloshine&series=ra2', tag: 'GLO' },
        { name: 'DIAO Pro Fixed', href: 'product.html?brand=diao&series=pro', tag: 'DIAO' }
      ]
    },
    posters: {
      title: 'Posters',
      lead: 'Standalone LED posters for windows, retail aisles, and lobbies.',
      items: [
        { name: 'LedPoster', href: 'product.html?brand=trt&series=ledposter', tag: 'TRT' },
        { name: 'G-Poster Std 2', href: 'product.html?brand=gloshine&series=gposter', tag: 'GLO' },
        { name: 'G-Poster Plus', href: 'product.html?brand=gloshine&series=gposterplus', tag: 'GLO' }
      ]
    },
    transparent: {
      title: 'Transparent',
      lead: 'See-through LED for storefronts, stages, and outdoor spectaculars.',
      items: [
        { name: 'Vanish Transparent', href: 'product.html?brand=gloshine&series=vanish', tag: 'GLO' },
        { name: 'VA MAX', href: 'product.html?brand=gloshine&series=vamax', tag: 'GLO' },
        { name: 'CB MAX', href: 'product.html?brand=gloshine&series=cbmax', tag: 'GLO' }
      ]
    },
    'outdoor-fixed': {
      title: 'Outdoor fixed',
      lead: 'High-brightness façades, DOOH, and permanent outdoor walls.',
      items: [
        { name: 'GP Outdoor', href: 'product.html?brand=gloshine&series=gp', tag: 'GLO' },
        { name: 'ZS III', href: 'product.html?brand=gloshine&series=zs3', tag: 'GLO' },
        { name: 'ZS Pro II', href: 'product.html?brand=gloshine&series=zspro', tag: 'GLO' },
        { name: 'DN Outdoor', href: 'product.html?brand=gloshine&series=dn', tag: 'GLO' },
        { name: 'DIAO Value', href: 'product.html?brand=diao&series=value', tag: 'DIAO' }
      ]
    },
    creative: {
      title: 'Creative / XR',
      lead: 'Curves, corners, flexible cabinets, and virtual-production walls.',
      items: [
        { name: 'MV Pro', href: 'product.html?brand=gloshine&series=mvpro', tag: 'GLO' },
        { name: 'CF Pro', href: 'product.html?brand=gloshine&series=cfpro', tag: 'GLO' },
        { name: 'CF Pro II', href: 'product.html?brand=gloshine&series=cfpro2', tag: 'GLO' },
        { name: 'MT II', href: 'product.html?brand=gloshine&series=mt2', tag: 'GLO' },
        { name: 'MT Edge', href: 'product.html?brand=gloshine&series=mtedge', tag: 'GLO' },
        { name: 'CS II Creative', href: 'product.html?brand=gloshine&series=cs2', tag: 'GLO' },
        { name: 'MR', href: 'product.html?brand=gloshine&series=mr', tag: 'GLO' },
        { name: 'Element Creative / XR', href: 'product.html?brand=element&series=creative', tag: 'ELT' }
      ]
    },
    control: {
      title: 'Control systems',
      lead: 'NovaStar processors and senders matched to your wall. Receiving cards ship inside new cabinets.',
      items: [
        { name: 'VX600 Pro', href: 'product.html?brand=novastar&series=vx600-pro', tag: 'NVS' },
        { name: 'VX1000 Pro', href: 'product.html?brand=novastar&series=vx1000-pro', tag: 'NVS' },
        { name: 'MX30', href: 'product.html?brand=novastar&series=mx30', tag: 'NVS' },
        { name: 'MX40 Pro', href: 'product.html?brand=novastar&series=mx40-pro', tag: 'NVS' },
        { name: 'KU20', href: 'product.html?brand=novastar&series=ku20', tag: 'NVS' },
        { name: 'MCTRL4K', href: 'product.html?brand=novastar&series=mctrl4k', tag: 'NVS' },
        { name: 'TU20 Pro', href: 'product.html?brand=novastar&series=tu20-pro', tag: 'NVS' },
        { name: 'All control systems', href: 'products.html?cat=control', tag: 'NVS' }
      ]
    }
  };

  var SOLUTION_JOBS = [
    { name: 'Retail & Hospitality', href: '/retail-hospitality', image: 'assets/content/solutions-retail.jpg', lead: 'Stores, restaurants, bars, clubs, hotels.' },
    { name: 'Houses of Worship', href: '/worship', image: 'assets/content/news.jpg', lead: 'IMAG and sanctuary walls.' },
    { name: 'Corporate & Control Rooms', href: '/corporate', image: 'assets/content/solutions-corporate.jpg', lead: 'Lobbies, boardrooms, 24/7 fine pitch.' },
    { name: 'Live Events & XR', href: '/events-xr', image: 'assets/content/concert.jpg', lead: 'Rental, stage, virtual production.' },
    { name: 'Outdoor & DOOH', href: '/outdoor', image: 'assets/content/city.jpg', lead: 'Fixed outdoor and street-facing.' },
    { name: 'Home Theater & Residential', href: '/home-theater', image: 'assets/content/solutions-residential.jpg', lead: 'Living rooms and media rooms.' }
  ];

  function megaCardsHtml(items) {
    var featured = (items || []).slice(0, 2);
    var rest = (items || []).slice(2);
    var cards = featured.map(function (item) {
      var img = absUrl(item.image || imageForHref(item.href));
      return '<a class="site-mega-card" href="' + absUrl(item.href) + '">' +
        (img ? '<span class="site-mega-card-media"><img src="' + img + '" alt=""></span>' : '') +
        '<span class="site-mega-card-meta">' +
          (item.tag ? '<span class="site-mega-dot">' + item.tag + '</span>' : '') +
          '<span class="site-mega-card-name">' + item.name + '</span>' +
        '</span>' +
      '</a>';
    }).join('');
    var links = rest.map(function (item) {
      return '<a href="' + absUrl(item.href) + '">' +
        (item.tag ? '<span class="site-mega-dot">' + item.tag + '</span>' : '') +
        '<span>' + item.name + '</span></a>';
    }).join('');
    return '<div class="site-mega-feature">' + cards + '</div>' +
      (links ? '<div class="site-mega-grid">' + links + '</div>' : '');
  }

  function productGridHtml(items) {
    return megaCardsHtml(items);
  }

  function megaProductsInnerHtml() {
    var first = MEGA_CATS[0];
    var buttons = MEGA_CATS.map(function (cat, i) {
      return '<button type="button" class="site-mega-cat' + (i === 0 ? ' is-active' : '') +
        '" data-cat="' + cat.id + '">' + cat.label + ' ' + MEGA_CAT_CHEVRON + '</button>';
    }).join('');
    return (
      '<div class="site-mega-products">' +
        '<div class="site-mega-cats" role="tablist">' + buttons + '</div>' +
        '<div class="site-mega-body">' +
          '<h3 data-mega-title>' + first.label + '</h3>' +
          '<p data-mega-lead>Touring cabinets for indoor stages, events, and studios.</p>' +
          '<div data-mega-grid></div>' +
        '</div>' +
      '</div>' +
      '<div class="site-mega-foot">' +
        '<div class="site-mega-foot-item"><span>Explore</span><a href="/products.html?cat=indoor-rental" data-mega-all>View all in this category</a></div>' +
        '<div class="site-mega-foot-item"><span>Tools</span><a href="/led-wall-calculator">LED Wall Calculator</a></div>' +
      '</div>'
    );
  }

  function solutionCardsHtml() {
    return SOLUTION_JOBS.map(function (item) {
      var img = absUrl(item.image);
      return '<a class="site-mega-card" href="' + absUrl(item.href) + '">' +
        '<span class="site-mega-card-media"><img src="' + img + '" alt=""></span>' +
        '<span class="site-mega-card-meta">' +
          '<span class="site-mega-card-name">' + item.name + '</span>' +
          (item.lead ? '<span class="site-mega-card-lead">' + item.lead + '</span>' : '') +
        '</span>' +
      '</a>';
    }).join('');
  }

  function megaSolutionsInnerHtml() {
    return (
      '<div class="site-mega-jobs">' + solutionCardsHtml() + '</div>' +
      '<div class="site-mega-foot">' +
        '<div class="site-mega-foot-item"><span>Sales</span><a href="/contact.html">Talk to sales</a></div>' +
        '<div class="site-mega-foot-item"><span>Dealer</span><a href="/dealer.html">Dealer signup</a></div>' +
      '</div>'
    );
  }

  function megaCatFromUrl() {
    var cat = (new URLSearchParams(location.search).get('cat') || '').toLowerCase();
    var map = {
      cob: 'cob',
      'fine-pitch': 'cob',
      'micro-led': 'cob',
      rental: 'indoor-rental',
      'indoor-rental': 'indoor-rental',
      'outdoor-rental': 'outdoor-rental',
      indoor: 'fixed-indoor',
      'fixed-indoor': 'fixed-indoor',
      posters: 'posters',
      poster: 'posters',
      transparent: 'transparent',
      outdoor: 'outdoor-fixed',
      'outdoor-fixed': 'outdoor-fixed',
      creative: 'creative',
      xr: 'creative',
      control: 'control',
      processors: 'control',
      novastar: 'control'
    };
    return map[cat] || 'indoor-rental';
  }

  function renderProductMega(key) {
    var data = PRODUCT_MEGA[key] || PRODUCT_MEGA['indoor-rental'];
    $all('[data-mega-title]').forEach(function (el) { el.textContent = data.title; });
    $all('[data-mega-lead]').forEach(function (el) { el.textContent = data.lead; });
    $all('[data-mega-grid]').forEach(function (el) { el.innerHTML = productGridHtml(data.items); });
    $all('#site-mega-products .site-mega-cat, #mobile-product-mega .site-mega-cat').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-cat') === key);
    });
    $all('[data-mega-all]').forEach(function (el) {
      el.href = '/products.html?cat=' + encodeURIComponent(key);
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
    var file = pathFile();
    nav.innerHTML =
      '<div class="site-nav-item" data-mega="products">' +
        '<button type="button" class="site-nav-link' + (file === 'products.html' || file === 'product.html' ? ' is-active' : '') + '" aria-expanded="false" aria-haspopup="true">' +
          '<span data-i18n="nav.products">Products</span>' + chevron() +
        '</button>' +
      '</div>' +
      '<div class="site-nav-item" data-mega="solutions">' +
        '<button type="button" class="site-nav-link' + (onSolutionsPath() ? ' is-active' : '') + '" aria-expanded="false" aria-haspopup="true">' +
          '<span data-i18n="nav.solutions">Solutions</span>' + chevron() +
        '</button>' +
      '</div>' +
      '<a class="site-nav-link' + (onCalculatorPath() ? ' is-active' : '') + '" href="/led-wall-calculator" data-i18n="nav.designer">LED Wall Calculator</a>' +
      '<a class="site-nav-link' + (file === 'dealer.html' ? ' is-active' : '') + '" href="/dealer.html" data-i18n="nav.dealer">Dealer</a>';

    var header = $('.site-header');
    if (!header || $('#site-mega-products')) return;

    var prod = document.createElement('div');
    prod.id = 'site-mega-products';
    prod.className = 'site-mega-panel';
    prod.innerHTML = megaProductsInnerHtml();
    document.body.appendChild(prod);
    renderProductMega(megaCatFromUrl());

    var sol = document.createElement('div');
    sol.id = 'site-mega-solutions';
    sol.className = 'site-mega-panel';
    sol.innerHTML = megaSolutionsInnerHtml();
    document.body.appendChild(sol);

    if (!$('#site-mega-scrim')) {
      var scrim = document.createElement('div');
      scrim.id = 'site-mega-scrim';
      scrim.className = 'site-mega-scrim';
      document.body.insertBefore(scrim, prod);
      scrim.addEventListener('click', function () { closeMegas(); });
    }
  }

  function injectSalesCta() {
    var utils = $('.site-utils');
    if (!utils || utils.querySelector('.site-cta')) return;
    var contact = utils.querySelector('a.site-util[href="contact.html"], a.site-util[href="/contact.html"]');
    var html =
      '<a href="/support.html" class="site-util site-support-link"><span data-i18n="nav.support">Support</span></a>' +
      '<a href="/contact.html" class="site-cta" data-i18n="nav.contactSales">Contact Sales</a>' +
      '<a href="/contact.html" class="site-util site-contact-icon" aria-label="Contact Sales">' +
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
    var scrim = $('#site-mega-scrim');
    if (scrim) scrim.classList.remove('is-on');
  }

  function placeMega(panel) {
    if (!panel) return;
    var header = $('.site-header');
    var inner = header && header.querySelector('.site-header-inner');
    var top = (header ? header.getBoundingClientRect().bottom : 64) + 10;
    var innerBox = inner ? inner.getBoundingClientRect() : { left: 16, right: window.innerWidth - 16 };
    var pad = 16;
    if (inner) {
      pad = parseFloat(window.getComputedStyle(inner).paddingLeft) || 16;
    }
    var left = innerBox.left + pad;
    var right = innerBox.right - pad;
    var width = Math.max(320, Math.min(72 * 16, right - left));
    panel.style.top = Math.round(top) + 'px';
    panel.style.left = Math.round(left) + 'px';
    panel.style.width = Math.round(width) + 'px';
    panel.style.right = 'auto';
    panel.style.transform = 'none';
  }

  function bindMegas() {
    var header = $('.site-header');
    if (!header) return;
    $all('.site-nav-item[data-mega]').forEach(function (item) {
      var name = item.getAttribute('data-mega');
      var panel = name === 'products' ? $('#site-mega-products') : $('#site-mega-solutions');
      var btn = item.querySelector('.site-nav-link');
      function open() {
        closeMegas();
        closeAll();
        item.classList.add('is-open');
        if (btn) btn.setAttribute('aria-expanded', 'true');
        if (panel) {
          panel.classList.add('is-open');
          placeMega(panel);
          var scrim = $('#site-mega-scrim');
          if (scrim) scrim.classList.add('is-on');
        }
      }
      if (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          if (item.classList.contains('is-open')) closeMegas();
          else open();
        });
      }
    });
    $all('#site-mega-products .site-mega-cat, #mobile-product-mega .site-mega-cat').forEach(function (btn) {
      btn.addEventListener('click', function () { renderProductMega(btn.getAttribute('data-cat')); });
    });
    $all('.site-mega-panel').forEach(function (panel) {
      panel.addEventListener('click', function (e) {
        var link = e.target.closest && e.target.closest('a');
        if (link) closeMegas();
      });
    });
    window.addEventListener('resize', function () {
      var openItem = $('.site-nav-item.is-open');
      if (!openItem) return;
      var name = openItem.getAttribute('data-mega');
      var panel = name === 'products' ? $('#site-mega-products') : $('#site-mega-solutions');
      placeMega(panel);
    });
  }

  function bindSearch() {
    var wrap = $('#hdr-search-drop');
    if (!wrap) return;
    bindDrop(wrap);
    var input = $('#hdr-search-input');
    var results = $('#hdr-search-results');
    function matches(p, q) {
      var hay = [p.name, p.brandName, p.description, p.type, p.id, p.model, p.family, p.subtype]
        .join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    }
    if (input) {
      input.addEventListener('input', function () { render(input.value); });
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
        results.innerHTML = '<a href="/products.html?q=' + encodeURIComponent(q) + '">Search “' + q.replace(/[<>]/g, '') + '”</a>';
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
        var href = '/product.html?brand=' + encodeURIComponent(p.brandId) + '&series=' + encodeURIComponent(p.id);
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

    bindSigninDrop($('#hdr-signin-drop'));
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
        var done = function () { location.href = '/'; };
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
      if (e.target.closest && e.target.closest('.site-mega-panel, .site-drop, #hdr-menu-btn, .site-nav-item')) return;
      closeAll();
      closeMegas();
      header.classList.remove('is-nav-open');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeAll();
        closeMegas();
        header.classList.remove('is-nav-open');
      }
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
