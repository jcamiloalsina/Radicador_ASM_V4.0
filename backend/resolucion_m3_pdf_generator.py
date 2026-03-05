"""
Generador de PDF para Resoluciones M3
- Cambio de Destino Económico
- Incorporación de Construcción

Autor: Sistema Catastral ASOMUNICIPIOS
"""

import io
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch, cm
from reportlab.pdfgen import canvas
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os
import logging

# Configuración de página
PAGE_WIDTH, PAGE_HEIGHT = letter
MARGIN_LEFT = 50
MARGIN_RIGHT = 50
MARGIN_TOP = 50
MARGIN_BOTTOM = 70
CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT

# Colores corporativos
VERDE_ASOMUNICIPIOS = colors.HexColor('#009846')
NEGRO = colors.black
GRIS_CLARO = colors.HexColor('#f5f5f5')
GRIS_OSCURO = colors.HexColor('#333333')

def get_config():
    """Obtener configuración del sistema"""
    return {
        "entidad": "ASOCIACIÓN DE MUNICIPIOS DEL CATATUMBO,",
        "entidad_linea2": "PROVINCIA DE OCAÑA Y SUR DEL CESAR",
        "cargo_firma": "SUBDIRECTORA FINANCIERA Y ADMINISTRATIVA",
        "nombre_firma": "DALGIE ESPERANZA TORRADO RIZO",
        "direccion": "Calle 12 #11-76 Piso 2 Ocaña N/Sder",
        "telefono": "3102327647",
        "web": "asomunicipios.gov.co"
    }

def format_currency(value):
    """Formatear valor como moneda colombiana"""
    try:
        return f"$ {float(value):,.0f}".replace(",", ".")
    except:
        return str(value)

def format_date(date_str):
    """Formatear fecha"""
    if not date_str:
        return datetime.now().strftime("%d/%m/%Y")
    try:
        if isinstance(date_str, str):
            if "T" in date_str:
                date_str = date_str.split("T")[0]
            parts = date_str.split("-")
            if len(parts) == 3:
                return f"{parts[2]}/{parts[1]}/{parts[0]}"
        return date_str
    except:
        return str(date_str)

def get_destino_nombre(codigo):
    """Obtener nombre completo del destino económico"""
    destinos = {
        'A': 'Agropecuario',
        'C': 'Comercial',
        'R': 'Residencial',
        'I': 'Industrial',
        'L': 'Lote',
        'H': 'Habitacional',
        'E': 'Educativo',
        'S': 'Salud',
        'G': 'Gubernamental',
        'O': 'Otros'
    }
    return destinos.get(codigo, codigo)

