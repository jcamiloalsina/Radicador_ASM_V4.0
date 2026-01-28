import React, { useState, useEffect } from 'react';
import { 
  WifiOff, Wifi, Download, X, RefreshCw, CheckCircle, AlertTriangle, 
  CloudOff, Database, Trash2, HardDrive, Loader2, MapPin, FolderKanban,
  Map, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { useOffline } from '../hooks/useOffline';
import { clearAllOfflineData } from '../utils/offlineDB';

// ==================== BANNER DE MODO OFFLINE ====================
export function OfflineBanner({ onViewData }) {
  const { isOnline, offlineData } = useOffline();
  
  if (isOnline) return null;
  
  return (
    <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <WifiOff className="w-4 h-4" />
        <span className="font-medium">Sin conexión</span>
        <span className="text-amber-100 text-sm">
          - Solo datos previamente descargados están disponibles
        </span>
      </div>
      <Button 
        variant="ghost" 
        size="sm" 
        className="text-white hover:bg-amber-600"
        onClick={onViewData}
      >
        Ver datos disponibles
      </Button>
    </div>
  );
}

// ==================== BARRA DE PROGRESO DE DESCARGA ====================
export function DownloadProgressBar({ 
  isDownloading, 
  progress, 
  total, 
  current, 
  label,
  onCancel 
}) {
  if (!isDownloading) return null;
  
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  
  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-white border border-slate-200 rounded-lg shadow-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Download className="w-4 h-4 text-emerald-600 animate-bounce" />
          <span className="text-sm font-medium text-slate-700">
            Guardando para offline
          </span>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      
      <p className="text-xs text-slate-500 mb-2">{label}</p>
      
      <Progress value={percentage} className="h-2 mb-1" />
      
      <div className="flex justify-between text-xs text-slate-500">
        <span>{current.toLocaleString()} de {total.toLocaleString()}</span>
        <span>{percentage}%</span>
      </div>
    </div>
  );
}

