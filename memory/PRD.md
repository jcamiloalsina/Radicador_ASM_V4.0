# Sistema de Gestión Catastral - Asomunicipios

## Original Problem Statement
Sistema integral de gestión catastral para la Asociación de Municipios del Catatumbo que incluye:
- Gestión de predios y propietarios
- Sistema de trámites (PQRS) con radicación
- Generación de certificados catastrales y resoluciones PDF
- Aprobación de cambios con workflow de manager
- Exportación a Excel con historial de resoluciones
- Sincronización offline/online para trabajo en campo

## Core Requirements
1. **Gestión de Predios**: CRUD completo de predios con historial de cambios
2. **Sistema de Trámites**: Radicación, asignación, seguimiento
3. **Generación de PDFs**: Certificados catastrales y resoluciones con QR verificable
4. **Workflow de Aprobación**: Gestor propone → Manager aprueba → Sistema genera resolución
5. **Verificación de Documentos**: QR con código único verificable en línea

## What's Been Implemented

### Sesión Actual (04-03-2026) - Bug Fix Sincronización + Pestaña Mutaciones

#### BUG FIX CRÍTICO - Predios Aprobados no aparecían en Gestión de Predios
- **Problema reportado**: Cuando se aprobaba un predio en la página "Pendientes", el predio aparecía en el Visor de Predios (`predios_actualizacion`) pero NO en la lista de "Gestión de Predios" (`predios`)
- **Causa raíz**: La función `ejecutar_accion_predio_nuevo` en `server.py` solo insertaba en `db.predios` pero no en `db.predios_actualizacion`
- **Solución implementada**: Se agregó inserción dual en la función de aprobación:
  - Línea 12843: `await db.predios.insert_one(predio_aprobado)` (existente)
  - Línea 12871: `await db.predios_actualizacion.insert_one(predio_para_visor)` (NUEVO)
- **Archivo corregido**: `/app/backend/server.py` (función `ejecutar_accion_predio_nuevo`)
- **Estado**: ✅ VERIFICADO por testing agent

#### FEATURE - Nueva Pestaña "Mutaciones" en Pendientes
- **Requerimiento**: Los coordinadores necesitan aprobar/rechazar solicitudes de mutación M1/M2 desde la página de Pendientes
- **Solución implementada**:
  - Agregada nueva pestaña "Mutaciones" en TabsList (ahora son 5 tabs para aprobadores)
  - Función `fetchMutacionesPendientes` que consume `/api/solicitudes-mutacion/pendientes-aprobacion`
  - Función `handleMutacionAccion` para aprobar/devolver/rechazar solicitudes
  - Modal de detalle de mutación con información de predios cancelados/inscritos
  - Badges con contador de mutaciones pendientes
- **Archivo modificado**: `/app/frontend/src/pages/Pendientes.js`
- **Estado**: ✅ VERIFICADO por testing agent

### Sesión Anterior (04-03-2026) - Corrección PDF Desordenado

#### BUG FIX P0 - PDF M2 "Desordenado" CORREGIDO
- **Problema reportado**: El PDF M2 mostraba texto con espacios excesivos entre palabras y letras separadas en títulos
- **Causa raíz identificada**: 
  1. Los títulos "CONSIDERANDO" y "RESUELVE" estaban con letras separadas (`C O N S I D E R A N D O`)
  2. La función de justificación distribuía espacios sin límite, causando texto "estirado"
- **Solución implementada**:
  1. Títulos ahora se muestran como palabras completas ("CONSIDERANDO", "RESUELVE")
  2. La justificación tiene un límite máximo de 3x el espacio normal entre palabras
  3. Líneas cortas (<75% del ancho) no se justifican para evitar espacios excesivos
  4. El cierre "COMUNÍQUESE, NOTIFÍQUESE Y CÚMPLASE" formateado correctamente
- **Archivos corregidos**:
  - `/app/backend/resolucion_m2_pdf_generator.py` - Función `dibujar_texto_justificado` mejorada, títulos corregidos
  - `/app/backend/resolucion_pdf_generator.py` - Mismas correcciones aplicadas a M1
