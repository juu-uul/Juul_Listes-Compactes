const CACHE_NAME = 'listes-compactes-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js',
  'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f4dd.png',
  'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/192x192/1f4dd.png',
  'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/512x512/1f4dd.png'
];

// Installation du Service Worker et mise en cache des ressources
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Nettoyage des anciens caches si une mise à jour a lieu
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Stratégie Réseau d'abord, repli sur le Cache (Network-first, fallback to Cache)
// Idéal pour récupérer d'éventuelles corrections d'app.js tout en restant 100% fonctionnel hors ligne
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => {
      return caches.match(e.request);
    })
  );
});