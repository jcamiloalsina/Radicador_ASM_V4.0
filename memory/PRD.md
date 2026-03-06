# PRD - Sistema de Gestión Catastral "Mutaciones y Resoluciones"

## Problema Original
Sistema integral de gestión catastral para el manejo de mutaciones de propiedades, resoluciones, y procesos de actualización catastral en Colombia.

## Estado Actual: M4 COMPLETADO Y VERIFICADO

### Funcionalidades Completadas (Marzo 2026)

#### Módulo M4 - Revisión de Avalúo y Autoestimación (VERIFICADO - 06/03/2026)
- **Revisión de Avalúo**: Solicitud cuando el propietario considera que el avalúo es excesivo. El avalúo revisado se aplica en la **presente vigencia**.
- **Autoestimación**: El propietario propone un valor autoestimado. Se aplica en la **vigencia venidera**.
- **Decisión Aceptar/Rechazar**: Ambos subtipos permiten aceptar o rechazar la solicitud.
- **Artículos diferenciados**: 6 artículos para Revisión de Avalúo, 7 artículos para Autoestimación.
- **PDF Generator**: `resolucion_m4_pdf_generator.py` con plantillas completas.
- **Frontend**: Formulario con selector de subtipo, decisión, búsqueda de predio, y campos específicos.
- **Testing**: Verificado 100% funcional por testing_agent en iteración #62

#### Workflow Unificado de Mutaciones
- **Endpoint centralizado**: `/api/solicitudes-mutacion` maneja M1, M2, M3 y M4
- **Aprobación automática**: Usuarios con rol coordinador/administrador generan PDFs directamente
- **Solicitudes pendientes**: Usuarios con rol gestor crean solicitudes que requieren aprobación
- **Generación de PDFs verificada**: Los cuatro tipos de mutación generan PDFs correctamente
- **Endpoint de descarga público**: `/api/resoluciones/descargar/{filename}` funcional

#### Módulo M1 - Mutación Primera
- Cambio de propietario o poseedor
- Generación de PDF con header institucional, watermark y QR
- PDFs almacenados en `/app/frontend/public/resoluciones/`

#### Módulo M2 - Mutación Segunda
- Desenglobe de terrenos
- Englobe de predios
- Generación de PDF con header institucional, watermark y QR
- PDFs almacenados en `/app/backend/static/resoluciones/`

#### Módulo M3 - Mutación Tercera
- Cambio de destino económico (A-T)
- Incorporación de construcción (registros R2)
- Campo radicado obligatorio
- Vigencias fiscales de inscripción

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
│   ├── resolucion_m4_pdf_generator.py     # Generador PDF M4
│   └── static/resoluciones/               # PDFs M2/M3/M4
├── frontend/
│   ├── public/resoluciones/               # PDFs M1
│   └── src/
│       └── pages/
│           └── MutacionesResoluciones.js  # UI M1, M2, M3, M4
└── memory/
    └── PRD.md
```

## Endpoints Clave
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| /api/solicitudes-mutacion | POST | Crear solicitud M1/M2/M3/M4 (unificado) |
| /api/solicitudes-mutacion | GET | Listar solicitudes |
| /api/solicitudes-mutacion/{id}/accion | POST | Aprobar/rechazar solicitud |
| /api/resoluciones/descargar/{filename} | GET | Descargar PDF (público) |
| /api/resoluciones/historial | GET | Historial de resoluciones |

## Backlog Priorizado

### P0 (Crítico) - COMPLETADO
- [x] Generación de PDFs M1, M2, M3, M4 verificada
- [x] Endpoint de descarga funcional
- [x] Fix compatibilidad codigo_predial
- [x] M4 formulario frontend funcional
- [x] Testing de regresión M1/M2/M3 completado

### P1 (Alta)
1. **Eliminar endpoints deprecados**: `/resoluciones/generar-m2`, `/resoluciones/generar-m3` (código legacy no usado)
2. **Refactorización backend**: Migrar lógica de server.py a módulos en `/app/backend/app/api/routes/`
3. **Contador de resoluciones atómico** (prevenir duplicados en concurrencia)

### P2 (Media)
1. Refactorizar MutacionesResoluciones.js (componentes más pequeños)
2. Consolidar ubicación de PDFs (todo a una sola carpeta)
3. Desenglobe masivo - verificar marcado correcto de predios matriz

### P3 (Baja/Futuro)
- Módulos M5-M9
- Exportación Excel/XTF
- Gráficos en dashboards
- Mutaciones encadenadas

## Credenciales de Prueba
- **Admin:** catastro@asomunicipios.gov.co / Asm*123*
- **Gestor:** gestor@emergent.co / Asm*123*
- **Atención Usuario:** atencion@emergent.co / Asm*123*

## Última Actualización
- **Fecha**: 06 Marzo 2026
- **Estado**: M4 COMPLETADO Y VERIFICADO
- **Testing**: iteration_62.json - 100% éxito frontend y backend

## Issues Resueltos (Sesión Actual)
- ✅ Bug "Objects are not valid as a React child" - CORREGIDO en dropdown de radicados M4 (línea 3247)
  - Causa: `rad.numero || rad` intentaba renderizar el objeto completo cuando `rad.numero` era undefined
  - Solución: Cambiar a `rad.radicado || rad.numero || typeof rad === 'string' ? rad : ''`
- M4 formulario renderiza correctamente con ambos subtipos
- Regresión M1/M2/M3 pasada exitosamente

## Issues Conocidos (Pendientes de Verificación en Producción)
- Sincronización lenta en conexiones móviles
- Usuario debe desplegar cambios a su servidor de producción para resolver bugs de permisos
