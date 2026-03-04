# Módulo de PQRS (Peticiones)

## Descripción
El módulo de PQRS gestiona las Peticiones, Quejas, Reclamos y Sugerencias de los ciudadanos. Implementa un flujo de trabajo completo desde la radicación hasta la resolución del trámite.

## Componentes

### 1. Portal Ciudadano
**Archivo**: `frontend/src/pages/CreatePetition.js`

#### Funcionalidades
- Formulario de radicación en línea
- Carga de documentos adjuntos
- Generación de número de radicado
- Confirmación por correo electrónico
- Consulta de estado con radicado

### 2. Gestión de Peticiones (Interno)
**Archivo**: `frontend/src/pages/AllPetitions.js`

#### Funcionalidades
- Listado de todas las peticiones
- Filtros por estado, municipio, gestor
- Búsqueda por radicado o solicitante
- Asignación a gestores
- Cambio de estados
- Historial de acciones

### 3. Mis Peticiones (Gestor)
**Archivo**: `frontend/src/pages/MyPetitions.js`

#### Funcionalidades
- Peticiones asignadas al usuario
- Priorización por fecha límite
- Acciones rápidas
- Indicadores de vencimiento

### 4. Detalle de Petición
**Archivo**: `frontend/src/pages/PetitionDetail.js`

#### Funcionalidades
- Información completa del trámite
- Historial de cambios de estado
- Documentos adjuntos
- Comunicaciones con el ciudadano
- Vinculación con predios
- Generación de respuesta

## Flujo de Trabajo

```
                    ┌─────────────────┐
                    │    RADICADO     │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │    ASIGNADO     │◄──────────┐
                    └────────┬────────┘           │
                             │                    │
                             ▼                    │
                    ┌─────────────────┐           │
                    │   EN_PROCESO    │           │ (devuelto)
                    └────────┬────────┘           │
                             │                    │
                             ▼                    │
                    ┌─────────────────┐           │
                    │    REVISION     │───────────┘
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                              ▼
     ┌─────────────────┐            ┌─────────────────┐
     │    APROBADO     │            │   RECHAZADO     │
     └────────┬────────┘            └────────┬────────┘
              │                              │
              └──────────────┬───────────────┘
                             ▼
                    ┌─────────────────┐
                    │   FINALIZADO    │
                    └─────────────────┘
```

## Tipos de Trámites

| Código | Tipo | Tiempo Respuesta |
|--------|------|------------------|
| CERT | Certificado catastral | 5 días |
| REC | Reclamo de avalúo | 15 días |
| ACT | Actualización de datos | 10 días |
| MUT | Solicitud de mutación | 30 días |
| COR | Corrección de error | 15 días |
| INF | Solicitud de información | 10 días |
| QUE | Queja | 15 días |
| SUG | Sugerencia | 15 días |

## API Endpoints

### Peticiones
```
GET    /api/petitions                    # Listar peticiones
POST   /api/petitions                    # Crear petición
GET    /api/petitions/{id}               # Obtener petición
PUT    /api/petitions/{id}               # Actualizar petición
DELETE /api/petitions/{id}               # Eliminar petición
```

### Acciones
```
PATCH  /api/petitions/{id}/assign        # Asignar gestor(es)
PATCH  /api/petitions/{id}/status        # Cambiar estado
POST   /api/petitions/{id}/comment       # Agregar comentario
POST   /api/petitions/{id}/attachment    # Agregar adjunto
POST   /api/petitions/{id}/respond       # Enviar respuesta
```

### Consultas
```
GET    /api/petitions/my                 # Mis peticiones asignadas
GET    /api/petitions/stats              # Estadísticas
GET    /api/petitions/search             # Búsqueda avanzada
GET    /api/petitions/by-radicado/{rad}  # Buscar por radicado
```

## Modelo de Datos

