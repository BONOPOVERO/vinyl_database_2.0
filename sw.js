// sw.js - Service Worker per funzionamento 100% Offline (PWA)

const CACHE_NAME = 'vinyl-vault-liquid-v8';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './favicon.svg',
  './data/records.json',
  './js/app.js',
  './js/store.js',
  './js/discogs-engine.js',
  './js/liquid-glass-fx.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null)
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Non mettere in cache le chiamate esterne dinamiche
  if (url.hostname.includes('discogs.com')) return;

  // Cache-First per immagini locali ed esterne (cover)
  if (e.request.destination === 'image') {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(networkRes => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return networkRes;
        }).catch(() => caches.match('./favicon.svg'));
      })
    );
    return;
  }

  // Network-First per asset locali con fallback offline
  e.respondWith(
    fetch(e.request)
      .then(networkRes => {
        if (networkRes && networkRes.status === 200) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return networkRes;
      })
      .catch(() => caches.match(e.request))
  );
});
