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
  hasOfflineData
} from '../utils/offlineDB';

const API = process.env.REACT_APP_BACKEND_URL;

export function useOfflineSync(proyectoId, modulo = 'actualizacion') {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [offlineStats, setOfflineStats] = useState({ predios: 0, geometrias: 0, cambiosPendientes: 0 });
  const [hasOffline, setHasOffline] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  
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
      setIsOnline(true);
      toast.success('Conexión restaurada', { 
        description: 'Verificando cambios pendientes...',
        duration: 3000 
      });
      
      // Auto-sincronizar cambios pendientes al recuperar conexión
      setTimeout(async () => {
        try {
          const cambios = await getCambiosPendientes(proyectoId);
          if (cambios.length > 0) {
            console.log(`[Offline] ${cambios.length} cambios pendientes encontrados, sincronizando...`);
            toast.info(`Sincronizando ${cambios.length} cambio(s) pendiente(s)...`);
            await syncChangesDirectly(cambios, setIsSyncing, refreshStats);
          } else {
            console.log('[Offline] No hay cambios pendientes');
          }
        } catch (e) {
          console.error('[Offline] Error al auto-sincronizar:', e);
        }
      }, 1500); // Esperar para que la conexión se estabilice
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

  return {
    isOnline,
    isSyncing,
    offlineStats,
    hasOffline,
    lastSync,
    downloadForOffline,
    saveOfflineChange,
    syncPendingChanges,
    getOfflineData,
    forceSync,
    refreshStats,
    getPrediosOffline  // Agregar para uso directo en componentes
  };
}

export default useOfflineSync;
