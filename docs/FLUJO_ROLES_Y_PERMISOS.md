# Sistema de Roles y Flujos - Gestor Catastral ASOMUNICIPIOS

## 1. ROLES DEL SISTEMA

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           JERARQUÍA DE ROLES                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   👑 ADMINISTRADOR                                                               │
│   └── Todos los permisos del sistema                                            │
│   └── Gestión de usuarios y roles                                               │
│   └── Configuración del sistema                                                  │
│                                                                                  │
│   📋 COORDINADOR                                                                 │
│   └── Aprobar/Rechazar cambios y resoluciones                                   │
│   └── Asignar gestores a trámites                                               │
│   └── Finalizar trámites                                                         │
│   └── Ver todas las peticiones                                                   │
│                                                                                  │
│   👤 GESTOR                                                                      │
│   └── Procesar trámites asignados                                               │
│   └── Crear resoluciones (requiere aprobación)                                  │
│   └── Editar predios                                                             │
│   └── Marcar trabajo como completado                                            │
│                                                                                  │
│   👥 GESTOR_AUXILIAR                                                             │
│   └── Apoyo en trabajo de campo                                                  │
│   └── Digitalización de información                                              │
│   └── Asistir a gestores principales                                            │
│                                                                                  │
│   🎧 ATENCION_USUARIO                                                            │
│   └── Radicar nuevas peticiones                                                  │
│   └── Atender ciudadanos                                                         │
│   └── Asignar gestores                                                           │
│   └── Finalizar trámites                                                         │
│                                                                                  │
│   📢 COMUNICACIONES                                                              │
│   └── Consultar predios                                                          │
│   └── Ver visor de predios                                                       │
│   └── Ver trámites                                                               │
│   └── Descargar/subir archivos                                                   │
│                                                                                  │
│   🏢 EMPRESA                                                                     │
│   └── Similar a comunicaciones                                                   │
│   └── Acceso limitado a municipios asignados                                    │
│                                                                                  │
│   🙋 USUARIO (Ciudadano)                                                         │
│   └── Crear peticiones/trámites                                                  │
│   └── Ver estado de sus trámites                                                 │
│   └── Descargar certificados                                                     │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 2. PERMISOS GRANULARES

| Permiso | Código | Descripción |
|---------|--------|-------------|
| Subir GDB | `upload_gdb` | Subir archivos de Base Gráfica |
| Importar R1/R2 | `import_r1r2` | Importar archivos Excel R1/R2 |
| Aprobar Cambios | `approve_changes` | Aprobar/Rechazar cambios de predios |
| Acceso Actualización | `acceso_actualizacion` | Módulo de trabajo de campo |

**Nota:** Administrador y Coordinador tienen TODOS los permisos por defecto.

## 3. FLUJO DE PETICIONES/TRÁMITES

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        FLUJO DE PETICIONES                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   CIUDADANO                    ATENCIÓN USUARIO              GESTOR              │
│      │                              │                          │                 │
│      │  Crea petición               │                          │                 │
│      ├─────────────────────────────>│                          │                 │
│      │                              │                          │                 │
│      │                    [RADICADO]│                          │                 │
│      │                              │  Asigna gestor           │                 │
│      │                              ├─────────────────────────>│                 │
│      │                              │                          │                 │
│      │                              │                [ASIGNADO]│                 │
│      │                              │                          │                 │
│      │                              │                          │ Procesa         │
│      │                              │                          │ trámite         │
│      │                              │                          │                 │
│      │                              │               [EN_PROCESO]│                │
│      │                              │                          │                 │
│      │                              │                          │ Marca           │
│      │                              │                          │ completado      │
│      │                              │                          │                 │
│      │                              │                 [REVISION]│◄───────────────│
│      │                              │                          │                 │
│      │                              │                          │                 │
│   COORDINADOR                       │                          │                 │
│      │                              │                          │                 │
│      │◄─ Auto-asignado cuando pasa a revisión ─────────────────│                │
│      │                              │                          │                 │
│      │  Revisa y decide:            │                          │                 │
│      │  ├── ✅ APROBADO             │                          │                 │
│      │  ├── ❌ RECHAZADO            │                          │                 │
│      │  └── ↩️ DEVUELTO             │                          │                 │
│      │                              │                          │                 │
│      │                    [APROBADO]│                          │                 │
│      │                              │                          │                 │
│      │  Finaliza trámite            │                          │                 │
│      │                              │                          │                 │
│      │                 [FINALIZADO] │                          │                 │
│      │                              │                          │                 │
│      │                              │  Notifica                │                 │
│      ├──────────────────────────────┼─────────────────────────>│ CIUDADANO       │
│      │                              │                          │                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 4. ESTADOS DE PETICIÓN

| Estado | Código | Descripción | Quién cambia |
|--------|--------|-------------|--------------|
| Radicado | `radicado` | Recién creado | Sistema |
| Asignado | `asignado` | Gestor asignado | Atención/Coord |
| En Proceso | `en_proceso` | Gestor trabajando | Gestor |
| Revisión | `revision` | Pendiente aprobación | Gestor |
| Aprobado | `aprobado` | Coordinador aprobó | Coordinador |
| Rechazado | `rechazado` | Coordinador rechazó | Coordinador |
| Devuelto | `devuelto` | Necesita correcciones | Coordinador |
| Finalizado | `finalizado` | Trámite completo | Coord/Atención |

