const CACHE_NAME = 'bible-app-v2';
const URLS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
    '/bible-icon.svg'
];

self.addEventListener('install', (event) => {
    // Skip waiting to activate immediately
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(URLS_TO_CACHE);
        })
    );
});

self.addEventListener('fetch', (event) => {
    // Skip caching for HMR (Hot Module Replacement) and API calls
    if (event.request.url.includes('hot-update') ||
        event.request.url.includes('/@vite/') ||
        event.request.url.includes('/node_modules/') ||
        event.request.url.includes('chrome-extension')) {
        return;
    }

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

                // Don't cache in development (localhost) to avoid issues
                if (event.request.url.includes('localhost') || event.request.url.includes('127.0.0.1')) {
                    return response;
                }

                // Clone response to cache it
                const responseToCache = response.clone();

                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });

                return response;
            });
        })
    );
});

self.addEventListener('activate', (event) => {
    // Claim clients to control uncontrolled pages immediately
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
        ])
    );
});
