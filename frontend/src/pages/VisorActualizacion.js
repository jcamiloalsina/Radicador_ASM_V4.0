import React, { useEffect, useState, useRef, useCallback, useMemo, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, GeoJSON, Marker, CircleMarker, useMap, useMapEvents, ImageOverlay } from 'react-leaflet';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Offline sync
import useOfflineSync from '../hooks/useOfflineSync';
import { getProyectoOffline, getGeometriasOffline, saveProyectoOffline, saveGeometriasOffline, getPrediosOffline, savePrediosOffline } from '../utils/offlineDB';

// Componentes optimizados
import FirmaCanvas from '../components/FirmaCanvas';
import ListaPrediosPaginada from '../components/ListaPrediosPaginada';

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
  Loader2
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
  
  // Hook de sincronización offline
  const { 
    isOnline, 
    isSyncing, 
    offlineStats, 
    downloadForOffline, 
    saveOfflineChange,
    getOfflineData,
    forceSync
  } = useOfflineSync(proyectoId, 'actualizacion');
  
  // Estados del proyecto
  const [proyecto, setProyecto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [geometrias, setGeometrias] = useState(null);
  const [geometriasFiltradas, setGeometriasFiltradas] = useState(null);
  const [construcciones, setConstrucciones] = useState(null);
  const [prediosR1R2, setPrediosR1R2] = useState([]);
  
  // Estados de descarga offline y progreso
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0, phase: '' });
  const [isDownloading, setIsDownloading] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [loadedFromCache, setLoadedFromCache] = useState(false);
  const [syncHistory, setSyncHistory] = useState([]);
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  
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
  
  // Estados de tipo de revisión
  const [showTipoRevisionModal, setShowTipoRevisionModal] = useState(false);
  const [tipoRevision, setTipoRevision] = useState(null); // 'campo', 'juridico', 'calidad'
  const [predioParaAbrir, setPredioParaAbrir] = useState(null);
  
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
  const [visitaPagina, setVisitaPagina] = useState(1); // Página actual del formulario (1-5)
  const [visitaData, setVisitaData] = useState({
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
    sin_cambios: false
  });
  // Canvas refs para las firmas
  const canvasVisitadoRef = useRef(null);
  const canvasReconocedorRef = useRef(null);
  const canvasFirmaModalRef = useRef(null);
  const [isDrawingVisitado, setIsDrawingVisitado] = useState(false);
  const [isDrawingReconocedor, setIsDrawingReconocedor] = useState(false);
  const [isDrawingModal, setIsDrawingModal] = useState(false);
  // Modal de firma grande
  const [showFirmaModal, setShowFirmaModal] = useState(false);
  const [firmaModalTipo, setFirmaModalTipo] = useState('visitado'); // 'visitado' o 'reconocedor'
  // Lista de propietarios para el formulario de visita
  const [visitaPropietarios, setVisitaPropietarios] = useState([{
    tipo_documento: '',
    numero_documento: '',
    nombre: '',
    primer_apellido: '',
    segundo_apellido: '',
    genero: '', // masculino, femenino, lgbtq, otro
    genero_otro: '',
    grupo_etnico: ''
  }]);
  // Sección 7: Unidades de Construcción (dinámico, permite agregar más de 5)
  const [visitaConstrucciones, setVisitaConstrucciones] = useState([
    { unidad: 'A', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' },
    { unidad: 'B', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' },
    { unidad: 'C', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' },
    { unidad: 'D', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' },
    { unidad: 'E', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' }
  ]);
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
            return; // No necesita descargar del servidor
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
          params: { zona: filterZona !== 'todos' ? filterZona : undefined }
        });
        
        if (response.data.geometrias?.features?.length > 0) {
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
            }
          });
          
          if (response.data.geometrias?.features?.length > 0) {
            allFeatures = [...allFeatures, ...response.data.geometrias.features];
          }
          
          // Capturar construcciones del primer lote (solo vienen con offset=0)
          if (batch === 0 && response.data.construcciones?.features?.length > 0) {
            setConstrucciones(response.data.construcciones);
            console.log(`[Visor] Construcciones cargadas: ${response.data.construcciones.features.length}`);
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
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/actualizacion/proyectos/${proyectoId}/predios`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const predios = response.data.predios || [];
      setPrediosR1R2(predios);
      
      // Guardar automáticamente para modo offline
      if (predios.length > 0) {
        try {
          await savePrediosOffline(proyectoId, predios, proyecto?.municipio);
          console.log('[Offline] Predios R1/R2 guardados para offline:', predios.length);
        } catch (saveError) {
          console.warn('[Offline] No se pudieron guardar predios offline:', saveError);
        }
      }
    } catch (error) {
      console.error('Error cargando predios R1/R2:', error);
      
      // Si está offline, intentar cargar desde IndexedDB
      if (!navigator.onLine) {
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
      }
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
      // Si es gestor, mostrar modal de tipo de revisión primero
      const esGestor = user?.role === 'gestor';
      if (esGestor) {
        setPredioParaAbrir(predio);
        setShowTipoRevisionModal(true);
      } else {
        abrirDetallePredio(predio);
      }
    } else if (!geometrias?.features?.find(f => f.properties?.codigo_predial?.includes(searchCode))) {
      toast.warning('Predio no encontrado');
    }
  };
  
  // Función para abrir el detalle del predio (después de seleccionar tipo de revisión)
  const abrirDetallePredio = (predio, tipo = null) => {
    setSelectedPredio(predio);
    setTipoRevision(tipo);
    cargarDatosParaEdicion(predio);
    setShowPredioDetail(true);
    setEditMode(false);
    
    // Cargar propuestas e historial
    const codigo = predio?.codigo_predial || predio?.numero_predial;
    if (codigo) {
      fetchPropuestas(codigo);
      fetchHistorial(codigo);
    }
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
        setVisitaPropietarios([{ tipo_documento: '', numero_documento: '', nombre: '', primer_apellido: '', segundo_apellido: '', genero: '', genero_otro: '', grupo_etnico: '' }]);
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
      area_geografica_ha: selectedPredio?.area_gdb ? (parseFloat(selectedPredio.area_gdb) / 10000).toFixed(4) : '',
      area_geografica_m2: selectedPredio?.area_gdb?.toString() || '', // del GDB (corregido: era area_geografica)
      area_geografica_desc: 'Área del GDB (geometría)',
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
  
  // Funciones para manejar propietarios en el formulario de visita
  const agregarPropietarioVisita = () => {
    setVisitaPropietarios(prev => [...prev, {
      tipo_documento: '',
      numero_documento: '',
      nombre: '',
      primer_apellido: '',
      segundo_apellido: '',
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

  // Referencias para throttling de firmas
  const rafVisitadoRef = useRef(null);
  const rafReconocedorRef = useRef(null);
  const rafModalRef = useRef(null);
  const lastPointVisitado = useRef(null);
  const lastPointReconocedor = useRef(null);
  const lastPointModal = useRef(null);

  // Funciones optimizadas para firma del visitado (Sección 12)
  const startDrawingVisitado = (e) => {
    setIsDrawingVisitado(true);
    const canvas = canvasVisitadoRef.current;
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
    lastPointVisitado.current = { x, y };
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const drawVisitado = (e) => {
    if (!isDrawingVisitado) return;
    if (e.type.includes('touch')) e.preventDefault();
    
    // Cancelar frame anterior
    if (rafVisitadoRef.current) cancelAnimationFrame(rafVisitadoRef.current);
    
    rafVisitadoRef.current = requestAnimationFrame(() => {
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
        ctx.stroke();
      }
      lastPointVisitado.current = { x, y };
    });
  };

  const stopDrawingVisitado = () => {
    setIsDrawingVisitado(false);
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
    setIsDrawingReconocedor(true);
    const canvas = canvasReconocedorRef.current;
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
    lastPointReconocedor.current = { x, y };
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const drawReconocedor = (e) => {
    if (!isDrawingReconocedor) return;
    if (e.type.includes('touch')) e.preventDefault();
    
    if (rafReconocedorRef.current) cancelAnimationFrame(rafReconocedorRef.current);
    
    rafReconocedorRef.current = requestAnimationFrame(() => {
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
        ctx.stroke();
      }
      lastPointReconocedor.current = { x, y };
    });
  };

  const stopDrawingReconocedor = () => {
    setIsDrawingReconocedor(false);
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
    setIsDrawingModal(true);
    const canvas = canvasFirmaModalRef.current;
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
    lastPointModal.current = { x, y };
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const drawModal = (e) => {
    if (!isDrawingModal) return;
    if (e.type.includes('touch')) e.preventDefault();
    
    if (rafModalRef.current) cancelAnimationFrame(rafModalRef.current);
    
    rafModalRef.current = requestAnimationFrame(() => {
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
        ctx.stroke();
      }
      lastPointModal.current = { x, y };
    });
  };

  const stopDrawingModal = () => {
    setIsDrawingModal(false);
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
        await axios.patch(
          `${API}/actualizacion/proyectos/${proyectoId}/predios/${codigoPredial}`,
          datosActualizacion,
          { headers: { Authorization: `Bearer ${token}` }}
        );
        
        toast.success(visitaData.sin_cambios && !hayCambiosSugeridos
          ? 'Visita guardada - Predio marcado como visitado sin cambios' 
          : hayCambiosSugeridos 
            ? `Formato guardado - Se detectaron ${Object.keys(cambiosSugeridos).length} cambio(s) sugerido(s) para revisión`
            : 'Formato de visita guardado exitosamente'
        );
        
        // Notificar si hay cambios jurídicos pendientes
        if (hayCambiosJuridicos) {
          toast.info('Se detectaron cambios jurídicos (matrícula/propietarios) que requieren revisión especial', { duration: 5000 });
        }
      } else {
        // Modo offline: guardar para sincronizar después
        await saveOfflineChange('visita', {
          codigo_predial: codigoPredial,
          ...datosActualizacion
        });
        
        toast.info('Visita guardada localmente - Se sincronizará al recuperar conexión');
      }
      
      setShowVisitaModal(false);
      
      // Actualizar estado local
      setPrediosR1R2(prev => prev.map(p => 
        (p.codigo_predial === codigoPredial || p.numero_predial === codigoPredial)
          ? { ...p, estado_visita: 'visitado', sin_cambios: visitaData.sin_cambios }
          : p
      ));
      
      setSelectedPredio(prev => ({ ...prev, estado_visita: 'visitado', sin_cambios: visitaData.sin_cambios }));
      setEditData(prev => ({ ...prev, estado_visita: 'visitado' }));
      setShowPredioDetail(false);
    } catch (error) {
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
          // Si es gestor, mostrar modal de tipo de revisión primero
          const esGestor = user?.role === 'gestor';
          if (esGestor) {
            setPredioParaAbrir(predio);
            setShowTipoRevisionModal(true);
          } else {
            setSelectedPredio(predio);
            cargarDatosParaEdicion(predio);
            setShowPredioDetail(true);
            setEditMode(false);
          }
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
          
          const esGestor = user?.role === 'gestor';
          if (esGestor) {
            setPredioParaAbrir(predioBasico);
            setShowTipoRevisionModal(true);
          } else {
            setSelectedPredio(predioBasico);
            cargarDatosParaEdicion(predioBasico);
            setShowPredioDetail(true);
            setEditMode(false);
          }
        }
        
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
        
        {/* GPS Status + Offline Status */}
        <div className="flex items-center gap-2">
          {/* Indicador Offline Ready */}
          {offlineReady && (
            <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-300">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Offline Ready
            </Badge>
          )}
          {/* Indicador cargado desde caché */}
          {loadedFromCache && (
            <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 border-purple-300">
              <Database className="w-3 h-3 mr-1" />
              Caché
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
      
      {/* Estadísticas rápidas - clickeables para filtrar */}
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
          onClick={() => setFilterEstado('pendiente')}
          className={`flex items-center gap-1 whitespace-nowrap px-2 py-1 rounded transition-colors ${
            filterEstado === 'pendiente' ? 'bg-slate-200 font-medium' : 'hover:bg-slate-100'
          }`}
        >
          <Square className="w-3 h-3 text-slate-400" />
          <span>Pendientes: {estadisticas.pendientes}</span>
        </button>
        <button 
          onClick={() => setFilterEstado('visitado')}
          className={`flex items-center gap-1 whitespace-nowrap px-2 py-1 rounded transition-colors ${
            filterEstado === 'visitado' ? 'bg-amber-200 font-medium' : 'hover:bg-amber-50'
          }`}
        >
          <Eye className="w-3 h-3 text-amber-500" />
          <span>Visitados: {estadisticas.visitados}</span>
        </button>
        <button 
          onClick={() => setFilterEstado('actualizado')}
          className={`flex items-center gap-1 whitespace-nowrap px-2 py-1 rounded transition-colors ${
            filterEstado === 'actualizado' ? 'bg-purple-200 font-medium' : 'hover:bg-purple-50'
          }`}
        >
          <CheckSquare className="w-3 h-3 text-purple-500" />
          <span>Actualizados: {estadisticas.actualizados}</span>
        </button>
        {filterEstado !== 'todos' && (
          <span className="text-slate-400 ml-auto flex items-center gap-1">
            <span>Mostrando: {geometriasFiltradas?.features?.length || 0} polígonos</span>
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
                  <TabsList className="grid grid-cols-7 w-full">
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="propietarios">Propietarios</TabsTrigger>
                    <TabsTrigger value="fisico">Físico</TabsTrigger>
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
                          value={editFormData.lindero_norte || ''}
                          onChange={(e) => setEditFormData({...editFormData, lindero_norte: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Lindero Sur</Label>
                        <textarea 
                          className="w-full min-h-[80px] p-2 text-sm border rounded-md resize-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          placeholder="Ej: Colinda con vía pública, calle 5..."
                          value={editFormData.lindero_sur || ''}
                          onChange={(e) => setEditFormData({...editFormData, lindero_sur: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Lindero Este</Label>
                        <textarea 
                          className="w-full min-h-[80px] p-2 text-sm border rounded-md resize-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          placeholder="Ej: Colinda con quebrada La Honda..."
                          value={editFormData.lindero_este || ''}
                          onChange={(e) => setEditFormData({...editFormData, lindero_este: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Lindero Oeste</Label>
                        <textarea 
                          className="w-full min-h-[80px] p-2 text-sm border rounded-md resize-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          placeholder="Ej: Colinda con predio de María García..."
                          value={editFormData.lindero_oeste || ''}
                          onChange={(e) => setEditFormData({...editFormData, lindero_oeste: e.target.value})}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-xs">Observaciones de Linderos</Label>
                      <textarea 
                        className="w-full min-h-[60px] p-2 text-sm border rounded-md resize-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        placeholder="Notas adicionales sobre los límites del predio..."
                        value={editFormData.observaciones_linderos || ''}
                        onChange={(e) => setEditFormData({...editFormData, observaciones_linderos: e.target.value})}
                      />
                    </div>
                    
                    <div className="flex items-center gap-4 pt-2 border-t">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          checked={editFormData.linderos_verificados || false}
                          onChange={(e) => setEditFormData({...editFormData, linderos_verificados: e.target.checked})}
                        />
                        <span className="text-sm text-slate-700">Linderos verificados en campo</span>
                      </label>
                      
                      {editFormData.linderos_verificados && (
                        <div>
                          <Label className="text-xs">Fecha verificación</Label>
                          <Input 
                            type="date" 
                            className="w-40"
                            value={editFormData.fecha_verificacion_linderos || ''}
                            onChange={(e) => setEditFormData({...editFormData, fecha_verificacion_linderos: e.target.value})}
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
                          value={editFormData.sistema_referencia || 'MAGNA-SIRGAS'}
                          onChange={(e) => setEditFormData({...editFormData, sistema_referencia: e.target.value})}
                        >
                          <option value="MAGNA-SIRGAS">MAGNA-SIRGAS</option>
                          <option value="WGS84">WGS84</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs">Precisión GPS</Label>
                        <select 
                          className="w-full h-10 px-3 py-2 text-sm border rounded-md bg-background focus:ring-2 focus:ring-emerald-500"
                          value={editFormData.precision_gps || ''}
                          onChange={(e) => setEditFormData({...editFormData, precision_gps: e.target.value})}
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
                            onClick={() => setEditFormData({
                              ...editFormData, 
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
                            value={editFormData.latitud_centroide || ''}
                            onChange={(e) => setEditFormData({...editFormData, latitud_centroide: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Longitud (X)</Label>
                          <Input 
                            type="number" 
                            step="0.000001"
                            placeholder="Ej: -73.123456"
                            value={editFormData.longitud_centroide || ''}
                            onChange={(e) => setEditFormData({...editFormData, longitud_centroide: e.target.value})}
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
                          value={editFormData.area_calculada || ''}
                          onChange={(e) => setEditFormData({...editFormData, area_calculada: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Equipo GPS Utilizado</Label>
                        <Input 
                          placeholder="Ej: GPS Garmin 64s"
                          value={editFormData.equipo_gps || ''}
                          onChange={(e) => setEditFormData({...editFormData, equipo_gps: e.target.value})}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-xs">Fecha de Captura</Label>
                      <Input 
                        type="date" 
                        className="w-48"
                        value={editFormData.fecha_captura_coordenadas || ''}
                        onChange={(e) => setEditFormData({...editFormData, fecha_captura_coordenadas: e.target.value})}
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
                        onClick={abrirFormatoVisita}
                        disabled={saving}
                        className={`flex-1 ${selectedPredio.estado_visita === 'visitado' 
                          ? 'border-blue-500 text-blue-700 hover:bg-blue-50' 
                          : 'border-emerald-500 text-emerald-700 hover:bg-emerald-50'}`}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        {selectedPredio.estado_visita === 'visitado' ? 'Editar Formato de Visita' : 'Formato de Visita'}
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
                          <Input value={visitaData.persona_atiende} onChange={(e) => setVisitaData(prev => ({ ...prev, persona_atiende: e.target.value.toUpperCase() }))} placeholder="NOMBRE COMPLETO" className="uppercase bg-white" />
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
                        2. INFORMACIÓN BÁSICA DEL PREDIO
                      </h3>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-slate-500">Departamento</Label>
                          <Input value="Norte de Santander" disabled className="bg-slate-100 font-medium" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Municipio</Label>
                          <Input value={proyecto?.municipio || selectedPredio.municipio || ''} disabled className="bg-slate-100 font-medium" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Número Predial (30 dígitos)</Label>
                        <Input value={selectedPredio.codigo_predial || selectedPredio.numero_predial || ''} disabled className="bg-slate-100 font-mono font-bold text-emerald-800 tracking-wider" />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label className="text-xs text-slate-500">Código Homologado</Label>
                          <Input value={selectedPredio.codigo_homologado || 'Sin código'} disabled className="bg-slate-100 font-mono" />
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
                        <Input value={visitaData.direccion_visita} onChange={(e) => setVisitaData(prev => ({ ...prev, direccion_visita: e.target.value.toUpperCase() }))} placeholder="Dirección" className="uppercase" />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500 mb-2 block">Destino Económico <span className="text-emerald-600">(verificar)</span></Label>
                        <div className="grid grid-cols-4 gap-2">
                          {[{v:'A',l:'A - Habitacional'},{v:'B',l:'B - Industrial'},{v:'C',l:'C - Comercial'},{v:'D',l:'D - Agropecuario'},{v:'E',l:'E - Minero'},{v:'F',l:'F - Cultural'},{v:'G',l:'G - Recreacional'},{v:'H',l:'H - Salubridad'},{v:'I',l:'I - Institucional'},{v:'J',l:'J - Educativo'},{v:'K',l:'K - Religioso'},{v:'L',l:'L - Agrícola'},{v:'M',l:'M - Forestal'},{v:'N',l:'N - Pecuario'},{v:'O',l:'O - Uso Público'},{v:'P',l:'P - Lote'}].map(i => (
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
                            <div className="grid grid-cols-3 gap-3 mb-2">
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
                          <Input value={visitaData.not_telefono} onChange={(e) => setVisitaData(prev => ({ ...prev, not_telefono: e.target.value }))} placeholder="3001234567" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Correo Electrónico</Label>
                          <Input type="email" value={visitaData.not_correo} onChange={(e) => setVisitaData(prev => ({ ...prev, not_correo: e.target.value.toLowerCase() }))} placeholder="correo@ejemplo.com" />
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
                        <Input value={visitaData.not_direccion} onChange={(e) => setVisitaData(prev => ({ ...prev, not_direccion: e.target.value.toUpperCase() }))} className="uppercase" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-slate-500">Departamento</Label>
                          <Input value={visitaData.not_departamento} disabled className="bg-slate-100" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Municipio</Label>
                          <Input value={visitaData.not_municipio} onChange={(e) => setVisitaData(prev => ({ ...prev, not_municipio: e.target.value.toUpperCase() }))} className="uppercase" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-slate-500">Vereda</Label>
                          <Input value={visitaData.not_vereda} onChange={(e) => setVisitaData(prev => ({ ...prev, not_vereda: e.target.value.toUpperCase() }))} className="uppercase" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Corregimiento</Label>
                          <Input value={visitaData.not_corregimiento} onChange={(e) => setVisitaData(prev => ({ ...prev, not_corregimiento: e.target.value.toUpperCase() }))} className="uppercase" />
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
                    <div className="bg-orange-50 px-4 py-2 border-b border-orange-200">
                      <h3 className="font-semibold text-orange-800 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        8. CALIFICACIÓN
                      </h3>
                    </div>
                    <div className="p-4 space-y-4">
                      {/* Estructura */}
                      <div className="border rounded-lg p-3 bg-slate-50">
                        <h4 className="font-medium text-slate-700 mb-3">8.1 ESTRUCTURA</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <Label className="text-xs text-slate-500">Armazón</Label>
                            <Input value={visitaData.calif_estructura.armazon} onChange={(e) => setVisitaData(prev => ({ ...prev, calif_estructura: { ...prev.calif_estructura, armazon: e.target.value } }))} placeholder="Código" className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Muros</Label>
                            <Input value={visitaData.calif_estructura.muros} onChange={(e) => setVisitaData(prev => ({ ...prev, calif_estructura: { ...prev.calif_estructura, muros: e.target.value } }))} placeholder="Código" className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Cubierta</Label>
                            <Input value={visitaData.calif_estructura.cubierta} onChange={(e) => setVisitaData(prev => ({ ...prev, calif_estructura: { ...prev.calif_estructura, cubierta: e.target.value } }))} placeholder="Código" className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Conservación</Label>
                            <Input value={visitaData.calif_estructura.conservacion} onChange={(e) => setVisitaData(prev => ({ ...prev, calif_estructura: { ...prev.calif_estructura, conservacion: e.target.value } }))} placeholder="Código" className="h-8 text-sm" />
                          </div>
                        </div>
                      </div>

                      {/* Acabados Principales */}
                      <div className="border rounded-lg p-3 bg-slate-50">
                        <h4 className="font-medium text-slate-700 mb-3">8.2 ACABADOS PRINCIPALES</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <Label className="text-xs text-slate-500">Fachadas</Label>
                            <Input value={visitaData.calif_acabados.fachadas} onChange={(e) => setVisitaData(prev => ({ ...prev, calif_acabados: { ...prev.calif_acabados, fachadas: e.target.value } }))} placeholder="Código" className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Cubrimiento Muros</Label>
                            <Input value={visitaData.calif_acabados.cubrim_muros} onChange={(e) => setVisitaData(prev => ({ ...prev, calif_acabados: { ...prev.calif_acabados, cubrim_muros: e.target.value } }))} placeholder="Código" className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Pisos</Label>
                            <Input value={visitaData.calif_acabados.pisos} onChange={(e) => setVisitaData(prev => ({ ...prev, calif_acabados: { ...prev.calif_acabados, pisos: e.target.value } }))} placeholder="Código" className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Conservación</Label>
                            <Input value={visitaData.calif_acabados.conservacion} onChange={(e) => setVisitaData(prev => ({ ...prev, calif_acabados: { ...prev.calif_acabados, conservacion: e.target.value } }))} placeholder="Código" className="h-8 text-sm" />
                          </div>
                        </div>
                      </div>

                      {/* Baño */}
                      <div className="border rounded-lg p-3 bg-slate-50">
                        <h4 className="font-medium text-slate-700 mb-3">8.3 BAÑO</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <Label className="text-xs text-slate-500">Tamaño</Label>
                            <Input value={visitaData.calif_bano.tamano} onChange={(e) => setVisitaData(prev => ({ ...prev, calif_bano: { ...prev.calif_bano, tamano: e.target.value } }))} placeholder="Código" className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Enchape</Label>
                            <Input value={visitaData.calif_bano.enchape} onChange={(e) => setVisitaData(prev => ({ ...prev, calif_bano: { ...prev.calif_bano, enchape: e.target.value } }))} placeholder="Código" className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Mobiliario</Label>
                            <Input value={visitaData.calif_bano.mobiliario} onChange={(e) => setVisitaData(prev => ({ ...prev, calif_bano: { ...prev.calif_bano, mobiliario: e.target.value } }))} placeholder="Código" className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Conservación</Label>
                            <Input value={visitaData.calif_bano.conservacion} onChange={(e) => setVisitaData(prev => ({ ...prev, calif_bano: { ...prev.calif_bano, conservacion: e.target.value } }))} placeholder="Código" className="h-8 text-sm" />
                          </div>
                        </div>
                      </div>

                      {/* Cocina */}
                      <div className="border rounded-lg p-3 bg-slate-50">
                        <h4 className="font-medium text-slate-700 mb-3">8.4 COCINA</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <Label className="text-xs text-slate-500">Tamaño</Label>
                            <Input value={visitaData.calif_cocina.tamano} onChange={(e) => setVisitaData(prev => ({ ...prev, calif_cocina: { ...prev.calif_cocina, tamano: e.target.value } }))} placeholder="Código" className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Enchape</Label>
                            <Input value={visitaData.calif_cocina.enchape} onChange={(e) => setVisitaData(prev => ({ ...prev, calif_cocina: { ...prev.calif_cocina, enchape: e.target.value } }))} placeholder="Código" className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Mobiliario</Label>
                            <Input value={visitaData.calif_cocina.mobiliario} onChange={(e) => setVisitaData(prev => ({ ...prev, calif_cocina: { ...prev.calif_cocina, mobiliario: e.target.value } }))} placeholder="Código" className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Conservación</Label>
                            <Input value={visitaData.calif_cocina.conservacion} onChange={(e) => setVisitaData(prev => ({ ...prev, calif_cocina: { ...prev.calif_cocina, conservacion: e.target.value } }))} placeholder="Código" className="h-8 text-sm" />
                          </div>
                        </div>
                      </div>

                      {/* Complemento Industria */}
                      <div className="border rounded-lg p-3 bg-slate-50">
                        <h4 className="font-medium text-slate-700 mb-3">8.5 COMPLEMENTO INDUSTRIA (si aplica)</h4>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          <div>
                            <Label className="text-xs text-slate-500">Cercha Madera</Label>
                            <Input value={visitaData.calif_industria.cercha_madera} onChange={(e) => setVisitaData(prev => ({ ...prev, calif_industria: { ...prev.calif_industria, cercha_madera: e.target.value } }))} placeholder="Código" className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Cercha Met. Liviana</Label>
                            <Input value={visitaData.calif_industria.cercha_metalica_liviana} onChange={(e) => setVisitaData(prev => ({ ...prev, calif_industria: { ...prev.calif_industria, cercha_metalica_liviana: e.target.value } }))} placeholder="Código" className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Cercha Met. Mediana</Label>
                            <Input value={visitaData.calif_industria.cercha_metalica_mediana} onChange={(e) => setVisitaData(prev => ({ ...prev, calif_industria: { ...prev.calif_industria, cercha_metalica_mediana: e.target.value } }))} placeholder="Código" className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Cercha Met. Pesada</Label>
                            <Input value={visitaData.calif_industria.cercha_metalica_pesada} onChange={(e) => setVisitaData(prev => ({ ...prev, calif_industria: { ...prev.calif_industria, cercha_metalica_pesada: e.target.value } }))} placeholder="Código" className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Altura</Label>
                            <Input value={visitaData.calif_industria.altura} onChange={(e) => setVisitaData(prev => ({ ...prev, calif_industria: { ...prev.calif_industria, altura: e.target.value } }))} placeholder="m" className="h-8 text-sm" />
                          </div>
                        </div>
                      </div>

                      {/* Datos Generales */}
                      <div className="border rounded-lg p-3 bg-emerald-50 border-emerald-200">
                        <h4 className="font-medium text-emerald-700 mb-3">8.6 DATOS GENERALES DE CONSTRUCCIÓN</h4>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          <div>
                            <Label className="text-xs text-slate-500">Total Pisos</Label>
                            <Input type="number" value={visitaData.calif_generales.total_pisos} onChange={(e) => setVisitaData(prev => ({ ...prev, calif_generales: { ...prev.calif_generales, total_pisos: e.target.value } }))} placeholder="0" className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Habitaciones</Label>
                            <Input type="number" value={visitaData.calif_generales.total_habitaciones} onChange={(e) => setVisitaData(prev => ({ ...prev, calif_generales: { ...prev.calif_generales, total_habitaciones: e.target.value } }))} placeholder="0" className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Baños</Label>
                            <Input type="number" value={visitaData.calif_generales.total_banos} onChange={(e) => setVisitaData(prev => ({ ...prev, calif_generales: { ...prev.calif_generales, total_banos: e.target.value } }))} placeholder="0" className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Locales</Label>
                            <Input type="number" value={visitaData.calif_generales.total_locales} onChange={(e) => setVisitaData(prev => ({ ...prev, calif_generales: { ...prev.calif_generales, total_locales: e.target.value } }))} placeholder="0" className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Área Total Const. (m²)</Label>
                            <Input type="number" value={visitaData.calif_generales.area_total_construida} onChange={(e) => setVisitaData(prev => ({ ...prev, calif_generales: { ...prev.calif_generales, area_total_construida: e.target.value } }))} placeholder="0" className="h-8 text-sm" />
                          </div>
                        </div>
                      </div>
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
                      
                      {/* Input para fotos */}
                      <input type="file" accept="image/*" multiple onChange={handleFotoCroquisChange} className="hidden" id="input-fotos-croquis" />
                      
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
                      
                      {/* Botón para agregar fotos */}
                      <Button type="button" variant="outline" onClick={() => document.getElementById('input-fotos-croquis').click()} className="w-full border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50">
                        <Camera className="w-4 h-4 mr-2" />
                        Agregar Fotos del Croquis / Localización
                      </Button>
                      
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
                  {/* Sección 11: Observaciones */}
                  <div className="border border-amber-200 rounded-lg overflow-hidden">
                    <div className="bg-amber-50 px-4 py-2 border-b border-amber-200">
                      <h3 className="font-semibold text-amber-800 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        11. OBSERVACIONES
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

                  {/* Sección 12: Firmas */}
                  <div className="border border-purple-200 rounded-lg overflow-hidden">
                    <div className="bg-purple-50 px-4 py-2 border-b border-purple-200">
                      <h3 className="font-semibold text-purple-800 flex items-center gap-2">
                        <Pen className="w-4 h-4" />
                        12. FIRMAS
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
                        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFotoChange} className="hidden" />
                        <div className="grid grid-cols-4 gap-2 mb-2">
                          {fotos.map((f, i) => (
                            <div key={i} className="relative aspect-square rounded overflow-hidden border">
                              <img src={f.preview || f} alt={`Foto ${i+1}`} className="w-full h-full object-cover" />
                              <button type="button" onClick={() => setFotos(prev => prev.filter((_, j) => j !== i))} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"><X className="w-3 h-3" /></button>
                            </div>
                          ))}
                        </div>
                        <Button type="button" variant="outline" onClick={handleCapturarFoto} className="w-full border-dashed"><Camera className="w-4 h-4 mr-2" />Tomar / Seleccionar Fotos</Button>
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
            {/* Estado actual */}
            <div className="p-4 rounded-lg bg-slate-50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Estado de conexión:</span>
                <Badge variant={isOnline ? "default" : "secondary"} className={isOnline ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}>
                  {isOnline ? "✓ Online" : "✕ Offline"}
                </Badge>
              </div>
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
    </div>
  );
}
