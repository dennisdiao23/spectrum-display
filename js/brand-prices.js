(function (global) {
  'use strict';

  var PRODUCT_TYPES = ['LED Panel', 'Control', 'Receiving Card', 'Processor', 'Accessory', 'Service', 'Spare'];
  var PRICE_KEYS = ['sell', 'dealer', 'integrator'];
  var rules = [];
  var brands = [];

  function money(value) {
    var n = Number(value);
    if (!isFinite(n) || n < 0) return 0;
    return Math.round(n * 100) / 100;
  }

  function cleanPct(value) {
    if (value == null || value === '') return null;
    var n = Number(value);
    if (!isFinite(n) || n < 0) return 0;
    return Math.round(Math.min(n, 1000) * 100) / 100;
  }

  function applyPct(base, dir, pct) {
    var n = Number(base);
    if (!isFinite(n)) return 0;
    var p = cleanPct(pct) || 0;
    var factor = dir === 'decrease' ? (1 - p / 100) : (1 + p / 100);
    return money(Math.max(0, n * factor));
  }

  function priceKeyForType(customerType) {
    var t = String(customerType || '').trim().toLowerCase();
    if (t === 'dealer') return 'dealer';
    if (t === 'av integrator' || t === 'integrator') return 'integrator';
    return 'sell';
  }

  function priceLabel(key) {
    if (key === 'dealer') return 'Dealer price';
    if (key === 'integrator') return 'Integrator price';
    return 'Sell price';
  }

  function lockedBasis(priceKey, basis) {
    if (priceKey === 'sell') return { basis: 'cost', adjustDir: 'increase' };
    if (String(basis || '').toLowerCase() === 'sell') return { basis: 'sell', adjustDir: 'decrease' };
    return { basis: 'cost', adjustDir: 'increase' };
  }

  function ruleFor(brandId, productType, priceKey) {
    var type = String(productType || '').trim();
    var list = rules.filter(function (row) {
      return String(row.brandId) === String(brandId) && row.priceKey === priceKey;
    });
    var specific = type ? list.find(function (row) { return row.productType === type; }) : null;
    return specific || list.find(function (row) { return !row.productType; }) || null;
  }

  function brandHasRules(brandId) {
    return rules.some(function (row) { return String(row.brandId) === String(brandId); });
  }

  function activeRule(brandId, productType, priceKey) {
    var type = String(productType || '').trim();
    var list = rules.filter(function (row) {
      return String(row.brandId) === String(brandId) && row.priceKey === priceKey;
    });
    var specific = type ? list.find(function (row) { return row.productType === type; }) : null;
    if (specific && Number(specific.adjustPct) > 0) return specific;
    var general = list.find(function (row) { return !row.productType; });
    if (general && Number(general.adjustPct) > 0) return general;
    return null;
  }

  function pricesFromCost(brandId, productType, cost, pctByKey, current) {
    var cur = current || {};
    var sellOld = money(cur.sell != null ? cur.sell : cur.price);
    var dealerOld = money(cur.dealer != null ? cur.dealer : cur.dealerNet);
    var integratorOld = money(cur.integrator != null ? cur.integrator : cur.integratorPrice);
    var overrides = pctByKey || {};
    function hitFor(key) {
      if (overrides[key] != null && Number(overrides[key]) > 0) {
        var rule = activeRule(brandId, productType, key);
        var basis = rule ? rule.basis : (key === 'sell' ? 'cost' : 'sell');
        return { pct: Number(overrides[key]), basis: key === 'sell' ? 'cost' : basis };
      }
      var found = activeRule(brandId, productType, key);
      if (!found) return null;
      return { pct: Number(found.adjustPct), basis: key === 'sell' ? 'cost' : found.basis };
    }
    var sellHit = hitFor('sell');
    var sell = sellHit && Number(cost) > 0 ? applyPct(cost, 'increase', sellHit.pct) : sellOld;
    function side(key, old) {
      var hit = hitFor(key);
      if (!hit) return old;
      if (!(Number(cost) > 0) && hit.basis !== 'sell') return old;
      if (hit.basis === 'sell') return applyPct(sell, 'decrease', hit.pct);
      return applyPct(cost, 'increase', hit.pct);
    }
    return { sell: sell, dealer: side('dealer', dealerOld), integrator: side('integrator', integratorOld) };
  }

  function describeRule(rule) {
    if (!rule || !(Number(rule.adjustPct) > 0)) return 'Leave unchanged';
    var pct = Number(rule.adjustPct) || 0;
    if (rule.priceKey === 'sell' || rule.basis === 'cost') return 'Cost, increase ' + pct + '%';
    return 'Sell price, decrease ' + pct + '%';
  }

  function customerPriceNote(customerType) {
    var key = priceKeyForType(customerType);
    if (key === 'dealer') return 'This customer uses Dealer price.';
    if (key === 'integrator') return 'This customer uses Integrator price.';
    return 'This customer uses Sell price. Retail and Residential use Sell price.';
  }

  function unitPriceForCustomer(item, customer) {
    if (!item) return 0;
    if (!customer) return money(item.price);
    var key = priceKeyForType(customer.customerType);
    var brandId = item.brandId || '';
    var hit = (customer.priceOverrides || []).find(function (row) {
      return String(row.brandId) === String(brandId);
    });
    if (hit && brandHasRules(brandId)) {
      var pctByKey = {};
      pctByKey[key] = hit.adjustPct;
      return pricesFromCost(brandId, item.category || '', item.cost, pctByKey, {
        sell: item.price,
        dealer: item.dealerNet,
        integrator: item.integratorPrice
      })[key];
    }
    if (key === 'dealer') return money(item.dealerNet);
    if (key === 'integrator' && item.integratorPrice != null && item.integratorPrice !== '') return money(item.integratorPrice);
    return money(item.price);
  }

  global.SpectrumBrandPrices = {
    PRODUCT_TYPES: PRODUCT_TYPES,
    PRICE_KEYS: PRICE_KEYS,
    setRules: function (next) { rules = Array.isArray(next) ? next : []; },
    setBrands: function (next) { brands = Array.isArray(next) ? next : []; },
    brands: function () { return brands; },
    rulesFor: function (brandId) {
      return rules.filter(function (row) { return String(row.brandId) === String(brandId); });
    },
    priceKeyForType: priceKeyForType,
    priceLabel: priceLabel,
    lockedBasis: lockedBasis,
    ruleFor: ruleFor,
    brandHasRules: brandHasRules,
    pricesFromCost: pricesFromCost,
    describeRule: describeRule,
    customerPriceNote: customerPriceNote,
    unitPriceForCustomer: unitPriceForCustomer
  };
})(window);
