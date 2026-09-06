'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  hasPerm,
  parseMenuAccess,
  serializeMenuAccess,
  defaultMenuAccess,
  menuFromLegacy,
  canAccess,
  isOwnerAdmin
} = require('./admin-roles');
const chatAi = require('./chat-ai');

const BODY_MAX = 4000;
const PREVIEW_MAX = 140;
const EDIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 1000;
const IMAGE_MAX = 8 * 1024 * 1024;
const FILE_MAX = 12 * 1024 * 1024;

const IMAGE_MIME = {
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/gif': 'image'
};

const FILE_MIME = {
  'application/pdf': 'file',
  'text/csv': 'file',
  'text/plain': 'file',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'file',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'file'
};

const EXT_OK = {
  '.jpg': 'image',
  '.jpeg': 'image',
  '.png': 'image',
  '.webp': 'image',
  '.gif': 'image',
  '.pdf': 'file',
  '.csv': 'file',
  '.txt': 'file',
  '.xlsx': 'file',
  '.docx': 'file'
};

const rateBuckets = new Map();

function nowIso() {
  return new Date().toISOString();
}

function trim(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max || 240);
}

function previewText(body) {
  const text = String(body || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > PREVIEW_MAX ? text.slice(0, PREVIEW_MAX - 1) + '…' : text;
}

function dmPair(a, b) {
  const x = Number(a);
  const y = Number(b);
  if (!x || !y || x === y) return null;
  return x < y ? { low: x, high: y } : { low: y, high: x };
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function checkRate(userId) {
  const id = String(userId);
  const now = Date.now();
  let times = rateBuckets.get(id) || [];
  times = times.filter(function (t) {
    return now - t < RATE_WINDOW_MS;
  });
  if (times.length >= RATE_LIMIT) {
    throw httpError(429, 'Slow down — too many messages.');
  }
  times.push(now);
  rateBuckets.set(id, times);
}

function classifyAttachment(file) {
  if (!file) return null;
  const mime = String(file.mimetype || '').toLowerCase();
  const ext = path.extname(file.originalname || '').toLowerCase();
  const kind = IMAGE_MIME[mime] || FILE_MIME[mime] || EXT_OK[ext];
  if (!kind) {
    throw httpError(400, 'That file type is not allowed.');
  }
  const size = Number(file.size || (file.buffer && file.buffer.length) || 0);
  const max = kind === 'image' ? IMAGE_MAX : FILE_MAX;
  if (size > max) {
    throw httpError(
      400,
      kind === 'image' ? 'Images must be 8 MB or smaller.' : 'Files must be 12 MB or smaller.'
    );
  }
  return kind;
}

function normalizeBody(raw, hasAttachment) {
  const body = String(raw == null ? '' : raw);
  if (body.length > BODY_MAX) {
    throw httpError(400, 'Messages can be at most 4,000 characters.');
  }
  const trimmed = body.trim();
  if (!trimmed && !hasAttachment) {
    throw httpError(400, 'Type a message or attach a file.');
  }
  return trimmed || '';
}

function formatUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name || row.email || 'Staff',
    email: row.email || '',
    role: row.role || '',
    roleName: row.role_name || row.roleName || row.role || ''
  };
}

function formatRoom(row, extras) {
  if (!row) return null;
  const extra = extras || {};
  const kind = row.kind;
  let title = row.title || '';
  if (kind === 'copilot') {
    title = 'Copilot';
  } else if (kind === 'lobby') {
    title = 'Lobby';
  } else if (kind === 'dm') {
    const other = extra.otherUser;
    title = other ? (other.name || other.email || 'Direct message') : 'Direct message';
  } else if (kind === 'order' && String(row.order_status || '') === 'cancelled') {
    if (title && title.indexOf('(cancelled)') === -1) {
      title = title + ' (cancelled)';
    }
  }
  const pinRank = kind === 'copilot' ? 0 : (kind === 'lobby' ? 1 : 9);
  return {
    id: row.id,
    kind: kind,
    title: title,
    salesOrderId: row.sales_order_id || null,
    customerName: row.customer_name || '',
    orderStatus: row.order_status || '',
    lastMessageAt: row.last_message_at || null,
    lastMessagePreview: row.last_message_preview || '',
    lastMessageUserId: row.last_message_user_id || null,
    unreadCount: Number(extra.unreadCount || 0),
    muted: !!extra.muted,
    otherUser: kind === 'dm' ? (extra.otherUser || null) : null,
    createdAt: row.created_at || null,
    pinned: pinRank < 9,
    pinRank: pinRank
  };
}

function formatMessage(row, usersById, extras) {
  if (!row) return null;
  const deleted = !!row.deleted_at;
  const isCopilot = !!(extras && extras.copilot) && !row.user_id;
  const user = row.user_id ? ((usersById && usersById[row.user_id]) || null) : null;
  return {
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id || null,
    user: isCopilot ? { id: null, name: 'Copilot', email: '', role: '' } : user,
    body: deleted ? '' : (row.body || ''),
    attachmentUrl: deleted ? null : (row.attachment_url || null),
    attachmentName: deleted ? null : (row.attachment_name || null),
    attachmentType: deleted ? 'none' : (row.attachment_type || 'none'),
    createdAt: row.created_at,
    editedAt: row.edited_at || null,
    deletedAt: row.deleted_at || null,
    deletedByUserId: row.deleted_by_user_id || null,
    isSystem: !row.user_id && !isCopilot,
    isCopilot: isCopilot,
    isDeleted: deleted
  };
}

function canModerateLobbyOrOrder(admin) {
  return isOwnerAdmin(admin) || hasPerm(admin, 'staff', 'edit');
}

function sortRoomsUnreadFirst(rooms) {
  rooms.sort(function (a, b) {
    if ((b.unreadCount > 0) !== (a.unreadCount > 0)) {
      return b.unreadCount > 0 ? 1 : -1;
    }
    const at = a.lastMessageAt || '';
    const bt = b.lastMessageAt || '';
    if (at === bt) return Number(b.id) - Number(a.id);
    if (!at) return 1;
    if (!bt) return -1;
    return bt > at ? 1 : -1;
  });
  return rooms;
}

function contactStub(user) {
  return {
    id: null,
    kind: 'dm',
    title: (user && (user.name || user.email)) || 'Staff',
    salesOrderId: null,
    customerName: '',
    orderStatus: '',
    lastMessageAt: null,
    lastMessagePreview: '',
    lastMessageUserId: null,
    unreadCount: 0,
    muted: false,
    otherUser: user || null,
    createdAt: null,
    pinned: false,
    contactUserId: user && user.id ? user.id : null
  };
}

function matchesContactQuery(room, q) {
  if (!q) return true;
  const hay = [
    room.title || '',
    room.kind === 'lobby' ? 'chat lobby' : '',
    room.kind === 'copilot' ? 'copilot assistant ai' : '',
    room.otherUser && room.otherUser.name,
    room.otherUser && room.otherUser.email
  ].join(' ').toLowerCase();
  return hay.indexOf(q) !== -1;
}

function sortContacts(rooms) {
  rooms.sort(function (a, b) {
    const ar = a.pinRank != null ? a.pinRank : (a.pinned ? 1 : 9);
    const br = b.pinRank != null ? b.pinRank : (b.pinned ? 1 : 9);
    if (ar !== br) return ar - br;
    const at = a.lastMessageAt || '';
    const bt = b.lastMessageAt || '';
    if (at !== bt) {
      if (!at) return 1;
      if (!bt) return -1;
      return bt > at ? 1 : -1;
    }
    const an = String(a.title || '').toLowerCase();
    const bn = String(b.title || '').toLowerCase();
    if (an !== bn) return an < bn ? -1 : 1;
    return Number(b.id || 0) - Number(a.id || 0);
  });
  return rooms;
}

function buildContactList(copilotRoom, lobbyRoom, dmRooms, users, query) {
  const q = String(query || '').trim().toLowerCase();
  const dms = dmRooms || [];
  const dmsByUser = {};
  dms.forEach(function (room) {
    if (room.otherUser && room.otherUser.id) {
      dmsByUser[Number(room.otherUser.id)] = room;
    }
  });
  const seen = {};
  const out = [];
  if (copilotRoom) out.push(copilotRoom);
  if (lobbyRoom) out.push(lobbyRoom);
  (users || []).forEach(function (user) {
    const id = Number(user.id);
    seen[id] = true;
    out.push(dmsByUser[id] || contactStub(user));
  });
  dms.forEach(function (room) {
    const oid = room.otherUser && Number(room.otherUser.id);
    if (oid && !seen[oid]) out.push(room);
  });
  const filtered = q ? out.filter(function (room) {
    return matchesContactQuery(room, q);
  }) : out;
  return sortContacts(filtered);
}

