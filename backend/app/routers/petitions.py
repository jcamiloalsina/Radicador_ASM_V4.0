"""
Router de Peticiones (PQRS)
Endpoints: crear, listar, actualizar peticiones, asignar gestores
"""
import uuid
import json
import shutil
import logging
from pathlib import Path
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel, EmailStr
from pymongo import ReturnDocument

from ..core.database import db
from ..core.security import get_current_user
from ..core.config import settings, UserRole, PetitionStatus
from ..services.email_service import send_email, get_confirmacion_peticion_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/petitions", tags=["Peticiones"])


# ============================================================
# FUNCIONES AUXILIARES
# ============================================================

async def generate_radicado() -> str:
    """Genera número de radicado con consecutivo global atómico"""
    now = datetime.now()
    date_str = now.strftime("%d-%m-%Y")
    
    result = await db.counters.find_one_and_update(
        {"_id": "radicado_counter"},
        {"$inc": {"sequence": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    
    sequence = str(result["sequence"]).zfill(4)
    return f"RASMGC-{sequence}-{date_str}"


async def crear_notificacion(usuario_id: str, tipo: str, titulo: str, mensaje: str, enlace: str = None):
    """Crear notificación para un usuario"""
    notif = {
        "id": str(uuid.uuid4()),
        "user_id": usuario_id,
        "tipo": tipo,
        "titulo": titulo,
        "mensaje": mensaje,
        "enlace": enlace,
        "leido": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notif)
    return notif


# ============================================================
# MODELOS
# ============================================================

class PetitionUpdate(BaseModel):
    nombre_completo: Optional[str] = None
    correo: Optional[EmailStr] = None
    telefono: Optional[str] = None
    tipo_tramite: Optional[str] = None
    municipio: Optional[str] = None
    estado: Optional[str] = None
    notas: Optional[str] = None
    gestor_id: Optional[str] = None
    enviar_archivos_finalizacion: Optional[bool] = False
    observaciones_devolucion: Optional[str] = None
    comentario_aprobacion: Optional[str] = None


class GestorAssignment(BaseModel):
    gestor_id: str
    is_auxiliar: bool = False
    comentario: Optional[str] = None


# ============================================================
# ENDPOINTS
# ============================================================

@router.post("")
async def create_petition(
    nombre_completo: str = Form(...),
    correo: str = Form(...),
    telefono: str = Form(...),
    tipo_tramite: str = Form(...),
    municipio: str = Form(...),
    descripcion: str = Form(default=""),
    codigo_predial: str = Form(default=""),
    matricula_inmobiliaria: str = Form(default=""),
    predios_certificado: str = Form(default=""),
    files: List[UploadFile] = File(default=[]),
    current_user: dict = Depends(get_current_user)
):
    """Crear nueva petición/trámite"""
    radicado = await generate_radicado()
    
    # Parsear lista de predios para certificados
    lista_predios = []
    if predios_certificado:
        try:
            lista_predios = json.loads(predios_certificado)
        except json.JSONDecodeError:
            logger.warning(f"Error parseando predios_certificado: {predios_certificado}")
    
    # Buscar predios relacionados
    predios_relacionados = []
    for predio_item in lista_predios:
        cod_predial = predio_item.get("codigo_predial", "").strip()
        mat_inmob = predio_item.get("matricula_inmobiliaria", "").strip()
        
        predio = None
        if cod_predial:
            predio = await db.predios.find_one(
                {"codigo_predial_nacional": cod_predial}, 
                {"_id": 0, "id": 1, "codigo_predial_nacional": 1, "r2_registros": 1, "direccion": 1, "municipio": 1}
            )
        elif mat_inmob:
            predio = await db.predios.find_one(
                {"r2_registros.matricula_inmobiliaria": mat_inmob}, 
                {"_id": 0, "id": 1, "codigo_predial_nacional": 1, "r2_registros": 1, "direccion": 1, "municipio": 1}
            )
        
        if predio:
            matricula_r2 = None
            r2_registros = predio.get("r2_registros", [])
            if r2_registros:
                matricula_r2 = r2_registros[0].get("matricula_inmobiliaria")
            
            predios_relacionados.append({
                "predio_id": predio.get("id"),
                "codigo_predial": predio.get("codigo_predial_nacional"),
                "matricula": matricula_r2 or mat_inmob,
                "direccion": predio.get("direccion"),
                "municipio": predio.get("municipio")
            })
        else:
            predios_relacionados.append({
                "predio_id": None,
                "codigo_predial": cod_predial or None,
                "matricula": mat_inmob or None,
                "no_encontrado": True
            })
    
    # Guardar archivos
    saved_files = []
    for file in files:
        if file.filename:
            file_id = str(uuid.uuid4())
            file_ext = Path(file.filename).suffix
            file_path = settings.UPLOAD_DIR / f"{file_id}{file_ext}"
            
            with file_path.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            saved_files.append({
                "id": file_id,
                "original_name": file.filename,
                "path": str(file_path)
            })
    
    # Historial inicial
    historial = [{
        "accion": "Radicado creado",
        "usuario": current_user['full_name'],
        "usuario_rol": current_user['role'],
        "estado_anterior": None,
        "estado_nuevo": PetitionStatus.RADICADO,
        "notas": "Petición radicada en el sistema",
        "fecha": datetime.now(timezone.utc).isoformat()
    }]
    
    # Determinar tipo de solicitante
    tipo_solicitante = "ciudadano"
    if current_user['role'] == UserRole.EMPRESA:
        tipo_solicitante = "empresa"
    elif current_user['role'] not in [UserRole.USUARIO, UserRole.EMPRESA]:
        tipo_solicitante = "interno"
    
    petition_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    doc = {
        "id": petition_id,
        "radicado": radicado,
        "user_id": current_user['id'],
        "nombre_completo": nombre_completo,
        "correo": correo,
        "telefono": telefono,
        "tipo_tramite": tipo_tramite,
        "municipio": municipio,
        "descripcion": descripcion,
        "estado": PetitionStatus.RADICADO,
        "notas": "",
        "gestor_id": None,
        "gestores_asignados": [],
        "archivos": saved_files,
        "historial": historial,
        "tipo_solicitante": tipo_solicitante,
        "created_at": now,
        "updated_at": now
    }
    
    if predios_relacionados:
        doc['predios_relacionados'] = predios_relacionados
        if predios_relacionados:
            doc['predio_relacionado'] = predios_relacionados[0]
    
    if codigo_predial:
        doc['codigo_predial_buscado'] = codigo_predial.strip()
    if matricula_inmobiliaria:
        doc['matricula_buscada'] = matricula_inmobiliaria.strip()
    if lista_predios:
        doc['predios_solicitados'] = lista_predios
    
    await db.petitions.insert_one(doc)
    
    # Enviar correo de confirmación
    try:
        email_html = get_confirmacion_peticion_email(
            radicado=radicado,
            nombre_solicitante=nombre_completo,
            tipo_tramite=tipo_tramite,
            municipio=municipio
        )
        await send_email(
            to_email=correo,
            subject=f"Confirmación de Radicación - {radicado}",
            body=email_html
        )
    except Exception as e:
        logger.error(f"Error enviando correo de confirmación: {str(e)}")
    
    # Notificar a atención al usuario si es ciudadano
    if current_user['role'] == UserRole.USUARIO:
        atencion_users = await db.users.find(
            {"role": UserRole.ATENCION_USUARIO}, {"_id": 0}
        ).to_list(100)
        for user in atencion_users:
            await crear_notificacion(
                usuario_id=user['id'],
                tipo="info",
                titulo="Nueva petición radicada",
                mensaje=f"Nueva petición {radicado} de {nombre_completo} - {tipo_tramite}",
                enlace=f"/dashboard/peticiones/{petition_id}"
            )
    
    doc.pop('_id', None)
    return doc


@router.get("")
async def get_petitions(current_user: dict = Depends(get_current_user)):
    """Listar peticiones según rol del usuario"""
    if current_user['role'] == UserRole.USUARIO:
        query = {"user_id": current_user['id']}
    elif current_user['role'] in [UserRole.GESTOR, 'gestor_auxiliar']:
        query = {
            "$or": [
                {"gestores_asignados": current_user['id']},
                {"user_id": current_user['id']}
            ]
        }
    elif current_user['role'] == UserRole.EMPRESA:
        query = {"user_id": current_user['id']}
    else:
        query = {}
    
    petitions = await db.petitions.find(query, {"_id": 0}).sort("created_at", -1).to_list(None)
    
    for petition in petitions:
        if isinstance(petition.get('created_at'), str):
            petition['created_at'] = datetime.fromisoformat(petition['created_at'])
        if isinstance(petition.get('updated_at'), str):
            petition['updated_at'] = datetime.fromisoformat(petition['updated_at'])
    
    return petitions


@router.get("/mis-peticiones")
async def get_my_petitions(current_user: dict = Depends(get_current_user)):
    """Obtener peticiones del usuario actual"""
    if current_user['role'] in [UserRole.USUARIO, UserRole.EMPRESA]:
        query = {"user_id": current_user['id']}
    else:
        query = {
            "$or": [
                {"user_id": current_user['id']},
                {"gestores_asignados": current_user['id']}
            ]
        }
    
    petitions = await db.petitions.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    for petition in petitions:
        if isinstance(petition.get('created_at'), str):
            petition['created_at'] = datetime.fromisoformat(petition['created_at'])
        if isinstance(petition.get('updated_at'), str):
            petition['updated_at'] = datetime.fromisoformat(petition['updated_at'])
    
    return petitions


@router.get("/stats/dashboard")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    """Estadísticas completas del dashboard según rol del usuario"""
    user_id = current_user['id']
    user_role = current_user['role']
    user_municipios = current_user.get('municipios', [])

    # Verificar si tiene permiso de aprobar cambios
    user_permisos = await db.user_permissions.find_one({"user_id": user_id})
    puede_aprobar = user_permisos and user_permisos.get('permissions', {}).get('aprobar_cambios')
    es_aprobador = user_role in [UserRole.COORDINADOR, UserRole.ADMINISTRADOR] or puede_aprobar

    # ===== ESTADÍSTICAS DE PETICIONES/RADICADOS =====
    if user_role == UserRole.USUARIO:
        query_peticiones = {"user_id": user_id}
    elif user_role in [UserRole.GESTOR, 'gestor_auxiliar']:
        query_peticiones = {"$or": [{"gestores_asignados": user_id}, {"user_id": user_id}]}
    elif user_role == UserRole.EMPRESA:
        return {
            "total": 0, "radicado": 0, "asignado": 0, "rechazado": 0,
            "revision": 0, "devuelto": 0, "finalizado": 0,
            "predios_creados": 0, "predios_asignados": 0, "modificaciones_asignadas": 0,
            "predios_revision": 0, "modificaciones_pendientes": 0, "reapariciones_pendientes": 0,
            "mis_radicados": 0, "aprobados_mes": 0, "rechazados_mes": 0,
            "mutaciones_pendientes": 0, "mutaciones_por_tipo": {},
            "mensaje": "Sin acceso a estadísticas de peticiones"
        }
    else:
        query_peticiones = {}

    # Contar peticiones
    total = await db.petitions.count_documents(query_peticiones)
    radicado = await db.petitions.count_documents({**query_peticiones, "estado": PetitionStatus.RADICADO})
    asignado = await db.petitions.count_documents({**query_peticiones, "estado": PetitionStatus.ASIGNADO})
    rechazado = await db.petitions.count_documents({**query_peticiones, "estado": PetitionStatus.RECHAZADO})
    revision = await db.petitions.count_documents({**query_peticiones, "estado": PetitionStatus.REVISION})
    devuelto = await db.petitions.count_documents({**query_peticiones, "estado": PetitionStatus.DEVUELTO})
    finalizado = await db.petitions.count_documents({**query_peticiones, "estado": PetitionStatus.FINALIZADO})
    mis_radicados = await db.petitions.count_documents({"user_id": user_id})

    # ===== ESTADÍSTICAS DE PREDIOS/ASIGNACIONES (para gestores) =====
    predios_creados = await db.predios_nuevos.count_documents({
        "gestor_creador_id": user_id,
        "estado_flujo": {"$in": ["creado", "digitalizacion", "devuelto", "revision"]}
    })
    predios_asignados = await db.predios_nuevos.count_documents({
        "gestor_apoyo_id": user_id,
        "estado_flujo": {"$in": ["creado", "digitalizacion", "devuelto"]}
    })
    modificaciones_asignadas = await db.cambios_pendientes.count_documents({
        "gestor_apoyo_id": user_id, "estado": "pendiente"
    })

    # ===== ESTADÍSTICAS PARA APROBADORES =====
    predios_revision = 0
    modificaciones_pendientes = 0
    reapariciones_pendientes = 0
    aprobados_mes = 0
    rechazados_mes = 0
    mutaciones_pendientes_count = 0
    mutaciones_por_tipo = {"M1": 0, "M2": 0, "M3": 0, "M4": 0, "M5": 0, "RECTIFICACION_AREA": 0, "COMPLEMENTACION": 0}

    if es_aprobador:
        query_municipio = {}
        if user_municipios:
            query_municipio = {"municipio": {"$in": user_municipios}}

        predios_revision = await db.predios_nuevos.count_documents({**query_municipio, "estado_flujo": "revision"})
        modificaciones_pendientes = await db.cambios_pendientes.count_documents({**query_municipio, "estado": "pendiente"})
        reapariciones_pendientes = await db.predios_reapariciones_solicitudes.count_documents({
            **query_municipio, "estado": {"$in": ["pendiente", "revision"]}
        })

        # Mutaciones pendientes - total y desglose por tipo
        query_mut = {}
        if user_municipios:
            query_mut = {"municipio": {"$in": user_municipios}}
        mutaciones_pendientes_count = await db.solicitudes_mutacion.count_documents({
            **query_mut, "estado": "pendiente_aprobacion"
        })
        pipeline = [
            {"$match": {**query_mut, "estado": "pendiente_aprobacion"}},
            {"$group": {"_id": "$tipo", "count": {"$sum": 1}}}
        ]
        async for doc in db.solicitudes_mutacion.aggregate(pipeline):
            tipo = doc["_id"]
            if tipo in mutaciones_por_tipo:
                mutaciones_por_tipo[tipo] = doc["count"]

        # Estadísticas del mes - contar resoluciones generadas y mutaciones rechazadas
        from zoneinfo import ZoneInfo
        COLOMBIA_TZ = ZoneInfo('America/Bogota')
        inicio_mes = datetime.now(COLOMBIA_TZ).replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
        aprobados_mes = await db.resoluciones.count_documents({
            "fecha_generacion": {"$gte": inicio_mes}
        })
        rechazados_mes = await db.solicitudes_mutacion.count_documents({
            "estado": "rechazado", "fecha_aprobacion": {"$gte": inicio_mes}
        })

    # ===== LISTAS DE TAREAS URGENTES =====
    tareas_urgentes = {
        "peticiones_asignadas": [], "predios_apoyo": [],
        "mutaciones_asignadas": [],
        "modificaciones_aprobar": [], "mutaciones_aprobar": [], "predios_aprobar": []
    }

    # Radicados asignados para todos los roles internos
    if user_role not in [UserRole.USUARIO, UserRole.EMPRESA]:
        peticiones_cursor = db.petitions.find(
            {"gestores_asignados": user_id, "estado": {"$in": ["radicado", "asignado", "en_proceso", "revision"]}},
            {"_id": 0, "id": 1, "radicado": 1, "tipo_tramite": 1, "municipio": 1, "nombre_completo": 1, "created_at": 1, "estado": 1}
        ).sort("created_at", -1).limit(20)
        tareas_urgentes["peticiones_asignadas"] = await peticiones_cursor.to_list(20)

        # Mutaciones/complementaciones asignadas al usuario como gestor de apoyo
        # Solo estados de trabajo activo (NO pendiente_aprobacion, eso va en tarjetas de aprobación)
        mutaciones_asignadas_cursor = db.solicitudes_mutacion.find(
            {
                "gestor_apoyo_id": user_id,
                "estado": {"$in": ["pendiente_cartografia", "devuelto"]}
            },
            {"_id": 0, "id": 1, "tipo": 1, "subtipo": 1, "radicado": 1,
             "municipio_nombre": 1, "fecha_creacion": 1, "estado": 1,
             "creado_por_nombre": 1}
        ).sort("fecha_creacion", -1).limit(20)
        tareas_urgentes["mutaciones_asignadas"] = await mutaciones_asignadas_cursor.to_list(20)

    if user_role in [UserRole.GESTOR, 'gestor_auxiliar', 'gestor']:
        predios_apoyo_cursor = db.predios_nuevos.find(
            {"gestor_apoyo_id": user_id, "estado_flujo": {"$in": ["creado", "digitalizacion", "devuelto"]}},
            {"_id": 0, "id": 1, "codigo_predial_nacional": 1, "municipio": 1, "direccion": 1, "created_at": 1, "estado_flujo": 1}
        ).sort("created_at", -1).limit(5)
        tareas_urgentes["predios_apoyo"] = await predios_apoyo_cursor.to_list(5)

    if es_aprobador:
        query_municipio_list = {}
        if user_municipios:
            query_municipio_list = {"municipio": {"$in": user_municipios}}

        modificaciones_cursor = db.cambios_pendientes.find(
            {**query_municipio_list, "estado": "pendiente"},
            {"_id": 0, "id": 1, "codigo_predial": 1, "tipo_cambio": 1, "municipio": 1, "created_at": 1, "solicitante_nombre": 1}
        ).sort("created_at", 1).limit(5)
        tareas_urgentes["modificaciones_aprobar"] = await modificaciones_cursor.to_list(5)

        mutaciones_aprobar_cursor = db.solicitudes_mutacion.find(
            {**query_municipio_list, "estado": "pendiente_aprobacion"},
            {"_id": 0, "id": 1, "tipo": 1, "subtipo": 1, "radicado": 1, "municipio_nombre": 1, "fecha_creacion": 1, "creado_por_nombre": 1}
        ).sort("fecha_creacion", 1).limit(5)
        tareas_urgentes["mutaciones_aprobar"] = await mutaciones_aprobar_cursor.to_list(5)

        predios_rev_cursor = db.predios_nuevos.find(
            {**query_municipio_list, "estado_flujo": "revision"},
            {"_id": 0, "id": 1, "codigo_predial_nacional": 1, "municipio": 1, "direccion": 1, "created_at": 1, "gestor_creador_nombre": 1}
        ).sort("created_at", 1).limit(5)
        tareas_urgentes["predios_aprobar"] = await predios_rev_cursor.to_list(5)

    return {
        "total": total, "radicado": radicado, "asignado": asignado, "rechazado": rechazado,
        "revision": revision, "devuelto": devuelto, "finalizado": finalizado,
        "mis_radicados": mis_radicados,
        "predios_creados": predios_creados, "predios_asignados": predios_asignados,
        "modificaciones_asignadas": modificaciones_asignadas,
        "predios_revision": predios_revision, "modificaciones_pendientes": modificaciones_pendientes,
        "reapariciones_pendientes": reapariciones_pendientes,
        "aprobados_mes": aprobados_mes, "rechazados_mes": rechazados_mes,
        "es_aprobador": es_aprobador,
        "tareas_urgentes": tareas_urgentes,
        "mutaciones_pendientes": mutaciones_pendientes_count,
        "mutaciones_por_tipo": mutaciones_por_tipo
    }


@router.get("/{petition_id}")
async def get_petition(petition_id: str, current_user: dict = Depends(get_current_user)):
    """Obtener una petición específica"""
    petition = await db.petitions.find_one({"id": petition_id}, {"_id": 0})
    
    if not petition:
        raise HTTPException(status_code=404, detail="Petición no encontrada")
    
    # Verificar acceso
    if current_user['role'] == UserRole.USUARIO:
        if petition['user_id'] != current_user['id']:
            raise HTTPException(status_code=403, detail="No tiene acceso a esta petición")
    
    return petition


@router.patch("/{petition_id}")
async def update_petition(
    petition_id: str, 
    update_data: PetitionUpdate, 
    current_user: dict = Depends(get_current_user)
):
    """Actualizar una petición"""
    petition = await db.petitions.find_one({"id": petition_id}, {"_id": 0})
    
    if not petition:
        raise HTTPException(status_code=404, detail="Petición no encontrada")
    
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    
    if not update_dict:
        return petition
    
    # Agregar al historial si cambia el estado
    if "estado" in update_dict and update_dict["estado"] != petition.get("estado"):
        historial_entry = {
            "accion": f"Estado cambiado a {update_dict['estado']}",
            "usuario": current_user['full_name'],
            "usuario_rol": current_user['role'],
            "estado_anterior": petition.get("estado"),
            "estado_nuevo": update_dict["estado"],
            "notas": update_dict.get("notas", ""),
            "fecha": datetime.now(timezone.utc).isoformat()
        }
        
        await db.petitions.update_one(
            {"id": petition_id},
            {"$push": {"historial": historial_entry}}
        )
    
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.petitions.update_one(
        {"id": petition_id},
        {"$set": update_dict}
    )
    
    updated_petition = await db.petitions.find_one({"id": petition_id}, {"_id": 0})
    return updated_petition


@router.post("/{petition_id}/assign-gestor")
async def assign_gestor(
    petition_id: str,
    assignment: GestorAssignment,
    current_user: dict = Depends(get_current_user)
):
    """Asignar gestor a una petición"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR, UserRole.ATENCION_USUARIO]:
        raise HTTPException(status_code=403, detail="No tiene permiso para asignar gestores")
    
    petition = await db.petitions.find_one({"id": petition_id}, {"_id": 0})
    if not petition:
        raise HTTPException(status_code=404, detail="Petición no encontrada")
    
    gestor = await db.users.find_one({"id": assignment.gestor_id}, {"_id": 0})
    if not gestor:
        raise HTTPException(status_code=404, detail="Gestor no encontrado")
    
    gestores_asignados = petition.get("gestores_asignados", [])
    if assignment.gestor_id not in gestores_asignados:
        gestores_asignados.append(assignment.gestor_id)
    
    nuevo_estado = PetitionStatus.ASIGNADO if petition.get("estado") == PetitionStatus.RADICADO else petition.get("estado")
    
    historial_entry = {
        "accion": f"Gestor asignado: {gestor['full_name']}",
        "usuario": current_user['full_name'],
        "usuario_rol": current_user['role'],
        "estado_anterior": petition.get("estado"),
        "estado_nuevo": nuevo_estado,
        "notas": assignment.comentario or "",
        "fecha": datetime.now(timezone.utc).isoformat()
    }
    
    await db.petitions.update_one(
        {"id": petition_id},
        {
            "$set": {
                "gestores_asignados": gestores_asignados,
                "gestor_id": assignment.gestor_id,
                "estado": nuevo_estado,
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$push": {"historial": historial_entry}
        }
    )
    
    # Notificar al gestor
    await crear_notificacion(
        usuario_id=assignment.gestor_id,
        tipo="info",
        titulo="Nueva petición asignada",
        mensaje=f"Se te ha asignado la petición {petition['radicado']}",
        enlace=f"/dashboard/peticiones/{petition_id}"
    )
    
    return {"message": "Gestor asignado correctamente", "gestor": gestor['full_name']}
