import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Fix for Leaflet default marker icon - usar iconos locales
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

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

/**
 * PredioMap - Componente de mapa para visualizar un predio
 * @param {string} codigoPredial - Código predial nacional del predio
 * @param {string} predioId - ID del predio (alternativa al código)
 * @param {number} height - Altura del mapa en píxeles
 * @param {boolean} showSatellite - Mostrar mapa satelital por defecto
 * @param {object} predioData - Datos del predio (opcional, para popup)
 */
export default function PredioMap({ 
  codigoPredial, 
  predioId,
  height = 300, 
  showSatellite = false,
  predioData = null 
}) {
  const [geometry, setGeometry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Default center: Norte de Santander, Colombia
  const defaultCenter = [8.0, -73.0];
  const defaultZoom = 9;

  useEffect(() => {
    if (codigoPredial) {
      fetchGeometryByCode(codigoPredial);
    } else if (predioId) {
      fetchGeometryById(predioId);
    }
  }, [codigoPredial, predioId]);

  const fetchGeometryByCode = async (codigo) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/predios/codigo/${codigo}/geometria`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGeometry(response.data);
    } catch (err) {
      setError('Geometría no disponible');
      setGeometry(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchGeometryById = async (id) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/predios/${id}/geometria`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGeometry(response.data);
    } catch (err) {
      setError('Geometría no disponible');
      setGeometry(null);
    } finally {
      setLoading(false);
    }
  };

  const formatArea = (area) => {
    if (!area) return '0 m²';
    if (area >= 10000) {
      const ha = Math.floor(area / 10000);
      const m2 = Math.floor(area % 10000);
      return `${ha} ha ${m2} m²`;
    }
    return `${Math.round(area)} m²`;
  };

  // Estilo de polígonos - Cyan/Blanco para visibilidad en satélite
  const geoJSONStyle = {
    color: '#00FFFF', // Cyan brillante para el borde
    weight: 3,
    opacity: 1,
    fillColor: '#FFFFFF', // Blanco para el relleno
    fillOpacity: 0.25
  };

  // Satélite por defecto
  const tileLayer = {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri'
  };

  if (loading) {
    return (
      <div 
        className="bg-slate-100 rounded-lg flex items-center justify-center"
        style={{ height: `${height}px` }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700 mx-auto mb-2"></div>
          <p className="text-sm text-slate-500">Cargando mapa...</p>
        </div>
      </div>
    );
  }

  if (error || !geometry) {
    return (
      <div 
        className="bg-slate-100 rounded-lg flex items-center justify-center"
        style={{ height: `${height}px` }}
      >
        <div className="text-center">
          <svg className="w-10 h-10 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <p className="text-sm text-slate-500">{error || 'Sin geometría'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden border border-slate-200" style={{ height: `${height}px` }}>
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url={tileLayer.url}
          attribution={tileLayer.attribution}
        />
        
        <GeoJSON 
          key={JSON.stringify(geometry)}
          data={geometry} 
          style={geoJSONStyle}
        >
          <Popup>
            <div className="text-sm min-w-[180px]">
              {predioData ? (
                <>
                  <p className="font-bold text-emerald-700 mb-1 text-xs break-all">
                    CPN: {predioData.codigo_predial_nacional}
                  </p>
                  <p className="text-xs text-slate-600">{predioData.municipio}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    <span className="font-medium">Matrícula:</span> {predioData.r2_registros?.[0]?.matricula_inmobiliaria || predioData.matricula_inmobiliaria || 'Sin información'}
                  </p>
                </>
              ) : (
                <p className="font-bold text-emerald-700 mb-1 text-xs break-all">
                  CPN: {geometry.properties?.codigo}
                </p>
              )}
              <div className="mt-2 pt-2 border-t text-xs">
                <p><span className="text-slate-500">Área:</span> {formatArea(geometry.properties?.area_m2)}</p>
                <p><span className="text-slate-500">Perímetro:</span> {geometry.properties?.perimetro_m?.toFixed(1)} m</p>
                <p><span className="text-slate-500">Tipo:</span> {geometry.properties?.tipo}</p>
              </div>
            </div>
          </Popup>
        </GeoJSON>
        <FitBounds geometry={geometry} />
      </MapContainer>
    </div>
  );
}
