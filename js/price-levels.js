(function (global) {
  'use strict';

  var CUSTOMER_TYPES = ['Retail/Commercial', 'Residential', 'AV Integrator', 'Dealer'];
  var PRODUCT_TYPES = ['LED Panel', 'Control', 'Receiving Card', 'Processor', 'Accessory', 'Service', 'Spare'];

  var S = {
    api: null,
    esc: function (s) { return String(s == null ? '' : s); },
    canEdit: function () { return true; },
    go: function () {},
    levels: [],
    customers: [],
    items: [],
    brands: [],
    level: null,
    tab: 'products',
    productQuery: '',
    ready: false
  };

  function $(id) { return document.getElementById(id); }

  function esc(s) { return S.esc(s); }

  function money(n) {
    var v = Number(n);
    if (!isFinite(v)) return '—';
    return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function applyPct(base, dir, pct) {
    var n = Number(base);
    if (!isFinite(n)) return 0;
    var p = Number(pct);
    if (!isFinite(p) || p < 0) p = 0;
    var factor = dir === 'increase' ? (1 + p / 100) : (1 - p / 100);
    return n * factor;
  }

  function applyRound(value, rounding) {
    var n = Number(value);
    if (!isFinite(n) || n < 0) return 0;
    if (rounding === 'dollar') return Math.round(n);
    if (rounding === 'dime') return Math.round(n * 10) / 10;
    return Math.round(n * 100) / 100;
  }

  function basePrice(item, priceType) {
    if (priceType === 'sell') return Number(item && item.price) || 0;
    return Number(item && item.dealerNet) || 0;
  }

  function computedPrice(level, item) {
    var next = applyPct(basePrice(item, level.priceType), level.adjustDir, level.adjustPct);
    (level.brands || []).forEach(function (line) {
      if (String(line.brandId) !== String(item.brandId || '')) return;
      next = applyPct(next, line.adjustDir, line.adjustPct);
    });
    return applyRound(next, level.rounding);
  }

  function overrideFor(level, itemId) {
    return (level.overrides || []).find(function (row) {
      return String(row.itemId) === String(itemId);
    });
  }

  function shownPrice(level, item) {
    var hit = overrideFor(level, item.id);
    if (hit) return Number(hit.adjustedPrice) || 0;
    return computedPrice(level, item);
  }

  function blankLevel() {
    return {
      id: '',
      name: '',
      customerMode: 'all',
      customerTypes: [],
      customerIds: [],
      productMode: 'all',
      productTypes: [],
      itemIds: [],
      priceType: 'sell',
      adjustDir: 'decrease',
      adjustPct: 0,
      rounding: 'none',
      startDate: '',
      endDate: '',
      brands: [],
      overrides: []
    };
  }

  function showMsg(text, ok) {
    var el = $('pl-msg');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'text-sm ' + (ok ? 'text-sky-600' : 'text-red-500');
    el.classList.toggle('hidden', !text);
  }

  function routeId() {
    var path = location.pathname.replace(/\/+$/, '');
    var m = path.match(/^\/company\/settings\/price-levels\/([^/]+)$/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  function customerName(c) {
    return (c && (c.displayName || c.companyName || c.email)) || 'Customer';
  }

  function itemActive(item) {
    return item && !item.inactive;
  }

  function productTypes() {
    var seen = {};
    var out = PRODUCT_TYPES.slice();
    out.forEach(function (name) { seen[name] = true; });
    S.items.forEach(function (item) {
      var name = String(item.category || '').trim();
      if (!name || seen[name]) return;
      seen[name] = true;
      out.push(name);
    });
    return out;
  }

  function matchesProduct(level, item) {
    if (!itemActive(item)) return false;
    if (level.productMode === 'type') {
      var types = level.productTypes || [];
      if (!types.length) return false;
      return types.indexOf(String(item.category || '').trim()) !== -1;
    }
    if (level.productMode === 'specific') return true;
    return true;
  }

  function selectedItem(level, item) {
    if (level.productMode !== 'specific') return true;
    return (level.itemIds || []).some(function (id) { return String(id) === String(item.id); });
  }

  function summaryCustomers(level) {
    if (level.customerMode === 'type') return (level.customerTypes || []).join(', ') || 'Customer type';
    if (level.customerMode === 'specific') {
      var n = (level.customerIds || []).length;
      return n === 1 ? '1 customer' : n + ' customers';
    }
    return 'All customers';
  }

  function summaryProducts(level) {
    var bits = [];
    if (level.productMode === 'type') bits.push((level.productTypes || []).join(', ') || 'Product type');
    else if (level.productMode === 'specific') {
      var n = (level.itemIds || []).length;
      bits.push(n === 1 ? '1 item' : n + ' items');
    } else bits.push('All products');
    if ((level.brands || []).length) bits.push((level.brands || []).length + ' brand adjustment' + ((level.brands || []).length === 1 ? '' : 's'));
    return bits.join(' · ');
  }

  function summaryAdjust(level) {
    var type = level.priceType === 'sell' ? 'Sell price' : (level.priceType === 'dealer' ? 'Dealer price' : 'Net price');
    var dir = level.adjustDir === 'increase' ? 'Increase' : 'Decrease';
    return type + ' · ' + dir + ' ' + (Number(level.adjustPct) || 0) + '%';
  }

  function summaryDates(level) {
    if (level.startDate && level.endDate) return level.startDate + ' – ' + level.endDate;
    if (level.startDate) return 'From ' + level.startDate;
    if (level.endDate) return 'Until ' + level.endDate;
    return '—';
  }

  function renderList() {
    var body = $('pl-table');
    if (!body) return;
    var q = String(($('pl-search') && $('pl-search').value) || '').trim().toLowerCase();
    var rows = S.levels.filter(function (level) {
      if (!q) return true;
      return (level.name || '').toLowerCase().indexOf(q) !== -1;
    });
    $('pl-list').classList.remove('hidden');
    $('pl-editor').classList.add('hidden');
    if (!rows.length) {
      body.innerHTML = '<tr><td class="py-6 px-4 text-slate-500" colspan="5">' + (S.levels.length ? 'No price levels match.' : 'No price levels yet.') + '</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function (level) {
      return '<tr class="border-t border-slate-800 cursor-pointer hover:bg-slate-800/40" data-pl-id="' + esc(level.id) + '">' +
        '<td class="py-3 px-4 font-medium">' + esc(level.name) + '</td>' +
        '<td class="py-3 px-4">' + esc(summaryCustomers(level)) + '</td>' +
        '<td class="py-3 px-4">' + esc(summaryProducts(level)) + '</td>' +
        '<td class="py-3 px-4">' + esc(summaryAdjust(level)) + '</td>' +
        '<td class="py-3 px-4">' + esc(summaryDates(level)) + '</td>' +
        '</tr>';
    }).join('');
  }

  function readForm() {
    var level = S.level || blankLevel();
    level.name = ($('pl-name') && $('pl-name').value || '').trim();
    level.customerMode = $('pl-customer-mode') ? $('pl-customer-mode').value : 'all';
    level.productMode = $('pl-product-mode') ? $('pl-product-mode').value : 'all';
    level.priceType = $('pl-price-type') ? $('pl-price-type').value : 'sell';
    level.adjustDir = $('pl-adjust-dir') ? $('pl-adjust-dir').value : 'decrease';
    level.adjustPct = Number($('pl-adjust-pct') && $('pl-adjust-pct').value) || 0;
    level.rounding = $('pl-rounding') ? $('pl-rounding').value : 'none';
    level.startDate = $('pl-start') ? $('pl-start').value : '';
    level.endDate = $('pl-end') ? $('pl-end').value : '';
    level.customerTypes = Array.prototype.map.call(document.querySelectorAll('[data-pl-customer-type]:checked'), function (el) {
      return el.value;
    });
    level.productTypes = Array.prototype.map.call(document.querySelectorAll('[data-pl-product-type]:checked'), function (el) {
      return el.value;
    });
    return level;
  }

  function priceTypeLabel(type) {
    if (type === 'dealer') return 'Dealer price';
    if (type === 'net') return 'Net price';
    return 'Sell price';
  }

  function renderTypeChecks(hostId, attr, options, selected) {
    var host = $(hostId);
    if (!host) return;
    var picked = {};
    (selected || []).forEach(function (name) { picked[name] = true; });
    host.innerHTML = options.map(function (name) {
      return '<label class="cc-check"><input type="checkbox" ' + attr + ' value="' + esc(name) + '"' +
        (picked[name] ? ' checked' : '') + '> ' + esc(name) + '</label>';
    }).join('');
  }

  function renderBrandLines() {
    var host = $('pl-brands');
    if (!host || !S.level) return;
    var options = '<option value="">Pick a brand</option>' + S.brands.map(function (b) {
      return '<option value="' + esc(b.id) + '">' + esc(b.name) + '</option>';
    }).join('');
    if (!(S.level.brands || []).length) {
      host.innerHTML = '<p class="text-sm text-slate-500">No brand adjustment. Every brand uses the main percent.</p>';
      return;
    }
    host.innerHTML = S.level.brands.map(function (line, i) {
      return '<div class="pl-brand-line" data-pl-brand-row="' + i + '">' +
        '<select data-pl-brand>' + options.replace('value="' + esc(line.brandId) + '"', 'value="' + esc(line.brandId) + '" selected') + '</select>' +
        '<select data-pl-brand-dir>' +
          '<option value="decrease"' + (line.adjustDir !== 'increase' ? ' selected' : '') + '>Decrease by</option>' +
          '<option value="increase"' + (line.adjustDir === 'increase' ? ' selected' : '') + '>Increase by</option>' +
        '</select>' +
        '<input data-pl-brand-pct type="number" min="0" step="0.01" value="' + esc(line.adjustPct) + '">' +
        '<span>%</span>' +
        '<button type="button" data-pl-brand-remove>Remove</button>' +
        '</div>';
    }).join('');
  }

  function renderCustomers() {
    var host = $('pl-customers');
    if (!host || !S.level) return;
    var level = S.level;
    var rows = S.customers.filter(function (c) {
      if (level.customerMode === 'type') return (level.customerTypes || []).indexOf(c.customerType || '') !== -1;
      return true;
    });
    if (level.customerMode === 'all') {
      host.innerHTML = '<p class="text-sm text-slate-500 mb-3">This level includes every customer' +
        (rows.length ? ' (' + rows.length + ').' : '.') + '</p>';
    } else if (level.customerMode === 'type') {
      host.innerHTML = '<p class="text-sm text-slate-500 mb-3">' + (rows.length ? rows.length + ' customers match the types you picked.' : 'Pick at least one customer type.') + '</p>';
    } else {
      host.innerHTML = '';
    }
    if (!rows.length && level.customerMode !== 'specific') return;
    var list = (level.customerMode === 'specific' ? S.customers : rows);
    host.innerHTML += '<div class="pl-check-list">' + list.map(function (c) {
      var on = level.customerMode !== 'specific' || (level.customerIds || []).some(function (id) { return String(id) === String(c.id); });
      var locked = level.customerMode !== 'specific';
      return '<label class="cc-check"><input type="checkbox" data-pl-customer="' + esc(c.id) + '"' +
        (on ? ' checked' : '') + (locked ? ' disabled' : '') + '> ' + esc(customerName(c)) +
        (c.customerType ? ' <span class="text-slate-500">· ' + esc(c.customerType) + '</span>' : '') +
        '</label>';
    }).join('') + '</div>';
  }

  function renderProducts() {
    var body = $('pl-products');
    var head = $('pl-price-head');
    if (!body || !S.level) return;
    var level = S.level;
    if (head) head.textContent = priceTypeLabel(level.priceType);
    var q = S.productQuery.trim().toLowerCase();
    var rows = S.items.filter(function (item) {
      if (!matchesProduct(level, item)) return false;
      if (!q) return true;
      var blob = [item.sku, item.name, item.description, item.category].join(' ').toLowerCase();
      return blob.indexOf(q) !== -1;
    });
    var specific = level.productMode === 'specific';
    var count = $('pl-product-count');
    if (count) {
      var included = specific ? rows.filter(function (item) { return selectedItem(level, item); }).length : rows.length;
      count.textContent = included + (included === 1 ? ' item' : ' items');
    }
    if (!rows.length) {
      body.innerHTML = '<tr><td class="py-6 px-4 text-slate-500" colspan="' + (specific ? 6 : 5) + '">No products match.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function (item) {
      var start = basePrice(item, level.priceType);
      var adjusted = shownPrice(level, item);
      var check = specific
        ? '<td class="py-2 px-4"><input type="checkbox" data-pl-item="' + esc(item.id) + '"' + (selectedItem(level, item) ? ' checked' : '') + '></td>'
        : '';
      var desc = item.description || item.name || '';
      return '<tr class="border-t border-slate-800" data-pl-row="' + esc(item.id) + '">' + check +
        '<td class="py-2 px-4 font-medium">' + esc(item.sku || '—') + '</td>' +
        '<td class="py-2 px-4">' + esc(desc) + '</td>' +
        '<td class="py-2 px-4">' + (item.cost == null ? '—' : money(item.cost)) + '</td>' +
        '<td class="py-2 px-4">' + money(start) + '</td>' +
        '<td class="py-2 px-4"><input class="pl-adjusted" data-pl-adjusted="' + esc(item.id) + '" type="number" min="0" step="0.01" value="' + adjusted + '"></td>' +
        '</tr>';
    }).join('');
    var box = $('pl-item-col');
    if (box) box.classList.toggle('hidden', !specific);
  }

  function renderEditor() {
    var level = S.level;
    if (!level) return;
    $('pl-list').classList.add('hidden');
    $('pl-editor').classList.remove('hidden');
    $('pl-name').value = level.name || '';
    $('pl-customer-mode').value = level.customerMode || 'all';
    $('pl-product-mode').value = level.productMode || 'all';
    $('pl-price-type').value = level.priceType || 'sell';
    $('pl-adjust-dir').value = level.adjustDir || 'decrease';
    $('pl-adjust-pct').value = level.adjustPct || 0;
    $('pl-rounding').value = level.rounding || 'none';
    $('pl-start').value = level.startDate || '';
    $('pl-end').value = level.endDate || '';
    $('pl-title').textContent = level.id ? level.name || 'Price level' : 'New price level';
    $('pl-delete').classList.toggle('hidden', !level.id || !S.canEdit());
    ['pl-save', 'pl-save-close', 'pl-add-brand'].forEach(function (id) {
      var btn = $(id);
      if (btn) btn.disabled = !S.canEdit();
    });
    $('pl-customer-types').classList.toggle('hidden', level.customerMode !== 'type');
    $('pl-product-types').classList.toggle('hidden', level.productMode !== 'type');
    renderTypeChecks('pl-customer-types', 'data-pl-customer-type', CUSTOMER_TYPES, level.customerTypes);
    renderTypeChecks('pl-product-types', 'data-pl-product-type', productTypes(), level.productTypes);
    renderBrandLines();
    var custTab = $('pl-tab-customers');
    var prodTab = $('pl-tab-products');
    if (custTab) custTab.textContent = 'Customers (' + customerCount(level) + ')';
    if (prodTab) prodTab.textContent = 'Products';
    $('pl-customers-panel').classList.toggle('hidden', S.tab !== 'customers');
    $('pl-products-panel').classList.toggle('hidden', S.tab !== 'products');
    custTab.classList.toggle('is-on', S.tab === 'customers');
    prodTab.classList.toggle('is-on', S.tab === 'products');
    var note = $('pl-net-note');
    if (note) note.classList.toggle('hidden', level.priceType !== 'net');
    renderCustomers();
    renderProducts();
  }

  function customerCount(level) {
    if (level.customerMode === 'specific') return (level.customerIds || []).length;
    if (level.customerMode === 'type') {
      return S.customers.filter(function (c) {
        return (level.customerTypes || []).indexOf(c.customerType || '') !== -1;
      }).length;
    }
    return S.customers.length;
  }

  function captureAdjusted() {
    if (!S.level) return;
    document.querySelectorAll('[data-pl-adjusted]').forEach(function (input) {
      var id = input.getAttribute('data-pl-adjusted');
      var item = S.items.find(function (row) { return String(row.id) === String(id); });
      if (!item) return;
      var typed = Number(input.value);
      if (!isFinite(typed) || typed < 0) typed = 0;
      var fresh = Object.assign({}, S.level, { overrides: (S.level.overrides || []).filter(function (row) {
        return String(row.itemId) !== String(id);
      }) });
      var computed = computedPrice(fresh, item);
      S.level.overrides = (S.level.overrides || []).filter(function (row) {
        return String(row.itemId) !== String(id);
      });
      if (Math.abs(typed - computed) > 0.001) {
        S.level.overrides.push({ itemId: Number(id), adjustedPrice: Math.round(typed * 100) / 100 });
      }
    });
  }

  function payload() {
    var level = readForm();
    captureAdjusted();
    return {
      name: level.name,
      customerMode: level.customerMode,
      customerTypes: level.customerTypes,
      customerIds: level.customerIds,
      productMode: level.productMode,
      productTypes: level.productTypes,
      itemIds: level.itemIds,
      priceType: level.priceType,
      adjustDir: level.adjustDir,
      adjustPct: level.adjustPct,
      rounding: level.rounding,
      startDate: level.startDate,
      endDate: level.endDate,
      brands: (level.brands || []).filter(function (line) { return line.brandId; }),
      overrides: level.overrides || []
    };
  }

  async function ensureRefs() {
    if (S.ready) return;
    var pack = await Promise.all([
      S.api('/api/admin/company-customers'),
      S.api('/api/admin/inventory'),
      S.api('/api/admin/brands')
    ]);
    S.customers = (pack[0] && pack[0].customers) || [];
    S.items = ((pack[1] && pack[1].items) || []).filter(itemActive);
    S.brands = (pack[2] && pack[2].brands) || [];
    S.ready = true;
  }

  async function loadList() {
    var data = await S.api('/api/admin/price-levels');
    S.levels = (data && data.levels) || [];
    renderList();
  }

  async function openLevel(id) {
    showMsg('');
    await ensureRefs();
    if (!id || id === 'new') {
      S.level = blankLevel();
    } else {
      var data = await S.api('/api/admin/price-levels/' + encodeURIComponent(id));
      S.level = data.level;
    }
    S.tab = 'products';
    renderEditor();
  }

  async function syncRoute() {
    if (!$('price-levels-section') || $('price-levels-section').classList.contains('hidden')) return;
    var id = routeId();
    try {
      if (!id) await loadList();
      else await openLevel(id);
    } catch (err) {
      showMsg(err.message || 'Could not open price levels.');
    }
  }

  async function save(closeAfter) {
    if (!S.canEdit()) return;
    showMsg('');
    var body = payload();
    try {
      var saved;
      var opts = {
        method: S.level && S.level.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      };
      if (S.level && S.level.id) {
        saved = await S.api('/api/admin/price-levels/' + encodeURIComponent(S.level.id), opts);
      } else {
        saved = await S.api('/api/admin/price-levels', opts);
      }
      S.level = saved.level;
      S.levels = S.levels.filter(function (row) { return String(row.id) !== String(S.level.id); });
      S.levels.push(S.level);
      S.levels.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
      showMsg('Saved.', true);
      if (closeAfter) {
        S.go('/company/settings/price-levels');
        return;
      }
      S.go('/company/settings/price-levels/' + S.level.id);
    } catch (err) {
      showMsg(err.message || 'Could not save.');
    }
  }

  function bind() {
    var search = $('pl-search');
    if (search) search.addEventListener('input', renderList);
    var add = $('pl-new-btn');
    if (add) add.addEventListener('click', function () { S.go('/company/settings/price-levels/new'); });
    var table = $('pl-table');
    if (table) table.addEventListener('click', function (e) {
      var row = e.target.closest('[data-pl-id]');
      if (!row) return;
      S.go('/company/settings/price-levels/' + row.getAttribute('data-pl-id'));
    });
    var back = $('pl-back');
    if (back) back.addEventListener('click', function () { S.go('/company/settings/price-levels'); });
    var saveBtn = $('pl-save');
    if (saveBtn) saveBtn.addEventListener('click', function () { save(false); });
    var closeBtn = $('pl-save-close');
    if (closeBtn) closeBtn.addEventListener('click', function () { save(true); });
    var del = $('pl-delete');
    if (del) del.addEventListener('click', async function () {
      if (!S.level || !S.level.id) return;
      if (!confirm('Delete this price level?')) return;
      try {
        await S.api('/api/admin/price-levels/' + encodeURIComponent(S.level.id), { method: 'DELETE' });
        S.go('/company/settings/price-levels');
      } catch (err) {
        showMsg(err.message || 'Could not delete.');
      }
    });
    ['pl-customer-mode', 'pl-product-mode', 'pl-price-type', 'pl-adjust-dir', 'pl-rounding'].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener('change', function () {
        if (!S.level) return;
        captureAdjusted();
        readForm();
        renderEditor();
      });
    });
    var pct = $('pl-adjust-pct');
    if (pct) pct.addEventListener('input', function () {
      if (!S.level) return;
      captureAdjusted();
      readForm();
      renderProducts();
    });
    var editor = $('pl-editor');
    if (editor) editor.addEventListener('change', function (e) {
      if (!S.level) return;
      if (e.target.matches('[data-pl-customer-type], [data-pl-product-type]')) {
        readForm();
        renderEditor();
      }
      if (e.target.matches('[data-pl-customer]')) {
        var id = Number(e.target.getAttribute('data-pl-customer'));
        S.level.customerIds = (S.level.customerIds || []).filter(function (n) { return Number(n) !== id; });
        if (e.target.checked) S.level.customerIds.push(id);
        var custTab = $('pl-tab-customers');
        if (custTab) custTab.textContent = 'Customers (' + customerCount(S.level) + ')';
      }
      if (e.target.matches('[data-pl-item]')) {
        var itemId = Number(e.target.getAttribute('data-pl-item'));
        S.level.itemIds = (S.level.itemIds || []).filter(function (n) { return Number(n) !== itemId; });
        if (e.target.checked) S.level.itemIds.push(itemId);
        renderProducts();
      }
      if (e.target.matches('[data-pl-brand], [data-pl-brand-dir], [data-pl-brand-pct]')) {
        var row = e.target.closest('[data-pl-brand-row]');
        if (!row) return;
        var i = Number(row.getAttribute('data-pl-brand-row'));
        var line = S.level.brands[i];
        if (!line) return;
        line.brandId = row.querySelector('[data-pl-brand]').value;
        line.adjustDir = row.querySelector('[data-pl-brand-dir]').value;
        line.adjustPct = Number(row.querySelector('[data-pl-brand-pct]').value) || 0;
        captureAdjusted();
        renderProducts();
      }
    });
    if (editor) editor.addEventListener('click', function (e) {
      if (e.target.closest('[data-pl-brand-remove]')) {
        var row = e.target.closest('[data-pl-brand-row]');
        var i = Number(row.getAttribute('data-pl-brand-row'));
        S.level.brands.splice(i, 1);
        renderBrandLines();
        renderProducts();
      }
      if (e.target.id === 'pl-add-brand') {
        readForm();
        S.level.brands = S.level.brands || [];
        S.level.brands.push({ brandId: '', adjustDir: 'decrease', adjustPct: 0 });
        renderBrandLines();
      }
      if (e.target.id === 'pl-tab-customers' || e.target.id === 'pl-tab-products') {
        S.tab = e.target.id === 'pl-tab-customers' ? 'customers' : 'products';
        renderEditor();
      }
    });
    var find = $('pl-product-search');
    if (find) find.addEventListener('input', function () {
      captureAdjusted();
      S.productQuery = find.value || '';
      renderProducts();
    });
  }

  function boot(opts) {
    Object.assign(S, opts || {});
    bind();
  }

  global.SpectrumPriceLevels = {
    boot: boot,
    syncRoute: syncRoute
  };
})(window);
