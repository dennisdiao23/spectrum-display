(function (global) {
  'use strict';

  var S = {
    api: null,
    esc: function (s) { return String(s == null ? '' : s); },
    canEdit: function () { return true; },
    go: function () {},
    brands: [],
    rules: [],
    brand: null,
    tab: 'brand',
    types: [],
    priceTouched: false,
    pending: null,
    ready: false
  };

  function $(id) { return document.getElementById(id); }

  function esc(s) { return S.esc(s); }

  function bp() { return global.SpectrumBrandPrices; }

  function routeId() {
    var path = location.pathname.replace(/\/+$/, '');
    var m = path.match(/^\/company\/settings\/brands\/([^/]+)$/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  function showMsg(text, ok) {
    var el = $('sb-msg');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'text-sm ' + (ok ? 'text-sky-600' : 'text-red-500');
    el.classList.toggle('hidden', !text);
  }

  function brandKey() {
    return S.brand && S.brand.id ? S.brand.id : '';
  }

  function rulesFor(brandId) {
    return S.rules.filter(function (row) { return String(row.brandId) === String(brandId); });
  }

  function stashDomRules() {
    if (!S.brand || !$('sb-rules')) return;
    var key = brandKey();
    var next = readRulesFromDom().map(function (row) {
      row.brandId = key;
      return row;
    });
    S.rules = S.rules.filter(function (row) { return String(row.brandId) !== String(key); }).concat(next);
  }

  function blankGroup() {
    return ['sell', 'dealer', 'integrator'].map(function (key) {
      var lock = bp().lockedBasis(key, key === 'sell' ? 'cost' : 'sell');
      return {
        productType: '',
        priceKey: key,
        basis: lock.basis,
        adjustDir: lock.adjustDir,
        adjustPct: 0
      };
    });
  }

  function groups() {
    var map = { '': blankGroup() };
    if (!S.brand) return map;
    rulesFor(S.brand.id).forEach(function (row) {
      var type = row.productType || '';
      if (!map[type]) map[type] = blankGroup().map(function (rule) {
        rule.productType = type;
        return rule;
      });
      map[type].forEach(function (rule) {
        if (rule.priceKey !== row.priceKey) return;
        rule.basis = row.basis;
        rule.adjustDir = row.adjustDir;
        rule.adjustPct = row.adjustPct;
        rule.productType = type;
      });
    });
    S.types.forEach(function (type) {
      if (map[type]) return;
      map[type] = blankGroup().map(function (rule) {
        return {
          productType: type,
          priceKey: rule.priceKey,
          basis: rule.basis,
          adjustDir: rule.adjustDir,
          adjustPct: 0
        };
      });
    });
    return map;
  }

  function readRulesFromDom() {
    var rows = [];
    document.querySelectorAll('[data-sb-pct]').forEach(function (input) {
      var key = input.getAttribute('data-sb-key');
      var type = input.getAttribute('data-sb-type') || '';
      var basisEl = document.querySelector('[data-sb-basis][data-sb-key="' + key + '"][data-sb-type="' + type + '"]');
      var lock = bp().lockedBasis(key, basisEl ? basisEl.value : 'cost');
      rows.push({
        productType: type,
        priceKey: key,
        basis: lock.basis,
        adjustDir: lock.adjustDir,
        adjustPct: input.value
      });
    });
    return rows;
  }

  function renderList() {
    var body = $('sb-table');
    if (!body) return;
    var q = String(($('sb-search') && $('sb-search').value) || '').trim().toLowerCase();
    var rows = S.brands.filter(function (brand) {
      if (!q) return true;
      return (brand.name || '').toLowerCase().indexOf(q) !== -1;
    });
    if (!rows.length) {
      body.innerHTML = '<tr><td class="py-6 px-4 text-slate-500">' + (S.brands.length ? 'No brands match.' : 'No brands yet.') + '</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function (brand) {
      var on = S.brand && String(S.brand.id) === String(brand.id);
      return '<tr class="border-t border-slate-800 cursor-pointer hover:bg-slate-800/40' + (on ? ' is-selected' : '') + '" data-sb-id="' + esc(brand.id) + '">' +
        '<td class="py-3 px-4 font-medium">' + esc(brand.name || brand.id) + '</td></tr>';
    }).join('');
  }

  function renderRules() {
    var body = $('sb-rules');
    if (!body || !S.brand) return;
    var map = groups();
    var types = Object.keys(map).sort(function (a, b) {
      if (!a) return -1;
      if (!b) return 1;
      return a.localeCompare(b);
    });
    var html = '';
    types.forEach(function (type) {
      map[type].forEach(function (rule) {
        var basis = rule.priceKey === 'sell'
          ? '<span class="text-slate-500">Cost, increase by</span>'
          : '<select data-sb-basis data-sb-key="' + esc(rule.priceKey) + '" data-sb-type="' + esc(type) + '" disabled>' +
            '<option value="cost"' + (rule.basis === 'cost' ? ' selected' : '') + '>Cost, increase by</option>' +
            '<option value="sell"' + (rule.basis === 'sell' ? ' selected' : '') + '>Sell price, decrease by</option>' +
            '</select>';
        html += '<tr class="border-t border-slate-800" data-sb-row="' + esc(type) + '">' +
          '<td class="py-2 px-3">' + esc(type || 'All products') + '</td>' +
          '<td class="py-2 px-3">' + esc(bp().priceLabel(rule.priceKey)) + '</td>' +
          '<td class="py-2 px-3">' + basis + '</td>' +
          '<td class="py-2 px-3"><input data-sb-pct data-sb-key="' + esc(rule.priceKey) + '" data-sb-type="' + esc(type) + '" type="number" min="0" step="0.01" value="' + esc(rule.adjustPct) + '" readonly class="w-24 border border-slate-300 rounded px-2 py-1">' +
          '<button type="button" class="text-sm text-sky-600 ml-2" data-sb-edit>Edit</button></td>' +
          '<td class="py-2 px-3">' + (type && rule.priceKey === 'sell'
            ? '<button type="button" class="text-sm text-red-400" data-sb-remove-type="' + esc(type) + '">Remove</button>'
            : '') + '</td></tr>';
      });
    });
    body.innerHTML = html;
    var add = $('sb-add-type');
    var pick = $('sb-type-pick');
    var used = {};
    types.forEach(function (type) { if (type) used[type] = true; });
    var left = bp().PRODUCT_TYPES.filter(function (name) { return !used[name]; });
    if (pick) {
      pick.innerHTML = left.map(function (name) {
        return '<option value="' + esc(name) + '">' + esc(name) + '</option>';
      }).join('');
      pick.disabled = !left.length || !S.canEdit();
      pick.classList.toggle('hidden', !left.length);
    }
    if (add) {
      add.disabled = !left.length || !S.canEdit();
      add.classList.toggle('hidden', !left.length);
    }
  }

  function renderDetail() {
    var empty = $('sb-empty');
    var detail = $('sb-detail');
    if (!S.brand) {
      if (empty) empty.classList.remove('hidden');
      if (detail) detail.classList.add('hidden');
      renderList();
      return;
    }
    if (empty) empty.classList.add('hidden');
    if (detail) detail.classList.remove('hidden');
    $('sb-title').textContent = S.brand.name || 'Brand';
    $('sb-name').value = S.brand.name || '';
    $('sb-name').disabled = !S.canEdit();
    $('sb-save').classList.toggle('hidden', !S.canEdit());
    $('sb-tab-brand').classList.toggle('is-on', S.tab === 'brand');
    $('sb-tab-price').classList.toggle('is-on', S.tab === 'price');
    $('sb-pane-brand').classList.toggle('hidden', S.tab !== 'brand');
    $('sb-pane-price').classList.toggle('hidden', S.tab !== 'price');
    renderRules();
    renderList();
  }

  async function load() {
    var data = await S.api('/api/admin/settings/brands');
    S.brands = data.brands || [];
    S.rules = data.rules || [];
    if (bp()) {
      bp().setRules(S.rules);
      bp().setBrands(S.brands);
    }
    var id = (S.brand && S.brand.id) || routeId();
    if (id && id !== 'new') {
      S.brand = S.brands.find(function (brand) { return String(brand.id) === String(id); }) || null;
      S.types = [];
      rulesFor(id).forEach(function (row) {
        if (row.productType && S.types.indexOf(row.productType) === -1) S.types.push(row.productType);
      });
    }
    renderDetail();
  }

  async function openBrand(id) {
    showMsg('');
    if (!id || id === 'new') {
      S.brand = { id: '', name: '' };
      S.types = [];
      S.tab = 'brand';
      S.priceTouched = false;
      renderDetail();
      S.go('/company/settings/brands/new');
      return;
    }
    S.brand = S.brands.find(function (brand) { return String(brand.id) === String(id); }) || { id: id, name: id };
    S.priceTouched = false;
    S.types = [];
    rulesFor(id).forEach(function (row) {
      if (row.productType && S.types.indexOf(row.productType) === -1) S.types.push(row.productType);
    });
    renderDetail();
    S.go('/company/settings/brands/' + encodeURIComponent(id));
  }

  function jsonBody(payload) {
    return {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    };
  }

  function moneyText(n) {
    var v = Number(n);
    if (!isFinite(v)) return '—';
    return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function hideReview() {
    var box = $('sb-review');
    if (!box) return;
    box.hidden = true;
    box.classList.remove('is-open');
  }

  function underCost(value, cost) {
    var n = Number(value);
    var c = Number(cost);
    return isFinite(n) && isFinite(c) && c > 0 && n < c;
  }

  function paintReviewRow(row) {
    if (!row) return;
    var cost = Number(row.getAttribute('data-sb-cost'));
    var under = false;
    row.querySelectorAll('[data-sb-new]').forEach(function (input) {
      var bad = underCost(input.value, cost);
      input.classList.toggle('is-under', bad);
      if (bad) under = true;
    });
    if (!under) row.removeAttribute('data-sb-ok');
    var allowBtn = row.querySelector('[data-sb-allow]');
    if (allowBtn) {
      allowBtn.classList.toggle('hidden', !under);
      allowBtn.textContent = row.getAttribute('data-sb-ok') === '1' ? 'Confirmed' : 'Confirm';
    }
    row.classList.toggle('has-under', under && row.getAttribute('data-sb-ok') !== '1');
  }

  function syncReviewConfirm() {
    var confirmBtn = $('sb-review-confirm');
    if (!confirmBtn) return;
    var blocked = false;
    document.querySelectorAll('#sb-review-rows tr[data-sb-change]').forEach(function (row) {
      if (row.classList.contains('is-skipped')) return;
      if (row.classList.contains('has-under')) blocked = true;
    });
    var any = document.querySelector('#sb-review-rows tr[data-sb-change]:not(.is-skipped)');
    confirmBtn.disabled = blocked || !any;
    confirmBtn.classList.toggle('is-locked', blocked);
    confirmBtn.title = blocked ? 'A price is under cost. Confirm that row, change the price, or skip it.' : '';
  }

  function showReview(data) {
    var box = $('sb-review');
    var note = $('sb-review-note');
    var body = $('sb-review-rows');
    var confirmBtn = $('sb-review-confirm');
    if (!box || !body) return;
    var changes = data.changes || [];
    var skipped = Number(data.skippedNoCost) || 0;
    var bits = [];
    if (changes.length) bits.push(changes.length + (changes.length === 1 ? ' item will change.' : ' items will change.'));
    else bits.push('No inventory prices change.');
    bits.push('The percents are saved.');
    if (skipped) bits.push(skipped + (skipped === 1 ? ' item has no cost, so its prices stay as they are.' : ' items have no cost, so their prices stay as they are.'));
    if (note) note.textContent = bits.join(' ');
    body.innerHTML = changes.length ? changes.map(function (row) {
      return '<tr class="border-t border-slate-200" data-sb-change="' + esc(row.id) + '" data-sb-cost="' + esc(row.cost) + '">' +
        '<td class="py-2 px-2">' + esc(row.name) + '</td>' +
        '<td class="py-2 px-2">' + esc(row.sku) + '</td>' +
        '<td class="py-2 px-2">' + moneyText(row.cost) + '</td>' +
        '<td class="py-2 px-2">' + moneyText(row.sellOld) + '</td>' +
        '<td class="py-2 px-2"><input data-sb-new="sell" type="number" min="0" step="0.01" value="' + esc(row.sellNew) + '"></td>' +
        '<td class="py-2 px-2">' + moneyText(row.dealerOld) + '</td>' +
        '<td class="py-2 px-2"><input data-sb-new="dealer" type="number" min="0" step="0.01" value="' + esc(row.dealerNew) + '"></td>' +
        '<td class="py-2 px-2">' + moneyText(row.integratorOld) + '</td>' +
        '<td class="py-2 px-2"><input data-sb-new="integrator" type="number" min="0" step="0.01" value="' + esc(row.integratorNew) + '"></td>' +
        '<td class="py-2 px-2 sb-review-actions"><button type="button" class="cc-leave-no" data-sb-skip>Skip</button> <button type="button" class="cc-leave-yes hidden" data-sb-allow>Confirm</button></td>' +
        '</tr>';
    }).join('') : '<tr><td class="py-4 px-2 text-slate-500" colspan="10">Nothing to update.</td></tr>';
    body.querySelectorAll('tr[data-sb-change]').forEach(paintReviewRow);
    syncReviewConfirm();
    if (confirmBtn) confirmBtn.classList.toggle('hidden', !changes.length);
    syncReviewConfirm();
    box.hidden = false;
    box.classList.add('is-open');
  }

  function readReviewChanges() {
    return Array.prototype.map.call(document.querySelectorAll('#sb-review-rows tr[data-sb-change]'), function (row) {
      function val(name) {
        var input = row.querySelector('[data-sb-new="' + name + '"]');
        return input ? input.value : '';
      }
      return {
        id: row.getAttribute('data-sb-change'),
        sellNew: val('sell'),
        dealerNew: val('dealer'),
        integratorNew: val('integrator'),
        skip: row.classList.contains('is-skipped')
      };
    });
  }

  async function saveBrand(confirm) {
    var name = String(($('sb-name') && $('sb-name').value) || '').trim();
    var rules = S.pending ? S.pending.rules : (S.priceTouched ? rulesFor(brandKey()) : rulesFor(S.brand.id));
    var payload = { name: name, rules: rules, confirm: !!confirm };
    if (confirm) payload.changes = readReviewChanges();
    var saved;
    if (!S.brand.id) {
      saved = await S.api('/api/admin/settings/brands', Object.assign({ method: 'POST' }, jsonBody(payload)));
    } else {
      saved = await S.api('/api/admin/settings/brands/' + encodeURIComponent(S.brand.id), Object.assign({ method: 'PUT' }, jsonBody(payload)));
    }
    return saved;
  }

  async function save() {
    if (!S.brand || !S.canEdit()) return;
    showMsg('');
    if (S.priceTouched) stashDomRules();
    var name = String(($('sb-name') && $('sb-name').value) || '').trim();
    if (!name) {
      showMsg('Name the brand.');
      S.tab = 'brand';
      renderDetail();
      return;
    }
    S.pending = {
      rules: S.priceTouched ? rulesFor(brandKey()) : rulesFor(S.brand.id)
    };
    try {
      var saved = await saveBrand(false);
      S.brand = saved.brand;
      S.pending.rules = saved.rules || S.pending.rules;
      S.priceTouched = false;
      await load();
      S.go('/company/settings/brands/' + encodeURIComponent(S.brand.id));
      showReview(saved);
      showMsg('Percents saved. Review the price changes before they update inventory.', true);
    } catch (err) {
      showMsg(err.message || 'Could not save.');
    }
  }

  async function confirmReview() {
    if (!S.brand || !S.brand.id || !S.pending) return;
    var confirmBtn = $('sb-review-confirm');
    if (confirmBtn && confirmBtn.disabled) return;
    if (confirmBtn) confirmBtn.disabled = true;
    try {
      var saved = await saveBrand(true);
      hideReview();
      S.pending = null;
      var n = (saved.changes || []).length;
      showMsg(n ? ('Updated ' + n + (n === 1 ? ' item.' : ' items.')) : 'Saved. No inventory prices changed.', true);
      await load();
    } catch (err) {
      showMsg(err.message || 'Could not update inventory.');
    }
    if (confirmBtn) confirmBtn.disabled = false;
  }

  function bind() {
    var search = $('sb-search');
    if (search) search.addEventListener('input', renderList);
    var add = $('sb-add');
    if (add) add.addEventListener('click', function () { openBrand('new'); });
    var table = $('sb-table');
    if (table) table.addEventListener('click', function (e) {
      var row = e.target.closest('[data-sb-id]');
      if (!row) return;
      openBrand(row.getAttribute('data-sb-id'));
    });
    var saveBtn = $('sb-save');
    if (saveBtn) saveBtn.addEventListener('click', save);
    var reviewBack = $('sb-review-back');
    if (reviewBack) reviewBack.addEventListener('click', hideReview);
    var reviewConfirm = $('sb-review-confirm');
    if (reviewConfirm) reviewConfirm.addEventListener('click', confirmReview);
    var reviewRows = $('sb-review-rows');
    if (reviewRows) reviewRows.addEventListener('click', function (e) {
      var row = e.target.closest('tr');
      var allow = e.target.closest('[data-sb-allow]');
      if (allow && row) {
        row.setAttribute('data-sb-ok', '1');
        paintReviewRow(row);
        syncReviewConfirm();
        return;
      }
      var skip = e.target.closest('[data-sb-skip]');
      if (!skip || !row) return;
      var on = row.classList.toggle('is-skipped');
      skip.textContent = on ? 'Undo' : 'Skip';
      row.querySelectorAll('input').forEach(function (input) { input.disabled = on; });
      syncReviewConfirm();
    });
    if (reviewRows) reviewRows.addEventListener('input', function (e) {
      var row = e.target.closest('tr');
      if (!row) return;
      paintReviewRow(row);
      syncReviewConfirm();
    });
    var tabBrand = $('sb-tab-brand');
    var tabPrice = $('sb-tab-price');
    if (tabBrand) tabBrand.addEventListener('click', function () {
      stashDomRules();
      S.tab = 'brand';
      renderDetail();
    });
    if (tabPrice) tabPrice.addEventListener('click', function () {
      S.priceTouched = true;
      S.tab = 'price';
      renderDetail();
    });
    var rulesBody = $('sb-rules');
    if (rulesBody) rulesBody.addEventListener('input', function () { S.priceTouched = true; });
    if (rulesBody) rulesBody.addEventListener('click', function (e) {
      var edit = e.target.closest('[data-sb-edit]');
      if (edit) {
        rulesBody.querySelectorAll('[data-sb-pct]').forEach(function (input) { input.readOnly = true; });
        rulesBody.querySelectorAll('[data-sb-basis]').forEach(function (sel) { sel.disabled = true; });
        rulesBody.querySelectorAll('[data-sb-edit]').forEach(function (btn) { btn.classList.remove('is-on'); });
        var row = edit.closest('tr');
        var input = row && row.querySelector('[data-sb-pct]');
        var basis = row && row.querySelector('[data-sb-basis]');
        if (input) {
          input.readOnly = false;
          input.focus();
          input.select();
        }
        if (basis) basis.disabled = false;
        edit.classList.add('is-on');
        S.priceTouched = true;
        return;
      }
      var btn = e.target.closest('[data-sb-remove-type]');
      if (!btn) return;
      var type = btn.getAttribute('data-sb-remove-type');
      S.types = S.types.filter(function (name) { return name !== type; });
      if (S.brand && S.brand.id) {
        S.rules = S.rules.filter(function (row) {
          return row.brandId !== S.brand.id || row.productType !== type;
        });
      }
      renderRules();
    });
    var addType = $('sb-add-type');
    if (addType) addType.addEventListener('click', function () {
      var pick = $('sb-type-pick');
      var match = pick && pick.value;
      if (!match) return;
      if (S.types.indexOf(match) === -1) S.types.push(match);
      renderRules();
    });
    var resizer = $('sb-split-resizer');
    var split = $('sb-split');
    if (resizer && split) {
      resizer.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        var startX = e.clientX;
        var start = split.getBoundingClientRect().width ? parseFloat(getComputedStyle(split).gridTemplateColumns) : 400;
        function move(ev) {
          var next = Math.max(220, Math.min(640, (isFinite(start) ? start : 400) + (ev.clientX - startX)));
          split.style.gridTemplateColumns = next + 'px 14px minmax(0, 1fr)';
        }
        function up() {
          document.removeEventListener('pointermove', move);
          document.removeEventListener('pointerup', up);
        }
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
      });
    }
  }

  async function syncRoute() {
    if (!$('brands-section') || $('brands-section').classList.contains('hidden')) return;
    if (!S.ready) return;
    var id = routeId();
    if (!S.brands.length) await load();
    if (id === 'new') {
      if (!S.brand || S.brand.id) await openBrand('new');
      return;
    }
    if (id) {
      if (!S.brand || String(S.brand.id) !== id) await openBrand(id);
      return;
    }
    S.brand = null;
    renderDetail();
  }

  function boot(opts) {
    opts = opts || {};
    S.api = opts.api;
    S.esc = opts.esc || S.esc;
    S.canEdit = opts.canEdit || S.canEdit;
    S.go = opts.go || S.go;
    if (S.ready) return;
    S.ready = true;
    bind();
  }

  global.SpectrumSettingsBrands = {
    boot: boot,
    syncRoute: syncRoute,
    load: load
  };
})(window);
