import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import {
  initOfflineDB,
  savePrediosOffline,
  getPrediosOffline,
  saveGeometriasOffline,
  getGeometriasOffline,
  saveCambioPendiente,
  getCambiosPendientes,
  marcarCambioSincronizado,
  eliminarCambioSincronizado,
  getOfflineStats,
  hasOfflineData,
  clearAllOfflineData,
  getConfig,
  saveConfig
} from '../utils/offlineDB';

const API = process.env.REACT_APP_BACKEND_URL;

export function useOfflineSync(proyectoId, modulo = 'actualizacion') {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [offlineStats, setOfflineStats] = useState({ predios: 0, geometrias: 0, cambiosPendientes: 0 });
  const [hasOffline, setHasOffline] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [requiresSync, setRequiresSync] = useState(false); // Indica si necesita sincronización obligatoria
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, message: '' }); // Progreso de sincronización
  const [isInitialSyncComplete, setIsInitialSyncComplete] = useState(false); // Sincronización inicial completada
  
  // Ref para evitar dependencias circulares
  const syncingRef = useRef(false);

  // Función para sincronizar cambios directamente (usada internamente)
  const syncChangesDirectly = async (cambios, setIsSyncingFn, refreshStatsFn) => {
    if (cambios.length === 0 || syncingRef.current) return;
    
    syncingRef.current = true;
    setIsSyncingFn(true);
    let sincronizados = 0;
    let errores = 0;
    const token = localStorage.getItem('token');

    for (const cambio of cambios) {
      try {
        switch (cambio.tipo) {
          case 'visita':
            await axios.patch(
              `${API}/api/actualizacion/proyectos/${cambio.proyecto_id}/predios/${cambio.datos.codigo_predial}`,
              cambio.datos,
              { headers: { Authorization: `Bearer ${token}` }}
            );
            break;
          
          case 'propuesta':
            await axios.post(
              `${API}/api/actualizacion/proyectos/${cambio.proyecto_id}/predios/${cambio.datos.codigo_predial}/propuesta`,
              cambio.datos,
              { headers: { Authorization: `Bearer ${token}` }}
            );
            break;
          
          case 'actualizacion_predio':
            await axios.patch(
              `${API}/api/predios/${cambio.datos.codigo_predial}`,
              cambio.datos,
              { headers: { Authorization: `Bearer ${token}` }}
            );
            break;

          default:
            console.warn(`[Sync] Tipo de cambio no reconocido: ${cambio.tipo}`);
        }

        await eliminarCambioSincronizado(cambio.id);
        sincronizados++;
      } catch (error) {
        console.error(`[Sync] Error sincronizando cambio ${cambio.id}:`, error);
        errores++;
      }
    }

    try {
      await refreshStatsFn();
    } catch (e) {
      console.log('[Sync] Error actualizando stats');
    }
    
    setIsSyncingFn(false);
    syncingRef.current = false;

    if (sincronizados > 0) {
      toast.success(`${sincronizados} cambio(s) sincronizado(s) exitosamente`);
    }
    if (errores > 0) {
      toast.error(`${errores} cambio(s) no se pudieron sincronizar`);
    }
    
    return { sincronizados, errores };
  };

  // Refrescar estadísticas - solo cuando se llame explícitamente
  const refreshStats = useCallback(async () => {
    try {
      const stats = await getOfflineStats();
      setOfflineStats(stats);
    } catch (e) {
      console.log('[useOfflineSync] Error refreshStats:', e.message);
    }
  }, []);

  // Detectar cambios de conexión
  useEffect(() => {
    const handleOnline = async () => {
      const wasOffline = !isOnline; // Estaba offline antes?
      setIsOnline(true);
      
      if (wasOffline) {
        // SE RECONECTÓ - Verificar y forzar sincronización
        console.log('[Offline] Conexión restaurada. Verificando estado...');
        
        try {
          const cambios = await getCambiosPendientes(proyectoId);
          
          // Siempre mostrar pantalla de sincronización cuando se reconecta
          setRequiresSync(true);
          setIsInitialSyncComplete(false);
          
          if (cambios.length > 0) {
            setSyncProgress({ 
              current: 0, 
              total: cambios.length, 
              message: `Conexión restaurada. ${cambios.length} cambio(s) pendiente(s) por subir.` 
            });
          } else {
            setSyncProgress({ 
              current: 0, 
              total: 0, 
              message: 'Conexión restaurada. Verificando datos del servidor...' 
            });
          }
        } catch (e) {
          console.error('[Offline] Error al verificar:', e);
          toast.success('Conexión restaurada', { duration: 2000 });
        }
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Sin conexión', { description: 'Trabajando en modo offline' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [proyectoId, refreshStats]);
  
  // Inicializar DB solo una vez
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        await initOfflineDB();
        if (mounted && proyectoId) {
          const hasData = await hasOfflineData(proyectoId);
          setHasOffline(hasData);
        }
      } catch (e) {
        console.log('[useOfflineSync] Error init:', e.message);
      }
    };
    init();
    return () => { mounted = false; };
  }, [proyectoId]);

  // Descargar datos para offline (se llama automáticamente al cargar el visor)
  const downloadForOffline = useCallback(async (predios, geometrias, municipio) => {
    try {
      // Guardar predios - usar municipio como identificador si no hay proyectoId
      const storeId = proyectoId || municipio || 'general';
      
      if (predios && predios.length > 0) {
        await savePrediosOffline(storeId, predios, municipio);
      }

      // Guardar geometrías
      if (geometrias && geometrias.length > 0) {
        await saveGeometriasOffline(storeId, geometrias);
      }

      // Actualizar estadísticas locales
      await refreshStats();
      setHasOffline(true);
      setLastSync(new Date().toISOString());
      
      // Notificar al hook global useOffline que hay datos nuevos
      window.dispatchEvent(new CustomEvent('offlineDataUpdated'));

      console.log(`[Offline] Datos descargados: ${predios?.length || 0} predios, ${geometrias?.length || 0} geometrías para ${storeId}`);
    } catch (error) {
      console.error('[Offline] Error al guardar datos:', error);
    }
  }, [proyectoId, refreshStats]);

  // Guardar cambio para sincronizar después
  const saveOfflineChange = useCallback(async (tipo, datos) => {
    if (!proyectoId) return null;

    try {
      const id = await saveCambioPendiente(proyectoId, tipo, datos);
      await refreshStats();
      toast.info('Cambio guardado offline', { description: 'Se sincronizará al recuperar conexión' });
      return id;
    } catch (error) {
      console.error('[Offline] Error al guardar cambio:', error);
      toast.error('Error al guardar cambio offline');
      return null;
    }
  }, [proyectoId, refreshStats]);

  // Sincronizar cambios pendientes
  const syncPendingChanges = useCallback(async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    let sincronizados = 0;
    let errores = 0;

    try {
      const cambios = await getCambiosPendientes(proyectoId);
      
      if (cambios.length === 0) {
        setIsSyncing(false);
        return;
      }

      const token = localStorage.getItem('token');
      
      for (const cambio of cambios) {
        try {
          switch (cambio.tipo) {
            case 'visita':
              await axios.patch(
                `${API}/api/actualizacion/proyectos/${cambio.proyecto_id}/predios/${cambio.datos.codigo_predial}`,
                cambio.datos,
                { headers: { Authorization: `Bearer ${token}` }}
              );
              break;
            
            case 'propuesta':
              await axios.post(
                `${API}/api/actualizacion/proyectos/${cambio.proyecto_id}/predios/${cambio.datos.codigo_predial}/propuesta`,
                cambio.datos,
                { headers: { Authorization: `Bearer ${token}` }}
              );
              break;
            
            case 'actualizacion_predio':
              await axios.patch(
                `${API}/api/predios/${cambio.datos.codigo_predial}`,
                cambio.datos,
                { headers: { Authorization: `Bearer ${token}` }}
              );
              break;

            default:
              console.warn(`[Sync] Tipo de cambio no reconocido: ${cambio.tipo}`);
          }

          await eliminarCambioSincronizado(cambio.id);
          sincronizados++;
        } catch (error) {
          console.error(`[Sync] Error sincronizando cambio ${cambio.id}:`, error);
          errores++;
        }
      }

      await refreshStats();

      if (sincronizados > 0) {
        toast.success(`${sincronizados} cambio(s) sincronizado(s)`);
      }
      if (errores > 0) {
        toast.error(`${errores} cambio(s) no se pudieron sincronizar`);
      }
    } catch (error) {
      console.error('[Sync] Error general en sincronización:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, proyectoId, refreshStats]);

  // Obtener datos offline
  const getOfflineData = useCallback(async () => {
    if (!proyectoId) return { predios: [], geometrias: [] };

    const predios = await getPrediosOffline(proyectoId);
    const geometrias = await getGeometriasOffline(proyectoId);

    return { predios, geometrias };
  }, [proyectoId]);

  // Forzar sincronización manual
  const forceSync = useCallback(async () => {
    if (!isOnline) {
      toast.error('Sin conexión a internet');
      return;
    }
    await syncPendingChanges();
  }, [isOnline, syncPendingChanges]);

  // Limpiar todo el caché offline del proyecto
  const clearOfflineCache = useCallback(async () => {
    try {
      setIsSyncing(true);
      setSyncProgress({ current: 0, total: 1, message: 'Limpiando caché...' });
      
      // Primero verificar si hay cambios pendientes sin sincronizar
      const cambiosPendientes = await getCambiosPendientes(proyectoId);
      if (cambiosPendientes.length > 0) {
        const confirmacion = window.confirm(
          `Hay ${cambiosPendientes.length} cambio(s) pendiente(s) sin sincronizar. ` +
          'Si limpia el caché, estos cambios se perderán. ¿Desea continuar?'
        );
        if (!confirmacion) {
          setIsSyncing(false);
          return false;
        }
      }
      
      // Limpiar todos los datos offline
      await clearAllOfflineData();
      
      // Limpiar la fecha de última sincronización
      await saveConfig(`lastSync_${proyectoId}`, null);
      
      setHasOffline(false);
      setLastSync(null);
      setIsInitialSyncComplete(false);
      setRequiresSync(true);
      
      await refreshStats();
      
      toast.success('Caché limpiado correctamente', {
        description: 'Debe descargar los datos nuevamente para trabajar offline'
      });
      
      return true;
    } catch (error) {
      console.error('[Offline] Error limpiando caché:', error);
      toast.error('Error al limpiar el caché');
      return false;
    } finally {
      setIsSyncing(false);
      setSyncProgress({ current: 0, total: 0, message: '' });
    }
  }, [proyectoId, refreshStats]);

  // Verificar si necesita sincronización - SIEMPRE mostrar pantalla al inicio cuando hay conexión
  const checkInitialSync = useCallback(async () => {
    if (!proyectoId) {
      setIsInitialSyncComplete(true);
      return false;
    }
    
    // Si está offline, permitir trabajar sin bloquear
    if (!isOnline) {
      setIsInitialSyncComplete(true);
      return false;
    }
    
    try {
      // Verificar si hay cambios pendientes de subir
      const cambiosPendientes = await getCambiosPendientes(proyectoId);
      
      if (cambiosPendientes.length > 0) {
        console.log('[Offline] Hay cambios pendientes por sincronizar:', cambiosPendientes.length);
        setSyncProgress({ current: 0, total: cambiosPendientes.length, message: `${cambiosPendientes.length} cambio(s) pendiente(s) por subir` });
      } else {
        setSyncProgress({ current: 0, total: 0, message: 'Verificar datos del servidor' });
      }
      
      // SIEMPRE mostrar pantalla de sincronización al inicio cuando hay conexión
      setRequiresSync(true);
      return true;
    } catch (error) {
      console.error('[Offline] Error verificando sync:', error);
      setIsInitialSyncComplete(true);
      return false;
    }
  }, [proyectoId, isOnline]);

  // Ejecutar sincronización completa (descarga + subida)
  const performFullSync = useCallback(async (prediosData, geometriasData) => {
    if (!proyectoId || !isOnline) {
      toast.error('Sin conexión a internet');
      return false;
    }
    
    setIsSyncing(true);
    setSyncProgress({ current: 0, total: 4, message: 'Iniciando sincronización...' });
    
    try {
      // Paso 1: Subir cambios pendientes al servidor
      setSyncProgress({ current: 1, total: 4, message: 'Subiendo cambios pendientes...' });
      const cambiosPendientes = await getCambiosPendientes(proyectoId);
      if (cambiosPendientes.length > 0) {
        await syncChangesDirectly(cambiosPendientes, setIsSyncing, refreshStats);
      }
      
      // Paso 2: Descargar predios actualizados
      setSyncProgress({ current: 2, total: 4, message: 'Descargando predios del servidor...' });
      if (prediosData && prediosData.length > 0) {
        await savePrediosOffline(proyectoId, prediosData);
      }
      
      // Paso 3: Descargar geometrías actualizadas
      setSyncProgress({ current: 3, total: 4, message: 'Descargando geometrías...' });
      if (geometriasData) {
        // Soportar tanto GeoJSON como array de features
        const features = geometriasData.features || geometriasData;
        if (features && features.length > 0) {
          await saveGeometriasOffline(proyectoId, features);
        }
      }
      
      // Paso 4: Guardar fecha de sincronización
      setSyncProgress({ current: 4, total: 4, message: 'Finalizando...' });
      const now = new Date().toISOString();
      await saveConfig(`lastSync_${proyectoId}`, now);
      setLastSync(now);
      
      await refreshStats();
      
      setRequiresSync(false);
      setIsInitialSyncComplete(true);
      
      toast.success('Sincronización completada', {
        description: `${prediosData?.length || 0} predios actualizados`
      });
      
      return true;
    } catch (error) {
      console.error('[Offline] Error en sincronización completa:', error);
      toast.error('Error durante la sincronización', {
        description: error.message
      });
      return false;
    } finally {
      setIsSyncing(false);
      setSyncProgress({ current: 0, total: 0, message: '' });
    }
  }, [proyectoId, isOnline, refreshStats]);

  // Marcar sincronización como completada manualmente
  const skipInitialSync = useCallback(() => {
    setRequiresSync(false);
    setIsInitialSyncComplete(true);
    toast.warning('Sincronización omitida', {
      description: 'Trabajando con datos locales'
    });
  }, []);

  return {
    isOnline,
    isSyncing,
    offlineStats,
    hasOffline,
    lastSync,
    requiresSync,
    syncProgress,
    isInitialSyncComplete,
    downloadForOffline,
    saveOfflineChange,
    syncPendingChanges,
    getOfflineData,
    forceSync,
    refreshStats,
    clearOfflineCache,
    checkInitialSync,
    performFullSync,
    skipInitialSync,
    getPrediosOffline
  };
}

export default useOfflineSync;