def generate_resolucion_m3_pdf(data: dict) -> bytes:
    """
    Genera el PDF de resolución M3 (Cambio de Destino o Incorporación de Construcción)
    
    Args:
        data: Diccionario con los datos de la resolución
            - numero_resolucion: str
            - fecha_resolucion: str
            - municipio: str
            - subtipo: 'cambio_destino' | 'incorporacion_construccion'
            - radicado: str
            - predio: dict (datos del predio)
            - destino_anterior: str (solo para cambio_destino)
            - destino_nuevo: str (solo para cambio_destino)
            - construcciones_nuevas: list (solo para incorporacion)
            - avaluo_anterior: float
            - avaluo_nuevo: float
            - fecha_inscripcion: str
            - solicitante: dict
            - elaborado_por: str
            - revisado_por: str
    
    Returns:
        bytes: Contenido del PDF
    """
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    
    config = get_config()
    
    # Fuentes
    try:
        font_normal = "Helvetica"
        font_bold = "Helvetica-Bold"
    except:
        font_normal = "Helvetica"
        font_bold = "Helvetica-Bold"
    
    # Variables de control de página
    y_position = PAGE_HEIGHT - MARGIN_TOP
    page_number = 1
    
    def nueva_pagina():
        nonlocal y_position, page_number
        # Footer antes de nueva página
        dibujar_footer(c, page_number, config)
        c.showPage()
        page_number += 1
        y_position = PAGE_HEIGHT - MARGIN_TOP
        dibujar_encabezado_continuacion()
    
    def verificar_espacio(espacio_necesario):
        nonlocal y_position
        if y_position - espacio_necesario < MARGIN_BOTTOM + 50:
            nueva_pagina()
    
    def dibujar_encabezado_continuacion():
        nonlocal y_position
        # Encabezado simple para páginas de continuación
        c.setFont(font_bold, 9)
        c.setFillColor(VERDE_ASOMUNICIPIOS)
        c.drawString(MARGIN_LEFT, PAGE_HEIGHT - 30, "ASOMUNICIPIOS - Gestor Catastral")
        c.setFillColor(NEGRO)
        c.setFont(font_normal, 8)
        c.drawRightString(PAGE_WIDTH - MARGIN_RIGHT, PAGE_HEIGHT - 30, f"Resolución {data.get('numero_resolucion', '')}")
        y_position = PAGE_HEIGHT - MARGIN_TOP - 20
    
    # =====================
    # ENCABEZADO PRINCIPAL
    # =====================
    # Logo y título
    logo_path = "/app/backend/logo_asomunicipios.png"
    if os.path.exists(logo_path):
        try:
            c.drawImage(logo_path, MARGIN_LEFT, PAGE_HEIGHT - 80, width=60, height=50, preserveAspectRatio=True)
        except:
            pass
    
    # Texto del encabezado
    c.setFont(font_bold, 11)
    c.setFillColor(VERDE_ASOMUNICIPIOS)
    c.drawCentredString(PAGE_WIDTH/2, PAGE_HEIGHT - 45, config["entidad"])
    c.drawCentredString(PAGE_WIDTH/2, PAGE_HEIGHT - 58, config["entidad_linea2"])
    
    c.setFont(font_bold, 10)
    c.setFillColor(NEGRO)
    c.drawCentredString(PAGE_WIDTH/2, PAGE_HEIGHT - 75, "Gestor Catastral")
    
    # Número de resolución (derecha)
    c.setFont(font_bold, 10)
    c.setFillColor(VERDE_ASOMUNICIPIOS)
    c.drawRightString(PAGE_WIDTH - MARGIN_RIGHT, PAGE_HEIGHT - 45, data.get('numero_resolucion', 'RES-XX-XXX-XXXX-2026'))
    
    y_position = PAGE_HEIGHT - 100
    
    # =====================
    # TÍTULO DE LA RESOLUCIÓN
    # =====================
    c.setFillColor(NEGRO)
    c.setFont(font_bold, 10)
    c.drawCentredString(PAGE_WIDTH/2, y_position, f"RESOLUCIÓN No: {data.get('numero_resolucion', '')}")
    y_position -= 15
    
    c.setFont(font_normal, 9)
    c.drawCentredString(PAGE_WIDTH/2, y_position, f"FECHA RESOLUCIÓN: {format_date(data.get('fecha_resolucion', ''))}")
    y_position -= 20
    
    # Título según subtipo
    subtipo = data.get('subtipo', 'cambio_destino')
    municipio = data.get('municipio', 'XXXX')
    
    if subtipo == 'cambio_destino':
        titulo = f"POR LA CUAL SE ORDENAN UNOS CAMBIOS EN EL CATASTRO DEL MUNICIPIO DE {municipio.upper()} Y SE HACE UN CAMBIO DE DESTINO ECONÓMICO"
    else:
        titulo = f"POR LA CUAL SE ORDENAN UNOS CAMBIOS EN EL CATASTRO DEL MUNICIPIO DE {municipio.upper()} Y SE INCORPORAN UNAS CONSTRUCCIONES"
    
    c.setFont(font_bold, 9)
    # Dividir título si es muy largo
    words = titulo.split()
    lines = []
    current_line = ""
    for word in words:
        test_line = current_line + " " + word if current_line else word
        if c.stringWidth(test_line, font_bold, 9) < CONTENT_WIDTH:
            current_line = test_line
        else:
            lines.append(current_line)
            current_line = word
    if current_line:
        lines.append(current_line)
    
    for line in lines:
        c.drawCentredString(PAGE_WIDTH/2, y_position, line)
        y_position -= 12
    
    y_position -= 10
    
    # =====================
    # CONSIDERANDO
    # =====================
    c.setFont(font_bold, 9)
    c.setFillColor(VERDE_ASOMUNICIPIOS)
    c.drawString(MARGIN_LEFT, y_position, "CONSIDERANDO:")
    c.setFillColor(NEGRO)
    y_position -= 15
    
    # Párrafo de base legal
    c.setFont(font_normal, 8)
    parrafo_legal = (
        f"Que la Asociación de Municipios del Catatumbo, Provincia de Ocaña y Sur del Cesar – ASOMUNICIPIOS, "
        f"en su calidad de Gestor Catastral habilitado mediante Resolución IGAC 1204 del 2021, en uso de las "
        f"facultades conferidas por la Ley 14 de 1983, el Decreto 148 de 2020, la Resolución 1040 de 2023 del "
        f"IGAC, el artículo 70 de la ley 1437 de 2011, el presente acto administrativo se expide con el objetivo "
        f"de ordenar los siguientes cambios en el Catastro del Municipio de {municipio}:"
    )
    
    # Dibujar párrafo con word wrap
    y_position = dibujar_parrafo(c, parrafo_legal, MARGIN_LEFT, y_position, CONTENT_WIDTH, font_normal, 8)
    y_position -= 10
    
    # Datos del solicitante
    predio = data.get('predio', {})
    solicitante = data.get('solicitante', {})
    
    parrafo_solicitud = (
        f"Que el(la) ciudadano(a) identificado(a) con Cédula de Ciudadanía No. {solicitante.get('documento', 'XXXXXXX')}, "
        f"en calidad de propietario(a) del predio identificado con código catastral (NPN) "
        f"{predio.get('codigo_predial_nacional', predio.get('npn', ''))}, ubicado en el municipio de {municipio}, "
        f"radicó solicitud bajo el número {data.get('radicado', '(Radicado)')}."
    )
    
    y_position = dibujar_parrafo(c, parrafo_solicitud, MARGIN_LEFT, y_position, CONTENT_WIDTH, font_normal, 8)
    y_position -= 10
    
    # Documentos soporte
    c.setFont(font_normal, 8)
    c.drawString(MARGIN_LEFT, y_position, "Documentos aportados:")
    y_position -= 12
    
    documentos = [
        "Oficio de solicitud y autorización.",
        "Fotocopia cédula de ciudadanía del propietario.",
        "Escritura pública del predio.",
        "Matrícula inmobiliaria."
    ]
    
    for doc in documentos:
        c.drawString(MARGIN_LEFT + 20, y_position, f"• {doc}")
        y_position -= 10
    
    y_position -= 5
    
    # Párrafo de verificación
    if subtipo == 'cambio_destino':
        parrafo_verificacion = (
            f"Que una vez realizada la inspección ocular en terreno y/o por métodos indirectos, declarativos y colaborativos, "
            f"se encontraron modificaciones físicas y económicas que sugieren un cambio en el destino económico del predio, "
            f"por lo cual es pertinente actualizar la base de datos catastral para la vigencia {datetime.now().year}."
        )
    else:
        parrafo_verificacion = (
            f"Que una vez realizada la inspección ocular en terreno y/o por métodos indirectos, declarativos y colaborativos, "
            f"se encontraron nuevas construcciones en el predio que no se encuentran registradas en la base catastral, "
            f"por lo cual es pertinente incorporar estas construcciones y actualizar la base de datos para la vigencia {datetime.now().year}."
        )
    
    verificar_espacio(60)
    y_position = dibujar_parrafo(c, parrafo_verificacion, MARGIN_LEFT, y_position, CONTENT_WIDTH, font_normal, 8)
    y_position -= 10
    
    # Párrafo legal de mutación
    parrafo_mutacion = (
        "Que conforme a lo anterior, es necesario realizar una mutación de tercera clase y proceder con la cancelación "
        "e inscripción correspondiente, de acuerdo con lo establecido en el literal C del Artículo 2.2.2.2.2 del Decreto 148 de 2020, "
        "el Numeral 3 del Artículo 4.5.1, y los Artículos 4.5.2, 4.6.4 y 4.7.13 de la Resolución 1040 de 2023."
    )
    
    verificar_espacio(50)
    y_position = dibujar_parrafo(c, parrafo_mutacion, MARGIN_LEFT, y_position, CONTENT_WIDTH, font_normal, 8)
    y_position -= 15
    
    # =====================
    # RESUELVE
    # =====================
    c.setFont(font_bold, 9)
    c.setFillColor(VERDE_ASOMUNICIPIOS)
    c.drawString(MARGIN_LEFT, y_position, "RESUELVE:")
    c.setFillColor(NEGRO)
    y_position -= 15
    
    c.setFont(font_bold, 8)
    c.drawString(MARGIN_LEFT, y_position, f"Artículo 1. Ordenar la inscripción en el catastro del Municipio de {municipio.upper()} los siguientes cambios:")
    y_position -= 20
    
    # =====================
    # TABLA CANCELACIÓN
    # =====================
    verificar_espacio(80)
    
    c.setFont(font_bold, 9)
    c.setFillColor(colors.HexColor('#c62828'))
    c.drawString(MARGIN_LEFT, y_position, "CANCELACIÓN")
    c.setFillColor(NEGRO)
    y_position -= 15
    
    y_position = dibujar_tabla_predio(c, predio, data.get('destino_anterior', predio.get('destino_economico', 'R')), 
                                       data.get('avaluo_anterior', predio.get('avaluo', 0)), 
                                       data.get('fecha_anterior', '01/01/2024'), y_position, font_bold, font_normal, "cancelacion")
    y_position -= 20
    
    # =====================
    # TABLA INSCRIPCIÓN
    # =====================
    verificar_espacio(80)
    
    c.setFont(font_bold, 9)
    c.setFillColor(VERDE_ASOMUNICIPIOS)
    c.drawString(MARGIN_LEFT, y_position, "INSCRIPCIÓN")
    c.setFillColor(NEGRO)
    y_position -= 15
    
    if subtipo == 'cambio_destino':
        destino_inscripcion = data.get('destino_nuevo', 'C')
    else:
        destino_inscripcion = predio.get('destino_economico', 'R')
    
    y_position = dibujar_tabla_predio(c, predio, destino_inscripcion,
                                       data.get('avaluo_nuevo', 0),
                                       "", y_position, font_bold, font_normal, "inscripcion")
    y_position -= 10
    
    # =====================
    # VIGENCIAS FISCALES DE INSCRIPCIÓN
    # =====================
    fechas_inscripcion = data.get('fechas_inscripcion', [])
    if fechas_inscripcion:
        verificar_espacio(30 + len(fechas_inscripcion) * 15)
        
        c.setFont(font_bold, 9)
        c.setFillColor(VERDE_ASOMUNICIPIOS)
        c.drawString(MARGIN_LEFT, y_position, "VIGENCIAS FISCALES DE INSCRIPCIÓN")
        c.setFillColor(NEGRO)
        y_position -= 15
        
        # Encabezado de tabla
        col_widths = [80, 150, 100]
        headers = ["AÑO VIGENCIA", "AVALÚO CATASTRAL", "FUENTE"]
        
        c.setFont(font_bold, 7)
        c.setFillColor(VERDE_ASOMUNICIPIOS)
        c.rect(MARGIN_LEFT, y_position - 12, sum(col_widths), 14, fill=1)
        c.setFillColor(colors.white)
        x_pos = MARGIN_LEFT + 5
        for i, header in enumerate(headers):
            c.drawString(x_pos, y_position - 9, header)
            x_pos += col_widths[i]
        y_position -= 14
        
        # Filas de datos
        c.setFillColor(NEGRO)
        c.setFont(font_normal, 7)
        for fecha in fechas_inscripcion:
            año = fecha.get('año', '')
            avaluo = fecha.get('avaluo', 0)
            source = fecha.get('avaluo_source', 'manual')
            
            fuente_texto = {
                'sistema': 'Sistema catastral',
                'manual': 'Manual',
                'actual': 'Vigencia actual'
            }.get(source, 'Manual')
            
            c.setStrokeColor(colors.lightgrey)
            c.rect(MARGIN_LEFT, y_position - 12, sum(col_widths), 14, stroke=1, fill=0)
            
            x_pos = MARGIN_LEFT + 5
            c.drawString(x_pos, y_position - 9, str(año))
            x_pos += col_widths[0]
            c.drawString(x_pos, y_position - 9, f"${int(avaluo):,}" if avaluo else "$0")
            x_pos += col_widths[1]
            c.drawString(x_pos, y_position - 9, fuente_texto)
            
            y_position -= 14
        
        y_position -= 10
    
    # Si es incorporación de construcción, mostrar detalle R2
    if subtipo == 'incorporacion_construccion':
        construcciones = data.get('construcciones_nuevas', [])
        if construcciones:
            verificar_espacio(60 + len(construcciones) * 15)
            
            c.setFont(font_bold, 9)
            c.setFillColor(VERDE_ASOMUNICIPIOS)
            c.drawString(MARGIN_LEFT, y_position, "DETALLE DE CONSTRUCCIONES INCORPORADAS")
            c.setFillColor(NEGRO)
            y_position -= 15
            
            y_position = dibujar_tabla_construcciones(c, construcciones, y_position, font_bold, font_normal)
            y_position -= 15
    
    # =====================
    # ARTÍCULOS PROCEDIMENTALES
    # =====================
    verificar_espacio(150)
    
    articulos = [
        ("Artículo 2.", "La presente resolución se notificará personalmente y subsidiariamente por aviso, de conformidad con lo establecido en los artículos 67 y 69 de la ley 1437 de 2011."),
        ("Artículo 3.", "Contra la presente resolución proceden los recursos de reposición y subsidio de apelación dentro de los diez (10) días siguientes a la notificación, de conformidad con el artículo 74 de la ley 1437 de 2011."),
        ("Artículo 4.", "Los recursos interpuestos tienen efecto suspensivo respecto de las actuaciones de tesorería que se deriven de la presente resolución."),
        ("Artículo 5.", "Los avalúos inscritos con posterioridad al primero de enero de cada año, tendrán efectos fiscales a partir del año siguiente al de su inscripción.")
    ]
    
    for titulo_art, texto_art in articulos:
        verificar_espacio(40)
        c.setFont(font_bold, 8)
        c.drawString(MARGIN_LEFT, y_position, titulo_art)
        y_position -= 10
        y_position = dibujar_parrafo(c, texto_art, MARGIN_LEFT, y_position, CONTENT_WIDTH, font_normal, 8)
        y_position -= 10
    
    # =====================
    # CIERRE
    # =====================
    verificar_espacio(80)
    
    c.setFont(font_bold, 9)
    c.drawCentredString(PAGE_WIDTH/2, y_position, "COMUNÍQUESE, NOTIFÍQUESE Y CÚMPLASE")
    y_position -= 20
    
    fecha_texto = datetime.now().strftime("%d días del mes de %B de %Y").replace(
        "January", "enero").replace("February", "febrero").replace("March", "marzo").replace(
        "April", "abril").replace("May", "mayo").replace("June", "junio").replace(
        "July", "julio").replace("August", "agosto").replace("September", "septiembre").replace(
        "October", "octubre").replace("November", "noviembre").replace("December", "diciembre")
    
    c.setFont(font_normal, 9)
    c.drawCentredString(PAGE_WIDTH/2, y_position, f"DADA EN OCAÑA A LOS {fecha_texto.upper()}")
    y_position -= 40
    
    # Firmas
    verificar_espacio(60)
    
    c.setFont(font_normal, 8)
    c.drawString(MARGIN_LEFT, y_position, f"Elaboró: {data.get('elaborado_por', '')}")
    y_position -= 12
    c.drawString(MARGIN_LEFT, y_position, f"Revisó: {data.get('revisado_por', '')}")
    y_position -= 25
    
    c.setFont(font_bold, 9)
    c.drawCentredString(PAGE_WIDTH/2, y_position, config["nombre_firma"])
    y_position -= 12
    c.setFont(font_normal, 8)
    c.drawCentredString(PAGE_WIDTH/2, y_position, config["cargo_firma"])
    
    # Footer final
    dibujar_footer(c, page_number, config)
    
    c.save()
    return buffer.getvalue()


