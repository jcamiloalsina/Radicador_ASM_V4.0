# Módulo de Conservación

## Descripción
El módulo de Conservación es el núcleo del sistema catastral. Gestiona el mantenimiento y actualización del catastro existente, incluyendo todas las mutaciones (cambios) que afectan a los predios.

## Componentes

### 1. Gestión de Predios
**Archivo**: `frontend/src/pages/Predios.js`

#### Funcionalidades
- Listado de predios con filtros por municipio/vigencia
- Búsqueda por NPN, matrícula, propietario
- Visualización detallada de cada predio
- Edición de datos (con permisos)
- Historial de cambios del predio

#### Estados de un Predio
```
activo ─────► pendiente_eliminacion ─────► eliminado
    │
    └──────► modificado (cambios pendientes de aprobar)
```

### 2. Mutaciones M1 - Cambio de Propietario
**Archivo**: `frontend/src/pages/MutacionesResoluciones.js`

#### Flujo
```
1. Seleccionar predio existente
2. Identificar propietario(s) saliente(s)
3. Ingresar datos del nuevo propietario
4. Adjuntar documentos (escritura, paz y salvo)
5. Generar resolución PDF
6. Actualizar datos en el predio
```

#### Campos que cambian
- `propietarios[]`
- `matricula_inmobiliaria` (si aplica)
- `historial_resoluciones[]`

### 3. Mutaciones M2 - Englobe/Desenglobe
**Archivo**: `frontend/src/pages/MutacionesResoluciones.js`

#### Subtipos
| Subtipo | Descripción |
|---------|-------------|
| Englobe | Fusión de 2+ predios en uno |
| Desenglobe Total | División completa de un predio |
| Desenglobe Parcial | Segregación de área de un predio |

#### Flujo Desenglobe
```
1. Seleccionar predio matriz (a cancelar)
2. Definir tipo: total o parcial
3. Si total: cargar datos de predios resultantes (manual o Excel)
4. Si parcial: definir nueva área del predio matriz
5. Asignar NPNs a predios nuevos
6. Generar resolución PDF
7. Crear predios nuevos / Cancelar predio matriz
```

#### Carga Masiva (Excel R1/R2)
Permite importar múltiples predios desde Excel con formato estándar:

**Hoja R1** (Datos básicos):
- CODIGO_PREDIAL_NACIONAL
- CODIGO_HOMOLOGADO
- AREA_TERRENO
- AREA_CONSTRUIDA
- DESTINO_ECONOMICO

**Hoja R2** (Propietarios):
- CODIGO_PREDIAL_NACIONAL
- MATRICULA_INMOBILIARIA
- NOMBRE_PROPIETARIO
- TIPO_DOCUMENTO
- NUMERO_DOCUMENTO

### 4. Generación de Resoluciones PDF

#### Resolución M1
**Archivo**: `backend/resolucion_pdf_generator.py`

Contenido:
- Encabezado institucional
- Número de resolución (formato: RES-DEPTO-MUN-NNNN-AÑO)
- Fecha de expedición
- Considerandos legales
- Artículos resolutivos
- Tabla de predio(s) cancelado(s)
- Tabla de predio(s) inscrito(s)
- Código QR de verificación
- Firmas digitales

#### Resolución M2
**Archivo**: `backend/resolucion_m2_pdf_generator.py`

Características adicionales:
- Tabla comparativa antes/después
- Detalle de áreas segregadas
- Linderos (si aplica)

### 5. Certificados Catastrales
**Archivo**: `backend/certificado_images.py`

Tipos:
- Certificado de cabida y linderos
- Certificado de tradición
- Certificado de libertad

Incluye:
- Código QR verificable
- Vigencia de 30 días
- Número único de verificación

## API Endpoints

### Predios
```
GET    /api/predios                      # Listar predios
GET    /api/predios/{id}                 # Obtener predio
POST   /api/predios                      # Crear predio
PUT    /api/predios/{id}                 # Actualizar predio
DELETE /api/predios/{id}                 # Eliminar predio
GET    /api/predios/search               # Buscar predios
POST   /api/predios/proponer-cambio      # Proponer cambio (workflow)
```

