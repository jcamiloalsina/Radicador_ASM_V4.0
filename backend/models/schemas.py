"""
Modelos Pydantic para el Sistema de Gestión Catastral
Asomunicipios - Asociación de Municipios del Catatumbo

Este archivo contiene todos los modelos de datos utilizados
para validación de requests y responses en la API.
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum


# ============================================================
# ENUMS
# ============================================================

class TipoDocumento(str, Enum):
    CEDULA = "C"
    EXTRANJERIA = "E"
    NIT = "N"
    TARJETA_IDENTIDAD = "T"
    PASAPORTE = "P"
    OTRO = "X"


class EstadoCivil(str, Enum):
    SOLTERO = "S"
    CASADO = "E"
    DIVORCIADO = "D"
    VIUDO = "V"
    UNION_LIBRE = "U"


class TipoPropietario(str, Enum):
    TITULAR = "titular"
    COPROPIETARIO = "copropietario"
    USUFRUCTUARIO = "usufructuario"
    POSEEDOR = "poseedor"
    REPRESENTANTE_LEGAL = "representante_legal"


class TipoPersona(str, Enum):
    NATURAL = "natural"
    JURIDICA = "juridica"
    SUCESION_ILIQUIDA = "sucesion_iliquida"


class RolUsuario(str, Enum):
    ADMINISTRADOR = "administrador"
    COORDINADOR = "coordinador"
    GESTOR = "gestor"
    VISOR = "visor"
    ATENCION_USUARIO = "atencion_usuario"
    EMPRESA = "empresa"
    CIUDADANO = "ciudadano"


class EstadoPeticion(str, Enum):
    RADICADO = "radicado"
    ASIGNADO = "asignado"
    EN_PROCESO = "en_proceso"
    REVISION = "revision"
    APROBADO = "aprobado"
    RECHAZADO = "rechazado"
    DEVUELTO = "devuelto"
    FINALIZADO = "finalizado"


class TipoMutacion(str, Enum):
    M1 = "M1"  # Cambio de propietario
    M2 = "M2"  # Englobe/Desenglobe


class SubtipoM2(str, Enum):
    ENGLOBE = "englobe"
    DESENGLOBE_TOTAL = "desenglobe_total"
    DESENGLOBE_PARCIAL = "desenglobe_parcial"


# ============================================================
# MODELOS BASE
# ============================================================

class PropietarioBase(BaseModel):
    """Modelo base para propietario de un predio"""
    nombre_propietario: str
    tipo_documento: Optional[str] = "C"
    numero_documento: Optional[str] = None
    estado_civil: Optional[str] = None
    direccion_propietario: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    
    # Campos extendidos para múltiples propietarios
    tipo_propietario: Optional[str] = "titular"
    porcentaje_propiedad: Optional[float] = 100.0
    tipo_persona: Optional[str] = "natural"


class ZonaTerreno(BaseModel):
    """Modelo para zona homogénea de terreno"""
    zona_fisica: Optional[str] = None
    zona_economica: Optional[str] = None
    area_terreno: Optional[float] = 0


class Construccion(BaseModel):
    """Modelo para construcción dentro de un predio"""
    id: Optional[str] = None
    piso: Optional[int] = 1
    habitaciones: Optional[int] = 0
    banos: Optional[int] = 0
    locales: Optional[int] = 0
    tipificacion: Optional[str] = None
    uso: Optional[str] = None
    puntaje: Optional[float] = 0
    area_construida: Optional[float] = 0


# ============================================================
# MODELOS DE AUTENTICACIÓN
# ============================================================

class LoginRequest(BaseModel):
    """Request para login"""
    email: str
    password: str


class LoginResponse(BaseModel):
    """Response de login exitoso"""
    token: str
    user: dict


class RegisterRequest(BaseModel):
    """Request para registro de usuario"""
    email: str
    password: str
    full_name: str
    role: Optional[str] = "gestor"
    telefono: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    """Request para recuperar contraseña"""
    email: str


class ResetPasswordRequest(BaseModel):
    """Request para cambiar contraseña"""
    token: str
    new_password: str


# ============================================================
# MODELOS DE USUARIO
# ============================================================

class UserCreate(BaseModel):
    """Modelo para crear usuario"""
    email: str
    password: str
    full_name: str
    role: str = "gestor"
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    municipios: Optional[List[str]] = []
    departamento: Optional[str] = None


class UserUpdate(BaseModel):
    """Modelo para actualizar usuario"""
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    municipios: Optional[List[str]] = None
    departamento: Optional[str] = None
    activo: Optional[bool] = None


class UserResponse(BaseModel):
    """Response con datos de usuario"""
    id: str
    email: str
    full_name: str
    role: str
    municipios: List[str] = []
    activo: bool = True


# ============================================================
# MODELOS DE PREDIO
# ============================================================

class PredioR1Create(BaseModel):
    """Modelo para crear predio con formato R1"""
    # Identificación
    codigo_predial_nacional: str = Field(..., min_length=30, max_length=30)
    codigo_homologado: Optional[str] = None
    
    # Ubicación
    municipio: str
    vigencia: Optional[int] = None
    direccion: Optional[str] = None
    comuna: Optional[str] = None
    
    # Características
    destino_economico: Optional[str] = None
    area_terreno: Optional[float] = 0
    area_construida: Optional[float] = 0
    avaluo: Optional[float] = 0
    
    # Propietario principal
    nombre_propietario: Optional[str] = None
    tipo_documento: Optional[str] = "C"
    numero_documento: Optional[str] = None
    estado_civil: Optional[str] = None
    
    # Matrícula
    matricula_inmobiliaria: Optional[str] = None
    
    # Propietarios adicionales
    propietarios: Optional[List[PropietarioBase]] = []


class PredioUpdate(BaseModel):
    """Modelo para actualizar predio"""
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
    
    # Campos extendidos para múltiples propietarios
    tipo_propietario: Optional[str] = None
    porcentaje_propiedad: Optional[float] = None
    tipo_persona: Optional[str] = None
    
    # R2 fields
    matricula_inmobiliaria: Optional[str] = None
    zonas_homogeneas: Optional[List[ZonaTerreno]] = None
    construcciones: Optional[List[Construccion]] = None
    
    # Propietarios
    propietarios: Optional[List[PropietarioBase]] = None


class PredioResponse(BaseModel):
    """Response con datos de predio"""
    id: str
    codigo_predial_nacional: str
    codigo_homologado: Optional[str] = None
    municipio: str
    vigencia: int
    direccion: Optional[str] = None
    destino_economico: Optional[str] = None
    area_terreno: float = 0
    area_construida: float = 0
    avaluo: float = 0
    matricula_inmobiliaria: Optional[str] = None
    propietarios: List[dict] = []
    tiene_geometria: bool = False


# ============================================================
# MODELOS DE PETICIÓN (PQRS)
# ============================================================

class SolicitanteInfo(BaseModel):
    """Información del solicitante de una petición"""
    nombre: str
    tipo_documento: Optional[str] = "C"
    numero_documento: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None


class PetitionCreate(BaseModel):
    """Modelo para crear petición"""
    tipo: str  # CERT, REC, ACT, MUT, etc.
    asunto: str
    descripcion: str
    municipio: str
    predio_relacionado: Optional[str] = None
    solicitante: SolicitanteInfo


class PetitionUpdate(BaseModel):
    """Modelo para actualizar petición"""
    estado: Optional[str] = None
    observaciones: Optional[str] = None
    respuesta: Optional[str] = None


class PetitionAssign(BaseModel):
    """Modelo para asignar gestor a petición"""
    gestor_ids: List[str]


# ============================================================
# MODELOS DE MUTACIÓN
# ============================================================

class PredioCancelado(BaseModel):
    """Predio a cancelar en una mutación M2"""
    id: Optional[str] = None
    npn: Optional[str] = None
    codigo_predial_nacional: Optional[str] = None
    nombre_propietario: Optional[str] = None
    area_terreno: Optional[float] = None
    tipo_cancelacion: str = "total"  # total o parcial
    nueva_area_terreno: Optional[float] = None


class PredioInscrito(BaseModel):
    """Predio a inscribir en una mutación M2"""
    codigo_predial_nacional: str
    codigo_homologado: Optional[str] = None
    area_terreno: float
    area_construida: Optional[float] = 0
    destino_economico: Optional[str] = None
    direccion: Optional[str] = None
    matricula_inmobiliaria: Optional[str] = None
    propietarios: Optional[List[PropietarioBase]] = []


class ResolucionM1Request(BaseModel):
    """Request para generar resolución M1"""
    predio_id: str
    radicado: Optional[str] = None
    solicitante: SolicitanteInfo
    propietario_anterior: PropietarioBase
    propietario_nuevo: PropietarioBase


class ResolucionM2Request(BaseModel):
    """Request para generar resolución M2"""
    municipio: str
    subtipo: str  # englobe, desenglobe_total, desenglobe_parcial
    radicado: Optional[str] = None
    solicitante: SolicitanteInfo
    predios_cancelados: List[PredioCancelado]
    predios_inscritos: List[PredioInscrito]


class SolicitudMutacionCreate(BaseModel):
    """Modelo para crear solicitud de mutación que requiere aprobación"""
    tipo: str  # M1, M2
    subtipo: Optional[str] = None
    municipio: str
    radicado: Optional[str] = None
    predios_cancelados: Optional[List[dict]] = []
    predios_inscritos: Optional[List[dict]] = []
    observaciones: Optional[str] = None


class SolicitudMutacionAccion(BaseModel):
    """Modelo para acción sobre solicitud de mutación"""
    accion: str  # aprobar, rechazar, devolver
    observaciones: Optional[str] = None


# ============================================================
# MODELOS DE CAMBIOS Y APROBACIONES
# ============================================================

class CambioPropuesto(BaseModel):
    """Modelo para proponer cambio a un predio"""
    predio_id: str
    tipo_cambio: str  # modificacion, correccion, actualizacion
    datos_propuestos: dict
    radicado_numero: Optional[str] = None
    observaciones: Optional[str] = None


class AccionCambio(BaseModel):
    """Modelo para aprobar/rechazar cambio"""
    accion: str  # aprobar, rechazar, devolver
    observaciones: Optional[str] = None


# ============================================================
# MODELOS DE NOTIFICACIÓN
# ============================================================

class NotificacionCreate(BaseModel):
    """Modelo para crear notificación"""
    user_id: str
    titulo: str
    mensaje: str
    tipo: Optional[str] = "info"  # info, warning, success, error
    enlace: Optional[str] = None


# ============================================================
# MODELOS DE RESPUESTA GENÉRICOS
# ============================================================

class SuccessResponse(BaseModel):
    """Response genérico de éxito"""
    success: bool = True
    message: Optional[str] = None
    data: Optional[Any] = None


class ErrorResponse(BaseModel):
    """Response genérico de error"""
    success: bool = False
    error: str
    detail: Optional[str] = None


class PaginatedResponse(BaseModel):
    """Response paginado"""
    total: int
    page: int
    page_size: int
    items: List[Any]
