const CACHE_NAME = 'compact-lists-v5.1.0';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icon72.png?v=5.1.0',
  './icon192.png?v=5.1.0',
  './icon512.png?v=5.1.0',
  'https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW : Mise en cache des ressources de base V5.1.0');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('SW : Nettoyage de l\'ancien cache', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Sécurité Synchro : Ne pas intercepter ni mettre en cache les requêtes vers l'API Google Apps Script
  if (event.request.url.includes('script.google.com')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Échec silencieux du réseau en arrière-plan (ex: mode hors ligne)
        });

      // Stratégie Stale-While-Revalidate :
      if (cachedResponse) return cachedResponse;

      return fetchPromise.then((networkResponse) => {
        if (networkResponse) return networkResponse;

        return new Response('Connexion Internet requise pour cette ressource.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' })
        });
      });
    })
  );
});