/**
 * Public traffic: Google Analytics G-4RDTWJECX0 plus a first-party ping
 * for Company → Dashboard. Skips /company and /portal.
 */
(function (global) {
  var GA_ID = 'G-4RDTWJECX0';
  var lastPath = '';
  var lastAt = 0;

  function pathName() {
    return (location.pathname || '/').toLowerCase();
  }

  function skip() {
    var p = pathName();
    if (p.indexOf('/company') === 0 || p === '/company.html') return true;
    if (p.indexOf('/portal') === 0 || p === '/portal.html') return true;
    if (p === '/admin.html' || p.indexOf('/admin') === 0) return true;
    return false;
  }

  function channel() {
    var host = (location.hostname || '').toLowerCase();
    if (host === 'store.spectrumdisplay.com' || host.indexOf('store.') === 0) return 'store';
    var p = pathName();
    if (p === '/store' || p.indexOf('/store/') === 0) return 'store';
    return 'website';
  }

  function visitorId() {
    var match = document.cookie.match(/(?:^|; )sd_vid=([^;]*)/);
    if (match && match[1]) return decodeURIComponent(match[1]);
    var id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    document.cookie = 'sd_vid=' + encodeURIComponent(id) + ';path=/;max-age=31536000;SameSite=Lax';
    return id;
  }

  function loadGtag() {
    if (global.gtag) return;
    global.dataLayer = global.dataLayer || [];
    function gtag() { global.dataLayer.push(arguments); }
    global.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA_ID, { anonymize_ip: true });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
  }

  function ping(eventName) {
    if (skip()) return;
    var event = eventName || 'pageview';
    var payload = {
      event: event,
      path: location.pathname || '/',
      channel: channel(),
      visitor: visitorId()
    };
    try {
      fetch('/api/analytics/pageview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(function () {});
    } catch (e) { /* ignore */ }
    if (global.gtag && event !== 'pageview') {
      if (event === 'add_to_cart') global.gtag('event', 'add_to_cart');
      else if (event === 'contact' || event === 'dealer') global.gtag('event', 'generate_lead', { method: event });
    }
  }

  function pageview() {
    if (skip()) return;
    var p = location.pathname || '/';
    var now = Date.now();
    if (p === lastPath && now - lastAt < 800) return;
    lastPath = p;
    lastAt = now;
    ping('pageview');
    if (global.gtag) {
      global.gtag('event', 'page_view', { page_path: p, page_location: location.href });
    }
  }

  function wrapHistory() {
    var orig = history.pushState;
    history.pushState = function () {
      var ret = orig.apply(this, arguments);
      setTimeout(pageview, 0);
      return ret;
    };
    window.addEventListener('popstate', pageview);
  }

  if (global.__spectrumAnalyticsBooted) return;
  global.__spectrumAnalyticsBooted = true;
  if (skip()) {
    global.SpectrumAnalytics = { track: function () {} };
    return;
  }

  loadGtag();
  wrapHistory();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pageview);
  else pageview();

  global.SpectrumAnalytics = {
    track: function (event) { ping(event); }
  };
})(window);
