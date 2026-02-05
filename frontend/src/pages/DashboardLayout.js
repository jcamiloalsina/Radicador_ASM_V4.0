import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { LogOut, FileText, Activity, Users, Menu, X, UserCog, BarChart3, MapPin, Map, Clock, Shield, AlertTriangle, ChevronDown, ChevronRight, FolderKanban, Layers, RefreshCcw, GitCompare, ShieldCheck, WifiOff, UserCheck } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { OfflineReadyBadge, OfflineBanner, OfflineStatusPanel } from '../components/OfflineComponents';
import { useOffline } from '../hooks/useOffline';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Componente para sección colapsable del menú
function MenuSection({ title, icon: Icon, children, isOpen, onToggle, accentColor = 'emerald', testId }) {
  const colorClasses = {
    emerald: {
      bg: 'bg-emerald-800/30',
      text: 'text-emerald-200',
      iconBg: 'bg-emerald-700/50'
    },
    amber: {
      bg: 'bg-amber-900/20',
      text: 'text-amber-200',
      iconBg: 'bg-amber-700/50'
    }
  };
  
  const colors = colorClasses[accentColor] || colorClasses.emerald;
  
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger 
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg ${colors.bg} hover:bg-opacity-50 transition-colors mb-1`}
        data-testid={testId}
      >
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded ${colors.iconBg}`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <span className={`font-semibold text-sm ${colors.text}`}>{title}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-white/60" />
        ) : (
          <ChevronRight className="w-4 h-4 text-white/60" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 ml-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

// Componente MenuItem
function MenuItem({ item, isActive, onNavigate }) {
  const Icon = item.icon;
  const showBadge = item.badge && item.badge > 0;
  
  return (
    <Link
      to={item.path}
      onClick={onNavigate}
      className={`flex items-center justify-between px-3 py-2 rounded-md transition-colors text-sm ${
        isActive
          ? 'bg-emerald-800 text-white'
          : 'text-emerald-100 hover:bg-emerald-800/50 hover:text-white'
      }`}
      data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-center">
        <Icon className="w-4 h-4 mr-2.5" />
        {item.label}
      </div>
      {showBadge && (
        <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

export default function DashboardLayout() {
  const { user, logout, loading, showTimeoutWarning, extendSession } = useAuth();
  const { isOnline, offlineData } = useOffline();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cambiosPendientesCount, setCambiosPendientesCount] = useState(0);
  const [showOfflinePanel, setShowOfflinePanel] = useState(false);
  
  // Estado para banner de novedades
  const [showNovedadesBanner, setShowNovedadesBanner] = useState(false);
  const [novedadesDetalle, setNovedadesDetalle] = useState({
    cambios: 0,
    prediosNuevos: 0,
    reapariciones: 0
  });
  
  // Estado de secciones colapsables
  const [conservacionOpen, setConservacionOpen] = useState(true);
  const [actualizacionOpen, setActualizacionOpen] = useState(true);
  const [adminOpen, setAdminOpen] = useState(true);
  
  // Estado para alertas de cronograma
  const [alertasCronograma, setAlertasCronograma] = useState([]);
  const [showAlertaFlotante, setShowAlertaFlotante] = useState(false);

  const fetchCambiosPendientes = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Obtener todos los tipos de pendientes
      const [cambiosRes, prediosNuevosRes, reaparicionesRes] = await Promise.all([
        axios.get(`${API}/predios/cambios/stats`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { total_pendientes: 0 } })),
        axios.get(`${API}/predios-nuevos`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { predios: [] } })),
        axios.get(`${API}/predios/reapariciones/solicitudes-pendientes`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { solicitudes: [] } }))
      ]);
      
      const cambios = cambiosRes.data.total_pendientes || 0;
      const prediosData = prediosNuevosRes.data.predios || [];
      
      // Para coordinadores: contar predios en revisión
      // Para gestores: contar predios asignados a ellos en estado creado/digitalizacion/devuelto
      const isCoord = user && ['coordinador', 'administrador'].includes(user.role);
      let prediosNuevos = 0;
      if (isCoord) {
        prediosNuevos = prediosData.filter(p => (p.estado_flujo || p.estado) === 'revision').length;
      } else {
        prediosNuevos = prediosData.filter(p => 
          p.gestor_apoyo_id === user?.id && 
          ['creado', 'digitalizacion', 'devuelto'].includes(p.estado_flujo || p.estado)
        ).length;
      }
      
      const reapariciones = (reaparicionesRes.data.solicitudes || []).length;
      const total = cambios + prediosNuevos + reapariciones;
      
      setCambiosPendientesCount(total);
      setNovedadesDetalle({ cambios, prediosNuevos, reapariciones });
      
      // Mostrar banner si hay pendientes y no se ha cerrado en esta sesión
      const bannerCerrado = sessionStorage.getItem('novedadesBannerCerrado');
      if (total > 0 && !bannerCerrado) {
        setShowNovedadesBanner(true);
      }
    } catch (error) {
      console.error('Error fetching pending changes:', error);
    }
  }, []);

  const cerrarBannerNovedades = () => {
    setShowNovedadesBanner(false);
    sessionStorage.setItem('novedadesBannerCerrado', 'true');
  };

  const handleNotificationClick = (notif) => {
    // Marcar como leída
    marcarLeida(notif.id);
    setShowNotifications(false);
    
    // Navegar según el tipo de notificación
    const tipo = notif.tipo || '';
    if (tipo.includes('cambio') || tipo.includes('modificacion')) {
      navigate('/dashboard/pendientes?tab=modificaciones');
    } else if (tipo.includes('predio_nuevo') || tipo.includes('nuevo')) {
      navigate('/dashboard/pendientes?tab=predios-nuevos');
    } else if (tipo.includes('reaparicion')) {
      navigate('/dashboard/pendientes?tab=reapariciones');
    } else if (tipo.includes('peticion') && notif.referencia_id) {
      navigate(`/dashboard/peticiones/${notif.referencia_id}`);
    } else if (tipo.includes('certificado')) {
      navigate('/dashboard/certificados');
    } else {
      // Por defecto, ir a pendientes
      navigate('/dashboard/pendientes');
    }
  };

  const checkGdbAlert = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/gdb/verificar-alerta-mensual`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.mostrar_alerta) {
        toast.warning('Recordatorio: Es momento de cargar la base gráfica mensual', {
          duration: 10000,
          action: {
            label: 'Ir a Visor',
            onClick: () => window.location.href = '/dashboard/visor-predios'
          }
        });
      }
    } catch (error) {
      console.error('Error checking GDB alert:', error);
    }
  }, []);

  const fetchAlertasCronograma = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/actualizacion/alertas-proximas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const alertas = response.data.alertas || [];
      setAlertasCronograma(alertas);
      
      // Mostrar alerta flotante solo si hay alertas vencidas o urgentes
      const urgentes = alertas.filter(a => a.tipo_alerta === 'vencida' || a.tipo_alerta === 'urgente');
      if (urgentes.length > 0) {
        setShowAlertaFlotante(true);
      } else {
        setShowAlertaFlotante(false);
      }
    } catch (error) {
      console.error('Error fetching alertas cronograma:', error);
    }
  }, []);

  useEffect(() => {
    if (user) {
      checkGdbAlert();
      if (['administrador', 'coordinador'].includes(user.role) || user.permissions?.includes('approve_changes')) {
        fetchCambiosPendientes();
        fetchAlertasCronograma();
      }
    }
    
    // Listener para actualizar el badge cuando se aprueba/rechaza un pendiente
    const handlePendientesUpdated = () => {
      if (user && (['administrador', 'coordinador'].includes(user.role) || user.permissions?.includes('approve_changes'))) {
        fetchCambiosPendientes();
      }
    };
    
    window.addEventListener('pendientesUpdated', handlePendientesUpdated);
    return () => window.removeEventListener('pendientesUpdated', handlePendientesUpdated);
  }, [user, checkGdbAlert, fetchCambiosPendientes, fetchAlertasCronograma]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  // Agregar/quitar atributo al body cuando el sidebar está abierto (para CSS)
  useEffect(() => {
    if (sidebarOpen) {
      document.body.setAttribute('data-sidebar-open', 'true');
    } else {
      document.body.removeAttribute('data-sidebar-open');
    }
    return () => document.body.removeAttribute('data-sidebar-open');
  }, [sidebarOpen]);

  // Memoized role names
  const getRoleName = useCallback((role) => {
    const roles = {
      usuario: 'Usuario',
      atencion_usuario: 'Atención al Usuario',
      gestor: 'Gestor',
      coordinador: 'Coordinador',
      administrador: 'Administrador',
      comunicaciones: 'Comunicaciones'
    };
    return roles[role] || role;
  }, []);

  // Memoized menu items
  const menuData = useMemo(() => {
    if (!user) return { baseMenuItems: [], conservacionItems: [], actualizacionItems: [], adminItems: [] };

    const isStaff = user.role !== 'usuario';
    const canSeeAllPetitions = isStaff && user.role !== 'empresa';
    const isCoordAdmin = ['administrador', 'coordinador'].includes(user.role);
    const canManageUsers = ['administrador', 'coordinador', 'atencion_usuario'].includes(user.role);
    const canAccessActualizacion = ['administrador', 'coordinador', 'gestor'].includes(user.role);
    
    // Verificar si el usuario tiene permiso de aprobar cambios (gestores con este permiso pueden ver Pendientes)
    const userPermissions = user.permissions || [];
    const hasApprovePermission = userPermissions.includes('approve_changes');
    const canSeePendientes = isCoordAdmin || hasApprovePermission;
    
    // Todos los gestores pueden ver "Mis Asignaciones" (predios nuevos o modificaciones asignados a ellos)
    const canSeeMisAsignaciones = ['administrador', 'coordinador', 'gestor', 'atencion_usuario'].includes(user.role);

    const baseMenuItems = [
      { path: '/dashboard', label: 'Inicio', icon: Activity },
      { path: '/dashboard/peticiones', label: 'Mis Peticiones', icon: FileText },
    ];

    const conservacionItems = [];
    if (canSeeAllPetitions) {
      conservacionItems.push({ path: '/dashboard/todas-peticiones', label: 'Todas las Peticiones', icon: Users });
    }
    if (isStaff) {
      conservacionItems.push({ path: '/dashboard/predios', label: 'Gestión de Predios', icon: MapPin });
      conservacionItems.push({ path: '/dashboard/visor-predios', label: 'Visor de Predios', icon: Map });
      // Certificados solo para administrador, coordinador y atención al usuario
      const canSeeCertificados = ['administrador', 'coordinador', 'atencion_usuario'].includes(user.role);
      if (canSeeCertificados) {
        conservacionItems.push({ path: '/dashboard/certificados', label: 'Certificados', icon: ShieldCheck });
      }
    }
    // Mis Asignaciones: visible para todos los gestores (para ver predios nuevos y modificaciones asignados)
    if (canSeeMisAsignaciones && !canSeePendientes) {
      conservacionItems.push({ path: '/dashboard/pendientes?tab=mis-asignaciones', label: 'Mis Asignaciones', icon: UserCheck });
    }
    // Pendientes: visible para coordinadores, admins, o gestores con permiso approve_changes
    if (canSeePendientes) {
      conservacionItems.push({ path: '/dashboard/pendientes', label: 'Pendientes', icon: Clock, badge: cambiosPendientesCount });
    }

    const actualizacionItems = [];
    if (canAccessActualizacion) {
      actualizacionItems.push({ path: '/dashboard/proyectos-actualizacion', label: 'Proyectos', icon: FolderKanban });
    }
    // Gestión de Propuestas solo para coordinadores/admin
    if (isCoordAdmin) {
      actualizacionItems.push({ path: '/dashboard/gestion-propuestas', label: 'Gestión Propuestas', icon: GitCompare });
    }

    const adminItems = [];
    if (canManageUsers) {
      adminItems.push({ path: '/dashboard/usuarios', label: 'Gestión de Usuarios', icon: UserCog });
      adminItems.push({ path: '/dashboard/estadisticas', label: 'Estadísticas y Reportes', icon: BarChart3 });
    }
    if (isCoordAdmin) {
      adminItems.push({ path: '/dashboard/permisos', label: 'Gestión de Permisos', icon: Shield });
    }

    return { baseMenuItems, conservacionItems, actualizacionItems, adminItems };
  }, [user, cambiosPendientesCount]);

  const { baseMenuItems, conservacionItems, actualizacionItems, adminItems } = menuData;

  // Get current page title
  const currentPageTitle = useMemo(() => {
    const allItems = [...baseMenuItems, ...conservacionItems, ...actualizacionItems, ...adminItems];
    const currentItem = allItems.find(item => item.path === location.pathname);
    return currentItem?.label || 'Dashboard';
  }, [baseMenuItems, conservacionItems, actualizacionItems, adminItems, location.pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-700 mx-auto"></div>
          <p className="mt-4 text-slate-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50">
      {/* Banner de modo offline */}
      {!isOnline && (
        <OfflineBanner onViewData={() => setShowOfflinePanel(true)} />
      )}
      
      <div className="flex flex-1 overflow-hidden">
      {/* Sidebar - Desktop */}
      <div className="hidden md:flex w-64 flex-col bg-emerald-900 text-white border-r border-emerald-800 overflow-y-auto">
        {/* Header con logo */}
        <div className="p-4 border-b border-emerald-800 flex-shrink-0">
          <img 
            src="/logo-asomunicipios.png" 
            alt="Asomunicipios Logo" 
            className="w-24 mx-auto mb-2 rounded"
            data-testid="sidebar-logo"
          />
          <h2 className="text-xs font-bold font-outfit leading-tight text-center" data-testid="sidebar-title">
            Asociación de Municipios del Catatumbo, Provincia de Ocaña y Sur del Cesar
          </h2>
          <p className="text-emerald-200 text-xs mt-1 text-center font-semibold">– Asomunicipios –</p>
          <p className="text-emerald-100 text-xs mt-2 text-center">{getRoleName(user.role)}</p>
        </div>

        {/* Navegación */}
        <nav className="flex-1 p-3 space-y-4 overflow-y-auto" data-testid="sidebar-nav">
          {/* Items base */}
          <div className="space-y-1">
            {baseMenuItems.map(item => (
              <MenuItem key={item.path} item={item} isActive={location.pathname === item.path} />
            ))}
          </div>

          {/* Sección Conservación */}
          {conservacionItems.length > 0 && (
            <MenuSection
              title="Conservación"
              icon={Layers}
              isOpen={conservacionOpen}
              onToggle={setConservacionOpen}
              accentColor="emerald"
              testId="section-conservacion"
            >
              {conservacionItems.map(item => (
                <MenuItem key={item.path} item={item} isActive={location.pathname === item.path} />
              ))}
            </MenuSection>
          )}

          {/* Sección Actualización */}
          {actualizacionItems.length > 0 && (
            <MenuSection
              title="Actualización"
              icon={RefreshCcw}
              isOpen={actualizacionOpen}
              onToggle={setActualizacionOpen}
              accentColor="amber"
              testId="section-actualizacion"
            >
              {actualizacionItems.map(item => (
                <MenuItem key={item.path} item={item} isActive={location.pathname === item.path} />
              ))}
            </MenuSection>
          )}

          {/* Sección Administración */}
          {adminItems.length > 0 && (
            <MenuSection
              title="Administración"
              icon={UserCog}
              isOpen={adminOpen}
              onToggle={setAdminOpen}
              accentColor="emerald"
              testId="section-administracion"
            >
              {adminItems.map(item => (
                <MenuItem key={item.path} item={item} isActive={location.pathname === item.path} />
              ))}
            </MenuSection>
          )}
        </nav>

        {/* Footer con info de usuario */}
        <div className="p-4 border-t border-emerald-800 flex-shrink-0">
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium text-white truncate" data-testid="user-name">{user.full_name}</p>
            <p className="text-xs text-emerald-200 truncate" data-testid="user-email">{user.email}</p>
          </div>
          <Button
            onClick={logout}
            variant="ghost"
            className="w-full justify-start text-emerald-100 hover:bg-emerald-800 hover:text-white"
            data-testid="logout-button"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>
      </div>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-[9999] md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={closeSidebar}></div>
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-emerald-900 text-white flex flex-col">
            <div className="absolute right-2 top-2">
              <button onClick={closeSidebar} className="text-white p-1 hover:bg-emerald-800 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Header con logo - Mobile */}
            <div className="p-4 border-b border-emerald-800 flex-shrink-0">
              <img 
                src="/logo-asomunicipios.png" 
                alt="Asomunicipios Logo" 
                className="w-24 mx-auto mb-2 rounded"
              />
              <h2 className="text-xs font-bold font-outfit leading-tight text-center">
                Asociación de Municipios del Catatumbo, Provincia de Ocaña y Sur del Cesar
              </h2>
              <p className="text-emerald-200 text-xs mt-1 text-center font-semibold">– Asomunicipios –</p>
              <p className="text-emerald-100 text-xs mt-2 text-center">{getRoleName(user.role)}</p>
            </div>

            {/* Navegación - Mobile */}
            <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
              <div className="space-y-1">
                {baseMenuItems.map(item => (
                  <MenuItem key={item.path} item={item} isActive={location.pathname === item.path} onNavigate={closeSidebar} />
                ))}
              </div>

              {conservacionItems.length > 0 && (
                <MenuSection
                  title="Conservación"
                  icon={Layers}
                  isOpen={conservacionOpen}
                  onToggle={setConservacionOpen}
                  accentColor="emerald"
                  testId="section-conservacion-mobile"
                >
                  {conservacionItems.map(item => (
                    <MenuItem key={item.path} item={item} isActive={location.pathname === item.path} onNavigate={closeSidebar} />
                  ))}
                </MenuSection>
              )}

              {actualizacionItems.length > 0 && (
                <MenuSection
                  title="Actualización"
                  icon={RefreshCcw}
                  isOpen={actualizacionOpen}
                  onToggle={setActualizacionOpen}
                  accentColor="amber"
                  testId="section-actualizacion-mobile"
                >
                  {actualizacionItems.map(item => (
                    <MenuItem key={item.path} item={item} isActive={location.pathname === item.path} onNavigate={closeSidebar} />
                  ))}
                </MenuSection>
              )}

              {adminItems.length > 0 && (
                <MenuSection
                  title="Administración"
                  icon={UserCog}
                  isOpen={adminOpen}
                  onToggle={setAdminOpen}
                  accentColor="emerald"
                  testId="section-administracion-mobile"
                >
                  {adminItems.map(item => (
                    <MenuItem key={item.path} item={item} isActive={location.pathname === item.path} onNavigate={closeSidebar} />
                  ))}
                </MenuSection>
              )}
            </nav>

            {/* Footer - Mobile */}
            <div className="p-4 border-t border-emerald-800 flex-shrink-0">
              <div className="px-3 py-2 mb-2">
                <p className="text-sm font-medium text-white truncate">{user.full_name}</p>
                <p className="text-xs text-emerald-200 truncate">{user.email}</p>
              </div>
              <Button
                onClick={logout}
                variant="ghost"
                className="w-full justify-start text-emerald-100 hover:bg-emerald-800 hover:text-white"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Diálogo de advertencia de timeout */}
        <Dialog open={showTimeoutWarning} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-md z-[9999]" onPointerDownOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="w-5 h-5" />
                Sesión por expirar
              </DialogTitle>
              <DialogDescription className="text-slate-600">
                Su sesión se cerrará automáticamente en <strong>2 minutos</strong> por inactividad.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 text-center">
              <p className="text-sm text-slate-500">
                ¿Desea continuar trabajando?
              </p>
            </div>
            <DialogFooter className="flex gap-2 sm:gap-2">
              <Button variant="outline" onClick={logout}>
                Cerrar sesión ahora
              </Button>
              <Button 
                onClick={extendSession}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Continuar trabajando
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Alerta Flotante de Cronograma para Coordinadores */}
        {showAlertaFlotante && alertasCronograma.length > 0 && ['administrador', 'coordinador'].includes(user?.role) && (
          <div className="fixed top-20 right-4 z-[9998] max-w-md animate-in slide-in-from-right">
            <div className="bg-white rounded-lg shadow-xl border-l-4 border-amber-500 p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="w-6 h-6 text-amber-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">Actividades Pendientes</h4>
                    <p className="text-sm text-slate-600 mt-1">
                      Tienes <strong className="text-red-600">
                        {alertasCronograma.filter(a => a.tipo_alerta === 'vencida').length} vencidas
                      </strong> y <strong className="text-amber-600">
                        {alertasCronograma.filter(a => a.tipo_alerta === 'urgente').length} urgentes
                      </strong>
                    </p>
                    <div className="mt-3 space-y-2 max-h-32 overflow-y-auto">
                      {alertasCronograma.slice(0, 3).map((alerta, idx) => (
                        <div key={idx} className="text-xs bg-slate-50 p-2 rounded flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            alerta.tipo_alerta === 'vencida' ? 'bg-red-500' :
                            alerta.tipo_alerta === 'urgente' ? 'bg-amber-500' : 'bg-blue-500'
                          }`}></span>
                          <span className="truncate">{alerta.actividad_nombre}</span>
                          <span className="text-slate-400 flex-shrink-0">• {alerta.municipio}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setShowAlertaFlotante(false)}
                      >
                        Cerrar
                      </Button>
                      <Button 
                        size="sm" 
                        className="bg-amber-600 hover:bg-amber-700"
                        onClick={() => {
                          setShowAlertaFlotante(false);
                          window.location.href = '/dashboard/proyectos-actualizacion';
                        }}
                      >
                        Ver Proyectos
                      </Button>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAlertaFlotante(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="h-16 border-b border-slate-200 bg-white flex items-center px-6 justify-between" data-testid="dashboard-header">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden text-slate-700"
              data-testid="mobile-menu-button"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-semibold text-slate-900 font-outfit" data-testid="page-title">
              {currentPageTitle}
            </h1>
          </div>
          
          {/* Offline Status */}
          <div className="flex items-center gap-3">
            {/* Badge de estado offline */}
            <OfflineReadyBadge />
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 p-6 md:p-8">
          {/* Banner de Novedades Pendientes */}
          {showNovedadesBanner && cambiosPendientesCount > 0 && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg shadow-sm" data-testid="novedades-banner">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-100 rounded-full">
                    <Bell className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-amber-800">
                      Tiene {cambiosPendientesCount} elemento{cambiosPendientesCount !== 1 ? 's' : ''} pendiente{cambiosPendientesCount !== 1 ? 's' : ''} de revisión
                    </h3>
                    <ul className="mt-1 text-sm text-amber-700 space-y-0.5">
                      {novedadesDetalle.cambios > 0 && (
                        <li>• {novedadesDetalle.cambios} modificación{novedadesDetalle.cambios !== 1 ? 'es' : ''} pendiente{novedadesDetalle.cambios !== 1 ? 's' : ''}</li>
                      )}
                      {novedadesDetalle.prediosNuevos > 0 && (
                        <li>• {novedadesDetalle.prediosNuevos} predio{novedadesDetalle.prediosNuevos !== 1 ? 's' : ''} nuevo{novedadesDetalle.prediosNuevos !== 1 ? 's' : ''} pendiente{novedadesDetalle.prediosNuevos !== 1 ? 's' : ''}</li>
                      )}
                      {novedadesDetalle.reapariciones > 0 && (
                        <li>• {novedadesDetalle.reapariciones} reaparición{novedadesDetalle.reapariciones !== 1 ? 'es' : ''} pendiente{novedadesDetalle.reapariciones !== 1 ? 's' : ''}</li>
                      )}
                    </ul>
                    <Button
                      size="sm"
                      className="mt-3 bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={() => {
                        cerrarBannerNovedades();
                        navigate('/dashboard/pendientes');
                      }}
                    >
                      Ver Pendientes
                    </Button>
                  </div>
                </div>
                <button
                  onClick={cerrarBannerNovedades}
                  className="text-amber-600 hover:text-amber-800 p-1"
                  title="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
          
          <Outlet />
        </div>
      </div>
      </div>
      
      {/* Panel de estado offline */}
      <OfflineStatusPanel 
        isOpen={showOfflinePanel} 
        onClose={() => setShowOfflinePanel(false)}
        offlineModules={[
          {
            name: 'Gestión de Predios',
            description: 'Predios descargados para consulta',
            status: offlineData.prediosCount > 0 ? 'ready' : 'none',
            count: offlineData.prediosCount || 0
          },
          {
            name: 'Peticiones',
            description: 'Peticiones de certificados',
            status: offlineData.petitionsCount > 0 ? 'ready' : 'none',
            count: offlineData.petitionsCount || 0
          }
        ]}
      />
    </div>
  );
}
