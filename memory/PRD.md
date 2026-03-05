# PRD - Sistema de Gestión Catastral "Mutaciones y Resoluciones"

## Problema Original
Sistema integral de gestión catastral para el manejo de mutaciones de propiedades, resoluciones, y procesos de actualización catastral en Colombia.

## Estado Actual: P0 COMPLETADO ✅

### Funcionalidades Completadas (Diciembre 2025)

#### Visor PDF en Popup
- **Componente**: `PDFViewerModal.jsx`
- **Funcionalidades**:
  - Modal con PDF embebido (iframe)
  - Botón "Descargar PDF" (verde)
  - Botón "Imprimir"
  - Botón "Abrir en pestaña"
  - Botón "Enviar por correo" (finaliza trámite)
- **Integración**: M1, M2 y Historial de resoluciones

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
│   ├── server.py                          # Monolito principal
│   ├── resolucion_m2_pdf_generator.py     # Generador PDF M2 (con fechas inscripción)
│   └── scripts/
│       └── migracion_m2_produccion.py     # Migración para producción
├── frontend/
│   └── src/
│       ├── components/
│       │   └── PDFViewerModal.jsx         # Visor PDF en popup
│       └── pages/
│           └── MutacionesResoluciones.js  # Integración popup
└── memory/
    └── PRD.md
```

## Testing Status
- **Backend**: 12/12 tests passed (100%)
- **Frontend**: Todos los componentes verificados
- **Reporte**: `/app/test_reports/iteration_60.json`

## Backlog Priorizado

### P1 (Alta)
1. Contador de resoluciones atómico (prevenir duplicados)
2. Refactorización backend (migrar de server.py a módulos)

### P2 (Media)
1. Desenglobe masivo - verificar marcado correcto
2. Módulo genérico "Otras Mutaciones" (M3-M9)

### P3 (Baja/Futuro)
- Refactorización frontend MutacionesResoluciones.js
- Exportación Excel/XTF
- Gráficos en dashboards

## Credenciales de Prueba
- **Admin:** catastro@asomunicipios.gov.co / Asm*123*

## Endpoints Clave
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| /api/resoluciones/generar-m2 | POST | Genera resolución M2 |
| /api/resoluciones/finalizar-y-enviar | POST | Finaliza y envía correo |
| /api/resoluciones/historial | GET | Lista resoluciones |
| /api/codigos-homologados/reservar-temporalmente | POST | Reserva código |

## Última Actualización
- **Fecha**: Diciembre 2025
- **Estado**: P0 Completado
- **Testing**: 100% Pass Rate
