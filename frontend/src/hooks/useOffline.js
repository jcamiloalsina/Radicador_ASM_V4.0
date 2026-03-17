import { useState, useEffect, useCallback } from 'react';

// IndexedDB for offline data storage - UNIFICADA con offlineDB.js
const DB_NAME = 'asomunicipios_offline';
const DB_VERSION = 7; // Incrementado para incluir nuevos stores

const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Store for cached predios (compatible con offlineDB.js)
      if (!db.objectStoreNames.contains('predios_offline')) {
        const prediosStore = db.createObjectStore('predios_offline', { keyPath: 'id' });
        prediosStore.createIndex('municipio', 'municipio', { unique: false });
        prediosStore.createIndex('codigo_predial_nacional', 'codigo_predial_nacional', { unique: false });
      }
      
      // Store legacy 'predios' - mantener compatibilidad
      if (!db.objectStoreNames.contains('predios')) {
        const prediosStoreLegacy = db.createObjectStore('predios', { keyPath: 'id' });
        prediosStoreLegacy.createIndex('municipio', 'municipio', { unique: false });
        prediosStoreLegacy.createIndex('codigo_predial_nacional', 'codigo_predial_nacional', { unique: false });
      }
      
      // Store for cached petitions
      if (!db.objectStoreNames.contains('petitions')) {
        const petitionsStore = db.createObjectStore('petitions', { keyPath: 'id' });
        petitionsStore.createIndex('estado', 'estado', { unique: false });
        petitionsStore.createIndex('tipo_tramite', 'tipo_tramite', { unique: false });
        petitionsStore.createIndex('radicado', 'radicado', { unique: false });
        petitionsStore.createIndex('fecha_radicacion', 'fecha_radicacion', { unique: false });
      }
      
      // Store for cached map tiles
      if (!db.objectStoreNames.contains('mapTiles')) {
        db.createObjectStore('mapTiles', { keyPath: 'url' });
      }
      
      // Store for user preferences
      if (!db.objectStoreNames.contains('preferences')) {
        db.createObjectStore('preferences', { keyPath: 'key' });
      }
      
      // Stores de offlineDB.js
      if (!db.objectStoreNames.contains('geometrias_offline')) {
        const geometriasStore = db.createObjectStore('geometrias_offline', { keyPath: 'id' });
        geometriasStore.createIndex('municipio', 'municipio', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('cambios_pendientes')) {
        const cambiosStore = db.createObjectStore('cambios_pendientes', { keyPath: 'id' });
        cambiosStore.createIndex('tipo', 'tipo', { unique: false });
        cambiosStore.createIndex('fecha', 'fecha', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('visitas_pendientes')) {
        db.createObjectStore('visitas_pendientes', { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains('config_offline')) {
        db.createObjectStore('config_offline', { keyPath: 'key' });
      }
      
      if (!db.objectStoreNames.contains('proyectos_offline')) {
        const proyectosStore = db.createObjectStore('proyectos_offline', { keyPath: 'id' });
        proyectosStore.createIndex('municipio', 'municipio', { unique: false });
      }
    };
  });
};

// Check if Service Worker cache is ready
const checkCacheStatus = async () => {
  if (!('caches' in window)) {
    return { ready: false, reason: 'Cache API no soportado' };
  }
  
  try {
    const cacheNames = await caches.keys();
    const hasStaticCache = cacheNames.some(name => name.includes('asomunicipios-static'));
    const hasDataCache = cacheNames.some(name => name.includes('asomunicipios-data'));
    
    if (!hasStaticCache) {
      return { 
        ready: false, 
        reason: 'Archivos de la aplicación no cacheados',
        staticCached: false,
        dataCached: hasDataCache
      };
    }
    
    // Check if critical files are cached
    const staticCache = await caches.open(cacheNames.find(name => name.includes('asomunicipios-static')));
    const indexCached = await staticCache.match('/index.html');
    
    return {
      ready: !!indexCached,
      reason: indexCached ? 'Listo para uso offline' : 'Página principal no cacheada',
      staticCached: hasStaticCache,
      dataCached: hasDataCache,
      cacheNames: cacheNames
    };
  } catch (error) {
    console.error('Error checking cache status:', error);
    return { ready: false, reason: 'Error verificando caché' };
  }
};

