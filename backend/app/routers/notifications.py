"""
Router de Notificaciones
Endpoints: listar, marcar como leídas, eliminar notificaciones
"""
import uuid
import logging
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from ..core.database import db
from ..core.security import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["Notificaciones"])


# ============================================================
# FUNCIONES AUXILIARES
# ============================================================

async def crear_notificacion(
    usuario_id: str, 
    tipo: str, 
    titulo: str, 
    mensaje: str, 
    enlace: str = None
) -> dict:
    """
    Crear una nueva notificación para un usuario.
    
    Args:
        usuario_id: ID del usuario destinatario
        tipo: Tipo de notificación (info, success, warning, error)
        titulo: Título de la notificación
        mensaje: Mensaje de la notificación
        enlace: Enlace opcional para redirección
    """
    notif = {
        "id": str(uuid.uuid4()),
        "user_id": usuario_id,
        "tipo": tipo,
        "titulo": titulo,
        "mensaje": mensaje,
        "enlace": enlace,
        "leido": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notif)
    return notif


# ============================================================
# ENDPOINTS
# ============================================================

@router.get("")
async def get_notifications(
    limit: int = Query(default=50, le=100),
    solo_no_leidas: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Obtener notificaciones del usuario actual"""
    query = {"user_id": current_user['id']}
    
    if solo_no_leidas:
        query["leido"] = False
    
    notifications = await db.notifications.find(
        query, {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    # Contar no leídas
    no_leidas = await db.notifications.count_documents({
        "user_id": current_user['id'],
        "leido": False
    })
    
    return {
        "notifications": notifications,
        "no_leidas": no_leidas
    }


@router.get("/count")
async def get_notification_count(current_user: dict = Depends(get_current_user)):
    """Obtener conteo de notificaciones no leídas"""
    count = await db.notifications.count_documents({
        "user_id": current_user['id'],
        "leido": False
    })
    return {"count": count}


@router.patch("/{notification_id}/read")
async def mark_as_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Marcar una notificación como leída"""
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user['id']},
        {"$set": {"leido": True}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    
    return {"message": "Notificación marcada como leída"}


@router.patch("/read-all")
async def mark_all_as_read(current_user: dict = Depends(get_current_user)):
    """Marcar todas las notificaciones como leídas"""
    result = await db.notifications.update_many(
        {"user_id": current_user['id'], "leido": False},
        {"$set": {"leido": True}}
    )
    
    return {
        "message": "Todas las notificaciones marcadas como leídas",
        "actualizadas": result.modified_count
    }


@router.delete("/{notification_id}")
async def delete_notification(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Eliminar una notificación"""
    result = await db.notifications.delete_one({
        "id": notification_id,
        "user_id": current_user['id']
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    
    return {"message": "Notificación eliminada"}


@router.delete("")
async def delete_all_notifications(current_user: dict = Depends(get_current_user)):
    """Eliminar todas las notificaciones del usuario"""
    result = await db.notifications.delete_many({
        "user_id": current_user['id']
    })
    
    return {
        "message": "Notificaciones eliminadas",
        "eliminadas": result.deleted_count
    }
