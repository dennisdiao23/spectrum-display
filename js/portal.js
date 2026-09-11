(function () {
  function $(id) {
    return document.getElementById(id);
  }

  function money(n) {
    return '$' + (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function stockStatusLabel(status) {
    if (status === 'ok') return 'In stock';
    if (status === 'low') return 'Low';
    if (status === 'out') return 'Out';
    if (status === 'special') return 'Special order';
    return status || '—';
  }

  function getAuth() {
    return window.SpectrumAuth;
  }

  function showGate(id) {
    const loading = $('portal-loading');
    if (loading) loading.hidden = true;
    ['gate-pending', 'gate-customer', 'portal-dash'].forEach(function (name) {
      const el = $(name);
      if (el) el.classList.toggle('is-on', name === id);
    });
  }

  async function authHeaders() {
    const Auth = getAuth();
    const token = Auth && Auth.accessToken ? await Auth.accessToken() : '';
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    return headers;
  }

  function openTab(name) {
    const allowed = { overview: 1, 'price-book': 1, stock: 1, projects: 1, quotes: 1, company: 1 };
    if (!allowed[name]) name = 'overview';
    document.querySelectorAll('.portal-tab').forEach(function (btn) {
      btn.classList.toggle('is-on', btn.getAttribute('data-tab') === name);
    });
    document.querySelectorAll('.portal-section').forEach(function (sec) {
      sec.classList.toggle('is-on', sec.id === 'sec-' + name);
    });
    if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
  }

  function tabFromHash() {
    const hash = String(location.hash || '').replace(/^#/, '');
    if (hash === 'price-book' || hash === 'stock' || hash === 'projects' || hash === 'quotes' || hash === 'company' || hash === 'overview') {
      return hash;
    }
    return 'overview';
  }

  function renderOverview(me) {
    const ov = me.overview || {};
    $('ov-company').textContent = ov.companyName || '—';
    $('ov-contact').textContent = ov.contactName || me.roleLabel || '—';
    $('ov-tier').textContent = ov.tierLabel || 'Authorized';
    $('ov-pay').textContent = ov.paymentLabel || '30% deposit / balance before ship';
    $('ov-hold').textContent = ov.holdLabel || '48-hour hold';
  }

  function renderPriceBook(items) {
    const list = items || [];
    const tb = $('price-book-table');
    const empty = $('price-book-empty');
    const stockTb = $('stock-table');
    const stockEmpty = $('stock-empty');
    const skuSelect = $('quote-sku');
    if (!list.length) {
      tb.innerHTML = '';
      stockTb.innerHTML = '';
      empty.classList.add('is-on');
      stockEmpty.classList.add('is-on');
      skuSelect.innerHTML = '<option value="">No SKUs</option>';
      return;
    }
    empty.classList.remove('is-on');
    stockEmpty.classList.remove('is-on');
    tb.innerHTML = list.map(function (item) {
      return '<tr>' +
        '<td>' + escapeHtml(item.sku || '—') + '</td>' +
        '<td>' + escapeHtml(item.name || '') + '</td>' +
        '<td>' + escapeHtml(item.brand || '') + '</td>' +
        '<td>' + escapeHtml(item.pitchLabel || item.pitch || '') + '</td>' +
        '<td class="net">' + money(item.dealerNet) + '</td>' +
        '<td class="num">' + money(item.listPrice) + '</td>' +
        '</tr>';
    }).join('');
    stockTb.innerHTML = list.map(function (item) {
      const loc = (item.locations && item.locations[0]) || item.warehouse || '—';
      return '<tr>' +
        '<td>' + escapeHtml(item.sku || '—') + '</td>' +
        '<td>' + escapeHtml(item.name || '') + '</td>' +
        '<td>' + escapeHtml(String(item.qty == null ? 0 : item.qty)) + '</td>' +
        '<td>' + escapeHtml(stockStatusLabel(item.status)) + '</td>' +
        '<td>' + escapeHtml(loc) + '</td>' +
        '</tr>';
    }).join('');
    skuSelect.innerHTML = '<option value="">Select SKU</option>' + list.map(function (item) {
      return '<option value="' + escapeHtml(item.sku) + '">' + escapeHtml((item.sku || '') + ' — ' + (item.name || '')) + '</option>';
    }).join('');
  }

  function renderProjects() {
    const Auth = getAuth();
    const projects = (Auth && Auth.listProjects && Auth.listProjects()) || [];
    const list = $('projects-list');
    const empty = $('projects-empty');
    if (!projects.length) {
      list.innerHTML = '';
      empty.classList.add('is-on');
      return;
    }
    empty.classList.remove('is-on');
    list.innerHTML = projects.map(function (p) {
      const title = (p.brandName || '') + ' ' + (p.seriesName || 'Design');
      const size = (p.width || '?') + ' × ' + (p.height || '?') + ' m';
      const qs = new URLSearchParams();
      if (p.brand) qs.set('brand', p.brand);
      if (p.series) qs.set('series', p.series);
      if (p.pitch != null && p.pitch !== '') qs.set('pitch', String(p.pitch));
      if (p.width != null) qs.set('w', String(p.width));
      if (p.height != null) qs.set('h', String(p.height));
      if (p.unit) qs.set('unit', p.unit);
      const url = '/led-wall-calculator?' + qs.toString();
      return '<div class="portal-project"><div><strong>' + escapeHtml(title) + '</strong>' +
        '<div class="portal-note" style="margin:0.3rem 0 0">' + escapeHtml(size) + '</div></div>' +
        '<a href="' + url + '">Open</a></div>';
    }).join('');
  }

  function renderCompany(app) {
    const box = $('company-fields');
    if (!app) {
      box.innerHTML = '<p class="portal-note">No application is on file for this account.</p>';
      return;
    }
    const addr = app.companyAddress || {};
    const addrLine = [addr.line1, addr.line2, addr.city, addr.state, addr.postal_code, addr.country].filter(Boolean).join(', ');
    function field(label, value) {
      return '<div><dt>' + escapeHtml(label) + '</dt><dd>' + escapeHtml(value == null || value === '' ? '—' : value) + '</dd></div>';
    }
    box.innerHTML = field('Company', app.companyName) +
      field('Applicant', app.contactName) +
      field('Email', app.email) +
      field('Phone', app.phone) +
      field('Website', app.website) +
      field('Tax ID', app.taxId) +
      field('Years in business', app.yearsInBusiness) +
      field('Company size', app.companySize) +
      field('Business type', (app.businessType || []).join(', ')) +
      field('Verticals', (app.primaryVerticals || []).join(', ')) +
      field('Address', addrLine) +
      field('References', app.referencesText) +
      field('Resale certificate', app.resaleCertificateName) +
      field('Status', app.status) +
      field('Tier', app.dealerTier === 'preferred' ? 'Preferred' : 'Authorized');
  }

  function renderQuotes(quotes) {
    const list = $('quotes-list');
    const empty = $('quotes-empty');
    const rows = quotes || [];
    if (!rows.length) {
      list.innerHTML = '';
      empty.classList.add('is-on');
      return;
    }
    empty.classList.remove('is-on');
    list.innerHTML = rows.map(function (q) {
      const lines = (q.lines || []).map(function (line) {
        return escapeHtml(line.sku || line.item) + ' × ' + escapeHtml(String(line.qty));
      }).join(', ');
      return '<div class="portal-quote"><h3>' + escapeHtml(q.number || 'Quote') +
        ' <span class="portal-badge">' + escapeHtml(q.status || 'draft') + '</span></h3>' +
        '<p>' + escapeHtml(q.issueDate || '') + (q.total ? ' · ' + money(q.total) : '') +
        (lines ? '<br>' + lines : '') + '</p>' +
        (q.notes ? '<p style="margin-top:0.45rem">' + escapeHtml(q.notes) + '</p>' : '') +
        '</div>';
    }).join('');
  }

  let quoteLines = [];

  function addQuoteLine() {
    const sku = $('quote-sku').value;
    const qty = Number($('quote-qty').value) || 1;
    if (!sku) return;
    quoteLines.push({ sku: sku, qty: qty });
    renderQuoteLines();
  }

  function renderQuoteLines() {
    $('quote-lines').innerHTML = quoteLines.map(function (line, i) {
      return '<div class="portal-line-row"><span>' + escapeHtml(line.sku) + ' × ' + escapeHtml(String(line.qty)) +
        '</span><span></span><button type="button" class="portal-btn portal-btn-ghost" data-rm="' + i + '">Remove</button></div>';
    }).join('');
  }

  async function submitQuote(e) {
    e.preventDefault();
    const msg = $('quote-msg');
    msg.textContent = '';
    msg.classList.remove('is-error');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/dealer/quotes', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          notes: $('quote-notes').value,
          lines: quoteLines
        })
      });
      const json = await res.json().catch(function () { return {}; });
      if (!res.ok || !json.ok) throw new Error(json.error || 'Could not request the quote.');
      $('quote-notes').value = '';
      quoteLines = [];
      renderQuoteLines();
      msg.textContent = 'Quote ' + ((json.quote && json.quote.number) || '') + ' is in Company as a Sales Quote.';
      await loadQuotes();
    } catch (err) {
      msg.textContent = (err && err.message) || 'Could not request the quote.';
      msg.classList.add('is-error');
    }
  }

  async function loadQuotes() {
    const headers = await authHeaders();
    const res = await fetch('/api/dealer/quotes', { headers: headers });
    const json = await res.json().catch(function () { return {}; });
    if (res.ok && json.ok) renderQuotes(json.quotes || []);
  }

  async function bootDash(me) {
    showGate('portal-dash');
    $('dash-name').textContent = (me.overview && (me.overview.contactName || me.overview.companyName)) || '';
    $('dash-role').textContent = me.roleLabel || 'Dealer';
    renderOverview(me);
    renderCompany(me.application);
    renderProjects();
    const headers = await authHeaders();
    const bookRes = await fetch('/api/dealer/price-book', { headers: headers });
    const book = await bookRes.json().catch(function () { return {}; });
    if (bookRes.ok && book.ok) renderPriceBook(book.items || []);
    await loadQuotes();
    openTab(tabFromHash());
  }

  async function boot() {
    const Auth = window.SpectrumAuth;
    if (!Auth) return;
    await (Auth.ready || Promise.resolve());
    if (!Auth.isLoggedIn()) {
      window.location.replace('/account.html?next=/portal');
      return;
    }
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/dealer/me', { headers: headers });
      const me = await res.json().catch(function () { return {}; });
      if (!res.ok || !me.ok) {
        window.location.replace('/account.html?next=/portal');
        return;
      }
      if (me.canSeeNets) {
        await bootDash(me);
        return;
      }
      if (me.pending || (me.application && me.application.status === 'pending')) {
        showGate('gate-pending');
        const pendingCo = $('pending-company');
        if (pendingCo) {
          pendingCo.textContent = (me.overview && me.overview.companyName) ||
            (me.application && me.application.companyName) || '';
        }
        return;
      }
      showGate('gate-customer');
    } catch (_err) {
      showGate('gate-customer');
    }
  }

  document.querySelectorAll('.portal-tab').forEach(function (btn) {
    btn.addEventListener('click', function () { openTab(btn.getAttribute('data-tab')); });
  });
  const quoteAdd = $('quote-add');
  if (quoteAdd) quoteAdd.addEventListener('click', addQuoteLine);
  const quoteLinesEl = $('quote-lines');
  if (quoteLinesEl) {
    quoteLinesEl.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-rm]');
      if (!btn) return;
      quoteLines.splice(Number(btn.getAttribute('data-rm')), 1);
      renderQuoteLines();
    });
  }
  const quoteForm = $('quote-form');
  if (quoteForm) quoteForm.addEventListener('submit', submitQuote);

  (window.SpectrumAuth && window.SpectrumAuth.ready ? window.SpectrumAuth.ready : Promise.resolve()).then(boot);
})();
