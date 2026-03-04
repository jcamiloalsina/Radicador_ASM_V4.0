# Módulo de Pendientes y Aprobaciones

## Descripción
El módulo de Pendientes gestiona el flujo de trabajo de aprobaciones del sistema. Centraliza todas las solicitudes que requieren revisión y aprobación por parte de coordinadores o usuarios con permisos de aprobación.

## Componentes

### 1. Vista Unificada de Pendientes
**Archivo**: `frontend/src/pages/Pendientes.js`

#### Funcionalidades
- Lista unificada de todos los pendientes
- Filtros por tipo de solicitud
- Acciones rápidas de aprobación/rechazo
- Historial de acciones realizadas

### 2. Tipos de Solicitudes

| Tipo | Origen | Color |
|------|--------|-------|
| Modificación | Cambios propuestos a predios | Azul |
| Predio Nuevo | Predios creados por gestores | Verde |
| Mutación M1/M2 | Solicitudes de mutación | Púrpura |
| Reaparición | Predios eliminados a restaurar | Ámbar |

## Flujo de Aprobación

### Vista General
```
┌─────────────────────────────────────────────────────────────┐
│                    PESTAÑA "PENDIENTES"                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ Pendientes por  │  │    Historial    │                   │
│  │    Aprobar      │  │                 │                   │
│  │      (15)       │  │                 │                   │
│  └─────────────────┘  └─────────────────┘                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 🔵 Modificación - NPN: 5400300010...               │    │
│  │    Municipio: Sardinata | Por: Juan Pérez          │    │
│  │    [Ver] [Aprobar] [Rechazar]                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 🟢 Predio Nuevo - NPN: 5400300020...               │    │
│  │    Municipio: Ábrego | Por: María García           │    │
│  │    [Ver] [Aprobar] [Devolver]                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 🟣 M2 Desenglobe - Radicado: RAD-2026-001          │    │
│  │    Municipio: Tibú | Por: Carlos López             │    │
│  │    2 cancelados → 5 inscritos                      │    │
│  │    [Ver] [Aprobar] [Rechazar]                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Estados por Tipo

#### Modificaciones de Predios
```
propuesto ─► en_revision ─► aprobado/rechazado
                 │
                 └─► devuelto (para correcciones)
```

#### Predios Nuevos
```
borrador ─► revision ─► aprobado/devuelto/eliminado
```

#### Mutaciones (M1/M2)
```
borrador ─► pendiente_cartografia ─► pendiente_aprobacion ─► aprobado/rechazado
                     │
                     └─► (gestor de apoyo hace cartografía)
