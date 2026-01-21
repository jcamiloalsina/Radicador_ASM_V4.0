import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, GeoJSON, Marker, CircleMarker, useMap, useMapEvents, ImageOverlay } from 'react-leaflet';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// UI Components
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

// Icons
import {
  ArrowLeft,
  MapPin,
  Navigation,
  Search,
  Locate,
  RefreshCw,
  Database,
  FileSpreadsheet,
  User,
  Home,
  AlertCircle,
  CheckCircle,
  Crosshair,
  Satellite,
  Map as MapIcon,
  Edit,
  Save,
  Camera,
  Clock,
  CheckSquare,
  Square,
  Eye,
  Trash2,
  Plus,
  FileText,
  Pen,
  Users,
  X,
  Image,
  History,
  GitCompare,
  Check,
  XCircle,
  Download,
  FileDown,
  Send
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Componente para manejar eventos del mapa y ubicación GPS
function MapController({ onLocationFound, setCurrentZoom, flyToPosition }) {
  const map = useMap();
  
  useMapEvents({
    zoomend: () => {
      setCurrentZoom(map.getZoom());
    },
    locationfound: (e) => {
      onLocationFound(e.latlng);
    },
    locationerror: (e) => {
      toast.error('No se pudo obtener la ubicación GPS');
      console.error('Location error:', e.message);
    }
  });
  
  useEffect(() => {
    if (flyToPosition) {
      map.flyTo(flyToPosition, 18, { duration: 1.5 });
    }
  }, [flyToPosition, map]);
  
  return null;
}

// Componente inteligente que cambia de Esri a Google cuando el zoom es alto
function SmartTileLayer({ mapType, tileLayers }) {
  const map = useMap();
  const [currentZoom, setCurrentZoom] = useState(map.getZoom());
  
  useMapEvents({
    zoomend: () => {
      setCurrentZoom(map.getZoom());
    }
  });
  
  // Si es satélite y zoom > 17, usar Google automáticamente
  const effectiveLayer = (mapType === 'satellite' && currentZoom > 17) 
    ? tileLayers.google_satellite 
    : tileLayers[mapType] || tileLayers.satellite;
  
  const showingGoogle = mapType === 'satellite' && currentZoom > 17;
  
  return (
    <>
      <TileLayer
        key={showingGoogle ? 'google' : mapType}
        url={effectiveLayer.url}
        attribution={effectiveLayer.attribution}
        maxZoom={effectiveLayer.maxZoom}
        maxNativeZoom={effectiveLayer.maxNativeZoom || effectiveLayer.maxZoom}
      />
      {showingGoogle && (
        <div className="absolute bottom-8 left-2 z-[1000] bg-black/60 text-white text-xs px-2 py-1 rounded">
          Zoom alto → Google Satellite
        </div>
      )}
    </>
  );
}

// Icono personalizado para la ubicación del usuario
const userLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: `<div style="
    width: 20px;
    height: 20px;
    background: #3b82f6;
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

export default function VisorActualizacion() {
  const { proyectoId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const mapRef = useRef(null);
  
  // Estados del proyecto
  const [proyecto, setProyecto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [geometrias, setGeometrias] = useState(null);
  const [geometriasFiltradas, setGeometriasFiltradas] = useState(null);
  const [construcciones, setConstrucciones] = useState(null);
  const [prediosR1R2, setPrediosR1R2] = useState([]);
  
  // Estados del mapa
  const [currentZoom, setCurrentZoom] = useState(14);
  const [mapType, setMapType] = useState('satellite');
  const [mapCenter, setMapCenter] = useState([7.8, -72.9]);
  
  // Estados de Ortofoto
  const [ortofotoUrl, setOrtofotoUrl] = useState(null);
  const [ortofotoBounds, setOrtofotoBounds] = useState(null);
  const [ortofotoOpacity, setOrtofotoOpacity] = useState(0.8);
  const [showOrtofoto, setShowOrtofoto] = useState(true);
  const [uploadingOrtofoto, setUploadingOrtofoto] = useState(false);
  const ortofotoInputRef = useRef(null);
  
  // Estados de GPS
  const [userPosition, setUserPosition] = useState(null);
  const [watchingPosition, setWatchingPosition] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const watchIdRef = useRef(null);
  
  // Estados de búsqueda y selección
  const [searchCode, setSearchCode] = useState('');
  const [selectedPredio, setSelectedPredio] = useState(null);
  const [selectedGeometry, setSelectedGeometry] = useState(null);
  const [flyToPosition, setFlyToPosition] = useState(null);
  const [showPredioDetail, setShowPredioDetail] = useState(false);
  
  // Estados de edición
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  
  // Estados para edición de propietarios y zonas (igual que Conservación)
  const [propietarios, setPropietarios] = useState([{
    nombre: '',
    tipo_documento: 'C',
    documento: '',
    estado_civil: ''
  }]);
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
  
  // Estados de filtro
  const [filterZona, setFilterZona] = useState('todos');
  const [filterEstado, setFilterEstado] = useState('todos'); // todos, pendiente, visitado, actualizado
  
  // Estados para formato de visita
  const [showVisitaModal, setShowVisitaModal] = useState(false);
  const [visitaData, setVisitaData] = useState({
    fecha_visita: new Date().toISOString().split('T')[0],
    hora_visita: new Date().toTimeString().slice(0, 5),
    persona_atiende: '',
    relacion_predio: '',
    estado_predio: '',
    acceso_predio: '',
    servicios_publicos: [],
    observaciones: '',
    firma_base64: null
  });
  const [fotos, setFotos] = useState([]);
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const fileInputRef = useRef(null);
  
  // Estados para propuestas de cambio e historial
  const [showPropuestaModal, setShowPropuestaModal] = useState(false);
  const [propuestas, setPropuestas] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [propuestaData, setPropuestaData] = useState({
    datos_propuestos: {},
    justificacion: ''
  });
  const [generandoPdf, setGenerandoPdf] = useState(false);
  
  // Cargar datos del proyecto
  const fetchProyecto = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/actualizacion/proyectos/${proyectoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProyecto(response.data);
      
      if (response.data.gdb_procesado) {
        fetchGeometrias();
      }
      
      if (response.data.info_alfanumerica_archivo) {
        fetchPrediosR1R2();
      }
      
      // Cargar ortofoto si existe
      fetchOrtofoto();
    } catch (error) {
      toast.error('Error al cargar el proyecto');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);
  
  // Cargar geometrías del proyecto
  const fetchGeometrias = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/actualizacion/proyectos/${proyectoId}/geometrias`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { zona: filterZona !== 'todos' ? filterZona : undefined }
      });
      
      if (response.data.geometrias?.features?.length > 0) {
        setGeometrias(response.data.geometrias);
        
        const bounds = L.geoJSON(response.data.geometrias).getBounds();
        if (bounds.isValid()) {
          setMapCenter([bounds.getCenter().lat, bounds.getCenter().lng]);
        }
      }
      
      if (response.data.construcciones?.features?.length > 0) {
        setConstrucciones(response.data.construcciones);
      }
    } catch (error) {
      console.error('Error cargando geometrías:', error);
    }
  };
  
  // Cargar predios R1/R2
  const fetchPrediosR1R2 = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/actualizacion/proyectos/${proyectoId}/predios`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPrediosR1R2(response.data.predios || []);
    } catch (error) {
      console.error('Error cargando predios R1/R2:', error);
    }
  };
  
  useEffect(() => {
    if (proyectoId) {
      fetchProyecto();
    }
  }, [proyectoId, fetchProyecto]);
  
  useEffect(() => {
    if (proyecto?.gdb_procesado) {
      fetchGeometrias();
    }
  }, [filterZona]);
  
  // Filtrar geometrías por estado
  useEffect(() => {
    if (!geometrias?.features) {
      setGeometriasFiltradas(null);
      return;
    }
    
    if (filterEstado === 'todos') {
      setGeometriasFiltradas(geometrias);
      return;
    }
    
    // Obtener los códigos de predios según el estado
    const codigosPorEstado = new Set();
    prediosR1R2.forEach(predio => {
      const estado = predio.estado_visita || 'pendiente';
      if (estado === filterEstado) {
        codigosPorEstado.add(predio.codigo_predial || predio.numero_predial);
      }
    });
    
    // Filtrar las geometrías
    const featuresFiltradas = geometrias.features.filter(feature => {
      const codigo = feature.properties?.codigo_predial || feature.properties?.numero_predial;
      return codigosPorEstado.has(codigo);
    });
    
    setGeometriasFiltradas({
      type: 'FeatureCollection',
      features: featuresFiltradas
    });
  }, [geometrias, filterEstado, prediosR1R2]);
  
  // Funciones GPS - Mejorado para tablets
  const startWatchingPosition = async () => {
    if (!navigator.geolocation) {
      toast.error('Tu dispositivo no soporta geolocalización');
      return;
    }
    
    // Primero verificar permisos en dispositivos modernos
    if (navigator.permissions) {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
        if (permissionStatus.state === 'denied') {
          toast.error('Permiso de ubicación denegado. Active la ubicación en la configuración del navegador.');
          return;
        }
      } catch (e) {
        // Algunos navegadores no soportan permissions API - continuar de todas formas
        console.log('Permissions API no soportada');
      }
    }
    
    setWatchingPosition(true);
    toast.info('Activando GPS... Por favor espere');
    
    // Primero intentar obtener una posición rápida (menos precisa)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setUserPosition([latitude, longitude]);
        setGpsAccuracy(accuracy);
        toast.success(`GPS conectado - Precisión inicial: ${Math.round(accuracy)}m`);
      },
      (error) => {
        console.log('Error en posición inicial:', error.message);
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 60000 // Aceptar posición de hasta 1 minuto
      }
    );
    
    // Luego iniciar el watch con alta precisión
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setUserPosition([latitude, longitude]);
        setGpsAccuracy(accuracy);
        
        // Solo mostrar mensaje si mejora significativamente la precisión
        if (accuracy < 50) {
          console.log(`GPS activo - Precisión: ${Math.round(accuracy)}m`);
        }
      },
      (error) => {
        let errorMsg = 'Error de GPS: ';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg += 'Permiso denegado. Active la ubicación en configuración.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg += 'Ubicación no disponible. Verifique que el GPS esté activado.';
            break;
          case error.TIMEOUT:
            errorMsg += 'Tiempo de espera agotado. Intente en un área abierta.';
            break;
          default:
            errorMsg += error.message;
        }
        toast.error(errorMsg);
        // No desactivar inmediatamente - puede ser un error temporal
        if (error.code === error.PERMISSION_DENIED) {
          setWatchingPosition(false);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 30000, // 30 segundos - más tiempo para tablets
        maximumAge: 5000 // Aceptar posición de hasta 5 segundos
      }
    );
  };
  
  const stopWatchingPosition = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setWatchingPosition(false);
    toast.info('GPS desactivado');
  };
  
  const centerOnUser = () => {
    if (userPosition) {
      setFlyToPosition(userPosition);
    } else {
      toast.warning('Activa el GPS primero');
    }
  };
  
  useEffect(() => {
    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);
  
  // ==================== ORTOFOTO ====================
  const handleOrtofotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validar tipo de archivo
    const validTypes = ['image/tiff', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.tif') && !file.name.endsWith('.tiff')) {
      toast.error('Formato no válido. Use TIFF, PNG o JPG');
      return;
    }
    
    setUploadingOrtofoto(true);
    const formData = new FormData();
    formData.append('ortofoto', file);
    formData.append('proyecto_id', proyectoId);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/actualizacion/proyectos/${proyectoId}/ortofoto`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      if (response.data.url && response.data.bounds) {
        setOrtofotoUrl(response.data.url);
        setOrtofotoBounds([
          [response.data.bounds.south, response.data.bounds.west],
          [response.data.bounds.north, response.data.bounds.east]
        ]);
        toast.success('Ortofoto cargada exitosamente');
        
        // Auto-zoom a los bounds de la ortofoto
        if (mapRef.current) {
          mapRef.current.fitBounds([
            [response.data.bounds.south, response.data.bounds.west],
            [response.data.bounds.north, response.data.bounds.east]
          ]);
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al cargar ortofoto');
    } finally {
      setUploadingOrtofoto(false);
    }
  };
  
  // Cargar ortofoto existente del proyecto
  const fetchOrtofoto = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/actualizacion/proyectos/${proyectoId}/ortofoto`,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      if (response.data.url && response.data.bounds) {
        setOrtofotoUrl(response.data.url);
        setOrtofotoBounds([
          [response.data.bounds.south, response.data.bounds.west],
          [response.data.bounds.north, response.data.bounds.east]
        ]);
      }
    } catch (error) {
      // Sin ortofoto cargada - es normal
      console.log('Sin ortofoto cargada');
    }
  };
  
  // ==================== AUTO-ZOOM A CAPA GDB ====================
  const zoomToGDBLayer = useCallback(() => {
    if (!geometrias?.features?.length) {
      toast.warning('No hay geometrías cargadas');
      return;
    }
    
    try {
      const geoJsonLayer = L.geoJSON(geometrias);
      const bounds = geoJsonLayer.getBounds();
      
      if (bounds.isValid() && mapRef.current) {
        mapRef.current.fitBounds(bounds, { padding: [20, 20] });
        toast.success('Vista ajustada a las geometrías');
      }
    } catch (error) {
      console.error('Error al hacer zoom a GDB:', error);
    }
  }, [geometrias]);
  
  // Auto-zoom cuando se cargan las geometrías por primera vez
  useEffect(() => {
    if (geometrias?.features?.length > 0 && mapRef.current) {
      // Pequeño delay para asegurar que el mapa esté listo
      setTimeout(() => {
        zoomToGDBLayer();
      }, 500);
    }
  }, [geometrias?.features?.length]);
  
  // Buscar predio
  const handleSearch = async () => {
    if (!searchCode.trim()) return;
    
    if (geometrias?.features) {
      const feature = geometrias.features.find(f => 
        f.properties?.codigo_predial?.includes(searchCode) ||
        f.properties?.numero_predial?.includes(searchCode)
      );
      
      if (feature) {
        setSelectedGeometry(feature);
        const bounds = L.geoJSON(feature).getBounds();
        setFlyToPosition([bounds.getCenter().lat, bounds.getCenter().lng]);
        toast.success('Predio encontrado en mapa');
      }
    }
    
    const predio = prediosR1R2.find(p => 
      p.codigo_predial?.includes(searchCode) ||
      p.numero_predial?.includes(searchCode)
    );
    
    if (predio) {
      setSelectedPredio(predio);
      setEditData({
        direccion: predio.direccion || '',
        destino_economico: predio.destino_economico || '',
        area_terreno: predio.area_terreno || '',
        area_construida: predio.area_construida || '',
        observaciones_campo: predio.observaciones_campo || '',
        estado_visita: predio.estado_visita || 'pendiente'
      });
      setShowPredioDetail(true);
    } else if (!geometrias?.features?.find(f => f.properties?.codigo_predial?.includes(searchCode))) {
      toast.warning('Predio no encontrado');
    }
  };
  
  // Guardar cambios del predio
  const handleSaveChanges = async () => {
    if (!selectedPredio) return;
    
    const esCoordinador = user?.role === 'coordinador' || user?.role === 'administrador';
    
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      
      // Filtrar propietarios y zonas válidas
      const propietariosValidos = propietarios.filter(p => p.nombre && p.nombre.trim());
      const zonasValidas = zonasFisicas.filter(z => z.zona_fisica || z.area_terreno);
      
      const dataToSave = {
        ...editData,
        propietarios: propietariosValidos,
        zonas_fisicas: zonasValidas,
        ubicacion_gps: userPosition ? { lat: userPosition[0], lng: userPosition[1], accuracy: gpsAccuracy } : null
      };
      
      if (esCoordinador) {
        // Coordinador/Admin: Aplicar cambios directamente
        await axios.patch(
          `${API}/actualizacion/proyectos/${proyectoId}/predios/${selectedPredio.codigo_predial || selectedPredio.numero_predial}`,
          {
            ...dataToSave,
            actualizado_por: user?.email,
            actualizado_en: new Date().toISOString(),
            estado_visita: 'actualizado'
          },
          { headers: { Authorization: `Bearer ${token}` }}
        );
        
        toast.success('Cambios aplicados directamente');
        
        // Actualizar predio en la lista local
        setPrediosR1R2(prev => prev.map(p => 
          (p.codigo_predial === selectedPredio.codigo_predial || p.numero_predial === selectedPredio.numero_predial)
            ? { ...p, ...dataToSave, estado_visita: 'actualizado' }
            : p
        ));
        
        setSelectedPredio(prev => ({ ...prev, ...dataToSave, estado_visita: 'actualizado' }));
      } else {
        // Gestor: Crear propuesta de cambio para aprobación del coordinador
        const codigoPredial = selectedPredio.codigo_predial || selectedPredio.numero_predial;
        
        // Verificar que el predio esté visitado
        if (selectedPredio.estado_visita !== 'visitado' && selectedPredio.estado_visita !== 'actualizado') {
          toast.error('Debe marcar el predio como visitado antes de proponer cambios');
          setSaving(false);
          return;
        }
        
        // Crear propuesta con justificación
        const justificacion = prompt('Ingrese una justificación para los cambios propuestos:');
        if (!justificacion || !justificacion.trim()) {
          toast.warning('Debe ingresar una justificación para crear la propuesta');
          setSaving(false);
          return;
        }
        
        await axios.post(
          `${API}/actualizacion/proyectos/${proyectoId}/predios/${codigoPredial}/propuesta`,
          {
            datos_propuestos: dataToSave,
            justificacion: justificacion.trim()
          },
          { headers: { Authorization: `Bearer ${token}` }}
        );
        
        toast.success('Propuesta de cambio enviada al coordinador para aprobación');
        
        // Actualizar estado local para indicar que hay propuesta pendiente
        setPrediosR1R2(prev => prev.map(p => 
          (p.codigo_predial === selectedPredio.codigo_predial || p.numero_predial === selectedPredio.numero_predial)
            ? { ...p, tiene_propuesta_pendiente: true }
            : p
        ));
      }
      
      setEditMode(false);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error al procesar cambios';
      toast.error(errorMsg);
      console.error(error);
    } finally {
      setSaving(false);
    }
  };
  
  // Marcar como visitado
  const handleMarcarVisitado = async () => {
    if (!selectedPredio) return;
    
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `${API}/actualizacion/proyectos/${proyectoId}/predios/${selectedPredio.codigo_predial || selectedPredio.numero_predial}`,
        {
          estado_visita: 'visitado',
          ubicacion_gps: userPosition ? { lat: userPosition[0], lng: userPosition[1], accuracy: gpsAccuracy } : null,
          visitado_por: user?.email,
          visitado_en: new Date().toISOString()
        },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      toast.success('Predio marcado como visitado');
      
      setPrediosR1R2(prev => prev.map(p => 
        (p.codigo_predial === selectedPredio.codigo_predial || p.numero_predial === selectedPredio.numero_predial)
          ? { ...p, estado_visita: 'visitado' }
          : p
      ));
      
      setSelectedPredio(prev => ({ ...prev, estado_visita: 'visitado' }));
      setEditData(prev => ({ ...prev, estado_visita: 'visitado' }));
    } catch (error) {
      toast.error('Error al marcar como visitado');
    } finally {
      setSaving(false);
    }
  };
  
  // ========== FUNCIONES PARA FORMATO DE VISITA ==========
  
  // Abrir modal de visita
  const abrirFormatoVisita = () => {
    setVisitaData({
      fecha_visita: new Date().toISOString().split('T')[0],
      hora_visita: new Date().toTimeString().slice(0, 5),
      persona_atiende: '',
      relacion_predio: '',
      estado_predio: '',
      acceso_predio: 'si',
      servicios_publicos: [],
      observaciones: '',
      firma_base64: null
    });
    setFotos([]);
    setShowVisitaModal(true);
    
    // Limpiar canvas de firma después de que el modal se abra
    setTimeout(() => {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }, 100);
  };
  
  // Manejar captura de fotos
  const handleCapturarFoto = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const handleFotoChange = async (e) => {
    const files = Array.from(e.target.files);
    
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('La foto no puede superar 5MB');
        continue;
      }
      
      // Convertir a base64
      const reader = new FileReader();
      reader.onload = () => {
        setFotos(prev => [...prev, {
          id: Date.now() + Math.random(),
          data: reader.result,
          nombre: file.name,
          fecha: new Date().toISOString()
        }]);
      };
      reader.readAsDataURL(file);
    }
    
    // Limpiar input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const eliminarFoto = (fotoId) => {
    setFotos(prev => prev.filter(f => f.id !== fotoId));
  };
  
  // Funciones de firma digital
  const startDrawing = (e) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    let x, y;
    if (e.type.includes('touch')) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  
  const draw = (e) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    let x, y;
    if (e.type.includes('touch')) {
      e.preventDefault();
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };
  
  const stopDrawing = () => {
    setIsDrawing(false);
  };
  
  const limpiarFirma = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };
  
  const obtenerFirmaBase64 = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      return canvas.toDataURL('image/png');
    }
    return null;
  };
  
  // Guardar formato de visita completo
  const handleGuardarVisita = async () => {
    if (!selectedPredio) return;
    
    // Validaciones
    if (!visitaData.persona_atiende.trim()) {
      toast.error('Ingrese el nombre de la persona que atiende');
      return;
    }
    
    const firmaBase64 = obtenerFirmaBase64();
    
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `${API}/actualizacion/proyectos/${proyectoId}/predios/${selectedPredio.codigo_predial || selectedPredio.numero_predial}`,
        {
          estado_visita: 'visitado',
          visita: {
            ...visitaData,
            firma_base64: firmaBase64,
            fotos: fotos.map(f => ({ data: f.data, nombre: f.nombre, fecha: f.fecha })),
            ubicacion_gps: userPosition ? { lat: userPosition[0], lng: userPosition[1], accuracy: gpsAccuracy } : null,
            realizada_por: user?.email,
            realizada_en: new Date().toISOString()
          },
          visitado_por: user?.email,
          visitado_en: new Date().toISOString()
        },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      toast.success('Formato de visita guardado exitosamente');
      setShowVisitaModal(false);
      
      // Actualizar estado local
      setPrediosR1R2(prev => prev.map(p => 
        (p.codigo_predial === selectedPredio.codigo_predial || p.numero_predial === selectedPredio.numero_predial)
          ? { ...p, estado_visita: 'visitado' }
          : p
      ));
      
      setSelectedPredio(prev => ({ ...prev, estado_visita: 'visitado' }));
      setEditData(prev => ({ ...prev, estado_visita: 'visitado' }));
      setShowPredioDetail(false);
    } catch (error) {
      toast.error('Error al guardar formato de visita');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };
  
  // ========== FIN FUNCIONES FORMATO DE VISITA ==========
  
  // ========== FUNCIONES PARA PROPIETARIOS Y ZONAS (igual que Conservación) ==========
  
  // Funciones para manejar múltiples propietarios
  const agregarPropietario = () => {
    setPropietarios([...propietarios, {
      nombre: '',
      tipo_documento: 'C',
      documento: '',
      estado_civil: ''
    }]);
  };
  
  const eliminarPropietario = (index) => {
    if (propietarios.length > 1) {
      setPropietarios(propietarios.filter((_, i) => i !== index));
    }
  };
  
  const actualizarPropietario = (index, campo, valor) => {
    const nuevos = [...propietarios];
    nuevos[index][campo] = valor;
    setPropietarios(nuevos);
  };
  
  // Funciones para manejar múltiples zonas físicas
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
    const nuevas = [...zonasFisicas];
    nuevas[index][campo] = valor;
    setZonasFisicas(nuevas);
  };
  
  // Cargar datos del predio seleccionado en los estados de edición
  const cargarDatosParaEdicion = (predio) => {
    // Cargar propietarios
    if (predio.propietarios && predio.propietarios.length > 0) {
      setPropietarios(predio.propietarios.map(p => ({
        nombre: p.nombre || '',
        tipo_documento: p.tipo_documento || p.tipo_doc || 'C',
        documento: p.documento || p.numero_documento || '',
        estado_civil: p.estado_civil || ''
      })));
    } else {
      setPropietarios([{
        nombre: '',
        tipo_documento: 'C',
        documento: '',
        estado_civil: ''
      }]);
    }
    
    // Cargar zonas físicas
    if (predio.zonas_fisicas && predio.zonas_fisicas.length > 0) {
      setZonasFisicas(predio.zonas_fisicas);
    } else {
      setZonasFisicas([{
        zona_fisica: '0',
        zona_economica: '0',
        area_terreno: predio.area_terreno || '0',
        habitaciones: '0',
        banos: '0',
        locales: '0',
        pisos: '1',
        puntaje: '0',
        area_construida: predio.area_construida || '0'
      }]);
    }
    
    // Cargar datos generales
    setEditData({
      direccion: predio.direccion || '',
      destino_economico: predio.destino_economico || '',
      area_terreno: predio.area_terreno || '',
      area_construida: predio.area_construida || '',
      observaciones_campo: predio.observaciones_campo || '',
      estado_visita: predio.estado_visita || 'pendiente',
      matricula_inmobiliaria: predio.matricula_inmobiliaria || '',
      avaluo_catastral: predio.avaluo_catastral || '',
      comuna: predio.comuna || '',
      estrato: predio.estrato || ''
    });
  };
  
  // ========== FIN FUNCIONES PROPIETARIOS Y ZONAS ==========
  
  // ========== FUNCIONES PARA PROPUESTAS E HISTORIAL ==========
  
  // Cargar propuestas del predio
  const fetchPropuestas = async (codigoPredial) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/actualizacion/proyectos/${proyectoId}/predios/${codigoPredial}/propuestas`,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setPropuestas(response.data.propuestas || []);
    } catch (error) {
      console.error('Error cargando propuestas:', error);
    }
  };
  
  // Cargar historial del predio
  const fetchHistorial = async (codigoPredial) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/actualizacion/proyectos/${proyectoId}/predios/${codigoPredial}/historial`,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setHistorial(response.data.historial || []);
    } catch (error) {
      console.error('Error cargando historial:', error);
    }
  };
  
  // Crear propuesta de cambio
  const handleCrearPropuesta = async () => {
    if (!selectedPredio || !propuestaData.justificacion.trim()) {
      toast.error('Debe incluir una justificación para la propuesta');
      return;
    }
    
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      
      // Construir datos existentes vs propuestos
      const datosExistentes = {
        direccion: selectedPredio.direccion,
        destino_economico: selectedPredio.destino_economico,
        area_terreno: selectedPredio.area_terreno,
        area_construida: selectedPredio.area_construida,
        propietarios: selectedPredio.propietarios
      };
      
      const datosPropuestos = {
        direccion: editData.direccion,
        destino_economico: editData.destino_economico,
        area_terreno: editData.area_terreno,
        area_construida: editData.area_construida,
        propietarios: propietarios.filter(p => p.nombre && p.nombre.trim()),
        zonas_fisicas: zonasFisicas
      };
      
      await axios.post(
        `${API}/actualizacion/proyectos/${proyectoId}/predios/${selectedPredio.codigo_predial || selectedPredio.numero_predial}/propuesta`,
        {
          datos_existentes: datosExistentes,
          datos_propuestos: datosPropuestos,
          justificacion: propuestaData.justificacion
        },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      toast.success('Propuesta de cambio creada. Pendiente de aprobación.');
      setShowPropuestaModal(false);
      setPropuestaData({ datos_propuestos: {}, justificacion: '' });
      fetchPropuestas(selectedPredio.codigo_predial || selectedPredio.numero_predial);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear propuesta');
    } finally {
      setSaving(false);
    }
  };
  
  // Generar PDF del informe de visita
  const handleGenerarPdf = async () => {
    if (!selectedPredio) return;
    
    setGenerandoPdf(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/actualizacion/proyectos/${proyectoId}/predios/${selectedPredio.codigo_predial || selectedPredio.numero_predial}/generar-pdf`,
        {},
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      // Descargar el PDF
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${response.data.pdf_base64}`;
      link.download = response.data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('PDF generado exitosamente');
    } catch (error) {
      toast.error('Error al generar PDF');
      console.error(error);
    } finally {
      setGenerandoPdf(false);
    }
  };
  
  // ========== FIN FUNCIONES PROPUESTAS E HISTORIAL ==========
  
  // Estilo de geometrías
  const getGeometryStyle = (feature) => {
    const isSelected = selectedGeometry?.properties?.codigo_predial === feature.properties?.codigo_predial;
    const isUrban = feature.properties?.zona === 'urbano';
    
    // Verificar estado de visita
    const predio = prediosR1R2.find(p => 
      p.codigo_predial === feature.properties?.codigo_predial ||
      p.numero_predial === feature.properties?.numero_predial
    );
    
    let fillColor = isUrban ? '#3b82f6' : '#22c55e'; // Azul urbano, verde rural
    
    if (predio?.estado_visita === 'visitado') {
      fillColor = '#f59e0b'; // Naranja si visitado
    } else if (predio?.estado_visita === 'actualizado') {
      fillColor = '#8b5cf6'; // Púrpura si actualizado
    }
    
    if (isSelected) {
      fillColor = '#ef4444'; // Rojo si seleccionado
    }
    
    return {
      fillColor,
      weight: isSelected ? 3 : 1,
      opacity: 1,
      color: isSelected ? '#ef4444' : '#1e40af',
      fillOpacity: isSelected ? 0.6 : 0.35
    };
  };
  
  // Click en geometría
  const onEachFeature = (feature, layer) => {
    layer.on({
      click: () => {
        setSelectedGeometry(feature);
        
        // Buscar predio en datos R1/R2
        const predio = prediosR1R2.find(p => 
          p.codigo_predial === feature.properties?.codigo_predial ||
          p.numero_predial === feature.properties?.numero_predial
        );
        
        if (predio) {
          // Si existe en R1/R2, usar esos datos
          setSelectedPredio(predio);
          cargarDatosParaEdicion(predio);
        } else {
          // Si no existe en R1/R2, crear objeto básico desde la geometría
          const predioBasico = {
            codigo_predial: feature.properties?.codigo_predial || feature.properties?.numero_predial || 'Sin código',
            numero_predial: feature.properties?.numero_predial || feature.properties?.codigo_predial || '',
            direccion: feature.properties?.direccion || '',
            destino_economico: feature.properties?.destino_economico || '',
            area_terreno: feature.properties?.area_terreno || feature.properties?.AREA || '',
            area_construida: feature.properties?.area_construida || '',
            estado_visita: 'pendiente',
            propietarios: [],
            zonas_fisicas: []
          };
          setSelectedPredio(predioBasico);
          cargarDatosParaEdicion(predioBasico);
        }
        setShowPredioDetail(true);
        setEditMode(false);
        
        // Cargar propuestas e historial del predio
        const codigo = predio?.codigo_predial || predio?.numero_predial || 
                       feature.properties?.codigo_predial || feature.properties?.numero_predial;
        if (codigo) {
          fetchPropuestas(codigo);
          fetchHistorial(codigo);
        }
      }
    });
    
    if (feature.properties?.codigo_predial || feature.properties?.numero_predial) {
      layer.bindTooltip(
        feature.properties.codigo_predial || feature.properties.numero_predial,
        { permanent: false, direction: 'top' }
      );
    }
  };
  
  // Configuración de capas de tiles
  const tileLayers = {
    satellite: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: "Esri",
      maxZoom: 19
    },
    google_satellite: {
      url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
      attribution: "Google",
      maxZoom: 22,
      maxNativeZoom: 22
    },
    street: {
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: "OpenStreetMap",
      maxZoom: 19
    }
  };
  
  // Contar predios por estado
  const contarPrediosPorEstado = () => {
    const pendientes = prediosR1R2.filter(p => !p.estado_visita || p.estado_visita === 'pendiente').length;
    const visitados = prediosR1R2.filter(p => p.estado_visita === 'visitado').length;
    const actualizados = prediosR1R2.filter(p => p.estado_visita === 'actualizado').length;
    return { pendientes, visitados, actualizados, total: prediosR1R2.length };
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    );
  }
  
  if (!proyecto) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <p className="text-lg text-slate-600">Proyecto no encontrado</p>
        <Button onClick={() => navigate('/dashboard/proyectos-actualizacion')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a Proyectos
        </Button>
      </div>
    );
  }
  
  if (!proyecto.gdb_procesado) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 p-4">
        <Database className="w-16 h-16 text-amber-500" />
        <h2 className="text-xl font-semibold text-slate-800">Visor no disponible</h2>
        <p className="text-slate-600 text-center max-w-md">
          Para usar el visor de campo, primero debe cargar la Base Gráfica (GDB) del proyecto.
        </p>
        <Button onClick={() => navigate('/dashboard/proyectos-actualizacion')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Ir a cargar GDB
        </Button>
      </div>
    );
  }
  
  const estadisticas = contarPrediosPorEstado();
  
  return (
    <div className="h-screen flex flex-col bg-slate-100">
      {/* Header */}
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/dashboard/proyectos-actualizacion')}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="font-semibold text-slate-800 text-sm md:text-base truncate max-w-[200px] md:max-w-none">
              {proyecto.nombre}
            </h1>
            <p className="text-xs text-slate-500">{proyecto.municipio}</p>
          </div>
        </div>
        
        {/* GPS Status */}
        <div className="flex items-center gap-2">
          {watchingPosition && gpsAccuracy && (
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
              <Crosshair className="w-3 h-3 mr-1" />
              {Math.round(gpsAccuracy)}m
            </Badge>
          )}
          <Button
            variant={watchingPosition ? "default" : "outline"}
            size="sm"
            onClick={watchingPosition ? stopWatchingPosition : startWatchingPosition}
            className={watchingPosition ? "bg-blue-600 hover:bg-blue-700" : ""}
          >
            <Navigation className={`w-4 h-4 ${watchingPosition ? 'animate-pulse' : ''}`} />
          </Button>
        </div>
      </div>
      
      {/* Search Bar */}
      <div className="bg-white border-b px-4 py-2 flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar por código predial..."
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch} size="sm">
          <Search className="w-4 h-4" />
        </Button>
      </div>
      
      {/* Estadísticas rápidas */}
      <div className="bg-white border-b px-4 py-2 flex gap-4 text-xs overflow-x-auto">
        <div className="flex items-center gap-1 whitespace-nowrap">
          <Square className="w-3 h-3 text-slate-400" />
          <span>Pendientes: {estadisticas.pendientes}</span>
        </div>
        <div className="flex items-center gap-1 whitespace-nowrap">
          <Eye className="w-3 h-3 text-amber-500" />
          <span>Visitados: {estadisticas.visitados}</span>
        </div>
        <div className="flex items-center gap-1 whitespace-nowrap">
          <CheckSquare className="w-3 h-3 text-purple-500" />
          <span>Actualizados: {estadisticas.actualizados}</span>
        </div>
      </div>
      
      {/* Map Container */}
      <div className="flex-1 relative">
        <MapContainer
          center={mapCenter}
          zoom={currentZoom}
          className="h-full w-full"
          ref={mapRef}
          zoomControl={false}
        >
          <MapController
            onLocationFound={(latlng) => setUserPosition([latlng.lat, latlng.lng])}
            setCurrentZoom={setCurrentZoom}
            flyToPosition={flyToPosition}
          />
          
          <SmartTileLayer mapType={mapType} tileLayers={tileLayers} />
          
          {/* Ortofoto - debajo de GDB pero encima del mapa base */}
          {ortofotoUrl && ortofotoBounds && showOrtofoto && (
            <ImageOverlay
              url={ortofotoUrl}
              bounds={ortofotoBounds}
              opacity={ortofotoOpacity}
              zIndex={100}
            />
          )}
          
          {geometriasFiltradas && (
            <GeoJSON
              key={`geom-${filterZona}-${filterEstado}-${selectedGeometry?.properties?.codigo_predial}-${JSON.stringify(estadisticas)}`}
              data={geometriasFiltradas}
              style={getGeometryStyle}
              onEachFeature={onEachFeature}
            />
          )}
          
          {construcciones && (
            <GeoJSON
              data={construcciones}
              style={{
                fillColor: '#ef4444',
                weight: 1,
                color: '#991b1b',
                fillOpacity: 0.4
              }}
            />
          )}
          
          {userPosition && (
            <Marker position={userPosition} icon={userLocationIcon} />
          )}
          
          {userPosition && gpsAccuracy && (
            <CircleMarker
              center={userPosition}
              radius={Math.min(gpsAccuracy / 2, 50)}
              pathOptions={{
                color: '#3b82f6',
                fillColor: '#3b82f6',
                fillOpacity: 0.1,
                weight: 1
              }}
            />
          )}
        </MapContainer>
        
        {/* Controles flotantes */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-[1000]">
          <div className="bg-white rounded-lg shadow-lg p-1 flex flex-col gap-1">
            <Button
              variant={mapType === 'satellite' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMapType('satellite')}
              className="w-9 h-9 p-0"
              title="Satélite"
            >
              <Satellite className="w-4 h-4" />
            </Button>
            <Button
              variant={mapType === 'street' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMapType('street')}
              className="w-9 h-9 p-0"
              title="Mapa"
            >
              <MapIcon className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Botón Zoom a GDB */}
          <Button
            variant="outline"
            size="sm"
            onClick={zoomToGDBLayer}
            className="w-9 h-9 p-0 bg-white shadow-lg"
            disabled={!geometrias?.features?.length}
            title="Ir a las geometrías GDB"
          >
            <Navigation className="w-4 h-4 text-emerald-600" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={centerOnUser}
            className="w-9 h-9 p-0 bg-white shadow-lg"
            disabled={!userPosition}
            title="Mi ubicación GPS"
          >
            <Locate className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Panel Ortofoto */}
        <div className="absolute top-4 right-16 z-[1000]">
          <div className="bg-white rounded-lg shadow-lg p-2 min-w-[140px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-700">Ortofoto</span>
              {ortofotoUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setShowOrtofoto(!showOrtofoto)}
                  title={showOrtofoto ? 'Ocultar' : 'Mostrar'}
                >
                  <Eye className={`w-3 h-3 ${showOrtofoto ? 'text-emerald-600' : 'text-slate-400'}`} />
                </Button>
              )}
            </div>
            
            {ortofotoUrl ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={ortofotoOpacity * 100}
                    onChange={(e) => setOrtofotoOpacity(e.target.value / 100)}
                    className="w-full h-1"
                    title="Opacidad"
                  />
                  <span className="text-[10px] text-slate-500 w-8">{Math.round(ortofotoOpacity * 100)}%</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-7 text-xs"
                  onClick={() => ortofotoInputRef.current?.click()}
                >
                  Cambiar
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs"
                onClick={() => ortofotoInputRef.current?.click()}
                disabled={uploadingOrtofoto}
              >
                {uploadingOrtofoto ? (
                  <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                ) : (
                  <Image className="w-3 h-3 mr-1" />
                )}
                {uploadingOrtofoto ? 'Subiendo...' : 'Subir Ortofoto'}
              </Button>
            )}
            
            <input
              ref={ortofotoInputRef}
              type="file"
              accept=".tif,.tiff,.png,.jpg,.jpeg"
              className="hidden"
              onChange={handleOrtofotoUpload}
            />
          </div>
        </div>
        
        {/* Filtros: Zona y Estado */}
        <div className="absolute top-4 left-4 z-[1000] flex gap-2">
          <Select value={filterZona} onValueChange={setFilterZona}>
            <SelectTrigger className="w-28 bg-white shadow-lg text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas zonas</SelectItem>
              <SelectItem value="urbano">Urbano</SelectItem>
              <SelectItem value="rural">Rural</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={filterEstado} onValueChange={setFilterEstado}>
            <SelectTrigger className="w-32 bg-white shadow-lg text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                  Todos estados
                </span>
              </SelectItem>
              <SelectItem value="pendiente">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                  Pendientes
                </span>
              </SelectItem>
              <SelectItem value="visitado">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Visitados
                </span>
              </SelectItem>
              <SelectItem value="actualizado">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  Actualizados
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Leyenda */}
        <div className="absolute bottom-4 left-4 right-4 z-[1000]">
          <Card className="bg-white/95 backdrop-blur shadow-lg">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-green-500"></div>
                    <span className="text-slate-600">Rural</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-blue-500"></div>
                    <span className="text-slate-600">Urbano</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-amber-500"></div>
                    <span className="text-slate-600">Visitado</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-purple-500"></div>
                    <span className="text-slate-600">Actualizado</span>
                  </div>
                  {ortofotoUrl && (
                    <div className="flex items-center gap-1">
                      <Image className="w-3 h-3 text-indigo-500" />
                      <span className="text-slate-600">Ortofoto</span>
                    </div>
                  )}
                </div>
                <span className="text-slate-400">Zoom: {currentZoom}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Modal de detalle/edición de predio */}
      <Dialog open={showPredioDetail} onOpenChange={(open) => {
        setShowPredioDetail(open);
        if (!open) setEditMode(false);
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Home className="w-5 h-5 text-amber-600" />
                {editMode ? 'Editar Predio' : 'Detalle del Predio'}
              </div>
              {selectedPredio?.estado_visita && (
                <Badge variant={selectedPredio.estado_visita === 'visitado' ? 'warning' : selectedPredio.estado_visita === 'actualizado' ? 'secondary' : 'outline'}>
                  {selectedPredio.estado_visita}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedPredio && (
            <div className="space-y-4">
              {/* Código predial */}
              <div className="bg-amber-50 p-3 rounded-lg">
                <p className="text-xs text-amber-600 uppercase font-medium">Código Predial</p>
                <p className="font-mono text-lg font-bold text-amber-800">
                  {selectedPredio.codigo_predial || selectedPredio.numero_predial || 'N/A'}
                </p>
              </div>
              
              {!editMode ? (
                // Modo visualización (igual que antes pero con tabs de zonas)
                <Tabs defaultValue="general" className="w-full">
                  <TabsList className="grid grid-cols-5 w-full">
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="propietarios">Propietarios</TabsTrigger>
                    <TabsTrigger value="fisico">Físico</TabsTrigger>
                    <TabsTrigger value="propuestas">Propuestas</TabsTrigger>
                    <TabsTrigger value="historial">Historial</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="general" className="space-y-3 mt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <p className="text-xs text-slate-500">Dirección</p>
                        <p className="text-sm font-medium">{selectedPredio.direccion || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Destino Económico</p>
                        <p className="text-sm font-medium">{selectedPredio.destino_economico || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Avalúo Catastral</p>
                        <p className="text-sm font-medium">
                          {selectedPredio.avaluo_catastral ? `$${Number(selectedPredio.avaluo_catastral).toLocaleString()}` : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Área Terreno</p>
                        <p className="text-sm font-medium">
                          {selectedPredio.area_terreno ? `${Number(selectedPredio.area_terreno).toLocaleString()} m²` : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Área Construida</p>
                        <p className="text-sm font-medium">
                          {selectedPredio.area_construida ? `${Number(selectedPredio.area_construida).toLocaleString()} m²` : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Matrícula Inmobiliaria</p>
                        <p className="text-sm font-medium">{selectedPredio.matricula_inmobiliaria || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Estrato</p>
                        <p className="text-sm font-medium">{selectedPredio.estrato || '-'}</p>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="propietarios" className="mt-3">
                    {selectedPredio.propietarios?.length > 0 ? (
                      <div className="space-y-2">
                        {selectedPredio.propietarios.map((prop, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border">
                            <User className="w-5 h-5 text-slate-400 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-slate-800">{prop.nombre || 'Sin nombre'}</p>
                              <div className="grid grid-cols-2 gap-2 mt-1 text-xs text-slate-500">
                                <span>Doc: {prop.tipo_documento || prop.tipo_doc || ''} {prop.documento || prop.numero_documento || '-'}</span>
                                {prop.estado_civil && <span>Estado civil: {prop.estado_civil}</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        <p className="text-sm text-slate-500">Sin información de propietarios</p>
                        <p className="text-xs text-slate-400">Use "Editar" para agregar propietarios</p>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="fisico" className="mt-3">
                    {selectedPredio.zonas_fisicas?.length > 0 ? (
                      <div className="space-y-2">
                        {selectedPredio.zonas_fisicas.map((zona, idx) => (
                          <div key={idx} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <p className="text-xs font-semibold text-blue-700 mb-2">Zona Física {idx + 1}</p>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <span className="text-slate-500">Zona Física:</span>
                                <span className="ml-1 font-medium">{zona.zona_fisica}</span>
                              </div>
                              <div>
                                <span className="text-slate-500">Zona Económica:</span>
                                <span className="ml-1 font-medium">{zona.zona_economica}</span>
                              </div>
                              <div>
                                <span className="text-slate-500">Área:</span>
                                <span className="ml-1 font-medium">{zona.area_terreno} m²</span>
                              </div>
                              <div>
                                <span className="text-slate-500">Habitaciones:</span>
                                <span className="ml-1 font-medium">{zona.habitaciones}</span>
                              </div>
                              <div>
                                <span className="text-slate-500">Baños:</span>
                                <span className="ml-1 font-medium">{zona.banos}</span>
                              </div>
                              <div>
                                <span className="text-slate-500">Pisos:</span>
                                <span className="ml-1 font-medium">{zona.pisos}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <Database className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        <p className="text-sm text-slate-500">Sin información de zonas físicas</p>
                        <p className="text-xs text-slate-400">Use "Editar" para agregar zonas</p>
                      </div>
                    )}
                  </TabsContent>
                  
                  {/* Tab Propuestas de Cambio */}
                  <TabsContent value="propuestas" className="mt-3 space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-semibold text-slate-700">Propuestas de Cambio</h4>
                      {selectedPredio.estado_visita === 'visitado' && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            cargarDatosParaEdicion(selectedPredio);
                            setShowPropuestaModal(true);
                          }}
                          className="text-emerald-700 border-emerald-500"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Nueva Propuesta
                        </Button>
                      )}
                    </div>
                    
                    {selectedPredio.estado_visita !== 'visitado' && selectedPredio.estado_visita !== 'actualizado' && (
                      <div className="bg-amber-50 text-amber-700 p-3 rounded-lg text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        El predio debe estar visitado para proponer cambios
                      </div>
                    )}
                    
                    {propuestas.length > 0 ? (
                      <div className="space-y-2">
                        {propuestas.map((prop) => (
                          <div key={prop.id} className={`p-3 rounded-lg border ${
                            prop.estado === 'aprobada' ? 'bg-emerald-50 border-emerald-200' :
                            prop.estado === 'rechazada' ? 'bg-red-50 border-red-200' :
                            'bg-amber-50 border-amber-200'
                          }`}>
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant={prop.estado === 'aprobada' ? 'secondary' : prop.estado === 'rechazada' ? 'destructive' : 'outline'}>
                                    {prop.estado === 'aprobada' && <Check className="w-3 h-3 mr-1" />}
                                    {prop.estado === 'rechazada' && <XCircle className="w-3 h-3 mr-1" />}
                                    {prop.estado}
                                  </Badge>
                                  <span className="text-xs text-slate-500">
                                    {new Date(prop.creado_en).toLocaleDateString('es-CO')}
                                  </span>
                                </div>
                                <p className="text-sm mt-1">{prop.justificacion}</p>
                                <p className="text-xs text-slate-500 mt-1">Por: {prop.creado_por}</p>
                                {prop.comentario_revision && (
                                  <p className="text-xs text-slate-600 mt-1 italic">
                                    Comentario: {prop.comentario_revision}
                                  </p>
                                )}
                              </div>
                              <GitCompare className="w-4 h-4 text-slate-400" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <GitCompare className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        <p className="text-sm text-slate-500">Sin propuestas de cambio</p>
                      </div>
                    )}
                  </TabsContent>
                  
                  {/* Tab Historial */}
                  <TabsContent value="historial" className="mt-3 space-y-3">
                    <h4 className="text-sm font-semibold text-slate-700">Historial de Cambios</h4>
                    
                    {historial.length > 0 ? (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {historial.map((entry, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-2 bg-slate-50 rounded text-sm">
                            <div className={`w-2 h-2 rounded-full mt-1.5 ${
                              entry.accion === 'visita' ? 'bg-blue-500' :
                              entry.accion === 'propuesta_aprobada' ? 'bg-emerald-500' :
                              entry.accion === 'propuesta_rechazada' ? 'bg-red-500' :
                              'bg-amber-500'
                            }`} />
                            <div className="flex-1">
                              <p className="font-medium text-slate-700">
                                {entry.accion === 'visita' && 'Predio visitado'}
                                {entry.accion === 'actualizacion' && 'Datos actualizados'}
                                {entry.accion === 'propuesta_creada' && 'Propuesta creada'}
                                {entry.accion === 'propuesta_aprobada' && 'Propuesta aprobada'}
                                {entry.accion === 'propuesta_rechazada' && 'Propuesta rechazada'}
                              </p>
                              <p className="text-xs text-slate-500">
                                {entry.usuario} • {new Date(entry.fecha).toLocaleString('es-CO')}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <History className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        <p className="text-sm text-slate-500">Sin historial de cambios</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              ) : (
                // Modo edición - Con Tabs igual que Conservación
                <Tabs defaultValue="propietarios" className="w-full min-h-[300px]">
                  <TabsList className="grid grid-cols-3 w-full">
                    <TabsTrigger value="propietarios">Propietarios</TabsTrigger>
                    <TabsTrigger value="predio">Predio</TabsTrigger>
                    <TabsTrigger value="fisico">Zonas Físicas</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="propietarios" className="space-y-4 mt-4">
                    {/* Sección de Propietarios - Múltiples */}
                    <div className="flex justify-between items-center">
                      <h4 className="font-semibold text-slate-800">Propietarios ({propietarios.length})</h4>
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
                          <div className="col-span-2">
                            <Label className="text-xs">Nombre Completo *</Label>
                            <Input 
                              value={prop.nombre} 
                              onChange={(e) => actualizarPropietario(index, 'nombre', e.target.value.toUpperCase())}
                              placeholder="NOMBRE COMPLETO DEL PROPIETARIO"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Tipo Documento</Label>
                            <Select value={prop.tipo_documento} onValueChange={(v) => actualizarPropietario(index, 'tipo_documento', v)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="C">C - Cédula</SelectItem>
                                <SelectItem value="E">E - Cédula Extranjería</SelectItem>
                                <SelectItem value="N">N - NIT</SelectItem>
                                <SelectItem value="T">T - Tarjeta Identidad</SelectItem>
                                <SelectItem value="P">P - Pasaporte</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Número Documento</Label>
                            <Input 
                              value={prop.documento} 
                              onChange={(e) => actualizarPropietario(index, 'documento', e.target.value)}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Estado Civil</Label>
                            <Select value={prop.estado_civil || "none"} onValueChange={(v) => actualizarPropietario(index, 'estado_civil', v === "none" ? "" : v)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccione..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Sin especificar</SelectItem>
                                <SelectItem value="S">Soltero(a)</SelectItem>
                                <SelectItem value="C">Casado(a)</SelectItem>
                                <SelectItem value="U">Unión libre</SelectItem>
                                <SelectItem value="V">Viudo(a)</SelectItem>
                                <SelectItem value="D">Divorciado(a)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </TabsContent>
                  
                  <TabsContent value="predio" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <Label>Dirección</Label>
                        <Input
                          value={editData.direccion}
                          onChange={(e) => setEditData(prev => ({ ...prev, direccion: e.target.value.toUpperCase() }))}
                          placeholder="Dirección del predio"
                        />
                      </div>
                      <div>
                        <Label>Destino Económico</Label>
                        <Select 
                          value={editData.destino_economico} 
                          onValueChange={(v) => setEditData(prev => ({ ...prev, destino_economico: v }))}
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
                            <SelectItem value="P">P - Uso público</SelectItem>
                            <SelectItem value="Q">Q - Servicios</SelectItem>
                            <SelectItem value="R">R - Lote urbanizado</SelectItem>
                            <SelectItem value="S">S - Lote no urbanizable</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Matrícula Inmobiliaria</Label>
                        <Input
                          value={editData.matricula_inmobiliaria || ''}
                          onChange={(e) => setEditData(prev => ({ ...prev, matricula_inmobiliaria: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Área Terreno (m²)</Label>
                        <Input
                          type="number"
                          value={editData.area_terreno}
                          onChange={(e) => setEditData(prev => ({ ...prev, area_terreno: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Área Construida (m²)</Label>
                        <Input
                          type="number"
                          value={editData.area_construida}
                          onChange={(e) => setEditData(prev => ({ ...prev, area_construida: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Avalúo Catastral (COP)</Label>
                        <Input
                          type="number"
                          value={editData.avaluo_catastral || ''}
                          onChange={(e) => setEditData(prev => ({ ...prev, avaluo_catastral: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Estrato</Label>
                        <Select 
                          value={editData.estrato || 'none'} 
                          onValueChange={(v) => setEditData(prev => ({ ...prev, estrato: v === 'none' ? '' : v }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin estrato</SelectItem>
                            <SelectItem value="1">1</SelectItem>
                            <SelectItem value="2">2</SelectItem>
                            <SelectItem value="3">3</SelectItem>
                            <SelectItem value="4">4</SelectItem>
                            <SelectItem value="5">5</SelectItem>
                            <SelectItem value="6">6</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {userPosition && (
                      <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 p-2 rounded">
                        <MapPin className="w-3 h-3" />
                        Ubicación GPS actual será guardada: {userPosition[0].toFixed(6)}, {userPosition[1].toFixed(6)}
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="fisico" className="space-y-4 mt-4">
                    {/* Sección de Zonas Físicas - Múltiples */}
                    <div className="flex justify-between items-center">
                      <h4 className="font-semibold text-slate-800">Zonas Físicas (R2)</h4>
                      <Button type="button" variant="outline" size="sm" onClick={agregarZonaFisica} className="text-emerald-700">
                        <Plus className="w-4 h-4 mr-1" /> Agregar Zona
                      </Button>
                    </div>
                    
                    {zonasFisicas.map((zona, index) => (
                      <div key={index} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-sm font-medium text-slate-700">Zona Física {index + 1}</span>
                          {zonasFisicas.length > 1 && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => eliminarZonaFisica(index)} className="text-red-600 hover:text-red-700">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs">Zona Física</Label>
                            <Input type="number" value={zona.zona_fisica} onChange={(e) => actualizarZonaFisica(index, 'zona_fisica', e.target.value)} />
                          </div>
                          <div>
                            <Label className="text-xs">Zona Económica</Label>
                            <Input type="number" value={zona.zona_economica} onChange={(e) => actualizarZonaFisica(index, 'zona_economica', e.target.value)} />
                          </div>
                          <div>
                            <Label className="text-xs">Área Terreno (m²)</Label>
                            <Input type="number" value={zona.area_terreno} onChange={(e) => actualizarZonaFisica(index, 'area_terreno', e.target.value)} />
                          </div>
                          <div>
                            <Label className="text-xs">Habitaciones</Label>
                            <Input type="number" value={zona.habitaciones} onChange={(e) => actualizarZonaFisica(index, 'habitaciones', e.target.value)} />
                          </div>
                          <div>
                            <Label className="text-xs">Baños</Label>
                            <Input type="number" value={zona.banos} onChange={(e) => actualizarZonaFisica(index, 'banos', e.target.value)} />
                          </div>
                          <div>
                            <Label className="text-xs">Locales</Label>
                            <Input type="number" value={zona.locales} onChange={(e) => actualizarZonaFisica(index, 'locales', e.target.value)} />
                          </div>
                          <div>
                            <Label className="text-xs">Pisos</Label>
                            <Input type="number" value={zona.pisos} onChange={(e) => actualizarZonaFisica(index, 'pisos', e.target.value)} />
                          </div>
                          <div>
                            <Label className="text-xs">Puntaje</Label>
                            <Input type="number" value={zona.puntaje} onChange={(e) => actualizarZonaFisica(index, 'puntaje', e.target.value)} />
                          </div>
                          <div>
                            <Label className="text-xs">Área Construida (m²)</Label>
                            <Input type="number" value={zona.area_construida} onChange={(e) => actualizarZonaFisica(index, 'area_construida', e.target.value)} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>
              )}
              
              <DialogFooter className="flex flex-wrap gap-2 pt-4">
                {!editMode ? (
                  <>
                    {/* Botón Generar PDF - Solo si está visitado */}
                    {(selectedPredio.estado_visita === 'visitado' || selectedPredio.estado_visita === 'actualizado') && (
                      <Button 
                        variant="outline" 
                        onClick={handleGenerarPdf}
                        disabled={generandoPdf}
                        className="border-blue-500 text-blue-700 hover:bg-blue-50"
                      >
                        {generandoPdf ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <FileDown className="w-4 h-4 mr-2" />}
                        Generar PDF
                      </Button>
                    )}
                    
                    {/* Botón Formato de Visita - Solo si NO está visitado */}
                    {selectedPredio.estado_visita !== 'visitado' && selectedPredio.estado_visita !== 'actualizado' && (
                      <Button 
                        variant="outline" 
                        onClick={abrirFormatoVisita}
                        disabled={saving}
                        className="flex-1 border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Formato de Visita
                      </Button>
                    )}
                    
                    <Button 
                      onClick={() => {
                        cargarDatosParaEdicion(selectedPredio);
                        setEditMode(true);
                      }}
                      className="flex-1 bg-amber-600 hover:bg-amber-700"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Editar
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      variant="outline" 
                      onClick={() => setEditMode(false)}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleSaveChanges}
                      disabled={saving}
                      className={`flex-1 ${
                        user?.role === 'coordinador' || user?.role === 'administrador'
                          ? 'bg-emerald-600 hover:bg-emerald-700'
                          : 'bg-amber-600 hover:bg-amber-700'
                      }`}
                    >
                      {saving ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : user?.role === 'coordinador' || user?.role === 'administrador' ? (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Guardar Cambios
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Enviar Propuesta
                        </>
                      )}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Modal de Formato de Visita */}
      <Dialog open={showVisitaModal} onOpenChange={setShowVisitaModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              Formato de Visita de Campo
            </DialogTitle>
          </DialogHeader>
          
          {selectedPredio && (
            <div className="space-y-6">
              {/* Código predial */}
              <div className="bg-amber-50 p-3 rounded-lg">
                <p className="text-xs text-amber-600 uppercase font-medium">Predio</p>
                <p className="font-mono text-sm font-bold text-amber-800">
                  {selectedPredio.codigo_predial || selectedPredio.numero_predial}
                </p>
                <p className="text-xs text-slate-600 mt-1">{selectedPredio.direccion || 'Sin dirección'}</p>
              </div>
              
              {/* Fecha y hora */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Fecha de Visita</Label>
                  <Input
                    type="date"
                    value={visitaData.fecha_visita}
                    onChange={(e) => setVisitaData(prev => ({ ...prev, fecha_visita: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Hora</Label>
                  <Input
                    type="time"
                    value={visitaData.hora_visita}
                    onChange={(e) => setVisitaData(prev => ({ ...prev, hora_visita: e.target.value }))}
                  />
                </div>
              </div>
              
              {/* Persona que atiende */}
              <div>
                <Label>Persona que Atiende la Visita *</Label>
                <Input
                  placeholder="Nombre completo de quien atiende"
                  value={visitaData.persona_atiende}
                  onChange={(e) => setVisitaData(prev => ({ ...prev, persona_atiende: e.target.value }))}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Relación con el Predio</Label>
                  <Select 
                    value={visitaData.relacion_predio}
                    onValueChange={(v) => setVisitaData(prev => ({ ...prev, relacion_predio: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="propietario">Propietario</SelectItem>
                      <SelectItem value="poseedor">Poseedor</SelectItem>
                      <SelectItem value="arrendatario">Arrendatario</SelectItem>
                      <SelectItem value="familiar">Familiar</SelectItem>
                      <SelectItem value="encargado">Encargado</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>¿Se pudo acceder al predio?</Label>
                  <Select 
                    value={visitaData.acceso_predio}
                    onValueChange={(v) => setVisitaData(prev => ({ ...prev, acceso_predio: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="si">Sí, acceso total</SelectItem>
                      <SelectItem value="parcial">Acceso parcial</SelectItem>
                      <SelectItem value="no">No se pudo acceder</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Estado del predio */}
              <div>
                <Label>Estado del Predio</Label>
                <Select 
                  value={visitaData.estado_predio}
                  onValueChange={(v) => setVisitaData(prev => ({ ...prev, estado_predio: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="habitado">Habitado</SelectItem>
                    <SelectItem value="deshabitado">Deshabitado</SelectItem>
                    <SelectItem value="en_construccion">En construcción</SelectItem>
                    <SelectItem value="abandonado">Abandonado</SelectItem>
                    <SelectItem value="lote_vacio">Lote vacío</SelectItem>
                    <SelectItem value="uso_comercial">Uso comercial</SelectItem>
                    <SelectItem value="uso_mixto">Uso mixto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Servicios públicos */}
              <div>
                <Label className="mb-2 block">Servicios Públicos</Label>
                <div className="grid grid-cols-3 gap-2">
                  {['Agua', 'Alcantarillado', 'Energía', 'Gas', 'Internet', 'Teléfono'].map((servicio) => (
                    <label key={servicio} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={visitaData.servicios_publicos.includes(servicio)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setVisitaData(prev => ({ 
                              ...prev, 
                              servicios_publicos: [...prev.servicios_publicos, servicio] 
                            }));
                          } else {
                            setVisitaData(prev => ({ 
                              ...prev, 
                              servicios_publicos: prev.servicios_publicos.filter(s => s !== servicio) 
                            }));
                          }
                        }}
                        className="rounded border-slate-300"
                      />
                      <span className="text-sm">{servicio}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              {/* Observaciones */}
              <div>
                <Label>Observaciones de la Visita</Label>
                <Textarea
                  value={visitaData.observaciones}
                  onChange={(e) => setVisitaData(prev => ({ ...prev, observaciones: e.target.value }))}
                  placeholder="Escriba las observaciones de la visita..."
                  rows={3}
                />
              </div>
              
              {/* Fotos */}
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Camera className="w-4 h-4" />
                  Fotografías del Predio
                </Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={handleFotoChange}
                  className="hidden"
                />
                <div className="flex flex-wrap gap-2 mb-2">
                  {fotos.map((foto) => (
                    <div key={foto.id} className="relative">
                      <img 
                        src={foto.data} 
                        alt={foto.nombre}
                        className="w-20 h-20 object-cover rounded border"
                      />
                      <button
                        onClick={() => eliminarFoto(foto.id)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <Button 
                  type="button"
                  variant="outline"
                  onClick={handleCapturarFoto}
                  className="w-full border-dashed"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  {fotos.length > 0 ? 'Agregar más fotos' : 'Tomar / Seleccionar Fotos'}
                </Button>
              </div>
              
              {/* Firma Digital */}
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Pen className="w-4 h-4" />
                  Firma de la Persona que Atiende *
                </Label>
                <div className="border-2 border-slate-300 rounded-lg bg-white">
                  <canvas
                    ref={canvasRef}
                    width={500}
                    height={150}
                    className="w-full touch-none cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    style={{ backgroundColor: '#ffffff' }}
                  />
                </div>
                <Button 
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={limpiarFirma}
                  className="mt-1 text-slate-500"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Limpiar firma
                </Button>
              </div>
              
              {/* GPS */}
              {userPosition && (
                <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 p-2 rounded">
                  <MapPin className="w-3 h-3" />
                  Ubicación GPS registrada: {userPosition[0].toFixed(6)}, {userPosition[1].toFixed(6)}
                  {gpsAccuracy && ` (±${Math.round(gpsAccuracy)}m)`}
                </div>
              )}
              
              <DialogFooter className="flex gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowVisitaModal(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleGuardarVisita}
                  disabled={saving || !visitaData.persona_atiende.trim()}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Guardar Visita
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Modal de Propuesta de Cambio */}
      <Dialog open={showPropuestaModal} onOpenChange={setShowPropuestaModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-emerald-600" />
              Propuesta de Cambio
            </DialogTitle>
          </DialogHeader>
          
          {selectedPredio && (
            <div className="space-y-4">
              {/* Código predial */}
              <div className="bg-amber-50 p-3 rounded-lg">
                <p className="text-xs text-amber-600 uppercase font-medium">Predio</p>
                <p className="font-mono text-sm font-bold text-amber-800">
                  {selectedPredio.codigo_predial || selectedPredio.numero_predial}
                </p>
              </div>
              
              {/* Comparativa de datos */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-lg">
                  <h4 className="font-semibold text-slate-700 mb-2">Datos Existentes</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-slate-500">Dirección:</span> {selectedPredio.direccion || '-'}</div>
                    <div><span className="text-slate-500">Destino:</span> {selectedPredio.destino_economico || '-'}</div>
                    <div><span className="text-slate-500">Área Terreno:</span> {selectedPredio.area_terreno || '-'} m²</div>
                    <div><span className="text-slate-500">Área Construida:</span> {selectedPredio.area_construida || '-'} m²</div>
                    <div><span className="text-slate-500">Propietarios:</span> {selectedPredio.propietarios?.length || 0}</div>
                  </div>
                </div>
                
                <div className="bg-emerald-50 p-3 rounded-lg">
                  <h4 className="font-semibold text-emerald-700 mb-2">Propuesta de Cambio</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-slate-500">Dirección:</span> {editData.direccion || '-'}</div>
                    <div><span className="text-slate-500">Destino:</span> {editData.destino_economico || '-'}</div>
                    <div><span className="text-slate-500">Área Terreno:</span> {editData.area_terreno || '-'} m²</div>
                    <div><span className="text-slate-500">Área Construida:</span> {editData.area_construida || '-'} m²</div>
                    <div><span className="text-slate-500">Propietarios:</span> {propietarios.filter(p => p.nombre).length}</div>
                  </div>
                </div>
              </div>
              
              {/* Formulario de edición rápida */}
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold text-slate-700 mb-3">Modificar Datos Propuestos</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Dirección</Label>
                    <Input
                      value={editData.direccion}
                      onChange={(e) => setEditData(prev => ({ ...prev, direccion: e.target.value.toUpperCase() }))}
                    />
                  </div>
                  <div>
                    <Label>Destino Económico</Label>
                    <Select 
                      value={editData.destino_economico} 
                      onValueChange={(v) => setEditData(prev => ({ ...prev, destino_economico: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">A - Habitacional</SelectItem>
                        <SelectItem value="B">B - Industrial</SelectItem>
                        <SelectItem value="C">C - Comercial</SelectItem>
                        <SelectItem value="D">D - Agropecuario</SelectItem>
                        <SelectItem value="I">I - Institucional</SelectItem>
                        <SelectItem value="R">R - Lote urbanizado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Área Terreno (m²)</Label>
                    <Input
                      type="number"
                      value={editData.area_terreno}
                      onChange={(e) => setEditData(prev => ({ ...prev, area_terreno: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Área Construida (m²)</Label>
                    <Input
                      type="number"
                      value={editData.area_construida}
                      onChange={(e) => setEditData(prev => ({ ...prev, area_construida: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              
              {/* Justificación */}
              <div>
                <Label>Justificación del Cambio *</Label>
                <Textarea
                  value={propuestaData.justificacion}
                  onChange={(e) => setPropuestaData(prev => ({ ...prev, justificacion: e.target.value }))}
                  placeholder="Describa por qué propone estos cambios..."
                  rows={3}
                />
              </div>
              
              <div className="bg-amber-50 text-amber-700 p-3 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Esta propuesta será enviada al coordinador para su aprobación
              </div>
              
              <DialogFooter className="flex gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowPropuestaModal(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleCrearPropuesta}
                  disabled={saving || !propuestaData.justificacion.trim()}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                  Enviar Propuesta
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
