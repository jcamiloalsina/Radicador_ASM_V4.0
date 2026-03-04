"""
Core module - Configuración central y servicios base
"""
from .config import settings, MUNICIPIOS_DIVIPOLA, MUNICIPIOS_POR_CODIGO
from .database import get_database, db
from .security import (
    get_current_user,
    create_token,
    decode_token,
    hash_password,
    verify_password,
    require_permission,
    check_permission
)
