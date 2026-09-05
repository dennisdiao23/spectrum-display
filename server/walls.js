const crypto = require('crypto');

const PROCESSOR_MODELS = [
  'H2',
  'H5',
  'MX20',
  'MX30',
  'MX40 Pro',
  'MX2000',
  'MX6000',
  'KU20',
  'CX40 Pro'
];

const DISPLAY_MODES = ['on', 'black', 'freeze'];
const LAYOUTS = ['full', 'split'];
const COMMAND_TYPES = ['recall_preset', 'set_source', 'set_brightness', 'set_display'];
const OFFLINE_MS = 60 * 1000;
const BRIDGE_PREFIX = 'wrb_';

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  return crypto.randomUUID();
}

function newBridgeToken() {
  return BRIDGE_PREFIX + crypto.randomBytes(24).toString('base64url');
}

function hashBridgeToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function isBridgeToken(token) {
  return String(token || '').startsWith(BRIDGE_PREFIX);
}

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function clampNum(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function str(value, fallback) {
  const s = String(value == null ? '' : value).trim();
  return s || fallback;
}

function processorOf(value) {
  const raw = String(value || '').trim();
  const found = PROCESSOR_MODELS.find(function (m) {
    return m.toLowerCase() === raw.toLowerCase();
  });
  return found || 'MX20';
}

function displayOf(value) {
  const raw = String(value || '').toLowerCase();
  return DISPLAY_MODES.indexOf(raw) >= 0 ? raw : 'on';
}

function layoutOf(value) {
  const raw = String(value || '').toLowerCase();
  return LAYOUTS.indexOf(raw) >= 0 ? raw : 'full';
}

function pixelsFor(pitch, mm) {
  const p = clampNum(pitch, 0.1, 40, 1.2);
  const size = clampNum(mm, 50, 2000, 500);
  return Math.max(1, Math.round(size / p));
}

function isOnline(lastSeenAt, now) {
  if (!lastSeenAt) return false;
  const t = Date.parse(lastSeenAt);
  if (!Number.isFinite(t)) return false;
  return ((now || Date.now()) - t) < OFFLINE_MS;
}

function defaultInputs() {
  return [
    { name: 'HDMI 1', connector: 'HDMI' },
    { name: 'HDMI 2', connector: 'HDMI' },
    { name: 'DP 1', connector: 'DisplayPort' }
  ];
}

function defaultPresets() {
  return [
    { name: 'Full', layout: 'full', novastarIndex: 0 },
    { name: 'Split', layout: 'split', novastarIndex: 1 }
  ];
}

function normalizeInputs(list) {
  const src = Array.isArray(list) && list.length ? list : defaultInputs();
  return src.slice(0, 24).map(function (item, i) {
    const name = str(item && item.name, 'Input ' + (i + 1)).slice(0, 48);
    return {
      id: str(item && item.id, '') || newId(),
      name: name,
      connector: str(item && item.connector, '').slice(0, 32),
      sortOrder: i
    };
  });
}

function panesForPreset(preset, inputs) {
  const first = inputs[0] ? inputs[0].id : '';
  const second = inputs[1] ? inputs[1].id : first;
  const given = Array.isArray(preset && preset.panes) ? preset.panes : [];
  function paneInput(pane, fallback) {
    const hit = given.find(function (p) { return String(p.pane) === pane; });
    if (hit && hit.inputId) return String(hit.inputId);
    return fallback;
  }
  if (preset.layout === 'split') {
    return [
      { id: newId(), pane: 'left', inputId: paneInput('left', first) },
      { id: newId(), pane: 'right', inputId: paneInput('right', second) }
    ];
  }
  return [{ id: newId(), pane: 'full', inputId: paneInput('full', first) }];
}

function normalizePresets(list, inputs) {
  const src = Array.isArray(list) && list.length ? list : defaultPresets();
  return src.slice(0, 16).map(function (item, i) {
    const preset = {
      id: str(item && item.id, '') || newId(),
      name: str(item && item.name, i === 0 ? 'Full' : 'Preset ' + (i + 1)).slice(0, 48),
      layout: layoutOf(item && item.layout),
      novastarIndex: clampInt(item && (item.novastarIndex != null ? item.novastarIndex : item.novastar_index), 0, 128, i),
      sortOrder: i
    };
    preset.panes = panesForPreset(Object.assign({}, item, preset), inputs);
    return preset;
  });
}

function normalizeWall(payload) {
  const cols = clampInt(payload && payload.cols, 1, 80, 10);
  const rows = clampInt(payload && payload.rows, 1, 40, 6);
  const pitch = clampNum(payload && payload.pitch, 0.1, 40, 1.2);
  const cabinetWmm = clampNum(payload && (payload.cabinetWmm != null ? payload.cabinetWmm : payload.cabinet_w_mm), 50, 2000, 500);
  const cabinetHmm = clampNum(payload && (payload.cabinetHmm != null ? payload.cabinetHmm : payload.cabinet_h_mm), 50, 2000, 500);
  const inputs = normalizeInputs(payload && payload.inputs);
  const presets = normalizePresets(payload && payload.presets, inputs);
  const activePresetId = str(payload && (payload.activePresetId || payload.active_preset_id), '');
  const active = presets.find(function (p) { return p.id === activePresetId; }) || presets[0];
  return {
    name: str(payload && payload.name, 'Main Wall').slice(0, 80),
    processor: processorOf(payload && payload.processor),
    model: str(payload && payload.model, '').slice(0, 80),
    pitch: pitch,
    cols: cols,
    rows: rows,
    cabinetWmm: cabinetWmm,
    cabinetHmm: cabinetHmm,
    pixelW: clampInt(payload && (payload.pixelW != null ? payload.pixelW : payload.pixel_w), 1, 40000, cols * pixelsFor(pitch, cabinetWmm)),
    pixelH: clampInt(payload && (payload.pixelH != null ? payload.pixelH : payload.pixel_h), 1, 20000, rows * pixelsFor(pitch, cabinetHmm)),
    brightness: clampInt(payload && payload.brightness, 0, 100, 80),
    displayMode: displayOf(payload && (payload.displayMode || payload.display_mode)),
    activePresetId: active ? active.id : '',
    inputs: inputs,
    presets: presets
  };
}

function publicWall(row, extras) {
  extras = extras || {};
  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: row.name || '',
    processor: row.processor || 'MX20',
    model: row.model || '',
    pitch: Number(row.pitch) || 1.2,
    cols: Number(row.cols) || 1,
    rows: Number(row.rows) || 1,
    cabinetWmm: Number(row.cabinet_w_mm) || 500,
    cabinetHmm: Number(row.cabinet_h_mm) || 500,
    pixelW: Number(row.pixel_w) || 0,
    pixelH: Number(row.pixel_h) || 0,
    brightness: clampInt(row.brightness, 0, 100, 80),
    displayMode: displayOf(row.display_mode),
    activePresetId: row.active_preset_id || '',
    lastSeenAt: row.last_seen_at || '',
    online: isOnline(row.last_seen_at),
    inputs: extras.inputs || [],
    presets: extras.presets || [],
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

function publicInput(row) {
  return {
    id: String(row.id),
    name: row.name || '',
    connector: row.connector || '',
    sortOrder: Number(row.sort_order) || 0
  };
}

function publicPreset(row, panes) {
  return {
    id: String(row.id),
    name: row.name || '',
    layout: layoutOf(row.layout),
    novastarIndex: Number(row.novastar_index) || 0,
    sortOrder: Number(row.sort_order) || 0,
    panes: (panes || []).map(function (p) {
      return {
        id: String(p.id),
        pane: String(p.pane || 'full'),
        inputId: String(p.input_id || '')
      };
    })
  };
}

function publicCommand(row) {
  let payload = row.payload;
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload || '{}'); } catch (e) { payload = {}; }
  }
  if (!payload || typeof payload !== 'object') payload = {};
  return {
    id: String(row.id),
    wallId: String(row.wall_id),
    type: row.type,
    payload: payload,
    status: row.status || 'pending',
    createdAt: row.created_at || ''
  };
}

