// Archivo: sw-llaves.js

const CACHE_NAME_LLAVES = 'control-llaves-v1.0.0';
const urlsToCacheLlaves = [
    './Control de Llaves.html',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://code.jquery.com/jquery-3.6.0.min.js',
    'https://cdn.jsdelivr.net/npm/sweetalert2@11',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
];

// Instalar Service Worker y cachear recursos
self.addEventListener('install', function(event) {
    console.log('Service Worker de Llaves: Instalando...');
    
    event.waitUntil(
        caches.open(CACHE_NAME_LLAVES)
            .then(function(cache) {
                console.log('Service Worker de Llaves: Cacheando archivos');
                return cache.addAll(urlsToCacheLlaves);
            })
            .then(function() {
                console.log('Service Worker de Llaves: Instalación completada');
                return self.skipWaiting();
            })
            .catch(function(error) {
                console.log('Service Worker de Llaves: Error en instalación', error);
            })
    );
});

// Activar Service Worker y limpiar caches antiguos
self.addEventListener('activate', function(event) {
    console.log('Service Worker de Llaves: Activado');
    
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    // Eliminar caches viejos de esta app
                    if (cacheName !== CACHE_NAME_LLAVES && cacheName.includes('control-llaves')) {
                        console.log('Service Worker de Llaves: Eliminando cache antiguo', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(function() {
            console.log('Service Worker de Llaves: Listo para usar offline');
            return self.clients.claim();
        })
    );
});

// Estrategia Cache-first (Primero caché) para recursos estáticos
self.addEventListener('fetch', function(event) {
    const url = new URL(event.request.url);
    
    // Si la petición es para un recurso que no es GET o es una API (como IndexedDB o Google Sheets), no lo interceptamos.
    if (event.request.method !== 'GET' || url.protocol === 'chrome-extension:') {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                // Si está en caché, devolverlo
                if (response) {
                    return response;
                }
                
                // Si no está, ir a la red y actualizar la caché (opcional)
                return fetch(event.request);
            })
    );
});
