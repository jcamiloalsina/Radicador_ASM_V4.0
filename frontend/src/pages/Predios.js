import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Plus, Search, Edit, Trash2, MapPin, FileText, Building, 
  User, DollarSign, LayoutGrid, Eye, History, Download, AlertTriangle, Users,
  Clock, CheckCircle, XCircle, Bell, Map, Upload, Loader2, RefreshCw, AlertCircle, WifiOff, FileEdit, Database, X, Calendar, Hash, ArrowRight, Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import PredioMap from '../components/PredioMap';
import useOfflineSync from '../hooks/useOfflineSync';
import { DownloadProgressBar } from '../components/OfflineComponents';
import { clearAllOfflineData, getPrediosOffline, getPrediosByMunicipioOffline } from '../utils/offlineDB';

// Componentes de Conservación refactorizados
import { 
  MunicipioCard, 
  StatsPanel, 
  Pagination,
  ImportR1R2Form,
  PrediosEliminadosView,
  ReaparicionesPendientes,
  SubsanacionesPendientes,
  CodigoPredialBuilder,
  PropietariosList,
  usePropietarios,
  useZonasTerreno,
  useZonasFisicas,
  useConstrucciones,
  generarIdConstruccion,
  calcularAreasTotales as calcularAreasTotalesUtil,
  calcularTotalRegistrosR2 as calcularTotalRegistrosR2Util
} from '../components/conservacion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Componente memoizado para la guía visual del nombre - evita re-renders innecesarios
const GuiaNombre = memo(({ nombre }) => {
  const partes = (nombre || '').trim().split(/\s+/).filter(Boolean);
  const apellido1 = partes[0] || '________';
  const apellido2 = partes[1] || '________';
  const nombre1 = partes[2] || '________';
  const nombre2 = partes[3] || '';
  const extras = partes.slice(4).join(' ');
  
  return (
    <div className="mt-2 bg-slate-100 rounded-lg p-2 border border-slate-200">
      <div className="flex flex-wrap gap-1 text-xs font-mono">
        <span className={`px-2 py-1 rounded ${partes[0] ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-slate-200 text-slate-400'}`}>
          {apellido1}
        </span>
        <span className={`px-2 py-1 rounded ${partes[1] ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-slate-200 text-slate-400'}`}>
          {apellido2}
        </span>
        <span className={`px-2 py-1 rounded ${partes[2] ? 'bg-purple-100 text-purple-700 border border-purple-300' : 'bg-slate-200 text-slate-400'}`}>
          {nombre1}
        </span>
        {(partes[3] || partes.length >= 3) && (
          <span className={`px-2 py-1 rounded ${partes[3] ? 'bg-orange-100 text-orange-700 border border-orange-300' : 'bg-slate-200 text-slate-400'}`}>
            {nombre2 || '________'}
          </span>
        )}
        {extras && (
          <span className="px-2 py-1 rounded bg-red-100 text-red-700 border border-red-300">
            {extras} (extra)
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1 text-[10px] mt-1 text-slate-500">
        <span className="px-2">↑ Apellido 1</span>
        <span className="px-2">↑ Apellido 2</span>
        <span className="px-2">↑ Nombre 1</span>
        <span className="px-2">↑ Nombre 2</span>
      </div>
    </div>
  );
});

// Helper function para obtener la zona del código predial y formatear texto
const getZonaFromCodigo = (codigoPredial) => {
  if (!codigoPredial || codigoPredial.length < 7) return { codigo: '', texto: 'N/A' };
  const zonaCodigo = codigoPredial.substring(5, 7);
  let texto;
  if (zonaCodigo === '00') {
    texto = 'Rural';
  } else if (zonaCodigo === '01') {
    texto = 'Urbano';
  } else {
    texto = `Corregimiento (${zonaCodigo})`;
  }
  return { codigo: zonaCodigo, texto };
};

// Helper para obtener todas las partes del código predial
const getCodigoPartes = (codigoPredial) => {
  if (!codigoPredial || codigoPredial.length < 21) return {};
  return {
    departamento: codigoPredial.substring(0, 2),
    municipio: codigoPredial.substring(2, 5),
    zona: codigoPredial.substring(5, 7),
    sector: codigoPredial.substring(7, 9),
    comuna: codigoPredial.substring(9, 11),
    barrio: codigoPredial.substring(11, 13),
    manzana_vereda: codigoPredial.substring(13, 17),
    terreno: codigoPredial.substring(17, 21),
    // Partes adicionales para códigos completos (30 caracteres)
    condicion: codigoPredial.length >= 22 ? codigoPredial.substring(21, 22) : '0',
    edificio: codigoPredial.length >= 24 ? codigoPredial.substring(22, 24) : '00',
    piso: codigoPredial.length >= 26 ? codigoPredial.substring(24, 26) : '00',
    unidad: codigoPredial.length >= 30 ? codigoPredial.substring(26, 30) : '0000'
  };
};

export default function Predios() {
  const { user } = useAuth();
  const { addListener, isConnected } = useWebSocket() || {};
  
  // Hook de sincronización offline para Conservación
  const {
    isOnline,
    isSyncing,
    offlineStats, 
    downloadForOffline, 
    saveChangeOffline,
    syncPendingChanges,
    pendingChangesCount
  } = useOfflineSync(null, 'conservacion');
  
  // Router hooks para manejar parámetros de URL
  const location = useLocation();
  const navigate = useNavigate();
  
  // Estado para la barra de progreso de descarga offline
  const [downloadProgress, setDownloadProgress] = useState({
    isDownloading: false,
    current: 0,
    total: 0,
    label: ''
  });
  
  // Comunicaciones y Empresa solo pueden ver, no pueden crear/editar/eliminar predios
  const canModifyPredios = user && !['usuario', 'comunicaciones', 'empresa'].includes(user.role);
  
  // Rol empresa: no puede ver estadísticas generales (total predios, avalúo, área, base gráfica)
  const isEmpresaRole = user?.role === 'empresa';
  
  // Solo coordinador y administrador pueden editar el código predial nacional
  const isCoordinadorPredios = user && ['coordinador', 'administrador'].includes(user.role);
  const canEditCodigoPredial = isCoordinadorPredios;
  
  const [predios, setPredios] = useState([]);
  const [catalogos, setCatalogos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [filterMunicipio, setFilterMunicipio] = useState('');
  const [filterVigencia, setFilterVigencia] = useState(String(new Date().getFullYear()));
  const [filterGeometria, setFilterGeometria] = useState(''); // '', 'con', 'sin'
  const [vigenciasData, setVigenciasData] = useState({});
  const [showDashboard, setShowDashboard] = useState(true);
  const [prediosStats, setPrediosStats] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showDeletedDialog, setShowDeletedDialog] = useState(false);
  const [showPendientesDialog, setShowPendientesDialog] = useState(false);
  const [showReaparicionesDialog, setShowReaparicionesDialog] = useState(false);
  const [showSubsanacionesDialog, setShowSubsanacionesDialog] = useState(false);
  const [subsanacionesConteo, setSubsanacionesConteo] = useState(0);
  const [reaparicionesConteo, setReaparicionesConteo] = useState({});
  const [gdbStats, setGdbStats] = useState(null); // Estadísticas de geometrías GDB
  const [selectedPredio, setSelectedPredio] = useState(null);
  // Estado para determinar si el predio usa formato automático (R2→R1) o manual
  const [usarFormatoAutomatico, setUsarFormatoAutomatico] = useState(false);
  const [prediosEliminados, setPrediosEliminados] = useState([]);
  const [prediosEliminadosFiltrados, setPrediosEliminadosFiltrados] = useState([]);
  const [eliminadosSearch, setEliminadosSearch] = useState('');
  const [eliminadosMunicipio, setEliminadosMunicipio] = useState('');
  const [eliminadosLoading, setEliminadosLoading] = useState(false);
  const [cambiosPendientes, setCambiosPendientes] = useState([]);
  const [cambiosHistorial, setCambiosHistorial] = useState([]);
  const [historialTab, setHistorialTab] = useState('pendientes');
  const [cambiosStats, setCambiosStats] = useState(null);
  const [terrenoInfo, setTerrenoInfo] = useState(null);
  const [estructuraCodigo, setEstructuraCodigo] = useState(null);
  const [verificacionCodigo, setVerificacionCodigo] = useState(null);
  const [ultimaManzanaInfo, setUltimaManzanaInfo] = useState(null); // Info de última manzana por sector
  const [prediosEnManzana, setPrediosEnManzana] = useState([]); // Últimos predios en la manzana seleccionada
  const [buscandoPrediosManzana, setBuscandoPrediosManzana] = useState(false);
  const [siguienteTerrenoSugerido, setSiguienteTerrenoSugerido] = useState('0001');
  
  // ====== ESTADOS PARA CACHÉ INTELIGENTE (Stale-While-Revalidate) ======
  const [dataSource, setDataSource] = useState('loading'); // 'cache', 'server', 'loading', 'offline'
  const [lastSyncTime, setLastSyncTime] = useState(null); // Timestamp de última sincronización
  const [isRevalidating, setIsRevalidating] = useState(false); // Indica si está actualizando en segundo plano
  const [cacheAge, setCacheAge] = useState(null); // Antigüedad del caché en minutos
  
  // ID del predio nuevo que estamos editando (para actualizaciones)
  const [editingPredioNuevoId, setEditingPredioNuevoId] = useState(null);
  // URL de retorno después de editar un predio (cuando viene de Pendientes)
  const [returnUrl, setReturnUrl] = useState(null);
  
  // Estados para modal de eliminación de predio
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [predioAEliminar, setPredioAEliminar] = useState(null);
  const [eliminacionData, setEliminacionData] = useState({
    radicado: '',
    resolucion: '',
    fecha_resolucion: '',
    motivo: ''
  });
  
  // Estados para información de resolución en editar predio
  const [infoResolucion, setInfoResolucion] = useState({
    tipo_mutacion: '',
    numero_resolucion: '',
    fecha_resolucion: '',
    radicado_peticion: ''
  });
  const [radicadosDisponibles, setRadicadosDisponibles] = useState([]);
  const [cargandoNumeroResolucion, setCargandoNumeroResolucion] = useState(false);
  
  // Paginación server-side
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;
  
  const [codigoManual, setCodigoManual] = useState({
    zona: '00',          // Posición 6-7 (2 dígitos) - 00=rural, 01=urbano, 02-99=corregimiento
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
  
  // Estado para códigos homologados
  const [showCodigosDialog, setShowCodigosDialog] = useState(false);
  const [codigosStats, setCodigosStats] = useState([]);
  const [loadingCodigos, setLoadingCodigos] = useState(false);
  const [uploadingCodigos, setUploadingCodigos] = useState(false);
  const [siguienteCodigoHomologado, setSiguienteCodigoHomologado] = useState(null);
  const [codigosMunicipioSeleccionado, setCodigosMunicipioSeleccionado] = useState('');
  const [codigosFileSelected, setCodigosFileSelected] = useState(null);
  const [codigosUsados, setCodigosUsados] = useState([]);
  const [loadingCodigosUsados, setLoadingCodigosUsados] = useState(false);
  const [codigosUsadosMunicipio, setCodigosUsadosMunicipio] = useState('');
  const [recalculandoCodigos, setRecalculandoCodigos] = useState(false);
  const [diagnosticoCodigos, setDiagnosticoCodigos] = useState(null);
  const [loadingDiagnostico, setLoadingDiagnostico] = useState(false);
  const [showDiagnosticoDialog, setShowDiagnosticoDialog] = useState(false);
  const [forzarDisponibles, setForzarDisponibles] = useState(false);
  
  // Estados para prevenir doble clic en acciones
  const [isSavingUpdate, setIsSavingUpdate] = useState(false);
  const [isSavingCreate, setIsSavingCreate] = useState(false);
  const [isSavingDelete, setIsSavingDelete] = useState(false);
  const [isApprovingChange, setIsApprovingChange] = useState(false);
  
  // Estado para múltiples propietarios (formato simplificado)
  const [propietarios, setPropietarios] = useState([{
    nombre_propietario: '',
    estado_civil: '',
    tipo_documento: 'C',
    numero_documento: ''
  }]);
  
  // Estado para mostrar diálogo de confirmación al cerrar sin completar
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  
  // Estado para zonas de terreno (R2) - SEPARADO
  const [zonasTerreno, setZonasTerreno] = useState([{
    zona_fisica: '',
    zona_economica: '',
    area_terreno: '0'
  }]);
  
  // Estado para construcciones (R2) - SEPARADO
  const [construcciones, setConstrucciones] = useState([{
    id: 'A',
    piso: '0',
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
    pisos: '0',
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
      pisos: '0',
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
  
  // Estados para el nuevo flujo "Crear Predio" con workflow
  const [radicadoNumero, setRadicadoNumero] = useState(''); // Solo los 4 dígitos (XXXX)
  const [radicadoInfo, setRadicadoInfo] = useState(null); // Info del radicado buscado
  const [buscandoRadicado, setBuscandoRadicado] = useState(false);
  const [peticionesRelacionadas, setPeticionesRelacionadas] = useState([]); // IDs de peticiones
  const [peticionesDisponibles, setPeticionesDisponibles] = useState([]); // Lista de peticiones para seleccionar
  const [observacionesCreacion, setObservacionesCreacion] = useState('');
  const [usarNuevoFlujo, setUsarNuevoFlujo] = useState(false); // Toggle para usar el nuevo flujo
  
  const [formData, setFormData] = useState({
    municipio: '',
    zona: '00',
    sector: '01',
    manzana_vereda: '0000',
    condicion_predio: '0000',
    predio_horizontal: '0000',
    nombre_propietario: '',
    tipo_documento: 'C',
    numero_documento: '',
    estado_civil: '',
    direccion: '',
    comuna: '0',
    destino_economico: 'A',
    area_terreno: '',
    area_construida: '0',
    avaluo: '',
    tipo_mutacion: '',
    numero_resolucion: '',
    fecha_resolucion: '',
    // Acto administrativo obligatorio
    acto_administrativo: '',
    // R2
    matricula_inmobiliaria: '',
    zona_fisica_1: '0',
    zona_economica_1: '0',
    area_terreno_1: '0',
    habitaciones_1: '0',
    banos_1: '0',
    locales_1: '0',
    pisos_1: '0',
    puntaje_1: '0',
    area_construida_1: '0'
  });
  
  // Funciones para manejar múltiples propietarios
  const agregarPropietario = () => {
    setPropietarios([...propietarios, {
      nombre_propietario: '',
      estado_civil: '',
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
  
  // Función para cargar el siguiente número de resolución
  const cargarSiguienteNumeroResolucion = async (codigoMunicipio) => {
    if (!codigoMunicipio) return;
    setCargandoNumeroResolucion(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/resoluciones/siguiente-numero/${codigoMunicipio}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setInfoResolucion(prev => ({
          ...prev,
          numero_resolucion: data.numero_resolucion,
          fecha_resolucion: data.fecha_resolucion
        }));
      }
    } catch (error) {
      console.error('Error cargando número de resolución:', error);
    } finally {
      setCargandoNumeroResolucion(false);
    }
  };
  
  // Función para cargar radicados disponibles con búsqueda
  const cargarRadicadosDisponibles = async (municipio, busqueda = '') => {
    try {
      const token = localStorage.getItem('token');
      let url = `${API}/resoluciones/radicados-disponibles?`;
      if (municipio) url += `municipio=${encodeURIComponent(municipio)}&`;
      if (busqueda) url += `busqueda=${encodeURIComponent(busqueda)}`;
      
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setRadicadosDisponibles(data.radicados || []);
      }
    } catch (error) {
      console.error('Error cargando radicados:', error);
    }
  };
  
  // Función para parsear números en formato colombiano (200.000 = doscientos mil)
  // Elimina puntos de miles y convierte comas a puntos decimales
  const parsearNumeroColombiano = (valor) => {
    if (!valor || valor === '') return 0;
    // Convertir a string
    let str = String(valor);
    // Si tiene punto y coma, el punto es separador de miles y la coma es decimal
    // Ej: 1.200.000,50 = 1200000.50
    if (str.includes(',')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Si solo tiene puntos, determinar si es decimal o miles
      const puntos = (str.match(/\./g) || []).length;
      if (puntos > 1) {
        // Múltiples puntos = separadores de miles (200.000.000)
        str = str.replace(/\./g, '');
      } else if (puntos === 1) {
        // Un solo punto: verificar si parece miles o decimal
        const partes = str.split('.');
        // Si la parte después del punto tiene 3 dígitos, probablemente es miles
        if (partes[1] && partes[1].length === 3) {
          str = str.replace('.', '');
        }
        // Si no, dejar como decimal (200.50)
      }
    }
    return parseFloat(str) || 0;
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
      piso: '0',
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

  // Estado para asignar a otro gestor
  const [gestoresDisponibles, setGestoresDisponibles] = useState([]);
  const [gestorAsignado, setGestorAsignado] = useState('');
  
  // Estado para seleccionar radicado asociado a modificaciones
  const [radicadoSeleccionado, setRadicadoSeleccionado] = useState('');
  
  // Estado para flujo de gestor de apoyo en modificaciones (opcional)
  const [usarGestorApoyoMod, setUsarGestorApoyoMod] = useState(false);
  const [gestorApoyoModificacion, setGestorApoyoModificacion] = useState('');
  const [observacionesApoyoMod, setObservacionesApoyoMod] = useState('');
  // Cargar gestores disponibles para asignar trabajo
  const fetchGestoresDisponibles = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/users/gestores-disponibles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGestoresDisponibles(res.data || []);
    } catch (error) {
      console.log('Error cargando gestores disponibles');
      setGestoresDisponibles([]);
    }
  };
  
  // Cargar peticiones disponibles para asociar a modificaciones
  const fetchPeticionesParaModificacion = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/petitions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Filtrar peticiones en estado asignado o en_revision (activas)
      const peticiones = res.data.filter(p => 
        ['asignado', 'en_revision'].includes(p.estado)
      ).sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion));
      setPeticionesDisponibles(peticiones);
    } catch (error) {
      console.log('Error cargando peticiones');
    }
  };

  // ====== FUNCIONES HELPER PARA CACHÉ INTELIGENTE ======
  
  // Calcular antigüedad del caché en minutos
  const calculateCacheAge = useCallback((syncTimeStr) => {
    if (!syncTimeStr) return null;
    const syncTime = new Date(syncTimeStr);
    const now = new Date();
    const diffMs = now - syncTime;
    return Math.floor(diffMs / (1000 * 60)); // minutos
  }, []);
  
  // Obtener color del indicador según antigüedad
  const getCacheStatusColor = useCallback((ageMinutes) => {
    if (ageMinutes === null) return 'text-slate-400';
    if (ageMinutes < 5) return 'text-emerald-600'; // Verde: < 5 min
    if (ageMinutes < 60) return 'text-amber-600'; // Amarillo: 5-60 min
    return 'text-red-600'; // Rojo: > 60 min
  }, []);
  
  // Formatear tiempo relativo
  const formatTimeAgo = useCallback((syncTimeStr) => {
    if (!syncTimeStr) return 'Nunca';
    const ageMinutes = calculateCacheAge(syncTimeStr);
    if (ageMinutes === null) return 'Nunca';
    if (ageMinutes < 1) return 'Hace un momento';
    if (ageMinutes < 60) return `Hace ${ageMinutes} min`;
    const hours = Math.floor(ageMinutes / 60);
    if (hours < 24) return `Hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Hace ${days} día${days > 1 ? 's' : ''}`;
  }, [calculateCacheAge]);
  
  // Actualizar la antigüedad del caché cada minuto
  useEffect(() => {
    if (!lastSyncTime) return;
    
    const updateAge = () => {
      setCacheAge(calculateCacheAge(lastSyncTime));
    };
    updateAge();
    
    const interval = setInterval(updateAge, 60000); // Cada minuto
    return () => clearInterval(interval);
  }, [lastSyncTime, calculateCacheAge]);
  
  // Actualizar caché local después de operaciones CRUD
  const updateLocalCache = useCallback(async (operation, predio) => {
    if (!filterMunicipio) return;
    
    try {
      // Actualizar el estado local inmediatamente
      if (operation === 'create') {
        setPredios(prev => {
          const updated = [predio, ...prev];
          return sortPrediosByCNP(updated);
        });
        setTotal(prev => prev + 1);
      } else if (operation === 'update') {
        setPredios(prev => prev.map(p => 
          (p._id === predio._id || p.numero_predial === predio.numero_predial) ? predio : p
        ));
      } else if (operation === 'delete') {
        setPredios(prev => prev.filter(p => 
          p._id !== predio._id && p.numero_predial !== predio.numero_predial
        ));
        setTotal(prev => Math.max(0, prev - 1));
      }
      
      // Actualizar el caché en IndexedDB en segundo plano
      const currentPredios = await getPrediosByMunicipioOffline(filterMunicipio);
      let updatedPredios;
      
      if (operation === 'create') {
        updatedPredios = [predio, ...currentPredios];
      } else if (operation === 'update') {
        updatedPredios = currentPredios.map(p => 
          (p._id === predio._id || p.numero_predial === predio.numero_predial) ? predio : p
        );
      } else if (operation === 'delete') {
        updatedPredios = currentPredios.filter(p => 
          p._id !== predio._id && p.numero_predial !== predio.numero_predial
        );
      }
      
      if (updatedPredios) {
        await downloadForOffline(updatedPredios, null, filterMunicipio);
        const now = new Date().toISOString();
        localStorage.setItem(`sync_${filterMunicipio}_date`, now);
        setLastSyncTime(now);
        setDataSource('server');
      }
    } catch (error) {
      console.warn('[Cache] Error actualizando caché local:', error);
    }
  }, [filterMunicipio, downloadForOffline]);

  useEffect(() => {
    // Ejecutar todas las cargas iniciales en paralelo
    Promise.all([
      fetchCatalogos(),
      fetchVigencias(),
      fetchPrediosStats(),
      fetchCambiosStats(),
      fetchReaparicionesConteo(),
      fetchSubsanacionesConteo(),
      fetchGdbStats(),
      fetchGestoresDisponibles(),
      fetchPeticionesParaModificacion()
    ]).catch(() => {});
    checkAutoSyncMonday();
  }, []);
  
  // Función para verificar y ejecutar sincronización automática los lunes
  const checkAutoSyncMonday = async () => {
    const today = new Date();
    const isMonday = today.getDay() === 1; // 0=Domingo, 1=Lunes
    
    if (!isMonday || !navigator.onLine) return;
    
    // Obtener todos los municipios sincronizados
    const syncedMunicipios = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sync_') && key.endsWith('_date')) {
        const municipio = key.replace('sync_', '').replace('_date', '');
        const lastSyncDate = localStorage.getItem(key);
        if (lastSyncDate) {
          const lastSync = new Date(lastSyncDate);
          const daysSinceSync = Math.floor((today - lastSync) / (1000 * 60 * 60 * 24));
          
          // Si han pasado más de 6 días desde la última sincronización
          if (daysSinceSync >= 6) {
            syncedMunicipios.push(municipio);
          }
        }
      }
    }
    
    // Si hay municipios que sincronizar, mostrar notificación
    if (syncedMunicipios.length > 0) {
      toast.info(
        `🔄 Sincronización semanal: ${syncedMunicipios.length} municipio(s) necesitan actualización`,
        { 
          duration: 10000,
          action: {
            label: 'Sincronizar ahora',
            onClick: () => autoSyncMunicipios(syncedMunicipios)
          }
        }
      );
    }
  };
  
  // Sincronizar múltiples municipios automáticamente
  const autoSyncMunicipios = async (municipios) => {
    toast.info(`Iniciando sincronización de ${municipios.length} municipio(s)...`);
    
    for (const municipio of municipios) {
      try {
        await syncMunicipioManual(municipio);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa entre municipios
      } catch (error) {
        console.error(`Error sincronizando ${municipio}:`, error);
      }
    }
    
    toast.success(`✅ Sincronización semanal completada`);
  };

  useEffect(() => {
    if (filterMunicipio && filterVigencia) {
      fetchPredios();
      setShowDashboard(false);
    }
  }, [filterMunicipio, filterVigencia, filterGeometria]);

  // Debounce para búsqueda: cuando el usuario escribe, buscar del servidor después de 500ms
  useEffect(() => {
    if (!filterMunicipio || !filterVigencia) return;
    
    // Debounce de 500ms para evitar llamadas excesivas
    const timeoutId = setTimeout(() => {
      // Si hay búsqueda activa de 3+ caracteres, FORZAR consulta del servidor
      // para asegurar resultados frescos (ignorando caché que puede estar desactualizado)
      if (search && search.length >= 3) {
        console.log('[Predios] Búsqueda activa, consultando servidor:', search);
        fetchPrediosFromServer();
      }
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [search]);

  // Manejar parámetro predio_nuevo de la URL para abrir un predio nuevo en modo edición
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const predioNuevoId = params.get('predio_nuevo');
    const fromUrl = params.get('return');
    const isEmbedded = params.get('embedded') === 'true';
    
    if (predioNuevoId) {
      // Si está embebido en un iframe, no necesitamos URL de retorno
      if (isEmbedded) {
        setReturnUrl(null);
      } else if (fromUrl) {
        setReturnUrl(decodeURIComponent(fromUrl));
      } else {
        // Por defecto, regresar a pendientes si viene con predio_nuevo
        setReturnUrl('/dashboard/pendientes');
      }
      
      // Cargar el predio nuevo y abrir el modal de creación para editarlo
      const loadPredioNuevo = async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(`${API}/predios-nuevos/${predioNuevoId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          const predioNuevo = response.data;
          console.log('Predio cargado para edición:', predioNuevo);
          
          // Configurar el municipio
          if (predioNuevo.municipio) {
            setFilterMunicipio(predioNuevo.municipio);
          }
          
          // Extraer datos de R1 y R2 si existen como objetos
          const r1Data = predioNuevo.r1 || {};
          const r2Data = predioNuevo.r2 || {};
          
          // Llenar el formulario con los datos del predio nuevo
          setFormData({
            municipio: predioNuevo.municipio || '',
            direccion: predioNuevo.direccion || '',
            area_terreno: predioNuevo.area_terreno || '',
            area_construida: predioNuevo.area_construida || '',
            avaluo: predioNuevo.avaluo || '',
            destino_economico: predioNuevo.destino_economico || '',
            zona: predioNuevo.zona || '',
            codigo_predial_nacional: predioNuevo.codigo_predial_nacional || '',
            // R1 fields (desde objeto r1 o campos planos)
            numero_orden_1: r1Data.numero_orden || predioNuevo.numero_orden_1 || '0',
            calificacion_no_certificada_1: r1Data.calificacion_no_certificada || predioNuevo.calificacion_no_certificada_1 || '0',
            tipo_predio_1: r1Data.tipo_predio || predioNuevo.tipo_predio_1 || '',
            numero_predial_anterior_1: r1Data.numero_predial_anterior || predioNuevo.numero_predial_anterior_1 || '',
            complemento_nom_predio_1: r1Data.complemento_nom_predio || predioNuevo.complemento_nom_predio_1 || '',
            area_total_terreno_1: r1Data.area_total_terreno || predioNuevo.area_total_terreno_1 || '',
            valor_referencia_1: r1Data.valor_referencia || predioNuevo.valor_referencia_1 || '',
            tipo_avaluo_catastral_1: r1Data.tipo_avaluo_catastral || predioNuevo.tipo_avaluo_catastral_1 || '',
            // R2 fields (desde objeto r2 o campos planos)
            numero_orden_2: r2Data.numero_orden || predioNuevo.numero_orden_2 || '0',
            tipo_construccion_2: r2Data.tipo_construccion || predioNuevo.tipo_construccion_2 || '',
            numero_pisos_2: r2Data.pisos_1 || r2Data.numero_pisos || predioNuevo.numero_pisos_2 || '0',
            numero_habitaciones_2: r2Data.habitaciones_1 || r2Data.numero_habitaciones || predioNuevo.numero_habitaciones_2 || '0',
            numero_banios_2: r2Data.banos_1 || r2Data.numero_banios || predioNuevo.numero_banios_2 || '0',
            numero_locales_2: r2Data.locales_1 || r2Data.numero_locales || predioNuevo.numero_locales_2 || '0',
            anio_construccion_2: r2Data.anio_construccion || predioNuevo.anio_construccion_2 || '',
            total_area_construida_2: r2Data.area_construida_1 || r2Data.total_area_construida || predioNuevo.total_area_construida_2 || '',
            area_privada_construida_2: r2Data.area_privada_construida || predioNuevo.area_privada_construida_2 || '',
            area_total_lote_2: r2Data.area_terreno_1 || r2Data.area_total_lote || predioNuevo.area_total_lote_2 || '',
            puntaje_2: r2Data.puntaje_1 || r2Data.puntaje || predioNuevo.puntaje_2 || '0',
            valor_m2_construccion_2: r2Data.valor_m2_construccion || predioNuevo.valor_m2_construccion_2 || '0',
            valor_m2_terreno_2: r2Data.valor_m2_terreno || predioNuevo.valor_m2_terreno_2 || '0',
            uso_predominante_2: r2Data.uso_1 || r2Data.uso_predominante || predioNuevo.uso_predominante_2 || '',
            // Campos adicionales de R2
            matricula_inmobiliaria: r2Data.matricula_inmobiliaria || predioNuevo.matricula_inmobiliaria || '',
            zona_fisica_1: r2Data.zona_fisica_1 || '',
            zona_economica_1: r2Data.zona_economica_1 || '',
          });
          
          // Configurar propietarios - manejar tanto array como campos separados (nuevo formato XTF)
          if (predioNuevo.propietarios && predioNuevo.propietarios.length > 0) {
            // Convertir propietarios existentes al nuevo formato si es necesario
            const propietariosConvertidos = predioNuevo.propietarios.map(p => ({
              nombre_propietario: p.nombre_propietario || generarNombreCompleto(p) || '',
              estado_civil: p.estado_civil || p.estado || 'sin_especificar',
              tipo_documento: p.tipo_documento || 'C',
              numero_documento: p.numero_documento || ''
            }));
            setPropietarios(propietariosConvertidos);
          } else if (predioNuevo.nombre_propietario || predioNuevo.primer_apellido) {
            // Si no hay array de propietarios pero hay datos del propietario principal
            const nombreCompleto = predioNuevo.nombre_propietario || 
              [predioNuevo.primer_apellido, predioNuevo.segundo_apellido, predioNuevo.primer_nombre, predioNuevo.segundo_nombre].filter(Boolean).join(' ');
            setPropietarios([{
              nombre_propietario: nombreCompleto,
              estado_civil: predioNuevo.estado_civil || predioNuevo.estado || 'sin_especificar',
              tipo_documento: predioNuevo.tipo_documento || 'C',
              numero_documento: predioNuevo.numero_documento || ''
            }]);
          }
          
          // Configurar zonas físicas si existen (formato antiguo)
          if (predioNuevo.zonas_fisicas && predioNuevo.zonas_fisicas.length > 0) {
            setZonasFisicas(predioNuevo.zonas_fisicas);
          } else {
            // Cargar desde campos planos del R2
            setZonasFisicas([{
              zona_fisica: predioNuevo.zona_fisica_1 || r2Data.zona_fisica_1 || '0',
              zona_economica: predioNuevo.zona_economica_1 || r2Data.zona_economica_1 || '0',
              area_terreno: predioNuevo.area_terreno_1 ?? r2Data.area_terreno_1 ?? '0',
              habitaciones: predioNuevo.habitaciones_1 ?? r2Data.habitaciones_1 ?? '0',
              banos: predioNuevo.banos_1 ?? r2Data.banos_1 ?? '0',
              locales: predioNuevo.locales_1 ?? r2Data.locales_1 ?? '0',
              pisos: predioNuevo.pisos_1 ?? r2Data.pisos_1 ?? '0',
              puntaje: predioNuevo.puntaje_1 ?? r2Data.puntaje_1 ?? '0',
              area_construida: predioNuevo.area_construida_1 ?? r2Data.area_construida_1 ?? '0'
            }]);
          }
          
          // Cargar nuevo formato R2 SOLO si el predio ya tiene la nueva estructura
          // (NO convertir predios antiguos para mantener consistencia R1/R2)
          if (predioNuevo.zonas && predioNuevo.zonas.length > 0) {
            setZonasTerreno(predioNuevo.zonas.map(z => ({
              zona_fisica: z.zona_fisica || '',
              zona_economica: z.zona_economica || '',
              area_terreno: String(z.area_terreno || 0)
            })));
          }
          
          if (predioNuevo.construcciones && predioNuevo.construcciones.length > 0) {
            setConstrucciones(predioNuevo.construcciones.map(c => ({
              id: c.id || 'A',
              piso: String(c.piso ?? 0),
              habitaciones: String(c.habitaciones ?? 0),
              banos: String(c.banos ?? 0),
              locales: String(c.locales ?? 0),
              tipificacion: c.tipificacion || '',
              uso: c.uso || '',
              puntaje: String(c.puntaje ?? 0),
              area_construida: String(c.area_construida ?? 0)
            })));
          }
          
          // Configurar el código manual si existe
          if (predioNuevo.codigo_predial_nacional) {
            const partes = getCodigoPartes(predioNuevo.codigo_predial_nacional);
            setCodigoManual({
              zona: partes.zona || '00',
              sector: partes.sector || '00',
              comuna: partes.comuna || '00',
              barrio: partes.barrio || '00',
              manzana_vereda: partes.manzana_vereda || '0000',
              terreno: partes.terreno || '0001',
              condicion: partes.condicion || '0',
              edificio: partes.edificio || '00',
              piso: partes.piso || '00',
              unidad: partes.unidad || '0000'
            });
          }
          
          // Configurar radicado si existe
          if (predioNuevo.radicado_id) {
            setRadicadoSeleccionado(predioNuevo.radicado_id);
          }
          
          // Configurar para usar el nuevo flujo
          setUsarNuevoFlujo(true);
          setGestorAsignado(predioNuevo.gestor_apoyo_id || '');
          
          // Guardar el ID del predio nuevo que estamos editando
          setEditingPredioNuevoId(predioNuevoId);
          
          // Abrir el dialog de creación
          setShowCreateDialog(true);
          setShowDashboard(false);
          
          // Limpiar el parámetro de la URL
          navigate('/dashboard/predios', { replace: true });
          
          toast.info('Predio nuevo cargado para edición');
        } catch (error) {
          console.error('Error loading predio nuevo:', error);
          toast.error('Error al cargar el predio nuevo');
          navigate('/dashboard/predios', { replace: true });
        }
      };
      
      loadPredioNuevo();
    }
  }, [location.search, navigate]);

  // Auto-seleccionar municipio cuando se abre el diálogo
  useEffect(() => {
    if (showCreateDialog && filterMunicipio) {
      setFormData(prev => ({ ...prev, municipio: filterMunicipio }));
    }
  }, [showCreateDialog, filterMunicipio]);

  // Obtener info del terreno cuando cambia la ubicación
  useEffect(() => {
    if (formData.municipio && showCreateDialog) {
      fetchTerrenoInfo();
      fetchEstructuraCodigo();
    }
  }, [formData.municipio, showCreateDialog]);

  // Sugerir código cuando cambian los campos del código manual
  useEffect(() => {
    if (formData.municipio && showCreateDialog && codigoManual.zona && codigoManual.manzana_vereda) {
      fetchSugerenciaCodigo();
    }
  }, [codigoManual.zona, codigoManual.sector, codigoManual.comuna, codigoManual.barrio, codigoManual.manzana_vereda, formData.municipio, showCreateDialog]);

  // Obtener última manzana cuando cambia zona o sector
  useEffect(() => {
    if (formData.municipio && showCreateDialog && codigoManual.zona && codigoManual.sector) {
      fetchUltimaManzana();
    }
  }, [codigoManual.zona, codigoManual.sector, formData.municipio, showCreateDialog]);

  // === WEBSOCKET LISTENER FOR REAL-TIME SYNC ===
  // Escuchar notificaciones de cambios en predios para sincronización automática
  useEffect(() => {
    if (!addListener) return;
    
    const handleWebSocketMessage = (message) => {
      // Manejar cambios de predio aprobados/rechazados (flujo de aprobación)
      if (message.type === 'cambio_predio') {
        console.log('[Predios] WebSocket: Cambio de predio notificado', message);
        
        // Si el cambio es del municipio actual, actualizar datos
        if (message.municipio === filterMunicipio || !filterMunicipio) {
          // Actualizar estadísticas de cambios
          fetchCambiosStats();
          
          // Si estamos viendo el historial, actualizarlo también
          if (showPendientesDialog && historialTab === 'historial') {
            fetchCambiosHistorial();
          }
          
          // Si el cambio fue aprobado y estamos en el municipio afectado, sugerir sincronizar
          if (message.action === 'aprobado' && message.municipio === filterMunicipio) {
            // Auto-sincronizar los datos del municipio
            fetchPredios();
          }
        }
      }
      
      // Manejar actualizaciones en tiempo real de predios (CRUD directo)
      if (message.type === 'predio_actualizado') {
        console.log('[Predios] WebSocket: Predio actualizado en tiempo real', message);
        
        // Si el cambio es del municipio actual, actualizar datos automáticamente
        if (message.municipio === filterMunicipio) {
          // Mostrar notificación del cambio
          const actionLabels = {
            'create': 'creó',
            'update': 'modificó', 
            'delete': 'eliminó',
            'import': 'importó'
          };
          const actionLabel = actionLabels[message.action] || 'actualizó';
          const userName = message.updated_by || message.created_by || message.deleted_by || message.imported_by || 'Alguien';
          
          if (message.action === 'import') {
            toast.info(
              `📊 ${userName} ${actionLabel} ${message.predios_importados} predios en ${message.municipio}`,
              { duration: 5000 }
            );
          } else {
            toast.info(
              `🔄 ${userName} ${actionLabel} un predio: ${message.codigo_predial || 'N/A'}`,
              { duration: 3000 }
            );
          }
          
          // Auto-sincronizar los datos del municipio
          fetchPredios();
        } else if (!filterMunicipio) {
          // Si no hay filtro de municipio activo, solo mostrar notificación
          const userName = message.updated_by || message.created_by || message.deleted_by || message.imported_by || 'Alguien';
          toast.info(
            `🔄 ${userName} actualizó datos en ${message.municipio}`,
            { duration: 3000 }
          );
        }
      }
    };
    
    // Agregar listener
    const removeListener = addListener(handleWebSocketMessage);
    
    // También escuchar el evento personalizado desde el toast
    const handleSyncEvent = (e) => {
      if (e.detail?.municipio === filterMunicipio) {
        fetchPredios();
        toast.success('Datos sincronizados');
      }
    };
    window.addEventListener('syncPredios', handleSyncEvent);
    
    return () => {
      removeListener();
      window.removeEventListener('syncPredios', handleSyncEvent);
    };
  }, [addListener, filterMunicipio, showPendientesDialog, historialTab]);

  // Función para obtener la última manzana de un sector
  const fetchUltimaManzana = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        zona: codigoManual.zona,
        sector: codigoManual.sector
      });
      const res = await axios.get(`${API}/predios/ultima-manzana/${formData.municipio}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUltimaManzanaInfo(res.data);
    } catch (error) {
      console.log('Error obteniendo última manzana');
      setUltimaManzanaInfo(null);
    }
  };

  // Función para buscar los últimos 5 predios existentes en la manzana
  const fetchPrediosEnManzana = async () => {
    if (!formData.municipio || !codigoManual.manzana_vereda || codigoManual.manzana_vereda === '0000') {
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
      const res = await axios.get(`${API}/predios/por-manzana/${formData.municipio}?${params.toString()}`, {
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

  // Effect para buscar predios cuando cambia la manzana
  useEffect(() => {
    if (formData.municipio && showCreateDialog && codigoManual.manzana_vereda && codigoManual.manzana_vereda !== '0000') {
      const timer = setTimeout(() => {
        fetchPrediosEnManzana();
      }, 500); // Debounce de 500ms
      return () => clearTimeout(timer);
    } else {
      setPrediosEnManzana([]);
      setSiguienteTerrenoSugerido('0001');
    }
  }, [codigoManual.zona, codigoManual.sector, codigoManual.comuna, codigoManual.barrio, codigoManual.manzana_vereda, formData.municipio, showCreateDialog]);

  // Función para obtener la estructura del código según el municipio
  const fetchEstructuraCodigo = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios/estructura-codigo/${formData.municipio}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEstructuraCodigo(res.data);
    } catch (error) {
      console.log('Error obteniendo estructura de código');
    }
  };

  // Función para obtener sugerencia de próximo código disponible
  const fetchSugerenciaCodigo = async () => {
    // NO auto-llenar terreno si estamos editando un predio existente
    if (editingPredioNuevoId) {
      return; // No sugerir código cuando estamos editando
    }
    
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        zona: codigoManual.zona,
        sector: codigoManual.sector,
        comuna: codigoManual.comuna,
        barrio: codigoManual.barrio,
        manzana_vereda: codigoManual.manzana_vereda
      });
      const res = await axios.get(`${API}/predios/sugerir-codigo/${formData.municipio}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTerrenoInfo(res.data);
      // Auto-llenar el terreno sugerido solo para predios NUEVOS
      if (res.data.siguiente_terreno) {
        setCodigoManual(prev => ({ ...prev, terreno: res.data.siguiente_terreno }));
      }
    } catch (error) {
      console.log('Error obteniendo sugerencia de código');
    }
  };

  // Función para verificar el código completo
  const verificarCodigoCompleto = async () => {
    if (!estructuraCodigo) return;
    
    const codigoCompleto = construirCodigoCompleto();
    if (codigoCompleto.length !== 30) {
      toast.error('El código debe tener exactamente 30 dígitos');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios/verificar-codigo-completo/${codigoCompleto}?municipio=${formData.municipio}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVerificacionCodigo(res.data);
    } catch (error) {
      toast.error('Error al verificar código');
    }
  };

  // Construir el código completo de 30 dígitos
  const construirCodigoCompleto = () => {
    if (!estructuraCodigo) return '';
    const prefijo = estructuraCodigo.prefijo_fijo; // 5 dígitos (depto + muni)
    return `${prefijo}${codigoManual.zona}${codigoManual.sector}${codigoManual.comuna}${codigoManual.barrio}${codigoManual.manzana_vereda}${codigoManual.terreno}${codigoManual.condicion}${codigoManual.edificio}${codigoManual.piso}${codigoManual.unidad}`;
  };
  
  // Función para manejar cambios en campos del código con validación
  const handleCodigoChange = (campo, valor, maxLength) => {
    // Solo permitir números
    const soloNumeros = valor.replace(/[^0-9]/g, '');
    // Limitar al máximo de dígitos
    const valorFinal = soloNumeros.slice(0, maxLength);
    setCodigoManual(prev => ({ ...prev, [campo]: valorFinal }));
  };

  // Verificar si hay datos ingresados en el formulario
  const tieneDatasSinGuardar = () => {
    // Verificar si se ha modificado algo del código
    const codigoModificado = codigoManual.zona !== '00' || 
                             codigoManual.sector !== '00' || 
                             codigoManual.comuna !== '00' ||
                             codigoManual.barrio !== '00' ||
                             codigoManual.manzana_vereda !== '0000' ||
                             codigoManual.terreno !== '0001';
    
    // Verificar si hay datos de propietario (nuevo formato)
    const tienePropietario = propietarios[0]?.nombre_propietario?.trim() || 
                             propietarios[0]?.numero_documento?.trim();
    
    // Verificar si hay datos del predio
    const tieneDatosPredio = formData.direccion?.trim() || 
                             formData.avaluo;
    
    return codigoModificado || tienePropietario || tieneDatosPredio;
  };

  // Manejar intento de cerrar el diálogo
  const handleCloseDialog = (open) => {
    if (!open && tieneDatasSinGuardar() && !gestorAsignado) {
      // Hay datos sin guardar y no se ha asignado a otro gestor
      setShowConfirmClose(true);
    } else {
      setShowCreateDialog(open);
      if (!open) {
        resetForm();
      }
    }
  };

  // Confirmar cierre sin guardar
  const confirmarCierreSinGuardar = () => {
    setShowConfirmClose(false);
    setShowCreateDialog(false);
    resetForm();
    
    // Si hay URL de retorno (viene de Pendientes), navegar allí
    if (returnUrl) {
      navigate(returnUrl);
      setReturnUrl(null);
    }
  };

  // Asignar a gestor y cerrar
  const asignarYCerrar = () => {
    setShowConfirmClose(false);
    // Enfocar en el selector de gestor
    toast.info('Por favor seleccione un gestor para continuar con el diligenciamiento', { duration: 4000 });
  };

  // === FUNCIONES PARA CÓDIGOS HOMOLOGADOS ===
  
  // Cargar estadísticas de códigos homologados
  const fetchCodigosStats = async () => {
    setLoadingCodigos(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/codigos-homologados/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCodigosStats(res.data.stats || []);
    } catch (error) {
      console.error('Error cargando stats de códigos:', error);
    } finally {
      setLoadingCodigos(false);
    }
  };
  
  // Cargar archivo Excel de códigos homologados
  const handleUploadCodigos = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Guardar el archivo seleccionado y mostrar el selector de municipio
    setCodigosFileSelected(file);
    e.target.value = '';
  };
  
  // Confirmar carga del archivo con el municipio seleccionado
  const confirmarCargaCodigos = async () => {
    if (!codigosFileSelected) return;
    
    setUploadingCodigos(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', codigosFileSelected);
      
      // Si hay un municipio seleccionado, agregarlo
      if (codigosMunicipioSeleccionado) {
        formData.append('municipio', codigosMunicipioSeleccionado);
      }
      
      const res = await axios.post(`${API}/codigos-homologados/cargar`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        timeout: 300000 // 5 minutos de timeout para archivos grandes
      });
      
      toast.success(`${res.data.codigos_insertados.toLocaleString()} códigos cargados`, { duration: 5000 });
      toast.info(
        `${res.data.codigos_usados?.toLocaleString() || 0} ya asignados a predios, ${res.data.codigos_disponibles?.toLocaleString() || 0} disponibles`,
        { duration: 8000 }
      );
      if (res.data.codigos_duplicados > 0) {
        toast.warning(`${res.data.codigos_duplicados.toLocaleString()} códigos duplicados ignorados`);
      }
      
      // Limpiar estado y recargar estadísticas
      setCodigosFileSelected(null);
      setCodigosMunicipioSeleccionado('');
      fetchCodigosStats();
    } catch (error) {
      console.error('Error cargando códigos:', error);
      
      // Mejor manejo de errores
      let errorMessage = 'Error cargando códigos';
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMessage = 'El archivo es muy grande o el servidor tardó demasiado. Por favor intente nuevamente.';
      } else if (!error.response) {
        errorMessage = 'Error de conexión. Verifique su conexión a internet.';
      }
      
      toast.error(errorMessage);
    } finally {
      setUploadingCodigos(false);
    }
  };
  
  // Recalcular códigos de un municipio
  const recalcularCodigosMunicipio = async (municipio) => {
    if (!municipio) {
      toast.error('Seleccione un municipio');
      return;
    }
    
    setRecalculandoCodigos(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API}/codigos-homologados/recalcular/${encodeURIComponent(municipio)}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 180000 // 3 minutos
      });
      
      toast.success(`${res.data.codigos_liberados} códigos liberados correctamente`, { duration: 5000 });
      if (res.data.codigos_marcados_usados > 0) {
        toast.info(`${res.data.codigos_marcados_usados} códigos marcados como usados`);
      }
      
      // Recargar estadísticas
      fetchCodigosStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error recalculando códigos');
    } finally {
      setRecalculandoCodigos(false);
    }
  };
  
  // Diagnosticar códigos de un municipio
  const diagnosticarCodigosMunicipio = async (municipio) => {
    if (!municipio) {
      toast.error('Seleccione un municipio');
      return;
    }
    
    setLoadingDiagnostico(true);
    setDiagnosticoCodigos(null);
    setShowDiagnosticoDialog(true);
    
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/codigos-homologados/diagnostico/${encodeURIComponent(municipio)}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 120000
      });
      
      setDiagnosticoCodigos(res.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error obteniendo diagnóstico');
      setShowDiagnosticoDialog(false);
    } finally {
      setLoadingDiagnostico(false);
    }
  };
  
  // Cancelar carga de archivo
  const cancelarCargaCodigos = () => {
    setCodigosFileSelected(null);
    setCodigosMunicipioSeleccionado('');
    setForzarDisponibles(false);
  };
  
  // Obtener códigos usados por municipio
  const fetchCodigosUsados = async (municipio) => {
    if (!municipio) {
      setCodigosUsados([]);
      return;
    }
    
    setLoadingCodigosUsados(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/codigos-homologados/usados/${encodeURIComponent(municipio)}?limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCodigosUsados(res.data.codigos || []);
    } catch (error) {
      console.error('Error obteniendo códigos usados:', error);
      setCodigosUsados([]);
    } finally {
      setLoadingCodigosUsados(false);
    }
  };
  
  // Obtener siguiente código homologado para un municipio
  const fetchSiguienteCodigoHomologado = async (municipio) => {
    if (!municipio) {
      setSiguienteCodigoHomologado(null);
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/codigos-homologados/siguiente/${encodeURIComponent(municipio)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSiguienteCodigoHomologado(res.data);
    } catch (error) {
      console.error('Error obteniendo siguiente código:', error);
      setSiguienteCodigoHomologado(null);
    }
  };
  
  // Efecto para cargar el siguiente código cuando cambia el municipio en el formulario de creación
  useEffect(() => {
    if (showCreateDialog && formData.municipio) {
      fetchSiguienteCodigoHomologado(formData.municipio);
    }
  }, [showCreateDialog, formData.municipio]);

  // === FUNCIONES PARA EL NUEVO FLUJO "CREAR PREDIO" ===
  
  // Buscar radicado por número (solo los 4 dígitos)
  const buscarRadicado = async (numero) => {
    if (!numero || numero.length < 1) {
      setRadicadoInfo(null);
      return;
    }
    
    setBuscandoRadicado(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios-nuevos/buscar-radicado/${numero}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRadicadoInfo(res.data);
      if (res.data.encontrado) {
        toast.success('Radicado encontrado');
      }
    } catch (error) {
      setRadicadoInfo({ encontrado: false, mensaje: 'Error al buscar radicado' });
    } finally {
      setBuscandoRadicado(false);
    }
  };
  
  // Cargar peticiones disponibles para vincular
  const fetchPeticionesDisponibles = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/petitions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Filtrar solo peticiones activas (no finalizadas)
      const peticionesActivas = (res.data || []).filter(p => 
        p.estado !== 'finalizado' && p.estado !== 'rechazado'
      );
      setPeticionesDisponibles(peticionesActivas);
    } catch (error) {
      console.log('Error cargando peticiones');
    }
  };
  
  // Efecto para cargar peticiones cuando se abre el diálogo de crear
  useEffect(() => {
    if (showCreateDialog && usarNuevoFlujo) {
      fetchPeticionesDisponibles();
    }
  }, [showCreateDialog, usarNuevoFlujo]);
  
  // Toggle petición relacionada
  const togglePeticionRelacionada = (peticionId) => {
    setPeticionesRelacionadas(prev => {
      if (prev.includes(peticionId)) {
        return prev.filter(id => id !== peticionId);
      } else {
        return [...prev, peticionId];
      }
    });
  };

  const fetchCatalogos = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios/catalogos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCatalogos(res.data);
    } catch (error) {
      toast.error('Error al cargar catálogos');
    }
  };

  const fetchVigencias = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios/vigencias`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVigenciasData(res.data);
    } catch (error) {
      console.log('Vigencias no disponibles');
    }
  };

  const fetchPrediosStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios/stats/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPrediosStats(res.data);
    } catch (error) {
      console.log('Stats no disponibles');
    } finally {
      setLoading(false);
    }
  };

  // Función para sincronizar - BORRA TODO EL CACHE y guarda solo los datos nuevos
  const syncMunicipioManual = async (municipio) => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      params.append('municipio', municipio);
      
      // SIEMPRE sincronizar con la vigencia ACTUAL (año actual), no la filtrada
      const vigenciaActual = String(new Date().getFullYear());
      params.append('vigencia', vigenciaActual);
      
      // Si el usuario está viendo una vigencia anterior, advertir
      if (filterVigencia && String(filterVigencia) !== vigenciaActual) {
        toast.info(`Sincronizando vigencia ${vigenciaActual} (actual). Las vigencias anteriores se consultan del servidor.`, { duration: 4000 });
      }
      
      setDownloadProgress({
        isDownloading: true,
        current: 0,
        total: 100,
        label: `Preparando sincronización...`
      });
      
      // NO borrar el caché completo - solo actualizamos los datos del municipio para la vigencia actual
      // El caché anterior se mantiene para otros municipios
      
      setDownloadProgress({
        isDownloading: true,
        current: 20,
        total: 100,
        label: `Descargando ${municipio} (Vigencia ${vigenciaActual})...`
      });
      
      // Descargar datos del servidor
      const res = await axios.get(`${API}/predios?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const serverPredios = res.data.predios || [];
      const totalPredios = serverPredios.length;
      
      setDownloadProgress({
        isDownloading: true,
        current: 60,
        total: 100,
        label: `Guardando ${totalPredios.toLocaleString()} predios...`
      });
      
      // Guardar los datos nuevos (esto reemplaza solo los datos de este municipio)
      await downloadForOffline(serverPredios, null, municipio);
      
      // Guardar fecha de última sincronización
      localStorage.setItem(`sync_${municipio}_date`, new Date().toISOString());
      localStorage.setItem(`sync_${municipio}_vigencia`, vigenciaActual);
      
      // Actualizar la UI solo si estamos viendo este municipio Y la vigencia actual
      if (filterMunicipio === municipio && (!filterVigencia || String(filterVigencia) === vigenciaActual)) {
        let filtered = serverPredios;
        if (search) {
          const searchLower = search.toLowerCase();
          filtered = filtered.filter(p => 
            p.codigo_predial_nacional?.toLowerCase().includes(searchLower) ||
            p.direccion?.toLowerCase().includes(searchLower) ||
            p.propietarios?.some(prop => prop.nombre_propietario?.toLowerCase().includes(searchLower))
          );
        }
        if (filterGeometria === 'con') {
          filtered = filtered.filter(p => p.tiene_geometria_gdb === true);
        } else if (filterGeometria === 'sin') {
          filtered = filtered.filter(p => p.tiene_geometria_gdb !== true);
        }
        
        setPredios(filtered);
        setTotal(filtered.length);
      }
      
      setDownloadProgress({ isDownloading: false, current: 100, total: 100, label: '' });
      toast.success(`✅ ${municipio} (${vigenciaActual}): ${totalPredios.toLocaleString()} predios sincronizados`, { duration: 3000 });
      
    } catch (error) {
      console.error('Error sincronizando:', error);
      setDownloadProgress({ isDownloading: false, current: 0, total: 0, label: '' });
      toast.error('Error al sincronizar');
    }
  };

  // Función helper para ordenar predios por código predial nacional
  const sortPrediosByCNP = (prediosArray) => {
    return [...prediosArray].sort((a, b) => {
      const cnpA = a.codigo_predial_nacional || '';
      const cnpB = b.codigo_predial_nacional || '';
      return cnpA.localeCompare(cnpB);
    });
  };

  // Función para forzar recarga desde servidor (ignora caché)
  const forceRefreshPredios = async () => {
    await fetchPrediosFromServer();
  };

  // Función interna que carga desde el servidor (forzado)
  const fetchPrediosFromServer = async (page = 1) => {
    try {
      setLoading(true);
      setIsRevalidating(true);

      if (!navigator.onLine) {
        toast.warning('No hay conexión. Use los datos offline disponibles.');
        setLoading(false);
        setIsRevalidating(false);
        setDataSource('offline');
        return;
      }

      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (filterMunicipio) params.append('municipio', filterMunicipio);
      if (filterVigencia) params.append('vigencia', filterVigencia);
      if (search) params.append('search', search);
      if (filterGeometria === 'con') params.append('tiene_geometria', 'true');
      if (filterGeometria === 'sin') params.append('tiene_geometria', 'false');
      params.append('skip', String((page - 1) * pageSize));
      params.append('limit', String(pageSize));

      const res = await axios.get(`${API}/predios?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const prediosRecibidos = res.data.predios || [];
      setPredios(prediosRecibidos);
      setTotal(res.data.total || 0);
      setCurrentPage(page);

      const now = new Date().toISOString();
      setLastSyncTime(now);
      setDataSource('server');
      setLoading(false);
      setIsRevalidating(false);

    } catch (error) {
      console.error('[Predios] Error cargando desde servidor:', error);
      setLoading(false);
      setIsRevalidating(false);
    }
  };

  const fetchPredios = async (page = 1) => {
    const vigenciaActual = String(new Date().getFullYear());
    const esVigenciaActual = !filterVigencia || String(filterVigencia) === vigenciaActual;

    // Si está offline, intentar caché
    if (!navigator.onLine) {
      if (filterMunicipio && esVigenciaActual && !search) {
        try {
          const cachedPredios = await getPrediosByMunicipioOffline(filterMunicipio);
          if (cachedPredios && cachedPredios.length > 0) {
            let filtered = cachedPredios.filter(p => String(p.vigencia) === vigenciaActual);
            if (filterGeometria === 'con') filtered = filtered.filter(p => p.tiene_geometria_gdb === true);
            else if (filterGeometria === 'sin') filtered = filtered.filter(p => p.tiene_geometria_gdb !== true);
            const prediosOrdenados = sortPrediosByCNP(filtered);
            // Paginación client-side sobre datos offline
            const start = (page - 1) * pageSize;
            setPredios(prediosOrdenados.slice(start, start + pageSize));
            setTotal(prediosOrdenados.length);
            setCurrentPage(page);
            setLoading(false);
            setDataSource('offline');
            const syncTime = localStorage.getItem(`sync_${filterMunicipio}_date`);
            setLastSyncTime(syncTime);
            return;
          }
        } catch (e) {
          console.warn('[Offline] Error accediendo caché:', e);
        }
      }
      toast.warning('No hay conexión a internet');
      setPredios([]);
      setTotal(0);
      setLoading(false);
      setDataSource('offline');
      return;
    }

    // Online: paginación server-side
    setLoading(true);
    setDataSource('loading');
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (filterMunicipio) params.append('municipio', filterMunicipio);
      if (filterVigencia) params.append('vigencia', filterVigencia);
      if (search) params.append('search', search);
      if (filterGeometria === 'con') params.append('tiene_geometria', 'true');
      if (filterGeometria === 'sin') params.append('tiene_geometria', 'false');
      params.append('skip', String((page - 1) * pageSize));
      params.append('limit', String(pageSize));

      const res = await axios.get(`${API}/predios?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const prediosRecibidos = res.data.predios || [];
      setPredios(prediosRecibidos);
      setTotal(res.data.total || 0);
      setCurrentPage(page);
      setLoading(false);
      setIsRevalidating(false);
      setDataSource('server');

      const now = new Date().toISOString();
      setLastSyncTime(now);

    } catch (error) {
      console.error('[Predios] Error cargando:', error);
      setLoading(false);
      setIsRevalidating(false);
      // Fallback a caché
      if (filterMunicipio && esVigenciaActual && !search) {
        try {
          const cachedPredios = await getPrediosByMunicipioOffline(filterMunicipio);
          if (cachedPredios && cachedPredios.length > 0) {
            const filtered = cachedPredios.filter(p => String(p.vigencia) === vigenciaActual);
            const start = (page - 1) * pageSize;
            setPredios(sortPrediosByCNP(filtered).slice(start, start + pageSize));
            setTotal(filtered.length);
            setCurrentPage(page);
            setDataSource('cache');
            const syncTime = localStorage.getItem(`sync_${filterMunicipio}_date`);
            setLastSyncTime(syncTime);
            toast.warning('Error de conexión - Mostrando datos desde caché', { duration: 3000 });
          }
        } catch (e) {
          console.warn('[Cache] Error recuperando:', e);
        }
      }
    }
  };

  const fetchGdbStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/gdb/geometrias-disponibles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGdbStats(res.data);
    } catch (error) {
      console.log('GDB stats no disponibles');
    }
  };

  const fetchTerrenoInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(
        `${API}/predios/terreno-info/${encodeURIComponent(formData.municipio)}?zona=${formData.zona}&sector=${formData.sector}&manzana_vereda=${formData.manzana_vereda}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTerrenoInfo(res.data);
    } catch (error) {
      setTerrenoInfo(null);
    }
  };

  const fetchPrediosEliminados = async (municipioFilter = '') => {
    setEliminadosLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (municipioFilter) params.append('municipio', municipioFilter);
      params.append('limit', '500');
      
      const res = await axios.get(`${API}/predios/eliminados?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPrediosEliminados(res.data.predios || []);
      setPrediosEliminadosFiltrados(res.data.predios || []);
      setShowDeletedDialog(true);
    } catch (error) {
      toast.error('Error al cargar predios eliminados');
    } finally {
      setEliminadosLoading(false);
    }
  };
  
  // Filtrar predios eliminados por búsqueda local
  useEffect(() => {
    if (!eliminadosSearch.trim()) {
      setPrediosEliminadosFiltrados(prediosEliminados);
      return;
    }
    
    const searchLower = eliminadosSearch.toLowerCase();
    const filtered = prediosEliminados.filter(p => 
      p.codigo_predial_nacional?.toLowerCase().includes(searchLower) ||
      p.codigo_homologado?.toLowerCase().includes(searchLower) ||
      p.nombre_propietario?.toLowerCase().includes(searchLower) ||
      p.municipio?.toLowerCase().includes(searchLower) ||
      p.motivo?.toLowerCase().includes(searchLower)
    );
    setPrediosEliminadosFiltrados(filtered);
  }, [eliminadosSearch, prediosEliminados]);

  const fetchCambiosStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios/cambios/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCambiosStats(res.data);
    } catch (error) {
      console.log('Stats no disponibles');
    }
  };

  const fetchReaparicionesConteo = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios/reapariciones/conteo-por-municipio`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReaparicionesConteo(res.data.conteo || {});
    } catch (error) {
      console.log('Conteo de reapariciones no disponible');
    }
  };

  const fetchSubsanacionesConteo = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios/reapariciones/subsanaciones-pendientes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const subsanaciones = res.data.subsanaciones || [];
      // También obtener reenviadas si es coordinador
      let reenviadas = [];
      if (user && ['coordinador', 'administrador'].includes(user.role)) {
        const res2 = await axios.get(`${API}/predios/reapariciones/reenviadas`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        reenviadas = res2.data.reenviadas || [];
      }
      setSubsanacionesConteo(subsanaciones.length + reenviadas.length);
    } catch (error) {
      console.log('Conteo de subsanaciones no disponible');
    }
  };

  const fetchCambiosPendientes = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios/cambios/pendientes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCambiosPendientes(res.data.cambios);
      setShowPendientesDialog(true);
    } catch (error) {
      toast.error('Error al cargar cambios pendientes');
    }
  };

  const fetchCambiosHistorial = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios/cambios/historial?limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCambiosHistorial(res.data.cambios || []);
    } catch (error) {
      console.log('Historial no disponible');
    }
  };

  const handleAprobarRechazar = async (cambioId, aprobado, comentario = '') => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/predios/cambios/aprobar`, {
        cambio_id: cambioId,
        aprobado,
        comentario
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(aprobado ? 'Cambio aprobado exitosamente' : 'Cambio rechazado');
      fetchCambiosPendientes();
      fetchCambiosStats();
      fetchPredios();
    } catch (error) {
      toast.error('Error al procesar el cambio');
    }
  };

  const handleExportExcel = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Construir parámetros de consulta
      const params = new URLSearchParams();
      if (filterMunicipio !== 'todos' && filterMunicipio) {
        params.append('municipio', filterMunicipio);
      }
      if (filterVigencia) {
        params.append('vigencia', filterVigencia);
      }
      
      const queryString = params.toString() ? `?${params.toString()}` : '';
      
      const response = await axios.get(`${API}/predios/export-excel${queryString}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // Nombre del archivo con vigencia incluida
      const fecha = new Date().toISOString().split('T')[0];
      const vigenciaStr = filterVigencia ? `_Vigencia${String(filterVigencia).slice(-4)}` : '';
      link.setAttribute('download', `Predios_${filterMunicipio !== 'todos' && filterMunicipio ? filterMunicipio : 'Todos'}${vigenciaStr}_${fecha}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Excel exportado exitosamente');
    } catch (error) {
      toast.error('Error al exportar Excel');
    }
  };

  const handleSearch = () => {
    fetchPredios();
  };

  // Efecto para recargar predios cuando se borra la búsqueda
  useEffect(() => {
    if (search === '' && filterMunicipio) {
      fetchPredios();
    }
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Verificar si el usuario necesita aprobación
  const necesitaAprobacion = user && ['gestor', 'gestor_auxiliar', 'atencion_usuario'].includes(user.role);

  const handleCreate = async () => {
    if (isSavingCreate) return; // Prevenir doble clic
    
    // Validar que el código esté completo
    const codigoCompleto = construirCodigoCompleto();
    if (codigoCompleto.length !== 30) {
      toast.error('El código predial debe tener exactamente 30 dígitos');
      return;
    }

    // Verificar el código antes de crear
    if (!verificacionCodigo) {
      toast.error('Por favor verifique el código antes de continuar');
      return;
    }

    if (verificacionCodigo.estado === 'existente') {
      toast.error('Este código ya existe en la base de datos');
      return;
    }

    // Si es predio eliminado, pedir confirmación antes de continuar
    if (verificacionCodigo.estado === 'eliminado' && !window.__reaparicionConfirmada) {
      const vigElim = verificacionCodigo.detalles_eliminacion?.vigencia_eliminacion || 'N/A';
      const motivo = verificacionCodigo.detalles_eliminacion?.motivo || 'Sin motivo registrado';
      const confirmar = window.confirm(
        `Este código fue eliminado en la vigencia ${vigElim}.\n` +
        `Motivo: ${motivo}\n\n` +
        `Solo se conservará el código, toda la información R1/R2 debe ser diligenciada nuevamente.\n\n` +
        `¿Desea continuar con la creación?`
      );
      if (!confirmar) return;
      window.__reaparicionConfirmada = true;
    }

    // Validar que haya al menos un propietario con datos (nuevo formato simplificado)
    if (!propietarios[0].nombre_propietario || !propietarios[0].numero_documento) {
      toast.error('Debe ingresar al menos un propietario con nombre completo y número de documento');
      return;
    }

    // Si se usa el nuevo flujo, validar gestor de apoyo
    if (usarNuevoFlujo && !gestorAsignado) {
      toast.error('Debe seleccionar un Gestor de Apoyo para el flujo de trabajo');
      return;
    }
    
    // Validar radicado requerido para creación de predios nuevos (excepto coordinadores/admin)
    if (usarNuevoFlujo && !radicadoNumero && !['coordinador', 'administrador'].includes(user?.role)) {
      toast.error('Debe ingresar un número de radicado para justificar la creación del predio');
      return;
    }
    
    // Calcular áreas desde R2
    const { areaTerrenoTotal, areaConstruidaTotal } = calcularAreasTotales();
    
    // Preparar propietarios con formato correcto y documento con padding de 12 dígitos
    const propietariosFormateados = propietarios
      .filter(p => p.nombre_propietario && p.numero_documento)
      .map(p => ({
        nombre_propietario: p.nombre_propietario,
        estado_civil: p.estado_civil || 'sin_especificar',
        tipo_documento: p.tipo_documento,
        numero_documento: p.numero_documento.padStart(12, '0')
      }));

    setIsSavingCreate(true); // Activar estado de guardado
    try {
      const token = localStorage.getItem('token');
      
      // === NUEVO FLUJO CON WORKFLOW ===
      if (usarNuevoFlujo) {
        const esReaparicion = verificacionCodigo.estado === 'eliminado';
        const predioNuevoData = {
          // Marcar como creado en plataforma para sincronización automática R2→R1
          creado_en_plataforma: true,
          es_reaparicion: esReaparicion,
          r1: {
            municipio: formData.municipio || filterMunicipio,
            zona: codigoManual.zona,
            sector: codigoManual.sector,
            comuna: codigoManual.comuna,
            barrio: codigoManual.barrio,
            manzana_vereda: codigoManual.manzana_vereda,
            terreno: codigoManual.terreno,
            condicion_predio: codigoManual.condicion,
            predio_horizontal: `${codigoManual.edificio}${codigoManual.piso}${codigoManual.unidad}`.padEnd(5, '0'),
            // Formato de propietario simplificado
            nombre_propietario: propietariosFormateados[0].nombre_propietario,
            estado_civil: propietariosFormateados[0].estado_civil,
            tipo_documento: propietariosFormateados[0].tipo_documento,
            numero_documento: propietariosFormateados[0].numero_documento,
            direccion: formData.direccion,
            destino_economico: formData.destino_economico,
            // Áreas calculadas del R2
            area_terreno: areaTerrenoTotal,
            area_construida: areaConstruidaTotal,
            avaluo: parsearNumeroColombiano(formData.avaluo),
          },
          r2: {
            matricula_inmobiliaria: formData.matricula_inmobiliaria || null,
            // Nuevo formato separado: zonas y construcciones
            zonas: zonasTerreno.map(z => ({
              zona_fisica: z.zona_fisica || '0',
              zona_economica: z.zona_economica || '0',
              area_terreno: parseFloat(z.area_terreno) || 0
            })),
            construcciones: construcciones.map(c => ({
              id: c.id,
              piso: parseInt(c.piso) ?? 0,
              habitaciones: parseInt(c.habitaciones) ?? 0,
              banos: parseInt(c.banos) ?? 0,
              locales: parseInt(c.locales) ?? 0,
              tipificacion: c.tipificacion || '',
              uso: c.uso || '',
              puntaje: parseFloat(c.puntaje) ?? 0,
              area_construida: parseFloat(c.area_construida) ?? 0
            }))
          },
          propietarios: propietariosFormateados,
          gestor_apoyo_id: gestorAsignado,
          radicado_numero: radicadoNumero || null,
          peticiones_ids: peticionesRelacionadas,
          observaciones: observacionesCreacion || null,
        };
        
        // Si estamos editando un predio nuevo existente, usar PATCH
        if (editingPredioNuevoId) {
          // Construir datos planos para actualización
          const updateData = {
            municipio: predioNuevoData.r1.municipio,
            direccion: predioNuevoData.r1.direccion,
            destino_economico: predioNuevoData.r1.destino_economico,
            area_terreno: predioNuevoData.r1.area_terreno,
            area_construida: predioNuevoData.r1.area_construida,
            avaluo: predioNuevoData.r1.avaluo,
            propietarios: propietariosFormateados,
            // R2 data - nuevo formato separado
            matricula_inmobiliaria: predioNuevoData.r2.matricula_inmobiliaria,
            zonas: predioNuevoData.r2.zonas,
            construcciones: predioNuevoData.r2.construcciones,
            observaciones: predioNuevoData.observaciones,
          };
          
          await axios.patch(`${API}/predios-nuevos/${editingPredioNuevoId}`, updateData, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          toast.success('Predio actualizado correctamente');
          setShowCreateDialog(false);
          setEditingPredioNuevoId(null);
          resetForm();
          
          // Si está en modo embedded (iframe), notificar al padre
          const params = new URLSearchParams(location.search);
          const isEmbedded = params.get('embedded') === 'true';
          if (isEmbedded && window.parent !== window) {
            window.parent.postMessage({ type: 'PREDIO_SAVED', predioId: editingPredioNuevoId }, '*');
          } else if (returnUrl) {
            // Si hay URL de retorno, navegar allí (viene de Pendientes)
            navigate(returnUrl);
            setReturnUrl(null);
          } else {
            fetchPredios();
          }
          return;
        }
        
        // Crear nuevo predio
        const res = await axios.post(`${API}/predios-nuevos`, predioNuevoData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        toast.success(esReaparicion
          ? 'Predio reaparecido creado y asignado al Gestor de Apoyo'
          : 'Predio creado y asignado al Gestor de Apoyo para digitalización'
        );
        const gestorNombre = gestoresDisponibles.find(g => g.id === gestorAsignado)?.full_name;
        toast.info(`Asignado a ${gestorNombre}. El predio aparecerá en "Predios en Proceso".`, { duration: 5000 });
        
        setShowCreateDialog(false);
        resetForm();
        fetchPredios();
        fetchCambiosStats();
        return;
      }
      
      // === FLUJO ORIGINAL ===
      const predioData = {
        codigo_predial_nacional: codigoCompleto,
        municipio: formData.municipio || filterMunicipio,
        // IMPORTANTE: Incluir el código homologado seleccionado/siguiente
        codigo_homologado: siguienteCodigoHomologado?.codigo || null,
        // Acto administrativo obligatorio (= número de resolución)
        acto_administrativo: formData.acto_administrativo.trim(),
        numero_resolucion: formData.acto_administrativo.trim(),
        tipo_mutacion: formData.tipo_mutacion || 'Mutación Quinta',
        fecha_resolucion: formData.fecha_resolucion || new Date().toISOString().split('T')[0],
        es_reactivacion: verificacionCodigo.estado === 'eliminado',
        justificacion: verificacionCodigo.estado === 'eliminado' 
          ? 'Reactivación de predio eliminado' 
          : 'Creación de nuevo predio',
        // Marcar como creado en plataforma para sincronización automática R2→R1
        creado_en_plataforma: true,
        // Usar el primer propietario como principal (formato simplificado)
        nombre_propietario: propietariosFormateados[0].nombre_propietario,
        estado_civil: propietariosFormateados[0].estado_civil,
        tipo_documento: propietariosFormateados[0].tipo_documento,
        numero_documento: propietariosFormateados[0].numero_documento,
        // Lista completa de propietarios
        propietarios: propietariosFormateados,
        // Información del predio
        direccion: formData.direccion,
        destino_economico: formData.destino_economico,
        matricula_inmobiliaria: formData.matricula_inmobiliaria,
        // Áreas calculadas del R2
        area_terreno: areaTerrenoTotal,
        area_construida: areaConstruidaTotal,
        avaluo: parsearNumeroColombiano(formData.avaluo),
        // Nuevo formato R2: zonas y construcciones separadas
        zonas: zonasTerreno.map(z => ({
          zona_fisica: z.zona_fisica || '0',
          zona_economica: z.zona_economica || '0',
          area_terreno: parseFloat(z.area_terreno) || 0
        })),
        construcciones: construcciones.map(c => ({
          id: c.id,
          piso: parseInt(c.piso) ?? 0,
          habitaciones: parseInt(c.habitaciones) ?? 0,
          banos: parseInt(c.banos) ?? 0,
          locales: parseInt(c.locales) ?? 0,
          tipificacion: c.tipificacion || '',
          uso: c.uso || '',
          puntaje: parseFloat(c.puntaje) ?? 0,
          area_construida: parseFloat(c.area_construida) ?? 0
        })),
        // Gestor asignado para continuar
        gestor_asignado_id: gestorAsignado || null
      };

      const res = await axios.post(`${API}/predios/crear-con-workflow`, predioData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Mostrar mensaje apropiado según si fue creado directamente o queda pendiente
      if (res.data.predio_creado) {
        toast.success('✅ Predio creado exitosamente');
      } else if (res.data.requiere_aprobacion) {
        toast.success('📋 Predio propuesto. Pendiente de aprobación del coordinador.');
      } else {
        toast.success(res.data.mensaje || 'Operación completada');
      }

      if (gestorAsignado) {
        const gestorNombre = gestoresDisponibles.find(g => g.id === gestorAsignado)?.full_name;
        toast.info(`Asignado a ${gestorNombre} para continuar el diligenciamiento.`, { duration: 4000 });
      }

      if (!res.data.tiene_geometria) {
        toast.info('⚠️ Este predio no tiene información gráfica (GDB). Se relacionará cuando se cargue el archivo GDB.', { duration: 5000 });
      }
      
      // Mostrar mensaje de éxito con info de dónde encontrar el predio
      const municipioCreado = formData.municipio || filterMunicipio;
      toast.success(`✅ Predio creado en ${municipioCreado}. Código: ${res.data.codigo_homologado || codigoCompleto}`, { duration: 5000 });
      
      setShowCreateDialog(false);
      resetForm();
      // Recargar el siguiente código homologado disponible (el anterior ya se usó)
      setSiguienteCodigoHomologado(null);
      
      // Asegurar que el filtro de municipio sea el correcto para ver el predio
      if (municipioCreado && filterMunicipio !== municipioCreado) {
        setFilterMunicipio(municipioCreado);
      }
      
      // Forzar recarga desde servidor para ver el nuevo predio
      await forceRefreshPredios();
      fetchCambiosStats();
    } catch (error) {
      const detail = error.response?.data?.detail;
      // Si el backend responde 409 (predio eliminado sin flag), informar al usuario
      if (error.response?.status === 409 && detail?.error === 'PREDIO_ELIMINADO') {
        toast.warning(detail.mensaje || 'Este código pertenece a un predio eliminado.');
      } else {
        toast.error(typeof detail === 'string' ? detail : detail?.mensaje || 'Error al crear predio');
      }
    } finally {
      setIsSavingCreate(false);
      delete window.__reaparicionConfirmada;
    }
  };

  const handleUpdate = async () => {
    if (isSavingUpdate) return; // Prevenir doble clic
    setIsSavingUpdate(true);
    
    try {
      const token = localStorage.getItem('token');
      
      // Filtrar propietarios válidos
      const propietariosValidos = propietarios.filter(p => p.nombre_propietario && p.numero_documento);
      
      if (propietariosValidos.length === 0) {
        toast.error('Debe ingresar al menos un propietario con nombre y documento');
        setIsSavingUpdate(false);
        return;
      }
      
      // Filtrar zonas físicas válidas
      const zonasValidas = zonasFisicas.filter(z => 
        z.zona_fisica !== '0' || z.area_terreno !== '0' || z.area_construida !== '0'
      );
      
      const updateData = {
        // Datos del primer propietario (campos legacy para compatibilidad)
        nombre_propietario: propietariosValidos[0].nombre_propietario,
        tipo_documento: propietariosValidos[0].tipo_documento,
        numero_documento: propietariosValidos[0].numero_documento,
        estado_civil: propietariosValidos[0].estado_civil || null,
        // Array completo de propietarios
        propietarios: propietariosValidos,
        // Otros campos
        direccion: formData.direccion,
        comuna: formData.comuna,
        destino_economico: formData.destino_economico,
        area_terreno: parseFloat(formData.area_terreno) || 0,
        area_construida: parseFloat(formData.area_construida) || 0,
        avaluo: parseFloat(formData.avaluo) || 0,
        tipo_mutacion: formData.tipo_mutacion || null,
        numero_resolucion: formData.numero_resolucion || null,
        fecha_resolucion: formData.fecha_resolucion || null,
        matricula_inmobiliaria: formData.matricula_inmobiliaria || null
      };
      
      // Si es coordinador/admin y modificó el código predial, agregarlo
      if (canEditCodigoPredial && formData.codigo_predial_nacional && 
          formData.codigo_predial_nacional !== selectedPredio?.codigo_predial_nacional) {
        updateData.codigo_predial_nacional = formData.codigo_predial_nacional;
      }
      
      // Agregar zonas R2 si hay datos válidos
      if (zonasValidas.length > 0) {
        updateData.r2 = {
          matricula_inmobiliaria: formData.matricula_inmobiliaria || null,
          zonas: zonasValidas.map(z => ({
            zona_fisica: z.zona_fisica,
            zona_economica: z.zona_economica,
            area_terreno: parseFloat(z.area_terreno) ?? 0,
            habitaciones: parseInt(z.habitaciones) ?? 0,
            banos: parseInt(z.banos) ?? 0,
            locales: parseInt(z.locales) ?? 0,
            pisos: parseInt(z.pisos) ?? 0,
            puntaje: parseFloat(z.puntaje) ?? 0,
            area_construida: parseFloat(z.area_construida) ?? 0
          }))
        };
      }
      
      // ===== VERIFICAR SI SE DEBE GENERAR RESOLUCIÓN MANUAL (coordinadores/admins) =====
      if (canEditCodigoPredial && infoResolucion.tipo_mutacion && infoResolucion.numero_resolucion) {
        try {
          // Generar resolución manualmente (timeout extendido porque incluye envío de email)
          const resolucionResponse = await axios.post(`${API}/resoluciones/generar-manual`, {
            predio_id: selectedPredio.id,
            tipo_mutacion: infoResolucion.tipo_mutacion,
            numero_resolucion: infoResolucion.numero_resolucion,
            fecha_resolucion: infoResolucion.fecha_resolucion || new Date().toLocaleDateString('es-CO'),
            radicado_peticion: infoResolucion.radicado_peticion || null,
            datos_predio: updateData
          }, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 60000
          });
          
          // Cerrar modal y limpiar estado ANTES de mostrar mensaje
          setShowEditDialog(false);
          setIsSavingUpdate(false);
          setInfoResolucion({ tipo_mutacion: '', numero_resolucion: '', fecha_resolucion: '', radicado_peticion: '' });
          
          // Mostrar mensaje de éxito
          if (resolucionResponse.data.success) {
            let msg = resolucionResponse.data.duplicado 
              ? `La resolución ${infoResolucion.numero_resolucion} ya existe.`
              : `Resolución ${infoResolucion.numero_resolucion} generada y predio actualizado exitosamente.`;
            if (resolucionResponse.data.peticion_finalizada) msg += ' Petición marcada como finalizada.';
            if (resolucionResponse.data.email_enviado) msg += ' Correo enviado al solicitante.';
            toast.success(msg);
          }
          
          // Refrescar en segundo plano
          forceRefreshPredios().catch(() => {});
          fetchCambiosStats();
        } catch (resolucionError) {
          setIsSavingUpdate(false);
          if (resolucionError.code === 'ECONNABORTED' || resolucionError.message?.includes('timeout')) {
            toast.warning('La solicitud tardó mucho. Verifica si la resolución se generó.');
          } else {
            toast.error(resolucionError.response?.data?.detail || 'Error al generar resolución');
          }
        }
        // SIEMPRE salir después de intentar generar resolución (éxito o error)
        return;
      }
      
      // Obtener info del radicado seleccionado
      const radicadoInfo = peticionesDisponibles.find(p => p.id === radicadoSeleccionado);
      
      // Construir payload para el endpoint
      const payload = {
        predio_id: selectedPredio.id,
        tipo_cambio: 'modificacion',
        datos_propuestos: updateData,
        justificacion: radicadoInfo ? `Modificación según radicado ${radicadoInfo.radicado}` : 'Modificación de datos del predio',
        radicado_id: radicadoSeleccionado || null,
        radicado_numero: radicadoInfo?.radicado || null
      };
      
      // Agregar gestor de apoyo si se seleccionó esa opción
      if (usarGestorApoyoMod && gestorApoyoModificacion) {
        payload.gestor_apoyo_id = gestorApoyoModificacion;
        payload.observaciones_apoyo = observacionesApoyoMod || null;
      }
      
      // Usar sistema de aprobación
      const res = await axios.post(`${API}/predios/cambios/proponer`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.asignado_gestor_apoyo) {
        const gestorNombre = gestoresDisponibles.find(g => g.id === gestorApoyoModificacion)?.full_name;
        toast.success(`Modificación asignada a ${gestorNombre} para completar`);
      } else if (res.data.requiere_aprobacion) {
        toast.success('Modificación propuesta. Pendiente de aprobación del coordinador.');
      } else {
        // Solo mostrar si no hubo ya mensaje de resolución
        if (!infoResolucion.numero_resolucion) {
          toast.success('Predio actualizado exitosamente');
        }
      }
      
      setShowEditDialog(false);
      setRadicadoSeleccionado(''); // Limpiar el radicado seleccionado
      setUsarGestorApoyoMod(false); // Resetear opción de gestor de apoyo
      setGestorApoyoModificacion('');
      setObservacionesApoyoMod('');
      // Forzar recarga desde servidor para ver cambios inmediatamente
      await forceRefreshPredios();
      fetchCambiosStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al actualizar predio');
    } finally {
      setIsSavingUpdate(false);
    }
  };

  // Función para abrir modal de eliminación
  const openDeleteModal = (predio) => {
    setPredioAEliminar(predio);
    setEliminacionData({
      radicado: '',
      resolucion: '',
      fecha_resolucion: '',
      motivo: ''
    });
    setShowDeleteModal(true);
  };

  // Función para confirmar eliminación con datos del modal
  const handleConfirmDelete = async () => {
    if (!predioAEliminar) return;
    if (isSavingDelete) return;
    
    // Validar campos requeridos
    if (!eliminacionData.resolucion.trim()) {
      toast.error('Debe ingresar el número de resolución');
      return;
    }
    if (!eliminacionData.motivo.trim()) {
      toast.error('Debe ingresar el motivo de eliminación');
      return;
    }
    
    setIsSavingDelete(true);
    
    try {
      const token = localStorage.getItem('token');
      
      // Usar sistema de aprobación con datos completos
      const res = await axios.post(`${API}/predios/cambios/proponer`, {
        predio_id: predioAEliminar.id,
        tipo_cambio: 'eliminacion',
        datos_propuestos: { 
          // Datos completos del predio para que se muestren en el historial
          codigo_predial_nacional: predioAEliminar.codigo_predial_nacional,
          codigo_homologado: predioAEliminar.codigo_homologado, 
          municipio: predioAEliminar.municipio,
          direccion: predioAEliminar.direccion,
          nombre_propietario: predioAEliminar.nombre_propietario,
          propietarios: predioAEliminar.propietarios || [],
          area_terreno: predioAEliminar.area_terreno,
          area_construida: predioAEliminar.area_construida,
          avaluo: predioAEliminar.avaluo,
          destino_economico: predioAEliminar.destino_economico,
          vigencia: predioAEliminar.vigencia,
          // Datos de la eliminación
          radicado: eliminacionData.radicado.trim(),
          radicado_eliminacion: eliminacionData.radicado.trim(),
          resolucion: eliminacionData.resolucion.trim(),
          numero_resolucion: eliminacionData.resolucion.trim(),
          fecha_resolucion: eliminacionData.fecha_resolucion,
          motivo: eliminacionData.motivo.trim()
        },
        justificacion: eliminacionData.motivo.trim() || 'Eliminación de predio'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.requiere_aprobacion) {
        toast.success('Eliminación propuesta. Pendiente de aprobación del coordinador.');
      } else {
        toast.success('Predio eliminado exitosamente');
      }
      
      // Cerrar modal y limpiar
      setShowDeleteModal(false);
      setPredioAEliminar(null);
      
      // Forzar recarga desde servidor para ver cambios inmediatamente
      await forceRefreshPredios();
      fetchCambiosStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar predio');
    } finally {
      setIsSavingDelete(false);
    }
  };

  // Función legacy para compatibilidad (ahora abre el modal)
  const handleDelete = async (predio) => {
    openDeleteModal(predio);
  };

  const openEditDialog = (predio) => {
    // Determinar si usar formato automático (R2→R1) o manual
    // Automático si: creado_en_plataforma=true O area_editada_en_plataforma=true
    const esFormatoAutomatico = predio.creado_en_plataforma === true || predio.area_editada_en_plataforma === true;
    setUsarFormatoAutomatico(esFormatoAutomatico);
    
    // Preparar todos los datos antes de hacer setState
    let newPropietarios;
    if (predio.propietarios && predio.propietarios.length > 0) {
      newPropietarios = predio.propietarios.map(p => ({
        nombre_propietario: p.nombre_propietario || '',
        tipo_documento: p.tipo_documento || 'C',
        numero_documento: p.numero_documento || '',
        estado_civil: p.estado_civil || ''
      }));
    } else if (predio.nombre_propietario) {
      newPropietarios = [{
        nombre_propietario: predio.nombre_propietario || '',
        tipo_documento: predio.tipo_documento || 'C',
        numero_documento: predio.numero_documento || '',
        estado_civil: predio.estado_civil || ''
      }];
    } else {
      newPropietarios = [{
        nombre_propietario: '',
        tipo_documento: 'C',
        numero_documento: '',
        estado_civil: ''
      }];
    }
    
    // Obtener datos R2
    const r2Data = predio.r2 || (predio.r2_registros && predio.r2_registros[0]) || {};
    const zonasData = r2Data.zonas || [];
    
    let newZonasFisicas;
    if (zonasData.length > 0) {
      newZonasFisicas = zonasData.map(z => ({
        zona_fisica: z.zona_fisica?.toString() || '0',
        zona_economica: z.zona_economica?.toString() || '0',
        area_terreno: z.area_terreno?.toString() ?? '0',
        habitaciones: z.habitaciones?.toString() ?? '0',
        banos: z.banos?.toString() ?? '0',
        locales: z.locales?.toString() ?? '0',
        pisos: z.pisos?.toString() ?? '0',
        puntaje: z.puntaje?.toString() ?? '0',
        area_construida: z.area_construida?.toString() ?? '0'
      }));
    } else {
      newZonasFisicas = [{
        zona_fisica: '0',
        zona_economica: '0',
        area_terreno: '0',
        habitaciones: '0',
        banos: '0',
        locales: '0',
        pisos: '0',
        puntaje: '0',
        area_construida: '0'
      }];
    }
    
    const matricula = r2Data.matricula_inmobiliaria || predio.matricula_inmobiliaria || '';
    
    const newFormData = {
      ...formData,
      municipio: predio.municipio,
      zona: predio.zona,
      sector: predio.sector,
      manzana_vereda: predio.manzana_vereda,
      nombre_propietario: predio.propietarios?.[0]?.nombre_propietario || predio.nombre_propietario || '',
      tipo_documento: predio.propietarios?.[0]?.tipo_documento || predio.tipo_documento || 'C',
      numero_documento: predio.propietarios?.[0]?.numero_documento || predio.numero_documento || '',
      estado_civil: predio.propietarios?.[0]?.estado_civil || predio.estado_civil || '',
      direccion: predio.direccion || '',
      comuna: predio.comuna || '0',
      destino_economico: predio.destino_economico || 'A',
      area_terreno: predio.area_terreno?.toString() || '0',
      area_construida: predio.area_construida?.toString() || '0',
      avaluo: predio.avaluo?.toString() || '0',
      tipo_mutacion: predio.tipo_mutacion || '',
      numero_resolucion: predio.numero_resolucion || '',
      matricula_inmobiliaria: matricula
    };
    
    // Cargar zonas de terreno y construcciones para formato automático
    if (esFormatoAutomatico) {
      // Cargar zonas de terreno
      const zonasTerrData = predio.zonas || r2Data.zonas || [];
      if (zonasTerrData.length > 0) {
        setZonasTerreno(zonasTerrData.map(z => ({
          zona_fisica: z.zona_fisica || '',
          zona_economica: z.zona_economica || '',
          area_terreno: String(z.area_terreno ?? 0)
        })));
      } else {
        setZonasTerreno([{ zona_fisica: '', zona_economica: '', area_terreno: '0' }]);
      }
      
      // Cargar construcciones
      const construccionesData = predio.construcciones || r2Data.construcciones || [];
      if (construccionesData.length > 0) {
        setConstrucciones(construccionesData.map((c, i) => ({
          id: c.id || generarIdConstruccion(i),
          piso: String(c.piso ?? 0),
          habitaciones: String(c.habitaciones ?? 0),
          banos: String(c.banos ?? 0),
          locales: String(c.locales ?? 0),
          tipificacion: c.tipificacion || '',
          uso: c.uso || '',
          puntaje: String(c.puntaje ?? 0),
          area_construida: String(c.area_construida ?? 0)
        })));
      } else {
        setConstrucciones([{
          id: 'A',
          piso: '0',
          habitaciones: '0',
          banos: '0',
          locales: '0',
          tipificacion: '',
          uso: '',
          puntaje: '0',
          area_construida: '0'
        }]);
      }
    }
    
    // Hacer todos los setState juntos - React los batcha automáticamente
    setSelectedPredio(predio);
    setPropietarios(newPropietarios);
    setZonasFisicas(newZonasFisicas);
    setFormData(newFormData);
    // Resetear estado de resolución para que el coordinador pueda generar una nueva
    setInfoResolucion({
      tipo_mutacion: '',
      numero_resolucion: '',
      fecha_resolucion: '',
      radicado_peticion: ''
    });
    setRadicadosDisponibles([]);
    setShowEditDialog(true);
  };

  const openDetailDialog = (predio) => {
    setSelectedPredio(predio);
    setShowDetailDialog(true);
  };

  const resetForm = () => {
    setFormData({
      municipio: filterMunicipio || '', // Mantener el municipio si está seleccionado
      zona: '00',
      sector: '01',
      manzana_vereda: '0000',
      condicion_predio: '0000',
      predio_horizontal: '0000',
      direccion: '',
      comuna: '0',
      destino_economico: 'A',
      avaluo: '',
      tipo_mutacion: '',
      numero_resolucion: '',
      fecha_resolucion: '',
      matricula_inmobiliaria: '',
      zona_fisica_1: '0',
      zona_economica_1: '0',
      area_terreno_1: '0',
      habitaciones_1: '0',
      banos_1: '0',
      locales_1: '0',
      pisos_1: '0',
      puntaje_1: '0',
      area_construida_1: '0'
    });
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
    setPropietarios([{
      nombre_propietario: '',
      estado_civil: '',
      tipo_documento: 'C',
      numero_documento: ''
    }]);
    setZonasFisicas([{
      zona_fisica: '0',
      zona_economica: '0',
      area_terreno: '0',
      habitaciones: '0',
      banos: '0',
      locales: '0',
      pisos: '0',
      puntaje: '0',
      area_construida: '0'
    }]);
    // Resetear nuevos estados separados R2
    setZonasTerreno([{
      zona_fisica: '',
      zona_economica: '',
      area_terreno: '0'
    }]);
    setConstrucciones([{
      id: 'A',
      piso: '0',
      habitaciones: '0',
      banos: '0',
      locales: '0',
      tipificacion: '',
      uso: '',
      puntaje: '0',
      area_construida: '0'
    }]);
    setEstructuraCodigo(null);
    setVerificacionCodigo(null);
    setTerrenoInfo(null);
    setGestorAsignado('');
    // Limpiar estados del nuevo flujo
    setRadicadoNumero('');
    setRadicadoInfo(null);
    setPeticionesRelacionadas([]);
    setObservacionesCreacion('');
    setUsarNuevoFlujo(false);
    setEditingPredioNuevoId(null); // Limpiar ID de predio en edición
    delete window.__reaparicionConfirmada; // Limpiar flag de reaparición
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0);
  };

  // Formato de área: X ha X.XXX m²
  const formatAreaHectareas = (m2) => {
    if (!m2 || m2 === 0) return '0 m²';
    const hectareas = Math.floor(m2 / 10000);
    const metros = m2 % 10000;
    if (hectareas > 0) {
      return `${hectareas} ha ${metros.toLocaleString('es-CO')} m²`;
    }
    return `${m2.toLocaleString('es-CO')} m²`;
  };

  if (loading && !prediosStats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-700"></div>
      </div>
    );
  }

  // Obtener vigencias disponibles para el municipio seleccionado
  const vigenciasDelMunicipio = filterMunicipio ? vigenciasData[filterMunicipio] || [] : [];
  
  // Función para volver al dashboard
  const volverAlDashboard = () => {
    setShowDashboard(true);
    setFilterMunicipio('');
    setFilterVigencia('');
    setPredios([]);
    setSearch('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-outfit">Gestión de Predios</h1>
          <p className="text-sm text-slate-500">Sistema de información catastral - Código Nacional Catastral</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {/* Indicador Offline */}
          {!isOnline && (
            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
              <WifiOff className="w-3 h-3 mr-1" />
              Sin conexión
            </Badge>
          )}
          {offlineStats.cambiosPendientes > 0 && (
            <Badge 
              variant="outline" 
              className="bg-blue-100 text-blue-700 border-blue-300"
              title="Se sincronizará automáticamente cuando haya conexión"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sincronizando...' : `${offlineStats.cambiosPendientes} pendientes`}
            </Badge>
          )}
          
          {/* Botón Exportar Excel - solo para admin, coordinador, o usuarios con permiso import_r1r2 */}
          {!showDashboard && (
            ['administrador', 'coordinador'].includes(user?.role) || 
            user?.permissions?.includes('import_r1r2')
          ) && (
            <Button variant="outline" onClick={handleExportExcel}>
              <Download className="w-4 h-4 mr-2" />
              Exportar Excel
            </Button>
          )}
          
          {/* Botón Predios Eliminados */}
          {!showDashboard && ['administrador', 'coordinador'].includes(user?.role) && (
            <Button 
              variant="outline" 
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={fetchPrediosEliminados}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminados
            </Button>
          )}
        </div>
      </div>

      {/* Info banner para gestores */}
      {necesitaAprobacion && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-800">Sistema de Aprobación Activo</p>
            <p className="text-xs text-blue-600">Los cambios que realice (crear, modificar, eliminar) quedarán pendientes hasta que un Coordinador los apruebe.</p>
          </div>
        </div>
      )}

      {/* Dashboard de Selección */}
      {showDashboard ? (
        <div className="space-y-6">
          {/* Estadísticas Generales - Solo 4 tarjetas: Total Predios, Avalúo Total, Área R1, Geometrías GDB */}
          {/* Ocultar para rol empresa */}
          {prediosStats && !isEmpresaRole && (
            <StatsPanel stats={prediosStats} />
          )}

          {/* Predios por Municipio - PRIMERO (ordenados alfabéticamente) */}
          {prediosStats?.by_municipio && (
            <Card className="border-slate-200">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg font-outfit">Predios por Municipio</CardTitle>
                    <p className="text-sm text-slate-500">Haga clic en un municipio para ver los predios de la vigencia más reciente</p>
                  </div>
                  {/* Botones de importar R1/R2 y Homologados solo para coordinadores y admins */}
                  {user && ['coordinador', 'administrador'].includes(user.role) && (
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="border-emerald-600 text-emerald-700 hover:bg-emerald-50">
                            <Plus className="w-4 h-4 mr-2" />
                            Importar R1/R2
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle className="text-lg font-outfit">Importar Predios R1/R2</DialogTitle>
                          </DialogHeader>
                          <ImportR1R2Form onSuccess={() => { fetchPrediosStats(); fetchVigencias(); fetchReaparicionesConteo(); }} />
                        </DialogContent>
                      </Dialog>
                      <Button 
                        variant="outline" 
                        className="border-blue-600 text-blue-700 hover:bg-blue-50"
                        onClick={() => { fetchCodigosStats(); setShowCodigosDialog(true); }}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Importar Homologados
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3">
                  {[...prediosStats.by_municipio].sort((a, b) => a.municipio.localeCompare(b.municipio, 'es')).map((item) => {
                    // Obtener la vigencia más reciente del municipio (ordenadas de más nueva a más vieja)
                    const vigencias = vigenciasData[item.municipio] || [];
                    // Filtrar solo vigencias que sean años válidos (4 dígitos entre 2000 y 2100)
                    const vigenciasValidas = vigencias.filter(v => {
                      const vig = v.vigencia;
                      return typeof vig === 'number' && vig >= 2000 && vig <= 2100;
                    });
                    // Ordenar por año descendente y tomar la más reciente
                    const vigenciaReciente = vigenciasValidas.length > 0 
                      ? vigenciasValidas.sort((a, b) => b.vigencia - a.vigencia)[0].vigencia 
                      : new Date().getFullYear();
                    // Conteo de reapariciones para este municipio
                    const reaparicionesCount = reaparicionesConteo[item.municipio] || 0;
                    
                    return (
                      <MunicipioCard
                        key={item.municipio}
                        municipio={item.municipio}
                        count={item.count}
                        showReapariciones={false}
                        onSelect={() => {
                          setFilterMunicipio(item.municipio);
                          setFilterVigencia(String(vigenciaReciente || '2025'));
                        }}
                      />
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Selección de Vigencia y Municipio - DESPUÉS */}
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg font-outfit flex items-center gap-2">
                <Search className="w-5 h-5 text-emerald-700" />
                Búsqueda Avanzada
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-500">
                O seleccione manualmente el municipio y vigencia para una búsqueda específica.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Municipio *</Label>
                  <Select value={filterMunicipio} onValueChange={(v) => { setFilterMunicipio(v); setFilterVigencia(''); }}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Seleccione un municipio" />
                    </SelectTrigger>
                    <SelectContent>
                      {catalogos?.municipios?.slice().sort((a, b) => a.localeCompare(b, 'es')).map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Vigencia (Año) *</Label>
                  <Select 
                    value={filterVigencia} 
                    onValueChange={setFilterVigencia}
                    disabled={!filterMunicipio}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder={filterMunicipio ? "Seleccione vigencia" : "Primero seleccione municipio"} />
                    </SelectTrigger>
                    <SelectContent>
                      {vigenciasDelMunicipio.length > 0 ? (
                        // Filtrar solo vigencias válidas (años entre 2000 y 2100)
                        vigenciasDelMunicipio
                          .filter(v => typeof v.vigencia === 'number' && v.vigencia >= 2000 && v.vigencia <= 2100)
                          .sort((a, b) => b.vigencia - a.vigencia)
                          .map(v => {
                            return (
                              <SelectItem key={v.vigencia} value={String(v.vigencia)}>
                                {v.vigencia} ({v.predios?.toLocaleString()} predios) {v.historico && '(histórico)'}
                              </SelectItem>
                            );
                          })
                      ) : (
                        <SelectItem value={String(new Date().getFullYear())}>{new Date().getFullYear()} (vigencia actual)</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          {/* Vista de Predios (después de seleccionar filtros) */}
          
          {/* Barra de navegación */}
          <div className="flex items-center gap-4 bg-emerald-50 p-4 rounded-lg border border-emerald-200">
            <Button variant="ghost" onClick={volverAlDashboard} className="text-emerald-700 hover:text-emerald-800">
              ← Volver al Dashboard
            </Button>
            <div className="h-6 border-l border-emerald-300"></div>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-100 text-emerald-800">
                {filterMunicipio}
              </Badge>
              <Badge variant="outline" className="border-emerald-300">
                Vigencia {String(filterVigencia).length >= 7 ? String(filterVigencia).slice(-4) : filterVigencia}
              </Badge>
              <Badge variant="secondary">
                {total.toLocaleString()} predios
              </Badge>
            </div>
            
            {/* ====== INDICADOR DE ESTADO DE DATOS ====== */}
            <div className="flex-1"></div>
            <div className="flex items-center gap-2">
              {/* Indicador de revalidación en segundo plano */}
              {isRevalidating && (
                <Badge className="bg-amber-100 text-amber-800 animate-pulse flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Actualizando...
                </Badge>
              )}
              
              {/* Estado de datos */}
              {dataSource === 'server' && !isRevalidating && (
                <Badge className="bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Actualizado
                </Badge>
              )}
              
              {dataSource === 'cache' && !isRevalidating && (
                <Badge className="bg-blue-100 text-blue-800 flex items-center gap-1">
                  <Database className="w-3 h-3" />
                  Desde caché
                </Badge>
              )}
              
              {dataSource === 'offline' && (
                <Badge className="bg-red-100 text-red-800 flex items-center gap-1">
                  <WifiOff className="w-3 h-3" />
                  Sin conexión
                </Badge>
              )}
              
              {/* Última sincronización */}
              {lastSyncTime && (
                <span className={`text-xs ${getCacheStatusColor(cacheAge)}`}>
                  <Clock className="w-3 h-3 inline mr-1" />
                  {formatTimeAgo(lastSyncTime)}
                </span>
              )}
            </div>
          </div>

          {/* Filters */}
          <Card className="border-slate-200">
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        placeholder="Buscar por código, propietario, documento, matrícula..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="pr-8"
                      />
                      {search && (
                        <button
                          onClick={() => setSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          title="Limpiar búsqueda"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <Button onClick={handleSearch} variant="outline">
                      <Search className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {/* Filtro de Base Gráfica */}
                <Select value={filterGeometria} onValueChange={setFilterGeometria}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Base Gráfica" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="con">Con Base Gráfica</SelectItem>
                    <SelectItem value="sin">Sin Base Gráfica</SelectItem>
                  </SelectContent>
                </Select>
                {gdbStats?.por_municipio?.[filterMunicipio] && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                    <Map className="w-3 h-3 mr-1" />
                    {gdbStats.por_municipio[filterMunicipio]?.total || 0} en Base Gráfica
                  </Badge>
                )}
                {/* Nota: Botones de Nuevo Predio y Predios Eliminados removidos.
                    Toda edición se hace desde Mutaciones y Resoluciones */}
                {/* Botón de Subsanaciones - Para gestores y coordinadores */}
                {user && ['gestor', 'coordinador', 'administrador'].includes(user.role) && subsanacionesConteo > 0 && (
                  <Button 
                    variant="outline" 
                    className="border-orange-400 text-orange-700 hover:bg-orange-50 relative"
                    onClick={() => setShowSubsanacionesDialog(true)}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Subsanaciones
                    <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {subsanacionesConteo}
                    </span>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

      {/* Results */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-slate-900 font-outfit flex items-center justify-between">
            <span>Predios Registrados</span>
            <div className="flex items-center gap-2">
              {filterMunicipio && !loading && predios.length > 0 && (
                <>
                  {/* Indicadores de estado - Solo informativos, sin botones manuales */}
                  {isRevalidating && (
                    <Badge className="bg-amber-100 text-amber-800 animate-pulse flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Actualizando...
                    </Badge>
                  )}
                  {dataSource === 'server' && !isRevalidating && (
                    <Badge className="bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Actualizado
                    </Badge>
                  )}
                  {dataSource === 'cache' && !isRevalidating && (
                    <Badge className="bg-blue-100 text-blue-800 flex items-center gap-1">
                      <Database className="w-3 h-3" />
                      Desde caché
                    </Badge>
                  )}
                  {dataSource === 'offline' && (
                    <Badge className="bg-red-100 text-red-800 flex items-center gap-1">
                      <WifiOff className="w-3 h-3" />
                      Sin conexión
                    </Badge>
                  )}
                  {lastSyncTime && (
                    <span className={`text-xs ${getCacheStatusColor(cacheAge)}`}>
                      <Clock className="w-3 h-3 inline mr-1" />
                      {formatTimeAgo(lastSyncTime)}
                    </span>
                  )}
                </>
              )}
              <Badge variant="outline">{total.toLocaleString()} predios</Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700"></div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Código Nacional</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Matrícula</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Propietario(s)</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Dirección</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-700">Área Terreno</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-700">Área Construida</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-700">Destino</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-700">Avalúo</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-700">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {predios.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="py-8 text-center text-slate-500">
                          No hay predios registrados para este municipio y vigencia
                        </td>
                      </tr>
                    ) : (
                      // Predios ya vienen paginados del servidor
                      (() => {
                        return predios.map((predio) => (
                        <tr key={predio.id} className={`border-b border-slate-100 hover:bg-slate-50 ${predio.bloqueado ? 'bg-red-50' : ''}`}>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {predio.bloqueado && (
                                <span className="flex items-center gap-1 bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full" title={`Bloqueado: ${predio.bloqueo_info?.motivo || 'Proceso legal'}`}>
                                  <Lock className="w-3 h-3" />
                                </span>
                              )}
                              <div>
                                <p className="font-mono text-xs font-medium text-emerald-800">{predio.codigo_predial_nacional}</p>
                                <p className="text-xs text-slate-500">Homologado: {predio.codigo_homologado}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {(predio.matricula_inmobiliaria || predio.r2_registros?.[0]?.matricula_inmobiliaria) ? (
                              <span className="font-medium text-slate-800">{predio.matricula_inmobiliaria || predio.r2_registros[0].matricula_inmobiliaria}</span>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Sin información de matrícula</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium text-slate-900">
                                {predio.propietarios?.[0]?.nombre_propietario || predio.nombre_propietario}
                              </p>
                              {(predio.propietarios?.length > 1) && (
                                <Badge variant="secondary" className="text-xs mt-1">
                                  <Users className="w-3 h-3 mr-1" />
                                  +{predio.propietarios.length - 1} más
                                </Badge>
                              )}
                              <p className="text-xs text-slate-500">
                                {catalogos?.tipo_documento?.[predio.propietarios?.[0]?.tipo_documento || predio.tipo_documento]}: {String(predio.propietarios?.[0]?.numero_documento || predio.numero_documento || '').padStart(10, '0')}
                              </p>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-700 max-w-[200px] truncate">{predio.direccion}</td>
                          <td className="py-3 px-4 text-right text-slate-700 whitespace-nowrap text-xs">
                            {formatAreaHectareas(predio.area_terreno)}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-700 whitespace-nowrap text-xs">
                            {formatAreaHectareas(predio.area_construida)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge className="bg-emerald-100 text-emerald-800">
                              {predio.destino_economico}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-900">
                            {formatCurrency(predio.avaluo)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openDetailDialog(predio)} title="Ver detalles">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ));
                      })()
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Controles de Paginación */}
              <Pagination
                currentPage={currentPage}
                totalItems={total}
                pageSize={pageSize}
                onPageChange={(page) => fetchPredios(page)}
                itemLabel="predios"
              />
            </>
          )}
        </CardContent>
      </Card>
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-visible">
          <div className="max-h-[80vh] overflow-y-auto pr-2">
          <DialogHeader>
            <DialogTitle className="text-xl font-outfit">
              Nuevo Predio {filterMunicipio && `- ${filterMunicipio}`}
            </DialogTitle>
          </DialogHeader>
          
          {/* Información del Código Homologado */}
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
            
            <TabsContent value="ubicacion" className="space-y-4 mt-4">
              {/* Municipio - Solo mostrar si no está pre-seleccionado */}
              {!filterMunicipio && (
                <div>
                  <Label>Municipio *</Label>
                  <Select value={formData.municipio} onValueChange={(v) => setFormData({...formData, municipio: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione municipio" />
                    </SelectTrigger>
                    <SelectContent>
                      {catalogos?.municipios?.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Estructura del Código Predial Nacional - 30 dígitos */}
              {estructuraCodigo && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Código Predial Nacional (30 dígitos)
                    {editingPredioNuevoId && !canEditCodigoPredial && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full ml-2">
                        🔒 Solo lectura - Solo coordinadores pueden modificar
                      </span>
                    )}
                  </h4>
                  
                  {/* Visualización del código completo */}
                  <div className="bg-white p-3 rounded border mb-4 font-mono text-lg tracking-wider text-center">
                    <span className="text-blue-600 font-bold" title="Departamento + Municipio">{estructuraCodigo.prefijo_fijo}</span>
                    <span className="text-emerald-600" title="Zona">{codigoManual.zona}</span>
                    <span className="text-amber-600" title="Sector">{codigoManual.sector}</span>
                    <span className="text-purple-600" title="Comuna">{codigoManual.comuna}</span>
                    <span className="text-pink-600" title="Barrio">{codigoManual.barrio}</span>
                    <span className="text-cyan-600" title="Manzana/Vereda">{codigoManual.manzana_vereda}</span>
                    <span className="text-red-600 font-bold" title="Terreno">{codigoManual.terreno}</span>
                    <span className="text-orange-600" title="Condición">{codigoManual.condicion}</span>
                    <span className="text-slate-500" title="Edificio">{codigoManual.edificio}</span>
                    <span className="text-slate-500" title="Piso">{codigoManual.piso}</span>
                    <span className="text-slate-500" title="Unidad">{codigoManual.unidad}</span>
                    <span className="text-xs text-slate-500 ml-2">({construirCodigoCompleto().length}/30)</span>
                  </div>

                  {/* Campos editables - Fila 1: Ubicación geográfica */}
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
                        disabled={editingPredioNuevoId && !canEditCodigoPredial}
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
                        disabled={editingPredioNuevoId && !canEditCodigoPredial}
                      />
                      {ultimaManzanaInfo && ultimaManzanaInfo.ultima_manzana && (
                        <div className="mt-1 p-1.5 bg-amber-50 border border-amber-200 rounded text-xs">
                          <span className="text-amber-700">
                            Última manzana: <strong>{ultimaManzanaInfo.ultima_manzana}</strong>
                          </span>
                        </div>
                      )}
                      {ultimaManzanaInfo && !ultimaManzanaInfo.ultima_manzana && (
                        <span className="text-xs text-slate-400 block mt-1">Sin manzanas registradas</span>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-purple-700">Comuna (10-11)</Label>
                      <Input 
                        value={codigoManual.comuna} 
                        onChange={(e) => handleCodigoChange('comuna', e.target.value, 2)}
                        maxLength={2}
                        className="font-mono text-center"
                        placeholder="00"
                        disabled={editingPredioNuevoId && !canEditCodigoPredial}
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
                        disabled={editingPredioNuevoId && !canEditCodigoPredial}
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
                        disabled={editingPredioNuevoId && !canEditCodigoPredial}
                      />
                    </div>
                  </div>

                  {/* Mostrar últimos predios existentes en la manzana */}
                  {codigoManual.manzana_vereda !== '0000' && (
                    <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3">
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

                  {/* Campos editables - Fila 2: Predio y PH */}
                  <div className="grid grid-cols-5 gap-2">
                    <div className="bg-red-50 p-2 rounded border border-red-200">
                      <Label className="text-xs text-red-700 font-semibold">Terreno (18-21) *</Label>
                      <Input 
                        value={codigoManual.terreno} 
                        onChange={(e) => handleCodigoChange('terreno', e.target.value, 4)}
                        maxLength={4}
                        className="font-mono font-bold text-red-700 text-center"
                        placeholder="0001"
                        disabled={editingPredioNuevoId && !canEditCodigoPredial}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-orange-700">Condición (22)</Label>
                      <Input 
                        type="number"
                        min="0"
                        max="9"
                        value={codigoManual.condicion} 
                        onChange={(e) => {
                          const v = e.target.value.slice(0, 1);
                          setCodigoManual({...codigoManual, condicion: v});
                        }}
                        maxLength={1}
                        className="font-mono text-center"
                        placeholder="0"
                        disabled={editingPredioNuevoId && !canEditCodigoPredial}
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
                        disabled={editingPredioNuevoId && !canEditCodigoPredial}
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
                        disabled={editingPredioNuevoId && !canEditCodigoPredial}
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
                        disabled={editingPredioNuevoId && !canEditCodigoPredial}
                      />
                    </div>
                  </div>

                  {/* Botón de verificar */}
                  <div className="mt-4 flex gap-3">
                    <Button onClick={verificarCodigoCompleto} variant="outline" className="flex-1">
                      <Search className="w-4 h-4 mr-2" />
                      Verificar Código
                    </Button>
                  </div>
                </div>
              )}

              {/* Info del terreno disponible */}
              {terrenoInfo && (
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg">
                  <h4 className="font-semibold text-emerald-800 mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Sugerencia para esta Manzana/Vereda
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-slate-500">Predios activos:</span>
                      <p className="font-bold text-emerald-700">{terrenoInfo.total_activos}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Siguiente terreno:</span>
                      <p className="font-bold text-emerald-700 text-lg">{terrenoInfo.siguiente_terreno}</p>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <span className="text-slate-500">Código sugerido:</span>
                      <p className="font-bold text-slate-800 text-xs font-mono break-all">{terrenoInfo.codigo_sugerido}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Base Gráfica:</span>
                      <p className={`font-bold ${terrenoInfo.tiene_geometria_gdb ? 'text-emerald-700' : 'text-amber-600'}`}>
                        {terrenoInfo.tiene_geometria_gdb ? '✅ Disponible' : '⚠️ No disponible'}
                      </p>
                    </div>
                  </div>
                  {terrenoInfo.terrenos_eliminados?.length > 0 && (
                    <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700">
                      <span className="font-medium">⚠️ Terrenos eliminados (requieren confirmación para reutilizar): </span>
                      {terrenoInfo.terrenos_eliminados.map(t => t.numero).join(', ')}
                    </div>
                  )}
                  {!terrenoInfo.tiene_geometria_gdb && (
                    <p className="mt-2 text-xs text-amber-700">{terrenoInfo.mensaje_geometria}</p>
                  )}
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
                  
                  {verificacionCodigo.estado === 'eliminado' && (
                    <div className="mt-2 text-sm text-amber-700">
                      <p>Vigencia eliminación: {verificacionCodigo.detalles_eliminacion?.vigencia_eliminacion}</p>
                      <p>Motivo: {verificacionCodigo.detalles_eliminacion?.motivo}</p>
                      <p className="mt-2 font-medium">
                        Puede continuar creando el predio con información nueva (R1/R2). Solo se conserva el código.
                      </p>
                    </div>
                  )}
                  
                  {verificacionCodigo.estado === 'existente' && (
                    <div className="mt-2 text-sm text-red-700">
                      <p>Propietario actual: {verificacionCodigo.predio?.nombre_propietario}</p>
                      <p>No puede crear un predio con este código.</p>
                    </div>
                  )}
                  
                  {verificacionCodigo.tiene_geometria !== undefined && (
                    <p className={`mt-2 text-sm ${verificacionCodigo.tiene_geometria ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {verificacionCodigo.tiene_geometria 
                        ? `✅ Tiene información gráfica (GDB) - Área: ${(verificacionCodigo.area_gdb || 0).toLocaleString()} m²`
                        : verificacionCodigo.mensaje_geometria || '⚠️ Sin información gráfica'
                      }
                    </p>
                  )}
                </div>
              )}
            </TabsContent>
            
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
                    {/* Nombre Completo - Un solo campo con guía interactiva */}
                    <div className="col-span-2">
                      <Label className="text-xs">Nombre Completo *</Label>
                      <Input 
                        value={prop.nombre_propietario || ''} 
                        onChange={(e) => actualizarPropietario(index, 'nombre_propietario', e.target.value.toUpperCase())}
                        placeholder="PÉREZ GARCÍA JUAN CARLOS"
                        className="font-mono"
                      />
                      <GuiaNombre nombre={prop.nombre_propietario} />
                    </div>
                    
                    {/* Estado Civil */}
                    <div className="col-span-2">
                      <Label className="text-xs">Estado Civil</Label>
                      <RadioGroup 
                        value={prop.estado_civil || ''} 
                        onValueChange={(v) => actualizarPropietario(index, 'estado_civil', v)}
                        className="flex flex-wrap gap-2 mt-1"
                      >
                        <div className="flex items-center space-x-1">
                          <RadioGroupItem value="" id={`estado_${index}_sin`} />
                          <Label htmlFor={`estado_${index}_sin`} className="text-xs cursor-pointer text-slate-500">Sin especificar</Label>
                        </div>
                        <div className="flex items-center space-x-1">
                          <RadioGroupItem value="S" id={`estado_${index}_soltero`} />
                          <Label htmlFor={`estado_${index}_soltero`} className="text-xs cursor-pointer">S: Soltero/a</Label>
                        </div>
                        <div className="flex items-center space-x-1">
                          <RadioGroupItem value="C" id={`estado_${index}_casado`} />
                          <Label htmlFor={`estado_${index}_casado`} className="text-xs cursor-pointer">C: Casado/a</Label>
                        </div>
                        <div className="flex items-center space-x-1">
                          <RadioGroupItem value="V" id={`estado_${index}_viudo`} />
                          <Label htmlFor={`estado_${index}_viudo`} className="text-xs cursor-pointer">V: Viudo/a</Label>
                        </div>
                        <div className="flex items-center space-x-1">
                          <RadioGroupItem value="U" id={`estado_${index}_union`} />
                          <Label htmlFor={`estado_${index}_union`} className="text-xs cursor-pointer">U: Unión libre</Label>
                        </div>
                      </RadioGroup>
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
                            <RadioGroupItem value={k} id={`tipo_doc_${index}_${k}`} />
                            <Label htmlFor={`tipo_doc_${index}_${k}`} className="text-xs cursor-pointer">{k}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                    <div>
                      <Label className="text-xs">Número Documento *</Label>
                      <Input
                        value={prop.numero_documento || ''}
                        onChange={(e) => {
                          const valor = e.target.value.replace(/\D/g, '').slice(0, 12);
                          actualizarPropietario(index, 'numero_documento', valor);
                        }}
                        onBlur={(e) => { if (e.target.value) actualizarPropietario(index, 'numero_documento', e.target.value.replace(/\D/g, '').padStart(12, '0')); }}
                        placeholder="Ej: 1091672736"
                      />
                      {prop.numero_documento && (
                        <p className="text-xs text-emerald-600 mt-1">
                          Formato final: <strong>{prop.numero_documento.padStart(12, '0')}</strong>
                        </p>
                      )}
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
                          <RadioGroupItem value={k} id={`destino_${k}`} />
                          <Label htmlFor={`destino_${k}`} className="text-xs cursor-pointer">{k} - {v}</Label>
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
                    <Input type="text" placeholder="Ej: 200.000" value={formData.avaluo} onChange={(e) => setFormData({...formData, avaluo: e.target.value})} />
                  </div>
                </div>
              </div>
            </TabsContent>
            
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
          
          {/* Toggle para usar el nuevo flujo de trabajo */}
          <div className="border-t border-slate-200 pt-4 mt-4">
            <div className="flex items-center gap-2 mb-4">
              <input 
                type="checkbox" 
                id="usar-nuevo-flujo" 
                checked={usarNuevoFlujo}
                onChange={(e) => setUsarNuevoFlujo(e.target.checked)}
                className="rounded border-emerald-300 text-emerald-600"
              />
              <Label htmlFor="usar-nuevo-flujo" className="text-sm font-medium text-emerald-700 cursor-pointer">
                📋 Usar flujo de trabajo con Gestor de Apoyo (Conservación)
              </Label>
            </div>
            
            {usarNuevoFlujo ? (
              <div className="space-y-4 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="text-sm text-emerald-800 mb-3">
                  <p className="font-medium mb-1">Flujo de Trabajo:</p>
                  <p className="text-xs text-emerald-600">
                    Creado → Digitalización (Gestor Apoyo) → Revisión → Aprobado/Devuelto/Rechazado
                  </p>
                </div>
                
                {/* Gestor de Apoyo (Obligatorio) */}
                <div className="relative">
                  <Label className="text-sm font-medium">Gestor de Apoyo *</Label>
                  <p className="text-xs text-slate-500 mb-1">Responsable de completar la digitalización del predio</p>
                  <select 
                    value={gestorAsignado} 
                    onChange={(e) => setGestorAsignado(e.target.value)}
                    className="w-full h-10 px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    data-testid="gestor-apoyo-trigger"
                  >
                    <option value="">Seleccione un gestor de apoyo...</option>
                    {gestoresDisponibles.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.full_name} ({g.role === 'gestor' ? 'Gestor' : g.role === 'coordinador' ? 'Coordinador' : 'Atención'})
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Radicado relacionado - REQUERIDO */}
                <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                  <Label className="text-blue-800 font-medium flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Radicado Asociado (Requerido) *
                  </Label>
                  <p className="text-xs text-blue-600 mt-1 mb-2">Formato: RASMGC-XXXX-DD-MM-AAAA (solo ingrese los 4 dígitos)</p>
                  <div className="flex gap-2">
                    <div className="flex items-center bg-white px-3 py-2 rounded-l border border-r-0 text-sm text-slate-600">
                      RASMGC-
                    </div>
                    <Input 
                      type="text"
                      value={radicadoNumero}
                      onChange={(e) => {
                        const valor = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
                        setRadicadoNumero(valor);
                      }}
                      placeholder="5511"
                      maxLength={4}
                      className="w-24 text-center font-mono border-blue-300"
                    />
                    <div className="flex items-center bg-white px-3 py-2 border text-sm text-slate-600">
                      -{radicadoInfo?.encontrado ? radicadoInfo.fecha : 'DD-MM-AAAA'}
                    </div>
                    <Button 
                      type="button" 
                      variant="outline"
                      size="sm"
                      onClick={() => buscarRadicado(radicadoNumero)}
                      disabled={buscandoRadicado || !radicadoNumero}
                      className="border-blue-300"
                    >
                      {buscandoRadicado ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </Button>
                  </div>
                  {radicadoInfo && (
                    <div className={`mt-2 p-2 rounded text-xs ${radicadoInfo.encontrado ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {radicadoInfo.encontrado ? (
                        <>
                          <p><strong>Radicado:</strong> {radicadoInfo.radicado_completo}</p>
                          {radicadoInfo.solicitante && <p><strong>Solicitante:</strong> {radicadoInfo.solicitante}</p>}
                          {radicadoInfo.tipo_tramite && <p><strong>Tipo:</strong> {radicadoInfo.tipo_tramite}</p>}
                        </>
                      ) : (
                        <p>{radicadoInfo.mensaje}</p>
                      )}
                    </div>
                  )}
                  {!radicadoNumero && (
                    <p className="text-xs text-amber-600 mt-2">
                      ⚠️ Debe ingresar un número de radicado para justificar la creación del predio
                    </p>
                  )}
                </div>
                
                {/* Peticiones relacionadas (Multi-select) */}
                <div>
                  <Label className="text-sm font-medium">Peticiones Relacionadas (Opcional)</Label>
                  <p className="text-xs text-slate-500 mb-1">Vincule trámites existentes a este predio</p>
                  {peticionesDisponibles.length > 0 ? (
                    <div className="max-h-32 overflow-y-auto border rounded p-2 bg-white">
                      {peticionesDisponibles.slice(0, 10).map(p => (
                        <div key={p.id} className="flex items-center gap-2 py-1">
                          <input
                            type="checkbox"
                            id={`peticion-${p.id}`}
                            checked={peticionesRelacionadas.includes(p.id)}
                            onChange={() => togglePeticionRelacionada(p.id)}
                            className="rounded border-slate-300"
                          />
                          <label htmlFor={`peticion-${p.id}`} className="text-xs cursor-pointer flex-1">
                            <span className="font-mono text-emerald-700">{p.radicado}</span>
                            <span className="text-slate-500 ml-2">{p.nombre_completo}</span>
                          </label>
                        </div>
                      ))}
                      {peticionesDisponibles.length > 10 && (
                        <p className="text-xs text-slate-400 mt-1">+{peticionesDisponibles.length - 10} más...</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No hay peticiones activas disponibles</p>
                  )}
                  {peticionesRelacionadas.length > 0 && (
                    <p className="text-xs text-emerald-600 mt-1">
                      ✓ {peticionesRelacionadas.length} petición(es) seleccionada(s)
                    </p>
                  )}
                </div>
                
                {/* Observaciones */}
                <div>
                  <Label className="text-sm font-medium">Observaciones (Opcional)</Label>
                  <textarea
                    value={observacionesCreacion}
                    onChange={(e) => setObservacionesCreacion(e.target.value)}
                    placeholder="Instrucciones especiales para el Gestor de Apoyo..."
                    className="w-full mt-1 p-2 border rounded text-sm min-h-[60px]"
                  />
                </div>
              </div>
            ) : null}
            
            {/* Acto Administrativo / Resolución - OBLIGATORIO para predios nuevos */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Label className="text-sm font-medium text-blue-800 flex items-center gap-1 mb-2">
                <FileText className="w-4 h-4" />
                Información de Resolución
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-slate-600">Tipo de Mutación</Label>
                  <select
                    className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
                    value={formData.tipo_mutacion}
                    onChange={(e) => setFormData({ ...formData, tipo_mutacion: e.target.value })}
                    data-testid="tipo-mutacion-select"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="Mutación Primera">Mutación Primera - Cambio de propietario</option>
                    <option value="Mutación Segunda">Mutación Segunda - Englobe o Desenglobe</option>
                    <option value="Mutación Tercera">Mutación Tercera - Modificación de construcción o destino</option>
                    <option value="Mutación Cuarta">Mutación Cuarta - Auto estimación del avalúo catastral</option>
                    <option value="Mutación Quinta">Mutación Quinta - Inscripción o eliminación de predio</option>
                    <option value="Mutación Sexta">Mutación Sexta - Rectificación de área</option>
                    <option value="Complementación">Complementación de información catastral</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Número de Resolución / Acto</Label>
                  <Input
                    type="text"
                    value={formData.acto_administrativo}
                    onChange={(e) => setFormData({ ...formData, acto_administrativo: e.target.value })}
                    placeholder="Ej: RES-540-0106-2026"
                    className="bg-white"
                    data-testid="acto-administrativo-input"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Fecha de Resolución</Label>
                  <Input
                    type="date"
                    value={formData.fecha_resolucion}
                    onChange={(e) => setFormData({ ...formData, fecha_resolucion: e.target.value })}
                    className="bg-white"
                    data-testid="fecha-resolucion-input"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => handleCloseDialog(false)}>Cancelar</Button>
            <Button 
              onClick={handleCreate} 
              className="bg-emerald-700 hover:bg-emerald-800"
              disabled={
                isSavingCreate || 
                (usarNuevoFlujo && !radicadoNumero && !['coordinador', 'administrador'].includes(user?.role))
              }
            >
              {isSavingCreate ? 'Creando...' : (usarNuevoFlujo ? 'Crear y Asignar a Flujo' : 'Crear Predio')}
            </Button>
          </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación al cerrar sin completar */}
      <Dialog open={showConfirmClose} onOpenChange={setShowConfirmClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-amber-700 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Predio sin completar
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-slate-700 mb-4">
              Has iniciado el registro de un nuevo predio pero no lo has completado ni enviado para revisión.
            </p>
            <p className="text-slate-600 text-sm mb-4">
              <strong>¿Deseas asignar a otro gestor</strong> para que continúe con el diligenciamiento?
            </p>
            
            {gestoresDisponibles.length > 0 && (
              <Select value={gestorAsignado || "sin_asignar"} onValueChange={(v) => setGestorAsignado(v === "sin_asignar" ? "" : v)}>
                <SelectTrigger className="w-full mb-4">
                  <SelectValue placeholder="Seleccione un gestor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sin_asignar">No asignar a nadie</SelectItem>
                  {gestoresDisponibles.map(g => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.full_name} ({g.role === 'gestor' ? 'Gestor' : g.role === 'gestor_auxiliar' ? 'Auxiliar' : 'Coordinador'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={confirmarCierreSinGuardar} className="text-red-600 hover:text-red-700">
              Descartar cambios
            </Button>
            {gestorAsignado ? (
              <Button 
                onClick={handleCreate} 
                className="bg-emerald-700 hover:bg-emerald-800"
                disabled={isSavingCreate}
              >
                {isSavingCreate ? 'Guardando...' : 'Guardar y Asignar'}
              </Button>
            ) : (
              <Button onClick={() => setShowConfirmClose(false)} className="bg-blue-600 hover:bg-blue-700">
                Continuar editando
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-visible">
          <div className="max-h-[80vh] overflow-y-auto pr-2">
          <DialogHeader>
            <DialogTitle className="text-xl font-outfit">Editar Predio - {selectedPredio?.codigo_predial_nacional}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-sm text-slate-600">
                <strong>Código Predial Nacional:</strong> {selectedPredio?.codigo_predial_nacional}
              </p>
              {(selectedPredio?.r2_registros?.[0]?.matricula_inmobiliaria || selectedPredio?.matricula_inmobiliaria) && (
                <p className="text-sm text-slate-600 mt-1">
                  <strong>Matrícula Inmobiliaria:</strong> {selectedPredio?.r2_registros?.[0]?.matricula_inmobiliaria || selectedPredio?.matricula_inmobiliaria}
                </p>
              )}
              
              {/* Campo editable del código predial - Solo para coordinadores y administradores */}
              {canEditCodigoPredial && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Label className="text-xs text-blue-700 font-semibold flex items-center gap-2">
                    <FileText className="w-3 h-3" />
                    Modificar Código Predial Nacional (Solo Coordinadores)
                  </Label>
                  <Input 
                    value={formData.codigo_predial_nacional || selectedPredio?.codigo_predial_nacional || ''} 
                    onChange={(e) => {
                      const valor = e.target.value.replace(/\D/g, '').slice(0, 30);
                      setFormData({...formData, codigo_predial_nacional: valor});
                    }}
                    maxLength={30}
                    className="font-mono mt-2"
                    placeholder="30 dígitos"
                  />
                  <p className="text-xs text-blue-600 mt-1">
                    {(formData.codigo_predial_nacional || selectedPredio?.codigo_predial_nacional || '').length}/30 dígitos
                  </p>
                </div>
              )}
            </div>
            
            {/* Sección de Información de Resolución - Solo para coordinadores y administradores */}
            {canEditCodigoPredial && (
              <div className="border border-purple-200 rounded-lg p-4 bg-purple-50">
                <h4 className="font-semibold text-purple-800 flex items-center gap-2 mb-4">
                  <FileText className="w-4 h-4" />
                  Información de Resolución
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  {/* Tipo de Mutación */}
                  <div>
                    <Label className="text-xs text-purple-700">Tipo de Mutación</Label>
                    <select
                      value={infoResolucion.tipo_mutacion}
                      onChange={async (e) => {
                        const tipo = e.target.value;
                        setInfoResolucion(prev => ({ ...prev, tipo_mutacion: tipo }));
                        if (tipo === 'M1' && selectedPredio) {
                          // Obtener código de municipio del predio
                          const codigo = selectedPredio.codigo_predial_nacional || '';
                          const codigoMunicipio = codigo.substring(0, 5);
                          await cargarSiguienteNumeroResolucion(codigoMunicipio);
                          await cargarRadicadosDisponibles(selectedPredio.municipio);
                        } else {
                          setInfoResolucion(prev => ({ ...prev, numero_resolucion: '', fecha_resolucion: '' }));
                        }
                      }}
                      className="w-full mt-1 px-3 py-2 border border-purple-300 rounded-lg text-sm bg-white"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="M1">M1 - Mutación Primera</option>
                      <option value="M2" disabled>M2 - Mutación Segunda (Próximamente)</option>
                      <option value="M3" disabled>M3 - Mutación Tercera (Próximamente)</option>
                    </select>
                  </div>
                  
                  {/* Número de Resolución - Auto generado */}
                  <div>
                    <Label className="text-xs text-purple-700">Número de Resolución</Label>
                    <div className="relative">
                      <Input 
                        value={infoResolucion.numero_resolucion}
                        readOnly
                        className="mt-1 bg-purple-100 font-mono text-purple-800"
                        placeholder={cargandoNumeroResolucion ? "Generando..." : "Seleccione tipo de mutación"}
                      />
                      {cargandoNumeroResolucion && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                          <RefreshCw className="w-4 h-4 animate-spin text-purple-600" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-purple-600 mt-1">Se genera automáticamente</p>
                  </div>
                  
                  {/* Fecha de Resolución - Auto generada con opción manual */}
                  <div>
                    <Label className="text-xs text-purple-700">Fecha de Resolución</Label>
                    <Input 
                      type="date"
                      value={infoResolucion.fecha_resolucion ? 
                        infoResolucion.fecha_resolucion.split('/').reverse().join('-') : 
                        new Date().toISOString().split('T')[0]
                      }
                      onChange={(e) => {
                        const fecha = e.target.value;
                        const partes = fecha.split('-');
                        const fechaFormateada = `${partes[2]}/${partes[1]}/${partes[0]}`;
                        setInfoResolucion(prev => ({ ...prev, fecha_resolucion: fechaFormateada }));
                      }}
                      className="mt-1"
                    />
                    <p className="text-xs text-purple-600 mt-1">Automática, puede modificar si requiere</p>
                  </div>
                  
                  {/* Radicado de Petición - Búsqueda manual o selección */}
                  <div>
                    <Label className="text-xs text-purple-700">Radicado de Petición</Label>
                    <div className="relative">
                      <Input
                        type="text"
                        value={infoResolucion.radicado_peticion}
                        onChange={async (e) => {
                          const valor = e.target.value.toUpperCase();
                          setInfoResolucion(prev => ({ ...prev, radicado_peticion: valor }));
                          // Buscar radicados mientras escribe (mínimo 3 caracteres)
                          if (valor.length >= 3) {
                            await cargarRadicadosDisponibles('', valor); // Sin filtrar por municipio
                          } else {
                            setRadicadosDisponibles([]);
                          }
                        }}
                        placeholder="Escribir número de radicado..."
                        className="mt-1"
                      />
                      {/* Lista de resultados de búsqueda */}
                      {radicadosDisponibles.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-purple-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                          {radicadosDisponibles.map(rad => (
                            <button
                              key={rad.id}
                              type="button"
                              onClick={() => {
                                setInfoResolucion(prev => ({ ...prev, radicado_peticion: rad.radicado }));
                                setRadicadosDisponibles([]);
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-purple-50 border-b border-slate-100 last:border-0"
                            >
                              <span className="font-mono text-purple-700">{rad.radicado}</span>
                              <span className="text-slate-500 ml-2">- {rad.tipo_tramite}</span>
                              {rad.nombre_completo && (
                                <span className="text-slate-400 text-xs block">{rad.nombre_completo}</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-purple-600 mt-1">
                      Escriba al menos 3 caracteres para buscar
                    </p>
                  </div>
                </div>
                
                {/* Preview del número de resolución */}
                {infoResolucion.numero_resolucion && (
                  <div className="mt-4 p-3 bg-white rounded-lg border border-purple-200">
                    <p className="text-xs text-purple-600 mb-1">Vista previa:</p>
                    <p className="font-mono text-lg font-bold text-purple-800">
                      {infoResolucion.numero_resolucion}
                    </p>
                    <p className="text-sm text-slate-600">
                      Fecha: {infoResolucion.fecha_resolucion || new Date().toLocaleDateString('es-CO')}
                      {infoResolucion.radicado_peticion && ` | Radicado: ${infoResolucion.radicado_peticion}`}
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* Sección de Propietarios */}
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
                        placeholder="PÉREZ GARCÍA JUAN CARLOS"
                        className="font-mono"
                      />
                      <GuiaNombre nombre={prop.nombre_propietario} />
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
                            <RadioGroupItem value={k} id={`edit_tipo_doc_${index}_${k}`} />
                            <Label htmlFor={`edit_tipo_doc_${index}_${k}`} className="text-xs cursor-pointer">{k}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                    <div>
                      <Label className="text-xs">Número Documento *</Label>
                      <Input 
                        value={prop.numero_documento} 
                        onChange={(e) => {
                          const valor = e.target.value.replace(/\D/g, '').slice(0, 12);
                          actualizarPropietario(index, 'numero_documento', valor);
                        }}
                        placeholder="Ej: 1091672736"
                      />
                      {prop.numero_documento && (
                        <p className="text-xs text-emerald-600 mt-1">
                          Formato final: <strong>{prop.numero_documento.padStart(12, '0')}</strong>
                        </p>
                      )}
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs mb-2 block">Estado Civil</Label>
                      <RadioGroup 
                        value={prop.estado_civil || ""} 
                        onValueChange={(v) => actualizarPropietario(index, 'estado_civil', v)}
                        className="flex flex-wrap gap-3"
                      >
                        <div className="flex items-center space-x-1">
                          <RadioGroupItem value="" id={`estado_civil_${index}_none`} />
                          <Label htmlFor={`estado_civil_${index}_none`} className="text-xs cursor-pointer text-slate-500">Sin especificar</Label>
                        </div>
                        {catalogos?.estado_civil && Object.entries(catalogos.estado_civil).map(([k, v]) => (
                          <div key={k} className="flex items-center space-x-1">
                            <RadioGroupItem value={k} id={`estado_civil_${index}_${k}`} />
                            <Label htmlFor={`estado_civil_${index}_${k}`} className="text-xs cursor-pointer">{v}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Información del Predio */}
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
                  <Input type="text" placeholder="Ej: 200.000" value={formData.avaluo} onChange={(e) => setFormData({...formData, avaluo: e.target.value})} />
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
            
            {/* Sección R2 - Condicional según tipo de predio */}
            {usarFormatoAutomatico ? (
              /* ═══════════ FORMATO AUTOMÁTICO: R2 → R1 ═══════════ */
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <p className="text-sm text-emerald-800 font-medium">
                    {selectedPredio?.area_editada_en_plataforma && !selectedPredio?.creado_en_plataforma
                      ? '✅ Área modificada en plataforma - Las áreas de R2 se sincronizan automáticamente a R1'
                      : '✅ Predio creado en plataforma - Las áreas de R2 se sincronizan automáticamente a R1'
                    }
                  </p>
                </div>
                
                {/* Zonas de Terreno */}
                <div className="border border-blue-200 rounded-lg p-4 bg-blue-50/30">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-semibold text-blue-800">Zonas de Terreno (R2)</h4>
                    <Button type="button" variant="outline" size="sm" onClick={agregarZonaTerreno} className="text-blue-700 border-blue-300">
                      <Plus className="w-4 h-4 mr-1" /> Agregar Zona
                    </Button>
                  </div>
                  
                  {zonasTerreno.map((zona, index) => (
                    <div key={index} className="border border-blue-200 rounded-lg p-3 bg-white mb-2">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-blue-700">Zona {index + 1}</span>
                        {zonasTerreno.length > 1 && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => eliminarZonaTerreno(index)} className="text-red-600 hover:text-red-700 h-6 w-6 p-0">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">Zona Física</Label>
                          <Input value={zona.zona_fisica} onChange={(e) => actualizarZonaTerreno(index, 'zona_fisica', e.target.value)} placeholder="Ej: 01" />
                        </div>
                        <div>
                          <Label className="text-xs">Zona Económica</Label>
                          <Input value={zona.zona_economica} onChange={(e) => actualizarZonaTerreno(index, 'zona_economica', e.target.value)} placeholder="Ej: A" />
                        </div>
                        <div>
                          <Label className="text-xs">Área Terreno (m²)</Label>
                          <Input type="number" value={zona.area_terreno} onChange={(e) => actualizarZonaTerreno(index, 'area_terreno', e.target.value)} />
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="bg-blue-100 border border-blue-300 rounded p-2 mt-2">
                    <p className="text-sm text-blue-800">
                      📊 <strong>Total Área Terreno → R1:</strong> {calcularAreasTotales().areaTerrenoTotal.toLocaleString('es-CO', {minimumFractionDigits: 2})} m²
                    </p>
                  </div>
                </div>
                
                {/* Construcciones */}
                <div className="border border-amber-200 rounded-lg p-4 bg-amber-50/30">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-semibold text-amber-800">Construcciones (R2)</h4>
                    <Button type="button" variant="outline" size="sm" onClick={agregarConstruccion} className="text-amber-700 border-amber-300">
                      <Plus className="w-4 h-4 mr-1" /> Agregar Construcción
                    </Button>
                  </div>
                  
                  {construcciones.map((const_, index) => (
                    <div key={index} className="border border-amber-200 rounded-lg p-3 bg-white mb-2">
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
                          <Input value={const_.tipificacion} onChange={(e) => actualizarConstruccion(index, 'tipificacion', e.target.value.toUpperCase())} />
                        </div>
                        <div>
                          <Label className="text-xs">Uso</Label>
                          <Input value={const_.uso} onChange={(e) => actualizarConstruccion(index, 'uso', e.target.value.toUpperCase())} />
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
                  
                  <div className="bg-amber-100 border border-amber-300 rounded p-2 mt-2">
                    <p className="text-sm text-amber-800">
                      📊 <strong>Total Área Construida → R1:</strong> {calcularAreasTotales().areaConstruidaTotal.toLocaleString('es-CO', {minimumFractionDigits: 2})} m²
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* ═══════════ FORMATO MANUAL: Zonas Físicas unificadas ═══════════ */
              <div className="border border-slate-200 rounded-lg p-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                  <p className="text-sm text-amber-800">
                    ⚠️ Predio importado - Las áreas R1 y R2 se manejan de forma independiente
                  </p>
                </div>
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
            )}
          </div>
          
          {/* Selector de Radicado Asociado - Solo para gestores (no coordinadores/admin que aprueban directamente) */}
          {!['coordinador', 'administrador'].includes(user?.role) && (
            <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 mt-4">
              <Label className="text-blue-800 font-medium flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Radicado Asociado (Requerido)
              </Label>
              <p className="text-xs text-blue-600 mt-1 mb-2">
                Seleccione la petición/radicado que justifica esta modificación
              </p>
              <select 
                value={radicadoSeleccionado} 
                onChange={(e) => setRadicadoSeleccionado(e.target.value)}
                className="w-full h-10 px-3 py-2 text-sm border border-blue-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="radicado-trigger"
              >
                <option value="">Seleccione un radicado...</option>
                {peticionesDisponibles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.radicado} - {p.tipo_tramite} ({p.nombre_completo})
                  </option>
                ))}
              </select>
              {!radicadoSeleccionado && (
                <p className="text-xs text-amber-600 mt-2">
                  ⚠️ Debe seleccionar un radicado para justificar la modificación
                </p>
              )}
            </div>
          )}
          
          {/* Opción: Asignar a Gestor de Apoyo para completar modificación */}
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 mt-4">
            <div className="flex items-center gap-2 mb-2">
              <input 
                type="checkbox" 
                id="usar-gestor-apoyo-mod"
                checked={usarGestorApoyoMod}
                onChange={(e) => {
                  setUsarGestorApoyoMod(e.target.checked);
                  if (!e.target.checked) {
                    setGestorApoyoModificacion('');
                    setObservacionesApoyoMod('');
                  }
                }}
                className="rounded border-amber-300 text-amber-600"
              />
              <Label htmlFor="usar-gestor-apoyo-mod" className="text-sm font-medium text-amber-700 cursor-pointer">
                👥 Asignar a Gestor de Apoyo para completar esta modificación
              </Label>
            </div>
            <p className="text-xs text-amber-600 mb-3">
              Opcional: Otro miembro del equipo completará la modificación antes de enviarla a aprobación
            </p>
            
            {usarGestorApoyoMod && (
              <div className="space-y-3 pt-2 border-t border-amber-200">
                <div>
                  <Label className="text-xs text-amber-800 font-medium">Gestor de Apoyo *</Label>
                  <select 
                    value={gestorApoyoModificacion} 
                    onChange={(e) => setGestorApoyoModificacion(e.target.value)}
                    className="w-full h-10 px-3 py-2 text-sm border border-amber-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 mt-1"
                    data-testid="gestor-apoyo-mod-trigger"
                  >
                    <option value="">Seleccione un gestor de apoyo...</option>
                    {gestoresDisponibles
                      .filter(g => g.id !== user?.id) // Excluir al usuario actual
                      .map(g => (
                        <option key={g.id} value={g.id}>
                          {g.full_name} ({g.role === 'gestor' ? 'Gestor' : g.role === 'coordinador' ? 'Coordinador' : g.role === 'atencion_usuario' ? 'Atención' : g.role})
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-amber-800 font-medium">Observaciones para el Gestor de Apoyo</Label>
                  <textarea 
                    value={observacionesApoyoMod}
                    onChange={(e) => setObservacionesApoyoMod(e.target.value)}
                    placeholder="Instrucciones o detalles adicionales para completar la modificación..."
                    className="w-full px-3 py-2 text-sm border border-amber-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 mt-1 min-h-[60px]"
                  />
                </div>
                {!gestorApoyoModificacion && (
                  <p className="text-xs text-red-600">
                    ⚠️ Debe seleccionar un gestor de apoyo
                  </p>
                )}
              </div>
            )}
          </div>
          
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => { 
              setShowEditDialog(false); 
              setRadicadoSeleccionado(''); 
              setUsarGestorApoyoMod(false);
              setGestorApoyoModificacion('');
              setObservacionesApoyoMod('');
            }}>Cancelar</Button>
            <Button 
              onClick={handleUpdate} 
              className="bg-emerald-700 hover:bg-emerald-800"
              disabled={
                isSavingUpdate ||
                (!['coordinador', 'administrador'].includes(user?.role) && !radicadoSeleccionado) ||
                (usarGestorApoyoMod && !gestorApoyoModificacion)
              }
            >
              {isSavingUpdate ? 'Guardando...' : (usarGestorApoyoMod ? 'Asignar a Gestor de Apoyo' : 'Guardar Cambios')}
            </Button>
          </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Eliminación de Predio */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-outfit flex items-center gap-2 text-red-700">
              <Trash2 className="w-5 h-5" />
              Eliminar Predio
            </DialogTitle>
            <DialogDescription>
              Complete los datos requeridos para procesar la eliminación del predio.
            </DialogDescription>
          </DialogHeader>
          
          {predioAEliminar && (
            <div className="space-y-4">
              {/* Info del predio a eliminar */}
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-800">
                  CNP: {predioAEliminar.codigo_predial_nacional || 'N/A'}
                </p>
                <p className="text-sm text-red-700">
                  Matrícula: {predioAEliminar.matricula_inmobiliaria || predioAEliminar.matricula || 'N/A'}
                </p>
              </div>
              
              {/* Formulario de eliminación */}
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Radicado (opcional)</Label>
                  <Input
                    placeholder="Ej: RASMGC-1234-01-01-2026"
                    value={eliminacionData.radicado}
                    onChange={(e) => setEliminacionData({...eliminacionData, radicado: e.target.value})}
                    className="mt-1"
                  />
                  <p className="text-xs text-slate-500 mt-1">Si existe un radicado de petición asociado</p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">
                    Número de Resolución <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="Ej: 001-2026"
                    value={eliminacionData.resolucion}
                    onChange={(e) => setEliminacionData({...eliminacionData, resolucion: e.target.value})}
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Fecha de Resolución</Label>
                  <Input
                    type="date"
                    value={eliminacionData.fecha_resolucion}
                    onChange={(e) => setEliminacionData({...eliminacionData, fecha_resolucion: e.target.value})}
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label className="text-sm font-medium">
                    Motivo de Eliminación <span className="text-red-500">*</span>
                  </Label>
                  <textarea
                    placeholder="Describa el motivo de la eliminación del predio..."
                    value={eliminacionData.motivo}
                    onChange={(e) => setEliminacionData({...eliminacionData, motivo: e.target.value})}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 min-h-[80px]"
                  />
                </div>
              </div>
              
              {/* Botones de acción */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isSavingDelete}
                >
                  Cancelar
                </Button>
                <Button 
                  variant="destructive"
                  onClick={handleConfirmDelete}
                  disabled={isSavingDelete || !eliminacionData.resolucion.trim() || !eliminacionData.motivo.trim()}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isSavingDelete ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Confirmar Eliminación
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Deleted Predios Dialog */}
      <Dialog open={showDeletedDialog} onOpenChange={(open) => {
        setShowDeletedDialog(open);
        if (!open) {
          setEliminadosSearch('');
          setEliminadosMunicipio('');
        }
      }}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-outfit flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              Predios Eliminados
              <Badge variant="destructive" className="ml-2">{prediosEliminados.length} total</Badge>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Los siguientes predios han sido eliminados del sistema. Sus números de terreno no pueden ser reutilizados.
            </p>
            
            {/* Filtros y búsqueda */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Buscar por código, propietario, municipio o motivo..."
                  value={eliminadosSearch}
                  onChange={(e) => setEliminadosSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <select
                className="border rounded-md px-3 py-2 text-sm min-w-[180px]"
                value={eliminadosMunicipio}
                onChange={(e) => {
                  setEliminadosMunicipio(e.target.value);
                  fetchPrediosEliminados(e.target.value);
                }}
              >
                <option value="">Todos los municipios</option>
                <option value="Ábrego">Ábrego</option>
                <option value="Bucarasica">Bucarasica</option>
                <option value="Cáchira">Cáchira</option>
                <option value="Convención">Convención</option>
                <option value="El Carmen">El Carmen</option>
                <option value="El Tarra">El Tarra</option>
                <option value="Hacarí">Hacarí</option>
                <option value="La Esperanza">La Esperanza</option>
                <option value="La Playa">La Playa</option>
                <option value="Río de Oro">Río de Oro</option>
                <option value="San Calixto">San Calixto</option>
                <option value="Sardinata">Sardinata</option>
                <option value="Teorama">Teorama</option>
              </select>
            </div>
            
            {/* Contador de resultados filtrados */}
            {eliminadosSearch && (
              <p className="text-sm text-slate-500">
                Mostrando {prediosEliminadosFiltrados.length} de {prediosEliminados.length} predios
              </p>
            )}
            
            {eliminadosLoading ? (
              <div className="py-8 text-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                Cargando predios eliminados...
              </div>
            ) : prediosEliminadosFiltrados.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                {eliminadosSearch ? 'No se encontraron predios con esos criterios' : 'No hay predios eliminados'}
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-slate-200 bg-red-50">
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Código</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Propietario</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Municipio</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Vigencia</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Resolución</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Motivo</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Fecha</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Eliminado Por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prediosEliminadosFiltrados.map((predio, idx) => {
                      // Buscar quién generó la resolución de eliminación
                      const resolucionEliminacion = predio.resolucion_eliminacion || predio.resolucion;
                      const historialRes = predio.historial_resoluciones || [];
                      const registroEliminacion = historialRes.find(h => h.numero_resolucion === resolucionEliminacion);
                      const eliminadoPor = registroEliminacion?.generado_por || predio.eliminado_por || predio.deleted_by_name || 'N/A';
                      
                      return (
                      <tr key={predio.id || idx} className="border-b border-slate-100 hover:bg-red-50/50">
                        <td className="py-3 px-4">
                          <p className="font-mono text-xs font-medium text-slate-900">{predio.codigo_predial_nacional}</p>
                          <p className="text-xs text-slate-500">Homologado: {predio.codigo_homologado || 'N/A'}</p>
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {predio.propietarios?.[0]?.nombre_propietario || predio.nombre_propietario || 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-slate-700">{predio.municipio}</td>
                        <td className="py-3 px-4 text-slate-700 font-medium">{predio.vigencia_origen || predio.vigencia_eliminacion || predio.vigencia || 'N/A'}</td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-red-700">{resolucionEliminacion || 'N/A'}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-[200px] truncate" title={predio.motivo_eliminacion || predio.motivo}>
                          {predio.motivo_eliminacion || predio.motivo || 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {predio.eliminado_en ? new Date(predio.eliminado_en).toLocaleDateString('es-CO') : 
                           predio.deleted_at ? new Date(predio.deleted_at).toLocaleDateString('es-CO') : 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-slate-500">{eliminadoPor}</td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            )}
            
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg text-sm">
              <p className="font-semibold text-amber-800">Importante:</p>
              <p className="text-amber-700">
                Los números de terreno de predios eliminados no pueden ser reutilizados para mantener la integridad del sistema catastral.
              </p>
            </div>
          </div>
          
          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={() => setShowDeletedDialog(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Subsanaciones Pendientes Dialog */}
      <Dialog open={showSubsanacionesDialog} onOpenChange={(open) => { 
        setShowSubsanacionesDialog(open);
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-outfit flex items-center gap-2 text-orange-700">
              <RefreshCw className="w-5 h-5" />
              Subsanaciones de Reapariciones {filterMunicipio ? `- ${filterMunicipio}` : ''}
            </DialogTitle>
          </DialogHeader>
          <SubsanacionesPendientes 
            municipio={filterMunicipio || null} 
            onUpdate={() => { fetchReaparicionesConteo(); fetchSubsanacionesConteo(); fetchPredios(); }}
          />
        </DialogContent>
      </Dialog>

      {/* Pending Changes Dialog with History Tabs */}
      <Dialog open={showPendientesDialog} onOpenChange={(open) => {
        setShowPendientesDialog(open);
        if (open && historialTab === 'historial') {
          fetchCambiosHistorial();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-outfit flex items-center gap-2">
              <FileEdit className="w-5 h-5 text-amber-600" />
              Gestión de Cambios
            </DialogTitle>
            <DialogDescription>
              Revise y procese las solicitudes de cambios de predios
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Tabs for Pending and History */}
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => setHistorialTab('pendientes')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  historialTab === 'pendientes' 
                    ? 'border-amber-500 text-amber-700' 
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Pendientes ({cambiosStats?.total_pendientes || 0})
              </button>
              <button
                onClick={() => {
                  setHistorialTab('historial');
                  fetchCambiosHistorial();
                }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  historialTab === 'historial' 
                    ? 'border-emerald-500 text-emerald-700' 
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Historial {cambiosStats?.total_historial > 0 && (
                  <span className="ml-1 px-2 py-0.5 text-xs bg-slate-200 text-slate-600 rounded-full">
                    {cambiosStats.total_historial}
                  </span>
                )}
              </button>
            </div>

            {/* Stats only shown in pendientes tab */}
            {historialTab === 'pendientes' && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-emerald-700">{cambiosStats?.pendientes_creacion || 0}</p>
                  <p className="text-xs text-slate-500">Creaciones</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-700">{cambiosStats?.pendientes_modificacion || 0}</p>
                  <p className="text-xs text-slate-500">Modificaciones</p>
                </div>
                <div className="bg-red-50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-red-700">{cambiosStats?.pendientes_eliminacion || 0}</p>
                  <p className="text-xs text-slate-500">Eliminaciones</p>
                </div>
              </div>
            )}

            {/* Pendientes Tab Content */}
            {historialTab === 'pendientes' && (
              <>
                {cambiosPendientes.length === 0 ? (
                  <div className="py-8 text-center text-slate-500">
                    No hay cambios pendientes de aprobación
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cambiosPendientes.map((cambio) => (
                      <Card key={cambio.id} className="border-l-4 border-l-amber-400">
                        <CardContent className="pt-4">
                          <div className="space-y-4">
                            {/* Header */}
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant={
                                    cambio.tipo_cambio === 'creacion' ? 'default' :
                                    cambio.tipo_cambio === 'modificacion' ? 'secondary' : 'destructive'
                                  }>
                                    {cambio.tipo_cambio === 'creacion' ? 'Nuevo Predio' :
                                     cambio.tipo_cambio === 'modificacion' ? 'Modificación' : 'Eliminación'}
                                  </Badge>
                                  <span className="text-xs text-slate-500">
                                    {new Date(cambio.fecha_propuesta).toLocaleString('es-CO')}
                                  </span>
                                </div>
                                
                                {cambio.predio_actual && (
                                  <p className="text-sm"><strong>Predio actual:</strong> {cambio.predio_actual.codigo_homologado} - {cambio.predio_actual.nombre_propietario}</p>
                                )}
                                <p className="text-sm"><strong>Propuesto por:</strong> {cambio.propuesto_por_nombre} ({cambio.propuesto_por_rol})</p>
                                {cambio.justificacion && (
                                  <p className="text-sm text-slate-600"><strong>Justificación:</strong> {cambio.justificacion}</p>
                                )}
                              </div>
                              
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  className="bg-emerald-600 hover:bg-emerald-700"
                                  onClick={() => handleAprobarRechazar(cambio.id, true, 'Aprobado')}
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Aprobar
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  onClick={() => {
                                    const comentario = window.prompt('Motivo del rechazo:');
                                    if (comentario !== null) {
                                      handleAprobarRechazar(cambio.id, false, comentario);
                                    }
                                  }}
                                >
                                  <XCircle className="w-4 h-4 mr-1" />
                                  Rechazar
                                </Button>
                              </div>
                            </div>

                            {/* Datos propuestos expandibles - Solo muestra campos que realmente cambiaron */}
                            <details className="bg-slate-50 rounded-lg p-3">
                              <summary className="cursor-pointer font-medium text-sm text-slate-700 flex items-center gap-2">
                                <Eye className="w-4 h-4" />
                                Ver cambios propuestos
                              </summary>
                              <div className="mt-3 space-y-2 text-sm">
                                {(() => {
                                  const propuestos = cambio.datos_propuestos || {};
                                  const original = cambio.predio_actual || {};
                                  const cambiosReales = [];

                                  // Comparar nombre_propietario
                                  if (propuestos.nombre_propietario !== undefined && propuestos.nombre_propietario !== original.nombre_propietario) {
                                    cambiosReales.push({
                                      label: 'Propietario',
                                      antes: original.nombre_propietario || 'N/A',
                                      despues: propuestos.nombre_propietario
                                    });
                                  }
                                  // Comparar direccion
                                  if (propuestos.direccion !== undefined && propuestos.direccion !== original.direccion) {
                                    cambiosReales.push({
                                      label: 'Dirección',
                                      antes: original.direccion || 'N/A',
                                      despues: propuestos.direccion
                                    });
                                  }
                                  // Comparar destino_economico
                                  if (propuestos.destino_economico !== undefined && propuestos.destino_economico !== original.destino_economico) {
                                    cambiosReales.push({
                                      label: 'Destino Económico',
                                      antes: original.destino_economico || 'N/A',
                                      despues: propuestos.destino_economico
                                    });
                                  }
                                  // Comparar area_terreno
                                  if (propuestos.area_terreno !== undefined && propuestos.area_terreno !== original.area_terreno) {
                                    cambiosReales.push({
                                      label: 'Área Terreno',
                                      antes: original.area_terreno ? `${original.area_terreno.toLocaleString()} m²` : 'N/A',
                                      despues: `${propuestos.area_terreno?.toLocaleString()} m²`
                                    });
                                  }
                                  // Comparar area_construida
                                  if (propuestos.area_construida !== undefined && propuestos.area_construida !== original.area_construida) {
                                    cambiosReales.push({
                                      label: 'Área Construida',
                                      antes: original.area_construida ? `${original.area_construida.toLocaleString()} m²` : 'N/A',
                                      despues: `${propuestos.area_construida?.toLocaleString()} m²`
                                    });
                                  }
                                  // Comparar avaluo
                                  if (propuestos.avaluo !== undefined && propuestos.avaluo !== original.avaluo) {
                                    cambiosReales.push({
                                      label: 'Avalúo',
                                      antes: original.avaluo ? formatCurrency(original.avaluo) : 'N/A',
                                      despues: formatCurrency(propuestos.avaluo),
                                      highlight: true
                                    });
                                  }
                                  // Comparar tipo_documento
                                  if (propuestos.tipo_documento !== undefined && propuestos.tipo_documento !== original.tipo_documento) {
                                    cambiosReales.push({
                                      label: 'Tipo Documento',
                                      antes: original.tipo_documento || 'N/A',
                                      despues: propuestos.tipo_documento
                                    });
                                  }
                                  // Comparar numero_documento
                                  if (propuestos.numero_documento !== undefined && propuestos.numero_documento !== original.numero_documento) {
                                    cambiosReales.push({
                                      label: 'Nro. Documento',
                                      antes: original.numero_documento || 'N/A',
                                      despues: propuestos.numero_documento
                                    });
                                  }

                                  if (cambiosReales.length === 0) {
                                    return <p className="text-slate-500 italic">No se detectaron cambios en los campos comparables</p>;
                                  }

                                  return cambiosReales.map((c, idx) => (
                                    <div key={idx} className="bg-white rounded p-2 border border-slate-200">
                                      <span className="font-medium text-slate-700">{c.label}:</span>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-red-600 line-through text-xs">{c.antes}</span>
                                        <span className="text-slate-400">→</span>
                                        <strong className={c.highlight ? 'text-emerald-700' : 'text-blue-700'}>{c.despues}</strong>
                                      </div>
                                    </div>
                                  ));
                                })()}
                              </div>
                            </details>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Historial Tab Content */}
            {historialTab === 'historial' && (
              <>
                {cambiosHistorial.length === 0 ? (
                  <div className="py-8 text-center text-slate-500">
                    No hay historial de cambios procesados
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cambiosHistorial.map((cambio) => (
                      <Card key={cambio.id} className={`border-l-4 ${
                        cambio.estado === 'aprobado' ? 'border-l-emerald-500 bg-emerald-50/50' : 'border-l-red-500 bg-red-50/50'
                      }`}>
                        <CardContent className="py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant={cambio.estado === 'aprobado' ? 'default' : 'destructive'} className={
                                  cambio.estado === 'aprobado' ? 'bg-emerald-600' : ''
                                }>
                                  {cambio.estado === 'aprobado' ? '✓ Aprobado' : '✗ Rechazado'}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {cambio.tipo_cambio === 'creacion' ? 'Creación' :
                                   cambio.tipo_cambio === 'modificacion' ? 'Modificación' : 'Eliminación'}
                                </Badge>
                              </div>
                              {cambio.predio_actual && (
                                <p className="text-sm text-slate-700">
                                  <strong>{cambio.predio_actual.codigo_homologado || cambio.predio_actual.codigo_predial_nacional}</strong>
                                  {cambio.predio_actual.nombre_propietario && ` - ${cambio.predio_actual.nombre_propietario}`}
                                </p>
                              )}
                              <p className="text-xs text-slate-500 mt-1">
                                Solicitado por: {cambio.propuesto_por_nombre}
                              </p>
                              {cambio.comentario_aprobacion && (
                                <p className="text-xs text-slate-600 mt-1 italic">
                                  &ldquo;{cambio.comentario_aprobacion}&rdquo;
                                </p>
                              )}
                            </div>
                            <div className="text-right text-xs text-slate-500">
                              <p>{cambio.fecha_decision ? new Date(cambio.fecha_decision).toLocaleDateString('es-CO') : 'N/A'}</p>
                              <p className="text-slate-400">{cambio.decidido_por_nombre || 'Sistema'}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          
          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={() => setShowPendientesDialog(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-outfit flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-700" />
              Detalle del Predio - {selectedPredio?.codigo_predial_nacional}
            </DialogTitle>
          </DialogHeader>
          
          {selectedPredio && (
            <div className="space-y-6">
              {/* Indicador de Bloqueo */}
              {selectedPredio.bloqueado && (
                <div className="bg-red-50 border border-red-300 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="w-5 h-5 text-red-600" />
                    <h3 className="font-semibold text-red-800">Predio Bloqueado por Proceso Legal</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-red-600">Motivo:</span>
                      <p className="text-red-800 font-medium">{selectedPredio.bloqueo_info?.motivo || 'Sin información'}</p>
                    </div>
                    <div>
                      <span className="text-red-600">Bloqueado por:</span>
                      <p className="text-red-800 font-medium">{selectedPredio.bloqueo_info?.bloqueado_por_nombre || 'Sin información'}</p>
                    </div>
                    {selectedPredio.bloqueo_info?.numero_proceso && (
                      <div>
                        <span className="text-red-600">Número de Proceso:</span>
                        <p className="text-red-800 font-medium">{selectedPredio.bloqueo_info.numero_proceso}</p>
                      </div>
                    )}
                    {selectedPredio.bloqueo_info?.entidad_judicial && (
                      <div>
                        <span className="text-red-600">Entidad Judicial:</span>
                        <p className="text-red-800 font-medium">{selectedPredio.bloqueo_info.entidad_judicial}</p>
                      </div>
                    )}
                    {selectedPredio.bloqueo_info?.fecha_bloqueo && (
                      <div className="col-span-2">
                        <span className="text-red-600">Fecha de Bloqueo:</span>
                        <p className="text-red-800 font-medium">
                          {new Date(selectedPredio.bloqueo_info.fecha_bloqueo).toLocaleDateString('es-CO', {
                            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Nota informativa sobre edición - Link clickeable */}
              <div 
                className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2 cursor-pointer hover:bg-blue-100 transition-colors"
                onClick={() => {
                  // Guardar el predio seleccionado en sessionStorage para pre-cargar en Mutaciones
                  sessionStorage.setItem('predioParaMutacion', JSON.stringify(selectedPredio));
                  setShowDetailDialog(false);
                  navigate('/dashboard/mutaciones-resoluciones');
                }}
              >
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <p className="text-sm text-blue-700">
                  Para modificar este predio, haga clic aquí para ir a <strong className="underline">Mutaciones y Resoluciones</strong>. Todo cambio genera una resolución.
                </p>
                <ArrowRight className="w-5 h-5 text-blue-600 flex-shrink-0" />
              </div>
              
              {/* Botón Generar Certificado Catastral */}
              {['coordinador', 'administrador', 'atencion_usuario'].includes(user?.role) && (
                <div className="flex justify-end">
                  <Button
                    variant="default"
                    className="bg-emerald-700 hover:bg-emerald-800"
                    onClick={async () => {
                      try {
                        toast.info('Generando certificado catastral...');
                        const token = localStorage.getItem('token');
                        const response = await fetch(`${API}/predios/${selectedPredio.id}/certificado`, {
                          headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (!response.ok) throw new Error('Error generando certificado');
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `Certificado_Catastral_${selectedPredio.codigo_predial_nacional}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                        toast.success('Certificado descargado correctamente');
                      } catch (error) {
                        console.error('Error:', error);
                        toast.error('Error al generar el certificado');
                      }
                    }}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Generar Certificado Catastral
                  </Button>
                </div>
              )}
              
              {/* Códigos - Orden: CPN, Matrícula, Homologado */}
              <div className="bg-emerald-50 p-4 rounded-lg">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <p className="text-xs text-slate-500">Código Predial Nacional (30 dígitos)</p>
                    <p className="font-mono text-lg font-bold text-emerald-800">{selectedPredio.codigo_predial_nacional}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500">Matrícula Inmobiliaria</p>
                      <p className="font-medium text-slate-700">
                        {selectedPredio.matricula_inmobiliaria || selectedPredio.r2_registros?.[0]?.matricula_inmobiliaria || (
                          <span className="text-slate-400 italic">Sin información de matrícula</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Código Homologado</p>
                      <p className="font-medium text-slate-700">{selectedPredio.codigo_homologado || selectedPredio.codigo_anterior || 'Sin código homologado'}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Ubicación */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4" /> Ubicación - Código Nacional Predial
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-4 text-sm">
                  <div className="col-span-3 bg-emerald-50 p-2 rounded">
                    <span className="text-slate-500">CPN:</span> <strong className="text-emerald-800">{selectedPredio.codigo_predial_nacional}</strong>
                  </div>
                  <div><span className="text-slate-500">Departamento:</span> <strong>{selectedPredio.departamento || getCodigoPartes(selectedPredio.codigo_predial_nacional).departamento}</strong></div>
                  <div><span className="text-slate-500">Municipio:</span> <strong>{selectedPredio.municipio}</strong></div>
                  <div><span className="text-slate-500">Zona:</span> <strong>{getZonaFromCodigo(selectedPredio.codigo_predial_nacional).texto}</strong></div>
                  <div><span className="text-slate-500">Sector:</span> <strong>{selectedPredio.sector || getCodigoPartes(selectedPredio.codigo_predial_nacional).sector}</strong></div>
                  <div><span className="text-slate-500">Manzana/Vereda:</span> <strong>{selectedPredio.manzana_vereda || getCodigoPartes(selectedPredio.codigo_predial_nacional).manzana_vereda}</strong></div>
                  <div><span className="text-slate-500">Terreno:</span> <strong>{selectedPredio.terreno || getCodigoPartes(selectedPredio.codigo_predial_nacional).terreno}</strong></div>
                </CardContent>
              </Card>
              
              {/* Propietarios (R1) */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4" /> 
                    Propietarios (R1)
                    {selectedPredio.propietarios?.length > 1 && (
                      <Badge variant="secondary">{selectedPredio.propietarios.length} propietarios</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedPredio.propietarios && selectedPredio.propietarios.length > 0 ? (
                    <div className="space-y-3">
                      {selectedPredio.propietarios.map((prop, idx) => (
                        <div key={idx} className={`grid grid-cols-2 gap-4 text-sm ${idx > 0 ? 'border-t pt-3' : ''}`}>
                          <div className="col-span-2 flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{idx + 1}/{selectedPredio.propietarios.length}</Badge>
                            <strong>{prop.nombre_propietario}</strong>
                          </div>
                          <div><span className="text-slate-500">Documento:</span> <strong>{catalogos?.tipo_documento?.[prop.tipo_documento]} {String(prop.numero_documento || '').padStart(10, '0')}</strong></div>
                          <div><span className="text-slate-500">Estado Civil:</span> <strong>{catalogos?.estado_civil?.[prop.estado_civil] || 'N/A'}</strong></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="col-span-2"><span className="text-slate-500">Nombre:</span> <strong>{selectedPredio.nombre_propietario}</strong></div>
                      <div><span className="text-slate-500">Documento:</span> <strong>{catalogos?.tipo_documento?.[selectedPredio.tipo_documento]} {String(selectedPredio.numero_documento || '').padStart(10, '0')}</strong></div>
                      <div><span className="text-slate-500">Estado Civil:</span> <strong>{catalogos?.estado_civil?.[selectedPredio.estado_civil] || 'N/A'}</strong></div>
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t">
                    <span className="text-slate-500 text-sm">Dirección:</span> <strong className="text-sm">{selectedPredio.direccion}</strong>
                  </div>
                </CardContent>
              </Card>
              
              {/* Características */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building className="w-4 h-4" /> Características Generales
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-4 text-sm">
                  <div><span className="text-slate-500">Destino:</span> <strong>{selectedPredio.destino_economico} - {catalogos?.destino_economico?.[selectedPredio.destino_economico]}</strong></div>
                  <div>
                    <span className="text-slate-500">Área Terreno (R1):</span> <strong>{formatAreaHectareas(selectedPredio.area_terreno)}</strong>
                  </div>
                  <div><span className="text-slate-500">Área Construida:</span> <strong>{formatAreaHectareas(selectedPredio.area_construida)}</strong></div>
                  
                  {/* Área GDB en fila separada con comparación */}
                  {selectedPredio.area_gdb > 0 && (
                    <div className="col-span-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                          <div>
                            <span className="text-blue-600 text-xs font-medium">Área GDB (Base Gráfica)</span>
                            <p className="font-bold text-blue-800">{formatAreaHectareas(selectedPredio.area_gdb)}</p>
                          </div>
                          <div className="text-slate-400">vs</div>
                          <div>
                            <span className="text-slate-500 text-xs font-medium">Área R1 (Catastral)</span>
                            <p className="font-bold text-slate-700">{formatAreaHectareas(selectedPredio.area_terreno)}</p>
                          </div>
                        </div>
                        {selectedPredio.area_terreno > 0 && (
                          <div className="text-right">
                            <span className="text-xs text-slate-500">Diferencia</span>
                            {(() => {
                              const diff = selectedPredio.area_gdb - selectedPredio.area_terreno;
                              const pct = (diff / selectedPredio.area_terreno) * 100;
                              const isPositive = diff > 0;
                              const color = Math.abs(pct) < 5 ? 'text-green-600' : Math.abs(pct) < 15 ? 'text-amber-600' : 'text-red-600';
                              return (
                                <p className={`font-bold ${color}`}>
                                  {isPositive ? '+' : ''}{pct.toFixed(1)}%
                                  <span className="text-xs font-normal ml-1">({isPositive ? '+' : ''}{diff.toFixed(0)} m²)</span>
                                </p>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="col-span-2"><span className="text-slate-500">Avalúo:</span> <strong className="text-emerald-700">{formatCurrency(selectedPredio.avaluo)}</strong></div>
                  {selectedPredio.tiene_geometria && !selectedPredio.area_gdb && (
                    <div><span className="text-slate-500">GDB:</span> <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700">✓ Con Base Gráfica</Badge></div>
                  )}
                </CardContent>
              </Card>

              {/* Datos R2 - Información Física */}
              {selectedPredio.r2_registros && selectedPredio.r2_registros.length > 0 && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4" /> 
                      Información Física (R2)
                      {selectedPredio.r2_registros.length > 1 && (
                        <Badge variant="secondary">{selectedPredio.r2_registros.length} registros</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {selectedPredio.r2_registros.map((r2, r2Idx) => (
                      <div key={r2Idx} className={r2Idx > 0 ? 'border-t pt-4' : ''}>
                        <div className="flex items-center gap-2 mb-4">
                          <Badge variant="outline" className="bg-emerald-50">Registro {r2Idx + 1}</Badge>
                          {r2.matricula_inmobiliaria && (
                            <span className="text-sm text-slate-600">
                              Matrícula: <strong>{r2.matricula_inmobiliaria}</strong>
                            </span>
                          )}
                        </div>
                        
                        {r2.zonas && r2.zonas.length > 0 && (
                          <div className="space-y-4">
                            {/* Tabla 1: Zonas Físicas, Económicas y Área Terreno */}
                            <div>
                              <p className="text-sm font-semibold text-slate-700 mb-2">Información de Zonas y Terreno ({r2.zonas.length} {r2.zonas.length === 1 ? 'registro' : 'registros'})</p>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm border rounded-lg">
                                  <thead>
                                    <tr className="bg-emerald-50 border-b">
                                      <th className="py-2 px-3 text-left">Registro</th>
                                      <th className="py-2 px-3 text-center">Zona Física</th>
                                      <th className="py-2 px-3 text-center">Zona Económica</th>
                                      <th className="py-2 px-3 text-right">Área Terreno</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {r2.zonas.map((zona, zIdx) => (
                                      <tr key={zIdx} className="border-b last:border-b-0 hover:bg-slate-50">
                                        <td className="py-2 px-3 font-medium">{zIdx + 1}</td>
                                        <td className="py-2 px-3 text-center">{zona.zona_fisica || '0'}</td>
                                        <td className="py-2 px-3 text-center">{zona.zona_economica || '0'}</td>
                                        <td className="py-2 px-3 text-right font-medium">
                                          {formatAreaHectareas(zona.area_terreno)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            
                            {/* Tabla 2: Construcción */}
                            <div>
                              <p className="text-sm font-semibold text-slate-700 mb-2">Información de Construcción ({r2.zonas.length} {r2.zonas.length === 1 ? 'registro' : 'registros'})</p>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm border rounded-lg">
                                  <thead>
                                    <tr className="bg-blue-50 border-b">
                                      <th className="py-2 px-3 text-left">Registro</th>
                                      <th className="py-2 px-3 text-center">Habitaciones</th>
                                      <th className="py-2 px-3 text-center">Baños</th>
                                      <th className="py-2 px-3 text-center">Locales</th>
                                      <th className="py-2 px-3 text-center">Pisos</th>
                                      <th className="py-2 px-3 text-center">Uso</th>
                                      <th className="py-2 px-3 text-center">Puntaje</th>
                                      <th className="py-2 px-3 text-right">Área Construida</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {r2.zonas.map((zona, zIdx) => (
                                      <tr key={zIdx} className="border-b last:border-b-0 hover:bg-slate-50">
                                        <td className="py-2 px-3 font-medium">{zIdx + 1}</td>
                                        <td className="py-2 px-3 text-center">{zona.habitaciones || '0'}</td>
                                        <td className="py-2 px-3 text-center">{zona.banos || '0'}</td>
                                        <td className="py-2 px-3 text-center">{zona.locales || '0'}</td>
                                        <td className="py-2 px-3 text-center">{zona.pisos || '1'}</td>
                                        <td className="py-2 px-3 text-center">{zona.uso || '-'}</td>
                                        <td className="py-2 px-3 text-center">{zona.puntaje || '0'}</td>
                                        <td className="py-2 px-3 text-right font-medium">
                                          {formatAreaHectareas(zona.area_construida)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
              
              {/* Historial de Resoluciones con detalles de cambios */}
              {selectedPredio.historial_resoluciones && selectedPredio.historial_resoluciones.length > 0 && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Resoluciones Generadas ({selectedPredio.historial_resoluciones.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {selectedPredio.historial_resoluciones.slice().reverse().map((r, idx) => (
                        <div key={idx} className="border border-emerald-200 rounded-lg overflow-hidden">
                          {/* Encabezado de la resolución */}
                          <div className="flex items-center justify-between bg-emerald-50 p-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                                <FileText className="w-5 h-5 text-emerald-600" />
                              </div>
                              <div>
                                <div className="font-semibold text-emerald-800">
                                  {r.tipo_mutacion && `${r.tipo_mutacion === 'RECTIFICACION_AREA' ? 'Rectificación de Área' : r.tipo_mutacion === 'COMPLEMENTACION' ? 'Complementación' : r.tipo_mutacion} - `}{r.numero_resolucion}
                                </div>
                                <div className="text-xs text-emerald-600 flex items-center gap-2 flex-wrap">
                                  {r.fecha_resolucion && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {r.fecha_resolucion}
                                    </span>
                                  )}
                                  {r.radicado && (
                                    <span className="flex items-center gap-1">
                                      <Hash className="w-3 h-3" />
                                      {r.radicado}
                                    </span>
                                  )}
                                  {r.generado_por && (
                                    <span className="flex items-center gap-1">
                                      <User className="w-3 h-3" />
                                      {r.generado_por}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {r.pdf_path && (
                              <Button
                                variant="default"
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => {
                                  // Normalizar pdf_path para asegurar que use el endpoint correcto
                                  let pdfUrl = r.pdf_path;
                                  if (pdfUrl.startsWith('/resoluciones/') && !pdfUrl.startsWith('/api/')) {
                                    pdfUrl = pdfUrl.replace('/resoluciones/', '/api/resoluciones/descargar/');
                                  }
                                  window.open(`${BACKEND_URL}${pdfUrl}`, '_blank');
                                }}
                              >
                                <Download className="w-4 h-4 mr-1" />
                                PDF
                              </Button>
                            )}
                          </div>
                          
                          {/* Detalles del cambio */}
                          <div className="p-3 bg-white border-t border-emerald-100 space-y-2">
                            {/* Propietarios anteriores y nuevos */}
                            {(r.propietarios_anteriores?.length > 0 || r.propietarios_nuevos?.length > 0) && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {/* Propietarios cancelados */}
                                {r.propietarios_anteriores?.length > 0 && (
                                  <div className="bg-red-50 border border-red-200 rounded p-2">
                                    <p className="text-xs font-semibold text-red-700 mb-1">
                                      Propietarios Cancelados ({r.propietarios_anteriores.length}):
                                    </p>
                                    {r.propietarios_anteriores.map((p, pIdx) => (
                                      <div key={pIdx} className="text-xs text-red-600">
                                        • {p.nombre || p.nombre_propietario} 
                                        {(p.tipo_documento || p.documento || p.numero_documento) && 
                                          ` (${p.tipo_documento || 'CC'}: ${String(p.documento || p.numero_documento || '').padStart(10, '0')})`}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {/* Propietarios inscritos */}
                                {r.propietarios_nuevos?.length > 0 && (
                                  <div className="bg-emerald-50 border border-emerald-200 rounded p-2">
                                    <p className="text-xs font-semibold text-emerald-700 mb-1">
                                      Propietarios Inscritos ({r.propietarios_nuevos.length}):
                                    </p>
                                    {r.propietarios_nuevos.map((p, pIdx) => (
                                      <div key={pIdx} className="text-xs text-emerald-600">
                                        • {p.nombre || p.nombre_propietario} 
                                        {(p.tipo_documento || p.documento || p.numero_documento) && 
                                          ` (${p.tipo_documento || 'CC'}: ${String(p.documento || p.numero_documento || '').padStart(10, '0')})`}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Otros campos modificados (matrícula, dirección, avalúo, etc.) */}
                            {r.campos_modificados?.filter(cm => 
                              ['matricula_inmobiliaria', 'direccion', 'avaluo', 'area_terreno', 'area_construida', 'destino_economico', 'codigo_homologado'].includes(cm.campo)
                            ).length > 0 && (
                              <div className="bg-blue-50 border border-blue-200 rounded p-2">
                                <p className="text-xs font-semibold text-blue-700 mb-1">
                                  Otros datos modificados:
                                </p>
                                <div className="space-y-1">
                                  {r.campos_modificados.filter(cm => 
                                    ['matricula_inmobiliaria', 'direccion', 'avaluo', 'area_terreno', 'area_construida', 'destino_economico', 'codigo_homologado'].includes(cm.campo)
                                  ).map((cm, cmIdx) => {
                                    const nombresCampos = {
                                      'matricula_inmobiliaria': 'Matrícula',
                                      'direccion': 'Dirección',
                                      'avaluo': 'Avalúo',
                                      'area_terreno': 'Área Terreno',
                                      'area_construida': 'Área Construida',
                                      'destino_economico': 'Destino Económico',
                                      'codigo_homologado': 'Código Homologado'
                                    };
                                    return (
                                      <div key={cmIdx} className="text-xs flex flex-wrap items-center gap-1">
                                        <span className="font-medium text-blue-700">{nombresCampos[cm.campo] || cm.campo}:</span>
                                        <span className="text-red-600 line-through">
                                          {String(cm.valor_anterior || 'N/A').slice(0, 50)}
                                        </span>
                                        <span className="text-slate-400">→</span>
                                        <span className="text-emerald-700 font-medium">
                                          {String(cm.valor_nuevo || 'N/A').slice(0, 50)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            
                            {/* Si no hay propietarios mostrados, indicar */}
                            {!r.propietarios_anteriores?.length && !r.propietarios_nuevos?.length && !r.campos_modificados?.length && (
                              <p className="text-xs text-slate-500 italic">
                                Sin detalles de cambios registrados
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Mapa del Predio (Opción C) */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Map className="w-4 h-4" /> Ubicación Geográfica
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PredioMap 
                    codigoPredial={selectedPredio.codigo_predial_nacional}
                    predioData={selectedPredio}
                    height={250}
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Barra de progreso de descarga offline */}
      <DownloadProgressBar
        isDownloading={downloadProgress.isDownloading}
        progress={downloadProgress.total > 0 ? (downloadProgress.current / downloadProgress.total) * 100 : 0}
        total={downloadProgress.total}
        current={downloadProgress.current}
        label={downloadProgress.label}
        onCancel={() => setDownloadProgress({ isDownloading: false, current: 0, total: 0, label: '' })}
      />
      
      {/* Dialog de Códigos Homologados */}
      <Dialog open={showCodigosDialog} onOpenChange={(open) => {
        setShowCodigosDialog(open);
        if (!open) {
          cancelarCargaCodigos();
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Gestión de Códigos Homologados
            </DialogTitle>
            <DialogDescription>
              Cargue y administre los códigos homologados por municipio
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Cargar archivo */}
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-4">
              {!codigosFileSelected ? (
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-slate-900">Cargar Códigos desde Excel</h4>
                    <p className="text-sm text-slate-500">
                      Puede ser un archivo con solo códigos (seleccione el municipio) o con columnas <code className="bg-slate-100 px-1 rounded">Municipio</code> y <code className="bg-slate-100 px-1 rounded">Codigo_Homologado</code>
                    </p>
                  </div>
                  <div>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleUploadCodigos}
                      className="hidden"
                      id="upload-codigos"
                      disabled={uploadingCodigos}
                    />
                    <label htmlFor="upload-codigos">
                      <Button asChild disabled={uploadingCodigos} className="bg-blue-600 hover:bg-blue-700">
                        <span>
                          <Upload className="w-4 h-4 mr-2" />
                          Seleccionar Excel
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-blue-800">{codigosFileSelected.name}</span>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Municipio para estos códigos *</Label>
                    <p className="text-xs text-slate-500 mb-2">
                      Seleccione el municipio al que pertenecen estos códigos
                    </p>
                    <select 
                      value={codigosMunicipioSeleccionado} 
                      onChange={(e) => setCodigosMunicipioSeleccionado(e.target.value)}
                      className="w-full h-10 px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <option value="">-- Seleccione un municipio --</option>
                      {catalogos?.municipios?.slice().sort((a, b) => a.localeCompare(b, 'es')).map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Nota informativa */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <strong>Nota:</strong> Al cargar, cada código se compara con los predios existentes. 
                      Los códigos que ya están asignados a un predio se marcan como <span className="font-semibold text-amber-700">"usados"</span>, 
                      los demás quedan <span className="font-semibold text-emerald-700">"disponibles"</span>.
                    </p>
                  </div>
                  
                  <div className="flex gap-2 justify-end">
                    <Button 
                      variant="outline" 
                      onClick={cancelarCargaCodigos}
                      disabled={uploadingCodigos}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      onClick={confirmarCargaCodigos}
                      disabled={uploadingCodigos || !codigosMunicipioSeleccionado}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {uploadingCodigos ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Cargando...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Cargar Códigos
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Estadísticas por municipio */}
            <div>
              <h4 className="font-medium text-slate-900 mb-3">Códigos por Municipio</h4>
              {loadingCodigos ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : codigosStats.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <FileText className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  <p>No hay códigos homologados cargados</p>
                  <p className="text-sm">Cargue un archivo Excel para comenzar</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border rounded-lg">
                    <thead>
                      <tr className="bg-slate-100 border-b">
                        <th className="py-2 px-4 text-left">Municipio</th>
                        <th className="py-2 px-4 text-center">Total</th>
                        <th className="py-2 px-4 text-center">Usados</th>
                        <th className="py-2 px-4 text-center">Disponibles</th>
                        <th className="py-2 px-4 text-center">Estado</th>
                        <th className="py-2 px-4 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {codigosStats.map((stat) => (
                        <tr key={stat.municipio} className="border-b last:border-b-0 hover:bg-slate-50">
                          <td className="py-2 px-4 font-medium">{stat.municipio}</td>
                          <td className="py-2 px-4 text-center">{stat.total.toLocaleString()}</td>
                          <td className="py-2 px-4 text-center text-amber-600">{stat.usados.toLocaleString()}</td>
                          <td className="py-2 px-4 text-center font-bold text-emerald-600">{stat.disponibles.toLocaleString()}</td>
                          <td className="py-2 px-4 text-center">
                            {stat.disponibles === 0 ? (
                              <Badge className="bg-red-100 text-red-700">Agotados</Badge>
                            ) : stat.disponibles < 10 ? (
                              <Badge className="bg-amber-100 text-amber-700">Pocos</Badge>
                            ) : (
                              <Badge className="bg-emerald-100 text-emerald-700">OK</Badge>
                            )}
                          </td>
                          <td className="py-2 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {stat.usados > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                  onClick={() => {
                                    setCodigosUsadosMunicipio(stat.municipio);
                                    fetchCodigosUsados(stat.municipio);
                                  }}
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  Ver
                                </Button>
                              )}
                              {(user?.role === 'administrador' || user?.role === 'coordinador') && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                    onClick={() => diagnosticarCodigosMunicipio(stat.municipio)}
                                    disabled={loadingDiagnostico}
                                    title="Diagnosticar inconsistencias"
                                  >
                                    {loadingDiagnostico ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Search className="w-4 h-4" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-amber-600 hover:text-amber-800 hover:bg-amber-50"
                                    onClick={() => recalcularCodigosMunicipio(stat.municipio)}
                                    disabled={recalculandoCodigos}
                                    title="Recalcular códigos usados vs disponibles"
                                  >
                                    {recalculandoCodigos ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <RefreshCw className="w-4 h-4" />
                                    )}
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            {/* Códigos usados por municipio seleccionado */}
            {codigosUsadosMunicipio && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-slate-900 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-amber-600" />
                    Códigos Usados - {codigosUsadosMunicipio}
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCodigosUsadosMunicipio('');
                      setCodigosUsados([]);
                    }}
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
                
                {loadingCodigosUsados ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  </div>
                ) : codigosUsados.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">No hay códigos usados para este municipio</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-amber-50 sticky top-0">
                        <tr className="border-b">
                          <th className="py-2 px-3 text-left font-medium text-amber-800">Código</th>
                          <th className="py-2 px-3 text-left font-medium text-amber-800">Código Predial</th>
                          <th className="py-2 px-3 text-left font-medium text-amber-800">Propietario</th>
                        </tr>
                      </thead>
                      <tbody>
                        {codigosUsados.map((c, idx) => (
                          <tr key={idx} className="border-b last:border-b-0 hover:bg-amber-50/50">
                            <td className="py-2 px-3 font-mono text-xs font-medium text-amber-700">{c.codigo}</td>
                            <td className="py-2 px-3 font-mono text-xs">{c.codigo_predial || '-'}</td>
                            <td className="py-2 px-3 text-xs truncate max-w-[200px]" title={c.propietario}>{c.propietario || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            
            {/* Resumen */}
            {codigosStats.length > 0 && (
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-slate-800">
                      {codigosStats.reduce((acc, s) => acc + s.total, 0).toLocaleString()}
                    </p>
                    <p className="text-sm text-slate-500">Total Códigos</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-600">
                      {codigosStats.reduce((acc, s) => acc + s.usados, 0).toLocaleString()}
                    </p>
                    <p className="text-sm text-slate-500">Usados</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-emerald-600">
                      {codigosStats.reduce((acc, s) => acc + s.disponibles, 0).toLocaleString()}
                    </p>
                    <p className="text-sm text-slate-500">Disponibles</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Diagnóstico de Códigos */}
      <Dialog open={showDiagnosticoDialog} onOpenChange={setShowDiagnosticoDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-600" />
              Diagnóstico de Códigos - {diagnosticoCodigos?.municipio}
            </DialogTitle>
            <DialogDescription>
              Análisis de inconsistencias entre códigos cargados y predios asignados
            </DialogDescription>
          </DialogHeader>
          
          {loadingDiagnostico ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
              <p className="text-slate-600">Analizando códigos...</p>
              <p className="text-sm text-slate-400">Esto puede tomar unos segundos</p>
            </div>
          ) : diagnosticoCodigos && (
            <div className="space-y-6">
              {/* Resumen de la colección */}
              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  En Colección de Códigos
                </h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-slate-700">{diagnosticoCodigos.en_coleccion?.total?.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">Total</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-600">{diagnosticoCodigos.en_coleccion?.usados?.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">Marcados Usados</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-emerald-600">{diagnosticoCodigos.en_coleccion?.disponibles?.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">Disponibles</p>
                  </div>
                </div>
              </div>
              
              {/* Predios reales */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-3 flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  Predios con Código Asignado (Realidad)
                </h4>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-blue-700">{diagnosticoCodigos.en_predios?.predios_con_codigo_homologado?.toLocaleString()}</p>
                    <p className="text-xs text-blue-600">Predios con código_homologado</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-700">{diagnosticoCodigos.en_predios?.codigos_unicos?.toLocaleString()}</p>
                    <p className="text-xs text-blue-600">Códigos únicos en predios</p>
                  </div>
                </div>
              </div>
              
              {/* Inconsistencias */}
              {(diagnosticoCodigos.inconsistencias?.codigos_huerfanos_en_coleccion > 0) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-medium text-red-800 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    ¡Inconsistencias Detectadas!
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-white rounded p-3">
                      <div>
                        <p className="font-medium text-red-700">Códigos marcados como "usados" sin predio real</p>
                        <p className="text-sm text-red-600">Estos códigos se liberarán al recalcular</p>
                      </div>
                      <p className="text-3xl font-bold text-red-600">
                        {diagnosticoCodigos.inconsistencias?.codigos_huerfanos_en_coleccion?.toLocaleString()}
                      </p>
                    </div>
                    
                    {diagnosticoCodigos.inconsistencias?.ejemplos_huerfanos?.length > 0 && (
                      <div className="text-sm">
                        <p className="text-red-700 font-medium mb-1">Ejemplos de códigos huérfanos:</p>
                        <div className="flex flex-wrap gap-1">
                          {diagnosticoCodigos.inconsistencias.ejemplos_huerfanos.slice(0, 5).map((c, i) => (
                            <Badge key={i} variant="outline" className="text-red-600 border-red-300">{c}</Badge>
                          ))}
                          {diagnosticoCodigos.inconsistencias.ejemplos_huerfanos.length > 5 && (
                            <Badge variant="outline" className="text-slate-500">+{diagnosticoCodigos.inconsistencias.ejemplos_huerfanos.length - 5} más</Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Sin inconsistencias */}
              {diagnosticoCodigos.inconsistencias?.codigos_huerfanos_en_coleccion === 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
                  <CheckCircle className="w-12 h-12 mx-auto text-emerald-500 mb-2" />
                  <p className="font-medium text-emerald-800">¡Sin inconsistencias!</p>
                  <p className="text-sm text-emerald-600">Los códigos están correctamente sincronizados con los predios</p>
                </div>
              )}
              
              {/* Recomendación y botón de acción */}
              {diagnosticoCodigos.inconsistencias?.codigos_huerfanos_en_coleccion > 0 && (
                <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div>
                    <p className="font-medium text-amber-800">Recomendación</p>
                    <p className="text-sm text-amber-700">
                      Ejecute "Recalcular" para liberar {diagnosticoCodigos.inconsistencias?.codigos_huerfanos_en_coleccion?.toLocaleString()} códigos
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setShowDiagnosticoDialog(false);
                      recalcularCodigosMunicipio(diagnosticoCodigos.municipio);
                    }}
                    className="bg-amber-600 hover:bg-amber-700"
                    disabled={recalculandoCodigos}
                  >
                    {recalculandoCodigos ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Recalcular Ahora
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
