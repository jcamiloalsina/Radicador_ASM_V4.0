# Referencia: Asistente LADM-COL (SwissTierras Colombia)

**Fecha de análisis:** 19 Febrero 2026
**Fuente:** https://swisstierrascolombia.github.io/Asistente-LADM-COL/index.html
**Estado:** GUARDADO PARA REFERENCIA FUTURA

---

## ¿Qué es el Asistente LADM-COL?

Es un **plugin para QGIS** desarrollado por SwissTierras Colombia que facilita la captura y gestión de datos catastrales siguiendo el estándar **LADM-COL** (Land Administration Domain Model adaptado para Colombia, basado en ISO 19152).

---

## Módulos y Funcionalidades

### 1. Administración de Datos
- Crear estructura LADM-COL en base de datos
- Importar datos (formato XTF)
- Exportar datos (formato XTF)

### 2. Captura y Estructuración de Datos
- **Topografía y representación:** Puntos de levantamiento, linderos
- **Unidad Espacial:** Terrenos, construcciones, unidades de construcción, servidumbres
- **Unidad Administrativa Básica:** Predios
- **Interesado:** Personas naturales/jurídicas, agrupaciones
- **RRR:** Derechos, restricciones, responsabilidades
- **Fuentes:** Documentos administrativos y espaciales
- **Mapeo de campos:** Transformación de datos externos

### 3. Barra de Herramientas
- Sistema de transición
- Crear objetos de levantamiento
- Cargar capas
- Construir linderos
- Mover nodos
- Llenar PuntosCCL
- Llenar más y menos CCL

### 4. Gestión de Insumos
- **ETL de Insumos:** Transformación desde sistemas legacy (COBOL)
- **Reporte de Omisiones y Comisiones:** Comparación de datos

### 5. Captura de Datos en Campo
- Asignar predios a gestores
- Recolección de datos en campo (móvil)
- Sincronizar datos de campo
- ETL entre modelos (Captura → Aplicación)

### 6. Reglas de Calidad
- **Reglas para Puntos:** Duplicados, fuera de límites
- **Reglas para Líneas:** Cruces, superposiciones
- **Reglas para Polígonos:** Huecos, superposiciones, áreas
- **Consistencia lógica:** Relaciones entre entidades

### 7. Consulta de Datos
- Consulta alfanumérica (por atributos)
- Consulta espacial (por ubicación)

### 8. Reportes
- **Anexo 17:** Reporte catastral estándar
- **Plano ANT:** Plano para Agencia Nacional de Tierras

### 9. Identificación de Novedades
- Comparar bases de datos
- Detectar cambios entre vigencias

### 10. Sistema de Transición
- Autenticación con servicios externos
- Gestión de tareas

---

## Relevancia para Asomunicipios

| Funcionalidad | Utilidad | Notas |
|---------------|----------|-------|
| **Exportar XTF** | ✅ Alta | Referencia de estructura XML |
| **Reglas de calidad** | ✅ Alta | Validar geometrías antes de exportar |
| **ETL de insumos** | ⚠️ Media | Solo si hay datos legacy COBOL |
| **Captura en campo** | ❌ Baja | Ya existe sistema propio |
| **Importar XTF** | ⚠️ Media | Para cargar datos de IGAC |
| **Prevalidador** | ✅ Alta | Ya descargado en `/app/xtf_analysis/` |

---

## Conceptos Clave del Modelo LADM-COL

### Unidades Espaciales
- **Terreno:** Porción de tierra con geometría
- **Construcción:** Edificación con geometría
- **Unidad de Construcción:** Parte de una construcción
- **Servidumbre:** Restricción espacial

### Unidad Administrativa Básica (Predio)
- Agrupa terrenos y construcciones
- Tiene código predial de 30 dígitos
- Tiene código homologado

### Interesados
- **Persona Natural:** Con nombre completo desagregado
- **Persona Jurídica:** Con razón social y NIT
- **Agrupación de Interesados:** Grupo de propietarios

### RRR (Derechos, Restricciones, Responsabilidades)
- **Derecho:** Dominio, posesión, ocupación
- **Restricción:** Hipoteca, embargo, servidumbre
- **Responsabilidad:** Obligaciones sobre el predio

### Fuentes
- **Administrativa:** Escrituras, resoluciones, sentencias
- **Espacial:** Levantamientos topográficos, planos

---

## Estructura de Relaciones (Para XTF)

```
RIC_Predio ←────────── RIC_Derecho ──────────→ RIC_Interesado
     │                      │                        │
     │                      │                        │
     └── ric_gestorcatastral                        │
     └── ric_operadorcatastral         RIC_AgrupacionInteresados
     └── RIC_FuenteAdministrativa              ↑
                                               │
                                          col_miembros
                                               │
                                               ↓
                                         RIC_Interesado[]

RIC_Terreno ←── ue_ric_predio ──→ RIC_Predio

RIC_Construccion ←── RIC_UnidadConstruccion ←── RIC_CaracteristicasUnidadConstruccion
```

---

## URLs de Documentación

| Sección | URL |
|---------|-----|
| **Principal** | https://swisstierrascolombia.github.io/Asistente-LADM-COL/index.html |
| **Introducción** | https://swisstierrascolombia.github.io/Asistente-LADM-COL/introduccion.html |
| **Configuración** | https://swisstierrascolombia.github.io/Asistente-LADM-COL/configuracion.html |
| **Administración datos** | https://swisstierrascolombia.github.io/Asistente-LADM-COL/administracion_de_datos.html |
| **Captura datos** | https://swisstierrascolombia.github.io/Asistente-LADM-COL/captura_y_estructura_de_datos.html |
| **Reglas calidad** | https://swisstierrascolombia.github.io/Asistente-LADM-COL/reglas_de_calidad.html |
| **Reportes** | https://swisstierrascolombia.github.io/Asistente-LADM-COL/reportes.html |
| **Tutorial** | https://swisstierrascolombia.github.io/Asistente-LADM-COL/tutorial/introduccion.html |

---

## Próximos Pasos (Cuando se retome XTF)

1. **Revisar cómo el Asistente genera relaciones** entre Predio↔Derecho↔Interesado
2. **Estudiar las reglas de calidad** para validar geometrías
3. **Usar el prevalidador SINIC** (ya descargado) para validar XTF generados
4. **Considerar importar datos** de IGAC si es necesario

---

## Archivos Relacionados

| Archivo | Descripción |
|---------|-------------|
| `/app/memory/XTF_ANALISIS_COMPLETO.md` | Análisis detallado de estructura XTF |
| `/app/memory/XTF_LADM_COL_SINIC.md` | Especificaciones técnicas SINIC |
| `/app/xtf_analysis/ejemplo_real.xtf` | Ejemplo XTF de Hacarí (6.5 MB) |
| `/app/xtf_analysis/prevalidador.zip` | Herramienta de prevalidación IGAC |

---

**Licencia del Asistente:** Creative Commons Atribución-CompartirIgual 4.0 Internacional
**Autor:** SwissTierras Colombia (2017-presente)
