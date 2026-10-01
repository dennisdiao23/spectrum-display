(function () {
  const $ = function (id) { return document.getElementById(id); };
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
  let dashHome = 'book';
  let registrations = [];
  let pendingRegistrationId = '';
  let leads = [];
  let rmas = [];
  let walls = [];
  let openTabs = [];
  let bookFilter = 'all';
  let bookSku = '';
  const tabLabel = { home: 'Dashboard', book: 'Dealer book', quotes: 'Request Quote', orders: 'Purchase Order', walls: 'Installed walls', registrations: 'Deal registration', leads: 'Leads', rmas: 'RMA', projects: 'Projects', panels: 'Saved Panel', calculator: 'Calculator', company: 'Company', updates: 'What’s new', guide: 'Dealer guide' };
  const tabIcon = {
    home: '<svg class="dash-master-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>',
    book: '<svg class="dash-master-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10 12 4.5 21 10v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10z"/><path d="M9 20.5V12h6v8.5"/></svg>',
    quotes: '<svg class="dash-master-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4h8v4H8z"/><path d="M6 8h12v12H6z"/><path d="M9 12h6M9 16h4"/></svg>',
    registrations: '<svg class="dash-master-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    leads: '<svg class="dash-master-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/></svg>',
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
    const file = $('portal-dealer-logo-file');
    const btn = $('portal-dealer-logo-btn');
    const signedIn = !!me;
    if (file) file.disabled = !signedIn;
    if (btn) {
      btn.classList.toggle('is-ready', signedIn);
      btn.title = signedIn ? 'Upload dealer logo' : 'Dealer logo';
    }
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
    document.body.classList.toggle('inv-layout-lock', (name === 'book' || name === 'projects' || name === 'panels') && !isMobileDash());
    const onSales = (name === 'quotes' || name === 'orders') && !isMobileDash();
    document.body.classList.toggle('so-split-lock', onSales || ((name === 'registrations' || name === 'leads' || name === 'rmas' || name === 'walls') && !isMobileDash()));
    document.body.classList.toggle('dash-split-lock', (name === 'registrations' || name === 'leads' || name === 'rmas' || name === 'walls') && !isMobileDash());
    const sales = $('sales-section');
    if (sales) sales.classList.toggle('so-split-on', onSales);
    if (name === 'home') {
      renderHome();
      refreshStartHere();
    }
    if (name === 'book') renderBook();
    if (name === 'quotes' || name === 'orders') renderQuotes();
    if (name === 'registrations') renderRegistrations();
    if (name === 'leads') renderLeads();
    if (name === 'rmas') renderRmas();
    if (name === 'walls') renderWalls();
    if (name === 'projects') loadProjects();
    if (name === 'panels') loadPanels();
    if (name === 'company') loadCompany();
    if ((name === 'updates' || name === 'guide') && window.SpectrumNotes) SpectrumNotes.paint();
    if (window.SpectrumHelp) SpectrumHelp.setPage(name);
  }
  function chip(value, label) {
    return '<div class="dash-detail-chip"><strong>' + esc(value) + '</strong><span>' + esc(label) + '</span></div>';
  }
  function dashRow(title, meta, side) {
    return '<div class="dash-detail-row"><div><strong>' + esc(title) + '</strong><span>' + esc(meta) + '</span></div><em>' + esc(side) + '</em></div>';
  }
  function selectHome(name) {
    if (!viewIds[name] || name === 'home' || name === 'panels' || name === 'company' || name === 'updates' || name === 'guide') name = 'book';
    if (name !== 'book' && name !== 'quotes' && name !== 'orders' && name !== 'projects') name = 'book';
    dashHome = name;
    document.querySelectorAll('#dash-home .dash-kpi').forEach(function (btn) {
      const on = btn.getAttribute('data-home') === name;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    renderHomeDetail();
  }
  function renderHome() {
    const low = book.filter(function (item) { return item.status === 'low'; }).length;
    const out = book.filter(function (item) { return item.status === 'out'; }).length;
    const quoteDrafts = docs.quote.filter(function (doc) { return doc.status === 'draft'; }).length;
    const orderDrafts = docs.order.filter(function (doc) { return doc.status === 'draft'; }).length;
    $('dash-stat-book').textContent = String(book.length);
    $('dash-stat-quotes').textContent = String(docs.quote.length);
    $('dash-stat-orders').textContent = String(docs.order.length);
    $('dash-stat-projects').textContent = String(projects.length);
    $('dash-hint-book').textContent = out ? (out + ' out') : (low ? (low + ' low') : 'Priced SKUs');
    $('dash-hint-quotes').textContent = quoteDrafts ? (quoteDrafts + ' draft') : 'Sales quotes';
    $('dash-hint-orders').textContent = orderDrafts ? (orderDrafts + ' draft') : 'Sales orders';
    $('dash-hint-projects').textContent = panels.length ? (panels.length + ' custom panels') : 'Saved layouts';
    renderHomeDetail();
    const recent = docs.quote.concat(docs.order).slice().sort(function (a, b) {
      return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''));
    }).slice(0, 8);
    $('dash-recent-list').innerHTML = recent.length ? recent.map(function (doc) {
      const kind = doc.type === 'order' ? 'Purchase Order' : 'Request Quote';
      return dashRow(doc.number || kind, [kind, doc.status].filter(Boolean).join(' · '), money(doc.total));
    }).join('') : '<p class="dash-activity-empty">No request quotes or purchase orders yet.</p>';
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
    return startHereSteps().some(function (step) {
      return step.title !== 'Dealer book' && !step.done;
    });
  }
  function refreshStartHere() {
    Promise.all([
      api('/api/dealer/book').catch(function () { return null; }),
      api('/api/dealer/registrations').catch(function () { return { registrations: [] }; }),
      api('/api/dealer/projects').catch(function () { return { projects: [] }; }),
      api('/api/dealer/panels').catch(function () { return { panels: [] }; }),
      refreshDocs().catch(function () {})
    ]).then(function (saved) {
      if (saved[0] && saved[0].items) book = saved[0].items;
      registrations = (saved[1] && saved[1].registrations) || [];
      projects = (saved[2] && saved[2].projects) || [];
      panels = (saved[3] && saved[3].panels) || [];
      if (pathView() === 'home') renderHome();
    }).catch(function () {});
  }
  function renderStartHere(title, sub, open, stats, list) {
    const steps = startHereSteps();
    const doneCount = steps.filter(function (step) { return step.done; }).length;
    title.textContent = 'Start here';
    sub.textContent = doneCount + ' of ' + steps.length + ' done. A step checks itself when it is saved.';
    open.hidden = true;
    stats.hidden = true;
    stats.innerHTML = '';
    list.innerHTML = steps.map(function (step) {
      return '<div class="start-here-row' + (step.done ? ' is-done' : '') + '">' +
        '<span class="start-here-check" aria-hidden="true"></span>' +
        '<div><strong>' + esc(step.title) + '</strong><span>' + esc(step.text) + '</span></div>' +
        '<a href="' + esc(step.href) + '">Open</a>' +
        '</div>';
    }).join('');
  }
  function renderHomeDetail() {
    const title = $('dash-detail-title');
    const sub = $('dash-detail-sub');
    const open = $('dash-detail-open');
    const stats = $('dash-detail-stats');
    const list = $('dash-detail-list');
    const panel = document.querySelector('.dash-home-detail');
    if (startHereOpen()) {
      if (panel) panel.classList.add('is-start-here');
      renderStartHere(title, sub, open, stats, list);
      return;
    }
    if (panel) panel.classList.remove('is-start-here');
    open.hidden = false;
    stats.hidden = false;
    if (dashHome === 'quotes') {
      title.textContent = 'Request Quote';
      sub.textContent = 'Sales quote drafts sent to Spectrum.';
      open.href = '/portal/quotes';
      open.textContent = 'Open Request Quote →';
      const drafts = docs.quote.filter(function (doc) { return doc.status === 'draft'; }).length;
      const total = docs.quote.reduce(function (sum, doc) { return sum + (Number(doc.total) || 0); }, 0);
      stats.innerHTML = chip(docs.quote.length, 'Request Quote') + chip(drafts, 'Drafts') + chip(money(total), 'Total');
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
      const total = docs.order.reduce(function (sum, doc) { return sum + (Number(doc.total) || 0); }, 0);
      stats.innerHTML = chip(docs.order.length, 'Purchase Order') + chip(drafts, 'Drafts') + chip(money(total), 'Total');
      list.innerHTML = docs.order.slice(0, 8).map(function (doc) {
        return dashRow(doc.number || 'Purchase Order', doc.status || '', money(doc.total));
      }).join('') || '<p class="dash-activity-empty">No purchase orders yet.</p>';
      return;
    }
    if (dashHome === 'projects') {
      title.textContent = 'Projects';
      sub.textContent = 'Layouts saved on a My Account that uses this same email.';
      open.href = '/portal/projects';
      open.textContent = 'Open Projects →';
      stats.innerHTML = chip(projects.length, 'Projects') + chip(panels.length, 'Custom panels');
      const rows = projects.slice(0, 6).map(function (row) {
        return dashRow(row.title || 'Design', (row.width || '?') + ' × ' + (row.height || '?'), row.pitch ? (row.pitch + ' mm') : '');
      }).join('');
      const panelRows = panels.slice(0, 4).map(function (row) {
        return dashRow(row.name || 'Custom Panel', (row.w || '?') + ' × ' + (row.h || '?') + ' mm', row.pitch ? ('P' + row.pitch) : '');
      }).join('');
      list.innerHTML = (rows + panelRows) || '<p class="dash-activity-empty">No saved layouts yet.</p>';
      return;
    }
    title.textContent = 'Dealer book';
    sub.textContent = 'Priced SKUs and on-hand. Factory cost is not shown.';
    open.href = '/portal/book';
    open.textContent = 'Open Dealer book →';
    const low = book.filter(function (item) { return item.status === 'low'; }).length;
    const out = book.filter(function (item) { return item.status === 'out'; }).length;
    stats.innerHTML = chip(book.length, 'SKUs') + chip(low, 'Low') + chip(out, 'Out');
    list.innerHTML = book.slice(0, 8).map(function (item) {
      return dashRow(item.sku || item.name || 'Item', [item.name, item.brand].filter(Boolean).join(' · '), item.qty + ' on hand');
    }).join('') || '<p class="dash-activity-empty">No priced SKUs yet.</p>';
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
    const location = ($('inv-location-filter') && $('inv-location-filter').value) || '';
    return book.filter(function (item) {
      if (bookFilter === 'low' && item.status !== 'low') return false;
      if (bookFilter === 'out' && item.status !== 'out') return false;
      if (category && item.category !== category) return false;
      if (location) {
        const names = [item.warehouse].concat((item.locations || []).map(function (loc) { return loc.name; }));
        if (names.indexOf(location) === -1) return false;
      }
      if (!q) return true;
      const hay = [item.sku, item.name, item.brand, item.category, item.description].join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    });
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
    const locs = item.locations || [];
    $('inv-detail-locations-body').innerHTML = locs.map(function (loc) {
      return '<tr><td>' + esc(loc.name) + '</td><td>' + esc(loc.type || '—') + '</td><td>' + esc(loc.qty) + '</td><td>' + (loc.tracked ? 'Yes' : 'No') + '</td></tr>';
    }).join('');
    $('inv-detail-locations-empty').classList.toggle('hidden', locs.length > 0);
  }
  function renderBook() {
    const categories = [];
    const locations = [];
    book.forEach(function (item) {
      if (item.category && categories.indexOf(item.category) === -1) categories.push(item.category);
      const names = [item.warehouse].concat((item.locations || []).map(function (loc) { return loc.name; }));
      names.forEach(function (name) {
        if (name && locations.indexOf(name) === -1) locations.push(name);
      });
    });
    categories.sort();
    locations.sort();
    fillBookSelect('inv-category-filter', categories, ($('inv-category-filter') && $('inv-category-filter').value) || '', 'All categories');
    fillBookSelect('inv-location-filter', locations, ($('inv-location-filter') && $('inv-location-filter').value) || '', 'All locations');
    const low = book.filter(function (item) { return item.status === 'low'; }).length;
    const out = book.filter(function (item) { return item.status === 'out'; }).length;
    $('inv-stat-skus').textContent = String(book.length);
    $('inv-stat-low').textContent = String(low);
    $('inv-stat-out').textContent = String(out);
    setBookFilter(bookFilter);
    const rows = bookRows();
    if (bookSku && !rows.some(function (item) { return item.sku === bookSku; })) bookSku = '';
    $('inventory-table').innerHTML = rows.length ? rows.map(function (item) {
      const photo = item.image
        ? '<img src="' + esc(item.image) + '" alt="" class="dash-col-photo">'
        : '<span class="text-slate-400">—</span>';
      return '<tr class="border-b border-slate-800 cursor-pointer' + (item.sku === bookSku ? ' is-selected' : '') + '" data-sku="' + esc(item.sku) + '">' +
        '<td class="py-3 px-4 font-medium"><span class="cc-acct-cell"><span class="cc-acct-status ' + stockDot(item.status) + '" title="' + esc(stockLabel(item.status)) + '" aria-hidden="true"></span><span class="cc-acct-name">' + esc(item.name || '') + '</span></span></td>' +
        '<td class="py-3 px-4 font-mono text-xs text-sky-300">' + esc(item.sku || '—') + '</td>' +
        '<td class="py-3 px-4 text-slate-400">' + esc(item.category || '—') + '</td>' +
        '<td class="py-3 px-4 text-slate-400">' + esc(item.description || '—') + '</td>' +
        '<td class="py-3 px-4 text-slate-400">' + esc(item.pitchLabel || item.pitch || '—') + '</td>' +
        '<td class="py-3 px-4 text-sky-400">' + esc(item.brand || '—') + '</td>' +
        '<td class="py-3 px-4">' + esc(item.qty) + '</td>' +
        '<td class="py-3 px-4 text-slate-400">' + esc(item.warehouse || '—') + '</td>' +
        '<td class="py-3 px-4 text-slate-400">' + esc(item.bin || '—') + '</td>' +
        '<td class="py-3 px-4">' + bookPrice(item.listPrice) + '</td>' +
        '<td class="py-3 px-4">' + money(item.dealerNet) + '</td>' +
        '<td class="py-3 px-4">' + photo + '</td></tr>';
    }).join('') : '<tr><td class="py-6 px-4 text-slate-500" colspan="12">No priced SKUs yet.</td></tr>';
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
    return '<tr class="border-b so-line">' +
      '<td class="py-2 px-1 so-line-lead"><span class="so-line-num">' + (index + 1) + '</span></td>' +
      '<td class="py-2 px-2"><input data-line="item" value="' + esc(item.item || (inv && inv.name) || '') + '"></td>' +
      '<td class="py-2 px-2"><div class="so-sku-search"><svg class="so-sku-search-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/></svg><input data-line="sku" type="search" autocomplete="off" placeholder="Search SKU, name, brand" value="' + esc(item.sku || '') + '"></div></td>' +
      '<td class="py-2 px-2"><input data-line="description" value="' + esc(item.description || '') + '"></td>' +
      '<td class="py-2 px-2"><input data-line="qty" type="number" min="0" step="1" value="' + esc(qty) + '"></td>' +
      '<td class="py-2 px-2 tabular-nums so-inv-read" data-line="onHand">' + (inv ? esc(inv.qty) : '—') + '</td>' +
      '<td class="py-2 px-2 tabular-nums so-inv-read" data-line="dealer">' + (inv ? money(inv.dealerNet) : '—') + '</td>' +
      '<td class="py-2 px-2"><input data-line="unitPrice" type="number" step="0.01" readonly value="' + esc(price === '' ? '' : price) + '"></td>' +
      '<td class="py-2 px-2 text-right tabular-nums" data-line-amt>' + (has && (Number(qty) || Number(price)) ? money(amount) : '') + '</td>' +
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
    refreshQuoteTotals();
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
      const dealer = row.querySelector('[data-line="dealer"]');
      if (onHand) onHand.textContent = inv ? String(inv.qty) : '—';
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
    $('so-title').textContent = doc && doc.number ? doc.number : (order ? 'New sales order' : 'New sales quote');
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
    $('so-table').innerHTML = rows.length ? rows.map(function (doc) {
      const on = openId && String(openId) === String(doc.id);
      return '<tr class="border-b border-slate-800 hover:bg-slate-900/80 cursor-pointer' + (on ? ' is-active' : '') + '" data-quote-id="' + esc(doc.id) + '">' +
        '<td class="py-3 px-4 font-medium">' + esc(doc.number || 'Draft') + '</td>' +
        '<td class="py-3 px-4">' + esc(doc.customerName || dealerCompanyName() || '—') + '</td>' +
        '<td class="py-3 px-4">' + esc(doc.issueDate || '—') + '</td>' +
        '<td class="py-3 px-4">' + esc(quoteStatusLabel(doc.status)) + '</td>' +
        '<td class="py-3 px-4">' + money(doc.total) + '</td>' +
        '<td class="py-3 px-4">' + esc(doc.poNumber || '—') + '</td>' +
        '<td class="py-3 px-4">' + esc(doc.dueDate || '—') + '</td>' +
        '<td class="py-3 px-4">' + esc(doc.paymentTerms || '—') + '</td>' +
        '<td class="py-3 px-4">' + esc(doc.notes || '—') + '</td></tr>';
    }).join('') : '<tr><td class="py-6 px-4 text-slate-500" colspan="9">No ' + (order ? 'purchase orders' : 'request quotes') + ' yet.</td></tr>';
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
    $('so-new-btn').textContent = order ? 'New sales order' : 'New sales quote';
    $('so-back').textContent = order ? '← Purchase Order' : '← Request Quote';
    $('so-number-label').textContent = order ? 'Sales order no.' : 'Quote no.';
    const note = document.querySelector('#so-detail .so-doc-note');
    if (note) {
      note.textContent = order
        ? 'Save sends a draft sales order to Spectrum. Price is your dealer net. There is no online checkout.'
        : 'Save sends a draft sales quote to Spectrum. Price is your dealer net. Factory cost is not shown.';
    }
    const lead = document.querySelector('#so-overview-panel .inv-overview-lead');
    if (lead) {
      lead.textContent = order
        ? 'Select a purchase order to view it here. New sales order opens a draft for Spectrum. Factory cost is not on this page.'
        : 'Select a request quote to view it here. New sales quote opens a draft for Spectrum. Factory cost is not on this page.';
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
        '<p class="text-sm text-slate-500">Send creates a draft ' + (kind === 'order' ? 'Sales Order' : 'Sales Quote') + ' in Company. There is no online checkout. Factory cost is not shown.</p>' +
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
    $('proj-table').innerHTML = rows.length ? rows.map(function (row) {
      const on = String(row.id) === String(projectId);
      return '<tr class="border-b border-slate-800 hover:bg-slate-900/80 cursor-pointer' + (on ? ' is-selected' : '') + '" data-project-id="' + esc(row.id) + '">' +
        '<td class="py-3 px-4 font-medium">' + esc(row.title || 'Design') + '</td>' +
        '<td class="py-3 px-4">' + esc(row.brandName || row.brand || '—') + '</td>' +
        '<td class="py-3 px-4">' + esc(row.seriesName || row.series || '—') + '</td>' +
        '<td class="py-3 px-4">' + esc(projectSize(row)) + '</td>' +
        '<td class="py-3 px-4">' + esc(row.pitch === '' || row.pitch == null ? '—' : row.pitch) + '</td>' +
        '<td class="py-3 px-4">' + esc(row.cabinets === '' || row.cabinets == null ? '—' : row.cabinets) + '</td>' +
        '<td class="py-3 px-4">' + esc(projectWhen(row.savedAt)) + '</td></tr>';
    }).join('') : '<tr><td class="py-6 px-4 text-slate-500" colspan="7">No saved projects yet. Open the calculator and save a design to the website account that uses this email.</td></tr>';
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
    $('panel-table').innerHTML = rows.length ? rows.map(function (row) {
      const on = String(row.id) === String(panelId);
      return '<tr class="border-b border-slate-800 hover:bg-slate-900/80 cursor-pointer' + (on ? ' is-selected' : '') + '" data-panel-id="' + esc(row.id) + '">' +
        '<td class="py-3 px-4 font-medium">' + esc(row.name || 'Custom Panel') + '</td>' +
        '<td class="py-3 px-4">' + esc(panelSize(row)) + '</td>' +
        '<td class="py-3 px-4">' + esc(row.pitch === '' || row.pitch == null ? '—' : row.pitch) + '</td>' +
        '<td class="py-3 px-4">' + esc(row.type || '—') + '</td>' +
        '<td class="py-3 px-4">' + esc(row.weight === '' || row.weight == null ? '—' : row.weight) + '</td>' +
        '<td class="py-3 px-4">' + esc(projectWhen(row.savedAt)) + '</td></tr>';
    }).join('') : '<tr><td class="py-6 px-4 text-slate-500" colspan="6">No custom panels yet. Open the calculator, choose Custom, and save the panel to the website account that uses this email.</td></tr>';
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
    $('co-name').value = c.companyName || '';
    $('co-display').value = c.displayName || '';
    $('co-first').value = c.contactFirst || '';
    $('co-last').value = c.contactLast || '';
    $('co-phone').value = c.phone || '';
    $('co-web').value = c.website || '';
    $('co-tax').value = c.taxId || '';
    $('co-street').value = c.billStreet || '';
    $('co-city').value = c.billCity || '';
    $('co-state').value = c.billState || '';
    $('co-zip').value = c.billZip || '';
    $('co-country').value = c.billCountry || '';
  }
  async function loadCompany() {
    const data = await api('/api/dealer/company');
    fillCompany(data.customer);
    $('login-email-label').textContent = (data.user && data.user.email) || '';
    $('file-list').innerHTML = (data.files || []).map(function (file) {
      const when = file.createdAt ? new Date(file.createdAt).toLocaleString() : '';
      return '<li class="flex flex-wrap items-center gap-x-3 gap-y-1">' +
        '<span>' + esc(file.name || 'File') + '</span>' +
        (when ? '<span class="text-slate-500">' + esc(when) + '</span>' : '') +
        '<a class="text-sky-600" href="' + esc(file.url) + '" target="_blank" rel="noopener">View</a>' +
        '<a class="text-sky-600" href="' + esc(file.url) + '" download>Download</a></li>';
    }).join('') || '<li class="text-slate-500">No files yet.</li>';
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
      showApp();
    } catch (error) {
      stillBootLogo();
      showPortalBoot();
      $('login-panel').classList.remove('hidden');
      err.textContent = error.message;
      err.classList.remove('hidden');
    } finally {
      if (btn) btn.disabled = false;
    }
  };
  $('portal-dealer-logo-file').addEventListener('change', async function () {
    const input = $('portal-dealer-logo-file');
    const file = input.files && input.files[0];
    if (!file || !me) return;
    const body = new FormData();
    body.append('file', file);
    try {
      const saved = await api('/api/dealer/logo', { method: 'POST', body: body });
      me.logo = (saved.logo && saved.logo.url) || '';
      paintDealerBrand();
    } catch (err) {
      window.alert(err.message || 'Could not save the logo.');
    }
    input.value = '';
  });
  $('portal-logout').onclick = async function () {
    await api('/api/dealer/logout', { method: 'POST' });
    me = null;
    showLogin();
  };
  document.getElementById('dash-home').addEventListener('click', function (e) {
    const kpi = e.target.closest('.dash-kpi');
    if (!kpi) return;
    selectHome(kpi.getAttribute('data-home'));
  });
  $('so-search').addEventListener('input', renderQuoteTable);
  $('so-new-btn').addEventListener('click', function () { goQuote('new', true); });
  $('so-ribbon-new').addEventListener('click', function () { goQuote('new', true); });
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
      }
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  })();
  $('inv-search').addEventListener('input', renderBook);
  $('inv-category-filter').addEventListener('change', renderBook);
  $('inv-location-filter').addEventListener('change', renderBook);
  document.getElementById('inventory-section').addEventListener('click', function (e) {
    const filter = e.target.closest('[data-filter], [data-inv-filter]');
    if (filter && filter.closest('#inventory-section')) {
      setBookFilter(filter.getAttribute('data-filter') || filter.getAttribute('data-inv-filter'));
      renderBook();
      return;
    }
    const row = e.target.closest('#inventory-table tr[data-sku]');
    if (!row) return;
    bookSku = row.getAttribute('data-sku') || '';
    renderBook();
  });
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
      }
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  })();
  $('company-form').onsubmit = async function (e) {
    e.preventDefault();
    const msg = $('company-msg');
    try {
      const saved = await api('/api/dealer/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: $('co-name').value,
          displayName: $('co-display').value,
          contactFirst: $('co-first').value,
          contactLast: $('co-last').value,
          phone: $('co-phone').value,
          website: $('co-web').value,
          taxId: $('co-tax').value,
          billStreet: $('co-street').value,
          billCity: $('co-city').value,
          billState: $('co-state').value,
          billZip: $('co-zip').value,
          billCountry: $('co-country').value
        })
      });
      fillCompany(saved.customer);
      if (me) me.customer = saved.customer;
      paintDealerBrand();
      msg.textContent = 'Saved. Company customer record updated.';
      msg.className = 'sm:col-span-2 text-sm text-sky-600';
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'sm:col-span-2 text-sm text-red-500';
    }
  };
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
      msg.textContent = 'Uploaded.';
      msg.className = 'text-sm text-sky-600';
      loadCompany();
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'text-sm text-red-500';
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
      msg.textContent = 'Password updated.';
      msg.className = 'text-sm text-sky-600';
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'text-sm text-red-500';
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
        if (y <= 48) document.body.classList.remove('dash-tabbar-hidden');
        else if (delta > 8) {
          document.body.classList.add('dash-tabbar-hidden');
          closePortalTabSub();
        } else if (delta < -8) document.body.classList.remove('dash-tabbar-hidden');
        lastY = y;
      }, { passive: true });
    }
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
      const priced = await api('/api/dealer/book');
      book = priced.items || [];
      await refreshDocs();
      const saved = await Promise.all([
        api('/api/dealer/projects').catch(function () { return { projects: [] }; }),
        api('/api/dealer/panels').catch(function () { return { panels: [] }; }),
        api('/api/dealer/registrations').catch(function () { return { registrations: [] }; })
      ]);
      projects = saved[0].projects || [];
      panels = saved[1].panels || [];
      registrations = saved[2].registrations || [];
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
  function renderRegistrationTable() {
    const openId = regIdFromPath();
    $('dr-table').innerHTML = registrations.length ? registrations.map(function (row) {
      const on = openId && String(openId) === String(row.id);
      const site = [row.siteCity, row.siteState].filter(Boolean).join(', ');
      return '<tr class="border-b border-slate-800 hover:bg-slate-900/80 cursor-pointer' + (on ? ' is-active' : '') + '" data-dr-id="' + esc(row.id) + '">' +
        '<td class="py-3 px-4 font-medium">' + esc(row.number || '') + '</td>' +
        '<td class="py-3 px-4">' + esc(row.endCustomer || '—') + '</td>' +
        '<td class="py-3 px-4">' + esc(row.jobName || '—') + '</td>' +
        '<td class="py-3 px-4">' + esc(site || '—') + '</td>' +
        '<td class="py-3 px-4">' + esc(drStatusLabel(row)) + '</td></tr>';
    }).join('') : '<tr><td class="py-6 px-4 text-slate-500" colspan="5">No registrations yet.</td></tr>';
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
    $('rma-form').classList.remove('hidden');
    $('rma-overview').classList.add('hidden');
    setRmaMsg('', true);
  }
  function renderRmaTable() {
    const openId = rmaIdFromPath();
    $('rma-table').innerHTML = rmas.length ? rmas.map(function (row) {
      const on = openId && String(openId) === String(row.id);
      return '<tr class="border-b border-slate-800 hover:bg-slate-900/80 cursor-pointer' + (on ? ' is-active' : '') + '" data-rma-id="' + esc(row.id) + '">' +
        '<td class="py-3 px-4 font-medium">' + esc(row.number || '') + '</td>' +
        '<td class="py-3 px-4">' + esc(rmaDate(row.createdAt)) + '</td>' +
        '<td class="py-3 px-4">' + esc(row.orderRef || '—') + '</td>' +
        '<td class="py-3 px-4">' + esc(row.reasonLabel || '—') + '</td>' +
        '<td class="py-3 px-4">Submitted</td></tr>';
    }).join('') : '<tr><td class="py-6 px-4 text-slate-500" colspan="5">No RMAs yet.</td></tr>';
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
  $('rma-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    setRmaMsg('');
    try {
      const saved = await api('/api/dealer/rmas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderRef: $('rma-order').value,
          reason: $('rma-reason').value,
          lines: readRmaLines(),
          notes: $('rma-notes').value
        })
      });
      const id = saved.rma && saved.rma.id;
      if (id) goRma(id, true);
    } catch (err) {
      setRmaMsg(err.message || 'Could not submit this RMA.', false);
    }
  });

  function leadIdFromPath() {
    const parts = location.pathname.replace(/\/+$/, '').split('/');
    if (parts[2] === 'leads' && parts[3]) return parts[3];
    return '';
  }
  function goLead(id, push) {
    const path = id ? ('/portal/leads/' + id) : '/portal/leads';
    if (openTabs.indexOf('leads') === -1) openTabs.push('leads');
    if (push !== false && location.pathname.replace(/\/+$/, '') !== path) {
      history.pushState({ view: 'leads', id: id || '' }, '', path);
    }
    renderView('leads');
    renderMasterTabs();
  }
  function leadPlace(row) {
    return [row.city, row.state].filter(Boolean).join(', ') || '—';
  }
  function setLeadMsg(text, ok) {
    const el = $('lead-msg');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('hidden', !text);
    el.classList.toggle('text-red-400', text && ok === false);
    el.classList.toggle('text-emerald-400', !!(text && ok !== false));
  }
  function showLead(row) {
    if (!row) {
      $('lead-detail').classList.add('hidden');
      $('lead-overview').classList.remove('hidden');
      return;
    }
    $('lead-overview').classList.add('hidden');
    $('lead-detail').classList.remove('hidden');
    $('lead-title').textContent = row.project || row.number || 'Lead';
    $('lead-status').textContent = (row.number || '') + ' · ' + (row.statusLabel || 'New');
    $('lead-fields').innerHTML =
      '<div><dt class="text-slate-500">Contact</dt><dd>' + esc(row.contactName || '—') + '</dd></div>' +
      '<div><dt class="text-slate-500">Email</dt><dd>' + esc(row.contactEmail || '—') + '</dd></div>' +
      '<div><dt class="text-slate-500">Phone</dt><dd>' + esc(row.contactPhone || '—') + '</dd></div>' +
      '<div><dt class="text-slate-500">City</dt><dd>' + esc(leadPlace(row)) + '</dd></div>' +
      '<div class="sm:col-span-2"><dt class="text-slate-500">What they want</dt><dd>' + esc(row.interest || '—') + '</dd></div>';
    $('lead-notes').textContent = row.notes || '';
    const open = row.status === 'sent';
    $('lead-actions').classList.toggle('hidden', !open);
    $('lead-note').value = '';
    const reply = $('lead-reply');
    if (open) {
      reply.classList.add('hidden');
      reply.textContent = '';
    } else {
      reply.classList.remove('hidden');
      reply.textContent = (row.statusLabel || '') + (row.replyNote ? (' · ' + row.replyNote) : '');
    }
    setLeadMsg('', true);
  }
  function renderLeadTable() {
    const openId = leadIdFromPath();
    $('lead-table').innerHTML = leads.length ? leads.map(function (row) {
      const on = openId && String(openId) === String(row.id);
      return '<tr class="border-b border-slate-800 hover:bg-slate-900/80 cursor-pointer' + (on ? ' is-active' : '') + '" data-lead-id="' + esc(row.id) + '">' +
        '<td class="py-3 px-4 font-medium">' + esc(row.number || '') + '</td>' +
        '<td class="py-3 px-4">' + esc(row.project || '—') + '</td>' +
        '<td class="py-3 px-4">' + esc(row.contactName || '—') + '</td>' +
        '<td class="py-3 px-4">' + esc(leadPlace(row)) + '</td>' +
        '<td class="py-3 px-4">' + esc(row.statusLabel || 'New') + '</td></tr>';
    }).join('') : '<tr><td class="py-6 px-4 text-slate-500" colspan="5">No leads yet. Spectrum sends these.</td></tr>';
  }
  async function renderLeads() {
    const err = $('lead-error');
    if (err) { err.textContent = ''; err.classList.add('hidden'); }
    try {
      const data = await api('/api/dealer/leads');
      leads = data.leads || [];
    } catch (e) {
      leads = [];
      if (err) {
        err.textContent = e.message || 'Could not load leads.';
        err.classList.remove('hidden');
      }
    }
    renderLeadTable();
    const route = leadIdFromPath();
    const row = leads.find(function (item) { return String(item.id) === String(route); });
    showLead(row || null);
  }
  async function answerLead(status) {
    const id = leadIdFromPath();
    if (!id) return;
    setLeadMsg('');
    try {
      const saved = await api('/api/dealer/leads/' + encodeURIComponent(id) + '/' + status, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: $('lead-note').value })
      });
      const lead = saved.lead;
      if (lead) {
        leads = leads.map(function (row) { return String(row.id) === String(lead.id) ? lead : row; });
        showLead(lead);
        renderLeadTable();
      }
    } catch (err) {
      setLeadMsg(err.message || 'Could not save this lead.', false);
    }
  }
  $('lead-table').addEventListener('click', function (e) {
    const tr = e.target.closest('[data-lead-id]');
    if (!tr) return;
    goLead(tr.getAttribute('data-lead-id'), true);
  });
  $('lead-accept').addEventListener('click', function () { answerLead('accept'); });
  $('lead-decline').addEventListener('click', function () { answerLead('decline'); });

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
  function showWall(row) {
    if (!row) {
      $('wall-detail').classList.add('hidden');
      $('wall-overview').classList.remove('hidden');
      return;
    }
    $('wall-overview').classList.add('hidden');
    $('wall-detail').classList.remove('hidden');
    $('wall-title').textContent = row.wallName || row.number || 'Installed wall';
    const support = row.selectedCob && row.supportEnd ? (' · Support end ' + row.supportEnd) : '';
    $('wall-sub').textContent = (row.number || '') + (row.orderNumber ? (' · Order ' + row.orderNumber) : '') + support;
    const site = [row.siteStreet, [row.siteCity, row.siteState].filter(Boolean).join(', '), row.siteZip, row.siteCountry].filter(Boolean).join('\n');
    $('wall-fields').innerHTML =
      '<div><dt class="text-slate-500">End customer</dt><dd>' + esc(row.endCustomer || '—') + '</dd></div>' +
      '<div><dt class="text-slate-500">Installer</dt><dd>' + esc(row.installer || '—') + '</dd></div>' +
      '<div><dt class="text-slate-500">Pitch</dt><dd>' + esc(row.pitch || '—') + '</dd></div>' +
      '<div><dt class="text-slate-500">Ship date</dt><dd>' + esc(row.shipDate || '—') + '</dd></div>' +
      '<div><dt class="text-slate-500">Warranty end</dt><dd>' + esc(row.warrantyEnd || '—') + '</dd></div>' +
      '<div class="sm:col-span-2"><dt class="text-slate-500">Site</dt><dd style="white-space:pre-line">' + esc(site || '—') + '</dd></div>';
    $('wall-serials').innerHTML = (row.serials || []).length
      ? '<p class="font-semibold mb-2">Serials</p>' + row.serials.map(function (line) {
        return '<div>' + esc(line.kindLabel || line.kind) + ' · ' + esc(line.serial) + '</div>';
      }).join('')
      : '<p class="text-slate-500">No serials yet.</p>';
    $('wall-spares').innerHTML = (row.spares || []).length
      ? '<p class="font-semibold mb-2">Spare kit on site</p>' + row.spares.map(function (line) {
        return '<div>' + esc(line.sku) + ' · ' + esc(line.qty) + '</div>';
      }).join('')
      : '<p class="text-slate-500">No spare kit on site.</p>';
  }
  function renderWallTable() {
    const openId = wallIdFromPath();
    $('wall-table').innerHTML = walls.length ? walls.map(function (row) {
      const on = openId && String(openId) === String(row.id);
      return '<tr class="border-b border-slate-800 hover:bg-slate-900/80 cursor-pointer' + (on ? ' is-active' : '') + '" data-wall-id="' + esc(row.id) + '">' +
        '<td class="py-3 px-4 font-medium">' + esc(row.wallName || row.number) + '</td>' +
        '<td class="py-3 px-4">' + esc(row.endCustomer || '—') + '</td>' +
        '<td class="py-3 px-4">' + esc(wallSite(row)) + '</td>' +
        '<td class="py-3 px-4">' + esc(row.pitch || '—') + '</td>' +
        '<td class="py-3 px-4">' + esc(row.shipDate || '—') + '</td>' +
        '<td class="py-3 px-4">' + esc(row.warrantyEnd || '—') + '</td>' +
        '<td class="py-3 px-4">' + esc(row.spareQty || 0) + '</td></tr>';
    }).join('') : '<tr><td class="py-6 px-4 text-slate-500" colspan="7">No installed walls yet.</td></tr>';
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
    const row = walls.find(function (item) { return String(item.id) === String(route); });
    showWall(row || null);
  }
  $('wall-table').addEventListener('click', function (e) {
    const tr = e.target.closest('[data-wall-id]');
    if (!tr) return;
    goWall(tr.getAttribute('data-wall-id'), true);
  });

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
      } else if (parts[2] === 'leads') {
        e.preventDefault();
        document.body.classList.remove('dash-open');
        goLead(parts[3], true);
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
    document.body.classList.toggle('inv-layout-lock', (pathView() === 'book' || pathView() === 'projects' || pathView() === 'panels') && !isMobileDash());
    document.body.classList.toggle('calc-lock', pathView() === 'calculator');
    const onQuotes = (pathView() === 'quotes' || pathView() === 'orders') && !isMobileDash();
    const onSplit = (pathView() === 'registrations' || pathView() === 'leads' || pathView() === 'rmas' || pathView() === 'walls') && !isMobileDash();
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
