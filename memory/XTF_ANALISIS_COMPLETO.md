# Análisis Completo para Generación XTF - LADM_COL SINIC V1.0

**Fecha de análisis:** 10 Febrero 2026
**Estado:** EN ESPERA - Requiere definiciones del usuario

---

## Archivos de Referencia Guardados

| Archivo | Ubicación | Descripción |
|---------|-----------|-------------|
| Ejemplo XTF Real | `/app/xtf_analysis/ejemplo_real.xtf` | Municipio 54344 (Hacarí), 6.5 MB |
| Prevalidador SINIC | `/app/xtf_analysis/prevalidador.zip` | Instalador MSI + manuales |
| Documentación | `/app/memory/XTF_LADM_COL_SINIC.md` | Especificaciones técnicas |

---

## Estructura del Archivo XTF (14 clases)

| Clase | Registros (Ejemplo) | Descripción |
|-------|---------------------|-------------|
| `RIC_Predio` | 1,674 | Información del predio |
| `RIC_Terreno` | 197 | Geometría del terreno (EPSG:9377) |
| `RIC_Interesado` | 1,546 | Propietarios (personas naturales/jurídicas) |
| `RIC_AgrupacionInteresados` | 167 | Grupos de propietarios |
| `RIC_Derecho` | 1,674 | Relación propietario-predio |
| `RIC_FuenteAdministrativa` | 1,674 | Trazabilidad (resoluciones) |
| `RIC_Construccion` | 221 | Construcciones con geometría |
| `RIC_UnidadConstruccion` | 8 | Unidades de construcción |
| `RIC_CaracteristicasUnidadConstruccion` | 8 | Características de construcción |
| `RIC_TramiteCatastral` | 1 | Información del trámite |
| `RIC_GestorCatastral` | 1 | Asomunicipios (fijo) |
| `RIC_OperadorCatastral` | 1 | Asomunicipios (fijo) |
| `ric_predio_informalidad` | 104 | Relación predios informales |
| `ric_predio_tramitecatastral` | 1 | Relación predio-trámite |

---

## Campos por Clase

### RIC_Predio
```
- Espacio_De_Nombres: "RIC_PREDIO" (fijo)
- Local_Id: Secuencial
- Comienzo_Vida_Util_Version: Fecha ISO
- Nombre: direccion del predio
- Tipo: Predio.Privado | Predio.Publico.Uso_Publico | Predio.Publico.Patrimonial
- Departamento: codigo_predial_nacional[0:2]
- Municipio: codigo_predial_nacional[2:5]
- Codigo_Homologado: codigo_homologado
- Numero_Predial: codigo_predial_nacional (30 dígitos)
- Numero_Predial_Anterior: Código de 20 dígitos
- Direccion.Tipo_Direccion: "No_Estructurada"
- Direccion.Es_Direccion_Principal: "true"
- Direccion.Nombre_Predio: direccion
- Condicion_Predio: NPH | PH.Unidad_Predial | Mejoras
- Destinacion_Economica: Agropecuario | Habitacional | Comercial | etc.
- Avaluo_Catastral: avaluo
- Zona: Rural | Urbana
- Vigencia_Actualizacion_Catastral: YYYY-01-01
- Estado: "Activo"
- Catastro: "Ley14"
- ric_gestorcatastral: REF al TID del gestor
- ric_operadorcatastral: REF al TID del operador
```

### RIC_Interesado
```
- Espacio_De_Nombres: "RIC_INTERESADO"
- Local_Id: Secuencial
- Comienzo_Vida_Util_Version: Fecha ISO
- Nombre: nombre_propietario completo
- Tipo: Persona_Natural | Persona_Juridica
- Tipo_Documento: Cedula_Ciudadania | NIT | Cedula_Extranjeria | etc.
- Documento_Identidad: numero_documento (padded a 12 caracteres)
- Primer_Nombre: primer_nombre
- Segundo_Nombre: segundo_nombre (opcional)
- Primer_Apellido: primer_apellido
- Segundo_Apellido: segundo_apellido (opcional)
- Razon_Social: (solo para Persona_Juridica)
```

### RIC_Terreno
```
- Espacio_De_Nombres: "RIC_TERRENO"
- Local_Id: Secuencial
- Comienzo_Vida_Util_Version: Fecha ISO
- Dimension: "Dim2D"
- Relacion_Superficie: "En_Rasante"
- Geometria: ISO19107_PLANAS_V3_0.GM_MultiSurface3D (coordenadas EPSG:9377)
- Area_Terreno: area_terreno del predio
- Area_Digital_Gestor: área calculada de la geometría
```

