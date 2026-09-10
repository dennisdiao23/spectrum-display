/* Spectrum Company PWA — /company only. Network-first. Do not cache APIs. */
var CACHE = 'spectrum-company-pwa-v1';

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return key !== CACHE;
      }).map(function (key) {
        return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function isApi(url) {
  return url.pathname.indexOf('/api/') === 0;
}

function isCompanyChrome(url) {
  return url.pathname.indexOf('/css/company-dash') === 0
    || url.pathname.indexOf('/js/company-chat') === 0
    || url.pathname.indexOf('/js/company-crm') === 0
    || url.pathname.indexOf('/js/print-form') === 0
    || url.pathname.indexOf('/js/address-autocomplete') === 0
    || url.pathname.indexOf('/assets/favicon-') === 0
    || url.pathname === '/company/manifest.webmanifest';
}

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (isApi(url)) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(function () {
        return new Response(
          '<!DOCTYPE html><meta charset="utf-8"><title>Company</title><p>Company is offline. Check the connection.</p>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      })
    );
    return;
  }

  if (!isCompanyChrome(url)) return;

  event.respondWith(
    fetch(event.request).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (cache) {
          cache.put(event.request, copy);
        });
      }
      return res;
    }).catch(function () {
      return caches.match(event.request);
    })
  );
});
