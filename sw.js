// ══════════════════════════════════════════
//  EDUFORMIUM SMS — Service Worker
//  Cache-first strategy for offline use
// ══════════════════════════════════════════

const CACHE_NAME = 'eduformium-sms-v1.0.1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
];

// ── INSTALL: cache all static assets ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: clean old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: network-first, fallback to cache (ensures fresh assets always load) ──
self.addEventListener('fetch', event => {
  // Skip cross-origin requests (CDN scripts etc.)
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request).then(response => {
      // Cache successful GET responses
      if (event.request.method === 'GET' && response.status === 200) {
        const cloned = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
      }
      return response;
    }).catch(() => {
      // Offline fallback: serve from cache
      return caches.match(event.request).then(cached => {
        if (cached) return cached;
        // Final fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// ── BACKGROUND SYNC (future: fee reminders, attendance) ──
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    event.waitUntil(
      // Placeholder for future backend sync
      Promise.resolve()
    );
  }
});

// ── PUSH NOTIFICATIONS ──
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : { title: 'Eduformium SMS', body: 'You have a new notification' };
  event.waitUntil(
    self.registration.showNotification(data.title || 'Eduformium SMS', {
      body: data.body || '',
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: 'eduformium-sms',
      data: data,
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      if (list.length > 0) return list[0].focus();
      return clients.openWindow('./');
    })
  );
});
