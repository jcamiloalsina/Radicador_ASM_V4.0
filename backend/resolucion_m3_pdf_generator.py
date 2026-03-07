"""
Generador de PDF de Resolución Catastral - Mutación Tercera (M3)
Cambio de Destino Económico e Incorporación de Construcción
Incluye encabezado y pie de página institucional IDÉNTICOS al M1 y M2
QR de verificación incluido
"""
import io
import os
import base64
import hashlib
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas
from reportlab.lib.utils import simpleSplit, ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Importar imágenes por defecto
from certificado_images import get_encabezado_image, get_pie_pagina_image, get_firma_dalgie_image

# Configuración de página - IDÉNTICA a M2
PAGE_WIDTH, PAGE_HEIGHT = letter
MARGIN_LEFT = 2.0 * cm
MARGIN_RIGHT = 2.0 * cm
MARGIN_TOP = 2.8 * cm
MARGIN_BOTTOM = 2.5 * cm
CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT

# Colores institucionales
VERDE_INSTITUCIONAL = colors.HexColor('#009846')
NEGRO = colors.HexColor('#000000')
BLANCO = colors.HexColor('#FFFFFF')


def obtener_datos_r1_r2_pdf(predio: dict) -> dict:
    """
    Obtiene datos de R1 y R2 del predio para los cuadros de cancelación/inscripción.
    R1: codigo_homologado, direccion, destino_economico, area_terreno, area_construida, avaluo
    R2: matricula_inmobiliaria
    """
    if not predio:
        return {
            'codigo_homologado': '',
            'direccion': '',
            'destino_economico': '',
            'area_terreno': 0,
            'area_construida': 0,
            'avaluo': 0,
            'matricula_inmobiliaria': ''
        }
    
    r1 = predio.get('r1_registros', [])
    r2 = predio.get('r2_registros', [])
    
    r1_data = r1[0] if r1 else {}
    r2_data = r2[0] if r2 else {}
    
    return {
        'codigo_homologado': r1_data.get('codigo_homologado') or predio.get('codigo_homologado', ''),
        'direccion': r1_data.get('direccion') or predio.get('direccion', ''),
        'destino_economico': r1_data.get('destino_economico') or predio.get('destino_economico', ''),
        'area_terreno': r1_data.get('area_terreno') or predio.get('area_terreno', 0),
        'area_construida': r1_data.get('area_construida') or predio.get('area_construida', 0),
        'avaluo': r1_data.get('avaluo') or predio.get('avaluo', 0),
        'matricula_inmobiliaria': r2_data.get('matricula_inmobiliaria') or predio.get('matricula_inmobiliaria', '')
    }


def get_m3_plantilla():
    """Retorna la plantilla de textos para M3"""
    return {
        "titulo_cambio_destino": "POR LA CUAL SE ORDENAN UNOS CAMBIOS EN EL CATASTRO DEL MUNICIPIO DE {municipio} Y SE HACE UN CAMBIO DE DESTINO ECONÓMICO",
        "titulo_incorporacion": "POR LA CUAL SE ORDENAN UNOS CAMBIOS EN EL CATASTRO DEL MUNICIPIO DE {municipio} Y SE INCORPORAN UNAS CONSTRUCCIONES",
        "preambulo": (
            "La Asociación de Municipios del Catatumbo, Provincia de Ocaña y Sur del Cesar – Asomunicipios "
            "en uso de sus facultades legales otorgadas por la Resolución IGAC 1204 del 2021, en "
            "concordancia con la Ley 14 de 1983, el Decreto 148 de 2020 y la Resolución 1040 de 2023 del "
            "Instituto Geográfico Agustín Codazzi \"Por medio de la cual se expide la resolución única de la "
            "gestión catastral multipropósito\", y"
        ),
        "considerando_cambio_destino": (
            "Qué, el(la) ciudadano(a) {solicitante_nombre}, identificado(a) con la Cédula de Ciudadanía No. {solicitante_documento}, "
            "en su condición de propietario(a) del predio identificado con código catastral (NPN) {codigo_predial}, "
            "ubicado en el municipio de {municipio}, solicitó el cambio de destino económico del predio.\n\n"
            "Que una vez realizada la inspección ocular en terreno y/o por métodos indirectos, declarativos y colaborativos, "
            "se encontraron modificaciones físicas y económicas que sugieren un cambio en el destino económico del predio, "
            "por lo cual es pertinente actualizar la base de datos catastral para la vigencia {vigencia}."
        ),
        "considerando_incorporacion": (
            "Qué, el(la) ciudadano(a) {solicitante_nombre}, identificado(a) con la Cédula de Ciudadanía No. {solicitante_documento}, "
            "en su condición de propietario(a) del predio identificado con código catastral (NPN) {codigo_predial}, "
            "ubicado en el municipio de {municipio}, solicitó la incorporación de construcciones al registro catastral.\n\n"
            "Que una vez realizada la inspección ocular en terreno y/o por métodos indirectos, declarativos y colaborativos, "
            "se encontraron nuevas construcciones en el predio que no se encuentran registradas en la base catastral, "
            "por lo cual es pertinente incorporar estas construcciones y actualizar la base de datos para la vigencia {vigencia}."
        ),
        "resuelve_intro": (
            "Que conforme a lo anterior, es necesario realizar una mutación de tercera clase y proceder con la "
            "cancelación e inscripción correspondiente, de acuerdo con lo establecido en el literal C del Artículo "
            "2.2.2.2.2 del Decreto 148 de 2020, el Numeral 3 del Artículo 4.5.1, y los Artículos 4.5.2, 4.6.4 y "
            "4.7.13 de la Resolución 1040 de 2023."
        ),
        "articulo_2": "De conformidad con lo dispuesto en el artículo 4.8.2 de la Resolución 1040 de 2023, el presente acto administrativo se notificará personalmente y subsidiariamente por aviso siguiendo el procedimiento previsto en los Artículos 67, 68 y 69 de la Ley 1437 de 2011 (CPA y CCA), procederá la notificación electrónica siempre y cuando el interesado acepte ser notificado de esta manera.",
        "articulo_3": "Contra el presente acto administrativo proceden los recursos de reposición y subsidio de apelación, ante el funcionario que dictó la decisión, podrán interponerse por escrito en la diligencia de notificación personal, o dentro de los diez (10) días hábiles siguientes a su notificación, de conformidad con lo preceptuado en el Artículo 4.8.2 de la Resolución 1040 de 2023 y lo dispuesto en Artículo 74 y 76 de la Ley 1437 de 2011 o la norma que la modifique, adicione o sustituya.",
        "articulo_4": "Los recursos se concederán en el efecto suspensivo y por consiguiente la anotación de la inscripción catastral en los documentos de la tesorería municipal u oficina recaudadora solo se efectuarán hasta la ejecutoria del acto administrativo.",
        "cierre": "COMUNÍQUESE, NOTIFÍQUESE Y CÚMPLASE",
        "firmante_nombre": "DALGIE ESPERANZA TORRADO RIZO",
        "firmante_cargo": "SUBDIRECTORA FINANCIERA Y ADMINISTRATIVA"
    }


