"""
Router de Database / Backups
Endpoints: estado DB, backups, restauración
"""
import os
import uuid
import asyncio
import logging
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from fastapi.responses import FileResponse

from ..core.database import db
from ..core.security import get_current_user
from ..core.config import settings, UserRole

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/database", tags=["Database"])

# Variable global para trackear backups en progreso
backup_progress = {}


# ============================================================
# ESTADO DE LA BASE DE DATOS
# ============================================================

@router.get("/status")
async def get_database_status(current_user: dict = Depends(get_current_user)):
    """Obtener estado de la base de datos"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    collections = await db.list_collection_names()
    
    stats = {
        "db_name": db.name,
        "collections_count": len(collections),
        "collections": []
    }
    
    total_size = 0
    for coll_name in collections:
        try:
            coll_stats = await db.command("collStats", coll_name)
            count = await db[coll_name].count_documents({})
            size_mb = coll_stats.get('size', 0) / (1024 * 1024)
            total_size += coll_stats.get('size', 0)
            stats["collections"].append({
                "name": coll_name,
                "count": count,
                "size_mb": round(size_mb, 2)
            })
        except Exception as e:
            stats["collections"].append({
                "name": coll_name,
                "count": 0,
                "size_mb": 0,
                "error": str(e)
            })
    
    stats["total_size_mb"] = round(total_size / (1024 * 1024), 2)
    
    # Último backup
    ultimo_backup = await db.backup_history.find_one(
        {}, 
        sort=[("fecha", -1)],
        projection={"_id": 0, "fecha": 1, "tipo": 1}
    )
    stats["ultimo_backup"] = ultimo_backup
    
    return stats


@router.get("/config")
async def get_database_config(current_user: dict = Depends(get_current_user)):
    """Obtener configuración de backups"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    config = await db.backup_config.find_one({"id": "backup_config"}, {"_id": 0})
    
    if not config:
        config = {
            "id": "backup_config",
            "backup_automatico": False,
            "frecuencia": "diario",
            "hora_backup": "02:00",
            "retener_dias": 30,
            "notificar_email": None
        }
        await db.backup_config.insert_one(config.copy())
    
    return config


