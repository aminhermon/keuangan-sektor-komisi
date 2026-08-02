/**
 * Service Worker — Keuangan Gereja AMIN Hermon
 * Strategi: Cache-First untuk aset statis, Network-First untuk data
 */

const CACHE_NAME = 'keuangan-gah-v1';
const CACHE_VERSION = 1;

// Aset yang di-cache saat install
const PRECACHE_ASSETS = [
  './index.html',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

// ============================================================
// INSTALL — Pre-cache aset utama
// ============================================================
self.addEventListener('install', event => {
  console.log('[SW] Installing Service Worker v' + CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Pre-caching assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Pre-cache failed:', err))
  );
});

// ============================================================
// ACTIVATE — Hapus cache lama
// ============================================================
self.addEventListener('activate', event => {
  console.log('[SW] Activating Service Worker v' + CACHE_VERSION);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ============================================================
// FETCH — Cache-first dengan fallback ke network
// ============================================================
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Lewati request non-HTTP (chrome-extension, dll)
  if (!url.protocol.startsWith('http')) return;

  // Lewati Google Apps Script / API eksternal → langsung ke network
  if (
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('google.com')
  ) {
    event.respondWith(
      fetch(request).catch(() => new Response(
        JSON.stringify({ error: 'Tidak ada koneksi internet' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      ))
    );
    return;
  }

  // Cache-first untuk aset lokal
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) {
        // Perbarui cache di background (stale-while-revalidate)
        event.waitUntil(
          fetch(request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.status === 200) {
                return caches.open(CACHE_NAME).then(cache => {
                  cache.put(request, networkResponse.clone());
                });
              }
            })
            .catch(() => {}) // Diam saat offline
        );
        return cachedResponse;
      }

      // Tidak ada cache → ambil dari network dan simpan
      return fetch(request)
        .then(networkResponse => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          // Fallback offline untuk halaman HTML
          if (request.destination === 'document') {
            return caches.match('./index.html');
          }
          return new Response('', { status: 503 });
        });
    })
  );
});

// ============================================================
// MESSAGE — Komunikasi dari halaman
// ============================================================
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION, cacheName: CACHE_NAME });
  }
});
