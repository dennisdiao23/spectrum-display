(function () {
  const $ = function (id) { return document.getElementById(id); };
  function specFileHref(url) {
    const raw = String(url || '').trim();
    if (!raw || raw.charAt(0) === '/') return raw;
    try {
      const parsed = new URL(raw);
      const host = parsed.hostname.toLowerCase();
      const nova = host === 'oss.novastar.tech'
        || host === 'en-website001.oss-us-east-1.aliyuncs.com'
        || host === 'en-website001.oss-accelerate.aliyuncs.com';
      if (parsed.protocol === 'https:' && nova && /\.pdf$/i.test(parsed.pathname)) {
        return '/api/spec-pdf?url=' + encodeURIComponent(raw);
      }
    } catch (e) { /* keep the original link */ }
    return raw;
  }
  const viewIds = {
    home: 'dashboard-section',
    book: 'inventory-section',
    quotes: 'sales-section',
    orders: 'sales-section',
    registrations: 'registrations-section',
    leads: 'leads-section',
    rmas: 'rmas-section',
    walls: 'walls-section',
    projects: 'projects-section',
    panels: 'panels-section',
    calculator: 'calculator-section',
    company: 'view-company',
    updates: 'view-updates',
    guide: 'view-guide'
  };
  const views = Object.keys(viewIds);
  let me = null;
  let book = [];
  let docs = { quote: [], order: [] };
  let projects = [];
  let projectId = '';
  let panels = [];
  let panelId = '';
  let dashHome = 'leads';
  const DASH_OVERVIEW_ORDER = ['leads', 'quotes', 'orders', 'walls'];
  const DASH_LOOP_MS = 8000;
  const DASH_LOOP_RESUME_MS = 18000;
  let dashLoopTimer = null;
  let dashLoopResumeTimer = null;
  let dashLoopHold = 0;
  let dashLoopClickUntil = 0;
  let registrations = [];
  let pendingRegistrationId = '';
  let leads = [];
  let rmas = [];
  let walls = [];
  let openTabs = [];
  let bookFilter = 'all';
  let bookSku = '';
  let drFilter = 'all';
  let bookDetailTab = 'details';
  const tabLabel = { home: 'Dashboard', book: 'Dealer book', quotes: 'Request Quote', orders: 'Purchase Order', walls: 'Installed walls', registrations: 'Deal registration', leads: 'Leads', rmas: 'RMA', projects: 'Projects', panels: 'Saved Panel', calculator: 'Calculator', company: 'Company', updates: 'What’s new', guide: 'Dealer guide' };
  const tabIcon = {
    home: '<svg class="dash-master-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>',
    book: '<svg class="dash-master-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10 12 4.5 21 10v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10z"/><path d="M9 20.5V12h6v8.5"/></svg>',
    quotes: '<svg class="dash-master-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4h8v4H8z"/><path d="M6 8h12v12H6z"/><path d="M9 12h6M9 16h4"/></svg>',
    registrations: '<svg class="dash-master-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    leads: '<svg class="dash-master-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    rmas: '<svg class="dash-master-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M9 12h6"/></svg>',
    walls: '<svg class="dash-master-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/></svg>',
    orders: '<svg class="dash-master-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16l-1.5 12H5.5L4 7z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/></svg>',
    projects: '<svg class="dash-master-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8h18"/><path d="M8 12h5M8 16h8"/></svg>',
    panels: '<svg class="dash-master-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8.5 12 13 3 8.5 12 4l9 4.5z"/><path d="M3 8.5v7L12 20l9-4.5v-7"/><path d="M12 13v7"/></svg>',
    calculator: '<svg class="dash-master-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/></svg>',
    company: '<svg class="dash-master-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/></svg>',
    updates: '<svg class="dash-master-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 6v6l3.5 2"/><circle cx="12" cy="12" r="9"/></svg>',
    guide: '<svg class="dash-master-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3V4z"/><path d="M5 4v16"/><path d="M19 7h-5"/></svg>'
  };

  function esc(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }
  function money(n) {
    return '$' + (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function pathView() {
    const parts = location.pathname.replace(/\/+$/, '').split('/');
    if (parts[1] !== 'portal' || !parts[2]) return 'home';
    if (parts[2] === 'incoming') return 'leads';
    if (parts[2] === 'quotes') return 'quotes';
    if (parts[2] === 'orders') return 'orders';
    if (views.indexOf(parts[2]) !== -1) return parts[2];
    return 'home';
  }
  function viewEl(name) {
    return $(viewIds[name] || viewIds.home);
  }
  function docIdFromPath() {
    const parts = location.pathname.replace(/\/+$/, '').split('/');
    if ((parts[2] === 'quotes' || parts[2] === 'orders') && parts[3] && parts[3] !== 'new') return parts[3];
    return '';
  }
  async function api(url, opts) {
    const res = await fetch(url, Object.assign({ credentials: 'same-origin' }, opts || {}));
    const json = await res.json().catch(function () { return {}; });
    if (!res.ok || json.ok === false) {
      const err = new Error(json.error || 'Request failed.');
      err.status = res.status;
      throw err;
    }
    return json;
  }
  function dealerInitials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'D';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  function paintDealerBrand() {
    const nameEl = $('portal-dealer-name');
    const img = $('portal-dealer-logo');
    const mark = $('portal-dealer-mark');
    const signedIn = !!me;
    const name = signedIn
      ? (dealerCompanyName() || (me.user && me.user.name) || 'Dealer')
      : 'Dealer Portal';
    if (nameEl) nameEl.textContent = name;
    const logo = signedIn ? (me.logo || '') : '';
    if (img && logo) {
      img.hidden = false;
      img.src = logo;
      img.alt = name;
      if (mark) mark.hidden = true;
    } else {
      if (img) {
        img.hidden = true;
        img.removeAttribute('src');
      }
      if (mark) {
        mark.hidden = false;
        mark.textContent = dealerInitials(signedIn ? name : '');
      }
    }
  }
  function hidePortalBoot() {
    const el = $('company-boot');
    if (!el) return;
    el.classList.add('hidden');
    el.hidden = true;
  }
  function showPortalBoot() {
    const el = $('company-boot');
    if (!el) return;
    el.classList.remove('hidden');
    el.hidden = false;
  }
  function stillBootLogo() {
    const logo = $('company-boot-logo');
    if (!logo) return;
    if (!/spectrum-boot-still\.png/.test(logo.getAttribute('src') || '')) {
      logo.src = '/assets/spectrum-boot-still.png';
    }
  }
  function showLogin() {
    stillBootLogo();
    showPortalBoot();
    $('login-panel').classList.remove('hidden');
    $('portal-nav').classList.add('hidden');
    $('portal-foot').classList.add('hidden');
    $('portal-logout').classList.add('hidden');
    if (window.SpectrumHelp) SpectrumHelp.stop();
    if (window.SpectrumNotes) SpectrumNotes.hide();
    views.forEach(function (name) { viewEl(name).classList.add('hidden'); });
    $('portal-title').textContent = 'Dealer Portal';
    $('admin-page-sub').textContent = 'Dealer sign in';
    document.body.classList.remove('dash-master-on');
    document.body.classList.remove('dash-tabbar-on');
    document.body.classList.remove('dash-tabbar-editing');
    const phoneBar = $('dash-tabbar');
    if (phoneBar) phoneBar.hidden = true;
    document.body.classList.remove('inv-layout-lock');
    document.body.classList.remove('so-split-lock');
    const bar = $('dash-tab-bar');
    if (bar) bar.hidden = true;
    syncNavSubs('');
    paintDealerBrand();
  }
  function syncNavSubs(name) {
    const calcSub = $('portal-calculator-sub');
    const settingsSub = $('portal-settings-sub');
    if (calcSub) calcSub.classList.toggle('hidden', name !== 'calculator' && name !== 'projects' && name !== 'panels');
    if (settingsSub) settingsSub.classList.toggle('hidden', name !== 'company' && name !== 'updates' && name !== 'guide');
  }
  function pathFor(name) {
    return name === 'home' ? '/portal' : '/portal/' + name;
  }
  function isMobileDash() {
    return window.matchMedia('(max-width: 900px)').matches;
  }
  function masterTabButton(name, active, closable) {
    return '<button type="button" class="inv-browser-tab' + (active ? ' is-active' : '') + '" data-dash-tab="' + esc(name) + '" role="tab" aria-selected="' + (active ? 'true' : 'false') + '">' +
      (tabIcon[name] || '') +
      '<span class="inv-browser-tab-label">' + esc(tabLabel[name] || name) + '</span>' +
      (closable ? '<span class="inv-browser-tab-close" data-dash-tab-close="' + esc(name) + '" aria-label="Close tab" role="button" tabindex="-1">×</span>' : '') +
      '</button>';
  }
  function renderMasterTabs() {
    const bar = $('dash-tab-bar');
    const strip = $('dash-tab-strip');
    if (!bar || !strip) return;
    if (!me || isMobileDash()) {
      bar.hidden = true;
      strip.innerHTML = '';
      document.body.classList.remove('dash-master-on');
      return;
    }
    bar.hidden = false;
    document.body.classList.add('dash-master-on');
    const active = pathView();
    let html = masterTabButton('home', active === 'home', false);
    openTabs.forEach(function (name) {
      html += masterTabButton(name, active === name, true);
    });
    strip.innerHTML = html;
    const current = strip.querySelector('.inv-browser-tab.is-active');
    if (current && current.scrollIntoView) {
      try { current.scrollIntoView({ inline: 'nearest', block: 'nearest' }); } catch (err) {}
    }
  }
  function openPortal(name, push) {
    if (!viewIds[name]) name = 'home';
    if (name !== 'home' && openTabs.indexOf(name) === -1) openTabs.push(name);
    if (push && location.pathname.replace(/\/+$/, '') !== pathFor(name)) {
      history.pushState({ view: name }, '', pathFor(name));
    }
    renderView(name);
    renderMasterTabs();
  }
  function closeMasterTab(name) {
    const idx = openTabs.indexOf(name);
    if (idx < 0 || name === 'home') return;
    const wasActive = pathView() === name;
    openTabs.splice(idx, 1);
    if (!wasActive) {
      renderMasterTabs();
      return;
    }
    const next = openTabs[Math.min(idx, openTabs.length - 1)] || 'home';
    openPortal(next, true);
  }
  function calculatorFrameUrl(raw) {
    const value = String(raw || '/led-wall-calculator');
    const qIndex = value.indexOf('?');
    const path = qIndex === -1 ? value : value.slice(0, qIndex);
    const params = new URLSearchParams(qIndex === -1 ? '' : value.slice(qIndex + 1));
    params.set('embed', '1');
    params.set('portal', '1');
    params.set('v', 'calcpreview1');
    const base = path.indexOf('/led-wall-calculator') === 0 ? path : '/led-wall-calculator';
    return base + '?' + params.toString();
  }
  function ensureCalculator(raw) {
    const frame = $('portal-calculator-frame');
    if (!frame) return;
    if (!raw && frame.getAttribute('src')) return;
    const next = calculatorFrameUrl(raw);
    if (frame.getAttribute('data-src') === next) return;
    frame.setAttribute('data-src', next);
    frame.src = next;
  }
  function showApp() {
    hidePortalBoot();
    $('login-panel').classList.add('hidden');
    $('portal-nav').classList.remove('hidden');
    $('portal-foot').classList.remove('hidden');
    $('portal-logout').classList.remove('hidden');
    $('portal-user').textContent = (me && me.user && (me.user.name || me.user.email)) || '';
    paintDealerBrand();
    applyPortalSplits();
    openPortal(pathView(), false);
    applyPortalTabbar();
    if (window.SpectrumHelp) {
      SpectrumHelp.start({
        app: 'portal',
        userId: me && me.user && me.user.id,
        page: pathView()
      });
    }
    if (window.SpectrumNotes) {
      SpectrumNotes.start({
        app: 'portal',
        userId: me && me.user && me.user.id,
        goUpdates: function () {
          openPortal('updates', true);
        }
      });
    }
  }
  function showPageProblem(name, err) {
    const section = viewEl(name);
    if (!section) return;
    let box = section.querySelector('[data-page-problem]');
    if (!box) {
      box = document.createElement('p');
      box.setAttribute('data-page-problem', '1');
      box.className = 'text-sm text-red-400';
      box.style.margin = '0.75rem 1rem';
      section.insertBefore(box, section.firstChild);
    }
    box.textContent = (err && err.message) ? err.message : 'This page could not open.';
  }
  function runPage(name, fn) {
    const section = viewEl(name);
    const old = section && section.querySelector('[data-page-problem]');
    if (old) old.remove();
    try {
      const result = fn();
      if (result && typeof result.then === 'function') {
        result.catch(function (err) { showPageProblem(name, err); });
      }
    } catch (err) {
      showPageProblem(name, err);
    }
  }
  function renderView(name) {
    const seen = {};
    views.forEach(function (view) {
      const el = viewEl(view);
      if (!el || seen[el.id]) return;
      seen[el.id] = true;
      el.classList.toggle('hidden', el !== viewEl(name));
    });
    document.querySelectorAll('#dash-sidebar a[data-view]').forEach(function (link) {
      link.classList.toggle('is-active', link.getAttribute('data-view') === name);
    });
    const calculator = $('portal-calculator');
    if (calculator) calculator.classList.toggle('is-active', name === 'calculator' || name === 'projects' || name === 'panels');
    const settings = $('portal-settings');
    if (settings) settings.classList.toggle('is-active', name === 'company' || name === 'updates' || name === 'guide');
    syncPortalTabbarActive(name);
    syncNavSubs(name);
    document.body.classList.toggle('calc-lock', name === 'calculator');
    if (name === 'calculator') ensureCalculator('');
    $('portal-title').textContent = tabLabel[name] || 'Dealer Portal';
    $('admin-page-sub').textContent = name === 'home' ? 'Overview' : ((me && me.customer && me.customer.companyName) || '');
    document.body.classList.toggle('inv-layout-lock', (name === 'book' || name === 'projects' || name === 'panels' || name === 'walls') && !isMobileDash());
    const onSales = (name === 'quotes' || name === 'orders') && !isMobileDash();
    document.body.classList.toggle('so-split-lock', onSales || ((name === 'registrations' || name === 'rmas') && !isMobileDash()));
    document.body.classList.toggle('dash-split-lock', (name === 'registrations' || name === 'rmas') && !isMobileDash());
    const sales = $('sales-section');
    if (sales) sales.classList.toggle('so-split-on', onSales);
    if (name === 'home') {
      runPage(name, function () { renderHome(); });
      refreshHomeData();
      startDashOverviewLoop();
    } else {
      stopDashOverviewLoop();
    }
    if (name === 'book') runPage(name, function () { renderBook(); });
    if (name === 'quotes' || name === 'orders') runPage(name, function () { renderQuotes(); });
    if (name === 'registrations') runPage(name, function () { renderRegistrations(); });
    if (name === 'leads') runPage(name, function () { paintLeadBoard(); });
    if (name === 'rmas') runPage(name, function () { renderRmas(); });
    if (name === 'walls') runPage(name, function () { renderWalls(); });
    if (name === 'projects') runPage(name, function () { loadProjects(); });
    if (name === 'panels') runPage(name, function () { loadPanels(); });
    if (name === 'company') runPage(name, function () { loadCompany(); });
    if ((name === 'updates' || name === 'guide') && window.SpectrumNotes) SpectrumNotes.paint();
    if (window.SpectrumHelp) SpectrumHelp.setPage(name);
  }
  function chip(value, label) {
    return '<div class="dash-detail-chip"><strong>' + esc(value) + '</strong><span>' + esc(label) + '</span></div>';
  }
  function dashRow(title, meta, side) {
    return '<div class="dash-detail-row"><div><strong>' + esc(title) + '</strong><span>' + esc(meta) + '</span></div><em>' + esc(side) + '</em></div>';
  }
  function dashCount(n) {
    return n == null ? '—' : Number(n).toLocaleString();
  }
  function dashMoney(n) {
    const v = Math.round(Number(n) || 0);
    const abs = Math.abs(v);
    if (abs >= 1000000) {
      const m = v / 1000000;
      return '$' + m.toFixed(m >= 10 ? 0 : 1).replace(/\.0$/, '') + 'M';
    }
    return '$' + v.toLocaleString();
  }
  function dashDayStamp(value) {
    const dt = value instanceof Date ? value : new Date(value);
    if (isNaN(dt.getTime())) return '';
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }
  function dashLastDays(n) {
    const out = [];
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    for (let i = n - 1; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(day.getDate() - i);
      out.push(dashDayStamp(day));
    }
    return out;
  }
  function dashSeriesFrom(rows, dateKeys, valueFn) {
    const days = dashLastDays(30);
    const map = {};
    days.forEach(function (day) { map[day] = 0; });
    const keys = Array.isArray(dateKeys) ? dateKeys : [dateKeys];
    (rows || []).forEach(function (row) {
      let stamp = '';
      keys.forEach(function (key) {
        if (stamp) return;
        stamp = dashDayStamp(row && row[key]);
      });
      if (!stamp || map[stamp] == null) return;
      map[stamp] += valueFn ? (Number(valueFn(row)) || 0) : 1;
    });
    return days.map(function (day) { return map[day]; });
  }
  function drawKpiSpark(id, values, color) {
    const svg = document.getElementById(id);
    if (!svg) return;
    const nums = (values && values.length) ? values : [0];
    const w = 120;
    const h = 28;
    const pad = 4;
    const min = Math.min.apply(null, nums);
    const max = Math.max.apply(null, nums);
    function xAt(i) {
      if (nums.length <= 1) return w / 2;
      return pad + (i / (nums.length - 1)) * (w - pad * 2);
    }
    function yAt(v) {
      if (max === min) return h / 2;
      return pad + (1 - (v - min) / (max - min)) * (h - pad * 2);
    }
    let d = '';
    nums.forEach(function (v, i) {
      d += (i ? ' L ' : 'M ') + xAt(i).toFixed(1) + ' ' + yAt(v).toFixed(1);
    });
    const lastX = xAt(nums.length - 1);
    const lastY = yAt(nums[nums.length - 1]);
    const stroke = color || '#2f6bff';
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.innerHTML = '<path d="' + d + '" fill="none" stroke="' + stroke +
      '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"></path>';
    const wrap = svg.parentElement;
    const dot = wrap && wrap.querySelector('.dash-kpi-spark-dot');
    if (dot) {
      dot.style.left = (lastX / w * 100) + '%';
      dot.style.top = (lastY / h * 100) + '%';
      dot.style.background = stroke;
      dot.hidden = false;
    }
  }
  function docsTotal(list) {
    return (list || []).reduce(function (sum, doc) { return sum + (Number(doc.total) || 0); }, 0);
  }
  function dashLoopHeld() {
    return dashLoopHold > 0 || Date.now() < dashLoopClickUntil;
  }
  function syncDashLoopClass() {
    const kpis = document.querySelector('#dash-home .dash-home-kpis');
    if (!kpis) return;
    const held = dashLoopHeld();
    kpis.classList.toggle('is-looping', !!dashLoopTimer && !held);
    kpis.classList.toggle('is-paused', !!dashLoopTimer && held);
  }
  function stopDashOverviewLoop() {
    if (dashLoopTimer) {
      clearInterval(dashLoopTimer);
      dashLoopTimer = null;
    }
    syncDashLoopClass();
  }
  function startDashOverviewLoop() {
    stopDashOverviewLoop();
    const section = document.getElementById('dashboard-section');
    if (section && section.classList.contains('hidden')) return;
    dashLoopTimer = window.setInterval(tickDashOverviewLoop, DASH_LOOP_MS);
    syncDashLoopClass();
  }
  function tickDashOverviewLoop() {
    if (dashLoopHeld()) {
      syncDashLoopClass();
      return;
    }
    const i = DASH_OVERVIEW_ORDER.indexOf(dashHome);
    const next = DASH_OVERVIEW_ORDER[(i + 1 + DASH_OVERVIEW_ORDER.length) % DASH_OVERVIEW_ORDER.length];
    if (next && next !== dashHome) selectDashOverview(next, { fromLoop: true });
  }
  function pauseDashOverviewLoop() {
    dashLoopClickUntil = Date.now() + DASH_LOOP_RESUME_MS;
    if (dashLoopResumeTimer) clearTimeout(dashLoopResumeTimer);
    dashLoopResumeTimer = window.setTimeout(function () {
      dashLoopClickUntil = 0;
      dashLoopResumeTimer = null;
      startDashOverviewLoop();
    }, DASH_LOOP_RESUME_MS);
    syncDashLoopClass();
  }
  function holdDashOverviewLoop() {
    dashLoopHold += 1;
    syncDashLoopClass();
  }
  function releaseDashOverviewLoop() {
    dashLoopHold = Math.max(0, dashLoopHold - 1);
    syncDashLoopClass();
  }
  function markDashOverview(name) {
    document.querySelectorAll('#dash-home .dash-kpi[data-home]').forEach(function (btn) {
      const on = btn.getAttribute('data-home') === name;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    syncDashLoopClass();
  }
  function selectDashOverview(name, opts) {
    opts = opts || {};
    if (DASH_OVERVIEW_ORDER.indexOf(name) === -1) name = 'leads';
    const same = name === dashHome;
    dashHome = name;
    markDashOverview(name);
    if (!same || opts.force || !opts.fromLoop) {
      const pane = document.getElementById('dash-detail');
      if (pane && !opts.fromLoad) {
        pane.classList.remove('is-in');
        void pane.offsetWidth;
        renderHomeDetail();
        pane.classList.add('is-in');
      } else {
        renderHomeDetail();
      }
    }
    if (!opts.fromLoop && !opts.fromLoad) pauseDashOverviewLoop();
  }
  function selectHome(name) {
    selectDashOverview(name);
  }
  function acceptedLeads() {
    return (leads || []).filter(function (row) { return row && row.status === 'accepted'; });
  }
  function waitingLeads() {
    return (leads || []).filter(function (row) { return row && row.status === 'sent'; });
  }
  function paintIncomingBadge() {
    const link = document.querySelector('#portal-nav a[data-view="leads"]');
    if (!link) return;
    let badge = link.querySelector('.dash-nav-count');
    const n = waitingLeads().length;
    if (!n) {
      if (badge) badge.hidden = true;
      return;
    }
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'dash-nav-count';
      link.appendChild(badge);
    }
    badge.hidden = false;
    badge.textContent = String(n);
  }
  function renderHome() {
    const openLeads = boardLeads();
    const quoteDrafts = docs.quote.filter(function (doc) { return doc.status === 'draft'; }).length;
    const orderDrafts = docs.order.filter(function (doc) { return doc.status === 'draft'; }).length;
    const quoteTotal = docsTotal(docs.quote);
    const orderTotal = docsTotal(docs.order);
    const leadEl = $('dash-stat-leads');
    const quoteEl = $('dash-stat-quotes');
    const orderEl = $('dash-stat-orders');
    const wallEl = $('dash-stat-walls');
    if (leadEl) leadEl.textContent = dashCount(openLeads.length);
    if (quoteEl) quoteEl.textContent = dashMoney(quoteTotal);
    if (orderEl) orderEl.textContent = dashMoney(orderTotal);
    if (wallEl) wallEl.textContent = dashCount(walls.length);
    const leadHint = $('dash-hint-leads');
    if (leadHint) leadHint.textContent = 'On your board';
    const quoteHint = $('dash-hint-quotes');
    if (quoteHint) {
      const bits = [docs.quote.length ? (docs.quote.length + ' quotes') : 'Sales quotes'];
      if (quoteDrafts) bits.push(quoteDrafts + ' draft');
      quoteHint.textContent = bits.join(' · ');
    }
    const orderHint = $('dash-hint-orders');
    if (orderHint) {
      const bits = [docs.order.length ? (docs.order.length + ' orders') : 'Sales orders'];
      if (orderDrafts) bits.push(orderDrafts + ' draft');
      orderHint.textContent = bits.join(' · ');
    }
    const wallHint = $('dash-hint-walls');
    if (wallHint) {
      const spares = walls.filter(function (row) { return Number(row.spareQty) > 0; }).length;
      wallHint.textContent = spares ? (spares + ' with spare kits') : 'On site';
    }
    drawKpiSpark('dash-spark-leads', dashSeriesFrom(openLeads, ['stageUpdatedAt', 'updatedAt', 'createdAt']), '#0e7490');
    drawKpiSpark('dash-spark-quotes', dashSeriesFrom(docs.quote, ['createdAt', 'updatedAt'], function (doc) { return doc.total; }), '#2f6bff');
    drawKpiSpark('dash-spark-orders', dashSeriesFrom(docs.order, ['createdAt', 'updatedAt'], function (doc) { return doc.total; }), '#1f9d57');
    drawKpiSpark('dash-spark-walls', dashSeriesFrom(walls, ['shipDate', 'createdAt']), '#d39b12');
    markDashOverview(dashHome);
    renderHomeDetail();
    renderStartHere();
    const recent = []
      .concat(docs.quote.map(function (doc) {
        return { at: doc.updatedAt || doc.createdAt, title: doc.number || 'Request Quote', meta: 'Request Quote · ' + (doc.status || ''), side: money(doc.total) };
      }))
      .concat(docs.order.map(function (doc) {
        return { at: doc.updatedAt || doc.createdAt, title: doc.number || 'Purchase Order', meta: 'Purchase Order · ' + (doc.status || ''), side: money(doc.total) };
      }))
      .concat(leads.map(function (row) {
        return { at: row.updatedAt || row.createdAt, title: row.project || row.number || 'Lead', meta: 'Lead · ' + (row.stageLabel || row.statusLabel || ''), side: leadPlace(row) };
      }))
      .concat(walls.map(function (row) {
        return { at: row.updatedAt || row.createdAt || row.shipDate, title: row.wallName || row.number || 'Installed wall', meta: 'Installed wall', side: wallSite(row) };
      }))
      .sort(function (a, b) {
        return String(b.at || '').localeCompare(String(a.at || ''));
      })
      .slice(0, 8);
    const recentEl = $('dash-recent-list');
    if (recentEl) {
      recentEl.innerHTML = recent.length ? recent.map(function (row) {
        return dashRow(row.title, row.meta, row.side);
      }).join('') : '<p class="dash-activity-empty">No recent leads, quotes, orders, or walls yet.</p>';
    }
  }
  function startHereSteps() {
    return [
      {
        title: 'Dealer book',
        text: 'Your prices and what is on hand.',
        href: '/portal/book',
        done: book.length > 0
      },
      {
        title: 'Calculator',
        text: 'Size a wall and save it.',
        href: '/portal/calculator',
        done: projects.length > 0 || panels.length > 0
      },
      {
        title: 'Deal registration',
        text: 'Register one named job.',
        href: '/portal/registrations',
        done: registrations.length > 0
      },
      {
        title: 'Request Quote',
        text: 'Ask Spectrum to price a job.',
        href: '/portal/quotes',
        done: (docs.quote || []).length > 0
      }
    ];
  }
  function startHereOpen() {
    return startHereSteps().some(function (step) { return !step.done; });
  }
  function renderStartHere() {
    const col = $('dash-home-right') || document.querySelector('.dash-home-right');
    const wrap = $('dash-start-here');
    const list = $('dash-start-list');
    const sub = $('dash-start-sub');
    const open = startHereOpen();
    if (col) col.classList.toggle('is-start-here', open);
    if (wrap) wrap.classList.toggle('hidden', !open);
    if (!open || !list) return;
    const steps = startHereSteps();
    const doneCount = steps.filter(function (step) { return step.done; }).length;
    if (sub) sub.textContent = doneCount + ' of ' + steps.length + ' done. A step checks itself when it is saved.';
    list.innerHTML = steps.map(function (step) {
      return '<div class="start-here-row' + (step.done ? ' is-done' : '') + '">' +
        '<span class="start-here-check" aria-hidden="true"></span>' +
        '<div><strong>' + esc(step.title) + '</strong><span>' + esc(step.text) + '</span></div>' +
        '<a href="' + esc(step.href) + '">Open</a>' +
        '</div>';
    }).join('');
  }
  function refreshHomeData() {
    Promise.all([
      api('/api/dealer/book').catch(function () { return null; }),
      api('/api/dealer/registrations').catch(function () { return { registrations: [] }; }),
      api('/api/dealer/projects').catch(function () { return { projects: [] }; }),
      api('/api/dealer/panels').catch(function () { return { panels: [] }; }),
      api('/api/dealer/leads').catch(function () { return { leads: [] }; }),
      api('/api/dealer/walls').catch(function () { return { walls: [] }; }),
      refreshDocs().catch(function () {})
    ]).then(function (saved) {
      if (saved[0] && saved[0].items) book = saved[0].items;
      registrations = (saved[1] && saved[1].registrations) || [];
      projects = (saved[2] && saved[2].projects) || [];
      panels = (saved[3] && saved[3].panels) || [];
      leads = (saved[4] && saved[4].leads) || [];
      walls = (saved[5] && saved[5].walls) || [];
      if (pathView() === 'home') renderHome();
    }).catch(function () {});
  }
  function renderHomeDetail() {
    const title = $('dash-detail-title');
    const sub = $('dash-detail-sub');
    const open = $('dash-detail-open');
    const stats = $('dash-detail-stats');
    const list = $('dash-detail-list');
    const panel = document.querySelector('.dash-home-detail');
    if (!title || !sub || !open || !stats || !list) return;
    if (panel) panel.classList.remove('is-start-here');
    open.hidden = false;
    stats.hidden = false;
    if (dashHome === 'quotes') {
      title.textContent = 'Request Quote';
      sub.textContent = 'Sales quote drafts sent to Spectrum.';
      open.href = '/portal/quotes';
      open.textContent = 'Open Request Quote →';
      const drafts = docs.quote.filter(function (doc) { return doc.status === 'draft'; }).length;
      stats.innerHTML = chip(dashCount(docs.quote.length), 'Request Quote') + chip(dashCount(drafts), 'Drafts') + chip(money(docsTotal(docs.quote)), 'Total');
      list.innerHTML = docs.quote.slice(0, 8).map(function (doc) {
        return dashRow(doc.number || 'Request Quote', doc.status || '', money(doc.total));
      }).join('') || '<p class="dash-activity-empty">No request quotes yet.</p>';
      return;
    }
    if (dashHome === 'orders') {
      title.textContent = 'Purchase Order';
      sub.textContent = 'Sales order drafts sent to Spectrum. There is no online checkout.';
      open.href = '/portal/orders';
      open.textContent = 'Open Purchase Order →';
      const drafts = docs.order.filter(function (doc) { return doc.status === 'draft'; }).length;
      stats.innerHTML = chip(dashCount(docs.order.length), 'Purchase Order') + chip(dashCount(drafts), 'Drafts') + chip(money(docsTotal(docs.order)), 'Total');
      list.innerHTML = docs.order.slice(0, 8).map(function (doc) {
        return dashRow(doc.number || 'Purchase Order', doc.status || '', money(doc.total));
      }).join('') || '<p class="dash-activity-empty">No purchase orders yet.</p>';
      return;
    }
    if (dashHome === 'walls') {
      title.textContent = 'Installed Walls';
      sub.textContent = 'Walls Spectrum shipped for your jobs.';
      open.href = '/portal/walls';
      open.textContent = 'Open Installed Walls →';
      const spares = walls.filter(function (row) { return Number(row.spareQty) > 0; }).length;
      stats.innerHTML = chip(dashCount(walls.length), 'Walls') + chip(dashCount(spares), 'With spares');
      list.innerHTML = walls.slice(0, 8).map(function (row) {
        return dashRow(row.wallName || row.number || 'Installed wall', [row.endCustomer, wallSite(row)].filter(Boolean).join(' · '), row.shipDate || '');
      }).join('') || '<p class="dash-activity-empty">No installed walls yet.</p>';
      return;
    }
    title.textContent = 'Leads';
    sub.textContent = 'Leads Spectrum sent you. A new one starts in New.';
    open.href = '/portal/leads';
    open.textContent = 'Open Leads →';
    const openLeads = boardLeads();
    stats.innerHTML = chip(dashCount(openLeads.length), 'On board');
    list.innerHTML = openLeads.slice(0, 8).map(function (row) {
      return dashRow(row.project || row.number || 'Lead', [row.stageLabel || 'New', leadPlace(row)].filter(Boolean).join(' · '), row.contactName || '');
    }).join('') || '<p class="dash-activity-empty">No leads yet. Spectrum sends these.</p>';
  }
  function stockLabel(status) {
    if (status === 'out') return 'Out';
    if (status === 'low') return 'Low';
    if (status === 'untracked') return 'Vendor';
    if (status === 'special') return 'Special order';
    if (status === 'inactive') return 'Inactive';
    return 'In stock';
  }
  function stockDot(status) {
    if (status === 'out' || status === 'inactive') return 'is-out';
    if (status === 'low') return 'is-low';
    if (status === 'untracked') return 'is-untracked';
    if (status === 'special') return 'is-empty';
    return 'is-in';
  }
  function panelTypeLabel(value) {
    const map = {
      'indoor-fixed': 'Indoor Fixed',
      'outdoor-fixed': 'Outdoor Fixed',
      'indoor-rental': 'Indoor Rental',
      'outdoor-rental': 'Outdoor Rental'
    };
    return map[value] || value || '';
  }
  function bookPrice(n) {
    return Number(n) ? money(n) : '—';
  }
  function fillBookSelect(id, values, current, blank) {
    const el = $(id);
    if (!el) return;
    const options = ['<option value="">' + esc(blank) + '</option>'].concat(values.map(function (value) {
      return '<option value="' + esc(value) + '"' + (value === current ? ' selected' : '') + '>' + esc(value) + '</option>';
    }));
    el.innerHTML = options.join('');
  }
  function bookRows() {
    const q = String(($('inv-search') && $('inv-search').value) || '').trim().toLowerCase();
    const category = ($('inv-category-filter') && $('inv-category-filter').value) || '';
    return book.filter(function (item) {
      if (bookFilter === 'low' && item.status !== 'low') return false;
      if (bookFilter === 'out' && item.status !== 'out') return false;
      if (category && item.category !== category) return false;
      if (!q) return true;
      const hay = [item.sku, item.name, item.brand, item.category, item.description].join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }
  const PORTAL_COLS = {
    'dealer-book': {
      lock: 'name',
      cols: [
        { id: 'name', label: 'Item' },
        { id: 'sku', label: 'SKU' },
        { id: 'category', label: 'Category' },
        { id: 'description', label: 'Description' },
        { id: 'pitch', label: 'Pitch' },
        { id: 'brand', label: 'Brand' },
        { id: 'qty', label: 'On hand' },
        { id: 'price', label: 'Sell price' },
        { id: 'dealer', label: 'Dealer net' },
        { id: 'photo', label: 'Photo' }
      ]
    },
    sales: {
      lock: 'number',
      cols: [
        { id: 'number', label: 'Number' },
        { id: 'customer', label: 'Customer' },
        { id: 'date', label: 'Date' },
        { id: 'status', label: 'Status' },
        { id: 'total', label: 'Total' },
        { id: 'po', label: 'PO number' },
        { id: 'due', label: 'Valid until' },
        { id: 'terms', label: 'Terms' },
        { id: 'notes', label: 'Notes' }
      ]
    },
    'so-lines': {
      lock: 'sku',
      cols: [
        { id: 'sku', label: 'SKU' },
        { id: 'item', label: 'Item' },
        { id: 'description', label: 'Description' },
        { id: 'qty', label: 'Qty' },
        { id: 'onHand', label: 'On hand' },
        { id: 'sell', label: 'Sell Price' },
        { id: 'dealer', label: 'Dealer Price' },
        { id: 'price', label: 'Price' },
        { id: 'amount', label: 'Amount' }
      ]
    },
    registrations: {
      lock: 'number',
      cols: [
        { id: 'number', label: 'Number' },
        { id: 'customer', label: 'End customer' },
        { id: 'job', label: 'Job' },
        { id: 'site', label: 'Site' },
        { id: 'status', label: 'Status' }
      ]
    },
    leads: {
      lock: 'number',
      cols: [
        { id: 'number', label: 'Number' },
        { id: 'project', label: 'Project' },
        { id: 'contact', label: 'Contact' },
        { id: 'city', label: 'City' },
        { id: 'status', label: 'Status' }
      ]
    },
    walls: {
      lock: 'wall',
      cols: [
        { id: 'wall', label: 'Wall' },
        { id: 'number', label: 'Number' },
        { id: 'customer', label: 'End customer' },
        { id: 'site', label: 'Site' },
        { id: 'pitch', label: 'Pitch' },
        { id: 'ship', label: 'Ship date' },
        { id: 'wstart', label: 'Warranty start' },
        { id: 'warranty', label: 'Warranty end' },
        { id: 'spares', label: 'Spares' }
      ]
    },
    rmas: {
      lock: 'number',
      cols: [
        { id: 'number', label: 'Number' },
        { id: 'date', label: 'Date' },
        { id: 'order', label: 'Order or PO' },
        { id: 'reason', label: 'Reason' },
        { id: 'status', label: 'Status' }
      ]
    },
    projects: {
      lock: 'title',
      cols: [
        { id: 'title', label: 'Project' },
        { id: 'brand', label: 'Brand' },
        { id: 'series', label: 'Series' },
        { id: 'size', label: 'Size' },
        { id: 'pitch', label: 'Pitch' },
        { id: 'panels', label: 'Panels' },
        { id: 'saved', label: 'Saved' }
      ]
    },
    panels: {
      lock: 'name',
      cols: [
        { id: 'name', label: 'Name' },
        { id: 'size', label: 'Size' },
        { id: 'pitch', label: 'Pitch' },
        { id: 'type', label: 'Type' },
        { id: 'weight', label: 'Weight' },
        { id: 'saved', label: 'Saved' }
      ]
    }
  };
  function portalTable(name) {
    return document.querySelector('table.dash-cols[data-cols="' + name + '"]');
  }
  function colKey(name) {
    const id = me && me.user && me.user.id;
    if (name === 'dealer-book') return 'portal-book-cols-' + (id || 'anon');
    if (name === 'so-lines') return 'portal-cols-so-lines-sku-' + (id || 'anon');
    return 'portal-cols-' + name + '-' + (id || 'anon');
  }
  function colKnown(name) {
    const spec = PORTAL_COLS[name];
    return spec ? spec.cols.map(function (col) { return col.id; }) : [];
  }
  function colLock(name) {
    const spec = PORTAL_COLS[name];
    return spec ? spec.lock : '';
  }
  let portalPrefs = {};
  let portalPrefsTimer = null;
  function savedColRecord(name) {
    const remote = portalPrefs && portalPrefs[name];
    if (remote && typeof remote === 'object') return remote;
    try { return JSON.parse(localStorage.getItem(colKey(name)) || 'null'); } catch (err) { return null; }
  }
  function colState(name) {
    const known = colKnown(name);
    const lock = colLock(name);
    let saved = savedColRecord(name);
    if (!saved || typeof saved !== 'object' || !known.length) {
      return { order: known.slice(), hidden: [], sortCol: '', sortDir: '', widths: {} };
    }
    const hidden = (saved.hidden || []).filter(function (id) {
      return known.indexOf(id) !== -1 && id !== lock;
    });
    const order = [];
    if (lock && known.indexOf(lock) !== -1) order.push(lock);
    (saved.order || []).forEach(function (id) {
      if (known.indexOf(id) === -1 || hidden.indexOf(id) !== -1 || order.indexOf(id) !== -1) return;
      order.push(id);
    });
    known.forEach(function (id) {
      if (order.indexOf(id) === -1 && hidden.indexOf(id) === -1) order.push(id);
    });
    const splitLeftPx = parseInt(saved.splitLeftPx, 10);
    return {
      order: order,
      hidden: hidden,
      sortCol: known.indexOf(saved.sortCol) !== -1 ? saved.sortCol : '',
      sortDir: saved.sortDir === 'asc' || saved.sortDir === 'desc' ? saved.sortDir : '',
      widths: saved.widths && typeof saved.widths === 'object' ? saved.widths : {},
      splitLeftPx: Number.isFinite(splitLeftPx) && splitLeftPx >= 160 ? splitLeftPx : 0
    };
  }
  function persistPortalPrefs() {
    clearTimeout(portalPrefsTimer);
    portalPrefsTimer = setTimeout(function () {
      api('/api/dealer/column-prefs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefs: portalPrefs })
      }).catch(function () {});
    }, 300);
  }
  function saveColState(name, state) {
    portalPrefs[name] = state;
    try { localStorage.setItem(colKey(name), JSON.stringify(state)); } catch (err) {}
    persistPortalPrefs();
  }
  function applyPortalSplits() {
    function place(id, prop, px) {
      const el = $(id);
      if (!el || !px) return;
      el.style.setProperty(prop, px + 'px');
    }
    place('inv-split', '--inv-left-w', colState('dealer-book').splitLeftPx);
    place('wall-split', '--inv-left-w', colState('walls').splitLeftPx);
    place('proj-split', '--inv-left-w', colState('projects').splitLeftPx);
    place('panel-split', '--inv-left-w', colState('panels').splitLeftPx);
    place('lead-split', '--lead-left-w', colState('leads').splitLeftPx);
    place('dr-split', '--dash-left-w', colState('registrations').splitLeftPx);
    place('rma-split', '--rma-left-w', colState('rmas').splitLeftPx);
  }
  function savePortalSplit(name, px) {
    const state = colState(name);
    state.splitLeftPx = Math.round(px);
    saveColState(name, state);
  }
  function seedPrefsFromLocal() {
    const out = {};
    Object.keys(PORTAL_COLS).forEach(function (name) {
      try {
        const saved = JSON.parse(localStorage.getItem(colKey(name)) || 'null');
        if (saved && typeof saved === 'object') out[name] = saved;
      } catch (err) {}
    });
    return out;
  }
  async function loadPortalPrefs() {
    try {
      const data = await api('/api/dealer/column-prefs');
      portalPrefs = (data && data.prefs) || {};
    } catch (err) {
      portalPrefs = {};
    }
    if (!portalPrefs || !Object.keys(portalPrefs).length) {
      const seeded = seedPrefsFromLocal();
      if (Object.keys(seeded).length) {
        portalPrefs = seeded;
        persistPortalPrefs();
      }
    }
    applyPortalSplits();
  }
  function applyCols(name) {
    const table = portalTable(name);
    if (!table) return;
    const state = colState(name);
    const row = table.querySelector('thead tr');
    if (!row) return;
    const startLocked = Array.prototype.filter.call(row.children, function (th) {
      return th.getAttribute('data-lock') === 'start';
    });
    const endLocked = Array.prototype.filter.call(row.children, function (th) {
      return !th.getAttribute('data-col') && th.getAttribute('data-lock') !== 'start';
    });
    const lockedIds = {};
    startLocked.forEach(function (th) {
      row.appendChild(th);
      const id = th.getAttribute('data-col');
      if (id) lockedIds[id] = true;
    });
    state.order.forEach(function (id) {
      if (lockedIds[id]) return;
      const th = row.querySelector('th[data-col="' + id + '"]');
      if (th) row.appendChild(th);
    });
    state.hidden.forEach(function (id) {
      if (lockedIds[id]) return;
      const th = row.querySelector('th[data-col="' + id + '"]');
      if (th) row.appendChild(th);
    });
    endLocked.forEach(function (th) { row.appendChild(th); });
    Array.prototype.forEach.call(row.querySelectorAll('th[data-col]'), function (th) {
      const col = th.getAttribute('data-col');
      const locked = th.getAttribute('data-lock') === 'start';
      th.hidden = locked ? false : state.hidden.indexOf(col) !== -1;
      th.style.width = state.widths[col] || '';
      const caret = th.querySelector('.dash-col-caret');
      if (caret) {
        caret.textContent = state.sortCol === col && state.sortDir === 'asc' ? '▴' : '▾';
        caret.classList.toggle('is-on', state.sortCol === col);
      }
    });
  }
  function colSort(name, rows, getValue) {
    const state = colState(name);
    if (!state.sortCol || !state.sortDir || !getValue) return rows;
    const dir = state.sortDir === 'desc' ? -1 : 1;
    return rows.slice().sort(function (a, b) {
      const av = getValue(a, state.sortCol);
      const bv = getValue(b, state.sortCol);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av == null ? '' : av).localeCompare(String(bv == null ? '' : bv), undefined, { numeric: true, sensitivity: 'base' }) * dir;
    });
  }
  function colCells(name, cells) {
    return colState(name).order.map(function (id) { return cells[id] || ''; }).join('');
  }
  function colSpan(name) {
    return colState(name).order.length || 1;
  }
  function applyBookCols() { applyCols('dealer-book'); }
  function bookColState() { return colState('dealer-book'); }
  function bookSortValue(item, col) {
    if (col === 'name') return item.name || '';
    if (col === 'sku') return item.sku || '';
    if (col === 'category') return item.category || '';
    if (col === 'description') return item.description || '';
    if (col === 'pitch') return item.pitchLabel || item.pitch || '';
    if (col === 'brand') return item.brand || '';
    if (col === 'qty') return Number(item.qty) || 0;
    if (col === 'price') return Number(item.listPrice) || 0;
    if (col === 'dealer') return Number(item.dealerNet) || 0;
    if (col === 'photo') return item.image || '';
    return '';
  }
  function sortBookRows(rows) {
    const state = bookColState();
    if (!state.sortCol || !state.sortDir) return rows;
    const dir = state.sortDir === 'desc' ? -1 : 1;
    return rows.slice().sort(function (a, b) {
      const av = bookSortValue(a, state.sortCol);
      const bv = bookSortValue(b, state.sortCol);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir;
    });
  }
  function closeColAdd() {
    const panel = $('dash-col-add');
    if (panel) panel.hidden = true;
    const addBtn = document.querySelector('#dash-col-menu [data-col-act="add"]');
    if (addBtn) addBtn.classList.remove('is-on');
  }
  function closeColMenu() {
    closeColAdd();
    const menu = $('dash-col-menu');
    if (!menu) return;
    menu.hidden = true;
    menu._col = '';
    menu._name = '';
  }
  function placeColAdd() {
    const menu = $('dash-col-menu');
    const panel = $('dash-col-add');
    if (!menu || !panel || panel.hidden) return;
    const box = menu.getBoundingClientRect();
    const pw = panel.offsetWidth || 184;
    const ph = panel.offsetHeight || 0;
    let left = box.right + 6;
    if (left + pw > window.innerWidth - 8) left = box.left - pw - 6;
    let top = box.top;
    if (top + ph > window.innerHeight - 8) top = window.innerHeight - ph - 8;
    panel.style.left = Math.max(8, left) + 'px';
    panel.style.top = Math.max(8, top) + 'px';
  }
  function openColAdd(name) {
    const menu = $('dash-col-menu');
    const panel = $('dash-col-add');
    const list = $('dash-col-add-list');
    const spec = PORTAL_COLS[name];
    const addBtn = menu.querySelector('[data-col-act="add"]');
    if (!panel.hidden) {
      closeColAdd();
      return;
    }
    const shown = colState(name).order;
    list.innerHTML = (spec ? spec.cols : []).map(function (col) {
      const on = shown.indexOf(col.id) !== -1;
      return '<button type="button" data-add-col="' + esc(col.id) + '"' +
        (on ? ' disabled class="is-on"' : '') + '>' +
        (on ? '✓ ' : '') + esc(col.label) + '</button>';
    }).join('');
    panel.hidden = false;
    addBtn.classList.add('is-on');
    placeColAdd();
  }
  function openColMenu(name, th) {
    if (window.matchMedia('(max-width: 900px)').matches) return;
    closeColAdd();
    const menu = $('dash-col-menu');
    const col = th.getAttribute('data-col');
    const state = colState(name);
    const i = state.order.indexOf(col);
    const locked = th.getAttribute('data-lock') === 'start';
    menu.querySelector('[data-col-act="left"]').disabled = locked || i <= 0;
    menu.querySelector('[data-col-act="right"]').disabled = locked || i === -1 || i >= state.order.length - 1;
    menu.querySelector('[data-col-act="hide"]').disabled = locked || state.order.length <= 1;
    menu._col = col;
    menu._name = name;
    menu.hidden = false;
    const box = th.getBoundingClientRect();
    const left = Math.min(box.left, window.innerWidth - menu.offsetWidth - 8);
    menu.style.left = Math.max(8, left) + 'px';
    menu.style.top = (box.bottom + 4) + 'px';
  }
  function refreshPortalTable(name) {
    if (name === 'dealer-book') renderBook();
    else if (name === 'sales') renderQuoteTable();
    else if (name === 'so-lines') applySoLineCols();
    else if (name === 'registrations') renderRegistrationTable();
    else if (name === 'leads') renderLeadTable();
    else if (name === 'walls') renderWallTable();
    else if (name === 'rmas') renderRmaTable();
    else if (name === 'projects') renderProjects();
    else if (name === 'panels') renderPanels();
  }
  function setBookFilter(name) {
    bookFilter = name === 'low' || name === 'out' ? name : 'all';
    document.querySelectorAll('#inv-overview .dash-kpi').forEach(function (btn) {
      const on = btn.getAttribute('data-filter') === bookFilter;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.querySelectorAll('#inventory-section [data-inv-filter]').forEach(function (btn) {
      const on = btn.getAttribute('data-inv-filter') === bookFilter;
      btn.classList.toggle('bg-sky-500/20', on);
      btn.classList.toggle('text-sky-300', on);
      btn.classList.toggle('text-slate-400', !on);
    });
  }
  function renderBookDetail(item) {
    const overview = $('inv-overview-panel');
    const panel = $('inv-item-panel');
    if (!item) {
      overview.classList.remove('hidden');
      panel.classList.add('hidden');
      panel.setAttribute('aria-hidden', 'true');
      return;
    }
    overview.classList.add('hidden');
    panel.classList.remove('hidden');
    panel.setAttribute('aria-hidden', 'false');
    const photo = $('inv-detail-photo');
    photo.innerHTML = item.image ? '<img src="' + esc(item.image) + '" alt="">' : '';
    $('inv-detail-name').textContent = item.name || item.sku || 'Item';
    const specBits = [item.sku, panelTypeLabel(item.panelType), item.packagingType ? String(item.packagingType).toUpperCase() : ''].filter(Boolean);
    $('inv-detail-subname').textContent = specBits.join(' · ');
    $('inv-detail-qty').textContent = String(item.qty);
    $('inv-detail-status').textContent = stockLabel(item.status);
    $('inv-detail-low').textContent = String(item.lowAt || 0);
    $('inv-detail-price').textContent = bookPrice(item.listPrice);
    $('inv-detail-dealer').textContent = money(item.dealerNet);
    $('inv-detail-brand').textContent = item.brand || '—';
    $('inv-detail-category').textContent = item.category || '—';
    $('inv-detail-pitch').textContent = item.pitchLabel || item.pitch || '—';
    $('inv-detail-unit').textContent = item.unit || '—';
    const locs = (item.locations || []).filter(function (loc) { return Number(loc.qty) > 0; });
    $('inv-detail-locations-body').innerHTML = locs.map(function (loc) {
      return '<tr><td>' + esc(loc.name) + '</td><td>' + esc(loc.type || '—') + '</td><td>' + esc(loc.qty) + '</td><td>' + (loc.tracked ? 'Yes' : 'No') + '</td></tr>';
    }).join('');
    $('inv-detail-locations-empty').classList.toggle('hidden', locs.length > 0);
    renderBookTabs(item);
  }
  function setBookDetailTab(name) {
    bookDetailTab = name === 'specs' || name === 'image' ? name : 'details';
    document.querySelectorAll('#book-detail-tabs [data-book-tab]').forEach(function (btn) {
      const on = btn.getAttribute('data-book-tab') === bookDetailTab;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    ['details', 'specs', 'image'].forEach(function (key) {
      const panel = $('book-panel-' + key);
      if (!panel) return;
      const on = key === bookDetailTab;
      panel.classList.toggle('hidden', !on);
      panel.hidden = !on;
    });
  }
  function renderBookTabs(item) {
    const read = $('book-detail-read');
    if (read) {
      const size = item.panelW && item.panelH ? (item.panelW + ' × ' + item.panelH) : '—';
      const rows = [
        ['SKU', item.sku || '—'],
        ['Name', item.name || '—'],
        ['Description', item.description || '—'],
        ['Brand', item.brand || '—'],
        ['Category', item.category || '—'],
        ['Unit', item.unit || '—'],
        ['Pitch', item.pitchLabel || item.pitch || '—'],
        ['Panel size', size],
        ['Dealer price', money(item.dealerNet)]
      ];
      read.innerHTML = rows.map(function (pair) {
        return '<div><dt>' + esc(pair[0]) + '</dt><dd>' + esc(pair[1]) + '</dd></div>';
      }).join('');
    }
    const docs = item.docs || [];
    const specList = $('book-detail-specs');
    if (specList) {
      specList.innerHTML = docs.map(function (doc) {
        return '<li class="inv-spec-row"><a href="' + esc(specFileHref(doc.url)) + '" target="_blank" rel="noopener">' + esc(doc.name || 'Spec sheet') + '</a></li>';
      }).join('');
    }
    const specEmpty = $('book-detail-specs-empty');
    if (specEmpty) specEmpty.classList.toggle('hidden', docs.length > 0);
    const urls = [];
    if (item.image) urls.push(item.image);
    (item.gallery || []).forEach(function (url) {
      if (url && urls.indexOf(url) === -1) urls.push(url);
    });
    const images = $('book-detail-images');
    if (images) {
      images.innerHTML = urls.map(function (url) {
        return '<img src="' + esc(url) + '" alt="">';
      }).join('');
    }
    const imageEmpty = $('book-detail-images-empty');
    if (imageEmpty) imageEmpty.classList.toggle('hidden', urls.length > 0);
    setBookDetailTab(bookDetailTab);
  }
  function renderBook() {
    const categories = [];
    book.forEach(function (item) {
      if (item.category && categories.indexOf(item.category) === -1) categories.push(item.category);
    });
    categories.sort();
    fillBookSelect('inv-category-filter', categories, ($('inv-category-filter') && $('inv-category-filter').value) || '', 'All categories');
    const low = book.filter(function (item) { return item.status === 'low'; }).length;
    const out = book.filter(function (item) { return item.status === 'out'; }).length;
    $('inv-stat-skus').textContent = String(book.length);
    $('inv-stat-low').textContent = String(low);
    $('inv-stat-out').textContent = String(out);
    setBookFilter(bookFilter);
    applyBookCols();
    const state = bookColState();
    let rows = bookRows();
    if (bookSku && !rows.some(function (item) { return item.sku === bookSku; })) bookSku = '';
    rows = sortBookRows(rows);
    $('inventory-table').innerHTML = rows.length ? rows.map(function (item) {
      const photo = item.image
        ? '<img src="' + esc(item.image) + '" alt="" class="dash-col-photo">'
        : '<span class="text-slate-400">—</span>';
      const cells = {
        name: '<td class="py-3 px-4 font-medium"><span class="cc-acct-cell"><span class="cc-acct-status ' + stockDot(item.status) + '" title="' + esc(stockLabel(item.status)) + '" aria-hidden="true"></span><span class="cc-acct-name">' + esc(item.name || '') + '</span></span></td>',
        sku: '<td class="py-3 px-4 font-mono text-xs text-sky-300">' + esc(item.sku || '—') + '</td>',
        category: '<td class="py-3 px-4 text-slate-400">' + esc(item.category || '—') + '</td>',
        description: '<td class="py-3 px-4 text-slate-400">' + esc(item.description || '—') + '</td>',
        pitch: '<td class="py-3 px-4 text-slate-400">' + esc(item.pitchLabel || item.pitch || '—') + '</td>',
        brand: '<td class="py-3 px-4 text-sky-400">' + esc(item.brand || '—') + '</td>',
        qty: '<td class="py-3 px-4">' + esc(item.qty) + '</td>',
        price: '<td class="py-3 px-4">' + bookPrice(item.listPrice) + '</td>',
        dealer: '<td class="py-3 px-4">' + money(item.dealerNet) + '</td>',
        photo: '<td class="py-3 px-4">' + photo + '</td>'
      };
      return '<tr class="border-b border-slate-800 cursor-pointer' + (item.sku === bookSku ? ' is-selected' : '') + '" data-sku="' + esc(item.sku) + '">' +
        state.order.map(function (id) { return cells[id] || ''; }).join('') + '</tr>';
    }).join('') : '<tr><td class="py-6 px-4 text-slate-500" colspan="' + state.order.length + '">No priced SKUs yet.</td></tr>';
    const selected = bookSku ? book.find(function (item) { return item.sku === bookSku; }) : null;
    renderBookDetail(selected || null);
  }
  function salesKind() {
    return pathView() === 'orders' ? 'order' : 'quote';
  }
  function salesTab() {
    return salesKind() === 'order' ? 'orders' : 'quotes';
  }
  function salesLabel(kind) {
    return kind === 'order' ? 'Purchase Order' : 'Request Quote';
  }
  function quoteRoute() {
    const parts = location.pathname.replace(/\/+$/, '').split('/');
    if ((parts[2] !== 'quotes' && parts[2] !== 'orders') || !parts[3]) return '';
    return parts[3];
  }
  function dealerCompanyName() {
    const c = me && me.customer;
    return (c && (c.companyName || c.displayName)) || '';
  }
  function addressText(src, prefix) {
    const row = src || {};
    const street = row[prefix + 'Street'] || '';
    const city = [row[prefix + 'City'], row[prefix + 'State']].filter(Boolean).join(', ');
    const tail = [city, row[prefix + 'Zip']].filter(Boolean).join(' ');
    const lines = [street, tail, row[prefix + 'Country']].filter(Boolean);
    return lines.join('\n') || '—';
  }
  function bookBySku(sku) {
    const key = String(sku || '').trim().toLowerCase();
    if (!key) return null;
    return book.find(function (item) { return String(item.sku || '').trim().toLowerCase() === key; }) || null;
  }
  function quoteStatusLabel(status) {
    const value = status || 'draft';
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
  function ensureSelectValue(select, value) {
    if (!select) return;
    const text = value == null ? '' : String(value);
    let found = false;
    Array.prototype.forEach.call(select.options, function (opt) {
      if (opt.value === text) found = true;
    });
    if (!found && text) {
      const opt = document.createElement('option');
      opt.value = text;
      opt.textContent = text;
      select.appendChild(opt);
    }
    select.value = text;
  }
  function showQuoteMsg(text, ok) {
    const el = $('so-msg');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'text-sm ' + (ok ? 'text-sky-600' : 'text-red-400');
    el.classList.toggle('hidden', !text);
  }
  function showQuoteError(text) {
    const el = $('so-error');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('hidden', !text);
  }
  function closeSkuMenu() {
    const menu = $('so-sku-menu');
    if (!menu) return;
    menu.hidden = true;
    menu._input = null;
  }
  function blankQuoteLine() {
    return { item: '', sku: '', description: '', qty: '', unitPrice: '' };
  }
  function quoteLineRow(line, index) {
    const item = line || blankQuoteLine();
    const inv = bookBySku(item.sku);
    const qty = item.qty == null || item.qty === '' ? '' : item.qty;
    const price = item.unitPrice == null || item.unitPrice === '' ? (inv ? inv.dealerNet : '') : item.unitPrice;
    const amount = (Number(qty) || 0) * (Number(price) || 0);
    const has = !!(item.sku || item.item || item.description || Number(price));
    const sell = inv && Number(inv.listPrice) ? money(inv.listPrice) : '—';
    return '<tr class="border-b so-line">' +
      '<td class="py-2 px-1 so-line-lead"><span class="so-line-num">' + (index + 1) + '</span></td>' +
      '<td class="py-2 px-2" data-col="sku"><div class="so-sku-search"><svg class="so-sku-search-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/></svg><input data-line="sku" type="search" autocomplete="off" placeholder="Search SKU, name, brand" value="' + esc(item.sku || '') + '"></div></td>' +
      '<td class="py-2 px-2" data-col="item"><input data-line="item" value="' + esc(item.item || (inv && inv.name) || '') + '"></td>' +
      '<td class="py-2 px-2" data-col="description"><input data-line="description" value="' + esc(item.description || '') + '"></td>' +
      '<td class="py-2 px-2" data-col="qty"><input data-line="qty" type="number" min="0" step="1" value="' + esc(qty) + '"></td>' +
      '<td class="py-2 px-2 tabular-nums so-inv-read" data-col="onHand" data-line="onHand">' + (inv ? esc(inv.qty) : '—') + '</td>' +
      '<td class="py-2 px-2 tabular-nums so-inv-read" data-col="sell" data-line="sell">' + sell + '</td>' +
      '<td class="py-2 px-2 tabular-nums so-inv-read" data-col="dealer" data-line="dealer">' + (inv ? money(inv.dealerNet) : '—') + '</td>' +
      '<td class="py-2 px-2" data-col="price"><input data-line="unitPrice" type="number" step="0.01" readonly value="' + esc(price === '' ? '' : price) + '"></td>' +
      '<td class="py-2 px-2 text-right tabular-nums" data-col="amount" data-line-amt>' + (has && (Number(qty) || Number(price)) ? money(amount) : '') + '</td>' +
      '<td class="py-2 px-1 so-line-acts">' +
        '<button type="button" data-insert-line class="so-line-act" title="Insert row" aria-label="Insert row">+</button>' +
        '<button type="button" data-remove-line class="so-line-act so-line-act-del" title="Remove row" aria-label="Remove row">✕</button>' +
      '</td></tr>';
  }
  function paintQuoteLines(lines, locked) {
    const source = (lines || []).filter(function (line) { return line && (line.sku || line.item); });
    const rows = source.slice();
    if (!locked) {
      while (rows.length < 6) rows.push(blankQuoteLine());
    }
    if (!rows.length) rows.push(blankQuoteLine());
    $('so-lines').innerHTML = rows.map(quoteLineRow).join('');
    applySoLineCols();
    refreshQuoteTotals();
  }
  function soLineSortValue(tr, col) {
    const td = tr.querySelector('td[data-col="' + col + '"]');
    if (!td) return '';
    const input = td.querySelector('input, select, textarea');
    if (input && (col === 'qty' || col === 'price')) return Number(input.value) || 0;
    if (input) return input.value || '';
    if (col === 'onHand' || col === 'amount' || col === 'sell' || col === 'dealer') {
      const n = Number(String(td.textContent || '').replace(/[^0-9.-]/g, ''));
      return isNaN(n) ? 0 : n;
    }
    return td.textContent || '';
  }
  function applySoLineCols() {
    applyCols('so-lines');
    const state = colState('so-lines');
    const body = $('so-lines');
    if (!body) return;
    Array.prototype.forEach.call(body.querySelectorAll('.so-line'), function (tr) {
      const byCol = {};
      Array.prototype.forEach.call(tr.querySelectorAll('td[data-col]'), function (td) {
        byCol[td.getAttribute('data-col')] = td;
      });
      const lead = tr.querySelector('td.so-line-lead');
      const acts = tr.querySelector('td.so-line-acts');
      if (lead) tr.appendChild(lead);
      state.order.forEach(function (id) {
        if (!byCol[id]) return;
        byCol[id].hidden = false;
        tr.appendChild(byCol[id]);
      });
      state.hidden.forEach(function (id) {
        if (!byCol[id]) return;
        byCol[id].hidden = true;
        tr.appendChild(byCol[id]);
      });
      if (acts) tr.appendChild(acts);
    });
    if (state.sortCol && state.sortDir) {
      const dir = state.sortDir === 'desc' ? -1 : 1;
      const rows = Array.prototype.slice.call(body.querySelectorAll('.so-line'));
      rows.sort(function (a, b) {
        const av = soLineSortValue(a, state.sortCol);
        const bv = soLineSortValue(b, state.sortCol);
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
        return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir;
      });
      rows.forEach(function (tr) { body.appendChild(tr); });
    }
  }
  function readQuoteLines() {
    return Array.prototype.map.call(document.querySelectorAll('#so-lines .so-line'), function (row) {
      const val = function (key) {
        const el = row.querySelector('[data-line="' + key + '"]');
        return el ? String(el.value || '').trim() : '';
      };
      return {
        item: val('item'),
        sku: val('sku'),
        description: val('description'),
        qty: Number(val('qty')) || 0
      };
    }).filter(function (line) { return line.sku; });
  }
  function refreshQuoteTotals() {
    let subtotal = 0;
    document.querySelectorAll('#so-lines .so-line').forEach(function (row, index) {
      const num = row.querySelector('.so-line-num');
      if (num) num.textContent = String(index + 1);
      const sku = (row.querySelector('[data-line="sku"]') || {}).value || '';
      const inv = bookBySku(sku);
      const qty = Number((row.querySelector('[data-line="qty"]') || {}).value) || 0;
      const price = inv ? Number(inv.dealerNet) || 0 : (Number((row.querySelector('[data-line="unitPrice"]') || {}).value) || 0);
      const priceEl = row.querySelector('[data-line="unitPrice"]');
      if (priceEl && inv) priceEl.value = String(inv.dealerNet);
      const onHand = row.querySelector('[data-line="onHand"]');
      const sell = row.querySelector('[data-line="sell"]');
      const dealer = row.querySelector('[data-line="dealer"]');
      if (onHand) onHand.textContent = inv ? String(inv.qty) : '—';
      if (sell) sell.textContent = inv && Number(inv.listPrice) ? money(inv.listPrice) : '—';
      if (dealer) dealer.textContent = inv ? money(inv.dealerNet) : '—';
      const amt = qty * price;
      if (sku) subtotal += amt;
      const amtEl = row.querySelector('[data-line-amt]');
      if (amtEl) amtEl.textContent = sku && qty ? money(amt) : '';
    });
    const discount = Math.max(0, Number($('so-discount') && $('so-discount').value) || 0);
    const rate = Math.max(0, Number($('so-tax-rate') && $('so-tax-rate').value) || 0);
    const taxable = Math.max(0, subtotal - discount);
    const tax = taxable * (rate / 100);
    const total = taxable + tax;
    $('so-subtotal').textContent = money(subtotal);
    $('so-tax').textContent = money(tax);
    $('so-grand').textContent = money(total);
    $('so-head-amount').textContent = money(total);
    $('so-payments-applied').textContent = money(0);
    $('so-balance-due').textContent = money(total);
  }
  function applyBookSku(row, sku) {
    if (!row) return;
    const inv = bookBySku(sku);
    if (!inv) return;
    const item = row.querySelector('[data-line="item"]');
    const skuEl = row.querySelector('[data-line="sku"]');
    const desc = row.querySelector('[data-line="description"]');
    const qty = row.querySelector('[data-line="qty"]');
    if (item && !item.value) item.value = inv.name || inv.sku;
    if (skuEl) skuEl.value = inv.sku;
    if (desc && !desc.value) desc.value = [inv.brand, inv.pitchLabel || inv.pitch, inv.description].filter(Boolean).join(' · ');
    if (qty && !qty.value) qty.value = '1';
    refreshQuoteTotals();
  }
  function openSkuMenu(input) {
    const menu = $('so-sku-menu');
    const list = menu && menu.querySelector('.so-sku-menu-list');
    if (!menu || !list || !input) return;
    const q = String(input.value || '').trim().toLowerCase();
    const hits = book.filter(function (item) {
      const blob = ((item.sku || '') + ' ' + (item.name || '') + ' ' + (item.brand || '') + ' ' + (item.category || '')).toLowerCase();
      return !q || blob.indexOf(q) !== -1;
    }).slice(0, 12);
    list.innerHTML = hits.length ? hits.map(function (item) {
      return '<button type="button" class="so-sku-opt" data-sku="' + esc(item.sku) + '"><span class="so-sku-opt-sku">' + esc(item.sku) + '</span><span class="so-sku-opt-name">' + esc(item.name || '') + '</span><span>' + money(item.dealerNet) + '</span></button>';
    }).join('') : '<p class="px-3 py-2 text-sm text-slate-500">No priced SKU matches.</p>';
    const rect = input.getBoundingClientRect();
    menu.hidden = false;
    menu.style.left = Math.max(8, rect.left) + 'px';
    menu.style.top = (rect.bottom + 4) + 'px';
    menu.style.width = Math.max(rect.width, 280) + 'px';
    menu._input = input;
  }
  function setQuoteLocked(locked) {
    const detail = $('so-detail');
    const writingRequest = $('so-type').value !== 'order' && !locked;
    if (detail) detail.classList.toggle('is-request', writingRequest);
    ['so-issue', 'so-po', 'so-due', 'so-so-number', 'so-rep', 'so-account', 'so-ship-date', 'so-ship-via', 'so-tracking', 'so-notes', 'so-discount', 'so-tax-rate'].forEach(function (id) {
      const el = $(id);
      if (el) el.readOnly = !!locked;
    });
    $('so-terms').disabled = !!locked;
    $('so-status').disabled = true;
    const hideSave = !!locked;
    ['so-save', 'so-save-close', 'so-save-new', 'so-revert', 'so-add-line'].forEach(function (id) {
      const el = $(id);
      if (el) el.classList.toggle('hidden', hideSave);
    });
    const canDelete = !locked && !!$('so-id').value;
    $('so-delete-btn').classList.toggle('hidden', !canDelete);
    $('so-ribbon-delete').disabled = !canDelete;
    document.querySelectorAll('#so-doc-ribbon [data-so-after]').forEach(function (btn) {
      btn.disabled = hideSave;
    });
    document.querySelectorAll('#so-lines .so-line').forEach(function (row) {
      row.querySelectorAll('input').forEach(function (input) {
        if (input.getAttribute('data-line') === 'unitPrice') input.readOnly = true;
        else input.readOnly = !!locked;
      });
      row.querySelectorAll('button').forEach(function (btn) { btn.hidden = !!locked; });
    });
  }
  function fillQuoteSide() {
    const c = (me && me.customer) || {};
    $('so-side-name').textContent = dealerCompanyName() || 'Customer';
    $('so-side-phone').textContent = c.phone || '—';
    $('so-side-email').textContent = c.email || (me && me.user && me.user.email) || '—';
    const list = docs[salesKind()] || [];
    const open = list.filter(function (doc) { return doc.status === 'draft'; }).length;
    $('so-side-balance').textContent = String(open);
    $('so-side-tx-list').innerHTML = list.slice(0, 8).map(function (doc) {
      return '<button type="button" class="so-side-tx" data-quote-id="' + esc(doc.id) + '"><b>' + esc(doc.number || 'Draft') + '</b><span>' + esc(quoteStatusLabel(doc.status)) + ' · ' + money(doc.total) + '</span></button>';
    }).join('') || '<p class="text-sm text-slate-500">No ' + (salesKind() === 'order' ? 'purchase orders' : 'request quotes') + ' yet.</p>';
  }
  function fillQuoteForm(doc) {
    const customer = (me && me.customer) || {};
    const kind = (doc && doc.type) || salesKind();
    const order = kind === 'order';
    const locked = !!(doc && doc.status && doc.status !== 'draft');
    $('so-id').value = (doc && doc.id) || '';
    $('so-type').value = order ? 'order' : 'quote';
    $('so-customer').value = (doc && doc.customerName) || dealerCompanyName();
    $('so-customer-name').value = (doc && doc.customerName) || dealerCompanyName();
    $('so-customer-email').value = (doc && doc.customerEmail) || customer.email || (me && me.user && me.user.email) || '';
    $('so-number').value = (doc && doc.number) || '';
    $('so-title').textContent = doc && doc.number ? doc.number : (order ? 'New Purchase Order' : 'New Request Quote');
    $('so-caption-title').textContent = doc && doc.number ? doc.number : salesLabel(kind);
    $('so-kind-label').textContent = order ? 'Purchase Order' : 'Request Quote';
    $('so-issue').value = (doc && doc.issueDate) || new Date().toISOString().slice(0, 10);
    $('so-po').value = (doc && doc.poNumber) || '';
    ensureSelectValue($('so-terms'), (doc && doc.paymentTerms) || '30% deposit / balance before ship');
    $('so-due').value = (doc && doc.dueDate) || '';
    const status = (doc && doc.status) || 'draft';
    ensureSelectValue($('so-status'), status);
    const badge = $('so-status-badge');
    badge.hidden = false;
    badge.textContent = quoteStatusLabel(status);
    badge.className = 'so-status-badge is-' + status;
    $('so-so-number').value = (doc && doc.soNumber) || '';
    $('so-rep').value = (doc && doc.rep) || (me && me.user && me.user.name) || '';
    $('so-account').value = (doc && doc.accountNo) || '';
    $('so-ship-date').value = (doc && doc.shipDate) || '';
    $('so-ship-via').value = (doc && doc.shipVia) || '';
    $('so-tracking').value = (doc && doc.tracking) || '';
    $('so-discount').value = doc && doc.discount != null ? doc.discount : 0;
    $('so-tax-rate').value = doc && doc.taxRate != null ? doc.taxRate : 0;
    $('so-notes').value = (doc && doc.notes) || '';
    const billSrc = doc && (doc.billStreet || doc.billCity) ? doc : customer;
    const shipSrc = doc && (doc.shipStreet || doc.shipCity) ? doc : ((customer.shipSame === false && (customer.shipStreet || customer.shipCity)) ? customer : billSrc);
    const shipPrefix = (shipSrc.shipStreet || shipSrc.shipCity) ? 'ship' : 'bill';
    $('so-bill-to').textContent = addressText(billSrc, 'bill');
    $('so-ship-to').textContent = addressText(shipSrc, shipPrefix);
    paintQuoteLines((doc && doc.lines) || [], locked);
    fillQuoteSide();
    setQuoteLocked(locked);
    showQuoteMsg(locked ? ('Spectrum already has this ' + (order ? 'order' : 'quote') + '. Staff finish it in Company.') : '', true);
  }
  function showQuoteDoc(open) {
    $('so-detail').classList.toggle('hidden', !open);
    $('so-overview-panel').classList.toggle('hidden', open);
    const desktop = !isMobileDash();
    $('sales-section').classList.toggle('so-doc-open', open && !desktop);
  }
  function renderQuoteTable() {
    const q = String(($('so-search') && $('so-search').value) || '').trim().toLowerCase();
    const openId = quoteRoute();
    const list = docs[salesKind()] || [];
    const rows = list.filter(function (doc) {
      if (!q) return true;
      const blob = [doc.number, doc.customerName, doc.poNumber, doc.status, doc.notes, doc.paymentTerms].join(' ').toLowerCase();
      return blob.indexOf(q) !== -1;
    });
    const drafts = list.filter(function (doc) { return doc.status === 'draft'; }).length;
    const order = salesKind() === 'order';
    $('so-stat-quote').textContent = String(list.length);
    $('so-hint-quote').textContent = drafts ? (drafts + ' draft') : (order ? 'Sales orders' : 'Sales quotes');
    applyCols('sales');
    const sorted = colSort('sales', rows, function (doc, col) {
      if (col === 'number') return doc.number || '';
      if (col === 'customer') return doc.customerName || dealerCompanyName() || '';
      if (col === 'date') return doc.issueDate || '';
      if (col === 'status') return doc.status || '';
      if (col === 'total') return Number(doc.total) || 0;
      if (col === 'po') return doc.poNumber || '';
      if (col === 'due') return doc.dueDate || '';
      if (col === 'terms') return doc.paymentTerms || '';
      if (col === 'notes') return doc.notes || '';
      return '';
    });
    $('so-table').innerHTML = sorted.length ? sorted.map(function (doc) {
      const on = openId && String(openId) === String(doc.id);
      return '<tr class="border-b border-slate-800 hover:bg-slate-900/80 cursor-pointer' + (on ? ' is-active' : '') + '" data-quote-id="' + esc(doc.id) + '">' +
        colCells('sales', {
          number: '<td class="py-3 px-4 font-medium">' + esc(doc.number || 'Draft') + '</td>',
          customer: '<td class="py-3 px-4">' + esc(doc.customerName || dealerCompanyName() || '—') + '</td>',
          date: '<td class="py-3 px-4">' + esc(doc.issueDate || '—') + '</td>',
          status: '<td class="py-3 px-4">' + esc(quoteStatusLabel(doc.status)) + '</td>',
          total: '<td class="py-3 px-4">' + money(doc.total) + '</td>',
          po: '<td class="py-3 px-4">' + esc(doc.poNumber || '—') + '</td>',
          due: '<td class="py-3 px-4">' + esc(doc.dueDate || '—') + '</td>',
          terms: '<td class="py-3 px-4">' + esc(doc.paymentTerms || '—') + '</td>',
          notes: '<td class="py-3 px-4">' + esc(doc.notes || '—') + '</td>'
        }) + '</tr>';
    }).join('') : '<tr><td class="py-6 px-4 text-slate-500" colspan="' + colSpan('sales') + '">No ' + (order ? 'purchase orders' : 'request quotes') + ' yet.</td></tr>';
  }
  function applySalesChrome() {
    const order = salesKind() === 'order';
    const label = document.querySelector('#so-overview .dash-kpi-label');
    if (label) label.textContent = order ? 'Purchase Order' : 'Request Quote';
    const icon = document.querySelector('#so-overview .dash-kpi-icon');
    if (icon) {
      icon.classList.toggle('dash-kpi-icon-sales', order);
      icon.classList.toggle('dash-kpi-icon-website', !order);
      icon.innerHTML = order
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16l-1.5 12H5.5L4 7z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v4H8z"/><path d="M6 8h12v12H6z"/><path d="M9 12h6M9 16h4"/></svg>';
    }
    const phoneNew = isMobileDash();
    const newBtn = $('so-new-btn');
    newBtn.textContent = order ? 'New Purchase Order' : 'New Request Quote';
    newBtn.disabled = phoneNew;
    newBtn.classList.toggle('is-phone-off', phoneNew);
    newBtn.setAttribute('aria-disabled', phoneNew ? 'true' : 'false');
    const ribbonNew = $('so-ribbon-new');
    if (ribbonNew) {
      ribbonNew.disabled = phoneNew;
      ribbonNew.title = phoneNew ? 'Only available on the desktop app or a tablet.' : 'New';
    }
    $('so-back').textContent = order ? '← Purchase Order' : '← Request Quote';
    $('so-number-label').textContent = order ? 'Sales order no.' : 'Quote no.';
    const note = document.querySelector('#so-detail .so-doc-note');
    if (note) {
      note.textContent = order
        ? 'Save sends this order to Spectrum. The price is your dealer price.'
        : 'Save sends this quote to Spectrum. The price is your dealer price.';
    }
    const lead = document.querySelector('#so-overview-panel .inv-overview-lead');
    if (lead) {
      lead.textContent = order
        ? 'Select a purchase order to see the lines and where it stands. New Purchase Order starts an order with Spectrum.'
        : 'Select a request quote to read it. New Request Quote starts a request for Spectrum to price.';
    }
    const openLabel = $('so-side-open-label');
    if (openLabel) openLabel.textContent = order ? 'Open purchase orders' : 'Open request quotes';
    const txLabel = document.querySelector('#so-side-tx .so-side-label');
    if (txLabel) txLabel.textContent = order ? 'Recent purchase orders' : 'Recent request quotes';
  }
  function goSales(tab, id, push) {
    const name = tab === 'orders' || tab === 'order' ? 'orders' : 'quotes';
    const path = id ? ('/portal/' + name + '/' + id) : ('/portal/' + name);
    if (openTabs.indexOf(name) === -1) openTabs.push(name);
    if (push !== false && location.pathname.replace(/\/+$/, '') !== path) {
      history.pushState({ view: name, id: id || '' }, '', path);
    }
    renderView(name);
    renderMasterTabs();
  }
  function goQuote(id, push) {
    if (String(id) === 'new' && isMobileDash()) return;
    goSales(salesTab(), id, push);
  }
  function renderQuotes() {
    applySalesChrome();
    showQuoteError('');
    renderQuoteTable();
    const route = quoteRoute();
    if (!route) {
      showQuoteDoc(false);
      return;
    }
    if (route === 'new') {
      showQuoteMsg('');
      fillQuoteForm(null);
      applyPendingRegistration();
      showQuoteDoc(true);
      return;
    }
    const found = (docs[salesKind()] || []).find(function (doc) { return String(doc.id) === String(route); });
    if (!found) {
      showQuoteDoc(false);
      showQuoteError(salesKind() === 'order' ? 'That order is not on your account.' : 'That quote is not on your account.');
      return;
    }
    showQuoteMsg('');
    fillQuoteForm(found);
    showQuoteDoc(true);
  }
  function quotePayload() {
    return {
      poNumber: $('so-po').value,
      soNumber: $('so-so-number').value,
      rep: $('so-rep').value,
      accountNo: $('so-account').value,
      shipDate: $('so-ship-date').value,
      shipVia: $('so-ship-via').value,
      tracking: $('so-tracking').value,
      issueDate: $('so-issue').value,
      dueDate: $('so-due').value,
      paymentTerms: $('so-terms').value,
      discount: $('so-discount').value,
      taxRate: $('so-tax-rate').value,
      notes: $('so-notes').value,
      lines: readQuoteLines(),
      registrationId: !$('so-id').value && pendingRegistrationId ? pendingRegistrationId : ''
    };
  }
  async function saveQuote(after) {
    const id = $('so-id').value;
    const locked = $('so-status').value && $('so-status').value !== 'draft' && id;
    if (locked) return;
    showQuoteMsg('');
    try {
      const order = salesKind() === 'order' || $('so-type').value === 'order';
      const saved = await api(id ? ('/api/dealer/docs/' + id) : ('/api/dealer/' + (order ? 'orders' : 'quotes')), {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quotePayload())
      });
      await refreshDocs();
      pendingRegistrationId = '';
      const next = saved.doc || saved.quote || saved.order;
      if (after === 'close') goQuote('', true);
      else if (after === 'new') goQuote('new', true);
      else if (next && next.id) goQuote(next.id, true);
      showQuoteMsg(order ? 'Draft saved. It is in Company as a sales order.' : 'Draft saved. It is in Company as a sales quote.', true);
    } catch (err) {
      showQuoteMsg(err.message, false);
    }
  }
  async function deleteQuote() {
    const id = $('so-id').value;
    if (!id) return;
    if (!window.confirm(salesKind() === 'order' ? 'Delete this draft order?' : 'Delete this draft quote?')) return;
    try {
      await api('/api/dealer/docs/' + id, { method: 'DELETE' });
      await refreshDocs();
      goQuote('', true);
    } catch (err) {
      showQuoteMsg(err.message, false);
    }
  }
  function docSection(kind) {
    return $(kind === 'order' ? 'view-orders' : 'sales-section');
  }
  function renderDocs(kind) {
    const list = docs[kind] || [];
    const openId = docIdFromPath();
    const noun = kind === 'order' ? 'order' : 'quote';
    const host = docSection(kind);
    host.innerHTML =
      '<div class="flex items-center justify-between gap-3">' +
        '<p class="text-sm text-slate-500">Send this ' + noun + ' to Spectrum. The price is your dealer price.</p>' +
        '<a class="px-4 py-2 rounded-full bg-sky-500 text-white text-sm font-semibold" href="/portal/' + (kind === 'order' ? 'orders' : 'quotes') + '/new">New ' + noun + '</a>' +
      '</div>' +
      '<div class="cc-table-card rounded-2xl border"><div class="cc-table-wrap overflow-auto" style="max-height:40vh"><table class="w-full text-sm"><thead><tr>' +
        '<th class="py-3 px-4">Number</th><th class="py-3 px-4">Date</th><th class="py-3 px-4">Status</th><th class="py-3 px-4 text-right">Total</th>' +
      '</tr></thead><tbody>' +
      (list.length ? list.map(function (doc) {
        const href = '/portal/' + (kind === 'order' ? 'orders' : 'quotes') + '/' + doc.id;
        return '<tr class="border-b"><td class="py-3 px-4"><a href="' + href + '">' + esc(doc.number || 'Draft') + '</a></td>' +
          '<td class="py-3 px-4">' + esc(doc.issueDate || '') + '</td>' +
          '<td class="py-3 px-4">' + esc(doc.status) + '</td>' +
          '<td class="py-3 px-4 text-right">' + money(doc.total) + '</td></tr>';
      }).join('') : '<tr><td class="py-6 px-4 text-slate-500" colspan="4">No ' + noun + 's yet.</td></tr>') +
      '</tbody></table></div></div>' +
      '<div id="doc-editor"></div>';
    const editor = host.querySelector('#doc-editor');
    if (location.pathname.indexOf('/new') !== -1) renderEditor(editor, kind, null);
    else if (openId) {
      const found = list.find(function (doc) { return String(doc.id) === String(openId); });
      if (found) renderEditor(editor, kind, found);
    }
  }
  function renderEditor(host, kind, doc) {
    const lines = (doc && doc.lines && doc.lines.length) ? doc.lines : [{ sku: '', qty: 1 }];
    const locked = doc && doc.status && doc.status !== 'draft';
    const skuOptions = '<option value="">SKU</option>' + book.map(function (item) {
      return '<option value="' + esc(item.sku) + '">' + esc(item.sku + ' — ' + item.name) + '</option>';
    }).join('');
    host.innerHTML =
      '<form id="doc-form" class="rounded-2xl border p-5 space-y-4">' +
        '<h2 class="font-semibold">' + (doc ? esc(doc.number || 'Draft') : ('New ' + (kind === 'order' ? 'order' : 'quote'))) + '</h2>' +
        (locked ? '<p class="text-sm text-slate-500">Spectrum already has this. Staff finish it in Company.</p>' : '') +
        '<label class="block text-sm">Your PO number<input name="poNumber" class="w-full mt-1 rounded-lg px-3 py-2" value="' + esc(doc && doc.poNumber || '') + '"' + (locked ? ' disabled' : '') + '></label>' +
        '<label class="block text-sm">Notes<textarea name="notes" rows="3" class="w-full mt-1 rounded-lg px-3 py-2"' + (locked ? ' disabled' : '') + '>' + esc(doc && doc.notes || '') + '</textarea></label>' +
        '<div id="doc-lines" class="space-y-2">' + lines.map(function (line) {
          return '<div class="doc-line flex gap-2">' +
            '<select class="rounded-lg px-2 py-2 text-sm flex-1" data-sku' + (locked ? ' disabled' : '') + '>' + skuOptions.replace('value="' + esc(line.sku) + '"', 'value="' + esc(line.sku) + '" selected') + '</select>' +
            '<input data-qty type="number" min="1" step="1" value="' + esc(line.qty || 1) + '" class="w-24 rounded-lg px-2 py-2 text-sm"' + (locked ? ' disabled' : '') + '>' +
            '<span class="text-sm self-center w-24 text-right">' + money(line.unitPrice) + '</span></div>';
        }).join('') + '</div>' +
        (locked ? '' : '<button type="button" id="add-line" class="text-sm text-sky-600">Add line</button>') +
        '<p id="doc-msg" class="hidden text-sm"></p>' +
        (locked ? '' : '<button type="submit" class="px-4 py-2 rounded-full bg-sky-500 text-white text-sm font-semibold">' + (doc ? 'Save draft' : 'Send to Spectrum') + '</button>') +
      '</form>';
    const add = host.querySelector('#add-line');
    if (add) add.onclick = function () {
      const row = host.querySelector('.doc-line');
      if (row) host.querySelector('#doc-lines').appendChild(row.cloneNode(true));
    };
    const form = host.querySelector('#doc-form');
    if (!form || locked) return;
    form.onsubmit = async function (e) {
      e.preventDefault();
      const msg = host.querySelector('#doc-msg');
      const linesOut = Array.prototype.map.call(host.querySelectorAll('.doc-line'), function (row) {
        return { sku: row.querySelector('[data-sku]').value, qty: Number(row.querySelector('[data-qty]').value) || 1 };
      }).filter(function (line) { return line.sku; });
      const body = JSON.stringify({
        poNumber: form.poNumber.value,
        notes: form.notes.value,
        lines: linesOut
      });
      try {
        const path = doc ? ('/api/dealer/docs/' + doc.id) : ('/api/dealer/' + (kind === 'order' ? 'orders' : 'quotes'));
        const saved = await api(path, { method: doc ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: body });
        const next = saved.doc || saved.quote || saved.order;
        msg.textContent = doc ? 'Draft saved.' : 'Sent. It is a draft in Company.';
        msg.classList.remove('hidden');
        await refreshDocs();
        if (next && next.id) location.href = '/portal/' + (kind === 'order' ? 'orders' : 'quotes') + '/' + next.id;
      } catch (err) {
        msg.textContent = err.message;
        msg.classList.remove('hidden');
      }
    };
  }
  async function refreshDocs() {
    const quotes = await api('/api/dealer/quotes');
    const orders = await api('/api/dealer/orders');
    docs.quote = quotes.quotes || [];
    docs.order = orders.orders || [];
  }
  function projectSize(row) {
    if (!row || (row.width === '' && row.height === '')) return '—';
    const unit = row.unit || 'ft';
    return (row.width === '' || row.width == null ? '?' : row.width) + ' × ' + (row.height === '' || row.height == null ? '?' : row.height) + ' ' + unit;
  }
  function projectWhen(value) {
    if (!value) return '—';
    const date = new Date(value);
    return isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  }
  function renderProjectDetail(row) {
    const overview = $('proj-overview-panel');
    const panel = $('proj-detail');
    if (!row) {
      overview.classList.remove('hidden');
      panel.classList.add('hidden');
      panel.setAttribute('aria-hidden', 'true');
      return;
    }
    overview.classList.add('hidden');
    panel.classList.remove('hidden');
    panel.setAttribute('aria-hidden', 'false');
    $('proj-title').textContent = row.title || 'Design';
    $('proj-sub').textContent = [row.brandName, row.seriesName].filter(Boolean).join(' · ');
    $('proj-brand').textContent = row.brandName || row.brand || '—';
    $('proj-series').textContent = row.seriesName || row.series || '—';
    $('proj-size').textContent = projectSize(row);
    $('proj-pitch').textContent = row.pitch === '' || row.pitch == null ? '—' : (row.pitch + ' mm');
    $('proj-panels').textContent = row.cabinets === '' || row.cabinets == null ? '—' : String(row.cabinets);
    $('proj-saved').textContent = projectWhen(row.savedAt);
    const open = $('proj-open');
    open.href = row.designerUrl || '/led-wall-calculator';
  }
  function renderProjects() {
    const q = String(($('proj-search') && $('proj-search').value) || '').trim().toLowerCase();
    const rows = projects.filter(function (row) {
      if (!q) return true;
      const hay = [row.title, row.brand, row.brandName, row.series, row.seriesName].join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    });
    if (projectId && !rows.some(function (row) { return String(row.id) === String(projectId); })) projectId = '';
    $('proj-stat').textContent = String(projects.length);
    $('proj-hint').textContent = projects.length ? 'Saved layouts' : 'None yet';
    applyCols('projects');
    const sorted = colSort('projects', rows, function (row, col) {
      if (col === 'title') return row.title || '';
      if (col === 'brand') return row.brandName || row.brand || '';
      if (col === 'series') return row.seriesName || row.series || '';
      if (col === 'size') return projectSize(row);
      if (col === 'pitch') return row.pitch === '' || row.pitch == null ? '' : Number(row.pitch) || row.pitch;
      if (col === 'panels') return row.cabinets === '' || row.cabinets == null ? '' : Number(row.cabinets) || row.cabinets;
      if (col === 'saved') return row.savedAt || '';
      return '';
    });
    $('proj-table').innerHTML = sorted.length ? sorted.map(function (row) {
      const on = String(row.id) === String(projectId);
      return '<tr class="border-b border-slate-800 hover:bg-slate-900/80 cursor-pointer' + (on ? ' is-selected' : '') + '" data-project-id="' + esc(row.id) + '">' +
        colCells('projects', {
          title: '<td class="py-3 px-4 font-medium">' + esc(row.title || 'Design') + '</td>',
          brand: '<td class="py-3 px-4">' + esc(row.brandName || row.brand || '—') + '</td>',
          series: '<td class="py-3 px-4">' + esc(row.seriesName || row.series || '—') + '</td>',
          size: '<td class="py-3 px-4">' + esc(projectSize(row)) + '</td>',
          pitch: '<td class="py-3 px-4">' + esc(row.pitch === '' || row.pitch == null ? '—' : row.pitch) + '</td>',
          panels: '<td class="py-3 px-4">' + esc(row.cabinets === '' || row.cabinets == null ? '—' : row.cabinets) + '</td>',
          saved: '<td class="py-3 px-4">' + esc(projectWhen(row.savedAt)) + '</td>'
        }) + '</tr>';
    }).join('') : '<tr><td class="py-6 px-4 text-slate-500" colspan="' + colSpan('projects') + '">No saved projects yet. Open the calculator and save a design to the website account that uses this email.</td></tr>';
    const selected = projectId ? projects.find(function (row) { return String(row.id) === String(projectId); }) : null;
    renderProjectDetail(selected || null);
  }
  async function loadProjects() {
    const data = await api('/api/dealer/projects');
    projects = data.projects || [];
    renderProjects();
  }
  function panelSize(row) {
    if (!row) return '—';
    const w = row.w === '' || row.w == null ? '?' : row.w;
    const h = row.h === '' || row.h == null ? '?' : row.h;
    return w + ' × ' + h + ' mm';
  }
  function panelBlank(value, suffix) {
    if (value === '' || value == null) return '—';
    return suffix ? (value + suffix) : String(value);
  }
  function renderPanelDetail(row) {
    const overview = $('panel-overview');
    const panel = $('panel-detail');
    if (!row) {
      overview.classList.remove('hidden');
      panel.classList.add('hidden');
      panel.setAttribute('aria-hidden', 'true');
      return;
    }
    overview.classList.add('hidden');
    panel.classList.remove('hidden');
    panel.setAttribute('aria-hidden', 'false');
    $('panel-title').textContent = row.name || 'Custom Panel';
    $('panel-sub').textContent = [row.type, row.pitch === '' || row.pitch == null ? '' : ('P' + row.pitch)].filter(Boolean).join(' · ');
    $('panel-size').textContent = panelSize(row);
    $('panel-pitch').textContent = panelBlank(row.pitch, ' mm');
    $('panel-type').textContent = row.type || '—';
    $('panel-weight').textContent = panelBlank(row.weight, ' lb');
    $('panel-pavg').textContent = panelBlank(row.pavg, ' W');
    $('panel-pmax').textContent = panelBlank(row.pmax, ' W');
    $('panel-saved').textContent = projectWhen(row.savedAt);
    $('panel-open').href = row.designerUrl || '/led-wall-calculator?brand=custom';
  }
  function renderPanels() {
    const q = String(($('panel-search') && $('panel-search').value) || '').trim().toLowerCase();
    const rows = panels.filter(function (row) {
      if (!q) return true;
      const hay = [row.name, row.type, row.pitch].join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    });
    if (panelId && !rows.some(function (row) { return String(row.id) === String(panelId); })) panelId = '';
    $('panel-stat').textContent = String(panels.length);
    $('panel-hint').textContent = panels.length ? 'Saved panels' : 'None yet';
    applyCols('panels');
    const sorted = colSort('panels', rows, function (row, col) {
      if (col === 'name') return row.name || '';
      if (col === 'size') return panelSize(row);
      if (col === 'pitch') return row.pitch === '' || row.pitch == null ? '' : Number(row.pitch) || row.pitch;
      if (col === 'type') return row.type || '';
      if (col === 'weight') return row.weight === '' || row.weight == null ? '' : Number(row.weight) || row.weight;
      if (col === 'saved') return row.savedAt || '';
      return '';
    });
    $('panel-table').innerHTML = sorted.length ? sorted.map(function (row) {
      const on = String(row.id) === String(panelId);
      return '<tr class="border-b border-slate-800 hover:bg-slate-900/80 cursor-pointer' + (on ? ' is-selected' : '') + '" data-panel-id="' + esc(row.id) + '">' +
        colCells('panels', {
          name: '<td class="py-3 px-4 font-medium">' + esc(row.name || 'Custom Panel') + '</td>',
          size: '<td class="py-3 px-4">' + esc(panelSize(row)) + '</td>',
          pitch: '<td class="py-3 px-4">' + esc(row.pitch === '' || row.pitch == null ? '—' : row.pitch) + '</td>',
          type: '<td class="py-3 px-4">' + esc(row.type || '—') + '</td>',
          weight: '<td class="py-3 px-4">' + esc(row.weight === '' || row.weight == null ? '—' : row.weight) + '</td>',
          saved: '<td class="py-3 px-4">' + esc(projectWhen(row.savedAt)) + '</td>'
        }) + '</tr>';
    }).join('') : '<tr><td class="py-6 px-4 text-slate-500" colspan="' + colSpan('panels') + '">No custom panels yet. Open the calculator, choose Custom, and save the panel to the website account that uses this email.</td></tr>';
    const selected = panelId ? panels.find(function (row) { return String(row.id) === String(panelId); }) : null;
    renderPanelDetail(selected || null);
  }
  async function loadPanels() {
    const data = await api('/api/dealer/panels');
    panels = data.panels || [];
    renderPanels();
  }
  function fillCompany(customer) {
    const c = customer || {};
    function text(id, value) {
      const el = $(id);
      if (!el) return;
      const shown = String(value || '').trim();
      el.textContent = shown || '—';
    }
    text('co-display', c.displayName);
    text('co-first', c.contactFirst);
    text('co-last', c.contactLast);
    text('co-phone', c.phone);
    text('co-web', c.website);
    text('co-tax', c.taxId);
    text('co-street', [c.billStreet, c.billStreet2].filter(Boolean).join(', '));
    text('co-city', c.billCity);
    text('co-state', c.billState);
    text('co-zip', c.billZip);
    text('co-country', c.billCountry);
  }
  function setCoStatus(el, text, kind) {
    if (!el) return;
    const wide = el.classList.contains('portal-co-wide');
    el.hidden = !text;
    el.textContent = text || '';
    el.className = 'portal-co-status' + (wide ? ' portal-co-wide' : '') + (kind ? ' is-' + kind : '');
  }
  function requestLine(request) {
    if (!request) return { text: '', kind: '' };
    if (request.status === 'waiting') return { text: 'Waiting for Spectrum.', kind: 'waiting' };
    if (request.status === 'accepted') return { text: 'Spectrum accepted this.', kind: 'accepted' };
    if (request.status === 'declined') return { text: 'Spectrum declined this.', kind: 'declined' };
    return { text: '', kind: '' };
  }
  function paintAccount(data) {
    const user = data.user || {};
    const name = $('account-name');
    const email = $('account-email');
    if (name) name.textContent = user.name || '—';
    if (email) email.textContent = user.email || '';
    const others = (data.users || []).filter(function (row) {
      return String(row.email || '').toLowerCase() !== String(user.email || '').toLowerCase();
    });
    const list = $('account-others');
    if (list) {
      list.innerHTML = others.length
        ? others.map(function (row) {
          return '<li>' + esc(row.name || '—') + ' · ' + esc(row.email || '') + '</li>';
        }).join('')
        : '<li class="portal-co-help">No other logins.</li>';
    }
    const userCard = (data.requests && data.requests.user) || null;
    const userLine = requestLine(userCard);
    setCoStatus($('user-request-status'), userLine.text, userLine.kind);
    const addBtn = $('user-add-btn');
    const waitingUser = userCard && userCard.status === 'waiting';
    if (addBtn) {
      addBtn.disabled = !!waitingUser;
      addBtn.hidden = !!waitingUser;
    }
    if (waitingUser) {
      const form = $('user-add-form');
      if (form) form.hidden = true;
    }
  }
  function paintCompanyRequest(data) {
    const card = (data.requests && data.requests.company) || null;
    const line = requestLine(card);
    setCoStatus($('co-request-status'), line.text, line.kind);
    const btn = $('co-update-btn');
    const waiting = card && card.status === 'waiting';
    if (btn) {
      btn.disabled = !!waiting;
      btn.hidden = !!waiting;
    }
    if (waiting) {
      const form = $('co-update-form');
      if (form) form.hidden = true;
    }
  }
  function fillCompanyEditor(customer) {
    const c = customer || {};
    $('co-edit-display').value = c.displayName || '';
    $('co-edit-phone').value = c.phone || '';
    $('co-edit-first').value = c.contactFirst || '';
    $('co-edit-last').value = c.contactLast || '';
    $('co-edit-web').value = c.website || '';
    $('co-edit-tax').value = c.taxId || '';
    $('co-edit-street').value = c.billStreet || '';
    $('co-edit-city').value = c.billCity || '';
    $('co-edit-state').value = c.billState || '';
    $('co-edit-zip').value = c.billZip || '';
    $('co-edit-country').value = c.billCountry || 'United States';
  }
  async function loadCompany() {
    const data = await api('/api/dealer/company');
    if (me) {
      me.customer = data.customer || me.customer;
      if (data.logo) me.logo = data.logo;
      me.user = data.user || me.user;
    }
    paintDealerBrand();
    fillCompany(data.customer);
    paintCompanyRequest(data);
    paintAccount(data);
    $('file-list').innerHTML = (data.files || []).map(function (file) {
      const name = file.name || 'File';
      const url = file.url || '';
      let when = '<span>—</span>';
      if (file.createdAt) {
        const date = new Date(file.createdAt);
        if (!isNaN(date.getTime())) {
          when = '<span>' + esc(date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: 'numeric' })) + '</span>' +
            '<span>' + esc(date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })) + '</span>';
        }
      }
      return '<tr>' +
        '<td class="portal-co-file-name" title="' + esc(name) + '">' + esc(name) + '</td>' +
        '<td class="portal-co-file-when">' + when + '</td>' +
        '<td class="portal-co-file-actions">' +
          '<button type="button" class="portal-co-btn" data-file-view data-file-name="' + esc(name) + '" data-file-url="' + esc(url) + '">View</button>' +
          '<a class="portal-co-btn" href="' + esc(url) + '" download>Download</a>' +
        '</td></tr>';
    }).join('') || '<tr><td colspan="3">No files yet.</td></tr>';
  }
  function closeFilePreview() {
    const box = $('file-preview');
    const body = $('file-preview-body');
    if (box) box.hidden = true;
    if (body) body.innerHTML = '';
  }
  function openFilePreview(name, url) {
    const box = $('file-preview');
    const body = $('file-preview-body');
    const title = $('file-preview-title');
    if (!box || !body) return;
    if (title) title.textContent = name || 'File';
    const ext = String(url || '').split('?')[0].split('.').pop().toLowerCase();
    if (ext === 'pdf') {
      body.innerHTML = '<iframe src="' + esc(url) + '" title="' + esc(name || 'File') + '"></iframe>';
    } else {
      body.innerHTML = '<img src="' + esc(url) + '" alt="' + esc(name || 'File') + '">';
    }
    box.hidden = false;
  }

  $('login-form').onsubmit = async function (e) {
    e.preventDefault();
    const err = $('login-error');
    const btn = e.target.querySelector('button[type="submit"]');
    err.classList.add('hidden');
    if (btn) btn.disabled = true;
    try {
      await api('/api/dealer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: $('login-email').value, password: $('login-password').value })
      });
      $('login-panel').classList.add('hidden');
      const logo = $('company-boot-logo');
      if (logo) logo.src = '/assets/spectrum-boot.gif?play=' + Date.now();
      showPortalBoot();
      const started = Date.now();
      const ok = await boot({ holdBoot: true });
      if (!ok) return;
      const wait = 1000 - (Date.now() - started);
      if (wait > 0) await new Promise(function (resolve) { setTimeout(resolve, wait); });
    } catch (error) {
      stillBootLogo();
      showPortalBoot();
      $('login-panel').classList.remove('hidden');
      err.textContent = error.message;
      err.classList.remove('hidden');
      return;
    } finally {
      if (btn) btn.disabled = false;
    }
    try {
      showApp();
    } catch (error) {
      hidePortalBoot();
      $('login-panel').classList.add('hidden');
      $('portal-nav').classList.remove('hidden');
      showPageProblem(pathView(), error);
    }
  };
  $('portal-logout').onclick = async function () {
    await api('/api/dealer/logout', { method: 'POST' });
    me = null;
    showLogin();
  };
  document.getElementById('dash-home').addEventListener('click', function (e) {
    const kpi = e.target.closest('.dash-kpi[data-home]');
    if (!kpi) return;
    selectDashOverview(kpi.getAttribute('data-home'));
  });
  (function bindDashOverviewLoopHold() {
    ['dash-detail', 'dash-home-right', 'dash-home'].forEach(function (id) {
      const el = id === 'dash-home'
        ? document.querySelector('#dash-home .dash-home-kpis')
        : document.getElementById(id);
      if (!el) return;
      el.addEventListener('mouseenter', holdDashOverviewLoop);
      el.addEventListener('mouseleave', releaseDashOverviewLoop);
    });
    document.addEventListener('visibilitychange', function () {
      const dashSec = document.getElementById('dashboard-section');
      if (document.hidden) holdDashOverviewLoop();
      else {
        releaseDashOverviewLoop();
        if (dashSec && !dashSec.classList.contains('hidden')) startDashOverviewLoop();
      }
    });
  })();
  $('so-search').addEventListener('input', renderQuoteTable);
  $('so-new-btn').addEventListener('click', function () { goQuote('new', true); });
  $('so-ribbon-new').addEventListener('click', function () { goQuote('new', true); });
  window.matchMedia('(max-width: 900px)').addEventListener('change', function () {
    const sec = $('sales-section');
    if (sec && !sec.classList.contains('hidden')) renderQuotes();
  });
  $('so-ribbon-find').addEventListener('click', function () {
    if (isMobileDash() && quoteRoute()) goQuote('', true);
    if ($('so-search')) $('so-search').focus();
  });
  $('so-back').addEventListener('click', function () { goQuote('', true); });
  $('so-caption-close').addEventListener('click', function () { goQuote('', true); });
  ['so-ribbon-print', 'so-ribbon-pdf', 'so-print-btn', 'so-pdf-btn'].forEach(function (id) {
    $(id).addEventListener('click', function () { window.print(); });
  });
  $('so-ribbon-delete').addEventListener('click', deleteQuote);
  $('so-delete-btn').addEventListener('click', deleteQuote);
  $('so-revert').addEventListener('click', function () { renderQuotes(); });
  $('so-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const after = (e.submitter && e.submitter.getAttribute('data-so-after')) || 'stay';
    saveQuote(after);
  });
  $('so-discount').addEventListener('input', refreshQuoteTotals);
  $('so-tax-rate').addEventListener('input', refreshQuoteTotals);
  $('sales-section').addEventListener('click', function (e) {
    const side = e.target.closest('[data-so-side]');
    if (side) {
      document.querySelectorAll('#so-doc-side [data-so-side]').forEach(function (btn) {
        btn.classList.toggle('is-on', btn === side);
      });
      const which = side.getAttribute('data-so-side');
      $('so-side-customer').hidden = which !== 'customer';
      $('so-side-tx').hidden = which !== 'tx';
      return;
    }
    const tx = e.target.closest('#so-side-tx-list [data-quote-id]');
    if (tx) {
      goQuote(tx.getAttribute('data-quote-id'), true);
      return;
    }
    const row = e.target.closest('#so-table tr[data-quote-id]');
    if (row) {
      goQuote(row.getAttribute('data-quote-id'), true);
      return;
    }
    if (e.target.closest('#so-add-line')) {
      $('so-lines').insertAdjacentHTML('beforeend', quoteLineRow(blankQuoteLine(), 0));
      refreshQuoteTotals();
      return;
    }
    const insert = e.target.closest('[data-insert-line]');
    if (insert) {
      const line = insert.closest('.so-line');
      if (line) line.insertAdjacentHTML('afterend', quoteLineRow(blankQuoteLine(), 0));
      refreshQuoteTotals();
      return;
    }
    const remove = e.target.closest('[data-remove-line]');
    if (remove) {
      const line = remove.closest('.so-line');
      if (line) line.remove();
      if (!$('so-lines').querySelector('.so-line')) paintQuoteLines([], false);
      else refreshQuoteTotals();
    }
  });
  $('sales-section').addEventListener('input', function (e) {
    const sku = e.target.closest('[data-line="sku"]');
    if (sku) {
      openSkuMenu(sku);
      applyBookSku(sku.closest('.so-line'), sku.value);
      return;
    }
    if (e.target.closest('#so-lines')) refreshQuoteTotals();
  });
  $('sales-section').addEventListener('focusin', function (e) {
    const sku = e.target.closest('[data-line="sku"]');
    if (sku && !sku.readOnly) openSkuMenu(sku);
  });
  const skuMenu = $('so-sku-menu');
  skuMenu.addEventListener('mousedown', function (e) { e.preventDefault(); });
  skuMenu.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-sku]');
    if (!btn || !skuMenu._input) return;
    applyBookSku(skuMenu._input.closest('.so-line'), btn.getAttribute('data-sku'));
    closeSkuMenu();
  });
  $('proj-search').addEventListener('input', renderProjects);
  document.getElementById('projects-section').addEventListener('click', function (e) {
    const row = e.target.closest('#proj-table tr[data-project-id]');
    if (!row) return;
    projectId = row.getAttribute('data-project-id') || '';
    renderProjects();
  });
  (function bindProjectResizer() {
    const bar = $('proj-split-resizer');
    const split = $('proj-split');
    if (!bar || !split) return;
    bar.addEventListener('pointerdown', function (e) {
      if (isMobileDash()) return;
      e.preventDefault();
      const startX = e.clientX;
      const leftPane = $('proj-split-left');
      const left = leftPane ? leftPane.getBoundingClientRect().width : 720;
      document.body.classList.add('inv-split-dragging');
      function move(ev) {
        const next = Math.max(280, Math.min(split.getBoundingClientRect().width - 280, left + (ev.clientX - startX)));
        split.style.setProperty('--inv-left-w', next + 'px');
      }
      function up() {
        document.body.classList.remove('inv-split-dragging');
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        const width = parseInt(split.style.getPropertyValue('--inv-left-w'), 10);
        if (width) savePortalSplit('projects', width);
      }
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  })();
  $('panel-search').addEventListener('input', renderPanels);
  document.getElementById('panels-section').addEventListener('click', function (e) {
    const row = e.target.closest('#panel-table tr[data-panel-id]');
    if (!row) return;
    panelId = row.getAttribute('data-panel-id') || '';
    renderPanels();
  });
  (function bindPanelResizer() {
    const bar = $('panel-split-resizer');
    const split = $('panel-split');
    if (!bar || !split) return;
    bar.addEventListener('pointerdown', function (e) {
      if (isMobileDash()) return;
      e.preventDefault();
      const startX = e.clientX;
      const leftPane = $('panel-split-left');
      const left = leftPane ? leftPane.getBoundingClientRect().width : 720;
      document.body.classList.add('inv-split-dragging');
      function move(ev) {
        const next = Math.max(280, Math.min(split.getBoundingClientRect().width - 280, left + (ev.clientX - startX)));
        split.style.setProperty('--inv-left-w', next + 'px');
      }
      function up() {
        document.body.classList.remove('inv-split-dragging');
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        const width = parseInt(split.style.getPropertyValue('--inv-left-w'), 10);
        if (width) savePortalSplit('panels', width);
      }
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  })();
  $('inv-search').addEventListener('input', renderBook);
  $('inv-category-filter').addEventListener('change', renderBook);
  (function bindPortalCols() {
    document.querySelectorAll('table.dash-cols[data-cols]').forEach(function (table) {
      const name = table.getAttribute('data-cols');
      if (!PORTAL_COLS[name] || table.dataset.colsReady === '1') return;
      table.dataset.colsReady = '1';
      applyCols(name);
      table.querySelectorAll('thead th[data-col]').forEach(function (th) {
        const grip = th.querySelector('.dash-col-grip');
        if (grip) {
          grip.addEventListener('mousedown', function (e) {
            e.preventDefault();
            e.stopPropagation();
            closeColMenu();
            const startX = e.clientX;
            const startW = th.getBoundingClientRect().width;
            grip.classList.add('is-drag');
            document.body.classList.add('dash-col-resizing');
            function move(ev) {
              th.style.width = Math.max(64, Math.round(startW + ev.clientX - startX)) + 'px';
            }
            function up() {
              grip.classList.remove('is-drag');
              document.body.classList.remove('dash-col-resizing');
              document.removeEventListener('mousemove', move);
              document.removeEventListener('mouseup', up);
              const state = colState(name);
              const col = th.getAttribute('data-col');
              if (col) state.widths[col] = th.style.width || Math.round(th.getBoundingClientRect().width) + 'px';
              saveColState(name, state);
            }
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
          });
        }
        th.addEventListener('click', function (e) {
          if (e.target.closest('.dash-col-grip')) return;
          const menu = $('dash-col-menu');
          if (menu && !menu.hidden && menu._name === name && menu._col === th.getAttribute('data-col')) {
            closeColMenu();
            return;
          }
          openColMenu(name, th);
        });
      });
    });
    const menu = $('dash-col-menu');
    const add = $('dash-col-add');
    if (menu) {
      menu.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-col-act]');
        if (!btn || btn.disabled) return;
        const name = menu._name;
        const col = menu._col;
        if (!name || !col) return;
        const act = btn.getAttribute('data-col-act');
        if (act === 'add') {
          openColAdd(name);
          return;
        }
        const state = colState(name);
        const lock = colLock(name);
        if (act === 'asc' || act === 'desc') {
          state.sortCol = col;
          state.sortDir = act;
        } else if (act === 'left' || act === 'right') {
          const i = state.order.indexOf(col);
          const j = act === 'left' ? i - 1 : i + 1;
          if (i <= 0 || j <= 0 || j >= state.order.length) return;
          const next = state.order.slice();
          const swap = next[i];
          next[i] = next[j];
          next[j] = swap;
          state.order = next;
        } else if (act === 'hide') {
          if (col === lock || state.order.length <= 1) return;
          state.order = state.order.filter(function (id) { return id !== col; });
          if (state.hidden.indexOf(col) === -1) state.hidden.push(col);
          if (state.sortCol === col) {
            state.sortCol = '';
            state.sortDir = '';
          }
        }
        saveColState(name, state);
        closeColMenu();
        refreshPortalTable(name);
      });
    }
    if (add) {
      add.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-add-col]');
        if (!btn || btn.disabled || !menu) return;
        const name = menu._name;
        const addId = btn.getAttribute('data-add-col');
        if (!name || !addId) return;
        const state = colState(name);
        const at = menu._col;
        const i = state.order.indexOf(at);
        state.hidden = state.hidden.filter(function (id) { return id !== addId; });
        if (state.order.indexOf(addId) === -1) {
          state.order.splice(i < 0 ? state.order.length : i + 1, 0, addId);
        }
        saveColState(name, state);
        closeColMenu();
        refreshPortalTable(name);
      });
    }
    document.addEventListener('pointerdown', function (e) {
      if (!menu || menu.hidden) return;
      if (menu.contains(e.target)) {
        if (add && !add.hidden && !e.target.closest('[data-col-act="add"]')) closeColAdd();
        return;
      }
      if (add && !add.hidden && add.contains(e.target)) return;
      if (e.target.closest && e.target.closest('table.dash-cols th[data-col]')) return;
      closeColMenu();
    });
  })();
  document.getElementById('inventory-section').addEventListener('click', function (e) {
    const filter = e.target.closest('[data-filter], [data-inv-filter]');
    if (filter && filter.closest('#inventory-section')) {
      setBookFilter(filter.getAttribute('data-filter') || filter.getAttribute('data-inv-filter'));
      renderBook();
      return;
    }
    const tab = e.target.closest('#book-detail-tabs [data-book-tab]');
    if (tab) {
      setBookDetailTab(tab.getAttribute('data-book-tab'));
      return;
    }
    const row = e.target.closest('#inventory-table tr[data-sku]');
    if (!row) return;
    bookSku = row.getAttribute('data-sku') || '';
    renderBook();
  });
  (function bindRegistrationResizer() {
    const split = $('dr-split');
    const bar = split && split.querySelector('.dash-split-resizer');
    if (!bar || !split) return;
    bar.addEventListener('pointerdown', function (e) {
      if (isMobileDash()) return;
      e.preventDefault();
      const startX = e.clientX;
      const leftPane = split.querySelector('.dash-split-left');
      const left = leftPane ? leftPane.getBoundingClientRect().width : 720;
      document.body.classList.add('dash-col-resizing');
      function move(ev) {
        const next = Math.max(360, Math.min(split.getBoundingClientRect().width - 280, left + (ev.clientX - startX)));
        split.style.setProperty('--dash-left-w', next + 'px');
      }
      function up() {
        document.body.classList.remove('dash-col-resizing');
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        const width = parseInt(split.style.getPropertyValue('--dash-left-w'), 10);
        if (width) savePortalSplit('registrations', width);
      }
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  })();
  (function bindLeadResizer() {
    const bar = document.querySelector('#lead-split .dash-split-resizer');
    const split = $('lead-split');
    if (!bar || !split) return;
    bar.addEventListener('pointerdown', function (e) {
      if (isMobileDash()) return;
      e.preventDefault();
      const startX = e.clientX;
      const leftPane = split.querySelector('.dash-split-left');
      const left = leftPane ? leftPane.getBoundingClientRect().width : 640;
      document.body.classList.add('dash-col-resizing');
      function move(ev) {
        const next = Math.max(360, Math.min(split.getBoundingClientRect().width - 280, left + (ev.clientX - startX)));
        split.style.setProperty('--lead-left-w', next + 'px');
      }
      function up() {
        document.body.classList.remove('dash-col-resizing');
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        const width = parseInt(split.style.getPropertyValue('--lead-left-w'), 10);
        if (width) savePortalSplit('leads', width);
      }
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  })();
  (function bindBookResizer() {
    const bar = $('inv-split-resizer');
    const split = $('inv-split');
    if (!bar || !split) return;
    bar.addEventListener('pointerdown', function (e) {
      if (isMobileDash()) return;
      e.preventDefault();
      const startX = e.clientX;
      const leftPane = $('inv-split-left');
      const left = leftPane ? leftPane.getBoundingClientRect().width : 720;
      document.body.classList.add('inv-split-dragging');
      function move(ev) {
        const next = Math.max(280, Math.min(split.getBoundingClientRect().width - 280, left + (ev.clientX - startX)));
        split.style.setProperty('--inv-left-w', next + 'px');
      }
      function up() {
        document.body.classList.remove('inv-split-dragging');
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        const width = parseInt(split.style.getPropertyValue('--inv-left-w'), 10);
        if (width) savePortalSplit('dealer-book', width);
      }
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  })();
  (function bindRmaResizer() {
    const bar = document.querySelector('#rma-split .dash-split-resizer');
    const split = $('rma-split');
    if (!bar || !split) return;
    bar.addEventListener('pointerdown', function (e) {
      if (isMobileDash()) return;
      e.preventDefault();
      const startX = e.clientX;
      const leftPane = split.querySelector('.dash-split-left');
      const left = leftPane ? leftPane.getBoundingClientRect().width : 720;
      document.body.classList.add('inv-split-dragging');
      function move(ev) {
        const next = Math.max(420, Math.min(split.getBoundingClientRect().width - 320, left + (ev.clientX - startX)));
        split.style.setProperty('--rma-left-w', next + 'px');
      }
      function up() {
        document.body.classList.remove('inv-split-dragging');
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        const width = parseInt(split.style.getPropertyValue('--rma-left-w'), 10);
        if (width) savePortalSplit('rmas', width);
      }
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  })();
  $('co-update-btn').onclick = function () {
    if ($('co-update-btn').disabled) return;
    fillCompanyEditor(me && me.customer);
    setCoStatus($('co-update-msg'), '', '');
    $('co-update-form').hidden = false;
  };
  $('co-update-cancel').onclick = function () {
    $('co-update-form').hidden = true;
    setCoStatus($('co-update-msg'), '', '');
  };
  $('co-update-form').onsubmit = async function (e) {
    e.preventDefault();
    const msg = $('co-update-msg');
    try {
      await api('/api/dealer/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'company',
          displayName: $('co-edit-display').value,
          phone: $('co-edit-phone').value,
          contactFirst: $('co-edit-first').value,
          contactLast: $('co-edit-last').value,
          website: $('co-edit-web').value,
          taxId: $('co-edit-tax').value,
          billStreet: $('co-edit-street').value,
          billCity: $('co-edit-city').value,
          billState: $('co-edit-state').value,
          billZip: $('co-edit-zip').value,
          billCountry: $('co-edit-country').value
        })
      });
      $('co-update-form').hidden = true;
      await loadCompany();
    } catch (err) {
      setCoStatus(msg, err.message, 'declined');
    }
  };
  $('user-add-btn').onclick = function () {
    if ($('user-add-btn').disabled) return;
    $('user-add-name').value = '';
    $('user-add-email').value = '';
    setCoStatus($('user-add-msg'), '', '');
    $('user-add-form').hidden = false;
  };
  $('user-add-cancel').onclick = function () {
    $('user-add-form').hidden = true;
    setCoStatus($('user-add-msg'), '', '');
  };
  $('user-add-form').onsubmit = async function (e) {
    e.preventDefault();
    const msg = $('user-add-msg');
    try {
      await api('/api/dealer/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'user',
          name: $('user-add-name').value,
          email: $('user-add-email').value
        })
      });
      $('user-add-form').hidden = true;
      await loadCompany();
    } catch (err) {
      setCoStatus(msg, err.message, 'declined');
    }
  };
  $('file-list').addEventListener('click', function (e) {
    const btn = e.target.closest('[data-file-view]');
    if (!btn) return;
    openFilePreview(btn.getAttribute('data-file-name') || 'File', btn.getAttribute('data-file-url') || '');
  });
  $('file-preview').addEventListener('click', function (e) {
    if (e.target === $('file-preview')) closeFilePreview();
  });
  $('file-preview-close').addEventListener('click', closeFilePreview);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && $('file-preview') && !$('file-preview').hidden) closeFilePreview();
  });
  (function bindFileDrop() {
    const drop = $('file-drop');
    const input = $('file-input');
    const form = $('file-form');
    if (!drop || !input || !form) return;
    ['dragenter', 'dragover'].forEach(function (name) {
      drop.addEventListener(name, function (e) {
        e.preventDefault();
        drop.classList.add('is-over');
      });
    });
    ['dragleave', 'drop'].forEach(function (name) {
      drop.addEventListener(name, function (e) {
        e.preventDefault();
        drop.classList.remove('is-over');
      });
    });
    drop.addEventListener('drop', function (e) {
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      if (!/\.(pdf|png|jpe?g)$/i.test(file.name || '')) {
        setCoStatus($('file-msg'), 'Choose a PDF, JPG, or PNG.', 'declined');
        return;
      }
      const list = new DataTransfer();
      list.items.add(file);
      input.files = list.files;
      if (form.requestSubmit) form.requestSubmit();
      else form.dispatchEvent(new Event('submit', { cancelable: true }));
    });
  })();
  $('file-form').onsubmit = async function (e) {
    e.preventDefault();
    const msg = $('file-msg');
    const input = $('file-input');
    if (!input.files || !input.files[0]) return;
    const body = new FormData();
    body.append('file', input.files[0]);
    try {
      await api('/api/dealer/files', { method: 'POST', body: body });
      input.value = '';
      setCoStatus(msg, 'Uploaded.', 'accepted');
      loadCompany();
    } catch (err) {
      setCoStatus(msg, err.message, 'declined');
    }
  };
  $('password-form').onsubmit = async function (e) {
    e.preventDefault();
    const msg = $('pw-msg');
    try {
      await api('/api/dealer/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current: $('pw-current').value, password: $('pw-next').value })
      });
      $('pw-current').value = '';
      $('pw-next').value = '';
      setCoStatus(msg, 'Password updated.', 'accepted');
    } catch (err) {
      setCoStatus(msg, err.message, 'declined');
    }
  };
  const PORTAL_PIN_MAX = 5;
  const PORTAL_PIN_DEFAULT = ['book', 'calculator', 'registrations', 'quotes', 'orders'];
  const PORTAL_PIN_ALL = ['book', 'calculator', 'registrations', 'quotes', 'orders', 'home', 'walls', 'rmas', 'projects', 'panels', 'settings'];
  const PORTAL_PIN_LABEL = {
    book: 'Book',
    calculator: 'Calculator',
    registrations: 'Deals',
    quotes: 'Quote',
    orders: 'Orders',
    home: 'Dashboard',
    walls: 'Walls',
    rmas: 'RMA',
    projects: 'Projects',
    panels: 'Panels',
    settings: 'Settings'
  };
  const PORTAL_TAB_SUB = {
    calculator: [
      { view: 'calculator', label: 'Calculator' },
      { view: 'projects', label: 'Projects' },
      { view: 'panels', label: 'Saved Panel' }
    ],
    settings: [
      { view: 'company', label: 'Company' },
      { view: 'updates', label: 'What’s new' },
      { view: 'guide', label: 'Dealer guide' }
    ]
  };
  let portalTabEditing = false;
  let portalTabSuppress = false;
  let portalTabHold = null;
  let portalTabDrag = null;

  function portalPinKey() {
    const id = (me && me.user && (me.user.id || me.user.email)) || 'anon';
    return 'portal-tabbar-pins-' + id;
  }
  function readPortalPins() {
    try {
      const raw = JSON.parse(localStorage.getItem(portalPinKey()) || 'null');
      return Array.isArray(raw) ? raw : null;
    } catch (err) { return null; }
  }
  function writePortalPins(list) {
    try { localStorage.setItem(portalPinKey(), JSON.stringify(list)); } catch (err) {}
  }
  function clearPortalPins() {
    try { localStorage.removeItem(portalPinKey()); } catch (err) {}
  }
  function resolvePortalPins() {
    const source = readPortalPins() || PORTAL_PIN_DEFAULT.slice();
    const out = [];
    source.forEach(function (key) {
      if (out.length >= PORTAL_PIN_MAX) return;
      if (PORTAL_PIN_ALL.indexOf(key) === -1 || out.indexOf(key) !== -1) return;
      out.push(key);
    });
    return out;
  }
  function applyPortalTabbar() {
    const bar = $('dash-tabbar');
    if (!bar) return;
    const pins = resolvePortalPins();
    PORTAL_PIN_ALL.forEach(function (key) {
      const el = $('tabbar-' + key);
      if (!el) return;
      el.classList.toggle('hidden', pins.indexOf(key) === -1);
    });
    pins.forEach(function (key) {
      const el = $('tabbar-' + key);
      if (el) bar.appendChild(el);
    });
    bar.hidden = false;
    document.body.classList.add('dash-tabbar-on');
    renderPortalTabAdd();
    syncPortalTabbarActive(pathView());
  }
  function renderPortalTabAdd() {
    const box = $('dash-tabbar-edit-add');
    if (!box) return;
    const pins = resolvePortalPins();
    const full = pins.length >= PORTAL_PIN_MAX;
    const extras = PORTAL_PIN_ALL.filter(function (key) { return pins.indexOf(key) === -1; });
    if (!extras.length) {
      box.innerHTML = '<p class="dash-tabbar-edit-empty">Every page is already on the bar.</p>';
      return;
    }
    box.innerHTML = extras.map(function (key) {
      return '<button type="button" class="dash-tabbar-add" data-tabbar-add="' + key + '"' + (full ? ' disabled' : '') + '>' + PORTAL_PIN_LABEL[key] + '</button>';
    }).join('');
  }
  function removePortalPin(key) {
    writePortalPins(resolvePortalPins().filter(function (k) { return k !== key; }));
    applyPortalTabbar();
  }
  function addPortalPin(key) {
    const pins = resolvePortalPins();
    if (pins.length >= PORTAL_PIN_MAX || pins.indexOf(key) !== -1) return;
    pins.push(key);
    writePortalPins(pins);
    applyPortalTabbar();
  }
  function closePortalTabSub() {
    document.body.classList.remove('dash-tabbar-sub-open');
    document.body.removeAttribute('data-tabbar-sub-group');
    const sub = $('dash-tabbar-sub');
    const scrim = $('dash-tabbar-sub-scrim');
    if (sub) sub.hidden = true;
    if (scrim) scrim.hidden = true;
    document.querySelectorAll('#dash-tabbar [data-tabbar-group]').forEach(function (el) {
      el.classList.remove('is-expanded');
    });
  }
  function showPortalTabSub(group) {
    const items = PORTAL_TAB_SUB[group] || [];
    const inner = $('dash-tabbar-sub-inner');
    if (!inner || !items.length) return;
    inner.innerHTML = items.map(function (item) {
      const icon = (tabIcon[item.view] || '').replace('dash-master-tab-icon', '');
      return '<a href="' + pathFor(item.view) + '" data-view="' + item.view + '">' + icon + '<span>' + item.label + '</span></a>';
    }).join('');
    document.body.classList.add('dash-tabbar-sub-open');
    document.body.setAttribute('data-tabbar-sub-group', group);
    $('dash-tabbar-sub').hidden = false;
    $('dash-tabbar-sub-scrim').hidden = false;
    document.body.classList.remove('dash-tabbar-hidden');
    document.querySelectorAll('#dash-tabbar [data-tabbar-group]').forEach(function (el) {
      el.classList.toggle('is-expanded', el.getAttribute('data-tabbar-group') === group);
    });
    syncPortalTabbarActive(pathView());
  }
  function syncPortalTabbarActive(name) {
    const onCalc = name === 'calculator' || name === 'projects' || name === 'panels';
    const onSettings = name === 'company' || name === 'updates' || name === 'guide';
    PORTAL_PIN_ALL.forEach(function (key) {
      const el = $('tabbar-' + key);
      if (!el) return;
      const on = key === 'calculator' ? onCalc : key === 'settings' ? onSettings : key === name;
      el.classList.toggle('is-active', on && !el.classList.contains('hidden'));
    });
    const inner = $('dash-tabbar-sub-inner');
    if (inner) {
      inner.querySelectorAll('a[data-view]').forEach(function (a) {
        a.classList.toggle('is-active', a.getAttribute('data-view') === name);
      });
    }
  }
  function setPortalTabEditing(on) {
    portalTabEditing = !!on;
    document.body.classList.toggle('dash-tabbar-editing', portalTabEditing);
    const sheet = $('dash-tabbar-edit');
    if (sheet) sheet.hidden = !portalTabEditing;
    if (portalTabEditing) {
      document.body.classList.remove('dash-tabbar-hidden');
      closePortalTabSub();
      renderPortalTabAdd();
    }
  }
  function bindPortalTabbar() {
    const bar = $('dash-tabbar');
    if (!bar || bar.getAttribute('data-ready') === '1') return;
    bar.setAttribute('data-ready', '1');
    bar.querySelectorAll(':scope > a').forEach(function (a) {
      if (a.querySelector('.dash-tabbar-minus')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dash-tabbar-minus';
      btn.setAttribute('aria-label', 'Remove from bar');
      btn.textContent = '−';
      btn.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (!document.body.classList.contains('dash-tabbar-editing')) return;
        const link = btn.closest('a');
        if (link) removePortalPin(link.id.replace(/^tabbar-/, ''));
      });
      a.appendChild(btn);
    });
    bar.addEventListener('contextmenu', function (e) {
      if (portalTabEditing || portalTabHold) e.preventDefault();
    });
    bar.addEventListener('pointerdown', function (e) {
      if (!isMobileDash() || e.button) return;
      if (e.target.closest('.dash-tabbar-minus')) return;
      const a = e.target.closest('#dash-tabbar > a');
      if (!a || a.classList.contains('hidden')) return;
      if (portalTabEditing) {
        portalTabDrag = { pointerId: e.pointerId, key: a.id.replace(/^tabbar-/, ''), startX: e.clientX, moved: false };
        a.classList.add('is-dragging');
        return;
      }
      portalTabHold = {
        pointerId: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        timer: setTimeout(function () {
          portalTabSuppress = true;
          portalTabHold = null;
          setPortalTabEditing(true);
          setTimeout(function () { portalTabSuppress = false; }, 350);
        }, 480)
      };
    });
    document.addEventListener('pointermove', function (e) {
      if (portalTabHold && e.pointerId === portalTabHold.pointerId) {
        if (Math.abs(e.clientX - portalTabHold.x) > 10 || Math.abs(e.clientY - portalTabHold.y) > 10) {
          clearTimeout(portalTabHold.timer);
          portalTabHold = null;
        }
      }
      if (!portalTabDrag || e.pointerId !== portalTabDrag.pointerId) return;
      if (Math.abs(e.clientX - portalTabDrag.startX) > 8) portalTabDrag.moved = true;
      if (!portalTabDrag.moved) return;
      const links = Array.prototype.slice.call(bar.querySelectorAll(':scope > a:not(.hidden)'));
      let target = null;
      links.forEach(function (el) {
        const r = el.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right) target = el.id.replace(/^tabbar-/, '');
      });
      if (!target || target === portalTabDrag.key) return;
      const pins = resolvePortalPins();
      const from = pins.indexOf(portalTabDrag.key);
      const to = pins.indexOf(target);
      if (from < 0 || to < 0) return;
      pins.splice(from, 1);
      pins.splice(to, 0, portalTabDrag.key);
      writePortalPins(pins);
      applyPortalTabbar();
      const el = $('tabbar-' + portalTabDrag.key);
      if (el) el.classList.add('is-dragging');
    });
    function endDrag(e) {
      if (portalTabHold && (!e || e.pointerId === portalTabHold.pointerId)) {
        clearTimeout(portalTabHold.timer);
        portalTabHold = null;
      }
      if (portalTabDrag && (!e || e.pointerId === portalTabDrag.pointerId)) {
        if (portalTabDrag.moved) portalTabSuppress = true;
        const el = $('tabbar-' + portalTabDrag.key);
        if (el) el.classList.remove('is-dragging');
        portalTabDrag = null;
      }
    }
    document.addEventListener('pointerup', endDrag);
    document.addEventListener('pointercancel', endDrag);
    bar.addEventListener('click', function (e) {
      if (portalTabSuppress && !e.target.closest('.dash-tabbar-minus')) {
        e.preventDefault();
        e.stopPropagation();
        portalTabSuppress = false;
        return;
      }
      if (portalTabEditing) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const a = e.target.closest('#dash-tabbar > a[href]');
      if (!a || a.classList.contains('hidden')) return;
      e.preventDefault();
      e.stopPropagation();
      document.body.classList.remove('dash-open');
      const group = a.getAttribute('data-tabbar-group');
      if (group && isMobileDash()) {
        const rowOpen = document.body.classList.contains('dash-tabbar-sub-open') && document.body.getAttribute('data-tabbar-sub-group') === group;
        if (rowOpen) closePortalTabSub();
        else {
          openPortal(a.getAttribute('data-view') || 'home', true);
          showPortalTabSub(group);
        }
        return;
      }
      if (group) {
        if (document.body.classList.contains('dash-tabbar-sub-open') && document.body.getAttribute('data-tabbar-sub-group') === group) closePortalTabSub();
        else showPortalTabSub(group);
        return;
      }
      closePortalTabSub();
      openPortal(a.getAttribute('data-view') || 'home', true);
    });
    const edit = $('dash-tabbar-edit');
    if (edit) {
      edit.addEventListener('click', function (e) {
        e.stopPropagation();
        if (e.target.closest('#dash-tabbar-done')) { setPortalTabEditing(false); return; }
        if (e.target.closest('#dash-tabbar-reset')) { clearPortalPins(); applyPortalTabbar(); return; }
        const add = e.target.closest('[data-tabbar-add]');
        if (add && !add.disabled) addPortalPin(add.getAttribute('data-tabbar-add'));
      });
    }
    const subInner = $('dash-tabbar-sub-inner');
    if (subInner) {
      subInner.addEventListener('click', function (e) {
        const a = e.target.closest('a[data-view]');
        if (!a) return;
        e.preventDefault();
        e.stopPropagation();
        closePortalTabSub();
        document.body.classList.remove('dash-open');
        openPortal(a.getAttribute('data-view'), true);
      });
    }
    const subScrim = $('dash-tabbar-sub-scrim');
    if (subScrim) subScrim.addEventListener('click', closePortalTabSub);
    document.addEventListener('click', function (e) {
      if (!portalTabEditing) return;
      const path = e.composedPath ? e.composedPath() : [];
      const inside = path.some(function (node) {
        return node && node.id && (node.id === 'dash-tabbar' || node.id === 'dash-tabbar-edit');
      });
      if (inside) return;
      setPortalTabEditing(false);
    });
    const main = document.querySelector('.company-main');
    if (main) {
      let lastY = main.scrollTop;
      main.addEventListener('scroll', function () {
        if (!document.body.classList.contains('dash-tabbar-on') || portalTabEditing) return;
        const y = main.scrollTop;
        const delta = y - lastY;
        if (isMobileDash() && document.body.classList.contains('dash-tabbar-sub-open') && Math.abs(delta) > 4) closePortalTabSub();
        if (y <= 48) document.body.classList.remove('dash-tabbar-hidden');
        else if (delta > 8) {
          document.body.classList.add('dash-tabbar-hidden');
          closePortalTabSub();
        } else if (delta < -8) document.body.classList.remove('dash-tabbar-hidden');
        lastY = y;
      }, { passive: true });
    }
    document.addEventListener('pointerdown', function (e) {
      if (!isMobileDash() || !document.body.classList.contains('dash-tabbar-sub-open')) return;
      if (!e.target.closest || !e.target.closest('.company-main')) return;
      closePortalTabSub();
    }, true);
    window.addEventListener('blur', function () {
      if (!isMobileDash() || !document.body.classList.contains('dash-tabbar-sub-open')) return;
      const el = document.activeElement;
      if (el && el.tagName === 'IFRAME') closePortalTabSub();
    });
  }

  $('dash-menu-btn').onclick = function () {
    document.body.classList.toggle('dash-open');
  };
  const scrim = $('dash-scrim');
  if (scrim) scrim.onclick = function () { document.body.classList.remove('dash-open'); };

  async function boot(opts) {
    const holdBoot = !!(opts && opts.holdBoot);
    try {
      me = await api('/api/dealer/me');
      await loadPortalPrefs();
      const priced = await api('/api/dealer/book');
      book = priced.items || [];
      await refreshDocs();
      const saved = await Promise.all([
        api('/api/dealer/projects').catch(function () { return { projects: [] }; }),
        api('/api/dealer/panels').catch(function () { return { panels: [] }; }),
        api('/api/dealer/registrations').catch(function () { return { registrations: [] }; }),
        api('/api/dealer/leads').catch(function () { return { leads: [] }; }),
        api('/api/dealer/walls').catch(function () { return { walls: [] }; })
      ]);
      projects = saved[0].projects || [];
      panels = saved[1].panels || [];
      registrations = saved[2].registrations || [];
      leads = saved[3].leads || [];
      walls = saved[4].walls || [];
      if (!holdBoot) showApp();
      return true;
    } catch (err) {
      showLogin();
      return false;
    }
  }
  function regIdFromPath() {
    const parts = location.pathname.replace(/\/+$/, '').split('/');
    if (parts[2] === 'registrations' && parts[3]) return parts[3];
    return '';
  }
  function drStatusLabel(row) {
    if (!row) return '';
    if (row.status === 'protected') return 'Protected until ' + (row.protectUntil || '');
    if (row.status === 'declined') return 'Declined' + (row.declineReason ? ' — ' + row.declineReason : '');
    if (row.status === 'expired') return 'Expired';
    return 'Waiting for Spectrum';
  }
  function goRegistration(id, push) {
    const path = id ? ('/portal/registrations/' + id) : '/portal/registrations';
    if (openTabs.indexOf('registrations') === -1) openTabs.push('registrations');
    if (push !== false && location.pathname.replace(/\/+$/, '') !== path) {
      history.pushState({ view: 'registrations', id: id || '' }, '', path);
    }
    renderView('registrations');
    renderMasterTabs();
  }
  function setDrMsg(text, ok) {
    const el = $('dr-msg');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'text-sm ' + (ok ? 'text-sky-400' : 'text-red-400');
    el.classList.toggle('hidden', !text);
  }
  function fillRegistrationForm(row) {
    const editing = !row;
    $('dr-id').value = row ? row.id : '';
    $('dr-form-title').textContent = row ? (row.number || 'Registration') : 'Register a deal';
    $('dr-status').textContent = row ? drStatusLabel(row) : 'Submit this named job. It is not protected until Spectrum accepts it.';
    $('dr-end').value = row ? row.endCustomer : '';
    $('dr-job').value = row ? row.jobName : '';
    $('dr-street').value = row ? row.siteStreet : '';
    $('dr-city').value = row ? row.siteCity : '';
    $('dr-state').value = row ? row.siteState : '';
    $('dr-selling').value = row ? row.selling : '';
    $('dr-date').value = row ? row.expectedDate : '';
    $('dr-contact').value = row ? row.contactName : '';
    $('dr-email').value = row ? row.contactEmail : '';
    $('dr-phone').value = row ? row.contactPhone : '';
    $('dr-notes').value = row ? row.notes : '';
    const locked = !!(row && row.status && row.status !== 'submitted');
    ['dr-end', 'dr-job', 'dr-street', 'dr-city', 'dr-state', 'dr-selling', 'dr-date', 'dr-contact', 'dr-email', 'dr-phone', 'dr-notes'].forEach(function (id) {
      const el = $(id);
      if (el) el.readOnly = !editing && !!row;
      if (el && el.type !== 'date') el.readOnly = !!row;
    });
    $('dr-date').readOnly = !!row;
    $('dr-save').classList.toggle('hidden', !!row);
    $('dr-quote').classList.toggle('hidden', !(row && row.status === 'protected'));
    $('dr-form').classList.remove('hidden');
    $('dr-overview').classList.add('hidden');
    setDrMsg('', true);
  }
  function drBucket(row) {
    if (!row) return '';
    if (row.status === 'protected') return 'protected';
    if (row.status === 'declined' || row.status === 'expired') return row.status;
    return 'waiting';
  }
  function setDrFilter(name) {
    drFilter = name === 'waiting' || name === 'protected' ? name : 'all';
    document.querySelectorAll('#dr-overview-kpis .dash-kpi').forEach(function (btn) {
      const on = btn.getAttribute('data-dr-filter') === drFilter;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  function renderRegistrationTable() {
    const openId = regIdFromPath();
    const waiting = registrations.filter(function (row) { return drBucket(row) === 'waiting'; }).length;
    const protectedCount = registrations.filter(function (row) { return drBucket(row) === 'protected'; }).length;
    const allEl = $('dr-stat-all');
    const waitEl = $('dr-stat-waiting');
    const protEl = $('dr-stat-protected');
    if (allEl) allEl.textContent = String(registrations.length);
    if (waitEl) waitEl.textContent = String(waiting);
    if (protEl) protEl.textContent = String(protectedCount);
    applyCols('registrations');
    const visible = drFilter === 'all' ? registrations : registrations.filter(function (row) { return drBucket(row) === drFilter; });
    const sorted = colSort('registrations', visible, function (row, col) {
      if (col === 'number') return row.number || '';
      if (col === 'customer') return row.endCustomer || '';
      if (col === 'job') return row.jobName || '';
      if (col === 'site') return [row.siteCity, row.siteState].filter(Boolean).join(', ');
      if (col === 'status') return drStatusLabel(row);
      return '';
    });
    $('dr-table').innerHTML = sorted.length ? sorted.map(function (row) {
      const on = openId && String(openId) === String(row.id);
      const site = [row.siteCity, row.siteState].filter(Boolean).join(', ');
      return '<tr class="border-b border-slate-800 hover:bg-slate-900/80 cursor-pointer' + (on ? ' is-active' : '') + '" data-dr-id="' + esc(row.id) + '">' +
        colCells('registrations', {
          number: '<td class="py-3 px-4 font-medium">' + esc(row.number || '') + '</td>',
          customer: '<td class="py-3 px-4">' + esc(row.endCustomer || '—') + '</td>',
          job: '<td class="py-3 px-4">' + esc(row.jobName || '—') + '</td>',
          site: '<td class="py-3 px-4">' + esc(site || '—') + '</td>',
          status: '<td class="py-3 px-4">' + esc(drStatusLabel(row)) + '</td>'
        }) + '</tr>';
    }).join('') : '<tr><td class="py-6 px-4 text-slate-500" colspan="' + colSpan('registrations') + '">' +
      (drFilter === 'waiting' ? 'No registrations waiting.' : drFilter === 'protected' ? 'No protected registrations.' : 'No registrations yet.') +
      '</td></tr>';
  }
  async function renderRegistrations() {
    const err = $('dr-error');
    if (err) { err.textContent = ''; err.classList.add('hidden'); }
    try {
      const data = await api('/api/dealer/registrations');
      registrations = data.registrations || [];
    } catch (e) {
      registrations = [];
      if (err) {
        err.textContent = e.message || 'Could not load registrations.';
        err.classList.remove('hidden');
      }
    }
    renderRegistrationTable();
    const route = regIdFromPath();
    if (!route) {
      $('dr-form').classList.add('hidden');
      $('dr-overview').classList.remove('hidden');
      return;
    }
    if (route === 'new') {
      fillRegistrationForm(null);
      return;
    }
    const row = registrations.find(function (item) { return String(item.id) === String(route); });
    if (row) fillRegistrationForm(row);
  }
  function applyPendingRegistration() {
    let id = '';
    try { id = sessionStorage.getItem('portal-quote-registration') || ''; } catch (err) { id = ''; }
    if (!id) return;
    try { sessionStorage.removeItem('portal-quote-registration'); } catch (err) {}
    api('/api/dealer/registrations/' + encodeURIComponent(id)).then(function (data) {
      const row = data.registration;
      if (!row || row.status !== 'protected') return;
      pendingRegistrationId = row.id;
      const note = 'Deal registration ' + row.number +
        '\nEnd customer: ' + row.endCustomer +
        '\nJob: ' + row.jobName +
        '\nSite: ' + [row.siteStreet, row.siteCity, row.siteState].filter(Boolean).join(', ');
      if ($('so-notes') && !$('so-notes').value) $('so-notes').value = note;
    }).catch(function () {});
  }
  const drKpis = $('dr-overview-kpis');
  if (drKpis) {
    drKpis.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-dr-filter]');
      if (!btn) return;
      setDrFilter(btn.getAttribute('data-dr-filter'));
      renderRegistrationTable();
    });
  }
  $('dr-new-btn').addEventListener('click', function () { goRegistration('new', true); });
  $('dr-table').addEventListener('click', function (e) {
    const tr = e.target.closest('[data-dr-id]');
    if (!tr) return;
    goRegistration(tr.getAttribute('data-dr-id'), true);
  });
  $('dr-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    setDrMsg('');
    try {
      const saved = await api('/api/dealer/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endCustomer: $('dr-end').value,
          jobName: $('dr-job').value,
          siteStreet: $('dr-street').value,
          siteCity: $('dr-city').value,
          siteState: $('dr-state').value,
          selling: $('dr-selling').value,
          expectedDate: $('dr-date').value,
          contactName: $('dr-contact').value,
          contactEmail: $('dr-email').value,
          contactPhone: $('dr-phone').value,
          notes: $('dr-notes').value
        })
      });
      const id = saved.registration && saved.registration.id;
      if (id) goRegistration(id, true);
    } catch (err) {
      setDrMsg(err.message || 'Could not submit this job.', false);
    }
  });
  $('dr-quote').addEventListener('click', function () {
    const id = $('dr-id').value;
    if (!id) return;
    try { sessionStorage.setItem('portal-quote-registration', id); } catch (err) {}
    goSales('quotes', 'new', true);
  });

  function rmaIdFromPath() {
    const parts = location.pathname.replace(/\/+$/, '').split('/');
    if (parts[2] === 'rmas' && parts[3]) return parts[3];
    return '';
  }
  function rmaDate(value) {
    return String(value || '').slice(0, 10) || '—';
  }
  function goRma(id, push) {
    const path = id ? ('/portal/rmas/' + id) : '/portal/rmas';
    if (openTabs.indexOf('rmas') === -1) openTabs.push('rmas');
    if (push !== false && location.pathname.replace(/\/+$/, '') !== path) {
      history.pushState({ view: 'rmas', id: id || '' }, '', path);
    }
    renderView('rmas');
    renderMasterTabs();
  }
  function setRmaMsg(text, ok) {
    const el = $('rma-msg');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'text-sm ' + (ok ? 'text-sky-400' : 'text-red-400');
    el.classList.toggle('hidden', !text);
  }
  function rmaLineRow(line, locked) {
    const sku = esc(line && line.sku || '');
    const qty = line && line.qty ? String(line.qty) : '';
    if (locked) {
      return '<div class="text-sm">' + sku + ' · ' + esc(qty) + '</div>';
    }
    return '<div class="rma-line grid grid-cols-[1fr_5rem_auto] gap-2">' +
      '<input class="rma-sku bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="SKU" value="' + sku + '">' +
      '<input class="rma-qty bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" type="number" min="1" step="1" placeholder="Qty" value="' + esc(qty) + '">' +
      '<button type="button" class="rma-line-remove text-sm text-slate-400">Remove</button></div>';
  }
  function paintRmaLines(lines, locked) {
    const box = $('rma-lines');
    const rows = (lines && lines.length) ? lines : (locked ? [] : [{ sku: '', qty: '' }]);
    box.innerHTML = rows.map(function (line) { return rmaLineRow(line, locked); }).join('') || '<p class="text-sm text-slate-500">No items.</p>';
    $('rma-add-line').classList.toggle('hidden', !!locked);
  }
  function readRmaLines() {
    return Array.from(document.querySelectorAll('#rma-lines .rma-line')).map(function (row) {
      return {
        sku: (row.querySelector('.rma-sku') || {}).value || '',
        qty: (row.querySelector('.rma-qty') || {}).value || ''
      };
    });
  }
  let rmaPhotoFile = null;
  let rmaPhotoUrl = '';
  function rmaPictureOk(file) {
    if (!file) return false;
    const type = String(file.type || '').toLowerCase();
    const name = String(file.name || '').toLowerCase();
    return type === 'image/jpeg' || type === 'image/png' || /\.jpe?g$/.test(name) || /\.png$/.test(name);
  }
  function clearRmaPhotoPick() {
    rmaPhotoFile = null;
    if (rmaPhotoUrl) URL.revokeObjectURL(rmaPhotoUrl);
    rmaPhotoUrl = '';
    const input = $('rma-photo-input');
    if (input) input.value = '';
  }
  function paintRmaPhoto(row) {
    const drop = $('rma-photo-drop');
    const img = $('rma-photo-preview');
    const clear = $('rma-photo-clear');
    const locked = !!row;
    clearRmaPhotoPick();
    if (!drop || !img) return;
    if (locked && row.photoUrl) {
      drop.classList.add('hidden');
      if (clear) clear.classList.add('hidden');
      img.src = row.photoUrl;
      img.alt = row.photoName || 'RMA picture';
      img.classList.remove('hidden');
      return;
    }
    img.removeAttribute('src');
    img.classList.add('hidden');
    if (clear) clear.classList.add('hidden');
    drop.classList.toggle('hidden', locked);
    drop.textContent = 'Drop picture';
  }
  function stageRmaPhoto(file) {
    if (!rmaPictureOk(file)) {
      setRmaMsg('Picture must be a JPG or PNG.', false);
      return;
    }
    clearRmaPhotoPick();
    rmaPhotoFile = file;
    rmaPhotoUrl = URL.createObjectURL(file);
    const img = $('rma-photo-preview');
    const drop = $('rma-photo-drop');
    const clear = $('rma-photo-clear');
    if (img) {
      img.src = rmaPhotoUrl;
      img.alt = file.name || 'RMA picture';
      img.classList.remove('hidden');
    }
    if (drop) drop.textContent = file.name || 'Drop picture';
    if (clear) clear.classList.remove('hidden');
    setRmaMsg('', true);
  }
  function fillRmaForm(row) {
    const locked = !!row;
    $('rma-id').value = row ? row.id : '';
    $('rma-form-title').textContent = row ? (row.number || 'RMA') : 'New RMA';
    $('rma-status').textContent = row ? ('Submitted ' + rmaDate(row.createdAt)) : 'Submit this return. Spectrum reviews it.';
    $('rma-order').value = row ? (row.orderRef || '') : '';
    $('rma-reason').value = row && row.reason ? row.reason : 'defective';
    $('rma-notes').value = row ? (row.notes || '') : '';
    $('rma-order').readOnly = locked;
    $('rma-notes').readOnly = locked;
    $('rma-reason').disabled = locked;
    $('rma-save').classList.toggle('hidden', locked);
    paintRmaLines(row ? row.lines : [], locked);
    paintRmaPhoto(row);
    $('rma-form').classList.remove('hidden');
    $('rma-overview').classList.add('hidden');
    setRmaMsg('', true);
  }
  function renderRmaTable() {
    const openId = rmaIdFromPath();
    applyCols('rmas');
    const sorted = colSort('rmas', rmas, function (row, col) {
      if (col === 'number') return row.number || '';
      if (col === 'date') return row.createdAt || '';
      if (col === 'order') return row.orderRef || '';
      if (col === 'reason') return row.reasonLabel || '';
      if (col === 'status') return 'Submitted';
      return '';
    });
    $('rma-table').innerHTML = sorted.length ? sorted.map(function (row) {
      const on = openId && String(openId) === String(row.id);
      return '<tr class="border-b border-slate-800 hover:bg-slate-900/80 cursor-pointer' + (on ? ' is-active' : '') + '" data-rma-id="' + esc(row.id) + '">' +
        colCells('rmas', {
          number: '<td class="py-3 px-4 font-medium">' + esc(row.number || '') + '</td>',
          date: '<td class="py-3 px-4">' + esc(rmaDate(row.createdAt)) + '</td>',
          order: '<td class="py-3 px-4">' + esc(row.orderRef || '—') + '</td>',
          reason: '<td class="py-3 px-4">' + esc(row.reasonLabel || '—') + '</td>',
          status: '<td class="py-3 px-4">Submitted</td>'
        }) + '</tr>';
    }).join('') : '<tr><td class="py-6 px-4 text-slate-500" colspan="' + colSpan('rmas') + '">No RMAs yet.</td></tr>';
  }
  async function renderRmas() {
    const err = $('rma-error');
    if (err) { err.textContent = ''; err.classList.add('hidden'); }
    try {
      const data = await api('/api/dealer/rmas');
      rmas = data.rmas || [];
    } catch (e) {
      rmas = [];
      if (err) {
        err.textContent = e.message || 'Could not load RMAs.';
        err.classList.remove('hidden');
      }
    }
    renderRmaTable();
    const route = rmaIdFromPath();
    if (!route) {
      $('rma-form').classList.add('hidden');
      $('rma-overview').classList.remove('hidden');
      return;
    }
    if (route === 'new') {
      fillRmaForm(null);
      return;
    }
    const row = rmas.find(function (item) { return String(item.id) === String(route); });
    if (row) fillRmaForm(row);
    else {
      $('rma-form').classList.add('hidden');
      $('rma-overview').classList.remove('hidden');
      setRmaMsg('', true);
    }
  }
  $('rma-new-btn').addEventListener('click', function () { goRma('new', true); });
  $('rma-table').addEventListener('click', function (e) {
    const tr = e.target.closest('[data-rma-id]');
    if (!tr) return;
    goRma(tr.getAttribute('data-rma-id'), true);
  });
  $('rma-add-line').addEventListener('click', function () {
    $('rma-lines').insertAdjacentHTML('beforeend', rmaLineRow({ sku: '', qty: '' }, false));
  });
  $('rma-lines').addEventListener('click', function (e) {
    const btn = e.target.closest('.rma-line-remove');
    if (!btn) return;
    const row = btn.closest('.rma-line');
    if (row) row.remove();
    if (!$('rma-lines').querySelector('.rma-line')) paintRmaLines([], false);
  });
  (function bindRmaPhoto() {
    const drop = $('rma-photo-drop');
    const input = $('rma-photo-input');
    if (!drop || !input) return;
    drop.addEventListener('click', function () { input.click(); });
    drop.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        input.click();
      }
    });
    input.addEventListener('change', function () {
      const file = input.files && input.files[0];
      if (file) stageRmaPhoto(file);
    });
    ['dragenter', 'dragover'].forEach(function (name) {
      drop.addEventListener(name, function (e) {
        e.preventDefault();
        drop.classList.add('is-over');
      });
    });
    ['dragleave', 'drop'].forEach(function (name) {
      drop.addEventListener(name, function (e) {
        e.preventDefault();
        drop.classList.remove('is-over');
      });
    });
    drop.addEventListener('drop', function (e) {
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) stageRmaPhoto(file);
    });
    const clear = $('rma-photo-clear');
    if (clear) clear.addEventListener('click', function () { paintRmaPhoto(null); });
  })();
  $('rma-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    setRmaMsg('');
    try {
      const body = new FormData();
      body.append('orderRef', $('rma-order').value);
      body.append('reason', $('rma-reason').value);
      body.append('lines', JSON.stringify(readRmaLines()));
      body.append('notes', $('rma-notes').value);
      if (rmaPhotoFile) body.append('photo', rmaPhotoFile, rmaPhotoFile.name || 'picture.jpg');
      const saved = await api('/api/dealer/rmas', {
        method: 'POST',
        body: body
      });
      const id = saved.rma && saved.rma.id;
      if (id) goRma(id, true);
    } catch (err) {
      setRmaMsg(err.message || 'Could not submit this RMA.', false);
    }
  });

  const LEAD_STAGES = [
    { id: 'new', label: 'New' },
    { id: 'qualified', label: 'Qualified' },
    { id: 'quoted', label: 'Quoted' },
    { id: 'negotiation', label: 'Negotiation' },
    { id: 'won', label: 'Won' },
    { id: 'lost', label: 'Lost' }
  ];
  function pathId(section) {
    const parts = location.pathname.replace(/\/+$/, '').split('/');
    if (parts[2] === section && parts[3]) return parts[3];
    return '';
  }
  function goPortalLead(section, id, push) {
    const path = id ? ('/portal/' + section + '/' + id) : ('/portal/' + section);
    if (openTabs.indexOf(section) === -1) openTabs.push(section);
    if (push !== false && location.pathname.replace(/\/+$/, '') !== path) {
      history.pushState({ view: section, id: id || '' }, '', path);
    }
    renderView(section);
    renderMasterTabs();
  }
  function leadPlace(row) {
    return [row.city, row.state].filter(Boolean).join(', ') || '—';
  }
  function calcSummaryText(row) {
    const sum = row && row.calculatorSummary;
    if (!sum) return '';
    const bits = [];
    if (sum.seriesName || sum.series || sum.brand) bits.push([sum.brand, sum.seriesName || sum.series].filter(Boolean).join(' '));
    if (sum.sizeLabel) bits.push(sum.sizeLabel);
    else if (sum.width && sum.height) bits.push(sum.width + ' × ' + sum.height + (sum.unit ? ' ' + sum.unit : ''));
    if (sum.pitch) bits.push('P' + sum.pitch);
    if (sum.cabinets) bits.push(sum.cabinets + ' panels');
    if (sum.estimate) {
      const amount = Number(sum.estimate) || 0;
      bits.push('$' + amount.toLocaleString(undefined, { maximumFractionDigits: 0 }));
    }
    return bits.join(' · ');
  }
  function leadWallUrl(row) {
    const q = row && row.calculatorQuery ? String(row.calculatorQuery).replace(/^\?/, '') : '';
    if (!q) return '';
    return '/led-wall-calculator?embed=1&viewonly=1&' + q;
  }
  let leadDetailTab = 'details';
  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value || '—';
  }
  function setLeadTab(name) {
    leadDetailTab = name === 'contact' || name === 'calculator' ? name : 'details';
    ['details', 'contact', 'calculator'].forEach(function (tab) {
      const btn = document.querySelector('#plead-detail [data-plead-tab="' + tab + '"]');
      const panel = $('plead-panel-' + tab);
      const on = tab === leadDetailTab;
      if (btn) {
        btn.classList.toggle('is-on', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
      }
      if (panel) {
        panel.classList.toggle('hidden', !on);
        panel.hidden = !on;
      }
    });
  }
  function setBoxMsg(id, text, ok) {
    const el = $(id);
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('hidden', !text);
    el.classList.toggle('text-red-400', text && ok === false);
    el.classList.toggle('text-emerald-400', !!(text && ok !== false));
  }
  function boardLeads() {
    return leads.filter(function (row) {
      return row.status === 'accepted' || row.status === 'sent';
    }).map(function (row) {
      if (row.status === 'sent' && !row.stage) {
        return Object.assign({}, row, { stage: 'new', stageLabel: 'New' });
      }
      return row;
    });
  }
  async function loadPortalLeads() {
    const data = await api('/api/dealer/leads');
    leads = data.leads || [];
  }
  function showBoardLead(row) {
    const box = $('plead-detail');
    const overview = $('plead-overview');
    if (!box) return;
    if (!row) {
      box.classList.add('hidden');
      if (overview) overview.classList.remove('hidden');
      return;
    }
    if (overview) overview.classList.add('hidden');
    box.classList.remove('hidden');
    $('plead-title').textContent = row.project || row.number || 'Lead';
    $('plead-meta').textContent = (row.number || '') + ' · ' + (row.stageLabel || 'New');
    setText('plead-card-name', row.contactName);
    setText('plead-card-email', row.contactEmail);
    setText('plead-card-phone', row.contactPhone);
    setText('plead-card-stage', row.stageLabel || 'New');
    setText('plead-card-interest', row.interest);
    setText('plead-card-project', row.project);
    setText('plead-card-city', leadPlace(row));
    setText('plead-contact-name', row.contactName);
    setText('plead-contact-email', row.contactEmail);
    setText('plead-contact-phone', row.contactPhone);
    setText('plead-contact-city', leadPlace(row));
    const notes = $('plead-notes');
    if (notes) notes.textContent = row.notes || 'No notes yet.';
    const wall = calcSummaryText(row);
    const wallEl = $('plead-calc');
    if (wallEl) wallEl.textContent = wall || 'No wall on this lead yet.';
    const wallBox = $('plead-wall');
    const frame = $('plead-calc-frame');
    const wallUrl = leadWallUrl(row);
    if (wallBox && frame) {
      wallBox.classList.toggle('hidden', !wallUrl);
      if (wallUrl && frame.getAttribute('data-src') !== wallUrl) {
        frame.setAttribute('data-src', wallUrl);
        frame.src = wallUrl;
      }
      if (!wallUrl) {
        frame.removeAttribute('data-src');
        frame.removeAttribute('src');
      }
    }
    const openCalc = $('plead-calc-open');
    if (openCalc) {
      openCalc.classList.toggle('hidden', !(row.calculatorQuery));
      openCalc.onclick = function () {
        const q = String(row.calculatorQuery || '').replace(/^\?/, '');
        ensureCalculator('/led-wall-calculator' + (q ? '?' + q : ''));
        openPortal('calculator', true);
      };
    }
    $('plead-stage').value = row.stage || 'new';
    setLeadTab(leadDetailTab);
    setBoxMsg('plead-msg', '', true);
  }
  function renderLeadTable() {
    const body = $('lead-table');
    if (!body) return;
    const openId = pathId('leads');
    const rows = boardLeads();
    applyCols('leads');
    const sorted = colSort('leads', rows, function (row, col) {
      if (col === 'number') return row.number || '';
      if (col === 'project') return row.project || '';
      if (col === 'contact') return row.contactName || '';
      if (col === 'city') return leadPlace(row);
      if (col === 'status') return row.stageLabel || 'New';
      return '';
    });
    body.innerHTML = sorted.length ? sorted.map(function (row) {
      const on = openId && String(openId) === String(row.id);
      return '<tr class="border-b border-slate-800 hover:bg-slate-900/80 cursor-pointer' + (on ? ' is-active' : '') + '" data-lead-id="' + esc(row.id) + '">' +
        colCells('leads', {
          number: '<td class="py-3 px-4 font-medium">' + esc(row.number || '') + '</td>',
          project: '<td class="py-3 px-4">' + esc(row.project || '—') + '</td>',
          contact: '<td class="py-3 px-4">' + esc(row.contactName || '—') + '</td>',
          city: '<td class="py-3 px-4">' + esc(leadPlace(row)) + '</td>',
          status: '<td class="py-3 px-4">' + esc(row.stageLabel || 'New') + '</td>'
        }) + '</tr>';
    }).join('') : '<tr><td class="py-6 px-4 text-slate-500" colspan="' + colSpan('leads') + '">No leads yet. Spectrum sends these.</td></tr>';
  }
  function renderLeadBoard() {
    const board = $('plead-board');
    if (!board) return;
    const openId = pathId('leads');
    const rows = boardLeads();
    board.innerHTML = LEAD_STAGES.map(function (stage) {
      const cards = rows.filter(function (row) { return (row.stage || 'new') === stage.id; });
      return '<section class="crm-col" data-stage="' + esc(stage.id) + '">' +
        '<header class="crm-col-head"><strong>' + esc(stage.label) + '</strong><span>' + cards.length + '</span></header>' +
        '<div class="crm-col-cards">' +
        (cards.length ? cards.map(function (row) {
          const on = String(row.id) === String(openId);
          return '<button type="button" class="crm-card' + (on ? ' is-on' : '') + '" draggable="true" data-plead-id="' + esc(row.id) + '">' +
            '<strong>' + esc(row.project || row.number || 'Lead') + '</strong>' +
            '<span>' + esc(row.contactName || row.contactEmail || '') + '</span>' +
            '<span>' + esc(leadPlace(row)) + '</span></button>';
        }).join('') : '<p class="crm-col-empty">None</p>') +
        '</div></section>';
    }).join('');
    renderLeadTable();
    const row = rows.find(function (item) { return String(item.id) === String(openId); });
    showBoardLead(row || null);
  }
  async function paintLeadBoard() {
    const err = $('lead-error');
    if (err) { err.textContent = ''; err.classList.add('hidden'); }
    try {
      await loadPortalLeads();
    } catch (e) {
      leads = [];
      if (err) {
        err.textContent = e.message || 'Could not load leads.';
        err.classList.remove('hidden');
      }
    }
    renderLeadBoard();
  }
  async function movePortalLead(id, stage) {
    const row = leads.find(function (item) { return String(item.id) === String(id); });
    if (!row || (row.stage || 'new') === stage) return;
    setBoxMsg('plead-msg', '', true);
    try {
      const saved = await api('/api/dealer/leads/' + encodeURIComponent(id) + '/stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: stage })
      });
      if (saved.lead) {
        leads = leads.map(function (item) { return String(item.id) === String(saved.lead.id) ? saved.lead : item; });
      }
      renderLeadBoard();
    } catch (err) {
      setBoxMsg('plead-msg', err.message || 'Could not move this lead.', false);
      renderLeadBoard();
    }
  }
  if ($('lead-table')) {
    $('lead-table').addEventListener('click', function (e) {
      const tr = e.target.closest('[data-lead-id]');
      if (!tr) return;
      goPortalLead('leads', tr.getAttribute('data-lead-id'), true);
    });
  }
  if ($('plead-board')) {
    $('plead-board').addEventListener('click', function (e) {
      const card = e.target.closest('[data-plead-id]');
      if (!card) return;
      goPortalLead('leads', card.getAttribute('data-plead-id'), true);
    });
    $('plead-board').addEventListener('dragstart', function (e) {
      const card = e.target.closest('[data-plead-id]');
      if (!card) return;
      e.dataTransfer.setData('text/plain', card.getAttribute('data-plead-id'));
      card.classList.add('is-dragging');
    });
    $('plead-board').addEventListener('dragend', function (e) {
      const card = e.target.closest('[data-plead-id]');
      if (card) card.classList.remove('is-dragging');
    });
    $('plead-board').addEventListener('dragover', function (e) {
      if (e.target.closest('.crm-col')) e.preventDefault();
    });
    $('plead-board').addEventListener('drop', function (e) {
      const col = e.target.closest('.crm-col');
      if (!col) return;
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain');
      movePortalLead(id, col.getAttribute('data-stage'));
    });
  }
  if ($('plead-stage')) {
    $('plead-stage').addEventListener('change', function () {
      const id = pathId('leads');
      if (!id) return;
      movePortalLead(id, $('plead-stage').value);
    });
  }
  const pleadTabs = document.querySelector('#plead-detail .cc-detail-tabs');
  if (pleadTabs) {
    pleadTabs.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-plead-tab]');
      if (!btn) return;
      setLeadTab(btn.getAttribute('data-plead-tab'));
    });
  }

  function wallIdFromPath() {
    const parts = location.pathname.replace(/\/+$/, '').split('/');
    if (parts[2] === 'walls' && parts[3]) return parts[3];
    return '';
  }
  function wallSite(row) {
    return [row.siteCity, row.siteState].filter(Boolean).join(', ') || '—';
  }
  function goWall(id, push) {
    const path = id ? ('/portal/walls/' + id) : '/portal/walls';
    if (openTabs.indexOf('walls') === -1) openTabs.push('walls');
    if (push !== false && location.pathname.replace(/\/+$/, '') !== path) {
      history.pushState({ view: 'walls', id: id || '' }, '', path);
    }
    renderView('walls');
    renderMasterTabs();
  }
  function setWallField(id, value) {
    const el = $(id);
    if (el) el.value = value == null ? '' : value;
  }
  function showWallForm(open) {
    $('wall-form').classList.toggle('hidden', !open);
    $('wall-overview').classList.toggle('hidden', open);
  }
  function fillWallForm(row) {
    const creating = !row;
    setWallField('wall-id', creating ? '' : row.id);
    $('wall-title').textContent = creating ? 'New Installed Wall' : (row.wallName || row.number || 'Installed wall');
    const support = row && row.selectedCob && row.supportEnd ? (' · Support end ' + row.supportEnd) : '';
    $('wall-sub').textContent = creating ? 'Enter the wall and the warranty dates.' : ((row.number || '') + (row.orderNumber ? (' · Order ' + row.orderNumber) : '') + support);
    setWallField('wall-name', creating ? '' : (row.wallName || ''));
    setWallField('wall-end', creating ? '' : (row.endCustomer || ''));
    setWallField('wall-installer', creating ? '' : (row.installer || ''));
    setWallField('wall-pitch', creating ? '' : (row.pitch || ''));
    setWallField('wall-ship', creating ? '' : (row.shipDate || ''));
    setWallField('wall-wstart', creating ? '' : (row.warrantyStart || row.shipDate || ''));
    setWallField('wall-wend', creating ? '' : (row.warrantyEnd || ''));
    setWallField('wall-street', creating ? '' : (row.siteStreet || ''));
    setWallField('wall-city', creating ? '' : (row.siteCity || ''));
    setWallField('wall-state', creating ? '' : (row.siteState || ''));
    setWallField('wall-zip', creating ? '' : (row.siteZip || ''));
    const msg = $('wall-msg');
    if (msg) { msg.textContent = ''; msg.classList.add('hidden'); }
    $('wall-serials').innerHTML = !creating && (row.serials || []).length
      ? '<p class="font-semibold mb-2">Serials</p>' + row.serials.map(function (line) {
        return '<div>' + esc(line.kindLabel || line.kind) + ' · ' + esc(line.serial) + '</div>';
      }).join('')
      : '';
    $('wall-spares').innerHTML = !creating && (row.spares || []).length
      ? '<p class="font-semibold mb-2">Spare kit on site</p>' + row.spares.map(function (line) {
        return '<div>' + esc(line.sku) + ' · ' + esc(line.qty) + '</div>';
      }).join('')
      : '';
    showWallForm(true);
  }
  function showWall(row) {
    if (!row) {
      showWallForm(false);
      return;
    }
    fillWallForm(row);
  }
  function wallWarrantySoon(row) {
    if (!row || !row.warrantyEnd) return false;
    const end = new Date(String(row.warrantyEnd) + 'T12:00:00');
    if (Number.isNaN(end.getTime())) return false;
    return (end.getTime() - Date.now()) / 86400000 < 90;
  }
  function renderWallTable() {
    const openId = wallIdFromPath();
    const q = String(($('wall-search') && $('wall-search').value) || '').trim().toLowerCase();
    const list = walls.filter(function (row) {
      if (!q) return true;
      const blob = [row.wallName, row.number, row.endCustomer, row.pitch, wallSite(row), row.siteStreet, row.shipDate, row.warrantyStart, row.warrantyEnd].join(' ').toLowerCase();
      return blob.indexOf(q) !== -1;
    });
    const soon = walls.filter(wallWarrantySoon).length;
    if ($('wall-stat')) $('wall-stat').textContent = String(walls.length);
    if ($('wall-hint')) $('wall-hint').textContent = soon ? (soon + (soon === 1 ? ' warranty ending' : ' warranties ending')) : 'On site';
    applyCols('walls');
    const sorted = colSort('walls', list, function (row, col) {
      if (col === 'wall') return row.wallName || row.number || '';
      if (col === 'number') return row.number || '';
      if (col === 'customer') return row.endCustomer || '';
      if (col === 'site') return wallSite(row);
      if (col === 'pitch') return row.pitch || '';
      if (col === 'ship') return row.shipDate || '';
      if (col === 'wstart') return row.warrantyStart || row.shipDate || '';
      if (col === 'warranty') return row.warrantyEnd || '';
      if (col === 'spares') return Number(row.spareQty) || 0;
      return '';
    });
    $('wall-table').innerHTML = sorted.length ? sorted.map(function (row) {
      const on = openId && String(openId) === String(row.id);
      return '<tr class="border-b border-slate-800 hover:bg-slate-900/80 cursor-pointer' + (on ? ' is-active' : '') + '" data-wall-id="' + esc(row.id) + '">' +
        colCells('walls', {
          wall: '<td class="py-3 px-4 font-medium">' + esc(row.wallName || row.number || 'Installed wall') + '</td>',
          number: '<td class="py-3 px-4">' + esc(row.number || '—') + '</td>',
          customer: '<td class="py-3 px-4">' + esc(row.endCustomer || '—') + '</td>',
          site: '<td class="py-3 px-4">' + esc(wallSite(row)) + '</td>',
          pitch: '<td class="py-3 px-4">' + esc(row.pitch || '—') + '</td>',
          ship: '<td class="py-3 px-4">' + esc(row.shipDate || '—') + '</td>',
          wstart: '<td class="py-3 px-4">' + esc(row.warrantyStart || row.shipDate || '—') + '</td>',
          warranty: '<td class="py-3 px-4">' + esc(row.warrantyEnd || '—') + '</td>',
          spares: '<td class="py-3 px-4">' + esc(row.spareQty || 0) + '</td>'
        }) + '</tr>';
    }).join('') : '<tr><td class="py-6 px-4 text-slate-500" colspan="' + colSpan('walls') + '">' + (q ? 'No walls match that search.' : 'No installed walls yet.') + '</td></tr>';
  }
  async function renderWalls() {
    const err = $('wall-error');
    if (err) { err.textContent = ''; err.classList.add('hidden'); }
    try {
      const data = await api('/api/dealer/walls');
      walls = data.walls || [];
    } catch (e) {
      walls = [];
      if (err) {
        err.textContent = e.message || 'Could not load walls.';
        err.classList.remove('hidden');
      }
    }
    renderWallTable();
    const route = wallIdFromPath();
    if (route === 'new') {
      fillWallForm(null);
      return;
    }
    const row = walls.find(function (item) { return String(item.id) === String(route); });
    showWall(row || null);
  }
  function wallPayload() {
    return {
      wallName: $('wall-name').value,
      endCustomer: $('wall-end').value,
      installer: $('wall-installer').value,
      pitch: $('wall-pitch').value,
      shipDate: $('wall-ship').value,
      warrantyStart: $('wall-wstart').value,
      warrantyEnd: $('wall-wend').value,
      siteStreet: $('wall-street').value,
      siteCity: $('wall-city').value,
      siteState: $('wall-state').value,
      siteZip: $('wall-zip').value
    };
  }
  async function saveWall(event) {
    event.preventDefault();
    const msg = $('wall-msg');
    const id = $('wall-id').value;
    msg.classList.remove('hidden');
    msg.className = 'text-sm mt-2 text-slate-500';
    msg.textContent = 'Saving…';
    try {
      const saved = await api(id ? ('/api/dealer/walls/' + id) : '/api/dealer/walls', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wallPayload())
      });
      const wall = saved.wall;
      if (wall && wall.id) goWall(wall.id, true);
      else renderWalls();
      msg.className = 'text-sm mt-2 text-sky-600';
      msg.textContent = 'Saved.';
    } catch (err) {
      msg.className = 'text-sm mt-2 text-red-400';
      msg.textContent = err.message || 'Could not save this wall.';
    }
  }
  if ($('wall-search')) $('wall-search').addEventListener('input', renderWallTable);
  (function bindWallResizer() {
    const bar = $('wall-split-resizer');
    const split = $('wall-split');
    if (!bar || !split) return;
    bar.addEventListener('pointerdown', function (e) {
      if (isMobileDash()) return;
      e.preventDefault();
      const startX = e.clientX;
      const leftPane = $('wall-split-left');
      const left = leftPane ? leftPane.getBoundingClientRect().width : 720;
      document.body.classList.add('inv-split-dragging');
      function move(ev) {
        const next = Math.max(280, Math.min(split.getBoundingClientRect().width - 280, left + (ev.clientX - startX)));
        split.style.setProperty('--inv-left-w', next + 'px');
      }
      function up() {
        document.body.classList.remove('inv-split-dragging');
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        const width = parseInt(split.style.getPropertyValue('--inv-left-w'), 10);
        if (width) savePortalSplit('walls', width);
      }
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  })();
  $('wall-table').addEventListener('click', function (e) {
    const tr = e.target.closest('[data-wall-id]');
    if (!tr) return;
    goWall(tr.getAttribute('data-wall-id'), true);
  });
  if ($('wall-new-btn')) $('wall-new-btn').addEventListener('click', function () { goWall('new', true); });
  if ($('wall-form')) $('wall-form').addEventListener('submit', saveWall);

  document.addEventListener('click', function (e) {
    if (!e.target.closest('#so-sku-menu') && !e.target.closest('[data-line="sku"]')) closeSkuMenu();
    const close = e.target.closest('[data-dash-tab-close]');
    if (close) {
      e.preventDefault();
      e.stopPropagation();
      closeMasterTab(close.getAttribute('data-dash-tab-close'));
      return;
    }
    const tab = e.target.closest('#dash-tab-strip [data-dash-tab]');
    if (tab) {
      e.preventDefault();
      openPortal(tab.getAttribute('data-dash-tab'), true);
      return;
    }
    const calcLink = e.target.closest('a[href^="/led-wall-calculator"]');
    if (calcLink && me && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.button) {
      e.preventDefault();
      document.body.classList.remove('dash-open');
      ensureCalculator(calcLink.getAttribute('href'));
      openPortal('calculator', true);
      return;
    }
    const link = e.target.closest('a[href^="/portal"]');
    if (!link || !me || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    const path = link.getAttribute('href').split('?')[0].replace(/\/+$/, '');
    const parts = path.split('/');
    if (parts[1] !== 'portal') return;
    if (parts[3]) {
      if (parts[2] === 'quotes' || parts[2] === 'orders') {
        e.preventDefault();
        document.body.classList.remove('dash-open');
        goSales(parts[2], parts[3], true);
      } else if (parts[2] === 'registrations') {
        e.preventDefault();
        document.body.classList.remove('dash-open');
        goRegistration(parts[3], true);
      } else if (parts[2] === 'incoming' || parts[2] === 'leads') {
        e.preventDefault();
        document.body.classList.remove('dash-open');
        goPortalLead('leads', parts[3], true);
      } else if (parts[2] === 'rmas') {
        e.preventDefault();
        document.body.classList.remove('dash-open');
        goRma(parts[3], true);
      } else if (parts[2] === 'walls') {
        e.preventDefault();
        document.body.classList.remove('dash-open');
        goWall(parts[3], true);
      }
      return;
    }
    const name = parts[2] && viewIds[parts[2]] ? parts[2] : 'home';
    e.preventDefault();
    document.body.classList.remove('dash-open');
    openPortal(name, true);
  });
  window.addEventListener('resize', function () {
    if (!me) return;
    renderMasterTabs();
    document.body.classList.toggle('inv-layout-lock', (pathView() === 'book' || pathView() === 'projects' || pathView() === 'panels' || pathView() === 'walls') && !isMobileDash());
    document.body.classList.toggle('calc-lock', pathView() === 'calculator');
    const onQuotes = (pathView() === 'quotes' || pathView() === 'orders') && !isMobileDash();
    const onSplit = (pathView() === 'registrations' || pathView() === 'rmas') && !isMobileDash();
    document.body.classList.toggle('so-split-lock', onQuotes || onSplit);
    document.body.classList.toggle('dash-split-lock', onSplit);
    const sales = $('sales-section');
    if (sales) {
      sales.classList.toggle('so-split-on', onQuotes);
      const open = !!quoteRoute();
      sales.classList.toggle('so-doc-open', !onQuotes && open);
    }
  });
  window.addEventListener('popstate', function () {
    if (!me) return;
    const name = pathView();
    if (name !== 'home' && openTabs.indexOf(name) === -1) openTabs.push(name);
    renderView(name);
    renderMasterTabs();
  });
  bindPortalTabbar();
  boot();
})();