@router.put("/config")
async def update_database_config(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Actualizar configuración de backups"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    allowed_fields = ["backup_automatico", "frecuencia", "hora_backup", "retener_dias", "notificar_email"]
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.backup_config.update_one(
        {"id": "backup_config"},
        {"$set": update_data},
        upsert=True
    )
    
    config = await db.backup_config.find_one({"id": "backup_config"}, {"_id": 0})
    return {"success": True, "config": config}


# ============================================================
# BACKUPS
# ============================================================

@router.get("/backups")
async def get_backup_history(current_user: dict = Depends(get_current_user)):
    """Obtener historial de backups"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    backups = await db.backup_history.find(
        {},
        {"_id": 0}
    ).sort("fecha", -1).limit(50).to_list(50)
    
    return {"backups": backups}


async def run_backup_task(backup_id: str, backup_path: str, backup_info: dict, collections_to_backup: list):
    """Tarea de backup en segundo plano"""
    import zipfile
    import json
    from bson import json_util
    
    global backup_progress
    backup_progress[backup_id] = {"status": "running", "progress": 0, "current_collection": "", "error": None}
    
    try:
        total_registros = 0
        total_collections = len(collections_to_backup)
        
        with zipfile.ZipFile(backup_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            metadata = {
                "backup_id": backup_id,
                "db_name": db.name,
                "fecha": datetime.now(timezone.utc).isoformat(),
                "colecciones": collections_to_backup,
                "version": "1.0"
            }
            zipf.writestr("_metadata.json", json.dumps(metadata, indent=2))
            
            for idx, coll_name in enumerate(collections_to_backup):
                backup_progress[backup_id]["current_collection"] = coll_name
                backup_progress[backup_id]["progress"] = int((idx / total_collections) * 100)
                
                docs = []
                cursor = db[coll_name].find({})
                async for doc in cursor:
                    docs.append(doc)
                
                total_registros += len(docs)
                json_data = json_util.dumps(docs, indent=2)
                zipf.writestr(f"{coll_name}.json", json_data)
        
        file_size = os.path.getsize(backup_path)
        backup_info["size_mb"] = round(file_size / (1024 * 1024), 2)
        backup_info["registros_total"] = total_registros
        backup_info["estado"] = "completado"
        
        await db.backup_history.insert_one(backup_info)
        backup_progress[backup_id] = {"status": "completed", "progress": 100, "current_collection": "", "error": None}
        
    except Exception as e:
        backup_progress[backup_id] = {"status": "error", "progress": 0, "current_collection": "", "error": str(e)}
        if os.path.exists(backup_path):
            os.remove(backup_path)


@router.post("/backup")
async def create_backup(
    background_tasks: BackgroundTasks,
    tipo: str = "completo",
    colecciones: List[str] = Query(default=[]),
    current_user: dict = Depends(get_current_user)
):
    """Crear backup de la base de datos"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    backup_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_filename = f"backup_{db.name}_{timestamp}.zip"
    backup_path = str(settings.BACKUP_DIR / backup_filename)
    
    settings.BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    
    if tipo == "completo":
        collections_to_backup = await db.list_collection_names()
        collections_to_backup = [c for c in collections_to_backup if c != 'backup_history']
    else:
        collections_to_backup = colecciones if colecciones else []
    
    if not collections_to_backup:
        raise HTTPException(status_code=400, detail="No hay colecciones para respaldar")
    
    backup_info = {
        "id": backup_id,
        "filename": backup_filename,
        "fecha": datetime.now(timezone.utc).isoformat(),
        "tipo": tipo,
        "colecciones": collections_to_backup,
        "colecciones_count": len(collections_to_backup),
        "creado_por_id": current_user['id'],
        "creado_por": current_user['full_name'],
        "size_mb": 0,
        "registros_total": 0,
        "estado": "en_progreso"
    }
    
    background_tasks.add_task(run_backup_task, backup_id, backup_path, backup_info, collections_to_backup)
    
    return {
        "success": True,
        "message": "Backup iniciado en segundo plano",
        "backup_id": backup_id,
        "backup": {
            "id": backup_id,
            "filename": backup_filename,
            "tipo": tipo,
            "colecciones_count": len(collections_to_backup),
            "estado": "en_progreso"
        }
    }


@router.get("/backup/{backup_id}/status")
async def get_backup_status(backup_id: str, current_user: dict = Depends(get_current_user)):
    """Obtener estado de un backup en progreso"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    if backup_id in backup_progress:
        return backup_progress[backup_id]
    
    backup = await db.backup_history.find_one({"id": backup_id}, {"_id": 0})
    if backup:
        return {"status": backup.get("estado", "unknown"), "progress": 100, "current_collection": "", "error": None}
    
    return {"status": "not_found", "progress": 0, "error": "Backup no encontrado"}


@router.get("/backup/{backup_id}/download")
async def download_backup(backup_id: str, current_user: dict = Depends(get_current_user)):
    """Descargar un archivo de backup"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    backup = await db.backup_history.find_one({"id": backup_id}, {"_id": 0})
    if not backup:
        raise HTTPException(status_code=404, detail="Backup no encontrado")
    
    backup_path = settings.BACKUP_DIR / backup["filename"]
    if not backup_path.exists():
        raise HTTPException(status_code=404, detail="Archivo de backup no encontrado")
    
    return FileResponse(
        path=str(backup_path),
        filename=backup["filename"],
        media_type="application/zip"
    )


@router.delete("/backup/{backup_id}")
async def delete_backup(backup_id: str, current_user: dict = Depends(get_current_user)):
    """Eliminar un backup"""
    if current_user['role'] != UserRole.ADMINISTRADOR:
        raise HTTPException(status_code=403, detail="Solo administradores")
    
    backup = await db.backup_history.find_one({"id": backup_id}, {"_id": 0})
    if not backup:
        raise HTTPException(status_code=404, detail="Backup no encontrado")
    
    # Eliminar archivo
    backup_path = settings.BACKUP_DIR / backup["filename"]
    if backup_path.exists():
        backup_path.unlink()
    
    # Eliminar registro
    await db.backup_history.delete_one({"id": backup_id})
    
    return {"success": True, "message": "Backup eliminado"}


@router.post("/backup/limpiar-antiguos")
async def limpiar_backups_antiguos(
    dias: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Eliminar backups más antiguos que X días"""
    if current_user['role'] != UserRole.ADMINISTRADOR:
        raise HTTPException(status_code=403, detail="Solo administradores")
    
    from datetime import timedelta
    fecha_limite = datetime.now(timezone.utc) - timedelta(days=dias)
    
    backups_antiguos = await db.backup_history.find(
        {"fecha": {"$lt": fecha_limite.isoformat()}}
    ).to_list(1000)
    
    eliminados = 0
    for backup in backups_antiguos:
        backup_path = settings.BACKUP_DIR / backup.get("filename", "")
        if backup_path.exists():
            backup_path.unlink()
        await db.backup_history.delete_one({"id": backup["id"]})
        eliminados += 1
    
    return {
        "success": True,
        "message": f"Se eliminaron {eliminados} backups antiguos",
        "eliminados": eliminados
    }


# ============================================================
# COLECCIONES
# ============================================================

@router.post("/collection/{collection_name}/empty")
async def empty_collection(
    collection_name: str,
    confirmar: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Vaciar una colección (solo admin con confirmación)"""
    if current_user['role'] != UserRole.ADMINISTRADOR:
        raise HTTPException(status_code=403, detail="Solo administradores")
    
    if not confirmar:
        raise HTTPException(status_code=400, detail="Debe confirmar la operación")
    
    # Colecciones protegidas
    protected = ["users", "predios", "petitions", "backup_history"]
    if collection_name in protected:
        raise HTTPException(status_code=403, detail=f"La colección {collection_name} está protegida")
    
    collections = await db.list_collection_names()
    if collection_name not in collections:
        raise HTTPException(status_code=404, detail="Colección no encontrada")
    
    count_before = await db[collection_name].count_documents({})
    await db[collection_name].delete_many({})
    
    return {
        "success": True,
        "message": f"Colección {collection_name} vaciada",
        "documentos_eliminados": count_before
    }
