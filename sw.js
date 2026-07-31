// ============================================================
// sw.js — Service Worker untuk Keuangan Sektor & Komisi
// Gereja AMIN Hermon Bekasi
// Simpan file ini di folder YANG SAMA dengan index.html
// ============================================================

var CACHE_NAME = 'gah-keuangan-v2';

// Aset yang di-cache saat install
var PRECACHE_URLS = [
  './index.html',
  './logo-amin.png',
  './logo-hermon.png'
];

// ── Install: pre-cache aset utama ───────────────────────────
self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // Gunakan cache.add individual agar satu file gagal tidak batalkan semua
      return Promise.allSettled(
        PRECACHE_URLS.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.warn('[SW] Gagal cache:', url, err.message);
          });
        })
      );
    })
  );
});

// ── Activate: hapus cache lama ───────────────────────────────
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ── Fetch: network-first, fallback ke cache ──────────────────
self.addEventListener('fetch', function(e) {
  // Hanya handle GET
  if (e.request.method !== 'GET') return;
  // Hanya handle request ke origin yang sama
  if (!e.request.url.startsWith(self.location.origin)) return;
  // Jangan intercept request ke Google Apps Script
  if (e.request.url.includes('script.google.com')) return;

  e.respondWith(
    fetch(e.request).then(function(res) {
      // Cache respons sukses
      if (res && res.status === 200 && res.type === 'basic') {
        var clone = res.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(e.request, clone);
        });
      }
      return res;
    }).catch(function() {
      // Offline: kembalikan dari cache
      return caches.match(e.request).then(function(r) {
        if (r) return r;
        // Fallback: untuk navigasi, kembalikan index.html
        if (e.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      });
    })
  );
});

// ── Message: update paksa ─────────────────────────────────────
self.addEventListener('message', function(e) {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
