# PRD - Sistema de Gestión Catastral "Mutaciones y Resoluciones"

## Problema Original
Sistema integral de gestión catastral para el manejo de mutaciones de propiedades, resoluciones, y procesos de actualización catastral en Colombia.

## Estado Actual: MÓDULO M3 COMPLETADO ✅

### Funcionalidades Completadas (Marzo 2026)

#### Módulo M3 - Mutación Tercera ✅ (NUEVO)
- **Subtipos implementados**:
  1. **Cambio de Destino Económico**: Modifica el destino del predio (A-T)
  2. **Incorporación de Construcción**: Agrega registros R2 al predio
- **Frontend**: 
  - Selector de subtipo con radio buttons
  - Dropdown de municipio
  - Búsqueda de predios
  - Formulario dinámico según subtipo
  - Campos de avalúo anterior/nuevo
- **Backend**: 
  - Endpoint: `POST /api/resoluciones/generar-m3`
  - Generador PDF: `resolucion_m3_pdf_generator.py`
- **Testing**: 100% pass rate (12 tests backend + frontend UI)
- **Reporte**: `/app/test_reports/iteration_61.json`

#### Visor PDF en Popup
- **Componente**: `PDFViewerModal.jsx`
- **Funcionalidades**:
  - Modal con PDF embebido (iframe)
  - Botón "Descargar PDF" (verde)
  - Botón "Imprimir"
  - Botón "Abrir en pestaña"
  - Botón "Enviar por correo" (finaliza trámite)
- **Integración**: M1, M2, M3 y Historial de resoluciones

#### Fechas de Inscripción Catastral
- **PDF**: Sección "VIGENCIAS FISCALES DE INSCRIPCIÓN"
- **Campos**: Año Vigencia, Avalúo Catastral, Fuente
- **Fuentes**: Manual, Sistema catastral, Vigencia actual

#### Finalización de Trámite
- **Endpoint**: `POST /api/resoluciones/finalizar-y-enviar`
- **Acciones**:
  - Actualiza petición a status "finalizado"
  - Envía correo HTML con PDF adjunto
  - Registra en historial del trámite

#### Migración de Datos M2
- **Script**: `/app/backend/scripts/migracion_m2_produccion.py`
- **Correcciones aplicadas**:
  - 90 predios: `pendiente_aprobacion` → `aprobado`
  - 2 predios matriz: movidos a `predios_eliminados`

## Arquitectura
```
/app/
├── backend/
│   ├── server.py                          # Monolito principal (~29k líneas)
│   ├── resolucion_m2_pdf_generator.py     # Generador PDF M2
│   ├── resolucion_m3_pdf_generator.py     # Generador PDF M3 (NUEVO)
│   ├── tests/
│   │   └── test_m3_mutaciones.py          # Tests M3 (NUEVO)
│   └── scripts/
│       └── migracion_m2_produccion.py     # Migración para producción
├── frontend/
│   └── src/
│       ├── components/
│       │   └── PDFViewerModal.jsx         # Visor PDF en popup
│       └── pages/
│           └── MutacionesResoluciones.js  # M1, M2, M3 integrados (~5900 líneas)
└── memory/
    └── PRD.md
```

## Testing Status
- **Backend**: 12/12 tests M3 passed (100%)
- **Frontend**: Todos los componentes M3 verificados
- **Reporte más reciente**: `/app/test_reports/iteration_61.json`

## Backlog Priorizado

### P1 (Alta)
1. **Bug PDF en Producción**: Investigar por qué PDFs no se generan en el servidor del usuario (BLOQUEADO - esperando input)
2. Contador de resoluciones atómico (prevenir duplicados)
3. Refactorización backend (migrar de server.py a módulos)

### P2 (Media)
1. Desenglobe masivo - verificar marcado correcto
2. Consolidación de colecciones (`cambios_pendientes`, `predios_eliminados`)

### P3 (Baja/Futuro)
- Refactorización frontend MutacionesResoluciones.js
- Módulos M4-M9 (próximamente)
- Exportación Excel/XTF
- Gráficos en dashboards

## Credenciales de Prueba
- **Admin:** catastro@asomunicipios.gov.co / Asm*123*
- **Gestor:** gestor@emergent.co / Asm*123*

## Endpoints Clave
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| /api/resoluciones/generar-m1 | POST | Genera resolución M1 |
| /api/resoluciones/generar-m2 | POST | Genera resolución M2 |
| /api/resoluciones/generar-m3 | POST | Genera resolución M3 (NUEVO) |
| /api/resoluciones/finalizar-y-enviar | POST | Finaliza y envía correo |
| /api/resoluciones/historial | GET | Lista resoluciones |
| /api/codigos-homologados/reservar-temporalmente | POST | Reserva código |

## Última Actualización
- **Fecha**: Marzo 2026
- **Estado**: Módulo M3 Completado
- **Testing**: 100% Pass Rate
