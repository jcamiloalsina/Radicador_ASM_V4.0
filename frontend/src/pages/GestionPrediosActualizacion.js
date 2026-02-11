import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  Search, MapPin, User, DollarSign, Building, Eye, Download,
  CheckCircle, Clock, AlertCircle, FolderOpen, FileText, RefreshCw, Loader2
} from 'lucide-react';

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
  return { tipo: 'corregimiento', texto: `Corregimiento (${zonaCode})` };
};

// Componente de Card de estadísticas
const StatCard = ({ icon: Icon, label, value, color, onClick }) => (
  <Card 
    className={`cursor-pointer hover:shadow-md transition-shadow ${onClick ? 'hover:border-amber-400' : ''}`}
    onClick={onClick}
    data-testid={`stat-card-${label.toLowerCase().replace(/\s/g, '-')}`}
  >
    <CardContent className="p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-slate-500">{label}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

export default function GestionPrediosActualizacion() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Estados
  const [proyectos, setProyectos] = useState([]);
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState('');
  const [predios, setPredios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPredios, setLoadingPredios] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('todos');
  const [filterZona, setFilterZona] = useState('todos');
  
  // Modal de detalle
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [predioDetalle, setPredioDetalle] = useState(null);
  
  // Estadísticas
  const [stats, setStats] = useState({
    total: 0,
    pendientes: 0,
    visitados: 0,
    actualizados: 0
  });
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;
  
  // Permisos
  const esCoordinador = ['coordinador', 'administrador'].includes(user?.role);
  
  // Cargar proyectos de actualización
  const fetchProyectos = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/actualizacion/proyectos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // La respuesta puede ser un array o un objeto con {proyectos: [...]}
      const proyectosData = response.data.proyectos || response.data || [];
      // Filtrar solo proyectos activos o pausados (no archivados/completados)
      const proyectosActivos = proyectosData.filter(p => 
        p.estado === 'activo' || p.estado === 'pausado'
      );
      setProyectos(proyectosActivos);
    } catch (error) {
      console.error('Error cargando proyectos:', error);
      toast.error('Error al cargar proyectos de actualización');
    } finally {
      setLoading(false);
    }
  };
  
  // Cargar predios de un proyecto
  const fetchPredios = async (proyectoId) => {
    if (!proyectoId) {
      setPredios([]);
      setStats({ total: 0, pendientes: 0, visitados: 0, actualizados: 0 });
      return;
    }
    
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
      toast.error('Error al cargar predios del proyecto');
    } finally {
      setLoadingPredios(false);
    }
  };
  
  // Cargar datos iniciales
  useEffect(() => {
    fetchProyectos();
  }, []);
  
  // Cargar predios cuando cambia el proyecto
  useEffect(() => {
    if (proyectoSeleccionado) {
      fetchPredios(proyectoSeleccionado);
    }
  }, [proyectoSeleccionado]);
  
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
  
  // Abrir detalle de predio
  const abrirDetalle = (predio) => {
    setPredioDetalle(predio);
    setShowDetalleModal(true);
  };
  
  // Ir al visor con el predio seleccionado
  const irAlVisor = (predio) => {
    navigate(`/dashboard/visor-actualizacion/${proyectoSeleccionado}?codigo=${predio.codigo_predial || predio.numero_predial}`);
  };
  
  // Exportar a Excel (solo coordinadores)
  const exportarExcel = async () => {
    if (!proyectoSeleccionado) {
      toast.warning('Seleccione un proyecto primero');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/actualizacion/proyectos/${proyectoSeleccionado}/exportar-excel`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const proyecto = proyectos.find(p => p._id === proyectoSeleccionado || p.id === proyectoSeleccionado);
      link.setAttribute('download', `predios_actualizacion_${proyecto?.nombre || proyectoSeleccionado}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Excel exportado correctamente');
    } catch (error) {
      console.error('Error exportando:', error);
      toast.error('Error al exportar Excel');
    }
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" data-testid="gestion-predios-actualizacion">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-amber-600" />
            Gestión de Predios - Actualización
          </h1>
          <p className="text-slate-500 mt-1">
            Administre los predios de los proyectos de actualización catastral
          </p>
        </div>
        
        {esCoordinador && proyectoSeleccionado && (
          <Button 
            onClick={exportarExcel}
            variant="outline"
            className="border-amber-500 text-amber-700 hover:bg-amber-50"
            data-testid="btn-exportar-excel"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
        )}
      </div>
      
      {/* Selector de Proyecto */}
      <Card className="border-amber-200">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="flex-1">
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                Seleccione un Proyecto de Actualización
              </label>
              <Select
                value={proyectoSeleccionado}
                onValueChange={setProyectoSeleccionado}
              >
                <SelectTrigger className="w-full md:w-96" data-testid="select-proyecto">
                  <SelectValue placeholder="Seleccione un proyecto..." />
                </SelectTrigger>
                <SelectContent>
                  {proyectos.map(proyecto => (
                    <SelectItem 
                      key={proyecto._id || proyecto.id} 
                      value={proyecto._id || proyecto.id}
                    >
                      <span className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-amber-500" />
                        {proyecto.nombre} - {proyecto.municipio}
                        <Badge variant="outline" className="ml-2 text-xs">
                          {proyecto.estado}
                        </Badge>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {proyectoSeleccionado && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchPredios(proyectoSeleccionado)}
                disabled={loadingPredios}
              >
                {loadingPredios ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span className="ml-2">Actualizar</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Stats Cards */}
      {proyectoSeleccionado && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Building}
            label="Total Predios"
            value={stats.total}
            color="bg-slate-100 text-slate-600"
            onClick={() => setFilterEstado('todos')}
          />
          <StatCard
            icon={AlertCircle}
            label="Pendientes"
            value={stats.pendientes}
            color="bg-yellow-100 text-yellow-600"
            onClick={() => setFilterEstado('pendiente')}
          />
          <StatCard
            icon={Clock}
            label="Visitados"
            value={stats.visitados}
            color="bg-blue-100 text-blue-600"
            onClick={() => setFilterEstado('visitado')}
          />
          <StatCard
            icon={CheckCircle}
            label="Actualizados"
            value={stats.actualizados}
            color="bg-green-100 text-green-600"
            onClick={() => setFilterEstado('actualizado')}
          />
        </div>
      )}
      
      {/* Filtros */}
      {proyectoSeleccionado && (
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
              
              <Select value={filterEstado} onValueChange={setFilterEstado}>
                <SelectTrigger className="w-full md:w-40" data-testid="select-estado">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendiente">Pendientes</SelectItem>
                  <SelectItem value="visitado">Visitados</SelectItem>
                  <SelectItem value="actualizado">Actualizados</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={filterZona} onValueChange={setFilterZona}>
                <SelectTrigger className="w-full md:w-40" data-testid="select-zona">
                  <SelectValue placeholder="Zona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="rural">Rural</SelectItem>
                  <SelectItem value="urbano">Urbano</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Contador de resultados */}
            <div className="mt-3 text-sm text-slate-500">
              Mostrando {prediosPaginados.length} de {prediosFiltrados.length} predios
              {searchTerm && ` (búsqueda: "${searchTerm}")`}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Lista de Predios */}
      {proyectoSeleccionado ? (
        loadingPredios ? (
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
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => abrirDetalle(predio)}
                    data-testid={`predio-card-${index}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
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
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              irAlVisor(predio);
                            }}
                            data-testid={`btn-ver-mapa-${index}`}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Ver en Mapa
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            
            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-4">
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
                  Anterior
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
                  Siguiente
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
        )
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <FolderOpen className="w-16 h-16 mx-auto text-amber-200" />
            <h3 className="mt-4 text-lg font-medium text-slate-700">
              Seleccione un proyecto
            </h3>
            <p className="mt-2 text-slate-500">
              Elija un proyecto de actualización para ver y gestionar sus predios
            </p>
          </CardContent>
        </Card>
      )}
      
      {/* Modal de Detalle */}
      <Dialog open={showDetalleModal} onOpenChange={setShowDetalleModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="w-5 h-5 text-amber-600" />
              Detalle del Predio
            </DialogTitle>
            <DialogDescription>
              Información completa del predio seleccionado
            </DialogDescription>
          </DialogHeader>
          
          {predioDetalle && (
            <div className="space-y-4">
              {/* Estado */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="font-medium">Estado de Visita</span>
                {renderEstadoBadge(predioDetalle.estado_visita)}
              </div>
              
              {/* Código Predial */}
              <div className="bg-amber-50 p-3 rounded-lg">
                <p className="text-xs text-amber-600 uppercase font-medium">Código Predial Nacional</p>
                <p className="font-mono text-lg font-bold text-amber-800 break-all">
                  {predioDetalle.codigo_predial || predioDetalle.numero_predial || 'N/A'}
                </p>
              </div>
              
              {/* Información básica */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Municipio</p>
                  <p className="font-medium">{predioDetalle.municipio || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Zona</p>
                  <p className="font-medium">
                    {getZonaFromCodigo(predioDetalle.codigo_predial || predioDetalle.numero_predial).texto}
                  </p>
                </div>
              </div>
              
              {/* Dirección */}
              {predioDetalle.direccion && (
                <div>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Dirección
                  </p>
                  <p className="font-medium">{predioDetalle.direccion}</p>
                </div>
              )}
              
              {/* Propietarios */}
              <div>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <User className="w-3 h-3" /> Propietario(s)
                </p>
                {predioDetalle.propietarios?.length > 0 ? (
                  predioDetalle.propietarios.map((p, idx) => (
                    <p key={idx} className="font-medium">
                      {p.nombre_propietario || p.nombre || 'Sin nombre'}
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
                  {predioDetalle.matricula_inmobiliaria || 'Sin información'}
                </p>
              </div>
              
              {/* Áreas */}
              <div className="grid grid-cols-2 gap-4 p-3 bg-blue-50 rounded-lg">
                <div>
                  <p className="text-xs text-blue-600">Área Terreno (R1)</p>
                  <p className="font-bold text-blue-800">{formatArea(predioDetalle.area_terreno)}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-600">Área Construida</p>
                  <p className="font-medium text-blue-700">{formatArea(predioDetalle.area_construida)}</p>
                </div>
              </div>
              
              {/* Avalúo */}
              <div>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <DollarSign className="w-3 h-3" /> Avalúo Catastral
                </p>
                <p className="text-lg font-bold text-emerald-700">
                  {formatCurrency(predioDetalle.avaluo_catastral || predioDetalle.avaluo)}
                </p>
              </div>
              
              {/* Destino Económico */}
              {predioDetalle.destino_economico && (
                <div>
                  <p className="text-xs text-slate-500">Destino Económico</p>
                  <p className="font-medium">{predioDetalle.destino_economico}</p>
                </div>
              )}
              
              {/* Botón para ir al visor */}
              <div className="pt-4 border-t">
                <Button
                  className="w-full bg-amber-600 hover:bg-amber-700"
                  onClick={() => {
                    setShowDetalleModal(false);
                    irAlVisor(predioDetalle);
                  }}
                  data-testid="btn-ir-visor-modal"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Abrir en Visor de Mapa
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
