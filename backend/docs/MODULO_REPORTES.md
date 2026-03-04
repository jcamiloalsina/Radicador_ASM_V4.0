# Módulo de Reportes y Estadísticas

## Descripción
El módulo de Reportes proporciona dashboards, estadísticas y análisis de datos del sistema catastral. Permite visualizar KPIs, productividad y generar reportes exportables.

## Componentes

### 1. Dashboard Principal
**Archivo**: `frontend/src/pages/DashboardHome.js`

#### KPIs Mostrados
- Total de predios por municipio
- Trámites pendientes/completados
- Resoluciones generadas (mes/año)
- Usuarios activos
- Alertas y notificaciones

### 2. Estadísticas Unificadas
**Archivo**: `frontend/src/pages/EstadisticasUnificadas.js`

#### Métricas
- Predios por vigencia
- Predios por destino económico
- Distribución de avalúos
- Comparativo mensual
- Tendencias

### 3. Reportes de Productividad
**Archivo**: `frontend/src/pages/ProductivityReports.js`

#### Métricas por Gestor
- Trámites procesados
- Tiempo promedio de respuesta
- Resoluciones generadas
- Certificados emitidos

## Dashboard Principal

### Widgets

```javascript
// Estructura del dashboard
const dashboardWidgets = [
  {
    id: 'predios_total',
    titulo: 'Total Predios',
    tipo: 'number',
    endpoint: '/api/stats/predios/total',
    icono: 'Building'
  },
  {
    id: 'tramites_pendientes',
    titulo: 'Trámites Pendientes',
    tipo: 'number',
    endpoint: '/api/stats/petitions/pending',
    icono: 'Clock',
    alerta: true  // Muestra en rojo si > 0
  },
  {
    id: 'resoluciones_mes',
    titulo: 'Resoluciones del Mes',
    tipo: 'number',
    endpoint: '/api/stats/resoluciones/mes',
    icono: 'FileText'
  },
  {
    id: 'chart_predios_municipio',
    titulo: 'Predios por Municipio',
    tipo: 'bar_chart',
    endpoint: '/api/stats/predios/by-municipio',
  },
  {
    id: 'chart_tramites_estado',
    titulo: 'Trámites por Estado',
    tipo: 'pie_chart',
    endpoint: '/api/stats/petitions/by-estado',
  }
];
```

### Gráficos Disponibles

| Tipo | Librería | Uso |
|------|----------|-----|
| Barras | Recharts | Comparativos por categoría |
| Líneas | Recharts | Tendencias temporales |
| Pie/Dona | Recharts | Distribuciones porcentuales |
| Área | Recharts | Acumulados en el tiempo |

## API Endpoints

### Estadísticas Generales
```
GET    /api/stats/overview                # Resumen general
GET    /api/stats/predios/total           # Total predios
GET    /api/stats/predios/by-municipio    # Predios por municipio
GET    /api/stats/predios/by-vigencia     # Predios por vigencia
GET    /api/stats/predios/by-destino      # Por destino económico
```

### Estadísticas de Trámites
```
GET    /api/stats/petitions/total         # Total trámites
GET    /api/stats/petitions/pending       # Pendientes
GET    /api/stats/petitions/by-estado     # Por estado
GET    /api/stats/petitions/by-tipo       # Por tipo
GET    /api/stats/petitions/by-month      # Por mes
```

### Estadísticas de Resoluciones
```
GET    /api/stats/resoluciones/total      # Total resoluciones
GET    /api/stats/resoluciones/mes        # Del mes actual
GET    /api/stats/resoluciones/by-tipo    # Por tipo (M1, M2)
GET    /api/stats/resoluciones/by-month   # Por mes
```

### Productividad
```
GET    /api/reports/productivity          # General
GET    /api/reports/productivity/user/{id} # Por usuario
GET    /api/reports/productivity/team     # Por equipo
GET    /api/reports/productivity/ranking  # Ranking de gestores
```

