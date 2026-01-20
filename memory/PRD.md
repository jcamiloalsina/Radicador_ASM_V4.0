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
