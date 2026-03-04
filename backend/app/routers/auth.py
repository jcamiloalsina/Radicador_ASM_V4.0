"""
Router de Autenticación
Endpoints: login, registro, verificación email, recuperación contraseña
"""
import re
import uuid
import random
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr

from ..core.database import db
from ..core.security import (
    get_current_user, 
    create_token, 
    hash_password, 
    verify_password,
    validate_password
)
from ..core.config import settings, UserRole
from ..utils.helpers import format_nombre_propio
from ..services.email_service import send_email, get_email_template

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Autenticación"])

# Email del administrador protegido
PROTECTED_ADMIN_EMAIL = "catastro@asomunicipios.gov.co"


# ============================================================
# MODELOS
# ============================================================

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class VerifyEmailCode(BaseModel):
    email: EmailStr
    code: str


class ResendVerificationCode(BaseModel):
    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


# ============================================================
# FUNCIONES AUXILIARES
# ============================================================

async def enviar_codigo_verificacion(email: str, codigo: str, nombre: str):
    """Envía el código de verificación por email"""
    contenido = f'''
    <h2 style="color: #1e293b; margin-top: 0;">¡Hola {nombre}!</h2>
    <p>Para completar tu registro en el Sistema de Gestión Catastral, ingresa el siguiente código de verificación:</p>
    <div style="background-color: #065f46; color: white; font-size: 32px; font-weight: bold; padding: 20px; text-align: center; border-radius: 8px; letter-spacing: 8px; margin: 20px 0;">
        {codigo}
    </div>
    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <p style="margin: 0; color: #92400e;"><strong>⏰ Importante:</strong> Este código expira en <strong>30 minutos</strong>.</p>
    </div>
    <p style="color: #64748b; font-size: 14px;">Si no solicitaste este registro, puedes ignorar este mensaje.</p>
    '''
    
    html_content = get_email_template(
        titulo="Verificación de Cuenta",
        contenido=contenido,
        tipo_notificacion="info"
    )
    
    await send_email(
        to_email=email,
        subject="Código de Verificación - Asomunicipios",
        body=html_content
    )


# ============================================================
# ENDPOINTS
# ============================================================

@router.post("/register")
async def register(user_data: UserRegister):
    """Registrar nuevo usuario"""
    # Check if user exists (case-insensitive)
    email_escaped = re.escape(user_data.email.lower())
    existing_user = await db.users.find_one(
        {"email": {"$regex": f"^{email_escaped}$", "$options": "i"}}
    )
    
    if existing_user:
        # Si existe pero no está verificado, permitir re-registro
        if not existing_user.get('email_verified', False):
            verification_code = str(random.randint(100000, 999999))
            expires_at = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
            
            await db.users.update_one(
                {"id": existing_user['id']},
                {"$set": {
                    "verification_code": verification_code,
                    "verification_code_expires": expires_at,
                    "password": hash_password(user_data.password),
                    "full_name": format_nombre_propio(user_data.full_name)
                }}
            )
            
            try:
                await enviar_codigo_verificacion(
                    user_data.email, 
                    verification_code, 
                    format_nombre_propio(user_data.full_name)
                )
            except Exception as e:
                logger.error(f"Error enviando código de verificación: {e}")
            
            return {
                "message": "Se ha enviado un código de verificación a su correo electrónico",
                "requires_verification": True,
                "email": user_data.email
            }
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="El correo ya está registrado"
        )
    
    # Validar contraseña
    is_valid, error_msg = validate_password(user_data.password)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)
    
    # Formatear nombre
    nombre_formateado = format_nombre_propio(user_data.full_name)
    
    # Generar código de verificación
    verification_code = str(random.randint(100000, 999999))
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
    
    # Crear usuario
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "full_name": nombre_formateado,
        "role": UserRole.USUARIO,
        "email_verified": False,
        "verification_code": verification_code,
        "verification_code_expires": expires_at,
        "password": hash_password(user_data.password),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    # Enviar código por email
    try:
        await enviar_codigo_verificacion(user_data.email, verification_code, nombre_formateado)
    except Exception as e:
        logger.error(f"Error enviando código de verificación: {e}")
    
    return {
        "message": "Se ha enviado un código de verificación a su correo electrónico",
        "requires_verification": True,
        "email": user_data.email
    }