def dibujar_parrafo(c, texto, x, y, max_width, font, font_size):
    """Dibuja un párrafo con word wrap"""
    c.setFont(font, font_size)
    words = texto.split()
    lines = []
    current_line = ""
    
    for word in words:
        test_line = current_line + " " + word if current_line else word
        if c.stringWidth(test_line, font, font_size) < max_width:
            current_line = test_line
        else:
            lines.append(current_line)
            current_line = word
    if current_line:
        lines.append(current_line)
    
    for line in lines:
        c.drawString(x, y, line)
        y -= font_size + 2
    
    return y


def dibujar_tabla_predio(c, predio, destino, avaluo, fecha, y_position, font_bold, font_normal, tipo):
    """Dibuja la tabla de datos del predio"""
    
    # Headers
    headers = ["NPN", "DIRECCIÓN", "PROPIETARIO", "DEST", "ÁREA T", "ÁREA C", "AVALÚO", "FECHA"]
    col_widths = [100, 100, 100, 30, 40, 40, 60, 50]
    
    # Fondo del header
    x = MARGIN_LEFT
    c.setFillColor(colors.HexColor('#e8e8e8'))
    c.rect(MARGIN_LEFT, y_position - 12, CONTENT_WIDTH, 14, fill=1, stroke=1)
    
    # Texto del header
    c.setFillColor(NEGRO)
    c.setFont(font_bold, 6)
    
    for i, header in enumerate(headers):
        c.drawCentredString(x + col_widths[i]/2, y_position - 9, header)
        x += col_widths[i]
    
    y_position -= 14
    
    # Datos
    propietarios = predio.get('propietarios', [])
    nombre_propietario = propietarios[0].get('nombre', '') if propietarios else predio.get('nombre_propietario', '')
    
    datos = [
        predio.get('codigo_predial_nacional', predio.get('npn', ''))[:30],
        (predio.get('direccion', '') or '')[:20],
        nombre_propietario[:20],
        destino,
        str(predio.get('area_terreno', 0))[:6],
        str(predio.get('area_construida', 0))[:6],
        format_currency(avaluo),
        fecha
    ]
    
    c.setFont(font_normal, 6)
    x = MARGIN_LEFT
    
    # Fondo de fila
    if tipo == "cancelacion":
        c.setFillColor(colors.HexColor('#ffebee'))
    else:
        c.setFillColor(colors.HexColor('#e8f5e9'))
    c.rect(MARGIN_LEFT, y_position - 12, CONTENT_WIDTH, 14, fill=1, stroke=1)
    
    c.setFillColor(NEGRO)
    for i, dato in enumerate(datos):
        c.drawCentredString(x + col_widths[i]/2, y_position - 9, str(dato))
        x += col_widths[i]
    
    return y_position - 14


