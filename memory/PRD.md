# Asomunicipios - Sistema de Gestión Catastral

## Descripción General
Sistema web para gestión catastral de la Asociación de Municipios del Catatumbo, Provincia de Ocaña y Sur del Cesar (Asomunicipios).

---

## 🔧 Última Actualización (26 Febrero 2026)

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
- **Implementar UI condicional del modal:** Cuando `creado_en_plataforma=true` OR `area_editada_en_plataforma=true`, mostrar modal con sincronización automática R2→R1. De lo contrario, modo manual.

### P2 - Media Prioridad
- Implementar exportación XTF
- Desarrollar App de Correspondencia
- Verificar sincronización offline-to-online

### P3 - Baja Prioridad
- Refactorizar archivos grandes
- UI para reportes GDB
- Gráficos en dashboards

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

---

## 3rd Party Integrations
- Leaflet.js (Maps)
- proj4js (Coordinate conversion)
- Dexie.js (IndexedDB wrapper)
- ReportLab (Backend PDF generation)
- openpyxl (Backend Excel generation)
- Sonner (Frontend toast notifications)
