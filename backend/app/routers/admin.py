"""
Router de Administración
Endpoints: municipios para usuarios empresa, migraciones
"""
import logging
from fastapi import APIRouter, HTTPException, Depends

from ..core.database import db
from ..core.security import get_current_user
from ..core.config import UserRole, MUNICIPIOS_DIVIPOLA
from ..utils.helpers import format_nombre_propio

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Administración"])


@router.get("/municipios-disponibles")
async def get_municipios_disponibles(current_user: dict = Depends(get_current_user)):
    """Obtener lista de municipios disponibles para asignar a usuarios empresa"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    return {"municipios": list(MUNICIPIOS_DIVIPOLA.keys())}


@router.get("/users/{user_id}/municipios")
async def get_user_municipios(user_id: str, current_user: dict = Depends(get_current_user)):
    """Obtener municipios asignados a un usuario empresa"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    return {
        "user_id": user_id,
        "email": user.get("email"),
        "full_name": user.get("full_name"),
        "role": user.get("role"),
        "municipios_asignados": user.get("municipios_asignados", [])
    }


@router.patch("/users/{user_id}/municipios")
async def update_user_municipios(
    user_id: str, 
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Actualizar municipios asignados a un usuario empresa"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != UserRole.EMPRESA:
        raise HTTPException(status_code=400, detail="Solo se pueden asignar municipios a usuarios 'Empresa'")
    
    municipios = data.get("municipios_asignados", [])
    municipios_validos = [m for m in municipios if m in MUNICIPIOS_DIVIPOLA]
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"municipios_asignados": municipios_validos}}
    )
    
    return {
        "message": "Municipios asignados correctamente",
        "user_id": user_id,
        "municipios_asignados": municipios_validos
    }


@router.post("/migrate-ciudadano-to-usuario")
async def migrate_ciudadano_to_usuario(current_user: dict = Depends(get_current_user)):
    """Migrar usuarios con rol 'ciudadano' a 'usuario' (solo admin)"""
    if current_user['role'] != UserRole.ADMINISTRADOR:
        raise HTTPException(status_code=403, detail="Solo administradores")
    
    before_count = await db.users.count_documents({'role': 'ciudadano'})
    
    result = await db.users.update_many(
        {'role': 'ciudadano'},
        {'$set': {'role': 'usuario'}}
    )
    
    return {
        "message": "Migración completada",
        "usuarios_antes": before_count,
        "usuarios_migrados": result.modified_count
    }


@router.post("/format-user-names")
async def format_user_names(current_user: dict = Depends(get_current_user)):
    """Formatear nombres de usuarios con tildes correctas"""
    if current_user['role'] != UserRole.ADMINISTRADOR:
        raise HTTPException(status_code=403, detail="Solo administradores")
    
    users = await db.users.find({}, {"_id": 0, "id": 1, "full_name": 1}).to_list(1000)
    updated = 0
    
    for user in users:
        old_name = user.get('full_name', '')
        new_name = format_nombre_propio(old_name)
        
        if old_name != new_name:
            await db.users.update_one(
                {"id": user['id']},
                {"$set": {"full_name": new_name}}
            )
            updated += 1
    
    return {"message": "Nombres formateados", "actualizados": updated}
