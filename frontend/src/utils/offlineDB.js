// Módulo de gestión de datos offline con IndexedDB
const DB_NAME = 'asomunicipios_offline';
const DB_VERSION = 7; // Unificado con useOffline.js
const APP_VERSION = '2.1.0'; // Versión de la aplicación para detectar cambios

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
let dbInitialized = false;
let dbInitPromise = null;

// Verificar si es una nueva versión de la app y limpiar datos si es necesario
async function checkAndCleanOldData() {
  try {
    const storedVersion = localStorage.getItem('asomunicipios_app_version');
    if (storedVersion !== APP_VERSION) {
      console.log(`[OfflineDB] Nueva versión detectada (${storedVersion} -> ${APP_VERSION}). Limpiando datos antiguos...`);
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

// Inicializar la base de datos (singleton - solo se ejecuta una vez)
// Retorna null si IndexedDB no está disponible (no lanza excepciones)
export async function initOfflineDB() {
  // Si IndexedDB no está disponible en este navegador, retornar null
  if (typeof indexedDB === 'undefined') {
    console.warn('[OfflineDB] IndexedDB no disponible en este navegador');
    return null;
  }
  
  // Si ya está inicializada, retornar inmediatamente
  if (db && dbInitialized) {
    return db;
  }
  
  // Si hay una inicialización en progreso, esperar a que termine (con timeout)
  if (dbInitPromise) {
    // Añadir timeout de 10 segundos para evitar bloqueos indefinidos
    const timeoutPromise = new Promise((resolve) => 
      setTimeout(() => resolve(null), 10000) // Resolver con null en lugar de rechazar
    );
    try {
      const result = await Promise.race([dbInitPromise, timeoutPromise]);
      if (result) return result;
      console.warn('[OfflineDB] Timeout esperando inicialización');
      dbInitPromise = null;
      return null;
    } catch (e) {
      console.warn('[OfflineDB] Error esperando inicialización:', e.message);
      dbInitPromise = null;
      return null;
    }
  }
  
  // Crear promesa de inicialización con timeout
  dbInitPromise = (async () => {
    try {
      // Solo verificar versión una vez (con timeout para evitar bloqueo)
      if (!dbInitialized) {
        try {
          await Promise.race([
            checkAndCleanOldData(),
            new Promise((resolve) => setTimeout(() => resolve(false), 5000))
          ]);
        } catch (e) {
          console.warn('[OfflineDB] Error verificando versión:', e.message);
        }
      }
      
      return new Promise((resolve) => {
        // Timeout para la apertura de la base de datos - resolver con null en lugar de rechazar
        const timeout = setTimeout(() => {
          console.warn('[OfflineDB] Timeout al abrir la base de datos');
          resolve(null);
        }, 10000);
        
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = async (event) => {
          clearTimeout(timeout);
          const error = event.target.error;
          console.warn('[OfflineDB] Error al abrir la base de datos:', error?.message);
          
          if (error?.name === 'VersionError' || error?.message?.includes('version')) {
            console.log('[OfflineDB] Conflicto de versión detectado, recreando DB...');
            try {
              await deleteDatabase();
              localStorage.setItem('asomunicipios_app_version', APP_VERSION);
              const retryRequest = indexedDB.open(DB_NAME, DB_VERSION);
              retryRequest.onsuccess = () => {
                db = retryRequest.result;
                dbInitialized = true;
                resolve(db);
              };
              retryRequest.onerror = () => resolve(null); // No lanzar error
              retryRequest.onupgradeneeded = (event) => createAllStores(event.target.result);
            } catch (e) {
              console.warn('[OfflineDB] Error recreando DB:', e.message);
              resolve(null);
            }
          } else {
            resolve(null); // No lanzar error, simplemente resolver con null
          }
        };

        request.onsuccess = () => {
          clearTimeout(timeout);
          db = request.result;
          dbInitialized = true;
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
      });
    } catch (error) {
      console.warn('[OfflineDB] Error crítico:', error.message);
      dbInitPromise = null;
      return null; // No lanzar error
    }
  })();
  
  return dbInitPromise;
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

// Helper para verificar si la base de datos está disponible
async function getDatabase() {
  const database = await initOfflineDB();
  if (!database) {
    console.warn('[OfflineDB] Base de datos no disponible');
    return null;
  }
  return database;
}

// ==================== PREDIOS ====================

// Guardar predios para offline
export async function savePrediosOffline(proyectoId, predios, municipio) {
  const database = await getDatabase();
  if (!database) return 0;
  
  // SIEMPRE limpiar predios anteriores del mismo municipio primero
  if (municipio) {
    try {
      const cleanTx = database.transaction(STORES.PREDIOS, 'readwrite');
      const cleanStore = cleanTx.objectStore(STORES.PREDIOS);
      
      // Intentar usar índice de municipio si existe
      if (cleanStore.indexNames.contains('municipio')) {
        const index = cleanStore.index('municipio');
        const cursor = index.openCursor(IDBKeyRange.only(municipio));
        
        let deletedCount = 0;
        await new Promise((resolve) => {
          cursor.onsuccess = (event) => {
            const result = event.target.result;
            if (result) {
              cleanStore.delete(result.primaryKey);
              deletedCount++;
              result.continue();
            } else {
              resolve();
            }
          };
          cursor.onerror = () => resolve();
        });
        console.log(`[OfflineDB] ${deletedCount} predios anteriores de ${municipio} eliminados`);
      } else {
        // Si no hay índice, limpiar todo y empezar de cero
        console.log('[OfflineDB] No hay índice de municipio, limpiando todo...');
        await new Promise((resolve) => {
          const clearRequest = cleanStore.clear();
          clearRequest.onsuccess = () => resolve();
          clearRequest.onerror = () => resolve();
        });
      }
    } catch (e) {
      console.log('[OfflineDB] Error limpiando predios anteriores:', e.message);
    }
  }
  
  const tx = database.transaction(STORES.PREDIOS, 'readwrite');
  const store = tx.objectStore(STORES.PREDIOS);

  // Guardar cada predio con ID único basado en código predial
  for (const predio of predios) {
    const codigoPredial = predio.codigo_predial || predio.numero_predial || predio.codigo_predial_nacional;
    if (!codigoPredial) continue; // Saltar predios sin código
    
    const record = {
      // ID único basado en municipio + código predial
      id: `${municipio}_${codigoPredial}`,
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
  const database = await getDatabase();
  if (!database) return [];
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
  const database = await getDatabase();
  if (!database) return [];
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
  const database = await getDatabase();
  if (!database) return [];
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
  const database = await getDatabase();
  if (!database) return [];
  const tx = database.transaction(STORES.GEOMETRIAS, 'readonly');
  const store = tx.objectStore(STORES.GEOMETRIAS);
  const index = store.index('proyecto_id');

  return new Promise((resolve, reject) => {
    const request = index.getAll(proyectoId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ==================== GEOMETRÍAS POR MUNICIPIO (VISOR DE PREDIOS) ====================

// Guardar geometrías del visor por municipio
export async function saveGeometriasMunicipioOffline(municipio, geometriasData) {
  const database = await getDatabase();
  if (!database) return [];
  const municipioKey = `visor_${municipio}`;
  
  // Primero, eliminar TODOS los registros del municipio en una transacción separada
  // Usamos múltiples criterios para asegurar que se eliminen todos los registros antiguos
  await new Promise((resolve, reject) => {
    const deleteTx = database.transaction(STORES.GEOMETRIAS, 'readwrite');
    const deleteStore = deleteTx.objectStore(STORES.GEOMETRIAS);
    
    // Abrir cursor para eliminar todos los registros del municipio
    const cursorRequest = deleteStore.openCursor();
    let deletedCount = 0;
    
    cursorRequest.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const record = cursor.value;
        const recordId = record.id || '';
        
        // Verificar si el registro pertenece a este municipio usando múltiples criterios
        const belongsToMunicipio = 
          recordId.startsWith(municipioKey) ||  // Nuevo formato: visor_Ábrego_...
          recordId.startsWith(`visor_${municipio}_`) ||  // Cualquier variante
          record.proyecto_id === municipioKey ||
          record.municipio === municipio;
        
        if (belongsToMunicipio) {
          cursor.delete();
          deletedCount++;
        }
        cursor.continue();
      }
    };
    
    deleteTx.oncomplete = () => {
      console.log(`[OfflineDB] ${deletedCount} geometrías antiguas de ${municipio} eliminadas`);
      resolve();
    };
    deleteTx.onerror = () => reject(deleteTx.error);
  });
  
  // Ahora guardar las nuevas geometrías
  const features = geometriasData.features || [];
  if (features.length === 0) {
    return 0;
  }
  
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.GEOMETRIAS, 'readwrite');
    const store = tx.objectStore(STORES.GEOMETRIAS);
    
    let savedCount = 0;
    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      const codigoPredial = feature.properties?.codigo_predial || feature.properties?.CODIGO || `unknown_${i}`;
      const record = {
        id: `${municipioKey}_${codigoPredial}`, // ID sin timestamp para evitar duplicados
        proyecto_id: municipioKey,
        municipio: municipio,
        codigo_predial: codigoPredial,
        type: feature.type,
        geometry: feature.geometry,
        properties: feature.properties,
        saved_offline_at: new Date().toISOString()
      };
      
      try {
        store.put(record);
        savedCount++;
      } catch (e) {
        console.warn(`[OfflineDB] Error guardando geometría ${i}:`, e);
      }
    }
    
    tx.oncomplete = () => {
      console.log(`[OfflineDB] ${savedCount} geometrías de ${municipio} guardadas offline`);
      resolve(savedCount);
    };
    tx.onerror = () => {
      console.error('[OfflineDB] Error en transacción:', tx.error);
      reject(tx.error);
    };
  });
}

// Obtener geometrías del visor por municipio
export async function getGeometriasMunicipioOffline(municipio) {
  const database = await getDatabase();
  if (!database) return [];
  const tx = database.transaction(STORES.GEOMETRIAS, 'readonly');
  const store = tx.objectStore(STORES.GEOMETRIAS);
  const municipioKey = `visor_${municipio}`;

  return new Promise((resolve, reject) => {
    // Usar cursor para obtener todos los registros y filtrar manualmente
    // Esto es más robusto que depender del índice
    const results = [];
    const cursorRequest = store.openCursor();
    
    cursorRequest.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        // Filtrar por municipio
        if (cursor.value.proyecto_id === municipioKey || cursor.value.municipio === municipio) {
          results.push(cursor.value);
        }
        cursor.continue();
      } else {
        // Cursor terminó, construir GeoJSON
        const geoJson = {
          type: 'FeatureCollection',
          features: results.map(r => ({
            type: r.type || 'Feature',
            geometry: r.geometry,
            properties: r.properties
          })),
          total: results.length
        };
        console.log(`[OfflineDB] ${results.length} geometrías de ${municipio} cargadas desde offline`);
        resolve(geoJson);
      }
    };
    
    cursorRequest.onerror = () => reject(cursorRequest.error);
  });
}

// Contar geometrías offline por municipio
export async function countGeometriasMunicipioOffline(municipio) {
  const database = await getDatabase();
  if (!database) return [];
  const tx = database.transaction(STORES.GEOMETRIAS, 'readonly');
  const store = tx.objectStore(STORES.GEOMETRIAS);
  const municipioKey = `visor_${municipio}`;

  return new Promise((resolve, reject) => {
    let count = 0;
    const cursorRequest = store.openCursor();
    
    cursorRequest.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const record = cursor.value;
        const recordId = record.id || '';
        
        if (recordId.startsWith(municipioKey) || 
            record.proyecto_id === municipioKey || 
            record.municipio === municipio) {
          count++;
        }
        cursor.continue();
      } else {
        resolve(count);
      }
    };
    cursorRequest.onerror = () => reject(cursorRequest.error);
  });
}

// Limpiar TODAS las geometrías offline
export async function clearAllGeometriasOffline() {
  const database = await getDatabase();
  if (!database) return false;
  
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.GEOMETRIAS, 'readwrite');
    const store = tx.objectStore(STORES.GEOMETRIAS);
    
    const request = store.clear();
    request.onsuccess = () => {
      console.log('[OfflineDB] Todas las geometrías offline eliminadas');
      resolve(true);
    };
    request.onerror = () => reject(request.error);
  });
}

