/**
 * Spectrum Display — signed-in LED Wall Controller. Talks to /api/walls*.
 */
(function () {
  const Auth = window.SpectrumAuth;
  const DEFAULT_TEMPLATES = [
    { layout: 'full', name: 'Full', panes: ['full'] },
    { layout: 'split', name: 'Split 50/50', panes: ['left', 'right'] },
    { layout: 'quad', name: 'Quad', panes: ['tl', 'tr', 'bl', 'br'] },
    { layout: 'five', name: '5-up', panes: ['main', 'p1', 'p2', 'p3', 'p4'] },
    { layout: 'cinema235', name: 'Cinema 2.35', panes: ['cinema'] },
    { layout: 'wide32x9', name: 'Wide 32:9', panes: ['wide'] }
  ];
  const PANE_LABELS = {
    full: 'Full',
    left: 'Left',
    right: 'Right',
    tl: 'Top left',
    tr: 'Top right',
    bl: 'Bottom left',
    br: 'Bottom right',
    main: 'Main',
    p1: '1',
    p2: '2',
    p3: '3',
    p4: '4',
    cinema: 'Cinema',
    wide: 'Wide'
  };
  let walls = [];
  let processors = [];
  let templates = DEFAULT_TEMPLATES.slice();
  let current = null;
  let selectedPane = '';
  let showA1 = false;
  let lastToken = '';
  let pollTimer = null;

  function $(id) { return document.getElementById(id); }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function api(path, opts) {
    const token = Auth && Auth.accessToken ? await Auth.accessToken() : '';
    const res = await fetch(path, Object.assign({
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: token ? 'Bearer ' + token : ''
      }
    }, opts || {}));
    const data = await res.json().catch(function () { return {}; });
    if (res.status === 401) {
      if (Auth && Auth.logout) await Auth.logout();
      showGuest();
      throw new Error('Sign in required.');
    }
    if (!res.ok || data.ok === false) {
      throw new Error((data && data.error) || 'Request failed.');
    }
    return data;
  }

  function activePreset(wall) {
    if (!wall) return null;
    return (wall.presets || []).find(function (p) { return p.id === wall.activePresetId; }) || wall.presets[0] || null;
  }

  function paneSource(wall, pane) {
    const preset = activePreset(wall);
    if (!preset) return null;
    const hit = (preset.panes || []).find(function (p) { return p.pane === pane; });
    if (!hit) return null;
    return (wall.inputs || []).find(function (i) { return i.id === hit.inputId; }) || null;
  }

  function paneLabel(pane) {
    return PANE_LABELS[pane] || pane || 'Pane';
  }

  function canSave(wall) {
    return !!(wall && wall.capabilities && wall.capabilities.saveLayout);
  }

  function paneRects(layout, wall) {
    const aspect = ((wall.cols || 1) * (wall.cabinetWmm || 500)) / ((wall.rows || 1) * (wall.cabinetHmm || 500));
    if (layout === 'split') {
      return [
        { pane: 'left', l: 0, t: 0, w: 50, h: 100 },
        { pane: 'right', l: 50, t: 0, w: 50, h: 100 }
      ];
    }
    if (layout === 'quad') {
      return [
        { pane: 'tl', l: 0, t: 0, w: 50, h: 50 },
        { pane: 'tr', l: 50, t: 0, w: 50, h: 50 },
        { pane: 'bl', l: 0, t: 50, w: 50, h: 50 },
        { pane: 'br', l: 50, t: 50, w: 50, h: 50 }
      ];
    }
    if (layout === 'five') {
      return [
        { pane: 'main', l: 0, t: 0, w: 57, h: 100 },
        { pane: 'p1', l: 58, t: 0, w: 42, h: 24 },
        { pane: 'p2', l: 58, t: 25.33, w: 42, h: 24 },
        { pane: 'p3', l: 58, t: 50.66, w: 42, h: 24 },
        { pane: 'p4', l: 58, t: 76, w: 42, h: 24 }
      ];
    }
    if (layout === 'cinema235' || layout === 'wide32x9') {
      const ratio = layout === 'cinema235' ? 2.35 : (32 / 9);
      const h = Math.min(100, (aspect / ratio) * 100);
      return [{ pane: layout === 'cinema235' ? 'cinema' : 'wide', l: 0, t: (100 - h) / 2, w: 100, h: h }];
    }
    return [{ pane: 'full', l: 0, t: 0, w: 100, h: 100 }];
  }

  function syncSelectedPane(wall) {
    const preset = activePreset(wall);
    const ids = ((preset && preset.panes) || []).map(function (p) { return p.pane; });
    if (!ids.length) {
      selectedPane = '';
      return;
    }
    if (ids.indexOf(selectedPane) < 0) selectedPane = ids[0];
  }

  function fmtRes(wall) {
    if (!wall) return '—';
    return Number(wall.pixelW).toLocaleString() + ' × ' + Number(wall.pixelH).toLocaleString();
  }

  function fmtSize(wall) {
    if (!wall) return '—';
    const wM = (wall.cols * (wall.cabinetWmm || 500)) / 1000;
    const hM = (wall.rows * (wall.cabinetHmm || 500)) / 1000;
    function ft(m) {
      const total = m * 3.28084;
      const feet = Math.floor(total);
      const inch = Math.round((total - feet) * 12);
      return feet + "'" + inch + '"';
    }
    return ft(wM) + ' × ' + ft(hM);
  }

  function isLive(wall) {
    return !!(wall && (wall.online || wall.testing));
  }

  function showGuest() {
    current = null;
    selectedPane = '';
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if ($('wall-guest')) $('wall-guest').classList.remove('hidden');
    if ($('wall-empty')) $('wall-empty').classList.add('hidden');
    if ($('wall-controls')) $('wall-controls').classList.add('hidden');
    if ($('wall-form-wrap')) $('wall-form-wrap').classList.add('hidden');
    renderPreview(null);
    if ($('wall-status-overlay')) {
      $('wall-status-overlay').classList.remove('hidden');
      $('wall-status-overlay').querySelector('span').textContent = 'Sign in to run this wall.';
    }
  }

  function hideGuest() {
    if ($('wall-guest')) $('wall-guest').classList.add('hidden');
  }

  function setMsg(text, isErr) {
    const el = $('wall-msg');
    if (!el) return;
    if (!text) {
      el.classList.add('hidden');
      el.textContent = '';
      return;
    }
    el.textContent = text;
    el.classList.toggle('text-red-400', !!isErr);
    el.classList.toggle('text-sky-400', !isErr);
    el.classList.remove('hidden');
  }

  function fillSelect(sel, items, value, labelFn, valueFn) {
    if (!sel) return;
    const vFn = valueFn || function (item) { return item.id; };
    const lFn = labelFn || function (item) { return item.name; };
    sel.innerHTML = (items || []).map(function (item) {
      const val = vFn(item);
      return '<option value="' + escapeHtml(val) + '"' + (val === value ? ' selected' : '') + '>' + escapeHtml(lFn(item)) + '</option>';
    }).join('');
  }

  function renderPanes(wall) {
    const wrap = $('wall-panes');
    if (!wrap) return;
    if (!wall) {
      wrap.innerHTML = '';
      return;
    }
    const preset = activePreset(wall);
    const rects = paneRects(preset && preset.layout, wall);
    wrap.innerHTML = rects.map(function (rect) {
      const src = paneSource(wall, rect.pane);
      const label = (src && src.name) || paneLabel(rect.pane);
      const selected = rect.pane === selectedPane;
      const audio = !!(wall.audioEnabled && wall.audioPane === rect.pane);
      return '<button type="button" class="wall-pane' + (selected ? ' is-selected' : '') + '" data-pane="' +
        escapeHtml(rect.pane) + '" style="left:' + rect.l + '%;top:' + rect.t + '%;width:' + rect.w + '%;height:' + rect.h + '%">' +
        '<span class="wall-pane-src">' + escapeHtml(label) + '</span>' +
        (audio ? '<span class="wall-pane-audio">AUDIO</span>' : '') +
        '</button>';
    }).join('');
    wrap.querySelectorAll('.wall-pane').forEach(function (btn) {
      btn.onclick = function () {
        selectedPane = btn.getAttribute('data-pane') || '';
        renderSelectedPane(current);
        renderPanes(current);
      };
    });
  }

  function renderPreview(wall) {
    const grid = $('wall-preview');
    const overlay = $('wall-status-overlay');
    const freeze = $('wall-freeze-badge');
    const offline = $('wall-offline-badge');
    if (!grid) return;
    if (!wall) {
      grid.innerHTML = '';
      renderPanes(null);
      if (offline) offline.classList.add('hidden');
      if (overlay) overlay.classList.remove('hidden');
      if (overlay) overlay.querySelector('span').textContent = $('wall-guest') && !$('wall-guest').classList.contains('hidden')
        ? 'Sign in to run this wall.'
        : 'Add a wall to get started.';
      return;
    }
    const cols = Math.max(1, wall.cols || 1);
    const rows = Math.max(1, wall.rows || 1);
    grid.style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0, 1fr))';
    grid.style.aspectRatio = (cols * (wall.cabinetWmm || 500)) + ' / ' + (rows * (wall.cabinetHmm || 500));
    grid.classList.toggle('labels-off', !showA1);
    grid.classList.toggle('is-black', wall.displayMode === 'black');
    grid.classList.toggle('is-freeze', wall.displayMode === 'freeze');
    const live = isLive(wall);
    const bright = Math.max(0.28, Math.min(1, (Number(wall.brightness) || 80) / 100));
    grid.style.filter = (live && wall.displayMode === 'on') ? 'brightness(' + bright + ')' : '';
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let html = '';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const label = (letters[r] || (r + 1)) + (c + 1);
        html += '<div class="cabinet"><span class="cabinet-label">' + label + '</span></div>';
      }
    }
    grid.innerHTML = html;
    renderPanes(wall);
    if (freeze) freeze.classList.toggle('hidden', wall.displayMode !== 'freeze');
    const testBadge = $('wall-test-badge');
    if (testBadge) testBadge.classList.toggle('hidden', !wall.testing);
    if (offline) offline.classList.toggle('hidden', live);
    if (overlay) overlay.classList.add('hidden');
    $('preview-size').textContent = fmtSize(wall);
    $('preview-resolution').textContent = fmtRes(wall);
    $('preview-grid').textContent = cols + '×' + rows;
    $('dim-width').textContent = fmtSize(wall).split(' × ')[0];
    $('dim-height').textContent = fmtSize(wall).split(' × ')[1];
  }

  function renderSelectedPane(wall) {
    const nameEl = $('selected-pane-name');
    const sel = $('source-select');
    const audioWrap = $('audio-wrap');
    if (!nameEl || !sel) return;
    if (!wall) {
      nameEl.textContent = '—';
      sel.innerHTML = '';
      if (audioWrap) audioWrap.classList.add('hidden');
      return;
    }
    syncSelectedPane(wall);
    nameEl.textContent = paneLabel(selectedPane);
    const cur = paneSource(wall, selectedPane);
    fillSelect(sel, wall.inputs || [], cur ? cur.id : '', function (input) { return input.name; });
    const hasAudio = !!(wall.audioEnabled || (wall.capabilities && wall.capabilities.audio));
    if (audioWrap) audioWrap.classList.toggle('hidden', !hasAudio);
    const off = $('audio-off');
    const on = $('audio-this');
    const thisOn = hasAudio && wall.audioPane === selectedPane;
    if (off) {
      off.classList.toggle('is-on', hasAudio && !wall.audioPane);
      off.classList.toggle('border-sky-500', hasAudio && !wall.audioPane);
      off.classList.toggle('bg-sky-500/20', hasAudio && !wall.audioPane);
      off.classList.toggle('text-sky-300', hasAudio && !wall.audioPane);
    }
    if (on) {
      on.classList.toggle('is-on', thisOn);
      on.classList.toggle('border-sky-500', thisOn);
      on.classList.toggle('bg-sky-500/20', thisOn);
      on.classList.toggle('text-sky-300', thisOn);
    }
  }

  function renderSave(wall) {
    const btn = $('save-layout-btn');
    const note = $('save-layout-note');
    if (!btn) return;
    const ok = canSave(wall);
    btn.disabled = !ok;
    if (note) {
      note.classList.toggle('hidden', ok);
      note.textContent = ok ? '' : 'This processor recalls templates only. Save is for H2 / H5.';
    }
  }

  function renderControls(wall) {
    hideGuest();
    const empty = $('wall-empty');
    const controls = $('wall-controls');
    if (!wall) {
      empty.classList.remove('hidden');
      controls.classList.add('hidden');
      renderPreview(null);
      return;
    }
    empty.classList.add('hidden');
    controls.classList.remove('hidden');
    $('wall-name').textContent = wall.name || 'Wall';
    $('wall-model').textContent = (wall.model ? wall.model + ' · ' : '') + wall.processor;
    $('wall-online').classList.toggle('is-on', isLive(wall));
    $('wall-online-label').textContent = wall.testing ? 'Online · testing' : (wall.online ? 'Online' : 'Offline');
    const testBtn = $('test-mode-btn');
    if (testBtn) {
      testBtn.classList.toggle('is-on', !!wall.testing);
      testBtn.textContent = wall.testing ? 'Testing mode on' : 'Testing mode';
    }
    $('wall-res').textContent = fmtRes(wall);
    $('wall-count').textContent = wall.cols + '×' + wall.rows;
    $('wall-pitch').textContent = wall.pitch + ' mm';
    fillSelect($('layout-select'), wall.presets, wall.activePresetId);
    $('bright-slider').value = String(wall.brightness);
    $('bright-value').textContent = wall.brightness + '%';
    document.querySelectorAll('.display-btn').forEach(function (btn) {
      const on = btn.getAttribute('data-display') === wall.displayMode;
      btn.classList.toggle('border-sky-500', on);
      btn.classList.toggle('bg-sky-500/20', on);
      btn.classList.toggle('text-sky-300', on);
      btn.classList.toggle('border-slate-700', !on);
      btn.classList.toggle('text-slate-400', !on);
    });
    syncSelectedPane(wall);
    renderSelectedPane(wall);
    renderSave(wall);
    renderPreview(wall);
    fillSelect($('wall-picker'), walls, wall.id, function (w) { return w.name; });
    $('wall-picker-wrap').classList.toggle('hidden', walls.length < 2);
  }

  function formInputs() {
    return Array.prototype.slice.call(document.querySelectorAll('#input-rows .input-name')).map(function (el, i) {
      return { name: el.value.trim() || ('Input ' + (i + 1)), connector: '' };
    }).filter(function (row) { return row.name; });
  }

  function addInputRow(name) {
    const wrap = $('input-rows');
    const row = document.createElement('div');
    row.className = 'flex gap-2';
    row.innerHTML = '<input class="input-name flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="HDMI 1" value="' + escapeHtml(name || '') + '" />' +
      '<button type="button" class="remove-input px-2 text-slate-500 hover:text-red-400">×</button>';
    row.querySelector('.remove-input').onclick = function () {
      if (wrap.children.length > 1) row.remove();
    };
    wrap.appendChild(row);
  }

  function renderTemplateRows(wall) {
    const wrap = $('template-rows');
    if (!wrap) return;
    const existing = (wall && wall.presets) || [];
    wrap.innerHTML = templates.map(function (tmpl, i) {
      const hit = existing.find(function (p) { return p.layout === tmpl.layout; });
      const on = wall ? !!hit : (tmpl.layout === 'full' || tmpl.layout === 'split');
      const slot = hit ? hit.novastarIndex : i;
      return '<label class="template-row text-sm text-slate-300">' +
        '<input type="checkbox" class="template-on rounded border-slate-600 bg-slate-800" data-layout="' + escapeHtml(tmpl.layout) + '"' + (on ? ' checked' : '') + ' />' +
        '<span class="flex-1">' + escapeHtml(tmpl.name) + '</span>' +
        '<input type="number" min="0" max="128" class="template-slot bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs" data-layout="' + escapeHtml(tmpl.layout) + '" value="' + slot + '" />' +
        '</label>';
    }).join('');
  }

  function formPresets(wall) {
    const rows = Array.prototype.slice.call(document.querySelectorAll('#template-rows .template-on'));
    const picked = [];
    rows.forEach(function (box) {
      if (!box.checked) return;
      const layout = box.getAttribute('data-layout');
      const tmpl = templates.find(function (t) { return t.layout === layout; });
      if (!tmpl) return;
      const slotEl = document.querySelector('#template-rows .template-slot[data-layout="' + layout + '"]');
      const prev = ((wall && wall.presets) || []).find(function (p) { return p.layout === layout; });
      picked.push({
        id: prev && prev.id,
        name: tmpl.name,
        layout: layout,
        novastarIndex: slotEl ? Number(slotEl.value) : picked.length,
        panes: prev && prev.panes
      });
    });
    return picked;
  }

  function openForm(wall) {
    $('wall-form-wrap').classList.remove('hidden');
    $('form-title').textContent = wall ? 'Edit wall' : 'Add wall';
    $('form-name').value = wall ? wall.name : 'Main Wall';
    fillSelect($('form-processor'), processors.map(function (p) { return { id: p, name: p }; }), wall ? wall.processor : 'MX20');
    $('form-model').value = wall ? wall.model : '';
    $('form-pitch').value = wall ? wall.pitch : 1.2;
    $('form-cols').value = wall ? wall.cols : 10;
    $('form-rows').value = wall ? wall.rows : 6;
    if ($('form-audio')) $('form-audio').checked = !!(wall && wall.audioEnabled);
    renderTemplateRows(wall);
    $('input-rows').innerHTML = '';
    (wall && wall.inputs && wall.inputs.length ? wall.inputs : [{ name: 'HDMI 1' }, { name: 'HDMI 2' }, { name: 'DP 1' }]).forEach(function (input) {
      addInputRow(input.name);
    });
    $('bridge-token-box').classList.add('hidden');
    $('form-delete').classList.toggle('hidden', !wall);
    $('wall-form').dataset.id = wall ? wall.id : '';
  }

  function closeForm() {
    $('wall-form-wrap').classList.add('hidden');
  }

  async function sendCommand(body) {
    if (!current) return;
    try {
      const data = await api('/api/walls/' + current.id + '/command', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      current = data.wall;
      walls = walls.map(function (w) { return w.id === current.id ? current : w; });
      renderControls(current);
      if (body.type === 'save_layout') {
        setMsg(isLive(current) ? 'Layout saved to the NovaStar slot.' : 'Saved. Wall offline — the rack bridge will write the slot when it reconnects.', false);
        return;
      }
      setMsg(isLive(current) ? (current.testing ? 'Testing mode — not a live rack bridge.' : '') : 'Saved. Wall offline — the rack bridge will pick this up when it reconnects.', false);
    } catch (err) {
      setMsg(err.message, true);
    }
  }

  async function loadWalls(preferId) {
    const data = await api('/api/walls');
    walls = data.walls || [];
    processors = data.processors || [];
    if (data.templates && data.templates.length) templates = data.templates;
    const id = preferId || (current && current.id) || (new URLSearchParams(location.search).get('id') || '');
    current = walls.find(function (w) { return w.id === id; }) || walls[0] || null;
    renderControls(current);
  }

  function bind() {
    $('layout-select').onchange = function () {
      sendCommand({ type: 'recall_preset', presetId: $('layout-select').value });
    };
    document.querySelectorAll('.display-btn').forEach(function (btn) {
      btn.onclick = function () {
        sendCommand({ type: 'set_display', display: btn.getAttribute('data-display') });
      };
    });
    if ($('source-select')) {
      $('source-select').onchange = function () {
        if (!selectedPane) return;
        sendCommand({ type: 'set_source', pane: selectedPane, inputId: $('source-select').value });
      };
    }
    if ($('audio-off')) {
      $('audio-off').onclick = function () {
        sendCommand({ type: 'set_audio', pane: '' });
      };
    }
    if ($('audio-this')) {
      $('audio-this').onclick = function () {
        sendCommand({ type: 'set_audio', pane: selectedPane });
      };
    }
    if ($('save-layout-btn')) {
      $('save-layout-btn').onclick = function () {
        if (!current || !canSave(current)) return;
        sendCommand({ type: 'save_layout', presetId: current.activePresetId });
      };
    }
    let brightTimer = null;
    $('bright-slider').oninput = function () {
      $('bright-value').textContent = $('bright-slider').value + '%';
      clearTimeout(brightTimer);
      brightTimer = setTimeout(function () {
        sendCommand({ type: 'set_brightness', brightness: Number($('bright-slider').value) });
      }, 180);
    };
    $('add-wall-link').onclick = function (e) {
      e.preventDefault();
      openForm(null);
    };
    $('edit-wall-link').onclick = function (e) {
      e.preventDefault();
      openForm(current);
    };
    $('form-cancel').onclick = function () { closeForm(); };
    $('add-input-btn').onclick = function () { addInputRow(''); };
    $('label-off').onclick = function () {
      showA1 = false;
      $('label-off').className = 'px-2.5 py-1 rounded-full border border-sky-500 bg-sky-500/20 text-sky-300 text-xs';
      $('label-a1').className = 'px-2.5 py-1 rounded-full border border-slate-700 text-slate-400 hover:text-white hover:border-sky-500 text-xs';
      renderPreview(current);
    };
    $('label-a1').onclick = function () {
      showA1 = true;
      $('label-a1').className = 'px-2.5 py-1 rounded-full border border-sky-500 bg-sky-500/20 text-sky-300 text-xs';
      $('label-off').className = 'px-2.5 py-1 rounded-full border border-slate-700 text-slate-400 hover:text-white hover:border-sky-500 text-xs';
      renderPreview(current);
    };
    $('wall-picker').onchange = function () {
      current = walls.find(function (w) { return w.id === $('wall-picker').value; }) || current;
      selectedPane = '';
      renderControls(current);
    };
    if ($('test-mode-btn')) {
      $('test-mode-btn').onclick = async function () {
        if (!current) return;
        try {
          const data = await api('/api/walls/' + current.id + '/testing', {
            method: 'POST',
            body: JSON.stringify({ enabled: !current.testing })
          });
          current = data.wall;
          walls = walls.map(function (w) { return w.id === current.id ? current : w; });
          renderControls(current);
          setMsg(current.testing ? 'Testing mode on — preview only, no rack bridge.' : 'Testing mode off.', false);
        } catch (err) {
          setMsg(err.message, true);
        }
      };
    }
    $('wall-form').onsubmit = async function (e) {
      e.preventDefault();
      const id = $('wall-form').dataset.id;
      const wall = id ? walls.find(function (w) { return w.id === id; }) : current;
      const payload = {
        name: $('form-name').value,
        processor: $('form-processor').value,
        model: $('form-model').value,
        pitch: Number($('form-pitch').value),
        cols: Number($('form-cols').value),
        rows: Number($('form-rows').value),
        audioEnabled: !!( $('form-audio') && $('form-audio').checked ),
        inputs: formInputs(),
        presets: formPresets(wall)
      };
      try {
        let data;
        if (id) data = await api('/api/walls/' + id, { method: 'PUT', body: JSON.stringify(payload) });
        else data = await api('/api/walls', { method: 'POST', body: JSON.stringify(payload) });
        if (data.bridgeToken) {
          lastToken = data.bridgeToken;
          $('bridge-token-value').value = data.bridgeToken;
          $('bridge-token-box').classList.remove('hidden');
        }
        await loadWalls(data.wall && data.wall.id);
        if (!data.bridgeToken) closeForm();
        setMsg(data.bridgeToken ? 'Copy the bridge token now. It is shown once.' : 'Wall saved.', false);
      } catch (err) {
        setMsg(err.message, true);
      }
    };
    $('form-delete').onclick = async function () {
      const id = $('wall-form').dataset.id;
      if (!id || !confirm('Remove this wall from the account?')) return;
      try {
        await api('/api/walls/' + id, { method: 'DELETE' });
        current = null;
        closeForm();
        await loadWalls();
      } catch (err) {
        setMsg(err.message, true);
      }
    };
    $('copy-token').onclick = async function () {
      const value = $('bridge-token-value').value;
      try {
        await navigator.clipboard.writeText(value);
        $('copy-token').textContent = 'Copied';
        setTimeout(function () { $('copy-token').textContent = 'Copy'; }, 1200);
      } catch (e) { /* ignore */ }
    };
    $('rotate-token').onclick = async function () {
      if (!current) return;
      if (!confirm('This disconnects the current rack bridge until you paste the new token.')) return;
      try {
        const data = await api('/api/walls/' + current.id + '/bridge-token', { method: 'POST', body: '{}' });
        $('bridge-token-value').value = data.bridgeToken;
        $('bridge-token-box').classList.remove('hidden');
        lastToken = data.bridgeToken;
        setMsg('New bridge token. Copy it now.', false);
      } catch (err) {
        setMsg(err.message, true);
      }
    };
  }

  async function boot() {
    bind();
    if (Auth && Auth.ready) await Auth.ready;
    if (!Auth || !Auth.isLoggedIn()) {
      showGuest();
      return;
    }
    hideGuest();
    try {
      await loadWalls();
    } catch (err) {
      setMsg(err.message, true);
    }
    pollTimer = setInterval(function () {
      if (!current) return;
      loadWalls(current.id).catch(function () { /* keep last state */ });
    }, 5000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
