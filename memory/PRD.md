# PRD - Sistema de Gestión Catastral ASOMUNICIPIOS

## Problema Original
Sistema de gestión catastral para ASOMUNICIPIOS que permite el registro, mutación y seguimiento de predios inmobiliarios. Incluye 7 tipos de mutaciones (M1-M7), bloqueo de predios, formularios de visita, y generación de documentos PDF/Excel.

## Usuarios del Sistema
- **Administrador/Aprobador**: Acceso completo, aprobación de resoluciones
- **Gestor**: Registro y gestión sin derechos de aprobación
- **Atención Usuario**: Gestión con derechos de aprobación

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
- Importación de Excel con validación de municipio
- Búsqueda unificada por nombre, CPN y matrícula
- Campo Estado Civil estandarizado en formularios

---

## Estado Actual del Proyecto (Actualizado: Diciembre 2025)

### Completado en Esta Sesión
- [x] **Panel de Progreso Visual para Importación Excel**
  - Lista de archivos con indicadores de estado (pendiente/procesando/exitoso/error)
  - Barra de progreso global animada
  - Estadísticas en tiempo real durante importación
  - Resumen final post-importación con contadores
  - Auto-detección de municipio desde nombre de archivo
- [x] **Corrección de Dropdowns "Cuadros por Fuera"**
  - Dropdowns de municipio en Bloqueo ahora se abren hacia arriba
  - Dropdowns de municipio en Complementación ahora se abren hacia arriba
  - Agregada rotación de flecha cuando dropdown está abierto
  - Aumentada altura máxima de dropdowns a 60 unidades

### Completado en Sesión Anterior
- [x] Columnas "Área Terreno" y "Área Construida" en tabla de predios
- [x] Corrección de dropdowns en modales de Bloqueo/Complementación (z-index)
- [x] Vigencia correcta en Predios Eliminados (migración ejecutada)
- [x] Búsqueda unificada en todos los módulos
- [x] Corrección de errores JS en M3/M4
- [x] Etiqueta "Rectificación de Área" restaurada
- [x] Campo ESTADO en PDFs/Excel corregido
- [x] Campo Estado Civil estandarizado en formularios
- [x] PDF M1 con matrícula y padding de 12 dígitos
- [x] Creación automática de directorio `/app/uploads`
- [x] Importación Excel con validación de municipio único

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
│   └── server.py          # MONOLITO - Requiere refactorización urgente
│   └── resolucion_pdf_generator_*.py (7 archivos)
└── frontend/
    └── src/
        ├── components/
        │   ├── conservacion/
        │   │   └── ImportR1R2Form.jsx  # MEJORADO - Panel de progreso visual
        │   └── ui/
        │       └── dialog.jsx          # MODIFICADO - overflow-visible por defecto
        └── pages/
            ├── Predios.js
            └── MutacionesResoluciones.js  # MODIFICADO - Dropdowns hacia arriba
```

## Integraciones 3rd Party
- ReportLab (PDFs)
- openpyxl (Excel)
- motor/pymongo (MongoDB)
- qrcode (QR en PDFs)

## Colecciones MongoDB Principales
- `predios`: Propiedades activas
- `predios_eliminados`: Propiedades eliminadas con `vigencia_origen` y `vigencia_eliminacion`
- `resoluciones`: Resoluciones de mutaciones

---
*Última actualización: Diciembre 2025*
