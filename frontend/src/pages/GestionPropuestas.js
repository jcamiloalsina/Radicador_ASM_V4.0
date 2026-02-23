import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  GitCompare,
  Check,
  X,
  Eye,
  RefreshCw,
  CheckSquare,
  Square,
  ArrowLeft,
  Edit,
  ArrowRight,
  User,
  MapPin,
  Home,
  DollarSign,
  Ruler,
  AlertCircle,
  Send
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Componente para mostrar un campo comparativo
function CampoComparativo({ label, valorAnterior, valorNuevo, icon: Icon, tipo = 'texto' }) {
  const cambio = valorAnterior !== valorNuevo;
  
  const formatValue = (val) => {
    if (val === null || val === undefined || val === '') return '-';
    if (tipo === 'moneda') return `$${Number(val).toLocaleString('es-CO')}`;
    if (tipo === 'area') return `${Number(val).toLocaleString('es-CO')} m²`;
    if (tipo === 'array') return Array.isArray(val) ? val.length : '0';
    return String(val);
  };
  
  return (
    <div className={`grid grid-cols-[1fr,auto,1fr] gap-2 items-center p-3 rounded-lg ${cambio ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'}`}>
      {/* Valor anterior */}
      <div className="text-left">
        <p className="text-xs text-slate-500 mb-1">Anterior</p>
        <p className={`text-sm font-medium ${cambio ? 'text-red-700' : 'text-slate-700'}`}>
          {formatValue(valorAnterior)}
        </p>
      </div>
      
      {/* Icono central */}
      <div className="flex flex-col items-center">
        {Icon && <Icon className="w-4 h-4 text-slate-400 mb-1" />}
        <p className="text-[10px] font-medium text-slate-500 text-center whitespace-nowrap">{label}</p>
        {cambio ? (
          <ArrowRight className="w-4 h-4 text-amber-500 mt-1" />
        ) : (
          <span className="text-[10px] text-emerald-600 mt-1">=</span>
        )}
      </div>
      
      {/* Valor nuevo */}
      <div className="text-right">
        <p className="text-xs text-slate-500 mb-1">Propuesto</p>
        <p className={`text-sm font-medium ${cambio ? 'text-emerald-700' : 'text-slate-700'}`}>
          {formatValue(valorNuevo)}
        </p>
      </div>
    </div>
  );
}

