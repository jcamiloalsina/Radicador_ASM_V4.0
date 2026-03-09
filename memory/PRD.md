# Sistema de Gestión Catastral - PRD

## Descripción
Sistema integral de gestión catastral para administrar predios, mutaciones, resoluciones y certificados.

## Estado Actual: Funcional con Issues Pendientes

### ✅ Completado en esta sesión (09-03-2026):
- **Fix modales de mutación no scrolleables:**
  - Cambiado `overflow-visible` a `overflow-y-auto` en DialogContent principal
  - Los usuarios ahora pueden ver y acceder a todos los campos del formulario
  - Tests: 11/11 pasados

- **Fix formulario Complementación - campos de área:**
  - Campos de área terreno y área construida ahora están DESHABILITADOS
  - Agregado mensaje de advertencia indicando usar Rectificación de Área
  - Agregados campos editables: matrícula, dirección, destino, número de documento
  - Regla de negocio: Complementación NO permite modificar áreas

### 🔴 Issues P0 Resueltos:
- ~~Modales de mutación no scrolleables~~ ✅ RESUELTO
- ~~Complementación permite editar áreas~~ ✅ RESUELTO
- ~~Firma de Dalgie faltante en resoluciones~~ ✅ RESUELTO

### 🟡 Issues Pendientes:

#### P1 - Verificación Pendiente:
- **Desenglobe masivo:** No marca correctamente el predio original como cancelado
- **Flujo de aprobación de Múltiples Mutaciones:** Pendiente definir flujo del coordinador

#### P2 - Por Resolver:
- PDFs históricos incorrectos (posiblemente sirviendo datos en vivo)
- Formulario de Visita lento en móviles
- Contador de resoluciones no atómico

### 🔵 Backlog Técnico:
- Refactorización de `server.py` (monolito → routers modulares)
- Refactorización de componentes frontend grandes
- Prueba de regresión completa de mutaciones
- Abstracción de generadores PDF duplicados
- Eliminación de endpoints temporales de migración

## Credenciales de Test:
- **Admin/Aprobador:** `catastro@asomunicipios.gov.co` / `Asm*123*`
- **Gestor:** `gestor@emergent.co` / `Asm*123*`
- **Atención Usuario:** `atencion@emergent.co` / `Asm*123*`

## Arquitectura:
```
/app/
├── backend/
│   ├── server.py              # Backend monolítico (necesita refactorización)
│   ├── resolucion_pdf_generator.py  # Generador de PDFs de resolución
│   ├── certificado_images.py  # Imágenes embebidas en base64
│   └── logos/
│       └── firma_dalgie_blanco.png  # Firma para resoluciones
└── frontend/
    └── src/
        ├── pages/
        │   ├── MutacionesResoluciones.js
        │   ├── UserManagement.js
        │   └── FileManager.js
        └── layout/
            └── DashboardLayout.js
```

## Integraciones:
- ReportLab (PDF Generation)
- openpyxl (Excel Parsing)
- motor/pymongo (MongoDB)
- qrcode (QR para verificación)
