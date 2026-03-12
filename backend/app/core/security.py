"""
Funciones de seguridad: autenticación, tokens JWT, permisos
"""
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .config import settings, UserRole
from .database import db

security = HTTPBearer()


def hash_password(password: str) -> str:
    """Hash de contraseña usando bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    """Verificar contraseña contra hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def create_token(user_id: str, email: str, role: str) -> str:
    """Crear token JWT"""
    payload = {
        'user_id': user_id,
        'email': email,
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decodificar y validar token JWT"""
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    Dependency para obtener el usuario actual desde el token JWT
    """
    payload = decode_token(credentials.credentials)
    user = await db.users.find_one({"id": payload['user_id']})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return user


async def check_permission(user: dict, permission: str) -> bool:
    """
    Verificar si un usuario tiene un permiso específico.
    Los administradores y coordinadores tienen todos los permisos.
    """
    if user.get('role') in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        return True
    
    user_permissions = user.get('permissions', [])
    return permission in user_permissions


def require_permission(permission: str):
    """
    Dependency factory para requerir un permiso específico.
    Uso: @router.get("/ruta", dependencies=[Depends(require_permission("upload_gdb"))])
    """
    async def permission_checker(current_user: dict = Depends(get_current_user)):
        if not await check_permission(current_user, permission):
            raise HTTPException(
                status_code=403,
                detail=f"No tiene permiso para: {permission}"
            )
        return current_user
    return permission_checker


def validate_password(password: str) -> tuple[bool, str]:
    """
    Validar requisitos de contraseña:
    - Mínimo 6 caracteres
    - Al menos una mayúscula, una minúscula, un número
    - Caracteres especiales permitidos
    Returns: (is_valid, error_message)
    """
    if len(password) < 6:
        return False, "La contraseña debe tener al menos 6 caracteres"
    if not any(c.isupper() for c in password):
        return False, "La contraseña debe contener al menos una letra mayúscula"
    if not any(c.islower() for c in password):
        return False, "La contraseña debe contener al menos una letra minúscula"
    if not any(c.isdigit() for c in password):
        return False, "La contraseña debe contener al menos un número"
    return True, ""