function normalizeCommand(body) {
  const type = String((body && body.type) || '').trim();
  if (COMMAND_TYPES.indexOf(type) < 0) {
    throw new Error('Unknown command.');
  }
  const payload = {};
  if (type === 'recall_preset') {
    payload.presetId = str(body.presetId || body.preset_id, '');
    if (!payload.presetId) throw new Error('Choose a layout preset.');
  }
  if (type === 'set_source') {
    payload.pane = String(body.pane || 'full');
    payload.inputId = str(body.inputId || body.input_id, '');
    if (!payload.inputId) throw new Error('Choose a source.');
  }
  if (type === 'set_brightness') {
    payload.brightness = clampInt(body.brightness, 0, 100, 80);
  }
  if (type === 'set_display') {
    payload.display = displayOf(body.display || body.displayMode || body.display_mode);
  }
  return { type: type, payload: payload };
}

function assemble(row, inputRows, presetRows, paneRows) {
  const panesByPreset = {};
  (paneRows || []).forEach(function (p) {
    const key = String(p.preset_id);
    (panesByPreset[key] = panesByPreset[key] || []).push(p);
  });
  const inputs = (inputRows || []).map(publicInput);
  const presets = (presetRows || []).map(function (pr) {
    return publicPreset(pr, panesByPreset[String(pr.id)] || []);
  });
  return publicWall(row, { inputs: inputs, presets: presets });
}

