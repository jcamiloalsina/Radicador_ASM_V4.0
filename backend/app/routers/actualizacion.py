"""
Router de Actualización Catastral
Endpoints: proyectos, estadísticas, predios de proyecto
"""
import uuid
import logging
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from ..core.database import db
from ..core.security import get_current_user
from ..core.config import UserRole

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/actualizacion", tags=["Actualización Catastral"])


# ============================================================
# CONSTANTES
# ============================================================

class ProyectoEstado:
    ACTIVO = "activo"
    PAUSADO = "pausado"
    COMPLETADO = "completado"
    ARCHIVADO = "archivado"


# ============================================================
# MODELOS
# ============================================================

class ProyectoCreate(BaseModel):
    nombre: str
    municipio: str
    descripcion: Optional[str] = ""
    fecha_inicio: Optional[str] = None
    fecha_fin_estimada: Optional[str] = None


class ProyectoUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    estado: Optional[str] = None
    fecha_fin_estimada: Optional[str] = None


# ============================================================
# PROYECTOS
# ============================================================

@router.get("/proyectos")
async def listar_proyectos_actualizacion(
    estado: Optional[str] = None,
    municipio: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Lista todos los proyectos de actualización"""
    tiene_acceso = current_user['role'] in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR, UserRole.GESTOR]
    
    if not tiene_acceso:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    query = {}
    if estado:
        query["estado"] = estado
    if municipio:
        query["municipio"] = municipio
    
    proyectos = await db.proyectos_actualizacion.find(
        query, {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    return {"proyectos": proyectos}


@router.get("/proyectos/estadisticas")
async def estadisticas_proyectos_actualizacion(current_user: dict = Depends(get_current_user)):
    """Obtiene estadísticas generales de proyectos de actualización"""
    tiene_acceso = current_user['role'] in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR, UserRole.GESTOR]
    
    if not tiene_acceso:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    pipeline = [
        {"$group": {"_id": "$estado", "count": {"$sum": 1}}}
    ]
    
    resultados = await db.proyectos_actualizacion.aggregate(pipeline).to_list(100)
    
    stats = {
        "activos": 0,
        "pausados": 0,
        "completados": 0,
        "archivados": 0,
        "total": 0
    }
    
    for r in resultados:
        estado = r["_id"]
        count = r["count"]
        stats["total"] += count
        if estado == ProyectoEstado.ACTIVO:
            stats["activos"] = count
        elif estado == ProyectoEstado.PAUSADO:
            stats["pausados"] = count
        elif estado == ProyectoEstado.COMPLETADO:
            stats["completados"] = count
        elif estado == ProyectoEstado.ARCHIVADO:
            stats["archivados"] = count
    
    return stats


@router.post("/proyectos")
async def crear_proyecto_actualizacion(
    proyecto: ProyectoCreate,
    current_user: dict = Depends(get_current_user)
):
    """Crear nuevo proyecto de actualización"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="Solo administradores y coordinadores")
    
    proyecto_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    doc = {
        "id": proyecto_id,
        "nombre": proyecto.nombre,
        "municipio": proyecto.municipio,
        "descripcion": proyecto.descripcion or "",
        "estado": ProyectoEstado.ACTIVO,
        "fecha_inicio": proyecto.fecha_inicio or now[:10],
        "fecha_fin_estimada": proyecto.fecha_fin_estimada,
        "creado_por_id": current_user['id'],
        "creado_por": current_user['full_name'],
        "predios_total": 0,
        "predios_actualizados": 0,
        "predios_nuevos": 0,
        "created_at": now,
        "updated_at": now
    }
    
    await db.proyectos_actualizacion.insert_one(doc)
    doc.pop('_id', None)
    
    return {"success": True, "proyecto": doc}


@router.get("/proyectos/{proyecto_id}")
async def obtener_proyecto_actualizacion(
    proyecto_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obtener detalles de un proyecto"""
    tiene_acceso = current_user['role'] in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR, UserRole.GESTOR]
    
    if not tiene_acceso:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    proyecto = await db.proyectos_actualizacion.find_one({"id": proyecto_id}, {"_id": 0})
    
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    
    return proyecto


@router.patch("/proyectos/{proyecto_id}")
async def actualizar_proyecto_actualizacion(
    proyecto_id: str,
    datos: ProyectoUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Actualizar un proyecto de actualización"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="Solo administradores y coordinadores")
    
    proyecto = await db.proyectos_actualizacion.find_one({"id": proyecto_id}, {"_id": 0})
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    
    update_data = {k: v for k, v in datos.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.proyectos_actualizacion.update_one(
        {"id": proyecto_id},
        {"$set": update_data}
    )
    
    proyecto_actualizado = await db.proyectos_actualizacion.find_one({"id": proyecto_id}, {"_id": 0})
    
    return {"success": True, "proyecto": proyecto_actualizado}


@router.delete("/proyectos/{proyecto_id}")
async def eliminar_proyecto_actualizacion(
    proyecto_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Eliminar un proyecto de actualización"""
    if current_user['role'] != UserRole.ADMINISTRADOR:
        raise HTTPException(status_code=403, detail="Solo administradores")
    
    proyecto = await db.proyectos_actualizacion.find_one({"id": proyecto_id}, {"_id": 0})
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    
    await db.proyectos_actualizacion.delete_one({"id": proyecto_id})
    
    return {"success": True, "message": "Proyecto eliminado"}


@router.post("/proyectos/{proyecto_id}/archivar")
async def archivar_proyecto(
    proyecto_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Archivar un proyecto"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    result = await db.proyectos_actualizacion.update_one(
        {"id": proyecto_id},
        {"$set": {
            "estado": ProyectoEstado.ARCHIVADO,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    
    return {"success": True, "message": "Proyecto archivado"}


@router.post("/proyectos/{proyecto_id}/restaurar")
async def restaurar_proyecto(
    proyecto_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Restaurar un proyecto archivado"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    result = await db.proyectos_actualizacion.update_one(
        {"id": proyecto_id},
        {"$set": {
            "estado": ProyectoEstado.ACTIVO,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    
    return {"success": True, "message": "Proyecto restaurado"}


# ============================================================
# ESTADÍSTICAS AVANZADAS
# ============================================================

@router.get("/proyectos/{proyecto_id}/estadisticas-avanzadas")
async def estadisticas_avanzadas_proyecto(
    proyecto_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Estadísticas avanzadas de un proyecto"""
    tiene_acceso = current_user['role'] in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR, UserRole.GESTOR]
    if not tiene_acceso:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    proyecto = await db.proyectos_actualizacion.find_one({"id": proyecto_id}, {"_id": 0, "id": 1, "nombre": 1})
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    
    # Predios nuevos aprobados
    predios_nuevos_aprobados = await db.propuestas_cambio_actualizacion.count_documents({
        "proyecto_id": proyecto_id,
        "tipo": "predio_nuevo",
        "estado": "aprobada",
        "$or": [{"es_mejora": {"$ne": True}}, {"es_mejora": {"$exists": False}}]
    })
    
    # Mejoras nuevas aprobadas
    mejoras_nuevas_aprobadas = await db.propuestas_cambio_actualizacion.count_documents({
        "proyecto_id": proyecto_id,
        "tipo": "predio_nuevo",
        "estado": "aprobada",
        "es_mejora": True
    })
    
    # Visitas firmadas
    visitas_firmadas = await db.predios_actualizacion.count_documents({
        "proyecto_id": proyecto_id,
        "estado_visita": "visitado_firmado"
    })
    
    # Cancelaciones aprobadas
    cancelaciones_aprobadas = await db.propuestas_cambio_actualizacion.count_documents({
        "proyecto_id": proyecto_id,
        "tipo": "cancelacion",
        "estado": "aprobada"
    })
    
    # Cambios aprobados
    cambios_aprobados = await db.propuestas_cambio_actualizacion.count_documents({
        "proyecto_id": proyecto_id,
        "tipo": "cambio",
        "estado": "aprobada"
    })
    
    # Propuestas pendientes
    propuestas_pendientes = await db.propuestas_cambio_actualizacion.count_documents({
        "proyecto_id": proyecto_id,
        "estado": "pendiente"
    })
    
    return {
        "proyecto_id": proyecto_id,
        "predios_nuevos_aprobados": predios_nuevos_aprobados,
        "mejoras_nuevas_aprobadas": mejoras_nuevas_aprobadas,
        "visitas_firmadas": visitas_firmadas,
        "cancelaciones_aprobadas": cancelaciones_aprobadas,
        "cambios_aprobados": cambios_aprobados,
        "propuestas_pendientes": propuestas_pendientes
    }


# ============================================================
# PREDIOS DE PROYECTO
# ============================================================

@router.get("/proyectos/{proyecto_id}/predios")
async def obtener_predios_proyecto(
    proyecto_id: str,
    skip: int = 0,
    limit: int = 100,
    estado_visita: Optional[str] = None,
    busqueda: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Obtener predios de un proyecto de actualización"""
    tiene_acceso = current_user['role'] in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR, UserRole.GESTOR]
    if not tiene_acceso:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    proyecto = await db.proyectos_actualizacion.find_one({"id": proyecto_id}, {"_id": 0})
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    
    query = {"proyecto_id": proyecto_id}
    
    if estado_visita:
        query["estado_visita"] = estado_visita
    
    if busqueda:
        query["$or"] = [
            {"codigo_predial": {"$regex": busqueda, "$options": "i"}},
            {"propietarios.nombre_propietario": {"$regex": busqueda, "$options": "i"}},
            {"direccion": {"$regex": busqueda, "$options": "i"}}
        ]
    
    total = await db.predios_actualizacion.count_documents(query)
    
    predios = await db.predios_actualizacion.find(
        query, {"_id": 0}
    ).sort("codigo_predial", 1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "predios": predios,
        "total": total,
        "skip": skip,
        "limit": limit
    }
