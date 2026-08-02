const CACHE_NAME = 'gah-keuangan-v2';
const urlsToCache = [
  './index.html',
  './'
];

// Install Event
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate Event
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName.startsWith('gah-keuangan-') && cacheName !== CACHE_NAME;
        }).map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    })
  );
});

// Fetch Event
self.addEventListener('fetch', event => {
  // Hanya proses request GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Kembalikan dari cache jika ada
        if (response) {
          return response;
        }
        
        // Jika tidak ada di cache, ambil dari network
        return fetch(event.request).then(
          function(networkResponse) {
            // Jangan cache respon yang tidak valid
            if(!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            var responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then(function(cache) {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          }
        );
      }).catch(() => {
        // Fallback saat offline
        if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
        }
      })
  );
});
