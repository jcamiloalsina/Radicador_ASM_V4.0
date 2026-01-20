import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, GeoJSON, Marker, CircleMarker, useMap, useMapEvents } from 'react-leaflet';
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
  Eye
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
  const [construcciones, setConstrucciones] = useState(null);
  const [prediosR1R2, setPrediosR1R2] = useState([]);
  
  // Estados del mapa
  const [currentZoom, setCurrentZoom] = useState(14);
  const [mapType, setMapType] = useState('satellite');
  const [mapCenter, setMapCenter] = useState([7.8, -72.9]);
  
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
  
  // Estados de filtro
  const [filterZona, setFilterZona] = useState('todos');
  const [filterEstado, setFilterEstado] = useState('todos'); // todos, pendiente, visitado, actualizado
  
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
  
  // Funciones GPS
  const startWatchingPosition = () => {
    if (!navigator.geolocation) {
      toast.error('Tu navegador no soporta geolocalización');
      return;
    }
    
    setWatchingPosition(true);
    toast.info('Activando GPS...');
    
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setUserPosition([latitude, longitude]);
        setGpsAccuracy(accuracy);
        
        if (!userPosition) {
          toast.success(`GPS activo - Precisión: ${Math.round(accuracy)}m`);
        }
      },
      (error) => {
        toast.error('Error de GPS: ' + error.message);
        setWatchingPosition(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
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
    
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `${API}/actualizacion/proyectos/${proyectoId}/predios/${selectedPredio.codigo_predial || selectedPredio.numero_predial}`,
        {
          ...editData,
          ubicacion_gps: userPosition ? { lat: userPosition[0], lng: userPosition[1], accuracy: gpsAccuracy } : null,
          actualizado_por: user?.email,
          actualizado_en: new Date().toISOString()
        },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      toast.success('Cambios guardados exitosamente');
      setEditMode(false);
      
      // Actualizar predio en la lista local
      setPrediosR1R2(prev => prev.map(p => 
        (p.codigo_predial === selectedPredio.codigo_predial || p.numero_predial === selectedPredio.numero_predial)
          ? { ...p, ...editData }
          : p
      ));
      
      setSelectedPredio(prev => ({ ...prev, ...editData }));
    } catch (error) {
      toast.error('Error al guardar cambios');
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
        
        const predio = prediosR1R2.find(p => 
          p.codigo_predial === feature.properties?.codigo_predial ||
          p.numero_predial === feature.properties?.numero_predial
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
          
          {getTileLayer()}
          
          {geometrias && (
            <GeoJSON
              key={`geom-${filterZona}-${selectedGeometry?.properties?.codigo_predial}-${JSON.stringify(estadisticas)}`}
              data={geometrias}
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
            >
              <Satellite className="w-4 h-4" />
            </Button>
            <Button
              variant={mapType === 'street' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMapType('street')}
              className="w-9 h-9 p-0"
            >
              <MapIcon className="w-4 h-4" />
            </Button>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={centerOnUser}
            className="w-9 h-9 p-0 bg-white shadow-lg"
            disabled={!userPosition}
          >
            <Locate className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Filtro de zona */}
        <div className="absolute top-4 left-4 z-[1000]">
          <Select value={filterZona} onValueChange={setFilterZona}>
            <SelectTrigger className="w-28 bg-white shadow-lg text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="urbano">Urbano</SelectItem>
              <SelectItem value="rural">Rural</SelectItem>
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
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
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
                // Modo visualización
                <Tabs defaultValue="general" className="w-full">
                  <TabsList className="grid grid-cols-3 w-full">
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="propietarios">Propietarios</TabsTrigger>
                    <TabsTrigger value="campo">Campo</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="general" className="space-y-3 mt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-slate-500">Dirección</p>
                        <p className="text-sm font-medium">{selectedPredio.direccion || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Destino Económico</p>
                        <p className="text-sm font-medium">{selectedPredio.destino_economico || '-'}</p>
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
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="propietarios" className="mt-3">
                    {selectedPredio.propietarios?.length > 0 ? (
                      <div className="space-y-2">
                        {selectedPredio.propietarios.map((prop, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                            <User className="w-4 h-4 text-slate-400" />
                            <div>
                              <p className="text-sm font-medium">{prop.nombre || 'Sin nombre'}</p>
                              <p className="text-xs text-slate-500">{prop.documento || '-'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 text-center py-4">Sin información de propietarios</p>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="campo" className="mt-3 space-y-3">
                    {selectedPredio.observaciones_campo && (
                      <div>
                        <p className="text-xs text-slate-500">Observaciones de Campo</p>
                        <p className="text-sm bg-slate-50 p-2 rounded">{selectedPredio.observaciones_campo}</p>
                      </div>
                    )}
                    {selectedPredio.visitado_en && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Clock className="w-3 h-3" />
                        Visitado: {new Date(selectedPredio.visitado_en).toLocaleString('es-CO')}
                      </div>
                    )}
                    {selectedPredio.ubicacion_gps && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <MapPin className="w-3 h-3" />
                        GPS: {selectedPredio.ubicacion_gps.lat?.toFixed(6)}, {selectedPredio.ubicacion_gps.lng?.toFixed(6)}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              ) : (
                // Modo edición
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label htmlFor="direccion">Dirección</Label>
                      <Input
                        id="direccion"
                        value={editData.direccion}
                        onChange={(e) => setEditData(prev => ({ ...prev, direccion: e.target.value }))}
                        placeholder="Dirección del predio"
                      />
                    </div>
                    <div>
                      <Label htmlFor="destino">Destino Económico</Label>
                      <Select 
                        value={editData.destino_economico} 
                        onValueChange={(v) => setEditData(prev => ({ ...prev, destino_economico: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Habitacional">Habitacional</SelectItem>
                          <SelectItem value="Comercial">Comercial</SelectItem>
                          <SelectItem value="Industrial">Industrial</SelectItem>
                          <SelectItem value="Agropecuario">Agropecuario</SelectItem>
                          <SelectItem value="Institucional">Institucional</SelectItem>
                          <SelectItem value="Lote">Lote</SelectItem>
                          <SelectItem value="Otro">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="area_terreno">Área Terreno (m²)</Label>
                      <Input
                        id="area_terreno"
                        type="number"
                        value={editData.area_terreno}
                        onChange={(e) => setEditData(prev => ({ ...prev, area_terreno: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="area_construida">Área Construida (m²)</Label>
                      <Input
                        id="area_construida"
                        type="number"
                        value={editData.area_construida}
                        onChange={(e) => setEditData(prev => ({ ...prev, area_construida: e.target.value }))}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="observaciones">Observaciones de Campo</Label>
                      <Textarea
                        id="observaciones"
                        value={editData.observaciones_campo}
                        onChange={(e) => setEditData(prev => ({ ...prev, observaciones_campo: e.target.value }))}
                        placeholder="Notas de la visita en campo..."
                        rows={3}
                      />
                    </div>
                  </div>
                  
                  {userPosition && (
                    <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 p-2 rounded">
                      <MapPin className="w-3 h-3" />
                      Ubicación GPS actual será guardada: {userPosition[0].toFixed(6)}, {userPosition[1].toFixed(6)}
                    </div>
                  )}
                </div>
              )}
              
              <DialogFooter className="flex gap-2 pt-4">
                {!editMode ? (
                  <>
                    {selectedPredio.estado_visita !== 'visitado' && selectedPredio.estado_visita !== 'actualizado' && (
                      <Button 
                        variant="outline" 
                        onClick={handleMarcarVisitado}
                        disabled={saving}
                        className="flex-1"
                      >
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
                        Marcar Visitado
                      </Button>
                    )}
                    <Button 
                      onClick={() => setEditMode(true)}
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
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    >
                      {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                      Guardar
                    </Button>
                  </>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
