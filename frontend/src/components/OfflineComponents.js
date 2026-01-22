import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, Download, X, RefreshCw, CheckCircle, AlertTriangle, CloudOff, Database } from 'lucide-react';
import { Button } from './ui/button';
import { useOffline } from '../hooks/useOffline';

// Offline Status Indicator (shows when offline)
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
        
        {cacheStatus.ready ? (
          <div className="text-sm text-amber-100">
            <div className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              <span>Modo offline disponible</span>
            </div>
            {offlineData.prediosCount > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <Database className="w-4 h-4" />
                <span>{offlineData.prediosCount} predios guardados</span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-red-100">
            <div className="flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              <span>Archivos no cacheados</span>
            </div>
            <p className="mt-1 text-xs">
              Necesita conectarse a internet primero para cachear los archivos de la aplicación.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Online Status Restored
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

// Offline Ready Status Badge (shows cache status)
export function OfflineReadyBadge() {
  const { isOnline, cacheStatus, offlineData, forceCacheResources } = useOffline();
  const [expanded, setExpanded] = useState(false);
  const [caching, setCaching] = useState(false);
  
  const handleForceCache = async () => {
    setCaching(true);
    await forceCacheResources();
    setCaching(false);
  };
  
  // Don't show when offline (OfflineIndicator handles that)
  if (!isOnline) return null;
  
  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
          cacheStatus.ready 
            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
            : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
        }`}
        title={cacheStatus.ready ? 'Listo para uso offline' : 'Modo offline no disponible'}
      >
        {cacheStatus.checking ? (
          <>
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Verificando...</span>
          </>
        ) : cacheStatus.ready ? (
          <>
            <CheckCircle className="w-3 h-3" />
            <span>Offline listo</span>
          </>
        ) : (
          <>
            <CloudOff className="w-3 h-3" />
            <span>Offline no disponible</span>
          </>
        )}
      </button>
      
      {expanded && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-slate-200 rounded-lg shadow-xl p-4 z-50">
          <div className="flex justify-between items-start mb-3">
            <h4 className="font-semibold text-slate-800">Estado Offline</h4>
            <button onClick={() => setExpanded(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-3">
            {/* Cache Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Archivos cacheados:</span>
              <span className={`text-sm font-medium ${cacheStatus.staticCached ? 'text-emerald-600' : 'text-red-600'}`}>
                {cacheStatus.staticCached ? '✓ Sí' : '✗ No'}
              </span>
            </div>
            
            {/* Data Cache */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Datos cacheados:</span>
              <span className={`text-sm font-medium ${cacheStatus.dataCached ? 'text-emerald-600' : 'text-amber-600'}`}>
                {cacheStatus.dataCached ? '✓ Sí' : '○ No'}
              </span>
            </div>
            
            {/* Predios Count */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Predios guardados:</span>
              <span className="text-sm font-medium text-slate-800">
                {offlineData.prediosCount}
              </span>
            </div>
            
            {/* Last Sync */}
            {offlineData.lastSync && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Última sincronización:</span>
                <span className="text-xs text-slate-500">
                  {new Date(offlineData.lastSync).toLocaleString('es-CO', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            )}
            
            {/* Status Message */}
            <div className={`p-2 rounded text-xs ${
              cacheStatus.ready 
                ? 'bg-emerald-50 text-emerald-700' 
                : 'bg-amber-50 text-amber-700'
            }`}>
              {cacheStatus.ready ? (
                <>
                  <CheckCircle className="w-3 h-3 inline mr-1" />
                  La aplicación está lista para funcionar sin conexión.
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                  {cacheStatus.reason}
                </>
              )}
            </div>
            
            {/* Force Cache Button */}
            {!cacheStatus.ready && (
              <Button
                size="sm"
                onClick={handleForceCache}
                disabled={caching}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {caching ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Cacheando...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Preparar modo offline
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// PWA Install Prompt
export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  
  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }
    
    // Check localStorage for dismissed prompt
    const dismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        return; // Don't show for 7 days after dismissal
      }
    }
    
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };
    
    window.addEventListener('beforeinstallprompt', handler);
    
    // Also show after 30 seconds if not installed
    const timer = setTimeout(() => {
      if (!isInstalled && deferredPrompt) {
        setShowPrompt(true);
      }
    }, 30000);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timer);
    };
  }, [isInstalled, deferredPrompt]);
  
  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };
  
  const handleDismiss = () => {
    localStorage.setItem('pwa-prompt-dismissed', new Date().toISOString());
    setShowPrompt(false);
  };
  
  if (!showPrompt || isInstalled) return null;
  
  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 bg-white border border-emerald-200 rounded-lg shadow-xl p-4">
      <button 
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-slate-400 hover:text-slate-600"
      >
        <X className="w-4 h-4" />
      </button>
      
      <div className="flex items-start gap-3">
        <div className="bg-emerald-100 p-2 rounded-lg">
          <Download className="w-6 h-6 text-emerald-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-slate-800 text-sm">
            Instalar Asomunicipios
          </h3>
          <p className="text-xs text-slate-600 mt-1">
            Instala la app para acceder más rápido y usar sin conexión
          </p>
          <div className="flex gap-2 mt-3">
            <Button 
              size="sm" 
              onClick={handleInstall}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            >
              Instalar
            </Button>
            <Button 
              size="sm" 
              variant="ghost"
              onClick={handleDismiss}
              className="text-xs"
            >
              Ahora no
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Sync Button for offline data
export function SyncButton({ onSync, municipio }) {
  const { isOnline, savePrediosOffline, offlineData } = useOffline();
  const [syncing, setSyncing] = useState(false);
  
  const handleSync = async () => {
    if (!isOnline || syncing) return;
    
    setSyncing(true);
    try {
      const data = await onSync(municipio);
      if (data && data.length > 0) {
        await savePrediosOffline(data);
      }
    } catch (error) {
      console.error('Error syncing:', error);
    } finally {
      setSyncing(false);
    }
  };
  
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSync}
      disabled={!isOnline || syncing}
      className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
      title={offlineData.lastSync ? `Última sincronización: ${new Date(offlineData.lastSync).toLocaleString()}` : 'Guardar para uso offline'}
    >
      <RefreshCw className={`w-4 h-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
      {syncing ? 'Sincronizando...' : 'Guardar offline'}
    </Button>
  );
}

export default OfflineIndicator;
