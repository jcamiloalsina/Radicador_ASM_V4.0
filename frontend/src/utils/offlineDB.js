// Módulo de gestión de datos offline con IndexedDB
// VERSIÓN MEJORADA - Persistencia robusta y sincronización en segundo plano

const DB_NAME = 'asomunicipios_offline_v2';
const DB_VERSION = 2; // Incrementar para agregar nuevo store de construcciones
const SCHEMA_VERSION = '3.1.0'; // Actualizado para incluir construcciones

// Stores en IndexedDB
const STORES = {
  PREDIOS: 'predios_offline',
  GEOMETRIAS: 'geometrias_offline',
  CONSTRUCCIONES: 'construcciones_offline', // NUEVO: Para persistir construcciones/mejoras
  CAMBIOS_PENDIENTES: 'cambios_pendientes',
  VISITAS_PENDIENTES: 'visitas_pendientes',
  CONFIG: 'config_offline',
  PROYECTOS: 'proyectos_offline',
  SYNC_QUEUE: 'sync_queue' // Cola de sincronización
};

let db = null;
let dbInitialized = false;
let dbInitPromise = null;

// Verificar si necesita migración de esquema (NO borrar datos innecesariamente)
async function checkSchemaMigration() {
  try {
    const storedSchema = localStorage.getItem('asomunicipios_schema_version');
    if (storedSchema !== SCHEMA_VERSION) {
      console.log(`[OfflineDB] Nueva estructura detectada (${storedSchema} -> ${SCHEMA_VERSION})`);
      localStorage.setItem('asomunicipios_schema_version', SCHEMA_VERSION);
      // NO borrar datos - solo actualizar la versión
      return true;
    }
    return false;
  } catch (e) {
    console.log('[OfflineDB] Error verificando esquema:', e);
    return false;
  }
}

// Función para eliminar la base de datos (solo en caso de error crítico)
async function deleteDatabase() {
  return new Promise((resolve) => {
    db = null;
    dbInitialized = false;
    const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
    deleteRequest.onsuccess = () => {
      console.log('[OfflineDB] Base de datos eliminada');
      resolve(true);
    };
    deleteRequest.onerror = () => resolve(false);
    deleteRequest.onblocked = () => {
      if (db) { db.close(); db = null; }
      resolve(false);
    };
  });
}

// Inicializar la base de datos (singleton - robusto)
export async function initOfflineDB() {
  if (typeof indexedDB === 'undefined') {
    console.warn('[OfflineDB] IndexedDB no disponible');
    return null;
  }
  
  if (db && dbInitialized) return db;
  
  if (dbInitPromise) {
    try {
      const result = await Promise.race([
        dbInitPromise,
        new Promise((resolve) => setTimeout(() => resolve(null), 30000)) // 30s timeout
      ]);
      if (result) return result;
      dbInitPromise = null;
    } catch (e) {
      dbInitPromise = null;
    }
  }
  
  dbInitPromise = (async () => {
    try {
      await checkSchemaMigration();
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn('[OfflineDB] Timeout al abrir DB (30s)');
          resolve(null);
        }, 30000);
        
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = async (event) => {
          clearTimeout(timeout);
          const error = event.target.error;
          console.warn('[OfflineDB] Error:', error?.message);
          
          // Solo borrar si hay error de versión
          if (error?.name === 'VersionError') {
            await deleteDatabase();
            const retry = indexedDB.open(DB_NAME, DB_VERSION);
            retry.onsuccess = () => { db = retry.result; dbInitialized = true; resolve(db); };
            retry.onerror = () => resolve(null);
            retry.onupgradeneeded = (e) => createAllStores(e.target.result);
          } else {
            resolve(null);
          }
        };

        request.onsuccess = () => {
          clearTimeout(timeout);
          db = request.result;
          dbInitialized = true;
          console.log('[OfflineDB] Base de datos lista');
          resolve(db);
        };

        request.onupgradeneeded = (event) => {
          createAllStores(event.target.result);
        };
        
        request.onblocked = () => {
          console.log('[OfflineDB] Upgrade bloqueado');
        };
      });
    } catch (error) {
      console.warn('[OfflineDB] Error crítico:', error.message);
      dbInitPromise = null;
      return null;
    }
  })();
  
  return dbInitPromise;
}