// Componente para mostrar propietarios comparativos
function PropietariosComparativos({ anteriores = [], nuevos = [] }) {
  const maxLength = Math.max(anteriores.length, nuevos.length);
  
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <User className="w-4 h-4 text-slate-500" />
        <span className="text-sm font-medium text-slate-700">Propietarios</span>
        {anteriores.length !== nuevos.length && (
          <Badge variant="outline" className="bg-amber-100 text-amber-700 text-xs">
            {anteriores.length} → {nuevos.length}
          </Badge>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {/* Anteriores */}
        <div className="bg-slate-50 p-3 rounded-lg">
          <p className="text-xs text-slate-500 mb-2 font-medium">Anteriores ({anteriores.length})</p>
          {anteriores.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Sin propietarios</p>
          ) : (
            <div className="space-y-2">
              {anteriores.map((p, i) => (
                <div key={i} className="text-sm bg-white p-2 rounded border">
                  <p className="font-medium text-slate-700">{p.nombre_propietario || p.nombre || '-'}</p>
                  <p className="text-xs text-slate-500">
                    {p.tipo_documento || 'CC'}: {p.numero_documento || '-'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Nuevos */}
        <div className="bg-emerald-50 p-3 rounded-lg">
          <p className="text-xs text-emerald-600 mb-2 font-medium">Propuestos ({nuevos.length})</p>
          {nuevos.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Sin propietarios</p>
          ) : (
            <div className="space-y-2">
              {nuevos.map((p, i) => (
                <div key={i} className="text-sm bg-white p-2 rounded border border-emerald-200">
                  <p className="font-medium text-emerald-700">{p.nombre_propietario || p.nombre || '-'}</p>
                  <p className="text-xs text-emerald-600">
                    {p.tipo_documento || 'CC'}: {p.numero_documento || '-'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GestionPropuestas() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [proyectos, setProyectos] = useState([]);
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState(null);
  const [propuestas, setPropuestas] = useState([]);
  const [prediosSinCambios, setPrediosSinCambios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('pendiente');
  const [filtroTipo, setFiltroTipo] = useState('propuestas'); // 'propuestas' o 'sin_cambios'
  const [propuestaDetalle, setPropuestaDetalle] = useState(null);
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [comentarioRevision, setComentarioRevision] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [seleccionadasSinCambios, setSeleccionadasSinCambios] = useState([]);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [datosEditados, setDatosEditados] = useState({});
  
  // Cargar proyectos
  useEffect(() => {
    const fetchProyectos = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API}/actualizacion/proyectos`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setProyectos(response.data.proyectos || []);
        if (response.data.proyectos?.length > 0) {
          setProyectoSeleccionado(response.data.proyectos[0].id);
        }
      } catch (error) {
        console.error('Error cargando proyectos:', error);
      }
    };
    fetchProyectos();
  }, []);
  
  // Cargar propuestas del proyecto seleccionado
  const fetchPropuestas = useCallback(async () => {
    if (!proyectoSeleccionado) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/actualizacion/proyectos/${proyectoSeleccionado}/propuestas?estado=${filtroEstado}`,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setPropuestas(response.data.propuestas || []);
      setSeleccionadas([]);
    } catch (error) {
      console.error('Error cargando propuestas:', error);
      toast.error('Error al cargar propuestas');
    } finally {
      setLoading(false);
    }
  }, [proyectoSeleccionado, filtroEstado]);
  
  // Cargar predios sin cambios del proyecto
  const fetchPrediosSinCambios = useCallback(async () => {
    if (!proyectoSeleccionado) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/actualizacion/proyectos/${proyectoSeleccionado}/predios-sin-cambios`,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setPrediosSinCambios(response.data.predios || []);
      setSeleccionadasSinCambios([]);
    } catch (error) {
      console.error('Error cargando predios sin cambios:', error);
    } finally {
      setLoading(false);
    }
  }, [proyectoSeleccionado]);
  
  useEffect(() => {
    if (filtroTipo === 'propuestas') {
      fetchPropuestas();
    } else {
      fetchPrediosSinCambios();
    }
  }, [fetchPropuestas, fetchPrediosSinCambios, filtroTipo]);
  
  // Aprobar propuesta individual
  const handleAprobar = async (propuestaId, comentario = '') => {
    setProcesando(true);
    try {
      const token = localStorage.getItem('token');
      const payload = { 
        comentario: comentario || comentarioRevision || 'Aprobado'
      };
      
      // Si hay datos editados, incluirlos
      if (modoEdicion && Object.keys(datosEditados).length > 0) {
        payload.datos_editados = datosEditados;
      }
      
      await axios.patch(
        `${API}/actualizacion/propuestas/${propuestaId}/aprobar`,
        payload,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      toast.success('Propuesta aprobada exitosamente');
      setShowDetalleModal(false);
      setComentarioRevision('');
      setModoEdicion(false);
      setDatosEditados({});
      fetchPropuestas();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al aprobar propuesta');
    } finally {
      setProcesando(false);
    }
  };
  
  // Rechazar propuesta individual (envía a subsanación)
  const handleRechazar = async (propuestaId, comentario = '') => {
    if (!comentarioRevision.trim() && !comentario) {
      toast.error('Debe incluir un motivo de rechazo');
      return;
    }
    
    setProcesando(true);
    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `${API}/actualizacion/propuestas/${propuestaId}/rechazar`,
        { comentario: comentario || comentarioRevision },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      toast.success('Propuesta rechazada - Enviada a subsanación del gestor');
      setShowDetalleModal(false);
      setComentarioRevision('');
      fetchPropuestas();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al rechazar propuesta');
    } finally {
      setProcesando(false);
    }
  };
  
  // Aprobación masiva
  const handleAprobarMasivo = async () => {
    if (seleccionadas.length === 0) {
      toast.error('Seleccione al menos una propuesta');
      return;
    }
    
    setProcesando(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/actualizacion/proyectos/${proyectoSeleccionado}/propuestas/aprobar-masivo`,
        { 
          propuesta_ids: seleccionadas,
          comentario: 'Aprobación masiva por coordinador'
        },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      toast.success(`${response.data.aprobadas || seleccionadas.length} propuestas aprobadas`);
      setSeleccionadas([]);
      fetchPropuestas();
    } catch (error) {
      toast.error('Error en aprobación masiva');
    } finally {
      setProcesando(false);
    }
  };
  
  // Aprobar predio sin cambios
  const handleAprobarSinCambios = async (codigoPredial) => {
    setProcesando(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/actualizacion/proyectos/${proyectoSeleccionado}/predios/${codigoPredial}/aprobar-sin-cambios`,
        { comentario: comentarioRevision || 'Aprobado sin cambios' },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      toast.success('Predio aprobado - Marcado como actualizado');
      fetchPrediosSinCambios();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al aprobar');
    } finally {
      setProcesando(false);
    }
  };
  
  // Aprobación masiva de predios sin cambios
  const handleAprobarMasivoSinCambios = async () => {
    if (seleccionadasSinCambios.length === 0) {
      toast.error('Seleccione al menos un predio');
      return;
    }
    
    setProcesando(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/actualizacion/proyectos/${proyectoSeleccionado}/predios-sin-cambios/aprobar-masivo`,
        { 
          codigos_prediales: seleccionadasSinCambios,
          comentario: 'Aprobación masiva sin cambios'
        },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      toast.success(`${response.data.aprobados || seleccionadasSinCambios.length} predios aprobados`);
      setSeleccionadasSinCambios([]);
      fetchPrediosSinCambios();
    } catch (error) {
      toast.error('Error en aprobación masiva');
    } finally {
      setProcesando(false);
    }
  };
  
  // Toggle selección sin cambios
  const toggleSeleccionSinCambios = (codigo) => {
    setSeleccionadasSinCambios(prev => 
      prev.includes(codigo)
        ? prev.filter(c => c !== codigo)
        : [...prev, codigo]
    );
  };
  
  // Seleccionar todas sin cambios
  const toggleSeleccionarTodasSinCambios = () => {
    if (seleccionadasSinCambios.length === prediosSinCambios.length) {
      setSeleccionadasSinCambios([]);
    } else {
      setSeleccionadasSinCambios(prediosSinCambios.map(p => p.codigo_predial || p.numero_predial));
    }
  };
  
  // Toggle selección
  const toggleSeleccion = (propuestaId) => {
    setSeleccionadas(prev => 
      prev.includes(propuestaId)
        ? prev.filter(id => id !== propuestaId)
        : [...prev, propuestaId]
    );
  };
  
  // Seleccionar todas
  const toggleSeleccionarTodas = () => {
    if (seleccionadas.length === propuestas.length) {
      setSeleccionadas([]);
    } else {
      setSeleccionadas(propuestas.map(p => p.id));
    }
  };
  
  // Ver detalle de propuesta
  const verDetalle = (propuesta) => {
    setPropuestaDetalle(propuesta);
    setComentarioRevision('');
    setModoEdicion(false);
    
    // Normalizar datos propuestos para predios nuevos/mejoras
    // Si datos_propuestos tiene r1/r2, extraer los campos a la raíz
    let datosNormalizados = propuesta.datos_propuestos || {};
    
    if (datosNormalizados.r1) {
      // Es un predio nuevo o mejora - aplanar la estructura
      datosNormalizados = {
        ...datosNormalizados,
        direccion: datosNormalizados.r1?.direccion || '',
        destino_economico: datosNormalizados.r1?.destino_economico || '',
        area_terreno: datosNormalizados.r1?.area_terreno || '',
        area_construida: datosNormalizados.r1?.area_construida || '',
        avaluo: datosNormalizados.r1?.avaluo || '',
        zona: datosNormalizados.r1?.zona || '',
        sector: datosNormalizados.r1?.sector || '',
        comuna: datosNormalizados.r1?.comuna || '',
        barrio: datosNormalizados.r1?.barrio || '',
        manzana_vereda: datosNormalizados.r1?.manzana_vereda || '',
        terreno: datosNormalizados.r1?.terreno || '',
        matricula: datosNormalizados.r2?.matricula_inmobiliaria || datosNormalizados.r2?.matricula || '',
        estrato: datosNormalizados.r1?.estrato || '',
        propietarios: datosNormalizados.propietarios || [],
        construcciones: datosNormalizados.construcciones || [],
        zonas_fisicas: datosNormalizados.zonas_fisicas || [],
        formato_visita: datosNormalizados.formato_visita || {}
      };
    }
    
    // Actualizar la propuesta con datos normalizados para la vista
    const propuestaNormalizada = {
      ...propuesta,
      datos_propuestos: datosNormalizados
    };
    
    setPropuestaDetalle(propuestaNormalizada);
    setDatosEditados(datosNormalizados);
    setShowDetalleModal(true);
  };
  
  // Activar modo edición
  const activarEdicion = () => {
    setModoEdicion(true);
    setDatosEditados(propuestaDetalle.datos_propuestos || {});
  };
  
  // Verificar permisos
  const esCoordinador = user?.role === 'coordinador' || user?.role === 'administrador';
  
  if (!esCoordinador) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">No tiene permiso para acceder a esta página</p>
        <Button onClick={() => navigate('/dashboard')} className="mt-4">
          Volver al Dashboard
        </Button>
      </div>
    );
  }
  
  const proyectoActual = proyectos.find(p => p.id === proyectoSeleccionado);
  
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Gestión de Propuestas de Cambio</h1>
            <p className="text-sm text-slate-500">
              Módulo Actualización - Aprueba, edita o rechaza propuestas de los gestores de campo
            </p>
          </div>
        </div>
        
        {filtroTipo === 'propuestas' && filtroEstado === 'pendiente' && propuestas.length > 0 && (
          <Badge variant="outline" className="bg-amber-100 text-amber-700 text-lg px-4 py-2">
            {propuestas.length} pendientes
          </Badge>
        )}
        {filtroTipo === 'sin_cambios' && prediosSinCambios.length > 0 && (
          <Badge variant="outline" className="bg-blue-100 text-blue-700 text-lg px-4 py-2">
            {prediosSinCambios.length} sin cambios
          </Badge>
        )}
      </div>
      
      {/* Tabs para tipo de vista */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={filtroTipo === 'propuestas' ? 'default' : 'outline'}
          onClick={() => setFiltroTipo('propuestas')}
          className={filtroTipo === 'propuestas' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
        >
          <GitCompare className="w-4 h-4 mr-2" />
          Propuestas de Cambio
          {propuestas.length > 0 && filtroEstado === 'pendiente' && (
            <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">{propuestas.length}</span>
          )}
        </Button>
        <Button
          variant={filtroTipo === 'sin_cambios' ? 'default' : 'outline'}
          onClick={() => setFiltroTipo('sin_cambios')}
          className={filtroTipo === 'sin_cambios' ? 'bg-blue-600 hover:bg-blue-700' : ''}
        >
          <CheckSquare className="w-4 h-4 mr-2" />
          Predios Sin Cambios
          {prediosSinCambios.length > 0 && (
            <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">{prediosSinCambios.length}</span>
          )}
        </Button>
      </div>
      
      {/* Filtros */}
      <div className="bg-white rounded-lg border p-4 mb-6 shadow-sm">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-slate-600">Proyecto de Actualización</Label>
            <Select value={proyectoSeleccionado || ''} onValueChange={setProyectoSeleccionado}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Seleccionar proyecto" />
              </SelectTrigger>
              <SelectContent>
                {proyectos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre} - {p.municipio}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {filtroTipo === 'propuestas' && (
            <div className="w-48">
              <Label className="text-slate-600">Estado</Label>
              <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendiente">⏳ Pendientes</SelectItem>
                  <SelectItem value="aprobada">✅ Aprobadas</SelectItem>
                  <SelectItem value="rechazada">❌ Rechazadas</SelectItem>
                  <SelectItem value="subsanacion">🔄 En Subsanación</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          <Button onClick={filtroTipo === 'propuestas' ? fetchPropuestas : fetchPrediosSinCambios} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          
          {filtroTipo === 'propuestas' && filtroEstado === 'pendiente' && seleccionadas.length > 0 && (
            <Button 
              onClick={handleAprobarMasivo}
              disabled={procesando}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {procesando ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Aprobar Masivo ({seleccionadas.length})
            </Button>
          )}
          
          {filtroTipo === 'sin_cambios' && seleccionadasSinCambios.length > 0 && (
            <Button 
              onClick={handleAprobarMasivoSinCambios}
              disabled={procesando}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {procesando ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Aprobar Masivo ({seleccionadasSinCambios.length})
            </Button>
          )}
        </div>
      </div>
      
      {/* Tabla de Propuestas de Cambio */}
      {filtroTipo === 'propuestas' && (
        <div className="bg-white rounded-lg border overflow-hidden shadow-sm mb-6">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
              <p className="text-slate-500 mt-2">Cargando propuestas...</p>
            </div>
          ) : propuestas.length === 0 ? (
            <div className="p-12 text-center">
              <GitCompare className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 text-lg">
                No hay propuestas {
                  filtroEstado === 'pendiente' ? 'pendientes' : 
                  filtroEstado === 'aprobada' ? 'aprobadas' : 
                  filtroEstado === 'subsanacion' ? 'en subsanación' :
                  'rechazadas'
                }
              </p>
              {filtroEstado === 'pendiente' && (
                <p className="text-sm text-slate-400 mt-2">
                  Las propuestas de cambio de los gestores aparecerán aquí
                </p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  {filtroEstado === 'pendiente' && (
                    <TableHead className="w-12">
                      <button onClick={toggleSeleccionarTodas} className="p-1 hover:bg-slate-200 rounded">
                        {seleccionadas.length === propuestas.length ? (
                          <CheckSquare className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-400" />
                        )}
                      </button>
                    </TableHead>
                  )}
                  <TableHead>Código Predial</TableHead>
                  <TableHead>Municipio</TableHead>
                  <TableHead>Justificación</TableHead>
                  <TableHead>Gestor</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Tipo Revisión</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {propuestas.map((propuesta) => (
                  <TableRow key={propuesta.id} className="hover:bg-slate-50">
                    {filtroEstado === 'pendiente' && (
                      <TableCell>
                        <button onClick={() => toggleSeleccion(propuesta.id)} className="p-1 hover:bg-slate-200 rounded">
                          {seleccionadas.includes(propuesta.id) ? (
                            <CheckSquare className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-400" />
                          )}
                        </button>
                      </TableCell>
                    )}
                    <TableCell className="font-mono text-xs">{propuesta.codigo_predial}</TableCell>
                    <TableCell className="text-sm">{propuesta.municipio || proyectoActual?.municipio || '-'}</TableCell>
                    <TableCell className="max-w-xs">
                      <p className="truncate text-sm text-slate-600">
                        {propuesta.justificacion || propuesta.motivo || '-'}
                      </p>
                      {propuesta.tipo === 'cancelacion' && (
                        <Badge className="mt-1 bg-red-100 text-red-600 text-xs">Eliminación</Badge>
                      )}
                      {propuesta.tipo === 'predio_nuevo' && (
                        <Badge className="mt-1 bg-blue-100 text-blue-600 text-xs">Predio Nuevo</Badge>
                      )}
                      {propuesta.tipo === 'mejora_nueva' && (
                        <Badge className="mt-1 bg-cyan-100 text-cyan-600 text-xs">Mejora Nueva</Badge>
                      )}
                      {propuesta.tipo === 'cambio' && (
                        <Badge className="mt-1 bg-purple-100 text-purple-600 text-xs">Cambio</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {propuesta.creado_por_nombre || propuesta.propuesto_por_nombre || propuesta.creado_por || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {new Date(propuesta.creado_en).toLocaleDateString('es-CO')}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline"
                        className={
                          propuesta.estado === 'aprobada' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' :
                          propuesta.estado === 'rechazada' ? 'bg-red-100 text-red-700 border-red-300' :
                          propuesta.estado === 'subsanacion' ? 'bg-orange-100 text-orange-700 border-orange-300' :
                          'bg-amber-100 text-amber-700 border-amber-300'
                        }
                      >
                        {propuesta.estado === 'subsanacion' ? 'En subsanación' : propuesta.estado}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline"
                        className={
                          propuesta.tipo_revision === 'campo' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          propuesta.tipo_revision === 'juridico' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          propuesta.tipo_revision === 'calidad' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-slate-50 text-slate-600 border-slate-200'
                        }
                      >
                        {propuesta.tipo_revision_nombre || propuesta.tipo_revision || 'Campo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => verDetalle(propuesta)} title="Ver detalle">
                          <Eye className="w-4 h-4" />
                        </Button>
                        {(propuesta.estado === 'pendiente' || propuesta.estado === 'reenviada') && (
                          <>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              onClick={() => handleAprobar(propuesta.id)}
                              title="Aprobar"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => verDetalle(propuesta)}
                              title="Rechazar"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
      
      {/* Vista de Predios Sin Cambios */}
      {filtroTipo === 'sin_cambios' && (
        <div className="bg-white rounded-lg border overflow-hidden shadow-sm mb-6">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600" />
              <p className="text-slate-500 mt-2">Cargando predios sin cambios...</p>
            </div>
          ) : prediosSinCambios.length === 0 ? (
            <div className="p-12 text-center">
              <CheckSquare className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 text-lg">No hay predios sin cambios pendientes</p>
              <p className="text-sm text-slate-400 mt-2">
                Los predios visitados sin modificaciones aparecerán aquí para su aprobación
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-blue-50">
                <TableRow>
                  <TableHead className="w-12">
                    <button onClick={toggleSeleccionarTodasSinCambios} className="p-1 hover:bg-blue-200 rounded">
                      {seleccionadasSinCambios.length === prediosSinCambios.length ? (
                        <CheckSquare className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-400" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead>Código Predial</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>Visitado Por</TableHead>
                  <TableHead>Fecha Visita</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prediosSinCambios.map((predio) => (
                  <TableRow key={predio.codigo_predial || predio.numero_predial} className="hover:bg-blue-50">
                    <TableCell>
                      <button 
                        onClick={() => toggleSeleccionSinCambios(predio.codigo_predial || predio.numero_predial)} 
                        className="p-1 hover:bg-blue-200 rounded"
                      >
                        {seleccionadasSinCambios.includes(predio.codigo_predial || predio.numero_predial) ? (
                          <CheckSquare className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-400" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{predio.codigo_predial || predio.numero_predial}</TableCell>
                    <TableCell className="text-sm">{predio.direccion || '-'}</TableCell>
                    <TableCell className="text-sm">{predio.visitado_por || '-'}</TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {predio.visitado_en ? new Date(predio.visitado_en).toLocaleDateString('es-CO') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        size="sm" 
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={() => handleAprobarSinCambios(predio.codigo_predial || predio.numero_predial)}
                        disabled={procesando}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Aprobar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
      
      {/* Modal de detalle con vista comparativa */}
      <Dialog open={showDetalleModal} onOpenChange={(open) => {
        setShowDetalleModal(open);
        if (!open) {
          setModoEdicion(false);
          setDatosEditados({});
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-emerald-600" />
              Propuesta de Modificación de Campo
              {propuestaDetalle?.estado === 'pendiente' && (
                <Badge className="ml-2 bg-amber-100 text-amber-700">Pendiente de revisión</Badge>
              )}
              {propuestaDetalle?.estado === 'reenviada' && (
                <Badge className="ml-2 bg-blue-100 text-blue-700">Reenviada (subsanada)</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {propuestaDetalle && (
            <div className="space-y-5">
              {/* Header del predio */}
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-4 rounded-xl border border-emerald-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-emerald-600 uppercase font-semibold tracking-wider">Código Predial</p>
                    <p className="font-mono text-lg font-bold text-emerald-800">
                      {propuestaDetalle.codigo_predial}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Municipio</p>
                    <p className="font-medium text-slate-700">{propuestaDetalle.municipio || proyectoActual?.municipio}</p>
                  </div>
                </div>
                {/* Mostrar tipo de propuesta */}
                <div className="mt-3 pt-3 border-t border-emerald-200">
                  <Badge className={propuestaDetalle.tipo === 'cancelacion' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}>
                    {propuestaDetalle.tipo === 'cancelacion' ? 'Solicitud de Eliminación' : 'Propuesta de Modificación'}
                  </Badge>
                </div>
              </div>
              
              {/* Si es propuesta de cancelación, mostrar datos específicos */}
              {propuestaDetalle.tipo === 'cancelacion' ? (
                <div className="space-y-4">
                  <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                    <h4 className="font-semibold text-red-800 flex items-center gap-2 mb-3">
                      <AlertCircle className="w-4 h-4" />
                      Solicitud de Eliminación de Predio
                    </h4>
                    <div className="space-y-2 text-sm">
                      <p><strong>Motivo:</strong> {propuestaDetalle.motivo || 'No especificado'}</p>
                      <p><strong>Solicitado por:</strong> {propuestaDetalle.propuesto_por_nombre || propuestaDetalle.creado_por_nombre || propuestaDetalle.creado_por || 'No especificado'}</p>
                      <p><strong>Fecha:</strong> {propuestaDetalle.creado_en ? new Date(propuestaDetalle.creado_en).toLocaleString('es-CO') : 'No especificada'}</p>
                    </div>
                  </div>
                  
                  {/* Datos del predio a eliminar */}
                  {propuestaDetalle.datos_predio && (
                    <div className="bg-slate-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-slate-700 mb-3">Datos del Predio</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-slate-500">Dirección:</span>
                          <p className="font-medium">{propuestaDetalle.datos_predio.direccion || '-'}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Área Terreno:</span>
                          <p className="font-medium">{propuestaDetalle.datos_predio.area_terreno || 0} m²</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Estado Visita:</span>
                          <p className="font-medium">{propuestaDetalle.datos_predio.estado_visita || '-'}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Propietarios:</span>
                          <p className="font-medium">{propuestaDetalle.datos_predio.propietarios?.length || 0}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
              /* Vista comparativa de campos para propuestas de modificación */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                    <ArrowRight className="w-4 h-4" />
                    Comparación de Datos
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-400 rounded-full"></span> Modificado</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 bg-slate-300 rounded-full"></span> Sin cambios</span>
                  </div>
                </div>
                
                {/* Campos principales */}
                <div className="grid gap-2">
                  <CampoComparativo 
                    label="Dirección"
                    icon={MapPin}
                    valorAnterior={propuestaDetalle.datos_existentes?.direccion}
                    valorNuevo={modoEdicion ? datosEditados.direccion : propuestaDetalle.datos_propuestos?.direccion}
                  />
                  <CampoComparativo 
                    label="Destino Económico"
                    icon={Home}
                    valorAnterior={propuestaDetalle.datos_existentes?.destino_economico}
                    valorNuevo={modoEdicion ? datosEditados.destino_economico : propuestaDetalle.datos_propuestos?.destino_economico}
                  />
                  <CampoComparativo 
                    label="Área Terreno"
                    icon={Ruler}
                    tipo="area"
                    valorAnterior={propuestaDetalle.datos_existentes?.area_terreno}
                    valorNuevo={modoEdicion ? datosEditados.area_terreno : propuestaDetalle.datos_propuestos?.area_terreno}
                  />
                  <CampoComparativo 
                    label="Área Construida"
                    icon={Ruler}
                    tipo="area"
                    valorAnterior={propuestaDetalle.datos_existentes?.area_construida}
                    valorNuevo={modoEdicion ? datosEditados.area_construida : propuestaDetalle.datos_propuestos?.area_construida}
                  />
                  <CampoComparativo 
                    label="Avalúo"
                    icon={DollarSign}
                    tipo="moneda"
                    valorAnterior={propuestaDetalle.datos_existentes?.avaluo}
                    valorNuevo={modoEdicion ? datosEditados.avaluo : propuestaDetalle.datos_propuestos?.avaluo}
                  />
                  <CampoComparativo 
                    label="Matrícula"
                    valorAnterior={propuestaDetalle.datos_existentes?.matricula}
                    valorNuevo={modoEdicion ? datosEditados.matricula : propuestaDetalle.datos_propuestos?.matricula}
                  />
                  <CampoComparativo 
                    label="Estrato"
                    valorAnterior={propuestaDetalle.datos_existentes?.estrato}
                    valorNuevo={modoEdicion ? datosEditados.estrato : propuestaDetalle.datos_propuestos?.estrato}
                  />
                </div>
                
                {/* Propietarios */}
                <PropietariosComparativos 
                  anteriores={propuestaDetalle.datos_existentes?.propietarios || []}
                  nuevos={modoEdicion ? (datosEditados.propietarios || []) : (propuestaDetalle.datos_propuestos?.propietarios || [])}
                />
              </div>
              )}
              
              {/* Formulario de edición (si está activo) */}
              {modoEdicion && (propuestaDetalle.estado === 'pendiente' || propuestaDetalle.estado === 'reenviada') && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-700 mb-3 flex items-center gap-2">
                    <Edit className="w-4 h-4" />
                    Editar datos antes de aprobar
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Dirección</Label>
                      <Input 
                        value={datosEditados.direccion || ''} 
                        onChange={(e) => setDatosEditados({...datosEditados, direccion: e.target.value.toUpperCase()})}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Destino Económico</Label>
                      <Select 
                        value={datosEditados.destino_economico || ''} 
                        onValueChange={(v) => setDatosEditados({...datosEditados, destino_economico: v})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A">A - Habitacional</SelectItem>
                          <SelectItem value="B">B - Industrial</SelectItem>
                          <SelectItem value="C">C - Comercial</SelectItem>
                          <SelectItem value="D">D - Agropecuario</SelectItem>
                          <SelectItem value="E">E - Minero</SelectItem>
                          <SelectItem value="F">F - Cultural</SelectItem>
                          <SelectItem value="G">G - Recreacional</SelectItem>
                          <SelectItem value="H">H - Salubridad</SelectItem>
                          <SelectItem value="I">I - Institucional</SelectItem>
                          <SelectItem value="J">J - Educativo</SelectItem>
                          <SelectItem value="K">K - Religioso</SelectItem>
                          <SelectItem value="L">L - Agrícola</SelectItem>
                          <SelectItem value="M">M - Pecuario</SelectItem>
                          <SelectItem value="N">N - Agroindustrial</SelectItem>
                          <SelectItem value="O">O - Forestal</SelectItem>
                          <SelectItem value="P">P - Uso Público</SelectItem>
                          <SelectItem value="Q">Q - Lote Urbanizable No Urbanizado</SelectItem>
                          <SelectItem value="R">R - Lote Urbanizado No Edificado</SelectItem>
                          <SelectItem value="S">S - Lote No Urbanizable</SelectItem>
                          <SelectItem value="T">T - Servicios Especiales</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Área Terreno (m²)</Label>
                      <Input 
                        type="number" 
                        value={datosEditados.area_terreno || ''} 
                        onChange={(e) => setDatosEditados({...datosEditados, area_terreno: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Área Construida (m²)</Label>
                      <Input 
                        type="number" 
                        value={datosEditados.area_construida || ''} 
                        onChange={(e) => setDatosEditados({...datosEditados, area_construida: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Avalúo</Label>
                      <Input 
                        type="number" 
                        value={datosEditados.avaluo || ''} 
                        onChange={(e) => setDatosEditados({...datosEditados, avaluo: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Matrícula Inmobiliaria</Label>
                      <Input 
                        value={datosEditados.matricula || ''} 
                        onChange={(e) => setDatosEditados({...datosEditados, matricula: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              )}
              
              {/* Justificación del gestor - solo para propuestas de modificación */}
              {propuestaDetalle.tipo !== 'cancelacion' && (
              <div className="bg-slate-50 rounded-lg p-4">
                <Label className="text-slate-600 text-sm">Justificación del Gestor</Label>
                <p className="mt-2 text-sm text-slate-700 italic">&ldquo;{propuestaDetalle.justificacion || 'Sin justificación'}&rdquo;</p>
                <div className="flex justify-between mt-3 text-xs text-slate-500">
                  <span>Enviado por: <strong>{propuestaDetalle.creado_por_nombre || propuestaDetalle.propuesto_por_nombre || propuestaDetalle.creado_por || '-'}</strong></span>
                  <span>{propuestaDetalle.creado_en ? new Date(propuestaDetalle.creado_en).toLocaleString('es-CO') : '-'}</span>
                </div>
              </div>
              )}
              
              {/* Si ya fue revisada (excluir pendiente y reenviada que aún pueden ser accionadas) */}
              {propuestaDetalle.estado !== 'pendiente' && propuestaDetalle.estado !== 'reenviada' && (
                <div className={`p-4 rounded-lg ${
                  propuestaDetalle.estado === 'aprobada' ? 'bg-emerald-50 border border-emerald-200' : 
                  propuestaDetalle.estado === 'subsanacion' ? 'bg-orange-50 border border-orange-200' :
                  'bg-red-50 border border-red-200'
                }`}>
                  <p className="font-medium flex items-center gap-2">
                    {propuestaDetalle.estado === 'aprobada' && <Check className="w-4 h-4 text-emerald-600" />}
                    {propuestaDetalle.estado === 'rechazada' && <X className="w-4 h-4 text-red-600" />}
                    {propuestaDetalle.estado === 'subsanacion' && <Send className="w-4 h-4 text-orange-600" />}
                    {propuestaDetalle.estado === 'aprobada' ? 'Aprobada' : 
                     propuestaDetalle.estado === 'subsanacion' ? 'Enviada a subsanación del gestor' : 'Rechazada'} 
                    por {propuestaDetalle.revisado_por}
                  </p>
                  {propuestaDetalle.comentario_revision && (
                    <p className="text-sm mt-2 italic">&ldquo;{propuestaDetalle.comentario_revision}&rdquo;</p>
                  )}
                  <p className="text-xs text-slate-500 mt-2">
                    {new Date(propuestaDetalle.revisado_en).toLocaleString('es-CO')}
                  </p>
                </div>
              )}
              
              {/* Acciones si está pendiente o reenviada */}
              {(propuestaDetalle.estado === 'pendiente' || propuestaDetalle.estado === 'reenviada') && (
                <>
                  <div>
                    <Label className="text-slate-600">Comentario de Revisión {!modoEdicion && '(requerido para rechazar)'}</Label>
                    <Textarea
                      value={comentarioRevision}
                      onChange={(e) => setComentarioRevision(e.target.value)}
                      placeholder="Escriba un comentario sobre su decisión..."
                      rows={2}
                      className="mt-1"
                    />
                  </div>
                  
                  <div className="bg-amber-50 text-amber-700 p-3 rounded-lg text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>
                      Al <strong>rechazar</strong>, la propuesta se enviará al gestor para su subsanación.
                      Al <strong>aprobar</strong>, los cambios se aplicarán al predio.
                    </span>
                  </div>
                  
                  <DialogFooter className="flex gap-2 pt-2">
                    {!modoEdicion && (
                      <Button 
                        variant="outline" 
                        onClick={activarEdicion}
                        className="border-blue-400 text-blue-700 hover:bg-blue-50"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Editar antes de aprobar
                      </Button>
                    )}
                    
                    <Button 
                      variant="outline" 
                      onClick={() => handleRechazar(propuestaDetalle.id)}
                      disabled={procesando || !comentarioRevision.trim()}
                      className="flex-1 border-red-400 text-red-700 hover:bg-red-50"
                    >
                      {procesando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4 mr-2" />}
                      Rechazar
                    </Button>
                    
                    <Button 
                      onClick={() => handleAprobar(propuestaDetalle.id)}
                      disabled={procesando}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    >
                      {procesando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                      {modoEdicion ? 'Aprobar con cambios' : 'Aprobar'}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
