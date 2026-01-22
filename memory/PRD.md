# Asomunicipios - Sistema de Gestión Catastral

## Descripción General
Sistema web para gestión catastral de la Asociación de Municipios del Catatumbo, Provincia de Ocaña y Sur del Cesar (Asomunicipios).

## Stack Tecnológico
- **Backend:** FastAPI (Python) + MongoDB
- **Frontend:** React + Tailwind CSS + shadcn/ui
- **Mapas:** Leaflet + react-leaflet
- **PDFs:** ReportLab
- **Excel:** openpyxl
- **PWA:** Service Worker + IndexedDB (modo offline)

## Roles de Usuario
1. `usuario` - Usuario externo (antes "ciudadano"), puede crear peticiones y dar seguimiento
2. `atencion_usuario` - Atiende peticiones iniciales
3. `gestor` - Gestiona peticiones y predios
4. `coordinador` - Aprueba cambios, gestiona permisos, ve histórico completo
5. `administrador` - Control total del sistema
6. `comunicaciones` - **Solo lectura**: puede consultar predios, ver visor, ver trámites

**Nota:** "Gestor Auxiliar" NO es un rol, sino una condición temporal.

## Funcionalidades Implementadas

### Gestión de Peticiones
- Crear peticiones con radicado único consecutivo (RASMCG-XXXX-DD-MM-YYYY)
- Subir archivos adjuntos
- Asignar a gestores
- Seguimiento de estados
- **Histórico de Trámites** con filtros avanzados y exportación Excel

### Gestión de Predios
- Dashboard por municipio
- Filtros: zona, destino económico, vigencia, geometría
- Visualización de datos R1/R2
- Importación de Excel R1/R2
- Creación de nuevos predios con código de 30 dígitos

### Sistema de Permisos Granulares
- **upload_gdb**: Subir archivos GDB
- **import_r1r2**: Importar archivos R1/R2
- **approve_changes**: Aprobar/Rechazar cambios

### Visor de Predios (Mapa)
- Visualización de geometrías GDB
- Vinculación automática predio-geometría
- Carga de archivos GDB/ZIP

### PWA - Modo Offline (NUEVO)
- ✅ Service Worker para caché de recursos
- ✅ IndexedDB para almacenamiento de predios offline
- ✅ Caché de tiles de mapa para uso sin conexión
- ✅ Indicador de estado de conexión
- ✅ Prompt de instalación como app
- ✅ Instalable en Android e iOS desde navegador

### Notificaciones por Correo
- Recuperación de contraseña
- Notificaciones de asignación de trámites
- Cambios de permisos
- **Remitente:** "Asomunicipios Catastro" (vía Gmail SMTP)

## Cambios Recientes

### Sesión 22 Enero 2026 - Flujo "Crear Predio" Completo
**Implementación del flujo de trabajo multi-etapa para creación de nuevos predios:**

#### Roles del Flujo:
- **Gestor (Creador):** Inicia el proceso de creación del predio
- **Gestor de Apoyo:** Responsable de completar la digitalización
- **Coordinador/Admin:** Revisa y aprueba/devuelve/rechaza

#### Estados del Flujo:
`creado` → `digitalizacion` → `revision` → `aprobado`/`devuelto`/`rechazado`

#### Funcionalidades Implementadas:

1. ✅ **Backend - Endpoints del Flujo:**
   - `POST /api/predios-nuevos` - Crea nuevo predio e inicia flujo
   - `GET /api/predios-nuevos` - Lista predios en proceso con filtros
   - `POST /api/predios-nuevos/{id}/accion` - Ejecuta acciones (enviar_revision, aprobar, devolver, rechazar)
   - `GET /api/predios-nuevos/buscar-radicado/{numero}` - Busca radicado por número
   - `GET /api/predios-nuevos/pendientes` - Predios pendientes por rol

2. ✅ **Frontend - Formulario "Crear Predio" Mejorado:**
   - Toggle "Usar flujo de trabajo con Gestor de Apoyo"
   - Dropdown de Gestor de Apoyo (obligatorio)
   - Input de Radicado: formato RASMGC-XXXX-DD-MM-AAAA (solo se ingresa XXXX)
   - Multi-select para vincular Peticiones relacionadas
   - Observaciones para el Gestor de Apoyo

3. ✅ **Nueva Página "Predios en Proceso" (/dashboard/predios-en-proceso):**
   - Cards con estadísticas por estado
   - Filtro por estado del flujo
   - Lista de predios con acciones según rol y estado
   - Vista de detalle con tabs (General, Propietario, Historial)
   - Diálogos para confirmar acciones

4. ✅ **Integración y Trazabilidad:**
   - Historial completo de acciones
   - Notificaciones a participantes del flujo
   - Predios aprobados se mueven a colección principal automáticamente

**Bug Fix:** Corregido TypeError en `generate_codigo_homologado()` - numero_predio almacenado como string
**Testing:** 18/18 tests passed (iteration_14.json)

### Sesión 20 Enero 2026 - Fork
**Corrección de 3 bugs en módulo de Actualización:**

1. ✅ **Bug Fix #1 - UI de carga GDB:**
   - Corregido: El indicador de Base Gráfica en tarjetas de proyectos ahora usa `proyecto.gdb_procesado` en lugar de `proyecto.base_grafica_archivo`
   - Archivo: ProyectosActualizacion.js línea 657
   - Resultado: El indicador se muestra verde cuando el GDB está procesado

2. ✅ **Bug Fix #2 - Zoom del mapa no cambiaba a Google:**
   - Implementado componente `SmartTileLayer` en VisorActualizacion.js
   - El mapa cambia automáticamente de Esri a Google Satellite cuando zoom > 17
   - Muestra indicador "Zoom alto → Google Satellite" cuando está activo
   - Archivo: VisorActualizacion.js líneas 85-120

3. ✅ **Bug Fix #3 - Edición de predios no aparecía:**
   - Modificada función `onEachFeature` para abrir modal incluso sin datos R1/R2
   - Crea objeto `predioBasico` desde propiedades de la geometría cuando no hay datos R1/R2
   - Archivo: VisorActualizacion.js líneas 454-500
   - El modal de detalle/edición ahora se abre siempre al hacer clic en un predio

**Testing:** Verificado con testing_agent - 100% de bugs corregidos (iteration_10.json)

### Sesión 20 Enero 2026 - Implementación Formato de Visita
**Nuevas funcionalidades implementadas:**

1. ✅ **Permiso acceso_actualizacion para Gestores:**
   - Nuevo permiso `ACCESO_ACTUALIZACION` en backend (server.py línea 167)
   - Visible en "Gestión de Permisos" como "Acceso a Actualización"
   - Gestores requieren este permiso para acceder al módulo de Actualización
   - Admin y Coordinador tienen acceso por defecto

2. ✅ **Corrección vinculación R1/R2 con GDB:**
   - Problema: El Excel tenía `CODIGO_PREDIAL_NACIONAL` pero el código buscaba `CODIGO_PREDIAL`
   - Solución: Agregados mapeos de columnas faltantes en `procesar_r1r2_actualizacion()`
   - Reprocesado Excel de Sardinata: **3,225 predios únicos** con propietarios agrupados
   - Visor ahora muestra "Pendientes: 3225" correctamente

