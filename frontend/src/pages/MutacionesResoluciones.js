import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  FileText, Plus, Search, Download, History, 
  ArrowRight, X, Check, AlertCircle, Building,
  Users, User, MapPin, DollarSign, Calendar, Filter,
  ChevronDown, ChevronUp, Trash2, Edit, Loader2, Lock, Layers,
  Settings, Save, Eye, RefreshCw, Hash, Upload, FileSpreadsheet,
  Unlock, AlertTriangle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Textarea } from '../components/ui/textarea';
import PDFViewerModal from '../components/PDFViewerModal';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Configuración de tipos de mutación
const TIPOS_MUTACION = {
  M1: { 
    codigo: 'M1', 
    nombre: 'Mutación Primera', 
    descripcion: 'Cambio de propietario o poseedor',
    color: 'bg-blue-100 text-blue-800',
    enabled: true
  },
  M2: { 
    codigo: 'M2', 
    nombre: 'Mutación Segunda', 
    descripcion: 'Englobe o Desengloble de terreno',
    color: 'bg-purple-100 text-purple-800',
    enabled: true
  },
  M3: { 
    codigo: 'M3', 
    nombre: 'Mutación Tercera', 
    descripcion: 'Cambio de destino económico o incorporación de construcción',
    color: 'bg-amber-100 text-amber-800',
    enabled: true
  },
  M4: { 
    codigo: 'M4', 
    nombre: 'Mutación Cuarta', 
    descripcion: 'Revisión de avalúo o Autoestimación',
    color: 'bg-green-100 text-green-800',
    enabled: true
  },
  M5: { 
    codigo: 'M5', 
    nombre: 'Mutación Quinta', 
    descripcion: 'Cancelación o inscripción de predio',
    color: 'bg-red-100 text-red-800',
    enabled: true
  },
  RECTIFICACION_AREA: { 
    codigo: 'RECTIFICACION_AREA', 
    codigoDisplay: 'Ajuste Área',
    nombre: 'Rectificación de Área', 
    descripcion: 'Corrección del área de terreno de un predio',
    color: 'bg-cyan-100 text-cyan-800',
    enabled: true
  },
  COMP: { 
    codigo: 'COMP', 
    nombre: 'Complementación', 
    descripcion: 'Complementación de información catastral',
    color: 'bg-slate-100 text-slate-800',
    enabled: true
  },
  BLOQUEO: { 
    codigo: 'BLOQUEO', 
    nombre: 'Bloqueo de Predio', 
    descripcion: 'Bloquear/desbloquear predios por proceso legal',
    color: 'bg-red-100 text-red-800',
    enabled: true,
    soloCoordinador: true
  },
  ELIMINADOS: { 
    codigo: 'ELIMINADOS', 
    nombre: 'Predios Eliminados', 
    descripcion: 'Consultar predios eliminados del sistema',
    color: 'bg-gray-100 text-gray-800',
    enabled: true,
    soloCoordinador: true
  }
};

// Helper para formatear área en hectáreas + m²
const formatAreaHectareas = (m2) => {
  if (!m2 || m2 === 0) return '0 m²';
  const area = Number(m2);
  const hectareas = Math.floor(area / 10000);
  const metros = area % 10000;
  if (hectareas > 0) {
    return `${hectareas} ha ${metros.toLocaleString('es-CO', {maximumFractionDigits: 0})} m²`;
  }
  return `${area.toLocaleString('es-CO', {maximumFractionDigits: 0})} m²`;
};

// Municipios R1/R2 - Los 12 municipios del sistema
const MUNICIPIOS = [
  { codigo: '54003', nombre: 'Ábrego' },
  { codigo: '54109', nombre: 'Bucarasica' },
  { codigo: '54128', nombre: 'Cáchira' },
  { codigo: '54206', nombre: 'Convención' },
  { codigo: '54245', nombre: 'El Carmen' },
  { codigo: '54250', nombre: 'El Tarra' },
  { codigo: '54344', nombre: 'Hacarí' },
  { codigo: '54398', nombre: 'La Playa' },
  { codigo: '20614', nombre: 'Río de Oro' },
  { codigo: '54670', nombre: 'San Calixto' },
  { codigo: '54720', nombre: 'Sardinata' },
  { codigo: '54800', nombre: 'Teorama' }
];

// Helper para obtener matrícula inmobiliaria de un predio
// Busca primero en el campo directo, luego en r2_registros
const getMatriculaInmobiliaria = (predio) => {
  if (!predio) return 'Sin información';
  
  // Primero intentar campo directo
  if (predio.matricula_inmobiliaria && predio.matricula_inmobiliaria.trim()) {
    return predio.matricula_inmobiliaria;
  }
  
  // Luego buscar en r2_registros
  if (predio.r2_registros && Array.isArray(predio.r2_registros) && predio.r2_registros.length > 0) {
    const matriculaR2 = predio.r2_registros[0]?.matricula_inmobiliaria;
    if (matriculaR2 && matriculaR2.trim()) {
      return matriculaR2;
    }
  }
  
  return 'Sin información';
};

export default function MutacionesResoluciones() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('nueva');
  const [tipoMutacionSeleccionado, setTipoMutacionSeleccionado] = useState(null);
  const [showMutacionDialog, setShowMutacionDialog] = useState(false);
  
  // Estado para historial
  const [historialResoluciones, setHistorialResoluciones] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [filtroMunicipio, setFiltroMunicipio] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  
  // Estados para configuración de resoluciones (solo admin/coordinador)
  const [configTab, setConfigTab] = useState('plantillas');
  const [plantillas, setPlantillas] = useState([]);
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState(null);
  const [textoPlantilla, setTextoPlantilla] = useState('');
  const [firmante, setFirmante] = useState({ nombre: '', cargo: '' });
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false);
  const [generandoPreview, setGenerandoPreview] = useState(false);
  const [numeracionMunicipios, setNumeracionMunicipios] = useState({});
  const [guardandoConfig, setGuardandoConfig] = useState(false);
  const [cargandoConfig, setCargandoConfig] = useState(false);
  
  // Estado para M2
  const [m2Data, setM2Data] = useState({
    subtipo: '', // 'englobe' o 'desengloble'
    municipio: '',
    radicado: '',
    solicitante: {
      nombre: '',
      documento: '',
      tipo_documento: 'C'
    },
    predios_cancelados: [],
    predios_inscritos: [],
    documentos_soporte: [],
    // Campos específicos para Englobe
    tipo_englobe: '', // 'total' o 'absorcion'
    predio_matriz_id: null, // ID del predio que absorbe (solo para absorción)
    predio_resultante: null, // Datos del predio resultante (editable)
    texto_considerando: '' // Texto personalizado para los considerandos de la resolución
  });
  
  // Estado para búsqueda de predios
  const [searchPredio, setSearchPredio] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchingPredios, setSearchingPredios] = useState(false);
  
  // Estado para generación
  const [generando, setGenerando] = useState(false);

  // Estado para M1
  const [m1Data, setM1Data] = useState({
    municipio: '',
    predio: null,
    numero_resolucion: '',
    fecha_resolucion: '',
    radicado_peticion: '',
    propietarios_anteriores: [],
    propietarios_nuevos: [],
    texto_considerando: '' // Texto personalizado para los considerandos de la resolución
  });
  const [searchPredioM1, setSearchPredioM1] = useState('');
  const [searchResultsM1, setSearchResultsM1] = useState([]);
  const [searchingPrediosM1, setSearchingPrediosM1] = useState(false);
  const [cargandoNumeroResolucion, setCargandoNumeroResolucion] = useState(false);
  const [radicadosDisponibles, setRadicadosDisponibles] = useState([]);
  const [radicadosDisponiblesM2, setRadicadosDisponiblesM2] = useState([]);
  const [showMunicipioDropdown, setShowMunicipioDropdown] = useState(false);
  const [showMunicipioDropdownM2, setShowMunicipioDropdownM2] = useState(false);

  // Estado para M3
  const [m3Data, setM3Data] = useState({
    subtipo: '', // 'cambio_destino' o 'incorporacion_construccion'
    municipio: '',
    radicado: '',
    predio: null,
    destino_anterior: '',
    destino_nuevo: '',
    construcciones_nuevas: [],
    avaluo_anterior: 0,
    avaluo_nuevo: 0,
    fechas_inscripcion: [{ año: new Date().getFullYear(), avaluo: '', avaluo_source: 'manual' }],
    observaciones: '',
    solicitante: { nombre: '', documento: '', tipo_documento: 'CC' },
    texto_considerando: '' // Texto personalizado para los considerandos de la resolución
  });
  const [searchPredioM3, setSearchPredioM3] = useState('');
  const [searchResultsM3, setSearchResultsM3] = useState([]);
  const [searchingPrediosM3, setSearchingPrediosM3] = useState(false);
  const [showMunicipioDropdownM3, setShowMunicipioDropdownM3] = useState(false);
  const [radicadosDisponiblesM3, setRadicadosDisponiblesM3] = useState([]);

  // Estado para M4 - Revisión de Avalúo / Autoestimación
  const [m4Data, setM4Data] = useState({
    subtipo: '', // 'revision_avaluo' o 'autoestimacion'
    decision: 'aceptar', // 'aceptar' o 'rechazar'
    municipio: '',
    radicado: '',
    predio: null,
    avaluo_anterior: 0,
    avaluo_nuevo: 0,
    valor_autoestimado: 0,
    motivo_solicitud: '',
    observaciones: '',
    perito_avaluador: '', // Nombre del perito avaluador (solo para autoestimación)
    solicitante: { nombre: '', documento: '', tipo_documento: 'CC' },
    texto_considerando: '' // Texto personalizado para los considerandos de la resolución
  });
  const [searchPredioM4, setSearchPredioM4] = useState('');
  const [searchResultsM4, setSearchResultsM4] = useState([]);
  const [searchingPrediosM4, setSearchingPrediosM4] = useState(false);
  const [showMunicipioDropdownM4, setShowMunicipioDropdownM4] = useState(false);
  const [radicadosDisponiblesM4, setRadicadosDisponiblesM4] = useState([]);

  // Estado para M5 - Cancelación / Inscripción de predio
  const [m5Data, setM5Data] = useState({
    subtipo: '', // 'cancelacion' o 'inscripcion'
    municipio: '',
    radicado: '',
    predio: null, // predio existente a cancelar O datos del nuevo predio a inscribir
    vigencia: new Date().getFullYear(),
    motivo_solicitud: '',
    es_doble_inscripcion: false,
    codigo_predio_duplicado: '',
    observaciones: '',
    texto_considerando: '' // Texto personalizado para los considerandos de la resolución
  });
  const [searchPredioM5, setSearchPredioM5] = useState('');
  const [searchResultsM5, setSearchResultsM5] = useState([]);
  const [searchingPrediosM5, setSearchingPrediosM5] = useState(false);
  const [showMunicipioDropdownM5, setShowMunicipioDropdownM5] = useState(false);
  const [radicadosDisponiblesM5, setRadicadosDisponiblesM5] = useState([]);
  
  // Estado para modal de creación de predio nuevo (M5 Inscripción)
  const [showCrearPredioM5, setShowCrearPredioM5] = useState(false);
  const [codigoMunicipioM5, setCodigoMunicipioM5] = useState('');
  const [guardandoPredioM5, setGuardandoPredioM5] = useState(false);
  const [tabCrearPredioM5, setTabCrearPredioM5] = useState('ubicacion');
  
  // Estados para constructor de código predial M5
  const [codigoManualM5, setCodigoManualM5] = useState({
    zona: '00', sector: '00', comuna: '00', barrio: '00',
    manzana_vereda: '0000', terreno: '0001', condicion: '0',
    edificio: '00', piso: '00', unidad: '0000'
  });
  const [estructuraCodigoM5, setEstructuraCodigoM5] = useState(null);
  const [verificacionCodigoM5, setVerificacionCodigoM5] = useState(null);
  const [prediosEnManzanaM5, setPrediosEnManzanaM5] = useState([]);
  const [buscandoPrediosManzanaM5, setBuscandoPrediosManzanaM5] = useState(false);
  const [siguienteTerrenoSugeridoM5, setSiguienteTerrenoSugeridoM5] = useState('0001');
  const [siguienteCodigoHomologadoM5, setSiguienteCodigoHomologadoM5] = useState(null);
  const [ultimaManzanaM5, setUltimaManzanaM5] = useState(null);
  const [terrenoInfoM5, setTerrenoInfoM5] = useState(null);
  
  // Estados para datos R1/R2 del nuevo predio M5
  const [propietariosM5, setPropietariosM5] = useState([{
    nombre_propietario: '', tipo_documento: 'C', numero_documento: '', estado_civil: ''
  }]);
  const [zonasTermenoM5, setZonasTermenoM5] = useState([{ zona_fisica: '', zona_economica: '', area_terreno: '0' }]);
  const [construccionesM5, setConstruccionesM5] = useState([{
    id: 'A', piso: '0', habitaciones: '0', banos: '0', locales: '0',
    tipificacion: '', uso: '', puntaje: '0', area_construida: '0'
  }]);
  const [datosR1M5, setDatosR1M5] = useState({
    matricula_inmobiliaria: '',
    direccion: '',
    destino_economico: 'A',
    avaluo: ''
  });

  // Estado para Rectificación de Área
  const [rectificacionData, setRectificacionData] = useState({
    municipio: '',
    radicado: '',
    predio: null,
    area_terreno_anterior: 0,
    area_terreno_nueva: 0,
    area_construida_anterior: 0,
    area_construida_nueva: 0,
    avaluo_nuevo: 0,
    motivo_solicitud: '',
    observaciones: '',
    texto_considerando: ''
  });
  const [searchPredioRectificacion, setSearchPredioRectificacion] = useState('');
  const [searchResultsRectificacion, setSearchResultsRectificacion] = useState([]);
  const [searchingPrediosRectificacion, setSearchingPrediosRectificacion] = useState(false);
  const [showMunicipioDropdownRectificacion, setShowMunicipioDropdownRectificacion] = useState(false);
  const [radicadosDisponiblesRectificacion, setRadicadosDisponiblesRectificacion] = useState([]);
  
  // Estados para Zonas de Terreno y Construcciones en Rectificación
  const [zonasTerreno_Rect_Anterior, setZonasTerreno_Rect_Anterior] = useState([]);
  const [zonasTerreno_Rect_Nueva, setZonasTerreno_Rect_Nueva] = useState([{ zona_fisica: '', zona_economica: '', area_terreno: '0' }]);
  const [construcciones_Rect_Anterior, setConstrucciones_Rect_Anterior] = useState([]);
  const [construcciones_Rect_Nueva, setConstrucciones_Rect_Nueva] = useState([{
    id: 'A', piso: '0', habitaciones: '0', banos: '0', locales: '0',
    tipificacion: '', uso: '', puntaje: '0', area_construida: '0'
  }]);

  // Estado para Complementación de Información
  const [complementacionData, setComplementacionData] = useState({
    municipio: '',
    radicado: '',
    predio: null,
    area_terreno_nueva: 0,
    area_construida_nueva: 0,
    avaluo_nuevo: 0,
    documentos_soporte: 'Oficio de solicitud, Cédula del propietario, Certificado de libertad y tradición',
    observaciones: '',
    texto_considerando: ''
  });
  const [searchPredioComplementacion, setSearchPredioComplementacion] = useState('');
  const [searchResultsComplementacion, setSearchResultsComplementacion] = useState([]);
  const [searchingPrediosComplementacion, setSearchingPrediosComplementacion] = useState(false);
  const [showMunicipioDropdownComplementacion, setShowMunicipioDropdownComplementacion] = useState(false);
  const [radicadosDisponiblesComplementacion, setRadicadosDisponiblesComplementacion] = useState([]);

  // Estado para modal de edición de predio (Cancelación Parcial)
  const [editandoPredio, setEditandoPredio] = useState(null); // índice del predio que se está editando
  const [predioEditando, setPredioEditando] = useState(null); // datos del predio en edición
  const [tabEdicion, setTabEdicion] = useState('r1'); // pestaña activa: 'r1' o 'r2'
  
  // Dropdowns del modal de edición
  const [showDestinoDropdown, setShowDestinoDropdown] = useState(false);
  const [showTipoDocDropdown, setShowTipoDocDropdown] = useState({});
  const [showEstadoCivilDropdown, setShowEstadoCivilDropdown] = useState({});
  
  // Estado para modal de nuevo predio inscrito (M2)
  const [showNuevoPredioModal, setShowNuevoPredioModal] = useState(false);
  const [nuevoPredioModalMode, setNuevoPredioModalMode] = useState('inscripcion'); // 'inscripcion' o 'englobe_total'
  const [nuevoPredioInscrito, setNuevoPredioInscrito] = useState(null);
  const [tabNuevoPredio, setTabNuevoPredio] = useState('ubicacion');
  const [showDestinoDropdownNuevo, setShowDestinoDropdownNuevo] = useState(false);
  const [showTipoDocDropdownNuevo, setShowTipoDocDropdownNuevo] = useState({});
  const [generandoCodigo, setGenerandoCodigo] = useState(false);
  
  // Estados para el constructor de código predial del nuevo predio
  const [codigoManualNuevo, setCodigoManualNuevo] = useState({
    zona: '00', sector: '00', comuna: '00', barrio: '00',
    manzana_vereda: '0000', terreno: '0001', condicion: '0',
    edificio: '00', piso: '00', unidad: '0000'
  });
  const [estructuraCodigoNuevo, setEstructuraCodigoNuevo] = useState(null);
  const [verificacionCodigoNuevo, setVerificacionCodigoNuevo] = useState(null);
  const [prediosEnManzanaNuevo, setPrediosEnManzanaNuevo] = useState([]);
  const [buscandoPrediosManzanaNuevo, setBuscandoPrediosManzanaNuevo] = useState(false);
  const [siguienteTerrenoSugeridoNuevo, setSiguienteTerrenoSugeridoNuevo] = useState('0001');
  const [siguienteCodigoHomologadoNuevo, setSiguienteCodigoHomologadoNuevo] = useState(null);

  // ========== ESTADOS PARA BLOQUEO DE PREDIOS ==========
  const [bloqueoTab, setBloqueoTab] = useState('bloquear'); // 'bloquear' o 'bloqueados'
  const [bloqueoPredioSearch, setBloqueoPredioSearch] = useState('');
  const [bloqueoPredioResults, setBloqueoPredioResults] = useState([]);
  const [bloqueoPredioSearching, setBloqueoPredioSearching] = useState(false);
  const [bloqueoPredioSeleccionado, setBloqueoPredioSeleccionado] = useState(null);
  const [bloqueoMunicipio, setBloqueoMunicipio] = useState('');
  const [showBloqueoMunicipioDropdown, setShowBloqueoMunicipioDropdown] = useState(false);
  const [bloqueoFormData, setBloqueoFormData] = useState({
    motivo: '',
    numero_proceso: '',
    entidad_judicial: '',
    observaciones: ''
  });
  const [prediosBloqueados, setPrediosBloqueados] = useState([]);
  const [loadingBloqueados, setLoadingBloqueados] = useState(false);
  const [procesandoBloqueo, setProcesandoBloqueo] = useState(false);
  const [desbloqueoMotivo, setDesbloqueoMotivo] = useState('');
  const [showDesbloqueoModal, setShowDesbloqueoModal] = useState(false);
  const [predioADesbloquear, setPredioADesbloquear] = useState(null);
  const [showHistorialBloqueoModal, setShowHistorialBloqueoModal] = useState(false);
  const [historialBloqueo, setHistorialBloqueo] = useState([]);
  const [predioHistorialBloqueo, setPredioHistorialBloqueo] = useState(null);
  
  // Estados para Predios Eliminados
  const [showEliminadosModal, setShowEliminadosModal] = useState(false);
  const [prediosEliminados, setPrediosEliminados] = useState([]);
  const [prediosEliminadosFiltrados, setPrediosEliminadosFiltrados] = useState([]);
  const [eliminadosSearch, setEliminadosSearch] = useState('');
  const [eliminadosMunicipio, setEliminadosMunicipio] = useState('');
  const [eliminadosLoading, setEliminadosLoading] = useState(false);
  
  const [ultimaManzanaEncontrada, setUltimaManzanaEncontrada] = useState(null);
  const [buscandoUltimaManzana, setBuscandoUltimaManzana] = useState(false);
  const [zonasTerreno, setZonasTerreno] = useState([{ zona_fisica: '', zona_economica: '', area_terreno: '0' }]);
  const [construcciones, setConstrucciones] = useState([{
    id: 'A', piso: '0', habitaciones: '0', banos: '0', locales: '0',
    tipificacion: '', uso: '', puntaje: '0', area_construida: '0'
  }]);
  const [propietariosNuevo, setPropietariosNuevo] = useState([{
    nombre_propietario: '', tipo_documento: 'C', numero_documento: '', estado_civil: ''
  }]);

  // Estado para desenglobe masivo
  const [showCargaMasiva, setShowCargaMasiva] = useState(false);
  const [cargandoExcel, setCargandoExcel] = useState(false);
  const [prediosCargados, setPrediosCargados] = useState([]);
  const [excelFile, setExcelFile] = useState(null);
  const fileInputRef = React.useRef(null);

  // Estado para fechas de inscripción catastral
  const [añosDisponibles, setAñosDisponibles] = useState(() => {
    // Valores por defecto: desde 2022 hasta año actual + 2
    const currentYear = new Date().getFullYear();
    const años = [];
    for (let y = 2022; y <= currentYear + 2; y++) años.push(y);
    return años;
  });
  const [configuracionAños, setConfiguracionAños] = useState({ año_inicial: 2022, años_futuro: 2 });

  // Estado para códigos homologados reservados (temporalmente)
  const [codigosReservados, setCodigosReservados] = useState([]);
  const [sessionIdReserva, setSessionIdReserva] = useState(null);

  // Función para confirmar uso de códigos al guardar resolución
  const confirmarUsoCodigos = useCallback(async (codigos) => {
    if (!codigos || codigos.length === 0) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/codigos-homologados/confirmar-uso`, 
        `codigos=${codigos.join(',')}`,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          } 
        }
      );
      console.log('Códigos confirmados:', codigos);
    } catch (error) {
      console.error('Error confirmando códigos:', error);
    }
  }, []);

  // Estado para flujo de aprobación
  const [gestoresDisponibles, setGestoresDisponibles] = useState([]);
  const [gestorApoyoSeleccionado, setGestorApoyoSeleccionado] = useState('');
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);
  
  // Estado para visor de PDF
  const [showPDFViewer, setShowPDFViewer] = useState(false);
  const [pdfViewerData, setPdfViewerData] = useState({
    url: '',
    title: '',
    fileName: '',
    resolucionId: null,
    radicado: '',
    correoSolicitante: ''
  });
  const [emailSent, setEmailSent] = useState(false);
  
  // Determinar si el usuario puede aprobar directamente
  const puedeAprobar = user?.role === 'coordinador' || 
                       user?.role === 'administrador' || 
                       (user?.permissions || []).includes('approve_changes');

  // Cargar gestores disponibles para apoyo
  const cargarGestoresDisponibles = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/gestores-disponibles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setGestoresDisponibles(response.data.gestores || []);
      }
    } catch (error) {
      console.error('Error cargando gestores:', error);
    }
  }, []);

  // Función para reservar múltiples códigos homologados
  const reservarCodigosHomologados = useCallback(async (municipio, cantidad) => {
    try {
      const token = localStorage.getItem('token');
      const municipioNombre = MUNICIPIOS.find(m => m.codigo === municipio)?.nombre || municipio;
      
      const response = await axios.post(
        `${API}/codigos-homologados/reservar-multiples/${encodeURIComponent(municipioNombre)}?cantidad=${cantidad}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        setCodigosReservados(prev => [...prev, ...response.data.codigos_reservados]);
        setSessionIdReserva(response.data.session_id);
        return response.data.codigos_reservados;
      }
      return [];
    } catch (error) {
      console.error('Error reservando códigos:', error);
      toast.error(error.response?.data?.detail || 'Error reservando códigos homologados');
      return [];
    }
  }, []);

  // Función para obtener el siguiente código reservado
  const obtenerSiguienteCodigoReservado = useCallback(() => {
    if (codigosReservados.length > 0) {
      const [siguiente, ...restantes] = codigosReservados;
      setCodigosReservados(restantes);
      return siguiente;
    }
    return null;
  }, [codigosReservados]);

  // Liberar códigos no utilizados al cancelar
  const liberarCodigosReservados = useCallback(async () => {
    if (sessionIdReserva && codigosReservados.length > 0) {
      try {
        const token = localStorage.getItem('token');
        await axios.post(`${API}/codigos-homologados/liberar-reserva`, 
          `session_id=${sessionIdReserva}`,
          { 
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            } 
          }
        );
        setCodigosReservados([]);
        setSessionIdReserva(null);
      } catch (error) {
        console.error('Error liberando códigos:', error);
      }
    }
  }, [sessionIdReserva, codigosReservados]);

  useEffect(() => {
    if (tipoMutacionSeleccionado?.codigo === 'M2') {
      cargarGestoresDisponibles();
    }
  }, [tipoMutacionSeleccionado, cargarGestoresDisponibles]);

  // Cargar configuración de años disponibles para inscripción
  const cargarConfiguracionAños = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/avaluos/configuracion-anios`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConfiguracionAños(response.data);
      setAñosDisponibles(response.data.años_disponibles || []);
    } catch (error) {
      console.error('Error cargando configuración de años:', error);
      // Valores por defecto: desde 2022 sin límite superior (año actual + 2)
      const currentYear = new Date().getFullYear();
      const años = [];
      for (let y = 2022; y <= currentYear + 2; y++) años.push(y);
      setAñosDisponibles(años);
    }
  }, []);

  useEffect(() => {
    cargarConfiguracionAños();
  }, [cargarConfiguracionAños]);

  // Función para cargar avalúo de una vigencia específica
  const cargarAvaluoVigencia = async (codigoPredial, año) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/avaluos/vigencia/${encodeURIComponent(codigoPredial)}/${año}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error('Error cargando avalúo:', error);
      return { avaluo: null, found: false };
    }
  };

  // Función para agregar fecha de inscripción a un predio
  const agregarFechaInscripcion = (tipoPredio, indexPredio) => {
    if (tipoPredio === 'cancelado') {
      setM2Data(prev => {
        const nuevosPrecios = [...prev.predios_cancelados];
        if (!nuevosPrecios[indexPredio].fechas_inscripcion) {
          nuevosPrecios[indexPredio].fechas_inscripcion = [];
        }
        nuevosPrecios[indexPredio].fechas_inscripcion.push({
          año: new Date().getFullYear(),
          avaluo: '',
          avaluo_source: 'manual'
        });
        return { ...prev, predios_cancelados: nuevosPrecios };
      });
    } else {
      setM2Data(prev => {
        const nuevosPrecios = [...prev.predios_inscritos];
        if (!nuevosPrecios[indexPredio].fechas_inscripcion) {
          nuevosPrecios[indexPredio].fechas_inscripcion = [];
        }
        nuevosPrecios[indexPredio].fechas_inscripcion.push({
          año: new Date().getFullYear(),
          avaluo: '',
          avaluo_source: 'manual'
        });
        return { ...prev, predios_inscritos: nuevosPrecios };
      });
    }
  };

  // Función para eliminar fecha de inscripción
  const eliminarFechaInscripcion = (tipoPredio, indexPredio, indexFecha) => {
    if (tipoPredio === 'cancelado') {
      setM2Data(prev => {
        const nuevosPrecios = [...prev.predios_cancelados];
        if (nuevosPrecios[indexPredio].fechas_inscripcion?.length > 1) {
          nuevosPrecios[indexPredio].fechas_inscripcion.splice(indexFecha, 1);
        }
        return { ...prev, predios_cancelados: nuevosPrecios };
      });
    } else {
      setM2Data(prev => {
        const nuevosPrecios = [...prev.predios_inscritos];
        if (nuevosPrecios[indexPredio].fechas_inscripcion?.length > 1) {
          nuevosPrecios[indexPredio].fechas_inscripcion.splice(indexFecha, 1);
        }
        return { ...prev, predios_inscritos: nuevosPrecios };
      });
    }
  };

  // Función para actualizar fecha de inscripción
  const actualizarFechaInscripcion = async (tipoPredio, indexPredio, indexFecha, campo, valor) => {
    const updateData = (prev) => {
      const key = tipoPredio === 'cancelado' ? 'predios_cancelados' : 'predios_inscritos';
      const nuevosPrecios = [...prev[key]];
      if (!nuevosPrecios[indexPredio].fechas_inscripcion) {
        nuevosPrecios[indexPredio].fechas_inscripcion = [];
      }
      if (!nuevosPrecios[indexPredio].fechas_inscripcion[indexFecha]) {
        nuevosPrecios[indexPredio].fechas_inscripcion[indexFecha] = { año: '', avaluo: '', avaluo_source: 'manual' };
      }
      nuevosPrecios[indexPredio].fechas_inscripcion[indexFecha][campo] = valor;
      return { ...prev, [key]: nuevosPrecios };
    };

    setM2Data(updateData);

    // Si se cambió el año, intentar cargar el avalúo
    if (campo === 'año' && valor) {
      const key = tipoPredio === 'cancelado' ? 'predios_cancelados' : 'predios_inscritos';
      const predio = m2Data[key][indexPredio];
      const codigoPredial = predio.npn || predio.codigo_predial_nacional || predio.codigo_predial;
      
      if (codigoPredial) {
        const resultado = await cargarAvaluoVigencia(codigoPredial, valor);
        if (resultado.found && resultado.avaluo) {
          setM2Data(prev => {
            const nuevosPrecios = [...prev[key]];
            nuevosPrecios[indexPredio].fechas_inscripcion[indexFecha].avaluo = resultado.avaluo;
            nuevosPrecios[indexPredio].fechas_inscripcion[indexFecha].avaluo_source = resultado.source || 'sistema';
            return { ...prev, [key]: nuevosPrecios };
          });
          toast.success(`Avalúo ${valor} cargado: $${Number(resultado.avaluo).toLocaleString()}`);
        } else {
          toast.info(`No se encontró avalúo para vigencia ${valor}. Ingrese manualmente.`);
        }
      }
    }
  };

  // Cargar historial de resoluciones
  const fetchHistorial = useCallback(async () => {
    setLoadingHistorial(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (filtroMunicipio && filtroMunicipio !== 'todos') {
        params.append('codigo_municipio', filtroMunicipio);
      }
      
      const response = await axios.get(`${API}/resoluciones/historial?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setHistorialResoluciones(response.data.resoluciones || []);
      }
    } catch (error) {
      console.error('Error cargando historial:', error);
    } finally {
      setLoadingHistorial(false);
    }
  }, [filtroMunicipio]);

  useEffect(() => {
    if (activeTab === 'historial') {
      fetchHistorial();
    }
    if (activeTab === 'configuracion') {
      cargarPlantillas();
      cargarConfiguracionNumeracion();
    }
  }, [activeTab, fetchHistorial]);

  // ========== FUNCIONES DE CONFIGURACIÓN (solo admin/coordinador) ==========
  
  const cargarPlantillas = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/resoluciones/plantillas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setPlantillas(response.data.plantillas);
        if (response.data.plantillas.length > 0 && !plantillaSeleccionada) {
          seleccionarPlantilla(response.data.plantillas[0]);
        }
      }
    } catch (error) {
      console.error('Error cargando plantillas:', error);
    }
  };

  const cargarConfiguracionNumeracion = async () => {
    setCargandoConfig(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/resoluciones/configuracion-municipios`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setNumeracionMunicipios(response.data.configuracion || {});
      }
    } catch (error) {
      console.error('Error cargando configuración:', error);
      const inicial = {};
      MUNICIPIOS.forEach(m => { inicial[m.codigo] = 0; });
      setNumeracionMunicipios(inicial);
    } finally {
      setCargandoConfig(false);
    }
  };

  // ========== FUNCIONES DE BLOQUEO DE PREDIOS ==========
  
  const cargarPrediosBloqueados = async () => {
    setLoadingBloqueados(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/predios/lista-bloqueados`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPrediosBloqueados(response.data.predios || []);
    } catch (error) {
      console.error('Error cargando predios bloqueados:', error);
      toast.error('Error al cargar predios bloqueados');
    } finally {
      setLoadingBloqueados(false);
    }
  };

  // Cargar predios eliminados
  const cargarPrediosEliminados = async (municipioFilter = '') => {
    setEliminadosLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (municipioFilter) params.append('municipio', municipioFilter);
      params.append('limit', '500');
      
      const response = await axios.get(`${API}/predios/eliminados?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPrediosEliminados(response.data.predios || []);
      setPrediosEliminadosFiltrados(response.data.predios || []);
    } catch (error) {
      console.error('Error cargando predios eliminados:', error);
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

  const bloquearPredio = async () => {
    if (!bloqueoPredioSeleccionado) {
      toast.error('Debe seleccionar un predio');
      return;
    }
    if (!bloqueoFormData.motivo.trim()) {
      toast.error('Debe ingresar el motivo del bloqueo');
      return;
    }

    setProcesandoBloqueo(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/predios/${bloqueoPredioSeleccionado.id}/bloquear`,
        bloqueoFormData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        toast.success('Predio bloqueado exitosamente');
        setBloqueoPredioSeleccionado(null);
        setBloqueoPredioSearch('');
        setBloqueoFormData({
          motivo: '',
          numero_proceso: '',
          entidad_judicial: '',
          observaciones: ''
        });
        cargarPrediosBloqueados();
        setBloqueoTab('bloqueados');
      }
    } catch (error) {
      console.error('Error bloqueando predio:', error);
      toast.error(error.response?.data?.detail || 'Error al bloquear predio');
    } finally {
      setProcesandoBloqueo(false);
    }
  };

  const desbloquearPredio = async () => {
    if (!predioADesbloquear) return;
    if (!desbloqueoMotivo.trim()) {
      toast.error('Debe ingresar el motivo del desbloqueo');
      return;
    }

    setProcesandoBloqueo(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/predios/${predioADesbloquear.id}/desbloquear`,
        { motivo: desbloqueoMotivo },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        toast.success('Predio desbloqueado exitosamente');
        setShowDesbloqueoModal(false);
        setPredioADesbloquear(null);
        setDesbloqueoMotivo('');
        cargarPrediosBloqueados();
      }
    } catch (error) {
      console.error('Error desbloqueando predio:', error);
      toast.error(error.response?.data?.detail || 'Error al desbloquear predio');
    } finally {
      setProcesandoBloqueo(false);
    }
  };

  const verHistorialBloqueo = async (predio) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/predios/${predio.id}/historial-bloqueos`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setHistorialBloqueo(response.data.historial || []);
      setPredioHistorialBloqueo(predio);
      setShowHistorialBloqueoModal(true);
    } catch (error) {
      console.error('Error cargando historial:', error);
      toast.error('Error al cargar historial de bloqueos');
    }
  };

  const buscarPredioParaBloqueo = async (query) => {
    if (query.length < 3 || !bloqueoMunicipio) return;
    
    setBloqueoPredioSearching(true);
    try {
      const token = localStorage.getItem('token');
      const municipioCodigo = MUNICIPIOS.find(m => m.nombre === bloqueoMunicipio)?.codigo;
      if (!municipioCodigo) {
        console.error('No se encontró código de municipio para:', bloqueoMunicipio);
        return;
      }
      const response = await axios.get(`${API}/predios/buscar-municipio/${municipioCodigo}`, {
        params: { q: query, limit: 15 },
        headers: { Authorization: `Bearer ${token}` }
      });
      setBloqueoPredioResults(response.data.predios || []);
    } catch (error) {
      console.error('Error buscando predios:', error);
      toast.error('Error al buscar predios');
    } finally {
      setBloqueoPredioSearching(false);
    }
  };

  const seleccionarPlantilla = (plantilla) => {
    setPlantillaSeleccionada(plantilla);
    setTextoPlantilla(plantilla.texto || '');
    setFirmante({
      nombre: plantilla.firmante_nombre || '',
      cargo: plantilla.firmante_cargo || ''
    });
  };

  const guardarPlantilla = async () => {
    if (!plantillaSeleccionada) return;
    setGuardandoPlantilla(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/resoluciones/plantillas/${plantillaSeleccionada.tipo}`, {
        texto: textoPlantilla,
        firmante_nombre: firmante.nombre,
        firmante_cargo: firmante.cargo
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Plantilla guardada correctamente');
      cargarPlantillas();
    } catch (error) {
      console.error('Error guardando plantilla:', error);
      toast.error('Error al guardar plantilla');
    } finally {
      setGuardandoPlantilla(false);
    }
  };

  const guardarConfiguracionNumeracion = async () => {
    setGuardandoConfig(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/resoluciones/configuracion-municipios`, 
        { municipios: numeracionMunicipios },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Configuración guardada correctamente');
    } catch (error) {
      console.error('Error guardando configuración:', error);
      toast.error('Error al guardar configuración');
    } finally {
      setGuardandoConfig(false);
    }
  };

  const generarPreviewPdf = async () => {
    if (!plantillaSeleccionada) return;
    setGenerandoPreview(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/resoluciones/generar-preview?tipo=${plantillaSeleccionada.tipo}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        const pdfBase64 = response.data.pdf_base64;
        const byteCharacters = atob(pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        toast.success('Preview generado');
      }
    } catch (error) {
      console.error('Error generando preview:', error);
      toast.error('Error al generar preview');
    } finally {
      setGenerandoPreview(false);
    }
  };

  const puedeVerConfiguracion = user?.role === 'administrador' || user?.role === 'coordinador';

  // Cargar predio pre-seleccionado desde Gestión de Predios
  const [predioPreCargado, setPredioPreCargado] = useState(null);
  
  useEffect(() => {
    const predioGuardado = sessionStorage.getItem('predioParaMutacion');
    if (predioGuardado) {
      try {
        const predio = JSON.parse(predioGuardado);
        // Limpiar sessionStorage
        sessionStorage.removeItem('predioParaMutacion');
        
        // Guardar predio pre-cargado para usar cuando seleccione tipo de mutación
        setPredioPreCargado(predio);
        
        toast.success(`Predio ${predio.codigo_predial_nacional || predio.numero_predio} listo. Seleccione el tipo de mutación.`);
      } catch (e) {
        console.error('Error cargando predio pre-seleccionado:', e);
      }
    }
  }, []);

  // Función para cargar predio en M1 cuando se abre el diálogo
  const cargarPredioEnM1 = (predio) => {
    const codigoMunicipio = predio.codigo_predial_nacional?.substring(0, 5) || '';
    
    setM1Data(prev => ({
      ...prev,
      municipio: codigoMunicipio,
      predio: predio,
      propietarios_anteriores: predio.propietarios || [{
        nombre_propietario: predio.nombre_propietario || '',
        tipo_documento: predio.tipo_documento || 'C',
        numero_documento: predio.numero_documento || ''
      }]
    }));
    
    if (codigoMunicipio) {
      cargarSiguienteNumeroResolucion(codigoMunicipio);
    }
  };

  // Función para cargar predio en M2 cuando se abre el diálogo
  const cargarPredioEnM2 = (predio) => {
    const codigoMunicipio = predio.codigo_predial_nacional?.substring(0, 5) || '';
    
    const predioFormateado = {
      id: predio.id,
      codigo_predial: predio.codigo_predial_nacional || predio.numero_predio,
      npn: predio.codigo_predial_nacional,
      codigo_homologado: predio.codigo_homologado || '',
      direccion: predio.direccion || '',
      destino_economico: predio.destino_economico || 'A',
      area_terreno: predio.area_terreno || 0,
      area_construida: predio.area_construida || 0,
      avaluo: predio.avaluo || 0,
      matricula_inmobiliaria: predio.matricula_inmobiliaria || '',
      propietarios: predio.propietarios || [{
        nombre_propietario: predio.nombre_propietario || '',
        tipo_documento: predio.tipo_documento || 'C',
        numero_documento: predio.numero_documento || ''
      }]
    };
    
    setM2Data(prev => ({
      ...prev,
      municipio: codigoMunicipio,
      predios_cancelados: [predioFormateado]
    }));
  };

  // Manejar apertura de diálogo de mutación
  const handleAbrirMutacion = (tipo) => {
    // Si es ELIMINADOS, abrir modal específico
    if (tipo.codigo === 'ELIMINADOS') {
      setShowEliminadosModal(true);
      cargarPrediosEliminados();
      return;
    }
    
    setTipoMutacionSeleccionado(tipo);
    setShowMutacionDialog(true);
    
    // Si hay predio pre-cargado, cargarlo según el tipo de mutación
    if (predioPreCargado) {
      setTimeout(() => {
        if (tipo.codigo === 'M1') {
          cargarPredioEnM1(predioPreCargado);
        } else if (tipo.codigo === 'M2') {
          cargarPredioEnM2(predioPreCargado);
        }
        // Limpiar predio pre-cargado después de usarlo
        setPredioPreCargado(null);
      }, 100);
    }
  };

  // =====================
  // FUNCIONES PARA M1
  // =====================
  
  // Buscar predios para M1
  const buscarPrediosM1 = async () => {
    if (!searchPredioM1 || searchPredioM1.length < 3) {
      toast.error('Ingrese al menos 3 caracteres para buscar');
      return;
    }
    
    setSearchingPrediosM1(true);
    try {
      const token = localStorage.getItem('token');
      const municipioNombre = MUNICIPIOS.find(m => m.codigo === m1Data.municipio)?.nombre || '';
      
      // Primero obtener la vigencia actual del sistema
      const statsResponse = await axios.get(`${API}/predios/stats/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const vigenciaActual = statsResponse.data.vigencia_actual;
      
      // Buscar predios con la vigencia actual
      const response = await axios.get(`${API}/predios`, {
        params: { 
          search: searchPredioM1,
          municipio: municipioNombre,
          vigencia: vigenciaActual,
          limit: 20
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSearchResultsM1(response.data.predios || []);
      if (response.data.predios?.length === 0) {
        toast.info('No se encontraron predios con ese criterio');
      }
    } catch (error) {
      toast.error('Error buscando predios');
      console.error(error);
    } finally {
      setSearchingPrediosM1(false);
    }
  };

  // Seleccionar predio para M1
  const seleccionarPredioM1 = async (predio) => {
    setM1Data(prev => ({
      ...prev,
      predio: predio,
      propietarios_anteriores: predio.propietarios || [{
        nombre_propietario: predio.nombre_propietario || '',
        tipo_documento: predio.tipo_documento || 'C',
        numero_documento: predio.numero_documento || ''
      }],
      propietarios_nuevos: []
    }));
    setSearchResultsM1([]);
    setSearchPredioM1('');
    
    // Cargar siguiente número de resolución
    if (predio.codigo_predial_nacional) {
      const codigoMunicipio = predio.codigo_predial_nacional.substring(0, 5);
      await cargarSiguienteNumeroResolucion(codigoMunicipio);
    }
  };

  // Cargar siguiente número de resolución
  const cargarSiguienteNumeroResolucion = async (codigoMunicipio) => {
    setCargandoNumeroResolucion(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/resoluciones/siguiente-numero/${codigoMunicipio}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setM1Data(prev => ({
          ...prev,
          numero_resolucion: response.data.numero_resolucion,
          fecha_resolucion: response.data.fecha_resolucion
        }));
      }
    } catch (error) {
      console.error('Error cargando número de resolución:', error);
    } finally {
      setCargandoNumeroResolucion(false);
    }
  };

  // Buscar radicados para M1
  const buscarRadicados = async (query) => {
    if (query.length < 3) {
      setRadicadosDisponibles([]);
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/resoluciones/radicados-disponibles`, {
        params: { busqueda: query },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setRadicadosDisponibles(response.data.radicados || []);
    } catch (error) {
      console.error('Error buscando radicados:', error);
    }
  };

  // Buscar radicados para M2
  const buscarRadicadosM2 = async (query) => {
    if (query.length < 3) {
      setRadicadosDisponiblesM2([]);
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/resoluciones/radicados-disponibles`, {
        params: { busqueda: query },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setRadicadosDisponiblesM2(response.data.radicados || []);
    } catch (error) {
      console.error('Error buscando radicados M2:', error);
    }
  };

  // Seleccionar radicado para M2 (carga datos del solicitante)
  const seleccionarRadicadoM2 = (radicado) => {
    setM2Data(prev => ({
      ...prev,
      radicado: radicado.radicado,
      solicitante: {
        ...prev.solicitante,
        nombre: radicado.nombre_completo || radicado.creator_name || ''
      }
    }));
    setRadicadosDisponiblesM2([]);
  };

  // Agregar propietario nuevo
  const agregarPropietarioNuevo = () => {
    setM1Data(prev => ({
      ...prev,
      propietarios_nuevos: [...prev.propietarios_nuevos, {
        nombre_propietario: '',
        tipo_documento: 'C',
        numero_documento: ''
      }]
    }));
  };

  // Actualizar propietario nuevo
  const actualizarPropietarioNuevo = (index, campo, valor) => {
    setM1Data(prev => {
      const nuevos = [...prev.propietarios_nuevos];
      nuevos[index] = { ...nuevos[index], [campo]: valor };
      return { ...prev, propietarios_nuevos: nuevos };
    });
  };

  // Eliminar propietario nuevo
  const eliminarPropietarioNuevo = (index) => {
    setM1Data(prev => ({
      ...prev,
      propietarios_nuevos: prev.propietarios_nuevos.filter((_, i) => i !== index)
    }));
  };

  // Generar resolución M1
  const generarResolucionM1 = async () => {
    // Validaciones
    if (!m1Data.predio) {
      toast.error('Seleccione un predio');
      return;
    }
    if (!m1Data.numero_resolucion) {
      toast.error('No se ha generado el número de resolución');
      return;
    }
    if (!m1Data.radicado_peticion) {
      toast.error('El número de radicado es obligatorio');
      return;
    }
    if (m1Data.propietarios_nuevos.length === 0) {
      toast.error('Agregue al menos un propietario nuevo');
      return;
    }
    
    setGenerando(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/resoluciones/generar-manual`, {
        predio_id: m1Data.predio.id,
        tipo_mutacion: 'M1',
        numero_resolucion: m1Data.numero_resolucion,
        fecha_resolucion: m1Data.fecha_resolucion || new Date().toLocaleDateString('es-CO'),
        radicado_peticion: m1Data.radicado_peticion || null,
        propietarios_anteriores: m1Data.propietarios_anteriores,
        propietarios_nuevos: m1Data.propietarios_nuevos,
        datos_predio: {
          ...m1Data.predio,
          propietarios: m1Data.propietarios_nuevos
        },
        texto_considerando: m1Data.texto_considerando || ''
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        toast.success(`Resolución ${response.data.numero_resolucion} generada exitosamente`);
        
        // Mostrar PDF en popup en lugar de abrir nueva ventana
        if (response.data.pdf_url) {
          const pdfFullUrl = `${process.env.REACT_APP_BACKEND_URL}${response.data.pdf_url}`;
          setPdfViewerData({
            url: pdfFullUrl,
            title: `Resolución ${response.data.numero_resolucion}`,
            fileName: `Resolucion_${response.data.numero_resolucion.replace(/\//g, '-')}.pdf`,
            resolucionId: response.data.id,
            radicado: m1Data.radicado_peticion,
            correoSolicitante: '' // Se puede obtener del radicado si es necesario
          });
          setEmailSent(false);
          setShowPDFViewer(true);
        }
        
        // Limpiar formulario
        resetFormularioM1();
        setShowMutacionDialog(false);
        setTipoMutacionSeleccionado(null);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error generando resolución');
    } finally {
      setGenerando(false);
    }
  };

  // Reset formulario M1
  const resetFormularioM1 = () => {
    setM1Data({
      municipio: '',
      predio: null,
      numero_resolucion: '',
      fecha_resolucion: '',
      radicado_peticion: '',
      propietarios_anteriores: [],
      propietarios_nuevos: []
    });
    setSearchPredioM1('');
    setSearchResultsM1([]);
    setRadicadosDisponibles([]);
  };

  // =====================
  // FUNCIONES PARA M2
  // =====================

  // Buscar predios
  const buscarPredios = async () => {
    if (!searchPredio || searchPredio.length < 3) {
      toast.error('Ingrese al menos 3 caracteres para buscar');
      return;
    }
    
    setSearchingPredios(true);
    try {
      const token = localStorage.getItem('token');
      const municipioNombre = MUNICIPIOS.find(m => m.codigo === m2Data.municipio)?.nombre || '';
      
      // Primero obtener la vigencia actual del sistema
      const statsResponse = await axios.get(`${API}/predios/stats/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const vigenciaActual = statsResponse.data.vigencia_actual;
      
      // Buscar predios con la vigencia actual
      const response = await axios.get(`${API}/predios`, {
        params: { 
          search: searchPredio,
          municipio: municipioNombre,
          vigencia: vigenciaActual,
          limit: 20
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSearchResults(response.data.predios || []);
      if (response.data.predios?.length === 0) {
        toast.info('No se encontraron predios con ese criterio');
      }
    } catch (error) {
      toast.error('Error buscando predios');
    } finally {
      setSearchingPredios(false);
    }
  };

  // Agregar predio a cancelados (origen)
  const agregarPredioOrigen = (predio) => {
    // Verificar que no esté ya agregado
    if (m2Data.predios_cancelados.find(p => p.id === predio.id)) {
      toast.error('Este predio ya está en la lista');
      return;
    }
    
    const predioFormateado = {
      id: predio.id,
      codigo_predial: predio.codigo_predial_nacional || predio.numero_predio,
      npn: predio.codigo_predial_nacional,
      codigo_homologado: predio.codigo_homologado || '',
      direccion: predio.direccion || '',
      destino_economico: predio.destino_economico || 'A',
      area_terreno: predio.area_terreno || 0,
      area_construida: predio.area_construida || 0,
      avaluo: predio.avaluo || 0,
      matricula_inmobiliaria: predio.matricula_inmobiliaria || '',
      propietarios: predio.propietarios || [{
        nombre_propietario: predio.nombre_propietario || '',
        tipo_documento: predio.tipo_documento || 'C',
        numero_documento: predio.numero_documento || ''
      }],
      // Nuevos campos para tipo de cancelación
      tipo_cancelacion: 'total', // 'total' o 'parcial'
      nueva_area_terreno: predio.area_terreno || 0,
      nueva_area_construida: predio.area_construida || 0,
      nuevo_avaluo: predio.avaluo || 0
    };
    
    setM2Data(prev => ({
      ...prev,
      predios_cancelados: [...prev.predios_cancelados, predioFormateado]
    }));
    
    // Limpiar búsqueda
    setSearchPredio('');
    setSearchResults([]);
    toast.success('Predio agregado a la lista de cancelación');
  };

  // Actualizar predio cancelado
  const actualizarPredioCancelado = (index, campo, valor) => {
    setM2Data(prev => ({
      ...prev,
      predios_cancelados: prev.predios_cancelados.map((p, i) => 
        i === index ? { ...p, [campo]: valor } : p
      )
    }));
  };

  // Eliminar predio de cancelados
  const eliminarPredioOrigen = (index) => {
    setM2Data(prev => ({
      ...prev,
      predios_cancelados: prev.predios_cancelados.filter((_, i) => i !== index)
    }));
  };

  // Abrir modal de edición completa de predio (Cancelación Parcial)
  const abrirEdicionPredio = (index) => {
    const predio = m2Data.predios_cancelados[index];
    // Crear copia profunda del predio para edición
    setPredioEditando({
      ...predio,
      // Asegurar estructura de propietarios
      propietarios: predio.propietarios?.length > 0 
        ? predio.propietarios.map(p => ({...p}))
        : [{ nombre_propietario: '', tipo_documento: 'C', numero_documento: '', estado: '' }],
      // Asegurar estructura de zonas homogéneas
      zonas_homogeneas: predio.zonas_homogeneas?.length > 0
        ? predio.zonas_homogeneas.map(z => ({...z}))
        : [{ zona_fisica: '0', zona_economica: '0', area_terreno: predio.area_terreno || 0, area_construida: predio.area_construida || 0, avaluo: predio.avaluo || 0 }],
      // Campo para indicar que fue editado en plataforma
      editado_en_plataforma: true
    });
    setEditandoPredio(index);
    setTabEdicion('r1');
  };

  // Cerrar modal de edición
  const cerrarEdicionPredio = () => {
    setEditandoPredio(null);
    setPredioEditando(null);
  };

  // Guardar cambios del predio editado
  const guardarEdicionPredio = () => {
    if (editandoPredio === null || !predioEditando) return;
    
    // Calcular áreas desde zonas R2 si fue editado en plataforma
    let areaTerreno = predioEditando.nueva_area_terreno;
    let areaConstruida = predioEditando.nueva_area_construida;
    let avaluoTotal = predioEditando.nuevo_avaluo;
    
    if (predioEditando.zonas_homogeneas?.length > 0) {
      areaTerreno = predioEditando.zonas_homogeneas.reduce((sum, z) => sum + (Number(z.area_terreno) || 0), 0);
      areaConstruida = predioEditando.zonas_homogeneas.reduce((sum, z) => sum + (Number(z.area_construida) || 0), 0);
      avaluoTotal = predioEditando.zonas_homogeneas.reduce((sum, z) => sum + (Number(z.avaluo) || 0), 0);
    }
    
    const predioActualizado = {
      ...predioEditando,
      nueva_area_terreno: areaTerreno,
      nueva_area_construida: areaConstruida,
      nuevo_avaluo: avaluoTotal
    };
    
    setM2Data(prev => ({
      ...prev,
      predios_cancelados: prev.predios_cancelados.map((p, i) => 
        i === editandoPredio ? predioActualizado : p
      )
    }));
    
    cerrarEdicionPredio();
    toast.success('Cambios guardados');
  };

  // Actualizar propietario en edición
  const actualizarPropietarioEdicion = (propIndex, campo, valor) => {
    setPredioEditando(prev => ({
      ...prev,
      propietarios: prev.propietarios.map((p, i) => 
        i === propIndex ? { ...p, [campo]: valor } : p
      )
    }));
  };

  // Agregar propietario en edición
  const agregarPropietarioEdicion = () => {
    setPredioEditando(prev => ({
      ...prev,
      propietarios: [...prev.propietarios, { nombre_propietario: '', tipo_documento: 'C', numero_documento: '', estado: '' }]
    }));
  };

  // Eliminar propietario en edición
  const eliminarPropietarioEdicion = (propIndex) => {
    setPredioEditando(prev => ({
      ...prev,
      propietarios: prev.propietarios.filter((_, i) => i !== propIndex)
    }));
  };

  // Actualizar zona homogénea en edición
  const actualizarZonaEdicion = (zonaIndex, campo, valor) => {
    setPredioEditando(prev => ({
      ...prev,
      zonas_homogeneas: prev.zonas_homogeneas.map((z, i) => 
        i === zonaIndex ? { ...z, [campo]: valor } : z
      )
    }));
  };

  // Agregar zona homogénea en edición
  const agregarZonaEdicion = () => {
    setPredioEditando(prev => ({
      ...prev,
      zonas_homogeneas: [...prev.zonas_homogeneas, { zona_fisica: '0', zona_economica: '0', area_terreno: 0, area_construida: 0, avaluo: 0 }]
    }));
  };

  // Eliminar zona homogénea en edición
  const eliminarZonaEdicion = (zonaIndex) => {
    if (predioEditando.zonas_homogeneas.length <= 1) {
      toast.error('Debe haber al menos una zona');
      return;
    }
    setPredioEditando(prev => ({
      ...prev,
      zonas_homogeneas: prev.zonas_homogeneas.filter((_, i) => i !== zonaIndex)
    }));
  };

  // ==================== DESENGLOBE MASIVO ====================
  
  // Descargar plantilla Excel
  const descargarPlantillaDesenglobe = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/mutaciones/desenglobe-masivo/plantilla`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Plantilla_Predios_R1R2.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Plantilla descargada');
    } catch (error) {
      console.error('Error descargando plantilla:', error);
      toast.error('Error al descargar plantilla');
    }
  };

  // Procesar Excel de carga masiva
  const procesarExcelMasivo = async (file) => {
    if (!file) return;
    
    if (!m2Data.municipio) {
      toast.error('Primero seleccione un municipio');
      return;
    }
    
    if (m2Data.predios_cancelados.length === 0) {
      toast.error('Primero agregue al menos un predio a cancelar (predio matriz)');
      return;
    }
    
    setCargandoExcel(true);
    
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('predio_matriz_npn', m2Data.predios_cancelados[0]?.npn || m2Data.predios_cancelados[0]?.codigo_predial_nacional || '');
      formData.append('municipio', m2Data.municipio);
      
      const response = await axios.post(`${API}/mutaciones/desenglobe-masivo/procesar-excel`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data.success) {
        const prediosProcesados = response.data.predios;
        setPrediosCargados(prediosProcesados);
        
        // Agregar a predios inscritos
        setM2Data(prev => ({
          ...prev,
          predios_inscritos: [...prev.predios_inscritos, ...prediosProcesados]
        }));
        
        toast.success(`${prediosProcesados.length} ${prediosProcesados.length === 1 ? 'predio cargado' : 'predios cargados'} desde Excel`);
        setShowCargaMasiva(false);
        setExcelFile(null);
      }
    } catch (error) {
      console.error('Error procesando Excel:', error);
      toast.error(error.response?.data?.detail || 'Error al procesar el archivo Excel');
    } finally {
      setCargandoExcel(false);
    }
  };

  // Manejar selección de archivo
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setExcelFile(file);
    }
  };

  // Agregar nuevo predio inscrito (destino)
  const agregarPredioDestino = async () => {
    // Primero cargar la estructura del código para el municipio seleccionado
    if (!m2Data.municipio) {
      toast.error('Primero seleccione un municipio');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios/estructura-codigo/${m2Data.municipio}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEstructuraCodigoNuevo(res.data);
    } catch (error) {
      console.error('Error cargando estructura:', error);
    }
    
    // Reset de estados del modal
    setCodigoManualNuevo({
      zona: '00', sector: '00', comuna: '00', barrio: '00',
      manzana_vereda: '0000', terreno: '0001', condicion: '0',
      edificio: '00', piso: '00', unidad: '0000'
    });
    setZonasTerreno([{ zona_fisica: '', zona_economica: '', area_terreno: '0' }]);
    setConstrucciones([{
      id: 'A', piso: '0', habitaciones: '0', banos: '0', locales: '0',
      tipificacion: '', uso: '', puntaje: '0', area_construida: '0'
    }]);
    setPropietariosNuevo([{
      nombre_propietario: '', tipo_documento: 'C', numero_documento: '', estado_civil: ''
    }]);
    setVerificacionCodigoNuevo(null);
    setPrediosEnManzanaNuevo([]);
    setSiguienteTerrenoSugeridoNuevo('0001');
    
    // Cargar siguiente código homologado
    fetchSiguienteCodigoHomologadoNuevo(m2Data.municipio);
    
    // Crear predio nuevo vacío
    const nuevoPredio = {
      id: `nuevo_${Date.now()}`,
      codigo_predial: '',
      npn: '',
      codigo_homologado: '',
      direccion: '',
      destino_economico: 'R',
      area_terreno: 0,
      area_construida: 0,
      avaluo: 0,
      matricula_inmobiliaria: '',
      propietarios: [],
      zonas_homogeneas: [],
      _editIndex: undefined
    };
    
    setNuevoPredioInscrito(nuevoPredio);
    setTabNuevoPredio('ubicacion');
    setNuevoPredioModalMode('inscripcion'); // Reset mode for normal inscriptions
    setShowNuevoPredioModal(true);
  };

  // Construir código completo de 30 dígitos
  // Construir código completo de 30 dígitos (con padding automático)
  const construirCodigoCompletoNuevo = () => {
    if (!estructuraCodigoNuevo) return '';
    return `${estructuraCodigoNuevo.prefijo_fijo}${(codigoManualNuevo.zona || '').padStart(2, '0')}${(codigoManualNuevo.sector || '').padStart(2, '0')}${(codigoManualNuevo.comuna || '').padStart(2, '0')}${(codigoManualNuevo.barrio || '').padStart(2, '0')}${(codigoManualNuevo.manzana_vereda || '').padStart(4, '0')}${(codigoManualNuevo.terreno || '').padStart(4, '0')}${codigoManualNuevo.condicion || '0'}${(codigoManualNuevo.edificio || '').padStart(2, '0')}${(codigoManualNuevo.piso || '').padStart(2, '0')}${(codigoManualNuevo.unidad || '').padStart(4, '0')}`;
  };

  // Manejar cambio en campos del código (sin padding automático para permitir escribir)
  const handleCodigoChangeNuevo = (campo, valor, maxLen) => {
    // Solo permitir números
    const soloNumeros = valor.replace(/[^0-9]/g, '');
    // Limitar al máximo de dígitos
    const valorFinal = soloNumeros.slice(0, maxLen);
    setCodigoManualNuevo(prev => ({ ...prev, [campo]: valorFinal }));
  };

  // Aplicar padding cuando el campo pierde el foco
  const handleCodigoBlurNuevo = (campo, maxLen) => {
    setCodigoManualNuevo(prev => ({
      ...prev,
      [campo]: (prev[campo] || '').padStart(maxLen, '0')
    }));
  };

  // Obtener siguiente código homologado para el municipio (y opcionalmente reservarlo)
  const fetchSiguienteCodigoHomologadoNuevo = async (municipioCodigo, reservar = false) => {
    if (!municipioCodigo) {
      setSiguienteCodigoHomologadoNuevo(null);
      return null;
    }
    
    try {
      const token = localStorage.getItem('token');
      const municipioNombre = MUNICIPIOS.find(m => m.codigo === municipioCodigo)?.nombre || '';
      const url = `${API}/codigos-homologados/siguiente/${encodeURIComponent(municipioNombre)}${reservar ? '?reservar=true' : ''}`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSiguienteCodigoHomologadoNuevo(res.data);
      return res.data;
    } catch (error) {
      console.error('Error obteniendo siguiente código homologado:', error);
      setSiguienteCodigoHomologadoNuevo(null);
      return null;
    }
  };

  // Verificar código completo
  const verificarCodigoCompletoNuevo = async () => {
    const codigo = construirCodigoCompletoNuevo();
    if (codigo.length !== 30) {
      toast.error('El código debe tener 30 dígitos');
      return;
    }
    
    // Obtener el nombre del municipio para el query param
    const municipioNombre = MUNICIPIOS.find(m => m.codigo === m2Data.municipio)?.nombre || '';
    
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios/verificar-codigo-completo/${codigo}`, {
        params: { municipio: municipioNombre },
        headers: { Authorization: `Bearer ${token}` }
      });
      setVerificacionCodigoNuevo(res.data);
      
      if (res.data.estado === 'existente') {
        toast.error('Este código ya existe en la base de datos');
      } else if (res.data.estado === 'disponible') {
        toast.success('Código disponible');
      } else if (res.data.estado === 'eliminado') {
        toast.warning('Este código pertenece a un predio ELIMINADO. Puede reactivarlo completando el proceso de mutación.');
      }
    } catch (error) {
      toast.error('Error verificando código');
    }
  };

  // Buscar predios en manzana para nuevo predio
  const fetchPrediosEnManzanaNuevo = async () => {
    if (!m2Data.municipio || !codigoManualNuevo.manzana_vereda || codigoManualNuevo.manzana_vereda === '0000') {
      setPrediosEnManzanaNuevo([]);
      return;
    }
    
    setBuscandoPrediosManzanaNuevo(true);
    try {
      const token = localStorage.getItem('token');
      // Obtener nombre del municipio desde el código
      const municipioNombre = MUNICIPIOS.find(m => m.codigo === m2Data.municipio)?.nombre || m2Data.municipio;
      const params = new URLSearchParams({
        zona: (codigoManualNuevo.zona || '00').padStart(2, '0'),
        sector: (codigoManualNuevo.sector || '00').padStart(2, '0'),
        comuna: (codigoManualNuevo.comuna || '00').padStart(2, '0'),
        barrio: (codigoManualNuevo.barrio || '00').padStart(2, '0'),
        manzana_vereda: (codigoManualNuevo.manzana_vereda || '0000').padStart(4, '0'),
        limit: 5
      });
      const res = await axios.get(`${API}/predios/por-manzana/${encodeURIComponent(municipioNombre)}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPrediosEnManzanaNuevo(res.data.predios || []);
      setSiguienteTerrenoSugeridoNuevo(res.data.siguiente_terreno || '0001');
    } catch (error) {
      console.log('Error buscando predios en manzana:', error);
      setPrediosEnManzanaNuevo([]);
      setSiguienteTerrenoSugeridoNuevo('0001');
    } finally {
      setBuscandoPrediosManzanaNuevo(false);
    }
  };

  // Buscar la última manzana en la zona/sector actual
  const fetchUltimaManzana = async () => {
    if (!m2Data.municipio || !codigoManualNuevo.zona || !codigoManualNuevo.sector) {
      setUltimaManzanaEncontrada(null);
      return;
    }
    
    setBuscandoUltimaManzana(true);
    try {
      const token = localStorage.getItem('token');
      const municipioNombre = MUNICIPIOS.find(m => m.codigo === m2Data.municipio)?.nombre || m2Data.municipio;
      const params = new URLSearchParams({
        zona: (codigoManualNuevo.zona || '00').padStart(2, '0'),
        sector: (codigoManualNuevo.sector || '00').padStart(2, '0'),
        comuna: (codigoManualNuevo.comuna || '00').padStart(2, '0'),
        barrio: (codigoManualNuevo.barrio || '00').padStart(2, '0')
      });
      const res = await axios.get(`${API}/predios/ultima-manzana/${encodeURIComponent(municipioNombre)}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUltimaManzanaEncontrada(res.data.ultima_manzana || null);
    } catch (error) {
      console.log('Error buscando última manzana:', error);
      setUltimaManzanaEncontrada(null);
    } finally {
      setBuscandoUltimaManzana(false);
    }
  };

  // Effect para buscar última manzana cuando cambia zona/sector
  useEffect(() => {
    if (showNuevoPredioModal && m2Data.municipio && codigoManualNuevo.zona) {
      const timer = setTimeout(() => {
        fetchUltimaManzana();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [showNuevoPredioModal, codigoManualNuevo.zona, codigoManualNuevo.sector, codigoManualNuevo.comuna, codigoManualNuevo.barrio, m2Data.municipio]);

  // Effect para buscar predios cuando cambia la manzana
  useEffect(() => {
    if (showNuevoPredioModal && m2Data.municipio && codigoManualNuevo.manzana_vereda && codigoManualNuevo.manzana_vereda !== '0000') {
      const timer = setTimeout(() => {
        fetchPrediosEnManzanaNuevo();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [showNuevoPredioModal, codigoManualNuevo.zona, codigoManualNuevo.sector, codigoManualNuevo.manzana_vereda, m2Data.municipio]);

  // Funciones para zonas de terreno
  const agregarZonaTerreno = () => {
    setZonasTerreno(prev => [...prev, { zona_fisica: '', zona_economica: '', area_terreno: '0' }]);
  };
  
  const eliminarZonaTerreno = (index) => {
    if (zonasTerreno.length > 1) {
      setZonasTerreno(prev => prev.filter((_, i) => i !== index));
    }
  };
  
  const actualizarZonaTerreno = (index, campo, valor) => {
    setZonasTerreno(prev => {
      const nuevas = [...prev];
      nuevas[index] = { ...nuevas[index], [campo]: valor };
      return nuevas;
    });
  };

  // Funciones para construcciones
  const generarIdConstruccion = (index) => {
    if (index < 26) {
      return String.fromCharCode(65 + index);
    } else {
      const firstChar = String.fromCharCode(65 + Math.floor((index - 26) / 26));
      const secondChar = String.fromCharCode(65 + ((index - 26) % 26));
      return firstChar + secondChar;
    }
  };

  const agregarConstruccion = () => {
    setConstrucciones(prev => {
      const nuevoId = generarIdConstruccion(prev.length);
      return [...prev, {
        id: nuevoId, piso: '0', habitaciones: '0', banos: '0', locales: '0',
        tipificacion: '', uso: '', puntaje: '0', area_construida: '0'
      }];
    });
  };

  const eliminarConstruccion = (index) => {
    if (construcciones.length > 1) {
      setConstrucciones(prev => {
        const nuevas = prev.filter((_, i) => i !== index);
        return nuevas.map((c, i) => ({ ...c, id: generarIdConstruccion(i) }));
      });
    }
  };

  const actualizarConstruccion = (index, campo, valor) => {
    setConstrucciones(prev => {
      const nuevas = [...prev];
      nuevas[index] = { ...nuevas[index], [campo]: valor };
      return nuevas;
    });
  };

  // Funciones para propietarios del nuevo predio
  const agregarPropietarioNuevoPredio = () => {
    setPropietariosNuevo(prev => [...prev, {
      nombre_propietario: '', tipo_documento: 'C', numero_documento: '', estado_civil: ''
    }]);
  };

  const eliminarPropietarioNuevoPredio = (index) => {
    if (propietariosNuevo.length > 1) {
      setPropietariosNuevo(prev => prev.filter((_, i) => i !== index));
    }
  };

  const actualizarPropietarioNuevoPredio = (index, campo, valor) => {
    setPropietariosNuevo(prev => {
      const nuevos = [...prev];
      nuevos[index] = { ...nuevos[index], [campo]: valor };
      return nuevos;
    });
  };

  // Calcular áreas totales
  const calcularAreasTotalesNuevo = () => {
    const areaTerrenoTotal = zonasTerreno.reduce((sum, zona) => sum + (parseFloat(zona.area_terreno) || 0), 0);
    const areaConstruidaTotal = construcciones.reduce((sum, c) => sum + (parseFloat(c.area_construida) || 0), 0);
    return { areaTerrenoTotal, areaConstruidaTotal };
  };

  // Guardar nuevo predio inscrito (versión mejorada)
  const guardarNuevoPredioInscritoCompleto = async () => {
    const codigo = construirCodigoCompletoNuevo();
    
    // Validaciones
    if (codigo.length !== 30) {
      toast.error('El código predial debe tener 30 dígitos');
      return;
    }
    
    if (!verificacionCodigoNuevo || verificacionCodigoNuevo.estado === 'existente') {
      toast.error('Verifique que el código esté disponible');
      return;
    }
    
    if (!propietariosNuevo[0]?.nombre_propietario || !propietariosNuevo[0]?.numero_documento) {
      toast.error('Ingrese al menos un propietario con nombre y documento');
      return;
    }
    
    if (!nuevoPredioInscrito?.direccion) {
      toast.error('La dirección es obligatoria');
      return;
    }
    
    // Usar el código homologado reservado o el siguiente disponible
    setGenerandoCodigo(true);
    let codigoHomologado = '';
    
    // Reservar un nuevo código de forma atómica
    try {
      const codigoReservado = await fetchSiguienteCodigoHomologadoNuevo(m2Data.municipio, true);
      if (codigoReservado?.codigo) {
        codigoHomologado = codigoReservado.codigo;
      }
    } catch (error) {
      console.error('Error reservando código:', error);
    }
    
    // Fallback: generar código básico si la reserva falla
    if (!codigoHomologado) {
      try {
        const token = localStorage.getItem('token');
        const municipioNombre = MUNICIPIOS.find(m => m.codigo === m2Data.municipio)?.nombre || '';
        const response = await axios.post(`${API}/predios/generar-codigo-homologado`, {
          municipio: municipioNombre,
          codigo_predial: codigo.substring(0, 21)
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data.codigo_homologado) {
          codigoHomologado = response.data.codigo_homologado;
        }
      } catch (error) {
        console.log('Error generando código homologado, se usará formato básico');
        const municipioNombre = MUNICIPIOS.find(m => m.codigo === m2Data.municipio)?.nombre || m2Data.municipio;
        codigoHomologado = `${municipioNombre}-${Date.now().toString().slice(-6)}`;
      }
    }
    setGenerandoCodigo(false);
    
    // Calcular áreas
    const { areaTerrenoTotal, areaConstruidaTotal } = calcularAreasTotalesNuevo();
    
    // Construir objeto del predio
    const predioFinal = {
      id: nuevoPredioInscrito.id,
      codigo_predial: codigo,
      npn: codigo, // El NPN es el mismo código de 30 dígitos
      codigo_homologado: codigoHomologado,
      direccion: nuevoPredioInscrito.direccion,
      destino_economico: nuevoPredioInscrito.destino_economico || 'R',
      area_terreno: areaTerrenoTotal,
      area_construida: areaConstruidaTotal,
      avaluo: parseFloat(nuevoPredioInscrito.avaluo) || 0,
      matricula_inmobiliaria: nuevoPredioInscrito.matricula_inmobiliaria || '',
      propietarios: propietariosNuevo.filter(p => p.nombre_propietario && p.numero_documento).map(p => ({
        nombre_propietario: p.nombre_propietario,
        tipo_documento: p.tipo_documento,
        numero_documento: p.numero_documento.padStart(12, '0'),
        estado: p.estado_civil || ''
      })),
      zonas_homogeneas: zonasTerreno.map((z, idx) => ({
        zona_fisica: z.zona_fisica || '0',
        zona_economica: z.zona_economica || '0',
        area_terreno: parseFloat(z.area_terreno) || 0,
        area_construida: construcciones[idx] ? parseFloat(construcciones[idx].area_construida) || 0 : 0,
        avaluo: 0,
        pisos: construcciones[idx] ? parseInt(construcciones[idx].piso) || 0 : 0,
        habitaciones: construcciones[idx] ? parseInt(construcciones[idx].habitaciones) || 0 : 0,
        banos: construcciones[idx] ? parseInt(construcciones[idx].banos) || 0 : 0,
        locales: construcciones[idx] ? parseInt(construcciones[idx].locales) || 0 : 0,
        uso: construcciones[idx]?.uso || '',
        puntaje: construcciones[idx] ? parseFloat(construcciones[idx].puntaje) || 0 : 0
      })),
      zonas: zonasTerreno.map(z => ({
        zona_fisica: z.zona_fisica || '0',
        zona_economica: z.zona_economica || '0',
        area_terreno: parseFloat(z.area_terreno) || 0
      })),
      construcciones: construcciones.map(c => ({
        id: c.id,
        piso: parseInt(c.piso) || 1,
        habitaciones: parseInt(c.habitaciones) || 0,
        banos: parseInt(c.banos) || 0,
        locales: parseInt(c.locales) || 0,
        tipificacion: c.tipificacion || '',
        uso: c.uso || '',
        puntaje: parseFloat(c.puntaje) || 0,
        area_construida: parseFloat(c.area_construida) || 0
      })),
      creado_en_plataforma: true,
      _editIndex: nuevoPredioInscrito._editIndex
    };
    
    // Si es edición, actualizar; si no, agregar
    if (nuevoPredioModalMode === 'englobe_total') {
      // Modo Englobe Total: guardar como predio_resultante
      setM2Data(prev => ({
        ...prev,
        predio_resultante: predioFinal
      }));
      toast.success('Predio resultante del englobe configurado');
    } else if (nuevoPredioInscrito._editIndex !== undefined) {
      setM2Data(prev => ({
        ...prev,
        predios_inscritos: prev.predios_inscritos.map((p, i) => 
          i === nuevoPredioInscrito._editIndex ? predioFinal : p
        )
      }));
      toast.success('Predio actualizado');
    } else {
      setM2Data(prev => ({
        ...prev,
        predios_inscritos: [...prev.predios_inscritos, predioFinal]
      }));
      toast.success('Predio agregado a la lista');
      
      // Agregar el código a la lista de reservados para confirmar después
      if (codigoHomologado) {
        setCodigosReservados(prev => [...prev, codigoHomologado]);
      }
    }
    
    // IMPORTANTE: Refrescar el siguiente código homologado disponible
    // para que el próximo predio obtenga un código diferente
    fetchSiguienteCodigoHomologadoNuevo(m2Data.municipio);
    
    setShowNuevoPredioModal(false);
    setNuevoPredioInscrito(null);
    setNuevoPredioModalMode('inscripcion'); // Reset mode
  };

  // Generar NPN desde código predial (20 dígitos → 30 dígitos)
  const generarNPN = (codigoPredial) => {
    if (!codigoPredial || codigoPredial.length < 20) return '';
    // Formato: DDDMMMZZSSSSPRRRRRRRR0000000000 (30 dígitos)
    // Agregar 10 ceros al final
    return codigoPredial.padEnd(30, '0');
  };

  // Generar código homologado automáticamente
  const generarCodigoHomologado = async () => {
    if (!m2Data.municipio || !nuevoPredioInscrito?.codigo_predial) {
      toast.error('Complete el municipio y código predial primero');
      return;
    }
    
    setGenerandoCodigo(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/predios/generar-codigo-homologado`, {
        municipio: m2Data.municipio,
        codigo_predial: nuevoPredioInscrito.codigo_predial
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.codigo_homologado) {
        setNuevoPredioInscrito(prev => ({
          ...prev,
          codigo_homologado: response.data.codigo_homologado
        }));
        toast.success('Código homologado generado');
      }
    } catch (error) {
      console.error('Error generando código homologado:', error);
      toast.error('Error al generar código homologado');
    } finally {
      setGenerandoCodigo(false);
    }
  };

  // Actualizar campo del nuevo predio inscrito
  const actualizarNuevoPredioInscrito = (campo, valor) => {
    setNuevoPredioInscrito(prev => {
      const updated = { ...prev, [campo]: valor };
      // Auto-generar NPN cuando cambia el código predial
      if (campo === 'codigo_predial' && valor.length === 20) {
        updated.npn = generarNPN(valor);
      }
      return updated;
    });
  };

  // Actualizar predio inscrito
  const actualizarPredioDestino = (index, campo, valor) => {
    setM2Data(prev => {
      const nuevosInscritos = [...prev.predios_inscritos];
      if (campo.includes('.')) {
        const [parent, child] = campo.split('.');
        nuevosInscritos[index] = {
          ...nuevosInscritos[index],
          [parent]: {
            ...nuevosInscritos[index][parent],
            [child]: valor
          }
        };
      } else {
        nuevosInscritos[index] = {
          ...nuevosInscritos[index],
          [campo]: valor
        };
      }
      return { ...prev, predios_inscritos: nuevosInscritos };
    });
  };

  // Eliminar predio inscrito
  const eliminarPredioDestino = (index) => {
    setM2Data(prev => ({
      ...prev,
      predios_inscritos: prev.predios_inscritos.filter((_, i) => i !== index)
    }));
  };

  // ========== FUNCIONES PARA FLUJO DE APROBACIÓN M2 ==========

  // Validar datos M2 (común para todas las acciones)
  const validarDatosM2 = () => {
    if (!m2Data.subtipo) {
      toast.error('Seleccione el tipo: Englobe o Desengloble');
      return false;
    }
    if (!m2Data.municipio) {
      toast.error('Seleccione el municipio');
      return false;
    }
    if (!m2Data.radicado) {
      toast.error('El número de radicado es obligatorio');
      return false;
    }
    if (m2Data.predios_cancelados.length === 0) {
      toast.error('Agregue al menos un predio a cancelar');
      return false;
    }
    
    // Validaciones específicas para Englobe
    if (m2Data.subtipo === 'englobe') {
      if (m2Data.predios_cancelados.length < 2) {
        toast.error('Para englobe necesita al menos 2 predios a cancelar');
        return false;
      }
      if (!m2Data.tipo_englobe) {
        toast.error('Seleccione el tipo de englobe (Total o Absorción)');
        return false;
      }
      if (m2Data.tipo_englobe === 'absorcion' && !m2Data.predio_matriz_id) {
        toast.error('Seleccione el predio matriz que absorberá a los demás');
        return false;
      }
      if (!m2Data.predio_resultante) {
        toast.error('Complete los datos del predio resultante');
        return false;
      }
    } else {
      // Validación para Desengloble
      if (m2Data.predios_inscritos.length === 0) {
        toast.error('Agregue al menos un predio a inscribir');
        return false;
      }
    }
    
    return true;
  };

  // Crear solicitud M2 y asignar a gestor de apoyo
  const asignarAApoyo = async () => {
    if (!validarDatosM2()) return;
    
    if (!gestorApoyoSeleccionado) {
      toast.error('Seleccione un gestor de apoyo para la cartografía');
      return;
    }
    
    setEnviandoSolicitud(true);
    try {
      const token = localStorage.getItem('token');
      
      // Crear la solicitud
      const response = await axios.post(`${API}/solicitudes-mutacion`, {
        tipo: 'M2',
        subtipo: m2Data.subtipo,
        municipio: m2Data.municipio,
        radicado: m2Data.radicado,
        solicitante: m2Data.solicitante,
        predios_cancelados: m2Data.predios_cancelados,
        predios_inscritos: m2Data.predios_inscritos,
        gestor_apoyo_id: gestorApoyoSeleccionado
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        // Asignar a apoyo
        await axios.post(`${API}/solicitudes-mutacion/${response.data.solicitud_id}/accion`, {
          accion: 'asignar_apoyo',
          gestor_apoyo_id: gestorApoyoSeleccionado
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        toast.success('Solicitud creada y asignada al gestor de apoyo');
        // Limpiar formulario
        setM2Data({
          municipio: '', subtipo: '', radicado: '', solicitante: {},
          predios_cancelados: [], predios_inscritos: [], tipo_englobe: '',
          predio_matriz_id: '', predio_resultante: null, tipo_cancelacion: 'total'
        });
        setGestorApoyoSeleccionado('');
      }
    } catch (error) {
      console.error('Error asignando a apoyo:', error);
      toast.error(error.response?.data?.detail || 'Error al asignar a apoyo');
    } finally {
      setEnviandoSolicitud(false);
    }
  };

  // Enviar directamente a aprobación (sin gestor de apoyo)
  const enviarAAprobacion = async () => {
    if (!validarDatosM2()) return;
    
    setEnviandoSolicitud(true);
    try {
      const token = localStorage.getItem('token');
      
      // Crear la solicitud
      const response = await axios.post(`${API}/solicitudes-mutacion`, {
        tipo: 'M2',
        subtipo: m2Data.subtipo,
        municipio: m2Data.municipio,
        radicado: m2Data.radicado,
        solicitante: m2Data.solicitante,
        predios_cancelados: m2Data.predios_cancelados,
        predios_inscritos: m2Data.predios_inscritos
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        // Enviar a aprobación
        await axios.post(`${API}/solicitudes-mutacion/${response.data.solicitud_id}/accion`, {
          accion: 'enviar_aprobacion'
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        toast.success('Solicitud enviada a aprobación');
        // Limpiar formulario
        setM2Data({
          municipio: '', subtipo: '', radicado: '', solicitante: {},
          predios_cancelados: [], predios_inscritos: [], tipo_englobe: '',
          predio_matriz_id: '', predio_resultante: null, tipo_cancelacion: 'total'
        });
      }
    } catch (error) {
      console.error('Error enviando a aprobación:', error);
      toast.error(error.response?.data?.detail || 'Error al enviar a aprobación');
    } finally {
      setEnviandoSolicitud(false);
    }
  };

  // Generar resolución M2
  const generarResolucionM2 = async () => {
    // Validaciones
    if (!m2Data.subtipo) {
      toast.error('Seleccione el tipo: Englobe o Desengloble');
      return;
    }
    if (!m2Data.municipio) {
      toast.error('Seleccione el municipio');
      return;
    }
    if (!m2Data.radicado) {
      toast.error('El número de radicado es obligatorio');
      return;
    }
    if (m2Data.predios_cancelados.length === 0) {
      toast.error('Agregue al menos un predio a cancelar');
      return;
    }
    
    // Validaciones específicas para Englobe
    if (m2Data.subtipo === 'englobe') {
      if (m2Data.predios_cancelados.length < 2) {
        toast.error('Para englobe necesita al menos 2 predios a cancelar');
        return;
      }
      if (!m2Data.tipo_englobe) {
        toast.error('Seleccione el tipo de englobe (Total o Absorción)');
        return;
      }
      if (m2Data.tipo_englobe === 'absorcion' && !m2Data.predio_matriz_id) {
        toast.error('Seleccione el predio matriz que absorberá a los demás');
        return;
      }
      if (!m2Data.predio_resultante) {
        toast.error('Complete los datos del predio resultante');
        return;
      }
    } else {
      // Validación para Desengloble
      if (m2Data.predios_inscritos.length === 0) {
        toast.error('Agregue al menos un predio a inscribir');
        return;
      }
    }
    
    setGenerando(true);
    try {
      const token = localStorage.getItem('token');
      
      // Preparar datos para enviar
      // Lógica: Si hay cancelación PARCIAL, el predio matriz ajustado va PRIMERO en inscripciones
      let prediosInscribirOrdenados = [...m2Data.predios_inscritos];
      
      // Buscar si hay algún predio con cancelación parcial
      const predioParcial = m2Data.predios_cancelados.find(p => p.tipo_cancelacion === 'parcial');
      
      if (predioParcial) {
        // Crear el predio matriz ajustado para la primera inscripción
        const predioMatrizAjustado = {
          ...predioParcial,
          // Usar los nuevos valores ajustados
          area_terreno: predioParcial.nueva_area_terreno || predioParcial.area_terreno,
          area_construida: predioParcial.nueva_area_construida || predioParcial.area_construida,
          avaluo: predioParcial.nuevo_avaluo || predioParcial.avaluo,
          es_matriz_ajustado: true, // Marcador para identificarlo
        };
        
        // Verificar si ya existe el predio matriz en las inscripciones (evitar duplicados)
        const yaExisteMatriz = prediosInscribirOrdenados.some(
          p => p.codigo_predial === predioParcial.codigo_predial || p.npn === predioParcial.npn
        );
        
        if (!yaExisteMatriz) {
          // Insertar el predio matriz ajustado al inicio
          prediosInscribirOrdenados = [predioMatrizAjustado, ...prediosInscribirOrdenados];
        } else {
          // Si ya existe, moverlo al inicio
          const matrizExistente = prediosInscribirOrdenados.find(
            p => p.codigo_predial === predioParcial.codigo_predial || p.npn === predioParcial.npn
          );
          prediosInscribirOrdenados = prediosInscribirOrdenados.filter(
            p => p.codigo_predial !== predioParcial.codigo_predial && p.npn !== predioParcial.npn
          );
          // Actualizar con los nuevos valores y poner al inicio
          prediosInscribirOrdenados = [{
            ...matrizExistente,
            area_terreno: predioParcial.nueva_area_terreno || matrizExistente.area_terreno,
            area_construida: predioParcial.nueva_area_construida || matrizExistente.area_construida,
            avaluo: predioParcial.nuevo_avaluo || matrizExistente.avaluo,
            es_matriz_ajustado: true,
          }, ...prediosInscribirOrdenados];
        }
      }
      
      const dataToSend = {
        tipo: 'M2',
        subtipo: m2Data.subtipo,
        municipio: m2Data.municipio,
        radicado: m2Data.radicado,
        solicitante: m2Data.solicitante,
        predios_cancelados: m2Data.predios_cancelados,
        predios_inscritos: prediosInscribirOrdenados,
        observaciones: m2Data.observaciones || '',
        texto_considerando: m2Data.texto_considerando || ''
      };
      
      // Para ENGLOBE: usar el predio_resultante como único predio inscrito
      if (m2Data.subtipo === 'englobe' && m2Data.predio_resultante) {
        dataToSend.predios_inscritos = [m2Data.predio_resultante];
      }
      
      const response = await axios.post(`${API}/solicitudes-mutacion`, dataToSend, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        // Verificar si fue aprobación directa o quedó pendiente
        if (response.data.aprobacion_directa && response.data.pdf_url) {
          toast.success(`Resolución ${response.data.numero_resolucion} generada exitosamente`);
          
          // IMPORTANTE: Confirmar el uso de los códigos homologados reservados
          if (codigosReservados.length > 0) {
            await confirmarUsoCodigos(codigosReservados);
            setCodigosReservados([]);
          }
          
          // Mostrar PDF en popup
          const pdfFullUrl = `${process.env.REACT_APP_BACKEND_URL}${response.data.pdf_url}`;
          setPdfViewerData({
            url: pdfFullUrl,
            title: `Resolución ${response.data.numero_resolucion} - ${m2Data.subtipo === 'desengloble' ? 'Desenglobe' : 'Englobe'}`,
            fileName: `Resolucion_${response.data.numero_resolucion.replace(/\//g, '-')}.pdf`,
            resolucionId: response.data.id,
            radicado: m2Data.radicado,
            correoSolicitante: ''
          });
          setEmailSent(false);
          setShowPDFViewer(true);
        } else {
          // Quedó pendiente de aprobación
          toast.success(`Solicitud ${response.data.radicado} creada exitosamente. Pendiente de aprobación.`);
        }
        
        // Limpiar formulario
        resetFormularioM2();
        setShowMutacionDialog(false);
        setTipoMutacionSeleccionado(null);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error generando resolución');
      // No liberamos los códigos aquí porque el usuario puede reintentar
    } finally {
      setGenerando(false);
    }
  };

  // Reset formulario M2
  const resetFormularioM2 = () => {
    // Liberar códigos reservados no utilizados antes de limpiar
    if (codigosReservados.length > 0) {
      liberarCodigosReservados();
    }
    
    setM2Data({
      subtipo: '',
      municipio: '',
      radicado: '',
      solicitante: { nombre: '', documento: '', tipo_documento: 'C' },
      predios_cancelados: [],
      predios_inscritos: [],
      documentos_soporte: [],
      tipo_englobe: '',
      predio_matriz_id: null,
      predio_resultante: null
    });
    setSearchPredio('');
    setSearchResults([]);
    setCodigosReservados([]);
  };

  // =====================
  // FUNCIONES PARA M3
  // =====================
  
  // Buscar predios para M3
  const buscarPrediosM3 = async () => {
    if (!searchPredioM3 || searchPredioM3.length < 3) {
      toast.error('Ingrese al menos 3 caracteres para buscar');
      return;
    }
    
    setSearchingPrediosM3(true);
    try {
      const token = localStorage.getItem('token');
      const municipioNombre = MUNICIPIOS.find(m => m.codigo === m3Data.municipio)?.nombre || '';
      
      // Obtener vigencia actual
      const statsResponse = await axios.get(`${API}/predios/stats/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const vigenciaActual = statsResponse.data.vigencia_actual;
      
      const response = await axios.get(`${API}/predios`, {
        params: { 
          search: searchPredioM3,
          municipio: municipioNombre,
          vigencia: vigenciaActual,
          limit: 20
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSearchResultsM3(response.data.predios || []);
      if (response.data.predios?.length === 0) {
        toast.info('No se encontraron predios con ese criterio');
      }
    } catch (error) {
      toast.error('Error buscando predios');
      console.error(error);
    } finally {
      setSearchingPrediosM3(false);
    }
  };

  // Seleccionar predio para M3
  const seleccionarPredioM3 = (predio) => {
    setM3Data(prev => ({
      ...prev,
      predio: predio,
      destino_anterior: predio.destino_economico || '',
      avaluo_anterior: predio.avaluo || 0
    }));
    setSearchResultsM3([]);
    setSearchPredioM3('');
  };

  // Buscar radicados para M3
  const buscarRadicadosM3 = async (query) => {
    if (query.length < 3) {
      setRadicadosDisponiblesM3([]);
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/resoluciones/radicados-disponibles`, {
        params: { busqueda: query },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setRadicadosDisponiblesM3(response.data.radicados || []);
    } catch (error) {
      console.error('Error buscando radicados M3:', error);
    }
  };

  // Agregar construcción nueva para M3
  const agregarConstruccionM3 = () => {
    setM3Data(prev => ({
      ...prev,
      construcciones_nuevas: [...prev.construcciones_nuevas, {
        tipo_construccion: 'C',
        pisos: 1,
        habitaciones: 0,
        banos: 0,
        locales: 0,
        uso: '',
        puntaje: 0,
        area_construida: 0
      }]
    }));
  };

  // Actualizar construcción M3
  const actualizarConstruccionM3 = (index, campo, valor) => {
    setM3Data(prev => ({
      ...prev,
      construcciones_nuevas: prev.construcciones_nuevas.map((c, i) => 
        i === index ? { ...c, [campo]: valor } : c
      )
    }));
  };

  // Eliminar construcción M3
  const eliminarConstruccionM3 = (index) => {
    setM3Data(prev => ({
      ...prev,
      construcciones_nuevas: prev.construcciones_nuevas.filter((_, i) => i !== index)
    }));
  };

  // Generar resolución M3
  const generarResolucionM3 = async () => {
    // Validaciones
    if (!m3Data.predio) {
      toast.error('Seleccione un predio');
      return;
    }
    if (!m3Data.subtipo) {
      toast.error('Seleccione el tipo de mutación M3');
      return;
    }
    if (!m3Data.radicado) {
      toast.error('Seleccione un radicado');
      return;
    }
    if (m3Data.subtipo === 'cambio_destino' && !m3Data.destino_nuevo) {
      toast.error('Seleccione el nuevo destino económico');
      return;
    }
    if (m3Data.subtipo === 'incorporacion_construccion' && m3Data.construcciones_nuevas.length === 0) {
      toast.error('Agregue al menos una construcción');
      return;
    }
    if (!m3Data.avaluo_nuevo || m3Data.avaluo_nuevo <= 0) {
      toast.error('Ingrese el nuevo avalúo');
      return;
    }
    
    setGenerando(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/solicitudes-mutacion`, {
        tipo: 'M3',
        subtipo: m3Data.subtipo,
        municipio: m3Data.municipio,
        radicado: m3Data.radicado,
        predio_id: m3Data.predio.id,
        destino_anterior: m3Data.destino_anterior,
        destino_nuevo: m3Data.destino_nuevo,
        construcciones_nuevas: m3Data.construcciones_nuevas,
        avaluo_anterior: m3Data.avaluo_anterior,
        avaluo_nuevo: m3Data.avaluo_nuevo,
        fechas_inscripcion: m3Data.fechas_inscripcion || [],
        observaciones: m3Data.observaciones || '',
        solicitante: m3Data.solicitante || { nombre: '', documento: '' },
        texto_considerando: m3Data.texto_considerando || ''
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        // Verificar si fue aprobación directa o quedó pendiente
        if (response.data.aprobacion_directa && response.data.pdf_url) {
          toast.success(`Resolución ${response.data.numero_resolucion} generada exitosamente`);
          
          // Mostrar PDF en popup
          const pdfFullUrl = `${process.env.REACT_APP_BACKEND_URL}${response.data.pdf_url}`;
          setPdfViewerData({
            url: pdfFullUrl,
            title: `Resolución M3 - ${response.data.numero_resolucion}`,
            fileName: `Resolucion_M3_${response.data.numero_resolucion.replace(/\//g, '-')}.pdf`,
            resolucionId: response.data.id,
            radicado: m3Data.radicado,
            correoSolicitante: ''
          });
          setEmailSent(false);
          setShowPDFViewer(true);
        } else {
          // Quedó pendiente de aprobación
          toast.success(`Solicitud ${response.data.radicado} creada exitosamente. Pendiente de aprobación.`);
        }
        
        // Limpiar formulario
        resetFormularioM3();
        setShowMutacionDialog(false);
        setTipoMutacionSeleccionado(null);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error generando resolución M3');
    } finally {
      setGenerando(false);
    }
  };

  // Reset formulario M3
  const resetFormularioM3 = () => {
    setM3Data({
      subtipo: '',
      municipio: '',
      radicado: '',
      predio: null,
      destino_anterior: '',
      destino_nuevo: '',
      construcciones_nuevas: [],
      avaluo_anterior: 0,
      avaluo_nuevo: 0,
      fechas_inscripcion: [{ año: new Date().getFullYear(), avaluo: '', avaluo_source: 'manual' }],
      observaciones: ''
    });
    setSearchPredioM3('');
    setSearchResultsM3([]);
    setRadicadosDisponiblesM3([]);
  };

  // Funciones para manejar fechas de inscripción en M3
  const agregarFechaInscripcionM3 = () => {
    setM3Data(prev => ({
      ...prev,
      fechas_inscripcion: [...prev.fechas_inscripcion, { año: '', avaluo: '', avaluo_source: 'manual' }]
    }));
  };

  const eliminarFechaInscripcionM3 = (index) => {
    if (m3Data.fechas_inscripcion.length > 1) {
      setM3Data(prev => ({
        ...prev,
        fechas_inscripcion: prev.fechas_inscripcion.filter((_, i) => i !== index)
      }));
    }
  };

  const actualizarFechaInscripcionM3 = async (index, campo, valor) => {
    const nuevasFechas = [...m3Data.fechas_inscripcion];
    if (!nuevasFechas[index]) {
      nuevasFechas[index] = { año: '', avaluo: '', avaluo_source: 'manual' };
    }
    nuevasFechas[index][campo] = valor;
    
    // Si se cambió el año, intentar cargar avalúo del sistema
    if (campo === 'año' && valor && m3Data.predio) {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API}/predios/${m3Data.predio.id}/avaluo-vigencia/${valor}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data.avaluo) {
          nuevasFechas[index].avaluo = response.data.avaluo;
          nuevasFechas[index].avaluo_source = response.data.source || 'sistema';
        }
      } catch (error) {
        // Silently fail - user can enter manually
      }
    }
    
    setM3Data(prev => ({ ...prev, fechas_inscripcion: nuevasFechas }));
  };

  // ==========================================
  // FUNCIONES PARA M4 - Revisión de Avalúo / Autoestimación
  // ==========================================

  // Buscar predios para M4
  const buscarPrediosM4 = async () => {
    if (!searchPredioM4 || searchPredioM4.length < 3) {
      toast.error('Ingrese al menos 3 caracteres para buscar');
      return;
    }
    
    setSearchingPrediosM4(true);
    try {
      const token = localStorage.getItem('token');
      const municipioNombre = MUNICIPIOS.find(m => m.codigo === m4Data.municipio)?.nombre || '';
      
      const statsResponse = await axios.get(`${API}/predios/stats/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const vigenciaActual = statsResponse.data.vigencia_actual;
      
      const response = await axios.get(`${API}/predios`, {
        params: { 
          search: searchPredioM4,
          municipio: municipioNombre,
          vigencia: vigenciaActual,
          limit: 20
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSearchResultsM4(response.data.predios || []);
      if (response.data.predios?.length === 0) {
        toast.info('No se encontraron predios con ese criterio');
      }
    } catch (error) {
      toast.error('Error buscando predios');
      console.error(error);
    } finally {
      setSearchingPrediosM4(false);
    }
  };

  // Seleccionar predio para M4
  const seleccionarPredioM4 = (predio) => {
    setM4Data(prev => ({
      ...prev,
      predio: predio,
      avaluo_anterior: predio.avaluo || 0
    }));
    setSearchResultsM4([]);
    setSearchPredioM4('');
  };

  // Buscar radicados para M4
  const buscarRadicadosM4 = async (query) => {
    if (query.length < 3) {
      setRadicadosDisponiblesM4([]);
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/resoluciones/radicados-disponibles`, {
        params: { busqueda: query },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setRadicadosDisponiblesM4(response.data.radicados || []);
    } catch (error) {
      console.error('Error buscando radicados M4:', error);
    }
  };

  // Generar resolución M4
  const generarResolucionM4 = async () => {
    // Validaciones
    if (!m4Data.predio) {
      toast.error('Debe seleccionar un predio');
      return;
    }
    if (!m4Data.subtipo) {
      toast.error('Debe seleccionar el tipo de solicitud');
      return;
    }
    if (!m4Data.radicado) {
      toast.error('Debe ingresar un número de radicado');
      return;
    }
    if (!m4Data.avaluo_nuevo || m4Data.avaluo_nuevo <= 0) {
      toast.error('Debe ingresar el nuevo avalúo');
      return;
    }
    if (m4Data.subtipo === 'revision_avaluo' && !m4Data.motivo_solicitud) {
      toast.error('Debe ingresar el motivo de la solicitud de revisión');
      return;
    }
    if (m4Data.subtipo === 'autoestimacion' && !m4Data.perito_avaluador) {
      toast.error('Debe ingresar el nombre del perito avaluador');
      return;
    }

    setGenerando(true);
    try {
      const token = localStorage.getItem('token');
      // Usar solicitante del formulario, o del predio como fallback
      const propietarios = m4Data.predio.propietarios || [];
      const solicitanteFallback = propietarios.length > 0 
        ? { nombre: propietarios[0].nombre_propietario || '', documento: propietarios[0].numero_documento || '' }
        : { nombre: '', documento: '' };
      
      const solicitanteFinal = (m4Data.solicitante?.nombre) 
        ? m4Data.solicitante 
        : solicitanteFallback;

      const payload = {
        tipo: 'M4',
        subtipo: m4Data.subtipo,
        decision: m4Data.decision,
        municipio: m4Data.municipio,
        radicado: m4Data.radicado,
        predio_id: m4Data.predio.id,
        codigo_predial: m4Data.predio.codigo_predial_nacional || m4Data.predio.NPN || '',
        predio_direccion: m4Data.predio.direccion || '',
        solicitante: solicitanteFinal,
        avaluo_anterior: m4Data.avaluo_anterior,
        avaluo_nuevo: m4Data.avaluo_nuevo,
        valor_autoestimado: m4Data.subtipo === 'autoestimacion' ? m4Data.avaluo_nuevo : null,
        motivo_solicitud: m4Data.motivo_solicitud,
        observaciones: m4Data.observaciones,
        perito_avaluador: m4Data.subtipo === 'autoestimacion' ? m4Data.perito_avaluador : null,
        texto_considerando: m4Data.texto_considerando || ''
      };

      const response = await axios.post(`${API}/solicitudes-mutacion`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        toast.success(response.data.mensaje || 'Solicitud M4 procesada exitosamente');
        
        if (response.data.pdf_url) {
          const pdfFullUrl = `${process.env.REACT_APP_BACKEND_URL}${response.data.pdf_url}`;
          setPdfViewerData({
            url: pdfFullUrl,
            title: `Resolución ${response.data.numero_resolucion}`,
            numero: response.data.numero_resolucion
          });
          setShowPDFViewer(true);
        }
        
        resetFormularioM4();
        cargarHistorialResoluciones();
      } else {
        toast.error(response.data.mensaje || 'Error al procesar la solicitud');
      }
    } catch (error) {
      console.error('Error generando M4:', error);
      toast.error(error.response?.data?.detail || 'Error al generar la resolución M4');
    } finally {
      setGenerando(false);
    }
  };

  // Reset formulario M4
  const resetFormularioM4 = () => {
    setM4Data({
      subtipo: '',
      decision: 'aceptar',
      municipio: '',
      radicado: '',
      predio: null,
      avaluo_anterior: 0,
      avaluo_nuevo: 0,
      valor_autoestimado: 0,
      motivo_solicitud: '',
      observaciones: '',
      perito_avaluador: ''
    });
    setSearchPredioM4('');
    setSearchResultsM4([]);
    setRadicadosDisponiblesM4([]);
  };

  // ===== FUNCIONES PARA M5 - CANCELACIÓN / INSCRIPCIÓN =====
  
  // Buscar radicados disponibles para M5
  const buscarRadicadosM5 = async (query) => {
    if (query.length < 3) {
      setRadicadosDisponiblesM5([]);
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/resoluciones/radicados-disponibles`, {
        params: { busqueda: query },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setRadicadosDisponiblesM5(response.data.radicados || []);
    } catch (error) {
      console.error('Error buscando radicados M5:', error);
    }
  };

  // Buscar predios para M5 (cancelación)
  const buscarPrediosM5 = async () => {
    if (!m5Data.municipio) {
      toast.warning('Seleccione un municipio primero');
      return;
    }
    if (searchPredioM5.length < 3) {
      toast.warning('Ingrese al menos 3 caracteres para buscar');
      return;
    }
    
    setSearchingPrediosM5(true);
    try {
      const token = localStorage.getItem('token');
      const codigoMunicipio = MUNICIPIOS.find(m => m.nombre === m5Data.municipio)?.codigo;
      
      // Usar el endpoint buscar-municipio que tiene la lógica correcta de búsqueda
      const response = await axios.get(`${API}/predios/buscar-municipio/${codigoMunicipio}`, {
        params: { 
          q: searchPredioM5,
          limit: 20
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSearchResultsM5(response.data.predios || response.data || []);
    } catch (error) {
      console.error('Error buscando predios:', error);
      toast.error('Error al buscar predios');
    } finally {
      setSearchingPrediosM5(false);
    }
  };

  // Seleccionar predio para M5
  const seleccionarPredioM5 = (predio) => {
    setM5Data(prev => ({
      ...prev,
      predio: predio
    }));
    setSearchResultsM5([]);
    setSearchPredioM5('');
  };

  // Generar resolución M5
  const generarResolucionM5 = async () => {
    // Validaciones
    if (!m5Data.subtipo) {
      toast.error('Debe seleccionar el tipo de solicitud (Cancelación o Inscripción)');
      return;
    }
    if (!m5Data.municipio) {
      toast.error('Debe seleccionar un municipio');
      return;
    }
    if (!m5Data.radicado) {
      toast.error('Debe ingresar un número de radicado');
      return;
    }
    if (!m5Data.predio) {
      toast.error('Debe seleccionar/ingresar los datos del predio');
      return;
    }
    if (!m5Data.vigencia || m5Data.vigencia < 2000) {
      toast.error('Debe ingresar una vigencia válida');
      return;
    }
    if (m5Data.es_doble_inscripcion && !m5Data.codigo_predio_duplicado) {
      toast.error('Debe ingresar el código del predio con el que está duplicado');
      return;
    }

    setGenerando(true);
    try {
      const token = localStorage.getItem('token');
      
      // Extraer solicitante del predio
      const propietarios = m5Data.predio.propietarios || [];
      const solicitante = propietarios.length > 0 
        ? { nombre: propietarios[0].nombre_propietario || propietarios[0].nombre || 'No especificado', documento: propietarios[0].numero_documento || '' }
        : { nombre: 'No especificado', documento: '' };

      const payload = {
        tipo: 'M5',
        subtipo: m5Data.subtipo,
        municipio: m5Data.municipio,
        radicado: m5Data.radicado,
        solicitante: solicitante,
        motivo_solicitud: m5Data.motivo_solicitud || 'Solicitud de trámite catastral',
        vigencia_cancelacion: m5Data.subtipo === 'cancelacion' ? m5Data.vigencia : null,
        vigencia_inscripcion: m5Data.subtipo === 'inscripcion' ? m5Data.vigencia : null,
        es_doble_inscripcion: m5Data.es_doble_inscripcion,
        codigo_predio_duplicado: m5Data.codigo_predio_duplicado,
        predio_m5: m5Data.predio,
        observaciones: m5Data.observaciones,
        texto_considerando: m5Data.texto_considerando || ''
      };

      const response = await axios.post(`${API}/solicitudes-mutacion`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        toast.success(response.data.mensaje || 'Solicitud M5 procesada exitosamente');
        
        if (response.data.pdf_url) {
          const pdfFullUrl = `${process.env.REACT_APP_BACKEND_URL}${response.data.pdf_url}`;
          setPdfViewerData({
            url: pdfFullUrl,
            title: `Resolución ${response.data.numero_resolucion}`,
            numero: response.data.numero_resolucion
          });
          setShowPdfViewer(true);
        }
        
        // Limpiar formulario
        resetM5Form();
        setShowMutacionDialog(false);
      } else {
        toast.error(response.data.mensaje || 'Error al procesar la solicitud');
      }
    } catch (error) {
      console.error('Error generando resolución M5:', error);
      toast.error(error.response?.data?.detail || 'Error al generar la resolución');
    } finally {
      setGenerando(false);
    }
  };

  // Reset formulario M5
  const resetM5Form = () => {
    setM5Data({
      subtipo: '',
      municipio: '',
      radicado: '',
      predio: null,
      vigencia: new Date().getFullYear(),
      motivo_solicitud: '',
      es_doble_inscripcion: false,
      codigo_predio_duplicado: '',
      observaciones: ''
    });
    setSearchPredioM5('');
    setSearchResultsM5([]);
    setRadicadosDisponiblesM5([]);
  };

  // =====================
  // FUNCIONES PARA RECTIFICACIÓN DE ÁREA
  // =====================

  // Buscar radicados para Rectificación de Área
  const buscarRadicadosRectificacion = async (query) => {
    if (query.length < 3) {
      setRadicadosDisponiblesRectificacion([]);
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/resoluciones/radicados-disponibles`, {
        params: { busqueda: query },
        headers: { Authorization: `Bearer ${token}` }
      });
      setRadicadosDisponiblesRectificacion(response.data.radicados || []);
    } catch (error) {
      console.error('Error buscando radicados Rectificación:', error);
    }
  };

  // Buscar predios para Rectificación de Área
  const buscarPrediosRectificacion = async () => {
    if (!rectificacionData.municipio) {
      toast.error('Primero seleccione un municipio');
      return;
    }
    if (searchPredioRectificacion.length < 3) {
      toast.error('Ingrese al menos 3 caracteres para buscar');
      return;
    }
    
    setSearchingPrediosRectificacion(true);
    try {
      const token = localStorage.getItem('token');
      const codigoMunicipio = MUNICIPIOS.find(m => m.nombre === rectificacionData.municipio)?.codigo;
      
      // Usar el endpoint buscar-municipio que tiene la lógica correcta de búsqueda por matrícula
      const response = await axios.get(`${API}/predios/buscar-municipio/${codigoMunicipio}`, {
        params: { 
          q: searchPredioRectificacion,
          limit: 20
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      setSearchResultsRectificacion(response.data.predios || []);
      if (!response.data.predios?.length) {
        toast.info('No se encontraron predios');
      }
    } catch (error) {
      console.error('Error buscando predios:', error);
      toast.error('Error al buscar predios');
    } finally {
      setSearchingPrediosRectificacion(false);
    }
  };

  // Seleccionar predio para Rectificación de Área
  const seleccionarPredioRectificacion = (predio) => {
    // Obtener áreas desde R1 si existe
    const r1 = predio.r1_registros?.[0] || {};
    const areaTerrenoActual = r1.area_terreno || predio.area_terreno || 0;
    const areaConstruidaActual = r1.area_construida || predio.area_construida || 0;
    const avaluoActual = r1.avaluo || predio.avaluo || 0;
    
    // Cargar zonas de terreno existentes del predio (si existen)
    const zonasExistentes = r1.zonas_homogeneas || predio.zonas_homogeneas || predio.zonas_terreno || [];
    if (zonasExistentes.length > 0) {
      setZonasTerreno_Rect_Anterior(zonasExistentes.map(z => ({
        zona_fisica: z.zona_fisica || z.zona || '',
        zona_economica: z.zona_economica || '',
        area_terreno: z.area_terreno || z.area || '0'
      })));
      // Inicializar las nuevas con los mismos valores
      setZonasTerreno_Rect_Nueva(zonasExistentes.map(z => ({
        zona_fisica: z.zona_fisica || z.zona || '',
        zona_economica: z.zona_economica || '',
        area_terreno: z.area_terreno || z.area || '0'
      })));
    } else {
      // Si no hay zonas, crear una zona con el área total
      setZonasTerreno_Rect_Anterior([{ zona_fisica: '', zona_economica: '', area_terreno: String(areaTerrenoActual) }]);
      setZonasTerreno_Rect_Nueva([{ zona_fisica: '', zona_economica: '', area_terreno: String(areaTerrenoActual) }]);
    }
    
    // Cargar construcciones existentes del predio (si existen)
    const construccionesExistentes = r1.construcciones || predio.construcciones || [];
    if (construccionesExistentes.length > 0) {
      const constFormateadas = construccionesExistentes.map((c, i) => ({
        id: c.id || String.fromCharCode(65 + i),
        piso: String(c.piso || c.pisos || '0'),
        habitaciones: String(c.habitaciones || '0'),
        banos: String(c.banos || '0'),
        locales: String(c.locales || '0'),
        tipificacion: c.tipificacion || '',
        uso: c.uso || '',
        puntaje: String(c.puntaje || '0'),
        area_construida: String(c.area_construida || '0')
      }));
      setConstrucciones_Rect_Anterior(constFormateadas);
      setConstrucciones_Rect_Nueva(constFormateadas.map(c => ({ ...c })));
    } else if (areaConstruidaActual > 0) {
      // Si hay área construida pero no detalle de construcciones
      const constDefault = [{
        id: 'A', piso: '0', habitaciones: '0', banos: '0', locales: '0',
        tipificacion: '', uso: '', puntaje: '0', area_construida: String(areaConstruidaActual)
      }];
      setConstrucciones_Rect_Anterior(constDefault);
      setConstrucciones_Rect_Nueva(constDefault.map(c => ({ ...c })));
    } else {
      // Sin construcciones
      setConstrucciones_Rect_Anterior([]);
      setConstrucciones_Rect_Nueva([{
        id: 'A', piso: '0', habitaciones: '0', banos: '0', locales: '0',
        tipificacion: '', uso: '', puntaje: '0', area_construida: '0'
      }]);
    }
    
    setRectificacionData(prev => ({
      ...prev,
      predio: predio,
      area_terreno_anterior: areaTerrenoActual,
      area_terreno_nueva: areaTerrenoActual, // Iniciar con el mismo valor
      area_construida_anterior: areaConstruidaActual,
      area_construida_nueva: areaConstruidaActual, // Iniciar con el mismo valor
      avaluo_nuevo: avaluoActual // Iniciar con el mismo valor
    }));
    setSearchPredioRectificacion('');
    setSearchResultsRectificacion([]);
  };

  // Funciones para zonas de terreno en Rectificación
  const agregarZonaTerreno_Rect = () => {
    setZonasTerreno_Rect_Nueva(prev => [...prev, { zona_fisica: '', zona_economica: '', area_terreno: '0' }]);
  };

  const eliminarZonaTerreno_Rect = (index) => {
    if (zonasTerreno_Rect_Nueva.length > 1) {
      setZonasTerreno_Rect_Nueva(prev => prev.filter((_, i) => i !== index));
    }
  };

  const actualizarZonaTerreno_Rect = (index, campo, valor) => {
    setZonasTerreno_Rect_Nueva(prev => {
      const nuevas = [...prev];
      nuevas[index] = { ...nuevas[index], [campo]: valor };
      return nuevas;
    });
  };

  // Funciones para construcciones en Rectificación
  const agregarConstruccion_Rect = () => {
    setConstrucciones_Rect_Nueva(prev => {
      const nextId = String.fromCharCode(65 + prev.length);
      return [...prev, {
        id: nextId, piso: '0', habitaciones: '0', banos: '0', locales: '0',
        tipificacion: '', uso: '', puntaje: '0', area_construida: '0'
      }];
    });
  };

  const eliminarConstruccion_Rect = (index) => {
    if (construcciones_Rect_Nueva.length > 1) {
      setConstrucciones_Rect_Nueva(prev => {
        const nuevas = prev.filter((_, i) => i !== index);
        return nuevas.map((c, i) => ({ ...c, id: String.fromCharCode(65 + i) }));
      });
    }
  };

  const actualizarConstruccion_Rect = (index, campo, valor) => {
    setConstrucciones_Rect_Nueva(prev => {
      const nuevas = [...prev];
      nuevas[index] = { ...nuevas[index], [campo]: valor };
      return nuevas;
    });
  };

  // Calcular totales para Rectificación de Área
  const calcularTotales_Rect = () => {
    const areaTerrenoNueva = zonasTerreno_Rect_Nueva.reduce((sum, z) => sum + (parseFloat(z.area_terreno) || 0), 0);
    const areaConstruidaNueva = construcciones_Rect_Nueva.reduce((sum, c) => sum + (parseFloat(c.area_construida) || 0), 0);
    return { areaTerrenoNueva, areaConstruidaNueva };
  };

  // Generar resolución de Rectificación de Área
  const generarResolucionRectificacion = async () => {
    // Calcular totales desde las zonas y construcciones
    const totales = calcularTotales_Rect();
    
    // Validaciones
    if (!rectificacionData.municipio) {
      toast.error('Debe seleccionar un municipio');
      return;
    }
    if (!rectificacionData.radicado) {
      toast.error('Debe ingresar un número de radicado');
      return;
    }
    if (!rectificacionData.predio) {
      toast.error('Debe seleccionar un predio');
      return;
    }
    if (totales.areaTerrenoNueva <= 0) {
      toast.error('Debe ingresar al menos una zona de terreno con área mayor a 0');
      return;
    }

    setGenerando(true);
    try {
      const token = localStorage.getItem('token');
      
      // Extraer solicitante del predio
      const propietarios = rectificacionData.predio.propietarios || 
                          rectificacionData.predio.r2_registros?.[0]?.propietarios || [];
      const solicitante = propietarios.length > 0 
        ? { 
            nombre: propietarios[0].nombre_propietario || propietarios[0].nombre || 'No especificado', 
            documento: propietarios[0].numero_documento || '' 
          }
        : { nombre: 'No especificado', documento: '' };

      const payload = {
        tipo: 'RECTIFICACION_AREA',
        subtipo: 'rectificacion_area',
        municipio: rectificacionData.municipio,
        radicado: rectificacionData.radicado,
        solicitante: solicitante,
        predio_id: rectificacionData.predio.id,
        predio_rectificacion: rectificacionData.predio,
        area_terreno_anterior: parseFloat(rectificacionData.area_terreno_anterior) || 0,
        area_terreno_nueva: totales.areaTerrenoNueva,
        area_construida_anterior: parseFloat(rectificacionData.area_construida_anterior) || 0,
        area_construida_nueva: totales.areaConstruidaNueva,
        avaluo_anterior: rectificacionData.predio.avaluo || 0,
        avaluo_nuevo: parseFloat(rectificacionData.avaluo_nuevo) || rectificacionData.predio.avaluo || 0,
        motivo_solicitud: rectificacionData.motivo_solicitud || 'Rectificación de área catastral',
        observaciones: rectificacionData.observaciones,
        texto_considerando: rectificacionData.texto_considerando || '',
        // Datos detallados de zonas y construcciones (para R2)
        zonas_terreno_anteriores: zonasTerreno_Rect_Anterior,
        zonas_terreno_nuevas: zonasTerreno_Rect_Nueva,
        construcciones_anteriores: construcciones_Rect_Anterior,
        construcciones_nuevas: construcciones_Rect_Nueva
      };

      const response = await axios.post(`${API}/solicitudes-mutacion`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        toast.success(response.data.mensaje || 'Solicitud de Rectificación de Área procesada exitosamente');
        
        if (response.data.pdf_url) {
          const pdfFullUrl = `${process.env.REACT_APP_BACKEND_URL}${response.data.pdf_url}`;
          setPdfViewerData({
            url: pdfFullUrl,
            title: `Resolución ${response.data.numero_resolucion}`,
            fileName: `Resolucion_Rectificacion_Area_${response.data.numero_resolucion?.replace(/\//g, '-') || 'N'}.pdf`,
            resolucionId: response.data.id,
            radicado: rectificacionData.radicado
          });
          setEmailSent(false);
          setShowPDFViewer(true);
        }
        
        // Limpiar formulario
        resetRectificacionForm();
        setShowMutacionDialog(false);
      } else {
        toast.error(response.data.mensaje || 'Error al procesar la solicitud');
      }
    } catch (error) {
      console.error('Error generando resolución Rectificación de Área:', error);
      toast.error(error.response?.data?.detail || 'Error al generar la resolución');
    } finally {
      setGenerando(false);
    }
  };

  // Reset formulario Rectificación de Área
  const resetRectificacionForm = () => {
    setRectificacionData({
      municipio: '',
      radicado: '',
      predio: null,
      area_terreno_anterior: 0,
      area_terreno_nueva: 0,
      area_construida_anterior: 0,
      area_construida_nueva: 0,
      avaluo_nuevo: 0,
      motivo_solicitud: '',
      observaciones: '',
      texto_considerando: ''
    });
    setSearchPredioRectificacion('');
    setSearchResultsRectificacion([]);
    setRadicadosDisponiblesRectificacion([]);
    setZonasTerreno_Rect_Anterior([]);
    setZonasTerreno_Rect_Nueva([{ zona_fisica: '', zona_economica: '', area_terreno: '0' }]);
    setConstrucciones_Rect_Anterior([]);
    setConstrucciones_Rect_Nueva([{
      id: 'A', piso: '0', habitaciones: '0', banos: '0', locales: '0',
      tipificacion: '', uso: '', puntaje: '0', area_construida: '0'
    }]);
  };

  // Generar resolución de Complementación de Información
  const generarResolucionComplementacion = async () => {
    if (!complementacionData.predio) {
      toast.error('Debe seleccionar un predio');
      return;
    }

    setGenerando(true);
    try {
      const predio = complementacionData.predio;
      const areaTerreno = predio.area_terreno || predio.r1_registros?.[0]?.area_terreno || 0;
      const areaConstruida = predio.area_construida || predio.r1_registros?.[0]?.area_construida || 0;
      const avaluo = predio.avaluo || predio.r1_registros?.[0]?.avaluo || 0;

      const payload = {
        tipo_mutacion: 'COMPLEMENTACION',
        municipio: complementacionData.municipio,
        predio: predio,
        solicitante: {
          nombre: predio.nombre_propietario || predio.propietarios?.[0]?.nombre_propietario || '',
          documento: predio.numero_documento || predio.propietarios?.[0]?.numero_documento || ''
        },
        area_terreno_anterior: areaTerreno,
        area_construida_anterior: areaConstruida,
        avaluo_anterior: avaluo,
        area_terreno_nueva: complementacionData.area_terreno_nueva,
        area_construida_nueva: complementacionData.area_construida_nueva,
        avaluo_nuevo: complementacionData.avaluo_nuevo,
        documentos_soporte: complementacionData.documentos_soporte,
        observaciones: complementacionData.observaciones,
        texto_considerando: complementacionData.texto_considerando || ''
      };

      const response = await axios.post(
        `${API_URL}/api/solicitudes-mutacion`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.exito) {
        toast.success(response.data.mensaje || 'Solicitud de Complementación procesada exitosamente');
        resetComplementacionForm();
        setTipoMutacionSeleccionado(null);
        setActiveTab('historial');
        cargarSolicitudesPendientes();
      } else {
        toast.error(response.data.mensaje || 'Error al procesar la solicitud');
      }
    } catch (error) {
      console.error('Error generando resolución Complementación:', error);
      toast.error(error.response?.data?.detail || 'Error al generar la resolución');
    } finally {
      setGenerando(false);
    }
  };

  // Reset formulario Complementación
  const resetComplementacionForm = () => {
    setComplementacionData({
      municipio: '',
      radicado: '',
      predio: null,
      area_terreno_nueva: 0,
      area_construida_nueva: 0,
      avaluo_nuevo: 0,
      documentos_soporte: 'Oficio de solicitud, Cédula del propietario, Certificado de libertad y tradición',
      observaciones: '',
      texto_considerando: ''
    });
    setSearchPredioComplementacion('');
    setSearchResultsComplementacion([]);
    setRadicadosDisponiblesComplementacion([]);
  };

  // Construir código predial de 30 dígitos para M5
  const construirCodigoPredialM5 = () => {
    // Aplicar padding al construir el código completo
    const zona = (codigoManualM5.zona || '').padStart(2, '0');
    const sector = (codigoManualM5.sector || '').padStart(2, '0');
    const comuna = (codigoManualM5.comuna || '').padStart(2, '0');
    const barrio = (codigoManualM5.barrio || '').padStart(2, '0');
    const manzana = (codigoManualM5.manzana_vereda || '').padStart(4, '0');
    const terreno = (codigoManualM5.terreno || '').padStart(4, '0');
    const condicion = (codigoManualM5.condicion || '').padStart(1, '0');
    const edificio = (codigoManualM5.edificio || '').padStart(2, '0');
    const piso = (codigoManualM5.piso || '').padStart(2, '0');
    const unidad = (codigoManualM5.unidad || '').padStart(4, '0');
    return `${codigoMunicipioM5}${zona}${sector}${comuna}${barrio}${manzana}${terreno}${condicion}${edificio}${piso}${unidad}`;
  };

  // Manejar cambios en campos del código M5
  const handleCodigoChangeM5 = (campo, valor, maxLength) => {
    // Solo permitir números
    const soloNumeros = valor.replace(/[^0-9]/g, '');
    // Limitar al máximo de dígitos
    const valorFinal = soloNumeros.slice(0, maxLength);
    setCodigoManualM5(prev => ({ ...prev, [campo]: valorFinal }));
  };

  // Calcular áreas totales M5
  const calcularAreasTotalesM5 = () => {
    const areaTerrenoTotal = zonasTermenoM5.reduce((sum, z) => sum + (parseFloat(z.area_terreno) || 0), 0);
    const areaConstruidaTotal = construccionesM5.reduce((sum, c) => sum + (parseFloat(c.area_construida) || 0), 0);
    return { areaTerrenoTotal, areaConstruidaTotal };
  };

  // Funciones para propietarios M5
  const agregarPropietarioM5 = () => {
    setPropietariosM5([...propietariosM5, { nombre_propietario: '', tipo_documento: 'C', numero_documento: '', estado_civil: 'sin_especificar' }]);
  };
  const eliminarPropietarioM5 = (index) => {
    if (propietariosM5.length > 1) setPropietariosM5(propietariosM5.filter((_, i) => i !== index));
  };
  const actualizarPropietarioM5 = (index, campo, valor) => {
    setPropietariosM5(prev => { const n = [...prev]; n[index] = { ...n[index], [campo]: valor }; return n; });
  };

  // Funciones para zonas de terreno M5
  const agregarZonaTerrenoM5 = () => {
    setZonasTermenoM5([...zonasTermenoM5, { zona_fisica: '', zona_economica: '', area_terreno: '0' }]);
  };
  const eliminarZonaTerrenoM5 = (index) => {
    if (zonasTermenoM5.length > 1) setZonasTermenoM5(zonasTermenoM5.filter((_, i) => i !== index));
  };
  const actualizarZonaTerrenoM5 = (index, campo, valor) => {
    setZonasTermenoM5(prev => { const n = [...prev]; n[index] = { ...n[index], [campo]: valor }; return n; });
  };

  // Funciones para construcciones M5
  const generarIdConstruccionM5 = (index) => {
    if (index < 26) return String.fromCharCode(65 + index);
    const firstChar = String.fromCharCode(65 + Math.floor((index - 26) / 26));
    const secondChar = String.fromCharCode(65 + ((index - 26) % 26));
    return firstChar + secondChar;
  };
  const agregarConstruccionM5 = () => {
    const nuevoId = generarIdConstruccionM5(construccionesM5.length);
    setConstruccionesM5([...construccionesM5, { id: nuevoId, piso: '0', habitaciones: '0', banos: '0', locales: '0', tipificacion: '', uso: '', puntaje: '0', area_construida: '0' }]);
  };
  const eliminarConstruccionM5 = (index) => {
    if (construccionesM5.length > 1) {
      const nuevas = construccionesM5.filter((_, i) => i !== index).map((c, i) => ({ ...c, id: generarIdConstruccionM5(i) }));
      setConstruccionesM5(nuevas);
    }
  };
  const actualizarConstruccionM5 = (index, campo, valor) => {
    setConstruccionesM5(prev => { const n = [...prev]; n[index] = { ...n[index], [campo]: valor }; return n; });
  };

  // Obtener estructura del código según municipio M5
  const fetchEstructuraCodigoM5 = async () => {
    if (!m5Data.municipio) return;
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios/estructura-codigo/${m5Data.municipio}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEstructuraCodigoM5(res.data);
      setCodigoMunicipioM5(res.data.prefijo_fijo || '');
    } catch (error) {
      console.log('Error obteniendo estructura de código M5');
    }
  };

  // Obtener siguiente código homologado para M5
  const fetchSiguienteCodigoHomologadoM5 = async () => {
    if (!m5Data.municipio) return;
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/codigos-homologados/siguiente/${encodeURIComponent(m5Data.municipio)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSiguienteCodigoHomologadoM5(res.data);
    } catch (error) {
      console.error('Error obteniendo siguiente código homologado M5:', error);
      setSiguienteCodigoHomologadoM5(null);
    }
  };

  // Obtener última manzana del sector para M5
  const fetchUltimaManzanaM5 = async () => {
    if (!m5Data.municipio || !codigoManualM5.zona || !codigoManualM5.sector) return;
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ zona: codigoManualM5.zona, sector: codigoManualM5.sector });
      const res = await axios.get(`${API}/predios/ultima-manzana/${m5Data.municipio}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUltimaManzanaM5(res.data);
    } catch (error) {
      console.log('Error obteniendo última manzana M5');
      setUltimaManzanaM5(null);
    }
  };

  // Obtener predios en manzana para M5
  const fetchPrediosEnManzanaM5 = async () => {
    if (!m5Data.municipio || !codigoManualM5.manzana_vereda || codigoManualM5.manzana_vereda === '0000') {
      setPrediosEnManzanaM5([]);
      return;
    }
    setBuscandoPrediosManzanaM5(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        zona: codigoManualM5.zona,
        sector: codigoManualM5.sector,
        comuna: codigoManualM5.comuna,
        barrio: codigoManualM5.barrio,
        manzana_vereda: codigoManualM5.manzana_vereda,
        limit: 5
      });
      const res = await axios.get(`${API}/predios/por-manzana/${m5Data.municipio}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPrediosEnManzanaM5(res.data.predios || []);
      setSiguienteTerrenoSugeridoM5(res.data.siguiente_terreno || '0001');
    } catch (error) {
      console.log('Error buscando predios en manzana M5:', error);
      setPrediosEnManzanaM5([]);
      setSiguienteTerrenoSugeridoM5('0001');
    } finally {
      setBuscandoPrediosManzanaM5(false);
    }
  };

  // Sugerir siguiente código disponible para M5
  const fetchSugerenciaCodigoM5 = async () => {
    if (!m5Data.municipio || !codigoManualM5.zona || !codigoManualM5.manzana_vereda || codigoManualM5.manzana_vereda === '0000') return;
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        zona: codigoManualM5.zona,
        sector: codigoManualM5.sector,
        comuna: codigoManualM5.comuna,
        barrio: codigoManualM5.barrio,
        manzana_vereda: codigoManualM5.manzana_vereda
      });
      const res = await axios.get(`${API}/predios/sugerir-codigo/${m5Data.municipio}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTerrenoInfoM5(res.data);
      if (res.data.siguiente_terreno) {
        setCodigoManualM5(prev => ({ ...prev, terreno: res.data.siguiente_terreno }));
      }
    } catch (error) {
      console.log('Error obteniendo sugerencia de código M5');
    }
  };

  // Verificar código completo M5
  const verificarCodigoCompletoM5 = async () => {
    const codigoCompleto = construirCodigoPredialM5();
    if (codigoCompleto.length !== 30) {
      toast.error('El código debe tener exactamente 30 dígitos');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios/verificar-codigo-completo/${codigoCompleto}?municipio=${m5Data.municipio}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVerificacionCodigoM5(res.data);
    } catch (error) {
      toast.error('Error al verificar código');
    }
  };

  // Effects para M5
  useEffect(() => {
    if (showCrearPredioM5 && m5Data.municipio) {
      fetchEstructuraCodigoM5();
      fetchSiguienteCodigoHomologadoM5();
    }
  }, [showCrearPredioM5, m5Data.municipio]);

  useEffect(() => {
    if (showCrearPredioM5 && m5Data.municipio && codigoManualM5.zona && codigoManualM5.sector) {
      fetchUltimaManzanaM5();
    }
  }, [showCrearPredioM5, m5Data.municipio, codigoManualM5.zona, codigoManualM5.sector]);

  useEffect(() => {
    if (showCrearPredioM5 && m5Data.municipio && codigoManualM5.manzana_vereda && codigoManualM5.manzana_vereda !== '0000') {
      const timer = setTimeout(() => {
        fetchPrediosEnManzanaM5();
        fetchSugerenciaCodigoM5();
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setPrediosEnManzanaM5([]);
      setSiguienteTerrenoSugeridoM5('0001');
    }
  }, [showCrearPredioM5, m5Data.municipio, codigoManualM5.zona, codigoManualM5.sector, codigoManualM5.comuna, codigoManualM5.barrio, codigoManualM5.manzana_vereda]);

  // Reset formulario crear predio M5
  const resetCrearPredioM5 = () => {
    setCodigoManualM5({ zona: '00', sector: '00', comuna: '00', barrio: '00', manzana_vereda: '0000', terreno: '0001', condicion: '0', edificio: '00', piso: '00', unidad: '0000' });
    setPropietariosM5([{ nombre_propietario: '', tipo_documento: 'C', numero_documento: '', estado_civil: 'sin_especificar' }]);
    setZonasTermenoM5([{ zona_fisica: '', zona_economica: '', area_terreno: '0' }]);
    setConstruccionesM5([{ id: 'A', piso: '0', habitaciones: '0', banos: '0', locales: '0', tipificacion: '', uso: '', puntaje: '0', area_construida: '0' }]);
    setDatosR1M5({ matricula_inmobiliaria: '', direccion: '', destino_economico: 'A', avaluo: '' });
    setTabCrearPredioM5('ubicacion');
    setVerificacionCodigoM5(null);
    setTerrenoInfoM5(null);
  };

  // Guardar predio nuevo desde M5
  const guardarPredioNuevoM5 = async () => {
    // Validaciones básicas
    if (!m5Data.municipio) {
      toast.error('Seleccione un municipio primero');
      return;
    }
    if (!datosR1M5.direccion) {
      toast.error('La dirección es obligatoria');
      return;
    }
    if (!propietariosM5[0]?.nombre_propietario) {
      toast.error('El nombre del propietario es obligatorio');
      return;
    }

    const codigoCompleto = construirCodigoPredialM5();
    if (codigoCompleto.length !== 30) {
      toast.error(`El código predial debe tener 30 dígitos (actual: ${codigoCompleto.length})`);
      return;
    }

    const areas = calcularAreasTotalesM5();

    setGuardandoPredioM5(true);
    try {
      const token = localStorage.getItem('token');
      
      const predioPayload = {
        codigo_predial_nacional: codigoCompleto,
        municipio: m5Data.municipio,
        matricula_inmobiliaria: datosR1M5.matricula_inmobiliaria,
        direccion: datosR1M5.direccion,
        destino_economico: datosR1M5.destino_economico,
        area_terreno: areas.areaTerrenoTotal,
        area_construida: areas.areaConstruidaTotal,
        avaluo_catastral: parseFloat(datosR1M5.avaluo) || 0,
        propietarios: propietariosM5.filter(p => p.nombre_propietario),
        zonas_terreno: zonasTermenoM5.filter(z => parseFloat(z.area_terreno) > 0),
        construcciones: construccionesM5.filter(c => parseFloat(c.area_construida) > 0),
        codigo_homologado_asignado: siguienteCodigoHomologadoM5?.codigo || null,
        es_predio_nuevo: true,
        origen: 'M5_inscripcion'
      };

      const response = await axios.post(`${API}/predios/m5/crear`, predioPayload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.id) {
        toast.success('Predio creado exitosamente');
        
        // Seleccionar el predio recién creado para M5
        setM5Data(prev => ({
          ...prev,
          predio: {
            id: response.data.id,
            codigo_predial_nacional: codigoCompleto,
            codigo_homologado: response.data.codigo_homologado,
            matricula_inmobiliaria: datosR1M5.matricula_inmobiliaria,
            direccion: datosR1M5.direccion,
            destino_economico: datosR1M5.destino_economico,
            area_terreno: areas.areaTerrenoTotal,
            area_construida: areas.areaConstruidaTotal,
            avaluo: parseFloat(datosR1M5.avaluo) || 0,
            propietarios: propietariosM5.filter(p => p.nombre_propietario)
          }
        }));
        
        // Cerrar modal de creación
        setShowCrearPredioM5(false);
        resetCrearPredioM5();
      }
    } catch (error) {
      console.error('Error creando predio:', error);
      toast.error(error.response?.data?.detail || 'Error al crear el predio');
    } finally {
      setGuardandoPredioM5(false);
    }
  };

  // Catálogo de destinos económicos
  const DESTINOS_ECONOMICOS = [
    { codigo: 'A', nombre: 'A - Habitacional' },
    { codigo: 'B', nombre: 'B - Industrial' },
    { codigo: 'C', nombre: 'C - Comercial' },
    { codigo: 'D', nombre: 'D - Agropecuario' },
    { codigo: 'E', nombre: 'E - Minero' },
    { codigo: 'F', nombre: 'F - Cultural' },
    { codigo: 'G', nombre: 'G - Recreacional' },
    { codigo: 'H', nombre: 'H - Salubridad' },
    { codigo: 'I', nombre: 'I - Institucional' },
    { codigo: 'J', nombre: 'J - Educativo' },
    { codigo: 'K', nombre: 'K - Religioso' },
    { codigo: 'L', nombre: 'L - Agrícola' },
    { codigo: 'M', nombre: 'M - Pecuario' },
    { codigo: 'N', nombre: 'N - Agroindustrial' },
    { codigo: 'O', nombre: 'O - Forestal' },
    { codigo: 'P', nombre: 'P - Uso Público' },
    { codigo: 'Q', nombre: 'Q - Lote Urbanizable No Urbanizado' },
    { codigo: 'R', nombre: 'R - Lote Urbanizable No Edificado' },
    { codigo: 'S', nombre: 'S - Lote No Urbanizable' },
    { codigo: 'T', nombre: 'T - Servicios Especiales' }
  ];

  // Renderizar formulario M3
  const renderFormularioM3 = () => (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
      {/* Tipo de M3 */}
      <div className="grid grid-cols-2 gap-4">
        <div 
          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
            m3Data.subtipo === 'cambio_destino' 
              ? 'border-amber-600 bg-amber-50' 
              : 'border-slate-200 hover:border-amber-300'
          }`}
          onClick={() => setM3Data(prev => ({ ...prev, subtipo: 'cambio_destino', construcciones_nuevas: [] }))}
          data-testid="m3-cambio-destino-option"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              m3Data.subtipo === 'cambio_destino' ? 'border-amber-600 bg-amber-600' : 'border-slate-300'
            }`}>
              {m3Data.subtipo === 'cambio_destino' && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className={`font-semibold ${m3Data.subtipo === 'cambio_destino' ? 'text-amber-700' : 'text-slate-700'}`}>
              Cambio de Destino Económico
            </span>
          </div>
          <p className="text-xs text-slate-500 ml-7">
            Modifica el destino económico del predio (ej: de Agrícola a Comercial)
          </p>
        </div>
        <div 
          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
            m3Data.subtipo === 'incorporacion_construccion' 
              ? 'border-amber-600 bg-amber-50' 
              : 'border-slate-200 hover:border-amber-300'
          }`}
          onClick={() => setM3Data(prev => ({ ...prev, subtipo: 'incorporacion_construccion', destino_nuevo: '' }))}
          data-testid="m3-incorporacion-option"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              m3Data.subtipo === 'incorporacion_construccion' ? 'border-amber-600 bg-amber-600' : 'border-slate-300'
            }`}>
              {m3Data.subtipo === 'incorporacion_construccion' && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className={`font-semibold ${m3Data.subtipo === 'incorporacion_construccion' ? 'text-amber-700' : 'text-slate-700'}`}>
              Incorporación de Construcción
            </span>
          </div>
          <p className="text-xs text-slate-500 ml-7">
            Agrega nuevas construcciones al registro R2 del predio
          </p>
        </div>
      </div>

      {/* Solo mostrar el resto si ya seleccionó subtipo */}
      {m3Data.subtipo && (
        <>
          {/* Municipio - Dropdown */}
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <Label>Municipio *</Label>
              <div 
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-white px-3 py-2 text-sm cursor-pointer hover:bg-slate-50"
                onClick={() => setShowMunicipioDropdownM3(!showMunicipioDropdownM3)}
                data-testid="m3-municipio-dropdown"
              >
                <span className={m3Data.municipio ? 'text-slate-900' : 'text-slate-500'}>
                  {m3Data.municipio ? MUNICIPIOS.find(m => m.codigo === m3Data.municipio)?.nombre : 'Seleccionar municipio'}
                </span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </div>
              {showMunicipioDropdownM3 && (
                <div className="absolute z-[99999] mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {MUNICIPIOS.map(m => (
                    <div
                      key={m.codigo}
                      className={`px-3 py-2 text-sm cursor-pointer hover:bg-amber-50 ${m3Data.municipio === m.codigo ? 'bg-amber-100 text-amber-800' : ''}`}
                      onClick={() => {
                        setM3Data(prev => ({ ...prev, municipio: m.codigo, predio: null }));
                        setShowMunicipioDropdownM3(false);
                      }}
                    >
                      {m.nombre}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Radicado */}
            <div className="relative">
              <Label>Radicado *</Label>
              <Input
                value={m3Data.radicado}
                onChange={(e) => {
                  setM3Data(prev => ({ ...prev, radicado: e.target.value }));
                  buscarRadicadosM3(e.target.value);
                }}
                placeholder="Buscar radicado..."
                data-testid="m3-radicado-input"
              />
              {radicadosDisponiblesM3.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                  {radicadosDisponiblesM3.map((r, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-2 text-sm cursor-pointer hover:bg-amber-50"
                      onClick={() => {
                        setM3Data(prev => ({ ...prev, radicado: r.radicado }));
                        setRadicadosDisponiblesM3([]);
                      }}
                    >
                      {r.radicado} - {r.nombre_completo || r.creator_name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Datos del Solicitante M3 */}
          <Card className="border-blue-200 bg-blue-50/30">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2 text-blue-800">
                <User className="w-4 h-4" />
                Datos del Solicitante
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Nombre Completo *</Label>
                  <Input
                    value={m3Data.solicitante?.nombre || ''}
                    onChange={(e) => setM3Data(prev => ({
                      ...prev,
                      solicitante: { ...prev.solicitante, nombre: e.target.value.toUpperCase() }
                    }))}
                    placeholder="Nombre del solicitante"
                    className="h-9"
                    data-testid="m3-solicitante-nombre"
                  />
                </div>
                <div>
                  <Label className="text-xs">Tipo Documento</Label>
                  <Select
                    value={m3Data.solicitante?.tipo_documento || 'CC'}
                    onValueChange={(v) => setM3Data(prev => ({
                      ...prev,
                      solicitante: { ...prev.solicitante, tipo_documento: v }
                    }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CC">Cédula de Ciudadanía</SelectItem>
                      <SelectItem value="CE">Cédula de Extranjería</SelectItem>
                      <SelectItem value="NIT">NIT</SelectItem>
                      <SelectItem value="PA">Pasaporte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Número de Documento *</Label>
                  <Input
                    value={m3Data.solicitante?.documento || ''}
                    onChange={(e) => setM3Data(prev => ({
                      ...prev,
                      solicitante: { ...prev.solicitante, documento: e.target.value.replace(/[^0-9]/g, '') }
                    }))}
                    placeholder="Número de documento"
                    className="h-9"
                    data-testid="m3-solicitante-documento"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Búsqueda de Predio */}
          <Card className="border-amber-200 bg-amber-50/30">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
                <Search className="w-4 h-4" />
                Buscar Predio
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2 space-y-3">
              <div className="flex gap-2">
                <Input
                  value={searchPredioM3}
                  onChange={(e) => setSearchPredioM3(e.target.value)}
                  placeholder="Buscar por código predial, matrícula o propietario..."
                  onKeyDown={(e) => e.key === 'Enter' && buscarPrediosM3()}
                  disabled={!m3Data.municipio}
                  data-testid="m3-search-predio-input"
                />
                <Button onClick={buscarPrediosM3} disabled={searchingPrediosM3 || !m3Data.municipio} data-testid="m3-search-btn">
                  {searchingPrediosM3 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
              
              {/* Resultados de búsqueda */}
              {searchResultsM3.length > 0 && (
                <div className="border rounded-lg max-h-40 overflow-y-auto bg-white">
                  {searchResultsM3.map((predio, idx) => {
                    const nombrePropietario = predio.propietarios?.length > 0 
                      ? predio.propietarios[0].nombre_propietario || predio.propietarios[0].nombre
                      : predio.nombre_propietario || '';
                    return (
                      <div 
                        key={idx}
                        className="p-2 hover:bg-amber-50 cursor-pointer border-b last:border-b-0 flex justify-between items-center"
                        onClick={() => seleccionarPredioM3(predio)}
                        data-testid={`m3-search-result-${idx}`}
                      >
                        <div>
                          <p className="font-medium text-sm">{predio.codigo_predial_nacional || predio.numero_predio}</p>
                          <p className="text-xs text-slate-600">{predio.direccion} - {nombrePropietario}</p>
                        </div>
                        <Plus className="w-4 h-4 text-amber-600" />
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* Predio seleccionado */}
              {m3Data.predio && (
                <div className="bg-white p-4 rounded-lg border border-amber-300" data-testid="m3-predio-seleccionado">
                  <div className="flex justify-between items-start">
                    <div>
                      <Badge className="bg-amber-100 text-amber-800">Predio Seleccionado</Badge>
                      <p className="font-bold text-lg mt-2">{m3Data.predio.codigo_predial_nacional}</p>
                      <p className="text-sm text-slate-600">{m3Data.predio.direccion}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Destino: {m3Data.predio.destino_economico} | 
                        Área T: {formatAreaHectareas(m3Data.predio.area_terreno)} | 
                        Área C: {(m3Data.predio.area_construida || 0).toLocaleString()} m²
                      </p>
                      <p className="text-xs text-slate-500">
                        Avalúo actual: ${(m3Data.predio.avaluo || 0).toLocaleString()}
                      </p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setM3Data(prev => ({ ...prev, predio: null, destino_anterior: '', avaluo_anterior: 0 }))}
                      className="text-red-600"
                      data-testid="m3-remove-predio-btn"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Formulario específico según subtipo */}
          {m3Data.predio && m3Data.subtipo === 'cambio_destino' && (
            <Card className="border-blue-200 bg-blue-50/30">
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2 text-blue-800">
                  <ArrowRight className="w-4 h-4" />
                  Cambio de Destino Económico
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-blue-700">Destino Anterior</Label>
                    <div className="bg-blue-100 p-2 rounded text-sm font-medium text-blue-800">
                      {m3Data.destino_anterior} - {DESTINOS_ECONOMICOS.find(d => d.codigo === m3Data.destino_anterior)?.nombre.split(' - ')[1] || 'Desconocido'}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-emerald-700">Nuevo Destino *</Label>
                    <select
                      value={m3Data.destino_nuevo}
                      onChange={(e) => setM3Data(prev => ({ ...prev, destino_nuevo: e.target.value }))}
                      className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      data-testid="m3-destino-nuevo-select"
                    >
                      <option value="">Seleccionar nuevo destino</option>
                      {DESTINOS_ECONOMICOS.filter(d => d.codigo !== m3Data.destino_anterior).map(d => (
                        <option key={d.codigo} value={d.codigo}>{d.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Formulario de Incorporación de Construcción */}
          {m3Data.predio && m3Data.subtipo === 'incorporacion_construccion' && (
            <Card className="border-purple-200 bg-purple-50/30">
              <CardHeader className="py-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm flex items-center gap-2 text-purple-800">
                    <Building className="w-4 h-4" />
                    Construcciones a Incorporar ({m3Data.construcciones_nuevas.length})
                  </CardTitle>
                  <Button 
                    size="sm" 
                    onClick={agregarConstruccionM3} 
                    variant="outline" 
                    className="text-purple-700 border-purple-300"
                    data-testid="m3-agregar-construccion-btn"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Agregar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="py-2 space-y-3 max-h-60 overflow-y-auto">
                {m3Data.construcciones_nuevas.length === 0 ? (
                  <div className="text-center py-4 text-slate-500 text-sm">
                    No hay construcciones agregadas. Haga clic en "Agregar" para comenzar.
                  </div>
                ) : (
                  m3Data.construcciones_nuevas.map((const_, idx) => (
                    <div key={idx} className="border border-purple-200 rounded-lg p-3 bg-white" data-testid={`m3-construccion-${idx}`}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-purple-800">Construcción {idx + 1}</span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => eliminarConstruccionM3(idx)} 
                          className="text-red-600 h-6 w-6 p-0"
                          data-testid={`m3-eliminar-construccion-${idx}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <Label className="text-xs">Pisos</Label>
                          <Input 
                            type="number" 
                            value={const_.pisos} 
                            onChange={(e) => actualizarConstruccionM3(idx, 'pisos', parseInt(e.target.value) || 0)} 
                            className="h-8"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Habitaciones</Label>
                          <Input 
                            type="number" 
                            value={const_.habitaciones} 
                            onChange={(e) => actualizarConstruccionM3(idx, 'habitaciones', parseInt(e.target.value) || 0)} 
                            className="h-8"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Baños</Label>
                          <Input 
                            type="number" 
                            value={const_.banos} 
                            onChange={(e) => actualizarConstruccionM3(idx, 'banos', parseInt(e.target.value) || 0)} 
                            className="h-8"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Locales</Label>
                          <Input 
                            type="number" 
                            value={const_.locales} 
                            onChange={(e) => actualizarConstruccionM3(idx, 'locales', parseInt(e.target.value) || 0)} 
                            className="h-8"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <div>
                          <Label className="text-xs">Uso</Label>
                          <Input 
                            value={const_.uso || ''} 
                            onChange={(e) => actualizarConstruccionM3(idx, 'uso', e.target.value)} 
                            placeholder="Ej: Vivienda"
                            className="h-8"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Puntaje</Label>
                          <Input 
                            type="number" 
                            value={const_.puntaje} 
                            onChange={(e) => actualizarConstruccionM3(idx, 'puntaje', parseFloat(e.target.value) || 0)} 
                            className="h-8"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Área Construida (m²) *</Label>
                          <Input 
                            type="number" 
                            value={const_.area_construida} 
                            onChange={(e) => actualizarConstruccionM3(idx, 'area_construida', parseFloat(e.target.value) || 0)} 
                            className="h-8 border-purple-300"
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
                
                {/* Resumen de área a incorporar */}
                {m3Data.construcciones_nuevas.length > 0 && (
                  <div className="bg-purple-100 border border-purple-200 rounded p-2 mt-2">
                    <p className="text-sm text-purple-800">
                      <strong>Total Área a Incorporar:</strong> {m3Data.construcciones_nuevas.reduce((sum, c) => sum + (c.area_construida || 0), 0).toLocaleString()} m²
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Avalúos */}
          {m3Data.predio && (
            <Card className="border-emerald-200 bg-emerald-50/30">
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2 text-emerald-800">
                  <DollarSign className="w-4 h-4" />
                  Información de Avalúo
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-slate-600">Avalúo Anterior</Label>
                    <div className="bg-slate-100 p-2 rounded text-sm font-medium text-slate-700">
                      ${(m3Data.avaluo_anterior || 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-emerald-700">Nuevo Avalúo *</Label>
                    <Input
                      type="number"
                      value={m3Data.avaluo_nuevo || ''}
                      onChange={(e) => setM3Data(prev => ({ ...prev, avaluo_nuevo: parseFloat(e.target.value) || 0 }))}
                      placeholder="Ingrese el nuevo avalúo"
                      className="border-emerald-300"
                      data-testid="m3-avaluo-nuevo-input"
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs text-slate-600">Vigencias Fiscales de Inscripción</Label>
                    <Button 
                      type="button" 
                      size="sm" 
                      variant="outline" 
                      onClick={agregarFechaInscripcionM3}
                      className="h-6 text-xs"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Agregar Año
                    </Button>
                  </div>
                  {m3Data.fechas_inscripcion.map((fecha, fidx) => (
                    <div key={fidx} className="flex items-end gap-2 mb-2 p-2 bg-white rounded border border-emerald-200">
                      <div className="flex-1">
                        <Label className="text-xs text-slate-600">Año Inscripción</Label>
                        <Select
                          value={String(fecha.año || '')}
                          onValueChange={(v) => actualizarFechaInscripcionM3(fidx, 'año', parseInt(v))}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Año..." />
                          </SelectTrigger>
                          <SelectContent side="bottom" align="start">
                            {añosDisponibles.map(año => (
                              <SelectItem key={año} value={String(año)}>{año}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs text-slate-600">
                          Avalúo Vigencia {fecha.año || '----'}
                          {fecha.avaluo_source === 'sistema' && <span className="text-emerald-600 ml-1">(Sistema)</span>}
                        </Label>
                        <Input
                          type="text"
                          className="h-8 text-xs"
                          placeholder="$0"
                          value={fecha.avaluo ? `$${Number(fecha.avaluo).toLocaleString()}` : ''}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            actualizarFechaInscripcionM3(fidx, 'avaluo', val);
                            actualizarFechaInscripcionM3(fidx, 'avaluo_source', 'manual');
                          }}
                        />
                      </div>
                      {m3Data.fechas_inscripcion.length > 1 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => eliminarFechaInscripcionM3(fidx)}
                          className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                
                <div>
                  <Label className="text-xs text-slate-600">Observaciones</Label>
                  <Textarea
                    value={m3Data.observaciones || ''}
                    onChange={(e) => setM3Data(prev => ({ ...prev, observaciones: e.target.value }))}
                    placeholder="Observaciones adicionales (opcional)"
                    rows={2}
                    data-testid="m3-observaciones-input"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Campo de Considerando Personalizado */}
          <Card className="border-purple-200 bg-purple-50/30">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2 text-purple-800">
                <FileText className="w-4 h-4" />
                Texto de Considerandos (Resolución)
              </CardTitle>
              <p className="text-xs text-purple-600 mt-1">
                Este texto aparecerá en la sección "CONSIDERANDO" de la resolución. Si se deja vacío, se usará el texto estándar.
              </p>
            </CardHeader>
            <CardContent className="py-2">
              <Textarea
                value={m3Data.texto_considerando || ''}
                onChange={(e) => setM3Data(prev => ({ ...prev, texto_considerando: e.target.value }))}
                placeholder={`Ejemplo: Qué, el(la) ciudadano(a) ${m3Data.solicitante?.nombre || '[NOMBRE]'}, identificado(a) con Cédula de Ciudadanía No. ${m3Data.solicitante?.documento || '[DOCUMENTO]'}, radicó solicitud de cambio de destino económico para el predio con código predial ${m3Data.predio?.codigo_predial_nacional || '[CÓDIGO PREDIAL]'}...`}
                rows={6}
                className="font-mono text-sm"
                data-testid="m3-considerando-input"
              />
              <div className="mt-2 text-xs text-slate-500">
                <strong>Variables disponibles:</strong> (solicitante), (documento), (codigo_predial), (municipio), (radicado), (matricula), (destino_anterior), (destino_nuevo)
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );

  // Renderizar formulario M4 - Revisión de Avalúo / Autoestimación
  const renderFormularioM4 = () => (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
      {/* Tipo de M4 */}
      <div className="grid grid-cols-2 gap-4">
        <div 
          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
            m4Data.subtipo === 'revision_avaluo' 
              ? 'border-green-600 bg-green-50' 
              : 'border-slate-200 hover:border-green-300'
          }`}
          onClick={() => setM4Data(prev => ({ ...prev, subtipo: 'revision_avaluo' }))}
          data-testid="m4-revision-option"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              m4Data.subtipo === 'revision_avaluo' ? 'border-green-600 bg-green-600' : 'border-slate-300'
            }`}>
              {m4Data.subtipo === 'revision_avaluo' && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className={`font-semibold ${m4Data.subtipo === 'revision_avaluo' ? 'text-green-700' : 'text-slate-700'}`}>
              Revisión de Avalúo
            </span>
          </div>
          <p className="text-xs text-slate-500 ml-7">
            El avalúo revisado se aplica en la <strong>presente vigencia</strong>
          </p>
        </div>
        <div 
          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
            m4Data.subtipo === 'autoestimacion' 
              ? 'border-green-600 bg-green-50' 
              : 'border-slate-200 hover:border-green-300'
          }`}
          onClick={() => setM4Data(prev => ({ ...prev, subtipo: 'autoestimacion' }))}
          data-testid="m4-autoestimacion-option"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              m4Data.subtipo === 'autoestimacion' ? 'border-green-600 bg-green-600' : 'border-slate-300'
            }`}>
              {m4Data.subtipo === 'autoestimacion' && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className={`font-semibold ${m4Data.subtipo === 'autoestimacion' ? 'text-green-700' : 'text-slate-700'}`}>
              Autoestimación
            </span>
          </div>
          <p className="text-xs text-slate-500 ml-7">
            El avalúo autoestimado se aplica en la <strong>vigencia venidera</strong>
          </p>
        </div>
      </div>

      {m4Data.subtipo && (
        <>
          {/* Decisión: Aceptar / Rechazar */}
          <div className="bg-slate-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-slate-700 mb-2">Decisión</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="decision"
                  value="aceptar"
                  checked={m4Data.decision === 'aceptar'}
                  onChange={() => setM4Data(prev => ({ ...prev, decision: 'aceptar' }))}
                  className="w-4 h-4 text-green-600"
                />
                <span className="text-sm text-green-700 font-medium">Aceptar solicitud</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="decision"
                  value="rechazar"
                  checked={m4Data.decision === 'rechazar'}
                  onChange={() => setM4Data(prev => ({ ...prev, decision: 'rechazar' }))}
                  className="w-4 h-4 text-red-600"
                />
                <span className="text-sm text-red-700 font-medium">Rechazar solicitud</span>
              </label>
            </div>
          </div>

          {/* Municipio */}
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">Municipio *</label>
            <div 
              className="flex items-center justify-between px-3 py-2 border rounded-lg cursor-pointer hover:bg-slate-50"
              onClick={() => setShowMunicipioDropdownM4(!showMunicipioDropdownM4)}
              data-testid="m4-municipio-select"
            >
              <span className={m4Data.municipio ? 'text-slate-900' : 'text-slate-400'}>
                {m4Data.municipio ? MUNICIPIOS.find(m => m.codigo === m4Data.municipio)?.nombre : 'Seleccione municipio'}
              </span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </div>
            {showMunicipioDropdownM4 && (
              <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {MUNICIPIOS.map(mun => (
                  <div
                    key={mun.codigo}
                    className="px-3 py-2 hover:bg-green-50 cursor-pointer"
                    onClick={() => {
                      setM4Data(prev => ({ ...prev, municipio: mun.codigo, predio: null }));
                      setShowMunicipioDropdownM4(false);
                      setSearchResultsM4([]);
                    }}
                  >
                    {mun.nombre}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Radicado */}
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">Número de Radicado *</label>
            <Input
              placeholder="Ingrese número de radicado"
              value={m4Data.radicado}
              onChange={(e) => {
                setM4Data(prev => ({ ...prev, radicado: e.target.value }));
                buscarRadicadosM4(e.target.value);
              }}
              data-testid="m4-radicado-input"
            />
            {radicadosDisponiblesM4.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {radicadosDisponiblesM4.map((rad, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-2 hover:bg-green-50 cursor-pointer text-sm"
                    onClick={() => {
                      setM4Data(prev => ({ ...prev, radicado: rad.radicado || rad.numero || (typeof rad === 'string' ? rad : '') }));
                      setRadicadosDisponiblesM4([]);
                    }}
                  >
                    <div className="font-medium">{rad.radicado || rad.numero || (typeof rad === 'string' ? rad : 'Sin radicado')}</div>
                    {rad.nombre_completo && <div className="text-xs text-slate-500">{rad.nombre_completo}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Datos del Solicitante M4 */}
          <Card className="border-blue-200 bg-blue-50/30">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2 text-blue-800">
                <User className="w-4 h-4" />
                Datos del Solicitante
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Nombre Completo *</Label>
                  <Input
                    value={m4Data.solicitante?.nombre || ''}
                    onChange={(e) => setM4Data(prev => ({
                      ...prev,
                      solicitante: { ...prev.solicitante, nombre: e.target.value.toUpperCase() }
                    }))}
                    placeholder="Nombre del solicitante"
                    className="h-9"
                    data-testid="m4-solicitante-nombre"
                  />
                </div>
                <div>
                  <Label className="text-xs">Tipo Documento</Label>
                  <Select
                    value={m4Data.solicitante?.tipo_documento || 'CC'}
                    onValueChange={(v) => setM4Data(prev => ({
                      ...prev,
                      solicitante: { ...prev.solicitante, tipo_documento: v }
                    }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CC">Cédula de Ciudadanía</SelectItem>
                      <SelectItem value="CE">Cédula de Extranjería</SelectItem>
                      <SelectItem value="NIT">NIT</SelectItem>
                      <SelectItem value="PA">Pasaporte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Número de Documento *</Label>
                  <Input
                    value={m4Data.solicitante?.documento || ''}
                    onChange={(e) => setM4Data(prev => ({
                      ...prev,
                      solicitante: { ...prev.solicitante, documento: e.target.value.replace(/[^0-9]/g, '') }
                    }))}
                    placeholder="Número de documento"
                    className="h-9"
                    data-testid="m4-solicitante-documento"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Buscar Predio */}
          {m4Data.municipio && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Buscar Predio *</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Buscar por código predial, matrícula o nombre..."
                  value={searchPredioM4}
                  onChange={(e) => setSearchPredioM4(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && buscarPrediosM4()}
                  data-testid="m4-search-predio-input"
                />
                <Button onClick={buscarPrediosM4} disabled={searchingPrediosM4 || !m4Data.municipio} data-testid="m4-search-btn">
                  {searchingPrediosM4 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>

              {/* Resultados de búsqueda */}
              {searchResultsM4.length > 0 && (
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {searchResultsM4.map(predio => (
                    <div
                      key={predio.id}
                      className="p-3 hover:bg-green-50 cursor-pointer border-b last:border-b-0"
                      onClick={() => seleccionarPredioM4(predio)}
                    >
                      <div className="font-medium text-sm">{predio.codigo_predial_nacional || predio.npn}</div>
                      <div className="text-xs text-slate-500">{predio.direccion}</div>
                      <div className="text-xs text-slate-400">Avalúo actual: ${(predio.avaluo || 0).toLocaleString('es-CO')}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Predio seleccionado - Información completa tipo R1 */}
              {m4Data.predio && (
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-600">Predio Seleccionado</Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setM4Data(prev => ({ ...prev, predio: null, avaluo_anterior: 0 }))}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    {/* Información Principal - Estilo R1 */}
                    <div className="bg-white rounded-lg p-3 mb-3">
                      <h4 className="font-bold text-green-800 text-lg">{m4Data.predio.codigo_predial_nacional}</h4>
                      <p className="text-sm text-slate-600">{m4Data.predio.direccion || 'Sin dirección'}</p>
                    </div>
                    
                    {/* Grid de datos tipo R1 */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                      <div className="bg-white rounded p-2">
                        <span className="text-xs text-slate-500 block">Matrícula</span>
                        <span className="font-medium">{getMatriculaInmobiliaria(m4Data.predio)}</span>
                      </div>
                      <div className="bg-white rounded p-2">
                        <span className="text-xs text-slate-500 block">Destino</span>
                        <span className="font-medium">{m4Data.predio.destino_economico || 'N/A'}</span>
                      </div>
                      <div className="bg-white rounded p-2">
                        <span className="text-xs text-slate-500 block">Área Terreno</span>
                        <span className="font-medium">{formatAreaHectareas(m4Data.predio.area_terreno)}</span>
                      </div>
                      <div className="bg-white rounded p-2">
                        <span className="text-xs text-slate-500 block">Área Construida</span>
                        <span className="font-medium">{(m4Data.predio.area_construida || 0).toLocaleString()} m²</span>
                      </div>
                      <div className="bg-white rounded p-2">
                        <span className="text-xs text-slate-500 block">Avalúo Catastral</span>
                        <span className="font-bold text-green-700">${(m4Data.avaluo_anterior || 0).toLocaleString('es-CO')}</span>
                      </div>
                      <div className="bg-white rounded p-2">
                        <span className="text-xs text-slate-500 block">Municipio</span>
                        <span className="font-medium">{m4Data.predio.municipio || m4Data.municipio || 'N/A'}</span>
                      </div>
                    </div>
                    
                    {/* Propietarios */}
                    {m4Data.predio.propietarios && m4Data.predio.propietarios.length > 0 && (
                      <div className="mt-3 bg-white rounded-lg p-2">
                        <span className="text-xs text-slate-500 block mb-1">Propietario(s)</span>
                        {m4Data.predio.propietarios.slice(0, 3).map((prop, idx) => (
                          <div key={idx} className="text-sm">
                            <span className="font-medium">{prop.nombre_propietario || prop.nombre}</span>
                            {prop.numero_documento && <span className="text-slate-500 ml-1">({prop.tipo_documento || 'CC'} {prop.numero_documento})</span>}
                          </div>
                        ))}
                        {m4Data.predio.propietarios.length > 3 && (
                          <span className="text-xs text-slate-400">y {m4Data.predio.propietarios.length - 3} más...</span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Motivo de solicitud (solo para revisión de avalúo) */}
          {m4Data.subtipo === 'revision_avaluo' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Motivo de la Solicitud de Revisión *</label>
              <textarea
                className="w-full px-3 py-2 border rounded-lg resize-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                rows={3}
                placeholder="Describa el motivo por el cual el propietario solicita la revisión del avalúo..."
                value={m4Data.motivo_solicitud}
                onChange={(e) => setM4Data(prev => ({ ...prev, motivo_solicitud: e.target.value }))}
                data-testid="m4-motivo-input"
              />
            </div>
          )}

          {/* Perito Avaluador (solo para autoestimación) */}
          {m4Data.subtipo === 'autoestimacion' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Perito Avaluador *</label>
              <Input
                type="text"
                placeholder="Ingrese el nombre completo del perito avaluador"
                value={m4Data.perito_avaluador}
                onChange={(e) => setM4Data(prev => ({ ...prev, perito_avaluador: e.target.value }))}
                data-testid="m4-perito-avaluador-input"
              />
              <p className="text-xs text-slate-500 mt-1">Este nombre aparecerá en la resolución como el profesional que realizó el análisis del avalúo</p>
            </div>
          )}

          {/* Avalúos */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Avalúo Anterior</label>
              <Input
                type="text"
                value={`$${(m4Data.avaluo_anterior || 0).toLocaleString('es-CO')}`}
                disabled
                className="bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {m4Data.subtipo === 'autoestimacion' ? 'Valor Autoestimado *' : 'Nuevo Avalúo *'}
              </label>
              <Input
                type="number"
                placeholder="Ingrese el nuevo valor"
                value={m4Data.avaluo_nuevo || ''}
                onChange={(e) => setM4Data(prev => ({ ...prev, avaluo_nuevo: parseFloat(e.target.value) || 0 }))}
                data-testid="m4-avaluo-nuevo-input"
              />
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observaciones</label>
            <textarea
              className="w-full px-3 py-2 border rounded-lg resize-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              rows={2}
              placeholder="Observaciones adicionales (opcional)"
              value={m4Data.observaciones}
              onChange={(e) => setM4Data(prev => ({ ...prev, observaciones: e.target.value }))}
              data-testid="m4-observaciones-input"
            />
          </div>

          {/* Campo de Considerando Personalizado */}
          <Card className="border-purple-200 bg-purple-50/30">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2 text-purple-800">
                <FileText className="w-4 h-4" />
                Texto de Considerandos (Resolución)
              </CardTitle>
              <p className="text-xs text-purple-600 mt-1">
                Este texto aparecerá en la sección "CONSIDERANDO" de la resolución. Si se deja vacío, se usará el texto estándar.
              </p>
            </CardHeader>
            <CardContent className="py-2">
              <Textarea
                value={m4Data.texto_considerando || ''}
                onChange={(e) => setM4Data(prev => ({ ...prev, texto_considerando: e.target.value }))}
                placeholder={`Ejemplo: Qué, el señor ${m4Data.solicitante?.nombre || '[NOMBRE]'}, identificado con Cédula de Ciudadanía No. ${m4Data.solicitante?.documento || '[DOCUMENTO]'}, radicó solicitud de revisión de avalúo catastral para el predio ubicado en ${m4Data.predio?.direccion || '[DIRECCIÓN]'}...`}
                rows={6}
                className="font-mono text-sm"
                data-testid="m4-considerando-input"
              />
              <div className="mt-2 text-xs text-slate-500">
                <strong>Variables disponibles:</strong> (solicitante), (documento), (codigo_predial), (municipio), (radicado), (avaluo_anterior), (avaluo_nuevo)
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );

  // Renderizar formulario M5 - Cancelación / Inscripción de Predio
  const renderFormularioM5 = () => (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
      {/* Tipo de M5 */}
      <div className="grid grid-cols-2 gap-4">
        <div 
          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
            m5Data.subtipo === 'cancelacion' 
              ? 'border-red-600 bg-red-50' 
              : 'border-slate-200 hover:border-red-300'
          }`}
          onClick={() => setM5Data(prev => ({ ...prev, subtipo: 'cancelacion', predio: null }))}
          data-testid="m5-cancelacion-option"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              m5Data.subtipo === 'cancelacion' ? 'border-red-600 bg-red-600' : 'border-slate-300'
            }`}>
              {m5Data.subtipo === 'cancelacion' && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className={`font-semibold ${m5Data.subtipo === 'cancelacion' ? 'text-red-700' : 'text-slate-700'}`}>
              Cancelación de Predio
            </span>
          </div>
          <p className="text-xs text-slate-500 ml-7">
            Eliminar un predio del catastro desde una vigencia específica
          </p>
        </div>
        <div 
          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
            m5Data.subtipo === 'inscripcion' 
              ? 'border-emerald-600 bg-emerald-50' 
              : 'border-slate-200 hover:border-emerald-300'
          }`}
          onClick={() => setM5Data(prev => ({ ...prev, subtipo: 'inscripcion', predio: null }))}
          data-testid="m5-inscripcion-option"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              m5Data.subtipo === 'inscripcion' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'
            }`}>
              {m5Data.subtipo === 'inscripcion' && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className={`font-semibold ${m5Data.subtipo === 'inscripcion' ? 'text-emerald-700' : 'text-slate-700'}`}>
              Inscripción de Predio Nuevo
            </span>
          </div>
          <p className="text-xs text-slate-500 ml-7">
            Registrar un nuevo predio que no existe en el catastro
          </p>
        </div>
      </div>

      {/* Formulario según subtipo seleccionado */}
      {m5Data.subtipo && (
        <>
          {/* Municipio */}
          <div className="relative">
            <Label className="text-sm font-medium">Municipio *</Label>
            <div
              className="w-full p-3 border rounded-lg cursor-pointer flex justify-between items-center bg-white"
              onClick={() => setShowMunicipioDropdownM5(!showMunicipioDropdownM5)}
              data-testid="m5-municipio-select"
            >
              <span className={m5Data.municipio ? 'text-slate-900' : 'text-slate-400'}>
                {m5Data.municipio || 'Seleccione municipio'}
              </span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </div>
            {showMunicipioDropdownM5 && (
              <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {MUNICIPIOS.map((mun) => (
                  <div
                    key={mun.codigo}
                    className="px-3 py-2 hover:bg-red-50 cursor-pointer text-sm"
                    onClick={() => {
                      setM5Data(prev => ({ ...prev, municipio: mun.nombre }));
                      setShowMunicipioDropdownM5(false);
                    }}
                  >
                    {mun.nombre}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Radicado */}
          <div className="relative">
            <Label className="text-sm font-medium">Número de Radicado *</Label>
            <Input
              type="text"
              value={m5Data.radicado}
              onChange={(e) => {
                setM5Data(prev => ({ ...prev, radicado: e.target.value }));
                buscarRadicadosM5(e.target.value);
              }}
              placeholder="Buscar radicado..."
              className="mt-1"
              data-testid="m5-radicado-input"
            />
            {radicadosDisponiblesM5.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {radicadosDisponiblesM5.map((rad, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-2 hover:bg-red-50 cursor-pointer text-sm"
                    onClick={() => {
                      setM5Data(prev => ({ ...prev, radicado: rad.radicado || rad.numero || (typeof rad === 'string' ? rad : '') }));
                      setRadicadosDisponiblesM5([]);
                    }}
                  >
                    <div className="font-medium">{rad.radicado || rad.numero || (typeof rad === 'string' ? rad : 'Sin radicado')}</div>
                    {rad.nombre_completo && <div className="text-xs text-slate-500">{rad.nombre_completo}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Vigencia */}
          <div>
            <Label className="text-sm font-medium">
              {m5Data.subtipo === 'cancelacion' ? 'Vigencia desde la cual se cancela *' : 'Vigencia de inscripción *'}
            </Label>
            <Input
              type="number"
              value={m5Data.vigencia}
              onChange={(e) => setM5Data(prev => ({ ...prev, vigencia: parseInt(e.target.value) || new Date().getFullYear() }))}
              min="2000"
              max="2100"
              className="mt-1"
              data-testid="m5-vigencia-input"
            />
            <p className="text-xs text-slate-500 mt-1">
              {m5Data.subtipo === 'cancelacion' 
                ? 'El predio se cancelará a partir del 01/01 de este año' 
                : 'El predio se inscribirá a partir del 01/01 de este año'}
            </p>
          </div>

          {/* Sección específica para CANCELACIÓN */}
          {m5Data.subtipo === 'cancelacion' && (
            <>
              {/* Búsqueda de predio a cancelar */}
              <div>
                <Label className="text-sm font-medium">Buscar Predio a Cancelar *</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    type="text"
                    value={searchPredioM5}
                    onChange={(e) => setSearchPredioM5(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && buscarPrediosM5()}
                    placeholder="Código predial, NPN o dirección..."
                    className="flex-1"
                    data-testid="m5-search-predio-input"
                  />
                  <Button 
                    onClick={buscarPrediosM5} 
                    disabled={searchingPrediosM5}
                    data-testid="m5-search-btn"
                  >
                    {searchingPrediosM5 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {/* Resultados de búsqueda */}
              {searchResultsM5.length > 0 && (
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {searchResultsM5.map((predio, idx) => (
                    <div
                      key={idx}
                      className="p-3 hover:bg-red-50 cursor-pointer border-b last:border-b-0"
                      onClick={() => seleccionarPredioM5(predio)}
                    >
                      <p className="font-mono text-sm font-medium text-red-700">{predio.codigo_predial_nacional || predio.NPN}</p>
                      <p className="text-xs text-slate-500">{predio.direccion}</p>
                      {predio.propietarios?.[0] && (
                        <p className="text-xs text-slate-400">{predio.propietarios[0].nombre_propietario}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Predio seleccionado para cancelar */}
              {m5Data.predio && (
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <Badge className="bg-red-600">Predio a Cancelar</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setM5Data(prev => ({ ...prev, predio: null }))}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="bg-white rounded-lg p-3 mb-3">
                      <h4 className="font-bold text-red-800">{m5Data.predio.codigo_predial_nacional || m5Data.predio.NPN}</h4>
                      <p className="text-sm text-slate-600">{m5Data.predio.direccion || 'Sin dirección'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-white rounded p-2">
                        <span className="text-xs text-slate-500 block">Matrícula</span>
                        <span className="font-medium">{getMatriculaInmobiliaria(predio)}</span>
                      </div>
                      <div className="bg-white rounded p-2">
                        <span className="text-xs text-slate-500 block">Avalúo</span>
                        <span className="font-bold text-red-700">${(m5Data.predio.avaluo || m5Data.predio.avaluo_catastral || 0).toLocaleString('es-CO')}</span>
                      </div>
                    </div>
                    {m5Data.predio.propietarios?.length > 0 && (
                      <div className="mt-2 bg-white rounded-lg p-2">
                        <span className="text-xs text-slate-500 block mb-1">Propietario(s)</span>
                        {m5Data.predio.propietarios.slice(0, 2).map((prop, idx) => (
                          <div key={idx} className="text-sm">
                            <span className="font-medium">{prop.nombre_propietario || prop.nombre}</span>
                            {prop.numero_documento && <span className="text-slate-500 ml-1">({prop.tipo_documento || 'CC'} {prop.numero_documento})</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Opción de doble inscripción */}
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="doble-inscripcion"
                    checked={m5Data.es_doble_inscripcion}
                    onChange={(e) => setM5Data(prev => ({ ...prev, es_doble_inscripcion: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="doble-inscripcion" className="text-sm font-medium text-amber-800">
                    ¿Es cancelación por doble inscripción?
                  </Label>
                </div>
                {m5Data.es_doble_inscripcion && (
                  <div className="mt-2">
                    <Label className="text-xs text-amber-600">Código del predio con el que está duplicado</Label>
                    <Input
                      type="text"
                      value={m5Data.codigo_predio_duplicado}
                      onChange={(e) => setM5Data(prev => ({ ...prev, codigo_predio_duplicado: e.target.value }))}
                      placeholder="540030001000000..."
                      className="mt-1"
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {/* Sección específica para INSCRIPCIÓN */}
          {m5Data.subtipo === 'inscripcion' && (
            <>
              <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                <p className="text-sm text-emerald-800 mb-3">
                  <strong>Inscripción de Predio Nuevo:</strong> Cree el predio o busque uno existente.
                </p>
                
                {/* Si no hay predio seleccionado, mostrar opciones */}
                {!m5Data.predio && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-3">
                      <Button
                        onClick={() => {
                          const mun = MUNICIPIOS.find(m => m.nombre === m5Data.municipio);
                          if (mun) setCodigoMunicipioM5(mun.codigo);
                          setShowCrearPredioM5(true);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700"
                        disabled={!m5Data.municipio}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Crear Predio Nuevo
                      </Button>
                      <span className="text-sm text-slate-500 self-center">o busque un predio existente:</span>
                    </div>
                    
                    <div>
                      <Label className="text-xs text-emerald-600">Buscar predio</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          type="text"
                          value={searchPredioM5}
                          onChange={(e) => setSearchPredioM5(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && buscarPrediosM5()}
                          placeholder="Código predial..."
                          className="flex-1"
                        />
                        <Button onClick={buscarPrediosM5} disabled={searchingPrediosM5} variant="outline">
                          {searchingPrediosM5 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    
                    {searchResultsM5.length > 0 && (
                      <div className="border rounded-lg max-h-48 overflow-y-auto">
                        {searchResultsM5.map((predio, idx) => (
                          <div key={idx} className="p-3 hover:bg-emerald-50 cursor-pointer border-b" onClick={() => seleccionarPredioM5(predio)}>
                            <p className="font-mono text-sm font-medium text-emerald-700">{predio.codigo_predial_nacional || predio.codigo_homologado}</p>
                            <p className="text-xs text-slate-500">{predio.direccion}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {m5Data.predio && (
                  <Card className="bg-white border-emerald-300 mt-3">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <Badge className="bg-emerald-600">Predio a Inscribir</Badge>
                        <Button variant="ghost" size="sm" onClick={() => setM5Data(prev => ({ ...prev, predio: null }))}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="bg-emerald-50 rounded-lg p-3 mb-3">
                        <h4 className="font-bold text-emerald-800">{m5Data.predio.codigo_predial_nacional || m5Data.predio.codigo_homologado}</h4>
                        <p className="text-sm text-slate-600">{m5Data.predio.direccion}</p>
                        {m5Data.predio.codigo_homologado && <p className="text-xs text-emerald-600 mt-1">Homologado: {m5Data.predio.codigo_homologado}</p>}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-slate-50 rounded p-2"><span className="text-xs text-slate-500 block">Matrícula</span><span className="font-medium">{getMatriculaInmobiliaria(predio)}</span></div>
                        <div className="bg-slate-50 rounded p-2"><span className="text-xs text-slate-500 block">Destino</span><span className="font-medium">{m5Data.predio.destino_economico || 'N/A'}</span></div>
                        <div className="bg-slate-50 rounded p-2"><span className="text-xs text-slate-500 block">Área</span><span className="font-medium">{formatAreaHectareas(m5Data.predio.area_terreno)}</span></div>
                        <div className="bg-slate-50 rounded p-2"><span className="text-xs text-slate-500 block">Avalúo</span><span className="font-bold text-emerald-700">${(m5Data.predio.avaluo || 0).toLocaleString()}</span></div>
                      </div>
                      {m5Data.predio.propietarios?.[0] && (
                        <div className="mt-3 bg-slate-50 rounded-lg p-2">
                          <span className="text-xs text-slate-500 block">Propietario</span>
                          <span className="font-medium">{m5Data.predio.propietarios[0].nombre_propietario}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
              
              {/* Modal COMPLETO de Creación de Predio - Igual a Predios.js */}
              <Dialog open={showCrearPredioM5} onOpenChange={(open) => { setShowCrearPredioM5(open); if (!open) resetCrearPredioM5(); }}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-visible">
                  <div className="max-h-[80vh] overflow-y-auto pr-2">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-outfit">Nuevo Predio - {m5Data.municipio}</DialogTitle>
                  </DialogHeader>
                  
                  {/* Información del Código Homologado */}
                  {siguienteCodigoHomologadoM5 && (
                    <div className={`p-3 rounded-lg border ${siguienteCodigoHomologadoM5.codigo ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className={`w-5 h-5 ${siguienteCodigoHomologadoM5.codigo ? 'text-emerald-600' : 'text-amber-600'}`} />
                          <div>
                            <p className="text-sm font-medium text-slate-700">Código Homologado Asignado</p>
                            {siguienteCodigoHomologadoM5.codigo ? (
                              <p className="text-lg font-bold text-emerald-700 font-mono">{siguienteCodigoHomologadoM5.codigo}</p>
                            ) : (
                              <p className="text-sm text-amber-700">No hay códigos disponibles - se generará automáticamente</p>
                            )}
                          </div>
                        </div>
                        {siguienteCodigoHomologadoM5.codigo && (
                          <Badge className="bg-emerald-100 text-emerald-700">{siguienteCodigoHomologadoM5.disponibles} disponibles</Badge>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <Tabs value={tabCrearPredioM5} onValueChange={setTabCrearPredioM5} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="ubicacion">Código Nacional (30 dígitos)</TabsTrigger>
                      <TabsTrigger value="propietario">Propietario (R1)</TabsTrigger>
                      <TabsTrigger value="fisico">Físico (R2)</TabsTrigger>
                    </TabsList>
                    
                    {/* =========== TAB 1: CÓDIGO NACIONAL =========== */}
                    <TabsContent value="ubicacion" className="space-y-4 mt-4">
                      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                        <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                          <FileText className="w-4 h-4" /> Código Predial Nacional (30 dígitos)
                        </h4>
                        
                        {/* Visualización del código completo */}
                        <div className="bg-white p-3 rounded border mb-4 font-mono text-lg tracking-wider text-center">
                          <span className="text-blue-600 font-bold" title="Departamento + Municipio">{codigoMunicipioM5}</span>
                          <span className="text-emerald-600" title="Zona">{codigoManualM5.zona}</span>
                          <span className="text-amber-600" title="Sector">{codigoManualM5.sector}</span>
                          <span className="text-purple-600" title="Comuna">{codigoManualM5.comuna}</span>
                          <span className="text-pink-600" title="Barrio">{codigoManualM5.barrio}</span>
                          <span className="text-cyan-600" title="Manzana/Vereda">{codigoManualM5.manzana_vereda}</span>
                          <span className="text-red-600 font-bold" title="Terreno">{codigoManualM5.terreno}</span>
                          <span className="text-orange-600" title="Condición">{codigoManualM5.condicion}</span>
                          <span className="text-slate-500" title="Edificio">{codigoManualM5.edificio}</span>
                          <span className="text-slate-500" title="Piso">{codigoManualM5.piso}</span>
                          <span className="text-slate-500" title="Unidad">{codigoManualM5.unidad}</span>
                          <span className="text-xs text-slate-500 ml-2">({construirCodigoPredialM5().length}/30)</span>
                        </div>

                        {/* Campos editables - Fila 1: Ubicación geográfica */}
                        <div className="grid grid-cols-6 gap-2 mb-3">
                          <div className="bg-blue-100 p-2 rounded">
                            <Label className="text-xs text-blue-700">Dpto+Mpio (1-5)</Label>
                            <Input value={codigoMunicipioM5} disabled className="font-mono bg-blue-50 text-blue-800 font-bold text-center" />
                          </div>
                          <div>
                            <Label className="text-xs text-emerald-700">Zona (6-7)</Label>
                            <Input value={codigoManualM5.zona} onChange={(e) => handleCodigoChangeM5('zona', e.target.value, 2)} maxLength={2} className="font-mono text-center" placeholder="00" />
                            <span className="text-xs text-slate-400">00=Rural, 01=Urbano</span>
                          </div>
                          <div>
                            <Label className="text-xs text-amber-700">Sector (8-9)</Label>
                            <Input value={codigoManualM5.sector} onChange={(e) => handleCodigoChangeM5('sector', e.target.value, 2)} maxLength={2} className="font-mono text-center" placeholder="00" />
                            {ultimaManzanaM5 && ultimaManzanaM5.ultima_manzana && (
                              <div className="mt-1 p-1.5 bg-amber-50 border border-amber-200 rounded text-xs">
                                <span className="text-amber-700">Última manzana: <strong>{ultimaManzanaM5.ultima_manzana}</strong></span>
                              </div>
                            )}
                          </div>
                          <div>
                            <Label className="text-xs text-purple-700">Comuna (10-11)</Label>
                            <Input value={codigoManualM5.comuna} onChange={(e) => handleCodigoChangeM5('comuna', e.target.value, 2)} maxLength={2} className="font-mono text-center" placeholder="00" />
                          </div>
                          <div>
                            <Label className="text-xs text-pink-700">Barrio (12-13)</Label>
                            <Input value={codigoManualM5.barrio} onChange={(e) => handleCodigoChangeM5('barrio', e.target.value, 2)} maxLength={2} className="font-mono text-center" placeholder="00" />
                          </div>
                          <div>
                            <Label className="text-xs text-cyan-700">Manzana (14-17)</Label>
                            <Input value={codigoManualM5.manzana_vereda} onChange={(e) => handleCodigoChangeM5('manzana_vereda', e.target.value, 4)} maxLength={4} className="font-mono text-center" placeholder="0000" />
                          </div>
                        </div>

                        {/* Mostrar últimos predios existentes en la manzana */}
                        {codigoManualM5.manzana_vereda !== '0000' && (
                          <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 mb-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-medium text-cyan-700 flex items-center gap-1">
                                <FileText className="w-3 h-3" /> Terrenos existentes en manzana {codigoManualM5.manzana_vereda}
                              </p>
                              {buscandoPrediosManzanaM5 && <Loader2 className="w-3 h-3 animate-spin text-cyan-600" />}
                            </div>
                            {prediosEnManzanaM5.length > 0 ? (
                              <div className="space-y-1">
                                {prediosEnManzanaM5.map((p, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-xs bg-white rounded px-2 py-1.5 border border-cyan-100">
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
                                  <p className="text-[10px] text-cyan-600">Mostrando últimos {prediosEnManzanaM5.length} terrenos únicos</p>
                                  <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                                    💡 Siguiente: <span className="font-mono font-bold">{siguienteTerrenoSugeridoM5}</span>
                                  </p>
                                </div>
                              </div>
                            ) : !buscandoPrediosManzanaM5 ? (
                              <p className="text-xs text-cyan-600">No hay predios registrados en esta manzana</p>
                            ) : null}
                          </div>
                        )}

                        {/* Campos editables - Fila 2: Predio y PH */}
                        <div className="grid grid-cols-5 gap-2">
                          <div className="bg-red-50 p-2 rounded border border-red-200">
                            <Label className="text-xs text-red-700 font-semibold">Terreno (18-21) *</Label>
                            <Input value={codigoManualM5.terreno} onChange={(e) => handleCodigoChangeM5('terreno', e.target.value, 4)} maxLength={4} className="font-mono font-bold text-red-700 text-center" placeholder="0001" />
                          </div>
                          <div>
                            <Label className="text-xs text-orange-700">Condición (22)</Label>
                            <Input type="number" min="0" max="9" value={codigoManualM5.condicion} onChange={(e) => { const v = e.target.value.slice(0, 1); setCodigoManualM5(prev => ({...prev, condicion: v || '0'})); }} maxLength={1} className="font-mono text-center" placeholder="0" />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-600">Edificio (23-24)</Label>
                            <Input value={codigoManualM5.edificio} onChange={(e) => handleCodigoChangeM5('edificio', e.target.value, 2)} maxLength={2} className="font-mono text-center" placeholder="00" />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-600">Piso (25-26)</Label>
                            <Input value={codigoManualM5.piso} onChange={(e) => handleCodigoChangeM5('piso', e.target.value, 2)} maxLength={2} className="font-mono text-center" placeholder="00" />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-600">Unidad (27-30)</Label>
                            <Input value={codigoManualM5.unidad} onChange={(e) => handleCodigoChangeM5('unidad', e.target.value, 4)} maxLength={4} className="font-mono text-center" placeholder="0000" />
                          </div>
                        </div>

                        {/* Botón de verificar */}
                        <div className="mt-4 flex gap-3">
                          <Button onClick={verificarCodigoCompletoM5} variant="outline" className="flex-1">
                            <Search className="w-4 h-4 mr-2" /> Verificar Código
                          </Button>
                        </div>
                      </div>

                      {/* Info del terreno disponible */}
                      {terrenoInfoM5 && (
                        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg">
                          <h4 className="font-semibold text-emerald-800 mb-2 flex items-center gap-2">
                            <MapPin className="w-4 h-4" /> Sugerencia para esta Manzana/Vereda
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                            <div>
                              <span className="text-slate-500">Predios activos:</span>
                              <p className="font-bold text-emerald-700">{terrenoInfoM5.total_activos}</p>
                            </div>
                            <div>
                              <span className="text-slate-500">Siguiente terreno:</span>
                              <p className="font-bold text-emerald-700 text-lg">{terrenoInfoM5.siguiente_terreno}</p>
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                              <span className="text-slate-500">Código sugerido:</span>
                              <p className="font-bold text-slate-800 text-xs font-mono break-all">{terrenoInfoM5.codigo_sugerido}</p>
                            </div>
                            <div>
                              <span className="text-slate-500">Base Gráfica:</span>
                              <p className={`font-bold ${terrenoInfoM5.tiene_geometria_gdb ? 'text-emerald-700' : 'text-amber-600'}`}>
                                {terrenoInfoM5.tiene_geometria_gdb ? '✅ Disponible' : '⚠️ No disponible'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Resultado de verificación */}
                      {verificacionCodigoM5 && (
                        <div className={`p-4 rounded-lg border ${
                          verificacionCodigoM5.estado === 'disponible' ? 'bg-emerald-50 border-emerald-300' :
                          verificacionCodigoM5.estado === 'eliminado' ? 'bg-amber-50 border-amber-300' :
                          'bg-red-50 border-red-300'
                        }`}>
                          <p className={`font-semibold ${
                            verificacionCodigoM5.estado === 'disponible' ? 'text-emerald-800' :
                            verificacionCodigoM5.estado === 'eliminado' ? 'text-amber-800' : 'text-red-800'
                          }`}>
                            {verificacionCodigoM5.mensaje}
                          </p>
                          {verificacionCodigoM5.estado === 'existente' && (
                            <div className="mt-2 text-sm text-red-700">
                              <p>Propietario actual: {verificacionCodigoM5.predio?.nombre_propietario}</p>
                              <p>No puede crear un predio con este código.</p>
                            </div>
                          )}
                        </div>
                      )}
                    </TabsContent>
                    
                    {/* =========== TAB 2: PROPIETARIO (R1) =========== */}
                    <TabsContent value="propietario" className="space-y-4 mt-4">
                      {/* Sección de Propietarios - Múltiples */}
                      <div className="flex justify-between items-center">
                        <h4 className="font-semibold text-slate-800">Propietarios</h4>
                        <Button type="button" variant="outline" size="sm" onClick={agregarPropietarioM5} className="text-emerald-700">
                          <Plus className="w-4 h-4 mr-1" /> Agregar Propietario
                        </Button>
                      </div>
                      
                      {propietariosM5.map((prop, index) => (
                        <div key={index} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-sm font-medium text-slate-700">Propietario {index + 1}</span>
                            {propietariosM5.length > 1 && (
                              <Button type="button" variant="ghost" size="sm" onClick={() => eliminarPropietarioM5(index)} className="text-red-600 hover:text-red-700">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                              <Label className="text-xs">Nombre Completo *</Label>
                              <Input value={prop.nombre_propietario || ''} onChange={(e) => actualizarPropietarioM5(index, 'nombre_propietario', e.target.value.toUpperCase())} placeholder="PÉREZ GARCÍA JUAN CARLOS" className="font-mono" />
                            </div>
                            <div className="col-span-2">
                              <Label className="text-xs">Estado Civil</Label>
                              <RadioGroup value={prop.estado_civil || ''} onValueChange={(v) => actualizarPropietarioM5(index, 'estado_civil', v)} className="flex flex-wrap gap-2 mt-1">
                                <div className="flex items-center space-x-1"><RadioGroupItem value="" id={`m5_estado_${index}_sin`} /><Label htmlFor={`m5_estado_${index}_sin`} className="text-xs cursor-pointer text-slate-500">Sin especificar</Label></div>
                                <div className="flex items-center space-x-1"><RadioGroupItem value="S" id={`m5_estado_${index}_sol`} /><Label htmlFor={`m5_estado_${index}_sol`} className="text-xs cursor-pointer">S: Soltero/a</Label></div>
                                <div className="flex items-center space-x-1"><RadioGroupItem value="C" id={`m5_estado_${index}_cas`} /><Label htmlFor={`m5_estado_${index}_cas`} className="text-xs cursor-pointer">C: Casado/a</Label></div>
                                <div className="flex items-center space-x-1"><RadioGroupItem value="V" id={`m5_estado_${index}_viu`} /><Label htmlFor={`m5_estado_${index}_viu`} className="text-xs cursor-pointer">V: Viudo/a</Label></div>
                                <div className="flex items-center space-x-1"><RadioGroupItem value="U" id={`m5_estado_${index}_uni`} /><Label htmlFor={`m5_estado_${index}_uni`} className="text-xs cursor-pointer">U: Unión libre</Label></div>
                              </RadioGroup>
                            </div>
                            <div>
                              <Label className="text-xs mb-2 block">Tipo Documento *</Label>
                              <RadioGroup value={prop.tipo_documento} onValueChange={(v) => actualizarPropietarioM5(index, 'tipo_documento', v)} className="flex flex-wrap gap-3">
                                <div className="flex items-center space-x-1"><RadioGroupItem value="C" id={`m5_tipo_doc_${index}_C`} /><Label htmlFor={`m5_tipo_doc_${index}_C`} className="text-xs cursor-pointer">CC</Label></div>
                                <div className="flex items-center space-x-1"><RadioGroupItem value="N" id={`m5_tipo_doc_${index}_N`} /><Label htmlFor={`m5_tipo_doc_${index}_N`} className="text-xs cursor-pointer">NIT</Label></div>
                                <div className="flex items-center space-x-1"><RadioGroupItem value="E" id={`m5_tipo_doc_${index}_E`} /><Label htmlFor={`m5_tipo_doc_${index}_E`} className="text-xs cursor-pointer">CE</Label></div>
                                <div className="flex items-center space-x-1"><RadioGroupItem value="T" id={`m5_tipo_doc_${index}_T`} /><Label htmlFor={`m5_tipo_doc_${index}_T`} className="text-xs cursor-pointer">TI</Label></div>
                                <div className="flex items-center space-x-1"><RadioGroupItem value="P" id={`m5_tipo_doc_${index}_P`} /><Label htmlFor={`m5_tipo_doc_${index}_P`} className="text-xs cursor-pointer">Pasaporte</Label></div>
                              </RadioGroup>
                            </div>
                            <div>
                              <Label className="text-xs">Número Documento *</Label>
                              <Input value={prop.numero_documento || ''} onChange={(e) => { const valor = e.target.value.replace(/\D/g, '').slice(0, 12); actualizarPropietarioM5(index, 'numero_documento', valor); }} placeholder="Ej: 1091672736" />
                              {prop.numero_documento && (<p className="text-xs text-emerald-600 mt-1">Formato final: <strong>{prop.numero_documento.padStart(12, '0')}</strong></p>)}
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
                            <Input value={datosR1M5.direccion} onChange={(e) => setDatosR1M5(prev => ({...prev, direccion: e.target.value.toUpperCase()}))} />
                          </div>
                          <div className="col-span-2">
                            <Label className="mb-2 block">Destino Económico *</Label>
                            <RadioGroup value={datosR1M5.destino_economico} onValueChange={(v) => setDatosR1M5(prev => ({...prev, destino_economico: v}))} className="flex flex-wrap gap-3">
                              {DESTINOS_ECONOMICOS.slice(0, 10).map(d => (
                                <div key={d.codigo} className="flex items-center space-x-1">
                                  <RadioGroupItem value={d.codigo} id={`m5_destino_${d.codigo}`} />
                                  <Label htmlFor={`m5_destino_${d.codigo}`} className="text-xs cursor-pointer">{d.nombre}</Label>
                                </div>
                              ))}
                            </RadioGroup>
                          </div>
                          <div>
                            <Label>Matrícula Inmobiliaria</Label>
                            <Input value={datosR1M5.matricula_inmobiliaria} onChange={(e) => setDatosR1M5(prev => ({...prev, matricula_inmobiliaria: e.target.value}))} placeholder="Ej: 270-8920" />
                          </div>
                          <div>
                            <Label>Avalúo (COP) *</Label>
                            <Input type="text" placeholder="Ej: 200.000" value={datosR1M5.avaluo} onChange={(e) => setDatosR1M5(prev => ({...prev, avaluo: e.target.value}))} />
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
                                <Input type="number" value={calcularAreasTotalesM5().areaTerrenoTotal.toFixed(2)} readOnly className="bg-blue-100 border-blue-300 text-blue-800 font-medium" />
                              </div>
                              <div>
                                <Label className="text-xs text-blue-700">Área Construida Total (m²)</Label>
                                <Input type="number" value={calcularAreasTotalesM5().areaConstruidaTotal.toFixed(2)} readOnly className="bg-blue-100 border-blue-300 text-blue-800 font-medium" />
                              </div>
                            </div>
                            <p className="text-xs text-blue-600 mt-2">💡 Estas áreas se calculan sumando las zonas del R2. Modifique en pestaña "Físico (R2)".</p>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                    
                    {/* =========== TAB 3: FÍSICO (R2) =========== */}
                    <TabsContent value="fisico" className="space-y-4 mt-4">
                      {/* Matrícula Inmobiliaria */}
                      <div>
                        <Label>Matrícula Inmobiliaria</Label>
                        <Input value={datosR1M5.matricula_inmobiliaria} onChange={(e) => setDatosR1M5(prev => ({...prev, matricula_inmobiliaria: e.target.value}))} placeholder="Ej: 270-8920" />
                      </div>
                      
                      {/* ═══════════ ZONAS DE TERRENO ═══════════ */}
                      <div className="border-t border-slate-200 pt-4">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-semibold text-slate-800">Zonas de Terreno</h4>
                          <Button type="button" variant="outline" size="sm" onClick={agregarZonaTerrenoM5} className="text-emerald-700">
                            <Plus className="w-4 h-4 mr-1" /> Agregar Zona
                          </Button>
                        </div>
                        
                        {zonasTermenoM5.map((zona, index) => (
                          <div key={index} className="border border-slate-200 rounded-lg p-3 bg-slate-50 mb-2">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-medium text-slate-700">Zona {index + 1}</span>
                              {zonasTermenoM5.length > 1 && (
                                <Button type="button" variant="ghost" size="sm" onClick={() => eliminarZonaTerrenoM5(index)} className="text-red-600 hover:text-red-700 h-6 w-6 p-0">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <Label className="text-xs">Zona Física</Label>
                                <Input value={zona.zona_fisica} onChange={(e) => actualizarZonaTerrenoM5(index, 'zona_fisica', e.target.value)} placeholder="Ej: 03" />
                              </div>
                              <div>
                                <Label className="text-xs">Zona Económica</Label>
                                <Input value={zona.zona_economica} onChange={(e) => actualizarZonaTerrenoM5(index, 'zona_economica', e.target.value)} placeholder="Ej: 05" />
                              </div>
                              <div>
                                <Label className="text-xs">Área Terreno (m²)</Label>
                                <Input type="number" value={zona.area_terreno} onChange={(e) => actualizarZonaTerrenoM5(index, 'area_terreno', e.target.value)} />
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {/* Subtotal Área Terreno */}
                        <div className="bg-blue-50 border border-blue-200 rounded p-2 mt-2">
                          <p className="text-sm text-blue-800">📊 <strong>Subtotal Área Terreno:</strong> {calcularAreasTotalesM5().areaTerrenoTotal.toLocaleString('es-CO', {minimumFractionDigits: 2})} m² → R1</p>
                        </div>
                      </div>
                      
                      {/* ═══════════ CONSTRUCCIONES ═══════════ */}
                      <div className="border-t border-slate-200 pt-4">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-semibold text-slate-800">Construcciones</h4>
                          <Button type="button" variant="outline" size="sm" onClick={agregarConstruccionM5} className="text-emerald-700">
                            <Plus className="w-4 h-4 mr-1" /> Agregar Construcción
                          </Button>
                        </div>
                        
                        {construccionesM5.map((const_, index) => (
                          <div key={index} className="border border-slate-200 rounded-lg p-3 bg-slate-50 mb-2">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-medium text-slate-700">Construcción {const_.id}</span>
                              {construccionesM5.length > 1 && (
                                <Button type="button" variant="ghost" size="sm" onClick={() => eliminarConstruccionM5(index)} className="text-red-600 hover:text-red-700 h-6 w-6 p-0">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                              <div>
                                <Label className="text-xs">Piso</Label>
                                <Input type="number" value={const_.piso} onChange={(e) => actualizarConstruccionM5(index, 'piso', e.target.value)} />
                              </div>
                              <div>
                                <Label className="text-xs">Habitaciones</Label>
                                <Input type="number" value={const_.habitaciones} onChange={(e) => actualizarConstruccionM5(index, 'habitaciones', e.target.value)} />
                              </div>
                              <div>
                                <Label className="text-xs">Baños</Label>
                                <Input type="number" value={const_.banos} onChange={(e) => actualizarConstruccionM5(index, 'banos', e.target.value)} />
                              </div>
                              <div>
                                <Label className="text-xs">Locales</Label>
                                <Input type="number" value={const_.locales} onChange={(e) => actualizarConstruccionM5(index, 'locales', e.target.value)} />
                              </div>
                              <div>
                                <Label className="text-xs">Tipificación</Label>
                                <Input value={const_.tipificacion} onChange={(e) => actualizarConstruccionM5(index, 'tipificacion', e.target.value)} placeholder="Ej: 01" />
                              </div>
                              <div>
                                <Label className="text-xs">Uso</Label>
                                <Input value={const_.uso} onChange={(e) => actualizarConstruccionM5(index, 'uso', e.target.value)} placeholder="Ej: 01" />
                              </div>
                              <div>
                                <Label className="text-xs">Puntaje</Label>
                                <Input type="number" value={const_.puntaje} onChange={(e) => actualizarConstruccionM5(index, 'puntaje', e.target.value)} />
                              </div>
                              <div>
                                <Label className="text-xs">Área Const. (m²)</Label>
                                <Input type="number" value={const_.area_construida} onChange={(e) => actualizarConstruccionM5(index, 'area_construida', e.target.value)} />
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {/* Subtotal Área Construida */}
                        <div className="bg-purple-50 border border-purple-200 rounded p-2 mt-2">
                          <p className="text-sm text-purple-800">📊 <strong>Subtotal Área Construida:</strong> {calcularAreasTotalesM5().areaConstruidaTotal.toLocaleString('es-CO', {minimumFractionDigits: 2})} m² → R1</p>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                  
                  </div>
                  <DialogFooter className="mt-4 border-t pt-4">
                    <Button variant="outline" onClick={() => { setShowCrearPredioM5(false); resetCrearPredioM5(); }}>Cancelar</Button>
                    <Button onClick={guardarPredioNuevoM5} disabled={guardandoPredioM5} className="bg-emerald-600 hover:bg-emerald-700">
                      {guardandoPredioM5 ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</> : <><Save className="w-4 h-4 mr-2" />Crear y Seleccionar</>}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}

          {/* Motivo de la solicitud */}
          <div>
            <Label className="text-sm font-medium">Motivo de la Solicitud</Label>
            <Textarea
              value={m5Data.motivo_solicitud}
              onChange={(e) => setM5Data(prev => ({ ...prev, motivo_solicitud: e.target.value }))}
              placeholder="Describa el motivo de la solicitud..."
              rows={3}
              className="mt-1"
            />
          </div>

          {/* Observaciones */}
          <div>
            <Label className="text-sm font-medium">Observaciones (opcional)</Label>
            <Textarea
              value={m5Data.observaciones}
              onChange={(e) => setM5Data(prev => ({ ...prev, observaciones: e.target.value }))}
              placeholder="Observaciones adicionales..."
              rows={2}
              className="mt-1"
            />
          </div>

          {/* Campo de Considerando Personalizado M5 */}
          <Card className="border-purple-200 bg-purple-50/30 mt-4">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2 text-purple-800">
                <FileText className="w-4 h-4" />
                Texto de Considerandos (Resolución)
              </CardTitle>
              <p className="text-xs text-purple-600 mt-1">
                Este texto aparecerá en la sección "CONSIDERANDO" de la resolución. Si se deja vacío, se usará el texto estándar.
              </p>
            </CardHeader>
            <CardContent className="py-2">
              <Textarea
                value={m5Data.texto_considerando || ''}
                onChange={(e) => setM5Data(prev => ({ ...prev, texto_considerando: e.target.value }))}
                placeholder={`Ejemplo: Qué, mediante solicitud radicada ${m5Data.radicado || '[RADICADO]'}, se solicita la ${m5Data.subtipo === 'cancelacion' ? 'cancelación' : 'inscripción'} del predio identificado con código predial ${m5Data.predio?.codigo_predial_nacional || '[CÓDIGO PREDIAL]'} en el municipio de ${m5Data.municipio || '[MUNICIPIO]'}...`}
                rows={5}
                className="font-mono text-sm"
                data-testid="m5-considerando-input"
              />
              <div className="mt-2 text-xs text-slate-500">
                <strong>Variables disponibles:</strong> (solicitante), (documento), (codigo_predial), (municipio), (radicado), (matricula), (vigencia)
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );

  // Renderizar formulario de Rectificación de Área
  const renderFormularioRectificacionArea = () => (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
      {/* Encabezado con información */}
      <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-5 h-5 text-cyan-600" />
          <h3 className="font-semibold text-cyan-800">Rectificación de Área</h3>
        </div>
        <p className="text-sm text-cyan-700">
          Este trámite permite corregir el área de terreno y/o construcción de un predio 
          cuando existe una diferencia entre el área registrada en el catastro y el área real.
        </p>
      </div>

      {/* Municipio */}
      <div className="relative">
        <Label className="text-sm font-medium">Municipio *</Label>
        <div
          className="w-full p-3 border rounded-lg cursor-pointer flex justify-between items-center bg-white"
          onClick={() => setShowMunicipioDropdownRectificacion(!showMunicipioDropdownRectificacion)}
          data-testid="rectificacion-municipio-select"
        >
          <span className={rectificacionData.municipio ? 'text-slate-900' : 'text-slate-400'}>
            {rectificacionData.municipio || 'Seleccione municipio'}
          </span>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </div>
        {showMunicipioDropdownRectificacion && (
          <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {MUNICIPIOS.map((mun) => (
              <div
                key={mun.codigo}
                className="px-3 py-2 hover:bg-cyan-50 cursor-pointer text-sm"
                onClick={() => {
                  setRectificacionData(prev => ({ ...prev, municipio: mun.nombre, predio: null }));
                  setShowMunicipioDropdownRectificacion(false);
                }}
              >
                {mun.nombre}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Radicado */}
      <div className="relative">
        <Label className="text-sm font-medium">Número de Radicado *</Label>
        <Input
          type="text"
          value={rectificacionData.radicado}
          onChange={(e) => {
            setRectificacionData(prev => ({ ...prev, radicado: e.target.value }));
            buscarRadicadosRectificacion(e.target.value);
          }}
          placeholder="Buscar radicado..."
          className="mt-1"
          data-testid="rectificacion-radicado-input"
        />
        {radicadosDisponiblesRectificacion.length > 0 && (
          <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
            {radicadosDisponiblesRectificacion.map((rad, idx) => (
              <div
                key={idx}
                className="px-3 py-2 hover:bg-cyan-50 cursor-pointer text-sm"
                onClick={() => {
                  setRectificacionData(prev => ({ ...prev, radicado: rad.radicado || rad.numero || (typeof rad === 'string' ? rad : '') }));
                  setRadicadosDisponiblesRectificacion([]);
                }}
              >
                <div className="font-medium">{rad.radicado || rad.numero || (typeof rad === 'string' ? rad : 'Sin radicado')}</div>
                {rad.nombre_completo && <div className="text-xs text-slate-500">{rad.nombre_completo}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Búsqueda de Predio */}
      <Card className="border-cyan-200 bg-cyan-50/30">
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2 text-cyan-800">
            <Search className="w-4 h-4" />
            Buscar Predio a Rectificar
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 space-y-3">
          <div className="flex gap-2">
            <Input
              value={searchPredioRectificacion}
              onChange={(e) => setSearchPredioRectificacion(e.target.value)}
              placeholder="Código predial, dirección, propietario..."
              onKeyPress={(e) => e.key === 'Enter' && buscarPrediosRectificacion()}
              disabled={!rectificacionData.municipio}
              data-testid="rectificacion-search-predio"
            />
            <Button
              onClick={buscarPrediosRectificacion}
              disabled={searchingPrediosRectificacion || !rectificacionData.municipio}
              className="bg-cyan-600 hover:bg-cyan-700"
              data-testid="rectificacion-search-btn"
            >
              {searchingPrediosRectificacion ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>

          {/* Resultados de búsqueda */}
          {searchResultsRectificacion.length > 0 && (
            <div className="border rounded-lg max-h-48 overflow-y-auto">
              {searchResultsRectificacion.map((predio) => (
                <div
                  key={predio.id}
                  className="p-3 hover:bg-cyan-50 cursor-pointer border-b last:border-b-0"
                  onClick={() => seleccionarPredioRectificacion(predio)}
                  data-testid={`rectificacion-predio-result-${predio.id}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-mono text-xs text-slate-600">{predio.codigo_predial_nacional || predio.NPN}</p>
                      <p className="font-medium text-sm">{predio.direccion || 'Sin dirección'}</p>
                      <p className="text-xs text-slate-500">
                        {predio.propietarios?.[0]?.nombre_propietario || predio.nombre_propietario || 'Sin propietario'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Área Terreno: {predio.area_terreno || 0} m²</p>
                      <p className="text-xs text-slate-500">Área Const: {predio.area_construida || 0} m²</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Predio Seleccionado */}
      {rectificacionData.predio && (
        <Card className="border-cyan-300 bg-cyan-50">
          <CardHeader className="py-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm text-cyan-800">Predio Seleccionado</CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setRectificacionData(prev => ({ ...prev, predio: null }))}
                className="text-cyan-700"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="py-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Código Predial</p>
                <p className="font-mono font-medium">{rectificacionData.predio.codigo_predial_nacional || rectificacionData.predio.NPN}</p>
              </div>
              <div>
                <p className="text-slate-500">Matrícula</p>
                <p className="font-medium">{getMatriculaInmobiliaria(rectificacionData.predio)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-slate-500">Dirección</p>
                <p className="font-medium">{rectificacionData.predio.direccion || 'Sin dirección'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-slate-500">Propietario</p>
                <p className="font-medium">
                  {rectificacionData.predio.propietarios?.[0]?.nombre_propietario || 
                   rectificacionData.predio.nombre_propietario || 'Sin propietario'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sección de Áreas - Solo visible si hay predio seleccionado */}
      {rectificacionData.predio && (
        <>
          {/* Zonas de Terreno */}
          <Card className="border-blue-200 bg-blue-50/30">
            <CardHeader className="py-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm text-blue-800 flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Zonas de Terreno - Rectificación
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="py-2 space-y-3">
              {/* Área anterior (solo lectura) */}
              <div className="bg-slate-100 border border-slate-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-slate-600 mb-2">Área Actual en Catastro</p>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-slate-700">{Number(rectificacionData.area_terreno_anterior).toLocaleString('es-CO', {minimumFractionDigits: 2})} m²</span>
                  <span className="text-xs text-slate-500">({zonasTerreno_Rect_Anterior.length} zona{zonasTerreno_Rect_Anterior.length !== 1 ? 's' : ''})</span>
                </div>
              </div>
              
              {/* Nueva área editable */}
              <div className="border-2 border-cyan-300 rounded-lg p-3 bg-white">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-sm font-semibold text-cyan-700">Nueva Área de Terreno (Zonas Rectificadas)</p>
                  <Button size="sm" onClick={agregarZonaTerreno_Rect} variant="outline" className="text-cyan-700 h-7">
                    <Plus className="w-3 h-3 mr-1" /> Agregar Zona
                  </Button>
                </div>
                
                {zonasTerreno_Rect_Nueva.map((zona, index) => (
                  <div key={index} className="border border-slate-200 rounded-lg p-3 bg-slate-50 mb-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-medium text-slate-600">Zona {index + 1}</span>
                      {zonasTerreno_Rect_Nueva.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => eliminarZonaTerreno_Rect(index)} className="text-red-600 h-6 w-6 p-0">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Zona Física</Label>
                        <Input value={zona.zona_fisica} onChange={(e) => actualizarZonaTerreno_Rect(index, 'zona_fisica', e.target.value)} placeholder="Ej: 03" className="h-7 text-xs" />
                      </div>
                      <div>
                        <Label className="text-xs">Zona Económica</Label>
                        <Input value={zona.zona_economica} onChange={(e) => actualizarZonaTerreno_Rect(index, 'zona_economica', e.target.value)} placeholder="Ej: 05" className="h-7 text-xs" />
                      </div>
                      <div>
                        <Label className="text-xs">Área (m²) *</Label>
                        <Input type="number" step="0.01" value={zona.area_terreno} onChange={(e) => actualizarZonaTerreno_Rect(index, 'area_terreno', e.target.value)} className="h-7 text-xs border-cyan-300" />
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Subtotal y diferencia */}
                <div className="mt-3 space-y-2">
                  <div className="bg-cyan-50 border border-cyan-200 rounded p-2">
                    <p className="text-sm text-cyan-800">
                      📊 <strong>Subtotal Nueva Área Terreno:</strong> {calcularTotales_Rect().areaTerrenoNueva.toLocaleString('es-CO', {minimumFractionDigits: 2})} m²
                    </p>
                  </div>
                  {calcularTotales_Rect().areaTerrenoNueva !== rectificacionData.area_terreno_anterior && (
                    <div className={`p-2 rounded ${
                      calcularTotales_Rect().areaTerrenoNueva > rectificacionData.area_terreno_anterior
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-red-50 border border-red-200'
                    }`}>
                      <p className="text-sm font-medium">
                        Diferencia: {' '}
                        <span className={calcularTotales_Rect().areaTerrenoNueva > rectificacionData.area_terreno_anterior ? 'text-green-700' : 'text-red-700'}>
                          {(calcularTotales_Rect().areaTerrenoNueva - rectificacionData.area_terreno_anterior).toFixed(2)} m²
                          {calcularTotales_Rect().areaTerrenoNueva > rectificacionData.area_terreno_anterior ? ' (aumenta)' : ' (disminuye)'}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Construcciones */}
          <Card className="border-amber-200 bg-amber-50/30">
            <CardHeader className="py-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm text-amber-800 flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  Construcciones - Rectificación
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="py-2 space-y-3">
              {/* Área construida anterior (solo lectura) */}
              <div className="bg-slate-100 border border-slate-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-slate-600 mb-2">Área Construida Actual</p>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-slate-700">{Number(rectificacionData.area_construida_anterior).toLocaleString('es-CO', {minimumFractionDigits: 2})} m²</span>
                  <span className="text-xs text-slate-500">({construcciones_Rect_Anterior.length} construcción{construcciones_Rect_Anterior.length !== 1 ? 'es' : ''})</span>
                </div>
              </div>
              
              {/* Nuevas construcciones editables */}
              <div className="border-2 border-amber-300 rounded-lg p-3 bg-white">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-sm font-semibold text-amber-700">Nuevas Construcciones (Rectificadas)</p>
                  <Button size="sm" onClick={agregarConstruccion_Rect} variant="outline" className="text-amber-700 h-7">
                    <Plus className="w-3 h-3 mr-1" /> Agregar Construcción
                  </Button>
                </div>
                
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {construcciones_Rect_Nueva.map((const_, index) => (
                    <div key={index} className="border border-amber-200 rounded-lg p-3 bg-amber-50/50">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold text-amber-800">Construcción {const_.id}</span>
                        {construcciones_Rect_Nueva.length > 1 && (
                          <Button variant="ghost" size="sm" onClick={() => eliminarConstruccion_Rect(index)} className="text-red-600 h-6 w-6 p-0">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <Label className="text-xs">Piso</Label>
                          <Input type="number" value={const_.piso} onChange={(e) => actualizarConstruccion_Rect(index, 'piso', e.target.value)} className="h-7 text-xs" />
                        </div>
                        <div>
                          <Label className="text-xs">Habitaciones</Label>
                          <Input type="number" value={const_.habitaciones} onChange={(e) => actualizarConstruccion_Rect(index, 'habitaciones', e.target.value)} className="h-7 text-xs" />
                        </div>
                        <div>
                          <Label className="text-xs">Baños</Label>
                          <Input type="number" value={const_.banos} onChange={(e) => actualizarConstruccion_Rect(index, 'banos', e.target.value)} className="h-7 text-xs" />
                        </div>
                        <div>
                          <Label className="text-xs">Locales</Label>
                          <Input type="number" value={const_.locales} onChange={(e) => actualizarConstruccion_Rect(index, 'locales', e.target.value)} className="h-7 text-xs" />
                        </div>
                        <div>
                          <Label className="text-xs">Tipificación</Label>
                          <Input value={const_.tipificacion} onChange={(e) => actualizarConstruccion_Rect(index, 'tipificacion', e.target.value.toUpperCase())} className="h-7 text-xs" />
                        </div>
                        <div>
                          <Label className="text-xs">Uso</Label>
                          <Input value={const_.uso} onChange={(e) => actualizarConstruccion_Rect(index, 'uso', e.target.value.toUpperCase())} className="h-7 text-xs" />
                        </div>
                        <div>
                          <Label className="text-xs">Puntaje</Label>
                          <Input type="number" value={const_.puntaje} onChange={(e) => actualizarConstruccion_Rect(index, 'puntaje', e.target.value)} className="h-7 text-xs" />
                        </div>
                        <div>
                          <Label className="text-xs">Área (m²) *</Label>
                          <Input type="number" step="0.01" value={const_.area_construida} onChange={(e) => actualizarConstruccion_Rect(index, 'area_construida', e.target.value)} className="h-7 text-xs border-amber-400" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Subtotal área construida */}
                <div className="mt-3 space-y-2">
                  <div className="bg-amber-50 border border-amber-200 rounded p-2">
                    <p className="text-sm text-amber-800">
                      📊 <strong>Subtotal Nueva Área Construida:</strong> {calcularTotales_Rect().areaConstruidaNueva.toLocaleString('es-CO', {minimumFractionDigits: 2})} m²
                    </p>
                  </div>
                  {calcularTotales_Rect().areaConstruidaNueva !== rectificacionData.area_construida_anterior && (
                    <div className={`p-2 rounded ${
                      calcularTotales_Rect().areaConstruidaNueva > rectificacionData.area_construida_anterior
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-red-50 border border-red-200'
                    }`}>
                      <p className="text-sm font-medium">
                        Diferencia: {' '}
                        <span className={calcularTotales_Rect().areaConstruidaNueva > rectificacionData.area_construida_anterior ? 'text-green-700' : 'text-red-700'}>
                          {(calcularTotales_Rect().areaConstruidaNueva - rectificacionData.area_construida_anterior).toFixed(2)} m²
                          {calcularTotales_Rect().areaConstruidaNueva > rectificacionData.area_construida_anterior ? ' (aumenta)' : ' (disminuye)'}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Nuevo Avalúo */}
          <Card className="border-emerald-200 bg-emerald-50/30">
            <CardHeader className="py-2">
              <CardTitle className="text-sm text-emerald-800 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Avalúo
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-600">Avalúo Actual ($)</Label>
                  <div className="mt-1 p-2 bg-slate-100 rounded text-sm font-medium">
                    ${Number(rectificacionData.predio.avaluo || 0).toLocaleString('es-CO')}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-emerald-700 font-medium">Nuevo Avalúo ($)</Label>
                  <Input
                    type="number"
                    step="1000"
                    value={rectificacionData.avaluo_nuevo}
                    onChange={(e) => setRectificacionData(prev => ({ ...prev, avaluo_nuevo: e.target.value }))}
                    className="mt-1 h-9 border-emerald-300 focus:border-emerald-500"
                    data-testid="rectificacion-avaluo-nuevo"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Motivo de la solicitud */}
          <div>
            <Label className="text-sm font-medium">Motivo de la Rectificación</Label>
            <Textarea
              value={rectificacionData.motivo_solicitud}
              onChange={(e) => setRectificacionData(prev => ({ ...prev, motivo_solicitud: e.target.value }))}
              placeholder="Ej: Corrección de área según medición técnica realizada..."
              className="mt-1"
              rows={2}
              data-testid="rectificacion-motivo"
            />
          </div>

          {/* Observaciones */}
          <div>
            <Label className="text-sm font-medium">Observaciones Adicionales</Label>
            <Textarea
              value={rectificacionData.observaciones}
              onChange={(e) => setRectificacionData(prev => ({ ...prev, observaciones: e.target.value }))}
              placeholder="Observaciones adicionales..."
              className="mt-1"
              rows={2}
              data-testid="rectificacion-observaciones"
            />
          </div>

          {/* Texto de Considerandos */}
          <Card className="border-slate-200">
            <CardHeader className="py-3">
              <CardTitle className="text-sm text-slate-700">Texto de Considerandos (Opcional)</CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <Textarea
                value={rectificacionData.texto_considerando}
                onChange={(e) => setRectificacionData(prev => ({ ...prev, texto_considerando: e.target.value }))}
                placeholder="Deje en blanco para usar el texto predeterminado..."
                rows={4}
                className="text-sm"
                data-testid="rectificacion-considerandos"
              />
              <div className="mt-2 text-xs text-slate-500">
                <strong>Variables disponibles:</strong> (solicitante), (documento), (codigo_predial), (municipio), (radicado), (matricula), (area_terreno_anterior), (area_terreno_nueva), (area_construida_anterior), (area_construida_nueva)
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );

  // Renderizar formulario de Complementación de Información
  const renderFormularioComplementacion = () => (
    <div className="space-y-6 max-h-[70vh] overflow-visible pr-2">
      {/* Encabezado con información */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold text-slate-800">Complementación de Información</h3>
        </div>
        <p className="text-sm text-slate-700">
          Este trámite permite complementar la información catastral de un predio 
          cuando se requiere agregar o corregir datos faltantes en el registro.
        </p>
      </div>

      {/* Municipio */}
      <div className="relative">
        <Label className="text-sm font-medium">Municipio *</Label>
        <div
          className="w-full p-3 border rounded-lg cursor-pointer flex justify-between items-center bg-white"
          onClick={() => setShowMunicipioDropdownComplementacion(!showMunicipioDropdownComplementacion)}
          data-testid="complementacion-municipio-select"
        >
          <span className={complementacionData.municipio ? 'text-slate-900' : 'text-slate-400'}>
            {complementacionData.municipio || 'Seleccione municipio'}
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showMunicipioDropdownComplementacion ? 'rotate-180' : ''}`} />
        </div>
        {showMunicipioDropdownComplementacion && (
          <div className="absolute z-[99999] w-full bottom-full mb-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {MUNICIPIOS.map(mun => (
              <div
                key={mun.codigo}
                className="p-2 hover:bg-slate-100 cursor-pointer"
                onClick={() => {
                  setComplementacionData(prev => ({ ...prev, municipio: mun.nombre, predio: null }));
                  setShowMunicipioDropdownComplementacion(false);
                  setSearchPredioComplementacion('');
                  setSearchResultsComplementacion([]);
                }}
              >
                {mun.nombre}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Buscar Predio */}
      {complementacionData.municipio && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Buscar Predio *</Label>
          <div className="relative">
            <Input
              value={searchPredioComplementacion}
              onChange={async (e) => {
                const valor = e.target.value;
                setSearchPredioComplementacion(valor);
                
                if (valor.length >= 3) {
                  setSearchingPrediosComplementacion(true);
                  try {
                    const tokenLocal = localStorage.getItem('token');
                    const municipioCodigo = MUNICIPIOS.find(m => m.nombre === complementacionData.municipio)?.codigo;
                    const response = await axios.get(`${API}/predios/buscar-municipio/${municipioCodigo}`, {
                      params: { q: valor, limit: 10 },
                      headers: { Authorization: `Bearer ${tokenLocal}` }
                    });
                    setSearchResultsComplementacion(response.data.predios || []);
                  } catch (error) {
                    console.error('Error buscando predios:', error);
                  } finally {
                    setSearchingPrediosComplementacion(false);
                  }
                } else {
                  setSearchResultsComplementacion([]);
                }
              }}
              placeholder="Buscar por código predial, dirección o propietario..."
              className="pr-10"
              data-testid="complementacion-buscar-predio"
            />
            {searchingPrediosComplementacion && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
            )}
          </div>
          
          {/* Resultados de búsqueda */}
          {searchResultsComplementacion.length > 0 && (
            <div className="border rounded-lg max-h-48 overflow-y-auto">
              {searchResultsComplementacion.map((predio, idx) => (
                <div
                  key={idx}
                  className="p-2 hover:bg-slate-100 cursor-pointer border-b last:border-b-0"
                  onClick={() => {
                    const areaTerreno = predio.area_terreno || predio.r1_registros?.[0]?.area_terreno || 0;
                    const areaConstruida = predio.area_construida || predio.r1_registros?.[0]?.area_construida || 0;
                    const avaluo = predio.avaluo || predio.r1_registros?.[0]?.avaluo || 0;
                    
                    setComplementacionData(prev => ({
                      ...prev,
                      predio: predio,
                      area_terreno_nueva: areaTerreno,
                      area_construida_nueva: areaConstruida,
                      avaluo_nuevo: avaluo
                    }));
                    setSearchPredioComplementacion('');
                    setSearchResultsComplementacion([]);
                  }}
                >
                  <p className="font-medium text-sm">{predio.codigo_predial_nacional || predio.numero_predio}</p>
                  <p className="text-xs text-slate-500">{predio.direccion}</p>
                  <p className="text-xs text-slate-400">{predio.nombre_propietario || 'Sin propietario'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Predio Seleccionado */}
      {complementacionData.predio && (
        <>
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm">Predio Seleccionado</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setComplementacionData(prev => ({ ...prev, predio: null }))}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-slate-500">Código:</span>
                  <p className="font-medium">{complementacionData.predio.codigo_predial_nacional}</p>
                </div>
                <div>
                  <span className="text-slate-500">Dirección:</span>
                  <p className="font-medium">{complementacionData.predio.direccion || 'Sin dirección'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Área Terreno:</span>
                  <p className="font-medium">{complementacionData.predio.area_terreno || complementacionData.predio.r1_registros?.[0]?.area_terreno || 0} m²</p>
                </div>
                <div>
                  <span className="text-slate-500">Área Construida:</span>
                  <p className="font-medium">{complementacionData.predio.area_construida || complementacionData.predio.r1_registros?.[0]?.area_construida || 0} m²</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Nuevos valores */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Edit className="w-4 h-4 text-slate-600" />
                Información a Complementar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Nueva Área Terreno (m²)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={complementacionData.area_terreno_nueva}
                    onChange={(e) => setComplementacionData(prev => ({ ...prev, area_terreno_nueva: parseFloat(e.target.value) || 0 }))}
                    data-testid="complementacion-area-terreno"
                  />
                </div>
                <div>
                  <Label className="text-xs">Nueva Área Construida (m²)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={complementacionData.area_construida_nueva}
                    onChange={(e) => setComplementacionData(prev => ({ ...prev, area_construida_nueva: parseFloat(e.target.value) || 0 }))}
                    data-testid="complementacion-area-construida"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Nuevo Avalúo ($)</Label>
                <Input
                  type="number"
                  value={complementacionData.avaluo_nuevo}
                  onChange={(e) => setComplementacionData(prev => ({ ...prev, avaluo_nuevo: parseFloat(e.target.value) || 0 }))}
                  data-testid="complementacion-avaluo"
                />
              </div>
            </CardContent>
          </Card>

          {/* Documentos de Soporte */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-600" />
                Documentos de Soporte
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={complementacionData.documentos_soporte}
                onChange={(e) => setComplementacionData(prev => ({ ...prev, documentos_soporte: e.target.value }))}
                placeholder="Ej: Oficio de solicitud, Cédula del propietario, Certificado de libertad y tradición..."
                rows={3}
                className="text-sm"
                data-testid="complementacion-documentos"
              />
            </CardContent>
          </Card>

          {/* Texto de Considerandos */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-600" />
                Texto de Considerandos (Opcional)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={complementacionData.texto_considerando}
                onChange={(e) => setComplementacionData(prev => ({ ...prev, texto_considerando: e.target.value }))}
                placeholder="Deje en blanco para usar el texto predeterminado..."
                rows={4}
                className="text-sm"
                data-testid="complementacion-considerandos"
              />
              <div className="mt-2 text-xs text-slate-500">
                <strong>Variables disponibles:</strong> (solicitante), (documento), (codigo_predial), (municipio), (radicado), (matricula), (vigencia)
              </div>
            </CardContent>
          </Card>

          {/* Observaciones */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Observaciones</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={complementacionData.observaciones}
                onChange={(e) => setComplementacionData(prev => ({ ...prev, observaciones: e.target.value }))}
                placeholder="Observaciones adicionales..."
                rows={2}
                className="text-sm"
                data-testid="complementacion-observaciones"
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );

  // Renderizar formulario de Bloqueo de Predios
  const renderFormularioBloqueo = () => (
    <div className="space-y-6 max-h-[70vh] overflow-visible pr-2">
      {/* Encabezado con información */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Lock className="w-5 h-5 text-red-600" />
          <h3 className="font-semibold text-red-800">Bloqueo de Predios por Proceso Legal</h3>
        </div>
        <p className="text-sm text-red-700">
          Bloquee predios que tienen procesos legales activos para evitar modificaciones no autorizadas.
          Solo los coordinadores pueden bloquear y desbloquear predios.
        </p>
      </div>

      {/* Tabs internos: Bloquear / Ver Bloqueados */}
      <Tabs value={bloqueoTab} onValueChange={(val) => {
        setBloqueoTab(val);
        if (val === 'bloqueados') {
          cargarPrediosBloqueados();
        }
      }}>
        <TabsList className="grid w-full grid-cols-2 max-w-md mb-4">
          <TabsTrigger value="bloquear" className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Bloquear Predio
          </TabsTrigger>
          <TabsTrigger value="bloqueados" className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Bloqueados ({prediosBloqueados.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bloquear" className="space-y-4" style={{ overflow: 'visible' }}>
          {/* Municipio */}
          <div className="relative">
            <Label className="text-sm font-medium">Municipio *</Label>
            <div
              className="w-full p-3 border rounded-lg cursor-pointer flex justify-between items-center bg-white"
              onClick={() => setShowBloqueoMunicipioDropdown(!showBloqueoMunicipioDropdown)}
              data-testid="bloqueo-municipio-select"
            >
              <span className={bloqueoMunicipio ? 'text-slate-900' : 'text-slate-400'}>
                {bloqueoMunicipio || 'Seleccione municipio'}
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showBloqueoMunicipioDropdown ? 'rotate-180' : ''}`} />
            </div>
            {showBloqueoMunicipioDropdown && (
              <div className="absolute z-[99999] w-full bottom-full mb-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {MUNICIPIOS.map(mun => (
                  <div
                    key={mun.codigo}
                    className="p-2 hover:bg-slate-100 cursor-pointer"
                    onClick={() => {
                      setBloqueoMunicipio(mun.nombre);
                      setShowBloqueoMunicipioDropdown(false);
                      setBloqueoPredioSeleccionado(null);
                      setBloqueoPredioSearch('');
                      setBloqueoPredioResults([]);
                    }}
                  >
                    {mun.nombre}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Buscar Predio */}
          {bloqueoMunicipio && (
            <div className="space-y-2 relative" style={{ zIndex: 100 }}>
              <Label className="text-sm font-medium">Buscar Predio *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={bloqueoPredioSearch}
                  onChange={(e) => {
                    const valor = e.target.value;
                    setBloqueoPredioSearch(valor);
                    if (valor.length >= 3) {
                      buscarPredioParaBloqueo(valor);
                    } else {
                      setBloqueoPredioResults([]);
                    }
                  }}
                  placeholder="Buscar por código, dirección, propietario o matrícula (mín. 3 caracteres)..."
                  className="pl-10 pr-10"
                  data-testid="bloqueo-buscar-predio"
                />
                {bloqueoPredioSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
                )}
              </div>
              
              {/* Resultados de búsqueda - contenedor separado que no se corta */}
              {bloqueoPredioResults.length > 0 && !bloqueoPredioSeleccionado && (
                <div className="bg-white border rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  {bloqueoPredioResults.map((predio, idx) => (
                    <div
                      key={idx}
                      className={`p-3 hover:bg-slate-100 cursor-pointer border-b last:border-b-0 ${predio.bloqueado ? 'bg-red-50' : ''}`}
                      onClick={() => {
                        if (predio.bloqueado) {
                          toast.error('Este predio ya está bloqueado');
                          return;
                        }
                        setBloqueoPredioSeleccionado(predio);
                        setBloqueoPredioSearch('');
                        setBloqueoPredioResults([]);
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-sm">{predio.codigo_predial_nacional || predio.numero_predio}</p>
                          <p className="text-xs text-slate-500">{predio.direccion}</p>
                          <p className="text-xs text-slate-400">
                            {predio.propietarios?.[0]?.nombre_propietario || predio.nombre_propietario || 'Sin propietario'}
                          </p>
                        </div>
                        {predio.bloqueado && (
                          <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full">BLOQUEADO</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Predio Seleccionado */}
          {bloqueoPredioSeleccionado && (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-amber-600" />
                    Predio a Bloquear
                  </CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setBloqueoPredioSeleccionado(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-500">Código Predial:</span>
                    <p className="font-medium">{bloqueoPredioSeleccionado.codigo_predial_nacional || bloqueoPredioSeleccionado.numero_predio}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Dirección:</span>
                    <p className="font-medium">{bloqueoPredioSeleccionado.direccion || 'Sin dirección'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Propietario:</span>
                    <p className="font-medium">
                      {bloqueoPredioSeleccionado.propietarios?.[0]?.nombre_propietario || 
                       bloqueoPredioSeleccionado.nombre_propietario || 'No registrado'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Municipio:</span>
                    <p className="font-medium">{bloqueoPredioSeleccionado.municipio || bloqueoMunicipio}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Matrícula Inmobiliaria:</span>
                    <p className="font-medium">
                      {bloqueoPredioSeleccionado.matricula_inmobiliaria || 
                       bloqueoPredioSeleccionado.r2_registros?.[0]?.matricula_inmobiliaria || 'Sin matrícula'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Avalúo:</span>
                    <p className="font-medium">
                      {bloqueoPredioSeleccionado.avaluo 
                        ? `$${bloqueoPredioSeleccionado.avaluo.toLocaleString('es-CO')}`
                        : 'Sin avalúo'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Área Terreno:</span>
                    <p className="font-medium">
                      {bloqueoPredioSeleccionado.area_terreno 
                        ? formatAreaHectareas(bloqueoPredioSeleccionado.area_terreno)
                        : 'Sin información'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Área Construida:</span>
                    <p className="font-medium">
                      {bloqueoPredioSeleccionado.area_construida 
                        ? `${bloqueoPredioSeleccionado.area_construida.toLocaleString('es-CO')} m²`
                        : 'Sin construcción'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Formulario de Bloqueo */}
          {bloqueoPredioSeleccionado && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Información del Bloqueo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Motivo del Bloqueo *</Label>
                  <Textarea
                    value={bloqueoFormData.motivo}
                    onChange={(e) => setBloqueoFormData(prev => ({ ...prev, motivo: e.target.value }))}
                    placeholder="Ej: Proceso legal activo - Embargo ordenado por el Juzgado..."
                    rows={3}
                    data-testid="bloqueo-motivo"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">Número de Proceso</Label>
                    <Input
                      value={bloqueoFormData.numero_proceso}
                      onChange={(e) => setBloqueoFormData(prev => ({ ...prev, numero_proceso: e.target.value }))}
                      placeholder="Ej: 2024-00123"
                      data-testid="bloqueo-numero-proceso"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Entidad Judicial</Label>
                    <Input
                      value={bloqueoFormData.entidad_judicial}
                      onChange={(e) => setBloqueoFormData(prev => ({ ...prev, entidad_judicial: e.target.value }))}
                      placeholder="Ej: Juzgado 3ro Civil Municipal"
                      data-testid="bloqueo-entidad"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-sm">Observaciones Adicionales</Label>
                  <Textarea
                    value={bloqueoFormData.observaciones}
                    onChange={(e) => setBloqueoFormData(prev => ({ ...prev, observaciones: e.target.value }))}
                    placeholder="Observaciones adicionales..."
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="bloqueados" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">
              {prediosBloqueados.length} predio(s) bloqueado(s)
            </p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={cargarPrediosBloqueados}
              disabled={loadingBloqueados}
            >
              {loadingBloqueados ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>

          {loadingBloqueados ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : prediosBloqueados.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Lock className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No hay predios bloqueados</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[50vh] overflow-y-auto">
              {prediosBloqueados.map((predio, idx) => (
                <Card key={idx} className="border-red-200 bg-red-50">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Lock className="w-4 h-4 text-red-600" />
                          <span className="font-medium text-red-800">
                            {predio.codigo_predial_nacional || predio.codigo_predial}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600">{predio.direccion}</p>
                        <p className="text-xs text-slate-500">{predio.municipio}</p>
                        
                        {predio.bloqueo_info && (
                          <div className="mt-2 p-2 bg-white rounded border border-red-100">
                            <p className="text-sm font-medium text-red-800">
                              {predio.bloqueo_info.motivo}
                            </p>
                            {predio.bloqueo_info.numero_proceso && (
                              <p className="text-xs text-slate-500">
                                Proceso: {predio.bloqueo_info.numero_proceso}
                              </p>
                            )}
                            <p className="text-xs text-slate-400 mt-1">
                              Bloqueado por: {predio.bloqueo_info.bloqueado_por_nombre}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => verHistorialBloqueo(predio)}
                          className="text-xs"
                        >
                          <History className="w-3 h-3 mr-1" />
                          Historial
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            setPredioADesbloquear(predio);
                            setShowDesbloqueoModal(true);
                          }}
                          className="bg-green-600 hover:bg-green-700 text-xs"
                        >
                          <Unlock className="w-3 h-3 mr-1" />
                          Desbloquear
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );

  // Renderizar selector de tipo de mutación
  const renderSelectorTipo = () => (
    <div className="space-y-4">
      {/* Mostrar predio pre-cargado si existe */}
      {predioPreCargado && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-emerald-600 font-medium">Predio seleccionado:</p>
            <p className="font-bold text-emerald-800">{predioPreCargado.codigo_predial_nacional || predioPreCargado.numero_predio}</p>
            <p className="text-xs text-emerald-600">{predioPreCargado.direccion} - {predioPreCargado.nombre_propietario}</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setPredioPreCargado(null)}
            className="text-emerald-700"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.values(TIPOS_MUTACION)
          .filter((tipo) => {
            // Ocultar BLOQUEO si no es coordinador/admin
            if (tipo.soloCoordinador && !puedeAprobar) return false;
            return true;
          })
          .map((tipo) => (
          <Card 
            key={tipo.codigo}
            data-testid={`mutacion-card-${tipo.codigo}`}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              !tipo.enabled ? 'opacity-50 cursor-not-allowed' : 
              tipo.codigo === 'BLOQUEO' ? 'hover:border-red-500 border-red-200' : 'hover:border-emerald-500'
            }`}
            onClick={() => {
              if (tipo.enabled) {
                handleAbrirMutacion(tipo);
              }
            }}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <Badge className={tipo.color}>
                    {tipo.codigo === 'BLOQUEO' && <Lock className="w-3 h-3 mr-1 inline" />}
                    {tipo.codigoDisplay || tipo.codigo}
                  </Badge>
                  <h3 className="font-semibold text-lg mt-2">{tipo.nombre}</h3>
                  <p className="text-sm text-slate-600 mt-1">{tipo.descripcion}</p>
                </div>
                {tipo.enabled ? (
                  tipo.codigo === 'BLOQUEO' ? (
                    <Lock className="w-5 h-5 text-red-600" />
                  ) : (
                    <ArrowRight className="w-5 h-5 text-emerald-600" />
                  )
                ) : (
                  <Badge variant="outline" className="text-xs">Próximamente</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  // Renderizar formulario M2
  const renderFormularioM2 = () => (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
      {/* Tipo de M2 - Descripción mejorada */}
      <div className="grid grid-cols-2 gap-4">
        <div 
          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
            m2Data.subtipo === 'desengloble' 
              ? 'border-purple-600 bg-purple-50' 
              : 'border-slate-200 hover:border-purple-300'
          }`}
          onClick={() => setM2Data(prev => ({ ...prev, subtipo: 'desengloble' }))}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              m2Data.subtipo === 'desengloble' ? 'border-purple-600 bg-purple-600' : 'border-slate-300'
            }`}>
              {m2Data.subtipo === 'desengloble' && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className={`font-semibold ${m2Data.subtipo === 'desengloble' ? 'text-purple-700' : 'text-slate-700'}`}>
              Desenglobe (División)
            </span>
          </div>
          <p className="text-xs text-slate-500 ml-7">
            Un predio se divide en múltiples predios resultantes
          </p>
        </div>
        <div 
          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
            m2Data.subtipo === 'englobe' 
              ? 'border-purple-600 bg-purple-50' 
              : 'border-slate-200 hover:border-purple-300'
          }`}
          onClick={() => setM2Data(prev => ({ ...prev, subtipo: 'englobe' }))}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              m2Data.subtipo === 'englobe' ? 'border-purple-600 bg-purple-600' : 'border-slate-300'
            }`}>
              {m2Data.subtipo === 'englobe' && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className={`font-semibold ${m2Data.subtipo === 'englobe' ? 'text-purple-700' : 'text-slate-700'}`}>
              Englobe (Fusión)
            </span>
          </div>
          <p className="text-xs text-slate-500 ml-7">
            Múltiples predios se fusionan en un solo predio
          </p>
        </div>
      </div>

      {/* Municipio - Dropdown personalizado */}
      <div className="grid grid-cols-2 gap-4">
        <div className="relative">
          <Label>Municipio *</Label>
          <div 
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-white px-3 py-2 text-sm cursor-pointer hover:bg-slate-50"
            onClick={() => setShowMunicipioDropdownM2(!showMunicipioDropdownM2)}
          >
            <span className={m2Data.municipio ? 'text-slate-900' : 'text-slate-500'}>
              {m2Data.municipio ? MUNICIPIOS.find(m => m.codigo === m2Data.municipio)?.nombre : 'Seleccionar municipio'}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </div>
          {showMunicipioDropdownM2 && (
            <div className="absolute z-[99999] mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {MUNICIPIOS.map(m => (
                <div
                  key={m.codigo}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-purple-50 ${m2Data.municipio === m.codigo ? 'bg-purple-100 text-purple-800' : ''}`}
                  onClick={() => {
                    setM2Data(prev => ({ ...prev, municipio: m.codigo }));
                    setShowMunicipioDropdownM2(false);
                  }}
                >
                  {m.nombre}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Radicado - Obligatorio con búsqueda */}
        <div>
          <Label className="text-purple-700">Número de Radicado *</Label>
          <div className="relative">
            <Input
              value={m2Data.radicado}
              onChange={(e) => {
                const valor = e.target.value.toUpperCase();
                setM2Data(prev => ({ ...prev, radicado: valor }));
                buscarRadicadosM2(valor);
              }}
              placeholder="Escribir número de radicado..."
              className={!m2Data.radicado ? 'border-red-300' : ''}
            />
            {radicadosDisponiblesM2.length > 0 && (
              <div className="absolute z-[99999] w-full mt-1 bg-white border border-purple-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {radicadosDisponiblesM2.map(rad => (
                  <button
                    key={rad.id}
                    type="button"
                    onClick={() => seleccionarRadicadoM2(rad)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-purple-50 border-b last:border-0"
                  >
                    <span className="font-mono text-purple-700">{rad.radicado}</span>
                    <span className="text-slate-500 ml-2">- {rad.tipo_tramite}</span>
                    {rad.nombre_completo && (
                      <span className="block text-xs text-slate-400">Solicitante: {rad.nombre_completo}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Solicitante - Se carga automáticamente del radicado */}
      {m2Data.radicado && (
        <Card className="border-purple-200 bg-purple-50/30">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2 text-purple-800">
              <Users className="w-4 h-4" />
              Datos del Solicitante (del Radicado)
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Label className="text-xs">Nombre Completo</Label>
                <Input
                  value={m2Data.solicitante.nombre}
                  onChange={(e) => setM2Data(prev => ({
                    ...prev,
                    solicitante: { ...prev.solicitante, nombre: e.target.value.toUpperCase() }
                  }))}
                  placeholder="NOMBRE COMPLETO"
                  className="bg-white"
                />
              </div>
              <div>
                <Label className="text-xs">Cédula</Label>
                <Input
                  value={m2Data.solicitante.documento}
                  onChange={(e) => setM2Data(prev => ({
                    ...prev,
                    solicitante: { ...prev.solicitante, documento: e.target.value }
                  }))}
                  placeholder="12345678"
                  className="bg-white"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Predios a Cancelar (Origen) */}
      <Card className="border-red-200 bg-red-50/30">
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2 text-red-800">
            <X className="w-4 h-4" />
            Predios a CANCELAR ({m2Data.predios_cancelados.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 space-y-3">
          {/* Buscador */}
          <div className="flex gap-2">
            <Input
              value={searchPredio}
              onChange={(e) => setSearchPredio(e.target.value)}
              placeholder="Buscar por código predial, matrícula o propietario..."
              onKeyDown={(e) => e.key === 'Enter' && buscarPredios()}
            />
            <Button onClick={buscarPredios} disabled={searchingPredios}>
              <Search className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Resultados de búsqueda */}
          {searchResults.length > 0 && (
            <div className="border rounded-lg max-h-40 overflow-y-auto">
              {searchResults.map((predio, idx) => {
                // Obtener nombre del propietario actual (del array propietarios o campo legacy)
                const nombrePropietario = predio.propietarios?.length > 0 
                  ? predio.propietarios[0].nombre_propietario || predio.propietarios[0].nombre
                  : predio.nombre_propietario || '';
                return (
                  <div 
                    key={idx}
                    className="p-2 hover:bg-slate-100 cursor-pointer border-b last:border-b-0 flex justify-between items-center"
                    onClick={() => agregarPredioOrigen(predio)}
                  >
                    <div>
                      <p className="font-medium text-sm">{predio.codigo_predial_nacional || predio.numero_predio}</p>
                      <p className="text-xs text-slate-600">{predio.direccion} - {nombrePropietario}</p>
                    </div>
                    <Plus className="w-4 h-4 text-emerald-600" />
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Lista de predios agregados */}
          {m2Data.predios_cancelados.map((predio, idx) => (
            <div key={idx} className="bg-white p-3 rounded-lg border border-red-200 space-y-3">
              {/* Header del predio */}
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-mono font-medium text-sm">{predio.codigo_predial}</p>
                  <p className="text-xs text-slate-600">{predio.direccion}</p>
                  <p className="text-xs text-slate-500">
                    Área terreno: {formatAreaHectareas(predio.area_terreno)} | 
                    Construida: {Number(predio.area_construida).toLocaleString()} m² | 
                    Avalúo: ${Number(predio.avaluo).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500">Matrícula: {getMatriculaInmobiliaria(predio)}</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => eliminarPredioOrigen(idx)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              
              {/* Tipo de cancelación */}
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-medium text-slate-700">Tipo de cancelación:</p>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`tipo_cancelacion_${idx}`}
                      checked={predio.tipo_cancelacion === 'total'}
                      onChange={() => actualizarPredioCancelado(idx, 'tipo_cancelacion', 'total')}
                      className="w-4 h-4 text-red-600"
                    />
                    <span className="text-sm text-red-700 font-medium">Cancelación TOTAL</span>
                    <span className="text-xs text-slate-500">(el predio desaparece)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`tipo_cancelacion_${idx}`}
                      checked={predio.tipo_cancelacion === 'parcial'}
                      onChange={() => actualizarPredioCancelado(idx, 'tipo_cancelacion', 'parcial')}
                      className="w-4 h-4 text-amber-600"
                    />
                    <span className="text-sm text-amber-700 font-medium">Cancelación PARCIAL</span>
                    <span className="text-xs text-slate-500">(el predio permanece modificado)</span>
                  </label>
                </div>
                
                {/* Cancelación TOTAL - Descripción */}
                {predio.tipo_cancelacion === 'total' && (
                  <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-xs text-red-700">
                      El predio será enviado a la lista de eliminación y quedará pendiente de aprobación.
                    </p>
                  </div>
                )}
                
                {/* Cancelación PARCIAL - Botón para editar completo */}
                {predio.tipo_cancelacion === 'parcial' && (
                  <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-xs font-medium text-amber-800">
                        El predio permanecerá con los datos modificados (R1 y R2)
                      </p>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => abrirEdicionPredio(idx)}
                        className="border-amber-500 text-amber-700 hover:bg-amber-100"
                      >
                        <Edit className="w-4 h-4 mr-1" /> Editar Predio Completo
                      </Button>
                    </div>
                    {/* Resumen de nuevos valores */}
                    <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                      <div className="bg-white p-2 rounded border">
                        <span className="text-slate-500">Nueva Área Terreno:</span>
                        <span className="font-medium block">{Number(predio.nueva_area_terreno || 0).toLocaleString()} m²</span>
                      </div>
                      <div className="bg-white p-2 rounded border">
                        <span className="text-slate-500">Nueva Área Construida:</span>
                        <span className="font-medium block">{Number(predio.nueva_area_construida || 0).toLocaleString()} m²</span>
                      </div>
                      <div className="bg-white p-2 rounded border">
                        <span className="text-slate-500">Nuevo Avalúo:</span>
                        <span className="font-medium block">${Number(predio.nuevo_avaluo || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    {predio.editado_en_plataforma && (
                      <p className="text-xs text-amber-600 mt-2">
                        * Editado en plataforma - Las áreas se calculan automáticamente desde R2
                      </p>
                    )}
                  </div>
                )}
              </div>
              
              {/* SECCIÓN: Fechas de Inscripción Catastral */}
              <div className="border-t border-amber-200 pt-3 mt-3">
                <div className="bg-amber-50 border border-dashed border-amber-300 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Fechas de Inscripción Catastral
                    </h4>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => agregarFechaInscripcion('cancelado', idx)}
                      className="h-6 text-xs text-amber-700 hover:bg-amber-100"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Agregar Fecha
                    </Button>
                  </div>
                  
                  {(predio.fechas_inscripcion || [{ año: new Date().getFullYear(), avaluo: predio.avaluo || '', avaluo_source: 'actual' }]).map((fecha, fidx) => (
                    <div key={fidx} className="flex items-end gap-2 mb-2 p-2 bg-white rounded border border-amber-200">
                      <div className="flex-1">
                        <Label className="text-xs text-slate-600">Año Inscripción</Label>
                        <Select
                          value={String(fecha.año || '')}
                          onValueChange={(v) => actualizarFechaInscripcion('cancelado', idx, fidx, 'año', parseInt(v))}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Año..." />
                          </SelectTrigger>
                          <SelectContent side="bottom" align="start">
                            {añosDisponibles.map(año => (
                              <SelectItem key={año} value={String(año)}>{año}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs text-slate-600">
                          Avalúo Vigencia {fecha.año || '----'}
                          {fecha.avaluo_source === 'sistema' && <span className="text-emerald-600 ml-1">(Sistema)</span>}
                        </Label>
                        <Input
                          type="text"
                          className="h-8 text-xs"
                          placeholder="$0"
                          value={fecha.avaluo ? `$${Number(fecha.avaluo).toLocaleString()}` : ''}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            actualizarFechaInscripcion('cancelado', idx, fidx, 'avaluo', val);
                            actualizarFechaInscripcion('cancelado', idx, fidx, 'avaluo_source', 'manual');
                          }}
                        />
                      </div>
                      {(predio.fechas_inscripcion?.length > 1) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => eliminarFechaInscripcion('cancelado', idx, fidx)}
                          className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ======================== */}
      {/* CONFIGURACIÓN DE ENGLOBE */}
      {/* ======================== */}
      {m2Data.subtipo === 'englobe' && m2Data.predios_cancelados.length >= 2 && (
        <Card className="border-purple-200 bg-purple-50/30">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2 text-purple-800">
              <Layers className="w-4 h-4" />
              Configuración del Englobe
            </CardTitle>
          </CardHeader>
          <CardContent className="py-3 space-y-4">
            {/* Tipo de Englobe */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Tipo de Englobe</label>
              <div className="grid grid-cols-2 gap-3">
                <div
                  className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                    m2Data.tipo_englobe === 'total' 
                      ? 'border-purple-500 bg-purple-100' 
                      : 'border-slate-200 hover:border-purple-300'
                  }`}
                  onClick={() => {
                    // Calcular totales de los predios a cancelar
                    const areaTotal = m2Data.predios_cancelados.reduce((sum, p) => sum + Number(p.area_terreno || 0), 0);
                    const areaConstruidaTotal = m2Data.predios_cancelados.reduce((sum, p) => sum + Number(p.area_construida || 0), 0);
                    const avaluoTotal = m2Data.predios_cancelados.reduce((sum, p) => sum + Number(p.avaluo || 0), 0);
                    
                    setM2Data(prev => ({ 
                      ...prev, 
                      tipo_englobe: 'total',
                      predio_matriz_id: null,
                      predio_resultante: null 
                    }));
                    
                    // Inicializar nuevo predio con valores sugeridos
                    const nuevoPredio = {
                      id: `nuevo-englobe-${Date.now()}`,
                      codigo_predial: '',
                      npn: '',
                      codigo_homologado: '',
                      direccion: m2Data.predios_cancelados[0]?.direccion || '',
                      destino_economico: m2Data.predios_cancelados[0]?.destino_economico || 'R',
                      area_terreno: areaTotal,
                      area_construida: areaConstruidaTotal,
                      avaluo: avaluoTotal,
                      matricula_inmobiliaria: '',
                      propietarios: m2Data.predios_cancelados[0]?.propietarios || [{ nombre_propietario: '', tipo_documento: 'CC', numero_documento: '' }],
                      zonas_homogeneas: [],
                      _editIndex: undefined
                    };
                    
                    setNuevoPredioInscrito(nuevoPredio);
                    setTabNuevoPredio('ubicacion');
                    setNuevoPredioModalMode('englobe_total');
                    setShowNuevoPredioModal(true);
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      m2Data.tipo_englobe === 'total' ? 'border-purple-600 bg-purple-600' : 'border-slate-300'
                    }`}>
                      {m2Data.tipo_englobe === 'total' && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="font-semibold text-sm">Englobe TOTAL</span>
                  </div>
                  <p className="text-xs text-slate-600 ml-6">
                    Los predios se fusionan en un predio NUEVO (nuevo NPN, nueva matrícula)
                  </p>
                </div>
                
                <div
                  className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                    m2Data.tipo_englobe === 'absorcion' 
                      ? 'border-purple-500 bg-purple-100' 
                      : 'border-slate-200 hover:border-purple-300'
                  }`}
                  onClick={() => setM2Data(prev => ({ 
                    ...prev, 
                    tipo_englobe: 'absorcion',
                    predio_resultante: null 
                  }))}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      m2Data.tipo_englobe === 'absorcion' ? 'border-purple-600 bg-purple-600' : 'border-slate-300'
                    }`}>
                      {m2Data.tipo_englobe === 'absorcion' && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="font-semibold text-sm">Englobe por ABSORCIÓN</span>
                  </div>
                  <p className="text-xs text-slate-600 ml-6">
                    Un predio matriz absorbe a los demás (mismo NPN, área aumentada)
                  </p>
                </div>
              </div>
            </div>

            {/* Selector de Predio Matriz (solo para absorción) */}
            {m2Data.tipo_englobe === 'absorcion' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Seleccionar Predio Matriz (el que absorbe)
                </label>
                <div className="space-y-2">
                  {m2Data.predios_cancelados.map((predio, idx) => (
                    <div
                      key={idx}
                      className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                        m2Data.predio_matriz_id === predio.id 
                          ? 'border-amber-500 bg-amber-50' 
                          : 'border-slate-200 hover:border-amber-300'
                      }`}
                      onClick={() => {
                        // Al seleccionar matriz, pre-cargar sus datos en predio_resultante
                        const areaTotal = m2Data.predios_cancelados.reduce((sum, p) => sum + Number(p.area_terreno || 0), 0);
                        const areaConstruidaTotal = m2Data.predios_cancelados.reduce((sum, p) => sum + Number(p.area_construida || 0), 0);
                        const avaluoTotal = m2Data.predios_cancelados.reduce((sum, p) => sum + Number(p.avaluo || 0), 0);
                        
                        setM2Data(prev => ({ 
                          ...prev, 
                          predio_matriz_id: predio.id,
                          predio_resultante: {
                            ...predio,
                            area_terreno: areaTotal,
                            area_construida: areaConstruidaTotal,
                            avaluo: avaluoTotal,
                            es_matriz_absorbente: true
                          }
                        }));
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            m2Data.predio_matriz_id === predio.id ? 'border-amber-600 bg-amber-600' : 'border-slate-300'
                          }`}>
                            {m2Data.predio_matriz_id === predio.id && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div>
                            <p className="font-mono font-medium text-sm">{predio.codigo_predial}</p>
                            <p className="text-xs text-slate-600">{predio.direccion}</p>
                          </div>
                        </div>
                        <div className="text-right text-xs text-slate-500">
                          <p>Área: {formatAreaHectareas(predio.area_terreno)}</p>
                          <p>Matrícula: {getMatriculaInmobiliaria(predio)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resumen de áreas combinadas */}
            {m2Data.tipo_englobe && (
              <div className="bg-slate-100 p-3 rounded-lg">
                <p className="text-sm font-medium text-slate-700 mb-2">Resumen de Predios a Fusionar:</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-white p-2 rounded">
                    <p className="text-xs text-slate-500">Área Terreno Total</p>
                    <p className="font-bold text-emerald-700">
                      {formatAreaHectareas(m2Data.predios_cancelados.reduce((sum, p) => sum + Number(p.area_terreno || 0), 0))}
                    </p>
                  </div>
                  <div className="bg-white p-2 rounded">
                    <p className="text-xs text-slate-500">Área Construida Total</p>
                    <p className="font-bold text-emerald-700">
                      {m2Data.predios_cancelados.reduce((sum, p) => sum + Number(p.area_construida || 0), 0).toLocaleString()} m²
                    </p>
                  </div>
                  <div className="bg-white p-2 rounded">
                    <p className="text-xs text-slate-500">Avalúo Total</p>
                    <p className="font-bold text-emerald-700">
                      ${m2Data.predios_cancelados.reduce((sum, p) => sum + Number(p.avaluo || 0), 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Predios a Inscribir (Destino) - Diferente para Englobe vs Desengloble */}
      {m2Data.subtipo === 'englobe' ? (
        /* ======================== */
        /* INSCRIPCIÓN PARA ENGLOBE */
        /* ======================== */
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2 text-emerald-800">
              <Check className="w-4 h-4" />
              Predio RESULTANTE del Englobe
            </CardTitle>
          </CardHeader>
          <CardContent className="py-3 space-y-4">
            {m2Data.predios_cancelados.length < 2 ? (
              <div className="text-center py-6 text-amber-600 bg-amber-50 rounded-lg border border-amber-200">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm font-medium">Para englobe necesita al menos 2 predios a cancelar</p>
                <p className="text-xs text-amber-500 mt-1">Agregue más predios en la sección de arriba</p>
              </div>
            ) : !m2Data.tipo_englobe ? (
              <div className="text-center py-6 text-slate-500">
                <p className="text-sm">Primero seleccione el tipo de englobe en la sección "Configuración del Englobe"</p>
              </div>
            ) : m2Data.tipo_englobe === 'absorcion' && !m2Data.predio_matriz_id ? (
              <div className="text-center py-6 text-slate-500">
                <p className="text-sm">Seleccione el predio matriz que absorberá a los demás</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* ENGLOBE TOTAL: Mostrar predio configurado o botón para configurar */}
                {m2Data.tipo_englobe === 'total' && (
                  <>
                    {m2Data.predio_resultante ? (
                      // Mostrar el predio resultante ya configurado
                      <div className="bg-white p-4 rounded-lg border-2 border-emerald-500">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <Badge className="bg-emerald-100 text-emerald-800 mb-2">Predio NUEVO (Englobe Total)</Badge>
                            <p className="font-mono text-sm font-medium">{m2Data.predio_resultante.codigo_homologado}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setNuevoPredioInscrito({...m2Data.predio_resultante, _editIndex: 'englobe'});
                                setNuevoPredioModalMode('englobe_total');
                                setTabNuevoPredio('ubicacion');
                                setShowNuevoPredioModal(true);
                              }}
                            >
                              <Edit className="w-4 h-4 mr-1" /> Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:bg-red-50"
                              onClick={() => setM2Data(prev => ({ ...prev, predio_resultante: null }))}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-slate-500">NPN:</p>
                            <p className="font-mono text-xs">{m2Data.predio_resultante.npn}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Matrícula:</p>
                            <p>{m2Data.predio_resultante.matricula_inmobiliaria || 'Sin información'}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Dirección:</p>
                            <p>{m2Data.predio_resultante.direccion}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Destino:</p>
                            <p>{m2Data.predio_resultante.destino_economico}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Área Terreno:</p>
                            <p className="font-medium text-emerald-700">{formatAreaHectareas(m2Data.predio_resultante.area_terreno)}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Área Construida:</p>
                            <p>{Number(m2Data.predio_resultante.area_construida).toLocaleString()} m²</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Avalúo:</p>
                            <p className="font-medium text-emerald-700">${Number(m2Data.predio_resultante.avaluo).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Propietario:</p>
                            <p>{m2Data.predio_resultante.propietarios?.[0]?.nombre_propietario || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Mostrar botón para crear el predio nuevo
                      <div className="text-center py-8 bg-blue-50 rounded-lg border-2 border-dashed border-blue-300">
                        <Building className="w-12 h-12 mx-auto mb-3 text-blue-400" />
                        <p className="text-sm text-blue-700 font-medium mb-3">
                          Configure el predio NUEVO que resultará del englobe
                        </p>
                        <Button
                          onClick={() => {
                            const areaTotal = m2Data.predios_cancelados.reduce((sum, p) => sum + Number(p.area_terreno || 0), 0);
                            const areaConstruidaTotal = m2Data.predios_cancelados.reduce((sum, p) => sum + Number(p.area_construida || 0), 0);
                            const avaluoTotal = m2Data.predios_cancelados.reduce((sum, p) => sum + Number(p.avaluo || 0), 0);
                            
                            const nuevoPredio = {
                              id: `nuevo-englobe-${Date.now()}`,
                              codigo_predial: '',
                              npn: '',
                              codigo_homologado: '',
                              direccion: m2Data.predios_cancelados[0]?.direccion || '',
                              destino_economico: m2Data.predios_cancelados[0]?.destino_economico || 'R',
                              area_terreno: areaTotal,
                              area_construida: areaConstruidaTotal,
                              avaluo: avaluoTotal,
                              matricula_inmobiliaria: '',
                              propietarios: m2Data.predios_cancelados[0]?.propietarios || [{ nombre_propietario: '', tipo_documento: 'CC', numero_documento: '' }],
                              zonas_homogeneas: [],
                              _editIndex: undefined
                            };
                            
                            setNuevoPredioInscrito(nuevoPredio);
                            setTabNuevoPredio('ubicacion');
                            setNuevoPredioModalMode('englobe_total');
                            setShowNuevoPredioModal(true);
                          }}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Plus className="w-4 h-4 mr-2" /> Crear Predio Resultante
                        </Button>
                        <p className="text-xs text-blue-500 mt-2">
                          Áreas sugeridas: {m2Data.predios_cancelados.reduce((sum, p) => sum + Number(p.area_terreno || 0), 0).toLocaleString()} m² terreno, 
                          ${m2Data.predios_cancelados.reduce((sum, p) => sum + Number(p.avaluo || 0), 0).toLocaleString()} avalúo
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* ENGLOBE POR ABSORCIÓN: Mostrar info del matriz ajustado */}
                {m2Data.tipo_englobe === 'absorcion' && m2Data.predio_resultante && (
                  <div className="bg-white p-4 rounded-lg border-2 border-amber-400">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <Badge className="bg-amber-100 text-amber-800 mb-2">Predio MATRIZ Ajustado (Absorción)</Badge>
                        <p className="font-mono text-sm font-medium">{m2Data.predio_resultante.codigo_homologado}</p>
                      </div>
                    </div>
                    
                    {/* Datos no editables del matriz */}
                    <div className="bg-amber-50 p-3 rounded-lg mb-3">
                      <p className="text-xs text-amber-700 font-medium mb-1">Datos del predio matriz (se conservan):</p>
                      <p className="font-mono text-xs">{m2Data.predio_resultante.codigo_predial}</p>
                      <p className="text-xs text-slate-600">Matrícula: {m2Data.predio_resultante.matricula_inmobiliaria || 'Sin información'}</p>
                    </div>

                    {/* Formulario para editar datos ajustados */}
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-slate-600">Dirección</label>
                        <Input
                          value={m2Data.predio_resultante?.direccion || ''}
                          onChange={(e) => setM2Data(prev => ({
                            ...prev,
                            predio_resultante: { ...prev.predio_resultante, direccion: e.target.value }
                          }))}
                          placeholder="Dirección del predio resultante"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs font-medium text-slate-600">Área Terreno (m²)</label>
                          <Input
                            type="number"
                            value={m2Data.predio_resultante?.area_terreno || ''}
                            onChange={(e) => setM2Data(prev => ({
                              ...prev,
                              predio_resultante: { ...prev.predio_resultante, area_terreno: e.target.value }
                            }))}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600">Área Construida (m²)</label>
                          <Input
                            type="number"
                            value={m2Data.predio_resultante?.area_construida || ''}
                            onChange={(e) => setM2Data(prev => ({
                              ...prev,
                              predio_resultante: { ...prev.predio_resultante, area_construida: e.target.value }
                            }))}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600">Avalúo ($)</label>
                          <Input
                            type="number"
                            value={m2Data.predio_resultante?.avaluo || ''}
                            onChange={(e) => setM2Data(prev => ({
                              ...prev,
                              predio_resultante: { ...prev.predio_resultante, avaluo: e.target.value }
                            }))}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-slate-600">Destino Económico</label>
                        <select
                          className="w-full border border-slate-300 rounded-md p-2 text-sm"
                          value={m2Data.predio_resultante?.destino_economico || 'R'}
                          onChange={(e) => setM2Data(prev => ({
                            ...prev,
                            predio_resultante: { ...prev.predio_resultante, destino_economico: e.target.value }
                          }))}
                        >
                          <option value="R">R - Residencial</option>
                          <option value="C">C - Comercial</option>
                          <option value="I">I - Industrial</option>
                          <option value="A">A - Agropecuario</option>
                          <option value="L">L - Lote</option>
                        </select>
                      </div>

                      {/* Datos del Propietario */}
                      <div className="border-t pt-3 mt-3">
                        <p className="text-sm font-medium text-slate-700 mb-2">Propietario del Predio Resultante</p>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-2">
                            <label className="text-xs font-medium text-slate-600">Nombre Completo</label>
                            <Input
                              value={m2Data.predio_resultante?.propietarios?.[0]?.nombre_propietario || ''}
                              onChange={(e) => setM2Data(prev => ({
                                ...prev,
                                predio_resultante: { 
                                  ...prev.predio_resultante, 
                                  propietarios: [{
                                    ...(prev.predio_resultante?.propietarios?.[0] || {}),
                                    nombre_propietario: e.target.value,
                                    nombre: e.target.value
                                  }]
                                }
                              }))}
                              placeholder="Nombre del propietario"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-600">Tipo Doc.</label>
                            <select
                              className="w-full border border-slate-300 rounded-md p-2 text-sm"
                              value={m2Data.predio_resultante?.propietarios?.[0]?.tipo_documento || 'CC'}
                              onChange={(e) => setM2Data(prev => ({
                                ...prev,
                                predio_resultante: { 
                                  ...prev.predio_resultante, 
                                  propietarios: [{
                                    ...(prev.predio_resultante?.propietarios?.[0] || {}),
                                    tipo_documento: e.target.value
                                  }]
                                }
                              }))}
                            >
                              <option value="CC">CC</option>
                              <option value="NIT">NIT</option>
                              <option value="CE">CE</option>
                              <option value="TI">TI</option>
                            </select>
                          </div>
                        </div>
                        <div className="mt-2">
                          <label className="text-xs font-medium text-slate-600">Número de Documento</label>
                          <Input
                            value={m2Data.predio_resultante?.propietarios?.[0]?.numero_documento || ''}
                            onChange={(e) => setM2Data(prev => ({
                              ...prev,
                              predio_resultante: { 
                                ...prev.predio_resultante, 
                                propietarios: [{
                                  ...(prev.predio_resultante?.propietarios?.[0] || {}),
                                  numero_documento: e.target.value,
                                  documento: e.target.value
                                }]
                              }
                            }))}
                            placeholder="Número de documento"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* ============================ */
        /* INSCRIPCIÓN PARA DESENGLOBLE */
        /* ============================ */
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardHeader className="py-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm flex items-center gap-2 text-emerald-800">
                <Check className="w-4 h-4" />
                Predios a INSCRIBIR ({m2Data.predios_inscritos.length})
              </CardTitle>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setShowCargaMasiva(true)} 
                  className="border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                  data-testid="btn-carga-masiva"
                >
                  <Upload className="w-4 h-4 mr-1" /> Importar Excel
                </Button>
                <Button size="sm" onClick={agregarPredioDestino} className="bg-emerald-600 hover:bg-emerald-700" data-testid="btn-nuevo-predio-inscrito">
                  <Plus className="w-4 h-4 mr-1" /> Nuevo Predio
                </Button>
              </div>
            </div>
          </CardHeader>
          
          {/* Modal de Carga Masiva */}
          {showCargaMasiva && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99999]">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
                <div className="p-4 border-b flex justify-between items-center">
                  <h3 className="font-semibold text-lg text-emerald-800">Importar Predios desde Excel (Formato R1/R2)</h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowCargaMasiva(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="p-6 space-y-4">
                  {/* Instrucciones */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-800 mb-2">Instrucciones:</h4>
                    <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                      <li>Descargue la plantilla Excel con el formato R1/R2</li>
                      <li>Complete los datos de cada predio (áreas, avalúos, propietarios)</li>
                      <li>Deje vacías las columnas NPN y Código Homologado para asignación automática</li>
                      <li>Suba el archivo y el sistema asignará números disponibles</li>
                    </ol>
                  </div>
                  
                  {/* Botón descargar plantilla */}
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={descargarPlantillaDesenglobe}
                  >
                    <Download className="w-4 h-4 mr-2" /> Descargar Plantilla Excel R1/R2
                  </Button>
                  
                  {/* Información del predio matriz */}
                  {m2Data.predios_cancelados.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-sm font-medium text-amber-800">Predio Matriz (base para NPNs):</p>
                      <p className="text-xs font-mono text-amber-700 mt-1">
                        {m2Data.predios_cancelados[0]?.npn || m2Data.predios_cancelados[0]?.codigo_predial_nacional}
                      </p>
                    </div>
                  )}
                  
                  {/* Área de carga de archivo */}
                  <div 
                    className="border-2 border-dashed border-emerald-300 rounded-lg p-8 text-center hover:bg-emerald-50 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      accept=".xlsx,.xls"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    {excelFile ? (
                      <div className="space-y-2">
                        <FileSpreadsheet className="w-12 h-12 mx-auto text-emerald-600" />
                        <p className="font-medium text-emerald-800">{excelFile.name}</p>
                        <p className="text-sm text-slate-500">
                          {(excelFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="w-12 h-12 mx-auto text-slate-400" />
                        <p className="text-slate-600">Click para seleccionar archivo Excel</p>
                        <p className="text-xs text-slate-400">Formatos: .xlsx, .xls</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Botones de acción */}
                  <div className="flex gap-3 pt-2">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => {
                        setShowCargaMasiva(false);
                        setExcelFile(null);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => procesarExcelMasivo(excelFile)}
                      disabled={!excelFile || cargandoExcel}
                    >
                      {cargandoExcel ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Procesar Excel
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <CardContent className="py-2 space-y-3">
            {m2Data.predios_inscritos.map((predio, idx) => (
              <div key={idx} className="bg-white p-3 rounded-lg border border-emerald-200">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="bg-emerald-100 text-emerald-800">#{idx + 1}</Badge>
                      <span className="font-mono font-medium text-sm">{predio.codigo_homologado || 'Sin código'}</span>
                    </div>
                    <p className="text-xs text-slate-600">{predio.direccion || 'Sin dirección'}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      NPN: {predio.npn || 'N/A'} | Matrícula: {getMatriculaInmobiliaria(predio)}
                    </p>
                    <p className="text-xs text-slate-500">
                      Área: {Number(predio.area_terreno || 0).toLocaleString()} m² | 
                      Construida: {Number(predio.area_construida || 0).toLocaleString()} m² | 
                      Avalúo: ${Number(predio.avaluo || 0).toLocaleString()}
                    </p>
                    {predio.propietarios?.[0]?.nombre_propietario && (
                      <p className="text-xs text-emerald-700 mt-1">
                        Propietario: {predio.propietarios[0].nombre_propietario}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button 
                    variant="outline" 
                    size="sm"
                    onClick={async () => {
                      // Cargar estructura del código
                      if (m2Data.municipio) {
                        try {
                          const token = localStorage.getItem('token');
                          const res = await axios.get(`${API}/predios/estructura-codigo/${m2Data.municipio}`, {
                            headers: { Authorization: `Bearer ${token}` }
                          });
                          setEstructuraCodigoNuevo(res.data);
                        } catch (error) {
                          console.error('Error cargando estructura:', error);
                        }
                      }
                      
                      // Extraer partes del código predial si existe
                      if (predio.codigo_predial && predio.codigo_predial.length >= 21) {
                        const codigo = predio.codigo_predial;
                        setCodigoManualNuevo({
                          zona: codigo.substring(5, 7) || '00',
                          sector: codigo.substring(7, 9) || '00',
                          comuna: codigo.substring(9, 11) || '00',
                          barrio: codigo.substring(11, 13) || '00',
                          manzana_vereda: codigo.substring(13, 17) || '0000',
                          terreno: codigo.substring(17, 21) || '0001',
                          condicion: codigo.substring(21, 22) || '0',
                          edificio: codigo.substring(22, 24) || '00',
                          piso: codigo.substring(24, 26) || '00',
                          unidad: codigo.substring(26, 30) || '0000'
                        });
                      }
                      
                      // Cargar zonas y construcciones existentes desde r2_registros o campos directos
                      const r2Data = predio.r2_registros?.[0] || {};
                      const zonasData = r2Data.zonas || predio.zonas || predio.zonas_homogeneas || [];
                      
                      if (zonasData.length > 0) {
                        // Cargar zonas de terreno
                        setZonasTerreno(zonasData.map(z => ({
                          zona_fisica: z.zona_fisica || '',
                          zona_economica: z.zona_economica || '',
                          area_terreno: String(z.area_terreno || 0)
                        })));
                        
                        // Cargar construcciones desde las mismas zonas (si tienen datos de construcción)
                        const construccionesData = zonasData
                          .filter(z => z.area_construida > 0 || z.habitaciones || z.banos || z.locales)
                          .map((z, i) => ({
                            id: generarIdConstruccion(i),
                            piso: String(z.pisos || z.piso || 1),
                            habitaciones: String(z.habitaciones || 0),
                            banos: String(z.banos || 0),
                            locales: String(z.locales || 0),
                            tipificacion: z.tipificacion || '',
                            uso: z.uso || '',
                            puntaje: String(z.puntaje || 0),
                            area_construida: String(z.area_construida || 0)
                          }));
                        
                        if (construccionesData.length > 0) {
                          setConstrucciones(construccionesData);
                        } else if (predio.construcciones?.length > 0) {
                          setConstrucciones(predio.construcciones.map((c, i) => ({
                            id: c.id || generarIdConstruccion(i),
                            piso: String(c.piso || 1),
                            habitaciones: String(c.habitaciones || 0),
                            banos: String(c.banos || 0),
                            locales: String(c.locales || 0),
                            tipificacion: c.tipificacion || '',
                            uso: c.uso || '',
                            puntaje: String(c.puntaje || 0),
                            area_construida: String(c.area_construida || 0)
                          })));
                        } else {
                          setConstrucciones([{
                            id: 'A', piso: '0', habitaciones: '0', banos: '0', locales: '0',
                            tipificacion: '', uso: '', puntaje: '0', area_construida: '0'
                          }]);
                        }
                      } else {
                        setZonasTerreno([{ zona_fisica: '', zona_economica: '', area_terreno: '0' }]);
                        setConstrucciones([{
                          id: 'A', piso: '0', habitaciones: '0', banos: '0', locales: '0',
                          tipificacion: '', uso: '', puntaje: '0', area_construida: '0'
                        }]);
                      }
                      
                      // Cargar propietarios
                      if (predio.propietarios?.length > 0) {
                        setPropietariosNuevo(predio.propietarios.map(p => ({
                          nombre_propietario: p.nombre_propietario || '',
                          tipo_documento: p.tipo_documento || 'C',
                          numero_documento: p.numero_documento?.replace(/^0+/, '') || '',
                          estado_civil: p.estado || ''
                        })));
                      } else {
                        setPropietariosNuevo([{
                          nombre_propietario: '', tipo_documento: 'C', numero_documento: '', estado_civil: ''
                        }]);
                      }
                      
                      setVerificacionCodigoNuevo({ estado: 'disponible' }); // Ya existe, permitir editar
                      setNuevoPredioInscrito({...predio, _editIndex: idx});
                      setTabNuevoPredio('ubicacion');
                      setShowNuevoPredioModal(true);
                    }}
                    className="text-emerald-600"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => eliminarPredioDestino(idx)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              {/* SECCIÓN: Fechas de Inscripción Catastral para Predios Inscritos */}
              <div className="border-t border-emerald-200 pt-3 mt-3">
                <div className="bg-emerald-50 border border-dashed border-emerald-300 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Fechas de Inscripción Catastral
                    </h4>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => agregarFechaInscripcion('inscrito', idx)}
                      className="h-6 text-xs text-emerald-700 hover:bg-emerald-100"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Agregar Fecha
                    </Button>
                  </div>
                  
                  {(predio.fechas_inscripcion || [{ año: new Date().getFullYear(), avaluo: predio.avaluo || '', avaluo_source: 'actual' }]).map((fecha, fidx) => (
                    <div key={fidx} className="flex items-end gap-2 mb-2 p-2 bg-white rounded border border-emerald-200">
                      <div className="flex-1">
                        <Label className="text-xs text-slate-600">Año Inscripción</Label>
                        <Select
                          value={String(fecha.año || '')}
                          onValueChange={(v) => actualizarFechaInscripcion('inscrito', idx, fidx, 'año', parseInt(v))}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Año..." />
                          </SelectTrigger>
                          <SelectContent side="bottom" align="start">
                            {añosDisponibles.map(año => (
                              <SelectItem key={año} value={String(año)}>{año}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs text-slate-600">
                          Avalúo Vigencia {fecha.año || '----'}
                          {fecha.avaluo_source === 'sistema' && <span className="text-emerald-600 ml-1">(Sistema)</span>}
                        </Label>
                        <Input
                          type="text"
                          className="h-8 text-xs"
                          placeholder="$0"
                          value={fecha.avaluo ? `$${Number(fecha.avaluo).toLocaleString()}` : ''}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            actualizarFechaInscripcion('inscrito', idx, fidx, 'avaluo', val);
                            actualizarFechaInscripcion('inscrito', idx, fidx, 'avaluo_source', 'manual');
                          }}
                        />
                      </div>
                      {(predio.fechas_inscripcion?.length > 1) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => eliminarFechaInscripcion('inscrito', idx, fidx)}
                          className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
          
          {m2Data.predios_inscritos.length === 0 && (
            <p className="text-center text-slate-500 py-4">
              Haga clic en "Nuevo Predio" para añadir predios a inscribir
            </p>
          )}
        </CardContent>
      </Card>
      )}

      {/* Campo de Considerando Personalizado M2 */}
      <Card className="border-purple-200 bg-purple-50/30">
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2 text-purple-800">
            <FileText className="w-4 h-4" />
            Texto de Considerandos (Resolución)
          </CardTitle>
          <p className="text-xs text-purple-600 mt-1">
            Este texto aparecerá en la sección "CONSIDERANDO" de la resolución. Si se deja vacío, se usará el texto estándar.
          </p>
        </CardHeader>
        <CardContent className="py-2">
          <Textarea
            value={m2Data.texto_considerando || ''}
            onChange={(e) => setM2Data(prev => ({ ...prev, texto_considerando: e.target.value }))}
            placeholder={`Ejemplo: Qué, el(la) ciudadano(a) ${m2Data.solicitante?.nombre || '[NOMBRE]'}, identificado(a) con Cédula de Ciudadanía No. ${m2Data.solicitante?.documento || '[DOCUMENTO]'}, mediante radicado ${m2Data.radicado || '[RADICADO]'}, solicita ${m2Data.subtipo === 'englobe' ? 'englobe' : 'desenglobe'} de predios ubicados en ${m2Data.municipio || '[MUNICIPIO]'}...`}
            rows={5}
            className="font-mono text-sm"
            data-testid="m2-considerando-input"
          />
          <div className="mt-2 text-xs text-slate-500">
            <strong>Variables disponibles:</strong> (solicitante), (documento), (codigo_predial), (municipio), (radicado), (matricula), (subtipo)
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Renderizar historial
  const renderHistorial = () => (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <Label className="text-xs">Filtrar por Municipio</Label>
          <Select value={filtroMunicipio} onValueChange={setFiltroMunicipio}>
            <SelectTrigger>
              <SelectValue placeholder="Todos los municipios" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {MUNICIPIOS.map(m => (
                <SelectItem key={m.codigo} value={m.codigo}>{m.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={fetchHistorial}>
          <Filter className="w-4 h-4 mr-2" />
          Filtrar
        </Button>
      </div>
      
      {/* Lista de resoluciones */}
      {loadingHistorial ? (
        <div className="text-center py-8">Cargando historial...</div>
      ) : historialResoluciones.length === 0 ? (
        <div className="text-center py-8 text-slate-500">No hay resoluciones en el historial</div>
      ) : (
        <div className="space-y-2">
          {historialResoluciones.map((res, idx) => (
            <Card key={idx} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{res.numero_resolucion}</p>
                    <p className="text-sm text-slate-600">
                      {res.municipio} | {res.tipo_mutacion || 'M1'} | {res.fecha_resolucion || new Date(res.created_at).toLocaleDateString('es-CO')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge className={TIPOS_MUTACION[res.tipo_mutacion]?.color || 'bg-blue-100 text-blue-800'}>
                      {res.tipo_mutacion || 'M1'}
                    </Badge>
                    {res.pdf_path && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          // Normalizar pdf_path
                          let pdfUrl = res.pdf_path;
                          if (pdfUrl.startsWith('/resoluciones/') && !pdfUrl.startsWith('/api/')) {
                            pdfUrl = pdfUrl.replace('/resoluciones/', '/api/resoluciones/descargar/');
                          }
                          setPdfViewerData({
                            url: `${process.env.REACT_APP_BACKEND_URL}${pdfUrl}`,
                            title: `Resolución ${res.numero_resolucion}`,
                            fileName: `Resolucion_${res.numero_resolucion.replace(/\//g, '-')}.pdf`,
                            resolucionId: res.id,
                            radicado: res.radicado || '',
                            correoSolicitante: ''
                          });
                          setEmailSent(false);
                          setShowPDFViewer(true);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Ver PDF
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  // Renderizar configuración (solo admin/coordinador)
  const renderConfiguracion = () => (
    <div className="space-y-6">
      {/* Sub-tabs de configuración */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <Button
          variant={configTab === 'plantillas' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setConfigTab('plantillas')}
          className={configTab === 'plantillas' ? 'bg-emerald-600' : ''}
        >
          <FileText className="w-4 h-4 mr-2" />
          Plantillas de Texto
        </Button>
        <Button
          variant={configTab === 'numeracion' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setConfigTab('numeracion')}
          className={configTab === 'numeracion' ? 'bg-emerald-600' : ''}
        >
          <Hash className="w-4 h-4 mr-2" />
          Numeración {new Date().getFullYear()}
        </Button>
      </div>

      {/* Contenido de Plantillas */}
      {configTab === 'plantillas' && (
        <div className="grid grid-cols-4 gap-6">
          {/* Lista de plantillas */}
          <div className="col-span-1 space-y-2">
            <h3 className="font-medium text-sm text-slate-700 mb-3">Tipos de Resolución</h3>
            {plantillas.map((plantilla) => (
              <div
                key={plantilla.tipo}
                className={`p-3 rounded-lg cursor-pointer transition-all border ${
                  plantillaSeleccionada?.tipo === plantilla.tipo
                    ? 'bg-emerald-50 border-emerald-500'
                    : 'bg-white border-slate-200 hover:border-emerald-300'
                }`}
                onClick={() => seleccionarPlantilla(plantilla)}
              >
                <p className="font-medium text-sm">{plantilla.nombre}</p>
                <p className="text-xs text-slate-500">{plantilla.descripcion}</p>
              </div>
            ))}
          </div>

          {/* Editor de plantilla */}
          <div className="col-span-3 space-y-4">
            {plantillaSeleccionada ? (
              <>
                <div className="flex justify-between items-center">
                  <h3 className="font-medium text-lg">
                    {plantillaSeleccionada.nombre}
                  </h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generarPreviewPdf}
                      disabled={generandoPreview}
                    >
                      {generandoPreview ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Eye className="w-4 h-4 mr-2" />
                      )}
                      Preview PDF
                    </Button>
                    <Button
                      size="sm"
                      onClick={guardarPlantilla}
                      disabled={guardandoPlantilla}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {guardandoPlantilla ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Guardar
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-sm">Texto de la Resolución</Label>
                    <Textarea
                      value={textoPlantilla}
                      onChange={(e) => setTextoPlantilla(e.target.value)}
                      className="font-mono text-sm resize-none overflow-hidden"
                      style={{ minHeight: '300px', height: 'auto' }}
                      placeholder="Texto de la plantilla..."
                      onInput={(e) => {
                        e.target.style.height = 'auto';
                        e.target.style.height = Math.max(300, e.target.scrollHeight) + 'px';
                      }}
                      ref={(el) => {
                        if (el && textoPlantilla) {
                          setTimeout(() => {
                            el.style.height = 'auto';
                            el.style.height = Math.max(300, el.scrollHeight) + 'px';
                          }, 0);
                        }
                      }}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Variables disponibles: (municipio), (radicado), (solicitante), (documento), (npn), (fecha)
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm">Nombre del Firmante</Label>
                      <Input
                        value={firmante.nombre}
                        onChange={(e) => setFirmante(prev => ({ ...prev, nombre: e.target.value }))}
                        placeholder="Nombre completo del firmante"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Cargo del Firmante</Label>
                      <Input
                        value={firmante.cargo}
                        onChange={(e) => setFirmante(prev => ({ ...prev, cargo: e.target.value }))}
                        placeholder="Cargo del firmante"
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Seleccione una plantilla para editar</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contenido de Numeración */}
      {configTab === 'numeracion' && (
        <Card>
          <CardHeader className="py-4">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg flex items-center gap-2">
                <Hash className="w-5 h-5" />
                Numeración de Resoluciones {new Date().getFullYear()}
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cargarConfiguracionNumeracion}
                  disabled={cargandoConfig}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${cargandoConfig ? 'animate-spin' : ''}`} />
                  Actualizar
                </Button>
                <Button
                  size="sm"
                  onClick={guardarConfiguracionNumeracion}
                  disabled={guardandoConfig}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {guardandoConfig ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Guardar Cambios
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 mb-4">
              Configure el número actual de resolución para cada municipio. La siguiente resolución generada usará el número consecutivo.
            </p>
            
            {cargandoConfig ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 mx-auto animate-spin text-emerald-600" />
                <p className="text-sm text-slate-500 mt-2">Cargando configuración...</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {MUNICIPIOS.map((mun) => (
                  <div key={mun.codigo} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{mun.nombre}</p>
                      <p className="text-xs text-slate-500">Código: {mun.codigo}</p>
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        min="0"
                        value={numeracionMunicipios[mun.codigo] || 0}
                        onChange={(e) => setNumeracionMunicipios(prev => ({
                          ...prev,
                          [mun.codigo]: parseInt(e.target.value) || 0
                        }))}
                        className="text-center font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mutaciones y Resoluciones</h1>
          <p className="text-slate-600">Gestión centralizada de mutaciones catastrales</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={`grid w-full ${puedeVerConfiguracion ? 'grid-cols-3' : 'grid-cols-2'} max-w-lg`}>
          <TabsTrigger value="nueva" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nueva Mutación
          </TabsTrigger>
          <TabsTrigger value="historial" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Historial
          </TabsTrigger>
          {puedeVerConfiguracion && (
            <TabsTrigger value="configuracion" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Configuración
            </TabsTrigger>
          )}
        </TabsList>
        
        <TabsContent value="nueva" className="mt-6">
          {renderSelectorTipo()}
        </TabsContent>
        
        <TabsContent value="historial" className="mt-6">
          {renderHistorial()}
        </TabsContent>
        
        {puedeVerConfiguracion && (
          <TabsContent value="configuracion" className="mt-6">
            {renderConfiguracion()}
          </TabsContent>
        )}
      </Tabs>

      {/* Dialog para crear mutación */}
      <Dialog open={showMutacionDialog} onOpenChange={setShowMutacionDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-visible">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {tipoMutacionSeleccionado?.nombre} - {tipoMutacionSeleccionado?.descripcion}
            </DialogTitle>
          </DialogHeader>
          
          {tipoMutacionSeleccionado?.codigo === 'M2' && renderFormularioM2()}
          
          {tipoMutacionSeleccionado?.codigo === 'M3' && renderFormularioM3()}
          
          {tipoMutacionSeleccionado?.codigo === 'M4' && renderFormularioM4()}
          
          {tipoMutacionSeleccionado?.codigo === 'M5' && renderFormularioM5()}
          
          {tipoMutacionSeleccionado?.codigo === 'RECTIFICACION_AREA' && renderFormularioRectificacionArea()}
          
          {tipoMutacionSeleccionado?.codigo === 'COMP' && renderFormularioComplementacion()}
          
          {tipoMutacionSeleccionado?.codigo === 'BLOQUEO' && renderFormularioBloqueo()}
          
          {tipoMutacionSeleccionado?.codigo === 'M1' && (
            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
              {/* Selección de Municipio - Dropdown personalizado */}
              <div className="relative">
                <Label>Municipio *</Label>
                <div 
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-white px-3 py-2 text-sm cursor-pointer hover:bg-slate-50"
                  onClick={() => setShowMunicipioDropdown(!showMunicipioDropdown)}
                >
                  <span className={m1Data.municipio ? 'text-slate-900' : 'text-slate-500'}>
                    {m1Data.municipio ? MUNICIPIOS.find(m => m.codigo === m1Data.municipio)?.nombre : 'Seleccionar municipio'}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </div>
                {showMunicipioDropdown && (
                  <div className="absolute z-[99999] mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {MUNICIPIOS.map(m => (
                      <div
                        key={m.codigo}
                        className={`px-3 py-2 text-sm cursor-pointer hover:bg-emerald-50 ${m1Data.municipio === m.codigo ? 'bg-emerald-100 text-emerald-800' : ''}`}
                        onClick={() => {
                          setM1Data(prev => ({ ...prev, municipio: m.codigo, predio: null }));
                          setShowMunicipioDropdown(false);
                        }}
                      >
                        {m.nombre}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Búsqueda de Predio */}
              <Card className="border-blue-200 bg-blue-50/30">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2 text-blue-800">
                    <Search className="w-4 h-4" />
                    Buscar Predio
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2 space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={searchPredioM1}
                      onChange={(e) => setSearchPredioM1(e.target.value)}
                      placeholder="Buscar por código predial, matrícula o propietario..."
                      onKeyDown={(e) => e.key === 'Enter' && buscarPrediosM1()}
                      disabled={!m1Data.municipio}
                    />
                    <Button onClick={buscarPrediosM1} disabled={searchingPrediosM1 || !m1Data.municipio}>
                      <Search className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {/* Resultados de búsqueda */}
                  {searchResultsM1.length > 0 && (
                    <div className="border rounded-lg max-h-40 overflow-y-auto bg-white">
                      {searchResultsM1.map((predio, idx) => {
                        const nombrePropietario = predio.propietarios?.length > 0 
                          ? predio.propietarios[0].nombre_propietario || predio.propietarios[0].nombre
                          : predio.nombre_propietario || '';
                        return (
                          <div 
                            key={idx}
                            className="p-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 flex justify-between items-center"
                            onClick={() => seleccionarPredioM1(predio)}
                          >
                            <div>
                              <p className="font-medium text-sm">{predio.codigo_predial_nacional || predio.numero_predio}</p>
                              <p className="text-xs text-slate-600">{predio.direccion} - {nombrePropietario}</p>
                            </div>
                            <Plus className="w-4 h-4 text-blue-600" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Predio seleccionado */}
                  {m1Data.predio && (
                    <div className="bg-white p-4 rounded-lg border border-blue-300">
                      <div className="flex justify-between items-start">
                        <div>
                          <Badge className="bg-blue-100 text-blue-800">Predio Seleccionado</Badge>
                          <p className="font-bold text-lg mt-2">{m1Data.predio.codigo_predial_nacional}</p>
                          <p className="text-sm text-slate-600">{m1Data.predio.direccion}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            Matrícula: {getMatriculaInmobiliaria(m1Data.predio)} | 
                            Área: {m1Data.predio.area_terreno || 0} m²
                          </p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setM1Data(prev => ({ ...prev, predio: null, propietarios_anteriores: [], propietarios_nuevos: [] }))}
                          className="text-red-600"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Información de Resolución */}
              {m1Data.predio && (
                <>
                  <Card className="border-purple-200 bg-purple-50/30">
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2 text-purple-800">
                        <FileText className="w-4 h-4" />
                        Información de Resolución
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-2 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-purple-700">Número de Resolución</Label>
                          <div className="relative">
                            <Input 
                              value={m1Data.numero_resolucion}
                              readOnly
                              className="bg-purple-100 font-mono text-purple-800"
                              placeholder={cargandoNumeroResolucion ? "Generando..." : "Seleccione un predio"}
                            />
                            {cargandoNumeroResolucion && (
                              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-purple-600 mt-1">Se genera automáticamente</p>
                        </div>
                        
                        <div>
                          <Label className="text-xs text-purple-700">Fecha de Resolución</Label>
                          <Input 
                            type="date"
                            value={m1Data.fecha_resolucion ? 
                              m1Data.fecha_resolucion.split('/').reverse().join('-') : 
                              new Date().toISOString().split('T')[0]
                            }
                            onChange={(e) => {
                              const fecha = e.target.value;
                              const partes = fecha.split('-');
                              const fechaFormateada = `${partes[2]}/${partes[1]}/${partes[0]}`;
                              setM1Data(prev => ({ ...prev, fecha_resolucion: fechaFormateada }));
                            }}
                          />
                        </div>
                      </div>
                      
                      {/* Radicado - OBLIGATORIO */}
                      <div>
                        <Label className="text-xs text-purple-700">Radicado de Petición *</Label>
                        <div className="relative">
                          <Input
                            value={m1Data.radicado_peticion}
                            onChange={(e) => {
                              const valor = e.target.value.toUpperCase();
                              setM1Data(prev => ({ ...prev, radicado_peticion: valor }));
                              buscarRadicados(valor);
                            }}
                            placeholder="Escribir número de radicado..."
                            className={!m1Data.radicado_peticion ? 'border-red-300' : ''}
                          />
                          {radicadosDisponibles.length > 0 && (
                            <div className="absolute z-[99999] w-full mt-1 bg-white border border-purple-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                              {radicadosDisponibles.map(rad => (
                                <button
                                  key={rad.id}
                                  type="button"
                                  onClick={() => {
                                    setM1Data(prev => ({ ...prev, radicado_peticion: rad.radicado }));
                                    setRadicadosDisponibles([]);
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-purple-50 border-b last:border-0"
                                >
                                  <span className="font-mono text-purple-700">{rad.radicado}</span>
                                  <span className="text-slate-500 ml-2">- {rad.tipo_tramite}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Propietarios Anteriores (CANCELAR) */}
                  <Card className="border-red-200 bg-red-50/30">
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2 text-red-800">
                        <X className="w-4 h-4" />
                        Propietarios a CANCELAR ({m1Data.propietarios_anteriores.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-2">
                      {m1Data.propietarios_anteriores.map((prop, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-lg border border-red-200 mb-2">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-2">
                              <Label className="text-xs">Nombre</Label>
                              <Input value={prop.nombre_propietario} readOnly className="bg-slate-50" />
                            </div>
                            <div>
                              <Label className="text-xs">Documento</Label>
                              <Input value={`${prop.tipo_documento} ${prop.numero_documento}`} readOnly className="bg-slate-50" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Propietarios Nuevos (INSCRIBIR) */}
                  <Card className="border-emerald-200 bg-emerald-50/30">
                    <CardHeader className="py-3">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-sm flex items-center gap-2 text-emerald-800">
                          <Check className="w-4 h-4" />
                          Propietarios a INSCRIBIR ({m1Data.propietarios_nuevos.length})
                        </CardTitle>
                        <Button size="sm" onClick={agregarPropietarioNuevo} className="bg-emerald-600 hover:bg-emerald-700">
                          <Plus className="w-4 h-4 mr-1" /> Agregar
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="py-2">
                      {m1Data.propietarios_nuevos.length === 0 ? (
                        <p className="text-center text-slate-500 py-4">
                          Haga clic en "Agregar" para añadir los nuevos propietarios
                        </p>
                      ) : (
                        m1Data.propietarios_nuevos.map((prop, idx) => (
                          <div key={idx} className="bg-white p-3 rounded-lg border border-emerald-200 mb-2">
                            <div className="flex justify-between items-center mb-2">
                              <Badge className="bg-emerald-100 text-emerald-800">Propietario {idx + 1}</Badge>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => eliminarPropietarioNuevo(idx)}
                                className="text-red-600 h-6"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                              <div className="col-span-2">
                                <Label className="text-xs">Nombre Completo *</Label>
                                <Input 
                                  value={prop.nombre_propietario}
                                  onChange={(e) => actualizarPropietarioNuevo(idx, 'nombre_propietario', e.target.value.toUpperCase())}
                                  placeholder="NOMBRE COMPLETO"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Tipo Doc</Label>
                                <Select 
                                  value={prop.tipo_documento}
                                  onValueChange={(v) => actualizarPropietarioNuevo(idx, 'tipo_documento', v)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="C">CC</SelectItem>
                                    <SelectItem value="N">NIT</SelectItem>
                                    <SelectItem value="T">TI</SelectItem>
                                    <SelectItem value="E">CE</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs">Número *</Label>
                                <Input 
                                  value={prop.numero_documento}
                                  onChange={(e) => actualizarPropietarioNuevo(idx, 'numero_documento', e.target.value)}
                                  placeholder="12345678"
                                />
                              </div>
                            </div>
                            <div className="mt-2">
                              <Label className="text-xs">Estado Civil</Label>
                              <RadioGroup 
                                value={prop.estado_civil || ''} 
                                onValueChange={(v) => actualizarPropietarioNuevo(idx, 'estado_civil', v)} 
                                className="flex flex-wrap gap-3 mt-1"
                              >
                                <div className="flex items-center space-x-1"><RadioGroupItem value="" id={`m1_estado_${idx}_sin`} /><Label htmlFor={`m1_estado_${idx}_sin`} className="text-xs cursor-pointer text-slate-500">Sin especificar</Label></div>
                                <div className="flex items-center space-x-1"><RadioGroupItem value="S" id={`m1_estado_${idx}_sol`} /><Label htmlFor={`m1_estado_${idx}_sol`} className="text-xs cursor-pointer">S: Soltero/a</Label></div>
                                <div className="flex items-center space-x-1"><RadioGroupItem value="C" id={`m1_estado_${idx}_cas`} /><Label htmlFor={`m1_estado_${idx}_cas`} className="text-xs cursor-pointer">C: Casado/a</Label></div>
                                <div className="flex items-center space-x-1"><RadioGroupItem value="V" id={`m1_estado_${idx}_viu`} /><Label htmlFor={`m1_estado_${idx}_viu`} className="text-xs cursor-pointer">V: Viudo/a</Label></div>
                                <div className="flex items-center space-x-1"><RadioGroupItem value="U" id={`m1_estado_${idx}_uni`} /><Label htmlFor={`m1_estado_${idx}_uni`} className="text-xs cursor-pointer">U: Unión libre</Label></div>
                              </RadioGroup>
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  {/* Campo de Considerando Personalizado M1 */}
                  <Card className="border-purple-200 bg-purple-50/30">
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2 text-purple-800">
                        <FileText className="w-4 h-4" />
                        Texto de Considerandos (Resolución)
                      </CardTitle>
                      <p className="text-xs text-purple-600 mt-1">
                        Este texto aparecerá en la sección "CONSIDERANDO" de la resolución. Si se deja vacío, se usará el texto estándar.
                      </p>
                    </CardHeader>
                    <CardContent className="py-2">
                      <Textarea
                        value={m1Data.texto_considerando || ''}
                        onChange={(e) => setM1Data(prev => ({ ...prev, texto_considerando: e.target.value }))}
                        placeholder={`Ejemplo: Qué, el(la) ciudadano(a) [NOMBRE DEL NUEVO PROPIETARIO], identificado(a) con Cédula de Ciudadanía No. [DOCUMENTO], mediante radicado ${m1Data.radicado_peticion || '[RADICADO]'}, solicita el cambio de propietario del predio identificado con código predial ${m1Data.predio?.codigo_predial_nacional || '[CÓDIGO PREDIAL]'}...`}
                        rows={5}
                        className="font-mono text-sm"
                        data-testid="m1-considerando-input"
                      />
                      <div className="mt-2 text-xs text-slate-500">
                        <strong>Variables disponibles:</strong> (solicitante), (documento), (codigo_predial), (municipio), (radicado), (matricula)
                      </div>
                    </CardContent>
                  </Card>

                  {/* Preview */}
                  {m1Data.numero_resolucion && (
                    <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border">
                      <p className="text-xs text-purple-600 mb-1">Vista previa de la resolución:</p>
                      <p className="font-mono text-xl font-bold text-purple-800">{m1Data.numero_resolucion}</p>
                      <p className="text-sm text-slate-600">
                        Fecha: {m1Data.fecha_resolucion || new Date().toLocaleDateString('es-CO')}
                        {m1Data.radicado_peticion && ` | Radicado: ${m1Data.radicado_peticion}`}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => {
              setShowMutacionDialog(false);
              resetFormularioM2();
              resetFormularioM1();
              resetFormularioM3();
            }}>
              Cancelar
            </Button>
            {tipoMutacionSeleccionado?.codigo === 'M1' && m1Data.predio && (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Botón Enviar a Aprobación (si no puede aprobar) */}
                {!puedeAprobar && (
                  <Button 
                    onClick={async () => {
                      if (!m1Data.predio || !m1Data.radicado_peticion || m1Data.propietarios_nuevos.length === 0) {
                        toast.error('Debe completar todos los campos requeridos');
                        return;
                      }
                      setEnviandoSolicitud(true);
                      try {
                        const payload = {
                          tipo: 'M1',
                          tipo_mutacion: 'M1',
                          municipio: m1Data.municipio,
                          radicado: m1Data.radicado_peticion,
                          predio: m1Data.predio,
                          predio_id: m1Data.predio.id,
                          propietarios_nuevos: m1Data.propietarios_nuevos,
                          observaciones: m1Data.observaciones,
                          enviar_a_aprobacion: true
                        };
                        
                        const response = await axios.post(
                          `${API_URL}/api/solicitudes-mutacion`,
                          payload,
                          { headers: { Authorization: `Bearer ${token}` } }
                        );
                        
                        if (response.data.exito) {
                          toast.success('Solicitud M1 enviada a aprobación');
                          resetFormularioM1();
                          setTipoMutacionSeleccionado(null);
                          setActiveTab('historial');
                          cargarSolicitudesPendientes();
                        } else {
                          toast.error(response.data.mensaje || 'Error al enviar solicitud');
                        }
                      } catch (error) {
                        console.error('Error enviando M1 a aprobación:', error);
                        toast.error(error.response?.data?.detail || 'Error al enviar solicitud');
                      } finally {
                        setEnviandoSolicitud(false);
                      }
                    }}
                    disabled={enviandoSolicitud || !m1Data.radicado_peticion || m1Data.propietarios_nuevos.length === 0}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {enviandoSolicitud ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Enviando...</> : 'Enviar a Aprobación'}
                  </Button>
                )}
                {/* Botón Generar PDF (si puede aprobar) */}
                {puedeAprobar && (
                  <Button 
                    onClick={generarResolucionM1} 
                    disabled={generando || !m1Data.numero_resolucion || !m1Data.radicado_peticion || m1Data.propietarios_nuevos.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {generando ? 'Generando...' : 'Generar Resolución M1'}
                  </Button>
                )}
              </div>
            )}
            {tipoMutacionSeleccionado?.codigo === 'M3' && m3Data.predio && (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Botón Enviar a Aprobación (si no puede aprobar) */}
                {!puedeAprobar && (
                  <Button 
                    onClick={async () => {
                      if (!m3Data.predio || !m3Data.radicado) {
                        toast.error('Debe seleccionar un predio y un radicado');
                        return;
                      }
                      setEnviandoSolicitud(true);
                      try {
                        const payload = {
                          tipo: 'M3',
                          tipo_mutacion: 'M3',
                          subtipo: m3Data.subtipo,
                          municipio: m3Data.municipio,
                          radicado: m3Data.radicado,
                          predio: m3Data.predio,
                          predio_id: m3Data.predio.id,
                          destino_nuevo: m3Data.destino_nuevo,
                          construcciones_nuevas: m3Data.construcciones_nuevas,
                          avaluo_nuevo: m3Data.avaluo_nuevo,
                          observaciones: m3Data.observaciones,
                          texto_considerando: m3Data.texto_considerando,
                          enviar_a_aprobacion: true
                        };
                        
                        const response = await axios.post(
                          `${API_URL}/api/solicitudes-mutacion`,
                          payload,
                          { headers: { Authorization: `Bearer ${token}` } }
                        );
                        
                        if (response.data.exito) {
                          toast.success('Solicitud M3 enviada a aprobación');
                          resetFormularioM3();
                          setTipoMutacionSeleccionado(null);
                          setActiveTab('historial');
                          cargarSolicitudesPendientes();
                        } else {
                          toast.error(response.data.mensaje || 'Error al enviar solicitud');
                        }
                      } catch (error) {
                        console.error('Error enviando M3 a aprobación:', error);
                        toast.error(error.response?.data?.detail || 'Error al enviar solicitud');
                      } finally {
                        setEnviandoSolicitud(false);
                      }
                    }}
                    disabled={enviandoSolicitud || !m3Data.radicado || !m3Data.predio}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {enviandoSolicitud ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Enviando...</> : 'Enviar a Aprobación'}
                  </Button>
                )}
                {/* Botón Generar PDF (si puede aprobar) */}
                {puedeAprobar && (
                  <Button 
                    onClick={generarResolucionM3} 
                    disabled={generando || !m3Data.subtipo || !m3Data.radicado || (m3Data.subtipo === 'cambio_destino' && !m3Data.destino_nuevo) || (m3Data.subtipo === 'incorporacion_construccion' && m3Data.construcciones_nuevas.length === 0) || !m3Data.avaluo_nuevo}
                    className="bg-amber-600 hover:bg-amber-700"
                    data-testid="m3-generar-btn"
                  >
                    {generando ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Generando...</> : 'Generar Resolución M3'}
                  </Button>
                )}
              </div>
            )}
            {tipoMutacionSeleccionado?.codigo === 'M4' && m4Data.predio && (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Botón Enviar a Aprobación (si no puede aprobar) */}
                {!puedeAprobar && (
                  <Button 
                    onClick={async () => {
                      if (!m4Data.predio || !m4Data.radicado) {
                        toast.error('Debe seleccionar un predio y un radicado');
                        return;
                      }
                      setEnviandoSolicitud(true);
                      try {
                        const payload = {
                          tipo: 'M4',
                          tipo_mutacion: 'M4',
                          subtipo: m4Data.subtipo,
                          decision: m4Data.decision,
                          municipio: m4Data.municipio,
                          radicado: m4Data.radicado,
                          predio: m4Data.predio,
                          predio_id: m4Data.predio.id,
                          avaluo_nuevo: m4Data.avaluo_nuevo,
                          observaciones: m4Data.observaciones,
                          texto_considerando: m4Data.texto_considerando,
                          enviar_a_aprobacion: true
                        };
                        
                        const response = await axios.post(
                          `${API_URL}/api/solicitudes-mutacion`,
                          payload,
                          { headers: { Authorization: `Bearer ${token}` } }
                        );
                        
                        if (response.data.exito) {
                          toast.success('Solicitud M4 enviada a aprobación');
                          resetFormularioM4();
                          setTipoMutacionSeleccionado(null);
                          setActiveTab('historial');
                          cargarSolicitudesPendientes();
                        } else {
                          toast.error(response.data.mensaje || 'Error al enviar solicitud');
                        }
                      } catch (error) {
                        console.error('Error enviando M4 a aprobación:', error);
                        toast.error(error.response?.data?.detail || 'Error al enviar solicitud');
                      } finally {
                        setEnviandoSolicitud(false);
                      }
                    }}
                    disabled={enviandoSolicitud || !m4Data.radicado || !m4Data.predio}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {enviandoSolicitud ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Enviando...</> : 'Enviar a Aprobación'}
                  </Button>
                )}
                {/* Botón Generar PDF (si puede aprobar) */}
                {puedeAprobar && (
                  <Button 
                    onClick={generarResolucionM4} 
                    disabled={generando || !m4Data.subtipo || !m4Data.radicado || !m4Data.avaluo_nuevo}
                    className="bg-green-600 hover:bg-green-700"
                    data-testid="m4-generar-btn"
                  >
                    {generando ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Generando...</> : `${m4Data.decision === 'aceptar' ? 'Aprobar' : 'Rechazar'} y Generar M4`}
                  </Button>
                )}
              </div>
            )}
            {tipoMutacionSeleccionado?.codigo === 'M5' && m5Data.subtipo && (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Botón Enviar a Aprobación (si no puede aprobar) */}
                {!puedeAprobar && (
                  <Button 
                    onClick={async () => {
                      if (!m5Data.predio || !m5Data.radicado) {
                        toast.error('Debe seleccionar un predio y un radicado');
                        return;
                      }
                      setEnviandoSolicitud(true);
                      try {
                        const payload = {
                          tipo: 'M5',
                          tipo_mutacion: 'M5',
                          subtipo: m5Data.subtipo,
                          municipio: m5Data.municipio,
                          radicado: m5Data.radicado,
                          predio: m5Data.predio,
                          predio_id: m5Data.predio.id,
                          zonas: m5Data.zonas,
                          construcciones: m5Data.construcciones,
                          observaciones: m5Data.observaciones,
                          texto_considerando: m5Data.texto_considerando,
                          enviar_a_aprobacion: true
                        };
                        
                        const response = await axios.post(
                          `${API_URL}/api/solicitudes-mutacion`,
                          payload,
                          { headers: { Authorization: `Bearer ${token}` } }
                        );
                        
                        if (response.data.exito) {
                          toast.success('Solicitud M5 enviada a aprobación');
                          resetFormularioM5();
                          setTipoMutacionSeleccionado(null);
                          setActiveTab('historial');
                          cargarSolicitudesPendientes();
                        } else {
                          toast.error(response.data.mensaje || 'Error al enviar solicitud');
                        }
                      } catch (error) {
                        console.error('Error enviando M5 a aprobación:', error);
                        toast.error(error.response?.data?.detail || 'Error al enviar solicitud');
                      } finally {
                        setEnviandoSolicitud(false);
                      }
                    }}
                    disabled={enviandoSolicitud || !m5Data.radicado || !m5Data.predio}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {enviandoSolicitud ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Enviando...</> : 'Enviar a Aprobación'}
                  </Button>
                )}
                {/* Botón Generar PDF (si puede aprobar) */}
                {puedeAprobar && (
                  <Button 
                    onClick={generarResolucionM5} 
                    disabled={generando || !m5Data.radicado || !m5Data.predio}
                    className={m5Data.subtipo === 'cancelacion' ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}
                    data-testid="m5-generar-btn"
                  >
                    {generando ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Generando...</> : 
                      m5Data.subtipo === 'cancelacion' ? 'Cancelar Predio y Generar M5' : 'Inscribir Predio y Generar M5'}
                  </Button>
                )}
              </div>
            )}
            {tipoMutacionSeleccionado?.codigo === 'RECTIFICACION_AREA' && (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Botón Enviar a Aprobación (si no puede aprobar) */}
                {!puedeAprobar && (
                  <Button 
                    onClick={async () => {
                      if (!rectificacionData.predio || !rectificacionData.radicado) {
                        toast.error('Debe seleccionar un predio y un radicado');
                        return;
                      }
                      setEnviandoSolicitud(true);
                      try {
                        const predio = rectificacionData.predio;
                        const areaTerreno = predio.area_terreno || predio.r1_registros?.[0]?.area_terreno || 0;
                        const areaConstruida = predio.area_construida || predio.r1_registros?.[0]?.area_construida || 0;
                        const avaluo = predio.avaluo || predio.r1_registros?.[0]?.avaluo || 0;
                        
                        const payload = {
                          tipo: 'RECTIFICACION_AREA',
                          tipo_mutacion: 'RECTIFICACION_AREA',
                          municipio: rectificacionData.municipio,
                          radicado: rectificacionData.radicado,
                          predio: predio,
                          predio_id: predio.id,
                          solicitante: {
                            nombre: predio.nombre_propietario || predio.propietarios?.[0]?.nombre_propietario || '',
                            documento: predio.numero_documento || predio.propietarios?.[0]?.numero_documento || ''
                          },
                          area_terreno_anterior: areaTerreno,
                          area_construida_anterior: areaConstruida,
                          avaluo_anterior: avaluo,
                          area_terreno_nueva: rectificacionData.area_terreno_nueva,
                          area_construida_nueva: rectificacionData.area_construida_nueva,
                          avaluo_nuevo: rectificacionData.avaluo_nuevo,
                          motivo_solicitud: rectificacionData.motivo_solicitud,
                          observaciones: rectificacionData.observaciones,
                          texto_considerando: rectificacionData.texto_considerando,
                          enviar_a_aprobacion: true
                        };
                        
                        const response = await axios.post(
                          `${API_URL}/api/solicitudes-mutacion`,
                          payload,
                          { headers: { Authorization: `Bearer ${token}` } }
                        );
                        
                        if (response.data.exito) {
                          toast.success('Solicitud enviada a aprobación exitosamente');
                          resetRectificacionForm();
                          setTipoMutacionSeleccionado(null);
                          setActiveTab('historial');
                          cargarSolicitudesPendientes();
                        } else {
                          toast.error(response.data.mensaje || 'Error al enviar solicitud');
                        }
                      } catch (error) {
                        console.error('Error enviando a aprobación:', error);
                        toast.error(error.response?.data?.detail || 'Error al enviar solicitud');
                      } finally {
                        setEnviandoSolicitud(false);
                      }
                    }}
                    disabled={enviandoSolicitud || !rectificacionData.radicado || !rectificacionData.predio}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {enviandoSolicitud ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Enviando...</> : 'Enviar a Aprobación'}
                  </Button>
                )}
                
                {/* Botón Generar PDF (si puede aprobar) */}
                {puedeAprobar && (
                  <Button 
                    onClick={generarResolucionRectificacion} 
                    disabled={generando || !rectificacionData.radicado || !rectificacionData.predio || !rectificacionData.area_terreno_nueva}
                    className="bg-cyan-600 hover:bg-cyan-700"
                    data-testid="rectificacion-generar-btn"
                  >
                    {generando ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Generando...</> : 'Generar Resolución de Rectificación'}
                  </Button>
                )}
              </div>
            )}
            {tipoMutacionSeleccionado?.codigo === 'COMP' && (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Botón Enviar a Aprobación (si no puede aprobar) */}
                {!puedeAprobar && (
                  <Button 
                    onClick={async () => {
                      if (!complementacionData.predio) {
                        toast.error('Debe seleccionar un predio');
                        return;
                      }
                      setEnviandoSolicitud(true);
                      try {
                        const predio = complementacionData.predio;
                        const areaTerreno = predio.area_terreno || predio.r1_registros?.[0]?.area_terreno || 0;
                        const areaConstruida = predio.area_construida || predio.r1_registros?.[0]?.area_construida || 0;
                        const avaluo = predio.avaluo || predio.r1_registros?.[0]?.avaluo || 0;
                        
                        const payload = {
                          tipo: 'COMPLEMENTACION',
                          tipo_mutacion: 'COMPLEMENTACION',
                          municipio: complementacionData.municipio,
                          predio: predio,
                          predio_id: predio.id,
                          solicitante: {
                            nombre: predio.nombre_propietario || predio.propietarios?.[0]?.nombre_propietario || '',
                            documento: predio.numero_documento || predio.propietarios?.[0]?.numero_documento || ''
                          },
                          area_terreno_anterior: areaTerreno,
                          area_construida_anterior: areaConstruida,
                          avaluo_anterior: avaluo,
                          area_terreno_nueva: complementacionData.area_terreno_nueva,
                          area_construida_nueva: complementacionData.area_construida_nueva,
                          avaluo_nuevo: complementacionData.avaluo_nuevo,
                          documentos_soporte: complementacionData.documentos_soporte,
                          observaciones: complementacionData.observaciones,
                          texto_considerando: complementacionData.texto_considerando,
                          enviar_a_aprobacion: true
                        };
                        
                        const response = await axios.post(
                          `${API_URL}/api/solicitudes-mutacion`,
                          payload,
                          { headers: { Authorization: `Bearer ${token}` } }
                        );
                        
                        if (response.data.exito) {
                          toast.success('Solicitud enviada a aprobación exitosamente');
                          resetComplementacionForm();
                          setTipoMutacionSeleccionado(null);
                          setActiveTab('historial');
                          cargarSolicitudesPendientes();
                        } else {
                          toast.error(response.data.mensaje || 'Error al enviar solicitud');
                        }
                      } catch (error) {
                        console.error('Error enviando a aprobación:', error);
                        toast.error(error.response?.data?.detail || 'Error al enviar solicitud');
                      } finally {
                        setEnviandoSolicitud(false);
                      }
                    }}
                    disabled={enviandoSolicitud || !complementacionData.predio}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {enviandoSolicitud ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Enviando...</> : 'Enviar a Aprobación'}
                  </Button>
                )}
                
                {/* Botón Generar PDF (si puede aprobar) */}
                {puedeAprobar && (
                  <Button 
                    onClick={generarResolucionComplementacion} 
                    disabled={generando || !complementacionData.predio}
                    className="bg-slate-600 hover:bg-slate-700"
                    data-testid="complementacion-generar-btn"
                  >
                    {generando ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Generando...</> : 'Generar Resolución de Complementación'}
                  </Button>
                )}
              </div>
            )}
            {tipoMutacionSeleccionado?.codigo === 'BLOQUEO' && bloqueoPredioSeleccionado && bloqueoTab === 'bloquear' && (
              <Button 
                onClick={bloquearPredio}
                disabled={procesandoBloqueo || !bloqueoFormData.motivo.trim()}
                className="bg-red-600 hover:bg-red-700"
                data-testid="bloqueo-confirmar-btn"
              >
                {procesandoBloqueo ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Procesando...</>
                ) : (
                  <><Lock className="w-4 h-4 mr-2" /> Bloquear Predio</>
                )}
              </Button>
            )}
            {tipoMutacionSeleccionado?.codigo === 'M2' && (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Selector de Gestor de Apoyo */}
                <div className="flex items-center gap-2">
                  <select
                    value={gestorApoyoSeleccionado}
                    onChange={(e) => setGestorApoyoSeleccionado(e.target.value)}
                    className="h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Gestor de apoyo (opcional)</option>
                    {gestoresDisponibles.map(g => (
                      <option key={g.id} value={g.id}>{g.full_name}</option>
                    ))}
                  </select>
                </div>
                
                {/* Botón Asignar a Apoyo */}
                {gestorApoyoSeleccionado && (
                  <Button 
                    onClick={asignarAApoyo} 
                    disabled={enviandoSolicitud}
                    variant="outline"
                    className="border-amber-500 text-amber-700 hover:bg-amber-50"
                  >
                    {enviandoSolicitud ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                    Asignar a Apoyo
                  </Button>
                )}
                
                {/* Botón Enviar a Aprobación (si no puede aprobar) */}
                {!puedeAprobar && (
                  <Button 
                    onClick={enviarAAprobacion} 
                    disabled={enviandoSolicitud}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {enviandoSolicitud ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                    Enviar a Aprobación
                  </Button>
                )}
                
                {/* Botón Generar PDF (si puede aprobar) */}
                {puedeAprobar && (
                  <Button 
                    onClick={generarResolucionM2} 
                    disabled={generando}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {generando ? 'Generando...' : 'Generar Resolución M2'}
                  </Button>
                )}
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Edición Completa de Predio (Cancelación Parcial) */}
      <Dialog open={editandoPredio !== null} onOpenChange={(open) => !open && cerrarEdicionPredio()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-800">
              <Edit className="w-5 h-5" />
              Editar Predio - Cancelación Parcial
            </DialogTitle>
          </DialogHeader>
          
          {predioEditando && (
            <div className="flex-1 overflow-y-auto">
              {/* Info del predio */}
              <div className="bg-slate-100 p-3 rounded-lg mb-4">
                <p className="font-mono font-medium">{predioEditando.codigo_predial}</p>
                <p className="text-sm text-slate-600">{predioEditando.direccion}</p>
              </div>
              
              {/* Tabs R1 / R2 */}
              <Tabs value={tabEdicion} onValueChange={setTabEdicion} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="r1" className="data-[state=active]:bg-blue-100">
                    R1 - Propietarios
                  </TabsTrigger>
                  <TabsTrigger value="r2" className="data-[state=active]:bg-purple-100">
                    R2 - Zonas y Áreas
                  </TabsTrigger>
                </TabsList>
                
                {/* TAB R1 - Propietarios */}
                <TabsContent value="r1" className="mt-4 space-y-4">
                  {/* Datos básicos del predio */}
                  <Card>
                    <CardHeader className="py-2">
                      <CardTitle className="text-sm">Datos del Predio</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Dirección</Label>
                        <Input
                          value={predioEditando.direccion || ''}
                          onChange={(e) => setPredioEditando(prev => ({...prev, direccion: e.target.value}))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Matrícula Inmobiliaria</Label>
                        <Input
                          value={predioEditando.matricula_inmobiliaria || ''}
                          onChange={(e) => setPredioEditando(prev => ({...prev, matricula_inmobiliaria: e.target.value}))}
                        />
                      </div>
                      {/* Destino Económico - Dropdown personalizado */}
                      <div className="relative">
                        <Label className="text-xs">Destino Económico</Label>
                        <div 
                          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-white px-3 py-2 text-sm cursor-pointer hover:bg-slate-50"
                          onClick={() => setShowDestinoDropdown(!showDestinoDropdown)}
                        >
                          <span>
                            {predioEditando.destino_economico === 'A' ? 'A - Habitacional' :
                             predioEditando.destino_economico === 'B' ? 'B - Industrial' :
                             predioEditando.destino_economico === 'C' ? 'C - Comercial' :
                             predioEditando.destino_economico === 'D' ? 'D - Agropecuario' :
                             predioEditando.destino_economico === 'E' ? 'E - Minero' :
                             predioEditando.destino_economico === 'L' ? 'L - Agrícola' :
                             predioEditando.destino_economico === 'R' ? 'R - Residencial' : 'Seleccionar'}
                          </span>
                          <ChevronDown className="h-4 w-4 opacity-50" />
                        </div>
                        {showDestinoDropdown && (
                          <div className="absolute z-[99999] mt-1 w-full bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                            {[
                              {v: 'A', l: 'A - Habitacional'}, {v: 'B', l: 'B - Industrial'},
                              {v: 'C', l: 'C - Comercial'}, {v: 'D', l: 'D - Agropecuario'},
                              {v: 'E', l: 'E - Minero'}, {v: 'L', l: 'L - Agrícola'}, {v: 'R', l: 'R - Residencial'}
                            ].map(opt => (
                              <div
                                key={opt.v}
                                className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${predioEditando.destino_economico === opt.v ? 'bg-blue-100' : ''}`}
                                onClick={() => { setPredioEditando(prev => ({...prev, destino_economico: opt.v})); setShowDestinoDropdown(false); }}
                              >
                                {opt.l}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs">Código Homologado</Label>
                        <Input
                          value={predioEditando.codigo_homologado || ''}
                          disabled
                          className="bg-slate-100 cursor-not-allowed"
                        />
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Propietarios */}
                  <Card>
                    <CardHeader className="py-2">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-sm">Propietarios ({predioEditando.propietarios?.length || 0})</CardTitle>
                        <Button size="sm" onClick={agregarPropietarioEdicion} variant="outline">
                          <Plus className="w-4 h-4 mr-1" /> Agregar
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 max-h-60 overflow-y-auto">
                      {predioEditando.propietarios?.map((prop, propIdx) => (
                        <div key={propIdx} className="bg-slate-50 p-3 rounded border">
                          <div className="flex justify-between items-center mb-2">
                            <Badge variant="outline">Propietario {propIdx + 1}</Badge>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => eliminarPropietarioEdicion(propIdx)}
                              className="text-red-600 h-6"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            <div className="col-span-2">
                              <Label className="text-xs">Nombre Completo</Label>
                              <Input
                                value={prop.nombre_propietario || ''}
                                onChange={(e) => actualizarPropietarioEdicion(propIdx, 'nombre_propietario', e.target.value.toUpperCase())}
                                className="h-8"
                              />
                            </div>
                            {/* Tipo Doc - Dropdown personalizado */}
                            <div className="relative">
                              <Label className="text-xs">Tipo Doc.</Label>
                              <div 
                                className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-white px-2 py-1 text-sm cursor-pointer hover:bg-slate-50"
                                onClick={() => setShowTipoDocDropdown(prev => ({...prev, [propIdx]: !prev[propIdx]}))}
                              >
                                <span className="text-xs">
                                  {prop.tipo_documento === 'C' ? 'Cédula' :
                                   prop.tipo_documento === 'N' ? 'NIT' :
                                   prop.tipo_documento === 'E' ? 'Céd. Ext.' :
                                   prop.tipo_documento === 'T' ? 'Tarjeta' :
                                   prop.tipo_documento === 'S' ? 'Secuencial' : 'Cédula'}
                                </span>
                                <ChevronDown className="h-3 w-3 opacity-50" />
                              </div>
                              {showTipoDocDropdown[propIdx] && (
                                <div className="absolute z-[99999] mt-1 w-full bg-white border rounded-md shadow-lg">
                                  {[{v:'C',l:'Cédula'},{v:'N',l:'NIT'},{v:'E',l:'Céd. Ext.'},{v:'T',l:'Tarjeta'},{v:'S',l:'Secuencial'}].map(opt => (
                                    <div
                                      key={opt.v}
                                      className={`px-2 py-1 text-xs cursor-pointer hover:bg-blue-50 ${prop.tipo_documento === opt.v ? 'bg-blue-100' : ''}`}
                                      onClick={() => { actualizarPropietarioEdicion(propIdx, 'tipo_documento', opt.v); setShowTipoDocDropdown(prev => ({...prev, [propIdx]: false})); }}
                                    >
                                      {opt.l}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div>
                              <Label className="text-xs">Número Doc.</Label>
                              <Input
                                value={prop.numero_documento || ''}
                                onChange={(e) => actualizarPropietarioEdicion(propIdx, 'numero_documento', e.target.value)}
                                className="h-8"
                              />
                            </div>
                            {/* Estado Civil - Dropdown personalizado */}
                            <div className="relative col-span-2">
                              <Label className="text-xs">Estado Civil</Label>
                              <div 
                                className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-white px-2 py-1 text-sm cursor-pointer hover:bg-slate-50"
                                onClick={() => setShowEstadoCivilDropdown(prev => ({...prev, [propIdx]: !prev[propIdx]}))}
                              >
                                <span className="text-xs">{prop.estado || 'Sin especificar'}</span>
                                <ChevronDown className="h-3 w-3 opacity-50" />
                              </div>
                              {showEstadoCivilDropdown[propIdx] && (
                                <div className="absolute z-[99999] mt-1 w-full bg-white border rounded-md shadow-lg">
                                  {['Sin especificar','SOLTERO','CASADO','UNION LIBRE','DIVORCIADO','VIUDO'].map(opt => (
                                    <div
                                      key={opt}
                                      className={`px-2 py-1 text-xs cursor-pointer hover:bg-blue-50 ${prop.estado === opt || (!prop.estado && opt === 'Sin especificar') ? 'bg-blue-100' : ''}`}
                                      onClick={() => { actualizarPropietarioEdicion(propIdx, 'estado', opt === 'Sin especificar' ? '' : opt); setShowEstadoCivilDropdown(prev => ({...prev, [propIdx]: false})); }}
                                    >
                                      {opt}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </TabsContent>
                
                {/* TAB R2 - Zonas y Áreas */}
                <TabsContent value="r2" className="mt-4 space-y-4 max-h-[50vh] overflow-y-auto">
                  <Card>
                    <CardHeader className="py-2">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-sm">Zonas Homogéneas ({predioEditando.zonas_homogeneas?.length || 0})</CardTitle>
                        <Button size="sm" onClick={agregarZonaEdicion} variant="outline">
                          <Plus className="w-4 h-4 mr-1" /> Agregar Zona
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500">Las áreas totales se calculan sumando todas las zonas</p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {predioEditando.zonas_homogeneas?.map((zona, zonaIdx) => (
                        <div key={zonaIdx} className="bg-purple-50 p-3 rounded border border-purple-200">
                          <div className="flex justify-between items-center mb-2">
                            <Badge className="bg-purple-100 text-purple-800">Zona {zonaIdx + 1}</Badge>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => eliminarZonaEdicion(zonaIdx)}
                              className="text-red-600 h-6"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                          {/* Fila 1: Zonas y Áreas */}
                          <div className="grid grid-cols-5 gap-2 mb-2">
                            <div>
                              <Label className="text-xs">Zona Física</Label>
                              <Input
                                value={zona.zona_fisica || ''}
                                onChange={(e) => actualizarZonaEdicion(zonaIdx, 'zona_fisica', e.target.value)}
                                className="h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Zona Económica</Label>
                              <Input
                                value={zona.zona_economica || ''}
                                onChange={(e) => actualizarZonaEdicion(zonaIdx, 'zona_economica', e.target.value)}
                                className="h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Área Terreno (m²)</Label>
                              <Input
                                type="number"
                                value={zona.area_terreno || 0}
                                onChange={(e) => actualizarZonaEdicion(zonaIdx, 'area_terreno', Number(e.target.value))}
                                className="h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Área Construida (m²)</Label>
                              <Input
                                type="number"
                                value={zona.area_construida || 0}
                                onChange={(e) => actualizarZonaEdicion(zonaIdx, 'area_construida', Number(e.target.value))}
                                className="h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Avalúo ($)</Label>
                              <Input
                                type="number"
                                value={zona.avaluo || 0}
                                onChange={(e) => actualizarZonaEdicion(zonaIdx, 'avaluo', Number(e.target.value))}
                                className="h-8"
                              />
                            </div>
                          </div>
                          {/* Fila 2: Datos de Construcción */}
                          <div className="border-t border-purple-200 pt-2 mt-2">
                            <p className="text-xs font-medium text-purple-800 mb-2">Datos de Construcción</p>
                            <div className="grid grid-cols-6 gap-2">
                              <div>
                                <Label className="text-xs">Pisos</Label>
                                <Input
                                  type="number"
                                  value={zona.pisos || 0}
                                  onChange={(e) => actualizarZonaEdicion(zonaIdx, 'pisos', Number(e.target.value))}
                                  className="h-7 text-xs"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Habitaciones</Label>
                                <Input
                                  type="number"
                                  value={zona.habitaciones || 0}
                                  onChange={(e) => actualizarZonaEdicion(zonaIdx, 'habitaciones', Number(e.target.value))}
                                  className="h-7 text-xs"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Baños</Label>
                                <Input
                                  type="number"
                                  value={zona.banos || 0}
                                  onChange={(e) => actualizarZonaEdicion(zonaIdx, 'banos', Number(e.target.value))}
                                  className="h-7 text-xs"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Locales</Label>
                                <Input
                                  type="number"
                                  value={zona.locales || 0}
                                  onChange={(e) => actualizarZonaEdicion(zonaIdx, 'locales', Number(e.target.value))}
                                  className="h-7 text-xs"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Uso</Label>
                                <Input
                                  value={zona.uso || ''}
                                  onChange={(e) => actualizarZonaEdicion(zonaIdx, 'uso', e.target.value)}
                                  className="h-7 text-xs"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Puntaje</Label>
                                <Input
                                  type="number"
                                  value={zona.puntaje || 0}
                                  onChange={(e) => actualizarZonaEdicion(zonaIdx, 'puntaje', Number(e.target.value))}
                                  className="h-7 text-xs"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {/* Totales calculados */}
                      <div className="bg-slate-100 p-3 rounded-lg mt-4">
                        <p className="text-sm font-medium mb-2">Totales (calculados de R2):</p>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <span className="text-xs text-slate-500">Área Terreno Total:</span>
                            <span className="font-bold block">
                              {predioEditando.zonas_homogeneas?.reduce((sum, z) => sum + (Number(z.area_terreno) || 0), 0).toLocaleString()} m²
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-slate-500">Área Construida Total:</span>
                            <span className="font-bold block">
                              {predioEditando.zonas_homogeneas?.reduce((sum, z) => sum + (Number(z.area_construida) || 0), 0).toLocaleString()} m²
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-slate-500">Avalúo Total:</span>
                            <span className="font-bold block">
                              ${predioEditando.zonas_homogeneas?.reduce((sum, z) => sum + (Number(z.avaluo) || 0), 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
          
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={cerrarEdicionPredio}>
              Cancelar
            </Button>
            <Button onClick={guardarEdicionPredio} className="bg-amber-600 hover:bg-amber-700">
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Nuevo Predio Inscrito (M2) - Completo como en Predios.js */}
      <Dialog open={showNuevoPredioModal} onOpenChange={(open) => !open && setShowNuevoPredioModal(false)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-800">
              <Building className="w-5 h-5" />
              {nuevoPredioModalMode === 'englobe_total' 
                ? 'Nuevo Predio Resultante del Englobe'
                : nuevoPredioInscrito?._editIndex !== undefined 
                  ? 'Editar Predio a Inscribir' 
                  : 'Nuevo Predio a Inscribir'
              }
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto pr-2">
            <Tabs value={tabNuevoPredio} onValueChange={setTabNuevoPredio} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="ubicacion" className="data-[state=active]:bg-blue-100">
                  Código Nacional (30 dígitos)
                </TabsTrigger>
                <TabsTrigger value="propietario" className="data-[state=active]:bg-emerald-100">
                  Propietario (R1)
                </TabsTrigger>
                <TabsTrigger value="fisico" className="data-[state=active]:bg-purple-100">
                  Físico (R2)
                </TabsTrigger>
              </TabsList>
              
              {/* TAB: Código Predial Nacional */}
              <TabsContent value="ubicacion" className="mt-4 space-y-4">
                {estructuraCodigoNuevo && (
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Código Predial Nacional (30 dígitos)
                    </h4>
                    
                    {/* Código Homologado Asignado */}
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
                      <Label className="text-sm text-emerald-700 font-semibold mb-2 block">Código Homologado Asignado</Label>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center flex-1 bg-white border border-emerald-300 rounded-md overflow-hidden">
                          <div className="bg-emerald-100 p-2.5 border-r border-emerald-300">
                            <Lock className="w-5 h-5 text-emerald-600" />
                          </div>
                          <input 
                            value={siguienteCodigoHomologadoNuevo?.codigo || 'Cargando...'} 
                            disabled 
                            className="flex-1 px-3 py-2 font-mono text-lg text-emerald-700 font-bold bg-transparent border-none outline-none"
                          />
                        </div>
                        {siguienteCodigoHomologadoNuevo?.disponibles !== undefined && (
                          <div className="bg-emerald-100 border border-emerald-300 rounded-md px-4 py-2">
                            <span className="text-emerald-700 font-semibold">
                              {siguienteCodigoHomologadoNuevo.disponibles} disponibles
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Visualización del código completo */}
                    <div className="bg-white p-3 rounded border mb-4 font-mono text-lg tracking-wider text-center">
                      <span className="text-blue-600 font-bold" title="Departamento + Municipio">{estructuraCodigoNuevo.prefijo_fijo}</span>
                      <span className="text-emerald-600" title="Zona">{(codigoManualNuevo.zona || '').padStart(2, '0')}</span>
                      <span className="text-amber-600" title="Sector">{(codigoManualNuevo.sector || '').padStart(2, '0')}</span>
                      <span className="text-purple-600" title="Comuna">{(codigoManualNuevo.comuna || '').padStart(2, '0')}</span>
                      <span className="text-pink-600" title="Barrio">{(codigoManualNuevo.barrio || '').padStart(2, '0')}</span>
                      <span className="text-cyan-600" title="Manzana/Vereda">{(codigoManualNuevo.manzana_vereda || '').padStart(4, '0')}</span>
                      <span className="text-red-600 font-bold" title="Terreno">{(codigoManualNuevo.terreno || '').padStart(4, '0')}</span>
                      <span className="text-orange-600" title="Condición">{codigoManualNuevo.condicion || '0'}</span>
                      <span className="text-slate-500" title="Edificio">{(codigoManualNuevo.edificio || '').padStart(2, '0')}</span>
                      <span className="text-slate-500" title="Piso">{(codigoManualNuevo.piso || '').padStart(2, '0')}</span>
                      <span className="text-slate-500" title="Unidad">{(codigoManualNuevo.unidad || '').padStart(4, '0')}</span>
                      <span className="text-xs text-slate-500 ml-2">({construirCodigoCompletoNuevo().length}/30)</span>
                    </div>

                    {/* Campos editables - Fila 1: Ubicación geográfica */}
                    <div className="grid grid-cols-6 gap-3 mb-3">
                      <div className="bg-slate-100 p-2 rounded">
                        <Label className="text-xs text-slate-600">Dpto+Mpio (1-5)</Label>
                        <Input value={estructuraCodigoNuevo.prefijo_fijo} disabled className="font-mono bg-white text-slate-700 font-bold text-center h-9 border-slate-300" />
                      </div>
                      <div>
                        <Label className="text-xs text-emerald-600">Zona (6-7)</Label>
                        <Input 
                          value={codigoManualNuevo.zona} 
                          onChange={(e) => handleCodigoChangeNuevo('zona', e.target.value, 2)}
                          onBlur={() => handleCodigoBlurNuevo('zona', 2)}
                          maxLength={2}
                          className="font-mono text-center h-9 text-emerald-700"
                          placeholder="00"
                        />
                        <span className="text-xs text-slate-400 block mt-1">00=Rural, 01=Urbano, 02-99=Correg.</span>
                      </div>
                      <div>
                        <Label className="text-xs text-amber-600">Sector (8-9)</Label>
                        <Input 
                          value={codigoManualNuevo.sector} 
                          onChange={(e) => handleCodigoChangeNuevo('sector', e.target.value, 2)}
                          onBlur={() => handleCodigoBlurNuevo('sector', 2)}
                          maxLength={2}
                          className="font-mono text-center h-9 text-amber-700"
                          placeholder="00"
                        />
                        {/* Última manzana encontrada en esta zona/sector */}
                        {ultimaManzanaEncontrada && (
                          <div className="bg-yellow-100 border border-yellow-300 rounded px-2 py-1 mt-1">
                            <span className="text-xs text-yellow-700">Última manzana:</span>
                            <span className="text-sm font-bold text-yellow-800 ml-1">{ultimaManzanaEncontrada}</span>
                          </div>
                        )}
                        {buscandoUltimaManzana && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Buscando...
                          </div>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs text-purple-600">Comuna (10-11)</Label>
                        <Input 
                          value={codigoManualNuevo.comuna} 
                          onChange={(e) => handleCodigoChangeNuevo('comuna', e.target.value, 2)}
                          onBlur={() => handleCodigoBlurNuevo('comuna', 2)}
                          maxLength={2}
                          className="font-mono text-center h-9 text-purple-700"
                          placeholder="00"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-pink-600">Barrio (12-13)</Label>
                        <Input 
                          value={codigoManualNuevo.barrio} 
                          onChange={(e) => handleCodigoChangeNuevo('barrio', e.target.value, 2)}
                          onBlur={() => handleCodigoBlurNuevo('barrio', 2)}
                          maxLength={2}
                          className="font-mono text-center h-9 text-pink-700"
                          placeholder="00"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-cyan-600">Manzana (14-17)</Label>
                        <Input 
                          value={codigoManualNuevo.manzana_vereda} 
                          onChange={(e) => handleCodigoChangeNuevo('manzana_vereda', e.target.value, 4)}
                          onBlur={() => handleCodigoBlurNuevo('manzana_vereda', 4)}
                          maxLength={4}
                          className={`font-mono text-center h-9 text-cyan-700 ${codigoManualNuevo.manzana_vereda && codigoManualNuevo.manzana_vereda !== '0000' ? 'border-2 border-emerald-500 bg-emerald-50' : ''}`}
                          placeholder="0000"
                        />
                      </div>
                    </div>

                    {/* Terrenos existentes en manzana */}
                    {codigoManualNuevo.manzana_vereda && codigoManualNuevo.manzana_vereda !== '0000' && codigoManualNuevo.manzana_vereda !== '' && (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="w-4 h-4 text-cyan-600" />
                          <span className="text-sm font-medium text-cyan-700">
                            Terrenos existentes en manzana {(codigoManualNuevo.manzana_vereda || '').padStart(4, '0')}
                          </span>
                          {buscandoPrediosManzanaNuevo && <Loader2 className="w-4 h-4 animate-spin text-cyan-600" />}
                        </div>
                        
                        {prediosEnManzanaNuevo.length > 0 ? (
                          <div className="space-y-2">
                            {prediosEnManzanaNuevo.slice(0, 5).map((p, idx) => (
                              <div 
                                key={idx} 
                                className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-slate-200"
                              >
                                <span className="font-mono font-bold text-cyan-600 text-sm w-12">{p.terreno}</span>
                                <span className="text-slate-700 text-sm flex-1 truncate">{p.direccion || 'Sin dirección'}</span>
                                <span className="text-slate-500 text-xs whitespace-nowrap">
                                  {p.area_terreno ? `${Number(p.area_terreno).toLocaleString('es-CO', {minimumFractionDigits: 1})}m²` : ''}
                                </span>
                                <span className="bg-cyan-100 text-cyan-700 text-xs px-2 py-0.5 rounded font-medium">
                                  {p.registros || 1} reg
                                </span>
                              </div>
                            ))}
                            
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200">
                              <span className="text-xs text-cyan-600">
                                Mostrando últimos 5 terrenos únicos (Base R1/R2)
                              </span>
                              <div className="flex items-center gap-1 text-amber-600">
                                <span className="text-lg">💡</span>
                                <span className="text-sm font-semibold">Siguiente: {siguienteTerrenoSugeridoNuevo}</span>
                              </div>
                            </div>
                          </div>
                        ) : !buscandoPrediosManzanaNuevo ? (
                          <p className="text-sm text-slate-500">No hay predios registrados en esta manzana.</p>
                        ) : null}
                      </div>
                    )}

                    {/* Campos editables - Fila 2: Predio y PH */}
                    <div className="grid grid-cols-5 gap-3">
                      <div className="bg-orange-50 p-3 rounded-lg border-2 border-orange-300">
                        <Label className="text-xs text-orange-600 font-semibold">Terreno (18-21) *</Label>
                        <Input 
                          value={codigoManualNuevo.terreno} 
                          onChange={(e) => handleCodigoChangeNuevo('terreno', e.target.value, 4)}
                          onBlur={() => handleCodigoBlurNuevo('terreno', 4)}
                          maxLength={4}
                          className="font-mono font-bold text-orange-600 text-center h-9 text-lg border-orange-300"
                          placeholder="0001"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Condición (22)</Label>
                        <Input 
                          value={codigoManualNuevo.condicion} 
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 1);
                            setCodigoManualNuevo(prev => ({...prev, condicion: val}));
                          }}
                          onBlur={() => {
                            setCodigoManualNuevo(prev => ({...prev, condicion: prev.condicion || '0'}));
                          }}
                          maxLength={1}
                          className="font-mono text-center h-9 text-slate-600"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Edificio (23-24)</Label>
                        <Input 
                          value={codigoManualNuevo.edificio} 
                          onChange={(e) => handleCodigoChangeNuevo('edificio', e.target.value, 2)}
                          onBlur={() => handleCodigoBlurNuevo('edificio', 2)}
                          maxLength={2}
                          className="font-mono text-center h-9 text-slate-600"
                          placeholder="00"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Piso (25-26)</Label>
                        <Input 
                          value={codigoManualNuevo.piso} 
                          onChange={(e) => handleCodigoChangeNuevo('piso', e.target.value, 2)}
                          onBlur={() => handleCodigoBlurNuevo('piso', 2)}
                          maxLength={2}
                          className="font-mono text-center h-9 text-slate-600"
                          placeholder="00"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Unidad (27-30)</Label>
                        <Input 
                          value={codigoManualNuevo.unidad} 
                          onChange={(e) => handleCodigoChangeNuevo('unidad', e.target.value, 4)}
                          onBlur={() => handleCodigoBlurNuevo('unidad', 4)}
                          maxLength={4}
                          className="font-mono text-center h-9 text-slate-600"
                          placeholder="0000"
                        />
                      </div>
                    </div>

                    {/* Botón de verificar */}
                    <div className="mt-4 flex gap-3">
                      <Button onClick={verificarCodigoCompletoNuevo} variant="outline" className="flex-1">
                        <Search className="w-4 h-4 mr-2" />
                        Verificar Código
                      </Button>
                    </div>
                    
                    {/* Estado de verificación */}
                    {verificacionCodigoNuevo && (
                      <div className={`mt-3 p-3 rounded-lg ${
                        verificacionCodigoNuevo.estado === 'disponible' ? 'bg-emerald-100 border border-emerald-300' :
                        verificacionCodigoNuevo.estado === 'existente' ? 'bg-red-100 border border-red-300' :
                        'bg-amber-100 border border-amber-300'
                      }`}>
                        <p className={`text-sm font-medium ${
                          verificacionCodigoNuevo.estado === 'disponible' ? 'text-emerald-800' :
                          verificacionCodigoNuevo.estado === 'existente' ? 'text-red-800' :
                          'text-amber-800'
                        }`}>
                          {verificacionCodigoNuevo.estado === 'disponible' && '✓ Código disponible'}
                          {verificacionCodigoNuevo.estado === 'existente' && '✗ Este código ya existe'}
                          {verificacionCodigoNuevo.estado === 'eliminado' && '⚠ Predio eliminado - Se puede reactivar'}
                        </p>
                        {verificacionCodigoNuevo.estado === 'eliminado' && verificacionCodigoNuevo.detalles_eliminacion && (
                          <div className="mt-2 text-xs text-amber-700 space-y-1">
                            <p><strong>Vigencia eliminación:</strong> {verificacionCodigoNuevo.detalles_eliminacion.vigencia_eliminacion || 'N/A'}</p>
                            <p><strong>Motivo:</strong> {verificacionCodigoNuevo.detalles_eliminacion.motivo || 'Mutación catastral'}</p>
                            <p className="text-amber-800 font-medium mt-2">
                              ℹ️ Para reactivar este predio, complete los datos y continúe con el proceso de mutación.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
              
              {/* TAB: Propietario (R1) */}
              <TabsContent value="propietario" className="mt-4 space-y-4">
                {/* Lista de propietarios */}
                <Card>
                  <CardHeader className="py-2">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-sm">Propietarios ({propietariosNuevo.length})</CardTitle>
                      <Button size="sm" onClick={agregarPropietarioNuevoPredio} variant="outline">
                        <Plus className="w-4 h-4 mr-1" /> Agregar
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 max-h-48 overflow-y-auto">
                    {propietariosNuevo.map((prop, index) => (
                      <div key={index} className="bg-slate-50 p-3 rounded border">
                        <div className="flex justify-between items-center mb-2">
                          <Badge variant="outline">Propietario {index + 1}</Badge>
                          {propietariosNuevo.length > 1 && (
                            <Button variant="ghost" size="sm" onClick={() => eliminarPropietarioNuevoPredio(index)} className="text-red-600 h-6">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <div className="col-span-2">
                            <Label className="text-xs">Nombre Completo *</Label>
                            <Input
                              value={prop.nombre_propietario}
                              onChange={(e) => actualizarPropietarioNuevoPredio(index, 'nombre_propietario', e.target.value.toUpperCase())}
                              placeholder="APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2"
                              className="h-8"
                            />
                          </div>
                          <div className="relative">
                            <Label className="text-xs">Tipo Doc.</Label>
                            <div 
                              className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-white px-2 py-1 text-sm cursor-pointer hover:bg-slate-50"
                              onClick={() => setShowTipoDocDropdownNuevo(prev => ({...prev, [index]: !prev[index]}))}
                            >
                              <span className="text-xs">
                                {prop.tipo_documento === 'C' ? 'Cédula' :
                                 prop.tipo_documento === 'N' ? 'NIT' :
                                 prop.tipo_documento === 'E' ? 'Céd. Ext.' :
                                 prop.tipo_documento === 'T' ? 'Tarjeta' : 'Cédula'}
                              </span>
                              <ChevronDown className="h-3 w-3 opacity-50" />
                            </div>
                            {showTipoDocDropdownNuevo[index] && (
                              <div className="absolute z-[99999] mt-1 w-full bg-white border rounded-md shadow-lg">
                                {[{v:'C',l:'Cédula'},{v:'N',l:'NIT'},{v:'E',l:'Céd. Ext.'},{v:'T',l:'Tarjeta'}].map(opt => (
                                  <div
                                    key={opt.v}
                                    className={`px-2 py-1 text-xs cursor-pointer hover:bg-blue-50 ${prop.tipo_documento === opt.v ? 'bg-blue-100' : ''}`}
                                    onClick={() => { actualizarPropietarioNuevoPredio(index, 'tipo_documento', opt.v); setShowTipoDocDropdownNuevo(prev => ({...prev, [index]: false})); }}
                                  >
                                    {opt.l}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div>
                            <Label className="text-xs">Número Doc. *</Label>
                            <Input
                              value={prop.numero_documento}
                              onChange={(e) => actualizarPropietarioNuevoPredio(index, 'numero_documento', e.target.value.replace(/\D/g, ''))}
                              placeholder="12345678"
                              className="h-8"
                            />
                          </div>
                        </div>
                        <div className="mt-2">
                          <Label className="text-xs">Estado Civil</Label>
                          <RadioGroup 
                            value={prop.estado_civil || ''} 
                            onValueChange={(v) => actualizarPropietarioNuevoPredio(index, 'estado_civil', v)} 
                            className="flex flex-wrap gap-2 mt-1"
                          >
                            <div className="flex items-center space-x-1"><RadioGroupItem value="" id={`m2_estado_${index}_sin`} /><Label htmlFor={`m2_estado_${index}_sin`} className="text-[10px] cursor-pointer text-slate-500">Sin especificar</Label></div>
                            <div className="flex items-center space-x-1"><RadioGroupItem value="S" id={`m2_estado_${index}_sol`} /><Label htmlFor={`m2_estado_${index}_sol`} className="text-[10px] cursor-pointer">S: Soltero/a</Label></div>
                            <div className="flex items-center space-x-1"><RadioGroupItem value="C" id={`m2_estado_${index}_cas`} /><Label htmlFor={`m2_estado_${index}_cas`} className="text-[10px] cursor-pointer">C: Casado/a</Label></div>
                            <div className="flex items-center space-x-1"><RadioGroupItem value="V" id={`m2_estado_${index}_viu`} /><Label htmlFor={`m2_estado_${index}_viu`} className="text-[10px] cursor-pointer">V: Viudo/a</Label></div>
                            <div className="flex items-center space-x-1"><RadioGroupItem value="U" id={`m2_estado_${index}_uni`} /><Label htmlFor={`m2_estado_${index}_uni`} className="text-[10px] cursor-pointer">U: Unión libre</Label></div>
                          </RadioGroup>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                
                {/* Información del predio */}
                <Card>
                  <CardHeader className="py-2">
                    <CardTitle className="text-sm">Información del Predio</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Dirección */}
                    <div>
                      <Label className="text-sm font-medium">Dirección *</Label>
                      <Input
                        value={nuevoPredioInscrito?.direccion || ''}
                        onChange={(e) => setNuevoPredioInscrito(prev => ({...prev, direccion: e.target.value.toUpperCase()}))}
                        placeholder=""
                        className="mt-1"
                      />
                    </div>
                    
                    {/* Destino Económico - Radio buttons */}
                    <div>
                      <Label className="text-sm font-medium">Destino Económico *</Label>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                        {[
                          {v: 'A', l: 'A - Habitacional'},
                          {v: 'B', l: 'B - Industrial'},
                          {v: 'C', l: 'C - Comercial'},
                          {v: 'D', l: 'D - Agropecuario'},
                          {v: 'E', l: 'E - Minero'},
                          {v: 'F', l: 'F - Cultural'},
                          {v: 'G', l: 'G - Recreacional'},
                          {v: 'H', l: 'H - Salubridad'},
                          {v: 'I', l: 'I - Institucional'},
                          {v: 'J', l: 'J - Educativo'},
                          {v: 'K', l: 'K - Religioso'},
                          {v: 'L', l: 'L - Agrícola'},
                          {v: 'M', l: 'M - Pecuario'},
                          {v: 'N', l: 'N - Agroindustrial'},
                          {v: 'O', l: 'O - Forestal'},
                          {v: 'P', l: 'P - Uso Público'},
                          {v: 'Q', l: 'Q - Lote Urbanizable No Urbanizado'},
                          {v: 'R', l: 'R - Lote Urbanizable No Edificado'},
                          {v: 'S', l: 'S - Lote No Urbanizable'},
                          {v: 'T', l: 'T - Servicios Especiales'}
                        ].map(opt => (
                          <label 
                            key={opt.v} 
                            className="flex items-center gap-1.5 cursor-pointer text-sm"
                          >
                            <div 
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                nuevoPredioInscrito?.destino_economico === opt.v 
                                  ? 'border-emerald-500 bg-emerald-500' 
                                  : 'border-emerald-400'
                              }`}
                              onClick={() => setNuevoPredioInscrito(prev => ({...prev, destino_economico: opt.v}))}
                            >
                              {nuevoPredioInscrito?.destino_economico === opt.v && (
                                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                              )}
                            </div>
                            <span 
                              className="text-slate-700"
                              onClick={() => setNuevoPredioInscrito(prev => ({...prev, destino_economico: opt.v}))}
                            >
                              {opt.l}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                    
                    {/* Matrícula Inmobiliaria */}
                    <div className="max-w-md">
                      <Label className="text-sm font-medium">Matrícula Inmobiliaria</Label>
                      <Input
                        value={nuevoPredioInscrito?.matricula_inmobiliaria || ''}
                        onChange={(e) => setNuevoPredioInscrito(prev => ({...prev, matricula_inmobiliaria: e.target.value}))}
                        placeholder="Ej: 270-8920"
                        className="mt-1"
                      />
                    </div>
                    
                    {/* Áreas calculadas del R2 */}
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm font-medium text-slate-700">Áreas (calculadas del R2)</span>
                        <span className="text-xs bg-amber-400 text-amber-900 px-2 py-0.5 rounded font-medium">Automático</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm text-slate-600">Área Terreno Total (m²)</Label>
                          <div className="mt-1 bg-blue-100/50 border border-blue-200 rounded px-3 py-2 text-slate-700">
                            {calcularAreasTotalesNuevo().areaTerrenoTotal.toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm text-slate-600">Área Construida Total (m²)</Label>
                          <div className="mt-1 bg-blue-100/50 border border-blue-200 rounded px-3 py-2 text-slate-700">
                            {calcularAreasTotalesNuevo().areaConstruidaTotal.toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-amber-700 mt-2 flex items-start gap-1">
                        <span className="text-amber-500">💡</span>
                        Estas áreas se calculan automáticamente sumando las zonas del R2. Modifique los valores en la pestaña "Físico (R2)".
                      </p>
                    </div>
                    
                    {/* Avalúo */}
                    <div className="max-w-md">
                      <Label className="text-sm font-medium">Avalúo (COP) *</Label>
                      <Input
                        type="number"
                        value={nuevoPredioInscrito?.avaluo || 0}
                        onChange={(e) => setNuevoPredioInscrito(prev => ({...prev, avaluo: e.target.value}))}
                        placeholder="Ej: 200.000"
                        className="mt-1"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              {/* TAB: Físico (R2) */}
              <TabsContent value="fisico" className="mt-4 space-y-4">
                {/* Zonas de Terreno */}
                <Card>
                  <CardHeader className="py-2">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-sm">Zonas de Terreno ({zonasTerreno.length})</CardTitle>
                      <Button size="sm" onClick={agregarZonaTerreno} variant="outline" className="text-emerald-700">
                        <Plus className="w-4 h-4 mr-1" /> Agregar Zona
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {zonasTerreno.map((zona, index) => (
                      <div key={index} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-slate-700">Zona {index + 1}</span>
                          {zonasTerreno.length > 1 && (
                            <Button variant="ghost" size="sm" onClick={() => eliminarZonaTerreno(index)} className="text-red-600 h-6 w-6 p-0">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs">Zona Física</Label>
                            <Input value={zona.zona_fisica} onChange={(e) => actualizarZonaTerreno(index, 'zona_fisica', e.target.value)} placeholder="Ej: 03" className="h-8" />
                          </div>
                          <div>
                            <Label className="text-xs">Zona Económica</Label>
                            <Input value={zona.zona_economica} onChange={(e) => actualizarZonaTerreno(index, 'zona_economica', e.target.value)} placeholder="Ej: 05" className="h-8" />
                          </div>
                          <div>
                            <Label className="text-xs">Área Terreno (m²)</Label>
                            <Input type="number" value={zona.area_terreno} onChange={(e) => actualizarZonaTerreno(index, 'area_terreno', e.target.value)} className="h-8" />
                          </div>
                        </div>
                      </div>
                    ))}
                    {/* Subtotal Área Terreno */}
                    <div className="bg-blue-50 border border-blue-200 rounded p-2 mt-2">
                      <p className="text-sm text-blue-800">
                        📊 <strong>Subtotal Área Terreno:</strong> {calcularAreasTotalesNuevo().areaTerrenoTotal.toLocaleString('es-CO', {minimumFractionDigits: 2})} m²
                      </p>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Construcciones */}
                <Card>
                  <CardHeader className="py-2">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-sm">Construcciones ({construcciones.length})</CardTitle>
                      <Button size="sm" onClick={agregarConstruccion} variant="outline" className="text-amber-700">
                        <Plus className="w-4 h-4 mr-1" /> Agregar Construcción
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-60 overflow-y-auto">
                    {construcciones.map((const_, index) => (
                      <div key={index} className="border border-amber-200 rounded-lg p-3 bg-amber-50">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-amber-800">Construcción {const_.id}</span>
                          {construcciones.length > 1 && (
                            <Button variant="ghost" size="sm" onClick={() => eliminarConstruccion(index)} className="text-red-600 h-6 w-6 p-0">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <Label className="text-xs">Piso</Label>
                            <Input type="number" value={const_.piso} onChange={(e) => actualizarConstruccion(index, 'piso', e.target.value)} className="h-7 text-xs" />
                          </div>
                          <div>
                            <Label className="text-xs">Habitaciones</Label>
                            <Input type="number" value={const_.habitaciones} onChange={(e) => actualizarConstruccion(index, 'habitaciones', e.target.value)} className="h-7 text-xs" />
                          </div>
                          <div>
                            <Label className="text-xs">Baños</Label>
                            <Input type="number" value={const_.banos} onChange={(e) => actualizarConstruccion(index, 'banos', e.target.value)} className="h-7 text-xs" />
                          </div>
                          <div>
                            <Label className="text-xs">Locales</Label>
                            <Input type="number" value={const_.locales} onChange={(e) => actualizarConstruccion(index, 'locales', e.target.value)} className="h-7 text-xs" />
                          </div>
                          <div>
                            <Label className="text-xs">Tipificación</Label>
                            <Input value={const_.tipificacion} onChange={(e) => actualizarConstruccion(index, 'tipificacion', e.target.value.toUpperCase())} className="h-7 text-xs" />
                          </div>
                          <div>
                            <Label className="text-xs">Uso</Label>
                            <Input value={const_.uso} onChange={(e) => actualizarConstruccion(index, 'uso', e.target.value.toUpperCase())} className="h-7 text-xs" />
                          </div>
                          <div>
                            <Label className="text-xs">Puntaje</Label>
                            <Input type="number" value={const_.puntaje} onChange={(e) => actualizarConstruccion(index, 'puntaje', e.target.value)} className="h-7 text-xs" />
                          </div>
                          <div>
                            <Label className="text-xs">Área Construida (m²)</Label>
                            <Input type="number" value={const_.area_construida} onChange={(e) => actualizarConstruccion(index, 'area_construida', e.target.value)} className="h-7 text-xs" />
                          </div>
                        </div>
                      </div>
                    ))}
                    {/* Subtotal Área Construida */}
                    <div className="bg-amber-50 border border-amber-200 rounded p-2 mt-2">
                      <p className="text-sm text-amber-800">
                        📊 <strong>Subtotal Área Construida:</strong> {calcularAreasTotalesNuevo().areaConstruidaTotal.toLocaleString('es-CO', {minimumFractionDigits: 2})} m²
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
          
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowNuevoPredioModal(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={guardarNuevoPredioInscritoCompleto} 
              disabled={generandoCodigo}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {generandoCodigo ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generando código...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {nuevoPredioInscrito?._editIndex !== undefined ? 'Actualizar Predio' : 'Agregar Predio'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de visualización de PDF */}
      <PDFViewerModal
        isOpen={showPDFViewer}
        onClose={() => setShowPDFViewer(false)}
        pdfUrl={pdfViewerData.url}
        title={pdfViewerData.title}
        fileName={pdfViewerData.fileName}
        showEmailOption={!!pdfViewerData.radicado}
        emailSent={emailSent}
        onSendEmail={async () => {
          if (!pdfViewerData.radicado) return;
          
          try {
            const token = localStorage.getItem('token');
            // Finalizar trámite y enviar correo con PDF adjunto
            const response = await axios.post(`${API}/resoluciones/finalizar-y-enviar`, {
              radicado: pdfViewerData.radicado,
              pdf_url: pdfViewerData.url.replace(process.env.REACT_APP_BACKEND_URL, '')
            }, {
              headers: { Authorization: `Bearer ${token}` }
            });
            
            if (response.data.success) {
              setEmailSent(true);
              toast.success('Trámite finalizado y correo enviado exitosamente');
            }
          } catch (error) {
            console.error('Error finalizando trámite:', error);
            throw error;
          }
        }}
      />

      {/* Modal de Desbloqueo */}
      <Dialog open={showDesbloqueoModal} onOpenChange={setShowDesbloqueoModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unlock className="w-5 h-5 text-green-600" />
              Desbloquear Predio
            </DialogTitle>
          </DialogHeader>
          
          {predioADesbloquear && (
            <div className="space-y-4">
              <Card className="border-slate-200">
                <CardContent className="p-3">
                  <p className="font-medium text-sm">{predioADesbloquear.codigo_predial_nacional}</p>
                  <p className="text-xs text-slate-500">{predioADesbloquear.direccion}</p>
                  {predioADesbloquear.bloqueo_info && (
                    <p className="text-xs text-red-600 mt-1">
                      Motivo actual: {predioADesbloquear.bloqueo_info.motivo}
                    </p>
                  )}
                </CardContent>
              </Card>
              
              <div>
                <Label className="text-sm font-medium">Motivo del Desbloqueo *</Label>
                <Textarea
                  value={desbloqueoMotivo}
                  onChange={(e) => setDesbloqueoMotivo(e.target.value)}
                  placeholder="Ej: Proceso legal finalizado, levantamiento de embargo..."
                  rows={3}
                  data-testid="desbloqueo-motivo"
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDesbloqueoModal(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={desbloquearPredio}
              disabled={procesandoBloqueo || !desbloqueoMotivo.trim()}
              className="bg-green-600 hover:bg-green-700"
              data-testid="desbloqueo-confirmar-btn"
            >
              {procesandoBloqueo ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Procesando...</>
              ) : (
                <><Unlock className="w-4 h-4 mr-2" /> Confirmar Desbloqueo</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Historial de Bloqueos */}
      <Dialog open={showHistorialBloqueoModal} onOpenChange={setShowHistorialBloqueoModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Historial de Bloqueos
            </DialogTitle>
          </DialogHeader>
          
          {predioHistorialBloqueo && (
            <div className="mb-4 p-2 bg-slate-100 rounded">
              <p className="font-medium text-sm">{predioHistorialBloqueo.codigo_predial_nacional}</p>
              <p className="text-xs text-slate-500">{predioHistorialBloqueo.direccion}</p>
            </div>
          )}
          
          <div className="max-h-80 overflow-y-auto space-y-3">
            {historialBloqueo.length === 0 ? (
              <p className="text-center text-slate-500 py-4">Sin historial de bloqueos</p>
            ) : (
              historialBloqueo.map((item, idx) => (
                <Card key={idx} className={item.accion === 'BLOQUEO' ? 'border-red-200' : 'border-green-200'}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      {item.accion === 'BLOQUEO' ? (
                        <Lock className="w-4 h-4 text-red-600" />
                      ) : (
                        <Unlock className="w-4 h-4 text-green-600" />
                      )}
                      <span className={`font-medium text-sm ${item.accion === 'BLOQUEO' ? 'text-red-700' : 'text-green-700'}`}>
                        {item.accion}
                      </span>
                      <span className="text-xs text-slate-400 ml-auto">
                        {new Date(item.fecha).toLocaleString('es-CO')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">{item.motivo}</p>
                    {item.numero_proceso && (
                      <p className="text-xs text-slate-500">Proceso: {item.numero_proceso}</p>
                    )}
                    {item.entidad_judicial && (
                      <p className="text-xs text-slate-500">Entidad: {item.entidad_judicial}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">Por: {item.usuario_nombre}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Modal de Predios Eliminados */}
      <Dialog open={showEliminadosModal} onOpenChange={(open) => {
        setShowEliminadosModal(open);
        if (!open) {
          setEliminadosSearch('');
          setEliminadosMunicipio('');
        }
      }}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2 text-red-700">
              <Trash2 className="w-5 h-5" />
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
                  cargarPrediosEliminados(e.target.value);
                }}
              >
                <option value="">Todos los municipios</option>
                {MUNICIPIOS.map(m => (
                  <option key={m.codigo} value={m.nombre}>{m.nombre}</option>
                ))}
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
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEliminadosModal(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
