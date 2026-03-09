# Propuesta: Mutaciones Encadenadas (Opción Híbrida)

## Flujo Actual del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUJO ACTUAL                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Usuario selecciona tipo de mutación (M1, M2, M3, etc.)        │
│                          │                                       │
│                          ▼                                       │
│   Busca radicado existente (opcional) o crea nuevo              │
│                          │                                       │
│                          ▼                                       │
│   Completa formulario de la mutación                            │
│                          │                                       │
│                          ▼                                       │
│   ┌─────────────────────────────────────────┐                   │
│   │  ¿Usuario puede aprobar?                │                   │
│   │  (Coordinador/Admin o con permiso)      │                   │
│   └─────────────────────────────────────────┘                   │
│              │                    │                              │
│           SÍ │                    │ NO                           │
│              ▼                    ▼                              │
│   ┌──────────────┐      ┌──────────────────┐                    │
│   │  Aprobación  │      │  Cola de         │                    │
│   │  Inmediata   │      │  Aprobación      │                    │
│   │  + PDF       │      │  (Pendiente)     │                    │
│   └──────────────┘      └──────────────────┘                    │
│              │                    │                              │
│              └────────┬───────────┘                              │
│                       ▼                                          │
│                   FIN (una mutación)                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Propuesta: Flujo con Mutaciones Encadenadas

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FLUJO PROPUESTO (HÍBRIDO)                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Usuario selecciona tipo de mutación (M1, M2, M3, etc.)                │
│                          │                                               │
│                          ▼                                               │
│   Busca radicado existente o crea nuevo                                 │
│                          │                                               │
│                          ▼                                               │
│   Completa formulario de la mutación                                    │
│                          │                                               │
│                          ▼                                               │
│   ┌─────────────────────────────────────────────────────────────┐       │
│   │  NUEVO: Panel "Mutaciones del Radicado"                      │       │
│   │  ┌─────────────────────────────────────────────────────────┐│       │
│   │  │ Radicado: RAD-2026-00123                                ││       │
│   │  │                                                          ││       │
│   │  │ ✓ Mutación 1: M6 Rectificación Área    [En curso]       ││       │
│   │  │   └─ Predio: 540030001... | Área: 150m² → 180m²         ││       │
│   │  │                                                          ││       │
│   │  │ ○ Mutación 2: (Vacío)                                   ││       │
│   │  │   └─ [+ Agregar mutación relacionada]                   ││       │
│   │  │                                                          ││       │
│   │  └─────────────────────────────────────────────────────────┘│       │
│   └─────────────────────────────────────────────────────────────┘       │
│                          │                                               │
│                          ▼                                               │
│   ┌─────────────────────────────────────────┐                           │
│   │  Al hacer clic en "+ Agregar mutación"  │                           │
│   └─────────────────────────────────────────┘                           │
│                          │                                               │
│                          ▼                                               │
│   ┌─────────────────────────────────────────────────────────────┐       │
│   │  Modal: Seleccionar tipo de mutación adicional               │       │
│   │  ┌─────────────────────────────────────────────────────────┐│       │
│   │  │ Tipo de mutación a agregar:                             ││       │
│   │  │                                                          ││       │
│   │  │  ○ M1 - Cambio de Propietario                           ││       │
│   │  │  ○ M2 - Desenglobe                                      ││       │
│   │  │  ○ M3 - Cambio Destino Económico                        ││       │
│   │  │  ● M2 - Desenglobe  ← Seleccionado                      ││       │
│   │  │                                                          ││       │
│   │  │  [Mismo predio] [Predio resultante] [Otro predio]       ││       │
│   │  │                                                          ││       │
│   │  │             [Cancelar]  [Agregar]                       ││       │
│   │  └─────────────────────────────────────────────────────────┘│       │
│   └─────────────────────────────────────────────────────────────┘       │
│                          │                                               │
│                          ▼                                               │
│   ┌─────────────────────────────────────────────────────────────┐       │
│   │  Panel actualizado con múltiples mutaciones                  │       │
│   │  ┌─────────────────────────────────────────────────────────┐│       │
│   │  │ Radicado: RAD-2026-00123                                ││       │
│   │  │                                                          ││       │
│   │  │ ✓ Mutación 1: M6 Rectificación Área    [Completada]     ││       │
│   │  │   └─ Predio: 540030001... | Área: 150m² → 180m²         ││       │
│   │  │                                                          ││       │
│   │  │ ◐ Mutación 2: M2 Desenglobe            [En curso]       ││       │
│   │  │   └─ Predio origen: 540030001...                        ││       │
│   │  │                                                          ││       │
│   │  │ ○ Mutación 3: (Vacío)                                   ││       │
│   │  │   └─ [+ Agregar mutación relacionada]                   ││       │
│   │  │                                                          ││       │
│   │  └─────────────────────────────────────────────────────────┘│       │
│   └─────────────────────────────────────────────────────────────┘       │
│                          │                                               │
│                          ▼                                               │
│   ┌─────────────────────────────────────────┐                           │
│   │  Opciones de aprobación:                │                           │
│   │  ○ Aprobar individualmente (por etapas) │                           │
│   │  ● Aprobar todo el paquete              │                           │
│   └─────────────────────────────────────────┘                           │
│                          │                                               │
│                          ▼                                               │
│   ┌─────────────────────────────────────────┐                           │
│   │  Generación de resolución:              │                           │
│   │  - Una resolución con todas las         │                           │
│   │    mutaciones del radicado              │                           │
│   │  - O resoluciones separadas             │                           │
│   └─────────────────────────────────────────┘                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Ubicación en la Interfaz Actual

