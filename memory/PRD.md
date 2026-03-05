# PRD - Sistema de Gestión Catastral "Mutaciones y Resoluciones"

## Problema Original
Sistema integral de gestión catastral para el manejo de mutaciones de propiedades, resoluciones, y procesos de actualización catastral en Colombia.

## Estado Actual: M4 IMPLEMENTADO

### Funcionalidades Completadas (Marzo 2026)

#### Módulo M4 - Revisión de Avalúo y Autoestimación (NUEVO - 05/03/2026)
- **Revisión de Avalúo**: Solicitud cuando el propietario considera que el avalúo es excesivo. El avalúo revisado se aplica en la **presente vigencia**.
- **Autoestimación**: El propietario propone un valor autoestimado. Se aplica en la **vigencia venidera**.
- **Decisión Aceptar/Rechazar**: Ambos subtipos permiten aceptar o rechazar la solicitud.
- **Artículos diferenciados**: 6 artículos para Revisión de Avalúo, 7 artículos para Autoestimación.
- **PDF Generator**: `resolucion_m4_pdf_generator.py` con plantillas completas.
- **Frontend**: Formulario con selector de subtipo, decisión, búsqueda de predio, y campos específicos.

#### Workflow Unificado de Mutaciones
- **Endpoint centralizado**: `/api/solicitudes-mutacion` ahora maneja M1, M2, M3 y M4
- **Aprobación automática**: Usuarios con rol coordinador/administrador generan PDFs directamente
- **Solicitudes pendientes**: Usuarios con rol gestor crean solicitudes que requieren aprobación
- **Generación de PDFs verificada**: Los tres tipos de mutación generan PDFs correctamente
- **Endpoint de descarga público**: `/api/resoluciones/descargar/{filename}` funcional para todas las ubicaciones

#### Módulo M1 - Mutación Primera
- Cambio de propietario o poseedor
- Generación de PDF con header institucional, watermark y QR
- PDFs almacenados en `/app/frontend/public/resoluciones/`

#### Módulo M2 - Mutación Segunda
- Desenglobe de terrenos
- Englobe de predios
- Generación de PDF con header institucional, watermark y QR
- PDFs almacenados en `/app/backend/static/resoluciones/`
- **Fix aplicado (05/03/2026)**: Compatibilidad con `codigo_predial` y `codigo_predial_nacional`

#### Módulo M3 - Mutación Tercera
- Cambio de destino económico (A-T)
- Incorporación de construcción (registros R2)
- Campo radicado obligatorio
- Vigencias fiscales de inscripción
- PDFs almacenados en `/app/backend/static/resoluciones/`

#### Visor PDF en Popup
- Modal con PDF embebido (iframe)
- Botones: Descargar, Imprimir, Abrir en pestaña, Enviar por correo

## Arquitectura
```
/app/
├── backend/
│   ├── server.py                          # Endpoint unificado /api/solicitudes-mutacion
│   ├── resolucion_pdf_generator.py        # Generador PDF M1
│   ├── resolucion_m2_pdf_generator.py     # Generador PDF M2
│   ├── resolucion_m3_pdf_generator.py     # Generador PDF M3
│   ├── resolucion_m4_pdf_generator.py     # Generador PDF M4 (NUEVO)
│   └── static/resoluciones/               # PDFs M2/M3/M4
├── frontend/
│   ├── public/resoluciones/               # PDFs M1
│   └── src/
│       └── pages/
│           └── Mutaciones/
│               └── MutacionesResoluciones.js  # UI M1, M2, M3, M4
└── memory/
    └── PRD.md
```

## Endpoints Clave
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| /api/solicitudes-mutacion | POST | Crear solicitud M1/M2/M3 (unificado) |
| /api/solicitudes-mutacion | GET | Listar solicitudes |
| /api/solicitudes-mutacion/{id}/accion | POST | Aprobar/rechazar solicitud |
| /api/resoluciones/descargar/{filename} | GET | Descargar PDF (público) |
| /api/resoluciones/historial | GET | Historial de resoluciones |

## Backlog Priorizado

### P0 (Crítico) - COMPLETADO
- [x] Generación de PDFs M1, M2, M3 verificada
- [x] Endpoint de descarga funcional
- [x] Fix compatibilidad codigo_predial

### P1 (Alta)
1. **Eliminar endpoints deprecados**: `/resoluciones/generar-m2`, `/resoluciones/generar-m3`
2. **Refactorización backend**: Migrar lógica de server.py a módulos en `/app/backend/app/api/routes/`
3. **Contador de resoluciones atómico** (prevenir duplicados en concurrencia)

### P2 (Media)
1. Refactorizar MutacionesResoluciones.js (componentes más pequeños)
2. Consolidar ubicación de PDFs (todo a una sola carpeta)
3. Desenglobe masivo - verificar marcado correcto de predios matriz

### P3 (Baja/Futuro)
- Módulos M4-M9
- Exportación Excel/XTF
- Gráficos en dashboards
- Mutaciones encadenadas

## Credenciales de Prueba
- **Admin:** catastro@asomunicipios.gov.co / Asm*123*
- **Gestor:** gestor@emergent.co / Asm*123*

## Última Actualización
- **Fecha**: 05 Marzo 2026
- **Estado**: Workflow Unificado M1/M2/M3 Completado
- **Testing**: PDFs generados y descargables correctamente

## Issues Conocidos (Pendientes de Verificación en Producción)
- Sincronización lenta en conexiones móviles
- Verificar que el refactor soluciona el bug de PDFs en producción del usuario
