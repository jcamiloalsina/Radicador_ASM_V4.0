import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Activity, Search, Filter, Calendar, User, 
  AlertCircle, CheckCircle, XCircle, Settings,
  FileText, Upload, Download, LogIn, Trash2,
  ChevronLeft, ChevronRight, RefreshCw, Clock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Configuración de tipos de acción con colores
const ACCIONES_CONFIG = {
  crear: { label: 'Crear', color: 'bg-emerald-600', icon: CheckCircle },
  modificar: { label: 'Modificar', color: 'bg-blue-600', icon: Settings },
  eliminar: { label: 'Eliminar', color: 'bg-red-600', icon: Trash2 },
  aprobar: { label: 'Aprobar', color: 'bg-green-600', icon: CheckCircle },
  rechazar: { label: 'Rechazar', color: 'bg-red-500', icon: XCircle },
  login: { label: 'Login', color: 'bg-purple-600', icon: LogIn },
  exportar: { label: 'Exportar', color: 'bg-amber-600', icon: Download },
  importar: { label: 'Importar', color: 'bg-cyan-600', icon: Upload },
  config: { label: 'Config', color: 'bg-violet-600', icon: Settings },
  view: { label: 'Ver', color: 'bg-slate-500', icon: FileText },
  auto: { label: 'Auto', color: 'bg-slate-400', icon: Clock }
};

// Configuración de categorías
const CATEGORIAS_CONFIG = {
  predios: { label: 'Predios', color: 'bg-blue-100 text-blue-800' },
  usuarios: { label: 'Usuarios', color: 'bg-purple-100 text-purple-800' },
  peticiones: { label: 'Peticiones', color: 'bg-emerald-100 text-emerald-800' },
  resoluciones: { label: 'Resoluciones', color: 'bg-orange-100 text-orange-800' },
  certificados: { label: 'Certificados', color: 'bg-teal-100 text-teal-800' },
  sistema: { label: 'Sistema', color: 'bg-red-100 text-red-800' },
  importacion: { label: 'Importación', color: 'bg-cyan-100 text-cyan-800' },
  visitas: { label: 'Visitas', color: 'bg-amber-100 text-amber-800' }
};

// Municipios
const MUNICIPIOS = [
  { codigo: '54003', nombre: 'Ábrego' },
  { codigo: '54109', nombre: 'Bucarasica' },
  { codigo: '54128', nombre: 'Cáchira' },
  { codigo: '54206', nombre: 'Convención' },
  { codigo: '54245', nombre: 'El Carmen' },
  { codigo: '54250', nombre: 'El Tarra' },
  { codigo: '54344', nombre: 'Hacarí' },
  { codigo: '54398', nombre: 'La Playa' },
  { codigo: '20614', nombre: 'Río de Oro' },
  { codigo: '54670', nombre: 'San Calixto' },
  { codigo: '54720', nombre: 'Sardinata' },
  { codigo: '54800', nombre: 'Teorama' }
];