3. ✅ **Formato de Visita de Campo completo:**
   - Modal dedicado con formulario estructurado
   - Campos: Fecha/hora, persona que atiende, relación con predio
   - Estado del predio: Habitado, deshabitado, en construcción, abandonado, etc.
   - Servicios públicos: Checkboxes (Agua, Alcantarillado, Energía, Gas, Internet, Teléfono)
   - **Captura de fotos:** Input con `capture="environment"` para cámara del dispositivo
   - **Firma digital:** Canvas HTML5 con eventos touch para dispositivos móviles
   - GPS: Registra ubicación automáticamente si está activo
   - Botón "Limpiar firma" para borrar y volver a firmar

**Testing:** Verificado con testing_agent - 100% (8/8 features) (iteration_11.json)

### Sesión 20 Enero 2026 - Modal de Edición Igual que Conservación
**Nueva funcionalidad:**

1. ✅ **Modal de edición con 3 tabs (igual que Conservación):**
   - Tab **Propietarios:** Permite agregar/eliminar múltiples propietarios con:
     - Nombre Completo
     - Tipo Documento (C/E/N/T/P)
     - Número Documento
     - Estado Civil
   - Tab **Predio:** Información general editable:
     - Dirección
     - Destino Económico
     - Matrícula Inmobiliaria
     - Área Terreno / Área Construida
     - Avalúo Catastral
     - Estrato
     - Observaciones de Campo
   - Tab **Zonas Físicas (R2):** Permite agregar/eliminar múltiples zonas:
     - Zona Física / Zona Económica
     - Área Terreno / Área Construida
     - Habitaciones / Baños / Locales
     - Pisos / Puntaje

2. ✅ **Funciones de gestión:**
   - `cargarDatosParaEdicion()`: Carga propietarios y zonas existentes
   - `agregarPropietario()` / `eliminarPropietario()` / `actualizarPropietario()`
   - `agregarZonaFisica()` / `eliminarZonaFisica()` / `actualizarZonaFisica()`
   - `handleSaveChanges()`: Guarda propietarios y zonas_fisicas al backend

**Testing:** Verificado con testing_agent - 100% (6/6 features) (iteration_12.json)

### Sesión 20 Enero 2026 - Sistema de Propuestas de Cambio e Historial
**Implementación del flujo completo de trabajo de campo:**

1. ✅ **Sistema de Propuestas de Cambio:**
   - Solo disponible cuando el predio está VISITADO
   - Vista comparativa "Datos Existentes" vs "Propuesta de Cambio"
   - Estados: pendiente, aprobada, rechazada
   - Requiere justificación obligatoria
   - Endpoints: POST propuesta, GET propuestas, PATCH aprobar/rechazar

2. ✅ **Aprobación por Coordinador:**
   - Nueva página `GestionPropuestas.js` para coordinadores/admins
   - Aprobación individual con comentario
   - Aprobación masiva (checkbox múltiple)
   - Rechazo requiere comentario obligatorio
   - Al aprobar, los cambios se aplican automáticamente al predio

3. ✅ **Historial de Cambios:**
   - Registro automático de: visitas, actualizaciones, propuestas creadas/aprobadas/rechazadas
   - Almacena: fecha, usuario, acción, campos modificados
   - Visible en tab "Historial" del modal de predio

4. ✅ **Generación de PDF:**
   - Endpoint POST /generar-pdf
   - Formato basado en FO-FAC-PC01-02
   - Incluye: encabezado ASOMUNICIPIOS, información básica, propietarios, datos de visita, firmas, GPS
   - Descarga automática al generar

5. ✅ **Tabs adicionales en modal de predio:**
   - 6 tabs totales: General, Propietarios, Físico, Campo, Propuestas, Historial
   - Botón "Generar PDF" visible solo si está visitado
   - Botón "Nueva Propuesta" visible solo si está visitado

**Archivos creados/modificados:**
- `/app/frontend/src/pages/GestionPropuestas.js` (NUEVO)
- `/app/frontend/src/pages/VisorActualizacion.js` (MODIFICADO)
- `/app/backend/server.py` (MODIFICADO - endpoints de propuestas)
- `/app/frontend/src/App.js` (MODIFICADO - ruta)
- `/app/frontend/src/pages/DashboardLayout.js` (MODIFICADO - menú)

### Sesión 20 Enero 2026 - Fix Bug "Reaparecidos" Lista Vacía
**Bug corregido:**

El dashboard de Conservación mostraba un badge de "1 reaparecido" para San Calixto, pero al hacer clic la lista de pendientes estaba vacía.

**Causa raíz:** El decorador de ruta `@api_router.get("/predios/reapariciones/pendientes")` estaba **FALTANDO** en la función `get_reapariciones_pendientes()`. El endpoint nunca se registró en FastAPI.

**Solución aplicada:** Agregado el decorador faltante en `server.py` línea 5097.

**Verificación:**
- API `GET /api/predios/reapariciones/conteo-por-municipio` → `{"San Calixto": 1}`
- API `GET /api/predios/reapariciones/pendientes?municipio=San%20Calixto` → 1 reaparición encontrada
- Código del predio reaparecido: `546700100000000250001000000000` (eliminado vig 2024, reaparece vig 2026)

**Archivo modificado:** `/app/backend/server.py` línea 5097

---

### Sesión 20 Enero 2026 - Ortofoto, Auto-Zoom y GPS Mejorado (Módulo Actualización)
**Nuevas funcionalidades implementadas:**

1. ✅ **Carga de Ortofoto:**
   - Endpoint para subir ortofotos (TIFF, PNG, JPG)
   - Extracción automática de bounds de archivos GeoTIFF
   - Panel de control con slider de opacidad
   - Botón para mostrar/ocultar ortofoto
   - Se muestra debajo de la GDB pero encima del mapa base

2. ✅ **Auto-Zoom a Capa GDB:**
   - Al cargar las geometrías, el mapa navega automáticamente a los bounds
   - Botón de navegación (icono brújula verde) para volver a centrar
   - Toast de confirmación "Vista ajustada a las geometrías"

3. ✅ **GPS Mejorado para Tablets:**
   - Verificación de permisos antes de activar
   - Posición inicial rápida (menos precisa) mientras se obtiene la precisa
   - Timeout aumentado a 30 segundos
   - Mensajes de error específicos por tipo de problema
   - Tolerancia para conexiones intermitentes

**Nuevos Endpoints:**
- `POST /api/actualizacion/proyectos/{id}/ortofoto` - Subir ortofoto
- `GET /api/actualizacion/proyectos/{id}/ortofoto` - Info de ortofoto
- `GET /api/actualizacion/proyectos/{id}/ortofoto/file` - Servir archivo

**Archivos Modificados:**
- `/app/frontend/src/pages/VisorActualizacion.js`
- `/app/backend/server.py`

---

