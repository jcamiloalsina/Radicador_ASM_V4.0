import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, Popup, useMap, Tooltip, Marker, CircleMarker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Map, Search, MapPin, Building, User, DollarSign, 
  Layers, ZoomIn, ZoomOut, Home, FileText, AlertCircle, Eye, EyeOff, Navigation, Crosshair, AlertTriangle, CheckCircle, XCircle, Upload, Trash2, Image, Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Componente inteligente que cambia de Esri a Google cuando el zoom es alto
const SmartTileLayer = ({ mapType, tileLayers, ortoimagenActiva }) => {
  const map = useMap();
  const [currentZoom, setCurrentZoom] = useState(map.getZoom());
  
  useMapEvents({
    zoomend: () => {
      setCurrentZoom(map.getZoom());
    }
  });
  
  // Si hay ortoimagen activa, mostrarla en lugar del mapa base
  if (ortoimagenActiva) {
    const ortoTileUrl = `${BACKEND_URL}/api/ortoimagenes/tiles/${ortoimagenActiva.id}/{z}/{x}/{y}.png`;
    return (
      <>
        {/* Capa base para áreas fuera de la ortoimagen */}
        <TileLayer
          url={tileLayers.satellite.url}
          attribution={tileLayers.satellite.attribution}
          maxZoom={20}
          opacity={0.3}
        />
        {/* Capa de ortoimagen personalizada */}
        <TileLayer
          key={`orto-${ortoimagenActiva.id}`}
          url={ortoTileUrl}
          attribution={`© Ortoimagen ${ortoimagenActiva.nombre}`}
          maxZoom={ortoimagenActiva.zoom_max || 20}
          minZoom={ortoimagenActiva.zoom_min || 14}
          errorTileUrl=""
        />
        <div className="absolute bottom-8 left-2 z-[1000] bg-emerald-600/90 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
          🛰️ Ortoimagen: {ortoimagenActiva.nombre}
        </div>
      </>
    );
  }
  
  // Si es satélite y zoom > 17, usar Google automáticamente
  const effectiveLayer = (mapType === 'satellite' && currentZoom > 17) 
    ? tileLayers.google_satellite 
    : tileLayers[mapType];
  
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
};

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

// Fix for Leaflet default marker icon
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Función auxiliar para convertir decimal a DMS (usada en popup)
const decimalToDMSHelper = (decimal, isLat) => {
  const abs = Math.abs(decimal);
  const grados = Math.floor(abs);
  const minutos = Math.floor((abs - grados) * 60);
  const segundos = ((abs - grados - minutos / 60) * 3600).toFixed(2);
  const direccion = isLat 
    ? (decimal >= 0 ? 'N' : 'S')
    : (decimal >= 0 ? 'E' : 'W');
  return { grados, minutos, segundos, direccion };
};

// Component to fit bounds when geometry changes
function FitBounds({ geometry }) {
  const map = useMap();
  
  useEffect(() => {
    if (geometry && geometry.geometry) {
      try {
        const geoJSON = L.geoJSON(geometry);
        const bounds = geoJSON.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      } catch (e) {
        console.error('Error fitting bounds:', e);
      }
    }
  }, [geometry, map]);
  
  return null;
}

// Component to fly to coordinates
function FlyToCoordinates({ coordinates }) {
  const map = useMap();
  
  useEffect(() => {
    if (coordinates && coordinates.length === 2) {
      map.flyTo(coordinates, 16, { duration: 1.5 });
    }
  }, [coordinates, map]);
  
  return null;
}

// Component to render municipality limits with zoom on click
function MunicipalityLimits({ limitesMunicipios, filterMunicipio, setFilterMunicipio }) {
  const map = useMap();
  
  if (!limitesMunicipios || !limitesMunicipios.features) return null;
  
  return (
    <>
      {limitesMunicipios.features.map((feature, idx) => {
        const isSelected = filterMunicipio === feature.properties?.municipio;
        const sinGdb = feature.properties?.sin_gdb;
        
        return (
          <GeoJSON
            key={`limite-${feature.properties?.municipio}-${idx}`}
            data={feature}
            style={() => ({
              color: isSelected ? '#10B981' : '#FFFFFF',
              weight: isSelected ? 4 : 2,
              opacity: 1,
              // Siempre tener un fill para poder hacer click
              fillColor: sinGdb ? '#6366F1' : (isSelected ? '#10B981' : '#FFFFFF'),
              fillOpacity: sinGdb ? 0.25 : (isSelected ? 0.15 : 0.05)
            })}
            onEachFeature={(feat, layer) => {
              const props = feat.properties;
              
              // Registrar evento click directamente en Leaflet
              layer.on('click', (e) => {
                if (!props?.sin_gdb) {
                  setFilterMunicipio(props?.municipio);
                  // Hacer zoom al municipio
                  const bounds = layer.getBounds();
                  if (bounds.isValid()) {
                    map.fitBounds(bounds, { padding: [50, 50] });
                  }
                }
              });
              
              layer.bindTooltip(props?.municipio || '', {
                permanent: true,
                direction: 'center',
                className: 'municipio-label'
              });
              const sinGdbMsg = props?.sin_gdb ? '<p class="text-xs text-amber-600 mt-1">⚠️ Sin base gráfica GDB</p>' : '';
              layer.bindPopup(`
                <div class="text-sm p-1">
                  <p class="font-bold text-base text-emerald-700 mb-1">${props?.municipio || 'Sin nombre'}</p>
                  <p class="text-xs text-slate-600">Total predios: <strong>${props?.total_predios?.toLocaleString() || 0}</strong></p>
                  <p class="text-xs text-slate-600">Rurales: <strong>${props?.rurales?.toLocaleString() || 0}</strong></p>
                  <p class="text-xs text-slate-600">Urbanos: <strong>${props?.urbanos?.toLocaleString() || 0}</strong></p>
                  ${sinGdbMsg}
                </div>
              `);
            }}
          />
        );
      })}
    </>
  );
}