function assertRoomAccess(room, admin) {
  if (!room) {
    throw httpError(404, 'Chat room not found.');
  }
  if (room.kind === 'copilot') {
    if (Number(room.dm_user_low_id) !== Number(admin.id)) {
      throw httpError(403, 'You do not have access to this conversation.');
    }
  }
  if (room.kind === 'dm') {
    const uid = Number(admin.id);
    if (uid !== Number(room.dm_user_low_id) && uid !== Number(room.dm_user_high_id)) {
      throw httpError(403, 'You do not have access to this conversation.');
    }
  }
  return room;
}

function orderRoomTitle(doc) {
  return (doc && (doc.number || doc.title)) || ('Order #' + (doc && doc.id));
}

function orderCustomerName(doc) {
  return (doc && (doc.customerName || doc.customer_name)) || '';
}

function systemMessageBody(kind, detail, actorName, doc) {
  const who = actorName || 'Staff';
  if (kind === 'status') {
    const label = String(detail || (doc && doc.status) || '').replace(/_/g, ' ');
    return 'Status set to ' + label + ' by ' + who;
  }
  if (kind === 'tracking') {
    return 'Tracking number added by ' + who + (detail ? (': ' + detail) : '');
  }
  return String(detail || '');
}

function grantChatOnRoles(db) {
  const roles = require('./admin-roles');
  const rows = db.prepare(
    'SELECT id, slug, website_access, inventory_access, menu_access, locked FROM admin_roles'
  ).all();
  const update = db.prepare('UPDATE admin_roles SET menu_access = ? WHERE id = ?');
  rows.forEach(function (row) {
    if (row.locked || row.slug === 'owner') {
      update.run(roles.serializeMenuAccess(roles.defaultMenuAccess('edit')), row.id);
      return;
    }
    let menu = roles.parseMenuAccess(row.menu_access);
    if (!menu) {
      menu = roles.menuFromLegacy(row.website_access, row.inventory_access, false);
    }
    if (!roles.canAccess(menu.chat, 'view')) menu.chat = 'edit';
    update.run(roles.serializeMenuAccess(menu), row.id);
  });
}

