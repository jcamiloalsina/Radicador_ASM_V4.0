import React, { useState, useEffect, useCallback, useRef, startTransition } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { 
  Plus, Trash2, FileText, Search, MapPin, Camera, Image as ImageIcon,
  Save, Loader2, CheckCircle, X, RefreshCw, Pen, ChevronLeft, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { saveCambioPendiente } from '../../utils/offlineDB';

// Importar componentes del formulario de visita
import VisitaPagina1 from './visita/VisitaPagina1';
import VisitaPagina2 from './visita/VisitaPagina2';
import VisitaPagina3 from './visita/VisitaPagina3';
import VisitaPagina4 from './visita/VisitaPagina4';
import VisitaPagina5 from './visita/VisitaPagina5';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Catálogos
const TIPOS_DOCUMENTO = {
  'C': 'Cédula de Ciudadanía',
  'E': 'Cédula de Extranjería',
  'N': 'NIT',
  'T': 'Tarjeta de Identidad',
  'P': 'Pasaporte'
};

const DESTINOS_ECONOMICOS = {
  'A': 'Habitacional',
  'B': 'Industrial',
  'C': 'Comercial',
  'D': 'Agropecuario',
  'E': 'Minero',
  'F': 'Cultural',
  'G': 'Recreacional',
  'H': 'Salubridad',
  'I': 'Institucional',
  'J': 'Educativo',
  'K': 'Religioso',
  'L': 'Agrícola',
  'M': 'Pecuario',
  'O': 'Forestal',
  'P': 'Uso Público',
  'Q': 'Lote Urbanizable',
  'R': 'Lote Urbanizado'
};

// Estado inicial del formulario de visita
const getInitialVisitaData = () => ({
  tipo_predio: '',
  direccion_visita: '',
  destino_economico_visita: '',
  area_terreno_visita: '',
  area_construida_visita: '',
  ph_area_coeficiente: '',
  ph_area_construida_privada: '',
  ph_area_construida_comun: '',
  ph_copropiedad: '',
  ph_predio_asociado: '',
  ph_torre: '',
  ph_apartamento: '',
  cond_area_terreno_comun: '',
  cond_area_terreno_privada: '',
  cond_area_construida_privada: '',
  cond_area_construida_comun: '',
  cond_condominio: '',
  cond_predio_asociado: '',
  cond_unidad: '',
  cond_casa: '',
  jur_matricula: '',
  jur_tipo_doc: '',
  jur_numero_doc: '',
  jur_notaria: '',
  jur_fecha: '',
  jur_ciudad: '',
  jur_razon_social: '',
  not_telefono: '',
  not_direccion: '',
  not_correo: '',
  not_autoriza_correo: '',
  not_departamento: 'Norte de Santander',
  not_municipio: '',
  not_vereda: '',
  not_corregimiento: '',
  not_datos_adicionales: '',
  area_titulo_m2: '',
  area_titulo_ha: '',
  area_titulo_desc: '',
  area_base_catastral_m2: '',
  area_base_catastral_ha: '',
  area_base_catastral_desc: '',
  area_geografica_m2: '',
  area_geografica_ha: '',
  area_geografica_desc: '',
  area_levantamiento_m2: '',
  area_levantamiento_ha: '',
  area_levantamiento_desc: '',
  area_identificacion_m2: '',
  area_identificacion_ha: '',
  area_identificacion_desc: '',
  fotos_croquis: [],
  observaciones_generales: '',
  firma_visitado_base64: null,
  firma_reconocedor_base64: null,
  nombre_visitado: '',
  nombre_reconocedor: '',
  fecha_visita: new Date().toISOString().split('T')[0],
  hora_visita: new Date().toTimeString().slice(0, 5),
  persona_atiende: '',
  relacion_predio: '',
  estado_predio: '',
  acceso_predio: 'si',
  servicios_publicos: [],
  observaciones: '',
  sin_cambios: false,
  coordenadas_gps: { latitud: '', longitud: '', precision: null, fecha_captura: null }
});

const getInitialConstrucciones = () => [
  { unidad: 'A', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' },
  { unidad: 'B', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' },
  { unidad: 'C', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' },
  { unidad: 'D', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' },
  { unidad: 'E', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' }
];

const getInitialCalificaciones = () => [{
  id: 1,
  estructura: { armazon: '', muros: '', cubierta: '', conservacion: '' },
  acabados: { fachadas: '', cubrim_muros: '', pisos: '', conservacion: '' },
  bano: { tamano: '', enchape: '', mobiliario: '', conservacion: '' },
  cocina: { tamano: '', enchape: '', mobiliario: '', conservacion: '' },
  industria: { cercha_madera: '', cercha_metalica_liviana: '', cercha_metalica_mediana: '', cercha_metalica_pesada: '', altura: '' },
  datos_generales: { total_pisos: '', total_habitaciones: '', total_banos: '', total_locales: '', area_total_construida: '' }
}];

const getInitialVisitaPropietarios = () => [{
  tipo_documento: 'C',
  numero_documento: '',
  nombre: '',
  primer_apellido: '',
  segundo_apellido: '',
  genero: '',
  genero_otro: '',
  grupo_etnico: 'Ninguno',
  estado: ''
}];

const CrearPredioNuevoModal = ({ 
  isOpen, 
  onClose, 
  proyectoId, 
  municipio, 
  token,
  onSuccess,
  userRole
}) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('ubicacion');
  
  // ========== ESTADO DEL CÓDIGO PREDIAL ==========
  const [estructuraCodigo, setEstructuraCodigo] = useState(null);
  const [codigoManual, setCodigoManual] = useState({
    zona: '00', sector: '00', comuna: '00', barrio: '00',
    manzana_vereda: '0000', terreno: '0001', condicion: '0',
    edificio: '00', piso: '00', unidad: '0000'
  });
  const [siguienteCodigoHomologado, setSiguienteCodigoHomologado] = useState(null);
  const [terrenoInfo, setTerrenoInfo] = useState(null);
  const [prediosEnManzana, setPrediosEnManzana] = useState([]);
  const [buscandoPrediosManzana, setBuscandoPrediosManzana] = useState(false);
  const [siguienteTerrenoSugerido, setSiguienteTerrenoSugerido] = useState('0001');
  const [verificacionCodigo, setVerificacionCodigo] = useState(null);
  
  // ========== ESTADO DEL PREDIO ==========
  const [formData, setFormData] = useState({
    direccion: '', destino_economico: 'D', matricula_inmobiliaria: '', avaluo: ''
  });
  
  const [propietarios, setPropietarios] = useState([{
    tipo_documento: 'C', numero_documento: '', primer_nombre: '', segundo_nombre: '',
    primer_apellido: '', segundo_apellido: '', estado: ''
  }]);
  
  const [zonasTerreno, setZonasTerreno] = useState([{ zona_fisica: '', zona_economica: '', area_terreno: 0 }]);
  const [construccionesR2, setConstruccionesR2] = useState([]);
  
  // ========== ESTADO COMPLETO DEL FORMULARIO DE VISITA ==========
  const [visitaPagina, setVisitaPagina] = useState(1);
  const [visitaData, setVisitaDataRaw] = useState(getInitialVisitaData);
  const [visitaConstrucciones, setVisitaConstruccionesRaw] = useState(getInitialConstrucciones);
  const [visitaCalificaciones, setVisitaCalificacionesRaw] = useState(getInitialCalificaciones);
  const [visitaPropietarios, setVisitaPropietariosRaw] = useState(getInitialVisitaPropietarios);
  const [fotos, setFotos] = useState([]);
  
  // GPS y firmas
  const [userPosition, setUserPosition] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [watchingPosition, setWatchingPosition] = useState(false);
  const canvasVisitadoRef = useRef(null);
  const canvasReconocedorRef = useRef(null);
  const [isDrawingVisitado, setIsDrawingVisitado] = useState(false);
  const [isDrawingReconocedor, setIsDrawingReconocedor] = useState(false);
  
  // Setters optimizados
  const setVisitaData = useCallback((updater) => {
    startTransition(() => { setVisitaDataRaw(updater); });
  }, []);
  const setVisitaConstrucciones = useCallback((updater) => {
    startTransition(() => { setVisitaConstruccionesRaw(updater); });
  }, []);
  const setVisitaCalificaciones = useCallback((updater) => {
    startTransition(() => { setVisitaCalificacionesRaw(updater); });
  }, []);
  const setVisitaPropietarios = useCallback((updater) => {
    startTransition(() => { setVisitaPropietariosRaw(updater); });
  }, []);

  // ========== EFECTOS ==========
  useEffect(() => {
    const cargarEstructura = async () => {
      if (!isOpen || !municipio || !token) return;
      try {
        const response = await fetch(`${API_URL}/api/predios/estructura-codigo/${municipio}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setEstructuraCodigo(data);
        }
      } catch (error) {
        console.error('Error cargando estructura:', error);
      }
    };
    cargarEstructura();
  }, [isOpen, municipio, token]);

  useEffect(() => {
    const cargarCodigoHomologado = async () => {
      if (!isOpen || !municipio || !token) return;
      try {
        const response = await fetch(`${API_URL}/api/codigos-homologados/siguiente/${municipio}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setSiguienteCodigoHomologado(data);
        }
      } catch (error) {
        console.error('Error cargando código homologado:', error);
      }
    };
    cargarCodigoHomologado();
  }, [isOpen, municipio, token]);

  useEffect(() => {
    const buscarPrediosEnManzana = async () => {
      if (!estructuraCodigo || codigoManual.manzana_vereda === '0000') {
        setPrediosEnManzana([]);
        setSiguienteTerrenoSugerido('0001');
        return;
      }
      setBuscandoPrediosManzana(true);
      try {
        const codigoBase = `${estructuraCodigo.prefijo_fijo}${codigoManual.zona}${codigoManual.sector}${codigoManual.comuna}${codigoManual.barrio}${codigoManual.manzana_vereda}`;
        const response = await fetch(
          `${API_URL}/api/predios/buscar-por-manzana?codigo_base=${codigoBase}&municipio=${municipio}&limit=10`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        if (response.ok) {
          const data = await response.json();
          setPrediosEnManzana(data.predios || []);
          setSiguienteTerrenoSugerido(data.siguiente_terreno || '0001');
        }
      } catch (error) {
        console.error('Error buscando predios:', error);
      } finally {
        setBuscandoPrediosManzana(false);
      }
    };
    const timeoutId = setTimeout(buscarPrediosEnManzana, 500);
    return () => clearTimeout(timeoutId);
  }, [estructuraCodigo, codigoManual.zona, codigoManual.sector, codigoManual.comuna, codigoManual.barrio, codigoManual.manzana_vereda, municipio, token]);

  // ========== FUNCIONES DE CÓDIGO ==========
  const construirCodigoCompleto = useCallback(() => {
    if (!estructuraCodigo) return '';
    return `${estructuraCodigo.prefijo_fijo}${codigoManual.zona}${codigoManual.sector}${codigoManual.comuna}${codigoManual.barrio}${codigoManual.manzana_vereda}${codigoManual.terreno}${codigoManual.condicion}${codigoManual.edificio}${codigoManual.piso}${codigoManual.unidad}`;
  }, [estructuraCodigo, codigoManual]);

  const handleCodigoChange = (field, value, maxLen) => {
    const numericValue = value.replace(/\D/g, '').slice(0, maxLen);
    setCodigoManual(prev => ({ ...prev, [field]: numericValue }));
    setVerificacionCodigo(null);
    setTerrenoInfo(null);
  };

  const handleCodigoBlur = (field, maxLen) => {
    setCodigoManual(prev => ({ ...prev, [field]: (prev[field] || '').padStart(maxLen, '0') }));
  };

  const verificarCodigoCompleto = async () => {
    const codigo = construirCodigoCompleto();
    if (codigo.length !== 30) {
      toast.error('El código debe tener 30 dígitos');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/predios/verificar-codigo/${codigo}?municipio=${municipio}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setVerificacionCodigo(data);
        setTerrenoInfo(data);
      }
    } catch (error) {
      toast.error('Error al verificar el código');
    } finally {
      setLoading(false);
    }
  };

  // ========== FUNCIONES DE PROPIETARIOS (R1) ==========
  const agregarPropietario = () => {
    setPropietarios(prev => [...prev, {
      tipo_documento: 'C', numero_documento: '', primer_nombre: '', segundo_nombre: '',
      primer_apellido: '', segundo_apellido: '', estado: ''
    }]);
  };

  const eliminarPropietario = (index) => {
    if (propietarios.length > 1) setPropietarios(prev => prev.filter((_, i) => i !== index));
  };

  const actualizarPropietario = (index, field, value) => {
    setPropietarios(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const generarNombreCompleto = (prop) => {
    return [prop.primer_apellido, prop.segundo_apellido, prop.primer_nombre, prop.segundo_nombre]
      .filter(Boolean).join(' ').toUpperCase();
  };

  const formatearNumeroDocumento = (num) => (num || '').padStart(12, '0');

  // ========== FUNCIONES DE ZONAS Y CONSTRUCCIONES (R2) ==========
  const agregarZonaTerreno = () => {
    setZonasTerreno(prev => [...prev, { zona_fisica: '', zona_economica: '', area_terreno: 0 }]);
  };

  const eliminarZonaTerreno = (index) => {
    if (zonasTerreno.length > 1) setZonasTerreno(prev => prev.filter((_, i) => i !== index));
  };

  const actualizarZonaTerreno = (index, field, value) => {
    setZonasTerreno(prev => prev.map((z, i) => i === index ? { ...z, [field]: value } : z));
  };

  const agregarConstruccionR2 = () => {
    const nextId = String.fromCharCode(65 + construccionesR2.length);
    setConstruccionesR2(prev => [...prev, {
      id: nextId, piso: 1, habitaciones: 0, banos: 0, locales: 0,
      tipificacion: '', uso: '', puntaje: 0, area_construida: 0
    }]);
  };

  const eliminarConstruccionR2 = (index) => {
    setConstruccionesR2(prev => prev.filter((_, i) => i !== index));
  };

  const actualizarConstruccionR2 = (index, field, value) => {
    setConstruccionesR2(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const calcularAreasTotales = () => {
    const areaTerrenoTotal = zonasTerreno.reduce((sum, z) => sum + (parseFloat(z.area_terreno) || 0), 0);
    const areaConstruidaTotal = construccionesR2.reduce((sum, c) => sum + (parseFloat(c.area_construida) || 0), 0);
    return { areaTerrenoTotal, areaConstruidaTotal };
  };

  // ========== FUNCIONES DEL FORMULARIO DE VISITA ==========
  const agregarVisitaPropietario = useCallback(() => {
    setVisitaPropietarios(prev => [...prev, {
      tipo_documento: 'C', numero_documento: '', nombre: '', primer_apellido: '',
      segundo_apellido: '', genero: '', genero_otro: '', grupo_etnico: 'Ninguno', estado: ''
    }]);
  }, [setVisitaPropietarios]);

  const eliminarVisitaPropietario = useCallback((idx) => {
    setVisitaPropietarios(prev => prev.filter((_, i) => i !== idx));
  }, [setVisitaPropietarios]);

  const actualizarVisitaPropietario = useCallback((idx, campo, valor) => {
    setVisitaPropietarios(prev => {
      const nuevos = [...prev];
      nuevos[idx] = { ...nuevos[idx], [campo]: valor };
      return nuevos;
    });
  }, [setVisitaPropietarios]);

  const agregarConstruccion = useCallback(() => {
    setVisitaConstrucciones(prev => {
      const nextLetter = String.fromCharCode(65 + prev.length);
      return [...prev, { unidad: nextLetter, codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' }];
    });
  }, [setVisitaConstrucciones]);

  const eliminarConstruccion = useCallback((idx) => {
    setVisitaConstrucciones(prev => prev.filter((_, i) => i !== idx));
  }, [setVisitaConstrucciones]);

  const actualizarConstruccion = useCallback((idx, campo, valor) => {
    setVisitaConstrucciones(prev => {
      const nuevas = [...prev];
      nuevas[idx] = { ...nuevas[idx], [campo]: valor };
      return nuevas;
    });
  }, [setVisitaConstrucciones]);

  const agregarCalificacion = useCallback(() => {
    setVisitaCalificaciones(prev => [...prev, {
      id: prev.length + 1,
      estructura: { armazon: '', muros: '', cubierta: '', conservacion: '' },
      acabados: { fachadas: '', cubrim_muros: '', pisos: '', conservacion: '' },
      bano: { tamano: '', enchape: '', mobiliario: '', conservacion: '' },
      cocina: { tamano: '', enchape: '', mobiliario: '', conservacion: '' },
      industria: { cercha_madera: '', cercha_metalica_liviana: '', cercha_metalica_mediana: '', cercha_metalica_pesada: '', altura: '' },
      datos_generales: { total_pisos: '', total_habitaciones: '', total_banos: '', total_locales: '', area_total_construida: '' }
    }]);
  }, [setVisitaCalificaciones]);

  const eliminarCalificacion = useCallback((idx) => {
    setVisitaCalificaciones(prev => prev.filter((_, i) => i !== idx));
  }, [setVisitaCalificaciones]);

  const actualizarCalificacion = useCallback((califIdx, seccion, campo, valor) => {
    setVisitaCalificaciones(prev => {
      const nuevas = [...prev];
      nuevas[califIdx] = { ...nuevas[califIdx], [seccion]: { ...nuevas[califIdx][seccion], [campo]: valor } };
      return nuevas;
    });
  }, [setVisitaCalificaciones]);

  // ========== FUNCIONES GPS ==========
  const startWatchingPosition = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Tu navegador no soporta geolocalización');
      return;
    }
    setWatchingPosition(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setUserPosition([latitude, longitude]);
        setGpsAccuracy(accuracy);
        setWatchingPosition(false);
        toast.success(`📍 Ubicación capturada (precisión: ${Math.round(accuracy)}m)`);
      },
      (error) => {
        setWatchingPosition(false);
        if (error.code === 1) toast.error('Permiso de ubicación denegado');
        else if (error.code === 2) toast.error('GPS no disponible');
        else toast.error('Error al capturar ubicación');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  // ========== FUNCIONES FIRMAS ==========
  const getCanvasContext = (canvasRef) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    return ctx;
  };

  const getPosition = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDrawingVisitado = (e) => {
    e.preventDefault();
    const ctx = getCanvasContext(canvasVisitadoRef);
    if (!ctx) return;
    setIsDrawingVisitado(true);
    const pos = getPosition(e, canvasVisitadoRef.current);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const drawVisitado = (e) => {
    if (!isDrawingVisitado) return;
    e.preventDefault();
    const ctx = getCanvasContext(canvasVisitadoRef);
    if (!ctx) return;
    const pos = getPosition(e, canvasVisitadoRef.current);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawingVisitado = () => {
    if (isDrawingVisitado && canvasVisitadoRef.current) {
      setIsDrawingVisitado(false);
      setVisitaData(prev => ({
        ...prev,
        firma_visitado_base64: canvasVisitadoRef.current.toDataURL('image/png')
      }));
    }
  };

  const startDrawingReconocedor = (e) => {
    e.preventDefault();
    const ctx = getCanvasContext(canvasReconocedorRef);
    if (!ctx) return;
    setIsDrawingReconocedor(true);
    const pos = getPosition(e, canvasReconocedorRef.current);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const drawReconocedor = (e) => {
    if (!isDrawingReconocedor) return;
    e.preventDefault();
    const ctx = getCanvasContext(canvasReconocedorRef);
    if (!ctx) return;
    const pos = getPosition(e, canvasReconocedorRef.current);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawingReconocedor = () => {
    if (isDrawingReconocedor && canvasReconocedorRef.current) {
      setIsDrawingReconocedor(false);
      setVisitaData(prev => ({
        ...prev,
        firma_reconocedor_base64: canvasReconocedorRef.current.toDataURL('image/png')
      }));
    }
  };

  const limpiarFirmaVisitado = () => {
    const canvas = canvasVisitadoRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setVisitaData(prev => ({ ...prev, firma_visitado_base64: null }));
    }
  };

  const limpiarFirmaReconocedor = () => {
    const canvas = canvasReconocedorRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setVisitaData(prev => ({ ...prev, firma_reconocedor_base64: null }));
    }
  };

  const abrirModalFirma = (tipo) => {
    toast.info(`Dibuje su firma en el recuadro de ${tipo === 'visitado' ? 'Visitado' : 'Reconocedor'}`);
  };

  // ========== FUNCIONES FOTOS ==========
  const handleFotoChange = async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} supera 5MB`);
        continue;
      }
      try {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        setFotos(prev => [...prev, {
          id: Date.now() + Math.random(), data: base64, preview: base64,
          nombre: file.name, fecha: new Date().toISOString(), offline: !navigator.onLine
        }]);
        toast.success(`📷 Foto agregada`);
      } catch (err) {
        toast.error('Error al procesar la foto');
      }
    }
    e.target.value = '';
  };

  const handleFotoCroquisChange = async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) continue;
      try {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        setVisitaData(prev => ({
          ...prev,
          fotos_croquis: [...prev.fotos_croquis, { data: base64, preview: base64, nombre: file.name }]
        }));
      } catch (err) {
        console.error('Error:', err);
      }
    }
    e.target.value = '';
  };

  const eliminarFotoCroquis = (idx) => {
    setVisitaData(prev => ({
      ...prev,
      fotos_croquis: prev.fotos_croquis.filter((_, i) => i !== idx)
    }));
  };

  // ========== VALIDACIÓN ==========
  const validarVisita = () => {
    if (!visitaData.coordenadas_gps?.latitud || !visitaData.coordenadas_gps?.longitud) {
      return 'Debe capturar las coordenadas GPS (Página 5)';
    }
    if (!visitaData.nombre_reconocedor?.trim()) {
      return 'Debe ingresar el nombre del reconocedor (Página 5)';
    }
    return null;
  };

  // ========== GUARDAR ==========
  const handleGuardar = async () => {
    if (!formData.direccion.trim()) {
      toast.error('Debe ingresar la dirección del predio');
      setActiveTab('propietario');
      return;
    }
    
    const propValido = propietarios.some(p => p.primer_apellido && p.primer_nombre);
    if (!propValido) {
      toast.error('Debe ingresar al menos un propietario');
      setActiveTab('propietario');
      return;
    }
    
    if (verificacionCodigo?.estado === 'existente') {
      toast.error('El código ya existe');
      return;
    }
    
    const errorVisita = validarVisita();
    if (errorVisita) {
      toast.error(errorVisita);
      setActiveTab('visita');
      return;
    }
    
    setLoading(true);
    
    try {
      const codigoCompleto = construirCodigoCompleto();
      const areas = calcularAreasTotales();
      
      const payload = {
        r1: {
          direccion: formData.direccion,
          destino_economico: formData.destino_economico,
          zona: codigoManual.zona,
          sector: codigoManual.sector,
          comuna: codigoManual.comuna,
          barrio: codigoManual.barrio,
          manzana_vereda: codigoManual.manzana_vereda,
          terreno: codigoManual.terreno,
          condicion_predio: codigoManual.condicion,
          predio_horizontal: `${codigoManual.edificio}${codigoManual.piso}${codigoManual.unidad}`,
          area_terreno: areas.areaTerrenoTotal,
          area_construida: areas.areaConstruidaTotal,
          avaluo: parseFloat(formData.avaluo) || 0
        },
        r2: { matricula_inmobiliaria: formData.matricula_inmobiliaria },
        propietarios: propietarios.map(p => ({
          tipo_documento: p.tipo_documento,
          numero_documento: formatearNumeroDocumento(p.numero_documento),
          nombre_propietario: generarNombreCompleto(p),
          primer_nombre: p.primer_nombre?.toUpperCase() || '',
          segundo_nombre: p.segundo_nombre?.toUpperCase() || '',
          primer_apellido: p.primer_apellido?.toUpperCase() || '',
          segundo_apellido: p.segundo_apellido?.toUpperCase() || '',
          estado: p.estado?.toUpperCase() || ''
        })),
        zonas: zonasTerreno.map(z => ({
          zona_fisica: z.zona_fisica,
          zona_economica: z.zona_economica,
          area_terreno: parseFloat(z.area_terreno) || 0
        })),
        construcciones: construccionesR2.map(c => ({
          id: c.id, piso: parseInt(c.piso) || 1, habitaciones: parseInt(c.habitaciones) || 0,
          banos: parseInt(c.banos) || 0, locales: parseInt(c.locales) || 0,
          tipificacion: c.tipificacion?.toUpperCase() || '', uso: c.uso?.toUpperCase() || '',
          puntaje: parseFloat(c.puntaje) || 0, area_construida: parseFloat(c.area_construida) || 0
        })),
        formato_visita: {
          ...visitaData,
          construcciones: visitaConstrucciones,
          calificaciones: visitaCalificaciones,
          propietarios_visita: visitaPropietarios,
          fotos: fotos.map(f => ({ data: f.data, nombre: f.nombre, fecha: f.fecha }))
        },
        rol_creador: userRole
      };
      
      if (!navigator.onLine) {
        await saveCambioPendiente(proyectoId || 'actualizacion', {
          tipo: 'predio_nuevo', datos: payload, codigo_predial: codigoCompleto, fecha: new Date().toISOString()
        });
        toast.success('📴 Guardado offline - Se sincronizará cuando haya conexión');
        onSuccess && onSuccess({ codigo_predial: codigoCompleto, offline: true });
        handleClose();
        return;
      }
      
      // Crear AbortController con timeout de 60 segundos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      
      const response = await fetch(
        `${API_URL}/api/actualizacion/proyectos/${proyectoId}/predios-nuevos`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        }
      );
      
      clearTimeout(timeoutId);
      
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.detail || 'Error al crear el predio');
      
      if (data.propuesta_id) {
        toast.success('📤 Enviado para aprobación');
      } else {
        toast.success(`✅ Predio creado: ${data.codigo_predial}`);
      }
      
      onSuccess && onSuccess(data);
      handleClose();
      
    } catch (error) {
      toast.error(error.message || 'Error al crear el predio');
    } finally {
      setLoading(false);
    }
  };

  // ========== RESET ==========
  const handleClose = () => {
    setCodigoManual({
      zona: '00', sector: '00', comuna: '00', barrio: '00',
      manzana_vereda: '0000', terreno: '0001', condicion: '0',
      edificio: '00', piso: '00', unidad: '0000'
    });
    setFormData({ direccion: '', destino_economico: 'D', matricula_inmobiliaria: '', avaluo: '' });
    setPropietarios([{ tipo_documento: 'C', numero_documento: '', primer_nombre: '', segundo_nombre: '', primer_apellido: '', segundo_apellido: '', estado: '' }]);
    setZonasTerreno([{ zona_fisica: '', zona_economica: '', area_terreno: 0 }]);
    setConstruccionesR2([]);
    setVerificacionCodigo(null);
    setTerrenoInfo(null);
    setPrediosEnManzana([]);
    setVisitaDataRaw(getInitialVisitaData());
    setVisitaConstruccionesRaw(getInitialConstrucciones());
    setVisitaCalificacionesRaw(getInitialCalificaciones());
    setVisitaPropietariosRaw(getInitialVisitaPropietarios());
    setFotos([]);
    setVisitaPagina(1);
    setActiveTab('ubicacion');
    onClose();
  };

  const areas = calcularAreasTotales();

  // Datos para pasar al componente de visita
  const selectedPredio = {
    codigo_predial: construirCodigoCompleto(),
    municipio: municipio,
    zona: codigoManual.zona === '01' ? 'urbano' : 'rural'
  };
  
  const proyecto = { municipio };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent 
        className="max-w-5xl max-h-[95vh] overflow-y-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-outfit">
            Nuevo Predio - {municipio}
          </DialogTitle>
        </DialogHeader>
        
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
                    <p className="text-sm text-amber-700">Se generará automáticamente</p>
                  )}
                </div>
              </div>
              {siguienteCodigoHomologado.codigo && (
                <Badge className="bg-emerald-100 text-emerald-700">{siguienteCodigoHomologado.disponibles} disponibles</Badge>
              )}
            </div>
          </div>
        )}
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="ubicacion">1. Código</TabsTrigger>
            <TabsTrigger value="propietario">2. Propietario</TabsTrigger>
            <TabsTrigger value="fisico">3. Físico</TabsTrigger>
            <TabsTrigger value="visita" className="relative">
              4. Visita
              {(!visitaData.coordenadas_gps?.latitud || !visitaData.nombre_reconocedor) && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </TabsTrigger>
          </TabsList>
          
          {/* TAB 1: Código Nacional */}
          <TabsContent value="ubicacion" className="space-y-4 mt-4">
            {estructuraCodigo && (
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Código Predial Nacional (30 dígitos)
                </h4>
                
                <div className="bg-white p-3 rounded border mb-4 font-mono text-lg tracking-wider text-center">
                  <span className="text-blue-600 font-bold">{estructuraCodigo.prefijo_fijo}</span>
                  <span className="text-emerald-600">{codigoManual.zona}</span>
                  <span className="text-amber-600">{codigoManual.sector}</span>
                  <span className="text-purple-600">{codigoManual.comuna}</span>
                  <span className="text-pink-600">{codigoManual.barrio}</span>
                  <span className="text-cyan-600">{codigoManual.manzana_vereda}</span>
                  <span className="text-red-600 font-bold">{codigoManual.terreno}</span>
                  <span className="text-orange-600">{codigoManual.condicion}</span>
                  <span className="text-slate-500">{codigoManual.edificio}</span>
                  <span className="text-slate-500">{codigoManual.piso}</span>
                  <span className="text-slate-500">{codigoManual.unidad}</span>
                  <span className="text-xs text-slate-500 ml-2">({construirCodigoCompleto().length}/30)</span>
                </div>
                
                <div className="grid grid-cols-6 gap-2 mb-3">
                  <div className="bg-blue-100 p-2 rounded">
                    <Label className="text-xs text-blue-700">Dpto+Mpio</Label>
                    <Input value={estructuraCodigo.prefijo_fijo} disabled className="font-mono bg-blue-50 text-blue-800 font-bold text-center" />
                  </div>
                  <div>
                    <Label className="text-xs text-emerald-700">Zona</Label>
                    <Input value={codigoManual.zona} onChange={(e) => handleCodigoChange('zona', e.target.value, 2)} onBlur={() => handleCodigoBlur('zona', 2)} maxLength={2} className="font-mono text-center" />
                  </div>
                  <div>
                    <Label className="text-xs text-amber-700">Sector</Label>
                    <Input value={codigoManual.sector} onChange={(e) => handleCodigoChange('sector', e.target.value, 2)} onBlur={() => handleCodigoBlur('sector', 2)} maxLength={2} className="font-mono text-center" />
                  </div>
                  <div>
                    <Label className="text-xs text-purple-700">Comuna</Label>
                    <Input value={codigoManual.comuna} onChange={(e) => handleCodigoChange('comuna', e.target.value, 2)} onBlur={() => handleCodigoBlur('comuna', 2)} maxLength={2} className="font-mono text-center" />
                  </div>
                  <div>
                    <Label className="text-xs text-pink-700">Barrio</Label>
                    <Input value={codigoManual.barrio} onChange={(e) => handleCodigoChange('barrio', e.target.value, 2)} onBlur={() => handleCodigoBlur('barrio', 2)} maxLength={2} className="font-mono text-center" />
                  </div>
                  <div>
                    <Label className="text-xs text-cyan-700">Manzana</Label>
                    <Input value={codigoManual.manzana_vereda} onChange={(e) => handleCodigoChange('manzana_vereda', e.target.value, 4)} onBlur={() => handleCodigoBlur('manzana_vereda', 4)} maxLength={4} className="font-mono text-center" />
                  </div>
                </div>
                
                <div className="grid grid-cols-5 gap-2">
                  <div className="bg-red-50 p-2 rounded border border-red-200">
                    <Label className="text-xs text-red-700 font-semibold">Terreno *</Label>
                    <Input value={codigoManual.terreno} onChange={(e) => handleCodigoChange('terreno', e.target.value, 4)} onBlur={() => handleCodigoBlur('terreno', 4)} maxLength={4} className="font-mono font-bold text-red-700 text-center" />
                  </div>
                  <div>
                    <Label className="text-xs text-orange-700">Condición</Label>
                    <Input type="number" min="0" max="9" value={codigoManual.condicion} onChange={(e) => setCodigoManual({...codigoManual, condicion: e.target.value.slice(0, 1)})} maxLength={1} className="font-mono text-center" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600">Edificio</Label>
                    <Input value={codigoManual.edificio} onChange={(e) => handleCodigoChange('edificio', e.target.value, 2)} onBlur={() => handleCodigoBlur('edificio', 2)} maxLength={2} className="font-mono text-center" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600">Piso</Label>
                    <Input value={codigoManual.piso} onChange={(e) => handleCodigoChange('piso', e.target.value, 2)} onBlur={() => handleCodigoBlur('piso', 2)} maxLength={2} className="font-mono text-center" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600">Unidad</Label>
                    <Input value={codigoManual.unidad} onChange={(e) => handleCodigoChange('unidad', e.target.value, 4)} onBlur={() => handleCodigoBlur('unidad', 4)} maxLength={4} className="font-mono text-center" />
                  </div>
                </div>
                
                <div className="mt-4">
                  <Button onClick={verificarCodigoCompleto} variant="outline" className="w-full" disabled={loading}>
                    <Search className="w-4 h-4 mr-2" />Verificar Código
                  </Button>
                </div>
              </div>
            )}
            
            {verificacionCodigo && (
              <div className={`p-4 rounded-lg border ${verificacionCodigo.estado === 'disponible' ? 'bg-emerald-50 border-emerald-300' : verificacionCodigo.estado === 'eliminado' ? 'bg-amber-50 border-amber-300' : 'bg-red-50 border-red-300'}`}>
                <p className={`font-semibold ${verificacionCodigo.estado === 'disponible' ? 'text-emerald-800' : verificacionCodigo.estado === 'eliminado' ? 'text-amber-800' : 'text-red-800'}`}>
                  {verificacionCodigo.mensaje}
                </p>
              </div>
            )}
          </TabsContent>
          
          {/* TAB 2: Propietario */}
          <TabsContent value="propietario" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <h4 className="font-semibold text-slate-800">Propietarios</h4>
              <Button type="button" variant="outline" size="sm" onClick={agregarPropietario} className="text-emerald-700">
                <Plus className="w-4 h-4 mr-1" /> Agregar
              </Button>
            </div>
            
            {propietarios.map((prop, index) => (
              <div key={index} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium">Propietario {index + 1}</span>
                  {propietarios.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => eliminarPropietario(index)} className="text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Primer Apellido *</Label>
                    <Input value={prop.primer_apellido} onChange={(e) => actualizarPropietario(index, 'primer_apellido', e.target.value.toUpperCase())} />
                  </div>
                  <div>
                    <Label className="text-xs">Segundo Apellido</Label>
                    <Input value={prop.segundo_apellido} onChange={(e) => actualizarPropietario(index, 'segundo_apellido', e.target.value.toUpperCase())} />
                  </div>
                  <div>
                    <Label className="text-xs">Primer Nombre *</Label>
                    <Input value={prop.primer_nombre} onChange={(e) => actualizarPropietario(index, 'primer_nombre', e.target.value.toUpperCase())} />
                  </div>
                  <div>
                    <Label className="text-xs">Segundo Nombre</Label>
                    <Input value={prop.segundo_nombre} onChange={(e) => actualizarPropietario(index, 'segundo_nombre', e.target.value.toUpperCase())} />
                  </div>
                  <div>
                    <Label className="text-xs mb-2 block">Tipo Documento</Label>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(TIPOS_DOCUMENTO).map(([k, v]) => (
                        <label key={k} className="flex items-center space-x-1 cursor-pointer">
                          <input type="radio" checked={prop.tipo_documento === k} onChange={() => actualizarPropietario(index, 'tipo_documento', k)} />
                          <span className="text-xs">{k}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Número Documento</Label>
                    <Input value={prop.numero_documento} onChange={(e) => actualizarPropietario(index, 'numero_documento', e.target.value.replace(/\D/g, '').slice(0, 12))} />
                  </div>
                </div>
              </div>
            ))}
            
            <div className="border-t pt-4 mt-4">
              <h4 className="font-semibold text-slate-800 mb-3">Información del Predio</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Dirección *</Label>
                  <Input value={formData.direccion} onChange={(e) => setFormData({...formData, direccion: e.target.value.toUpperCase()})} placeholder="DIRECCIÓN DEL PREDIO" />
                </div>
                <div className="col-span-2">
                  <Label className="mb-2 block">Destino Económico</Label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(DESTINOS_ECONOMICOS).map(([k, v]) => (
                      <label key={k} className="flex items-center space-x-1 cursor-pointer">
                        <input type="radio" checked={formData.destino_economico === k} onChange={() => setFormData({...formData, destino_economico: k})} />
                        <span className="text-xs">{k}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Matrícula Inmobiliaria</Label>
                  <Input value={formData.matricula_inmobiliaria} onChange={(e) => setFormData({...formData, matricula_inmobiliaria: e.target.value})} />
                </div>
                <div>
                  <Label>Avalúo (COP)</Label>
                  <Input type="number" value={formData.avaluo} onChange={(e) => setFormData({...formData, avaluo: e.target.value})} />
                </div>
              </div>
            </div>
          </TabsContent>
          
          {/* TAB 3: Físico */}
          <TabsContent value="fisico" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <h4 className="font-semibold text-slate-800">Zonas de Terreno</h4>
              <Button type="button" variant="outline" size="sm" onClick={agregarZonaTerreno} className="text-emerald-700">
                <Plus className="w-4 h-4 mr-1" /> Agregar Zona
              </Button>
            </div>
            
            {zonasTerreno.map((zona, index) => (
              <div key={index} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
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
                    <Label className="text-xs">Área (m²)</Label>
                    <Input type="number" value={zona.area_terreno} onChange={(e) => actualizarZonaTerreno(index, 'area_terreno', e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
            
            <div className="bg-blue-50 border border-blue-200 rounded p-2">
              <p className="text-sm text-blue-800"><strong>Área Terreno Total:</strong> {areas.areaTerrenoTotal.toFixed(2)} m²</p>
            </div>
            
            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-slate-800">Construcciones</h4>
                <Button type="button" variant="outline" size="sm" onClick={agregarConstruccionR2} className="text-emerald-700">
                  <Plus className="w-4 h-4 mr-1" /> Agregar
                </Button>
              </div>
              
              {construccionesR2.length === 0 ? (
                <div className="text-center py-4 bg-slate-50 rounded-lg border-2 border-dashed">
                  <p className="text-slate-500 text-sm">No hay construcciones</p>
                </div>
              ) : (
                construccionesR2.map((c, index) => (
                  <div key={index} className="border border-amber-200 rounded-lg p-3 bg-amber-50 mb-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-amber-800">Construcción {c.id}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => eliminarConstruccionR2(index)} className="text-red-600 h-6 w-6 p-0">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <Label className="text-xs">Piso</Label>
                        <Input type="number" value={c.piso} onChange={(e) => actualizarConstruccionR2(index, 'piso', e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Habitaciones</Label>
                        <Input type="number" value={c.habitaciones} onChange={(e) => actualizarConstruccionR2(index, 'habitaciones', e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Baños</Label>
                        <Input type="number" value={c.banos} onChange={(e) => actualizarConstruccionR2(index, 'banos', e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Área (m²)</Label>
                        <Input type="number" value={c.area_construida} onChange={(e) => actualizarConstruccionR2(index, 'area_construida', e.target.value)} />
                      </div>
                    </div>
                  </div>
                ))
              )}
              
              <div className="bg-amber-50 border border-amber-200 rounded p-2 mt-2">
                <p className="text-sm text-amber-800"><strong>Área Construida Total:</strong> {areas.areaConstruidaTotal.toFixed(2)} m²</p>
              </div>
            </div>
          </TabsContent>
          
          {/* TAB 4: VISITA COMPLETA (5 páginas) */}
          <TabsContent value="visita" className="mt-4">
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg mb-4">
              <p className="text-sm text-amber-800 font-medium">
                ⚠️ El formulario de visita es OBLIGATORIO. Complete las 5 páginas.
              </p>
            </div>
            
            {/* Paginación */}
            <div className="flex items-center justify-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  onClick={() => setVisitaPagina(num)}
                  className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                    visitaPagina === num 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
            
            {/* Contenido de cada página */}
            <div className="space-y-4">
              {visitaPagina === 1 && (
                <VisitaPagina1
                  visitaData={visitaData}
                  setVisitaData={setVisitaData}
                  selectedPredio={selectedPredio}
                  proyecto={proyecto}
                  tipoVisita="normal"
                  mejoraSeleccionada={null}
                  predioMejoraSeleccionada={null}
                />
              )}
              
              {visitaPagina === 2 && (
                <VisitaPagina2
                  visitaData={visitaData}
                  setVisitaData={setVisitaData}
                  visitaPropietarios={visitaPropietarios}
                  agregarPropietario={agregarVisitaPropietario}
                  eliminarPropietario={eliminarVisitaPropietario}
                  actualizarPropietario={actualizarVisitaPropietario}
                />
              )}
              
              {visitaPagina === 3 && (
                <VisitaPagina3
                  visitaConstrucciones={visitaConstrucciones}
                  setVisitaConstrucciones={setVisitaConstrucciones}
                  agregarConstruccion={agregarConstruccion}
                  eliminarConstruccion={eliminarConstruccion}
                  actualizarConstruccion={actualizarConstruccion}
                  visitaCalificaciones={visitaCalificaciones}
                  setVisitaCalificaciones={setVisitaCalificaciones}
                  agregarCalificacion={agregarCalificacion}
                  eliminarCalificacion={eliminarCalificacion}
                  actualizarCalificacion={actualizarCalificacion}
                />
              )}
              
              {visitaPagina === 4 && (
                <VisitaPagina4
                  visitaData={visitaData}
                  setVisitaData={setVisitaData}
                  handleFotoCroquisChange={handleFotoCroquisChange}
                  eliminarFotoCroquis={eliminarFotoCroquis}
                />
              )}
              
              {visitaPagina === 5 && (
                <VisitaPagina5
                  visitaData={visitaData}
                  setVisitaData={setVisitaData}
                  fotos={fotos}
                  setFotos={setFotos}
                  userPosition={userPosition}
                  gpsAccuracy={gpsAccuracy}
                  watchingPosition={watchingPosition}
                  startWatchingPosition={startWatchingPosition}
                  canvasVisitadoRef={canvasVisitadoRef}
                  canvasReconocedorRef={canvasReconocedorRef}
                  startDrawingVisitado={startDrawingVisitado}
                  drawVisitado={drawVisitado}
                  stopDrawingVisitado={stopDrawingVisitado}
                  startDrawingReconocedor={startDrawingReconocedor}
                  drawReconocedor={drawReconocedor}
                  stopDrawingReconocedor={stopDrawingReconocedor}
                  limpiarFirmaVisitado={limpiarFirmaVisitado}
                  limpiarFirmaReconocedor={limpiarFirmaReconocedor}
                  abrirModalFirma={abrirModalFirma}
                  handleFotoChange={handleFotoChange}
                />
              )}
            </div>
            
            {/* Navegación de páginas */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => setVisitaPagina(p => Math.max(1, p - 1))}
                disabled={visitaPagina === 1}
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
              </Button>
              <span className="text-sm text-slate-600">Página {visitaPagina} de 5</span>
              <Button 
                onClick={() => setVisitaPagina(p => Math.min(5, p + 1))}
                disabled={visitaPagina === 5}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Siguiente <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="mt-4 pt-4 border-t">
          <Button variant="outline" onClick={handleClose} disabled={loading}>Cancelar</Button>
          <Button 
            onClick={handleGuardar} 
            disabled={loading || verificacionCodigo?.estado === 'existente'}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</>
            ) : userRole === 'gestor' ? (
              <><Save className="w-4 h-4 mr-2" />Enviar para Aprobación</>
            ) : (
              <><Save className="w-4 h-4 mr-2" />Crear Predio</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CrearPredioNuevoModal;
