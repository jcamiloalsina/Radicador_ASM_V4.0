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
  CornerDownRight,
  Download,
  BarChart3,
  WifiOff,
  Building2,
  Map,
  Pencil,
  ClipboardList,
  DollarSign,
  Loader2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import CronogramaGantt from '../components/CronogramaGantt';
import { saveProyectosOffline, getProyectosOffline as getProyectosFromDB, initOfflineDB } from '../utils/offlineDB';

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
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isOfflineData, setIsOfflineData] = useState(false);
  const [syncing, setSyncing] = useState(false);
  
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

  // Estados para Gestión de Predios
  const [prediosProyecto, setPrediosProyecto] = useState([]);
  const [loadingPredios, setLoadingPredios] = useState(false);
  const [prediosBusqueda, setPrediosBusqueda] = useState('');
  const [prediosFiltroEstado, setPrediosFiltroEstado] = useState('todos');
  const [prediosFiltroZona, setPrediosFiltroZona] = useState('todos');
  const [prediosPagina, setPrediosPagina] = useState(1);
  const [prediosStats, setPrediosStats] = useState({ total: 0, pendientes: 0, visitados: 0, actualizados: 0 });
  const [showEditarPredioModal, setShowEditarPredioModal] = useState(false);
  const [showCrearPredioModal, setShowCrearPredioModal] = useState(false);
  const [predioSeleccionadoEditar, setPredioSeleccionadoEditar] = useState(null);
  const prediosPorPagina = 20;

  // Detectar cambios de conexión
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Conexión restaurada', { description: 'Actualizando datos...' });
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Sin conexión', { description: 'Mostrando datos guardados localmente' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Inicializar IndexedDB (con manejo de errores silencioso)
    initOfflineDB().catch(e => {
      console.warn('[Offline] IndexedDB no disponible:', e.message);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchProyectos = useCallback(async () => {
    // Si estamos offline, cargar desde IndexedDB
    if (!navigator.onLine) {
      try {
        const offlineProyectos = await getProyectosFromDB(filtroEstado);
        setProyectos(offlineProyectos || []);
        setIsOfflineData(true);
        console.log('[Offline] Cargados', offlineProyectos?.length || 0, 'proyectos desde cache');
      } catch (error) {
        console.error('[Offline] Error cargando proyectos offline:', error);
        setProyectos([]);
      }
      return;
    }

    // Si estamos online, cargar desde API
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
      const proyectosData = response.data.proyectos || [];
      setProyectos(proyectosData);
      setIsOfflineData(false);
      
      // Guardar en IndexedDB para uso offline (solo si filtro es 'todos' para tener todos los datos)
      if (filtroEstado === 'todos' && proyectosData.length > 0) {
        try {
          await saveProyectosOffline(proyectosData);
          console.log('[Online] Proyectos guardados para uso offline');
        } catch (e) {
          console.error('[Online] Error guardando proyectos offline:', e);
        }
      }
    } catch (error) {
      console.error('Error fetching proyectos:', error);
      
      // Si falla la conexión, intentar cargar desde offline
      if (error.code === 'ERR_NETWORK' || !navigator.onLine) {
        try {
          const offlineProyectos = await getProyectosFromDB(filtroEstado);
          if (offlineProyectos && offlineProyectos.length > 0) {
            setProyectos(offlineProyectos);
            setIsOfflineData(true);
            toast.info('Mostrando datos guardados localmente');
            return;
          }
        } catch (offlineError) {
          console.error('[Offline] Error en fallback:', offlineError);
        }
      }
      
      toast.error('Error al cargar los proyectos');
    }
  }, [filtroEstado]);

  // Función para forzar sincronización desde servidor
  const forceRefreshProyectos = async () => {
    if (!navigator.onLine) {
      toast.warning('Sin conexión a internet');
      return;
    }
    
    setSyncing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/actualizacion/proyectos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const proyectosData = response.data.proyectos || [];
      setProyectos(proyectosData);
      setIsOfflineData(false);
      
      // Guardar en IndexedDB
      if (proyectosData.length > 0) {
        await saveProyectosOffline(proyectosData);
        toast.success(`${proyectosData.length} proyectos sincronizados`);
      }
      
      // Actualizar estadísticas
      await fetchEstadisticas();
    } catch (error) {
      console.error('Error syncing proyectos:', error);
      toast.error('Error al sincronizar');
    } finally {
      setSyncing(false);
    }
  };

  const fetchEstadisticas = useCallback(async () => {
    // Si estamos offline, calcular estadísticas desde los datos locales
    if (!navigator.onLine) {
      try {
        const allProyectos = await getProyectosFromDB('todos');
        const stats = {
          activos: allProyectos.filter(p => p.estado === 'activo').length,
          pausados: allProyectos.filter(p => p.estado === 'pausado').length,
          completados: allProyectos.filter(p => p.estado === 'completado').length,
          archivados: allProyectos.filter(p => p.estado === 'archivado').length,
          total: allProyectos.length
        };
        setEstadisticas(stats);
      } catch (error) {
        console.error('[Offline] Error calculando estadísticas:', error);
      }
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/actualizacion/proyectos/estadisticas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEstadisticas(response.data);
    } catch (error) {
      console.error('Error fetching estadísticas:', error);
      // Intentar calcular desde cache si falla
      try {
        const allProyectos = await getProyectosFromDB('todos');
        if (allProyectos && allProyectos.length > 0) {
          const stats = {
            activos: allProyectos.filter(p => p.estado === 'activo').length,
            pausados: allProyectos.filter(p => p.estado === 'pausado').length,
            completados: allProyectos.filter(p => p.estado === 'completado').length,
            archivados: allProyectos.filter(p => p.estado === 'archivado').length,
            total: allProyectos.length
          };
          setEstadisticas(stats);
        }
      } catch (e) {
        console.error('[Offline] Error en fallback estadísticas:', e);
      }
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
      await forceRefreshProyectos();
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
      await forceRefreshProyectos();
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
      await forceRefreshProyectos();
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
      await forceRefreshProyectos();
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
      await forceRefreshProyectos();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar');
    }
  };

  // Exportar Excel R1/R2
  const handleExportarExcel = async (proyectoId, soloActualizados = false) => {
    try {
      const token = localStorage.getItem('token');
      toast.info('Generando Excel R1/R2...');
      
      const response = await axios.get(
        `${API}/actualizacion/proyectos/${proyectoId}/exportar-excel?solo_actualizados=${soloActualizados}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      // Crear URL para descarga
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // Obtener nombre del archivo del header o usar uno genérico
      const contentDisposition = response.headers['content-disposition'];
      let filename = `Actualizacion_R1R2_${new Date().toISOString().split('T')[0]}.xlsx`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename=(.+)/);
        if (match) filename = match[1];
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Excel exportado exitosamente');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al exportar Excel');
    }
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

  // Función para cargar predios del proyecto
  const fetchPrediosProyecto = async (proyectoId) => {
    if (!proyectoId) return;
    setLoadingPredios(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/actualizacion/proyectos/${proyectoId}/predios`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const prediosData = response.data.predios || response.data || [];
      setPrediosProyecto(prediosData);
      
      // Calcular estadísticas
      const newStats = {
        total: prediosData.length,
        pendientes: prediosData.filter(p => !p.estado_visita || p.estado_visita === 'pendiente').length,
        visitados: prediosData.filter(p => p.estado_visita === 'visitado').length,
        actualizados: prediosData.filter(p => p.estado_visita === 'actualizado').length
      };
      setPrediosStats(newStats);
      setPrediosPagina(1);
    } catch (error) {
      console.error('Error cargando predios:', error);
      toast.error('Error al cargar predios del proyecto');
    } finally {
      setLoadingPredios(false);
    }
  };

  // Marcar predio como visitado/actualizado
  const marcarEstadoPredio = async (predio, nuevoEstado) => {
    try {
      const token = localStorage.getItem('token');
      const codigo = predio.codigo_predial || predio.numero_predial;
      await axios.patch(
        `${API}/actualizacion/proyectos/${proyectoSeleccionado.id}/predios/${encodeURIComponent(codigo)}/estado`,
        { estado_visita: nuevoEstado },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Predio marcado como ${nuevoEstado}`);
      fetchPrediosProyecto(proyectoSeleccionado.id);
    } catch (error) {
      console.error('Error actualizando estado:', error);
      toast.error('Error al actualizar estado del predio');
    }
  };

  // Filtrar predios
  const prediosFiltrados = prediosProyecto.filter(predio => {
    // Filtro de búsqueda
    if (prediosBusqueda) {
      const search = prediosBusqueda.toLowerCase();
      const codigo = (predio.codigo_predial || predio.numero_predial || '').toLowerCase();
      const direccion = (predio.direccion || '').toLowerCase();
      const propietario = predio.propietarios?.[0]?.nombre_propietario?.toLowerCase() || '';
      if (!codigo.includes(search) && !direccion.includes(search) && !propietario.includes(search)) {
        return false;
      }
    }
    // Filtro de estado
    if (prediosFiltroEstado !== 'todos') {
      const estadoPredio = predio.estado_visita || 'pendiente';
      if (estadoPredio !== prediosFiltroEstado) return false;
    }
    // Filtro de zona
    if (prediosFiltroZona !== 'todos') {
      const codigo = predio.codigo_predial || predio.numero_predial || '';
      const zonaCode = codigo.length >= 7 ? codigo.substring(5, 7) : '';
      if (prediosFiltroZona === 'rural' && zonaCode !== '00') return false;
      if (prediosFiltroZona === 'urbano' && zonaCode !== '01') return false;
    }
    return true;
  });

  // Paginación de predios
  const totalPaginasPredios = Math.ceil(prediosFiltrados.length / prediosPorPagina);
  const prediosPaginados = prediosFiltrados.slice(
    (prediosPagina - 1) * prediosPorPagina,
    prediosPagina * prediosPorPagina
  );

  // Helper para formatear área
  const formatArea = (area) => {
    if (!area && area !== 0) return 'N/A';
    const num = parseFloat(area);
    if (isNaN(num)) return 'N/A';
    return `${num.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
  };

  // Helper para formatear moneda
  const formatCurrency = (value) => {
    if (!value && value !== 0) return 'N/A';
    const num = parseFloat(value);
    if (isNaN(num)) return 'N/A';
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(num);
  };

  // Helper para obtener zona del código
  const getZonaFromCodigo = (codigo) => {
    if (!codigo || codigo.length < 7) return 'Desconocido';
    const zonaCode = codigo.substring(5, 7);
    if (zonaCode === '00') return 'Rural';
    if (zonaCode === '01') return 'Urbano';
    return `Corr. (${zonaCode})`;
  };

  // Renderizar badge de estado de visita
  const renderEstadoVisitaBadge = (estado) => {
    switch (estado) {
      case 'actualizado':
        return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle className="w-3 h-3 mr-1" />Actualizado</Badge>;
      case 'visitado':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300"><Clock className="w-3 h-3 mr-1" />Visitado</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300"><AlertCircle className="w-3 h-3 mr-1" />Pendiente</Badge>;
    }
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
      {/* Banner modo offline */}
      {(!isOnline || isOfflineData) && (
        <div className="bg-amber-500 text-white px-4 py-2 rounded-lg flex items-center gap-2">
          <WifiOff className="w-4 h-4" />
          <span className="font-medium">
            {!isOnline ? 'Sin conexión' : 'Datos offline'}
          </span>
          <span className="text-amber-100 text-sm">
            - Mostrando {proyectos.length} proyecto(s) guardado(s) localmente
          </span>
        </div>
      )}

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
        {canCreate && isOnline && (
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={forceRefreshProyectos}
              disabled={syncing}
              className="border-blue-500 text-blue-700"
              data-testid="sync-proyectos-btn"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              Sincronizar
            </Button>
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
          </div>
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
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              {!isOnline ? 'Sin datos offline' : 'No hay proyectos'}
            </h3>
            <p className="text-slate-500 mb-4">
              {!isOnline 
                ? 'Conéctese a internet y visite esta sección para guardar proyectos localmente'
                : searchTerm || filtroEstado !== 'todos' 
                  ? 'No se encontraron proyectos con los filtros aplicados'
                  : 'Comienza creando tu primer proyecto de actualización'}
            </p>
            {canCreate && !searchTerm && filtroEstado === 'todos' && isOnline && (
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
                        proyecto.gdb_procesado ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
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
                      
                      {(canCreate || canDelete) && isOnline && (
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
                                <DropdownMenuItem onClick={() => handleExportarExcel(proyecto.id, false)}>
                                  <Download className="w-4 h-4 mr-2" />
                                  Exportar Excel R1/R2
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExportarExcel(proyecto.id, true)}>
                                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                                  Exportar Solo Actualizados
                                </DropdownMenuItem>
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
        <DialogContent className="sm:max-w-lg overflow-visible">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-600" />
              Nuevo Proyecto de Actualización
            </DialogTitle>
            <DialogDescription>
              Crea un nuevo proyecto para gestionar la actualización catastral de un municipio.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4 overflow-visible">
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
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar municipio" />
                </SelectTrigger>
                <SelectContent className="z-[9999]" position="popper" sideOffset={5}>
                  {municipiosDisponibles.map((mun) => (
                    <SelectItem key={mun} value={mun}>{mun}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {municipiosDisponibles.length === 0 && (
                <p className="text-xs text-slate-500">No hay municipios disponibles</p>
              )}
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
              
              <Tabs value={detalleTab} onValueChange={(tab) => {
                setDetalleTab(tab);
              }} className="w-full">
                <TabsList className={`grid w-full ${canCreate ? 'grid-cols-4' : 'grid-cols-2'}`}>
                  <TabsTrigger value="acciones" className="flex items-center gap-1 text-xs">
                    <FolderOpen className="w-3 h-3" />
                    Proyecto
                  </TabsTrigger>
                  {canCreate && (
                    <TabsTrigger value="archivos" className="flex items-center gap-1 text-xs">
                      <Database className="w-3 h-3" />
                      Archivos
                    </TabsTrigger>
                  )}
                  {canCreate && (
                    <TabsTrigger value="cronograma" className="flex items-center gap-1 text-xs">
                      <CalendarDays className="w-3 h-3" />
                      Cronograma
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="info" className="flex items-center gap-1 text-xs">
                    <FileSpreadsheet className="w-3 h-3" />
                    Info
                  </TabsTrigger>
                </TabsList>
                
                {/* Tab Acciones Principal - Gestión y Visor */}
                <TabsContent value="acciones" className="space-y-4 mt-4">
                  {/* Estadísticas del Proyecto */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <div className="bg-slate-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-slate-700">
                        {proyectoSeleccionado?.base_grafica_total_predios?.toLocaleString() || 0}
                      </p>
                      <p className="text-xs text-slate-500">Predios GDB</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-blue-700">
                        {proyectoSeleccionado?.info_alfanumerica_total_registros?.toLocaleString() || 0}
                      </p>
                      <p className="text-xs text-slate-500">Registros R1/R2</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-amber-700">
                        {proyectoSeleccionado?.predios_visitados || 0}
                      </p>
                      <p className="text-xs text-slate-500">Visitados</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-green-700">
                        {proyectoSeleccionado?.predios_actualizados || 0}
                      </p>
                      <p className="text-xs text-slate-500">Actualizados</p>
                    </div>
                  </div>

                  {/* Botones de Acceso Principal */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Botón Gestión de Predios */}
                    <Card 
                      className="cursor-pointer hover:border-amber-400 hover:shadow-md transition-all group"
                      onClick={() => {
                        setShowDetalleModal(false);
                        navigate(`/dashboard/visor-actualizacion/${proyectoSeleccionado.id}?modo=gestion`);
                      }}
                    >
                      <CardContent className="p-6 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                          <Building2 className="w-8 h-8 text-amber-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800 mb-2">Gestión de Predios</h3>
                        <p className="text-sm text-slate-500">
                          Crear, editar y gestionar los predios del proyecto
                        </p>
                        <Badge variant="outline" className="mt-3">
                          {proyectoSeleccionado?.info_alfanumerica_total_registros?.toLocaleString() || 0} predios cargados
                        </Badge>
                      </CardContent>
                    </Card>

                    {/* Botón Visor de Predios */}
                    <Card 
                      className={`cursor-pointer transition-all group ${
                        proyectoSeleccionado?.gdb_procesado 
                          ? 'hover:border-emerald-400 hover:shadow-md' 
                          : 'opacity-60 cursor-not-allowed'
                      }`}
                      onClick={() => {
                        if (proyectoSeleccionado?.gdb_procesado) {
                          setShowDetalleModal(false);
                          navigate(`/dashboard/visor-actualizacion/${proyectoSeleccionado.id}`);
                        } else {
                          toast.warning('Debe cargar la Base Gráfica (GDB) primero');
                        }
                      }}
                    >
                      <CardContent className="p-6 text-center">
                        <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center transition-colors ${
                          proyectoSeleccionado?.gdb_procesado 
                            ? 'bg-emerald-100 group-hover:bg-emerald-200' 
                            : 'bg-slate-100'
                        }`}>
                          <Map className={`w-8 h-8 ${proyectoSeleccionado?.gdb_procesado ? 'text-emerald-600' : 'text-slate-400'}`} />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800 mb-2">Visor de Predios</h3>
                        <p className="text-sm text-slate-500">
                          {proyectoSeleccionado?.gdb_procesado 
                            ? 'Ver predios en el mapa y realizar visitas de campo'
                            : 'Cargue la Base Gráfica (GDB) para habilitar'}
                        </p>
                        <Badge variant="outline" className="mt-3">
                          {proyectoSeleccionado?.gdb_procesado 
                            ? `${proyectoSeleccionado?.base_grafica_total_predios?.toLocaleString() || 0} geometrías`
                            : 'GDB no cargada'}
                        </Badge>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Mensaje si no hay datos cargados */}
                  {!proyectoSeleccionado?.gdb_procesado && !proyectoSeleccionado?.info_alfanumerica_total_registros && (
                    <Card className="bg-amber-50 border-amber-200">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-amber-800">Proyecto sin datos</p>
                            <p className="text-sm text-amber-600">
                              {canCreate 
                                ? 'Vaya a la pestaña "Archivos" para cargar la Base Gráfica (GDB) y la información R1/R2.'
                                : 'El coordinador debe cargar los archivos del proyecto.'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Acciones rápidas para coordinadores */}
                  {canCreate && (
                    <div className="flex flex-wrap gap-2 pt-4 border-t">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setDetalleTab('archivos')}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Cargar Archivos
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setDetalleTab('cronograma')}
                      >
                        <CalendarDays className="w-4 h-4 mr-2" />
                        Ver Cronograma
                      </Button>
                    </div>
                  )}
                </TabsContent>
                
                {/* Tab Archivos - Solo coordinadores */}
                {canCreate && (
                <TabsContent value="archivos" className="space-y-4 mt-4">
                  <h4 className="font-semibold text-slate-900">Archivos del Proyecto</h4>
                  <p className="text-sm text-slate-500 mb-4">
                    Cargue la Base Gráfica (GDB) y la información R1/R2 específica para este proyecto de actualización.
                  </p>
                  
                  <div className="grid gap-4">
                    {/* Base Gráfica del Proyecto */}
                    <Card className={`${proyectoSeleccionado.base_grafica_archivo ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Database className={`w-5 h-5 ${proyectoSeleccionado.gdb_procesado || proyectoSeleccionado.base_grafica_archivo ? 'text-emerald-600' : 'text-slate-400'}`} />
                            <div>
                              <p className="font-medium">Base Gráfica (GDB)</p>
                              {proyectoSeleccionado.gdb_procesado || proyectoSeleccionado.base_grafica_archivo ? (
                                <>
                                  <p className="text-xs text-emerald-600 flex items-center gap-1">
                                    <FileCheck className="w-3 h-3" />
                                    Archivo cargado y procesado
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    {proyectoSeleccionado.base_grafica_total_predios > 0 && 
                                      `${proyectoSeleccionado.base_grafica_total_predios.toLocaleString()} predios procesados`
                                    }
                                  </p>
                                </>
                              ) : (
                                <p className="text-xs text-slate-400">Archivo ZIP con geodatabase (.gdb) - Requerido para el visor</p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {(proyectoSeleccionado.gdb_procesado || proyectoSeleccionado.base_grafica_archivo) && (
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
                                  variant={(proyectoSeleccionado.gdb_procesado || proyectoSeleccionado.base_grafica_archivo) ? "outline" : "default"}
                                  size="sm"
                                  className={!(proyectoSeleccionado.gdb_procesado || proyectoSeleccionado.base_grafica_archivo) ? "bg-amber-600 hover:bg-amber-700" : ""}
                                  onClick={() => baseGraficaRef.current?.click()}
                                  disabled={uploading.base_grafica}
                                >
                                  {uploading.base_grafica ? (
                                    <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                                  ) : (
                                    <Upload className="w-4 h-4 mr-1" />
                                  )}
                                  {(proyectoSeleccionado.gdb_procesado || proyectoSeleccionado.base_grafica_archivo) ? 'Reemplazar' : 'Cargar GDB'}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Información Alfanumérica R1/R2 */}
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
                                  <p className="text-xs text-slate-400">
                                    {proyectoSeleccionado.info_alfanumerica_total_registros > 0 && 
                                      `${proyectoSeleccionado.info_alfanumerica_total_registros.toLocaleString()} registros importados`
                                    }
                                  </p>
                                </>
                              ) : (
                                <p className="text-xs text-slate-400">Archivo Excel (.xlsx) con datos R1 y R2 - Requerido para consulta</p>
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
                                  variant={proyectoSeleccionado.info_alfanumerica_archivo ? "outline" : "default"}
                                  size="sm"
                                  className={!proyectoSeleccionado.info_alfanumerica_archivo ? "bg-amber-600 hover:bg-amber-700" : ""}
                                  onClick={() => infoAlfanumericaRef.current?.click()}
                                  disabled={uploading.info_alfanumerica}
                                >
                                  {uploading.info_alfanumerica ? (
                                    <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                                  ) : (
                                    <Upload className="w-4 h-4 mr-1" />
                                  )}
                                  {proyectoSeleccionado.info_alfanumerica_archivo ? 'Reemplazar' : 'Cargar R1/R2'}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Mensaje si GDB está procesado - Botón para abrir visor */}
                    {proyectoSeleccionado.gdb_procesado && (
                      <Card className="bg-blue-50 border-blue-200">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <CheckCircle className="w-5 h-5 text-blue-600" />
                              <div>
                                <p className="font-medium text-blue-800">Visor de campo disponible</p>
                                <p className="text-xs text-blue-600">
                                  {proyectoSeleccionado.base_grafica_total_predios?.toLocaleString() || 0} predios en Base Gráfica
                                  {proyectoSeleccionado.info_alfanumerica_total_registros > 0 && 
                                    ` • ${proyectoSeleccionado.info_alfanumerica_total_registros.toLocaleString()} registros R1/R2`
                                  }
                                </p>
                              </div>
                            </div>
                            <Button 
                              onClick={() => navigate(`/dashboard/visor-actualizacion/${proyectoSeleccionado.id}`)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <MapPin className="w-4 h-4 mr-2" />
                              Abrir Visor de Campo
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    
                    {/* Mensaje si no hay archivos cargados */}
                    {!proyectoSeleccionado.gdb_procesado && !proyectoSeleccionado.base_grafica_archivo && (
                      <Card className="bg-amber-50 border-amber-200">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-500" />
                            <div>
                              <p className="font-medium text-amber-800">Archivos requeridos</p>
                              <p className="text-xs text-amber-600">
                                Cargue la Base Gráfica (GDB) para habilitar el visor de campo.
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </TabsContent>
                )}
                
                {/* Tab Cronograma - Solo para admin/coordinador */}
                {canCreate && (
                <TabsContent value="cronograma" className="space-y-4 mt-4">
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
                    <>
                      {/* Botón para agregar actividad */}
                      <div className="flex justify-end">
                        <Button 
                          size="sm" 
                          className="bg-amber-600 hover:bg-amber-700"
                          onClick={() => setShowActividadModal(true)}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Agregar Actividad
                        </Button>
                      </div>
                      
                      <CronogramaGantt 
                        etapas={etapas} 
                        onUpdate={() => fetchEtapas(proyectoSeleccionado?.id)}
                        gestoresDisponibles={[]}
                      />
                    </>
                  )}
                </TabsContent>
                )}
                
                {/* Tab Información - Última pestaña */}
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
              Agregar actividad al cronograma
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Selector de Etapa */}
            <div className="space-y-2">
              <Label>Etapa *</Label>
              <select
                value={etapaSeleccionada?.id || ''}
                onChange={(e) => {
                  const etapa = etapas.find(et => et.id === e.target.value);
                  setEtapaSeleccionada(etapa);
                }}
                className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {etapas.map((etapa) => (
                  <option key={etapa.id} value={etapa.id}>{etapa.nombre}</option>
                ))}
              </select>
            </div>

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
              <select
                value={nuevaActividad.actividad_padre_id || ''}
                onChange={(e) => setNuevaActividad(prev => ({ ...prev, actividad_padre_id: e.target.value }))}
                className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Ninguna - Es actividad principal</option>
                {etapaSeleccionada && getActividadesPrincipales(etapaSeleccionada.id).map((act) => (
                  <option key={act.id} value={act.id}>↳ {act.nombre}</option>
                ))}
              </select>
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
                <Label>Fecha Fin (opcional)</Label>
                <Input
                  type="date"
                  value={nuevaActividad.fecha_fin}
                  onChange={(e) => setNuevaActividad(prev => ({ ...prev, fecha_fin: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActividadModal(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAgregarActividad}
              disabled={!nuevaActividad.nombre || !etapaSeleccionada}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Agregar Actividad
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Eliminar Proyecto */}
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
                      <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                        {prediosPaginados.map((predio, idx) => {
                          const codigo = predio.codigo_predial || predio.numero_predial || 'Sin código';
                          return (
                            <Card key={predio._id || idx} className="hover:border-amber-300 transition-colors">
                              <CardContent className="p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="font-mono text-xs font-medium truncate">{codigo}</p>
                                      {renderEstadoVisitaBadge(predio.estado_visita)}
                                      <Badge variant="outline" className="text-xs">{getZonaFromCodigo(codigo)}</Badge>
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500 space-y-0.5">
                                      {predio.direccion && (
                                        <p className="flex items-center gap-1 truncate">
                                          <MapPin className="w-3 h-3 flex-shrink-0" />{predio.direccion}
                                        </p>
                                      )}
                                      {predio.propietarios?.[0]?.nombre_propietario && (
                                        <p className="flex items-center gap-1 truncate">
                                          <User className="w-3 h-3 flex-shrink-0" />{predio.propietarios[0].nombre_propietario}
                                        </p>
                                      )}
                                      <div className="flex gap-3">
                                        {predio.matricula_inmobiliaria && (
                                          <span className="flex items-center gap-1">
                                            <FileSpreadsheet className="w-3 h-3" />Mat: {predio.matricula_inmobiliaria}
                                          </span>
                                        )}
                                        {predio.area_terreno && (
                                          <span>{formatArea(predio.area_terreno)}</span>
                                        )}
                                        {(predio.avaluo_catastral || predio.avaluo) && (
                                          <span className="text-emerald-600 font-medium">
                                            {formatCurrency(predio.avaluo_catastral || predio.avaluo)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                          <MoreVertical className="w-4 h-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => {
                                          setPredioSeleccionadoEditar(predio);
                                          setShowEditarPredioModal(true);
                                        }}>
                                          <Pencil className="w-4 h-4 mr-2" />
                                          Editar Predio
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => {
                                          setShowDetalleModal(false);
                                          navigate(`/dashboard/visor-actualizacion/${proyectoSeleccionado.id}?codigo=${encodeURIComponent(codigo)}`);
                                        }}>
                                          <Map className="w-4 h-4 mr-2" />
                                          Ver en Mapa
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        {predio.estado_visita !== 'visitado' && (
                                          <DropdownMenuItem onClick={() => marcarEstadoPredio(predio, 'visitado')}>
                                            <ClipboardList className="w-4 h-4 mr-2 text-blue-600" />
                                            Marcar Visitado
                                          </DropdownMenuItem>
                                        )}
                                        {predio.estado_visita !== 'actualizado' && (
                                          <DropdownMenuItem onClick={() => marcarEstadoPredio(predio, 'actualizado')}>
                                            <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                                            Marcar Actualizado
                                          </DropdownMenuItem>
                                        )}
                                        {predio.estado_visita && predio.estado_visita !== 'pendiente' && (
                                          <DropdownMenuItem onClick={() => marcarEstadoPredio(predio, 'pendiente')}>
                                            <AlertCircle className="w-4 h-4 mr-2 text-yellow-600" />
                                            Marcar Pendiente
                                          </DropdownMenuItem>
                                        )}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                      
                      {/* Paginación */}
                      {totalPaginasPredios > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setPrediosPagina(1)}
                            disabled={prediosPagina === 1}
                          >
                            ««
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setPrediosPagina(p => Math.max(1, p - 1))}
                            disabled={prediosPagina === 1}
                          >
                            «
                          </Button>
                          <span className="text-sm text-slate-600 px-2">
                            {prediosPagina} / {totalPaginasPredios}
                          </span>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setPrediosPagina(p => Math.min(totalPaginasPredios, p + 1))}
                            disabled={prediosPagina === totalPaginasPredios}
                          >
                            »
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setPrediosPagina(totalPaginasPredios)}
                            disabled={prediosPagina === totalPaginasPredios}
                          >
                            »»
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>

                {/* Tab Visor de Predios */}
                <TabsContent value="visor" className="space-y-4 mt-4">
                  {proyectoSeleccionado?.gdb_procesado ? (
                    <div className="text-center py-6">
                      <Map className="w-16 h-16 mx-auto text-amber-500 mb-4" />
                      <h3 className="text-lg font-medium text-slate-700 mb-2">Visor de Campo</h3>
                      <p className="text-sm text-slate-500 mb-4">
                        {proyectoSeleccionado.base_grafica_total_predios?.toLocaleString() || 0} predios en Base Gráfica
                        {proyectoSeleccionado.info_alfanumerica_total_registros > 0 && 
                          ` • ${proyectoSeleccionado.info_alfanumerica_total_registros.toLocaleString()} registros R1/R2`
                        }
                      </p>
                      <Button 
                        size="lg"
                        className="bg-amber-600 hover:bg-amber-700"
                        onClick={() => {
                          setShowDetalleModal(false);
                          navigate(`/dashboard/visor-actualizacion/${proyectoSeleccionado.id}`);
                        }}
                      >
                        <MapPin className="w-5 h-5 mr-2" />
                        Abrir Visor de Campo
                      </Button>
                    </div>
                  ) : (
                    <Card className="bg-amber-50 border-amber-200">
                      <CardContent className="p-6 text-center">
                        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
                        <p className="text-slate-700 font-medium">Visor no disponible</p>
                        <p className="text-sm text-slate-500 mt-1">
                          Debe cargar la Base Gráfica (GDB) en la pestaña "Archivos" para habilitar el visor.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
                
                {/* Tab Cronograma - Solo para admin/coordinador */}
                {canCreate && (
                <TabsContent value="cronograma" className="space-y-4 mt-4">
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
                    <>
                      {/* Botón para agregar actividad */}
                      <div className="flex justify-end">
                        <Button 
                          size="sm" 
                          className="bg-amber-600 hover:bg-amber-700"
                          onClick={() => {
                            if (etapas.length === 0) {
                              toast.error('No hay etapas disponibles. Este proyecto no tiene etapas configuradas.');
                              return;
                            }
                            setEtapaSeleccionada(etapas[0]); // Seleccionar primera etapa por defecto
                            setShowActividadModal(true);
                          }}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Nueva Actividad
                        </Button>
                      </div>
                      
                      {/* Componente Gantt */}
                      <CronogramaGantt 
                        etapas={etapas} 
                        proyectoId={proyectoSeleccionado?.id}
                        onUpdate={() => fetchEtapas(proyectoSeleccionado?.id)}
                        gestoresDisponibles={[]}
                      />
                    </>
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
              Agregar actividad al cronograma
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Selector de Etapa */}
            <div className="space-y-2">
              <Label>Etapa *</Label>
              <select
                value={etapaSeleccionada?.id || ''}
                onChange={(e) => {
                  const etapa = etapas.find(et => et.id === e.target.value);
                  setEtapaSeleccionada(etapa);
                }}
                className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {etapas.map((etapa) => (
                  <option key={etapa.id} value={etapa.id}>{etapa.nombre}</option>
                ))}
              </select>
            </div>

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
              <select
                value={nuevaActividad.actividad_padre_id || ''}
                onChange={(e) => setNuevaActividad(prev => ({ ...prev, actividad_padre_id: e.target.value }))}
                className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Ninguna - Es actividad principal</option>
                {etapaSeleccionada && getActividadesPrincipales(etapaSeleccionada.id).map((act) => (
                  <option key={act.id} value={act.id}>↳ {act.nombre}</option>
                ))}
              </select>
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
              <select
                value={nuevaActividad.prioridad}
                onChange={(e) => setNuevaActividad(prev => ({ ...prev, prioridad: e.target.value }))}
                className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
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
