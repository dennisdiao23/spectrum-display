/**
 * Company → Website → Traffic: sources + anonymous visitor journeys.
 */
(function (global) {
  'use strict';

  var H = {
    api: null,
    esc: function (v) {
      return String(v == null ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }
  };

  var S = {
    range: '30d',
    channel: 'both',
    selected: '',
    loading: false
  };

  function $(id) { return document.getElementById(id); }

  function esc(v) { return H.esc(v); }

  function fmtWhen(iso) {
    if (!iso) return '—';
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }).format(new Date(iso));
    } catch (e) {
      return String(iso);
    }
  }

  function visitorLabel(hash) {
    var id = String(hash || '');
    if (id.length < 6) return 'Visitor';
    return 'Visitor · ' + id.slice(-6);
  }

  function channelLabel(ch) {
    if (ch === 'store') return 'Store';
    if (ch === 'website') return 'Website';
    return 'Both';
  }

  function setToolbar() {
    var wrap = $('traffic-section');
    if (!wrap) return;
    wrap.querySelectorAll('[data-traffic-log-ch]').forEach(function (btn) {
      var on = btn.getAttribute('data-traffic-log-ch') === S.channel;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    wrap.querySelectorAll('[data-traffic-log-range]').forEach(function (btn) {
      var on = btn.getAttribute('data-traffic-log-range') === S.range;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function showError(msg) {
    var el = $('traffic-error');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('hidden', !msg);
  }

  function renderSources(rows) {
    var body = $('traffic-sources');
    if (!body) return;
    if (!rows || !rows.length) {
      body.innerHTML = '<tr><td colspan="3">No visits in this range yet. Open the public site or store, then refresh.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function (row) {
      return '<tr><td>' + esc(row.source || 'Direct') + '</td><td>' +
        esc(Number(row.visitors || 0).toLocaleString()) + '</td><td>' +
        esc(Number(row.views || 0).toLocaleString()) + '</td></tr>';
    }).join('');
  }

  function renderVisitors(rows) {
    var body = $('traffic-visitors');
    if (!body) return;
    if (!rows || !rows.length) {
      body.innerHTML = '<tr><td colspan="6">No visitor log in this range yet.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function (row) {
      var on = row.hash === S.selected ? ' is-on' : '';
      var places = (row.channels || []).map(channelLabel).join(' + ') || '—';
      return '<tr class="traffic-visitor-row' + on + '" data-visitor="' + esc(row.hash) + '">' +
        '<td>' + esc(visitorLabel(row.hash)) + '</td>' +
        '<td>' + esc(row.source || 'Direct') + '</td>' +
        '<td>' + esc(row.landing || '/') + '</td>' +
        '<td>' + esc(row.exit || '/') + '</td>' +
        '<td>' + esc(String(row.pages || 0)) + '</td>' +
        '<td>' + esc(fmtWhen(row.lastAt)) + '</td>' +
        '</tr>';
    }).join('');
  }

  function renderJourney(data) {
    var title = $('traffic-journey-title');
    var sub = $('traffic-journey-sub');
    var list = $('traffic-journey');
    if (!list) return;
    if (!data || !data.events || !data.events.length) {
      if (title) title.textContent = 'Path';
      if (sub) sub.textContent = 'Select a visitor to see the pages they opened, in order.';
      list.innerHTML = '';
      return;
    }
    if (title) title.textContent = visitorLabel(data.hash);
    if (sub) {
      sub.textContent = (data.source || 'Direct') + ' · ' + data.events.length +
        (data.events.length === 1 ? ' page' : ' pages');
    }
    list.innerHTML = data.events.map(function (ev, i) {
      var ch = channelLabel(ev.channel);
      var from = ev.referrerHost ? ' from ' + ev.referrerHost : '';
      return '<li>' +
        '<span class="traffic-journey-n">' + (i + 1) + '</span>' +
        '<div><strong>' + esc(ev.path || '/') + '</strong>' +
        '<em>' + esc(fmtWhen(ev.at)) + ' · ' + esc(ch) + ' · ' + esc(ev.source || 'Direct') + esc(from) + '</em></div>' +
        '</li>';
    }).join('');
  }

  async function loadJourney(hash) {
    if (!H.api || !hash) return;
    try {
      var data = await H.api('/api/admin/traffic/visitors/' + encodeURIComponent(hash) +
        '?range=' + encodeURIComponent(S.range) + '&channel=' + encodeURIComponent(S.channel));
      renderJourney(data);
    } catch (err) {
      renderJourney(null);
      showError(err.message || 'Could not load that visitor.');
    }
  }

  async function load() {
    if (!H.api || S.loading) return;
    var section = $('traffic-section');
    if (!section || section.classList.contains('hidden')) return;
    S.loading = true;
    setToolbar();
    showError('');
    var uniques = $('traffic-stat-uniques');
    var views = $('traffic-stat-views');
    if (uniques) uniques.textContent = '…';
    if (views) views.textContent = '…';
    try {
      var data = await H.api('/api/admin/traffic?range=' + encodeURIComponent(S.range) +
        '&channel=' + encodeURIComponent(S.channel));
      if (uniques) uniques.textContent = Number((data.totals && data.totals.visitors) || 0).toLocaleString();
      if (views) views.textContent = Number((data.totals && data.totals.views) || 0).toLocaleString();
      renderSources(data.sources || []);
      var visitors = data.visitors || [];
      if (S.selected && !visitors.some(function (row) { return row.hash === S.selected; })) {
        S.selected = '';
        renderJourney(null);
      }
      renderVisitors(visitors);
      if (S.selected) await loadJourney(S.selected);
    } catch (err) {
      if (uniques) uniques.textContent = '0';
      if (views) views.textContent = '0';
      renderSources([]);
      renderVisitors([]);
      showError(err.message || 'Could not load traffic.');
    }
    S.loading = false;
  }

  function bind() {
    var section = $('traffic-section');
    if (!section || section.dataset.bound === '1') return;
    section.dataset.bound = '1';
    section.addEventListener('click', function (e) {
      var chBtn = e.target.closest('[data-traffic-log-ch]');
      if (chBtn) {
        S.channel = chBtn.getAttribute('data-traffic-log-ch') || 'both';
        S.selected = '';
        renderJourney(null);
        load();
        return;
      }
      var rangeBtn = e.target.closest('[data-traffic-log-range]');
      if (rangeBtn) {
        S.range = rangeBtn.getAttribute('data-traffic-log-range') || '30d';
        S.selected = '';
        renderJourney(null);
        load();
        return;
      }
      var refresh = e.target.closest('#traffic-refresh');
      if (refresh) {
        load();
        return;
      }
      var row = e.target.closest('[data-visitor]');
      if (row) {
        S.selected = row.getAttribute('data-visitor') || '';
        section.querySelectorAll('.traffic-visitor-row').forEach(function (el) {
          el.classList.toggle('is-on', el.getAttribute('data-visitor') === S.selected);
        });
        loadJourney(S.selected);
      }
    });
  }

  global.SpectrumTraffic = {
    boot: function (helpers) {
      if (helpers && helpers.api) H.api = helpers.api;
      if (helpers && helpers.esc) H.esc = helpers.esc;
      bind();
    },
    load: load
  };
})(window);
