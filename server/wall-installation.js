/**
 * Company → Wall Installation. One job per installed wall.
 * Photos, the wire map, NovaStar steps, and the checklist stay on the job.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const PRIVATE_DIR = path.join(ROOT, 'data', 'wall-installations');
const BUCKET = 'dealer-files';

const CHECKS = [
  { group: 'Before you leave the shop', id: 'shop-spares', label: 'Spare cabinets and the NovaStar box are packed.' },
  { group: 'Before you leave the shop', id: 'shop-drawings', label: 'Drawings and the wire map are with the job.' },
  { group: 'On site', id: 'site-power', label: 'Power location matches the wire map.' },
  { group: 'On site', id: 'site-data', label: 'Data path matches the wire map.' },
  { group: 'On site', id: 'site-structure', label: 'The wall structure is ready.' },
  { group: 'Power on', id: 'power-circuits', label: 'Each power circuit is labeled.' },
  { group: 'Power on', id: 'power-ports', label: 'Each NovaStar port has a picture.' },
  { group: 'Power on', id: 'power-full', label: 'The full wall has a picture.' },
  { group: 'Sign-off', id: 'sign-menu', label: 'The user menu was walked with the customer.' },
  { group: 'Sign-off', id: 'sign-photos', label: 'Site photos are saved on this wall.' }
];

function trim(value, max) {
  const text = String(value == null ? '' : value).trim();
  return max ? text.slice(0, max) : text;
}

function nowIso() {
  return new Date().toISOString();
}

function throwIf(error, message) {
  if (!error) return;
  const err = new Error(message || error.message || 'Request failed.');
  err.code = 'invalid';
  throw err;
}

function parseJson(raw, fallback) {
  if (raw && typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw || '');
    return parsed == null ? fallback : parsed;
  } catch (err) {
    return fallback;
  }
}

function siteLine(wall) {
  return [wall.siteStreet, wall.siteCity, wall.siteState, wall.siteZip].filter(Boolean).join(', ');
}

function cleanRuns(list) {
  return (Array.isArray(list) ? list : []).slice(0, 200).map(function (row, i) {
    const from = trim(row && row.from, 20);
    if (!from) return null;
    return {
      id: trim(row && row.id, 40) || ('r' + (i + 1)),
      kind: row && row.kind === 'data' ? 'data' : 'power',
      from: from,
      to: trim(row && row.to, 20) || 'box',
      circuit: trim(row && row.circuit, 80),
      port: trim(row && row.port, 80),
      distance: trim(row && row.distance, 40)
    };
  }).filter(Boolean);
}

function cleanSteps(list) {
  return (Array.isArray(list) ? list : []).slice(0, 40).map(function (row, i) {
    const text = trim(typeof row === 'string' ? row : (row && row.text), 500);
    if (!text) return null;
    return { id: trim(row && row.id, 40) || ('s' + (i + 1)), text: text };
  }).filter(Boolean);
}

function cleanChecks(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  CHECKS.forEach(function (item) {
    out[item.id] = !!src[item.id];
  });
  return out;
}

function fieldsFrom(body, current) {
  const src = body || {};
  const cur = current || {};
  function pick(key, max, fallback) {
    if (Object.prototype.hasOwnProperty.call(src, key)) return trim(src[key], max);
    return fallback == null ? '' : String(fallback);
  }
  return {
    wallName: pick('wallName', 160, cur.wall_name),
    site: pick('site', 240, cur.site),
    panel: pick('panel', 160, cur.panel),
    pitch: pick('pitch', 40, cur.pitch),
    sizeLabel: pick('sizeLabel', 80, cur.size_label),
    cabinetCount: pick('cabinetCount', 20, cur.cabinet_count),
    columns: pick('columns', 8, cur.columns),
    rows: pick('rows', 8, cur.rows),
    controller: pick('controller', 160, cur.controller)
  };
}

function seedFromWall(wall) {
  return {
    wallName: wall.wallName || '',
    site: siteLine(wall),
    panel: wall.panel || '',
    pitch: wall.pitch || '',
    sizeLabel: '',
    cabinetCount: '',
    columns: '',
    rows: '',
    controller: wall.controller || ''
  };
}

function formatJob(row, files) {
  if (!row) return null;
  return {
    id: String(row.id),
    wallId: String(row.wall_id),
    wallName: row.wall_name || '',
    site: row.site || '',
    panel: row.panel || '',
    pitch: row.pitch || '',
    sizeLabel: row.size_label || '',
    cabinetCount: row.cabinet_count || '',
    columns: row.columns || '',
    rows: row.rows || '',
    controller: row.controller || '',
    runs: cleanRuns(parseJson(row.wire_json, [])),
    steps: cleanSteps(parseJson(row.steps_json, [])),
    checks: cleanChecks(parseJson(row.checklist_json, {})),
    checklist: CHECKS,
    files: files || [],
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

function formatFile(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    name: row.name || 'File',
    kind: row.kind || 'file',
    createdAt: row.created_at || '',
    url: '/api/admin/wall-installations/' + row.install_id + '/files/' + row.id
  };
}

function publicDesign(row) {
  const summary = parseJson(row.calculator_summary || row.calculatorSummary, null);
  if (!summary || typeof summary !== 'object') return null;
  const series = trim(summary.seriesName || summary.series, 80);
  const pitch = summary.pitch == null ? '' : trim(summary.pitch, 40);
  const size = trim(summary.sizeLabel, 80);
  const width = summary.width == null ? '' : trim(summary.width, 20);
  const height = summary.height == null ? '' : trim(summary.height, 20);
  const unit = trim(summary.unit, 8) || 'ft';
  const cabinets = summary.cabinets == null ? '' : trim(summary.cabinets, 20);
  const label = [series, pitch ? (pitch + ' mm') : '', size].filter(Boolean).join(' · ') || 'Calculator design';
  const company = trim(row.company_name || row.display_name, 80);
  return {
    id: String(row.id),
    label: company ? (company + ' — ' + label) : label,
    panel: series,
    pitch: pitch ? String(pitch) : '',
    sizeLabel: size || (width && height ? (width + ' × ' + height + ' ' + unit) : ''),
    cabinetCount: cabinets
  };
}

function contentType(name) {
  const ext = path.extname(String(name || '')).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.pdf') return 'application/pdf';
  return 'application/octet-stream';
}

function downloadName(name) {
  return String(name || 'file').replace(/[\r\n"]/g, '').slice(0, 180) || 'file';
}

function storageError(error) {
  if (!error) return '';
  return String(error.message || error.error || error);
}

async function saveBytes(file, installId, supabase) {
  if (!file || !file.buffer || !installId) return null;
  const ext = path.extname(file.originalname || '').toLowerCase();
  const safeExt = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'].indexOf(ext) !== -1 ? ext : '';
  if (!safeExt) return null;
  const storedName = Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex') + safeExt;
  const dir = path.join(PRIVATE_DIR, String(installId));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, storedName), file.buffer);
  const objectPath = 'wall-install/' + installId + '/' + storedName;
  if (supabase) {
    let uploaded = await supabase.storage.from(BUCKET).upload(objectPath, file.buffer, {
      contentType: contentType(storedName),
      upsert: false
    });
    if (uploaded.error && /bucket/i.test(storageError(uploaded.error))) {
      await supabase.storage.createBucket(BUCKET, { public: false });
      uploaded = await supabase.storage.from(BUCKET).upload(objectPath, file.buffer, {
        contentType: contentType(storedName),
        upsert: false
      });
    }
    if (uploaded.error) {
      console.error('Could not store wall installation file:', storageError(uploaded.error));
      try { fs.unlinkSync(path.join(dir, storedName)); } catch (err) { /* ignore */ }
      throw Object.assign(new Error('Could not store the file.'), { code: 'invalid' });
    }
  }
  return {
    name: trim(file.originalname, 200) || ('file' + safeExt),
    url: 'private:' + objectPath
  };
}

