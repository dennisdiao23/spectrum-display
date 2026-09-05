/**
 * Spectrum Display — signed-in Wall Remote. Talks to /api/walls*.
 */
(function () {
  const Auth = window.SpectrumAuth;
  let walls = [];
  let processors = [];
  let current = null;
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
      location.href = '/account.html?next=/wall';
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

  function renderPreview(wall) {
    const grid = $('wall-preview');
    const overlay = $('wall-status-overlay');
    const freeze = $('wall-freeze-badge');
    const split = $('wall-split-line');
    if (!grid) return;
    if (!wall) {
      grid.innerHTML = '';
      if (overlay) overlay.classList.remove('hidden');
      if (overlay) overlay.querySelector('span').textContent = 'Add a wall to get started.';
      return;
    }
    const cols = Math.max(1, wall.cols || 1);
    const rows = Math.max(1, wall.rows || 1);
    grid.style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0, 1fr))';
    grid.style.aspectRatio = (cols * (wall.cabinetWmm || 500)) + ' / ' + (rows * (wall.cabinetHmm || 500));
    grid.classList.toggle('labels-off', !showA1);
    grid.classList.toggle('is-black', wall.displayMode === 'black');
    grid.classList.toggle('is-freeze', wall.displayMode === 'freeze');
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let html = '';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const label = (letters[r] || (r + 1)) + (c + 1);
        html += '<div class="cabinet"><span class="cabinet-label">' + label + '</span></div>';
      }
    }
    grid.innerHTML = html;
    if (split) split.classList.toggle('hidden', !(activePreset(wall) && activePreset(wall).layout === 'split'));
    if (freeze) freeze.classList.toggle('hidden', wall.displayMode !== 'freeze');
    if (overlay) {
      overlay.classList.toggle('hidden', !!wall.online);
      overlay.querySelector('span').textContent = 'Wall offline.';
    }
    $('preview-size').textContent = fmtSize(wall);
    $('preview-resolution').textContent = fmtRes(wall);
    $('preview-grid').textContent = cols + '×' + rows;
    $('dim-width').textContent = fmtSize(wall).split(' × ')[0];
    $('dim-height').textContent = fmtSize(wall).split(' × ')[1];
  }

  function renderSources(wall) {
    const wrap = $('source-fields');
    if (!wrap) return;
    const preset = activePreset(wall);
    if (!wall || !preset) {
      wrap.innerHTML = '<p class="text-xs text-slate-500">Add a wall to choose sources.</p>';
      return;
    }
    const panes = preset.layout === 'split' ? ['left', 'right'] : ['full'];
    const labels = { full: 'Source', left: 'Left pane', right: 'Right pane' };
    wrap.innerHTML = panes.map(function (pane) {
      const cur = paneSource(wall, pane);
      const opts = (wall.inputs || []).map(function (input) {
        return '<option value="' + escapeHtml(input.id) + '"' + (cur && cur.id === input.id ? ' selected' : '') + '>' + escapeHtml(input.name) + '</option>';
      }).join('');
      return '<div><label class="block text-xs text-slate-400 mb-1">' + labels[pane] + '</label>' +
        '<select data-pane="' + pane + '" class="source-select w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500">' +
        opts + '</select></div>';
    }).join('');
    wrap.querySelectorAll('.source-select').forEach(function (sel) {
      sel.onchange = function () {
        sendCommand({ type: 'set_source', pane: sel.getAttribute('data-pane'), inputId: sel.value });
      };
    });
  }

  function renderControls(wall) {
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
    $('wall-online').classList.toggle('is-on', !!wall.online);
    $('wall-online-label').textContent = wall.online ? 'Online' : 'Offline';
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
    renderSources(wall);
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

  function openForm(wall) {
    $('wall-form-wrap').classList.remove('hidden');
    $('form-title').textContent = wall ? 'Edit wall' : 'Add wall';
    $('form-name').value = wall ? wall.name : 'Main Wall';
    fillSelect($('form-processor'), processors.map(function (p) { return { id: p, name: p }; }), wall ? wall.processor : 'MX20');
    $('form-model').value = wall ? wall.model : '';
    $('form-pitch').value = wall ? wall.pitch : 1.2;
    $('form-cols').value = wall ? wall.cols : 10;
    $('form-rows').value = wall ? wall.rows : 6;
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
      setMsg(current.online ? '' : 'Saved. Wall offline — the rack bridge will pick this up when it reconnects.', false);
    } catch (err) {
      setMsg(err.message, true);
    }
  }

  async function loadWalls(preferId) {
    const data = await api('/api/walls');
    walls = data.walls || [];
    processors = data.processors || [];
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
      renderControls(current);
    };
    $('wall-form').onsubmit = async function (e) {
      e.preventDefault();
      const id = $('wall-form').dataset.id;
      const payload = {
        name: $('form-name').value,
        processor: $('form-processor').value,
        model: $('form-model').value,
        pitch: Number($('form-pitch').value),
        cols: Number($('form-cols').value),
        rows: Number($('form-rows').value),
        inputs: formInputs()
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
      location.href = '/account.html?next=/wall';
      return;
    }
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