- **Estado**: ✅ VERIFICADO - PDF generado correctamente

#### BUG FIX P1 - Textarea de Plantilla M1 Auto-Expandible
- **Problema reportado**: El texto de la plantilla M1 no se veía completo en el textarea de Configuración
- **Causa raíz**: El textarea tenía altura fija y requería scroll para ver todo el contenido
- **Solución implementada**: Textarea ahora se auto-expande según el contenido cargado
- **Archivo**: `/app/frontend/src/pages/MutacionesResoluciones.js`
- **Estado**: ✅ VERIFICADO

### Sesión Anterior (04-03-2026) - M2 Completo: PDF + Englobe + Desengloble

#### PDF M2 con Header/Footer Institucional
- Encabezado y pie de página institucional idénticos al M1
- Marca de agua, QR de verificación, firma digitalizada
- Texto justificado en todo el documento
- Correcciones de texto: "Qué," en lugar de "Que", eliminado "Expedida en", "Asomunicipios" sin "Catatumbo"
- Documentos simplificados: Escritura pública, Matrícula inmobiliaria, Plano DWG
- NPN único sin duplicación
- Consecutivo de resolución corregido: `RES-54-128-XXXX-2026` (sin "M2", código municipio correcto)

#### Desengloble con Lógica Cancelación Total/Parcial
- **Cancelación TOTAL**: El predio matriz desaparece, solo se inscriben predios nuevos
- **Cancelación PARCIAL**: 
  - 1ª Inscripción = Predio matriz AJUSTADO (área reducida)
  - 2ª+ Inscripciones = Predios nuevos
- Frontend implementa automáticamente esta lógica al generar resolución

#### Englobe Completo (NUEVO)
- **Englobe TOTAL**: 
  - Múltiples predios se cancelan y nace un predio NUEVO
  - Al seleccionar, abre modal completo de "Nuevo Predio" con constructor NPN 30 dígitos
  - Valores pre-cargados (suma de áreas y avalúos)
- **Englobe por ABSORCIÓN**:
  - Un predio matriz absorbe a los demás
  - Usuario selecciona cuál es el matriz
  - Mismo NPN, área aumentada
  - Formulario inline para editar datos del matriz ajustado
- UI con selectores visuales claros para tipo de englobe
- Validaciones: mínimo 2 predios para englobe
- Mensajes de ayuda cuando faltan requisitos

**Archivos modificados**:
- `/app/backend/resolucion_m2_pdf_generator.py` - Texto justificado, header/footer, correcciones
- `/app/backend/resolucion_pdf_generator.py` - Texto justificado para M1
- `/app/frontend/src/pages/MutacionesResoluciones.js` - Lógica englobe completa, UI mejorada

### Sesión Anterior (03-03-2026) - Modal Nuevo Predio para M2
- **FEATURE P0 - Modal Nuevo Predio para M2 COMPLETO**:
  - **Problema**: Usuario necesitaba que el formulario de crear predio en M2 fuera idéntico al original
  - **Solución**: Implementado modal completo con 3 tabs:
    - **Tab 1 - Código Nacional (30 dígitos)**: 
      - Constructor de código predial con prefijo de municipio
      - Campos editables para zona, sector, comuna, barrio, manzana, terreno, condición, edificio, piso, unidad
      - Visualización en tiempo real del código
      - Botón "Verificar Código"
      - **Código Homologado auto-generado** con contador de disponibles (ej: "BPP0002BUUC - 3088 disponibles")
      - **Últimos 5 predios en la manzana** con siguiente terreno sugerido
    - **Tab 2 - Propietario (R1)**: Lista de propietarios con nombre, tipo doc, número doc. Información del predio (dirección, destino económico, matrícula, avalúo). Áreas calculadas automáticamente desde R2
    - **Tab 3 - Físico (R2)**: Zonas de terreno con zona física, económica, área. Construcciones con piso, habitaciones, baños, locales, tipificación, uso, puntaje, área. Botones agregar/eliminar. Subtotales automáticos
  - **Archivos modificados**: 
    - `/app/frontend/src/pages/MutacionesResoluciones.js` (funciones handleCodigoChangeNuevo, handleCodigoBlurNuevo, fetchSiguienteCodigoHomologadoNuevo)
    - `/app/backend/server.py` (endpoint estructura-codigo actualizado con MUNICIPIOS_POR_CODIGO)
  - **Bugs corregidos**:
    - Inputs no dejaban escribir números → Corregido con onBlur para padding
    - Código homologado no aparecía → Agregado estado y función para cargarlo
    - Últimos 5 predios no aparecían → Corregida condición de visualización
  - **Estado**: ✅ VERIFICADO