async function readBytes(url, supabase) {
  const raw = String(url || '');
  const objectPath = raw.indexOf('private:') === 0 ? raw.slice('private:'.length) : '';
  if (!objectPath || objectPath.indexOf('..') !== -1) return null;
  if (supabase) {
    const downloaded = await supabase.storage.from(BUCKET).download(objectPath);
    if (!downloaded.error && downloaded.data) return Buffer.from(await downloaded.data.arrayBuffer());
  }
  const parts = objectPath.split('/');
  const storedName = parts.pop();
  const installId = parts.pop();
  if (!storedName || !installId) return null;
  const disk = path.join(PRIVATE_DIR, installId, storedName);
  if (!fs.existsSync(disk)) return null;
  return fs.readFileSync(disk);
}

function sqliteApi(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS wall_installations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wall_id INTEGER NOT NULL UNIQUE,
      wall_name TEXT NOT NULL DEFAULT '',
      site TEXT NOT NULL DEFAULT '',
      panel TEXT NOT NULL DEFAULT '',
      pitch TEXT NOT NULL DEFAULT '',
      size_label TEXT NOT NULL DEFAULT '',
      cabinet_count TEXT NOT NULL DEFAULT '',
      columns TEXT NOT NULL DEFAULT '',
      rows TEXT NOT NULL DEFAULT '',
      controller TEXT NOT NULL DEFAULT '',
      wire_json TEXT NOT NULL DEFAULT '[]',
      steps_json TEXT NOT NULL DEFAULT '[]',
      checklist_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS wall_installation_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      install_id INTEGER NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL DEFAULT 'file',
      created_at TEXT NOT NULL
    );
  `);

  function filesFor(installId) {
    return db.prepare('SELECT * FROM wall_installation_files WHERE install_id = ? ORDER BY id DESC').all(installId).map(formatFile);
  }

  function rowById(id) {
    return db.prepare('SELECT * FROM wall_installations WHERE id = ?').get(id);
  }

  return {
    checklistItems: CHECKS,
    async listWallInstallationJobs() {
      return db.prepare('SELECT id, wall_id FROM wall_installations').all().map(function (row) {
        return { id: String(row.id), wallId: String(row.wall_id) };
      });
    },
    async listWallInstallationDesigns() {
      let rows = [];
      try {
        rows = db.prepare(
          "SELECT id, company_name, display_name, calculator_summary FROM company_crm_leads WHERE calculator_summary != '' ORDER BY datetime(updated_at) DESC LIMIT 40"
        ).all();
      } catch (err) {
        rows = [];
      }
      return rows.map(publicDesign).filter(Boolean);
    },
    async getWallInstallation(id) {
      const row = rowById(id);
      return formatJob(row, row ? filesFor(row.id) : []);
    },
    async getWallInstallationByWall(wallId) {
      const row = db.prepare('SELECT * FROM wall_installations WHERE wall_id = ?').get(wallId);
      return formatJob(row, row ? filesFor(row.id) : []);
    },
    async createWallInstallation(wall) {
      const existing = db.prepare('SELECT * FROM wall_installations WHERE wall_id = ?').get(wall.id);
      if (existing) return formatJob(existing, filesFor(existing.id));
      const seed = seedFromWall(wall);
      const ts = nowIso();
      const info = db.prepare(`
        INSERT INTO wall_installations (
          wall_id, wall_name, site, panel, pitch, size_label, cabinet_count, columns, rows, controller,
          wire_json, steps_json, checklist_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', '[]', '{}', ?, ?)
      `).run(
        wall.id, seed.wallName, seed.site, seed.panel, seed.pitch, seed.sizeLabel,
        seed.cabinetCount, seed.columns, seed.rows, seed.controller, ts, ts
      );
      return formatJob(rowById(info.lastInsertRowid), []);
    },
    async updateWallInstallation(id, body) {
      const current = rowById(id);
      if (!current) return null;
      const next = fieldsFrom(body, current);
      const runs = Object.prototype.hasOwnProperty.call(body || {}, 'runs') ? cleanRuns(body.runs) : cleanRuns(parseJson(current.wire_json, []));
      const steps = Object.prototype.hasOwnProperty.call(body || {}, 'steps') ? cleanSteps(body.steps) : cleanSteps(parseJson(current.steps_json, []));
      const checks = Object.prototype.hasOwnProperty.call(body || {}, 'checks') ? cleanChecks(body.checks) : cleanChecks(parseJson(current.checklist_json, {}));
      db.prepare(`
        UPDATE wall_installations SET
          wall_name = ?, site = ?, panel = ?, pitch = ?, size_label = ?, cabinet_count = ?,
          columns = ?, rows = ?, controller = ?, wire_json = ?, steps_json = ?, checklist_json = ?, updated_at = ?
        WHERE id = ?
      `).run(
        next.wallName, next.site, next.panel, next.pitch, next.sizeLabel, next.cabinetCount,
        next.columns, next.rows, next.controller,
        JSON.stringify(runs), JSON.stringify(steps), JSON.stringify(checks), nowIso(), id
      );
      return formatJob(rowById(id), filesFor(id));
    },
    async addWallInstallationFile(id, file, kind) {
      const row = rowById(id);
      if (!row) return null;
      const saved = await saveBytes(file, id, null);
      if (!saved) throw Object.assign(new Error('Choose a PDF, JPG, PNG, or WebP.'), { code: 'invalid' });
      const info = db.prepare(
        'INSERT INTO wall_installation_files (install_id, name, url, kind, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(id, saved.name, saved.url, kind === 'map' ? 'map' : 'file', nowIso());
      return formatFile(db.prepare('SELECT * FROM wall_installation_files WHERE id = ?').get(info.lastInsertRowid));
    },
    async getWallInstallationFile(installId, fileId) {
      return db.prepare('SELECT * FROM wall_installation_files WHERE id = ? AND install_id = ?').get(fileId, installId);
    },
    async readWallInstallationFile(row) {
      return readBytes(row && row.url, null);
    },
    async deleteWallInstallationFile(installId, fileId) {
      const row = db.prepare('SELECT * FROM wall_installation_files WHERE id = ? AND install_id = ?').get(fileId, installId);
      if (!row) return false;
      db.prepare('DELETE FROM wall_installation_files WHERE id = ?').run(fileId);
      return true;
    }
  };
}

function supabaseApi(supabase) {
  async function filesFor(installId) {
    const { data, error } = await supabase.from('wall_installation_files').select('*').eq('install_id', installId).order('id', { ascending: false });
    throwIf(error, 'Could not load files.');
    return (data || []).map(formatFile);
  }
  async function rowById(id) {
    const { data, error } = await supabase.from('wall_installations').select('*').eq('id', id).maybeSingle();
    throwIf(error, 'Could not load this installation.');
    return data;
  }
  return {
    checklistItems: CHECKS,
    async listWallInstallationJobs() {
      const { data, error } = await supabase.from('wall_installations').select('id, wall_id');
      throwIf(error, 'Could not load installations.');
      return (data || []).map(function (row) {
        return { id: String(row.id), wallId: String(row.wall_id) };
      });
    },
    async listWallInstallationDesigns() {
      const { data, error } = await supabase.from('company_crm_leads').select('id, company_name, display_name, calculator_summary').neq('calculator_summary', '').order('updated_at', { ascending: false }).limit(40);
      if (error) return [];
      return (data || []).map(publicDesign).filter(Boolean);
    },
    async getWallInstallation(id) {
      const row = await rowById(id);
      return formatJob(row, row ? await filesFor(row.id) : []);
    },
    async getWallInstallationByWall(wallId) {
      const { data, error } = await supabase.from('wall_installations').select('*').eq('wall_id', wallId).maybeSingle();
      throwIf(error, 'Could not load this installation.');
      return formatJob(data, data ? await filesFor(data.id) : []);
    },
    async createWallInstallation(wall) {
      const existing = await this.getWallInstallationByWall(wall.id);
      if (existing) return existing;
      const seed = seedFromWall(wall);
      const ts = nowIso();
      const { data, error } = await supabase.from('wall_installations').insert({
        wall_id: Number(wall.id),
        wall_name: seed.wallName,
        site: seed.site,
        panel: seed.panel,
        pitch: seed.pitch,
        size_label: seed.sizeLabel,
        cabinet_count: seed.cabinetCount,
        columns: seed.columns,
        rows: seed.rows,
        controller: seed.controller,
        wire_json: '[]',
        steps_json: '[]',
        checklist_json: '{}',
        created_at: ts,
        updated_at: ts
      }).select('*').single();
      throwIf(error, 'Could not start this installation.');
      return formatJob(data, []);
    },
    async updateWallInstallation(id, body) {
      const current = await rowById(id);
      if (!current) return null;
      const next = fieldsFrom(body, current);
      const runs = Object.prototype.hasOwnProperty.call(body || {}, 'runs') ? cleanRuns(body.runs) : cleanRuns(parseJson(current.wire_json, []));
      const steps = Object.prototype.hasOwnProperty.call(body || {}, 'steps') ? cleanSteps(body.steps) : cleanSteps(parseJson(current.steps_json, []));
      const checks = Object.prototype.hasOwnProperty.call(body || {}, 'checks') ? cleanChecks(body.checks) : cleanChecks(parseJson(current.checklist_json, {}));
      const { data, error } = await supabase.from('wall_installations').update({
        wall_name: next.wallName,
        site: next.site,
        panel: next.panel,
        pitch: next.pitch,
        size_label: next.sizeLabel,
        cabinet_count: next.cabinetCount,
        columns: next.columns,
        rows: next.rows,
        controller: next.controller,
        wire_json: JSON.stringify(runs),
        steps_json: JSON.stringify(steps),
        checklist_json: JSON.stringify(checks),
        updated_at: nowIso()
      }).eq('id', id).select('*').single();
      throwIf(error, 'Could not save this installation.');
      return formatJob(data, await filesFor(id));
    },
    async addWallInstallationFile(id, file, kind) {
      const row = await rowById(id);
      if (!row) return null;
      const saved = await saveBytes(file, id, supabase);
      if (!saved) throw Object.assign(new Error('Choose a PDF, JPG, PNG, or WebP.'), { code: 'invalid' });
      const { data, error } = await supabase.from('wall_installation_files').insert({
        install_id: Number(id),
        name: saved.name,
        url: saved.url,
        kind: kind === 'map' ? 'map' : 'file',
        created_at: nowIso()
      }).select('*').single();
      throwIf(error, 'Could not save the file.');
      return formatFile(data);
    },
    async getWallInstallationFile(installId, fileId) {
      const { data, error } = await supabase.from('wall_installation_files').select('*').eq('id', fileId).eq('install_id', installId).maybeSingle();
      throwIf(error, 'Could not load the file.');
      return data;
    },
    async readWallInstallationFile(row) {
      return readBytes(row && row.url, supabase);
    },
    async deleteWallInstallationFile(installId, fileId) {
      const row = await this.getWallInstallationFile(installId, fileId);
      if (!row) return false;
      const { error } = await supabase.from('wall_installation_files').delete().eq('id', fileId);
      throwIf(error, 'Could not delete the file.');
      return true;
    }
  };
}

module.exports = {
  sqliteApi: sqliteApi,
  supabaseApi: supabaseApi,
  contentType: contentType,
  downloadName: downloadName,
  CHECKS: CHECKS
};
