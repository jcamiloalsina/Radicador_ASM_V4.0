"""
Router de Usuarios
Endpoints: gestión de usuarios, roles, permisos, municipios
"""
import logging
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel

from ..core.database import db
from ..core.security import get_current_user
from ..core.config import UserRole, Permission, MUNICIPIOS_DIVIPOLA
from ..utils.helpers import format_nombre_propio

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["Usuarios"])

# Email del administrador protegido
PROTECTED_ADMIN_EMAIL = "catastro@asomunicipios.gov.co"


# ============================================================
# MODELOS
# ============================================================

class UserRoleUpdate(BaseModel):
    user_id: str
    new_role: str


class UserPermissionsUpdate(BaseModel):
    user_id: str
    permissions: List[str]


# ============================================================
# ENDPOINTS
# ============================================================

@router.get("")
async def get_users(current_user: dict = Depends(get_current_user)):
    """Obtener lista de usuarios (solo admin, coordinador, atención)"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR, UserRole.ATENCION_USUARIO]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tiene permiso")
    
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    
    for user in users:
        if isinstance(user.get('created_at'), str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
        if user.get('role') == 'empresa' and 'municipios_asignados' not in user:
            user['municipios_asignados'] = []
    
    return users


@router.get("/gestores-disponibles")
async def get_gestores_disponibles(current_user: dict = Depends(get_current_user)):
    """Obtener lista de gestores disponibles para asignar trabajo"""
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    roles_asignables = ['gestor', 'gestor_auxiliar', 'atencion_usuario', 'coordinador']
    
    gestores = await db.users.find(
        {"role": {"$in": roles_asignables}},
        {"_id": 0, "id": 1, "full_name": 1, "role": 1, "email": 1}
    ).to_list(100)
    
    user_permissions = current_user.get('permissions', [])
    has_approve_permission = 'approve_changes' in user_permissions
    
    if not has_approve_permission:
        gestores = [g for g in gestores if g.get('id') != current_user['id']]
    
    return gestores


@router.patch("/role")
async def update_user_role(role_update: UserRoleUpdate, current_user: dict = Depends(get_current_user)):
    """Actualizar rol de usuario"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR, UserRole.ATENCION_USUARIO]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tiene permiso para cambiar roles")
    
    valid_roles = [
        UserRole.USUARIO, UserRole.ATENCION_USUARIO, UserRole.GESTOR, 
        UserRole.COORDINADOR, UserRole.ADMINISTRADOR, UserRole.COMUNICACIONES, UserRole.EMPRESA
    ]
    if role_update.new_role not in valid_roles:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Rol inválido")
    
    user = await db.users.find_one({"id": role_update.user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    
    if user.get('email', '').lower() == PROTECTED_ADMIN_EMAIL.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="No se puede modificar el rol del administrador principal"
        )
    
    await db.users.update_one(
        {"id": role_update.user_id},
        {"$set": {"role": role_update.new_role}}
    )
    
    return {"message": "Rol actualizado exitosamente", "new_role": role_update.new_role}


# ============================================================
# PERMISOS
# ============================================================

@router.get("/permissions/available")
async def get_available_permissions(current_user: dict = Depends(get_current_user)):
    """Obtener lista de permisos disponibles"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    return [
        {"id": perm, "description": Permission.get_description(perm)}
        for perm in Permission.all_permissions()
    ]


@router.get("/permissions")
async def get_users_with_permissions(current_user: dict = Depends(get_current_user)):
    """Obtener usuarios con sus permisos"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    roles_internos = [
        UserRole.ADMINISTRADOR, UserRole.COORDINADOR, UserRole.GESTOR, 
        UserRole.GESTOR_AUXILIAR, UserRole.ATENCION_USUARIO, UserRole.COMUNICACIONES
    ]
    
    users = await db.users.find(
        {"role": {"$in": roles_internos}},
        {"_id": 0, "id": 1, "email": 1, "full_name": 1, "role": 1, "permissions": 1}
    ).to_list(100)
    
    for user in users:
        if 'permissions' not in user:
            user['permissions'] = []
    
    return users


@router.patch("/permissions")
async def update_user_permissions(
    data: UserPermissionsUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Actualizar permisos de un usuario"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    user = await db.users.find_one({"id": data.user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get('email', '').lower() == PROTECTED_ADMIN_EMAIL.lower():
        raise HTTPException(status_code=403, detail="No se pueden modificar los permisos del administrador principal")
    
    valid_permissions = [p for p in data.permissions if p in Permission.all_permissions()]
    
    await db.users.update_one(
        {"id": data.user_id},
        {"$set": {"permissions": valid_permissions}}
    )
    
    return {"message": "Permisos actualizados", "permissions": valid_permissions}


@router.get("/{user_id}/permissions")
async def get_user_permissions(user_id: str, current_user: dict = Depends(get_current_user)):
    """Obtener permisos de un usuario específico"""
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
        "permissions": user.get("permissions", [])
    }
