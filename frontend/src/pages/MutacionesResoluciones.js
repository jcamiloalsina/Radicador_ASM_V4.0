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
  ChevronDown, ChevronUp, Trash2, Edit
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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
  { codigo: '54498', nombre: 'Ocaña' },
  { codigo: '20614', nombre: 'Río de Oro' },
  { codigo: '54670', nombre: 'San Calixto' },
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
    documentos_soporte: []
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
  }, [activeTab, fetchHistorial]);

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
  const agregarPredioDestino = () => {
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
      propietarios: [{
        nombre_propietario: '',
        tipo_documento: 'C',
        numero_documento: ''
      }],
      // Historial de avalúos
      inscripcion_catastral: { valor: 0, fecha: '' },
      decretos: []
    };
    
    setM2Data(prev => ({
      ...prev,
      predios_inscritos: [...prev.predios_inscritos, nuevoPredio]
    }));
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
    if (m2Data.predios_inscritos.length === 0) {
      toast.error('Agregue al menos un predio a inscribir');
      return;
    }
    
    setGenerando(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/resoluciones/generar-m2`, m2Data, {
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
      documentos_soporte: []
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

      {/* Predios a Inscribir (Destino) */}
      <Card className="border-emerald-200 bg-emerald-50/30">
        <CardHeader className="py-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-sm flex items-center gap-2 text-emerald-800">
              <Check className="w-4 h-4" />
              Predios a INSCRIBIR ({m2Data.predios_inscritos.length})
            </CardTitle>
            <Button size="sm" onClick={agregarPredioDestino} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-1" /> Agregar Predio
            </Button>
          </div>
        </CardHeader>
        <CardContent className="py-2 space-y-4">
          {m2Data.predios_inscritos.map((predio, idx) => (
            <div key={idx} className="bg-white p-4 rounded-lg border border-emerald-200 space-y-3">
              <div className="flex justify-between items-center">
                <Badge className="bg-emerald-100 text-emerald-800">Predio {idx + 1}</Badge>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => eliminarPredioDestino(idx)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Código Predial (20 dígitos)</Label>
                  <Input
                    value={predio.codigo_predial}
                    onChange={(e) => actualizarPredioDestino(idx, 'codigo_predial', e.target.value)}
                    placeholder="54003010100320136000"
                    maxLength={20}
                  />
                </div>
                <div>
                  <Label className="text-xs">NPN (30 dígitos)</Label>
                  <Input
                    value={predio.npn}
                    onChange={(e) => actualizarPredioDestino(idx, 'npn', e.target.value)}
                    placeholder="540030101000000320136000000000"
                    maxLength={30}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Código Homologado</Label>
                  <Input
                    value={predio.codigo_homologado}
                    onChange={(e) => actualizarPredioDestino(idx, 'codigo_homologado', e.target.value)}
                    placeholder="BPP0001BFAD"
                  />
                </div>
                <div>
                  <Label className="text-xs">Matrícula Inmobiliaria</Label>
                  <Input
                    value={predio.matricula_inmobiliaria}
                    onChange={(e) => actualizarPredioDestino(idx, 'matricula_inmobiliaria', e.target.value)}
                    placeholder="270-88010"
                  />
                </div>
                <div>
                  <Label className="text-xs">Destino Económico</Label>
                  <Select 
                    value={predio.destino_economico}
                    onValueChange={(v) => actualizarPredioDestino(idx, 'destino_economico', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
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
                      <SelectItem value="N">N - Forestal</SelectItem>
                      <SelectItem value="O">O - Uso Público</SelectItem>
                      <SelectItem value="P">P - Servicios Especiales</SelectItem>
                      <SelectItem value="R">R - Residencial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label className="text-xs">Dirección</Label>
                <Input
                  value={predio.direccion}
                  onChange={(e) => actualizarPredioDestino(idx, 'direccion', e.target.value.toUpperCase())}
                  placeholder="C 14 10 58 72 80 Lo 76 BR SAN ANTONIO"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Área Terreno (m²)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={predio.area_terreno}
                    onChange={(e) => actualizarPredioDestino(idx, 'area_terreno', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Área Construida (m²)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={predio.area_construida}
                    onChange={(e) => actualizarPredioDestino(idx, 'area_construida', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Avalúo ($)</Label>
                  <Input
                    type="number"
                    value={predio.avaluo}
                    onChange={(e) => actualizarPredioDestino(idx, 'avaluo', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
              
              {/* Propietario */}
              <div className="grid grid-cols-3 gap-3 pt-2 border-t">
                <div className="col-span-2">
                  <Label className="text-xs">Propietario</Label>
                  <Input
                    value={predio.propietarios[0]?.nombre_propietario || ''}
                    onChange={(e) => {
                      const nuevos = [...m2Data.predios_inscritos];
                      nuevos[idx].propietarios[0] = {
                        ...nuevos[idx].propietarios[0],
                        nombre_propietario: e.target.value.toUpperCase()
                      };
                      setM2Data(prev => ({ ...prev, predios_inscritos: nuevos }));
                    }}
                    placeholder="NOMBRE COMPLETO"
                  />
                </div>
                <div>
                  <Label className="text-xs">Cédula</Label>
                  <Input
                    value={predio.propietarios[0]?.numero_documento || ''}
                    onChange={(e) => {
                      const nuevos = [...m2Data.predios_inscritos];
                      nuevos[idx].propietarios[0] = {
                        ...nuevos[idx].propietarios[0],
                        numero_documento: e.target.value
                      };
                      setM2Data(prev => ({ ...prev, predios_inscritos: nuevos }));
                    }}
                    placeholder="12345678"
                  />
                </div>
              </div>
            </div>
          ))}
          
          {m2Data.predios_inscritos.length === 0 && (
            <p className="text-center text-slate-500 py-4">
              Haga clic en "Agregar Predio" para añadir predios a inscribir
            </p>
          )}
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
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="nueva" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nueva Mutación
          </TabsTrigger>
          <TabsTrigger value="historial" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Historial
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="nueva" className="mt-6">
          {renderSelectorTipo()}
        </TabsContent>
        
        <TabsContent value="historial" className="mt-6">
          {renderHistorial()}
        </TabsContent>
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
    </div>
  );
}
