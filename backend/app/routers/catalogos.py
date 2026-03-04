"""
Router de Catálogos y Health
Endpoints públicos y catálogos del sistema
"""
from fastapi import APIRouter, Depends

from ..core.config import (
    MUNICIPIOS_DIVIPOLA, 
    MUNICIPIOS_POR_CODIGO,
    DESTINO_ECONOMICO,
    TIPOS_DOCUMENTO,
    ESTADOS_CIVILES,
    Permission
)
from ..core.security import get_current_user

router = APIRouter(tags=["Catálogos"])


@router.get("/health")
async def health_check():
    """Health check del sistema"""
    return {"status": "healthy", "version": "2.0.0", "service": "catastro-api"}


@router.get("/catalogos/municipios")
async def get_municipios():
    """Obtener catálogo de municipios"""
    return {
        "municipios": list(MUNICIPIOS_DIVIPOLA.keys()),
        "detalle": MUNICIPIOS_DIVIPOLA
    }


@router.get("/catalogos/municipios-por-codigo")
async def get_municipios_por_codigo():
    """Obtener municipios indexados por código DIVIPOLA"""
    return MUNICIPIOS_POR_CODIGO


@router.get("/catalogos/destino-economico")
async def get_destino_economico():
    """Obtener catálogo de destinos económicos"""
    return DESTINO_ECONOMICO


@router.get("/catalogos/tipos-documento")
async def get_tipos_documento():
    """Obtener catálogo de tipos de documento"""
    return TIPOS_DOCUMENTO


@router.get("/catalogos/estados-civiles")
async def get_estados_civiles():
    """Obtener catálogo de estados civiles"""
    return ESTADOS_CIVILES


@router.get("/catalogos/permisos")
async def get_permisos_disponibles(current_user: dict = Depends(get_current_user)):
    """Obtener catálogo de permisos del sistema"""
    return [
        {"id": perm, "description": Permission.get_description(perm)}
        for perm in Permission.all_permissions()
    ]
