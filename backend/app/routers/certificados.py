"""
Router de Certificados
Endpoints: generación, verificación, estadísticas, historial
"""
import uuid
import hashlib
import logging
from typing import Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, Query

from ..core.database import db
from ..core.security import get_current_user
from ..core.config import UserRole

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/certificados", tags=["Certificados"])


# ============================================================
# FUNCIONES AUXILIARES
# ============================================================

def generar_codigo_verificacion() -> str:
    """Genera código de verificación único para certificados"""
    import random
    año = datetime.now().year
    aleatorio = ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', k=8))
    return f"ASM-{año}-{aleatorio}"


# ============================================================
# ENDPOINTS DE CONSULTA
# ============================================================

@router.get("/verificables")
async def listar_certificados_verificables(
    skip: int = 0,
    limit: int = 50,
    estado: str = Query(None, description="Filtrar por estado: activo, vencido, anulado, por_vencer"),
    current_user: dict = Depends(get_current_user)
):
    """Lista todos los certificados verificables con información de vigencia"""
    if current_user['role'] not in [UserRole.COORDINADOR, UserRole.ADMINISTRADOR, UserRole.ATENCION_USUARIO]:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    ahora = datetime.now(timezone.utc)
    fecha_limite_por_vencer = ahora + timedelta(days=7)
    ahora_str = ahora.strftime("%Y-%m-%dT%H:%M:%S.%f+00:00")
    limite_str = fecha_limite_por_vencer.strftime("%Y-%m-%dT%H:%M:%S.%f+00:00")

    query = {}
    if estado == "por_vencer":
        query = {
            "estado": "activo",
            "fecha_vencimiento": {
                "$lte": limite_str,
                "$gt": ahora_str
            }
        }
    elif estado == "vencido":
        query = {
            "$or": [
                {"estado": "vencido"},
                {"estado": "activo", "fecha_vencimiento": {"$lte": ahora_str}}
            ]
        }
    elif estado:
        query["estado"] = estado
    
    certificados = await db.certificados_verificables.find(
        query, {"_id": 0}
    ).sort("fecha_generacion", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.certificados_verificables.count_documents(query)
    
    # Agregar información de vigencia
    for cert in certificados:
        fecha_venc = cert.get('fecha_vencimiento')
        if fecha_venc:
            try:
                dt_venc = datetime.fromisoformat(fecha_venc.replace('Z', '+00:00'))
                dias_restantes = (dt_venc - ahora).days
                cert['dias_restantes'] = dias_restantes
                cert['esta_vencido'] = dias_restantes < 0
                cert['por_vencer'] = 0 <= dias_restantes <= 7
            except:
                cert['dias_restantes'] = None
                cert['esta_vencido'] = False
                cert['por_vencer'] = False
    
    return {"certificados": certificados, "total": total, "skip": skip, "limit": limit}


@router.get("/estadisticas")
async def estadisticas_certificados(current_user: dict = Depends(get_current_user)):
    """Obtiene estadísticas de certificados: activos, vencidos, por vencer, anulados"""
    if current_user['role'] not in [UserRole.COORDINADOR, UserRole.ADMINISTRADOR, UserRole.ATENCION_USUARIO]:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    # Usar formato con +00:00 para comparar correctamente con las fechas en DB
    ahora = datetime.now(timezone.utc)
    fecha_limite_por_vencer = ahora + timedelta(days=7)
    ahora_str = ahora.strftime("%Y-%m-%dT%H:%M:%S.%f+00:00")
    limite_str = fecha_limite_por_vencer.strftime("%Y-%m-%dT%H:%M:%S.%f+00:00")

    total = await db.certificados_verificables.count_documents({})

    activos = await db.certificados_verificables.count_documents({
        "estado": "activo",
        "$or": [
            {"fecha_vencimiento": {"$gt": ahora_str}},
            {"fecha_vencimiento": {"$exists": False}}
        ]
    })

    por_vencer = await db.certificados_verificables.count_documents({
        "estado": "activo",
        "fecha_vencimiento": {
            "$lte": limite_str,
            "$gt": ahora_str
        }
    })

    vencidos = await db.certificados_verificables.count_documents({
        "$or": [
            {"estado": "vencido"},
            {"estado": "activo", "fecha_vencimiento": {"$lte": ahora_str}}
        ]
    })

    anulados = await db.certificados_verificables.count_documents({"estado": "anulado"})
    
    return {
        "total": total,
        "activos": activos,
        "por_vencer": por_vencer,
        "vencidos": vencidos,
        "anulados": anulados
    }


@router.get("/historial")
async def get_certificados_historial(
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Obtiene el historial de certificados generados"""
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    certificados = await db.certificados.find(
        {}, {"_id": 0}
    ).sort("fecha_generacion", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.certificados.count_documents({})
    
    return {"certificados": certificados, "total": total}


# ============================================================
# VERIFICACIÓN
# ============================================================

@router.post("/verificar-integridad")
async def verificar_integridad_certificado(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Verifica la integridad de un certificado comparando hashes"""
    codigo_verificacion = data.get("codigo_verificacion")
    
    if not codigo_verificacion:
        raise HTTPException(status_code=400, detail="Se requiere código de verificación")
    
    # Buscar certificado
    certificado = await db.certificados_verificables.find_one(
        {"codigo_verificacion": codigo_verificacion},
        {"_id": 0}
    )
    
    if not certificado:
        return {"valido": False, "mensaje": "Certificado no encontrado", "estado": "no_encontrado"}
    
    # Verificar estado
    if certificado.get("estado") == "anulado":
        return {
            "valido": False,
            "mensaje": "Este certificado ha sido anulado",
            "estado": "anulado",
            "motivo_anulacion": certificado.get("motivo_anulacion"),
            "fecha_anulacion": certificado.get("fecha_anulacion")
        }
    
    # Verificar vencimiento
    fecha_venc = certificado.get("fecha_vencimiento")
    if fecha_venc:
        dt_venc = datetime.fromisoformat(fecha_venc.replace('Z', '+00:00'))
        if datetime.now(timezone.utc) > dt_venc:
            return {
                "valido": False,
                "mensaje": "Este certificado ha vencido",
                "estado": "vencido",
                "fecha_vencimiento": fecha_venc
            }
    
    return {
        "valido": True,
        "mensaje": "Certificado válido",
        "estado": "activo",
        "certificado": {
            "codigo_verificacion": certificado.get("codigo_verificacion"),
            "codigo_predial": certificado.get("codigo_predial"),
            "municipio": certificado.get("municipio"),
            "propietarios": certificado.get("propietarios"),
            "fecha_generacion": certificado.get("fecha_generacion"),
            "fecha_vencimiento": certificado.get("fecha_vencimiento")
        }
    }


# ============================================================
# ANULACIÓN
# ============================================================

@router.post("/{codigo_verificacion}/anular")
async def anular_certificado(
    codigo_verificacion: str,
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Anula un certificado verificable"""
    if current_user['role'] not in [UserRole.COORDINADOR, UserRole.ADMINISTRADOR]:
        raise HTTPException(status_code=403, detail="Solo coordinadores y administradores pueden anular")
    
    motivo = data.get("motivo", "Sin motivo especificado")
    
    certificado = await db.certificados_verificables.find_one(
        {"codigo_verificacion": codigo_verificacion},
        {"_id": 0}
    )
    
    if not certificado:
        raise HTTPException(status_code=404, detail="Certificado no encontrado")
    
    if certificado.get("estado") == "anulado":
        raise HTTPException(status_code=400, detail="El certificado ya está anulado")
    
    await db.certificados_verificables.update_one(
        {"codigo_verificacion": codigo_verificacion},
        {"$set": {
            "estado": "anulado",
            "motivo_anulacion": motivo,
            "fecha_anulacion": datetime.now(timezone.utc).isoformat(),
            "anulado_por": current_user['id'],
            "anulado_por_nombre": current_user['full_name']
        }}
    )
    
    return {
        "success": True,
        "message": "Certificado anulado correctamente",
        "codigo_verificacion": codigo_verificacion
    }