### Resoluciones
```
POST   /api/resoluciones/generar-m1      # Generar resolución M1
POST   /api/resoluciones/generar-m2      # Generar resolución M2
GET    /api/resoluciones/historial       # Historial de resoluciones
GET    /api/resoluciones/{id}/pdf        # Descargar PDF
POST   /api/resoluciones/verificar       # Verificar código QR
```

### Mutaciones
```
POST   /api/mutaciones/desenglobe-masivo/procesar-excel  # Carga masiva
GET    /api/mutaciones/desenglobe-masivo/plantilla       # Descargar plantilla
POST   /api/solicitudes-mutacion                          # Crear solicitud
GET    /api/solicitudes-mutacion/pendientes-aprobacion   # Listar pendientes
POST   /api/solicitudes-mutacion/{id}/accion             # Aprobar/Rechazar
```

## Modelo de Datos

### Predio
```javascript
{
  id: String,
  codigo_predial_nacional: String(30),  // NPN único
  codigo_homologado: String,
  municipio: String,
  vigencia: Number,
  direccion: String,
  destino_economico: String,  // H, C, I, A, etc.
  area_terreno: Number,
  area_construida: Number,
  avaluo: Number,
  matricula_inmobiliaria: String,
  propietarios: [{
    nombre_propietario: String,
    tipo_documento: String,  // C, E, N, T, P, X
    numero_documento: String,
    estado_civil: String,    // S, E, D, V, U
    tipo_propietario: String, // titular, copropietario, etc.
    porcentaje_propiedad: Number,
    tipo_persona: String     // natural, juridica
  }],
  r2_registros: [{
    matricula_inmobiliaria: String,
    zonas: [{
      zona_fisica: String,
      zona_economica: String,
      area_terreno: Number,
      area_construida: Number,
      construcciones: [...]
    }]
  }],
  tiene_geometria: Boolean,
  historial_resoluciones: [{
    tipo_mutacion: String,
    numero_resolucion: String,
    fecha_resolucion: String,
    accion: String
  }],
  deleted: Boolean,
  pendiente_eliminacion: Boolean
}
```

### Resolución
```javascript
{
  id: String,
  numero_resolucion: String,  // RES-54-003-0001-2026
  fecha_resolucion: String,
  año: Number,
  tipo_mutacion: String,      // M1, M2
  subtipo: String,            // englobe, desenglobe_total, etc.
  municipio: String,
  codigo_municipio: String,
  radicado: String,
  solicitante: {
    nombre: String,
    documento: String,
    telefono: String
  },
  predios_cancelados: [...],
  predios_inscritos: [...],
  pdf_path: String,
  codigo_verificacion: String,
  generado_por: String,
  generado_por_nombre: String,
  created_at: String
}
```

## Reglas de Negocio

### Validación de NPN
- Debe tener exactamente 30 caracteres
- No puede existir otro predio activo con el mismo NPN
- No puede reutilizarse un NPN de predio eliminado

### Numeración de Resoluciones
Formato: `RES-{DEPTO}-{MUN}-{NNNN}-{AÑO}`
- DEPTO: Código departamento (2 dígitos)
- MUN: Código municipio (3 dígitos)
- NNNN: Consecutivo del año (4 dígitos)
- AÑO: Año actual (4 dígitos)

### Cancelación de Predios
- Solo se pueden cancelar predios activos
- Se marca como `pendiente_eliminacion: true`
- El predio desaparece de Gestión pero queda en historial
- La resolución queda vinculada al predio

## Permisos Requeridos

| Acción | Permiso |
|--------|---------|
| Ver predios | `view_predios` |
| Editar predios | `edit_predios` |
| Eliminar predios | `delete_predios` |
| Proponer cambios | `proponer_cambios` |
| Aprobar cambios | `approve_changes` |
| Generar resoluciones | `generate_resolutions` |
| Ver historial | `view_history` |

## Archivos Relacionados

### Backend
- `server.py`: Endpoints principales (líneas 5900-15000)
- `resolucion_pdf_generator.py`: Generador PDF M1
- `resolucion_m2_pdf_generator.py`: Generador PDF M2
- `migrations.py`: Migraciones de datos

### Frontend
- `pages/Predios.js`: Gestión de predios
- `pages/MutacionesResoluciones.js`: Mutaciones M1/M2
- `pages/VisorPredios.js`: Visor de geometrías
- `components/NuevoPredioModal.js`: Modal crear predio
