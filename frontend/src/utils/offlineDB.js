// Módulo de gestión de datos offline con IndexedDB
const DB_NAME = 'asomunicipios_offline';
const DB_VERSION = 6; // Incrementado para forzar limpieza de datos corruptos
const APP_VERSION = '2.0.0'; // Versión de la aplicación para detectar cambios

// Stores en IndexedDB
const STORES = {
  PREDIOS: 'predios_offline',
  GEOMETRIAS: 'geometrias_offline', 
  CAMBIOS_PENDIENTES: 'cambios_pendientes',
  VISITAS_PENDIENTES: 'visitas_pendientes',
  CONFIG: 'config_offline',
  PROYECTOS: 'proyectos_offline'
};

let db = null;

// Verificar si es una nueva versión de la app y limpiar datos si es necesario
async function checkAndCleanOldData() {
  try {
    const storedVersion = localStorage.getItem('asomunicipios_app_version');
    if (storedVersion !== APP_VERSION) {
      console.log(`[OfflineDB] Nueva versión detectada (${storedVersion} -> ${APP_VERSION}). Limpiando datos antiguos...`);
      // Eliminar la base de datos completa
      await new Promise((resolve) => {
        const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
        deleteRequest.onsuccess = () => resolve(true);
        deleteRequest.onerror = () => resolve(false);
        deleteRequest.onblocked = () => resolve(false);
      });
      localStorage.setItem('asomunicipios_app_version', APP_VERSION);
      console.log('[OfflineDB] Datos antiguos eliminados');
      return true;
    }
    return false;
  } catch (e) {
    console.log('[OfflineDB] Error verificando versión:', e);
    return false;
  }
}

// Función para eliminar la base de datos en caso de error
async function deleteDatabase() {
  return new Promise((resolve) => {
    db = null;
    const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
    deleteRequest.onsuccess = () => {
      console.log('[OfflineDB] Base de datos eliminada para recreación');
      resolve(true);
    };
    deleteRequest.onerror = () => {
      console.log('[OfflineDB] Error al eliminar base de datos');
      resolve(false);
    };
    deleteRequest.onblocked = () => {
      console.log('[OfflineDB] Eliminación bloqueada, cerrando conexiones...');
      if (db) {
        db.close();
        db = null;
      }
      resolve(false);
    };
  });
}

// Inicializar la base de datos
export async function initOfflineDB() {
  // Primero verificar si hay que limpiar datos antiguos
  await checkAndCleanOldData();
  
  return new Promise(async (resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = async (event) => {
        const error = event.target.error;
        console.error('[OfflineDB] Error al abrir la base de datos:', error?.message);
        
        // Si es error de versión, eliminar y recrear
        if (error?.name === 'VersionError' || error?.message?.includes('version')) {
          console.log('[OfflineDB] Conflicto de versión detectado, recreando DB...');
          await deleteDatabase();
          localStorage.setItem('asomunicipios_app_version', APP_VERSION);
          // Intentar de nuevo después de eliminar
          const retryRequest = indexedDB.open(DB_NAME, DB_VERSION);
          retryRequest.onsuccess = () => {
            db = retryRequest.result;
            resolve(db);
          };
          retryRequest.onerror = () => reject(retryRequest.error);
          retryRequest.onupgradeneeded = (event) => createAllStores(event.target.result);
        } else {
          reject(error);
        }
      };

      request.onsuccess = () => {
        db = request.result;
        localStorage.setItem('asomunicipios_app_version', APP_VERSION);
        console.log('[OfflineDB] Base de datos abierta correctamente v' + DB_VERSION);
        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        createAllStores(event.target.result);
      };
      
      request.onblocked = () => {
        console.log('[OfflineDB] Upgrade bloqueado, cerrando conexiones antiguas...');
      };
    } catch (error) {
      console.error('[OfflineDB] Error crítico:', error);
      reject(error);
    }
  });
}