### Sesión 20 Enero 2026 - Sistema de Propuestas con Vista Comparativa (Módulo Actualización)
**Nueva funcionalidad implementada:**

Sistema completo de gestión de propuestas de cambio para trabajo de campo con vista comparativa "Antes vs Después":

1. ✅ **Vista Comparativa en Gestión de Propuestas:**
   - Diseño tipo diff mostrando TODOS los campos
   - Columna izquierda: Datos anteriores (del R1/R2)
   - Columna derecha: Datos propuestos (del gestor)
   - Indicador visual de campos modificados vs sin cambios
   - Campos: Dirección, Destino económico, Áreas, Avalúo, Matrícula, Estrato, Propietarios

2. ✅ **Flujo de Propuestas:**
   - Gestor crea propuesta tras visitar el predio
   - Se guarda snapshot completo de datos existentes
   - Coordinador revisa con vista comparativa clara
   - Opciones: Aprobar | Editar y aprobar | Rechazar

3. ✅ **Edición por Coordinador:**
   - Coordinador puede modificar datos antes de aprobar
   - Formulario de edición inline activable
   - Los cambios del coordinador se aplican al aprobar

4. ✅ **Subsanación de Propuestas Rechazadas:**
   - Al rechazar, se envía a subsanación del gestor
   - Gestor recibe notificación por correo
   - Máximo 3 intentos de subsanación
   - Historial completo de revisiones

5. ✅ **Aprobación Masiva:**
   - Checkbox para selección múltiple
   - Botón "Aprobar Masivo" con conteo
   - Ideal para revisión rápida de muchos predios

6. ✅ **Filtros de Estado:**
   - Pendientes (incluye reenviadas)
   - Aprobadas
   - Rechazadas
   - En Subsanación

**Nuevos/Modificados Endpoints:**
- `POST /api/actualizacion/proyectos/{id}/predios/{codigo}/propuesta` (mejorado)
- `GET /api/actualizacion/proyectos/{id}/propuestas` (mejorado con filtros)
- `PATCH /api/actualizacion/propuestas/{id}/rechazar` (envía a subsanación)
- `PATCH /api/actualizacion/propuestas/{id}/subsanar`
- `GET /api/actualizacion/propuestas/subsanacion-pendiente`

**Archivos Modificados:**
- `/app/frontend/src/pages/GestionPropuestas.js` (reescrito completo)
- `/app/backend/server.py` (nuevos endpoints de subsanación)

---

### Sesión 20 Enero 2026 - Sistema de Subsanación de Reapariciones
**Nueva funcionalidad completa implementada:**

El sistema ahora soporta un flujo de trabajo completo para gestionar reapariciones rechazadas:

1. ✅ **Flujo de Rechazo → Subsanación:**
   - Al rechazar una reaparición, en lugar de eliminar el predio, se crea una solicitud de subsanación
   - Se notifica al gestor por correo con el motivo del rechazo
   - El predio permanece en el sistema hasta que se tome una decisión final

2. ✅ **Gestión de Subsanaciones (Gestores):**
   - Los gestores pueden ver sus subsanaciones pendientes
   - Formulario para corregir datos (dirección, avalúo, áreas)
   - Campo de justificación obligatorio explicando las correcciones
   - Reenvío automático al coordinador para nueva revisión

3. ✅ **Revisión de Subsanaciones (Coordinadores):**
   - Lista de reapariciones reenviadas pendientes de revisión
   - Historial completo de todos los intentos y decisiones
   - Opciones: Aprobar definitivamente, Rechazar (nueva subsanación), Rechazar DEFINITIVO

4. ✅ **Límite de Intentos:**
   - Máximo 3 intentos de subsanación
   - Después del 3er rechazo, se elimina definitivamente el predio
   - Badge visual mostrando "Intento X/3"

5. ✅ **Notificaciones por Correo:**
   - Al gestor cuando se rechaza y requiere subsanación
   - Al coordinador cuando el gestor reenvía la subsanación
   - Al gestor cuando se aprueba o rechaza definitivamente

6. ✅ **UI Completa:**
   - Botón "Subsanaciones" con badge de conteo (visible cuando hay pendientes)
   - Diálogo con tabs: "Por Subsanar" y "Reenviadas"
   - Formulario de subsanación con campos editables
   - Vista de historial desplegable

**Nuevos Endpoints:**
- `POST /api/predios/reapariciones/rechazar` (modificado)
- `GET /api/predios/reapariciones/subsanaciones-pendientes`
- `POST /api/predios/reapariciones/subsanar`
- `GET /api/predios/reapariciones/reenviadas`
- `POST /api/predios/reapariciones/aprobar-subsanacion`
- `POST /api/predios/reapariciones/rechazar-subsanacion`

**Nueva Colección MongoDB:** `reapariciones_subsanacion`

**Archivos Modificados:**
- `/app/backend/server.py` (nuevos endpoints)
- `/app/frontend/src/pages/Predios.js` (nuevo componente SubsanacionesPendientes, botón, diálogo)

---

### Sesión 20 Enero 2026 - Fix Zonas Físicas en Conservación
**Bug corregido:**

Los campos "Zona Física" y "Zona Económica" en el formulario de edición de zonas físicas (R2) aparecían como dropdowns vacíos en lugar de campos de texto editables.

**Solución:** Cambiados los componentes `<Select>` por `<Input type="text">` para permitir entrada libre de datos.

**Archivo modificado:** `/app/frontend/src/pages/Predios.js` líneas 2899-2912

---

### Sesión 20 Enero 2026 - Fix Bug Geometría Incorrecta en Conservación
**Bug corregido:**

El visor de predios de Conservación mostraba geometrías incorrectas para predios sin base gráfica. El sistema tenía un "fallback" que buscaba geometrías por coincidencia parcial (solo segmento de terreno, ignorando zona/sector).

**Ejemplo del bug:**
- `540030002000000030253000000000` → Zona `00020000`, Terreno `00030253000000000` ✅ Tiene geometría
- `540030004000000030253000000000` → Zona `00040000`, Terreno `00030253000000000` ❌ Sin geometría

El segundo predio se mostraba en la misma ubicación que el primero porque compartían el segmento de terreno.

**Solución aplicada:** Eliminado el fallback de coincidencia parcial en `get_gdb_geometry_async()`. Ahora solo retorna geometría cuando hay coincidencia exacta del código predial completo.

**Archivo modificado:** `/app/backend/server.py` líneas 7412-7440

### Sesión 19 Enero 2026 - Fork (Final)
**Visor de Actualización para Trabajo de Campo - COMPLETADO**

1. ✅ **Nuevo componente VisorActualizacion.js:**
   - Visor de mapas independiente para proyectos de actualización
   - Soporte para GPS del dispositivo (watchPosition con alta precisión)
   - Indicador de precisión GPS en metros
   - Botón para centrar mapa en ubicación actual
   - Cambio entre mapa satélite y calles
   - Filtro por zona (urbano/rural/todos)
   - Búsqueda por código predial
   - Modal de detalle de predio con tabs (General, Propietarios, Físico)

