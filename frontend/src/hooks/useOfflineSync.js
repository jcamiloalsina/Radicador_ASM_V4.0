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
  eliminarCambioSincronizado,
  getOfflineStats,
  hasOfflineData,
  saveConfig,
  getConfig,
  setLastSync,
  getLastSync,
  saveProyectoOffline,
  getProyectoOffline,
  updatePredioOffline,
  clearAllCambiosPendientes
} from '../utils/offlineDB';

const API = process.env.REACT_APP_BACKEND_URL;

// Intervalo de sincronización en segundo plano (5 minutos cuando online)
const BACKGROUND_SYNC_INTERVAL = 5 * 60 * 1000;

export function useOfflineSync(proyectoId, modulo = 'actualizacion') {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [offlineStats, setOfflineStats] = useState({ predios: 0, geometrias: 0, cambiosPendientes: 0 });
  const [hasOffline, setHasOffline] = useState(false);
  const [lastSync, setLastSyncState] = useState(null);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, message: '' });
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
  const [pendingChangesCount, setPendingChangesCount] = useState(0);
  
  const syncingRef = useRef(false);
  const backgroundIntervalRef = useRef(null);
  const mountedRef = useRef(true);

  // Refrescar estadísticas
  const refreshStats = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const stats = await getOfflineStats();
      setOfflineStats(stats);
      
      if (proyectoId) {
        const cambios = await getCambiosPendientes(proyectoId);
        setPendingChangesCount(cambios.length);
      }
    } catch (e) {
      console.log('[useOfflineSync] Error refreshStats:', e.message);
    }
  }, [proyectoId]);

  // Sincronizar cambios pendientes al servidor
  const syncPendingChanges = useCallback(async (showToasts = true) => {
    if (syncingRef.current || !navigator.onLine) return { sincronizados: 0, errores: 0 };
    
    syncingRef.current = true;
    setIsSyncing(true);
    
    let sincronizados = 0;
    let errores = 0;
    const token = localStorage.getItem('token');
    
    if (!token) {
      syncingRef.current = false;
      setIsSyncing(false);
      return { sincronizados: 0, errores: 0 };
    }

    try {
      const cambios = await getCambiosPendientes(proyectoId);
      
      if (cambios.length === 0) {
        syncingRef.current = false;
        setIsSyncing(false);
        return { sincronizados: 0, errores: 0 };
      }

      setSyncProgress({ current: 0, total: cambios.length, message: 'Sincronizando cambios...' });

      for (let i = 0; i < cambios.length; i++) {
        const cambio = cambios[i];
        setSyncProgress({ current: i + 1, total: cambios.length, message: `Sincronizando ${i + 1}/${cambios.length}...` });
        
        try {
          switch (cambio.tipo) {
            case 'visita':
              // CORREGIDO: Usar POST a /visita (no PATCH)
              await axios.post(
                `${API}/api/actualizacion/proyectos/${cambio.proyecto_id}/predios/${encodeURIComponent(cambio.datos.codigo_predial)}/visita`,
                cambio.datos,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              break;
            
            case 'propuesta':
              await axios.post(
                `${API}/api/actualizacion/proyectos/${cambio.proyecto_id}/predios/${encodeURIComponent(cambio.datos.codigo_predial)}/propuesta`,
                cambio.datos,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              break;
            
            case 'actualizacion_predio':
              await axios.patch(
                `${API}/api/predios/${encodeURIComponent(cambio.datos.codigo_predial)}`,
                cambio.datos,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              break;

            default:
              console.warn(`[Sync] Tipo no reconocido: ${cambio.tipo}`);
          }

          await eliminarCambioSincronizado(cambio.id);
          sincronizados++;
        } catch (error) {
          console.error(`[Sync] Error sincronizando cambio ${cambio.id}:`, error);
          errores++;
        }
      }

      await refreshStats();

      if (showToasts) {
        if (sincronizados > 0) {
          toast.success(`${sincronizados} cambio(s) sincronizado(s)`);
        }
        if (errores > 0) {
          toast.error(`${errores} cambio(s) fallaron`);
        }
      }
    } catch (e) {
      console.error('[Sync] Error general:', e);
    }

    setSyncProgress({ current: 0, total: 0, message: '' });
    setIsSyncing(false);
    syncingRef.current = false;
    
    return { sincronizados, errores };
  }, [proyectoId, refreshStats]);

  // Sincronizar TODOS los cambios pendientes de CUALQUIER proyecto
  // Útil cuando se reconecta a internet y hay cambios de múltiples proyectos
  const syncAllPendingChanges = useCallback(async (showToasts = true) => {
    if (syncingRef.current || !navigator.onLine) return { sincronizados: 0, errores: 0 };
    
    syncingRef.current = true;
    setIsSyncing(true);
    
    let sincronizados = 0;
    let errores = 0;
    const token = localStorage.getItem('token');
    
    if (!token) {
      syncingRef.current = false;
      setIsSyncing(false);
      return { sincronizados: 0, errores: 0 };
    }

    try {
      // Obtener TODOS los cambios pendientes sin filtrar por proyecto
      const cambios = await getCambiosPendientes(null);
      
      if (cambios.length === 0) {
        syncingRef.current = false;
        setIsSyncing(false);
        return { sincronizados: 0, errores: 0 };
      }

      console.log(`[Sync] Sincronizando ${cambios.length} cambio(s) de todos los proyectos`);
      setSyncProgress({ current: 0, total: cambios.length, message: 'Sincronizando cambios...' });

      for (let i = 0; i < cambios.length; i++) {
        const cambio = cambios[i];
        setSyncProgress({ current: i + 1, total: cambios.length, message: `Sincronizando ${i + 1}/${cambios.length}...` });
        
        try {
          // Usar el proyecto_id guardado en el cambio, no el actual
          const cambioProyectoId = cambio.proyecto_id;
          
          switch (cambio.tipo) {
            case 'visita':
              // CORREGIDO: Usar POST a /visita (no PATCH)
              await axios.post(
                `${API}/api/actualizacion/proyectos/${cambioProyectoId}/predios/${encodeURIComponent(cambio.datos.codigo_predial)}/visita`,
                cambio.datos,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              break;
            
            case 'propuesta':
              await axios.post(
                `${API}/api/actualizacion/proyectos/${cambioProyectoId}/predios/${encodeURIComponent(cambio.datos.codigo_predial)}/propuesta`,
                cambio.datos,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              break;
            
            case 'actualizacion_predio':
              await axios.patch(
                `${API}/api/predios/${encodeURIComponent(cambio.datos.codigo_predial)}`,
                cambio.datos,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              break;

            default:
              console.warn(`[Sync] Tipo no reconocido: ${cambio.tipo}`);
          }

          await eliminarCambioSincronizado(cambio.id);
          sincronizados++;
          console.log(`[Sync] ✓ Cambio ${cambio.id} sincronizado (proyecto: ${cambioProyectoId})`);
        } catch (error) {
          console.error(`[Sync] Error sincronizando cambio ${cambio.id}:`, error);
          errores++;
        }
      }

      await refreshStats();

      if (showToasts) {
        if (sincronizados > 0) {
          toast.success(`${sincronizados} cambio(s) sincronizado(s)`);
        }
        if (errores > 0) {
          toast.error(`${errores} cambio(s) con error`);
        }
      }
    } catch (e) {
      console.error('[Sync] Error general:', e);
    }

    setSyncProgress({ current: 0, total: 0, message: '' });
    setIsSyncing(false);
    syncingRef.current = false;
    
    return { sincronizados, errores };
  }, [refreshStats]);

  // Descargar datos frescos del servidor (en segundo plano)
  const downloadFreshData = useCallback(async (showProgress = false) => {
    if (!navigator.onLine || !proyectoId) return false;
    
    const token = localStorage.getItem('token');
    if (!token) return false;

    setIsBackgroundSyncing(true);
    
    try {
      if (showProgress) {
        setSyncProgress({ current: 0, total: 3, message: 'Descargando datos del proyecto...' });
      }

      // 1. Descargar proyecto
      try {
        const proyectoRes = await axios.get(`${API}/api/actualizacion/proyectos/${proyectoId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        await saveProyectoOffline(proyectoRes.data);
      } catch (e) {
        console.log('[Sync] Error descargando proyecto:', e.message);
      }

      if (showProgress) {
        setSyncProgress({ current: 1, total: 3, message: 'Descargando predios...' });
      }

      // 2. Descargar predios
      try {
        const prediosRes = await axios.get(`${API}/api/actualizacion/proyectos/${proyectoId}/predios`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const prediosData = prediosRes.data.predios || prediosRes.data || [];
        const proyecto = await getProyectoOffline(proyectoId);
        const municipio = proyecto?.municipio;
        await savePrediosOffline(proyectoId, prediosData, municipio);
      } catch (e) {
        console.log('[Sync] Error descargando predios:', e.message);
      }

      if (showProgress) {
        setSyncProgress({ current: 2, total: 3, message: 'Descargando geometrías...' });
      }

      // 3. Descargar geometrías (solo si es necesario)
      try {
        const geomRes = await axios.get(`${API}/api/actualizacion/proyectos/${proyectoId}/geometrias`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const geometrias = geomRes.data.geometrias || geomRes.data?.features || [];
        if (geometrias.length > 0) {
          await saveGeometriasOffline(proyectoId, geometrias);
        }
      } catch (e) {
        console.log('[Sync] Error descargando geometrías:', e.message);
      }

      await setLastSync(proyectoId);
      setLastSyncState(new Date().toISOString());
      
      if (showProgress) {
        setSyncProgress({ current: 3, total: 3, message: 'Sincronización completa' });
      }

      await refreshStats();
      setHasOffline(true);
      
      console.log('[Sync] Datos descargados correctamente');
      return true;
    } catch (e) {
      console.error('[Sync] Error descargando datos:', e);
      return false;
    } finally {
      setIsBackgroundSyncing(false);
      if (showProgress) {
        setTimeout(() => setSyncProgress({ current: 0, total: 0, message: '' }), 1000);
      }
    }
  }, [proyectoId, refreshStats]);

  // Función principal de descarga para offline
  const downloadForOffline = useCallback(async (predios, geometrias, municipio) => {
    try {
      const storeId = proyectoId || municipio || 'general';
      
      if (predios?.length > 0) {
        await savePrediosOffline(storeId, predios, municipio);
      }
      
      if (geometrias?.length > 0) {
        await saveGeometriasOffline(storeId, geometrias);
      }
      
      await setLastSync(storeId);
      setLastSyncState(new Date().toISOString());
      setHasOffline(true);
      await refreshStats();
      
      console.log(`[Offline] Datos guardados: ${predios?.length || 0} predios, ${geometrias?.length || 0} geometrías`);
    } catch (e) {
      console.error('[Offline] Error guardando datos:', e);
    }
  }, [proyectoId, refreshStats]);

  // Guardar cambio localmente cuando está offline
  const saveChangeOffline = useCallback(async (tipo, datos) => {
    try {
      const cambioId = await saveCambioPendiente({
        tipo,
        proyecto_id: proyectoId,
        datos,
        creado_offline: true
      });
      
      // También actualizar el predio localmente
      if (datos.codigo_predial) {
        const proyecto = await getProyectoOffline(proyectoId);
        await updatePredioOffline(proyectoId, datos.codigo_predial, datos, proyecto?.municipio);
      }
      
      await refreshStats();
      
      if (!navigator.onLine) {
        toast.info('Cambio guardado localmente', { description: 'Se sincronizará cuando haya conexión' });
      }
      
      return cambioId;
    } catch (e) {
      console.error('[Offline] Error guardando cambio:', e);
      toast.error('Error guardando cambio offline');
      return null;
    }
  }, [proyectoId, refreshStats]);

  // Detectar cambios de conexión
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      console.log('[Offline] Conexión restaurada');
      
      // IMPORTANTE: Sincronizar TODOS los cambios pendientes de CUALQUIER proyecto
      // No filtrar por proyectoId actual para no perder cambios de otros proyectos
      const todosLosCambios = await getCambiosPendientes(null); // null = sin filtro de proyecto
      if (todosLosCambios.length > 0) {
        toast.info(`Sincronizando ${todosLosCambios.length} cambio(s) pendiente(s)...`);
        await syncAllPendingChanges(true); // Nueva función que sincroniza TODO
      }
      
      // Descargar datos frescos en segundo plano solo si hay proyectoId
      if (proyectoId) {
        downloadFreshData(false);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Sin conexión', { 
        description: 'Trabajando en modo offline. Los cambios se guardarán localmente.',
        duration: 5000
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [proyectoId, modulo, syncAllPendingChanges, downloadFreshData]);

  // Inicializar DB y cargar última sincronización
  useEffect(() => {
    mountedRef.current = true;
    
    const init = async () => {
      try {
        await initOfflineDB();
        
        if (proyectoId && mountedRef.current) {
          const hasData = await hasOfflineData(proyectoId);
          setHasOffline(hasData);
          
          const lastSyncTime = await getLastSync(proyectoId);
          setLastSyncState(lastSyncTime);
          
          await refreshStats();
        }
      } catch (e) {
        console.log('[useOfflineSync] Error init:', e.message);
      }
    };
    
    init();
    
    return () => {
      mountedRef.current = false;
    };
  }, [proyectoId, refreshStats]);

  // Sincronización automática en segundo plano cuando está online
  useEffect(() => {
    if (!isOnline || !proyectoId) {
      if (backgroundIntervalRef.current) {
        clearInterval(backgroundIntervalRef.current);
        backgroundIntervalRef.current = null;
      }
      return;
    }

    // Sincronización inicial al montar (si está online)
    const initialSync = async () => {
      const cambios = await getCambiosPendientes(proyectoId);
      if (cambios.length > 0) {
        await syncPendingChanges(false);
      }
    };
    initialSync();

    // Configurar intervalo de sincronización en segundo plano
    backgroundIntervalRef.current = setInterval(async () => {
      if (navigator.onLine && proyectoId && !syncingRef.current) {
        console.log('[Sync] Sincronización automática en segundo plano...');
        
        // Primero subir cambios pendientes
        const cambios = await getCambiosPendientes(proyectoId);
        if (cambios.length > 0) {
          await syncPendingChanges(false);
        }
        
        // Luego descargar datos frescos
        await downloadFreshData(false);
      }
    }, BACKGROUND_SYNC_INTERVAL);

    return () => {
      if (backgroundIntervalRef.current) {
        clearInterval(backgroundIntervalRef.current);
        backgroundIntervalRef.current = null;
      }
    };
  }, [isOnline, proyectoId, syncPendingChanges, downloadFreshData]);

  // Escuchar eventos de actualización de datos offline
  useEffect(() => {
    const handleOfflineUpdate = () => {
      refreshStats();
    };
    
    window.addEventListener('offlineDataUpdated', handleOfflineUpdate);
    return () => window.removeEventListener('offlineDataUpdated', handleOfflineUpdate);
  }, [refreshStats]);

  // Verificar si necesita sincronización inicial
  const checkInitialSync = useCallback(async () => {
    try {
      // Verificar si hay cambios pendientes
      const cambios = await getCambiosPendientes(proyectoId);
      if (cambios.length > 0) {
        return true; // Necesita sincronizar cambios pendientes
      }
      
      // Verificar si tiene datos offline pero nunca se ha sincronizado
      const hasData = await hasOfflineData(proyectoId);
      const syncTime = await getLastSync(proyectoId);
      
      if (hasData && !syncTime) {
        return true; // Tiene datos pero nunca sincronizado
      }
      
      // Verificar si la última sincronización fue hace más de 24 horas
      if (syncTime) {
        const lastSyncDate = new Date(syncTime);
        const now = new Date();
        const hoursSinceSync = (now - lastSyncDate) / (1000 * 60 * 60);
        if (hoursSinceSync > 24) {
          return true; // Más de 24 horas sin sincronizar
        }
      }
      
      return false;
    } catch (e) {
      console.log('[useOfflineSync] Error en checkInitialSync:', e.message);
      return false;
    }
  }, [proyectoId]);

  // Realizar sincronización completa (guardar datos para offline)
  const performFullSync = useCallback(async (predios, geometrias) => {
    try {
      const storeId = proyectoId;
      
      // Primero sincronizar cambios pendientes al servidor
      if (navigator.onLine) {
        await syncPendingChanges(false);
      }
      
      // Guardar predios si se proporcionan
      if (predios?.length > 0) {
        const proyecto = await getProyectoOffline(proyectoId);
        const municipio = proyecto?.municipio;
        await savePrediosOffline(storeId, predios, municipio);
      }
      
      // Guardar geometrías si se proporcionan
      if (geometrias) {
        const geomArray = geometrias.features || geometrias;
        if (geomArray?.length > 0) {
          await saveGeometriasOffline(storeId, geomArray);
        }
      }
      
      // Actualizar última sincronización
      await setLastSync(storeId);
      setLastSyncState(new Date().toISOString());
      setHasOffline(true);
      await refreshStats();
      
      console.log('[useOfflineSync] Sincronización completa realizada');
      return true;
    } catch (e) {
      console.error('[useOfflineSync] Error en performFullSync:', e);
      return false;
    }
  }, [proyectoId, syncPendingChanges, refreshStats]);

  // Saltar sincronización inicial (para continuar sin sincronizar)
  const skipInitialSync = useCallback(() => {
    console.log('[useOfflineSync] Sincronización inicial omitida por el usuario');
  }, []);

  return {
    // Estado
    isOnline,
    isSyncing,
    isBackgroundSyncing,
    offlineStats,
    hasOffline,
    lastSync,
    syncProgress,
    pendingChangesCount,
    
    // Acciones
    downloadForOffline,
    downloadFreshData,
    syncPendingChanges,
    syncAllPendingChanges, // NUEVO: Sincroniza cambios de TODOS los proyectos
    saveChangeOffline,
    refreshStats,
    checkInitialSync,
    performFullSync,
    skipInitialSync,
    
    // Utilidades para acceso a datos offline
    getPrediosOffline: () => getPrediosOffline(proyectoId),
    getGeometriasOffline: () => getGeometriasOffline(proyectoId),
    getProyectoOffline: () => getProyectoOffline(proyectoId)
  };
}

export default useOfflineSync;
