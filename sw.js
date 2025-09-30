// sw.js - Service Worker para funcionalidad offline
const CACHE_NAME = 'pisos-brillantes-v1';
const urlsToCache = [
  '/',
  '/Prueba1.html',
  // Agrega aquí otros recursos estáticos que quieras cachear
];

// Instalar el Service Worker
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Cache abierto');
        return cache.addAll(urlsToCache);
      })
  );
});

// Interceptar solicitudes y servir desde cache cuando sea posible
self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Devuelve la respuesta desde cache o realiza la solicitud
        return response || fetch(event.request);
      }
    )
  );
});

// Actualizar el Service Worker cuando haya cambios
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('Eliminando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});