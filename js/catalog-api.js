/**
 * Panel and control catalog from /api/catalog (admin database).
 */
(function (global) {
  function cheapestMappedPrice(s) {
    var map = (s && s.pitchInventory) || {};
    var min = 0;
    Object.keys(map).forEach(function (k) {
      var n = Number(map[k] && map[k].price) || 0;
      if (n > 0 && (!min || n < min)) min = n;
    });
    return min;
  }

  function catalogUnitPrice(s) {
    var mapped = cheapestMappedPrice(s);
    if (mapped > 0) return mapped;
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
      target[k] = apiCatalog[k];
    });
    Object.keys(keep).forEach(function (k) {
      if (!target[k] || !(target[k].series && target[k].series.length)) target[k] = keep[k];
    });
    global.SPECTRUM_PRODUCT_LIST = rebuildList(target);
    global.getSpectrumSeries = function (brandId, seriesId) {
      const brand = target[brandId];
      if (!brand) return null;
      return (brand.series || []).find(function (s) { return s.id === seriesId; }) || null;
    };
    global.dispatchEvent(new CustomEvent('spectrum:catalog'));
  }

  function authReadyPromise() {
    if (global.SpectrumAuth && SpectrumAuth.ready) return SpectrumAuth.ready;
    return new Promise(function (resolve) {
      var tries = 0;
      var t = setInterval(function () {
        tries += 1;
        if (global.SpectrumAuth && SpectrumAuth.ready) {
          clearInterval(t);
          global.SpectrumAuth.ready.then(resolve);
        } else if (tries > 100) {
          clearInterval(t);
          resolve();
        }
      }, 30);
    });
  }

  function clearStock() {
    const target = global.SPECTRUM_PRODUCTS || {};
    Object.keys(target).forEach(function (brandId) {
      ((target[brandId] && target[brandId].series) || []).forEach(function (s) {
        const map = s.pitchInventory || {};
        Object.keys(map).forEach(function (pitch) {
          if (!map[pitch]) return;
          delete map[pitch].qty;
          delete map[pitch].status;
        });
      });
    });
  }

  function mergeStock(stock) {
    const target = global.SPECTRUM_PRODUCTS || {};
    Object.keys(target).forEach(function (brandId) {
      ((target[brandId] && target[brandId].series) || []).forEach(function (s) {
        const byPitch = (stock && stock[String(s.dbId)]) || {};
        s.pitchInventory = s.pitchInventory || {};
        Object.keys(byPitch).forEach(function (pitch) {
          s.pitchInventory[pitch] = Object.assign({}, s.pitchInventory[pitch], byPitch[pitch]);
        });
      });
    });
  }

  function loadCatalogStock() {
    if (!(global.SpectrumAuth && SpectrumAuth.canSeeStock && SpectrumAuth.canSeeStock())) {
      clearStock();
      return Promise.resolve(false);
    }
    return SpectrumAuth.accessToken().then(function (token) {
      if (!token) {
        clearStock();
        return false;
      }
      return fetch('/api/catalog/stock', {
        headers: { Accept: 'application/json', Authorization: 'Bearer ' + token }
      }).then(function (res) { return res.ok ? res.json() : null; }).then(function (data) {
        if (!(data && data.ok)) {
          clearStock();
          return false;
        }
        mergeStock(data.stock || {});
        return true;
      });
    }).catch(function () {
      clearStock();
      return false;
    });
  }

  function afterAuthStock() {
    return loadCatalogStock().then(function () {
      if (global.SPECTRUM_PRODUCTS) {
        global.SPECTRUM_PRODUCT_LIST = rebuildList(global.SPECTRUM_PRODUCTS);
      }
      global.dispatchEvent(new CustomEvent('spectrum:catalog'));
    });
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

  global.spectrumDisplayImage = function (src, kind) {
    if (!src) return '';
    var w = 1000;
    if (kind === 'thumb') w = 160;
    else if (kind === 'card') w = 640;
    if (/^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\/product-images\//i.test(src)) {
      return '/api/img?w=' + w + '&u=' + encodeURIComponent(src);
    }
    return src;
  };

  global.spectrumCatalogReady = fetch('/api/catalog', { headers: { Accept: 'application/json' } })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) {
      applyCatalog(data && data.ok ? data.products : {});
      authReadyPromise().then(function () { return loadCatalogStock(); }).then(function () {
        if (global.SPECTRUM_PRODUCTS) {
          global.SPECTRUM_PRODUCT_LIST = rebuildList(global.SPECTRUM_PRODUCTS);
        }
        global.dispatchEvent(new CustomEvent('spectrum:catalog'));
      });
      return global.SPECTRUM_PRODUCTS;
    })
    .catch(function () {
      applyCatalog({});
      return global.SPECTRUM_PRODUCTS;
    });

  global.addEventListener('spectrum:auth', function () {
    afterAuthStock();
  });
})(window);
