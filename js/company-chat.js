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
      userKey: ''
    },
    soOrderId: null,
    soRoomId: null,
    soLastMsgId: 0,
    soFile: null,
    soMessages: [],
    baseTitle: document.title || 'Company | Spectrum Display',
    booted: false,
    windowOpen: false,
    hover: false,
    seeThrough: false,
    resizing: false,
    moving: false,
    splitting: false,
    listW: 100,
    rect: null,
    saveChatPrefs: null,
    getChatPrefs: null,
    timers: {}
  };

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
    if (!p || !p.width || !p.height) return;
    S.rect = {
      left: Number(p.left),
      top: Number(p.top),
      width: Number(p.width),
      height: Number(p.height)
    };
    if (p.listW) S.listW = Number(p.listW);
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

  function applyRect(r) {
    var root = $('co-chat');
    if (!root) return;
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
      if (ev.button !== 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      var start = S.rect || defaultRect();
      drag = {
        dir: dir,
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
    }
    var head = root.querySelector('.co-chat-head');
    if (head) {
      head.addEventListener('mousedown', function (ev) {
        if (ev.target.closest('button, a, input, textarea, select')) return;
        beginDrag(ev, 'move');
      });
    }
    root.querySelectorAll('.co-chat-resize').forEach(function (handle) {
      handle.addEventListener('mousedown', function (ev) {
        beginDrag(ev, handle.getAttribute('data-resize') || 'se');
      });
    });
    document.addEventListener('mousemove', function (ev) {
      if (!drag) return;
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
    });
    function endDrag() {
      if (!drag) return;
      drag = null;
      S.resizing = false;
      S.moving = false;
      root.classList.remove('is-resizing', 'is-moving');
      document.body.classList.remove('chat-resizing');
      saveWindowPrefs();
      syncIdle();
    }
    document.addEventListener('mouseup', endDrag);
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
    return false;
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

  async function openChatWindow() {
    if (!hasChat()) return;
    var root = $('co-chat');
    if (!root) return;
    root.hidden = false;
    root.classList.add('is-window', 'is-open');
    applyRect(S.rect || defaultRect());
    applyListW(S.listW);
    S.windowOpen = true;
    S.hover = true;
    S.seeThrough = false;
    syncIdle();
    syncNavOpen();
    await loadRooms();
  }

  function closeChatWindow() {
    var root = $('co-chat');
    saveLast();
    S.windowOpen = false;
    S.hover = false;
    S.seeThrough = false;
    if (root) {
      root.hidden = true;
      root.classList.remove('is-open', 'is-idle');
    }
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
    if (room.kind === 'lobby') return 'Everyone at Spectrum can see this.';
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
    if (room.kind === 'copilot') return 'Ask Copilot to draft something…';
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
      label = 'C';
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

  function renderMessages(hostId, messages) {
    var host = $(hostId);
    if (!host) return;
    if (!messages.length && !(hostId === 'co-chat-messages' && S.copilotPending)) {
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
      if (msg.isCopilot) {
        return '<div class="co-chat-msg is-copilot" data-msg-id="' + msg.id + '">' +
          '<div class="co-chat-msg-meta"><strong>Copilot</strong><span>' +
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
      }
      var actions = mine
        ? '<span class="co-chat-msg-actions"><button type="button" data-chat-del="' + msg.id + '">Remove</button></span>'
        : '';
      return '<div class="co-chat-msg' + (mine ? ' is-mine' : '') + '" data-msg-id="' + msg.id + '">' +
        '<div class="co-chat-msg-meta"><strong>' + esc(name) + '</strong><span>' +
        esc(fmtTime(msg.createdAt)) + (msg.editedAt ? ' · edited' : '') + '</span>' + actions + '</div>' +
        (msg.body ? '<div class="co-chat-msg-body">' + linkify(msg.body) + '</div>' : '') +
        attach + '</div>';
    }).join('') + (hostId === 'co-chat-messages' ? pendingHtml() : '');
    host.scrollTop = host.scrollHeight;
  }

  function pendingHtml() {
    if (!S.copilotPending) return '';
    return '<div class="co-chat-msg is-copilot is-pending"><div class="co-chat-msg-meta"><strong>Copilot</strong></div>' +
      '<div class="co-chat-msg-body">Working on a draft…</div></div>';
  }

  async function loadRooms() {
    var q = ($('co-chat-search') && $('co-chat-search').value) || '';
    var data = await S.api('/api/admin/chat/rooms?tab=contacts' +
      '&q=' + encodeURIComponent(q));
    S.rooms = data.rooms || [];
    renderRoomList();
    if (!S.roomId && S.rooms.length) {
      var first = S.rooms[0];
      if (first && first.id) await openRoom(first.id);
    } else if (S.roomId) {
      var still = S.rooms.some(function (r) { return r.id && Number(r.id) === Number(S.roomId); });
      if (!still) {
        try {
          await openRoom(S.roomId);
        } catch (e) {
          S.roomId = null;
          S.room = null;
          S.messages = [];
          var fallback = S.rooms[0];
          if (fallback && fallback.id) await openRoom(fallback.id);
          else renderEmptyMain();
        }
      } else renderRoomList();
    } else {
      renderEmptyMain();
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
    S.roomId = Number(roomId);
    var data = await S.api('/api/admin/chat/rooms/' + S.roomId + '/messages?limit=100');
    S.room = data.room;
    S.messages = data.messages || [];
    S.lastMsgId = S.messages.reduce(function (m, x) { return Math.max(m, Number(x.id) || 0); }, 0);
    if (S.room && S.room.kind === 'copilot') {
      var hasCopilot = S.messages.some(function (m) {
        return m.isCopilot && Number(m.id) === S.lastMsgId;
      });
      if (hasCopilot) S.copilotPending = false;
    } else {
      S.copilotPending = false;
    }
    setWindowTitle(roomTitle(S.room));
    if ($('co-chat-main-sub')) $('co-chat-main-sub').textContent = roomSub(S.room);
    $('co-chat-input').placeholder = composerPlaceholder(S.room);
    var openBtn = $('co-chat-open-order');
    if (S.room.kind === 'order' && S.room.salesOrderId) {
      openBtn.hidden = false;
      openBtn.dataset.orderId = S.room.salesOrderId;
    } else {
      openBtn.hidden = true;
      delete openBtn.dataset.orderId;
    }
    renderMessages('co-chat-messages', S.messages);
    renderRoomList();
    try { await S.api('/api/admin/chat/rooms/' + S.roomId + '/read', { method: 'POST' }); } catch (e) { /* ignore */ }
    refreshUnread();
    saveLast();
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
    if (!S.roomId) {
      await loadRooms();
      if (S.rooms[0]) await openRoom(S.rooms[0].id);
    }
    if (!S.roomId) throw new Error('Open a chat first.');
    body = String(body || '').trim();
    if (!body && !file) return;
    var fd = new FormData();
    fd.append('body', body);
    if (file) fd.append('file', file);
    await S.api('/api/admin/chat/rooms/' + S.roomId + '/messages', { method: 'POST', body: fd });
    if ($('co-chat-input')) $('co-chat-input').value = '';
    clearFile();
    if (S.room && S.room.kind === 'copilot') S.copilotPending = true;
    await openRoom(S.roomId);
    await loadRooms();
    if (Number(S.roomId) === Number(S.dash.roomId)) {
      await loadDashLobby(true);
    }
  }

  async function sendMain(ev) {
    ev.preventDefault();
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
      S.messages = S.messages.concat(msgs);
      S.lastMsgId = S.messages.reduce(function (m, x) { return Math.max(m, Number(x.id) || 0); }, S.lastMsgId);
      if (S.room && S.room.kind === 'copilot' && msgs.some(function (m) { return m.isCopilot; })) {
        S.copilotPending = false;
      }
      renderMessages('co-chat-messages', S.messages);
      await S.api('/api/admin/chat/rooms/' + S.roomId + '/read', { method: 'POST' });
      loadRooms();
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
    S.soLastMsgId = S.soMessages.reduce(function (m, x) { return Math.max(m, Number(x.id) || 0); }, 0);
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
        S.soMessages = S.soMessages.concat(msgs);
        S.soLastMsgId = S.soMessages.reduce(function (m, x) { return Math.max(m, Number(x.id) || 0); }, S.soLastMsgId);
        renderMessages('so-chat-messages', S.soMessages);
        await S.api('/api/admin/chat/rooms/' + S.soRoomId + '/read', { method: 'POST' });
      } catch (e) { /* ignore */ }
    }, 3000);
  }

  async function sendSo(ev) {
    ev.preventDefault();
    if (!S.soRoomId) return;
    var body = String(($('so-chat-input') && $('so-chat-input').value) || '').trim();
    if (!body && !S.soFile) return;
    var fd = new FormData();
    fd.append('body', body);
    if (S.soFile) fd.append('file', S.soFile);
    await S.api('/api/admin/chat/rooms/' + S.soRoomId + '/messages', { method: 'POST', body: fd });
    $('so-chat-input').value = '';
    S.soFile = null;
    if ($('so-chat-file')) $('so-chat-file').value = '';
    if ($('so-chat-attach-name')) {
      $('so-chat-attach-name').hidden = true;
      $('so-chat-attach-name').textContent = '';
    }
    await openOrderChat(S.soOrderId);
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
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        $('co-chat-composer').requestSubmit();
      }
    });
    $('co-chat-file').addEventListener('change', function () {
      S.file = $('co-chat-file').files && $('co-chat-file').files[0];
      if (S.file) {
        $('co-chat-attach-name').hidden = false;
        $('co-chat-attach-name').textContent = S.file.name;
      } else clearFile();
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        if (plusMenuOpen()) {
          setPlusMenuOpen(false);
          return;
        }
        if (S.windowOpen) closeChatWindow();
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
    if ($('co-chat-close')) {
      $('co-chat-close').addEventListener('click', function () { closeChatWindow(); });
    }
    document.addEventListener('mousemove', function (ev) {
      var root = $('co-chat');
      if (!S.windowOpen || S.moving || S.resizing || S.splitting) return;
      var over = pointOverChat(ev);
      S.hover = over;
      if (over && S.seeThrough) {
        S.seeThrough = false;
        syncIdle();
      }
    });
    function pageInteract(ev) {
      if (!S.windowOpen || S.moving || S.resizing || S.splitting) return;
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
    if (!S.dash.messages.length) {
      host.innerHTML = '<p class="co-chat-empty">No messages yet. Team chat and staff sign-ins show up here.</p>';
      return;
    }
    renderMessages('dash-lobby-messages', S.dash.messages);
  }

  async function loadDashLobby(full) {
    var root = $('dash-lobby');
    if (!root || !S.api) return;
    var gen = (S.dash.fetchGen = (S.dash.fetchGen || 0) + 1);
    var url = '/api/admin/chat/lobby?limit=100';
    if (!full && S.dash.lastMsgId) url += '&afterId=' + S.dash.lastMsgId;
    var data = await S.api(url);
    if (gen !== S.dash.fetchGen) return;
    S.dash.roomId = data.room && data.room.id;
    S.dash.users = data.users || [];
    var msgs = data.messages || [];
    if (full || !S.dash.lastMsgId) {
      S.dash.messages = msgs;
    } else if (msgs.length) {
      S.dash.messages = S.dash.messages.concat(msgs);
    }
    S.dash.lastMsgId = S.dash.messages.reduce(function (m, x) {
      return Math.max(m, Number(x.id) || 0);
    }, S.dash.lastMsgId || 0);
    S.dash.loaded = true;
    var userKey = JSON.stringify((S.dash.users || []).map(function (u) {
      return [u.id, u.state, u.name, u.roleName];
    }));
    if (full || S.dash.userKey !== userKey) {
      S.dash.userKey = userKey;
      var menu = $('dash-lobby-status-menu');
      if (!menu || menu.hidden) renderDashUsers();
    }
    if (full || msgs.length || !S.dash.messages.length) renderDashMessages();
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
    if (!hasChat()) return;
    if (!S.dash.roomId) await loadDashLobby(true);
    if (!S.dash.roomId) throw new Error('Lobby is not ready yet.');
    var body = String(($('dash-lobby-input') && $('dash-lobby-input').value) || '').trim();
    if (!body && !S.dash.file) return;
    var fd = new FormData();
    fd.append('body', body);
    if (S.dash.file) fd.append('file', S.dash.file);
    await S.api('/api/admin/chat/rooms/' + S.dash.roomId + '/messages', { method: 'POST', body: fd });
    if ($('dash-lobby-input')) $('dash-lobby-input').value = '';
    clearDashFile();
    await loadDashLobby(true);
    if (S.windowOpen && Number(S.roomId) === Number(S.dash.roomId)) {
      await openRoom(S.roomId);
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
    await loadDashLobby(false);
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

  function bindDashLobby() {
    var form = $('dash-lobby-composer');
    if (!form) return;
    form.addEventListener('submit', function (ev) {
      sendDashLobby(ev).catch(function (err) { alert(err.message || 'Could not send.'); });
    });
    var input = $('dash-lobby-input');
    if (input) {
      input.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' && !ev.shiftKey) {
          ev.preventDefault();
          form.requestSubmit();
        }
      });
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
    if (typeof opts.esc === 'function') S.esc = opts.esc;
    bindDashLobby();
    var root = $('co-chat');
    var nav = $('header-chat');
    var tabbar = $('tabbar-chat');
    S.booted = true;
    touchPresence(true);
    loadDashLobby(true).catch(function () {
      if ($('dash-lobby-messages')) {
        $('dash-lobby-messages').innerHTML = '<p class="co-chat-empty">Could not load Lobby.</p>';
      }
    });
    S.timers.dashPoll = setInterval(pollDashLobby, 3000);
    S.timers.presence = setInterval(function () {
      if (document.hidden) return;
      touchPresence(false);
      pollDashLobby();
      if (!hasChat()) return;
      var ids = S.rooms.filter(function (r) { return r.kind === 'dm' && r.otherUser; })
        .map(function (r) { return r.otherUser.id; });
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
    await refreshUnread();
    await handleDeepLink();
    S.timers.poll = setInterval(pollOpenRoom, 3000);
    S.timers.unread = setInterval(function () {
      if (!document.hidden) {
        refreshUnread();
        if (S.windowOpen) loadRooms();
      }
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
    close: closeChatWindow,
    refreshContacts: function () {
      if (!S.booted || !hasChat()) return;
      loadRooms().then(function () {
        if (S.roomId) return openRoom(S.roomId);
      }).catch(function () {});
    },
    refreshLobby: function () {
      if (!S.booted) return;
      loadDashLobby(true).catch(function () {});
    }
  };
})(window);