```

#### Reapariciones
```
solicitado ─► pendiente_aprobacion ─► aprobado/rechazado
```

## API Endpoints

### Pendientes Generales
```
GET    /api/pendientes/resumen               # Conteo por tipo
GET    /api/pendientes/todos                 # Lista unificada
```

### Modificaciones
```
GET    /api/predios/cambios/pendientes       # Cambios pendientes
POST   /api/predios/cambios/{id}/aprobar     # Aprobar cambio
POST   /api/predios/cambios/{id}/rechazar    # Rechazar cambio
POST   /api/predios/cambios/{id}/devolver    # Devolver para corrección
```

### Predios Nuevos
```
GET    /api/predios-nuevos                   # Listar predios nuevos
GET    /api/predios-nuevos/por-estado        # Por estado
POST   /api/predios-nuevos/{id}/accion       # Aprobar/Devolver/Eliminar
```

### Mutaciones
```
GET    /api/solicitudes-mutacion/pendientes-aprobacion  # Pendientes
POST   /api/solicitudes-mutacion/{id}/accion            # Acción
```

### Reapariciones
```
GET    /api/predios/reapariciones            # Listar reapariciones
POST   /api/predios/reapariciones/{npn}/accion  # Aprobar/Rechazar
```

### Historial
```
GET    /api/pendientes/historial             # Historial de acciones
GET    /api/predios/cambios/historial        # Historial de cambios
```

## Modelo de Datos

### Cambio Pendiente
```javascript
{
  id: String,
  tipo_cambio: String,        // modificacion, correccion, actualizacion
  predio_id: String,
  predio_actual: {...},       // Snapshot del predio actual
  datos_propuestos: {...},    // Nuevos datos
  campos_modificados: [String], // Lista de campos que cambian
  
  // Workflow
  estado: String,             // pendiente, en_revision, aprobado, rechazado
  propuesto_por: String,
  propuesto_por_nombre: String,
  fecha_propuesta: String,
  
  // Aprobación
  aprobado_por: String,
  aprobado_por_nombre: String,
  fecha_aprobacion: String,
  
  // Rechazo/Devolución
  motivo_rechazo: String,
  observaciones: String,
  
  // Radicado asociado
  radicado_numero: String,
  peticion_id: String,
  
  created_at: String,
  updated_at: String
}
```

### Predio Nuevo (Pendiente)
```javascript
{
  // Datos del predio
  id: String,
  codigo_predial_nacional: String,
  municipio: String,
  ...otros_campos_predio,
  
  // Workflow
  estado_flujo: String,       // borrador, revision, aprobado, devuelto
  gestor_creador_id: String,
  gestor_creador_nombre: String,
  
  // Apoyo cartográfico
  gestor_apoyo_id: String,
  gestor_apoyo_nombre: String,
  fecha_asignacion_apoyo: String,
  
  // Historial
  historial_flujo: [{
    estado: String,
    fecha: String,
    usuario: String,
    observacion: String
  }],
  
  // Aprobación
  aprobado_por: String,
  aprobado_por_nombre: String,
  fecha_aprobacion: String,
  
  // Radicado
  radicado_numero: String,
  
  created_at: String,
  updated_at: String
}
```

### Solicitud de Mutación
```javascript
{
  id: String,
  tipo: String,               // M1, M2
  subtipo: String,            // englobe, desenglobe_total, etc.
  
  // Estado
  estado: String,             // borrador, pendiente_cartografia, pendiente_aprobacion, aprobado
  
  // Datos de la mutación
  municipio: String,
  radicado: String,
  predios_cancelados: [...],
  predios_inscritos: [...],
  
  // Creador
  creado_por: String,
  creado_por_nombre: String,
  fecha_creacion: String,
  
  // Gestor de apoyo
  gestor_apoyo_id: String,
  gestor_apoyo_nombre: String,
  
  // Aprobación
  aprobado_por: String,
  fecha_aprobacion: String,
  
  // Resolución generada
  resolucion_id: String,
  numero_resolucion: String,
  
  observaciones: String,
  
  created_at: String
}
```

## Lógica de Aprobación

### Aprobar Modificación
```python
async def aprobar_cambio(cambio_id: str, user: dict):
    # Obtener cambio
    cambio = await db.cambios_pendientes.find_one({"id": cambio_id})
    if not cambio:
        raise HTTPException(404, "Cambio no encontrado")
    
    # Verificar permiso
    if not await check_permission(user, "approve_changes"):
        raise HTTPException(403, "Sin permiso de aprobación")
    
    # Aplicar cambios al predio
    await db.predios.update_one(
        {"id": cambio["predio_id"]},
        {"$set": cambio["datos_propuestos"]}
    )
    
    # Marcar como aprobado
    await db.cambios_pendientes.update_one(
        {"id": cambio_id},
        {"$set": {
            "estado": "aprobado",
            "aprobado_por": user["id"],
            "aprobado_por_nombre": user["full_name"],
            "fecha_aprobacion": datetime.utcnow().isoformat()
        }}
    )
    
    # Notificar al creador
    await crear_notificacion(
        user_id=cambio["propuesto_por"],
        titulo="Cambio aprobado",
        mensaje=f"Tu cambio al predio {cambio['predio_actual']['codigo_predial_nacional']} fue aprobado",
        enlace=f"/dashboard/predios/{cambio['predio_id']}"
    )
    
    return {"success": True}
