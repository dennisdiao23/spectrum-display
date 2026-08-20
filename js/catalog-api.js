/**
 * Load catalog from SQLite when the Node server is running.
 * Falls back to js/products-data.js if /api/catalog is unavailable.
 */
(function (global) {
  var staticCatalog = null;

  function snapshotStatic() {
    if (!staticCatalog) {
      staticCatalog = JSON.parse(JSON.stringify(global.SPECTRUM_PRODUCTS || {}));
    }
    return staticCatalog;
  }

  function priceLabelFor(s) {
    var n = Number(s && s.pricePerM2);
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
            : '',
          priceLabel: priceLabelFor(s)
        }));
      });
    });
    return list;
  }

  function mergeCatalog(apiCatalog) {
    var fallback = snapshotStatic();
    var out = apiCatalog ? JSON.parse(JSON.stringify(apiCatalog)) : {};
    Object.keys(fallback).forEach(function (brandId) {
      if (!out[brandId]) out[brandId] = JSON.parse(JSON.stringify(fallback[brandId]));
      if (fallback[brandId].tagline && !out[brandId].tagline) {
        out[brandId].tagline = fallback[brandId].tagline;
      }
      var fSeries = fallback[brandId].series || [];
      var aSeries = out[brandId].series || (out[brandId].series = []);
      var byId = {};
      aSeries.forEach(function (s) { byId[s.id] = s; });
      fSeries.forEach(function (extra) {
        var s = byId[extra.id];
        if (!s) {
          aSeries.push(JSON.parse(JSON.stringify(extra)));
          return;
        }
        ['cats', 'specTable', 'sourceUrl', 'features', 'lead', 'gallery'].forEach(function (k) {
          if (extra[k] == null) return;
          if (s[k] == null || (Array.isArray(s[k]) && !s[k].length)) s[k] = extra[k];
        });
        if (!s.image && extra.image) s.image = extra.image;
        if (!s.description && extra.description) s.description = extra.description;
      });
    });
    return out;
  }

  function applyCatalog(catalog) {
    snapshotStatic();
    const merged = mergeCatalog(catalog);
    const target = global.SPECTRUM_PRODUCTS || (global.SPECTRUM_PRODUCTS = {});
    Object.keys(target).forEach(function (k) { delete target[k]; });
    Object.keys(merged || {}).forEach(function (k) { target[k] = merged[k]; });
    global.SPECTRUM_PRODUCT_LIST = rebuildList(target);
    global.getSpectrumSeries = function (brandId, seriesId) {
      const brand = target[brandId];
      if (!brand) return null;
      return (brand.series || []).find(function (s) { return s.id === seriesId; }) || null;
    };
    global.dispatchEvent(new CustomEvent('spectrum:catalog'));
  }

  global.applySpectrumCatalog = applyCatalog;

  global.spectrumCatalogReady = fetch('/api/catalog', { headers: { Accept: 'application/json' } })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) {
      if (data && data.ok && data.products) applyCatalog(data.products);
      return global.SPECTRUM_PRODUCTS;
    })
    .catch(function () { return global.SPECTRUM_PRODUCTS; });
})(window);
