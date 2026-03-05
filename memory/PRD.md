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
│   ├── resolucion_m2_pdf_generator.py  # Generador PDF M2
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
- [x] Bug fix: duplicación de función liberarCodigosReservados (2025-12)
- [x] Fix M2: URL completa para descarga de PDFs (2025-12)
- [x] Fix M2: Creación de r2_registros para predios nuevos (2025-12)
- [x] Fix M2: Status "aprobado" para predios nuevos (antes era pendiente_aprobacion) (2025-12)
- [x] Fix M2: Predio matriz se elimina correctamente (soft delete + predios_eliminados) (2025-12)

### En Progreso
- [ ] PDF de Fechas de Inscripción Catastral (UI lista, PDF pendiente)

## Fixes Aplicados Sesión Actual (Diciembre 2025)

### Fix 1: PDF M2 en Blanco
- **Problema:** La URL del PDF usaba ruta relativa que no funcionaba en servidores de desarrollo
- **Solución:** Cambiar a URL completa: `${REACT_APP_BACKEND_URL}${pdf_path}`
- **Archivos:** `MutacionesResoluciones.js`

### Fix 2: Predios Nuevos sin R2
- **Problema:** Los predios creados por M2 no tenían información R2 (construcciones, zonas, etc.)
- **Solución:** Construir `r2_registros` a partir de datos de construcciones y zonas del frontend
- **Archivos:** `server.py` - función `generar_resolucion_m2`

### Fix 3: Predios no aparecían en Gestión
- **Problema:** Status era `pendiente_aprobacion` y no aparecían en gestión
- **Solución:** Cambiar status a `aprobado` directamente

### Fix 4: Predio Matriz no se eliminaba
- **Problema:** Solo se marcaba como `pendiente_eliminacion` pero seguía apareciendo
- **Solución:** Soft delete (`deleted: true`) + copia completa a `predios_eliminados`

## Backlog Priorizado

### P0 (Crítico)
1. Completar generación de PDF con Fechas de Inscripción Catastral
2. Probar flujo M2 completo después de fixes

### P1 (Alta)
1. Contador de resoluciones no atómico
2. Refactorización backend (migrar de server.py a módulos)
3. Consolidación de colecciones MongoDB

### P2 (Media)
1. Desenglobe masivo - verificar marcado correcto
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
- POST /api/resoluciones/generar-m2 - Genera resolución M2 (desenglobe/englobe)
- GET /api/resoluciones/historial - Lista resoluciones con filtro de año
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
- Últimos cambios: Fixes para flujo M2 (PDF URL, R2, status, eliminación matriz)
