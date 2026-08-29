/**
 * Panel catalog from /api/catalog (database / admin).
 * NovaStar control gear in novastar-catalog.js is preserved and is not a panel product.
 */
(function (global) {
  function catalogUnitPrice(s) {
    if (s && (s.type === 'control' || s.subtype)) return Number(s.priceEach) || 0;
    return Number(s && s.pricePerM2) || 0;
  }

  function priceLabelFor(s) {
    var n = catalogUnitPrice(s);
    if (global.SpectrumPricing && SpectrumPricing.fromLabel) {
      return SpectrumPricing.fromLabel(n);
    }
    if (!n) return 'Request quote';
    return 'From $' + n.toLocaleString();
  }

  function rebuildList(data) {
    const list = [];
    Object.keys(data || {}).forEach(function (brandId) {
      const brand = data[brandId];
      (brand.series || []).forEach(function (s) {
        const pitches = s.pitches || [];
        list.push(Object.assign({}, s, {
          brandId: brandId,
          brandName: brand.name,
          pitchLabel: pitches.length
            ? pitches[0] + (pitches.length > 1 ? '–' + pitches[pitches.length - 1] : '') + ' mm'
            : (s.type === 'control' ? (s.family || 'Control') : ''),
          priceLabel: priceLabelFor(s)
        }));
      });
    });
    return list;
  }

  function isControlBrand(id, brand) {
    return id === 'novastar' || !!(brand && brand.kind === 'control');
  }

  function controlBrands(from) {
    var out = {};
    Object.keys(from || {}).forEach(function (id) {
      if (isControlBrand(id, from[id])) out[id] = from[id];
    });
    return out;
  }

  function applyCatalog(apiCatalog) {
    const target = global.SPECTRUM_PRODUCTS || (global.SPECTRUM_PRODUCTS = {});
    const keep = controlBrands(target);
    Object.keys(target).forEach(function (k) { delete target[k]; });
    Object.keys(apiCatalog || {}).forEach(function (k) {
      if (keep[k]) return;
      target[k] = apiCatalog[k];
    });
    Object.keys(keep).forEach(function (k) { target[k] = keep[k]; });
    global.SPECTRUM_PRODUCT_LIST = rebuildList(target);
    global.getSpectrumSeries = function (brandId, seriesId) {
      const brand = target[brandId];
      if (!brand) return null;
      return (brand.series || []).find(function (s) { return s.id === seriesId; }) || null;
    };
    global.dispatchEvent(new CustomEvent('spectrum:catalog'));
  }

  global.spectrumCatsFor = function (p) {
    var raw = (p && p.cats) || [];
    if (typeof raw === 'string') raw = raw.split(/[\s,]+/);
    var set = {};
    (raw || []).forEach(function (c) {
      if (c) set[String(c).toLowerCase()] = true;
    });
    if (p && (p.type === 'control' || p.subtype)) {
      set.control = true;
      if (p.subtype) set[String(p.subtype).toLowerCase()] = true;
      if (p.subtype === 'receiving-card') set['receiving-cards'] = true;
    }
    return Object.keys(set);
  };

  global.applySpectrumCatalog = applyCatalog;
  global.refreshSpectrumPriceLabels = function () {
    if (!global.SPECTRUM_PRODUCTS) return;
    global.SPECTRUM_PRODUCT_LIST = rebuildList(global.SPECTRUM_PRODUCTS);
    global.dispatchEvent(new CustomEvent('spectrum:catalog'));
  };

  global.SPECTRUM_PRODUCTS = global.SPECTRUM_PRODUCTS || {};
  global.SPECTRUM_PRODUCT_LIST = rebuildList(global.SPECTRUM_PRODUCTS);
  global.getSpectrumSeries = global.getSpectrumSeries || function (brandId, seriesId) {
    const brand = global.SPECTRUM_PRODUCTS[brandId];
    if (!brand) return null;
    return (brand.series || []).find(function (s) { return s.id === seriesId; }) || null;
  };

  global.spectrumCatalogReady = fetch('/api/catalog', { headers: { Accept: 'application/json' } })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) {
      applyCatalog(data && data.ok ? data.products : {});
      return global.SPECTRUM_PRODUCTS;
    })
    .catch(function () {
      applyCatalog({});
      return global.SPECTRUM_PRODUCTS;
    });
})(window);
