// ============================================================
//  sw.js — Service Worker | Keuangan Sektor & Komisi
//  Gereja AMIN Hermon Bekasi | © 2026
// ============================================================

const CACHE_NAME   = 'keuangan-gereja-v2';
const CACHE_STATIC = 'keuangan-static-v2';

// Base path untuk GitHub Pages
const BASE_PATH = '/keuangan-sektor-komisi';

// Aset yang di-cache saat install
const PRECACHE_URLS = [
  BASE_PATH + '/',
  BASE_PATH + '/keuangan-sektor-komisi.html',
  BASE_PATH + '/manifest.json',
];

// CDN yang boleh di-cache (network-first, fallback ke cache)
const CDN_ORIGINS = [
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'unpkg.com',
];

// ── INSTALL ──────────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing…');
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => {
        console.log('[SW] Pre-cache selesai');
        return self.skipWaiting();
      })
      .catch(err => console.warn('[SW] Pre-cache error:', err))
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating…');
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== CACHE_STATIC)
          .map(k => {
            console.log('[SW] Hapus cache lama:', k);
            return caches.delete(k);
          })
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // Google Apps Script / GAS → selalu network
  if (url.hostname.includes('script.google.com') ||
      url.hostname.includes('googleapis.com')) {
    event.respondWith(fetch(request).catch(() => networkErrorResponse()));
    return;
  }

  // CDN → Network-First
  if (CDN_ORIGINS.some(o => url.hostname.includes(o))) {
    event.respondWith(networkFirstWithCache(request, CACHE_STATIC));
    return;
  }

  // File app lokal → Stale-While-Revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(networkFirstWithCache(request, CACHE_NAME));
});

// ── STRATEGI CACHE ────────────────────────────────────────────
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_STATIC);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(response => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cached || await fetchPromise || networkErrorResponse();
}

async function networkFirstWithCache(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || networkErrorResponse();
  }
}

function networkErrorResponse() {
  return new Response(
    `<!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Offline — Keuangan Gereja</title>
      <style>
        body {
          font-family: 'Segoe UI', system-ui, sans-serif;
          background: #152B47; color: #F8FAFC;
          display: flex; align-items: center; justify-content: center;
          min-height: 100vh; margin: 0; padding: 24px; text-align: center;
        }
        .box { max-width: 320px; }
        .icon { font-size: 64px; margin-bottom: 16px; display: block; }
        h1 { font-size: 20px; color: #F0BE3D; margin-bottom: 10px; }
        p { font-size: 14px; color: #94A3B8; margin-bottom: 24px; line-height: 1.6; }
        button {
          background: #C8960C; color: #0F172A; border: none;
          border-radius: 8px; padding: 12px 28px;
          font-size: 14px; font-weight: 700; cursor: pointer;
        }
      </style>
    </head>
    <body>
      <div class="box">
        <span class="icon">📡</span>
        <h1>Tidak Ada Koneksi</h1>
        <p>Perangkat Anda sedang offline. Buka aplikasi saat terhubung ke internet.</p>
        <button onclick="location.reload()">🔄 Coba Lagi</button>
      </div>
    </body>
    </html>`,
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

// ── PESAN DARI HALAMAN ────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