### Sesión Anterior (03-03-2026) - Fix Búsqueda Radicado
- **BUG FIX P0 - Búsqueda de Radicado no funcionaba**:
  - **Problema**: En módulo Mutaciones y Resoluciones, escribir "5531" o cualquier número no mostraba resultados
  - **Causa Raíz**: Frontend enviaba parámetro `q` pero backend esperaba `busqueda`
  - **Archivo**: `/app/frontend/src/pages/MutacionesResoluciones.js` línea 362
  - **Solución**: Cambiado `params: { q: query }` a `params: { busqueda: query }`
  - **Estado**: ✅ VERIFICADO - Screenshot confirma resultados correctos

### Sesión Anterior (03-03-2026) - Módulo Mutaciones y Resoluciones
- **NUEVO MÓDULO: Mutaciones y Resoluciones**
  - Ubicación: Conservación → Mutaciones y Resoluciones
  - M1 - Mutación Primera (Cambio de propietario): COMPLETO
    - Selector de municipio (12 municipios R1/R2)
    - Búsqueda de predios
    - Gestión de propietarios (cancelar/inscribir)
    - Generación automática de número de resolución
    - Generación de PDF con QR verificable
  - M2 - Mutación Segunda (Englobe/Desengloble): COMPLETO
    - Formulario completo para predios a cancelar e inscribir
    - Generador de PDF específico para M2
  - M3 a M6 y Complementación: Próximamente

- **Gestión de Predios ahora es SOLO CONSULTA**
  - Removido: Botón "Editar", "Nuevo Predio", "Predios Eliminados"
  - Solo lectura: Ver datos del predio e historial
  - Nota informativa: "Para modificar este predio, vaya a Mutaciones y Resoluciones"
  - Regla de oro: Todo cambio genera resolución

### Sesión Anterior - Fix Bug Crítico
- **BUG FIX P0 - Error al generar resolución**:
  - **Problema**: Al guardar cambios con resolución manual, aparecía "Error al generar resolución" aunque el backend funcionaba correctamente
  - **Causa Raíz**: En `Predios.js` línea 2472, se usaba `setIsEditModalOpen(false)` pero esa variable de estado NO existía
  - **Solución**: Reemplazado por `setShowEditDialog(false)` que es el setter correcto
  - **Estado**: ✅ VERIFICADO - Testing agent confirmó que no hay errores de JavaScript

