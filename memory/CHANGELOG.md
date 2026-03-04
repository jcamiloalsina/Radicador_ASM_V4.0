# CHANGELOG - Sistema de Gestión Catastral

## [2.0.0] - 2026-03-04

### Added - Refactorización Backend Modular
- Nueva estructura modular en `/app/backend/app/` (~4,320 líneas en 23 archivos)
- **98 rutas API** funcionando en la aplicación modular standalone
- **core/**:
  - `config.py`: Configuración centralizada, catálogos DIVIPOLA, roles y permisos
  - `database.py`: Conexión MongoDB reutilizable
  - `security.py`: JWT, autenticación, validación de permisos
- **routers/** (12 módulos):
  - `auth.py`: Login, registro, verificación email, recuperación contraseña (~473 líneas)
  - `users.py`: Gestión de usuarios, roles, permisos (~193 líneas)
  - `admin.py`: Administración del sistema (~118 líneas)
  - `catalogos.py`: Catálogos del sistema, health check (~65 líneas)
  - `predios.py`: CRUD de predios, búsquedas, estadísticas (~306 líneas)
  - `petitions.py`: Crear/listar peticiones, asignar gestores (~467 líneas)
  - `notifications.py`: Sistema de notificaciones (~149 líneas)
  - `resoluciones.py`: Plantillas, configuración, historial (~396 líneas)
  - `database.py`: Estado DB, backups, restauración (~369 líneas)
  - `certificados.py`: Generación, verificación, estadísticas (~261 líneas)
  - `actualizacion.py`: Proyectos de actualización catastral (~379 líneas)
  - `gdb.py`: Base gráfica, geometrías, estadísticas (~283 líneas)
- **services/**:
  - `email_service.py`: Envío de correos con templates HTML profesionales (~295 líneas)
- **utils/**:
  - `helpers.py`: Funciones de utilidad (formateo nombres, seguridad archivos) (~122 líneas)
- `main.py`: Aplicación FastAPI modular standalone

### Changed
- Documentación actualizada en `/app/backend/docs/README.md` con nueva arquitectura
- PRD actualizado con progreso de refactorización

### Technical Notes
- Migración gradual: routers pueden importarse en server.py existente
- server.py legacy mantiene ~28,000 líneas pendientes de migración
- Módulos probados y funcionando independientemente

---

## [1.9.x] - 2026-03-04 (Sesiones anteriores)

### Added - Database Security & Performance
- MongoDB Authentication configurado con usuario aplicación
- 40+ índices de base de datos optimizados
- Schema validation para colecciones críticas (predios, users, petitions)
- Sistema de backup automatizado diario

### Fixed
- UI Pendientes refactorizada de 5 tabs a 2
- Bug sincronización de predios aprobados
- Bug resoluciones M2 no aparecían en historial
- WriteConflictError en desenglobe masivo
- Bug construcciones no cargaban en modo edición

### Changed
- "Carga Masiva" renombrado a "Importar Excel"
- Formato de áreas al estándar colombiano (ej: 1.044,70 m²)
- Bloqueo de NPNs duplicados en desenglobe masivo
