/**
 * Apply US Store theme before first paint so dark mode does not flash white.
 * Preference: localStorage spectrumStoreTheme = light | dark | system (default).
 */
(function () {
  var KEY = 'spectrumStoreTheme';

  function pref() {
    var v = '';
    try { v = localStorage.getItem(KEY) || ''; } catch (e) { v = ''; }
    if (v === 'light' || v === 'dark' || v === 'system') return v;
    return 'system';
  }

  function systemDark() {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (e) {
      return false;
    }
  }

  function resolve(p) {
    if (p === 'light' || p === 'dark') return p;
    return systemDark() ? 'dark' : 'light';
  }

  function apply(p) {
    p = p || pref();
    var resolved = resolve(p);
    var html = document.documentElement;
    html.setAttribute('data-shop-theme-pref', p);
    html.setAttribute('data-shop-theme', resolved);
    html.style.colorScheme = resolved;
  }

  apply(pref());

  var api = {
    KEY: KEY,
    getPref: pref,
    resolve: resolve,
    apply: apply,
    setPref: function (next) {
      if (next !== 'light' && next !== 'dark' && next !== 'system') next = 'system';
      try { localStorage.setItem(KEY, next); } catch (e) {}
      apply(next);
      return next;
    }
  };

  try {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onSys = function () {
      if (pref() === 'system') apply('system');
    };
    if (mq.addEventListener) mq.addEventListener('change', onSys);
    else if (mq.addListener) mq.addListener(onSys);
  } catch (e) {}

  window.SpectrumStoreTheme = api;
})();