def formatear_area(area):
    """Formatea el área con unidades"""
    try:
        area = float(area)
        if area >= 10000:
            return f"{area/10000:,.2f} ha"
        else:
            return f"{area:,.0f} m²"
    except:
        return "0 m²"


def generate_resolucion_m3_pdf(
    data: dict,
    imagen_encabezado_b64: str = None,
    imagen_pie_b64: str = None,
    imagen_firma_b64: str = None,
    codigo_verificacion: str = None,
    verificacion_base_url: str = None
) -> bytes:
    """
    Genera el PDF de la resolución M3 (Cambio de destino / Incorporación de construcción)
    Con encabezado, pie de página y QR de verificación IDÉNTICOS al M1 y M2
    """
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    
    # Fuentes
    font_normal = "Helvetica"
    font_bold = "Helvetica-Bold"
    
    # Cargar imágenes
    encabezado_img = None
    pie_pagina_img = None
    firma_dalgie = None
    logo_watermark = None
    
    try:
        if imagen_encabezado_b64:
            encabezado_img = ImageReader(io.BytesIO(base64.b64decode(imagen_encabezado_b64)))
        else:
            encabezado_img = ImageReader(get_encabezado_image())
    except Exception as e:
        print(f"Error cargando encabezado: {e}")
    
    try:
        if imagen_pie_b64:
            pie_pagina_img = ImageReader(io.BytesIO(base64.b64decode(imagen_pie_b64)))
        else:
            pie_pagina_img = ImageReader(get_pie_pagina_image())
    except Exception as e:
        print(f"Error cargando pie de página: {e}")
    
    try:
        if imagen_firma_b64:
            firma_dalgie = ImageReader(io.BytesIO(base64.b64decode(imagen_firma_b64)))
        else:
            # get_firma_dalgie_image() ya retorna un BytesIO
            firma_dalgie = ImageReader(get_firma_dalgie_image())
    except Exception as e:
        print(f"Error cargando firma: {e}")
    
    # Cargar watermark (marca de agua) - IDÉNTICO al M2
    try:
        logo_path = "/app/frontend/public/watermark-gray.png"
        if os.path.exists(logo_path):
            logo_watermark = ImageReader(logo_path)
    except Exception as e:
        print(f"Error cargando marca de agua: {e}")
    
    # Variables de control
    y_position = PAGE_HEIGHT - MARGIN_TOP
    page_number = 1
    
    # Obtener datos
    numero_resolucion = data.get("numero_resolucion", "RES-XX-XXX-0000-2026")
    fecha_resolucion = data.get("fecha_resolucion", datetime.now().strftime("%d/%m/%Y"))
    municipio = data.get("municipio", "")
    subtipo = data.get("subtipo", "cambio_destino")
    radicado = data.get("radicado", "")
    predio = data.get("predio", {})
    solicitante = data.get("solicitante", {})
    plantilla = get_m3_plantilla()
    elaboro = data.get("elaborado_por", "")
    aprobo = data.get("revisado_por", "")
    texto_considerando_personalizado = data.get("texto_considerando")  # Texto personalizado de considerandos
    
    # Datos del solicitante
    solicitante_nombre = solicitante.get("nombre", "NO ESPECIFICADO")
    solicitante_documento = solicitante.get("documento", "N/A")
    codigo_predial = predio.get("codigo_predial_nacional", predio.get("numero_predio", ""))
    
    # Marca de agua - IDÉNTICA al M2
    def draw_watermark():
        """Dibuja la marca de agua con el logo de Asomunicipios - IDÉNTICO al M2"""
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
        """Dibuja el encabezado institucional IDÉNTICO al M2"""
        nonlocal y_position
        draw_watermark()
        
        if encabezado_img:
            encabezado_width = CONTENT_WIDTH + 1 * cm
            encabezado_height = 2.0 * cm
            encabezado_x = MARGIN_LEFT - 0.5 * cm
            encabezado_y = PAGE_HEIGHT - 2.2 * cm
            c.drawImage(encabezado_img, encabezado_x, encabezado_y, 
                        width=encabezado_width, height=encabezado_height, 
                        preserveAspectRatio=True, mask='auto')
        
        y_position = PAGE_HEIGHT - 2.8 * cm
        return y_position
    
    def draw_footer():
        """Dibuja el pie de página institucional IDÉNTICO al M2"""
        if pie_pagina_img:
            footer_height = 2.0 * cm
            c.drawImage(pie_pagina_img, 0, 0, 
                        width=PAGE_WIDTH, height=footer_height, 
                        preserveAspectRatio=False, mask='auto')
        
        # Número de página
        c.setFillColor(NEGRO)
        c.setFont(font_normal, 8)
        c.drawRightString(PAGE_WIDTH - MARGIN_RIGHT, MARGIN_BOTTOM - 1.5*cm, 
                         f"Página {page_number}")
    
    def nueva_pagina():
        nonlocal y_position, page_number
        draw_footer()
        c.showPage()
        page_number += 1
        y_position = draw_header()
        
        c.setFillColor(NEGRO)
        c.setFont(font_bold, 11)
        c.drawCentredString(PAGE_WIDTH/2, y_position, "RESOLUCIÓN (Continuación)")
        y_position -= 14
        c.setFont(font_normal, 9)
        c.drawCentredString(PAGE_WIDTH/2, y_position, f"Resolución No: {numero_resolucion}")
        y_position -= 20
        
        return y_position
    
    def verificar_espacio(necesario):
        nonlocal y_position
        if y_position - necesario < MARGIN_BOTTOM + 1*cm:
            nueva_pagina()
    
    def dibujar_texto_justificado(texto, font_name=None, font_size=10, line_height=14):
        """Dibuja texto justificado"""
        nonlocal y_position
        fname = font_name or font_normal
        c.setFont(fname, font_size)
        lines = simpleSplit(texto, fname, font_size, CONTENT_WIDTH)
        
        espacio_normal = c.stringWidth(' ', fname, font_size)
        max_space = espacio_normal * 3
        
        for i, line in enumerate(lines):
            verificar_espacio(line_height)
            
            line_width = c.stringWidth(line, fname, font_size)
            if i == len(lines) - 1 or line_width < CONTENT_WIDTH * 0.75:
                c.drawString(MARGIN_LEFT, y_position, line)
            else:
                words = line.split(' ')
                if len(words) > 1:
                    total_words_width = sum(c.stringWidth(word, fname, font_size) for word in words)
                    total_space = CONTENT_WIDTH - total_words_width
                    space_between = total_space / (len(words) - 1)
                    
                    if space_between > max_space:
                        c.drawString(MARGIN_LEFT, y_position, line)
                    else:
                        x = MARGIN_LEFT
                        for j, word in enumerate(words):
                            c.drawString(x, y_position, word)
                            x += c.stringWidth(word, fname, font_size)
                            if j < len(words) - 1:
                                x += space_between
                else:
                    c.drawString(MARGIN_LEFT, y_position, line)
            
            y_position -= line_height
    
    def dibujar_articulo_justificado(numero_articulo, texto, font_size=10, line_height=14):
        """Dibuja un artículo con título en bold y texto justificado"""
        nonlocal y_position
        verificar_espacio(80)
        
        # Título del artículo en bold
        c.setFont(font_bold, font_size)
        c.setFillColor(NEGRO)
        titulo = f"Artículo {numero_articulo}. "
        titulo_width = c.stringWidth(titulo, font_bold, font_size)
        c.drawString(MARGIN_LEFT, y_position, titulo)
        
        # Primera línea del texto después del título
        c.setFont(font_normal, font_size)
        lines = simpleSplit(texto, font_normal, font_size, CONTENT_WIDTH - titulo_width)
        
        if lines:
            c.drawString(MARGIN_LEFT + titulo_width, y_position, lines[0])
            y_position -= line_height
        
        # Resto del texto justificado
        if len(lines) > 1:
            resto_texto = ' '.join(lines[1:])
            all_lines = simpleSplit(resto_texto, font_normal, font_size, CONTENT_WIDTH)
            
            espacio_normal = c.stringWidth(' ', font_normal, font_size)
            max_space = espacio_normal * 3
            
            for i, line in enumerate(all_lines):
                verificar_espacio(line_height)
                line_width = c.stringWidth(line, font_normal, font_size)
                
                # No justificar la última línea
                if i == len(all_lines) - 1 or line_width < CONTENT_WIDTH * 0.75:
                    c.drawString(MARGIN_LEFT, y_position, line)
                else:
                    words = line.split(' ')
                    if len(words) > 1:
                        total_words_width = sum(c.stringWidth(word, font_normal, font_size) for word in words)
                        total_space = CONTENT_WIDTH - total_words_width
                        space_between = total_space / (len(words) - 1)
                        
                        if space_between > max_space:
                            c.drawString(MARGIN_LEFT, y_position, line)
                        else:
                            x = MARGIN_LEFT
                            for j, word in enumerate(words):
                                c.drawString(x, y_position, word)
                                x += c.stringWidth(word, font_normal, font_size)
                                if j < len(words) - 1:
                                    x += space_between
                    else:
                        c.drawString(MARGIN_LEFT, y_position, line)
                
                y_position -= line_height
        
        y_position -= 10  # Espacio después del artículo
    
    def dibujar_tabla_predio(titulo_seccion, destino_val, avaluo_val, es_cancelacion=True):
        """Dibuja tabla de predio IDÉNTICO al M2 - con encabezado verde y texto blanco"""
        nonlocal y_position
        
        verificar_espacio(80)
        
        # Título de sección con rectángulo verde y texto blanco - IDÉNTICO al M2
        c.setFillColor(VERDE_INSTITUCIONAL)
        c.rect(MARGIN_LEFT, y_position - 12, CONTENT_WIDTH, 15, fill=1, stroke=0)
        c.setFillColor(BLANCO)
        c.setFont(font_bold, 10)
        c.drawCentredString(PAGE_WIDTH/2, y_position - 9, titulo_seccion)
        y_position -= 20
        
        c.setFillColor(NEGRO)
        
        # Primera fila de encabezados
        c.setFillColor(colors.HexColor('#e8e8e8'))
        c.rect(MARGIN_LEFT, y_position - 12, CONTENT_WIDTH, 12, fill=1, stroke=1)
        c.setFillColor(NEGRO)
        c.setFont(font_bold, 7)
        
        col_widths = [CONTENT_WIDTH * 0.32, CONTENT_WIDTH * 0.30, CONTENT_WIDTH * 0.10, CONTENT_WIDTH * 0.18, CONTENT_WIDTH * 0.10]
        headers = ["N° PREDIAL", "APELLIDOS Y NOMBRES", "TIPO DOC.", "NRO. DOC.", "DESTINO"]
        x = MARGIN_LEFT
        for i, header in enumerate(headers):
            c.drawCentredString(x + col_widths[i]/2, y_position - 9, header)
            c.rect(x, y_position - 12, col_widths[i], 12, fill=0, stroke=1)
            x += col_widths[i]
        y_position -= 12
        
        # Datos del propietario
        c.setFont(font_normal, 7)
        propietario = predio.get("propietarios", [{}])
        if propietario and len(propietario) > 0:
            prop = propietario[0]
            nombre_prop = prop.get("nombre_propietario", prop.get("nombre", ""))[:40]
            tipo_doc = prop.get("tipo_documento", "CC")
            nro_doc = str(prop.get("numero_documento", prop.get("documento", ""))).replace(".", "")
        else:
            nombre_prop = solicitante_nombre[:40]
            tipo_doc = solicitante.get("tipo_documento", "CC")
            nro_doc = solicitante_documento.replace(".", "")
        
        x = MARGIN_LEFT
        c.rect(x, y_position - 12, col_widths[0], 12, fill=0, stroke=1)
        c.setFont(font_normal, 6)
        c.drawCentredString(x + col_widths[0]/2, y_position - 9, codigo_predial[:30])
        x += col_widths[0]
        
        c.setFont(font_normal, 7)
        c.rect(x, y_position - 12, col_widths[1], 12, fill=0, stroke=1)
        c.drawCentredString(x + col_widths[1]/2, y_position - 9, nombre_prop[:28])
        x += col_widths[1]
        
        c.rect(x, y_position - 12, col_widths[2], 12, fill=0, stroke=1)
        c.drawCentredString(x + col_widths[2]/2, y_position - 9, tipo_doc)
        x += col_widths[2]
        
        c.rect(x, y_position - 12, col_widths[3], 12, fill=0, stroke=1)
        c.drawCentredString(x + col_widths[3]/2, y_position - 9, nro_doc[:15])
        x += col_widths[3]
        
        c.rect(x, y_position - 12, col_widths[4], 12, fill=0, stroke=1)
        c.drawCentredString(x + col_widths[4]/2, y_position - 9, destino_val)
        y_position -= 12
        
        # Segunda fila de encabezados
        c.setFillColor(colors.HexColor('#e8e8e8'))
        c.rect(MARGIN_LEFT, y_position - 12, CONTENT_WIDTH, 12, fill=1, stroke=1)
        c.setFillColor(NEGRO)
        c.setFont(font_bold, 7)
        
        col_widths2 = [CONTENT_WIDTH * 0.15, CONTENT_WIDTH * 0.25, CONTENT_WIDTH * 0.15, CONTENT_WIDTH * 0.15, CONTENT_WIDTH * 0.15, CONTENT_WIDTH * 0.15]
        headers2 = ["CÓD. HOMOLOGADO", "DIRECCIÓN", "A-TERRENO", "A-CONS", "AVALÚO", "VIG. FISCAL"]
        x = MARGIN_LEFT
        for i, header in enumerate(headers2):
            c.drawCentredString(x + col_widths2[i]/2, y_position - 9, header)
            c.rect(x, y_position - 12, col_widths2[i], 12, fill=0, stroke=1)
            x += col_widths2[i]
        y_position -= 12
        
        # Valores - OBTENER DE R1/R2
        c.setFont(font_normal, 7)
        datos_r1_r2 = obtener_datos_r1_r2_pdf(predio)
        codigo_hom = datos_r1_r2.get("codigo_homologado", "")
        direccion = (datos_r1_r2.get("direccion", "") or "")[:20]
        area_terreno = datos_r1_r2.get("area_terreno", 0)
        area_construida = datos_r1_r2.get("area_construida", 0)
        matricula = datos_r1_r2.get("matricula_inmobiliaria", "") or "Sin información"
        
        area_terreno_fmt = formatear_area(area_terreno)
        area_construida_fmt = formatear_area(area_construida)
        # Usar avaluo_val del parámetro o de R1/R2 como fallback
        avaluo_para_tabla = avaluo_val if avaluo_val is not None else datos_r1_r2.get("avaluo", 0)
        avaluo_fmt = f"${avaluo_para_tabla:,.0f}" if avaluo_para_tabla else "$0"
        vigencia = str(datetime.now().year)
        
        x = MARGIN_LEFT
        c.rect(x, y_position - 12, col_widths2[0], 12, fill=0, stroke=1)
        c.setFont(font_normal, 6)
        c.drawCentredString(x + col_widths2[0]/2, y_position - 9, codigo_hom[:15] if codigo_hom else "")
        x += col_widths2[0]
        
        c.setFont(font_normal, 7)
        c.rect(x, y_position - 12, col_widths2[1], 12, fill=0, stroke=1)
        c.drawCentredString(x + col_widths2[1]/2, y_position - 9, direccion)
        x += col_widths2[1]
        
        c.rect(x, y_position - 12, col_widths2[2], 12, fill=0, stroke=1)
        c.drawCentredString(x + col_widths2[2]/2, y_position - 9, area_terreno_fmt)
        x += col_widths2[2]
        
        c.rect(x, y_position - 12, col_widths2[3], 12, fill=0, stroke=1)
        c.drawCentredString(x + col_widths2[3]/2, y_position - 9, area_construida_fmt)
        x += col_widths2[3]
        
        c.rect(x, y_position - 12, col_widths2[4], 12, fill=0, stroke=1)
        c.drawCentredString(x + col_widths2[4]/2, y_position - 9, avaluo_fmt)
        x += col_widths2[4]
        
        c.rect(x, y_position - 12, col_widths2[5], 12, fill=0, stroke=1)
        c.drawCentredString(x + col_widths2[5]/2, y_position - 9, vigencia)
        y_position -= 12
        
        # Fila de Matrícula inmobiliaria - IDÉNTICA al M2
        c.setFillColor(colors.HexColor('#e8e8e8'))
        c.rect(MARGIN_LEFT, y_position - 12, CONTENT_WIDTH * 0.3, 12, fill=1, stroke=1)
        c.setFillColor(NEGRO)
        c.setFont(font_bold, 7)
        c.drawCentredString(MARGIN_LEFT + (CONTENT_WIDTH * 0.3)/2, y_position - 9, "MATRÍCULA INMOBILIARIA")
        c.setFont(font_normal, 7)
        c.rect(MARGIN_LEFT + CONTENT_WIDTH * 0.3, y_position - 12, CONTENT_WIDTH * 0.7, 12, fill=0, stroke=1)
        c.drawCentredString(MARGIN_LEFT + CONTENT_WIDTH * 0.3 + (CONTENT_WIDTH * 0.7)/2, y_position - 9, matricula)
        y_position -= 15
        
        # VIGENCIAS FISCALES DE INSCRIPCIÓN - Solo AÑO VIGENCIA y AVALÚO CATASTRAL (sin FUENTE)
        fechas_inscripcion = data.get("fechas_inscripcion", [])
        if fechas_inscripcion and len(fechas_inscripcion) > 0:
            verificar_espacio(40 + len(fechas_inscripcion) * 12)
            
            # Título de la sección con fondo verde
            c.setFillColor(VERDE_INSTITUCIONAL)
            c.rect(MARGIN_LEFT, y_position - 12, CONTENT_WIDTH, 12, fill=1, stroke=0)
            c.setFillColor(BLANCO)
            c.setFont(font_bold, 7)
            c.drawCentredString(PAGE_WIDTH/2, y_position - 9, "VIGENCIAS FISCALES DE INSCRIPCIÓN")
            y_position -= 12
            
            # Headers de la tabla de vigencias - Solo 2 columnas
            c.setFillColor(VERDE_INSTITUCIONAL)
            c.rect(MARGIN_LEFT, y_position - 12, CONTENT_WIDTH, 12, fill=1, stroke=0)
            c.setFillColor(BLANCO)
            c.setFont(font_bold, 7)
            
            col_widths_vig = [CONTENT_WIDTH * 0.40, CONTENT_WIDTH * 0.60]
            headers_vig = ["AÑO VIGENCIA", "AVALÚO CATASTRAL"]
            x = MARGIN_LEFT
            for i, header in enumerate(headers_vig):
                c.drawCentredString(x + col_widths_vig[i]/2, y_position - 9, header)
                x += col_widths_vig[i]
            y_position -= 12
            
            # Filas de datos de vigencias
            c.setFillColor(NEGRO)
            c.setFont(font_normal, 7)
            for fecha in fechas_inscripcion:
                año = str(fecha.get("año_vigencia", fecha.get("año", "")))
                avaluo_fecha = fecha.get("avaluo", 0)
                
                # Formatear avalúo
                try:
                    avaluo_vig_fmt = f"${float(avaluo_fecha):,.0f}".replace(",", ".")
                except:
                    avaluo_vig_fmt = str(avaluo_fecha)
                
                c.setStrokeColor(colors.lightgrey)
                c.rect(MARGIN_LEFT, y_position - 12, CONTENT_WIDTH, 12, stroke=1, fill=0)
                
                x = MARGIN_LEFT
                c.drawCentredString(x + col_widths_vig[0]/2, y_position - 9, año)
                x += col_widths_vig[0]
                
                c.drawCentredString(x + col_widths_vig[1]/2, y_position - 9, avaluo_vig_fmt)
                y_position -= 12
            
            y_position -= 5
    
    # ==========================================
    # INICIO DEL DOCUMENTO
    # ==========================================
    
    y_position = draw_header()
    
    # Número de resolución y fecha
    y_position -= 10
    c.setFillColor(NEGRO)
    c.setFont(font_bold, 12)
    c.drawCentredString(PAGE_WIDTH/2, y_position, f"RESOLUCIÓN No: {numero_resolucion}")
    y_position -= 16
    c.setFont(font_normal, 10)
    c.drawCentredString(PAGE_WIDTH/2, y_position, f"FECHA RESOLUCIÓN: {fecha_resolucion}")
    y_position -= 20
    
    # Título según subtipo
    if subtipo == "cambio_destino":
        titulo = plantilla["titulo_cambio_destino"].format(municipio=municipio.upper())
    else:
        titulo = plantilla["titulo_incorporacion"].format(municipio=municipio.upper())
    
    c.setFont(font_bold, 10)
    lines = simpleSplit(titulo, font_bold, 10, CONTENT_WIDTH)
    for line in lines:
        verificar_espacio(14)
        c.drawCentredString(PAGE_WIDTH/2, y_position, line)
        y_position -= 14
    y_position -= 10
    
    # ==========================================
    # CONSIDERANDO
    # ==========================================
    
    verificar_espacio(30)
    c.setFont(font_bold, 11)
    c.drawCentredString(PAGE_WIDTH/2, y_position, "CONSIDERANDO")
    y_position -= 20
    c.setFillColor(NEGRO)
    
    dibujar_texto_justificado(plantilla["preambulo"], font_size=10, line_height=13)
    y_position -= 10
    
    # Usar texto personalizado si está disponible, sino usar plantilla estándar
    if texto_considerando_personalizado:
        # Reemplazar variables en el texto personalizado (usando paréntesis)
        texto_considerando = texto_considerando_personalizado
        try:
            texto_considerando = texto_considerando.replace('(solicitante)', solicitante_nombre)
            texto_considerando = texto_considerando.replace('(documento)', solicitante_documento)
            texto_considerando = texto_considerando.replace('(codigo_predial)', codigo_predial)
            texto_considerando = texto_considerando.replace('(municipio)', municipio)
            texto_considerando = texto_considerando.replace('(radicado)', radicado)
            texto_considerando = texto_considerando.replace('(matricula)', predio.get("matricula_inmobiliaria", "Sin información"))
            texto_considerando = texto_considerando.replace('(destino_anterior)', data.get("destino_anterior", ""))
            texto_considerando = texto_considerando.replace('(destino_nuevo)', data.get("destino_nuevo", ""))
            texto_considerando = texto_considerando.replace('(vigencia)', str(datetime.now().year))
        except Exception:
            pass
    elif subtipo == "cambio_destino":
        texto_considerando = plantilla["considerando_cambio_destino"].format(
            solicitante_nombre=solicitante_nombre,
            solicitante_documento=solicitante_documento,
            codigo_predial=codigo_predial,
            municipio=municipio,
            vigencia=datetime.now().year
        )
    else:
        texto_considerando = plantilla["considerando_incorporacion"].format(
            solicitante_nombre=solicitante_nombre,
            solicitante_documento=solicitante_documento,
            codigo_predial=codigo_predial,
            municipio=municipio,
            vigencia=datetime.now().year
        )
    
    dibujar_texto_justificado(texto_considerando, font_size=10, line_height=13)
    y_position -= 10
    
    # Documentos aportados
    verificar_espacio(60)
    c.setFont(font_normal, 10)
    c.drawString(MARGIN_LEFT, y_position, "Documentos aportados:")
    y_position -= 14
    
    documentos = [
        "• Oficio de solicitud y autorización.",
        "• Fotocopia cédula de ciudadanía del propietario.",
        "• Escritura pública del predio.",
        "• Matrícula inmobiliaria."
    ]
    for doc in documentos:
        verificar_espacio(14)
        c.drawString(MARGIN_LEFT + 20, y_position, doc)
        y_position -= 12
    y_position -= 10
    
    dibujar_texto_justificado(plantilla["resuelve_intro"], font_size=10, line_height=13)
    y_position -= 15
    
    # ==========================================
    # RESUELVE
    # ==========================================
    
    verificar_espacio(30)
    c.setFont(font_bold, 11)
    c.drawCentredString(PAGE_WIDTH/2, y_position, "RESUELVE")
    y_position -= 20
    c.setFillColor(NEGRO)
    
    c.setFont(font_bold, 10)
    c.drawString(MARGIN_LEFT, y_position, f"Artículo 1. Ordenar la inscripción en el catastro del Municipio de {municipio.upper()} los siguientes cambios:")
    y_position -= 20
    
    # Datos de cancelación e inscripción
    destino_anterior = data.get("destino_anterior", predio.get("destino_economico", ""))
    destino_nuevo = data.get("destino_nuevo", destino_anterior) if subtipo == "cambio_destino" else destino_anterior
    avaluo_anterior = data.get("avaluo_anterior", predio.get("avaluo", 0))
    avaluo_nuevo = data.get("avaluo_nuevo", 0)
    
    # Tabla CANCELACIÓN
    dibujar_tabla_predio("CANCELACIÓN", destino_anterior, avaluo_anterior, True)
    
    # Tabla INSCRIPCIÓN
    dibujar_tabla_predio("INSCRIPCIÓN", destino_nuevo, avaluo_nuevo, False)
    
    # ==========================================
    # CONSTRUCCIONES INCORPORADAS (solo para incorporacion_construccion)
    # ==========================================
    
    if subtipo == "incorporacion_construccion":
        construcciones = data.get("construcciones_nuevas", [])
        if construcciones:
            verificar_espacio(50 + len(construcciones) * 14)
            
            c.setFillColor(VERDE_INSTITUCIONAL)
            c.setFont(font_bold, 9)
            c.drawString(MARGIN_LEFT, y_position, "CONSTRUCCIONES INCORPORADAS")
            y_position -= 15
            
            # Proporcional al CONTENT_WIDTH
            const_col_widths = [CONTENT_WIDTH * 0.12, CONTENT_WIDTH * 0.12, CONTENT_WIDTH * 0.12, CONTENT_WIDTH * 0.12, CONTENT_WIDTH * 0.12, CONTENT_WIDTH * 0.22, CONTENT_WIDTH * 0.18]
            const_headers = ["PISOS", "HABIT.", "BAÑOS", "LOCAL", "PUNTAJE", "USO", "ÁREA (m²)"]
            
            c.setFillColor(VERDE_INSTITUCIONAL)
            c.rect(MARGIN_LEFT, y_position - 12, CONTENT_WIDTH, 12, fill=1, stroke=0)
            c.setFillColor(BLANCO)
            c.setFont(font_bold, 7)
            
            x = MARGIN_LEFT
            for i, header in enumerate(const_headers):
                c.drawCentredString(x + const_col_widths[i]/2, y_position - 9, header)
                x += const_col_widths[i]
            y_position -= 12
            
            c.setFillColor(NEGRO)
            c.setFont(font_normal, 7)
            
            total_area = 0
            for const in construcciones:
                c.setStrokeColor(colors.lightgrey)
                c.rect(MARGIN_LEFT, y_position - 12, CONTENT_WIDTH, 12, stroke=1, fill=0)
                
                area = const.get('area_construida', 0)
                total_area += area
                
                row = [
                    str(const.get('pisos', 0)),
                    str(const.get('habitaciones', 0)),
                    str(const.get('banos', 0)),
                    str(const.get('locales', 0)),
                    str(const.get('puntaje', 0)),
                    (const.get('uso', '')[:15] if const.get('uso') else ""),
                    f"{area:,.0f}"
                ]
                
                x = MARGIN_LEFT
                for i, cell in enumerate(row):
                    c.drawCentredString(x + const_col_widths[i]/2, y_position - 9, cell)
                    x += const_col_widths[i]
                
                y_position -= 12
            
            c.setFont(font_bold, 8)
            c.drawString(MARGIN_LEFT, y_position - 5, f"Total área incorporada: {total_area:,.0f} m²")
            y_position -= 20
    
    # ==========================================
    # ARTÍCULOS ADICIONALES (Idéntico a M2)
    # ==========================================
    
    y_position -= 20  # Espacio adicional después de las tablas
    
    # Artículo 2 - Justificado
    dibujar_articulo_justificado(2, plantilla["articulo_2"])
    
    # Artículo 3 - Justificado
    dibujar_articulo_justificado(3, plantilla["articulo_3"])
    
    # Artículo 4 - Justificado
    dibujar_articulo_justificado(4, plantilla["articulo_4"])
    
    y_position -= 20
    
    # ==========================================
    # FIRMA Y QR DE VERIFICACIÓN
    # ==========================================
    
    verificar_espacio(120)
    
    c.setFont(font_bold, 10)
    c.drawCentredString(PAGE_WIDTH/2, y_position, plantilla["cierre"])
    y_position -= 20
    
    # Generar QR de verificación
    qr_image = None
    fecha_hora_gen = datetime.now().strftime("%d/%m/%Y %H:%M")
    hash_doc = ""
    
    try:
        import qrcode
        
        base_url = verificacion_base_url or "https://certificados.asomunicipios.gov.co"
        
        if codigo_verificacion:
            qr_data = f"{base_url}/api/verificar/{codigo_verificacion}"
        else:
            qr_data = f"{base_url}/api/verificar-resolucion/{numero_resolucion}"
        
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=2,
        )
        qr.add_data(qr_data)
        qr.make(fit=True)
        
        qr_img = qrcode.make(qr_data)
        qr_img = qr.make_image(fill_color="#009846", back_color="white")
        
        qr_buffer = io.BytesIO()
        qr_img.save(qr_buffer, format='PNG')
        qr_buffer.seek(0)
        qr_image = ImageReader(qr_buffer)
        
        hash_input = f"{codigo_predial}-{codigo_verificacion or numero_resolucion}-{fecha_hora_gen}"
        hash_doc = hashlib.sha256(hash_input.encode()).hexdigest()
        
    except Exception as e:
        print(f"Error generando QR: {e}")
    
    # Posiciones para firma y QR lado a lado
    firma_block_width = 200
    verif_block_width = 185
    gap_between = 20
    
    total_blocks_width = firma_block_width + gap_between + verif_block_width
    start_x = MARGIN_LEFT + (CONTENT_WIDTH - total_blocks_width) / 2
    
    block_height = 90
    block_y = y_position - block_height
    
    # BLOQUE IZQUIERDO: FIRMA
    firma_center_x = start_x + firma_block_width / 2
    
    if firma_dalgie:
        firma_img_width = 100
        firma_img_height = 50
        c.drawImage(firma_dalgie, firma_center_x - firma_img_width/2, block_y + 40,
                   width=firma_img_width, height=firma_img_height, mask='auto')
    
    # Línea debajo de la firma
    linea_width = 160
    linea_y = block_y + 35
    c.setStrokeColor(NEGRO)
    c.line(firma_center_x - linea_width/2, linea_y, firma_center_x + linea_width/2, linea_y)
    
    # Nombre y cargo
    c.setFont(font_bold, 9)
    c.setFillColor(NEGRO)
    c.drawCentredString(firma_center_x, linea_y - 12, plantilla["firmante_nombre"])
    c.setFont(font_bold, 8)
    c.drawCentredString(firma_center_x, linea_y - 24, plantilla["firmante_cargo"])
    
    # BLOQUE DERECHO: QR DE VERIFICACIÓN
    if qr_image:
        gris_claro = colors.HexColor('#666666')
        marco_width = verif_block_width
        marco_height = 58
        marco_x = start_x + firma_block_width + gap_between
        marco_y = block_y + 15
        
        # Fondo del marco
        c.setFillColor(colors.HexColor('#f0fdf4'))
        c.roundRect(marco_x, marco_y, marco_width, marco_height, 5, fill=1, stroke=0)
        
        # Borde verde institucional
        c.setStrokeColor(VERDE_INSTITUCIONAL)
        c.setLineWidth(1.5)
        c.roundRect(marco_x, marco_y, marco_width, marco_height, 5, fill=0, stroke=1)
        
        # QR
        qr_size = 46
        c.drawImage(qr_image, marco_x + 5, marco_y + 6, width=qr_size, height=qr_size, mask='auto')
        
        # Información de verificación
        info_x = marco_x + 55
        
        c.setFillColor(VERDE_INSTITUCIONAL)
        c.setFont(font_bold, 8)
        c.drawString(info_x, marco_y + marco_height - 11, "RESOLUCIÓN VERIFICABLE")
        
        c.setFillColor(NEGRO)
        c.setFont(font_bold, 7)
        codigo_mostrar = codigo_verificacion or numero_resolucion
        c.drawString(info_x, marco_y + 36, f"Código: {codigo_mostrar[:20]}")
        
        c.setFont(font_normal, 6)
        c.setFillColor(gris_claro)
        c.drawString(info_x, marco_y + 26, f"Generado: {fecha_hora_gen}")
        c.drawString(info_x, marco_y + 17, f"Hash: SHA256:{hash_doc[:12]}...")
        
        c.setFillColor(VERDE_INSTITUCIONAL)
        c.setFont(font_normal, 6)
        c.drawString(info_x, marco_y + 8, "Escanear QR para verificar")
    
    y_position = block_y - 10
    
    # ELABORÓ / APROBÓ
    verificar_espacio(30)
    c.setFont(font_normal, 7)
    c.setFillColor(NEGRO)
    c.drawString(MARGIN_LEFT, y_position, f"Elaboró: {elaboro}")
    y_position -= 12
    c.drawString(MARGIN_LEFT, y_position, f"Aprobó:  {aprobo}")
    
    # PIE DE PÁGINA FINAL
    draw_footer()
    
    c.save()
    buffer.seek(0)
    return buffer.getvalue()