2. ✅ **Backend - Procesamiento de GDB para Actualización:**
   - Función `procesar_gdb_actualizacion()` que procesa GDB usando mismos estándares de capas
   - Capas soportadas: R_TERRENO, U_TERRENO, R_TERRENO_1, U_TERRENO_1, CONSTRUCCION, etc.
   - Colecciones separadas: `geometrias_actualizacion`, `construcciones_actualizacion`
   - Endpoint `GET /api/actualizacion/proyectos/{id}/geometrias` para obtener GeoJSON

3. ✅ **Backend - Procesamiento de R1/R2:**
   - Función `procesar_r1r2_actualizacion()` que procesa Excel R1/R2
   - Mapeo de columnas estándar (NUMERO_PREDIAL, DIRECCION, AREA_TERRENO, etc.)
   - Colección separada: `predios_actualizacion`
   - Endpoint `GET /api/actualizacion/proyectos/{id}/predios`

4. ✅ **UI actualizada en ProyectosActualizacion.js:**
   - Botón "Abrir Visor de Campo" cuando GDB está procesado
   - Muestra estadísticas de predios y registros
   - Mensaje de archivos requeridos cuando no hay GDB

5. ✅ **Ruta agregada en App.js:**
   - `/dashboard/visor-actualizacion/:proyectoId`

**Correcciones previas también completadas:**
- Desvinculación completa Conservación-Actualización
- Bug alerta "Actividades Pendientes" corregido
- Eliminación para coordinadores habilitada
- Municipios excluidos
- Ordenamiento alfabético español (Ábrego primero)
- Cronograma oculto para gestores

### Sesión 18 Enero 2026 - Fork
**Bug Crítico Corregido - Carga de GDB procesaba archivo equivocado:**
1. ✅ **Identificación de GDB en ZIP:** El sistema ahora identifica el nombre de la carpeta .gdb DENTRO del ZIP antes de extraerlo, en lugar de buscar cualquier .gdb en el directorio
2. ✅ **Priorización de capas U_TERRENO:** Eliminada la búsqueda dinámica de capas U_ que incluía capas incorrectas como U_BARRIO, U_MANZANA, etc.
3. ✅ **Resultado:** Al cargar el GDB de Bucarasica (54109):
   - Antes: Solo 7 predios urbanos (cargaba U_BARRIO)
   - Ahora: 182 predios urbanos correctamente (U_TERRENO)
   - Rurales: 1,249 predios ✅
   - Total: 1,431 geometrías ✅

**Correcciones de referencias a variables no definidas:**
- ✅ Corregido uso de `municipio_nombre` antes de su definición en la función de upload GDB
- ✅ Ahora usa `gdb_name` o `municipio_nombre_inicial` temporalmente hasta detectar desde códigos prediales

**Construcciones en Visor (VERIFICADO):**
- ✅ 187 construcciones cargadas (186 urbanas + 1 rural)
- ✅ Se visualizan en el mapa como polígonos rojos
- ✅ Panel lateral muestra lista de construcciones con área
- ✅ API `/api/gdb/construcciones/{codigo}` funciona correctamente

### Sesión 17 Enero 2026 (Parte 7) - Fork
1. **Bug Fix - Registro de Usuarios (CORREGIDO):**
   - ✅ Corregido error en endpoint de registro - API usaba URL incorrecta
   - ✅ Ahora POST /api/auth/register funciona correctamente
   - ✅ Validación de contraseña: min 6 chars, mayúscula, minúscula, número

2. **Bug Fix - Auto-asignación de Gestores (CORREGIDO):**
   - ✅ Agregado rol 'gestor' a la lista de roles permitidos para auto-asignación
   - ✅ POST /api/petitions/{id}/auto-asignar ahora funciona para gestores

3. **Notificaciones GDB por Correo (DESACTIVADO):**
   - ✅ Cambiado `enviar_email=False` en notificación de carga de GDB
   - ✅ Ya no se envían correos al cargar bases gráficas

4. **Sistema de Carga de Ortoimágenes (NUEVO):**
   - ✅ Eliminada ortoimagen de prueba "Ocaña"
   - ✅ Nuevo sistema dinámico usando MongoDB para almacenar ortoimágenes
   - ✅ Endpoints: POST /api/ortoimagenes/subir, GET /api/ortoimagenes/disponibles
   - ✅ Procesamiento automático de GeoTIFF a tiles XYZ con gdal2tiles
   - ✅ Modal de subida en Visor de Predios (nombre, municipio, descripción, archivo)
   - ✅ Barra de progreso para subida y procesamiento
   - ✅ Solo admin, coordinador, o gestor con permiso 'upload_gdb' pueden subir
   - ✅ Eliminación de ortoimágenes por admin/coordinador

### Sesión 17 Enero 2026 (Parte 6) - Fork
1. **Ortoimágenes Personalizadas (IMPLEMENTADO):**
   - ✅ Nuevo sistema para cargar ortoimágenes de alta resolución (GeoTIFF)
   - ✅ Backend convierte TIFF a tiles XYZ usando gdal2tiles
   - ✅ Endpoints: `GET /api/ortoimagenes/disponibles`, `GET /api/ortoimagenes/tiles/{id}/{z}/{x}/{y}.png`
   - ✅ Selector de ortoimágenes en Visor de Predios
   - ✅ Al seleccionar ortoimagen, el mapa se centra automáticamente en su área
   - ✅ Ortoimagen de prueba "Ocaña" disponible (zoom 14-20)

2. **Timeout de Sesión por Inactividad (IMPLEMENTADO):**
   - ✅ Cierre automático de sesión después de 30 minutos de inactividad
   - ✅ Advertencia 2 minutos antes del cierre (diálogo modal)
   - ✅ Botones: "Cerrar sesión ahora" y "Continuar trabajando"
   - ✅ Mensaje en login cuando sesión expiró por inactividad
   - ✅ Eventos de actividad: mousedown, keydown, scroll, touchstart, click

3. **Solución Global de Z-Index (IMPLEMENTADO):**
   - ✅ Estilos CSS globales en `/app/frontend/src/index.css`
   - ✅ Dialogs, dropdowns, toasts aparecen sobre mapas Leaflet (z-index 9999/99999)
   - ✅ Clases utilitarias: `.map-overlay-top`

4. **Respuesta P3 - Conexión a GDB Local:**
   - ❌ NO es posible conectar directamente a un archivo .gdb en la PC del usuario
   - Los navegadores web no pueden acceder al sistema de archivos local por seguridad
   - Alternativa: Subir archivo ZIP con la carpeta .gdb al servidor

### Sesión 17 Enero 2026 (Parte 5) - Fork
1. **Bug "Not Found" al Asignar Gestor (CORREGIDO):**
   - ✅ CORREGIDO: El modal de edición ahora llama correctamente a `/api/petitions/{id}/assign-gestor`
   - Antes: Llamaba a `/api/petitions/{id}/asignar` que no existía
   - Ahora: Usa el endpoint correcto con el payload adecuado

