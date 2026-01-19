import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { LogOut, FileText, Activity, Users, Menu, X, UserCog, BarChart3, MapPin, Map, Clock, Bell, Shield, AlertTriangle, ChevronDown, ChevronRight, FolderKanban, Layers, RefreshCcw } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Componente para sección colapsable del menú
function MenuSection({ title, icon: Icon, children, isOpen, onToggle, accentColor = 'emerald', testId }) {
  const colorClasses = {
    emerald: {
      bg: 'bg-emerald-800/30',
      border: 'border-emerald-700',
      text: 'text-emerald-200',
      iconBg: 'bg-emerald-700/50'
    },
    amber: {
      bg: 'bg-amber-900/20',
      border: 'border-amber-700/50',
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

export default function DashboardLayout() {
  const { user, logout, loading, showTimeoutWarning, extendSession } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificaciones, setNotificaciones] = useState([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [cambiosPendientesCount, setCambiosPendientesCount] = useState(0);
  
  // Estado de secciones colapsables
  const [conservacionOpen, setConservacionOpen] = useState(true);
  const [actualizacionOpen, setActualizacionOpen] = useState(true);
  const [adminOpen, setAdminOpen] = useState(true);

  const fetchCambiosPendientes = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/predios/cambios/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCambiosPendientesCount(response.data.total_pendientes || 0);
    } catch (error) {
      console.error('Error fetching pending changes:', error);
    }
  };

  const fetchNotificaciones = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/notificaciones`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotificaciones(response.data.notificaciones || []);
      setNoLeidas(response.data.no_leidas || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const checkGdbAlert = async () => {
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
  };

  useEffect(() => {
    if (user) {
      fetchNotificaciones();
      checkGdbAlert();
      if (['administrador', 'coordinador'].includes(user.role)) {
        fetchCambiosPendientes();
      }
    }
  }, [user]);

  const marcarLeida = async (notificacionId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`${API}/notificaciones/${notificacionId}/leer`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchNotificaciones();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const marcarTodasLeidas = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/notificaciones/marcar-todas-leidas`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchNotificaciones();
      toast.success('Todas las notificaciones marcadas como leídas');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

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

  const getRoleName = (role) => {
    const roles = {
      usuario: 'Usuario',
      atencion_usuario: 'Atención al Usuario',
      gestor: 'Gestor',
      coordinador: 'Coordinador',
      administrador: 'Administrador',
      comunicaciones: 'Comunicaciones'
    };
    return roles[role] || role;
  };

  // Determinar qué items mostrar según el rol
  const isStaff = user.role !== 'usuario';
  const isCoordAdmin = ['administrador', 'coordinador'].includes(user.role);
  const canManageUsers = ['administrador', 'coordinador', 'atencion_usuario'].includes(user.role);
  const canAccessActualizacion = ['administrador', 'coordinador', 'gestor'].includes(user.role);

  // Items de menú base (siempre visibles)
  const baseMenuItems = [
    { path: '/dashboard', label: 'Inicio', icon: Activity },
    { path: '/dashboard/peticiones', label: 'Mis Peticiones', icon: FileText },
  ];

  // Items de Conservación (módulo existente)
  const conservacionItems = [];
  if (isStaff) {
    conservacionItems.push({ path: '/dashboard/todas-peticiones', label: 'Todas las Peticiones', icon: Users });
    conservacionItems.push({ path: '/dashboard/predios', label: 'Gestión de Predios', icon: MapPin });
    conservacionItems.push({ path: '/dashboard/visor-predios', label: 'Visor de Predios', icon: Map });
  }
  if (isCoordAdmin) {
    conservacionItems.push({ path: '/dashboard/pendientes', label: 'Pendientes', icon: Clock, badge: cambiosPendientesCount });
  }

  // Items de Actualización (nuevo módulo)
  const actualizacionItems = [];
  if (canAccessActualizacion) {
    actualizacionItems.push({ path: '/dashboard/proyectos-actualizacion', label: 'Proyectos', icon: FolderKanban });
    // Futuras páginas del módulo de actualización
    // actualizacionItems.push({ path: '/dashboard/trabajo-campo', label: 'Trabajo de Campo', icon: MapPin });
  }

  // Items de Administración
  const adminItems = [];
  if (canManageUsers) {
    adminItems.push({ path: '/dashboard/usuarios', label: 'Gestión de Usuarios', icon: UserCog });
    adminItems.push({ path: '/dashboard/estadisticas', label: 'Estadísticas y Reportes', icon: BarChart3 });
  }
  if (isCoordAdmin) {
    adminItems.push({ path: '/dashboard/permisos', label: 'Gestión de Permisos', icon: Shield });
  }

  // Función para renderizar un item de menú
  const renderMenuItem = (item, closeSidebar = false) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;
    const showBadge = item.badge && item.badge > 0;
    
    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={closeSidebar ? () => setSidebarOpen(false) : undefined}
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
  };

  // Función para obtener el título de la página actual
  const getCurrentPageTitle = () => {
    const allItems = [
      ...baseMenuItems, 
      ...conservacionItems, 
      ...actualizacionItems, 
      ...adminItems
    ];
    const currentItem = allItems.find(item => item.path === location.pathname);
    return currentItem?.label || 'Dashboard';
  };

  // Sidebar content (reutilizado en desktop y mobile)
  const SidebarContent = ({ mobile = false }) => (
    <>
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
          {baseMenuItems.map(item => renderMenuItem(item, mobile))}
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
            {conservacionItems.map(item => renderMenuItem(item, mobile))}
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
            {actualizacionItems.map(item => renderMenuItem(item, mobile))}
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
            {adminItems.map(item => renderMenuItem(item, mobile))}
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
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar - Desktop */}
      <div className="hidden md:flex w-64 flex-col bg-emerald-900 text-white border-r border-emerald-800 overflow-y-auto">
        <SidebarContent />
      </div>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)}></div>
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-emerald-900 text-white flex flex-col">
            <div className="absolute right-2 top-2">
              <button onClick={() => setSidebarOpen(false)} className="text-white p-1 hover:bg-emerald-800 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <SidebarContent mobile />
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
              {getCurrentPageTitle()}
            </h1>
          </div>
          
          {/* Notificaciones */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-full transition-colors"
              data-testid="notifications-button"
            >
              <Bell className="w-5 h-5" />
              {noLeidas > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {noLeidas > 9 ? '9+' : noLeidas}
                </span>
              )}
            </button>
            
            {/* Dropdown de notificaciones */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-slate-200 z-[9999]">
                <div className="p-3 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">Notificaciones</h3>
                  {noLeidas > 0 && (
                    <button
                      onClick={marcarTodasLeidas}
                      className="text-xs text-emerald-600 hover:text-emerald-700"
                    >
                      Marcar todas como leídas
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notificaciones.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-sm">
                      No hay notificaciones
                    </div>
                  ) : (
                    notificaciones.slice(0, 10).map((notif) => (
                      <div
                        key={notif.id}
                        className={`p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${!notif.leida ? 'bg-emerald-50' : ''}`}
                        onClick={() => marcarLeida(notif.id)}
                      >
                        <div className="flex items-start gap-2">
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                            notif.tipo === 'warning' ? 'bg-amber-500' :
                            notif.tipo === 'success' ? 'bg-emerald-500' :
                            notif.tipo === 'error' ? 'bg-red-500' : 'bg-blue-500'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{notif.titulo}</p>
                            <p className="text-xs text-slate-500 line-clamp-2">{notif.mensaje}</p>
                            <p className="text-xs text-slate-400 mt-1">
                              {new Date(notif.fecha).toLocaleDateString('es-CO', {
                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 p-6 md:p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
