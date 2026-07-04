const CACHE_NAME = 'juul-listes-compactes-v4.3.0';

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './app.js',
    './manifest.json',
    'https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js'
];

// Installation : Mise en cache des ressources statiques
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Mise en cache des ressources hors-ligne');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting(); // Force l'activation immédiate du nouveau SW
});

// Activation : Nettoyage des anciens caches pour forcer la mise à jour (ex: passage de v4.2.0 à v4.3.0)
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[Service Worker] Suppression de l\'ancien cache', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    self.clients.claim(); // Prise de contrôle immédiate des clients ouverts
});

// Interception des requêtes : Stratégie Cache First, Network Fallback
self.addEventListener('fetch', (event) => {
    // On n'intercepte pas les requêtes vers le Cloud (Google Apps Script)
    if (event.request.url.includes('script.google.com')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request).catch(() => {
                // Optionnel : fallback visuel si réseau indisponible et ressource non cachée
                console.warn('[Service Worker] Ressource indisponible hors-ligne :', event.request.url);
            });
        })
    );
});