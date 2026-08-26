/**
 * Control-systems helpers. NovaStar is processors/cards, not a cabinet brand.
 * Receiving cards are never added to new-wall quotes or the calculator.
 */
(function (global) {
  var RECEIVING_NOTE =
    'New Spectrum walls ship with receiving cards installed. Order these only if you need a spare or a field replacement.';
  var CABINET_CARD_NOTE = 'Receiving card included in this cabinet.';
  var QUOTE_CARD_NOTE = 'Receiving cards are included in each cabinet.';
  var EXPLAINER =
    'Every Spectrum wall needs a control system. NovaStar takes HDMI/SDI/DP in, scales and color-corrects, then sends pixel-accurate signal to the cards already installed in each cabinet.';

  var SUBS = [
    { id: '', label: 'All control systems' },
    { id: 'all-in-one', label: 'All-in-one processors' },
    { id: 'sending', label: 'Sending boxes' },
    { id: 'playback', label: 'Playback / NovaLCT players' },
    { id: 'receiving-card', label: 'Receiving cards — replacements & spares' },
    { id: 'accessories', label: 'Accessories' }
  ];

  var CHOOSER = [
    { sub: 'all-in-one', title: 'I have HDMI sources and a fixed wall', text: 'VX / COEX all-in-one' },
    { sub: 'sending', title: 'I already have a processor and only need output', text: 'MCTRL / MSD' },
    { sub: 'playback', title: 'I need standalone playback / no media player', text: 'TU / TB' },
    { sub: 'receiving-card', title: 'I need a spare card for an existing wall', text: 'Receiving card replacements' }
  ];

  function isControlProduct(p) {
    return !!(p && (p.type === 'control' || p.brandId === 'novastar'));
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

  /**
   * Smallest processor/sender whose published load is ≥ totalPixels with ~20% headroom.
   * Never returns a receiving card.
   */
  function recommendProcessor(totalPixels, opts) {
    var total = Math.max(0, Number(totalPixels) || 0);
    var need = Math.ceil(total * 1.2);
    var subtype = (opts && opts.subtype) || 'all-in-one';
    var pool = processorsForCalculator().filter(function (p) {
      return subtype === 'any' ? true : p.subtype === subtype;
    });
    if (!pool.length) pool = processorsForCalculator();
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
      headroom: 0.2
    };
  }

  /**
   * Recommended control SKUs for a cabinet product page. Never includes receivers.
   */
  function recommendedControlForCabinet(product) {
    var cats = (global.spectrumCatsFor ? global.spectrumCatsFor(product) : (product && product.cats) || []) || [];
    if (typeof cats === 'string') cats = cats.split(/\s+/);
    function has(id) { return cats.indexOf(id) !== -1; }
    var ids;
    if (has('posters')) ids = ['ku20', 'vx400-pro', 'tb60', 'tu15-pro'];
    else if (has('indoor-rental') || has('outdoor-rental') || has('creative')) ids = ['vx1000-pro', 'vx2000-pro', 'mctrl4k'];
    else if (has('cob') || has('fixed-indoor')) ids = ['vx1000-pro', 'mx40-pro'];
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
    recommendProcessor: recommendProcessor,
    recommendedControlForCabinet: recommendedControlForCabinet,
    shouldShowReceiving: shouldShowReceiving,
    filterCatalogList: filterCatalogList,
    priceUnitLabel: priceUnitLabel
  };
})(typeof window !== 'undefined' ? window : globalThis);
