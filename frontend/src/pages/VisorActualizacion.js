import React, { useEffect, useState, useRef, useCallback, useMemo, memo, startTransition } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, GeoJSON, Marker, CircleMarker, useMap, useMapEvents, ImageOverlay } from 'react-leaflet';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Offline sync
import useOfflineSync from '../hooks/useOfflineSync';
import { 
  getProyectoOffline, 
  getGeometriasOffline, 
  saveProyectoOffline, 
  saveGeometriasOffline, 
  getPrediosOffline, 
  savePrediosOffline,
  initOfflineDB,
  getOfflineStats,
  saveCambioPendiente,
  getCambiosPendientes
} from '../utils/offlineDB';

// Componentes optimizados
import FirmaCanvas from '../components/FirmaCanvas';
import ListaPrediosPaginada from '../components/ListaPrediosPaginada';
import DebouncedInput from '../components/DebouncedInput';

// Componentes de Actualización
import CrearPredioNuevoModal from '../components/actualizacion/CrearPredioNuevoModal';
import FinalizarProyectoModal from '../components/actualizacion/FinalizarProyectoModal';
import DetallePredioActualizacion from '../components/actualizacion/DetallePredioActualizacion';
// FormularioVisitaModal no se usa - se usa el formulario original (showVisitaModal)

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
  DialogDescription,
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
  CheckCircle2,
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
  Image as ImageIcon,
  History,
  GitCompare,
  Check,
  XCircle,
  Download,
  FileDown,
  Send,
  ListTodo,
  Building,
  Mail,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Scale,
  Loader2,
  Building2,
  FileCheck,
  ClipboardList,
  RefreshCcw
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Helper para formatear áreas: "X ha X.XXX m²"
const formatearArea = (m2) => {
  if (!m2 || isNaN(parseFloat(m2))) return '-';
  const metros = parseFloat(m2);
  const hectareas = metros / 10000;
  if (hectareas >= 1) {
    return `${hectareas.toFixed(2)} ha ${metros.toLocaleString('es-CO', { maximumFractionDigits: 2 })} m²`;
  } else {
    return `${hectareas.toFixed(4)} ha ${metros.toLocaleString('es-CO', { maximumFractionDigits: 2 })} m²`;
  }
};

