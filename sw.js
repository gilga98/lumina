/**
 * Lumina — Service Worker
 * Caches ALL assets (HTML, CSS, JS, JSON, SVGs, CDN resources) for full offline support.
 * Cache-first strategy with network fallback.
 */

const CACHE_NAME = 'lumina-v3';

// Every single asset that must be cached for offline use
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/router.js',
  './js/services/crypto-service.js',
  './js/services/db-service.js',
  './js/services/auth-service.js',
  './js/services/gestational-engine.js',
  './js/services/image-service.js',
  './js/services/backup-service.js',
  './js/services/content-service.js',
  './js/services/calendar-service.js',
  './js/pages/dashboard-page.js',
  './js/pages/library-page.js',
  './js/pages/vault-page.js',
  './js/pages/settings-page.js',
  './js/pages/onboarding-page.js',
  './js/pages/lock-screen.js',
  './js/pages/calendar-page.js',
  './js/components/install-banner.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/medical/week-01.png',
  './assets/medical/week-02.png',
  './assets/medical/week-03.png',
  './assets/medical/week-04.png',
  './assets/medical/week-05.png',
  './assets/medical/week-06.png',
  './assets/medical/week-07.png',
  './assets/medical/week-08.png',
  './assets/medical/week-09.png',
  './assets/medical/week-10.png',
  './assets/medical/week-11.png',
  './assets/medical/week-12.png',
  './assets/medical/week-13.png',
  './assets/medical/week-14.png',
  './assets/medical/week-15.png',
  './assets/medical/week-16.png',
  './assets/medical/week-17.png',
  './assets/medical/week-18.png',
  './assets/medical/week-19.png',
  './assets/medical/week-20.png',
  './assets/medical/week-21.png',
  './assets/medical/week-22.png',
  './assets/medical/week-23.png',
  './assets/medical/week-24.png',
  './assets/medical/week-25.png',
  './assets/medical/week-26.png',
  './assets/medical/week-27.png',
  './assets/medical/week-28.png',
  './assets/medical/week-29.png',
  './assets/medical/week-30.png',
  './assets/medical/week-31.png',
  './assets/medical/week-32.png',
  './assets/medical/week-33.png',
  './assets/medical/week-34.png',
  './assets/medical/week-35.png',
  './assets/medical/week-36.png',
  './assets/medical/week-37.png',
  './assets/medical/week-38.png',
  './assets/medical/week-39.png',
  './assets/medical/week-40.png',
  ...Array.from({length: 40}, (_, i) => `./data/weeks/week-${String(i+1).padStart(2, '0')}.json`),
  // CDN resources — fonts and CSS frameworks
  'https://cdn.jsdelivr.net/npm/daisyui@4.12.14/dist/full.min.css',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700&display=swap',
];

// Install — pre-cache all critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache local assets (these must succeed)
      const localAssets = ASSETS_TO_CACHE.filter(url => !url.startsWith('http'));
      await cache.addAll(localAssets);

      // Cache CDN assets (best-effort — may fail on first install if offline)
      const cdnAssets = ASSETS_TO_CACHE.filter(url => url.startsWith('http'));
      for (const url of cdnAssets) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn(`[SW] Failed to cache CDN resource: ${url}`, err);
        }
      }
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// Fetch — Cache-first, falling back to network
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s)
  if (!request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          // Don't cache opaque responses or errors
          if (!response || response.status !== 200) {
            // For opaque responses (cross-origin), cache them anyway if they're fonts/CSS
            if (response && response.type === 'opaque') {
              const cache = caches.open(CACHE_NAME);
              cache.then(c => c.put(request, response.clone()));
              return response;
            }
            return response;
          }

          // Cache successful responses
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });

          return response;
        })
        .catch(() => {
          // Offline fallback for navigations — serve index.html
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
    })
  );
});
