"""
Generador de PDF para Resoluciones de Rectificación de Área
Estructura IDÉNTICA a M2/M4/M5 para mantener consistencia visual
"""

import io
import os
import base64
import qrcode
import hashlib
from datetime import datetime
from zoneinfo import ZoneInfo
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader, simpleSplit
from reportlab.lib.units import inch, cm

# Importar funciones de imágenes
from certificado_images import get_encabezado_image, get_pie_pagina_image, get_firma_dalgie_image

# Constantes de diseño - IDÉNTICAS a M2/M4/M5
PAGE_WIDTH, PAGE_HEIGHT = letter
MARGIN_LEFT = 50
MARGIN_RIGHT = 50
MARGIN_TOP = 50
MARGIN_BOTTOM = 80
CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT

# Colores institucionales
VERDE_INSTITUCIONAL = colors.HexColor('#009846')
NEGRO = colors.black
BLANCO = colors.white
AZUL_HEADER = colors.HexColor('#1a365d')
CYAN_RECTIFICACION = colors.HexColor('#0891b2')


def obtener_datos_r1_r2_pdf(predio: dict) -> dict:
    """
    Obtiene datos de R1 y R2 del predio para los cuadros de la resolución.
    """
    if not predio:
        return {
            'codigo_homologado': '',
            'direccion': '',
            'destino_economico': '',
            'area_terreno': 0,
            'area_construida': 0,
            'avaluo': 0,
            'matricula_inmobiliaria': '',
            'propietarios': []
        }
    
    r1 = predio.get('r1_registros', [])
    r2 = predio.get('r2_registros', [])
    
    r1_data = r1[0] if r1 else {}
    r2_data = r2[0] if r2 else {}
    
    return {
        'codigo_homologado': r1_data.get('codigo_homologado') or predio.get('codigo_homologado', ''),
        'direccion': r1_data.get('direccion') or predio.get('direccion', ''),
        'destino_economico': r1_data.get('destino_economico') or predio.get('destino_economico', 'A'),
        'area_terreno': r1_data.get('area_terreno') or predio.get('area_terreno', 0),
        'area_construida': r1_data.get('area_construida') or predio.get('area_construida', 0),
        'avaluo': r1_data.get('avaluo') or predio.get('avaluo', 0),
        'matricula_inmobiliaria': r2_data.get('matricula_inmobiliaria') or predio.get('matricula_inmobiliaria', ''),
        'propietarios': r2_data.get('propietarios') or predio.get('propietarios', [])
    }


