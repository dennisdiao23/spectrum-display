/* Spectrum Dealer Portal PWA — /portal only. Network-first. Do not cache APIs. */
var CACHE = 'spectrum-portal-pwa-v1';

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return key.indexOf('spectrum-portal-pwa-') === 0 && key !== CACHE;
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

function isPortalChrome(url) {
  return url.pathname.indexOf('/css/company-dash') === 0
    || url.pathname.indexOf('/js/portal.js') === 0
    || url.pathname.indexOf('/js/app-help.js') === 0
    || url.pathname.indexOf('/assets/favicon-') === 0
    || url.pathname === '/assets/apple-touch-icon.png'
    || url.pathname === '/assets/spectrum-boot.gif'
    || url.pathname === '/assets/spectrum-boot-still.png'
    || url.pathname === '/assets/spectrum-logo-company.png'
    || url.pathname === '/portal/manifest.webmanifest';
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
          '<!DOCTYPE html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Dealer Portal</title><p style="font-family:system-ui,sans-serif">Dealer Portal is offline. Check the connection.</p>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      })
    );
    return;
  }

  if (!isPortalChrome(url)) return;

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
