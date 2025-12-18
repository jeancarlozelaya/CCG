// Archivo: sw-index.js

const CACHE_NAME_INDEX = 'pibrisa-index-v2.0.1';
const urlsToCacheIndex = [
    './',
    './index.html',
    './manifest.json',
    './Pag - Reportería.html',
    './Reporte de Supervisión.html',
    './Liberación.html',
    'Imágenes/Otros/HojadeLiberación.jpg',
    './Control de Llaves.html',
    './Pag - Residuos.html',
    './Registro de Residuos.html',
    './Registro de Trazabilidad & Volumen de Residuos.html',   
    'Imágenes/Icono.png',


    // Librerías externas usadas en index.html
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap',
    'https://cdn.jsdelivr.net/npm/sweetalert2@11',
    'https://cdnjs.cloudflare.com/ajax/libs/viewerjs/1.11.6/viewer.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/viewerjs/1.11.6/viewer.min.js'
];

// 1. Instalación: Cachear recursos estáticos
self.addEventListener('install', function(event) {
    console.log('Service Worker Index: Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME_INDEX)
            .then(function(cache) {
                console.log('Service Worker Index: Cacheando archivos');
                return cache.addAll(urlsToCacheIndex);
            })
            .then(() => self.skipWaiting())
    );
});

// 2. Activación: Limpiar cachés antiguos
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheName !== CACHE_NAME_INDEX && cacheName.startsWith('pibrisa-index')) {
                        console.log('Service Worker Index: Eliminando caché antiguo', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. Intercepción de peticiones (Estrategia: Cache First, then Network)
self.addEventListener('fetch', function(event) {
    // Ignoramos peticiones que no sean GET o esquemas no soportados
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                // Si existe en caché, lo devolvemos
                if (response) {
                    return response;
                }
                // Si no, lo pedimos a internet
                return fetch(event.request);
            })
    );
});