// Crear stores
function createAllStores(database) {
  const createStore = (name, keyPath, indexes = []) => {
    if (!database.objectStoreNames.contains(name)) {
      const store = database.createObjectStore(name, { keyPath, autoIncrement: keyPath === 'id' && name.includes('pendiente') });
      indexes.forEach(({ name: idxName, keyPath: idxPath, unique = false }) => {
        store.createIndex(idxName, idxPath, { unique });
      });
    }
  };

  createStore(STORES.PREDIOS, 'id', [
    { name: 'proyecto_id', keyPath: 'proyecto_id' },
    { name: 'codigo_predial', keyPath: 'codigo_predial' },
    { name: 'municipio', keyPath: 'municipio' },
    { name: 'estado_visita', keyPath: 'estado_visita' }
  ]);

  createStore(STORES.GEOMETRIAS, 'id', [
    { name: 'proyecto_id', keyPath: 'proyecto_id' },
    { name: 'codigo_predial', keyPath: 'codigo_predial' }
  ]);

  // NUEVO: Store para construcciones/mejoras
  createStore(STORES.CONSTRUCCIONES, 'id', [
    { name: 'proyecto_id', keyPath: 'proyecto_id' }
  ]);

  createStore(STORES.CAMBIOS_PENDIENTES, 'id', [
    { name: 'proyecto_id', keyPath: 'proyecto_id' },
    { name: 'tipo', keyPath: 'tipo' },
    { name: 'fecha', keyPath: 'fecha' },
    { name: 'sincronizado', keyPath: 'sincronizado' }
  ]);

  createStore(STORES.VISITAS_PENDIENTES, 'id', [
    { name: 'proyecto_id', keyPath: 'proyecto_id' },
    { name: 'codigo_predial', keyPath: 'codigo_predial' }
  ]);

  createStore(STORES.CONFIG, 'key', []);

  createStore(STORES.PROYECTOS, 'id', [
    { name: 'municipio', keyPath: 'municipio' },
    { name: 'estado', keyPath: 'estado' }
  ]);

  createStore(STORES.SYNC_QUEUE, 'id', [
    { name: 'tipo', keyPath: 'tipo' },
    { name: 'prioridad', keyPath: 'prioridad' },
    { name: 'intentos', keyPath: 'intentos' }
  ]);

  console.log('[OfflineDB] Stores creados');
}

// Helper para operaciones de store
async function withStore(storeName, mode, operation) {
  const database = await initOfflineDB();
  if (!database) return null;
  
  return new Promise((resolve, reject) => {
    try {
      const tx = database.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const result = operation(store, tx);
      
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
    } catch (e) {
      reject(e);
    }
  });
}

// ==================== PREDIOS ====================

