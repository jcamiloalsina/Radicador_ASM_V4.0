"""
Utilidades comunes para el Sistema de Gestión Catastral
"""

import uuid
import re
from datetime import datetime, timezone
from typing import Optional


def generar_id() -> str:
    """Genera un UUID único"""
    return str(uuid.uuid4())


def obtener_timestamp() -> str:
    """Obtiene timestamp actual en formato ISO"""
    return datetime.now(timezone.utc).isoformat()


def obtener_anio_actual() -> int:
    """Obtiene el año actual"""
    return datetime.now(timezone.utc).year


def normalizar_texto(texto: str) -> str:
    """
    Normaliza texto removiendo tildes y convirtiendo a minúsculas.
    Útil para comparaciones case-insensitive.
    """
    if not texto:
        return ""
    import unicodedata
    texto_normalizado = unicodedata.normalize('NFD', texto)
    texto_sin_tildes = ''.join(
        char for char in texto_normalizado 
        if unicodedata.category(char) != 'Mn'
    )
    return texto_sin_tildes.lower().strip()


def validar_npn(npn: str) -> tuple[bool, str]:
    """
    Valida que el Número Predial Nacional (NPN) tenga formato correcto.
    Debe tener exactamente 30 caracteres numéricos.
    
    Returns:
        tuple: (es_valido, mensaje_error)
    """
    if not npn:
        return False, "NPN es requerido"
    
    npn_limpio = npn.strip().replace(" ", "").replace("-", "")
    
    if len(npn_limpio) != 30:
        return False, f"NPN debe tener 30 caracteres, tiene {len(npn_limpio)}"
    
    if not npn_limpio.isdigit():
        return False, "NPN debe contener solo números"
    
    return True, "OK"


def formatear_npn(npn: str) -> str:
    """
    Formatea un NPN removiendo espacios y guiones.
    """
    if not npn:
        return ""
    return npn.strip().replace(" ", "").replace("-", "")


def formatear_area_colombiano(area: float) -> str:
    """
    Formatea un área en formato colombiano: 1.044,70 m²
    Usa punto como separador de miles y coma como decimal.
    """
    try:
        area = float(area or 0)
        parte_entera = int(area)
        parte_decimal = area - parte_entera
        
        # Formatear parte entera con puntos como separador de miles
        parte_entera_str = f"{parte_entera:,}".replace(",", ".")
        
        # Formatear parte decimal con coma (2 decimales)
        parte_decimal_str = f"{parte_decimal:.2f}"[1:].replace(".", ",")
        
        return f"{parte_entera_str}{parte_decimal_str} m²"
    except:
        return "0,00 m²"


def formatear_moneda_colombiano(valor: float) -> str:
    """
    Formatea un valor monetario en formato colombiano: $1.234.567
    """
    try:
        valor = float(valor or 0)
        return f"${valor:,.0f}".replace(",", ".")
    except:
        return "$0"


def validar_email(email: str) -> bool:
    """Valida formato de email"""
    if not email:
        return False
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def validar_password(password: str) -> tuple[bool, str]:
    """
    Valida que la contraseña cumpla requisitos de seguridad.
    
    Requisitos:
    - Mínimo 8 caracteres
    - Al menos una mayúscula
    - Al menos una minúscula
    - Al menos un número
    - Al menos un carácter especial
    
    Returns:
        tuple: (es_valido, mensaje_error)
    """
    if len(password) < 8:
        return False, "La contraseña debe tener mínimo 8 caracteres"
    if not re.search(r'[A-Z]', password):
        return False, "La contraseña debe tener al menos una mayúscula"
    if not re.search(r'[a-z]', password):
        return False, "La contraseña debe tener al menos una minúscula"
    if not re.search(r'[0-9]', password):
        return False, "La contraseña debe tener al menos un número"
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False, "La contraseña debe tener al menos un carácter especial"
    return True, "OK"


def generar_radicado(prefijo: str = "RAD", año: int = None) -> str:
    """
    Genera un número de radicado único.
    Formato: {PREFIJO}-{AÑO}-{TIMESTAMP_CORTO}
    
    Nota: En producción, este número debe ser obtenido de forma atómica
    desde la base de datos para garantizar unicidad.
    """
    año = año or obtener_anio_actual()
    timestamp = datetime.now().strftime("%H%M%S%f")[:8]
    return f"{prefijo}-{año}-{timestamp}"


def generar_codigo_verificacion() -> str:
    """
    Genera un código de verificación para documentos.
    Formato: 8 caracteres alfanuméricos en mayúsculas.
    """
    import secrets
    import string
    caracteres = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(caracteres) for _ in range(8))


def calcular_dias_habiles(fecha_inicio: datetime, dias: int) -> datetime:
    """
    Calcula la fecha después de N días hábiles (lunes a viernes).
    """
    fecha = fecha_inicio
    dias_agregados = 0
    
    while dias_agregados < dias:
        fecha = fecha.replace(day=fecha.day + 1)
        # 0 = lunes, 6 = domingo
        if fecha.weekday() < 5:  # Lunes a viernes
            dias_agregados += 1
    
    return fecha


def truncar_texto(texto: str, max_length: int = 100) -> str:
    """Trunca texto agregando ... si excede el límite"""
    if not texto:
        return ""
    if len(texto) <= max_length:
        return texto
    return texto[:max_length - 3] + "..."


def extraer_municipio_de_npn(npn: str) -> dict:
    """
    Extrae información del municipio desde un NPN.
    
    Estructura NPN (30 dígitos):
    - Posición 1-2: Departamento
    - Posición 3-5: Municipio
    - Posición 6-7: Zona (urbana/rural)
    - Resto: Identificación del predio
    
    Returns:
        dict con codigo_departamento, codigo_municipio, zona
    """
    if not npn or len(npn) < 7:
        return {}
    
    npn_limpio = formatear_npn(npn)
    
    return {
        "codigo_departamento": npn_limpio[0:2],
        "codigo_municipio": npn_limpio[2:5],
        "zona": "urbana" if npn_limpio[5:7] == "01" else "rural"
    }


def sanitizar_nombre_archivo(nombre: str) -> str:
    """
    Sanitiza un nombre de archivo removiendo caracteres no permitidos.
    """
    if not nombre:
        return "archivo"
    
    # Remover caracteres no permitidos
    nombre_limpio = re.sub(r'[<>:"/\\|?*]', '_', nombre)
    # Remover espacios múltiples
    nombre_limpio = re.sub(r'\s+', '_', nombre_limpio)
    # Limitar longitud
    return nombre_limpio[:100]
