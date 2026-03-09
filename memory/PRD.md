# PRD - Sistema de Gestión Catastral ASOMUNICIPIOS

## Problema Original
Sistema de gestión catastral para ASOMUNICIPIOS que permite el registro, mutación y seguimiento de predios inmobiliarios. Incluye 7 tipos de mutaciones (M1-M7), bloqueo de predios, formularios de visita, y generación de documentos PDF/Excel.

## Usuarios del Sistema
- **Administrador/Aprobador**: Acceso completo, aprobación de resoluciones
- **Gestor**: Registro y gestión sin derechos de aprobación
- **Atención Usuario**: Gestión con derechos de aprobación
- **Coordinador**: Acceso completo, incluido gestor de recursos

## Credenciales de Prueba
- Admin: `catastro@asomunicipios.gov.co` / `Asm*123*`
- Gestor: `gestor@emergent.co` / `Asm*123*`
- Atención: `atencion@emergent.co` / `Asm*123*`

## Funcionalidades Core Implementadas
- Dashboard de predios registrados con columnas de área
- 7 tipos de mutaciones (M1-M7)
- Bloqueo y desbloqueo de predios
- Predios eliminados con vigencia histórica
- Generación de PDFs con QR de verificación
- Importación de Excel con validación de municipio y panel de progreso visual
- Búsqueda unificada por nombre, CPN y matrícula
- Campo Estado Civil estandarizado en formularios
- **Gestor de Recursos** (explorador de archivos para admin/coordinadores)
- **Gestión de Usuarios unificada** (usuarios + permisos en una sola vista)

---

## Estado Actual del Proyecto (Actualizado: Diciembre 2025)

### Completado en Esta Sesión
- [x] **Gestor de Recursos** (FileManager.js)
  - Explorador de archivos completo para admin/coordinadores
  - Carpetas: backups, imports, exports, resoluciones, gdb_uploads, temp
  - Funcionalidades: listar, subir, descargar, eliminar archivos
  - Panel de almacenamiento con barra de progreso
  - Búsqueda de archivos y navegación con breadcrumbs
  - Creación de nuevas carpetas
  - Backend API completo (`/api/files/*`)
  
- [x] **Unificación de Gestión de Usuarios y Permisos**
  - Pestañas: Usuarios | Permisos | Base de Datos
  - Pestaña de Permisos integrada con:
    - Leyenda de permisos disponibles (GDB, R1/R2, Aprobar Cambios)
    - Lista de usuarios con checkboxes de permisos
    - Búsqueda por nombre, correo o rol
    - Guardado individual por usuario

- [x] **Mejoras UI de Dropdowns**
  - Dropdowns de Bloqueo y Complementación ahora se abren hacia arriba
  - Previene corte de opciones en modales con altura limitada
  - Animación de rotación de flecha al abrir

- [x] **Panel de Progreso Visual para Importación Excel**
  - Lista de archivos con indicadores de estado
  - Barra de progreso global animada
  - Estadísticas en tiempo real

### Completado en Sesiones Anteriores
- [x] Columnas "Área Terreno" y "Área Construida" en tabla de predios
- [x] Corrección de dropdowns en modales (z-index)
- [x] Vigencia correcta en Predios Eliminados
- [x] Búsqueda unificada en todos los módulos
- [x] Corrección de errores JS en M3/M4
- [x] Etiqueta "Rectificación de Área" restaurada
- [x] Campo ESTADO en PDFs/Excel corregido
- [x] PDF M1 con matrícula y padding de 12 dígitos
- [x] Creación automática de directorio `/app/uploads`

### Issues Pendientes
| Prioridad | Issue | Estado |
|-----------|-------|--------|
| P1 | Mass Desenglobe - predio original no se cancela | Verificación pendiente |
| P2 | PDFs históricos usando datos en vivo | No iniciado |
| P2 | Formulario Visita lento en móvil | No iniciado |
| P2 | Contador resoluciones no atómico | No iniciado |

### Tareas Pendientes
| Prioridad | Tarea | Estado |
|-----------|-------|--------|
| P1 | Refactorización server.py a routers | No iniciado |
| P1 | Refactorización MutacionesResoluciones.js | No iniciado |
| P1 | Test regresión completo 7 mutaciones | No iniciado |
| P2 | Refactorización PDF generators | No iniciado |
| P2 | Eliminar endpoints temporales migración | No iniciado |

### Tareas Futuras (Backlog)
- Mutaciones encadenadas (Rectificación -> Desenglobe)
- Exportación Excel de datos de Formulario Visita
- Exportación XTF
- App de Gestión de Correspondencia
- UI para reportes GDB
- Gráficos en dashboards

---

## Arquitectura Actual

```
/app/
├── backend/
│   └── server.py          # MONOLITO - Nuevos endpoints de File Manager agregados
│   └── resolucion_pdf_generator_*.py (7 archivos)
└── frontend/
    └── src/
        ├── components/
        │   ├── conservacion/
        │   │   └── ImportR1R2Form.jsx  # Panel de progreso visual
        │   └── ui/
        │       └── dialog.jsx          # overflow-visible por defecto
        ├── pages/
        │   ├── FileManager.js          # NUEVO - Gestor de Recursos
        │   ├── UserManagement.js       # MODIFICADO - Incluye pestaña de Permisos
        │   ├── Predios.js
        │   ├── MutacionesResoluciones.js  # Dropdowns hacia arriba
        │   └── DashboardLayout.js      # MODIFICADO - Nuevo menú
        └── App.js                      # MODIFICADO - Nueva ruta
```

## API Endpoints del Gestor de Recursos
- `GET /api/files/list?path=/` - Listar archivos y carpetas
- `POST /api/files/upload` - Subir archivo
- `GET /api/files/download?path=...` - Descargar archivo
- `DELETE /api/files/delete?path=...` - Eliminar archivo/carpeta
- `POST /api/files/create-folder` - Crear nueva carpeta

## Integraciones 3rd Party
- ReportLab (PDFs)
- openpyxl (Excel)
- motor/pymongo (MongoDB)
- qrcode (QR en PDFs)

## Colecciones MongoDB Principales
- `predios`: Propiedades activas
- `predios_eliminados`: Propiedades eliminadas con `vigencia_origen` y `vigencia_eliminacion`
- `resoluciones`: Resoluciones de mutaciones
- `users`: Usuarios con campo `permissions`

---
*Última actualización: Diciembre 2025*
