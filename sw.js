// ══════════════════════════════════════════
//  EDUFORMIUM SMS — Service Worker v3.1
// ══════════════════════════════════════════

const CACHE_VERSION = 'eduformium-sms-v3.1.0';
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './supabase.js',
  './js/core/utils.js',
  './js/app.js',
  './js/modules/auth.js',
  './js/modules/dashboard.js',
  './js/modules/students.js',
  './js/modules/staff.js',
  './js/modules/classes.js',
  './js/modules/attendance.js',
  './js/modules/exams.js',
  './js/modules/timetable.js',
  './js/modules/homework.js',
  './js/modules/payroll.js',
  './js/modules/leave.js',
  './js/modules/fees.js',
  './js/modules/expenses.js',
  './js/modules/messages.js',
  './js/modules/library.js',
  './js/modules/events.js',
  './js/modules/audit.js',
  './js/modules/settings.js',
  './js/modules/notifications.js',
  './js/modules/users.js',
  './js/modules/modals.js',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
];

// ── INSTALL: pre-cache all static assets ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: delete old caches immediately ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH STRATEGY ──
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Never intercept Supabase API calls
  if (url.includes('.supabase.co') || url.includes('supabase.io')) return;

  // Static assets: cache-first, update in background
  if (
    url.endsWith('.js') || url.endsWith('.css') ||
    url.endsWith('.png') || url.endsWith('.svg') ||
    url.endsWith('.woff2') || url.endsWith('manifest.json')
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const network = fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
        return cached || network;
      })
    );
    return;
  }

  // Navigation: network-first, fallback to cached index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
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
