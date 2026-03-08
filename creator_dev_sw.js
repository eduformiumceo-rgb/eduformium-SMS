const CACHE = 'creator-dev-console-v1';
const ASSETS = ['/creator_dev.html'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Network-first for Firebase requests; cache-first for the HTML shell
  if (e.request.url.includes('firebase') || e.request.url.includes('google')) return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