2. **UI Redundante de "Asignar Gestor" Eliminada:**
   - ✅ ELIMINADO: Botón externo "Asignar Gestor" junto al botón "Editar"
   - Ahora: Solo aparece el botón "Editar" en el detalle de petición
   - La asignación se hace dentro del modal de edición al seleccionar estado "Asignado"

3. **Tiles del Mapa Desaparecen al Zoom Alto (CORREGIDO):**
   - ✅ CORREGIDO: `maxZoom` reducido de 19 a 18 en VisorPredios.js
   - Antes: Al hacer zoom > 18, los tiles base desaparecían (fondo gris)
   - Ahora: El zoom máximo está alineado con los tiles disponibles (18 es el máximo para OpenStreetMap y Esri)

4. **Logos Integrados:**
   - 10 variantes de logos descargadas a `/app/frontend/public/logos/` y `/app/backend/logos/`
   - Incluye variantes: VerticalBlancoCorto, VerticalBlancoLargo, VerticalNegroCorto, VerticalNegroLargo

### Sesión 17 Enero 2026 (Parte 4) - Fork
1. **Corrección Bug Construcciones - Match Exacto:**
   - ✅ CORREGIDO: El endpoint `/gdb/construcciones/{codigo}` ahora usa match EXACTO
   - Antes: Prefijo de 20 caracteres traía construcciones de otros predios (ej: 26 en vez de 2)
   - Ahora: Solo retorna construcciones con código EXACTAMENTE igual al predio

2. **Corrección de Formato de Áreas:**
   - formatArea() ahora redondea a 2 decimales
   - Antes: "206.43093544051322 m²" → Ahora: "206.43 m²"

3. **Bug Propietarios y Matrícula en Edición (CORREGIDO):**
   - Ahora carga array completo de propietarios al editar
   - Busca matrícula en: `r2_registros[0]`, `r2`, o raíz del predio
   - Carga zonas R2 desde `r2_registros[0].zonas`

4. **Registro con Verificación por Correo:**
   - Código de 6 dígitos enviado al email
   - Expira en 30 minutos
   - Usuarios internos y admin protegido no requieren verificación

5. **Admin Protegido:**
   - `catastro@asomunicipios.gov.co` no puede tener su rol cambiado
   - Hardcodeado en backend

6. **Asignación de Trámites Mejorada:**
   - "Atención al Usuario" ahora aparece en lista de asignables
   - Lista ordenada alfabéticamente
   - Auto-asignación al pasar a "revisión" → notifica coordinadores/aprobadores
   - Nuevos endpoints: `/auto-asignar`, `/desasignar/{user_id}`

7. **Texto Corregido:**
   - "Tu radicador catastral en línea" → "Tu radicador catastral"

8. **Estado de Base de Datos:**
   - `test_database`: Base de datos activa (224,915 predios, 40 usuarios, 38,178 geometrías)
   - **Usuario confirmó:** Van a limpiar BD y cargar desde 0

### Sesión 17 Enero 2026 (Parte 3)
1. **Cambios Pendientes - Tabla Comparativa:**
   - Nueva vista que muestra "Valor Actual" vs "Valor Propuesto" en columnas
   - Campos modificados se resaltan en amarillo con indicador ⚠

2. **Modal de Rechazo con Motivo:**
   - Al rechazar cambio, se requiere motivo obligatorio
   - Se notifica al gestor que propuso el cambio (solo plataforma)

3. **Corrección de Vigencia en Excel:**
   - El export de Excel ahora incluye la vigencia seleccionada
   - El nombre del archivo incluye la vigencia exportada

4. **Análisis de GDB antes de Cargar:**
   - Nuevo endpoint `POST /api/gdb/analizar` para validar GDBs
   - Detecta capas estándar vs no estándar
   - Valida formato de códigos prediales (30 dígitos)
   - Da recomendaciones de estandarización

5. **Soporte para Construcciones en GDB:**
   - Nuevas capas: R_CONSTRUCCION, U_CONSTRUCCION
   - Nueva colección MongoDB `gdb_construcciones`
   - Visualización en mapa como polígonos rojos semitransparentes
   - Panel lateral muestra lista de construcciones con área y pisos

### Sesión 17 Enero 2026 (Parte 2)
1. **Flujo de Devolución de Peticiones IMPLEMENTADO:**
   - Nuevo estado "Devuelto" con campo `observaciones_devolucion`
   - Staff puede devolver peticiones indicando qué corregir
   - Usuario ve banner naranja con observaciones y botón "Reenviar para Revisión"
   - Al reenviar, se notifica al staff que devolvió (por email y plataforma)
   - Campo editable de observaciones aparece al seleccionar estado "Devuelto"

2. **Formateo Automático de Nombres:**
   - Nuevo endpoint `POST /api/admin/format-user-names` para migrar nombres
   - Registro de usuarios auto-formatea nombres (YACID PINO → Yacid Pino)
   - Tildes automáticas en nombres comunes (Garcia → García, Gutierrez → Gutiérrez)

3. **Mejoras en UI de Predios:**
   - Matrícula inmobiliaria ahora visible en panel "Predio Seleccionado" del visor
   - "Cambios Pendientes" muestra "Código Predial Nacional" (30 dígitos) en lugar de código interno

### Sesión 17 Enero 2026 (Parte 1)
1. **Bugs de Notificaciones CORREGIDOS:**
   - Sistema de marcar notificaciones como leídas funcionando correctamente
   - Contador de campanita se actualiza al marcar notificaciones
   - "Marcar todas como leídas" funciona correctamente
2. **Bugs de Dashboard CORREGIDOS:**
   - Contador "Devueltos" ahora muestra correctamente las peticiones
   - Filtro de peticiones por estado funciona correctamente
   - Stats del dashboard coinciden con datos reales

### Sesión 12 Enero 2025
1. **Renombrado "Ciudadano" → "Usuario"** en toda la aplicación
2. **Migración de datos:** 19 usuarios actualizados a nuevo rol
3. **Histórico de Trámites mejorado** con filtros avanzados y exportación Excel
4. **PWA implementada** para modo offline:
   - Consulta de predios sin conexión
   - Visor de mapas con tiles cacheados
   - Instalable como app en móviles
5. **Configuración de correo actualizada** con remitente "Asomunicipios Catastro"

## Próximas Tareas (Backlog)

### P0 - Crítico
- [x] **Bug Construcciones 26 vs 2:** Corregido - match exacto en lugar de prefijo ✅
- [x] **Bug "Not Found" Asignar Gestor:** Corregido - endpoint correcto ✅
- [x] **Tiles Mapa Desaparecen:** Corregido - maxZoom=19 ✅
- [x] **Ortoimágenes Personalizadas:** Implementado - carga y visualización de ortoimágenes propias ✅
- [ ] **Generación de archivos XTF** según Resolución IGAC 0301/2025
  - Ver: `/app/memory/XTF_LADM_COL_SINIC.md`

