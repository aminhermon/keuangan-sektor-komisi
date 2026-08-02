// service-worker.js — Gereja AMIN Hermon Keuangan PWA
// Strategi: Cache-First untuk aset statis, Network-First untuk API
// Update versi cache ketika ada perubahan file

const CACHE_VERSION = 'v3';
const CACHE_NAME = 'keuangan-cache-' + CACHE_VERSION;

// Aset statis yang di-cache untuk offline
const STATIC_ASSETS = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// ===== INSTALL: Cache semua aset statis =====
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Aktifkan SW baru segera tanpa menunggu tab lain tutup
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// ===== ACTIVATE: Hapus cache lama =====
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('keuangan-cache-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim()) // Ambil kontrol semua tab segera
  );
});

// ===== FETCH: Strategi cerdas berdasarkan jenis request =====
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Request ke Google Apps Script (GAS) — JANGAN di-cache, selalu network
  //    Kalau offline, langsung gagal (app sudah handle ini di loadDataFromGAS)
  if (url.hostname.includes('script.google.com') || url.hostname.includes('googleapis.com')) {
    event.respondWith(fetch(event.request).catch(() => {
      return new Response(JSON.stringify({ ok: false, error: 'Offline — tidak dapat terhubung ke server' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }));
    return;
  }

  // 2. Request non-GET — langsung ke network (form submit, dll)
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // 3. Aset statis app (index.html, manifest, icon) — Cache-First
  //    Buka dari cache dulu (instan), update cache di background
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Ambil versi baru dari network di background (stale-while-revalidate)
      const networkFetch = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const cloned = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        }
        return networkResponse;
      }).catch(() => null);

      // Kembalikan cache dulu jika ada (langsung tampil), atau tunggu network
      return cachedResponse || networkFetch;
    })
  );
});
