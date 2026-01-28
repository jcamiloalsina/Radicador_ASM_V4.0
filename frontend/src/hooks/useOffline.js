import { useState, useEffect, useCallback } from 'react';

// IndexedDB for offline data storage
const DB_NAME = 'asomunicipios-offline';
const DB_VERSION = 2; // Increased version for petitions store

const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Store for cached predios
      if (!db.objectStoreNames.contains('predios')) {
        const prediosStore = db.createObjectStore('predios', { keyPath: 'id' });
        prediosStore.createIndex('municipio', 'municipio', { unique: false });
        prediosStore.createIndex('codigo_predial_nacional', 'codigo_predial_nacional', { unique: false });
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

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    // Escuchar evento de actualización de datos offline
    const handleOfflineDataUpdate = () => {
      console.log('[useOffline] Datos offline actualizados, recargando stats...');
      loadOfflineStats();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offlineDataUpdated', handleOfflineDataUpdate);

    // Load offline data stats
    loadOfflineStats();
    
    // Check cache status
    checkCacheReady();
    
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
    };
  }, []);

  const checkCacheReady = async () => {
    setCacheStatus(prev => ({ ...prev, checking: true }));
    const status = await checkCacheStatus();
    setCacheStatus({ ...status, checking: false });
  };

  const loadOfflineStats = async () => {
    try {
      let prediosCount = 0;
      let petitionsCount = 0;
      let proyectosCount = 0;
      let lastSync = null;
      let lastPetitionsSync = null;
      
      // Intentar leer de la base de datos principal (asomunicipios-offline)
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
      
      // También leer de la base de datos secundaria (asomunicipios_offline) usada por useOfflineSync
      try {
        const secondaryDB = await new Promise((resolve, reject) => {
          const request = indexedDB.open('asomunicipios_offline', 3);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
          request.onupgradeneeded = (event) => {
            // Crear stores si es necesario durante el upgrade
            const db = event.target.result;
            if (!db.objectStoreNames.contains('predios_offline')) {
              const prediosStore = db.createObjectStore('predios_offline', { keyPath: 'id' });
              prediosStore.createIndex('proyecto_id', 'proyecto_id', { unique: false });
              prediosStore.createIndex('codigo_predial', 'codigo_predial', { unique: false });
              prediosStore.createIndex('municipio', 'municipio', { unique: false });
            }
            if (!db.objectStoreNames.contains('proyectos_offline')) {
              const proyectosStore = db.createObjectStore('proyectos_offline', { keyPath: 'id' });
              proyectosStore.createIndex('municipio', 'municipio', { unique: false });
              proyectosStore.createIndex('estado', 'estado', { unique: false });
            }
          };
        });
        
        // Contar predios - verificar que el store existe
        if (secondaryDB && secondaryDB.objectStoreNames.contains('predios_offline')) {
          try {
            const tx = secondaryDB.transaction('predios_offline', 'readonly');
            const store = tx.objectStore('predios_offline');
            const secondaryCount = await new Promise((resolve) => {
              const request = store.count();
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => resolve(0);
            });
            prediosCount += secondaryCount;
            
            if (secondaryCount > 0 && !lastSync) {
              lastSync = new Date().toISOString();
            }
          } catch (txError) {
            console.log('Error reading predios_offline:', txError.message);
          }
        }
        
        // Contar proyectos - verificar que el store existe
        if (secondaryDB && secondaryDB.objectStoreNames.contains('proyectos_offline')) {
          try {
            const txProyectos = secondaryDB.transaction('proyectos_offline', 'readonly');
            const storeProyectos = txProyectos.objectStore('proyectos_offline');
            proyectosCount = await new Promise((resolve) => {
              const request = storeProyectos.count();
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => resolve(0);
            });
          } catch (txError) {
            console.log('Error reading proyectos_offline:', txError.message);
          }
        }
        
        if (secondaryDB) secondaryDB.close();
      } catch (e) {
        // Ignorar error si la DB no existe
        console.log('Secondary offline DB not available:', e.message);
      }
      
      setOfflineData({ prediosCount, petitionsCount, proyectosCount, lastSync, lastPetitionsSync });
    } catch (error) {
      console.error('Error loading offline stats:', error);
    }
  };

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