export default function VisorPredios() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [searchCode, setSearchCode] = useState('');
  const [selectedPredio, setSelectedPredio] = useState(null);
  const [geometry, setGeometry] = useState(null);
  const [gdbStats, setGdbStats] = useState(null);
  const [mapType, setMapType] = useState('satellite'); // Esri Satélite por defecto (cambia a Google en zoom alto)
  const [showUploadGdb, setShowUploadGdb] = useState(false);
  const [uploadingGdb, setUploadingGdb] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null); // Estado del progreso de carga
  const [gdbAnalisis, setGdbAnalisis] = useState(null); // Resultado del análisis de GDB antes de cargar
  const [gdbArchivoPendiente, setGdbArchivoPendiente] = useState(null); // Archivo pendiente de confirmación
  const [filterMunicipio, setFilterMunicipio] = useState('');
  const [filterZona, setFilterZona] = useState('todos');
  const [allGeometries, setAllGeometries] = useState(null);
  const [limitesMunicipios, setLimitesMunicipios] = useState(null); // Límites de municipios
  const [mostrarPredios, setMostrarPredios] = useState(false); // Controlar si mostrar predios individuales
  const [loadingGeometries, setLoadingGeometries] = useState(false);
  const [gdbCargadaEsteMes, setGdbCargadaEsteMes] = useState(null); // null = no verificado, true/false
  const [mostrarPreguntaGdb, setMostrarPreguntaGdb] = useState(false);
  const [coordenadasBusqueda, setCoordenadasBusqueda] = useState({ lat: '', lng: '' });
  const [formatoCoordenadas, setFormatoCoordenadas] = useState('decimal'); // 'decimal' o 'dms'
  const [coordenadasDMS, setCoordenadasDMS] = useState({
    latGrados: '', latMinutos: '', latSegundos: '', latDireccion: 'N',
    lngGrados: '', lngMinutos: '', lngSegundos: '', lngDireccion: 'W'
  });
  const [marcadorCoordenadas, setMarcadorCoordenadas] = useState(null); // [lat, lng] del marcador
  const [resumenCargasMensuales, setResumenCargasMensuales] = useState(null); // Resumen de cargas GDB del mes
  const [construcciones, setConstrucciones] = useState(null); // Construcciones del predio seleccionado
  const [mostrarConstrucciones, setMostrarConstrucciones] = useState(false); // Toggle para mostrar/ocultar construcciones
  const [tieneConstrucciones, setTieneConstrucciones] = useState(false); // Si el predio tiene construcciones disponibles
  const [cargandoConstrucciones, setCargandoConstrucciones] = useState(false); // Estado de carga
  const [ortoimagenes, setOrtoimagenes] = useState([]); // Lista de ortoimágenes disponibles
  const [ortoimagenActiva, setOrtoimagenActiva] = useState(null); // Ortoimagen seleccionada para mostrar
  const [showUploadOrtoDialog, setShowUploadOrtoDialog] = useState(false); // Modal de subida de ortoimagen
  const [uploadingOrto, setUploadingOrto] = useState(false);
  const [ortoFormData, setOrtoFormData] = useState({ nombre: '', municipio: '', descripcion: '' });
  const [ortoFile, setOrtoFile] = useState(null);
  const [ortoUploadProgress, setOrtoUploadProgress] = useState(null);
  const ortoAbortControllerRef = useRef(null); // Ref para cancelar la subida
  const mapRef = useRef(null);

  // Default center: Norte de Santander, Colombia
  const defaultCenter = [8.0, -73.0];
  const defaultZoom = 9;

  // Función para convertir DMS a decimal
  const dmsToDecimal = (grados, minutos, segundos, direccion) => {
    const g = parseFloat(grados) || 0;
    const m = parseFloat(minutos) || 0;
    const s = parseFloat(segundos) || 0;
    let decimal = g + (m / 60) + (s / 3600);
    if (direccion === 'S' || direccion === 'W') {
      decimal = -decimal;
    }
    return decimal;
  };

  // Función para convertir decimal a DMS
  const decimalToDMS = (decimal, isLat) => {
    const abs = Math.abs(decimal);
    const grados = Math.floor(abs);
    const minutos = Math.floor((abs - grados) * 60);
    const segundos = ((abs - grados - minutos / 60) * 3600).toFixed(2);
    const direccion = isLat 
      ? (decimal >= 0 ? 'N' : 'S')
      : (decimal >= 0 ? 'E' : 'W');
    return { grados, minutos, segundos, direccion };
  };

  // Función para ir a coordenadas
  const irACoordenadas = () => {
    let lat, lng;
    
    if (formatoCoordenadas === 'decimal') {
      lat = parseFloat(coordenadasBusqueda.lat);
      lng = parseFloat(coordenadasBusqueda.lng);
      // Si la longitud es positiva, asumimos que el usuario olvidó el signo negativo (Colombia es Oeste)
      if (lng > 0 && lng > 60) {
        lng = -lng;
      }
    } else {
      lat = dmsToDecimal(
        coordenadasDMS.latGrados,
        coordenadasDMS.latMinutos,
        coordenadasDMS.latSegundos,
        'N' // Colombia siempre es Norte
      );
      // Para longitud en Colombia, siempre es Oeste (negativo)
      lng = -Math.abs(dmsToDecimal(
        coordenadasDMS.lngGrados,
        coordenadasDMS.lngMinutos,
        coordenadasDMS.lngSegundos,
        'E' // Usamos E para obtener positivo, luego negamos
      ));
    }
    
    // Validar coordenadas
    if (isNaN(lat) || isNaN(lng)) {
      toast.error('Por favor ingrese coordenadas válidas');
      return;
    }
    
    // Validar rango para Colombia
    if (lat < -5 || lat > 13) {
      toast.error('Latitud fuera de rango para Colombia (0° a 12°N)');
      return;
    }
    if (lng > -66 || lng < -82) {
      toast.error('Longitud fuera de rango para Colombia (-67° a -79°W)');
      return;
    }
    
    // Establecer marcador y hacer zoom
    setMarcadorCoordenadas([lat, lng]);
    
    // Mostrar coordenadas en ambos formatos
    const latDMS = decimalToDMS(lat, true);
    const lngDMS = decimalToDMS(Math.abs(lng), false);
    toast.success(
      `Ubicación: ${lat.toFixed(6)}°, ${lng.toFixed(6)}°\n` +
      `${latDMS.grados}°${latDMS.minutos}'${latDMS.segundos}"N, ${lngDMS.grados}°${lngDMS.minutos}'${lngDMS.segundos}"W`
    );
  };

  // Limpiar marcador de coordenadas
  const limpiarMarcadorCoordenadas = () => {
    setMarcadorCoordenadas(null);
    setCoordenadasBusqueda({ lat: '', lng: '' });
    setCoordenadasDMS({
      latGrados: '', latMinutos: '', latSegundos: '', latDireccion: 'N',
      lngGrados: '', lngMinutos: '', lngSegundos: '', lngDireccion: 'W'
    });
  };

  useEffect(() => {
    fetchGdbStats();
    fetchLimitesMunicipios('oficial'); // Siempre usar límites oficiales
    fetchOrtoimagenes(); // Cargar ortoimágenes disponibles
    // Verificar estado de cargas GDB del mes (solo para roles autorizados)
    if (user?.role === 'administrador' || user?.role === 'coordinador' || (user?.role === 'gestor' && user?.puede_actualizar_gdb)) {
      verificarCargasMensuales();
    }
  }, []);
  
  // Fetch ortoimágenes disponibles
  const fetchOrtoimagenes = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/ortoimagenes/disponibles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrtoimagenes(response.data.ortoimagenes || []);
    } catch (error) {
      console.error('Error cargando ortoimágenes:', error);
    }
  };

  // Cancelar subida de ortoimagen
  const cancelOrtoUpload = () => {
    if (ortoAbortControllerRef.current) {
      ortoAbortControllerRef.current.abort();
      ortoAbortControllerRef.current = null;
    }
    setUploadingOrto(false);
    setOrtoUploadProgress(null);
    setShowUploadOrtoDialog(false);
    setOrtoFile(null);
    setOrtoFormData({ nombre: '', municipio: '', descripcion: '' });
    toast.info('Subida cancelada');
  };

  // Subir nueva ortoimagen
  const handleUploadOrtoimagen = async () => {
    if (!ortoFile || !ortoFormData.nombre || !ortoFormData.municipio) {
      toast.error('Complete todos los campos requeridos');
      return;
    }

    // Crear AbortController para poder cancelar
    ortoAbortControllerRef.current = new AbortController();
    
    setUploadingOrto(true);
    setOrtoUploadProgress({ status: 'subiendo', progress: 0, message: 'Subiendo archivo...' });

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', ortoFile);
      formData.append('nombre', ortoFormData.nombre);
      formData.append('municipio', ortoFormData.municipio);
      formData.append('descripcion', ortoFormData.descripcion || '');

      const response = await axios.post(`${API}/ortoimagenes/subir`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        signal: ortoAbortControllerRef.current.signal,
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setOrtoUploadProgress({ 
            status: 'subiendo', 
            progress: percent, 
            message: `Subiendo: ${percent}%` 
          });
        }
      });

      const ortoId = response.data.id;
      toast.success('Archivo recibido. Procesando tiles...');
      setOrtoUploadProgress({ status: 'procesando', progress: 50, message: 'Generando tiles XYZ (puede tardar varios minutos)...' });

      // Polling para verificar progreso
      let checkCount = 0;
      const maxChecks = 360; // 30 minutos máximo
      const checkProgress = async () => {
        // Verificar si se canceló
        if (!ortoAbortControllerRef.current || ortoAbortControllerRef.current.signal.aborted) {
          return;
        }
        
        if (checkCount >= maxChecks) {
          setOrtoUploadProgress({ status: 'timeout', progress: 0, message: 'Tiempo de espera excedido. Verifique más tarde.' });
          return;
        }

        try {
          const progressRes = await axios.get(`${API}/ortoimagenes/progreso/${ortoId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });

          setOrtoUploadProgress(progressRes.data);

          if (progressRes.data.status === 'completado') {
            toast.success(`¡Ortoimagen "${ortoFormData.nombre}" lista!`);
            fetchOrtoimagenes();
            setShowUploadOrtoDialog(false);
            setOrtoFile(null);
            setOrtoFormData({ nombre: '', municipio: '', descripcion: '' });
            setOrtoUploadProgress(null);
            ortoAbortControllerRef.current = null;
          } else if (progressRes.data.status === 'error') {
            toast.error(`Error: ${progressRes.data.message}`);
            setOrtoUploadProgress(null);
            ortoAbortControllerRef.current = null;
          } else {
            checkCount++;
            setTimeout(checkProgress, 5000); // Check cada 5 segundos
          }
        } catch (err) {
          if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
            return; // Fue cancelado, no hacer nada
          }
          console.error('Error checking progress:', err);
          checkCount++;
          setTimeout(checkProgress, 5000);
        }
      };

      setTimeout(checkProgress, 3000);

    } catch (error) {
      // Si fue cancelado por el usuario, no mostrar error
      if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
        return;
      }
      toast.error(error.response?.data?.detail || 'Error al subir ortoimagen');
      setOrtoUploadProgress(null);
      ortoAbortControllerRef.current = null;
    } finally {
      setUploadingOrto(false);
    }
  };

  // Eliminar ortoimagen
  const handleDeleteOrtoimagen = async (ortoId, ortoNombre) => {
    if (!window.confirm(`¿Está seguro de eliminar la ortoimagen "${ortoNombre}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/ortoimagenes/${ortoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Ortoimagen eliminada');
      if (ortoimagenActiva?.id === ortoId) {
        setOrtoimagenActiva(null);
      }
      fetchOrtoimagenes();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar ortoimagen');
    }
  };

  // Cargar geometrías cuando cambian los filtros Y el usuario quiere ver predios
  useEffect(() => {
    if (filterMunicipio && mostrarPredios) {
      setAllGeometries(null);
      fetchAllGeometries();
    } else if (!mostrarPredios) {
      setAllGeometries(null);
    }
  }, [filterMunicipio, filterZona, mostrarPredios]);

  const fetchLimitesMunicipios = async (fuente = 'oficial') => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/gdb/limites-municipios?fuente=${fuente}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLimitesMunicipios(response.data);
    } catch (error) {
      console.error('Error loading municipality limits:', error);
    }
  };

  const fetchAllGeometries = async () => {
    setLoadingGeometries(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      params.append('municipio', filterMunicipio);
      if (filterZona && filterZona !== 'todos') params.append('zona', filterZona);
      params.append('limit', '10000'); // Aumentar límite para ver todas las geometrías
      
      const response = await axios.get(`${API}/gdb/geometrias?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllGeometries(response.data);
      const zonaText = filterZona === 'todos' ? 'todas las zonas' : filterZona;
      toast.success(`${response.data.total} predios de Base Gráfica (${zonaText}) cargados`);
    } catch (error) {
      console.error('Error loading geometries:', error);
      toast.error(error.response?.data?.detail || 'Error al cargar Base Gráfica');
      setAllGeometries(null);
    } finally {
      setLoadingGeometries(false);
    }
  };

  const fetchGdbStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/gdb/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGdbStats(response.data);
    } catch (error) {
      console.error('Error loading GDB stats:', error);
    }
  };

  // Verificar estado de cargas GDB del mes
  const verificarCargasMensuales = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/gdb/verificar-carga-mes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = response.data;
      
      // Si hay municipios pendientes, mostrar la pregunta
      if (data.total_pendientes > 0) {
        setGdbCargadaEsteMes(null); // Mostrar pregunta
      } else {
        setGdbCargadaEsteMes(true); // Todos cargados
      }
      
      // Guardar info adicional para mostrar en UI
      setResumenCargasMensuales(data);
    } catch (error) {
      console.error('Error verificando cargas mensuales:', error);
    }
  };

  const searchPredio = async () => {
    if (!searchCode.trim()) {
      toast.error('Ingrese un código predial para buscar');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // First search in database
      const predioResponse = await axios.get(`${API}/predios?search=${searchCode}&limit=1`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (predioResponse.data.predios.length === 0) {
        toast.error('Predio no encontrado en la base de datos');
        setLoading(false);
        return;
      }
      
      const predio = predioResponse.data.predios[0];
      setSelectedPredio(predio);
      
      // Get geometry
      const authToken = localStorage.getItem('token');
      const geoResponse = await axios.get(`${API}/predios/codigo/${predio.codigo_predial_nacional}/geometria`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      setGeometry(geoResponse.data);
      
      // Verificar si el predio tiene construcciones (sin cargarlas)
      try {
        const codigoParaBuscar = predio.codigo_gdb || predio.codigo_predial_nacional;
        console.log('Buscando construcciones para:', codigoParaBuscar);
        
        const constResponse = await axios.get(`${API}/gdb/construcciones/${codigoParaBuscar}`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        
        console.log('Respuesta construcciones:', constResponse.data);
        
        if (constResponse.data && constResponse.data.construcciones && constResponse.data.construcciones.length > 0) {
          console.log('Construcciones encontradas:', constResponse.data.construcciones.length);
          setTieneConstrucciones(true);
          // NO cargar automáticamente - el usuario debe activar el toggle
          setConstrucciones(null);
          setMostrarConstrucciones(false);
        } else {
          console.log('No hay construcciones');
          setTieneConstrucciones(false);
          setConstrucciones(null);
        }
      } catch (constError) {
        console.error('Error verificando construcciones:', constError);
        setTieneConstrucciones(false);
        setConstrucciones(null);
      }
      
      toast.success('Predio encontrado');
    } catch (error) {
      if (error.response?.status === 404) {
        toast.warning('Predio encontrado pero sin Base Gráfica disponible');
      } else {
        toast.error('Error al buscar el predio');
      }
      setGeometry(null);
      setConstrucciones(null);
      setTieneConstrucciones(false);
      setMostrarConstrucciones(false);
    } finally {
      setLoading(false);
    }
  };

  // Función para cargar/ocultar construcciones
  const toggleConstrucciones = async () => {
    if (mostrarConstrucciones) {
      // Ocultar
      setMostrarConstrucciones(false);
      setConstrucciones(null);
      return;
    }
    
    // Cargar y mostrar
    if (!selectedPredio) return;
    
    setCargandoConstrucciones(true);
    try {
      const authToken = localStorage.getItem('token');
      const constResponse = await axios.get(`${API}/gdb/construcciones/${selectedPredio.codigo_gdb || selectedPredio.codigo_predial_nacional}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (constResponse.data.construcciones?.length > 0) {
        setConstrucciones(constResponse.data.construcciones);
        setMostrarConstrucciones(true);
        toast.success(`${constResponse.data.construcciones.length} construcciones cargadas`);
      } else {
        toast.info('No hay construcciones disponibles para este predio');
      }
    } catch (error) {
      console.error('Error loading constructions:', error);
      toast.error('Error al cargar construcciones');
    } finally {
      setCargandoConstrucciones(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value || 0);
  };

  const formatArea = (area) => {
    if (!area) return '0 m²';
    const areaNum = parseFloat(area);
    if (isNaN(areaNum)) return '0 m²';
    if (areaNum >= 10000) {
      const ha = Math.floor(areaNum / 10000);
      const m2 = Math.floor(areaNum % 10000);
      return `${ha} ha ${m2} m²`;
    }
    return `${areaNum.toFixed(2)} m²`;
  };

  // Estilo de polígonos de TERRENO - Cyan/Blanco para visibilidad en satélite
  const geoJSONStyle = {
    color: '#00FFFF', // Cyan brillante para el borde
    weight: 3,
    opacity: 1,
    fillColor: '#FFFFFF', // Blanco para el relleno
    fillOpacity: 0.25
  };

  // Estilo de polígonos de CONSTRUCCIONES - Rojo semitransparente
  const construccionStyle = {
    color: '#FF0000', // Rojo para el borde
    weight: 2,
    opacity: 1,
    fillColor: '#FF0000', // Rojo para el relleno
    fillOpacity: 0.35
  };

  const tileLayers = {
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; Esri',
      maxZoom: 20,
      maxNativeZoom: 17  // Esri óptimo hasta 17, después cambia a Google
    },
    google_satellite: {
      url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      attribution: '&copy; Google',
      maxZoom: 20,
      maxNativeZoom: 20
    },
    hybrid: {
      url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      attribution: '&copy; Google',
      maxZoom: 20
    },
    street: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    },
    topographic: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; Esri, HERE, Garmin',
      maxZoom: 18
    }
  };

  // Función para subir nueva base GDB (ZIP o carpeta)
  const handleUploadGdb = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploadingGdb(true);
    setUploadProgress({ status: 'analizando', progress: 0, message: 'Preparando archivos...' });
    
    // Verificar si es un archivo ZIP (único que se puede analizar)
    const isZipFile = files.length === 1 && files[0].name.endsWith('.zip');
    
    if (isZipFile) {
      // Si es ZIP, primero analizar
      const formData = new FormData();
      formData.append('file', files[0]);
      
      try {
        const token = localStorage.getItem('token');
        
        setUploadProgress({ status: 'analizando', progress: 10, message: 'Validando estructura de capas...' });
        
        const analisisResponse = await axios.post(`${API}/gdb/analizar`, formData, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
        
        const analisis = analisisResponse.data;
        
        // SIEMPRE mostrar el reporte de análisis antes de cargar
        setGdbAnalisis(analisis);
        setGdbArchivoPendiente(files);
        setUploadProgress(null);
        setUploadingGdb(false);
        return; // Esperar confirmación del usuario
        
      } catch (error) {
        console.error('Error al analizar GDB:', error);
        let errorMessage = 'Error desconocido';
        if (error.response?.data?.detail) {
          errorMessage = typeof error.response.data.detail === 'string' 
            ? error.response.data.detail 
            : JSON.stringify(error.response.data.detail);
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        const continuar = window.confirm(
          `No se pudo validar la estructura de la GDB.\n\nError: ${errorMessage}\n\n¿Desea continuar con la carga de todos modos?`
        );
        
        if (continuar) {
          await procederConCargaGdb(files);
        } else {
          setUploadProgress(null);
          setUploadingGdb(false);
        }
      }
    } else {
      // Si no es ZIP, mostrar error
      toast.error('Solo se aceptan archivos .ZIP que contengan la carpeta .gdb');
      setUploadProgress(null);
      setUploadingGdb(false);
    }
  };
  
  // Función para proceder con la carga después de validación
  const procederConCargaGdb = async (files) => {
    setUploadingGdb(true);
    setGdbAnalisis(null);
    setGdbArchivoPendiente(null);
    setUploadProgress({ status: 'subiendo', progress: 5, message: 'Subiendo archivos al servidor...' });
    
    const formData = new FormData();
    
    // Si es un solo archivo ZIP
    if (files.length === 1 && files[0].name.endsWith('.zip')) {
      formData.append('files', files[0]);
    } else {
      // Si son múltiples archivos (carpeta .gdb)
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }
    }
    
    try {
      const token = localStorage.getItem('token');
      
      const response = await axios.post(`${API}/gdb/upload`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 10) / progressEvent.total);
          setUploadProgress({ 
            status: 'subiendo', 
            progress: percentCompleted, 
            message: `Subiendo archivos: ${Math.round(progressEvent.loaded / 1024)}KB` 
          });
        }
      });
      
      // Si hay upload_id, consultar progreso periódicamente
      if (response.data.upload_id) {
        let checkCount = 0;
        const maxChecks = 120; // 2 minutos máximo
        
        const checkProgress = async () => {
          if (checkCount >= maxChecks) {
            setUploadProgress(null);
            return;
          }
          
          try {
            const progressRes = await axios.get(`${API}/gdb/upload-progress/${response.data.upload_id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            setUploadProgress(progressRes.data);
            
            if (progressRes.data.status !== 'completado' && progressRes.data.status !== 'error') {
              checkCount++;
              setTimeout(checkProgress, 1000);
            } else if (progressRes.data.status === 'completado') {
              // Obtener datos de calidad de la respuesta original
              const calidad = response.data.calidad;
              const construcciones = response.data.construcciones;
              
              if (calidad) {
                // Mostrar resumen de calidad
                const calidadPct = calidad.porcentaje || 100;
                let calidadMsg = `Calidad: ${calidadPct}%`;
                
                if (calidadPct >= 95) {
                  toast.success(`✅ ¡Excelente! ${response.data.predios_relacionados} predios vinculados. ${calidadMsg}`);
                } else if (calidadPct >= 80) {
                  toast.success(`✓ Carga exitosa. ${response.data.predios_relacionados} predios vinculados. ${calidadMsg}`, { duration: 5000 });
                } else if (calidadPct >= 60) {
                  toast.warning(`⚠️ Carga con observaciones. ${calidadMsg}. Códigos inválidos: ${calidad.codigos_invalidos}, Rechazadas: ${calidad.geometrias_rechazadas}`, { duration: 8000 });
                } else {
                  toast.error(`❌ Problemas de calidad. ${calidadMsg}. Se generó reporte PDF para revisión.`, { duration: 10000 });
                }
                
                // Si hay reporte PDF, mostrar notificación con enlace de descarga
                if (calidad.reporte_pdf) {
                  toast.info(
                    <div className="flex flex-col gap-1">
                      <span>📄 Reporte de calidad disponible</span>
                      <button 
                        onClick={async () => {
                          try {
                            const authToken = localStorage.getItem('token');
                            const response = await fetch(`${API}/gdb/reportes-calidad/${calidad.reporte_pdf}`, {
                              headers: { 'Authorization': `Bearer ${authToken}` }
                            });
                            if (!response.ok) throw new Error('Error al descargar');
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = calidad.reporte_pdf;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            window.URL.revokeObjectURL(url);
                            toast.success('PDF descargado');
                          } catch (err) {
                            toast.error('Error al descargar el reporte');
                          }
                        }}
                        className="text-blue-600 underline text-sm hover:text-blue-800"
                      >
                        Descargar PDF
                      </button>
                    </div>,
                    { duration: 10000 }
                  );
                }
              } else {
                toast.success(`¡Completado! ${response.data.predios_relacionados} predios relacionados de ${response.data.total_geometrias_gdb} geometrías GDB`);
              }
              
              fetchGdbStats();
              verificarCargasMensuales(); // Actualizar estado de cargas mensuales
              setShowUploadGdb(false);
              setMostrarPreguntaGdb(false);
              setGdbCargadaEsteMes(true);
              setTimeout(() => setUploadProgress(null), 3000);
            }
          } catch (err) {
            console.error('Error checking progress:', err);
          }
        };
        
        // Comenzar a verificar progreso después de 1 segundo
        setTimeout(checkProgress, 1000);
      } else {
        // Sin upload_id, mostrar resultado directo
        const calidad = response.data.calidad;
        if (calidad && calidad.porcentaje < 80) {
          toast.warning(`⚠️ Carga con observaciones. Calidad: ${calidad.porcentaje}%. Revisar reporte PDF.`);
        } else {
          toast.success(`Base gráfica de ${response.data.municipio || 'municipio'} actualizada. ${response.data.total_geometrias_gdb || response.data.total_geometrias} geometrías, ${response.data.predios_relacionados} predios relacionados.`);
        }
        fetchGdbStats();
        verificarCargasMensuales(); // Actualizar estado de cargas mensuales
        setShowUploadGdb(false);
        setMostrarPreguntaGdb(false);
        setGdbCargadaEsteMes(true);
        setUploadProgress(null);
      }
      
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al subir la base gráfica');
      setUploadProgress({ status: 'error', progress: 0, message: error.response?.data?.detail || 'Error al procesar' });
      setTimeout(() => setUploadProgress(null), 5000);
    } finally {
      setUploadingGdb(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Diálogo de Análisis de GDB - z-index alto para estar sobre el mapa */}
      <Dialog open={gdbAnalisis !== null} onOpenChange={(open) => !open && setGdbAnalisis(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto z-[9999]" style={{ zIndex: 9999 }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <FileText className="w-5 h-5" />
              Reporte de Validación de GDB
            </DialogTitle>
            <DialogDescription>
              Revise la estructura de la GDB antes de proceder con la carga.
            </DialogDescription>
          </DialogHeader>
          
          {gdbAnalisis && (
            <div className="space-y-4">
              {/* Todas las capas encontradas */}
              {gdbAnalisis.capas_encontradas && (
                <div className="border border-slate-200 bg-slate-50 rounded-lg p-3">
                  <h4 className="font-medium text-slate-700 mb-2">
                    📁 Capas encontradas en el archivo ({gdbAnalisis.capas_encontradas.length})
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {gdbAnalisis.capas_encontradas.map((capa, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {capa.nombre}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Capas Reconocidas */}
              {(gdbAnalisis.analisis?.reconocidas?.length > 0 || gdbAnalisis.capas_analisis?.reconocidas?.length > 0) && (
                <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-3">
                  <h4 className="font-medium text-emerald-800 flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4" />
                    Capas Estándar Reconocidas ({(gdbAnalisis.analisis?.reconocidas || gdbAnalisis.capas_analisis?.reconocidas || []).length})
                  </h4>
                  <ul className="text-sm text-emerald-700 space-y-1">
                    {(gdbAnalisis.analisis?.reconocidas || gdbAnalisis.capas_analisis?.reconocidas || []).map((capa, idx) => (
                      <li key={idx}>✓ {capa.tipo}: <strong>{capa.capa_encontrada}</strong></li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Capas No Reconocidas */}
              {((gdbAnalisis.analisis?.no_reconocidas?.length > 0) || (gdbAnalisis.capas_analisis?.no_reconocidas?.length > 0)) && (
                <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
                  <h4 className="font-medium text-amber-800 flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    Capas No Estándar ({(gdbAnalisis.analisis?.no_reconocidas || gdbAnalisis.capas_analisis?.no_reconocidas || []).length})
                  </h4>
                  <p className="text-xs text-amber-600 mb-2">
                    Estas capas no siguen la nomenclatura estándar y podrían no ser procesadas correctamente:
                  </p>
                  <ul className="text-sm text-amber-700 space-y-2">
                    {(gdbAnalisis.analisis?.no_reconocidas || gdbAnalisis.capas_analisis?.no_reconocidas || []).map((capa, idx) => (
                      <li key={idx} className="bg-white p-2 rounded border border-amber-200">
                        <div className="font-medium">"{capa.capa}"</div>
                        <div className="text-xs text-slate-600">
                          Tipo detectado: {capa.tipo_detectado}
                        </div>
                        <div className="text-xs text-amber-600 font-medium">
                          💡 {capa.sugerencia}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Errores de Códigos Prediales */}
              {(gdbAnalisis.validacion_codigos?.codigos_con_error?.length > 0 || gdbAnalisis.codigos_con_error?.length > 0) && (
                <div className="border border-red-200 bg-red-50 rounded-lg p-3">
                  <h4 className="font-medium text-red-800 flex items-center gap-2 mb-2">
                    <XCircle className="w-4 h-4" />
                    Errores en Códigos Prediales ({(gdbAnalisis.validacion_codigos?.total_errores || gdbAnalisis.codigos_con_error?.length || 0)})
                  </h4>
                  <p className="text-xs text-red-600 mb-2">
                    Estos códigos no cumplen con el formato esperado (30 dígitos):
                  </p>
                  <div className="max-h-32 overflow-y-auto bg-white rounded p-2 border border-red-200">
                    <ul className="text-xs text-red-700 space-y-1 font-mono">
                      {(gdbAnalisis.validacion_codigos?.codigos_con_error || gdbAnalisis.codigos_con_error || []).slice(0, 20).map((codigo, idx) => (
                        <li key={idx}>• {codigo}</li>
                      ))}
                      {(gdbAnalisis.validacion_codigos?.total_errores || gdbAnalisis.codigos_con_error?.length || 0) > 20 && (
                        <li className="text-slate-500">... y {(gdbAnalisis.validacion_codigos?.total_errores || gdbAnalisis.codigos_con_error?.length) - 20} más</li>
                      )}
                    </ul>
                  </div>
                </div>
              )}
              
              {/* Mensaje de Error si no puede procesar */}
              {gdbAnalisis.mensaje_error && (
                <div className="border-2 border-red-500 bg-red-100 rounded-lg p-4">
                  <h4 className="font-bold text-red-800 flex items-center gap-2 mb-2">
                    <XCircle className="w-5 h-5" />
                    NO SE PUEDE PROCESAR
                  </h4>
                  <p className="text-red-700 text-sm">{gdbAnalisis.mensaje_error}</p>
                  {gdbAnalisis.capas_faltantes?.length > 0 && (
                    <p className="text-red-600 text-xs mt-2">
                      Capas faltantes: <strong>{gdbAnalisis.capas_faltantes.join(', ')}</strong>
                    </p>
                  )}
                </div>
              )}
              
              {/* Recomendaciones */}
              {gdbAnalisis.analisis?.recomendaciones?.length > 0 && (
                <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
                  <h4 className="font-medium text-amber-800 mb-2">📋 Recomendaciones</h4>
                  <ul className="text-sm text-amber-700 space-y-1">
                    {gdbAnalisis.analisis.recomendaciones.map((rec, idx) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Estadísticas */}
              {(gdbAnalisis.validacion_codigos?.codigos_validos !== undefined || gdbAnalisis.codigos_validos !== undefined) && (
                <div className="border border-slate-200 bg-slate-50 rounded-lg p-3">
                  <h4 className="font-medium text-slate-700 mb-2">Resumen de Validación</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-emerald-700">Códigos válidos: <strong>{gdbAnalisis.validacion_codigos?.codigos_validos ?? gdbAnalisis.codigos_validos ?? 0}</strong></div>
                    <div className="text-red-700">Códigos con error: <strong>{gdbAnalisis.validacion_codigos?.total_errores ?? gdbAnalisis.codigos_con_error?.length ?? 0}</strong></div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="flex gap-2 mt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setGdbAnalisis(null);
                setGdbArchivoPendiente(null);
              }}
            >
              Cancelar
            </Button>
            <Button 
              className={gdbAnalisis?.puede_procesar === false 
                ? "bg-slate-400 cursor-not-allowed" 
                : "bg-emerald-600 hover:bg-emerald-700"}
              disabled={gdbAnalisis?.puede_procesar === false}
              onClick={() => {
                if (gdbArchivoPendiente && gdbAnalisis?.puede_procesar !== false) {
                  procederConCargaGdb(gdbArchivoPendiente);
                }
              }}
            >
              {gdbAnalisis?.puede_procesar === false ? 'No cumple estándar' : 'Proceder con la Carga'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Subida de Ortoimagen */}
      <Dialog open={showUploadOrtoDialog} onOpenChange={(open) => {
        if (!open) {
          // Si está subiendo, cancelar la subida
          if (uploadingOrto || ortoUploadProgress) {
            cancelOrtoUpload();
          } else {
            setShowUploadOrtoDialog(false);
            setOrtoFile(null);
            setOrtoFormData({ nombre: '', municipio: '', descripcion: '' });
          }
        }
      }}>
        <DialogContent className="max-w-lg z-[9999]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-700">
              <Image className="w-5 h-5" />
              Subir Ortoimagen
            </DialogTitle>
            <DialogDescription>
              Suba un archivo GeoTIFF georeferenciado. Se generarán tiles XYZ automáticamente.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Nombre */}
            <div className="space-y-2">
              <Label htmlFor="orto-nombre">Nombre de la ortoimagen *</Label>
              <Input
                id="orto-nombre"
                placeholder="Ej: Ortoimagen Centro Urbano"
                value={ortoFormData.nombre}
                onChange={(e) => setOrtoFormData(prev => ({ ...prev, nombre: e.target.value }))}
                disabled={uploadingOrto || ortoUploadProgress}
              />
            </div>
            
            {/* Municipio */}
            <div className="space-y-2">
              <Label htmlFor="orto-municipio">Municipio *</Label>
              <Input
                id="orto-municipio"
                placeholder="Ej: Ocaña"
                value={ortoFormData.municipio}
                onChange={(e) => setOrtoFormData(prev => ({ ...prev, municipio: e.target.value }))}
                disabled={uploadingOrto || ortoUploadProgress}
              />
            </div>
            
            {/* Descripción */}
            <div className="space-y-2">
              <Label htmlFor="orto-descripcion">Descripción (opcional)</Label>
              <Input
                id="orto-descripcion"
                placeholder="Ej: Captura de Marzo 2024, resolución 15cm"
                value={ortoFormData.descripcion}
                onChange={(e) => setOrtoFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                disabled={uploadingOrto || ortoUploadProgress}
              />
            </div>
            
            {/* Archivo */}
            <div className="space-y-2">
              <Label>Archivo GeoTIFF *</Label>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center">
                {ortoFile ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700">{ortoFile.name}</p>
                    <p className="text-xs text-slate-500">{(ortoFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                    {!uploadingOrto && !ortoUploadProgress && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOrtoFile(null)}
                      >
                        Cambiar archivo
                      </Button>
                    )}
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <div className="space-y-2">
                      <Upload className="w-8 h-8 mx-auto text-slate-400" />
                      <p className="text-sm text-slate-500">
                        Seleccione un archivo GeoTIFF (.tif, .tiff)
                      </p>
                      <p className="text-xs text-slate-400">
                        Archivos grandes pueden tardar varios minutos en procesar
                      </p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept=".tif,.tiff,.geotiff"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setOrtoFile(file);
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
            
            {/* Progreso */}
            {ortoUploadProgress && (
              <div className="border rounded-lg p-3 bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">
                    {ortoUploadProgress.status === 'subiendo' && '📤 Subiendo...'}
                    {ortoUploadProgress.status === 'procesando' && '⚙️ Procesando tiles...'}
                    {ortoUploadProgress.status === 'verificando' && '✅ Verificando...'}
                    {ortoUploadProgress.status === 'completado' && '✅ ¡Completado!'}
                    {ortoUploadProgress.status === 'error' && '❌ Error'}
                  </span>
                  <span className="text-sm text-slate-500">{ortoUploadProgress.progress}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${
                      ortoUploadProgress.status === 'error' ? 'bg-red-500' : 
                      ortoUploadProgress.status === 'completado' ? 'bg-emerald-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${ortoUploadProgress.progress}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">{ortoUploadProgress.message}</p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                if (uploadingOrto || ortoUploadProgress) {
                  cancelOrtoUpload();
                } else {
                  setShowUploadOrtoDialog(false);
                  setOrtoFile(null);
                  setOrtoFormData({ nombre: '', municipio: '', descripcion: '' });
                }
              }}
            >
              {ortoUploadProgress?.status === 'completado' ? 'Cerrar' : 'Cancelar'}
            </Button>
            {!ortoUploadProgress && (
              <Button 
                className="bg-blue-600 hover:bg-blue-700"
                onClick={handleUploadOrtoimagen}
                disabled={uploadingOrto || !ortoFile || !ortoFormData.nombre || !ortoFormData.municipio}
              >
                {uploadingOrto ? 'Subiendo...' : 'Subir Ortoimagen'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Map className="w-8 h-8 text-emerald-700" />
          <div>
            <h1 className="text-2xl font-bold font-outfit text-slate-800">
              Visor de Predios
            </h1>
            <p className="text-sm text-slate-500">
              Visualización geográfica de predios catastrales
            </p>
          </div>
        </div>
        
        {gdbStats && (
          <div className="flex items-center gap-4 text-sm">
            <Badge variant="outline" className="bg-emerald-50">
              <Layers className="w-3 h-3 mr-1" />
              {gdbStats.total_geometrias?.toLocaleString()} predios en Base Gráfica
            </Badge>
            <Badge variant="secondary">
              Rural: {gdbStats.predios_rurales?.toLocaleString()}
            </Badge>
            <Badge variant="secondary">
              Urbano: {gdbStats.predios_urbanos?.toLocaleString()}
            </Badge>
          </div>
        )}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Panel Izquierdo - Búsqueda y Detalle con scroll */}
        <div className="col-span-4 space-y-4 max-h-[calc(100vh-180px)] overflow-y-auto pr-2">
          {/* Filtros de Municipio y Zona */}
          <Card className="border-emerald-200">
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-700" /> Filtrar Base Gráfica
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Municipio</label>
                <Select 
                  value={filterMunicipio || "none"} 
                  onValueChange={(v) => {
                    const newValue = v === "none" ? "" : v;
                    setFilterMunicipio(newValue);
                    // Si se limpia el filtro, también ocultar predios y limpiar selección
                    if (!newValue) {
                      setMostrarPredios(false);
                      setSelectedPredio(null);
                      setGeometry(null);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione municipio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin filtro</SelectItem>
                    {gdbStats?.municipios && Object.keys(gdbStats.municipios).sort((a, b) => a.localeCompare(b, 'es')).map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Zona</label>
                <Select value={filterZona} onValueChange={setFilterZona} disabled={!filterMunicipio || !mostrarPredios}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las zonas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas las zonas</SelectItem>
                    <SelectItem value="urbano">Solo Urbano ({gdbStats?.municipios?.[filterMunicipio]?.urbanos || 0})</SelectItem>
                    <SelectItem value="rural">Solo Rural ({gdbStats?.municipios?.[filterMunicipio]?.rurales || 0})</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Botón para mostrar/ocultar predios */}
              {filterMunicipio && (
                <Button
                  variant={mostrarPredios ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMostrarPredios(!mostrarPredios)}
                  className={mostrarPredios ? "bg-emerald-600 hover:bg-emerald-700" : "border-emerald-500 text-emerald-700"}
                  disabled={loadingGeometries}
                >
                  {loadingGeometries ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Cargando...
                    </>
                  ) : mostrarPredios ? (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      Ocultar Predios
                    </>
                  ) : (
                    <>
                      <Map className="w-4 h-4 mr-2" />
                      Ver Predios
                    </>
                  )}
                </Button>
              )}
              {allGeometries && mostrarPredios && (
                <Badge className="bg-emerald-100 text-emerald-800">
                  {allGeometries.total} predios visibles
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* Búsqueda */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="w-4 h-4" /> Buscar Predio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Código predial o matrícula..."
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchPredio()}
                />
                <Button 
                  onClick={searchPredio} 
                  disabled={loading}
                  className="bg-emerald-700 hover:bg-emerald-800"
                >
                  <Search className="w-4 h-4" />
                </Button>
              </div>
              
              <Select value={mapType} onValueChange={(v) => { setMapType(v); setOrtoimagenActiva(null); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de mapa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="satellite">Satélite Esri (Auto-Google en zoom alto)</SelectItem>
                  <SelectItem value="hybrid">Satélite + Etiquetas (Google)</SelectItem>
                  <SelectItem value="street">OpenStreetMap</SelectItem>
                  <SelectItem value="topographic">Topográfico Esri</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Detalle del Predio Seleccionado - Aparece justo después de la búsqueda */}
          {selectedPredio && (
            <Card className="border-emerald-300 shadow-md">
              <CardHeader className="py-3 bg-emerald-100">
                <CardTitle className="text-sm flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-700" />
                    <span className="text-emerald-800 font-semibold">Predio Seleccionado</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-xs text-slate-500"
                    onClick={() => { setSelectedPredio(null); setGeometry(null); }}
                  >
                    ✕ Cerrar
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-3 text-sm max-h-[60vh] overflow-y-auto">
                {/* Código Predial */}
                <div className="bg-slate-50 p-2 rounded">
                  <p className="text-xs text-slate-500">Código Predial Nacional</p>
                  <p className="font-mono text-xs font-medium text-slate-800">{selectedPredio.codigo_predial_nacional}</p>
                </div>

                {/* TOGGLE CONSTRUCCIONES - Muy visible al inicio */}
                {tieneConstrucciones && (
                  <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building className="w-5 h-5 text-red-600" />
                        <span className="font-semibold text-red-800">Construcciones</span>
                      </div>
                      <Button
                        variant={mostrarConstrucciones ? "default" : "outline"}
                        size="sm"
                        className={`${mostrarConstrucciones ? 'bg-red-600 hover:bg-red-700 text-white' : 'border-red-400 text-red-600 hover:bg-red-100'}`}
                        onClick={toggleConstrucciones}
                        disabled={cargandoConstrucciones}
                        data-testid="toggle-construcciones-btn"
                      >
                        {cargandoConstrucciones ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-1" />
                        ) : mostrarConstrucciones ? (
                          <Eye className="w-4 h-4 mr-1" />
                        ) : (
                          <EyeOff className="w-4 h-4 mr-1" />
                        )}
                        {mostrarConstrucciones ? 'Ocultar en mapa' : 'Ver en mapa'}
                      </Button>
                    </div>
                    
                    {/* Lista de construcciones si están visibles */}
                    {mostrarConstrucciones && construcciones && construcciones.length > 0 && (
                      <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                        {construcciones.map((const_item, idx) => (
                          <div key={idx} className="bg-white rounded p-2 text-xs flex justify-between items-center">
                            <span className="text-red-800">🏠 Construcción {idx + 1}</span>
                            <span className="text-red-600 font-medium">{formatArea(const_item.area_m2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Municipio y Zona */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-slate-500">Municipio</p>
                    <p className="font-medium">{selectedPredio.municipio}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Zona</p>
                    <p className="font-medium">{getZonaFromCodigo(selectedPredio.codigo_predial_nacional || selectedPredio.codigo_homologado).texto}</p>
                  </div>
                </div>

                {/* Propietario */}
                <div className="border-t pt-2">
                  <p className="text-xs text-slate-500 flex items-center gap-1"><User className="w-3 h-3" /> Propietario</p>
                  {selectedPredio.propietarios?.length > 0 ? (
                    selectedPredio.propietarios.map((p, idx) => (
                      <p key={idx} className="font-medium">{p.nombre_propietario}</p>
                    ))
                  ) : (
                    <p className="font-medium">{selectedPredio.nombre_propietario || 'No registrado'}</p>
                  )}
                </div>

                {/* Matrícula Inmobiliaria - SIEMPRE mostrar */}
                <div className="border-t pt-2">
                  <p className="text-xs text-slate-500 flex items-center gap-1"><FileText className="w-3 h-3" /> Matrícula Inmobiliaria</p>
                  <p className="font-mono font-medium text-slate-800">
                    {selectedPredio.r2_registros?.[0]?.matricula_inmobiliaria || selectedPredio.matricula_inmobiliaria || 'Sin información'}
                  </p>
                </div>

                {/* ÁREAS: R1/R2 vs GDB */}
                <div className="border-t pt-2">
                  <p className="text-xs text-slate-500 flex items-center gap-1 mb-2"><Building className="w-3 h-3" /> Áreas del Predio</p>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Columna R1/R2 */}
                    <div className="bg-blue-50 p-2 rounded border border-blue-200">
                      <p className="text-xs font-semibold text-blue-700 mb-1">📋 R1/R2</p>
                      <div className="space-y-1">
                        <div>
                          <p className="text-[10px] text-blue-600">Área Terreno</p>
                          <p className="font-bold text-blue-800">{formatArea(selectedPredio.area_terreno)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-blue-600">Área Construida</p>
                          <p className="font-medium text-blue-700">{formatArea(selectedPredio.area_construida)}</p>
                        </div>
                      </div>
                    </div>
                    {/* Columna GDB */}
                    <div className={`p-2 rounded border ${geometry ? 'bg-amber-50 border-amber-200' : 'bg-slate-100 border-slate-200'}`}>
                      <p className={`text-xs font-semibold mb-1 ${geometry ? 'text-amber-700' : 'text-slate-500'}`}>🗺️ GDB</p>
                      {geometry ? (
                        <div className="space-y-1">
                          <div>
                            <p className="text-[10px] text-amber-600">Área GDB</p>
                            <p className="font-bold text-amber-800">{formatArea(geometry.properties?.area_m2 || selectedPredio.area_gdb)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-emerald-600">Estado</p>
                            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700">✓ Con geometría</Badge>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-[10px] text-slate-500">Área GDB</p>
                          <p className="text-xs text-slate-400">Sin geometría</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Avalúo */}
                <div className="border-t pt-2">
                  <p className="text-xs text-slate-500 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Avalúo Catastral</p>
                  <p className="text-lg font-bold text-emerald-700">{formatCurrency(selectedPredio.avaluo)}</p>
                </div>

                {/* Botón Certificado */}
                {['coordinador', 'administrador', 'atencion_usuario'].includes(user?.role) && (
                  <Button
                    className="w-full bg-emerald-700 hover:bg-emerald-800"
                    size="sm"
                    onClick={async () => {
                      try {
                        const token = localStorage.getItem('token');
                        const response = await fetch(`${API}/predios/${selectedPredio.id}/certificado`, {
                          headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (!response.ok) throw new Error('Error');
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `Certificado_${selectedPredio.codigo_predial_nacional}.pdf`;
                        a.click();
                        toast.success('Certificado generado');
                      } catch (e) {
                        toast.error('Error al generar certificado');
                      }
                    }}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Generar Certificado
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Búsqueda por Coordenadas */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm flex items-center gap-2 text-blue-800">
                <Crosshair className="w-4 h-4" /> Ir a Coordenadas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-3 pb-3">
              {/* Selector de formato */}
              <div className="flex gap-1">
                <Button
                  variant={formatoCoordenadas === 'decimal' ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs flex-1"
                  onClick={() => setFormatoCoordenadas('decimal')}
                >
                  Decimales
                </Button>
                <Button
                  variant={formatoCoordenadas === 'dms' ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs flex-1"
                  onClick={() => setFormatoCoordenadas('dms')}
                >
                  GMS
                </Button>
              </div>

              {/* Formato Decimal */}
              {formatoCoordenadas === 'decimal' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-600 font-medium">Latitud</label>
                      <Input
                        placeholder="8.230500"
                        value={coordenadasBusqueda.lat}
                        onChange={(e) => setCoordenadasBusqueda(prev => ({ ...prev, lat: e.target.value }))}
                        className="text-sm h-8 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-600 font-medium">Longitud</label>
                      <Input
                        placeholder="-73.356300"
                        value={coordenadasBusqueda.lng}
                        onChange={(e) => setCoordenadasBusqueda(prev => ({ ...prev, lng: e.target.value }))}
                        className="text-sm h-8 font-mono"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 bg-slate-100 p-1.5 rounded">
                    <strong>Colombia:</strong> Lat 0° a 12°N, Lon -67° a -79°W<br/>
                    <span className="text-blue-600">Ej: 8.230500, -73.356300</span>
                  </p>
                </div>
              )}

              {/* Formato GMS (Grados, Minutos, Segundos) */}
              {formatoCoordenadas === 'dms' && (
                <div className="space-y-2">
                  {/* Latitud */}
                  <div>
                    <label className="text-xs text-slate-600 font-medium block mb-1">Latitud (Norte)</label>
                    <div className="flex gap-1 items-center bg-white p-1 rounded border">
                      <Input
                        placeholder="8"
                        value={coordenadasDMS.latGrados}
                        onChange={(e) => setCoordenadasDMS(prev => ({ ...prev, latGrados: e.target.value }))}
                        className="text-sm h-7 w-10 text-center font-mono border-0 p-0"
                      />
                      <span className="text-sm font-bold">°</span>
                      <Input
                        placeholder="13"
                        value={coordenadasDMS.latMinutos}
                        onChange={(e) => setCoordenadasDMS(prev => ({ ...prev, latMinutos: e.target.value }))}
                        className="text-sm h-7 w-10 text-center font-mono border-0 p-0"
                      />
                      <span className="text-sm font-bold">'</span>
                      <Input
                        placeholder="49.80"
                        value={coordenadasDMS.latSegundos}
                        onChange={(e) => setCoordenadasDMS(prev => ({ ...prev, latSegundos: e.target.value }))}
                        className="text-sm h-7 w-14 text-center font-mono border-0 p-0"
                      />
                      <span className="text-sm font-bold">"</span>
                      <span className="text-sm font-bold text-emerald-600 ml-1">N</span>
                    </div>
                  </div>
                  {/* Longitud */}
                  <div>
                    <label className="text-xs text-slate-600 font-medium block mb-1">Longitud (Oeste)</label>
                    <div className="flex gap-1 items-center bg-white p-1 rounded border">
                      <Input
                        placeholder="73"
                        value={coordenadasDMS.lngGrados}
                        onChange={(e) => setCoordenadasDMS(prev => ({ ...prev, lngGrados: e.target.value }))}
                        className="text-sm h-7 w-10 text-center font-mono border-0 p-0"
                      />
                      <span className="text-sm font-bold">°</span>
                      <Input
                        placeholder="21"
                        value={coordenadasDMS.lngMinutos}
                        onChange={(e) => setCoordenadasDMS(prev => ({ ...prev, lngMinutos: e.target.value }))}
                        className="text-sm h-7 w-10 text-center font-mono border-0 p-0"
                      />
                      <span className="text-sm font-bold">'</span>
                      <Input
                        placeholder="22.68"
                        value={coordenadasDMS.lngSegundos}
                        onChange={(e) => setCoordenadasDMS(prev => ({ ...prev, lngSegundos: e.target.value }))}
                        className="text-sm h-7 w-14 text-center font-mono border-0 p-0"
                      />
                      <span className="text-sm font-bold">"</span>
                      <span className="text-sm font-bold text-blue-600 ml-1">W</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 bg-slate-100 p-1.5 rounded">
                    <span className="text-blue-600">Ej: 8°13'49.80"N, 73°21'22.68"W</span>
                  </p>
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex gap-2 pt-1">
                <Button
                  onClick={irACoordenadas}
                  size="sm"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-xs"
                >
                  <Navigation className="w-3 h-3 mr-1" /> Ir a ubicación
                </Button>
                {marcadorCoordenadas && (
                  <Button
                    onClick={limpiarMarcadorCoordenadas}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    Limpiar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sección de Base Gráfica - Solo administradores, coordinadores y gestores autorizados */}
          {(user?.role === 'administrador' || user?.role === 'coordinador' || (user?.role === 'gestor' && user?.puede_actualizar_gdb)) && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="py-3">
                {/* Mostrar resumen de cargas del mes */}
                {resumenCargasMensuales && (
                  <div className="mb-3 pb-2 border-b border-amber-200">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-amber-700 font-medium">
                        Estado GDB - {resumenCargasMensuales.mes}
                      </span>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="border-emerald-500 text-emerald-700 text-xs">
                          {resumenCargasMensuales.total_cargados} cargados
                        </Badge>
                        {resumenCargasMensuales.total_pendientes > 0 && (
                          <Badge variant="outline" className="border-amber-500 text-amber-700 text-xs">
                            {resumenCargasMensuales.total_pendientes} pendientes
                          </Badge>
                        )}
                      </div>
                    </div>
                    {resumenCargasMensuales.total_pendientes > 0 && resumenCargasMensuales.municipios_pendientes && (
                      <p className="text-xs text-amber-600 mt-1 truncate" title={resumenCargasMensuales.municipios_pendientes.join(', ')}>
                        Pendientes: {resumenCargasMensuales.municipios_pendientes.slice(0, 3).join(', ')}
                        {resumenCargasMensuales.municipios_pendientes.length > 3 && ` +${resumenCargasMensuales.municipios_pendientes.length - 3} más`}
                      </p>
                    )}
                  </div>
                )}

                {/* Pregunta si ya se cargó la GDB este mes */}
                {gdbCargadaEsteMes === null && !mostrarPreguntaGdb && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-amber-800">¿Desea cargar la Base Gráfica de algún municipio?</p>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex-1 border-emerald-500 text-emerald-700 hover:bg-emerald-100"
                        onClick={() => setGdbCargadaEsteMes(true)}
                      >
                        No por ahora
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex-1 border-amber-500 text-amber-700 hover:bg-amber-100"
                        onClick={() => {
                          setGdbCargadaEsteMes(false);
                          setMostrarPreguntaGdb(true);
                        }}
                      >
                        Sí, cargar GDB
                      </Button>
                    </div>
                  </div>
                )}

                {/* Si ya fue cargada, mostrar confirmación */}
                {gdbCargadaEsteMes === true && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-600">✓</span>
                      <p className="text-sm text-emerald-700">
                        {resumenCargasMensuales?.total_pendientes === 0 
                          ? 'Todas las bases gráficas actualizadas este mes'
                          : 'Carga de GDB no requerida por ahora'}
                      </p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-xs text-slate-500"
                      onClick={() => {
                        setGdbCargadaEsteMes(null);
                        setMostrarPreguntaGdb(false);
                      }}
                    >
                      Cargar GDB
                    </Button>
                  </div>
                )}

                {/* Si no fue cargada, mostrar opciones de carga */}
                {(gdbCargadaEsteMes === false || mostrarPreguntaGdb) && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm">
                        <p className="font-medium text-amber-800">Actualizar Base Gráfica</p>
                        <p className="text-xs text-amber-600">Subir archivo .gdb.zip actualizado</p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-xs text-slate-500"
                        onClick={() => {
                          setGdbCargadaEsteMes(null);
                          setMostrarPreguntaGdb(false);
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <label className="cursor-pointer flex-1">
                        <input
                          type="file"
                          accept=".zip"
                          onChange={handleUploadGdb}
                          className="hidden"
                          disabled={uploadingGdb}
                        />
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="w-full border-amber-500 text-amber-700 hover:bg-amber-100"
                          disabled={uploadingGdb}
                          asChild
                        >
                          <span>
                            {uploadingGdb ? 'Procesando...' : 'Subir archivo ZIP'}
                          </span>
                        </Button>
                      </label>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Solo archivos .ZIP que contengan la carpeta .gdb
                    </p>
                  </div>
                )}
                
                {/* Indicador de Progreso */}
                {uploadProgress && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className={`font-medium ${uploadProgress.status === 'error' ? 'text-red-700' : uploadProgress.status === 'completado' ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {uploadProgress.message}
                      </span>
                      <span className="text-slate-600 font-bold">{uploadProgress.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          uploadProgress.status === 'error' ? 'bg-red-500' : 
                          uploadProgress.status === 'completado' ? 'bg-emerald-500' : 
                          'bg-amber-500'
                        }`}
                        style={{ width: `${uploadProgress.progress}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      {uploadProgress.status === 'subiendo' && <span>📤 Subiendo archivos...</span>}
                      {uploadProgress.status === 'extrayendo' && <span>📦 Extrayendo ZIP...</span>}
                      {uploadProgress.status === 'leyendo_rural' && <span>🌾 Leyendo capa rural...</span>}
                      {uploadProgress.status === 'leyendo_urbano' && <span>🏘️ Leyendo capa urbana...</span>}
                      {uploadProgress.status === 'guardando_geometrias' && <span>💾 Guardando geometrías...</span>}
                      {uploadProgress.status === 'relacionando' && <span>🔗 Relacionando con predios...</span>}
                      {uploadProgress.status === 'matching_avanzado' && <span>🔍 Búsqueda avanzada de coincidencias...</span>}
                      {uploadProgress.status === 'completado' && <span>✅ ¡Proceso completado!</span>}
                      {uploadProgress.status === 'error' && <span>❌ Error en el proceso</span>}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Sección de Ortoimágenes Propias - Debajo de GDB */}
          {(user?.role === 'administrador' || user?.role === 'coordinador' || (user?.role === 'gestor' && user?.puede_actualizar_gdb)) && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="py-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-blue-800 flex items-center gap-1">
                    <Image className="w-4 h-4" /> Ortoimágenes Propias
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs border-blue-500 text-blue-700 hover:bg-blue-100"
                    onClick={() => setShowUploadOrtoDialog(true)}
                  >
                    <Upload className="w-3 h-3 mr-1" /> Subir Ortoimagen
                  </Button>
                </div>
                
                {ortoimagenes.length > 0 ? (
                  <div className="space-y-2">
                    <Select 
                      value={ortoimagenActiva?.id || "none"} 
                      onValueChange={(v) => {
                        if (v === "none") {
                          setOrtoimagenActiva(null);
                        } else {
                          const orto = ortoimagenes.find(o => o.id === v);
                          if (orto) {
                            setOrtoimagenActiva(orto);
                            toast.success(`Ortoimagen "${orto.nombre}" activada. Zoom: ${orto.zoom_min}-${orto.zoom_max}`);
                            // Centrar mapa en la ortoimagen si tiene bounds
                            if (orto.bounds && mapRef.current) {
                              const map = mapRef.current;
                              const sw = orto.bounds[0]; // [lng, lat]
                              const ne = orto.bounds[1]; // [lng, lat]
                              // Convertir a formato Leaflet [lat, lng]
                              const bounds = [[sw[1], sw[0]], [ne[1], ne[0]]];
                              map.fitBounds(bounds, { padding: [50, 50] });
                            }
                          }
                        }
                      }}
                    >
                      <SelectTrigger className={ortoimagenActiva ? "border-emerald-500 bg-emerald-50" : ""}>
                        <SelectValue placeholder="Seleccionar ortoimagen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin ortoimagen propia</SelectItem>
                        {ortoimagenes.map(orto => (
                          <SelectItem key={orto.id} value={orto.id}>
                            {orto.nombre} ({orto.municipio})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {ortoimagenActiva && (
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-emerald-600">
                          ✓ Mostrando ortoimagen de alta resolución
                        </p>
                        {(user?.role === 'administrador' || user?.role === 'coordinador') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 p-1"
                            onClick={() => handleDeleteOrtoimagen(ortoimagenActiva.id, ortoimagenActiva.nombre)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-blue-600 text-center py-2">
                    No hay ortoimágenes cargadas. Suba una ortoimagen GeoTIFF para visualizar capas de alta resolución.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {!selectedPredio && (
            <Card className="bg-slate-50">
              <CardContent className="py-8 text-center">
                <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">
                  Busque un predio por código para ver su ubicación en el mapa
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Panel Derecho - Mapa */}
        <div className="col-span-8">
          <Card className="overflow-hidden">
            <div className="h-[calc(100vh-220px)] min-h-[500px]">
              <MapContainer
                center={defaultCenter}
                zoom={defaultZoom}
                maxZoom={tileLayers[mapType]?.maxZoom || 18}
                minZoom={5}
                style={{ height: '100%', width: '100%' }}
                ref={mapRef}
              >
                <SmartTileLayer mapType={mapType} tileLayers={tileLayers} ortoimagenActiva={ortoimagenActiva} />
                
                {/* Mostrar límites de municipios usando componente con acceso al mapa */}
                <MunicipalityLimits 
                  key={`limits-oficial-${limitesMunicipios?.total_municipios || 0}`}
                  limitesMunicipios={limitesMunicipios}
                  filterMunicipio={filterMunicipio}
                  setFilterMunicipio={setFilterMunicipio}
                />
                
                {/* Mostrar predios individuales solo si está activado y se seleccionó un municipio */}
                {mostrarPredios && allGeometries && allGeometries.features && allGeometries.features.length > 0 && (
                  <GeoJSON
                    key={`predios-${filterMunicipio}-${filterZona}-${allGeometries.total}-${Date.now()}`}
                    data={allGeometries}
                    style={(feature) => ({
                      color: feature.properties?.tipo === 'Urbano' ? '#DC2626' : '#2563EB',
                      weight: feature.properties?.tipo === 'Urbano' ? 2 : 1,
                      opacity: 1,
                      fillColor: feature.properties?.tipo === 'Urbano' ? '#FCA5A5' : '#93C5FD',
                      fillOpacity: feature.properties?.tipo === 'Urbano' ? 0.5 : 0.3
                    })}
                    onEachFeature={(feature, layer) => {
                      // Popup simple
                      layer.bindPopup(`
                        <div class="text-sm">
                          <p class="font-bold text-xs">${feature.properties?.codigo || 'Sin código'}</p>
                          <p class="text-xs">${feature.properties?.tipo || ''}</p>
                          <p class="text-xs text-blue-600 mt-1">Clic para ver detalles</p>
                        </div>
                      `);
                      
                      // Click handler para cargar información completa del predio
                      layer.on('click', async () => {
                        const codigo = feature.properties?.codigo;
                        if (!codigo) return;
                        
                        try {
                          const token = localStorage.getItem('token');
                          // Buscar predio en la base de datos
                          const predioResponse = await fetch(`${API}/predios?search=${codigo}&limit=1`, {
                            headers: { Authorization: `Bearer ${token}` }
                          });
                          const predioData = await predioResponse.json();
                          
                          if (predioData.predios && predioData.predios.length > 0) {
                            const predio = predioData.predios[0];
                            setSelectedPredio(predio);
                            
                            // Obtener geometría para el área GDB
                            try {
                              const geoResponse = await fetch(`${API}/predios/codigo/${predio.codigo_predial_nacional}/geometria`, {
                                headers: { Authorization: `Bearer ${token}` }
                              });
                              if (geoResponse.ok) {
                                const geoData = await geoResponse.json();
                                setGeometry(geoData);
                              }
                            } catch (e) {
                              // Si no hay geometría, usar la del feature actual
                              setGeometry({
                                type: 'Feature',
                                geometry: feature.geometry,
                                properties: feature.properties
                              });
                            }
                            
                            // VERIFICAR CONSTRUCCIONES
                            try {
                              const codigoParaBuscar = predio.codigo_gdb || predio.codigo_predial_nacional;
                              const constResponse = await fetch(`${API}/gdb/construcciones/${codigoParaBuscar}`, {
                                headers: { Authorization: `Bearer ${token}` }
                              });
                              const constData = await constResponse.json();
                              
                              if (constData && constData.construcciones && constData.construcciones.length > 0) {
                                setTieneConstrucciones(true);
                                setConstrucciones(null);
                                setMostrarConstrucciones(false);
                              } else {
                                setTieneConstrucciones(false);
                                setConstrucciones(null);
                              }
                            } catch (constError) {
                              setTieneConstrucciones(false);
                              setConstrucciones(null);
                            }
                            
                            toast.success('Predio seleccionado');
                          } else {
                            toast.warning('Predio no encontrado en la base de datos');
                          }
                        } catch (error) {
                          console.error('Error al cargar predio:', error);
                          toast.error('Error al cargar información del predio');
                        }
                      });
                    }}
                  />
                )}
                
                {/* Geometría del predio seleccionado (resaltado) */}
                {geometry && (
                  <>
                    <GeoJSON 
                      key={JSON.stringify(geometry)}
                      data={geometry} 
                      style={{
                        color: '#FFFF00', // Amarillo para destacar
                        weight: 4,
                        opacity: 1,
                        fillColor: '#FFFF00',
                        fillOpacity: 0.4
                      }}
                    >
                      <Popup>
                        <div className="text-sm min-w-[200px]">
                          <p className="font-bold text-emerald-700 mb-1 text-xs">
                            Código Predial Nacional
                          </p>
                          <p className="font-mono text-xs bg-slate-100 p-1 rounded mb-2">
                            {selectedPredio?.codigo_predial_nacional}
                          </p>
                          <p className="text-xs text-slate-500">Matrícula:</p>
                          <p className="text-xs font-medium mb-2">
                            {selectedPredio?.matricula || 'Sin matrícula'}
                          </p>
                          <p className="text-xs text-slate-600">
                            {selectedPredio?.municipio} - {getZonaFromCodigo(selectedPredio?.codigo_predial_nacional || selectedPredio?.codigo_homologado).texto}
                          </p>
                          <p className="text-xs mt-1">
                            Área: {formatArea(geometry.properties?.area_m2)}
                          </p>
                        </div>
                      </Popup>
                    </GeoJSON>
                    
                    {/* Renderizar construcciones del predio (polígonos rojos) - SOLO si el toggle está activo */}
                    {mostrarConstrucciones && construcciones && construcciones.map((const_item, idx) => (
                      const_item.geometry && (
                        <GeoJSON
                          key={`construccion-${idx}`}
                          data={const_item.geometry}
                          style={construccionStyle}
                        >
                          <Popup>
                            <div className="text-sm min-w-[150px]">
                              <p className="font-bold text-red-700 mb-1 text-xs">🏠 Construcción</p>
                              <p className="text-xs">Área: {formatArea(const_item.area_m2)}</p>
                              {const_item.pisos > 1 && (
                                <p className="text-xs">Pisos: {const_item.pisos}</p>
                              )}
                              {const_item.tipo_construccion && (
                                <p className="text-xs">Tipo: {const_item.tipo_construccion}</p>
                              )}
                              <p className="text-xs text-slate-500 mt-1">Zona: {const_item.tipo_zona}</p>
                            </div>
                          </Popup>
                        </GeoJSON>
                      )
                    ))}
                    
                    <FitBounds geometry={geometry} />
                  </>
                )}
                
                {/* Marcador de coordenadas buscadas */}
                {marcadorCoordenadas && (
                  <>
                    <FlyToCoordinates coordinates={marcadorCoordenadas} />
                    <CircleMarker
                      center={marcadorCoordenadas}
                      radius={12}
                      pathOptions={{
                        color: '#DC2626',
                        fillColor: '#FCA5A5',
                        fillOpacity: 0.8,
                        weight: 3
                      }}
                    >
                      <Popup>
                        <div className="text-sm">
                          <p className="font-bold text-red-700">📍 Ubicación buscada</p>
                          <p className="text-xs mt-1">Lat: {marcadorCoordenadas[0].toFixed(6)}°</p>
                          <p className="text-xs">Lng: {marcadorCoordenadas[1].toFixed(6)}°</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {(() => {
                              const latDMS = decimalToDMSHelper(marcadorCoordenadas[0], true);
                              const lngDMS = decimalToDMSHelper(Math.abs(marcadorCoordenadas[1]), false);
                              return `${latDMS.grados}°${latDMS.minutos}'${latDMS.segundos}"${latDMS.direccion}, ${lngDMS.grados}°${lngDMS.minutos}'${lngDMS.segundos}"W`;
                            })()}
                          </p>
                        </div>
                      </Popup>
                    </CircleMarker>
                  </>
                )}
              </MapContainer>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
