// Service Worker desactivado
self.addEventListener('install', function(event) {
    console.log('Service Worker: Desinstalándose...');
    self.registration.unregister();
});

self.addEventListener('activate', function(event) {
    console.log('Service Worker: Eliminando caches...');
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    return caches.delete(cacheName);
                })
            );
        }).then(function() {
            return self.clients.matchAll();
        }).then(function(clients) {
            clients.forEach(function(client) {
                client.navigate(client.url);
            });
        })
    );
});
