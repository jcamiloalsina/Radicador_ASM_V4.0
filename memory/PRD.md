# PRD - Sistema de Gestión Catastral "Mutaciones y Resoluciones"

## Problema Original
Sistema integral de gestión catastral para el manejo de mutaciones de propiedades, resoluciones, y procesos de actualización catastral en Colombia.

## Estado Actual: M5 COMPLETADO Y VERIFICADO

### Funcionalidades Completadas (Marzo 2026)

#### Módulo M5 - Cancelación / Inscripción de Predio (VERIFICADO - 06/03/2026)
- **Cancelación de Predio**: Eliminar un predio del catastro desde una vigencia específica
  - Búsqueda de predio existente a cancelar
  - Vigencia de cancelación configurable
  - Opción de cancelación por doble inscripción (con código del predio duplicado)
- **Inscripción de Predio Nuevo**: Registrar un predio que no existe en el catastro
  - **MODAL COMPLETO EMBEBIDO dentro de M5** (IGUAL a Predios.js) ✅
  - **3 Tabs**: Código Nacional (30 dígitos) | Propietario (R1) | Físico (R2)
  - **Código Homologado Automático**: Muestra el siguiente disponible o indica que se generará
  - **Últimos 5 predios en manzana**: Con siguiente terreno sugerido automáticamente
  - **Verificación de código**: Botón para validar disponibilidad
  - **Múltiples propietarios**: Con estado civil, tipo documento, número
  - **Destinos económicos completos**: A-J disponibles
  - **Zonas de Terreno**: Con subtotal automático → R1
  - **Construcciones**: Con ID automático (A, B, C...) y subtotal → R1
  - **Áreas calculadas del R2**: Automáticamente enviadas al R1
  - Al crear predio, se auto-selecciona en el formulario M5
- **Backend**: Endpoint simplificado `POST /api/predios/m5/crear`
- **PDF Generator**: `resolucion_m5_pdf_generator.py` con plantillas completas
- **Frontend**: Formulario con selector de subtipo, búsqueda/entrada de predio, vigencia
- **Vista de aprobación**: Sección M5 en Pendientes.js con todos los detalles
- **Testing**: iteration_63.json - 100% éxito frontend y backend

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
| /api/predios/m5/crear | POST | Crear predio simplificado para M5 (nuevo) |
| /api/solicitudes-mutacion | POST | Crear solicitud M1/M2/M3/M4/M5 (unificado) |
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
- [x] **M5 Modal Embebido para crear predios COMPLETADO** (06/03/2026)

### P1 (Alta)
1. **Eliminar endpoints deprecados**: `/resoluciones/generar-m2`, `/resoluciones/generar-m3` (código legacy no usado)
2. **Refactorización backend**: Migrar lógica de server.py a módulos en `/app/backend/app/api/routes/`
3. **Contador de resoluciones atómico** (prevenir duplicados en concurrencia)

### P2 (Media)
1. Refactorizar MutacionesResoluciones.js (componentes más pequeños)
2. Consolidar ubicación de PDFs (todo a una sola carpeta)
3. Desenglobe masivo - verificar marcado correcto de predios matriz

### P3 (Baja/Futuro)
- Módulos M6-M9
- Exportación Excel/XTF
- Gráficos en dashboards
- Mutaciones encadenadas

## Credenciales de Prueba
- **Admin:** catastro@asomunicipios.gov.co / Asm*123*
- **Gestor:** gestor@emergent.co / Asm*123*
- **Atención Usuario:** atencion@emergent.co / Asm*123*

## Última Actualización
- **Fecha**: 06 Marzo 2026
- **Estado**: M5 COMPLETADO Y VERIFICADO  
- **Testing**: iteration_63.json - 100% éxito frontend y backend

## Issues Resueltos (Sesión Actual)
- ✅ Bug "Objects are not valid as a React child" - CORREGIDO en dropdown de radicados M4 (línea 3247)
- ✅ Historial de resoluciones M4 no aparecía en gestión de predios - CORREGIDO
- ✅ Fecha de resolución con día de mañana - CORREGIDO (ZoneInfo America/Bogota)
- ✅ Correo con resolución M4 no se enviaba - CORREGIDO
- ✅ Vista de aprobación de coordinador para M4 vacía - CORREGIDO
- ✅ Información de predio mejorada en formulario M4 (estilo R1)
- ✅ **Vista de predios cancelados/inscritos en Pendientes.js** - MEJORADA
  - Ahora muestra: código, matrícula, destino, áreas, avalúo, dirección, propietarios, vigencias
  - Aplica para M1, M2, M3, M4
- ✅ **PDF no se descargaba al aprobar solicitud** - CORREGIDO
  - Backend ahora devuelve `pdf_url` y `numero_resolucion` en la respuesta
  - Frontend abre el PDF en nueva pestaña automáticamente al aprobar
- ✅ **Historial de solicitudes** - VERIFICADO FUNCIONANDO (31 aprobados, 5 rechazados)
- ✅ **M5 Modal Embebido para Crear Predios** - COMPLETADO Y VERIFICADO
  - Modal COMPLETO igual a Predios.js con 3 Tabs (Código | R1 | R2)
  - Código homologado automático de lista general
  - Últimos 5 predios en manzana con siguiente terreno sugerido
  - Múltiples propietarios, zonas de terreno, construcciones
  - Áreas calculadas automáticamente R2 → R1
  - Verificación de código disponible
  - Al crear predio, se cierra modal y auto-selecciona el predio creado
  - Endpoint POST /api/predios/m5/crear funcionando
- ✅ **M5 Flujo de Aprobación** - VERIFICADO
  - Usuarios con rol COORDINADOR/ADMINISTRADOR o permiso APPROVE_CHANGES: generan PDF directo
  - Usuarios GESTOR sin permisos: crean solicitud pendiente de aprobación
  - Vista en Pendientes.js muestra datos completos de M5 (subtipo, predio, vigencia, propietarios, doble inscripción)
- ✅ **Página de Verificación QR** - CORREGIDO (06/03/2026)
  - Bug: Los campos mostraban "N/A" porque las resoluciones M2-M5 usaban claves de DB diferentes
  - Fix: Endpoint `/api/verificar/{codigo}` ahora detecta tipo de documento y usa campos correctos
  - Resoluciones muestran: No. Resolución, Tipo, Subtipo, Radicado, Código Predial, Municipio, Dirección, Solicitante
  - M2 (Desenglobe/Englobe) también muestra: Predios Cancelados, Predios Inscritos
  - Certificados siguen mostrando: Propietarios, Área Terreno, Avalúo
  - Corrección gramatical: "RESOLUCIÓN VÁLIDA" (femenino), "CERTIFICADO VÁLIDO" (masculino)

## Issues Conocidos (Pendientes de Verificación en Producción)
- Sincronización lenta en conexiones móviles
- Usuario debe desplegar cambios a su servidor de producción para resolver bugs de permisos