### P1 - Alta Prioridad
- [x] **Timeout de Sesión:** Implementar cierre automático por 30 min de inactividad ✅
- [ ] **Integrar Logos Proporcionados:** Logos en `/app/frontend/public/logos/` pendientes de integrar en UI y PDFs
- [ ] **Endpoint Limpieza GDB:** Crear endpoint protegido para limpiar `gdb_geometrias`, `gdb_construcciones` y campos de vinculación en `predios`
- [ ] **UI de Validación GDB:** Interfaz para mostrar reporte de validación antes de procesar GDB
- [ ] Mejorar funcionalidad offline del PWA (consulta de predios, R1/R2 y visor sin conexión)
- [x] Flujo de devolución de peticiones con observaciones editables ✅
- [ ] Mejorar vinculación GDB-Predios (~82% actualmente, issue recurrente)
- [ ] Inconsistencia de datos `tiene_geometria` (~25% de predios afectados)
- [ ] Configurar SMTP Office 365 (requiere desactivar Security Defaults)

### P2 - Media Prioridad
- [ ] Convertir PWA a app nativa con Capacitor (para tiendas)
- [ ] Historial de cambios de permisos
- [ ] Panel de acciones rápidas para gestores

### P3 - Baja Prioridad
- [ ] Rediseñar certificado catastral PDF
- [ ] Firmas digitales en PDFs
- [ ] Búsqueda global

## Credenciales de Prueba
- **Admin:** `catastro@asomunicipios.gov.co` / `Asm*123*`
- **Usuario:** `test_usuario@test.com` / `Test*123*`

## Archivos PWA
- `/app/frontend/public/manifest.json` - Configuración PWA
- `/app/frontend/public/sw.js` - Service Worker
- `/app/frontend/src/hooks/useOffline.js` - Hook para datos offline
- `/app/frontend/src/components/OfflineComponents.js` - UI de estado offline

## Estadísticas de Datos
- Total predios: 174,419
- Con geometría: 143,354
- Sin geometría: 31,065
- Total usuarios: 25+

### Sesión 19 Enero 2026 - Módulo de Actualización Fase 1
**Nueva Arquitectura de la Aplicación:**
La aplicación ahora se estructura en dos flujos principales:

1. **Conservación** (módulo existente):
   - Visor de Predios
   - Gestión de Predios
   - Peticiones
   - Sistema de aprobación de cambios

2. **Actualización** (NUEVO módulo):
   - Proyectos de actualización catastral por municipio
   - Gestión de archivos GDB y R1/R2 específicos por proyecto
   - Tracking de trabajo de campo (futuro)

**Implementado en Fase 1:**
- ✅ **Sidebar Reestructurado:** 
  - Secciones colapsables con diferenciación visual
  - Conservación (verde esmeralda)
  - Actualización (ámbar/naranja)
  - Administración
  
- ✅ **Página de Proyectos de Actualización:**
  - Cards de estadísticas (Total, Activos, Pausados, Completados, Archivados)
  - Filtros por estado (tabs)
  - Búsqueda por nombre/municipio
  - CRUD completo de proyectos
  
- ✅ **Backend - Endpoints de Actualización:**
  - `GET /api/actualizacion/proyectos` - Listar proyectos
  - `GET /api/actualizacion/proyectos/estadisticas` - Estadísticas
  - `POST /api/actualizacion/proyectos` - Crear proyecto
  - `GET /api/actualizacion/proyectos/{id}` - Detalle proyecto
  - `PATCH /api/actualizacion/proyectos/{id}` - Actualizar proyecto
  - `DELETE /api/actualizacion/proyectos/{id}` - Eliminar proyecto
  - `POST /api/actualizacion/proyectos/{id}/archivar` - Archivar
  - `POST /api/actualizacion/proyectos/{id}/restaurar` - Restaurar
  - `POST /api/actualizacion/proyectos/{id}/upload-gdb` - Cargar GDB
  - `POST /api/actualizacion/proyectos/{id}/upload-r1r2` - Cargar R1/R2
  - `GET /api/actualizacion/municipios-disponibles` - Municipios sin proyecto activo

- ✅ **Modelo de Datos - Proyectos de Actualización:**
  - Estados: activo, pausado, completado, archivado
  - Referencias a archivos GDB, R1, R2
  - Metadatos de creación y actualización
  - Estadísticas de predios actualizados/no identificados

**Pendiente para Fase 2:**
- Procesamiento real de archivos GDB/R1/R2 para proyectos
- UI para edición de datos de predios en campo
- Sistema de predios no identificados
- Capacidades offline (PWA) para trabajo de campo

## Backlog Priorizado

### P0 - Próximas tareas
- Habilitar carga funcional de archivos GDB/R1/R2 en proyectos de actualización
- UI de edición de predios dentro de un proyecto

### P1 - Funcionalidades pendientes
- Trabajo de campo offline (PWA)
- Sistema de predios no identificados
- Adjuntar fotos/formularios a visitas de campo

### P2 - Mejoras futuras
- Integración de logos en UI y PDFs
- Z-index global para elementos sobre mapas
- Historial de cambios de permisos
- Generación de archivos XTF
- Rediseño de certificado catastral PDF
- Tracking de productividad de gestores
- Firmas digitales para PDFs
- Backups automáticos de BD

### Actualización 19 Enero 2026 - Sistema de Cronograma

**Mejoras de Terminología:**
- "Base Gráfica" para archivos GDB (antes era solo "GDB")
- "Información Alfanumérica" unificado para R1/R2 (antes eran campos separados)
- Municipios ordenados alfabéticamente en todos los selectores

**Sistema de Cronograma de Actividades:**
- 3 etapas fijas creadas automáticamente: Preoperativa, Operativa, Post-Operativa
- Actividades manuales por etapa con:
  - Nombre, descripción y fase
  - Fecha límite
  - Prioridad (Alta, Media, Baja)
  - Estado (Pendiente, En Progreso, Completada, Bloqueada)
  - Asignación de responsables
- Barra de progreso por etapa

**Sistema de Alertas:**
- Alertas de actividades por vencer (7, 3, 1 día)
- Indicadores: vencida, urgente, próxima, recordatorio
- Alerta flotante al iniciar sesión para Coordinadores/Administradores

**Carga de Archivos Habilitada:**
- Endpoint: POST /api/actualizacion/proyectos/{id}/upload-base-grafica
- Endpoint: POST /api/actualizacion/proyectos/{id}/upload-info-alfanumerica
- UI con botones de carga en el tab "Archivos"

**Nuevas Colecciones MongoDB:**
- `proyectos_actualizacion`: Proyectos de actualización
- `etapas_proyecto`: Etapas del cronograma (3 por proyecto)
- `actividades_proyecto`: Actividades del cronograma

**Endpoints de Cronograma:**
- GET /api/actualizacion/proyectos/{id}/etapas - Listar etapas con actividades
- PATCH /api/actualizacion/etapas/{id} - Actualizar etapa
- POST /api/actualizacion/etapas/{id}/actividades - Crear actividad
- PATCH /api/actualizacion/actividades/{id} - Actualizar actividad
- DELETE /api/actualizacion/actividades/{id} - Eliminar actividad
- POST /api/actualizacion/actividades/{id}/asignar - Asignar responsable
- DELETE /api/actualizacion/actividades/{id}/asignar/{user_id} - Desasignar
- GET /api/actualizacion/alertas-proximas - Obtener alertas de vencimiento

