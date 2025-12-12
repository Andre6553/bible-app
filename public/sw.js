const CACHE_NAME = 'bible-app-v1';
const URLS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
    '/bible-icon.svg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(URLS_TO_CACHE);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            // Return cached response if found
            if (response) {
                return response;
            }

            // Clone the request because it's a stream
            const fetchRequest = event.request.clone();

            return fetch(fetchRequest).then((response) => {
                // Check if valid response
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }

                // Clone response to cache it
                const responseToCache = response.clone();

                caches.open(CACHE_NAME).then((cache) => {
                    // Cache static assets and maybe API calls if we want universal offline
                    // For now, cache everything that succeeds
                    cache.put(event.request, responseToCache);
                });

                return response;
            });
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
