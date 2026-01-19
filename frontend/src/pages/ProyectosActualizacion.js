import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Plus, 
  FolderOpen, 
  Archive, 
  Trash2, 
  RefreshCw, 
  Search,
  MapPin,
  Calendar,
  User,
  FileSpreadsheet,
  Database,
  MoreVertical,
  Play,
  Pause,
  CheckCircle,
  AlertCircle,
  Upload,
  Eye,
  RotateCcw
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const estadoConfig = {
  activo: { label: 'Activo', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: Play },
  pausado: { label: 'Pausado', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Pause },
  completado: { label: 'Completado', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: CheckCircle },
  archivado: { label: 'Archivado', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: Archive }
};

export default function ProyectosActualizacion() {
  const { user } = useAuth();
  const [proyectos, setProyectos] = useState([]);
  const [estadisticas, setEstadisticas] = useState({ activos: 0, pausados: 0, completados: 0, archivados: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  
  // Modal states
  const [showCrearModal, setShowCrearModal] = useState(false);
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [showEliminarModal, setShowEliminarModal] = useState(false);
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState(null);
  
  // Form states
  const [nuevoProyecto, setNuevoProyecto] = useState({ nombre: '', municipio: '', descripcion: '' });
  const [municipiosDisponibles, setMunicipiosDisponibles] = useState([]);
  const [creando, setCreando] = useState(false);

  const fetchProyectos = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const params = {};
      if (filtroEstado !== 'todos') {
        params.estado = filtroEstado;
      }
      
      const response = await axios.get(`${API}/actualizacion/proyectos`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setProyectos(response.data.proyectos || []);
    } catch (error) {
      console.error('Error fetching proyectos:', error);
      toast.error('Error al cargar los proyectos');
    }
  }, [filtroEstado]);

  const fetchEstadisticas = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/actualizacion/proyectos/estadisticas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEstadisticas(response.data);
    } catch (error) {
      console.error('Error fetching estadísticas:', error);
    }
  }, []);

  const fetchMunicipiosDisponibles = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/actualizacion/municipios-disponibles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMunicipiosDisponibles(response.data.disponibles || []);
    } catch (error) {
      console.error('Error fetching municipios:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchProyectos(), fetchEstadisticas()]);
      setLoading(false);
    };
    loadData();
  }, [fetchProyectos, fetchEstadisticas]);

  const handleCrearProyecto = async () => {
    if (!nuevoProyecto.nombre.trim()) {
      toast.error('El nombre del proyecto es requerido');
      return;
    }
    if (!nuevoProyecto.municipio) {
      toast.error('Debe seleccionar un municipio');
      return;
    }

    setCreando(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/actualizacion/proyectos`, nuevoProyecto, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Proyecto creado exitosamente');
      setShowCrearModal(false);
      setNuevoProyecto({ nombre: '', municipio: '', descripcion: '' });
      fetchProyectos();
      fetchEstadisticas();
    } catch (error) {
      console.error('Error creating proyecto:', error);
      toast.error(error.response?.data?.detail || 'Error al crear el proyecto');
    } finally {
      setCreando(false);
    }
  };

  const handleCambiarEstado = async (proyectoId, nuevoEstado) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`${API}/actualizacion/proyectos/${proyectoId}`, 
        { estado: nuevoEstado },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Estado actualizado a ${estadoConfig[nuevoEstado].label}`);
      fetchProyectos();
      fetchEstadisticas();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al cambiar el estado');
    }
  };

  const handleArchivar = async (proyectoId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/actualizacion/proyectos/${proyectoId}/archivar`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Proyecto archivado');
      fetchProyectos();
      fetchEstadisticas();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al archivar');
    }
  };

  const handleRestaurar = async (proyectoId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/actualizacion/proyectos/${proyectoId}/restaurar`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Proyecto restaurado');
      fetchProyectos();
      fetchEstadisticas();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al restaurar');
    }
  };

  const handleEliminar = async () => {
    if (!proyectoSeleccionado) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/actualizacion/proyectos/${proyectoSeleccionado.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Proyecto eliminado');
      setShowEliminarModal(false);
      setProyectoSeleccionado(null);
      fetchProyectos();
      fetchEstadisticas();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar');
    }
  };

  const proyectosFiltrados = proyectos.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.municipio.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canCreate = ['administrador', 'coordinador'].includes(user?.role);
  const canDelete = user?.role === 'administrador';

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6" data-testid="proyectos-actualizacion-page">
      {/* Header con estadísticas */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-outfit" data-testid="page-title">
            Proyectos de Actualización
          </h1>
          <p className="text-slate-500 mt-1">
            Gestión de proyectos de actualización catastral por municipio
          </p>
        </div>
        {canCreate && (
          <Button 
            onClick={() => {
              fetchMunicipiosDisponibles();
              setShowCrearModal(true);
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white"
            data-testid="crear-proyecto-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Proyecto
          </Button>
        )}
      </div>

      {/* Cards de estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-white border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Total</p>
                <p className="text-2xl font-bold text-slate-900">{estadisticas.total}</p>
              </div>
              <FolderOpen className="w-8 h-8 text-slate-300" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-600 uppercase tracking-wider">Activos</p>
                <p className="text-2xl font-bold text-emerald-700">{estadisticas.activos}</p>
              </div>
              <Play className="w-8 h-8 text-emerald-300" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-600 uppercase tracking-wider">Pausados</p>
                <p className="text-2xl font-bold text-amber-700">{estadisticas.pausados}</p>
              </div>
              <Pause className="w-8 h-8 text-amber-300" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 uppercase tracking-wider">Completados</p>
                <p className="text-2xl font-bold text-blue-700">{estadisticas.completados}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-blue-300" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Archivados</p>
                <p className="text-2xl font-bold text-slate-600">{estadisticas.archivados}</p>
              </div>
              <Archive className="w-8 h-8 text-slate-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros y búsqueda */}
      <Card className="bg-white">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar por nombre o municipio..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="search-input"
              />
            </div>
            <Tabs value={filtroEstado} onValueChange={setFiltroEstado} className="w-full md:w-auto">
              <TabsList className="grid grid-cols-5 w-full md:w-auto">
                <TabsTrigger value="todos" data-testid="filter-todos">Todos</TabsTrigger>
                <TabsTrigger value="activo" data-testid="filter-activo">Activos</TabsTrigger>
                <TabsTrigger value="pausado" data-testid="filter-pausado">Pausados</TabsTrigger>
                <TabsTrigger value="completado" data-testid="filter-completado">Completados</TabsTrigger>
                <TabsTrigger value="archivado" data-testid="filter-archivado">Archivados</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" onClick={() => { fetchProyectos(); fetchEstadisticas(); }} data-testid="refresh-btn">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de proyectos */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
        </div>
      ) : proyectosFiltrados.length === 0 ? (
        <Card className="bg-white">
          <CardContent className="p-12 text-center">
            <FolderOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No hay proyectos</h3>
            <p className="text-slate-500 mb-4">
              {searchTerm || filtroEstado !== 'todos' 
                ? 'No se encontraron proyectos con los filtros aplicados'
                : 'Comienza creando tu primer proyecto de actualización'}
            </p>
            {canCreate && !searchTerm && filtroEstado === 'todos' && (
              <Button 
                onClick={() => {
                  fetchMunicipiosDisponibles();
                  setShowCrearModal(true);
                }}
                className="bg-amber-600 hover:bg-amber-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Crear Proyecto
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {proyectosFiltrados.map((proyecto) => {
            const estadoInfo = estadoConfig[proyecto.estado] || estadoConfig.activo;
            const EstadoIcon = estadoInfo.icon;
            
            return (
              <Card 
                key={proyecto.id} 
                className="bg-white hover:shadow-md transition-shadow"
                data-testid={`proyecto-card-${proyecto.id}`}
              >
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* Info principal */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-slate-900 truncate">
                          {proyecto.nombre}
                        </h3>
                        <Badge className={`${estadoInfo.color} border flex items-center gap-1`}>
                          <EstadoIcon className="w-3 h-3" />
                          {estadoInfo.label}
                        </Badge>
                      </div>
                      
                      <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {proyecto.municipio}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(proyecto.created_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {proyecto.creado_por_nombre}
                        </span>
                      </div>
                      
                      {proyecto.descripcion && (
                        <p className="text-sm text-slate-600 mt-2 line-clamp-1">
                          {proyecto.descripcion}
                        </p>
                      )}
                    </div>
                    
                    {/* Indicadores de archivos */}
                    <div className="flex gap-2 flex-shrink-0">
                      <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                        proyecto.gdb_archivo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                      }`}>
                        <Database className="w-3 h-3" />
                        GDB
                      </div>
                      <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                        proyecto.r1_archivo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                      }`}>
                        <FileSpreadsheet className="w-3 h-3" />
                        R1
                      </div>
                      <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                        proyecto.r2_archivo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                      }`}>
                        <FileSpreadsheet className="w-3 h-3" />
                        R2
                      </div>
                    </div>
                    
                    {/* Acciones */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setProyectoSeleccionado(proyecto);
                          setShowDetalleModal(true);
                        }}
                        data-testid={`ver-proyecto-${proyecto.id}`}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Ver
                      </Button>
                      
                      {canCreate && proyecto.estado !== 'archivado' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" data-testid={`menu-proyecto-${proyecto.id}`}>
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {proyecto.estado === 'activo' && (
                              <DropdownMenuItem onClick={() => handleCambiarEstado(proyecto.id, 'pausado')}>
                                <Pause className="w-4 h-4 mr-2" />
                                Pausar
                              </DropdownMenuItem>
                            )}
                            {proyecto.estado === 'pausado' && (
                              <DropdownMenuItem onClick={() => handleCambiarEstado(proyecto.id, 'activo')}>
                                <Play className="w-4 h-4 mr-2" />
                                Reactivar
                              </DropdownMenuItem>
                            )}
                            {['activo', 'pausado'].includes(proyecto.estado) && (
                              <DropdownMenuItem onClick={() => handleCambiarEstado(proyecto.id, 'completado')}>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Marcar Completado
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleArchivar(proyecto.id)}>
                              <Archive className="w-4 h-4 mr-2" />
                              Archivar
                            </DropdownMenuItem>
                            {canDelete && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-red-600"
                                  onClick={() => {
                                    setProyectoSeleccionado(proyecto);
                                    setShowEliminarModal(true);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Eliminar
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      
                      {proyecto.estado === 'archivado' && canCreate && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleRestaurar(proyecto.id)}
                        >
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Restaurar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Crear Proyecto */}
      <Dialog open={showCrearModal} onOpenChange={setShowCrearModal}>
        <DialogContent className="sm:max-w-lg" data-testid="crear-proyecto-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-600" />
              Nuevo Proyecto de Actualización
            </DialogTitle>
            <DialogDescription>
              Crea un nuevo proyecto para gestionar la actualización catastral de un municipio.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre del Proyecto *</Label>
              <Input
                id="nombre"
                placeholder="Ej: Actualización Catastral 2025"
                value={nuevoProyecto.nombre}
                onChange={(e) => setNuevoProyecto(prev => ({ ...prev, nombre: e.target.value }))}
                data-testid="input-nombre-proyecto"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="municipio">Municipio *</Label>
              <Select 
                value={nuevoProyecto.municipio}
                onValueChange={(value) => setNuevoProyecto(prev => ({ ...prev, municipio: value }))}
              >
                <SelectTrigger data-testid="select-municipio">
                  <SelectValue placeholder="Seleccionar municipio" />
                </SelectTrigger>
                <SelectContent>
                  {municipiosDisponibles.length === 0 ? (
                    <div className="p-2 text-sm text-slate-500 text-center">
                      No hay municipios disponibles
                    </div>
                  ) : (
                    municipiosDisponibles.map((mun) => (
                      <SelectItem key={mun} value={mun}>{mun}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Solo se muestran municipios sin proyectos activos o pausados
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción (opcional)</Label>
              <Textarea
                id="descripcion"
                placeholder="Describe brevemente el objetivo del proyecto..."
                value={nuevoProyecto.descripcion}
                onChange={(e) => setNuevoProyecto(prev => ({ ...prev, descripcion: e.target.value }))}
                rows={3}
                data-testid="input-descripcion-proyecto"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCrearModal(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCrearProyecto}
              disabled={creando}
              className="bg-amber-600 hover:bg-amber-700"
              data-testid="confirmar-crear-proyecto"
            >
              {creando ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Proyecto
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Detalle Proyecto */}
      <Dialog open={showDetalleModal} onOpenChange={setShowDetalleModal}>
        <DialogContent className="sm:max-w-2xl" data-testid="detalle-proyecto-modal">
          {proyectoSeleccionado && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-amber-600" />
                  {proyectoSeleccionado.nombre}
                </DialogTitle>
                <DialogDescription>
                  Detalles y archivos del proyecto de actualización
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6 py-4">
                {/* Info general */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Municipio</p>
                    <p className="font-medium">{proyectoSeleccionado.municipio}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Estado</p>
                    <Badge className={`${estadoConfig[proyectoSeleccionado.estado]?.color} border`}>
                      {estadoConfig[proyectoSeleccionado.estado]?.label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Creado por</p>
                    <p className="font-medium">{proyectoSeleccionado.creado_por_nombre}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Fecha creación</p>
                    <p className="font-medium">{formatDate(proyectoSeleccionado.created_at)}</p>
                  </div>
                </div>
                
                {proyectoSeleccionado.descripcion && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase mb-1">Descripción</p>
                    <p className="text-slate-700">{proyectoSeleccionado.descripcion}</p>
                  </div>
                )}
                
                {/* Archivos */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-slate-900">Archivos del Proyecto</h4>
                  
                  <div className="grid gap-3">
                    {/* GDB */}
                    <Card className={`${proyectoSeleccionado.gdb_archivo ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Database className={`w-5 h-5 ${proyectoSeleccionado.gdb_archivo ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <div>
                            <p className="font-medium">Base Gráfica (GDB)</p>
                            {proyectoSeleccionado.gdb_archivo ? (
                              <p className="text-xs text-slate-500">
                                Cargado: {formatDate(proyectoSeleccionado.gdb_cargado_en)}
                              </p>
                            ) : (
                              <p className="text-xs text-slate-400">Sin cargar</p>
                            )}
                          </div>
                        </div>
                        {proyectoSeleccionado.estado !== 'archivado' && canCreate && (
                          <Button variant="outline" size="sm" disabled>
                            <Upload className="w-4 h-4 mr-1" />
                            {proyectoSeleccionado.gdb_archivo ? 'Reemplazar' : 'Cargar'}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                    
                    {/* R1 */}
                    <Card className={`${proyectoSeleccionado.r1_archivo ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileSpreadsheet className={`w-5 h-5 ${proyectoSeleccionado.r1_archivo ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <div>
                            <p className="font-medium">Información Física (R1)</p>
                            {proyectoSeleccionado.r1_archivo ? (
                              <p className="text-xs text-slate-500">
                                Cargado: {formatDate(proyectoSeleccionado.r1_cargado_en)} • {proyectoSeleccionado.r1_total_registros} registros
                              </p>
                            ) : (
                              <p className="text-xs text-slate-400">Sin cargar</p>
                            )}
                          </div>
                        </div>
                        {proyectoSeleccionado.estado !== 'archivado' && canCreate && (
                          <Button variant="outline" size="sm" disabled>
                            <Upload className="w-4 h-4 mr-1" />
                            {proyectoSeleccionado.r1_archivo ? 'Reemplazar' : 'Cargar'}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                    
                    {/* R2 */}
                    <Card className={`${proyectoSeleccionado.r2_archivo ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileSpreadsheet className={`w-5 h-5 ${proyectoSeleccionado.r2_archivo ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <div>
                            <p className="font-medium">Información Jurídica (R2)</p>
                            {proyectoSeleccionado.r2_archivo ? (
                              <p className="text-xs text-slate-500">
                                Cargado: {formatDate(proyectoSeleccionado.r2_cargado_en)} • {proyectoSeleccionado.r2_total_registros} registros
                              </p>
                            ) : (
                              <p className="text-xs text-slate-400">Sin cargar</p>
                            )}
                          </div>
                        </div>
                        {proyectoSeleccionado.estado !== 'archivado' && canCreate && (
                          <Button variant="outline" size="sm" disabled>
                            <Upload className="w-4 h-4 mr-1" />
                            {proyectoSeleccionado.r2_archivo ? 'Reemplazar' : 'Cargar'}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                  
                  <p className="text-xs text-slate-500 italic">
                    La carga de archivos estará disponible en la siguiente fase del desarrollo.
                  </p>
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDetalleModal(false)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Confirmar Eliminación */}
      <Dialog open={showEliminarModal} onOpenChange={setShowEliminarModal}>
        <DialogContent className="sm:max-w-md" data-testid="eliminar-proyecto-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              Eliminar Proyecto
            </DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Se eliminarán todos los archivos y datos asociados al proyecto.
            </DialogDescription>
          </DialogHeader>
          
          {proyectoSeleccionado && (
            <div className="py-4">
              <p className="text-slate-700">
                ¿Estás seguro de que deseas eliminar el proyecto <strong>"{proyectoSeleccionado.nombre}"</strong> del municipio <strong>{proyectoSeleccionado.municipio}</strong>?
              </p>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEliminarModal(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={handleEliminar}
              data-testid="confirmar-eliminar-proyecto"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
