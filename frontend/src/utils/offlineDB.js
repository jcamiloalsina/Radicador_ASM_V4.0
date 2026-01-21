// Módulo de gestión de datos offline con IndexedDB
const DB_NAME = 'asomunicipios_offline';
const DB_VERSION = 2;

// Stores en IndexedDB
const STORES = {
  PREDIOS: 'predios_offline',
  GEOMETRIAS: 'geometrias_offline', 
  CAMBIOS_PENDIENTES: 'cambios_pendientes',
  VISITAS_PENDIENTES: 'visitas_pendientes',
  CONFIG: 'config_offline'
};

let db = null;

// Inicializar la base de datos
export function initOfflineDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[OfflineDB] Error al abrir la base de datos');
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      console.log('[OfflineDB] Base de datos abierta correctamente');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      
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

      console.log('[OfflineDB] Estructura de base de datos actualizada');
    };
  });
}

// ==================== PREDIOS ====================

// Guardar predios para offline
export async function savePrediosOffline(proyectoId, predios, municipio) {
  const database = await initOfflineDB();
  const tx = database.transaction(STORES.PREDIOS, 'readwrite');
  const store = tx.objectStore(STORES.PREDIOS);

  // Guardar cada predio
  for (const predio of predios) {
    const record = {
      id: `${proyectoId}_${predio.codigo_predial || predio.numero_predial}`,
      proyecto_id: proyectoId,
      municipio: municipio,
      codigo_predial: predio.codigo_predial || predio.numero_predial,
      ...predio,
      saved_offline_at: new Date().toISOString()
    };
    store.put(record);
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      console.log(`[OfflineDB] ${predios.length} predios guardados offline`);
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

// ==================== UTILIDADES ====================

// Limpiar todos los datos offline de un proyecto
export async function clearProyectoOffline(proyectoId) {
  const database = await initOfflineDB();
  
  // Limpiar predios
  const txPredios = database.transaction(STORES.PREDIOS, 'readwrite');
  const prediosStore = txPredios.objectStore(STORES.PREDIOS);
  const prediosIndex = prediosStore.index('proyecto_id');
  const prediosCursor = prediosIndex.openCursor(IDBKeyRange.only(proyectoId));
  
  prediosCursor.onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
      prediosStore.delete(cursor.primaryKey);
      cursor.continue();
    }
  };

  // Limpiar geometrías
  const txGeom = database.transaction(STORES.GEOMETRIAS, 'readwrite');
  const geomStore = txGeom.objectStore(STORES.GEOMETRIAS);
  const geomIndex = geomStore.index('proyecto_id');
  const geomCursor = geomIndex.openCursor(IDBKeyRange.only(proyectoId));
  
  geomCursor.onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
      geomStore.delete(cursor.primaryKey);
      cursor.continue();
    }
  };

  console.log(`[OfflineDB] Datos offline del proyecto ${proyectoId} eliminados`);
}

// Obtener estadísticas de datos offline
export async function getOfflineStats() {
  const database = await initOfflineDB();
  
  const txPredios = database.transaction(STORES.PREDIOS, 'readonly');
  const prediosCount = await new Promise((resolve) => {
    const request = txPredios.objectStore(STORES.PREDIOS).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(0);
  });

  const txGeom = database.transaction(STORES.GEOMETRIAS, 'readonly');
  const geomCount = await new Promise((resolve) => {
    const request = txGeom.objectStore(STORES.GEOMETRIAS).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(0);
  });

  const txCambios = database.transaction(STORES.CAMBIOS_PENDIENTES, 'readonly');
  const cambiosPendientes = await new Promise((resolve) => {
    const request = txCambios.objectStore(STORES.CAMBIOS_PENDIENTES).getAll();
    request.onsuccess = () => resolve(request.result.filter(c => !c.sincronizado).length);
    request.onerror = () => resolve(0);
  });

  return {
    predios: prediosCount,
    geometrias: geomCount,
    cambiosPendientes: cambiosPendientes
  };
}

// Verificar si hay datos offline disponibles para un proyecto
export async function hasOfflineData(proyectoId) {
  const predios = await getPrediosOffline(proyectoId);
  return predios.length > 0;
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
  clearProyectoOffline,
  getOfflineStats,
  hasOfflineData
};