function ensureCompanyChat(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      sales_order_id INTEGER,
      dm_user_low_id INTEGER,
      dm_user_high_id INTEGER,
      title TEXT NOT NULL DEFAULT '',
      customer_name TEXT NOT NULL DEFAULT '',
      order_status TEXT NOT NULL DEFAULT '',
      last_message_at TEXT,
      last_message_preview TEXT NOT NULL DEFAULT '',
      last_message_user_id INTEGER,
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_lobby_uidx
      ON chat_rooms (kind) WHERE kind = 'lobby';
    CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_copilot_uidx
      ON chat_rooms (dm_user_low_id) WHERE kind = 'copilot';
    CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_order_uidx
      ON chat_rooms (sales_order_id) WHERE kind = 'order';
    CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_dm_uidx
      ON chat_rooms (dm_user_low_id, dm_user_high_id) WHERE kind = 'dm';
    CREATE INDEX IF NOT EXISTS chat_rooms_kind_last_idx ON chat_rooms (kind, last_message_at);

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      user_id INTEGER,
      body TEXT NOT NULL DEFAULT '',
      attachment_url TEXT,
      attachment_name TEXT,
      attachment_type TEXT NOT NULL DEFAULT 'none',
      created_at TEXT NOT NULL,
      edited_at TEXT,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS chat_messages_room_idx ON chat_messages (room_id, created_at, id);

    CREATE TABLE IF NOT EXISTS chat_room_reads (
      user_id INTEGER NOT NULL,
      room_id INTEGER NOT NULL,
      last_read_at TEXT NOT NULL,
      muted INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, room_id)
    );

    CREATE TABLE IF NOT EXISTS chat_presence (
      user_id INTEGER PRIMARY KEY,
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS copilot_drafts (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      room_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      payload TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending',
      result_id TEXT,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );
    CREATE INDEX IF NOT EXISTS copilot_drafts_user_idx ON copilot_drafts (user_id, created_at);

    CREATE TABLE IF NOT EXISTS copilot_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      room_id INTEGER,
      action TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS copilot_audit_user_idx ON copilot_audit (user_id, created_at);

    CREATE TABLE IF NOT EXISTS chat_ai_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled INTEGER NOT NULL DEFAULT 0,
      allow_in_dms INTEGER NOT NULL DEFAULT 0,
      provider TEXT NOT NULL DEFAULT 'anthropic',
      model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
      api_key_ciphertext TEXT,
      api_key_last4 TEXT,
      updated_by_user_id INTEGER,
      updated_at TEXT NOT NULL
    );
  `);
  const aiRow = db.prepare('SELECT id FROM chat_ai_settings WHERE id = 1').get();
  if (!aiRow) {
    db.prepare(`
      INSERT INTO chat_ai_settings (id, enabled, allow_in_dms, provider, model, updated_at)
      VALUES (1, 0, 0, 'anthropic', 'claude-sonnet-4-6', ?)
    `).run(nowIso());
  }

  const stamp = nowIso();
  const lobby = db.prepare("SELECT id FROM chat_rooms WHERE kind = 'lobby' LIMIT 1").get();
  if (!lobby) {
    db.prepare(
      "INSERT INTO chat_rooms (kind, title, created_at) VALUES ('lobby', 'Lobby', ?)"
    ).run(stamp);
  }

  const missingOrders = db.prepare(`
    SELECT d.id, d.number, d.customer_name, d.status
    FROM company_sales_docs d
    WHERE d.type = 'order'
      AND NOT EXISTS (
        SELECT 1 FROM chat_rooms r WHERE r.kind = 'order' AND r.sales_order_id = d.id
      )
  `).all();
  const insertOrderRoom = db.prepare(`
    INSERT INTO chat_rooms (
      kind, sales_order_id, title, customer_name, order_status, created_at
    ) VALUES ('order', ?, ?, ?, ?, ?)
  `);
  missingOrders.forEach(function (doc) {
    insertOrderRoom.run(
      doc.id,
      doc.number || ('Order #' + doc.id),
      doc.customer_name || '',
      doc.status || '',
      stamp
    );
  });

  grantChatOnRoles(db);

  const lobbyRow = db.prepare("SELECT id FROM chat_rooms WHERE kind = 'lobby' LIMIT 1").get();
  if (lobbyRow) {
    const enroll = db.prepare(
      'INSERT OR IGNORE INTO chat_room_reads (user_id, room_id, last_read_at, muted) VALUES (?, ?, ?, 0)'
    );
    db.prepare('SELECT id FROM admins').all().forEach(function (row) {
      enroll.run(row.id, lobbyRow.id, stamp);
    });
  }
}

function unreadCountSql() {
  return `
    SELECT COUNT(*) AS n FROM chat_messages m
    WHERE m.room_id = ?
      AND m.deleted_at IS NULL
      AND (m.user_id IS NULL OR m.user_id != ?)
      AND m.created_at > COALESCE(?, '1970-01-01')
  `;
}

function sqliteApi(db) {
  const ROOT = path.join(__dirname, '..');
  const CHAT_UPLOAD_DIR = path.join(ROOT, 'uploads', 'chat');
  fs.mkdirSync(CHAT_UPLOAD_DIR, { recursive: true });

  function getAdminRow(id) {
    return db.prepare(`
      SELECT a.id, a.email, a.name, a.role, r.name AS role_name,
        r.website_access, r.inventory_access, r.menu_access, r.locked AS role_locked
      FROM admins a
      LEFT JOIN admin_roles r ON r.slug = a.role
      WHERE a.id = ?
    `).get(id) || null;
  }

  function usersMap(ids) {
    const map = {};
    const uniq = Array.from(new Set((ids || []).filter(Boolean).map(Number)));
    if (!uniq.length) return map;
    const placeholders = uniq.map(function () { return '?'; }).join(',');
    db.prepare(`
      SELECT a.id, a.email, a.name, a.role, r.name AS role_name
      FROM admins a
      LEFT JOIN admin_roles r ON r.slug = a.role
      WHERE a.id IN (${placeholders})
    `).all(...uniq).forEach(function (row) {
      map[row.id] = formatUser(row);
    });
    return map;
  }

  function getRoomRow(id) {
    return db.prepare('SELECT * FROM chat_rooms WHERE id = ?').get(id) || null;
  }

  function getRead(userId, roomId) {
    return db.prepare(
      'SELECT * FROM chat_room_reads WHERE user_id = ? AND room_id = ?'
    ).get(userId, roomId) || null;
  }

  function ensureReadRow(userId, roomId) {
    const existing = getRead(userId, roomId);
    if (existing) return existing;
    db.prepare(
      'INSERT OR IGNORE INTO chat_room_reads (user_id, room_id, last_read_at, muted) VALUES (?, ?, ?, 0)'
    ).run(userId, roomId, nowIso());
    return getRead(userId, roomId);
  }

  function roomUnread(userId, roomId) {
    const read = getRead(userId, roomId);
    const row = db.prepare(unreadCountSql()).get(roomId, userId, read && read.last_read_at);
    return Number(row && row.n) || 0;
  }

  function enrichRoom(row, viewerId) {
    if (!row) return null;
    const extras = {
      unreadCount: roomUnread(viewerId, row.id),
      muted: !!(getRead(viewerId, row.id) || {}).muted
    };
    if (row.kind === 'dm') {
      const otherId = Number(row.dm_user_low_id) === Number(viewerId)
        ? row.dm_user_high_id
        : row.dm_user_low_id;
      extras.otherUser = formatUser(getAdminRow(otherId));
    }
    return formatRoom(row, extras);
  }

  function saveChatFile(file) {
    const kind = classifyAttachment(file);
    const ext = path.extname(file.originalname || '').toLowerCase() ||
      (kind === 'image' ? '.jpg' : '.bin');
    const name = Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex') + ext;
    fs.writeFileSync(path.join(CHAT_UPLOAD_DIR, name), file.buffer);
    return {
      url: '/uploads/chat/' + name,
      name: trim(file.originalname || name, 180),
      type: kind
    };
  }

  function touchRoom(roomId, preview, userId, at) {
    db.prepare(`
      UPDATE chat_rooms
      SET last_message_at = ?, last_message_preview = ?, last_message_user_id = ?
      WHERE id = ?
    `).run(at, preview || '', userId || null, roomId);
  }

  function insertMessage(roomId, userId, body, attachment, at) {
    const info = db.prepare(`
      INSERT INTO chat_messages (
        room_id, user_id, body, attachment_url, attachment_name, attachment_type, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      roomId,
      userId || null,
      body || '',
      (attachment && attachment.url) || null,
      (attachment && attachment.name) || null,
      (attachment && attachment.type) || 'none',
      at
    );
    const preview = previewText(body) || (attachment && attachment.name) || '';
    touchRoom(roomId, preview, userId || null, at);
    return db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(info.lastInsertRowid);
  }

  function refreshRoomPreview(roomId) {
    const latest = db.prepare(`
      SELECT * FROM chat_messages
      WHERE room_id = ? AND deleted_at IS NULL
      ORDER BY id DESC LIMIT 1
    `).get(roomId);
    if (!latest) {
      touchRoom(roomId, '', null, null);
      return;
    }
    touchRoom(
      roomId,
      previewText(latest.body) || latest.attachment_name || '',
      latest.user_id,
      latest.created_at
    );
  }

  function ensureCopilotRoomRow(userId) {
    let row = db.prepare(
      "SELECT * FROM chat_rooms WHERE kind = 'copilot' AND dm_user_low_id = ? LIMIT 1"
    ).get(userId);
    if (row) {
      ensureReadRow(userId, row.id);
      return row;
    }
    const stamp = nowIso();
    const info = db.prepare(`
      INSERT INTO chat_rooms (
        kind, dm_user_low_id, title, created_at
      ) VALUES ('copilot', ?, 'Copilot', ?)
    `).run(userId, stamp);
    row = getRoomRow(info.lastInsertRowid);
    ensureReadRow(userId, row.id);
    const welcome = require('./copilot').WELCOME;
    insertMessage(row.id, null, welcome, null, stamp);
    return row;
  }

  function formatDraftRow(row) {
    if (!row) return null;
    let payload = {};
    try { payload = JSON.parse(row.payload || '{}'); } catch (e) { payload = {}; }
    return {
      token: row.token,
      userId: row.user_id,
      roomId: row.room_id,
      kind: row.kind,
      summary: row.summary || '',
      payload: payload,
      status: row.status || 'pending',
      resultId: row.result_id || null,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at || null
    };
  }

  return {
    async listChatRooms(admin, tab, query) {
      ensureCompanyChat(db);
      const viewerId = admin.id;
      const q = trim(query, 80).toLowerCase();
      let rows = [];

      if (tab === 'orders') {
        rows = db.prepare("SELECT * FROM chat_rooms WHERE kind = 'order'").all();
        if (q) {
          rows = rows.filter(function (row) {
            const hay = (row.title || '') + ' ' + (row.customer_name || '');
            return hay.toLowerCase().indexOf(q) !== -1;
          });
        }
        return sortRoomsUnreadFirst(rows.map(function (row) {
          return enrichRoom(row, viewerId);
        }));
      }

      const copilotRow = ensureCopilotRoomRow(viewerId);
      const lobbyRow = db.prepare("SELECT * FROM chat_rooms WHERE kind = 'lobby' LIMIT 1").get();
      const dmRows = db.prepare(`
        SELECT * FROM chat_rooms
        WHERE kind = 'dm' AND (dm_user_low_id = ? OR dm_user_high_id = ?)
      `).all(viewerId, viewerId);
      const copilot = copilotRow ? enrichRoom(copilotRow, viewerId) : null;
      const lobby = lobbyRow ? enrichRoom(lobbyRow, viewerId) : null;
      const dms = dmRows.map(function (row) { return enrichRoom(row, viewerId); });
      const users = await this.listChatUsers(admin);
      return buildContactList(copilot, lobby, dms, users, q);
    },

    async getChatRoom(admin, roomId) {
      ensureCompanyChat(db);
      return enrichRoom(assertRoomAccess(getRoomRow(roomId), admin), admin.id);
    },

    async getChatRoomByOrder(admin, orderId) {
      ensureCompanyChat(db);
      let row = db.prepare(
        "SELECT * FROM chat_rooms WHERE kind = 'order' AND sales_order_id = ?"
      ).get(orderId);
      if (!row) {
        const doc = db.prepare(
          "SELECT * FROM company_sales_docs WHERE id = ? AND type = 'order'"
        ).get(orderId);
        if (!doc) return null;
        row = await this.ensureOrderChatRoom(doc);
      }
      if (!row) return null;
      return enrichRoom(assertRoomAccess(row, admin), admin.id);
    },

    async ensureOrderChatRoom(doc) {
      ensureCompanyChat(db);
      if (!doc || !doc.id) return null;
      if (doc.type != null && doc.type !== 'order') return null;

      const existing = db.prepare(
        "SELECT * FROM chat_rooms WHERE kind = 'order' AND sales_order_id = ?"
      ).get(doc.id);
      const title = orderRoomTitle(doc);
      const customer = orderCustomerName(doc);
      const status = doc.status || '';

      if (existing) {
        db.prepare(`
          UPDATE chat_rooms SET title = ?, customer_name = ?, order_status = ? WHERE id = ?
        `).run(title, customer, status, existing.id);
        return getRoomRow(existing.id);
      }

      const info = db.prepare(`
        INSERT INTO chat_rooms (
          kind, sales_order_id, title, customer_name, order_status, created_at
        ) VALUES ('order', ?, ?, ?, ?, ?)
      `).run(doc.id, title, customer, status || 'draft', nowIso());
      return getRoomRow(info.lastInsertRowid);
    },

    async findOrCreateDm(admin, otherUserId) {
      ensureCompanyChat(db);
      const otherId = Number(otherUserId);
      if (!otherId || otherId === Number(admin.id)) {
        throw httpError(400, 'Pick someone else.');
      }
      const other = getAdminRow(otherId);
      if (!other) {
        throw httpError(404, 'That person was not found.');
      }

      const pair = dmPair(admin.id, otherId);
      let row = db.prepare(`
        SELECT * FROM chat_rooms
        WHERE kind = 'dm' AND dm_user_low_id = ? AND dm_user_high_id = ?
      `).get(pair.low, pair.high);

      if (!row) {
        const info = db.prepare(`
          INSERT INTO chat_rooms (
            kind, dm_user_low_id, dm_user_high_id, title, created_at
          ) VALUES ('dm', ?, ?, '', ?)
        `).run(pair.low, pair.high, nowIso());
        row = getRoomRow(info.lastInsertRowid);
      }

      ensureReadRow(admin.id, row.id);
      ensureReadRow(otherId, row.id);
      return enrichRoom(row, admin.id);
    },

    async listChatMessages(admin, roomId, opts) {
      ensureCompanyChat(db);
      const room = assertRoomAccess(getRoomRow(roomId), admin);
      const afterId = opts && opts.afterId ? Number(opts.afterId) : 0;
      const limit = Math.min(200, Math.max(1, Number((opts && opts.limit) || 100)));
      let rows;
      if (afterId) {
        rows = db.prepare(`
          SELECT * FROM chat_messages
          WHERE room_id = ? AND id > ?
          ORDER BY id ASC
          LIMIT ?
        `).all(room.id, afterId, limit);
      } else {
        rows = db.prepare(`
          SELECT * FROM chat_messages
          WHERE room_id = ?
          ORDER BY id DESC
          LIMIT ?
        `).all(room.id, limit).reverse();
      }
      const map = usersMap(rows.map(function (r) { return r.user_id; }));
      const extras = room.kind === 'copilot' ? { copilot: true } : null;
      return {
        room: enrichRoom(room, admin.id),
        messages: rows.map(function (r) { return formatMessage(r, map, extras); })
      };
    },

    async sendChatMessage(admin, roomId, payload, file) {
      ensureCompanyChat(db);
      checkRate(admin.id);
      const room = assertRoomAccess(getRoomRow(roomId), admin);
      let attachment = null;
      if (file) attachment = saveChatFile(file);
      const body = normalizeBody(payload && payload.body, !!attachment);
      const stamp = nowIso();
      const row = insertMessage(room.id, admin.id, body, attachment, stamp);
      ensureReadRow(admin.id, room.id);
      db.prepare(
        'UPDATE chat_room_reads SET last_read_at = ? WHERE user_id = ? AND room_id = ?'
      ).run(stamp, admin.id, room.id);
      return formatMessage(row, usersMap([admin.id]));
    },

    async editChatMessage(admin, messageId, bodyRaw) {
      ensureCompanyChat(db);
      const row = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(messageId);
      if (!row || row.deleted_at) {
        throw httpError(404, 'Message not found.');
      }
      if (!row.user_id || Number(row.user_id) !== Number(admin.id)) {
        throw httpError(403, 'You can only edit your own messages.');
      }
      const room = assertRoomAccess(getRoomRow(row.room_id), admin);
      const created = new Date(row.created_at).getTime();
      if (!Number.isFinite(created) || Date.now() - created > EDIT_WINDOW_MS) {
        throw httpError(400, 'Edit window has passed.');
      }
      const hasAttachment = !!(row.attachment_url && row.attachment_type && row.attachment_type !== 'none');
      const body = normalizeBody(bodyRaw, hasAttachment);
      const stamp = nowIso();
      db.prepare('UPDATE chat_messages SET body = ?, edited_at = ? WHERE id = ?')
        .run(body, stamp, messageId);
      const latest = db.prepare(`
        SELECT id FROM chat_messages
        WHERE room_id = ? AND deleted_at IS NULL
        ORDER BY id DESC LIMIT 1
      `).get(room.id);
      if (latest && Number(latest.id) === Number(messageId)) {
        touchRoom(room.id, previewText(body) || row.attachment_name || '', admin.id, row.created_at);
      }
      const updated = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(messageId);
      return formatMessage(updated, usersMap([admin.id]));
    },

    async deleteChatMessage(admin, messageId) {
      ensureCompanyChat(db);
      const row = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(messageId);
      if (!row) {
        throw httpError(404, 'Message not found.');
      }
      if (row.deleted_at) {
        return formatMessage(row, usersMap([row.user_id]));
      }
      const room = assertRoomAccess(getRoomRow(row.room_id), admin);
      const isAuthor = !!(row.user_id && Number(row.user_id) === Number(admin.id));

      if (room.kind === 'dm') {
        if (!isAuthor) {
          throw httpError(403, 'Only the author can remove a direct message.');
        }
      } else if (room.kind === 'copilot') {
        /* room owner may remove Copilot replies or their own messages */
      } else if (!isAuthor && !canModerateLobbyOrOrder(admin)) {
        throw httpError(403, 'You cannot remove this message.');
      }

      const stamp = nowIso();
      db.prepare(`
        UPDATE chat_messages
        SET deleted_at = ?, deleted_by_user_id = ?,
            body = '', attachment_url = NULL, attachment_name = NULL, attachment_type = 'none'
        WHERE id = ?
      `).run(stamp, admin.id, messageId);
      refreshRoomPreview(room.id);
      const updated = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(messageId);
      return formatMessage(updated, usersMap([updated.user_id, admin.id]));
    },

    async markChatRoomRead(admin, roomId) {
      ensureCompanyChat(db);
      const room = assertRoomAccess(getRoomRow(roomId), admin);
      const stamp = nowIso();
      ensureReadRow(admin.id, room.id);
      db.prepare(
        'UPDATE chat_room_reads SET last_read_at = ? WHERE user_id = ? AND room_id = ?'
      ).run(stamp, admin.id, room.id);
      return { ok: true, lastReadAt: stamp };
    },

    async chatUnreadSummary(admin) {
      ensureCompanyChat(db);
      const viewerId = admin.id;
      const lobby = db.prepare("SELECT id FROM chat_rooms WHERE kind = 'lobby' LIMIT 1").get();
      const dms = db.prepare(`
        SELECT id FROM chat_rooms
        WHERE kind = 'dm' AND (dm_user_low_id = ? OR dm_user_high_id = ?)
      `).all(viewerId, viewerId);
      const copilot = db.prepare(
        "SELECT id FROM chat_rooms WHERE kind = 'copilot' AND dm_user_low_id = ? LIMIT 1"
      ).get(viewerId);
      const orders = db.prepare("SELECT id FROM chat_rooms WHERE kind = 'order'").all();

      let lobbyCount = 0;
      let dmCount = 0;
      let orderCount = 0;
      let copilotCount = 0;
      if (lobby) lobbyCount = roomUnread(viewerId, lobby.id);
      if (copilot) copilotCount = roomUnread(viewerId, copilot.id);
      dms.forEach(function (r) { dmCount += roomUnread(viewerId, r.id); });
      orders.forEach(function (r) { orderCount += roomUnread(viewerId, r.id); });

      return {
        total: lobbyCount + dmCount + orderCount + copilotCount,
        lobby: lobbyCount,
        direct: dmCount,
        orders: orderCount,
        copilot: copilotCount
      };
    },

    async listChatUsers(admin) {
      ensureCompanyChat(db);
      const rows = db.prepare(`
        SELECT a.id, a.email, a.name, a.role, r.name AS role_name,
          r.website_access, r.inventory_access, r.menu_access, r.locked AS role_locked
        FROM admins a
        LEFT JOIN admin_roles r ON r.slug = a.role
        ORDER BY a.name COLLATE NOCASE, a.email
      `).all();
      return rows.filter(function (row) {
        return Number(row.id) !== Number(admin.id);
      }).map(formatUser);
    },

    async enrollChatUser(user, opts) {
      ensureCompanyChat(db);
      if (!user || !user.id) return null;
      const lobby = db.prepare("SELECT id FROM chat_rooms WHERE kind = 'lobby' LIMIT 1").get();
      if (!lobby) return null;
      ensureReadRow(user.id, lobby.id);
      ensureCopilotRoomRow(user.id);
      if (opts && opts.announce) {
        const name = user.name || user.email || 'Staff';
        insertMessage(lobby.id, null, name + ' joined Lobby', null, nowIso());
      }
      return true;
    },

    async touchChatPresence(admin) {
      ensureCompanyChat(db);
      const stamp = nowIso();
      db.prepare(`
        INSERT INTO chat_presence (user_id, last_seen_at) VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET last_seen_at = excluded.last_seen_at
      `).run(admin.id, stamp);
      return { lastSeenAt: stamp };
    },

    async listChatPresence(_admin, userIds) {
      ensureCompanyChat(db);
      const ids = (userIds || []).map(Number).filter(Boolean);
      let rows;
      if (!ids.length) {
        rows = db.prepare('SELECT * FROM chat_presence').all();
      } else {
        const placeholders = ids.map(function () { return '?'; }).join(',');
        rows = db.prepare(
          'SELECT * FROM chat_presence WHERE user_id IN (' + placeholders + ')'
        ).all(...ids);
      }
      const out = {};
      rows.forEach(function (r) { out[r.user_id] = r.last_seen_at; });
      return out;
    },

    async appendOrderChatSystem(doc, actorName, kind, detail) {
      ensureCompanyChat(db);
      if (!doc || (doc.type != null && doc.type !== 'order')) return null;
      const room = await this.ensureOrderChatRoom(doc);
      if (!room) return null;
      const body = systemMessageBody(kind, detail, actorName, doc);
      if (!body) return null;
      const stamp = nowIso();
      insertMessage(room.id, null, body, null, stamp);
      db.prepare(
        'UPDATE chat_rooms SET order_status = ?, title = ?, customer_name = ? WHERE id = ?'
      ).run(
        doc.status || room.order_status || '',
        orderRoomTitle(doc) || room.title,
        orderCustomerName(doc) || room.customer_name || '',
        room.id
      );
      return true;
    },

    async appendCopilotMessage(admin, roomId, body) {
      ensureCompanyChat(db);
      const room = assertRoomAccess(getRoomRow(roomId), admin);
      if (room.kind !== 'copilot') {
        throw httpError(400, 'Copilot can only reply in Copilot chat.');
      }
      const stamp = nowIso();
      const row = insertMessage(room.id, null, String(body || '').slice(0, 8000), null, stamp);
      return formatMessage(row, {}, { copilot: true });
    },

    async saveCopilotDraft(admin, roomId, kind, payload, summary) {
      ensureCompanyChat(db);
      const token = crypto.randomBytes(16).toString('hex');
      db.prepare(`
        INSERT INTO copilot_drafts (
          token, user_id, room_id, kind, summary, payload, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
      `).run(
        token,
        admin.id,
        roomId || null,
        String(kind || 'draft'),
        trim(summary, 400),
        JSON.stringify(payload || {}),
        nowIso()
      );
      return token;
    },

    async getCopilotDraft(admin, token) {
      ensureCompanyChat(db);
      const row = db.prepare('SELECT * FROM copilot_drafts WHERE token = ?').get(token);
      return formatDraftRow(row);
    },

    async resolveCopilotDraft(admin, token, status, resultId) {
      ensureCompanyChat(db);
      db.prepare(
        'UPDATE copilot_drafts SET status = ?, result_id = ?, resolved_at = ? WHERE token = ? AND user_id = ?'
      ).run(status || 'discarded', resultId || null, nowIso(), token, admin.id);
      return formatDraftRow(db.prepare('SELECT * FROM copilot_drafts WHERE token = ?').get(token));
    },

    async logCopilotAudit(admin, roomId, action, detail) {
      ensureCompanyChat(db);
      db.prepare(
        'INSERT INTO copilot_audit (user_id, room_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(admin && admin.id || null, roomId || null, String(action || ''), JSON.stringify(detail || {}), nowIso());
      return true;
    },

    async getChatAiSettings(_admin) {
      ensureCompanyChat(db);
      const row = db.prepare('SELECT * FROM chat_ai_settings WHERE id = 1').get();
      return chatAi.assertNoSecretLeak(chatAi.publicSettings(row));
    },

    async saveChatAiSettings(admin, body) {
      ensureCompanyChat(db);
      const row = db.prepare('SELECT * FROM chat_ai_settings WHERE id = 1').get();
      const patch = chatAi.settingsPatchFromBody(body, row);
      const stamp = nowIso();
      let ciphertext = row && row.api_key_ciphertext || null;
      let last4 = row && row.api_key_last4 || null;
      if (patch.apiKey) {
        ciphertext = chatAi.encryptApiKey(patch.apiKey);
        last4 = chatAi.last4Of(patch.apiKey);
      }
      db.prepare(`
        UPDATE chat_ai_settings
        SET enabled = ?, allow_in_dms = ?, provider = ?, model = ?,
            api_key_ciphertext = ?, api_key_last4 = ?,
            updated_by_user_id = ?, updated_at = ?
        WHERE id = 1
      `).run(
        patch.enabled ? 1 : 0,
        patch.allowInDms ? 1 : 0,
        patch.provider,
        patch.model,
        ciphertext,
        last4,
        admin && admin.id || null,
        stamp
      );
      const next = db.prepare('SELECT * FROM chat_ai_settings WHERE id = 1').get();
      return chatAi.assertNoSecretLeak(chatAi.publicSettings(next));
    },

    async removeChatAiKey(admin) {
      ensureCompanyChat(db);
      db.prepare(`
        UPDATE chat_ai_settings
        SET api_key_ciphertext = NULL, api_key_last4 = NULL, enabled = 0,
            updated_by_user_id = ?, updated_at = ?
        WHERE id = 1
      `).run(admin && admin.id || null, nowIso());
      const next = db.prepare('SELECT * FROM chat_ai_settings WHERE id = 1').get();
      return chatAi.assertNoSecretLeak(chatAi.publicSettings(next));
    },

    async testChatAiKey(admin, body) {
      ensureCompanyChat(db);
      const row = db.prepare('SELECT * FROM chat_ai_settings WHERE id = 1').get();
      return chatAi.testSavedOrPasted(row, body || {});
    }
  };
}

