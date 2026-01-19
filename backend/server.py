from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Form, Query, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument
import os
import logging
import random
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import shutil
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage
from reportlab.lib.enums import TA_CENTER, TA_LEFT
import io
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

# Email Configuration
SMTP_HOST = os.environ.get('SMTP_HOST', 'smtp.office365.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', '587'))
SMTP_USER = os.environ.get('SMTP_USER', '')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')
SMTP_FROM = os.environ.get('SMTP_FROM', SMTP_USER)

# File upload configuration
UPLOAD_DIR = Path('/app/uploads')
UPLOAD_DIR.mkdir(exist_ok=True)

security = HTTPBearer()

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# ===== HELPER FUNCTIONS =====

# Diccionario de nombres comunes con tildes correctas
NOMBRES_CON_TILDES = {
    "maria": "María", "jose": "José", "jesus": "Jesús", "angel": "Ángel",
    "andres": "Andrés", "raul": "Raúl", "cesar": "César", "hector": "Héctor",
    "oscar": "Óscar", "nelson": "Nélson", "german": "Germán", "ivan": "Iván",
    "nicolas": "Nicolás", "tomas": "Tomás", "simon": "Simón", "joaquin": "Joaquín",
    "martin": "Martín", "agustin": "Agustín", "sebastian": "Sebastián", "adrian": "Adrián",
    "dario": "Darío", "alvaro": "Álvaro", "ramon": "Ramón", "julian": "Julián",
    "fabian": "Fabián", "maximo": "Máximo", "lazaro": "Lázaro", "moises": "Moisés",
    "isaias": "Isaías", "efrain": "Efraín", "hernan": "Hernán", "ruben": "Rubén",
    "felix": "Félix", "ines": "Inés", "belen": "Belén", "lucia": "Lucía",
    "sofia": "Sofía", "rocio": "Rocío", "monica": "Mónica", "veronica": "Verónica",
    "natalia": "Natalia", "cecilia": "Cecilia", "angela": "Ángela", "barbara": "Bárbara",
    "beatriz": "Beatriz", "dolores": "Dolores", "pilar": "Pilar", "teresa": "Teresa",
    "rosa": "Rosa", "elena": "Elena", "elvira": "Elvira", "esperanza": "Esperanza",
    "eugenia": "Eugenia", "gloria": "Gloria", "graciela": "Graciela", "irene": "Irene",
    "josefa": "Josefa", "julia": "Julia", "juana": "Juana", "lidia": "Lidia",
    "lourdes": "Lourdes", "margarita": "Margarita", "mercedes": "Mercedes", "mercedes": "Mercedes",
    "nuria": "Nuria", "patricia": "Patricia", "raquel": "Raquel", "rebeca": "Rebeca",
    "sara": "Sara", "silvia": "Silvia", "susana": "Susana", "victoria": "Victoria",
    "garcia": "García", "gonzalez": "González", "rodriguez": "Rodríguez", "fernandez": "Fernández",
    "lopez": "López", "martinez": "Martínez", "sanchez": "Sánchez", "perez": "Pérez",
    "gomez": "Gómez", "diaz": "Díaz", "jimenez": "Jiménez", "hernandez": "Hernández",
    "alvarez": "Álvarez", "ruiz": "Ruiz", "ramirez": "Ramírez", "romero": "Romero",
    "suarez": "Suárez", "benitez": "Benítez", "mendez": "Méndez", "gutierrez": "Gutiérrez",
    "nuñez": "Núñez", "ortiz": "Ortiz", "vazquez": "Vázquez", "dominguez": "Domínguez",
    "florez": "Flórez", "ayala": "Ayala", "parra": "Parra", "carrascal": "Carrascal"
}

def format_nombre_propio(nombre: str) -> str:
    """
    Formatea un nombre propio:
    - Convierte a formato Título (inicial mayúscula)
    - Aplica tildes automáticamente a nombres comunes
    """
    if not nombre:
        return nombre
    
    palabras = nombre.strip().split()
    resultado = []
    
    for palabra in palabras:
        palabra_lower = palabra.lower()
        # Buscar en el diccionario de nombres con tildes
        if palabra_lower in NOMBRES_CON_TILDES:
            resultado.append(NOMBRES_CON_TILDES[palabra_lower])
        else:
            # Capitalizar la primera letra
            resultado.append(palabra.capitalize())
    
    return ' '.join(resultado)


# ===== MODELS =====

class UserRole:
    USUARIO = "usuario"  # Usuario externo (antes "usuario")
    ATENCION_USUARIO = "atencion_usuario"
    GESTOR = "gestor"
    COORDINADOR = "coordinador"
    ADMINISTRADOR = "administrador"
    COMUNICACIONES = "comunicaciones"  # Puede consultar predios, ver visor, ver trámites, descargar/subir archivos

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

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    full_name: str
    role: str
    email_verified: bool = False
    verification_code: Optional[str] = None
    verification_code_expires: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserRoleUpdate(BaseModel):
    user_id: str
    new_role: str

# Sistema de Permisos Granulares
class Permission:
    """Permisos disponibles en el sistema"""
    UPLOAD_GDB = "upload_gdb"           # Subir archivos GDB
    IMPORT_R1R2 = "import_r1r2"         # Importar archivos R1/R2
    APPROVE_CHANGES = "approve_changes"  # Aprobar cambios de predios
    
    @classmethod
    def all_permissions(cls):
        return [cls.UPLOAD_GDB, cls.IMPORT_R1R2, cls.APPROVE_CHANGES]
    
    @classmethod
    def get_description(cls, perm):
        descriptions = {
            cls.UPLOAD_GDB: "Subir archivos GDB (Base Gráfica)",
            cls.IMPORT_R1R2: "Importar archivos R1/R2 (Excel)",
            cls.APPROVE_CHANGES: "Aprobar/Rechazar cambios de predios"
        }
        return descriptions.get(perm, perm)

class UserPermissionsUpdate(BaseModel):
    user_id: str
    permissions: List[str]

class PetitionStatus:
    RADICADO = "radicado"
    ASIGNADO = "asignado"
    RECHAZADO = "rechazado"
    REVISION = "revision"
    DEVUELTO = "devuelto"
    FINALIZADO = "finalizado"

class PetitionCreate(BaseModel):
    nombre_completo: str
    correo: EmailStr
    telefono: str
    tipo_tramite: str
    municipio: str

class PetitionUpdate(BaseModel):
    nombre_completo: Optional[str] = None
    correo: Optional[EmailStr] = None
    telefono: Optional[str] = None
    tipo_tramite: Optional[str] = None
    municipio: Optional[str] = None
    estado: Optional[str] = None
    notas: Optional[str] = None
    gestor_id: Optional[str] = None
    enviar_archivos_finalizacion: Optional[bool] = False  # Flag para adjuntar archivos al correo de finalización
    observaciones_devolucion: Optional[str] = None  # Observaciones cuando se devuelve un trámite

class GestorAssignment(BaseModel):
    petition_id: str
    gestor_id: str
    is_auxiliar: bool = False
    comentario: Optional[str] = None  # Comentario/instrucciones al asignar

class Petition(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    radicado: str
    user_id: str
    nombre_completo: str
    correo: str
    telefono: str
    tipo_tramite: str
    municipio: str
    descripcion: str = ""
    estado: str = PetitionStatus.RADICADO
    notas: str = ""
    gestor_id: Optional[str] = None
    gestores_asignados: List[str] = []
    archivos: List[dict] = []
    historial: List[dict] = []
    observaciones_devolucion: str = ""  # Observaciones cuando el staff devuelve el trámite
    devuelto_por_id: Optional[str] = None  # ID del usuario que devolvió el trámite
    devuelto_por_nombre: Optional[str] = None  # Nombre del usuario que devolvió
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ===== PREDIO MODELS (Codigo Nacional Catastral) =====

# Catalogo de municipios con codigo catastral nacional
MUNICIPIOS_DIVIPOLA = {
    "Ábrego": {"departamento": "54", "municipio": "003"},
    "Bucarasica": {"departamento": "54", "municipio": "109"},
    "Cáchira": {"departamento": "54", "municipio": "128"},
    "Convención": {"departamento": "54", "municipio": "206"},
    "El Carmen": {"departamento": "54", "municipio": "245"},
    "El Tarra": {"departamento": "54", "municipio": "250"},
    "Hacarí": {"departamento": "54", "municipio": "344"},
    "La Playa": {"departamento": "54", "municipio": "398"},
    "Río de Oro": {"departamento": "47", "municipio": "545"},  # Cesar
    "San Calixto": {"departamento": "54", "municipio": "670"},
    "Sardinata": {"departamento": "54", "municipio": "720"},
    "Teorama": {"departamento": "54", "municipio": "800"}
}

# Catálogo de destino económico
DESTINO_ECONOMICO = {
    "A": "Habitacional",
    "B": "Industrial",
    "C": "Comercial",
    "D": "Agropecuario",
    "E": "Minero",
    "F": "Recreacional",
    "G": "Salubridad",
    "H": "Institucional",
    "I": "Educativo",
    "J": "Religioso",
    "K": "Cultural",
    "L": "Lote",
    "M": "Pecuario",
    "N": "Agrícola",
    "O": "Uso Público",
    "P": "Forestal",
    "Q": "Mixto Comercial-Habitacional",
    "R": "Servicios Especiales",
    "S": "Institucional Público",
    "0": "Sin clasificar"
}

# Catálogo de tipo de documento
TIPO_DOCUMENTO_PREDIO = {
    "C": "Cédula de Ciudadanía",
    "E": "Cédula de Extranjería",
    "N": "NIT",
    "T": "Tarjeta de Identidad",
    "P": "Pasaporte",
    "X": "Sin documento / Entidad"
}

# Catálogo de estado civil
ESTADO_CIVIL_PREDIO = {
    "S": "Soltero/a",
    "E": "Casado/a con sociedad conyugal",
    "D": "Casado/a sin sociedad conyugal",
    "V": "Separación de bienes",
    "U": "Unión marital de hecho"
}

class PredioR1Create(BaseModel):
    """Registro R1 - Información Jurídica del Predio"""
    municipio: str
    zona: str = "00"  # 00=Rural, 01=Urbano, 02-99=Corregimientos
    sector: str = "01"
    manzana_vereda: str = "0000"
    terreno: str = "0001"
    condicion_predio: str = "0000"
    predio_horizontal: str = "0000"
    
    # Propietario
    nombre_propietario: str
    tipo_documento: str
    numero_documento: str
    estado_civil: Optional[str] = None
    
    # Ubicación y características
    direccion: str
    comuna: str = "0"
    destino_economico: str
    area_terreno: float
    area_construida: float = 0
    avaluo: float
    
    # Mutación
    tipo_mutacion: Optional[str] = None
    numero_resolucion: Optional[str] = None
    fecha_resolucion: Optional[str] = None

class PredioR2Create(BaseModel):
    """Registro R2 - Información Física del Predio"""
    matricula_inmobiliaria: Optional[str] = None
    
    # Zona 1
    zona_fisica_1: float = 0
    zona_economica_1: float = 0
    area_terreno_1: float = 0
    
    # Zona 2
    zona_fisica_2: float = 0
    zona_economica_2: float = 0
    area_terreno_2: float = 0
    
    # Construcción 1
    habitaciones_1: int = 0
    banos_1: int = 0
    locales_1: int = 0
    pisos_1: int = 1
    tipificacion_1: float = 0
    uso_1: int = 0
    puntaje_1: float = 0
    area_construida_1: float = 0
    
    # Construcción 2
    habitaciones_2: int = 0
    banos_2: int = 0
    locales_2: int = 0
    pisos_2: int = 0
    tipificacion_2: float = 0
    uso_2: int = 0
    puntaje_2: float = 0
    area_construida_2: float = 0

class PredioCreate(BaseModel):
    r1: PredioR1Create
    r2: Optional[PredioR2Create] = None

class PredioUpdate(BaseModel):
    # R1 fields
    nombre_propietario: Optional[str] = None
    tipo_documento: Optional[str] = None
    numero_documento: Optional[str] = None
    estado_civil: Optional[str] = None
    direccion: Optional[str] = None
    comuna: Optional[str] = None
    destino_economico: Optional[str] = None
    area_terreno: Optional[float] = None
    area_construida: Optional[float] = None
    avaluo: Optional[float] = None
    tipo_mutacion: Optional[str] = None
    numero_resolucion: Optional[str] = None
    fecha_resolucion: Optional[str] = None
    
    # R2 fields
    matricula_inmobiliaria: Optional[str] = None
    zona_fisica_1: Optional[float] = None
    zona_economica_1: Optional[float] = None
    area_terreno_1: Optional[float] = None
    habitaciones_1: Optional[int] = None
    banos_1: Optional[int] = None
    locales_1: Optional[int] = None
    pisos_1: Optional[int] = None
    puntaje_1: Optional[float] = None
    area_construida_1: Optional[float] = None


# ===== SISTEMA DE APROBACIÓN DE PREDIOS =====

class PredioEstadoAprobacion:
    """Estados de aprobación para cambios en predios"""
    APROBADO = "aprobado"  # Cambios aplicados y firmes
    PENDIENTE_CREACION = "pendiente_creacion"  # Nuevo predio esperando aprobación
    PENDIENTE_MODIFICACION = "pendiente_modificacion"  # Modificación esperando aprobación
    PENDIENTE_ELIMINACION = "pendiente_eliminacion"  # Eliminación esperando aprobación
    RECHAZADO = "rechazado"  # Cambio rechazado por coordinador

class CambioPendienteCreate(BaseModel):
    """Modelo para crear un cambio pendiente"""
    predio_id: Optional[str] = None  # None para nuevos predios
    tipo_cambio: str  # creacion, modificacion, eliminacion
    datos_propuestos: dict  # Datos del predio (nuevo o modificado)
    justificacion: Optional[str] = None

class CambioAprobacionRequest(BaseModel):
    """Modelo para aprobar/rechazar un cambio"""
    cambio_id: str
    aprobado: bool
    comentario: Optional[str] = None


# ===== UTILITY FUNCTIONS =====

import re

def validate_password(password: str) -> tuple[bool, str]:
    """
    Validate password requirements:
    - Minimum 6 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - Special characters are allowed: !@#$%^&*()_+-=[]{}|;':\",./<>?
    Returns: (is_valid, error_message)
    """
    if len(password) < 6:
        return False, "La contraseña debe tener al menos 6 caracteres"
    
    if not re.search(r'[A-Z]', password):
        return False, "La contraseña debe contener al menos una letra mayúscula"
    
    if not re.search(r'[a-z]', password):
        return False, "La contraseña debe contener al menos una letra minúscula"
    
    if not re.search(r'\d', password):
        return False, "La contraseña debe contener al menos un número"
    
    # Allow special characters - password is valid if it passes above checks
    return True, ""

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str, role: str) -> str:
    expiration = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": expiration
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    payload = decode_token(token)
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")
    return user

async def check_permission(user: dict, permission: str) -> bool:
    """
    Verifica si un usuario tiene un permiso específico.
    - Administradores tienen todos los permisos por defecto.
    - Coordinadores tienen todos los permisos por defecto.
    - Otros usuarios necesitan el permiso explícitamente asignado.
    """
    # Admin y Coordinador tienen todos los permisos por defecto
    if user['role'] in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        return True
    
    # Verificar si el usuario tiene el permiso explícitamente
    user_permissions = user.get('permissions', [])
    return permission in user_permissions

def require_permission(permission: str):
    """Dependency factory para requerir un permiso específico"""
    async def permission_checker(current_user: dict = Depends(get_current_user)):
        has_permission = await check_permission(current_user, permission)
        if not has_permission:
            permission_desc = Permission.get_description(permission)
            raise HTTPException(
                status_code=403,
                detail=f"No tiene el permiso requerido: {permission_desc}"
            )
        return current_user
    return permission_checker

async def generate_radicado() -> str:
    """
    Genera un número de radicado con consecutivo global.
    Formato: RASMGC-XXXX-DD-MM-YYYY
    XXXX es un consecutivo global que NUNCA se reinicia.
    """
    now = datetime.now()
    date_str = now.strftime("%d-%m-%Y")
    
    # Obtener e incrementar el contador global atómicamente
    result = await db.counters.find_one_and_update(
        {"_id": "radicado_counter"},
        {"$inc": {"sequence": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    
    sequence = str(result["sequence"]).zfill(4)
    return f"RASMGC-{sequence}-{date_str}"

async def send_email(to_email: str, subject: str, body: str, attachment_path: str = None, attachment_name: str = None):
    if not SMTP_USER or not SMTP_PASSWORD:
        logging.warning("SMTP credentials not configured, skipping email")
        return
    
    try:
        from email.mime.base import MIMEBase
        from email import encoders
        
        msg = MIMEMultipart()
        msg['From'] = SMTP_FROM
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'html'))
        
        # Add attachment if provided
        if attachment_path and os.path.exists(attachment_path):
            with open(attachment_path, 'rb') as f:
                part = MIMEBase('application', 'octet-stream')
                part.set_payload(f.read())
                encoders.encode_base64(part)
                part.add_header('Content-Disposition', f'attachment; filename="{attachment_name or os.path.basename(attachment_path)}"')
                msg.attach(part)
        
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        logging.info(f"Email sent to {to_email}")
    except Exception as e:
        logging.error(f"Failed to send email: {str(e)}")


def get_email_template(titulo: str, contenido: str, radicado: str = None, tipo_notificacion: str = "info", boton_texto: str = None, boton_url: str = None) -> str:
    """
    Genera una plantilla HTML profesional para correos electrónicos.
    
    Args:
        titulo: Título principal del correo
        contenido: Contenido HTML del mensaje
        radicado: Número de radicado (opcional)
        tipo_notificacion: "info", "success", "warning", "error"
        boton_texto: Texto del botón CTA (opcional)
        boton_url: URL del botón (opcional)
    """
    frontend_url = os.environ.get('FRONTEND_URL', 'https://cadastral-update.preview.emergentagent.com')
    logo_url = f"{frontend_url}/logo-asomunicipios.png"
    
    # Colores según tipo de notificación
    colores = {
        "info": {"bg": "#047857", "accent": "#10b981", "badge": "#0ea5e9"},
        "success": {"bg": "#047857", "accent": "#10b981", "badge": "#22c55e"},
        "warning": {"bg": "#d97706", "accent": "#f59e0b", "badge": "#f59e0b"},
        "error": {"bg": "#dc2626", "accent": "#ef4444", "badge": "#ef4444"}
    }
    color = colores.get(tipo_notificacion, colores["info"])
    
    radicado_html = ""
    if radicado:
        radicado_html = f'''
        <div style="background: linear-gradient(135deg, {color["badge"]} 0%, {color["accent"]} 100%); 
                    color: white; padding: 8px 16px; border-radius: 20px; 
                    display: inline-block; font-size: 14px; font-weight: bold; margin-bottom: 15px;">
            📋 Radicado: {radicado}
        </div>
        '''
    
    boton_html = ""
    if boton_texto and boton_url:
        boton_html = f'''
        <div style="text-align: center; margin: 25px 0;">
            <a href="{boton_url}" style="background: linear-gradient(135deg, {color["bg"]} 0%, {color["accent"]} 100%); 
                      color: white; padding: 14px 30px; border-radius: 8px; 
                      text-decoration: none; font-weight: bold; display: inline-block;
                      box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                {boton_texto}
            </a>
        </div>
        '''
    
    return f'''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <!-- Header con imagen de mapa y gradiente -->
            <!--[if gte mso 9]>
            <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;height:180px;">
            <v:fill type="frame" src="https://images.unsplash.com/photo-1662140246046-fc44f41e4362?q=80&w=800" color="{color["bg"]}" />
            <v:textbox inset="0,0,0,0">
            <![endif]-->
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-radius: 16px 16px 0 0; overflow: hidden;">
                <tr>
                    <td background="https://images.unsplash.com/photo-1662140246046-fc44f41e4362?q=80&w=800" 
                        bgcolor="{color["bg"]}" 
                        style="background-color: {color["bg"]}; background-image: url('https://images.unsplash.com/photo-1662140246046-fc44f41e4362?q=80&w=800'); background-size: cover; background-position: center; border-radius: 16px 16px 0 0; padding: 30px; text-align: center;">
                        <!--[if gte mso 9]>
                        <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding: 30px; text-align: center;">
                        <![endif]-->
                        <div style="background: rgba(4, 120, 87, 0.85); padding: 25px; border-radius: 12px;">
                            <img src="{logo_url}" alt="Asomunicipios" style="height: 60px; margin-bottom: 12px; border-radius: 8px; background: white; padding: 6px;">
                            <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600;">
                                Asociación de Municipios del Catatumbo
                            </h1>
                            <p style="color: #a7f3d0; margin: 6px 0 0 0; font-size: 13px;">
                                Provincia de Ocaña y Sur del Cesar
                            </p>
                        </div>
                        <!--[if gte mso 9]>
                        </td></tr></table>
                        <![endif]-->
                    </td>
                </tr>
            </table>
            <!--[if gte mso 9]>
            </v:textbox>
            </v:rect>
            <![endif]-->
            
            <!-- Contenido principal -->
            <div style="background: white; padding: 35px; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
                {radicado_html}
                <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">
                    {titulo}
                </h2>
                <div style="color: #475569; font-size: 15px; line-height: 1.7;">
                    {contenido}
                </div>
                {boton_html}
            </div>
            
            <!-- Footer -->
            <div style="background: #f8fafc; padding: 25px; border-radius: 0 0 16px 16px; 
                        border: 1px solid #e2e8f0; border-top: none; text-align: center;">
                <p style="color: #64748b; font-size: 13px; margin: 0 0 10px 0;">
                    Este es un mensaje automático del Sistema de Gestión Catastral
                </p>
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                    © {datetime.now().year} Asomunicipios - Todos los derechos reservados
                </p>
                <div style="margin-top: 15px;">
                    <a href="{frontend_url}" style="color: {color["bg"]}; text-decoration: none; font-size: 13px;">
                        Acceder al Sistema
                    </a>
                </div>
            </div>
        </div>
    </body>
    </html>
    '''


def get_finalizacion_email(radicado: str, tipo_tramite: str, nombre_solicitante: str, con_archivos: bool = False) -> str:
    """Genera el correo de finalización de trámite."""
    contenido = f'''
    <p>Estimado(a) <strong>{nombre_solicitante}</strong>,</p>
    
    <p>Nos complace informarle que su trámite ha sido <strong style="color: #22c55e;">finalizado exitosamente</strong>.</p>
    
    <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Tipo de trámite:</strong> {tipo_tramite}</p>
        <p style="margin: 0;"><strong>Estado:</strong> ✅ Finalizado</p>
    </div>
    '''
    
    if con_archivos:
        contenido += '''
    <p>📎 <strong>Documentos adjuntos:</strong> Se han incluido los documentos de respuesta en este correo. 
    Por favor revise los archivos adjuntos.</p>
    '''
    
    contenido += '''
    <p>Si tiene alguna pregunta o requiere información adicional, no dude en contactarnos.</p>
    
    <p style="margin-top: 25px;">Atentamente,<br>
    <strong>Equipo de Gestión Catastral</strong><br>
    <span style="color: #64748b;">Asomunicipios</span></p>
    '''
    
    frontend_url = os.environ.get('FRONTEND_URL', 'https://cadastral-update.preview.emergentagent.com')
    
    return get_email_template(
        titulo="¡Su trámite ha sido finalizado!",
        contenido=contenido,
        radicado=radicado,
        tipo_notificacion="success",
        boton_texto="Ver Detalles del Trámite",
        boton_url=f"{frontend_url}/mis-peticiones"
    )


def get_actualizacion_email(radicado: str, estado_nuevo: str, nombre_solicitante: str, observaciones: str = None) -> str:
    """Genera el correo de actualización de estado."""
    estados_info = {
        "radicado": {"texto": "Radicado", "color": "#3b82f6", "icono": "📝", "mensaje": "Su trámite ha sido registrado en el sistema."},
        "asignado": {"texto": "Asignado", "color": "#8b5cf6", "icono": "👤", "mensaje": "Su trámite ha sido asignado a un gestor para su procesamiento."},
        "revision": {"texto": "En Revisión", "color": "#f59e0b", "icono": "🔍", "mensaje": "Su trámite está siendo revisado por nuestro equipo."},
        "rechazado": {"texto": "Rechazado", "color": "#ef4444", "icono": "❌", "mensaje": "Lamentablemente su trámite ha sido rechazado. Por favor revise las observaciones."},
        "devuelto": {"texto": "Devuelto para Corrección", "color": "#f97316", "icono": "↩️", "mensaje": "Su trámite ha sido devuelto para correcciones. Por favor revise las observaciones e ingrese al sistema para corregir y reenviar."},
        "finalizado": {"texto": "Finalizado", "color": "#22c55e", "icono": "✅", "mensaje": "Su trámite ha sido completado exitosamente."}
    }
    
    info = estados_info.get(estado_nuevo, {"texto": estado_nuevo, "color": "#64748b", "icono": "📋", "mensaje": "El estado de su trámite ha sido actualizado."})
    
    # Agregar sección de observaciones si es devolución
    observaciones_html = ""
    if observaciones and estado_nuevo == "devuelto":
        observaciones_html = f'''
        <div style="background: #fff7ed; border: 1px solid #fdba74; padding: 15px; margin: 20px 0; border-radius: 8px;">
            <p style="margin: 0 0 8px 0; font-weight: 600; color: #c2410c;">📋 Observaciones del Gestor:</p>
            <p style="margin: 0; color: #9a3412; white-space: pre-line;">{observaciones}</p>
        </div>
        <p><strong>¿Qué debe hacer?</strong></p>
        <ol style="color: #64748b; padding-left: 20px;">
            <li>Ingrese al sistema con su cuenta</li>
            <li>Vaya a "Mis Peticiones" y seleccione este trámite</li>
            <li>Revise las observaciones y realice las correcciones solicitadas</li>
            <li>Adjunte los documentos necesarios si aplica</li>
            <li>Haga clic en "Reenviar para Revisión"</li>
        </ol>
        '''
    
    contenido = f'''
    <p>Estimado(a) <strong>{nombre_solicitante}</strong>,</p>
    
    <p>Le informamos que el estado de su trámite ha sido actualizado.</p>
    
    <div style="background: #f8fafc; border-left: 4px solid {info["color"]}; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <p style="margin: 0; font-size: 18px;">
            {info["icono"]} <strong style="color: {info["color"]};">{info["texto"]}</strong>
        </p>
        <p style="margin: 10px 0 0 0; color: #64748b;">{info["mensaje"]}</p>
    </div>
    
    {observaciones_html}
    
    <p>Puede consultar el detalle completo de su trámite accediendo al sistema.</p>
    
    <p style="margin-top: 25px;">Atentamente,<br>
    <strong>Equipo de Gestión Catastral</strong><br>
    <span style="color: #64748b;">Asomunicipios</span></p>
    '''
    
    frontend_url = os.environ.get('FRONTEND_URL', 'https://cadastral-update.preview.emergentagent.com')
    tipo_noti = "error" if estado_nuevo == "rechazado" else ("warning" if estado_nuevo == "devuelto" else "info")
    
    return get_email_template(
        titulo="Actualización de su Trámite",
        contenido=contenido,
        radicado=radicado,
        tipo_notificacion=tipo_noti,
        boton_texto="Ver Mi Trámite",
        boton_url=f"{frontend_url}/mis-peticiones"
    )


def get_nueva_peticion_email(radicado: str, solicitante: str, tipo_tramite: str, municipio: str) -> str:
    """Genera el correo de nueva petición para staff."""
    contenido = f'''
    <p>Se ha registrado una nueva petición en el sistema.</p>
    
    <div style="background: #eff6ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
            <tr>
                <td style="padding: 8px 0; color: #64748b; width: 140px;">👤 Solicitante:</td>
                <td style="padding: 8px 0; font-weight: 600; color: #1e293b;">{solicitante}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #64748b;">📋 Tipo de Trámite:</td>
                <td style="padding: 8px 0; font-weight: 600; color: #1e293b;">{tipo_tramite}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #64748b;">📍 Municipio:</td>
                <td style="padding: 8px 0; font-weight: 600; color: #1e293b;">{municipio}</td>
            </tr>
        </table>
    </div>
    
    <p>Por favor, revise y gestione esta solicitud a la brevedad posible.</p>
    '''
    
    frontend_url = os.environ.get('FRONTEND_URL', 'https://cadastral-update.preview.emergentagent.com')
    
    return get_email_template(
        titulo="Nueva Petición Registrada",
        contenido=contenido,
        radicado=radicado,
        tipo_notificacion="info",
        boton_texto="Ver Petición",
        boton_url=f"{frontend_url}/todas-peticiones"
    )


def get_asignacion_email(radicado: str, tipo_tramite: str, gestor_nombre: str) -> str:
    """Genera el correo de asignación para gestor."""
    contenido = f'''
    <p>Hola <strong>{gestor_nombre}</strong>,</p>
    
    <p>Se te ha asignado un nuevo trámite para gestionar.</p>
    
    <div style="background: #faf5ff; border-left: 4px solid #8b5cf6; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Tipo de trámite:</strong> {tipo_tramite}</p>
        <p style="margin: 0;"><strong>Estado:</strong> Asignado a ti</p>
    </div>
    
    <p>Por favor, revisa el trámite y procede con su gestión según los procedimientos establecidos.</p>
    
    <p style="margin-top: 25px;">Saludos,<br>
    <strong>Sistema de Gestión Catastral</strong></p>
    '''
    
    frontend_url = os.environ.get('FRONTEND_URL', 'https://cadastral-update.preview.emergentagent.com')
    
    return get_email_template(
        titulo="Nuevo Trámite Asignado",
        contenido=contenido,
        radicado=radicado,
        tipo_notificacion="info",
        boton_texto="Ver Trámite Asignado",
        boton_url=f"{frontend_url}/mis-peticiones"
    )


def get_nuevos_archivos_email(radicado: str, es_staff: bool = False) -> str:
    """Genera el correo de notificación de nuevos archivos."""
    if es_staff:
        contenido = '''
        <p>El solicitante ha cargado nuevos documentos en su trámite.</p>
        
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0;">📎 <strong>Nuevos archivos disponibles</strong></p>
            <p style="margin: 8px 0 0 0; color: #92400e;">Por favor revise los documentos adjuntos.</p>
        </div>
        '''
    else:
        contenido = '''
        <p>Se han agregado nuevos documentos a su trámite.</p>
        
        <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0;">📎 <strong>Documentos disponibles</strong></p>
            <p style="margin: 8px 0 0 0; color: #065f46;">Puede descargarlos desde el sistema.</p>
        </div>
        '''
    
    frontend_url = os.environ.get('FRONTEND_URL', 'https://cadastral-update.preview.emergentagent.com')
    
    return get_email_template(
        titulo="Nuevos Documentos en su Trámite",
        contenido=contenido,
        radicado=radicado,
        tipo_notificacion="info",
        boton_texto="Ver Documentos",
        boton_url=f"{frontend_url}/mis-peticiones"
    )


class TestEmailRequest(BaseModel):
    to_email: str

@api_router.post("/admin/test-email")
async def send_test_email(request: TestEmailRequest, current_user: dict = Depends(get_current_user)):
    """Envía un correo de prueba (solo admin)"""
    if current_user['role'] != UserRole.ADMINISTRADOR:
        raise HTTPException(status_code=403, detail="Solo administradores pueden enviar correos de prueba")
    
    contenido = '''
    <p>Este es un <strong>correo de prueba</strong> enviado desde el sistema de gestión catastral de Asomunicipios.</p>
    
    <p>Si estás recibiendo este mensaje, significa que la configuración de correo electrónico 
    con <strong>Office 365</strong> está funcionando correctamente.</p>
    
    <div style="background: #ecfdf5; border-left: 4px solid #047857; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <p style="color: #047857; margin: 0; font-weight: bold;">✅ Configuración SMTP verificada:</p>
        <p style="color: #065f46; margin: 8px 0 0 0; font-size: 14px;">
            Servidor: smtp.office365.com<br>
            Remitente: catastro@asomunicipios.gov.co
        </p>
    </div>
    '''
    
    html_body = get_email_template(
        titulo="Correo de Prueba Exitoso",
        contenido=contenido,
        tipo_notificacion="success"
    )
    
    try:
        await send_email(
            request.to_email,
            "✅ Prueba de Correo - Asomunicipios Catastro",
            html_body
        )
        return {"message": f"Correo de prueba enviado a {request.to_email}", "success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al enviar correo: {str(e)}")


@api_router.post("/admin/send-ficha-tecnica")
async def send_ficha_tecnica_email(request: TestEmailRequest, current_user: dict = Depends(get_current_user)):
    """Envía la ficha técnica por correo con PDF adjunto (solo admin)"""
    if current_user['role'] != UserRole.ADMINISTRADOR:
        raise HTTPException(status_code=403, detail="Solo administradores pueden enviar la ficha técnica")
    
    # Generate PDF first
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
    
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], fontSize=24, spaceAfter=20, alignment=TA_CENTER, textColor=colors.HexColor('#047857'))
    subtitle_style = ParagraphStyle('CustomSubtitle', parent=styles['Heading2'], fontSize=14, spaceAfter=10, alignment=TA_CENTER, textColor=colors.HexColor('#065f46'))
    section_style = ParagraphStyle('SectionTitle', parent=styles['Heading2'], fontSize=14, spaceBefore=20, spaceAfter=10, textColor=colors.HexColor('#047857'))
    body_style = ParagraphStyle('CustomBody', parent=styles['Normal'], fontSize=11, spaceAfter=8, leading=14)
    bullet_style = ParagraphStyle('BulletStyle', parent=styles['Normal'], fontSize=10, leftIndent=20, spaceAfter=5, leading=13)
    
    elements = []
    
    elements.append(Paragraph("ASOMUNICIPIOS", title_style))
    elements.append(Paragraph("Sistema de Gestión Catastral", subtitle_style))
    elements.append(Paragraph("Asociación de Municipios del Catatumbo, Provincia de Ocaña y Sur del Cesar", 
                             ParagraphStyle('Small', parent=styles['Normal'], fontSize=10, alignment=TA_CENTER, textColor=colors.gray)))
    elements.append(Spacer(1, 20))
    elements.append(Table([['']], colWidths=[6.5*inch], rowHeights=[2], style=TableStyle([('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#047857'))])))
    elements.append(Spacer(1, 20))
    
    elements.append(Paragraph("1. DESCRIPCIÓN GENERAL", section_style))
    elements.append(Paragraph(
        "El Sistema de Gestión Catastral de Asomunicipios es una plataforma web integral diseñada para modernizar "
        "y optimizar los procesos de gestión catastral de los municipios asociados.",
        body_style))
    
    elements.append(Paragraph("2. FUNCIONALIDADES PRINCIPALES", section_style))
    funcionalidades = [
        "<b>Gestión de Trámites:</b> Radicación con número único consecutivo, seguimiento y notificaciones.",
        "<b>Gestión de Predios:</b> Administración de +174,000 predios con información R1/R2.",
        "<b>Visor Geográfico:</b> Mapa interactivo con geometrías GDB.",
        "<b>Importación de Datos:</b> Carga masiva de Excel y archivos GDB.",
        "<b>Sistema de Roles:</b> 6 roles diferenciados con permisos granulares.",
        "<b>Reportes:</b> Exportación a Excel/PDF con filtros avanzados.",
        "<b>PWA:</b> Acceso móvil con funcionamiento offline."
    ]
    for func in funcionalidades:
        elements.append(Paragraph(f"• {func}", bullet_style))
    
    elements.append(Paragraph("3. ESTADÍSTICAS", section_style))
    stats_data = [["Métrica", "Valor"], ["Total Predios", "174,419"], ["Con Geometría", "143,354 (82%)"], ["Municipios", "25+"]]
    stats_table = Table(stats_data, colWidths=[3*inch, 3*inch])
    stats_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#047857')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#d1d5db')),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(stats_table)
    
    elements.append(Spacer(1, 20))
    footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=9, alignment=TA_CENTER, textColor=colors.gray)
    elements.append(Paragraph(f"Documento generado el {datetime.now().strftime('%d/%m/%Y')}", footer_style))
    
    doc.build(elements)
    buffer.seek(0)
    
    # Save PDF temporarily
    pdf_filename = f"Ficha_Tecnica_Asomunicipios_{datetime.now().strftime('%Y%m%d')}.pdf"
    temp_path = UPLOAD_DIR / pdf_filename
    with open(temp_path, 'wb') as f:
        f.write(buffer.getvalue())
    
    # Send email with attachment using standard template
    contenido = f'''
    <p>Adjunto encontrará la <strong>Ficha Técnica</strong> del Sistema de Gestión Catastral de Asomunicipios, 
    la cual incluye:</p>
    <ul style="line-height: 1.8;">
        <li>Descripción general del sistema</li>
        <li>Funcionalidades principales implementadas</li>
        <li>Beneficios clave para la organización</li>
        <li>Estadísticas actuales del sistema</li>
        <li>Stack tecnológico utilizado</li>
        <li>Roadmap de mejoras futuras</li>
    </ul>
    <div style="background: #ecfdf5; border-left: 4px solid #047857; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <p style="color: #047857; margin: 0;">
            <strong>📎 Archivo adjunto:</strong> {pdf_filename}
        </p>
    </div>
    '''
    
    html_body = get_email_template(
        titulo="📋 Ficha Técnica del Sistema",
        contenido=contenido,
        tipo_notificacion="info"
    )
    
    try:
        await send_email(
            request.to_email,
            "📋 Ficha Técnica - Sistema de Gestión Catastral Asomunicipios",
            html_body,
            attachment_path=str(temp_path),
            attachment_name=pdf_filename
        )
        return {"message": f"Ficha técnica enviada a {request.to_email}", "success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al enviar correo: {str(e)}")


@api_router.get("/reports/ficha-tecnica")
async def generate_ficha_tecnica():
    """Genera PDF con ficha técnica del sistema para presentación ejecutiva"""
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        spaceAfter=20,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#047857')
    )
    
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Heading2'],
        fontSize=14,
        spaceAfter=10,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#065f46')
    )
    
    section_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading2'],
        fontSize=14,
        spaceBefore=20,
        spaceAfter=10,
        textColor=colors.HexColor('#047857'),
        borderPadding=(0, 0, 5, 0)
    )
    
    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontSize=11,
        spaceAfter=8,
        leading=14
    )
    
    bullet_style = ParagraphStyle(
        'BulletStyle',
        parent=styles['Normal'],
        fontSize=10,
        leftIndent=20,
        spaceAfter=5,
        leading=13
    )
    
    elements = []
    
    # Header
    elements.append(Paragraph("ASOMUNICIPIOS", title_style))
    elements.append(Paragraph("Sistema de Gestión Catastral", subtitle_style))
    elements.append(Paragraph("Asociación de Municipios del Catatumbo, Provincia de Ocaña y Sur del Cesar", 
                             ParagraphStyle('Small', parent=styles['Normal'], fontSize=10, alignment=TA_CENTER, textColor=colors.gray)))
    elements.append(Spacer(1, 20))
    
    # Horizontal line
    elements.append(Table([['']], colWidths=[6.5*inch], rowHeights=[2], 
                         style=TableStyle([('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#047857'))])))
    elements.append(Spacer(1, 20))
    
    # DESCRIPCIÓN GENERAL
    elements.append(Paragraph("1. DESCRIPCIÓN GENERAL", section_style))
    elements.append(Paragraph(
        "El Sistema de Gestión Catastral de Asomunicipios es una plataforma web integral diseñada para modernizar "
        "y optimizar los procesos de gestión catastral de los municipios asociados. La plataforma permite la administración "
        "completa del ciclo de vida de trámites catastrales, gestión de predios, y visualización geográfica de información territorial.",
        body_style
    ))
    elements.append(Spacer(1, 10))
    
    # FUNCIONALIDADES PRINCIPALES
    elements.append(Paragraph("2. FUNCIONALIDADES PRINCIPALES", section_style))
    
    funcionalidades = [
        ("<b>Gestión de Trámites (PQRS):</b> Sistema completo de radicación con número único consecutivo (RASMCG-XXXX-DD-MM-YYYY), "
         "seguimiento de estados, asignación a gestores, y notificaciones automáticas por correo electrónico."),
        ("<b>Gestión de Predios:</b> Administración de más de 174,000 predios con información alfanumérica (R1/R2), "
         "filtros avanzados por municipio, zona, destino económico y vigencia."),
        ("<b>Visor Geográfico:</b> Visualización de predios en mapa interactivo con geometrías GDB, vinculación automática "
         "entre datos alfanuméricos y gráficos."),
        ("<b>Importación de Datos:</b> Carga masiva de archivos Excel (R1/R2) y archivos GDB para actualización de base gráfica."),
        ("<b>Sistema de Roles y Permisos:</b> Control de acceso granular con 6 roles diferenciados (Usuario, Atención al Usuario, "
         "Gestor, Coordinador, Administrador, Comunicaciones)."),
        ("<b>Histórico y Reportes:</b> Exportación de histórico de trámites a Excel con filtros avanzados, generación de certificados "
         "catastrales en PDF."),
        ("<b>Notificaciones:</b> Sistema de alertas por correo electrónico para asignaciones, cambios de estado y recuperación de contraseña."),
        ("<b>Aplicación Móvil (PWA):</b> Acceso desde dispositivos móviles con capacidad de funcionamiento offline para consulta de predios.")
    ]
    
    for func in funcionalidades:
        elements.append(Paragraph(f"• {func}", bullet_style))
    
    elements.append(Spacer(1, 10))
    
    # BENEFICIOS
    elements.append(Paragraph("3. BENEFICIOS CLAVE", section_style))
    
    beneficios_data = [
        ["Beneficio", "Descripción"],
        ["Eficiencia Operativa", "Reducción de tiempos en gestión de trámites mediante automatización de procesos"],
        ["Trazabilidad", "Seguimiento completo del ciclo de vida de cada trámite y cambio en predios"],
        ["Accesibilidad", "Acceso 24/7 desde cualquier dispositivo, incluyendo modo offline"],
        ["Integración de Datos", "Unificación de información alfanumérica (R1/R2) y geográfica (GDB)"],
        ["Transparencia", "Los usuarios pueden consultar el estado de sus trámites en tiempo real"],
        ["Seguridad", "Autenticación robusta, roles diferenciados y auditoría de acciones"]
    ]
    
    beneficios_table = Table(beneficios_data, colWidths=[2*inch, 4.5*inch])
    beneficios_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#047857')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#d1d5db')),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f1f5f9')]),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(beneficios_table)
    elements.append(Spacer(1, 15))
    
    # ESTADÍSTICAS ACTUALES
    elements.append(Paragraph("4. ESTADÍSTICAS DEL SISTEMA", section_style))
    
    stats_data = [
        ["Métrica", "Valor"],
        ["Total de Predios Registrados", "174,419"],
        ["Predios con Geometría", "143,354 (82%)"],
        ["Municipios Cubiertos", "25+"],
        ["Usuarios Activos", "25+"],
    ]
    
    stats_table = Table(stats_data, colWidths=[3*inch, 3.5*inch])
    stats_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#047857')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#d1d5db')),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(stats_table)
    elements.append(Spacer(1, 15))
    
    # TECNOLOGÍA
    elements.append(Paragraph("5. STACK TECNOLÓGICO", section_style))
    
    tech_items = [
        "<b>Backend:</b> FastAPI (Python) - Framework moderno de alto rendimiento",
        "<b>Frontend:</b> React.js con Tailwind CSS - Interfaz responsiva y moderna",
        "<b>Base de Datos:</b> MongoDB - Base de datos NoSQL escalable",
        "<b>Mapas:</b> Leaflet + React-Leaflet - Visualización geográfica interactiva",
        "<b>PWA:</b> Service Worker + IndexedDB - Funcionamiento offline",
        "<b>Correo:</b> Integración con Microsoft Office 365",
        "<b>Seguridad:</b> JWT (JSON Web Tokens) para autenticación"
    ]
    
    for tech in tech_items:
        elements.append(Paragraph(f"• {tech}", bullet_style))
    
    elements.append(Spacer(1, 15))
    
    # MEJORAS FUTURAS
    elements.append(Paragraph("6. ROADMAP DE MEJORAS", section_style))
    
    mejoras = [
        ["Prioridad", "Mejora", "Beneficio Esperado"],
        ["Alta", "Generación de archivos XTF (IGAC)", "Cumplimiento normativo Resolución 0301/2025"],
        ["Alta", "Flujo de subsanación de trámites", "Reducción de tiempos en corrección de documentos"],
        ["Media", "App nativa (Android/iOS)", "Mayor alcance y presencia en tiendas de aplicaciones"],
        ["Media", "Dashboard de productividad", "Métricas de desempeño de gestores"],
        ["Media", "Firmas digitales en PDFs", "Validez legal de documentos generados"],
        ["Baja", "Backups automáticos", "Protección de datos ante contingencias"]
    ]
    
    mejoras_table = Table(mejoras, colWidths=[1.2*inch, 2.5*inch, 2.8*inch])
    mejoras_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#047857')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#d1d5db')),
        ('BACKGROUND', (0, 1), (0, 1), colors.HexColor('#fef2f2')),
        ('BACKGROUND', (0, 2), (0, 2), colors.HexColor('#fef2f2')),
        ('BACKGROUND', (0, 3), (0, 4), colors.HexColor('#fefce8')),
        ('BACKGROUND', (0, 5), (0, 5), colors.HexColor('#fefce8')),
        ('BACKGROUND', (0, 6), (0, 6), colors.HexColor('#f0fdf4')),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(mejoras_table)
    elements.append(Spacer(1, 20))
    
    # FOOTER
    elements.append(Table([['']], colWidths=[6.5*inch], rowHeights=[2], 
                         style=TableStyle([('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#047857'))])))
    elements.append(Spacer(1, 10))
    
    footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=9, alignment=TA_CENTER, textColor=colors.gray)
    elements.append(Paragraph(f"Documento generado el {datetime.now().strftime('%d de %B de %Y')}", footer_style))
    elements.append(Paragraph("Sistema de Gestión Catastral - Asomunicipios", footer_style))
    
    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    
    # Save to file
    temp_path = UPLOAD_DIR / f"Ficha_Tecnica_Asomunicipios_{datetime.now().strftime('%Y%m%d')}.pdf"
    with open(temp_path, 'wb') as f:
        f.write(buffer.getvalue())
    
    return FileResponse(
        path=temp_path,
        filename=f"Ficha_Tecnica_Asomunicipios_{datetime.now().strftime('%Y%m%d')}.pdf",
        media_type='application/pdf'
    )


# ===== AUTH ROUTES =====

@api_router.post("/auth/register")
async def register(user_data: UserRegister):
    # Check if user exists (case-insensitive)
    email_escaped = re.escape(user_data.email.lower())
    existing_user = await db.users.find_one(
        {"email": {"$regex": f"^{email_escaped}$", "$options": "i"}}
    )
    if existing_user:
        # Si existe pero no está verificado, permitir re-registro (reenviar código)
        if not existing_user.get('email_verified', False):
            # Generar nuevo código
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
            
            # Enviar código por email
            try:
                await enviar_codigo_verificacion(user_data.email, verification_code, format_nombre_propio(user_data.full_name))
            except Exception as e:
                logger.error(f"Error enviando código de verificación: {e}")
            
            return {
                "message": "Se ha enviado un código de verificación a su correo electrónico",
                "requires_verification": True,
                "email": user_data.email
            }
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El correo ya está registrado")
    
    # Validate password
    is_valid, error_msg = validate_password(user_data.password)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)
    
    # Formatear el nombre propio con mayúsculas y tildes correctas
    nombre_formateado = format_nombre_propio(user_data.full_name)
    
    # Generar código de verificación (6 dígitos)
    verification_code = str(random.randint(100000, 999999))
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
    
    # Always assign usuario role on self-registration
    user = User(
        email=user_data.email,
        full_name=nombre_formateado,
        role=UserRole.USUARIO,
        email_verified=False,
        verification_code=verification_code,
        verification_code_expires=expires_at
    )
    
    doc = user.model_dump()
    doc['password'] = hash_password(user_data.password)
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.users.insert_one(doc)
    
    # Enviar código por email
    try:
        await enviar_codigo_verificacion(user_data.email, verification_code, nombre_formateado)
    except Exception as e:
        logger.error(f"Error enviando código de verificación: {e}")
    
    # NO devolver token hasta que el email esté verificado
    return {
        "message": "Se ha enviado un código de verificación a su correo electrónico",
        "requires_verification": True,
        "email": user_data.email
    }


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
    
    await send_email_notification(
        to_email=email,
        subject="Código de Verificación - Asomunicipios",
        html_content=html_content
    )


@api_router.post("/auth/verify-email")
async def verify_email(data: VerifyEmailCode):
    """Verifica el código de email enviado durante el registro"""
    email_escaped = re.escape(data.email.lower())
    user = await db.users.find_one(
        {"email": {"$regex": f"^{email_escaped}$", "$options": "i"}},
        {"_id": 0}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get('email_verified', False):
        raise HTTPException(status_code=400, detail="El correo ya está verificado")
    
    # Verificar código
    if user.get('verification_code') != data.code:
        raise HTTPException(status_code=400, detail="Código de verificación inválido")
    
    # Verificar expiración
    expires_str = user.get('verification_code_expires')
    if expires_str:
        expires_at = datetime.fromisoformat(expires_str.replace('Z', '+00:00'))
        if datetime.now(timezone.utc) > expires_at:
            raise HTTPException(status_code=400, detail="El código de verificación ha expirado. Solicita uno nuevo.")
    
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


@api_router.post("/auth/resend-verification")
async def resend_verification_code(data: ResendVerificationCode):
    """Reenvía el código de verificación"""
    email_escaped = re.escape(data.email.lower())
    user = await db.users.find_one(
        {"email": {"$regex": f"^{email_escaped}$", "$options": "i"}},
        {"_id": 0}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get('email_verified', False):
        raise HTTPException(status_code=400, detail="El correo ya está verificado")
    
    # Generar nuevo código
    verification_code = str(random.randint(100000, 999999))
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
    
    await db.users.update_one(
        {"id": user['id']},
        {"$set": {
            "verification_code": verification_code,
            "verification_code_expires": expires_at
        }}
    )
    
    # Enviar código por email
    try:
        await enviar_codigo_verificacion(data.email, verification_code, user['full_name'])
    except Exception as e:
        logger.error(f"Error reenviando código de verificación: {e}")
        raise HTTPException(status_code=500, detail="Error enviando el código. Intente más tarde.")
    
    return {"message": "Se ha enviado un nuevo código de verificación a su correo"}

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    # Case-insensitive email search using regex (escape special chars)
    email_escaped = re.escape(credentials.email.lower())
    user = await db.users.find_one(
        {"email": {"$regex": f"^{email_escaped}$", "$options": "i"}}, 
        {"_id": 0}
    )
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")
    
    if not verify_password(credentials.password, user['password']):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")
    
    # Verificar si el email está verificado (excepto admin protegido y usuarios internos)
    is_protected_admin = user.get('email', '').lower() == PROTECTED_ADMIN_EMAIL.lower()
    is_internal_user = user.get('role') in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR, UserRole.GESTOR, UserRole.ATENCION_USUARIO, UserRole.COMUNICACIONES]
    
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
    
    return {
        "token": token,
        "user": {
            "id": user['id'],
            "email": user['email'],
            "full_name": user['full_name'],
            "role": user['role']
        }
    }

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    # Get additional user data from database
    user_db = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
    
    # Obtener permisos del usuario
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


# ===== PASSWORD RECOVERY =====

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@api_router.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """Send password reset email"""
    # Case-insensitive email search (escape special chars)
    email_escaped = re.escape(request.email.lower())
    user = await db.users.find_one(
        {"email": {"$regex": f"^{email_escaped}$", "$options": "i"}}, 
        {"_id": 0}
    )
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe una cuenta con ese correo")
    
    # Check if SMTP is configured
    if not SMTP_USER or not SMTP_PASSWORD:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="El servicio de correo no está configurado")
    
    # Generate reset token (valid for 1 hour)
    reset_token = str(uuid.uuid4())
    expiration = datetime.now(timezone.utc) + timedelta(hours=1)
    
    # Store reset token in database
    await db.password_resets.delete_many({"email": request.email})  # Remove old tokens
    await db.password_resets.insert_one({
        "email": request.email,
        "token": reset_token,
        "expires_at": expiration.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Get frontend URL from environment or use default
    frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
    reset_link = f"{frontend_url}/reset-password?token={reset_token}"
    
    # Send email using standard template
    contenido = f'''
    <p>Hola <strong>{user['full_name']}</strong>,</p>
    <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en el Sistema de Gestión Catastral.</p>
    <p>Haz clic en el siguiente botón para crear una nueva contraseña:</p>
    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <p style="margin: 0; color: #92400e;"><strong>⏰ Importante:</strong> Este enlace expirará en 1 hora.</p>
    </div>
    <p style="color: #64748b; font-size: 14px;">Si no solicitaste este cambio, puedes ignorar este correo de forma segura.</p>
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
        logging.error(f"Failed to send reset email: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al enviar el correo")
    
    return {"message": "Se ha enviado un enlace de recuperación a tu correo"}

@api_router.get("/auth/validate-reset-token")
async def validate_reset_token(token: str):
    """Validate password reset token"""
    reset_record = await db.password_resets.find_one({"token": token}, {"_id": 0})
    
    if not reset_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Token inválido")
    
    expires_at = datetime.fromisoformat(reset_record['expires_at'])
    if datetime.now(timezone.utc) > expires_at:
        await db.password_resets.delete_one({"token": token})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El token ha expirado")
    
    return {"valid": True}

@api_router.post("/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Reset password with token"""
    reset_record = await db.password_resets.find_one({"token": request.token}, {"_id": 0})
    
    if not reset_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Token inválido")
    
    expires_at = datetime.fromisoformat(reset_record['expires_at'])
    if datetime.now(timezone.utc) > expires_at:
        await db.password_resets.delete_one({"token": request.token})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El token ha expirado")
    
    # Validate new password
    is_valid, error_msg = validate_password(request.new_password)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)
    
    # Update password
    new_hashed_password = hash_password(request.new_password)
    await db.users.update_one(
        {"email": reset_record['email']},
        {"$set": {"password": new_hashed_password}}
    )
    
    # Delete used token
    await db.password_resets.delete_one({"token": request.token})
    
    return {"message": "Contraseña actualizada exitosamente"}


# ===== USER MANAGEMENT ROUTES =====

@api_router.get("/users", response_model=List[User])
async def get_users(current_user: dict = Depends(get_current_user)):
    # Only admin, coordinador, and atencion can view users
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR, UserRole.ATENCION_USUARIO]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tiene permiso")
    
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    
    for user in users:
        if isinstance(user.get('created_at'), str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
    
    return users

# Email del administrador protegido - no se puede cambiar su rol
PROTECTED_ADMIN_EMAIL = "catastro@asomunicipios.gov.co"

@api_router.patch("/users/role")
async def update_user_role(role_update: UserRoleUpdate, current_user: dict = Depends(get_current_user)):
    # Only admin, coordinador, and atencion can change roles
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR, UserRole.ATENCION_USUARIO]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tiene permiso para cambiar roles")
    
    # Validate new role
    valid_roles = [UserRole.USUARIO, UserRole.ATENCION_USUARIO, UserRole.GESTOR, UserRole.COORDINADOR, UserRole.ADMINISTRADOR, UserRole.COMUNICACIONES]
    if role_update.new_role not in valid_roles:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Rol inválido")
    
    user = await db.users.find_one({"id": role_update.user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    
    # Proteger al admin principal - nadie puede cambiar su rol
    if user.get('email', '').lower() == PROTECTED_ADMIN_EMAIL.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="No se puede modificar el rol del administrador principal del sistema"
        )
    
    await db.users.update_one(
        {"id": role_update.user_id},
        {"$set": {"role": role_update.new_role}}
    )
    
    return {"message": "Rol actualizado exitosamente", "new_role": role_update.new_role}


@api_router.post("/admin/migrate-ciudadano-to-usuario")
async def migrate_ciudadano_to_usuario(current_user: dict = Depends(get_current_user)):
    """Migra usuarios con rol 'ciudadano' a 'usuario' (solo admin)"""
    if current_user['role'] != UserRole.ADMINISTRADOR:
        raise HTTPException(status_code=403, detail="Solo administradores pueden ejecutar esta migración")
    
    # Count before
    before_count = await db.users.count_documents({'role': 'ciudadano'})
    
    # Update all ciudadano to usuario
    result = await db.users.update_many(
        {'role': 'ciudadano'},
        {'$set': {'role': 'usuario'}}
    )
    
    # Count after
    usuario_count = await db.users.count_documents({'role': 'usuario'})
    
    return {
        "message": f"Migración completada",
        "users_with_ciudadano_before": before_count,
        "users_migrated": result.modified_count,
        "users_with_usuario_after": usuario_count
    }


@api_router.post("/admin/format-user-names")
async def format_user_names(current_user: dict = Depends(get_current_user)):
    """Formatea los nombres de usuarios existentes con mayúsculas y tildes correctas (solo admin)"""
    if current_user['role'] != UserRole.ADMINISTRADOR:
        raise HTTPException(status_code=403, detail="Solo administradores pueden ejecutar esta operación")
    
    # Get all users
    users = await db.users.find({}, {"_id": 0, "id": 1, "full_name": 1}).to_list(None)
    
    updated_count = 0
    examples = []
    
    for user in users:
        original_name = user['full_name']
        formatted_name = format_nombre_propio(original_name)
        
        if original_name != formatted_name:
            await db.users.update_one(
                {"id": user['id']},
                {"$set": {"full_name": formatted_name}}
            )
            updated_count += 1
            if len(examples) < 5:
                examples.append({"original": original_name, "formatted": formatted_name})
    
    return {
        "message": f"Formateo de nombres completado",
        "total_users": len(users),
        "users_updated": updated_count,
        "examples": examples
    }


@api_router.post("/admin/format-petition-names")
async def format_petition_names(current_user: dict = Depends(get_current_user)):
    """Formatea los nombres de solicitantes en peticiones existentes (solo admin)"""
    if current_user['role'] != UserRole.ADMINISTRADOR:
        raise HTTPException(status_code=403, detail="Solo administradores pueden ejecutar esta operación")
    
    # Get all petitions with nombre_completo
    petitions = await db.petitions.find(
        {"nombre_completo": {"$exists": True}},
        {"_id": 0, "id": 1, "nombre_completo": 1}
    ).to_list(None)
    
    updated_count = 0
    examples = []
    
    for petition in petitions:
        original_name = petition.get('nombre_completo', '')
        if original_name:
            formatted_name = format_nombre_propio(original_name)
            
            if original_name != formatted_name:
                await db.petitions.update_one(
                    {"id": petition['id']},
                    {"$set": {"nombre_completo": formatted_name}}
                )
                updated_count += 1
                if len(examples) < 5:
                    examples.append({"original": original_name, "formatted": formatted_name})
    
    return {
        "message": f"Formateo de nombres en peticiones completado",
        "total_petitions": len(petitions),
        "petitions_updated": updated_count,
        "examples": examples
    }


# ===== PERMISSIONS MANAGEMENT =====

@api_router.get("/permissions/available")
async def get_available_permissions(current_user: dict = Depends(get_current_user)):
    """Obtiene la lista de permisos disponibles en el sistema"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="No tiene permiso para ver permisos")
    
    return {
        "permissions": [
            {"key": perm, "description": Permission.get_description(perm)}
            for perm in Permission.all_permissions()
        ]
    }

@api_router.get("/permissions/users")
async def get_users_with_permissions(current_user: dict = Depends(get_current_user)):
    """Obtiene usuarios con sus permisos (para gestores y coordinadores)"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="No tiene permiso para gestionar permisos")
    
    # Obtener usuarios que pueden tener permisos (gestores, coordinadores)
    users = await db.users.find(
        {"role": {"$in": [UserRole.GESTOR, UserRole.COORDINADOR]}},
        {"_id": 0, "password_hash": 0}
    ).to_list(1000)
    
    # Agregar descripciones de permisos
    for user in users:
        user_permissions = user.get('permissions', [])
        user['permissions_detail'] = [
            {"key": perm, "description": Permission.get_description(perm)}
            for perm in user_permissions
        ]
    
    return {"users": users}

@api_router.patch("/permissions/user")
async def update_user_permissions(
    update: UserPermissionsUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Actualiza los permisos de un usuario"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="No tiene permiso para modificar permisos")
    
    # Validar que los permisos sean válidos
    valid_permissions = Permission.all_permissions()
    for perm in update.permissions:
        if perm not in valid_permissions:
            raise HTTPException(status_code=400, detail=f"Permiso inválido: {perm}")
    
    # Buscar usuario
    user = await db.users.find_one({"id": update.user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # No permitir modificar permisos de administradores
    if user['role'] == UserRole.ADMINISTRADOR:
        raise HTTPException(status_code=400, detail="No se pueden modificar permisos de administradores")
    
    # Actualizar permisos
    await db.users.update_one(
        {"id": update.user_id},
        {"$set": {"permissions": update.permissions}}
    )
    
    # Registrar el cambio en historial
    await db.permissions_history.insert_one({
        "user_id": update.user_id,
        "changed_by": current_user['id'],
        "changed_by_name": current_user['full_name'],
        "old_permissions": user.get('permissions', []),
        "new_permissions": update.permissions,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    # Crear notificación para el usuario si se agregaron nuevos permisos
    old_permissions = set(user.get('permissions', []))
    new_permissions = set(update.permissions)
    added_permissions = new_permissions - old_permissions
    removed_permissions = old_permissions - new_permissions
    
    if added_permissions or removed_permissions:
        # Construir mensaje de notificación
        message_parts = []
        if added_permissions:
            added_desc = [Permission.get_description(p) for p in added_permissions]
            message_parts.append(f"Permisos otorgados: {', '.join(added_desc)}")
        if removed_permissions:
            removed_desc = [Permission.get_description(p) for p in removed_permissions]
            message_parts.append(f"Permisos revocados: {', '.join(removed_desc)}")
        
        await crear_notificacion(
            usuario_id=update.user_id,
            titulo="Actualización de Permisos",
            mensaje=f"{current_user['full_name']} ha actualizado tus permisos. {' | '.join(message_parts)}",
            tipo="permisos",
            enviar_email=True  # Enviar notificación por email
        )
    
    return {
        "message": "Permisos actualizados exitosamente",
        "user_id": update.user_id,
        "permissions": update.permissions
    }

@api_router.get("/permissions/user/{user_id}")
async def get_user_permissions(user_id: str, current_user: dict = Depends(get_current_user)):
    """Obtiene los permisos de un usuario específico"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        # Un usuario puede ver sus propios permisos
        if current_user['id'] != user_id:
            raise HTTPException(status_code=403, detail="No tiene permiso para ver permisos de otros usuarios")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    permissions = user.get('permissions', [])
    return {
        "user_id": user_id,
        "permissions": permissions,
        "permissions_detail": [
            {"key": perm, "description": Permission.get_description(perm)}
            for perm in permissions
        ]
    }


# ===== PETITION ROUTES =====

@api_router.post("/petitions")
async def create_petition(
    nombre_completo: str = Form(...),
    correo: str = Form(...),
    telefono: str = Form(...),
    tipo_tramite: str = Form(...),
    municipio: str = Form(...),
    descripcion: str = Form(default=""),
    files: List[UploadFile] = File(default=[]),
    current_user: dict = Depends(get_current_user)
):
    radicado = await generate_radicado()
    
    # Save files
    saved_files = []
    for file in files:
        if file.filename:
            file_id = str(uuid.uuid4())
            file_ext = Path(file.filename).suffix
            file_path = UPLOAD_DIR / f"{file_id}{file_ext}"
            
            with file_path.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            saved_files.append({
                "id": file_id,
                "original_name": file.filename,
                "path": str(file_path)
            })
    
    # Initialize historial
    historial = [{
        "accion": "Radicado creado",
        "usuario": current_user['full_name'],
        "usuario_rol": current_user['role'],
        "estado_anterior": None,
        "estado_nuevo": PetitionStatus.RADICADO,
        "notas": "Petición radicada en el sistema",
        "fecha": datetime.now(timezone.utc).isoformat()
    }]
    
    petition = Petition(
        radicado=radicado,
        user_id=current_user['id'],
        nombre_completo=nombre_completo,
        correo=correo,
        telefono=telefono,
        tipo_tramite=tipo_tramite,
        municipio=municipio,
        descripcion=descripcion,
        archivos=saved_files,
        historial=historial
    )
    
    doc = petition.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.petitions.insert_one(doc)
    
    # Notificación en plataforma a atención al usuario (NO correo) si la crea un ciudadano
    if current_user['role'] == UserRole.USUARIO:
        atencion_users = await db.users.find({"role": UserRole.ATENCION_USUARIO}, {"_id": 0}).to_list(100)
        for user in atencion_users:
            await crear_notificacion(
                usuario_id=user['id'],
                tipo="info",
                titulo="Nueva petición radicada",
                mensaje=f"Nueva petición {radicado} de {nombre_completo} - {tipo_tramite}",
                enlace=f"/dashboard/peticion/{petition.id}"
            )
    
    return petition

@api_router.get("/petitions")
async def get_petitions(current_user: dict = Depends(get_current_user)):
    # Citizens only see their own petitions
    if current_user['role'] == UserRole.USUARIO:
        query = {"user_id": current_user['id']}
    # Gestores see assigned petitions
    elif current_user['role'] in [UserRole.GESTOR]:
        query = {"gestores_asignados": current_user['id']}
    else:
        # Staff (atencion_usuario, coordinador, administrador) see all petitions
        query = {}
    
    # Sin límite - retorna TODAS las peticiones
    petitions = await db.petitions.find(query, {"_id": 0}).sort("created_at", -1).to_list(None)
    
    for petition in petitions:
        if isinstance(petition['created_at'], str):
            petition['created_at'] = datetime.fromisoformat(petition['created_at'])
        if isinstance(petition['updated_at'], str):
            petition['updated_at'] = datetime.fromisoformat(petition['updated_at'])
    
    return petitions

@api_router.get("/petitions/mis-peticiones")
async def get_my_petitions(current_user: dict = Depends(get_current_user)):
    """Obtener peticiones creadas por el usuario actual (para todos los roles)"""
    query = {"user_id": current_user['id']}
    
    petitions = await db.petitions.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    for petition in petitions:
        if isinstance(petition['created_at'], str):
            petition['created_at'] = datetime.fromisoformat(petition['created_at'])
        if isinstance(petition['updated_at'], str):
            petition['updated_at'] = datetime.fromisoformat(petition['updated_at'])
    
    return petitions

@api_router.get("/petitions/{petition_id}")
async def get_petition(petition_id: str, current_user: dict = Depends(get_current_user)):
    petition = await db.petitions.find_one({"id": petition_id}, {"_id": 0})
    
    if not petition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Petición no encontrada")
    
    # Citizens can only see their own petitions
    if current_user['role'] == UserRole.USUARIO and petition['user_id'] != current_user['id']:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tiene permiso para ver esta petición")
    
    # Gestores can only see assigned petitions
    if current_user['role'] in [UserRole.GESTOR]:
        if current_user['id'] not in petition.get('gestores_asignados', []):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tiene permiso para ver esta petición")
    
    if isinstance(petition['created_at'], str):
        petition['created_at'] = datetime.fromisoformat(petition['created_at'])
    if isinstance(petition['updated_at'], str):
        petition['updated_at'] = datetime.fromisoformat(petition['updated_at'])
    
    return petition

@api_router.post("/petitions/{petition_id}/upload")
async def upload_petition_files(
    petition_id: str,
    files: List[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user)
):
    petition = await db.petitions.find_one({"id": petition_id}, {"_id": 0})
    if not petition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Petición no encontrada")
    
    # Citizens and staff can upload files
    # Citizens: only to their own petitions
    # Staff: to any petition they have access to
    if current_user['role'] == UserRole.USUARIO and petition['user_id'] != current_user['id']:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tiene permiso")
    
    saved_files = []
    for file in files:
        if file.filename:
            file_id = str(uuid.uuid4())
            file_ext = Path(file.filename).suffix
            file_path = UPLOAD_DIR / f"{file_id}{file_ext}"
            
            with file_path.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            saved_files.append({
                "id": file_id,
                "original_name": file.filename,
                "path": str(file_path),
                "uploaded_by": current_user['id'],
                "uploaded_by_name": current_user['full_name'],
                "uploaded_by_role": current_user['role'],
                "upload_date": datetime.now(timezone.utc).isoformat()
            })
    
    current_files = petition.get('archivos', [])
    updated_files = current_files + saved_files
    
    # Add to historial
    uploader_role = "Usuario" if current_user['role'] == UserRole.USUARIO else current_user['role'].replace('_', ' ').title()
    historial_entry = {
        "accion": f"Archivos cargados por {uploader_role} ({len(saved_files)} archivo(s))",
        "usuario": current_user['full_name'],
        "usuario_rol": current_user['role'],
        "estado_anterior": petition['estado'],
        "estado_nuevo": petition['estado'],
        "notas": f"Se cargaron {len(saved_files)} archivo(s) adicional(es)",
        "fecha": datetime.now(timezone.utc).isoformat()
    }
    
    current_historial = petition.get('historial', [])
    current_historial.append(historial_entry)
    
    await db.petitions.update_one(
        {"id": petition_id},
        {"$set": {
            "archivos": updated_files,
            "historial": current_historial,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Notify based on who uploaded - SOLO notificación en plataforma, NO correo
    if current_user['role'] == UserRole.USUARIO:
        # Crear notificación en plataforma para gestores asignados o atención al usuario
        if petition.get('gestores_asignados'):
            for gestor_id in petition['gestores_asignados']:
                await crear_notificacion(
                    usuario_id=gestor_id,
                    tipo="info",
                    titulo="Nuevos archivos cargados",
                    mensaje=f"El usuario ha cargado nuevos archivos en el trámite {petition['radicado']}",
                    enlace=f"/dashboard/peticion/{petition_id}"
                )
        else:
            atencion_users = await db.users.find({"role": UserRole.ATENCION_USUARIO}, {"_id": 0}).to_list(100)
            for user in atencion_users:
                await crear_notificacion(
                    usuario_id=user['id'],
                    tipo="info",
                    titulo="Nuevos archivos cargados",
                    mensaje=f"El usuario ha cargado nuevos archivos en el trámite {petition['radicado']}",
                    enlace=f"/dashboard/peticion/{petition_id}"
                )
    # Si el staff sube archivos, NO notificar (se finaliza automáticamente y envía correo ahí)
    
    return {"message": "Archivos subidos exitosamente", "files": saved_files}


@api_router.get("/petitions/{petition_id}/download-zip")
async def download_citizen_files_as_zip(petition_id: str, current_user: dict = Depends(get_current_user)):
    """Download all files uploaded by citizen as a ZIP file"""
    # Only staff can download citizen files
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tiene permiso")
    
    petition = await db.petitions.find_one({"id": petition_id}, {"_id": 0})
    if not petition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Petición no encontrada")
    
    # Filter files uploaded by citizen (check string value, not enum)
    citizen_files = []
    for archivo in petition.get('archivos', []):
        uploaded_by_role = archivo.get('uploaded_by_role', 'usuario')
        if uploaded_by_role == 'usuario' or not archivo.get('uploaded_by_role'):
            citizen_files.append(archivo)
    
    if not citizen_files:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No hay archivos del usuario para descargar")
    
    import zipfile
    
    # Create ZIP file
    zip_filename = f"{petition['radicado']}_archivos_ciudadano.zip"
    zip_path = UPLOAD_DIR / zip_filename
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for archivo in citizen_files:
            file_path = Path(archivo['path'])
            if file_path.exists():
                zipf.write(file_path, archivo['original_name'])
    
    return FileResponse(
        path=zip_path,
        filename=zip_filename,
        media_type='application/zip'
    )

@api_router.post("/petitions/{petition_id}/assign-gestor")
async def assign_gestor(
    petition_id: str,
    assignment: GestorAssignment,
    current_user: dict = Depends(get_current_user)
):
    # Only atencion usuario, gestor, coordinador, and admin can assign
    if current_user['role'] not in [UserRole.ATENCION_USUARIO, UserRole.GESTOR, UserRole.COORDINADOR, UserRole.ADMINISTRADOR]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tiene permiso")
    
    petition = await db.petitions.find_one({"id": petition_id}, {"_id": 0})
    if not petition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Petición no encontrada")
    
    gestor = await db.users.find_one({"id": assignment.gestor_id}, {"_id": 0})
    if not gestor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gestor no encontrado")
    
    # Add gestor to assigned list
    gestores_asignados = petition.get('gestores_asignados', [])
    if assignment.gestor_id not in gestores_asignados:
        gestores_asignados.append(assignment.gestor_id)
    
    update_data = {
        "gestores_asignados": gestores_asignados,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # If first assignment, change status to ASIGNADO
    estado_cambio = False
    if petition['estado'] == PetitionStatus.RADICADO:
        update_data['estado'] = PetitionStatus.ASIGNADO
        estado_cambio = True
    
    # Add to historial
    rol_labels = {
        UserRole.GESTOR: "Gestor",
        UserRole.ATENCION_USUARIO: "Atención al Usuario",
        UserRole.COORDINADOR: "Coordinador",
        UserRole.ADMINISTRADOR: "Administrador"
    }
    gestor_rol = rol_labels.get(gestor['role'], "Staff")
    
    # Construir notas con comentario si existe
    notas_historial = f"Asignado a {gestor['full_name']} ({gestor_rol})"
    if assignment.comentario and assignment.comentario.strip():
        notas_historial += f" - Comentario: {assignment.comentario.strip()}"
    
    historial_entry = {
        "accion": f"{gestor_rol} asignado: {gestor['full_name']}",
        "usuario": current_user['full_name'],
        "usuario_rol": current_user['role'],
        "estado_anterior": petition['estado'],
        "estado_nuevo": update_data.get('estado', petition['estado']),
        "notas": notas_historial,
        "fecha": datetime.now(timezone.utc).isoformat()
    }
    
    current_historial = petition.get('historial', [])
    current_historial.append(historial_entry)
    update_data['historial'] = current_historial
    
    await db.petitions.update_one({"id": petition_id}, {"$set": update_data})
    
    # Notificación en plataforma al gestor asignado (NO correo)
    mensaje_notificacion = f"Se te ha asignado el trámite {petition['radicado']} - {petition['tipo_tramite']}"
    if assignment.comentario and assignment.comentario.strip():
        mensaje_notificacion += f". Instrucciones: {assignment.comentario.strip()}"
    
    await crear_notificacion(
        usuario_id=gestor['id'],
        tipo="info",
        titulo="Nuevo trámite asignado",
        mensaje=mensaje_notificacion,
        enlace=f"/dashboard/peticion/{petition_id}"
    )
    
    return {"message": "Gestor asignado exitosamente"}


@api_router.delete("/petitions/{petition_id}/desasignar/{user_id}")
async def desasignar_staff(petition_id: str, user_id: str, current_user: dict = Depends(get_current_user)):
    """Quitar staff de un radicado - Solo admin, coordinador y atención al usuario"""
    # Verificar permisos
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR, UserRole.ATENCION_USUARIO]:
        raise HTTPException(status_code=403, detail="Solo administradores, coordinadores y atención al usuario pueden quitar staff")
    
    petition = await db.petitions.find_one({"id": petition_id}, {"_id": 0})
    if not petition:
        raise HTTPException(status_code=404, detail="Petición no encontrada")
    
    gestores_asignados = petition.get('gestores_asignados', [])
    
    if user_id not in gestores_asignados:
        raise HTTPException(status_code=400, detail="El usuario no está asignado a esta petición")
    
    # Obtener nombre del usuario que se va a quitar
    user_to_remove = await db.users.find_one({"id": user_id}, {"_id": 0, "full_name": 1, "role": 1})
    user_name = user_to_remove.get('full_name', 'Usuario') if user_to_remove else 'Usuario'
    
    # Quitar del listado
    gestores_asignados.remove(user_id)
    
    # Historial
    historial_entry = {
        "accion": f"Staff removido: {user_name}",
        "usuario": current_user['full_name'],
        "usuario_rol": current_user['role'],
        "notas": f"Se quitó a {user_name} del trámite",
        "fecha": datetime.now(timezone.utc).isoformat()
    }
    
    current_historial = petition.get('historial', [])
    current_historial.append(historial_entry)
    
    await db.petitions.update_one(
        {"id": petition_id},
        {"$set": {
            "gestores_asignados": gestores_asignados,
            "historial": current_historial,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": f"{user_name} ha sido removido del trámite"}


@api_router.post("/petitions/{petition_id}/auto-asignar")
async def auto_asignar_tramite(petition_id: str, current_user: dict = Depends(get_current_user)):
    """Atención al usuario, gestor, coordinador o admin se auto-asigna un trámite"""
    # Roles que pueden auto-asignarse
    if current_user['role'] not in [UserRole.ATENCION_USUARIO, UserRole.GESTOR, UserRole.COORDINADOR, UserRole.ADMINISTRADOR]:
        raise HTTPException(status_code=403, detail="No tiene permiso para auto-asignarse")
    
    petition = await db.petitions.find_one({"id": petition_id}, {"_id": 0})
    if not petition:
        raise HTTPException(status_code=404, detail="Petición no encontrada")
    
    gestores_asignados = petition.get('gestores_asignados', [])
    
    if current_user['id'] in gestores_asignados:
        raise HTTPException(status_code=400, detail="Ya está asignado a esta petición")
    
    gestores_asignados.append(current_user['id'])
    
    update_data = {
        "gestores_asignados": gestores_asignados,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Si es el primer asignado, cambiar estado
    if petition['estado'] == PetitionStatus.RADICADO:
        update_data['estado'] = PetitionStatus.ASIGNADO
    
    # Historial
    rol_labels = {
        UserRole.ATENCION_USUARIO: "Atención al Usuario",
        UserRole.COORDINADOR: "Coordinador",
        UserRole.ADMINISTRADOR: "Administrador"
    }
    
    historial_entry = {
        "accion": f"Auto-asignación: {current_user['full_name']} ({rol_labels.get(current_user['role'], 'Staff')})",
        "usuario": current_user['full_name'],
        "usuario_rol": current_user['role'],
        "notas": "Auto-asignación de trámite",
        "fecha": datetime.now(timezone.utc).isoformat()
    }
    
    current_historial = petition.get('historial', [])
    current_historial.append(historial_entry)
    update_data['historial'] = current_historial
    
    await db.petitions.update_one({"id": petition_id}, {"$set": update_data})
    
    return {"message": "Se ha asignado exitosamente al trámite"}

@api_router.patch("/petitions/{petition_id}")
async def update_petition(petition_id: str, update_data: PetitionUpdate, current_user: dict = Depends(get_current_user)):
    # Citizens cannot update petitions
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tiene permiso para actualizar peticiones")
    
    petition = await db.petitions.find_one({"id": petition_id}, {"_id": 0})
    if not petition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Petición no encontrada")
    
    # Determine what fields can be updated based on role
    update_dict = {}
    historial_entry = None
    
    if current_user['role'] in [UserRole.COORDINADOR, UserRole.ADMINISTRADOR]:
        # Coordinador and Admin can update all fields
        update_dict = update_data.model_dump(exclude_none=True)
    elif current_user['role'] == UserRole.ATENCION_USUARIO:
        # Atención al usuario can update status, notes, and can finalize/reject
        if update_data.estado:
            update_dict['estado'] = update_data.estado
        if update_data.notas:
            update_dict['notas'] = update_data.notas
    elif current_user['role'] in [UserRole.GESTOR]:
        # Gestores can only update notes and send to revision
        if update_data.notas:
            update_dict['notas'] = update_data.notas
        if update_data.estado in [PetitionStatus.REVISION, PetitionStatus.RECHAZADO]:
            update_dict['estado'] = update_data.estado
    
    if update_dict:
        update_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        # Create historial entry if status changed
        if 'estado' in update_dict:
            estado_anterior = petition.get('estado')
            estado_nuevo = update_dict['estado']
            
            status_names = {
                PetitionStatus.RADICADO: "Radicado",
                PetitionStatus.ASIGNADO: "Asignado",
                PetitionStatus.RECHAZADO: "Rechazado",
                PetitionStatus.REVISION: "En Revisión",
                PetitionStatus.DEVUELTO: "Devuelto",
                PetitionStatus.FINALIZADO: "Finalizado"
            }
            
            # Si se está devolviendo, guardar info del que devuelve y observaciones
            if estado_nuevo == PetitionStatus.DEVUELTO:
                update_dict['devuelto_por_id'] = current_user['id']
                update_dict['devuelto_por_nombre'] = current_user['full_name']
                if update_data.observaciones_devolucion:
                    update_dict['observaciones_devolucion'] = update_data.observaciones_devolucion
            
            historial_entry = {
                "accion": f"Estado cambiado de {status_names.get(estado_anterior, estado_anterior)} a {status_names.get(estado_nuevo, estado_nuevo)}",
                "usuario": current_user['full_name'],
                "usuario_rol": current_user['role'],
                "estado_anterior": estado_anterior,
                "estado_nuevo": estado_nuevo,
                "notas": update_dict.get('notas', ''),
                "observaciones_devolucion": update_data.observaciones_devolucion if estado_nuevo == PetitionStatus.DEVUELTO else None,
                "fecha": datetime.now(timezone.utc).isoformat()
            }
            
            # Add to historial
            current_historial = petition.get('historial', [])
            current_historial.append(historial_entry)
            update_dict['historial'] = current_historial
            
            # AUTO-ASIGNACIÓN: Cuando pasa a "revisión", asignar automáticamente 
            # al coordinador y gestores con permiso de aprobar cambios
            if estado_nuevo == PetitionStatus.REVISION:
                # Buscar coordinadores y gestores con permiso de aprobar
                aprobadores = await db.users.find({
                    "$or": [
                        {"role": UserRole.COORDINADOR},
                        {"role": UserRole.ADMINISTRADOR},
                        {"permissions": Permission.APPROVE_CHANGES}
                    ]
                }, {"_id": 0, "id": 1, "full_name": 1, "role": 1}).to_list(100)
                
                gestores_asignados = petition.get('gestores_asignados', [])
                nuevos_asignados = []
                
                for aprobador in aprobadores:
                    if aprobador['id'] not in gestores_asignados:
                        gestores_asignados.append(aprobador['id'])
                        nuevos_asignados.append(aprobador)
                
                if nuevos_asignados:
                    update_dict['gestores_asignados'] = gestores_asignados
                    
                    # Agregar entrada al historial
                    nombres_asignados = [a['full_name'] for a in nuevos_asignados]
                    auto_historial = {
                        "accion": f"Auto-asignado a revisores: {', '.join(nombres_asignados)}",
                        "usuario": "Sistema",
                        "usuario_rol": "sistema",
                        "notas": "Asignación automática al pasar a revisión",
                        "fecha": datetime.now(timezone.utc).isoformat()
                    }
                    update_dict['historial'].append(auto_historial)
                    
                    # Notificar a los aprobadores
                    for aprobador in nuevos_asignados:
                        await crear_notificacion(
                            usuario_id=aprobador['id'],
                            tipo="info",
                            titulo="Trámite en Revisión",
                            mensaje=f"El trámite {petition['radicado']} está listo para su revisión y aprobación.",
                            enlace=f"/dashboard/peticion/{petition_id}",
                            enviar_email=False
                        )
        
        await db.petitions.update_one({"id": petition_id}, {"$set": update_dict})
        
        # Send email notification to citizen if status changed
        if 'estado' in update_dict:
            # Solo enviar email si hay un ciudadano asociado y correo electrónico
            citizen_email = petition.get('correo')
            nombre_solicitante = petition.get('nombre_completo', 'Usuario')
            
            # Intentar obtener más info del usuario si existe
            if petition.get('user_id'):
                citizen = await db.users.find_one({"id": petition['user_id']}, {"_id": 0})
                if citizen:
                    citizen_email = citizen_email or citizen.get('email')
                    nombre_solicitante = nombre_solicitante or citizen.get('full_name', 'Usuario')
            
            if citizen_email:
                estado_nuevo = update_dict['estado']
                
                # Usar plantilla especial para finalización
                if estado_nuevo == PetitionStatus.FINALIZADO:
                    # Verificar si hay archivos del staff para adjuntar
                    archivos_staff = petition.get('archivos_staff', [])
                    enviar_archivos = update_data.enviar_archivos_finalizacion and len(archivos_staff) > 0
                    
                    email_body = get_finalizacion_email(
                        radicado=petition['radicado'],
                        tipo_tramite=petition['tipo_tramite'],
                        nombre_solicitante=nombre_solicitante,
                        con_archivos=enviar_archivos
                    )
                    
                    # Si se deben enviar archivos, prepararlos
                    attachments = []
                    if enviar_archivos:
                        uploads_dir = Path("uploads") / petition_id
                        for archivo in archivos_staff:
                            archivo_path = uploads_dir / archivo.get('filename', '')
                            if archivo_path.exists():
                                attachments.append(str(archivo_path))
                    
                    await send_email(
                        citizen_email,
                        f"¡Trámite Finalizado! - {petition['radicado']}",
                        email_body,
                        attachments=attachments if attachments else None
                    )
                    
                    # Notificar a TODOS los gestores asignados que el trámite fue finalizado
                    gestores_asignados = petition.get('gestores_asignados', [])
                    for gestor_id in gestores_asignados:
                        if gestor_id != current_user['id']:  # No notificar al que finalizó
                            await crear_notificacion(
                                usuario_id=gestor_id,
                                tipo="info",
                                titulo="Trámite Finalizado",
                                mensaje=f"El trámite {petition['radicado']} ha sido finalizado por {current_user['full_name']}.",
                                enlace=f"/dashboard/peticiones/{petition_id}",
                                enviar_email=False
                            )
                else:
                    email_body = get_actualizacion_email(
                        radicado=petition['radicado'],
                        estado_nuevo=estado_nuevo,
                        nombre_solicitante=nombre_solicitante,
                        observaciones=update_data.observaciones_devolucion if estado_nuevo == PetitionStatus.DEVUELTO else None
                    )
                    
                    await send_email(
                        citizen_email,
                        f"Actualización de Trámite - {petition['radicado']}",
                        email_body
                    )
    
    updated_petition = await db.petitions.find_one({"id": petition_id}, {"_id": 0})
    
    if isinstance(updated_petition['created_at'], str):
        updated_petition['created_at'] = datetime.fromisoformat(updated_petition['created_at'])
    if isinstance(updated_petition['updated_at'], str):
        updated_petition['updated_at'] = datetime.fromisoformat(updated_petition['updated_at'])
    
    return updated_petition

@api_router.get("/petitions/stats/dashboard")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.USUARIO:
        query = {"user_id": current_user['id']}
    elif current_user['role'] in [UserRole.GESTOR]:
        query = {"gestores_asignados": current_user['id']}
    else:
        query = {}
    
    total = await db.petitions.count_documents(query)
    radicado = await db.petitions.count_documents({**query, "estado": PetitionStatus.RADICADO})
    asignado = await db.petitions.count_documents({**query, "estado": PetitionStatus.ASIGNADO})
    rechazado = await db.petitions.count_documents({**query, "estado": PetitionStatus.RECHAZADO})
    revision = await db.petitions.count_documents({**query, "estado": PetitionStatus.REVISION})
    devuelto = await db.petitions.count_documents({**query, "estado": PetitionStatus.DEVUELTO})
    finalizado = await db.petitions.count_documents({**query, "estado": PetitionStatus.FINALIZADO})
    
    return {
        "total": total,
        "radicado": radicado,
        "asignado": asignado,
        "rechazado": rechazado,
        "revision": revision,
        "devuelto": devuelto,
        "finalizado": finalizado
    }

@api_router.post("/petitions/{petition_id}/reenviar")
async def reenviar_petition(petition_id: str, current_user: dict = Depends(get_current_user)):
    """
    Permite al usuario reenviar una petición devuelta para revisión.
    Notifica al miembro del staff que la devolvió.
    """
    petition = await db.petitions.find_one({"id": petition_id}, {"_id": 0})
    
    if not petition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Petición no encontrada")
    
    # Solo el propietario puede reenviar (usar .get() para evitar KeyError)
    petition_user_id = petition.get('user_id')
    if not petition_user_id or petition_user_id != current_user['id']:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tiene permiso para reenviar esta petición")
    
    # Solo se puede reenviar si está devuelta
    if petition.get('estado') != PetitionStatus.DEVUELTO:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Solo puede reenviar peticiones devueltas")
    
    # Cambiar estado a revisión
    historial_entry = {
        "accion": "Petición reenviada para revisión por el usuario",
        "usuario": current_user['full_name'],
        "usuario_rol": current_user['role'],
        "estado_anterior": PetitionStatus.DEVUELTO,
        "estado_nuevo": PetitionStatus.REVISION,
        "notas": "El usuario ha realizado las correcciones solicitadas y reenvía el trámite para revisión.",
        "fecha": datetime.now(timezone.utc).isoformat()
    }
    
    current_historial = petition.get('historial', [])
    current_historial.append(historial_entry)
    
    await db.petitions.update_one(
        {"id": petition_id},
        {"$set": {
            "estado": PetitionStatus.REVISION,
            "historial": current_historial,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Notificar al staff que devolvió el trámite
    devuelto_por_id = petition.get('devuelto_por_id')
    if devuelto_por_id:
        await crear_notificacion(
            usuario_id=devuelto_por_id,
            titulo="Trámite Reenviado para Revisión",
            mensaje=f"El usuario {current_user['full_name']} ha reenviado el trámite {petition['radicado']} para revisión después de realizar las correcciones solicitadas.",
            tipo="info",
            enlace=f"/dashboard/peticion/{petition_id}",
            enviar_email=True
        )
    else:
        # Si no hay registro de quién devolvió, notificar a los gestores asignados
        for gestor_id in petition.get('gestores_asignados', []):
            await crear_notificacion(
                usuario_id=gestor_id,
                titulo="Trámite Reenviado para Revisión",
                mensaje=f"El usuario ha reenviado el trámite {petition['radicado']} para revisión.",
                tipo="info",
                enlace=f"/dashboard/peticion/{petition_id}",
                enviar_email=True
            )
    
    return {"message": "Petición reenviada exitosamente para revisión"}

@api_router.get("/gestores")
async def get_gestores(current_user: dict = Depends(get_current_user)):
    # Get all users that can be assigned to petitions (gestores, auxiliares, atencion_usuario, coordinadores, admin)
    gestores = await db.users.find(
        {"role": {"$in": [UserRole.GESTOR, UserRole.ATENCION_USUARIO, UserRole.COORDINADOR, UserRole.ADMINISTRADOR]}},
        {"_id": 0, "password": 0}
    ).sort("full_name", 1).to_list(1000)  # Ordenar alfabéticamente por nombre
    
    return gestores


# ===== PDF EXPORT AND DIGITAL SIGNATURE =====

def generate_petition_pdf(petition_data: dict, user_data: dict, signed_by: str = None) -> bytes:
    """Generate PDF report for a petition with optional digital signature"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    story = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#047857'),
        spaceAfter=30,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#064E3B'),
        spaceAfter=12,
        fontName='Helvetica-Bold'
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=11,
        spaceAfter=12
    )
    
    # Title
    story.append(Paragraph("ASOCIACIÓN DE MUNICIPIOS DEL CATATUMBO", title_style))
    story.append(Paragraph("Provincia de Ocaña y Sur del Cesar - ASOMUNICIPIOS", normal_style))
    story.append(Spacer(1, 0.3*inch))
    
    # Radicado
    story.append(Paragraph(f"<b>Radicado:</b> {petition_data.get('radicado', 'N/A')}", heading_style))
    story.append(Spacer(1, 0.2*inch))
    
    # Status
    status_names = {
        'radicado': 'Radicado',
        'asignado': 'Asignado',
        'rechazado': 'Rechazado',
        'revision': 'En Revisión',
        'devuelto': 'Devuelto',
        'finalizado': 'Finalizado'
    }
    status_label = status_names.get(petition_data.get('estado', ''), petition_data.get('estado', 'N/A'))
    story.append(Paragraph(f"<b>Estado:</b> {status_label}", normal_style))
    story.append(Spacer(1, 0.2*inch))
    
    # Petition details table
    story.append(Paragraph("DATOS DEL SOLICITANTE", heading_style))
    
    data = [
        ['Campo', 'Información'],
        ['Nombre Completo', petition_data.get('nombre_completo', 'N/A')],
        ['Correo Electrónico', petition_data.get('correo', 'N/A')],
        ['Teléfono', petition_data.get('telefono', 'N/A')],
        ['Municipio', petition_data.get('municipio', 'N/A')],
        ['Tipo de Trámite', petition_data.get('tipo_tramite', 'N/A')],
    ]
    
    table = Table(data, colWidths=[2*inch, 4*inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#047857')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
    ]))
    
    story.append(table)
    story.append(Spacer(1, 0.3*inch))
    
    # Notes if any
    if petition_data.get('notas'):
        story.append(Paragraph("NOTAS", heading_style))
        story.append(Paragraph(petition_data.get('notas', ''), normal_style))
        story.append(Spacer(1, 0.3*inch))
    
    # Dates
    story.append(Paragraph("INFORMACIÓN DE FECHAS", heading_style))
    created_date = petition_data.get('created_at', '')
    updated_date = petition_data.get('updated_at', '')
    
    if isinstance(created_date, str):
        created_date = datetime.fromisoformat(created_date).strftime('%d/%m/%Y %H:%M')
    else:
        created_date = created_date.strftime('%d/%m/%Y %H:%M') if created_date else 'N/A'
    
    if isinstance(updated_date, str):
        updated_date = datetime.fromisoformat(updated_date).strftime('%d/%m/%Y %H:%M')
    else:
        updated_date = updated_date.strftime('%d/%m/%Y %H:%M') if updated_date else 'N/A'
    
    story.append(Paragraph(f"<b>Fecha de Radicación:</b> {created_date}", normal_style))
    story.append(Paragraph(f"<b>Última Actualización:</b> {updated_date}", normal_style))
    story.append(Spacer(1, 0.5*inch))
    
    # Digital signature section
    if signed_by:
        story.append(Spacer(1, 0.5*inch))
        story.append(Paragraph("___________________________", normal_style))
        story.append(Paragraph("<b>Firmado digitalmente por:</b>", normal_style))
        story.append(Paragraph(f"{signed_by}", normal_style))
        story.append(Paragraph(f"Fecha: {datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M')}", normal_style))
    
    # Footer
    story.append(Spacer(1, 0.5*inch))
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.grey,
        alignment=TA_CENTER
    )
    story.append(Paragraph(
        "Este documento ha sido generado por el Sistema de Gestión Catastral de ASOMUNICIPIOS",
        footer_style
    ))
    
    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


@api_router.get("/petitions/{petition_id}/export-pdf")
async def export_petition_pdf(petition_id: str, current_user: dict = Depends(get_current_user)):
    """Export single petition as PDF"""
    petition = await db.petitions.find_one({"id": petition_id}, {"_id": 0})
    
    if not petition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Petición no encontrada")
    
    # Check permissions
    if current_user['role'] == UserRole.USUARIO and petition['user_id'] != current_user['id']:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tiene permiso")
    
    # Get user data
    user = await db.users.find_one({"id": petition['user_id']}, {"_id": 0, "password": 0})
    
    # Generate PDF with digital signature if coordinator or admin
    signed_by = None
    if current_user['role'] in [UserRole.COORDINADOR, UserRole.ADMINISTRADOR]:
        signed_by = f"{current_user['full_name']} - {current_user['role'].replace('_', ' ').title()}"
    
    pdf_bytes = generate_petition_pdf(petition, user, signed_by)
    
    # Save to temp file
    temp_pdf_path = UPLOAD_DIR / f"petition_{petition_id}_{uuid.uuid4()}.pdf"
    with open(temp_pdf_path, 'wb') as f:
        f.write(pdf_bytes)
    
    return FileResponse(
        path=temp_pdf_path,
        filename=f"{petition['radicado']}.pdf",
        media_type='application/pdf'
    )


@api_router.post("/petitions/export-multiple")
async def export_multiple_petitions(
    petition_ids: List[str],
    current_user: dict = Depends(get_current_user)
):
    """Export multiple petitions as PDF"""
    # Only staff can export multiple
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tiene permiso")
    
    from reportlab.platypus import PageBreak
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    story = []
    
    for idx, petition_id in enumerate(petition_ids):
        petition = await db.petitions.find_one({"id": petition_id}, {"_id": 0})
        if petition:
            # Generate petition content
            styles = getSampleStyleSheet()
            title_style = ParagraphStyle(
                'Title',
                parent=styles['Heading1'],
                fontSize=16,
                textColor=colors.HexColor('#047857'),
                spaceAfter=20,
                alignment=TA_CENTER
            )
            
            story.append(Paragraph(f"Petición {idx + 1} de {len(petition_ids)}", title_style))
            story.append(Paragraph(f"Radicado: {petition.get('radicado', 'N/A')}", styles['Heading2']))
            story.append(Spacer(1, 0.2*inch))
            
            # Add basic info
            info = [
                ['Solicitante', petition.get('nombre_completo', 'N/A')],
                ['Tipo de Trámite', petition.get('tipo_tramite', 'N/A')],
                ['Estado', petition.get('estado', 'N/A')],
                ['Municipio', petition.get('municipio', 'N/A')],
            ]
            
            table = Table(info, colWidths=[2*inch, 4*inch])
            table.setStyle(TableStyle([
                ('GRID', (0, 0), (-1, -1), 1, colors.grey),
                ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ]))
            story.append(table)
            
            # Add page break between petitions except for the last one
            if idx < len(petition_ids) - 1:
                story.append(PageBreak())
    
    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    # Save to temp file
    temp_pdf_path = UPLOAD_DIR / f"petitions_report_{uuid.uuid4()}.pdf"
    with open(temp_pdf_path, 'wb') as f:
        f.write(pdf_bytes)
    
    return FileResponse(
        path=temp_pdf_path,
        filename=f"reporte_peticiones_{datetime.now().strftime('%Y%m%d')}.pdf",
        media_type='application/pdf'
    )


# ===== PRODUCTIVITY REPORTS =====

@api_router.get("/reports/gestor-productivity")
async def get_gestor_productivity(current_user: dict = Depends(get_current_user)):
    """Get productivity report for all gestores"""
    # Only admin, coordinador, and atencion_usuario can view reports
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR, UserRole.ATENCION_USUARIO]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tiene permiso")
    
    # Get all gestores and auxiliares
    gestores = await db.users.find(
        {"role": {"$in": [UserRole.GESTOR]}},
        {"_id": 0, "password": 0}
    ).to_list(1000)
    
    productivity_data = []
    
    for gestor in gestores:
        gestor_id = gestor['id']
        
        # Total petitions assigned
        total_assigned = await db.petitions.count_documents({
            "gestores_asignados": gestor_id
        })
        
        # Completed petitions
        completed = await db.petitions.count_documents({
            "gestores_asignados": gestor_id,
            "estado": PetitionStatus.FINALIZADO
        })
        
        # In process
        in_process = await db.petitions.count_documents({
            "gestores_asignados": gestor_id,
            "estado": {"$in": [PetitionStatus.ASIGNADO, PetitionStatus.REVISION, PetitionStatus.DEVUELTO]}
        })
        
        # Rejected
        rejected = await db.petitions.count_documents({
            "gestores_asignados": gestor_id,
            "estado": PetitionStatus.RECHAZADO
        })
        
        # Calculate average time to complete (for completed petitions)
        completed_petitions = await db.petitions.find({
            "gestores_asignados": gestor_id,
            "estado": PetitionStatus.FINALIZADO
        }, {"_id": 0, "created_at": 1, "updated_at": 1}).to_list(1000)
        
        avg_days = 0
        if completed_petitions:
            total_days = 0
            for petition in completed_petitions:
                created = petition['created_at']
                updated = petition['updated_at']
                
                if isinstance(created, str):
                    created = datetime.fromisoformat(created)
                if isinstance(updated, str):
                    updated = datetime.fromisoformat(updated)
                
                delta = (updated - created).days
                total_days += delta
            
            avg_days = round(total_days / len(completed_petitions), 1) if completed_petitions else 0
        
        # Calculate completion rate
        completion_rate = round((completed / total_assigned * 100), 1) if total_assigned > 0 else 0
        
        productivity_data.append({
            "gestor_id": gestor_id,
            "gestor_name": gestor['full_name'],
            "gestor_email": gestor['email'],
            "gestor_role": gestor['role'],
            "total_assigned": total_assigned,
            "completed": completed,
            "in_process": in_process,
            "rejected": rejected,
            "avg_completion_days": avg_days,
            "completion_rate": completion_rate
        })
    
    # Sort by completion rate descending
    productivity_data.sort(key=lambda x: x['completion_rate'], reverse=True)
    
    return productivity_data


@api_router.get("/reports/gestor-productivity/export-pdf")
async def export_gestor_productivity_pdf(current_user: dict = Depends(get_current_user)):
    """Export gestor productivity report as PDF"""
    # Only admin, coordinador, and atencion_usuario can export reports
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR, UserRole.ATENCION_USUARIO]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tiene permiso")
    
    # Get productivity data
    gestores = await db.users.find(
        {"role": {"$in": [UserRole.GESTOR]}},
        {"_id": 0, "password": 0}
    ).to_list(1000)
    
    productivity_data = []
    
    for gestor in gestores:
        gestor_id = gestor['id']
        
        total_assigned = await db.petitions.count_documents({"gestores_asignados": gestor_id})
        completed = await db.petitions.count_documents({
            "gestores_asignados": gestor_id,
            "estado": PetitionStatus.FINALIZADO
        })
        in_process = await db.petitions.count_documents({
            "gestores_asignados": gestor_id,
            "estado": {"$in": [PetitionStatus.ASIGNADO, PetitionStatus.REVISION, PetitionStatus.DEVUELTO]}
        })
        rejected = await db.petitions.count_documents({
            "gestores_asignados": gestor_id,
            "estado": PetitionStatus.RECHAZADO
        })
        
        completion_rate = round((completed / total_assigned * 100), 1) if total_assigned > 0 else 0
        
        productivity_data.append({
            "name": gestor['full_name'],
            "role": "Gestor" if gestor['role'] == UserRole.GESTOR else "Gestor Auxiliar",
            "total": total_assigned,
            "completed": completed,
            "in_process": in_process,
            "rejected": rejected,
            "rate": completion_rate
        })
    
    productivity_data.sort(key=lambda x: x['rate'], reverse=True)
    
    # Generate PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    story = []
    styles = getSampleStyleSheet()
    
    # Title
    title_style = ParagraphStyle(
        'Title',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#047857'),
        spaceAfter=30,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    story.append(Paragraph("ASOCIACIÓN DE MUNICIPIOS DEL CATATUMBO", title_style))
    story.append(Paragraph("Reporte de Productividad de Gestores", styles['Heading2']))
    story.append(Paragraph(f"Fecha: {datetime.now().strftime('%d/%m/%Y')}", styles['Normal']))
    story.append(Spacer(1, 0.5*inch))
    
    # Table data
    table_data = [
        ['Gestor', 'Rol', 'Total', 'Finalizados', 'En Proceso', 'Rechazados', 'Tasa (%)']
    ]
    
    for data in productivity_data:
        table_data.append([
            data['name'],
            data['role'],
            str(data['total']),
            str(data['completed']),
            str(data['in_process']),
            str(data['rejected']),
            f"{data['rate']}%"
        ])
    
    # Create table
    col_widths = [1.8*inch, 1*inch, 0.6*inch, 0.8*inch, 0.8*inch, 0.8*inch, 0.7*inch]
    table = Table(table_data, colWidths=col_widths)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#047857')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
    ]))
    
    story.append(table)
    story.append(Spacer(1, 0.5*inch))
    
    # Summary
    story.append(Paragraph("Resumen General", styles['Heading3']))
    total_gestores = len(productivity_data)
    total_tramites = sum(d['total'] for d in productivity_data)
    total_finalizados = sum(d['completed'] for d in productivity_data)
    avg_rate = round(sum(d['rate'] for d in productivity_data) / total_gestores, 1) if total_gestores > 0 else 0
    
    summary_text = f"""
    <b>Total de Gestores:</b> {total_gestores}<br/>
    <b>Total de Trámites Asignados:</b> {total_tramites}<br/>
    <b>Total Finalizados:</b> {total_finalizados}<br/>
    <b>Tasa Promedio de Finalización:</b> {avg_rate}%
    """
    story.append(Paragraph(summary_text, styles['Normal']))
    
    # Footer
    story.append(Spacer(1, 0.5*inch))
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.grey,
        alignment=TA_CENTER
    )
    story.append(Paragraph(
        "Reporte generado por el Sistema de Gestión Catastral de ASOMUNICIPIOS",
        footer_style
    ))
    
    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    # Save to temp file
    temp_pdf_path = UPLOAD_DIR / f"productivity_report_{uuid.uuid4()}.pdf"
    with open(temp_pdf_path, 'wb') as f:
        f.write(pdf_bytes)
    
    return FileResponse(
        path=temp_pdf_path,
        filename=f"reporte_productividad_{datetime.now().strftime('%Y%m%d')}.pdf",
        media_type='application/pdf'
    )


@api_router.get("/reports/listado-tramites/export-pdf")
async def export_listado_tramites_pdf(
    municipio: Optional[str] = None,
    estado: Optional[str] = None,
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Export petition list as PDF with professional statistics"""
    from reportlab.graphics.shapes import Drawing, String, Rect, Circle, Line
    from reportlab.graphics.charts.piecharts import Pie
    from reportlab.graphics.charts.barcharts import VerticalBarChart
    from reportlab.lib.colors import HexColor
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR, UserRole.ATENCION_USUARIO, UserRole.GESTOR]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tiene permiso")
    
    # Build query
    query = {}
    if municipio:
        query["municipio"] = municipio
    if estado:
        query["estado"] = estado
    if fecha_inicio:
        query["created_at"] = {"$gte": fecha_inicio}
    if fecha_fin:
        if "created_at" in query:
            query["created_at"]["$lte"] = fecha_fin
        else:
            query["created_at"] = {"$lte": fecha_fin}
    
    # Get petitions
    petitions = await db.petitions.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)
    
    # Get user names for gestores
    users = await db.users.find({}, {"_id": 0, "id": 1, "full_name": 1}).to_list(1000)
    user_map = {u['id']: u['full_name'] for u in users}
    
    # Calculate statistics
    total = len(petitions)
    stats_estado = {}
    stats_municipio = {}
    stats_tipo = {}
    
    estado_labels = {
        'radicado': 'Radicado',
        'asignado': 'Asignado',
        'revision': 'En Revisión',
        'devuelto': 'Devuelto',
        'rechazado': 'Rechazado',
        'finalizado': 'Finalizado'
    }
    
    for pet in petitions:
        # Por estado
        est = pet.get('estado', 'radicado')
        stats_estado[est] = stats_estado.get(est, 0) + 1
        # Por municipio
        mun = pet.get('municipio', 'Sin municipio')
        stats_municipio[mun] = stats_municipio.get(mun, 0) + 1
        # Por tipo
        tipo = pet.get('tipo_tramite', 'Otro')
        stats_tipo[tipo] = stats_tipo.get(tipo, 0) + 1
    
    # Generate PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(letter), leftMargin=0.5*inch, rightMargin=0.5*inch, topMargin=0.4*inch, bottomMargin=0.4*inch)
    story = []
    styles = getSampleStyleSheet()
    
    # Define colors
    primary_color = HexColor('#047857')
    secondary_color = HexColor('#064e3b')
    light_bg = HexColor('#f0fdf4')
    gray_text = HexColor('#64748b')
    
    # Stats values
    finalizados = stats_estado.get('finalizado', 0)
    en_proceso = stats_estado.get('asignado', 0) + stats_estado.get('revision', 0) + stats_estado.get('devuelto', 0)
    radicados = stats_estado.get('radicado', 0)
    rechazados = stats_estado.get('rechazado', 0)
    
    # ===================== PROFESSIONAL HEADER =====================
    # Header bar with gradient effect using table
    header_bar_data = [['']]
    header_bar = Table(header_bar_data, colWidths=[9.5*inch], rowHeights=[0.08*inch])
    header_bar.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), primary_color),
    ]))
    story.append(header_bar)
    story.append(Spacer(1, 0.15*inch))
    
    # Logo and title row
    logo_path = Path("/app/frontend/public/logo-asomunicipios.png")
    header_content = []
    
    if logo_path.exists():
        logo_img = RLImage(str(logo_path), width=0.9*inch, height=0.4*inch)
        header_content.append([logo_img, '', ''])
    
    header_title = Paragraph(
        '<font size="18" color="#047857"><b>INFORME DE GESTIÓN</b></font><br/>'
        '<font size="10" color="#64748b">Trámites Catastrales</font>',
        ParagraphStyle('Title', alignment=TA_CENTER, leading=22)
    )
    
    date_info = Paragraph(
        f'<font size="8" color="#94a3b8">Generado el</font><br/>'
        f'<font size="10" color="#374151"><b>{datetime.now().strftime("%d de %B, %Y")}</b></font><br/>'
        f'<font size="8" color="#94a3b8">{datetime.now().strftime("%H:%M")} hrs</font>',
        ParagraphStyle('DateInfo', alignment=TA_CENTER, leading=12)
    )
    
    header_data = [['', header_title, date_info]]
    if logo_path.exists():
        header_data[0][0] = logo_img
    
    header_table = Table(header_data, colWidths=[1.5*inch, 5.5*inch, 2.5*inch])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (0, 0), 'LEFT'),
        ('ALIGN', (1, 0), (1, 0), 'CENTER'),
        ('ALIGN', (2, 0), (2, 0), 'RIGHT'),
    ]))
    story.append(header_table)
    
    # Subtitle line
    story.append(Spacer(1, 0.1*inch))
    subtitle_bar = Table([['']], colWidths=[9.5*inch], rowHeights=[0.02*inch])
    subtitle_bar.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), HexColor('#e2e8f0'))]))
    story.append(subtitle_bar)
    story.append(Spacer(1, 0.2*inch))
    
    # ===================== RESUMEN EJECUTIVO =====================
    resumen_title = Paragraph(
        '<font size="11" color="#047857"><b>RESUMEN EJECUTIVO</b></font>',
        ParagraphStyle('Section', spaceAfter=8)
    )
    story.append(resumen_title)
    
    # Filter info
    filter_parts = []
    if municipio:
        filter_parts.append(f"<b>Municipio:</b> {municipio}")
    if estado:
        filter_parts.append(f"<b>Estado:</b> {estado_labels.get(estado, estado)}")
    filter_text = " &nbsp;|&nbsp; ".join(filter_parts) if filter_parts else "<b>Filtro:</b> Todos los trámites"
    story.append(Paragraph(f'<font size="8" color="#64748b">{filter_text}</font>', styles['Normal']))
    story.append(Spacer(1, 0.15*inch))
    
    # ===================== KPI CARDS =====================
    def create_kpi_card(number, label, color, bg_color):
        return Paragraph(
            f'<font size="28" color="{color}"><b>{number}</b></font><br/>'
            f'<font size="8" color="#64748b">{label}</font>',
            ParagraphStyle('KPI', alignment=TA_CENTER, leading=32)
        )
    
    kpi_data = [[
        create_kpi_card(total, "TOTAL TRÁMITES", "#1e293b", "#f8fafc"),
        create_kpi_card(finalizados, "FINALIZADOS", "#16a34a", "#f0fdf4"),
        create_kpi_card(en_proceso, "EN PROCESO", "#d97706", "#fffbeb"),
        create_kpi_card(radicados, "RADICADOS", "#2563eb", "#eff6ff"),
        create_kpi_card(rechazados, "RECHAZADOS", "#dc2626", "#fef2f2"),
    ]]
    
    kpi_table = Table(kpi_data, colWidths=[1.9*inch]*5, rowHeights=[0.85*inch])
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), HexColor('#f8fafc')),
        ('BACKGROUND', (1, 0), (1, 0), HexColor('#f0fdf4')),
        ('BACKGROUND', (2, 0), (2, 0), HexColor('#fffbeb')),
        ('BACKGROUND', (3, 0), (3, 0), HexColor('#eff6ff')),
        ('BACKGROUND', (4, 0), (4, 0), HexColor('#fef2f2')),
        ('BOX', (0, 0), (0, 0), 1, HexColor('#e2e8f0')),
        ('BOX', (1, 0), (1, 0), 1, HexColor('#bbf7d0')),
        ('BOX', (2, 0), (2, 0), 1, HexColor('#fde68a')),
        ('BOX', (3, 0), (3, 0), 1, HexColor('#bfdbfe')),
        ('BOX', (4, 0), (4, 0), 1, HexColor('#fecaca')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 0.25*inch))
    
    # ===================== CHARTS SECTION =====================
    charts_title = Paragraph(
        '<font size="11" color="#047857"><b>DISTRIBUCIÓN DE TRÁMITES</b></font>',
        ParagraphStyle('Section', spaceAfter=10)
    )
    story.append(charts_title)
    
    # Create chart drawing
    chart_drawing = Drawing(650, 180)
    
    # Pie Chart (left side)
    if stats_estado:
        pie = Pie()
        pie.x = 60
        pie.y = 25
        pie.width = 130
        pie.height = 130
        
        pie_colors = {
            'radicado': HexColor('#3b82f6'),
            'asignado': HexColor('#8b5cf6'),
            'revision': HexColor('#f59e0b'),
            'devuelto': HexColor('#f97316'),
            'rechazado': HexColor('#ef4444'),
            'finalizado': HexColor('#22c55e'),
        }
        
        estado_order = ['finalizado', 'radicado', 'asignado', 'revision', 'devuelto', 'rechazado']
        pie_data = []
        active_estados = []
        
        for est in estado_order:
            if est in stats_estado and stats_estado[est] > 0:
                pie_data.append(stats_estado[est])
                active_estados.append(est)
        
        if pie_data:
            pie.data = pie_data
            pie.labels = None  # No labels on pie
            pie.slices.strokeWidth = 1
            pie.slices.strokeColor = colors.white
            
            for i, est in enumerate(active_estados):
                pie.slices[i].fillColor = pie_colors.get(est, HexColor('#94a3b8'))
            
            chart_drawing.add(pie)
            
            # Legend (right of pie)
            legend_x = 220
            legend_y = 150
            for i, est in enumerate(active_estados):
                # Color box
                rect = Rect(legend_x, legend_y - i*22, 14, 14, 
                           fillColor=pie_colors.get(est, HexColor('#94a3b8')), 
                           strokeWidth=0)
                chart_drawing.add(rect)
                # Label
                pct = (stats_estado[est] / total * 100) if total > 0 else 0
                label_text = f"{estado_labels.get(est, est)}: {stats_estado[est]} ({pct:.1f}%)"
                chart_drawing.add(String(legend_x + 20, legend_y - i*22 + 2, label_text, 
                                        fontSize=9, fillColor=HexColor('#374151')))
    
    # Bar chart for top municipalities (right side)
    if stats_municipio:
        # Sort and get top 5
        top_municipios = sorted(stats_municipio.items(), key=lambda x: x[1], reverse=True)[:5]
        
        if top_municipios:
            bar = VerticalBarChart()
            bar.x = 420
            bar.y = 30
            bar.width = 200
            bar.height = 120
            bar.data = [[m[1] for m in top_municipios]]
            bar.categoryAxis.categoryNames = [m[0][:10] for m in top_municipios]
            bar.categoryAxis.labels.fontSize = 7
            bar.categoryAxis.labels.angle = 0
            bar.valueAxis.valueMin = 0
            bar.valueAxis.labels.fontSize = 7
            bar.bars[0].fillColor = primary_color
            bar.bars[0].strokeWidth = 0
            bar.barWidth = 25
            
            chart_drawing.add(bar)
            chart_drawing.add(String(420, 160, "Top 5 Municipios", fontSize=9, fillColor=gray_text))
    
    story.append(chart_drawing)
    story.append(Spacer(1, 0.15*inch))
    
    # Footer for page 1
    footer_p1 = Paragraph(
        '<font size="7" color="#94a3b8">ASOMUNICIPIOS - Asociación de Municipios del Catatumbo, Provincia de Ocaña y Sur del Cesar</font>',
        ParagraphStyle('FooterP1', alignment=TA_CENTER)
    )
    story.append(footer_p1)
    
    # ===================== PAGE BREAK - TABLE =====================
    from reportlab.platypus import PageBreak
    story.append(PageBreak())
    
    # Header for page 2
    story.append(header_bar)
    story.append(Spacer(1, 0.1*inch))
    
    table_title = Paragraph(
        '<font size="12" color="#047857"><b>LISTADO DETALLADO DE TRÁMITES</b></font>',
        ParagraphStyle('TableTitle', spaceAfter=5)
    )
    story.append(table_title)
    story.append(Paragraph(
        f'<font size="8" color="#64748b">Mostrando {min(len(petitions), 200)} de {len(petitions)} registros</font>',
        styles['Normal']
    ))
    story.append(Spacer(1, 0.1*inch))
    
    # Table data
    table_data = [['#', 'RADICADO', 'FECHA', 'SOLICITANTE', 'TIPO DE TRÁMITE', 'MUNICIPIO', 'ESTADO']]
    
    for idx, pet in enumerate(petitions[:200], 1):
        created_at = pet.get('created_at', '')
        if isinstance(created_at, str):
            try:
                created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                fecha_str = created_at.strftime('%d/%m/%y')
            except:
                fecha_str = str(created_at)[:8]
        else:
            fecha_str = created_at.strftime('%d/%m/%y') if created_at else ''
        
        table_data.append([
            str(idx),
            pet.get('radicado', '')[:24],
            fecha_str,
            pet.get('nombre_completo', '')[:28],
            pet.get('tipo_tramite', '')[:22],
            pet.get('municipio', '')[:12],
            estado_labels.get(pet.get('estado', ''), '')[:11]
        ])
    
    # Create table
    col_widths = [0.35*inch, 1.7*inch, 0.6*inch, 2.2*inch, 1.7*inch, 1*inch, 0.85*inch]
    table = Table(table_data, colWidths=col_widths, repeatRows=1)
    
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), primary_color),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('FONTSIZE', (0, 1), (-1, -1), 7),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('ALIGN', (2, 0), (2, -1), 'CENTER'),
        ('ALIGN', (6, 0), (6, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#d1d5db')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, HexColor('#f0fdf4')]),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    
    story.append(table)
    
    # Footer
    story.append(Spacer(1, 0.2*inch))
    footer_style = ParagraphStyle('Footer', fontSize=7, textColor=colors.grey, alignment=TA_CENTER)
    story.append(Paragraph(
        f"Documento generado el {datetime.now().strftime('%d/%m/%Y a las %H:%M')} | ASOMUNICIPIOS - Sistema de Gestión Catastral",
        footer_style
    ))
    
    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    temp_pdf_path = UPLOAD_DIR / f"listado_tramites_{uuid.uuid4()}.pdf"
    with open(temp_pdf_path, 'wb') as f:
        f.write(pdf_bytes)
    
    return FileResponse(
        path=temp_pdf_path,
        filename=f"listado_tramites_{datetime.now().strftime('%Y%m%d')}.pdf",
        media_type='application/pdf'
    )


@api_router.get("/reports/tramites/export-excel")
async def export_tramites_excel(
    municipio: Optional[str] = None,
    estado: Optional[str] = None,
    gestor_id: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Export petition history as Excel (for coordinators/admins)"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo coordinadores y administradores pueden exportar el histórico")
    
    # Build query
    query = {}
    if municipio and municipio != 'todos':
        query["municipio"] = municipio
    if estado and estado != 'todos':
        query["estado"] = estado
    if gestor_id and gestor_id != 'todos':
        query["gestores_asignados"] = gestor_id
    
    # Date filters
    if fecha_desde or fecha_hasta:
        query["created_at"] = {}
        if fecha_desde:
            query["created_at"]["$gte"] = fecha_desde
        if fecha_hasta:
            query["created_at"]["$lte"] = fecha_hasta + "T23:59:59"
        if not query["created_at"]:
            del query["created_at"]
    
    # Get petitions
    petitions = await db.petitions.find(query, {"_id": 0}).sort("created_at", -1).to_list(10000)
    
    # Get user names for gestores
    users = await db.users.find({}, {"_id": 0, "id": 1, "full_name": 1, "email": 1}).to_list(1000)
    user_map = {u['id']: u for u in users}
    
    # Create Excel workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Histórico de Trámites"
    
    # Styles
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="047857", end_color="047857", fill_type="solid")
    header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    
    # Headers
    headers = [
        "No.", "Radicado", "Fecha Creación", "Solicitante", "Correo", "Teléfono",
        "Tipo de Trámite", "Municipio", "Estado", "Gestor Asignado", "Descripción"
    ]
    
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment
    
    # Estado labels
    estado_labels = {
        'radicado': 'Radicado',
        'asignado': 'Asignado',
        'revision': 'En Revisión',
        'devuelto': 'Devuelto',
        'rechazado': 'Rechazado',
        'finalizado': 'Finalizado'
    }
    
    # Data rows
    for idx, pet in enumerate(petitions, 1):
        # Parse date
        created_at = pet.get('created_at', '')
        if isinstance(created_at, str):
            try:
                created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                fecha_str = created_at.strftime('%d/%m/%Y %H:%M')
            except:
                fecha_str = str(created_at)[:16]
        else:
            fecha_str = created_at.strftime('%d/%m/%Y %H:%M') if created_at else ''
        
        # Get gestor names
        gestor_names = []
        for g_id in pet.get('gestores_asignados', []):
            if g_id in user_map:
                gestor_names.append(user_map[g_id]['full_name'])
        gestor_str = ', '.join(gestor_names) if gestor_names else 'Sin asignar'
        
        row_data = [
            idx,
            pet.get('radicado', pet.get('radicado_id', '')),
            fecha_str,
            pet.get('nombre_completo', pet.get('creator_name', '')),
            pet.get('correo', ''),
            pet.get('telefono', ''),
            pet.get('tipo_tramite', ''),
            pet.get('municipio', ''),
            estado_labels.get(pet.get('estado', ''), pet.get('estado', '')),
            gestor_str,
            (pet.get('descripcion', '') or '')[:200]  # Truncate long descriptions
        ]
        
        for col, value in enumerate(row_data, 1):
            ws.cell(row=idx + 1, column=col, value=value)
    
    # Adjust column widths
    column_widths = [6, 25, 18, 25, 25, 15, 30, 15, 12, 25, 40]
    for col, width in enumerate(column_widths, 1):
        ws.column_dimensions[ws.cell(row=1, column=col).column_letter].width = width
    
    # Add summary sheet
    ws_summary = wb.create_sheet("Resumen")
    ws_summary.cell(row=1, column=1, value="RESUMEN DEL HISTÓRICO DE TRÁMITES").font = Font(bold=True, size=14)
    ws_summary.cell(row=2, column=1, value=f"Fecha de generación: {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    ws_summary.cell(row=3, column=1, value=f"Total de trámites: {len(petitions)}")
    
    # Count by status
    status_counts = {}
    for pet in petitions:
        est = pet.get('estado', 'unknown')
        status_counts[est] = status_counts.get(est, 0) + 1
    
    row = 5
    ws_summary.cell(row=row, column=1, value="Por Estado:").font = Font(bold=True)
    row += 1
    for est, count in status_counts.items():
        ws_summary.cell(row=row, column=1, value=estado_labels.get(est, est))
        ws_summary.cell(row=row, column=2, value=count)
        row += 1
    
    # Count by municipio
    muni_counts = {}
    for pet in petitions:
        muni = pet.get('municipio', 'Sin municipio')
        muni_counts[muni] = muni_counts.get(muni, 0) + 1
    
    row += 1
    ws_summary.cell(row=row, column=1, value="Por Municipio:").font = Font(bold=True)
    row += 1
    for muni, count in sorted(muni_counts.items(), key=lambda x: -x[1]):
        ws_summary.cell(row=row, column=1, value=muni)
        ws_summary.cell(row=row, column=2, value=count)
        row += 1
    
    # Save to bytes
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    # Save to temp file
    temp_path = UPLOAD_DIR / f"historico_tramites_{uuid.uuid4()}.xlsx"
    with open(temp_path, 'wb') as f:
        f.write(output.getvalue())
    
    return FileResponse(
        path=temp_path,
        filename=f"Historico_Tramites_{datetime.now().strftime('%Y%m%d')}.xlsx",
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )


# ===== ADVANCED STATISTICS =====

@api_router.get("/stats/by-municipality")
async def get_stats_by_municipality(current_user: dict = Depends(get_current_user)):
    """Get petition statistics grouped by municipality"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR, UserRole.ATENCION_USUARIO]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tiene permiso")
    
    pipeline = [
        {"$group": {
            "_id": "$municipio",
            "total": {"$sum": 1},
            "radicado": {"$sum": {"$cond": [{"$eq": ["$estado", PetitionStatus.RADICADO]}, 1, 0]}},
            "asignado": {"$sum": {"$cond": [{"$eq": ["$estado", PetitionStatus.ASIGNADO]}, 1, 0]}},
            "revision": {"$sum": {"$cond": [{"$eq": ["$estado", PetitionStatus.REVISION]}, 1, 0]}},
            "finalizado": {"$sum": {"$cond": [{"$eq": ["$estado", PetitionStatus.FINALIZADO]}, 1, 0]}},
            "rechazado": {"$sum": {"$cond": [{"$eq": ["$estado", PetitionStatus.RECHAZADO]}, 1, 0]}},
            "devuelto": {"$sum": {"$cond": [{"$eq": ["$estado", PetitionStatus.DEVUELTO]}, 1, 0]}}
        }},
        {"$sort": {"total": -1}}
    ]
    
    results = await db.petitions.aggregate(pipeline).to_list(100)
    
    return [
        {
            "municipio": r["_id"] or "Sin especificar",
            "total": r["total"],
            "radicado": r["radicado"],
            "asignado": r["asignado"],
            "revision": r["revision"],
            "finalizado": r["finalizado"],
            "rechazado": r["rechazado"],
            "devuelto": r["devuelto"]
        }
        for r in results
    ]

@api_router.get("/stats/by-tramite")
async def get_stats_by_tramite(current_user: dict = Depends(get_current_user)):
    """Get petition statistics grouped by tramite type"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR, UserRole.ATENCION_USUARIO]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tiene permiso")
    
    pipeline = [
        {"$group": {
            "_id": "$tipo_tramite",
            "total": {"$sum": 1},
            "radicado": {"$sum": {"$cond": [{"$eq": ["$estado", PetitionStatus.RADICADO]}, 1, 0]}},
            "asignado": {"$sum": {"$cond": [{"$eq": ["$estado", PetitionStatus.ASIGNADO]}, 1, 0]}},
            "revision": {"$sum": {"$cond": [{"$eq": ["$estado", PetitionStatus.REVISION]}, 1, 0]}},
            "finalizado": {"$sum": {"$cond": [{"$eq": ["$estado", PetitionStatus.FINALIZADO]}, 1, 0]}},
            "rechazado": {"$sum": {"$cond": [{"$eq": ["$estado", PetitionStatus.RECHAZADO]}, 1, 0]}},
            "devuelto": {"$sum": {"$cond": [{"$eq": ["$estado", PetitionStatus.DEVUELTO]}, 1, 0]}}
        }},
        {"$sort": {"total": -1}}
    ]
    
    results = await db.petitions.aggregate(pipeline).to_list(100)
    
    return [
        {
            "tipo_tramite": r["_id"] or "Sin especificar",
            "total": r["total"],
            "radicado": r["radicado"],
            "asignado": r["asignado"],
            "revision": r["revision"],
            "finalizado": r["finalizado"],
            "rechazado": r["rechazado"],
            "devuelto": r["devuelto"]
        }
        for r in results
    ]

@api_router.get("/stats/by-gestor")
async def get_stats_by_gestor(current_user: dict = Depends(get_current_user)):
    """Get petition statistics grouped by assigned gestor"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR, UserRole.ATENCION_USUARIO]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tiene permiso")
    
    # Get all gestores
    gestores = await db.users.find(
        {"role": {"$in": [UserRole.GESTOR]}},
        {"_id": 0, "id": 1, "full_name": 1, "role": 1}
    ).to_list(100)
    
    gestor_stats = []
    
    for gestor in gestores:
        gestor_id = gestor['id']
        
        # Count by status for this gestor
        total = await db.petitions.count_documents({"gestores_asignados": gestor_id})
        radicado = await db.petitions.count_documents({"gestores_asignados": gestor_id, "estado": PetitionStatus.RADICADO})
        asignado = await db.petitions.count_documents({"gestores_asignados": gestor_id, "estado": PetitionStatus.ASIGNADO})
        revision = await db.petitions.count_documents({"gestores_asignados": gestor_id, "estado": PetitionStatus.REVISION})
        finalizado = await db.petitions.count_documents({"gestores_asignados": gestor_id, "estado": PetitionStatus.FINALIZADO})
        rechazado = await db.petitions.count_documents({"gestores_asignados": gestor_id, "estado": PetitionStatus.RECHAZADO})
        devuelto = await db.petitions.count_documents({"gestores_asignados": gestor_id, "estado": PetitionStatus.DEVUELTO})
        
        completion_rate = round((finalizado / total * 100), 1) if total > 0 else 0
        
        gestor_stats.append({
            "gestor_id": gestor_id,
            "gestor_name": gestor['full_name'],
            "gestor_role": "Gestor" if gestor['role'] == UserRole.GESTOR else "Gestor Auxiliar",
            "total": total,
            "radicado": radicado,
            "asignado": asignado,
            "revision": revision,
            "finalizado": finalizado,
            "rechazado": rechazado,
            "devuelto": devuelto,
            "completion_rate": completion_rate
        })
    
    # Sort by total descending
    gestor_stats.sort(key=lambda x: x['total'], reverse=True)
    
    return gestor_stats

@api_router.get("/stats/summary")
async def get_stats_summary(current_user: dict = Depends(get_current_user)):
    """Get overall statistics summary"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR, UserRole.ATENCION_USUARIO]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tiene permiso")
    
    # Total counts
    total_petitions = await db.petitions.count_documents({})
    total_users = await db.users.count_documents({})
    total_gestores = await db.users.count_documents({"role": UserRole.GESTOR})
    
    # Staff counts by role
    staff_counts = {
        "coordinadores": await db.users.count_documents({"role": UserRole.COORDINADOR}),
        "gestores": await db.users.count_documents({"role": UserRole.GESTOR}),
        "atencion_usuario": await db.users.count_documents({"role": UserRole.ATENCION_USUARIO}),
        "administradores": await db.users.count_documents({"role": UserRole.ADMINISTRADOR}),
        "ciudadanos": await db.users.count_documents({"role": UserRole.USUARIO})
    }
    
    # Status counts
    status_counts = {
        "radicado": await db.petitions.count_documents({"estado": PetitionStatus.RADICADO}),
        "asignado": await db.petitions.count_documents({"estado": PetitionStatus.ASIGNADO}),
        "revision": await db.petitions.count_documents({"estado": PetitionStatus.REVISION}),
        "finalizado": await db.petitions.count_documents({"estado": PetitionStatus.FINALIZADO}),
        "rechazado": await db.petitions.count_documents({"estado": PetitionStatus.RECHAZADO}),
        "devuelto": await db.petitions.count_documents({"estado": PetitionStatus.DEVUELTO})
    }
    
    # Completion rate
    completion_rate = round((status_counts["finalizado"] / total_petitions * 100), 1) if total_petitions > 0 else 0
    
    # Recent petitions (last 30 days)
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    recent_petitions = await db.petitions.count_documents({
        "created_at": {"$gte": thirty_days_ago}
    })
    
    return {
        "total_petitions": total_petitions,
        "total_users": total_users,
        "total_gestores": total_gestores,
        "staff_counts": staff_counts,
        "status_counts": status_counts,
        "completion_rate": completion_rate,
        "recent_petitions_30_days": recent_petitions
    }


# ===== PREDIOS ROUTES (Código Nacional Catastral) =====

async def generate_codigo_predial(municipio: str, zona: str, sector: str, manzana_vereda: str, 
                                   terreno: str, condicion: str, ph: str) -> str:
    """Genera el código predial nacional de 30 dígitos"""
    if municipio not in MUNICIPIOS_DIVIPOLA:
        raise HTTPException(status_code=400, detail=f"Municipio '{municipio}' no válido")
    
    divipola = MUNICIPIOS_DIVIPOLA[municipio]
    
    # Construir código de 30 dígitos
    codigo = (
        divipola["departamento"].zfill(2) +  # 2 dígitos
        divipola["municipio"].zfill(3) +     # 3 dígitos
        zona.zfill(2) +                       # 2 dígitos
        sector.zfill(2) +                     # 2 dígitos
        manzana_vereda.zfill(4) +            # 4 dígitos
        terreno.zfill(4) +                    # 4 dígitos
        condicion.zfill(4) +                  # 4 dígitos
        ph.zfill(4) +                         # 4 dígitos
        "00000"                               # 5 dígitos (unidad predial)
    )
    
    return codigo

async def generate_codigo_homologado(municipio: str) -> str:
    """Genera un código homologado único de 11 caracteres"""
    import string
    import random
    
    # Obtener último código para este municipio
    last_predio = await db.predios.find_one(
        {"municipio": municipio, "deleted": {"$ne": True}},
        sort=[("numero_predio", -1)]
    )
    
    if last_predio:
        next_num = last_predio.get("numero_predio", 0) + 1
    else:
        next_num = 1
    
    # Generar código: BPP + número + letras aleatorias
    letters = ''.join(random.choices(string.ascii_uppercase, k=4))
    codigo = f"BPP{str(next_num).zfill(4)}{letters}"
    
    return codigo, next_num

async def get_next_terreno_number(municipio: str, zona: str, sector: str, manzana_vereda: str) -> str:
    """Obtiene el siguiente número de terreno disponible (incluyendo eliminados)"""
    # Buscar el máximo terreno usado (incluyendo eliminados para no reutilizar)
    pipeline = [
        {"$match": {
            "municipio": municipio,
            "zona": zona,
            "sector": sector,
            "manzana_vereda": manzana_vereda
        }},
        {"$group": {
            "_id": None,
            "max_terreno": {"$max": "$terreno_num"}
        }}
    ]
    
    result = await db.predios.aggregate(pipeline).to_list(1)
    
    if result and result[0].get("max_terreno"):
        next_num = result[0]["max_terreno"] + 1
    else:
        next_num = 1
    
    return str(next_num).zfill(4), next_num

@api_router.get("/predios/catalogos")
async def get_predios_catalogos(current_user: dict = Depends(get_current_user)):
    """Obtiene los catálogos para el formulario de predios"""
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    return {
        "municipios": list(MUNICIPIOS_DIVIPOLA.keys()),
        "destino_economico": DESTINO_ECONOMICO,
        "tipo_documento": TIPO_DOCUMENTO_PREDIO,
        "estado_civil": ESTADO_CIVIL_PREDIO,
        "divipola": MUNICIPIOS_DIVIPOLA
    }

@api_router.get("/predios")
async def get_predios(
    municipio: Optional[str] = None,
    vigencia: Optional[int] = None,
    destino_economico: Optional[str] = None,
    zona: Optional[str] = None,  # '00' = rural, '01' = urbano, '02-99' = corregimientos
    tiene_geometria: Optional[str] = None,  # Filtro para predios con/sin geometría GDB ('true' o 'false')
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Lista todos los predios (solo staff)"""
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    query = {"deleted": {"$ne": True}}
    
    if municipio:
        query["municipio"] = municipio
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
    
    # Filtro de geometría - convertir string a booleano
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
        search_filter = {
            "$or": [
                {"codigo_predial_nacional": {"$regex": search, "$options": "i"}},
                {"codigo_homologado": {"$regex": search, "$options": "i"}},
                {"propietarios.nombre_propietario": {"$regex": search, "$options": "i"}},
                {"propietarios.numero_documento": {"$regex": search, "$options": "i"}},
                {"direccion": {"$regex": search, "$options": "i"}},
                {"r2_registros.matricula_inmobiliaria": {"$regex": search, "$options": "i"}}  # Búsqueda por matrícula inmobiliaria
            ]
        }
    
    # Combinar filtros usando $and si ambos existen
    if geometria_filter and search_filter:
        query["$and"] = [geometria_filter, search_filter]
    elif geometria_filter:
        query.update(geometria_filter)
    elif search_filter:
        query.update(search_filter)
    
    total = await db.predios.count_documents(query)
    
    # Usar agregación para extraer zona del código predial y ordenar
    # La zona está en las posiciones 6-7 (índice 5-7) del codigo_predial_nacional
    pipeline = [
        {"$match": query},
        {"$addFields": {
            "zona_orden": {"$substr": ["$codigo_predial_nacional", 5, 2]}
        }},
        {"$sort": {"zona_orden": 1, "codigo_predial_nacional": 1}},  # Ordenar por zona ascendente, luego por código
        {"$skip": skip},
        {"$limit": limit},
        {"$project": {"_id": 0, "zona_orden": 0}}  # Excluir campos auxiliares
    ]
    
    predios = await db.predios.aggregate(pipeline).to_list(limit)
    
    return {
        "total": total,
        "predios": predios
    }

@api_router.get("/predios/stats/summary")
async def get_predios_stats(current_user: dict = Depends(get_current_user)):
    """Obtiene estadísticas de predios - SOLO la vigencia más alta GLOBAL del sistema"""
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    # Función para extraer el año de una vigencia
    def get_year(vig):
        vig_str = str(vig)
        if len(vig_str) >= 7:
            return int(vig_str[-4:])
        return int(vig_str)
    
    # Obtener TODAS las vigencias disponibles en el sistema
    all_vigencias = await db.predios.distinct("vigencia", {"deleted": {"$ne": True}})
    
    if not all_vigencias:
        return {
            "total_predios": 0,
            "total_avaluo": 0,
            "total_area_terreno": 0,
            "by_municipio": [],
            "by_destino": [],
            "vigencia_actual": None
        }
    
    # Encontrar la vigencia más alta (año más reciente) GLOBALMENTE
    vigencia_mas_alta = max(all_vigencias, key=lambda x: get_year(x))
    vigencia_year = get_year(vigencia_mas_alta)
    
    # Filtrar solo predios de la vigencia más alta
    pipeline_municipios = [
        {"$match": {"vigencia": vigencia_mas_alta, "deleted": {"$ne": True}}},
        {"$group": {"_id": "$municipio", "count": {"$sum": 1}, "avaluo": {"$sum": "$avaluo"}, "area": {"$sum": "$area_terreno"}}},
        {"$sort": {"count": -1}}
    ]
    
    municipios_result = await db.predios.aggregate(pipeline_municipios).to_list(100)
    
    by_municipio = []
    total_predios = 0
    total_avaluo = 0
    total_area = 0
    
    for r in municipios_result:
        by_municipio.append({
            "municipio": r['_id'], 
            "count": r['count'],
            "vigencia": vigencia_mas_alta,
            "vigencia_display": str(vigencia_year)
        })
        total_predios += r['count']
        total_avaluo += r.get('avaluo', 0) or 0
        total_area += r.get('area', 0) or 0
    
    # Por destino económico (solo vigencia más alta)
    pipeline_destino = [
        {"$match": {"vigencia": vigencia_mas_alta, "deleted": {"$ne": True}}},
        {"$group": {"_id": "$destino_economico", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    destinos_result = await db.predios.aggregate(pipeline_destino).to_list(20)
    
    by_destino = [
        {"destino": d["_id"], "nombre": DESTINO_ECONOMICO.get(d["_id"], "Desconocido"), "count": d["count"]}
        for d in destinos_result
    ]
    
    # Conteo de registros R2 y área de GDB
    pipeline_r2_gdb = [
        {"$match": {"vigencia": vigencia_mas_alta, "deleted": {"$ne": True}}},
        {"$project": {
            "has_r2": {"$cond": [{"$gt": [{"$size": {"$ifNull": ["$r2_registros", []]}}, 0]}, 1, 0]},
            "r2_count": {"$size": {"$ifNull": ["$r2_registros", []]}},
            "area_gdb": {"$ifNull": ["$area_gdb", 0]},
            "tiene_geometria": 1
        }},
        {"$group": {
            "_id": None,
            "total_con_r2": {"$sum": "$has_r2"},
            "total_registros_r2": {"$sum": "$r2_count"},
            "total_area_gdb": {"$sum": "$area_gdb"},
            "total_con_geometria": {"$sum": {"$cond": ["$tiene_geometria", 1, 0]}}
        }}
    ]
    r2_gdb_result = await db.predios.aggregate(pipeline_r2_gdb).to_list(1)
    r2_gdb_stats = r2_gdb_result[0] if r2_gdb_result else {}
    
    return {
        "total_predios": total_predios,
        "total_avaluo": total_avaluo,
        "total_area_terreno": total_area,
        "total_registros_r2": r2_gdb_stats.get("total_registros_r2", 0),
        "total_con_r2": r2_gdb_stats.get("total_con_r2", 0),
        "total_area_gdb": r2_gdb_stats.get("total_area_gdb", 0),
        "total_con_geometria": r2_gdb_stats.get("total_con_geometria", 0),
        "by_municipio": by_municipio,
        "by_destino": by_destino[:20],
        "vigencia_actual": vigencia_year
    }

@api_router.get("/predios/eliminados")
async def get_predios_eliminados(
    municipio: Optional[str] = None,
    vigencia: Optional[int] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Lista predios eliminados - filtrable por municipio y vigencia"""
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    query = {}
    if municipio:
        query["municipio"] = municipio
    if vigencia:
        query["vigencia_eliminacion"] = vigencia
    
    total = await db.predios_eliminados.count_documents(query)
    predios = await db.predios_eliminados.find(query, {"_id": 0}).sort("eliminado_en", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "total": total,
        "predios": predios
    }

@api_router.get("/predios/eliminados/stats")
async def get_predios_eliminados_stats(current_user: dict = Depends(get_current_user)):
    """Obtiene estadísticas de predios eliminados por municipio"""
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    pipeline = [
        {"$group": {"_id": {"municipio": "$municipio", "vigencia": "$vigencia_eliminacion"}, "count": {"$sum": 1}}},
        {"$sort": {"_id.municipio": 1}}
    ]
    
    result = await db.predios_eliminados.aggregate(pipeline).to_list(100)
    
    return {
        "by_municipio": [
            {"municipio": r["_id"]["municipio"], "vigencia": r["_id"]["vigencia"], "count": r["count"]}
            for r in result
        ],
        "total": sum(r["count"] for r in result)
    }


@api_router.post("/predios/analisis-historico")
async def analisis_historico_predios(
    current_user: dict = Depends(get_current_user)
):
    """Analiza todas las vigencias desde 2022 para detectar predios eliminados y reapariciones"""
    if current_user['role'] not in [UserRole.COORDINADOR, UserRole.ADMINISTRADOR]:
        raise HTTPException(status_code=403, detail="Solo coordinadores pueden ejecutar análisis histórico")
    
    # Obtener todas las vigencias ordenadas
    vigencias = await db.predios.distinct("vigencia")
    vigencias = sorted([v for v in vigencias if v >= 2022])
    
    if len(vigencias) < 2:
        return {"message": "Se necesitan al menos 2 vigencias para comparar", "vigencias": vigencias}
    
    # Obtener todos los municipios
    municipios = await db.predios.distinct("municipio")
    
    resultados = {
        "total_eliminados": 0,
        "total_reapariciones": 0,
        "por_municipio": [],
        "reapariciones": [],
        "vigencias_analizadas": vigencias
    }
    
    for municipio in municipios:
        eliminados_mun = 0
        reapariciones_mun = []
        
        # Obtener todos los códigos por vigencia para este municipio
        codigos_por_vigencia = {}
        for vig in vigencias:
            predios = await db.predios.find(
                {"municipio": municipio, "vigencia": vig},
                {"_id": 0, "codigo_predial_nacional": 1}
            ).to_list(50000)
            codigos_por_vigencia[vig] = {p['codigo_predial_nacional'] for p in predios}
        
        # Track de códigos eliminados históricamente
        codigos_eliminados_historico = set()
        
        # Comparar vigencias consecutivas
        for i in range(len(vigencias) - 1):
            vig_anterior = vigencias[i]
            vig_siguiente = vigencias[i + 1]
            
            codigos_anterior = codigos_por_vigencia[vig_anterior]
            codigos_siguiente = codigos_por_vigencia[vig_siguiente]
            
            # Predios eliminados (estaban antes, no están ahora)
            eliminados = codigos_anterior - codigos_siguiente
            
            # Verificar si ya están registrados como eliminados
            for codigo in eliminados:
                existe = await db.predios_eliminados.find_one({"codigo_predial_nacional": codigo, "municipio": municipio})
                if not existe:
                    # Obtener datos del predio
                    predio = await db.predios.find_one(
                        {"municipio": municipio, "vigencia": vig_anterior, "codigo_predial_nacional": codigo},
                        {"_id": 0}
                    )
                    if predio:
                        await db.predios_eliminados.insert_one({
                            **predio,
                            "id": str(uuid.uuid4()),
                            "eliminado_en": datetime.now(timezone.utc).isoformat(),
                            "vigencia_eliminacion": vig_siguiente,
                            "vigencia_origen": vig_anterior,
                            "motivo": f"No incluido en vigencia {vig_siguiente}",
                            "detectado_por": "análisis histórico"
                        })
                        eliminados_mun += 1
                        codigos_eliminados_historico.add(codigo)
            
            # Detectar reapariciones (predios eliminados que vuelven a aparecer)
            for codigo in codigos_siguiente:
                if codigo in codigos_eliminados_historico:
                    reapariciones_mun.append({
                        "codigo_predial_nacional": codigo,
                        "municipio": municipio,
                        "vigencia_reaparicion": vig_siguiente,
                        "mensaje": f"ALERTA: Predio eliminado reaparece en vigencia {vig_siguiente}"
                    })
        
        resultados["por_municipio"].append({
            "municipio": municipio,
            "eliminados_detectados": eliminados_mun,
            "reapariciones": len(reapariciones_mun)
        })
        resultados["total_eliminados"] += eliminados_mun
        resultados["reapariciones"].extend(reapariciones_mun)
        resultados["total_reapariciones"] += len(reapariciones_mun)
    
    return resultados


@api_router.get("/predios/reapariciones/conteo-por-municipio")
async def get_conteo_reapariciones_por_municipio(
    current_user: dict = Depends(get_current_user)
):
    """Obtiene el conteo de reapariciones pendientes por municipio"""
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    # Obtener todos los códigos eliminados
    eliminados = await db.predios_eliminados.find(
        {}, 
        {"_id": 0, "codigo_predial_nacional": 1, "municipio": 1, "vigencia_eliminacion": 1}
    ).to_list(50000)
    
    reapariciones_por_municipio = {}
    
    for elim in eliminados:
        codigo = elim["codigo_predial_nacional"]
        mun = elim["municipio"]
        vig_elim = elim.get("vigencia_eliminacion", 0)
        
        # Verificar si ya fue aprobado/rechazado
        decision = await db.predios_reapariciones_aprobadas.find_one({
            "codigo_predial_nacional": codigo,
            "municipio": mun
        })
        
        if decision:
            continue
        
        # Buscar si existe en vigencias posteriores (reaparición)
        existe = await db.predios.find_one({
            "codigo_predial_nacional": codigo,
            "municipio": mun,
            "vigencia": {"$gt": vig_elim}
        })
        
        if existe:
            if mun not in reapariciones_por_municipio:
                reapariciones_por_municipio[mun] = 0
            reapariciones_por_municipio[mun] += 1
    
    return {
        "conteo": reapariciones_por_municipio,
        "total": sum(reapariciones_por_municipio.values())
    }


@api_router.post("/predios/reapariciones/solicitar")
async def solicitar_reaparicion(
    codigo_predial: str = Form(...),
    municipio: str = Form(...),
    justificacion: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Permite al gestor solicitar la reaparición de un predio eliminado para aprobación del coordinador"""
    if current_user['role'] not in [UserRole.GESTOR, UserRole.COORDINADOR, UserRole.ADMINISTRADOR]:
        raise HTTPException(status_code=403, detail="No tiene permiso para solicitar reapariciones")
    
    # Verificar que el predio esté en eliminados
    eliminado = await db.predios_eliminados.find_one({
        "codigo_predial_nacional": codigo_predial,
        "municipio": municipio
    })
    
    if not eliminado:
        raise HTTPException(status_code=404, detail="Predio no encontrado en la lista de eliminados")
    
    # Verificar si ya existe una solicitud pendiente
    solicitud_existente = await db.predios_reapariciones_solicitudes.find_one({
        "codigo_predial_nacional": codigo_predial,
        "municipio": municipio,
        "estado": "pendiente"
    })
    
    if solicitud_existente:
        raise HTTPException(status_code=400, detail="Ya existe una solicitud pendiente para este predio")
    
    # Crear solicitud
    solicitud = {
        "id": str(uuid.uuid4()),
        "codigo_predial_nacional": codigo_predial,
        "municipio": municipio,
        "vigencia_eliminacion": eliminado.get("vigencia_eliminacion"),
        "vigencia_origen": eliminado.get("vigencia_origen"),
        "estado": "pendiente",
        "justificacion_gestor": justificacion,
        "solicitado_por": current_user['id'],
        "solicitado_por_nombre": current_user['full_name'],
        "fecha_solicitud": datetime.now(timezone.utc).isoformat(),
        "datos_predio_eliminado": {
            "propietarios": eliminado.get("propietarios", []),
            "direccion": eliminado.get("direccion"),
            "avaluo": eliminado.get("avaluo"),
            "area_terreno": eliminado.get("area_terreno")
        }
    }
    
    await db.predios_reapariciones_solicitudes.insert_one(solicitud)
    
    # Notificar a coordinadores
    coordinadores = await db.users.find(
        {"role": {"$in": [UserRole.COORDINADOR, UserRole.ADMINISTRADOR]}},
        {"_id": 0, "id": 1, "full_name": 1}
    ).to_list(20)
    
    for coord in coordinadores:
        await crear_notificacion(
            usuario_id=coord['id'],
            titulo=f"Solicitud de Reaparición - {municipio}",
            mensaje=f"{current_user['full_name']} solicita aprobar la reaparición del predio {codigo_predial}. Justificación: {justificacion[:100]}...",
            tipo="warning",
            enviar_email=True
        )
    
    return {
        "message": "Solicitud de reaparición enviada al coordinador",
        "solicitud_id": solicitud["id"],
        "estado": "pendiente"
    }


@api_router.get("/predios/reapariciones/solicitudes-pendientes")
async def get_solicitudes_reaparicion_pendientes(
    municipio: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Obtiene las solicitudes de reaparición pendientes de aprobación por el coordinador"""
    if current_user['role'] not in [UserRole.COORDINADOR, UserRole.ADMINISTRADOR]:
        raise HTTPException(status_code=403, detail="Solo coordinadores pueden ver solicitudes pendientes")
    
    query = {"estado": "pendiente"}
    if municipio:
        query["municipio"] = municipio
    
    solicitudes = await db.predios_reapariciones_solicitudes.find(query, {"_id": 0}).sort("fecha_solicitud", -1).to_list(500)
    
    return {
        "total": len(solicitudes),
        "solicitudes": solicitudes
    }


@api_router.get("/predios/verificar-codigo-eliminado/{codigo}")
async def verificar_codigo_eliminado(
    codigo: str,
    current_user: dict = Depends(get_current_user)
):
    """Verifica si un código predial está en la lista de eliminados"""
    eliminado = await db.predios_eliminados.find_one(
        {"codigo_predial_nacional": codigo},
        {"_id": 0}
    )
    
    # Verificar si está aprobado para reaparecer
    aprobacion = await db.predios_reapariciones_aprobadas.find_one(
        {"codigo_predial_nacional": codigo, "estado": "aprobado"},
        {"_id": 0}
    )
    
    # Verificar si hay solicitud pendiente
    solicitud_pendiente = await db.predios_reapariciones_solicitudes.find_one(
        {"codigo_predial_nacional": codigo, "estado": "pendiente"},
        {"_id": 0}
    )
    
    if eliminado and not aprobacion:
        return {
            "eliminado": True,
            "tiene_solicitud_pendiente": solicitud_pendiente is not None,
            "puede_solicitar_reaparicion": solicitud_pendiente is None,
            "mensaje": "Este código predial fue eliminado y NO puede ser reutilizado sin aprobación",
            "detalles": {
                "municipio": eliminado.get("municipio"),
                "vigencia_origen": eliminado.get("vigencia_origen"),
                "vigencia_eliminacion": eliminado.get("vigencia_eliminacion"),
                "fecha_eliminacion": eliminado.get("eliminado_en"),
                "motivo": eliminado.get("motivo")
            }
        }
    
    if eliminado and aprobacion:
        return {
            "eliminado": False,
            "mensaje": "Este código predial fue eliminado pero su reaparición fue APROBADA",
            "aprobacion": {
                "aprobado_por": aprobacion.get("aprobado_por_nombre"),
                "fecha_aprobacion": aprobacion.get("fecha_aprobacion"),
                "justificacion": aprobacion.get("justificacion")
            }
        }
    
    return {
        "eliminado": False,
        "mensaje": "Este código predial NO está en la lista de eliminados"
    }


@api_router.get("/predios/estructura-codigo/{municipio}")
async def get_estructura_codigo_predial(
    municipio: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Retorna la estructura del código predial nacional para un municipio.
    Incluye los primeros 5 dígitos fijos (departamento + municipio).
    """
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    divipola = MUNICIPIOS_DIVIPOLA.get(municipio)
    if not divipola:
        raise HTTPException(status_code=404, detail=f"Municipio {municipio} no encontrado")
    
    # Estructura del código predial nacional (30 dígitos)
    estructura = {
        "departamento": {"posicion": "1-2", "valor": divipola["departamento"], "editable": False, "descripcion": "Departamento"},
        "municipio": {"posicion": "3-5", "valor": divipola["municipio"], "editable": False, "descripcion": "Municipio"},
        "zona": {"posicion": "6-7", "valor": "", "editable": True, "descripcion": "Zona (00=Rural, 01=Urbano, 02-99=Corregimientos)"},
        "sector": {"posicion": "8-9", "valor": "", "editable": True, "descripcion": "Sector"},
        "comuna": {"posicion": "10-11", "valor": "", "editable": True, "descripcion": "Comuna"},
        "barrio": {"posicion": "12-13", "valor": "", "editable": True, "descripcion": "Barrio"},
        "manzana_vereda": {"posicion": "14-17", "valor": "", "editable": True, "descripcion": "Vereda o Manzana"},
        "terreno": {"posicion": "18-21", "valor": "", "editable": True, "descripcion": "Condición del Predio (Terreno)"},
        "edificio": {"posicion": "22", "valor": "0", "editable": True, "descripcion": "No. Edificio o Torre"},
        "piso": {"posicion": "23-26", "valor": "0000", "editable": True, "descripcion": "No. del Piso"},
        "unidad": {"posicion": "27-30", "valor": "0000", "editable": True, "descripcion": "No. Unidad PH/Mejora"}
    }
    
    prefijo = divipola["departamento"] + divipola["municipio"]
    
    return {
        "municipio": municipio,
        "prefijo_fijo": prefijo,
        "estructura": estructura,
        "total_digitos": 30
    }


@api_router.get("/predios/sugerir-codigo/{municipio}")
async def sugerir_codigo_disponible(
    municipio: str,
    zona: str = "00",
    sector: str = "00",
    comuna: str = "00",
    barrio: str = "00",
    manzana_vereda: str = "0000",
    current_user: dict = Depends(get_current_user)
):
    """
    Sugiere el próximo código de terreno disponible para una manzana/vereda específica.
    También verifica si hay geometría GDB disponible.
    """
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    divipola = MUNICIPIOS_DIVIPOLA.get(municipio)
    if not divipola:
        raise HTTPException(status_code=404, detail=f"Municipio {municipio} no encontrado")
    
    # Construir prefijo base (primeros 17 dígitos)
    prefijo_base = f"{divipola['departamento']}{divipola['municipio']}{zona}{sector}{comuna}{barrio}{manzana_vereda}"
    
    # Buscar predios existentes en esta manzana
    regex_pattern = f"^{prefijo_base}"
    predios_existentes = await db.predios.find(
        {"codigo_predial_nacional": {"$regex": regex_pattern}},
        {"_id": 0, "codigo_predial_nacional": 1}
    ).to_list(10000)
    
    # Buscar predios eliminados en esta manzana
    predios_eliminados = await db.predios_eliminados.find(
        {"codigo_predial_nacional": {"$regex": regex_pattern}},
        {"_id": 0, "codigo_predial_nacional": 1, "vigencia_eliminacion": 1}
    ).to_list(10000)
    
    # Extraer los números de terreno usados (posiciones 18-21)
    terrenos_usados = set()
    for p in predios_existentes:
        codigo = p["codigo_predial_nacional"]
        if len(codigo) >= 21:
            terreno = codigo[17:21]
            terrenos_usados.add(terreno)
    
    terrenos_eliminados = []
    for p in predios_eliminados:
        codigo = p["codigo_predial_nacional"]
        if len(codigo) >= 21:
            terreno = codigo[17:21]
            terrenos_eliminados.append({
                "numero": terreno,
                "codigo_completo": codigo,
                "vigencia_eliminacion": p.get("vigencia_eliminacion")
            })
            terrenos_usados.add(terreno)  # También marcar como usados
    
    # Encontrar el siguiente terreno disponible
    siguiente_terreno = "0001"
    for i in range(1, 10000):
        candidato = str(i).zfill(4)
        if candidato not in terrenos_usados:
            siguiente_terreno = candidato
            break
    
    # Construir código sugerido completo
    codigo_sugerido = f"{prefijo_base}{siguiente_terreno}000000000"
    
    # Verificar si hay geometría GDB disponible para este prefijo
    geometria_disponible = await db.gdb_geometrias.find_one(
        {"municipio": municipio, "codigo": {"$regex": f"^{prefijo_base}"}},
        {"_id": 0, "codigo": 1}
    )
    
    return {
        "prefijo_base": prefijo_base,
        "total_activos": len(predios_existentes),
        "terrenos_usados": list(terrenos_usados)[:20],  # Limitar para la respuesta
        "terrenos_eliminados": terrenos_eliminados,
        "siguiente_terreno": siguiente_terreno,
        "codigo_sugerido": codigo_sugerido,
        "tiene_geometria_gdb": geometria_disponible is not None,
        "mensaje_geometria": "Hay información gráfica disponible para esta zona" if geometria_disponible else "⚠️ No hay información gráfica (GDB) para esta zona. Se relacionará cuando se cargue el GDB."
    }


@api_router.get("/predios/verificar-codigo-completo/{codigo}")
async def verificar_codigo_completo(
    codigo: str,
    municipio: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Verifica un código predial completo de 30 dígitos:
    - Si ya existe activo
    - Si está eliminado (y ofrece reactivar)
    - Si está disponible
    - Si tiene geometría GDB
    """
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    if len(codigo) != 30:
        raise HTTPException(status_code=400, detail="El código predial debe tener exactamente 30 dígitos")
    
    # Verificar si ya existe activo
    predio_existente = await db.predios.find_one(
        {"codigo_predial_nacional": codigo},
        {"_id": 0, "id": 1, "municipio": 1, "nombre_propietario": 1, "estado": 1}
    )
    
    if predio_existente:
        return {
            "estado": "existente",
            "disponible": False,
            "mensaje": "Este código predial ya está registrado en la base de datos",
            "predio": predio_existente
        }
    
    # Verificar si está eliminado
    eliminado = await db.predios_eliminados.find_one(
        {"codigo_predial_nacional": codigo},
        {"_id": 0}
    )
    
    # Verificar si tiene geometría GDB
    geometria = await db.gdb_geometrias.find_one(
        {"codigo": codigo[:21], "municipio": municipio},  # Los primeros 21 caracteres para terreno
        {"_id": 0, "area_m2": 1}
    )
    
    if eliminado:
        # Verificar si ya tiene aprobación de reaparición
        aprobacion = await db.predios_reapariciones_aprobadas.find_one(
            {"codigo_predial_nacional": codigo, "estado": "aprobado"}
        )
        
        return {
            "estado": "eliminado",
            "disponible": aprobacion is not None,
            "puede_reactivar": True,
            "mensaje": "⚠️ Este código pertenece a un predio ELIMINADO. ¿Desea reactivarlo?",
            "detalles_eliminacion": {
                "municipio": eliminado.get("municipio"),
                "vigencia_origen": eliminado.get("vigencia_origen"),
                "vigencia_eliminacion": eliminado.get("vigencia_eliminacion"),
                "motivo": eliminado.get("motivo", "Mutación catastral")
            },
            "aprobacion_existente": aprobacion is not None,
            "tiene_geometria": geometria is not None,
            "area_gdb": geometria.get("area_m2") if geometria else None
        }
    
    # Código disponible
    return {
        "estado": "disponible",
        "disponible": True,
        "mensaje": "✅ Este código predial está disponible para usar",
        "tiene_geometria": geometria is not None,
        "area_gdb": geometria.get("area_m2") if geometria else None,
        "mensaje_geometria": "Tiene información gráfica (GDB)" if geometria else "⚠️ Sin información gráfica. Se relacionará cuando se cargue el GDB."
    }


@api_router.post("/predios/crear-con-workflow")
async def crear_predio_con_workflow(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Crea un nuevo predio con el flujo de aprobación completo.
    Solo staff puede crear predios.
    El predio queda pendiente de aprobación del coordinador.
    """
    # Solo staff puede crear predios
    if current_user['role'] not in [UserRole.ATENCION_USUARIO, UserRole.GESTOR, UserRole.COORDINADOR, UserRole.ADMINISTRADOR]:
        raise HTTPException(status_code=403, detail="Solo usuarios staff pueden crear predios")
    
    codigo_predial = request.get("codigo_predial_nacional")
    municipio = request.get("municipio")
    es_reactivacion = request.get("es_reactivacion", False)
    justificacion = request.get("justificacion", "Creación de nuevo predio")
    
    if not codigo_predial or len(codigo_predial) != 30:
        raise HTTPException(status_code=400, detail="El código predial debe tener exactamente 30 dígitos")
    
    # Verificar que el municipio coincida con el código
    divipola = MUNICIPIOS_DIVIPOLA.get(municipio)
    if not divipola:
        raise HTTPException(status_code=400, detail=f"Municipio {municipio} no válido")
    
    prefijo_esperado = divipola["departamento"] + divipola["municipio"]
    if not codigo_predial.startswith(prefijo_esperado):
        raise HTTPException(status_code=400, detail=f"El código no corresponde al municipio {municipio}")
    
    # Verificar si ya existe
    existente = await db.predios.find_one({"codigo_predial_nacional": codigo_predial})
    if existente:
        raise HTTPException(status_code=400, detail="Este código predial ya existe")
    
    # Si es reactivación, verificar que esté eliminado
    if es_reactivacion:
        eliminado = await db.predios_eliminados.find_one({"codigo_predial_nacional": codigo_predial})
        if not eliminado:
            raise HTTPException(status_code=400, detail="Este código no está en la lista de eliminados")
    
    # Verificar geometría GDB
    geometria = await db.gdb_geometrias.find_one(
        {"codigo": codigo_predial[:21], "municipio": municipio},
        {"_id": 0, "area_m2": 1, "geometry": 1}
    )
    
    # Crear propuesta de cambio
    cambio_id = str(uuid.uuid4())
    propuesta = {
        "id": cambio_id,
        "tipo_cambio": "creacion",
        "municipio": municipio,
        "codigo_predial_nacional": codigo_predial,
        "es_reactivacion": es_reactivacion,
        "datos_propuestos": {
            "codigo_predial_nacional": codigo_predial,
            "municipio": municipio,
            "nombre_propietario": request.get("nombre_propietario", ""),
            "tipo_documento": request.get("tipo_documento", "C"),
            "numero_documento": request.get("numero_documento", ""),
            "direccion": request.get("direccion", ""),
            "destino_economico": request.get("destino_economico", "D"),
            "area_terreno": request.get("area_terreno", 0),
            "area_construida": request.get("area_construida", 0),
            "avaluo": request.get("avaluo", 0),
            "zona": codigo_predial[5:7],
            "sector": codigo_predial[7:9],
            "comuna": codigo_predial[9:11],
            "barrio": codigo_predial[11:13],
            "manzana_vereda": codigo_predial[13:17],
            "condicion_predio": codigo_predial[17:21],
            "predio_horizontal": codigo_predial[21:30],
            "tiene_geometria_gdb": geometria is not None,
            "area_gdb": geometria.get("area_m2") if geometria else None,
            "propietarios": request.get("propietarios", []),
            "zonas_fisicas": request.get("zonas_fisicas", []),
            "matricula_inmobiliaria": request.get("matricula_inmobiliaria", "")
        },
        "justificacion": justificacion,
        "estado": "pendiente_aprobacion",
        "creado_por": current_user["id"],
        "creado_por_nombre": current_user["full_name"],
        "creado_por_rol": current_user["role"],
        "gestor_asignado": None,
        "gestor_asignado_nombre": None,
        "gestor_continuar": None,
        "gestor_continuar_nombre": None,
        "historial": [{
            "accion": "Creación de propuesta",
            "usuario": current_user["full_name"],
            "usuario_id": current_user["id"],
            "rol": current_user["role"],
            "fecha": datetime.now(timezone.utc).isoformat(),
            "notas": justificacion
        }],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Si se asignó a otro gestor para continuar
    gestor_asignado_id = request.get("gestor_asignado_id")
    if gestor_asignado_id:
        gestor_info = await db.users.find_one({"id": gestor_asignado_id}, {"_id": 0, "full_name": 1})
        if gestor_info:
            propuesta["gestor_continuar"] = gestor_asignado_id
            propuesta["gestor_continuar_nombre"] = gestor_info["full_name"]
            propuesta["estado"] = "en_proceso"
            propuesta["historial"].append({
                "accion": "Asignado a otro gestor para continuar",
                "usuario": current_user["full_name"],
                "usuario_id": current_user["id"],
                "rol": current_user["role"],
                "fecha": datetime.now(timezone.utc).isoformat(),
                "notas": f"Asignado a {gestor_info['full_name']} para continuar el diligenciamiento"
            })
    
    await db.predios_cambios_propuestos.insert_one(propuesta)
    
    # Si es coordinador o admin, puede aprobar directamente
    requiere_aprobacion = current_user["role"] not in [UserRole.COORDINADOR, UserRole.ADMINISTRADOR]
    
    # Actualizar contador de trámites del gestor
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$inc": {"tramites_creados": 1}}
    )
    
    return {
        "cambio_id": cambio_id,
        "requiere_aprobacion": requiere_aprobacion,
        "mensaje": "Predio propuesto. Pendiente de aprobación del coordinador." if requiere_aprobacion else "Predio listo para aprobar.",
        "tiene_geometria": geometria is not None
    }


@api_router.post("/predios/cambios/{cambio_id}/asignar-gestor")
async def asignar_gestor_a_cambio(
    cambio_id: str,
    gestor_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Coordinador asigna un gestor para revisar el cambio propuesto.
    """
    if current_user["role"] not in [UserRole.COORDINADOR, UserRole.ADMINISTRADOR]:
        raise HTTPException(status_code=403, detail="Solo coordinadores pueden asignar gestores")
    
    cambio = await db.predios_cambios_propuestos.find_one({"id": cambio_id})
    if not cambio:
        raise HTTPException(status_code=404, detail="Cambio no encontrado")
    
    gestor = await db.users.find_one({"id": gestor_id}, {"_id": 0, "full_name": 1, "role": 1})
    if not gestor:
        raise HTTPException(status_code=404, detail="Gestor no encontrado")
    
    # Actualizar cambio
    historial_entry = {
        "accion": "Asignación de gestor para revisión",
        "usuario": current_user["full_name"],
        "usuario_id": current_user["id"],
        "rol": current_user["role"],
        "fecha": datetime.now(timezone.utc).isoformat(),
        "notas": f"Gestor asignado: {gestor['full_name']}"
    }
    
    await db.predios_cambios_propuestos.update_one(
        {"id": cambio_id},
        {
            "$set": {
                "gestor_asignado": gestor_id,
                "gestor_asignado_nombre": gestor["full_name"],
                "estado": "en_revision_gestor",
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$push": {"historial": historial_entry}
        }
    )
    
    return {"mensaje": f"Gestor {gestor['full_name']} asignado para revisar el cambio"}


@api_router.post("/predios/cambios/{cambio_id}/revision-gestor")
async def revision_gestor_cambio(
    cambio_id: str,
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Gestor asignado realiza la revisión y puede aplicar ajustes.
    El cambio queda pendiente de revisión final del coordinador.
    """
    if current_user["role"] not in [UserRole.GESTOR, UserRole.COORDINADOR, UserRole.ADMINISTRADOR]:
        raise HTTPException(status_code=403, detail="No tiene permiso para revisar cambios")
    
    cambio = await db.predios_cambios_propuestos.find_one({"id": cambio_id})
    if not cambio:
        raise HTTPException(status_code=404, detail="Cambio no encontrado")
    
    # Verificar que sea el gestor asignado (o coordinador/admin)
    if current_user["role"] in [UserRole.GESTOR]:
        if cambio.get("gestor_asignado") != current_user["id"]:
            raise HTTPException(status_code=403, detail="No está asignado a este cambio")
    
    observaciones = request.get("observaciones", "")
    datos_revisados = request.get("datos_revisados", {})
    
    historial_entry = {
        "accion": "Revisión completada por gestor",
        "usuario": current_user["full_name"],
        "usuario_id": current_user["id"],
        "rol": current_user["role"],
        "fecha": datetime.now(timezone.utc).isoformat(),
        "notas": observaciones
    }
    
    update_data = {
        "estado": "pendiente_revision_final",
        "observaciones_gestor": observaciones,
        "fecha_revision_gestor": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if datos_revisados:
        update_data["datos_revisados"] = datos_revisados
    
    await db.predios_cambios_propuestos.update_one(
        {"id": cambio_id},
        {
            "$set": update_data,
            "$push": {"historial": historial_entry}
        }
    )
    
    # Actualizar contador de trámites del gestor
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$inc": {"tramites_revisados": 1}}
    )
    
    return {"mensaje": "Revisión completada. Pendiente de aprobación final del coordinador."}


@api_router.get("/predios/cambios/estadisticas-gestores")
async def get_estadisticas_gestores(
    current_user: dict = Depends(get_current_user)
):
    """
    Obtiene estadísticas de trámites por gestor para informes.
    """
    if current_user["role"] not in [UserRole.COORDINADOR, UserRole.ADMINISTRADOR]:
        raise HTTPException(status_code=403, detail="Solo coordinadores pueden ver estadísticas")
    
    # Obtener todos los gestores con sus contadores
    gestores = await db.users.find(
        {"role": {"$in": [UserRole.GESTOR, UserRole.ATENCION_USUARIO]}},
        {"_id": 0, "id": 1, "full_name": 1, "role": 1, "tramites_creados": 1, "tramites_revisados": 1, "tramites_aprobados": 1}
    ).to_list(100)
    
    # Obtener conteo de cambios por gestor desde la colección de cambios
    pipeline = [
        {"$match": {"gestor_asignado": {"$ne": None}}},
        {"$group": {
            "_id": "$gestor_asignado",
            "total_asignados": {"$sum": 1},
            "pendientes": {"$sum": {"$cond": [{"$eq": ["$estado", "pendiente_revision_final"]}, 1, 0]}},
            "aprobados": {"$sum": {"$cond": [{"$eq": ["$estado", "aprobado"]}, 1, 0]}}
        }}
    ]
    
    stats_cambios = await db.predios_cambios_propuestos.aggregate(pipeline).to_list(100)
    stats_dict = {s["_id"]: s for s in stats_cambios}
    
    resultado = []
    for gestor in gestores:
        stats = stats_dict.get(gestor["id"], {})
        resultado.append({
            "id": gestor["id"],
            "nombre": gestor["full_name"],
            "rol": gestor["role"],
            "tramites_creados": gestor.get("tramites_creados", 0),
            "tramites_revisados": gestor.get("tramites_revisados", 0),
            "cambios_asignados": stats.get("total_asignados", 0),
            "cambios_pendientes": stats.get("pendientes", 0),
            "cambios_aprobados": stats.get("aprobados", 0)
        })
    
    return {"gestores": resultado}
async def get_reapariciones_pendientes(
    municipio: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Obtiene la lista de predios reaparecidos pendientes de aprobación"""
    if current_user['role'] not in [UserRole.COORDINADOR, UserRole.ADMINISTRADOR]:
        raise HTTPException(status_code=403, detail="Solo coordinadores pueden ver reapariciones pendientes")
    
    # Obtener todos los códigos eliminados
    query_elim = {}
    if municipio:
        query_elim["municipio"] = municipio
    
    eliminados = await db.predios_eliminados.find(
        query_elim, 
        {"_id": 0, "codigo_predial_nacional": 1, "municipio": 1, "vigencia_eliminacion": 1, "vigencia_origen": 1}
    ).to_list(50000)
    
    reapariciones_pendientes = []
    
    for elim in eliminados:
        codigo = elim["codigo_predial_nacional"]
        mun = elim["municipio"]
        vig_elim = elim.get("vigencia_eliminacion", 0)
        
        # Verificar si ya fue aprobado/rechazado
        decision = await db.predios_reapariciones_aprobadas.find_one({
            "codigo_predial_nacional": codigo,
            "municipio": mun
        })
        
        if decision:
            continue  # Ya tiene decisión, no está pendiente
        
        # Buscar si este código existe en vigencias posteriores (reaparición)
        predio_actual = await db.predios.find_one({
            "codigo_predial_nacional": codigo,
            "municipio": mun,
            "vigencia": {"$gt": vig_elim}
        }, {"_id": 0})
        
        if predio_actual:
            # Obtener datos del predio eliminado original
            predio_eliminado = await db.predios_eliminados.find_one(
                {"codigo_predial_nacional": codigo, "municipio": mun},
                {"_id": 0}
            )
            
            reapariciones_pendientes.append({
                "codigo_predial_nacional": codigo,
                "municipio": mun,
                "vigencia_eliminacion": vig_elim,
                "vigencia_origen": elim.get("vigencia_origen"),
                "vigencia_reaparicion": predio_actual.get("vigencia"),
                "propietario_anterior": predio_eliminado.get("propietarios", [{}])[0].get("nombre_propietario", "N/A") if predio_eliminado else "N/A",
                "propietario_actual": predio_actual.get("propietarios", [{}])[0].get("nombre_propietario", "N/A") if predio_actual.get("propietarios") else "N/A",
                "direccion": predio_actual.get("direccion", ""),
                "avaluo_anterior": predio_eliminado.get("avaluo", 0) if predio_eliminado else 0,
                "avaluo_actual": predio_actual.get("avaluo", 0),
                "estado": "pendiente"
            })
    
    return {
        "total_pendientes": len(reapariciones_pendientes),
        "reapariciones": reapariciones_pendientes,
        "mensaje": f"Hay {len(reapariciones_pendientes)} reapariciones pendientes de revisión"
    }


@api_router.post("/predios/reapariciones/aprobar")
async def aprobar_reaparicion(
    codigo_predial: str = Form(...),
    municipio: str = Form(...),
    justificacion: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Aprueba la reaparición de un predio eliminado después del análisis técnico"""
    has_permission = await check_permission(current_user, Permission.APPROVE_CHANGES)
    if not has_permission:
        raise HTTPException(status_code=403, detail="No tiene permiso para aprobar reapariciones")
    
    # Verificar que el predio esté en eliminados
    eliminado = await db.predios_eliminados.find_one({
        "codigo_predial_nacional": codigo_predial,
        "municipio": municipio
    })
    
    if not eliminado:
        raise HTTPException(status_code=404, detail="Predio no encontrado en la lista de eliminados")
    
    # Verificar que exista la reaparición
    predio_actual = await db.predios.find_one({
        "codigo_predial_nacional": codigo_predial,
        "municipio": municipio
    })
    
    if not predio_actual:
        raise HTTPException(status_code=404, detail="No se encontró el predio reaparecido en la vigencia actual")
    
    # Registrar aprobación
    aprobacion = {
        "id": str(uuid.uuid4()),
        "codigo_predial_nacional": codigo_predial,
        "municipio": municipio,
        "vigencia_eliminacion": eliminado.get("vigencia_eliminacion"),
        "vigencia_reaparicion": predio_actual.get("vigencia"),
        "estado": "aprobado",
        "justificacion": justificacion,
        "aprobado_por": current_user['id'],
        "aprobado_por_nombre": current_user['full_name'],
        "fecha_aprobacion": datetime.now(timezone.utc).isoformat()
    }
    
    await db.predios_reapariciones_aprobadas.insert_one(aprobacion)
    
    # Remover _id antes de retornar
    aprobacion.pop("_id", None)
    
    # Opcionalmente, remover de eliminados ya que fue aprobada la reaparición
    await db.predios_eliminados.delete_one({
        "codigo_predial_nacional": codigo_predial,
        "municipio": municipio
    })
    
    return {
        "message": f"Reaparición del predio {codigo_predial} APROBADA",
        "aprobacion": aprobacion
    }


@api_router.post("/predios/reapariciones/rechazar")
async def rechazar_reaparicion(
    codigo_predial: str = Form(...),
    municipio: str = Form(...),
    justificacion: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Rechaza la reaparición de un predio eliminado - el predio será eliminado de la vigencia actual"""
    if current_user['role'] not in [UserRole.COORDINADOR, UserRole.ADMINISTRADOR]:
        raise HTTPException(status_code=403, detail="Solo coordinadores pueden rechazar reapariciones")
    
    # Verificar que el predio esté en eliminados
    eliminado = await db.predios_eliminados.find_one({
        "codigo_predial_nacional": codigo_predial,
        "municipio": municipio
    })
    
    if not eliminado:
        raise HTTPException(status_code=404, detail="Predio no encontrado en la lista de eliminados")
    
    # Obtener el predio actual antes de eliminarlo
    predio_actual = await db.predios.find_one({
        "codigo_predial_nacional": codigo_predial,
        "municipio": municipio
    }, {"_id": 0})
    
    if not predio_actual:
        raise HTTPException(status_code=404, detail="No se encontró el predio reaparecido")
    
    # Registrar rechazo
    rechazo = {
        "id": str(uuid.uuid4()),
        "codigo_predial_nacional": codigo_predial,
        "municipio": municipio,
        "vigencia_eliminacion": eliminado.get("vigencia_eliminacion"),
        "vigencia_reaparicion": predio_actual.get("vigencia"),
        "estado": "rechazado",
        "justificacion": justificacion,
        "rechazado_por": current_user['id'],
        "rechazado_por_nombre": current_user['full_name'],
        "fecha_rechazo": datetime.now(timezone.utc).isoformat()
    }
    
    await db.predios_reapariciones_aprobadas.insert_one(rechazo)
    
    # Remover _id antes de retornar
    rechazo.pop("_id", None)
    
    # Eliminar el predio de la vigencia actual
    await db.predios.delete_one({
        "codigo_predial_nacional": codigo_predial,
        "municipio": municipio,
        "vigencia": predio_actual.get("vigencia")
    })
    
    return {
        "message": f"Reaparición del predio {codigo_predial} RECHAZADA - Predio eliminado de vigencia {predio_actual.get('vigencia')}",
        "rechazo": rechazo
    }


class SolicitudRespuestaRequest(BaseModel):
    solicitud_id: str
    aprobado: bool
    comentario: str


@api_router.post("/predios/reapariciones/solicitud-responder")
async def responder_solicitud_reaparicion(
    request: SolicitudRespuestaRequest,
    current_user: dict = Depends(get_current_user)
):
    """Responde a una solicitud de reaparición hecha por un gestor"""
    if current_user['role'] not in [UserRole.COORDINADOR, UserRole.ADMINISTRADOR]:
        raise HTTPException(status_code=403, detail="Solo coordinadores pueden responder solicitudes")
    
    # Buscar la solicitud
    solicitud = await db.predios_reapariciones_solicitudes.find_one(
        {"id": request.solicitud_id},
        {"_id": 0}
    )
    
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    
    if solicitud.get("estado") != "pendiente":
        raise HTTPException(status_code=400, detail="Esta solicitud ya fue procesada")
    
    nuevo_estado = "aprobado" if request.aprobado else "rechazado"
    
    # Actualizar la solicitud
    await db.predios_reapariciones_solicitudes.update_one(
        {"id": request.solicitud_id},
        {"$set": {
            "estado": nuevo_estado,
            "respondido_por": current_user['id'],
            "respondido_por_nombre": current_user['full_name'],
            "comentario_respuesta": request.comentario,
            "fecha_respuesta": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Si fue aprobado, registrar en reapariciones aprobadas para permitir la creación del predio
    if request.aprobado:
        aprobacion = {
            "id": str(uuid.uuid4()),
            "codigo_predial_nacional": solicitud["codigo_predial_nacional"],
            "municipio": solicitud["municipio"],
            "vigencia_eliminacion": solicitud.get("vigencia_eliminacion"),
            "estado": "aprobado",
            "justificacion": f"Solicitud de gestor aprobada: {request.comentario}",
            "justificacion_gestor": solicitud.get("justificacion_gestor"),
            "aprobado_por": current_user['id'],
            "aprobado_por_nombre": current_user['full_name'],
            "fecha_aprobacion": datetime.now(timezone.utc).isoformat(),
            "origen": "solicitud_gestor"
        }
        await db.predios_reapariciones_aprobadas.insert_one(aprobacion)
        
        # Eliminar de la lista de predios eliminados
        await db.predios_eliminados.delete_one({
            "codigo_predial_nacional": solicitud["codigo_predial_nacional"],
            "municipio": solicitud["municipio"]
        })
    
    # Notificar al gestor que hizo la solicitud
    await crear_notificacion(
        usuario_id=solicitud.get("solicitado_por"),
        titulo=f"Solicitud de Reaparición {'Aprobada' if request.aprobado else 'Rechazada'}",
        mensaje=f"Su solicitud para el predio {solicitud['codigo_predial_nacional']} ha sido {'aprobada' if request.aprobado else 'rechazada'}. {request.comentario}",
        tipo="success" if request.aprobado else "error",
        enviar_email=True
    )
    
    return {
        "message": f"Solicitud {'aprobada' if request.aprobado else 'rechazada'} correctamente",
        "estado": nuevo_estado,
        "puede_crear_predio": request.aprobado
    }


@api_router.get("/predios/reapariciones/historial")
async def get_historial_reapariciones(
    municipio: Optional[str] = None,
    estado: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Obtiene el historial de decisiones sobre reapariciones"""
    if current_user['role'] not in [UserRole.COORDINADOR, UserRole.ADMINISTRADOR, UserRole.GESTOR]:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    query = {}
    if municipio:
        query["municipio"] = municipio
    if estado:
        query["estado"] = estado
    
    historial = await db.predios_reapariciones_aprobadas.find(query, {"_id": 0}).sort("fecha_aprobacion", -1).to_list(500)
    
    return {
        "total": len(historial),
        "historial": historial
    }


@api_router.get("/predios/reapariciones")
async def get_reapariciones(
    municipio: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Obtiene la lista de predios que fueron eliminados y reaparecieron"""
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    # Obtener todos los códigos eliminados
    query_elim = {}
    if municipio:
        query_elim["municipio"] = municipio
    
    eliminados = await db.predios_eliminados.find(query_elim, {"_id": 0, "codigo_predial_nacional": 1, "municipio": 1, "vigencia_eliminacion": 1}).to_list(50000)
    
    reapariciones = []
    for elim in eliminados:
        codigo = elim["codigo_predial_nacional"]
        mun = elim["municipio"]
        vig_elim = elim.get("vigencia_eliminacion", 0)
        
        # Buscar si este código existe en vigencias posteriores
        existe = await db.predios.find_one({
            "codigo_predial_nacional": codigo,
            "municipio": mun,
            "vigencia": {"$gt": vig_elim}
        })
        
        if existe:
            reapariciones.append({
                "codigo_predial_nacional": codigo,
                "municipio": mun,
                "vigencia_eliminacion": vig_elim,
                "vigencia_reaparicion": existe.get("vigencia"),
                "alerta": "INCONSISTENCIA: Predio eliminado que reaparece"
            })
    
    return {
        "total_reapariciones": len(reapariciones),
        "reapariciones": reapariciones,
        "mensaje": f"Se encontraron {len(reapariciones)} predios eliminados que reaparecieron" if reapariciones else "No se encontraron reapariciones"
    }


@api_router.post("/predios/comparar-vigencias")
async def comparar_vigencias_predios(
    municipio: str = Form(...),
    vigencia_anterior: int = Form(...),
    vigencia_nueva: int = Form(...),
    radicado: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """Compara dos vigencias para detectar predios eliminados entre ellas"""
    if current_user['role'] not in [UserRole.COORDINADOR, UserRole.ADMINISTRADOR, UserRole.GESTOR]:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    # Obtener predios de vigencia anterior
    predios_anterior = await db.predios.find(
        {"municipio": municipio, "vigencia": vigencia_anterior},
        {"_id": 0, "codigo_predial_nacional": 1}
    ).to_list(50000)
    codigos_anterior = {p['codigo_predial_nacional'] for p in predios_anterior}
    
    # Obtener predios de vigencia nueva
    predios_nueva = await db.predios.find(
        {"municipio": municipio, "vigencia": vigencia_nueva},
        {"_id": 0, "codigo_predial_nacional": 1}
    ).to_list(50000)
    codigos_nueva = {p['codigo_predial_nacional'] for p in predios_nueva}
    
    # Predios que estaban en anterior pero no en nueva = eliminados
    codigos_eliminados = codigos_anterior - codigos_nueva
    
    if not codigos_eliminados:
        return {
            "message": "No se encontraron predios eliminados entre las vigencias",
            "municipio": municipio,
            "vigencia_anterior": vigencia_anterior,
            "vigencia_nueva": vigencia_nueva,
            "predios_eliminados": 0
        }
    
    # Obtener datos completos de predios eliminados
    predios_eliminados = await db.predios.find(
        {"municipio": municipio, "vigencia": vigencia_anterior, "codigo_predial_nacional": {"$in": list(codigos_eliminados)}},
        {"_id": 0}
    ).to_list(50000)
    
    # Guardar en colección de eliminados
    eliminados_docs = []
    for p in predios_eliminados:
        eliminados_docs.append({
            **p,
            "eliminado_en": datetime.now(timezone.utc).isoformat(),
            "vigencia_eliminacion": vigencia_nueva,
            "vigencia_origen": vigencia_anterior,
            "radicado_eliminacion": radicado,
            "motivo": f"No incluido en vigencia {vigencia_nueva}",
            "eliminado_por": current_user['id'],
            "eliminado_por_nombre": current_user['full_name']
        })
    
    if eliminados_docs:
        await db.predios_eliminados.insert_many(eliminados_docs)
    
    return {
        "message": f"Se detectaron {len(eliminados_docs)} predios eliminados",
        "municipio": municipio,
        "vigencia_anterior": vigencia_anterior,
        "vigencia_nueva": vigencia_nueva,
        "predios_eliminados": len(eliminados_docs),
        "radicado": radicado
    }


@api_router.get("/predios/eliminados/exportar-excel")
async def exportar_predios_eliminados_excel(
    municipio: Optional[str] = None,
    vigencia: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Exporta predios eliminados a Excel con radicado"""
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    import openpyxl
    from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
    from io import BytesIO
    
    query = {}
    if municipio:
        query["municipio"] = municipio
    if vigencia:
        query["vigencia_eliminacion"] = vigencia
    
    predios = await db.predios_eliminados.find(query, {"_id": 0}).sort("eliminado_en", -1).to_list(50000)
    
    if not predios:
        raise HTTPException(status_code=404, detail="No hay predios eliminados para exportar")
    
    # Crear workbook
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Predios Eliminados"
    
    # Estilos
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="059669", end_color="059669", fill_type="solid")
    header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    thin_border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    
    # Headers
    headers = [
        "Código Predial Nacional",
        "Municipio",
        "Dirección",
        "Propietario",
        "Área Terreno (m²)",
        "Área Construida (m²)",
        "Avalúo",
        "Vigencia Origen",
        "Vigencia Eliminación",
        "Radicado Eliminación",
        "Fecha Eliminación",
        "Motivo",
        "Eliminado Por"
    ]
    
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment
        cell.border = thin_border
    
    # Datos
    for row_idx, predio in enumerate(predios, 2):
        propietario = ""
        if predio.get("propietarios"):
            propietario = predio["propietarios"][0].get("nombre_propietario", "")
        
        data = [
            predio.get("codigo_predial_nacional", ""),
            predio.get("municipio", ""),
            predio.get("direccion", ""),
            propietario,
            predio.get("area_terreno", 0),
            predio.get("area_construida", 0),
            predio.get("avaluo", 0),
            predio.get("vigencia_origen", predio.get("vigencia", "")),
            predio.get("vigencia_eliminacion", ""),
            predio.get("radicado_eliminacion", ""),
            predio.get("eliminado_en", "")[:10] if predio.get("eliminado_en") else "",
            predio.get("motivo", ""),
            predio.get("eliminado_por_nombre", "")
        ]
        
        for col, value in enumerate(data, 1):
            cell = ws.cell(row=row_idx, column=col, value=value)
            cell.border = thin_border
            if col in [5, 6, 7]:  # Números
                cell.alignment = Alignment(horizontal="right")
    
    # Ajustar anchos de columna
    column_widths = [35, 15, 30, 30, 15, 15, 15, 12, 12, 20, 12, 30, 20]
    for i, width in enumerate(column_widths, 1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width = width
    
    # Guardar a BytesIO
    output = BytesIO()
    wb.save(output)
    output.seek(0)
    
    filename = f"predios_eliminados_{municipio or 'todos'}_{datetime.now().strftime('%Y%m%d')}.xlsx"
    
    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@api_router.patch("/predios/eliminados/{predio_id}/radicado")
async def actualizar_radicado_eliminado(
    predio_id: str,
    radicado: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Actualiza el radicado de un predio eliminado"""
    if current_user['role'] not in [UserRole.COORDINADOR, UserRole.ADMINISTRADOR, UserRole.GESTOR]:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    result = await db.predios_eliminados.update_one(
        {"id": predio_id},
        {"$set": {
            "radicado_eliminacion": radicado,
            "radicado_actualizado_por": current_user['full_name'],
            "radicado_actualizado_en": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Predio eliminado no encontrado")
    
    return {"message": "Radicado actualizado correctamente", "radicado": radicado}


@api_router.post("/predios/import-excel")
async def import_predios_excel(
    file: UploadFile = File(...),
    vigencia: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Importa predios desde archivo Excel R1-R2 con soporte de vigencia"""
    import openpyxl
    
    # Procesar vigencia - puede venir como "2023", "2025", "01012023", "1012023", etc.
    vigencia_int = 2025  # valor por defecto
    if vigencia:
        vigencia_str = str(vigencia).strip()
        # Si tiene más de 4 dígitos, extraer los últimos 4 (el año)
        if len(vigencia_str) > 4:
            vigencia_int = int(vigencia_str[-4:])
        else:
            vigencia_int = int(vigencia_str)
    
    logger.info(f"Importando con vigencia: {vigencia} -> {vigencia_int}")
    
    # Helper para convertir números con formato de coma decimal
    def parse_number(value, default=0):
        if value is None:
            return default
        if isinstance(value, (int, float)):
            return float(value)
        try:
            # Convertir string, reemplazando coma por punto
            s = str(value).strip().replace('$', '').replace(' ', '')
            # Si tiene punto y coma, el punto es separador de miles
            if '.' in s and ',' in s:
                s = s.replace('.', '').replace(',', '.')
            elif ',' in s:
                s = s.replace(',', '.')
            return float(s) if s else default
        except:
            return default
    
    # Solo coordinador o admin pueden importar, o usuarios con permiso explícito
    has_permission = await check_permission(current_user, Permission.IMPORT_R1R2)
    if not has_permission:
        raise HTTPException(status_code=403, detail="No tiene permiso para importar datos R1/R2")
    
    if not file.filename.endswith('.xlsx'):
        raise HTTPException(status_code=400, detail="El archivo debe ser .xlsx")
    
    try:
        # Guardar archivo temporalmente
        temp_path = UPLOAD_DIR / f"temp_import_{uuid.uuid4()}.xlsx"
        content = await file.read()
        with open(temp_path, 'wb') as f:
            f.write(content)
        
        wb = openpyxl.load_workbook(temp_path, read_only=True, data_only=True)
        
        # Buscar hoja R1 con nombres alternativos (normalizando espacios)
        r1_sheet_names = ['REGISTRO_R1', 'REGISTRO R1', 'R1', 'Registro_R1', 'Registro R1', 'registro_r1', 'Hoja1', 'Sheet1']
        ws_r1 = None
        # Primero intentar coincidencia exacta
        for name in r1_sheet_names:
            if name in wb.sheetnames:
                ws_r1 = wb[name]
                break
        # Si no encontró, intentar con nombres que contengan espacios
        if ws_r1 is None:
            for sheet_name in wb.sheetnames:
                sheet_name_clean = sheet_name.strip().upper()
                for name in r1_sheet_names:
                    if sheet_name_clean == name.upper():
                        ws_r1 = wb[sheet_name]
                        break
                if ws_r1:
                    break
        
        if ws_r1 is None:
            wb.close()
            temp_path.unlink()
            raise HTTPException(
                status_code=400, 
                detail=f"No se encontró hoja R1. Hojas disponibles: {', '.join(wb.sheetnames)}. Se esperaba: REGISTRO_R1, R1, o similar."
            )
        
        # Leer R1 (propietarios)
        r1_data = {}
        rows_read = 0
        
        # Detectar formato del archivo leyendo headers
        headers = []
        for row in ws_r1.iter_rows(min_row=1, max_row=1, values_only=True):
            headers = [str(h).upper().strip() if h else '' for h in row]
            break
        
        # Mapear columnas según headers o usar posiciones por defecto
        # Formato 1: Sin headers explícitos (col[0]=depto, col[1]=mun, col[3]=codigo_predial)
        # Formato 2: Con headers (NUMERO_DEL_PREDIO, Codigo_Predial_Nacional, etc.)
        
        col_map = {
            'departamento': 0,
            'municipio': 1,
            'numero_predio': 2,
            'codigo_predial': 3,
            'codigo_homologado': 4,
            'nombre': 8,
            'estado_civil': 9,
            'tipo_documento': 10,
            'numero_documento': 11,
            'direccion': 12,
            'comuna': 13,
            'destino_economico': 14,
            'area_terreno': 15,
            'area_construida': 16,
            'avaluo': 17,
            'vigencia_excel': 18,
            'tipo_mutacion': 19,
            'numero_resolucion': 20,
            'fecha_resolucion': 21,
        }
        
        # Detectar si tiene headers conocidos
        tiene_headers = any('CODIGO' in h or 'PREDIO' in h or 'NUMERO' in h for h in headers)
        
        if tiene_headers:
            logger.info(f"Detectado archivo con headers: {headers[:10]}")
            # Buscar posiciones de columnas por nombre de header
            for i, h in enumerate(headers):
                h_upper = h.upper().replace('_', ' ').replace('-', ' ')
                # Detectar código predial nacional con múltiples variantes
                if ('CODIGO' in h_upper and 'PREDIAL' in h_upper and 'NACIONAL' in h_upper) or \
                   ('NUMERO' in h_upper and 'PREDIAL' in h_upper and 'NACIONAL' in h_upper) or \
                   (h_upper == 'N PREDIAL') or \
                   ('PREDIAL' in h_upper and 'NACIONAL' in h_upper):
                    col_map['codigo_predial'] = i
                elif 'CODIGO' in h_upper and 'HOMOLOG' in h_upper:
                    col_map['codigo_homologado'] = i
                elif ('NUMERO' in h_upper and 'PREDIO' in h_upper and 'NACIONAL' not in h_upper) or h_upper == 'NUMERO DEL PREDIO':
                    col_map['numero_predio'] = i
                elif h_upper in ['NOMBRE', 'PROPIETARIO', 'NOMBRE PROPIETARIO']:
                    col_map['nombre'] = i
                elif 'ESTADO' in h_upper and 'CIVIL' in h_upper:
                    col_map['estado_civil'] = i
                elif 'TIPO' in h_upper and 'DOCUMENTO' in h_upper:
                    col_map['tipo_documento'] = i
                elif 'NUMERO' in h_upper and 'DOCUMENTO' in h_upper:
                    col_map['numero_documento'] = i
                elif h_upper in ['DIRECCION', 'DIRECCIÓN']:
                    col_map['direccion'] = i
                elif h_upper == 'COMUNA':
                    col_map['comuna'] = i
                elif 'DESTINO' in h_upper and 'ECONOMICO' in h_upper:
                    col_map['destino_economico'] = i
                elif 'AREA' in h_upper and 'TERRENO' in h_upper:
                    col_map['area_terreno'] = i
                elif 'AREA' in h_upper and 'CONSTRUIDA' in h_upper:
                    col_map['area_construida'] = i
                elif h_upper in ['AVALUO', 'AVALÚO']:
                    col_map['avaluo'] = i
                elif h_upper == 'VIGENCIA':
                    col_map['vigencia_excel'] = i
                elif 'TIPO' in h_upper and 'MUTACION' in h_upper:
                    col_map['tipo_mutacion'] = i
                elif 'RESOLUCION' in h_upper or 'RESOLUCIÓN' in h_upper:
                    if 'FECHA' in h_upper:
                        col_map['fecha_resolucion'] = i
                    elif 'NO' in h_upper or 'NUMERO' in h_upper:
                        col_map['numero_resolucion'] = i
            
            logger.info(f"Mapa de columnas detectado: codigo_predial={col_map['codigo_predial']}, nombre={col_map['nombre']}")
            start_row = 2  # Datos empiezan en fila 2
        else:
            logger.info("Archivo sin headers explícitos, usando formato estándar")
            start_row = 2  # Datos empiezan en fila 2
        
        # Función helper para obtener valor de columna de forma segura
        def get_col(row, key, default=''):
            idx = col_map.get(key, -1)
            if idx >= 0 and idx < len(row):
                return row[idx]
            return default
        
        for row in ws_r1.iter_rows(min_row=start_row, values_only=True):
            # Verificar fila no vacía
            first_col = get_col(row, 'numero_predio') or get_col(row, 'codigo_predial')
            if not first_col:
                continue
            
            rows_read += 1
            codigo_predial = str(get_col(row, 'codigo_predial') or '').strip()
            if not codigo_predial or len(codigo_predial) < 10:
                continue
            
            if codigo_predial not in r1_data:
                r1_data[codigo_predial] = {
                    'departamento': str(get_col(row, 'departamento') or '').strip()[:10],
                    'municipio': str(get_col(row, 'municipio') or '').strip(),
                    'numero_predio': str(get_col(row, 'numero_predio') or '').strip(),
                    'codigo_predial_nacional': codigo_predial,
                    'codigo_homologado': str(get_col(row, 'codigo_homologado') or '').strip(),
                    'direccion': str(get_col(row, 'direccion') or '').strip(),
                    'comuna': str(get_col(row, 'comuna') or '').strip(),
                    'destino_economico': str(get_col(row, 'destino_economico') or '').strip(),
                    'area_terreno': parse_number(get_col(row, 'area_terreno')),
                    'area_construida': parse_number(get_col(row, 'area_construida')),
                    'avaluo': parse_number(get_col(row, 'avaluo')),
                    'vigencia': vigencia_int,
                    'tipo_mutacion': str(get_col(row, 'tipo_mutacion') or '').strip(),
                    'numero_resolucion': str(get_col(row, 'numero_resolucion') or '').strip(),
                    'fecha_resolucion': str(get_col(row, 'fecha_resolucion') or '').strip(),
                    'propietarios': [],
                    'r2_registros': [],
                    'id': str(uuid.uuid4()),
                    'created_at': datetime.now(timezone.utc).isoformat(),
                    'status': 'aprobado'
                }
            
            # Agregar propietario
            nombre = str(get_col(row, 'nombre') or '').strip()
            if nombre:
                r1_data[codigo_predial]['propietarios'].append({
                    'nombre_propietario': nombre,
                    'estado_civil': str(get_col(row, 'estado_civil') or '').strip(),
                    'tipo_documento': str(get_col(row, 'tipo_documento') or '').strip(),
                    'numero_documento': str(get_col(row, 'numero_documento') or '').strip()
                })
        
        # Buscar hoja R2 con nombres alternativos (normalizando espacios)
        r2_sheet_names = ['REGISTRO_R2', 'REGISTRO R2', 'R2', 'Registro_R2', 'Registro R2', 'registro_r2', 'Hoja2', 'Sheet2']
        ws_r2 = None
        # Primero intentar coincidencia exacta
        for name in r2_sheet_names:
            if name in wb.sheetnames:
                ws_r2 = wb[name]
                break
        # Si no encontró, intentar con nombres que contengan espacios
        if ws_r2 is None:
            for sheet_name in wb.sheetnames:
                sheet_name_clean = sheet_name.strip().upper()
                for name in r2_sheet_names:
                    if sheet_name_clean == name.upper():
                        ws_r2 = wb[sheet_name]
                        break
                if ws_r2:
                    break
        
        if ws_r2 is None:
            wb.close()
            temp_path.unlink()
            raise HTTPException(
                status_code=400, 
                detail=f"No se encontró hoja R2. Hojas disponibles: {', '.join(wb.sheetnames)}. Se esperaba: REGISTRO_R2, R2, o similar."
            )
        
        # Leer R2 (físico)
        for row in ws_r2.iter_rows(min_row=2, values_only=True):
            if not row[0]:
                continue
            
            codigo_predial = str(row[3] or '').strip()
            if codigo_predial not in r1_data:
                continue
            
            matricula = str(row[7] or '').strip() if len(row) > 7 else ''
            
            # Buscar si ya existe este registro R2 (por matrícula o agregar nuevo)
            r2_exists = False
            for r2 in r1_data[codigo_predial]['r2_registros']:
                if r2.get('matricula_inmobiliaria') == matricula:
                    r2_exists = True
                    break
            
            if not r2_exists:
                zonas = []
                
                # Zona 1
                if len(row) > 10 and row[10]:
                    area_t = parse_number(row[10])
                    zonas.append({
                        'zona_fisica': str(row[8] or '').strip() if len(row) > 8 else '',
                        'zona_economica': str(row[9] or '').strip() if len(row) > 9 else '',
                        'area_terreno': area_t,
                        'habitaciones': int(parse_number(row[14])) if len(row) > 14 else 0,
                        'banos': int(parse_number(row[15])) if len(row) > 15 else 0,
                        'locales': int(parse_number(row[16])) if len(row) > 16 else 0,
                        'pisos': int(parse_number(row[17])) if len(row) > 17 else 0,
                        'tipificacion': str(row[18] or '').strip() if len(row) > 18 else '',
                        'uso': str(row[19] or '').strip() if len(row) > 19 else '',
                        'puntaje': int(parse_number(row[20])) if len(row) > 20 else 0,
                        'area_construida': parse_number(row[21]) if len(row) > 21 else 0
                    })
                
                # Zona 2
                if len(row) > 13 and row[13]:
                    area_t2 = parse_number(row[13])
                    if area_t2 > 0:
                        zonas.append({
                            'zona_fisica': str(row[11] or '').strip() if len(row) > 11 else '',
                            'zona_economica': str(row[12] or '').strip() if len(row) > 12 else '',
                            'area_terreno': area_t2,
                            'habitaciones': int(parse_number(row[22])) if len(row) > 22 else 0,
                            'banos': int(parse_number(row[23])) if len(row) > 23 else 0,
                            'locales': int(parse_number(row[24])) if len(row) > 24 else 0,
                            'pisos': int(parse_number(row[25])) if len(row) > 25 else 0,
                            'tipificacion': str(row[26] or '').strip() if len(row) > 26 else '',
                            'uso': str(row[27] or '').strip() if len(row) > 27 else '',
                            'puntaje': int(parse_number(row[28])) if len(row) > 28 else 0,
                            'area_construida': parse_number(row[29]) if len(row) > 29 else 0
                        })
                
                r1_data[codigo_predial]['r2_registros'].append({
                    'matricula_inmobiliaria': matricula,
                    'zonas': zonas
                })
        
        wb.close()
        temp_path.unlink()
        
        # Mapeo de códigos de municipio a nombres
        MUNICIPIO_CODIGOS = {
            '003': 'Ábrego', '54003': 'Ábrego', '3': 'Ábrego',
            '109': 'Bucarasica', '54109': 'Bucarasica',
            '128': 'Cáchira', '54128': 'Cáchira',
            '206': 'Convención', '54206': 'Convención',
            '245': 'El Carmen', '54245': 'El Carmen',
            '250': 'El Tarra', '54250': 'El Tarra',
            '344': 'Hacarí', '54344': 'Hacarí',
            '398': 'La Playa', '54398': 'La Playa',
            '670': 'San Calixto', '54670': 'San Calixto',
            '720': 'Sardinata', '54720': 'Sardinata',
            '800': 'Teorama', '54800': 'Teorama',
            '614': 'Río de Oro', '20614': 'Río de Oro',
        }
        
        # Función para extraer municipio del código predial nacional
        def get_municipio_from_codigo(codigo_predial):
            """Extrae el código de municipio del código predial nacional.
            Formato: DDMMMXXXX... donde DD=depto, MMM=municipio
            """
            if not codigo_predial or len(codigo_predial) < 5:
                return None
            # Los primeros 2 dígitos son departamento, los siguientes 3 son municipio
            codigo_mun = codigo_predial[2:5]
            # Intentar con el código completo depto+mun
            codigo_completo = codigo_predial[:5]
            if codigo_completo in MUNICIPIO_CODIGOS:
                return MUNICIPIO_CODIGOS[codigo_completo]
            if codigo_mun in MUNICIPIO_CODIGOS:
                return MUNICIPIO_CODIGOS[codigo_mun]
            # Intentar sin ceros a la izquierda
            codigo_mun_int = codigo_mun.lstrip('0')
            if codigo_mun_int in MUNICIPIO_CODIGOS:
                return MUNICIPIO_CODIGOS[codigo_mun_int]
            return None
        
        # Guardar en historial antes de actualizar
        municipio_raw = list(r1_data.values())[0]['municipio'] if r1_data else 'Desconocido'
        primer_codigo = list(r1_data.keys())[0] if r1_data else ''
        
        # Primero intentar extraer del código predial nacional (más confiable)
        municipio = get_municipio_from_codigo(primer_codigo)
        
        # Si no funciona, intentar con el valor raw
        if not municipio:
            municipio = MUNICIPIO_CODIGOS.get(municipio_raw, None)
        
        # Si el municipio_raw es un código predial largo, intentar extraerlo también
        if not municipio and len(str(municipio_raw)) >= 5:
            municipio = get_municipio_from_codigo(municipio_raw)
        
        if not municipio:
            # Usar el valor raw como último recurso
            municipio = municipio_raw
            logger.warning(f"No se pudo determinar el municipio. raw={municipio_raw}, codigo={primer_codigo[:30]}")
        
        # Actualizar el municipio en todos los predios
        for predio in r1_data.values():
            predio['municipio'] = municipio
        
        # Obtener los códigos prediales de los nuevos predios
        new_codigos = set(r1_data.keys())
        
        # Obtener los predios existentes del municipio PARA ESTA VIGENCIA ESPECÍFICA
        existing_predios = await db.predios.find(
            {"municipio": municipio, "vigencia": vigencia_int}, 
            {"_id": 0}
        ).to_list(50000)
        
        existing_codigos = {p.get('codigo_predial_nacional') for p in existing_predios}
        
        # Calcular predios eliminados (estaban antes en esta vigencia pero no vienen en la nueva importación)
        codigos_eliminados = existing_codigos - new_codigos
        predios_eliminados_count = len(codigos_eliminados)
        
        # Guardar predios eliminados en colección separada
        if codigos_eliminados:
            predios_a_eliminar = [p for p in existing_predios if p.get('codigo_predial_nacional') in codigos_eliminados]
            if predios_a_eliminar:
                await db.predios_eliminados.insert_many([
                    {
                        **p, 
                        "eliminado_en": datetime.now(timezone.utc).isoformat(),
                        "vigencia_eliminacion": vigencia_int,
                        "motivo": "No incluido en nueva importación R1-R2"
                    }
                    for p in predios_a_eliminar
                ])
        
        # Guardar historial de predios existentes de esta vigencia
        if existing_predios:
            await db.predios_historico.insert_many([
                {**p, "archivado_en": datetime.now(timezone.utc).isoformat(), "vigencia_archivo": vigencia_int}
                for p in existing_predios
            ])
        
        # Eliminar predios actuales de este municipio SOLO PARA ESTA VIGENCIA
        await db.predios.delete_many({"municipio": municipio, "vigencia": vigencia_int})
        
        # Insertar nuevos predios
        predios_list = list(r1_data.values())
        if predios_list:
            await db.predios.insert_many(predios_list)
        
        # Calcular predios nuevos (no estaban antes)
        predios_nuevos_count = len(new_codigos - existing_codigos)
        
        # Registrar importación
        logger.info(f"Import stats: rows_read={rows_read}, unique_predios={len(r1_data)}, municipio={municipio}")
        await db.importaciones.insert_one({
            "id": str(uuid.uuid4()),
            "municipio": municipio,
            "vigencia": vigencia_int,
            "total_predios": len(predios_list),
            "predios_anteriores": len(existing_predios),
            "predios_eliminados": predios_eliminados_count,
            "predios_nuevos": predios_nuevos_count,
            "archivo": file.filename,
            "importado_por": current_user['id'],
            "importado_por_nombre": current_user['full_name'],
            "fecha": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "message": f"Importación exitosa para {municipio}",
            "vigencia": vigencia_int,
            "predios_importados": len(predios_list),
            "predios_anteriores": len(existing_predios),
            "predios_eliminados": predios_eliminados_count,
            "predios_nuevos": predios_nuevos_count,
            "municipio": municipio
        }
        
    except Exception as e:
        logger.error(f"Error importing Excel: {e}")
        raise HTTPException(status_code=500, detail=f"Error al importar: {str(e)}")


@api_router.get("/predios/vigencias")
async def get_vigencias_disponibles(current_user: dict = Depends(get_current_user)):
    """Obtiene las vigencias disponibles por municipio, ordenadas de más reciente a más antigua"""
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    # Vigencias actuales - solo predios con vigencia definida
    pipeline = [
        {"$match": {"vigencia": {"$ne": None}}},
        {"$group": {"_id": {"municipio": "$municipio", "vigencia": "$vigencia"}, "count": {"$sum": 1}}},
        {"$sort": {"_id.municipio": 1}}
    ]
    result = await db.predios.aggregate(pipeline).to_list(1000)
    
    vigencias = {}
    for r in result:
        mun = r['_id'].get('municipio')
        vig = r['_id'].get('vigencia')
        if mun and vig:
            if mun not in vigencias:
                vigencias[mun] = []
            vigencias[mun].append({"vigencia": vig, "predios": r['count']})
    
    # Vigencias históricas
    historico_pipeline = [
        {"$match": {"vigencia": {"$ne": None}}},
        {"$group": {"_id": {"municipio": "$municipio", "vigencia": "$vigencia"}, "count": {"$sum": 1}}},
        {"$sort": {"_id.municipio": 1}}
    ]
    historico = await db.predios_historico.aggregate(historico_pipeline).to_list(1000)
    
    for h in historico:
        mun = h['_id'].get('municipio')
        vig = h['_id'].get('vigencia')
        if mun and vig:
            if mun not in vigencias:
                vigencias[mun] = []
            # Agregar si no existe
            if not any(v['vigencia'] == vig for v in vigencias[mun]):
                vigencias[mun].append({"vigencia": vig, "predios": h['count'], "historico": True})
    
    # Función para extraer el año de una vigencia (puede ser 2025, 01012025, 1012025)
    def get_year(vig):
        vig_str = str(vig)
        if len(vig_str) >= 7:
            return int(vig_str[-4:])
        return int(vig_str)
    
    # Ordenar vigencias: primero datos actuales (no históricos) por año descendente, luego históricos
    for mun in vigencias:
        # Separar actuales de históricos
        actuales = [v for v in vigencias[mun] if not v.get('historico')]
        historicos = [v for v in vigencias[mun] if v.get('historico')]
        
        # Ordenar cada grupo por año descendente
        actuales.sort(key=lambda x: get_year(x['vigencia']), reverse=True)
        historicos.sort(key=lambda x: get_year(x['vigencia']), reverse=True)
        
        # Combinar: actuales primero, luego históricos
        vigencias[mun] = actuales + historicos
    
    return vigencias


@api_router.get("/predios/export-excel")
async def export_predios_excel(
    municipio: Optional[str] = None,
    vigencia: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Exporta predios a Excel en formato EXACTO al archivo original R1-R2"""
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    # Query
    query = {"deleted": {"$ne": True}}
    if municipio:
        query["municipio"] = municipio
    
    # Aplicar filtro de vigencia
    vigencia_exportada = vigencia
    if vigencia:
        query["vigencia"] = vigencia
    else:
        # Si no se especifica vigencia, usar la más alta disponible
        all_vigencias = await db.predios.distinct("vigencia", {"deleted": {"$ne": True}})
        if all_vigencias:
            vigencia_exportada = max(all_vigencias)
            query["vigencia"] = vigencia_exportada
    
    predios = await db.predios.find(query, {"_id": 0}).to_list(50000)
    
    # Crear workbook
    wb = Workbook()
    
    # Estilos
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="047857", end_color="047857", fill_type="solid")
    thin_border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    
    # === HOJA REGISTRO_R1 (Propietarios) ===
    ws_r1 = wb.active
    ws_r1.title = "REGISTRO_R1"
    
    # Headers R1 - EXACTO al original
    headers_r1 = [
        "DEPARTAMENTO", "MUNICIPIO", "NUMERO_DEL_PREDIO", "CODIGO_PREDIAL_NACIONAL", 
        "CODIGO_HOMOLOGADO", "TIPO_DE_REGISTRO", "NUMERO_DE_ORDEN", "TOTAL_REGISTROS",
        "NOMBRE", "ESTADO_CIVIL", "TIPO_DOCUMENTO", "NUMERO_DOCUMENTO", "DIRECCION",
        "COMUNA", "DESTINO_ECONOMICO", "AREA_TERRENO", "AREA_CONSTRUIDA", "AVALUO",
        "VIGENCIA", "TIPO_MUTACIÓN", "NO. RESOLUCIÓN", "FECHA_RESOLUCIÓN"
    ]
    
    for col, header in enumerate(headers_r1, 1):
        cell = ws_r1.cell(row=1, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.border = thin_border
        cell.alignment = Alignment(horizontal='center')
    
    # Escribir datos R1
    row = 2
    for predio in predios:
        propietarios = predio.get('propietarios', [])
        if not propietarios:
            propietarios = [{'nombre_propietario': predio.get('nombre_propietario', ''),
                           'tipo_documento': predio.get('tipo_documento', ''),
                           'numero_documento': predio.get('numero_documento', ''),
                           'estado_civil': predio.get('estado_civil', '')}]
        
        total_props = len(propietarios)
        for idx, prop in enumerate(propietarios, 1):
            ws_r1.cell(row=row, column=1, value=predio.get('departamento', ''))
            ws_r1.cell(row=row, column=2, value=predio.get('municipio', ''))
            ws_r1.cell(row=row, column=3, value=predio.get('numero_predio', ''))
            ws_r1.cell(row=row, column=4, value=predio.get('codigo_predial_nacional', ''))
            ws_r1.cell(row=row, column=5, value=predio.get('codigo_homologado', ''))
            ws_r1.cell(row=row, column=6, value='1')
            ws_r1.cell(row=row, column=7, value=str(idx).zfill(2))
            ws_r1.cell(row=row, column=8, value=str(total_props).zfill(2))
            ws_r1.cell(row=row, column=9, value=prop.get('nombre_propietario', ''))
            ws_r1.cell(row=row, column=10, value=prop.get('estado_civil', ''))
            ws_r1.cell(row=row, column=11, value=prop.get('tipo_documento', ''))
            ws_r1.cell(row=row, column=12, value=prop.get('numero_documento', ''))
            ws_r1.cell(row=row, column=13, value=predio.get('direccion', ''))
            ws_r1.cell(row=row, column=14, value=predio.get('comuna', ''))
            ws_r1.cell(row=row, column=15, value=predio.get('destino_economico', ''))
            ws_r1.cell(row=row, column=16, value=predio.get('area_terreno', 0))
            ws_r1.cell(row=row, column=17, value=predio.get('area_construida', 0))
            ws_r1.cell(row=row, column=18, value=predio.get('avaluo', 0))
            ws_r1.cell(row=row, column=19, value=predio.get('vigencia', datetime.now().year))
            ws_r1.cell(row=row, column=20, value=predio.get('tipo_mutacion', ''))
            ws_r1.cell(row=row, column=21, value=predio.get('numero_resolucion', ''))
            ws_r1.cell(row=row, column=22, value=predio.get('fecha_resolucion', ''))
            row += 1
    
    # === HOJA REGISTRO_R2 (Físico - con zonas en columnas horizontales) ===
    ws_r2 = wb.create_sheet(title="REGISTRO_R2")
    
    # Headers R2 - EXACTO al original con zonas en columnas horizontales
    headers_r2 = [
        "DEPARTAMENTO", "MUNICIPIO", "NUMERO_DEL_PREDIO", "CODIGO_PREDIAL_NACIONAL",
        "TIPO_DE_REGISTRO", "NUMERO_DE_ORDEN", "TOTAL_REGISTROS", "MATRICULA_INMOBILIARIA",
        # Zona 1
        "ZONA_FISICA_1", "ZONA_ECONOMICA_1", "AREA_TERRENO_1",
        # Zona 2
        "ZONA_FISICA_2", "ZONA_ECONOMICA_2", "AREA_TERRENO_2",
        # Construcción 1
        "HABITACIONES_1", "BANOS_1", "LOCALES_1", "PISOS_1", "TIPIFICACION_1", "USO_1", "PUNTAJE_1", "AREA_CONSTRUIDA_1",
        # Construcción 2
        "HABITACIONES_2", "BANOS_2", "LOCALES_2", "PISOS_2", "TIPIFICACION_2", "USO_2", "PUNTAJE_2", "AREA_CONSTRUIDA_2",
        # Construcción 3
        "HABITACIONES_3", "BANOS_3", "LOCALES_3", "PISOS_3", "TIPIFICACION_3", "USO_3", "PUNTAJE_3", "AREA_CONSTRUIDA_3",
        "VIGENCIA"
    ]
    
    for col, header in enumerate(headers_r2, 1):
        cell = ws_r2.cell(row=1, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.border = thin_border
        cell.alignment = Alignment(horizontal='center')
    
    # Escribir datos R2 - Una fila por registro R2 con zonas en columnas
    row = 2
    for predio in predios:
        r2_registros = predio.get('r2_registros', [])
        total_r2 = len(r2_registros) if r2_registros else 0
        
        for r2_idx, r2 in enumerate(r2_registros, 1):
            ws_r2.cell(row=row, column=1, value=predio.get('departamento', ''))
            ws_r2.cell(row=row, column=2, value=predio.get('municipio', ''))
            ws_r2.cell(row=row, column=3, value=predio.get('numero_predio', ''))
            ws_r2.cell(row=row, column=4, value=predio.get('codigo_predial_nacional', ''))
            ws_r2.cell(row=row, column=5, value='2')
            ws_r2.cell(row=row, column=6, value=str(r2_idx).zfill(2))
            ws_r2.cell(row=row, column=7, value=str(total_r2).zfill(2))
            ws_r2.cell(row=row, column=8, value=r2.get('matricula_inmobiliaria', ''))
            
            zonas = r2.get('zonas', [])
            
            # Zona 1 (columnas 9-11) - siempre llenar con 0 si vacío
            z1 = zonas[0] if len(zonas) >= 1 else {}
            ws_r2.cell(row=row, column=9, value=z1.get('zona_fisica', 0) or 0)
            ws_r2.cell(row=row, column=10, value=z1.get('zona_economica', 0) or 0)
            ws_r2.cell(row=row, column=11, value=z1.get('area_terreno', 0) or 0)
            
            # Zona 2 (columnas 12-14)
            z2 = zonas[1] if len(zonas) >= 2 else {}
            ws_r2.cell(row=row, column=12, value=z2.get('zona_fisica', 0) or 0)
            ws_r2.cell(row=row, column=13, value=z2.get('zona_economica', 0) or 0)
            ws_r2.cell(row=row, column=14, value=z2.get('area_terreno', 0) or 0)
            
            # Construcción 1 (columnas 15-22)
            ws_r2.cell(row=row, column=15, value=z1.get('habitaciones', 0) or 0)
            ws_r2.cell(row=row, column=16, value=z1.get('banos', 0) or 0)
            ws_r2.cell(row=row, column=17, value=z1.get('locales', 0) or 0)
            ws_r2.cell(row=row, column=18, value=z1.get('pisos', 0) or 0)
            ws_r2.cell(row=row, column=19, value=z1.get('tipificacion', 0) or 0)
            ws_r2.cell(row=row, column=20, value=z1.get('uso', 0) or 0)
            ws_r2.cell(row=row, column=21, value=z1.get('puntaje', 0) or 0)
            ws_r2.cell(row=row, column=22, value=z1.get('area_construida', 0) or 0)
            
            # Construcción 2 (columnas 23-30)
            ws_r2.cell(row=row, column=23, value=z2.get('habitaciones', 0) or 0)
            ws_r2.cell(row=row, column=24, value=z2.get('banos', 0) or 0)
            ws_r2.cell(row=row, column=25, value=z2.get('locales', 0) or 0)
            ws_r2.cell(row=row, column=26, value=z2.get('pisos', 0) or 0)
            ws_r2.cell(row=row, column=27, value=z2.get('tipificacion', 0) or 0)
            ws_r2.cell(row=row, column=28, value=z2.get('uso', 0) or 0)
            ws_r2.cell(row=row, column=29, value=z2.get('puntaje', 0) or 0)
            ws_r2.cell(row=row, column=30, value=z2.get('area_construida', 0) or 0)
            
            # Construcción 3 (columnas 31-38)
            z3 = zonas[2] if len(zonas) >= 3 else {}
            ws_r2.cell(row=row, column=31, value=z3.get('habitaciones', 0) or 0)
            ws_r2.cell(row=row, column=32, value=z3.get('banos', 0) or 0)
            ws_r2.cell(row=row, column=33, value=z3.get('locales', 0) or 0)
            ws_r2.cell(row=row, column=34, value=z3.get('pisos', 0) or 0)
            ws_r2.cell(row=row, column=35, value=z3.get('tipificacion', 0) or 0)
            ws_r2.cell(row=row, column=36, value=z3.get('uso', 0) or 0)
            ws_r2.cell(row=row, column=37, value=z3.get('puntaje', 0) or 0)
            ws_r2.cell(row=row, column=38, value=z3.get('area_construida', 0) or 0)
            
            # Vigencia
            ws_r2.cell(row=row, column=39, value=predio.get('vigencia', datetime.now().year))
            row += 1
    
    # Ajustar anchos de columna
    for ws in [ws_r1, ws_r2]:
        for column in ws.columns:
            max_length = 0
            column_letter = column[0].column_letter
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            ws.column_dimensions[column_letter].width = adjusted_width
    
    # Guardar en buffer
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    
    # Generar nombre de archivo con vigencia incluida
    fecha = datetime.now().strftime('%Y%m%d')
    vigencia_str = f"_Vigencia{vigencia_exportada}" if vigencia_exportada else ""
    filename = f"Predios_{municipio or 'Todos'}{vigencia_str}_{fecha}.xlsx"
    
    return StreamingResponse(
        buffer,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )


# ===== CERTIFICADO CATASTRAL =====

def generate_certificado_catastral(predio: dict, firmante: dict, proyectado_por: str, numero_certificado: str = None, radicado: str = None) -> bytes:
    """
    Genera un certificado catastral especial en PDF siguiendo el diseño institucional de Asomunicipios.
    Formato de número: COM-F03-XXXX-GC-XXXX (editable)
    Basado en el diseño proporcionado por el usuario con barras verdes
    """
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.lib.units import cm, mm
    from reportlab.pdfgen import canvas
    from reportlab.lib.utils import simpleSplit
    
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    
    # Colores EXACTOS según el PDF de referencia con BARRAS VERDES
    verde_seccion = colors.HexColor('#4CAF50')  # Verde brillante para barras de sección
    verde_footer = colors.HexColor('#4CAF50')   # Verde para footer
    verde_gestor = colors.HexColor('#4CAF50')   # Verde para "Gestor Catastral"
    negro = colors.HexColor('#000000')
    gris_texto = colors.HexColor('#333333')
    gris_claro = colors.HexColor('#666666')
    linea_gris = colors.HexColor('#cccccc')
    blanco = colors.HexColor('#FFFFFF')
    
    # Márgenes
    left_margin = 1.5 * cm
    right_margin = width - 1.5 * cm
    content_width = right_margin - left_margin
    
    fecha_actual = datetime.now()
    meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
             'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
    
    # === ENCABEZADO - Protagonismo a ASOMUNICIPIOS ===
    y = height - 1.2 * cm
    
    # Logo de Asomunicipios (izquierda)
    logo_path = Path("/app/backend/logo_asomunicipios.jpeg")
    if not logo_path.exists():
        logo_path = Path("/app/backend/logo_asomunicipios.png")
    if logo_path.exists():
        logo_width = 4 * cm
        logo_height = 2.2 * cm
        c.drawImage(str(logo_path), left_margin, height - 3.2 * cm, width=logo_width, height=logo_height, preserveAspectRatio=True, mask='auto')
    
    # Texto del encabezado a la derecha del logo
    header_x = left_margin + 4.5 * cm
    
    # Barra vertical verde separadora
    c.setStrokeColor(verde_gestor)
    c.setLineWidth(2)
    c.line(header_x - 0.3*cm, height - 1.3*cm, header_x - 0.3*cm, height - 3*cm)
    
    # ASOMUNICIPIOS - Título principal grande
    c.setFillColor(negro)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(header_x, height - 1.6*cm, "ASOMUNICIPIOS")
    
    # Nombre completo de la institución (más pequeño, debajo)
    c.setFont("Helvetica", 7)
    c.setFillColor(gris_claro)
    c.drawString(header_x, height - 2.1*cm, "Asociación de Municipios del Catatumbo")
    c.drawString(header_x, height - 2.45*cm, "Provincia de Ocaña y Sur del Cesar")
    
    # "Gestor Catastral" en verde
    c.setFillColor(verde_gestor)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(header_x, height - 2.9*cm, "Gestor Catastral")
    
    # Fecha (izquierda, debajo del logo)
    fecha_str = f"{fecha_actual.day} de {meses[fecha_actual.month-1]} del {fecha_actual.year}"
    c.setFont("Helvetica", 9)
    c.setFillColor(negro)
    c.drawString(left_margin, height - 3.6*cm, fecha_str)
    
    # Número de certificado (derecha superior) - COM-F03-XXXX-GC-XXXX (EDITABLE)
    cert_numero = numero_certificado or "COM-F03-____-GC-____"
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(negro)
    c.drawRightString(right_margin, height - 1.5*cm, f"CERTIFICADO: {cert_numero}")
    
    y = height - 4.2 * cm
    
    # === TÍTULO PRINCIPAL ===
    c.setFillColor(negro)
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width/2, y, "CERTIFICADO CATASTRAL ESPECIAL")
    y -= 12
    
    # Base legal (texto pequeño centrado)
    c.setFillColor(gris_claro)
    c.setFont("Helvetica", 6)
    texto_legal = "ESTE CERTIFICADO TIENE VALIDEZ DE ACUERDO CON LA LEY 527 DE 1999 (AGOSTO"
    c.drawCentredString(width/2, y, texto_legal)
    y -= 8
    texto_legal2 = "18) Directiva Presidencial No. 02 del 2000, Ley 962 de 2005 (Antitrámites), Articulo 6, Parágrafo 3."
    c.drawCentredString(width/2, y, texto_legal2)
    y -= 14
    
    # RADICADO No (derecha)
    radicado_num = radicado or "ASM 0001173"
    c.setFillColor(negro)
    c.setFont("Helvetica-Bold", 9)
    c.drawRightString(right_margin, y, f"RADICADO No: {radicado_num}")
    y -= 10
    
    # === TEXTO CERTIFICADOR ===
    c.setFillColor(negro)
    c.setFont("Helvetica", 8)
    intro = "LA ASOCIACIÓN DE MUNICIPIOS DEL CATATUMBO PROVINCIA DE OCAÑA Y SUR DEL CESAR – ASOMUNICIPIOS"
    c.drawCentredString(width/2, y, intro)
    y -= 10
    intro2 = "certifica que el siguiente predio se encuentra inscrito en la base de datos catastral con la siguiente información:"
    c.drawCentredString(width/2, y, intro2)
    y -= 16
    
    # === BARRA VERDE: INFORMACIÓN CATASTRAL DEL PREDIO ===
    c.setFillColor(verde_seccion)
    c.rect(left_margin, y - 12, content_width, 15, fill=1, stroke=0)
    c.setFillColor(blanco)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(width/2, y - 8, "INFORMACION CATASTRAL DEL PREDIO")
    y -= 18
    
    # Predio No. (alineado a la derecha)
    c.setFillColor(negro)
    c.setFont("Helvetica-Bold", 9)
    c.drawRightString(right_margin - 5, y, "Predio No. 01")
    y -= 12
    
    # Función para dibujar fila de campo con líneas de tabla
    def draw_field(label, value, y_pos, label_width=140):
        # Línea superior
        c.setStrokeColor(linea_gris)
        c.setLineWidth(0.5)
        c.line(left_margin, y_pos + 3, right_margin, y_pos + 3)
        # Texto
        c.setFillColor(negro)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(left_margin + 3, y_pos - 6, label)
        c.setFont("Helvetica", 8)
        value_str = str(value) if value else ""
        c.drawString(left_margin + label_width, y_pos - 6, value_str)
        return y_pos - 14
    
    # === BARRA VERDE: INFORMACIÓN JURÍDICA ===
    c.setFillColor(verde_seccion)
    c.rect(left_margin, y - 12, content_width, 15, fill=1, stroke=0)
    c.setFillColor(blanco)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(left_margin + 5, y - 8, "INFORMACIÓN JURÍDICA")
    y -= 18
    
    propietarios = predio.get('propietarios', [])
    if propietarios:
        prop = propietarios[0]
        y = draw_field("Nombre de los propietarios", prop.get('nombre_propietario', ''), y)
        y = draw_field("Número de propietario", "01", y)
        y = draw_field("Tipo de documento", prop.get('tipo_documento', 'N'), y)
        y = draw_field("Número de documento", prop.get('numero_documento', ''), y)
    else:
        y = draw_field("Nombre de los propietarios", predio.get('nombre_propietario', 'N/A'), y)
        y = draw_field("Número de propietario", "01", y)
        y = draw_field("Tipo de documento", predio.get('tipo_documento', 'N'), y)
        y = draw_field("Número de documento", predio.get('numero_documento', ''), y)
    
    matricula = ''
    r2_registros = predio.get('r2_registros', [])
    if r2_registros:
        matricula = r2_registros[0].get('matricula_inmobiliaria', '')
    y = draw_field("Matrícula", matricula or 'N/A', y)
    
    # Línea inferior de la sección
    c.setStrokeColor(linea_gris)
    c.line(left_margin, y + 3, right_margin, y + 3)
    y -= 6
    
    # === BARRA VERDE: INFORMACIÓN FÍSICA ===
    c.setFillColor(verde_seccion)
    c.rect(left_margin, y - 12, content_width, 15, fill=1, stroke=0)
    c.setFillColor(blanco)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(left_margin + 5, y - 8, "INFORMACIÓN FÍSICA")
    y -= 18
    
    municipio = predio.get('municipio', '')
    if municipio in ['Río de Oro', 'Rio de Oro']:
        depto_cod = "20-CESAR"
        muni_cod = "614- RIO DE ORO"
    else:
        depto_cod = "54-NORTE DE SANTANDER"
        muni_mapping = {
            'Ábrego': '003- ÁBREGO', 'Bucarasica': '109- BUCARASICA',
            'Convención': '206- CONVENCIÓN', 'Cáchira': '128- CÁCHIRA',
            'El Carmen': '245- EL CARMEN', 'El Tarra': '250- EL TARRA',
            'Hacarí': '344- HACARÍ', 'La Playa': '398- LA PLAYA',
            'San Calixto': '670- SAN CALIXTO', 'Sardinata': '720- SARDINATA',
            'Teorama': '800- TEORAMA'
        }
        muni_cod = muni_mapping.get(municipio, municipio)
    
    y = draw_field("Departamento", depto_cod, y)
    y = draw_field("Municipio", muni_cod, y)
    y = draw_field("Número predial", predio.get('codigo_predial_nacional', ''), y)
    y = draw_field("Número predial anterior", predio.get('codigo_homologado', ''), y)
    y = draw_field("Dirección", predio.get('direccion', ''), y)
    
    # Área terreno con formato ha y m²
    area_terreno = predio.get('area_terreno', 0)
    if area_terreno >= 10000:
        ha = area_terreno / 10000
        area_str = f"{ha:.3f} ha {int(area_terreno):,} m²".replace(',', '.')
    else:
        area_str = f"{int(area_terreno):,} m²".replace(',', '.')
    y = draw_field("Área terrena", area_str, y)
    
    area_construida = predio.get('area_construida', 0)
    y = draw_field("Área construida", f"{int(area_construida):,} m²".replace(',', '.'), y)
    
    # Línea inferior
    c.setStrokeColor(linea_gris)
    c.line(left_margin, y + 3, right_margin, y + 3)
    y -= 6
    
    # === BARRA VERDE: INFORMACIÓN ECONÓMICA ===
    c.setFillColor(verde_seccion)
    c.rect(left_margin, y - 12, content_width, 15, fill=1, stroke=0)
    c.setFillColor(blanco)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(left_margin + 5, y - 8, "INFORMACIÓN ECONÓMICA")
    y -= 18
    
    avaluo = predio.get('avaluo', 0)
    avaluo_str = f"$ {int(avaluo):,}".replace(',', '.')
    y = draw_field("Avalúo catastral", avaluo_str, y)
    
    # Línea inferior
    c.setStrokeColor(linea_gris)
    c.line(left_margin, y + 3, right_margin, y + 3)
    y -= 6
    
    # === BARRA VERDE: PREDIOS COLINDANTES ===
    c.setFillColor(verde_seccion)
    c.rect(left_margin, y - 12, content_width, 15, fill=1, stroke=0)
    c.setFillColor(blanco)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(left_margin + 5, y - 8, "PREDIOS COLINDANTES")
    y -= 18
    
    # Obtener predios colindantes si existen
    colindantes = predio.get('colindantes', {})
    c.setFillColor(negro)
    c.setFont("Helvetica", 7)
    
    direcciones = ['Norte', 'Sur', 'Este', 'Oeste']
    for direccion in direcciones:
        col_text = colindantes.get(f'al_{direccion.lower()}', colindantes.get(direccion.lower(), f'Con ZONA {direccion.upper()}'))
        if not col_text:
            col_text = f"Con predio colindante al {direccion}"
        
        text_lines = simpleSplit(f"Al {direccion}: {col_text}", "Helvetica", 7, content_width - 10)
        for line in text_lines:
            c.drawString(left_margin + 3, y, line)
            y -= 9
        y -= 2
    
    # Línea inferior
    c.setStrokeColor(linea_gris)
    c.line(left_margin, y + 3, right_margin, y + 3)
    y -= 12
    
    # === TEXTO DE EXPEDICIÓN ===
    c.setFillColor(negro)
    c.setFont("Helvetica", 9)
    fecha_exp = f"{fecha_actual.day} de {meses[fecha_actual.month-1]} del {fecha_actual.year}"
    texto_exp = f"El presente certificado se expide a favor del interesado el {fecha_exp}."
    c.drawString(left_margin, y, texto_exp)
    y -= 30
    
    # === FIRMA CENTRAL ===
    firma_x = width/2
    c.setStrokeColor(negro)
    c.setLineWidth(0.5)
    c.line(firma_x - 90, y + 12, firma_x + 90, y + 12)
    
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(negro)
    c.drawCentredString(firma_x, y, "DALGIE ESPERANZA TORRADO RIZO")
    y -= 11
    c.setFont("Helvetica", 8)
    c.drawCentredString(firma_x, y, "SUBDIRECTORA FINANCIERA Y ADMINISTRATIVA")
    y -= 18
    
    # === ELABORÓ / REVISÓ ===
    c.setFont("Helvetica", 8)
    c.setFillColor(negro)
    
    # Elaboró con iniciales MR
    c.drawString(left_margin, y, f"Elaboró: {proyectado_por}")
    # Añadir iniciales si el nombre tiene dos partes
    nombre_parts = proyectado_por.split()
    if len(nombre_parts) >= 2:
        iniciales = f"{nombre_parts[0][0]}{nombre_parts[-1][0]}".upper()
        c.setFont("Helvetica", 6)
        c.drawString(left_margin + 50 + len(proyectado_por)*4, y + 3, iniciales)
    
    c.setFont("Helvetica", 8)
    c.drawString(left_margin + 200, y, "Revisó: Juan C. Alsina")
    y -= 16
    
    # === NOTAS ===
    c.setFillColor(negro)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(left_margin, y, "NOTA:")
    y -= 9
    
    c.setFont("Helvetica", 5.5)
    notas = [
        "• La presente información no sirve como prueba para establecer actos constitutivos de posesión.",
        "• De conformidad con el artículo 2.2.2.2.8 del Decreto 148 de 2020, Inscripción o incorporación catastral. La información catastral resultado de los procesos de formación, actualización o conservación se",
        "  inscribirá o incorporará en la base catastral con la fecha del acto administrativo que lo ordena.",
        "• Adicionalmente de conformidad con el artículo 29 de la resolución No. 1149 de 2021 emanada del Instituto Geográfico Agustín Codazzi, \"Efecto jurídico de la inscripción catastral. La inscripción en el catastro no",
        "  constituye título de dominio, ni sanea los vicios de que adolezca la titulación presentada o la posesión del interesado, y no puede alegarse como excepción contra el que pretenda tener mejor derecho a la propiedad",
        "  o posesión del predio.\"",
        "• La base catastral de Asomunicipios sólo incluye información de los municipios habilitados dentro del esquema asociativo (Ábrego, Bucarasica, Convención, Cáchira, El Carmen, El Tarra, Hacarí, La Playa de Belén, San",
        "  Calixto, Sardinata y Teorama en Norte de Santander, y Río de Oro, en el Cesar)",
        "• Ante cualquier inquietud, puede escribir al correo electrónico: comunicaciones@asomunicipios.gov.co",
    ]
    
    for nota in notas:
        c.drawString(left_margin, y, nota)
        y -= 7
    
    # === PIE DE PÁGINA - BARRA VERDE ===
    footer_y = 1.2 * cm
    c.setFillColor(verde_footer)
    c.rect(left_margin, footer_y - 5, content_width, 22, fill=1, stroke=0)
    
    c.setFillColor(blanco)
    c.setFont("Helvetica-Bold", 7)
    
    # Iconos de redes sociales (simulados con texto)
    social_y = footer_y + 5
    c.setFont("Helvetica", 8)
    c.drawString(left_margin + 5, social_y, "f")
    c.drawString(left_margin + 15, social_y, "IG")
    c.drawString(left_margin + 30, social_y, "X")
    c.setFont("Helvetica-Bold", 8)
    c.drawString(left_margin + 45, social_y, "Asomunicipios")
    
    # Email y dirección (centro)
    c.setFont("Helvetica", 7)
    c.drawCentredString(width/2, social_y, "comunicaciones@asomunicipios.gov.co")
    c.setFont("Helvetica", 6)
    c.drawCentredString(width/2, social_y - 9, "Calle 12 # 11-76 Ocaña, Norte de Santander")
    
    # Teléfono (derecha)
    c.setFont("Helvetica", 7)
    c.drawRightString(right_margin - 5, social_y, "+57 3102327647")
    
    c.save()
    return buffer.getvalue()


@api_router.get("/predios/{predio_id}/certificado")
async def generar_certificado_catastral_endpoint(predio_id: str, current_user: dict = Depends(get_current_user)):
    """Genera un certificado catastral PDF para un predio específico con consecutivo en blanco para llenado manual"""
    # Solo coordinador, administrador y atencion_usuario pueden generar certificados
    if current_user['role'] not in [UserRole.COORDINADOR, UserRole.ADMINISTRADOR, UserRole.ATENCION_USUARIO]:
        raise HTTPException(status_code=403, detail="No tiene permiso para generar certificados")
    
    # Obtener predio
    predio = await db.predios.find_one({"id": predio_id}, {"_id": 0})
    if not predio:
        raise HTTPException(status_code=404, detail="Predio no encontrado")
    
    # Registrar certificado en la base de datos (sin número, se llena manualmente)
    certificado_record = {
        "id": str(uuid.uuid4()),
        "numero": "(Por asignar)",
        "predio_id": predio_id,
        "codigo_predial": predio.get('codigo_predial_nacional', ''),
        "generado_por": current_user['id'],
        "generado_por_nombre": current_user['full_name'],
        "generado_por_rol": current_user['role'],
        "fecha_generacion": datetime.now(timezone.utc).isoformat()
    }
    await db.certificados.insert_one(certificado_record)
    
    # Firmante siempre es Dalgie Esperanza Torrado Rizo
    firmante = {
        "full_name": "DALGIE ESPERANZA TORRADO RIZO",
        "cargo": "Subdirectora Financiera y Administrativa"
    }
    
    # Quien proyecta es el usuario actual
    proyectado_por = current_user['full_name']
    
    # Generar PDF con campo editable para número
    pdf_bytes = generate_certificado_catastral(predio, firmante, proyectado_por)
    
    # Guardar temporalmente
    temp_path = UPLOAD_DIR / f"certificado_{predio_id}_{uuid.uuid4()}.pdf"
    with open(temp_path, 'wb') as f:
        f.write(pdf_bytes)
    
    # Nombre del archivo
    codigo = predio.get('codigo_predial_nacional', predio_id)
    filename = f"Certificado_Catastral_{codigo}.pdf"
    
    return FileResponse(
        path=temp_path,
        filename=filename,
        media_type='application/pdf'
    )


@api_router.get("/certificados/historial")
async def get_certificados_historial(
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Obtiene el historial de certificados generados"""
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    certificados = await db.certificados.find({}, {"_id": 0}).sort("fecha_generacion", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.certificados.count_documents({})
    
    return {
        "certificados": certificados,
        "total": total
    }


@api_router.get("/predios/terreno-info/{municipio}")
async def get_terreno_info(
    municipio: str,
    zona: str = "00",
    sector: str = "01", 
    manzana_vereda: str = "0000",
    current_user: dict = Depends(get_current_user)
):
    """Obtiene información sobre el siguiente terreno disponible en una manzana"""
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    # Buscar todos los terrenos en esta manzana (incluyendo eliminados)
    query = {
        "municipio": municipio,
        "zona": zona,
        "sector": sector,
        "manzana_vereda": manzana_vereda
    }
    
    predios = await db.predios.find(query, {"_id": 0, "terreno": 1, "terreno_num": 1, "deleted": 1, "codigo_homologado": 1}).to_list(10000)
    
    # Clasificar terrenos
    terrenos_activos = []
    terrenos_eliminados = []
    
    for p in predios:
        terreno_num = p.get('terreno_num', 0)
        if p.get('deleted'):
            terrenos_eliminados.append({
                "numero": p.get('terreno'),
                "codigo": p.get('codigo_homologado')
            })
        else:
            terrenos_activos.append(terreno_num)
    
    # Encontrar el máximo terreno usado
    max_terreno = max(terrenos_activos + [t.get('terreno_num', 0) for t in predios], default=0)
    siguiente_terreno = max_terreno + 1
    
    return {
        "municipio": municipio,
        "zona": zona,
        "sector": sector,
        "manzana_vereda": manzana_vereda,
        "total_activos": len(terrenos_activos),
        "ultimo_terreno": str(max_terreno).zfill(4) if max_terreno > 0 else "N/A",
        "siguiente_terreno": str(siguiente_terreno).zfill(4),
        "terrenos_eliminados": terrenos_eliminados,
        "terrenos_no_reutilizables": len(terrenos_eliminados)
    }

@api_router.get("/predios/{predio_id}")
async def get_predio(predio_id: str, current_user: dict = Depends(get_current_user)):
    """Obtiene un predio por ID"""
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    predio = await db.predios.find_one({"id": predio_id, "deleted": {"$ne": True}}, {"_id": 0})
    if not predio:
        raise HTTPException(status_code=404, detail="Predio no encontrado")
    
    return predio


@api_router.get("/predios/{predio_id}/construcciones")
async def get_construcciones_predio(predio_id: str, current_user: dict = Depends(get_current_user)):
    """Obtiene las construcciones asociadas a un predio"""
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    # Obtener el predio para conocer su código
    predio = await db.predios.find_one({"id": predio_id, "deleted": {"$ne": True}}, {"_id": 0, "codigo_predial_nacional": 1, "codigo_gdb": 1})
    if not predio:
        raise HTTPException(status_code=404, detail="Predio no encontrado")
    
    codigo = predio.get("codigo_gdb") or predio.get("codigo_predial_nacional")
    if not codigo:
        return {"construcciones": [], "total": 0}
    
    # Buscar construcciones con match flexible
    construcciones = await db.gdb_construcciones.find({
        "$or": [
            {"codigo_predio": codigo},
            {"codigo_predio": {"$regex": f"^{codigo[:20]}"}}  # Match por prefijo (20 dígitos)
        ]
    }, {"_id": 0}).to_list(100)
    
    return {
        "construcciones": construcciones,
        "total": len(construcciones)
    }


@api_router.get("/gdb/construcciones/{codigo_predio}")
async def get_construcciones_by_codigo(codigo_predio: str, current_user: dict = Depends(get_current_user)):
    """Obtiene las construcciones por código de predio - match EXACTO"""
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    # Buscar con match EXACTO solamente
    # El código de la construcción debe coincidir exactamente con el código del predio
    construcciones = await db.gdb_construcciones.find({
        "codigo_predio": codigo_predio
    }, {"_id": 0}).to_list(100)
    
    return {
        "construcciones": construcciones,
        "total": len(construcciones)
    }


@api_router.post("/predios")
async def create_predio(predio_data: PredioCreate, current_user: dict = Depends(get_current_user)):
    """Crea un nuevo predio"""
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    r1 = predio_data.r1
    r2 = predio_data.r2
    
    # Obtener siguiente número de terreno
    terreno, terreno_num = await get_next_terreno_number(
        r1.municipio, r1.zona, r1.sector, r1.manzana_vereda
    )
    
    # Generar código predial nacional
    codigo_predial = await generate_codigo_predial(
        r1.municipio, r1.zona, r1.sector, r1.manzana_vereda,
        terreno, r1.condicion_predio, r1.predio_horizontal
    )
    
    # Verificar que no exista
    existing = await db.predios.find_one({"codigo_predial_nacional": codigo_predial})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un predio con este código predial")
    
    # Verificar que no sea un código eliminado
    eliminado = await db.predios_eliminados.find_one({"codigo_predial_nacional": codigo_predial})
    if eliminado:
        # Verificar si tiene aprobación de reaparición
        aprobacion = await db.predios_reapariciones_aprobadas.find_one({
            "codigo_predial_nacional": codigo_predial,
            "estado": "aprobado"
        })
        
        if not aprobacion:
            # Verificar si ya hay solicitud pendiente
            solicitud_pendiente = await db.predios_reapariciones_solicitudes.find_one({
                "codigo_predial_nacional": codigo_predial,
                "estado": "pendiente"
            })
            
            error_detail = {
                "error": "PREDIO_ELIMINADO",
                "mensaje": f"Este código predial fue ELIMINADO en vigencia {eliminado.get('vigencia_eliminacion')}",
                "codigo_predial": codigo_predial,
                "municipio": eliminado.get("municipio"),
                "vigencia_eliminacion": eliminado.get("vigencia_eliminacion"),
                "puede_solicitar_reaparicion": solicitud_pendiente is None,
                "tiene_solicitud_pendiente": solicitud_pendiente is not None,
                "instrucciones": "Use el endpoint /api/predios/reapariciones/solicitar para solicitar la reaparición con justificación técnica" if not solicitud_pendiente else "Ya existe una solicitud pendiente de aprobación"
            }
            raise HTTPException(status_code=400, detail=error_detail)
    
    # Generar código homologado
    codigo_homologado, numero_predio = await generate_codigo_homologado(r1.municipio)
    
    # Obtener código Código Nacional Catastral
    divipola = MUNICIPIOS_DIVIPOLA[r1.municipio]
    
    # Crear el predio
    predio = {
        "id": str(uuid.uuid4()),
        "departamento": divipola["departamento"],
        "municipio": r1.municipio,
        "municipio_codigo": divipola["municipio"],
        "numero_predio": numero_predio,
        "codigo_predial_nacional": codigo_predial,
        "codigo_homologado": codigo_homologado,
        "zona": r1.zona,
        "sector": r1.sector,
        "manzana_vereda": r1.manzana_vereda,
        "terreno": terreno,
        "terreno_num": terreno_num,
        "condicion_predio": r1.condicion_predio,
        "predio_horizontal": r1.predio_horizontal,
        
        # R1 - Información jurídica
        "tipo_registro": 1,
        "nombre_propietario": r1.nombre_propietario,
        "tipo_documento": r1.tipo_documento,
        "numero_documento": r1.numero_documento,
        "estado_civil": r1.estado_civil,
        "direccion": r1.direccion,
        "comuna": r1.comuna,
        "destino_economico": r1.destino_economico,
        "area_terreno": r1.area_terreno,
        "area_construida": r1.area_construida,
        "avaluo": r1.avaluo,
        "tipo_mutacion": r1.tipo_mutacion,
        "numero_resolucion": r1.numero_resolucion,
        "fecha_resolucion": r1.fecha_resolucion,
        
        # R2 - Información física (si se proporciona)
        "r2": r2.model_dump() if r2 else None,
        
        # Metadata
        "vigencia": datetime.now().strftime("%m%d%Y"),
        "created_by": current_user['id'],
        "created_by_name": current_user['full_name'],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "deleted": False,
        
        # Historial
        "historial": [{
            "accion": "Predio creado",
            "usuario": current_user['full_name'],
            "usuario_id": current_user['id'],
            "fecha": datetime.now(timezone.utc).isoformat()
        }]
    }
    
    await db.predios.insert_one(predio)
    
    # Remover _id antes de retornar
    predio.pop("_id", None)
    
    return predio

@api_router.patch("/predios/{predio_id}")
async def update_predio(predio_id: str, update_data: PredioUpdate, current_user: dict = Depends(get_current_user)):
    """Actualiza un predio existente"""
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    predio = await db.predios.find_one({"id": predio_id, "deleted": {"$ne": True}}, {"_id": 0})
    if not predio:
        raise HTTPException(status_code=404, detail="Predio no encontrado")
    
    # Filtrar campos no nulos
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    
    if not update_dict:
        return predio
    
    # Agregar metadata de actualización
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Agregar al historial
    historial_entry = {
        "accion": "Predio modificado",
        "usuario": current_user['full_name'],
        "usuario_id": current_user['id'],
        "campos_modificados": list(update_dict.keys()),
        "fecha": datetime.now(timezone.utc).isoformat()
    }
    
    await db.predios.update_one(
        {"id": predio_id},
        {
            "$set": update_dict,
            "$push": {"historial": historial_entry}
        }
    )
    
    # Retornar predio actualizado
    updated_predio = await db.predios.find_one({"id": predio_id}, {"_id": 0})
    return updated_predio

@api_router.delete("/predios/{predio_id}")
async def delete_predio(predio_id: str, current_user: dict = Depends(get_current_user)):
    """Elimina un predio (soft delete)"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="Solo coordinadores y administradores pueden eliminar predios")
    
    predio = await db.predios.find_one({"id": predio_id, "deleted": {"$ne": True}}, {"_id": 0})
    if not predio:
        raise HTTPException(status_code=404, detail="Predio no encontrado")
    
    # Soft delete - NO eliminamos físicamente para evitar reutilizar códigos
    historial_entry = {
        "accion": "Predio eliminado",
        "usuario": current_user['full_name'],
        "usuario_id": current_user['id'],
        "fecha": datetime.now(timezone.utc).isoformat()
    }
    
    await db.predios.update_one(
        {"id": predio_id},
        {
            "$set": {
                "deleted": True,
                "deleted_at": datetime.now(timezone.utc).isoformat(),
                "deleted_by": current_user['id'],
                "deleted_by_name": current_user['full_name']
            },
            "$push": {"historial": historial_entry}
        }
    )
    
    return {"message": "Predio eliminado exitosamente"}


# ===== SISTEMA DE APROBACIÓN DE PREDIOS =====

@api_router.post("/predios/cambios/proponer")
async def proponer_cambio_predio(
    cambio: CambioPendienteCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Propone un cambio en un predio (crear, modificar, eliminar).
    Solo gestores y atención pueden proponer. Coordinadores aprueban directamente.
    """
    # Verificar permisos - Usuarios y Comunicaciones no pueden proponer cambios
    if current_user['role'] in [UserRole.USUARIO, UserRole.COMUNICACIONES]:
        raise HTTPException(status_code=403, detail="No tiene permiso para proponer cambios en predios")
    
    # Coordinadores y administradores aprueban directamente
    aprueba_directo = current_user['role'] in [UserRole.COORDINADOR, UserRole.ADMINISTRADOR]
    
    cambio_doc = {
        "id": str(uuid.uuid4()),
        "predio_id": cambio.predio_id,
        "tipo_cambio": cambio.tipo_cambio,
        "datos_propuestos": cambio.datos_propuestos,
        "justificacion": cambio.justificacion,
        "estado": PredioEstadoAprobacion.APROBADO if aprueba_directo else f"pendiente_{cambio.tipo_cambio}",
        "propuesto_por": current_user['id'],
        "propuesto_por_nombre": current_user['full_name'],
        "propuesto_por_rol": current_user['role'],
        "fecha_propuesta": datetime.now(timezone.utc).isoformat(),
        "aprobado_por": current_user['id'] if aprueba_directo else None,
        "aprobado_por_nombre": current_user['full_name'] if aprueba_directo else None,
        "fecha_aprobacion": datetime.now(timezone.utc).isoformat() if aprueba_directo else None,
        "comentario_aprobacion": "Aprobación directa por coordinador/administrador" if aprueba_directo else None
    }
    
    # Si aprueba directo, aplicar el cambio inmediatamente
    if aprueba_directo:
        resultado = await aplicar_cambio_predio(cambio_doc, current_user)
        cambio_doc["resultado"] = resultado
    
    # Guardar el cambio en la colección de cambios
    await db.predios_cambios.insert_one(cambio_doc)
    
    return {
        "id": cambio_doc["id"],
        "estado": cambio_doc["estado"],
        "mensaje": "Cambio aplicado directamente" if aprueba_directo else "Cambio propuesto, pendiente de aprobación",
        "requiere_aprobacion": not aprueba_directo
    }


@api_router.get("/predios/cambios/pendientes")
async def get_cambios_pendientes(
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Lista todos los cambios pendientes de aprobación (solo coordinadores/admin)"""
    if current_user['role'] not in [UserRole.COORDINADOR, UserRole.ADMINISTRADOR]:
        raise HTTPException(status_code=403, detail="Solo coordinadores pueden ver cambios pendientes")
    
    query = {
        "estado": {"$in": [
            PredioEstadoAprobacion.PENDIENTE_CREACION,
            PredioEstadoAprobacion.PENDIENTE_MODIFICACION,
            PredioEstadoAprobacion.PENDIENTE_ELIMINACION
        ]}
    }
    
    total = await db.predios_cambios.count_documents(query)
    cambios = await db.predios_cambios.find(query, {"_id": 0}).sort("fecha_propuesta", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enriquecer con datos del predio actual si existe (para comparación)
    for cambio in cambios:
        if cambio.get("predio_id"):
            # Obtener TODOS los campos del predio actual para permitir comparación
            predio = await db.predios.find_one(
                {"id": cambio["predio_id"]}, 
                {"_id": 0, "historial": 0}  # Excluir historial para reducir tamaño
            )
            cambio["predio_actual"] = predio
    
    return {
        "total": total,
        "cambios": cambios
    }


@api_router.get("/predios/cambios/historial")
async def get_historial_cambios(
    predio_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Obtiene el historial de cambios (aprobados y rechazados)"""
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    query = {}
    if predio_id:
        query["predio_id"] = predio_id
    
    total = await db.predios_cambios.count_documents(query)
    cambios = await db.predios_cambios.find(query, {"_id": 0}).sort("fecha_propuesta", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "total": total,
        "cambios": cambios
    }


@api_router.post("/predios/cambios/aprobar")
async def aprobar_rechazar_cambio(
    request: CambioAprobacionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Aprueba o rechaza un cambio pendiente (solo coordinadores/admin o con permiso)"""
    has_permission = await check_permission(current_user, Permission.APPROVE_CHANGES)
    if not has_permission:
        raise HTTPException(status_code=403, detail="No tiene permiso para aprobar cambios")
    
    # Buscar el cambio
    cambio = await db.predios_cambios.find_one({"id": request.cambio_id}, {"_id": 0})
    
    if not cambio:
        raise HTTPException(status_code=404, detail="Cambio no encontrado")
    
    if cambio["estado"] not in [
        PredioEstadoAprobacion.PENDIENTE_CREACION,
        PredioEstadoAprobacion.PENDIENTE_MODIFICACION,
        PredioEstadoAprobacion.PENDIENTE_ELIMINACION
    ]:
        raise HTTPException(status_code=400, detail="Este cambio ya fue procesado")
    
    nuevo_estado = PredioEstadoAprobacion.APROBADO if request.aprobado else PredioEstadoAprobacion.RECHAZADO
    
    update_data = {
        "estado": nuevo_estado,
        "aprobado_por": current_user['id'],
        "aprobado_por_nombre": current_user['full_name'],
        "fecha_aprobacion": datetime.now(timezone.utc).isoformat(),
        "comentario_aprobacion": request.comentario
    }
    
    # Si se aprueba, aplicar el cambio
    if request.aprobado:
        resultado = await aplicar_cambio_predio(cambio, current_user)
        update_data["resultado"] = resultado
    
    await db.predios_cambios.update_one(
        {"id": request.cambio_id},
        {"$set": update_data}
    )
    
    # Si se rechaza, notificar al usuario que propuso el cambio (solo plataforma, no email)
    if not request.aprobado and cambio.get("propuesto_por"):
        codigo_predio = cambio.get("datos_propuestos", {}).get("codigo_predial_nacional", "N/A")
        await crear_notificacion(
            usuario_id=cambio["propuesto_por"],
            titulo="Cambio de Predio Rechazado",
            mensaje=f"El cambio propuesto para el predio {codigo_predio} ha sido rechazado por {current_user['full_name']}. Motivo: {request.comentario or 'Sin comentario'}",
            tipo="warning",
            enlace="/dashboard/pendientes",
            enviar_email=False  # Solo notificación en plataforma
        )
    
    return {
        "mensaje": "Cambio aprobado y aplicado" if request.aprobado else "Cambio rechazado",
        "estado": nuevo_estado
    }


async def aplicar_cambio_predio(cambio: dict, aprobador: dict) -> dict:
    """Aplica un cambio aprobado al predio"""
    tipo = cambio["tipo_cambio"]
    datos = cambio["datos_propuestos"]
    
    historial_entry = {
        "accion": f"Cambio {tipo} aprobado",
        "usuario": aprobador['full_name'],
        "usuario_rol": aprobador['role'],
        "propuesto_por": cambio.get("propuesto_por_nombre"),
        "fecha": datetime.now(timezone.utc).isoformat(),
        "comentario": cambio.get("comentario_aprobacion")
    }
    
    if tipo == "creacion":
        # Crear nuevo predio
        predio_doc = datos.copy()
        predio_doc["id"] = str(uuid.uuid4())
        predio_doc["estado_aprobacion"] = PredioEstadoAprobacion.APROBADO
        predio_doc["deleted"] = False
        predio_doc["created_at"] = datetime.now(timezone.utc).isoformat()
        predio_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
        predio_doc["historial"] = [historial_entry]
        
        await db.predios.insert_one(predio_doc)
        return {"predio_id": predio_doc["id"], "accion": "creado"}
    
    elif tipo == "modificacion":
        predio_id = cambio["predio_id"]
        
        # Actualizar predio
        datos["updated_at"] = datetime.now(timezone.utc).isoformat()
        datos["estado_aprobacion"] = PredioEstadoAprobacion.APROBADO
        
        await db.predios.update_one(
            {"id": predio_id},
            {
                "$set": datos,
                "$push": {"historial": historial_entry}
            }
        )
        return {"predio_id": predio_id, "accion": "modificado"}
    
    elif tipo == "eliminacion":
        predio_id = cambio["predio_id"]
        
        # Soft delete
        await db.predios.update_one(
            {"id": predio_id},
            {
                "$set": {
                    "deleted": True,
                    "deleted_at": datetime.now(timezone.utc).isoformat(),
                    "deleted_by": aprobador['id'],
                    "deleted_by_name": aprobador['full_name'],
                    "estado_aprobacion": PredioEstadoAprobacion.APROBADO
                },
                "$push": {"historial": historial_entry}
            }
        )
        return {"predio_id": predio_id, "accion": "eliminado"}
    
    return {"error": "Tipo de cambio no reconocido"}


@api_router.get("/predios/cambios/mis-propuestas")
async def get_mis_propuestas(
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Lista las propuestas de cambio del usuario actual"""
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    query = {"propuesto_por": current_user['id']}
    
    total = await db.predios_cambios.count_documents(query)
    cambios = await db.predios_cambios.find(query, {"_id": 0}).sort("fecha_propuesta", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "total": total,
        "cambios": cambios
    }


@api_router.get("/predios/cambios/stats")
async def get_cambios_stats(current_user: dict = Depends(get_current_user)):
    """Obtiene estadísticas de cambios pendientes"""
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    pendientes_creacion = await db.predios_cambios.count_documents({"estado": PredioEstadoAprobacion.PENDIENTE_CREACION})
    pendientes_modificacion = await db.predios_cambios.count_documents({"estado": PredioEstadoAprobacion.PENDIENTE_MODIFICACION})
    pendientes_eliminacion = await db.predios_cambios.count_documents({"estado": PredioEstadoAprobacion.PENDIENTE_ELIMINACION})
    
    return {
        "pendientes_creacion": pendientes_creacion,
        "pendientes_modificacion": pendientes_modificacion,
        "pendientes_eliminacion": pendientes_eliminacion,
        "total_pendientes": pendientes_creacion + pendientes_modificacion + pendientes_eliminacion
    }


# ===== GEOGRAPHIC DATABASE (GDB) INTEGRATION =====

GDB_PATH = Path("/app/gdb_data/54003.gdb")

async def get_gdb_geometry_async(codigo_predial: str) -> Optional[dict]:
    """Get geometry for a property from MongoDB gdb_geometrias collection first, then fallback to GDB files"""
    
    try:
        # PRIMERO: Buscar en la colección gdb_geometrias de MongoDB
        geometria = await db.gdb_geometrias.find_one(
            {"codigo": codigo_predial},
            {"_id": 0}
        )
        
        if geometria:
            return {
                "type": "Feature",
                "geometry": geometria.get("geometry"),
                "properties": {
                    "codigo": codigo_predial,
                    "tipo": geometria.get("tipo", "Rural"),
                    "municipio": geometria.get("municipio", ""),
                    "area_m2": geometria.get("area_m2", 0)
                }
            }
        
        # Si no está en MongoDB, intentar buscar por coincidencia parcial
        # (ignorando zona/sector)
        if len(codigo_predial) >= 17:
            depto_muni = codigo_predial[:5]
            terreno_resto = codigo_predial[13:]
            
            # Buscar geometrías del mismo municipio
            posibles = await db.gdb_geometrias.find(
                {"codigo": {"$regex": f"^{depto_muni}"}},
                {"_id": 0, "codigo": 1}
            ).limit(5000).to_list(5000)
            
            for p in posibles:
                codigo_gdb = p.get("codigo", "")
                if len(codigo_gdb) >= 17:
                    if codigo_gdb[13:] == terreno_resto:
                        # Encontramos match por segmento terreno
                        geometria = await db.gdb_geometrias.find_one(
                            {"codigo": codigo_gdb},
                            {"_id": 0}
                        )
                        if geometria:
                            return {
                                "type": "Feature",
                                "geometry": geometria.get("geometry"),
                                "properties": {
                                    "codigo": codigo_gdb,
                                    "codigo_original": codigo_predial,
                                    "tipo": geometria.get("tipo", "Rural"),
                                    "municipio": geometria.get("municipio", ""),
                                    "area_m2": geometria.get("area_m2", 0),
                                    "match_method": "segmento"
                                }
                            }
        
        return None
        
    except Exception as e:
        logger.error(f"Error getting geometry from MongoDB: {e}")
        return None


def get_gdb_geometry(codigo_predial: str) -> Optional[dict]:
    """Get geometry for a property from multiple GDB files, transformed to WGS84 for web mapping"""
    import geopandas as gpd
    from shapely.geometry import mapping
    
    # Mapeo de códigos de municipio a archivos GDB
    GDB_FILES = {
        '54003': '/app/gdb_data/54003.gdb',  # Ábrego
        '54109': '/app/gdb_data/54109.gdb',  # Bucarasica
        '54128': '/app/gdb_data/54128.gdb',  # Cáchira
    }
    
    try:
        # Extraer código de municipio del código predial (posiciones 0-5)
        municipio_code = codigo_predial[:5]
        
        # Determinar si es rural o urbano
        sector = codigo_predial[5:8]
        is_urban = sector != "000"
        
        # Buscar el archivo GDB correcto
        gdb_path = None
        for code, path in GDB_FILES.items():
            if municipio_code == code:
                gdb_path = Path(path)
                break
        
        if not gdb_path or not gdb_path.exists():
            # Intentar con el GDB por defecto
            if GDB_PATH.exists():
                gdb_path = GDB_PATH
            else:
                return None
        
        # Determinar nombre de capa (diferentes GDBs usan diferentes nombres)
        # 54003 (Ábrego): R_TERRENO_1, U_TERRENO_1
        # Otros: R_TERRENO, U_TERRENO
        if '54003' in str(gdb_path):
            layer = "U_TERRENO_1" if is_urban else "R_TERRENO_1"
        else:
            layer = "U_TERRENO" if is_urban else "R_TERRENO"
        
        # Leer capa y buscar el código
        gdf = gpd.read_file(str(gdb_path), layer=layer)
        match = gdf[gdf['codigo'] == codigo_predial]
        
        if len(match) == 0:
            return None
        
        # Obtener área y perímetro originales
        area_m2 = float(match.iloc[0]['shape_Area']) if 'shape_Area' in match.columns else None
        perimetro_m = float(match.iloc[0]['shape_Length']) if 'shape_Length' in match.columns else None
        
        # Transformar a WGS84
        match_wgs84 = match.to_crs(epsg=4326)
        
        geom = match_wgs84.iloc[0]['geometry']
        if geom is None:
            return None
            
        geojson = mapping(geom)
        
        return {
            "type": "Feature",
            "geometry": geojson,
            "properties": {
                "codigo": codigo_predial,
                "area_m2": area_m2,
                "perimetro_m": perimetro_m,
                "tipo": "Urbano" if is_urban else "Rural"
            }
        }
    except Exception as e:
        logger.error(f"Error reading GDB geometry: {e}")
        return None


@api_router.get("/predios/{predio_id}/geometria")
async def get_predio_geometry(predio_id: str, current_user: dict = Depends(get_current_user)):
    """Get geographic geometry for a property"""
    # Only staff can access geometry
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    # Get predio from database
    predio = await db.predios.find_one({"id": predio_id}, {"_id": 0})
    if not predio:
        raise HTTPException(status_code=404, detail="Predio no encontrado")
    
    codigo = predio.get("codigo_predial_nacional")
    if not codigo:
        raise HTTPException(status_code=404, detail="Predio sin código catastral")
    
    # Primero intentar con la función async que busca en MongoDB
    geometry = await get_gdb_geometry_async(codigo)
    if not geometry:
        # Fallback a la función que lee archivos GDB directamente
        geometry = get_gdb_geometry(codigo)
    if not geometry:
        raise HTTPException(status_code=404, detail="Geometría no disponible para este predio")
    
    return geometry


@api_router.get("/predios/codigo/{codigo_predial}/geometria")
async def get_geometry_by_code(codigo_predial: str, current_user: dict = Depends(get_current_user)):
    """Get geographic geometry directly by cadastral code"""
    # Only staff can access geometry
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    # Primero intentar con la función async que busca en MongoDB
    geometry = await get_gdb_geometry_async(codigo_predial)
    if not geometry:
        # Fallback a la función que lee archivos GDB directamente
        geometry = get_gdb_geometry(codigo_predial)
    if not geometry:
        raise HTTPException(status_code=404, detail="Geometría no disponible para este código")
    
    return geometry


@api_router.get("/gdb/geometrias")
async def get_geometrias_filtradas(
    municipio: Optional[str] = None,
    zona: Optional[str] = None,  # 'urbano' o 'rural'
    limit: int = 500,
    current_user: dict = Depends(get_current_user)
):
    """Get all geometries for a municipality/zone from MongoDB collection"""
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    if not municipio:
        raise HTTPException(status_code=400, detail="Debe especificar un municipio")
    
    # Construir query
    query = {"municipio": municipio}
    if zona == 'urbano':
        query["tipo"] = "urbano"
    elif zona == 'rural':
        query["tipo"] = "rural"
    
    try:
        # Buscar en la colección gdb_geometrias
        geometrias = await db.gdb_geometrias.find(
            query,
            {"_id": 0, "codigo": 1, "tipo": 1, "geometry": 1}
        ).limit(limit).to_list(limit)
        
        if not geometrias:
            # Verificar si hay datos para este municipio
            total_municipio = await db.gdb_geometrias.count_documents({"municipio": municipio})
            if total_municipio == 0:
                raise HTTPException(status_code=404, detail=f"No hay datos geográficos para {municipio}. Cargue un archivo GDB primero.")
        
        # Convertir a GeoJSON FeatureCollection
        features = []
        for geom in geometrias:
            feature = {
                "type": "Feature",
                "geometry": geom.get("geometry"),
                "properties": {
                    "codigo": geom.get("codigo"),
                    "tipo": geom.get("tipo", "").capitalize()
                }
            }
            features.append(feature)
        
        return {
            "type": "FeatureCollection",
            "municipio": municipio,
            "zona_filter": zona,
            "total": len(features),
            "features": features
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting geometries: {e}")
        raise HTTPException(status_code=500, detail=f"Error al obtener geometrías: {str(e)}")


@api_router.get("/gdb/limites-municipios")
async def get_limites_municipios(
    fuente: str = "gdb",  # "gdb" para calculados con líneas internas, "oficial" para DANE/IGAC
    current_user: dict = Depends(get_current_user)
):
    """
    Obtiene los límites de todos los municipios.
    - fuente="gdb": Límites calculados desde geometrías GDB (muestra líneas internas para revisar errores)
    - fuente="oficial": Límites oficiales DANE/IGAC (limpios, sin líneas internas)
    """
    from shapely.geometry import shape, mapping, box, Polygon
    from shapely.ops import unary_union
    
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    try:
        features = []
        municipios_con_limite = set()
        
        # Si se piden límites oficiales, usar la colección limites_municipales
        if fuente == "oficial":
            async for doc in db.limites_municipales.find({}, {"_id": 0}):
                municipio = doc.get("municipio")
                geometry = doc.get("geometry")
                sin_gdb = doc.get("sin_gdb", False)
                
                if municipio and geometry:
                    municipios_con_limite.add(municipio)
                    # Obtener stats de predios
                    stats = await db.gdb_geometrias.aggregate([
                        {"$match": {"municipio": municipio}},
                        {"$group": {"_id": "$tipo", "count": {"$sum": 1}}}
                    ]).to_list(10)
                    rural_count = 0
                    urbano_count = 0
                    for s in stats:
                        if s["_id"] == "rural":
                            rural_count = s["count"]
                        else:
                            urbano_count = s["count"]
                    
                    try:
                        geom = shape(geometry)
                        geom_simplified = geom.simplify(0.0005, preserve_topology=True)
                        centroid = geom_simplified.centroid
                        
                        features.append({
                            "type": "Feature",
                            "geometry": mapping(geom_simplified),
                            "properties": {
                                "municipio": municipio,
                                "total_predios": rural_count + urbano_count,
                                "rurales": rural_count,
                                "urbanos": urbano_count,
                                "centroid": [centroid.x, centroid.y],
                                "fuente": doc.get("fuente", "dane_igac"),
                                "sin_gdb": sin_gdb
                            }
                        })
                    except Exception as e:
                        logger.warning(f"Error procesando límite oficial de {municipio}: {e}")
            
            # Ordenar y retornar
            features.sort(key=lambda x: x["properties"]["municipio"])
            return {
                "type": "FeatureCollection",
                "total_municipios": len(features),
                "fuente": "oficial",
                "features": features
            }
        
        # Si se piden límites GDB (calculados), usar geometrías para mostrar líneas internas
        # Primero agregar municipios sin GDB desde límites oficiales
        async for doc in db.limites_municipales.find({"sin_gdb": True}, {"_id": 0}):
            municipio = doc.get("municipio")
            geometry = doc.get("geometry")
            if municipio and geometry:
                municipios_con_limite.add(municipio)
                try:
                    geom = shape(geometry)
                    centroid = geom.centroid
                    features.append({
                        "type": "Feature",
                        "geometry": geometry,
                        "properties": {
                            "municipio": municipio,
                            "total_predios": 0,
                            "rurales": 0,
                            "urbanos": 0,
                            "centroid": [centroid.x, centroid.y],
                            "fuente": "dane_igac",
                            "sin_gdb": True
                        }
                    })
                except Exception as e:
                    logger.warning(f"Error procesando límite de {municipio}: {e}")
        
        # Calcular límites desde geometrías GDB (muestra líneas internas)
        municipios_gdb = await db.gdb_geometrias.distinct("municipio")
        
        for municipio in municipios_gdb:
            if municipio in municipios_con_limite:
                continue
            
            try:
                # Usar solo el exterior (boundary) simplificado
                geometrias_cursor = db.gdb_geometrias.find(
                    {"municipio": municipio},
                    {"_id": 0, "geometry": 1, "tipo": 1}
                ).limit(5000)  # Limitar para rendimiento
                
                shapes = []
                rural_count = 0
                urbano_count = 0
                
                async for doc in geometrias_cursor:
                    geom_dict = doc.get("geometry")
                    if geom_dict:
                        try:
                            geom = shape(geom_dict)
                            if geom.is_valid:
                                shapes.append(geom)
                                if doc.get("tipo") == "rural":
                                    rural_count += 1
                                else:
                                    urbano_count += 1
                        except:
                            continue
                
                if shapes:
                    # Crear el límite REAL del municipio usando unary_union
                    union_geom = unary_union(shapes)
                    # Simplificar para rendimiento pero mantener forma real
                    limite = union_geom.simplify(0.0008, preserve_topology=True)
                    centroid = limite.centroid
                    
                    features.append({
                        "type": "Feature",
                        "geometry": mapping(limite),
                        "properties": {
                            "municipio": municipio,
                            "total_predios": len(shapes),
                            "rurales": rural_count,
                            "urbanos": urbano_count,
                            "centroid": [centroid.x, centroid.y],
                            "fuente": "calculado"
                        }
                    })
                    municipios_con_limite.add(municipio)
            except Exception as e:
                logger.warning(f"Error procesando {municipio}: {e}")
        
        # Ordenar por nombre de municipio
        features.sort(key=lambda x: x["properties"]["municipio"])
        
        return {
            "type": "FeatureCollection",
            "total_municipios": len(features),
            "fuente": "gdb",
            "features": features
        }
        
    except Exception as e:
        logger.error(f"Error getting municipality limits: {e}")
        raise HTTPException(status_code=500, detail=f"Error al obtener límites: {str(e)}")


@api_router.get("/gdb/stats")
async def get_gdb_stats(current_user: dict = Depends(get_current_user)):
    """Get statistics about available geographic data from MongoDB collection"""
    # Only staff can access stats
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    try:
        # Agregar por municipio y tipo
        pipeline = [
            {"$group": {
                "_id": {"municipio": "$municipio", "tipo": "$tipo"},
                "count": {"$sum": 1}
            }},
            {"$sort": {"_id.municipio": 1}}
        ]
        
        resultados = await db.gdb_geometrias.aggregate(pipeline).to_list(100)
        
        stats_by_municipio = {}
        total_rurales = 0
        total_urbanos = 0
        
        for r in resultados:
            mun = r["_id"]["municipio"]
            tipo = r["_id"]["tipo"]
            count = r["count"]
            
            if mun not in stats_by_municipio:
                stats_by_municipio[mun] = {"rurales": 0, "urbanos": 0, "total": 0}
            
            if tipo == "rural":
                stats_by_municipio[mun]["rurales"] = count
                total_rurales += count
            elif tipo == "urbano":
                stats_by_municipio[mun]["urbanos"] = count
                total_urbanos += count
            
            stats_by_municipio[mun]["total"] = stats_by_municipio[mun]["rurales"] + stats_by_municipio[mun]["urbanos"]
        
        return {
            "gdb_disponible": len(stats_by_municipio) > 0,
            "predios_rurales": total_rurales,
            "predios_urbanos": total_urbanos,
            "total_geometrias": total_rurales + total_urbanos,
            "municipios": stats_by_municipio,
            "municipios_disponibles": list(stats_by_municipio.keys())
        }
    except Exception as e:
        logger.error(f"Error reading GDB stats: {e}")
        raise HTTPException(status_code=500, detail=f"Error leyendo estadísticas: {str(e)}")


@api_router.get("/gdb/capas")
async def get_gdb_layers(current_user: dict = Depends(get_current_user)):
    """List all available layers in the GDB"""
    import pyogrio
    
    # Only staff can access
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    if not GDB_PATH.exists():
        raise HTTPException(status_code=404, detail="Base de datos geográfica no disponible")
    
    try:
        layers = pyogrio.list_layers(str(GDB_PATH))
        return {
            "capas": [{"nombre": layer[0], "tipo_geometria": layer[1]} for layer in layers],
            "total": len(layers)
        }
    except Exception as e:
        logger.error(f"Error listing GDB layers: {e}")
        raise HTTPException(status_code=500, detail=f"Error listando capas: {str(e)}")


# Capas estándar según normativa IGAC - SOLO estos nombres son válidos
CAPAS_ESTANDAR = {
    "terreno_rural": ["R_TERRENO"],
    "terreno_urbano": ["U_TERRENO"],
    "construccion_rural": ["R_CONSTRUCCION"],
    "construccion_urbana": ["U_CONSTRUCCION"],
    "limite_municipal": ["LIMITEMUNICIPIO", "LimiteMunicipio", "LIMITE_MUNICIPIO"]
}


@api_router.post("/gdb/analizar")
async def analizar_gdb_antes_de_cargar(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Analiza un archivo GDB/ZIP antes de cargarlo para:
    1. Listar todas las capas encontradas
    2. Identificar cuáles son reconocidas como estándar
    3. Detectar capas no estándar que necesitan renombrarse
    4. Validar códigos prediales y detectar errores de formato
    """
    import pyogrio
    import zipfile
    import tempfile
    import shutil
    
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    # Guardar archivo temporal
    temp_dir = Path(tempfile.mkdtemp())
    try:
        file_path = temp_dir / file.filename
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Si es ZIP, extraer
        gdb_path = None
        if file.filename.lower().endswith('.zip'):
            with zipfile.ZipFile(file_path, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)
            # Buscar .gdb
            for item in temp_dir.rglob("*.gdb"):
                gdb_path = item
                break
        elif file.filename.lower().endswith('.gdb'):
            gdb_path = file_path
        
        if not gdb_path or not gdb_path.exists():
            raise HTTPException(status_code=400, detail="No se encontró archivo GDB válido")
        
        # Listar capas
        layers = pyogrio.list_layers(str(gdb_path))
        capas_encontradas = [{"nombre": layer[0], "tipo_geometria": layer[1]} for layer in layers]
        
        # Clasificar capas
        capas_analisis = {
            "reconocidas": [],
            "no_reconocidas": [],
            "recomendaciones": []
        }
        
        nombres_capas = [c["nombre"].upper() for c in capas_encontradas]
        
        # Verificar capas estándar
        for tipo, nombres_validos in CAPAS_ESTANDAR.items():
            encontrada = None
            for nombre in nombres_validos:
                if nombre.upper() in nombres_capas:
                    encontrada = nombre
                    break
            
            # Buscar alternativas si no se encontró estándar
            if not encontrada:
                for capa in capas_encontradas:
                    nombre_upper = capa["nombre"].upper().replace(" ", "_")
                    if tipo == "terreno_rural" and ("TERRENO" in nombre_upper and nombre_upper.startswith("R")):
                        capas_analisis["no_reconocidas"].append({
                            "capa": capa["nombre"],
                            "tipo_detectado": tipo,
                            "sugerencia": f"Renombrar a '{nombres_validos[0]}'"
                        })
                    elif tipo == "terreno_urbano" and ("TERRENO" in nombre_upper and nombre_upper.startswith("U")):
                        capas_analisis["no_reconocidas"].append({
                            "capa": capa["nombre"],
                            "tipo_detectado": tipo,
                            "sugerencia": f"Renombrar a '{nombres_validos[0]}'"
                        })
                    elif tipo == "construccion_rural" and ("CONSTRUCCION" in nombre_upper and nombre_upper.startswith("R")):
                        capas_analisis["no_reconocidas"].append({
                            "capa": capa["nombre"],
                            "tipo_detectado": tipo,
                            "sugerencia": f"Renombrar a '{nombres_validos[0]}'"
                        })
                    elif tipo == "construccion_urbana" and ("CONSTRUCCION" in nombre_upper and nombre_upper.startswith("U")):
                        capas_analisis["no_reconocidas"].append({
                            "capa": capa["nombre"],
                            "tipo_detectado": tipo,
                            "sugerencia": f"Renombrar a '{nombres_validos[0]}'"
                        })
            else:
                capas_analisis["reconocidas"].append({
                    "tipo": tipo,
                    "capa_encontrada": encontrada
                })
        
        # Analizar códigos prediales en las capas de terreno
        codigos_con_error = []
        codigos_validos = 0
        
        for tipo_capa in ["terreno_rural", "terreno_urbano"]:
            for nombre in CAPAS_ESTANDAR[tipo_capa]:
                try:
                    gdf = gpd.read_file(str(gdb_path), layer=nombre)
                    if len(gdf) > 0:
                        for col in ['CODIGO', 'codigo', 'CODIGO_PREDIAL', 'codigo_predial', 'COD_PREDIO']:
                            if col in gdf.columns:
                                for idx, row in gdf.head(100).iterrows():  # Analizar primeros 100
                                    codigo = str(row.get(col, ''))
                                    if codigo and codigo != 'nan':
                                        # Validar formato de código predial nacional (30 dígitos)
                                        codigo_limpio = codigo.strip()
                                        if len(codigo_limpio) != 30:
                                            codigos_con_error.append({
                                                "codigo": codigo_limpio,
                                                "error": f"Longitud incorrecta ({len(codigo_limpio)} caracteres, debe ser 30)",
                                                "capa": nombre
                                            })
                                        elif not codigo_limpio.isdigit():
                                            codigos_con_error.append({
                                                "codigo": codigo_limpio,
                                                "error": "Contiene caracteres no numéricos",
                                                "capa": nombre
                                            })
                                        else:
                                            codigos_validos += 1
                                break
                        break
                except:
                    continue
        
        # Generar recomendaciones
        capas_faltantes = []
        for tipo, nombres in CAPAS_ESTANDAR.items():
            if tipo in ["terreno_rural", "terreno_urbano"]:  # Solo verificar capas críticas
                encontrada = any(n.upper() in nombres_capas for n in nombres)
                if not encontrada:
                    capas_faltantes.append(f"{nombres[0]} ({tipo})")
        
        if capas_faltantes:
            capas_analisis["recomendaciones"].append(
                f"⚠️ CAPAS ESTÁNDAR FALTANTES: {', '.join(capas_faltantes)}. La GDB no puede ser procesada sin estas capas."
            )
        
        if capas_analisis["no_reconocidas"]:
            capas_analisis["recomendaciones"].append(
                "❌ Hay capas que NO siguen el estándar IGAC. DEBE renombrarlas antes de cargar."
            )
        
        if codigos_con_error:
            capas_analisis["recomendaciones"].append(
                f"⚠️ Se encontraron {len(codigos_con_error)} códigos prediales con errores de formato."
            )
        
        # Solo puede procesar si tiene al menos una capa estándar reconocida
        puede_procesar = len(capas_analisis["reconocidas"]) > 0 and len(capas_analisis["no_reconocidas"]) == 0
        
        return {
            "archivo": file.filename,
            "total_capas": len(capas_encontradas),
            "capas_encontradas": capas_encontradas,
            "analisis": capas_analisis,
            "validacion_codigos": {
                "codigos_validos": codigos_validos,
                "codigos_con_error": codigos_con_error[:20],  # Mostrar máximo 20 errores
                "total_errores": len(codigos_con_error)
            },
            "puede_procesar": puede_procesar,
            "capas_faltantes": capas_faltantes,
            "mensaje_error": "La GDB contiene capas con nombres NO estándar. Debe ajustar los nombres según el estándar IGAC antes de cargar." if not puede_procesar else None
        }
        
    finally:
        # Limpiar archivos temporales
        shutil.rmtree(temp_dir, ignore_errors=True)


# ===== NOTIFICACIONES Y ALERTAS GDB =====

@api_router.get("/notificaciones")
async def get_notificaciones(
    leidas: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    """Obtiene las notificaciones del usuario actual"""
    query = {"usuario_id": current_user['id']}
    if leidas is not None:
        query["leida"] = leidas
    
    notificaciones = await db.notificaciones.find(query, {"_id": 0}).sort("fecha", -1).limit(50).to_list(50)
    no_leidas = await db.notificaciones.count_documents({"usuario_id": current_user['id'], "leida": False})
    
    return {
        "notificaciones": notificaciones,
        "no_leidas": no_leidas
    }

@api_router.patch("/notificaciones/{notificacion_id}/leer")
async def marcar_notificacion_leida(
    notificacion_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Marca una notificación como leída"""
    result = await db.notificaciones.update_one(
        {"id": notificacion_id, "usuario_id": current_user['id']},
        {"$set": {"leida": True, "fecha_lectura": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    
    return {"message": "Notificación marcada como leída"}

@api_router.post("/notificaciones/marcar-todas-leidas")
async def marcar_todas_leidas(current_user: dict = Depends(get_current_user)):
    """Marca todas las notificaciones del usuario como leídas"""
    result = await db.notificaciones.update_many(
        {"usuario_id": current_user['id'], "leida": False},
        {"$set": {"leida": True, "fecha_lectura": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": f"{result.modified_count} notificaciones marcadas como leídas"}

async def crear_notificacion(usuario_id: str, titulo: str, mensaje: str, tipo: str = "info", enlace: str = None, enviar_email: bool = False):
    """Crea una notificación para un usuario y opcionalmente envía email"""
    notificacion = {
        "id": str(uuid.uuid4()),
        "usuario_id": usuario_id,
        "titulo": titulo,
        "mensaje": mensaje,
        "tipo": tipo,  # info, warning, success, error
        "enlace": enlace,
        "leida": False,
        "fecha": datetime.now(timezone.utc).isoformat()
    }
    await db.notificaciones.insert_one(notificacion)
    
    # Enviar email si está habilitado
    if enviar_email:
        user = await db.users.find_one({"id": usuario_id}, {"_id": 0, "email": 1, "full_name": 1})
        if user and user.get('email'):
            try:
                await send_notification_email(user['email'], user.get('full_name', ''), titulo, mensaje)
            except Exception as e:
                logger.error(f"Error enviando email de notificación: {e}")
    
    return notificacion

async def send_notification_email(to_email: str, to_name: str, subject: str, message: str):
    """Envía un email de notificación usando la plantilla estándar"""
    try:
        msg = MIMEMultipart()
        msg['From'] = SMTP_FROM
        msg['To'] = to_email
        msg['Subject'] = f"[Asomunicipios] {subject}"
        
        contenido = f'''
        <p>Hola <strong>{to_name}</strong>,</p>
        <div style="background-color: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #047857;">
            <p style="margin: 0;">{message}</p>
        </div>
        '''
        
        html_body = get_email_template(
            titulo=subject,
            contenido=contenido,
            tipo_notificacion="info"
        )
        msg.attach(MIMEText(html_body, 'html'))
        
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
            
        logger.info(f"Email de notificación enviado a {to_email}")
    except Exception as e:
        logger.error(f"Error enviando email: {e}")
        raise

@api_router.post("/gdb/enviar-alertas-mensuales")
async def enviar_alertas_mensuales_gdb(current_user: dict = Depends(get_current_user)):
    """Envía alertas mensuales a los gestores con permiso GDB (ejecutar el día 1 de cada mes)"""
    if current_user['role'] not in [UserRole.COORDINADOR, UserRole.ADMINISTRADOR]:
        raise HTTPException(status_code=403, detail="Solo coordinadores pueden enviar alertas")
    
    # Buscar gestores con permiso GDB
    gestores_gdb = await db.users.find(
        {"puede_actualizar_gdb": True, "role": UserRole.GESTOR},
        {"_id": 0}
    ).to_list(100)
    
    alertas_enviadas = 0
    mes_actual = datetime.now().strftime("%B %Y")
    
    for gestor in gestores_gdb:
        titulo = "Recordatorio: Cargar Base Gráfica Mensual"
        mensaje = f"Es momento de cargar la base gráfica (GDB) correspondiente al mes de {mes_actual}. Por favor, acceda a Gestión de Predios > Base Gráfica para realizar la carga."
        
        await crear_notificacion(
            usuario_id=gestor['id'],
            titulo=titulo,
            mensaje=mensaje,
            tipo="warning",
            enviar_email=True
        )
        alertas_enviadas += 1
    
    return {
        "message": f"Alertas enviadas a {alertas_enviadas} gestores",
        "gestores_notificados": [g['full_name'] for g in gestores_gdb]
    }

@api_router.get("/gdb/verificar-alerta-mensual")
async def verificar_alerta_mensual(current_user: dict = Depends(get_current_user)):
    """Verifica si es día 1 del mes y si se debe mostrar alerta de carga GDB"""
    hoy = datetime.now()
    es_dia_1 = hoy.day == 1
    
    # Verificar si el usuario tiene permiso GDB
    user_db = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
    tiene_permiso_gdb = user_db.get('puede_actualizar_gdb', False) if user_db else False
    
    # Verificar si ya cargó este mes
    mes_actual = hoy.strftime("%Y-%m")
    carga_este_mes = await db.gdb_cargas.find_one({
        "mes": mes_actual,
        "uploaded_by": current_user['id']
    })
    
    mostrar_alerta = es_dia_1 and tiene_permiso_gdb and not carga_este_mes
    
    return {
        "es_dia_1": es_dia_1,
        "tiene_permiso_gdb": tiene_permiso_gdb,
        "ya_cargo_este_mes": carga_este_mes is not None,
        "mostrar_alerta": mostrar_alerta,
        "mes_actual": mes_actual
    }


# Diccionario global para almacenar el progreso de carga de GDB
gdb_upload_progress = {}


@api_router.get("/gdb/upload-progress/{upload_id}")
async def get_gdb_upload_progress(
    upload_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obtiene el progreso de una carga de GDB"""
    if upload_id not in gdb_upload_progress:
        return {"status": "not_found", "progress": 0}
    return gdb_upload_progress[upload_id]


@api_router.post("/gdb/upload")
async def upload_gdb_file(
    files: List[UploadFile] = File(...),
    municipio: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """Upload GDB files (ZIP or multiple files from a GDB folder). Only authorized gestors can do this."""
    import zipfile
    import shutil
    import geopandas as gpd
    import pandas as pd
    from pyproj import CRS, Transformer
    from shapely.ops import transform
    
    # Crear ID único para esta carga
    upload_id = str(uuid.uuid4())
    gdb_upload_progress[upload_id] = {
        "status": "iniciando",
        "progress": 0,
        "message": "Iniciando carga de archivos...",
        "upload_id": upload_id
    }
    
    def update_progress(status: str, progress: int, message: str, **extra):
        gdb_upload_progress[upload_id] = {
            "status": status,
            "progress": progress,
            "message": message,
            "upload_id": upload_id,
            **extra
        }
    
    # Check if user is an authorized gestor
    user_db = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
    
    if not user_db:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Check permission using the new permissions system
    has_permission = await check_permission(user_db, Permission.UPLOAD_GDB)
    if not has_permission:
        raise HTTPException(
            status_code=403, 
            detail="No tiene permiso para actualizar la base gráfica. Contacte al coordinador."
        )
    
    update_progress("preparando", 5, "Preparando transformación de coordenadas...")
    
    # Setup coordinate transformation function (will be set based on GDB CRS)
    project = None
    
    def validate_colombia_coordinates(geom):
        """Valida que las coordenadas estén dentro de Colombia (WGS84)"""
        # Límites aproximados de Colombia en WGS84
        # Latitud: -4.23° a 12.46° (Sur a Norte)
        # Longitud: -81.73° a -66.87° (Oeste a Este)
        try:
            if geom is None:
                return False
            bounds = geom.bounds  # (minx, miny, maxx, maxy)
            min_lon, min_lat, max_lon, max_lat = bounds
            
            # Verificar que esté en el rango de Colombia
            if min_lon < -82 or max_lon > -66:
                return False
            if min_lat < -5 or max_lat > 13:
                return False
            return True
        except:
            return False
    
    def get_transformer_for_gdf(gdf):
        """Get the appropriate transformer based on GDF's CRS"""
        try:
            if gdf.crs is None:
                # Assume MAGNA-SIRGAS Colombia Bogotá zone if no CRS
                logger.info("GDB sin CRS definido, asumiendo MAGNA-SIRGAS (EPSG:3116)")
                source_crs = CRS.from_epsg(3116)
            else:
                source_crs = CRS.from_user_input(gdf.crs)
                logger.info(f"GDB CRS detectado: {source_crs.to_string()}")
            
            target_crs = CRS.from_epsg(4326)  # WGS84
            
            # Check if already in WGS84
            if source_crs.to_epsg() == 4326:
                logger.info("GDB ya está en WGS84, no se requiere transformación")
                return None
            
            transformer = Transformer.from_crs(source_crs, target_crs, always_xy=True)
            return transformer.transform
        except Exception as e:
            logger.warning(f"Error setting up CRS transformation: {e}")
            # Fallback to MAGNA-SIRGAS
            try:
                logger.info("Usando fallback MAGNA-SIRGAS (EPSG:3116)")
                source_crs = CRS.from_epsg(3116)
                target_crs = CRS.from_epsg(4326)
                transformer = Transformer.from_crs(source_crs, target_crs, always_xy=True)
                return transformer.transform
            except:
                return None
    
    try:
        gdb_data_dir = Path("/app/gdb_data")
        gdb_data_dir.mkdir(exist_ok=True)
        
        gdb_found = None
        is_zip = len(files) == 1 and files[0].filename.endswith('.zip')
        
        update_progress("cargando", 10, "Cargando archivos GDB...")
        
        if is_zip:
            # Proceso ZIP tradicional
            file = files[0]
            temp_zip = UPLOAD_DIR / f"temp_gdb_{uuid.uuid4()}.zip"
            with open(temp_zip, 'wb') as f:
                content = await file.read()
                f.write(content)
            
            update_progress("extrayendo", 15, "Extrayendo archivo ZIP...")
            
            # PRIMERO: Identificar el nombre de la carpeta .gdb dentro del ZIP
            gdb_name_in_zip = None
            with zipfile.ZipFile(temp_zip, 'r') as zip_ref:
                # Buscar la carpeta .gdb en el contenido del ZIP
                for name in zip_ref.namelist():
                    if '.gdb/' in name or '.gdb\\' in name:
                        # Extraer nombre de carpeta GDB
                        parts = name.replace('\\', '/').split('/')
                        for part in parts:
                            if part.endswith('.gdb'):
                                gdb_name_in_zip = part
                                break
                        if gdb_name_in_zip:
                            break
                
                logger.info(f"GDB en ZIP detectado: {gdb_name_in_zip}")
                zip_ref.extractall(gdb_data_dir)
            
            temp_zip.unlink()
            
            # Buscar ESPECÍFICAMENTE la carpeta .gdb que estaba en el ZIP
            if gdb_name_in_zip:
                # Buscar directamente la carpeta con ese nombre
                potential_path = gdb_data_dir / gdb_name_in_zip
                if potential_path.exists() and potential_path.is_dir():
                    gdb_found = potential_path
                    logger.info(f"GDB encontrado directamente: {gdb_found}")
                else:
                    # Buscar en subdirectorios (el ZIP podría tener carpeta contenedora)
                    for item in gdb_data_dir.iterdir():
                        if item.is_dir():
                            subpath = item / gdb_name_in_zip
                            if subpath.exists() and subpath.is_dir():
                                gdb_found = subpath
                                logger.info(f"GDB encontrado en subdirectorio: {gdb_found}")
                                break
            
            # Fallback: buscar cualquier .gdb si no se pudo identificar del ZIP
            if not gdb_found:
                logger.warning("No se pudo identificar GDB del ZIP, buscando cualquier .gdb...")
                for item in gdb_data_dir.iterdir():
                    if item.suffix == '.gdb' and item.is_dir():
                        gdb_found = item
                        break
                
                if not gdb_found:
                    for item in gdb_data_dir.iterdir():
                        if item.is_dir():
                            for subitem in item.iterdir():
                                if subitem.suffix == '.gdb' and subitem.is_dir():
                                    gdb_found = subitem
                                    break
        else:
            # Proceso para archivos de carpeta GDB (múltiples archivos)
            # Determinar el nombre de la carpeta .gdb desde los archivos
            gdb_folder_name = None
            for file in files:
                # Los archivos vienen con path relativo como "54003.gdb/archivo.ext"
                parts = file.filename.split('/')
                if len(parts) > 0:
                    for part in parts:
                        if part.endswith('.gdb'):
                            gdb_folder_name = part
                            break
                if gdb_folder_name:
                    break
            
            if not gdb_folder_name:
                # Intentar extraer del nombre del archivo
                for file in files:
                    if '.gdb' in file.filename:
                        idx = file.filename.find('.gdb')
                        start = file.filename.rfind('/', 0, idx)
                        gdb_folder_name = file.filename[start+1:idx+4]
                        break
            
            if not gdb_folder_name:
                gdb_folder_name = f"{municipio or 'uploaded'}.gdb"
            
            gdb_found = gdb_data_dir / gdb_folder_name
            gdb_found.mkdir(exist_ok=True)
            
            # Guardar todos los archivos
            for file in files:
                # Extraer solo el nombre del archivo (sin la ruta de carpeta GDB)
                filename = file.filename
                if '/' in filename:
                    filename = filename.split('/')[-1]
                elif '\\' in filename:
                    filename = filename.split('\\')[-1]
                
                file_path = gdb_found / filename
                content = await file.read()
                with open(file_path, 'wb') as f:
                    f.write(content)
        
        if not gdb_found or not gdb_found.exists():
            raise HTTPException(status_code=400, detail="No se pudo crear/encontrar el archivo .gdb")
        
        # Determinar código de municipio desde el nombre del GDB
        gdb_name = gdb_found.stem  # ej: "54003"
        
        update_progress("identificando", 20, f"GDB identificado: {gdb_name}")
        
        # Mapeo de códigos a nombres de municipio
        CODIGO_TO_MUNICIPIO = {
            '54003': 'Ábrego',
            '54109': 'Bucarasica', 
            '54128': 'Cáchira',
            '54206': 'Convención',
            '54245': 'El Carmen',
            '54250': 'El Tarra',
            '54344': 'Hacarí',
            '54398': 'La Playa',
            '54670': 'San Calixto',
            '54720': 'Sardinata',
            '54800': 'Teorama',
            '20614': 'Río de Oro',
        }
        
        # Intentar detectar municipio desde el nombre del archivo primero
        municipio_nombre_inicial = municipio or CODIGO_TO_MUNICIPIO.get(gdb_name, None)
        
        update_progress("leyendo", 25, f"Leyendo capas de {gdb_name}...")
        
        # Leer capas del GDB para obtener estadísticas y relacionar con predios
        stats = {"rurales": 0, "urbanos": 0, "relacionados": 0}
        codigos_gdb = set()
        municipio_detectado_desde_codigos = None
        
        try:
            # Primero listar todas las capas disponibles para diagnóstico
            available_layers = []
            try:
                import pyogrio
                layers_info = pyogrio.list_layers(str(gdb_found))
                available_layers = [layer[0] for layer in layers_info]
                logger.info(f"GDB {gdb_name}: Capas disponibles: {available_layers}")
                update_progress("analizando", 28, f"Capas encontradas: {', '.join(available_layers[:5])}...")
            except Exception as e:
                logger.warning(f"No se pudo listar capas: {e}")
            
            # Intentar leer LIMITEMUNICIPIO para crear el límite municipal
            limite_municipal = None
            for limite_layer in ['LIMITEMUNICIPIO', 'LimiteMunicipio', 'limite_municipio', 'LIMITE_MUNICIPIO']:
                if limite_layer in available_layers:
                    try:
                        gdf_limite = gpd.read_file(str(gdb_found), layer=limite_layer)
                        if len(gdf_limite) > 0:
                            # Get transformer based on GDF's CRS
                            project = get_transformer_for_gdf(gdf_limite)
                            logger.info(f"GDB {gdb_name}: CRS del límite: {gdf_limite.crs}")
                            
                            # Guardar límite municipal (usar nombre temporal hasta detectar desde códigos)
                            temp_municipio_name = municipio_nombre_inicial or gdb_name
                            for idx, row in gdf_limite.iterrows():
                                if row.geometry:
                                    geom_wgs84 = transform(project, row.geometry) if project else row.geometry
                                    limite_municipal = geom_wgs84.__geo_interface__
                                    # Guardar en colección de límites
                                    await db.limites_municipales.update_one(
                                        {"codigo": gdb_name},
                                        {"$set": {
                                            "municipio": temp_municipio_name,
                                            "codigo": gdb_name,
                                            "geometry": limite_municipal,
                                            "fuente": "gdb",
                                            "updated_at": datetime.now(timezone.utc).isoformat()
                                        }},
                                        upsert=True
                                    )
                                    logger.info(f"GDB {gdb_name}: Límite municipal guardado desde capa {limite_layer}")
                                    break
                            break
                    except Exception as e:
                        logger.warning(f"Error leyendo límite municipal: {e}")
            
            # Intentar diferentes nombres de capas rurales - PRIORIZAR capas con TERRENO
            update_progress("leyendo_rural", 30, "Leyendo capa rural...")
            # Lista ordenada por prioridad - TERRENO primero, evitar ZONA_HOMOGENEA
            rural_layers = ['R_TERRENO']  # SOLO nombre estándar
            
            # NO buscar dinámicamente - solo aceptar el nombre estándar
            gdf_rural = None
            rural_layer_found = None
            for rural_layer in rural_layers:
                try:
                    gdf_rural = gpd.read_file(str(gdb_found), layer=rural_layer)
                    if len(gdf_rural) > 0:
                        stats["rurales"] = len(gdf_rural)
                        rural_layer_found = rural_layer
                        logger.info(f"GDB {gdb_name}: Capa rural encontrada '{rural_layer}' con {len(gdf_rural)} registros")
                        update_progress("leyendo_rural", 35, f"Capa rural ({rural_layer}): {len(gdf_rural)} geometrías encontradas")
                        # Extraer códigos prediales
                        for col in ['CODIGO', 'codigo', 'CODIGO_PREDIAL', 'codigo_predial', 'COD_PREDIO']:
                            if col in gdf_rural.columns:
                                codigos_gdb.update(gdf_rural[col].dropna().astype(str).tolist())
                                break
                        break
                except Exception as layer_err:
                    continue
            
            if not rural_layer_found:
                logger.warning(f"GDB {gdb_name}: No se encontró capa rural. Capas disponibles: {available_layers}")
                update_progress("leyendo_rural", 35, "No se encontró capa rural en el GDB")
            
            update_progress("leyendo_urbano", 40, "Leyendo capa urbana...")
            gdf_urban = None
            urban_layers = ['U_TERRENO']  # SOLO nombre estándar
            
            urban_layer_found = None
            for urban_layer in urban_layers:
                try:
                    gdf_urban = gpd.read_file(str(gdb_found), layer=urban_layer)
                    if len(gdf_urban) > 0:
                        stats["urbanos"] = len(gdf_urban)
                        urban_layer_found = urban_layer
                        logger.info(f"GDB {gdb_name}: Capa urbana encontrada '{urban_layer}' con {len(gdf_urban)} registros")
                        update_progress("leyendo_urbano", 45, f"Capa urbana ({urban_layer}): {len(gdf_urban)} geometrías encontradas")
                        for col in ['CODIGO', 'codigo', 'CODIGO_PREDIAL', 'codigo_predial', 'COD_PREDIO']:
                            if col in gdf_urban.columns:
                                codigos_gdb.update(gdf_urban[col].dropna().astype(str).tolist())
                                break
                        break
                except:
                    continue
            
            if not urban_layer_found:
                logger.warning(f"GDB {gdb_name}: No se encontró capa urbana con TERRENO")
        except Exception as e:
            logger.warning(f"Error leyendo capas GDB: {e}")
        
        # === DETECCIÓN AUTOMÁTICA DEL MUNICIPIO DESDE LOS CÓDIGOS PREDIALES ===
        # Los códigos prediales tienen formato: DDMMMZZZ... donde DD=depto, MMM=municipio
        if codigos_gdb:
            codigo_municipio_detectado = None
            for codigo in codigos_gdb:
                if len(codigo) >= 5:
                    # Tomar los primeros 5 dígitos (departamento + municipio)
                    codigo_muni = codigo[:5]
                    if codigo_muni in CODIGO_TO_MUNICIPIO:
                        codigo_municipio_detectado = codigo_muni
                        municipio_detectado_desde_codigos = CODIGO_TO_MUNICIPIO[codigo_muni]
                        break
            
            if municipio_detectado_desde_codigos:
                logger.info(f"GDB: Municipio detectado desde códigos prediales: {municipio_detectado_desde_codigos} (código {codigo_municipio_detectado})")
                if municipio_nombre_inicial and municipio_nombre_inicial != municipio_detectado_desde_codigos:
                    logger.warning(f"GDB: Discrepancia - Nombre archivo: {municipio_nombre_inicial}, Códigos prediales: {municipio_detectado_desde_codigos}")
        
        # Usar el municipio detectado desde códigos si está disponible, sino el del nombre del archivo
        municipio_nombre = municipio_detectado_desde_codigos or municipio_nombre_inicial or gdb_name
        
        update_progress("guardando_geometrias", 50, f"Guardando {len(codigos_gdb)} geometrías de {municipio_nombre}...")
        
        # Guardar geometrías en colección para búsquedas posteriores
        geometrias_guardadas = 0
        
        # REEMPLAZAR COMPLETAMENTE: Limpiar TODAS las geometrías anteriores de este municipio
        deleted = await db.gdb_geometrias.delete_many({"municipio": municipio_nombre})
        logger.info(f"GDB {municipio_nombre}: Eliminadas {deleted.deleted_count} geometrías anteriores")
        update_progress("limpiando", 52, f"Reemplazando geometrías anteriores ({deleted.deleted_count} eliminadas)")
        
        # Guardar las geometrías con sus códigos
        # Inicializar diccionario de errores para el reporte de calidad
        errores_calidad = {
            'codigos_invalidos': [],
            'geometrias_rechazadas': [],
            'construcciones_huerfanas': [],
            'rurales_rechazados': 0,
            'urbanos_rechazados': 0
        }
        
        # Inicializar contadores ANTES de los try/except
        rurales_en_archivo = 0
        urbanos_en_archivo = 0
        rural_guardadas = 0
        urban_guardadas = 0
        
        try:
            # Rural - usar lista de capas específicas (SIN buscar dinámicamente para evitar ZONA_HOMOGENEA)
            
            # Usar la misma capa que se usó para leer, si se encontró
            rural_layers_to_save = ['R_TERRENO_1', 'R_TERRENO', 'TERRENO', 'R_Terreno', 'r_terreno', 'r_terreno_1', 'Terreno', 'terreno']
            
            # NO buscar dinámicamente capas que empiecen con R_ ya que pueden incluir ZONA_HOMOGENEA
            
            for rural_layer in rural_layers_to_save:
                try:
                    gdf_rural = gpd.read_file(str(gdb_found), layer=rural_layer)
                    if len(gdf_rural) == 0:
                        continue
                    
                    rurales_en_archivo = len(gdf_rural)
                    
                    # Get transformer based on this layer's CRS
                    project = get_transformer_for_gdf(gdf_rural)
                    logger.info(f"GDB {municipio_nombre}: CRS rural ({rural_layer}): {gdf_rural.crs}, Total registros: {len(gdf_rural)}")
                    
                    total_rural = len(gdf_rural)
                    for idx, row in gdf_rural.iterrows():
                        if idx % 500 == 0:
                            pct = 50 + int((idx / total_rural) * 15)
                            update_progress("guardando_rural", pct, f"Procesando geometrías rurales: {idx}/{total_rural}")
                        
                        codigo = None
                        for col in ['CODIGO', 'codigo', 'CODIGO_PREDIAL', 'codigo_predial', 'COD_PREDIO', 'CODIGO_PRED']:
                            if col in gdf_rural.columns and pd.notna(row.get(col)):
                                codigo = str(row[col]).strip()
                                break
                        
                        if not codigo:
                            errores_calidad['rurales_rechazados'] += 1
                            continue
                        
                        # Validar longitud del código (debe ser 30 dígitos)
                        if len(codigo) != 30:
                            errores_calidad['codigos_invalidos'].append({
                                'codigo': codigo,
                                'longitud': len(codigo),
                                'capa': rural_layer
                            })
                        
                        if not row.geometry:
                            errores_calidad['rurales_rechazados'] += 1
                            errores_calidad['geometrias_rechazadas'].append({
                                'codigo': codigo,
                                'razon': 'Geometría nula',
                                'capa': rural_layer
                            })
                            continue
                        
                        try:
                            geom_wgs84 = transform(project, row.geometry) if project else row.geometry
                            
                            # Validar que las coordenadas estén en Colombia
                            if not validate_colombia_coordinates(geom_wgs84):
                                errores_calidad['rurales_rechazados'] += 1
                                errores_calidad['geometrias_rechazadas'].append({
                                    'codigo': codigo,
                                    'razon': 'Coordenadas fuera de Colombia',
                                    'capa': rural_layer
                                })
                                logger.warning(f"Geometría fuera de Colombia descartada: {codigo}")
                                continue
                            
                            # Calcular área en m2
                            area_m2 = 0
                            try:
                                # El área en grados se convierte aproximadamente a m2
                                # Factor para Colombia (~7° latitud): 1 grado ≈ 111320 m
                                area_deg = geom_wgs84.area
                                area_m2 = round(area_deg * (111320 ** 2), 2)
                            except:
                                pass
                            
                            await db.gdb_geometrias.insert_one({
                                "codigo": codigo,
                                "tipo": "rural",
                                "tipo_zona": "rural",
                                "gdb_source": gdb_name,
                                "municipio": municipio_nombre,
                                "area_m2": area_m2,
                                "geometry": geom_wgs84.__geo_interface__
                            })
                            geometrias_guardadas += 1
                            rural_guardadas += 1
                        except Exception as geom_error:
                            errores_calidad['rurales_rechazados'] += 1
                            errores_calidad['geometrias_rechazadas'].append({
                                'codigo': codigo,
                                'razon': str(geom_error)[:50],
                                'capa': rural_layer
                            })
                            logger.warning(f"Error procesando geometría rural {codigo}: {geom_error}")
                    
                    logger.info(f"GDB {municipio_nombre}: Guardadas {rural_guardadas} geometrías rurales desde capa {rural_layer}")
                    break
                except Exception as layer_error:
                    logger.debug(f"Capa {rural_layer} no encontrada o error: {layer_error}")
                    continue
            
            update_progress("guardando_urbano", 65, "Procesando geometrías urbanas...")
            # Lista de capas urbanas de terreno - priorizar nombres específicos
            urban_layers_save = [
                'U_TERRENO', 'U_TERRENO_1',  # Prioridad: nombres estándar de TERRENO
                'U_Terreno', 'u_terreno', 'u_terreno_1',
                'TERRENO_U', 'terreno_u', 'Terreno_U',
                'U_PREDIO', 'U_Predio', 'u_predio'
            ]
            # NO agregar dinámicamente otras capas U_ ya que pueden ser BARRIO, MANZANA, etc.
            
            for urban_layer in urban_layers_save:
                try:
                    gdf_urban = gpd.read_file(str(gdb_found), layer=urban_layer)
                    if len(gdf_urban) == 0:
                        continue
                    
                    urbanos_en_archivo = len(gdf_urban)
                    
                    # Get transformer based on this layer's CRS
                    project = get_transformer_for_gdf(gdf_urban)
                    logger.info(f"GDB {municipio_nombre}: CRS urbano ({urban_layer}): {gdf_urban.crs}, Total registros: {len(gdf_urban)}")
                    
                    total_urban = len(gdf_urban)
                    for idx, row in gdf_urban.iterrows():
                        if idx % 500 == 0:
                            pct = 65 + int((idx / total_urban) * 10)
                            update_progress("guardando_urbano", pct, f"Procesando geometrías urbanas: {idx}/{total_urban}")
                        
                        codigo = None
                        for col in ['CODIGO', 'codigo', 'CODIGO_PREDIAL', 'codigo_predial', 'COD_PREDIO', 'CODIGO_PRED']:
                            if col in gdf_urban.columns and pd.notna(row.get(col)):
                                codigo = str(row[col]).strip()
                                break
                        
                        if not codigo:
                            errores_calidad['urbanos_rechazados'] += 1
                            continue
                        
                        # Validar longitud del código (debe ser 30 dígitos)
                        if len(codigo) != 30:
                            errores_calidad['codigos_invalidos'].append({
                                'codigo': codigo,
                                'longitud': len(codigo),
                                'capa': urban_layer
                            })
                        
                        if not row.geometry:
                            errores_calidad['urbanos_rechazados'] += 1
                            errores_calidad['geometrias_rechazadas'].append({
                                'codigo': codigo,
                                'razon': 'Geometría nula',
                                'capa': urban_layer
                            })
                            continue
                        
                        try:
                            geom_wgs84 = transform(project, row.geometry) if project else row.geometry
                            
                            # Validar que las coordenadas estén en Colombia
                            if not validate_colombia_coordinates(geom_wgs84):
                                errores_calidad['urbanos_rechazados'] += 1
                                errores_calidad['geometrias_rechazadas'].append({
                                    'codigo': codigo,
                                    'razon': 'Coordenadas fuera de Colombia',
                                    'capa': urban_layer
                                })
                                logger.warning(f"Geometría urbana fuera de Colombia descartada: {codigo}")
                                continue
                            
                            # Calcular área en m2
                            area_m2 = 0
                            try:
                                area_deg = geom_wgs84.area
                                area_m2 = round(area_deg * (111320 ** 2), 2)
                            except:
                                pass
                            
                            await db.gdb_geometrias.insert_one({
                                "codigo": codigo,
                                "tipo": "urbano",
                                "tipo_zona": "urbano",
                                "gdb_source": gdb_name,
                                "municipio": municipio_nombre,
                                "area_m2": area_m2,
                                "geometry": geom_wgs84.__geo_interface__
                            })
                            geometrias_guardadas += 1
                            urban_guardadas += 1
                        except Exception as geom_error:
                            errores_calidad['urbanos_rechazados'] += 1
                            errores_calidad['geometrias_rechazadas'].append({
                                'codigo': codigo,
                                'razon': str(geom_error)[:50],
                                'capa': urban_layer
                            })
                            logger.warning(f"Error procesando geometría urbana {codigo}: {geom_error}")
                    
                    logger.info(f"GDB {municipio_nombre}: Guardadas {urban_guardadas} geometrías urbanas desde capa {urban_layer}")
                    break
                except Exception as layer_error:
                    logger.debug(f"Capa {urban_layer} no encontrada o error: {layer_error}")
                    continue
        except Exception as e:
            logger.error(f"Error guardando geometrías: {e}")
        
        # Guardar estadísticas del archivo original
        stats['rurales_archivo'] = rurales_en_archivo
        stats['urbanos_archivo'] = urbanos_en_archivo
        
        # ===== PROCESAR CONSTRUCCIONES =====
        update_progress("leyendo_construcciones", 70, "Buscando capas de construcciones...")
        
        construcciones_guardadas = 0
        construcciones_rurales = 0
        construcciones_urbanas = 0
        # SOLO nombres estándar
        construcciones_layers = ['R_CONSTRUCCION', 'U_CONSTRUCCION']
        
        try:
            # Limpiar construcciones anteriores del municipio
            await db.gdb_construcciones.delete_many({"municipio": municipio_nombre})
            
            for const_layer in construcciones_layers:
                try:
                    gdf_const = gpd.read_file(str(gdb_found), layer=const_layer)
                    if len(gdf_const) == 0:
                        continue
                    
                    # Determinar tipo (rural/urbano) basado en nombre de capa
                    tipo_construccion = "rural" if const_layer.upper().startswith('R') else "urbano"
                    
                    project = get_transformer_for_gdf(gdf_const)
                    logger.info(f"GDB {municipio_nombre}: Capa construcciones ({const_layer}): {len(gdf_const)} registros")
                    update_progress("guardando_construcciones", 72, f"Procesando {len(gdf_const)} construcciones ({const_layer})...")
                    
                    for idx, row in gdf_const.iterrows():
                        codigo = None
                        for col in ['CODIGO', 'codigo', 'CODIGO_PREDIAL', 'codigo_predial', 'COD_PREDIO', 'CODIGO_PRED', 'CODIGO_TERRENO']:
                            if col in gdf_const.columns and pd.notna(row.get(col)):
                                codigo = str(row[col]).strip()
                                break
                        
                        if not codigo:
                            continue
                        
                        if not row.geometry:
                            errores_calidad['construcciones_huerfanas'].append({
                                'codigo': codigo,
                                'capa': const_layer,
                                'razon': 'Sin geometría'
                            })
                            continue
                        
                        try:
                            geom_wgs84 = transform(project, row.geometry) if project else row.geometry
                            
                            # Validar que las coordenadas estén en Colombia
                            if not validate_colombia_coordinates(geom_wgs84):
                                logger.warning(f"Construcción fuera de Colombia descartada: {codigo}")
                                continue
                            
                            area_m2 = round(geom_wgs84.area * (111320 ** 2), 2) if geom_wgs84.area else 0
                            
                            # Extraer atributos de construcción si existen
                            pisos = row.get('PISOS', row.get('pisos', row.get('NUM_PISOS', 1)))
                            tipo_const = row.get('TIPO_CONSTRUCCION', row.get('tipo_construccion', row.get('TIPO', '')))
                            
                            # El código del predio padre son los primeros 25 dígitos (sin la parte de construcción)
                            codigo_predio_padre = codigo[:25] + "00000" if len(codigo) >= 25 else codigo
                            
                            await db.gdb_construcciones.insert_one({
                                "codigo_construccion": codigo,  # Código completo de la construcción
                                "codigo_predio": codigo_predio_padre,  # Código del predio padre (25 dígitos + 00000)
                                "tipo_zona": tipo_construccion,
                                "gdb_source": gdb_name,
                                "municipio": municipio_nombre,
                                "area_m2": area_m2,
                                "pisos": int(pisos) if pisos and str(pisos).isdigit() else 1,
                                "tipo_construccion": str(tipo_const) if tipo_const else "",
                                "geometry": geom_wgs84.__geo_interface__
                            })
                            construcciones_guardadas += 1
                            
                            if tipo_construccion == "rural":
                                construcciones_rurales += 1
                            else:
                                construcciones_urbanas += 1
                                
                        except Exception as ce:
                            errores_calidad['construcciones_huerfanas'].append({
                                'codigo': codigo,
                                'capa': const_layer,
                                'razon': str(ce)[:30]
                            })
                    
                    logger.info(f"GDB {municipio_nombre}: Guardadas {construcciones_guardadas} construcciones desde {const_layer}")
                except Exception as layer_err:
                    logger.warning(f"Error leyendo capa {const_layer}: {layer_err}")
                    continue
            
            stats["construcciones"] = construcciones_guardadas
            stats["construcciones_rurales"] = construcciones_rurales
            stats["construcciones_urbanas"] = construcciones_urbanas
            if construcciones_guardadas > 0:
                update_progress("construcciones_ok", 74, f"Guardadas {construcciones_guardadas} construcciones")
        except Exception as e:
            logger.warning(f"Error procesando construcciones: {e}")
        
        update_progress("relacionando", 75, f"Relacionando {len(codigos_gdb)} códigos GDB con predios...")
        
        # Relacionar con predios existentes - matching mejorado
        if codigos_gdb:
            logger.info(f"GDB tiene {len(codigos_gdb)} códigos únicos. Intentando relacionar...")
            
            # Los códigos en GDB pueden ser de diferentes longitudes (17, 20, 22, 30 dígitos)
            # Necesitamos hacer matching flexible
            relacionados_total = 0
            
            # Crear un índice de códigos GDB por zona+sector (primeros 9 dígitos)
            codigos_gdb_por_zona = {}
            for codigo_gdb in codigos_gdb:
                if not codigo_gdb:
                    continue
                codigo_limpio = codigo_gdb.strip()
                if len(codigo_limpio) >= 9:
                    zona_key = codigo_limpio[:9]
                    if zona_key not in codigos_gdb_por_zona:
                        codigos_gdb_por_zona[zona_key] = []
                    codigos_gdb_por_zona[zona_key].append(codigo_limpio)
            
            logger.info(f"GDB tiene {len(codigos_gdb)} códigos únicos en {len(codigos_gdb_por_zona)} zonas")
            
            for codigo_gdb in codigos_gdb:
                if not codigo_gdb:
                    continue
                    
                codigo_gdb_limpio = codigo_gdb.strip()
                
                # Crear diferentes patrones de búsqueda
                # 1. Match exacto
                # 2. El código GDB es un prefijo del código en BD
                # 3. El código GDB está contenido en el código de BD
                result = await db.predios.update_many(
                    {
                        "$or": [
                            {"codigo_predial_nacional": codigo_gdb_limpio},
                            {"codigo_predial_nacional": {"$regex": f"^{codigo_gdb_limpio}"}},
                            {"codigo_homologado": codigo_gdb_limpio},
                        ],
                        "municipio": municipio_nombre
                    },
                    {"$set": {
                        "tiene_geometria": True, 
                        "gdb_source": gdb_name, 
                        "codigo_gdb": codigo_gdb_limpio,
                        "gdb_updated": datetime.now(timezone.utc).isoformat()
                    }}
                )
                relacionados_total += result.modified_count
            
            stats["relacionados"] = relacionados_total
            
            # Si no hubo matches suficientes, intentar matching avanzado
            # Esto es especialmente importante para códigos de 17 dígitos que no coinciden directamente
            if relacionados_total < len(codigos_gdb) * 0.5:  # Si menos del 50% coincidió
                update_progress("matching_avanzado", 80, f"Matches directos: {relacionados_total}. Intentando match avanzado...")
                logger.info(f"Solo {relacionados_total} matches directos. Iniciando matching avanzado por zona...")
                
                # Obtener todos los predios del municipio sin geometría
                predios_sin_geo = await db.predios.find(
                    {"municipio": municipio_nombre, "tiene_geometria": {"$ne": True}},
                    {"_id": 0, "codigo_predial_nacional": 1, "id": 1}
                ).to_list(100000)
                
                logger.info(f"Encontrados {len(predios_sin_geo)} predios sin geometría en {municipio_nombre}")
                
                matches_avanzados = 0
                predios_procesados = 0
                
                for predio in predios_sin_geo:
                    predios_procesados += 1
                    if predios_procesados % 5000 == 0:
                        pct = 80 + int((predios_procesados / len(predios_sin_geo)) * 15)
                        update_progress("matching_avanzado", pct, 
                            f"Match avanzado: {predios_procesados}/{len(predios_sin_geo)} ({matches_avanzados} encontrados)")
                    
                    codigo_bd = predio.get("codigo_predial_nacional", "")
                    if not codigo_bd or len(codigo_bd) < 9:
                        continue
                    
                    # Extraer zona+sector del predio
                    zona_predio = codigo_bd[:9]
                    
                    # Buscar si hay geometrías GDB para esta zona
                    if zona_predio in codigos_gdb_por_zona:
                        # Hay geometrías para esta zona - asignar la primera disponible
                        # TODO: Mejorar la lógica de match para ser más preciso
                        codigo_gdb_match = codigos_gdb_por_zona[zona_predio][0]
                        
                        # Verificar si este predio específico tiene su geometría
                        # Comparar los últimos dígitos del número de predio
                        mejor_match = None
                        for gdb_cod in codigos_gdb_por_zona[zona_predio]:
                            # Para códigos de 17 dígitos: los últimos 8 dígitos son el número de predio
                            # Para códigos de 30 dígitos: los dígitos 9-25 son vereda+predio
                            if len(gdb_cod) == 17:
                                # El número de predio en formato 17 dígitos (últimos 8)
                                num_gdb = gdb_cod[9:].lstrip('0') or '0'
                                # El número de predio en formato 30 dígitos (parte del campo vereda)
                                # Extraer solo el número de predio sin ceros leading
                                num_bd = codigo_bd[9:25].lstrip('0')[:len(num_gdb)] if len(codigo_bd) >= 25 else ''
                                
                                if num_gdb == num_bd:
                                    mejor_match = gdb_cod
                                    break
                            elif len(gdb_cod) == 30:
                                # Match directo de códigos de 30 dígitos
                                if gdb_cod == codigo_bd:
                                    mejor_match = gdb_cod
                                    break
                        
                        if mejor_match:
                            await db.predios.update_one(
                                {"id": predio["id"]},
                                {"$set": {
                                    "tiene_geometria": True,
                                    "gdb_source": gdb_name,
                                    "codigo_gdb": mejor_match,
                                    "gdb_updated": datetime.now(timezone.utc).isoformat()
                                }}
                            )
                            matches_avanzados += 1
                
                stats["relacionados"] = relacionados_total + matches_avanzados
                stats["matches_directos"] = relacionados_total
                stats["matches_avanzados"] = matches_avanzados
                logger.info(f"Matching avanzado completado: {matches_avanzados} adicionales")
        
        update_progress("finalizando", 95, f"Registrando carga... {stats['relacionados']} predios relacionados")
        
        stats["geometrias_guardadas"] = geometrias_guardadas
        stats["codigos_gdb_unicos"] = len(codigos_gdb)
        
        # Registrar carga mensual
        mes_actual = datetime.now().strftime("%Y-%m")
        await db.gdb_cargas.update_one(
            {"mes": mes_actual, "municipio": municipio_nombre},
            {"$set": {
                "id": str(uuid.uuid4()),
                "mes": mes_actual,
                "municipio": municipio_nombre,
                "gdb_file": gdb_name,
                "uploaded_by": current_user['id'],
                "uploaded_by_name": current_user['full_name'],
                "fecha": datetime.now(timezone.utc).isoformat(),
                "predios_rurales": stats["rurales"],
                "predios_urbanos": stats["urbanos"],
                "predios_relacionados": stats["relacionados"]
            }},
            upsert=True
        )
        
        # Notificar a coordinadores que se completó la carga
        coordinadores = await db.users.find(
            {"role": {"$in": [UserRole.COORDINADOR, UserRole.ADMINISTRADOR]}},
            {"_id": 0, "id": 1, "full_name": 1}
        ).to_list(20)
        
        for coord in coordinadores:
            await crear_notificacion(
                usuario_id=coord['id'],
                titulo=f"Base Gráfica Cargada - {municipio_nombre}",
                mensaje=f"{current_user['full_name']} ha cargado la base gráfica de {municipio_nombre} para {mes_actual}. Total geometrías: {stats['rurales'] + stats['urbanos']}, predios relacionados: {stats['relacionados']}",
                tipo="success",
                enviar_email=False  # No enviar correo para cargas de GDB
            )
        
        update_progress("completado", 100, f"¡Completado! {stats['relacionados']} predios relacionados de {stats['rurales'] + stats['urbanos']} geometrías GDB")
        
        # Limpiar progreso después de 5 minutos
        # (en producción esto se haría con un scheduler)
        
        # Calcular calidad - basado en geometrías guardadas vs leídas
        total_archivo = rurales_en_archivo + urbanos_en_archivo
        total_cargadas = rural_guardadas + urban_guardadas
        
        # CALIDAD = Porcentaje de predios R1/R2 del municipio que ahora tienen cartografía
        # Contar predios R1/R2 del municipio que NO tenían cartografía antes
        predios_municipio = await db.predios.count_documents({"municipio": municipio_nombre})
        
        # Contar predios que ahora tienen geometría (match exitoso)
        predios_con_cartografia = stats.get("relacionados", 0)
        
        # Calcular calidad basada en cobertura de predios
        if predios_municipio > 0:
            calidad_pct = min(100.0, (predios_con_cartografia / predios_municipio * 100))
        else:
            # Si no hay predios en BD, usar el cálculo de geometrías guardadas vs archivo
            total_archivo = rurales_en_archivo + urbanos_en_archivo
            total_cargadas = rural_guardadas + urban_guardadas
            calidad_pct = min(100.0, (total_cargadas / total_archivo * 100)) if total_archivo > 0 else 100.0
        
        logger.info(f"GDB {municipio_nombre}: Calidad={calidad_pct:.1f}% (predios BD:{predios_municipio}, con cartografía:{predios_con_cartografia})")
        
        # Siempre generar reporte PDF para tener registro de la carga
        reporte_path = None
        tiene_errores = (
            len(errores_calidad['codigos_invalidos']) > 0 or
            len(errores_calidad['geometrias_rechazadas']) > 0 or
            len(errores_calidad['construcciones_huerfanas']) > 0 or
            errores_calidad['rurales_rechazados'] > 0 or
            errores_calidad['urbanos_rechazados'] > 0
        )
        
        # Siempre generar reporte PDF para tener registro de la carga
        try:
            reporte_path = await generar_reporte_calidad_gdb(
                municipio=municipio_nombre,
                fecha_carga=datetime.now().strftime("%Y-%m-%d %H:%M"),
                usuario=current_user['full_name'],
                stats={
                    **stats,
                    'rurales_archivo': rurales_en_archivo,
                    'urbanos_archivo': urbanos_en_archivo,
                    'rurales_guardadas': rural_guardadas,
                    'urbanos_guardadas': urban_guardadas,
                    'predios_municipio': predios_municipio,
                    'predios_con_cartografia': predios_con_cartografia,
                    'calidad_pct': calidad_pct
                },
                errores=errores_calidad
            )
            logger.info(f"Reporte de calidad generado: {reporte_path}")
            
            # Notificar a coordinadores si hay errores significativos
            if calidad_pct < 80 or len(errores_calidad['codigos_invalidos']) > 10:
                coordinadores = await db.users.find(
                    {"role": {"$in": [UserRole.COORDINADOR, UserRole.ADMINISTRADOR]}},
                    {"_id": 0, "id": 1, "full_name": 1}
                ).to_list(100)
                
                for coord in coordinadores:
                    await crear_notificacion(
                        usuario_id=coord['id'],
                        titulo=f"⚠️ Reporte de Calidad GDB - {municipio_nombre}",
                        mensaje=f"La carga de GDB de {municipio_nombre} tiene problemas de calidad ({calidad_pct:.1f}%). "
                               f"Códigos inválidos: {len(errores_calidad['codigos_invalidos'])}, "
                               f"Geometrías rechazadas: {len(errores_calidad['geometrias_rechazadas'])}. "
                               f"Revisar reporte PDF.",
                        tipo="warning",
                        enviar_email=False
                    )
        except Exception as report_err:
            logger.error(f"Error generando reporte de calidad: {report_err}")
        
        return {
            "message": f"Base gráfica de {municipio_nombre} actualizada exitosamente",
            "municipio": municipio_nombre,
            "gdb_file": gdb_name,
            "upload_id": upload_id,
            "predios_rurales": rural_guardadas,
            "predios_urbanos": urban_guardadas,
            "total_geometrias_gdb": rural_guardadas + urban_guardadas,
            "codigos_unicos_gdb": len(codigos_gdb),
            "geometrias_guardadas": rural_guardadas + urban_guardadas,
            "predios_relacionados": stats["relacionados"],
            "metodo_match": stats.get("metodo_match", "directo"),
            # Campos de calidad
            "calidad": {
                "porcentaje": round(calidad_pct, 1),
                "rurales_archivo": rurales_en_archivo,
                "urbanos_archivo": urbanos_en_archivo,
                "rurales_guardadas": rural_guardadas,
                "urbanos_guardadas": urban_guardadas,
                "codigos_invalidos": len(errores_calidad['codigos_invalidos']),
                "geometrias_rechazadas": len(errores_calidad['geometrias_rechazadas']),
                "construcciones_huerfanas": len(errores_calidad['construcciones_huerfanas']),
                "reporte_pdf": reporte_path.split('/')[-1] if reporte_path else None
            },
            "construcciones": {
                "total": stats.get('construcciones', 0),
                "rurales": stats.get('construcciones_rurales', 0),
                "urbanas": stats.get('construcciones_urbanas', 0)
            }
        }
        
    except zipfile.BadZipFile:
        update_progress("error", 0, "El archivo ZIP no es válido")
        raise HTTPException(status_code=400, detail="El archivo ZIP no es válido")
    except Exception as e:
        update_progress("error", 0, f"Error: {str(e)}")
        logger.error(f"Error uploading GDB: {e}")
        raise HTTPException(status_code=500, detail=f"Error al procesar el archivo: {str(e)}")


# ===== FUNCIÓN PARA GENERAR REPORTE PDF DE CALIDAD GDB =====
async def generar_reporte_calidad_gdb(
    municipio: str,
    fecha_carga: str,
    usuario: str,
    stats: dict,
    errores: dict
) -> str:
    """
    Genera un PDF con el reporte de calidad de la carga GDB.
    Retorna el path del archivo generado.
    """
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    
    # Crear directorio si no existe
    reports_dir = Path("/app/reports/gdb_calidad")
    reports_dir.mkdir(parents=True, exist_ok=True)
    
    # Nombre del archivo
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"calidad_gdb_{municipio.replace(' ', '_')}_{timestamp}.pdf"
    filepath = reports_dir / filename
    
    # Crear documento
    doc = SimpleDocTemplate(str(filepath), pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
    styles = getSampleStyleSheet()
    elements = []
    
    # Título
    title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], fontSize=16, textColor=colors.HexColor('#1e3a5f'), spaceAfter=20)
    elements.append(Paragraph(f"Reporte de Calidad GDB - {municipio}", title_style))
    elements.append(Paragraph(f"Fecha de carga: {fecha_carga}", styles['Normal']))
    elements.append(Paragraph(f"Usuario: {usuario}", styles['Normal']))
    elements.append(Spacer(1, 20))
    
    # Resumen estadístico
    elements.append(Paragraph("📊 Resumen de Carga", styles['Heading2']))
    
    resumen_data = [
        ["Concepto", "Rural", "Urbano", "Total"],
        ["Geometrías en archivo GDB", str(stats.get('rurales_archivo', 0)), str(stats.get('urbanos_archivo', 0)), str(stats.get('rurales_archivo', 0) + stats.get('urbanos_archivo', 0))],
        ["Geometrías cargadas", str(stats.get('rurales_guardadas', stats.get('rurales', 0))), str(stats.get('urbanos_guardadas', stats.get('urbanos', 0))), str(stats.get('rurales_guardadas', stats.get('rurales', 0)) + stats.get('urbanos_guardadas', stats.get('urbanos', 0)))],
        ["Geometrías rechazadas", str(errores.get('rurales_rechazados', 0)), str(errores.get('urbanos_rechazados', 0)), str(errores.get('rurales_rechazados', 0) + errores.get('urbanos_rechazados', 0))],
        ["Construcciones cargadas", str(stats.get('construcciones_rurales', 0)), str(stats.get('construcciones_urbanas', 0)), str(stats.get('construcciones', 0))],
    ]
    
    resumen_table = Table(resumen_data, colWidths=[2.5*inch, 1.2*inch, 1.2*inch, 1.2*inch])
    resumen_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a5f')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8f9fa')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f0f0f0')]),
    ]))
    elements.append(resumen_table)
    elements.append(Spacer(1, 15))
    
    # Tabla de vinculación con predios R1/R2
    elements.append(Paragraph("📋 Vinculación con Base de Datos R1/R2", styles['Heading2']))
    
    vinculacion_data = [
        ["Concepto", "Cantidad"],
        ["Predios R1/R2 en el municipio", f"{stats.get('predios_municipio', 0):,}"],
        ["Predios con cartografía (vinculados)", f"{stats.get('predios_con_cartografia', 0):,}"],
        ["Predios sin cartografía", f"{max(0, stats.get('predios_municipio', 0) - stats.get('predios_con_cartografia', 0)):,}"],
    ]
    
    vinc_table = Table(vinculacion_data, colWidths=[3.5*inch, 2*inch])
    vinc_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2e7d32')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#e8f5e9')]),
    ]))
    elements.append(vinc_table)
    elements.append(Spacer(1, 20))
    
    # Indicador de calidad - Basado en cobertura de predios R1/R2
    predios_municipio = stats.get('predios_municipio', 0)
    predios_con_cartografia = stats.get('predios_con_cartografia', 0)
    
    if predios_municipio > 0:
        calidad_pct = (predios_con_cartografia / predios_municipio * 100)
        calidad_base = f"Predios R1/R2 del municipio: {predios_municipio:,} | Con cartografía: {predios_con_cartografia:,}"
    else:
        # Fallback al cálculo de geometrías
        total_archivo = stats.get('rurales_archivo', 0) + stats.get('urbanos_archivo', 0)
        total_cargadas = stats.get('rurales', 0) + stats.get('urbanos', 0)
        calidad_pct = (total_cargadas / total_archivo * 100) if total_archivo > 0 else 0
        calidad_base = f"Geometrías en archivo: {total_archivo:,} | Cargadas: {total_cargadas:,}"
    
    if calidad_pct >= 95:
        calidad_color = colors.HexColor('#28a745')
        calidad_texto = "EXCELENTE"
    elif calidad_pct >= 80:
        calidad_color = colors.HexColor('#17a2b8')
        calidad_texto = "BUENA"
    elif calidad_pct >= 60:
        calidad_color = colors.HexColor('#ffc107')
        calidad_texto = "REGULAR"
    else:
        calidad_color = colors.HexColor('#dc3545')
        calidad_texto = "DEFICIENTE"
    
    calidad_style = ParagraphStyle('Calidad', parent=styles['Normal'], fontSize=12, textColor=calidad_color, fontName='Helvetica-Bold')
    elements.append(Paragraph(f"📈 Calidad de la carga: {calidad_pct:.1f}% - {calidad_texto}", calidad_style))
    elements.append(Paragraph(calidad_base, styles['Normal']))
    elements.append(Spacer(1, 20))
    
    # Errores de códigos (no 30 dígitos)
    codigos_invalidos = errores.get('codigos_invalidos', [])
    if codigos_invalidos:
        elements.append(Paragraph("⚠️ Códigos con formato incorrecto (no son 30 dígitos)", styles['Heading2']))
        elements.append(Paragraph(f"Total: {len(codigos_invalidos)} códigos requieren revisión del equipo SIG", styles['Normal']))
        elements.append(Spacer(1, 10))
        
        # Tabla de códigos inválidos (máximo 50)
        codigo_data = [["Código", "Longitud", "Capa"]]
        for item in codigos_invalidos[:50]:
            codigo_data.append([item.get('codigo', ''), str(item.get('longitud', '')), item.get('capa', '')])
        
        if len(codigos_invalidos) > 50:
            codigo_data.append([f"... y {len(codigos_invalidos) - 50} más", "", ""])
        
        codigo_table = Table(codigo_data, colWidths=[3*inch, 1*inch, 1.5*inch])
        codigo_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#dc3545')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        elements.append(codigo_table)
        elements.append(Spacer(1, 20))
    
    # Geometrías rechazadas (fuera de Colombia)
    geom_rechazadas = errores.get('geometrias_rechazadas', [])
    if geom_rechazadas:
        elements.append(Paragraph("🌍 Geometrías rechazadas (coordenadas fuera de Colombia)", styles['Heading2']))
        elements.append(Paragraph(f"Total: {len(geom_rechazadas)} geometrías", styles['Normal']))
        elements.append(Spacer(1, 10))
        
        geom_data = [["Código", "Razón", "Capa"]]
        for item in geom_rechazadas[:30]:
            geom_data.append([item.get('codigo', ''), item.get('razon', ''), item.get('capa', '')])
        
        if len(geom_rechazadas) > 30:
            geom_data.append([f"... y {len(geom_rechazadas) - 30} más", "", ""])
        
        geom_table = Table(geom_data, colWidths=[3*inch, 2*inch, 1.5*inch])
        geom_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#ffc107')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        elements.append(geom_table)
        elements.append(Spacer(1, 20))
    
    # Construcciones huérfanas
    const_huerfanas = errores.get('construcciones_huerfanas', [])
    if const_huerfanas:
        elements.append(Paragraph("🏗️ Construcciones sin predio padre", styles['Heading2']))
        elements.append(Paragraph(f"Total: {len(const_huerfanas)} construcciones no pudieron vincularse a un predio", styles['Normal']))
        elements.append(Spacer(1, 10))
        
        const_data = [["Código Construcción", "Capa"]]
        for item in const_huerfanas[:30]:
            const_data.append([item.get('codigo', ''), item.get('capa', '')])
        
        if len(const_huerfanas) > 30:
            const_data.append([f"... y {len(const_huerfanas) - 30} más", ""])
        
        const_table = Table(const_data, colWidths=[4*inch, 2*inch])
        const_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#17a2b8')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        elements.append(const_table)
    
    # Generar PDF
    doc.build(elements)
    
    return str(filepath)


@api_router.get("/gdb/reportes-calidad")
async def listar_reportes_calidad_gdb(current_user: dict = Depends(get_current_user)):
    """Lista los reportes de calidad GDB disponibles"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    reports_dir = Path("/app/reports/gdb_calidad")
    if not reports_dir.exists():
        return {"reportes": []}
    
    reportes = []
    for f in sorted(reports_dir.glob("*.pdf"), reverse=True):
        reportes.append({
            "nombre": f.name,
            "fecha": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
            "tamaño": f.stat().st_size,
            "url": f"/api/gdb/reportes-calidad/{f.name}"
        })
    
    return {"reportes": reportes[:50]}  # Últimos 50


@api_router.get("/gdb/reportes-calidad/{filename}")
async def descargar_reporte_calidad_gdb(filename: str, current_user: dict = Depends(get_current_user)):
    """Descarga un reporte de calidad GDB"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR, UserRole.GESTOR, UserRole.ATENCION_USUARIO]:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    filepath = Path("/app/reports/gdb_calidad") / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    
    return FileResponse(filepath, filename=filename, media_type="application/pdf")


@api_router.get("/gdb/cargas-mensuales")
async def get_cargas_mensuales_gdb(
    mes: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Obtiene las cargas de GDB del mes actual o especificado"""
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    mes_consulta = mes or datetime.now().strftime("%Y-%m")
    
    cargas = await db.gdb_cargas.find(
        {"mes": mes_consulta},
        {"_id": 0}
    ).to_list(50)
    
    return {
        "mes": mes_consulta,
        "total_cargas": len(cargas),
        "cargas": cargas
    }



@api_router.get("/gdb/verificar-carga-mes")
async def verificar_carga_gdb_mes(
    municipio: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Verifica si ya se cargó GDB este mes para un municipio o en general"""
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    mes_actual = datetime.now().strftime("%Y-%m")
    
    if municipio:
        # Verificar para un municipio específico
        carga = await db.gdb_cargas.find_one(
            {"mes": mes_actual, "municipio": municipio},
            {"_id": 0}
        )
        return {
            "mes": mes_actual,
            "municipio": municipio,
            "cargado": carga is not None,
            "detalle": carga
        }
    else:
        # Obtener resumen de todos los municipios
        cargas = await db.gdb_cargas.find(
            {"mes": mes_actual},
            {"_id": 0, "municipio": 1, "fecha": 1, "uploaded_by_name": 1}
        ).to_list(50)
        
        municipios_cargados = [c["municipio"] for c in cargas]
        
        # Obtener lista de todos los municipios activos
        todos_municipios = await db.predios.distinct("municipio")
        municipios_pendientes = [m for m in todos_municipios if m and m not in municipios_cargados]
        
        return {
            "mes": mes_actual,
            "total_cargados": len(municipios_cargados),
            "total_pendientes": len(municipios_pendientes),
            "municipios_cargados": cargas,
            "municipios_pendientes": municipios_pendientes
        }



@api_router.post("/gdb/revincular-predios")
async def revincular_predios_gdb(
    municipio: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Re-vincula las geometrías GDB existentes con predios usando matching mejorado.
    El código catastral colombiano tiene estructura:
    - Pos 1-5: Depto+Municipio (ej: 54670)
    - Pos 6-7: Zona (00=rural, 01=urbano, etc)
    - Pos 8-9: Sector
    - Pos 10-13: Manzana/Vereda
    - Pos 14-17: Terreno
    - Pos 18-21: Condición PH
    - Pos 22-30: Unidad predial
    
    La estrategia es hacer matching por los últimos segmentos (terreno, etc)
    ignorando zona y sector cuando no coinciden exactamente.
    """
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="Solo administradores y coordinadores pueden revincular")
    
    resultados = {"municipios_procesados": [], "total_vinculados": 0, "errores": []}
    
    # Obtener municipios a procesar
    if municipio:
        municipios = [municipio]
    else:
        municipios = await db.gdb_geometrias.distinct("municipio")
    
    for muni in municipios:
        try:
            # Obtener códigos GDB del municipio (el campo es 'codigo', no 'codigo_predial')
            codigos_gdb = await db.gdb_geometrias.distinct("codigo", {"municipio": muni})
            
            if not codigos_gdb:
                resultados["errores"].append(f"{muni}: Sin geometrías GDB")
                continue
            
            # Obtener predios del municipio sin geometría vinculada
            predios_sin_geo = await db.predios.find(
                {"municipio": muni, "$or": [{"tiene_geometria": {"$ne": True}}, {"tiene_geometria": False}]},
                {"_id": 0, "id": 1, "codigo_predial_nacional": 1}
            ).to_list(100000)
            
            vinculados_muni = 0
            
            # Crear índice de códigos GDB para búsqueda rápida
            # Extraer segmentos significativos del código GDB
            gdb_index = {}
            for codigo_gdb in codigos_gdb:
                if not codigo_gdb or len(codigo_gdb) < 17:
                    continue
                # Clave: municipio(5) + terreno(4, pos 14-17) + resto
                # Ignoramos zona(2) y sector(2) para matching más flexible
                depto_muni = codigo_gdb[:5]
                terreno_resto = codigo_gdb[13:] if len(codigo_gdb) > 13 else codigo_gdb[9:]
                clave = f"{depto_muni}_{terreno_resto}"
                gdb_index[clave] = codigo_gdb
                
                # También crear clave con los últimos 17 dígitos significativos
                if len(codigo_gdb) >= 22:
                    clave2 = codigo_gdb[5:22]  # Ignorar depto-muni, tomar hasta condicion PH
                    gdb_index[clave2] = codigo_gdb
            
            # Buscar coincidencias
            for predio in predios_sin_geo:
                codigo_bd = predio.get("codigo_predial_nacional", "")
                if not codigo_bd or len(codigo_bd) < 17:
                    continue
                
                codigo_gdb_match = None
                
                # Estrategia 1: Match exacto
                if codigo_bd in codigos_gdb:
                    codigo_gdb_match = codigo_bd
                
                # Estrategia 2: Match por segmentos (ignorando zona/sector)
                if not codigo_gdb_match:
                    depto_muni_bd = codigo_bd[:5]
                    terreno_resto_bd = codigo_bd[13:] if len(codigo_bd) > 13 else codigo_bd[9:]
                    clave_bd = f"{depto_muni_bd}_{terreno_resto_bd}"
                    if clave_bd in gdb_index:
                        codigo_gdb_match = gdb_index[clave_bd]
                
                # Estrategia 3: Match por segmento central
                if not codigo_gdb_match and len(codigo_bd) >= 22:
                    clave_bd2 = codigo_bd[5:22]
                    if clave_bd2 in gdb_index:
                        codigo_gdb_match = gdb_index[clave_bd2]
                
                # Si encontramos match, actualizar predio con área de GDB
                if codigo_gdb_match:
                    # Obtener área de la geometría GDB
                    area_gdb = 0
                    gdb_geo = await db.gdb_geometrias.find_one(
                        {"codigo": codigo_gdb_match},
                        {"_id": 0, "area_m2": 1}
                    )
                    if gdb_geo:
                        area_gdb = gdb_geo.get("area_m2", 0)
                    
                    await db.predios.update_one(
                        {"id": predio["id"]},
                        {"$set": {
                            "tiene_geometria": True,
                            "codigo_gdb": codigo_gdb_match,
                            "area_gdb": area_gdb,
                            "gdb_updated": datetime.now(timezone.utc).isoformat(),
                            "match_method": "revincular"
                        }}
                    )
                    vinculados_muni += 1
            
            resultados["municipios_procesados"].append({
                "municipio": muni,
                "geometrias_gdb": len(codigos_gdb),
                "predios_sin_geo": len(predios_sin_geo),
                "nuevos_vinculados": vinculados_muni
            })
            resultados["total_vinculados"] += vinculados_muni
            
        except Exception as e:
            resultados["errores"].append(f"{muni}: {str(e)}")
            logger.error(f"Error revinculando {muni}: {e}")
    
    return resultados



@api_router.post("/gdb/recalcular-areas")
async def recalcular_areas_gdb(
    municipio: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Recalcula las áreas de las geometrías GDB existentes y actualiza los predios relacionados.
    Útil para geometrías que se cargaron antes de implementar el cálculo de área.
    """
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="Solo administradores y coordinadores")
    
    from shapely.geometry import shape
    
    query = {}
    if municipio:
        query["municipio"] = municipio
    
    # Obtener geometrías sin área o con área 0
    geometrias = await db.gdb_geometrias.find(
        {**query, "$or": [{"area_m2": {"$exists": False}}, {"area_m2": 0}]},
        {"_id": 1, "codigo": 1, "geometry": 1}
    ).to_list(100000)
    
    actualizadas = 0
    errores = 0
    
    for geo in geometrias:
        try:
            geom_shape = shape(geo.get("geometry"))
            area_deg = geom_shape.area
            area_m2 = round(area_deg * (111320 ** 2), 2)
            
            await db.gdb_geometrias.update_one(
                {"_id": geo["_id"]},
                {"$set": {"area_m2": area_m2}}
            )
            
            # Actualizar predios que tengan este código GDB
            if geo.get("codigo"):
                await db.predios.update_many(
                    {"codigo_gdb": geo["codigo"]},
                    {"$set": {"area_gdb": area_m2}}
                )
            
            actualizadas += 1
        except Exception as e:
            errores += 1
    
    return {
        "mensaje": f"Áreas recalculadas",
        "geometrias_procesadas": len(geometrias),
        "actualizadas": actualizadas,
        "errores": errores
    }


@api_router.post("/gdb/sincronizar-areas-predios")
async def sincronizar_areas_predios(
    municipio: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Sincroniza las áreas de GDB con los predios que ya tienen geometría vinculada.
    """
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="Solo administradores y coordinadores")
    
    query = {"tiene_geometria": True, "codigo_gdb": {"$exists": True}}
    if municipio:
        query["municipio"] = municipio
    
    predios = await db.predios.find(
        query,
        {"_id": 0, "id": 1, "codigo_gdb": 1}
    ).to_list(200000)
    
    actualizados = 0
    
    for predio in predios:
        codigo_gdb = predio.get("codigo_gdb")
        if codigo_gdb:
            gdb_geo = await db.gdb_geometrias.find_one(
                {"codigo": codigo_gdb},
                {"_id": 0, "area_m2": 1}
            )
            if gdb_geo and gdb_geo.get("area_m2"):
                await db.predios.update_one(
                    {"id": predio["id"]},
                    {"$set": {"area_gdb": gdb_geo["area_m2"]}}
                )
                actualizados += 1
    
    return {
        "mensaje": "Áreas sincronizadas",
        "predios_procesados": len(predios),
        "actualizados": actualizados
    }



@api_router.get("/gdb/predios-con-geometria")
async def get_predios_con_geometria(
    municipio: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Obtiene estadísticas de predios que tienen geometría GDB asociada"""
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    query = {"tiene_geometria": True}
    if municipio:
        query["municipio"] = municipio
    
    total_con_geometria = await db.predios.count_documents(query)
    total_predios = await db.predios.count_documents({"municipio": municipio} if municipio else {})
    
    # Por municipio
    pipeline = [
        {"$match": {"tiene_geometria": True}},
        {"$group": {"_id": "$municipio", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    por_municipio = await db.predios.aggregate(pipeline).to_list(50)
    
    return {
        "total_con_geometria": total_con_geometria,
        "total_predios": total_predios,
        "porcentaje": round((total_con_geometria / total_predios * 100) if total_predios > 0 else 0, 2),
        "por_municipio": [{"municipio": r["_id"], "count": r["count"]} for r in por_municipio]
    }


@api_router.get("/gdb/geometrias-disponibles")
async def get_geometrias_disponibles(
    municipio: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Obtiene las geometrías GDB guardadas por municipio"""
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    pipeline = [
        {"$group": {
            "_id": {"municipio": "$municipio", "tipo": "$tipo"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id.municipio": 1}}
    ]
    
    if municipio:
        pipeline.insert(0, {"$match": {"municipio": municipio}})
    
    resultados = await db.gdb_geometrias.aggregate(pipeline).to_list(100)
    
    # Organizar por municipio
    por_municipio = {}
    for r in resultados:
        mun = r["_id"]["municipio"]
        tipo = r["_id"]["tipo"]
        if mun not in por_municipio:
            por_municipio[mun] = {"rural": 0, "urbano": 0, "total": 0}
        por_municipio[mun][tipo] = r["count"]
        por_municipio[mun]["total"] += r["count"]
    
    total_geometrias = await db.gdb_geometrias.count_documents({} if not municipio else {"municipio": municipio})
    
    return {
        "total_geometrias": total_geometrias,
        "por_municipio": por_municipio,
        "municipios_con_gdb": list(por_municipio.keys())
    }


@api_router.get("/gdb/buscar-geometria/{codigo}")
async def buscar_geometria_por_codigo(
    codigo: str,
    current_user: dict = Depends(get_current_user)
):
    """Busca geometría por código predial en la colección de geometrías guardadas"""
    if current_user['role'] == UserRole.USUARIO:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    # Buscar exacto primero
    geometria = await db.gdb_geometrias.find_one(
        {"codigo": codigo},
        {"_id": 0}
    )
    
    if not geometria:
        # Buscar por coincidencia parcial (código contenido)
        geometria = await db.gdb_geometrias.find_one(
            {"codigo": {"$regex": f".*{codigo}.*"}},
            {"_id": 0}
        )
    
    if not geometria:
        return {"encontrado": False, "mensaje": "No se encontró geometría para este código"}
    
    return {
        "encontrado": True,
        "codigo": geometria.get("codigo"),
        "tipo": geometria.get("tipo"),
        "municipio": geometria.get("municipio"),
        "geometry": geometria.get("geometry")
    }


@api_router.patch("/users/{user_id}/gdb-permission")
async def update_user_gdb_permission(
    user_id: str,
    puede_actualizar: bool,
    current_user: dict = Depends(get_current_user)
):
    """Allow coordinador to grant/revoke GDB update permission to a gestor"""
    # Only coordinador or admin can grant this permission
    if current_user['role'] not in [UserRole.COORDINADOR, UserRole.ADMINISTRADOR]:
        raise HTTPException(status_code=403, detail="Solo coordinadores pueden asignar este permiso")
    
    # Find user
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Only gestors can have this permission
    if user['role'] != UserRole.GESTOR:
        raise HTTPException(status_code=400, detail="Este permiso solo aplica para gestores")
    
    # Update permission
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"puede_actualizar_gdb": puede_actualizar}}
    )
    
    return {
        "message": f"Permiso {'otorgado' if puede_actualizar else 'revocado'} exitosamente",
        "user_id": user_id,
        "puede_actualizar_gdb": puede_actualizar
    }


# ===== ORTOIMÁGENES - SISTEMA DE CARGA Y TILES XYZ =====

ORTOIMAGENES_PATH = Path("/app/ortoimagenes/tiles")
ORTOIMAGENES_ORIGINALES_PATH = Path("/app/ortoimagenes/originales")

# Asegurar que los directorios existan
ORTOIMAGENES_PATH.mkdir(parents=True, exist_ok=True)
ORTOIMAGENES_ORIGINALES_PATH.mkdir(parents=True, exist_ok=True)

# Diccionario para tracking de progreso de procesamiento de ortoimágenes
ortoimagen_processing_progress = {}

@api_router.get("/ortoimagenes/disponibles")
async def listar_ortoimagenes(current_user: dict = Depends(get_current_user)):
    """Lista las ortoimágenes disponibles en el sistema (desde MongoDB)"""
    ortoimagenes = await db.ortoimagenes.find(
        {"activa": True},
        {"_id": 0}
    ).to_list(100)
    
    # Verificar que los tiles existan físicamente
    result = []
    for orto in ortoimagenes:
        tile_path = ORTOIMAGENES_PATH / orto["id"]
        if tile_path.exists():
            result.append(orto)
    
    return {"ortoimagenes": result}

@api_router.get("/ortoimagenes/todas")
async def listar_todas_ortoimagenes(current_user: dict = Depends(get_current_user)):
    """Lista todas las ortoimágenes (activas e inactivas) - solo para admin/coordinador"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="No tiene permiso")
    
    ortoimagenes = await db.ortoimagenes.find({}, {"_id": 0}).to_list(100)
    return {"ortoimagenes": ortoimagenes}

@api_router.post("/ortoimagenes/subir")
async def subir_ortoimagen(
    file: UploadFile = File(...),
    nombre: str = Form(...),
    municipio: str = Form(...),
    descripcion: str = Form(""),
    background_tasks: BackgroundTasks = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Sube una ortoimagen (GeoTIFF) y la procesa en tiles XYZ.
    Solo usuarios con permiso 'upload_gdb' pueden subir ortoimágenes.
    """
    # Verificar permisos: admin, coordinador, o gestor con permiso upload_gdb
    user_db = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
    permissions = user_db.get('permissions', [])
    
    has_permission = (
        current_user['role'] in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR] or
        (current_user['role'] == UserRole.GESTOR and 'upload_gdb' in permissions)
    )
    
    if not has_permission:
        raise HTTPException(status_code=403, detail="No tiene permiso para subir ortoimágenes")
    
    # Validar archivo
    if not file.filename.lower().endswith(('.tif', '.tiff', '.geotiff')):
        raise HTTPException(status_code=400, detail="Solo se aceptan archivos GeoTIFF (.tif, .tiff)")
    
    # Generar ID único para la ortoimagen
    orto_id = f"orto_{uuid.uuid4().hex[:8]}"
    
    # Guardar archivo original
    original_path = ORTOIMAGENES_ORIGINALES_PATH / f"{orto_id}.tif"
    
    try:
        # Guardar archivo en chunks para manejar archivos grandes
        with open(original_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):  # 1MB chunks
                buffer.write(chunk)
        
        file_size = original_path.stat().st_size
        logger.info(f"Ortoimagen guardada: {original_path} ({file_size / (1024*1024):.2f} MB)")
        
    except Exception as e:
        logger.error(f"Error guardando ortoimagen: {e}")
        raise HTTPException(status_code=500, detail=f"Error al guardar el archivo: {str(e)}")
    
    # Inicializar progreso
    ortoimagen_processing_progress[orto_id] = {
        "status": "subido",
        "progress": 10,
        "message": "Archivo recibido, iniciando procesamiento..."
    }
    
    # Crear registro en MongoDB
    orto_doc = {
        "id": orto_id,
        "nombre": nombre,
        "municipio": municipio,
        "descripcion": descripcion,
        "archivo_original": str(original_path),
        "activa": False,  # Se activa cuando termine el procesamiento
        "procesando": True,
        "zoom_min": 14,
        "zoom_max": 20,
        "bounds": None,  # Se llena después del procesamiento
        "fecha_subida": datetime.now(timezone.utc).isoformat(),
        "subido_por": current_user['id'],
        "subido_por_nombre": current_user['full_name']
    }
    
    await db.ortoimagenes.insert_one(orto_doc)
    
    # Procesar en background
    if background_tasks:
        background_tasks.add_task(procesar_ortoimagen_background, orto_id, str(original_path), nombre)
    else:
        # Si no hay background_tasks, procesar sincrónicamente
        await procesar_ortoimagen_background(orto_id, str(original_path), nombre)
    
    return {
        "message": "Ortoimagen recibida. El procesamiento de tiles puede tomar varios minutos.",
        "id": orto_id,
        "nombre": nombre
    }

async def procesar_ortoimagen_background(orto_id: str, tiff_path: str, nombre: str):
    """Procesa un GeoTIFF y genera tiles XYZ usando gdal2tiles"""
    import subprocess
    
    def update_progress(status: str, progress: int, message: str):
        ortoimagen_processing_progress[orto_id] = {
            "status": status,
            "progress": progress,
            "message": message
        }
    
    tiles_output_path = ORTOIMAGENES_PATH / orto_id
    
    try:
        update_progress("procesando", 20, "Leyendo información del archivo GeoTIFF...")
        
        # Obtener información del GeoTIFF con gdalinfo
        result = subprocess.run(
            ["gdalinfo", "-json", tiff_path],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode != 0:
            raise Exception(f"Error leyendo GeoTIFF: {result.stderr}")
        
        import json
        gdal_info = json.loads(result.stdout)
        
        # Extraer bounds
        bounds = None
        if "wgs84Extent" in gdal_info:
            coords = gdal_info["wgs84Extent"]["coordinates"][0]
            # coords es un polígono, extraer SW y NE
            lngs = [c[0] for c in coords]
            lats = [c[1] for c in coords]
            bounds = [[min(lngs), min(lats)], [max(lngs), max(lats)]]
        elif "cornerCoordinates" in gdal_info:
            cc = gdal_info["cornerCoordinates"]
            bounds = [
                [cc["lowerLeft"][0], cc["lowerLeft"][1]],
                [cc["upperRight"][0], cc["upperRight"][1]]
            ]
        
        update_progress("tiles", 30, "Generando tiles XYZ (esto puede tomar varios minutos)...")
        
        # Ejecutar gdal2tiles
        tiles_output_path.mkdir(parents=True, exist_ok=True)
        
        gdal_cmd = [
            "gdal2tiles.py",
            "-z", "14-20",  # Niveles de zoom
            "-w", "none",   # Sin archivo HTML
            "-r", "average",  # Método de remuestreo
            "--processes=2",  # Usar 2 procesos
            tiff_path,
            str(tiles_output_path)
        ]
        
        logger.info(f"Ejecutando: {' '.join(gdal_cmd)}")
        
        result = subprocess.run(
            gdal_cmd,
            capture_output=True,
            text=True,
            timeout=1800  # 30 minutos máximo
        )
        
        if result.returncode != 0:
            logger.error(f"gdal2tiles error: {result.stderr}")
            raise Exception(f"Error generando tiles: {result.stderr}")
        
        update_progress("verificando", 90, "Verificando tiles generados...")
        
        # Verificar que se generaron tiles
        tile_files = list(tiles_output_path.glob("**/*.png"))
        if len(tile_files) == 0:
            raise Exception("No se generaron tiles")
        
        # Leer bounds del tilemapresource.xml si existe
        tilemap_xml = tiles_output_path / "tilemapresource.xml"
        if tilemap_xml.exists():
            import xml.etree.ElementTree as ET
            tree = ET.parse(tilemap_xml)
            root = tree.getroot()
            bbox = root.find("BoundingBox")
            if bbox is not None:
                bounds = [
                    [float(bbox.get("minx")), float(bbox.get("miny"))],
                    [float(bbox.get("maxx")), float(bbox.get("maxy"))]
                ]
        
        # Determinar zoom min/max real
        zoom_levels = [int(d.name) for d in tiles_output_path.iterdir() if d.is_dir() and d.name.isdigit()]
        zoom_min = min(zoom_levels) if zoom_levels else 14
        zoom_max = max(zoom_levels) if zoom_levels else 20
        
        # Actualizar en MongoDB
        await db.ortoimagenes.update_one(
            {"id": orto_id},
            {"$set": {
                "activa": True,
                "procesando": False,
                "bounds": bounds,
                "zoom_min": zoom_min,
                "zoom_max": zoom_max,
                "total_tiles": len(tile_files),
                "fecha_procesado": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        update_progress("completado", 100, f"¡Completado! {len(tile_files)} tiles generados")
        logger.info(f"Ortoimagen {orto_id} procesada: {len(tile_files)} tiles, bounds={bounds}")
        
    except Exception as e:
        logger.error(f"Error procesando ortoimagen {orto_id}: {e}")
        update_progress("error", 0, f"Error: {str(e)}")
        
        # Marcar como error en MongoDB
        await db.ortoimagenes.update_one(
            {"id": orto_id},
            {"$set": {
                "procesando": False,
                "error": str(e)
            }}
        )

@api_router.get("/ortoimagenes/progreso/{orto_id}")
async def obtener_progreso_ortoimagen(orto_id: str, current_user: dict = Depends(get_current_user)):
    """Obtiene el progreso del procesamiento de una ortoimagen"""
    if orto_id in ortoimagen_processing_progress:
        return ortoimagen_processing_progress[orto_id]
    
    # Verificar en MongoDB
    orto = await db.ortoimagenes.find_one({"id": orto_id}, {"_id": 0})
    if not orto:
        raise HTTPException(status_code=404, detail="Ortoimagen no encontrada")
    
    if orto.get("procesando"):
        return {"status": "procesando", "progress": 50, "message": "Procesando..."}
    elif orto.get("activa"):
        return {"status": "completado", "progress": 100, "message": "Ortoimagen lista"}
    elif orto.get("error"):
        return {"status": "error", "progress": 0, "message": orto["error"]}
    else:
        return {"status": "pendiente", "progress": 0, "message": "En espera"}

@api_router.delete("/ortoimagenes/{orto_id}")
async def eliminar_ortoimagen(orto_id: str, current_user: dict = Depends(get_current_user)):
    """Elimina una ortoimagen y sus tiles"""
    if current_user['role'] not in [UserRole.ADMINISTRADOR, UserRole.COORDINADOR]:
        raise HTTPException(status_code=403, detail="No tiene permiso para eliminar ortoimágenes")
    
    orto = await db.ortoimagenes.find_one({"id": orto_id}, {"_id": 0})
    if not orto:
        raise HTTPException(status_code=404, detail="Ortoimagen no encontrada")
    
    # Eliminar tiles
    tiles_path = ORTOIMAGENES_PATH / orto_id
    if tiles_path.exists():
        import shutil
        shutil.rmtree(tiles_path)
    
    # Eliminar archivo original
    original_path = Path(orto.get("archivo_original", ""))
    if original_path.exists():
        original_path.unlink()
    
    # Eliminar de MongoDB
    await db.ortoimagenes.delete_one({"id": orto_id})
    
    return {"message": f"Ortoimagen '{orto['nombre']}' eliminada"}

@api_router.get("/ortoimagenes/tiles/{orto_id}/{z}/{x}/{y}.png")
async def servir_tile_ortoimagen(orto_id: str, z: int, x: int, y: int):
    """Sirve un tile específico de una ortoimagen"""
    # Verificar que la ortoimagen existe
    tile_base = ORTOIMAGENES_PATH / orto_id
    if not tile_base.exists():
        raise HTTPException(status_code=404, detail="Ortoimagen no encontrada")
    
    # gdal2tiles genera tiles en formato TMS (y invertida)
    # Convertir de XYZ a TMS: y_tms = 2^z - 1 - y
    y_tms = (2 ** z) - 1 - y
    
    tile_path = tile_base / str(z) / str(x) / f"{y_tms}.png"
    
    if not tile_path.exists():
        # Retornar tile transparente si no existe
        raise HTTPException(status_code=204)  # No content
    
    return FileResponse(
        tile_path, 
        media_type="image/png",
        headers={
            "Cache-Control": "public, max-age=86400",  # Cache 1 día
            "Access-Control-Allow-Origin": "*"
        }
    )


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
