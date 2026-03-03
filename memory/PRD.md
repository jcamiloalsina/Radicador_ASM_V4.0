# Asomunicipios - Sistema de Gestión Catastral

## Descripción General
Sistema web para gestión catastral de la Asociación de Municipios del Catatumbo, Provincia de Ocaña y Sur del Cesar (Asomunicipios).

---

## 🔧 Última Actualización (03 Marzo 2026 - Sesión 2)

### ✅ IMPLEMENTADO: Sistema Completo de Resoluciones Automáticas

**Descripción:**
Sistema integral para la generación automática de resoluciones PDF (M1 - Mutación Primera) cuando se aprueba un cambio de predio. El sistema incluye:

1. **Página de Configuración de Resoluciones** (`/dashboard/configuracion-resoluciones`):
   - Solo accesible para administradores
   - **Tab "Plantillas de Texto":** Editar texto legal M1, nombre y cargo del firmante
   - **Tab "Numeración 2026":** Establecer último número de resolución manual (el sistema continúa desde ahí)
   - Preview PDF para verificar cambios antes de aplicar

2. **Generación Automática al Aprobar:**
   - Cuando se aprueba un cambio de tipo `modificacion` o `creacion`, el sistema genera automáticamente el PDF M1
   - PDF incluye: encabezado institucional, marca de agua, tablas de cancelación/inscripción, firma de Dalgie, QR de validación
   - El PDF se guarda en `/resoluciones/` y se registra en colección `resoluciones`
   - Numeración automática: RES-{DEPTO}-{MPIO}-{AÑO}-{CONSECUTIVO}

**Nuevos Endpoints:**
- `GET /api/resoluciones/configuracion` - Obtener configuración de numeración
- `PUT /api/resoluciones/configuracion` - Actualizar número inicial para 2026
- `GET /api/resoluciones/siguiente-numero/{municipio}` - Consultar próximo número

**Nuevas Colecciones MongoDB:**
- `resolucion_configuracion` - Almacena `{ id, ultimo_numero_2026, ... }`
- `resoluciones` - Registra cada resolución generada con número, PDF path, cambio_id, etc.

**Archivos Modificados:**
- `/app/backend/server.py` - Función `generar_resolucion_final()` y lógica en `aprobar_rechazar_cambio()`
- `/app/frontend/src/pages/ConfiguracionResoluciones.js` - Nueva página completa
- `/app/frontend/src/App.js` - Nueva ruta
- `/app/frontend/src/pages/DashboardLayout.js` - Link de navegación

**Tests:** 27 tests (100% pasados) - `/app/test_reports/iteration_55.json`

---

## 🔧 Actualización (03 Marzo 2026 - Sesión 1)

### ✅ IMPLEMENTADO: Sistema de Plantillas de Resolución M1

**Descripción:**
Sistema simplificado para gestionar plantillas de texto para resoluciones catastrales. El administrador puede editar el texto legal de las resoluciones desde un textarea simple, sin necesidad de modificar código. Inicialmente en Sandbox, ahora migrado a ConfiguracionResoluciones.

**Funcionalidades:**
1. **Gestión de Plantillas:**
   - Ver y listar todas las plantillas disponibles (M1 por defecto)
   - Editar el texto legal de cada plantilla
   - Modificar nombre y cargo del firmante
   - Guardar cambios que persisten en base de datos

2. **Generación de Preview PDF:**
   - Genera un PDF de ejemplo usando la plantilla seleccionada
   - Usa datos de un predio real o datos de ejemplo
   - Abre el PDF en una nueva pestaña del navegador

3. **Variables Dinámicas:**
   - `{tipo_tramite}`, `{radicado}`, `{matricula_inmobiliaria}`
   - `{codigo_catastral}`, `{npn}`, `{municipio}`
   - `{vigencia_fiscal}`, `{fecha_resolucion_texto}`

