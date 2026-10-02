/**
 * Product Finder: wall-first catalog ranking for the LED calculator.
 * Recommendations are catalog rows only — no invented series.
 */
(function (global) {
  var EXTRA_CATS = {
    discovery: 'cob fixed-indoor',
    ledposter: 'posters',
    mvultra: 'indoor-rental',
    dnin: 'indoor-rental',
    dn: 'outdoor-rental outdoor-fixed',
    vanish: 'transparent outdoor-rental',
    vamax: 'transparent outdoor-rental',
    cbmax: 'transparent outdoor-rental',
    crmax: 'outdoor-rental',
    af2: 'cob fixed-indoor',
    aw: 'cob fixed-indoor',
    blade: 'fixed-indoor',
    gposter: 'posters',
    gposterplus: 'posters',
    arpro: 'indoor-rental outdoor-rental',
    cfpro: 'indoor-rental creative',
    cfpro2: 'indoor-rental outdoor-rental creative',
    rbb: 'indoor-rental creative',
    ur: 'indoor-rental outdoor-rental',
    carbon: 'indoor-rental outdoor-rental',
    mvpro: 'indoor-rental creative',
    mt55: 'indoor-rental creative',
    mt2: 'creative',
    mtedge: 'creative',
    cs2: 'creative',
    mr: 'creative',
    ra2: 'fixed-indoor',
    zs3: 'outdoor-fixed',
    zspro: 'outdoor-fixed outdoor-rental',
    gp: 'outdoor-fixed',
    legend: 'outdoor-rental',
    finepitch: 'cob fixed-indoor',
    allinone: 'cob fixed-indoor',
    rentalcob: 'cob indoor-rental outdoor-rental',
    diamond4: 'indoor-rental outdoor-rental',
    flyingdrone: 'fixed-indoor cob',
    bakoposter: 'posters',
    spaceship: 'outdoor-fixed',
    sphere: 'creative',
    bks: 'outdoor-fixed',
    uhdpro: 'fixed-indoor',
    bakocarbon: 'indoor-rental',
    tpro: 'transparent indoor-rental outdoor-rental',
    indoor480: 'fixed-indoor',
    pro: 'fixed-indoor',
    value: 'outdoor-fixed',
    rental: 'indoor-rental',
    creative: 'creative'
  };

  var RES = {
    '1080': { w: 1920, h: 1080, label: '1080' },
    '2k': { w: 1920, h: 1080, label: '2K' },
    '4k': { w: 3840, h: 2160, label: '4K' },
    '8k': { w: 7680, h: 4320, label: '8K' }
  };

  var state = {
    env: 'indoor',
    install: 'installed',
    sharp: 'view',
    res: '4k',
    fill: 'fill',
    shrink: 100,
    front: false,
    sun: false,
    budget: 0,
    openingW: 4.877,
    openingH: 2.743,
    screenW: 4.877,
    screenH: 2.743,
    viewM: 3.658,
    selectedKey: '',
    results: [],
    cheaper: []
  };

  var hooks = {
    applyPick: null,
    switchToCalculator: null,
    fmtFtIn: function (m) { return (m * 3.28084).toFixed(1) + ' ft'; },
    ftInFromMeters: function (m) {
      var totalIn = m / 0.0254;
      var ft = Math.floor(totalIn / 12);
      var inch = Math.round(totalIn - ft * 12);
      if (inch === 12) { ft += 1; inch = 0; }
      return { ft: ft, inch: inch };
    },
    metersFromFtIn: function (ft, inch) {
      return (parseFloat(ft) || 0) * 0.3048 + (parseFloat(inch) || 0) * 0.0254;
    },
    getUnit: function () { return 'ft'; },
    cabinetPixels: function (series, pitch) {
      var wmm = (series.cabinetW || 0) * 1000;
      var hmm = (series.cabinetH || 0) * 1000;
      var p = Math.max(Number(pitch) || 0.1, 0.01);
      return { w: Math.max(1, Math.round(wmm / p)), h: Math.max(1, Math.round(hmm / p)) };
    }
  };

  var rankTimer = 0;
  var drag = null;

  function shrinkK() {
    return Math.max(0.2, Math.min(1, (Number(state.shrink) || 100) / 100));
  }

  function clampedScreen() {
    return {
      w: Math.min(state.openingW, Math.max(0.3, state.screenW || state.openingW)),
      h: Math.min(state.openingH, Math.max(0.3, state.screenH || state.openingH))
    };
  }

  function targetScreen() {
    var k = shrinkK();
    if (state.fill === 'custom') {
      var s = clampedScreen();
      return { w: s.w * k, h: s.h * k };
    }
    return { w: state.openingW * k, h: state.openingH * k };
  }

  function paintFillUi() {
    paintChipGroup(document.getElementById('finder-fill'), 'data-fill', state.fill);
    var box = document.getElementById('finder-custom-box');
    if (box) box.classList.remove('hidden');
    var val = document.getElementById('finder-shrink-val');
    if (val) val.textContent = Math.round(state.shrink) + '%';
    var slider = document.getElementById('finder-shrink');
    if (slider && String(slider.value) !== String(state.shrink)) slider.value = String(state.shrink);
  }

  function ensureCustomFromOpening() {
    if (state.fill === 'custom') return;
    state.fill = 'custom';
    state.screenW = state.openingW;
    state.screenH = state.openingH;
    paintFillUi();
    syncScreenFields();
  }

  function blobOf(s) {
    return [s.type, s.name, s.description, s.badge, s.lead, (s.cats || []).join(' ')].join(' ').toLowerCase();
  }

  function catsOf(s) {
    var set = {};
    function add(c) {
      String(c || '').split(/\s+/).forEach(function (x) {
        if (x) set[x.toLowerCase()] = true;
      });
    }
    if (s.cats) {
      if (Array.isArray(s.cats)) s.cats.forEach(add);
      else add(s.cats);
    }
    if (EXTRA_CATS[s.id]) add(EXTRA_CATS[s.id]);
    var t = String(s.type || '').toLowerCase();
    var b = blobOf(s);
    if (t === 'outdoor' || /\boutdoor\b/.test(b)) {
      if (t === 'rental' || /\brental\b/.test(b)) add('outdoor-rental');
      else add('outdoor-fixed');
    }
    if (t === 'rental' || /\brental\b/.test(b)) {
      if (!set['outdoor-rental']) add('indoor-rental');
    }
    if (t === 'fixed' || t === 'cob') add('fixed-indoor');
    return Object.keys(set);
  }

  function catStr(s) {
    return catsOf(s).join(' ');
  }

  function eligible(s) {
    if (!s || s.type === 'control' || (s.subtype && s.type === 'control')) return false;
    var t = String(s.type || '').toLowerCase();
    if (t === 'control' || t === 'poster' || t === 'all-in-one' || t === 'all-in-one') return false;
    if (/\bposters\b/.test(catStr(s))) return false;
    if (!(s.pitches && s.pitches.length) || !s.cabinetW || !s.cabinetH) return false;
    return true;
  }

  function matchesEnv(s) {
    var c = catStr(s);
    var t = String(s.type || '').toLowerCase();
    var outdoor = t === 'outdoor' || /\boutdoor/.test(c) || /\boutdoor\b/.test(blobOf(s));
    var indoor = /\bindoor|fixed-indoor|cob/.test(c) || t === 'fixed' || t === 'rental' || t === 'creative';
    if (state.env === 'outdoor') return outdoor || /\boutdoor/.test(blobOf(s));
    if (outdoor && !indoor && t === 'outdoor') return false;
    if (outdoor && !/\bindoor/.test(c + ' ' + blobOf(s)) && !/\brental|fixed|creative/.test(t)) return false;
    return true;
  }

  function matchesInstall(s) {
    var rental = /\brental/.test(catStr(s) + ' ' + blobOf(s)) || String(s.type).toLowerCase() === 'rental';
    if (state.install === 'rental') return rental;
    return !rental || /\bfixed/.test(catStr(s));
  }

  function pricePerM2(s, pitch) {
    var map = s.pitchInventory || {};
    var key = String(pitch);
    return (map[key] && (Number(map[key].price) || 0)) || 0;
  }

  function applyPrice(n) {
    if (global.SpectrumPricing && SpectrumPricing.apply) return SpectrumPricing.apply(n);
    return Math.round(Number(n) || 0);
  }

  function catalogList() {
    var products = global.SPECTRUM_PRODUCTS || {};
    var out = [];
    Object.keys(products).forEach(function (brandId) {
      var brand = products[brandId];
      if (!brand || brand.kind === 'control' || brandId === 'novastar') return;
      (brand.series || []).forEach(function (s) {
        if (!eligible(s)) return;
        out.push(Object.assign({}, s, {
          brandId: brandId,
          brandName: brand.name || brandId
        }));
      });
    });
    return out;
  }

  function fitGrid(s, openingW, openingH) {
    var cols = Math.max(1, Math.floor((openingW + 0.0001) / s.cabinetW));
    var rows = Math.max(1, Math.floor((openingH + 0.0001) / s.cabinetH));
    cols = Math.min(100, cols);
    rows = Math.min(100, rows);
    return {
      cols: cols,
      rows: rows,
      w: cols * s.cabinetW,
      h: rows * s.cabinetH
    };
  }

  function pickPitch(s, grid) {
    var pitches = (s.pitches || []).slice().map(Number).filter(function (p) {
      return p > 0 && pricePerM2(s, p) > 0;
    });
    pitches.sort(function (a, b) { return a - b; });
    if (!pitches.length) return null;
    var chosen = pitches[0];
    var reason = '';

    if (state.sharp === 'res') {
      var spec = RES[state.res] || RES['4k'];
      var ok = pitches.filter(function (p) {
        var cab = hooks.cabinetPixels(s, p);
        return grid.cols * cab.w >= spec.w && grid.rows * cab.h >= spec.h;
      });
      if (ok.length) {
        chosen = ok[ok.length - 1];
        reason = 'Hits ' + spec.label + ' in this opening.';
      } else {
        chosen = pitches[0];
        reason = 'Finest pitch still short of ' + spec.label + ' on this wall.';
      }
    } else {
      var d = state.viewM;
      var comfortable = pitches.filter(function (p) { return p <= d / 2; });
      var minOk = pitches.filter(function (p) { return p <= d; });
      if (comfortable.length) {
        chosen = comfortable[comfortable.length - 1];
        reason = 'Coarsest pitch that still looks sharp at ' + hooks.fmtFtIn(d) + '.';
      } else if (minOk.length) {
        chosen = minOk[minOk.length - 1];
        reason = 'Usable at ' + hooks.fmtFtIn(d) + ' (minimum viewing).';
      } else {
        chosen = pitches[0];
        reason = 'Closest viewers are nearer than this pitch prefers.';
      }
    }
    return { pitch: chosen, reason: reason };
  }

  function scoreCandidate(s, grid, pitchInfo) {
    var area = grid.w * grid.h;
    var unit = pricePerM2(s, pitchInfo.pitch);
    var cost = unit > 0 ? applyPrice(unit * area) : 0;
    var box = targetScreen();
    var unused = Math.max(0, box.w - grid.w) * box.h +
      grid.w * Math.max(0, box.h - grid.h);
    var fillFrac = area / Math.max(0.01, box.w * box.h);
    var cab = hooks.cabinetPixels(s, pitchInfo.pitch);
    var pxW = grid.cols * cab.w;
    var pxH = grid.rows * cab.h;
    var targetPitch = state.sharp === 'view' ? (state.viewM / 2.5) : pitchInfo.pitch;
    var pitchErr = Math.abs(pitchInfo.pitch - targetPitch);
    var boost = 0;
    var b = blobOf(s);
    if (state.front && /front service/.test(b)) boost += 8;
    if (state.sun && (/\bbright|nit|outdoor|sun/.test(b) || /\boutdoor/.test(catStr(s)))) boost += 8;
    if (state.budget > 0 && cost > 0 && cost > state.budget) boost -= 40;
    return {
      key: s.brandId + ':' + s.id + ':' + pitchInfo.pitch,
      brandId: s.brandId,
      brandName: s.brandName,
      seriesId: s.id,
      name: s.name,
      type: s.type || '',
      pitch: pitchInfo.pitch,
      cols: grid.cols,
      rows: grid.rows,
      w: grid.w,
      h: grid.h,
      pxW: pxW,
      pxH: pxH,
      panels: grid.cols * grid.rows,
      cost: cost,
      fillFrac: fillFrac,
      unused: unused,
      pitchErr: pitchErr,
      reason: pitchInfo.reason,
      overBudget: state.budget > 0 && cost > 0 && cost > state.budget,
      scoreValue: (cost > 0 ? cost : 9e9) - boost * 100,
      scoreFit: pitchErr * 20 + unused * 40 + (1 - fillFrac) * 10 - boost,
      scoreFine: pitchInfo.pitch - boost
    };
  }

  function uniqueBySeries(list) {
    var seen = {};
    return list.filter(function (x) {
      if (seen[x.brandId + ':' + x.seriesId]) return false;
      seen[x.brandId + ':' + x.seriesId] = true;
      return true;
    });
  }

  function recommend() {
    var list = catalogList().filter(function (s) {
      return matchesEnv(s) && matchesInstall(s);
    });
    var scored = [];
    var box = targetScreen();
    list.forEach(function (s) {
      var grid = fitGrid(s, box.w, box.h);
      if (grid.cols < 1 || grid.rows < 1) return;
      if (grid.w > box.w + 0.02 || grid.h > box.h + 0.02) return;
      if (grid.w > state.openingW + 0.02 || grid.h > state.openingH + 0.02) return;
      var pitchInfo = pickPitch(s, grid);
      if (!pitchInfo) return;
      if (!(pricePerM2(s, pitchInfo.pitch) > 0)) return;
      scored.push(scoreCandidate(s, grid, pitchInfo));
    });

    var value = uniqueBySeries(scored.slice().sort(function (a, b) { return a.scoreValue - b.scoreValue; }));
    var fit = uniqueBySeries(scored.slice().sort(function (a, b) { return a.scoreFit - b.scoreFit; }));
    var fine = uniqueBySeries(scored.slice().sort(function (a, b) { return a.scoreFine - b.scoreFine; }));

    var picks = [];
    function add(item, badge) {
      if (!item) return;
      if (picks.some(function (p) { return p.key === item.key; })) return;
      picks.push(Object.assign({}, item, { badge: badge }));
    }
    add(value[0], 'Best value');
    add(fit[0], 'Best fit');
    add(fine[0], 'Finest');
    if (picks.length < 3) {
      scored.sort(function (a, b) { return a.scoreFit - b.scoreFit; });
      scored.forEach(function (item) {
        if (picks.length >= 3) return;
        add(item, 'Also fits');
      });
    }
    state.results = picks;
    if (state.selectedKey && !picks.some(function (p) { return p.key === state.selectedKey; })) {
      state.selectedKey = '';
    }
    buildCheaper();
    return picks;
  }

  function selected() {
    return state.results.filter(function (p) { return p.key === state.selectedKey; })[0] || state.results[0] || null;
  }

  function buildCheaper() {
    var cur = selected();
    state.cheaper = [];
    if (!cur) return;
    var ideas = [];
    var box = targetScreen();
    catalogList().filter(function (s) {
      return matchesEnv(s) && matchesInstall(s);
    }).forEach(function (s) {
      var grid = fitGrid(s, box.w, box.h);
      (s.pitches || []).forEach(function (p) {
        p = Number(p);
        if (!(p > cur.pitch)) return;
        var info = { pitch: p, reason: 'Coarser pitch, still in this opening.' };
        var cand = scoreCandidate(s, grid, info);
        if (cur.cost > 0 && cand.cost > 0 && cand.cost < cur.cost * 0.98) ideas.push(cand);
      });
    });
    if (state.sharp === 'res' && state.res === '8k') {
      var prev = state.res;
      state.res = '4k';
      recommendLite(ideas, cur, 'Drop to 4K');
      state.res = prev;
    } else if (state.sharp === 'res' && (state.res === '4k' || state.res === '2k')) {
      var prevRes = state.res;
      state.res = state.res === '4k' ? '2k' : '1080';
      recommendLite(ideas, cur, 'Drop resolution');
      state.res = prevRes;
    }
    var shrinkW = state.openingW;
    var shrinkH = state.openingH;
    state.openingW = Math.max(0.5, state.openingW * 0.92);
    catalogList().filter(function (s) { return s.brandId === cur.brandId && s.id === cur.seriesId; }).forEach(function (s) {
      var grid = fitGrid(s, Math.min(box.w, state.openingW), state.openingH);
      var info = pickPitch(s, grid);
      if (!info) return;
      var cand = scoreCandidate(s, grid, info);
      cand.reason = 'Slightly smaller screen, fewer panels.';
      if (cur.cost > 0 && cand.cost > 0 && cand.cost < cur.cost) ideas.push(cand);
    });
    state.openingW = shrinkW;
    state.openingH = shrinkH;

    ideas.sort(function (a, b) { return a.cost - b.cost; });
    var seen = {};
    state.cheaper = ideas.filter(function (x) {
      if (x.key === cur.key) return false;
      if (seen[x.key]) return false;
      seen[x.key] = true;
      return true;
    }).slice(0, 3);
  }

  function recommendLite(ideas, cur, reason) {
    catalogList().filter(function (s) {
      return matchesEnv(s) && matchesInstall(s);
    }).forEach(function (s) {
      var t = targetScreen();
      var grid = fitGrid(s, t.w, t.h);
      var info = pickPitch(s, grid);
      if (!info) return;
      var cand = scoreCandidate(s, grid, info);
      cand.reason = reason;
      if (cur.cost > 0 && cand.cost > 0 && cand.cost < cur.cost) ideas.push(cand);
    });
  }

  function canSeePrices() {
    if (document.documentElement.classList.contains('designer-embed')) return true;
    return !!(global.SpectrumAuth && SpectrumAuth.isLoggedIn && SpectrumAuth.isLoggedIn());
  }

  function money(n) {
    if (global.SpectrumPricing && SpectrumPricing.money) return SpectrumPricing.money(n);
    return n ? ('$' + Math.round(n).toLocaleString()) : 'Request quote';
  }

  function sizeLabel(mW, mH) {
    if (hooks.getUnit() === 'm') {
      return mW.toFixed(2) + ' × ' + mH.toFixed(2) + ' m';
    }
    return hooks.fmtFtIn(mW) + ' × ' + hooks.fmtFtIn(mH);
  }

  function cardTitle(item) {
    var n = String(item.name || '');
    var b = String(item.brandName || '');
    var title = n;
    if (b && n.toLowerCase().indexOf(b.toLowerCase()) !== 0) title = b + ' ' + n;
    return title + ' · P' + item.pitch;
  }

  function whyText(item) {
    var bits = [];
    bits.push(item.reason || '');
    bits.push(item.cols + '×' + item.rows + ' panels · ' + item.pxW.toLocaleString() + ' × ' + item.pxH.toLocaleString() + ' px.');
    if (item.w < state.openingW * 0.92 || item.h < state.openingH * 0.92) {
      bits.push('Screen is ' + sizeLabel(item.w, item.h) + ' inside a ' + sizeLabel(state.openingW, state.openingH) + ' wall.');
    }
    if (item.overBudget) bits.push('Over the budget you entered.');
    return bits.filter(Boolean).join(' ');
  }

  function paintChipGroup(root, attr, value) {
    if (!root) return;
    root.querySelectorAll('[' + attr + ']').forEach(function (btn) {
      var on = btn.getAttribute(attr) === value;
      btn.classList.toggle('is-on', on);
      btn.classList.toggle('bg-sky-500/20', on);
      btn.classList.toggle('text-sky-300', on);
      btn.classList.toggle('border-sky-500', on);
      btn.classList.toggle('border-slate-700', !on);
      btn.classList.toggle('text-slate-400', !on);
    });
  }

  function paintToggle(btn, on) {
    if (!btn) return;
    btn.classList.toggle('is-on', on);
    btn.classList.toggle('bg-sky-500/20', on);
    btn.classList.toggle('text-sky-300', on);
    btn.classList.toggle('border-sky-500', on);
    btn.classList.toggle('border-slate-700', !on);
    btn.classList.toggle('text-slate-400', !on);
  }

  function syncUnitFields() {
    var unit = hooks.getUnit();
    var mBox = document.getElementById('finder-size-m');
    var ftBox = document.getElementById('finder-size-ft');
    if (mBox) mBox.classList.toggle('hidden', unit !== 'm');
    if (ftBox) ftBox.classList.toggle('hidden', unit !== 'ft');
    var viewM = document.getElementById('finder-view-m-wrap');
    var viewFt = document.getElementById('finder-view-ft-wrap');
    if (viewM) viewM.classList.toggle('hidden', unit !== 'm');
    if (viewFt) viewFt.classList.toggle('hidden', unit !== 'ft');
    var wM = document.getElementById('finder-w');
    var hM = document.getElementById('finder-h');
    if (wM) wM.value = state.openingW.toFixed(2);
    if (hM) hM.value = state.openingH.toFixed(2);
    var W = hooks.ftInFromMeters(state.openingW);
    var H = hooks.ftInFromMeters(state.openingH);
    setVal('finder-w-ft', W.ft);
    setVal('finder-w-in', W.inch);
    setVal('finder-h-ft', H.ft);
    setVal('finder-h-in', H.inch);
    var hint = document.getElementById('finder-ft-hint');
    if (hint) hint.textContent = '≈ ' + state.openingW.toFixed(2) + ' m × ' + state.openingH.toFixed(2) + ' m';
    var vFt = hooks.ftInFromMeters(state.viewM);
    setVal('finder-view-m', state.viewM.toFixed(1));
    setVal('finder-view-ft', vFt.ft);
    setVal('finder-view-in', vFt.inch);
    var slider = document.getElementById('finder-view-slider');
    if (slider) slider.value = String(Math.round(state.viewM * 10) / 10);
    syncScreenFields();
    paintFillUi();
  }

  function syncScreenFields() {
    var unit = hooks.getUnit();
    var mBox = document.getElementById('finder-screen-m');
    var ftBox = document.getElementById('finder-screen-ft');
    if (mBox) mBox.classList.toggle('hidden', unit !== 'm');
    if (ftBox) ftBox.classList.toggle('hidden', unit !== 'ft');
    if (state.fill === 'fill') {
      state.screenW = state.openingW;
      state.screenH = state.openingH;
    } else {
      var s = clampedScreen();
      state.screenW = s.w;
      state.screenH = s.h;
    }
    var t = targetScreen();
    var wM = document.getElementById('finder-sw');
    var hM = document.getElementById('finder-sh');
    if (wM) wM.value = t.w.toFixed(2);
    if (hM) hM.value = t.h.toFixed(2);
    var W = hooks.ftInFromMeters(t.w);
    var H = hooks.ftInFromMeters(t.h);
    setVal('finder-sw-ft', W.ft);
    setVal('finder-sw-in', W.inch);
    setVal('finder-sh-ft', H.ft);
    setVal('finder-sh-in', H.inch);
    var hint = document.getElementById('finder-screen-hint');
    if (hint) hint.textContent = '≈ ' + t.w.toFixed(2) + ' m × ' + t.h.toFixed(2) + ' m';
  }

  function setVal(id, v) {
    var el = document.getElementById(id);
    if (el && String(el.value) !== String(v)) el.value = v;
  }

  function readOpeningFromDom() {
    var unit = hooks.getUnit();
    if (unit === 'm') {
      state.openingW = Math.max(0.5, parseFloat(document.getElementById('finder-w').value) || state.openingW);
      state.openingH = Math.max(0.5, parseFloat(document.getElementById('finder-h').value) || state.openingH);
    } else {
      state.openingW = Math.max(0.5, hooks.metersFromFtIn(
        document.getElementById('finder-w-ft').value,
        document.getElementById('finder-w-in').value
      ));
      state.openingH = Math.max(0.5, hooks.metersFromFtIn(
        document.getElementById('finder-h-ft').value,
        document.getElementById('finder-h-in').value
      ));
    }
    if (state.fill === 'fill') {
      state.screenW = state.openingW;
      state.screenH = state.openingH;
    } else {
      state.screenW = Math.min(state.screenW, state.openingW);
      state.screenH = Math.min(state.screenH, state.openingH);
    }
  }

  function readScreenFromDom() {
    var unit = hooks.getUnit();
    if (unit === 'm') {
      state.screenW = Math.max(0.3, parseFloat(document.getElementById('finder-sw').value) || state.screenW);
      state.screenH = Math.max(0.3, parseFloat(document.getElementById('finder-sh').value) || state.screenH);
    } else {
      state.screenW = Math.max(0.3, hooks.metersFromFtIn(
        document.getElementById('finder-sw-ft').value,
        document.getElementById('finder-sw-in').value
      ));
      state.screenH = Math.max(0.3, hooks.metersFromFtIn(
        document.getElementById('finder-sh-ft').value,
        document.getElementById('finder-sh-in').value
      ));
    }
    var s = clampedScreen();
    state.screenW = s.w;
    state.screenH = s.h;
  }

  function readViewFromDom(source) {
    if (source === 'slider') {
      state.viewM = Math.max(0.5, parseFloat(document.getElementById('finder-view-slider').value) || state.viewM);
    } else if (hooks.getUnit() === 'm') {
      state.viewM = Math.max(0.5, parseFloat(document.getElementById('finder-view-m').value) || state.viewM);
    } else {
      state.viewM = Math.max(0.5, hooks.metersFromFtIn(
        document.getElementById('finder-view-ft').value,
        document.getElementById('finder-view-in').value
      ));
    }
  }

  function renderResults() {
    var host = document.getElementById('finder-results');
    if (!host) return;
    if (!state.results.length) {
      host.innerHTML = '<p class="text-xs text-slate-500">No catalog panels match indoor/outdoor and installed/rental for this wall. Try the other environment, or switch to Calculator and pick a series.</p>';
      renderCheaper();
      return;
    }
    host.innerHTML = state.results.map(function (item) {
      var on = item.key === state.selectedKey;
      return '<button type="button" class="finder-card w-full text-left p-4 rounded-2xl border space-y-1.5 transition ' +
        (on ? 'border-sky-500 bg-sky-500/10' : 'border-slate-800 bg-slate-900/40 hover:border-sky-500/60') +
        '" data-finder-key="' + item.key + '">' +
        '<div class="flex items-center justify-between gap-2">' +
        '<span class="text-[10px] uppercase tracking-wide text-sky-300">' + item.badge + '</span>' +
        '<span class="text-xs font-semibold text-sky-400 pricing-only">' + (item.cost ? money(item.cost) : 'Request quote') + '</span>' +
        '<span class="text-xs text-slate-500 guest-pricing">' + ((global.t && t('price.signIn')) || 'Sign in for pricing') + '</span>' +
        '</div>' +
        '<div class="font-medium text-sm text-slate-100">' + cardTitle(item) + '</div>' +
        '<div class="text-xs text-slate-400">' + item.panels + ' panels · ' + item.cols + '×' + item.rows +
        ' · ' + sizeLabel(item.w, item.h) + ' · ' + item.pxW.toLocaleString() + ' × ' + item.pxH.toLocaleString() + ' px</div>' +
        '<p class="text-xs text-slate-500">' + whyText(item) + '</p>' +
        '</button>';
    }).join('');
    renderCheaper();
  }

  function renderCheaper() {
    var host = document.getElementById('finder-cheaper');
    if (!host) return;
    if (!state.selectedKey || !state.cheaper.length) {
      host.innerHTML = state.selectedKey
        ? (canSeePrices()
          ? '<p class="text-xs text-slate-500">This is already among the lower-cost fits. Try a coarser pitch in Calculator, or a smaller wall.</p>'
          : '')
        : '';
      return;
    }
    host.innerHTML = '<p class="text-xs text-slate-400 mb-2">Cheaper options</p>' + state.cheaper.map(function (item) {
      var cur = selected();
      var save = cur && cur.cost && item.cost ? cur.cost - item.cost : 0;
      return '<button type="button" class="finder-card w-full text-left p-3 rounded-xl border border-slate-800 hover:border-sky-500/60 space-y-1" data-finder-key="' + item.key + '">' +
        '<div class="flex justify-between gap-2 text-sm"><span class="text-slate-200">' + cardTitle(item) + '</span>' +
        '<span class="text-sky-400 font-medium pricing-only">' + (item.cost ? money(item.cost) : '—') + '</span></div>' +
        '<div class="text-xs text-slate-500">' + item.reason +
        (save > 0 ? '<span class="pricing-only"> Saves ' + money(save) + '.</span>' : '') + '</div>' +
        '</button>';
    }).join('');
  }

  function applyKey(key, fromCheaper) {
    var item = state.results.concat(state.cheaper).filter(function (p) { return p.key === key; })[0];
    if (!item) return;
    if (fromCheaper && !state.results.some(function (p) { return p.key === key; })) {
      state.results = [Object.assign({}, item, { badge: 'Cheaper' })].concat(state.results.slice(0, 2));
    }
    state.selectedKey = item.key;
    document.documentElement.classList.remove('finder-empty');
    if (typeof hooks.applyPick === 'function') {
      hooks.applyPick({
        brandId: item.brandId,
        seriesId: item.seriesId,
        pitch: item.pitch,
        cols: item.cols,
        rows: item.rows,
        fillMode: state.fill
      });
    }
    renderResults();
  }

  function layoutPreview(info) {
    var frame = document.getElementById('room-wall');
    var tag = document.getElementById('room-wall-tag');
    var ghost = document.getElementById('finder-ghost');
    var wrap = document.getElementById('wall-wrapper');
    if (!frame) return;
    var finderOn = document.documentElement.classList.contains('finder-mode');
    frame.classList.toggle('is-on', finderOn);
    if (tag) tag.textContent = finderOn ? ('Wall ' + sizeLabel(state.openingW, state.openingH)) : '';
    if (!finderOn) {
      frame.style.width = '';
      frame.style.height = '';
      frame.style.padding = '';
      if (ghost) ghost.hidden = true;
      return;
    }
    var screenW = (info && info.screenW) || state.openingW;
    var screenH = (info && info.screenH) || state.openingH;
    var ledW = (info && info.ledW) || 240;
    var ledH = (info && info.ledH) || 135;
    var empty = document.documentElement.classList.contains('finder-empty');
    if (empty) {
      var t = targetScreen();
      screenW = t.w;
      screenH = t.h;
    }
    var padX = 10;
    var padY = 10;
    if (info && info.roomW && info.ledW) {
      padX = Math.max(10, (info.roomW - info.ledW) / 2);
      padY = Math.max(10, (info.roomH - info.ledH) / 2);
    } else {
      padX = ledW * Math.max(0, (state.openingW / Math.max(screenW, 0.2) - 1) / 2);
      padY = ledH * Math.max(0, (state.openingH / Math.max(screenH, 0.2) - 1) / 2);
      padX = Math.max(10, padX);
      padY = Math.max(10, padY);
    }
    frame.style.padding = padY + 'px ' + padX + 'px';
    if (ghost) {
      ghost.hidden = !empty;
      ghost.style.width = ledW + 'px';
      ghost.style.height = ledH + 'px';
    }
    var screenBox = document.getElementById('finder-screen-box');
    if (screenBox) {
      screenBox.style.width = ledW + 'px';
      screenBox.style.height = ledH + 'px';
    }
    if (wrap) wrap.classList.toggle('finder-hidden-led', !!(empty && finderOn));
  }

  function scheduleRank() {
    clearTimeout(rankTimer);
    rankTimer = setTimeout(function () {
      recommend();
      renderResults();
      var item = selected();
      if (item && !document.documentElement.classList.contains('finder-empty')) {
        applyKey(item.key);
      } else if (window.updateDesign) {
        window.updateDesign();
      } else if (typeof global.dispatchEvent === 'function') {
        layoutPreview(null);
      }
    }, 80);
  }

  function bind() {
    var env = document.getElementById('finder-env');
    var install = document.getElementById('finder-install');
    var sharp = document.getElementById('finder-sharp');
    var res = document.getElementById('finder-res');
    var fill = document.getElementById('finder-fill');
    if (env) env.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-env]');
      if (!btn) return;
      state.env = btn.getAttribute('data-env');
      paintChipGroup(env, 'data-env', state.env);
      scheduleRank();
    });
    if (install) install.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-install]');
      if (!btn) return;
      state.install = btn.getAttribute('data-install');
      paintChipGroup(install, 'data-install', state.install);
      scheduleRank();
    });
    if (sharp) sharp.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-sharp]');
      if (!btn) return;
      state.sharp = btn.getAttribute('data-sharp');
      paintChipGroup(sharp, 'data-sharp', state.sharp);
      var viewBox = document.getElementById('finder-view-box');
      var resBox = document.getElementById('finder-res-box');
      if (viewBox) viewBox.classList.toggle('hidden', state.sharp !== 'view');
      if (resBox) resBox.classList.toggle('hidden', state.sharp !== 'res');
      scheduleRank();
    });
    if (res) res.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-res]');
      if (!btn) return;
      state.res = btn.getAttribute('data-res');
      paintChipGroup(res, 'data-res', state.res);
      scheduleRank();
    });
    if (fill) fill.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-fill]');
      if (!btn) return;
      var next = btn.getAttribute('data-fill');
      if (next === 'custom' && state.fill !== 'custom') {
        var cur = targetScreen();
        state.screenW = cur.w / shrinkK();
        state.screenH = cur.h / shrinkK();
      }
      state.fill = next === 'custom' ? 'custom' : 'fill';
      if (state.fill === 'fill') {
        state.shrink = 100;
        state.screenW = state.openingW;
        state.screenH = state.openingH;
      }
      paintFillUi();
      syncScreenFields();
      scheduleRank();
    });
    ['finder-front', 'finder-sun'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('click', function () {
        if (id === 'finder-front') state.front = !state.front;
        else state.sun = !state.sun;
        paintToggle(btn, id === 'finder-front' ? state.front : state.sun);
        scheduleRank();
      });
    });
    var budget = document.getElementById('finder-budget');
    if (budget) budget.addEventListener('input', function () {
      state.budget = Math.max(0, parseFloat(budget.value) || 0);
      scheduleRank();
    });
    ['finder-w', 'finder-h', 'finder-w-ft', 'finder-w-in', 'finder-h-ft', 'finder-h-in'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', function () {
        readOpeningFromDom();
        var hint = document.getElementById('finder-ft-hint');
        if (hint) hint.textContent = '≈ ' + state.openingW.toFixed(2) + ' m × ' + state.openingH.toFixed(2) + ' m';
        syncScreenFields();
        scheduleRank();
      });
    });
    ['finder-sw', 'finder-sh', 'finder-sw-ft', 'finder-sw-in', 'finder-sh-ft', 'finder-sh-in'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', function () {
        state.fill = 'custom';
        state.shrink = 100;
        paintFillUi();
        readScreenFromDom();
        var hint = document.getElementById('finder-screen-hint');
        if (hint) hint.textContent = '≈ ' + state.screenW.toFixed(2) + ' m × ' + state.screenH.toFixed(2) + ' m';
        scheduleRank();
      });
    });
    var shrinkEl = document.getElementById('finder-shrink');
    if (shrinkEl) shrinkEl.addEventListener('input', function () {
      state.shrink = Math.max(20, Math.min(100, parseFloat(shrinkEl.value) || 100));
      paintFillUi();
      syncScreenFields();
      if (typeof global.updateDesign === 'function') global.updateDesign();
      scheduleRank();
    });
    ['finder-view-m', 'finder-view-ft', 'finder-view-in', 'finder-view-slider'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', function () {
        readViewFromDom(id === 'finder-view-slider' ? 'slider' : 'fields');
        if (id === 'finder-view-slider') {
          var vFt = hooks.ftInFromMeters(state.viewM);
          setVal('finder-view-m', state.viewM.toFixed(1));
          setVal('finder-view-ft', vFt.ft);
          setVal('finder-view-in', vFt.inch);
        }
        scheduleRank();
      });
    });
    var results = document.getElementById('finder-results');
    if (results) results.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-finder-key]');
      if (!btn) return;
      applyKey(btn.getAttribute('data-finder-key'));
    });
    var cheaper = document.getElementById('finder-cheaper');
    if (cheaper) cheaper.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-finder-key]');
      if (!btn) return;
      applyKey(btn.getAttribute('data-finder-key'), true);
    });
    var cheaperBtn = document.getElementById('finder-cheaper-btn');
    if (cheaperBtn) cheaperBtn.addEventListener('click', function () {
      buildCheaper();
      renderCheaper();
      var box = document.getElementById('finder-cheaper');
      if (box) box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    var useBtn = document.getElementById('finder-use-calc');
    if (useBtn) useBtn.addEventListener('click', function () {
      var item = selected();
      if (item) applyKey(item.key);
      if (typeof hooks.switchToCalculator === 'function') hooks.switchToCalculator();
    });
    bindHandles();
  }

  function handleDelta(d, dx, dy) {
    var dw;
    var dh;
    if (d.corner === 'nw') {
      dw = -2 * dx * d.mppX;
      dh = -2 * dy * d.mppY;
    } else if (d.corner === 'ne') {
      dw = 2 * dx * d.mppX;
      dh = -2 * dy * d.mppY;
    } else if (d.corner === 'sw') {
      dw = -2 * dx * d.mppX;
      dh = 2 * dy * d.mppY;
    } else {
      dw = 2 * dx * d.mppX;
      dh = 2 * dy * d.mppY;
    }
    return { dw: dw, dh: dh };
  }

  function onHandleMove(e) {
    if (!drag) return;
    var dlt = handleDelta(drag, e.clientX - drag.x, e.clientY - drag.y);
    if (drag.kind === 'wall') {
      state.openingW = Math.max(0.5, Math.min(80, drag.ow + dlt.dw));
      state.openingH = Math.max(0.5, Math.min(60, drag.oh + dlt.dh));
      if (state.fill === 'fill') {
        state.screenW = state.openingW;
        state.screenH = state.openingH;
      } else {
        state.screenW = Math.min(state.screenW, state.openingW);
        state.screenH = Math.min(state.screenH, state.openingH);
      }
    } else {
      state.fill = 'custom';
      state.shrink = 100;
      state.screenW = Math.max(0.3, Math.min(state.openingW, drag.sw + dlt.dw));
      state.screenH = Math.max(0.3, Math.min(state.openingH, drag.sh + dlt.dh));
      paintFillUi();
    }
    syncUnitFields();
    if (typeof global.updateDesign === 'function') global.updateDesign();
    scheduleRank();
  }

  function onHandleUp() {
    drag = null;
    document.documentElement.classList.remove('finder-dragging');
    window.removeEventListener('pointermove', onHandleMove);
    window.removeEventListener('pointerup', onHandleUp);
    window.removeEventListener('pointercancel', onHandleUp);
    scheduleRank();
  }

  function bindHandles() {
    var frame = document.getElementById('room-wall');
    if (!frame || frame.getAttribute('data-finder-handles') === '1') return;
    frame.setAttribute('data-finder-handles', '1');
    frame.addEventListener('pointerdown', function (e) {
      var h = e.target.closest('.finder-handle');
      if (!h || !document.documentElement.classList.contains('finder-mode')) return;
      e.preventDefault();
      e.stopPropagation();
      var kind = h.getAttribute('data-handle');
      var corner = h.getAttribute('data-corner');
      var rect = frame.getBoundingClientRect();
      if (kind === 'screen') {
        var vis = targetScreen();
        state.fill = 'custom';
        state.shrink = 100;
        state.screenW = vis.w;
        state.screenH = vis.h;
        paintFillUi();
        syncScreenFields();
      }
      drag = {
        kind: kind,
        corner: corner,
        x: e.clientX,
        y: e.clientY,
        ow: state.openingW,
        oh: state.openingH,
        sw: state.screenW,
        sh: state.screenH,
        mppX: state.openingW / Math.max(8, rect.width),
        mppY: state.openingH / Math.max(8, rect.height)
      };
      document.documentElement.classList.add('finder-dragging');
      window.addEventListener('pointermove', onHandleMove);
      window.addEventListener('pointerup', onHandleUp);
      window.addEventListener('pointercancel', onHandleUp);
    });
  }

  function setMode(mode) {
    var finder = mode === 'finder';
    document.documentElement.classList.toggle('finder-mode', finder);
    var calcPane = document.getElementById('calc-pane');
    var finderPane = document.getElementById('finder-pane');
    if (calcPane) calcPane.hidden = finder;
    if (finderPane) finderPane.hidden = !finder;
    document.querySelectorAll('.designer-mode-tab').forEach(function (btn) {
      var on = btn.getAttribute('data-mode') === mode;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (finder) {
      if (!state.selectedKey) document.documentElement.classList.add('finder-empty');
      syncUnitFields();
      recommend();
      renderResults();
      layoutPreview(null);
      if (typeof global.updateDesign === 'function') global.updateDesign();
    } else {
      document.documentElement.classList.remove('finder-empty');
      layoutPreview(null);
      if (typeof global.updateDesign === 'function') global.updateDesign();
    }
    try {
      var url = new URL(location.href);
      if (finder) url.searchParams.set('tab', 'finder');
      else url.searchParams.delete('tab');
      history.replaceState({}, '', url);
    } catch (e) { /* ignore */ }
  }

  global.SpectrumFinder = {
    init: function (opts) {
      hooks = Object.assign(hooks, opts || {});
      bind();
      document.querySelectorAll('.designer-mode-tab').forEach(function (btn) {
        btn.addEventListener('click', function () {
          setMode(btn.getAttribute('data-mode') === 'finder' ? 'finder' : 'calc');
        });
      });
      paintChipGroup(document.getElementById('finder-env'), 'data-env', state.env);
      paintChipGroup(document.getElementById('finder-install'), 'data-install', state.install);
      paintChipGroup(document.getElementById('finder-sharp'), 'data-sharp', state.sharp);
      paintChipGroup(document.getElementById('finder-res'), 'data-res', state.res);
      paintFillUi();
      var viewBox = document.getElementById('finder-view-box');
      var resBox = document.getElementById('finder-res-box');
      if (viewBox) viewBox.classList.toggle('hidden', state.sharp !== 'view');
      if (resBox) resBox.classList.toggle('hidden', state.sharp !== 'res');
      syncUnitFields();
      var tab = '';
      try { tab = new URLSearchParams(location.search).get('tab') || ''; } catch (e) { tab = ''; }
      if (tab === 'finder') setMode('finder');
      else setMode('calc');
      global.addEventListener('spectrum:catalog', function () {
        if (document.documentElement.classList.contains('finder-mode')) scheduleRank();
      });
      global.addEventListener('spectrum:auth', function () {
        renderResults();
      });
      global.addEventListener('spectrum:pricing', function () {
        renderResults();
      });
    },
    setUnit: function () {
      syncUnitFields();
    },
    getOpening: function () {
      if (!document.documentElement.classList.contains('finder-mode')) return null;
      return { w: state.openingW, h: state.openingH };
    },
    getFill: function () {
      return state.fill;
    },
    getTarget: function () {
      if (!document.documentElement.classList.contains('finder-mode')) return null;
      return targetScreen();
    },
    layoutPreview: layoutPreview,
    setMode: setMode,
    isFinder: function () {
      return document.documentElement.classList.contains('finder-mode');
    }
  };
})(window);
