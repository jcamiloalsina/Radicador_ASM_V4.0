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
import useOfflineSync from '../hooks/useOfflineSync';
import {
  Plus, Search, Edit, MapPin, Building, Building2, User, DollarSign, Eye, 
  Clock, CheckCircle, AlertCircle, Loader2, RefreshCw, ArrowLeft, Map, 
  FileText, MoreVertical, ClipboardList, Trash2, Download, ChevronLeft, ChevronRight,
  WifiOff, Wifi
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
  
  // Hook de sincronización offline
  const {
    isOnline,
    isSyncing,
    offlineStats,
    hasOffline,
    pendingChangesCount,
    downloadForOffline,
    saveChangeOffline,
    syncPendingChanges,
    getPrediosOffline
  } = useOfflineSync(proyectoId, 'actualizacion');
  
  // Estados
  const [proyecto, setProyecto] = useState(null);
  const [predios, setPredios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPredios, setLoadingPredios] = useState(false);
  const [catalogos, setCatalogos] = useState(null);
  const [usingOfflineData, setUsingOfflineData] = useState(false);
  
  // Ref para evitar llamadas múltiples
  const fetchingRef = React.useRef(false);
  const hasFetchedRef = React.useRef(false);
  
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
  const [showProponerCambiosModal, setShowProponerCambiosModal] = useState(false);
  const [predioSeleccionado, setPredioSeleccionado] = useState(null);
  const [enviandoPropuesta, setEnviandoPropuesta] = useState(false);
  
  // Modal de cancelación
  const [showCancelarModal, setShowCancelarModal] = useState(false);
  const [motivoCancelacion, setMotivoCancelacion] = useState('');
  const [cancelando, setCancelando] = useState(false);
  
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
  
  // Estado para predios en manzana - IGUAL A CONSERVACIÓN
  const [prediosEnManzana, setPrediosEnManzana] = useState([]);
  const [buscandoPrediosManzana, setBuscandoPrediosManzana] = useState(false);
  const [siguienteTerrenoSugerido, setSiguienteTerrenoSugerido] = useState('0001');
  
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
  
  // Estado para múltiples propietarios (formato XTF) - IGUAL A CONSERVACIÓN
  const [propietarios, setPropietarios] = useState([{
    primer_apellido: '',
    segundo_apellido: '',
    primer_nombre: '',
    segundo_nombre: '',
    estado: '',  // Campo libre: casado, viudo, soltero, etc.
    tipo_documento: 'C',
    numero_documento: ''
  }]);
  
  // Estado para zonas de terreno (R2) - SEPARADO - IGUAL A CONSERVACIÓN
  const [zonasTerreno, setZonasTerreno] = useState([{
    zona_fisica: '',
    zona_economica: '',
    area_terreno: '0'
  }]);
  
  // Estado para construcciones (R2) - SEPARADO - IGUAL A CONSERVACIÓN
  const [construcciones, setConstrucciones] = useState([{
    id: 'A',
    piso: '1',
    habitaciones: '0',
    banos: '0',
    locales: '0',
    tipificacion: '',
    uso: '',
    puntaje: '0',
    area_construida: '0'
  }]);
  
  // Estado para zonas físicas (usado en modal de edición - formato antiguo para compatibilidad)
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
  
  // Funciones para manejar zonas físicas (modal de edición)
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
  
  // Función para generar ID de construcción (A, B, C... Z, AA, AB...)
  const generarIdConstruccion = (index) => {
    if (index < 26) {
      return String.fromCharCode(65 + index); // A-Z
    } else {
      const firstChar = String.fromCharCode(65 + Math.floor((index - 26) / 26));
      const secondChar = String.fromCharCode(65 + ((index - 26) % 26));
      return firstChar + secondChar; // AA, AB, AC...
    }
  };
  
  // Funciones para manejar múltiples propietarios - IGUAL A CONSERVACIÓN
  const agregarPropietario = () => {
    setPropietarios([...propietarios, {
      primer_apellido: '',
      segundo_apellido: '',
      primer_nombre: '',
      segundo_nombre: '',
      estado: '',
      tipo_documento: 'C',
      numero_documento: ''
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
  
  // Función para formatear número de documento con padding de 0s (12 dígitos)
  const formatearNumeroDocumento = (numero) => {
    if (!numero) return '';
    const soloNumeros = numero.replace(/\D/g, '');
    return soloNumeros.padStart(12, '0');
  };
  
  // Función para generar nombre completo desde campos separados
  const generarNombreCompleto = (prop) => {
    const partes = [
      prop.primer_apellido,
      prop.segundo_apellido,
      prop.primer_nombre,
      prop.segundo_nombre
    ].filter(p => p && p.trim());
    return partes.join(' ');
  };
  
  // Calcular áreas totales desde zonas y construcciones (SEPARADOS)
  const calcularAreasTotales = () => {
    const areaTerrenoTotal = zonasTerreno.reduce((sum, zona) => {
      return sum + (parseFloat(zona.area_terreno) || 0);
    }, 0);
    const areaConstruidaTotal = construcciones.reduce((sum, const_) => {
      return sum + (parseFloat(const_.area_construida) || 0);
    }, 0);
    return { areaTerrenoTotal, areaConstruidaTotal };
  };
  
  // Calcular total de registros R2
  const calcularTotalRegistrosR2 = () => {
    return Math.max(zonasTerreno.length, construcciones.length);
  };
  
  // Funciones para manejar zonas de terreno
  const agregarZonaTerreno = () => {
    setZonasTerreno([...zonasTerreno, {
      zona_fisica: '',
      zona_economica: '',
      area_terreno: '0'
    }]);
  };
  
  const eliminarZonaTerreno = (index) => {
    if (zonasTerreno.length > 1) {
      setZonasTerreno(zonasTerreno.filter((_, i) => i !== index));
    }
  };
  
  const actualizarZonaTerreno = (index, campo, valor) => {
    setZonasTerreno(prev => {
      const nuevas = [...prev];
      nuevas[index] = { ...nuevas[index], [campo]: valor };
      return nuevas;
    });
  };
  
  // Funciones para manejar construcciones
  const agregarConstruccion = () => {
    const nuevoId = generarIdConstruccion(construcciones.length);
    setConstrucciones([...construcciones, {
      id: nuevoId,
      piso: '1',
      habitaciones: '0',
      banos: '0',
      locales: '0',
      tipificacion: '',
      uso: '',
      puntaje: '0',
      area_construida: '0'
    }]);
  };
  
  const eliminarConstruccion = (index) => {
    if (construcciones.length > 1) {
      const nuevas = construcciones.filter((_, i) => i !== index);
      // Reasignar IDs
      const reasignadas = nuevas.map((c, i) => ({
        ...c,
        id: generarIdConstruccion(i)
      }));
      setConstrucciones(reasignadas);
    }
  };
  
  const actualizarConstruccion = (index, campo, valor) => {
    setConstrucciones(prev => {
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
  
  // Construir código completo de 30 dígitos (con padding para que siempre tenga 30 caracteres)
  const construirCodigoCompleto = () => {
    if (!estructuraCodigo?.prefijo_fijo) return '';
    return estructuraCodigo.prefijo_fijo + 
           (codigoManual.zona || '').padStart(2, '0') + 
           (codigoManual.sector || '').padStart(2, '0') + 
           (codigoManual.comuna || '').padStart(2, '0') + 
           (codigoManual.barrio || '').padStart(2, '0') + 
           (codigoManual.manzana_vereda || '').padStart(4, '0') + 
           (codigoManual.terreno || '').padStart(4, '0') + 
           (codigoManual.condicion || '').padStart(1, '0') + 
           (codigoManual.edificio || '').padStart(2, '0') + 
           (codigoManual.piso || '').padStart(2, '0') + 
           (codigoManual.unidad || '').padStart(4, '0');
  };
  
  // Manejar cambios en código manual
  const handleCodigoChange = (campo, valor, maxLen) => {
    // Solo permitir dígitos y limitar la longitud
    const valorLimpio = valor.replace(/[^0-9]/g, '').slice(0, maxLen);
    setCodigoManual(prev => ({ ...prev, [campo]: valorLimpio }));
    setVerificacionCodigo(null); // Resetear verificación al cambiar
  };
  
  // Función para obtener el valor formateado con padding (solo para mostrar el código completo)
  const getValorConPadding = (valor, len) => {
    return (valor || '').padStart(len, '0');
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
  
  // Función para buscar los últimos 5 predios existentes en la manzana - IGUAL A CONSERVACIÓN
  const fetchPrediosEnManzana = async () => {
    if (!proyecto?.municipio || !codigoManual.manzana_vereda || codigoManual.manzana_vereda === '0000') {
      setPrediosEnManzana([]);
      return;
    }
    
    setBuscandoPrediosManzana(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        zona: codigoManual.zona,
        sector: codigoManual.sector,
        comuna: codigoManual.comuna,
        barrio: codigoManual.barrio,
        manzana_vereda: codigoManual.manzana_vereda,
        limit: 5
      });
      const res = await axios.get(`${API}/predios/por-manzana/${encodeURIComponent(proyecto.municipio)}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPrediosEnManzana(res.data.predios || []);
      setSiguienteTerrenoSugerido(res.data.siguiente_terreno || '0001');
    } catch (error) {
      console.log('Error buscando predios en manzana:', error);
      setPrediosEnManzana([]);
      setSiguienteTerrenoSugerido('0001');
    } finally {
      setBuscandoPrediosManzana(false);
    }
  };
  
  // Effect para buscar predios cuando cambia la manzana - IGUAL A CONSERVACIÓN
  useEffect(() => {
    if (proyecto?.municipio && showCrearModal && codigoManual.manzana_vereda && codigoManual.manzana_vereda !== '0000') {
      const timer = setTimeout(() => {
        fetchPrediosEnManzana();
      }, 500); // Debounce de 500ms
      return () => clearTimeout(timer);
    } else {
      setPrediosEnManzana([]);
      setSiguienteTerrenoSugerido('0001');
    }
  }, [codigoManual.zona, codigoManual.sector, codigoManual.comuna, codigoManual.barrio, codigoManual.manzana_vereda, proyecto?.municipio, showCrearModal]);
  
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
  const fetchPredios = useCallback(async (searchQuery = null) => {
    if (!proyectoId) return;
    
    // Evitar llamadas múltiples simultáneas
    if (fetchingRef.current) {
      console.log('[GestionPredios] Fetch already in progress, skipping');
      return;
    }
    
    fetchingRef.current = true;
    setLoadingPredios(true);
    
    try {
      // Si está online, cargar del servidor
      if (isOnline) {
        const token = localStorage.getItem('token');
        
        // Construir parámetros de búsqueda
        let params = new URLSearchParams();
        if (searchQuery && searchQuery.length >= 3) {
          params.append('search', searchQuery);
          params.append('page_size', '1000'); // Mayor límite para búsquedas
        }
        
        const url = `${API}/actualizacion/proyectos/${proyectoId}/predios${params.toString() ? '?' + params.toString() : ''}`;
        const response = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const prediosData = response.data.predios || response.data || [];
        const totalFromServer = response.data.total || prediosData.length;
        
        setPredios(prediosData);
        setUsingOfflineData(false);
        
        // Calcular estadísticas - usar total del servidor si disponible
        const newStats = {
          total: totalFromServer,
          pendientes: response.data.stats?.pendientes || prediosData.filter(p => !p.estado_visita || p.estado_visita === 'pendiente').length,
          visitados: response.data.stats?.visitados || prediosData.filter(p => p.estado_visita === 'visitado').length,
          actualizados: response.data.stats?.actualizados || prediosData.filter(p => p.estado_visita === 'actualizado').length
        };
        setStats(newStats);
        setCurrentPage(1);
        
        // Guardar en caché para uso offline (en background)
        if (prediosData.length > 0 && downloadForOffline) {
          downloadForOffline(prediosData, null, proyecto?.municipio).catch(err => {
            console.warn('[Offline] Error guardando caché:', err);
          });
        }
      } else {
        // Sin conexión - cargar desde IndexedDB
        console.log('[Offline] Cargando predios desde caché local');
        const prediosOffline = await getPrediosOffline();
        
        if (prediosOffline && prediosOffline.length > 0) {
          setPredios(prediosOffline);
          setUsingOfflineData(true);
          toast.info('Datos cargados desde modo offline', { duration: 2000 });
          
          const newStats = {
            total: prediosOffline.length,
            pendientes: prediosOffline.filter(p => !p.estado_visita || p.estado_visita === 'pendiente').length,
            visitados: prediosOffline.filter(p => p.estado_visita === 'visitado').length,
            actualizados: prediosOffline.filter(p => p.estado_visita === 'actualizado').length
          };
          setStats(newStats);
          setCurrentPage(1);
        } else {
          toast.warning('Sin datos offline disponibles', {
            description: 'Sincronice cuando tenga conexión'
          });
        }
      }
    } catch (error) {
      console.error('Error cargando predios:', error);
      
      // Si falla, intentar cargar desde offline
      if (!isOnline || error.code === 'ERR_NETWORK') {
        console.log('[Offline] Error de red - intentando cargar desde caché');
        try {
          const prediosOffline = await getPrediosOffline();
          if (prediosOffline && prediosOffline.length > 0) {
            setPredios(prediosOffline);
            setUsingOfflineData(true);
            toast.info('Usando datos offline', { duration: 2000 });
            
            const newStats = {
              total: prediosOffline.length,
              pendientes: prediosOffline.filter(p => !p.estado_visita || p.estado_visita === 'pendiente').length,
              visitados: prediosOffline.filter(p => p.estado_visita === 'visitado').length,
              actualizados: prediosOffline.filter(p => p.estado_visita === 'actualizado').length
            };
            setStats(newStats);
          }
        } catch (offlineError) {
          console.error('Error cargando datos offline:', offlineError);
          toast.error('Sin conexión y sin datos offline');
        }
      } else {
        toast.error('Error al cargar predios');
      }
    } finally {
      setLoadingPredios(false);
      setLoading(false);
      fetchingRef.current = false;
      hasFetchedRef.current = true;
    }
  }, [proyectoId, isOnline, getPrediosOffline, downloadForOffline, proyecto?.municipio]);
  
  // Cargar datos iniciales - solo cuando cambia proyectoId
  useEffect(() => {
    if (proyectoId && !hasFetchedRef.current) {
      fetchProyecto();
      fetchPredios();
      fetchCatalogos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId]);
  
  // Búsqueda con debounce - hacer búsqueda en servidor cuando hay >= 3 caracteres
  useEffect(() => {
    if (!proyectoId || !isOnline) return;
    
    // Si el término de búsqueda tiene 3+ caracteres, buscar en servidor
    if (searchTerm && searchTerm.length >= 3) {
      const debounceTimer = setTimeout(() => {
        hasFetchedRef.current = false; // Permitir nueva fetch
        fetchPredios(searchTerm);
      }, 500); // 500ms debounce
      
      return () => clearTimeout(debounceTimer);
    } else if (searchTerm === '' || searchTerm.length < 3) {
      // Si se borra la búsqueda, recargar datos originales
      if (hasFetchedRef.current && predios.length < 500) {
        hasFetchedRef.current = false;
        fetchPredios();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, proyectoId, isOnline]);
  
  // Filtrar predios localmente (para filtros de estado/zona, y búsqueda local con < 3 chars)
  const prediosFiltrados = predios.filter(predio => {
    // Filtro de búsqueda LOCAL - solo si hay búsqueda con menos de 3 caracteres
    // (si hay >= 3 caracteres, la búsqueda ya se hizo en el servidor)
    if (searchTerm && searchTerm.length < 3 && searchTerm.length > 0) {
      const search = searchTerm.toLowerCase();
      const codigo = (predio.codigo_predial || predio.numero_predial || '').toLowerCase();
      const direccion = (predio.direccion || '').toLowerCase();
      const propietario = predio.propietarios?.[0]?.nombre_propietario?.toLowerCase() || predio.nombre_propietario?.toLowerCase() || '';
      if (!codigo.includes(search) && !direccion.includes(search) && !propietario.includes(search)) {
        return false;
      }
    }
    
    // Filtro de estado
    if (filterEstado !== 'todos') {
      // Filtro especial para mejoras
      if (filterEstado === 'mejoras') {
        const cod = predio.codigo_predial || predio.numero_predial || '';
        // NOTA: Idealmente deberíamos verificar si el terreno tiene construcciones con código de mejora
        // Por ahora, el filtro "mejoras" busca terrenos cuyo código termine en != "000"
        // pero esto no aplica a terrenos - los terrenos siempre terminan en "000"
        // Las mejoras están en las CONSTRUCCIONES, no en los terrenos
        // TODO: Cargar construcciones para identificar terrenos con mejoras correctamente
        const esMejoraPredio = cod.length >= 30 && cod.substring(27, 30) !== '000';
        if (!esMejoraPredio) return false;
      } else {
        const estadoPredio = predio.estado_visita || 'pendiente';
        if (estadoPredio !== filterEstado) return false;
      }
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
  
  // Abrir modal de editar (SOLO COORDINADORES)
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
    
    // Cargar propietarios - el modal de editar usa nombre_propietario (nombre completo)
    if (predio.propietarios?.length > 0) {
      setPropietarios(predio.propietarios.map(p => {
        // Si ya tiene nombre_propietario, usarlo directamente
        if (p.nombre_propietario) {
          return {
            nombre_propietario: p.nombre_propietario || '',
            tipo_documento: p.tipo_documento || p.tipo_doc || 'C',
            numero_documento: p.numero_documento || p.documento || '',
            estado_civil: p.estado_civil || p.estado || ''
          };
        }
        // Si tiene campos separados, combinarlos
        const nombreCompleto = [
          p.primer_apellido,
          p.segundo_apellido,
          p.primer_nombre,
          p.segundo_nombre
        ].filter(x => x).join(' ');
        return {
          nombre_propietario: nombreCompleto || '',
          tipo_documento: p.tipo_documento || p.tipo_doc || 'C',
          numero_documento: p.numero_documento || p.documento || '',
          estado_civil: p.estado_civil || p.estado || ''
        };
      }));
    } else {
      setPropietarios([{ nombre_propietario: '', tipo_documento: 'C', numero_documento: '', estado_civil: '' }]);
    }
    
    // Cargar zonas de terreno
    if (predio.zonas_terreno?.length > 0) {
      setZonasTerreno(predio.zonas_terreno);
    } else if (predio.zonas_fisicas?.length > 0) {
      setZonasTerreno(predio.zonas_fisicas.map(z => ({
        zona_fisica: z.zona_fisica || '',
        zona_economica: z.zona_economica || '',
        area_terreno: z.area_terreno || '0'
      })));
    } else {
      setZonasTerreno([{ zona_fisica: '', zona_economica: '', area_terreno: predio.area_terreno || '0' }]);
    }
    
    // Cargar construcciones
    if (predio.construcciones?.length > 0) {
      setConstrucciones(predio.construcciones);
    } else {
      setConstrucciones([{
        id: 'A',
        piso: '1',
        habitaciones: predio.habitaciones || '0',
        banos: predio.banos || '0',
        locales: predio.locales || '0',
        tipificacion: '',
        uso: predio.uso || '',
        puntaje: '0',
        area_construida: predio.area_construida || '0'
      }]);
    }
    
    // Cargar zonas físicas (compatibilidad)
    if (predio.zonas_fisicas?.length > 0) {
      setZonasFisicas(predio.zonas_fisicas);
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
  
  // Abrir modal para proponer cambios (GESTORES - predio debe estar visitado)
  const abrirProponerCambios = (predio) => {
    if (predio.estado_visita !== 'visitado') {
      toast.error('El predio debe estar visitado para proponer cambios');
      return;
    }
    
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
    
    // Cargar propietarios existentes - mapear diferentes formatos
    if (predio.propietarios?.length > 0) {
      setPropietarios(predio.propietarios.map(p => {
        // Si viene con campos separados (nuevo formato)
        if (p.primer_nombre || p.primer_apellido) {
          return {
            primer_apellido: p.primer_apellido || '',
            segundo_apellido: p.segundo_apellido || '',
            primer_nombre: p.primer_nombre || '',
            segundo_nombre: p.segundo_nombre || '',
            estado: p.estado || p.estado_civil || '',
            tipo_documento: p.tipo_documento || p.tipo_doc || 'C',
            numero_documento: p.numero_documento || p.documento || ''
          };
        }
        // Si viene con nombre_propietario (formato antiguo R1/R2)
        const nombreCompleto = p.nombre_propietario || '';
        const partes = nombreCompleto.split(' ').filter(x => x);
        return {
          primer_apellido: partes[0] || '',
          segundo_apellido: partes[1] || '',
          primer_nombre: partes[2] || '',
          segundo_nombre: partes.slice(3).join(' ') || '',
          estado: p.estado || p.estado_civil || '',
          tipo_documento: p.tipo_documento || p.tipo_doc || 'C',
          numero_documento: p.numero_documento || p.documento || ''
        };
      }));
    } else {
      setPropietarios([{ primer_apellido: '', segundo_apellido: '', primer_nombre: '', segundo_nombre: '', estado: '', tipo_documento: 'C', numero_documento: '' }]);
    }
    
    // Cargar zonas de terreno
    if (predio.zonas_terreno?.length > 0) {
      setZonasTerreno(predio.zonas_terreno);
    } else if (predio.zonas_fisicas?.length > 0) {
      setZonasTerreno(predio.zonas_fisicas.map(z => ({
        zona_fisica: z.zona_fisica || '',
        zona_economica: z.zona_economica || '',
        area_terreno: z.area_terreno || '0'
      })));
    } else {
      setZonasTerreno([{ zona_fisica: '', zona_economica: '', area_terreno: predio.area_terreno || '0' }]);
    }
    
    // Cargar construcciones
    if (predio.construcciones?.length > 0) {
      setConstrucciones(predio.construcciones);
    } else {
      setConstrucciones([{
        id: 'A',
        piso: '1',
        habitaciones: predio.habitaciones || '0',
        banos: predio.banos || '0',
        locales: predio.locales || '0',
        tipificacion: '',
        uso: predio.uso || '',
        puntaje: '0',
        area_construida: predio.area_construida || '0'
      }]);
    }
    
    setShowProponerCambiosModal(true);
  };
  
  // Enviar propuesta de cambios (para gestores)
  const enviarPropuestaCambios = async () => {
    if (!predioSeleccionado) return;
    
    setEnviandoPropuesta(true);
    try {
      const token = localStorage.getItem('token');
      
      // Calcular áreas
      const { areaTerrenoTotal, areaConstruidaTotal } = calcularAreasTotales();
      
      // Preparar propietarios
      const propietariosExport = propietarios.map(p => ({
        ...p,
        nombre_propietario: generarNombreCompleto(p),
        numero_documento: formatearNumeroDocumento(p.numero_documento)
      }));
      
      // Obtener el código del predio
      const codigoPredio = predioSeleccionado.codigo_predial || predioSeleccionado.numero_predial;
      
      // Crear propuesta de cambio
      const propuesta = {
        datos_propuestos: {
          ...formData,
          propietarios: propietariosExport,
          zonas_terreno: zonasTerreno,
          construcciones: construcciones,
          area_terreno: areaTerrenoTotal,
          area_construida: areaConstruidaTotal,
          avaluo: formData.avaluo_catastral
        },
        justificacion: `Propuesta de actualización de datos del predio ${codigoPredio}`
      };
      
      // Usar la ruta correcta que incluye el código del predio
      try {
        await axios.post(
          `${API}/actualizacion/proyectos/${proyectoId}/predios/${encodeURIComponent(codigoPredio)}/propuesta`,
          propuesta,
          { headers: { Authorization: `Bearer ${token}` }, timeout: 60000 }
        );
        
        toast.success('Propuesta de cambios enviada correctamente. El coordinador la revisará.');
        setShowProponerCambiosModal(false);
        fetchPredios();
      } catch (error) {
        // Si falla por red, guardar en caché para sincronizar después
        if (!isOnline || error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') {
          await saveChangeOffline('propuesta', { ...propuesta, codigo_predial: codigoPredio });
          toast.info('Propuesta guardada localmente. Se enviará cuando haya conexión.');
          setShowProponerCambiosModal(false);
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Error enviando propuesta:', error);
      toast.error(error.response?.data?.detail || 'Error al enviar propuesta de cambios');
    } finally {
      setEnviandoPropuesta(false);
    }
  };
  
  // Abrir modal de cancelación
  const abrirCancelarModal = (predio) => {
    setPredioSeleccionado(predio);
    setMotivoCancelacion('');
    setShowCancelarModal(true);
  };
  
  // Proponer/Ejecutar cancelación de predio
  const cancelarPredio = async () => {
    if (!predioSeleccionado) return;
    if (!motivoCancelacion.trim()) {
      toast.error('Debe especificar un motivo para la cancelación');
      return;
    }
    
    setCancelando(true);
    try {
      const token = localStorage.getItem('token');
      const codigoPredio = predioSeleccionado.codigo_predial || predioSeleccionado.numero_predial;
      
      await axios.post(
        `${API}/actualizacion/proyectos/${proyectoId}/predios/${encodeURIComponent(codigoPredio)}/proponer-cancelacion`,
        { motivo: motivoCancelacion },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // El mensaje depende del rol (el backend responde diferente)
      if (esCoordinador) {
        toast.success('Predio cancelado exitosamente');
      } else {
        toast.success('Propuesta de cancelación enviada. El coordinador la revisará.');
      }
      
      setShowCancelarModal(false);
      setShowDetalleModal(false);
      fetchPredios();
    } catch (error) {
      console.error('Error cancelando predio:', error);
      toast.error(error.response?.data?.detail || 'Error al cancelar predio');
    } finally {
      setCancelando(false);
    }
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
    
    // Resetear propietarios (formato XTF)
    setPropietarios([{
      primer_apellido: '',
      segundo_apellido: '',
      primer_nombre: '',
      segundo_nombre: '',
      estado: '',
      tipo_documento: 'C',
      numero_documento: ''
    }]);
    
    // Resetear zonas de terreno
    setZonasTerreno([{
      zona_fisica: '',
      zona_economica: '',
      area_terreno: '0'
    }]);
    
    // Resetear construcciones
    setConstrucciones([{
      id: 'A',
      piso: '1',
      habitaciones: '0',
      banos: '0',
      locales: '0',
      tipificacion: '',
      uso: '',
      puntaje: '0',
      area_construida: '0'
    }]);
    
    // Resetear zonas físicas (compatibilidad)
    
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
      
      // Calcular áreas desde R2
      const { areaTerrenoTotal, areaConstruidaTotal } = calcularAreasTotales();
      
      // Preparar propietarios en formato para exportación R1/R2
      const propietariosExport = propietarios.map(p => ({
        ...p,
        nombre_propietario: generarNombreCompleto(p),
        numero_documento: formatearNumeroDocumento(p.numero_documento),
        estado_civil: p.estado || ''
      }));
      
      // Preparar datos completos para R1/R2
      const datosCompletos = {
        ...formData,
        codigo_predial: codigoFinal,
        codigo_homologado: codigoHomologadoFinal,
        // Propietarios en formato XTF
        propietarios: propietariosExport,
        // Zonas separadas (formato Conservación)
        zonas_terreno: zonasTerreno,
        construcciones: construcciones,
        // También enviar zonasFisicas para compatibilidad
        zonas_fisicas: zonasTerreno.map((zt, i) => ({
          ...zt,
          ...(construcciones[i] || {})
        })),
        // Áreas calculadas
        area_terreno: areaTerrenoTotal,
        area_construida: areaConstruidaTotal,
        avaluo: formData.avaluo_catastral,
        avaluo_catastral: formData.avaluo_catastral
      };
      
      if (esNuevo) {
        // CORREGIDO: Usar endpoint /predios-nuevos que respeta flujo de aprobación
        // - Gestores: crea propuesta pendiente de aprobación
        // - Coordinadores/Admin: crea predio directamente
        try {
          const response = await axios.post(
            `${API}/actualizacion/proyectos/${proyectoId}/predios-nuevos`,
            datosCompletos,
            { headers: { Authorization: `Bearer ${token}` }, timeout: 60000 }
          );
          
          // Mostrar mensaje según respuesta del servidor
          if (response.data.estado === 'pendiente') {
            toast.success('Propuesta de predio nuevo enviada para aprobación del coordinador');
          } else {
            toast.success('Predio creado correctamente');
          }
          setShowCrearModal(false);
        } catch (error) {
          // Si falla por red, guardar en caché para sincronizar después
          if (!isOnline || error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') {
            await saveChangeOffline('predio_nuevo', datosCompletos);
            toast.info('Predio guardado localmente. Se sincronizará cuando haya conexión.');
            setShowCrearModal(false);
          } else {
            throw error;
          }
        }
      } else {
        const codigo = predioSeleccionado.codigo_predial || predioSeleccionado.numero_predial;
        try {
          await axios.patch(
            `${API}/actualizacion/proyectos/${proyectoId}/predios/${encodeURIComponent(codigo)}`,
            datosCompletos,
            { headers: { Authorization: `Bearer ${token}` }, timeout: 60000 }
          );
          toast.success('Predio actualizado correctamente');
          setShowEditarModal(false);
        } catch (error) {
          // Si falla por red, guardar en caché
          if (!isOnline || error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') {
            await saveChangeOffline('actualizacion_predio', { ...datosCompletos, codigo_predial: codigo });
            toast.info('Cambios guardados localmente. Se sincronizarán cuando haya conexión.');
            setShowEditarModal(false);
          } else {
            throw error;
          }
        }
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
  
  // Ver PDF de visita
  const verPdfVisita = async (predio) => {
    const codigo = predio.codigo_predial || predio.numero_predial;
    if (!codigo) {
      toast.error('No se puede generar el PDF sin código predial');
      return;
    }
    
    try {
      toast.info('Generando PDF de visita...', { duration: 2000 });
      
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/actualizacion/proyectos/${proyectoId}/predios/${encodeURIComponent(codigo)}/generar-pdf`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // El backend devuelve el PDF como base64
      if (response.data?.pdf_base64) {
        // Convertir base64 a blob
        const byteCharacters = atob(response.data.pdf_base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        
        // Crear URL del blob y abrir en nueva pestaña
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
        
        // Limpiar URL después de un tiempo
        setTimeout(() => window.URL.revokeObjectURL(url), 60000);
        
        toast.success('PDF generado correctamente');
      } else {
        toast.error('No se pudo generar el PDF');
      }
    } catch (error) {
      console.error('Error generando PDF:', error);
      console.error('Detalles del error:', error.response?.data);
      
      const errorDetail = error.response?.data?.detail;
      
      if (error.response?.status === 404) {
        toast.error(errorDetail || 'No se encontró información de visita para este predio');
      } else if (error.response?.status === 400) {
        toast.error(errorDetail || 'El predio no tiene formulario de visita diligenciado');
      } else if (error.response?.status === 500) {
        toast.error(`Error del servidor: ${errorDetail || 'Error interno al generar PDF'}`);
      } else {
        toast.error(errorDetail || 'Error al generar el PDF');
      }
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
              {/* Indicador de estado de conexión */}
              {!isOnline && (
                <Badge variant="outline" className="ml-2 bg-amber-100 text-amber-700 border-amber-300">
                  <WifiOff className="w-3 h-3 mr-1" />
                  Modo Offline
                </Badge>
              )}
              {usingOfflineData && isOnline && (
                <Badge variant="outline" className="ml-2 bg-blue-100 text-blue-700 border-blue-300">
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Sincronizando...
                </Badge>
              )}
            </h1>
            <p className="text-slate-500 mt-1">
              {proyecto?.nombre || 'Proyecto'} - {proyecto?.municipio || ''}
              {usingOfflineData && <span className="text-amber-600 ml-2">(Datos locales)</span>}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          {esCoordinador && (
            <Button 
              variant="outline"
              onClick={exportarExcel}
              className="border-amber-500 text-amber-700 hover:bg-amber-50"
              disabled={!isOnline}
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
              disabled={!isOnline}
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
          className={`cursor-pointer hover:border-yellow-400 transition-colors ${filterEstado === 'pendiente' ? 'border-yellow-400 border-2 bg-yellow-50' : ''}`}
          onClick={() => setFilterEstado(filterEstado === 'pendiente' ? 'todos' : 'pendiente')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${filterEstado === 'pendiente' ? 'bg-yellow-200 text-yellow-700' : 'bg-yellow-100 text-yellow-600'}`}>
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pendientes.toLocaleString()}</p>
                <p className="text-sm text-slate-500">Pendientes {filterEstado === 'pendiente' && '✓'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card 
          className={`cursor-pointer hover:border-blue-400 transition-colors ${filterEstado === 'visitado' ? 'border-blue-400 border-2 bg-blue-50' : ''}`}
          onClick={() => setFilterEstado(filterEstado === 'visitado' ? 'todos' : 'visitado')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${filterEstado === 'visitado' ? 'bg-blue-200 text-blue-700' : 'bg-blue-100 text-blue-600'}`}>
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.visitados.toLocaleString()}</p>
                <p className="text-sm text-slate-500">Visitados {filterEstado === 'visitado' && '✓'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card 
          className={`cursor-pointer hover:border-green-400 transition-colors ${filterEstado === 'actualizado' ? 'border-green-400 border-2 bg-green-50' : ''}`}
          onClick={() => setFilterEstado(filterEstado === 'actualizado' ? 'todos' : 'actualizado')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${filterEstado === 'actualizado' ? 'bg-green-200 text-green-700' : 'bg-green-100 text-green-600'}`}>
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.actualizados.toLocaleString()}</p>
                <p className="text-sm text-slate-500">Actualizados {filterEstado === 'actualizado' && '✓'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Tarjeta de Mejoras - Toggle */}
        <Card 
          className={`cursor-pointer hover:border-cyan-400 transition-colors ${filterEstado === 'mejoras' ? 'border-cyan-400 border-2 bg-cyan-50' : ''}`}
          onClick={() => setFilterEstado(filterEstado === 'mejoras' ? 'todos' : 'mejoras')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${filterEstado === 'mejoras' ? 'bg-cyan-200 text-cyan-700' : 'bg-cyan-100 text-cyan-600'}`}>
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {predios.filter(p => {
                    const cod = p.codigo_predial || p.numero_predial || '';
                    // Mejora = últimos 3 dígitos (posiciones 28-30) != "000"
                    return cod.length >= 30 && cod.substring(27, 30) !== '000';
                  }).length.toLocaleString()}
                </p>
                <p className="text-sm text-slate-500">
                  Con Mejoras {filterEstado === 'mejoras' && '✓'}
                </p>
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
              // Verificar si es una mejora (últimos 3 dígitos, posiciones 28-30, != "000")
              const esMejoraPredio = codigo.length >= 30 && codigo.substring(27, 30) !== '000';
              
              return (
                <Card 
                  key={predio._id || predio.id || index}
                  className={`hover:shadow-md transition-shadow ${esMejoraPredio ? 'border-cyan-400 border-l-4' : ''}`}
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
                          {/* Badge de MEJORA */}
                          {esMejoraPredio && (
                            <Badge className="bg-cyan-500 text-white text-xs">
                              <Building2 className="w-3 h-3 mr-1" />
                              MEJORA
                            </Badge>
                          )}
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
                              {/* Coordinadores pueden editar directamente */}
                              {esCoordinador && (
                                <DropdownMenuItem onClick={() => abrirEditar(predio)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Editar Predio
                                </DropdownMenuItem>
                              )}
                              
                              {/* Gestores pueden proponer cambios (solo si está visitado) */}
                              {!esCoordinador && predio.estado_visita === 'visitado' && (
                                <DropdownMenuItem onClick={() => abrirProponerCambios(predio)}>
                                  <Edit className="w-4 h-4 mr-2 text-amber-600" />
                                  Proponer Cambios
                                </DropdownMenuItem>
                              )}
                              
                              {/* Mensaje si no puede proponer cambios */}
                              {!esCoordinador && predio.estado_visita !== 'visitado' && (
                                <DropdownMenuItem disabled className="text-slate-400 text-xs">
                                  <AlertCircle className="w-4 h-4 mr-2" />
                                  Visite primero para proponer cambios
                                </DropdownMenuItem>
                              )}
                              
                              {/* Ver PDF de visita - solo si tiene visita */}
                              {(predio.estado_visita === 'visitado' || predio.estado_visita === 'actualizado') && (
                                <DropdownMenuItem onClick={() => verPdfVisita(predio)}>
                                  <FileText className="w-4 h-4 mr-2 text-blue-600" />
                                  Ver PDF de Visita
                                </DropdownMenuItem>
                              )}
                              
                              <DropdownMenuSeparator />
                              
                              {/* Marcar como visitado - todos pueden */}
                              {predio.estado_visita !== 'visitado' && (
                                <DropdownMenuItem onClick={() => marcarEstadoPredio(predio, 'visitado')}>
                                  <ClipboardList className="w-4 h-4 mr-2 text-blue-600" />
                                  Marcar Visitado
                                </DropdownMenuItem>
                              )}
                              
                              {/* Marcar como actualizado - SOLO coordinadores */}
                              {esCoordinador && predio.estado_visita !== 'actualizado' && (
                                <DropdownMenuItem onClick={() => marcarEstadoPredio(predio, 'actualizado')}>
                                  <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                                  Marcar Actualizado
                                </DropdownMenuItem>
                              )}
                              
                              {/* Marcar como pendiente */}
                              {predio.estado_visita && predio.estado_visita !== 'pendiente' && (
                                <DropdownMenuItem onClick={() => marcarEstadoPredio(predio, 'pendiente')}>
                                  <AlertCircle className="w-4 h-4 mr-2 text-yellow-600" />
                                  Marcar Pendiente
                                </DropdownMenuItem>
                              )}
                              
                              <DropdownMenuSeparator />
                              
                              {/* Cancelar predio - Coordinadores cancelan directamente, gestores proponen */}
                              {!predio.cancelado && !predio.deleted && (
                                <DropdownMenuItem 
                                  onClick={() => abrirCancelarModal(predio)}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  {esCoordinador ? 'Cancelar Predio' : 'Proponer Cancelación'}
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
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-visible">
          <div className="max-h-[80vh] overflow-y-auto pr-2">
          <DialogHeader>
            <DialogTitle className="text-xl font-outfit">
              Crear Nuevo Predio - {proyecto?.municipio}
            </DialogTitle>
          </DialogHeader>
          
          {/* Código Homologado Asignado */}
          {siguienteCodigoHomologado && (
            <div className={`p-3 rounded-lg border ${siguienteCodigoHomologado.codigo ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className={`w-5 h-5 ${siguienteCodigoHomologado.codigo ? 'text-emerald-600' : 'text-amber-600'}`} />
                  <div>
                    <p className="text-sm font-medium text-slate-700">Código Homologado Asignado</p>
                    {siguienteCodigoHomologado.codigo ? (
                      <p className="text-lg font-bold text-emerald-700 font-mono">{siguienteCodigoHomologado.codigo}</p>
                    ) : (
                      <p className="text-sm text-amber-700">No hay códigos disponibles - se generará automáticamente</p>
                    )}
                  </div>
                </div>
                {siguienteCodigoHomologado.codigo && (
                  <Badge className="bg-emerald-100 text-emerald-700">
                    {siguienteCodigoHomologado.disponibles} disponibles
                  </Badge>
                )}
              </div>
            </div>
          )}
          
          <Tabs defaultValue="ubicacion" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="ubicacion">Código Nacional (30 dígitos)</TabsTrigger>
              <TabsTrigger value="propietario">Propietario (R1)</TabsTrigger>
              <TabsTrigger value="fisico">Físico (R2)</TabsTrigger>
            </TabsList>
            
            {/* TAB CÓDIGO NACIONAL */}
            <TabsContent value="ubicacion" className="space-y-4 mt-4">
              {/* Estructura del Código Predial Nacional */}
              {estructuraCodigo && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Código Predial Nacional (30 dígitos)
                  </h4>
                  
                  {/* Visualización del código completo */}
                  <div className="bg-white p-3 rounded border mb-4 font-mono text-lg tracking-wider text-center">
                    <span className="text-blue-600 font-bold" title="Departamento + Municipio">{estructuraCodigo.prefijo_fijo}</span>
                    <span className="text-emerald-600" title="Zona">{(codigoManual.zona || '').padStart(2, '0')}</span>
                    <span className="text-amber-600" title="Sector">{(codigoManual.sector || '').padStart(2, '0')}</span>
                    <span className="text-purple-600" title="Comuna">{(codigoManual.comuna || '').padStart(2, '0')}</span>
                    <span className="text-pink-600" title="Barrio">{(codigoManual.barrio || '').padStart(2, '0')}</span>
                    <span className="text-cyan-600" title="Manzana/Vereda">{(codigoManual.manzana_vereda || '').padStart(4, '0')}</span>
                    <span className="text-red-600 font-bold" title="Terreno">{(codigoManual.terreno || '').padStart(4, '0')}</span>
                    <span className="text-orange-600" title="Condición">{(codigoManual.condicion || '').padStart(1, '0')}</span>
                    <span className="text-slate-500" title="Edificio">{(codigoManual.edificio || '').padStart(2, '0')}</span>
                    <span className="text-slate-500" title="Piso">{(codigoManual.piso || '').padStart(2, '0')}</span>
                    <span className="text-slate-500" title="Unidad">{(codigoManual.unidad || '').padStart(4, '0')}</span>
                    <span className="text-xs text-slate-500 ml-2">({construirCodigoCompleto().length}/30)</span>
                  </div>
                  
                  {/* Campos editables */}
                  <div className="grid grid-cols-6 gap-2 mb-3">
                    <div className="bg-blue-100 p-2 rounded">
                      <Label className="text-xs text-blue-700">Dpto+Mpio (1-5)</Label>
                      <Input value={estructuraCodigo.prefijo_fijo} disabled className="font-mono bg-blue-50 text-blue-800 font-bold text-center" />
                    </div>
                    <div>
                      <Label className="text-xs text-emerald-700">Zona (6-7)</Label>
                      <Input 
                        value={codigoManual.zona} 
                        onChange={(e) => handleCodigoChange('zona', e.target.value, 2)}
                        maxLength={2}
                        className="font-mono text-center"
                        placeholder="00"
                      />
                      <span className="text-xs text-slate-400">00=Rural, 01=Urbano, 02-99=Correg.</span>
                    </div>
                    <div>
                      <Label className="text-xs text-amber-700">Sector (8-9)</Label>
                      <Input 
                        value={codigoManual.sector} 
                        onChange={(e) => handleCodigoChange('sector', e.target.value, 2)}
                        maxLength={2}
                        className="font-mono text-center"
                        placeholder="00"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-purple-700">Comuna (10-11)</Label>
                      <Input 
                        value={codigoManual.comuna} 
                        onChange={(e) => handleCodigoChange('comuna', e.target.value, 2)}
                        maxLength={2}
                        className="font-mono text-center"
                        placeholder="00"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-pink-700">Barrio (12-13)</Label>
                      <Input 
                        value={codigoManual.barrio} 
                        onChange={(e) => handleCodigoChange('barrio', e.target.value, 2)}
                        maxLength={2}
                        className="font-mono text-center"
                        placeholder="00"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-cyan-700">Manzana (14-17)</Label>
                      <Input 
                        value={codigoManual.manzana_vereda} 
                        onChange={(e) => handleCodigoChange('manzana_vereda', e.target.value, 4)}
                        maxLength={4}
                        className="font-mono text-center"
                        placeholder="0000"
                      />
                    </div>
                  </div>
                  
                  {/* Mostrar últimos predios existentes en la manzana - IGUAL A CONSERVACIÓN */}
                  {codigoManual.manzana_vereda !== '0000' && (
                    <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-cyan-700 flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          Terrenos existentes en manzana {codigoManual.manzana_vereda}
                        </p>
                        {buscandoPrediosManzana && <Loader2 className="w-3 h-3 animate-spin text-cyan-600" />}
                      </div>
                      {prediosEnManzana.length > 0 ? (
                        <div className="space-y-1">
                          {prediosEnManzana.map((p, idx) => (
                            <div 
                              key={idx} 
                              className="flex items-center gap-2 text-xs bg-white rounded px-2 py-1.5 border border-cyan-100"
                            >
                              <span className="font-mono font-bold text-cyan-700 w-10">{p.terreno}</span>
                              <span className="text-slate-700 truncate flex-1">{p.direccion}</span>
                              {p.area_terreno && (
                                <span className="text-slate-500 text-[10px] w-16 text-right">{Number(p.area_terreno).toLocaleString()}m²</span>
                              )}
                              <span className="text-cyan-600 text-[10px] bg-cyan-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                                {p.registros} {p.registros === 1 ? 'reg' : 'regs'}
                              </span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-cyan-200">
                            <p className="text-[10px] text-cyan-600">
                              Mostrando últimos {prediosEnManzana.length} terrenos únicos (Base R1/R2)
                            </p>
                            <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                              💡 Siguiente: <span className="font-mono font-bold">{siguienteTerrenoSugerido}</span>
                            </p>
                          </div>
                        </div>
                      ) : !buscandoPrediosManzana ? (
                        <p className="text-xs text-cyan-600">No hay predios registrados en esta manzana</p>
                      ) : null}
                    </div>
                  )}
                  
                  <div className="grid grid-cols-5 gap-2">
                    <div>
                      <Label className="text-xs text-red-600 font-semibold">Terreno (18-21) *</Label>
                      <Input 
                        value={codigoManual.terreno} 
                        onChange={(e) => handleCodigoChange('terreno', e.target.value, 4)}
                        maxLength={4}
                        className="font-mono text-center border-red-200 focus:border-red-400"
                        placeholder="0001"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Condición (22)</Label>
                      <Input 
                        type="number"
                        min="0"
                        max="9"
                        value={codigoManual.condicion} 
                        onChange={(e) => handleCodigoChange('condicion', e.target.value.slice(0, 1), 1)}
                        maxLength={1}
                        className="font-mono text-center"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Edificio (23-24)</Label>
                      <Input 
                        value={codigoManual.edificio} 
                        onChange={(e) => handleCodigoChange('edificio', e.target.value, 2)}
                        maxLength={2}
                        className="font-mono text-center"
                        placeholder="00"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Piso (25-26)</Label>
                      <Input 
                        value={codigoManual.piso} 
                        onChange={(e) => handleCodigoChange('piso', e.target.value, 2)}
                        maxLength={2}
                        className="font-mono text-center"
                        placeholder="00"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Unidad (27-30)</Label>
                      <Input 
                        value={codigoManual.unidad} 
                        onChange={(e) => handleCodigoChange('unidad', e.target.value, 4)}
                        maxLength={4}
                        className="font-mono text-center"
                        placeholder="0000"
                      />
                    </div>
                  </div>
                  
                  {/* Botón verificar */}
                  <div className="mt-4">
                    <Button 
                      onClick={verificarCodigoCompleto} 
                      variant="outline" 
                      className="w-full"
                      disabled={verificandoCodigo}
                    >
                      {verificandoCodigo ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4 mr-2" />
                      )}
                      Verificar Código
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Resultado de verificación */}
              {verificacionCodigo && (
                <div className={`p-4 rounded-lg border ${
                  verificacionCodigo.estado === 'disponible' ? 'bg-emerald-50 border-emerald-300' :
                  verificacionCodigo.estado === 'eliminado' ? 'bg-amber-50 border-amber-300' :
                  'bg-red-50 border-red-300'
                }`}>
                  <p className={`font-semibold ${
                    verificacionCodigo.estado === 'disponible' ? 'text-emerald-800' :
                    verificacionCodigo.estado === 'eliminado' ? 'text-amber-800' :
                    'text-red-800'
                  }`}>
                    {verificacionCodigo.mensaje}
                  </p>
                  {verificacionCodigo.estado === 'existente' && verificacionCodigo.predio && (
                    <p className="text-sm text-red-700 mt-1">
                      Propietario: {verificacionCodigo.predio.nombre_propietario || 'Sin información'}
                    </p>
                  )}
                </div>
              )}
            </TabsContent>
            
            {/* TAB PROPIETARIO - IGUAL A CONSERVACIÓN */}
            <TabsContent value="propietario" className="space-y-4 mt-4">
              {/* Sección de Propietarios - Múltiples (Formato XTF) */}
              <div className="flex justify-between items-center">
                <h4 className="font-semibold text-slate-800">Propietarios</h4>
                <Button type="button" variant="outline" size="sm" onClick={agregarPropietario} className="text-emerald-700">
                  <Plus className="w-4 h-4 mr-1" /> Agregar Propietario
                </Button>
              </div>
              
              {propietarios.map((prop, index) => (
                <div key={index} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-medium text-slate-700">Propietario {index + 1}</span>
                    {propietarios.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => eliminarPropietario(index)} className="text-red-600 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Nombres según formato XTF */}
                    <div>
                      <Label className="text-xs">Primer Apellido *</Label>
                      <Input 
                        value={prop.primer_apellido || ''} 
                        onChange={(e) => actualizarPropietario(index, 'primer_apellido', e.target.value.toUpperCase())}
                        placeholder="PÉREZ"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Segundo Apellido</Label>
                      <Input 
                        value={prop.segundo_apellido || ''} 
                        onChange={(e) => actualizarPropietario(index, 'segundo_apellido', e.target.value.toUpperCase())}
                        placeholder="GARCÍA"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Primer Nombre *</Label>
                      <Input 
                        value={prop.primer_nombre || ''} 
                        onChange={(e) => actualizarPropietario(index, 'primer_nombre', e.target.value.toUpperCase())}
                        placeholder="JUAN"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Segundo Nombre</Label>
                      <Input 
                        value={prop.segundo_nombre || ''} 
                        onChange={(e) => actualizarPropietario(index, 'segundo_nombre', e.target.value.toUpperCase())}
                        placeholder="CARLOS"
                      />
                    </div>
                    
                    {/* Estado (campo libre) */}
                    <div className="col-span-2">
                      <Label className="text-xs">Estado</Label>
                      <Input 
                        value={prop.estado || ''} 
                        onChange={(e) => actualizarPropietario(index, 'estado', e.target.value.toUpperCase())}
                        placeholder="Ej: CASADO, SOLTERO, VIUDO, E (Estado), etc."
                      />
                    </div>
                    
                    {/* Tipo y Número de Documento */}
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
                      <Label className="text-xs">Número Documento * (máx 12 dígitos)</Label>
                      <Input 
                        value={prop.numero_documento || ''} 
                        onChange={(e) => {
                          // Solo permitir números y máximo 12 dígitos
                          const valor = e.target.value.replace(/\D/g, '').slice(0, 12);
                          actualizarPropietario(index, 'numero_documento', valor);
                        }}
                        placeholder="Se rellenará con 0s (ej: 001091672736)"
                      />
                      {prop.numero_documento && (
                        <p className="text-xs text-slate-500 mt-1">
                          Formato final: {formatearNumeroDocumento(prop.numero_documento)}
                        </p>
                      )}
                    </div>
                    
                    {/* Preview del nombre completo */}
                    {(prop.primer_apellido || prop.primer_nombre) && (
                      <div className="col-span-2 bg-emerald-50 p-2 rounded border border-emerald-200">
                        <p className="text-xs text-emerald-700">
                          <strong>Nombre completo:</strong> {generarNombreCompleto(prop) || 'Complete los campos'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Información general del predio */}
              <div className="border-t border-slate-200 pt-4 mt-4">
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
                    <Label>Matrícula Inmobiliaria</Label>
                    <Input value={formData.matricula_inmobiliaria} onChange={(e) => setFormData({...formData, matricula_inmobiliaria: e.target.value})} placeholder="Ej: 270-8920" />
                  </div>
                  
                  {/* Áreas calculadas del R2 */}
                  <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-blue-800">Áreas (calculadas del R2)</span>
                      <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded">Automático</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-blue-700">Área Terreno Total (m²)</Label>
                        <Input 
                          type="number" 
                          value={calcularAreasTotales().areaTerrenoTotal.toFixed(2)} 
                          readOnly 
                          className="bg-blue-100 border-blue-300 text-blue-800 font-medium"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-blue-700">Área Construida Total (m²)</Label>
                        <Input 
                          type="number" 
                          value={calcularAreasTotales().areaConstruidaTotal.toFixed(2)} 
                          readOnly 
                          className="bg-blue-100 border-blue-300 text-blue-800 font-medium"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-blue-600 mt-2">
                      💡 Estas áreas se calculan automáticamente sumando las zonas del R2. Modifique los valores en la pestaña "Físico (R2)".
                    </p>
                  </div>
                  
                  <div className="col-span-2">
                    <Label>Avalúo (COP) *</Label>
                    <Input type="number" value={formData.avaluo_catastral} onChange={(e) => setFormData({...formData, avaluo_catastral: e.target.value})} />
                  </div>
                </div>
              </div>
            </TabsContent>
            
            {/* TAB FÍSICO - IGUAL A CONSERVACIÓN */}
            <TabsContent value="fisico" className="space-y-4 mt-4">
              {/* Matrícula Inmobiliaria */}
              <div>
                <Label>Matrícula Inmobiliaria</Label>
                <Input 
                  value={formData.matricula_inmobiliaria} 
                  onChange={(e) => setFormData({...formData, matricula_inmobiliaria: e.target.value})} 
                  placeholder="Ej: 270-8920" 
                />
              </div>
              
              {/* ═══════════ ZONAS DE TERRENO ═══════════ */}
              <div className="border-t border-slate-200 pt-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-slate-800">Zonas de Terreno</h4>
                  <Button type="button" variant="outline" size="sm" onClick={agregarZonaTerreno} className="text-emerald-700">
                    <Plus className="w-4 h-4 mr-1" /> Agregar Zona
                  </Button>
                </div>
                
                {zonasTerreno.map((zona, index) => (
                  <div key={index} className="border border-slate-200 rounded-lg p-3 bg-slate-50 mb-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-slate-700">Zona {index + 1}</span>
                      {zonasTerreno.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => eliminarZonaTerreno(index)} className="text-red-600 hover:text-red-700 h-6 w-6 p-0">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Zona Física</Label>
                        <Input value={zona.zona_fisica} onChange={(e) => actualizarZonaTerreno(index, 'zona_fisica', e.target.value)} placeholder="Ej: 03" />
                      </div>
                      <div>
                        <Label className="text-xs">Zona Económica</Label>
                        <Input value={zona.zona_economica} onChange={(e) => actualizarZonaTerreno(index, 'zona_economica', e.target.value)} placeholder="Ej: 05" />
                      </div>
                      <div>
                        <Label className="text-xs">Área Terreno (m²)</Label>
                        <Input type="number" value={zona.area_terreno} onChange={(e) => actualizarZonaTerreno(index, 'area_terreno', e.target.value)} />
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Subtotal Área Terreno */}
                <div className="bg-blue-50 border border-blue-200 rounded p-2 mt-2">
                  <p className="text-sm text-blue-800">
                    📊 <strong>Subtotal Área Terreno:</strong> {calcularAreasTotales().areaTerrenoTotal.toLocaleString('es-CO', {minimumFractionDigits: 2})} m² → R1
                  </p>
                </div>
              </div>
              
              {/* ═══════════ CONSTRUCCIONES ═══════════ */}
              <div className="border-t border-slate-200 pt-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-slate-800">Construcciones</h4>
                  <Button type="button" variant="outline" size="sm" onClick={agregarConstruccion} className="text-emerald-700">
                    <Plus className="w-4 h-4 mr-1" /> Agregar Construcción
                  </Button>
                </div>
                
                {construcciones.map((const_, index) => (
                  <div key={index} className="border border-amber-200 rounded-lg p-3 bg-amber-50 mb-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-amber-800">Construcción {const_.id}</span>
                      {construcciones.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => eliminarConstruccion(index)} className="text-red-600 hover:text-red-700 h-6 w-6 p-0">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <Label className="text-xs">Piso</Label>
                        <Input type="number" value={const_.piso} onChange={(e) => actualizarConstruccion(index, 'piso', e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Habitaciones</Label>
                        <Input type="number" value={const_.habitaciones} onChange={(e) => actualizarConstruccion(index, 'habitaciones', e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Baños</Label>
                        <Input type="number" value={const_.banos} onChange={(e) => actualizarConstruccion(index, 'banos', e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Locales</Label>
                        <Input type="number" value={const_.locales} onChange={(e) => actualizarConstruccion(index, 'locales', e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Tipificación</Label>
                        <Input value={const_.tipificacion} onChange={(e) => actualizarConstruccion(index, 'tipificacion', e.target.value.toUpperCase())} placeholder="Libre" />
                      </div>
                      <div>
                        <Label className="text-xs">Uso</Label>
                        <Input value={const_.uso} onChange={(e) => actualizarConstruccion(index, 'uso', e.target.value.toUpperCase())} placeholder="Libre" />
                      </div>
                      <div>
                        <Label className="text-xs">Puntaje</Label>
                        <Input type="number" value={const_.puntaje} onChange={(e) => actualizarConstruccion(index, 'puntaje', e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Área Construida (m²)</Label>
                        <Input type="number" value={const_.area_construida} onChange={(e) => actualizarConstruccion(index, 'area_construida', e.target.value)} />
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Subtotal Área Construida */}
                <div className="bg-amber-50 border border-amber-200 rounded p-2 mt-2">
                  <p className="text-sm text-amber-800">
                    📊 <strong>Subtotal Área Construida:</strong> {calcularAreasTotales().areaConstruidaTotal.toLocaleString('es-CO', {minimumFractionDigits: 2})} m² → R1
                  </p>
                </div>
              </div>
              
              {/* ═══════════ RESUMEN R2 ═══════════ */}
              <div className="border-t border-slate-200 pt-4">
                <div className="bg-slate-100 border border-slate-300 rounded-lg p-3">
                  <h4 className="font-semibold text-slate-800 mb-2">Resumen R2</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p>• Zonas de Terreno: <strong>{zonasTerreno.length}</strong></p>
                    <p>• Construcciones: <strong>{construcciones.length}</strong> ({construcciones.map(c => c.id).join(', ')})</p>
                    <p>• Total Registros R2: <strong>{calcularTotalRegistrosR2()}</strong></p>
                    <p></p>
                    <p className="text-blue-700">• Área Terreno → R1: <strong>{calcularAreasTotales().areaTerrenoTotal.toLocaleString('es-CO', {minimumFractionDigits: 2})} m²</strong></p>
                    <p className="text-amber-700">• Área Construida → R1: <strong>{calcularAreasTotales().areaConstruidaTotal.toLocaleString('es-CO', {minimumFractionDigits: 2})} m²</strong></p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setShowCrearModal(false)}>Cancelar</Button>
            <Button 
              onClick={() => guardarPredio(true)}
              disabled={!verificacionCodigo || verificacionCodigo.estado !== 'disponible'}
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
            <DialogTitle className="text-xl font-outfit">Editar Predio</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Código Predial Nacional - Editable para coordinadores */}
            <div className="bg-slate-50 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Código Predial Nacional *</Label>
                  {canEditCodigoPredial ? (
                    <Input 
                      value={formData.codigo_predial}
                      onChange={(e) => setFormData({...formData, codigo_predial: e.target.value})}
                      className="font-mono mt-1"
                      placeholder="30 dígitos"
                    />
                  ) : (
                    <p className="font-mono text-lg font-bold text-slate-800 break-all mt-1">
                      {formData.codigo_predial}
                    </p>
                  )}
                  {!canEditCodigoPredial && (
                    <p className="text-xs text-amber-600 mt-1">Solo coordinadores pueden modificar el CPN</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Código Homologado</Label>
                  {canEditCodigoPredial ? (
                    <Input 
                      value={formData.codigo_homologado || ''}
                      onChange={(e) => setFormData({...formData, codigo_homologado: e.target.value})}
                      className="font-mono mt-1"
                      placeholder="Código homologado"
                    />
                  ) : (
                    <p className="font-mono text-lg font-bold text-amber-700 mt-1">
                      {formData.codigo_homologado || 'Sin asignar'}
                    </p>
                  )}
                </div>
              </div>
              {formData.matricula_inmobiliaria && (
                <p className="text-sm text-slate-600 mt-2">
                  <strong>Matrícula Inmobiliaria:</strong> {formData.matricula_inmobiliaria}
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
                {/* Botón de cancelar/proponer cancelación */}
                {!predioSeleccionado?.cancelado && !predioSeleccionado?.deleted && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setShowDetalleModal(false);
                      abrirCancelarModal(predioSeleccionado);
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {esCoordinador ? 'Cancelar' : 'Proponer Cancelación'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Modal Proponer Cambios - Para Gestores */}
      <Dialog open={showProponerCambiosModal} onOpenChange={setShowProponerCambiosModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-visible">
          <div className="max-h-[80vh] overflow-y-auto pr-2">
          <DialogHeader>
            <DialogTitle className="text-xl font-outfit flex items-center gap-2">
              <Edit className="w-5 h-5 text-amber-600" />
              Proponer Cambios - {predioSeleccionado?.codigo_predial}
            </DialogTitle>
            <DialogDescription>
              Complete los datos que desea modificar. La propuesta será enviada al coordinador para su aprobación.
            </DialogDescription>
          </DialogHeader>
          
          {/* Alerta informativa */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-amber-800">
              <strong>⚠️ Importante:</strong> Los cambios que proponga no se aplicarán directamente. 
              El coordinador revisará su propuesta y decidirá si aprobarla o solicitar correcciones.
            </p>
          </div>
          
          <Tabs defaultValue="propietario" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="propietario">Propietario (R1)</TabsTrigger>
              <TabsTrigger value="fisico">Físico (R2)</TabsTrigger>
            </TabsList>
            
            {/* TAB PROPIETARIO */}
            <TabsContent value="propietario" className="space-y-4 mt-4">
              {/* Propietarios */}
              <div className="flex justify-between items-center">
                <h4 className="font-semibold text-slate-800">Propietarios</h4>
                <Button type="button" variant="outline" size="sm" onClick={agregarPropietario} className="text-emerald-700">
                  <Plus className="w-4 h-4 mr-1" /> Agregar
                </Button>
              </div>
              
              {propietarios.map((prop, index) => (
                <div key={index} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-medium text-slate-700">Propietario {index + 1}</span>
                    {propietarios.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => eliminarPropietario(index)} className="text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Primer Apellido *</Label>
                      <Input value={prop.primer_apellido || ''} onChange={(e) => actualizarPropietario(index, 'primer_apellido', e.target.value.toUpperCase())} />
                    </div>
                    <div>
                      <Label className="text-xs">Segundo Apellido</Label>
                      <Input value={prop.segundo_apellido || ''} onChange={(e) => actualizarPropietario(index, 'segundo_apellido', e.target.value.toUpperCase())} />
                    </div>
                    <div>
                      <Label className="text-xs">Primer Nombre *</Label>
                      <Input value={prop.primer_nombre || ''} onChange={(e) => actualizarPropietario(index, 'primer_nombre', e.target.value.toUpperCase())} />
                    </div>
                    <div>
                      <Label className="text-xs">Segundo Nombre</Label>
                      <Input value={prop.segundo_nombre || ''} onChange={(e) => actualizarPropietario(index, 'segundo_nombre', e.target.value.toUpperCase())} />
                    </div>
                    <div>
                      <Label className="text-xs">Estado</Label>
                      <Input value={prop.estado || ''} onChange={(e) => actualizarPropietario(index, 'estado', e.target.value.toUpperCase())} placeholder="CASADO, SOLTERO, etc." />
                    </div>
                    <div>
                      <Label className="text-xs">Número Documento *</Label>
                      <Input value={prop.numero_documento || ''} onChange={(e) => actualizarPropietario(index, 'numero_documento', e.target.value.replace(/\D/g, '').slice(0, 12))} />
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Información del predio */}
              <div className="border-t pt-4 mt-4">
                <h4 className="font-semibold text-slate-800 mb-3">Información del Predio</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Dirección *</Label>
                    <Input value={formData.direccion} onChange={(e) => setFormData({...formData, direccion: e.target.value.toUpperCase()})} />
                  </div>
                  <div>
                    <Label>Avalúo (COP) *</Label>
                    <Input type="number" value={formData.avaluo_catastral} onChange={(e) => setFormData({...formData, avaluo_catastral: e.target.value})} />
                  </div>
                  <div>
                    <Label>Matrícula Inmobiliaria</Label>
                    <Input value={formData.matricula_inmobiliaria} onChange={(e) => setFormData({...formData, matricula_inmobiliaria: e.target.value})} />
                  </div>
                </div>
              </div>
            </TabsContent>
            
            {/* TAB FÍSICO */}
            <TabsContent value="fisico" className="space-y-4 mt-4">
              {/* Zonas de Terreno */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-slate-800">Zonas de Terreno</h4>
                  <Button type="button" variant="outline" size="sm" onClick={agregarZonaTerreno} className="text-emerald-700">
                    <Plus className="w-4 h-4 mr-1" /> Agregar
                  </Button>
                </div>
                {zonasTerreno.map((zona, index) => (
                  <div key={index} className="border border-slate-200 rounded-lg p-3 bg-slate-50 mb-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Zona {index + 1}</span>
                      {zonasTerreno.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => eliminarZonaTerreno(index)} className="text-red-600 h-6 w-6 p-0">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Zona Física</Label>
                        <Input value={zona.zona_fisica} onChange={(e) => actualizarZonaTerreno(index, 'zona_fisica', e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Zona Económica</Label>
                        <Input value={zona.zona_economica} onChange={(e) => actualizarZonaTerreno(index, 'zona_economica', e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Área Terreno (m²)</Label>
                        <Input type="number" value={zona.area_terreno} onChange={(e) => actualizarZonaTerreno(index, 'area_terreno', e.target.value)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Construcciones */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-slate-800">Construcciones</h4>
                  <Button type="button" variant="outline" size="sm" onClick={agregarConstruccion} className="text-emerald-700">
                    <Plus className="w-4 h-4 mr-1" /> Agregar
                  </Button>
                </div>
                {construcciones.map((const_, index) => (
                  <div key={index} className="border border-amber-200 rounded-lg p-3 bg-amber-50 mb-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-amber-800">Construcción {const_.id}</span>
                      {construcciones.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => eliminarConstruccion(index)} className="text-red-600 h-6 w-6 p-0">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <Label className="text-xs">Piso</Label>
                        <Input type="number" value={const_.piso} onChange={(e) => actualizarConstruccion(index, 'piso', e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Habitaciones</Label>
                        <Input type="number" value={const_.habitaciones} onChange={(e) => actualizarConstruccion(index, 'habitaciones', e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Baños</Label>
                        <Input type="number" value={const_.banos} onChange={(e) => actualizarConstruccion(index, 'banos', e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Área Construida (m²)</Label>
                        <Input type="number" value={const_.area_construida} onChange={(e) => actualizarConstruccion(index, 'area_construida', e.target.value)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Resumen de áreas */}
              <div className="bg-slate-100 rounded-lg p-3">
                <p className="text-sm"><strong>Área Terreno Total:</strong> {calcularAreasTotales().areaTerrenoTotal.toFixed(2)} m²</p>
                <p className="text-sm"><strong>Área Construida Total:</strong> {calcularAreasTotales().areaConstruidaTotal.toFixed(2)} m²</p>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setShowProponerCambiosModal(false)} disabled={enviandoPropuesta}>
              Cancelar
            </Button>
            <Button 
              onClick={enviarPropuestaCambios}
              disabled={enviandoPropuesta}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {enviandoPropuesta ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar Propuesta'
              )}
            </Button>
          </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Cancelación de Predio */}
      <Dialog open={showCancelarModal} onOpenChange={setShowCancelarModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              {esCoordinador ? 'Cancelar Predio' : 'Proponer Cancelación'}
            </DialogTitle>
            <DialogDescription>
              {esCoordinador 
                ? 'Esta acción cancelará el predio permanentemente.'
                : 'Esta propuesta será revisada por un coordinador antes de aplicarse.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            {/* Información del predio */}
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-sm text-slate-600">
                <strong>Código:</strong> {predioSeleccionado?.codigo_predial || predioSeleccionado?.numero_predial}
              </p>
              <p className="text-sm text-slate-600">
                <strong>Dirección:</strong> {predioSeleccionado?.direccion || 'Sin dirección'}
              </p>
              {predioSeleccionado?.propietarios?.[0] && (
                <p className="text-sm text-slate-600">
                  <strong>Propietario:</strong> {predioSeleccionado.propietarios[0].nombre_propietario || 
                    `${predioSeleccionado.propietarios[0].primer_nombre || ''} ${predioSeleccionado.propietarios[0].primer_apellido || ''}`}
                </p>
              )}
            </div>
            
            {/* Motivo de cancelación */}
            <div>
              <Label className="text-sm font-medium text-red-700">
                Motivo de cancelación *
              </Label>
              <Textarea
                value={motivoCancelacion}
                onChange={(e) => setMotivoCancelacion(e.target.value)}
                placeholder="Ej: Predio duplicado, error de digitación, predio fusionado con otro..."
                className="mt-1 min-h-[100px]"
              />
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-700">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                {esCoordinador 
                  ? 'Los predios cancelados no se eliminarán físicamente, solo se marcarán como cancelados y no aparecerán en las listas.'
                  : 'Su propuesta de cancelación será revisada por un coordinador antes de ser aprobada.'}
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelarModal(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={cancelarPredio}
              disabled={cancelando || !motivoCancelacion.trim()}
            >
              {cancelando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {esCoordinador ? 'Cancelando...' : 'Enviando...'}
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  {esCoordinador ? 'Confirmar Cancelación' : 'Enviar Propuesta'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