// Guardar predios (merge, no reemplazar completamente)
// IMPORTANTE: Usa proyectoId consistentemente para evitar duplicados
export async function savePrediosOffline(proyectoId, predios, municipio) {
  const database = await initOfflineDB();
  if (!database || !predios?.length) return 0;
  
  try {
    const tx = database.transaction(STORES.PREDIOS, 'readwrite');
    const store = tx.objectStore(STORES.PREDIOS);
    
    // Deduplicar entrada por código predial antes de guardar
    const prediosUnicos = new Map();
    for (const predio of predios) {
      const codigoPredial = predio.codigo_predial || predio.numero_predial || predio.codigo_predial_nacional;
      if (!codigoPredial) continue;
      
      // Si ya existe, mantener el más reciente (último en la lista)
      prediosUnicos.set(codigoPredial, predio);
    }
    
    // Pre-cargar registros existentes con cambios locales (batch, no uno por uno)
    const existingLocals = new Map();
    const allKeys = [...prediosUnicos.keys()].map(cp => `${proyectoId}_${cp}`);
    for (const key of allKeys) {
      const req = store.get(key);
      await new Promise(resolve => {
        req.onsuccess = () => {
          const r = req.result;
          if (r && (r._cambios_locales || r._visita_local)) {
            existingLocals.set(key, { _cambios_locales: r._cambios_locales, _visita_local: r._visita_local });
          }
          resolve();
        };
        req.onerror = () => resolve();
      });
    }

    // Batch puts sin await intermedio
    let saved = 0;
    const now = new Date().toISOString();
    for (const [codigoPredial, predio] of prediosUnicos) {
      const id = `${proyectoId}_${codigoPredial}`;
      const local = existingLocals.get(id);

      const record = {
        id,
        proyecto_id: proyectoId,
        municipio: municipio || predio.municipio,
        codigo_predial: codigoPredial,
        ...predio,
        _cambios_locales: local?._cambios_locales || null,
        _visita_local: local?._visita_local || null,
        saved_offline_at: now,
        last_server_sync: now
      };

      store.put(record);
      saved++;
    }

    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    console.log(`[OfflineDB] ${saved} predios guardados para proyecto ${proyectoId}${predios.length !== saved ? ` (${predios.length - saved} duplicados ignorados)` : ''}`);
    
    window.dispatchEvent(new CustomEvent('offlineDataUpdated', { detail: { type: 'predios', count: saved } }));
    return saved;
  } catch (e) {
    console.error('[OfflineDB] Error guardando predios:', e);
    return 0;
  }
}

