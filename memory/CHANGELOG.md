# CHANGELOG - Sistema de Gestión Catastral

## [2.0.0] - 2026-03-04

### Added - Refactorización Backend Modular
- Nueva estructura modular en `/app/backend/app/` (~4,320 líneas en 23 archivos)
- **98 rutas API** funcionando en la aplicación modular standalone
- **12 routers modulares completamente integrados en server.py**:
  - ✅ `auth.py`: Login, registro, verificación email, recuperación contraseña
  - ✅ `users.py`: Gestión de usuarios, roles, permisos
  - ✅ `admin.py`: Administración del sistema, municipios empresa
  - ✅ `catalogos.py`: Catálogos del sistema, health check
  - ✅ `predios.py`: CRUD de predios, búsquedas, estadísticas
  - ✅ `petitions.py`: Crear/listar peticiones, asignar gestores
  - ✅ `notifications.py`: Sistema de notificaciones
  - ✅ `resoluciones.py`: Plantillas, configuración, historial
  - ✅ `database.py`: Estado DB, backups, restauración
  - ✅ `certificados.py`: Generación, verificación, estadísticas
  - ✅ `actualizacion.py`: Proyectos de actualización catastral
  - ✅ `gdb.py`: Base gráfica, geometrías, estadísticas
- **services/**:
  - `email_service.py`: Envío de correos con templates HTML profesionales
- **utils/**:
  - `helpers.py`: Funciones de utilidad (formateo nombres, seguridad archivos)
- `main.py`: Aplicación FastAPI modular standalone

### Changed
- **server.py ahora importa y usa los 12 routers modulares**
- Los endpoints modulares tienen prioridad sobre el código legacy del monolito
- El código duplicado en server.py se mantiene como fallback (será eliminado gradualmente)

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
