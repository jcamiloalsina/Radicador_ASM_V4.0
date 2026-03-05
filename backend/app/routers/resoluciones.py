"""
Router de Resoluciones
Endpoints: plantillas, configuración, historial, generación de números
"""
import logging
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from ..core.database import db
from ..core.security import get_current_user
from ..core.config import UserRole, MUNICIPIOS_DIVIPOLA, MUNICIPIOS_POR_CODIGO

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/resoluciones", tags=["Resoluciones"])

# Mapeo de códigos a nombres de municipio para resoluciones
MUNICIPIOS_R1R2 = {
    "54003": "Ábrego",
    "54109": "Bucarasica",
    "54128": "Cáchira",
    "54206": "Convención",
    "54245": "El Carmen",
    "54250": "El Tarra",
    "54344": "Hacarí",
    "54398": "La Playa",
    "54498": "Ocaña",
    "20614": "Río de Oro",
    "54670": "San Calixto",
    "54720": "Sardinata",
    "54800": "Teorama"
}

# Plantillas por defecto
PLANTILLA_M1_DEFAULT = """Qué, según el artículo 112 de la Ley 1801 de 2016 (Código Nacional de Policía), el GESTOR CATASTRAL tiene la facultad de realizar mutaciones de primera clase cuando se presente cambio de propietario o poseedor.

Qué, el solicitante ha presentado la documentación requerida para realizar la mutación de primera clase del predio identificado con el código predial nacional {codigo_predial}.

Qué, verificada la documentación aportada, se encuentra que cumple con los requisitos establecidos para realizar la mutación solicitada."""

PLANTILLA_M2_DEFAULT = """Qué, según el artículo 112 de la Ley 1801 de 2016 (Código Nacional de Policía), el GESTOR CATASTRAL tiene la facultad de realizar mutaciones de segunda clase cuando se presente englobe o desengloble de terrenos.

Qué, el solicitante ha presentado la documentación requerida para realizar la mutación de segunda clase de los predios involucrados en el trámite.

Qué, verificada la documentación aportada, se encuentra que cumple con los requisitos establecidos para realizar el englobe/desengloble solicitado."""


# ============================================================
# MODELOS
# ============================================================

class PlantillaUpdate(BaseModel):
    texto: Optional[str] = None
    firmante_nombre: Optional[str] = None
    firmante_cargo: Optional[str] = None


class ConfiguracionUpdate(BaseModel):
    firmante_nombre: Optional[str] = None
    firmante_cargo: Optional[str] = None


# ============================================================
# PLANTILLAS
# ============================================================

