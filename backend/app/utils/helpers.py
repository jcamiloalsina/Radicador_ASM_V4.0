"""
Utilidades compartidas del sistema
"""
import os
import re
import uuid
from pathlib import Path


def is_safe_path(base_path: str, target_path: str) -> bool:
    """
    Verifica que el path objetivo esté dentro del directorio base.
    Previene ataques de Path Traversal (../).
    """
    base = os.path.abspath(base_path)
    target = os.path.abspath(target_path)
    return target.startswith(base + os.sep) or target == base


def secure_filename(filename: str) -> str:
    """
    Sanitiza el nombre de archivo removiendo caracteres peligrosos.
    Previene ataques de Path Traversal y caracteres maliciosos.
    """
    if not filename:
        return ""
    # Remover path separators y caracteres peligrosos
    filename = os.path.basename(filename)
    # Remover caracteres no permitidos
    filename = re.sub(r'[^\w\s\-\.]', '', filename)
    # Remover múltiples puntos consecutivos
    filename = re.sub(r'\.{2,}', '.', filename)
    # Remover espacios al inicio/fin
    filename = filename.strip()
    # Si el nombre quedó vacío, generar uno aleatorio
    if not filename or filename.startswith('.'):
        filename = f"file_{uuid.uuid4().hex[:8]}"
    return filename


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
    "lourdes": "Lourdes", "margarita": "Margarita", "mercedes": "Mercedes",
    "nuria": "Nuria", "patricia": "Patricia", "raquel": "Raquel", "rebeca": "Rebeca",
    "sara": "Sara", "silvia": "Silvia", "susana": "Susana", "victoria": "Victoria",
    "garcia": "García", "gonzalez": "González", "rodriguez": "Rodríguez",
    "fernandez": "Fernández", "lopez": "López", "martinez": "Martínez",
    "sanchez": "Sánchez", "perez": "Pérez", "gomez": "Gómez", "diaz": "Díaz",
    "jimenez": "Jiménez", "hernandez": "Hernández", "alvarez": "Álvarez",
    "ruiz": "Ruiz", "ramirez": "Ramírez", "romero": "Romero", "suarez": "Suárez",
    "benitez": "Benítez", "mendez": "Méndez", "gutierrez": "Gutiérrez",
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


def format_area_colombiana(area: float) -> str:
    """
    Formatea un área al estándar colombiano.
    Ejemplo: 1044.70 -> "1.044,70 m²"
    """
    if area is None:
        return "0,00 m²"
    
    # Formatear con separador de miles (punto) y decimales (coma)
    formatted = f"{area:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"{formatted} m²"


def generar_codigo_verificacion() -> str:
    """Genera código de verificación para certificados"""
    import random
    from datetime import datetime
    año = datetime.now().year
    aleatorio = ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', k=8))
    return f"ASM-{año}-{aleatorio}"


def generar_codigo_verificacion_resolucion() -> str:
    """Genera código de verificación específico para resoluciones"""
    import random
    from datetime import datetime
    año = datetime.now().year
    aleatorio = ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', k=8))
    return f"ASM-{año}-RES-{aleatorio}"


def generar_hash_documento(contenido: str) -> str:
    """Genera hash SHA-256 de un documento"""
    import hashlib
    return hashlib.sha256(contenido.encode()).hexdigest()[:16]
