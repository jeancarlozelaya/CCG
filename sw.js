const CACHE_NAME = 'registro-residuos-v1.0.2';
const urlsToCache = [
    './Registro de Residuos.html',
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
                console.log('Service Worker: Cacheando archivos de residuos');
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
                    // Solo eliminar caches viejos de esta app
                    if (cacheName !== CACHE_NAME && cacheName.includes('registro-residuos')) {
                        console.log('Service Worker: Eliminando cache antiguo', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(function() {
            console.log('Service Worker: Listo para usar offline');
            return self.clients.claim();
        })
    );
});

// Interceptar peticiones - MUY IMPORTANTE: Solo para esta página
self.addEventListener('fetch', function(event) {
    const url = new URL(event.request.url);
    
    // SOLO manejar esta página específica
    const isThisPage = url.pathname.includes('Registro-de-Residuos') || 
                      url.pathname.includes('Registro%20de%20Residuos');
    
    if (!isThisPage) {
        return; // NO interferir con otras páginas
    }
    
    // Excluir peticiones a APIs externas
    if (event.request.url.includes('script.google.com') ||
        event.request.url.includes('macros/s/') ||
        event.request.method !== 'GET') {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                // Si está en cache, devolverlo
                if (response) {
                    return response;
                }
                
                // Si no está, hacer petición normal
                return fetch(event.request)
                    .then(function(networkResponse) {
                        // Solo cachear recursos de la lista
                        if (networkResponse && networkResponse.status === 200) {
                            const shouldCache = urlsToCache.some(resource => 
                                event.request.url.includes(resource)
                            );
                            
                            if (shouldCache) {
                                const responseToCache = networkResponse.clone();
                                caches.open(CACHE_NAME)
                                    .then(function(cache) {
                                        cache.put(event.request, responseToCache);
                                    });
                            }
                        }
                        return networkResponse;
                    })
                    .catch(function(error) {
                        console.log('Error fetch:', error);
                    });
            })
    );
});