### Petición
```javascript
{
  id: String,
  radicado: String,           // Único: PQR-2026-00001
  tipo: String,               // CERT, REC, ACT, MUT, etc.
  estado: String,             // radicado, asignado, en_proceso, etc.
  
  // Solicitante
  solicitante: {
    nombre: String,
    tipo_documento: String,
    numero_documento: String,
    email: String,
    telefono: String,
    direccion: String
  },
  
  // Contenido
  asunto: String,
  descripcion: String,
  municipio: String,
  predio_relacionado: String, // NPN si aplica
  
  // Asignación
  user_id: String,            // Creador
  gestores_asignados: [{
    user_id: String,
    nombre: String,
    fecha_asignacion: String,
    activo: Boolean
  }],
  
  // Fechas
  fecha_radicacion: String,
  fecha_limite: String,       // Calculada según tipo
  fecha_respuesta: String,
  
  // Documentos
  adjuntos: [{
    id: String,
    nombre: String,
    url: String,
    tipo: String,
    fecha: String,
    subido_por: String
  }],
  
  // Historial
  historial: [{
    accion: String,
    estado_anterior: String,
    estado_nuevo: String,
    usuario: String,
    fecha: String,
    observacion: String
  }],
  
  // Comunicaciones
  comunicaciones: [{
    tipo: String,           // email, sms, nota_interna
    contenido: String,
    fecha: String,
    enviado_por: String
  }],
  
  // Respuesta
  respuesta: {
    contenido: String,
    fecha: String,
    archivo_respuesta: String,
    enviada: Boolean
  },
  
  created_at: String,
  updated_at: String
}
```

## Generación de Radicado

### Formato
```
PQR-{AÑO}-{CONSECUTIVO}

Ejemplos:
- PQR-2026-00001
- PQR-2026-00002
```

### Lógica
```python
async def generar_radicado():
    año = datetime.now().year
    
    # Obtener último consecutivo del año
    ultima = await db.petitions.find_one(
        {"radicado": {"$regex": f"^PQR-{año}-"}},
        sort=[("radicado", -1)]
    )
    
    if ultima:
        ultimo_num = int(ultima["radicado"].split("-")[2])
        nuevo_num = ultimo_num + 1
    else:
        nuevo_num = 1
    
    return f"PQR-{año}-{nuevo_num:05d}"
```

## Notificaciones

### Eventos que generan notificación
| Evento | Destinatario |
|--------|--------------|
| Nueva petición | Coordinador |
| Asignación | Gestor asignado |
| Cambio de estado | Solicitante + Gestor |
| Documento adjunto | Gestor |
| Próximo a vencer | Gestor + Coordinador |
| Respuesta enviada | Solicitante |

### Canales
- **Email**: Notificaciones importantes
- **Sistema**: Badge en dashboard
- **SMS**: Opcional para ciudadanos

## Vencimientos

### Cálculo de Fecha Límite
```javascript
const calcularFechaLimite = (tipo, fechaRadicacion) => {
  const diasPorTipo = {
    'CERT': 5,
    'REC': 15,
    'ACT': 10,
    'MUT': 30,
    'COR': 15,
    'INF': 10,
    'QUE': 15,
    'SUG': 15
  };
  
  const dias = diasPorTipo[tipo] || 15;
  const fecha = new Date(fechaRadicacion);
  
  // Solo días hábiles (lunes a viernes)
  let diasAgregados = 0;
  while (diasAgregados < dias) {
    fecha.setDate(fecha.getDate() + 1);
    if (fecha.getDay() !== 0 && fecha.getDay() !== 6) {
      diasAgregados++;
    }
  }
  
  return fecha;
};
```

### Indicadores de Estado
```javascript
// Colores según días restantes
const getColorVencimiento = (fechaLimite) => {
  const hoy = new Date();
  const limite = new Date(fechaLimite);
  const diasRestantes = Math.ceil((limite - hoy) / (1000 * 60 * 60 * 24));
  
  if (diasRestantes < 0) return 'red';      // Vencido
  if (diasRestantes <= 2) return 'orange';  // Próximo a vencer
  if (diasRestantes <= 5) return 'yellow';  // Alerta
  return 'green';                           // En tiempo
};
```

## Permisos Requeridos

| Acción | Permiso |
|--------|---------|
| Ver todas las peticiones | `view_all_petitions` |
| Ver mis peticiones | `view_own_petitions` |
| Crear peticiones | `create_petitions` |
| Asignar gestores | `assign_petitions` |
| Cambiar estado | `edit_petitions` |
| Enviar respuesta | `respond_petitions` |
| Eliminar peticiones | `delete_petitions` |
| Ver estadísticas | `view_statistics` |

## Archivos Relacionados

### Backend
- `server.py`: Endpoints de peticiones (líneas 3000-5000)

### Frontend
- `pages/AllPetitions.js`: Listado general
- `pages/MyPetitions.js`: Peticiones del usuario
- `pages/PetitionDetail.js`: Detalle y acciones
- `pages/CreatePetition.js`: Formulario de creación

### Componentes
- `components/PetitionCard.js`: Tarjeta de petición
- `components/PetitionTimeline.js`: Historial visual
- `components/AttachmentUploader.js`: Carga de archivos
