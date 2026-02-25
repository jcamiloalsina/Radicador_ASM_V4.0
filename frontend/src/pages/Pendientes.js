import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Clock, CheckCircle, XCircle, Building, User, MapPin, 
  FileText, Eye, Loader2, AlertTriangle, ArrowRight, Edit, RefreshCw, History, ChevronDown, ChevronUp, Filter, X, Calendar, Link2, ExternalLink, Plus, Trash2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Helper para formatear fecha
const formatDate = (dateStr) => {
  if (!dateStr) return 'No disponible';
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
  const navigate = useNavigate();
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
  
  // Estados para asignaciones de apoyo en modificaciones
  const [misAsignacionesApoyo, setMisAsignacionesApoyo] = useState([]);
  const [loadingAsignacionesApoyo, setLoadingAsignacionesApoyo] = useState(false);
  const [selectedAsignacionApoyo, setSelectedAsignacionApoyo] = useState(null);
  const [showCompletarApoyoModal, setShowCompletarApoyoModal] = useState(false);
  const [observacionesCompletarApoyo, setObservacionesCompletarApoyo] = useState('');
  const [procesandoApoyo, setProcesandoApoyo] = useState(false);
  
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
  
  // Estados para vincular radicado a cambios existentes
  const [showVincularRadicadoModal, setShowVincularRadicadoModal] = useState(false);
  const [peticionesDisponibles, setPeticionesDisponibles] = useState([]);
  const [radicadoSeleccionado, setRadicadoSeleccionado] = useState('');
  
  // Estado para sub-tabs de predios nuevos
  const [prediosNuevosSubTab, setPrediosNuevosSubTab] = useState('asignados');
  
  // Estado para modo edición del modal de detalle
  const [isEditingPredio, setIsEditingPredio] = useState(false);
  const [editingPredioData, setEditingPredioData] = useState({});
  const [editingPropietarios, setEditingPropietarios] = useState([]);
  const [editingZonasFisicas, setEditingZonasFisicas] = useState([]);
  const [editTabActive, setEditTabActive] = useState('propietario');
  const [savingPredio, setSavingPredio] = useState(false);
  
  // Estado para eliminar solicitud
  const [showEliminarSolicitudModal, setShowEliminarSolicitudModal] = useState(false);
  const [solicitudAEliminar, setSolicitudAEliminar] = useState(null);
  const [motivoEliminacion, setMotivoEliminacion] = useState('');
  const [eliminandoSolicitud, setEliminandoSolicitud] = useState(false);
  
  // Función para abrir el modal en modo edición
  const openPredioEditor = (predio) => {
    setSelectedPredioNuevo(predio);
    
    // Extraer datos de R1 y R2
    const r2 = predio.r2 || {};
    
    // Datos básicos del predio (incluye info de R1)
    setEditingPredioData({
      direccion: predio.direccion || '',
      area_terreno: predio.area_terreno || '',
      area_construida: predio.area_construida || '',
      avaluo: predio.avaluo || '',
      destino_economico: predio.destino_economico || '',
      matricula_inmobiliaria: predio.matricula_inmobiliaria || r2.matricula_inmobiliaria || '',
      observaciones: predio.observaciones || '',
      observaciones_apoyo: predio.observaciones_apoyo || ''
    });
    
    // Propietarios - usar nombre_propietario como en Predios.js
    if (predio.propietarios && predio.propietarios.length > 0) {
      setEditingPropietarios(predio.propietarios.map(p => ({
        nombre_propietario: p.nombre_propietario || p.nombre || '',
        tipo_documento: p.tipo_documento || 'C',
        numero_documento: p.numero_documento || '',
        estado_civil: p.estado_civil || ''
      })));
    } else if (predio.nombre_propietario) {
      setEditingPropietarios([{
        nombre_propietario: predio.nombre_propietario,
        tipo_documento: predio.tipo_documento || 'C',
        numero_documento: predio.numero_documento || '',
        estado_civil: predio.estado_civil || ''
      }]);
    } else {
      setEditingPropietarios([{
        nombre_propietario: '',
        tipo_documento: 'C',
        numero_documento: '',
        estado_civil: ''
      }]);
    }
    
    // Zonas Físicas (R2) - puede haber múltiples
    if (predio.zonas_fisicas && predio.zonas_fisicas.length > 0) {
      setEditingZonasFisicas([...predio.zonas_fisicas]);
    } else if (r2 && Object.keys(r2).length > 0) {
      setEditingZonasFisicas([{
        zona_fisica: r2.zona_fisica_1 || '',
        zona_economica: r2.zona_economica_1 || '',
        area_terreno: r2.area_terreno_1 || predio.area_terreno || '',
        area_construida: r2.area_construida_1 || predio.area_construida || '',
        habitaciones: r2.habitaciones_1 || r2.numero_habitaciones || '0',
        banos: r2.banos_1 || r2.numero_banios || '0',
        locales: r2.locales_1 || r2.numero_locales || '0',
        pisos: r2.pisos_1 || r2.numero_pisos || '0',
        puntaje: r2.puntaje_1 || '0'
      }]);
    } else {
      setEditingZonasFisicas([{
        zona_fisica: '',
        zona_economica: '',
        area_terreno: predio.area_terreno || '',
        area_construida: predio.area_construida || '',
        habitaciones: '0',
        banos: '0',
        locales: '0',
        pisos: '0',
        puntaje: '0'
      }]);
    }
    
    setEditTabActive('propietario');
    setIsEditingPredio(true);
    setShowPredioDetailDialog(true);
  };
  
  // Función para agregar propietario
  const addPropietario = () => {
    setEditingPropietarios([...editingPropietarios, {
      nombre_propietario: '',
      tipo_documento: 'C',
      numero_documento: '',
      estado_civil: ''
    }]);
  };
  
  // Función para eliminar propietario
  const removePropietario = (index) => {
    if (editingPropietarios.length > 1) {
      setEditingPropietarios(editingPropietarios.filter((_, i) => i !== index));
    }
  };
  
  // Función para actualizar propietario
  const updatePropietario = (index, field, value) => {
    const updated = [...editingPropietarios];
    updated[index] = { ...updated[index], [field]: value };
    setEditingPropietarios(updated);
  };
  
  // Funciones para zonas físicas
  const addZonaFisica = () => {
    setEditingZonasFisicas([...editingZonasFisicas, {
      zona_fisica: '',
      zona_economica: '',
      area_terreno: '',
      area_construida: '',
      habitaciones: '0',
      banos: '0',
      locales: '0',
      pisos: '0',
      puntaje: '0'
    }]);
  };
  
  const removeZonaFisica = (index) => {
    if (editingZonasFisicas.length > 1) {
      setEditingZonasFisicas(editingZonasFisicas.filter((_, i) => i !== index));
    }
  };
  
  const updateZonaFisica = (index, field, value) => {
    const updated = [...editingZonasFisicas];
    updated[index] = { ...updated[index], [field]: value };
    setEditingZonasFisicas(updated);
  };
  
  // Función para guardar cambios del predio
  const handleSavePredioChanges = async () => {
    if (!selectedPredioNuevo) return;
    
    // Validar propietarios
    const propietariosValidos = editingPropietarios.filter(p => p.nombre_propietario && p.numero_documento);
    if (propietariosValidos.length === 0) {
      toast.error('Debe ingresar al menos un propietario con nombre y documento');
      return;
    }
    
    setSavingPredio(true);
    try {
      const token = localStorage.getItem('token');
      
      // Preparar datos completos
      const updateData = {
        ...editingPredioData,
        propietarios: propietariosValidos,
        zonas_fisicas: editingZonasFisicas,
        // Campos legacy para compatibilidad
        nombre_propietario: propietariosValidos[0]?.nombre_propietario || '',
        tipo_documento: propietariosValidos[0]?.tipo_documento || 'C',
        numero_documento: propietariosValidos[0]?.numero_documento || '',
        estado_civil: propietariosValidos[0]?.estado_civil || ''
      };
      
      await axios.patch(`${API}/predios-nuevos/${selectedPredioNuevo.id}`, updateData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Predio actualizado correctamente');
      setShowPredioDetailDialog(false);
      setIsEditingPredio(false);
      fetchPrediosNuevos();
      fetchMisAsignacionesApoyo();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al guardar cambios');
    } finally {
      setSavingPredio(false);
    }
  };
  
  // Función para eliminar solicitud de predio nuevo
  const handleEliminarSolicitud = async () => {
    if (!solicitudAEliminar || !motivoEliminacion.trim()) {
      toast.error('Debe ingresar un motivo para eliminar la solicitud');
      return;
    }
    
    setEliminandoSolicitud(true);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/predios-nuevos/${solicitudAEliminar.id}`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { motivo: motivoEliminacion.trim() }
      });
      
      toast.success('Solicitud eliminada correctamente');
      setShowEliminarSolicitudModal(false);
      setSolicitudAEliminar(null);
      setMotivoEliminacion('');
      fetchPrediosNuevos();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar la solicitud');
    } finally {
      setEliminandoSolicitud(false);
    }
  };
  
  // Función para abrir modal de eliminar solicitud
  const openEliminarSolicitudModal = (predio) => {
    setSolicitudAEliminar(predio);
    setMotivoEliminacion('');
    setShowEliminarSolicitudModal(true);
  };
  
  // Función para cerrar el modal de detalle/edición
  const closePredioDetailDialog = () => {
    setShowPredioDetailDialog(false);
    setIsEditingPredio(false);
    setEditingPredioData({});
    setEditingPropietarios([]);
    setEditingZonasFisicas([]);
  };
  
  // Verificar si puede aprobar cambios (coordinador, admin, o gestor con permiso)
  const userPermissions = user?.permissions || [];
  const hasApprovePermission = userPermissions.includes('approve_changes');
  const puedeAprobar = user && (
    ['coordinador', 'administrador'].includes(user.role) || hasApprovePermission
  );
  // Mantener isCoordinador para compatibilidad con el resto del código
  const isCoordinador = puedeAprobar;

  useEffect(() => {
    fetchPendientes();
    fetchPrediosNuevos();
    fetchHistorialStats();
    fetchReapariciones();
    fetchPeticionesParaVincular();
    fetchMisAsignacionesApoyo();
  }, []);

  // Cargar mis asignaciones de apoyo en modificaciones
  const fetchMisAsignacionesApoyo = async () => {
    try {
      setLoadingAsignacionesApoyo(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios/cambios/mis-asignaciones`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMisAsignacionesApoyo(res.data.cambios || []);
    } catch (error) {
      console.log('Error cargando asignaciones de apoyo');
      setMisAsignacionesApoyo([]);
    } finally {
      setLoadingAsignacionesApoyo(false);
    }
  };

  // Completar asignación de apoyo y enviar a revisión
  const handleCompletarApoyo = async () => {
    if (!selectedAsignacionApoyo) return;
    
    try {
      setProcesandoApoyo(true);
      const token = localStorage.getItem('token');
      
      await axios.post(`${API}/predios/cambios/${selectedAsignacionApoyo.id}/completar-apoyo`, {
        observaciones: observacionesCompletarApoyo || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Modificación completada y enviada a revisión del coordinador');
      setShowCompletarApoyoModal(false);
      setSelectedAsignacionApoyo(null);
      setObservacionesCompletarApoyo('');
      fetchMisAsignacionesApoyo();
      fetchPendientes();
      
      // Emitir evento para actualizar badge
      window.dispatchEvent(new Event('pendientesUpdated'));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al completar la asignación');
    } finally {
      setProcesandoApoyo(false);
    }
  };

  // Cargar peticiones disponibles para vincular radicado
  const fetchPeticionesParaVincular = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/petitions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Filtrar peticiones en estado activo
      const peticiones = res.data.filter(p => 
        ['radicado', 'asignado', 'en_revision'].includes(p.estado)
      ).sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion));
      setPeticionesDisponibles(peticiones);
    } catch (error) {
      console.log('Error cargando peticiones');
    }
  };

  // Vincular radicado a un cambio pendiente
  const handleVincularRadicado = async () => {
    if (!selectedCambio || !radicadoSeleccionado) return;
    
    try {
      const token = localStorage.getItem('token');
      const peticion = peticionesDisponibles.find(p => p.id === radicadoSeleccionado);
      
      await axios.patch(`${API}/predios/cambios/${selectedCambio.id}/vincular-radicado`, {
        radicado_id: radicadoSeleccionado,
        radicado_numero: peticion?.radicado
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`Radicado ${peticion?.radicado} vinculado exitosamente`);
      setShowVincularRadicadoModal(false);
      setRadicadoSeleccionado('');
      setSelectedCambio(null);
      fetchPendientes();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al vincular radicado');
    }
  };

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
    
    if (['devolver', 'rechazar', 'rechazar_asignacion'].includes(predioActionType) && !predioObservaciones.trim()) {
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
        rechazar: 'Predio rechazado',
        rechazar_asignacion: 'Asignación rechazada. El predio ha sido devuelto al gestor creador.'
      };
      
      toast.success(mensajes[predioActionType] || 'Acción completada');
      setShowPredioActionDialog(false);
      setPredioObservaciones('');
      setPredioActionType('');
      fetchPrediosNuevos();
      fetchMisAsignacionesApoyo();
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
      
      // Emitir evento para actualizar el badge del menú
      window.dispatchEvent(new CustomEvent('pendientesUpdated'));
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
    
    // Para cambios en historial (ya procesados), usar datos_anteriores si existe
    const datosAnteriores = cambio.datos_anteriores || actual;
    
    // Verificar si tenemos datos anteriores disponibles
    // Si predio_actual_es_referencia es true, significa que son datos actuales, no históricos
    const tieneDatosAnteriores = Object.keys(datosAnteriores).length > 0 && !cambio.predio_actual_es_referencia;
    
    // Función para normalizar valores para comparación (maneja tipos diferentes)
    const normalizeValue = (val) => {
      if (val === null || val === undefined) return '';
      return String(val).trim();
    };
    
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
      let valorActual = datosAnteriores[campo.key];
      let valorPropuesto = propuesto[campo.key];
      
      // Manejar caso especial de propietarios (array)
      if (campo.key === 'nombre_propietario') {
        if (datosAnteriores.propietarios && datosAnteriores.propietarios.length > 0) {
          valorActual = datosAnteriores.propietarios.map(p => {
            const nombre = p.nombre_propietario || '';
            const doc = p.numero_documento || p.documento || 'Sin doc';
            return `${nombre} (${doc})`;
          }).join(', ');
        }
        if (propuesto.propietarios && propuesto.propietarios.length > 0) {
          valorPropuesto = propuesto.propietarios.map(p => {
            const nombre = p.nombre_propietario || '';
            const doc = p.numero_documento || p.documento || 'Sin doc';
            return `${nombre} (${doc})`;
          }).join(', ');
        }
      }
      
      // IMPORTANTE: Solo incluir si el campo fue propuesto (existe en datos_propuestos)
      const existeEnPropuesto = campo.key in propuesto || 
        (campo.key === 'nombre_propietario' && propuesto.propietarios);
      
      if (!existeEnPropuesto) continue; // No fue tocado, no mostrar
      
      // Verificar si realmente cambió usando comparación normalizada
      if (tieneDatosAnteriores) {
        const actualNorm = normalizeValue(valorActual);
        const propuestoNorm = normalizeValue(valorPropuesto);
        const sonDiferentes = actualNorm !== propuestoNorm;
        if (!sonDiferentes) continue; // Mismo valor, no mostrar
      }
      
      const format = campo.format || ((v) => v);
      // Para cambios antiguos sin datos anteriores, mostrar "No disponible" en lugar de "(vacío)"
      const actualFormatted = !tieneDatosAnteriores 
        ? '(no registrado)' 
        : (valorActual != null ? (format(valorActual) || valorActual) : '(vacío)');
      const propuestoFormatted = valorPropuesto != null ? (format(valorPropuesto) || valorPropuesto) : '(vacío)';
      
      cambios.push({
        label: campo.label,
        valorActual: actualFormatted,
        valorPropuesto: propuestoFormatted,
        hayCambio: true
      });
    }
    
    return cambios;
  };

  // Función para renderizar el contenido del historial
  const renderHistorialContent = () => {
    return (
      <>
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
                        
                        <p className="text-sm text-slate-600 mt-2">
                          <User className="w-3 h-3 inline mr-1" />
                          Solicitado por: <span className="font-medium">{cambio.propuesto_por_nombre}</span>
                        </p>
                        
                        {cambio.comentario_aprobacion && (
                          <p className="text-sm text-slate-500 italic mt-1 bg-slate-100 px-2 py-1 rounded">
                            &quot;{cambio.comentario_aprobacion}&quot;
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
      </>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  // Contar predios nuevos en revisión (pendientes de aprobación)
  const prediosEnRevision = prediosNuevos.filter(p => (p.estado_flujo || p.estado) === 'revision').length;
  const reaparicionesPendientes = reapariciones.length;
  
  // Filtrar predios por categoría
  const misCreaciones = prediosNuevos.filter(p => p.gestor_creador_id === user?.id);
  const asignadosAMi = prediosNuevos.filter(p => 
    p.gestor_apoyo_id === user?.id && 
    ['creado', 'digitalizacion', 'devuelto'].includes(p.estado_flujo || p.estado)
  );
  const prediosParaRevisar = prediosNuevos.filter(p => (p.estado_flujo || p.estado) === 'revision');
  
  // Calcular totales según el rol
  const totalMisAsignaciones = misCreaciones.length + asignadosAMi.length + misAsignacionesApoyo.length;
  const totalPendientesAprobacion = cambiosPendientes.length + prediosEnRevision + reaparicionesPendientes;
  
  // Título y descripción según el rol
  const pageTitle = puedeAprobar ? 'Pendientes' : 'Mis Asignaciones';
  const pageDescription = puedeAprobar 
    ? 'Cambios, predios nuevos y reapariciones que requieren aprobación'
    : 'Predios y modificaciones asignadas para tu gestión';
  const totalBadge = puedeAprobar ? totalPendientesAprobacion : totalMisAsignaciones;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-outfit">{pageTitle}</h1>
          <p className="text-slate-600 mt-1">{pageDescription}</p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          {totalBadge} {puedeAprobar ? 'pendientes' : 'asignaciones'}
        </Badge>
      </div>

      {/* Vista para GESTORES (sin permiso de aprobar) */}
      {!puedeAprobar ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="mis-asignaciones" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Mis Asignaciones
              {totalMisAsignaciones > 0 && (
                <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-800">{totalMisAsignaciones}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="historial" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Historial
            </TabsTrigger>
          </TabsList>

          {/* Tab: Mis Asignaciones (Todo centralizado para gestores) */}
          <TabsContent value="mis-asignaciones">
            {(loadingAsignacionesApoyo || loadingPredios) ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
                  <p className="text-slate-500 mt-4">Cargando asignaciones...</p>
                </CardContent>
              </Card>
            ) : (totalMisAsignaciones === 0) ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <CheckCircle className="w-12 h-12 mx-auto text-emerald-500 mb-4" />
                  <h3 className="text-lg font-medium text-slate-900">¡Sin asignaciones pendientes!</h3>
                  <p className="text-slate-500 mt-2">No tienes predios ni modificaciones asignadas</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Sección: Predios Nuevos que creé */}
                {misCreaciones.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      Predios Nuevos que Creé ({misCreaciones.length})
                    </h3>
                    <div className="grid gap-3">
                      {misCreaciones.map(predio => {
                        const estadoConfig = estadoPredioConfig[predio.estado_flujo] || estadoPredioConfig['creado'];
                        const IconoEstado = estadoConfig.icon;
                        const esCreador = predio.gestor_creador_id === user?.id;
                        const esApoyo = predio.gestor_apoyo_id === user?.id;
                        
                        return (
                          <Card key={predio.id} className="border-blue-200 bg-blue-50/30">
                            <CardContent className="py-4">
                              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="font-mono text-sm text-slate-700">{predio.codigo_predial_nacional}</div>
                                  <div className="text-sm text-slate-600">
                                    <MapPin className="w-4 h-4 inline mr-1" />
                                    {predio.municipio} - {predio.direccion || 'Sin dirección'}
                                  </div>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge className={`${estadoConfig.color} border`}>
                                      <IconoEstado className="w-3 h-3 mr-1" />
                                      {estadoConfig.label}
                                    </Badge>
                                    <Badge variant="outline" className="text-blue-600 border-blue-300">Creador</Badge>
                                    {predio.gestor_apoyo_nombre && (
                                      <Badge variant="outline" className="text-purple-600 border-purple-300">
                                        <User className="w-3 h-3 mr-1" />
                                        Apoyo: {predio.gestor_apoyo_nombre}
                                      </Badge>
                                    )}
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
                                  {['creado', 'digitalizacion', 'devuelto'].includes(predio.estado_flujo || predio.estado) && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-blue-700 border-blue-300"
                                      onClick={() => openPredioEditor(predio)}
                                      data-testid={`edit-predio-${predio.id}`}
                                    >
                                      <Edit className="w-4 h-4 mr-1" />
                                      Editar
                                    </Button>
                                  )}
                                  {['creado', 'digitalizacion', 'devuelto'].includes(predio.estado_flujo || predio.estado) && 
                                   esCreador && !predio.gestor_apoyo_id && (
                                    <Button
                                      size="sm"
                                      className="bg-purple-600 hover:bg-purple-700 text-white"
                                      onClick={() => openPredioActionDialog(predio, 'enviar_revision')}
                                    >
                                      <ArrowRight className="w-4 h-4 mr-1" />
                                      Enviar a Revisión
                                    </Button>
                                  )}
                                  {['creado', 'digitalizacion', 'devuelto'].includes(predio.estado_flujo || predio.estado) && 
                                   esCreador && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-red-600 border-red-200 hover:bg-red-50"
                                      onClick={() => openEliminarSolicitudModal(predio)}
                                      data-testid={`eliminar-solicitud-${predio.id}`}
                                    >
                                      <Trash2 className="w-4 h-4 mr-1" />
                                      Eliminar
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Sección: Predios Nuevos Asignados (soy apoyo) */}
                {asignadosAMi.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-purple-600" />
                      Predios Nuevos Asignados ({asignadosAMi.length})
                    </h3>
                    <div className="grid gap-3">
                      {asignadosAMi.map(predio => {
                        const estadoConfig = estadoPredioConfig[predio.estado_flujo] || estadoPredioConfig['creado'];
                        const IconoEstado = estadoConfig.icon;
                        
                        return (
                          <Card key={predio.id} className="border-purple-200 bg-purple-50/30">
                            <CardContent className="py-4">
                              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="font-mono text-sm text-slate-700">{predio.codigo_predial_nacional}</div>
                                  <div className="text-sm text-slate-600">
                                    <MapPin className="w-4 h-4 inline mr-1" />
                                    {predio.municipio} - {predio.direccion || 'Sin dirección'}
                                  </div>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge className={`${estadoConfig.color} border`}>
                                      <IconoEstado className="w-3 h-3 mr-1" />
                                      {estadoConfig.label}
                                    </Badge>
                                    <Badge variant="outline" className="text-purple-600 border-purple-300">Asignado a mí</Badge>
                                    {predio.gestor_creador_nombre && (
                                      <span className="text-xs text-slate-500">Creador: {predio.gestor_creador_nombre}</span>
                                    )}
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
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-blue-700 border-blue-300"
                                    onClick={() => openPredioEditor(predio)}
                                    data-testid={`edit-predio-asignado-${predio.id}`}
                                  >
                                    <Edit className="w-4 h-4 mr-1" />
                                    Editar
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="bg-purple-600 hover:bg-purple-700 text-white"
                                    onClick={() => openPredioActionDialog(predio, 'enviar_revision')}
                                  >
                                    <ArrowRight className="w-4 h-4 mr-1" />
                                    Enviar a Revisión
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-red-600 border-red-200 hover:bg-red-50"
                                    onClick={() => openPredioActionDialog(predio, 'rechazar_asignacion')}
                                  >
                                    <XCircle className="w-4 h-4 mr-1" />
                                    Rechazar
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

                {/* Sección: Modificaciones Asignadas */}
                {misAsignacionesApoyo.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                      <Edit className="w-5 h-5 text-amber-600" />
                      Modificaciones Asignadas ({misAsignacionesApoyo.length})
                    </h3>
                    <div className="grid gap-3">
                      {misAsignacionesApoyo.map(cambio => (
                        <Card key={cambio.id} className="border-amber-200 bg-amber-50/30">
                          <CardContent className="py-4">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                              <div className="space-y-1">
                                <div className="font-mono text-sm text-slate-700">
                                  {cambio.codigo_predial || cambio.datos_propuestos?.codigo_predial}
                                </div>
                                <div className="text-sm text-slate-600">
                                  <MapPin className="w-4 h-4 inline mr-1" />
                                  {cambio.municipio || 'Sin municipio'} - Tipo: {cambio.tipo_cambio}
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                                    Modificación Asignada
                                  </Badge>
                                  {cambio.radicado_numero && (
                                    <Badge variant="outline" className="text-blue-600">
                                      Radicado: {cambio.radicado_numero}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedCambio(cambio)}
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  Ver Cambios
                                </Button>
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => {
                                    setSelectedAsignacionApoyo(cambio);
                                    setShowCompletarApoyoModal(true);
                                  }}
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Completar y Enviar
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Tab: Historial */}
          <TabsContent value="historial">
            {renderHistorialContent()}
          </TabsContent>
        </Tabs>
      ) : (
        /* Vista para COORDINADORES / APROBADORES */
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
            </TabsTrigger>
          </TabsList>

          {/* Tab: Modificaciones (para aprobadores) */}
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
                                {cambio.datos_propuestos?.codigo_predial_nacional || 
                                 cambio.predio_actual?.codigo_predial_nacional || 
                                 'Código no disponible'}
                              </span>
                            </div>
                            <p className="text-sm text-slate-500 mt-1">
                              {cambio.datos_propuestos?.municipio || 
                               cambio.predio_actual?.municipio || 
                               'Municipio no especificado'} · 
                              Solicitado por: {cambio.propuesto_por_nombre || 'No especificado'}
                            </p>
                            {!cambio.radicado_numero && cambio.tipo_cambio === 'modificacion' && (
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-amber-600">⚠️ Sin radicado asociado</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs text-blue-600 hover:text-blue-800"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCambio(cambio);
                                    setShowVincularRadicadoModal(true);
                                  }}
                                >
                                  <Link2 className="w-3 h-3 mr-1" />
                                  Vincular radicado
                                </Button>
                              </div>
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

          {/* Tab: Predios Nuevos (En Revisión para aprobar) */}
          <TabsContent value="predios-nuevos">
            {loadingPredios ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              </div>
            ) : prediosParaRevisar.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <CheckCircle className="w-16 h-16 mx-auto text-emerald-500 mb-4" />
                  <h3 className="text-xl font-semibold text-slate-700">¡Sin predios pendientes!</h3>
                  <p className="text-slate-500 mt-2">No hay predios nuevos esperando aprobación</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {prediosParaRevisar.map(predio => {
                  const estadoConfig = estadoPredioConfig[predio.estado_flujo] || estadoPredioConfig['revision'];
                  const IconoEstado = estadoConfig.icon;
                  
                  return (
                    <Card key={predio.id} className="hover:border-emerald-300 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="font-mono text-sm text-slate-700">{predio.codigo_predial_nacional}</div>
                            <div className="text-sm text-slate-600">
                              <MapPin className="w-4 h-4 inline mr-1" />
                              {predio.municipio} - {predio.direccion || 'Sin dirección'}
                            </div>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Badge className={`${estadoConfig.color} border`}>
                                <IconoEstado className="w-3 h-3 mr-1" />
                                {estadoConfig.label}
                              </Badge>
                              {predio.gestor_creador_nombre && (
                                <span className="text-xs text-slate-500">Creador: {predio.gestor_creador_nombre}</span>
                              )}
                              {predio.gestor_apoyo_nombre && (
                                <span className="text-xs text-slate-500">Apoyo: {predio.gestor_apoyo_nombre}</span>
                              )}
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
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => openPredioActionDialog(predio, 'devolver')}
                              disabled={procesando}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Devolver
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
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Tab: Predios Nuevos (Sub-tabs para coordinadores) */}
          <TabsContent value="predios-nuevos">
            {loadingPredios ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              </div>
            ) : (
              <div>
                {/* Sub-tabs para predios nuevos */}
                <div className="flex gap-2 mb-4">
                  <Button
                    variant={prediosNuevosSubTab === 'asignados' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPrediosNuevosSubTab('asignados')}
                    className="flex items-center gap-2"
                  >
                    <User className="w-4 h-4" />
                    Asignados a Mí ({asignadosAMi.length})
                  </Button>
                  <Button
                    variant={prediosNuevosSubTab === 'creaciones' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPrediosNuevosSubTab('creaciones')}
                    className="flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Mis Creaciones ({misCreaciones.length})
                  </Button>
                  <Button
                    variant={prediosNuevosSubTab === 'revision' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPrediosNuevosSubTab('revision')}
                    className="flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    Para Revisar ({prediosParaRevisar.length})
                  </Button>
                </div>

                {/* Contenido según sub-tab seleccionado */}
              {(() => {
                let prediosFiltrados = [];
                let mensajeVacio = '';
                let subtituloVacio = '';
                
                if (prediosNuevosSubTab === 'asignados') {
                  prediosFiltrados = asignadosAMi;
                  mensajeVacio = '¡Sin tareas pendientes!';
                  subtituloVacio = 'No tienes predios asignados para digitalizar';
                } else if (prediosNuevosSubTab === 'creaciones') {
                  prediosFiltrados = misCreaciones;
                  mensajeVacio = 'Sin creaciones';
                  subtituloVacio = 'No has creado predios nuevos';
                } else if (prediosNuevosSubTab === 'revision') {
                  prediosFiltrados = prediosParaRevisar;
                  mensajeVacio = '¡Todo revisado!';
                  subtituloVacio = 'No hay predios pendientes de aprobación';
                }

                if (prediosFiltrados.length === 0) {
                  return (
                    <Card>
                      <CardContent className="py-16 text-center">
                        <CheckCircle className="w-16 h-16 mx-auto text-emerald-500 mb-4" />
                        <h3 className="text-xl font-semibold text-slate-700">{mensajeVacio}</h3>
                        <p className="text-slate-500 mt-2">{subtituloVacio}</p>
                      </CardContent>
                    </Card>
                  );
                }

                return (
                  <div className="grid gap-4">
                    {prediosFiltrados.map((predio) => {
                      const estadoInfo = estadoPredioConfig[predio.estado_flujo || predio.estado] || estadoPredioConfig.creado;
                      const EstadoIcon = estadoInfo.icon;
                      const esCreador = predio.gestor_creador_id === user?.id;
                      const esApoyo = predio.gestor_apoyo_id === user?.id;
                      
                      return (
                        <Card key={predio.id} className="hover:border-emerald-300 transition-colors">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="p-2 bg-slate-100 rounded-lg">
                                  <EstadoIcon className="w-5 h-5 text-slate-600" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge className={estadoInfo.color}>
                                      {estadoInfo.label}
                                    </Badge>
                                    {esCreador && (
                                      <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs">
                                        Creador
                                      </Badge>
                                    )}
                                    {esApoyo && !esCreador && (
                                      <Badge variant="outline" className="text-purple-600 border-purple-300 text-xs">
                                        Apoyo asignado
                                      </Badge>
                                    )}
                                    <span className="font-mono text-sm text-slate-600 break-all">
                                      {predio.codigo_predial_nacional || predio.datos_predio?.codigo_predial_nacional || 'Nuevo'}
                                    </span>
                                  </div>
                                  <p className="text-sm text-slate-500 mt-1">
                                    {predio.municipio || predio.datos_predio?.municipio || 'N/A'} · 
                                    Creado por: {predio.gestor_creador_nombre || predio.creado_por_nombre || 'N/A'} · 
                                    Apoyo: {predio.gestor_apoyo_nombre || 'N/A'} · 
                                    {formatDate(predio.created_at || predio.fecha_creacion)}
                                  </p>
                                  {predio.radicado_numero && (
                                    <p className="text-sm text-blue-600 mt-1">
                                      <FileText className="w-3 h-3 inline mr-1" />
                                      Radicado: {predio.radicado_numero}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedPredioNuevo(predio);
                                    setIsEditingPredio(false);
                                    setShowPredioDetailDialog(true);
                                  }}
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  Ver Detalle
                                </Button>
                                
                                {/* Botón Editar - visible para creador, gestor de apoyo o coordinador en estados editables */}
                                {['creado', 'digitalizacion', 'devuelto'].includes(predio.estado_flujo || predio.estado) && 
                                 (esCreador || esApoyo || isCoordinador) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openPredioEditor(predio)}
                                    data-testid={`edit-predio-${predio.id}`}
                                  >
                                    <Edit className="w-4 h-4 mr-1" />
                                    Editar
                                  </Button>
                                )}
                                
                                {/* Botón Rechazar - visible para gestor de apoyo en estados pendientes */}
                                {['creado', 'digitalizacion', 'devuelto'].includes(predio.estado_flujo || predio.estado) && 
                                 esApoyo && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-red-600 border-red-200 hover:bg-red-50"
                                    onClick={() => openPredioActionDialog(predio, 'rechazar_asignacion')}
                                    disabled={procesando}
                                    data-testid={`rechazar-asignacion-${predio.id}`}
                                  >
                                    <XCircle className="w-4 h-4 mr-1" />
                                    Rechazar
                                  </Button>
                                )}
                                
                                {/* Botón Enviar a Revisión - visible para gestor de apoyo o coordinador */}
                                {/* El creador NO puede enviar a revisión si hay un gestor de apoyo asignado (debe esperar que el apoyo lo haga) */}
                                {['creado', 'digitalizacion', 'devuelto'].includes(predio.estado_flujo || predio.estado) && 
                                 (esApoyo || (isCoordinador && !esCreador) || (esCreador && !predio.gestor_apoyo_id)) && (
                                  <Button
                                    size="sm"
                                    className="bg-purple-600 hover:bg-purple-700 text-white"
                                    onClick={() => openPredioActionDialog(predio, 'enviar_revision')}
                                    disabled={procesando}
                                  >
                                    <ArrowRight className="w-4 h-4 mr-1" />
                                    Enviar a Revisión
                                  </Button>
                                )}
                                
                                {/* Botón Eliminar Solicitud - solo visible para el gestor creador en estados editables */}
                                {['creado', 'digitalizacion', 'devuelto'].includes(predio.estado_flujo || predio.estado) && 
                                 esCreador && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-red-600 border-red-200 hover:bg-red-50"
                                    onClick={() => openEliminarSolicitudModal(predio)}
                                    disabled={procesando || eliminandoSolicitud}
                                    data-testid={`eliminar-solicitud-${predio.id}`}
                                  >
                                    <Trash2 className="w-4 h-4 mr-1" />
                                    Eliminar
                                  </Button>
                                )}
                                
                                {/* Acciones de coordinador para predios en revisión */}
                                {(predio.estado_flujo === 'revision' || predio.estado === 'revision') && isCoordinador && (
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
                                
                                {(predio.estado_flujo === 'devuelto' || predio.estado === 'devuelto') && !esApoyo && (
                                  <Badge variant="outline" className="text-orange-600 border-orange-300">
                                    Pendiente corrección
                                  </Badge>
                                )}
                              </div>
                            </div>
                            
                            {/* Historial colapsable */}
                            {(predio.historial_flujo || predio.historial) && (predio.historial_flujo || predio.historial).length > 0 && (
                              <div className="mt-3 border-t pt-3">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-slate-600 p-0 h-auto"
                                  onClick={() => toggleHistorial(predio.id)}
                                >
                                  <History className="w-4 h-4 mr-1" />
                                  Historial ({(predio.historial_flujo || predio.historial).length})
                                  {expandedHistorial[predio.id] ? (
                                    <ChevronUp className="w-4 h-4 ml-1" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 ml-1" />
                                  )}
                                </Button>
                                
                                {expandedHistorial[predio.id] && (
                                  <div className="mt-2 space-y-2 pl-5 border-l-2 border-slate-200">
                                    {(predio.historial_flujo || predio.historial).map((item, idx) => (
                                      <div key={idx} className="text-sm">
                                        <span className="text-slate-400">{formatDate(item.fecha)}</span>
                                        <span className="mx-2">·</span>
                                        <span className="font-medium">{item.accion}</span>
                                        {item.usuario_nombre && (
                                          <span className="text-slate-500"> por {item.usuario_nombre}</span>
                                        )}
                                        {item.observaciones && (
                                          <p className="text-slate-500 italic mt-1">&quot;{item.observaciones}&quot;</p>
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
                );
              })()}
            </div>
          )}
        </TabsContent>

        {/* Tab: Historial de Cambios Procesados */}
        <TabsContent value="historial">
          {renderHistorialContent()}
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
      )}

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
                    {/* Para eliminaciones, el radicado puede estar en datos_propuestos */}
                    {(() => {
                      const radicadoNumero = selectedCambio.radicado_numero || 
                        (selectedCambio.tipo_cambio === 'eliminacion' && 
                          (selectedCambio.datos_propuestos?.radicado || selectedCambio.datos_propuestos?.radicado_eliminacion));
                      
                      if (radicadoNumero) {
                        return (
                          <button
                            onClick={() => {
                              if (selectedCambio.radicado_id) {
                                navigate(`/dashboard/peticiones/${selectedCambio.radicado_id}`);
                              } else {
                                toast.info('Radicado ingresado manualmente');
                              }
                            }}
                            className="font-medium text-blue-700 flex items-center gap-1 hover:text-blue-900 hover:underline transition-colors cursor-pointer"
                            data-testid="radicado-link"
                          >
                            <FileText className="w-4 h-4" />
                            {radicadoNumero}
                            {selectedCambio.radicado_id && <ExternalLink className="w-3 h-3 ml-1" />}
                          </button>
                        );
                      }
                      return <p className="text-sm text-amber-600">Sin radicado asociado</p>;
                    })()}
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
                        <th className="px-4 py-3 text-left font-medium text-slate-700">
                          {['aprobado', 'rechazado'].includes(selectedCambio.estado) ? 'Datos Anteriores' : 'Valor Actual'}
                        </th>
                        <th className="px-4 py-3 text-center w-12"></th>
                        <th className="px-4 py-3 text-left font-medium text-slate-700">
                          {selectedCambio.estado === 'aprobado' ? 'Valor Aplicado' : 'Valor Propuesto'}
                        </th>
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
                // También buscar datos en predio_actual si datos_propuestos está vacío (para cambios antiguos)
                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="font-medium text-slate-700 mb-3">Datos del Predio</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-slate-500">Código Predial Nacional:</span>
                      <p className="font-mono break-all">
                        {selectedCambio.datos_propuestos?.codigo_predial_nacional || 
                         selectedCambio.predio_actual?.codigo_predial_nacional ||
                         selectedCambio.codigo_predial || 'Nuevo'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Municipio:</span>
                      <p>
                        {selectedCambio.datos_propuestos?.municipio || 
                         selectedCambio.predio_actual?.municipio ||
                         selectedCambio.municipio || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Dirección:</span>
                      <p>
                        {selectedCambio.datos_propuestos?.direccion || 
                         selectedCambio.predio_actual?.direccion || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Propietario(s):</span>
                      <p>
                        {selectedCambio.datos_propuestos?.nombre_propietario || 
                         selectedCambio.predio_actual?.nombre_propietario ||
                         (selectedCambio.datos_propuestos?.propietarios?.length > 0 
                            ? selectedCambio.datos_propuestos.propietarios.map(p => p.nombre_propietario).join(', ')
                            : (selectedCambio.predio_actual?.propietarios?.length > 0 
                                ? selectedCambio.predio_actual.propietarios.map(p => p.nombre_propietario).join(', ')
                                : 'N/A'))}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Área Terreno:</span>
                      <p>
                        {(selectedCambio.datos_propuestos?.area_terreno || 
                          selectedCambio.predio_actual?.area_terreno)?.toLocaleString() || 'N/A'} m²
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Avalúo:</span>
                      <p>
                        ${(selectedCambio.datos_propuestos?.avaluo || 
                           selectedCambio.predio_actual?.avaluo)?.toLocaleString() || 'N/A'}
                      </p>
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

              {/* Mostrar información del resultado si ya fue procesado */}
              {selectedCambio.estado === 'aprobado' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Cambio Aprobado</span>
                  </div>
                  {selectedCambio.aprobado_por_nombre && (
                    <p className="text-sm text-emerald-600 mt-1">
                      Por: {selectedCambio.aprobado_por_nombre} - {selectedCambio.fecha_aprobacion ? new Date(selectedCambio.fecha_aprobacion).toLocaleString('es-CO') : ''}
                    </p>
                  )}
                </div>
              )}
              
              {selectedCambio.estado === 'rechazado' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-700">
                    <XCircle className="w-5 h-5" />
                    <span className="font-medium">Cambio Rechazado</span>
                  </div>
                  {selectedCambio.motivo_rechazo && (
                    <p className="text-sm text-red-600 mt-2">
                      <strong>Motivo:</strong> {selectedCambio.motivo_rechazo}
                    </p>
                  )}
                  {selectedCambio.rechazado_por_nombre && (
                    <p className="text-sm text-red-600 mt-1">
                      Por: {selectedCambio.rechazado_por_nombre} - {selectedCambio.fecha_rechazo ? new Date(selectedCambio.fecha_rechazo).toLocaleString('es-CO') : ''}
                    </p>
                  )}
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setSelectedCambio(null)}>
                  Cerrar
                </Button>
                {/* Solo mostrar botones de acción si el cambio está pendiente */}
                {selectedCambio.estado === 'pendiente' && (
                  <>
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
                  </>
                )}
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

      {/* Modal de Vincular Radicado */}
      <Dialog open={showVincularRadicadoModal} onOpenChange={(open) => {
        if (!open) {
          setShowVincularRadicadoModal(false);
          setRadicadoSeleccionado('');
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-700">
              <Link2 className="w-5 h-5" />
              Vincular Radicado
            </DialogTitle>
            <DialogDescription>
              Asocie esta modificación con una petición existente en el sistema.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {selectedCambio && (
              <div className="bg-slate-50 rounded-lg p-3 text-sm">
                <p><strong>Tipo:</strong> {getTipoCambioLabel(selectedCambio.tipo_cambio)}</p>
                <p><strong>Código:</strong> {selectedCambio.datos_propuestos?.codigo_predial_nacional || 'N/A'}</p>
                <p><strong>Municipio:</strong> {selectedCambio.datos_propuestos?.municipio || selectedCambio.predio_actual?.municipio || 'N/A'}</p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">
                Seleccionar Petición/Radicado
              </Label>
              <Select value={radicadoSeleccionado} onValueChange={setRadicadoSeleccionado}>
                <SelectTrigger data-testid="select-radicado">
                  <SelectValue placeholder="Seleccione una petición..." />
                </SelectTrigger>
                <SelectContent>
                  {peticionesDisponibles.length === 0 ? (
                    <div className="p-2 text-sm text-slate-500 text-center">
                      No hay peticiones disponibles
                    </div>
                  ) : (
                    peticionesDisponibles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.radicado} - {p.tipo_tramite} ({p.municipio})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Solo se muestran peticiones en estado activo (radicado, asignado, en revisión).
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowVincularRadicadoModal(false);
                setRadicadoSeleccionado('');
              }}
            >
              Cancelar
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleVincularRadicado}
              disabled={!radicadoSeleccionado}
              data-testid="confirm-vincular-btn"
            >
              <Link2 className="w-4 h-4 mr-2" />
              Vincular Radicado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalle/Edición de Predio Nuevo - Completo */}
      <Dialog open={showPredioDetailDialog} onOpenChange={(open) => {
        if (!open) closePredioDetailDialog();
        else setShowPredioDetailDialog(true);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isEditingPredio ? (
                <>
                  <Edit className="w-5 h-5 text-blue-600" />
                  Editar Predio Nuevo
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  Detalle del Predio Nuevo
                </>
              )}
            </DialogTitle>
            {selectedPredioNuevo && (
              <div className="flex items-center gap-3 mt-2">
                <Badge className={estadoPredioConfig[selectedPredioNuevo.estado_flujo]?.color || 'bg-slate-100'}>
                  {estadoPredioConfig[selectedPredioNuevo.estado_flujo]?.label || selectedPredioNuevo.estado_flujo}
                </Badge>
                <span className="text-xs text-slate-500 font-mono">
                  {selectedPredioNuevo.codigo_predial_nacional}
                </span>
              </div>
            )}
          </DialogHeader>
          
          {selectedPredioNuevo && isEditingPredio && (
            <div className="space-y-4">
              {/* Tabs de edición - igual que Predios.js */}
              <Tabs value={editTabActive} onValueChange={setEditTabActive} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="codigo">Código Nacional</TabsTrigger>
                  <TabsTrigger value="propietario">Propietario (R1)</TabsTrigger>
                  <TabsTrigger value="fisico">Físico (R2)</TabsTrigger>
                </TabsList>
                
                {/* Tab Código Nacional (solo lectura) */}
                <TabsContent value="codigo" className="space-y-4 mt-4">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h4 className="font-semibold text-slate-800 mb-3">Código Predial Nacional (30 dígitos)</h4>
                    <div className="font-mono text-lg bg-white border rounded p-3 text-center tracking-wider">
                      {selectedPredioNuevo.codigo_predial_nacional || 'No asignado'}
                    </div>
                    <p className="text-xs text-slate-500 mt-2 text-center">Este código no puede ser modificado</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-blue-50 rounded p-3">
                      <span className="text-blue-600 font-medium">Municipio:</span>
                      <p className="font-medium">{selectedPredioNuevo.municipio}</p>
                    </div>
                    <div className="bg-blue-50 rounded p-3">
                      <span className="text-blue-600 font-medium">Estado:</span>
                      <p className="font-medium">{estadoPredioConfig[selectedPredioNuevo.estado_flujo]?.label || selectedPredioNuevo.estado_flujo}</p>
                    </div>
                  </div>
                </TabsContent>
                
                {/* Tab Propietario (R1) - Propietarios + Info del Predio */}
                <TabsContent value="propietario" className="space-y-4 mt-4">
                  {/* Sección de Propietarios */}
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-slate-800">Propietarios</h4>
                    <Button type="button" variant="outline" size="sm" onClick={addPropietario} className="text-emerald-700">
                      <Plus className="w-4 h-4 mr-1" /> Agregar Propietario
                    </Button>
                  </div>
                  
                  {editingPropietarios.map((prop, index) => (
                    <div key={index} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-medium text-slate-700">Propietario {index + 1}</span>
                        {editingPropietarios.length > 1 && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => removePropietario(index)} className="text-red-600 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <Label className="text-xs">Nombre Completo *</Label>
                          <Input 
                            value={prop.nombre_propietario || ''} 
                            onChange={(e) => updatePropietario(index, 'nombre_propietario', e.target.value.toUpperCase())}
                            placeholder="NOMBRE COMPLETO DEL PROPIETARIO"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Tipo Documento *</Label>
                          <select
                            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                            value={prop.tipo_documento || 'C'}
                            onChange={(e) => updatePropietario(index, 'tipo_documento', e.target.value)}
                          >
                            <option value="C">C - Cédula</option>
                            <option value="N">N - NIT</option>
                            <option value="E">E - Extranjería</option>
                            <option value="T">T - Tarjeta ID</option>
                            <option value="P">P - Pasaporte</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs">Número Documento *</Label>
                          <Input 
                            value={prop.numero_documento || ''} 
                            onChange={(e) => updatePropietario(index, 'numero_documento', e.target.value)}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Estado Civil</Label>
                          <select
                            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                            value={prop.estado_civil || ''}
                            onChange={(e) => updatePropietario(index, 'estado_civil', e.target.value)}
                          >
                            <option value="">Sin especificar</option>
                            <option value="S">Soltero(a)</option>
                            <option value="C">Casado(a)</option>
                            <option value="U">Unión Libre</option>
                            <option value="V">Viudo(a)</option>
                            <option value="D">Divorciado(a)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Información general del predio */}
                  <div className="border-t border-slate-200 pt-4 mt-4">
                    <h4 className="font-semibold text-slate-800 mb-3">Información del Predio</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <Label>Dirección *</Label>
                        <Input 
                          value={editingPredioData.direccion || ''} 
                          onChange={(e) => setEditingPredioData({...editingPredioData, direccion: e.target.value.toUpperCase()})} 
                        />
                      </div>
                      <div className="col-span-2">
                        <Label>Destino Económico *</Label>
                        <select
                          className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                          value={editingPredioData.destino_economico || ''}
                          onChange={(e) => setEditingPredioData({...editingPredioData, destino_economico: e.target.value})}
                        >
                          <option value="">Seleccione...</option>
                          <option value="A">A - Habitacional</option>
                          <option value="B">B - Industrial</option>
                          <option value="C">C - Comercial</option>
                          <option value="D">D - Agropecuario</option>
                          <option value="E">E - Minero</option>
                          <option value="F">F - Cultural</option>
                          <option value="G">G - Recreacional</option>
                          <option value="H">H - Salubridad</option>
                          <option value="I">I - Institucional</option>
                          <option value="J">J - Educativo</option>
                          <option value="K">K - Religioso</option>
                          <option value="L">L - Agrícola</option>
                          <option value="M">M - Pecuario</option>
                          <option value="N">N - Agroindustrial</option>
                          <option value="O">O - Forestal</option>
                          <option value="P">P - Uso Público</option>
                          <option value="Q">Q - Lote Urbanizable No Urbanizado</option>
                          <option value="R">R - Lote Urbanizado No Edificado</option>
                          <option value="S">S - Lote No Urbanizable</option>
                          <option value="T">T - Servicios Especiales</option>
                        </select>
                      </div>
                      <div>
                        <Label>Matrícula Inmobiliaria</Label>
                        <Input 
                          value={editingPredioData.matricula_inmobiliaria || ''} 
                          onChange={(e) => setEditingPredioData({...editingPredioData, matricula_inmobiliaria: e.target.value})} 
                          placeholder="Ej: 270-8920"
                        />
                      </div>
                      <div>
                        <Label>Área Terreno (m²) *</Label>
                        <Input 
                          type="number" 
                          value={editingPredioData.area_terreno || ''} 
                          onChange={(e) => setEditingPredioData({...editingPredioData, area_terreno: e.target.value})} 
                        />
                      </div>
                      <div>
                        <Label>Área Construida (m²)</Label>
                        <Input 
                          type="number" 
                          value={editingPredioData.area_construida || ''} 
                          onChange={(e) => setEditingPredioData({...editingPredioData, area_construida: e.target.value})} 
                        />
                      </div>
                      <div>
                        <Label>Avalúo (COP) *</Label>
                        <Input 
                          type="number" 
                          value={editingPredioData.avaluo || ''} 
                          onChange={(e) => setEditingPredioData({...editingPredioData, avaluo: e.target.value})} 
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                {/* Tab Físico (R2) - Zonas Físicas */}
                <TabsContent value="fisico" className="space-y-4 mt-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-slate-800">Zonas Físicas (R2)</h4>
                    <Button type="button" variant="outline" size="sm" onClick={addZonaFisica} className="text-emerald-700">
                      <Plus className="w-4 h-4 mr-1" /> Agregar Zona
                    </Button>
                  </div>
                  
                  {editingZonasFisicas.map((zona, index) => (
                    <div key={index} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-medium text-slate-700">Zona Física {index + 1}</span>
                        {editingZonasFisicas.length > 1 && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeZonaFisica(index)} className="text-red-600 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs">Zona Física</Label>
                          <Input 
                            value={zona.zona_fisica || ''} 
                            onChange={(e) => updateZonaFisica(index, 'zona_fisica', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Zona Económica</Label>
                          <Input 
                            value={zona.zona_economica || ''} 
                            onChange={(e) => updateZonaFisica(index, 'zona_economica', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Área Terreno</Label>
                          <Input 
                            type="number"
                            value={zona.area_terreno || ''} 
                            onChange={(e) => updateZonaFisica(index, 'area_terreno', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Área Construida</Label>
                          <Input 
                            type="number"
                            value={zona.area_construida || ''} 
                            onChange={(e) => updateZonaFisica(index, 'area_construida', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Habitaciones</Label>
                          <Input 
                            type="number"
                            value={zona.habitaciones || '0'} 
                            onChange={(e) => updateZonaFisica(index, 'habitaciones', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Baños</Label>
                          <Input 
                            type="number"
                            value={zona.banos || '0'} 
                            onChange={(e) => updateZonaFisica(index, 'banos', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Locales</Label>
                          <Input 
                            type="number"
                            value={zona.locales || '0'} 
                            onChange={(e) => updateZonaFisica(index, 'locales', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Pisos</Label>
                          <Input 
                            type="number"
                            value={zona.pisos || '0'} 
                            onChange={(e) => updateZonaFisica(index, 'pisos', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Puntaje</Label>
                          <Input 
                            type="number"
                            value={zona.puntaje || '0'} 
                            onChange={(e) => updateZonaFisica(index, 'puntaje', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </div>
          )}
          
          {/* Vista de solo lectura */}
          {selectedPredioNuevo && !isEditingPredio && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-medium text-slate-700 mb-3">Datos del Predio</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-slate-500">Municipio:</span> {selectedPredioNuevo.municipio}</div>
                  <div><span className="text-slate-500">Dirección:</span> {selectedPredioNuevo.direccion || 'N/A'}</div>
                  <div><span className="text-slate-500">Área Terreno:</span> {selectedPredioNuevo.area_terreno?.toLocaleString()} m²</div>
                  <div><span className="text-slate-500">Área Construida:</span> {selectedPredioNuevo.area_construida?.toLocaleString() || 0} m²</div>
                  <div><span className="text-slate-500">Avalúo:</span> ${selectedPredioNuevo.avaluo?.toLocaleString()}</div>
                  <div><span className="text-slate-500">Destino:</span> {selectedPredioNuevo.destino_economico}</div>
                  <div className="col-span-2"><span className="text-slate-500">Propietario:</span> {selectedPredioNuevo.nombre_propietario} ({selectedPredioNuevo.tipo_documento}: {selectedPredioNuevo.numero_documento})</div>
                </div>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">Información del Flujo</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-blue-600">Creador:</span> {selectedPredioNuevo.gestor_creador_nombre}</div>
                  <div><span className="text-blue-600">Apoyo:</span> {selectedPredioNuevo.gestor_apoyo_nombre || 'Sin asignar'}</div>
                </div>
              </div>
              
              {selectedPredioNuevo.historial_flujo?.length > 0 && (
                <div className="bg-slate-100 rounded-lg p-4">
                  <h4 className="font-medium text-slate-700 mb-2 flex items-center gap-2">
                    <History className="w-4 h-4" /> Historial
                  </h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {selectedPredioNuevo.historial_flujo.slice().reverse().map((h, idx) => (
                      <div key={idx} className="text-sm border-l-2 border-slate-300 pl-3">
                        <span className="font-medium">{h.accion}</span> por {h.usuario_nombre}
                        <span className="text-slate-400 text-xs block">{formatDate(h.fecha)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="flex gap-2 mt-4">
            {isEditingPredio ? (
              <>
                <Button variant="outline" onClick={() => setIsEditingPredio(false)}>
                  Cancelar
                </Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleSavePredioChanges}
                  disabled={savingPredio}
                >
                  {savingPredio ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</>
                  ) : (
                    <><CheckCircle className="w-4 h-4 mr-2" /> Guardar Cambios</>
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={closePredioDetailDialog}>Cerrar</Button>
                {['creado', 'digitalizacion', 'devuelto'].includes(selectedPredioNuevo?.estado_flujo) && (
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => openPredioEditor(selectedPredioNuevo)}>
                    <Edit className="w-4 h-4 mr-2" /> Editar
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
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
              {predioActionType === 'rechazar_asignacion' && <XCircle className="w-5 h-5 text-red-600" />}
              {predioActionType === 'enviar_revision' && <Eye className="w-5 h-5 text-purple-600" />}
              {predioActionType === 'aprobar' && 'Aprobar Predio'}
              {predioActionType === 'devolver' && 'Devolver Predio'}
              {predioActionType === 'rechazar' && 'Rechazar Predio'}
              {predioActionType === 'rechazar_asignacion' && 'Rechazar Asignación'}
              {predioActionType === 'enviar_revision' && 'Enviar a Revisión'}
            </DialogTitle>
            <DialogDescription>
              {predioActionType === 'aprobar' && 'El predio será aprobado e integrado al sistema catastral.'}
              {predioActionType === 'devolver' && 'El predio será devuelto al gestor para correcciones.'}
              {predioActionType === 'rechazar' && 'El predio será rechazado y no se integrará al sistema.'}
              {predioActionType === 'rechazar_asignacion' && 'El predio será devuelto al gestor creador. Ya no aparecerá en tus asignaciones.'}
              {predioActionType === 'enviar_revision' && 'El predio será enviado al coordinador para revisión.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {selectedPredioNuevo && (
              <div className="bg-slate-50 rounded-lg p-3 text-sm">
                <p><strong>Código:</strong> {selectedPredioNuevo.codigo_predial_nacional || selectedPredioNuevo.datos_predio?.codigo_predial_nacional || 'Nuevo'}</p>
                <p><strong>Municipio:</strong> {selectedPredioNuevo.municipio || selectedPredioNuevo.datos_predio?.municipio || 'N/A'}</p>
                <p><strong>Propietario:</strong> {selectedPredioNuevo.nombre_propietario || 'N/A'}</p>
                <p><strong>Creado por:</strong> {selectedPredioNuevo.gestor_creador_nombre || selectedPredioNuevo.creado_por_nombre || 'N/A'}</p>
              </div>
            )}
            
            {['devolver', 'rechazar', 'rechazar_asignacion'].includes(predioActionType) && (
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">
                  Observaciones *
                </Label>
                <Textarea
                  value={predioObservaciones}
                  onChange={(e) => setPredioObservaciones(e.target.value)}
                  placeholder={
                    predioActionType === 'devolver' 
                      ? 'Indique las correcciones necesarias...'
                      : predioActionType === 'rechazar_asignacion'
                      ? 'Indique el motivo por el que rechaza esta asignación...'
                      : 'Indique el motivo del rechazo...'
                  }
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
                (predioActionType === 'rechazar' || predioActionType === 'rechazar_asignacion') ? 'bg-red-600 hover:bg-red-700 text-white' :
                'bg-purple-600 hover:bg-purple-700 text-white'
              }
              onClick={handlePredioAction}
              disabled={procesando || (['devolver', 'rechazar', 'rechazar_asignacion'].includes(predioActionType) && !predioObservaciones.trim())}
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

      {/* Modal para Completar Asignación de Apoyo */}
      <Dialog open={showCompletarApoyoModal} onOpenChange={setShowCompletarApoyoModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <CheckCircle className="w-5 h-5" />
              Completar Asignación de Apoyo
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que has completado esta modificación? Se enviará a revisión del coordinador.
            </DialogDescription>
          </DialogHeader>
          
          {selectedAsignacionApoyo && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-sm text-slate-600">
                  <strong>Predio:</strong> {selectedAsignacionApoyo.predio_actual?.codigo_predial_nacional}
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  <strong>Municipio:</strong> {selectedAsignacionApoyo.predio_actual?.municipio || selectedAsignacionApoyo.datos_propuestos?.municipio}
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  <strong>Asignado por:</strong> {selectedAsignacionApoyo.propuesto_por_nombre}
                </p>
                {selectedAsignacionApoyo.observaciones_apoyo && (
                  <div className="mt-2 p-2 bg-amber-100 rounded text-sm text-amber-800">
                    <strong>Instrucciones originales:</strong> {selectedAsignacionApoyo.observaciones_apoyo}
                  </div>
                )}
              </div>
              
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  Observaciones al completar (opcional)
                </Label>
                <Textarea
                  value={observacionesCompletarApoyo}
                  onChange={(e) => setObservacionesCompletarApoyo(e.target.value)}
                  placeholder="Agregar comentarios o notas sobre el trabajo realizado..."
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowCompletarApoyoModal(false);
                setSelectedAsignacionApoyo(null);
                setObservacionesCompletarApoyo('');
              }}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleCompletarApoyo}
              disabled={procesandoApoyo}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {procesandoApoyo ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Completar y Enviar a Revisión
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para Eliminar Solicitud de Predio Nuevo */}
      <Dialog open={showEliminarSolicitudModal} onOpenChange={setShowEliminarSolicitudModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Eliminar Solicitud
            </DialogTitle>
            <DialogDescription>
              Esta acción eliminará permanentemente la solicitud de creación del predio.
            </DialogDescription>
          </DialogHeader>
          
          {solicitudAEliminar && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-sm text-slate-600">
                  <strong>Código:</strong> {solicitudAEliminar.codigo_predial_nacional || 'No asignado'}
                </p>
                <p className="text-sm text-slate-600">
                  <strong>Municipio:</strong> {solicitudAEliminar.municipio}
                </p>
                <p className="text-sm text-slate-600">
                  <strong>Dirección:</strong> {solicitudAEliminar.direccion || 'N/A'}
                </p>
              </div>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  Esta acción no se puede deshacer. El registro será eliminado permanentemente.
                </p>
              </div>
              
              <div>
                <Label>Motivo de la eliminación *</Label>
                <Textarea
                  value={motivoEliminacion}
                  onChange={(e) => setMotivoEliminacion(e.target.value)}
                  placeholder="Ingrese el motivo por el cual desea eliminar esta solicitud..."
                  rows={3}
                />
              </div>
            </div>
          )}
          
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowEliminarSolicitudModal(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleEliminarSolicitud}
              disabled={eliminandoSolicitud || !motivoEliminacion.trim()}
            >
              {eliminandoSolicitud ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Eliminando...</>
              ) : (
                <><Trash2 className="w-4 h-4 mr-2" /> Eliminar Solicitud</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