### Exportación
```
GET    /api/reports/export/predios        # Exportar predios (Excel)
GET    /api/reports/export/petitions      # Exportar trámites
GET    /api/reports/export/resoluciones   # Exportar resoluciones
GET    /api/reports/export/productivity   # Exportar productividad
```

## Modelo de Datos

### Estadística Cacheada
```javascript
{
  id: String,
  tipo: String,              // predios_total, petitions_pending, etc.
  municipio: String,         // null para global
  vigencia: Number,          // null para todas
  valor: Number,
  desglose: [{
    categoria: String,
    valor: Number
  }],
  calculado_at: String,      // Timestamp del cálculo
  expira_at: String          // Cuándo recalcular
}
```

### Reporte de Productividad
```javascript
{
  id: String,
  user_id: String,
  periodo: {
    inicio: String,
    fin: String
  },
  metricas: {
    tramites_procesados: Number,
    tramites_aprobados: Number,
    tramites_rechazados: Number,
    tiempo_promedio_respuesta: Number,  // En horas
    resoluciones_generadas: Number,
    certificados_emitidos: Number,
    predios_actualizados: Number
  },
  ranking: {
    posicion: Number,
    total_usuarios: Number
  },
  comparativo_anterior: {
    tramites: Number,         // +/- porcentaje
    tiempo_respuesta: Number
  },
  generado_at: String
}
```

## Cálculos y Agregaciones

### Predios por Municipio
```python
async def get_predios_by_municipio():
    pipeline = [
        {"$match": {"deleted": {"$ne": True}}},
        {"$group": {
            "_id": "$municipio",
            "total": {"$sum": 1},
            "area_total": {"$sum": "$area_terreno"},
            "avaluo_total": {"$sum": "$avaluo"}
        }},
        {"$sort": {"total": -1}}
    ]
    
    result = await db.predios.aggregate(pipeline).to_list(100)
    return result
```

### Trámites por Estado y Mes
```python
async def get_petitions_stats():
    pipeline = [
        {"$group": {
            "_id": {
                "estado": "$estado",
                "mes": {"$month": {"$toDate": "$created_at"}}
            },
            "total": {"$sum": 1}
        }},
        {"$sort": {"_id.mes": 1}}
    ]
    
    result = await db.petitions.aggregate(pipeline).to_list(100)
    return result
```

### Productividad por Usuario
```python
async def get_user_productivity(user_id: str, periodo: dict):
    # Trámites procesados
    tramites = await db.petitions.count_documents({
        "gestores_asignados.user_id": user_id,
        "estado": {"$in": ["aprobado", "rechazado", "finalizado"]},
        "fecha_respuesta": {
            "$gte": periodo["inicio"],
            "$lte": periodo["fin"]
        }
    })
    
    # Resoluciones generadas
    resoluciones = await db.resoluciones.count_documents({
        "generado_por": user_id,
        "created_at": {
            "$gte": periodo["inicio"],
            "$lte": periodo["fin"]
        }
    })
    
    # Tiempo promedio de respuesta
    pipeline = [
        {"$match": {
            "gestores_asignados.user_id": user_id,
            "fecha_respuesta": {"$exists": True}
        }},
        {"$project": {
            "tiempo": {
                "$subtract": [
                    {"$toDate": "$fecha_respuesta"},
                    {"$toDate": "$fecha_radicacion"}
                ]
            }
        }},
        {"$group": {
            "_id": None,
            "promedio": {"$avg": "$tiempo"}
        }}
    ]
    
    tiempo_result = await db.petitions.aggregate(pipeline).to_list(1)
    tiempo_promedio = tiempo_result[0]["promedio"] if tiempo_result else 0
    
    return {
        "tramites_procesados": tramites,
        "resoluciones_generadas": resoluciones,
        "tiempo_promedio_horas": tiempo_promedio / (1000 * 60 * 60)
    }
```