function sqliteApi(db) {
  function loadChildren(wallId) {
    const inputs = db.prepare(
      'SELECT * FROM wall_inputs WHERE wall_id = ? ORDER BY sort_order, name'
    ).all(wallId);
    const presets = db.prepare(
      'SELECT * FROM wall_presets WHERE wall_id = ? ORDER BY sort_order, name'
    ).all(wallId);
    const ids = presets.map(function (p) { return p.id; });
    let panes = [];
    if (ids.length) {
      panes = db.prepare(
        'SELECT * FROM wall_preset_panes WHERE preset_id IN (' +
        ids.map(function () { return '?'; }).join(',') + ')'
      ).all(...ids);
    }
    return { inputs: inputs, presets: presets, panes: panes };
  }

  function getRow(id) {
    return db.prepare('SELECT * FROM walls WHERE id = ?').get(id);
  }

  function replaceChildren(wallId, data) {
    db.prepare('DELETE FROM wall_preset_panes WHERE preset_id IN (SELECT id FROM wall_presets WHERE wall_id = ?)').run(wallId);
    db.prepare('DELETE FROM wall_inputs WHERE wall_id = ?').run(wallId);
    db.prepare('DELETE FROM wall_presets WHERE wall_id = ?').run(wallId);
    data.inputs.forEach(function (input) {
      db.prepare(`
        INSERT INTO wall_inputs (id, wall_id, name, connector, sort_order)
        VALUES (?, ?, ?, ?, ?)
      `).run(input.id, wallId, input.name, input.connector, input.sortOrder);
    });
    data.presets.forEach(function (preset) {
      db.prepare(`
        INSERT INTO wall_presets (id, wall_id, name, layout, novastar_index, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(preset.id, wallId, preset.name, preset.layout, preset.novastarIndex, preset.sortOrder);
      preset.panes.forEach(function (pane) {
        db.prepare(`
          INSERT INTO wall_preset_panes (id, preset_id, pane, input_id)
          VALUES (?, ?, ?, ?)
        `).run(pane.id, preset.id, pane.pane, pane.inputId);
      });
    });
  }

  function wallOrNull(row) {
    if (!row) return null;
    const kids = loadChildren(row.id);
    return assemble(row, kids.inputs, kids.presets, kids.panes);
  }

  return {
    async listWalls(userId) {
      const rows = db.prepare(
        'SELECT * FROM walls WHERE user_id = ? ORDER BY name COLLATE NOCASE, created_at'
      ).all(String(userId));
      return rows.map(function (row) { return wallOrNull(row); });
    },
    async getWall(id) {
      return wallOrNull(getRow(id));
    },
    async getWallForOwner(id, userId) {
      const row = getRow(id);
      if (!row || String(row.user_id) !== String(userId)) return null;
      return wallOrNull(row);
    },
    async getWallByBridgeToken(token) {
      if (!isBridgeToken(token)) return null;
      const row = db.prepare('SELECT * FROM walls WHERE bridge_token_hash = ?').get(hashBridgeToken(token));
      return wallOrNull(row);
    },
    async createWall(userId, payload) {
      const data = normalizeWall(payload || {});
      const id = newId();
      const token = newBridgeToken();
      const stamp = nowIso();
      db.exec('BEGIN');
      try {
        db.prepare(`
          INSERT INTO walls (
            id, user_id, name, processor, model, pitch, cols, rows,
            cabinet_w_mm, cabinet_h_mm, pixel_w, pixel_h, brightness, display_mode,
            active_preset_id, last_seen_at, bridge_token_hash, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?)
        `).run(
          id, String(userId), data.name, data.processor, data.model, data.pitch,
          data.cols, data.rows, data.cabinetWmm, data.cabinetHmm, data.pixelW, data.pixelH,
          data.brightness, data.displayMode, data.activePresetId, hashBridgeToken(token),
          stamp, stamp
        );
        replaceChildren(id, data);
        db.exec('COMMIT');
      } catch (err) {
        try { db.exec('ROLLBACK'); } catch (e) { /* ignore */ }
        throw err;
      }
      return { wall: await this.getWall(id), bridgeToken: token };
    },
    async updateWall(userId, id, payload) {
      const current = await this.getWallForOwner(id, userId);
      if (!current) return null;
      const merged = normalizeWall(Object.assign({}, current, payload || {}, {
        inputs: (payload && payload.inputs) || current.inputs,
        presets: (payload && payload.presets) || current.presets
      }));
      const stamp = nowIso();
      db.exec('BEGIN');
      try {
        db.prepare(`
          UPDATE walls SET
            name = ?, processor = ?, model = ?, pitch = ?, cols = ?, rows = ?,
            cabinet_w_mm = ?, cabinet_h_mm = ?, pixel_w = ?, pixel_h = ?,
            brightness = ?, display_mode = ?, active_preset_id = ?, updated_at = ?
          WHERE id = ? AND user_id = ?
        `).run(
          merged.name, merged.processor, merged.model, merged.pitch, merged.cols, merged.rows,
          merged.cabinetWmm, merged.cabinetHmm, merged.pixelW, merged.pixelH,
          merged.brightness, merged.displayMode, merged.activePresetId, stamp,
          id, String(userId)
        );
        if (payload && (payload.inputs || payload.presets)) {
          replaceChildren(id, merged);
        }
        db.exec('COMMIT');
      } catch (err) {
        try { db.exec('ROLLBACK'); } catch (e) { /* ignore */ }
        throw err;
      }
      return this.getWall(id);
    },
    async deleteWall(userId, id) {
      const info = db.prepare('DELETE FROM walls WHERE id = ? AND user_id = ?').run(id, String(userId));
      return info.changes > 0;
    },
    async rotateBridgeToken(userId, id) {
      const current = await this.getWallForOwner(id, userId);
      if (!current) return null;
      const token = newBridgeToken();
      db.prepare('UPDATE walls SET bridge_token_hash = ?, updated_at = ? WHERE id = ?')
        .run(hashBridgeToken(token), nowIso(), id);
      return { wall: await this.getWall(id), bridgeToken: token };
    },
    async enqueueCommand(userId, id, body) {
      const wall = await this.getWallForOwner(id, userId);
      if (!wall) return null;
      const cmd = normalizeCommand(body);
      applyDesired(db, wall, cmd);
      const coalesce = cmd.type === 'set_source'
        ? db.prepare("UPDATE wall_commands SET status = 'replaced' WHERE wall_id = ? AND type = ? AND status = 'pending' AND payload LIKE ?")
        : db.prepare("UPDATE wall_commands SET status = 'replaced' WHERE wall_id = ? AND type = ? AND status = 'pending'");
      if (cmd.type === 'set_source') {
        coalesce.run(id, cmd.type, '%"pane":"' + String(cmd.payload.pane).replace(/"/g, '') + '"%');
      } else {
        coalesce.run(id, cmd.type);
      }
      const row = {
        id: newId(),
        wall_id: id,
        type: cmd.type,
        payload: JSON.stringify(cmd.payload),
        status: 'pending',
        created_at: nowIso(),
        acked_at: ''
      };
      db.prepare(`
        INSERT INTO wall_commands (id, wall_id, type, payload, status, created_at, acked_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(row.id, row.wall_id, row.type, row.payload, row.status, row.created_at, row.acked_at);
      return { wall: await this.getWall(id), command: publicCommand(row) };
    },
    async listPendingCommands(wallId) {
      return db.prepare(
        "SELECT * FROM wall_commands WHERE wall_id = ? AND status = 'pending' ORDER BY created_at, id LIMIT 50"
      ).all(wallId).map(publicCommand);
    },
    async heartbeat(wallId, body) {
      const stamp = nowIso();
      db.prepare('UPDATE walls SET last_seen_at = ?, updated_at = ? WHERE id = ?').run(stamp, stamp, wallId);
      const acked = Array.isArray(body && body.ackedIds) ? body.ackedIds : [];
      const failed = Array.isArray(body && body.failedIds) ? body.failedIds : [];
      acked.forEach(function (cid) {
        db.prepare("UPDATE wall_commands SET status = 'acked', acked_at = ? WHERE id = ? AND wall_id = ?")
          .run(stamp, String(cid), wallId);
      });
      failed.forEach(function (cid) {
        db.prepare("UPDATE wall_commands SET status = 'failed', acked_at = ? WHERE id = ? AND wall_id = ?")
          .run(stamp, String(cid), wallId);
      });
      return this.getWall(wallId);
    }
  };
}

function applyDesired(db, wall, cmd) {
  const stamp = nowIso();
  if (cmd.type === 'recall_preset') {
    const preset = (wall.presets || []).find(function (p) { return p.id === cmd.payload.presetId; });
    if (!preset) throw new Error('Preset not found.');
    db.prepare('UPDATE walls SET active_preset_id = ?, updated_at = ? WHERE id = ?')
      .run(preset.id, stamp, wall.id);
  }
  if (cmd.type === 'set_brightness') {
    db.prepare('UPDATE walls SET brightness = ?, updated_at = ? WHERE id = ?')
      .run(cmd.payload.brightness, stamp, wall.id);
  }
  if (cmd.type === 'set_display') {
    db.prepare('UPDATE walls SET display_mode = ?, updated_at = ? WHERE id = ?')
      .run(cmd.payload.display, stamp, wall.id);
  }
  if (cmd.type === 'set_source') {
    const active = (wall.presets || []).find(function (p) { return p.id === wall.activePresetId; }) || wall.presets[0];
    if (!active) throw new Error('No layout preset.');
    const pane = (active.panes || []).find(function (p) { return p.pane === cmd.payload.pane; });
    if (!pane) throw new Error('Pane not found.');
    const input = (wall.inputs || []).find(function (i) { return i.id === cmd.payload.inputId; });
    if (!input) throw new Error('Source not found.');
    db.prepare('UPDATE wall_preset_panes SET input_id = ? WHERE id = ?').run(input.id, pane.id);
    db.prepare('UPDATE walls SET updated_at = ? WHERE id = ?').run(stamp, wall.id);
  }
}

function supabaseApi(supabase) {
  async function loadChildren(wallId) {
    const [inputs, presets] = await Promise.all([
      supabase.from('wall_inputs').select('*').eq('wall_id', wallId).order('sort_order'),
      supabase.from('wall_presets').select('*').eq('wall_id', wallId).order('sort_order')
    ]);
    if (inputs.error) throw new Error(inputs.error.message);
    if (presets.error) throw new Error(presets.error.message);
    const presetRows = presets.data || [];
    let panes = [];
    if (presetRows.length) {
      const res = await supabase.from('wall_preset_panes').select('*').in('preset_id', presetRows.map(function (p) { return p.id; }));
      if (res.error) throw new Error(res.error.message);
      panes = res.data || [];
    }
    return { inputs: inputs.data || [], presets: presetRows, panes: panes };
  }

  async function wallOrNull(row) {
    if (!row) return null;
    const kids = await loadChildren(row.id);
    return assemble(row, kids.inputs, kids.presets, kids.panes);
  }

  async function replaceChildren(wallId, data) {
    await supabase.from('wall_inputs').delete().eq('wall_id', wallId);
    await supabase.from('wall_presets').delete().eq('wall_id', wallId);
    if (data.inputs.length) {
      const { error } = await supabase.from('wall_inputs').insert(data.inputs.map(function (input) {
        return {
          id: input.id,
          wall_id: wallId,
          name: input.name,
          connector: input.connector,
          sort_order: input.sortOrder
        };
      }));
      if (error) throw new Error(error.message);
    }
    if (data.presets.length) {
      const { error } = await supabase.from('wall_presets').insert(data.presets.map(function (preset) {
        return {
          id: preset.id,
          wall_id: wallId,
          name: preset.name,
          layout: preset.layout,
          novastar_index: preset.novastarIndex,
          sort_order: preset.sortOrder
        };
      }));
      if (error) throw new Error(error.message);
      const panes = [];
      data.presets.forEach(function (preset) {
        preset.panes.forEach(function (pane) {
          panes.push({
            id: pane.id,
            preset_id: preset.id,
            pane: pane.pane,
            input_id: pane.inputId || null
          });
        });
      });
      if (panes.length) {
        const pErr = await supabase.from('wall_preset_panes').insert(panes);
        if (pErr.error) throw new Error(pErr.error.message);
      }
    }
  }

  async function applyDesiredSb(wall, cmd) {
    const stamp = nowIso();
    if (cmd.type === 'recall_preset') {
      const preset = (wall.presets || []).find(function (p) { return p.id === cmd.payload.presetId; });
      if (!preset) throw new Error('Preset not found.');
      const { error } = await supabase.from('walls').update({ active_preset_id: preset.id, updated_at: stamp }).eq('id', wall.id);
      if (error) throw new Error(error.message);
    }
    if (cmd.type === 'set_brightness') {
      const { error } = await supabase.from('walls').update({ brightness: cmd.payload.brightness, updated_at: stamp }).eq('id', wall.id);
      if (error) throw new Error(error.message);
    }
    if (cmd.type === 'set_display') {
      const { error } = await supabase.from('walls').update({ display_mode: cmd.payload.display, updated_at: stamp }).eq('id', wall.id);
      if (error) throw new Error(error.message);
    }
    if (cmd.type === 'set_source') {
      const active = (wall.presets || []).find(function (p) { return p.id === wall.activePresetId; }) || wall.presets[0];
      if (!active) throw new Error('No layout preset.');
      const pane = (active.panes || []).find(function (p) { return p.pane === cmd.payload.pane; });
      if (!pane) throw new Error('Pane not found.');
      const input = (wall.inputs || []).find(function (i) { return i.id === cmd.payload.inputId; });
      if (!input) throw new Error('Source not found.');
      const { error } = await supabase.from('wall_preset_panes').update({ input_id: input.id }).eq('id', pane.id);
      if (error) throw new Error(error.message);
      await supabase.from('walls').update({ updated_at: stamp }).eq('id', wall.id);
    }
  }

  return {
    async listWalls(userId) {
      const { data, error } = await supabase.from('walls').select('*').eq('user_id', userId).order('name');
      if (error) throw new Error(error.message);
      const out = [];
      for (let i = 0; i < (data || []).length; i++) {
        out.push(await wallOrNull(data[i]));
      }
      return out;
    },
    async getWall(id) {
      const { data, error } = await supabase.from('walls').select('*').eq('id', id).maybeSingle();
      if (error) throw new Error(error.message);
      return wallOrNull(data);
    },
    async getWallForOwner(id, userId) {
      const wall = await this.getWall(id);
      if (!wall || String(wall.userId) !== String(userId)) return null;
      return wall;
    },
    async getWallByBridgeToken(token) {
      if (!isBridgeToken(token)) return null;
      const { data, error } = await supabase.from('walls').select('*').eq('bridge_token_hash', hashBridgeToken(token)).maybeSingle();
      if (error) throw new Error(error.message);
      return wallOrNull(data);
    },
    async createWall(userId, payload) {
      const data = normalizeWall(payload || {});
      const id = newId();
      const token = newBridgeToken();
      const stamp = nowIso();
      const { error } = await supabase.from('walls').insert({
        id: id,
        user_id: userId,
        name: data.name,
        processor: data.processor,
        model: data.model,
        pitch: data.pitch,
        cols: data.cols,
        rows: data.rows,
        cabinet_w_mm: data.cabinetWmm,
        cabinet_h_mm: data.cabinetHmm,
        pixel_w: data.pixelW,
        pixel_h: data.pixelH,
        brightness: data.brightness,
        display_mode: data.displayMode,
        active_preset_id: data.activePresetId || null,
        last_seen_at: null,
        bridge_token_hash: hashBridgeToken(token),
        created_at: stamp,
        updated_at: stamp
      });
      if (error) throw new Error(error.message);
      await replaceChildren(id, data);
      return { wall: await this.getWall(id), bridgeToken: token };
    },
    async updateWall(userId, id, payload) {
      const current = await this.getWallForOwner(id, userId);
      if (!current) return null;
      const merged = normalizeWall(Object.assign({}, current, payload || {}, {
        inputs: (payload && payload.inputs) || current.inputs,
        presets: (payload && payload.presets) || current.presets
      }));
      const { error } = await supabase.from('walls').update({
        name: merged.name,
        processor: merged.processor,
        model: merged.model,
        pitch: merged.pitch,
        cols: merged.cols,
        rows: merged.rows,
        cabinet_w_mm: merged.cabinetWmm,
        cabinet_h_mm: merged.cabinetHmm,
        pixel_w: merged.pixelW,
        pixel_h: merged.pixelH,
        brightness: merged.brightness,
        display_mode: merged.displayMode,
        active_preset_id: merged.activePresetId || null,
        updated_at: nowIso()
      }).eq('id', id).eq('user_id', userId);
      if (error) throw new Error(error.message);
      if (payload && (payload.inputs || payload.presets)) {
        await replaceChildren(id, merged);
      }
      return this.getWall(id);
    },
    async deleteWall(userId, id) {
      const { data, error } = await supabase.from('walls').delete().eq('id', id).eq('user_id', userId).select('id');
      if (error) throw new Error(error.message);
      return !!(data && data.length);
    },
    async rotateBridgeToken(userId, id) {
      const current = await this.getWallForOwner(id, userId);
      if (!current) return null;
      const token = newBridgeToken();
      const { error } = await supabase.from('walls').update({
        bridge_token_hash: hashBridgeToken(token),
        updated_at: nowIso()
      }).eq('id', id).eq('user_id', userId);
      if (error) throw new Error(error.message);
      return { wall: await this.getWall(id), bridgeToken: token };
    },
    async enqueueCommand(userId, id, body) {
      const wall = await this.getWallForOwner(id, userId);
      if (!wall) return null;
      const cmd = normalizeCommand(body);
      await applyDesiredSb(wall, cmd);
      let pendingQ = supabase.from('wall_commands').update({ status: 'replaced' })
        .eq('wall_id', id).eq('type', cmd.type).eq('status', 'pending');
      const { error: rErr } = await pendingQ;
      if (rErr) throw new Error(rErr.message);
      const row = {
        id: newId(),
        wall_id: id,
        type: cmd.type,
        payload: cmd.payload,
        status: 'pending',
        created_at: nowIso(),
        acked_at: null
      };
      const { error } = await supabase.from('wall_commands').insert(row);
      if (error) throw new Error(error.message);
      return { wall: await this.getWall(id), command: publicCommand(row) };
    },
    async listPendingCommands(wallId) {
      const { data, error } = await supabase.from('wall_commands')
        .select('*')
        .eq('wall_id', wallId)
        .eq('status', 'pending')
        .order('created_at')
        .limit(50);
      if (error) throw new Error(error.message);
      return (data || []).map(publicCommand);
    },
    async heartbeat(wallId, body) {
      const stamp = nowIso();
      const { error } = await supabase.from('walls').update({ last_seen_at: stamp, updated_at: stamp }).eq('id', wallId);
      if (error) throw new Error(error.message);
      const acked = Array.isArray(body && body.ackedIds) ? body.ackedIds : [];
      const failed = Array.isArray(body && body.failedIds) ? body.failedIds : [];
      if (acked.length) {
        await supabase.from('wall_commands').update({ status: 'acked', acked_at: stamp }).in('id', acked).eq('wall_id', wallId);
      }
      if (failed.length) {
        await supabase.from('wall_commands').update({ status: 'failed', acked_at: stamp }).in('id', failed).eq('wall_id', wallId);
      }
      return this.getWall(wallId);
    }
  };
}

module.exports = {
  PROCESSOR_MODELS,
  DISPLAY_MODES,
  COMMAND_TYPES,
  OFFLINE_MS,
  BRIDGE_PREFIX,
  isBridgeToken,
  hashBridgeToken,
  isOnline,
  sqliteApi,
  supabaseApi
};
