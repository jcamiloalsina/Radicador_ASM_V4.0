// Service Worker para modo offline - Asomunicipios Catastro
const CACHE_NAME = 'asomunicipios-cache-v2';
const OFFLINE_DATA_CACHE = 'asomunicipios-offline-data';

// Recursos estáticos a cachear siempre
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
];

// Dominios de tiles de mapa a cachear
const MAP_TILE_DOMAINS = [
  'server.arcgisonline.com',
  'mt0.google.com',
  'mt1.google.com',
  'mt2.google.com',
  'mt3.google.com',
  'tile.openstreetmap.org'
];

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== OFFLINE_DATA_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - Estrategia de caché
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Para tiles de mapa - Cache first, network fallback
  if (MAP_TILE_DOMAINS.some(domain => url.hostname.includes(domain))) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            // Actualizar en background
            fetch(event.request).then((networkResponse) => {
              if (networkResponse.ok) {
                cache.put(event.request, networkResponse.clone());
              }
            }).catch(() => {});
            return cachedResponse;
          }
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            return new Response('Tile no disponible offline', { status: 503 });
          });
        });
      })
    );
    return;
  }
  
  // Para API calls - Network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cachear respuestas GET exitosas
          if (event.request.method === 'GET' && response.ok) {
            const responseClone = response.clone();
            caches.open(OFFLINE_DATA_CACHE).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Si está offline, buscar en caché
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return new Response(
              JSON.stringify({ error: 'Sin conexión', offline: true }),
              { 
                status: 503, 
                headers: { 'Content-Type': 'application/json' }
              }
            );
          });
        })
    );
    return;
  }
  
  // Para otros recursos - Cache first
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        if (response.ok && event.request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      });
    })
  );
});

// Mensaje para sincronización manual
self.addEventListener('message', (event) => {
  if (event.data.type === 'CACHE_PREDIOS') {
    const { predios, geometrias, proyectoId } = event.data;
    
    caches.open(OFFLINE_DATA_CACHE).then((cache) => {
      // Cachear datos de predios
      const prediosResponse = new Response(JSON.stringify({ predios }), {
        headers: { 'Content-Type': 'application/json' }
      });
      cache.put(`/api/actualizacion/proyectos/${proyectoId}/predios`, prediosResponse);
      
      // Cachear geometrías
      if (geometrias) {
        const geomResponse = new Response(JSON.stringify(geometrias), {
          headers: { 'Content-Type': 'application/json' }
        });
        cache.put(`/api/actualizacion/proyectos/${proyectoId}/geometrias`, geomResponse);
      }
      
      console.log(`[SW] Cacheados ${predios?.length || 0} predios para offline`);
    });
  }
  
  if (event.data.type === 'CLEAR_OFFLINE_CACHE') {
    caches.delete(OFFLINE_DATA_CACHE).then(() => {
      console.log('[SW] Cache offline limpiado');
    });
  }
});

// Background sync para sincronizar cambios pendientes
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-changes') {
    event.waitUntil(syncPendingChanges());
  }
});

async function syncPendingChanges() {
  // Esta función se llamará cuando haya conexión
  // Los cambios pendientes se manejan desde IndexedDB en el frontend
  console.log('[SW] Sincronizando cambios pendientes...');
}
