# Sistema de Gestión Catastral - PRD

## Descripción
Sistema integral de gestión catastral para administrar predios, mutaciones, resoluciones y certificados.

## Estado Actual: Funcional con Issues Pendientes

### ✅ Completado en esta sesión (10-03-2026):

- **Fix predios nuevos sin aprobación:**
  - BUG: Endpoint `/predios` creaba predios directamente sin flujo de aprobación
  - CORREGIDO: Ahora usa `/predios-nuevos` que respeta el rol del usuario
  - Gestores → Crea propuesta pendiente de aprobación
  - Coordinadores/Admin → Crea predio directamente

- **Fix sincronización offline:**
  - Las funciones de guardado ahora tienen fallback a caché local
  - Si falla la conexión, guarda en IndexedDB y sincroniza después
  - Agregado soporte para tipo `predio_nuevo` en hook de sincronización

- **Fix flujo de aprobación gestores:**
  - Agregado campo `exito: true` en respuestas del backend
  - Las notificaciones ahora se envían a coordinadores cuando gestor crea solicitud

- **Fix modales de mutación no scrolleables:**
  - Cambiado `overflow-visible` a `overflow-y-auto` en DialogContent principal

- **Fix formulario Complementación:**
  - Campos de área y avalúo DESHABILITADOS
  - Campos editables: matrícula, dirección, destino, número de documento

### 🔴 Issues P0 Resueltos:
- ~~Modales de mutación no scrolleables~~ ✅
- ~~Complementación permite editar áreas/avalúo~~ ✅
- ~~Predios nuevos sin ir a aprobación~~ ✅
- ~~Error "Error al enviar solicitud" gestores~~ ✅
- ~~Usuarios con internet no pueden guardar~~ ✅

### 🟡 Issues Pendientes:

#### P1 - Verificación Pendiente:
- **Importación R1/R2 Cáchira:** Mejorado manejo de errores, pendiente verificar
- **Desenglobe masivo:** Verificar que marca predio original como cancelado
- **Flujo Múltiples Mutaciones:** Definir flujo del coordinador

#### P2 - Por Resolver:
- PDFs históricos incorrectos
- Formulario de Visita lento en móviles
- Contador de resoluciones no atómico

### 🔵 Backlog Técnico:
- Refactorización de `server.py` (monolito → routers modulares)
- Refactorización de componentes frontend grandes
- Prueba de regresión completa de mutaciones
- Abstracción de generadores PDF duplicados

## Credenciales de Test:
- **Admin/Aprobador:** `catastro@asomunicipios.gov.co` / `Asm*123*`
- **Gestores reales:** `ninoatuesta@hotmail.com`, `yacid_1@hotmail.com`, etc.

## Arquitectura:
```
/app/
├── backend/
│   ├── server.py              # Backend monolítico
│   ├── resolucion_*.py        # Generadores de PDFs
│   └── logos/
└── frontend/
    └── src/
        ├── pages/
        │   ├── GestionPrediosActualizacion.js  # MODIFICADO
        │   └── MutacionesResoluciones.js
        └── hooks/
            └── useOfflineSync.js  # MODIFICADO
```

## Integraciones:
- ReportLab (PDF Generation)
- openpyxl (Excel Parsing)
- motor/pymongo (MongoDB)
- qrcode (QR para verificación)
