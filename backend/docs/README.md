# Sistema de Gestión Catastral - Asomunicipios

## Documentación Técnica

### Índice
1. [Arquitectura General](#arquitectura-general)
2. [Módulos del Sistema](#módulos-del-sistema)
3. [Base de Datos](#base-de-datos)
4. [API REST](#api-rest)
5. [Frontend](#frontend)
6. [Seguridad](#seguridad)
7. [Despliegue](#despliegue)

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTE (Browser)                         │
│                     React + Tailwind + Shadcn                    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NGINX / Kubernetes                          │
│                    (Reverse Proxy + SSL)                         │
└─────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
┌──────────────────────────┐   ┌──────────────────────────┐
│   Frontend (Port 3000)   │   │   Backend (Port 8001)    │
│   - React 18             │   │   - FastAPI              │
│   - Dexie.js (offline)   │   │   - Motor (MongoDB)      │
│   - Leaflet.js (mapas)   │   │   - ReportLab (PDFs)     │
└──────────────────────────┘   └──────────────────────────┘
                                           │
                                           ▼
                    ┌──────────────────────────────────────┐
                    │         MongoDB 6.0                   │
                    │   - 42 colecciones                    │
                    │   - 234,385+ documentos               │
                    │   - 47 índices optimizados            │
                    └──────────────────────────────────────┘
```

### Estructura Backend Modular (v2.0)

```
/app/backend/
├── server.py                    # API principal (legacy monolítico)
├── app/                         # NUEVA estructura modular
│   ├── __init__.py
│   ├── main.py                  # Aplicación modular standalone
│   ├── core/                    # Configuración central
│   │   ├── config.py            # Settings, catálogos, constantes
│   │   ├── database.py          # Conexión MongoDB
│   │   └── security.py          # JWT, autenticación, permisos
│   ├── routers/                 # Endpoints organizados por dominio
│   │   ├── auth.py              # Login, registro, verificación
│   │   ├── users.py             # Gestión de usuarios
│   │   ├── admin.py             # Administración del sistema
│   │   └── catalogos.py         # Catálogos y health check
│   ├── services/                # Lógica de negocio
│   │   └── email_service.py     # Envío de correos
│   └── utils/                   # Utilidades compartidas
│       └── helpers.py           # Funciones de ayuda
└── models/
    └── schemas.py               # Modelos Pydantic
```

**Migración gradual:** Los routers modulares pueden importarse en `server.py`
para reemplazar endpoints uno a uno sin afectar la funcionalidad existente.

### Stack Tecnológico

| Capa | Tecnología | Versión |
|------|------------|---------|
| Frontend | React | 18.x |
| UI Components | Shadcn/UI | Latest |
| CSS | Tailwind CSS | 3.x |
| Backend | FastAPI | 0.104+ |
| Database | MongoDB | 6.0 |
| ORM/ODM | Motor (async) | 3.x |
| Auth | JWT (PyJWT) | 2.x |
| PDF Generation | ReportLab | 4.x |
| Maps | Leaflet.js | 1.9.x |
| Offline Storage | Dexie.js | 3.x |

---

## Módulos del Sistema

### 1. Módulo de Conservación
**Propósito**: Gestión del catastro existente y mutaciones.

**Funcionalidades**:
- Gestión de predios (CRUD)
- Mutaciones M1 (Cambio de propietario)
- Mutaciones M2 (Englobe/Desenglobe)
- Generación de resoluciones PDF
- Certificados catastrales
- Visor de predios con geometrías

**Archivos principales**:
- `frontend/src/pages/Predios.js` (6,356 líneas)
- `frontend/src/pages/MutacionesResoluciones.js` (4,731 líneas)
- `backend/resolucion_pdf_generator.py`
- `backend/resolucion_m2_pdf_generator.py`

### 2. Módulo de Actualización
**Propósito**: Proyectos de actualización catastral masiva.

**Funcionalidades**:
- Gestión de proyectos de actualización
- Importación de archivos GDB (geodatabase)
- Visor de geometrías con Leaflet
- Workflow de etapas del proyecto
- Sincronización de áreas y linderos

**Archivos principales**:
- `frontend/src/pages/ProyectosActualizacion.js`
- `frontend/src/pages/GestionPrediosActualizacion.js`
- `frontend/src/pages/VisorPredios.js`

### 3. Módulo de PQRS (Peticiones)
**Propósito**: Gestión de trámites ciudadanos.

**Funcionalidades**:
- Radicación de peticiones
- Asignación a gestores
- Seguimiento de estados
- Adjuntos y documentos
- Notificaciones automáticas

**Estados del workflow**:
```
radicado → asignado → en_proceso → revision → aprobado/rechazado → finalizado
```

**Archivos principales**:
- `frontend/src/pages/AllPetitions.js`
- `frontend/src/pages/MyPetitions.js`
- `frontend/src/pages/PetitionDetail.js`
- `frontend/src/pages/CreatePetition.js`

### 4. Módulo de Usuarios y Permisos
**Propósito**: Control de acceso y roles.

**Roles disponibles**:
| Rol | Descripción |
|-----|-------------|
| administrador | Acceso total al sistema |
| coordinador | Aprueba cambios y gestiona equipos |
| gestor | Realiza trabajo de campo y oficina |
| visor | Solo lectura |
| atencion_usuario | Gestión de PQRS |
| empresa | Acceso limitado para empresas |
| ciudadano | Portal ciudadano |

**Permisos granulares**:
- `view_predios`, `edit_predios`, `delete_predios`
- `approve_changes`, `generate_resolutions`
- `manage_users`, `view_reports`
- Y 20+ permisos adicionales

**Archivos principales**:
- `frontend/src/pages/PermissionsManagement.js`
- `frontend/src/pages/UsersManagement.js`

### 5. Módulo de Reportes
**Propósito**: Estadísticas y análisis.

**Reportes disponibles**:
- Dashboard general con KPIs
- Productividad por gestor
- Estado de trámites
- Predios por municipio/vigencia
- Exportación a Excel

**Archivos principales**:
- `frontend/src/pages/DashboardHome.js`
- `frontend/src/pages/EstadisticasUnificadas.js`
- `frontend/src/pages/ProductivityReports.js`

### 6. Módulo de Pendientes
**Propósito**: Workflow de aprobación.

**Funcionalidades**:
- Lista unificada de pendientes
- Aprobación de modificaciones
- Aprobación de predios nuevos
- Aprobación de mutaciones M1/M2
- Gestión de reapariciones
- Historial de acciones

**Archivos principales**:
- `frontend/src/pages/Pendientes.js` (3,054 líneas)

---

## Base de Datos

### Colecciones Principales

| Colección | Documentos | Descripción |
|-----------|------------|-------------|
| predios | 206,564 | Predios activos del catastro |
| predios_nuevos | 7 | Predios pendientes de aprobación |
| predios_eliminados | 2,204 | Predios eliminados (histórico) |
| users | 65 | Usuarios del sistema |
| petitions | 5,487 | Trámites PQRS |
| resoluciones | 37 | Resoluciones generadas |
| notifications | 246 | Notificaciones de usuarios |
| cambios_pendientes | 37 | Cambios esperando aprobación |
| gdb_geometrias | 19,688 | Geometrías de predios |
| certificados | 49 | Certificados catastrales |

### Esquema Principal: Predio

```javascript
{
  "id": "uuid",
  "codigo_predial_nacional": "540030001000000010001000000000", // 30 chars
  "codigo_homologado": "00001",
  "municipio": "Sardinata",
  "vigencia": 2026,
  "direccion": "Calle 1 # 2-3",
  "destino_economico": "H", // Habitacional
  "area_terreno": 1500.50,
  "area_construida": 120.00,
  "avaluo": 50000000,
  "matricula_inmobiliaria": "270-12345",
  "propietarios": [{
    "nombre_propietario": "Juan Pérez",
    "tipo_documento": "C", // C=Cédula, E=Extranjería, N=NIT
    "numero_documento": "12345678",
    "estado_civil": "S", // S=Soltero, E=Casado, D=Divorciado
    "tipo_propietario": "titular", // titular, copropietario, usufructuario
    "porcentaje_propiedad": 100,
    "tipo_persona": "natural" // natural, juridica, sucesion_iliquida
  }],
  "r2_registros": [{
    "matricula_inmobiliaria": "270-12345",
    "zonas": [{
      "zona_fisica": "U",
      "zona_economica": "01",
      "area_terreno": 1500.50,
      "area_construida": 120.00
    }]
  }],
  "tiene_geometria": true,
  "historial_resoluciones": [],
  "deleted": false,
  "pendiente_eliminacion": false,
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-03-04T00:00:00Z"
}
```

### Índices Optimizados

```javascript
// users
db.users.createIndex({ "email": 1 }, { unique: true })
db.users.createIndex({ "role": 1 })

// predios
db.predios.createIndex({ "codigo_predial_nacional": 1 })
db.predios.createIndex({ "municipio": 1 })
db.predios.createIndex({ "municipio": 1, "deleted": 1 })
db.predios.createIndex({ "municipio": 1, "vigencia": 1 })
db.predios.createIndex({ "codigo_homologado": 1 })
db.predios.createIndex({ "propietarios.numero_documento": 1 })

// petitions
db.petitions.createIndex({ "radicado": 1 }, { unique: true })
db.petitions.createIndex({ "estado": 1, "municipio": 1 })

// notifications
db.notifications.createIndex({ "user_id": 1, "leido": 1 })
```

---

## API REST

### Autenticación
Todas las rutas (excepto login/register) requieren JWT Bearer token.

```http
Authorization: Bearer <token>
```

### Endpoints Principales

#### Auth
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | /api/auth/login | Iniciar sesión |
| POST | /api/auth/register | Registrar usuario |
| POST | /api/auth/forgot-password | Recuperar contraseña |

#### Predios
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /api/predios | Listar predios |
| GET | /api/predios/{id} | Obtener predio |
| POST | /api/predios | Crear predio |
| PUT | /api/predios/{id} | Actualizar predio |
| DELETE | /api/predios/{id} | Eliminar predio |
| GET | /api/predios/search | Buscar predios |

#### Peticiones (PQRS)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /api/petitions | Listar peticiones |
| POST | /api/petitions | Crear petición |
| PATCH | /api/petitions/{id}/assign | Asignar gestor |
| PATCH | /api/petitions/{id}/status | Cambiar estado |

#### Resoluciones
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | /api/resoluciones/generar-m1 | Generar resolución M1 |
| POST | /api/resoluciones/generar-m2 | Generar resolución M2 |
| GET | /api/resoluciones/historial | Historial de resoluciones |

---

## Seguridad

### Autenticación JWT
- Secreto de 64 caracteres hexadecimales
- Tokens con expiración de 24 horas
- Refresh token automático

### MongoDB Authentication
- Usuario root para administración
- Usuario aplicación (app_user) con rol readWrite
- Conexión autenticada vía URI

### Schema Validation
Validaciones JSON Schema en:
- `predios`: NPN de 30 caracteres, municipio requerido
- `users`: email y role requeridos, role validado contra enum
- `petitions`: radicado y estado requeridos

### Backup Automatizado
- Cron diario a las 2:00 AM
- Retención de 7 días
- Almacenamiento en `/backups`

---

## Despliegue

### Docker Compose
```yaml
services:
  mongodb:    # Base de datos con autenticación
  backend:    # API FastAPI en puerto 8001
  frontend:   # React en puerto 80
  mongo-backup: # Backup automático diario
```

### Variables de Entorno
```bash
# Backend
MONGO_URL=mongodb://app_user:password@mongodb:27017/db?authSource=admin
JWT_SECRET=<64-char-hex>
SMTP_HOST=smtp.office365.com
SMTP_USER=catastro@asomunicipios.gov.co

# Frontend
REACT_APP_BACKEND_URL=https://api.domain.com
```

### Comandos Útiles
```bash
# Iniciar servicios
docker-compose up -d

# Ver logs
docker-compose logs -f backend

# Backup manual
docker-compose exec mongo-backup /backup-script.sh

# Reiniciar servicio
docker-compose restart backend
```

---

## Contacto y Soporte

**Desarrollado por**: Emergent Labs  
**Cliente**: Asomunicipios - Asociación de Municipios del Catatumbo  
**Fecha**: Marzo 2026
