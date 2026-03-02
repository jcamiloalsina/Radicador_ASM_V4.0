# Asomunicipios - Sistema de Gestión Catastral

## Descripción General
Sistema web para gestión catastral de la Asociación de Municipios del Catatumbo, Provincia de Ocaña y Sur del Cesar (Asomunicipios).

---

## 🔧 Última Actualización (02 Marzo 2026)

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
- **Formulario de visita lento en móvil** - Optimizar rendimiento

### P2 - Media Prioridad
- Verificar sincronización offline-to-online
- Investigar error `checkInitialSync is not defined`
- Implementar exportación XTF
- Desarrollar App de Correspondencia

### P3 - Baja Prioridad
- Refactorizar archivos grandes
- UI para reportes GDB
- Gráficos en dashboards
- Excel export para datos de visitas

---

## Credenciales de Prueba
- **Administrador:** `catastro@asomunicipios.gov.co` / `Asm*123*`
- **Coordinador:** `Camilo.alsina1@hotmail.com` / `Asm*123*`
- **Gestor:** `gestor@emergent.co` / `Asm*123*`

---

## Archivos Clave
- `/app/backend/server.py` - Lógica principal del backend
- `/app/frontend/src/pages/Predios.js` - Gestión de predios conservación
- `/app/frontend/src/pages/Pendientes.js` - UI de pendientes y historial
- `/app/frontend/src/pages/VisorActualizacion.js` - Visor de predios actualización
- `/app/frontend/src/pages/Sandbox.js` - Módulo Sandbox (pruebas)

---

## 3rd Party Integrations
- Leaflet.js (Maps)
- proj4js (Coordinate conversion)
- Dexie.js (IndexedDB wrapper)
- ReportLab (Backend PDF generation)
- openpyxl (Backend Excel generation)
- Sonner (Frontend toast notifications)
