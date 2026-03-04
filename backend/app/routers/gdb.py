"""
Router de GDB (Base Gráfica)
Endpoints: geometrías, estadísticas, capas, construcciones
"""
import logging
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query

from ..core.database import db
from ..core.security import get_current_user
from ..core.config import UserRole

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/gdb", tags=["GDB - Base Gráfica"])


# ============================================================
# GEOMETRÍAS
# ============================================================

@router.get("/geometrias")
async def obtener_geometrias(
    municipio: str = None,
    tipo: str = None,
    skip: int = 0,
    limit: int = 1000,
    current_user: dict = Depends(get_current_user)
):
    """Obtener geometrías de predios"""
    query = {}
    
    if municipio:
        query["municipio"] = {"$regex": municipio, "$options": "i"}
    if tipo:
        query["tipo"] = tipo
    
    geometrias = await db.geometrias_predios.find(
        query, {"_id": 0}
    ).skip(skip).limit(limit).to_list(limit)
    
    total = await db.geometrias_predios.count_documents(query)
    
    return {"geometrias": geometrias, "total": total}


@router.get("/geometrias-disponibles")
async def obtener_geometrias_disponibles(
    municipio: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Obtener lista de geometrías disponibles por municipio"""
    query = {"tiene_geometria": True}
    
    if municipio:
        query["municipio"] = {"$regex": municipio, "$options": "i"}
    
    # Contar por municipio
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$municipio",
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    stats = await db.predios.aggregate(pipeline).to_list(100)
    
    return {
        "municipios": [{"nombre": s["_id"], "geometrias": s["count"]} for s in stats],
        "total": sum(s["count"] for s in stats)
    }


@router.get("/buscar-geometria/{codigo}")
async def buscar_geometria(
    codigo: str,
    current_user: dict = Depends(get_current_user)
):
    """Buscar geometría por código predial"""
    # Buscar en predios
    predio = await db.predios.find_one(
        {"codigo_predial_nacional": {"$regex": codigo, "$options": "i"}, "tiene_geometria": True},
        {"_id": 0, "id": 1, "codigo_predial_nacional": 1, "municipio": 1, "tiene_geometria": 1}
    )
    
    if predio:
        # Buscar geometría asociada
        geometria = await db.geometrias_predios.find_one(
            {"codigo_predial": predio["codigo_predial_nacional"]},
            {"_id": 0}
        )
        
        return {
            "encontrado": True,
            "predio": predio,
            "geometria": geometria
        }
    
    return {"encontrado": False, "mensaje": "No se encontró geometría para este código"}


# ============================================================
# CONSTRUCCIONES
# ============================================================

@router.get("/construcciones/{codigo_predio}")
async def obtener_construcciones_gdb(
    codigo_predio: str,
    current_user: dict = Depends(get_current_user)
):
    """Obtener construcciones de un predio desde la base gráfica"""
    construcciones = await db.construcciones_gdb.find(
        {"codigo_predial": codigo_predio},
        {"_id": 0}
    ).to_list(100)
    
    return {
        "codigo_predial": codigo_predio,
        "construcciones": construcciones,
        "total": len(construcciones)
    }


# ============================================================
# ESTADÍSTICAS
# ============================================================

@router.get("/stats")
async def obtener_estadisticas_gdb(current_user: dict = Depends(get_current_user)):
    """Obtener estadísticas de la base gráfica"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR, UserRole.GESTOR]:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    # Total de geometrías
    total_geometrias = await db.geometrias_predios.count_documents({})
    
    # Predios con geometría
    predios_con_geometria = await db.predios.count_documents({"tiene_geometria": True})
    
    # Estadísticas por municipio
    pipeline = [
        {"$match": {"tiene_geometria": True}},
        {"$group": {
            "_id": "$municipio",
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}}
    ]
    
    por_municipio = await db.predios.aggregate(pipeline).to_list(100)
    
    # Cargas recientes
    cargas_recientes = await db.cargas_gdb.find(
        {}, {"_id": 0}
    ).sort("fecha", -1).limit(5).to_list(5)
    
    return {
        "total_geometrias": total_geometrias,
        "predios_con_geometria": predios_con_geometria,
        "por_municipio": [{"municipio": m["_id"], "count": m["count"]} for m in por_municipio],
        "cargas_recientes": cargas_recientes
    }


@router.get("/capas")
async def obtener_capas_disponibles(current_user: dict = Depends(get_current_user)):
    """Obtener lista de capas disponibles en la base gráfica"""
    # Definición de capas estándar
    capas = [
        {"id": "terrenos", "nombre": "Terrenos", "tipo": "polygon"},
        {"id": "construcciones", "nombre": "Construcciones", "tipo": "polygon"},
        {"id": "limites_municipios", "nombre": "Límites Municipales", "tipo": "polygon"},
        {"id": "vias", "nombre": "Vías", "tipo": "line"},
        {"id": "hidrografia", "nombre": "Hidrografía", "tipo": "line"},
        {"id": "manzanas", "nombre": "Manzanas", "tipo": "polygon"},
        {"id": "sectores", "nombre": "Sectores", "tipo": "polygon"}
    ]
    
    return {"capas": capas}


# ============================================================
# LÍMITES MUNICIPALES
# ============================================================

@router.get("/limites-municipios")
async def obtener_limites_municipios(current_user: dict = Depends(get_current_user)):
    """Obtener geometrías de límites municipales"""
    limites = await db.limites_municipios.find({}, {"_id": 0}).to_list(100)
    
    return {"limites": limites, "total": len(limites)}


# ============================================================
# CARGAS
# ============================================================

@router.get("/cargas-mensuales")
async def obtener_cargas_mensuales(
    año: int = None,
    current_user: dict = Depends(get_current_user)
):
    """Obtener historial de cargas mensuales de GDB"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    año = año or datetime.now().year
    
    cargas = await db.cargas_gdb.find(
        {"año": año},
        {"_id": 0}
    ).sort("fecha", -1).to_list(100)
    
    return {"año": año, "cargas": cargas}


@router.get("/verificar-carga-mes")
async def verificar_carga_mes(
    municipio: str,
    mes: int = None,
    año: int = None,
    current_user: dict = Depends(get_current_user)
):
    """Verificar si ya existe una carga para un municipio en un mes específico"""
    now = datetime.now()
    mes = mes or now.month
    año = año or now.year
    
    carga = await db.cargas_gdb.find_one({
        "municipio": {"$regex": municipio, "$options": "i"},
        "mes": mes,
        "año": año
    }, {"_id": 0})
    
    return {
        "existe": carga is not None,
        "carga": carga,
        "mes": mes,
        "año": año
    }


# ============================================================
# REPORTES DE CALIDAD
# ============================================================

@router.get("/reportes-calidad")
async def listar_reportes_calidad(current_user: dict = Depends(get_current_user)):
    """Listar reportes de calidad de GDB disponibles"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    reportes = await db.reportes_calidad_gdb.find(
        {}, {"_id": 0}
    ).sort("fecha", -1).limit(50).to_list(50)
    
    return {"reportes": reportes}


@router.get("/predios-con-geometria")
async def obtener_predios_con_geometria(
    municipio: str = None,
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Obtener lista de predios que tienen geometría asociada"""
    query = {"tiene_geometria": True}
    
    if municipio:
        query["municipio"] = {"$regex": municipio, "$options": "i"}
    
    predios = await db.predios.find(
        query,
        {"_id": 0, "id": 1, "codigo_predial_nacional": 1, "municipio": 1, "direccion": 1}
    ).skip(skip).limit(limit).to_list(limit)
    
    total = await db.predios.count_documents(query)
    
    return {"predios": predios, "total": total}
