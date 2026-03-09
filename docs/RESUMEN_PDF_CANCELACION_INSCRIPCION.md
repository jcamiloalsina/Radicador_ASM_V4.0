# Resumen de Lógica CANCELACIÓN / INSCRIPCIÓN en PDFs de Resoluciones

## Definición Correcta:
- **CANCELACIÓN**: Datos ANTES de la modificación (datos antiguos/originales del predio)
- **INSCRIPCIÓN**: Datos NUEVOS después de la modificación (datos propuestos/actualizados)

---

## Estado por Tipo de Mutación:

### ✅ M1 - Cambio de Propietario (`resolucion_pdf_generator.py`)
- **Cancelación**: Usa `datos_anteriores` (de R1/R2 original) ✅
- **Inscripción**: Usa `datos_inscripcion` (datos nuevos del formulario) ✅
- **Matrícula**: Busca en múltiples fuentes, ya corregido ✅

### ✅ M2 - Desenglobe/Englobe (`resolucion_m2_pdf_generator.py`)
- **Cancelación**: Predios que se cancelan (predios_cancelados) ✅
- **Inscripción**: Predios nuevos resultantes (predios_inscritos) ✅
- **Matrícula**: Usa `obtener_datos_r1_r2()` ✅

### ✅ M3 - Cambio Destino Económico (`resolucion_m3_pdf_generator.py`)
- **Cancelación**: `destino_anterior`, `avaluo_anterior` ✅
- **Inscripción**: `destino_nuevo`, `avaluo_nuevo` ✅
- **Matrícula**: Usa `obtener_datos_r1_r2()` ✅

### ✅ M4 - Revisión de Avalúo (`resolucion_m4_pdf_generator.py`)
- **Cancelación**: `avaluo_anterior` ✅
- **Inscripción**: `avaluo_nuevo` ✅
- **Matrícula**: Usa `obtener_datos_r1_r2()` ✅

### ✅ M5 - Cancelación/Inscripción de Predio (`resolucion_m5_pdf_generator.py`)
- **Cancelación**: Para subtipo "cancelacion" - datos del predio a cancelar ✅
- **Inscripción**: Para subtipo "inscripcion" - datos del predio nuevo ✅
- **Matrícula**: Usa `obtener_datos_r1_r2()` ✅

### ✅ M6 - Rectificación de Área (`resolucion_m6_pdf_generator.py`)
- **Cancelación**: `area_terreno_anterior`, `area_construida_anterior`, `avaluo_anterior` ✅
- **Inscripción**: `area_terreno_nuevo`, `area_construida_nuevo`, `avaluo_nuevo` ✅
- **Matrícula**: Usa `obtener_datos_r1_r2()` ✅

### ✅ COMP - Complementación (`resolucion_complementacion_pdf_generator.py`)
- **Cancelación**: Datos originales del predio ✅
- **Inscripción**: Datos complementados/actualizados ✅
- **Matrícula**: Usa `obtener_datos_r1_r2()` ✅

---

## Problema Identificado: "Sin información" para Matrícula

### Causa Raíz:
La función `obtener_datos_r1_r2()` puede retornar vacío si:
1. El predio no tiene `r2_registros`
2. El campo `matricula_inmobiliaria` está vacío en R2

### Solución Implementada (M1):
```python
# Buscar matrícula en múltiples fuentes:
1. r2_registros[0].matricula_inmobiliaria
2. predio_original.matricula_inmobiliaria
3. datos_r1_r2.matricula_inmobiliaria
```

### Lugares donde aún puede mostrar "Sin información":
- Línea 467 en M3: `matricula = datos_r1_r2.get("matricula_inmobiliaria", "") or "Sin información"`
- Línea 292 en M4: `matricula = datos_r1_r2.get('matricula_inmobiliaria', '') or "Sin información"`
- Línea 241 en M5: `matricula = datos_r1_r2.get('matricula_inmobiliaria', '') or "Sin información"`
- Línea 155 en COMP: `matricula = datos_r1_r2.get('matricula_inmobiliaria', '') or ... or "Sin información"`

---

## Recomendación:
Actualizar la función `obtener_datos_r1_r2()` en cada generador para que también busque la matrícula directamente en el predio si no está en R2.
