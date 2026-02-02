import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Clock, CheckCircle, XCircle, Building, User, MapPin, 
  FileText, Eye, Loader2, AlertTriangle, ArrowRight, Edit, RefreshCw, History, ChevronDown, ChevronUp, Filter, X, Calendar
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Helper para formatear fecha
const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
};

// Configuración de estados para predios nuevos
const estadoPredioConfig = {
  creado: { color: 'bg-blue-100 text-blue-800 border-blue-300', label: 'Creado', icon: FileText },
  digitalizacion: { color: 'bg-amber-100 text-amber-800 border-amber-300', label: 'En Digitalización', icon: Edit },
  revision: { color: 'bg-purple-100 text-purple-800 border-purple-300', label: 'En Revisión', icon: Eye },
  aprobado: { color: 'bg-emerald-100 text-emerald-800 border-emerald-300', label: 'Aprobado', icon: CheckCircle },
  devuelto: { color: 'bg-orange-100 text-orange-800 border-orange-300', label: 'Devuelto', icon: RefreshCw },
  rechazado: { color: 'bg-red-100 text-red-800 border-red-300', label: 'Rechazado', icon: XCircle },
};

export default function Pendientes() {
  const { user } = useAuth();
  const { addListener } = useWebSocket() || {};
  const [cambiosPendientes, setCambiosPendientes] = useState([]);
  const [prediosNuevos, setPrediosNuevos] = useState([]);
  const [cambiosHistorial, setCambiosHistorial] = useState([]);
  const [historialStats, setHistorialStats] = useState({ aprobados: 0, rechazados: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingPredios, setLoadingPredios] = useState(true);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [selectedCambio, setSelectedCambio] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [activeTab, setActiveTab] = useState('modificaciones');
  
  // Filtros para historial
  const [historialFiltros, setHistorialFiltros] = useState({
    estado: '', // 'aprobado', 'rechazado', '' (todos)
    tipo_cambio: '', // 'creacion', 'modificacion', 'eliminacion', ''
    municipio: '',
    fecha_desde: '',
    fecha_hasta: ''
  });
  const [municipiosHistorial, setMunicipiosHistorial] = useState([]);
  
  // Estados para predios nuevos
  const [selectedPredioNuevo, setSelectedPredioNuevo] = useState(null);
  const [showPredioDetailDialog, setShowPredioDetailDialog] = useState(false);
  const [showPredioActionDialog, setShowPredioActionDialog] = useState(false);
  const [predioActionType, setPredioActionType] = useState('');
  const [predioObservaciones, setPredioObservaciones] = useState('');
  const [expandedHistorial, setExpandedHistorial] = useState({});
  
  // Estados para reapariciones
  const [reapariciones, setReapariciones] = useState([]);
  const [loadingReapariciones, setLoadingReapariciones] = useState(false);
  const [selectedReaparicion, setSelectedReaparicion] = useState(null);
  const [showReaparicionModal, setShowReaparicionModal] = useState(false);
  const [justificacionReaparicion, setJustificacionReaparicion] = useState('');
  const [procesandoReaparicion, setProcesandoReaparicion] = useState(null);
  
  // Estados para el modal de rechazo
  const [showRechazarModal, setShowRechazarModal] = useState(false);
  const [cambioArechazar, setCambioArechazar] = useState(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  
  // Verificar si puede aprobar cambios (coordinador, admin, o gestor con permiso)
  const userPermissions = user?.permissions || [];
  const hasApprovePermission = userPermissions.includes('approve_changes');
  const isCoordinador = user && (
    ['coordinador', 'administrador'].includes(user.role) || hasApprovePermission
  );

  useEffect(() => {
    fetchPendientes();
    fetchPrediosNuevos();
    fetchHistorialStats();
    fetchReapariciones();
  }, []);

  // Cargar historial cuando se selecciona el tab
  useEffect(() => {
    if (activeTab === 'historial' && cambiosHistorial.length === 0) {
      fetchHistorial();
    }
  }, [activeTab]);

  // WebSocket listener for real-time updates
  useEffect(() => {
    if (!addListener) return;
    
    const handleMessage = (message) => {
      if (message.type === 'cambio_predio') {
        // Refresh data when a change is approved/rejected
        fetchPendientes();
        fetchHistorialStats();
        if (activeTab === 'historial') {
          fetchHistorial();
        }
      }
    };
    
    return addListener(handleMessage);
  }, [addListener, activeTab]);

  const fetchHistorialStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios/cambios/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistorialStats({
        aprobados: res.data.historial_aprobados || 0,
        rechazados: res.data.historial_rechazados || 0,
        total: res.data.total_historial || 0
      });
    } catch (error) {
      console.log('Error cargando stats de historial');
    }
  };

  const fetchHistorial = async (filtros = historialFiltros) => {
    setLoadingHistorial(true);
    try {
      const token = localStorage.getItem('token');
      
      // Construir query params con filtros
      const params = new URLSearchParams();
      params.append('limit', '100');
      if (filtros.estado) params.append('estado', filtros.estado);
      if (filtros.tipo_cambio) params.append('tipo_cambio', filtros.tipo_cambio);
      if (filtros.municipio) params.append('municipio', filtros.municipio);
      if (filtros.fecha_desde) params.append('fecha_desde', filtros.fecha_desde);
      if (filtros.fecha_hasta) params.append('fecha_hasta', filtros.fecha_hasta);
      
      const res = await axios.get(`${API}/predios/cambios/historial?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCambiosHistorial(res.data.cambios || []);
      
      // Extraer municipios únicos para el selector
      if (res.data.municipios) {
        setMunicipiosHistorial(res.data.municipios);
      }
    } catch (error) {
      console.error('Error cargando historial:', error);
      setCambiosHistorial([]);
    } finally {
      setLoadingHistorial(false);
    }
  };

  // Aplicar filtros al historial
  const aplicarFiltrosHistorial = () => {
    fetchHistorial(historialFiltros);
  };

  // Limpiar filtros
  const limpiarFiltrosHistorial = () => {
    const filtrosLimpios = {
      estado: '',
      tipo_cambio: '',
      municipio: '',
      fecha_desde: '',
      fecha_hasta: ''
    };
    setHistorialFiltros(filtrosLimpios);
    fetchHistorial(filtrosLimpios);
  };

  const fetchPrediosNuevos = async () => {
    setLoadingPredios(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios-nuevos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPrediosNuevos(res.data.predios || res.data || []);
    } catch (error) {
      console.error('Error cargando predios nuevos:', error);
      setPrediosNuevos([]);
    } finally {
      setLoadingPredios(false);
    }
  };

  const handlePredioAction = async () => {
    if (!selectedPredioNuevo || !predioActionType) return;
    
    if (['devolver', 'rechazar'].includes(predioActionType) && !predioObservaciones.trim()) {
      toast.error('Debe ingresar observaciones para esta acción');
      return;
    }
    
    setProcesando(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/predios-nuevos/${selectedPredioNuevo.id}/accion`, {
        accion: predioActionType,
        observaciones: predioObservaciones.trim() || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const mensajes = {
        enviar_revision: 'Predio enviado a revisión',
        aprobar: 'Predio aprobado e integrado al sistema',
        devolver: 'Predio devuelto para correcciones',
        rechazar: 'Predio rechazado'
      };
      
      toast.success(mensajes[predioActionType] || 'Acción completada');
      setShowPredioActionDialog(false);
      setPredioObservaciones('');
      setPredioActionType('');
      fetchPrediosNuevos();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al procesar acción');
    } finally {
      setProcesando(false);
    }
  };

  const openPredioActionDialog = (predio, action) => {
    setSelectedPredioNuevo(predio);
    setPredioActionType(action);
    setShowPredioActionDialog(true);
  };

  const toggleHistorial = (predioId) => {
    setExpandedHistorial(prev => ({
      ...prev,
      [predioId]: !prev[predioId]
    }));
  };

  const fetchPendientes = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/predios/cambios/pendientes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = response.data;
      const cambios = data.cambios || (Array.isArray(data) ? data : []);
      setCambiosPendientes(cambios);
    } catch (error) {
      console.error('Error loading pending changes:', error);
      setCambiosPendientes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAprobar = async (cambioId) => {
    setProcesando(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/predios/cambios/aprobar`, 
        { cambio_id: cambioId, aprobado: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Cambio aprobado exitosamente');
      fetchPendientes();
      setSelectedCambio(null);
      
      // Emitir evento para actualizar el badge del menú
      window.dispatchEvent(new CustomEvent('pendientesUpdated'));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al aprobar cambio');
    } finally {
      setProcesando(false);
    }
  };

  const openRechazarModal = (cambio) => {
    setCambioArechazar(cambio);
    setMotivoRechazo('');
    setShowRechazarModal(true);
  };

  const handleConfirmarRechazo = async () => {
    if (!motivoRechazo.trim()) {
      toast.error('Debe indicar el motivo del rechazo');
      return;
    }
    
    setProcesando(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/predios/cambios/aprobar`, 
        { 
          cambio_id: cambioArechazar.id, 
          aprobado: false,
          comentario: motivoRechazo
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Cambio rechazado. Se notificó al gestor.');
      fetchPendientes();
      setSelectedCambio(null);
      setShowRechazarModal(false);
      setCambioArechazar(null);
      setMotivoRechazo('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al rechazar cambio');
    } finally {
      setProcesando(false);
    }
  };

  // === FUNCIONES PARA REAPARICIONES ===
  const fetchReapariciones = async () => {
    setLoadingReapariciones(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/predios/reapariciones/solicitudes-pendientes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReapariciones(response.data.solicitudes || []);
    } catch (error) {
      console.error('Error loading reapariciones:', error);
      setReapariciones([]);
    } finally {
      setLoadingReapariciones(false);
    }
  };

  const handleAprobarReaparicion = async (reaparicion) => {
    if (!justificacionReaparicion.trim()) {
      toast.error('Debe indicar una justificación para la aprobación');
      return;
    }
    
    setProcesandoReaparicion(reaparicion.codigo_predial_nacional);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('codigo_predial', reaparicion.codigo_predial_nacional);
      formData.append('municipio', reaparicion.municipio);
      formData.append('justificacion', justificacionReaparicion);
      
      await axios.post(`${API}/predios/reapariciones/aprobar`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Reaparición aprobada. El predio ha sido restaurado.');
      setShowReaparicionModal(false);
      setSelectedReaparicion(null);
      setJustificacionReaparicion('');
      fetchReapariciones();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al aprobar reaparición');
    } finally {
      setProcesandoReaparicion(null);
    }
  };

  const handleRechazarReaparicion = async (reaparicion) => {
    if (!justificacionReaparicion.trim()) {
      toast.error('Debe indicar el motivo del rechazo');
      return;
    }
    
    setProcesandoReaparicion(reaparicion.codigo_predial_nacional);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('codigo_predial', reaparicion.codigo_predial_nacional);
      formData.append('municipio', reaparicion.municipio);
      formData.append('justificacion', justificacionReaparicion);
      
      await axios.post(`${API}/predios/reapariciones/rechazar`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Solicitud de reaparición rechazada');
      setShowReaparicionModal(false);
      setSelectedReaparicion(null);
      setJustificacionReaparicion('');
      fetchReapariciones();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al rechazar reaparición');
    } finally {
      setProcesandoReaparicion(null);
    }
  };

  const openReaparicionModal = (reaparicion, action) => {
    setSelectedReaparicion({ ...reaparicion, action });
    setJustificacionReaparicion('');
    setShowReaparicionModal(true);
  };

  const getTipoCambioLabel = (tipo) => {
    const labels = {
      'creacion': 'Nuevo Predio',
      'actualizacion': 'Actualización',
      'modificacion': 'Modificación',
      'eliminacion': 'Eliminación'
    };
    return labels[tipo] || tipo;
  };

  const getTipoCambioColor = (tipo) => {
    const colors = {
      'creacion': 'bg-emerald-100 text-emerald-800',
      'actualizacion': 'bg-blue-100 text-blue-800',
      'modificacion': 'bg-amber-100 text-amber-800',
      'eliminacion': 'bg-red-100 text-red-800'
    };
    return colors[tipo] || 'bg-slate-100 text-slate-800';
  };

  // Función para comparar valores y detectar cambios - SOLO devuelve campos que realmente cambiaron
  const getFieldChanges = (cambio) => {
    const propuesto = cambio.datos_propuestos || {};
    const actual = cambio.predio_actual || {};
    
    // Campos a comparar
    const camposComparar = [
      { key: 'codigo_predial_nacional', label: 'Código Predial Nacional' },
      { key: 'municipio', label: 'Municipio' },
      { key: 'direccion', label: 'Dirección' },
      { key: 'nombre_propietario', label: 'Propietario' },
      { key: 'area_terreno', label: 'Área Terreno', format: (v) => v != null ? `${Number(v).toLocaleString()} m²` : null },
      { key: 'area_construida', label: 'Área Construida', format: (v) => v != null ? `${Number(v).toLocaleString()} m²` : null },
      { key: 'avaluo', label: 'Avalúo', format: (v) => v != null ? `$${Number(v).toLocaleString()}` : null },
      { key: 'destino_economico', label: 'Destino Económico' },
      { key: 'zona', label: 'Zona' },
    ];
    
    const cambios = [];
    
    for (const campo of camposComparar) {
      let valorActual = actual[campo.key];
      let valorPropuesto = propuesto[campo.key];
      
      // Manejar caso especial de propietarios (array)
      if (campo.key === 'nombre_propietario') {
        if (actual.propietarios && actual.propietarios.length > 0) {
          valorActual = actual.propietarios.map(p => p.nombre_propietario).join(', ');
        }
        if (propuesto.propietarios && propuesto.propietarios.length > 0) {
          valorPropuesto = propuesto.propietarios.map(p => p.nombre_propietario).join(', ');
        }
      }
      
      // IMPORTANTE: Solo incluir si el campo fue propuesto (existe en datos_propuestos)
      // y es diferente al valor actual
      const existeEnPropuesto = campo.key in propuesto || 
        (campo.key === 'nombre_propietario' && propuesto.propietarios);
      
      if (!existeEnPropuesto) continue; // No fue tocado, no mostrar
      
      // Verificar si realmente cambió
      const sonDiferentes = valorActual !== valorPropuesto;
      if (!sonDiferentes) continue; // Mismo valor, no mostrar
      
      const format = campo.format || ((v) => v);
      const actualFormatted = valorActual != null ? (format(valorActual) || valorActual) : 'Sin valor';
      const propuestoFormatted = valorPropuesto != null ? (format(valorPropuesto) || valorPropuesto) : 'Sin valor';
      
      cambios.push({
        label: campo.label,
        valorActual: actualFormatted,
        valorPropuesto: propuestoFormatted,
        hayCambio: true
      });
    }
    
    return cambios;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  // Contar predios nuevos en revisión (pendientes de aprobación)
  const prediosEnRevision = prediosNuevos.filter(p => p.estado === 'revision').length;
  const reaparicionesPendientes = reapariciones.length;
  const totalPendientes = cambiosPendientes.length + prediosEnRevision + reaparicionesPendientes;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-outfit">Pendientes de Aprobación</h1>
          <p className="text-slate-600 mt-1">Cambios, predios nuevos y reapariciones que requieren aprobación</p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          {totalPendientes} pendientes
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="modificaciones" className="flex items-center gap-2">
            <Edit className="w-4 h-4" />
            Modificaciones
            {cambiosPendientes.length > 0 && (
              <Badge variant="secondary" className="ml-1">{cambiosPendientes.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="predios-nuevos" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Predios Nuevos
            {prediosEnRevision > 0 && (
              <Badge variant="secondary" className="ml-1">{prediosEnRevision}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="reapariciones" className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Reapariciones
            {reaparicionesPendientes > 0 && (
              <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-800">{reaparicionesPendientes}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="historial" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Historial
            {historialStats.total > 0 && (
              <Badge variant="outline" className="ml-1">{historialStats.total}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab: Modificaciones */}
        <TabsContent value="modificaciones">
          {cambiosPendientes.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <CheckCircle className="w-16 h-16 mx-auto text-emerald-500 mb-4" />
                <h3 className="text-xl font-semibold text-slate-700">¡Todo al día!</h3>
                <p className="text-slate-500 mt-2">No hay modificaciones pendientes de aprobación</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {cambiosPendientes.map((cambio) => (
                <Card key={cambio.id} className="hover:border-emerald-300 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-slate-100 rounded-lg">
                          <Building className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={getTipoCambioColor(cambio.tipo_cambio)}>
                              {getTipoCambioLabel(cambio.tipo_cambio)}
                            </Badge>
                            {cambio.radicado_numero && (
                              <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                                <FileText className="w-3 h-3 mr-1" />
                                {cambio.radicado_numero}
                              </Badge>
                            )}
                            <span className="font-mono text-sm text-slate-600 break-all">
                              {cambio.datos_propuestos?.codigo_predial_nacional || 'Nuevo'}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 mt-1">
                            {cambio.datos_propuestos?.municipio || 'N/A'} · 
                            Solicitado por: {cambio.propuesto_por_nombre || 'N/A'}
                          </p>
                          {!cambio.radicado_numero && cambio.tipo_cambio === 'modificacion' && (
                            <p className="text-xs text-amber-600 mt-1">
                              ⚠️ Sin radicado asociado
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedCambio(cambio)}
                          data-testid={`view-cambio-${cambio.id}`}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Ver Detalle
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => openRechazarModal(cambio)}
                          disabled={procesando}
                          data-testid={`reject-cambio-${cambio.id}`}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Rechazar
                        </Button>
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => handleAprobar(cambio.id)}
                          disabled={procesando}
                          data-testid={`approve-cambio-${cambio.id}`}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Aprobar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab: Predios Nuevos */}
        <TabsContent value="predios-nuevos">
          {loadingPredios ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
          ) : prediosNuevos.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <CheckCircle className="w-16 h-16 mx-auto text-emerald-500 mb-4" />
                <h3 className="text-xl font-semibold text-slate-700">¡Todo al día!</h3>
                <p className="text-slate-500 mt-2">No hay predios nuevos en proceso</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {prediosNuevos.map((predio) => {
                const estadoInfo = estadoPredioConfig[predio.estado] || estadoPredioConfig.creado;
                const EstadoIcon = estadoInfo.icon;
                
                return (
                  <Card key={predio.id} className="hover:border-emerald-300 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-slate-100 rounded-lg">
                            <EstadoIcon className="w-5 h-5 text-slate-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge className={estadoInfo.color}>
                                {estadoInfo.label}
                              </Badge>
                              <span className="font-mono text-sm text-slate-600 break-all">
                                {predio.datos_predio?.codigo_predial_nacional || 'Nuevo'}
                              </span>
                            </div>
                            <p className="text-sm text-slate-500 mt-1">
                              {predio.datos_predio?.municipio || 'N/A'} · 
                              Creado por: {predio.creado_por_nombre || 'N/A'} · 
                              {formatDate(predio.fecha_creacion)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedPredioNuevo(predio);
                              setShowPredioDetailDialog(true);
                            }}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Ver Detalle
                          </Button>
                          
                          {/* Acciones según estado y rol */}
                          {predio.estado === 'digitalizacion' && (
                            <Button
                              size="sm"
                              className="bg-purple-600 hover:bg-purple-700 text-white"
                              onClick={() => openPredioActionDialog(predio, 'enviar_revision')}
                              disabled={procesando}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Enviar a Revisión
                            </Button>
                          )}
                          
                          {predio.estado === 'revision' && isCoordinador && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-orange-600 border-orange-200 hover:bg-orange-50"
                                onClick={() => openPredioActionDialog(predio, 'devolver')}
                                disabled={procesando}
                              >
                                <RefreshCw className="w-4 h-4 mr-1" />
                                Devolver
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => openPredioActionDialog(predio, 'rechazar')}
                                disabled={procesando}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Rechazar
                              </Button>
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => openPredioActionDialog(predio, 'aprobar')}
                                disabled={procesando}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Aprobar
                              </Button>
                            </>
                          )}
                          
                          {predio.estado === 'devuelto' && (
                            <Badge variant="outline" className="text-orange-600 border-orange-300">
                              Pendiente corrección
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {/* Historial colapsable */}
                      {predio.historial && predio.historial.length > 0 && (
                        <div className="mt-3 border-t pt-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-600 p-0 h-auto"
                            onClick={() => toggleHistorial(predio.id)}
                          >
                            <History className="w-4 h-4 mr-1" />
                            Historial ({predio.historial.length})
                            {expandedHistorial[predio.id] ? (
                              <ChevronUp className="w-4 h-4 ml-1" />
                            ) : (
                              <ChevronDown className="w-4 h-4 ml-1" />
                            )}
                          </Button>
                          
                          {expandedHistorial[predio.id] && (
                            <div className="mt-2 space-y-2 pl-5 border-l-2 border-slate-200">
                              {predio.historial.map((item, idx) => (
                                <div key={idx} className="text-sm">
                                  <span className="text-slate-400">{formatDate(item.fecha)}</span>
                                  <span className="mx-2">·</span>
                                  <span className="font-medium">{item.accion}</span>
                                  {item.usuario_nombre && (
                                    <span className="text-slate-500"> por {item.usuario_nombre}</span>
                                  )}
                                  {item.observaciones && (
                                    <p className="text-slate-500 italic mt-1">"{item.observaciones}"</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tab: Historial de Cambios Procesados */}
        <TabsContent value="historial">
          {/* Filtros del Historial */}
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="w-4 h-4 text-slate-500" />
                <span className="font-medium text-slate-700">Filtros</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Estado */}
                <div>
                  <Label className="text-xs text-slate-500 mb-1 block">Estado</Label>
                  <select 
                    value={historialFiltros.estado}
                    onChange={(e) => setHistorialFiltros({...historialFiltros, estado: e.target.value})}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Todos</option>
                    <option value="aprobado">Aprobados</option>
                    <option value="rechazado">Rechazados</option>
                  </select>
                </div>
                
                {/* Tipo de Cambio */}
                <div>
                  <Label className="text-xs text-slate-500 mb-1 block">Tipo</Label>
                  <select 
                    value={historialFiltros.tipo_cambio}
                    onChange={(e) => setHistorialFiltros({...historialFiltros, tipo_cambio: e.target.value})}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Todos</option>
                    <option value="creacion">Creación</option>
                    <option value="modificacion">Modificación</option>
                    <option value="eliminacion">Eliminación</option>
                  </select>
                </div>
                
                {/* Municipio */}
                <div>
                  <Label className="text-xs text-slate-500 mb-1 block">Municipio</Label>
                  <select 
                    value={historialFiltros.municipio}
                    onChange={(e) => setHistorialFiltros({...historialFiltros, municipio: e.target.value})}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Todos</option>
                    {municipiosHistorial.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                
                {/* Fecha Desde */}
                <div>
                  <Label className="text-xs text-slate-500 mb-1 block">Desde</Label>
                  <Input 
                    type="date"
                    value={historialFiltros.fecha_desde}
                    onChange={(e) => setHistorialFiltros({...historialFiltros, fecha_desde: e.target.value})}
                    className="text-sm"
                  />
                </div>
                
                {/* Fecha Hasta */}
                <div>
                  <Label className="text-xs text-slate-500 mb-1 block">Hasta</Label>
                  <Input 
                    type="date"
                    value={historialFiltros.fecha_hasta}
                    onChange={(e) => setHistorialFiltros({...historialFiltros, fecha_hasta: e.target.value})}
                    className="text-sm"
                  />
                </div>
              </div>
              
              <div className="flex gap-2 mt-3 justify-end">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={limpiarFiltrosHistorial}
                  className="text-slate-600"
                >
                  <X className="w-4 h-4 mr-1" />
                  Limpiar
                </Button>
                <Button 
                  size="sm"
                  onClick={aplicarFiltrosHistorial}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Filter className="w-4 h-4 mr-1" />
                  Aplicar Filtros
                </Button>
              </div>
            </CardContent>
          </Card>

          {loadingHistorial ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
          ) : cambiosHistorial.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <History className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-xl font-semibold text-slate-700">Sin resultados</h3>
                <p className="text-slate-500 mt-2">
                  {(historialFiltros.estado || historialFiltros.tipo_cambio || historialFiltros.municipio || historialFiltros.fecha_desde || historialFiltros.fecha_hasta)
                    ? 'No hay cambios que coincidan con los filtros seleccionados'
                    : 'No hay cambios procesados aún'
                  }
                </p>
                {(historialFiltros.estado || historialFiltros.tipo_cambio || historialFiltros.municipio || historialFiltros.fecha_desde || historialFiltros.fecha_hasta) && (
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={limpiarFiltrosHistorial}
                  >
                    Limpiar filtros
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Stats del historial */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-emerald-50 border-emerald-200">
                  <CardContent className="p-4 text-center">
                    <CheckCircle className="w-8 h-8 mx-auto text-emerald-600 mb-2" />
                    <p className="text-2xl font-bold text-emerald-700">{historialStats.aprobados}</p>
                    <p className="text-sm text-emerald-600">Aprobados</p>
                  </CardContent>
                </Card>
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="p-4 text-center">
                    <XCircle className="w-8 h-8 mx-auto text-red-600 mb-2" />
                    <p className="text-2xl font-bold text-red-700">{historialStats.rechazados}</p>
                    <p className="text-sm text-red-600">Rechazados</p>
                  </CardContent>
                </Card>
              </div>

              {/* Contador de resultados filtrados */}
              <div className="text-sm text-slate-500 text-right">
                Mostrando {cambiosHistorial.length} resultados
              </div>

              {/* Lista de cambios procesados */}
              <div className="space-y-3">
                {cambiosHistorial.map((cambio) => {
                  // Obtener el CNP de la fuente disponible
                  const cnp = cambio.predio_actual?.codigo_predial_nacional || 
                              cambio.datos_propuestos?.codigo_predial_nacional ||
                              cambio.codigo_predial_nacional ||
                              'N/A';
                  const propietario = cambio.predio_actual?.nombre_propietario || 
                                      cambio.datos_propuestos?.nombre_propietario ||
                                      (cambio.datos_propuestos?.propietarios?.[0]?.nombre_propietario);
                  const municipio = cambio.predio_actual?.municipio || 
                                    cambio.datos_propuestos?.municipio;
                  
                  return (
                  <Card 
                    key={cambio.id} 
                    className={`border-l-4 ${
                      cambio.estado === 'aprobado' 
                        ? 'border-l-emerald-500 bg-emerald-50/30' 
                        : 'border-l-red-500 bg-red-50/30'
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={cambio.estado === 'aprobado' ? 'bg-emerald-600' : 'bg-red-600'}>
                              {cambio.estado === 'aprobado' ? '✓ Aprobado' : '✗ Rechazado'}
                            </Badge>
                            <Badge variant="outline">
                              {cambio.tipo_cambio === 'creacion' ? 'Creación' : 
                               cambio.tipo_cambio === 'modificacion' ? 'Modificación' : 'Eliminación'}
                            </Badge>
                            {municipio && (
                              <Badge variant="secondary" className="text-xs">
                                {municipio}
                              </Badge>
                            )}
                          </div>
                          
                          {/* CNP del predio */}
                          <p className="font-mono text-sm text-slate-700 mb-1">
                            <strong>{cnp}</strong>
                            {propietario && ` - ${propietario}`}
                          </p>
                          
                          {/* Resumen de cambios para modificaciones */}
                          {cambio.tipo_cambio === 'modificacion' && cambio.datos_propuestos && (
                            <div className="mt-2 text-xs bg-slate-100 p-2 rounded">
                              <p className="font-semibold text-slate-600 mb-1">Campos modificados:</p>
                              <div className="flex flex-wrap gap-1">
                                {cambio.datos_propuestos.area_terreno !== undefined && (
                                  <Badge variant="outline" className="text-xs">Área Terreno</Badge>
                                )}
                                {cambio.datos_propuestos.area_construida !== undefined && (
                                  <Badge variant="outline" className="text-xs">Área Construida</Badge>
                                )}
                                {cambio.datos_propuestos.avaluo !== undefined && (
                                  <Badge variant="outline" className="text-xs">Avalúo</Badge>
                                )}
                                {cambio.datos_propuestos.destino_economico !== undefined && (
                                  <Badge variant="outline" className="text-xs">Destino Económico</Badge>
                                )}
                                {cambio.datos_propuestos.direccion !== undefined && (
                                  <Badge variant="outline" className="text-xs">Dirección</Badge>
                                )}
                                {cambio.datos_propuestos.propietarios !== undefined && (
                                  <Badge variant="outline" className="text-xs">Propietarios</Badge>
                                )}
                                {cambio.datos_propuestos.zona !== undefined && (
                                  <Badge variant="outline" className="text-xs">Zona</Badge>
                                )}
                              </div>
                            </div>
                          )}
                          
                          <p className="text-sm text-slate-600 mt-2">
                            <User className="w-3 h-3 inline mr-1" />
                            Solicitado por: <span className="font-medium">{cambio.propuesto_por_nombre}</span>
                          </p>
                          
                          {cambio.comentario_aprobacion && (
                            <p className="text-sm text-slate-500 italic mt-1 bg-slate-100 px-2 py-1 rounded">
                              "{cambio.comentario_aprobacion}"
                            </p>
                          )}
                        </div>
                        
                        <div className="text-right text-sm text-slate-500">
                          <p className="font-medium">
                            {cambio.fecha_aprobacion 
                              ? formatDate(cambio.fecha_aprobacion)
                              : formatDate(cambio.fecha_decision)
                            }
                          </p>
                          <p className="text-xs text-slate-400">
                            por {cambio.aprobado_por_nombre || 'Sistema'}
                          </p>
                          {/* Botón para ver detalle */}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="mt-2 text-xs"
                            onClick={() => setSelectedCambio(cambio)}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            Ver detalle
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tab: Reapariciones */}
        <TabsContent value="reapariciones">
          {loadingReapariciones ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
            </div>
          ) : reapariciones.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <CheckCircle className="w-16 h-16 mx-auto text-emerald-500 mb-4" />
                <h3 className="text-xl font-semibold text-slate-700">Sin solicitudes</h3>
                <p className="text-slate-500 mt-2">No hay solicitudes de reaparición pendientes</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {reapariciones.map((reap) => (
                <Card key={reap.codigo_predial_nacional} className="hover:border-amber-300 transition-colors border-l-4 border-l-amber-500">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="p-2 bg-amber-100 rounded-lg">
                          <RefreshCw className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-amber-100 text-amber-800">Reaparición</Badge>
                            <span className="font-mono text-sm text-slate-600">
                              {reap.codigo_predial_nacional}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 mt-1 font-medium">
                            {reap.municipio}
                          </p>
                          <p className="text-sm text-slate-500 mt-1">
                            Propietario: {reap.nombre_propietario || 'N/A'}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            Eliminado: {formatDate(reap.eliminado_en)} · Solicitado por: {reap.solicitado_por_nombre || 'N/A'}
                          </p>
                          {reap.justificacion_solicitud && (
                            <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2 rounded">
                              <strong>Justificación:</strong> {reap.justificacion_solicitud}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {isCoordinador && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => openReaparicionModal(reap, 'aprobar')}
                            disabled={procesandoReaparicion === reap.codigo_predial_nacional}
                          >
                            {procesandoReaparicion === reap.codigo_predial_nacional ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4 mr-1" />
                            )}
                            Aprobar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-300 text-red-700 hover:bg-red-50"
                            onClick={() => openReaparicionModal(reap, 'rechazar')}
                            disabled={procesandoReaparicion === reap.codigo_predial_nacional}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Rechazar
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal de Reaparición */}
      <Dialog open={showReaparicionModal} onOpenChange={(open) => {
        if (!open) {
          setShowReaparicionModal(false);
          setSelectedReaparicion(null);
          setJustificacionReaparicion('');
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-amber-600" />
              {selectedReaparicion?.action === 'aprobar' ? 'Aprobar Reaparición' : 'Rechazar Reaparición'}
            </DialogTitle>
            <DialogDescription>
              {selectedReaparicion?.action === 'aprobar' 
                ? 'El predio será restaurado a la base de datos activa'
                : 'La solicitud será rechazada y el predio permanecerá eliminado'
              }
            </DialogDescription>
          </DialogHeader>
          
          {selectedReaparicion && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-sm font-mono text-slate-700">{selectedReaparicion.codigo_predial_nacional}</p>
                <p className="text-sm text-slate-600">{selectedReaparicion.municipio}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Propietario: {selectedReaparicion.nombre_propietario || 'N/A'}
                </p>
              </div>
              
              <div>
                <Label htmlFor="justificacion">
                  {selectedReaparicion.action === 'aprobar' ? 'Justificación de aprobación' : 'Motivo del rechazo'} *
                </Label>
                <Textarea
                  id="justificacion"
                  value={justificacionReaparicion}
                  onChange={(e) => setJustificacionReaparicion(e.target.value)}
                  placeholder={selectedReaparicion.action === 'aprobar' 
                    ? 'Indique por qué se aprueba la reaparición...'
                    : 'Indique el motivo por el cual se rechaza...'
                  }
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReaparicionModal(false)}>
              Cancelar
            </Button>
            {selectedReaparicion?.action === 'aprobar' ? (
              <Button 
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => handleAprobarReaparicion(selectedReaparicion)}
                disabled={procesandoReaparicion || !justificacionReaparicion.trim()}
              >
                {procesandoReaparicion ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Confirmar Aprobación
              </Button>
            ) : (
              <Button 
                variant="destructive"
                onClick={() => handleRechazarReaparicion(selectedReaparicion)}
                disabled={procesandoReaparicion || !justificacionReaparicion.trim()}
              >
                {procesandoReaparicion ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Confirmar Rechazo
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalle del Cambio con Comparación */}
      <Dialog open={!!selectedCambio} onOpenChange={() => setSelectedCambio(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="w-5 h-5" />
              Detalle del Cambio
            </DialogTitle>
            <DialogDescription>
              {selectedCambio?.tipo_cambio === 'modificacion' 
                ? 'Comparación entre valores actuales y propuestos'
                : selectedCambio?.tipo_cambio === 'creacion'
                ? 'Datos del nuevo predio propuesto'
                : 'Datos del cambio propuesto'
              }
            </DialogDescription>
          </DialogHeader>
          {selectedCambio && (
            <div className="space-y-4">
              {/* Información del predio que se modifica - CNP destacado */}
              <div className="bg-slate-100 border border-slate-300 rounded-lg p-4 space-y-3">
                {/* CNP en fila completa */}
                <div>
                  <span className="text-xs text-slate-500 uppercase tracking-wide">Código Predial Nacional (CNP)</span>
                  <p className="font-mono text-base font-bold text-slate-800 break-all">
                    {selectedCambio.predio_actual?.codigo_predial_nacional || 
                     selectedCambio.datos_propuestos?.codigo_predial_nacional || 
                     selectedCambio.codigo_predial_nacional || 'No disponible'}
                  </p>
                </div>
                {/* Municipio y Radicado en segunda fila */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                  <div>
                    <span className="text-xs text-slate-500 uppercase tracking-wide">Municipio</span>
                    <p className="font-medium text-slate-700">
                      {selectedCambio.predio_actual?.municipio || 
                       selectedCambio.datos_propuestos?.municipio || 'No disponible'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 uppercase tracking-wide">Radicado Asociado</span>
                    {selectedCambio.radicado_numero ? (
                      <p className="font-medium text-blue-700 flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        {selectedCambio.radicado_numero}
                      </p>
                    ) : (
                      <p className="text-sm text-amber-600">Sin radicado asociado</p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Badge className={getTipoCambioColor(selectedCambio.tipo_cambio)}>
                  {getTipoCambioLabel(selectedCambio.tipo_cambio)}
                </Badge>
                <span className="text-sm text-slate-500">
                  Solicitado por: <strong>{selectedCambio.propuesto_por_nombre || 'No disponible'}</strong>
                </span>
              </div>
              
              {/* Tabla Comparativa */}
              {selectedCambio.tipo_cambio === 'modificacion' && selectedCambio.predio_actual ? (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-slate-700">Campo</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-700">Valor Actual</th>
                        <th className="px-4 py-3 text-center w-12"></th>
                        <th className="px-4 py-3 text-left font-medium text-slate-700">Valor Propuesto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {getFieldChanges(selectedCambio).map((field, idx) => (
                        <tr 
                          key={idx} 
                          className={field.hayCambio ? 'bg-amber-50' : ''}
                        >
                          <td className="px-4 py-2 font-medium text-slate-600">
                            {field.label}
                          </td>
                          <td className="px-4 py-2 text-slate-900">
                            {field.valorActual}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {field.hayCambio && (
                              <ArrowRight className="w-4 h-4 text-amber-600 mx-auto" />
                            )}
                          </td>
                          <td className={`px-4 py-2 ${field.hayCambio ? 'text-amber-700 font-medium' : 'text-slate-900'}`}>
                            {field.valorPropuesto}
                            {field.hayCambio && (
                              <span className="ml-2 text-amber-600">⚠</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                // Para creación o cuando no hay predio actual, mostrar solo los datos propuestos
                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="font-medium text-slate-700 mb-3">Datos del Predio</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-slate-500">Código Predial Nacional:</span>
                      <p className="font-mono break-all">{selectedCambio.datos_propuestos?.codigo_predial_nacional || 'Nuevo'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Municipio:</span>
                      <p>{selectedCambio.datos_propuestos?.municipio || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Dirección:</span>
                      <p>{selectedCambio.datos_propuestos?.direccion || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Propietario(s):</span>
                      <p>{selectedCambio.datos_propuestos?.nombre_propietario || 
                          (selectedCambio.datos_propuestos?.propietarios?.length > 0 
                            ? selectedCambio.datos_propuestos.propietarios.map(p => p.nombre_propietario).join(', ')
                            : 'N/A')}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Área Terreno:</span>
                      <p>{selectedCambio.datos_propuestos?.area_terreno?.toLocaleString() || 'N/A'} m²</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Avalúo:</span>
                      <p>${selectedCambio.datos_propuestos?.avaluo?.toLocaleString() || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedCambio.justificacion && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-blue-800 mb-1">Justificación:</p>
                  <p className="text-sm text-blue-700">{selectedCambio.justificacion}</p>
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setSelectedCambio(null)}>
                  Cerrar
                </Button>
                <Button
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => {
                    setSelectedCambio(null);
                    openRechazarModal(selectedCambio);
                  }}
                  disabled={procesando}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Rechazar
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handleAprobar(selectedCambio.id)}
                  disabled={procesando}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Aprobar Cambio
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmación de Rechazo */}
      <Dialog open={showRechazarModal} onOpenChange={setShowRechazarModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              Rechazar Cambio
            </DialogTitle>
            <DialogDescription>
              El gestor que propuso este cambio será notificado con el motivo del rechazo.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {cambioArechazar && (
              <div className="bg-slate-50 rounded-lg p-3 text-sm">
                <p><strong>Tipo:</strong> {getTipoCambioLabel(cambioArechazar.tipo_cambio)}</p>
                <p><strong>Código:</strong> {cambioArechazar.datos_propuestos?.codigo_predial_nacional || 'Nuevo'}</p>
                <p><strong>Solicitado por:</strong> {cambioArechazar.propuesto_por_nombre || 'N/A'}</p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="motivo-rechazo" className="text-slate-700 font-medium">
                Motivo del Rechazo *
              </Label>
              <Textarea
                id="motivo-rechazo"
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                placeholder="Indique el motivo por el cual se rechaza este cambio..."
                rows={4}
                className="resize-none"
                data-testid="motivo-rechazo-input"
              />
              <p className="text-xs text-slate-500">
                Este mensaje será enviado al gestor que solicitó el cambio.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowRechazarModal(false);
                setCambioArechazar(null);
                setMotivoRechazo('');
              }}
            >
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleConfirmarRechazo}
              disabled={procesando || !motivoRechazo.trim()}
              data-testid="confirm-rechazo-btn"
            >
              {procesando ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              Confirmar Rechazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalle de Predio Nuevo */}
      <Dialog open={showPredioDetailDialog} onOpenChange={setShowPredioDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Detalle del Predio Nuevo
            </DialogTitle>
            <DialogDescription>
              Información del predio en proceso de creación
            </DialogDescription>
          </DialogHeader>
          {selectedPredioNuevo && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge className={estadoPredioConfig[selectedPredioNuevo.estado]?.color || 'bg-slate-100'}>
                  {estadoPredioConfig[selectedPredioNuevo.estado]?.label || selectedPredioNuevo.estado}
                </Badge>
                <span className="text-sm text-slate-500">
                  Creado: {formatDate(selectedPredioNuevo.fecha_creacion)}
                </span>
              </div>
              
              <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                <h4 className="font-medium text-slate-700">Datos del Predio</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-500">Código Predial:</span>
                    <p className="font-mono break-all">{selectedPredioNuevo.datos_predio?.codigo_predial_nacional || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Municipio:</span>
                    <p>{selectedPredioNuevo.datos_predio?.municipio || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Dirección:</span>
                    <p>{selectedPredioNuevo.datos_predio?.direccion || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Propietario(s):</span>
                    <p>{selectedPredioNuevo.datos_predio?.propietarios?.map(p => p.nombre_propietario).join(', ') || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Área Terreno:</span>
                    <p>{selectedPredioNuevo.datos_predio?.area_terreno?.toLocaleString() || 'N/A'} m²</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Avalúo:</span>
                    <p>${selectedPredioNuevo.datos_predio?.avaluo?.toLocaleString() || 'N/A'}</p>
                  </div>
                </div>
              </div>
              
              {selectedPredioNuevo.radicado && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Radicado asociado:</strong> {selectedPredioNuevo.radicado}
                  </p>
                </div>
              )}
              
              {selectedPredioNuevo.observaciones && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-amber-800 mb-1">Observaciones:</p>
                  <p className="text-sm text-amber-700">{selectedPredioNuevo.observaciones}</p>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowPredioDetailDialog(false)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Acción para Predio Nuevo */}
      <Dialog open={showPredioActionDialog} onOpenChange={setShowPredioActionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {predioActionType === 'aprobar' && <CheckCircle className="w-5 h-5 text-emerald-600" />}
              {predioActionType === 'devolver' && <RefreshCw className="w-5 h-5 text-orange-600" />}
              {predioActionType === 'rechazar' && <XCircle className="w-5 h-5 text-red-600" />}
              {predioActionType === 'enviar_revision' && <Eye className="w-5 h-5 text-purple-600" />}
              {predioActionType === 'aprobar' && 'Aprobar Predio'}
              {predioActionType === 'devolver' && 'Devolver Predio'}
              {predioActionType === 'rechazar' && 'Rechazar Predio'}
              {predioActionType === 'enviar_revision' && 'Enviar a Revisión'}
            </DialogTitle>
            <DialogDescription>
              {predioActionType === 'aprobar' && 'El predio será aprobado e integrado al sistema catastral.'}
              {predioActionType === 'devolver' && 'El predio será devuelto al gestor para correcciones.'}
              {predioActionType === 'rechazar' && 'El predio será rechazado y no se integrará al sistema.'}
              {predioActionType === 'enviar_revision' && 'El predio será enviado al coordinador para revisión.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {selectedPredioNuevo && (
              <div className="bg-slate-50 rounded-lg p-3 text-sm">
                <p><strong>Código:</strong> {selectedPredioNuevo.datos_predio?.codigo_predial_nacional || 'Nuevo'}</p>
                <p><strong>Municipio:</strong> {selectedPredioNuevo.datos_predio?.municipio || 'N/A'}</p>
                <p><strong>Creado por:</strong> {selectedPredioNuevo.creado_por_nombre || 'N/A'}</p>
              </div>
            )}
            
            {['devolver', 'rechazar'].includes(predioActionType) && (
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">
                  Observaciones *
                </Label>
                <Textarea
                  value={predioObservaciones}
                  onChange={(e) => setPredioObservaciones(e.target.value)}
                  placeholder={predioActionType === 'devolver' 
                    ? 'Indique las correcciones necesarias...'
                    : 'Indique el motivo del rechazo...'}
                  rows={4}
                  className="resize-none"
                />
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowPredioActionDialog(false);
                setPredioObservaciones('');
                setPredioActionType('');
              }}
            >
              Cancelar
            </Button>
            <Button
              className={
                predioActionType === 'aprobar' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' :
                predioActionType === 'devolver' ? 'bg-orange-600 hover:bg-orange-700 text-white' :
                predioActionType === 'rechazar' ? 'bg-red-600 hover:bg-red-700 text-white' :
                'bg-purple-600 hover:bg-purple-700 text-white'
              }
              onClick={handlePredioAction}
              disabled={procesando || (['devolver', 'rechazar'].includes(predioActionType) && !predioObservaciones.trim())}
            >
              {procesando ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <>
                  {predioActionType === 'aprobar' && <CheckCircle className="w-4 h-4 mr-2" />}
                  {predioActionType === 'devolver' && <RefreshCw className="w-4 h-4 mr-2" />}
                  {predioActionType === 'rechazar' && <XCircle className="w-4 h-4 mr-2" />}
                  {predioActionType === 'enviar_revision' && <Eye className="w-4 h-4 mr-2" />}
                </>
              )}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
