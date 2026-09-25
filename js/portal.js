(function () {
  const $ = function (id) { return document.getElementById(id); };
  const viewIds = {
    home: 'dashboard-section',
    book: 'inventory-section',
    quotes: 'view-quotes',
    orders: 'view-orders',
    projects: 'view-projects',
    panels: 'view-panels',
    company: 'view-company'
  };
  const views = Object.keys(viewIds);
  let me = null;
  let book = [];
  let docs = { quote: [], order: [] };
  let projects = [];
  let panels = [];
  let dashHome = 'book';
  let openTabs = [];
  let bookFilter = 'all';
  let bookSku = '';
  const tabLabel = { home: 'Dashboard', book: 'Dealer book', quotes: 'Quote', orders: 'Order', projects: 'Projects', panels: 'Custom panels', company: 'Company' };
  const tabIcon = {
    home: '<svg class="dash-master-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>',
    book: '<svg class="dash-master-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10 12 4.5 21 10v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10z"/><path d="M9 20.5V12h6v8.5"/></svg>',
    quotes: '<svg class="dash-master-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4h8v4H8z"/><path d="M6 8h12v12H6z"/><path d="M9 12h6M9 16h4"/></svg>',
    orders: '<svg class="dash-master-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16l-1.5 12H5.5L4 7z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/></svg>',
    projects: '<svg class="dash-master-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8h18"/><path d="M8 12h5M8 16h8"/></svg>',
    panels: '<svg class="dash-master-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8.5 12 13 3 8.5 12 4l9 4.5z"/><path d="M3 8.5v7L12 20l9-4.5v-7"/><path d="M12 13v7"/></svg>',
    company: '<svg class="dash-master-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/></svg>'
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
  function showLogin() {
    $('login-panel').classList.remove('hidden');
    $('portal-nav').classList.add('hidden');
    $('portal-logout').classList.add('hidden');
    views.forEach(function (name) { viewEl(name).classList.add('hidden'); });
    $('portal-title').textContent = 'Dealer Portal';
    $('admin-page-sub').textContent = 'Dealer sign in';
    document.body.classList.remove('dash-master-on');
    document.body.classList.remove('inv-layout-lock');
    const bar = $('dash-tab-bar');
    if (bar) bar.hidden = true;
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
  function showApp() {
    $('login-panel').classList.add('hidden');
    $('portal-nav').classList.remove('hidden');
    $('portal-logout').classList.remove('hidden');
    $('portal-user').textContent = (me && me.user && (me.user.name || me.user.email)) || '';
    openPortal(pathView(), false);
  }
  function renderView(name) {
    views.forEach(function (view) {
      viewEl(view).classList.toggle('hidden', view !== name);
    });
    document.querySelectorAll('#portal-nav a').forEach(function (link) {
      link.classList.toggle('is-active', link.getAttribute('data-view') === name);
    });
    $('portal-title').textContent = tabLabel[name] || 'Dealer Portal';
    $('admin-page-sub').textContent = name === 'home' ? 'Overview' : ((me && me.customer && me.customer.companyName) || '');
    document.body.classList.toggle('inv-layout-lock', name === 'book' && !isMobileDash());
    if (name === 'home') renderHome();
    if (name === 'book') renderBook();
    if (name === 'quotes') renderDocs('quote');
    if (name === 'orders') renderDocs('order');
    if (name === 'projects') loadProjects();
    if (name === 'panels') loadPanels();
    if (name === 'company') loadCompany();
  }
  function chip(value, label) {
    return '<div class="dash-detail-chip"><strong>' + esc(value) + '</strong><span>' + esc(label) + '</span></div>';
  }
  function dashRow(title, meta, side) {
    return '<div class="dash-detail-row"><div><strong>' + esc(title) + '</strong><span>' + esc(meta) + '</span></div><em>' + esc(side) + '</em></div>';
  }
  function selectHome(name) {
    if (!viewIds[name] || name === 'home' || name === 'panels' || name === 'company') name = 'book';
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
      const kind = doc.type === 'order' ? 'Sales Order' : 'Sales Quote';
      return dashRow(doc.number || kind, [kind, doc.status].filter(Boolean).join(' · '), money(doc.total));
    }).join('') : '<p class="dash-activity-empty">No quotes or orders yet.</p>';
  }
  function renderHomeDetail() {
    const title = $('dash-detail-title');
    const sub = $('dash-detail-sub');
    const open = $('dash-detail-open');
    const stats = $('dash-detail-stats');
    const list = $('dash-detail-list');
    if (dashHome === 'quotes') {
      title.textContent = 'Quotes';
      sub.textContent = 'Sales quote drafts sent to Spectrum.';
      open.href = '/portal/quotes';
      open.textContent = 'Open Quotes →';
      const drafts = docs.quote.filter(function (doc) { return doc.status === 'draft'; }).length;
      const total = docs.quote.reduce(function (sum, doc) { return sum + (Number(doc.total) || 0); }, 0);
      stats.innerHTML = chip(docs.quote.length, 'Quotes') + chip(drafts, 'Drafts') + chip(money(total), 'Total');
      list.innerHTML = docs.quote.slice(0, 8).map(function (doc) {
        return dashRow(doc.number || 'Quote', doc.status || '', money(doc.total));
      }).join('') || '<p class="dash-activity-empty">No quotes yet.</p>';
      return;
    }
    if (dashHome === 'orders') {
      title.textContent = 'Orders';
      sub.textContent = 'Sales order drafts sent to Spectrum. There is no online checkout.';
      open.href = '/portal/orders';
      open.textContent = 'Open Orders →';
      const drafts = docs.order.filter(function (doc) { return doc.status === 'draft'; }).length;
      const total = docs.order.reduce(function (sum, doc) { return sum + (Number(doc.total) || 0); }, 0);
      stats.innerHTML = chip(docs.order.length, 'Orders') + chip(drafts, 'Drafts') + chip(money(total), 'Total');
      list.innerHTML = docs.order.slice(0, 8).map(function (doc) {
        return dashRow(doc.number || 'Order', doc.status || '', money(doc.total));
      }).join('') || '<p class="dash-activity-empty">No orders yet.</p>';
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
  function docSection(kind) {
    return $(kind === 'order' ? 'view-orders' : 'view-quotes');
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
  async function loadProjects() {
    const data = await api('/api/dealer/projects');
    projects = data.projects || [];
    const rows = projects;
    $('projects-empty').classList.toggle('hidden', rows.length > 0);
    $('projects-list').innerHTML = rows.map(function (row) {
      const size = (row.width || '?') + ' × ' + (row.height || '?');
      return '<div class="rounded-2xl border p-4"><div class="font-medium">' + esc(row.title || 'Design') + '</div>' +
        '<div class="text-xs text-slate-500 mt-1">' + esc(size) + (row.pitch ? ' · ' + esc(row.pitch) + ' mm' : '') + '</div></div>';
    }).join('');
  }
  async function loadPanels() {
    const data = await api('/api/dealer/panels');
    panels = data.panels || [];
    const rows = panels;
    $('panels-empty').classList.toggle('hidden', rows.length > 0);
    $('panels-list').innerHTML = rows.map(function (row) {
      return '<div class="rounded-2xl border p-4"><div class="font-medium">' + esc(row.name || 'Custom Panel') + '</div>' +
        '<div class="text-xs text-slate-500 mt-1">' + esc((row.w || '?') + ' × ' + (row.h || '?') + ' mm') + '</div></div>';
    }).join('');
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
      return '<li><a class="text-sky-600" href="' + esc(file.url) + '" target="_blank" rel="noopener">' + esc(file.name || 'File') + '</a></li>';
    }).join('');
  }

  $('login-form').onsubmit = async function (e) {
    e.preventDefault();
    const err = $('login-error');
    err.classList.add('hidden');
    try {
      await api('/api/dealer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: $('login-email').value, password: $('login-password').value })
      });
      await boot();
    } catch (error) {
      err.textContent = error.message;
      err.classList.remove('hidden');
    }
  };
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
  $('dash-menu-btn').onclick = function () {
    document.body.classList.toggle('dash-open');
  };
  const scrim = $('dash-scrim');
  if (scrim) scrim.onclick = function () { document.body.classList.remove('dash-open'); };

  async function boot() {
    try {
      me = await api('/api/dealer/me');
      const priced = await api('/api/dealer/book');
      book = priced.items || [];
      await refreshDocs();
      const saved = await Promise.all([
        api('/api/dealer/projects').catch(function () { return { projects: [] }; }),
        api('/api/dealer/panels').catch(function () { return { panels: [] }; })
      ]);
      projects = saved[0].projects || [];
      panels = saved[1].panels || [];
      showApp();
    } catch (err) {
      if (err.status === 401) showLogin();
      else showLogin();
    }
  }
  document.addEventListener('click', function (e) {
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
    const link = e.target.closest('a[href^="/portal"]');
    if (!link || !me || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    const path = link.getAttribute('href').split('?')[0].replace(/\/+$/, '');
    const parts = path.split('/');
    if (parts[1] !== 'portal') return;
    if (parts[3]) return;
    const name = parts[2] && viewIds[parts[2]] ? parts[2] : 'home';
    e.preventDefault();
    document.body.classList.remove('dash-open');
    openPortal(name, true);
  });
  window.addEventListener('resize', function () {
    if (!me) return;
    renderMasterTabs();
    document.body.classList.toggle('inv-layout-lock', pathView() === 'book' && !isMobileDash());
  });
  window.addEventListener('popstate', function () {
    if (!me) return;
    const name = pathView();
    if (name !== 'home' && openTabs.indexOf(name) === -1) openTabs.push(name);
    renderView(name);
    renderMasterTabs();
  });
  boot();
})();