// Componente para manejar eventos del mapa y ubicación GPS
function MapController({ onLocationFound, setCurrentZoom, flyToPosition, fitToBounds, onMapReady }) {
  const map = useMap();
  const [mapIsReady, setMapIsReady] = useState(false);
  
  // Notificar cuando el mapa está listo
  useEffect(() => {
    if (map) {
      // Esperar un poco para asegurar que el mapa esté completamente inicializado
      const timer = setTimeout(() => {
        setMapIsReady(true);
        if (onMapReady) {
          onMapReady(map);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [map, onMapReady]);
  
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
  
  // Ajustar a los bounds cuando se proporcionen Y el mapa esté listo
  useEffect(() => {
    if (fitToBounds && map && mapIsReady) {
      try {
        console.log('[MapController] Ajustando bounds:', fitToBounds);
        // Validar que los bounds sean un array válido
        if (Array.isArray(fitToBounds) && fitToBounds.length === 2) {
          const [[swLat, swLng], [neLat, neLng]] = fitToBounds;
          console.log(`[MapController] SW: [${swLat}, ${swLng}], NE: [${neLat}, ${neLng}]`);
          
          // Verificar que los valores sean números válidos
          if (isFinite(swLat) && isFinite(swLng) && isFinite(neLat) && isFinite(neLng)) {
            map.fitBounds(fitToBounds, { padding: [50, 50], maxZoom: 18 });
            console.log('[MapController] fitBounds ejecutado correctamente');
          } else {
            console.error('[MapController] Bounds contienen valores no válidos');
          }
        } else {
          console.error('[MapController] Formato de bounds inválido:', fitToBounds);
        }
      } catch (error) {
        console.error('[MapController] Error ajustando bounds:', error);
      }
    }
  }, [fitToBounds, map, mapIsReady]);
  
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
  const location = useLocation();
  
  // Obtener código de predio de la URL (para "Ver en Mapa")
  const searchParams = new URLSearchParams(location.search);
  const codigoFromUrl = searchParams.get('codigo');
  const { user } = useAuth();
  const mapRef = useRef(null);
  
  // Hook de sincronización offline
  const {
    isOnline,
    isSyncing,
    isBackgroundSyncing,
    offlineStats,
    hasOffline,
    lastSync,
    syncProgress,
    pendingChangesCount,
    downloadForOffline,
    downloadFreshData,
    syncPendingChanges,
    saveChangeOffline,
    refreshStats,
    checkInitialSync,
    performFullSync,
    getPrediosOffline: getPrediosFromHook,
    getGeometriasOffline: getGeometriasFromHook
  } = useOfflineSync(proyectoId, 'actualizacion');
  
  // Estado para la pantalla de sincronización inicial
  const [showSyncScreen, setShowSyncScreen] = useState(false);
  
  // Estados del proyecto
  const [proyecto, setProyecto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [geometrias, setGeometrias] = useState(null);
  // geometriasFiltradas ahora es un useMemo
  const [construcciones, setConstrucciones] = useState(null);
  const [construccionesVersion, setConstruccionesVersion] = useState(0); // Para forzar re-render del GeoJSON
  const [prediosR1R2, setPrediosR1R2] = useState([]);
  
  // Estados de descarga offline y progreso
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0, phase: '' });
  const [isDownloading, setIsDownloading] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [loadedFromCache, setLoadedFromCache] = useState(false);
  const [syncHistory, setSyncHistory] = useState([]);
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [backgroundSyncMessage, setBackgroundSyncMessage] = useState(null);
  
  // Estados del mapa
  const [currentZoom, setCurrentZoom] = useState(14);
  const [mapType, setMapType] = useState('satellite');
  const [mapCenter, setMapCenter] = useState([7.8, -72.9]);
  const [fitToBounds, setFitToBounds] = useState(null); // Bounds para ajustar el mapa;
  
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
  
  // Estados para nuevo flujo simplificado
  const [showFormularioVisita, setShowFormularioVisita] = useState(false);
  const [showDetalleSimplificado, setShowDetalleSimplificado] = useState(false);
  const [visitaExistente, setVisitaExistente] = useState(null);
  const [savingVisita, setSavingVisita] = useState(false);
  
  // Modal de confirmación para predio ya visitado
  const [showConfirmRevisita, setShowConfirmRevisita] = useState(false);
  const [predioParaRevisita, setPredioParaRevisita] = useState(null);
  
  // Estados de tipo de revisión
  const [showTipoRevisionModal, setShowTipoRevisionModal] = useState(false);
  const [tipoRevision, setTipoRevision] = useState(null); // 'campo', 'juridico', 'calidad'
  const [predioParaAbrir, setPredioParaAbrir] = useState(null);
  
  // Estados para crear predio nuevo y finalizar proyecto
  const [showCrearPredioModal, setShowCrearPredioModal] = useState(false);
  const [showFinalizarProyectoModal, setShowFinalizarProyectoModal] = useState(false);
  
  // Estados para cancelar predio
  const [showCancelarModal, setShowCancelarModal] = useState(false);
  const [motivoCancelacion, setMotivoCancelacion] = useState('');
  const [cancelando, setCancelando] = useState(false);
  
  // Estados de edición
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  
  // Estados para construcciones (como en Conservación)
  const [tieneConstrucciones, setTieneConstrucciones] = useState(false);
  const [construccionesPredio, setConstruccionesPredio] = useState([]);
  const [mostrarConstruccionesPredio, setMostrarConstruccionesPredio] = useState(false);
  const [cargandoConstrucciones, setCargandoConstrucciones] = useState(false);
  
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
  const [filterEstado, setFilterEstado] = useState('todos'); // todos, pendiente, visitado, actualizado, mejoras
  const [showConstrucciones, setShowConstrucciones] = useState(true); // Toggle para mostrar construcciones
  
  // Estado para mejora seleccionada (para visita de mejora específica)
  const [mejoraSeleccionada, setMejoraSeleccionada] = useState(null);
  const [predioMejoraSeleccionada, setPredioMejoraSeleccionada] = useState(null); // Datos R1/R2 de la mejora
  
  // Estados para formato de visita
  const [showVisitaModal, setShowVisitaModal] = useState(false);
  const [visitaPagina, setVisitaPagina] = useState(1); // Página actual del formulario (1-5)
  const [tipoVisita, setTipoVisita] = useState('terreno'); // 'terreno' o 'mejora'
  const [visitaData, setVisitaDataRaw] = useState({
    // Sección 2: Información Básica
    tipo_predio: '', // PH o NPH (editable)
    direccion_visita: '',
    destino_economico_visita: '',
    area_terreno_visita: '',
    area_construida_visita: '',
    // Sección 3: PH (Propiedad Horizontal)
    ph_area_coeficiente: '',
    ph_area_construida_privada: '',
    ph_area_construida_comun: '',
    ph_copropiedad: '',
    ph_predio_asociado: '',
    ph_torre: '',
    ph_apartamento: '',
    // Sección 4: Condominio
    cond_area_terreno_comun: '',
    cond_area_terreno_privada: '',
    cond_area_construida_privada: '',
    cond_area_construida_comun: '',
    cond_condominio: '',
    cond_predio_asociado: '',
    cond_unidad: '',
    cond_casa: '',
    // Sección 5: Información Jurídica
    jur_matricula: '',
    jur_tipo_doc: '',
    jur_numero_doc: '',
    jur_notaria: '',
    jur_fecha: '',
    jur_ciudad: '',
    jur_razon_social: '',
    // Sección 6: Datos de Notificación
    not_telefono: '',
    not_direccion: '',
    not_correo: '',
    not_autoriza_correo: '',
    not_departamento: 'Norte de Santander',
    not_municipio: '',
    not_vereda: '',
    not_corregimiento: '',
    not_datos_adicionales: '',
    // Sección 8: Calificación
    calif_estructura: { armazon: '', muros: '', cubierta: '', conservacion: '' },
    calif_acabados: { fachadas: '', cubrim_muros: '', pisos: '', conservacion: '' },
    calif_bano: { tamano: '', enchape: '', mobiliario: '', conservacion: '' },
    calif_cocina: { tamano: '', enchape: '', mobiliario: '', conservacion: '' },
    calif_industria: { cercha_madera: '', cercha_metalica_liviana: '', cercha_metalica_mediana: '', cercha_metalica_pesada: '', altura: '' },
    calif_generales: { total_pisos: '', total_habitaciones: '', total_banos: '', total_locales: '', area_total_construida: '' },
    // Sección 9: Resumen áreas de terreno
    area_titulo_m2: '',
    area_titulo_ha: '',
    area_titulo_desc: '',
    area_base_catastral_m2: '', // se pre-llena del R1
    area_base_catastral_ha: '',
    area_base_catastral_desc: '',
    area_geografica_m2: '', // se pre-llena del GDB
    area_geografica_ha: '',
    area_geografica_desc: '',
    area_levantamiento_m2: '',
    area_levantamiento_ha: '',
    area_levantamiento_desc: '',
    area_identificacion_m2: '',
    area_identificacion_ha: '',
    area_identificacion_desc: '',
    // Sección 10: Información de Localización (fotos del croquis)
    fotos_croquis: [],
    // Sección 11: Observaciones generales (500 caracteres max)
    observaciones_generales: '',
    // Sección 12: Firmas
    firma_visitado_base64: null,
    firma_reconocedor_base64: null,
    nombre_visitado: '',
    nombre_reconocedor: '',
    // Datos de la visita
    fecha_visita: new Date().toISOString().split('T')[0],
    hora_visita: new Date().toTimeString().slice(0, 5),
    persona_atiende: '',
    relacion_predio: '',
    estado_predio: '',
    acceso_predio: 'si',
    servicios_publicos: [],
    observaciones: '',
    firma_base64: null,
    sin_cambios: false,
    // Sección 11: Coordenadas GPS
    coordenadas_gps: { latitud: '', longitud: '', precision: null, fecha_captura: null }
  });
  
  // Setter optimizado que usa startTransition para evitar bloqueos de UI
  const setVisitaData = useCallback((updater) => {
    startTransition(() => {
      setVisitaDataRaw(updater);
    });
  }, []);
  
  // Canvas refs para las firmas
  const canvasVisitadoRef = useRef(null);
  const canvasReconocedorRef = useRef(null);
  const canvasFirmaModalRef = useRef(null);
  // Modal de firma grande
  const [showFirmaModal, setShowFirmaModal] = useState(false);
  const [firmaModalTipo, setFirmaModalTipo] = useState('visitado'); // 'visitado' o 'reconocedor'
  // Lista de propietarios para el formulario de visita
  const [visitaPropietarios, setVisitaPropietariosRaw] = useState([{
    tipo_documento: '',
    numero_documento: '',
    nombre: '',
    primer_apellido: '',
    segundo_apellido: '',
    estado: '', // Estado civil o E
    genero: '', // masculino, femenino, lgbtq, otro
    genero_otro: '',
    grupo_etnico: ''
  }]);
  
  // Setter optimizado para propietarios
  const setVisitaPropietarios = useCallback((updater) => {
    startTransition(() => {
      setVisitaPropietariosRaw(updater);
    });
  }, []);
  
  // Sección 7: Unidades de Construcción (dinámico, permite agregar más de 5)
  const [visitaConstrucciones, setVisitaConstruccionesRaw] = useState([
    { unidad: 'A', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' },
    { unidad: 'B', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' },
    { unidad: 'C', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' },
    { unidad: 'D', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' },
    { unidad: 'E', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' }
  ]);
  
  // Setter optimizado para construcciones
  const setVisitaConstrucciones = useCallback((updater) => {
    startTransition(() => {
      setVisitaConstruccionesRaw(updater);
    });
  }, []);
  
  // Estado para calificaciones múltiples (sección 8)
  const [visitaCalificaciones, setVisitaCalificacionesRaw] = useState([
    { 
      id: 1,
      estructura: { armazon: '', muros: '', cubierta: '', conservacion: '' },
      acabados: { fachadas: '', cubrim_muros: '', pisos: '', conservacion: '' },
      bano: { tamano: '', enchape: '', mobiliario: '', conservacion: '' },
      cocina: { tamano: '', enchape: '', mobiliario: '', conservacion: '' },
      industria: { cercha_madera: '', cercha_metalica_liviana: '', cercha_metalica_mediana: '', cercha_metalica_pesada: '', altura: '' },
      datos_generales: { total_pisos: '', total_habitaciones: '', total_banos: '', total_locales: '', area_total_construida: '' }
    }
  ]);
  
  // Setter optimizado para calificaciones
  const setVisitaCalificaciones = useCallback((updater) => {
    startTransition(() => {
      setVisitaCalificacionesRaw(updater);
    });
  }, []);
  
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
  
  // Helper para ejecutar función con timeout
  const withTimeout = (promise, timeoutMs, fallbackValue = null) => {
    return Promise.race([
      promise,
      new Promise(resolve => setTimeout(() => resolve(fallbackValue), timeoutMs))
    ]);
  };

  // Cargar datos del proyecto
  const fetchProyecto = useCallback(async () => {
    try {
      // Si está offline, intentar cargar desde IndexedDB primero (con timeout)
      if (!navigator.onLine) {
        console.log('[Offline] Intentando cargar proyecto desde IndexedDB...');
        const proyectoOffline = await withTimeout(getProyectoOffline(proyectoId), 5000, null);
        
        if (proyectoOffline) {
          console.log('[Offline] Proyecto encontrado en IndexedDB:', proyectoOffline.nombre);
          setProyecto(proyectoOffline);
          setLoading(false);
          toast.info('Proyecto cargado desde datos offline');
          
          // Intentar cargar geometrías offline también (con timeout)
          try {
            const geometriasOffline = await withTimeout(getGeometriasOffline(proyectoId), 10000, []);
            if (geometriasOffline && geometriasOffline.length > 0) {
              const geojson = {
                type: 'FeatureCollection',
                features: geometriasOffline.map(g => ({
                  type: g.type || 'Feature',
                  geometry: g.geometry,
                  properties: g.properties
                }))
              };
              setGeometrias(geojson);
              setLoadedFromCache(true);
              setOfflineReady(true);
              
              const bounds = L.geoJSON(geojson).getBounds();
              if (bounds.isValid()) {
                setMapCenter([bounds.getCenter().lat, bounds.getCenter().lng]);
              }
            }
          } catch (geoError) {
            console.log('[Offline] No hay geometrías offline disponibles');
          }
          
          // Intentar cargar predios R1/R2 offline
          try {
            const prediosOffline = await withTimeout(getPrediosOffline(proyectoId), 5000, []);
            if (prediosOffline && prediosOffline.length > 0) {
              setPrediosR1R2(prediosOffline);
              console.log('[Offline] Predios R1/R2 cargados desde offline:', prediosOffline.length);
            }
          } catch (prediosError) {
            console.warn('[Offline] No se pudieron cargar predios R1/R2 offline');
          }
          
          return;
        } else {
          console.log('[Offline] Proyecto NO encontrado en IndexedDB');
          toast.warning('Este proyecto no está disponible offline');
          setLoading(false);
          return;
        }
      }
      
      // Si está online, cargar desde servidor
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/actualizacion/proyectos/${proyectoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProyecto(response.data);
      
      // Guardar proyecto para uso offline (sin bloquear la UI)
      saveProyectoOffline(response.data).then(() => {
        console.log('[Online] Proyecto guardado para uso offline');
      }).catch(saveError => {
        console.warn('No se pudo guardar el proyecto offline:', saveError);
      });
      
      if (response.data.gdb_procesado) {
        fetchGeometrias();
      }
      
      if (response.data.info_alfanumerica_archivo) {
        fetchPrediosR1R2();
      }
      
      // Cargar ortofoto si existe
      fetchOrtofoto();
    } catch (error) {
      console.error('Error al cargar el proyecto:', error);
      
      // Si falla la conexión, intentar cargar desde IndexedDB como fallback (con timeout)
      try {
        console.log('[Fallback] Intentando cargar proyecto desde IndexedDB...');
        const proyectoOffline = await withTimeout(getProyectoOffline(proyectoId), 5000, null);
        
        if (proyectoOffline) {
          setProyecto(proyectoOffline);
          toast.info('Proyecto cargado desde datos offline (sin conexión)');
          
          // Intentar cargar geometrías offline (con timeout)
          const geometriasOffline = await withTimeout(getGeometriasOffline(proyectoId), 10000, []);
          if (geometriasOffline && geometriasOffline.length > 0) {
            const geojson = {
              type: 'FeatureCollection',
              features: geometriasOffline.map(g => ({
                type: g.type || 'Feature',
                geometry: g.geometry,
                properties: g.properties
              }))
            };
            setGeometrias(geojson);
            setLoadedFromCache(true);
          }
          
          // Intentar cargar predios R1/R2 offline
          try {
            const prediosOffline = await withTimeout(getPrediosOffline(proyectoId), 5000, []);
            if (prediosOffline && prediosOffline.length > 0) {
              setPrediosR1R2(prediosOffline);
              console.log('[Offline] Predios R1/R2 cargados desde offline:', prediosOffline.length);
            }
          } catch (prediosError) {
            console.warn('[Offline] No se pudieron cargar predios R1/R2 offline');
          }
        } else {
          toast.error('Proyecto no disponible offline');
        }
      } catch (offlineError) {
        console.error('Error cargando proyecto offline:', offlineError);
        toast.error('Error al cargar el proyecto');
      }
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);
  
  // Cargar geometrías - Primero desde caché, luego del servidor con descarga progresiva
  const fetchGeometrias = async (forceRefresh = false) => {
    try {
      // 1. Primero intentar cargar desde caché (instantáneo)
      if (!forceRefresh) {
        try {
          const cachedGeometrias = await getGeometriasOffline(proyectoId);
          if (cachedGeometrias && cachedGeometrias.length > 0) {
            console.log(`[Cache] Cargando ${cachedGeometrias.length} geometrías desde caché...`);
            const geojson = {
              type: 'FeatureCollection',
              features: cachedGeometrias.map(g => ({
                type: g.type || 'Feature',
                geometry: g.geometry,
                properties: g.properties
              }))
            };
            setGeometrias(geojson);
            setLoadedFromCache(true);
            setOfflineReady(true);
            
            const bounds = L.geoJSON(geojson).getBounds();
            if (bounds.isValid()) {
              setMapCenter([bounds.getCenter().lat, bounds.getCenter().lng]);
            }
            
            toast.success(`${cachedGeometrias.length} geometrías cargadas desde caché`);
            
            // IMPORTANTE: Aunque las geometrías estén en caché, cargar construcciones del servidor
            if (navigator.onLine) {
              try {
                const token = localStorage.getItem('token');
                const constResponse = await axios.get(`${API}/actualizacion/proyectos/${proyectoId}/geometrias`, {
                  headers: { Authorization: `Bearer ${token}` },
                  params: { offset: 0, limit: 1 }, // Solo necesitamos offset=0 para obtener construcciones
                  timeout: 60000
                });
                
                if (constResponse.data.construcciones?.features?.length > 0) {
                  setConstrucciones(constResponse.data.construcciones);
                  console.log(`[Visor] Construcciones cargadas del servidor: ${constResponse.data.construcciones.features.length}`);
                }
              } catch (constError) {
                console.warn('[Visor] Error cargando construcciones:', constError.message);
              }
            }
            
            return; // Ya cargamos geometrías desde caché
          }
        } catch (cacheError) {
          console.log('[Cache] No hay datos en caché, descargando del servidor...');
        }
      }
      
      // 2. Si no hay caché o se forzó refresh, descargar del servidor
      if (!navigator.onLine) {
        toast.warning('Sin conexión - No hay datos en caché para este proyecto');
        return;
      }
      
      setIsDownloading(true);
      setDownloadProgress({ current: 0, total: 0, phase: 'Obteniendo información...' });
      
      const token = localStorage.getItem('token');
      
      // Obtener total de geometrías primero
      const infoResponse = await axios.get(`${API}/actualizacion/proyectos/${proyectoId}/geometrias/info`, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => null);
      
      const totalGeometrias = infoResponse?.data?.total || 0;
      const batchSize = 500; // Descargar en lotes de 500
      
      if (totalGeometrias === 0) {
        // Fallback: descargar todo de una vez (método anterior)
        setDownloadProgress({ current: 0, total: 1, phase: 'Descargando geometrías...' });
        const response = await axios.get(`${API}/actualizacion/proyectos/${proyectoId}/geometrias`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { zona: filterZona !== 'todos' ? filterZona : undefined },
          timeout: 60000 // 60 segundos timeout para evitar errores de JSON truncado
        });
        
        if (response.data?.geometrias?.features?.length > 0) {
          setGeometrias(response.data.geometrias);
          setDownloadProgress({ current: 1, total: 1, phase: 'Guardando en caché...' });
          
          // Guardar en caché
          await saveGeometriasOffline(proyectoId, response.data.geometrias.features);
          setOfflineReady(true);
          
          const bounds = L.geoJSON(response.data.geometrias).getBounds();
          if (bounds.isValid()) {
            setMapCenter([bounds.getCenter().lat, bounds.getCenter().lng]);
          }
          
          toast.success(`${response.data.geometrias.features.length} geometrías descargadas y listas para offline`);
        }
        
        if (response.data.construcciones?.features?.length > 0) {
          setConstrucciones(response.data.construcciones);
        }
      } else {
        // Descarga progresiva por lotes
        const totalBatches = Math.ceil(totalGeometrias / batchSize);
        let allFeatures = [];
        
        for (let batch = 0; batch < totalBatches; batch++) {
          setDownloadProgress({ 
            current: batch * batchSize, 
            total: totalGeometrias, 
            phase: `Descargando geometrías (${Math.min((batch + 1) * batchSize, totalGeometrias)}/${totalGeometrias})...` 
          });
          
          const response = await axios.get(`${API}/actualizacion/proyectos/${proyectoId}/geometrias`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { 
              zona: filterZona !== 'todos' ? filterZona : undefined,
              offset: batch * batchSize,
              limit: batchSize
            },
            timeout: 60000 // 60 segundos timeout
          });
          
          if (response.data.geometrias?.features?.length > 0) {
            allFeatures = [...allFeatures, ...response.data.geometrias.features];
          }
          
          // Capturar construcciones del primer lote (solo vienen con offset=0)
          if (batch === 0) {
            console.log(`[Visor] Respuesta del batch 0:`, {
              construcciones: response.data.construcciones?.features?.length || 0,
              total_construcciones: response.data.total_construcciones || 0
            });
            if (response.data.construcciones?.features?.length > 0) {
              setConstrucciones(response.data.construcciones);
              console.log(`[Visor] ✓ Construcciones cargadas: ${response.data.construcciones.features.length}`);
            } else {
              console.warn(`[Visor] ✗ No se recibieron construcciones en el batch 0`);
            }
          }
          
          // Actualizar UI parcialmente cada 1000 geometrías
          if (allFeatures.length % 1000 === 0 || batch === totalBatches - 1) {
            const partialGeojson = {
              type: 'FeatureCollection',
              features: allFeatures
            };
            setGeometrias(partialGeojson);
          }
        }
        
        // Guardar todo en caché
        setDownloadProgress({ current: totalGeometrias, total: totalGeometrias, phase: 'Guardando en caché local...' });
        await saveGeometriasOffline(proyectoId, allFeatures);
        
        const finalGeojson = {
          type: 'FeatureCollection',
          features: allFeatures
        };
        setGeometrias(finalGeojson);
        setOfflineReady(true);
        
        const bounds = L.geoJSON(finalGeojson).getBounds();
        if (bounds.isValid()) {
          setMapCenter([bounds.getCenter().lat, bounds.getCenter().lng]);
        }
        
        toast.success(`${allFeatures.length} geometrías descargadas - Listo para trabajo offline`);
      }
      
      setIsDownloading(false);
      setDownloadProgress({ current: 0, total: 0, phase: '' });
      
    } catch (error) {
      console.error('Error cargando geometrías:', error);
      setIsDownloading(false);
      
      // Si está offline, intentar cargar desde IndexedDB
      if (!navigator.onLine) {
        try {
          const { geometrias: offlineGeom } = await getOfflineData();
          if (offlineGeom.length > 0) {
            const geojson = {
              type: 'FeatureCollection',
              features: offlineGeom
            };
            setGeometrias(geojson);
            setLoadedFromCache(true);
            toast.info('Geometrías cargadas desde caché offline');
          }
        } catch (offlineError) {
          console.error('Error cargando geometrías offline:', offlineError);
        }
      } else {
        toast.error('Error al descargar geometrías');
      }
    }
  };
  
  // Cargar predios R1/R2
  const fetchPrediosR1R2 = async () => {
    // Si está online, SIEMPRE intentar cargar desde el servidor primero
    if (navigator.onLine) {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API}/actualizacion/proyectos/${proyectoId}/predios`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const predios = response.data.predios || [];
        setPrediosR1R2(predios);
        console.log('[Online] Predios R1/R2 cargados desde servidor:', predios.length);
        
        // Guardar automáticamente para modo offline (en background, sin bloquear)
        if (predios.length > 0) {
          savePrediosOffline(proyectoId, predios, proyecto?.municipio)
            .then(() => console.log('[Offline] Predios R1/R2 actualizados en caché'))
            .catch(saveError => console.warn('[Offline] No se pudieron guardar predios:', saveError));
        }
        return; // Éxito, salir
      } catch (error) {
        console.error('Error cargando predios R1/R2 del servidor:', error);
        // Si falla el servidor, continuar a cargar desde offline como fallback
      }
    }
    
    // Si está offline o el servidor falló, intentar cargar desde IndexedDB
    try {
      const prediosOffline = await getPrediosOffline(proyectoId);
      if (prediosOffline && prediosOffline.length > 0) {
        setPrediosR1R2(prediosOffline);
        toast.info(`Datos R1/R2 cargados desde caché offline (${prediosOffline.length} predios)`);
      } else {
        console.log('[Offline] No hay predios R1/R2 guardados offline');
      }
    } catch (offlineError) {
      console.error('Error cargando datos offline:', offlineError);
    }
  };
  
  useEffect(() => {
    if (proyectoId) {
      fetchProyecto();
    }
  }, [proyectoId, fetchProyecto]);
  
  // Verificar sincronización inicial al cargar el proyecto - AUTOMÁTICO EN SEGUNDO PLANO
  const [syncChecked, setSyncChecked] = useState(false); // Bandera para evitar múltiples checks
  
  useEffect(() => {
    const verificarYSincronizarAutomatico = async () => {
      // Solo verificar UNA vez por sesión
      if (proyecto && isOnline && !loading && !syncChecked) {
        setSyncChecked(true); // Marcar como verificado
        const necesitaSync = await checkInitialSync();
        if (necesitaSync) {
          // Sincronizar en segundo plano SIN mostrar pantalla bloqueante
          console.log('[Sync] Iniciando sincronización automática en segundo plano...');
          setBackgroundSyncMessage('Sincronizando datos en segundo plano...');
          
          try {
            const token = localStorage.getItem('token');
            
            // Descargar predios en segundo plano
            const prediosResponse = await axios.get(`${API}/actualizacion/proyectos/${proyectoId}/predios`, {
              headers: { Authorization: `Bearer ${token}` }
            }).catch(() => ({ data: [] }));
            const prediosDescargados = prediosResponse.data.predios || prediosResponse.data || [];
            
            // Descargar geometrías en segundo plano
            const geomResponse = await axios.get(`${API}/actualizacion/proyectos/${proyectoId}/geometrias`, {
              headers: { Authorization: `Bearer ${token}` },
              params: { zona: 'todas' }
            }).catch(() => ({ data: null }));
            
            // Guardar para offline
            await performFullSync(prediosDescargados, geomResponse.data);
            
            setBackgroundSyncMessage('Datos sincronizados ✓');
            setTimeout(() => setBackgroundSyncMessage(null), 3000);
            console.log('[Sync] Sincronización automática completada');
          } catch (e) {
            console.warn('[Sync] Error en sincronización automática:', e.message);
            setBackgroundSyncMessage(null);
          }
        }
      }
    };
    verificarYSincronizarAutomatico();
  }, [proyecto, isOnline, loading, checkInitialSync, syncChecked, proyectoId, performFullSync]);
  
  // Ejecutar sincronización completa cuando se muestra la pantalla de sync
  const handlePerformFullSync = async () => {
    try {
      // Primero descargar datos frescos del servidor
      const token = localStorage.getItem('token');
      
      // Descargar predios
      let prediosDescargados = [];
      try {
        const prediosResponse = await axios.get(`${API}/actualizacion/proyectos/${proyectoId}/predios`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        prediosDescargados = prediosResponse.data.predios || prediosResponse.data || [];
      } catch (e) {
        console.warn('[Sync] Error descargando predios:', e.message);
      }
      
      // Descargar geometrías (no bloquear si falla)
      let geometriasDescargadas = null;
      try {
        const geomResponse = await axios.get(`${API}/actualizacion/proyectos/${proyectoId}/geometrias`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { zona: 'todas' }
        });
        geometriasDescargadas = geomResponse.data;
      } catch (e) {
        console.warn('[Sync] Error descargando geometrías (continuando sin ellas):', e.message);
        // No es crítico, las geometrías se cargarán después normalmente
      }
      
      // Ejecutar sincronización completa con los datos descargados
      await performFullSync(prediosDescargados, geometriasDescargadas);
      
      // SIEMPRE cerrar la pantalla de sync después de intentar sincronizar
      // Los datos se recargarán desde el servidor en fetchProyecto/fetchGeometrias
      setShowSyncScreen(false);
      
      // Recargar datos del servidor en el componente
      fetchProyecto();
      
    } catch (error) {
      console.error('[Sync] Error en sincronización completa:', error);
      toast.error('Error durante la sincronización', { description: error.message });
      // Incluso con error, permitir continuar
      setShowSyncScreen(false);
      fetchProyecto();
    }
  };
  
  // Omitir sincronización y trabajar offline
  const handleSkipSync = () => {
    skipInitialSync();
    setShowSyncScreen(false);
  };
  
  // Helper: Verificar si un código de CONSTRUCCIÓN es una MEJORA
  // Una mejora tiene los últimos 3 dígitos (posiciones 28-30) diferentes de "000"
  const esMejoraCodigo = (codigo) => {
    if (!codigo || codigo.length < 30) return false;
    const ultimosTres = codigo.substring(27, 30);
    return ultimosTres !== '000';
  };
  
  // Crear índice de terrenos que TIENEN mejoras (basado en las construcciones)
  // Un terreno tiene mejora si existe una construcción asociada con código de mejora
  const terrenosConMejoras = useMemo(() => {
    const index = new Set();
    
    console.log(`[Visor] Calculando terrenosConMejoras. Construcciones disponibles: ${construcciones?.features?.length || 0}`);
    
    if (construcciones?.features) {
      for (const feature of construcciones.features) {
        const props = feature.properties || {};
        const codigoConstruccion = props.codigo || '';
        const terrenoCodigo = props.terreno_codigo || '';
        
        // Si el código de construcción es una mejora, agregar el terreno asociado
        if (esMejoraCodigo(codigoConstruccion)) {
          // El terreno asociado es el terreno_codigo o los primeros 21 dígitos del código
          if (terrenoCodigo) {
            index.add(terrenoCodigo);
          }
          // También agregar versión base del código (primeros 21 dígitos)
          if (codigoConstruccion.length >= 21) {
            const terrenoBase = codigoConstruccion.substring(0, 21) + '000000000';
            index.add(terrenoBase);
          }
        }
      }
    }
    
    console.log(`[Visor] Terrenos con mejoras identificados: ${index.size}`);
    return index;
  }, [construcciones]);
  
  // Helper: Verificar si un TERRENO tiene mejoras asociadas
  const terrenoTieneMejora = (codigoTerreno) => {
    if (!codigoTerreno) return false;
    return terrenosConMejoras.has(codigoTerreno);
  };
  
  // Contar terrenos que tienen mejoras
  const contarMejoras = useMemo(() => {
    // Contar construcciones que son mejoras
    if (!construcciones?.features) return 0;
    return construcciones.features.filter(f => esMejoraCodigo(f.properties?.codigo)).length;
  }, [construcciones]);
  
  // Obtener las mejoras (construcciones) asociadas a un terreno
  const getMejorasDeTerreno = useCallback((codigoTerreno) => {
    if (!construcciones?.features || !codigoTerreno) return [];
    
    const terrenoBase = codigoTerreno.substring(0, 21);
    
    return construcciones.features.filter(f => {
      const props = f.properties || {};
      const codigoConstruccion = props.codigo || '';
      const terrenoCodigo = props.terreno_codigo || '';
      
      // Verificar si es mejora
      if (!esMejoraCodigo(codigoConstruccion)) return false;
      
      // Verificar si pertenece al terreno
      if (terrenoCodigo === codigoTerreno) return true;
      if (codigoConstruccion.substring(0, 21) === terrenoBase) return true;
      
      return false;
    });
  }, [construcciones]);
  
  useEffect(() => {
    if (proyecto?.gdb_procesado) {
      fetchGeometrias();
    }
  }, [filterZona]);
  
  // Pre-calcular índices de códigos por estado (memoizado)
  const codigosPorEstadoIndex = useMemo(() => {
    const index = {
      todos: new Set(),
      pendiente: new Set(),
      visitado: new Set(),
      actualizado: new Set(),
      mejoras: new Set() // Terrenos que tienen mejoras asociadas
    };
    
    for (const predio of prediosR1R2) {
      const codigo = predio.codigo_predial || predio.numero_predial;
      if (!codigo) continue;
      
      const estado = predio.estado_visita || 'pendiente';
      index.todos.add(codigo);
      
      if (estado === 'pendiente') index.pendiente.add(codigo);
      else if (estado === 'visitado') index.visitado.add(codigo);
      else if (estado === 'actualizado') index.actualizado.add(codigo);
      
      // Agregar al índice de mejoras si el terreno tiene mejoras asociadas
      if (terrenoTieneMejora(codigo)) {
        index.mejoras.add(codigo);
      }
    }
    
    return index;
  }, [prediosR1R2]);
  
  // Filtrar geometrías por estado (usando useMemo para mejor rendimiento)
  const geometriasFiltradas = useMemo(() => {
    if (!geometrias?.features) {
      return null;
    }
    
    if (filterEstado === 'todos') {
      return geometrias;
    }
    
    // Usar el índice pre-calculado
    const codigosValidos = codigosPorEstadoIndex[filterEstado];
    if (!codigosValidos || codigosValidos.size === 0) {
      return { type: 'FeatureCollection', features: [] };
    }
    
    // Crear índice de terrenos base (primeros 21 dígitos) para matching de mejoras
    const terrenosBase = new Set();
    for (const cod of codigosValidos) {
      if (cod && cod.length >= 21) {
        terrenosBase.add(cod.substring(0, 21)); // Código hasta predio (sin edificio/piso/unidad/mejora)
      }
    }
    
    // Filtrar las geometrías usando el índice
    const featuresFiltradas = geometrias.features.filter(feature => {
      const props = feature.properties || {};
      const capaOrigen = (props.capa_origen || '').toUpperCase();
      
      // SIEMPRE incluir geometrías de perímetro/límite (sin importar el filtro)
      if (capaOrigen.includes('PERIMETRO') || capaOrigen.includes('LIMITE')) {
        return true;
      }
      
      // El GDB puede usar 'codigo', 'codigo_predial', o 'CODIGO'
      const codigo = props.codigo || props.codigo_predial || props.numero_predial || props.CODIGO;
      if (!codigo) return false;
      
      // Match exacto primero
      if (codigosValidos.has(codigo)) return true;
      
      // Match parcial para mejoras: el terreno GDB (primeros 21 dígitos) debe coincidir
      // con algún predio/mejora en la lista (ignorando edificio/piso/unidad/mejora)
      if (codigo.length >= 21) {
        const terrenoGDB = codigo.substring(0, 21);
        if (terrenosBase.has(terrenoGDB)) return true;
      }
      
      return false;
    });
    
    return {
      type: 'FeatureCollection',
      features: featuresFiltradas
    };
  }, [geometrias, filterEstado, codigosPorEstadoIndex]);
  
  // Separar geometrías de perímetro de las geometrías normales
  const { geometriasNormales, geometriasPerimetro } = useMemo(() => {
    if (!geometriasFiltradas?.features) {
      return { geometriasNormales: null, geometriasPerimetro: null };
    }
    
    const normales = [];
    const perimetro = [];
    
    for (const feature of geometriasFiltradas.features) {
      const capaOrigen = feature.properties?.capa_origen?.toUpperCase() || '';
      // Identificar capas de perímetro
      if (capaOrigen.includes('PERIMETRO') || capaOrigen.includes('LIMITE')) {
        perimetro.push(feature);
      } else {
        normales.push(feature);
      }
    }
    
    console.log(`[Visor] Separando geometrías: ${normales.length} normales, ${perimetro.length} perímetro`);
    
    return {
      geometriasNormales: normales.length > 0 ? { type: 'FeatureCollection', features: normales } : null,
      geometriasPerimetro: perimetro.length > 0 ? { type: 'FeatureCollection', features: perimetro } : null
    };
  }, [geometriasFiltradas]);
  
  // Filtrar construcciones por estado
  const construccionesFiltradas = useMemo(() => {
    if (!construcciones?.features) {
      console.log('[Visor] No hay construcciones cargadas');
      return null;
    }
    
    console.log(`[Visor] Procesando ${construcciones.features.length} construcciones, filtro: ${filterEstado}`);
    
    // Si el filtro es "todos" o "mejoras", mostrar TODAS las construcciones
    // Las construcciones son relevantes para todos los predios
    if (filterEstado === 'todos' || filterEstado === 'mejoras') {
      return construcciones;
    }
    
    const codigosValidos = codigosPorEstadoIndex[filterEstado];
    if (!codigosValidos || codigosValidos.size === 0) {
      return { type: 'FeatureCollection', features: [] };
    }
    
    // Crear índice de terrenos base para matching
    const terrenosBase = new Set();
    for (const cod of codigosValidos) {
      if (cod && cod.length >= 21) {
        terrenosBase.add(cod.substring(0, 21));
      }
    }
    
    // Las construcciones usan 'codigo' o 'terreno_codigo', no 'codigo_predial'
    const featuresFiltradas = construcciones.features.filter(feature => {
      const props = feature.properties || {};
      // Intentar varios campos que pueden contener el código del predio
      const codigo = props.codigo_predial || props.numero_predial || props.terreno_codigo || props.codigo || '';
      if (!codigo) return true; // Si no tiene código, mostrar de todos modos
      
      // Match exacto
      if (codigosValidos.has(codigo)) return true;
      
      // Match por terreno base (primeros 21 dígitos)
      if (codigo.length >= 21 && terrenosBase.has(codigo.substring(0, 21))) return true;
      
      // Match parcial para construcciones con código más corto
      for (const codigoValido of codigosValidos) {
        if (codigoValido.startsWith(codigo) || codigo.startsWith(codigoValido.substring(0, Math.min(21, codigo.length)))) {
          return true;
        }
      }
      
      return false;
    });
    
    return {
      type: 'FeatureCollection',
      features: featuresFiltradas
    };
  }, [construcciones, filterEstado, codigosPorEstadoIndex]);
  
  // Limpiar selección cuando cambia el filtro
  useEffect(() => {
    setSelectedGeometry(null);
    setSelectedPredio(null);
  }, [filterEstado]);
  
  // Incrementar versión de construcciones para forzar re-render del GeoJSON
  useEffect(() => {
    if (construcciones?.features?.length > 0) {
      setConstruccionesVersion(prev => prev + 1);
    }
  }, [construcciones]);

  // Función de sincronización con historial
  const handleSyncWithHistory = async () => {
    if (!isOnline) {
      toast.warning('Sin conexión - No se puede sincronizar');
      return;
    }
    
    const timestamp = new Date().toISOString();
    const pendientes = offlineStats.cambiosPendientes;
    
    try {
      // Agregar al historial como "en progreso"
      setSyncHistory(prev => [{
        id: timestamp,
        fecha: timestamp,
        estado: 'sincronizando',
        cambios: pendientes,
        mensaje: 'Sincronizando...'
      }, ...prev.slice(0, 9)]); // Mantener últimos 10
      
      // Ejecutar sincronización
      await forceSync();
      
      // Actualizar historial como exitoso
      setSyncHistory(prev => prev.map(item => 
        item.id === timestamp 
          ? { ...item, estado: 'completado', mensaje: `${pendientes} cambios sincronizados exitosamente` }
          : item
      ));
      
      toast.success(`Sincronización completada: ${pendientes} cambios enviados al servidor`);
      
    } catch (error) {
      console.error('Error en sincronización:', error);
      
      // Actualizar historial como fallido
      setSyncHistory(prev => prev.map(item => 
        item.id === timestamp 
          ? { ...item, estado: 'error', mensaje: `Error: ${error.message || 'Falló la sincronización'}` }
          : item
      ));
      
      toast.error('Error en sincronización', {
        description: error.message || 'No se pudieron enviar los cambios'
      });
    }
  };
  
  // Funciones GPS - Compatibilidad universal (iOS Safari, iOS Chrome/Firefox, Android, Desktop)
  const startWatchingPosition = async () => {
    console.log('GPS: ========== INICIANDO GEOLOCALIZACIÓN ==========');
    console.log('GPS: UserAgent:', navigator.userAgent);
    console.log('GPS: Timestamp:', new Date().toISOString());
    
    // Verificar soporte de geolocalización
    if (!navigator.geolocation) {
      console.error('GPS: navigator.geolocation NO existe');
      toast.error('GPS no soportado', {
        description: 'Tu navegador no soporta geolocalización'
      });
      return;
    }
    
    console.log('GPS: navigator.geolocation existe ✓');
    
    // Detectar plataforma
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    const isMobile = isIOS || isAndroid;
    
    console.log(`GPS: Plataforma detectada:`, { isIOS, isAndroid, isSafari, isMobile });
    
    // En móviles, HTTPS es obligatorio
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const isSecure = protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1';
    
    console.log(`GPS: Seguridad:`, { protocol, hostname, isSecure });
    
    if (isMobile && !isSecure) {
      console.error('GPS: HTTPS requerido pero no disponible');
      toast.error('GPS requiere HTTPS', {
        description: 'En dispositivos móviles, el GPS solo funciona con conexión segura (HTTPS)',
        duration: 8000
      });
      return;
    }
    
    // Verificar permisos usando Permissions API (si está disponible)
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
        console.log('GPS: Estado de permiso (Permissions API):', permissionStatus.state);
        
        if (permissionStatus.state === 'denied') {
          console.warn('GPS: Permiso DENEGADO previamente');
          toast.error('Permiso de ubicación denegado', {
            description: isIOS 
              ? 'Ve a Configuración > Privacidad > Servicios de ubicación > Safari (o tu navegador) y permite el acceso'
              : 'Haz clic en el icono de ubicación/candado en la barra de direcciones y permite el acceso',
            duration: 10000
          });
          return;
        }
      } catch (permErr) {
        console.log('GPS: Permissions API no disponible o error:', permErr.message);
        // Continuar de todos modos - iOS Safari no siempre soporta Permissions API
      }
    } else {
      console.log('GPS: Permissions API no disponible en este navegador');
    }
    
    // Activar estado de GPS
    setWatchingPosition(true);
    
    toast.info('Activando GPS...', { 
      description: isIOS 
        ? 'Permite el acceso cuando aparezca el mensaje. Si no aparece, verifica en Configuración > Safari > Ubicación'
        : 'Permite el acceso a la ubicación cuando el navegador lo solicite',
      duration: 8000 
    });
    
    // Opciones de geolocalización - más tolerantes para iOS
    const options = {
      enableHighAccuracy: true,
      timeout: isIOS ? 20000 : 30000, // iOS suele ser más rápido o falla antes
      maximumAge: isIOS ? 60000 : 30000 // iOS: aceptar posiciones más antiguas
    };
    
    console.log('GPS: Opciones configuradas:', options);
    
    // Callbacks
    const onSuccess = (position) => {
      console.log('GPS: ✓ ÉXITO! Posición obtenida:', {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date(position.timestamp).toISOString()
      });
      const { latitude, longitude, accuracy } = position.coords;
      setUserPosition([latitude, longitude]);
      setGpsAccuracy(accuracy);
      toast.success(`GPS activo`, { 
        description: `Precisión: ${Math.round(accuracy)} metros`,
        duration: 3000 
      });
    };
    
    const onError = (error) => {
      console.error('GPS: ✗ ERROR:', {
        code: error.code,
        message: error.message,
        PERMISSION_DENIED: error.code === 1,
        POSITION_UNAVAILABLE: error.code === 2,
        TIMEOUT: error.code === 3
      });
      setWatchingPosition(false);
      
      let msg = '';
      let desc = '';
      
      switch (error.code) {
        case 1: // PERMISSION_DENIED
          msg = 'Permiso de ubicación denegado';
          if (isIOS) {
            desc = 'En tu iPhone/iPad: Ve a Configuración > Privacidad y Seguridad > Servicios de ubicación > Safari (o tu navegador) y selecciona "Mientras se usa la app"';
          } else {
            desc = 'Haz clic en el icono de ubicación/candado en la barra de direcciones y permite el acceso';
          }
          break;
        case 2: // POSITION_UNAVAILABLE
          msg = 'Ubicación no disponible';
          desc = 'Verifica que el GPS esté activado en tu dispositivo. En iOS: Configuración > Privacidad > Servicios de ubicación (activado)';
          break;
        case 3: // TIMEOUT
          msg = 'Tiempo agotado';
          desc = 'No se pudo obtener la ubicación a tiempo. Verifica que tengas señal GPS (exterior) e intenta de nuevo';
          break;
        default:
          msg = 'Error de GPS';
          desc = error.message || 'Error desconocido';
      }
      
      toast.error(msg, { description: desc, duration: 12000 });
    };
    
    // Llamar getCurrentPosition con manejo mejorado
    console.log('GPS: Llamando navigator.geolocation.getCurrentPosition()...');
    console.log('GPS: Esperando respuesta del sistema operativo...');
    
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          onSuccess(pos);
          // Iniciar seguimiento continuo solo si la primera llamada tuvo éxito
          console.log('GPS: Primera posición obtenida, iniciando seguimiento continuo...');
          watchIdRef.current = navigator.geolocation.watchPosition(
            (p) => {
              console.log('GPS: Actualización de posición:', p.coords.latitude, p.coords.longitude);
              setUserPosition([p.coords.latitude, p.coords.longitude]);
              setGpsAccuracy(p.coords.accuracy);
            },
            (e) => { 
              console.warn('GPS: Error en watchPosition:', e.code, e.message);
              if (e.code === 1) onError(e); 
            },
            { ...options, maximumAge: 5000 } // Para watch, queremos posiciones más frescas
          );
        },
        onError,
        options
      );
      console.log('GPS: getCurrentPosition llamado - esperando callback del navegador...');
    } catch (e) {
      console.error('GPS: ✗ Excepción capturada:', e);
      toast.error('Error al iniciar GPS', { description: e.message });
      setWatchingPosition(false);
    }
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
      // Filtrar solo geometrías con coordenadas válidas WGS84 (para evitar datos corruptos en caché)
      const validFeatures = geometrias.features.filter(f => {
        const coords = f?.geometry?.coordinates;
        const gtype = f?.geometry?.type;
        let firstCoord = null;
        
        try {
          if (gtype === 'Polygon' && coords?.[0]?.[0]) {
            firstCoord = coords[0][0];
          } else if (gtype === 'MultiPolygon' && coords?.[0]?.[0]?.[0]) {
            firstCoord = coords[0][0][0];
          }
        } catch (e) {
          return false;
        }
        
        if (!firstCoord || !Array.isArray(firstCoord) || firstCoord.length < 2) return false;
        
        const [lon, lat] = firstCoord;
        // Validar que sean coordenadas WGS84 válidas (no proyectadas)
        return typeof lon === 'number' && typeof lat === 'number' &&
               lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90;
      });
      
      if (validFeatures.length === 0) {
        console.warn('No hay geometrías con coordenadas válidas. El caché puede estar corrupto.');
        toast.error('Datos de geometrías corruptos. Intente recargar con el botón de refrescar.');
        return;
      }
      
      if (validFeatures.length < geometrias.features.length) {
        console.warn(`Filtradas ${geometrias.features.length - validFeatures.length} geometrías con coordenadas inválidas`);
      }
      
      const validGeoJson = { type: 'FeatureCollection', features: validFeatures };
      const geoJsonLayer = L.geoJSON(validGeoJson);
      const bounds = geoJsonLayer.getBounds();
      
      if (bounds.isValid()) {
        const boundsArray = [
          [bounds.getSouth(), bounds.getWest()],
          [bounds.getNorth(), bounds.getEast()]
        ];
        console.log('Ajustando mapa a bounds válidos:', boundsArray);
        setFitToBounds(boundsArray);
        toast.success('Vista ajustada a las geometrías');
      } else {
        console.error('Bounds inválidos:', bounds);
        toast.error('No se pudieron calcular los límites del mapa');
      }
    } catch (error) {
      console.error('Error al hacer zoom a GDB:', error);
      toast.error('Error al ajustar la vista');
    }
  }, [geometrias]);
  
  // Auto-zoom cuando se cargan las geometrías por primera vez
  useEffect(() => {
    if (geometrias?.features?.length > 0) {
      // Pequeño delay para asegurar que el mapa esté listo
      const timer = setTimeout(() => {
        zoomToGDBLayer();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [geometrias?.features?.length, zoomToGDBLayer]);
  
  // Efecto para abrir predio desde URL (cuando viene de "Ver en Mapa")
  useEffect(() => {
    if (codigoFromUrl && geometrias?.features?.length > 0 && prediosR1R2.length > 0) {
      console.log('[VisorActualizacion] Buscando predio desde URL:', codigoFromUrl);
      
      // Buscar el predio por código (búsqueda flexible)
      const predio = prediosR1R2.find(p => {
        const codigoP = p.codigo_predial || p.numero_predial || '';
        // Match exacto o parcial
        return codigoP === codigoFromUrl || 
               codigoP.includes(codigoFromUrl) ||
               codigoFromUrl.includes(codigoP);
      });
      
      if (predio) {
        console.log('[VisorActualizacion] Predio encontrado:', predio.codigo_predial || predio.numero_predial);
        
        // Abrir el predio automáticamente
        setTimeout(() => {
          setSelectedPredio(predio);
          setShowDetalleSimplificado(true);
          
          // Buscar y hacer zoom a la geometría
          const codigoBuscado = predio.codigo_predial || predio.numero_predial;
          const codigoBase = codigoBuscado.substring(0, 21); // Primeros 21 dígitos para matching
          
          const feature = geometrias.features.find(f => {
            const props = f.properties || {};
            const codigo = props.codigo || props.codigo_predial || props.numero_predial || props.CODIGO || '';
            // Match exacto o por código base (para mejoras)
            return codigo === codigoBuscado || 
                   codigo.startsWith(codigoBase) ||
                   codigoBuscado.startsWith(codigo);
          });
          
          if (feature) {
            console.log('[VisorActualizacion] Geometría encontrada, haciendo zoom');
            try {
              const layer = L.geoJSON(feature);
              const bounds = layer.getBounds();
              if (bounds.isValid()) {
                setFitToBounds([
                  [bounds.getSouth(), bounds.getWest()],
                  [bounds.getNorth(), bounds.getEast()]
                ]);
              }
            } catch (e) {
              console.error('[VisorActualizacion] Error haciendo zoom a predio:', e);
            }
          } else {
            console.log('[VisorActualizacion] Geometría no encontrada para el predio');
          }
          
          toast.success(`Predio ${codigoBuscado} encontrado`);
        }, 800);
      } else {
        console.log('[VisorActualizacion] Predio NO encontrado en prediosR1R2');
        toast.warning('Predio no encontrado en el mapa');
      }
      
      // Limpiar el parámetro de URL para evitar re-ejecución
      navigate(`/dashboard/visor-actualizacion/${proyectoId}`, { replace: true });
    }
  }, [codigoFromUrl, geometrias?.features?.length, prediosR1R2.length, proyectoId, navigate]);
  
  // Buscar predio
  const handleSearch = async () => {
    if (!searchCode.trim()) return;
    
    // Buscar la geometría del predio o su terreno padre (para mejoras)
    if (geometrias?.features) {
      // Primero buscar match exacto
      let feature = geometrias.features.find(f => {
        const props = f.properties || {};
        const codigo = props.codigo || props.codigo_predial || props.numero_predial || props.CODIGO || '';
        return codigo.includes(searchCode) || searchCode.includes(codigo);
      });
      
      // Si no se encontró y es una mejora (últimos 8 dígitos != 00000000), buscar terreno padre
      if (!feature && searchCode.length >= 21) {
        const terrenoBase = searchCode.substring(0, 21); // Primeros 21 dígitos (hasta predio)
        feature = geometrias.features.find(f => {
          const props = f.properties || {};
          const codigo = props.codigo || props.codigo_predial || props.numero_predial || props.CODIGO || '';
          return codigo.length >= 21 && codigo.substring(0, 21) === terrenoBase;
        });
        
        if (feature) {
          toast.info('Mejora encontrada - mostrando terreno asociado', {
            description: `Terreno: ${feature.properties?.codigo || feature.properties?.codigo_predial}`
          });
        }
      }
      
      if (feature) {
        setSelectedGeometry(feature);
        const bounds = L.geoJSON(feature).getBounds();
        setFlyToPosition([bounds.getCenter().lat, bounds.getCenter().lng]);
        if (mapRef.current) {
          mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
        }
        toast.success('Predio encontrado en mapa');
      }
    }
    
    const predio = prediosR1R2.find(p => 
      p.codigo_predial?.includes(searchCode) ||
      p.numero_predial?.includes(searchCode)
    );
    
    if (predio) {
      // Buscar geometría correspondiente para obtener datos adicionales
      const feature = geometrias?.features?.find(f => {
        const props = f.properties || {};
        const codigo = props.codigo || props.codigo_predial || '';
        return codigo === predio.codigo_predial || codigo === predio.numero_predial;
      });
      
      // Asegurar que el predio tenga el codigo_homologado
      const predioCompleto = {
        ...predio,
        codigo_homologado: predio.codigo_homologado || feature?.properties?.codigo_homologado || feature?.properties?.CODIGO_HOMOLOGADO || ''
      };
      
      // Mostrar panel simplificado directamente (sin modal de tipo revisión)
      setSelectedPredio(predioCompleto);
      setShowDetalleSimplificado(true);
      setShowPredioDetail(false);
      setEditMode(false);
      
      // Cargar datos adicionales
      const codigo = predio.codigo_predial || predio.numero_predial;
      if (codigo) {
        fetchPropuestas(codigo);
        fetchHistorial(codigo);
        verificarConstrucciones(predio);
        cargarVisitaExistente(predio);
      }
    } else if (!geometrias?.features?.find(f => {
      const props = f.properties || {};
      const codigo = props.codigo || props.codigo_predial || '';
      return codigo.includes(searchCode);
    })) {
      toast.warning('Predio no encontrado');
    }
  };
  
  // Función para abrir el detalle del predio (después de seleccionar tipo de revisión)
  const abrirDetallePredio = (predio, tipo = null) => {
    setSelectedPredio(predio);
    setTipoRevision(tipo);
    cargarDatosParaEdicion(predio);
    setShowPredioDetail(false);
    setShowDetalleSimplificado(true);
    setEditMode(false);
    
    // Cargar propuestas e historial
    const codigo = predio?.codigo_predial || predio?.numero_predial;
    if (codigo) {
      fetchPropuestas(codigo);
      fetchHistorial(codigo);
      verificarConstrucciones(predio);
      cargarVisitaExistente(predio);
    }
  };

  // Verificar si el predio tiene construcciones en la GDB
  const verificarConstrucciones = async (predio) => {
    try {
      const token = localStorage.getItem('token');
      const codigoParaBuscar = predio.codigo_predial || predio.codigo_predial_nacional;
      
      // Buscar en las construcciones del proyecto
      const response = await axios.get(
        `${API}/actualizacion/proyectos/${proyectoId}/construcciones?codigo=${codigoParaBuscar}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data?.construcciones?.length > 0) {
        setTieneConstrucciones(true);
        setConstruccionesPredio(response.data.construcciones);
      } else {
        setTieneConstrucciones(false);
        setConstruccionesPredio([]);
      }
    } catch (error) {
      console.log('No se encontraron construcciones:', error);
      setTieneConstrucciones(false);
      setConstruccionesPredio([]);
    }
  };

  // Toggle para mostrar/ocultar construcciones en el mapa
  const toggleConstruccionesPredio = () => {
    setMostrarConstruccionesPredio(!mostrarConstruccionesPredio);
  };

  // Cargar visita existente si hay
  const cargarVisitaExistente = async (predio) => {
    try {
      const token = localStorage.getItem('token');
      const codigo = predio.codigo_predial || predio.codigo_predial_nacional;
      
      const response = await axios.get(
        `${API}/actualizacion/proyectos/${proyectoId}/predios/${codigo}/visita`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data?.visita) {
        setVisitaExistente(response.data.visita);
      } else {
        setVisitaExistente(null);
      }
    } catch (error) {
      setVisitaExistente(null);
    }
  };

  // Abrir el formulario de visita original
  const abrirFormularioVisita = () => {
    // Si el predio ya está visitado, mostrar confirmación de re-visita
    if (selectedPredio?.estado_visita === 'visitado' || selectedPredio?.estado_visita === 'visitado_firmado') {
      setPredioParaRevisita(selectedPredio);
      setShowConfirmRevisita(true);
      return;
    }
    // Si no está visitado, abrir directamente
    abrirFormatoVisita();
  };
  
  // Confirmar re-visita (sobrescribir datos existentes)
  const confirmarRevisita = () => {
    setShowConfirmRevisita(false);
    setPredioParaRevisita(null);
    abrirFormatoVisita();
  };
  
  // Cancelar re-visita
  const cancelarRevisita = () => {
    setShowConfirmRevisita(false);
    setPredioParaRevisita(null);
  };

  // Guardar formulario de visita
  const guardarFormularioVisita = async (datosVisita) => {
    if (!selectedPredio) return;
    
    setSavingVisita(true);
    try {
      const token = localStorage.getItem('token');
      const codigo = selectedPredio.codigo_predial || selectedPredio.numero_predial;
      
      const response = await axios.post(
        `${API}/actualizacion/proyectos/${proyectoId}/predios/${codigo}/visita`,
        datosVisita,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Formulario de visita guardado correctamente');
      
      // Actualizar el estado del predio localmente
      const nuevoEstado = datosVisita.sin_cambios ? 'visitado' : 'visitado';
      setPrediosR1R2(prev => prev.map(p => 
        (p.codigo_predial === codigo) 
          ? { ...p, estado_visita: nuevoEstado, sin_cambios: datosVisita.sin_cambios } 
          : p
      ));
      setSelectedPredio(prev => ({ ...prev, estado_visita: nuevoEstado, sin_cambios: datosVisita.sin_cambios }));
      
      setShowFormularioVisita(false);
      setVisitaExistente(datosVisita);
      
      // Refrescar datos
      fetchProyecto();
    } catch (error) {
      console.error('Error guardando visita:', error);
      toast.error(error.response?.data?.detail || 'Error al guardar el formulario de visita');
    } finally {
      setSavingVisita(false);
    }
  };

  // Abrir modal de edición (estilo Conservación)
  const abrirEdicionPredio = () => {
    if (selectedPredio) {
      cargarDatosParaEdicion(selectedPredio);
    }
    setEditMode(true);
    setShowPredioDetail(true);
    setShowDetalleSimplificado(false);
  };

  // Abrir historial en el modal
  const abrirHistorial = () => {
    if (selectedPredio) {
      cargarDatosParaEdicion(selectedPredio);
      const codigo = selectedPredio.codigo_predial || selectedPredio.numero_predial;
      if (codigo) {
        fetchHistorial(codigo);
      }
    }
    setEditMode(false);
    setShowPredioDetail(true);
    setShowDetalleSimplificado(false);
  };

  // Cerrar detalle simplificado
  const cerrarDetalleSimplificado = () => {
    setShowDetalleSimplificado(false);
    setSelectedPredio(null);
    setSelectedGeometry(null);
    setTieneConstrucciones(false);
    setConstruccionesPredio([]);
    setMostrarConstruccionesPredio(false);
    setVisitaExistente(null);
  };
  
  // Confirmar tipo de revisión y abrir predio
  const confirmarTipoRevision = (tipo) => {
    if (predioParaAbrir) {
      abrirDetallePredio(predioParaAbrir, tipo);
      setShowTipoRevisionModal(false);
      setPredioParaAbrir(null);
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
        
        // Determinar la justificación según el tipo de revisión
        const tiposRevision = {
          'campo': 'Revisión de campo - Datos físicos',
          'juridico': 'Revisión jurídica - Documentación y propietarios',
          'calidad': 'Control de calidad - Verificación de datos'
        };
        
        // Crear propuesta con tipo de revisión
        await axios.post(
          `${API}/actualizacion/proyectos/${proyectoId}/predios/${codigoPredial}/propuesta`,
          {
            datos_propuestos: dataToSave,
            tipo_revision: tipoRevision || 'campo',
            justificacion: tiposRevision[tipoRevision] || 'Propuesta de cambio'
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
          visitado_por: user?.full_name || user?.email,
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
  
  // ========== FUNCIONES PARA CANCELAR PREDIO ==========
  
  // Abrir modal de cancelación
  const abrirCancelarModal = () => {
    if (!selectedPredio) return;
    setMotivoCancelacion('');
    setShowCancelarModal(true);
  };
  
  // Cancelar o proponer cancelación de predio
  const handleCancelarPredio = async () => {
    if (!selectedPredio || !motivoCancelacion.trim()) {
      toast.error('Debe ingresar un motivo para la cancelación');
      return;
    }
    
    const esCoordinador = user?.role === 'coordinador' || user?.role === 'administrador';
    const codigoPredial = selectedPredio.codigo_predial || selectedPredio.numero_predial;
    
    setCancelando(true);
    try {
      const token = localStorage.getItem('token');
      
      if (esCoordinador) {
        // Coordinador: Cancelar directamente
        await axios.delete(
          `${API}/actualizacion/proyectos/${proyectoId}/predios/${codigoPredial}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            data: { motivo: motivoCancelacion }
          }
        );
        
        toast.success('Predio cancelado exitosamente');
        
        // Remover de la lista local
        setPrediosProyecto(prev => prev.filter(p => 
          (p.codigo_predial || p.numero_predial) !== codigoPredial
        ));
        
        // Cerrar modales
        setShowCancelarModal(false);
        setShowPredioDetail(false);
        setSelectedPredio(null);
        
      } else {
        // Gestor: Proponer cancelación
        await axios.post(
          `${API}/actualizacion/proyectos/${proyectoId}/predios/${codigoPredial}/proponer-cancelacion`,
          { motivo: motivoCancelacion },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        toast.success('Propuesta de cancelación enviada al coordinador');
        
        // Actualizar estado local
        setSelectedPredio(prev => ({ ...prev, propuesta_cancelacion_pendiente: true }));
        setShowCancelarModal(false);
      }
      
    } catch (error) {
      console.error('Error al cancelar predio:', error);
      toast.error(error.response?.data?.detail || 'Error al procesar la cancelación');
    } finally {
      setCancelando(false);
    }
  };
  
  // ========== FUNCIONES PARA FORMATO DE VISITA ==========
  
  // Abrir modal de visita - PERMITE REABRIR si ya tiene visita guardada
  const abrirFormatoVisita = () => {
    // Verificar si el predio ya tiene una visita guardada
    const visitaExistente = selectedPredio?.visita;
    const estadoActual = selectedPredio?.estado_visita;
    
    // Si está "actualizado" (aprobado), NO permitir editar
    if (estadoActual === 'actualizado') {
      toast.error('Este predio ya fue actualizado y aprobado. No se puede modificar el formato de visita.');
      return;
    }
    
    // Determinar tipo de predio (PH/NPH)
    const esPH = selectedPredio?.es_ph || (selectedPredio?.condicion_predio && selectedPredio?.condicion_predio !== '000000000');
    
    // Si hay visita existente, cargar esos datos (permitir continuar editando)
    if (visitaExistente && estadoActual === 'visitado') {
      toast.info('Cargando formato de visita existente para continuar editando...', { duration: 2000 });
      
      // Cargar datos de la visita guardada
      setVisitaData({
        ...visitaExistente,
        // Asegurar que los campos de calificación existan
        calif_estructura: visitaExistente.calif_estructura || { armazon: '', muros: '', cubierta: '', conservacion: '' },
        calif_acabados: visitaExistente.calif_acabados || { fachadas: '', cubrim_muros: '', pisos: '', conservacion: '' },
        calif_bano: visitaExistente.calif_bano || { tamano: '', enchape: '', mobiliario: '', conservacion: '' },
        calif_cocina: visitaExistente.calif_cocina || { tamano: '', enchape: '', mobiliario: '', conservacion: '' },
        calif_industria: visitaExistente.calif_industria || { cercha_madera: '', cercha_metalica_liviana: '', cercha_metalica_mediana: '', cercha_metalica_pesada: '', altura: '' },
        calif_generales: visitaExistente.calif_generales || { total_pisos: '', total_habitaciones: '', total_banos: '', total_locales: '', area_total_construida: '' },
        fotos_croquis: visitaExistente.fotos_croquis || []
      });
      
      // Cargar propietarios de la visita
      if (visitaExistente.propietarios_visita && visitaExistente.propietarios_visita.length > 0) {
        setVisitaPropietarios(visitaExistente.propietarios_visita);
      } else {
        setVisitaPropietarios([{ tipo_documento: '', numero_documento: '', nombre: '', primer_apellido: '', segundo_apellido: '', estado: '', genero: '', genero_otro: '', grupo_etnico: '' }]);
      }
      
      // Cargar construcciones
      if (visitaExistente.construcciones && visitaExistente.construcciones.length > 0) {
        setVisitaConstrucciones(visitaExistente.construcciones);
      } else {
        setVisitaConstrucciones([
          { unidad: 'A', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' },
          { unidad: 'B', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' },
          { unidad: 'C', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' },
          { unidad: 'D', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' },
          { unidad: 'E', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' }
        ]);
      }
      
      // Cargar fotos
      setFotos(visitaExistente.fotos || []);
      
    } else {
      // Primera visita - pre-llenar con datos del R1/R2
      setVisitaData({
        // Sección 2: Información Básica (pre-llenada del predio)
        tipo_predio: esPH ? 'PH' : 'NPH',
        direccion_visita: selectedPredio?.direccion || '',
        destino_economico_visita: selectedPredio?.destino_economico || '',
        area_terreno_visita: selectedPredio?.area_terreno?.toString() || '',
        area_construida_visita: selectedPredio?.area_construida?.toString() || '',
      // Sección 3: PH (Propiedad Horizontal) - valores del predio si existen
      ph_area_coeficiente: selectedPredio?.area_coeficiente?.toString() || '',
      ph_area_construida_privada: selectedPredio?.area_construida_privada?.toString() || '',
      ph_area_construida_comun: selectedPredio?.area_construida_comun?.toString() || '',
      ph_copropiedad: selectedPredio?.copropiedad || '',
      ph_predio_asociado: selectedPredio?.predio_asociado || '',
      ph_torre: selectedPredio?.torre || '',
      ph_apartamento: selectedPredio?.apartamento || '',
      // Sección 4: Condominio
      cond_area_terreno_comun: selectedPredio?.area_terreno_comun?.toString() || '',
      cond_area_terreno_privada: selectedPredio?.area_terreno_privada?.toString() || '',
      cond_area_construida_privada: selectedPredio?.cond_area_construida_privada?.toString() || '',
      cond_area_construida_comun: selectedPredio?.cond_area_construida_comun?.toString() || '',
      cond_condominio: selectedPredio?.condominio || '',
      cond_predio_asociado: selectedPredio?.cond_predio_asociado || '',
      cond_unidad: selectedPredio?.unidad || '',
      cond_casa: selectedPredio?.casa || '',
      // Sección 5: Información Jurídica
      jur_matricula: selectedPredio?.matricula_inmobiliaria || '',
      jur_tipo_doc: '',
      jur_numero_doc: '',
      jur_notaria: '',
      jur_fecha: '',
      jur_ciudad: '',
      jur_razon_social: '',
      // Sección 6: Datos de Notificación
      not_telefono: '',
      not_direccion: selectedPredio?.direccion || '',
      not_correo: '',
      not_autoriza_correo: '',
      not_departamento: 'Norte de Santander',
      not_municipio: proyecto?.municipio || selectedPredio?.municipio || '',
      not_vereda: '',
      not_corregimiento: '',
      not_datos_adicionales: '',
      // Sección 8: Calificación
      calif_estructura: { armazon: '', muros: '', cubierta: '', conservacion: '' },
      calif_acabados: { fachadas: '', cubrim_muros: '', pisos: '', conservacion: '' },
      calif_bano: { tamano: '', enchape: '', mobiliario: '', conservacion: '' },
      calif_cocina: { tamano: '', enchape: '', mobiliario: '', conservacion: '' },
      calif_industria: { cercha_madera: '', cercha_metalica_liviana: '', cercha_metalica_mediana: '', cercha_metalica_pesada: '', altura: '' },
      calif_generales: { total_pisos: '', total_habitaciones: '', total_banos: '', total_locales: '', area_total_construida: '' },
      // Sección 9: Resumen áreas de terreno (área base catastral viene del R1, área geográfica del GDB)
      area_titulo_ha: '',
      area_titulo_m2: '',
      area_titulo_desc: '',
      area_base_catastral_ha: selectedPredio?.area_terreno ? (parseFloat(selectedPredio.area_terreno) / 10000).toFixed(4) : '',
      area_base_catastral_m2: selectedPredio?.area_terreno?.toString() || '', // del R1
      area_base_catastral_desc: 'Área del R1 (Excel cargado)',
      // Área GDB se obtiene de selectedGeometry.properties.shape_Area
      area_geografica_ha: selectedGeometry?.properties?.shape_Area ? (parseFloat(selectedGeometry.properties.shape_Area) / 10000).toFixed(4) : '',
      area_geografica_m2: selectedGeometry?.properties?.shape_Area ? parseFloat(selectedGeometry.properties.shape_Area).toFixed(2) : '', // del GDB
      area_geografica_desc: selectedGeometry?.properties?.shape_Area ? 'Área del GDB (geometría)' : 'Sin geometría GDB',
      area_levantamiento_ha: '',
      area_levantamiento_m2: '',
      area_levantamiento_desc: '',
      area_identificacion_ha: '',
      area_identificacion_m2: '',
      area_identificacion_desc: '',
      // Sección 10: Fotos croquis
      fotos_croquis: [],
      // Sección 11: Observaciones generales
      observaciones_generales: '',
      // Sección 12: Firmas
      firma_visitado_base64: null,
      firma_reconocedor_base64: null,
      nombre_visitado: '',
      nombre_reconocedor: (user?.full_name || '').toUpperCase(),
      // Datos de la visita
      fecha_visita: new Date().toISOString().split('T')[0],
      hora_visita: new Date().toTimeString().slice(0, 5),
      persona_atiende: '',
      relacion_predio: '',
      estado_predio: '',
      acceso_predio: 'si',
      servicios_publicos: [],
      observaciones: '',
      firma_base64: null,
      sin_cambios: false
    });
    
    // Pre-llenar propietarios si existen
    if (selectedPredio?.propietarios && selectedPredio.propietarios.length > 0) {
      setVisitaPropietarios(selectedPredio.propietarios.map(p => ({
        tipo_documento: p.tipo_documento || '',
        numero_documento: p.numero_documento || '',
        nombre: p.nombre_propietario?.split(' ')[0] || p.nombre || '',
        primer_apellido: p.nombre_propietario?.split(' ')[1] || p.primer_apellido || '',
        segundo_apellido: p.nombre_propietario?.split(' ')[2] || p.segundo_apellido || '',
        estado: p.estado || '',
        genero: '',
        genero_otro: '',
        grupo_etnico: ''
      })));
    } else if (selectedPredio?.nombre_propietario) {
      const partes = selectedPredio.nombre_propietario.split(' ');
      setVisitaPropietarios([{
        tipo_documento: selectedPredio.tipo_documento || '',
        numero_documento: selectedPredio.numero_documento || '',
        nombre: partes[0] || '',
        primer_apellido: partes[1] || '',
        segundo_apellido: partes.slice(2).join(' ') || '',
        estado: selectedPredio.estado || '',
        genero: '',
        genero_otro: '',
        grupo_etnico: ''
      }]);
    } else {
      setVisitaPropietarios([{
        tipo_documento: '',
        numero_documento: '',
        nombre: '',
        primer_apellido: '',
        segundo_apellido: '',
        estado: '',
        genero: '',
        genero_otro: '',
        grupo_etnico: ''
      }]);
    }
    
      setFotos([]);
      // Reset construcciones a valores iniciales (para primera visita)
      setVisitaConstrucciones([
        { unidad: 'A', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' },
        { unidad: 'B', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' },
        { unidad: 'C', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' },
        { unidad: 'D', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' },
        { unidad: 'E', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' }
      ]);
    } // Cierre del else de "primera visita"
    
    setVisitaPagina(1); // Iniciar en página 1
    setShowVisitaModal(true);
    
    // Limpiar canvas de firma después de que el modal se abra (solo si no hay firma previa)
    setTimeout(() => {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      // También limpiar canvas de visitado y reconocedor
      if (canvasVisitadoRef.current) {
        const ctx = canvasVisitadoRef.current.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasVisitadoRef.current.width, canvasVisitadoRef.current.height);
      }
      if (canvasReconocedorRef.current) {
        const ctx = canvasReconocedorRef.current.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasReconocedorRef.current.width, canvasReconocedorRef.current.height);
      }
    }, 100);
  };
  
  // Efecto para cargar datos cuando se abre visita para una mejora
  useEffect(() => {
    if (showVisitaModal && tipoVisita === 'mejora' && mejoraSeleccionada) {
      console.log('[Visor] Cargando datos para visita de mejora');
      const predio = predioMejoraSeleccionada;
      const codigoMejora = mejoraSeleccionada?.properties?.codigo || '';
      
      // Si encontramos el predio R1/R2 de la mejora, pre-llenar los datos
      if (predio) {
        console.log('[Visor] Predio R1/R2 de mejora encontrado:', predio.codigo_predial);
        setVisitaData(prev => ({
          ...prev,
          direccion_visita: predio.direccion || prev.direccion_visita || '',
          destino_economico_visita: predio.destino_economico || prev.destino_economico_visita || '',
          area_terreno_visita: predio.area_terreno?.toString() || prev.area_terreno_visita || '',
          area_construida_visita: predio.area_construida?.toString() || prev.area_construida_visita || ''
        }));
        
        // Pre-llenar propietarios si existen
        if (predio.propietarios && predio.propietarios.length > 0) {
          setVisitaPropietarios(predio.propietarios.map(p => ({
            tipo_documento: p.tipo_documento || '',
            numero_documento: p.numero_documento || '',
            nombre: p.nombre || '',
            primer_apellido: p.primer_apellido || '',
            segundo_apellido: p.segundo_apellido || '',
            estado: p.estado || '',
            genero: p.genero || '',
            genero_otro: p.genero_otro || '',
            grupo_etnico: p.grupo_etnico || ''
          })));
        }
      } else {
        console.log('[Visor] No se encontró predio R1/R2 para la mejora:', codigoMejora);
      }
    }
  }, [showVisitaModal, tipoVisita, mejoraSeleccionada, predioMejoraSeleccionada]);
  
  // Funciones para manejar propietarios en el formulario de visita
  const agregarPropietarioVisita = () => {
    setVisitaPropietarios(prev => [...prev, {
      tipo_documento: '',
      numero_documento: '',
      nombre: '',
      primer_apellido: '',
      segundo_apellido: '',
      estado: '',
      genero: '',
      genero_otro: '',
      grupo_etnico: ''
    }]);
  };
  
  const eliminarPropietarioVisita = (index) => {
    if (visitaPropietarios.length > 1) {
      setVisitaPropietarios(prev => prev.filter((_, i) => i !== index));
    }
  };
  
  const actualizarPropietarioVisita = (index, campo, valor) => {
    setVisitaPropietarios(prev => prev.map((p, i) => 
      i === index ? { ...p, [campo]: valor } : p
    ));
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

  // Referencias para throttling de firmas (usando refs para evitar re-renders)
  const rafVisitadoRef = useRef(null);
  const rafReconocedorRef = useRef(null);
  const rafModalRef = useRef(null);
  const lastPointVisitado = useRef(null);
  const lastPointReconocedor = useRef(null);
  const lastPointModal = useRef(null);
  // Estados de dibujo como refs para mejor rendimiento
  const isDrawingVisitadoRef = useRef(false);
  const isDrawingReconocedorRef = useRef(false);
  const isDrawingModalRef = useRef(false);

  // Funciones optimizadas para firma del visitado (Sección 12)
  const startDrawingVisitado = (e) => {
    isDrawingVisitadoRef.current = true;
    const canvas = canvasVisitadoRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let x, y;
    if (e.type.includes('touch')) {
      e.preventDefault();
      x = (e.touches[0].clientX - rect.left) * scaleX;
      y = (e.touches[0].clientY - rect.top) * scaleY;
    } else {
      x = (e.clientX - rect.left) * scaleX;
      y = (e.clientY - rect.top) * scaleY;
    }
    lastPointVisitado.current = { x, y };
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const drawVisitado = (e) => {
    if (!isDrawingVisitadoRef.current) return;
    if (e.type.includes('touch')) e.preventDefault();
    
    const canvas = canvasVisitadoRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let x, y;
    if (e.type.includes('touch')) {
      x = (e.touches[0].clientX - rect.left) * scaleX;
      y = (e.touches[0].clientY - rect.top) * scaleY;
    } else {
      x = (e.clientX - rect.left) * scaleX;
      y = (e.clientY - rect.top) * scaleY;
    }
    
    if (lastPointVisitado.current) {
      ctx.beginPath();
      ctx.moveTo(lastPointVisitado.current.x, lastPointVisitado.current.y);
      ctx.lineTo(x, y);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    lastPointVisitado.current = { x, y };
  };

  const stopDrawingVisitado = () => {
    isDrawingVisitadoRef.current = false;
    lastPointVisitado.current = null;
  };

  const limpiarFirmaVisitado = () => {
    const canvas = canvasVisitadoRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };


  const obtenerFirmaVisitadoBase64 = () => {
    const canvas = canvasVisitadoRef.current;
    if (canvas) return canvas.toDataURL('image/png');
    return null;
  };

  // Funciones optimizadas para firma del reconocedor (Sección 12)
  const startDrawingReconocedor = (e) => {
    isDrawingReconocedorRef.current = true;
    const canvas = canvasReconocedorRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let x, y;
    if (e.type.includes('touch')) {
      e.preventDefault();
      x = (e.touches[0].clientX - rect.left) * scaleX;
      y = (e.touches[0].clientY - rect.top) * scaleY;
    } else {
      x = (e.clientX - rect.left) * scaleX;
      y = (e.clientY - rect.top) * scaleY;
    }
    lastPointReconocedor.current = { x, y };
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const drawReconocedor = (e) => {
    if (!isDrawingReconocedorRef.current) return;
    if (e.type.includes('touch')) e.preventDefault();
    
    const canvas = canvasReconocedorRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let x, y;
    if (e.type.includes('touch')) {
      x = (e.touches[0].clientX - rect.left) * scaleX;
      y = (e.touches[0].clientY - rect.top) * scaleY;
    } else {
      x = (e.clientX - rect.left) * scaleX;
      y = (e.clientY - rect.top) * scaleY;
    }
    
    if (lastPointReconocedor.current) {
      ctx.beginPath();
      ctx.moveTo(lastPointReconocedor.current.x, lastPointReconocedor.current.y);
      ctx.lineTo(x, y);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    lastPointReconocedor.current = { x, y };
  };

  const stopDrawingReconocedor = () => {
    isDrawingReconocedorRef.current = false;
    lastPointReconocedor.current = null;
  };

  const limpiarFirmaReconocedor = () => {
    const canvas = canvasReconocedorRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  const obtenerFirmaReconocedorBase64 = () => {
    const canvas = canvasReconocedorRef.current;
    if (canvas) return canvas.toDataURL('image/png');
    return null;
  };

  // ========== MODAL DE FIRMA GRANDE ==========
  const abrirModalFirma = (tipo) => {
    setFirmaModalTipo(tipo);
    setShowFirmaModal(true);
    // Inicializar canvas después de que se abra el modal
    setTimeout(() => {
      if (canvasFirmaModalRef.current) {
        const ctx = canvasFirmaModalRef.current.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasFirmaModalRef.current.width, canvasFirmaModalRef.current.height);
      }
    }, 100);
  };

  const startDrawingModal = (e) => {
    isDrawingModalRef.current = true;
    const canvas = canvasFirmaModalRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let x, y;
    if (e.type.includes('touch')) {
      e.preventDefault();
      x = (e.touches[0].clientX - rect.left) * scaleX;
      y = (e.touches[0].clientY - rect.top) * scaleY;
    } else {
      x = (e.clientX - rect.left) * scaleX;
      y = (e.clientY - rect.top) * scaleY;
    }
    lastPointModal.current = { x, y };
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const drawModal = (e) => {
    if (!isDrawingModalRef.current) return;
    if (e.type.includes('touch')) e.preventDefault();
    
    const canvas = canvasFirmaModalRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let x, y;
    if (e.type.includes('touch')) {
      x = (e.touches[0].clientX - rect.left) * scaleX;
      y = (e.touches[0].clientY - rect.top) * scaleY;
    } else {
      x = (e.clientX - rect.left) * scaleX;
      y = (e.clientY - rect.top) * scaleY;
    }
    
    if (lastPointModal.current) {
      ctx.beginPath();
      ctx.moveTo(lastPointModal.current.x, lastPointModal.current.y);
      ctx.lineTo(x, y);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    lastPointModal.current = { x, y };
  };

  const stopDrawingModal = () => {
    isDrawingModalRef.current = false;
    lastPointModal.current = null;
  };

  const limpiarFirmaModal = () => {
    const canvas = canvasFirmaModalRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  const confirmarFirmaModal = () => {
    const canvas = canvasFirmaModalRef.current;
    if (canvas) {
      const firmaBase64 = canvas.toDataURL('image/png');
      if (firmaModalTipo === 'visitado') {
        setVisitaData(prev => ({ ...prev, firma_visitado_base64: firmaBase64 }));
        // Copiar al canvas pequeño
        if (canvasVisitadoRef.current) {
          const img = new Image();
          img.onload = () => {
            const ctx = canvasVisitadoRef.current.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvasVisitadoRef.current.width, canvasVisitadoRef.current.height);
            ctx.drawImage(img, 0, 0, canvasVisitadoRef.current.width, canvasVisitadoRef.current.height);
          };
          img.src = firmaBase64;
        }
      } else {
        setVisitaData(prev => ({ ...prev, firma_reconocedor_base64: firmaBase64 }));
        // Copiar al canvas pequeño
        if (canvasReconocedorRef.current) {
          const img = new Image();
          img.onload = () => {
            const ctx = canvasReconocedorRef.current.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvasReconocedorRef.current.width, canvasReconocedorRef.current.height);
            ctx.drawImage(img, 0, 0, canvasReconocedorRef.current.width, canvasReconocedorRef.current.height);
          };
          img.src = firmaBase64;
        }
      }
    }
    setShowFirmaModal(false);
    toast.success('Firma guardada');
  };

  // Manejo de fotos de croquis (Sección 10)
  const handleFotoCroquisChange = async (e) => {
    const files = Array.from(e.target.files);
    const nuevasFotos = [];
    for (const file of files) {
      const reader = new FileReader();
      const fotoData = await new Promise((resolve) => {
        reader.onload = (ev) => resolve(ev.target.result);
        reader.readAsDataURL(file);
      });
      nuevasFotos.push({
        id: Date.now() + Math.random(),
        data: fotoData,
        nombre: file.name,
        fecha: new Date().toISOString(),
        preview: fotoData
      });
    }
    setVisitaData(prev => ({
      ...prev,
      fotos_croquis: [...prev.fotos_croquis, ...nuevasFotos]
    }));
  };

  const eliminarFotoCroquis = (idx) => {
    setVisitaData(prev => ({
      ...prev,
      fotos_croquis: prev.fotos_croquis.filter((_, i) => i !== idx)
    }));
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
    const firmaVisitadoB64 = obtenerFirmaVisitadoBase64();
    const firmaReconocedorB64 = obtenerFirmaReconocedorBase64();
    
    // Validación de firmas obligatorias
    if (!firmaVisitadoB64) {
      toast.error('La firma del visitado es obligatoria');
      setCurrentPage(5); // Ir a la página de firmas
      return;
    }
    
    if (!firmaReconocedorB64) {
      toast.error('La firma del reconocedor es obligatoria');
      setCurrentPage(5); // Ir a la página de firmas
      return;
    }
    
    setSaving(true);
    
    const codigoPredial = selectedPredio.codigo_predial || selectedPredio.numero_predial;
    
    // ============================================
    // DETECTAR CAMBIOS SUGERIDOS (vs R1/R2 original)
    // ============================================
    const cambiosSugeridos = {};
    const cambiosJuridicos = {};
    
    // Campos que se mapean directamente al R1/R2
    const mapeoR1R2 = {
      'direccion_visita': { campo_r1r2: 'direccion', nombre: 'Dirección' },
      'destino_economico_visita': { campo_r1r2: 'destino_economico', nombre: 'Destino Económico' },
      'area_terreno_visita': { campo_r1r2: 'area_terreno', nombre: 'Área Terreno', esNumero: true },
      'area_construida_visita': { campo_r1r2: 'area_construida', nombre: 'Área Construida', esNumero: true }
    };
    
    // Comparar valores del formulario con los originales del predio (R1/R2)
    Object.entries(mapeoR1R2).forEach(([campoVisita, config]) => {
      const valorVisita = visitaData[campoVisita];
      const valorOriginal = selectedPredio[config.campo_r1r2];
      
      // Normalizar valores para comparación
      const valorVisitaNorm = config.esNumero 
        ? (parseFloat(valorVisita) || 0) 
        : (valorVisita || '').toString().trim().toUpperCase();
      const valorOriginalNorm = config.esNumero 
        ? (parseFloat(valorOriginal) || 0) 
        : (valorOriginal || '').toString().trim().toUpperCase();
      
      if (valorVisitaNorm !== valorOriginalNorm && valorVisita) {
        cambiosSugeridos[config.campo_r1r2] = {
          campo: config.nombre,
          valor_actual: valorOriginal || '(vacío)',
          valor_propuesto: valorVisita,
          detectado_en: 'formato_visita'
        };
      }
    });
    
    // Campos jurídicos (matrícula, propietarios) - requieren revisión especial
    if (visitaData.jur_matricula && visitaData.jur_matricula !== (selectedPredio.matricula_inmobiliaria || '')) {
      cambiosJuridicos['matricula_inmobiliaria'] = {
        campo: 'Matrícula Inmobiliaria',
        valor_actual: selectedPredio.matricula_inmobiliaria || '(vacío)',
        valor_propuesto: visitaData.jur_matricula,
        requiere_revision: true,
        tipo: 'juridico'
      };
    }
    
    // Propietarios del formulario de visita
    const propietariosConDatos = visitaPropietarios.filter(p => p.nombre || p.numero_documento);
    if (propietariosConDatos.length > 0) {
      cambiosJuridicos['propietarios'] = {
        campo: 'Propietarios',
        valor_actual: selectedPredio.propietarios || [],
        valor_propuesto: propietariosConDatos,
        requiere_revision: true,
        tipo: 'juridico',
        nota: 'Información de propietarios capturada en visita - requiere verificación documental'
      };
    }
    
    const hayCambiosSugeridos = Object.keys(cambiosSugeridos).length > 0;
    const hayCambiosJuridicos = Object.keys(cambiosJuridicos).length > 0;
    
    // Datos de la visita incluyendo construcciones, calificaciones y nuevas secciones
    const visitaCompleta = {
      ...visitaData,
      propietarios_visita: visitaPropietarios.filter(p => p.nombre || p.numero_documento),
      construcciones: visitaConstrucciones.filter(c => c.codigo_uso || c.area),
      firma_base64: firmaBase64,
      firma_visitado_base64: firmaVisitadoB64,
      firma_reconocedor_base64: firmaReconocedorB64,
      fotos: fotos.map(f => ({ data: f.data, nombre: f.nombre, fecha: f.fecha })),
      fotos_croquis: visitaData.fotos_croquis.map(f => ({ data: f.data, nombre: f.nombre, fecha: f.fecha })),
      ubicacion_gps: userPosition ? { lat: userPosition[0], lng: userPosition[1], accuracy: gpsAccuracy } : null,
      realizada_por: user?.full_name || user?.email,
      realizada_en: new Date().toISOString(),
      // Metadatos de cambios detectados
      cambios_sugeridos: cambiosSugeridos,
      cambios_juridicos: cambiosJuridicos,
      tiene_cambios_sugeridos: hayCambiosSugeridos,
      tiene_cambios_juridicos: hayCambiosJuridicos
    };
    
    const datosActualizacion = {
      estado_visita: 'visitado',
      sin_cambios: visitaData.sin_cambios && !hayCambiosSugeridos,
      visita: visitaCompleta,
      cambios_sugeridos: hayCambiosSugeridos ? cambiosSugeridos : null,
      cambios_juridicos: hayCambiosJuridicos ? cambiosJuridicos : null,
      visitado_por: user?.full_name || user?.email,
      visitado_en: new Date().toISOString()
    };
    
    try {
      if (isOnline) {
        // Modo online: guardar directamente
        const token = localStorage.getItem('token');
        const response = await axios.patch(
          `${API}/actualizacion/proyectos/${proyectoId}/predios/${codigoPredial}`,
          datosActualizacion,
          { headers: { Authorization: `Bearer ${token}` }}
        );
        
        const nuevoEstado = response.data?.estado_visita || 'visitado';
        const estaFirmado = response.data?.firmado || nuevoEstado === 'visitado_firmado';
        
        if (estaFirmado) {
          toast.success('✅ Visita firmada y guardada - Este predio ya no puede ser modificado', { duration: 5000 });
        } else {
          toast.success(visitaData.sin_cambios && !hayCambiosSugeridos
            ? 'Visita guardada - Predio marcado como visitado sin cambios' 
            : hayCambiosSugeridos 
              ? `Formato guardado - Se detectaron ${Object.keys(cambiosSugeridos).length} cambio(s) sugerido(s) para revisión`
              : 'Formato de visita guardado exitosamente'
          );
        }
        
        // Notificar si hay cambios jurídicos pendientes
        if (hayCambiosJuridicos) {
          toast.info('Se detectaron cambios jurídicos (matrícula/propietarios) que requieren revisión especial', { duration: 5000 });
        }
        
        setShowVisitaModal(false);
        
        // Actualizar estado local
        setPrediosR1R2(prev => prev.map(p => 
          (p.codigo_predial === codigoPredial || p.numero_predial === codigoPredial)
            ? { ...p, estado_visita: nuevoEstado, sin_cambios: visitaData.sin_cambios }
            : p
        ));
      } else {
        // Modo offline: guardar para sincronizar después
        await saveOfflineChange('visita', {
          codigo_predial: codigoPredial,
          ...datosActualizacion
        });
        
        toast.info('Visita guardada localmente - Se sincronizará al recuperar conexión');
        
        setShowVisitaModal(false);
        
        // Actualizar estado local
        setPrediosR1R2(prev => prev.map(p => 
          (p.codigo_predial === codigoPredial || p.numero_predial === codigoPredial)
            ? { ...p, estado_visita: 'visitado', sin_cambios: visitaData.sin_cambios }
            : p
        ));
      }
      
      setSelectedPredio(prev => ({ ...prev, estado_visita: 'visitado', sin_cambios: visitaData.sin_cambios }));
      setEditData(prev => ({ ...prev, estado_visita: 'visitado' }));
      setShowPredioDetail(false);
    } catch (error) {
      // Manejar error de predio firmado
      if (error.response?.status === 403 && error.response?.data?.detail?.includes('firmada')) {
        toast.error('Este predio ya tiene una visita firmada y no puede ser modificado');
        setShowVisitaModal(false);
        return;
      }
      
      // Intentar guardar offline si falla la conexión
      if (!isOnline || error.code === 'ERR_NETWORK') {
        try {
          await saveOfflineChange('visita', {
            codigo_predial: codigoPredial,
            ...datosActualizacion
          });
          toast.info('Visita guardada offline - Se sincronizará al recuperar conexión');
          setShowVisitaModal(false);
        } catch (offlineError) {
          toast.error('Error al guardar visita');
        }
      } else {
        toast.error('Error al guardar formato de visita');
        console.error(error);
      }
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
    
    // Verificar si el TERRENO tiene mejoras asociadas (basado en construcciones)
    const codigoFeature = feature.properties?.codigo_predial || feature.properties?.numero_predial || feature.properties?.codigo;
    const tieneMejoras = terrenoTieneMejora(codigoFeature);
    
    let fillColor = isUrban ? '#3b82f6' : '#22c55e'; // Azul urbano, verde rural
    let borderColor = '#1e40af'; // Borde azul por defecto
    
    // Si el terreno tiene mejoras, usar color cyan distintivo
    if (tieneMejoras) {
      fillColor = '#06b6d4'; // Cyan para terrenos con mejoras
      borderColor = '#0891b2';
    }
    
    if (predio?.estado_visita === 'visitado') {
      fillColor = '#f59e0b'; // Naranja si visitado
    } else if (predio?.estado_visita === 'actualizado') {
      fillColor = '#8b5cf6'; // Púrpura si actualizado
    }
    
    if (isSelected) {
      fillColor = '#ef4444'; // Rojo si seleccionado
      borderColor = '#ef4444';
    }
    
    return {
      fillColor,
      weight: isSelected ? 3 : (tieneMejoras ? 2 : 1),
      opacity: 1,
      color: isSelected ? '#ef4444' : borderColor,
      fillOpacity: isSelected ? 0.6 : (tieneMejoras ? 0.5 : 0.35),
      dashArray: tieneMejoras && !isSelected ? '5, 5' : null // Borde punteado para terrenos con mejoras
    };
  };
  
  // Click en geometría
  const onEachFeature = (feature, layer) => {
    layer.on({
      click: () => {
        setSelectedGeometry(feature);
        
        // Buscar código en las propiedades del feature
        const codigoFeature = feature.properties?.codigo || 
                             feature.properties?.codigo_predial || 
                             feature.properties?.numero_predial ||
                             feature.properties?.CODIGO;
        
        // Buscar predio en datos R1/R2 con matching mejorado (incluye mejoras)
        let predio = prediosR1R2.find(p => {
          const codigoPredio = p.codigo_predial || p.numero_predial;
          // Match exacto
          if (codigoPredio === codigoFeature) return true;
          // Match parcial para mejoras (primeros 21 dígitos)
          if (codigoPredio && codigoFeature && codigoPredio.length >= 21 && codigoFeature.length >= 21) {
            if (codigoPredio.substring(0, 21) === codigoFeature.substring(0, 21)) return true;
          }
          return false;
        });
        
        if (predio) {
          // Asegurar que el predio tenga todos los campos de las propiedades del feature
          const predioCompleto = {
            ...predio,
            codigo_homologado: predio.codigo_homologado || feature.properties?.codigo_homologado || feature.properties?.CODIGO_HOMOLOGADO || ''
          };
          
          // Mostrar panel simplificado directamente (sin modal de tipo revisión)
          setSelectedPredio(predioCompleto);
          setShowDetalleSimplificado(true);
          setShowPredioDetail(false);
          setEditMode(false);
          
          // Cargar datos adicionales
          const codigo = predio.codigo_predial || predio.numero_predial;
          if (codigo) {
            fetchPropuestas(codigo);
            fetchHistorial(codigo);
            verificarConstrucciones(predio);
            cargarVisitaExistente(predio);
          }
        } else {
          // Si no existe en R1/R2, crear objeto básico desde la geometría
          const predioBasico = {
            codigo_predial: codigoFeature || 'Sin código',
            numero_predial: feature.properties?.numero_predial || codigoFeature || '',
            codigo_homologado: feature.properties?.codigo_homologado || feature.properties?.CODIGO_HOMOLOGADO || '',
            direccion: feature.properties?.direccion || '',
            destino_economico: feature.properties?.destino_economico || '',
            area_terreno: feature.properties?.area_terreno || feature.properties?.AREA || feature.properties?.Shape_Area || '',
            area_construida: feature.properties?.area_construida || '',
            estado_visita: 'pendiente',
            propietarios: [],
            zonas_fisicas: []
          };
          
          setSelectedPredio(predioBasico);
          setShowDetalleSimplificado(true);
          setShowPredioDetail(false);
          setEditMode(false);
        }
      }
    });
    
    // Tooltip con el código del predio - DESACTIVADO para mejor rendimiento
    // Los usuarios pueden hacer clic en el polígono para ver detalles
    // Si necesita ver el código, puede habilitarse el tooltip hover más adelante
    /*
    const codigoTooltip = feature.properties?.codigo || 
                         feature.properties?.codigo_predial || 
                         feature.properties?.numero_predial;
    if (codigoTooltip) {
      layer.bindTooltip(codigoTooltip, { permanent: false, direction: 'top' });
    }
    */
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
  
  // Contar predios por estado (memoizado para evitar recálculos innecesarios)
  const estadisticas = useMemo(() => {
    let pendientes = 0;
    let visitados = 0;
    let actualizados = 0;
    
    // Un solo recorrido en lugar de 3 filter separados
    for (const p of prediosR1R2) {
      const estado = p.estado_visita || 'pendiente';
      if (estado === 'pendiente') pendientes++;
      else if (estado === 'visitado') visitados++;
      else if (estado === 'actualizado') actualizados++;
    }
    
    return { pendientes, visitados, actualizados, total: prediosR1R2.length };
  }, [prediosR1R2]);
  
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
  
  // NOTA: La pantalla de sincronización bloqueante (showSyncScreen) ha sido eliminada.
  // Ahora la sincronización se hace automáticamente en segundo plano sin interrumpir al usuario.
  // El indicador de sincronización aparece en la barra superior cuando hay una sincronización activa.

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
        
        {/* GPS Status + Offline Status */}
        <div className="flex items-center gap-2">
          {/* Indicador Offline Ready */}
          {offlineReady && (
            <Badge 
              variant="outline" 
              className="text-xs bg-green-100 text-green-700 border-green-300 cursor-pointer hover:bg-green-200"
              onClick={() => setShowSyncDialog(true)}
              title="Click para ver opciones de sincronización y caché"
            >
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Offline Ready
            </Badge>
          )}
          {/* Indicador cargado desde caché */}
          {loadedFromCache && (
            <Badge 
              variant="outline" 
              className="text-xs bg-purple-100 text-purple-700 border-purple-300 cursor-pointer hover:bg-purple-200"
              onClick={() => setShowSyncDialog(true)}
              title="Click para ver opciones de sincronización y caché"
            >
              <Database className="w-3 h-3 mr-1" />
              Caché
            </Badge>
          )}
          {/* Botón de configuración de sincronización (siempre visible) */}
          {!offlineReady && !loadedFromCache && (
            <Badge 
              variant="outline" 
              className="text-xs bg-slate-100 text-slate-600 border-slate-300 cursor-pointer hover:bg-slate-200"
              onClick={() => setShowSyncDialog(true)}
              title="Click para ver opciones de sincronización y caché"
            >
              <Database className="w-3 h-3 mr-1" />
              Sin datos offline
            </Badge>
          )}
          {/* Indicador Offline */}
          {!isOnline && (
            <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-300">
              <AlertCircle className="w-3 h-3 mr-1" />
              Offline
            </Badge>
          )}
          {/* Descarga en progreso */}
          {isDownloading && (
            <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-300">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              {downloadProgress.phase}
            </Badge>
          )}
          {/* Cambios pendientes con botón de sincronización */}
          {offlineStats.cambiosPendientes > 0 && (
            <Badge 
              variant="outline" 
              className="text-xs bg-blue-100 text-blue-700 border-blue-300 cursor-pointer hover:bg-blue-200"
              onClick={() => setShowSyncDialog(true)}
              title="Click para ver opciones de sincronización"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
              {offlineStats.cambiosPendientes} pendientes
            </Badge>
          )}
          {/* Botón de Sincronizar visible siempre que haya conexión */}
          {isOnline && offlineStats.cambiosPendientes > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncWithHistory}
              disabled={isSyncing}
              className="text-xs bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
              Sincronizar
            </Button>
          )}
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
            className={watchingPosition ? "bg-blue-600 hover:bg-blue-700" : "bg-white border-emerald-500 text-emerald-600 hover:bg-emerald-50"}
            title={watchingPosition ? "Desactivar GPS" : "Activar GPS"}
          >
            <Navigation className={`w-4 h-4 ${watchingPosition ? 'animate-pulse' : ''}`} />
            <span className="hidden sm:inline ml-1 text-xs">{watchingPosition ? 'GPS On' : 'GPS'}</span>
          </Button>
          
          {/* Botón Crear Predio Nuevo */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCrearPredioModal(true)}
            className="bg-emerald-50 border-emerald-500 text-emerald-700 hover:bg-emerald-100"
            title="Crear predio nuevo detectado en campo"
          >
            <Plus className="w-4 h-4" />
            <span className="ml-1 text-xs">Nuevo Predio</span>
          </Button>
          
          {/* Botón Finalizar Proyecto (solo coordinadores) */}
          {(user?.role === 'administrador' || user?.role === 'coordinador') && proyecto?.estado !== 'completado' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFinalizarProyectoModal(true)}
              className="bg-purple-50 border-purple-500 text-purple-700 hover:bg-purple-100"
              title="Finalizar proyecto y migrar a conservación"
            >
              <FileCheck className="w-4 h-4" />
              <span className="ml-1 text-xs">Finalizar</span>
            </Button>
          )}
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
      
      {/* Estadísticas rápidas - clickeables para filtrar (toggle) */}
      <div className="bg-white border-b px-4 py-2 flex gap-4 text-xs overflow-x-auto">
        <button 
          onClick={() => setFilterEstado('todos')}
          className={`flex items-center gap-1 whitespace-nowrap px-2 py-1 rounded transition-colors ${
            filterEstado === 'todos' ? 'bg-slate-200 font-medium' : 'hover:bg-slate-100'
          }`}
        >
          <ListTodo className="w-3 h-3 text-slate-500" />
          <span>Total: {estadisticas.pendientes + estadisticas.visitados + estadisticas.actualizados}</span>
        </button>
        <button 
          onClick={() => setFilterEstado(filterEstado === 'pendiente' ? 'todos' : 'pendiente')}
          className={`flex items-center gap-1 whitespace-nowrap px-2 py-1 rounded transition-colors ${
            filterEstado === 'pendiente' ? 'bg-slate-300 font-medium' : 'hover:bg-slate-100'
          }`}
        >
          <Square className="w-3 h-3 text-slate-400" />
          <span>Pendientes: {estadisticas.pendientes}</span>
          {filterEstado === 'pendiente' && <X className="w-3 h-3 text-slate-500" />}
        </button>
        <button 
          onClick={() => setFilterEstado(filterEstado === 'visitado' ? 'todos' : 'visitado')}
          className={`flex items-center gap-1 whitespace-nowrap px-2 py-1 rounded transition-colors ${
            filterEstado === 'visitado' ? 'bg-amber-300 font-medium' : 'hover:bg-amber-50'
          }`}
        >
          <Eye className="w-3 h-3 text-amber-500" />
          <span>Visitados: {estadisticas.visitados}</span>
          {filterEstado === 'visitado' && <X className="w-3 h-3 text-amber-600" />}
        </button>
        <button 
          onClick={() => setFilterEstado(filterEstado === 'actualizado' ? 'todos' : 'actualizado')}
          className={`flex items-center gap-1 whitespace-nowrap px-2 py-1 rounded transition-colors ${
            filterEstado === 'actualizado' ? 'bg-purple-300 font-medium' : 'hover:bg-purple-50'
          }`}
        >
          <CheckSquare className="w-3 h-3 text-purple-500" />
          <span>Actualizados: {estadisticas.actualizados}</span>
          {filterEstado === 'actualizado' && <X className="w-3 h-3 text-purple-600" />}
        </button>
        
        {/* Separador */}
        <div className="border-l border-slate-300 mx-1"></div>
        
        {/* Botón filtro MEJORAS - Toggle */}
        <button 
          onClick={() => setFilterEstado(filterEstado === 'mejoras' ? 'todos' : 'mejoras')}
          className={`flex items-center gap-1 whitespace-nowrap px-2 py-1 rounded transition-colors ${
            filterEstado === 'mejoras' ? 'bg-cyan-200 font-medium' : 'hover:bg-cyan-50'
          }`}
          title={filterEstado === 'mejoras' ? 'Quitar filtro de mejoras' : 'Filtrar solo predios con mejoras'}
        >
          <Building className="w-3 h-3 text-cyan-600" />
          <span className="text-cyan-700">Mejoras: {contarMejoras}</span>
          {filterEstado === 'mejoras' && <X className="w-3 h-3 text-cyan-600" />}
        </button>
        
        {/* Toggle Construcciones */}
        <button 
          onClick={async () => {
            if (construcciones?.features?.length > 0) {
              // Toggle mostrar/ocultar
              console.log('[Visor] Toggle construcciones:', !showConstrucciones);
              setShowConstrucciones(!showConstrucciones);
            } else {
              // Intentar cargar construcciones del servidor
              console.log('[Visor] Intentando cargar construcciones del servidor...');
              try {
                const token = localStorage.getItem('token');
                const response = await axios.get(`${API}/actualizacion/proyectos/${proyectoId}/geometrias`, {
                  headers: { Authorization: `Bearer ${token}` },
                  params: { offset: 0, limit: 10 }
                });
                if (response.data.construcciones?.features?.length > 0) {
                  setConstrucciones(response.data.construcciones);
                  setShowConstrucciones(true);
                  toast.success(`${response.data.construcciones.features.length} construcciones cargadas`);
                } else {
                  toast.info('Este proyecto no tiene construcciones en la GDB');
                }
              } catch (e) {
                console.error('[Visor] Error cargando construcciones:', e);
                toast.error('Error cargando construcciones');
              }
            }
          }}
          className={`flex items-center gap-1 whitespace-nowrap px-2 py-1 rounded transition-colors ${
            showConstrucciones 
              ? (construccionesFiltradas?.features?.length > 0 ? 'bg-red-200 text-red-800 font-medium' : 'bg-red-100 text-red-600')
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
          title={construcciones?.features?.length > 0 
            ? (showConstrucciones ? 'Ocultar construcciones' : 'Mostrar construcciones')
            : 'Clic para cargar construcciones del servidor'
          }
        >
          <Building2 className="w-3 h-3" />
          <span>{showConstrucciones ? 'Const. ✓' : 'Const.'}</span>
          <span className={`text-[10px] px-1 rounded ${construccionesFiltradas?.features?.length > 0 ? 'bg-red-300' : 'bg-slate-200'}`}>
            {construccionesFiltradas?.features?.length || construcciones?.features?.length || 0}
          </span>
        </button>
        
        {filterEstado !== 'todos' && (
          <span className="text-slate-500 ml-auto flex items-center gap-1 text-[10px]">
            <span className="bg-slate-100 px-2 py-0.5 rounded">
              {filterEstado === 'pendiente' && `${estadisticas.pendientes} predios`}
              {filterEstado === 'visitado' && `${estadisticas.visitados} predios`}
              {filterEstado === 'actualizado' && `${estadisticas.actualizados} predios`}
              {filterEstado === 'mejoras' && `${contarMejoras} mejoras`}
              {' → '}
              <strong className="text-slate-700">{geometriasFiltradas?.features?.length || 0} con GDB</strong>
            </span>
            <button 
              onClick={() => setFilterEstado('todos')}
              className="text-red-500 hover:text-red-700 ml-1"
              title="Quitar filtro"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        )}
      </div>
      
      {/* Map Container */}
      <div className="flex-1 relative">
        {/* Indicador discreto de sincronización en segundo plano */}
        {isBackgroundSyncing && (
          <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-[500]">
            <div className="bg-blue-500/90 text-white px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 text-sm animate-pulse">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>{backgroundSyncMessage || 'Sincronizando...'}</span>
            </div>
          </div>
        )}
        
        <MapContainer
          center={mapCenter}
          zoom={currentZoom}
          className="h-full w-full"
          ref={mapRef}
          zoomControl={false}
          preferCanvas={true}
          keyboard={false}
        >
          <MapController
            onLocationFound={(latlng) => setUserPosition([latlng.lat, latlng.lng])}
            setCurrentZoom={setCurrentZoom}
            flyToPosition={flyToPosition}
            fitToBounds={fitToBounds}
            onMapReady={(map) => { mapRef.current = map; }}
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
          
          {/* CAPA PERÍMETRO - Se renderiza primero (al fondo) */}
          {geometriasPerimetro && geometriasPerimetro.features?.length > 0 && (
            <GeoJSON
              key={`perimetro-${filterZona}-${geometriasPerimetro.features.length}`}
              data={geometriasPerimetro}
              style={{
                fillColor: '#f97316',  // Naranja
                weight: 2,
                color: '#ea580c',
                fillOpacity: 0.15,     // Muy transparente
                dashArray: '10, 5',    // Línea discontinua
                interactive: false     // No bloquea interacción
              }}
            />
          )}
          
          {/* CAPA CONSTRUCCIONES - Segunda capa (encima del perímetro) */}
          {showConstrucciones && construccionesFiltradas && construccionesFiltradas.features?.length > 0 && (
            <GeoJSON
              key={`const-${filterEstado}-${construccionesVersion}-${construccionesFiltradas.features.length}`}
              data={construccionesFiltradas}
              style={(feature) => ({
                fillColor: '#dc2626',
                weight: 1,
                color: '#7f1d1d',
                fillOpacity: 0.4,
                interactive: false  // No captura eventos - permite interacción con capas debajo
              })}
            />
          )}
          
          {/* CAPA GEOMETRÍAS (TERRENOS) - Tercera capa (encima de todo, interactiva) */}
          {geometriasNormales && geometriasNormales.features?.length > 0 && (
            <GeoJSON
              key={`geom-${filterZona}-${filterEstado}-${geometriasNormales.features.length}`}
              data={geometriasNormales}
              style={getGeometryStyle}
              onEachFeature={onEachFeature}
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
        <div className="map-controls absolute top-4 right-4 flex flex-col gap-2 z-[400]">
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
          
          <Button
            variant={watchingPosition ? "default" : "outline"}
            size="sm"
            onClick={() => {
              if (!watchingPosition) {
                // Si GPS no está activo, activarlo
                startWatchingPosition();
              } else if (userPosition) {
                // Si GPS activo y hay posición, centrar mapa
                centerOnUser();
              }
            }}
            className={`w-9 h-9 p-0 shadow-lg ${watchingPosition ? 'bg-blue-600 hover:bg-blue-700' : 'bg-white'}`}
            title={watchingPosition ? (userPosition ? "Centrar en mi ubicación" : "Obteniendo ubicación...") : "Activar GPS y centrar"}
          >
            <Locate className={`w-4 h-4 ${watchingPosition ? 'text-white animate-pulse' : ''}`} />
          </Button>
        </div>
        
        {/* Panel Ortofoto */}
        <div className="map-controls absolute top-4 right-16 z-[400]">
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
                  <ImageIcon className="w-3 h-3 mr-1" />
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
        <div className="map-controls absolute top-4 left-4 z-[400] flex gap-2">
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
        <div className="map-controls absolute bottom-4 left-4 right-4 z-[400]">
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
                      <ImageIcon className="w-3 h-3 text-indigo-500" />
                      <span className="text-slate-600">Ortofoto</span>
                    </div>
                  )}
                </div>
                <span className="text-slate-400">Zoom: {currentZoom}</span>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Panel de Detalle Simplificado (como Conservación) - Overlay en el mapa */}
        {selectedPredio && showDetalleSimplificado && !showPredioDetail && (
          <div className="absolute top-4 left-48 z-[500] max-w-xs">
            <DetallePredioActualizacion
              predio={selectedPredio}
              geometry={selectedGeometry}
              construcciones={construccionesPredio}
              tieneConstrucciones={tieneConstrucciones}
              mostrarConstrucciones={mostrarConstruccionesPredio}
              cargandoConstrucciones={cargandoConstrucciones}
              onToggleConstrucciones={toggleConstruccionesPredio}
              onClose={cerrarDetalleSimplificado}
              onOpenVisita={abrirFormularioVisita}
              onOpenVisitaMejora={(mejora) => {
                // Obtener el código de la mejora
                const codigoMejora = mejora?.properties?.codigo || '';
                console.log('[Visor] Abriendo visita para mejora:', codigoMejora);
                
                // Buscar el predio R1/R2 con el código de la mejora
                const predioMejora = prediosR1R2.find(p => {
                  const codigoPredio = p.codigo_predial || p.numero_predial;
                  // Match exacto primero
                  if (codigoPredio === codigoMejora) return true;
                  // Match parcial (por si el código tiene variaciones)
                  if (codigoPredio && codigoMejora && codigoPredio.length >= 27 && codigoMejora.length >= 27) {
                    // Comparar los primeros 27 dígitos (hasta código de mejora)
                    if (codigoPredio.substring(0, 27) === codigoMejora.substring(0, 27)) return true;
                  }
                  return false;
                });
                
                console.log('[Visor] Predio R1/R2 encontrado para mejora:', predioMejora);
                
                setMejoraSeleccionada(mejora);
                setPredioMejoraSeleccionada(predioMejora || null);
                setTipoVisita('mejora');
                setShowVisitaModal(true);
                setShowDetalleSimplificado(false);
              }}
              onOpenEdicion={abrirEdicionPredio}
              onOpenHistorial={abrirHistorial}
              onOpenCancelar={abrirCancelarModal}
              terrenoTieneMejoras={terrenoTieneMejora(selectedPredio?.codigo_predial || selectedPredio?.numero_predial)}
              mejorasDelTerreno={getMejorasDeTerreno(selectedPredio?.codigo_predial || selectedPredio?.numero_predial)}
              user={user}
            />
          </div>
        )}
      </div>
      
      {/* El formulario de visita original se usa desde showVisitaModal más abajo */}
      
      {/* Modal de detalle/edición de predio */}
      <Dialog open={showPredioDetail} onOpenChange={(open) => {
        setShowPredioDetail(open);
        if (!open) setEditMode(false);
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Home className={`w-5 h-5 ${terrenoTieneMejora(selectedPredio?.codigo_predial || selectedPredio?.numero_predial) ? 'text-cyan-600' : 'text-amber-600'}`} />
                {editMode ? 'Editar Predio' : 'Detalle del Terreno'}
                {terrenoTieneMejora(selectedPredio?.codigo_predial || selectedPredio?.numero_predial) && (
                  <Badge className="bg-cyan-500 text-white text-xs">CON MEJORAS</Badge>
                )}
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
              <div className={`p-3 rounded-lg ${terrenoTieneMejora(selectedPredio.codigo_predial || selectedPredio.numero_predial) ? 'bg-cyan-50' : 'bg-amber-50'}`}>
                <p className={`text-xs uppercase font-medium ${terrenoTieneMejora(selectedPredio.codigo_predial || selectedPredio.numero_predial) ? 'text-cyan-600' : 'text-amber-600'}`}>
                  Código Predial (Terreno)
                </p>
                <p className={`font-mono text-lg font-bold ${terrenoTieneMejora(selectedPredio.codigo_predial || selectedPredio.numero_predial) ? 'text-cyan-800' : 'text-amber-800'}`}>
                  {selectedPredio.codigo_predial || selectedPredio.numero_predial || 'N/A'}
                </p>
              </div>
              
              {!editMode ? (
                // Modo visualización (igual que antes pero con tabs de zonas)
                <Tabs defaultValue="general" className="w-full">
                  <TabsList className="grid grid-cols-8 w-full">
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="propietarios">Propietarios</TabsTrigger>
                    <TabsTrigger value="fisico">Físico</TabsTrigger>
                    <TabsTrigger 
                      value="mejoras" 
                      className={terrenoTieneMejora(selectedPredio?.codigo_predial || selectedPredio?.numero_predial) ? 'data-[state=active]:bg-cyan-100 text-cyan-700' : ''}
                    >
                      Mejoras {terrenoTieneMejora(selectedPredio?.codigo_predial || selectedPredio?.numero_predial) && 
                        <Badge className="ml-1 bg-cyan-500 text-white text-[10px] px-1">
                          {getMejorasDeTerreno(selectedPredio?.codigo_predial || selectedPredio?.numero_predial).length}
                        </Badge>
                      }
                    </TabsTrigger>
                    <TabsTrigger value="linderos">Linderos</TabsTrigger>
                    <TabsTrigger value="coordenadas">Coordenadas</TabsTrigger>
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
                        <p className="text-xs text-slate-400">Use &quot;Editar&quot; para agregar propietarios</p>
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
                        <p className="text-xs text-slate-400">Use &quot;Editar&quot; para agregar zonas</p>
                      </div>
                    )}
                  </TabsContent>
                  
                  {/* Tab Mejoras - Construcciones con código de mejora */}
                  <TabsContent value="mejoras" className="mt-3 space-y-3">
                    {(() => {
                      const mejoras = getMejorasDeTerreno(selectedPredio?.codigo_predial || selectedPredio?.numero_predial);
                      if (mejoras.length === 0) {
                        return (
                          <div className="text-center py-6 text-slate-400">
                            <Building className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                            <p className="text-sm">Este terreno no tiene mejoras registradas</p>
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-cyan-700">
                              <Building className="w-4 h-4 inline mr-1" />
                              {mejoras.length} Mejora(s) encontrada(s)
                            </p>
                          </div>
                          {mejoras.map((mejora, idx) => {
                            const props = mejora.properties || {};
                            const codigoMejora = props.codigo || '';
                            const numMejora = codigoMejora.substring(27, 30);
                            return (
                              <Card key={idx} className="border-cyan-200 bg-cyan-50/50">
                                <CardContent className="p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <Badge className="bg-cyan-500 text-white">
                                      Mejora #{numMejora}
                                    </Badge>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      className="h-7 text-xs border-cyan-300 text-cyan-700"
                                      onClick={() => {
                                        // Abrir formulario de visita para esta mejora específica
                                        const codigoMej = mejora?.properties?.codigo || '';
                                        // Buscar predio R1/R2 de la mejora
                                        const predioMej = prediosR1R2.find(p => {
                                          const cod = p.codigo_predial || p.numero_predial;
                                          if (cod === codigoMej) return true;
                                          if (cod && codigoMej && cod.length >= 27 && codigoMej.length >= 27) {
                                            if (cod.substring(0, 27) === codigoMej.substring(0, 27)) return true;
                                          }
                                          return false;
                                        });
                                        setMejoraSeleccionada(mejora);
                                        setPredioMejoraSeleccionada(predioMej || null);
                                        setTipoVisita('mejora');
                                        setShowVisitaModal(true);
                                        setShowPredioDetail(false);
                                      }}
                                    >
                                      <ClipboardList className="w-3 h-3 mr-1" />
                                      Visita Mejora
                                    </Button>
                                  </div>
                                  <p className="font-mono text-xs text-cyan-800 break-all mb-2">
                                    {codigoMejora}
                                  </p>
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    {props.num_pisos && (
                                      <span><strong>Pisos:</strong> {props.num_pisos}</span>
                                    )}
                                    {props.area_construida && (
                                      <span><strong>Área:</strong> {Number(props.area_construida).toLocaleString()} m²</span>
                                    )}
                                    {props.tipo_construccion && (
                                      <span><strong>Tipo:</strong> {props.tipo_construccion}</span>
                                    )}
                                    {props.uso && (
                                      <span><strong>Uso:</strong> {props.uso}</span>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </TabsContent>
                  
                  {/* Tab Linderos */}
                  <TabsContent value="linderos" className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-slate-500 font-medium">Norte</p>
                        <p className="text-sm bg-slate-50 p-2 rounded border min-h-[60px]">
                          {selectedPredio.lindero_norte || <span className="text-slate-400 italic">Sin información</span>}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-slate-500 font-medium">Sur</p>
                        <p className="text-sm bg-slate-50 p-2 rounded border min-h-[60px]">
                          {selectedPredio.lindero_sur || <span className="text-slate-400 italic">Sin información</span>}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-slate-500 font-medium">Este</p>
                        <p className="text-sm bg-slate-50 p-2 rounded border min-h-[60px]">
                          {selectedPredio.lindero_este || <span className="text-slate-400 italic">Sin información</span>}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-slate-500 font-medium">Oeste</p>
                        <p className="text-sm bg-slate-50 p-2 rounded border min-h-[60px]">
                          {selectedPredio.lindero_oeste || <span className="text-slate-400 italic">Sin información</span>}
                        </p>
                      </div>
                    </div>
                    
                    {selectedPredio.observaciones_linderos && (
                      <div className="space-y-1">
                        <p className="text-xs text-slate-500 font-medium">Observaciones de Linderos</p>
                        <p className="text-sm bg-amber-50 p-2 rounded border border-amber-200">
                          {selectedPredio.observaciones_linderos}
                        </p>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-4 pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${selectedPredio.linderos_verificados ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                        <span className="text-sm text-slate-600">
                          {selectedPredio.linderos_verificados ? 'Verificados en campo' : 'No verificados'}
                        </span>
                      </div>
                      {selectedPredio.fecha_verificacion_linderos && (
                        <span className="text-xs text-slate-500">
                          Fecha: {new Date(selectedPredio.fecha_verificacion_linderos).toLocaleDateString('es-ES')}
                        </span>
                      )}
                    </div>
                    
                    {!selectedPredio.lindero_norte && !selectedPredio.lindero_sur && !selectedPredio.lindero_este && !selectedPredio.lindero_oeste && (
                      <div className="text-center py-4">
                        <p className="text-sm text-slate-500">Sin información de linderos registrada</p>
                        <p className="text-xs text-slate-400">Use "Editar" para agregar linderos</p>
                      </div>
                    )}
                  </TabsContent>
                  
                  {/* Tab Coordenadas */}
                  <TabsContent value="coordenadas" className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-slate-500 font-medium">Sistema de Referencia</p>
                        <p className="text-sm font-medium">{selectedPredio.sistema_referencia || 'MAGNA-SIRGAS'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-slate-500 font-medium">Precisión GPS</p>
                        <p className="text-sm font-medium">
                          {selectedPredio.precision_gps ? (
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              selectedPredio.precision_gps === 'alta' ? 'bg-emerald-100 text-emerald-700' :
                              selectedPredio.precision_gps === 'media' ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {selectedPredio.precision_gps.charAt(0).toUpperCase() + selectedPredio.precision_gps.slice(1)}
                            </span>
                          ) : '-'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                      <p className="text-xs text-slate-500 font-medium">Coordenadas del Centroide</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-slate-400">Latitud (Y)</p>
                          <p className="text-sm font-mono font-medium">
                            {selectedPredio.latitud_centroide ? Number(selectedPredio.latitud_centroide).toFixed(6) : '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Longitud (X)</p>
                          <p className="text-sm font-mono font-medium">
                            {selectedPredio.longitud_centroide ? Number(selectedPredio.longitud_centroide).toFixed(6) : '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-slate-500 font-medium">Área Calculada</p>
                        <p className="text-sm font-medium">
                          {selectedPredio.area_calculada ? `${Number(selectedPredio.area_calculada).toLocaleString()} m²` : '-'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-slate-500 font-medium">Equipo Utilizado</p>
                        <p className="text-sm">{selectedPredio.equipo_gps || '-'}</p>
                      </div>
                    </div>
                    
                    {selectedPredio.vertices_poligono && selectedPredio.vertices_poligono.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-500 font-medium">Vértices del Polígono ({selectedPredio.vertices_poligono.length} puntos)</p>
                        <div className="max-h-32 overflow-y-auto bg-slate-50 rounded border p-2">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-1 px-2">#</th>
                                <th className="text-left py-1 px-2">X (Longitud)</th>
                                <th className="text-left py-1 px-2">Y (Latitud)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedPredio.vertices_poligono.map((v, idx) => (
                                <tr key={idx} className="border-b border-slate-100">
                                  <td className="py-1 px-2 font-medium">{idx + 1}</td>
                                  <td className="py-1 px-2 font-mono">{Number(v.x).toFixed(6)}</td>
                                  <td className="py-1 px-2 font-mono">{Number(v.y).toFixed(6)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    
                    {selectedPredio.fecha_captura_coordenadas && (
                      <div className="text-xs text-slate-500 pt-2 border-t">
                        Fecha de captura: {new Date(selectedPredio.fecha_captura_coordenadas).toLocaleDateString('es-ES')}
                      </div>
                    )}
                    
                    {!selectedPredio.latitud_centroide && !selectedPredio.longitud_centroide && (
                      <div className="text-center py-4">
                        <p className="text-sm text-slate-500">Sin coordenadas registradas</p>
                        <p className="text-xs text-slate-400">Use "Editar" para agregar coordenadas</p>
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
                                <p className="text-xs text-slate-500 mt-1">Por: {prop.creado_por_nombre || prop.creado_por}</p>
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
                                {entry.usuario_nombre || entry.usuario} • {new Date(entry.fecha).toLocaleString('es-CO')}
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
                  <TabsList className="grid grid-cols-5 w-full">
                    <TabsTrigger value="propietarios">Propietarios</TabsTrigger>
                    <TabsTrigger value="predio">Predio</TabsTrigger>
                    <TabsTrigger value="fisico">Zonas Físicas</TabsTrigger>
                    <TabsTrigger value="linderos">Linderos</TabsTrigger>
                    <TabsTrigger value="coordenadas">Coordenadas</TabsTrigger>
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
                            <SelectItem value="P">P - Uso Público</SelectItem>
                            <SelectItem value="Q">Q - Lote Urbanizable No Urbanizado</SelectItem>
                            <SelectItem value="R">R - Lote Urbanizado No Edificado</SelectItem>
                            <SelectItem value="S">S - Lote No Urbanizable</SelectItem>
                            <SelectItem value="T">T - Servicios Especiales</SelectItem>
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
                  
                  {/* Tab Linderos - Edición */}
                  <TabsContent value="linderos" className="space-y-4 mt-4">
                    <h4 className="font-semibold text-slate-800">Linderos del Predio</h4>
                    <p className="text-xs text-slate-500">Describa los límites del predio con los predios colindantes</p>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs">Lindero Norte</Label>
                        <textarea 
                          className="w-full min-h-[80px] p-2 text-sm border rounded-md resize-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          placeholder="Ej: Colinda con predio de Juan Pérez, código 540030001..."
                          value={editData.lindero_norte || ''}
                          onChange={(e) => setEditData({...editData, lindero_norte: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Lindero Sur</Label>
                        <textarea 
                          className="w-full min-h-[80px] p-2 text-sm border rounded-md resize-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          placeholder="Ej: Colinda con vía pública, calle 5..."
                          value={editData.lindero_sur || ''}
                          onChange={(e) => setEditData({...editData, lindero_sur: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Lindero Este</Label>
                        <textarea 
                          className="w-full min-h-[80px] p-2 text-sm border rounded-md resize-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          placeholder="Ej: Colinda con quebrada La Honda..."
                          value={editData.lindero_este || ''}
                          onChange={(e) => setEditData({...editData, lindero_este: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Lindero Oeste</Label>
                        <textarea 
                          className="w-full min-h-[80px] p-2 text-sm border rounded-md resize-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          placeholder="Ej: Colinda con predio de María García..."
                          value={editData.lindero_oeste || ''}
                          onChange={(e) => setEditData({...editData, lindero_oeste: e.target.value})}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-xs">Observaciones de Linderos</Label>
                      <textarea 
                        className="w-full min-h-[60px] p-2 text-sm border rounded-md resize-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        placeholder="Notas adicionales sobre los límites del predio..."
                        value={editData.observaciones_linderos || ''}
                        onChange={(e) => setEditData({...editData, observaciones_linderos: e.target.value})}
                      />
                    </div>
                    
                    <div className="flex items-center gap-4 pt-2 border-t">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          checked={editData.linderos_verificados || false}
                          onChange={(e) => setEditData({...editData, linderos_verificados: e.target.checked})}
                        />
                        <span className="text-sm text-slate-700">Linderos verificados en campo</span>
                      </label>
                      
                      {editData.linderos_verificados && (
                        <div>
                          <Label className="text-xs">Fecha verificación</Label>
                          <Input 
                            type="date" 
                            className="w-40"
                            value={editData.fecha_verificacion_linderos || ''}
                            onChange={(e) => setEditData({...editData, fecha_verificacion_linderos: e.target.value})}
                          />
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  
                  {/* Tab Coordenadas - Edición */}
                  <TabsContent value="coordenadas" className="space-y-4 mt-4">
                    <h4 className="font-semibold text-slate-800">Georreferenciación del Predio</h4>
                    <p className="text-xs text-slate-500">Capture las coordenadas del predio utilizando GPS</p>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs">Sistema de Referencia</Label>
                        <select 
                          className="w-full h-10 px-3 py-2 text-sm border rounded-md bg-background focus:ring-2 focus:ring-emerald-500"
                          value={editData.sistema_referencia || 'MAGNA-SIRGAS'}
                          onChange={(e) => setEditData({...editData, sistema_referencia: e.target.value})}
                        >
                          <option value="MAGNA-SIRGAS">MAGNA-SIRGAS</option>
                          <option value="WGS84">WGS84</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs">Precisión GPS</Label>
                        <select 
                          className="w-full h-10 px-3 py-2 text-sm border rounded-md bg-background focus:ring-2 focus:ring-emerald-500"
                          value={editData.precision_gps || ''}
                          onChange={(e) => setEditData({...editData, precision_gps: e.target.value})}
                        >
                          <option value="">Seleccione...</option>
                          <option value="alta">Alta (±1m)</option>
                          <option value="media">Media (±5m)</option>
                          <option value="baja">Baja (±10m+)</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <p className="text-sm font-medium text-slate-700">Coordenadas del Centroide</p>
                        {userPosition && (
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            onClick={() => setEditData({
                              ...editData, 
                              latitud_centroide: userPosition[0].toFixed(6),
                              longitud_centroide: userPosition[1].toFixed(6),
                              fecha_captura_coordenadas: new Date().toISOString().split('T')[0]
                            })}
                            className="text-blue-600 border-blue-300"
                          >
                            <MapPin className="w-4 h-4 mr-1" />
                            Usar ubicación actual
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs">Latitud (Y)</Label>
                          <Input 
                            type="number" 
                            step="0.000001"
                            placeholder="Ej: 8.123456"
                            value={editData.latitud_centroide || ''}
                            onChange={(e) => setEditData({...editData, latitud_centroide: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Longitud (X)</Label>
                          <Input 
                            type="number" 
                            step="0.000001"
                            placeholder="Ej: -73.123456"
                            value={editData.longitud_centroide || ''}
                            onChange={(e) => setEditData({...editData, longitud_centroide: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs">Área Calculada (m²)</Label>
                        <Input 
                          type="number" 
                          placeholder="Área según medición GPS"
                          value={editData.area_calculada || ''}
                          onChange={(e) => setEditData({...editData, area_calculada: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Equipo GPS Utilizado</Label>
                        <Input 
                          placeholder="Ej: GPS Garmin 64s"
                          value={editData.equipo_gps || ''}
                          onChange={(e) => setEditData({...editData, equipo_gps: e.target.value})}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-xs">Fecha de Captura</Label>
                      <Input 
                        type="date" 
                        className="w-48"
                        value={editData.fecha_captura_coordenadas || ''}
                        onChange={(e) => setEditData({...editData, fecha_captura_coordenadas: e.target.value})}
                      />
                    </div>
                    
                    {userPosition && (
                      <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Ubicación GPS detectada: {userPosition[0].toFixed(6)}, {userPosition[1].toFixed(6)}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              )}
              
              {/* Indicador de Cambios Sugeridos (si existen) */}
              {selectedPredio?.cambios_sugeridos && Object.keys(selectedPredio.cambios_sugeridos).length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-amber-800 flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    Cambios Sugeridos Detectados ({Object.keys(selectedPredio.cambios_sugeridos).length})
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(selectedPredio.cambios_sugeridos).map(([campo, info]) => (
                      <div key={campo} className="text-sm bg-white rounded p-2 border border-amber-100">
                        <span className="font-medium text-amber-700">{info.campo}:</span>
                        <span className="text-slate-500 ml-2">{info.valor_actual}</span>
                        <span className="text-amber-600 mx-2">→</span>
                        <span className="text-emerald-700 font-medium">{info.valor_propuesto}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-amber-600 mt-2">* Estos cambios serán aplicados cuando el Coordinador los apruebe</p>
                </div>
              )}
              
              {/* Indicador de Cambios Jurídicos Pendientes */}
              {selectedPredio?.cambios_juridicos && Object.keys(selectedPredio.cambios_juridicos).length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-purple-800 flex items-center gap-2 mb-2">
                    <Scale className="w-4 h-4" />
                    Cambios Jurídicos Pendientes de Revisión
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(selectedPredio.cambios_juridicos).map(([campo, info]) => (
                      <div key={campo} className="text-sm bg-white rounded p-2 border border-purple-100">
                        <span className="font-medium text-purple-700">{info.campo}</span>
                        {info.nota && <p className="text-xs text-purple-500 mt-1">{info.nota}</p>}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-purple-600 mt-2">* Requieren verificación documental antes de aplicar</p>
                </div>
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
                    
                    {/* Botón Formato de Visita - Visible si NO está actualizado (aprobado) */}
                    {selectedPredio.estado_visita !== 'actualizado' && (
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setShowPredioDetail(false);
                          setShowFormularioVisita(true);
                        }}
                        disabled={saving}
                        className={`flex-1 ${selectedPredio.estado_visita === 'visitado' 
                          ? 'border-blue-500 text-blue-700 hover:bg-blue-50' 
                          : 'border-emerald-500 text-emerald-700 hover:bg-emerald-50'}`}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        {selectedPredio.estado_visita === 'visitado' ? 'Editar Visita' : 'Registrar Visita'}
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
                    
                    {/* Botón Cancelar Predio - Solo si NO está cancelado ni tiene propuesta pendiente */}
                    {!selectedPredio.cancelado && !selectedPredio.deleted && !selectedPredio.propuesta_cancelacion_pendiente && (
                      <Button 
                        variant="outline"
                        onClick={abrirCancelarModal}
                        className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {user?.role === 'coordinador' || user?.role === 'administrador' ? 'Cancelar' : 'Proponer Cancelación'}
                      </Button>
                    )}
                    
                    {/* Indicador de propuesta de cancelación pendiente */}
                    {selectedPredio.propuesta_cancelacion_pendiente && (
                      <div className="flex-1 flex items-center justify-center text-amber-600 text-sm">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        Cancelación pendiente de aprobación
                      </div>
                    )}
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                Formato de Visita - Actualización Catastral
              </div>
              <div className="flex items-center gap-2 text-sm font-normal">
                <span className="text-slate-500">Página</span>
                <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold">{visitaPagina}/5</span>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {selectedPredio && (
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              
              {/* ========== PÁGINA 1: Información del Predio ========== */}
              {visitaPagina === 1 && (
                <>
                  {/* DATOS DE LA VISITA - Ahora al inicio */}
                  <div className="border-2 border-blue-300 rounded-lg overflow-hidden bg-blue-50/50">
                    <div className="bg-blue-100 px-4 py-2 border-b border-blue-300">
                      <h3 className="font-semibold text-blue-800 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        1. DATOS DE LA VISITA
                      </h3>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label className="text-xs text-slate-500">Fecha de Visita *</Label>
                          <Input type="date" value={visitaData.fecha_visita} onChange={(e) => setVisitaData(prev => ({ ...prev, fecha_visita: e.target.value }))} className="bg-white" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Hora *</Label>
                          <Input type="time" value={visitaData.hora_visita} onChange={(e) => setVisitaData(prev => ({ ...prev, hora_visita: e.target.value }))} className="bg-white" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Persona que Atiende *</Label>
                          <DebouncedInput 
                            value={visitaData.persona_atiende} 
                            onChange={(val) => setVisitaData(prev => ({ ...prev, persona_atiende: val }))} 
                            placeholder="NOMBRE COMPLETO" 
                            uppercase={true}
                            className="uppercase bg-white" 
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-slate-500 mb-1 block">Relación con el Predio</Label>
                          <div className="flex flex-wrap gap-3">
                            {[{v:'propietario',l:'Propietario'},{v:'poseedor',l:'Poseedor'},{v:'arrendatario',l:'Arrendatario'},{v:'familiar',l:'Familiar'},{v:'encargado',l:'Encargado'},{v:'otro',l:'Otro'}].map(i => (
                              <label key={i.v} className="flex items-center gap-1.5 cursor-pointer text-sm">
                                <input type="radio" name="relacion_p1" checked={visitaData.relacion_predio === i.v} onChange={() => setVisitaData(prev => ({ ...prev, relacion_predio: i.v }))} className="text-blue-600" />
                                {i.l}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500 mb-1 block">¿Se pudo acceder al predio?</Label>
                          <div className="flex gap-4">
                            {[{v:'si',l:'Sí'},{v:'parcial',l:'Parcial'},{v:'no',l:'No'}].map(i => (
                              <label key={i.v} className="flex items-center gap-1.5 cursor-pointer text-sm">
                                <input type="radio" name="acceso_p1" checked={visitaData.acceso_predio === i.v} onChange={() => setVisitaData(prev => ({ ...prev, acceso_predio: i.v }))} className="text-blue-600" />
                                {i.l}
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sección 2: Información Básica */}
                  <div className="border border-emerald-200 rounded-lg overflow-hidden">
                    <div className="bg-emerald-50 px-4 py-2 border-b border-emerald-200">
                      <h3 className="font-semibold text-emerald-800 flex items-center gap-2">
                        <Building className="w-4 h-4" />
                        2. INFORMACIÓN BÁSICA DEL {tipoVisita === 'mejora' ? 'MEJORA' : 'PREDIO'}
                        {tipoVisita === 'mejora' && (
                          <Badge className="bg-cyan-500 text-white text-xs ml-2">MEJORA</Badge>
                        )}
                      </h3>
                    </div>
                    <div className="p-4 space-y-4">
                      {/* Información del predio base (cuando es mejora) */}
                      {tipoVisita === 'mejora' && (
                        <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 mb-4">
                          <p className="text-xs text-cyan-700 font-medium mb-1">Terreno Base:</p>
                          <p className="font-mono text-xs text-cyan-800">{selectedPredio?.codigo_predial || selectedPredio?.numero_predial || 'N/A'}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-slate-500">Departamento</Label>
                          <Input value="Norte de Santander" disabled className="bg-slate-100 font-medium" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Municipio</Label>
                          <Input value={proyecto?.municipio || (tipoVisita === 'mejora' ? predioMejoraSeleccionada?.municipio : selectedPredio?.municipio) || ''} disabled className="bg-slate-100 font-medium" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">
                          Número Predial (30 dígitos) {tipoVisita === 'mejora' && <span className="text-cyan-600 font-medium">- CÓDIGO DE LA MEJORA</span>}
                        </Label>
                        <Input 
                          value={tipoVisita === 'mejora' 
                            ? (mejoraSeleccionada?.properties?.codigo || predioMejoraSeleccionada?.codigo_predial || '') 
                            : (selectedPredio?.codigo_predial || selectedPredio?.numero_predial || '')} 
                          disabled 
                          className={`bg-slate-100 font-mono font-bold tracking-wider ${tipoVisita === 'mejora' ? 'text-cyan-800 border-cyan-300' : 'text-emerald-800'}`} 
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label className="text-xs text-slate-500">Código Homologado</Label>
                          <Input value={(tipoVisita === 'mejora' ? predioMejoraSeleccionada?.codigo_homologado : selectedPredio?.codigo_homologado) || 'Sin código'} disabled className="bg-slate-100 font-mono" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Tipo <span className="text-emerald-600">(verificar)</span></Label>
                          <div className="flex items-center gap-4 h-10">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="radio" name="tipo_predio" checked={visitaData.tipo_predio === 'PH'} onChange={() => setVisitaData(prev => ({ ...prev, tipo_predio: 'PH' }))} className="text-emerald-600" />
                              <span className="text-sm">PH</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="radio" name="tipo_predio" checked={visitaData.tipo_predio === 'NPH'} onChange={() => setVisitaData(prev => ({ ...prev, tipo_predio: 'NPH' }))} className="text-emerald-600" />
                              <span className="text-sm">NPH</span>
                            </label>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Ubicación</Label>
                          <div className="flex items-center gap-4 h-10">
                            <label className="flex items-center gap-2">
                              <input type="radio" checked={selectedPredio.zona === 'urbano' || (selectedPredio.codigo_predial && selectedPredio.codigo_predial.substring(5, 7) === '01')} disabled className="text-emerald-600" />
                              <span className="text-sm">Urbano</span>
                            </label>
                            <label className="flex items-center gap-2">
                              <input type="radio" checked={selectedPredio.zona === 'rural' || (selectedPredio.codigo_predial && selectedPredio.codigo_predial.substring(5, 7) === '00')} disabled className="text-emerald-600" />
                              <span className="text-sm">Rural</span>
                            </label>
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Dirección <span className="text-emerald-600">(verificar)</span></Label>
                        <DebouncedInput 
                          value={visitaData.direccion_visita} 
                          onChange={(val) => setVisitaData(prev => ({ ...prev, direccion_visita: val }))} 
                          placeholder="Dirección" 
                          uppercase={true}
                          className="uppercase" 
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500 mb-2 block">Destino Económico <span className="text-emerald-600">(verificar)</span></Label>
                        <div className="grid grid-cols-4 gap-2">
                          {[{v:'A',l:'A - Habitacional'},{v:'B',l:'B - Industrial'},{v:'C',l:'C - Comercial'},{v:'D',l:'D - Agropecuario'},{v:'E',l:'E - Minero'},{v:'F',l:'F - Cultural'},{v:'G',l:'G - Recreacional'},{v:'H',l:'H - Salubridad'},{v:'I',l:'I - Institucional'},{v:'J',l:'J - Educativo'},{v:'K',l:'K - Religioso'},{v:'L',l:'L - Agrícola'},{v:'M',l:'M - Pecuario'},{v:'N',l:'N - Agroindustrial'},{v:'O',l:'O - Forestal'},{v:'P',l:'P - Uso Público'},{v:'Q',l:'Q - Lote Urbanizable No Urbanizado'},{v:'R',l:'R - Lote Urbanizado No Edificado'},{v:'S',l:'S - Lote No Urbanizable'},{v:'T',l:'T - Servicios Especiales'}].map(i => (
                            <label key={i.v} className="flex items-center gap-2 cursor-pointer">
                              <input type="radio" name="destino" checked={visitaData.destino_economico_visita === i.v} onChange={() => setVisitaData(prev => ({ ...prev, destino_economico_visita: i.v }))} className="text-emerald-600" />
                              <span className="text-xs">{i.l}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-slate-500">Área Terreno (m²)</Label>
                          <Input type="number" step="0.01" value={visitaData.area_terreno_visita} onChange={(e) => setVisitaData(prev => ({ ...prev, area_terreno_visita: e.target.value }))} placeholder="0.00" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Área Construida (m²)</Label>
                          <Input type="number" step="0.01" value={visitaData.area_construida_visita} onChange={(e) => setVisitaData(prev => ({ ...prev, area_construida_visita: e.target.value }))} placeholder="0.00" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sección 3: PH */}
                  {visitaData.tipo_predio === 'PH' && (
                    <div className="border border-purple-200 rounded-lg overflow-hidden">
                      <div className="bg-purple-50 px-4 py-2 border-b border-purple-200">
                        <h3 className="font-semibold text-purple-800 flex items-center gap-2">
                          <Building className="w-4 h-4" />
                          3. PH (Propiedad Horizontal)
                        </h3>
                      </div>
                      <div className="p-4 space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label className="text-xs text-slate-500">Área por Coeficiente</Label>
                            <Input type="number" step="0.01" value={visitaData.ph_area_coeficiente} onChange={(e) => setVisitaData(prev => ({ ...prev, ph_area_coeficiente: e.target.value }))} placeholder="0.00" />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Área Construida Privada</Label>
                            <Input type="number" step="0.01" value={visitaData.ph_area_construida_privada} onChange={(e) => setVisitaData(prev => ({ ...prev, ph_area_construida_privada: e.target.value }))} placeholder="0.00" />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Área Construida Común</Label>
                            <Input type="number" step="0.01" value={visitaData.ph_area_construida_comun} onChange={(e) => setVisitaData(prev => ({ ...prev, ph_area_construida_comun: e.target.value }))} placeholder="0.00" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs text-slate-500">Copropiedad</Label>
                            <Input value={visitaData.ph_copropiedad} onChange={(e) => setVisitaData(prev => ({ ...prev, ph_copropiedad: e.target.value.toUpperCase() }))} className="uppercase" />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Predio Asociado</Label>
                            <Input value={visitaData.ph_predio_asociado} onChange={(e) => setVisitaData(prev => ({ ...prev, ph_predio_asociado: e.target.value }))} className="font-mono" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs text-slate-500">Torre</Label>
                            <Input value={visitaData.ph_torre} onChange={(e) => setVisitaData(prev => ({ ...prev, ph_torre: e.target.value.toUpperCase() }))} />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Apartamento</Label>
                            <Input value={visitaData.ph_apartamento} onChange={(e) => setVisitaData(prev => ({ ...prev, ph_apartamento: e.target.value.toUpperCase() }))} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Sección 4: Condominio */}
                  <div className="border border-orange-200 rounded-lg overflow-hidden">
                    <div className="bg-orange-50 px-4 py-2 border-b border-orange-200">
                      <h3 className="font-semibold text-orange-800 flex items-center gap-2">
                        <Home className="w-4 h-4" />
                        4. Condominio
                      </h3>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-slate-500">Área Terreno Común</Label>
                          <Input type="number" step="0.01" value={visitaData.cond_area_terreno_comun} onChange={(e) => setVisitaData(prev => ({ ...prev, cond_area_terreno_comun: e.target.value }))} placeholder="0.00" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Área de Terreno Privada</Label>
                          <Input type="number" step="0.01" value={visitaData.cond_area_terreno_privada} onChange={(e) => setVisitaData(prev => ({ ...prev, cond_area_terreno_privada: e.target.value }))} placeholder="0.00" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-slate-500">Área Construida Privada</Label>
                          <Input type="number" step="0.01" value={visitaData.cond_area_construida_privada} onChange={(e) => setVisitaData(prev => ({ ...prev, cond_area_construida_privada: e.target.value }))} placeholder="0.00" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Área Construida Común</Label>
                          <Input type="number" step="0.01" value={visitaData.cond_area_construida_comun} onChange={(e) => setVisitaData(prev => ({ ...prev, cond_area_construida_comun: e.target.value }))} placeholder="0.00" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-slate-500">Condominio</Label>
                          <Input value={visitaData.cond_condominio} onChange={(e) => setVisitaData(prev => ({ ...prev, cond_condominio: e.target.value.toUpperCase() }))} className="uppercase" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Predio Asociado</Label>
                          <Input value={visitaData.cond_predio_asociado} onChange={(e) => setVisitaData(prev => ({ ...prev, cond_predio_asociado: e.target.value }))} className="font-mono" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-slate-500">Unidad</Label>
                          <Input value={visitaData.cond_unidad} onChange={(e) => setVisitaData(prev => ({ ...prev, cond_unidad: e.target.value.toUpperCase() }))} />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Casa</Label>
                          <Input value={visitaData.cond_casa} onChange={(e) => setVisitaData(prev => ({ ...prev, cond_casa: e.target.value.toUpperCase() }))} />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ========== PÁGINA 2: Información Jurídica y Propietarios ========== */}
              {visitaPagina === 2 && (
                <>
                  {/* Sección 5: Información Jurídica */}
                  <div className="border border-indigo-200 rounded-lg overflow-hidden">
                    <div className="bg-indigo-50 px-4 py-2 border-b border-indigo-200">
                      <h3 className="font-semibold text-indigo-800 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        5. INFORMACIÓN JURÍDICA Y PROPIETARIOS
                      </h3>
                    </div>
                    <div className="p-4 space-y-4">
                      {/* Datos del documento */}
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label className="text-xs text-slate-500">Matrícula Inmobiliaria</Label>
                          <Input value={visitaData.jur_matricula} onChange={(e) => setVisitaData(prev => ({ ...prev, jur_matricula: e.target.value }))} />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Tipo Doc.</Label>
                          <div className="flex gap-2 flex-wrap">
                            {['Escritura','Sentencia','Resolución'].map(t => (
                              <label key={t} className="flex items-center gap-1 cursor-pointer">
                                <input type="radio" name="jur_tipo_doc" checked={visitaData.jur_tipo_doc === t} onChange={() => setVisitaData(prev => ({ ...prev, jur_tipo_doc: t }))} className="text-indigo-600" />
                                <span className="text-xs">{t}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">No. Documento</Label>
                          <Input value={visitaData.jur_numero_doc} onChange={(e) => setVisitaData(prev => ({ ...prev, jur_numero_doc: e.target.value }))} />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label className="text-xs text-slate-500">Notaría</Label>
                          <Input value={visitaData.jur_notaria} onChange={(e) => setVisitaData(prev => ({ ...prev, jur_notaria: e.target.value }))} />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Fecha</Label>
                          <Input type="date" value={visitaData.jur_fecha} onChange={(e) => setVisitaData(prev => ({ ...prev, jur_fecha: e.target.value }))} />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Ciudad</Label>
                          <Input value={visitaData.jur_ciudad} onChange={(e) => setVisitaData(prev => ({ ...prev, jur_ciudad: e.target.value.toUpperCase() }))} className="uppercase" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Razón Social (si aplica)</Label>
                        <Input value={visitaData.jur_razon_social} onChange={(e) => setVisitaData(prev => ({ ...prev, jur_razon_social: e.target.value.toUpperCase() }))} className="uppercase" />
                      </div>

                      {/* Lista de Propietarios */}
                      <div className="border-t pt-4 mt-4">
                        <div className="flex items-center justify-between mb-3">
                          <Label className="text-sm font-medium text-indigo-800">Propietarios / Poseedores</Label>
                          <Button type="button" variant="outline" size="sm" onClick={agregarPropietarioVisita} className="text-indigo-600 border-indigo-300">
                            <Plus className="w-4 h-4 mr-1" /> Agregar
                          </Button>
                        </div>
                        
                        {visitaPropietarios.map((prop, idx) => (
                          <div key={idx} className="border border-slate-200 rounded-lg p-3 mb-3 bg-slate-50">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-xs font-medium text-slate-600">Propietario {idx + 1}</span>
                              {visitaPropietarios.length > 1 && (
                                <Button type="button" variant="ghost" size="sm" onClick={() => eliminarPropietarioVisita(idx)} className="text-red-500 h-6 px-2">
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-3 mb-2">
                              <div>
                                <Label className="text-xs text-slate-500">Tipo Doc.</Label>
                                <div className="flex gap-2">
                                  {['C','E','T','N'].map(t => (
                                    <label key={t} className="flex items-center gap-1 cursor-pointer">
                                      <input type="radio" name={`tipo_doc_${idx}`} checked={prop.tipo_documento === t} onChange={() => actualizarPropietarioVisita(idx, 'tipo_documento', t)} className="text-indigo-600" />
                                      <span className="text-xs">{t}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <Label className="text-xs text-slate-500">Número</Label>
                                <Input value={prop.numero_documento} onChange={(e) => actualizarPropietarioVisita(idx, 'numero_documento', e.target.value)} className="h-8 text-sm" />
                              </div>
                            </div>
                            <div className="grid grid-cols-4 gap-3 mb-2">
                              <div>
                                <Label className="text-xs text-slate-500">Nombre</Label>
                                <Input value={prop.nombre} onChange={(e) => actualizarPropietarioVisita(idx, 'nombre', e.target.value.toUpperCase())} className="h-8 text-sm uppercase" />
                              </div>
                              <div>
                                <Label className="text-xs text-slate-500">Primer Apellido</Label>
                                <Input value={prop.primer_apellido} onChange={(e) => actualizarPropietarioVisita(idx, 'primer_apellido', e.target.value.toUpperCase())} className="h-8 text-sm uppercase" />
                              </div>
                              <div>
                                <Label className="text-xs text-slate-500">Segundo Apellido</Label>
                                <Input value={prop.segundo_apellido} onChange={(e) => actualizarPropietarioVisita(idx, 'segundo_apellido', e.target.value.toUpperCase())} className="h-8 text-sm uppercase" />
                              </div>
                              <div>
                                <Label className="text-xs text-slate-500">Estado</Label>
                                <Input value={prop.estado || ''} onChange={(e) => actualizarPropietarioVisita(idx, 'estado', e.target.value.toUpperCase())} placeholder="Ej: E, CASADO" className="h-8 text-sm uppercase" />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs text-slate-500">Género</Label>
                                <div className="flex flex-wrap gap-2">
                                  {[{v:'masculino',l:'Masculino'},{v:'femenino',l:'Femenino'},{v:'lgbtq',l:'LGBTQ+'},{v:'otro',l:'Otro'}].map(g => (
                                    <label key={g.v} className="flex items-center gap-1 cursor-pointer">
                                      <input type="radio" name={`genero_${idx}`} checked={prop.genero === g.v} onChange={() => actualizarPropietarioVisita(idx, 'genero', g.v)} className="text-indigo-600" />
                                      <span className="text-xs">{g.l}</span>
                                    </label>
                                  ))}
                                </div>
                                {prop.genero === 'otro' && (
                                  <Input value={prop.genero_otro} onChange={(e) => actualizarPropietarioVisita(idx, 'genero_otro', e.target.value)} placeholder="¿Cuál?" className="h-7 text-xs mt-1" />
                                )}
                              </div>
                              <div>
                                <Label className="text-xs text-slate-500">Grupo Étnico</Label>
                                <div className="flex flex-wrap gap-2">
                                  {['Ninguno','Indígena','Afro','ROM','Otro'].map(g => (
                                    <label key={g} className="flex items-center gap-1 cursor-pointer">
                                      <input type="radio" name={`etnico_${idx}`} checked={prop.grupo_etnico === g} onChange={() => actualizarPropietarioVisita(idx, 'grupo_etnico', g)} className="text-indigo-600" />
                                      <span className="text-xs">{g}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Sección 6: Datos de Notificación */}
                  <div className="border border-teal-200 rounded-lg overflow-hidden">
                    <div className="bg-teal-50 px-4 py-2 border-b border-teal-200">
                      <h3 className="font-semibold text-teal-800 flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        6. DATOS DE NOTIFICACIÓN
                      </h3>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label className="text-xs text-slate-500">Teléfono</Label>
                          <DebouncedInput value={visitaData.not_telefono} onChange={(val) => setVisitaData(prev => ({ ...prev, not_telefono: val }))} placeholder="3001234567" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Correo Electrónico</Label>
                          <DebouncedInput type="email" value={visitaData.not_correo} onChange={(val) => setVisitaData(prev => ({ ...prev, not_correo: val.toLowerCase() }))} placeholder="correo@ejemplo.com" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">¿Autoriza notificación por correo?</Label>
                          <div className="flex gap-4 h-10 items-center">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="radio" name="autoriza_correo" checked={visitaData.not_autoriza_correo === 'si'} onChange={() => setVisitaData(prev => ({ ...prev, not_autoriza_correo: 'si' }))} className="text-teal-600" />
                              <span className="text-sm">Sí</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="radio" name="autoriza_correo" checked={visitaData.not_autoriza_correo === 'no'} onChange={() => setVisitaData(prev => ({ ...prev, not_autoriza_correo: 'no' }))} className="text-teal-600" />
                              <span className="text-sm">No</span>
                            </label>
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Dirección de Notificación</Label>
                        <DebouncedInput value={visitaData.not_direccion} onChange={(val) => setVisitaData(prev => ({ ...prev, not_direccion: val }))} uppercase={true} className="uppercase" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-slate-500">Departamento</Label>
                          <Input value={visitaData.not_departamento} disabled className="bg-slate-100" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Municipio</Label>
                          <DebouncedInput value={visitaData.not_municipio} onChange={(val) => setVisitaData(prev => ({ ...prev, not_municipio: val }))} uppercase={true} className="uppercase" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-slate-500">Vereda</Label>
                          <DebouncedInput value={visitaData.not_vereda} onChange={(val) => setVisitaData(prev => ({ ...prev, not_vereda: val }))} uppercase={true} className="uppercase" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Corregimiento</Label>
                          <DebouncedInput value={visitaData.not_corregimiento} onChange={(val) => setVisitaData(prev => ({ ...prev, not_corregimiento: val }))} uppercase={true} className="uppercase" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Datos Adicionales</Label>
                        <Textarea value={visitaData.not_datos_adicionales} onChange={(e) => setVisitaData(prev => ({ ...prev, not_datos_adicionales: e.target.value }))} rows={2} />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ========== PÁGINA 3: Construcciones y Calificación ========== */}
              {visitaPagina === 3 && (
                <>
                  {/* Sección 7: Información de Construcciones */}
                  <div className="border border-purple-200 rounded-lg overflow-hidden">
                    <div className="bg-purple-50 px-4 py-2 border-b border-purple-200 flex items-center justify-between">
                      <h3 className="font-semibold text-purple-800 flex items-center gap-2">
                        <Building className="w-4 h-4" />
                        7. INFORMACIÓN DE CONSTRUCCIONES
                      </h3>
                      <Button type="button" variant="outline" size="sm" onClick={() => {
                        const nextLetter = String.fromCharCode(65 + visitaConstrucciones.length);
                        setVisitaConstrucciones(prev => [...prev, { unidad: nextLetter, codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' }]);
                      }} className="text-purple-700 border-purple-300 hover:bg-purple-100">
                        <Plus className="w-3 h-3 mr-1" /> Agregar Unidad
                      </Button>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="text-xs text-slate-500 mb-2">
                        Registre cada unidad de construcción del predio. Use el botón "Agregar Unidad" si necesita más de 5.
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-purple-50 text-left">
                              <th className="px-2 py-2 font-medium text-purple-700">Unidad</th>
                              <th className="px-2 py-2 font-medium text-purple-700">Código Uso</th>
                              <th className="px-2 py-2 font-medium text-purple-700">Área (m²)</th>
                              <th className="px-2 py-2 font-medium text-purple-700">Puntaje</th>
                              <th className="px-2 py-2 font-medium text-purple-700">Año Const.</th>
                              <th className="px-2 py-2 font-medium text-purple-700">N° Pisos</th>
                              <th className="px-2 py-2 font-medium text-purple-700"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {visitaConstrucciones.map((cons, idx) => (
                              <tr key={idx} className="border-b border-purple-100">
                                <td className="px-2 py-2">
                                  <span className="font-bold text-purple-700">{cons.unidad}</span>
                                </td>
                                <td className="px-2 py-2">
                                  <Input value={cons.codigo_uso} onChange={(e) => {
                                    const newCons = [...visitaConstrucciones];
                                    newCons[idx].codigo_uso = e.target.value;
                                    setVisitaConstrucciones(newCons);
                                  }} placeholder="Ej: 01" className="w-20 h-8 text-sm" />
                                </td>
                                <td className="px-2 py-2">
                                  <Input type="number" value={cons.area} onChange={(e) => {
                                    const newCons = [...visitaConstrucciones];
                                    newCons[idx].area = e.target.value;
                                    setVisitaConstrucciones(newCons);
                                  }} placeholder="0" className="w-20 h-8 text-sm" />
                                </td>
                                <td className="px-2 py-2">
                                  <Input type="number" value={cons.puntaje} onChange={(e) => {
                                    const newCons = [...visitaConstrucciones];
                                    newCons[idx].puntaje = e.target.value;
                                    setVisitaConstrucciones(newCons);
                                  }} placeholder="0" className="w-16 h-8 text-sm" />
                                </td>
                                <td className="px-2 py-2">
                                  <Input type="number" value={cons.ano_construccion} onChange={(e) => {
                                    const newCons = [...visitaConstrucciones];
                                    newCons[idx].ano_construccion = e.target.value;
                                    setVisitaConstrucciones(newCons);
                                  }} placeholder="2024" className="w-20 h-8 text-sm" />
                                </td>
                                <td className="px-2 py-2">
                                  <Input type="number" value={cons.num_pisos} onChange={(e) => {
                                    const newCons = [...visitaConstrucciones];
                                    newCons[idx].num_pisos = e.target.value;
                                    setVisitaConstrucciones(newCons);
                                  }} placeholder="1" className="w-16 h-8 text-sm" />
                                </td>
                                <td className="px-2 py-2">
                                  {visitaConstrucciones.length > 1 && (
                                    <button type="button" onClick={() => setVisitaConstrucciones(prev => prev.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Sección 8: Calificación */}
                  <div className="border border-orange-200 rounded-lg overflow-hidden">
                    <div className="bg-orange-50 px-4 py-2 border-b border-orange-200 flex items-center justify-between">
                      <h3 className="font-semibold text-orange-800 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        8. CALIFICACIÓN
                      </h3>
                      <Button type="button" variant="outline" size="sm" onClick={() => {
                        setVisitaCalificaciones(prev => [...prev, { 
                          id: prev.length + 1,
                          estructura: { armazon: '', muros: '', cubierta: '', conservacion: '' },
                          acabados: { fachadas: '', cubrim_muros: '', pisos: '', conservacion: '' },
                          bano: { tamano: '', enchape: '', mobiliario: '', conservacion: '' },
                          cocina: { tamano: '', enchape: '', mobiliario: '', conservacion: '' },
                          industria: { cercha_madera: '', cercha_metalica_liviana: '', cercha_metalica_mediana: '', cercha_metalica_pesada: '', altura: '' },
                          datos_generales: { total_pisos: '', total_habitaciones: '', total_banos: '', total_locales: '', area_total_construida: '' }
                        }]);
                      }} className="text-orange-700 border-orange-300 hover:bg-orange-100">
                        <Plus className="w-3 h-3 mr-1" /> Agregar Calificación
                      </Button>
                    </div>
                    <div className="p-4 space-y-6">
                      <p className="text-xs text-slate-500">
                        Registre la calificación de cada unidad de construcción. Use el botón "Agregar Calificación" para múltiples unidades.
                      </p>
                      
                      {visitaCalificaciones.map((calif, califIdx) => (
                        <div key={califIdx} className="border border-orange-300 rounded-lg overflow-hidden">
                          <div className="bg-orange-100 px-4 py-2 flex items-center justify-between">
                            <span className="font-semibold text-orange-800">Calificación #{calif.id}</span>
                            {visitaCalificaciones.length > 1 && (
                              <button type="button" onClick={() => setVisitaCalificaciones(prev => prev.filter((_, i) => i !== califIdx))} className="text-red-500 hover:text-red-700">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <div className="p-4 space-y-4">
                            {/* Estructura */}
                            <div className="border rounded-lg p-3 bg-slate-50">
                              <h4 className="font-medium text-slate-700 mb-3">8.1 ESTRUCTURA</h4>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div>
                                  <Label className="text-xs text-slate-500">Armazón</Label>
                                  <Input value={calif.estructura.armazon} onChange={(e) => {
                                    const newCalifs = [...visitaCalificaciones];
                                    newCalifs[califIdx].estructura.armazon = e.target.value;
                                    setVisitaCalificaciones(newCalifs);
                                  }} placeholder="Código" className="h-8 text-sm" />
                                </div>
                                <div>
                                  <Label className="text-xs text-slate-500">Muros</Label>
                                  <Input value={calif.estructura.muros} onChange={(e) => {
                                    const newCalifs = [...visitaCalificaciones];
                                    newCalifs[califIdx].estructura.muros = e.target.value;
                                    setVisitaCalificaciones(newCalifs);
                                  }} placeholder="Código" className="h-8 text-sm" />
                                </div>
                                <div>
                                  <Label className="text-xs text-slate-500">Cubierta</Label>
                                  <Input value={calif.estructura.cubierta} onChange={(e) => {
                                    const newCalifs = [...visitaCalificaciones];
                                    newCalifs[califIdx].estructura.cubierta = e.target.value;
                                    setVisitaCalificaciones(newCalifs);
                                  }} placeholder="Código" className="h-8 text-sm" />
                                </div>
                                <div>
                                  <Label className="text-xs text-slate-500">Conservación</Label>
                                  <Input value={calif.estructura.conservacion} onChange={(e) => {
                                    const newCalifs = [...visitaCalificaciones];
                                    newCalifs[califIdx].estructura.conservacion = e.target.value;
                                    setVisitaCalificaciones(newCalifs);
                                  }} placeholder="Código" className="h-8 text-sm" />
                                </div>
                              </div>
                            </div>

                            {/* Acabados */}
                            <div className="border rounded-lg p-3 bg-slate-50">
                              <h4 className="font-medium text-slate-700 mb-3">8.2 ACABADOS PRINCIPALES</h4>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div>
                                  <Label className="text-xs text-slate-500">Fachadas</Label>
                                  <Input value={calif.acabados.fachadas} onChange={(e) => {
                                    const newCalifs = [...visitaCalificaciones];
                                    newCalifs[califIdx].acabados.fachadas = e.target.value;
                                    setVisitaCalificaciones(newCalifs);
                                  }} placeholder="Código" className="h-8 text-sm" />
                                </div>
                                <div>
                                  <Label className="text-xs text-slate-500">Cubrim. Muros</Label>
                                  <Input value={calif.acabados.cubrim_muros} onChange={(e) => {
                                    const newCalifs = [...visitaCalificaciones];
                                    newCalifs[califIdx].acabados.cubrim_muros = e.target.value;
                                    setVisitaCalificaciones(newCalifs);
                                  }} placeholder="Código" className="h-8 text-sm" />
                                </div>
                                <div>
                                  <Label className="text-xs text-slate-500">Pisos</Label>
                                  <Input value={calif.acabados.pisos} onChange={(e) => {
                                    const newCalifs = [...visitaCalificaciones];
                                    newCalifs[califIdx].acabados.pisos = e.target.value;
                                    setVisitaCalificaciones(newCalifs);
                                  }} placeholder="Código" className="h-8 text-sm" />
                                </div>
                                <div>
                                  <Label className="text-xs text-slate-500">Conservación</Label>
                                  <Input value={calif.acabados.conservacion} onChange={(e) => {
                                    const newCalifs = [...visitaCalificaciones];
                                    newCalifs[califIdx].acabados.conservacion = e.target.value;
                                    setVisitaCalificaciones(newCalifs);
                                  }} placeholder="Código" className="h-8 text-sm" />
                                </div>
                              </div>
                            </div>

                            {/* Baño */}
                            <div className="border rounded-lg p-3 bg-slate-50">
                              <h4 className="font-medium text-slate-700 mb-3">8.3 BAÑO</h4>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div>
                                  <Label className="text-xs text-slate-500">Tamaño</Label>
                                  <Input value={calif.bano.tamano} onChange={(e) => {
                                    const newCalifs = [...visitaCalificaciones];
                                    newCalifs[califIdx].bano.tamano = e.target.value;
                                    setVisitaCalificaciones(newCalifs);
                                  }} placeholder="Código" className="h-8 text-sm" />
                                </div>
                                <div>
                                  <Label className="text-xs text-slate-500">Enchape</Label>
                                  <Input value={calif.bano.enchape} onChange={(e) => {
                                    const newCalifs = [...visitaCalificaciones];
                                    newCalifs[califIdx].bano.enchape = e.target.value;
                                    setVisitaCalificaciones(newCalifs);
                                  }} placeholder="Código" className="h-8 text-sm" />
                                </div>
                                <div>
                                  <Label className="text-xs text-slate-500">Mobiliario</Label>
                                  <Input value={calif.bano.mobiliario} onChange={(e) => {
                                    const newCalifs = [...visitaCalificaciones];
                                    newCalifs[califIdx].bano.mobiliario = e.target.value;
                                    setVisitaCalificaciones(newCalifs);
                                  }} placeholder="Código" className="h-8 text-sm" />
                                </div>
                                <div>
                                  <Label className="text-xs text-slate-500">Conservación</Label>
                                  <Input value={calif.bano.conservacion} onChange={(e) => {
                                    const newCalifs = [...visitaCalificaciones];
                                    newCalifs[califIdx].bano.conservacion = e.target.value;
                                    setVisitaCalificaciones(newCalifs);
                                  }} placeholder="Código" className="h-8 text-sm" />
                                </div>
                              </div>
                            </div>

                            {/* Cocina */}
                            <div className="border rounded-lg p-3 bg-slate-50">
                              <h4 className="font-medium text-slate-700 mb-3">8.4 COCINA</h4>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div>
                                  <Label className="text-xs text-slate-500">Tamaño</Label>
                                  <Input value={calif.cocina.tamano} onChange={(e) => {
                                    const newCalifs = [...visitaCalificaciones];
                                    newCalifs[califIdx].cocina.tamano = e.target.value;
                                    setVisitaCalificaciones(newCalifs);
                                  }} placeholder="Código" className="h-8 text-sm" />
                                </div>
                                <div>
                                  <Label className="text-xs text-slate-500">Enchape</Label>
                                  <Input value={calif.cocina.enchape} onChange={(e) => {
                                    const newCalifs = [...visitaCalificaciones];
                                    newCalifs[califIdx].cocina.enchape = e.target.value;
                                    setVisitaCalificaciones(newCalifs);
                                  }} placeholder="Código" className="h-8 text-sm" />
                                </div>
                                <div>
                                  <Label className="text-xs text-slate-500">Mobiliario</Label>
                                  <Input value={calif.cocina.mobiliario} onChange={(e) => {
                                    const newCalifs = [...visitaCalificaciones];
                                    newCalifs[califIdx].cocina.mobiliario = e.target.value;
                                    setVisitaCalificaciones(newCalifs);
                                  }} placeholder="Código" className="h-8 text-sm" />
                                </div>
                                <div>
                                  <Label className="text-xs text-slate-500">Conservación</Label>
                                  <Input value={calif.cocina.conservacion} onChange={(e) => {
                                    const newCalifs = [...visitaCalificaciones];
                                    newCalifs[califIdx].cocina.conservacion = e.target.value;
                                    setVisitaCalificaciones(newCalifs);
                                  }} placeholder="Código" className="h-8 text-sm" />
                                </div>
                              </div>
                            </div>

                            {/* Industria */}
                            <div className="border rounded-lg p-3 bg-slate-50">
                              <h4 className="font-medium text-slate-700 mb-3">8.5 COMPLEMENTO INDUSTRIA (si aplica)</h4>
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                <div>
                                  <Label className="text-xs text-slate-500">Cercha Madera</Label>
                                  <Input value={calif.industria.cercha_madera} onChange={(e) => {
                                    const newCalifs = [...visitaCalificaciones];
                                    newCalifs[califIdx].industria.cercha_madera = e.target.value;
                                    setVisitaCalificaciones(newCalifs);
                                  }} placeholder="Código" className="h-8 text-sm" />
                                </div>
                                <div>
                                  <Label className="text-xs text-slate-500">C. Met. Liviana</Label>
                                  <Input value={calif.industria.cercha_metalica_liviana} onChange={(e) => {
                                    const newCalifs = [...visitaCalificaciones];
                                    newCalifs[califIdx].industria.cercha_metalica_liviana = e.target.value;
                                    setVisitaCalificaciones(newCalifs);
                                  }} placeholder="Código" className="h-8 text-sm" />
                                </div>
                                <div>
                                  <Label className="text-xs text-slate-500">C. Met. Mediana</Label>
                                  <Input value={calif.industria.cercha_metalica_mediana} onChange={(e) => {
                                    const newCalifs = [...visitaCalificaciones];
                                    newCalifs[califIdx].industria.cercha_metalica_mediana = e.target.value;
                                    setVisitaCalificaciones(newCalifs);
                                  }} placeholder="Código" className="h-8 text-sm" />
                                </div>
                                <div>
                                  <Label className="text-xs text-slate-500">C. Met. Pesada</Label>
                                  <Input value={calif.industria.cercha_metalica_pesada} onChange={(e) => {
                                    const newCalifs = [...visitaCalificaciones];
                                    newCalifs[califIdx].industria.cercha_metalica_pesada = e.target.value;
                                    setVisitaCalificaciones(newCalifs);
                                  }} placeholder="Código" className="h-8 text-sm" />
                                </div>
                                <div>
                                  <Label className="text-xs text-slate-500">Altura (m)</Label>
                                  <Input value={calif.industria.altura} onChange={(e) => {
                                    const newCalifs = [...visitaCalificaciones];
                                    newCalifs[califIdx].industria.altura = e.target.value;
                                    setVisitaCalificaciones(newCalifs);
                                  }} placeholder="0" className="h-8 text-sm" />
                                </div>
                              </div>
                            </div>

                            {/* Datos Generales */}
                            <div className="border rounded-lg p-3 bg-emerald-50 border-emerald-200">
                              <h4 className="font-medium text-emerald-700 mb-3">8.6 DATOS GENERALES</h4>
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                <div>
                                  <Label className="text-xs text-slate-500">Total Pisos</Label>
                                  <Input type="number" value={calif.datos_generales.total_pisos} onChange={(e) => {
                                    const newCalifs = [...visitaCalificaciones];
                                    newCalifs[califIdx].datos_generales.total_pisos = e.target.value;
                                    setVisitaCalificaciones(newCalifs);
                                  }} placeholder="0" className="h-8 text-sm" />
                                </div>
                                <div>
                                  <Label className="text-xs text-slate-500">Habitaciones</Label>
                                  <Input type="number" value={calif.datos_generales.total_habitaciones} onChange={(e) => {
                                    const newCalifs = [...visitaCalificaciones];
                                    newCalifs[califIdx].datos_generales.total_habitaciones = e.target.value;
                                    setVisitaCalificaciones(newCalifs);
                                  }} placeholder="0" className="h-8 text-sm" />
                                </div>
                                <div>
                                  <Label className="text-xs text-slate-500">Baños</Label>
                                  <Input type="number" value={calif.datos_generales.total_banos} onChange={(e) => {
                                    const newCalifs = [...visitaCalificaciones];
                                    newCalifs[califIdx].datos_generales.total_banos = e.target.value;
                                    setVisitaCalificaciones(newCalifs);
                                  }} placeholder="0" className="h-8 text-sm" />
                                </div>
                                <div>
                                  <Label className="text-xs text-slate-500">Locales</Label>
                                  <Input type="number" value={calif.datos_generales.total_locales} onChange={(e) => {
                                    const newCalifs = [...visitaCalificaciones];
                                    newCalifs[califIdx].datos_generales.total_locales = e.target.value;
                                    setVisitaCalificaciones(newCalifs);
                                  }} placeholder="0" className="h-8 text-sm" />
                                </div>
                                <div>
                                  <Label className="text-xs text-slate-500">Área Total (m²)</Label>
                                  <Input type="number" value={calif.datos_generales.area_total_construida} onChange={(e) => {
                                    const newCalifs = [...visitaCalificaciones];
                                    newCalifs[califIdx].datos_generales.area_total_construida = e.target.value;
                                    setVisitaCalificaciones(newCalifs);
                                  }} placeholder="0" className="h-8 text-sm" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ========== PÁGINA 4: Áreas de Terreno y Localización ========== */}
              {visitaPagina === 4 && (
                <>
                  {/* Sección 9: Resumen áreas de terreno */}
                  <div className="border border-teal-200 rounded-lg overflow-hidden">
                    <div className="bg-teal-50 px-4 py-2 border-b border-teal-200">
                      <h3 className="font-semibold text-teal-800 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        9. RESUMEN ÁREAS DE TERRENO
                      </h3>
                    </div>
                    <div className="p-4">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="bg-teal-50">
                              <th className="px-3 py-2 text-left font-medium text-teal-700 border border-teal-200">Área de terreno según:</th>
                              <th className="px-3 py-2 text-center font-medium text-teal-700 border border-teal-200 w-24">Ha</th>
                              <th className="px-3 py-2 text-center font-medium text-teal-700 border border-teal-200 w-24">m²</th>
                              <th className="px-3 py-2 text-left font-medium text-teal-700 border border-teal-200">Descripción</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="px-3 py-2 border border-teal-200 font-medium text-slate-700">Área de título</td>
                              <td className="px-1 py-1 border border-teal-200"><Input type="number" step="0.0001" value={visitaData.area_titulo_ha} onChange={(e) => setVisitaData(prev => ({ ...prev, area_titulo_ha: e.target.value, area_titulo_m2: e.target.value ? (parseFloat(e.target.value) * 10000).toFixed(2) : '' }))} className="h-8 text-sm text-center" placeholder="0.0000" /></td>
                              <td className="px-1 py-1 border border-teal-200"><Input type="text" value={visitaData.area_titulo_m2} readOnly className="h-8 text-sm text-center bg-slate-50" placeholder="0" /></td>
                              <td className="px-1 py-1 border border-teal-200"><Input value={visitaData.area_titulo_desc} onChange={(e) => setVisitaData(prev => ({ ...prev, area_titulo_desc: e.target.value }))} className="h-8 text-sm" placeholder="Descripción" /></td>
                            </tr>
                            <tr className="bg-emerald-50">
                              <td className="px-3 py-2 border border-teal-200 font-medium text-emerald-700">Área base catastral (R1)</td>
                              <td className="px-1 py-1 border border-teal-200"><Input type="text" value={visitaData.area_base_catastral_ha} readOnly className="h-8 text-sm text-center bg-emerald-100" /></td>
                              <td className="px-1 py-1 border border-teal-200"><Input type="text" value={visitaData.area_base_catastral_m2} readOnly className="h-8 text-sm text-center bg-emerald-100 font-medium" /></td>
                              <td className="px-1 py-1 border border-teal-200"><Input value={visitaData.area_base_catastral_desc} readOnly className="h-8 text-sm bg-emerald-100 text-emerald-700" /></td>
                            </tr>
                            <tr className="bg-blue-50">
                              <td className="px-3 py-2 border border-teal-200 font-medium text-blue-700">Área geográfica (GDB)</td>
                              <td className="px-1 py-1 border border-teal-200"><Input type="text" value={visitaData.area_geografica_ha} readOnly className="h-8 text-sm text-center bg-blue-100" /></td>
                              <td className="px-1 py-1 border border-teal-200"><Input type="text" value={visitaData.area_geografica_m2} readOnly className="h-8 text-sm text-center bg-blue-100 font-medium" /></td>
                              <td className="px-1 py-1 border border-teal-200"><Input value={visitaData.area_geografica_desc} readOnly className="h-8 text-sm bg-blue-100 text-blue-700" /></td>
                            </tr>
                            <tr>
                              <td className="px-3 py-2 border border-teal-200 font-medium text-slate-700">Área levantamiento topográfico</td>
                              <td className="px-1 py-1 border border-teal-200"><Input type="number" step="0.0001" value={visitaData.area_levantamiento_ha} onChange={(e) => setVisitaData(prev => ({ ...prev, area_levantamiento_ha: e.target.value, area_levantamiento_m2: e.target.value ? (parseFloat(e.target.value) * 10000).toFixed(2) : '' }))} className="h-8 text-sm text-center" placeholder="0.0000" /></td>
                              <td className="px-1 py-1 border border-teal-200"><Input type="text" value={visitaData.area_levantamiento_m2} readOnly className="h-8 text-sm text-center bg-slate-50" placeholder="0" /></td>
                              <td className="px-1 py-1 border border-teal-200"><Input value={visitaData.area_levantamiento_desc} onChange={(e) => setVisitaData(prev => ({ ...prev, area_levantamiento_desc: e.target.value }))} className="h-8 text-sm" placeholder="Descripción" /></td>
                            </tr>
                            <tr>
                              <td className="px-3 py-2 border border-teal-200 font-medium text-slate-700">Área de la identificación predial</td>
                              <td className="px-1 py-1 border border-teal-200"><Input type="number" step="0.0001" value={visitaData.area_identificacion_ha} onChange={(e) => setVisitaData(prev => ({ ...prev, area_identificacion_ha: e.target.value, area_identificacion_m2: e.target.value ? (parseFloat(e.target.value) * 10000).toFixed(2) : '' }))} className="h-8 text-sm text-center" placeholder="0.0000" /></td>
                              <td className="px-1 py-1 border border-teal-200"><Input type="text" value={visitaData.area_identificacion_m2} readOnly className="h-8 text-sm text-center bg-slate-50" placeholder="0" /></td>
                              <td className="px-1 py-1 border border-teal-200"><Input value={visitaData.area_identificacion_desc} onChange={(e) => setVisitaData(prev => ({ ...prev, area_identificacion_desc: e.target.value }))} className="h-8 text-sm" placeholder="Descripción" /></td>
                            </tr>
                          </tbody>
                        </table>
                        {/* Resumen de áreas con formato "X ha X.XXX m²" */}
                        <div className="mt-4 p-3 bg-slate-100 rounded-lg">
                          <p className="text-xs font-medium text-slate-700 mb-2">Resumen de Áreas:</p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-emerald-700">R1 (Base):</span>
                              <span className="font-mono font-medium">{formatearArea(visitaData.area_base_catastral_m2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-blue-700">GDB:</span>
                              <span className="font-mono font-medium">{formatearArea(visitaData.area_geografica_m2)}</span>
                            </div>
                            {visitaData.area_titulo_m2 && (
                              <div className="flex justify-between">
                                <span className="text-slate-700">Título:</span>
                                <span className="font-mono">{formatearArea(visitaData.area_titulo_m2)}</span>
                              </div>
                            )}
                            {visitaData.area_levantamiento_m2 && (
                              <div className="flex justify-between">
                                <span className="text-slate-700">Levantamiento:</span>
                                <span className="font-mono">{formatearArea(visitaData.area_levantamiento_m2)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">* Los campos de Área base catastral (R1) y Área geográfica (GDB) se pre-llenan automáticamente del sistema.</p>
                    </div>
                  </div>

                  {/* Sección 10: Información de Localización (Croquis/Fotos) */}
                  <div className="border border-indigo-200 rounded-lg overflow-hidden">
                    <div className="bg-indigo-50 px-4 py-2 border-b border-indigo-200">
                      <h3 className="font-semibold text-indigo-800 flex items-center gap-2">
                        <Camera className="w-4 h-4" />
                        10. INFORMACIÓN DE LOCALIZACIÓN (Croquis del terreno y construcciones)
                      </h3>
                    </div>
                    <div className="p-4">
                      <p className="text-sm text-slate-600 mb-3">Cargue fotos del croquis del terreno y las construcciones. Incluya información de colindantes y cotas cuando aplique.</p>
                      
                      {/* Input para cámara (Android/iOS) */}
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment"
                        onChange={handleFotoCroquisChange} 
                        className="hidden" 
                        id="input-croquis-camera" 
                      />
                      
                      {/* Input para galería */}
                      <input 
                        type="file" 
                        accept="image/*" 
                        multiple 
                        onChange={handleFotoCroquisChange} 
                        className="hidden" 
                        id="input-croquis-gallery" 
                      />
                      
                      {/* Grid de fotos cargadas */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                        {visitaData.fotos_croquis.map((foto, idx) => (
                          <div key={idx} className="relative aspect-square border rounded-lg overflow-hidden bg-white shadow-sm">
                            <img src={foto.preview || foto.data} alt={`Croquis ${idx + 1}`} className="w-full h-full object-cover" />
                            <button type="button" onClick={() => eliminarFotoCroquis(idx)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow hover:bg-red-600">
                              <X className="w-4 h-4" />
                            </button>
                            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate">
                              {foto.nombre || `Foto ${idx + 1}`}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Botones para agregar fotos */}
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => document.getElementById('input-croquis-camera')?.click()} 
                          className="border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50"
                        >
                          <Camera className="w-4 h-4 mr-2" />
                          Tomar Foto
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => document.getElementById('input-croquis-gallery')?.click()} 
                          className="border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50"
                        >
                          <ImageIcon className="w-4 h-4 mr-2" />
                          Galería
                        </Button>
                      </div>
                      
                      {/* Indicador de orientación Norte */}
                      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                        <div className="w-6 h-6 border border-slate-300 rounded flex items-center justify-center font-bold text-slate-600">N</div>
                        <span>Asegúrese de que las fotos incluyan la orientación norte cuando sea relevante.</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ========== PÁGINA 5: Observaciones, Firmas e Información de la Visita ========== */}
              {visitaPagina === 5 && (
                <>
                  {/* Sección 11: Coordenadas GPS del Predio */}
                  <div className="border border-blue-200 rounded-lg overflow-hidden">
                    <div className="bg-blue-50 px-4 py-2 border-b border-blue-200">
                      <h3 className="font-semibold text-blue-800 flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        11. COORDENADAS GPS DEL PREDIO
                      </h3>
                    </div>
                    <div className="p-4 space-y-4">
                      <p className="text-sm text-slate-600">
                        Capture las coordenadas de ubicación del predio utilizando el GPS del dispositivo.
                      </p>
                      
                      {/* Botón para capturar GPS */}
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button 
                          type="button" 
                          onClick={startWatchingPosition}
                          disabled={watchingPosition}
                          className="bg-blue-600 hover:bg-blue-700 flex-1"
                        >
                          {watchingPosition ? (
                            <>
                              <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                              Obteniendo ubicación...
                            </>
                          ) : (
                            <>
                              <MapPin className="w-4 h-4 mr-2" />
                              📍 Capturar Mi Ubicación GPS
                            </>
                          )}
                        </Button>
                        
                        {userPosition && (
                          <Button 
                            type="button" 
                            variant="outline"
                            onClick={() => {
                              setVisitaData(prev => ({
                                ...prev,
                                coordenadas_gps: {
                                  latitud: userPosition[0].toFixed(6),
                                  longitud: userPosition[1].toFixed(6),
                                  precision: gpsAccuracy,
                                  fecha_captura: new Date().toISOString()
                                }
                              }));
                              toast.success('Coordenadas guardadas en el formulario');
                            }}
                            className="text-green-600 border-green-300 hover:bg-green-50"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Usar esta ubicación
                          </Button>
                        )}
                      </div>
                      
                      {/* Indicador de GPS activo */}
                      {userPosition && gpsAccuracy && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <div>
                            <span className="text-green-700 text-sm font-medium">
                              Ubicación capturada con precisión de {Math.round(gpsAccuracy)} metros
                            </span>
                            <p className="text-green-600 text-xs">
                              Lat: {userPosition[0].toFixed(6)}, Lng: {userPosition[1].toFixed(6)}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* Campos de coordenadas */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs font-medium text-slate-600">Latitud (Y)</Label>
                          <Input
                            type="text"
                            placeholder="Ej: 7.123456"
                            value={visitaData.coordenadas_gps?.latitud || ''}
                            onChange={(e) => setVisitaData(prev => ({
                              ...prev,
                              coordenadas_gps: { ...prev.coordenadas_gps, latitud: e.target.value }
                            }))}
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-slate-600">Longitud (X)</Label>
                          <Input
                            type="text"
                            placeholder="Ej: -72.654321"
                            value={visitaData.coordenadas_gps?.longitud || ''}
                            onChange={(e) => setVisitaData(prev => ({
                              ...prev,
                              coordenadas_gps: { ...prev.coordenadas_gps, longitud: e.target.value }
                            }))}
                          />
                        </div>
                      </div>
                      
                      {visitaData.coordenadas_gps?.fecha_captura && (
                        <p className="text-xs text-slate-500">
                          Coordenadas capturadas el: {new Date(visitaData.coordenadas_gps.fecha_captura).toLocaleString('es-CO')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Sección 12: Observaciones */}
                  <div className="border border-amber-200 rounded-lg overflow-hidden">
                    <div className="bg-amber-50 px-4 py-2 border-b border-amber-200">
                      <h3 className="font-semibold text-amber-800 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        12. OBSERVACIONES
                      </h3>
                    </div>
                    <div className="p-4">
                      <Textarea
                        value={visitaData.observaciones_generales}
                        onChange={(e) => {
                          if (e.target.value.length <= 500) {
                            setVisitaData(prev => ({ ...prev, observaciones_generales: e.target.value }));
                          }
                        }}
                        rows={6}
                        placeholder="Ingrese las observaciones generales de la visita..."
                        className="resize-none"
                      />
                      <div className="flex justify-between items-center mt-2">
                        <p className="text-xs text-slate-500">Máximo 500 caracteres</p>
                        <span className={`text-xs ${visitaData.observaciones_generales.length > 450 ? 'text-amber-600 font-medium' : 'text-slate-400'}`}>
                          {visitaData.observaciones_generales.length}/500
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Sección 13: Firmas */}
                  <div className="border border-purple-200 rounded-lg overflow-hidden">
                    <div className="bg-purple-50 px-4 py-2 border-b border-purple-200">
                      <h3 className="font-semibold text-purple-800 flex items-center gap-2">
                        <Pen className="w-4 h-4" />
                        13. FIRMAS
                      </h3>
                    </div>
                    <div className="p-4 space-y-6">
                      {/* Firma del Visitado */}
                      <div>
                        <Label className="text-sm font-medium text-slate-700 mb-2 block">Firma del Visitado (Propietario/Atendiente)</Label>
                        <div>
                          <Label className="text-xs text-slate-500 mb-1 block">Nombre</Label>
                          <Input value={visitaData.nombre_visitado} onChange={(e) => setVisitaData(prev => ({ ...prev, nombre_visitado: e.target.value.toUpperCase() }))} placeholder="NOMBRE COMPLETO DEL VISITADO" className="uppercase mb-2" />
                        </div>
                        <div className="flex gap-2 items-center">
                          <div className="flex-1 border-2 border-slate-300 rounded-lg bg-white h-20 overflow-hidden touch-none">
                            <canvas 
                              ref={canvasVisitadoRef} 
                              width={500} 
                              height={80} 
                              className="w-full h-full cursor-crosshair touch-none" 
                              style={{ backgroundColor: '#ffffff' }}
                              onMouseDown={startDrawingVisitado}
                              onMouseMove={drawVisitado}
                              onMouseUp={stopDrawingVisitado}
                              onMouseLeave={stopDrawingVisitado}
                              onTouchStart={startDrawingVisitado}
                              onTouchMove={drawVisitado}
                              onTouchEnd={stopDrawingVisitado}
                            />
                          </div>
                          <Button type="button" variant="outline" onClick={() => abrirModalFirma('visitado')} className="border-purple-500 text-purple-700 hover:bg-purple-50">
                            <Pen className="w-4 h-4 mr-1" /> Firmar
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={limpiarFirmaVisitado} className="text-slate-500">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Firma del Reconocedor */}
                      <div>
                        <Label className="text-sm font-medium text-slate-700 mb-2 block">Firma del Reconocedor Predial</Label>
                        <div>
                          <Label className="text-xs text-slate-500 mb-1 block">Nombre</Label>
                          <Input value={visitaData.nombre_reconocedor} onChange={(e) => setVisitaData(prev => ({ ...prev, nombre_reconocedor: e.target.value.toUpperCase() }))} placeholder="NOMBRE DEL RECONOCEDOR" className="uppercase mb-2" />
                        </div>
                        <div className="flex gap-2 items-center">
                          <div className="flex-1 border-2 border-slate-300 rounded-lg bg-white h-20 overflow-hidden touch-none">
                            <canvas 
                              ref={canvasReconocedorRef} 
                              width={500} 
                              height={80} 
                              className="w-full h-full cursor-crosshair touch-none" 
                              style={{ backgroundColor: '#ffffff' }}
                              onMouseDown={startDrawingReconocedor}
                              onMouseMove={drawReconocedor}
                              onMouseUp={stopDrawingReconocedor}
                              onMouseLeave={stopDrawingReconocedor}
                              onTouchStart={startDrawingReconocedor}
                              onTouchMove={drawReconocedor}
                              onTouchEnd={stopDrawingReconocedor}
                            />
                          </div>
                          <Button type="button" variant="outline" onClick={() => abrirModalFirma('reconocedor')} className="border-purple-500 text-purple-700 hover:bg-purple-50">
                            <Pen className="w-4 h-4 mr-1" /> Firmar
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={limpiarFirmaReconocedor} className="text-slate-500">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Datos de la Visita */}
                  <div className="border border-blue-200 rounded-lg overflow-hidden">
                    <div className="bg-blue-50 px-4 py-2 border-b border-blue-200">
                      <h3 className="font-semibold text-blue-800 flex items-center gap-2">
                        <User className="w-4 h-4" />
                        DATOS DE LA VISITA
                      </h3>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-slate-500">Fecha de Visita *</Label>
                          <Input type="date" value={visitaData.fecha_visita} onChange={(e) => setVisitaData(prev => ({ ...prev, fecha_visita: e.target.value }))} />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Hora *</Label>
                          <Input type="time" value={visitaData.hora_visita} onChange={(e) => setVisitaData(prev => ({ ...prev, hora_visita: e.target.value }))} />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Persona que Atiende *</Label>
                        <Input value={visitaData.persona_atiende} onChange={(e) => setVisitaData(prev => ({ ...prev, persona_atiende: e.target.value.toUpperCase() }))} placeholder="NOMBRE COMPLETO" className="uppercase" />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500 mb-2 block">Relación con el Predio</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {[{v:'propietario',l:'Propietario'},{v:'poseedor',l:'Poseedor'},{v:'arrendatario',l:'Arrendatario'},{v:'familiar',l:'Familiar'},{v:'encargado',l:'Encargado'},{v:'otro',l:'Otro'}].map(i => (
                            <label key={i.v} className="flex items-center gap-2 cursor-pointer">
                              <input type="radio" name="relacion" checked={visitaData.relacion_predio === i.v} onChange={() => setVisitaData(prev => ({ ...prev, relacion_predio: i.v }))} className="text-blue-600" />
                              <span className="text-sm">{i.l}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500 mb-2 block">¿Se pudo acceder al predio?</Label>
                        <div className="flex gap-4">
                          {[{v:'si',l:'Sí, acceso total'},{v:'parcial',l:'Acceso parcial'},{v:'no',l:'No se pudo'}].map(i => (
                            <label key={i.v} className="flex items-center gap-2 cursor-pointer">
                              <input type="radio" name="acceso" checked={visitaData.acceso_predio === i.v} onChange={() => setVisitaData(prev => ({ ...prev, acceso_predio: i.v }))} className="text-blue-600" />
                              <span className="text-sm">{i.l}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500 mb-2 block">Estado del Predio</Label>
                        <div className="grid grid-cols-4 gap-2">
                          {[{v:'habitado',l:'Habitado'},{v:'deshabitado',l:'Deshabitado'},{v:'en_construccion',l:'En construcción'},{v:'abandonado',l:'Abandonado'},{v:'lote_vacio',l:'Lote vacío'},{v:'uso_comercial',l:'Comercial'},{v:'uso_mixto',l:'Mixto'}].map(i => (
                            <label key={i.v} className="flex items-center gap-2 cursor-pointer">
                              <input type="radio" name="estado" checked={visitaData.estado_predio === i.v} onChange={() => setVisitaData(prev => ({ ...prev, estado_predio: i.v }))} className="text-blue-600" />
                              <span className="text-sm">{i.l}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500 mb-2 block">Servicios Públicos</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {['Agua','Alcantarillado','Energía','Gas','Internet','Teléfono'].map(s => (
                            <label key={s} className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={visitaData.servicios_publicos.includes(s)} onChange={(e) => { if(e.target.checked) setVisitaData(prev => ({ ...prev, servicios_publicos: [...prev.servicios_publicos, s] })); else setVisitaData(prev => ({ ...prev, servicios_publicos: prev.servicios_publicos.filter(x => x !== s) })); }} className="rounded" />
                              <span className="text-sm">{s}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      
                      {/* Resultado */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input type="checkbox" checked={visitaData.sin_cambios} onChange={(e) => setVisitaData(prev => ({ ...prev, sin_cambios: e.target.checked }))} className="rounded mt-1" />
                          <div>
                            <span className="font-medium text-blue-800">Visitado sin cambios</span>
                            <p className="text-xs text-blue-600 mt-1">Marque si el predio no requiere modificación en los datos catastrales.</p>
                          </div>
                        </label>
                      </div>
                      
                      {/* Fotografías adicionales */}
                      <div>
                        <Label className="text-xs text-slate-500 flex items-center gap-2 mb-2"><Camera className="w-4 h-4" />Fotografías Adicionales</Label>
                        
                        {/* Input oculto para cámara (Android/iOS) */}
                        <input 
                          ref={fileInputRef} 
                          type="file" 
                          accept="image/*" 
                          capture="environment"
                          onChange={handleFotoChange} 
                          className="hidden" 
                          id="camera-input"
                        />
                        
                        {/* Input oculto para galería */}
                        <input 
                          type="file" 
                          accept="image/*" 
                          multiple 
                          onChange={handleFotoChange} 
                          className="hidden" 
                          id="gallery-input"
                        />
                        
                        <div className="grid grid-cols-4 gap-2 mb-2">
                          {fotos.map((f, i) => (
                            <div key={i} className="relative aspect-square rounded overflow-hidden border">
                              <img src={f.preview || f.data || f} alt={`Foto ${i+1}`} className="w-full h-full object-cover" />
                              <button type="button" onClick={() => setFotos(prev => prev.filter((_, j) => j !== i))} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"><X className="w-3 h-3" /></button>
                            </div>
                          ))}
                        </div>
                        
                        {/* Botones separados para cámara y galería */}
                        <div className="grid grid-cols-2 gap-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => document.getElementById('camera-input')?.click()} 
                            className="border-dashed border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          >
                            <Camera className="w-4 h-4 mr-2" />
                            Tomar Foto
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => document.getElementById('gallery-input')?.click()} 
                            className="border-dashed"
                          >
                            <ImageIcon className="w-4 h-4 mr-2" />
                            Galería
                          </Button>
                        </div>
                      </div>
                      
                      {userPosition && (
                        <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 p-2 rounded">
                          <MapPin className="w-3 h-3" />GPS: {userPosition[0].toFixed(6)}, {userPosition[1].toFixed(6)} {gpsAccuracy && `(±${Math.round(gpsAccuracy)}m)`}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          
          {/* Navegación de páginas */}
          <DialogFooter className="flex justify-between items-center pt-4 border-t">
            <div className="flex gap-2">
              {[1,2,3,4,5].map(p => (
                <button key={p} onClick={() => setVisitaPagina(p)} className={`w-8 h-8 rounded-full text-sm font-medium ${visitaPagina === p ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{p}</button>
              ))}
            </div>
            <div className="flex gap-2">
              {visitaPagina > 1 && (
                <Button variant="outline" onClick={() => setVisitaPagina(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                </Button>
              )}
              {visitaPagina < 5 ? (
                <Button onClick={() => setVisitaPagina(p => p + 1)} className="bg-emerald-600 hover:bg-emerald-700">
                  Siguiente <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleGuardarVisita} disabled={saving || !visitaData.persona_atiende.trim()} className="bg-emerald-600 hover:bg-emerald-700">
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Guardar Visita
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Modal de Propuesta de Cambio */}
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
      
      {/* Modal de Selección de Tipo de Revisión */}
      <Dialog open={showTipoRevisionModal} onOpenChange={setShowTipoRevisionModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              ¿Qué tipo de revisión realizarás?
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            <p className="text-sm text-slate-600 mb-4">
              Selecciona el tipo de revisión que vas a realizar en este predio. 
              Esta información quedará registrada en el historial.
            </p>
            
            {/* Opción: Gestor de Campo */}
            <button
              onClick={() => confirmarTipoRevision('campo')}
              className="w-full p-4 rounded-lg border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 group-hover:bg-emerald-200">
                  <MapPin className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800">Gestor de Campo</h4>
                  <p className="text-sm text-slate-500">
                    Visita física, datos de terreno, área construida, fotos, ubicación GPS
                  </p>
                </div>
              </div>
            </button>
            
            {/* Opción: Gestor Jurídico */}
            <button
              onClick={() => confirmarTipoRevision('juridico')}
              className="w-full p-4 rounded-lg border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0 group-hover:bg-blue-200">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800">Gestor Jurídico</h4>
                  <p className="text-sm text-slate-500">
                    Verificación de propietarios, matrícula inmobiliaria, linderos, documentación legal
                  </p>
                </div>
              </div>
            </button>
            
            {/* Opción: Gestor de Calidad */}
            <button
              onClick={() => confirmarTipoRevision('calidad')}
              className="w-full p-4 rounded-lg border-2 border-slate-200 hover:border-amber-500 hover:bg-amber-50 transition-all text-left group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0 group-hover:bg-amber-200">
                  <CheckCircle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800">Gestor de Calidad</h4>
                  <p className="text-sm text-slate-500">
                    Control de calidad, verificación de datos, observaciones, validación final
                  </p>
                </div>
              </div>
            </button>
          </div>
          
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => {
              setShowTipoRevisionModal(false);
              setPredioParaAbrir(null);
            }}>
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========== MODAL DE FIRMA GRANDE ========== */}
      <Dialog open={showFirmaModal} onOpenChange={setShowFirmaModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-800">
              <Pen className="w-5 h-5" />
              {firmaModalTipo === 'visitado' ? 'Firma del Visitado' : 'Firma del Reconocedor'}
            </DialogTitle>
            <DialogDescription>
              Firme en el espacio blanco usando el mouse o el dedo (en dispositivos táctiles)
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="border-4 border-purple-300 rounded-xl bg-white shadow-inner">
              <canvas 
                ref={canvasFirmaModalRef} 
                width={700} 
                height={250} 
                className="w-full touch-none cursor-crosshair rounded-lg" 
                style={{ backgroundColor: '#ffffff' }}
                onMouseDown={startDrawingModal} 
                onMouseMove={drawModal} 
                onMouseUp={stopDrawingModal} 
                onMouseLeave={stopDrawingModal}
                onTouchStart={startDrawingModal} 
                onTouchMove={drawModal} 
                onTouchEnd={stopDrawingModal}
              />
            </div>
            <p className="text-xs text-slate-500 text-center mt-2">
              Use el mouse o toque la pantalla para dibujar su firma
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={limpiarFirmaModal}>
              <Trash2 className="w-4 h-4 mr-2" /> Limpiar
            </Button>
            <Button variant="outline" onClick={() => setShowFirmaModal(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmarFirmaModal} className="bg-purple-700 hover:bg-purple-800">
              <Check className="w-4 h-4 mr-2" /> Confirmar Firma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo de Sincronización e Historial */}
      <Dialog open={showSyncDialog} onOpenChange={setShowSyncDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-emerald-600" />
              Sincronización de Datos
            </DialogTitle>
            <DialogDescription>
              Estado de conexión y cambios pendientes
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Explicación del proceso */}
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
              <p className="font-medium mb-1">📋 Al sincronizar:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Primero <strong>SUBE</strong> su trabajo de campo al servidor</li>
                <li>Después <strong>DESCARGA</strong> datos actualizados (GDB nueva)</li>
              </ol>
              <p className="mt-1 text-blue-600">✅ Su trabajo de campo NO se perderá</p>
            </div>
            
            {/* Estado actual */}
            <div className="p-4 rounded-lg bg-slate-50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Estado de conexión:</span>
                <Badge variant={isOnline ? "default" : "secondary"} className={isOnline ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}>
                  {isOnline ? "✓ Online" : "✕ Offline"}
                </Badge>
              </div>
              {/* Indicador de sincronización en segundo plano */}
              {isBackgroundSyncing && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Sincronización:</span>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 animate-pulse">
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    {backgroundSyncMessage || 'Sincronizando...'}
                  </Badge>
                </div>
              )}
              {backgroundSyncMessage && !isBackgroundSyncing && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Última sincronización:</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700">
                    {backgroundSyncMessage}
                  </Badge>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Cambios pendientes:</span>
                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                  {offlineStats.cambiosPendientes || 0}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Datos offline:</span>
                <Badge variant="outline" className={offlineReady ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}>
                  {offlineReady ? "✓ Listos" : "No descargados"}
                </Badge>
              </div>
            </div>
            
            {/* Barra de progreso de descarga */}
            {isDownloading && (
              <div className="p-4 rounded-lg bg-blue-50 space-y-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="text-sm font-medium text-blue-700">{downloadProgress.phase}</span>
                </div>
                {downloadProgress.total > 0 && (
                  <>
                    <div className="w-full bg-blue-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${(downloadProgress.current / downloadProgress.total) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-blue-600 text-center">
                      {downloadProgress.current.toLocaleString()} / {downloadProgress.total.toLocaleString()}
                    </p>
                  </>
                )}
              </div>
            )}
            
            {/* Botones de acción */}
            <div className="flex gap-2">
              <Button 
                onClick={() => fetchGeometrias(true)} 
                disabled={!isOnline || isDownloading}
                variant="outline"
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                {offlineReady ? "Actualizar datos" : "Descargar para offline"}
              </Button>
              <Button 
                onClick={handleSyncWithHistory} 
                disabled={!isOnline || isSyncing || offlineStats.cambiosPendientes === 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                Sincronizar ({offlineStats.cambiosPendientes})
              </Button>
            </div>
            
            {/* Botón de limpiar caché */}
            <Button 
              onClick={async () => {
                const cleared = await clearOfflineCache();
                if (cleared) {
                  setOfflineReady(false);
                  setLoadedFromCache(false);
                }
              }}
              disabled={isSyncing}
              variant="outline"
              className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Limpiar Caché y Empezar de Nuevo
            </Button>
            
            {/* Historial de sincronización */}
            {syncHistory.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Historial de sincronización
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {syncHistory.map((item, idx) => (
                    <div 
                      key={item.id || idx} 
                      className={`text-xs p-2 rounded flex items-start gap-2 ${
                        item.estado === 'completado' ? 'bg-green-50' :
                        item.estado === 'error' ? 'bg-red-50' :
                        'bg-blue-50'
                      }`}
                    >
                      {item.estado === 'completado' && <CheckCircle2 className="w-3 h-3 text-green-600 mt-0.5 shrink-0" />}
                      {item.estado === 'error' && <XCircle className="w-3 h-3 text-red-600 mt-0.5 shrink-0" />}
                      {item.estado === 'sincronizando' && <Loader2 className="w-3 h-3 text-blue-600 animate-spin mt-0.5 shrink-0" />}
                      <div>
                        <p className={
                          item.estado === 'completado' ? 'text-green-700' :
                          item.estado === 'error' ? 'text-red-700' :
                          'text-blue-700'
                        }>
                          {item.mensaje}
                        </p>
                        <p className="text-slate-400">
                          {new Date(item.fecha).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSyncDialog(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Modal Cancelar Predio */}
      <Dialog open={showCancelarModal} onOpenChange={setShowCancelarModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <Trash2 className="w-5 h-5" />
              {user?.role === 'coordinador' || user?.role === 'administrador' 
                ? 'Cancelar Predio' 
                : 'Proponer Cancelación de Predio'}
            </DialogTitle>
            <DialogDescription>
              {user?.role === 'coordinador' || user?.role === 'administrador'
                ? 'Esta acción eliminará el predio del proyecto. No se puede deshacer.'
                : 'La propuesta de cancelación será enviada al coordinador para su aprobación.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {selectedPredio && (
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-sm text-slate-600">Predio a cancelar:</p>
                <p className="font-mono font-medium">{selectedPredio.codigo_predial || selectedPredio.numero_predial}</p>
                {selectedPredio.direccion && (
                  <p className="text-sm text-slate-500">{selectedPredio.direccion}</p>
                )}
              </div>
            )}
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">Motivo de la cancelación *</Label>
              <textarea
                value={motivoCancelacion}
                onChange={(e) => setMotivoCancelacion(e.target.value)}
                className="w-full p-3 border rounded-lg text-sm min-h-[100px] focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="Describa el motivo por el cual se debe cancelar este predio..."
              />
            </div>
            
            {/* Motivos comunes */}
            <div className="space-y-2">
              <Label className="text-xs text-slate-500">Motivos comunes:</Label>
              <div className="flex flex-wrap gap-1">
                {[
                  'Predio duplicado',
                  'Predio inexistente',
                  'Error en código predial',
                  'Fusión con otro predio',
                  'División/Segregación',
                  'Predio fuera del alcance'
                ].map(motivo => (
                  <Badge 
                    key={motivo}
                    variant="outline"
                    className="cursor-pointer hover:bg-red-50 text-xs"
                    onClick={() => setMotivoCancelacion(motivo)}
                  >
                    {motivo}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowCancelarModal(false)}
              disabled={cancelando}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleCancelarPredio}
              disabled={cancelando || !motivoCancelacion.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {cancelando ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              {user?.role === 'coordinador' || user?.role === 'administrador' 
                ? 'Confirmar Cancelación' 
                : 'Enviar Propuesta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Modal Confirmación Re-visita */}
      <Dialog open={showConfirmRevisita} onOpenChange={setShowConfirmRevisita}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
              Predio Ya Visitado
            </DialogTitle>
            <DialogDescription>
              Este predio ya tiene un formato de visita guardado. ¿Desea sobrescribir los datos existentes?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {predioParaRevisita && (
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                <p className="text-sm text-amber-700 font-medium">Predio:</p>
                <p className="font-mono text-sm">{predioParaRevisita.codigo_predial || predioParaRevisita.numero_predial}</p>
                {predioParaRevisita.direccion && (
                  <p className="text-sm text-slate-500 mt-1">{predioParaRevisita.direccion}</p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <Badge className="bg-blue-100 text-blue-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Visitado
                  </Badge>
                  {predioParaRevisita.visita?.fecha_visita && (
                    <span className="text-xs text-slate-500">
                      Última visita: {new Date(predioParaRevisita.visita.fecha_visita).toLocaleDateString('es-CO')}
                    </span>
                  )}
                </div>
              </div>
            )}
            
            <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
              <p className="font-medium mb-1">⚠️ Atención:</p>
              <p>Si continúa, los datos del formato de visita anterior serán reemplazados con los nuevos datos que ingrese.</p>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={cancelarRevisita}
            >
              Cancelar
            </Button>
            <Button 
              onClick={confirmarRevisita}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <Edit className="w-4 h-4 mr-2" />
              Continuar y Editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Modal Crear Predio Nuevo */}
      <CrearPredioNuevoModal
        isOpen={showCrearPredioModal}
        onClose={() => setShowCrearPredioModal(false)}
        proyectoId={proyectoId}
        municipio={proyecto?.municipio}
        token={localStorage.getItem('token')}
        onSuccess={(data) => {
          // Recargar predios del proyecto
          fetchPrediosR1R2();
          toast.success(`Predio ${data.codigo_homologado} creado exitosamente`);
        }}
      />
      
      {/* Modal Finalizar Proyecto */}
      <FinalizarProyectoModal
        isOpen={showFinalizarProyectoModal}
        onClose={() => setShowFinalizarProyectoModal(false)}
        proyectoId={proyectoId}
        proyectoNombre={proyecto?.nombre}
        token={localStorage.getItem('token')}
        onSuccess={() => {
          // Actualizar estado del proyecto
          setProyecto(prev => ({ ...prev, estado: 'completado' }));
        }}
      />
    </div>
  );
}
