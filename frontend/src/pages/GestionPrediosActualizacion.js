import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  Plus, Search, Edit, MapPin, Building, Building2, User, DollarSign, Eye, 
  Clock, CheckCircle, AlertCircle, Loader2, RefreshCw, ArrowLeft, Map, 
  FileText, MoreVertical, ClipboardList, Trash2, Download, ChevronLeft, ChevronRight
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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
  if (!codigo || codigo.length < 7) return { tipo: 'desconocido', texto: 'Desconocido' };
  const zonaCode = codigo.substring(5, 7);
  if (zonaCode === '00') return { tipo: 'rural', texto: 'Rural' };
  if (zonaCode === '01') return { tipo: 'urbano', texto: 'Urbano' };
  return { tipo: 'corregimiento', texto: `Corr. (${zonaCode})` };
};

export default function GestionPrediosActualizacion() {
  const { proyectoId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  // Estados
  const [proyecto, setProyecto] = useState(null);
  const [predios, setPredios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPredios, setLoadingPredios] = useState(false);
  const [catalogos, setCatalogos] = useState(null);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('todos');
  const [filterZona, setFilterZona] = useState('todos');
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;
  
  // Estadísticas
  const [stats, setStats] = useState({
    total: 0,
    pendientes: 0,
    visitados: 0,
    actualizados: 0
  });
  
  // Modales
  const [showCrearModal, setShowCrearModal] = useState(false);
  const [showEditarModal, setShowEditarModal] = useState(false);
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [predioSeleccionado, setPredioSeleccionado] = useState(null);
  
  // Estado para código manual (30 dígitos) - IGUAL A CONSERVACIÓN
  const [codigoManual, setCodigoManual] = useState({
    zona: '00',          // Posición 6-7 (2 dígitos)
    sector: '00',        // Posición 8-9 (2 dígitos)
    comuna: '00',        // Posición 10-11 (2 dígitos)
    barrio: '00',        // Posición 12-13 (2 dígitos)
    manzana_vereda: '0000', // Posición 14-17 (4 dígitos)
    terreno: '0001',     // Posición 18-21 (4 dígitos)
    condicion: '0',      // Posición 22 (1 dígito)
    edificio: '00',      // Posición 23-24 (2 dígitos)
    piso: '00',          // Posición 25-26 (2 dígitos)
    unidad: '0000'       // Posición 27-30 (4 dígitos)
  });
  
  // Verificación de código y código homologado
  const [verificacionCodigo, setVerificacionCodigo] = useState(null);
  const [verificandoCodigo, setVerificandoCodigo] = useState(false);
  const [siguienteCodigoHomologado, setSiguienteCodigoHomologado] = useState(null);
  const [estructuraCodigo, setEstructuraCodigo] = useState(null);
  
  // Permitir edición de CPN solo a coordinadores
  const canEditCodigoPredial = ['administrador', 'coordinador'].includes(user?.role);
  
  // Formulario de nuevo/editar predio - Campos completos para R1/R2
  const [formData, setFormData] = useState({
    codigo_predial: '',
    codigo_homologado: '',
    direccion: '',
    comuna: '',
    destino_economico: 'A',
    area_terreno: '',
    area_construida: '',
    avaluo_catastral: '',
    matricula_inmobiliaria: ''
  });
  
  // Estado para múltiples propietarios (igual que Conservación)
  const [propietarios, setPropietarios] = useState([{
    nombre_propietario: '',
    tipo_documento: 'C',
    numero_documento: '',
    estado_civil: ''
  }]);
  
  // Estado para zonas físicas R2 (igual que Conservación)
  const [zonasFisicas, setZonasFisicas] = useState([{
    zona_fisica: '0',
    zona_economica: '0',
    area_terreno: '0',
    habitaciones: '0',
    banos: '0',
    locales: '0',
    pisos: '1',
    puntaje: '0',
    area_construida: '0'
  }]);
  
  // Funciones para manejar propietarios
  const agregarPropietario = () => {
    setPropietarios([...propietarios, {
      nombre_propietario: '',
      tipo_documento: 'C',
      numero_documento: '',
      estado_civil: ''
    }]);
  };
  
  const eliminarPropietario = (index) => {
    if (propietarios.length > 1) {
      setPropietarios(propietarios.filter((_, i) => i !== index));
    }
  };
  
  const actualizarPropietario = (index, campo, valor) => {
    setPropietarios(prev => {
      const nuevos = [...prev];
      nuevos[index] = { ...nuevos[index], [campo]: valor };
      return nuevos;
    });
  };
  
  // Funciones para zonas físicas
  const agregarZonaFisica = () => {
    setZonasFisicas([...zonasFisicas, {
      zona_fisica: '0',
      zona_economica: '0',
      area_terreno: '0',
      habitaciones: '0',
      banos: '0',
      locales: '0',
      pisos: '1',
      puntaje: '0',
      area_construida: '0'
    }]);
  };
  
  const eliminarZonaFisica = (index) => {
    if (zonasFisicas.length > 1) {
      setZonasFisicas(zonasFisicas.filter((_, i) => i !== index));
    }
  };
  
  const actualizarZonaFisica = (index, campo, valor) => {
    setZonasFisicas(prev => {
      const nuevas = [...prev];
      nuevas[index] = { ...nuevas[index], [campo]: valor };
      return nuevas;
    });
  };
  
  // Permisos
  const canModify = ['administrador', 'coordinador', 'gestor', 'gestor_auxiliar'].includes(user?.role);
  const esCoordinador = ['administrador', 'coordinador'].includes(user?.role);
  
  // Cargar catálogos
  const fetchCatalogos = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios/catalogos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCatalogos(res.data);
    } catch (error) {
      console.log('Catálogos no disponibles');
    }
  };
  
  // Obtener estructura de código para el municipio
  const fetchEstructuraCodigo = async (municipio) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios/estructura-codigo/${encodeURIComponent(municipio)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEstructuraCodigo(res.data);
    } catch (error) {
      console.log('Estructura de código no disponible');
    }
  };
  
  // Obtener siguiente código homologado
  const fetchSiguienteCodigoHomologado = async (municipio) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/codigos-homologados/siguiente/${encodeURIComponent(municipio)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSiguienteCodigoHomologado(res.data);
    } catch (error) {
      console.log('Código homologado no disponible');
      setSiguienteCodigoHomologado(null);
    }
  };
  
  // Construir código completo de 30 dígitos
  const construirCodigoCompleto = () => {
    if (!estructuraCodigo?.prefijo_fijo) return '';
    return estructuraCodigo.prefijo_fijo + 
           codigoManual.zona + 
           codigoManual.sector + 
           codigoManual.comuna + 
           codigoManual.barrio + 
           codigoManual.manzana_vereda + 
           codigoManual.terreno + 
           codigoManual.condicion + 
           codigoManual.edificio + 
           codigoManual.piso + 
           codigoManual.unidad;
  };
  
  // Manejar cambios en código manual
  const handleCodigoChange = (campo, valor, maxLen) => {
    const valorLimpio = valor.replace(/[^0-9]/g, '').slice(0, maxLen).padStart(maxLen, '0');
    setCodigoManual(prev => ({ ...prev, [campo]: valorLimpio }));
    setVerificacionCodigo(null); // Resetear verificación al cambiar
  };
  
  // Verificar código completo
  const verificarCodigoCompleto = async () => {
    const codigo = construirCodigoCompleto();
    if (codigo.length !== 30) {
      toast.error('El código debe tener 30 dígitos');
      return;
    }
    
    setVerificandoCodigo(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios/verificar-codigo-completo/${codigo}?municipio=${encodeURIComponent(proyecto?.municipio)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVerificacionCodigo(res.data);
    } catch (error) {
      toast.error('Error al verificar código');
    } finally {
      setVerificandoCodigo(false);
    }
  };
  
  // Cargar proyecto
  const fetchProyecto = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/actualizacion/proyectos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const proyectosData = response.data.proyectos || response.data || [];
      const proyectoEncontrado = proyectosData.find(p => p.id === proyectoId || p._id === proyectoId);
      setProyecto(proyectoEncontrado);
    } catch (error) {
      console.error('Error cargando proyecto:', error);
    }
  }, [proyectoId]);
  
  // Cargar predios
  const fetchPredios = useCallback(async () => {
    if (!proyectoId) return;
    setLoadingPredios(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/actualizacion/proyectos/${proyectoId}/predios`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const prediosData = response.data.predios || response.data || [];
      setPredios(prediosData);
      
      // Calcular estadísticas
      const newStats = {
        total: prediosData.length,
        pendientes: prediosData.filter(p => !p.estado_visita || p.estado_visita === 'pendiente').length,
        visitados: prediosData.filter(p => p.estado_visita === 'visitado').length,
        actualizados: prediosData.filter(p => p.estado_visita === 'actualizado').length
      };
      setStats(newStats);
      setCurrentPage(1);
    } catch (error) {
      console.error('Error cargando predios:', error);
      toast.error('Error al cargar predios');
    } finally {
      setLoadingPredios(false);
      setLoading(false);
    }
  }, [proyectoId]);
  
  useEffect(() => {
    fetchProyecto();
    fetchPredios();
    fetchCatalogos();
  }, [fetchProyecto, fetchPredios]);
  
  // Filtrar predios
  const prediosFiltrados = predios.filter(predio => {
    // Filtro de búsqueda
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const codigo = (predio.codigo_predial || predio.numero_predial || '').toLowerCase();
      const direccion = (predio.direccion || '').toLowerCase();
      const propietario = predio.propietarios?.[0]?.nombre_propietario?.toLowerCase() || '';
      if (!codigo.includes(search) && !direccion.includes(search) && !propietario.includes(search)) {
        return false;
      }
    }
    
    // Filtro de estado
    if (filterEstado !== 'todos') {
      const estadoPredio = predio.estado_visita || 'pendiente';
      if (estadoPredio !== filterEstado) return false;
    }
    
    // Filtro de zona
    if (filterZona !== 'todos') {
      const zona = getZonaFromCodigo(predio.codigo_predial || predio.numero_predial);
      if (filterZona === 'rural' && zona.tipo !== 'rural') return false;
      if (filterZona === 'urbano' && zona.tipo !== 'urbano') return false;
    }
    
    return true;
  });
  
  // Paginación
  const totalPages = Math.ceil(prediosFiltrados.length / pageSize);
  const prediosPaginados = prediosFiltrados.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  
  // Marcar estado de predio
  const marcarEstadoPredio = async (predio, nuevoEstado) => {
    try {
      const token = localStorage.getItem('token');
      const codigo = predio.codigo_predial || predio.numero_predial;
      await axios.patch(
        `${API}/actualizacion/proyectos/${proyectoId}/predios/${encodeURIComponent(codigo)}/estado`,
        { estado_visita: nuevoEstado },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Predio marcado como ${nuevoEstado}`);
      fetchPredios();
    } catch (error) {
      console.error('Error actualizando estado:', error);
      toast.error('Error al actualizar estado');
    }
  };
  
  // Abrir modal de editar - Cargar todos los campos para R1/R2
  const abrirEditar = (predio) => {
    setPredioSeleccionado(predio);
    setFormData({
      codigo_predial: predio.codigo_predial || predio.numero_predial || '',
      codigo_homologado: predio.codigo_homologado || '',
      direccion: predio.direccion || '',
      comuna: predio.comuna || '',
      destino_economico: predio.destino_economico || 'A',
      area_terreno: predio.area_terreno || '',
      area_construida: predio.area_construida || '',
      avaluo_catastral: predio.avaluo_catastral || predio.avaluo || '',
      matricula_inmobiliaria: predio.matricula_inmobiliaria || ''
    });
    
    // Cargar propietarios
    if (predio.propietarios?.length > 0) {
      setPropietarios(predio.propietarios.map(p => ({
        nombre_propietario: p.nombre_propietario || p.nombre || '',
        tipo_documento: p.tipo_documento || p.tipo_doc || 'C',
        numero_documento: p.numero_documento || p.documento || '',
        estado_civil: p.estado_civil || ''
      })));
    } else {
      setPropietarios([{ nombre_propietario: '', tipo_documento: 'C', numero_documento: '', estado_civil: '' }]);
    }
    
    // Cargar zonas físicas
    if (predio.zonas_fisicas?.length > 0) {
      setZonasFisicas(predio.zonas_fisicas);
    } else if (predio.r2_registros?.length > 0) {
      setZonasFisicas(predio.r2_registros);
    } else {
      setZonasFisicas([{
        zona_fisica: '0',
        zona_economica: '0',
        area_terreno: predio.area_terreno || '0',
        habitaciones: predio.habitaciones || '0',
        banos: predio.banos || '0',
        locales: predio.locales || '0',
        pisos: predio.pisos || '1',
        puntaje: '0',
        area_construida: predio.area_construida || '0'
      }]);
    }
    
    setShowEditarModal(true);
  };
  
  // Abrir modal de crear - Inicializar todos los campos
  const abrirCrear = async () => {
    // Resetear formulario
    setFormData({
      codigo_predial: '',
      codigo_homologado: '',
      direccion: '',
      comuna: '',
      destino_economico: 'A',
      area_terreno: '',
      area_construida: '',
      avaluo_catastral: '',
      matricula_inmobiliaria: ''
    });
    setPropietarios([{ nombre_propietario: '', tipo_documento: 'C', numero_documento: '', estado_civil: '' }]);
    setZonasFisicas([{
      zona_fisica: '0',
      zona_economica: '0',
      area_terreno: '0',
      habitaciones: '0',
      banos: '0',
      locales: '0',
      pisos: '1',
      puntaje: '0',
      area_construida: '0'
    }]);
    
    // Resetear código manual
    setCodigoManual({
      zona: '00',
      sector: '00',
      comuna: '00',
      barrio: '00',
      manzana_vereda: '0000',
      terreno: '0001',
      condicion: '0',
      edificio: '00',
      piso: '00',
      unidad: '0000'
    });
    setVerificacionCodigo(null);
    
    // Cargar estructura de código y código homologado
    if (proyecto?.municipio) {
      await fetchEstructuraCodigo(proyecto.municipio);
      await fetchSiguienteCodigoHomologado(proyecto.municipio);
    }
    
    setShowCrearModal(true);
  };
  
  // Guardar predio (crear o editar) - Enviar todos los campos para R1/R2
  const guardarPredio = async (esNuevo = false) => {
    try {
      const token = localStorage.getItem('token');
      
      // Para nuevo predio, construir el código desde los campos manuales
      let codigoFinal = formData.codigo_predial;
      let codigoHomologadoFinal = formData.codigo_homologado;
      
      if (esNuevo) {
        codigoFinal = construirCodigoCompleto();
        
        // Validar código de 30 dígitos
        if (codigoFinal.length !== 30) {
          toast.error('El código predial debe tener 30 dígitos');
          return;
        }
        
        // Verificar que el código esté disponible
        if (!verificacionCodigo || verificacionCodigo.estado === 'existente') {
          toast.error('Por favor verifique que el código predial esté disponible');
          return;
        }
        
        // Asignar código homologado
        codigoHomologadoFinal = siguienteCodigoHomologado?.codigo || '';
      }
      
      // Preparar datos completos para R1/R2
      const datosCompletos = {
        ...formData,
        codigo_predial: codigoFinal,
        codigo_homologado: codigoHomologadoFinal,
        propietarios: propietarios,
        zonas_fisicas: zonasFisicas,
        avaluo: formData.avaluo_catastral,
        avaluo_catastral: formData.avaluo_catastral
      };
      
      if (esNuevo) {
        await axios.post(
          `${API}/actualizacion/proyectos/${proyectoId}/predios`,
          datosCompletos,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Predio creado correctamente');
        setShowCrearModal(false);
      } else {
        const codigo = predioSeleccionado.codigo_predial || predioSeleccionado.numero_predial;
        await axios.patch(
          `${API}/actualizacion/proyectos/${proyectoId}/predios/${encodeURIComponent(codigo)}`,
          datosCompletos,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Predio actualizado correctamente');
        setShowEditarModal(false);
      }
      
      fetchPredios();
    } catch (error) {
      console.error('Error guardando predio:', error);
      toast.error(error.response?.data?.detail || 'Error al guardar predio');
    }
  };
  
  // Abrir detalle
  const abrirDetalle = (predio) => {
    setPredioSeleccionado(predio);
    setShowDetalleModal(true);
  };
  
  // Renderizar badge de estado
  const renderEstadoBadge = (estado) => {
    switch (estado) {
      case 'actualizado':
        return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle className="w-3 h-3 mr-1" />Actualizado</Badge>;
      case 'visitado':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300"><Clock className="w-3 h-3 mr-1" />Visitado</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300"><AlertCircle className="w-3 h-3 mr-1" />Pendiente</Badge>;
    }
  };
  
  // Ir al visor con el predio
  const irAlVisor = (predio) => {
    const codigo = predio.codigo_predial || predio.numero_predial;
    navigate(`/dashboard/visor-actualizacion/${proyectoId}?codigo=${encodeURIComponent(codigo)}`);
  };
  
  // Exportar Excel
  const exportarExcel = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/actualizacion/proyectos/${proyectoId}/exportar-excel`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `predios_${proyecto?.nombre || proyectoId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Excel exportado correctamente');
    } catch (error) {
      console.error('Error exportando:', error);
      toast.error('Error al exportar Excel');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" data-testid="gestion-predios-actualizacion">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/dashboard/proyectos-actualizacion')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="w-6 h-6 text-amber-600" />
              Gestión de Predios
            </h1>
            <p className="text-slate-500 mt-1">
              {proyecto?.nombre || 'Proyecto'} - {proyecto?.municipio || ''}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          {esCoordinador && (
            <Button 
              variant="outline"
              onClick={exportarExcel}
              className="border-amber-500 text-amber-700 hover:bg-amber-50"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar Excel
            </Button>
          )}
          <Button 
            variant="outline"
            onClick={() => navigate(`/dashboard/visor-actualizacion/${proyectoId}`)}
          >
            <Map className="w-4 h-4 mr-2" />
            Ir al Visor
          </Button>
          {canModify && (
            <Button 
              className="bg-amber-600 hover:bg-amber-700"
              onClick={abrirCrear}
              data-testid="btn-nuevo-predio"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Predio
            </Button>
          )}
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card 
          className="cursor-pointer hover:border-slate-400 transition-colors"
          onClick={() => setFilterEstado('todos')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total.toLocaleString()}</p>
                <p className="text-sm text-slate-500">Total Predios</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card 
          className={`cursor-pointer hover:border-yellow-400 transition-colors ${filterEstado === 'pendiente' ? 'border-yellow-400 bg-yellow-50' : ''}`}
          onClick={() => setFilterEstado('pendiente')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100 text-yellow-600">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pendientes.toLocaleString()}</p>
                <p className="text-sm text-slate-500">Pendientes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card 
          className={`cursor-pointer hover:border-blue-400 transition-colors ${filterEstado === 'visitado' ? 'border-blue-400 bg-blue-50' : ''}`}
          onClick={() => setFilterEstado('visitado')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.visitados.toLocaleString()}</p>
                <p className="text-sm text-slate-500">Visitados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card 
          className={`cursor-pointer hover:border-green-400 transition-colors ${filterEstado === 'actualizado' ? 'border-green-400 bg-green-50' : ''}`}
          onClick={() => setFilterEstado('actualizado')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 text-green-600">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.actualizados.toLocaleString()}</p>
                <p className="text-sm text-slate-500">Actualizados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Buscar por código, dirección o propietario..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-buscar"
                />
              </div>
            </div>
            
            <Select value={filterZona} onValueChange={setFilterZona}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Zona" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas las zonas</SelectItem>
                <SelectItem value="rural">Rural</SelectItem>
                <SelectItem value="urbano">Urbano</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="outline" onClick={fetchPredios} disabled={loadingPredios}>
              {loadingPredios ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span className="ml-2">Actualizar</span>
            </Button>
          </div>
          
          <div className="mt-3 text-sm text-slate-500">
            Mostrando {prediosPaginados.length} de {prediosFiltrados.length} predios
            {searchTerm && ` (búsqueda: "${searchTerm}")`}
          </div>
        </CardContent>
      </Card>
      
      {/* Lista de Predios */}
      {loadingPredios ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-500" />
            <p className="mt-2 text-slate-500">Cargando predios...</p>
          </CardContent>
        </Card>
      ) : prediosFiltrados.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Building className="w-12 h-12 mx-auto text-slate-300" />
            <p className="mt-2 text-slate-500">
              {searchTerm ? 'No se encontraron predios con los filtros aplicados' : 'No hay predios en este proyecto'}
            </p>
            {canModify && !searchTerm && (
              <Button className="mt-4 bg-amber-600 hover:bg-amber-700" onClick={abrirCrear}>
                <Plus className="w-4 h-4 mr-2" />
                Crear Primer Predio
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3">
            {prediosPaginados.map((predio, index) => {
              const codigo = predio.codigo_predial || predio.numero_predial || 'Sin código';
              const zona = getZonaFromCodigo(codigo);
              
              return (
                <Card 
                  key={predio._id || predio.id || index}
                  className="hover:shadow-md transition-shadow"
                  data-testid={`predio-card-${index}`}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => abrirDetalle(predio)}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-mono text-sm font-medium text-slate-800 truncate">
                            {codigo}
                          </p>
                          {renderEstadoBadge(predio.estado_visita)}
                          <Badge variant="outline" className="text-xs">
                            {zona.texto}
                          </Badge>
                        </div>
                        
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                          {predio.direccion && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {predio.direccion}
                            </span>
                          )}
                          {predio.propietarios?.[0]?.nombre_propietario && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {predio.propietarios[0].nombre_propietario}
                            </span>
                          )}
                          {predio.area_terreno && (
                            <span className="flex items-center gap-1">
                              <Building className="w-3 h-3" />
                              {formatArea(predio.area_terreno)}
                            </span>
                          )}
                          {(predio.avaluo_catastral || predio.avaluo) && (
                            <span className="flex items-center gap-1 text-emerald-600 font-medium">
                              <DollarSign className="w-3 h-3" />
                              {formatCurrency(predio.avaluo_catastral || predio.avaluo)}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => irAlVisor(predio)}
                        >
                          <Map className="w-4 h-4 mr-1" />
                          Ver Mapa
                        </Button>
                        
                        {canModify && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => abrirEditar(predio)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Editar Predio
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
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          
          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                Primera
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="flex items-center px-4 text-sm text-slate-600">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                Última
              </Button>
            </div>
          )}
        </>
      )}
      
      {/* Modal Crear Predio - IDÉNTICO A CONSERVACIÓN */}
      <Dialog open={showCrearModal} onOpenChange={setShowCrearModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-visible">
          <div className="max-h-[80vh] overflow-y-auto pr-2">
          <DialogHeader>
            <DialogTitle className="text-xl font-outfit">Crear Nuevo Predio</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Código Predial */}
            <div className="bg-slate-50 p-4 rounded-lg">
              <Label>Código Predial Nacional *</Label>
              <Input 
                value={formData.codigo_predial}
                onChange={(e) => setFormData({...formData, codigo_predial: e.target.value})}
                placeholder="Código de 30 dígitos"
                className="font-mono mt-1"
              />
              <p className="text-xs text-slate-500 mt-1">Ingrese el código predial nacional de 30 dígitos</p>
            </div>
            
            {/* Sección de Propietarios - IGUAL QUE CONSERVACIÓN */}
            <div className="border border-slate-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-slate-800">Propietarios</h4>
                <Button type="button" variant="outline" size="sm" onClick={agregarPropietario} className="text-emerald-700">
                  <Plus className="w-4 h-4 mr-1" /> Agregar Propietario
                </Button>
              </div>
              
              {propietarios.map((prop, index) => (
                <div key={index} className="border border-slate-200 rounded-lg p-4 bg-slate-50 mb-3">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-medium text-slate-700">Propietario {index + 1}</span>
                    {propietarios.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => eliminarPropietario(index)} className="text-red-600 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label className="text-xs">Nombre Completo *</Label>
                      <Input 
                        value={prop.nombre_propietario} 
                        onChange={(e) => actualizarPropietario(index, 'nombre_propietario', e.target.value.toUpperCase())}
                        placeholder="NOMBRE COMPLETO DEL PROPIETARIO"
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-2 block">Tipo Documento *</Label>
                      <RadioGroup 
                        value={prop.tipo_documento} 
                        onValueChange={(v) => actualizarPropietario(index, 'tipo_documento', v)}
                        className="flex flex-wrap gap-3"
                      >
                        {catalogos?.tipo_documento && Object.entries(catalogos.tipo_documento).map(([k, v]) => (
                          <div key={k} className="flex items-center space-x-1">
                            <RadioGroupItem value={k} id={`tipo_doc_create_${index}_${k}`} />
                            <Label htmlFor={`tipo_doc_create_${index}_${k}`} className="text-xs cursor-pointer">{k}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                    <div>
                      <Label className="text-xs">Número Documento *</Label>
                      <Input 
                        value={prop.numero_documento} 
                        onChange={(e) => actualizarPropietario(index, 'numero_documento', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-2 block">Estado Civil</Label>
                      <RadioGroup 
                        value={prop.estado_civil || "none"} 
                        onValueChange={(v) => actualizarPropietario(index, 'estado_civil', v === 'none' ? '' : v)}
                        className="flex flex-wrap gap-3"
                      >
                        <div className="flex items-center space-x-1">
                          <RadioGroupItem value="none" id={`estado_civil_create_${index}_none`} />
                          <Label htmlFor={`estado_civil_create_${index}_none`} className="text-xs cursor-pointer text-slate-500">Sin especificar</Label>
                        </div>
                        {catalogos?.estado_civil && Object.entries(catalogos.estado_civil).map(([k, v]) => (
                          <div key={k} className="flex items-center space-x-1">
                            <RadioGroupItem value={k} id={`estado_civil_create_${index}_${k}`} />
                            <Label htmlFor={`estado_civil_create_${index}_${k}`} className="text-xs cursor-pointer">{v}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Información del Predio - IGUAL QUE CONSERVACIÓN */}
            <div className="border border-slate-200 rounded-lg p-4">
              <h4 className="font-semibold text-slate-800 mb-3">Información del Predio</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Dirección *</Label>
                  <Input value={formData.direccion} onChange={(e) => setFormData({...formData, direccion: e.target.value.toUpperCase()})} />
                </div>
                <div className="col-span-2">
                  <Label className="mb-2 block">Destino Económico *</Label>
                  <RadioGroup 
                    value={formData.destino_economico} 
                    onValueChange={(v) => setFormData({...formData, destino_economico: v})}
                    className="flex flex-wrap gap-3"
                  >
                    {catalogos?.destino_economico && Object.entries(catalogos.destino_economico).map(([k, v]) => (
                      <div key={k} className="flex items-center space-x-1">
                        <RadioGroupItem value={k} id={`destino_create_${k}`} />
                        <Label htmlFor={`destino_create_${k}`} className="text-xs cursor-pointer">{k} - {v}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
                <div>
                  <Label>Avalúo (COP) *</Label>
                  <Input type="number" value={formData.avaluo_catastral} onChange={(e) => setFormData({...formData, avaluo_catastral: e.target.value})} />
                </div>
                <div>
                  <Label>Área Terreno (m²)</Label>
                  <Input type="number" value={formData.area_terreno} onChange={(e) => setFormData({...formData, area_terreno: e.target.value})} />
                </div>
                <div>
                  <Label>Área Construida (m²)</Label>
                  <Input type="number" value={formData.area_construida} onChange={(e) => setFormData({...formData, area_construida: e.target.value})} />
                </div>
                <div>
                  <Label>Matrícula Inmobiliaria</Label>
                  <Input value={formData.matricula_inmobiliaria} onChange={(e) => setFormData({...formData, matricula_inmobiliaria: e.target.value})} />
                </div>
              </div>
            </div>
            
            {/* Zonas Físicas R2 - IGUAL QUE CONSERVACIÓN */}
            <div className="border border-slate-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-slate-800">Zonas Físicas (R2)</h4>
                <Button type="button" variant="outline" size="sm" onClick={agregarZonaFisica} className="text-emerald-700">
                  <Plus className="w-4 h-4 mr-1" /> Agregar Zona
                </Button>
              </div>
              
              {zonasFisicas.map((zona, index) => (
                <div key={index} className="border border-slate-200 rounded-lg p-3 bg-slate-50 mb-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-slate-700">Zona {index + 1}</span>
                    {zonasFisicas.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => eliminarZonaFisica(index)} className="text-red-600 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Zona Física</Label>
                      <Input type="text" className="h-8 text-xs" value={zona.zona_fisica} onChange={(e) => actualizarZonaFisica(index, 'zona_fisica', e.target.value)} placeholder="Ej: 01, 02..." />
                    </div>
                    <div>
                      <Label className="text-xs">Zona Económica</Label>
                      <Input type="text" className="h-8 text-xs" value={zona.zona_economica} onChange={(e) => actualizarZonaFisica(index, 'zona_economica', e.target.value)} placeholder="Ej: A, B, C..." />
                    </div>
                    <div>
                      <Label className="text-xs">Área Terreno</Label>
                      <Input type="number" className="h-8 text-xs" value={zona.area_terreno} onChange={(e) => actualizarZonaFisica(index, 'area_terreno', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Habitaciones</Label>
                      <Input type="number" className="h-8 text-xs" value={zona.habitaciones} onChange={(e) => actualizarZonaFisica(index, 'habitaciones', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Baños</Label>
                      <Input type="number" className="h-8 text-xs" value={zona.banos} onChange={(e) => actualizarZonaFisica(index, 'banos', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Pisos</Label>
                      <Input type="number" className="h-8 text-xs" value={zona.pisos} onChange={(e) => actualizarZonaFisica(index, 'pisos', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Área Construida</Label>
                      <Input type="number" className="h-8 text-xs" value={zona.area_construida} onChange={(e) => actualizarZonaFisica(index, 'area_construida', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Puntaje</Label>
                      <Input type="number" className="h-8 text-xs" value={zona.puntaje} onChange={(e) => actualizarZonaFisica(index, 'puntaje', e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setShowCrearModal(false)}>Cancelar</Button>
            <Button 
              onClick={() => guardarPredio(true)}
              disabled={!formData.codigo_predial}
              className="bg-emerald-700 hover:bg-emerald-800"
            >
              Crear Predio
            </Button>
          </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Modal Editar Predio - IDÉNTICO A CONSERVACIÓN */}
      <Dialog open={showEditarModal} onOpenChange={setShowEditarModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-visible">
          <div className="max-h-[80vh] overflow-y-auto pr-2">
          <DialogHeader>
            <DialogTitle className="text-xl font-outfit">Editar Predio - {predioSeleccionado?.codigo_predial || predioSeleccionado?.numero_predial}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-sm text-slate-600">
                <strong>Código Predial Nacional:</strong> {predioSeleccionado?.codigo_predial || predioSeleccionado?.numero_predial}
              </p>
              {formData.matricula_inmobiliaria && (
                <p className="text-sm text-slate-600 mt-1">
                  <strong>Matrícula Inmobiliaria:</strong> {formData.matricula_inmobiliaria}
                </p>
              )}
              {formData.codigo_homologado && (
                <p className="text-sm text-slate-600 mt-1">
                  <strong>Código Homologado:</strong> {formData.codigo_homologado}
                </p>
              )}
            </div>
            
            {/* Sección de Propietarios - IGUAL QUE CONSERVACIÓN */}
            <div className="border border-slate-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-slate-800">Propietarios</h4>
                <Button type="button" variant="outline" size="sm" onClick={agregarPropietario} className="text-emerald-700">
                  <Plus className="w-4 h-4 mr-1" /> Agregar Propietario
                </Button>
              </div>
              
              {propietarios.map((prop, index) => (
                <div key={index} className="border border-slate-200 rounded-lg p-4 bg-slate-50 mb-3">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-medium text-slate-700">Propietario {index + 1}</span>
                    {propietarios.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => eliminarPropietario(index)} className="text-red-600 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label className="text-xs">Nombre Completo *</Label>
                      <Input 
                        value={prop.nombre_propietario} 
                        onChange={(e) => actualizarPropietario(index, 'nombre_propietario', e.target.value.toUpperCase())}
                        placeholder="NOMBRE COMPLETO DEL PROPIETARIO"
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-2 block">Tipo Documento *</Label>
                      <RadioGroup 
                        value={prop.tipo_documento} 
                        onValueChange={(v) => actualizarPropietario(index, 'tipo_documento', v)}
                        className="flex flex-wrap gap-3"
                      >
                        {catalogos?.tipo_documento && Object.entries(catalogos.tipo_documento).map(([k, v]) => (
                          <div key={k} className="flex items-center space-x-1">
                            <RadioGroupItem value={k} id={`tipo_doc_edit_${index}_${k}`} />
                            <Label htmlFor={`tipo_doc_edit_${index}_${k}`} className="text-xs cursor-pointer">{k}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                    <div>
                      <Label className="text-xs">Número Documento *</Label>
                      <Input 
                        value={prop.numero_documento} 
                        onChange={(e) => actualizarPropietario(index, 'numero_documento', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-2 block">Estado Civil</Label>
                      <RadioGroup 
                        value={prop.estado_civil || "none"} 
                        onValueChange={(v) => actualizarPropietario(index, 'estado_civil', v === 'none' ? '' : v)}
                        className="flex flex-wrap gap-3"
                      >
                        <div className="flex items-center space-x-1">
                          <RadioGroupItem value="none" id={`estado_civil_edit_${index}_none`} />
                          <Label htmlFor={`estado_civil_edit_${index}_none`} className="text-xs cursor-pointer text-slate-500">Sin especificar</Label>
                        </div>
                        {catalogos?.estado_civil && Object.entries(catalogos.estado_civil).map(([k, v]) => (
                          <div key={k} className="flex items-center space-x-1">
                            <RadioGroupItem value={k} id={`estado_civil_edit_${index}_${k}`} />
                            <Label htmlFor={`estado_civil_edit_${index}_${k}`} className="text-xs cursor-pointer">{v}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Información del Predio - IGUAL QUE CONSERVACIÓN */}
            <div className="border border-slate-200 rounded-lg p-4">
              <h4 className="font-semibold text-slate-800 mb-3">Información del Predio</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Dirección *</Label>
                  <Input value={formData.direccion} onChange={(e) => setFormData({...formData, direccion: e.target.value.toUpperCase()})} />
                </div>
                <div className="col-span-2">
                  <Label className="mb-2 block">Destino Económico *</Label>
                  <RadioGroup 
                    value={formData.destino_economico} 
                    onValueChange={(v) => setFormData({...formData, destino_economico: v})}
                    className="flex flex-wrap gap-3"
                  >
                    {catalogos?.destino_economico && Object.entries(catalogos.destino_economico).map(([k, v]) => (
                      <div key={k} className="flex items-center space-x-1">
                        <RadioGroupItem value={k} id={`destino_edit_${k}`} />
                        <Label htmlFor={`destino_edit_${k}`} className="text-xs cursor-pointer">{k} - {v}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
                <div>
                  <Label>Avalúo (COP) *</Label>
                  <Input type="number" value={formData.avaluo_catastral} onChange={(e) => setFormData({...formData, avaluo_catastral: e.target.value})} />
                </div>
                <div>
                  <Label>Área Terreno (m²)</Label>
                  <Input type="number" value={formData.area_terreno} onChange={(e) => setFormData({...formData, area_terreno: e.target.value})} />
                </div>
                <div>
                  <Label>Área Construida (m²)</Label>
                  <Input type="number" value={formData.area_construida} onChange={(e) => setFormData({...formData, area_construida: e.target.value})} />
                </div>
                <div>
                  <Label>Matrícula Inmobiliaria</Label>
                  <Input value={formData.matricula_inmobiliaria} onChange={(e) => setFormData({...formData, matricula_inmobiliaria: e.target.value})} />
                </div>
              </div>
            </div>
            
            {/* Zonas Físicas R2 - IGUAL QUE CONSERVACIÓN */}
            <div className="border border-slate-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-slate-800">Zonas Físicas (R2)</h4>
                <Button type="button" variant="outline" size="sm" onClick={agregarZonaFisica} className="text-emerald-700">
                  <Plus className="w-4 h-4 mr-1" /> Agregar Zona
                </Button>
              </div>
              
              {zonasFisicas.map((zona, index) => (
                <div key={index} className="border border-slate-200 rounded-lg p-3 bg-slate-50 mb-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-slate-700">Zona {index + 1}</span>
                    {zonasFisicas.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => eliminarZonaFisica(index)} className="text-red-600 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Zona Física</Label>
                      <Input type="text" className="h-8 text-xs" value={zona.zona_fisica} onChange={(e) => actualizarZonaFisica(index, 'zona_fisica', e.target.value)} placeholder="Ej: 01, 02..." />
                    </div>
                    <div>
                      <Label className="text-xs">Zona Económica</Label>
                      <Input type="text" className="h-8 text-xs" value={zona.zona_economica} onChange={(e) => actualizarZonaFisica(index, 'zona_economica', e.target.value)} placeholder="Ej: A, B, C..." />
                    </div>
                    <div>
                      <Label className="text-xs">Área Terreno</Label>
                      <Input type="number" className="h-8 text-xs" value={zona.area_terreno} onChange={(e) => actualizarZonaFisica(index, 'area_terreno', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Habitaciones</Label>
                      <Input type="number" className="h-8 text-xs" value={zona.habitaciones} onChange={(e) => actualizarZonaFisica(index, 'habitaciones', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Baños</Label>
                      <Input type="number" className="h-8 text-xs" value={zona.banos} onChange={(e) => actualizarZonaFisica(index, 'banos', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Pisos</Label>
                      <Input type="number" className="h-8 text-xs" value={zona.pisos} onChange={(e) => actualizarZonaFisica(index, 'pisos', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Área Construida</Label>
                      <Input type="number" className="h-8 text-xs" value={zona.area_construida} onChange={(e) => actualizarZonaFisica(index, 'area_construida', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Puntaje</Label>
                      <Input type="number" className="h-8 text-xs" value={zona.puntaje} onChange={(e) => actualizarZonaFisica(index, 'puntaje', e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setShowEditarModal(false)}>Cancelar</Button>
            <Button 
              onClick={() => guardarPredio(false)} 
              className="bg-emerald-700 hover:bg-emerald-800"
            >
              Guardar Cambios
            </Button>
          </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Modal Detalle Predio */}
      <Dialog open={showDetalleModal} onOpenChange={setShowDetalleModal}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="w-5 h-5 text-amber-600" />
              Detalle del Predio
            </DialogTitle>
          </DialogHeader>
          
          {predioSeleccionado && (
            <div className="space-y-4">
              {/* Estado */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="font-medium">Estado de Visita</span>
                {renderEstadoBadge(predioSeleccionado.estado_visita)}
              </div>
              
              {/* Código */}
              <div className="bg-amber-50 p-3 rounded-lg">
                <p className="text-xs text-amber-600 uppercase font-medium">Código Predial Nacional</p>
                <p className="font-mono text-lg font-bold text-amber-800 break-all">
                  {predioSeleccionado.codigo_predial || predioSeleccionado.numero_predial || 'N/A'}
                </p>
              </div>
              
              {/* Info básica */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Zona</p>
                  <p className="font-medium">
                    {getZonaFromCodigo(predioSeleccionado.codigo_predial || predioSeleccionado.numero_predial).texto}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Destino Económico</p>
                  <p className="font-medium">{predioSeleccionado.destino_economico || 'N/A'}</p>
                </div>
              </div>
              
              {/* Dirección */}
              {predioSeleccionado.direccion && (
                <div>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Dirección
                  </p>
                  <p className="font-medium">{predioSeleccionado.direccion}</p>
                </div>
              )}
              
              {/* Propietarios */}
              <div>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <User className="w-3 h-3" /> Propietario(s)
                </p>
                {predioSeleccionado.propietarios?.length > 0 ? (
                  predioSeleccionado.propietarios.map((p, idx) => (
                    <p key={idx} className="font-medium">
                      {p.nombre_propietario || p.nombre || 'Sin nombre'}
                      {p.numero_documento && ` - ${p.numero_documento}`}
                    </p>
                  ))
                ) : (
                  <p className="text-slate-400">No registrado</p>
                )}
              </div>
              
              {/* Matrícula */}
              <div>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <FileText className="w-3 h-3" /> Matrícula Inmobiliaria
                </p>
                <p className="font-mono font-medium">
                  {predioSeleccionado.matricula_inmobiliaria || 'Sin información'}
                </p>
              </div>
              
              {/* Áreas */}
              <div className="grid grid-cols-2 gap-4 p-3 bg-blue-50 rounded-lg">
                <div>
                  <p className="text-xs text-blue-600">Área Terreno</p>
                  <p className="font-bold text-blue-800">{formatArea(predioSeleccionado.area_terreno)}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-600">Área Construida</p>
                  <p className="font-medium text-blue-700">{formatArea(predioSeleccionado.area_construida)}</p>
                </div>
              </div>
              
              {/* Avalúo */}
              <div>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <DollarSign className="w-3 h-3" /> Avalúo Catastral
                </p>
                <p className="text-lg font-bold text-emerald-700">
                  {formatCurrency(predioSeleccionado.avaluo_catastral || predioSeleccionado.avaluo)}
                </p>
              </div>
              
              {/* Botones de acción */}
              <div className="pt-4 border-t flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDetalleModal(false);
                    irAlVisor(predioSeleccionado);
                  }}
                >
                  <Map className="w-4 h-4 mr-2" />
                  Ver en Mapa
                </Button>
                {canModify && (
                  <Button
                    className="bg-amber-600 hover:bg-amber-700"
                    onClick={() => {
                      setShowDetalleModal(false);
                      abrirEditar(predioSeleccionado);
                    }}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
