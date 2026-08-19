/**
 * Keep canonical / Open Graph URLs on the public www host.
 * Product pages call spectrumSetSeo() after the catalog loads.
 */
(function () {
  var ORIGIN = 'https://www.spectrumdisplay.com';

  function upsert(attr, key, value) {
    if (!value) return;
    var selector = 'meta[' + attr + '="' + key + '"]';
    var el = document.head.querySelector(selector);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', value);
  }

  function setCanonical(href) {
    var el = document.head.querySelector('link[rel="canonical"]');
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', 'canonical');
      document.head.appendChild(el);
    }
    el.setAttribute('href', href);
  }

  function publicPath() {
    var path = location.pathname || '/';
    if (path === '/index.html') path = '/';
    return path;
  }

  window.spectrumSetSeo = function (opts) {
    opts = opts || {};
    if (opts.title) {
      document.title = opts.title;
      upsert('property', 'og:title', opts.title);
      upsert('name', 'twitter:title', opts.title);
    }
    if (opts.description) {
      upsert('name', 'description', opts.description);
      upsert('property', 'og:description', opts.description);
      upsert('name', 'twitter:description', opts.description);
    }
    if (opts.url) {
      setCanonical(opts.url);
      upsert('property', 'og:url', opts.url);
    }
    if (opts.image) {
      var image = opts.image;
      if (image.indexOf('http') !== 0) image = ORIGIN + '/' + image.replace(/^\//, '');
      upsert('property', 'og:image', image);
    }
  };

  var file = (location.pathname.split('/').pop() || 'index.html');
  if (file === 'admin.html' || file === 'cart.html' || file === 'account.html') return;
  if (file === 'brands.html') return;

  var path = publicPath();
  var url = ORIGIN + path + location.search;
  if (path === '/') url = ORIGIN + '/';
  if (!document.head.querySelector('link[rel="canonical"]')) setCanonical(url);
  if (!document.head.querySelector('meta[property="og:url"]')) upsert('property', 'og:url', url);
})();
