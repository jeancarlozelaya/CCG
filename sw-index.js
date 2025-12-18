// Archivo: sw-index.js

// CAMBIAMOS LA VERSIÓN PARA QUE EL NAVEGADOR ACTUALICE LA CACHÉ SÍ O SÍ
const CACHE_NAME_INDEX = 'pibrisa-index-v2.0.6'; 

const urlsToCacheIndex = [
    './',
    './index.html',
    './manifest.json',
    './Pag - Reportería.html',
    './Reporte de Supervisión.html',
    './Liberación.html',
    './Control de Llaves.html',
    './Pag - Residuos.html',
    './Registro de Residuos.html',
    './Registro de Trazabilidad & Volumen de Residuos.html',   
    'Imágenes/Icono.png',
    
    // 1. LA IMAGEN DEL PDF (Asegúrate que la ruta sea exacta, mayúsculas y acentos importan)
    'https://raw.githubusercontent.com/jeancarlozelaya/CCG/refs/heads/main/Im%C3%A1genes/Otros/HojadeLiberaci%C3%B3n.jpg', 

    // 2. LIBRERÍA DEXIE (¡IMPORTANTE PARA QUE NO FALLE OFFLINE!)
    'https://unpkg.com/dexie/dist/dexie.js',

    // Otras librerías
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap',
    'https://cdn.jsdelivr.net/npm/sweetalert2@11',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', // También asegúrate de cachear jsPDF si no lo has hecho
    'https://code.jquery.com/jquery-3.6.0.min.js' // Y jQuery
];

// ... (El resto del código del Service Worker: install, activate, fetch se queda IGUAL)
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
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', function(event) {
    if (event.request.method !== 'GET') return;
    event.respondWith(
        caches.match(event.request).then(function(response) {
            return response || fetch(event.request);
        })
    );
});
