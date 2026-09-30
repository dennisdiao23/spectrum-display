/* What’s new log, app guides, login popup, and a refresh bar for a stale tab. */
(function () {
  const POLL_MS = 60000;
  let pack = null;
  let appName = '';
  let userId = '';
  let goUpdates = null;
  let started = false;
  let pollTimer = null;
  let dim = null;
  let card = null;
  let bar = null;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function seenKey() {
    return 'spectrum-notes-seen-' + appName + '-' + (userId || 'anon');
  }

  function getSeen() {
    try { return localStorage.getItem(seenKey()) || ''; } catch (err) { return ''; }
  }

  function setSeen(id) {
    try { localStorage.setItem(seenKey(), String(id || '')); } catch (err) {}
  }

  function bootHidden() {
    const el = document.getElementById('company-boot');
    if (!el) return true;
    return el.hidden === true || el.classList.contains('hidden');
  }

  function tourOpen() {
    return !!(window.SpectrumHelp && typeof SpectrumHelp.isTourOpen === 'function' && SpectrumHelp.isTourOpen());
  }

  function helpTourSeen() {
    try {
      return localStorage.getItem('spectrum-help-tour-' + appName + '-' + (userId || 'anon')) === '1';
    } catch (err) {
      return false;
    }
  }

  function tourBlocking() {
    if (tourOpen()) return true;
    if (window.SpectrumHelp && !helpTourSeen()) return true;
    return false;
  }

  function appReady() {
    if (!bootHidden()) return false;
    const login = document.getElementById('login-panel');
    if (login && !login.classList.contains('hidden') && !login.hidden) return false;
    return true;
  }

  function formatDate(value) {
    const d = new Date(String(value || '') + 'T12:00:00');
    if (Number.isNaN(d.getTime())) return String(value || '');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function forThisApp(note) {
    const apps = (note && note.apps) || [];
    return apps.indexOf(appName) !== -1 || apps.indexOf('both') !== -1;
  }

  function appNotes() {
    return ((pack && pack.notes) || []).filter(forThisApp).slice().sort(function (a, b) {
      return String(b.date || '').localeCompare(String(a.date || '')) || String(b.id || '').localeCompare(String(a.id || ''));
    });
  }

  function latestUnseen() {
    const list = appNotes();
    if (!list.length) return null;
    const seen = getSeen();
    if (seen && list[0].id === seen) return null;
    return list[0];
  }

  function listBlock(label, items) {
    if (!items || !items.length) return '';
    return '<p class="app-notes-kicker">' + esc(label) + '</p><ul class="app-notes-list">' +
      items.map(function (line) { return '<li>' + esc(line) + '</li>'; }).join('') +
      '</ul>';
  }

  function noteInner(note, opts) {
    opts = opts || {};
    let html = '';
    if (!opts.noDate) html += '<p class="app-notes-date">' + esc(formatDate(note.date)) + '</p>';
    html += '<p class="app-notes-title">' + esc(note.title || 'What’s new') + '</p>';
    html += listBlock('Added', note.added);
    html += listBlock('Changed', note.changed);
    html += listBlock('Removed', note.removed);
    if (note.how) {
      html += '<p class="app-notes-kicker">How it works</p><p class="app-notes-how">' + esc(note.how) + '</p>';
    }
    return html;
  }

  function paintPages() {
    const updates = document.getElementById('updates-list');
    if (updates) {
      const list = appNotes();
      updates.innerHTML = list.length
        ? list.map(function (note) {
          return '<article class="app-notes-entry">' + noteInner(note) + '</article>';
        }).join('')
        : '<p class="app-notes-empty">No updates yet.</p>';
    }
    const guide = document.getElementById('guide-list');
    if (guide) {
      const rows = (pack && pack.guides && pack.guides[appName]) || [];
      guide.innerHTML = rows.length
        ? rows.map(function (row) {
          return '<article class="app-notes-entry"><p class="app-notes-title">' + esc(row.title) +
            '</p><p class="app-notes-how">' + esc(row.text) + '</p></article>';
        }).join('')
        : '<p class="app-notes-empty">No guide yet.</p>';
    }
  }

  function ensureUi() {
    if (dim) return;
    dim = document.createElement('div');
    dim.className = 'app-notes-dim';
    dim.hidden = true;
    card = document.createElement('div');
    card.id = 'app-notes-card';
    card.className = 'app-notes-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'app-notes-card-title');
    card.hidden = true;
    bar = document.createElement('div');
    bar.id = 'app-notes-reload';
    bar.className = 'app-notes-reload';
    bar.hidden = true;
    const who = appName === 'portal' ? 'Dealer Portal' : 'Company';
    bar.innerHTML = '<p>' + esc(who) + ' was updated. Refresh to see the new screens.</p>' +
      '<button type="button" id="app-notes-reload-btn">Refresh</button>';
    document.body.appendChild(dim);
    document.body.appendChild(card);
    document.body.appendChild(bar);
    document.getElementById('app-notes-reload-btn').addEventListener('click', function () {
      window.location.reload();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && card && !card.hidden) {
        event.preventDefault();
        dismissPopup();
      }
    });
  }

  function dismissPopup() {
    const note = latestUnseen();
    if (note) setSeen(note.id);
    if (card) card.hidden = true;
    if (dim) dim.hidden = true;
  }

  function showPopup(note) {
    if (!card || !note || !appReady() || tourOpen()) return false;
    card.innerHTML = '<p class="app-notes-kicker" id="app-notes-card-title">What’s new</p>' +
      noteInner(note, { noDate: false }) +
      '<div class="app-notes-actions">' +
      '<button type="button" class="app-help-text-btn" id="app-notes-all">See all updates</button>' +
      '<button type="button" class="app-help-primary" id="app-notes-got">Got it</button>' +
      '</div>';
    dim.hidden = false;
    card.hidden = false;
    const all = document.getElementById('app-notes-all');
    const got = document.getElementById('app-notes-got');
    if (got) got.addEventListener('click', dismissPopup);
    if (all) {
      all.addEventListener('click', function () {
        dismissPopup();
        if (typeof goUpdates === 'function') goUpdates();
      });
    }
    if (got) got.focus();
    return true;
  }

  function maybePopup(tries) {
    tries = tries || 0;
    try {
      const note = latestUnseen();
      if (!note) return;
      if (!appReady() || tourBlocking()) {
        if (tries >= 80) {
          if (appReady() && !tourOpen()) showPopup(note);
          return;
        }
        window.setTimeout(function () { maybePopup(tries + 1); }, 250);
        return;
      }
      showPopup(note);
    } catch (err) {
      console.error('SpectrumNotes popup', err);
    }
  }

  function showReloadBar() {
    ensureUi();
    if (bar) bar.hidden = false;
  }

  async function loadPack() {
    const res = await fetch('/api/app-notes', { credentials: 'same-origin', cache: 'no-store' });
    const json = await res.json().catch(function () { return {}; });
    if (!res.ok || json.ok === false) throw new Error(json.error || 'Notes unavailable.');
    return json;
  }

  function startPoll() {
    if (pollTimer) return;
    pollTimer = window.setInterval(function () {
      loadPack().then(function (next) {
        if (pack && next && next.build && pack.build && next.build !== pack.build) showReloadBar();
      }).catch(function () {});
    }, POLL_MS);
  }

  window.SpectrumNotes = {
    start: function (opts) {
      opts = opts || {};
      appName = opts.app === 'portal' ? 'portal' : 'company';
      userId = opts.userId == null ? '' : String(opts.userId);
      goUpdates = opts.goUpdates || null;
      ensureUi();
      if (started) {
        paintPages();
        maybePopup();
        return;
      }
      started = true;
      loadPack().then(function (data) {
        pack = data;
        paintPages();
        startPoll();
        if (window.SpectrumHelp && typeof SpectrumHelp.onTourEnd === 'function') {
          SpectrumHelp.onTourEnd(function () { maybePopup(); });
        }
        maybePopup();
      }).catch(function (err) {
        console.error('SpectrumNotes', err);
      });
    },
    paint: function () {
      paintPages();
    },
    hide: function () {
      if (card) card.hidden = true;
      if (dim) dim.hidden = true;
    }
  };
})();