## 5. FLUJO DE MUTACIONES Y RESOLUCIONES

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     FLUJO DE MUTACIONES (M1, M2)                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   CASO A: Usuario con permiso de aprobación (Coordinador/Admin)                 │
│   ─────────────────────────────────────────────────────────────                 │
│                                                                                  │
│   1. Selecciona radicado                                                         │
│   2. Carga datos del predio                                                      │
│   3. Completa formulario de mutación                                             │
│   4. [APRUEBA DIRECTAMENTE] ──────────────────────┐                             │
│                                                    │                             │
│                                                    ▼                             │
│   ┌────────────────────────────────────────────────────────────────┐            │
│   │  • Se genera resolución                                         │            │
│   │  • Se genera PDF                                                │            │
│   │  • Se actualizan predios                                        │            │
│   │  • Se abre popup con PDF                                        │            │
│   │  • Opción: Enviar correo y finalizar trámite                   │            │
│   └────────────────────────────────────────────────────────────────┘            │
│                                                                                  │
│                                                                                  │
│   CASO B: Gestor SIN permiso de aprobación                                       │
│   ─────────────────────────────────────────────                                  │
│                                                                                  │
│   1. Selecciona radicado                                                         │
│   2. Carga datos del predio                                                      │
│   3. Completa formulario de mutación                                             │
│   4. Selecciona GESTOR DE APOYO (coordinador a quien enviar)                    │
│   5. [ENVÍA PARA REVISIÓN] ───────────────────────┐                             │
│                                                    │                             │
│                                                    ▼                             │
│   ┌────────────────────────────────────────────────────────────────┐            │
│   │  Coordinador recibe notificación                                │            │
│   │  • Revisa la solicitud                                          │            │
│   │  • APRUEBA → Se genera resolución y PDF                        │            │
│   │  • RECHAZA → Notifica al gestor                                │            │
│   │  • DEVUELVE → Gestor debe corregir                             │            │
│   └────────────────────────────────────────────────────────────────┘            │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 6. FLUJO DE CAMBIOS EN PREDIOS

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                   FLUJO DE CAMBIOS DE PREDIOS                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   GESTOR edita un predio                                                         │
│      │                                                                           │
│      ├── Si tiene permiso 'approve_changes':                                    │
│      │      └── Cambio se aplica DIRECTAMENTE                                   │
│      │                                                                           │
│      └── Si NO tiene permiso:                                                   │
│             └── Cambio queda en estado PENDIENTE                                │
│                    │                                                             │
│                    ▼                                                             │
│             COORDINADOR revisa en "Pendientes":                                 │
│                    │                                                             │
│                    ├── ✅ APRUEBA → Cambio se aplica                            │
│                    │                                                             │
│                    └── ❌ RECHAZA → Cambio descartado                           │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 7. NOTIFICACIONES AUTOMÁTICAS

| Evento | Destinatario | Tipo |
|--------|--------------|------|
| Nueva petición radicada | Atención Usuario | Email + Sistema |
| Gestor asignado | Gestor | Notificación interna |
| Trámite enviado a revisión | Coordinador | Notificación interna |
| Trámite aprobado | Ciudadano | Email |
| Trámite rechazado | Gestor | Notificación interna |
| Trámite finalizado | Ciudadano | Email con PDF adjunto |

## 8. ENDPOINTS CLAVE POR ROL

### Coordinador/Admin
- `POST /api/petitions/{id}/asignar/{gestor_id}` - Asignar gestor
- `PATCH /api/petitions/{id}` - Cambiar estado (aprobar/rechazar)
- `POST /api/resoluciones/generar-m2` - Generar resolución directa
- `POST /api/resoluciones/finalizar-y-enviar` - Finalizar y enviar correo

### Gestor
- `POST /api/petitions/{id}/marcar-completado` - Marcar trabajo terminado
- `GET /api/predios` - Consultar predios
- `POST /api/cambios-pendientes` - Proponer cambios

### Atención Usuario
- `POST /api/petitions` - Crear nueva petición
- `POST /api/petitions/{id}/asignar/{gestor_id}` - Asignar gestor
- `PATCH /api/petitions/{id}` - Finalizar trámite

## 9. COLECCIONES MONGODB RELACIONADAS

| Colección | Propósito |
|-----------|-----------|
| `users` | Usuarios con roles y permisos |
| `petitions` | Peticiones/trámites de ciudadanos |
| `predios` | Base de datos catastral |
| `cambios_pendientes` | Cambios propuestos por gestores |
| `resoluciones` | Resoluciones generadas |
| `notifications` | Notificaciones internas |

---

## RESUMEN VISUAL DE PERMISOS

```
                    ADMINISTRADOR   COORDINADOR   GESTOR   ATENCIÓN   CIUDADANO
                    ────────────────────────────────────────────────────────────
Gestionar usuarios       ✅             ❌          ❌         ❌          ❌
Aprobar cambios          ✅             ✅          ⚠️*        ❌          ❌
Crear resoluciones       ✅             ✅          ⚠️*        ❌          ❌
Asignar gestores         ✅             ✅          ❌         ✅          ❌
Finalizar trámites       ✅             ✅          ❌         ✅          ❌
Editar predios           ✅             ✅          ✅         ❌          ❌
Radicar peticiones       ✅             ✅          ✅         ✅          ✅
Ver sus trámites         ✅             ✅          ✅         ✅          ✅
Subir GDB                ✅             ✅          ⚠️*        ❌          ❌
Importar R1/R2           ✅             ✅          ⚠️*        ❌          ❌

⚠️* = Requiere permiso explícito asignado
```
