// S.A.C. Desk PWA Service Worker - WebAPK Generation & Cache Purge (v6)
const CACHE_NAME = 'sac-desk-pwa-v6';
const CACHE_PREFIX = 'sac-desk-pwa';

const PRECACHE_ASSETS = [
  './',
  './?utm_source=pwa',
  './index.html',
  './manifest.json',
  './sac-logo.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.png'
];

const EMBEDDED_SAC_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><rect width="512" height="512" fill="#0f172a"/><g transform="translate(46.08, 46.08) scale(0.82)"><defs><clipPath id="c"><circle cx="256" cy="256" r="236"/></clipPath></defs><circle cx="256" cy="256" r="242" fill="#38bdf8" fill-opacity="0.28"/><g clip-path="url(#c)"><circle cx="256" cy="256" r="236" fill="#24a8e0"/><path d="M 50 330 C 130 380, 200 440, 290 445 C 360 450, 410 415, 460 350 L 512 512 L 0 512 Z" fill="#1b287d"/><path d="M 64 345 C 118 375, 178 372, 230 350 C 270 332, 295 315, 310 295 L 346 398 C 353 410, 368 402, 362 390 L 348 285 L 426 182 C 434 172, 428 162, 416 166 L 326 250 L 182 232 C 170 230, 168 244, 178 250 L 278 288 C 230 330, 150 366, 64 345 Z" fill="#ffffff"/></g></g></svg>`;

// Install Event: precache relative core assets and force immediate activation
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        PRECACHE_ASSETS.map((asset) =>
          fetch(asset, { cache: 'reload' })
            .then((res) => (res && res.ok ? cache.put(asset, res) : null))
            .catch(() => cache.add(asset).catch(() => null))
        )
      );
    })
  );
});

// Activate Event: automatic cleanup of all previous sac-desk-pwa-* and stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME && (name.startsWith(CACHE_PREFIX) || name !== CACHE_NAME)) {
              console.log('[S.A.C. SW] Eliminazione cache precedente:', name);
              return caches.delete(name);
            }
            return Promise.resolve();
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch Event: Network-first for manifest.json & HTML, Cache-first with background refresh for icons
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Exclude API proxy, Firebase/Google Cloud endpoints, Vite dev modules, and WebSocket traffic
  if (
    url.pathname.includes('/api/') ||
    url.pathname.includes('/@vite/') ||
    url.pathname.includes('/node_modules/') ||
    url.protocol === 'ws:' ||
    url.protocol === 'wss:' ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('firebaseapp.com')
  ) {
    return;
  }

  // Always prefer fresh manifest.json from network so Chrome/Android immediately sees updated id "/SAC-Desk/webapk-v1"
  if (url.pathname.endsWith('/manifest.json')) {
    event.respondWith(
      fetch(event.request, { cache: 'reload' })
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkRes;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  const isStaticIcon =
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico');

  if (isStaticIcon) {
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
        const cachedResponse =
          (await caches.match(event.request)) ||
          (await caches.match(event.request, { ignoreSearch: true }));
        if (cachedResponse) {
          return cachedResponse;
        }

        if (event.request.mode === 'navigate' || event.request.destination === 'document') {
          const fallback =
            (await caches.match('./?utm_source=pwa')) ||
            (await caches.match('./index.html')) ||
            (await caches.match('./'));
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
