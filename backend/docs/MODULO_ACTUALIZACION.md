# Módulo de Actualización Catastral

## Descripción
El módulo de Actualización gestiona proyectos de actualización catastral masiva, permitiendo la importación de geodatabases (GDB), visualización de geometrías y sincronización de datos geoespaciales.

## Componentes

### 1. Gestión de Proyectos
**Archivo**: `frontend/src/pages/ProyectosActualizacion.js`

#### Funcionalidades
- Crear proyectos de actualización por municipio
- Definir etapas del proyecto
- Asignar equipo de trabajo
- Seguimiento de avance

#### Estados del Proyecto
```
planificacion ─► ejecucion ─► revision ─► aprobacion ─► cerrado
```

### 2. Importación de GDB
**Proceso de carga de Geodatabase**

#### Flujo
```
1. Subir archivo .gdb (geodatabase)
2. Sistema extrae capas y geometrías
3. Procesa coordenadas y proyecciones (EPSG:4326)
4. Asocia geometrías con predios existentes
5. Visualiza en mapa interactivo
```

#### Capas Soportadas
| Capa | Contenido |
|------|-----------|
| R_TERRENO | Polígonos de terrenos |
| R_CONSTRUCCION | Polígonos de construcciones |
| R_UNIDAD | Unidades prediales |
| R_LINDERO | Líneas de linderos |

### 3. Visor de Predios
**Archivo**: `frontend/src/pages/VisorPredios.js`

#### Características
- Mapa interactivo con Leaflet.js
- Capas base: OpenStreetMap, Satelital
- Visualización de polígonos de predios
- Popups con información del predio
- Búsqueda por NPN o coordenadas
- Exportación de geometrías

#### Estilos de Polígonos
```javascript
// Predio normal
{ color: '#3388ff', weight: 2, fillOpacity: 0.2 }

// Predio seleccionado
{ color: '#ff7800', weight: 3, fillOpacity: 0.4 }

// Predio con cambios pendientes
{ color: '#ffc107', weight: 2, fillOpacity: 0.3 }
```

### 4. Gestión de Predios en Actualización
**Archivo**: `frontend/src/pages/GestionPrediosActualizacion.js`

#### Funcionalidades
- Listar predios del proyecto
- Editar datos alfanuméricos
- Vincular geometría a predio
- Proponer cambios para aprobación
- Comparar datos antes/después

## API Endpoints

### Proyectos
```
GET    /api/actualizacion/proyectos              # Listar proyectos
POST   /api/actualizacion/proyectos              # Crear proyecto
GET    /api/actualizacion/proyectos/{id}         # Obtener proyecto
PUT    /api/actualizacion/proyectos/{id}         # Actualizar proyecto
DELETE /api/actualizacion/proyectos/{id}         # Eliminar proyecto
```

### GDB y Geometrías
```
POST   /api/gdb/upload                           # Subir archivo GDB
GET    /api/gdb/geometrias/{municipio}           # Obtener geometrías
POST   /api/gdb/sincronizar-areas-predios        # Sincronizar áreas
GET    /api/predios/codigo/{npn}/geometria       # Geometría de un predio
```

### Predios Actualización
```
GET    /api/actualizacion/proyectos/{id}/predios       # Predios del proyecto
POST   /api/actualizacion/propuestas/{id}/aprobar      # Aprobar propuesta
POST   /api/actualizacion/propuestas/aprobar-masivo    # Aprobación masiva
```

## Modelo de Datos

### Proyecto de Actualización
```javascript
{
  id: String,
  nombre: String,
  municipio: String,
  codigo_municipio: String,
  descripcion: String,
  fecha_inicio: String,
  fecha_fin_estimada: String,
  estado: String,  // planificacion, ejecucion, revision, etc.
  equipo: [{
    user_id: String,
    rol: String,
    fecha_asignacion: String
  }],
  etapas: [{
    nombre: String,
    fecha_inicio: String,
    fecha_fin: String,
    completada: Boolean
  }],
  estadisticas: {
    total_predios: Number,
    predios_actualizados: Number,
    predios_pendientes: Number
  },
  created_at: String,
  updated_at: String
}
```