---

### Sesión 21 Enero 2026 - Flujo de Predios Sin Cambios

**Cambios solicitados por el usuario:**

1. ✅ **Eliminación de Justificación Obligatoria:**
   - Removido el `prompt()` que pedía justificación al proponer cambios
   - La aprobación del coordinador es suficiente validación
   - Archivo: `/app/frontend/src/pages/VisorActualizacion.js` línea 668

2. ✅ **Nueva Opción "Visitado Sin Cambios":**
   - Checkbox en el Formulario de Visita para marcar predios verificados sin modificaciones
   - Texto explicativo: "Marque esta opción si el predio fue visitado y verificado, pero los datos catastrales no requieren modificación"
   - Se envía al coordinador para aprobación final
   - Archivo: `/app/frontend/src/pages/VisorActualizacion.js` líneas 2390-2407

3. ✅ **Filtro "Predios Sin Cambios" para Coordinador:**
   - Nueva pestaña en `GestionPropuestas.js`: "Predios Sin Cambios"
   - Dropdown para separar "Propuestas de Cambio" vs "Predios Sin Cambios"
   - Lista de predios visitados sin modificaciones pendientes de aprobación
   - Aprobación individual y masiva
   - Al aprobar, el predio se marca como "actualizado"

**Nuevos Endpoints Backend:**
- `GET /api/actualizacion/proyectos/{id}/predios-sin-cambios` - Lista predios sin cambios pendientes
- `POST /api/actualizacion/proyectos/{id}/predios/{codigo}/aprobar-sin-cambios` - Aprobar individual
- `POST /api/actualizacion/proyectos/{id}/predios-sin-cambios/aprobar-masivo` - Aprobación masiva

**Archivos Modificados:**
- `/app/frontend/src/pages/GestionPropuestas.js` - Tabs y filtros
- `/app/frontend/src/pages/VisorActualizacion.js` - Checkbox sin_cambios
- `/app/backend/server.py` - Nuevos endpoints y campo sin_cambios en PATCH

**Testing:** Verificado con testing_agent - 100% (8/8 tests passed) - iteration_13.json

---

### Sesión 21 Enero 2026 (Parte 2) - Mejoras Múltiples

**1. ✅ Matrícula Inmobiliaria en R1/R2:**
- Agregado mapeo de columna `MATRICULA_INMOBILIARIA` en procesamiento R1/R2
- El campo ahora se importa correctamente desde archivos Excel

**2. ✅ Nombre del Gestor en lugar de Email:**
- `visitado_por` ahora muestra `full_name` en lugar de `email`
- `realizada_por` también usa nombre completo
- `creado_por_nombre` utilizado en vista de propuestas

**3. ✅ Flexibilidad de Capas GDB:**
- El sistema ahora procesa archivos GDB con solo capas urbanas O solo rurales
- Información detallada de capas encontradas guardada en proyecto
- Campos: `tiene_zona_rural`, `tiene_zona_urbana`, `capas_procesadas`

**4. ✅ Vista Cronograma Gantt:**
- Nuevo componente `/app/frontend/src/components/CronogramaGantt.jsx`
- Vista de barras temporales por etapa y actividad
- Panel de estadísticas: progreso, completadas, en progreso, atrasadas
- Panel de alertas de vencimiento
- Filtros por estado y responsable
- Modal de edición con fechas inicio/fin, prioridad y estado
- Colores: Verde (completada), Azul (en progreso), Rojo (atrasada), Gris (pendiente)
- Leyenda visual

**5. ✅ Modo Offline (PWA) - Actualización y Conservación:**
- Service Worker mejorado: `/app/frontend/public/sw-offline.js`
- IndexedDB para almacenamiento local: `/app/frontend/src/utils/offlineDB.js`
- Hook de sincronización: `/app/frontend/src/hooks/useOfflineSync.js`
- **Descarga automática** al cargar visor (sin preguntar)
- Almacena: predios, geometrías GDB, tiles de mapa
- Indicador de estado offline en UI
- Cambios se guardan localmente y sincronizan al recuperar conexión
- Badge "X pendientes" con opción de forzar sincronización

**Archivos Creados:**
- `/app/frontend/src/components/CronogramaGantt.jsx`
- `/app/frontend/src/utils/offlineDB.js`
- `/app/frontend/src/hooks/useOfflineSync.js`
- `/app/frontend/public/sw-offline.js`

**Archivos Modificados:**
- `/app/backend/server.py` - Mapeo matrícula, info capas GDB
- `/app/frontend/src/pages/VisorActualizacion.js` - Modo offline, nombre gestor
- `/app/frontend/src/pages/GestionPropuestas.js` - Nombre gestor
- `/app/frontend/src/pages/ProyectosActualizacion.js` - Integración Gantt

---

## Backlog Pendiente (P1-P2)

### P1 - Próximas Tareas
- **Mejorar Formato de Visita:** Sesión dedicada para expandir campos (fichas económicas)
- **PDF Certificado Catastral:** Rediseño del formato para módulo Conservación
- **Generador XTF:** Archivos XTF para IGAC

### P2 - Futuro
- Modo offline para módulo Conservación (similar a Actualización)
- Historial de cambios de permisos
- Integración con logos de usuario en PDFs
- GPS tablet - pendiente verificación usuario

---

### Sesión 21 Enero 2026 (Parte 3) - Correcciones Finales

**1. ✅ Logo en Login Móvil:**
- Agregado logo de Asomunicipios visible en pantallas pequeñas (móvil/tablet)
- Texto "Asomunicipios" y "Sistema de Gestión Catastral"
- Archivo: `/app/frontend/src/pages/Login.js`

**2. ✅ GPS Universal Mejorado:**
- Nueva implementación más robusta para todos los dispositivos
- Estrategia de fallback: intento rápido → intento preciso → seguimiento continuo
- Timeout aumentado a 60 segundos para tablets lentos
- Mensajes de error más claros con sugerencias de solución
- Verificación de HTTPS (requerido en móviles)
- Archivo: `/app/frontend/src/pages/VisorActualizacion.js`

**3. ✅ Modo Offline para Conservación:**
- Hook `useOfflineSync` integrado en `/app/frontend/src/pages/Predios.js`
- Descarga automática de predios por municipio para offline
- Indicador visual de estado offline y cambios pendientes
- Sincronización al recuperar conexión
- Archivo: `/app/frontend/src/pages/Predios.js`

---

### Sesión 21 Enero 2026 (Parte 4) - Correcciones Móvil y GPS

**1. ✅ Login Móvil - Imagen de Fondo:**
- Agregada imagen de fondo con vías/mapa (como en desktop)
- Gradiente suave para legibilidad
- Logo y formulario sobre fondo visible
- Archivo: `/app/frontend/src/pages/Login.js`

