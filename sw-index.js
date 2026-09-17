// Archivo: sw-index.js

// ⚠️ IMPORTANTE: Cambia esta versión CADA VEZ que hagas cambios
// Formato: pibrisa-index-vX.Y.Z
const CACHE_NAME_INDEX = 'pibrisa-index-v8.3.3'; 

// Extraer solo la versión (para mostrarla al usuario)
const APP_VERSION = CACHE_NAME_INDEX.replace('pibrisa-index-', '');

const urlsToCacheIndex = [
    './',
    './index.html',
    './QR.html',
    
    './manifest.json',
    './Pag - Reportería.html',
    './Reporte de Supervisión.html',
    './Control de Llaves.html',
    './Pag - Residuos.html',
    './Registro de Residuos.html',
    './Registro de Trazabilidad & Volumen de Residuos.html',   
    './Imágenes/Icono.png',
    './Control de PEPS de Insumos.html',
    
    './Liberación de Responsabilidad/Pag - Liberación de Responsabilidad.html',
    './Liberación de Responsabilidad/Liberación de Responsabilidad.html',
    './Pruebas Microbiológicas/Pag - Pruebas Microbiológicas.html',
    './Pruebas Microbiológicas/Registro de Pruebas Microbiológicas.html',

    'https://raw.githubusercontent.com/jeancarlozelaya/CCG/refs/heads/main/Im%C3%A1genes/Otros/HojadeLiberaci%C3%B3n.jpg', 
    'https://unpkg.com/dexie/dist/dexie.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap',
    'https://cdn.jsdelivr.net/npm/sweetalert2@11',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://code.jquery.com/jquery-3.6.0.min.js'
];

// ============================================
// NUEVO: Escuchar mensajes desde la página
// ============================================
self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'GET_VERSION') {
        // Responder con la versión actual
        if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({
                type: 'VERSION_INFO',
                version: APP_VERSION
            });
        }
    }
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME_INDEX)
            .then(function(cache) {
                return cache.addAll(urlsToCacheIndex);
            })
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheName !== CACHE_NAME_INDEX && cacheName.startsWith('pibrisa-index')) {
                        console.log('Eliminando caché antigua:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', function(event) {
    if (event.request.method !== 'GET') return;
    
    // No cachear las peticiones al propio sw-index.js ni a version.json
    const url = event.request.url;
    if (url.includes('sw-index.js') || url.includes('version.json')) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request).then(function(response) {
            return response || fetch(event.request);
        })
    );
});