### Opción A: Panel lateral en el formulario de mutación

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Mutaciones y Resoluciones                                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [M1] [M2] [M3] [M4] [M5] [Rect.Área] [Comp] [Bloqueo]   ← Tabs actuales│
│                                                                          │
│  ┌────────────────────────────────┬─────────────────────────────────┐   │
│  │                                │                                  │   │
│  │   FORMULARIO DE MUTACIÓN       │   PANEL: Radicado RAD-2026-001  │   │
│  │   (70% del ancho)              │   (30% del ancho)               │   │
│  │                                │                                  │   │
│  │   Radicado: [RAD-2026-001  ▼]  │   ┌──────────────────────────┐  │   │
│  │                                │   │ Mutaciones en este       │  │   │
│  │   Municipio: [Ábrego       ▼]  │   │ radicado:                │  │   │
│  │                                │   │                          │  │   │
│  │   Predio: [Buscar...]          │   │ 1. M6 Rect.Área ✓        │  │   │
│  │                                │   │    540030001...          │  │   │
│  │   ... más campos ...           │   │                          │  │   │
│  │                                │   │ 2. M2 Desenglobe ◐       │  │   │
│  │                                │   │    (En edición)          │  │   │
│  │                                │   │                          │  │   │
│  │                                │   │ [+ Agregar mutación]     │  │   │
│  │                                │   └──────────────────────────┘  │   │
│  │                                │                                  │   │
│  │   [Guardar Borrador] [Enviar]  │   [Aprobar Todo] [Por etapas]   │   │
│  │                                │                                  │   │
│  └────────────────────────────────┴─────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Opción B: Sección colapsable arriba del formulario

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Mutaciones y Resoluciones                                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [M1] [M2] [M3] [M4] [M5] [Rect.Área] [Comp] [Bloqueo]                  │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ 📋 Radicado: RAD-2026-00123                            [▼ Ver]  │    │
│  │                                                                  │    │
│  │  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────────────┐  │    │
│  │  │ M6 ✓    │ → │ M2 ◐    │ → │ ???     │   │ [+ Agregar]     │  │    │
│  │  │Rect.Área│   │Desenglobe│   │         │   │                 │  │    │
│  │  └─────────┘   └─────────┘   └─────────┘   └─────────────────┘  │    │
│  │                                                                  │    │
│  │  Estado: 2 de 2 mutaciones completadas | [Aprobar Paquete]      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ═══════════════════════════════════════════════════════════════════    │
│                                                                          │
│  Formulario M2 - Desenglobe                                             │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Municipio: [Ábrego ▼]                                          │    │
│  │  ...                                                            │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Modelo de Datos Propuesto

