import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Progress } from '../components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
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
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Clock,
  CalendarDays,
  ListTodo,
  Users,
  X,
  FileCheck,
  CornerDownRight
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

const prioridadConfig = {
  alta: { label: 'Alta', color: 'text-red-600' },
  media: { label: 'Media', color: 'text-amber-600' },
  baja: { label: 'Baja', color: 'text-slate-500' }
};

export default function ProyectosActualizacion() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [proyectos, setProyectos] = useState([]);
  const [estadisticas, setEstadisticas] = useState({ activos: 0, pausados: 0, completados: 0, archivados: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [vinculandoDatos, setVinculandoDatos] = useState(false);
  
  // Modal states
  const [showCrearModal, setShowCrearModal] = useState(false);
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [showEliminarModal, setShowEliminarModal] = useState(false);
  const [showActividadModal, setShowActividadModal] = useState(false);
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState(null);
  const [etapas, setEtapas] = useState([]);
  const [etapasAbiertas, setEtapasAbiertas] = useState({});
  const [etapaSeleccionada, setEtapaSeleccionada] = useState(null);
  
  // Form states
  const [nuevoProyecto, setNuevoProyecto] = useState({ nombre: '', municipio: '', descripcion: '' });
  const [municipiosDisponibles, setMunicipiosDisponibles] = useState([]);
  const [creando, setCreando] = useState(false);
  const [nuevaActividad, setNuevaActividad] = useState({ 
    nombre: '', 
    descripcion: '', 
    fase: '', 
    fecha_inicio: '',
    fecha_fin_planificada: '', 
    prioridad: 'media',
    actividad_padre_id: ''
  });
  
  // Upload refs
  const baseGraficaRef = useRef(null);
  const infoAlfanumericaRef = useRef(null);
  const [uploading, setUploading] = useState({ base_grafica: false, info_alfanumerica: false });

  // Tab del modal de detalle
  const [detalleTab, setDetalleTab] = useState('info');

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

  const fetchEtapas = async (proyectoId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/actualizacion/proyectos/${proyectoId}/etapas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEtapas(response.data.etapas || []);
      // Abrir todas las etapas por defecto
      const abiertasInit = {};
      (response.data.etapas || []).forEach(e => { abiertasInit[e.id] = true; });
      setEtapasAbiertas(abiertasInit);
    } catch (error) {
      console.error('Error fetching etapas:', error);
      setEtapas([]);
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
      await axios.post(`${API}/actualizacion/proyectos`, nuevoProyecto, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Proyecto creado exitosamente con sus 3 etapas');
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
      setShowDetalleModal(false);
      setProyectoSeleccionado(null);
      fetchProyectos();
      fetchEstadisticas();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar');
    }
  };

  const handleVincularDatosExistentes = async () => {
    if (!proyectoSeleccionado) return;
    
    setVinculandoDatos(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/actualizacion/proyectos/${proyectoSeleccionado.id}/vincular-datos-existentes`,
        {},
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      toast.success(response.data.message);
      
      // Actualizar proyecto seleccionado con los nuevos datos
      setProyectoSeleccionado(prev => ({
        ...prev,
        datos_vinculados: true,
        base_grafica_total_predios: response.data.estadisticas.geometrias_gdb,
        info_alfanumerica_total_registros: response.data.estadisticas.predios_r1r2,
        total_construcciones: response.data.estadisticas.construcciones
      }));
      
      fetchProyectos();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al vincular datos');
    } finally {
      setVinculandoDatos(false);
    }
  };

  const handleAbrirVisorProyecto = () => {
    if (!proyectoSeleccionado) return;
    // Navegar al visor de predios con el municipio del proyecto
    navigate(`/dashboard/visor?municipio=${encodeURIComponent(proyectoSeleccionado.municipio)}&proyecto=${proyectoSeleccionado.id}`);
  };

  const handleUploadBaseGrafica = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !proyectoSeleccionado) return;

    setUploading(prev => ({ ...prev, base_grafica: true }));
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/actualizacion/proyectos/${proyectoSeleccionado.id}/upload-base-grafica`,
        formData,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
      );
      toast.success('Base Gráfica cargada exitosamente');
      // Refrescar proyecto
      const response = await axios.get(`${API}/actualizacion/proyectos/${proyectoSeleccionado.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProyectoSeleccionado(response.data);
      fetchProyectos();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al cargar el archivo');
    } finally {
      setUploading(prev => ({ ...prev, base_grafica: false }));
      if (baseGraficaRef.current) baseGraficaRef.current.value = '';
    }
  };

  const handleUploadInfoAlfanumerica = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !proyectoSeleccionado) return;

    setUploading(prev => ({ ...prev, info_alfanumerica: true }));
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/actualizacion/proyectos/${proyectoSeleccionado.id}/upload-info-alfanumerica`,
        formData,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
      );
      toast.success('Información Alfanumérica cargada exitosamente');
      // Refrescar proyecto
      const response = await axios.get(`${API}/actualizacion/proyectos/${proyectoSeleccionado.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProyectoSeleccionado(response.data);
      fetchProyectos();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al cargar el archivo');
    } finally {
      setUploading(prev => ({ ...prev, info_alfanumerica: false }));
      if (infoAlfanumericaRef.current) infoAlfanumericaRef.current.value = '';
    }
  };

  const handleCrearActividad = async () => {
    if (!nuevaActividad.nombre.trim()) {
      toast.error('El nombre de la actividad es requerido');
      return;
    }
    if (!etapaSeleccionada) {
      toast.error('Debe seleccionar una etapa');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const dataToSend = {
        nombre: nuevaActividad.nombre,
        descripcion: nuevaActividad.descripcion || null,
        fase: nuevaActividad.fase || null,
        fecha_inicio: nuevaActividad.fecha_inicio || null,
        fecha_fin_planificada: nuevaActividad.fecha_fin_planificada || null,
        prioridad: nuevaActividad.prioridad,
        actividad_padre_id: nuevaActividad.actividad_padre_id || null
      };
      
      await axios.post(
        `${API}/actualizacion/etapas/${etapaSeleccionada.id}/actividades`,
        dataToSend,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Actividad creada');
      setShowActividadModal(false);
      setNuevaActividad({ nombre: '', descripcion: '', fase: '', fecha_inicio: '', fecha_fin_planificada: '', prioridad: 'media', actividad_padre_id: '' });
      fetchEtapas(proyectoSeleccionado.id);
    } catch (error) {
      console.error('Error creating actividad:', error);
      toast.error(error.response?.data?.detail || 'Error al crear la actividad');
    }
  };

  const handleActualizarActividad = async (actividadId, updates) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `${API}/actualizacion/actividades/${actividadId}`,
        updates,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchEtapas(proyectoSeleccionado.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al actualizar');
    }
  };

  const handleEliminarActividad = async (actividadId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/actualizacion/actividades/${actividadId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Actividad eliminada');
      fetchEtapas(proyectoSeleccionado.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar');
    }
  };

  const abrirDetalleProyecto = async (proyecto) => {
    setProyectoSeleccionado(proyecto);
    setDetalleTab('info');
    await fetchEtapas(proyecto.id);
    setShowDetalleModal(true);
  };

  // Obtener actividades principales (sin padre) de una etapa para el selector
  const getActividadesPrincipales = (etapaId) => {
    const etapa = etapas.find(e => e.id === etapaId);
    if (!etapa) return [];
    return (etapa.actividades || []).filter(a => !a.actividad_padre_id);
  };

  // Organizar actividades en jerarquía
  const organizarActividadesJerarquicamente = (actividades) => {
    const principales = actividades.filter(a => !a.actividad_padre_id);
    const resultado = [];
    
    principales.forEach(principal => {
      resultado.push({ ...principal, nivel: 0 });
      // Buscar hijos
      const hijos = actividades.filter(a => a.actividad_padre_id === principal.id);
      hijos.forEach(hijo => {
        resultado.push({ ...hijo, nivel: 1 });
        // Buscar nietos
        const nietos = actividades.filter(a => a.actividad_padre_id === hijo.id);
        nietos.forEach(nieto => {
          resultado.push({ ...nieto, nivel: 2 });
        });
      });
    });
    
    // Agregar las que no tienen padre y no fueron incluidas
    actividades.forEach(a => {
      if (!resultado.find(r => r.id === a.id)) {
        resultado.push({ ...a, nivel: 0 });
      }
    });
    
    return resultado;
  };

  const proyectosFiltrados = proyectos.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.municipio.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canCreate = ['administrador', 'coordinador'].includes(user?.role);
  const canDelete = ['administrador', 'coordinador'].includes(user?.role);

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getFileName = (filePath) => {
    if (!filePath) return null;
    const parts = filePath.split('/');
    return parts[parts.length - 1];
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
                <TabsTrigger value="todos">Todos</TabsTrigger>
                <TabsTrigger value="activo">Activos</TabsTrigger>
                <TabsTrigger value="pausado">Pausados</TabsTrigger>
                <TabsTrigger value="completado">Completados</TabsTrigger>
                <TabsTrigger value="archivado">Archivados</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" onClick={() => { fetchProyectos(); fetchEstadisticas(); }}>
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
                    </div>
                    
                    {/* Indicadores de archivos */}
                    <div className="flex gap-2 flex-shrink-0">
                      <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                        proyecto.base_grafica_archivo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                      }`}>
                        <Database className="w-3 h-3" />
                        Base Gráfica
                      </div>
                      <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                        proyecto.info_alfanumerica_archivo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                      }`}>
                        <FileSpreadsheet className="w-3 h-3" />
                        Info. Alfanumérica
                      </div>
                    </div>
                    
                    {/* Acciones */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => abrirDetalleProyecto(proyecto)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Ver
                      </Button>
                      
                      {(canCreate || canDelete) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {canCreate && proyecto.estado === 'activo' && (
                              <DropdownMenuItem onClick={() => handleCambiarEstado(proyecto.id, 'pausado')}>
                                <Pause className="w-4 h-4 mr-2" />
                                Pausar
                              </DropdownMenuItem>
                            )}
                            {canCreate && proyecto.estado === 'pausado' && (
                              <DropdownMenuItem onClick={() => handleCambiarEstado(proyecto.id, 'activo')}>
                                <Play className="w-4 h-4 mr-2" />
                                Reactivar
                              </DropdownMenuItem>
                            )}
                            {canCreate && proyecto.estado === 'completado' && (
                              <DropdownMenuItem onClick={() => handleCambiarEstado(proyecto.id, 'activo')}>
                                <Play className="w-4 h-4 mr-2" />
                                Reactivar
                              </DropdownMenuItem>
                            )}
                            {canCreate && ['activo', 'pausado'].includes(proyecto.estado) && (
                              <DropdownMenuItem onClick={() => handleCambiarEstado(proyecto.id, 'completado')}>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Marcar Completado
                              </DropdownMenuItem>
                            )}
                            {canCreate && proyecto.estado !== 'archivado' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleArchivar(proyecto.id)}>
                                  <Archive className="w-4 h-4 mr-2" />
                                  Archivar
                                </DropdownMenuItem>
                              </>
                            )}
                            {canCreate && proyecto.estado === 'archivado' && (
                              <DropdownMenuItem onClick={() => handleRestaurar(proyecto.id)}>
                                <RotateCcw className="w-4 h-4 mr-2" />
                                Restaurar
                              </DropdownMenuItem>
                            )}
                            {canDelete && proyecto.estado !== 'archivado' && (
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
        <DialogContent className="sm:max-w-lg">
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
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="municipio">Municipio *</Label>
              <Select 
                value={nuevoProyecto.municipio}
                onValueChange={(value) => setNuevoProyecto(prev => ({ ...prev, municipio: value }))}
              >
                <SelectTrigger>
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
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción (opcional)</Label>
              <Textarea
                id="descripcion"
                placeholder="Describe brevemente el objetivo del proyecto..."
                value={nuevoProyecto.descripcion}
                onChange={(e) => setNuevoProyecto(prev => ({ ...prev, descripcion: e.target.value }))}
                rows={3}
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
            >
              {creando ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              {creando ? 'Creando...' : 'Crear Proyecto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Detalle Proyecto */}
      <Dialog open={showDetalleModal} onOpenChange={setShowDetalleModal}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          {proyectoSeleccionado && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-amber-600" />
                  {proyectoSeleccionado.nombre}
                </DialogTitle>
                <DialogDescription>
                  {proyectoSeleccionado.municipio} • {estadoConfig[proyectoSeleccionado.estado]?.label}
                </DialogDescription>
              </DialogHeader>
              
              <Tabs value={detalleTab} onValueChange={setDetalleTab} className="w-full">
                <TabsList className={`grid w-full ${canCreate ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  <TabsTrigger value="info" className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4" />
                    Información
                  </TabsTrigger>
                  <TabsTrigger value="archivos" className="flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    Archivos
                  </TabsTrigger>
                  {canCreate && (
                    <TabsTrigger value="cronograma" className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4" />
                      Cronograma
                    </TabsTrigger>
                  )}
                </TabsList>
                
                {/* Tab Información */}
                <TabsContent value="info" className="space-y-4 mt-4">
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

                  {/* Botón eliminar en info */}
                  {canDelete && (
                    <div className="pt-4 border-t">
                      <Button 
                        variant="destructive"
                        onClick={() => setShowEliminarModal(true)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Eliminar Proyecto
                      </Button>
                    </div>
                  )}
                </TabsContent>
                
                {/* Tab Archivos */}
                <TabsContent value="archivos" className="space-y-4 mt-4">
                  <h4 className="font-semibold text-slate-900">Archivos del Proyecto</h4>
                  
                  <div className="grid gap-3">
                    {/* Base Gráfica */}
                    <Card className={`${proyectoSeleccionado.base_grafica_archivo ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Database className={`w-5 h-5 ${proyectoSeleccionado.base_grafica_archivo ? 'text-emerald-600' : 'text-slate-400'}`} />
                            <div>
                              <p className="font-medium">Base Gráfica (GDB)</p>
                              {proyectoSeleccionado.base_grafica_archivo ? (
                                <>
                                  <p className="text-xs text-emerald-600 flex items-center gap-1">
                                    <FileCheck className="w-3 h-3" />
                                    Archivo cargado
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {getFileName(proyectoSeleccionado.base_grafica_archivo)}
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    Cargado: {formatDate(proyectoSeleccionado.base_grafica_cargado_en)}
                                  </p>
                                </>
                              ) : (
                                <p className="text-xs text-slate-400">Sin cargar - Archivo ZIP con geodatabase</p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {proyectoSeleccionado.base_grafica_archivo && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  const token = localStorage.getItem('token');
                                  window.open(`${API}/actualizacion/proyectos/${proyectoSeleccionado.id}/descargar-base-grafica?token=${token}`, '_blank');
                                }}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Descargar
                              </Button>
                            )}
                            {canCreate && (
                              <>
                                <input
                                  type="file"
                                  ref={baseGraficaRef}
                                  accept=".zip"
                                  onChange={handleUploadBaseGrafica}
                                  className="hidden"
                                />
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => baseGraficaRef.current?.click()}
                                  disabled={uploading.base_grafica}
                                >
                                  {uploading.base_grafica ? (
                                    <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                                  ) : (
                                    <Upload className="w-4 h-4 mr-1" />
                                  )}
                                  {proyectoSeleccionado.base_grafica_archivo ? 'Reemplazar' : 'Cargar'}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Información Alfanumérica */}
                    <Card className={`${proyectoSeleccionado.info_alfanumerica_archivo ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FileSpreadsheet className={`w-5 h-5 ${proyectoSeleccionado.info_alfanumerica_archivo ? 'text-emerald-600' : 'text-slate-400'}`} />
                            <div>
                              <p className="font-medium">Información Alfanumérica (R1/R2)</p>
                              {proyectoSeleccionado.info_alfanumerica_archivo ? (
                                <>
                                  <p className="text-xs text-emerald-600 flex items-center gap-1">
                                    <FileCheck className="w-3 h-3" />
                                    Archivo cargado
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {getFileName(proyectoSeleccionado.info_alfanumerica_archivo)}
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    Cargado: {formatDate(proyectoSeleccionado.info_alfanumerica_cargado_en)}
                                  </p>
                                </>
                              ) : (
                                <p className="text-xs text-slate-400">Sin cargar - Archivo Excel (.xlsx)</p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {proyectoSeleccionado.info_alfanumerica_archivo && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  const token = localStorage.getItem('token');
                                  window.open(`${API}/actualizacion/proyectos/${proyectoSeleccionado.id}/descargar-info-alfanumerica?token=${token}`, '_blank');
                                }}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Descargar
                              </Button>
                            )}
                            {canCreate && (
                              <>
                                <input
                                  type="file"
                                  ref={infoAlfanumericaRef}
                                  accept=".xlsx,.xls"
                                  onChange={handleUploadInfoAlfanumerica}
                                  className="hidden"
                                />
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => infoAlfanumericaRef.current?.click()}
                                  disabled={uploading.info_alfanumerica}
                                >
                                  {uploading.info_alfanumerica ? (
                                    <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                                  ) : (
                                    <Upload className="w-4 h-4 mr-1" />
                                  )}
                                  {proyectoSeleccionado.info_alfanumerica_archivo ? 'Reemplazar' : 'Cargar'}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
                
                {/* Tab Cronograma - Solo para admin/coordinador */}
                {canCreate && (
                <TabsContent value="cronograma" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-slate-900">Cronograma de Actividades</h4>
                  </div>
                  
                  {etapas.length === 0 ? (
                    <Card className="bg-amber-50 border-amber-200">
                      <CardContent className="p-6 text-center">
                        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
                        <p className="text-slate-700 font-medium">Este proyecto no tiene etapas</p>
                        <p className="text-sm text-slate-500 mt-1">
                          Los proyectos creados antes del sistema de cronograma no tienen etapas.
                          Puede crear un nuevo proyecto para usar esta funcionalidad.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {etapas.map((etapa) => {
                        const actividadesOrganizadas = organizarActividadesJerarquicamente(etapa.actividades || []);
                        
                        return (
                          <Card key={etapa.id} className="border-l-4 border-l-amber-500">
                            <Collapsible 
                              open={etapasAbiertas[etapa.id]} 
                              onOpenChange={(open) => setEtapasAbiertas(prev => ({ ...prev, [etapa.id]: open }))}
                            >
                              <CardHeader className="pb-2">
                                <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
                                  <div className="flex items-center gap-3">
                                    {etapasAbiertas[etapa.id] ? (
                                      <ChevronDown className="w-5 h-5 text-slate-400" />
                                    ) : (
                                      <ChevronRight className="w-5 h-5 text-slate-400" />
                                    )}
                                    <div>
                                      <CardTitle className="text-base">{etapa.nombre}</CardTitle>
                                      <p className="text-xs text-slate-500">{etapa.descripcion}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <div className="text-right">
                                      <p className="text-xs text-slate-500">Progreso</p>
                                      <p className="font-semibold text-amber-600">{etapa.progreso || 0}%</p>
                                    </div>
                                    <Progress value={etapa.progreso || 0} className="w-24 h-2" />
                                  </div>
                                </CollapsibleTrigger>
                              </CardHeader>
                              
                              <CollapsibleContent>
                                <CardContent className="pt-0">
                                  {/* Actividades */}
                                  <div className="space-y-2 mt-2">
                                    {actividadesOrganizadas.length === 0 ? (
                                      <p className="text-sm text-slate-400 text-center py-4">
                                        No hay actividades en esta etapa
                                      </p>
                                    ) : (
                                      actividadesOrganizadas.map((actividad) => (
                                        <div 
                                          key={actividad.id}
                                          className={`flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 ${actividad.nivel > 0 ? 'ml-' + (actividad.nivel * 6) : ''}`}
                                          style={{ marginLeft: actividad.nivel * 24 }}
                                        >
                                          <div className="flex items-center gap-3">
                                            {actividad.nivel > 0 && (
                                              <CornerDownRight className="w-4 h-4 text-slate-300" />
                                            )}
                                            <ListTodo className={`w-4 h-4 ${prioridadConfig[actividad.prioridad]?.color || 'text-slate-400'}`} />
                                            <div>
                                              <div className="flex items-center gap-2">
                                                <p className="font-medium text-sm">{actividad.nombre}</p>
                                                {actividad.fase && (
                                                  <Badge variant="outline" className="text-xs">{actividad.fase}</Badge>
                                                )}
                                              </div>
                                              <div className="flex gap-3 text-xs text-slate-500">
                                                {actividad.fecha_inicio && (
                                                  <span className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    Inicio: {formatDate(actividad.fecha_inicio)}
                                                  </span>
                                                )}
                                                {actividad.fecha_fin_planificada && (
                                                  <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    Vence: {formatDate(actividad.fecha_fin_planificada)}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {actividad.responsables?.length > 0 && (
                                              <div className="flex items-center gap-1 text-xs text-slate-500">
                                                <Users className="w-3 h-3" />
                                                {actividad.responsables.length}
                                              </div>
                                            )}
                                            <Select
                                              value={actividad.estado}
                                              onValueChange={(val) => handleActualizarActividad(actividad.id, { estado: val })}
                                              disabled={!canCreate}
                                            >
                                              <SelectTrigger className="w-32 h-7 text-xs">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="pendiente">Pendiente</SelectItem>
                                                <SelectItem value="en_progreso">En Progreso</SelectItem>
                                                <SelectItem value="completada">Completada</SelectItem>
                                                <SelectItem value="bloqueada">Bloqueada</SelectItem>
                                              </SelectContent>
                                            </Select>
                                            {canCreate && (
                                              <Button 
                                                variant="ghost" 
                                                size="sm"
                                                onClick={() => handleEliminarActividad(actividad.id)}
                                                className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                                              >
                                                <X className="w-4 h-4" />
                                              </Button>
                                            )}
                                          </div>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                  
                                  {/* Botón agregar actividad */}
                                  {canCreate && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="mt-3 w-full border-dashed"
                                      onClick={() => {
                                        setEtapaSeleccionada(etapa);
                                        setNuevaActividad({ nombre: '', descripcion: '', fase: '', fecha_inicio: '', fecha_fin_planificada: '', prioridad: 'media', actividad_padre_id: '' });
                                        setShowActividadModal(true);
                                      }}
                                    >
                                      <Plus className="w-4 h-4 mr-2" />
                                      Agregar Actividad
                                    </Button>
                                  )}
                                </CardContent>
                              </CollapsibleContent>
                            </Collapsible>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
                )}
              </Tabs>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDetalleModal(false)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Crear Actividad */}
      <Dialog open={showActividadModal} onOpenChange={setShowActividadModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-600" />
              Nueva Actividad
            </DialogTitle>
            <DialogDescription>
              {etapaSeleccionada?.nombre}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre de la Actividad *</Label>
              <Input
                placeholder="Ej: Análisis del perímetro urbano"
                value={nuevaActividad.nombre}
                onChange={(e) => setNuevaActividad(prev => ({ ...prev, nombre: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Actividad Padre (opcional)</Label>
              <Select 
                value={nuevaActividad.actividad_padre_id}
                onValueChange={(value) => setNuevaActividad(prev => ({ ...prev, actividad_padre_id: value === 'ninguna' ? '' : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ninguna - Es actividad principal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ninguna">Ninguna - Es actividad principal</SelectItem>
                  {etapaSeleccionada && getActividadesPrincipales(etapaSeleccionada.id).map((act) => (
                    <SelectItem key={act.id} value={act.id}>
                      ↳ {act.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Selecciona una actividad padre si esta es una sub-actividad
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Fase (opcional)</Label>
              <Input
                placeholder="Ej: Alistamiento, Planeación, etc."
                value={nuevaActividad.fase}
                onChange={(e) => setNuevaActividad(prev => ({ ...prev, fase: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Descripción (opcional)</Label>
              <Textarea
                placeholder="Descripción de la actividad..."
                value={nuevaActividad.descripcion}
                onChange={(e) => setNuevaActividad(prev => ({ ...prev, descripcion: e.target.value }))}
                rows={2}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha Inicio (opcional)</Label>
                <Input
                  type="date"
                  value={nuevaActividad.fecha_inicio}
                  onChange={(e) => setNuevaActividad(prev => ({ ...prev, fecha_inicio: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha Límite (opcional)</Label>
                <Input
                  type="date"
                  value={nuevaActividad.fecha_fin_planificada}
                  onChange={(e) => setNuevaActividad(prev => ({ ...prev, fecha_fin_planificada: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select
                value={nuevaActividad.prioridad}
                onValueChange={(val) => setNuevaActividad(prev => ({ ...prev, prioridad: val }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActividadModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCrearActividad} className="bg-amber-600 hover:bg-amber-700">
              <Plus className="w-4 h-4 mr-2" />
              Crear Actividad
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmar Eliminación */}
      <Dialog open={showEliminarModal} onOpenChange={setShowEliminarModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              Eliminar Proyecto
            </DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Se eliminarán todos los archivos, etapas y actividades del proyecto.
            </DialogDescription>
          </DialogHeader>
          
          {proyectoSeleccionado && (
            <div className="py-4">
              <p className="text-slate-700">
                ¿Estás seguro de que deseas eliminar el proyecto <strong>&quot;{proyectoSeleccionado.nombre}&quot;</strong> del municipio <strong>{proyectoSeleccionado.municipio}</strong>?
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
