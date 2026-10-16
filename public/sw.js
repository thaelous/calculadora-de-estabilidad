// Service Worker - Estabilidad Montacargas | Comunicación Global
// Estrategia Offline-First (Cache-First)

const CACHE_NAME = 'comglob-montacargas-v1';

// Recursos críticos a pre-cachear durante la instalación
const STATIC_ASSETS = [
  './',
  './index.html',
  '/index.html',
  '/manifest.json',
  '/comgico.png',
  '/comglob.png',
  'public/comgico.png',
  'public/comglob.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700;800&display=swap'
];

// Evento Install: Descarga y guarda en caché los recursos estáticos iniciales
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Usar allSettled o agregar uno a uno para evitar que falle si un recurso externo varía
      for (const asset of STATIC_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn(`[SW] No se pudo precachear ${asset}:`, err);
        }
      }
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Evento Activate: Limpieza de versiones de caché antiguas y toma de control inmediato
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Eliminando caché obsoleta:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Evento Fetch: Estrategia Cache-First
// Responde desde la caché primero. Si no existe, consulta la red y almacena en caché para uso offline.
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Solo interceptar peticiones GET http / https
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Encontrado en caché: entrega inmediata sin consumir datos
        return cachedResponse;
      }

      // No está en caché: ir a la red
      return fetch(request)
        .then((networkResponse) => {
          // Si la respuesta es válida, clonar y guardar en caché para futuras visitas offline
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Si falla la red (Modo avión / Sin conexión):
          // Si es una navegación HTML, retornar la app principal desde la caché
          if (request.headers.get('accept')?.includes('text/html')) {
            const fallback = await caches.match('/index.html') || await caches.match('./index.html') || await caches.match('./');
            if (fallback) return fallback;
          }
          // Si es una imagen, intentar retornar el logo o icono
          if (request.destination === 'image') {
            return (await caches.match('/comgico.png')) || (await caches.match('public/comgico.png'));
          }
          return new Response('Sin conexión a Internet', {
            status: 503,
            statusText: 'Offline',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        });
    })
  );
});