def get_rectificacion_area_plantilla():
    """Plantilla para Rectificación de Área"""
    return {
        "tipo": "RECTIFICACION_AREA",
        "titulo": "POR LA CUAL SE ORDENAN UNOS CAMBIOS EN EL CATASTRO DEL MUNICIPIO DE {municipio} Y SE RESUELVE UNA RECTIFICACIÓN DE ÁREA",
        "considerando_intro": (
            "La Asociación de Municipios del Catatumbo, Provincia de Ocaña y Sur del Cesar – Asomunicipios "
            "en calidad de Gestor Catastral, en uso de sus facultades legales "
            "otorgadas por la resolución IGAC 1204 del 2021 en concordancia con la ley 14 de 1983, "
            "el literal c del artículo 2.2.2.2.2 del decreto 148 del 2020 y la resolución IGAC 1040 del 2023: "
            "\"por la cual se actualiza la reglamentación técnica de la formación, actualización, "
            "conservación y difusión catastral con enfoque multipropósito\", y"
        ),
        "considerando_solicitud": (
            "Qué, el/la señor(a) {solicitante_nombre}, identificado(a) con cédula de ciudadanía No. {solicitante_documento}, "
            "radicó una solicitud de trámite catastral atendido bajo el consecutivo de la Asociación de Municipios del Catatumbo, "
            "Provincia de Ocaña y Sur del Cesar – Asomunicipios con el No. {radicado}, "
            "donde solicita la RECTIFICACIÓN DEL ÁREA del predio identificado con código predial nacional {codigo_predial}, "
            "lo anterior en su calidad de propietario(a) del predio."
        ),
        "considerando_area_actual": (
            "Qué, actualmente el predio se encuentra inscrito en el catastro con un área de terreno de {area_terreno_anterior} m² "
            "y un área construida de {area_construida_anterior} m², con avalúo catastral de ${avaluo_anterior}."
        ),
        "considerando_area_nueva": (
            "Qué, según el levantamiento topográfico y/o estudio técnico presentado, el predio tiene un área de terreno de "
            "{area_terreno_nueva} m² y un área construida de {area_construida_nueva} m², con avalúo catastral de ${avaluo_nuevo}."
        ),
        "considerando_analisis": (
            "Qué, teniendo en cuenta los soportes presentados, el estudio jurídico y técnico realizado, "
            "así como la verificación de campo efectuada, se encontró que la rectificación del área amerita para dar "
            "cumplimiento al artículo 4.5.1, 4.5.5 y 4.6.6 de la resolución IGAC 1040 de 2023."
        ),
        "considerando_legal": (
            "Qué estas radicaciones implican una rectificación de los datos catastrales y su correspondiente registro "
            "en el catastro, conforme lo indican los artículos 4.5.1, 4.5.5, 4.6.6, 4.7.13, 4.8.2, 4.8.4 y 4.7.14 "
            "de la resolución IGAC 1040 de 2023, el artículo 2.2.2.2.2 literal c del decreto 148 de 2020 y lo preceptuado "
            "en la resolución vigente sobre los requisitos para trámites y otros procedimientos administrativos."
        ),
        "articulo_1_intro": "Ordenar la RECTIFICACIÓN DE ÁREA en el catastro del Municipio de {municipio}, del siguiente predio:",
        "articulo_2": (
            "De conformidad con lo dispuesto en el artículo 4.8.2 de la resolución 1040 de 2023, el presente acto "
            "administrativo se notificará personal y subsidiariamente por aviso siguiendo el procedimiento previsto "
            "en los artículos 67, 68 y 69 de la ley 1437 de 2011 (CPA y CCA), procederá la notificación electrónica "
            "siempre y cuando el interesado acepte ser notificado de esta manera."
        ),
        "articulo_3": (
            "Contra el presente acto administrativo proceden los recursos de reposición y subsidio de apelación, "
            "ante el funcionario que dictó la decisión, podrán interponerse por escrito en la diligencia de notificación "
            "personal, o dentro de los diez (10) días hábiles siguientes a su notificación, de conformidad con lo "
            "preceptuado en el artículo 4.8.4 de la resolución 1040 de 2023 y lo dispuesto en artículo 74 y 76 de la "
            "ley 1437 de 2011 o la norma que la modifique, adicione o sustituya."
        ),
        "articulo_4": (
            "Los recursos se concederán en el efecto suspensivo y por consiguiente la anotación de la rectificación "
            "catastral en los documentos de la tesorería municipal u oficina recaudadora solo se efectuarán hasta "
            "la ejecutoria del acto administrativo."
        ),
        "articulo_5": (
            "Los avalúos inscritos con posterioridad al primero de enero tendrán vigencia fiscal para el año siguiente, "
            "ajustados con el índice que determine el gobierno nacional, de conformidad a lo expuesto en el artículo "
            "4.7.14 de la resolución 1040 de 2023."
        ),
        "cierre": "COMUNÍQUESE, NOTIFÍQUESE Y CÚMPLASE",
        "firmante_nombre": "DALGIE ESPERANZA TORRADO RIZO",
        "firmante_cargo": "SUBDIRECTORA FINANCIERA Y ADMINISTRATIVA"
    }


def generar_qr_verificacion(codigo_verificacion: str, base_url: str = None) -> ImageReader:
    """Genera código QR para verificación"""
    if not base_url:
        base_url = os.environ.get('FRONTEND_URL', 'https://m6-area-update.preview.emergentagent.com')
    
    url_verificacion = f"{base_url}/verificar/{codigo_verificacion}"
    
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=2,
    )
    qr.add_data(url_verificacion)
    qr.make(fit=True)
    
    qr_img = qr.make_image(fill_color="black", back_color="white")
    qr_buffer = io.BytesIO()
    qr_img.save(qr_buffer, format='PNG')
    qr_buffer.seek(0)
    
    return ImageReader(qr_buffer)


