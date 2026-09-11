(function (global) {
  'use strict';

  var S = {
    api: null,
    admin: null,
    canUse: null,
    openSalesDoc: null,
    esc: function (v) {
      return String(v == null ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    },
    tab: 'lobby',
    rooms: [],
    roomId: null,
    room: null,
    messages: [],
    lastMsgId: 0,
    file: null,
    copilotPending: false,
    spectrumPending: false,
    sending: false,
    tempSeq: 0,
    aiName: 'Claude',
    users: [],
    unread: { total: 0, lobby: 0, direct: 0, orders: 0 },
    presence: {},
    dash: {
      roomId: null,
      messages: [],
      lastMsgId: 0,
      users: [],
      file: null,
      loaded: false,
      fetchGen: 0,
      userKey: '',
      sending: false
    },
    soOrderId: null,
    soRoomId: null,
    soLastMsgId: 0,
    soFile: null,
    soMessages: [],
    soSending: false,
    baseTitle: document.title || 'Company | Spectrum Display',
    booted: false,
    windowOpen: false,
    pageMode: false,
    pageView: 'list',
    hover: false,
    seeThrough: false,
    resizing: false,
    moving: false,
    splitting: false,
    listW: 100,
    rect: null,
    saveChatPrefs: null,
    getChatPrefs: null,
    timers: {},
    roomFetchGen: 0,
    threads: {},
    roomsInflight: null
  };

  var THREAD_MAX = 24;

  function $(id) { return document.getElementById(id); }
  function esc(v) { return S.esc(v); }

  function asPresence(raw) {
    if (!raw) return null;
    if (typeof raw === 'string') {
      return { lastSeenAt: raw, lastActiveAt: raw, status: 'online' };
    }
    return {
      lastSeenAt: raw.lastSeenAt || raw.last_seen_at || null,
      lastActiveAt: raw.lastActiveAt || raw.last_active_at || raw.lastSeenAt || raw.last_seen_at || null,
      status: raw.status || 'online'
    };
  }

  function presenceState(raw) {
    var p = asPresence(raw);
    if (!p || !p.lastSeenAt) return 'offline';
    var seen = new Date(p.lastSeenAt).getTime();
    if (!isFinite(seen) || Date.now() - seen >= 70000) return 'offline';
    if (p.status === 'busy') return 'busy';
    if (p.status === 'away') return 'away';
    var active = new Date(p.lastActiveAt || p.lastSeenAt).getTime();
    if (isFinite(active) && Date.now() - active >= 5 * 60 * 1000) return 'away';
    return 'online';
  }

  function statusLabel(state) {
    if (state === 'online') return 'Online';
    if (state === 'away') return 'Away';
    if (state === 'busy') return 'Busy';
    return 'Offline';
  }

  function initials(name, email) {
    var bits = String(name || email || '?').trim().split(/\s+/);
    var letters = (bits[0] || '?').charAt(0) + (bits[1] ? bits[1].charAt(0) : '');
    return letters.toUpperCase();
  }

  function setStatusMenuOpen(open, anchor) {
    var menu = $('dash-lobby-status-menu');
    var panel = $('dash-lobby');
    if (!menu || !panel) return;
    menu.hidden = !open;
    panel.querySelectorAll('.dash-lobby-user.is-open').forEach(function (el) {
      el.classList.remove('is-open');
    });
    if (!open || !anchor) return;
    anchor.classList.add('is-open');
    var panelBox = panel.getBoundingClientRect();
    var box = anchor.getBoundingClientRect();
    var top = box.bottom - panelBox.top + 4;
    var left = box.left - panelBox.left;
    menu.style.top = top + 'px';
    menu.style.left = Math.max(8, Math.min(left, panelBox.width - 150)) + 'px';
  }

  function hasChat() {
    try { return !!(S.canUse && S.canUse('chat')); } catch (e) { return false; }
  }

  function persistKey() {
    var id = S.admin && S.admin.id;
    return 'dash-chat-last-' + (id || '0');
  }

  function windowPrefsKey() {
    var id = S.admin && S.admin.id;
    return 'dash-chat-window-' + (id || '0');
  }

  function readLocalWindowPrefs() {
    try {
      var p = JSON.parse(localStorage.getItem(windowPrefsKey()) || 'null');
      if (p && p.width && p.height) return p;
    } catch (e) { /* ignore */ }
    return null;
  }

  function saveLast() {
    try {
      localStorage.setItem(persistKey(), JSON.stringify({
        roomId: S.roomId || null
      }));
    } catch (e) { /* ignore */ }
  }

  function loadLast() {
    try {
      var d = JSON.parse(localStorage.getItem(persistKey()) || '{}');
      if (d.roomId) S.roomId = Number(d.roomId);
    } catch (e) { /* ignore */ }
    applySavedWindowPrefs();
  }

  function applySavedWindowPrefs() {
    var p = null;
    try { p = S.getChatPrefs && S.getChatPrefs(); } catch (e) { p = null; }
    if (!p || !p.width || !p.height) p = readLocalWindowPrefs();
    if (!p || !p.width || !p.height) return;
    S.rect = {
      left: Number(p.left),
      top: Number(p.top),
      width: Number(p.width),
      height: Number(p.height)
    };
    if (p.listW) S.listW = Number(p.listW);
  }

  function restoreWindowPrefs() {
    applySavedWindowPrefs();
    if (S.windowOpen) applyRect(S.rect || defaultRect());
  }

  function saveWindowPrefs() {
    if (!S.rect) return;
    var payload = {
      left: Math.round(S.rect.left),
      top: Math.round(S.rect.top),
      width: Math.round(S.rect.width),
      height: Math.round(S.rect.height),
      listW: Math.round(S.listW || 100)
    };
    try { localStorage.setItem(windowPrefsKey(), JSON.stringify(payload)); } catch (e) { /* ignore */ }
    try { if (S.saveChatPrefs) S.saveChatPrefs(payload); } catch (e) { /* ignore */ }
  }

  function defaultRect() {
    var width = Math.min(450, Math.max(300, window.innerWidth - 32));
    var height = Math.min(350, Math.max(260, window.innerHeight - 88));
    return {
      left: 16,
      top: Math.max(8, window.innerHeight - height - 20),
      width: width,
      height: height
    };
  }

  function clampRect(r) {
    var minW = 300;
    var minH = 260;
    var pad = 8;
    var maxW = Math.max(minW, window.innerWidth - pad * 2);
    var maxH = Math.max(minH, window.innerHeight - pad * 2);
    var width = Math.max(minW, Math.min(Number(r && r.width) || minW, maxW));
    var height = Math.max(minH, Math.min(Number(r && r.height) || minH, maxH));
    var left = Number(r && r.left);
    var top = Number(r && r.top);
    if (!isFinite(left)) left = 16;
    if (!isFinite(top)) top = Math.max(pad, window.innerHeight - height - 20);
    left = Math.max(pad, Math.min(left, window.innerWidth - width - pad));
    top = Math.max(pad, Math.min(top, window.innerHeight - height - pad));
    return { left: left, top: top, width: width, height: height };
  }

  function isMobileChat() {
    return window.matchMedia('(max-width: 900px)').matches;
  }

  function clearPageRect(root) {
    if (!root) return;
    root.style.left = '';
    root.style.top = '';
    root.style.width = '';
    root.style.height = '';
    root.classList.remove('is-placed');
  }

  function applyRect(r) {
    var root = $('co-chat');
    if (!root || S.pageMode) return;
    S.rect = clampRect(r || S.rect || defaultRect());
    root.style.left = S.rect.left + 'px';
    root.style.top = S.rect.top + 'px';
    root.style.width = S.rect.width + 'px';
    root.style.height = S.rect.height + 'px';
    root.classList.add('is-placed');
    applyListW(S.listW);
  }

  var LIST_ICON_W = 92;
  var LIST_MIN_W = 56;
  var LIST_MAX_W = 360;

  function clampListW(px) {
    var winW = (S.rect && S.rect.width) || 450;
    var max = Math.min(LIST_MAX_W, Math.max(LIST_MIN_W, Math.floor(winW * 0.55) - 16));
    return Math.max(LIST_MIN_W, Math.min(Number(px) || 100, max));
  }

  function applyListW(px) {
    var root = $('co-chat');
    if (!root) return;
    S.listW = clampListW(px);
    var shell = root.querySelector('.co-chat-shell');
    if (shell) shell.style.setProperty('--co-chat-list-w', S.listW + 'px');
    if (S.pageMode) {
      root.classList.remove('is-icons', 'is-compact');
      return;
    }
    root.classList.toggle('is-icons', S.listW <= LIST_ICON_W);
    root.classList.toggle('is-compact', S.listW <= 128);
  }

  function bindSplit() {
    var handle = $('co-chat-split');
    var root = $('co-chat');
    if (!handle || !root) return;
    var drag = null;
    handle.addEventListener('mousedown', function (ev) {
      if (ev.button !== 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      drag = { x: ev.clientX, w: S.listW || 100 };
      S.splitting = true;
      S.hover = true;
      S.seeThrough = false;
      root.classList.add('is-resizing');
      root.classList.remove('is-idle');
      document.body.classList.add('chat-splitting');
    });
    document.addEventListener('mousemove', function (ev) {
      if (!drag) return;
      applyListW(drag.w + (ev.clientX - drag.x));
    });
    document.addEventListener('mouseup', function () {
      if (!drag) return;
      drag = null;
      S.splitting = false;
      root.classList.remove('is-resizing');
      document.body.classList.remove('chat-splitting');
      saveWindowPrefs();
      syncIdle();
    });
  }

  function bindResize() {
    var root = $('co-chat');
    if (!root) return;
    var drag = null;
    function beginDrag(ev, dir) {
      if (S.pageMode) return;
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      if (drag) return;
      ev.preventDefault();
      ev.stopPropagation();
      var start = S.rect || defaultRect();
      drag = {
        dir: dir,
        pointerId: ev.pointerId,
        x: ev.clientX,
        y: ev.clientY,
        left: start.left,
        top: start.top,
        width: start.width,
        height: start.height
      };
      S.resizing = dir !== 'move';
      S.moving = dir === 'move';
      S.hover = true;
      S.seeThrough = false;
      root.classList.toggle('is-resizing', S.resizing);
      root.classList.toggle('is-moving', S.moving);
      root.classList.toggle('is-idle', S.moving);
      document.body.classList.add('chat-resizing');
      if (ev.currentTarget && ev.currentTarget.setPointerCapture && ev.pointerId != null) {
        try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch (err) {}
      }
    }
    function onPointerMove(ev) {
      if (!drag) return;
      if (drag.pointerId != null && ev.pointerId !== drag.pointerId) return;
      var dx = ev.clientX - drag.x;
      var dy = ev.clientY - drag.y;
      if (drag.dir === 'move') {
        applyRect({
          left: drag.left + dx,
          top: drag.top + dy,
          width: drag.width,
          height: drag.height
        });
        return;
      }
      var next = { left: drag.left, top: drag.top, width: drag.width, height: drag.height };
      var right = drag.left + drag.width;
      var bottom = drag.top + drag.height;
      if (drag.dir.indexOf('e') !== -1) next.width = drag.width + dx;
      if (drag.dir.indexOf('s') !== -1) next.height = drag.height + dy;
      if (drag.dir.indexOf('w') !== -1) next.width = drag.width - dx;
      if (drag.dir.indexOf('n') !== -1) next.height = drag.height - dy;
      next = clampRect(next);
      if (drag.dir.indexOf('w') !== -1) next.left = Math.max(8, right - next.width);
      else next.left = drag.left;
      if (drag.dir.indexOf('n') !== -1) next.top = Math.max(8, bottom - next.height);
      else next.top = drag.top;
      applyRect(next);
    }
    function endDrag(ev) {
      if (!drag) return;
      if (ev && drag.pointerId != null && ev.pointerId !== drag.pointerId) return;
      drag = null;
      S.resizing = false;
      S.moving = false;
      root.classList.remove('is-resizing', 'is-moving');
      document.body.classList.remove('chat-resizing');
      saveWindowPrefs();
      syncIdle();
    }
    var head = root.querySelector('.co-chat-head');
    if (head) {
      head.addEventListener('pointerdown', function (ev) {
        if (ev.target.closest('#co-chat-close, #co-chat-back, a, input, textarea, select')) return;
        beginDrag(ev, 'move');
      });
    }
    root.querySelectorAll('.co-chat-resize').forEach(function (handle) {
      handle.addEventListener('pointerdown', function (ev) {
        beginDrag(ev, handle.getAttribute('data-resize') || 'se');
      });
    });
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', endDrag);
    document.addEventListener('pointercancel', endDrag);
    window.addEventListener('resize', function () {
      if (S.windowOpen) applyRect(S.rect || defaultRect());
    });
  }

  function isTyping() {
    var el = document.activeElement;
    if (!el) return false;
    return el.id === 'co-chat-input' || el.id === 'co-chat-search';
  }

  function pickerOpen() {
    return mentionOpen();
  }

  function pageIsEditing() {
    var body = document.body;
    if (!body) return false;
    if (/\b(inv|cc|vn|ca|ci|st|rl)-drawer-open\b/.test(body.className)) return true;
    if (body.classList.contains('dash-detail-open')) return true;
    if (body.classList.contains('so-invoice-float') || body.classList.contains('po-doc-float')) return true;
    if (document.querySelector('.cc-workspace.cc-detail-open')) return true;
    if (document.querySelector('.so-doc-open, .po-doc-open, .wp-form-open')) return true;
    var shown = ['rs-detail', 'wh-form', 'wh-transfer-form', 'form-wrap'];
    for (var i = 0; i < shown.length; i++) {
      var n = document.getElementById(shown[i]);
      if (n && !n.hidden && !n.classList.contains('hidden')) return true;
    }
    var el = document.activeElement;
    if (el && el.closest && el.closest('#inv-drawer, #cc-drawer, #vn-drawer, #ca-drawer, #ci-drawer, #st-drawer, #rl-drawer, #so-detail, #po-detail, #rs-detail, #wh-form, #wh-transfer-form, #product-form, #form-wrap')) {
      return true;
    }
    return false;
  }

  function pointOverChat(ev) {
    var root = $('co-chat');
    if (!root || !S.windowOpen) return false;
    var r = root.getBoundingClientRect();
    return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
  }

  function syncIdle() {
    var root = $('co-chat');
    if (!root || !S.windowOpen) return;
    if (S.pageMode) {
      root.classList.remove('is-idle');
      return;
    }
    if (S.moving) {
      root.classList.add('is-idle');
      return;
    }
    if (S.resizing || S.splitting || isTyping() || pickerOpen()) {
      root.classList.remove('is-idle');
      return;
    }
    root.classList.toggle('is-idle', !!S.seeThrough && !S.hover);
  }

  function syncNavOpen() {
    var on = !!S.windowOpen;
    ['header-chat', 'tabbar-chat'].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.classList.toggle('is-chat-open', on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function skipAutoOpenRoom() {
    return S.pageMode && S.pageView !== 'thread';
  }

  function syncPageView() {
    var root = $('co-chat');
    var back = $('co-chat-back');
    var thread = !!S.pageMode && S.pageView === 'thread';
    if (root) root.classList.toggle('is-thread', thread);
    if (back) back.hidden = !thread;
    if (S.pageMode && !thread) setWindowTitle('Messages');
  }

  function showChatList() {
    S.pageView = 'list';
    syncPageView();
  }

  function showChatThread() {
    S.pageView = 'thread';
    syncPageView();
  }

  async function openChatWindow() {
    if (!hasChat()) return;
    if (isMobileChat() && typeof S.onOpenPage === 'function' && !S.pageMode) {
      S.onOpenPage();
      return;
    }
    var root = $('co-chat');
    if (!root) return;
    S.pageMode = false;
    S.pageView = 'list';
    document.body.classList.remove('chat-page-on');
    root.hidden = false;
    root.classList.add('is-window', 'is-open');
    root.classList.remove('is-page', 'is-thread');
    if ($('co-chat-back')) $('co-chat-back').hidden = true;
    applyRect(S.rect || defaultRect());
    applyListW(S.listW);
    S.windowOpen = true;
    S.hover = true;
    S.seeThrough = false;
    syncIdle();
    syncNavOpen();
    if (S.rooms.length) renderRoomList();
    paintCachedOrLoading();
    loadRooms().catch(function () {});
  }

  async function openChatPage() {
    if (!hasChat()) return;
    var root = $('co-chat');
    if (!root) return;
    S.pageMode = true;
    S.pageView = 'list';
    document.body.classList.add('chat-page-on');
    root.hidden = false;
    root.classList.add('is-window', 'is-open', 'is-page');
    root.classList.remove('is-idle');
    clearPageRect(root);
    applyListW(S.listW);
    S.windowOpen = true;
    S.hover = true;
    S.seeThrough = false;
    syncPageView();
    syncIdle();
    syncNavOpen();
    if (S.rooms.length) renderRoomList();
    loadRooms().catch(function () {});
  }

  function closeChatPage() {
    if (!S.pageMode) return;
    closeChatWindow();
  }

  function closeChatWindow() {
    var root = $('co-chat');
    saveLast();
    S.windowOpen = false;
    S.hover = false;
    S.seeThrough = false;
    S.pageMode = false;
    S.pageView = 'list';
    document.body.classList.remove('chat-page-on');
    if (root) {
      root.hidden = true;
      root.classList.remove('is-open', 'is-idle', 'is-page', 'is-thread');
    }
    if ($('co-chat-back')) $('co-chat-back').hidden = true;
    setPlusMenuOpen(false);
    syncNavOpen();
  }

  function toggleChatWindow() {
    if (S.windowOpen) closeChatWindow();
    else openChatWindow().catch(function () {});
  }

  function fmtTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function linkify(text) {
    var s = esc(text);
    s = s.replace(/\[copilot-draft\|([^|\]]+)\|([^|\]]+)\|([^|\]]*)\|(\/company[^|\]]*)\]/g, function (_, token, kind, label, path) {
      return '<div class="co-chat-draft-card" data-copilot-token="' + token + '">' +
        '<span class="co-chat-share-kind">' + kind + ' · review</span>' +
        '<span class="co-chat-share-label">' + label + '</span>' +
        '<span class="co-chat-draft-actions">' +
        '<button type="button" class="co-chat-draft-open" data-chat-path="' + path + '">Open to review</button>' +
        '<button type="button" class="co-chat-draft-discard" data-copilot-discard="' + token + '">Discard</button>' +
        '</span></div>';
    });
    s = s.replace(/\[share\|([^|\]]+)\|([^|\]]+)\|(\/company[^|\]]*)\]/g, function (_, kind, label, path) {
      return '<button type="button" class="co-chat-share-card" data-chat-path="' + path + '">' +
        '<span class="co-chat-share-kind">' + kind + '</span>' +
        '<span class="co-chat-share-label">' + label + '</span></button>';
    });
    s = s.replace(/(https?:\/\/[^\s<]+)/g, function (url) {
      return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + '</a>';
    });
    s = s.replace(/\b(SO-\d+)\b/g, function (n) {
      return '<button type="button" class="co-chat-inline-link" data-chat-find-order="' + n + '">' + n + '</button>';
    });
    s = s.replace(/\b(SQ-\d+)\b/g, function (n) {
      return '<span class="co-chat-inline-ref">' + n + '</span>';
    });
    s = s.replace(/@(lead|deal)\/(\d+)/g, function (_, kind, id) {
      var path = kind === 'lead' ? '/company/crm/leads/' + id : '/company/crm/pipeline/' + id;
      return '<button type="button" class="co-chat-crm-chip" data-chat-path="' + path + '">@' + kind + '/' + id + '</button>';
    });
    return s.replace(/\n/g, '<br>');
  }

  function setBadge(el, n) {
    if (!el) return;
    n = Number(n) || 0;
    if (n > 0) {
      el.hidden = false;
      el.textContent = n > 99 ? '99+' : String(n);
    } else {
      el.hidden = true;
      el.textContent = '';
    }
  }

  function aiName() {
    return S.aiName || 'Claude';
  }

  function setAiName(name) {
    var next = String(name == null ? '' : name).replace(/\s+/g, ' ').trim() || 'Claude';
    next = next.slice(0, 40);
    if (S.aiName === next) return;
    S.aiName = next;
    if (S.room) {
      if ($('co-chat-main-sub')) $('co-chat-main-sub').textContent = roomSub(S.room);
      if ($('co-chat-input')) $('co-chat-input').placeholder = composerPlaceholder(S.room);
      if (S.room.kind === 'copilot') setWindowTitle(aiName());
    }
    renderRoomList();
    syncDashComposer();
    renderDashMessages();
  }

  function escapeRe(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function mentionsAi(text) {
    var name = escapeRe(aiName()).replace(/\\s+/g, '\\s+');
    return new RegExp('(?:^|\\s)@(?:' + name + '|spectrum\\s+ai|copilot)\\b', 'i').test(' ' + String(text || ''));
  }

  function isTempId(id) {
    return String(id || '').indexOf('tmp-') === 0;
  }

  function maxMsgId(messages, fallback) {
    return (messages || []).reduce(function (acc, x) {
      var n = Number(x && x.id);
      if (!isFinite(n) || n <= 0) return acc;
      return n > acc ? n : acc;
    }, fallback || 0);
  }

  function mergeMessages(existing, incoming) {
    var out = [];
    var seen = {};
    function push(msg) {
      if (!msg || msg.id == null || msg.id === '') return;
      var key = String(msg.id);
      if (seen[key] != null) {
        var i = seen[key];
        if (!isTempId(msg.id) || isTempId(out[i].id)) out[i] = msg;
        return;
      }
      seen[key] = out.length;
      out.push(msg);
    }
    (existing || []).forEach(push);
    (incoming || []).forEach(push);
    return out.filter(function (msg) {
      if (!isTempId(msg.id)) return true;
      return !out.some(function (other) {
        return other !== msg && !isTempId(other.id) &&
          String(other.body || '') === String(msg.body || '') &&
          Number(other.userId) === Number(msg.userId);
      });
    });
  }

  function replaceTemp(list, tempId, real) {
    var found = false;
    var next = (list || []).map(function (m) {
      if (String(m.id) === String(tempId)) {
        found = true;
        return real || m;
      }
      return m;
    });
    if (real && !found) next.push(real);
    return mergeMessages(next, []);
  }

  function dropTemp(list, tempId) {
    return (list || []).filter(function (m) { return String(m.id) !== String(tempId); });
  }

  function selfUser() {
    var a = S.admin || {};
    return {
      id: a.id || null,
      name: a.name || a.email || 'You',
      email: a.email || '',
      role: a.role || ''
    };
  }

  function optimisticMessage(body, file, roomId) {
    S.tempSeq = (S.tempSeq || 0) + 1;
    var image = !!(file && file.type && String(file.type).indexOf('image/') === 0);
    return {
      id: 'tmp-' + Date.now() + '-' + S.tempSeq,
      roomId: roomId,
      userId: S.admin && S.admin.id,
      user: selfUser(),
      body: body,
      attachmentUrl: null,
      attachmentName: file ? (file.name || 'Attachment') : null,
      attachmentType: file ? (image ? 'image' : 'file') : 'none',
      createdAt: new Date().toISOString(),
      editedAt: null,
      isSystem: false,
      isCopilot: false,
      isSpectrumAi: false,
      isDeleted: false,
      isPending: true
    };
  }

  function setComposerBusy(formId, busy) {
    var form = $(formId);
    if (!form) return;
    form.classList.toggle('is-sending', !!busy);
    var btn = form.querySelector('.co-chat-send');
    if (btn) btn.disabled = !!busy;
  }

  function postChatMessage(roomId, body, file) {
    var fd = new FormData();
    fd.append('body', body);
    if (file) fd.append('file', file);
    return S.api('/api/admin/chat/rooms/' + roomId + '/messages', { method: 'POST', body: fd });
  }

  function appendOptimistic(temp, roomId) {
    if (Number(S.roomId) === Number(roomId)) {
      S.messages = mergeMessages(S.messages, [temp]);
      saveThread(roomId, { room: S.room, messages: S.messages });
      if (S.windowOpen) renderMessages('co-chat-messages', S.messages);
    } else {
      var openCached = getThread(roomId);
      if (openCached) {
        saveThread(roomId, { room: openCached.room, messages: mergeMessages(openCached.messages, [temp]) });
      }
    }
    if (Number(S.dash.roomId) === Number(roomId)) {
      S.dash.messages = mergeMessages(S.dash.messages, [temp]);
      saveThread(roomId, {
        room: (getThread(roomId) && getThread(roomId).room) || { id: roomId, kind: 'lobby', title: 'Lobby' },
        messages: S.dash.messages
      });
      renderDashMessages();
    }
    if (Number(S.soRoomId) === Number(roomId)) {
      S.soMessages = mergeMessages(S.soMessages, [temp]);
      renderMessages('so-chat-messages', S.soMessages);
    }
  }

  function finishOptimistic(tempId, real, roomId) {
    if (Number(S.roomId) === Number(roomId)) {
      S.messages = real ? replaceTemp(S.messages, tempId, real) : dropTemp(S.messages, tempId);
      S.lastMsgId = maxMsgId(S.messages, S.lastMsgId);
      saveThread(roomId, { room: S.room, messages: S.messages });
      if (S.windowOpen) renderMessages('co-chat-messages', S.messages);
    } else {
      var openCached = getThread(roomId);
      if (openCached) {
        var next = real ? replaceTemp(openCached.messages, tempId, real) : dropTemp(openCached.messages, tempId);
        saveThread(roomId, { room: openCached.room, messages: next });
      }
    }
    if (Number(S.dash.roomId) === Number(roomId)) {
      S.dash.messages = real ? replaceTemp(S.dash.messages, tempId, real) : dropTemp(S.dash.messages, tempId);
      S.dash.lastMsgId = maxMsgId(S.dash.messages, S.dash.lastMsgId);
      saveThread(roomId, {
        room: (getThread(roomId) && getThread(roomId).room) || { id: roomId, kind: 'lobby', title: 'Lobby' },
        messages: S.dash.messages
      });
      renderDashMessages();
    }
    if (Number(S.soRoomId) === Number(roomId)) {
      S.soMessages = real ? replaceTemp(S.soMessages, tempId, real) : dropTemp(S.soMessages, tempId);
      S.soLastMsgId = maxMsgId(S.soMessages, S.soLastMsgId);
      renderMessages('so-chat-messages', S.soMessages);
    }
  }

  function restoreComposer(inputId, body) {
    var el = $(inputId);
    if (!el || el.value) return;
    el.value = body || '';
  }

  function roomTitle(room) {
    if (!room) return '';
    if (room.kind === 'dm' && room.otherUser) {
      return room.otherUser.name || room.otherUser.email || 'Direct message';
    }
    return room.title || 'Lobby';
  }

  function roomSub(room) {
    if (!room) return '';
    if (room.kind === 'copilot') return 'I draft. You review and save.';
    if (room.kind === 'lobby') return 'Everyone at Spectrum can see this. Type @' + aiName() + ' to ask.';
    if (room.kind === 'dm' && room.otherUser) {
      return 'Only you and ' + (room.otherUser.name || 'them') + ' can see this.';
    }
    if (room.kind === 'order') {
      var parts = [];
      if (room.customerName) parts.push(room.customerName);
      parts.push('Staff only · customer cannot see this.');
      if (room.orderStatus) parts.push(room.orderStatus);
      return parts.join(' · ');
    }
    return '';
  }

  function composerPlaceholder(room) {
    if (!room) return 'Message…';
    if (room.kind === 'copilot') return 'Ask ' + aiName() + ' to draft something…';
    if (room.kind === 'lobby') return 'Message the team…';
    if (room.kind === 'dm' && room.otherUser) {
      var first = String(room.otherUser.name || 'them').split(/\s+/)[0];
      return 'Message ' + first + '…';
    }
    if (room.kind === 'order') return 'Message about ' + (room.title || 'this order') + '…';
    return 'Message…';
  }

  async function refreshUnread() {
    if (!hasChat()) return;
    try {
      var data = await S.api('/api/admin/chat/unread');
      S.unread = data.unread || { total: 0, lobby: 0, direct: 0, orders: 0 };
      setBadge($('co-chat-unread-badge'), S.unread.total);
      setBadge($('nav-chat-unread'), S.unread.total);
      setBadge($('tabbar-chat-unread'), S.unread.total);
      var n = Number(S.unread.total || 0);
      document.title = n > 0 ? '(' + n + ') ' + S.baseTitle : S.baseTitle;
    } catch (e) { /* ignore */ }
  }

  function unreadLabel(n) {
    n = Number(n) || 0;
    if (n <= 0) return '';
    return n > 99 ? '99+' : String(n);
  }

  function roomIcon(room) {
    var title = roomTitle(room);
    var cls = 'co-chat-avatar';
    var label = '';
    if (room.kind === 'lobby') {
      cls += ' is-lobby';
      label = 'L';
    } else if (room.kind === 'copilot') {
      cls += ' is-copilot';
      label = (aiName() || 'C').charAt(0).toUpperCase();
    } else if (room.kind === 'order') {
      cls += ' is-order';
      label = String(title || 'SO').replace(/^[A-Za-z]+-/, '').slice(-2) || 'SO';
    } else {
      var parts = String(title || '?').trim().split(/\s+/);
      label = (parts[0] || '?').charAt(0);
      if (parts[1]) label += parts[1].charAt(0);
      label = label.toUpperCase();
    }
    var count = unreadLabel(room.unreadCount);
    var badge = count
      ? '<span class="co-chat-unread-count" aria-label="' + count + ' new messages">' + count + '</span>'
      : '';
    return '<span class="co-chat-avatar-wrap">' +
      '<span class="' + cls + '" aria-hidden="true">' + esc(label) + '</span>' +
      badge + '</span>';
  }

  function renderRoomList() {
    var host = $('co-chat-room-list');
    if (!host) return;
    if (!S.rooms.length) {
      host.innerHTML = '<p class="co-chat-empty">No contacts.</p>';
      return;
    }
    host.innerHTML = S.rooms.map(function (room) {
      var on = room.id && Number(room.id) === Number(S.roomId) ? ' is-on' : '';
      if (room.pinned) on += ' is-pin';
      if (Number(room.unreadCount) > 0) on += ' is-unread';
      var presence = '';
      var other = room.otherUser;
      if (room.kind === 'dm' && other) {
        var state = presenceState(S.presence[other.id]);
        presence = '<span class="co-chat-presence is-' + state + '" title="' + esc(statusLabel(state)) + '"></span>';
      }
      var title = roomTitle(room);
      var key = room.id
        ? 'data-room-id="' + room.id + '"'
        : 'data-user-id="' + ((room.contactUserId || (other && other.id)) || '') + '"';
      return '<button type="button" class="co-chat-room' + on + '" ' + key + ' title="' + esc(title) + '">' +
        roomIcon(room) +
        '<span class="co-chat-room-copy">' +
        '<span class="co-chat-room-top"><span class="co-chat-room-title">' + presence + esc(title) +
        '</span></span>' +
        '<span class="co-chat-room-time">' + esc(fmtTime(room.lastMessageAt)) + '</span>' +
        '</span></button>';
    }).join('');
  }

  function hostWantsPending(hostId) {
    if (hostId === 'co-chat-messages') return !!(S.copilotPending || S.spectrumPending);
    if (hostId === 'dash-lobby-messages') return !!S.spectrumPending;
    return false;
  }

  function renderMessages(hostId, messages) {
    var host = $(hostId);
    if (!host) return;
    if (!messages.length && !hostWantsPending(hostId)) {
      host.innerHTML = '<p class="co-chat-empty">No messages yet.</p>';
      return;
    }
    var selfId = S.admin && S.admin.id;
    host.innerHTML = messages.map(function (msg) {
      if (msg.isDeleted) {
        return '<div class="co-chat-msg is-deleted" data-msg-id="' + msg.id + '"><em>Message removed.</em></div>';
      }
      if (msg.isSystem) {
        return '<div class="co-chat-msg is-system" data-msg-id="' + msg.id + '">' + linkify(msg.body || '') + '</div>';
      }
      if (msg.isSpectrumAi || msg.isCopilot) {
        var bot = (msg.user && msg.user.name) || aiName();
        var cls = msg.isCopilot ? 'is-copilot' : 'is-spectrum-ai';
        return '<div class="co-chat-msg ' + cls + '" data-msg-id="' + msg.id + '">' +
          '<div class="co-chat-msg-meta"><strong>' + esc(bot) + '</strong><span>' +
          esc(fmtTime(msg.createdAt)) + '</span></div>' +
          (msg.body ? '<div class="co-chat-msg-body">' + linkify(msg.body) + '</div>' : '') +
          '</div>';
      }
      var mine = Number(msg.userId) === Number(selfId);
      var name = (msg.user && msg.user.name) || 'Staff';
      var attach = '';
      if (msg.attachmentUrl) {
        if (msg.attachmentType === 'image') {
          attach = '<div class="co-chat-attach-preview"><a href="' + esc(msg.attachmentUrl) +
            '" target="_blank" rel="noopener"><img src="' + esc(msg.attachmentUrl) + '" alt=""></a></div>';
        } else {
          attach = '<div class="co-chat-attach-file"><a href="' + esc(msg.attachmentUrl) +
            '" target="_blank" rel="noopener">' + esc(msg.attachmentName || 'Attachment') + '</a></div>';
        }
      } else if (msg.attachmentName) {
        attach = '<div class="co-chat-attach-file">' + esc(msg.attachmentName) + '</div>';
      }
      var actions = mine && !msg.isPending
        ? '<span class="co-chat-msg-actions"><button type="button" data-chat-del="' + msg.id + '">Remove</button></span>'
        : '';
      return '<div class="co-chat-msg' + (mine ? ' is-mine' : '') + (msg.isPending ? ' is-sending-msg' : '') +
        '" data-msg-id="' + msg.id + '">' +
        '<div class="co-chat-msg-meta"><strong>' + esc(name) + '</strong><span>' +
        esc(fmtTime(msg.createdAt)) + (msg.editedAt ? ' · edited' : '') + '</span>' + actions + '</div>' +
        (msg.body ? '<div class="co-chat-msg-body">' + linkify(msg.body) + '</div>' : '') +
        attach + '</div>';
    }).join('') + pendingHtml(hostId);
    host.scrollTop = host.scrollHeight;
  }

  function pendingHtml(hostId) {
    if (hostId === 'co-chat-messages' && S.copilotPending) {
      return '<div class="co-chat-msg is-copilot is-pending"><div class="co-chat-msg-meta"><strong>' + esc(aiName()) + '</strong></div>' +
        '<div class="co-chat-msg-body">Working on a draft…</div></div>';
    }
    if ((hostId === 'co-chat-messages' || hostId === 'dash-lobby-messages') && S.spectrumPending) {
      return '<div class="co-chat-msg is-spectrum-ai is-pending"><div class="co-chat-msg-meta"><strong>' + esc(aiName()) + '</strong></div>' +
        '<div class="co-chat-msg-body">Thinking…</div></div>';
    }
    return '';
  }

  function clearLocalUnread(roomId) {
    (S.rooms || []).forEach(function (room) {
      if (Number(room.id) === Number(roomId)) room.unreadCount = 0;
    });
  }

  function threadKey(roomId) {
    return String(Number(roomId));
  }

  function getThread(roomId) {
    if (!roomId) return null;
    return S.threads[threadKey(roomId)] || null;
  }

  function pruneThreads() {
    var keys = Object.keys(S.threads);
    if (keys.length <= THREAD_MAX) return;
    keys.sort(function (a, b) {
      return (S.threads[a].accessedAt || 0) - (S.threads[b].accessedAt || 0);
    });
    keys.slice(0, keys.length - THREAD_MAX).forEach(function (key) {
      delete S.threads[key];
    });
  }

  function saveThread(roomId, patch) {
    if (!roomId) return null;
    var key = threadKey(roomId);
    var cur = S.threads[key] || { room: null, messages: [], lastMsgId: 0, accessedAt: 0, ready: false };
    if (patch.room) cur.room = patch.room;
    if (patch.messages) {
      cur.messages = patch.messages;
      cur.lastMsgId = maxMsgId(patch.messages, patch.lastMsgId || 0);
      cur.ready = true;
    } else if (patch.lastMsgId != null) {
      cur.lastMsgId = patch.lastMsgId;
    }
    if (patch.ready) cur.ready = true;
    cur.accessedAt = Date.now();
    S.threads[key] = cur;
    pruneThreads();
    return cur;
  }

  function rememberCurrentThread() {
    if (!S.roomId || !S.room) return;
    saveThread(S.roomId, { room: S.room, messages: S.messages || [], lastMsgId: S.lastMsgId });
  }

  function roomFromList(roomId) {
    return (S.rooms || []).find(function (room) {
      return room && Number(room.id) === Number(roomId);
    }) || null;
  }

  function paintRoomChrome(room) {
    S.room = room || S.room;
    setWindowTitle(roomTitle(S.room));
    if ($('co-chat-main-sub')) $('co-chat-main-sub').textContent = roomSub(S.room);
    if ($('co-chat-input')) $('co-chat-input').placeholder = composerPlaceholder(S.room);
    var openBtn = $('co-chat-open-order');
    if (!openBtn) return;
    if (S.room && S.room.kind === 'order' && S.room.salesOrderId) {
      openBtn.hidden = false;
      openBtn.dataset.orderId = S.room.salesOrderId;
    } else {
      openBtn.hidden = true;
      delete openBtn.dataset.orderId;
    }
  }

  function applyPendingFlags(room, messages) {
    var lastId = maxMsgId(messages, 0);
    if (room && room.kind === 'copilot') {
      var hasCopilot = (messages || []).some(function (m) {
        return m.isCopilot && Number(m.id) === lastId;
      });
      if (hasCopilot) S.copilotPending = false;
    } else {
      S.copilotPending = false;
    }
    if (room && room.kind === 'lobby') {
      var hasAi = (messages || []).some(function (m) {
        return m.isSpectrumAi && Number(m.id) === lastId;
      });
      if (hasAi) S.spectrumPending = false;
    } else {
      S.spectrumPending = false;
    }
  }

  function applyThread(roomId, cached, opts) {
    opts = opts || {};
    S.roomId = Number(roomId);
    S.room = cached.room || S.room;
    S.messages = cached.messages || [];
    S.lastMsgId = cached.lastMsgId || maxMsgId(S.messages, 0);
    applyPendingFlags(S.room, S.messages);
    paintRoomChrome(S.room);
    if (S.pageMode && opts.showThread !== false) showChatThread();
    renderMessages('co-chat-messages', S.messages);
    renderRoomList();
  }

  function paintCachedOrLoading() {
    var cached = S.roomId ? getThread(S.roomId) : null;
    if (cached && cached.ready) {
      applyThread(S.roomId, cached, { showThread: false });
      return;
    }
    if (S.messages.length) {
      paintRoomChrome(S.room);
      renderMessages('co-chat-messages', S.messages);
      return;
    }
    var listed = S.roomId ? roomFromList(S.roomId) : null;
    if (listed) {
      S.room = listed;
      paintRoomChrome(listed);
    }
    if ($('co-chat-messages')) {
      $('co-chat-messages').innerHTML = '<p class="co-chat-empty">Loading…</p>';
    }
  }

  async function refreshThread(roomId, gen) {
    var data = await S.api('/api/admin/chat/rooms/' + roomId + '/messages?limit=100');
    var cached = getThread(roomId);
    var temps = ((cached && cached.messages) || []).filter(function (m) { return isTempId(m.id); });
    if (Number(S.roomId) === Number(roomId)) {
      temps = mergeMessages(temps, (S.messages || []).filter(function (m) { return isTempId(m.id); }));
    }
    var merged = mergeMessages(data.messages || [], temps);
    saveThread(roomId, { room: data.room, messages: merged });
    if (gen && gen !== S.roomFetchGen) return;
    if (Number(S.roomId) !== Number(roomId)) return;
    S.room = data.room;
    S.messages = merged;
    S.lastMsgId = maxMsgId(S.messages, 0);
    applyPendingFlags(S.room, S.messages);
    paintRoomChrome(S.room);
    renderMessages('co-chat-messages', S.messages);
    clearLocalUnread(S.roomId);
    renderRoomList();
    S.api('/api/admin/chat/rooms/' + S.roomId + '/read', { method: 'POST' })
      .then(function () { refreshUnread(); })
      .catch(function () {});
  }

  function prefetchChat() {
    if (prefetchChat.started || !hasChat()) return;
    prefetchChat.started = true;
    loadRooms().catch(function () {});
  }

  async function loadRooms() {
    if (S.roomsInflight) return S.roomsInflight;
    S.roomsInflight = loadRoomsBody().finally(function () { S.roomsInflight = null; });
    return S.roomsInflight;
  }

  async function loadRoomsBody() {
    var q = ($('co-chat-search') && $('co-chat-search').value) || '';
    var data = await S.api('/api/admin/chat/rooms?tab=contacts' +
      '&q=' + encodeURIComponent(q));
    S.rooms = data.rooms || [];
    renderRoomList();
    if (!S.roomId && S.rooms.length) {
      if (skipAutoOpenRoom()) return;
      var first = S.rooms[0];
      if (first && first.id) await openRoom(first.id);
      return;
    }
    if (!S.roomId) {
      renderEmptyMain();
      return;
    }
    var still = S.rooms.some(function (r) { return r.id && Number(r.id) === Number(S.roomId); });
    var cached = getThread(S.roomId);
    var haveThread = !!(S.room && Number(S.room.id) === Number(S.roomId) && (S.messages.length || (cached && cached.ready)));
    if (!haveThread && cached && cached.ready) {
      if (!skipAutoOpenRoom()) applyThread(S.roomId, cached, { showThread: false });
      haveThread = true;
    }
    if (!still) {
      try {
        if (skipAutoOpenRoom()) {
          S.roomId = null;
          S.room = null;
          S.messages = [];
          renderEmptyMain();
          return;
        }
        await openRoom(S.roomId);
      } catch (e) {
        S.roomId = null;
        S.room = null;
        S.messages = [];
        var fallback = S.rooms[0];
        if (fallback && fallback.id && !skipAutoOpenRoom()) await openRoom(fallback.id);
        else renderEmptyMain();
      }
    } else if (!haveThread) {
      if (skipAutoOpenRoom()) {
        refreshThread(S.roomId, S.roomFetchGen).catch(function () {});
        return;
      }
      await openRoom(S.roomId);
    } else {
      renderRoomList();
    }
  }

  function setWindowTitle(name) {
    var title = name || 'Lobby';
    if ($('co-chat-head-title')) $('co-chat-head-title').textContent = title;
    if ($('co-chat-main-title')) $('co-chat-main-title').textContent = title;
  }

  function renderEmptyMain() {
    setWindowTitle('Lobby');
    if ($('co-chat-main-sub')) $('co-chat-main-sub').textContent = '';
    $('co-chat-messages').innerHTML = '<p class="co-chat-empty">No messages yet.</p>';
    $('co-chat-open-order').hidden = true;
    $('co-chat-input').placeholder = 'Message…';
  }

  async function openRoom(roomId) {
    roomId = Number(roomId);
    if (!roomId) return;
    var same = Number(S.roomId) === roomId && S.room;
    var cached = getThread(roomId);
    if (same && (S.messages.length || (cached && cached.ready))) {
      if (S.pageMode) showChatThread();
      refreshThread(roomId, S.roomFetchGen).catch(function () {});
      return;
    }
    rememberCurrentThread();
    var gen = (S.roomFetchGen = (S.roomFetchGen || 0) + 1);
    S.roomId = roomId;
    saveLast();
    renderRoomList();
    cached = getThread(roomId);
    if (cached && cached.ready) {
      applyThread(roomId, cached);
      clearLocalUnread(roomId);
      refreshThread(roomId, gen).catch(function () {});
      return;
    }
    if (S.pageMode) showChatThread();
    var listed = roomFromList(roomId);
    S.room = listed || { id: roomId };
    S.messages = [];
    S.lastMsgId = 0;
    paintRoomChrome(S.room);
    if ($('co-chat-messages')) {
      $('co-chat-messages').innerHTML = '<p class="co-chat-empty">Loading…</p>';
    }
    await refreshThread(roomId, gen);
  }

  function clearFile() {
    S.file = null;
    if ($('co-chat-file')) $('co-chat-file').value = '';
    if ($('co-chat-attach-name')) {
      $('co-chat-attach-name').hidden = true;
      $('co-chat-attach-name').textContent = '';
    }
  }

  async function sendPayload(body, file) {
    if (S.sending) return;
    if (!S.roomId) {
      await loadRooms();
      if (S.rooms[0]) await openRoom(S.rooms[0].id);
    }
    if (!S.roomId) throw new Error('Open a chat first.');
    body = String(body || '').trim();
    if (!body && !file) return;
    S.sending = true;
    setComposerBusy('co-chat-composer', true);
    var roomId = S.roomId;
    var kind = S.room && S.room.kind;
    var temp = optimisticMessage(body, file, roomId);
    var heldFile = file;
    if ($('co-chat-input')) $('co-chat-input').value = '';
    clearFile();
    if (kind === 'copilot') S.copilotPending = true;
    if (kind === 'lobby' && mentionsAi(body)) S.spectrumPending = true;
    appendOptimistic(temp, roomId);
    try {
      var data = await postChatMessage(roomId, body, heldFile);
      finishOptimistic(temp.id, data && data.message, roomId);
    } catch (err) {
      finishOptimistic(temp.id, null, roomId);
      if (kind === 'copilot') S.copilotPending = false;
      if (kind === 'lobby') S.spectrumPending = false;
      restoreComposer('co-chat-input', body);
      throw err;
    } finally {
      S.sending = false;
      setComposerBusy('co-chat-composer', false);
    }
  }

  async function sendMain(ev) {
    ev.preventDefault();
    if (S.sending) return;
    var body = String(($('co-chat-input') && $('co-chat-input').value) || '').trim();
    if (!body && !S.file) return;
    await sendPayload(body, S.file);
  }

  async function pollOpenRoom() {
    if (document.hidden || !S.roomId || !hasChat() || !S.windowOpen) return;
    try {
      var data = await S.api('/api/admin/chat/rooms/' + S.roomId + '/messages?afterId=' + S.lastMsgId + '&limit=50');
      var msgs = data.messages || [];
      if (!msgs.length) return;
      S.messages = mergeMessages(S.messages, msgs);
      S.lastMsgId = maxMsgId(S.messages, S.lastMsgId);
      saveThread(S.roomId, { room: S.room, messages: S.messages });
      if (Number(S.dash.roomId) === Number(S.roomId)) {
        S.dash.messages = mergeMessages(S.dash.messages, msgs);
        S.dash.lastMsgId = maxMsgId(S.dash.messages, S.dash.lastMsgId);
        renderDashMessages();
      }
      if (S.room && S.room.kind === 'copilot' && msgs.some(function (m) { return m.isCopilot; })) {
        S.copilotPending = false;
      }
      if (S.room && S.room.kind === 'lobby' && msgs.some(function (m) { return m.isSpectrumAi; })) {
        S.spectrumPending = false;
      }
      renderMessages('co-chat-messages', S.messages);
      S.api('/api/admin/chat/rooms/' + S.roomId + '/read', { method: 'POST' }).catch(function () {});
      clearLocalUnread(S.roomId);
      renderRoomList();
      refreshUnread();
    } catch (e) { /* ignore */ }
  }

  async function startDm(userId) {
    var data = await S.api('/api/admin/chat/dm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: Number(userId) })
    });
    await loadRooms();
    if (data.room) await openRoom(data.room.id);
  }

  async function handleDeepLink() {
    var params = new URLSearchParams(location.search);
    var chat = params.get('chat') || (location.hash === '#chat' ? 'lobby' : '');
    if (!chat) return;
    await openChatWindow();
    if (chat === 'dm' && params.get('user_id')) {
      await startDm(params.get('user_id'));
    } else if (chat === 'order' && params.get('order_id')) {
      var data = await S.api('/api/admin/chat/rooms/order/' + params.get('order_id'));
      await loadRooms();
      if (data.room) await openRoom(data.room.id);
    } else if (chat === 'copilot') {
      await loadRooms();
      var copilot = S.rooms.find(function (r) { return r.kind === 'copilot'; });
      if (copilot && copilot.id) await openRoom(copilot.id);
    } else {
      await loadRooms();
    }
  }

  function bindSoTabs() {
    document.querySelectorAll('#so-doc-tabs [data-so-pane]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var pane = btn.getAttribute('data-so-pane');
        document.querySelectorAll('#so-doc-tabs [data-so-pane]').forEach(function (b) {
          b.classList.toggle('is-on', b === btn);
        });
        var doc = document.querySelector('[data-so-pane-panel="doc"]');
        var chat = document.querySelector('[data-so-pane-panel="chat"]');
        var side = $('so-doc-side');
        if (doc) doc.hidden = pane !== 'doc';
        if (side) side.hidden = pane !== 'doc';
        if (chat) chat.hidden = pane !== 'chat';
        if (pane === 'chat') {
          var orderId = ($('so-id') && $('so-id').value) || S.soOrderId;
          if (orderId) openOrderChat(orderId);
        }
      });
    });
  }

  async function openOrderChat(orderId) {
    if (!hasChat() || !orderId) return;
    S.soOrderId = orderId;
    var data = await S.api('/api/admin/chat/rooms/order/' + orderId);
    if (!data.room) return;
    S.soRoomId = data.room.id;
    $('so-chat-title').textContent = roomTitle(data.room);
    $('so-chat-sub').textContent = roomSub(data.room);
    var msgs = await S.api('/api/admin/chat/rooms/' + S.soRoomId + '/messages?limit=100');
    S.soMessages = msgs.messages || [];
    S.soLastMsgId = maxMsgId(S.soMessages, 0);
    renderMessages('so-chat-messages', S.soMessages);
    try { await S.api('/api/admin/chat/rooms/' + S.soRoomId + '/read', { method: 'POST' }); } catch (e) { /* ignore */ }
    var tab = $('so-chat-tab');
    if (tab) tab.textContent = 'Chat';
    startSoPoll();
  }

  function startSoPoll() {
    if (S.timers.soPoll) clearInterval(S.timers.soPoll);
    S.timers.soPoll = setInterval(async function () {
      if (document.hidden || !S.soRoomId) return;
      try {
        var data = await S.api('/api/admin/chat/rooms/' + S.soRoomId + '/messages?afterId=' + S.soLastMsgId + '&limit=50');
        var msgs = data.messages || [];
        if (!msgs.length) return;
        S.soMessages = mergeMessages(S.soMessages, msgs);
        S.soLastMsgId = maxMsgId(S.soMessages, S.soLastMsgId);
        renderMessages('so-chat-messages', S.soMessages);
        await S.api('/api/admin/chat/rooms/' + S.soRoomId + '/read', { method: 'POST' });
      } catch (e) { /* ignore */ }
    }, 3000);
  }

  async function sendSo(ev) {
    ev.preventDefault();
    if (S.soSending || !S.soRoomId) return;
    var body = String(($('so-chat-input') && $('so-chat-input').value) || '').trim();
    if (!body && !S.soFile) return;
    S.soSending = true;
    setComposerBusy('so-chat-composer', true);
    var roomId = S.soRoomId;
    var heldFile = S.soFile;
    var temp = optimisticMessage(body, heldFile, roomId);
    if ($('so-chat-input')) $('so-chat-input').value = '';
    S.soFile = null;
    if ($('so-chat-file')) $('so-chat-file').value = '';
    if ($('so-chat-attach-name')) {
      $('so-chat-attach-name').hidden = true;
      $('so-chat-attach-name').textContent = '';
    }
    appendOptimistic(temp, roomId);
    try {
      var data = await postChatMessage(roomId, body, heldFile);
      finishOptimistic(temp.id, data && data.message, roomId);
    } catch (err) {
      finishOptimistic(temp.id, null, roomId);
      restoreComposer('so-chat-input', body);
      throw err;
    } finally {
      S.soSending = false;
      setComposerBusy('so-chat-composer', false);
    }
  }

  function plusMenu() { return $('co-chat-plus-menu'); }

  function plusMenuOpen() {
    var menu = plusMenu();
    return !!(menu && !menu.hidden);
  }

  function setPlusMenuOpen(open) {
    var menu = plusMenu();
    var btn = $('co-chat-plus');
    if (!menu || !btn) return;
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) fillPlusMenu();
  }

  function fillPlusMenu() {
    var ctx = { item: null, tab: null };
    try { ctx = (S.getShareContext && S.getShareContext()) || ctx; } catch (e) {}
    var itemBtn = $('co-chat-plus-item');
    var tabBtn = $('co-chat-plus-tab');
    function label(title, hint) {
      return title + (hint ? '<span class="co-chat-plus-hint">' + esc(hint) + '</span>' : '');
    }
    if (itemBtn) {
      itemBtn.disabled = !ctx.item;
      itemBtn.innerHTML = label('Link current item', ctx.item ? (ctx.item.kind + ' · ' + ctx.item.label) : 'Nothing in focus');
    }
    if (tabBtn) {
      tabBtn.disabled = !ctx.tab;
      tabBtn.innerHTML = label('Link current tab', ctx.tab ? ctx.tab.label : '');
    }
  }

  function shareToken(share) {
    if (!share || !share.path) return '';
    var kind = String(share.kind || 'Link').replace(/\|/g, '/');
    var label = String(share.label || share.path).replace(/\|/g, '/');
    return '[share|' + kind + '|' + label + '|' + share.path + ']';
  }

  async function sendShare(which) {
    var ctx = { item: null, tab: null };
    try { ctx = (S.getShareContext && S.getShareContext()) || ctx; } catch (e) {}
    var share = which === 'tab' ? ctx.tab : ctx.item;
    if (!share) throw new Error(which === 'tab' ? 'No tab to link.' : 'Nothing in focus to link.');
    await sendPayload(shareToken(share), null);
  }

  function loadHtml2Canvas() {
    if (global.html2canvas) return Promise.resolve(global.html2canvas);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      s.onload = function () {
        if (global.html2canvas) resolve(global.html2canvas);
        else reject(new Error('Could not load screenshot tool.'));
      };
      s.onerror = function () { reject(new Error('Could not load screenshot tool.')); };
      document.head.appendChild(s);
    });
  }

  function canvasToPngFile(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (!blob) {
          reject(new Error('Could not capture screenshot.'));
          return;
        }
        var stamp = new Date();
        var name = 'Screenshot-' + stamp.getFullYear() +
          '-' + String(stamp.getMonth() + 1).padStart(2, '0') +
          '-' + String(stamp.getDate()).padStart(2, '0') + '.png';
        resolve(new File([blob], name, { type: 'image/png' }));
      }, 'image/png');
    });
  }

  async function sendScreenshot() {
    var root = $('co-chat');
    var h2c = await loadHtml2Canvas();
    var target = document.getElementById('dash-panel') || document.body;
    if (root) root.style.visibility = 'hidden';
    await new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });
    try {
      var canvas = await h2c(target, {
        scale: 0.6,
        logging: false,
        useCORS: true,
        backgroundColor: '#eef1f6',
        ignoreElements: function (el) {
          return !!(el && (el.id === 'co-chat' || (el.closest && el.closest('#co-chat'))));
        }
      });
      var file = await canvasToPngFile(canvas);
      await sendPayload('', file);
    } finally {
      if (root) root.style.visibility = '';
    }
  }

  function bindPlusMenu() {
    var btn = $('co-chat-plus');
    var menu = plusMenu();
    if (!btn || !menu) return;
    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      setPlusMenuOpen(!plusMenuOpen());
    });
    menu.addEventListener('mousedown', function (ev) { ev.stopPropagation(); });
    menu.addEventListener('click', function (ev) {
      var item = ev.target.closest('[data-chat-plus]');
      if (!item || item.disabled) return;
      var action = item.getAttribute('data-chat-plus');
      setPlusMenuOpen(false);
      if (action === 'attach') {
        $('co-chat-file').click();
        return;
      }
      if (action === 'item' || action === 'tab') {
        sendShare(action).catch(function (err) { alert(err.message || 'Could not link.'); });
        return;
      }
      if (action === 'shot') {
        sendScreenshot().catch(function (err) { alert(err.message || 'Could not capture screenshot.'); });
      }
    });
    document.addEventListener('mousedown', function (ev) {
      if (!plusMenuOpen()) return;
      if (ev.target.closest('#co-chat-plus-menu, #co-chat-plus')) return;
      setPlusMenuOpen(false);
    });
  }

  function bindMain() {
    $('co-chat-room-list').addEventListener('click', function (ev) {
      var roomBtn = ev.target.closest('[data-room-id]');
      if (roomBtn) {
        openRoom(roomBtn.getAttribute('data-room-id'));
        return;
      }
      var userBtn = ev.target.closest('[data-user-id]');
      if (userBtn) {
        startDm(userBtn.getAttribute('data-user-id')).catch(function (err) {
          alert(err.message || 'Could not start chat.');
        });
      }
    });
    var searchTimer;
    $('co-chat-search').addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { loadRooms(); }, 200);
    });
    bindPlusMenu();
    $('co-chat-composer').addEventListener('submit', function (ev) {
      sendMain(ev).catch(function (err) { alert(err.message || 'Could not send.'); });
    });
    $('co-chat-input').addEventListener('keydown', function (ev) {
      if (mentionOpen()) return;
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        if (S.sending) return;
        $('co-chat-composer').requestSubmit();
      }
    });
    bindMentionComposer($('co-chat-input'));
    $('co-chat-file').addEventListener('change', function () {
      S.file = $('co-chat-file').files && $('co-chat-file').files[0];
      if (S.file) {
        $('co-chat-attach-name').hidden = false;
        $('co-chat-attach-name').textContent = S.file.name;
      } else clearFile();
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        if (mentionOpen()) {
          hideMentionMenu();
          return;
        }
        if (plusMenuOpen()) {
          setPlusMenuOpen(false);
          return;
        }
        if (S.windowOpen) {
          if (S.pageMode) {
            if (S.pageView === 'thread') {
              showChatList();
              return;
            }
            if (typeof S.onPageClose === 'function') S.onPageClose();
          } else {
            closeChatWindow();
          }
        }
        return;
      }
      if (ev.key !== 'Enter' || ev.shiftKey || ev.altKey || ev.metaKey || ev.ctrlKey) return;
      if (!S.windowOpen || pageIsEditing()) return;
      var el = document.activeElement;
      if (el && (el.id === 'co-chat-input' || el.id === 'so-chat-input' || el.id === 'co-chat-search')) return;
      var tag = el && el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el && el.isContentEditable)) return;
      ev.preventDefault();
      S.seeThrough = false;
      S.hover = true;
      var input = $('co-chat-input');
      if (input) input.focus();
      syncIdle();
    });
    $('co-chat-messages').addEventListener('click', function (ev) {
      var del = ev.target.closest('[data-chat-del]');
      if (del) {
        S.api('/api/admin/chat/messages/' + del.getAttribute('data-chat-del'), { method: 'DELETE' })
          .then(function () { return openRoom(S.roomId); })
          .catch(function (err) { alert(err.message || 'Could not remove.'); });
      }
      var share = ev.target.closest('[data-chat-path]');
      if (share) {
        if (S.openSharePath) S.openSharePath(share.getAttribute('data-chat-path'));
        return;
      }
      var find = ev.target.closest('[data-chat-find-order]');
      if (find && S.openSalesDoc) S.openSalesDoc(find.getAttribute('data-chat-find-order'));
      var discard = ev.target.closest('[data-copilot-discard]');
      if (discard) {
        var token = discard.getAttribute('data-copilot-discard');
        S.api('/api/admin/chat/copilot/drafts/' + encodeURIComponent(token) + '/discard', { method: 'POST' })
          .then(function () {
            discard.closest('.co-chat-draft-card').classList.add('is-discarded');
            discard.disabled = true;
            var openBtn = discard.parentNode && discard.parentNode.querySelector('.co-chat-draft-open');
            if (openBtn) openBtn.disabled = true;
          })
          .catch(function (err) { alert(err.message || 'Could not discard.'); });
      }
    });
    $('co-chat-open-order').addEventListener('click', function () {
      var id = $('co-chat-open-order').dataset.orderId;
      if (id && S.openSalesDoc) S.openSalesDoc(id);
    });
    if ($('so-chat-composer')) {
      $('so-chat-composer').addEventListener('submit', function (ev) {
        sendSo(ev).catch(function (err) { alert(err.message || 'Could not send.'); });
      });
      $('so-chat-attach').addEventListener('click', function () { $('so-chat-file').click(); });
      $('so-chat-file').addEventListener('change', function () {
        S.soFile = $('so-chat-file').files && $('so-chat-file').files[0];
        if (S.soFile) {
          $('so-chat-attach-name').hidden = false;
          $('so-chat-attach-name').textContent = S.soFile.name;
        } else {
          $('so-chat-attach-name').hidden = true;
          $('so-chat-attach-name').textContent = '';
        }
      });
      $('so-chat-input').addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' && !ev.shiftKey) {
          ev.preventDefault();
          if (S.soSending) return;
          $('so-chat-composer').requestSubmit();
        }
      });
    }
    if ($('so-chat-messages')) {
      $('so-chat-messages').addEventListener('click', function (ev) {
        var share = ev.target.closest('[data-chat-path]');
        if (share && S.openSharePath) S.openSharePath(share.getAttribute('data-chat-path'));
      });
    }
    bindSoTabs();
    bindWindow();
    bindResize();
    bindSplit();
  }

  function bindWindow() {
    function onToggle(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (isMobileChat()) {
        if (S.onOpenPage) S.onOpenPage();
        return;
      }
      if (S.windowOpen) {
        S.hover = true;
        S.seeThrough = false;
        syncIdle();
        var input = $('co-chat-input');
        if (input) input.focus();
        return;
      }
      openChatWindow().catch(function (err) { alert(err.message || 'Could not open chat.'); });
    }
    ['header-chat', 'tabbar-chat'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('click', onToggle);
    });
    if ($('co-chat-back')) {
      $('co-chat-back').addEventListener('click', function () {
        showChatList();
      });
    }
    if ($('co-chat-close')) {
      $('co-chat-close').addEventListener('click', function () {
        if (S.pageMode && typeof S.onPageClose === 'function') S.onPageClose();
        else closeChatWindow();
      });
    }
    document.addEventListener('mousemove', function (ev) {
      var root = $('co-chat');
      if (!S.windowOpen || S.pageMode || S.moving || S.resizing || S.splitting) return;
      var over = pointOverChat(ev);
      S.hover = over;
      if (over && S.seeThrough) {
        S.seeThrough = false;
        syncIdle();
      }
    });
    function pageInteract(ev) {
      if (!S.windowOpen || S.pageMode || S.moving || S.resizing || S.splitting) return;
      var root = $('co-chat');
      if (!root) return;
      if (ev.target && root.contains(ev.target)) return;
      if (pickerOpen()) return;
      S.seeThrough = true;
      S.hover = false;
      var focused = document.activeElement;
      if (focused && root.contains(focused) && focused.blur) focused.blur();
      syncIdle();
    }
    document.addEventListener('mousedown', pageInteract, true);
    document.addEventListener('wheel', pageInteract, { capture: true, passive: true });
    document.addEventListener('scroll', pageInteract, true);
    ['co-chat-input', 'co-chat-search'].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener('focus', function () {
        S.seeThrough = false;
        S.hover = true;
        syncIdle();
      });
      el.addEventListener('blur', function () { setTimeout(syncIdle, 0); });
    });
  }

  function syncDashComposer() {
    var form = $('dash-lobby-composer');
    var note = $('dash-lobby-nochat');
    var attachName = $('dash-lobby-attach-name');
    var canSend = hasChat();
    if (form) form.hidden = !canSend;
    if (attachName && !canSend) attachName.hidden = true;
    if (note) note.hidden = canSend;
    var input = $('dash-lobby-input');
    if (input) input.placeholder = canSend ? 'Message the team…' : input.placeholder;
  }

  function showDashLobbyError(msg) {
    var text = msg || 'Could not load Lobby.';
    var users = $('dash-lobby-users');
    var msgs = $('dash-lobby-messages');
    if (users) users.innerHTML = '<p class="dash-lobby-empty">' + esc(text) + '</p>';
    if (msgs) msgs.innerHTML = '<p class="co-chat-empty">' + esc(text) + '</p>';
  }

  function renderDashUsers() {
    var host = $('dash-lobby-users');
    if (!host) return;
    var users = S.dash.users || [];
    if (!users.length) {
      host.innerHTML = '<p class="dash-lobby-empty">No company users yet.</p>';
      return;
    }
    host.innerHTML = users.map(function (user) {
      var state = user.state || presenceState(user.presence);
      var name = user.name || user.email || 'Staff';
      var role = user.roleName || user.role || '';
      var self = !!user.isSelf;
      var cls = 'dash-lobby-user' + (self ? ' is-self' : '');
      return '<button type="button" class="' + cls + '" data-lobby-user="' + esc(user.id) + '"' +
        (self ? ' aria-haspopup="menu"' : '') + '>' +
        '<span class="dash-lobby-avatar">' + esc(initials(user.name, user.email)) +
        '<span class="dash-lobby-dot is-' + state + '" title="' + esc(statusLabel(state)) + '"></span></span>' +
        '<span class="dash-lobby-user-copy"><strong>' + esc(self ? 'You' : name) + '</strong>' +
        '<em>' + esc([role, statusLabel(state)].filter(Boolean).join(' · ')) + '</em></span></button>';
    }).join('');
  }

  function renderDashMessages() {
    var host = $('dash-lobby-messages');
    if (!host) return;
    if (!S.dash.messages.length && !S.spectrumPending) {
      host.innerHTML = '<p class="co-chat-empty">No messages yet. Team chat and staff sign-ins show up here.</p>';
      return;
    }
    renderMessages('dash-lobby-messages', S.dash.messages);
  }

  async function loadDashLobby(full, extra) {
    var root = $('dash-lobby');
    if (!root || !S.api) return;
    extra = extra || {};
    var gen = (S.dash.fetchGen = (S.dash.fetchGen || 0) + 1);
    var url = '/api/admin/chat/lobby?limit=100';
    if (!full && S.dash.lastMsgId) url += '&afterId=' + S.dash.lastMsgId;
    if (full || extra.users) url += '&users=1';
    else url += '&users=0';
    var data;
    try {
      data = await S.api(url);
    } catch (err) {
      if (gen !== S.dash.fetchGen) return;
      if (full || !S.dash.loaded) showDashLobbyError((err && err.message) || 'Could not load Lobby.');
      throw err;
    }
    if (gen !== S.dash.fetchGen) return;
    S.dash.roomId = data.room && data.room.id;
    if (Array.isArray(data.users)) S.dash.users = data.users;
    if (data.aiName) setAiName(data.aiName);
    var msgs = data.messages || [];
    var temps = (S.dash.messages || []).filter(function (m) { return isTempId(m.id); });
    if (full || !S.dash.lastMsgId) {
      S.dash.messages = mergeMessages(msgs, temps);
    } else if (msgs.length) {
      S.dash.messages = mergeMessages(S.dash.messages, msgs);
    }
    S.dash.lastMsgId = maxMsgId(S.dash.messages, S.dash.lastMsgId || 0);
    if (S.spectrumPending && (S.dash.messages || []).some(function (m) { return m.isSpectrumAi; })) {
      S.spectrumPending = false;
    }
    S.dash.loaded = true;
    if (S.dash.roomId) {
      saveThread(S.dash.roomId, {
        room: data.room || (getThread(S.dash.roomId) && getThread(S.dash.roomId).room) || { id: S.dash.roomId, kind: 'lobby', title: 'Lobby' },
        messages: S.dash.messages
      });
    }
    if (S.windowOpen && Number(S.roomId) === Number(S.dash.roomId) && msgs.length) {
      S.messages = mergeMessages(S.messages, msgs);
      S.lastMsgId = maxMsgId(S.messages, S.lastMsgId);
      saveThread(S.roomId, { room: S.room || data.room, messages: S.messages });
      renderMessages('co-chat-messages', S.messages);
    }
    if (Array.isArray(data.users)) {
      var userKey = JSON.stringify((S.dash.users || []).map(function (u) {
        return [u.id, u.state, u.name, u.roleName];
      }));
      if (full || extra.users || S.dash.userKey !== userKey) {
        S.dash.userKey = userKey;
        var menu = $('dash-lobby-status-menu');
        if (!menu || menu.hidden) renderDashUsers();
      }
    }
    if (full || msgs.length || !S.dash.messages.length || S.spectrumPending) renderDashMessages();
    syncDashComposer();
    if (hasChat() && S.dash.roomId && (full || msgs.length)) {
      try { await S.api('/api/admin/chat/rooms/' + S.dash.roomId + '/read', { method: 'POST' }); } catch (e) { /* ignore */ }
    }
  }

  async function pollDashLobby() {
    if (document.hidden || !S.dash.loaded) return;
    try { await loadDashLobby(false); } catch (e) { /* ignore */ }
  }

  function clearDashFile() {
    S.dash.file = null;
    if ($('dash-lobby-file')) $('dash-lobby-file').value = '';
    if ($('dash-lobby-attach-name')) {
      $('dash-lobby-attach-name').hidden = true;
      $('dash-lobby-attach-name').textContent = '';
    }
  }

  async function sendDashLobby(ev) {
    ev.preventDefault();
    if (!hasChat() || S.dash.sending) return;
    if (!S.dash.roomId) await loadDashLobby(true);
    if (!S.dash.roomId) throw new Error('Lobby is not ready yet.');
    var body = String(($('dash-lobby-input') && $('dash-lobby-input').value) || '').trim();
    if (!body && !S.dash.file) return;
    S.dash.sending = true;
    setComposerBusy('dash-lobby-composer', true);
    var roomId = S.dash.roomId;
    var heldFile = S.dash.file;
    var temp = optimisticMessage(body, heldFile, roomId);
    if ($('dash-lobby-input')) $('dash-lobby-input').value = '';
    clearDashFile();
    if (mentionsAi(body)) S.spectrumPending = true;
    appendOptimistic(temp, roomId);
    try {
      var data = await postChatMessage(roomId, body, heldFile);
      finishOptimistic(temp.id, data && data.message, roomId);
    } catch (err) {
      finishOptimistic(temp.id, null, roomId);
      S.spectrumPending = false;
      restoreComposer('dash-lobby-input', body);
      throw err;
    } finally {
      S.dash.sending = false;
      setComposerBusy('dash-lobby-composer', false);
    }
  }

  async function setMyStatus(status) {
    S.dash.fetchGen = (S.dash.fetchGen || 0) + 1;
    (S.dash.users || []).forEach(function (user) {
      if (!user.isSelf) return;
      user.state = status;
      user.presence = Object.assign({}, user.presence || {}, { status: status, lastSeenAt: new Date().toISOString(), lastActiveAt: new Date().toISOString() });
    });
    S.dash.userKey = '';
    renderDashUsers();
    await S.api('/api/admin/chat/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: status, active: true })
    });
    setStatusMenuOpen(false);
    await loadDashLobby(false, { users: true });
  }

  function touchPresence(active) {
    if (!S.api || !S.admin) return;
    var payload = active ? { active: true } : {};
    S.api('/api/admin/chat/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(function () {});
  }

  var mentionState = { textarea: null, start: 0, items: [], index: 0 };
  var crmMentionState = { q: '', items: [], timer: 0, seq: 0 };

  function mentionMenuEl() {
    return $('chat-mention-menu');
  }

  function hideMentionMenu() {
    var menu = mentionMenuEl();
    if (menu) {
      menu.hidden = true;
      menu.innerHTML = '';
    }
    mentionState.textarea = null;
    mentionState.items = [];
    mentionState.index = 0;
  }

  function mentionOpen() {
    var menu = mentionMenuEl();
    return !!(menu && !menu.hidden && mentionState.items.length);
  }

  function mentionQueryAt(textarea) {
    if (!textarea) return null;
    var pos = textarea.selectionStart;
    var text = String(textarea.value || '').slice(0, pos);
    var at = text.lastIndexOf('@');
    if (at < 0) return null;
    if (at > 0 && !/\s/.test(text.charAt(at - 1))) return null;
    var q = text.slice(at + 1);
    if (/[\n@]/.test(q) || q.length > 40) return null;
    return { start: at, query: q };
  }

  function mentionCandidates(query) {
    var q = String(query || '').toLowerCase();
    var items = [{ kind: 'ai', name: aiName(), hint: 'AI' }];
    var seen = {};
    seen[aiName().toLowerCase()] = true;
    (S.dash.users || []).forEach(function (user) {
      var name = user.name || user.email || '';
      if (!name || seen[name.toLowerCase()]) return;
      seen[name.toLowerCase()] = true;
      items.push({
        kind: 'user',
        name: name,
        hint: user.isSelf ? 'You' : (user.roleName || user.role || '')
      });
    });
    (crmMentionState.items || []).forEach(function (row) {
      if (!row || !row.id) return;
      items.push({
        kind: row.kind,
        id: row.id,
        name: row.name || (row.kind === 'deal' ? 'Deal' : 'Lead'),
        hint: row.hint || (row.kind === 'deal' ? 'Deal' : 'Lead'),
        token: '@' + row.kind + '/' + row.id
      });
    });
    return items.filter(function (item) {
      if (!q) return true;
      var blob = [item.name, item.hint, item.kind, item.token].join(' ').toLowerCase();
      return blob.indexOf(q) >= 0;
    }).slice(0, 10);
  }

  function fetchCrmMentions(query) {
    if (!S.api) return;
    var q = String(query || '').trim();
    crmMentionState.seq += 1;
    var seq = crmMentionState.seq;
    S.api('/api/admin/crm/mentions?q=' + encodeURIComponent(q)).then(function (data) {
      if (seq !== crmMentionState.seq) return;
      crmMentionState.q = q;
      crmMentionState.items = (data && data.mentions) || [];
      if (!mentionState.textarea) return;
      var found = mentionQueryAt(mentionState.textarea);
      mentionState.items = mentionCandidates(found && found.query);
      if (mentionState.items.length) renderMentionMenu();
      else {
        var menu = mentionMenuEl();
        if (menu) {
          menu.hidden = true;
          menu.innerHTML = '';
        }
      }
    }).catch(function () {
      if (seq !== crmMentionState.seq) return;
      crmMentionState.items = [];
    });
  }

  function scheduleCrmMentions(query) {
    if (crmMentionState.timer) clearTimeout(crmMentionState.timer);
    crmMentionState.timer = setTimeout(function () {
      fetchCrmMentions(query);
    }, 160);
  }

  function renderMentionMenu() {
    var menu = mentionMenuEl();
    var textarea = mentionState.textarea;
    if (!menu || !textarea) return;
    if (!mentionState.items.length) {
      hideMentionMenu();
      return;
    }
    if (mentionState.index < 0) mentionState.index = 0;
    if (mentionState.index >= mentionState.items.length) mentionState.index = mentionState.items.length - 1;
    menu.innerHTML = mentionState.items.map(function (item, i) {
      return '<button type="button" role="option" class="co-chat-mention-item' +
        (i === mentionState.index ? ' is-on' : '') + '" data-mention-i="' + i + '">' +
        '<strong>' + esc(item.name) + '</strong>' +
        (item.hint ? '<em>' + esc(item.hint) + '</em>' : '') +
        '</button>';
    }).join('');
    menu.hidden = false;
    var wrap = textarea.closest('.co-chat-composer');
    if (wrap && menu.parentNode !== wrap) wrap.appendChild(menu);
    menu.style.position = 'absolute';
    menu.style.left = '0.7rem';
    menu.style.right = '0.7rem';
    menu.style.width = 'auto';
    menu.style.top = 'auto';
    menu.style.bottom = 'calc(100% + 6px)';
    menu.style.zIndex = '12';
  }

  function showMentionMenu(textarea) {
    var found = mentionQueryAt(textarea);
    if (!found) {
      hideMentionMenu();
      return;
    }
    mentionState.textarea = textarea;
    mentionState.start = found.start;
    mentionState.items = mentionCandidates(found.query);
    scheduleCrmMentions(found.query);
    if (!mentionState.items.length) {
      var menu = mentionMenuEl();
      if (menu) {
        menu.hidden = true;
        menu.innerHTML = '';
      }
      return;
    }
    if (mentionState.index >= mentionState.items.length) mentionState.index = 0;
    renderMentionMenu();
  }

  function insertMention(item) {
    var textarea = mentionState.textarea;
    if (!textarea || !item) return;
    var start = mentionState.start;
    var pos = textarea.selectionStart;
    var value = textarea.value;
    var before = value.slice(0, start);
    var after = value.slice(pos);
    var insert = (item.kind === 'lead' || item.kind === 'deal')
      ? ('@' + item.kind + '/' + item.id + ' ')
      : ('@' + item.name + ' ');
    textarea.value = before + insert + after;
    var caret = before.length + insert.length;
    textarea.setSelectionRange(caret, caret);
    hideMentionMenu();
    textarea.focus();
  }

  function bindMentionComposer(textarea) {
    if (!textarea || textarea.dataset.mentionBound) return;
    textarea.dataset.mentionBound = '1';
    textarea.addEventListener('input', function () { showMentionMenu(textarea); });
    textarea.addEventListener('click', function () { showMentionMenu(textarea); });
    textarea.addEventListener('keyup', function (ev) {
      if (ev.key === 'Escape' || ev.key === 'ArrowUp' || ev.key === 'ArrowDown') return;
      showMentionMenu(textarea);
    });
    textarea.addEventListener('keydown', function (ev) {
      if (ev.key === '@') {
        setTimeout(function () { showMentionMenu(textarea); }, 0);
      }
      if (!mentionOpen()) return;
      if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        mentionState.index = (mentionState.index + 1) % mentionState.items.length;
        renderMentionMenu();
        return;
      }
      if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        mentionState.index = (mentionState.index - 1 + mentionState.items.length) % mentionState.items.length;
        renderMentionMenu();
        return;
      }
      if (ev.key === 'Enter' || ev.key === 'Tab') {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        insertMention(mentionState.items[mentionState.index]);
        return;
      }
      if (ev.key === 'Escape') {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        hideMentionMenu();
      }
    });
    textarea.addEventListener('blur', function () {
      setTimeout(function () {
        if (mentionState.textarea === textarea) hideMentionMenu();
      }, 150);
    });
  }

  function bindDashLobby() {
    var form = $('dash-lobby-composer');
    if (!form) return;
    form.addEventListener('submit', function (ev) {
      sendDashLobby(ev).catch(function (err) { alert(err.message || 'Could not send.'); });
    });
    var input = $('dash-lobby-input');
    if (input) {
      input.addEventListener('keydown', function (ev) {
        if (mentionOpen()) return;
        if (ev.key === 'Enter' && !ev.shiftKey) {
          ev.preventDefault();
          if (S.dash.sending) return;
          form.requestSubmit();
        }
      });
      bindMentionComposer(input);
    }
    var attach = $('dash-lobby-attach');
    var file = $('dash-lobby-file');
    if (attach && file) {
      attach.addEventListener('click', function () { file.click(); });
      file.addEventListener('change', function () {
        S.dash.file = file.files && file.files[0];
        if (S.dash.file) {
          $('dash-lobby-attach-name').hidden = false;
          $('dash-lobby-attach-name').textContent = S.dash.file.name;
        } else clearDashFile();
      });
    }
    var users = $('dash-lobby-users');
    if (users) {
      users.addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-lobby-user]');
        if (!btn) return;
        var id = btn.getAttribute('data-lobby-user');
        var user = (S.dash.users || []).find(function (u) { return String(u.id) === String(id); });
        if (!user || !user.isSelf) return;
        var menu = $('dash-lobby-status-menu');
        var open = menu && menu.hidden;
        setStatusMenuOpen(open, btn);
      });
    }
    var menu = $('dash-lobby-status-menu');
    if (menu) {
      menu.addEventListener('click', function (ev) {
        var item = ev.target.closest('[data-lobby-status]');
        if (!item) return;
        setMyStatus(item.getAttribute('data-lobby-status')).catch(function (err) {
          alert(err.message || 'Could not update status.');
        });
      });
    }
    var msgs = $('dash-lobby-messages');
    if (msgs) {
      msgs.addEventListener('click', function (ev) {
        var del = ev.target.closest('[data-chat-del]');
        if (del) {
          S.api('/api/admin/chat/messages/' + del.getAttribute('data-chat-del'), { method: 'DELETE' })
            .then(function () { return loadDashLobby(true); })
            .catch(function (err) { alert(err.message || 'Could not remove.'); });
          return;
        }
        var share = ev.target.closest('[data-chat-path]');
        if (share && S.openSharePath) S.openSharePath(share.getAttribute('data-chat-path'));
      });
    }
    document.addEventListener('mousedown', function (ev) {
      if (ev.target.closest('#dash-lobby-status-menu, .dash-lobby-user.is-self')) return;
      setStatusMenuOpen(false);
    });
    var activeAt = 0;
    function markActive() {
      var now = Date.now();
      if (now - activeAt < 15000) return;
      activeAt = now;
      touchPresence(true);
    }
    document.addEventListener('mousemove', markActive, { passive: true });
    document.addEventListener('keydown', markActive);
    document.addEventListener('click', markActive);
    syncDashComposer();
  }

  async function boot(opts) {
    if (S.booted) return;
    S.api = opts.api;
    S.admin = opts.admin;
    S.canUse = opts.canUse;
    S.openSalesDoc = opts.openSalesDoc || null;
    S.getChatPrefs = typeof opts.getChatPrefs === 'function' ? opts.getChatPrefs : null;
    S.saveChatPrefs = typeof opts.saveChatPrefs === 'function' ? opts.saveChatPrefs : null;
    S.getShareContext = typeof opts.getShareContext === 'function' ? opts.getShareContext : null;
    S.openSharePath = typeof opts.openSharePath === 'function' ? opts.openSharePath : null;
    S.onOpenPage = typeof opts.onOpenPage === 'function' ? opts.onOpenPage : null;
    S.onPageClose = typeof opts.onPageClose === 'function' ? opts.onPageClose : null;
    if (typeof opts.esc === 'function') S.esc = opts.esc;
    bindDashLobby();
    var mentionMenu = mentionMenuEl();
    if (mentionMenu) {
      mentionMenu.addEventListener('mousedown', function (ev) {
        var btn = ev.target.closest('[data-mention-i]');
        if (!btn) return;
        ev.preventDefault();
        var i = Number(btn.getAttribute('data-mention-i'));
        insertMention(mentionState.items[i]);
      });
    }
    var root = $('co-chat');
    var nav = $('header-chat');
    var tabbar = $('tabbar-chat');
    S.booted = true;
    touchPresence(true);
    S.api('/api/admin/chat/ai').then(function (data) {
      if (data && data.aiName) setAiName(data.aiName);
    }).catch(function () {});
    loadDashLobby(true).catch(function (err) {
      showDashLobbyError((err && err.message) || 'Could not load Lobby.');
    });
    S.timers.dashPoll = setInterval(pollDashLobby, 3000);
    S.timers.presence = setInterval(function () {
      if (document.hidden) return;
      touchPresence(false);
      loadDashLobby(false, { users: true }).catch(function () {});
      if (!hasChat()) return;
      var ids = S.rooms.filter(function (r) { return r.kind === 'dm' && r.otherUser; })
        .map(function (r) { return r.otherUser.id; });
      if (S.windowOpen) loadRooms().catch(function () {});
      if (!ids.length) return;
      S.api('/api/admin/chat/presence?ids=' + ids.join(',')).then(function (data) {
        S.presence = data.presence || {};
        renderRoomList();
      }).catch(function () {});
    }, 30000);
    if (!hasChat()) {
      if (root) root.hidden = true;
      if (nav) nav.classList.add('hidden');
      if (tabbar) tabbar.classList.add('hidden');
      return;
    }
    if (nav) nav.classList.remove('hidden');
    if (tabbar) tabbar.classList.remove('hidden');
    if (root) {
      root.hidden = true;
      root.classList.add('is-window');
    }
    loadLast();
    bindMain();
    prefetchChat();
    window.addEventListener('resize', function () {
      if (!S.windowOpen) return;
      var mobile = isMobileChat();
      if (mobile && !S.pageMode && typeof S.onOpenPage === 'function') {
        S.onOpenPage();
        return;
      }
      if (!mobile && S.pageMode) {
        S.pageMode = false;
        S.pageView = 'list';
        document.body.classList.remove('chat-page-on');
        var chatRoot = $('co-chat');
        if (chatRoot) chatRoot.classList.remove('is-page', 'is-thread');
        if ($('co-chat-back')) $('co-chat-back').hidden = true;
        applyRect(S.rect || defaultRect());
        if (S.room) setWindowTitle(roomTitle(S.room));
        syncIdle();
      }
    });
    await refreshUnread();
    await handleDeepLink();
    S.timers.poll = setInterval(pollOpenRoom, 3000);
    S.timers.unread = setInterval(function () {
      if (!document.hidden) refreshUnread();
    }, 10000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) {
        touchPresence(true);
        pollDashLobby();
        if (hasChat()) {
          refreshUnread();
          if (S.roomId) pollOpenRoom();
        }
      }
    });
  }

  function onSalesDocOpened(doc) {
    if (!doc || doc.type !== 'order' || !hasChat()) return;
    S.soOrderId = doc.id;
    var tab = $('so-chat-tab');
    if (tab) tab.textContent = 'Chat';
    S.api('/api/admin/chat/rooms/order/' + doc.id).then(function (data) {
      if (data.room && tab) {
        var n = data.room.unreadCount || 0;
        tab.textContent = n ? ('Chat (' + n + ')') : 'Chat';
      }
    }).catch(function () {});
    document.querySelectorAll('#so-doc-tabs [data-so-pane]').forEach(function (b) {
      b.classList.toggle('is-on', b.getAttribute('data-so-pane') === 'doc');
    });
    var docPanel = document.querySelector('[data-so-pane-panel="doc"]');
    var chatPanel = document.querySelector('[data-so-pane-panel="chat"]');
    var side = $('so-doc-side');
    if (docPanel) docPanel.hidden = false;
    if (side) side.hidden = false;
    if (chatPanel) chatPanel.hidden = true;
  }

  global.SpectrumChat = {
    boot: boot,
    onSalesDocOpened: onSalesDocOpened,
    openOrderChat: openOrderChat,
    open: openChatWindow,
    openPage: openChatPage,
    closePage: closeChatPage,
    close: closeChatWindow,
    applyWindowPrefs: restoreWindowPrefs,
    refreshContacts: function () {
      if (!S.booted || !hasChat()) return;
      loadRooms().then(function () {
        if (S.pageMode && S.pageView !== 'thread') return;
        if (S.roomId) return openRoom(S.roomId);
      }).catch(function () {});
    },
    refreshLobby: function () {
      if (!S.booted) return;
      loadDashLobby(true).catch(function () {});
    },
    setAiName: setAiName,
    aiName: aiName
  };
})(window);
