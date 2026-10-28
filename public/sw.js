// S.A.C. Desk PWA Service Worker - Subpath & GitHub Pages Compatible (./)
const CACHE_NAME = 'sac-desk-pwa-v4';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './sac-logo.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './favicon.png'
];

const EMBEDDED_SAC_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><rect width="512" height="512" fill="#0f172a"/><g transform="translate(46.08, 46.08) scale(0.82)"><defs><clipPath id="c"><circle cx="256" cy="256" r="236"/></clipPath></defs><circle cx="256" cy="256" r="242" fill="#38bdf8" fill-opacity="0.28"/><g clip-path="url(#c)"><circle cx="256" cy="256" r="236" fill="#24a8e0"/><path d="M 50 330 C 130 380, 200 440, 290 445 C 360 450, 410 415, 460 350 L 512 512 L 0 512 Z" fill="#1b287d"/><path d="M 64 345 C 118 375, 178 372, 230 350 C 270 332, 295 315, 310 295 L 346 398 C 353 410, 368 402, 362 390 L 348 285 L 426 182 C 434 172, 428 162, 416 166 L 326 250 L 182 232 C 170 230, 168 244, 178 250 L 278 288 C 230 330, 150 366, 64 345 Z" fill="#ffffff"/></g></g></svg>`;

// Install Event: precache relative core assets and skip waiting immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return Promise.allSettled(
          PRECACHE_ASSETS.map((asset) => cache.add(asset))
        );
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
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch Event: Cache-first for static icons/manifest, Network-first for HTML/navigation
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Exclude API proxy, Firestore, and WebSocket traffic
  if (
    url.pathname.includes('/api/') ||
    url.protocol === 'ws:' ||
    url.protocol === 'wss:' ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com')
  ) {
    return;
  }

  const isStaticAsset =
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('/manifest.json');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          fetch(event.request)
            .then((networkRes) => {
              if (networkRes && networkRes.status === 200) {
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkRes));
              }
            })
            .catch(() => {});
          return cached;
        }
        return fetch(event.request)
          .then((networkRes) => {
            if (networkRes && networkRes.status === 200) {
              const clone = networkRes.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return networkRes;
          })
          .catch(async () => {
            const fallbackIcon = (await caches.match('./icon-192.png')) || (await caches.match('./sac-logo.svg'));
            if (fallbackIcon) return fallbackIcon;
            return new Response(EMBEDDED_SAC_SVG, {
              status: 200,
              headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' }
            });
          });
      })
    );
    return;
  }

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

        if (event.request.mode === 'navigate' || event.request.destination === 'document') {
          const fallback = (await caches.match('./index.html')) || (await caches.match('./'));
          if (fallback) {
            return fallback;
          }
        }

        if (event.request.destination === 'image') {
          const cachedImg = (await caches.match('./icon-192.png')) || (await caches.match('./sac-logo.svg'));
          if (cachedImg) return cachedImg;
          return new Response(EMBEDDED_SAC_SVG, {
            status: 200,
            headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' }
          });
        }

        return new Response('Offline - S.A.C. Desk in modalità offline locale.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
