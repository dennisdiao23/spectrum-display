/**
 * Load catalog from SQLite when the Node server is running.
 * Falls back to js/products-data.js if /api/catalog is unavailable.
 */
(function (global) {
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
          priceLabel: 'From $' + Number(s.pricePerM2 || 0).toLocaleString()
        }));
      });
    });
    return list;
  }

  function applyCatalog(catalog) {
    const target = global.SPECTRUM_PRODUCTS || (global.SPECTRUM_PRODUCTS = {});
    Object.keys(target).forEach(function (k) { delete target[k]; });
    Object.keys(catalog || {}).forEach(function (k) { target[k] = catalog[k]; });
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
