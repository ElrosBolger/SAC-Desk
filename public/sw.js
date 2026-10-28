// S.A.C. Desk PWA Service Worker - Instant UI loading & Offline Fallback
const CACHE_NAME = 'sac-desk-pwa-v3';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/sac-logo.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/favicon.png'
];

// Install Event: precache core assets and skip waiting immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS).catch((err) => {
          console.warn('[S.A.C. SW] Precache parziale asset statici:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event: purge stale caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              console.log('[S.A.C. SW] Rimozione cache obsoleta:', name);
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch Event: Network-first with instant cache fallback
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Exclude API proxy, Firestore, and WebSocket traffic
  if (url.pathname.startsWith('/api/') || url.protocol === 'ws:' || url.protocol === 'wss:' || url.hostname.includes('firestore.googleapis.com')) {
    return;
  }

  // Cache-first for core static icons and manifest for instant loading
  const isStaticAsset = url.pathname.endsWith('.png') ||
                        url.pathname.endsWith('.svg') ||
                        url.pathname.endsWith('.ico') ||
                        url.pathname === '/manifest.json';

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          // Revalidate in background
          fetch(event.request).then((networkRes) => {
            if (networkRes && networkRes.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkRes));
            }
          }).catch(() => {});
          return cached;
        }
        return fetch(event.request).then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkRes;
        });
      })
    );
    return;
  }

  // Network-first with cache fallback for navigation and HTML
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // For navigational requests, return cached /index.html
        if (event.request.mode === 'navigate' || event.request.destination === 'document') {
          const fallback = (await caches.match('/index.html')) || (await caches.match('/'));
          if (fallback) {
            return fallback;
          }
        }

        // Fallback for image requests
        if (event.request.destination === 'image') {
          return (await caches.match('/sac-logo.svg')) || (await caches.match('/icon-192.png'));
        }

        return new Response('Offline - S.A.C. Desk in modalità offline locale.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })
  );
});

// Message Event: handle SKIP_WAITING
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
