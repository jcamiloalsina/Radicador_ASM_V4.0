# CHANGELOG - Sistema de Gestión Catastral

## [2.0.0] - 2026-03-04

### Added - Refactorización Backend Modular
- Nueva estructura modular en `/app/backend/app/` (~2,500 líneas)
- **core/**:
  - `config.py`: Configuración centralizada, catálogos DIVIPOLA, roles y permisos
  - `database.py`: Conexión MongoDB reutilizable
  - `security.py`: JWT, autenticación, validación de permisos
- **routers/**:
  - `auth.py`: Login, registro, verificación email, recuperación contraseña (~450 líneas)
  - `users.py`: Gestión de usuarios, roles, permisos (~170 líneas)
  - `admin.py`: Administración del sistema, municipios empresa (~90 líneas)
  - `catalogos.py`: Catálogos del sistema, health check (~60 líneas)
  - `predios.py`: CRUD de predios, búsquedas, estadísticas (~280 líneas)
  - `petitions.py`: Crear/listar peticiones, asignar gestores (~400 líneas)
  - `notifications.py`: Sistema de notificaciones (~130 líneas)
- **services/**:
  - `email_service.py`: Envío de correos con templates HTML profesionales (~250 líneas)
- **utils/**:
  - `helpers.py`: Funciones de utilidad (formateo nombres, seguridad archivos) (~100 líneas)
- `main.py`: Aplicación FastAPI modular standalone con 52 rutas

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
