# Asomunicipios - Sistema de Gestión Catastral

## Descripción General
Sistema web para gestión catastral de la Asociación de Municipios del Catatumbo, Provincia de Ocaña y Sur del Cesar (Asomunicipios).

---

## 🔧 Última Verificación (25 Febrero 2026 - Fork 20)

### ✅ VERIFICADO: Modal "Detalle del Cambio" en Pendientes

**Estado:** FUNCIONANDO CORRECTAMENTE

**Verificación realizada:**
- El modal muestra todos los datos del predio correctamente:
  - Código Predial Nacional (CNP)
  - Municipio
  - Propietario (datos anteriores y valor aplicado)
  - Justificación del cambio
  - Fecha y usuario que aprobó/rechazó
- El historial muestra 21 aprobados y 5 rechazados
- Los datos se obtienen correctamente del campo `predio_actual` enriquecido por el backend

**Backend - Lógica de búsqueda en `/predios/cambios/pendientes` y `/predios/cambios/historial`:**
1. Busca primero en `predios` por `predio_id`
2. Si no encuentra, busca en `predios` con `deleted: true`
3. Si aún no encuentra, busca en `predios_eliminados` por `codigo_predial_nacional`

---

### ✅ VERIFICADO: Export Excel R1/R2 desde Módulo de Actualización

**Estado:** YA IMPLEMENTADO

**Funcionalidad:**
- Endpoint: `GET /api/actualizacion/proyectos/{proyecto_id}/exportar-excel`
- Parámetro opcional: `?solo_actualizados=true`
- Genera Excel con 3 hojas: REGISTRO_R1, REGISTRO_R2, RESUMEN
- Botones en el Visor de Actualización:
  - "Exportar Excel R1/R2 Completo"
  - "Solo Actualizados/Firmados"

---

### ✅ CONFIRMADO POR USUARIO: Rendimiento del Formulario de Visita en Móvil

**Estado:** RESUELTO (según confirmación del usuario)

---

## 🔧 Cambios Anteriores (21 Febrero 2026 - Fork 19)

### ✅ IMPLEMENTADO: Multi-Property Certificate Petition
- Backend completado para manejar lista de propiedades en certificado sencillo

### ✅ IMPLEMENTADO: Gestor Status Fix
- Corregido el estado de gestores en peticiones finalizadas (ahora muestra "Completado")

### ✅ IMPLEMENTADO: Unified Excel R1/R2 Exports
- Exports refactorizados para Conservación y Actualización
- Función `parsear_nombre_completo` para dividir nombres
- Lógica de merge con propuestas aprobadas

### ✅ IMPLEMENTADO: Property Deletion Flow Overhaul
- Modal para capturar radicado, resolución y motivo
- Guardado en `predios_eliminados` con metadatos completos
- Export de eliminados actualizado con nuevas columnas

---

## Stack Tecnológico
- **Backend:** FastAPI (Python) + MongoDB (asomunicipios_db)
- **Frontend:** React + Tailwind CSS + shadcn/ui
- **Mapas:** Leaflet + react-leaflet
- **PDFs:** ReportLab
- **Excel:** openpyxl
- **PWA:** Service Worker + IndexedDB (modo offline unificado)

## Roles de Usuario
1. `usuario` - Usuario externo, puede crear peticiones y dar seguimiento
2. `atencion_usuario` - Atiende peticiones iniciales
3. `gestor` - Gestiona peticiones y predios
4. `coordinador` - Aprueba cambios, gestiona permisos, ve histórico completo
5. `administrador` - Control total del sistema
6. `comunicaciones` - Solo lectura
7. `empresa` - Solo lectura restringida

---

## 📋 Backlog y Tareas Pendientes

### P0 - Crítico
- Ninguno actualmente

### P1 - Alta Prioridad
- **Verificar guardado de visitas:** El usuario cree que está resuelto, pero fue un bug recurrente
- **Export Excel específico de formulario de visita:** Si el usuario lo requiere (diferente del R1/R2)

### P2 - Media Prioridad
- Implementar exportación XTF
- Desarrollar App de Correspondencia
- Verificar sincronización offline-to-online completa
- Investigar error intermitente `checkInitialSync is not defined`

### P3 - Baja Prioridad
- Refactorizar `VisorActualizacion.js` y `Predios.js`
- UI para reportes GDB
- Gráficos en dashboards
- Sistema de acto administrativo automatizado

---

## Credenciales de Prueba
- **Administrador:** `catastro@asomunicipios.gov.co` / `Asm*123*`
- **Coordinador:** `Camilo.alsina1@hotmail.com` / `Asm*123*`
- **Gestor:** `gestor@emergent.co` / `Asm*123*`

---

## Archivos Clave
- `/app/backend/server.py` - Lógica principal del backend
- `/app/frontend/src/pages/Pendientes.js` - UI de pendientes y historial
- `/app/frontend/src/pages/VisorActualizacion.js` - Visor de predios actualización
- `/app/frontend/src/pages/Predios.js` - Gestión de predios conservación

---

## 3rd Party Integrations
- Leaflet.js (Maps)
- proj4js (Coordinate conversion)
- Dexie.js (IndexedDB wrapper)
- ReportLab (Backend PDF generation)
- openpyxl (Backend Excel generation)
- Sonner (Frontend toast notifications)
