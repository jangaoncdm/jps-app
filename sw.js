/* JPS service worker — BUILD JPS v0.5.0-M4 b008
 * Network-first so a new deploy always wins when online; cached shell keeps the
 * app opening offline in poor-network villages. API POSTs are never cached.
 */
var CACHE = 'JPS v0.5.0-M4 b008'; // full build tag — bump-build.sh rewrites it, busting old caches
var SHELL = ['./', './index.html', './app.js', './manifest.webmanifest', './icon-192.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return; // API calls are POST — always network
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return res;
    }).catch(function () {
      return caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
        return hit || caches.match('./index.html');
      });
    })
  );
});