### Sesión Anterior (QR Resolución)
- **QR de Resolución Idéntico al Certificado**: 
  - Modificado `resolucion_pdf_generator.py` para usar mismo formato de QR
  - URL: `{VERIFICACION_BASE_URL}/api/verificar/{codigo_verificacion}`
  - Color verde institucional (#009846)
  - Cuadro de verificación con código, fecha, hash
  - Nueva función `generar_codigo_verificacion_resolucion()` con formato `ASM-{año}-RES-{aleatorio}`
  - Código se guarda en BD con cada resolución
  - Endpoint `/api/verificar/{codigo}` detecta automáticamente certificado vs resolución

### Sesiones Anteriores
- Numeración de resoluciones por municipio (12 municipios)
- Flujo de generación manual de resoluciones desde "Editar Predio"
- PDF muestra datos anteriores en CANCELACIÓN y nuevos en INSCRIPCIÓN
- Formato de áreas con unidades (Ha y m²)
- Datos centrados en tablas del PDF
- Filtro y estadísticas de resoluciones por municipio corregido
- Exportación Excel con hoja HISTORIAL_RESOLUCIONES
- Tipo de mutación mostrado en historial de predio

## Architecture

```
/app/
├── backend/
│   ├── server.py                    # API principal FastAPI
│   ├── resolucion_pdf_generator.py  # Generador de PDF de resoluciones
│   └── certificado_images.py        # Imágenes embebidas para PDFs
└── frontend/
    └── src/
        ├── pages/
        │   ├── Predios.js                    # Gestión de predios
        │   └── ConfiguracionResoluciones.js  # Config y historial resoluciones
        └── components/
            └── PetitionDetail.js             # Detalle de peticiones
```

## Key APIs
- `POST /api/predios/generar-resolucion-manual`: Generación manual de resolución
- `GET /api/resoluciones/historial`: Historial filtrable por municipio
- `GET /api/verificar/{codigo_verificacion}`: Verificación pública de documentos
- `PUT /api/cambios/aprobar/{cambio_id}`: Aprobación con generación de resolución
- `GET /api/exportar-predios-excel`: Exportación con hoja de resoluciones

## Database Schema
- **predios**: Incluye `historial_resoluciones[]` con `numero_resolucion`, `fecha_resolucion`, `radicado`, `tipo_mutacion`, `pdf_path`
- **resoluciones**: `numero_resolucion`, `codigo_verificacion`, `codigo_municipio`, `pdf_path`, etc.
- **certificados_verificables**: `codigo_verificacion`, `fecha_generacion`, `estado`, etc.
- **peticiones**: `radicado`, `status`, `tipo_tramite`, etc.

## Pending Issues

### P0 - Crítico
- ✅ RESUELTO: Error "Error al generar resolución" (bug setIsEditModalOpen)
- ✅ RESUELTO (03-03-2026): Búsqueda de Radicado no funcionaba en módulo Mutaciones y Resoluciones
- ✅ RESUELTO (03-03-2026): Modal Nuevo Predio para M2 implementado idéntico al original

### P1 - Alto
- **Script importación R1-R2 peligroso**: Causa pérdida de datos (~11,000 predios). Requiere cambiar de "delete-then-insert" a "upsert". Archivo: `/app/backend/server.py` endpoint `/api/predios/import-r1-r2`
- **Contador de resoluciones frágil**: Requiere correcciones manuales frecuentes. Propuesta: usar findOneAndUpdate atómico
- **PDF descargado desde historial muestra datos incorrectos**: Propietarios cancelados/inscritos no aparecen correctamente

### P2 - Medio
- **Lógica de campos modificados**: Verificar que solo se muestren campos realmente cambiados
- **Sincronización offline-to-online**: Testing completo
- **Error checkInitialSync**: Investigar y corregir
- **PDF histórico incorrecto**: El endpoint de descarga de PDFs históricos puede mostrar datos live en lugar de los históricos

### P3 - Bajo
- **Error en Conservación**: Bug al aprobar cambios
- **Formulario de visita lento en móvil**: Optimización de rendimiento
- **NPN code length display**: Muestra 38/38 en lugar de 30/30

## Future Tasks
- **(P1 URGENTE)** Refactorizar contador de resoluciones (`obtener_siguiente_numero_resolucion`) para ser atómico - riesgo de duplicados bajo concurrencia
- **(P2)** Mutaciones encadenadas: Permitir que un predio tenga múltiples mutaciones en secuencia (ej: primero rectificación de área, luego desenglobar/englobar). Implementar workflow de mutaciones secuenciales. **Nota: Hacer después de completar todas las mutaciones individuales**
- Exportación Excel para formulario de visitas
- Exportación XTF
- App de Gestión de Correspondencia
- Refactorización de MutacionesResoluciones.js (>3800 líneas) en componentes más pequeños
- UI para reportes GDB
- Gráficos en dashboards

## Credentials for Testing
- **Administrator**: catastro@asomunicipios.gov.co / Asm*123*
- **Gestor**: gestor@emergent.co / Asm*123*

## 3rd Party Integrations
- Leaflet.js (mapas)
- proj4js (proyecciones)
- Dexie.js (IndexedDB)
- ReportLab (PDF)
- openpyxl (Excel)
- qrcode (códigos QR)
- Pillow (imágenes)