// ==================== CAMBIOS PENDIENTES ====================

// Guardar cambio pendiente de sincronizar
export async function saveCambioPendiente(proyectoId, tipo, datos) {
  const database = await getDatabase();
  if (!database) return null;
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
  const database = await getDatabase();
  if (!database) return [];
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
  const database = await getDatabase();
  if (!database) return false;
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
      resolve(true);
    };
    request.onerror = () => reject(request.error);
  });
}

// Eliminar cambio sincronizado
export async function eliminarCambioSincronizado(id) {
  const database = await getDatabase();
  if (!database) return false;
  const tx = database.transaction(STORES.CAMBIOS_PENDIENTES, 'readwrite');
  const store = tx.objectStore(STORES.CAMBIOS_PENDIENTES);

  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

// ==================== CONFIG ====================

// Guardar configuración
export async function saveConfig(key, value) {
  const database = await getDatabase();
  if (!database) return false;
  const tx = database.transaction(STORES.CONFIG, 'readwrite');
  const store = tx.objectStore(STORES.CONFIG);

  return new Promise((resolve, reject) => {
    const request = store.put({ key, value, updated_at: new Date().toISOString() });
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

// Obtener configuración
export async function getConfig(key) {
  const database = await getDatabase();
  if (!database) return null;
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
  const database = await getDatabase();
  if (!database) return 0;
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
  const database = await getDatabase();
  if (!database) return [];
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
  const database = await getDatabase();
  if (!database) return [];
  const tx = database.transaction(STORES.PROYECTOS, 'readonly');
  const store = tx.objectStore(STORES.PROYECTOS);

  return new Promise((resolve, reject) => {
    const request = store.get(proyectoId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Guardar UN solo proyecto offline (sin borrar los demás)
export async function saveProyectoOffline(proyecto) {
  const database = await getDatabase();
  if (!database) return [];
  const tx = database.transaction(STORES.PROYECTOS, 'readwrite');
  const store = tx.objectStore(STORES.PROYECTOS);

  const record = {
    ...proyecto,
    saved_offline_at: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const request = store.put(record);
    request.onsuccess = () => {
      console.log(`[OfflineDB] Proyecto ${proyecto.id} guardado offline`);
      window.dispatchEvent(new CustomEvent('offlineDataUpdated'));
      resolve(true);
    };
    request.onerror = () => reject(request.error);
  });
}

// Contar proyectos offline
export async function countProyectosOffline() {
  const database = await getDatabase();
  if (!database) return [];
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
  const database = await getDatabase();
  if (!database) return [];
  
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

// Obtener estadísticas de datos offline (optimizado)
export async function getOfflineStats() {
  try {
    const database = await getDatabase();
    if (!database) return { predios: 0, geometrias: 0, cambiosPendientes: 0, proyectos: 0 };
    
    let prediosCount = 0;
    let geomCount = 0;
    let cambiosPendientes = 0;
    let proyectosCount = 0;

    // Usar una sola transacción para todos los stores que existen
    const storeNames = [];
    if (database.objectStoreNames.contains(STORES.PREDIOS)) storeNames.push(STORES.PREDIOS);
    if (database.objectStoreNames.contains(STORES.GEOMETRIAS)) storeNames.push(STORES.GEOMETRIAS);
    if (database.objectStoreNames.contains(STORES.CAMBIOS_PENDIENTES)) storeNames.push(STORES.CAMBIOS_PENDIENTES);
    if (database.objectStoreNames.contains(STORES.PROYECTOS)) storeNames.push(STORES.PROYECTOS);
    
    if (storeNames.length === 0) {
      return { predios: 0, geometrias: 0, cambiosPendientes: 0, proyectos: 0 };
    }
    
    const tx = database.transaction(storeNames, 'readonly');
    
    // Contar predios
    if (storeNames.includes(STORES.PREDIOS)) {
      prediosCount = await new Promise((resolve) => {
        const request = tx.objectStore(STORES.PREDIOS).count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(0);
      });
    }
    
    // Contar geometrías
    if (storeNames.includes(STORES.GEOMETRIAS)) {
      geomCount = await new Promise((resolve) => {
        const request = tx.objectStore(STORES.GEOMETRIAS).count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(0);
      });
    }
    
    // Contar cambios pendientes
    if (storeNames.includes(STORES.CAMBIOS_PENDIENTES)) {
      const allCambios = await new Promise((resolve) => {
        const request = tx.objectStore(STORES.CAMBIOS_PENDIENTES).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      });
      cambiosPendientes = allCambios.filter(c => !c.sincronizado).length;
    }
    
    // Contar proyectos
    if (storeNames.includes(STORES.PROYECTOS)) {
      proyectosCount = await new Promise((resolve) => {
        const request = tx.objectStore(STORES.PROYECTOS).count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(0);
      });
    }

    return {
      predios: prediosCount,
      geometrias: geomCount,
      cambiosPendientes: cambiosPendientes,
      proyectos: proyectosCount
    };
  } catch (error) {
    console.log('[OfflineDB] Error obteniendo stats:', error.message);
    return { predios: 0, geometrias: 0, cambiosPendientes: 0, proyectos: 0 };
  }
}

// Verificar si hay datos offline disponibles para un proyecto
export async function hasOfflineData(proyectoId) {
  const predios = await getPrediosOffline(proyectoId);
  return predios.length > 0;
}

// Limpiar TODOS los datos offline (reset completo)
export async function clearAllOfflineData() {
  try {
    const database = await getDatabase();
    if (!database) return false;
    
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
    const database = await getDatabase();
  if (!database) return [];
    
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
  saveGeometriasMunicipioOffline,
  getGeometriasMunicipioOffline,
  countGeometriasMunicipioOffline,
  clearAllGeometriasOffline,
  saveCambioPendiente,
  getCambiosPendientes,
  marcarCambioSincronizado,
  eliminarCambioSincronizado,
  saveConfig,
  getConfig,
  saveProyectosOffline,
  saveProyectoOffline,
  getProyectosOffline,
  getProyectoOffline,
  countProyectosOffline,
  clearProyectoOffline,
  clearAllOfflineData,
  clearMunicipioOffline,
  getOfflineStats,
  hasOfflineData
};
