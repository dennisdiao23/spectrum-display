/**
 * Applies the signed-in user's sell price. Markup % lives in Admin only.
 */
(function (global) {
  var Pricing = {
    multiplier: 1,
    apply: function (n) {
      var base = Number(n) || 0;
      if (!base) return 0;
      var m = Number(this.multiplier);
      if (!Number.isFinite(m) || m <= 0) m = 1;
      return Math.round(base * m);
    },
    fromLabel: function (n) {
      var p = this.apply(n);
      return p ? ('From $' + p.toLocaleString()) : 'Request quote';
    },
    money: function (n) {
      var p = this.apply(n);
      return p ? ('$' + p.toLocaleString()) : '—';
    },
    refreshDom: function () {
      document.querySelectorAll('[data-catalog-price]').forEach(function (el) {
        var n = Number(el.getAttribute('data-catalog-price'));
        el.textContent = Pricing.fromLabel(n);
      });
    },
    setMultiplier: function (m) {
      var next = Number(m);
      if (!Number.isFinite(next) || next <= 0) next = 1;
      this.multiplier = next;
      this.refreshDom();
      if (typeof global.refreshSpectrumPriceLabels === 'function') {
        global.refreshSpectrumPriceLabels();
      }
      global.dispatchEvent(new CustomEvent('spectrum:pricing'));
    }
  };

  global.SpectrumPricing = Pricing;
})(typeof window !== 'undefined' ? window : globalThis);
