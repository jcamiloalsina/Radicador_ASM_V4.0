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
  
  // Formulario de nuevo/editar predio - Campos completos para R1/R2
  const [formData, setFormData] = useState({
    codigo_predial: '',
    codigo_homologado: '',
    direccion: '',
    comuna: '',
    destino_economico: '',
    area_terreno: '',
    area_construida: '',
    avaluo_catastral: '',
    matricula_inmobiliaria: '',
    // Propietarios con estado civil para R1
    propietarios: [{ nombre_propietario: '', tipo_documento: 'CC', numero_documento: '', estado_civil: '' }],
    // Zonas físicas para R2
    zonas_fisicas: [{ zona_fisica: '', zona_economica: '', area_terreno: '' }],
    // Datos de construcción para R2
    habitaciones: '',
    banos: '',
    locales: '',
    pisos: '',
    uso: ''
  });
  
  // Permisos
  const canModify = ['administrador', 'coordinador', 'gestor', 'gestor_auxiliar'].includes(user?.role);
  const esCoordinador = ['administrador', 'coordinador'].includes(user?.role);
  
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
      destino_economico: predio.destino_economico || '',
      area_terreno: predio.area_terreno || '',
      area_construida: predio.area_construida || '',
      avaluo_catastral: predio.avaluo_catastral || predio.avaluo || '',
      matricula_inmobiliaria: predio.matricula_inmobiliaria || '',
      // Propietarios con estado civil
      propietarios: predio.propietarios?.length > 0 
        ? predio.propietarios.map(p => ({
            nombre_propietario: p.nombre_propietario || p.nombre || '',
            tipo_documento: p.tipo_documento || 'CC',
            numero_documento: p.numero_documento || '',
            estado_civil: p.estado_civil || ''
          }))
        : [{ nombre_propietario: '', tipo_documento: 'CC', numero_documento: '', estado_civil: '' }],
      // Zonas físicas para R2
      zonas_fisicas: predio.zonas_fisicas?.length > 0 
        ? predio.zonas_fisicas 
        : predio.r2_registros?.length > 0 
          ? predio.r2_registros 
          : [{ zona_fisica: '', zona_economica: '', area_terreno: '' }],
      // Datos de construcción
      habitaciones: predio.habitaciones || '',
      banos: predio.banos || '',
      locales: predio.locales || '',
      pisos: predio.pisos || '',
      uso: predio.uso || predio.destino_economico || ''
    });
    setShowEditarModal(true);
  };
  
  // Abrir modal de crear - Inicializar todos los campos
  const abrirCrear = () => {
    setFormData({
      codigo_predial: '',
      codigo_homologado: '',
      direccion: '',
      comuna: '',
      destino_economico: '',
      area_terreno: '',
      area_construida: '',
      avaluo_catastral: '',
      matricula_inmobiliaria: '',
      propietarios: [{ nombre_propietario: '', tipo_documento: 'CC', numero_documento: '', estado_civil: '' }],
      zonas_fisicas: [{ zona_fisica: '', zona_economica: '', area_terreno: '' }],
      habitaciones: '',
      banos: '',
      locales: '',
      pisos: '',
      uso: ''
    });
    setShowCrearModal(true);
  };
  
  // Guardar predio (crear o editar) - Enviar todos los campos para R1/R2
  const guardarPredio = async (esNuevo = false) => {
    try {
      const token = localStorage.getItem('token');
      
      // Preparar datos completos para R1/R2
      const datosCompletos = {
        ...formData,
        // Asegurar que avaluo tenga el nombre correcto
        avaluo: formData.avaluo_catastral,
        avaluo_catastral: formData.avaluo_catastral
      };
      
      if (esNuevo) {
        // Crear nuevo predio
        await axios.post(
          `${API}/actualizacion/proyectos/${proyectoId}/predios`,
          datosCompletos,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Predio creado correctamente');
        setShowCrearModal(false);
      } else {
        // Editar predio existente (usar PATCH)
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
      
      {/* Modal Crear Predio */}
      <Dialog open={showCrearModal} onOpenChange={setShowCrearModal}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-600" />
              Nuevo Predio
            </DialogTitle>
            <DialogDescription>
              Ingrese los datos del nuevo predio para el proyecto
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Código Predial Nacional *</Label>
                <Input
                  placeholder="Código de 30 dígitos"
                  value={formData.codigo_predial}
                  onChange={(e) => setFormData({ ...formData, codigo_predial: e.target.value })}
                  className="font-mono"
                />
              </div>
              
              <div className="md:col-span-2">
                <Label>Dirección</Label>
                <Input
                  placeholder="Dirección del predio"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                />
              </div>
              
              <div>
                <Label>Área Terreno (m²)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={formData.area_terreno}
                  onChange={(e) => setFormData({ ...formData, area_terreno: e.target.value })}
                />
              </div>
              
              <div>
                <Label>Área Construida (m²)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={formData.area_construida}
                  onChange={(e) => setFormData({ ...formData, area_construida: e.target.value })}
                />
              </div>
              
              <div>
                <Label>Avalúo Catastral ($)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.avaluo_catastral}
                  onChange={(e) => setFormData({ ...formData, avaluo_catastral: e.target.value })}
                />
              </div>
              
              <div>
                <Label>Matrícula Inmobiliaria</Label>
                <Input
                  placeholder="XXX-XXXXX"
                  value={formData.matricula_inmobiliaria}
                  onChange={(e) => setFormData({ ...formData, matricula_inmobiliaria: e.target.value })}
                />
              </div>
              
              <div className="md:col-span-2">
                <Label>Destino Económico</Label>
                <Select 
                  value={formData.destino_economico}
                  onValueChange={(v) => setFormData({ ...formData, destino_economico: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione destino" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="habitacional">Habitacional</SelectItem>
                    <SelectItem value="comercial">Comercial</SelectItem>
                    <SelectItem value="industrial">Industrial</SelectItem>
                    <SelectItem value="agropecuario">Agropecuario</SelectItem>
                    <SelectItem value="lote">Lote</SelectItem>
                    <SelectItem value="otros">Otros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="md:col-span-2 border-t pt-4">
                <Label className="text-base font-semibold">Propietario Principal</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                  <div className="md:col-span-2">
                    <Input
                      placeholder="Nombre completo"
                      value={formData.propietarios[0]?.nombre_propietario || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        propietarios: [{ ...formData.propietarios[0], nombre_propietario: e.target.value }]
                      })}
                    />
                  </div>
                  <div>
                    <Input
                      placeholder="Número documento"
                      value={formData.propietarios[0]?.numero_documento || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        propietarios: [{ ...formData.propietarios[0], numero_documento: e.target.value }]
                      })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCrearModal(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => guardarPredio(true)}
              disabled={!formData.codigo_predial}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Crear Predio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Modal Editar Predio - Completo para R1/R2 */}
      <Dialog open={showEditarModal} onOpenChange={setShowEditarModal}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-visible">
          <div className="max-h-[80vh] overflow-y-auto pr-2">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Edit className="w-5 h-5 text-amber-600" />
              Editar Predio - {formData.codigo_predial}
            </DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="r1" className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="r1">R1 - Jurídico</TabsTrigger>
              <TabsTrigger value="r2">R2 - Físico</TabsTrigger>
              <TabsTrigger value="estado">Estado</TabsTrigger>
            </TabsList>
            
            {/* TAB R1 - Datos Jurídicos */}
            <TabsContent value="r1" className="space-y-4 mt-4">
              {/* Código Predial - Solo lectura */}
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-600 uppercase font-medium">Código Predial Nacional</p>
                    <p className="font-mono text-lg font-bold text-slate-800 break-all mt-1">
                      {formData.codigo_predial}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 uppercase font-medium">Código Homologado</p>
                    <p className="font-mono text-lg font-bold text-amber-700 mt-1">
                      {formData.codigo_homologado || 'Sin asignar'}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Sección de Propietarios con estado civil */}
              <div className="border border-slate-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Propietarios (R1)
                  </h4>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setFormData({
                      ...formData,
                      propietarios: [...formData.propietarios, { nombre_propietario: '', tipo_documento: 'CC', numero_documento: '', estado_civil: '' }]
                    })}
                    className="text-emerald-700"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Agregar
                  </Button>
                </div>
                
                {formData.propietarios.map((prop, index) => (
                  <div key={index} className="border border-slate-200 rounded-lg p-4 bg-slate-50 mb-3">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-medium text-slate-700">Propietario {index + 1}</span>
                      {formData.propietarios.length > 1 && (
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            const newProps = formData.propietarios.filter((_, i) => i !== index);
                            setFormData({ ...formData, propietarios: newProps });
                          }}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="col-span-4">
                        <Label className="text-xs">Nombre Completo *</Label>
                        <Input 
                          value={prop.nombre_propietario || ''} 
                          onChange={(e) => {
                            const newProps = [...formData.propietarios];
                            newProps[index] = { ...newProps[index], nombre_propietario: e.target.value.toUpperCase() };
                            setFormData({ ...formData, propietarios: newProps });
                          }}
                          placeholder="NOMBRE COMPLETO DEL PROPIETARIO"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Tipo Doc.</Label>
                        <Select 
                          value={prop.tipo_documento || 'CC'}
                          onValueChange={(v) => {
                            const newProps = [...formData.propietarios];
                            newProps[index] = { ...newProps[index], tipo_documento: v };
                            setFormData({ ...formData, propietarios: newProps });
                          }}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CC">CC</SelectItem>
                            <SelectItem value="CE">CE</SelectItem>
                            <SelectItem value="NIT">NIT</SelectItem>
                            <SelectItem value="TI">TI</SelectItem>
                            <SelectItem value="PA">PA</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Número Documento *</Label>
                        <Input 
                          value={prop.numero_documento || ''} 
                          onChange={(e) => {
                            const newProps = [...formData.propietarios];
                            newProps[index] = { ...newProps[index], numero_documento: e.target.value };
                            setFormData({ ...formData, propietarios: newProps });
                          }}
                          placeholder="123456789"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Estado Civil</Label>
                        <Select 
                          value={prop.estado_civil || ''}
                          onValueChange={(v) => {
                            const newProps = [...formData.propietarios];
                            newProps[index] = { ...newProps[index], estado_civil: v };
                            setFormData({ ...formData, propietarios: newProps });
                          }}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Sin especificar</SelectItem>
                            <SelectItem value="soltero">Soltero(a)</SelectItem>
                            <SelectItem value="casado">Casado(a)</SelectItem>
                            <SelectItem value="union_libre">Unión Libre</SelectItem>
                            <SelectItem value="viudo">Viudo(a)</SelectItem>
                            <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Información básica del Predio */}
              <div className="border border-slate-200 rounded-lg p-4">
                <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  Información del Predio (R1)
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-3">
                    <Label>Dirección *</Label>
                    <Input 
                      value={formData.direccion || ''} 
                      onChange={(e) => setFormData({...formData, direccion: e.target.value.toUpperCase()})}
                      placeholder="DIRECCIÓN DEL PREDIO"
                    />
                  </div>
                  
                  <div>
                    <Label>Comuna</Label>
                    <Input 
                      value={formData.comuna || ''} 
                      onChange={(e) => setFormData({...formData, comuna: e.target.value})}
                      placeholder="0"
                    />
                  </div>
                  
                  <div>
                    <Label>Área Terreno (m²)</Label>
                    <Input 
                      type="number" 
                      value={formData.area_terreno || ''} 
                      onChange={(e) => setFormData({...formData, area_terreno: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <Label>Área Construida (m²)</Label>
                    <Input 
                      type="number" 
                      value={formData.area_construida || ''} 
                      onChange={(e) => setFormData({...formData, area_construida: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <Label>Avalúo Catastral (COP) *</Label>
                    <Input 
                      type="number" 
                      value={formData.avaluo_catastral || ''} 
                      onChange={(e) => setFormData({...formData, avaluo_catastral: e.target.value})}
                      placeholder="0"
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <Label className="mb-2 block">Destino Económico *</Label>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { value: 'A', label: 'A-Habit.' },
                        { value: 'B', label: 'B-Ind.' },
                        { value: 'C', label: 'C-Com.' },
                        { value: 'D', label: 'D-Agro.' },
                        { value: 'E', label: 'E-Min.' },
                        { value: 'F', label: 'F-Cult.' },
                        { value: 'G', label: 'G-Recr.' },
                        { value: 'H', label: 'H-Salub.' },
                        { value: 'I', label: 'I-Inst.' },
                        { value: 'J', label: 'J-Educ.' },
                        { value: 'K', label: 'K-Relig.' },
                        { value: 'L', label: 'L-Agríc.' },
                        { value: 'M', label: 'M-Forest.' },
                        { value: 'N', label: 'N-Pec.' },
                        { value: 'O', label: 'O-Agroind.' },
                        { value: 'P', label: 'P-Lote' },
                      ].map(opt => (
                        <Badge 
                          key={opt.value}
                          variant={formData.destino_economico === opt.value ? 'default' : 'outline'}
                          className={`cursor-pointer text-xs ${formData.destino_economico === opt.value ? 'bg-amber-600' : 'hover:bg-amber-50'}`}
                          onClick={() => setFormData({...formData, destino_economico: opt.value})}
                        >
                          {opt.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            {/* TAB R2 - Datos Físicos */}
            <TabsContent value="r2" className="space-y-4 mt-4">
              {/* Matrícula Inmobiliaria */}
              <div className="border border-slate-200 rounded-lg p-4">
                <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Identificación
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Matrícula Inmobiliaria</Label>
                    <Input 
                      value={formData.matricula_inmobiliaria || ''} 
                      onChange={(e) => setFormData({...formData, matricula_inmobiliaria: e.target.value})}
                      placeholder="XXX-XXXXXX"
                    />
                  </div>
                  <div>
                    <Label>Uso</Label>
                    <Select 
                      value={formData.uso || ''}
                      onValueChange={(v) => setFormData({...formData, uso: v})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar uso..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">A - Habitacional</SelectItem>
                        <SelectItem value="B">B - Industrial</SelectItem>
                        <SelectItem value="C">C - Comercial</SelectItem>
                        <SelectItem value="D">D - Agropecuario</SelectItem>
                        <SelectItem value="I">I - Institucional</SelectItem>
                        <SelectItem value="M">M - Mixto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              
              {/* Zonas Físicas */}
              <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-blue-800 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Zonas Físicas (R2)
                  </h4>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setFormData({
                      ...formData,
                      zonas_fisicas: [...(formData.zonas_fisicas || []), { zona_fisica: '', zona_economica: '', area_terreno: '' }]
                    })}
                    className="text-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Agregar Zona
                  </Button>
                </div>
                
                {(formData.zonas_fisicas || []).map((zona, index) => (
                  <div key={index} className="border border-blue-200 rounded-lg p-3 bg-white mb-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-blue-700">Zona {index + 1}</span>
                      {(formData.zonas_fisicas || []).length > 1 && (
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            const newZonas = (formData.zonas_fisicas || []).filter((_, i) => i !== index);
                            setFormData({ ...formData, zonas_fisicas: newZonas });
                          }}
                          className="text-red-600 hover:text-red-700 h-6 w-6 p-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Zona Física</Label>
                        <Input 
                          value={zona.zona_fisica || ''} 
                          onChange={(e) => {
                            const newZonas = [...(formData.zonas_fisicas || [])];
                            newZonas[index] = { ...newZonas[index], zona_fisica: e.target.value };
                            setFormData({ ...formData, zonas_fisicas: newZonas });
                          }}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Zona Económica</Label>
                        <Input 
                          value={zona.zona_economica || ''} 
                          onChange={(e) => {
                            const newZonas = [...(formData.zonas_fisicas || [])];
                            newZonas[index] = { ...newZonas[index], zona_economica: e.target.value };
                            setFormData({ ...formData, zonas_fisicas: newZonas });
                          }}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Área Terreno (m²)</Label>
                        <Input 
                          type="number"
                          value={zona.area_terreno || ''} 
                          onChange={(e) => {
                            const newZonas = [...(formData.zonas_fisicas || [])];
                            newZonas[index] = { ...newZonas[index], area_terreno: e.target.value };
                            setFormData({ ...formData, zonas_fisicas: newZonas });
                          }}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Datos de Construcción */}
              <div className="border border-emerald-200 rounded-lg p-4 bg-emerald-50">
                <h4 className="font-semibold text-emerald-800 mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Datos de Construcción
                </h4>
                <div className="grid grid-cols-5 gap-4">
                  <div>
                    <Label className="text-xs">Habitaciones</Label>
                    <Input 
                      type="number"
                      value={formData.habitaciones || ''} 
                      onChange={(e) => setFormData({...formData, habitaciones: e.target.value})}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Baños</Label>
                    <Input 
                      type="number"
                      value={formData.banos || ''} 
                      onChange={(e) => setFormData({...formData, banos: e.target.value})}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Locales</Label>
                    <Input 
                      type="number"
                      value={formData.locales || ''} 
                      onChange={(e) => setFormData({...formData, locales: e.target.value})}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Pisos</Label>
                    <Input 
                      type="number"
                      value={formData.pisos || ''} 
                      onChange={(e) => setFormData({...formData, pisos: e.target.value})}
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Área Const. (m²)</Label>
                    <Input 
                      type="number"
                      value={formData.area_construida || ''} 
                      onChange={(e) => setFormData({...formData, area_construida: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
            
            {/* TAB Estado */}
            <TabsContent value="estado" className="space-y-4 mt-4">
              {/* Estado de Visita */}
              <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4" />
                  Estado de Visita
                </h4>
                <div className="flex flex-wrap gap-3">
                  <Badge 
                    variant={predioSeleccionado?.estado_visita === 'pendiente' || !predioSeleccionado?.estado_visita ? 'default' : 'outline'}
                    className={`cursor-pointer ${predioSeleccionado?.estado_visita === 'pendiente' || !predioSeleccionado?.estado_visita ? 'bg-yellow-500' : ''}`}
                    onClick={() => marcarEstadoPredio(predioSeleccionado, 'pendiente')}
                  >
                    <AlertCircle className="w-3 h-3 mr-1" /> Pendiente
                  </Badge>
                  <Badge 
                    variant={predioSeleccionado?.estado_visita === 'visitado' ? 'default' : 'outline'}
                    className={`cursor-pointer ${predioSeleccionado?.estado_visita === 'visitado' ? 'bg-blue-500' : ''}`}
                    onClick={() => marcarEstadoPredio(predioSeleccionado, 'visitado')}
                  >
                    <Clock className="w-3 h-3 mr-1" /> Visitado
                  </Badge>
                  <Badge 
                    variant={predioSeleccionado?.estado_visita === 'actualizado' ? 'default' : 'outline'}
                    className={`cursor-pointer ${predioSeleccionado?.estado_visita === 'actualizado' ? 'bg-green-500' : ''}`}
                    onClick={() => marcarEstadoPredio(predioSeleccionado, 'actualizado')}
                  >
                    <CheckCircle className="w-3 h-3 mr-1" /> Actualizado
                  </Badge>
                </div>
              </div>
              
              {/* Información de auditoría */}
              {predioSeleccionado && (
                <div className="border border-slate-200 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-800 mb-3">Información de Auditoría</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {predioSeleccionado.actualizado_por && (
                      <div>
                        <p className="text-slate-500">Actualizado por:</p>
                        <p className="font-medium">{predioSeleccionado.actualizado_por}</p>
                      </div>
                    )}
                    {predioSeleccionado.actualizado_en && (
                      <div>
                        <p className="text-slate-500">Fecha actualización:</p>
                        <p className="font-medium">{new Date(predioSeleccionado.actualizado_en).toLocaleString('es-CO')}</p>
                      </div>
                    )}
                    {predioSeleccionado.visitado_por && (
                      <div>
                        <p className="text-slate-500">Visitado por:</p>
                        <p className="font-medium">{predioSeleccionado.visitado_por}</p>
                      </div>
                    )}
                    {predioSeleccionado.visitado_en && (
                      <div>
                        <p className="text-slate-500">Fecha visita:</p>
                        <p className="font-medium">{new Date(predioSeleccionado.visitado_en).toLocaleString('es-CO')}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
          </div>
          
          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setShowEditarModal(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => guardarPredio(false)}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Guardar Cambios
            </Button>
          </DialogFooter>
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