@router.post("/verify-email")
async def verify_email(data: VerifyEmailCode):
    """Verificar código de email enviado durante el registro"""
    email_escaped = re.escape(data.email.lower())
    user = await db.users.find_one(
        {"email": {"$regex": f"^{email_escaped}$", "$options": "i"}},
        {"_id": 0}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get('email_verified', False):
        raise HTTPException(status_code=400, detail="El correo ya está verificado")
    
    if user.get('verification_code') != data.code:
        raise HTTPException(status_code=400, detail="Código de verificación inválido")
    
    # Verificar expiración
    expires_str = user.get('verification_code_expires')
    if expires_str:
        expires_at = datetime.fromisoformat(expires_str.replace('Z', '+00:00'))
        if datetime.now(timezone.utc) > expires_at:
            raise HTTPException(
                status_code=400, 
                detail="El código de verificación ha expirado. Solicita uno nuevo."
            )
    
    # Marcar como verificado
    await db.users.update_one(
        {"id": user['id']},
        {"$set": {
            "email_verified": True,
            "verification_code": None,
            "verification_code_expires": None
        }}
    )
    
    # Generar token
    token = create_token(user['id'], user['email'], user['role'])
    
    return {
        "message": "Email verificado exitosamente",
        "token": token,
        "user": {
            "id": user['id'],
            "email": user['email'],
            "full_name": user['full_name'],
            "role": user['role']
        }
    }


@router.post("/resend-verification")
async def resend_verification_code(data: ResendVerificationCode):
    """Reenviar código de verificación"""
    email_escaped = re.escape(data.email.lower())
    user = await db.users.find_one(
        {"email": {"$regex": f"^{email_escaped}$", "$options": "i"}},
        {"_id": 0}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get('email_verified', False):
        raise HTTPException(status_code=400, detail="El correo ya está verificado")
    
    verification_code = str(random.randint(100000, 999999))
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
    
    await db.users.update_one(
        {"id": user['id']},
        {"$set": {
            "verification_code": verification_code,
            "verification_code_expires": expires_at
        }}
    )
    
    try:
        await enviar_codigo_verificacion(data.email, verification_code, user['full_name'])
    except Exception as e:
        logger.error(f"Error reenviando código de verificación: {e}")
        raise HTTPException(
            status_code=500, 
            detail="Error enviando el código. Intente más tarde."
        )
    
    return {"message": "Se ha enviado un nuevo código de verificación a su correo"}


@router.post("/login")
async def login(credentials: UserLogin):
    """Iniciar sesión"""
    email_escaped = re.escape(credentials.email.lower())
    user = await db.users.find_one(
        {"email": {"$regex": f"^{email_escaped}$", "$options": "i"}}, 
        {"_id": 0}
    )
    
    if not user:
        logger.warning(f"Login fallido: usuario no encontrado para {credentials.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Credenciales inválidas"
        )
    
    if not verify_password(credentials.password, user['password']):
        logger.warning(f"Login fallido: contraseña incorrecta para {credentials.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Credenciales inválidas"
        )
    
    logger.info(f"Login exitoso: {credentials.email}")
    
    # Verificar si el email está verificado
    is_protected_admin = user.get('email', '').lower() == PROTECTED_ADMIN_EMAIL.lower()
    is_internal_user = user.get('role') in [
        UserRole.ADMINISTRADOR, UserRole.COORDINADOR, UserRole.GESTOR, 
        UserRole.ATENCION_USUARIO, UserRole.COMUNICACIONES, UserRole.EMPRESA
    ]
    
    if not user.get('email_verified', True) and not is_protected_admin and not is_internal_user:
        # Reenviar código automáticamente
        verification_code = str(random.randint(100000, 999999))
        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
        
        await db.users.update_one(
            {"id": user['id']},
            {"$set": {
                "verification_code": verification_code,
                "verification_code_expires": expires_at
            }}
        )
        
        try:
            await enviar_codigo_verificacion(user['email'], verification_code, user['full_name'])
        except:
            pass
        
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="email_not_verified"
        )
    
    token = create_token(user['id'], user['email'], user['role'])
    permissions = user.get('permissions', [])
    
    return {
        "token": token,
        "user": {
            "id": user['id'],
            "email": user['email'],
            "full_name": user['full_name'],
            "role": user['role'],
            "permissions": permissions
        }
    }


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Obtener datos del usuario actual"""
    user_db = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
    permissions = user_db.get('permissions', []) if user_db else []
    
    return {
        "id": current_user['id'],
        "email": current_user['email'],
        "full_name": current_user['full_name'],
        "role": current_user['role'],
        "permissions": permissions,
        "puede_actualizar_gdb": 'upload_gdb' in permissions,
        "puede_cargar_excel": 'import_r1r2' in permissions,
        "puede_aprobar_cambios": 'approve_changes' in permissions
    }


@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """Enviar email de recuperación de contraseña"""
    import os
    
    email_escaped = re.escape(request.email.lower())
    user = await db.users.find_one(
        {"email": {"$regex": f"^{email_escaped}$", "$options": "i"}}, 
        {"_id": 0}
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="No existe una cuenta con ese correo"
        )
    
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
            detail="El servicio de correo no está configurado"
        )
    
    # Generar token
    reset_token = str(uuid.uuid4())
    expiration = datetime.now(timezone.utc) + timedelta(hours=1)
    
    await db.password_resets.delete_many({"email": request.email})
    await db.password_resets.insert_one({
        "email": request.email,
        "token": reset_token,
        "expires_at": expiration.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
    reset_link = f"{frontend_url}/reset-password?token={reset_token}"
    
    contenido = f'''
    <p>Hola <strong>{user['full_name']}</strong>,</p>
    <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.</p>
    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <p style="margin: 0; color: #92400e;"><strong>⏰ Importante:</strong> Este enlace expirará en 1 hora.</p>
    </div>
    <p style="color: #64748b; font-size: 14px;">Si no solicitaste este cambio, puedes ignorar este correo.</p>
    '''
    
    email_body = get_email_template(
        titulo="Recuperación de Contraseña",
        contenido=contenido,
        tipo_notificacion="warning",
        boton_texto="Restablecer Contraseña",
        boton_url=reset_link
    )
    
    try:
        await send_email(request.email, "Recuperación de Contraseña - Asomunicipios", email_body)
    except Exception as e:
        logger.error(f"Failed to send reset email: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Error al enviar el correo"
        )
    
    return {"message": "Se ha enviado un enlace de recuperación a tu correo"}


@router.get("/validate-reset-token")
async def validate_reset_token(token: str):
    """Validar token de recuperación de contraseña"""
    reset_record = await db.password_resets.find_one({"token": token}, {"_id": 0})
    
    if not reset_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Token inválido")
    
    expires_at = datetime.fromisoformat(reset_record['expires_at'])
    if datetime.now(timezone.utc) > expires_at:
        await db.password_resets.delete_one({"token": token})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El token ha expirado")
    
    return {"valid": True}


@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Restablecer contraseña con token"""
    reset_record = await db.password_resets.find_one({"token": request.token}, {"_id": 0})
    
    if not reset_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Token inválido")
    
    expires_at = datetime.fromisoformat(reset_record['expires_at'])
    if datetime.now(timezone.utc) > expires_at:
        await db.password_resets.delete_one({"token": request.token})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El token ha expirado")
    
    is_valid, error_msg = validate_password(request.new_password)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)
    
    new_hashed_password = hash_password(request.new_password)
    await db.users.update_one(
        {"email": reset_record['email']},
        {"$set": {"password": new_hashed_password}}
    )
    
    await db.password_resets.delete_one({"token": request.token})
    
    return {"message": "Contraseña actualizada exitosamente"}
