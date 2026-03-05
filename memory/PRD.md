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
│   ├── scripts/
│   │   └── migracion_m2_produccion.py  # Script de migración
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/
│       │   └── PDFViewerModal.jsx      # NUEVO: Visor PDF en popup
│       ├── pages/              
│       │   ├── MutacionesResoluciones.js  # Modificado para usar popup
│       │   └── LogActividades.js                      
│       └── components/ui/      
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
- [x] Bug fix: duplicación de función liberarCodigosReservados
- [x] Fix M2: URL completa para descarga de PDFs
- [x] Fix M2: Creación de r2_registros para predios nuevos
- [x] Fix M2: Status "aprobado" para predios nuevos
- [x] Fix M2: Predio matriz se elimina correctamente (soft delete + predios_eliminados)
- [x] **NUEVO**: Visor PDF en popup (no abre nueva ventana)
- [x] **NUEVO**: Endpoint para finalizar trámite y enviar correo con PDF adjunto
- [x] **NUEVO**: Script de migración para corregir datos existentes

### En Progreso
- [ ] PDF de Fechas de Inscripción Catastral (UI lista, PDF pendiente)

## Nuevas Funcionalidades (Diciembre 2025)

### Visor PDF en Popup
- **Componente**: `PDFViewerModal.jsx`
- **Funcionalidades**:
  - Vista previa del PDF embebida en iframe
  - Botón "Descargar PDF"
  - Botón "Imprimir"
  - Botón "Abrir en pestaña"
  - Botón "Enviar por correo" (finaliza trámite)

### Finalización de Trámite
- **Endpoint**: `POST /api/resoluciones/finalizar-y-enviar`
- **Funcionalidades**:
  - Busca petición por radicado
  - Cambia status a "finalizado"
  - Envía correo HTML con PDF adjunto
  - Registra en historial del trámite

### Script de Migración
- **Archivo**: `/app/backend/scripts/migracion_m2_produccion.py`
- **Corrige**:
  - Predios con status `pendiente_aprobacion` → `aprobado`
  - Predios matriz con `pendiente_eliminacion` → `deleted: true`
  - Resoluciones sin campo `año`

## Backlog Priorizado

### P0 (Crítico)
1. Completar generación de PDF con Fechas de Inscripción Catastral
2. Probar flujo M2 completo con popup

### P1 (Alta)
1. Contador de resoluciones no atómico
2. Refactorización backend (migrar de server.py a módulos)
3. Consolidación de colecciones MongoDB

### P2 (Media)
1. Desenglobe masivo - verificar marcado correcto
2. Error no especificado reportado por usuario

### P3 (Baja/Futuro)
- Módulo genérico "Otras Mutaciones" (M3-M9)
- Refactorización frontend MutacionesResoluciones.js
- Exportación Excel/XTF
- Gráficos en dashboards

## Credenciales de Prueba
- **Admin:** catastro@asomunicipios.gov.co / Asm*123*
- **Gestor:** gestor@emergent.co / Asm*123*

## Endpoints Clave
- POST /api/resoluciones/generar-m2 - Genera resolución M2
- POST /api/resoluciones/finalizar-y-enviar - **NUEVO**: Finaliza y envía correo
- GET /api/resoluciones/historial - Lista resoluciones
- POST /api/codigos-homologados/reservar-temporalmente
- POST /api/codigos-homologados/confirmar-uso
- POST /api/codigos-homologados/liberar

## Última Actualización
- Fecha: Diciembre 2025
- Últimos cambios: Visor PDF en popup, finalización de trámite con envío de correo