**2. ✅ Visor Predios - Z-index Móvil:**
- Grid responsive: `grid-cols-1 lg:grid-cols-12`
- Panel de opciones con `z-index: 20` (sobre el mapa)
- Mapa con altura `50vh` en móvil, `calc(100vh-220px)` en desktop
- Mapa ahora aparece DEBAJO de las opciones en móvil
- Archivo: `/app/frontend/src/pages/VisorPredios.js`

**3. ✅ GPS Mejorado para iOS/iPhone:**
- Detección específica de iOS/iPad
- Mensajes de error adaptados a iOS con instrucciones claras
- Verificación obligatoria de HTTPS (bloquea si no es seguro)
- Flujo de permisos optimizado: getCurrentPosition primero, luego watchPosition
- Timeouts diferenciados para iOS (30s) vs Android/Desktop (60s)
- Instrucciones específicas: "Configuración > Safari > Ubicación" para iOS
- Archivo: `/app/frontend/src/pages/VisorActualizacion.js`

**Nota importante sobre GPS:**
El GPS **REQUIERE HTTPS** para funcionar en móviles. En localhost funciona para desarrollo, pero en producción debe estar desplegado con certificado SSL.

Si el GPS sigue sin funcionar en iPhone:
1. Verificar URL sea HTTPS
2. Ir a Configuración > Privacidad > Servicios de ubicación > Safari > "Mientras se usa"
3. Recargar la página después de cambiar permisos

---

### Sesión 21 Enero 2026 (Parte 5) - Múltiples Gestores y Correcciones Finales

**1. ✅ Sistema de Múltiples Gestores por Predio:**
- Modal de selección de tipo de revisión al abrir un predio (solo para gestores):
  - 🏠 Gestor de Campo: datos físicos, visita, área terreno/construida
  - ⚖️ Gestor Jurídico: propietarios, matrícula, linderos
  - ✅ Gestor de Calidad: control calidad, verificación, validación final
- Historial detallado: quién, cuándo, qué tipo de revisión, qué campos modificó
- Propuestas consolidadas: coordinador ve todas las propuestas del predio juntas
- Nuevo campo `tipo_revision` en propuestas
- Columna "Tipo Revisión" en tabla de Gestión de Propuestas

**2. ✅ Z-index Móvil - Visores:**
- CSS global para Leaflet: `z-index: 1` para contenedor del mapa
- Modales con `z-index: 99999` para siempre estar sobre el mapa
- Estilos específicos para móvil (@media max-width: 1024px)
- Archivo: `/app/frontend/src/index.css`

**3. ✅ GPS Simplificado:**
- Código más limpio y mensajes más claros
- Verificación HTTPS obligatoria
- Instrucciones específicas por plataforma (iOS, Android)
- Timeout más cortos para iOS (20s) vs otros (30s)

**Archivos Modificados:**
- `/app/frontend/src/pages/VisorActualizacion.js` - Modal tipo revisión, GPS
- `/app/frontend/src/pages/GestionPropuestas.js` - Columna tipo revisión
- `/app/backend/server.py` - Campo tipo_revision en propuestas
- `/app/frontend/src/index.css` - Z-index Leaflet

**Flujo de Múltiples Gestores:**
```
Predio X - Historial:
├── 10:00 - Juan (Campo): Modificó área_terreno, área_construida
├── 11:30 - María (Jurídico): Modificó propietarios, matrícula
├── 14:00 - Pedro (Calidad): Verificación completada
└── Coordinador: Aprueba propuestas consolidadas → Actualizado
```

---

### Sesión 21 Enero 2026 (Parte 6) - Fix Z-index Móvil y GPS Mejorado

**1. ✅ Fix Z-index del Sidebar Móvil:**
- **Problema:** Los controles flotantes del mapa (filtros, botones, leyenda) aparecían por encima del sidebar móvil
- **Causa raíz:** El sidebar tenía `z-50` (z-index: 50) pero los controles del mapa tenían `z-[1000]`
- **Solución:**
  - Aumentado z-index del sidebar móvil a `z-[9999]` en `DashboardLayout.js`
  - Reducido z-index de controles del mapa a `z-[400]`
  - Agregada clase `map-controls` a todos los controles flotantes del visor
  - CSS que oculta controles del mapa cuando el sidebar está abierto
  - Atributo `data-sidebar-open` en body para controlar visibilidad

**2. ✅ GPS con Logging Detallado para iOS:**
- **Mejoras implementadas:**
  - Logging extensivo en consola del navegador para debugging
  - Detección de plataforma: iOS, Android, Safari, móvil
  - Uso de Permissions API cuando está disponible
  - Verificación previa del estado del permiso (prompt/granted/denied)
  - Mensajes de error específicos para iOS con instrucciones paso a paso
  - Opciones de geolocalización optimizadas por plataforma
  - Timeouts diferenciados: iOS (20s), otros (30s)
  
**Archivos Modificados:**
- `/app/frontend/src/pages/VisorActualizacion.js` - GPS mejorado, clase map-controls
- `/app/frontend/src/pages/DashboardLayout.js` - z-index sidebar, atributo data-sidebar-open
- `/app/frontend/src/index.css` - Reglas CSS para ocultar controles cuando sidebar abierto

**Nota sobre GPS en iOS:**
El GPS requiere:
1. HTTPS obligatorio (✓ ya verificado en código)
2. Permiso de ubicación habilitado en iOS: Configuración > Privacidad > Servicios de ubicación > Safari
3. El usuario debe interactuar con un botón (gesto directo) para solicitar el permiso

Si el GPS sigue sin funcionar en iOS, el usuario debe revisar la consola del navegador (Safari > Desarrollar > consola) y compartir los logs que inician con "GPS:".

---

---

### Sesión 21 Enero 2026 - Color Institucional y Mejoras PDF Certificado

**Cambios implementados:**

1. ✅ **Color Institucional #009846:**
   - Actualizado en `tailwind.config.js`: primary, accent, emerald shades
   - Actualizado en `index.css`: CSS variables --primary, --accent, --ring  
   - Actualizado en `server.py`: Todos los colores en generación de PDFs y emails
   - El color anterior era #047857, ahora es #009846 (verde más brillante)

2. ✅ **Nuevo Formato del Certificado PDF:**
   - "Certificado N°:" (antes era "CERTIFICADO:") con campo editable
   - "Radicado N°:" ahora aparece inmediatamente debajo de "Certificado N°:"
   - Ambos campos son editables para generación manual (sin petición)
   - Cuando viene de una petición, el radicado se muestra fijo con color verde

3. ✅ **Verificación del Flujo de Certificados:**
   - Generación de PDF funciona correctamente
   - Envío de email con adjunto funciona (verificado en logs)
   - Endpoint de descarga `/api/petitions/{id}/descargar-certificado` funciona
   - Estado de petición se actualiza a "finalizado" automáticamente

**Archivos Modificados:**
- `/app/frontend/tailwind.config.js` - Colores primarios actualizados
- `/app/frontend/src/index.css` - Variables CSS actualizadas
- `/app/backend/server.py` - Colores en PDFs y emails, estructura del certificado

**Testing:** Verificado con curl y capturas de pantalla - Flujo completo de generación de certificado funciona sin errores.

