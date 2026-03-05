"""
Generador de PDF de Resolución Catastral - Mutación Tercera (M3)
Cambio de Destino Económico e Incorporación de Construcción
Incluye encabezado y pie de página institucional idénticos al M1 y M2
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

# Configuración de página
PAGE_WIDTH, PAGE_HEIGHT = letter
MARGIN_LEFT = 2.0 * cm
MARGIN_RIGHT = 2.0 * cm
MARGIN_TOP = 2.8 * cm  # Espacio para encabezado
MARGIN_BOTTOM = 2.5 * cm  # Espacio para pie de página
CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT

# Colores institucionales
VERDE_INSTITUCIONAL = colors.HexColor('#009846')
NEGRO = colors.HexColor('#000000')
BLANCO = colors.HexColor('#FFFFFF')


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
        )
    }


def generate_resolucion_m3_pdf(
    data: dict,
    imagen_encabezado_b64: str = None,
    imagen_pie_b64: str = None,
    imagen_firma_b64: str = None
) -> bytes:
    """
    Genera el PDF de la resolución M3 (Cambio de destino / Incorporación de construcción)
    Con encabezado y pie de página institucional idénticos al M1 y M2
    
    Args:
        data: Diccionario con los datos de la resolución
        imagen_encabezado_b64: Imagen del encabezado en base64 (opcional)
        imagen_pie_b64: Imagen del pie de página en base64 (opcional)
        imagen_firma_b64: Imagen de la firma en base64 (opcional)
    
    Returns:
        bytes: Contenido del PDF
    """
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    
    # Cargar fuentes
    font_normal = "Helvetica"
    font_bold = "Helvetica-Bold"
    
    # Cargar imágenes
    encabezado_img = None
    pie_pagina_img = None
    firma_img = None
    
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
            firma_img = ImageReader(io.BytesIO(base64.b64decode(imagen_firma_b64)))
        else:
            firma_img = ImageReader(get_firma_dalgie_image())
    except Exception as e:
        print(f"Error cargando firma: {e}")
    
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
    
    # Datos del solicitante
    solicitante_nombre = solicitante.get("nombre", "NO ESPECIFICADO")
    solicitante_documento = solicitante.get("documento", "N/A")
    codigo_predial = predio.get("codigo_predial_nacional", predio.get("numero_predio", ""))
    
    # Marca de agua usando logo
    def draw_watermark():
        try:
            logo_watermark = ImageReader(get_encabezado_image())
            c.saveState()
            watermark_width = 300
            watermark_height = 180
            watermark_x = (PAGE_WIDTH - watermark_width) / 2
            watermark_y = (PAGE_HEIGHT - watermark_height) / 2
            c.setFillAlpha(0.15)
            c.drawImage(logo_watermark, watermark_x, watermark_y,
                       width=watermark_width, height=watermark_height,
                       preserveAspectRatio=True, mask='auto')
            c.restoreState()
        except:
            pass
    
    def draw_header():
        """Dibuja el encabezado institucional idéntico al M1 y M2"""
        nonlocal y_position
        # Marca de agua
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
            c.setFont(font_bold, 14)
            c.drawCentredString(PAGE_WIDTH/2, PAGE_HEIGHT - 1.5 * cm, "ASOMUNICIPIOS - Gestor Catastral")
        
        y_position = PAGE_HEIGHT - 2.8 * cm
        return y_position
    
    def draw_footer():
        """Dibuja el pie de página institucional idéntico al M1 y M2"""
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
        
        # Título de continuación
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
    c.setFillColor(VERDE_INSTITUCIONAL)
    c.setFont(font_bold, 11)
    c.drawString(MARGIN_LEFT, y_position, "CONSIDERANDO:")
    y_position -= 20
    c.setFillColor(NEGRO)
    
    # Preámbulo
    dibujar_texto_justificado(plantilla["preambulo"], font_size=10, line_height=13)
    y_position -= 10
    
    # Considerando específico según subtipo
    if subtipo == "cambio_destino":
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
    
    # Texto de resuelve intro
    dibujar_texto_justificado(plantilla["resuelve_intro"], font_size=10, line_height=13)
    y_position -= 15
    
    # ==========================================
    # RESUELVE
    # ==========================================
    
    verificar_espacio(30)
    c.setFillColor(VERDE_INSTITUCIONAL)
    c.setFont(font_bold, 11)
    c.drawString(MARGIN_LEFT, y_position, "RESUELVE:")
    y_position -= 20
    c.setFillColor(NEGRO)
    
    c.setFont(font_bold, 10)
    c.drawString(MARGIN_LEFT, y_position, f"Artículo 1. Ordenar la inscripción en el catastro del Municipio de {municipio.upper()} los siguientes cambios:")
    y_position -= 20
    
    # ==========================================
    # TABLA CANCELACIÓN
    # ==========================================
    
    verificar_espacio(80)
    c.setFillColor(VERDE_INSTITUCIONAL)
    c.setFont(font_bold, 10)
    c.drawString(MARGIN_LEFT, y_position, "CANCELACIÓN")
    y_position -= 15
    
    # Encabezados de tabla
    col_widths = [150, 100, 80, 50, 50, 70, 60]
    headers = ["NPN", "DIRECCIÓN", "PROPIETARIO", "DEST", "ÁREA T", "AVALÚO", "FECHA"]
    
    c.setFillColor(VERDE_INSTITUCIONAL)
    c.rect(MARGIN_LEFT, y_position - 12, sum(col_widths), 14, fill=1)
    c.setFillColor(BLANCO)
    c.setFont(font_bold, 7)
    
    x_pos = MARGIN_LEFT + 2
    for i, header in enumerate(headers):
        c.drawString(x_pos, y_position - 9, header)
        x_pos += col_widths[i]
    y_position -= 14
    
    # Datos del predio cancelado
    c.setFillColor(NEGRO)
    c.setFont(font_normal, 7)
    
    destino_anterior = data.get("destino_anterior", predio.get("destino_economico", ""))
    avaluo_anterior = data.get("avaluo_anterior", predio.get("avaluo", 0))
    
    row_data = [
        codigo_predial[:30] if codigo_predial else "",
        (predio.get("direccion", "")[:20] if predio.get("direccion") else ""),
        "",  # Propietario (se puede agregar)
        destino_anterior,
        f"{predio.get('area_terreno', 0):,.0f}",
        f"$ {avaluo_anterior:,.0f}",
        "01/01/2024"
    ]
    
    c.setStrokeColor(colors.lightgrey)
    c.rect(MARGIN_LEFT, y_position - 12, sum(col_widths), 14, stroke=1, fill=0)
    
    x_pos = MARGIN_LEFT + 2
    for i, cell in enumerate(row_data):
        c.drawString(x_pos, y_position - 9, str(cell))
        x_pos += col_widths[i]
    y_position -= 20
    
    # ==========================================
    # TABLA INSCRIPCIÓN
    # ==========================================
    
    verificar_espacio(80)
    c.setFillColor(VERDE_INSTITUCIONAL)
    c.setFont(font_bold, 10)
    c.drawString(MARGIN_LEFT, y_position, "INSCRIPCIÓN")
    y_position -= 15
    
    # Encabezados
    c.setFillColor(VERDE_INSTITUCIONAL)
    c.rect(MARGIN_LEFT, y_position - 12, sum(col_widths), 14, fill=1)
    c.setFillColor(BLANCO)
    c.setFont(font_bold, 7)
    
    x_pos = MARGIN_LEFT + 2
    for i, header in enumerate(headers):
        c.drawString(x_pos, y_position - 9, header)
        x_pos += col_widths[i]
    y_position -= 14
    
    # Datos del predio inscrito
    c.setFillColor(NEGRO)
    c.setFont(font_normal, 7)
    
    if subtipo == "cambio_destino":
        destino_nuevo = data.get("destino_nuevo", "")
    else:
        destino_nuevo = destino_anterior
    
    avaluo_nuevo = data.get("avaluo_nuevo", 0)
    
    row_data = [
        codigo_predial[:30] if codigo_predial else "",
        (predio.get("direccion", "")[:20] if predio.get("direccion") else ""),
        "",
        destino_nuevo,
        f"{predio.get('area_terreno', 0):,.0f}",
        f"$ {avaluo_nuevo:,.0f}",
        ""
    ]
    
    c.setStrokeColor(colors.lightgrey)
    c.rect(MARGIN_LEFT, y_position - 12, sum(col_widths), 14, stroke=1, fill=0)
    
    x_pos = MARGIN_LEFT + 2
    for i, cell in enumerate(row_data):
        c.drawString(x_pos, y_position - 9, str(cell))
        x_pos += col_widths[i]
    y_position -= 25
    
    # ==========================================
    # VIGENCIAS FISCALES DE INSCRIPCIÓN
    # ==========================================
    
    fechas_inscripcion = data.get("fechas_inscripcion", [])
    if fechas_inscripcion:
        verificar_espacio(40 + len(fechas_inscripcion) * 16)
        
        c.setFillColor(VERDE_INSTITUCIONAL)
        c.setFont(font_bold, 10)
        c.drawString(MARGIN_LEFT, y_position, "VIGENCIAS FISCALES DE INSCRIPCIÓN")
        y_position -= 15
        
        # Encabezados de tabla vigencias
        vig_col_widths = [100, 150, 150]
        vig_headers = ["AÑO VIGENCIA", "AVALÚO CATASTRAL", "FUENTE"]
        
        c.setFillColor(VERDE_INSTITUCIONAL)
        c.rect(MARGIN_LEFT, y_position - 12, sum(vig_col_widths), 14, fill=1)
        c.setFillColor(BLANCO)
        c.setFont(font_bold, 8)
        
        x_pos = MARGIN_LEFT + 5
        for i, header in enumerate(vig_headers):
            c.drawString(x_pos, y_position - 9, header)
            x_pos += vig_col_widths[i]
        y_position -= 14
        
        # Filas de vigencias
        c.setFillColor(NEGRO)
        c.setFont(font_normal, 8)
        
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
            c.rect(MARGIN_LEFT, y_position - 12, sum(vig_col_widths), 14, stroke=1, fill=0)
            
            x_pos = MARGIN_LEFT + 5
            c.drawString(x_pos, y_position - 9, str(año))
            x_pos += vig_col_widths[0]
            c.drawString(x_pos, y_position - 9, f"${int(avaluo):,}" if avaluo else "$0")
            x_pos += vig_col_widths[1]
            c.drawString(x_pos, y_position - 9, fuente_texto)
            
            y_position -= 14
        
        y_position -= 15
    
    # ==========================================
    # CONSTRUCCIONES INCORPORADAS (solo para incorporacion_construccion)
    # ==========================================
    
    if subtipo == "incorporacion_construccion":
        construcciones = data.get("construcciones_nuevas", [])
        if construcciones:
            verificar_espacio(50 + len(construcciones) * 16)
            
            c.setFillColor(VERDE_INSTITUCIONAL)
            c.setFont(font_bold, 10)
            c.drawString(MARGIN_LEFT, y_position, "CONSTRUCCIONES INCORPORADAS")
            y_position -= 15
            
            # Encabezados
            const_col_widths = [40, 60, 50, 50, 60, 80, 80]
            const_headers = ["PISOS", "HABIT.", "BAÑOS", "LOCAL", "PUNTAJE", "USO", "ÁREA (m²)"]
            
            c.setFillColor(VERDE_INSTITUCIONAL)
            c.rect(MARGIN_LEFT, y_position - 12, sum(const_col_widths), 14, fill=1)
            c.setFillColor(BLANCO)
            c.setFont(font_bold, 7)
            
            x_pos = MARGIN_LEFT + 2
            for i, header in enumerate(const_headers):
                c.drawString(x_pos, y_position - 9, header)
                x_pos += const_col_widths[i]
            y_position -= 14
            
            # Filas de construcciones
            c.setFillColor(NEGRO)
            c.setFont(font_normal, 7)
            
            total_area = 0
            for const in construcciones:
                c.setStrokeColor(colors.lightgrey)
                c.rect(MARGIN_LEFT, y_position - 12, sum(const_col_widths), 14, stroke=1, fill=0)
                
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
                
                x_pos = MARGIN_LEFT + 2
                for i, cell in enumerate(row):
                    c.drawString(x_pos, y_position - 9, cell)
                    x_pos += const_col_widths[i]
                
                y_position -= 14
            
            # Total
            c.setFont(font_bold, 8)
            c.drawString(MARGIN_LEFT, y_position - 5, f"Total área incorporada: {total_area:,.0f} m²")
            y_position -= 20
    
    # ==========================================
    # ARTÍCULOS ADICIONALES
    # ==========================================
    
    verificar_espacio(80)
    c.setFont(font_bold, 10)
    c.setFillColor(NEGRO)
    c.drawString(MARGIN_LEFT, y_position, "Artículo 2.")
    c.setFont(font_normal, 10)
    c.drawString(MARGIN_LEFT + 55, y_position, "Comunicar al interesado, a la Oficina de Registro de Instrumentos Públicos,")
    y_position -= 14
    c.drawString(MARGIN_LEFT, y_position, "a la Tesorería Municipal y demás entidades competentes.")
    y_position -= 20
    
    c.setFont(font_bold, 10)
    c.drawString(MARGIN_LEFT, y_position, "Artículo 3.")
    c.setFont(font_normal, 10)
    c.drawString(MARGIN_LEFT + 55, y_position, "La presente resolución rige a partir de su expedición.")
    y_position -= 30
    
    # ==========================================
    # FIRMA
    # ==========================================
    
    verificar_espacio(120)
    
    # Línea de firma
    c.setFont(font_bold, 10)
    c.drawCentredString(PAGE_WIDTH/2, y_position, "COMUNÍQUESE Y CÚMPLASE")
    y_position -= 30
    
    # Imagen de firma
    if firma_img:
        try:
            firma_width = 150
            firma_height = 60
            firma_x = (PAGE_WIDTH - firma_width) / 2
            c.drawImage(firma_img, firma_x, y_position - firma_height,
                       width=firma_width, height=firma_height,
                       preserveAspectRatio=True, mask='auto')
            y_position -= firma_height + 10
        except:
            y_position -= 50
    else:
        y_position -= 50
    
    c.drawCentredString(PAGE_WIDTH/2, y_position, "_" * 40)
    y_position -= 14
    c.setFont(font_bold, 10)
    c.drawCentredString(PAGE_WIDTH/2, y_position, "DALGIE YUSLENY ASCANIO PÉREZ")
    y_position -= 12
    c.setFont(font_normal, 9)
    c.drawCentredString(PAGE_WIDTH/2, y_position, "Coordinadora del Proceso de Gestión Catastral")
    y_position -= 12
    c.drawCentredString(PAGE_WIDTH/2, y_position, "ASOMUNICIPIOS")
    y_position -= 25
    
    # Elaborado por / Revisado por
    elaborado = data.get("elaborado_por", "")
    if elaborado:
        c.setFont(font_normal, 8)
        c.drawString(MARGIN_LEFT, y_position, f"Elaboró: {elaborado}")
        y_position -= 12
    
    # ==========================================
    # FINALIZAR DOCUMENTO
    # ==========================================
    
    draw_footer()
    c.save()
    
    buffer.seek(0)
    return buffer.getvalue()