// Obtener predios offline
export async function getPrediosOffline(proyectoId) {
  const database = await initOfflineDB();
  if (!database) return [];
  
  return new Promise((resolve) => {
    try {
      const tx = database.transaction(STORES.PREDIOS, 'readonly');
      const store = tx.objectStore(STORES.PREDIOS);
      const index = store.index('proyecto_id');
      const request = index.getAll(proyectoId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    } catch (e) {
      console.error('[OfflineDB] Error obteniendo predios:', e);
      resolve([]);
    }
  });
}

// Obtener predios por municipio
export async function getPrediosByMunicipioOffline(municipio) {
  const database = await initOfflineDB();
  if (!database) return [];
  
  return new Promise((resolve) => {
    try {
      const tx = database.transaction(STORES.PREDIOS, 'readonly');
      const store = tx.objectStore(STORES.PREDIOS);
      const index = store.index('municipio');
      const request = index.getAll(municipio);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    } catch (e) {
      resolve([]);
    }
  });
}

// Actualizar un predio localmente (para cambios offline)
// IMPORTANTE: Usar proyectoId consistentemente para el ID (igual que savePrediosOffline)
export async function updatePredioOffline(proyectoId, codigoPredial, updates, municipio) {
  const database = await initOfflineDB();
  if (!database) return false;
  
  try {
    const tx = database.transaction(STORES.PREDIOS, 'readwrite');
    const store = tx.objectStore(STORES.PREDIOS);
    // IMPORTANTE: Usar proyectoId SIEMPRE como prefijo para consistencia
    const id = `${proyectoId}_${codigoPredial}`;
    
    const existing = await new Promise(resolve => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
    
    if (existing) {
      const updated = {
        ...existing,
        ...updates,
        _cambios_locales: {
          ...(existing._cambios_locales || {}),
          ...updates,
          _modificado_at: new Date().toISOString()
        },
        updated_offline_at: new Date().toISOString()
      };
      store.put(updated);
      
      await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      
      return true;
    }
    return false;
  } catch (e) {
    console.error('[OfflineDB] Error actualizando predio:', e);
    return false;
  }
}

// ==================== GEOMETRIAS ====================

export async function saveGeometriasOffline(proyectoId, geometrias) {
  const database = await initOfflineDB();
  if (!database || !geometrias?.length) return 0;
  
  try {
    const tx = database.transaction(STORES.GEOMETRIAS, 'readwrite');
    const store = tx.objectStore(STORES.GEOMETRIAS);

    for (const geom of geometrias) {
      const codigoPredial = geom.properties?.codigo_predial || geom.properties?.CODIGO || geom.id;
      if (!codigoPredial) continue;
      
      const record = {
        id: `${proyectoId}_${codigoPredial}`,
        proyecto_id: proyectoId,
        codigo_predial: codigoPredial,
        ...geom,
        saved_offline_at: new Date().toISOString()
      };
      store.put(record);
    }

    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    console.log(`[OfflineDB] ${geometrias.length} geometrías guardadas`);
    
    window.dispatchEvent(new CustomEvent('offlineDataUpdated', { detail: { type: 'geometrias', count: geometrias.length } }));
    return geometrias.length;
  } catch (e) {
    console.error('[OfflineDB] Error guardando geometrías:', e);
    return 0;
  }
}

export async function getGeometriasOffline(proyectoId) {
  const database = await initOfflineDB();
  if (!database) return [];
  
  return new Promise((resolve) => {
    try {
      const tx = database.transaction(STORES.GEOMETRIAS, 'readonly');
      const store = tx.objectStore(STORES.GEOMETRIAS);
      const index = store.index('proyecto_id');
      const request = index.getAll(proyectoId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    } catch (e) {
      resolve([]);
    }
  });
}

// Guardar geometrías por municipio (para Conservación)
export async function saveGeometriasMunicipioOffline(municipio, geometrias) {
  const database = await initOfflineDB();
  if (!database || !geometrias?.length) return 0;
  
  try {
    const tx = database.transaction(STORES.GEOMETRIAS, 'readwrite');
    const store = tx.objectStore(STORES.GEOMETRIAS);

    for (const geom of geometrias) {
      const codigoPredial = geom.properties?.codigo_predial || geom.properties?.CODIGO || geom.id;
      if (!codigoPredial) continue;
      
      const record = {
        id: `${municipio}_${codigoPredial}`,
        proyecto_id: municipio, // Usar municipio como proyecto_id
        codigo_predial: codigoPredial,
        municipio: municipio,
        ...geom,
        saved_offline_at: new Date().toISOString()
      };
      store.put(record);
    }

    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    console.log(`[OfflineDB] ${geometrias.length} geometrías guardadas para municipio ${municipio}`);
    return geometrias.length;
  } catch (e) {
    console.error('[OfflineDB] Error guardando geometrías municipio:', e);
    return 0;
  }
}

// Obtener geometrías por municipio
export async function getGeometriasMunicipioOffline(municipio) {
  const database = await initOfflineDB();
  if (!database) return [];
  
  return new Promise((resolve) => {
    try {
      const tx = database.transaction(STORES.GEOMETRIAS, 'readonly');
      const store = tx.objectStore(STORES.GEOMETRIAS);
      const index = store.index('proyecto_id');
      const request = index.getAll(municipio);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    } catch (e) {
      resolve([]);
    }
  });
}

// Contar geometrías por municipio
export async function countGeometriasMunicipioOffline(municipio) {
  const database = await initOfflineDB();
  if (!database) return 0;
  
  return new Promise((resolve) => {
    try {
      const tx = database.transaction(STORES.GEOMETRIAS, 'readonly');
      const store = tx.objectStore(STORES.GEOMETRIAS);
      const index = store.index('proyecto_id');
      const request = index.count(municipio);
      request.onsuccess = () => resolve(request.result || 0);
      request.onerror = () => resolve(0);
    } catch (e) {
      resolve(0);
    }
  });
}

// ==================== CONSTRUCCIONES (MEJORAS) ====================

// Guardar construcciones/mejoras de un proyecto
export async function saveConstruccionesOffline(proyectoId, construcciones) {
  const database = await initOfflineDB();
  if (!database || !construcciones?.features?.length) return 0;
  
  try {
    const tx = database.transaction(STORES.CONSTRUCCIONES, 'readwrite');
    const store = tx.objectStore(STORES.CONSTRUCCIONES);
    
    // Guardar el GeoJSON completo como un solo registro por proyecto
    const record = {
      id: `construcciones_${proyectoId}`,
      proyecto_id: proyectoId,
      geojson: construcciones,
      count: construcciones.features.length,
      saved_offline_at: new Date().toISOString()
    };
    
    store.put(record);

    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    console.log(`[OfflineDB] ${construcciones.features.length} construcciones guardadas para proyecto ${proyectoId}`);
    
    window.dispatchEvent(new CustomEvent('offlineDataUpdated', { detail: { type: 'construcciones', count: construcciones.features.length } }));
    return construcciones.features.length;
  } catch (e) {
    console.error('[OfflineDB] Error guardando construcciones:', e);
    return 0;
  }
}

// Obtener construcciones/mejoras de un proyecto
export async function getConstruccionesOffline(proyectoId) {
  const database = await initOfflineDB();
  if (!database) return null;
  
  return new Promise((resolve) => {
    try {
      const tx = database.transaction(STORES.CONSTRUCCIONES, 'readonly');
      const store = tx.objectStore(STORES.CONSTRUCCIONES);
      const request = store.get(`construcciones_${proyectoId}`);
      
      request.onsuccess = () => {
        const result = request.result;
        if (result?.geojson) {
          console.log(`[OfflineDB] Construcciones cargadas del caché: ${result.count}`);
          resolve(result.geojson);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    } catch (e) {
      console.error('[OfflineDB] Error obteniendo construcciones:', e);
      resolve(null);
    }
  });
}

// ==================== CAMBIOS PENDIENTES ====================

export async function saveCambioPendiente(cambio) {
  const database = await initOfflineDB();
  if (!database) {
    const error = new Error('No se pudo inicializar la base de datos offline');
    error.code = 'DB_INIT_ERROR';
    throw error;
  }
  
  try {
    // Comprimir imágenes antes de guardar para reducir uso de almacenamiento
    let datosOptimizados = { ...cambio };
    
    if (cambio.tipo === 'visita' && cambio.datos) {
      datosOptimizados.datos = await comprimirDatosVisita(cambio.datos);
    }
    
    const tx = database.transaction(STORES.CAMBIOS_PENDIENTES, 'readwrite');
    const store = tx.objectStore(STORES.CAMBIOS_PENDIENTES);
    
    const record = {
      id: `cambio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...datosOptimizados,
      fecha: new Date().toISOString(),
      sincronizado: false,
      intentos: 0
    };
    
    store.put(record);
    
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    
    console.log('[OfflineDB] Cambio pendiente guardado:', record.id);
    window.dispatchEvent(new CustomEvent('offlineDataUpdated', { detail: { type: 'cambio', id: record.id } }));
    return record.id;
  } catch (e) {
    console.error('[OfflineDB] Error guardando cambio:', e);
    const error = new Error(`Error guardando offline: ${e.message || 'Error desconocido'}`);
    error.code = 'SAVE_ERROR';
    error.originalError = e;
    throw error;
  }
}

// Función para comprimir imágenes base64
async function comprimirImagen(base64, quality = 0.6, maxWidth = 1200) {
  return new Promise((resolve) => {
    if (!base64 || !base64.startsWith('data:image')) {
      resolve(base64);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
}

// Comprimir datos de visita (firmas y fotos)
async function comprimirDatosVisita(datos) {
  const datosComprimidos = { ...datos };
  
  // Comprimir firmas (calidad 0.7, max 800px)
  if (datosComprimidos.firma_visitado_base64) {
    datosComprimidos.firma_visitado_base64 = await comprimirImagen(
      datosComprimidos.firma_visitado_base64, 0.7, 800
    );
  }
  if (datosComprimidos.firma_reconocedor_base64) {
    datosComprimidos.firma_reconocedor_base64 = await comprimirImagen(
      datosComprimidos.firma_reconocedor_base64, 0.7, 800
    );
  }
  
  // Comprimir fotos (calidad 0.5, max 1200px)
  if (datosComprimidos.fotos && Array.isArray(datosComprimidos.fotos)) {
    datosComprimidos.fotos = await Promise.all(
      datosComprimidos.fotos.map(async (foto) => {
        if (typeof foto === 'string') {
          return await comprimirImagen(foto, 0.5, 1200);
        } else if (foto?.data) {
          return { ...foto, data: await comprimirImagen(foto.data, 0.5, 1200) };
        }
        return foto;
      })
    );
  }
  
  console.log('[OfflineDB] Datos de visita comprimidos');
  return datosComprimidos;
}

export async function getCambiosPendientes(proyectoId = null) {
  const database = await initOfflineDB();
  if (!database) return [];

  return new Promise((resolve) => {
    try {
      const tx = database.transaction(STORES.CAMBIOS_PENDIENTES, 'readonly');
      const store = tx.objectStore(STORES.CAMBIOS_PENDIENTES);

      // Usar índice 'sincronizado' para obtener solo no sincronizados
      let request;
      try {
        const index = store.index('sincronizado');
        request = index.getAll(false); // Solo sincronizado === false
      } catch (e) {
        // Fallback si el índice no existe
        request = store.getAll();
      }

      request.onsuccess = () => {
        let results = request.result || [];
        // Filtro de seguridad (por si usó fallback)
        results = results.filter(c => !c.sincronizado);
        if (proyectoId) {
          results = results.filter(c => c.proyecto_id === proyectoId);
        }
        resolve(results);
      };
      request.onerror = () => resolve([]);
    } catch (e) {
      resolve([]);
    }
  });
}

export async function marcarCambioSincronizado(cambioId) {
  const database = await initOfflineDB();
  if (!database) return false;
  
  try {
    const tx = database.transaction(STORES.CAMBIOS_PENDIENTES, 'readwrite');
    const store = tx.objectStore(STORES.CAMBIOS_PENDIENTES);
    
    const existing = await new Promise(resolve => {
      const req = store.get(cambioId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
    
    if (existing) {
      existing.sincronizado = true;
      existing.sincronizado_at = new Date().toISOString();
      store.put(existing);
    }
    
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    
    return true;
  } catch (e) {
    return false;
  }
}

export async function eliminarCambioSincronizado(cambioId) {
  const database = await initOfflineDB();
  if (!database) return false;
  
  try {
    const tx = database.transaction(STORES.CAMBIOS_PENDIENTES, 'readwrite');
    const store = tx.objectStore(STORES.CAMBIOS_PENDIENTES);
    store.delete(cambioId);
    
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    
    return true;
  } catch (e) {
    return false;
  }
}

// Limpiar TODOS los cambios pendientes (para resolver errores de sincronización)
export async function clearAllCambiosPendientes() {
  const database = await initOfflineDB();
  if (!database) return false;
  
  try {
    const tx = database.transaction(STORES.CAMBIOS_PENDIENTES, 'readwrite');
    const store = tx.objectStore(STORES.CAMBIOS_PENDIENTES);
    store.clear();
    
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    
    console.log('[OfflineDB] Todos los cambios pendientes han sido eliminados');
    return true;
  } catch (e) {
    console.error('[OfflineDB] Error limpiando cambios pendientes:', e);
    return false;
  }
}

// ==================== PROYECTOS ====================

export async function saveProyectoOffline(proyecto) {
  const database = await initOfflineDB();
  if (!database) return false;
  
  try {
    const tx = database.transaction(STORES.PROYECTOS, 'readwrite');
    const store = tx.objectStore(STORES.PROYECTOS);
    
    store.put({
      ...proyecto,
      saved_offline_at: new Date().toISOString()
    });
    
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    
    return true;
  } catch (e) {
    return false;
  }
}

// Guardar múltiples proyectos (para uso en lista de proyectos)
export async function saveProyectosOffline(proyectos) {
  const database = await initOfflineDB();
  if (!database || !proyectos?.length) return 0;
  
  try {
    const tx = database.transaction(STORES.PROYECTOS, 'readwrite');
    const store = tx.objectStore(STORES.PROYECTOS);
    
    let saved = 0;
    for (const proyecto of proyectos) {
      if (!proyecto.id) continue;
      
      store.put({
        ...proyecto,
        saved_offline_at: new Date().toISOString()
      });
      saved++;
    }
    
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    
    console.log(`[OfflineDB] ${saved} proyectos guardados`);
    return saved;
  } catch (e) {
    console.error('[OfflineDB] Error guardando proyectos:', e);
    return 0;
  }
}

export async function getProyectoOffline(proyectoId) {
  const database = await initOfflineDB();
  if (!database) return null;
  
  return new Promise((resolve) => {
    try {
      const tx = database.transaction(STORES.PROYECTOS, 'readonly');
      const store = tx.objectStore(STORES.PROYECTOS);
      const request = store.get(proyectoId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

export async function getProyectosOffline() {
  const database = await initOfflineDB();
  if (!database) return [];
  
  return new Promise((resolve) => {
    try {
      const tx = database.transaction(STORES.PROYECTOS, 'readonly');
      const store = tx.objectStore(STORES.PROYECTOS);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    } catch (e) {
      resolve([]);
    }
  });
}

// ==================== CONFIGURACIÓN ====================

export async function saveConfig(key, value) {
  const database = await initOfflineDB();
  if (!database) return false;
  
  try {
    const tx = database.transaction(STORES.CONFIG, 'readwrite');
    const store = tx.objectStore(STORES.CONFIG);
    store.put({ key, value, updated_at: new Date().toISOString() });
    
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    
    return true;
  } catch (e) {
    return false;
  }
}

export async function getConfig(key) {
  const database = await initOfflineDB();
  if (!database) return null;
  
  return new Promise((resolve) => {
    try {
      const tx = database.transaction(STORES.CONFIG, 'readonly');
      const store = tx.objectStore(STORES.CONFIG);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

// ==================== ESTADÍSTICAS Y UTILIDADES ====================

export async function getOfflineStats() {
  const database = await initOfflineDB();
  if (!database) return { predios: 0, geometrias: 0, construcciones: 0, cambiosPendientes: 0, proyectos: 0 };
  
  try {
    const stats = { predios: 0, geometrias: 0, construcciones: 0, cambiosPendientes: 0, proyectos: 0 };
    
    for (const [key, storeName] of [
      ['predios', STORES.PREDIOS],
      ['geometrias', STORES.GEOMETRIAS],
      ['construcciones', STORES.CONSTRUCCIONES],
      ['cambiosPendientes', STORES.CAMBIOS_PENDIENTES],
      ['proyectos', STORES.PROYECTOS]
    ]) {
      try {
        const tx = database.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const count = await new Promise(resolve => {
          const req = store.count();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(0);
        });
        stats[key] = count;
      } catch (e) {
        // Ignorar errores de stores individuales
      }
    }
    
    return stats;
  } catch (e) {
    return { predios: 0, geometrias: 0, construcciones: 0, cambiosPendientes: 0, proyectos: 0 };
  }
}

export async function hasOfflineData(proyectoId) {
  const predios = await getPrediosOffline(proyectoId);
  return predios.length > 0;
}

export async function clearAllOfflineData() {
  const database = await initOfflineDB();
  if (!database) return false;
  
  try {
    for (const storeName of Object.values(STORES)) {
      try {
        const tx = database.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.clear();
        await new Promise((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch (e) {
        // Continuar con otros stores
      }
    }
    console.log('[OfflineDB] Todos los datos eliminados');
    return true;
  } catch (e) {
    return false;
  }
}

export async function clearProjectOfflineData(proyectoId) {
  const database = await initOfflineDB();
  if (!database) return false;
  
  try {
    // Limpiar predios del proyecto
    const txPredios = database.transaction(STORES.PREDIOS, 'readwrite');
    const storePredios = txPredios.objectStore(STORES.PREDIOS);
    const indexPredios = storePredios.index('proyecto_id');
    
    const prediosToDelete = await new Promise(resolve => {
      const req = indexPredios.getAllKeys(proyectoId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
    
    for (const key of prediosToDelete) {
      storePredios.delete(key);
    }
    
    // Limpiar geometrías del proyecto
    const txGeom = database.transaction(STORES.GEOMETRIAS, 'readwrite');
    const storeGeom = txGeom.objectStore(STORES.GEOMETRIAS);
    const indexGeom = storeGeom.index('proyecto_id');

    const geomToDelete = await new Promise(resolve => {
      const req = indexGeom.getAllKeys(proyectoId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    for (const key of geomToDelete) {
      storeGeom.delete(key);
    }

    // Limpiar construcciones del proyecto
    try {
      const txConst = database.transaction(STORES.CONSTRUCCIONES, 'readwrite');
      const storeConst = txConst.objectStore(STORES.CONSTRUCCIONES);
      storeConst.delete(`construcciones_${proyectoId}`);
      await new Promise((resolve) => { txConst.oncomplete = resolve; txConst.onerror = resolve; });
    } catch (e) { /* store may not exist */ }

    // Limpiar cambios pendientes del proyecto
    try {
      const txCambios = database.transaction(STORES.CAMBIOS_PENDIENTES, 'readwrite');
      const storeCambios = txCambios.objectStore(STORES.CAMBIOS_PENDIENTES);
      const indexCambios = storeCambios.index('proyecto_id');
      const cambiosToDelete = await new Promise(resolve => {
        const req = indexCambios.getAllKeys(proyectoId);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
      for (const key of cambiosToDelete) {
        storeCambios.delete(key);
      }
      await new Promise((resolve) => { txCambios.oncomplete = resolve; txCambios.onerror = resolve; });
    } catch (e) { /* ignore */ }

    console.log(`[OfflineDB] Datos del proyecto ${proyectoId} eliminados (predios, geometrías, construcciones, cambios)`);
    return true;
  } catch (e) {
    return false;
  }
}

// ==================== ÚLTIMA SINCRONIZACIÓN ====================

export async function getLastSync(proyectoId) {
  return await getConfig(`last_sync_${proyectoId}`);
}

export async function setLastSync(proyectoId) {
  return await saveConfig(`last_sync_${proyectoId}`, new Date().toISOString());
}

// ==================== LIMPIEZA AUTOMÁTICA (TTL) ====================

/**
 * Limpia datos antiguos de IndexedDB.
 * - Cambios sincronizados con más de maxAgeDays días
 * - Llamar al iniciar la app o periódicamente
 */
export async function cleanupOldData(maxAgeDays = 30) {
  const database = await initOfflineDB();
  if (!database) return { cleaned: 0 };

  let cleaned = 0;
  const cutoffDate = new Date(Date.now() - maxAgeDays * 86400000).toISOString();

  try {
    // Limpiar cambios pendientes ya sincronizados y antiguos
    const tx = database.transaction(STORES.CAMBIOS_PENDIENTES, 'readwrite');
    const store = tx.objectStore(STORES.CAMBIOS_PENDIENTES);
    const allChanges = await new Promise(resolve => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    for (const cambio of allChanges) {
      if (cambio.sincronizado && cambio.fecha && cambio.fecha < cutoffDate) {
        store.delete(cambio.id);
        cleaned++;
      }
    }

    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    if (cleaned > 0) {
      console.log(`[OfflineDB] Limpieza TTL: ${cleaned} cambios antiguos eliminados`);
    }
  } catch (e) {
    console.warn('[OfflineDB] Error en limpieza TTL:', e);
  }

  return { cleaned };
}

// ==================== MONITOREO DE CUOTA ====================

/**
 * Verifica el uso de almacenamiento. Retorna porcentaje usado.
 */
export async function checkStorageQuota() {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      const usagePercent = Math.round((estimate.usage / estimate.quota) * 100);
      return {
        usageMB: Math.round(estimate.usage / 1048576),
        quotaMB: Math.round(estimate.quota / 1048576),
        usagePercent
      };
    }
  } catch (e) {
    // Ignorar en navegadores sin soporte
  }
  return null;
}

// Exportar constantes
export { STORES, DB_NAME };