// ==================== INDICADOR OFFLINE FLOTANTE ====================
export function OfflineIndicator() {
  const { isOnline, offlineData, cacheStatus } = useOffline();
  
  if (isOnline) return null;
  
  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-sm">
      <div className={`${cacheStatus.ready ? 'bg-amber-500' : 'bg-red-500'} text-white px-4 py-3 rounded-lg shadow-lg`}>
        <div className="flex items-center gap-2 mb-2">
          <WifiOff className="w-5 h-5" />
          <span className="font-semibold">Sin conexión a Internet</span>
        </div>
        
        {offlineData.prediosCount > 0 || offlineData.petitionsCount > 0 ? (
          <div className="text-sm text-amber-100">
            <div className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              <span>Datos offline disponibles</span>
            </div>
            {offlineData.prediosCount > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <Database className="w-4 h-4" />
                <span>{offlineData.prediosCount.toLocaleString()} predios guardados</span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-red-100">
            <div className="flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              <span>No hay datos descargados</span>
            </div>
            <p className="mt-1 text-xs">
              Conéctese a internet y visite los módulos para descargar datos.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== INDICADOR CONEXIÓN RESTAURADA ====================
export function OnlineIndicator() {
  const { isOnline } = useOffline();
  const [showOnline, setShowOnline] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  
  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline) {
      setShowOnline(true);
      const timer = setTimeout(() => {
        setShowOnline(false);
        setWasOffline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);
  
  if (!showOnline) return null;
  
  return (
    <div className="fixed bottom-4 left-4 z-50 bg-emerald-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
      <Wifi className="w-4 h-4" />
      <span className="text-sm font-medium">Conexión restaurada</span>
    </div>
  );
}

// ==================== PANEL DE ESTADO OFFLINE DETALLADO ====================
export function OfflineStatusPanel({ isOpen, onClose, offlineModules = [] }) {
  const { offlineData, clearOfflineData } = useOffline();
  const [clearing, setClearing] = useState(false);
  
  if (!isOpen) return null;
  
  const handleClearCache = async () => {
    if (window.confirm('¿Está seguro de eliminar todos los datos offline? Tendrá que descargarlos nuevamente.')) {
      setClearing(true);
      await clearOfflineData();
      setClearing(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-emerald-600" />
            <h3 className="font-semibold text-slate-800">Estado de Datos Offline</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {/* Resumen general */}
          <div className="bg-slate-50 rounded-lg p-3 mb-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Predios guardados:</span>
                <p className="font-semibold text-slate-800">{offlineData.prediosCount?.toLocaleString() || 0}</p>
              </div>
              <div>
                <span className="text-slate-500">Última sincronización:</span>
                <p className="font-semibold text-slate-800">
                  {offlineData.lastSync 
                    ? new Date(offlineData.lastSync).toLocaleString('es-CO') 
                    : 'Nunca'}
                </p>
              </div>
            </div>
          </div>
          
          {/* Lista de módulos */}
          <h4 className="text-sm font-medium text-slate-600 mb-2">Módulos y datos disponibles:</h4>
          <div className="space-y-2">
            {offlineModules.length > 0 ? (
              offlineModules.map((mod, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      mod.status === 'ready' ? 'bg-emerald-500' :
                      mod.status === 'partial' ? 'bg-amber-500' : 'bg-slate-300'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-slate-700">{mod.name}</p>
                      <p className="text-xs text-slate-500">{mod.description}</p>
                    </div>
                  </div>
                  {mod.count > 0 && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                      {mod.count.toLocaleString()} items
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500">
                <CloudOff className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">No hay datos descargados</p>
                <p className="text-xs mt-1">Visite los módulos con conexión para descargar datos</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between">
          <Button 
            variant="outline" 
            size="sm"
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={handleClearCache}
            disabled={clearing}
          >
            {clearing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
            Limpiar caché
          </Button>
          <Button onClick={onClose} size="sm">
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ==================== BADGE DE ESTADO OFFLINE (HEADER) ====================
export function OfflineReadyBadge() {
  const { isOnline, cacheStatus, offlineData, forceCacheResources, refreshStats } = useOffline();
  const [expanded, setExpanded] = useState(false);
  const [caching, setCaching] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  
  const handleForceCache = async () => {
    setCaching(true);
    await forceCacheResources();
    setCaching(false);
  };
  
  const handleExpand = async () => {
    if (!expanded) {
      await refreshStats();
    }
    setExpanded(!expanded);
  };
  
  if (!isOnline) return null;
  
  const hasRealData = offlineData.prediosCount > 0 || offlineData.petitionsCount > 0 || offlineData.proyectosCount > 0 || offlineData.geometriasCount > 0;
  const isReallyReady = hasRealData;
  
  // Calcular total de datos offline
  const totalOffline = (offlineData.prediosCount || 0) + (offlineData.proyectosCount || 0) + (offlineData.geometriasCount || 0);
  
  // Construir lista de módulos offline
  const offlineModules = [];
  if (offlineData.proyectosCount > 0) {
    offlineModules.push({
      name: 'Proyectos de Actualización',
      description: 'Proyectos descargados para consulta offline',
      status: 'ready',
      count: offlineData.proyectosCount
    });
  }
  if (offlineData.prediosCount > 0) {
    offlineModules.push({
      name: 'Gestión de Predios',
      description: 'Predios descargados para consulta offline',
      status: 'ready',
      count: offlineData.prediosCount
    });
  }
  if (offlineData.geometriasCount > 0) {
    offlineModules.push({
      name: 'Visor de Predios',
      description: 'Geometrías del mapa descargadas',
      status: 'ready',
      count: offlineData.geometriasCount
    });
  }
  if (offlineData.petitionsCount > 0) {
    offlineModules.push({
      name: 'Peticiones',
      description: 'Peticiones descargadas',
      status: 'ready',
      count: offlineData.petitionsCount
    });
  }
  
  return (
    <>
      <div className="relative">
        <button
          onClick={handleExpand}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            isReallyReady 
              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
          title={isReallyReady ? 'Datos offline disponibles' : 'Sin datos offline'}
        >
          {cacheStatus.checking ? (
            <>
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Verificando...</span>
            </>
          ) : isReallyReady ? (
            <>
              <CheckCircle className="w-3 h-3" />
              <span>Offline ({((offlineData.prediosCount || 0) + (offlineData.proyectosCount || 0)).toLocaleString()})</span>
            </>
          ) : (
            <>
              <CloudOff className="w-3 h-3" />
              <span>Sin datos offline</span>
            </>
          )}
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        
        {expanded && (
          <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-xl p-4 z-50">
            <div className="flex justify-between items-start mb-3">
              <h4 className="font-semibold text-slate-800">Estado Offline</h4>
              <button onClick={() => setExpanded(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-3">
              {/* Datos guardados */}
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600">Predios guardados:</span>
                  <span className={`text-sm font-bold ${offlineData.prediosCount > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {offlineData.prediosCount?.toLocaleString() || 0}
                  </span>
                </div>
                {offlineData.lastSync && (
                  <p className="text-xs text-slate-500">
                    Última sync: {new Date(offlineData.lastSync).toLocaleString('es-CO')}
                  </p>
                )}
              </div>
              
              {/* Info */}
              <div className="text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded p-2">
                <p className="font-medium text-blue-700 mb-1">💡 Sincronización manual</p>
                <p>Los datos se cargan desde cache. Use el botón Sincronizar en cada módulo para actualizar.</p>
              </div>
              
              {/* Botones de acción */}
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => {
                    setExpanded(false);
                    setShowPanel(true);
                  }}
                >
                  <Database className="w-4 h-4 mr-1" />
                  Ver detalles
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-red-600 hover:bg-red-50"
                  onClick={async () => {
                    if (window.confirm('¿Eliminar todos los datos guardados offline? Esto no afecta los datos del servidor.')) {
                      await clearAllOfflineData();
                      setExpanded(false);
                      window.location.reload();
                    }
                  }}
                  title="Limpiar datos offline"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <OfflineStatusPanel 
        isOpen={showPanel} 
        onClose={() => setShowPanel(false)}
        offlineModules={offlineModules}
      />
    </>
  );
}

// ==================== INDICADOR DE MÓDULO EN MENÚ ====================
export function ModuleOfflineIndicator({ moduleId, count = 0 }) {
  if (count > 0) {
    return (
      <span className="w-2 h-2 rounded-full bg-emerald-500" title={`${count} items disponibles offline`} />
    );
  }
  return (
    <span className="w-2 h-2 rounded-full bg-slate-300" title="Requiere conexión" />
  );
}

// ==================== PWA INSTALL PROMPT ====================
export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Solo mostrar si no se ha instalado
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      if (!isStandalone) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border border-slate-200 rounded-lg shadow-xl p-4 max-w-sm">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <Download className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-slate-800">Instalar aplicación</h4>
          <p className="text-sm text-slate-500 mt-1">
            Instale la app para acceso rápido y uso offline
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={handleInstall}>
              Instalar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowPrompt(false)}>
              Ahora no
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}



// ==================== SYNC PETITIONS BUTTON ====================
export function SyncPetitionsButton({ onFetchPetitions }) {
  const { isOnline } = useOffline();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    if (!isOnline || !onFetchPetitions) return;
    
    setSyncing(true);
    try {
      await onFetchPetitions();
    } finally {
      setSyncing(false);
    }
  };

  if (!isOnline) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSync}
      disabled={syncing}
      className="gap-2"
    >
      {syncing ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      {syncing ? 'Sincronizando...' : 'Guardar offline'}
    </Button>
  );
}