def generate_m6_resolution_pdf(data: dict) -> bytes:
    """
    Genera PDF de resolución de Rectificación de Área con el mismo estilo visual
    que las demás mutaciones (M1-M5).
    """
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    
    # Fuentes
    font_normal = "Helvetica"
    font_bold = "Helvetica-Bold"
    
    # Extraer datos
    numero_resolucion = data.get("numero_resolucion", "RES-XX-XXX-0000-2026")
    fecha_resolucion = data.get("fecha_resolucion", datetime.now().strftime("%d/%m/%Y"))
    municipio = data.get("municipio", "")
    radicado = data.get("radicado", "")
    predio = data.get("predio", {})
    solicitante = data.get("solicitante", {})
    elaboro = data.get("elaborado_por", "")
    aprobo = data.get("revisado_por", "")
    codigo_verificacion = data.get("codigo_verificacion", "")
    texto_considerando_personalizado = data.get("texto_considerando")
    
    # Áreas
    area_terreno_anterior = data.get("area_terreno_anterior", 0)
    area_terreno_nueva = data.get("area_terreno_nueva", 0)
    area_construida_anterior = data.get("area_construida_anterior", 0)
    area_construida_nueva = data.get("area_construida_nueva", 0)
    avaluo_anterior = data.get("avaluo_anterior", predio.get("avaluo", 0))
    avaluo_nuevo = data.get("avaluo_nuevo", avaluo_anterior)
    
    # Obtener datos R1/R2
    datos_predio = obtener_datos_r1_r2_pdf(predio)
    
    # Datos del propietario
    propietarios = datos_predio.get('propietarios', []) or predio.get('propietarios', [])
    if propietarios and len(propietarios) > 0:
        propietario_nombre = propietarios[0].get('nombre_propietario', propietarios[0].get('nombre', ''))
        propietario_documento = propietarios[0].get('numero_documento', '')
    else:
        propietario_nombre = solicitante.get('nombre', '')
        propietario_documento = solicitante.get('documento', '')
    
    # Datos del solicitante
    solicitante_nombre = solicitante.get('nombre', propietario_nombre)
    solicitante_documento = solicitante.get('documento', propietario_documento)
    
    # Código predial
    codigo_predial = predio.get('codigo_predial_nacional') or predio.get('NPN', '') or predio.get('codigo_predial', '')
    matricula = datos_predio.get('matricula_inmobiliaria') or predio.get('matricula_inmobiliaria', '')
    direccion = datos_predio.get('direccion') or predio.get('direccion', '')
    destino_economico = datos_predio.get('destino_economico') or predio.get('destino_economico', 'A')
    codigo_homologado = datos_predio.get('codigo_homologado') or predio.get('codigo_homologado', '')
    
    # Plantilla
    plantilla = get_rectificacion_area_plantilla()
    
    # Cargar imágenes
    try:
        encabezado_img = ImageReader(get_encabezado_image())
    except:
        encabezado_img = None
    
    try:
        pie_pagina_img = ImageReader(get_pie_pagina_image())
    except:
        pie_pagina_img = None
    
    try:
        firma_img = ImageReader(get_firma_dalgie_image())
    except:
        firma_img = None
    
    # Marca de agua
    logo_watermark = None
    try:
        logo_path = "/app/frontend/public/watermark-gray.png"
        if os.path.exists(logo_path):
            logo_watermark = ImageReader(logo_path)
    except:
        logo_watermark = None
    
    # Generar QR
    qr_img = None
    if codigo_verificacion:
        try:
            qr_img = generar_qr_verificacion(codigo_verificacion)
        except:
            qr_img = None
    
    current_page = 1
    
    def draw_watermark():
        """Dibuja la marca de agua"""
        if logo_watermark:
            c.saveState()
            watermark_width = 450
            watermark_height = 180
            watermark_x = (PAGE_WIDTH - watermark_width) / 2
            watermark_y = (PAGE_HEIGHT - watermark_height) / 2
            c.setFillAlpha(0.15)
            c.drawImage(logo_watermark, watermark_x, watermark_y,
                       width=watermark_width, height=watermark_height,
                       preserveAspectRatio=True, mask='auto')
            c.restoreState()
    
    def draw_header():
        """Dibuja el encabezado con logos"""
        draw_watermark()
        
        if encabezado_img:
            encabezado_width = CONTENT_WIDTH + 1 * cm
            encabezado_height = 2.0 * cm
            encabezado_x = MARGIN_LEFT - 0.5 * cm
            encabezado_y = PAGE_HEIGHT - 2.2 * cm
            c.drawImage(encabezado_img, encabezado_x, encabezado_y,
                       width=encabezado_width, height=encabezado_height,
                       preserveAspectRatio=True, mask='auto')
        else:
            c.setFillColor(VERDE_INSTITUCIONAL)
            c.setFont(font_bold, 12)
            c.drawCentredString(PAGE_WIDTH/2, PAGE_HEIGHT - 1.5 * cm, 
                              "Asociación de Municipios del Catatumbo, Provincia de Ocaña y Sur del Cesar – Asomunicipios")
        
        return PAGE_HEIGHT - 2.8 * cm
    
    def draw_footer():
        """Dibuja el pie de página"""
        if pie_pagina_img:
            footer_height = 2.0 * cm
            c.drawImage(pie_pagina_img, 0, 0,
                       width=PAGE_WIDTH, height=footer_height,
                       preserveAspectRatio=False, mask='auto')
        else:
            c.setFillColor(VERDE_INSTITUCIONAL)
            c.rect(0, 0, PAGE_WIDTH, 28, fill=1, stroke=0)
            c.setFillColor(BLANCO)
            c.setFont(font_normal, 8)
            c.drawCentredString(PAGE_WIDTH/2, 10, "comunicaciones@asomunicipios.gov.co")
    
    def new_page():
        """Crea una nueva página"""
        nonlocal current_page
        draw_footer()
        c.showPage()
        current_page += 1
        y = draw_header()
        
        c.setFillColor(NEGRO)
        c.setFont(font_bold, 10)
        c.drawCentredString(PAGE_WIDTH/2, y, f"RESOLUCIÓN {numero_resolucion} (Continuación)")
        y -= 14
        c.setFont(font_normal, 8)
        c.drawCentredString(PAGE_WIDTH/2, y, f"Página {current_page}")
        return y - 20
    
    def check_page(y, needed_space=60):
        """Verifica si hay espacio suficiente"""
        if y < MARGIN_BOTTOM + needed_space:
            return new_page()
        return y
    
    def draw_justified_text(text, x, y, width, font_name, font_size, leading=12):
        """Dibuja texto justificado"""
        c.setFont(font_name, font_size)
        lines = simpleSplit(text, font_name, font_size, width)
        
        for i, line in enumerate(lines):
            y = check_page(y, leading + 10)
            
            if i < len(lines) - 1 and len(line.split()) > 1:
                words = line.split()
                if len(words) > 1:
                    total_word_width = sum(c.stringWidth(word, font_name, font_size) for word in words)
                    space_width = (width - total_word_width) / (len(words) - 1)
                    current_x = x
                    for j, word in enumerate(words):
                        c.drawString(current_x, y, word)
                        current_x += c.stringWidth(word, font_name, font_size) + space_width
                else:
                    c.drawString(x, y, line)
            else:
                c.drawString(x, y, line)
            
            y -= leading
        
        return y
    
    # ==================== PÁGINA 1 ====================
    y = draw_header()
    
    # Título de la resolución
    c.setFillColor(NEGRO)
    c.setFont(font_bold, 11)
    c.drawCentredString(PAGE_WIDTH/2, y, f"RESOLUCIÓN No. {numero_resolucion}")
    y -= 16
    
    c.setFont(font_normal, 9)
    c.drawCentredString(PAGE_WIDTH/2, y, f"({fecha_resolucion})")
    y -= 24
    
    # Título descriptivo
    titulo = plantilla["titulo"].format(municipio=municipio.upper())
    lines = simpleSplit(titulo, font_bold, 9, CONTENT_WIDTH)
    c.setFont(font_bold, 9)
    for line in lines:
        c.drawCentredString(PAGE_WIDTH/2, y, line)
        y -= 12
    y -= 10
    
    # Preámbulo
    y = draw_justified_text(
        plantilla["considerando_intro"],
        MARGIN_LEFT, y, CONTENT_WIDTH, font_normal, 9, 11
    )
    y -= 8
    
    # CONSIDERANDO
    c.setFont(font_bold, 10)
    c.drawCentredString(PAGE_WIDTH/2, y, "CONSIDERANDO")
    y -= 16
    
    # Texto personalizado o considerandos predeterminados
    if texto_considerando_personalizado and texto_considerando_personalizado.strip():
        # Reemplazar variables
        texto = texto_considerando_personalizado
        texto = texto.replace("(solicitante)", solicitante_nombre)
        texto = texto.replace("(documento)", solicitante_documento)
        texto = texto.replace("(codigo_predial)", codigo_predial)
        texto = texto.replace("(municipio)", municipio)
        texto = texto.replace("(radicado)", radicado)
        texto = texto.replace("(matricula)", matricula)
        texto = texto.replace("(area_terreno_anterior)", f"{area_terreno_anterior:,.2f}")
        texto = texto.replace("(area_terreno_nueva)", f"{area_terreno_nueva:,.2f}")
        texto = texto.replace("(area_construida_anterior)", f"{area_construida_anterior:,.2f}")
        texto = texto.replace("(area_construida_nueva)", f"{area_construida_nueva:,.2f}")
        
        y = draw_justified_text(texto, MARGIN_LEFT, y, CONTENT_WIDTH, font_normal, 9, 11)
    else:
        # Considerandos predeterminados
        considerandos = [
            plantilla["considerando_solicitud"].format(
                solicitante_nombre=solicitante_nombre,
                solicitante_documento=solicitante_documento,
                radicado=radicado,
                codigo_predial=codigo_predial
            ),
            plantilla["considerando_area_actual"].format(
                area_terreno_anterior=f"{area_terreno_anterior:,.2f}",
                area_construida_anterior=f"{area_construida_anterior:,.2f}",
                avaluo_anterior=f"{avaluo_anterior:,.0f}"
            ),
            plantilla["considerando_area_nueva"].format(
                area_terreno_nueva=f"{area_terreno_nueva:,.2f}",
                area_construida_nueva=f"{area_construida_nueva:,.2f}",
                avaluo_nuevo=f"{avaluo_nuevo:,.0f}"
            ),
            plantilla["considerando_analisis"],
            plantilla["considerando_legal"]
        ]
        
        for cons in considerandos:
            y = check_page(y, 40)
            y = draw_justified_text(cons, MARGIN_LEFT, y, CONTENT_WIDTH, font_normal, 9, 11)
            y -= 8
    
    y -= 10
    
    # RESUELVE
    c.setFont(font_bold, 10)
    c.drawCentredString(PAGE_WIDTH/2, y, "RESUELVE")
    y -= 16
    
    # ARTÍCULO PRIMERO
    y = check_page(y, 80)
    c.setFont(font_bold, 9)
    c.drawString(MARGIN_LEFT, y, "ARTÍCULO PRIMERO.-")
    y -= 12
    
    articulo_1 = plantilla["articulo_1_intro"].format(municipio=municipio)
    y = draw_justified_text(articulo_1, MARGIN_LEFT, y, CONTENT_WIDTH, font_normal, 9, 11)
    y -= 12
    
    # Tabla de CANCELACIÓN (Datos anteriores)
    y = check_page(y, 100)
    c.setFillColor(colors.HexColor('#C00000'))
    c.setFont(font_bold, 9)
    c.drawCentredString(PAGE_WIDTH/2, y, "CANCELACIÓN (Datos Anteriores)")
    y -= 14
    
    # Tabla de datos anteriores
    c.setFillColor(NEGRO)
    c.setFont(font_normal, 8)
    
    tabla_data = [
        ("Código Predial:", codigo_predial),
        ("Código Homologado:", codigo_homologado),
        ("Matrícula Inmobiliaria:", matricula),
        ("Dirección:", direccion),
        ("Destino Económico:", destino_economico),
        ("Área Terreno:", f"{area_terreno_anterior:,.2f} m²"),
        ("Área Construida:", f"{area_construida_anterior:,.2f} m²"),
        ("Avalúo:", f"${avaluo_anterior:,.0f}"),
        ("Propietario:", propietario_nombre)
    ]
    
    col1_x = MARGIN_LEFT + 10
    col2_x = MARGIN_LEFT + 130
    
    c.setStrokeColor(colors.HexColor('#C00000'))
    c.setLineWidth(1)
    c.rect(MARGIN_LEFT, y - (len(tabla_data) * 12) - 5, CONTENT_WIDTH, (len(tabla_data) * 12) + 10, stroke=1, fill=0)
    
    for label, valor in tabla_data:
        c.setFont(font_bold, 8)
        c.drawString(col1_x, y, label)
        c.setFont(font_normal, 8)
        c.drawString(col2_x, y, str(valor)[:60])
        y -= 12
    
    y -= 15
    
    # Tabla de INSCRIPCIÓN (Datos nuevos)
    y = check_page(y, 100)
    c.setFillColor(colors.HexColor('#008000'))
    c.setFont(font_bold, 9)
    c.drawCentredString(PAGE_WIDTH/2, y, "INSCRIPCIÓN (Datos Rectificados)")
    y -= 14
    
    c.setFillColor(NEGRO)
    c.setFont(font_normal, 8)
    
    tabla_nueva = [
        ("Código Predial:", codigo_predial),
        ("Código Homologado:", codigo_homologado),
        ("Matrícula Inmobiliaria:", matricula),
        ("Dirección:", direccion),
        ("Destino Económico:", destino_economico),
        ("Área Terreno:", f"{area_terreno_nueva:,.2f} m²"),
        ("Área Construida:", f"{area_construida_nueva:,.2f} m²"),
        ("Avalúo:", f"${avaluo_nuevo:,.0f}"),
        ("Propietario:", propietario_nombre)
    ]
    
    c.setStrokeColor(colors.HexColor('#008000'))
    c.rect(MARGIN_LEFT, y - (len(tabla_nueva) * 12) - 5, CONTENT_WIDTH, (len(tabla_nueva) * 12) + 10, stroke=1, fill=0)
    
    for label, valor in tabla_nueva:
        c.setFont(font_bold, 8)
        c.drawString(col1_x, y, label)
        c.setFont(font_normal, 8)
        c.drawString(col2_x, y, str(valor)[:60])
        y -= 12
    
    y -= 15
    
    # Diferencia de áreas
    y = check_page(y, 40)
    diferencia_terreno = area_terreno_nueva - area_terreno_anterior
    diferencia_construida = area_construida_nueva - area_construida_anterior
    
    c.setFillColor(colors.HexColor('#0891b2'))
    c.setFont(font_bold, 8)
    c.drawString(MARGIN_LEFT, y, f"Diferencia Área Terreno: {diferencia_terreno:+,.2f} m² | Diferencia Área Construida: {diferencia_construida:+,.2f} m²")
    y -= 20
    
    # ARTÍCULOS RESTANTES
    articulos = [
        ("ARTÍCULO SEGUNDO.-", plantilla["articulo_2"]),
        ("ARTÍCULO TERCERO.-", plantilla["articulo_3"]),
        ("ARTÍCULO CUARTO.-", plantilla["articulo_4"]),
        ("ARTÍCULO QUINTO.-", plantilla["articulo_5"])
    ]
    
    c.setFillColor(NEGRO)
    for titulo_art, texto_art in articulos:
        y = check_page(y, 50)
        c.setFont(font_bold, 9)
        c.drawString(MARGIN_LEFT, y, titulo_art)
        y -= 12
        y = draw_justified_text(texto_art, MARGIN_LEFT, y, CONTENT_WIDTH, font_normal, 9, 11)
        y -= 10
    
    # Cierre
    y = check_page(y, 120)
    y -= 15
    c.setFont(font_bold, 10)
    c.drawCentredString(PAGE_WIDTH/2, y, plantilla["cierre"])
    y -= 30
    
    # Firma
    if firma_img:
        firma_width = 120
        firma_height = 50
        c.drawImage(firma_img, (PAGE_WIDTH - firma_width) / 2, y - firma_height,
                   width=firma_width, height=firma_height,
                   preserveAspectRatio=True, mask='auto')
        y -= firma_height + 5
    
    c.setFont(font_bold, 9)
    c.drawCentredString(PAGE_WIDTH/2, y, plantilla["firmante_nombre"])
    y -= 12
    c.setFont(font_normal, 8)
    c.drawCentredString(PAGE_WIDTH/2, y, plantilla["firmante_cargo"])
    y -= 25
    
    # Elaboró / Revisó
    c.setFont(font_normal, 7)
    c.drawString(MARGIN_LEFT, y, f"Elaboró: {elaboro}")
    y -= 10
    c.drawString(MARGIN_LEFT, y, f"Revisó: {aprobo}")
    y -= 20
    
    # QR de verificación
    if qr_img and codigo_verificacion:
        y = check_page(y, 80)
        qr_size = 60
        qr_x = PAGE_WIDTH - MARGIN_RIGHT - qr_size
        qr_y = y - qr_size
        c.drawImage(qr_img, qr_x, qr_y, width=qr_size, height=qr_size)
        
        c.setFont(font_normal, 6)
        c.drawString(qr_x, qr_y - 10, f"Código: {codigo_verificacion}")
        c.drawString(qr_x, qr_y - 18, "Escanee para verificar")
    
    # Pie de página final
    draw_footer()
    
    c.save()
    buffer.seek(0)
    return buffer.getvalue()
