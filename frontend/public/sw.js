const CACHE_VERSION = 'v3';
const CACHE_NAME = `asomunicipios-${CACHE_VERSION}`;
const STATIC_CACHE = `asomunicipios-static-${CACHE_VERSION}`;
const DATA_CACHE = `asomunicipios-data-${CACHE_VERSION}`;
const MAP_CACHE = `asomunicipios-maps-${CACHE_VERSION}`;

// Configuración del caché de mapas
const MAP_CACHE_CONFIG = {
  maxTiles: 5000,           // Máximo ~50MB de tiles (aprox 10KB por tile)
  maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 días máximo
  cleanupInterval: 1000     // Limpiar cada 1000 nuevos tiles
};

// Contador de tiles para trigger de limpieza
let tileCounter = 0;

// Static assets to cache immediately (critical for offline)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo-asomunicipios.png',
  '/logo-blanco-corto.png',
  '/logo-blanco-largo.png'
];

// API endpoints to cache for offline use
const CACHEABLE_API_ROUTES = [
  '/api/predios',
  '/api/municipios',
  '/api/petitions',
  '/api/users/me'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker v2...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        // Cache each asset individually to avoid failing all if one fails
        return Promise.allSettled(
          STATIC_ASSETS.map(asset => 
            cache.add(asset).catch(err => console.log('[SW] Failed to cache:', asset, err))
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker v2...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return name.startsWith('asomunicipios-') && 
                   !name.includes(CACHE_VERSION);
          })
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle map tile requests (OpenStreetMap, etc.)
  if (isMapTileRequest(url)) {
    event.respondWith(handleMapTileRequest(request));
    return;
  }

  // Handle navigation requests (SPA)
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Handle static assets with cache-first strategy
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          // Cache static assets
          if (networkResponse.ok && shouldCacheStatic(url)) {
            const responseClone = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        });
      })
      .catch(() => {
        // Return offline fallback
        return new Response('Recurso no disponible offline', { status: 503 });
      })
  );
});

// Handle navigation requests for SPA
async function handleNavigationRequest(request) {
  try {
    // Try network first for navigation
    const networkResponse = await fetch(request);
    
    // Cache the response
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Navigation failed, serving cached index.html');
    
    // Serve cached index.html for SPA routing
    const cachedResponse = await caches.match('/index.html');
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Ultimate fallback
    return new Response(
      `<!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Asomunicipios - Sin Conexión</title>
        <style>
          body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f0fdf4; }
          .container { text-align: center; padding: 2rem; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 400px; }
          h1 { color: #009846; margin-bottom: 1rem; }
          p { color: #666; line-height: 1.6; }
          .icon { font-size: 4rem; margin-bottom: 1rem; }
          button { background: #009846; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px; margin-top: 1rem; }
          button:hover { background: #007a38; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">📡</div>
          <h1>Sin Conexión</h1>
          <p>No hay conexión a internet. Por favor, verifica tu conexión e intenta nuevamente.</p>
          <button onclick="window.location.reload()">Reintentar</button>
        </div>
      </body>
      </html>`,
      { 
        status: 200, 
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
}

// Handle API requests with network-first, cache-fallback strategy
async function handleApiRequest(request) {
  const url = new URL(request.url);
  
  // Check if this is a cacheable API route
  const isCacheable = CACHEABLE_API_ROUTES.some(route => url.pathname.includes(route));
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok && isCacheable) {
      const responseClone = networkResponse.clone();
      const cache = await caches.open(DATA_CACHE);
      await cache.put(request, responseClone);
      console.log('[SW] Cached API response:', url.pathname);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', url.pathname);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Serving from cache:', url.pathname);
      // Add header to indicate offline data
      const headers = new Headers(cachedResponse.headers);
      headers.set('X-Offline-Cache', 'true');
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers: headers
      });
    }
    
    // Return offline response for API
    return new Response(
      JSON.stringify({ 
        error: 'Sin conexión', 
        offline: true,
        message: 'No hay conexión a internet. Los datos mostrados pueden no estar actualizados.'
      }),
      { 
        status: 503, 
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Check if request is for map tiles
function isMapTileRequest(url) {
  const mapProviders = [
    'tile.openstreetmap.org',
    'tiles.stadiamaps.com',
    'server.arcgisonline.com',
    'cartodb-basemaps',
    'mt0.google.com',
    'mt1.google.com',
    'a.tile.',
    'b.tile.',
    'c.tile.'
  ];
  return mapProviders.some(provider => url.hostname.includes(provider) || url.href.includes(provider));
}

// Handle map tile requests with cache-first strategy
async function handleMapTileRequest(request) {
  const cache = await caches.open(MAP_CACHE);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    // Return cached tile but also update in background
    fetch(request).then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse);
      }
    }).catch(() => {});
    
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Return a placeholder or error for map tiles
    return new Response('', { status: 404 });
  }
}

// Check if static asset should be cached
function shouldCacheStatic(url) {
  const cacheableExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.woff', '.woff2', '.ico'];
  const cacheablePaths = ['/static/', '/assets/'];
  
  return cacheableExtensions.some(ext => url.pathname.endsWith(ext)) ||
         cacheablePaths.some(path => url.pathname.includes(path));
}

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_PREDIOS') {
    // Cache specific predios data
    const prediosData = event.data.payload;
    caches.open(DATA_CACHE).then((cache) => {
      const response = new Response(JSON.stringify(prediosData));
      cache.put('/api/predios/cached', response);
      console.log('[SW] Cached predios data for offline use');
    });
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      names.forEach((name) => {
        if (name.startsWith('asomunicipios-')) {
          caches.delete(name);
        }
      });
    });
    console.log('[SW] Cache cleared');
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background sync for offline actions (future feature)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    console.log('[SW] Background sync triggered');
    // Handle background sync when online
  }
});

console.log('[SW] Service Worker v2 loaded');
