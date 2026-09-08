/**
 * Control-systems helpers. NovaStar is processors/cards, not a panel brand.
 * Receiving cards are never added to new-wall quotes or the calculator.
 */
(function (global) {
  var RECEIVING_NOTE =
    'New Spectrum walls ship with receiving cards installed. Order these only if you need a spare or a field replacement.';
  var CABINET_CARD_NOTE = 'Receiving card included in this panel.';
  var QUOTE_CARD_NOTE = 'Receiving cards are included in each panel.';
  var EXPLAINER =
    'Every Spectrum wall needs a control system. NovaStar takes HDMI/SDI/DP in, scales and color-corrects, then sends pixel-accurate signal to the cards already installed in each panel.';

  var SUBS = [
    { id: '', label: 'All control systems' },
    { id: 'all-in-one', label: 'All-in-one processors' },
    { id: 'sending', label: 'Sending boxes' },
    { id: 'playback', label: 'Playback / NovaLCT players' },
    { id: 'receiving-card', label: 'Receiving cards — replacements & spares' },
    { id: 'accessories', label: 'Accessories' }
  ];

  var CHOOSER = [
    { sub: 'all-in-one', title: 'I have HDMI sources and a fixed wall', text: 'VX / COEX / H Series' },
    { sub: 'sending', title: 'I already have a processor and only need output', text: 'MCTRL / MSD' },
    { sub: 'playback', title: 'I need standalone playback / no media player', text: 'TU / TB' },
    { sub: 'receiving-card', title: 'I need a spare card for an existing wall', text: 'Receiving card replacements' },
    { sub: 'accessories', title: 'I need fiber conversion for a long run', text: 'CVT10' }
  ];

  function isControlProduct(p) {
    var t = String((p && p.type) || '').toLowerCase();
    return !!(p && (t === 'control' || p.brandId === 'novastar' || p.subtype));
  }

  function isReceivingCard(p) {
    return !!(p && (p.replacementOnly || p.subtype === 'receiving-card'));
  }

  function controlList() {
    return (global.SPECTRUM_PRODUCT_LIST || []).filter(isControlProduct);
  }

  function byId(id) {
    var list = global.SPECTRUM_PRODUCT_LIST || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id && isControlProduct(list[i])) return list[i];
    }
    if (global.getSpectrumSeries) return global.getSpectrumSeries('novastar', id);
    return null;
  }

  function formatPixels(n) {
    n = Number(n) || 0;
    if (n >= 1000000) {
      var m = n / 1000000;
      return (Math.round(m * 10) / 10) + 'M px';
    }
    return n.toLocaleString() + ' px';
  }

  function shoppableControl() {
    return controlList().filter(function (p) { return !isReceivingCard(p); });
  }

  function processorsForCalculator() {
    return shoppableControl().filter(function (p) {
      return p.subtype === 'all-in-one' || p.subtype === 'sending';
    });
  }

  function playbackBoxes() {
    return shoppableControl().filter(function (p) { return p.subtype === 'playback'; });
  }

  function productId(p) {
    return String((p && p.id) || '').toLowerCase();
  }

  function usesCvt10(p) {
    var id = productId(p);
    return id === 'mx2000-pro' || id === 'mx6000-pro' || id === 'mx2000' || id === 'mx6000';
  }

  function isHSeries(p) {
    var fam = String((p && p.family) || '').toLowerCase();
    var id = productId(p);
    return fam.indexOf('h series') !== -1 || /^(h2|h5|h9|h15)$/.test(id);
  }

  function copperRj45OnBox(p) {
    if (!p) return 0;
    if (usesCvt10(p)) return 0;
    var id = productId(p);
    if (id === 'h2') return 20;
    if (id === 'h5') return 40;
    if (id === 'h9') return 60;
    if (id === 'h15') return 80;
    var m = String(p.outputs || '').match(/(\d+)\s*[×x]\s*(?:EtherCON|RJ45)/i);
    return m ? Number(m[1]) : 0;
  }

  function cvt10Count(dataPorts) {
    var n = Math.max(0, Number(dataPorts) || 0);
    return n ? Math.ceil(n / 10) : 0;
  }

  function canDrivePorts(p, dataPorts) {
    var ports = Math.max(0, Number(dataPorts) || 0);
    if (!p) return false;
    if (!ports) return true;
    if (usesCvt10(p)) return true;
    var copper = copperRj45OnBox(p);
    if (copper > 0) return copper >= ports;
    return true;
  }

  function hSendingCardPorts() {
    return 20;
  }

  function processorKitLabel(p, qty, cvt10, opts) {
    if (!p) return 'None';
    var short = !!(opts && opts.short);
    var name = short ? (p.model || p.name) : (p.name || p.model);
    if ((Number(qty) || 0) > 1) name = qty + ' × ' + name;
    var n = Number(cvt10) || 0;
    if (n > 0) name += short ? (' + ' + n + '× CVT10') : (' + ' + n + ' × CVT10');
    return name;
  }

  function undersizedPortWarning(p, dataPorts) {
    if (!p || usesCvt10(p)) return '';
    var copper = copperRj45OnBox(p);
    var ports = Math.max(0, Number(dataPorts) || 0);
    if (!copper || !ports || copper >= ports) return '';
    var cvt = cvt10Count(ports);
    if (productId(p) === 'h2') {
      return 'H2 has at most 20 copper ports. This wall needs ' + ports +
        '. Use H5 + two sending cards, or MX2000 Pro + ' + cvt + '× CVT10.';
    }
    return (p.model || p.name) + ' has at most ' + copper + ' copper ports. This wall needs ' +
      ports + '. Use H5 with enough sending cards, or MX2000 Pro + ' + cvt + '× CVT10.';
  }

  /**
   * Smallest processor/sender whose published load is ≥ totalPixels with ~20% headroom.
   * Never returns a receiving card. Skips H2 when the wall needs more than 20 copper ports.
   * Prefers MX2000 Pro + CVT10 when data ports ≥ 21.
   */
  function recommendProcessor(totalPixels, opts) {
    var total = Math.max(0, Number(totalPixels) || 0);
    var need = Math.ceil(total * 1.2);
    var dataPorts = opts && opts.dataPorts != null ? Number(opts.dataPorts) : 0;
    var subtype = (opts && opts.subtype) || 'all-in-one';

    if (dataPorts > 20) {
      var mx2000 = byId('mx2000-pro');
      var mx6000 = byId('mx6000-pro');
      var mx = mx2000;
      if (mx2000 && (mx2000.maxPixels || 0) < need && mx6000) mx = mx6000;
      if (!mx) mx = mx6000;
      if (mx && !isReceivingCard(mx)) {
        return {
          product: mx,
          qty: 1,
          totalPixels: total,
          need: need,
          headroom: 0.2,
          cvt10: cvt10Count(dataPorts)
        };
      }
      var biggerH = byId('h5') || byId('h9') || byId('h15');
      if (biggerH && canDrivePorts(biggerH, dataPorts)) {
        return {
          product: biggerH,
          qty: 1,
          totalPixels: total,
          need: need,
          headroom: 0.2,
          cvt10: 0
        };
      }
    }

    var pool = processorsForCalculator().filter(function (p) {
      return subtype === 'any' ? true : p.subtype === subtype;
    });
    if (!pool.length) pool = processorsForCalculator();
    pool = pool.filter(function (p) {
      if (productId(p) === 'h2' && dataPorts > 20) return false;
      return canDrivePorts(p, dataPorts);
    });
    pool = pool.slice().sort(function (a, b) {
      return (a.maxPixels || 0) - (b.maxPixels || 0);
    });
    var pick = null;
    for (var i = 0; i < pool.length; i++) {
      if ((pool[i].maxPixels || 0) >= need) {
        pick = pool[i];
        break;
      }
    }
    if (!pick && pool.length) pick = pool[pool.length - 1];
    var qty = 1;
    if (pick && pick.maxPixels && pick.maxPixels < need) {
      qty = Math.max(1, Math.ceil(need / pick.maxPixels));
    }
    return {
      product: pick,
      qty: qty,
      totalPixels: total,
      need: need,
      headroom: 0.2,
      cvt10: usesCvt10(pick) ? cvt10Count(dataPorts) : 0
    };
  }

  /**
   * Recommended control SKUs for a panel product page. Never includes receivers.
   */
  function recommendedControlForCabinet(product) {
    var cats = (global.spectrumCatsFor ? global.spectrumCatsFor(product) : (product && product.cats) || []) || [];
    if (typeof cats === 'string') cats = cats.split(/\s+/);
    function has(id) { return cats.indexOf(id) !== -1; }
    var ids;
    if (has('posters')) ids = ['ku20', 'vx400-pro', 'tb60', 'tu15-pro'];
    else if (has('indoor-rental') || has('outdoor-rental') || has('creative')) ids = ['vx1000-pro', 'vx2000-pro', 'mx2000-pro', 'mctrl4k'];
    else if (has('cob') || has('fixed-indoor')) ids = ['vx1000-pro', 'mx40-pro', 'h2'];
    else if (has('outdoor-fixed')) ids = ['vx600-pro', 'mx30', 'tb60'];
    else ids = ['vx600-pro', 'mx30'];
    var out = [];
    ids.forEach(function (id) {
      var p = byId(id);
      if (p && !isReceivingCard(p)) out.push(p);
    });
    return out;
  }

  function shouldShowReceiving(params) {
    var cat = (params.get('cat') || '').toLowerCase();
    var sub = (params.get('sub') || '').toLowerCase();
    var q = (params.get('q') || '').trim();
    if (sub === 'receiving-card' || sub === 'receiving-cards') return true;
    if (q) return true;
    return false;
  }

  function filterCatalogList(list, params) {
    params = params || new URLSearchParams();
    var cat = (params.get('cat') || '').toLowerCase();
    var sub = (params.get('sub') || '').toLowerCase();
    if (sub === 'receiving-cards') sub = 'receiving-card';
    var brand = (params.get('brand') || '').toLowerCase();
    var q = (params.get('q') || '').trim().toLowerCase();
    var showRecv = shouldShowReceiving(params);

    return (list || []).filter(function (p) {
      if (brand && p.brandId !== brand) return false;
      if (isReceivingCard(p) && !showRecv) return false;
      if (cat === 'control') {
        if (!isControlProduct(p)) return false;
        if (sub && p.subtype !== sub) return false;
        if (!sub && isReceivingCard(p)) return false;
      } else if (cat) {
        var cats = global.spectrumCatsFor ? global.spectrumCatsFor(p) : (p.cats || []);
        var joined = Array.isArray(cats) ? cats : String(cats).split(/\s+/);
        if (joined.indexOf(cat) === -1) return false;
      }
      if (q) {
        var hay = [p.name, p.brandName, p.description, p.type, p.id, p.model, p.family, p.subtype]
          .join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function priceUnitLabel(p) {
    if (isControlProduct(p)) return 'each';
    return '/m²';
  }

  global.SpectrumControl = {
    RECEIVING_NOTE: RECEIVING_NOTE,
    CABINET_CARD_NOTE: CABINET_CARD_NOTE,
    QUOTE_CARD_NOTE: QUOTE_CARD_NOTE,
    EXPLAINER: EXPLAINER,
    SUBS: SUBS,
    CHOOSER: CHOOSER,
    isControlProduct: isControlProduct,
    isReceivingCard: isReceivingCard,
    controlList: controlList,
    byId: byId,
    formatPixels: formatPixels,
    shoppableControl: shoppableControl,
    processorsForCalculator: processorsForCalculator,
    playbackBoxes: playbackBoxes,
    usesCvt10: usesCvt10,
    isHSeries: isHSeries,
    copperRj45OnBox: copperRj45OnBox,
    cvt10Count: cvt10Count,
    hSendingCardPorts: hSendingCardPorts,
    processorKitLabel: processorKitLabel,
    undersizedPortWarning: undersizedPortWarning,
    recommendProcessor: recommendProcessor,
    recommendedControlForCabinet: recommendedControlForCabinet,
    shouldShowReceiving: shouldShowReceiving,
    filterCatalogList: filterCatalogList,
    priceUnitLabel: priceUnitLabel
  };
})(typeof window !== 'undefined' ? window : globalThis);
