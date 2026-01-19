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
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  Layers,
  ZoomIn,
  ZoomOut,
  Locate,
  RefreshCw,
  Database,
  FileSpreadsheet,
  User,
  Home,
  Building,
  AlertCircle,
  CheckCircle,
  X,
  Crosshair,
  Satellite,
  Map as MapIcon
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Componente para manejar eventos del mapa y ubicación GPS
function MapController({ onLocationFound, userPosition, setCurrentZoom, flyToPosition }) {
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
  const [mapCenter, setMapCenter] = useState([7.8, -72.9]); // Norte de Santander
  
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
  
  // Estados de filtro
  const [filterZona, setFilterZona] = useState('todos');
  
  // Cargar datos del proyecto
  const fetchProyecto = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/actualizacion/proyectos/${proyectoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProyecto(response.data);
      
      // Si tiene GDB procesado, cargar geometrías
      if (response.data.gdb_procesado) {
        fetchGeometrias();
      }
      
      // Si tiene R1/R2, cargar predios
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
        
        // Centrar mapa en las geometrías
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
  
  // Limpiar GPS al desmontar
  useEffect(() => {
    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);
  
  // Buscar predio por código
  const handleSearch = async () => {
    if (!searchCode.trim()) return;
    
    try {
      const token = localStorage.getItem('token');
      
      // Buscar en geometrías
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
      
      // Buscar en R1/R2
      const predio = prediosR1R2.find(p => 
        p.codigo_predial?.includes(searchCode) ||
        p.numero_predial?.includes(searchCode)
      );
      
      if (predio) {
        setSelectedPredio(predio);
        setShowPredioDetail(true);
      } else if (!geometrias?.features?.find(f => f.properties?.codigo_predial?.includes(searchCode))) {
        toast.warning('Predio no encontrado');
      }
    } catch (error) {
      toast.error('Error en la búsqueda');
    }
  };
  
  // Estilo de geometrías
  const getGeometryStyle = (feature) => {
    const isSelected = selectedGeometry?.properties?.codigo_predial === feature.properties?.codigo_predial;
    const isUrban = feature.properties?.zona === 'urbano';
    
    return {
      fillColor: isSelected ? '#f59e0b' : (isUrban ? '#3b82f6' : '#22c55e'),
      weight: isSelected ? 3 : 1,
      opacity: 1,
      color: isSelected ? '#f59e0b' : '#1e40af',
      fillOpacity: isSelected ? 0.5 : 0.3
    };
  };
  
  // Click en geometría
  const onEachFeature = (feature, layer) => {
    layer.on({
      click: () => {
        setSelectedGeometry(feature);
        
        // Buscar datos R1/R2 asociados
        const predio = prediosR1R2.find(p => 
          p.codigo_predial === feature.properties?.codigo_predial ||
          p.numero_predial === feature.properties?.numero_predial
        );
        
        if (predio) {
          setSelectedPredio(predio);
          setShowPredioDetail(true);
        }
      }
    });
    
    // Tooltip
    if (feature.properties?.codigo_predial || feature.properties?.numero_predial) {
      layer.bindTooltip(
        feature.properties.codigo_predial || feature.properties.numero_predial,
        { permanent: false, direction: 'top' }
      );
    }
  };
  
  // Tiles del mapa
  const getTileLayer = () => {
    if (mapType === 'satellite') {
      return (
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Esri"
          maxZoom={19}
        />
      );
    }
    return (
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="OpenStreetMap"
        maxZoom={19}
      />
    );
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
  
  // Si no hay GDB cargado
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
              GPS: {Math.round(gpsAccuracy)}m
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
            userPosition={userPosition}
            setCurrentZoom={setCurrentZoom}
            flyToPosition={flyToPosition}
          />
          
          {getTileLayer()}
          
          {/* Geometrías de predios */}
          {geometrias && (
            <GeoJSON
              key={`geom-${filterZona}-${selectedGeometry?.properties?.codigo_predial}`}
              data={geometrias}
              style={getGeometryStyle}
              onEachFeature={onEachFeature}
            />
          )}
          
          {/* Construcciones */}
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
          
          {/* Marcador de ubicación del usuario */}
          {userPosition && (
            <Marker position={userPosition} icon={userLocationIcon}>
            </Marker>
          )}
          
          {/* Círculo de precisión GPS */}
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
          {/* Tipo de mapa */}
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
          
          {/* Centrar en usuario */}
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
            <SelectTrigger className="w-32 bg-white shadow-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="urbano">Urbano</SelectItem>
              <SelectItem value="rural">Rural</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Estadísticas */}
        <div className="absolute bottom-4 left-4 right-4 z-[1000]">
          <Card className="bg-white/95 backdrop-blur shadow-lg">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-green-500"></div>
                    <span className="text-xs text-slate-600">Rural</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-blue-500"></div>
                    <span className="text-xs text-slate-600">Urbano</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-red-500"></div>
                    <span className="text-xs text-slate-600">Construcciones</span>
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  Zoom: {currentZoom}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Modal de detalle de predio */}
      <Dialog open={showPredioDetail} onOpenChange={setShowPredioDetail}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Home className="w-5 h-5 text-amber-600" />
              Detalle del Predio
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
              
              <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="propietarios">Propietarios</TabsTrigger>
                  <TabsTrigger value="fisico">Físico</TabsTrigger>
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
                        {selectedPredio.area_terreno ? `${selectedPredio.area_terreno.toLocaleString()} m²` : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Área Construida</p>
                      <p className="text-sm font-medium">
                        {selectedPredio.area_construida ? `${selectedPredio.area_construida.toLocaleString()} m²` : '-'}
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
                
                <TabsContent value="fisico" className="mt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-slate-500">Tipo Predio</p>
                      <p className="text-sm font-medium">{selectedPredio.tipo_predio || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Estrato</p>
                      <p className="text-sm font-medium">{selectedPredio.estrato || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Avalúo</p>
                      <p className="text-sm font-medium">
                        {selectedPredio.avaluo_catastral 
                          ? `$${selectedPredio.avaluo_catastral.toLocaleString()}` 
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Vigencia</p>
                      <p className="text-sm font-medium">{selectedPredio.vigencia || '-'}</p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
              
              {/* Coordenadas de la geometría */}
              {selectedGeometry && (
                <div className="border-t pt-3">
                  <p className="text-xs text-slate-500 mb-1">Ubicación (centro del predio)</p>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-mono">
                      {(() => {
                        const bounds = L.geoJSON(selectedGeometry).getBounds();
                        const center = bounds.getCenter();
                        return `${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}`;
                      })()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