// Función auxiliar para crear todos los stores
function createAllStores(database) {
  // Store para predios
  if (!database.objectStoreNames.contains(STORES.PREDIOS)) {
    const prediosStore = database.createObjectStore(STORES.PREDIOS, { keyPath: 'id' });
    prediosStore.createIndex('proyecto_id', 'proyecto_id', { unique: false });
    prediosStore.createIndex('codigo_predial', 'codigo_predial', { unique: false });
    prediosStore.createIndex('municipio', 'municipio', { unique: false });
  }

  // Store para geometrías
  if (!database.objectStoreNames.contains(STORES.GEOMETRIAS)) {
    const geomStore = database.createObjectStore(STORES.GEOMETRIAS, { keyPath: 'id' });
    geomStore.createIndex('proyecto_id', 'proyecto_id', { unique: false });
    geomStore.createIndex('codigo_predial', 'codigo_predial', { unique: false });
  }

  // Store para cambios pendientes de sincronizar
  if (!database.objectStoreNames.contains(STORES.CAMBIOS_PENDIENTES)) {
    const cambiosStore = database.createObjectStore(STORES.CAMBIOS_PENDIENTES, { keyPath: 'id', autoIncrement: true });
    cambiosStore.createIndex('proyecto_id', 'proyecto_id', { unique: false });
    cambiosStore.createIndex('tipo', 'tipo', { unique: false });
    cambiosStore.createIndex('fecha', 'fecha', { unique: false });
  }

  // Store para visitas pendientes
  if (!database.objectStoreNames.contains(STORES.VISITAS_PENDIENTES)) {
    const visitasStore = database.createObjectStore(STORES.VISITAS_PENDIENTES, { keyPath: 'id', autoIncrement: true });
    visitasStore.createIndex('proyecto_id', 'proyecto_id', { unique: false });
    visitasStore.createIndex('codigo_predial', 'codigo_predial', { unique: false });
  }

  // Store para configuración
  if (!database.objectStoreNames.contains(STORES.CONFIG)) {
    database.createObjectStore(STORES.CONFIG, { keyPath: 'key' });
  }

  // Store para proyectos de actualización
  if (!database.objectStoreNames.contains(STORES.PROYECTOS)) {
    const proyectosStore = database.createObjectStore(STORES.PROYECTOS, { keyPath: 'id' });
    proyectosStore.createIndex('municipio', 'municipio', { unique: false });
    proyectosStore.createIndex('estado', 'estado', { unique: false });
  }

  console.log('[OfflineDB] Estructura de base de datos actualizada');
}

// ==================== PREDIOS ====================

// Guardar predios para offline
export async function savePrediosOffline(proyectoId, predios, municipio) {
  const database = await initOfflineDB();
  
  // Si es un municipio (modo Conservación), primero limpiar predios anteriores del mismo municipio
  if (municipio && proyectoId === municipio) {
    try {
      const cleanTx = database.transaction(STORES.PREDIOS, 'readwrite');
      const cleanStore = cleanTx.objectStore(STORES.PREDIOS);
      const index = cleanStore.index('municipio');
      const cursor = index.openCursor(IDBKeyRange.only(municipio));
      
      await new Promise((resolve) => {
        cursor.onsuccess = (event) => {
          const result = event.target.result;
          if (result) {
            cleanStore.delete(result.primaryKey);
            result.continue();
          } else {
            resolve();
          }
        };
        cursor.onerror = () => resolve();
      });
      console.log(`[OfflineDB] Predios anteriores de ${municipio} eliminados`);
    } catch (e) {
      console.log('[OfflineDB] Error limpiando predios anteriores:', e.message);
    }
  }
  
  const tx = database.transaction(STORES.PREDIOS, 'readwrite');
  const store = tx.objectStore(STORES.PREDIOS);

  // Guardar cada predio con ID único basado en código predial
  for (const predio of predios) {
    const codigoPredial = predio.codigo_predial || predio.numero_predial || predio.codigo_predial_nacional;
    const record = {
      // Para Conservación: usar solo código predial como ID (evita duplicados)
      // Para Actualización: usar proyecto_id + código
      id: municipio && proyectoId === municipio 
        ? codigoPredial 
        : `${proyectoId}_${codigoPredial}`,
      proyecto_id: proyectoId,
      municipio: municipio || predio.municipio,
      codigo_predial: codigoPredial,
      ...predio,
      saved_offline_at: new Date().toISOString()
    };
    store.put(record);
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      console.log(`[OfflineDB] ${predios.length} predios guardados offline para ${municipio || proyectoId}`);
      // Notificar cambio
      window.dispatchEvent(new CustomEvent('offlineDataUpdated'));
      resolve(predios.length);
    };
    tx.onerror = () => reject(tx.error);
  });
}

