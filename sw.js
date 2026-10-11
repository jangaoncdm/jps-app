/* JPS service worker — BUILD JPS v0.7.1-M6 b020
 * Network-first so a new deploy always wins when online; cached shell keeps the
 * app opening offline in poor-network villages. API POSTs are never cached.
 */
var CACHE = 'JPS v0.7.1-M6 b020'; // full build tag — bump-build.sh rewrites it, busting old caches
var SHELL = ['./', './index.html', './app.js', './manifest.webmanifest', './icon-192.png',
             './img/emblem-telangana.png', './img/dept-animal-husbandry.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

/* How long the network gets before we serve the copy we already have. A village
   tower that accepts the connection and then stalls does NOT reject: fetch() can hang
   for a minute or more. The old handler only fell back to cache on a rejection, so for
   that whole window the farmer got a blank page while a complete working app sat in
   the cache unused. That is what "cannot reach the app" looked like on a bad network.
   Still network-first in every normal case: any connection that answers inside 2.5 s
   wins, so a new deploy is picked up on the first load as before. */
var NET_BUDGET_MS = 2500;

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return; // API calls are POST — always network
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(e.request).then(function (res) {
        // Only a real success is worth keeping. Without this check a 5xx, or the captive
        // portal page a village hotspot serves for ./app.js, was written into the cache and
        // then handed back as the offline fallback until the next build tag change.
        if (res && res.ok && res.type !== 'opaque') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      });
      // Nothing cached yet: the network is the only option, so wait it out.
      if (!hit) return net.catch(function () { return caches.match('./index.html'); });
      // We have a copy. Give the network its budget, then serve what we have and let
      // the fetch finish in the background so the next load is current.
      return new Promise(function (resolve) {
        var settled = false;
        var settle = function (r) { if (!settled && r) { settled = true; resolve(r); } };
        var fallback = setTimeout(function () { settle(hit); }, NET_BUDGET_MS);
        net.then(function (res) { clearTimeout(fallback); settle(res); },
                 function () { clearTimeout(fallback); settle(hit); });
      });
    })
  );
});
