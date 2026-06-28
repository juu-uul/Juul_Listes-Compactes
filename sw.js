const CACHE_NAME = 'compact-lists-v3.3.1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW : Installation cache V3.3.1');
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
  if (event.request.url.includes('script.google.com')) {
    return; // Laisse le navigateur gérer la requête réseau normalement
  }

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
      // Si la ressource est présente en cache, on la sert immédiatement.
      // Le réseau mettra à jour le cache en arrière-plan pour la prochaine visite.
      if (cachedResponse) {
        return cachedResponse;
      }

      // Si la ressource n'est pas en cache, on attend la réponse du réseau.
      return fetchPromise.then((networkResponse) => {
        if (networkResponse) return networkResponse;

        // Si le réseau échoue et qu'aucune ressource n'est en cache, réponse de secours 503.
        return new Response('Connexion Internet requise pour cette ressource.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' })
        });
      });
    })
  );
});