### RIC_Derecho
```
- Espacio_De_Nombres: "RIC_DERECHO"
- Local_Id: Secuencial
- Comienzo_Vida_Util_Version: Fecha ISO
- interesado: REF al TID del propietario o agrupación
- unidad: REF al TID del predio
- Tipo: "Dominio"
- Fraccion_Derecho: 1.0 si único propietario, 1/n si compartido
```

### RIC_FuenteAdministrativa
```
- Espacio_De_Nombres: "RIC_FUENTEADMINISTRATIVA"
- Local_Id: Secuencial
- Estado_Disponibilidad: "Desconocido"
- Tipo_Principal: "Otro"
- Tipo: Sin_Documento | Resolucion | Escritura_Publica
- Numero_Resolucion: (si existe)
- Fecha_Resolucion: (si existe)
```

---

## Valores Enumerados (Dominios)

### Tipo_Documento
- Cedula_Ciudadania
- NIT

### Tipo (Predio)
- Predio.Privado
- Predio.Publico.Uso_Publico
- Predio.Publico.Patrimonial

### Condicion_Predio
- NPH (No Propiedad Horizontal)
- PH.Unidad_Predial
- Mejoras

### Destinacion_Economica
- Agricola
- Agropecuario
- Comercial
- Cultural
- Educativo
- Habitacional
- Institucional
- Lote_Urbanizable_No_Urbanizado
- Lote_Urbanizado_No_Construido
- Recreacional
- Religioso
- Salubridad

### Zona
- Rural
- Urbana

### Clasificacion_Mutacion (para entregas parciales)
- Mutacion_Quinta_Clase

---

## Mapeos Necesarios

### Destino Económico (BD → XTF)
```python
MAPEO_DESTINO = {
    'A': 'Habitacional',
    'B': 'Industrial',
    'C': 'Comercial',
    'D': 'Agropecuario',
    'E': 'Minero',
    'F': 'Cultural',
    'G': 'Recreacional',
    'H': 'Salubridad',
    'I': 'Institucional',
    'J': 'Educativo',
    'K': 'Religioso',
    'L': 'Agricola',
    'M': 'Pecuario',
    'N': 'Agroindustrial',
    'O': 'Forestal',
    'P': 'Uso_Publico',
    'Q': 'Lote_Urbanizable_No_Urbanizado',
    'R': 'Lote_Urbanizado_No_Construido',
    'S': 'Lote_No_Urbanizable',
    'T': 'Servicios_Especiales'
}
```

### Tipo Documento (BD → XTF)
```python
MAPEO_TIPO_DOC = {
    'C': 'Cedula_Ciudadania',
    'E': 'Cedula_Extranjeria',
    'N': 'NIT',
    'T': 'Tarjeta_Identidad',
    'P': 'Pasaporte',
    'R': 'Registro_Civil'
}
```

### Zona (derivada del código predial)
```python
def derivar_zona(codigo_predial_nacional):
    # Posición 6 del código (índice 5)
    zona_char = codigo_predial_nacional[5] if len(codigo_predial_nacional) > 5 else '0'
    return 'Rural' if zona_char == '0' else 'Urbana'
```

---

## Estado de Datos por Municipio

| Municipio | Predios | Geometrías | Cobertura | Con Resolución |
|-----------|---------|------------|-----------|----------------|
| Ábrego | 44,476 | 9,894 | 22.2% | ? |
| Cáchira | 15,100 | 3,591 | 23.8% | ? |
| San Calixto | 12,996 | 2,854 | 22.0% | ? |
| La Playa | 8,672 | 1,918 | 22.1% | ? |
| Bucarasica | 6,682 | 1,431 | 21.4% | ? |
| Hacarí | 6,836 | 0 | 0% | 8% |
| Sardinata | 34,616 | 0 | 0% | ? |
| Convención | 22,672 | 0 | 0% | ? |
| El Carmen | 17,896 | 0 | 0% | ? |
| El Tarra | 19,988 | 0 | 0% | ? |
| Río de Oro | 22,663 | 0 | 0% | ? |
| Teorama | 20,634 | 0 | 0% | ? |

---

## 🔴 DATOS FALTANTES CRÍTICOS (Bloqueantes)