**Endpoints Implementados:**
- `GET /api/resoluciones/plantillas` - Listar todas las plantillas
- `GET /api/resoluciones/plantillas/{tipo}` - Obtener plantilla específica (M1, M2, etc.)
- `PUT /api/resoluciones/plantillas/{tipo}` - Actualizar texto y firmante de plantilla
- `POST /api/resoluciones/generar-preview?tipo=M1` - Generar PDF preview

**Archivos modificados:**
- `/app/backend/server.py` - 4 nuevos endpoints de plantillas de resolución
- `/app/frontend/src/pages/Sandbox.js` - Nueva pestaña "Resoluciones" con UI completa

**Tests:**
- `/app/backend/tests/test_resoluciones_plantillas.py` - 18 tests (100% pasados)

**Colección MongoDB:**
- `resolucion_plantillas` - Almacena plantillas con campos: id, tipo, nombre, descripcion, texto, firmante_nombre, firmante_cargo

---

## 🔧 Actualización (02 Marzo 2026)

### ✅ FIX: Radicado Requerido en Creación de Predios Nuevos

**Cambio:**
El campo "Radicado Asociado" ahora es **REQUERIDO** (antes era opcional) cuando se crea un predio nuevo con el flujo de trabajo de Conservación.

**Comportamiento:**
- Para gestores: Deben ingresar un número de radicado para justificar la creación
- Para coordinadores/administradores: Pueden crear sin radicado (tienen autorización directa)
- Consistente con la edición de predios existentes que ya requería radicado

**Validación:**
- El botón "Crear y Asignar a Flujo" se deshabilita si no hay radicado
- Mensaje de advertencia: "⚠️ Debe ingresar un número de radicado para justificar la creación del predio"

**Archivo modificado:** `/app/frontend/src/pages/Predios.js`

---

### ✅ IMPLEMENTADO: Módulo Sandbox (Entorno de Pruebas)

**Descripción:**
Módulo completo para consultar datos de producción (solo lectura) y realizar operaciones CRUD en colecciones separadas (`predios_sandbox`) sin afectar la base de datos real. Solo accesible para administradores.

**Funcionalidades:**
1. **Consultas BD (Solo Lectura):**
   - Consulta a colecciones: predios, users, petitions, predios_cambios, predios_eliminados
   - Filtros JSON personalizados
   - Límite de resultados configurable (máx 100)
   - Exclusión automática de datos sensibles (contraseñas, códigos de verificación)

2. **Pruebas (Sandbox):**
   - Crear predios de prueba que se guardan en `predios_sandbox`
   - Eliminar predios individuales o limpiar todo el sandbox
   - Estadísticas de producción vs sandbox

**Endpoints Implementados:**
- `POST /api/sandbox/consultar` - Consultar colecciones de producción
- `GET /api/sandbox/datos` - Obtener datos del sandbox
- `POST /api/sandbox/crear-predio` - Crear predio de prueba
- `DELETE /api/sandbox/predio/{id}` - Eliminar predio específico
- `DELETE /api/sandbox/limpiar` - Limpiar todo el sandbox
- `GET /api/sandbox/estadisticas` - Estadísticas producción vs sandbox

**Archivos modificados:**
- `/app/backend/server.py` - 6 nuevos endpoints de sandbox
- `/app/frontend/src/pages/Sandbox.js` - Componente completo del módulo
- `/app/frontend/src/App.js` - Ruta `/dashboard/sandbox` añadida
- `/app/frontend/src/pages/DashboardLayout.js` - Enlace en menú de administración

**Tests:**
- `/app/backend/tests/test_sandbox_module.py` - 17 tests (100% pasados)

---

## 🔧 Actualización Anterior (26 Febrero 2026)

### ✅ IMPLEMENTADO: Lógica de Predios Nuevos vs Viejos

**Nuevos campos en predios:**
- `creado_en_plataforma: true/false` - Indica si el predio fue creado manualmente en la plataforma
- `area_editada_en_plataforma: true/false` - Indica si el área fue editada en la plataforma

