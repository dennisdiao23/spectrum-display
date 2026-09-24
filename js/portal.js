(function () {
  const $ = function (id) { return document.getElementById(id); };
  const views = ['book', 'quotes', 'orders', 'projects', 'panels', 'company'];
  let me = null;
  let book = [];
  let docs = { quote: [], order: [] };

  function esc(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }
  function money(n) {
    return '$' + (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function pathView() {
    const parts = location.pathname.replace(/\/+$/, '').split('/');
    if (parts[1] !== 'portal') return 'book';
    if (parts[2] === 'quotes') return 'quotes';
    if (parts[2] === 'orders') return 'orders';
    if (views.indexOf(parts[2]) !== -1) return parts[2];
    return 'book';
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
    views.forEach(function (name) { $('view-' + name).classList.add('hidden'); });
    $('portal-title').textContent = 'Dealer Portal';
    $('portal-sub').textContent = 'Sign in';
  }
  function showApp() {
    $('login-panel').classList.add('hidden');
    $('portal-nav').classList.remove('hidden');
    $('portal-logout').classList.remove('hidden');
    $('portal-user').textContent = (me && me.user && (me.user.name || me.user.email)) || '';
    renderView(pathView());
  }
  function renderView(name) {
    views.forEach(function (view) {
      $('view-' + view).classList.toggle('hidden', view !== name);
    });
    document.querySelectorAll('#portal-nav a').forEach(function (link) {
      link.classList.toggle('is-active', link.getAttribute('data-view') === name);
    });
    const titles = { book: 'Dealer book', quotes: 'Quote', orders: 'Order', projects: 'Projects', panels: 'Custom panels', company: 'Company' };
    $('portal-title').textContent = titles[name] || 'Dealer Portal';
    $('portal-sub').textContent = (me && me.customer && me.customer.companyName) || '';
    if (name === 'book') renderBook();
    if (name === 'quotes') renderDocs('quote');
    if (name === 'orders') renderDocs('order');
    if (name === 'projects') loadProjects();
    if (name === 'panels') loadPanels();
    if (name === 'company') loadCompany();
  }
  function renderBook() {
    const q = String(($('book-search') && $('book-search').value) || '').toLowerCase();
    const rows = book.filter(function (item) {
      const hay = (item.sku + ' ' + item.name + ' ' + item.brand).toLowerCase();
      return !q || hay.indexOf(q) !== -1;
    });
    $('book-empty').classList.toggle('hidden', rows.length > 0);
    $('book-table').innerHTML = rows.map(function (item) {
      return '<tr class="border-b cursor-pointer" data-sku="' + esc(item.sku) + '">' +
        '<td class="py-3 px-4">' + esc(item.name) + '</td>' +
        '<td class="py-3 px-4">' + esc(item.sku) + '</td>' +
        '<td class="py-3 px-4">' + esc(item.brand) + '</td>' +
        '<td class="py-3 px-4">' + esc(item.pitchLabel || item.pitch) + '</td>' +
        '<td class="py-3 px-4">' + esc(item.qty) + '</td>' +
        '<td class="py-3 px-4">' + esc(item.warehouse || '') + '</td>' +
        '<td class="py-3 px-4 text-right">' + money(item.dealerNet) + '</td>' +
        '<td class="py-3 px-4 text-right">' + money(item.listPrice) + '</td></tr>';
    }).join('');
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
    const rows = data.projects || [];
    $('projects-empty').classList.toggle('hidden', rows.length > 0);
    $('projects-list').innerHTML = rows.map(function (row) {
      const size = (row.width || '?') + ' × ' + (row.height || '?');
      return '<div class="rounded-2xl border p-4"><div class="font-medium">' + esc(row.title || 'Design') + '</div>' +
        '<div class="text-xs text-slate-500 mt-1">' + esc(size) + (row.pitch ? ' · ' + esc(row.pitch) + ' mm' : '') + '</div></div>';
    }).join('');
  }
  async function loadPanels() {
    const data = await api('/api/dealer/panels');
    const rows = data.panels || [];
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
  $('book-search').addEventListener('input', renderBook);
  $('book-table').addEventListener('click', function (e) {
    const row = e.target.closest('tr[data-sku]');
    if (!row) return;
    const item = book.find(function (entry) { return entry.sku === row.getAttribute('data-sku'); });
    if (!item) return;
    $('book-detail').classList.remove('hidden');
    $('book-detail').innerHTML = '<strong>' + esc(item.name) + '</strong><div class="mt-2">SKU ' + esc(item.sku) +
      ' · On hand ' + esc(item.qty) + ' · Dealer net ' + money(item.dealerNet) + ' · List ' + money(item.listPrice) + '</div>' +
      '<div class="mt-1 text-slate-500">' + esc((item.locations || []).join(' · ') || item.warehouse || '') + '</div>';
  });
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
      if (location.pathname === '/portal' || location.pathname === '/portal/') {
        history.replaceState(null, '', '/portal/book');
      }
      showApp();
    } catch (err) {
      if (err.status === 401) showLogin();
      else showLogin();
    }
  }
  window.addEventListener('popstate', function () { if (me) renderView(pathView()); });
  boot();
})();