### 1. Tipo de Predio
**Campo XTF:** `Tipo`
**Valores:** `Predio.Privado`, `Predio.Publico.Uso_Publico`, `Predio.Publico.Patrimonial`
**Estado:** NO EXISTE en la base de datos
**Pregunta pendiente:** ¿Cómo identificar si un predio es privado o público?

### 2. Condición del Predio
**Campo XTF:** `Condicion_Predio`
**Valores:** `NPH`, `PH.Unidad_Predial`, `Mejoras`
**Estado:** NO EXISTE en la base de datos
**Pregunta pendiente:** ¿Cómo identificar si es Propiedad Horizontal o Mejora?

### 3. Número Predial Anterior
**Campo XTF:** `Numero_Predial_Anterior`
**Formato:** Código de 20 dígitos (anterior a homologación)
**Estado:** El campo `numero_predio` tiene solo 15 dígitos
**Pregunta pendiente:** ¿De dónde obtener el código de 20 dígitos?

---

## Transformación de Coordenadas

**Origen:** WGS84 (EPSG:4326) - Lon/Lat en grados decimales
**Destino:** MAGNA-SIRGAS/Origen Nacional (EPSG:9377) - Metros planos

**Ejemplo de coordenadas en XTF:**
```xml
<COORD>
  <C1>4984002.980</C1>  <!-- Norte (metros) -->
  <C2>2477879.851</C2>  <!-- Este (metros) -->
  <C3>0.000</C3>        <!-- Elevación -->
</COORD>
```

**Rango típico para Norte de Santander:**
- C1 (Norte): ~4,979,000 - ~4,993,000
- C2 (Este): ~2,472,000 - ~2,486,000

**Librería requerida:** `pyproj`

---

## Estructura XML del XTF

```xml
<?xml version="1.0" encoding="UTF-8"?>
<TRANSFER xmlns="http://www.interlis.ch/INTERLIS2.3">
  <HEADERSECTION SENDER="ili2pg-..." VERSION="2.3">
    <MODELS>
      <MODEL NAME="INTERLIS_TOPOLOGY" VERSION="2017-09-19"/>
      <MODEL NAME="ISO19107_PLANAS_V3_0" VERSION="2016-03-07"/>
      <MODEL NAME="LADM_COL_V3_1" VERSION="V1.2.0"/>
      <MODEL NAME="Modelo_Aplicacion_LADMCOL_RIC_V0_1"/>
    </MODELS>
  </HEADERSECTION>
  <DATASECTION>
    <Modelo_Aplicacion_LADMCOL_RIC_V0_1.RIC BID="...">
      <!-- RIC_AgrupacionInteresados -->
      <!-- RIC_Interesado -->
      <!-- RIC_Predio -->
      <!-- RIC_Terreno -->
      <!-- RIC_Construccion -->
      <!-- RIC_UnidadConstruccion -->
      <!-- RIC_CaracteristicasUnidadConstruccion -->
      <!-- RIC_Derecho -->
      <!-- RIC_FuenteAdministrativa -->
      <!-- RIC_TramiteCatastral -->
      <!-- RIC_GestorCatastral -->
      <!-- RIC_OperadorCatastral -->
      <!-- col_miembros -->
      <!-- ric_predio_informalidad -->
      <!-- ric_predio_tramitecatastral -->
    </Modelo_Aplicacion_LADMCOL_RIC_V0_1.RIC>
  </DATASECTION>
</TRANSFER>
```

---

## Próximos Pasos (cuando se retome)

1. **Definir con el usuario:**
   - Cómo identificar Tipo de Predio (privado/público)
   - Cómo identificar Condición del Predio (NPH/PH/Mejora)
   - Fuente del Número Predial Anterior de 20 dígitos

2. **Cargar geometrías GDB** para municipios faltantes (especialmente Hacarí si se quiere replicar el ejemplo)

3. **Implementar generador XTF:**
   - Instalar pyproj para transformación de coordenadas
   - Crear módulo `/app/backend/xtf_generator.py`
   - Crear endpoint `/api/xtf/generar/{municipio}`
   - Crear UI en frontend

4. **Validar con prevalidador SINIC**

---

## Relaciones Entre Entidades

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

## Notas Adicionales

- El ejemplo XTF es del municipio **54344 (Hacarí)** pero en la BD no hay geometrías cargadas para ese municipio
- Para primera entrega (censo completo) se puede usar `Tipo: Sin_Documento` en RIC_FuenteAdministrativa
- Para entregas parciales se requiere número de resolución y fecha
- Las coordenadas en el XTF usan C1=Norte, C2=Este, C3=Elevación (siempre 0.000 para 2D)