## Exportación a Excel

### Estructura de Exportación
```python
import openpyxl
from io import BytesIO

async def exportar_predios(municipio: str = None, vigencia: int = None):
    # Crear workbook
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Predios"
    
    # Headers
    headers = [
        "NPN", "Código Homologado", "Municipio", "Vigencia",
        "Dirección", "Destino", "Área Terreno", "Área Construida",
        "Avalúo", "Propietario", "Documento", "Matrícula"
    ]
    ws.append(headers)
    
    # Aplicar estilos a headers
    for cell in ws[1]:
        cell.font = openpyxl.styles.Font(bold=True)
        cell.fill = openpyxl.styles.PatternFill("solid", fgColor="DDDDDD")
    
    # Query
    query = {"deleted": {"$ne": True}}
    if municipio:
        query["municipio"] = municipio
    if vigencia:
        query["vigencia"] = vigencia
    
    # Agregar datos
    async for predio in db.predios.find(query):
        propietario = predio.get("propietarios", [{}])[0]
        ws.append([
            predio.get("codigo_predial_nacional"),
            predio.get("codigo_homologado"),
            predio.get("municipio"),
            predio.get("vigencia"),
            predio.get("direccion"),
            predio.get("destino_economico"),
            predio.get("area_terreno"),
            predio.get("area_construida"),
            predio.get("avaluo"),
            propietario.get("nombre_propietario"),
            propietario.get("numero_documento"),
            predio.get("matricula_inmobiliaria")
        ])
    
    # Ajustar anchos de columna
    for column in ws.columns:
        max_length = max(len(str(cell.value or "")) for cell in column)
        ws.column_dimensions[column[0].column_letter].width = min(max_length + 2, 50)
    
    # Guardar en memoria
    output = BytesIO()
    wb.save(output)
    output.seek(0)
    
    return output
```

## Visualización en Frontend

### Componente de Gráfico
```javascript
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const PrediosPorMunicipioChart = () => {
  const [data, setData] = useState([]);
  
  useEffect(() => {
    const fetchData = async () => {
      const response = await axios.get('/api/stats/predios/by-municipio');
      setData(response.data);
    };
    fetchData();
  }, []);
  
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <XAxis dataKey="_id" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="total" fill="#3b82f6" />
      </BarChart>
    </ResponsiveContainer>
  );
};
```

### Tabla de Productividad
```javascript
const ProductivityTable = ({ data }) => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Gestor</TableHead>
        <TableHead>Trámites</TableHead>
        <TableHead>Resoluciones</TableHead>
        <TableHead>Tiempo Prom.</TableHead>
        <TableHead>Ranking</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {data.map(user => (
        <TableRow key={user.id}>
          <TableCell>{user.nombre}</TableCell>
          <TableCell>{user.metricas.tramites_procesados}</TableCell>
          <TableCell>{user.metricas.resoluciones_generadas}</TableCell>
          <TableCell>{user.metricas.tiempo_promedio_horas.toFixed(1)}h</TableCell>
          <TableCell>
            <Badge variant={user.ranking.posicion <= 3 ? 'success' : 'default'}>
              #{user.ranking.posicion}
            </Badge>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);
```

## Permisos Requeridos

| Acción | Permiso |
|--------|---------|
| Ver dashboard | `view_statistics` |
| Ver reportes detallados | `view_reports` |
| Ver productividad | `view_productivity` |
| Exportar datos | `export_reports` |
| Ver datos de otros usuarios | `view_all_statistics` |

## Archivos Relacionados

### Backend
- `server.py`: Endpoints de stats y reports (líneas 22000-24000)

### Frontend
- `pages/DashboardHome.js`: Dashboard principal
- `pages/EstadisticasUnificadas.js`: Estadísticas detalladas
- `pages/ProductivityReports.js`: Reportes de productividad
- `components/charts/`: Componentes de gráficos reutilizables
