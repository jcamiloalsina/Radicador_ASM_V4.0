import React, { memo, useCallback, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';

/**
 * Control de zoom personalizado con indicador
 */
const ZoomIndicator = memo(({ onZoomChange }) => {
  const map = useMap();
  
  useEffect(() => {
    const handleZoom = () => {
      onZoomChange?.(map.getZoom());
    };
    
    map.on('zoomend', handleZoom);
    return () => map.off('zoomend', handleZoom);
  }, [map, onZoomChange]);
  
  return null;
});

/**
 * Componente para centrar el mapa
 */
const MapCenterController = memo(({ center, zoom }) => {
  const map = useMap();
  
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, zoom || map.getZoom());
    }
  }, [map, center, zoom]);
  
  return null;
});

/**
 * Componente de mapa optimizado para el visor de actualización
 * - Renderizado condicional de geometrías
 * - Eventos optimizados
 * - Soporte para múltiples capas
 */
const MapaVisor = memo(({
  center = [7.5, -73.5],
  zoom = 13,
  geometrias,
  construcciones,
  selectedCodigo,
  onSelectGeometria,
  onZoomChange,
  tileLayer = 'osm',
  className = ''
}) => {
  const geoJsonRef = useRef(null);
  const construccionesRef = useRef(null);

  // Tiles disponibles
  const tiles = {
    osm: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '© OpenStreetMap'
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '© Esri'
    },
    hybrid: {
      url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      attribution: '© Google'
    }
  };

  const currentTile = tiles[tileLayer] || tiles.osm;

  // Estilo de geometrías
  const getStyle = useCallback((feature) => {
    const codigo = feature?.properties?.CODIGO || feature?.properties?.codigo || feature?.properties?.codigo_predial;
    const isSelected = codigo === selectedCodigo;
    const estado = feature?.properties?.estado;
    
    let fillColor = '#3388ff'; // Default azul
    if (estado === 'visitado') fillColor = '#0ea5e9';
    if (estado === 'actualizado') fillColor = '#22c55e';
    if (isSelected) fillColor = '#ef4444';
    
    return {
      color: isSelected ? '#dc2626' : '#2563eb',
      weight: isSelected ? 3 : 1,
      fillColor,
      fillOpacity: isSelected ? 0.5 : 0.3,
    };
  }, [selectedCodigo]);

  // Estilo de construcciones
  const getConstruccionStyle = useCallback(() => ({
    color: '#f97316',
    weight: 1,
    fillColor: '#fdba74',
    fillOpacity: 0.4,
  }), []);

  // Eventos de cada feature
  const onEachFeature = useCallback((feature, layer) => {
    const codigo = feature?.properties?.CODIGO || feature?.properties?.codigo || feature?.properties?.codigo_predial;
    
    layer.on({
      click: () => {
        onSelectGeometria?.(feature);
      },
      mouseover: (e) => {
        if (codigo !== selectedCodigo) {
          e.target.setStyle({
            weight: 2,
            fillOpacity: 0.5,
          });
        }
      },
      mouseout: (e) => {
        if (codigo !== selectedCodigo) {
          e.target.setStyle(getStyle(feature));
        }
      },
    });

    // Tooltip con código
    if (codigo) {
      layer.bindTooltip(codigo, {
        permanent: false,
        direction: 'center',
        className: 'text-xs'
      });
    }
  }, [onSelectGeometria, selectedCodigo, getStyle]);

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className={`w-full h-full ${className}`}
      zoomControl={false}
    >
      <TileLayer {...currentTile} />
      <ZoomControl position="topright" />
      <ZoomIndicator onZoomChange={onZoomChange} />
      <MapCenterController center={center} zoom={zoom} />
      
      {/* Capa de terrenos/predios */}
      {geometrias && (
        <GeoJSON
          ref={geoJsonRef}
          key={`geom-${selectedCodigo}`} // Force re-render on selection change
          data={geometrias}
          style={getStyle}
          onEachFeature={onEachFeature}
        />
      )}
      
      {/* Capa de construcciones */}
      {construcciones && (
        <GeoJSON
          ref={construccionesRef}
          data={construcciones}
          style={getConstruccionStyle}
        />
      )}
    </MapContainer>
  );
});

MapaVisor.displayName = 'MapaVisor';
ZoomIndicator.displayName = 'ZoomIndicator';
MapCenterController.displayName = 'MapCenterController';

export default MapaVisor;