// Obtener predios offline de un proyecto
export async function getPrediosOffline(proyectoId) {
  const database = await initOfflineDB();
  const tx = database.transaction(STORES.PREDIOS, 'readonly');
  const store = tx.objectStore(STORES.PREDIOS);
  const index = store.index('proyecto_id');

  return new Promise((resolve, reject) => {
    const request = index.getAll(proyectoId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Obtener predios offline de un municipio (para Conservación)
export async function getPrediosByMunicipioOffline(municipio) {
  const database = await initOfflineDB();
  const tx = database.transaction(STORES.PREDIOS, 'readonly');
  const store = tx.objectStore(STORES.PREDIOS);
  const index = store.index('municipio');

  return new Promise((resolve, reject) => {
    const request = index.getAll(municipio);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ==================== GEOMETRIAS ====================

// Guardar geometrías para offline
export async function saveGeometriasOffline(proyectoId, geometrias) {
  const database = await initOfflineDB();
  const tx = database.transaction(STORES.GEOMETRIAS, 'readwrite');
  const store = tx.objectStore(STORES.GEOMETRIAS);

  // Guardar cada geometría
  for (const geom of geometrias) {
    const codigoPredial = geom.properties?.codigo_predial || geom.properties?.CODIGO || geom.codigo_predial;
    const record = {
      id: `${proyectoId}_${codigoPredial}_${Math.random().toString(36).substr(2, 9)}`,
      proyecto_id: proyectoId,
      codigo_predial: codigoPredial,
      ...geom,
      saved_offline_at: new Date().toISOString()
    };
    store.put(record);
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      console.log(`[OfflineDB] ${geometrias.length} geometrías guardadas offline`);
      resolve(geometrias.length);
    };
    tx.onerror = () => reject(tx.error);
  });
}

// Obtener geometrías offline de un proyecto
export async function getGeometriasOffline(proyectoId) {
  const database = await initOfflineDB();
  const tx = database.transaction(STORES.GEOMETRIAS, 'readonly');
  const store = tx.objectStore(STORES.GEOMETRIAS);
  const index = store.index('proyecto_id');

  return new Promise((resolve, reject) => {
    const request = index.getAll(proyectoId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ==================== CAMBIOS PENDIENTES ====================

// Guardar cambio pendiente de sincronizar
export async function saveCambioPendiente(proyectoId, tipo, datos) {
  const database = await initOfflineDB();
  const tx = database.transaction(STORES.CAMBIOS_PENDIENTES, 'readwrite');
  const store = tx.objectStore(STORES.CAMBIOS_PENDIENTES);

  const record = {
    proyecto_id: proyectoId,
    tipo: tipo, // 'visita', 'propuesta', 'actualizacion'
    datos: datos,
    fecha: new Date().toISOString(),
    sincronizado: false
  };

  return new Promise((resolve, reject) => {
    const request = store.add(record);
    request.onsuccess = () => {
      console.log(`[OfflineDB] Cambio pendiente guardado: ${tipo}`);
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
}

// Obtener todos los cambios pendientes
export async function getCambiosPendientes(proyectoId = null) {
  const database = await initOfflineDB();
  const tx = database.transaction(STORES.CAMBIOS_PENDIENTES, 'readonly');
  const store = tx.objectStore(STORES.CAMBIOS_PENDIENTES);

  return new Promise((resolve, reject) => {
    let request;
    if (proyectoId) {
      const index = store.index('proyecto_id');
      request = index.getAll(proyectoId);
    } else {
      request = store.getAll();
    }
    request.onsuccess = () => resolve(request.result.filter(c => !c.sincronizado));
    request.onerror = () => reject(request.error);
  });
}

// Marcar cambio como sincronizado
export async function marcarCambioSincronizado(id) {
  const database = await initOfflineDB();
  const tx = database.transaction(STORES.CAMBIOS_PENDIENTES, 'readwrite');
  const store = tx.objectStore(STORES.CAMBIOS_PENDIENTES);

  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => {
      const record = request.result;
      if (record) {
        record.sincronizado = true;
        record.sincronizado_en = new Date().toISOString();
        store.put(record);
      }
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

// Eliminar cambio sincronizado
export async function eliminarCambioSincronizado(id) {
  const database = await initOfflineDB();
  const tx = database.transaction(STORES.CAMBIOS_PENDIENTES, 'readwrite');
  const store = tx.objectStore(STORES.CAMBIOS_PENDIENTES);

  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ==================== CONFIG ====================

// Guardar configuración
export async function saveConfig(key, value) {
  const database = await initOfflineDB();
  const tx = database.transaction(STORES.CONFIG, 'readwrite');
  const store = tx.objectStore(STORES.CONFIG);

  return new Promise((resolve, reject) => {
    const request = store.put({ key, value, updated_at: new Date().toISOString() });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Obtener configuración
export async function getConfig(key) {
  const database = await initOfflineDB();
  const tx = database.transaction(STORES.CONFIG, 'readonly');
  const store = tx.objectStore(STORES.CONFIG);

  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result?.value);
    request.onerror = () => reject(request.error);
  });
}

// ==================== PROYECTOS ====================

// Guardar proyectos para offline
export async function saveProyectosOffline(proyectos) {
  const database = await initOfflineDB();
  const tx = database.transaction(STORES.PROYECTOS, 'readwrite');
  const store = tx.objectStore(STORES.PROYECTOS);

  // Limpiar proyectos anteriores y guardar los nuevos
  store.clear();
  
  for (const proyecto of proyectos) {
    const record = {
      ...proyecto,
      saved_offline_at: new Date().toISOString()
    };
    store.put(record);
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      console.log(`[OfflineDB] ${proyectos.length} proyectos guardados offline`);
      // Notificar al sistema de offline
      window.dispatchEvent(new CustomEvent('offlineDataUpdated'));
      resolve(proyectos.length);
    };
    tx.onerror = () => reject(tx.error);
  });
}

// Obtener todos los proyectos offline
export async function getProyectosOffline(filtroEstado = null) {
  const database = await initOfflineDB();
  const tx = database.transaction(STORES.PROYECTOS, 'readonly');
  const store = tx.objectStore(STORES.PROYECTOS);

  return new Promise((resolve, reject) => {
    let request;
    if (filtroEstado && filtroEstado !== 'todos') {
      const index = store.index('estado');
      request = index.getAll(filtroEstado);
    } else {
      request = store.getAll();
    }
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// Obtener un proyecto específico offline
export async function getProyectoOffline(proyectoId) {
  const database = await initOfflineDB();
  const tx = database.transaction(STORES.PROYECTOS, 'readonly');
  const store = tx.objectStore(STORES.PROYECTOS);

  return new Promise((resolve, reject) => {
    const request = store.get(proyectoId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Contar proyectos offline
export async function countProyectosOffline() {
  const database = await initOfflineDB();
  const tx = database.transaction(STORES.PROYECTOS, 'readonly');
  const store = tx.objectStore(STORES.PROYECTOS);

  return new Promise((resolve) => {
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(0);
  });
}

// ==================== UTILIDADES ====================

// Limpiar todos los datos offline de un proyecto
export async function clearProyectoOffline(proyectoId) {
  const database = await initOfflineDB();
  
  // Limpiar predios
  if (database.objectStoreNames.contains(STORES.PREDIOS)) {
    try {
      const txPredios = database.transaction(STORES.PREDIOS, 'readwrite');
      const prediosStore = txPredios.objectStore(STORES.PREDIOS);
      if (prediosStore.indexNames.contains('proyecto_id')) {
        const prediosIndex = prediosStore.index('proyecto_id');
        const prediosCursor = prediosIndex.openCursor(IDBKeyRange.only(proyectoId));
        
        prediosCursor.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            prediosStore.delete(cursor.primaryKey);
            cursor.continue();
          }
        };
      }
    } catch (e) {
      console.log('[OfflineDB] Error limpiando predios:', e.message);
    }
  }

  // Limpiar geometrías
  if (database.objectStoreNames.contains(STORES.GEOMETRIAS)) {
    try {
      const txGeom = database.transaction(STORES.GEOMETRIAS, 'readwrite');
      const geomStore = txGeom.objectStore(STORES.GEOMETRIAS);
      if (geomStore.indexNames.contains('proyecto_id')) {
        const geomIndex = geomStore.index('proyecto_id');
        const geomCursor = geomIndex.openCursor(IDBKeyRange.only(proyectoId));
        
        geomCursor.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            geomStore.delete(cursor.primaryKey);
            cursor.continue();
          }
        };
      }
    } catch (e) {
      console.log('[OfflineDB] Error limpiando geometrías:', e.message);
    }
  }

  console.log(`[OfflineDB] Datos offline del proyecto ${proyectoId} eliminados`);
}

// Obtener estadísticas de datos offline
export async function getOfflineStats() {
  const database = await initOfflineDB();
  
  let prediosCount = 0;
  let geomCount = 0;
  let cambiosPendientes = 0;
  let proyectosCount = 0;

  // Predios
  if (database.objectStoreNames.contains(STORES.PREDIOS)) {
    try {
      const txPredios = database.transaction(STORES.PREDIOS, 'readonly');
      prediosCount = await new Promise((resolve) => {
        const request = txPredios.objectStore(STORES.PREDIOS).count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(0);
      });
    } catch (e) {
      console.log('[OfflineDB] Error contando predios:', e.message);
    }
  }

  // Geometrías
  if (database.objectStoreNames.contains(STORES.GEOMETRIAS)) {
    try {
      const txGeom = database.transaction(STORES.GEOMETRIAS, 'readonly');
      geomCount = await new Promise((resolve) => {
        const request = txGeom.objectStore(STORES.GEOMETRIAS).count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(0);
      });
    } catch (e) {
      console.log('[OfflineDB] Error contando geometrías:', e.message);
    }
  }

  // Cambios pendientes
  if (database.objectStoreNames.contains(STORES.CAMBIOS_PENDIENTES)) {
    try {
      const txCambios = database.transaction(STORES.CAMBIOS_PENDIENTES, 'readonly');
      cambiosPendientes = await new Promise((resolve) => {
        const request = txCambios.objectStore(STORES.CAMBIOS_PENDIENTES).getAll();
        request.onsuccess = () => resolve(request.result.filter(c => !c.sincronizado).length);
        request.onerror = () => resolve(0);
      });
    } catch (e) {
      console.log('[OfflineDB] Error contando cambios:', e.message);
    }
  }

  // Proyectos
  if (database.objectStoreNames.contains(STORES.PROYECTOS)) {
    try {
      const txProyectos = database.transaction(STORES.PROYECTOS, 'readonly');
      proyectosCount = await new Promise((resolve) => {
        const request = txProyectos.objectStore(STORES.PROYECTOS).count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(0);
      });
    } catch (e) {
      console.log('[OfflineDB] Error contando proyectos:', e.message);
    }
  }

  return {
    predios: prediosCount,
    geometrias: geomCount,
    cambiosPendientes: cambiosPendientes,
    proyectos: proyectosCount
  };
}

// Verificar si hay datos offline disponibles para un proyecto
export async function hasOfflineData(proyectoId) {
  const predios = await getPrediosOffline(proyectoId);
  return predios.length > 0;
}

// Limpiar TODOS los datos offline (reset completo)
export async function clearAllOfflineData() {
  try {
    const database = await initOfflineDB();
    
    const stores = [STORES.PREDIOS, STORES.GEOMETRIAS, STORES.PROYECTOS];
    
    for (const storeName of stores) {
      if (database.objectStoreNames.contains(storeName)) {
        const tx = database.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        await new Promise((resolve) => {
          const request = store.clear();
          request.onsuccess = () => resolve();
          request.onerror = () => resolve();
        });
      }
    }
    
    console.log('[OfflineDB] Todos los datos offline eliminados');
    window.dispatchEvent(new CustomEvent('offlineDataUpdated'));
    return true;
  } catch (error) {
    console.error('[OfflineDB] Error limpiando datos:', error);
    return false;
  }
}

// Limpiar datos offline de un municipio específico
export async function clearMunicipioOffline(municipio) {
  try {
    const database = await initOfflineDB();
    
    if (database.objectStoreNames.contains(STORES.PREDIOS)) {
      const tx = database.transaction(STORES.PREDIOS, 'readwrite');
      const store = tx.objectStore(STORES.PREDIOS);
      const index = store.index('municipio');
      const cursor = index.openCursor(IDBKeyRange.only(municipio));
      
      let deleted = 0;
      await new Promise((resolve) => {
        cursor.onsuccess = (event) => {
          const result = event.target.result;
          if (result) {
            store.delete(result.primaryKey);
            deleted++;
            result.continue();
          } else {
            resolve();
          }
        };
        cursor.onerror = () => resolve();
      });
      
      console.log(`[OfflineDB] ${deleted} predios eliminados de ${municipio}`);
    }
    
    window.dispatchEvent(new CustomEvent('offlineDataUpdated'));
    return true;
  } catch (error) {
    console.error('[OfflineDB] Error limpiando municipio:', error);
    return false;
  }
}

export default {
  initOfflineDB,
  savePrediosOffline,
  getPrediosOffline,
  getPrediosByMunicipioOffline,
  saveGeometriasOffline,
  getGeometriasOffline,
  saveCambioPendiente,
  getCambiosPendientes,
  marcarCambioSincronizado,
  eliminarCambioSincronizado,
  saveConfig,
  getConfig,
  saveProyectosOffline,
  getProyectosOffline,
  getProyectoOffline,
  countProyectosOffline,
  clearProyectoOffline,
  clearAllOfflineData,
  clearMunicipioOffline,
  getOfflineStats,
  hasOfflineData
};