### Geometría GDB
```javascript
{
  id: String,
  codigo: String,           // NPN o código homologado
  municipio: String,
  tipo: String,             // terreno, construccion, unidad
  geometry: {
    type: "Polygon",        // GeoJSON
    coordinates: [[[lng, lat], ...]]
  },
  propiedades: {
    area_gis: Number,
    perimetro: Number,
    centroide: [lng, lat]
  },
  proyecto_id: String,
  sincronizado: Boolean,
  created_at: String
}
```

### Predio Actualización
```javascript
{
  // Hereda campos de Predio base
  proyecto_id: String,
  estado_actualizacion: String,  // pendiente, en_proceso, actualizado
  cambios_propuestos: [{
    campo: String,
    valor_anterior: Any,
    valor_nuevo: Any,
    fecha_propuesta: String,
    propuesto_por: String
  }],
  geometria_id: String,
  area_gis: Number,
  diferencia_area: Number
}
```

## Procesamiento de GDB

### Transformación de Coordenadas
```python
# El sistema convierte de la proyección local a WGS84
from pyproj import Transformer

transformer = Transformer.from_crs(
    "EPSG:3116",  # MAGNA-SIRGAS Colombia
    "EPSG:4326",  # WGS84 (Leaflet)
    always_xy=True
)

# Convertir coordenadas
lng, lat = transformer.transform(x, y)
```

### Extracción de Geometrías
```python
import fiona
from shapely.geometry import shape, mapping

# Abrir geodatabase
with fiona.open(gdb_path, layer='R_TERRENO') as layer:
    for feature in layer:
        geom = shape(feature['geometry'])
        props = feature['properties']
        
        # Transformar a WGS84
        geom_wgs84 = transform(transformer.transform, geom)
        
        # Guardar en MongoDB
        db.gdb_geometrias.insert_one({
            'codigo': props['CODIGO'],
            'geometry': mapping(geom_wgs84),
            ...
        })
```

## Sincronización de Áreas

### Proceso
1. Comparar área registrada vs área GIS
2. Identificar diferencias significativas (>5%)
3. Generar propuesta de actualización
4. Aprobar cambios individuales o masivos

### Cálculo de Diferencia
```javascript
diferencia_porcentual = ((area_gis - area_registrada) / area_registrada) * 100

// Clasificación
if (abs(diferencia) < 5) → "Aceptable"
if (abs(diferencia) < 10) → "Revisar"
if (abs(diferencia) >= 10) → "Crítico"
```

## Integración con Leaflet

### Inicialización del Mapa
```javascript
const map = L.map('map').setView([8.0, -73.0], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
}).addTo(map);
```

### Cargar Geometrías
```javascript
const loadGeometrias = async (municipio) => {
  const response = await axios.get(`/api/gdb/geometrias/${municipio}`);
  const geojson = L.geoJSON(response.data, {
    style: feature => ({
      color: '#3388ff',
      weight: 2,
      fillOpacity: 0.2
    }),
    onEachFeature: (feature, layer) => {
      layer.bindPopup(`
        <b>NPN:</b> ${feature.properties.codigo}<br>
        <b>Área:</b> ${feature.properties.area_gis} m²
      `);
    }
  });
  geojson.addTo(map);
};
```

## Permisos Requeridos

| Acción | Permiso |
|--------|---------|
| Ver proyectos | `view_proyectos_actualizacion` |
| Crear proyectos | `create_proyectos_actualizacion` |
| Subir GDB | `upload_gdb` |
| Ver geometrías | `view_geometrias` |
| Aprobar cambios | `approve_changes` |

## Archivos Relacionados

### Backend
- `server.py`: Endpoints de actualización (líneas 20000-22000)
- `scripts/process_gdb.py`: Procesador de geodatabases

### Frontend
- `pages/ProyectosActualizacion.js`: Gestión de proyectos
- `pages/GestionPrediosActualizacion.js`: Predios del proyecto
- `pages/VisorPredios.js`: Visor de mapas

### Librerías
- `fiona`: Lectura de archivos GDB
- `shapely`: Operaciones geométricas
- `pyproj`: Transformación de coordenadas
- `leaflet`: Visualización de mapas
