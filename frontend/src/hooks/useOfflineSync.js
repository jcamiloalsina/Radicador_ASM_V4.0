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
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false); // Sincronización en segundo plano
  const [backgroundSyncMessage, setBackgroundSyncMessage] = useState(''); // Mensaje de sincronización en segundo plano
  const [wasOfflineWorking, setWasOfflineWorking] = useState(false); // Indica si estuvo trabajando offline
  
  // Ref para evitar dependencias circulares
  const syncingRef = useRef(false);
  const backgroundSyncRef = useRef(false);
  
  // Intervalo para sincronización automática en segundo plano (1 hora)
  const BACKGROUND_SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hora

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
      
      if (wasOffline && proyectoId) {
        // SE RECONECTÓ - SIEMPRE BLOQUEAR con modal para sincronizar
        console.log('[Offline] Conexión restaurada - BLOQUEANDO para sincronizar');
        
        try {
          const cambios = await getCambiosPendientes(proyectoId);
          
          // SIEMPRE mostrar modal bloqueante al reconectarse
          setRequiresSync(true);
          setIsInitialSyncComplete(false);
          setWasOfflineWorking(true);
          
          if (cambios.length > 0) {
            setSyncProgress({ 
              current: 0, 
              total: cambios.length, 
              message: `Conexión restaurada. Subiendo ${cambios.length} cambio(s) de trabajo de campo...` 
            });
          } else {
            setSyncProgress({ 
              current: 0, 
              total: 0, 
              message: 'Conexión restaurada. Actualizando datos del servidor...' 
            });
          }
        } catch (e) {
          console.error('[Offline] Error al verificar:', e);
          // Aún así mostrar modal para sincronizar
          setRequiresSync(true);
          setIsInitialSyncComplete(false);
          setSyncProgress({ current: 0, total: 0, message: 'Conexión restaurada. Sincronizando...' });
        }
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOfflineWorking(true);
      toast.warning('Sin conexión', { description: 'Trabajando en modo offline. Los cambios se guardarán localmente.' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [proyectoId, isOnline]);
  
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

  // Verificar si necesita sincronización al inicio
  // El modal aparece solo si hay cambios pendientes de subir
  // Si no hay cambios, permite trabajar y sincroniza cada 1 hora en segundo plano
  const checkInitialSync = useCallback(async () => {
    if (!proyectoId) {
      setIsInitialSyncComplete(true);
      return false;
    }
    
    // Si está offline, permitir trabajar sin bloquear
    if (!isOnline) {
      console.log('[Offline] Sin conexión - permitiendo trabajo offline');
      setIsInitialSyncComplete(true);
      return false;
    }
    
    try {
      // Inicializar DB primero (con timeout de 5 segundos)
      const initPromise = initOfflineDB();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('DB init timeout')), 5000)
      );
      
      try {
        await Promise.race([initPromise, timeoutPromise]);
      } catch (dbError) {
        console.warn('[Offline] IndexedDB no disponible:', dbError.message);
      }
      
      // Verificar si hay cambios pendientes de subir
      const cambiosPendientes = await getCambiosPendientes(proyectoId);
      
      // Si hay cambios pendientes, BLOQUEAR con modal (es crítico subirlos)
      if (cambiosPendientes.length > 0) {
        console.log('[Offline] Hay cambios pendientes - BLOQUEANDO:', cambiosPendientes.length);
        setSyncProgress({ 
          current: 0, 
          total: cambiosPendientes.length, 
          message: `${cambiosPendientes.length} cambio(s) de trabajo de campo por subir` 
        });
        setRequiresSync(true);
        return true;
      }
      
      // Sin cambios pendientes - permitir trabajar e iniciar sync cada 1 hora
      console.log('[Offline] Sin cambios pendientes - iniciando sync automático cada 1 hora');
      setIsInitialSyncComplete(true);
      setRequiresSync(false);
      startBackgroundSync();
      return false;
    } catch (error) {
      console.error('[Offline] Error verificando sync:', error);
      setIsInitialSyncComplete(true);
      setRequiresSync(false);
      return false;
    }
  }, [proyectoId, isOnline]);
  
  // Sincronización en segundo plano (sin interrumpir al usuario)
  const performBackgroundSync = useCallback(async () => {
    if (!proyectoId || !isOnline || backgroundSyncRef.current || syncingRef.current) {
      return;
    }
    
    backgroundSyncRef.current = true;
    setIsBackgroundSyncing(true);
    
    try {
      // Verificar cambios pendientes
      const cambiosPendientes = await getCambiosPendientes(proyectoId);
      
      if (cambiosPendientes.length > 0) {
        setBackgroundSyncMessage(`Subiendo ${cambiosPendientes.length} cambio(s)...`);
        
        // Sincronizar cambios silenciosamente
        const token = localStorage.getItem('token');
        let sincronizados = 0;
        
        for (const cambio of cambiosPendientes) {
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
            }
            
            await eliminarCambioSincronizado(cambio.id);
            sincronizados++;
          } catch (error) {
            console.warn(`[BackgroundSync] Error con cambio ${cambio.id}:`, error.message);
          }
        }
        
        if (sincronizados > 0) {
          setBackgroundSyncMessage(`✓ ${sincronizados} cambio(s) sincronizado(s)`);
          toast.success(`${sincronizados} cambio(s) sincronizado(s) en segundo plano`, { duration: 3000 });
          await refreshStats();
        }
      } else {
        setBackgroundSyncMessage('Datos sincronizados');
      }
      
      // Actualizar timestamp de última sincronización exitosa
      const now = new Date().toISOString();
      await saveConfig(`lastSync_${proyectoId}`, now);
      setLastSync(now);
      
    } catch (error) {
      console.warn('[BackgroundSync] Error:', error.message);
      setBackgroundSyncMessage('');
    } finally {
      backgroundSyncRef.current = false;
      setIsBackgroundSyncing(false);
      // Limpiar mensaje después de 3 segundos
      setTimeout(() => setBackgroundSyncMessage(''), 3000);
    }
  }, [proyectoId, isOnline, refreshStats]);
  
  // Iniciar sincronización en segundo plano periódica
  const backgroundSyncIntervalRef = useRef(null);
  
  const startBackgroundSync = useCallback(() => {
    // Limpiar intervalo anterior si existe
    if (backgroundSyncIntervalRef.current) {
      clearInterval(backgroundSyncIntervalRef.current);
    }
    
    // Ejecutar inmediatamente una vez
    setTimeout(() => performBackgroundSync(), 2000);
    
    // Configurar intervalo periódico (cada 5 minutos)
    backgroundSyncIntervalRef.current = setInterval(() => {
      if (navigator.onLine) {
        performBackgroundSync();
      }
    }, BACKGROUND_SYNC_INTERVAL_MS);
    
    console.log('[BackgroundSync] Sincronización automática activada (cada 5 min)');
  }, [performBackgroundSync]);
  
  // Limpiar intervalo al desmontar
  useEffect(() => {
    return () => {
      if (backgroundSyncIntervalRef.current) {
        clearInterval(backgroundSyncIntervalRef.current);
      }
    };
  }, []);

  // Ejecutar sincronización completa (descarga + subida)
  const performFullSync = useCallback(async (prediosData, geometriasData) => {
    if (!proyectoId || !isOnline) {
      toast.error('Sin conexión a internet');
      return false;
    }
    
    setIsSyncing(true);
    setSyncProgress({ current: 0, total: 4, message: 'Iniciando sincronización...' });
    
    try {
      // Paso 1: Subir cambios pendientes al servidor (lo más importante)
      setSyncProgress({ current: 1, total: 4, message: 'Subiendo cambios pendientes...' });
      try {
        const cambiosPendientes = await getCambiosPendientes(proyectoId);
        if (cambiosPendientes && cambiosPendientes.length > 0) {
          await syncChangesDirectly(cambiosPendientes, setIsSyncing, refreshStats);
        }
      } catch (e) {
        console.warn('[Sync] Error subiendo cambios (continuando):', e.message);
      }
      
      // Paso 2: Guardar predios en caché local (opcional - no crítico)
      setSyncProgress({ current: 2, total: 4, message: 'Actualizando caché local...' });
      try {
        if (prediosData && prediosData.length > 0) {
          await savePrediosOffline(proyectoId, prediosData);
        }
      } catch (e) {
        console.warn('[Sync] Error guardando predios offline (continuando):', e.message);
      }
      
      // Paso 3: Guardar geometrías en caché local (opcional - no crítico)
      setSyncProgress({ current: 3, total: 4, message: 'Actualizando geometrías...' });
      try {
        if (geometriasData) {
          const features = geometriasData.features || geometriasData;
          if (features && features.length > 0) {
            await saveGeometriasOffline(proyectoId, features);
          }
        }
      } catch (e) {
        console.warn('[Sync] Error guardando geometrías offline (continuando):', e.message);
      }
      
      // Paso 4: Guardar fecha de sincronización
      setSyncProgress({ current: 4, total: 4, message: 'Finalizando...' });
      try {
        const now = new Date().toISOString();
        await saveConfig(`lastSync_${proyectoId}`, now);
        setLastSync(now);
        
        // Guardar fecha del modal para no mostrar por 24 horas
        const lastSyncModalKey = `lastSyncModal_${proyectoId}`;
        localStorage.setItem(lastSyncModalKey, now);
        console.log('[Sync] Próximo modal de sincronización en 24 horas');
        
        // Iniciar sincronización en segundo plano para el resto del día
        startBackgroundSync();
      } catch (e) {
        console.warn('[Sync] Error guardando config (continuando):', e.message);
      }
      
      try {
        await refreshStats();
      } catch (e) {
        // Ignorar error de stats
      }
      
      setRequiresSync(false);
      setIsInitialSyncComplete(true);
      
      toast.success('Sincronización completada', {
        description: `${prediosData?.length || 0} predios sincronizados`
      });
      
      return true;
    } catch (error) {
      console.error('[Offline] Error en sincronización completa:', error);
      // Aún así marcar como completada para no bloquear
      setRequiresSync(false);
      setIsInitialSyncComplete(true);
      return true; // Retornar true para permitir continuar
    } finally {
      setIsSyncing(false);
      setSyncProgress({ current: 0, total: 0, message: '' });
    }
  }, [proyectoId, isOnline, refreshStats]);

  // Marcar sincronización como completada manualmente
  const skipInitialSync = useCallback(() => {
    setRequiresSync(false);
    setIsInitialSyncComplete(true);
    
    // Guardar fecha del modal para no mostrar por 24 horas
    const lastSyncModalKey = `lastSyncModal_${proyectoId}`;
    localStorage.setItem(lastSyncModalKey, new Date().toISOString());
    
    // Iniciar sincronización en segundo plano
    startBackgroundSync();
    
    toast.info('Sincronización en segundo plano', {
      description: 'Los datos se sincronizarán automáticamente'
    });
  }, [proyectoId, startBackgroundSync]);

  return {
    isOnline,
    isSyncing,
    offlineStats,
    hasOffline,
    lastSync,
    requiresSync,
    syncProgress,
    isInitialSyncComplete,
    isBackgroundSyncing,
    backgroundSyncMessage,
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
    startBackgroundSync,
    performBackgroundSync,
    getPrediosOffline
  };
}

export default useOfflineSync;
