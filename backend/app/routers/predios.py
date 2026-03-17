"""
Router de Predios
Endpoints: CRUD de predios, búsquedas, estadísticas, códigos homologados
"""
import re
import logging
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import JSONResponse

from ..core.database import db
from ..core.security import get_current_user
from ..core.config import UserRole, MUNICIPIOS_DIVIPOLA, DESTINO_ECONOMICO

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/predios", tags=["Predios"])


# ============================================================
# ENDPOINTS DE CONSULTA
# ============================================================

@router.get("")
async def get_predios(
    municipio: Optional[str] = None,
    vigencia: Optional[int] = None,
    destino_economico: Optional[str] = None,
    zona: Optional[str] = None,
    tiene_geometria: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Lista predios con filtros opcionales (paginación server-side)"""
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    query = {"deleted": {"$ne": True}, "pendiente_eliminacion": {"$ne": True}}
    
    # Filtro por municipios asignados para usuarios empresa
    if current_user['role'] == UserRole.EMPRESA:
        municipios_asignados = current_user.get('municipios_asignados', [])
        if not municipios_asignados:
            return {"total": 0, "predios": [], "mensaje": "No tiene municipios asignados"}
        
        if municipio:
            if municipio not in municipios_asignados:
                raise HTTPException(status_code=403, detail=f"No tiene acceso al municipio {municipio}")
            query["municipio"] = {"$regex": f"^{municipio}$", "$options": "i"}
        else:
            query["municipio"] = {"$in": municipios_asignados}
    elif municipio:
        query["municipio"] = {"$regex": f"^{municipio}$", "$options": "i"}
    
    if vigencia:
        query["vigencia"] = vigencia
    if destino_economico:
        query["destino_economico"] = destino_economico
    if zona:
        if zona == 'rural':
            query["zona"] = "00"
        elif zona == 'urbano':
            query["zona"] = "01"
        elif zona == 'corregimiento':
            query["zona"] = {"$gte": "02", "$lte": "99"}
    
    # Filtro de geometría
    geometria_filter = None
    if tiene_geometria is not None:
        if tiene_geometria.lower() == 'true':
            query["tiene_geometria"] = True
        elif tiene_geometria.lower() == 'false':
            geometria_filter = {
                "$or": [
                    {"tiene_geometria": False},
                    {"tiene_geometria": {"$exists": False}}
                ]
            }
    
    # Filtro de búsqueda
    search_filter = None
    if search:
        search_stripped = search.strip()
        is_matricula_search = bool(re.match(r'^\d{3}-\d+$', search_stripped))
        is_numeric = search_stripped.isdigit()

        if is_matricula_search:
            search_filter = {"r2_registros.matricula_inmobiliaria": search_stripped}
        elif is_numeric:
            # Búsqueda numérica: código predial o documento (usar regex para match parcial)
            search_filter = {
                "$or": [
                    {"codigo_predial_nacional": {"$regex": search_stripped}},
                    {"codigo_homologado": {"$regex": search_stripped}},
                    {"propietarios.numero_documento": {"$regex": search_stripped}},
                ]
            }
        else:
            # Búsqueda de texto: usar índice $text (mucho más rápido que $regex)
            search_filter = {"$text": {"$search": search_stripped}}
    
    # Combinar filtros
    if geometria_filter and search_filter:
        query["$and"] = [geometria_filter, search_filter]
    elif geometria_filter:
        query.update(geometria_filter)
    elif search_filter:
        query.update(search_filter)
    
    total = await db.predios.count_documents(query)
    
    # Campos ligeros para la tabla (sin r2_registros completo ni arrays pesados)
    projection = {
        "_id": 0,
        "id": 1,
        "codigo_predial_nacional": 1,
        "codigo_homologado": 1,
        "municipio": 1,
        "nombre_municipio": 1,
        "vigencia": 1,
        "direccion": 1,
        "destino_economico": 1,
        "area_terreno": 1,
        "area_construida": 1,
        "avaluo": 1,
        "matricula_inmobiliaria": 1,
        "propietarios": 1,
        "nombre_propietario": 1,
        "tipo_documento": 1,
        "numero_documento": 1,
        "tiene_geometria": 1,
        "tiene_geometria_gdb": 1,
        "bloqueado": 1,
        "bloqueo_info": 1,
        "zona": 1,
    }

    # Si la matrícula puede venir en r2_registros, extraerla en el pipeline
    pipeline = [
        {"$match": query},
        {"$addFields": {
            "zona_orden": {"$substr": ["$codigo_predial_nacional", 5, 2]},
            "matricula_inmobiliaria": {
                "$ifNull": [
                    "$matricula_inmobiliaria",
                    {"$arrayElemAt": ["$r2_registros.matricula_inmobiliaria", 0]}
                ]
            }
        }},
        {"$sort": {"zona_orden": 1, "codigo_predial_nacional": 1}},
        {"$skip": skip},
        {"$limit": limit},
        {"$project": {**projection, "zona_orden": 0}}
    ]

    predios = await db.predios.aggregate(pipeline).to_list(limit)

    return {"total": total, "predios": predios, "skip": skip, "limit": limit}


@router.get("/catalogos")
async def get_predios_catalogos(current_user: dict = Depends(get_current_user)):
    """Obtener catálogos de municipios y destinos económicos (cacheable)"""
    data = {
        "municipios": list(MUNICIPIOS_DIVIPOLA.keys()),
        "destinos_economicos": DESTINO_ECONOMICO
    }
    return JSONResponse(content=data, headers={"Cache-Control": "public, max-age=3600"})


@router.get("/stats/summary")
async def get_predios_stats(current_user: dict = Depends(get_current_user)):
    """Estadísticas de predios por municipio y vigencia"""
    # Obtener la vigencia más alta del sistema
    latest_vigencia_doc = await db.predios.find_one(
        {"vigencia": {"$exists": True}},
        {"vigencia": 1, "_id": 0},
        sort=[("vigencia", -1)]
    )
    
    if not latest_vigencia_doc:
        return {"vigencia": 2026, "stats": [], "total_general": 0}
    
    vigencia_sistema = latest_vigencia_doc.get("vigencia", 2026)
    
    pipeline = [
        {
            "$match": {
                "deleted": {"$ne": True},
                "pendiente_eliminacion": {"$ne": True},
                "vigencia": vigencia_sistema
            }
        },
        {
            "$group": {
                "_id": "$municipio",
                "total": {"$sum": 1},
                "urbanos": {
                    "$sum": {
                        "$cond": [{"$eq": [{"$substr": ["$codigo_predial_nacional", 5, 2]}, "01"]}, 1, 0]
                    }
                },
                "rurales": {
                    "$sum": {
                        "$cond": [{"$eq": [{"$substr": ["$codigo_predial_nacional", 5, 2]}, "00"]}, 1, 0]
                    }
                }
            }
        },
        {"$sort": {"_id": 1}}
    ]
    
    stats = await db.predios.aggregate(pipeline).to_list(100)
    
    result = []
    for stat in stats:
        result.append({
            "municipio": stat["_id"],
            "total": stat["total"],
            "urbanos": stat["urbanos"],
            "rurales": stat["rurales"]
        })
    
    total_general = sum(s["total"] for s in result)
    
    return {
        "vigencia": vigencia_sistema,
        "stats": result,
        "total_general": total_general
    }


@router.get("/{predio_id}")
async def get_predio(predio_id: str, current_user: dict = Depends(get_current_user)):
    """Obtener un predio específico por ID"""
    predio = await db.predios.find_one({"id": predio_id}, {"_id": 0})
    if not predio:
        raise HTTPException(status_code=404, detail="Predio no encontrado")
    return predio


@router.get("/{predio_id}/construcciones")
async def get_construcciones_predio(predio_id: str, current_user: dict = Depends(get_current_user)):
    """Obtener construcciones de un predio"""
    predio = await db.predios.find_one({"id": predio_id}, {"_id": 0})
    if not predio:
        raise HTTPException(status_code=404, detail="Predio no encontrado")
    
    r2_registros = predio.get("r2_registros", [])
    construcciones = []
    
    for r2 in r2_registros:
        construcciones.extend(r2.get("construcciones", []))
    
    zonas_terreno = []
    for r2 in r2_registros:
        zonas_terreno.extend(r2.get("zonas", []))
    
    return {
        "construcciones": construcciones,
        "zonas_terreno": zonas_terreno
    }


# ============================================================
# ESTRUCTURA DE CÓDIGO PREDIAL
# ============================================================

@router.get("/estructura-codigo/{municipio}")
async def get_estructura_codigo_predial(
    municipio: str,
    current_user: dict = Depends(get_current_user)
):
    """Obtener la estructura del código predial para un municipio"""
    if municipio not in MUNICIPIOS_DIVIPOLA:
        raise HTTPException(status_code=404, detail=f"Municipio no encontrado: {municipio}")
    
    info_municipio = MUNICIPIOS_DIVIPOLA[municipio]
    prefijo = info_municipio["codigo"]
    
    data = {
        "municipio": municipio,
        "codigo_departamento": info_municipio["departamento"],
        "codigo_municipio": info_municipio["municipio"],
        "prefijo_nacional": prefijo,
        "estructura": {
            "departamento": {"inicio": 0, "fin": 2, "valor": prefijo[:2]},
            "municipio": {"inicio": 2, "fin": 5, "valor": prefijo[2:]},
            "zona": {"inicio": 5, "fin": 7, "descripcion": "00=rural, 01=urbano, 02-99=corregimientos"},
            "sector": {"inicio": 7, "fin": 9},
            "comuna_corregimiento": {"inicio": 9, "fin": 11},
            "barrio_vereda": {"inicio": 11, "fin": 13},
            "manzana": {"inicio": 13, "fin": 17},
            "terreno": {"inicio": 17, "fin": 21},
            "condicion_propiedad": {"inicio": 21, "fin": 22},
            "edificio": {"inicio": 22, "fin": 24},
            "piso": {"inicio": 24, "fin": 26},
            "unidad": {"inicio": 26, "fin": 30}
        }
    }
    return JSONResponse(content=data, headers={"Cache-Control": "public, max-age=86400"})


@router.get("/verificar-codigo-completo/{codigo}")
async def verificar_codigo_completo(
    codigo: str,
    current_user: dict = Depends(get_current_user)
):
    """Verificar si un código predial completo ya existe"""
    if len(codigo) != 30:
        raise HTTPException(status_code=400, detail="El código debe tener 30 caracteres")
    
    # Buscar en predios activos
    predio_existente = await db.predios.find_one(
        {"codigo_predial_nacional": codigo, "deleted": {"$ne": True}},
        {"_id": 0, "id": 1, "codigo_predial_nacional": 1, "municipio": 1, "direccion": 1}
    )
    
    if predio_existente:
        return {
            "existe": True,
            "estado": "existente",
            "mensaje": "Este código predial ya está en uso",
            "predio": predio_existente
        }
    
    # Buscar en predios eliminados
    predio_eliminado = await db.predios_eliminados.find_one(
        {"codigo_predial_nacional": codigo},
        {"_id": 0}
    )
    
    if predio_eliminado:
        return {
            "existe": True,
            "eliminado": True,
            "estado": "eliminado",
            "mensaje": "Este código corresponde a un predio eliminado",
            "puede_reutilizar": True,
            "detalles_eliminacion": {
                "vigencia_eliminacion": predio_eliminado.get("vigencia_eliminacion"),
                "motivo": predio_eliminado.get("motivo", ""),
                "eliminado_en": predio_eliminado.get("eliminado_en"),
                "eliminado_por": predio_eliminado.get("eliminado_por"),
            }
        }
    
    return {
        "existe": False,
        "estado": "disponible",
        "disponible": True,
        "mensaje": "El código está disponible"
    }
