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

### Última Sesión (03-03-2026) - Fix Bug Crítico
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

### P1 - Alto
- **Contador de resoluciones frágil**: Requiere correcciones manuales frecuentes. Propuesta: usar findOneAndUpdate atómico
- **PDF descargado desde historial muestra datos incorrectos**: Propietarios cancelados/inscritos no aparecen correctamente

### P2 - Medio
- **Lógica de campos modificados**: Verificar que solo se muestren campos realmente cambiados
- **Sincronización offline-to-online**: Testing completo
- **Error checkInitialSync**: Investigar y corregir

### P3 - Bajo
- **Error en Conservación**: Bug al aprobar cambios
- **Formulario de visita lento en móvil**: Optimización de rendimiento

## Future Tasks
- Exportación Excel para formulario de visitas
- Exportación XTF
- App de Gestión de Correspondencia
- Refactorización de archivos grandes (server.py, Predios.js)
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