### Colección: `radicados_mutacion`

```javascript
{
  "_id": ObjectId,
  "id": "RAD-2026-00123",
  "numero": "RAD-2026-00123",
  "fecha_creacion": ISODate,
  "municipio": "Ábrego",
  "solicitante": {
    "nombre": "Juan Pérez",
    "documento": "12345678",
    "telefono": "3001234567",
    "email": "juan@email.com"
  },
  "estado": "EN_PROCESO" | "PENDIENTE_APROBACION" | "APROBADO" | "RECHAZADO",
  "mutaciones": [
    {
      "orden": 1,
      "solicitud_id": "uuid-mutacion-1",
      "tipo": "RECTIFICACION_AREA",
      "estado": "COMPLETADA",
      "predio_id": "uuid-predio"
    },
    {
      "orden": 2,
      "solicitud_id": "uuid-mutacion-2",
      "tipo": "M2",
      "subtipo": "desenglobe",
      "estado": "EN_EDICION",
      "predio_id": "uuid-predio"
    }
  ],
  "modo_aprobacion": "PAQUETE" | "ETAPAS",
  "resolucion_id": null,
  "creado_por_id": "user-uuid",
  "creado_por_nombre": "Admin User"
}
```

### Modificación a `solicitudes_mutacion`

```javascript
{
  // ... campos existentes ...
  
  // NUEVOS CAMPOS:
  "radicado_padre_id": "RAD-2026-00123",  // Referencia al radicado agrupador
  "orden_en_radicado": 2,                  // Orden de ejecución
  "depende_de": "uuid-mutacion-1",         // ID de mutación previa (opcional)
  "predios_heredados": ["uuid-predio-1"],  // Predios de mutación anterior
}
```

---

## Casos de Uso Comunes

### Caso 1: Rectificación + Desenglobe
```
1. Usuario crea radicado
2. Agrega M6 (Rectificación de Área) → Corrige área del predio
3. Agrega M2 (Desenglobe) → Divide el predio ya rectificado
4. Aprueba todo junto → Una sola resolución
```

### Caso 2: Cambio Propietario + Actualización Avalúo
```
1. Usuario crea radicado
2. Agrega M1 (Cambio Propietario) → Nuevo dueño
3. Agrega M4 (Revisión Avalúo) → Actualiza valor
4. Aprueba por etapas → Dos resoluciones separadas
```

### Caso 3: Englobe + Cambio Destino
```
1. Usuario crea radicado
2. Agrega M2 (Englobe) → Une dos predios
3. Agrega M3 (Cambio Destino) → El predio resultante cambia uso
4. Aprueba todo junto → Una sola resolución
```

---

## Plan de Implementación

### Fase 1: Backend (3-4 días)
- [ ] Crear colección `radicados_mutacion`
- [ ] Modificar modelo `solicitudes_mutacion`
- [ ] Endpoints CRUD para radicados con múltiples mutaciones
- [ ] Lógica de validación de dependencias entre mutaciones
- [ ] Generación de resolución unificada

### Fase 2: Frontend (3-4 días)
- [ ] Componente `RadicadoPanel` (panel lateral/superior)
- [ ] Modal para agregar mutación relacionada
- [ ] Indicadores visuales de estado por mutación
- [ ] Flujo de aprobación (paquete vs etapas)

### Fase 3: Testing y Ajustes (2 días)
- [ ] Tests de integración
- [ ] Pruebas con casos de uso reales
- [ ] Ajustes de UX según feedback

---

## Preguntas para el Usuario

1. **¿Cuáles son las combinaciones más frecuentes de mutaciones?**
   - Ejemplo: Rectificación + Desenglobe, Cambio Propietario + Avalúo, etc.

2. **¿La resolución debe ser única o separada por mutación?**
   - Una resolución con todo vs. una resolución por cada mutación

3. **¿Se debe poder editar mutaciones ya completadas dentro del paquete?**
   - Antes de aprobar todo el radicado

4. **¿Hay restricciones de orden?**
   - Ejemplo: No se puede hacer desenglobe antes de rectificar área
