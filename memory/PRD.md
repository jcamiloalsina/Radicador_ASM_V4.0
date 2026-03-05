# PRD - Sistema de Gestión Catastral "Mutaciones y Resoluciones"

## Problema Original
Sistema integral de gestión catastral para el manejo de mutaciones de propiedades, resoluciones, y procesos de actualización catastral en Colombia.

## Arquitectura Actual
```
/app/
├── backend/
│   ├── app/                    # Estructura modular (parcialmente activa)
│   │   └── api/routes/         # Routers modulares
│   ├── server.py               # Monolito principal (contiene lógica nueva)
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── pages/              # Páginas principales
│       │   ├── Mutaciones/MutacionesResoluciones.js  # Componente principal
│       │   └── LogActividades.js                      # Log de actividades
│       └── components/ui/      # Componentes Shadcn
└── memory/
    └── PRD.md
```

## Funcionalidades Implementadas

### Completadas
- [x] Log de Actividades (backend + frontend)
- [x] UI de Fechas de Inscripción Catastral
- [x] Sistema de reserva atómica de códigos homologados
- [x] Corrección búsqueda de radicados
- [x] Corrección lista de gestores disponibles
- [x] Corrección dropdown de vigencias (z-index)
- [x] Bug fix: duplicación de función liberarCodigosReservados (2025-01-XX)

### En Progreso
- [ ] PDF de Fechas de Inscripción Catastral (UI lista, PDF pendiente)

## Backlog Priorizado

### P0 (Crítico)
1. Completar generación de PDF con Fechas de Inscripción Catastral
2. Pruebas E2E del sistema de reserva de códigos

### P1 (Alta)
1. Contador de resoluciones no atómico
2. Refactorización backend (migrar de server.py a módulos)
3. Consolidación de colecciones MongoDB

### P2 (Media)
1. Desenglobe masivo - marcado incorrecto de predio original
2. Error no especificado reportado por usuario
3. Visibilidad de predios en Gestión (BLOQUEADO - necesita IDs)

### P3 (Baja/Futuro)
- Módulo genérico "Otras Mutaciones" (M3-M9)
- Refactorización frontend MutacionesResoluciones.js
- Exportación Excel/XTF
- Gráficos en dashboards
- App de Correspondencia

## Credenciales de Prueba
- **Admin:** catastro@asomunicipios.gov.co / Asm*123*
- **Gestor:** gestor@emergent.co / Asm*123*

## Endpoints Clave
- POST /api/logs - Logs del sistema
- GET /api/avaluos/config/anos-disponibles - Años para avalúos
- POST /api/codigos-homologados/reservar-temporalmente
- POST /api/codigos-homologados/confirmar-uso
- POST /api/codigos-homologados/liberar

## Deuda Técnica
1. **server.py monolítico** - Todo código nuevo agregado aquí, aumentando deuda
2. **MutacionesResoluciones.js** - Componente muy grande (~5000 líneas)
3. **Arquitectura híbrida** - Routers modulares y monolito coexistiendo

## Última Actualización
- Fecha: Diciembre 2025
- Último cambio: Fix duplicación de función liberarCodigosReservados