**Sincronización automática R2→R1:**
El modal de edición debe comportarse diferente según:
- Si `creado_en_plataforma = true` OR `area_editada_en_plataforma = true` → Sincronización AUTOMÁTICA R2→R1
- Si ambos son `false` → Modo MANUAL (áreas R1 y R2 independientes)

**Comportamiento al importar Excel:**
- Si el predio YA EXISTE en BD → PRESERVA valores de `creado_en_plataforma` y `area_editada_en_plataforma`
- Si el predio NO EXISTE en BD → Se crea con ambos campos en `false`

### ✅ FIX: Piso inicial = 0
- Corregido en `Predios.js`: El campo "Piso" ahora inicia en 0 (antes era 1)

### ✅ FIX: Radicado en eliminaciones
- El radicado ingresado al eliminar un predio ahora se guarda y muestra correctamente

### ✅ FIX: Certificado catastral usa datos actualizados
- El sistema ahora busca los datos más recientes del predio al generar certificados

---

## Stack Tecnológico
- **Backend:** FastAPI (Python) + MongoDB (asomunicipios_db)
- **Frontend:** React + Tailwind CSS + shadcn/ui
- **Mapas:** Leaflet + react-leaflet
- **PDFs:** ReportLab
- **Excel:** openpyxl
- **PWA:** Service Worker + IndexedDB (modo offline)

## Roles de Usuario
1. `usuario` - Usuario externo
2. `atencion_usuario` - Atiende peticiones iniciales
3. `gestor` - Gestiona peticiones y predios
4. `coordinador` - Aprueba cambios
5. `administrador` - Control total
6. `comunicaciones` - Solo lectura
7. `empresa` - Solo lectura restringida

---

## 📋 Backlog y Tareas Pendientes

### P0 - Crítico
- Ninguno actualmente

### P1 - Alta Prioridad
- **Error al aprobar cambios en "Conservación"** - Reportado por usuario, pendiente de reproducción
- **Formulario de visita lento en móvil** - Optimizar rendimiento (`VisitaFormModal.js`)

### P2 - Media Prioridad
- Verificar sincronización offline-to-online
- Investigar error `checkInitialSync is not defined`
- **Expandir sistema de resoluciones:** Agregar plantillas M2, M3, etc.
- Implementar exportación XTF
- Desarrollar App de Correspondencia
- Exportación Excel para datos de visitas

### P3 - Baja Prioridad
- Refactorizar `server.py` (25,000+ líneas) usando FastAPI APIRouter
- UI para reportes GDB
- Gráficos en dashboards

---

## Credenciales de Prueba
- **Administrador:** `catastro@asomunicipios.gov.co` / `Asm*123*`
- **Coordinador:** `Camilo.alsina1@hotmail.com` / `Asm*123*`
- **Gestor:** `gestor@emergent.co` / `Asm*123*`

---

## Archivos Clave
- `/app/backend/server.py` - Lógica principal del backend (25,000+ líneas)
- `/app/backend/resolucion_pdf_generator.py` - Generador de PDFs de resolución
- `/app/frontend/src/pages/ConfiguracionResoluciones.js` - Configuración de resoluciones (admin)
- `/app/frontend/src/pages/Predios.js` - Gestión de predios conservación
- `/app/frontend/src/pages/Pendientes.js` - UI de pendientes y historial
- `/app/frontend/src/pages/VisorActualizacion.js` - Visor de predios actualización

---

## 3rd Party Integrations
- Leaflet.js (Maps)
- proj4js (Coordinate conversion)
- Dexie.js (IndexedDB wrapper)
- ReportLab (Backend PDF generation)
- Pillow (Image processing for watermark)
- openpyxl (Backend Excel generation)
- qrcode (QR code generation)
- Sonner (Frontend toast notifications)
