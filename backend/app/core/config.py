"""
Configuración central del sistema
Variables de entorno, constantes y catálogos
"""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent.parent
load_dotenv(ROOT_DIR / '.env')


class Settings:
    """Configuración de la aplicación desde variables de entorno"""
    
    # MongoDB
    MONGO_URL: str = os.environ['MONGO_URL']
    DB_NAME: str = os.environ['DB_NAME']
    
    # JWT
    JWT_SECRET: str = os.environ.get('JWT_SECRET', '')
    JWT_ALGORITHM: str = 'HS256'
    JWT_EXPIRATION_HOURS: int = 24
    
    # SMTP
    SMTP_HOST: str = os.environ.get('SMTP_HOST', 'smtp.office365.com')
    SMTP_PORT: int = int(os.environ.get('SMTP_PORT', '587'))
    SMTP_USER: str = os.environ.get('SMTP_USER', '')
    SMTP_PASSWORD: str = os.environ.get('SMTP_PASSWORD', '')
    SMTP_FROM: str = os.environ.get('SMTP_FROM', SMTP_USER)
    
    # Verificación de certificados
    VERIFICACION_URL: str = os.environ.get('VERIFICACION_URL', 'https://certificados.asomunicipios.gov.co')
    
    # Directorios
    UPLOAD_DIR: Path = Path('/app/uploads')
    STATIC_DIR: Path = ROOT_DIR / 'static'
    BACKUP_DIR: Path = STATIC_DIR / 'backups'
    
    def __init__(self):
        # Crear directorios necesarios
        self.UPLOAD_DIR.mkdir(exist_ok=True)
        self.STATIC_DIR.mkdir(exist_ok=True)
        self.BACKUP_DIR.mkdir(exist_ok=True)
        
        # Validar JWT_SECRET
        if not self.JWT_SECRET:
            import uuid
            import logging
            logging.warning("⚠️ SEGURIDAD: JWT_SECRET no configurado. Usando valor por defecto INSEGURO.")
            self.JWT_SECRET = 'INSECURE-DEFAULT-CHANGE-IN-PRODUCTION-' + str(uuid.uuid4())


settings = Settings()


# ============================================================
# CATÁLOGOS Y CONSTANTES
# ============================================================

# Catálogo de municipios con código catastral nacional (DIVIPOLA)
MUNICIPIOS_DIVIPOLA = {
    "Ábrego": {"departamento": "54", "municipio": "003", "codigo": "54003"},
    "Bucarasica": {"departamento": "54", "municipio": "109", "codigo": "54109"},
    "Cáchira": {"departamento": "54", "municipio": "128", "codigo": "54128"},
    "Convención": {"departamento": "54", "municipio": "206", "codigo": "54206"},
    "El Carmen": {"departamento": "54", "municipio": "245", "codigo": "54245"},
    "El Tarra": {"departamento": "54", "municipio": "250", "codigo": "54250"},
    "Hacarí": {"departamento": "54", "municipio": "344", "codigo": "54344"},
    "La Playa": {"departamento": "54", "municipio": "398", "codigo": "54398"},
    "Ocaña": {"departamento": "54", "municipio": "498", "codigo": "54498"},
    "Río de Oro": {"departamento": "47", "municipio": "545", "codigo": "20614"},
    "San Calixto": {"departamento": "54", "municipio": "670", "codigo": "54670"},
    "Sardinata": {"departamento": "54", "municipio": "720", "codigo": "54720"},
    "Teorama": {"departamento": "54", "municipio": "800", "codigo": "54800"}
}

# Mapa inverso por código
MUNICIPIOS_POR_CODIGO = {v["codigo"]: {"nombre": k, **v} for k, v in MUNICIPIOS_DIVIPOLA.items()}

# Catálogo de destino económico
DESTINO_ECONOMICO = {
    "A": "Habitacional",
    "B": "Industrial",
    "C": "Comercial",
    "D": "Agropecuario",
    "E": "Minero",
    "F": "Cultural",
    "G": "Recreacional",
    "H": "Salubridad",
    "I": "Institucional",
    "J": "Educativo",
    "K": "Religioso",
    "L": "Agrícola",
    "M": "Pecuario",
    "N": "Agroindustrial",
    "O": "Forestal",
    "P": "Uso Público",
    "Q": "Lote Urbanizable No Urbanizado",
    "R": "Lote Urbanizable No Edificado",
    "S": "Lote No Urbanizable",
    "T": "Servicios Especiales"
}

# Tipos de documento
TIPOS_DOCUMENTO = {
    "C": "Cédula de Ciudadanía",
    "E": "Cédula de Extranjería",
    "N": "NIT",
    "T": "Tarjeta de Identidad",
    "P": "Pasaporte",
    "X": "Otro"
}

# Estados civiles
ESTADOS_CIVILES = {
    "S": "Soltero(a)",
    "E": "Casado(a)",
    "D": "Divorciado(a)", 
    "V": "Viudo(a)",
    "U": "Unión Libre"
}


# ============================================================
# ROLES Y PERMISOS
# ============================================================

class UserRole:
    """Roles de usuario disponibles en el sistema"""
    USUARIO = "usuario"
    ATENCION_USUARIO = "atencion_usuario"
    GESTOR = "gestor"
    GESTOR_AUXILIAR = "gestor_auxiliar"
    COORDINADOR = "coordinador"
    ADMINISTRADOR = "administrador"
    COMUNICACIONES = "comunicaciones"
    EMPRESA = "empresa"


class Permission:
    """Permisos granulares del sistema"""
    UPLOAD_GDB = "upload_gdb"
    IMPORT_R1R2 = "import_r1r2"
    APPROVE_CHANGES = "approve_changes"
    ACCESO_ACTUALIZACION = "acceso_actualizacion"
    
    @classmethod
    def all_permissions(cls):
        return [cls.UPLOAD_GDB, cls.IMPORT_R1R2, cls.APPROVE_CHANGES, cls.ACCESO_ACTUALIZACION]
    
    @classmethod
    def get_description(cls, perm):
        descriptions = {
            cls.UPLOAD_GDB: "Subir archivos GDB (Base Gráfica)",
            cls.IMPORT_R1R2: "Importar archivos R1/R2 (Excel)",
            cls.APPROVE_CHANGES: "Aprobar/Rechazar cambios de predios",
            cls.ACCESO_ACTUALIZACION: "Acceso al módulo de Actualización"
        }
        return descriptions.get(perm, perm)


class PetitionStatus:
    """Estados posibles de una petición/trámite"""
    RADICADO = "radicado"
    ASIGNADO = "asignado"
    EN_PROCESO = "en_proceso"
    REVISION = "revision"
    APROBADO = "aprobado"
    RECHAZADO = "rechazado"
    DEVUELTO = "devuelto"
    FINALIZADO = "finalizado"
