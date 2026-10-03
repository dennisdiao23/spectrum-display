/**
 * Company → Customer → Wall Installation.
 * One job for one installed wall: files, wire pad, NovaStar steps, checklist, user menu.
 */
(function (global) {
  'use strict';

  var H = { api: null, esc: function (v) { return String(v == null ? '' : v); }, setPath: function () {}, canEdit: true };
  var S = { walls: [], jobs: [], designs: [], job: null, tool: 'power', start: '', tab: 'wall' };

  function $(id) { return document.getElementById(id); }
  function esc(v) { return H.esc(v); }

  function jobIdFromPath() {
    var m = String(location.pathname || '').match(/\/company\/wall-installation\/(\d+)/);
    return m ? m[1] : '';
  }

  function shape(job) {
    var count = parseInt(job && job.cabinetCount, 10) || 0;
    var cols = parseInt(job && job.columns, 10) || 0;
    var rows = parseInt(job && job.rows, 10) || 0;
    if (!cols && count > 0) {
      cols = count;
      rows = rows || 1;
    }
    if (cols < 1) cols = 1;
    if (rows < 1) rows = 1;
    if (cols > 40) cols = 40;
    if (rows > 30) rows = 30;
    return { cols: cols, rows: rows };
  }

  function cellId(c, r) { return c + '-' + r; }

  function say(id, text, ok) {
    var el = $(id);
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('hidden', !text);
    el.style.color = ok ? '#0f766e' : '#b91c1c';
  }

  function wallFields() {
    return {
      wallName: $('wi-name').value,
      site: $('wi-site').value,
      panel: $('wi-panel').value,
      pitch: $('wi-pitch').value,
      sizeLabel: $('wi-size').value,
      cabinetCount: $('wi-count').value,
      columns: $('wi-cols').value,
      rows: $('wi-rows').value,
      controller: $('wi-controller').value
    };
  }

  function applyFields(job) {
    $('wi-name').value = job.wallName || '';
    $('wi-site').value = job.site || '';
    $('wi-panel').value = job.panel || '';
    $('wi-pitch').value = job.pitch || '';
    $('wi-size').value = job.sizeLabel || '';
    $('wi-count').value = job.cabinetCount || '';
    $('wi-cols').value = job.columns || '';
    $('wi-rows').value = job.rows || '';
    $('wi-controller').value = job.controller || '';
  }

  function readRunsFromDom() {
    var runs = (S.job && S.job.runs) || [];
    return runs.map(function (run) {
      var circuit = document.querySelector('[data-wi-circuit="' + run.id + '"]');
      var port = document.querySelector('[data-wi-port="' + run.id + '"]');
      var distance = document.querySelector('[data-wi-distance="' + run.id + '"]');
      return {
        id: run.id,
        kind: run.kind,
        from: run.from,
        to: run.to,
        circuit: circuit ? circuit.value : run.circuit,
        port: port ? port.value : run.port,
        distance: distance ? distance.value : run.distance
      };
    });
  }

  function readStepsFromDom() {
    var lines = document.querySelectorAll('[data-wi-step]');
    var out = [];
    Array.prototype.forEach.call(lines, function (input) {
      var text = String(input.value || '').trim();
      if (text) out.push({ id: input.getAttribute('data-wi-step'), text: text });
    });
    return out;
  }

  function readChecksFromDom() {
    var checks = {};
    Array.prototype.forEach.call(document.querySelectorAll('[data-wi-check]'), function (box) {
      checks[box.getAttribute('data-wi-check')] = !!box.checked;
    });
    return checks;
  }

  async function saveJob(extra) {
    var body = Object.assign(wallFields(), extra || {});
    var data = await H.api('/api/admin/wall-installations/' + encodeURIComponent(S.job.id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    S.job = data.job;
    return data.job;
  }

  function showTab(name) {
    S.tab = name;
    ['wall', 'files', 'pad', 'setup', 'check'].forEach(function (tab) {
      var panel = $('wi-panel-' + tab);
      var btn = document.querySelector('[data-wi-tab="' + tab + '"]');
      if (panel) panel.classList.toggle('hidden', tab !== name);
      if (btn) btn.classList.toggle('is-on', tab === name);
    });
    if (name === 'pad') paintPad();
    if (name === 'files') paintFiles();
    if (name === 'setup') paintSteps();
    if (name === 'check') paintChecks();
  }

  function paintList() {
    var body = $('wi-table');
    if (!body) return;
    var byWall = {};
    S.jobs.forEach(function (job) { byWall[job.wallId] = job.id; });
    if (!S.walls.length) {
      body.innerHTML = '<tr><td colspan="5" class="py-6 px-4 text-slate-500">No installed walls yet.</td></tr>';
      return;
    }
    body.innerHTML = S.walls.map(function (wall) {
      var site = [wall.siteCity, wall.siteState].filter(Boolean).join(', ') || wall.siteStreet || '—';
      var open = byWall[String(wall.id)];
      return '<tr data-wi-wall="' + esc(wall.id) + '">' +
        '<td class="py-3 px-4">' + esc(wall.wallName || wall.number || 'Wall') + '</td>' +
        '<td class="py-3 px-4">' + esc(site) + '</td>' +
        '<td class="py-3 px-4">' + esc(wall.panel || '—') + '</td>' +
        '<td class="py-3 px-4">' + esc(wall.controller || '—') + '</td>' +
        '<td class="py-3 px-4">' + (open ? 'Open' : 'Not started') + '</td>' +
        '</tr>';
    }).join('');
  }

  function paintDesigns() {
    var sel = $('wi-design');
    if (!sel) return;
    var current = sel.value;
    var options = '<option value="">Calculator design</option>' + S.designs.map(function (design) {
      return '<option value="' + esc(design.id) + '">' + esc(design.label) + '</option>';
    }).join('');
    sel.innerHTML = options;
    if (current) sel.value = current;
  }

  function paintFiles() {
    var body = $('wi-files');
    if (!body || !S.job) return;
    var files = S.job.files || [];
    if (!files.length) {
      body.innerHTML = '<tr><td colspan="3" class="py-4 px-3 text-slate-500">No files yet.</td></tr>';
      return;
    }
    body.innerHTML = files.map(function (file) {
      return '<tr>' +
        '<td class="py-2 px-3">' + esc(file.name) + '</td>' +
        '<td class="py-2 px-3">' + esc(file.kind === 'map' ? 'Wire map' : 'File') + '</td>' +
        '<td class="py-2 px-3 text-right">' +
          '<a class="text-sky-600 text-sm" href="' + esc(file.url) + '" target="_blank" rel="noopener">Open</a> ' +
          (H.canEdit ? '<button type="button" class="text-red-500 text-sm" data-wi-del="' + esc(file.id) + '">Delete</button>' : '') +
        '</td></tr>';
    }).join('');
  }

  function paintPad() {
    var grid = $('wi-grid');
    var list = $('wi-runs');
    if (!grid || !S.job) return;
    var box = shape(S.job);
    grid.style.gridTemplateColumns = 'repeat(' + box.cols + ', minmax(2.4rem, 1fr))';
    var cells = '';
    for (var r = 0; r < box.rows; r++) {
      for (var c = 0; c < box.cols; c++) {
        var id = cellId(c, r);
        cells += '<button type="button" class="wi-cell' + (S.start === id ? ' is-on' : '') + '" data-wi-cell="' + id + '">' + (c + 1) + ',' + (r + 1) + '</button>';
      }
    }
    grid.innerHTML = cells;
    var runs = S.job.runs || [];
    if (!list) return;
    if (!runs.length) {
      list.innerHTML = '<p class="text-sm text-slate-500">No runs yet. Choose Power or Data, click a cabinet, then click where the run ends. Click the same cabinet to end at the NovaStar box or the power source.</p>';
      return;
    }
    list.innerHTML = runs.map(function (run) {
      var title = (run.kind === 'data' ? 'Data' : 'Power') + ' ' + run.from + ' → ' + (run.to === 'box' ? 'source' : run.to);
      return '<div class="wi-run">' +
        '<div class="wi-run-title"><span>' + esc(title) + '</span>' +
          (H.canEdit ? '<button type="button" data-wi-run-del="' + esc(run.id) + '">Remove</button>' : '') +
        '</div>' +
        '<label>Circuit<input data-wi-circuit="' + esc(run.id) + '" value="' + esc(run.circuit || '') + '"' + (H.canEdit ? '' : ' disabled') + '></label>' +
        '<label>NovaStar port<input data-wi-port="' + esc(run.id) + '" value="' + esc(run.port || '') + '"' + (H.canEdit ? '' : ' disabled') + '></label>' +
        '<label>Distance<input data-wi-distance="' + esc(run.id) + '" value="' + esc(run.distance || '') + '"' + (H.canEdit ? '' : ' disabled') + '></label>' +
      '</div>';
    }).join('');
  }

  function paintSteps() {
    var list = $('wi-steps');
    if (!list || !S.job) return;
    var steps = S.job.steps || [];
    if (!steps.length) {
      list.innerHTML = '<p class="text-sm text-slate-500">No steps yet. Fill from this wall, or add a line.</p>';
      return;
    }
    list.innerHTML = steps.map(function (step) {
      return '<div class="wi-step"><input data-wi-step="' + esc(step.id) + '" value="' + esc(step.text) + '"' + (H.canEdit ? '' : ' disabled') + '>' +
        (H.canEdit ? '<button type="button" data-wi-step-del="' + esc(step.id) + '">Remove</button>' : '') +
      '</div>';
    }).join('');
  }

  function paintChecks() {
    var box = $('wi-checks');
    if (!box || !S.job) return;
    var checks = S.job.checks || {};
    var items = S.job.checklist || [];
    var html = '';
    var group = '';
    items.forEach(function (item) {
      if (item.group !== group) {
        group = item.group;
        html += '<h3>' + esc(group) + '</h3>';
      }
      html += '<label class="wi-check"><input type="checkbox" data-wi-check="' + esc(item.id) + '"' +
        (checks[item.id] ? ' checked' : '') + (H.canEdit ? '' : ' disabled') + '> ' + esc(item.label) + '</label>';
    });
    box.innerHTML = html;
  }

  function portsAndCircuits() {
    var runs = (S.job && S.job.runs) || [];
    var ports = [];
    var circuits = [];
    runs.forEach(function (run) {
      if (run.port && ports.indexOf(run.port) === -1) ports.push(run.port);
      if (run.kind === 'power' && run.circuit && circuits.indexOf(run.circuit) === -1) circuits.push(run.circuit);
    });
    return {
      ports: ports.length ? ports.join(', ') : 'the port on that run',
      circuits: circuits.length ? circuits.join(', ') : 'the circuit on that run'
    };
  }

  function filledSteps(job) {
    var grid = shape(job);
    var names = portsAndCircuits();
    var size = job.sizeLabel || 'the screen size on this wall';
    var panel = job.panel || 'the panel';
    var pitch = job.pitch ? (job.pitch + ' mm') : 'the pitch on this wall';
    var count = job.cabinetCount || String(grid.cols * grid.rows);
    var controller = job.controller || 'the NovaStar controller';
    return [
      { id: 'size', text: 'Screen size: ' + size + ' (' + grid.cols + ' × ' + grid.rows + ' cabinets).' },
      { id: 'map', text: 'Cabinet map: ' + count + ' cabinets, ' + panel + ', pitch ' + pitch + '.' },
      { id: 'ports', text: 'Ethernet ports: ' + names.ports + '.' },
      { id: 'backup', text: 'Backup: set the NovaStar backup on ' + controller + '.' },
      { id: 'input', text: 'Input: confirm the input on ' + controller + '.' },
      { id: 'bright', text: 'Brightness: set brightness for this site.' }
    ];
  }

  function paintUserMenu() {
    var job = S.job;
    if (!job) return;
    var names = portsAndCircuits();
    $('wi-user-title').textContent = job.wallName || 'This wall';
    var facts = [
      ['Site', job.site],
      ['Panel', job.panel],
      ['Pitch', job.pitch],
      ['Size', job.sizeLabel],
      ['Cabinets', job.cabinetCount],
      ['Grid', (job.columns || shape(job).cols) + ' × ' + (job.rows || shape(job).rows)],
      ['Controller', job.controller]
    ];
    $('wi-user-facts').innerHTML = facts.map(function (pair) {
      return '<div><dt>' + esc(pair[0]) + '</dt><dd>' + esc(pair[1] || '—') + '</dd></div>';
    }).join('');
    var runs = job.runs || [];
    $('wi-user-runs').innerHTML = runs.length ? runs.map(function (run) {
      var bits = [(run.kind === 'data' ? 'Data' : 'Power'), run.from + ' → ' + (run.to === 'box' ? 'source' : run.to)];
      if (run.circuit) bits.push('Circuit ' + run.circuit);
      if (run.port) bits.push('Port ' + run.port);
      if (run.distance) bits.push(run.distance);
      return '<li>' + esc(bits.join(' · ')) + '</li>';
    }).join('') : '<li>No runs saved.</li>';
    var steps = job.steps || [];
    $('wi-user-steps').innerHTML = steps.length ? steps.map(function (step) {
      return '<li>' + esc(step.text) + '</li>';
    }).join('') : '<li>No setup steps saved.</li>';
    var tries = [
      ['No picture', 'Check power to the NovaStar box, then the input.'],
      ['Part of the wall dark', 'Follow the data run for that area. Reseat ' + names.ports + '.'],
      ['Flicker', 'Check ' + names.circuits + ' and the ground.'],
      ['Wrong color', 'Check the input and the NovaStar color settings.'],
      ['One port dead', 'Reseat that NovaStar port (' + names.ports + '). If it stays dark, move the run to the backup port.']
    ];
    $('wi-user-if').innerHTML = tries.map(function (row) {
      return '<div><dt>' + esc(row[0]) + '</dt><dd>' + esc(row[1]) + '</dd></div>';
    }).join('');
    var map = (job.files || []).filter(function (file) { return file.kind === 'map'; })[0];
    var img = $('wi-user-map');
    if (img) {
      if (map) {
        img.hidden = false;
        img.src = map.url;
        img.alt = 'Wire map';
      } else {
        img.hidden = true;
        img.removeAttribute('src');
      }
    }
  }

  function openJobView() {
    $('wi-list').classList.add('hidden');
    $('wi-job').classList.remove('hidden');
    $('wi-job-title').textContent = S.job.wallName || 'Wall Installation';
    applyFields(S.job);
    paintDesigns();
    showTab(S.tab || 'wall');
    var locked = !H.canEdit;
    ['wi-name', 'wi-site', 'wi-panel', 'wi-pitch', 'wi-size', 'wi-count', 'wi-cols', 'wi-rows', 'wi-controller', 'wi-design'].forEach(function (id) {
      if ($(id)) $(id).disabled = locked;
    });
    document.querySelectorAll('.wi-save, #wi-upload, #wi-export, #wi-fill, #wi-add-step').forEach(function (el) {
      el.disabled = locked;
    });
  }

  function openListView() {
    $('wi-job').classList.add('hidden');
    $('wi-user').classList.add('hidden');
    $('wi-list').classList.remove('hidden');
    $('wi-pick').classList.add('hidden');
    paintList();
    H.setPath('/company/wall-installation');
  }

  async function openWall(wallId) {
    var existing = S.jobs.filter(function (job) { return String(job.wallId) === String(wallId); })[0];
    var data;
    if (existing) {
      data = await H.api('/api/admin/wall-installations/' + encodeURIComponent(existing.id));
    } else {
      if (!H.canEdit) throw new Error('Starting a job needs permission to edit orders.');
      data = await H.api('/api/admin/wall-installations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallId: wallId })
      });
      S.jobs.push({ id: String(data.job.id), wallId: String(wallId) });
    }
    S.job = data.job;
    S.tab = 'wall';
    S.start = '';
    openJobView();
    H.setPath('/company/wall-installation/' + S.job.id);
  }

  async function loadList() {
    var data = await H.api('/api/admin/wall-installations');
    S.walls = data.walls || [];
    S.jobs = data.jobs || [];
    S.designs = data.designs || [];
    paintList();
    paintDesigns();
    var newer = $('wi-new');
    if (newer) newer.hidden = !H.canEdit;
  }

  async function load() {
    say('wi-error', '', true);
    try {
      await loadList();
      var id = jobIdFromPath();
      if (id) {
        var data = await H.api('/api/admin/wall-installations/' + encodeURIComponent(id));
        S.job = data.job;
        openJobView();
      } else {
        openListView();
      }
    } catch (err) {
      say('wi-error', err.message || 'Could not load Wall Installation.', false);
    }
  }

  function addRun(from, to) {
    var runs = (S.job.runs || []).slice();
    runs.push({
      id: 'r' + Date.now().toString(36),
      kind: S.tool === 'data' ? 'data' : 'power',
      from: from,
      to: to,
      circuit: '',
      port: '',
      distance: ''
    });
    S.job.runs = runs;
    S.start = '';
    paintPad();
  }

  function exportMap() {
    var job = S.job;
    var box = shape(job);
    var cell = 64;
    var pad = 36;
    var canvas = document.createElement('canvas');
    canvas.width = pad * 2 + box.cols * cell;
    canvas.height = pad * 2 + box.rows * cell + 28;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#cbd5e1';
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText(job.wallName || 'Wire map', pad, 22);
    function center(id) {
      if (id === 'box') return { x: pad / 2, y: pad + (box.rows * cell) / 2 };
      var parts = String(id).split('-');
      var c = parseInt(parts[0], 10) || 0;
      var r = parseInt(parts[1], 10) || 0;
      return { x: pad + c * cell + cell / 2, y: pad + 20 + r * cell + cell / 2 };
    }
    (job.runs || []).forEach(function (run) {
      var a = center(run.from);
      var b = center(run.to);
      ctx.strokeStyle = run.kind === 'data' ? '#2563eb' : '#dc2626';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#0f172a';
    for (var r = 0; r < box.rows; r++) {
      for (var c = 0; c < box.cols; c++) {
        var x = pad + c * cell;
        var y = pad + 20 + r * cell;
        ctx.strokeRect(x + 8, y + 8, cell - 16, cell - 16);
        ctx.fillText((c + 1) + ',' + (r + 1), x + 16, y + 36);
      }
    }
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) { resolve(blob); }, 'image/png');
    });
  }

  function bind() {
    var root = $('wall-installation-section');
    if (!root || root.getAttribute('data-wi-bound')) return;
    root.setAttribute('data-wi-bound', '1');
    root.addEventListener('click', function (e) {
      var wall = e.target.closest('[data-wi-wall]');
      if (wall) {
        openWall(wall.getAttribute('data-wi-wall')).catch(function (err) {
          say('wi-error', err.message, false);
        });
        return;
      }
      var tab = e.target.closest('[data-wi-tab]');
      if (tab) {
        if (S.job) S.job.runs = readRunsFromDom();
        showTab(tab.getAttribute('data-wi-tab'));
        return;
      }
      if (e.target.closest('#wi-back')) {
        openListView();
        return;
      }
      if (e.target.closest('#wi-new')) {
        var open = {};
        S.jobs.forEach(function (job) { open[job.wallId] = true; });
        var pending = S.walls.filter(function (wall) { return !open[String(wall.id)]; });
        var sel = $('wi-pick-wall');
        sel.innerHTML = pending.map(function (wall) {
          return '<option value="' + esc(wall.id) + '">' + esc(wall.wallName || wall.number || 'Wall') + '</option>';
        }).join('');
        $('wi-pick').classList.toggle('hidden', !pending.length);
        say('wi-error', pending.length ? '' : 'Every installed wall already has a job.', !pending.length);
        return;
      }
      if (e.target.closest('#wi-pick-start')) {
        var id = $('wi-pick-wall').value;
        if (!id) return;
        openWall(id).catch(function (err) { say('wi-error', err.message, false); });
        return;
      }
      var tool = e.target.closest('[data-wi-tool]');
      if (tool) {
        S.tool = tool.getAttribute('data-wi-tool');
        root.querySelectorAll('[data-wi-tool]').forEach(function (btn) {
          btn.classList.toggle('is-on', btn === tool);
        });
        return;
      }
      var cell = e.target.closest('[data-wi-cell]');
      if (cell && H.canEdit) {
        var idCell = cell.getAttribute('data-wi-cell');
        if (!S.start) {
          S.start = idCell;
          paintPad();
        } else if (S.start === idCell) {
          addRun(S.start, 'box');
        } else {
          addRun(S.start, idCell);
        }
        return;
      }
      var delRun = e.target.closest('[data-wi-run-del]');
      if (delRun) {
        var rid = delRun.getAttribute('data-wi-run-del');
        S.job.runs = readRunsFromDom().filter(function (run) { return run.id !== rid; });
        paintPad();
        return;
      }
      var delStep = e.target.closest('[data-wi-step-del]');
      if (delStep) {
        var sid = delStep.getAttribute('data-wi-step-del');
        S.job.steps = readStepsFromDom().filter(function (step) { return step.id !== sid; });
        paintSteps();
        return;
      }
      if (e.target.closest('#wi-add-step')) {
        S.job.steps = readStepsFromDom().concat([{ id: 's' + Date.now().toString(36), text: '' }]);
        paintSteps();
        return;
      }
      if (e.target.closest('#wi-user-open')) {
        if (S.job) {
          S.job.runs = readRunsFromDom();
          S.job.steps = readStepsFromDom();
        }
        paintUserMenu();
        $('wi-user').classList.remove('hidden');
        return;
      }
      if (e.target.closest('#wi-user-close')) {
        $('wi-user').classList.add('hidden');
        return;
      }
      if (e.target.closest('#wi-print')) {
        document.body.classList.add('wi-printing');
        window.print();
        document.body.classList.remove('wi-printing');
        return;
      }
      var delFile = e.target.closest('[data-wi-del]');
      if (delFile) {
        H.api('/api/admin/wall-installations/' + encodeURIComponent(S.job.id) + '/files/' + encodeURIComponent(delFile.getAttribute('data-wi-del')), { method: 'DELETE' })
          .then(function () { return H.api('/api/admin/wall-installations/' + encodeURIComponent(S.job.id)); })
          .then(function (data) { S.job = data.job; paintFiles(); })
          .catch(function (err) { say('wi-file-msg', err.message, false); });
      }
    });
    root.addEventListener('change', function (e) {
      if (e.target && e.target.id === 'wi-design') {
        var design = S.designs.filter(function (row) { return String(row.id) === e.target.value; })[0];
        if (!design) return;
        if (design.panel) $('wi-panel').value = design.panel;
        if (design.pitch) $('wi-pitch').value = design.pitch;
        if (design.sizeLabel) $('wi-size').value = design.sizeLabel;
        if (design.cabinetCount) $('wi-count').value = design.cabinetCount;
        return;
      }
      if (e.target && e.target.id === 'wi-file') {
        var file = e.target.files && e.target.files[0];
        if (!file || !S.job) return;
        var body = new FormData();
        body.append('file', file);
        H.api('/api/admin/wall-installations/' + encodeURIComponent(S.job.id) + '/files', { method: 'POST', body: body })
          .then(function () { return H.api('/api/admin/wall-installations/' + encodeURIComponent(S.job.id)); })
          .then(function (data) {
            S.job = data.job;
            e.target.value = '';
            paintFiles();
            say('wi-file-msg', 'Saved.', true);
          })
          .catch(function (err) { say('wi-file-msg', err.message, false); });
        return;
      }
      if (e.target && e.target.getAttribute('data-wi-check') && S.job) {
        saveJob({ checks: readChecksFromDom() }).catch(function (err) {
          say('wi-check-msg', err.message, false);
        });
      }
    });
    root.addEventListener('submit', function (e) {
      if (e.target && e.target.id === 'wi-wall-form') {
        e.preventDefault();
        saveJob().then(function () { say('wi-wall-msg', 'Saved.', true); }).catch(function (err) {
          say('wi-wall-msg', err.message, false);
        });
      }
    });
    var savePad = $('wi-save-pad');
    if (savePad) savePad.addEventListener('click', function () {
      S.job.runs = readRunsFromDom();
      saveJob({ runs: S.job.runs }).then(function () { say('wi-pad-msg', 'Saved.', true); paintPad(); }).catch(function (err) {
        say('wi-pad-msg', err.message, false);
      });
    });
    var exportBtn = $('wi-export');
    if (exportBtn) exportBtn.addEventListener('click', function () {
      S.job.runs = readRunsFromDom();
      exportMap().then(function (blob) {
        if (!blob) return;
        var body = new FormData();
        body.append('file', blob, (S.job.wallName || 'wire-map') + '.png');
        body.append('kind', 'map');
        return H.api('/api/admin/wall-installations/' + encodeURIComponent(S.job.id) + '/files', { method: 'POST', body: body });
      }).then(function () {
        return H.api('/api/admin/wall-installations/' + encodeURIComponent(S.job.id));
      }).then(function (data) {
        S.job = data.job;
        say('wi-pad-msg', 'Map saved in Files.', true);
      }).catch(function (err) { say('wi-pad-msg', err.message, false); });
    });
    var fill = $('wi-fill');
    if (fill) fill.addEventListener('click', function () {
      var next = filledSteps(Object.assign({}, S.job, wallFields(), { runs: readRunsFromDom() }));
      if ((S.job.steps || []).length && !window.confirm('Replace the setup steps with a new list from this wall?')) return;
      S.job = Object.assign({}, S.job, wallFields(), { runs: readRunsFromDom(), steps: next });
      paintSteps();
    });
    var saveSteps = $('wi-save-steps');
    if (saveSteps) saveSteps.addEventListener('click', function () {
      S.job.steps = readStepsFromDom();
      saveJob(Object.assign(wallFields(), { steps: S.job.steps })).then(function () {
        say('wi-step-msg', 'Saved.', true);
        paintSteps();
      }).catch(function (err) { say('wi-step-msg', err.message, false); });
    });
  }

  global.SpectrumWallInstall = {
    boot: function (helpers) {
      if (helpers && helpers.api) H.api = helpers.api;
      if (helpers && helpers.esc) H.esc = helpers.esc;
      if (helpers && helpers.setPath) H.setPath = helpers.setPath;
      if (helpers && typeof helpers.canEdit === 'boolean') H.canEdit = helpers.canEdit;
      bind();
    },
    load: load
  };
})(window);
