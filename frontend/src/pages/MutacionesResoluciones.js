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
  Users, MapPin, DollarSign, Calendar, Filter,
  ChevronDown, ChevronUp, Trash2, Edit, Loader2, Lock, Layers,
  Settings, Save, Eye, RefreshCw, Hash
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Textarea } from '../components/ui/textarea';

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
    descripcion: 'Modificación de construcción o destino económico',
    color: 'bg-amber-100 text-amber-800',
    enabled: false
  },
  M4: { 
    codigo: 'M4', 
    nombre: 'Mutación Cuarta', 
    descripcion: 'Auto estimación del avalúo catastral',
    color: 'bg-green-100 text-green-800',
    enabled: false
  },
  M5: { 
    codigo: 'M5', 
    nombre: 'Mutación Quinta', 
    descripcion: 'Inscripción o eliminación de predio',
    color: 'bg-red-100 text-red-800',
    enabled: false
  },
  M6: { 
    codigo: 'M6', 
    nombre: 'Mutación Sexta', 
    descripcion: 'Rectificación de área',
    color: 'bg-cyan-100 text-cyan-800',
    enabled: false
  },
  COMP: { 
    codigo: 'COMP', 
    nombre: 'Complementación', 
    descripcion: 'Complementación de información catastral',
    color: 'bg-slate-100 text-slate-800',
    enabled: false
  }
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
    predio_resultante: null // Datos del predio resultante (editable)
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
    propietarios_nuevos: []
  });
  const [searchPredioM1, setSearchPredioM1] = useState('');
  const [searchResultsM1, setSearchResultsM1] = useState([]);
  const [searchingPrediosM1, setSearchingPrediosM1] = useState(false);
  const [cargandoNumeroResolucion, setCargandoNumeroResolucion] = useState(false);
  const [radicadosDisponibles, setRadicadosDisponibles] = useState([]);
  const [radicadosDisponiblesM2, setRadicadosDisponiblesM2] = useState([]);
  const [showMunicipioDropdown, setShowMunicipioDropdown] = useState(false);
  const [showMunicipioDropdownM2, setShowMunicipioDropdownM2] = useState(false);

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
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        toast.success(`Resolución ${response.data.numero_resolucion} generada exitosamente`);
        
        // Abrir PDF en nueva pestaña
        if (response.data.pdf_url) {
          window.open(response.data.pdf_url, '_blank');
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

  // Obtener siguiente código homologado para el municipio
  const fetchSiguienteCodigoHomologadoNuevo = async (municipioCodigo) => {
    if (!municipioCodigo) {
      setSiguienteCodigoHomologadoNuevo(null);
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const municipioNombre = MUNICIPIOS.find(m => m.codigo === municipioCodigo)?.nombre || '';
      const res = await axios.get(`${API}/codigos-homologados/siguiente/${encodeURIComponent(municipioNombre)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSiguienteCodigoHomologadoNuevo(res.data);
    } catch (error) {
      console.error('Error obteniendo siguiente código homologado:', error);
      setSiguienteCodigoHomologadoNuevo(null);
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
        toast.warning('Este código perteneció a un predio eliminado');
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
    
    // Usar el código homologado ya cargado o generar uno nuevo
    setGenerandoCodigo(true);
    let codigoHomologado = siguienteCodigoHomologadoNuevo?.codigo || '';
    
    if (!codigoHomologado) {
      // Si no hay código pre-cargado, intentar generar uno
      try {
        const token = localStorage.getItem('token');
        const municipioNombre = MUNICIPIOS.find(m => m.codigo === m2Data.municipio)?.nombre || '';
        const response = await axios.post(`${API}/predios/generar-codigo-homologado`, {
          municipio: municipioNombre,
          codigo_predial: codigo.substring(0, 21) // Primeros 21 dígitos
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data.codigo_homologado) {
          codigoHomologado = response.data.codigo_homologado;
        }
      } catch (error) {
        console.log('Error generando código homologado, se usará formato básico');
        // Generar un código básico si falla
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
    }
    
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
        ...m2Data,
        predios_inscritos: prediosInscribirOrdenados
      };
      
      // Para ENGLOBE: usar el predio_resultante como único predio inscrito
      if (m2Data.subtipo === 'englobe' && m2Data.predio_resultante) {
        dataToSend.predios_inscritos = [m2Data.predio_resultante];
      }
      
      const response = await axios.post(`${API}/resoluciones/generar-m2`, dataToSend, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        toast.success(`Resolución ${response.data.numero_resolucion} generada exitosamente`);
        
        // Abrir PDF en nueva pestaña
        if (response.data.pdf_url) {
          window.open(response.data.pdf_url, '_blank');
        }
        
        // Limpiar formulario
        resetFormularioM2();
        setShowMutacionDialog(false);
        setTipoMutacionSeleccionado(null);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error generando resolución');
    } finally {
      setGenerando(false);
    }
  };

  // Reset formulario M2
  const resetFormularioM2 = () => {
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
  };

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
        {Object.values(TIPOS_MUTACION).map((tipo) => (
          <Card 
            key={tipo.codigo}
            data-testid={`mutacion-card-${tipo.codigo}`}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              !tipo.enabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-emerald-500'
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
                  <Badge className={tipo.color}>{tipo.codigo}</Badge>
                  <h3 className="font-semibold text-lg mt-2">{tipo.nombre}</h3>
                  <p className="text-sm text-slate-600 mt-1">{tipo.descripcion}</p>
                </div>
                {tipo.enabled ? (
                  <ArrowRight className="w-5 h-5 text-emerald-600" />
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
                    Área terreno: {Number(predio.area_terreno).toLocaleString()} m² | 
                    Construida: {Number(predio.area_construida).toLocaleString()} m² | 
                    Avalúo: ${Number(predio.avaluo).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500">Matrícula: {predio.matricula_inmobiliaria || 'N/A'}</p>
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
                          <p>Área: {Number(predio.area_terreno).toLocaleString()} m²</p>
                          <p>Matrícula: {predio.matricula_inmobiliaria || 'N/A'}</p>
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
                      {m2Data.predios_cancelados.reduce((sum, p) => sum + Number(p.area_terreno || 0), 0).toLocaleString()} m²
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
                            <p>{m2Data.predio_resultante.matricula_inmobiliaria || 'N/A'}</p>
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
                            <p className="font-medium text-emerald-700">{Number(m2Data.predio_resultante.area_terreno).toLocaleString()} m²</p>
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
                      <p className="text-xs text-slate-600">Matrícula: {m2Data.predio_resultante.matricula_inmobiliaria || 'N/A'}</p>
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
              <Button size="sm" onClick={agregarPredioDestino} className="bg-emerald-600 hover:bg-emerald-700" data-testid="btn-nuevo-predio-inscrito">
                <Plus className="w-4 h-4 mr-1" /> Nuevo Predio
              </Button>
            </div>
          </CardHeader>
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
                      NPN: {predio.npn || 'N/A'} | Matrícula: {predio.matricula_inmobiliaria || 'N/A'}
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
                      
                      // Cargar zonas y construcciones existentes
                      if (predio.zonas?.length > 0) {
                        setZonasTerreno(predio.zonas.map(z => ({
                          zona_fisica: z.zona_fisica || '',
                          zona_economica: z.zona_economica || '',
                          area_terreno: String(z.area_terreno || 0)
                        })));
                      } else if (predio.zonas_homogeneas?.length > 0) {
                        setZonasTerreno(predio.zonas_homogeneas.map(z => ({
                          zona_fisica: z.zona_fisica || '',
                          zona_economica: z.zona_economica || '',
                          area_terreno: String(z.area_terreno || 0)
                        })));
                      } else {
                        setZonasTerreno([{ zona_fisica: '', zona_economica: '', area_terreno: '0' }]);
                      }
                      
                      if (predio.construcciones?.length > 0) {
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
                        onClick={() => window.open(res.pdf_path, '_blank')}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        PDF
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
                      className="min-h-[300px] font-mono text-sm"
                      placeholder="Texto de la plantilla..."
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Variables disponibles: {'{municipio}'}, {'{radicado}'}, {'{solicitante}'}, {'{documento}'}, {'{npn}'}, {'{fecha}'}
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
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {tipoMutacionSeleccionado?.nombre} - {tipoMutacionSeleccionado?.descripcion}
            </DialogTitle>
          </DialogHeader>
          
          {tipoMutacionSeleccionado?.codigo === 'M2' && renderFormularioM2()}
          
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
                            Matrícula: {m1Data.predio.matricula_inmobiliaria || 'N/A'} | 
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
                          </div>
                        ))
                      )}
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
            }}>
              Cancelar
            </Button>
            {tipoMutacionSeleccionado?.codigo === 'M1' && m1Data.predio && (
              <Button 
                onClick={generarResolucionM1} 
                disabled={generando || !m1Data.numero_resolucion || !m1Data.radicado_peticion || m1Data.propietarios_nuevos.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {generando ? 'Generando...' : 'Generar Resolución M1'}
              </Button>
            )}
            {tipoMutacionSeleccionado?.codigo === 'M2' && (
              <Button 
                onClick={generarResolucionM2} 
                disabled={generando}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {generando ? 'Generando...' : 'Generar Resolución M2'}
              </Button>
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
                          {verificacionCodigoNuevo.estado === 'eliminado' && '⚠ Código de predio eliminado'}
                        </p>
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
                      </div>
                    ))}
                  </CardContent>
                </Card>
                
                {/* Información del predio */}
                <Card>
                  <CardHeader className="py-2">
                    <CardTitle className="text-sm">Información del Predio</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label className="text-xs">Dirección *</Label>
                      <Input
                        value={nuevoPredioInscrito?.direccion || ''}
                        onChange={(e) => setNuevoPredioInscrito(prev => ({...prev, direccion: e.target.value.toUpperCase()}))}
                        placeholder="Ej: CL 5 # 3-45"
                      />
                    </div>
                    <div className="relative">
                      <Label className="text-xs">Destino Económico</Label>
                      <div 
                        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-white px-3 py-2 text-sm cursor-pointer hover:bg-slate-50"
                        onClick={() => setShowDestinoDropdownNuevo(!showDestinoDropdownNuevo)}
                      >
                        <span>
                          {nuevoPredioInscrito?.destino_economico === 'A' ? 'A - Habitacional' :
                           nuevoPredioInscrito?.destino_economico === 'B' ? 'B - Industrial' :
                           nuevoPredioInscrito?.destino_economico === 'C' ? 'C - Comercial' :
                           nuevoPredioInscrito?.destino_economico === 'D' ? 'D - Agropecuario' :
                           nuevoPredioInscrito?.destino_economico === 'L' ? 'L - Agrícola' :
                           nuevoPredioInscrito?.destino_economico === 'R' ? 'R - Residencial' : 'Seleccionar'}
                        </span>
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </div>
                      {showDestinoDropdownNuevo && (
                        <div className="absolute z-[99999] mt-1 w-full bg-white border rounded-md shadow-lg">
                          {[
                            {v: 'A', l: 'A - Habitacional'}, {v: 'B', l: 'B - Industrial'},
                            {v: 'C', l: 'C - Comercial'}, {v: 'D', l: 'D - Agropecuario'},
                            {v: 'L', l: 'L - Agrícola'}, {v: 'R', l: 'R - Residencial'}
                          ].map(opt => (
                            <div
                              key={opt.v}
                              className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${nuevoPredioInscrito?.destino_economico === opt.v ? 'bg-blue-100' : ''}`}
                              onClick={() => { setNuevoPredioInscrito(prev => ({...prev, destino_economico: opt.v})); setShowDestinoDropdownNuevo(false); }}
                            >
                              {opt.l}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs">Matrícula Inmobiliaria</Label>
                      <Input
                        value={nuevoPredioInscrito?.matricula_inmobiliaria || ''}
                        onChange={(e) => setNuevoPredioInscrito(prev => ({...prev, matricula_inmobiliaria: e.target.value}))}
                        placeholder="Ej: 270-8920"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Avalúo (COP)</Label>
                      <Input
                        type="number"
                        value={nuevoPredioInscrito?.avaluo || 0}
                        onChange={(e) => setNuevoPredioInscrito(prev => ({...prev, avaluo: e.target.value}))}
                        placeholder="200000"
                      />
                    </div>
                    
                    {/* Áreas calculadas */}
                    <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm font-medium text-blue-800 mb-2">Áreas (calculadas del R2)</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-xs text-blue-600">Área Terreno:</span>
                          <span className="font-bold block">{calcularAreasTotalesNuevo().areaTerrenoTotal.toLocaleString('es-CO', {minimumFractionDigits: 2})} m²</span>
                        </div>
                        <div>
                          <span className="text-xs text-blue-600">Área Construida:</span>
                          <span className="font-bold block">{calcularAreasTotalesNuevo().areaConstruidaTotal.toLocaleString('es-CO', {minimumFractionDigits: 2})} m²</span>
                        </div>
                      </div>
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
    </div>
  );
}