export default function LogActividades() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [usuarios, setUsuarios] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  // Filtros
  const [filtros, setFiltros] = useState({
    fecha_desde: '',
    fecha_hasta: '',
    categoria: '',
    tipo_accion: '',
    usuario_id: '',
    municipio: '',
    busqueda: ''
  });

  // Cargar logs
  const cargarLogs = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      
      if (filtros.fecha_desde) params.append('fecha_desde', filtros.fecha_desde);
      if (filtros.fecha_hasta) params.append('fecha_hasta', filtros.fecha_hasta);
      if (filtros.categoria) params.append('categoria', filtros.categoria);
      if (filtros.tipo_accion) params.append('tipo_accion', filtros.tipo_accion);
      if (filtros.usuario_id) params.append('usuario_id', filtros.usuario_id);
      if (filtros.municipio) params.append('municipio', filtros.municipio);
      if (filtros.busqueda) params.append('busqueda', filtros.busqueda);
      params.append('page', pagination.page);
      params.append('limit', pagination.limit);

      const response = await axios.get(`${API}/logs/actividad?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setLogs(response.data.logs || []);
      setStats(response.data.stats || {});
      setPagination(prev => ({
        ...prev,
        total: response.data.total,
        totalPages: response.data.total_pages
      }));
    } catch (error) {
      console.error('Error cargando logs:', error);
      toast.error('Error al cargar los logs');
    } finally {
      setLoading(false);
    }
  }, [filtros, pagination.page, pagination.limit]);

  // Cargar usuarios para filtro
  const cargarUsuarios = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/logs/usuarios-activos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsuarios(response.data || []);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
    }
  }, []);

  useEffect(() => {
    cargarLogs();
    cargarUsuarios();
  }, [cargarLogs, cargarUsuarios]);

  // Aplicar filtros
  const aplicarFiltros = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    cargarLogs();
  };

  // Limpiar filtros
  const limpiarFiltros = () => {
    setFiltros({
      fecha_desde: '',
      fecha_hasta: '',
      categoria: '',
      tipo_accion: '',
      usuario_id: '',
      municipio: '',
      busqueda: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Formatear fecha
  const formatearFecha = (timestamp) => {
    if (!timestamp) return { fecha: '-', hora: '-' };
    const date = new Date(timestamp);
    return {
      fecha: date.toLocaleDateString('es-CO'),
      hora: date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
  };

  // Verificar permisos
  if (!user || !['administrador', 'coordinador'].includes(user.role)) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Acceso Denegado</h2>
        <p className="text-slate-600">Solo administradores y coordinadores pueden acceder a esta sección.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-slate-900 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Activity className="w-8 h-8 text-emerald-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Log de Actividades del Sistema</h1>
            <p className="text-slate-400 text-sm">Registro completo de acciones y eventos</p>
          </div>
          <Badge className="bg-red-600 text-white ml-2">Solo Admin/Coordinador</Badge>
        </div>
        <Button 
          onClick={cargarLogs} 
          variant="outline" 
          className="border-slate-600 text-slate-300 hover:bg-slate-800"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="bg-slate-800 border-l-4 border-l-emerald-500 border-slate-700">
          <CardContent className="p-4">
            <p className="text-xs text-slate-400 uppercase">Total Registros</p>
            <p className="text-3xl font-bold text-white">{stats.total_registros?.toLocaleString() || 0}</p>
            <p className="text-xs text-slate-500">Últimos 30 días</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-l-4 border-l-amber-500 border-slate-700">
          <CardContent className="p-4">
            <p className="text-xs text-slate-400 uppercase">Acciones Hoy</p>
            <p className="text-3xl font-bold text-white">{stats.acciones_hoy?.toLocaleString() || 0}</p>
            <p className="text-xs text-slate-500">Actividad del día</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-l-4 border-l-red-500 border-slate-700">
          <CardContent className="p-4">
            <p className="text-xs text-slate-400 uppercase">Errores/Rechazos</p>
            <p className="text-3xl font-bold text-white">{stats.errores_semana?.toLocaleString() || 0}</p>
            <p className="text-xs text-slate-500">Esta semana</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-l-4 border-l-blue-500 border-slate-700">
          <CardContent className="p-4">
            <p className="text-xs text-slate-400 uppercase">Usuarios Activos</p>
            <p className="text-3xl font-bold text-white">{stats.usuarios_activos_24h || 0}</p>
            <p className="text-xs text-slate-500">Últimas 24h</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-l-4 border-l-purple-500 border-slate-700">
          <CardContent className="p-4">
            <p className="text-xs text-slate-400 uppercase">Cambios Críticos</p>
            <p className="text-3xl font-bold text-white">{stats.cambios_criticos || 0}</p>
            <p className="text-xs text-slate-500">Config/Sistema</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2 text-emerald-400">
            <Filter className="w-4 h-4" />
            Filtros de Búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-5 gap-4">
            <div>
              <Label className="text-slate-400 text-xs">Fecha Desde</Label>
              <Input 
                type="date" 
                value={filtros.fecha_desde}
                onChange={(e) => setFiltros(prev => ({ ...prev, fecha_desde: e.target.value }))}
                className="bg-slate-900 border-slate-600 text-white"
              />
            </div>
            <div>
              <Label className="text-slate-400 text-xs">Fecha Hasta</Label>
              <Input 
                type="date" 
                value={filtros.fecha_hasta}
                onChange={(e) => setFiltros(prev => ({ ...prev, fecha_hasta: e.target.value }))}
                className="bg-slate-900 border-slate-600 text-white"
              />
            </div>
            <div>
              <Label className="text-slate-400 text-xs">Categoría</Label>
              <Select value={filtros.categoria || "todas"} onValueChange={(v) => setFiltros(prev => ({ ...prev, categoria: v === "todas" ? "" : v }))}>
                <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las categorías</SelectItem>
                  {Object.entries(CATEGORIAS_CONFIG).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-400 text-xs">Tipo de Acción</Label>
              <Select value={filtros.tipo_accion || "todas"} onValueChange={(v) => setFiltros(prev => ({ ...prev, tipo_accion: v === "todas" ? "" : v }))}>
                <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las acciones</SelectItem>
                  {Object.entries(ACCIONES_CONFIG).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-400 text-xs">Usuario</Label>
              <Select value={filtros.usuario_id || "todos"} onValueChange={(v) => setFiltros(prev => ({ ...prev, usuario_id: v === "todos" ? "" : v }))}>
                <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los usuarios</SelectItem>
                  {usuarios.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name} ({u.role})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-slate-400 text-xs">Municipio</Label>
              <Select value={filtros.municipio || "todos"} onValueChange={(v) => setFiltros(prev => ({ ...prev, municipio: v === "todos" ? "" : v }))}>
                <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los municipios</SelectItem>
                  {MUNICIPIOS.map((m) => (
                    <SelectItem key={m.codigo} value={m.codigo}>{m.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-400 text-xs">Buscar (NPN, ID, Descripción)</Label>
              <Input 
                placeholder="Ej: 540030004..."
                value={filtros.busqueda}
                onChange={(e) => setFiltros(prev => ({ ...prev, busqueda: e.target.value }))}
                className="bg-slate-900 border-slate-600 text-white"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={aplicarFiltros} className="bg-emerald-600 hover:bg-emerald-700">
                <Search className="w-4 h-4 mr-2" /> Aplicar Filtros
              </Button>
              <Button onClick={limpiarFiltros} variant="outline" className="border-slate-600 text-slate-300">
                Limpiar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de Logs */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="py-3 flex flex-row justify-between items-center">
          <CardTitle className="text-sm text-white">Registros de Actividad</CardTitle>
          <span className="text-xs text-slate-400">
            Mostrando {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total?.toLocaleString()} registros
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Fecha/Hora</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Usuario</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Acción</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Categoría</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Descripción</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2" />
                      Cargando logs...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-slate-400">
                      No se encontraron registros con los filtros aplicados
                    </td>
                  </tr>
                ) : (
                  logs.map((log, idx) => {
                    const { fecha, hora } = formatearFecha(log.timestamp);
                    const accionConfig = ACCIONES_CONFIG[log.accion] || ACCIONES_CONFIG.view;
                    const categoriaConfig = CATEGORIAS_CONFIG[log.categoria] || { label: log.categoria, color: 'bg-slate-100 text-slate-800' };
                    
                    return (
                      <tr key={log.id || idx} className="hover:bg-slate-700/50">
                        <td className="px-4 py-3">
                          <div className="text-white text-sm">{fecha}</div>
                          <div className="text-slate-500 text-xs">{hora}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-white text-sm font-medium">{log.usuario_nombre || 'Sistema'}</div>
                          <div className="text-slate-500 text-xs">{log.usuario_rol || 'Automático'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`${accionConfig.color} text-white text-xs uppercase`}>
                            {accionConfig.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`${categoriaConfig.color} text-xs`}>
                            {categoriaConfig.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 max-w-md">
                          <div className="text-white text-sm">{log.descripcion}</div>
                          {log.detalles && Object.keys(log.detalles).length > 0 && (
                            <div className="text-slate-500 text-xs mt-1 space-x-2">
                              {log.detalles.npn && (
                                <span>NPN: <code className="bg-slate-900 px-1 rounded text-emerald-400">{log.detalles.npn}</code></span>
                              )}
                              {log.detalles.radicado && (
                                <span>Radicado: <code className="bg-slate-900 px-1 rounded text-emerald-400">{log.detalles.radicado}</code></span>
                              )}
                              {log.detalles.codigo && (
                                <span>Código: <code className="bg-slate-900 px-1 rounded text-emerald-400">{log.detalles.codigo}</code></span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-slate-500">{log.ip_address || '-'}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-between items-center px-4 py-3 border-t border-slate-700">
              <span className="text-sm text-slate-400">
                Página {pagination.page} de {pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPagination(prev => ({ ...prev, page: 1 }))}
                  disabled={pagination.page === 1}
                  className="border-slate-600 text-slate-300"
                >
                  Primera
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  disabled={pagination.page === 1}
                  className="border-slate-600 text-slate-300"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                  disabled={pagination.page === pagination.totalPages}
                  className="border-slate-600 text-slate-300"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.totalPages }))}
                  disabled={pagination.page === pagination.totalPages}
                  className="border-slate-600 text-slate-300"
                >
                  Última
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