@router.get("/plantillas")
async def listar_plantillas_resolucion(current_user: dict = Depends(get_current_user)):
    """Listar todas las plantillas de resolución disponibles"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="Solo administradores y coordinadores")
    
    plantillas = await db.resolucion_plantillas.find({}, {"_id": 0}).to_list(100)
    
    # Crear plantillas por defecto si no existen
    if not plantillas:
        plantilla_m1 = {
            "id": "M1",
            "tipo": "M1",
            "nombre": "Mutación Primera (M1)",
            "descripcion": "Cambio de propietario o poseedor",
            "texto": PLANTILLA_M1_DEFAULT,
            "firmante_nombre": "DALGIE ESPERANZA TORRADO RIZO",
            "firmante_cargo": "SUBDIRECTORA FINANCIERA Y ADMINISTRATIVA",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        plantilla_m2 = {
            "id": "M2",
            "tipo": "M2",
            "nombre": "Mutación Segunda (M2)",
            "descripcion": "Englobe y Desengloble de terrenos",
            "texto": PLANTILLA_M2_DEFAULT,
            "firmante_nombre": "DALGIE ESPERANZA TORRADO RIZO",
            "firmante_cargo": "SUBDIRECTORA FINANCIERA Y ADMINISTRATIVA",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.resolucion_plantillas.insert_one(plantilla_m1.copy())
        await db.resolucion_plantillas.insert_one(plantilla_m2.copy())
        plantillas = [plantilla_m1, plantilla_m2]
    
    return {"success": True, "plantillas": plantillas}


@router.get("/plantillas/{tipo}")
async def obtener_plantilla_resolucion(
    tipo: str,
    current_user: dict = Depends(get_current_user)
):
    """Obtener una plantilla específica por tipo (M1, M2, etc.)"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="Solo administradores y coordinadores")
    
    plantilla = await db.resolucion_plantillas.find_one(
        {"tipo": tipo.upper()},
        {"_id": 0}
    )
    
    if not plantilla and tipo.upper() == "M1":
        plantilla = {
            "id": "M1",
            "tipo": "M1",
            "nombre": "Mutación Primera (M1)",
            "descripcion": "Cambio de propietario o poseedor",
            "texto": PLANTILLA_M1_DEFAULT,
            "firmante_nombre": "DALGIE ESPERANZA TORRADO RIZO",
            "firmante_cargo": "SUBDIRECTORA FINANCIERA Y ADMINISTRATIVA",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.resolucion_plantillas.insert_one(plantilla.copy())
    
    if not plantilla:
        raise HTTPException(status_code=404, detail=f"Plantilla {tipo} no encontrada")
    
    return {"success": True, "plantilla": plantilla}


@router.put("/plantillas/{tipo}")
async def actualizar_plantilla_resolucion(
    tipo: str,
    datos: PlantillaUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Actualizar una plantilla de resolución"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="Solo administradores y coordinadores")
    
    update_data = {k: v for k, v in datos.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.resolucion_plantillas.update_one(
        {"tipo": tipo.upper()},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=f"Plantilla {tipo} no encontrada")
    
    plantilla = await db.resolucion_plantillas.find_one({"tipo": tipo.upper()}, {"_id": 0})
    
    return {"success": True, "message": "Plantilla actualizada", "plantilla": plantilla}


# ============================================================
# CONFIGURACIÓN
# ============================================================

@router.get("/configuracion")
async def obtener_configuracion_resoluciones(current_user: dict = Depends(get_current_user)):
    """Obtener configuración general de resoluciones"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="Solo administradores y coordinadores")
    
    config = await db.resolucion_configuracion.find_one({"id": "config_general"}, {"_id": 0})
    
    if not config:
        config = {
            "id": "config_general",
            "firmante_nombre": "DALGIE ESPERANZA TORRADO RIZO",
            "firmante_cargo": "SUBDIRECTORA FINANCIERA Y ADMINISTRATIVA",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.resolucion_configuracion.insert_one(config.copy())
    
    return {"success": True, "configuracion": config}


@router.put("/configuracion")
async def actualizar_configuracion_resoluciones(
    datos: ConfiguracionUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Actualizar configuración general de resoluciones"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="Solo administradores y coordinadores")
    
    update_data = {k: v for k, v in datos.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.resolucion_configuracion.update_one(
        {"id": "config_general"},
        {"$set": update_data},
        upsert=True
    )
    
    config = await db.resolucion_configuracion.find_one({"id": "config_general"}, {"_id": 0})
    
    return {"success": True, "message": "Configuración actualizada", "configuracion": config}


@router.get("/configuracion-municipios")
async def obtener_configuracion_municipios(current_user: dict = Depends(get_current_user)):
    """Obtener configuración de numeración por municipio"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="Solo administradores y coordinadores")
    
    config = await db.resolucion_configuracion_municipios.find_one(
        {"id": "config_municipios"},
        {"_id": 0}
    )
    
    if not config:
        config = {"id": "config_municipios"}
        for codigo in MUNICIPIOS_R1R2.keys():
            config[codigo] = 0
        await db.resolucion_configuracion_municipios.insert_one(config.copy())
    
    return {"success": True, "configuracion": config, "municipios": MUNICIPIOS_R1R2}


# ============================================================
# HISTORIAL
# ============================================================

@router.get("/historial")
async def obtener_historial_resoluciones(
    municipio: str = None,
    codigo_municipio: str = None,
    año: int = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Obtener historial de resoluciones generadas"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="Solo administradores y coordinadores")
    
    año_actual = año or datetime.now().year
    
    query = {
        "$or": [
            {"año": año_actual},
            {"año": {"$exists": False}}
        ]
    }
    
    if codigo_municipio:
        query["codigo_municipio"] = codigo_municipio
    elif municipio:
        query["municipio"] = {"$regex": municipio, "$options": "i"}
    
    total = await db.resoluciones.count_documents(query)
    resoluciones = await db.resoluciones.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Estadísticas por municipio
    pipeline = [
        {"$match": {"año": año_actual}},
        {"$group": {
            "_id": {"codigo": "$codigo_municipio", "nombre": "$municipio"},
            "total": {"$sum": 1}
        }},
        {"$project": {
            "_id": 0,
            "codigo_municipio": "$_id.codigo",
            "municipio": "$_id.nombre",
            "total": 1
        }},
        {"$sort": {"total": -1}}
    ]
    stats_por_municipio = await db.resoluciones.aggregate(pipeline).to_list(100)
    
    return {
        "success": True,
        "total": total,
        "resoluciones": resoluciones,
        "estadisticas_por_municipio": stats_por_municipio
    }


@router.get("/por-radicado/{radicado}")
async def obtener_resoluciones_por_radicado(
    radicado: str,
    current_user: dict = Depends(get_current_user)
):
    """Obtener resoluciones generadas para un radicado específico"""
    resoluciones = await db.resoluciones.find(
        {"radicado": radicado},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {
        "success": True,
        "total": len(resoluciones),
        "resoluciones": resoluciones
    }


# ============================================================
# NUMERACIÓN
# ============================================================

@router.get("/siguiente-numero/{codigo_municipio}")
async def obtener_siguiente_numero_resolucion(
    codigo_municipio: str,
    current_user: dict = Depends(get_current_user)
):
    """Obtener el siguiente número de resolución para un municipio"""
    año = datetime.now().year
    
    # Validar código de municipio
    if codigo_municipio not in MUNICIPIOS_R1R2:
        # Buscar por nombre
        codigo_encontrado = None
        for codigo, nombre in MUNICIPIOS_R1R2.items():
            if nombre.lower() in codigo_municipio.lower() or codigo_municipio.lower() in nombre.lower():
                codigo_encontrado = codigo
                break
        if codigo_encontrado:
            codigo_municipio = codigo_encontrado
        else:
            codigo_municipio = "54003"  # Default Ábrego
    
    # Obtener configuración por municipio
    config = await db.resolucion_configuracion_municipios.find_one({"id": "config_municipios"})
    numero_inicial = config.get(codigo_municipio, 0) if config else 0
    
    # Contar resoluciones ya generadas este año para este municipio
    count = await db.resoluciones.count_documents({
        "año": año,
        "codigo_municipio": codigo_municipio
    })
    
    siguiente = numero_inicial + count + 1
    
    # Formato: RES-{DEPTO}-{MPIO}-{CONSECUTIVO}-{AÑO}
    depto = codigo_municipio[:2]
    mpio = codigo_municipio[2:]
    numero_resolucion = f"RES-{depto}-{mpio}-{str(siguiente).zfill(4)}-{año}"
    
    return {
        "success": True,
        "siguiente_numero": siguiente,
        "numero_resolucion": numero_resolucion,
        "año": año,
        "codigo_municipio": codigo_municipio,
        "municipio": MUNICIPIOS_R1R2.get(codigo_municipio, "Desconocido"),
        "fecha_resolucion": datetime.now().strftime("%d/%m/%Y")
    }


@router.get("/radicados-disponibles")
async def obtener_radicados_disponibles(
    municipio: str = None,
    busqueda: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Obtener radicados disponibles para generar resolución"""
    query = {}
    
    # Si hay búsqueda específica, buscar en radicado sin filtrar por estado
    if busqueda:
        query["radicado"] = {"$regex": busqueda, "$options": "i"}
    else:
        # Solo cuando no hay búsqueda, filtrar por estado
        query["estado"] = {"$in": ["pendiente", "en_proceso", "asignado", "aprobado"]}
    
    if municipio:
        query["municipio"] = {"$regex": municipio, "$options": "i"}
    
    peticiones = await db.petitions.find(
        query,
        {"_id": 0, "id": 1, "radicado": 1, "nombre_completo": 1, "tipo_tramite": 1, "municipio": 1, "estado": 1}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    return {
        "success": True,
        "radicados": peticiones
    }
