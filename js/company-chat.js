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
    users: [],
    unread: { total: 0, lobby: 0, direct: 0, orders: 0 },
    presence: {},
    soOrderId: null,
    soRoomId: null,
    soLastMsgId: 0,
    soFile: null,
    soMessages: [],
    baseTitle: document.title || 'Company | Spectrum Display',
    booted: false,
    windowOpen: false,
    hover: false,
    timers: {}
  };

  function $(id) { return document.getElementById(id); }
  function esc(v) { return S.esc(v); }

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
        tab: S.tab || 'lobby',
        roomId: S.roomId || null
      }));
    } catch (e) { /* ignore */ }
  }

  function loadLast() {
    try {
      var d = JSON.parse(localStorage.getItem(persistKey()) || '{}');
      if (d.tab === 'lobby' || d.tab === 'direct' || d.tab === 'orders') S.tab = d.tab;
      if (d.roomId) S.roomId = Number(d.roomId);
    } catch (e) { /* ignore */ }
  }

  function isTyping() {
    var el = document.activeElement;
    if (!el) return false;
    return el.id === 'co-chat-input' || el.id === 'co-chat-search' || el.id === 'co-chat-picker-search';
  }

  function pickerOpen() {
    var picker = $('co-chat-picker');
    return !!(picker && picker.classList.contains('is-open') && !picker.hidden);
  }

  function syncIdle() {
    var root = $('co-chat');
    if (!root || !S.windowOpen) return;
    var idle = !S.hover && !isTyping() && !pickerOpen();
    root.classList.toggle('is-idle', idle);
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
    S.windowOpen = true;
    S.hover = true;
    syncIdle();
    syncNavOpen();
    setPickerOpen(false);
    await loadRooms();
  }

  function closeChatWindow() {
    var root = $('co-chat');
    saveLast();
    S.windowOpen = false;
    S.hover = false;
    if (root) {
      root.hidden = true;
      root.classList.remove('is-open', 'is-idle');
    }
    setPickerOpen(false);
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
    return room.title || 'Chat';
  }

  function roomSub(room) {
    if (!room) return '';
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
      setBadge(document.querySelector('[data-chat-tab-count="lobby"]'), S.unread.lobby);
      setBadge(document.querySelector('[data-chat-tab-count="direct"]'), S.unread.direct);
      setBadge(document.querySelector('[data-chat-tab-count="orders"]'), S.unread.orders);
      var n = Number(S.unread.total || 0);
      document.title = n > 0 ? '(' + n + ') ' + S.baseTitle : S.baseTitle;
    } catch (e) { /* ignore */ }
  }

  function renderRoomList() {
    var host = $('co-chat-room-list');
    if (!host) return;
    if (!S.rooms.length) {
      var empty = S.tab === 'direct'
        ? 'No direct messages yet. Click New message.'
        : (S.tab === 'orders'
          ? 'Order chats appear when a sales order is created.'
          : 'No conversations.');
      host.innerHTML = '<p class="co-chat-empty">' + esc(empty) + '</p>';
      return;
    }
    host.innerHTML = S.rooms.map(function (room) {
      var on = Number(room.id) === Number(S.roomId) ? ' is-on' : '';
      var unread = room.unreadCount > 0
        ? '<span class="co-chat-pip">' + (room.unreadCount > 99 ? '99+' : room.unreadCount) + '</span>'
        : '';
      var presence = '';
      if (room.kind === 'dm' && room.otherUser && S.presence[room.otherUser.id]) {
        var seen = new Date(S.presence[room.otherUser.id]).getTime();
        if (Date.now() - seen < 70000) presence = '<span class="co-chat-presence" title="Online"></span>';
      }
      var preview = room.lastMessagePreview || 'No messages yet';
      return '<button type="button" class="co-chat-room' + on + '" data-room-id="' + room.id + '">' +
        '<span class="co-chat-room-top"><span class="co-chat-room-title">' + presence + esc(roomTitle(room)) +
        '</span>' + unread + '</span>' +
        '<span class="co-chat-room-preview">' + esc(preview) + '</span>' +
        '<span class="co-chat-room-time">' + esc(fmtTime(room.lastMessageAt)) + '</span>' +
        '</button>';
    }).join('');
  }

  function renderMessages(hostId, messages) {
    var host = $(hostId);
    if (!host) return;
    if (!messages.length) {
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
    }).join('');
    host.scrollTop = host.scrollHeight;
  }

  async function loadRooms() {
    var q = ($('co-chat-search') && $('co-chat-search').value) || '';
    var data = await S.api('/api/admin/chat/rooms?tab=' + encodeURIComponent(S.tab) +
      '&q=' + encodeURIComponent(q));
    S.rooms = data.rooms || [];
    renderRoomList();
    if (!S.roomId && S.rooms.length) {
      await openRoom(S.rooms[0].id);
    } else if (S.roomId) {
      var still = S.rooms.some(function (r) { return Number(r.id) === Number(S.roomId); });
      if (!still && S.tab === 'lobby' && S.rooms[0]) await openRoom(S.rooms[0].id);
      else if (!still) {
        S.roomId = null;
        S.room = null;
        S.messages = [];
        renderEmptyMain();
      } else renderRoomList();
    } else {
      renderEmptyMain();
    }
  }

  function renderEmptyMain() {
    $('co-chat-main-title').textContent = S.tab === 'direct' ? 'Direct' : (S.tab === 'orders' ? 'Orders' : 'Lobby');
    $('co-chat-main-sub').textContent = S.tab === 'direct'
      ? 'Pick a teammate to start a private conversation.'
      : (S.tab === 'orders' ? 'Select an order thread.' : 'Everyone at Spectrum can see this.');
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
    $('co-chat-main-title').textContent = roomTitle(S.room);
    $('co-chat-main-sub').textContent = roomSub(S.room);
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

  async function sendMain(ev) {
    ev.preventDefault();
    if (!S.roomId) return;
    var body = String(($('co-chat-input') && $('co-chat-input').value) || '').trim();
    if (!body && !S.file) return;
    var fd = new FormData();
    fd.append('body', body);
    if (S.file) fd.append('file', S.file);
    await S.api('/api/admin/chat/rooms/' + S.roomId + '/messages', { method: 'POST', body: fd });
    $('co-chat-input').value = '';
    clearFile();
    await openRoom(S.roomId);
    await loadRooms();
  }

  async function pollOpenRoom() {
    if (document.hidden || !S.roomId || !hasChat() || !S.windowOpen) return;
    try {
      var data = await S.api('/api/admin/chat/rooms/' + S.roomId + '/messages?afterId=' + S.lastMsgId + '&limit=50');
      var msgs = data.messages || [];
      if (!msgs.length) return;
      S.messages = S.messages.concat(msgs);
      S.lastMsgId = S.messages.reduce(function (m, x) { return Math.max(m, Number(x.id) || 0); }, S.lastMsgId);
      renderMessages('co-chat-messages', S.messages);
      await S.api('/api/admin/chat/rooms/' + S.roomId + '/read', { method: 'POST' });
      loadRooms();
      refreshUnread();
    } catch (e) { /* ignore */ }
  }

  function setPickerOpen(open) {
    var picker = $('co-chat-picker');
    if (!picker) return;
    picker.hidden = !open;
    picker.classList.toggle('is-open', !!open);
    if (!open) picker.setAttribute('aria-hidden', 'true');
    else picker.removeAttribute('aria-hidden');
    syncIdle();
  }

  async function openPicker() {
    var data = await S.api('/api/admin/chat/users');
    S.users = data.users || [];
    setPickerOpen(true);
    $('co-chat-picker-search').value = '';
    renderPicker();
    if ($('co-chat-picker-search')) $('co-chat-picker-search').focus();
  }

  function renderPicker() {
    var q = String(($('co-chat-picker-search') && $('co-chat-picker-search').value) || '').toLowerCase();
    var list = S.users.filter(function (u) {
      if (!q) return true;
      return (u.name + ' ' + u.email).toLowerCase().indexOf(q) !== -1;
    });
    var host = $('co-chat-picker-list');
    host.innerHTML = list.length ? list.map(function (u) {
      return '<button type="button" class="co-chat-picker-row" data-user-id="' + u.id + '">' +
        '<strong>' + esc(u.name || u.email) + '</strong>' +
        '<span>' + esc(u.email) + (u.roleName ? ' · ' + esc(u.roleName) : '') + '</span></button>';
    }).join('') : '<p class="co-chat-empty">No teammates found.</p>';
  }

  async function startDm(userId) {
    var data = await S.api('/api/admin/chat/dm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: Number(userId) })
    });
    setPickerOpen(false);
    setTab('direct');
    await loadRooms();
    if (data.room) await openRoom(data.room.id);
  }

  function setTab(tab) {
    S.tab = tab;
    document.querySelectorAll('#co-chat .co-chat-tab').forEach(function (btn) {
      btn.classList.toggle('is-on', btn.getAttribute('data-chat-tab') === tab);
    });
    saveLast();
  }

  async function handleDeepLink() {
    var params = new URLSearchParams(location.search);
    var chat = params.get('chat') || (location.hash === '#chat' ? 'lobby' : '');
    if (!chat) return;
    await openChatWindow();
    if (chat === 'dm' && params.get('user_id')) {
      await startDm(params.get('user_id'));
    } else if (chat === 'order' && params.get('order_id')) {
      setTab('orders');
      var data = await S.api('/api/admin/chat/rooms/order/' + params.get('order_id'));
      await loadRooms();
      if (data.room) await openRoom(data.room.id);
    } else {
      setTab('lobby');
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

  function bindMain() {
    document.querySelectorAll('#co-chat .co-chat-tab').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        setTab(btn.getAttribute('data-chat-tab'));
        S.roomId = null;
        await loadRooms();
        saveLast();
      });
    });
    $('co-chat-room-list').addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-room-id]');
      if (btn) openRoom(btn.getAttribute('data-room-id'));
    });
    var searchTimer;
    $('co-chat-search').addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { loadRooms(); }, 200);
    });
    $('co-chat-composer').addEventListener('submit', function (ev) {
      sendMain(ev).catch(function (err) { alert(err.message || 'Could not send.'); });
    });
    $('co-chat-input').addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        $('co-chat-composer').requestSubmit();
      }
    });
    $('co-chat-attach').addEventListener('click', function () { $('co-chat-file').click(); });
    $('co-chat-file').addEventListener('change', function () {
      S.file = $('co-chat-file').files && $('co-chat-file').files[0];
      if (S.file) {
        $('co-chat-attach-name').hidden = false;
        $('co-chat-attach-name').textContent = S.file.name;
      } else clearFile();
    });
    $('co-chat-new').addEventListener('click', function () {
      openPicker().catch(function (err) { alert(err.message || 'Could not load users.'); });
    });
    $('co-chat-picker-close').addEventListener('click', function () { setPickerOpen(false); });
    $('co-chat-picker').addEventListener('click', function (ev) {
      if (ev.target === $('co-chat-picker')) setPickerOpen(false);
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      if ($('co-chat-picker') && $('co-chat-picker').classList.contains('is-open')) {
        setPickerOpen(false);
        syncIdle();
        return;
      }
      if (S.windowOpen) closeChatWindow();
    });
    $('co-chat-picker-search').addEventListener('input', renderPicker);
    $('co-chat-picker-list').addEventListener('click', function (ev) {
      var row = ev.target.closest('[data-user-id]');
      if (row) startDm(row.getAttribute('data-user-id')).catch(function (err) {
        alert(err.message || 'Could not start chat.');
      });
    });
    $('co-chat-messages').addEventListener('click', function (ev) {
      var del = ev.target.closest('[data-chat-del]');
      if (del) {
        S.api('/api/admin/chat/messages/' + del.getAttribute('data-chat-del'), { method: 'DELETE' })
          .then(function () { return openRoom(S.roomId); })
          .catch(function (err) { alert(err.message || 'Could not remove.'); });
      }
      var find = ev.target.closest('[data-chat-find-order]');
      if (find) {
        setTab('orders');
        $('co-chat-search').value = find.getAttribute('data-chat-find-order');
        loadRooms();
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
    bindSoTabs();
    bindWindow();
  }

  function bindWindow() {
    function onToggle(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (S.windowOpen) {
        S.hover = true;
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
      if (!root || !S.windowOpen) return;
      var r = root.getBoundingClientRect();
      var over = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
      if (over !== S.hover) {
        S.hover = over;
        syncIdle();
      }
    });
    ['co-chat-input', 'co-chat-search', 'co-chat-picker-search'].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener('focus', syncIdle);
      el.addEventListener('blur', function () { setTimeout(syncIdle, 0); });
    });
  }

  async function boot(opts) {
    if (S.booted) return;
    S.api = opts.api;
    S.admin = opts.admin;
    S.canUse = opts.canUse;
    S.openSalesDoc = opts.openSalesDoc || null;
    if (typeof opts.esc === 'function') S.esc = opts.esc;
    var root = $('co-chat');
    var nav = $('header-chat');
    var tabbar = $('tabbar-chat');
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
    setTab(S.tab || 'lobby');
    setPickerOpen(false);
    S.booted = true;
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
    S.timers.presence = setInterval(function () {
      if (document.hidden || !hasChat()) return;
      S.api('/api/admin/chat/presence', { method: 'POST' }).catch(function () {});
      var ids = S.rooms.filter(function (r) { return r.kind === 'dm' && r.otherUser; })
        .map(function (r) { return r.otherUser.id; });
      if (!ids.length) return;
      S.api('/api/admin/chat/presence?ids=' + ids.join(',')).then(function (data) {
        S.presence = data.presence || {};
        renderRoomList();
      }).catch(function () {});
    }, 30000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) {
        refreshUnread();
        if (S.roomId) pollOpenRoom();
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
    close: closeChatWindow
  };
})(window);