function supabaseApi(supabase) {
  let seeded = false;

  async function ensureReady() {
    if (seeded) return;
    try {
      const { data: lobby } = await supabase.from('chat_rooms').select('id').eq('kind', 'lobby').limit(1);
      if (!lobby || !lobby.length) {
        await supabase.from('chat_rooms').insert({
          kind: 'lobby',
          title: 'Lobby',
          customer_name: '',
          order_status: '',
          last_message_preview: '',
          created_at: nowIso()
        });
      }
    } catch (e) {
      /* tables may not exist until migration is applied */
    }
    try {
      const { data: orders } = await supabase
        .from('company_sales_docs')
        .select('id, number, customer_name, status')
        .eq('type', 'order');
      const { data: rooms } = await supabase
        .from('chat_rooms')
        .select('sales_order_id')
        .eq('kind', 'order');
      const have = {};
      (rooms || []).forEach(function (r) {
        have[String(r.sales_order_id)] = true;
      });
      const missing = (orders || []).filter(function (d) {
        return !have[String(d.id)];
      });
      if (missing.length) {
        await supabase.from('chat_rooms').insert(missing.map(function (doc) {
          return {
            kind: 'order',
            sales_order_id: doc.id,
            title: doc.number || ('Order #' + doc.id),
            customer_name: doc.customer_name || '',
            order_status: doc.status || '',
            last_message_preview: '',
            created_at: nowIso()
          };
        }));
      }
    } catch (e) {
      /* ignore backfill errors */
    }
    try {
      const { data: roles } = await supabase.from('admin_roles').select('*');
      for (let i = 0; i < (roles || []).length; i++) {
        const row = roles[i];
        if (row.locked || row.slug === 'owner') {
          await supabase.from('admin_roles').update({
            menu_access: serializeMenuAccess(defaultMenuAccess('edit'))
          }).eq('id', row.id);
          continue;
        }
        let menu = parseMenuAccess(row.menu_access);
        if (!menu) menu = menuFromLegacy(row.website_access, row.inventory_access, false);
        if (!canAccess(menu.chat, 'view')) {
          menu.chat = 'edit';
          await supabase.from('admin_roles').update({
            menu_access: serializeMenuAccess(menu)
          }).eq('id', row.id);
        }
      }
    } catch (e) { /* ignore */ }
    try {
      const { data: lobbyRows } = await supabase.from('chat_rooms').select('id').eq('kind', 'lobby').limit(1);
      const lobbyId = lobbyRows && lobbyRows[0] && lobbyRows[0].id;
      if (lobbyId) {
        const { data: admins } = await supabase.from('admins').select('id');
        const stamp = nowIso();
        for (let j = 0; j < (admins || []).length; j++) {
          await supabase.from('chat_room_reads').upsert({
            user_id: admins[j].id,
            room_id: lobbyId,
            last_read_at: stamp,
            muted: 0
          }, { onConflict: 'user_id,room_id', ignoreDuplicates: true });
        }
      }
    } catch (e) { /* ignore */ }
    try {
      const { data: ai } = await supabase.from('chat_ai_settings').select('id').eq('id', 1).maybeSingle();
      if (!ai) {
        await supabase.from('chat_ai_settings').insert({
          id: 1,
          enabled: false,
          allow_in_dms: false,
          provider: 'anthropic',
          model: 'claude-sonnet-4-6'
        });
      }
    } catch (e) { /* table may not exist until migration is applied */ }
    seeded = true;
  }

  async function getChatAiRow() {
    const { data } = await supabase.from('chat_ai_settings').select('*').eq('id', 1).maybeSingle();
    return data || null;
  }

  async function getAdminRow(id) {
    const { data } = await supabase
      .from('admins')
      .select('id, email, name, role')
      .eq('id', id)
      .maybeSingle();
    if (!data) return null;
    const { data: role } = await supabase
      .from('admin_roles')
      .select('name, website_access, inventory_access, menu_access, locked')
      .eq('slug', data.role)
      .maybeSingle();
    return Object.assign({}, data, {
      role_name: role && role.name,
      website_access: role && role.website_access,
      inventory_access: role && role.inventory_access,
      menu_access: role && role.menu_access,
      role_locked: role && role.locked
    });
  }

  async function usersMap(ids) {
    const map = {};
    const uniq = Array.from(new Set((ids || []).filter(Boolean).map(Number)));
    for (let i = 0; i < uniq.length; i++) {
      map[uniq[i]] = formatUser(await getAdminRow(uniq[i]));
    }
    return map;
  }

  async function getRoomRow(id) {
    const { data } = await supabase.from('chat_rooms').select('*').eq('id', id).maybeSingle();
    return data || null;
  }

  async function getRead(userId, roomId) {
    const { data } = await supabase
      .from('chat_room_reads')
      .select('*')
      .eq('user_id', userId)
      .eq('room_id', roomId)
      .maybeSingle();
    return data || null;
  }

  async function ensureReadRow(userId, roomId) {
    const existing = await getRead(userId, roomId);
    if (existing) return existing;
    await supabase.from('chat_room_reads').upsert({
      user_id: userId,
      room_id: roomId,
      last_read_at: nowIso(),
      muted: 0
    }, { onConflict: 'user_id,room_id' });
    return getRead(userId, roomId);
  }

  async function roomUnread(userId, roomId) {
    const read = await getRead(userId, roomId);
    let q = supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .is('deleted_at', null)
      .or('user_id.is.null,user_id.neq.' + userId);
    const since = (read && read.last_read_at) || '1970-01-01';
    q = q.gt('created_at', since);
    const { count } = await q;
    return Number(count) || 0;
  }

  async function enrichRoom(row, viewerId) {
    if (!row) return null;
    const extras = {
      unreadCount: await roomUnread(viewerId, row.id),
      muted: !!((await getRead(viewerId, row.id)) || {}).muted
    };
    if (row.kind === 'dm') {
      const otherId = Number(row.dm_user_low_id) === Number(viewerId)
        ? row.dm_user_high_id
        : row.dm_user_low_id;
      extras.otherUser = formatUser(await getAdminRow(otherId));
    }
    return formatRoom(row, extras);
  }

  async function uploadToBucket(bucket, objectPath, file) {
    const { error } = await supabase.storage.from(bucket).upload(objectPath, file.buffer, {
      contentType: file.mimetype || 'application/octet-stream',
      upsert: false
    });
    if (error) return { error: error };
    const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    return { url: data && data.publicUrl };
  }

  async function saveChatFile(file) {
    const kind = classifyAttachment(file);
    const ext = path.extname(file.originalname || '').toLowerCase() ||
      (kind === 'image' ? '.jpg' : '.bin');
    const name = Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex') + ext;
    const objectPath = 'chat/' + name;

    let result = await uploadToBucket('uploads', objectPath, file);
    if (result.error) {
      try {
        await supabase.storage.createBucket('uploads', { public: true });
      } catch (e) { /* may already exist */ }
      result = await uploadToBucket('uploads', objectPath, file);
    }
    if (result.error) {
      // Same fallback pattern as store-supabase saveUpload (product-images bucket).
      try {
        await supabase.storage.createBucket('product-images', { public: true });
      } catch (e) { /* may already exist */ }
      result = await uploadToBucket('product-images', objectPath, file);
    }
    if (result.error || !result.url) {
      throw httpError(500, 'Could not upload attachment.');
    }
    return {
      url: result.url,
      name: trim(file.originalname || name, 180),
      type: kind
    };
  }

  async function touchRoom(roomId, preview, userId, at) {
    await supabase.from('chat_rooms').update({
      last_message_at: at,
      last_message_preview: preview || '',
      last_message_user_id: userId || null
    }).eq('id', roomId);
  }

  async function insertMessage(roomId, userId, body, attachment, at) {
    const { data, error } = await supabase.from('chat_messages').insert({
      room_id: roomId,
      user_id: userId || null,
      body: body || '',
      attachment_url: (attachment && attachment.url) || null,
      attachment_name: (attachment && attachment.name) || null,
      attachment_type: (attachment && attachment.type) || 'none',
      created_at: at
    }).select('*').single();
    if (error) throw error;
    const preview = previewText(body) || (attachment && attachment.name) || '';
    await touchRoom(roomId, preview, userId || null, at);
    return data;
  }

  async function refreshRoomPreview(roomId) {
    const { data: latest } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .is('deleted_at', null)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!latest) {
      await touchRoom(roomId, '', null, null);
      return;
    }
    await touchRoom(
      roomId,
      previewText(latest.body) || latest.attachment_name || '',
      latest.user_id,
      latest.created_at
    );
  }

  async function ensureCopilotRoomRow(userId) {
    const { data: existing } = await supabase
      .from('chat_rooms')
      .select('*')
      .eq('kind', 'copilot')
      .eq('dm_user_low_id', userId)
      .maybeSingle();
    if (existing) {
      await ensureReadRow(userId, existing.id);
      return existing;
    }
    const stamp = nowIso();
    const inserted = await supabase.from('chat_rooms').insert({
      kind: 'copilot',
      dm_user_low_id: userId,
      title: 'Copilot',
      customer_name: '',
      order_status: '',
      last_message_preview: '',
      created_at: stamp
    }).select('*').single();
    if (inserted.error) throw inserted.error;
    const row = inserted.data;
    await ensureReadRow(userId, row.id);
    const welcome = require('./copilot').WELCOME;
    await insertMessage(row.id, null, welcome, null, stamp);
    return row;
  }

  function formatDraftRow(row) {
    if (!row) return null;
    let payload = {};
    try { payload = JSON.parse(row.payload || '{}'); } catch (e) { payload = {}; }
    if (payload && typeof row.payload === 'object' && !Array.isArray(row.payload)) {
      payload = row.payload;
    }
    return {
      token: row.token,
      userId: row.user_id,
      roomId: row.room_id,
      kind: row.kind,
      summary: row.summary || '',
      payload: payload,
      status: row.status || 'pending',
      resultId: row.result_id || null,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at || null
    };
  }

  return {
    async listChatRooms(admin, tab, query) {
      await ensureReady();
      const viewerId = admin.id;
      const q = trim(query, 80).toLowerCase();
      let rows = [];

      if (tab === 'orders') {
        const { data } = await supabase.from('chat_rooms').select('*').eq('kind', 'order');
        rows = data || [];
        if (q) {
          rows = rows.filter(function (row) {
            return ((row.title || '') + ' ' + (row.customer_name || ''))
              .toLowerCase()
              .indexOf(q) !== -1;
          });
        }
        const rooms = [];
        for (let i = 0; i < rows.length; i++) {
          rooms.push(await enrichRoom(rows[i], viewerId));
        }
        return sortRoomsUnreadFirst(rooms);
      }

      const copilotRow = await ensureCopilotRoomRow(viewerId);
      const { data: lobbyRows } = await supabase.from('chat_rooms').select('*').eq('kind', 'lobby').limit(1);
      const { data: dmData } = await supabase.from('chat_rooms').select('*').eq('kind', 'dm')
        .or('dm_user_low_id.eq.' + viewerId + ',dm_user_high_id.eq.' + viewerId);
      const copilot = copilotRow ? await enrichRoom(copilotRow, viewerId) : null;
      const lobby = lobbyRows && lobbyRows[0] ? await enrichRoom(lobbyRows[0], viewerId) : null;
      const dms = [];
      for (let i = 0; i < (dmData || []).length; i++) {
        dms.push(await enrichRoom(dmData[i], viewerId));
      }
      const users = await this.listChatUsers(admin);
      return buildContactList(copilot, lobby, dms, users, q);
    },

    async getChatRoom(admin, roomId) {
      await ensureReady();
      return enrichRoom(assertRoomAccess(await getRoomRow(roomId), admin), admin.id);
    },

    async getChatRoomByOrder(admin, orderId) {
      await ensureReady();
      let { data } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('kind', 'order')
        .eq('sales_order_id', orderId)
        .maybeSingle();
      if (!data) {
        const { data: doc } = await supabase
          .from('company_sales_docs')
          .select('*')
          .eq('id', orderId)
          .eq('type', 'order')
          .maybeSingle();
        if (!doc) return null;
        data = await this.ensureOrderChatRoom(doc);
      }
      if (!data) return null;
      return enrichRoom(assertRoomAccess(data, admin), admin.id);
    },

    async ensureOrderChatRoom(doc) {
      await ensureReady();
      if (!doc || !doc.id) return null;
      if (doc.type != null && doc.type !== 'order') return null;

      const title = orderRoomTitle(doc);
      const customer = orderCustomerName(doc);
      const status = doc.status || '';

      const { data: existing } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('kind', 'order')
        .eq('sales_order_id', doc.id)
        .maybeSingle();

      if (existing) {
        await supabase.from('chat_rooms').update({
          title: title,
          customer_name: customer,
          order_status: status
        }).eq('id', existing.id);
        return getRoomRow(existing.id);
      }

      const { data, error } = await supabase.from('chat_rooms').insert({
        kind: 'order',
        sales_order_id: doc.id,
        title: title,
        customer_name: customer,
        order_status: status || 'draft',
        last_message_preview: '',
        created_at: nowIso()
      }).select('*').single();
      if (error) throw error;
      return data;
    },

    async findOrCreateDm(admin, otherUserId) {
      await ensureReady();
      const otherId = Number(otherUserId);
      if (!otherId || otherId === Number(admin.id)) {
        throw httpError(400, 'Pick someone else.');
      }
      const other = await getAdminRow(otherId);
      if (!other) {
        throw httpError(404, 'That person was not found.');
      }

      const pair = dmPair(admin.id, otherId);
      let { data: row } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('kind', 'dm')
        .eq('dm_user_low_id', pair.low)
        .eq('dm_user_high_id', pair.high)
        .maybeSingle();

      if (!row) {
        const inserted = await supabase.from('chat_rooms').insert({
          kind: 'dm',
          dm_user_low_id: pair.low,
          dm_user_high_id: pair.high,
          title: '',
          customer_name: '',
          order_status: '',
          last_message_preview: '',
          created_at: nowIso()
        }).select('*').single();
        if (inserted.error) throw inserted.error;
        row = inserted.data;
      }

      await ensureReadRow(admin.id, row.id);
      await ensureReadRow(otherId, row.id);
      return enrichRoom(row, admin.id);
    },

    async listChatMessages(admin, roomId, opts) {
      await ensureReady();
      const room = assertRoomAccess(await getRoomRow(roomId), admin);
      const afterId = opts && opts.afterId ? Number(opts.afterId) : 0;
      const limit = Math.min(200, Math.max(1, Number((opts && opts.limit) || 100)));

      let q;
      if (afterId) {
        q = supabase
          .from('chat_messages')
          .select('*')
          .eq('room_id', room.id)
          .gt('id', afterId)
          .order('id', { ascending: true })
          .limit(limit);
      } else {
        q = supabase
          .from('chat_messages')
          .select('*')
          .eq('room_id', room.id)
          .order('id', { ascending: false })
          .limit(limit);
      }

      const { data, error } = await q;
      if (error) throw error;
      let rows = data || [];
      if (!afterId) rows = rows.slice().reverse();
      const map = await usersMap(rows.map(function (r) { return r.user_id; }));
      const extras = room.kind === 'copilot' ? { copilot: true } : null;
      return {
        room: await enrichRoom(room, admin.id),
        messages: rows.map(function (r) { return formatMessage(r, map, extras); })
      };
    },

    async sendChatMessage(admin, roomId, payload, file) {
      await ensureReady();
      checkRate(admin.id);
      const room = assertRoomAccess(await getRoomRow(roomId), admin);
      let attachment = null;
      if (file) attachment = await saveChatFile(file);
      const body = normalizeBody(payload && payload.body, !!attachment);
      const stamp = nowIso();
      const row = await insertMessage(room.id, admin.id, body, attachment, stamp);
      await ensureReadRow(admin.id, room.id);
      await supabase
        .from('chat_room_reads')
        .update({ last_read_at: stamp })
        .eq('user_id', admin.id)
        .eq('room_id', room.id);
      return formatMessage(row, await usersMap([admin.id]));
    },

    async editChatMessage(admin, messageId, bodyRaw) {
      await ensureReady();
      const { data: row } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('id', messageId)
        .maybeSingle();
      if (!row || row.deleted_at) {
        throw httpError(404, 'Message not found.');
      }
      if (!row.user_id || Number(row.user_id) !== Number(admin.id)) {
        throw httpError(403, 'You can only edit your own messages.');
      }
      const room = assertRoomAccess(await getRoomRow(row.room_id), admin);
      const created = new Date(row.created_at).getTime();
      if (!Number.isFinite(created) || Date.now() - created > EDIT_WINDOW_MS) {
        throw httpError(400, 'Edit window has passed.');
      }
      const hasAttachment = !!(row.attachment_url && row.attachment_type && row.attachment_type !== 'none');
      const body = normalizeBody(bodyRaw, hasAttachment);
      const stamp = nowIso();
      await supabase.from('chat_messages').update({ body: body, edited_at: stamp }).eq('id', messageId);
      const { data: latest } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('room_id', room.id)
        .is('deleted_at', null)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest && Number(latest.id) === Number(messageId)) {
        await touchRoom(
          room.id,
          previewText(body) || row.attachment_name || '',
          admin.id,
          row.created_at
        );
      }
      const { data: updated } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('id', messageId)
        .single();
      return formatMessage(updated, await usersMap([admin.id]));
    },

    async deleteChatMessage(admin, messageId) {
      await ensureReady();
      const { data: row } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('id', messageId)
        .maybeSingle();
      if (!row) {
        throw httpError(404, 'Message not found.');
      }
      if (row.deleted_at) {
        return formatMessage(row, await usersMap([row.user_id]));
      }
      const room = assertRoomAccess(await getRoomRow(row.room_id), admin);
      const isAuthor = !!(row.user_id && Number(row.user_id) === Number(admin.id));

      if (room.kind === 'dm') {
        if (!isAuthor) {
          throw httpError(403, 'Only the author can remove a direct message.');
        }
      } else if (room.kind === 'copilot') {
        /* room owner may remove Copilot replies or their own messages */
      } else if (!isAuthor && !canModerateLobbyOrOrder(admin)) {
        throw httpError(403, 'You cannot remove this message.');
      }

      const stamp = nowIso();
      await supabase.from('chat_messages').update({
        deleted_at: stamp,
        deleted_by_user_id: admin.id,
        body: '',
        attachment_url: null,
        attachment_name: null,
        attachment_type: 'none'
      }).eq('id', messageId);
      await refreshRoomPreview(room.id);
      const { data: updated } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('id', messageId)
        .single();
      return formatMessage(updated, await usersMap([updated.user_id, admin.id]));
    },

    async markChatRoomRead(admin, roomId) {
      await ensureReady();
      const room = assertRoomAccess(await getRoomRow(roomId), admin);
      const stamp = nowIso();
      await ensureReadRow(admin.id, room.id);
      await supabase
        .from('chat_room_reads')
        .update({ last_read_at: stamp })
        .eq('user_id', admin.id)
        .eq('room_id', room.id);
      return { ok: true, lastReadAt: stamp };
    },

    async chatUnreadSummary(admin) {
      await ensureReady();
      const viewerId = admin.id;
      const { data: lobbyRows } = await supabase
        .from('chat_rooms')
        .select('id')
        .eq('kind', 'lobby')
        .limit(1);
      const { data: dmRows } = await supabase
        .from('chat_rooms')
        .select('id')
        .eq('kind', 'dm')
        .or('dm_user_low_id.eq.' + viewerId + ',dm_user_high_id.eq.' + viewerId);
      const { data: copilotRows } = await supabase
        .from('chat_rooms')
        .select('id')
        .eq('kind', 'copilot')
        .eq('dm_user_low_id', viewerId)
        .limit(1);
      const { data: orderRows } = await supabase
        .from('chat_rooms')
        .select('id')
        .eq('kind', 'order');

      let lobbyCount = 0;
      let dmCount = 0;
      let orderCount = 0;
      let copilotCount = 0;
      if (lobbyRows && lobbyRows[0]) lobbyCount = await roomUnread(viewerId, lobbyRows[0].id);
      if (copilotRows && copilotRows[0]) copilotCount = await roomUnread(viewerId, copilotRows[0].id);
      for (let i = 0; i < (dmRows || []).length; i++) {
        dmCount += await roomUnread(viewerId, dmRows[i].id);
      }
      for (let j = 0; j < (orderRows || []).length; j++) {
        orderCount += await roomUnread(viewerId, orderRows[j].id);
      }
      return {
        total: lobbyCount + dmCount + orderCount + copilotCount,
        lobby: lobbyCount,
        direct: dmCount,
        orders: orderCount,
        copilot: copilotCount
      };
    },

    async listChatUsers(admin) {
      await ensureReady();
      const { data } = await supabase.from('admins').select('id, email, name, role');
      const out = [];
      for (let i = 0; i < (data || []).length; i++) {
        const row = await getAdminRow(data[i].id);
        if (!row || Number(row.id) === Number(admin.id)) continue;
        out.push(formatUser(row));
      }
      out.sort(function (a, b) {
        return String(a.name).localeCompare(String(b.name));
      });
      return out;
    },

    async enrollChatUser(user, opts) {
      await ensureReady();
      if (!user || !user.id) return null;
      const { data: lobbyRows } = await supabase.from('chat_rooms').select('id').eq('kind', 'lobby').limit(1);
      const lobbyId = lobbyRows && lobbyRows[0] && lobbyRows[0].id;
      if (!lobbyId) return null;
      await ensureReadRow(user.id, lobbyId);
      try { await ensureCopilotRoomRow(user.id); } catch (e) { /* copilot tables may be pending */ }
      if (opts && opts.announce) {
        const name = user.name || user.email || 'Staff';
        await insertMessage(lobbyId, null, name + ' joined Lobby', null, nowIso());
      }
      return true;
    },

    async touchChatPresence(admin) {
      await ensureReady();
      const stamp = nowIso();
      await supabase
        .from('chat_presence')
        .upsert({ user_id: admin.id, last_seen_at: stamp }, { onConflict: 'user_id' });
      return { lastSeenAt: stamp };
    },

    async listChatPresence(_admin, userIds) {
      await ensureReady();
      let q = supabase.from('chat_presence').select('*');
      if (userIds && userIds.length) {
        q = q.in('user_id', userIds.map(Number));
      }
      const { data } = await q;
      const out = {};
      (data || []).forEach(function (r) {
        out[r.user_id] = r.last_seen_at;
      });
      return out;
    },

    async appendOrderChatSystem(doc, actorName, kind, detail) {
      await ensureReady();
      if (!doc || (doc.type != null && doc.type !== 'order')) return null;
      const room = await this.ensureOrderChatRoom(doc);
      if (!room) return null;
      const body = systemMessageBody(kind, detail, actorName, doc);
      if (!body) return null;
      await insertMessage(room.id, null, body, null, nowIso());
      await supabase.from('chat_rooms').update({
        order_status: doc.status || room.order_status || '',
        title: orderRoomTitle(doc) || room.title,
        customer_name: orderCustomerName(doc) || room.customer_name || ''
      }).eq('id', room.id);
      return true;
    },

    async appendCopilotMessage(admin, roomId, body) {
      await ensureReady();
      const room = assertRoomAccess(await getRoomRow(roomId), admin);
      if (room.kind !== 'copilot') {
        throw httpError(400, 'Copilot can only reply in Copilot chat.');
      }
      const stamp = nowIso();
      const row = await insertMessage(room.id, null, String(body || '').slice(0, 8000), null, stamp);
      return formatMessage(row, {}, { copilot: true });
    },

    async saveCopilotDraft(admin, roomId, kind, payload, summary) {
      await ensureReady();
      const token = crypto.randomBytes(16).toString('hex');
      const { error } = await supabase.from('copilot_drafts').insert({
        token: token,
        user_id: admin.id,
        room_id: roomId || null,
        kind: String(kind || 'draft'),
        summary: trim(summary, 400),
        payload: payload || {},
        status: 'pending',
        created_at: nowIso()
      });
      if (error) throw error;
      return token;
    },

    async getCopilotDraft(admin, token) {
      await ensureReady();
      const { data } = await supabase.from('copilot_drafts').select('*').eq('token', token).maybeSingle();
      return formatDraftRow(data);
    },

    async resolveCopilotDraft(admin, token, status, resultId) {
      await ensureReady();
      await supabase.from('copilot_drafts').update({
        status: status || 'discarded',
        result_id: resultId || null,
        resolved_at: nowIso()
      }).eq('token', token).eq('user_id', admin.id);
      const { data } = await supabase.from('copilot_drafts').select('*').eq('token', token).maybeSingle();
      return formatDraftRow(data);
    },

    async logCopilotAudit(admin, roomId, action, detail) {
      await ensureReady();
      try {
        await supabase.from('copilot_audit').insert({
          user_id: admin && admin.id || null,
          room_id: roomId || null,
          action: String(action || ''),
          detail: detail || {},
          created_at: nowIso()
        });
      } catch (e) { /* audit table may not exist yet */ }
      return true;
    },

    async getChatAiSettings(_admin) {
      await ensureReady();
      try {
        const row = await getChatAiRow();
        return chatAi.assertNoSecretLeak(chatAi.publicSettings(row));
      } catch (e) {
        return chatAi.assertNoSecretLeak(chatAi.publicSettings(null));
      }
    },

    async saveChatAiSettings(admin, body) {
      await ensureReady();
      const row = await getChatAiRow();
      const patch = chatAi.settingsPatchFromBody(body, row);
      let ciphertext = row && row.api_key_ciphertext || null;
      let last4 = row && row.api_key_last4 || null;
      if (patch.apiKey) {
        ciphertext = chatAi.encryptApiKey(patch.apiKey);
        last4 = chatAi.last4Of(patch.apiKey);
      }
      const { error } = await supabase.from('chat_ai_settings').upsert({
        id: 1,
        enabled: !!patch.enabled,
        allow_in_dms: !!patch.allowInDms,
        provider: patch.provider,
        model: patch.model,
        api_key_ciphertext: ciphertext,
        api_key_last4: last4,
        updated_by_user_id: admin && admin.id || null,
        updated_at: nowIso()
      }, { onConflict: 'id' });
      if (error) throw error;
      const next = await getChatAiRow();
      return chatAi.assertNoSecretLeak(chatAi.publicSettings(next));
    },

    async removeChatAiKey(admin) {
      await ensureReady();
      const { error } = await supabase.from('chat_ai_settings').update({
        enabled: false,
        api_key_ciphertext: null,
        api_key_last4: null,
        updated_by_user_id: admin && admin.id || null,
        updated_at: nowIso()
      }).eq('id', 1);
      if (error) throw error;
      const next = await getChatAiRow();
      return chatAi.assertNoSecretLeak(chatAi.publicSettings(next));
    },

    async testChatAiKey(_admin, body) {
      await ensureReady();
      const row = await getChatAiRow();
      return chatAi.testSavedOrPasted(row, body || {});
    }
  };
}

module.exports = {
  BODY_MAX,
  ensureCompanyChat,
  grantChatOnRoles,
  sqliteApi,
  supabaseApi
};
