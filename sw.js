const CACHE_NAME = 'registro-residuos-v1.0.1';
const urlsToCache = [
    '/Registro%20de%20Residuos.html',
    'https://cdn.jsdelivr.net/npm/sweetalert2@11',
    'https://code.jquery.com/jquery-3.6.0.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Instalar Service Worker y cachear recursos
self.addEventListener('install', function(event) {
    console.log('Service Worker: Instalando para Registro de Residuos...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('Service Worker: Cacheando archivos específicos');
                return cache.addAll(urlsToCache);
            })
            .then(function() {
                console.log('Service Worker: Instalación completada');
                return self.skipWaiting();
            })
            .catch(function(error) {
                console.log('Service Worker: Error en instalación', error);
            })
    );
});

// Activar Service Worker y limpiar caches antiguos
self.addEventListener('activate', function(event) {
    console.log('Service Worker: Activado para Registro de Residuos');
    
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Eliminando cache antiguo', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(function() {
            console.log('Service Worker: Activación completada');
            return self.clients.claim();
        })
    );
});

// Interceptar peticiones SOLO para la página de residuos
self.addEventListener('fetch', function(event) {
    const url = new URL(event.request.url);
    
    // Solo manejar peticiones de la página de residuos
    if (!url.pathname.includes('Registro%20de%20Residuos') && 
        !url.pathname.includes('Registro de Residuos')) {
        return; // No interferir con otras páginas
    }
    
    // Excluir peticiones a Google Apps Script y otras APIs
    if (event.request.url.includes('script.google.com') ||
        event.request.url.includes('macros/s/') ||
        event.request.url.includes('/api/') ||
        event.request.method !== 'GET') {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                // Si el recurso está en cache, devolverlo
                if (response) {
                    return response;
                }
                
                // Si no está en cache, hacer la petición a la red
                return fetch(event.request)
                    .then(function(networkResponse) {
                        // Solo cachear si la petición es exitosa y es de los recursos que queremos cachear
                        if (networkResponse && networkResponse.status === 200) {
                            // Verificar si es un recurso que queremos cachear
                            const shouldCache = urlsToCache.some(resource => 
                                event.request.url.includes(resource) || 
                                resource === event.request.url
                            );
                            
                            if (shouldCache) {
                                var responseToCache = networkResponse.clone();
                                caches.open(CACHE_NAME)
                                    .then(function(cache) {
                                        cache.put(event.request, responseToCache);
                                    });
                            }
                        }
                        return networkResponse;
                    })
                    .catch(function(error) {
                        console.log('Fetch failed for registro residuos', error);
                        // Podrías devolver una página offline personalizada aquí si es la página principal
                    });
            })
    );
});