def dibujar_tabla_construcciones(c, construcciones, y_position, font_bold, font_normal):
    """Dibuja la tabla de construcciones R2"""
    
    headers = ["#", "TIPO", "PISOS", "ÁREA (m²)", "USO", "PUNTAJE"]
    col_widths = [30, 80, 50, 70, 100, 70]
    
    # Header
    x = MARGIN_LEFT
    c.setFillColor(colors.HexColor('#e3f2fd'))
    c.rect(MARGIN_LEFT, y_position - 12, sum(col_widths), 14, fill=1, stroke=1)
    
    c.setFillColor(NEGRO)
    c.setFont(font_bold, 7)
    
    for i, header in enumerate(headers):
        c.drawCentredString(x + col_widths[i]/2, y_position - 9, header)
        x += col_widths[i]
    
    y_position -= 14
    
    # Filas
    c.setFont(font_normal, 7)
    for idx, const in enumerate(construcciones):
        x = MARGIN_LEFT
        c.rect(MARGIN_LEFT, y_position - 12, sum(col_widths), 14, fill=0, stroke=1)
        
        datos = [
            str(idx + 1),
            const.get('tipo_construccion', 'C'),
            str(const.get('total_pisos', const.get('pisos', 1))),
            str(const.get('area_construida', const.get('area', 0))),
            const.get('uso', '')[:15],
            str(const.get('puntaje', 0))
        ]
        
        for i, dato in enumerate(datos):
            c.drawCentredString(x + col_widths[i]/2, y_position - 9, dato)
            x += col_widths[i]
        
        y_position -= 14
    
    return y_position


def dibujar_footer(c, page_number, config):
    """Dibuja el footer de la página"""
    y_footer = 40
    
    # Línea separadora
    c.setStrokeColor(VERDE_ASOMUNICIPIOS)
    c.setLineWidth(1)
    c.line(MARGIN_LEFT, y_footer + 20, PAGE_WIDTH - MARGIN_RIGHT, y_footer + 20)
    
    # Información de contacto
    c.setFont("Helvetica", 7)
    c.setFillColor(GRIS_OSCURO)
    c.drawString(MARGIN_LEFT, y_footer + 8, config["web"])
    c.drawCentredString(PAGE_WIDTH/2, y_footer + 8, f"{config['direccion']} | Tel: {config['telefono']}")
    c.drawRightString(PAGE_WIDTH - MARGIN_RIGHT, y_footer + 8, f"Página {page_number}")