```

### Aprobar Predio Nuevo
```python
async def aprobar_predio_nuevo(predio_id: str, user: dict):
    # Obtener predio
    predio = await db.predios_nuevos.find_one({"id": predio_id})
    if not predio:
        raise HTTPException(404, "Predio no encontrado")
    
    # Preparar datos para inserción
    predio_aprobado = {
        **predio,
        "vigencia": datetime.now().year,
        "aprobado_por": user["id"],
        "aprobado_por_nombre": user["full_name"],
        "fecha_aprobacion": datetime.utcnow().isoformat()
    }
    
    # Insertar en colección principal
    await db.predios.insert_one(predio_aprobado)
    
    # Eliminar de predios_nuevos
    await db.predios_nuevos.delete_one({"id": predio_id})
    
    # Notificar
    await crear_notificacion(
        user_id=predio["gestor_creador_id"],
        titulo="Predio aprobado",
        mensaje=f"El predio {predio['codigo_predial_nacional']} fue aprobado",
        enlace=f"/dashboard/predios"
    )
    
    return {"success": True, "predio_id": predio_id}
```

## Componente Frontend

### Lista Unificada de Pendientes
```javascript
const PendientesUnificados = () => {
  const [pendientes, setPendientes] = useState({
    modificaciones: [],
    prediosNuevos: [],
    mutaciones: [],
    reapariciones: []
  });
  
  const totalPendientes = 
    pendientes.modificaciones.length +
    pendientes.prediosNuevos.length +
    pendientes.mutaciones.length +
    pendientes.reapariciones.length;
  
  return (
    <div className="space-y-4">
      {/* Modificaciones */}
      {pendientes.modificaciones.map(mod => (
        <Card key={mod.id} className="border-l-4 border-l-blue-500">
          <CardContent>
            <Badge className="bg-blue-100 text-blue-800">Modificación</Badge>
            <p className="font-mono">{mod.datos_propuestos?.codigo_predial_nacional}</p>
            <div className="flex gap-2 mt-2">
              <Button size="sm" onClick={() => verDetalle(mod)}>Ver</Button>
              <Button size="sm" variant="success" onClick={() => aprobar(mod.id)}>
                Aprobar
              </Button>
              <Button size="sm" variant="destructive" onClick={() => rechazar(mod.id)}>
                Rechazar
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      
      {/* Predios Nuevos */}
      {pendientes.prediosNuevos.map(predio => (
        <Card key={predio.id} className="border-l-4 border-l-green-500">
          {/* Similar structure */}
        </Card>
      ))}
      
      {/* Mutaciones */}
      {pendientes.mutaciones.map(mut => (
        <Card key={mut.id} className="border-l-4 border-l-purple-500">
          {/* Similar structure */}
        </Card>
      ))}
      
      {/* Reapariciones */}
      {pendientes.reapariciones.map(reap => (
        <Card key={reap.codigo_predial_nacional} className="border-l-4 border-l-amber-500">
          {/* Similar structure */}
        </Card>
      ))}
      
      {totalPendientes === 0 && (
        <div className="text-center py-16">
          <CheckCircle className="w-16 h-16 mx-auto text-green-500" />
          <h3>¡Todo al día!</h3>
          <p>No hay solicitudes pendientes de aprobación</p>
        </div>
      )}
    </div>
  );
};
```

## Notificaciones

### Eventos que Generan Notificación

| Evento | Destinatario | Mensaje |
|--------|--------------|---------|
| Nueva solicitud | Coordinador | "Nueva solicitud de {tipo} pendiente" |
| Solicitud aprobada | Creador | "Tu solicitud fue aprobada" |
| Solicitud rechazada | Creador | "Tu solicitud fue rechazada: {motivo}" |
| Solicitud devuelta | Creador | "Tu solicitud requiere correcciones" |
| Asignación de apoyo | Gestor apoyo | "Se te asignó una solicitud de {tipo}" |

## Permisos Requeridos

| Acción | Permiso |
|--------|---------|
| Ver pendientes | `view_pendientes` |
| Aprobar cambios | `approve_changes` |
| Rechazar cambios | `approve_changes` |
| Devolver para corrección | `approve_changes` |
| Ver historial | `view_history` |

## Archivos Relacionados

### Backend
- `server.py`: Endpoints de pendientes (líneas 12000-15000)

### Frontend
- `pages/Pendientes.js`: Vista principal (3,054 líneas)
- `components/CambioDetailModal.js`: Modal de detalle
- `components/ApprovalActions.js`: Botones de acción