export function useOffline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineData, setOfflineData] = useState({
    prediosCount: 0,
    petitionsCount: 0,
    proyectosCount: 0,
    geometriasCount: 0,
    lastSync: null,
    lastPetitionsSync: null
  });
  const [cacheStatus, setCacheStatus] = useState({
    ready: false,
    checking: true,
    reason: 'Verificando...',
    staticCached: false,
    dataCached: false
  });
  const [swRegistered, setSwRegistered] = useState(false);

  // Definir funciones antes del useEffect
  const checkCacheReady = useCallback(async () => {
    setCacheStatus(prev => ({ ...prev, checking: true }));
    const status = await checkCacheStatus();
    setCacheStatus({ ...status, checking: false });
  }, []);

  const loadOfflineStats = useCallback(async () => {
    try {
      let prediosCount = 0;
      let petitionsCount = 0;
      let proyectosCount = 0;
      let geometriasCount = 0;
      let lastSync = null;
      let lastPetitionsSync = null;
      
      // Leer stats directamente desde IndexedDB (fuente única de verdad)
      try {
        const db = await openDB();
        
        // Count predios from main DB
        if (db.objectStoreNames.contains('predios')) {
          const prediosTx = db.transaction('predios', 'readonly');
          const prediosStore = prediosTx.objectStore('predios');
          const mainPrediosCount = await new Promise((resolve) => {
            const request = prediosStore.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(0);
          });
          prediosCount += mainPrediosCount;
        }
        
        // Count petitions
        if (db.objectStoreNames.contains('petitions')) {
          const petitionsTx = db.transaction('petitions', 'readonly');
          const petitionsStore = petitionsTx.objectStore('petitions');
          petitionsCount = await new Promise((resolve) => {
            const request = petitionsStore.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(0);
          });
        }
        
        // Get preferences
        if (db.objectStoreNames.contains('preferences')) {
          const prefTx = db.transaction('preferences', 'readonly');
          const prefStore = prefTx.objectStore('preferences');
          lastSync = await new Promise((resolve) => {
            const request = prefStore.get('lastSync');
            request.onsuccess = () => resolve(request.result?.value);
            request.onerror = () => resolve(null);
          });
          lastPetitionsSync = await new Promise((resolve) => {
            const request = prefStore.get('lastPetitionsSync');
            request.onsuccess = () => resolve(request.result?.value);
            request.onerror = () => resolve(null);
          });
        }
      } catch (e) {
        console.log('Error reading main offline DB:', e);
      }
      
      // IMPORTANTE: Leer de offlineDB.js (asomunicipios_offline_v2) que es donde se guardan
      // los predios del visor de actualización
      try {
        // Detectar versión existente de la DB v2 para no provocar upgrade
        let v2Version = 0;
        if (indexedDB.databases) {
          const dbs = await indexedDB.databases();
          const found = dbs.find(d => d.name === 'asomunicipios_offline_v2');
          v2Version = found?.version || 0;
        } else {
          v2Version = 2; // Fallback: asumir versión actual
        }

        if (v2Version === 0) {
          // DB no existe, no intentar abrir
          throw new Error('v2 DB does not exist');
        }

        const v2DB = await new Promise((resolve) => {
          const request = indexedDB.open('asomunicipios_offline_v2', v2Version);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
          request.onupgradeneeded = () => {
            request.transaction.abort();
            resolve(null);
          };
        });
        
        if (v2DB) {
          // Contar predios de la DB v2
          if (v2DB.objectStoreNames.contains('predios_offline')) {
            try {
              const tx = v2DB.transaction('predios_offline', 'readonly');
              const store = tx.objectStore('predios_offline');
              const v2PrediosCount = await new Promise((resolve) => {
                const request = store.count();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => resolve(0);
              });
              prediosCount += v2PrediosCount;
              console.log('[useOffline] Found', v2PrediosCount, 'predios in v2 DB (offlineDB.js)');
              
              if (v2PrediosCount > 0 && !lastSync) {
                lastSync = new Date().toISOString();
              }
            } catch (txError) {
              console.log('Error reading v2 predios_offline:', txError.message);
            }
          }
          
          // Contar geometrías de la DB v2
          if (v2DB.objectStoreNames.contains('geometrias_offline')) {
            try {
              const txGeo = v2DB.transaction('geometrias_offline', 'readonly');
              const storeGeo = txGeo.objectStore('geometrias_offline');
              const v2GeoCount = await new Promise((resolve) => {
                const request = storeGeo.count();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => resolve(0);
              });
              geometriasCount += v2GeoCount;
              console.log('[useOffline] Found', v2GeoCount, 'geometrias in v2 DB');
            } catch (txError) {
              console.log('Error reading v2 geometrias_offline:', txError.message);
            }
          }
          
          // Contar proyectos de la DB v2
          if (v2DB.objectStoreNames.contains('proyectos_offline')) {
            try {
              const txProj = v2DB.transaction('proyectos_offline', 'readonly');
              const storeProj = txProj.objectStore('proyectos_offline');
              const v2ProjCount = await new Promise((resolve) => {
                const request = storeProj.count();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => resolve(0);
              });
              proyectosCount += v2ProjCount;
            } catch (txError) {
              console.log('Error reading v2 proyectos_offline:', txError.message);
            }
          }
          
          v2DB.close();
        }
      } catch (e) {
        console.log('[useOffline] v2 DB not available:', e.message);
      }
      
      // También leer de la base de datos secundaria (asomunicipios_offline) usada por useOfflineSync
      try {
        // Primero verificar si la DB existe usando databases() si está disponible
        let dbExists = false;
        let dbVersion = 0;
        if (indexedDB.databases) {
          const dbs = await indexedDB.databases();
          const foundDb = dbs.find(db => db.name === 'asomunicipios_offline');
          dbExists = !!foundDb;
          dbVersion = foundDb?.version || 0;
        } else {
          // Fallback: asumir que puede existir
          dbExists = true;
        }
        
        if (!dbExists) {
          console.log('[useOffline] Secondary DB does not exist yet');
        } else {
          // Abrir la DB existente con la versión correcta
          const secondaryDB = await new Promise((resolve, reject) => {
            // Abrir con la versión existente para evitar conflictos
            const request = dbVersion > 0 
              ? indexedDB.open('asomunicipios_offline', dbVersion)
              : indexedDB.open('asomunicipios_offline');
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => {
              console.log('[useOffline] Error opening secondary DB:', event.target.error?.message);
              resolve(null);
            };
            request.onupgradeneeded = (event) => {
              // Si la DB no existía, se está creando - cancelar y no crear una DB vacía
              if (event.oldVersion === 0) {
                request.transaction.abort();
                resolve(null);
              }
            };
          }).catch((err) => {
            console.log('[useOffline] Secondary DB error:', err?.message);
            return null;
          });
          
          if (!secondaryDB) {
            console.log('[useOffline] Secondary DB not initialized yet');
          } else {
            // Contar predios - verificar que el store existe
            if (secondaryDB.objectStoreNames.contains('predios_offline')) {
              try {
                const tx = secondaryDB.transaction('predios_offline', 'readonly');
                const store = tx.objectStore('predios_offline');
                const secondaryCount = await new Promise((resolve) => {
                  const request = store.count();
                  request.onsuccess = () => resolve(request.result);
                  request.onerror = () => resolve(0);
                });
                prediosCount += secondaryCount;
                console.log('[useOffline] Found', secondaryCount, 'predios in secondary DB');
                
                if (secondaryCount > 0 && !lastSync) {
                  lastSync = new Date().toISOString();
                }
              } catch (txError) {
                console.log('Error reading predios_offline:', txError.message);
              }
            }
            
            // Contar proyectos - verificar que el store existe
            if (secondaryDB.objectStoreNames.contains('proyectos_offline')) {
              try {
                const txProyectos = secondaryDB.transaction('proyectos_offline', 'readonly');
                const storeProyectos = txProyectos.objectStore('proyectos_offline');
                const secProjCount = await new Promise((resolve) => {
                  const request = storeProyectos.count();
                  request.onsuccess = () => resolve(request.result);
                  request.onerror = () => resolve(0);
                });
                proyectosCount += secProjCount;
              } catch (txError) {
                console.log('Error reading proyectos_offline:', txError.message);
              }
            }
            
            // Contar geometrías offline (solo las del Visor de Predios, no las de proyectos)
            if (secondaryDB.objectStoreNames.contains('geometrias_offline')) {
              try {
                const txGeometrias = secondaryDB.transaction('geometrias_offline', 'readonly');
                const storeGeometrias = txGeometrias.objectStore('geometrias_offline');
                const secGeoCount = await new Promise((resolve) => {
                  let count = 0;
                  const cursorRequest = storeGeometrias.openCursor();
                  
                  cursorRequest.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                      // Solo contar geometrías del Visor (las que empiezan con "visor_")
                      const recordId = cursor.value.id || '';
                      const proyectoId = cursor.value.proyecto_id || '';
                      if (recordId.startsWith('visor_') || proyectoId.startsWith('visor_')) {
                        count++;
                      }
                      cursor.continue();
                    } else {
                      resolve(count);
                    }
                  };
                  cursorRequest.onerror = () => resolve(0);
                });
                geometriasCount += secGeoCount;
              } catch (txError) {
                console.log('Error reading geometrias_offline:', txError.message);
              }
            }
            
            secondaryDB.close();
          }
        }
      } catch (e) {
        // Ignorar error si la DB no existe
        console.log('Secondary offline DB error:', e.message);
      }
      
      setOfflineData({ prediosCount, petitionsCount, proyectosCount, geometriasCount, lastSync, lastPetitionsSync });
    } catch (error) {
      console.error('Error loading offline stats:', error);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    // Escuchar evento de actualización de datos offline
    const handleOfflineDataUpdate = (event) => {
      console.log('[useOffline] Evento offlineDataUpdated recibido:', event.detail);
      // Pequeño delay para asegurar que IndexedDB termine la transacción
      setTimeout(() => loadOfflineStats(), 500);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offlineDataUpdated', handleOfflineDataUpdate);

    // Load offline data stats (using setTimeout to avoid synchronous setState)
    const statsTimer = setTimeout(() => loadOfflineStats(), 0);
    
    // Check cache status
    const cacheTimer = setTimeout(() => checkCacheReady(), 0);
    
    // Re-verificar stats cada 10 segundos (para cuando el usuario está en una página)
    const periodicCheck = setInterval(() => {
      loadOfflineStats();
    }, 10000);
    
    // Check if Service Worker is registered
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => {
        setSwRegistered(true);
        // Re-check cache after SW is ready
        setTimeout(checkCacheReady, 1000);
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offlineDataUpdated', handleOfflineDataUpdate);
      clearTimeout(statsTimer);
      clearTimeout(cacheTimer);
      clearInterval(periodicCheck);
    };
  }, [loadOfflineStats, checkCacheReady]);

  // Force cache critical resources
  const forceCacheResources = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      return false;
    }
    
    try {
      // Trigger SW to cache resources
      const cache = await caches.open('asomunicipios-static-v2');
      const criticalResources = [
        '/',
        '/index.html',
        '/manifest.json',
        '/logo-asomunicipios.png'
      ];
      
      await Promise.allSettled(
        criticalResources.map(url => 
          fetch(url).then(response => {
            if (response.ok) {
              return cache.put(url, response);
            }
          })
        )
      );
      
      // Re-check status
      await checkCacheReady();
      return true;
    } catch (error) {
      console.error('Error forcing cache:', error);
      return false;
    }
  }, []);

  // Save predios for offline use
  const savePrediosOffline = useCallback(async (predios) => {
    try {
      const db = await openDB();
      const tx = db.transaction('predios', 'readwrite');
      const store = tx.objectStore('predios');
      
      for (const predio of predios) {
        store.put(predio);
      }
      
      // Save last sync time
      const prefTx = db.transaction('preferences', 'readwrite');
      const prefStore = prefTx.objectStore('preferences');
      prefStore.put({ key: 'lastSync', value: new Date().toISOString() });
      
      await loadOfflineStats();
      console.log(`[Offline] Guardados ${predios.length} predios para uso offline`);
      return true;
    } catch (error) {
      console.error('Error saving predios offline:', error);
      return false;
    }
  }, []);

  // Get predios from offline storage
  const getPrediosOffline = useCallback(async (municipio = null) => {
    try {
      const db = await openDB();
      const tx = db.transaction('predios', 'readonly');
      const store = tx.objectStore('predios');
      
      if (municipio) {
        const index = store.index('municipio');
        return new Promise((resolve) => {
          const request = index.getAll(municipio);
          request.onsuccess = () => resolve(request.result);
        });
      }
      
      return new Promise((resolve) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
      });
    } catch (error) {
      console.error('Error getting offline predios:', error);
      return [];
    }
  }, []);

  // Get single predio by ID
  const getPredioOffline = useCallback(async (id) => {
    try {
      const db = await openDB();
      const tx = db.transaction('predios', 'readonly');
      const store = tx.objectStore('predios');
      
      return new Promise((resolve) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
      });
    } catch (error) {
      console.error('Error getting offline predio:', error);
      return null;
    }
  }, []);

  // Clear offline data
  const clearOfflineData = useCallback(async () => {
    try {
      const db = await openDB();
      const tx = db.transaction('predios', 'readwrite');
      const store = tx.objectStore('predios');
      store.clear();
      
      // Also clear petitions
      if (db.objectStoreNames.contains('petitions')) {
        const petitionsTx = db.transaction('petitions', 'readwrite');
        const petitionsStore = petitionsTx.objectStore('petitions');
        petitionsStore.clear();
      }
      
      await loadOfflineStats();
      console.log('[Offline] Datos offline eliminados');
      return true;
    } catch (error) {
      console.error('Error clearing offline data:', error);
      return false;
    }
  }, []);

  // ============ PETITIONS OFFLINE FUNCTIONS ============
  
  // Save petitions for offline use
  const savePetitionsOffline = useCallback(async (petitions) => {
    try {
      const db = await openDB();
      
      // Save petitions
      const tx = db.transaction('petitions', 'readwrite');
      const store = tx.objectStore('petitions');
      
      for (const petition of petitions) {
        store.put(petition);
      }
      
      // Wait for transaction to complete
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      
      // Save last sync time for petitions
      const prefTx = db.transaction('preferences', 'readwrite');
      const prefStore = prefTx.objectStore('preferences');
      prefStore.put({ key: 'lastPetitionsSync', value: new Date().toISOString() });
      
      await new Promise((resolve, reject) => {
        prefTx.oncomplete = resolve;
        prefTx.onerror = () => reject(prefTx.error);
      });
      
      // Refresh stats after saving
      await loadOfflineStats();
      console.log(`[Offline] Guardadas ${petitions.length} peticiones para uso offline`);
      return true;
    } catch (error) {
      console.error('Error saving petitions offline:', error);
      return false;
    }
  }, []);

  // Get all petitions from offline storage
  const getPetitionsOffline = useCallback(async (filters = {}) => {
    try {
      const db = await openDB();
      
      if (!db.objectStoreNames.contains('petitions')) {
        return [];
      }
      
      const tx = db.transaction('petitions', 'readonly');
      const store = tx.objectStore('petitions');
      
      let results = await new Promise((resolve) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      });
      
      // Apply filters
      if (filters.estado) {
        results = results.filter(p => p.estado === filters.estado);
      }
      if (filters.tipo_tramite) {
        results = results.filter(p => p.tipo_tramite === filters.tipo_tramite);
      }
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        results = results.filter(p => 
          p.radicado?.toLowerCase().includes(searchLower) ||
          p.solicitante?.toLowerCase().includes(searchLower) ||
          p.descripcion?.toLowerCase().includes(searchLower)
        );
      }
      
      // Sort by date (most recent first)
      results.sort((a, b) => new Date(b.fecha_radicacion) - new Date(a.fecha_radicacion));
      
      return results;
    } catch (error) {
      console.error('Error getting offline petitions:', error);
      return [];
    }
  }, []);

  // Get single petition by ID
  const getPetitionOffline = useCallback(async (id) => {
    try {
      const db = await openDB();
      
      if (!db.objectStoreNames.contains('petitions')) {
        return null;
      }
      
      const tx = db.transaction('petitions', 'readonly');
      const store = tx.objectStore('petitions');
      
      return new Promise((resolve) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      });
    } catch (error) {
      console.error('Error getting offline petition:', error);
      return null;
    }
  }, []);

  // Sync all data (predios + petitions)
  const syncAllData = useCallback(async (fetchPredios, fetchPetitions) => {
    const results = { predios: false, petitions: false };
    
    try {
      // Sync predios
      if (fetchPredios) {
        const prediosData = await fetchPredios();
        if (prediosData && prediosData.length > 0) {
          results.predios = await savePrediosOffline(prediosData);
        }
      }
      
      // Sync petitions
      if (fetchPetitions) {
        const petitionsData = await fetchPetitions();
        if (petitionsData && petitionsData.length > 0) {
          results.petitions = await savePetitionsOffline(petitionsData);
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error syncing all data:', error);
      return results;
    }
  }, [savePrediosOffline, savePetitionsOffline]);

  return {
    isOnline,
    offlineData,
    cacheStatus,
    swRegistered,
    // Predios
    savePrediosOffline,
    getPrediosOffline,
    getPredioOffline,
    // Petitions
    savePetitionsOffline,
    getPetitionsOffline,
    getPetitionOffline,
    // General
    syncAllData,
    clearOfflineData,
    refreshStats: loadOfflineStats,
    checkCacheReady,
    forceCacheResources
  };
}

export default useOffline;
