"""
Generador de PDF de Resolución Catastral
Usa los mismos márgenes y posiciones que el Certificado Catastral
"""
import io
import base64
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


def get_default_plantilla():
    """Retorna la plantilla de textos por defecto - Basada en documento oficial M1"""
    return {
        "preambulo": (
            "La Asociación de Municipios del Catatumbo, Provincia de Ocaña y Sur del Cesar – "
            "Asomunicipios en uso de sus facultades legales otorgadas por la resolución IGAC 1204 del 2021 "
            "en concordancia con la ley 14 de 1983 y el decreto 148 del 2020, y la resolución IGAC 1040 del 2023: "
            '"por la cual se actualiza la reglamentación técnica de la formación, actualización, conservación y '
            'difusión catastral con enfoque multipropósito", y'
        ),
        "considerando_1": "Qué, ante la oficina de gestión catastral de Asomunicipios, solicitan un trámite catastral de {tipo_tramite}, radicado bajo el consecutivo {radicado}",
        "considerando_2_intro": "Qué, se aportaron como soportes los siguientes documentos:",
        "considerando_2_docs": [
            "Oficio de solicitud.",
            "Cedula de ciudadanía.",
            "Certificado de Tradición y Libertad con número de matrícula inmobiliaria {matricula_inmobiliaria}."
        ],
        "considerando_3": "Qué, según estudio de oficina se hace necesario efectuar una mutación de primera, para el predio con Código Predial Nacional {npn}.",
        "considerando_final": (
            "En consecuencia y dado que se aportaron y verificaron los soportes pertinentes, amparados en la "
            'resolución IGAC 1040 del 2023: "por la cual se actualiza la reglamentación técnica de la formación, '
            'actualización, conservación y difusión catastral con enfoque multipropósito", se:'
        ),
        "articulo_1_intro": "Ordenar la inscripción en el catastro del Municipio de {municipio} los siguientes cambios:",
        "articulo_2": "De conformidad con lo dispuesto en el artículo 4.8.2 de la resolución 1040 de 2023 y el artículo 70 de la ley 1437 de 2011, el presente acto administrativo rige a partir de la fecha de su expedición.",
        "articulo_3": "Los avalúos inscritos con posterioridad al primero de enero tendrán vigencia fiscal para el año siguiente, ajustados con el índice que determine el gobierno nacional, de conformidad a lo expuesto en los artículos 4.7.13 y 4.7.14 de la resolución 1040 de 2023.",
        "articulo_4": "Contra el presente acto administrativo no procede recurso alguno.",
        "cierre": "COMUNIQUESE,NOTIFIQUESEYCUMPLASE",
        "firmante_nombre": "DALGIE ESPERANZA TORRADO RIZO",
        "firmante_cargo": "SUBDIRECTORA FINANCIERA Y ADMINISTRATIVA"
    }


def generate_resolucion_pdf(
    numero_resolucion: str,
    fecha_resolucion: str,
    municipio: str,
    tipo_tramite: str,
    radicado: str,
    codigo_catastral_anterior: str,
    npn: str,
    matricula_inmobiliaria: str,
    direccion: str,
    avaluo: str,
    vigencia_fiscal: str,
    area_terreno: str = "0",
    area_construida: str = "0",
    destino_economico: str = "A",  # A-Habitacional, B-Industrial, C-Comercial, etc.
    codigo_homologado: str = "",   # Código alfanumérico tipo BPP0002BUUC
    propietarios_anteriores: list = None,
    propietarios_nuevos: list = None,
    elaboro: str = "",
    reviso: str = "",
    plantilla: dict = None,
    imagen_encabezado_b64: str = None,
    imagen_pie_b64: str = None,
    imagen_firma_b64: str = None,
    config_visual: dict = None,
) -> bytes:
    """
    Genera un PDF de resolución catastral usando los mismos márgenes
    y posiciones que el certificado catastral.
    """
    
    # Usar plantilla por defecto si no se proporciona
    textos = {**get_default_plantilla(), **(plantilla or {})}
    
    # Registrar fuentes
    try:
        pdfmetrics.registerFont(TTFont('Carlito', '/usr/share/fonts/truetype/crosextra/Carlito-Regular.ttf'))
        pdfmetrics.registerFont(TTFont('Carlito-Bold', '/usr/share/fonts/truetype/crosextra/Carlito-Bold.ttf'))
        font_normal = 'Carlito'
        font_bold = 'Carlito-Bold'
    except:
        font_normal = 'Helvetica'
        font_bold = 'Helvetica-Bold'
    
    buffer = io.BytesIO()
    width, height = letter
    c = canvas.Canvas(buffer, pagesize=letter)
    
    # === MÁRGENES IDÉNTICOS AL CERTIFICADO CATASTRAL ===
    left_margin = 2.0 * cm
    right_margin = width - 2.0 * cm
    content_width = right_margin - left_margin
    footer_limit = 2.5 * cm  # Límite inferior para contenido
    
    # Colores
    verde_institucional = colors.HexColor('#009846')
    negro = colors.HexColor('#000000')
    blanco = colors.HexColor('#FFFFFF')
    
    # Cargar imágenes (personalizadas o por defecto)
    try:
        if imagen_encabezado_b64:
            encabezado_img = ImageReader(io.BytesIO(base64.b64decode(imagen_encabezado_b64)))
        else:
            encabezado_img = ImageReader(get_encabezado_image())
        imagenes_ok = True
    except:
        encabezado_img = None
        imagenes_ok = False
    
    try:
        if imagen_pie_b64:
            pie_pagina_img = ImageReader(io.BytesIO(base64.b64decode(imagen_pie_b64)))
        else:
            pie_pagina_img = ImageReader(get_pie_pagina_image())
    except:
        pie_pagina_img = None
    
    try:
        if imagen_firma_b64:
            firma_img = ImageReader(io.BytesIO(base64.b64decode(imagen_firma_b64)))
        else:
            firma_img = ImageReader(get_firma_dalgie_image())
    except:
        firma_img = None
    
    # Configuración de fuentes
    fuente_titulo = 11
    fuente_cuerpo = 9
    fuente_tabla = 7
    espaciado_parrafos = 12
    espaciado_secciones = 18
    
    def draw_header():
        """Dibuja el encabezado IDÉNTICO al certificado catastral"""
        if imagenes_ok and encabezado_img:
            encabezado_width = content_width + 1 * cm
            encabezado_height = 2.0 * cm
            encabezado_x = left_margin - 0.5 * cm
            encabezado_y = height - 2.2 * cm
            c.drawImage(encabezado_img, encabezado_x, encabezado_y, 
                        width=encabezado_width, height=encabezado_height, 
                        preserveAspectRatio=True, mask='auto')
        else:
            # Encabezado alternativo
            c.setFillColor(verde_institucional)
            c.setFont(font_bold, 14)
            c.drawCentredString(width/2, height - 1.5 * cm, "ASOMUNICIPIOS - Gestor Catastral")
        return height - 2.8 * cm
    
    def draw_footer():
        """Dibuja el pie de página IDÉNTICO al certificado catastral"""
        if pie_pagina_img:
            footer_height = 2.0 * cm
            c.drawImage(pie_pagina_img, 0, 0, 
                        width=width, height=footer_height, 
                        preserveAspectRatio=False, mask='auto')
        else:
            c.setFillColor(verde_institucional)
            c.rect(0, 0, width, 28, fill=1, stroke=0)
            c.setFillColor(blanco)
            c.setFont(font_normal, 8)
            c.drawCentredString(width/2, 10, "comunicaciones@asomunicipios.gov.co")
    
    current_page = 1
    
    def new_page():
        """Crea una nueva página con encabezado y pie de página"""
        nonlocal current_page
        draw_footer()
        c.showPage()
        current_page += 1
        y = draw_header()
        
        # Título de continuación
        c.setFillColor(negro)
        c.setFont(font_bold, 11)
        c.drawCentredString(width/2, y, "RESOLUCIÓN (Continuación)")
        y -= 14
        c.setFont(font_normal, 9)
        c.drawCentredString(width/2, y, f"Resolución No: {numero_resolucion}")
        y -= 20
        
        return y
    
    def check_page_break(y, needed_space=20):
        """Verifica si hay espacio suficiente, si no, crea nueva página"""
        if y < footer_limit + needed_space:
            return new_page()
        return y
    
    # ===============================================
    # === CONTENIDO DE LA RESOLUCIÓN ===
    # ===============================================
    
    y = draw_header()
    
    # === TÍTULO DE LA RESOLUCIÓN ===
    c.setFillColor(negro)
    c.setFont(font_bold, fuente_titulo)
    c.drawCentredString(width/2, y, f"RESOLUCIÓN No: {numero_resolucion}")
    y -= 14
    c.drawCentredString(width/2, y, f"FECHA RESOLUCIÓN: {fecha_resolucion}")
    y -= espaciado_secciones
    
    # Asunto
    c.setFont(font_bold, fuente_cuerpo)
    asunto = f"POR LA CUAL SE ORDENAN UNOS CAMBIOS EN EL CATASTRO DEL MUNICIPIO DE {municipio.upper()}"
    asunto2 = f"Y SE RESUELVE UNA SOLICITUD DE {tipo_tramite.upper()}."
    c.drawCentredString(width/2, y, asunto)
    y -= espaciado_parrafos
    c.drawCentredString(width/2, y, asunto2)
    y -= espaciado_secciones
    
    # === PREÁMBULO ===
    c.setFont(font_normal, fuente_cuerpo)
    lines = simpleSplit(textos['preambulo'], font_normal, fuente_cuerpo, content_width)
    for line in lines:
        y = check_page_break(y, 15)
        c.drawString(left_margin, y, line)
        y -= espaciado_parrafos
    y -= 8
    
    # === CONSIDERANDO ===
    y = check_page_break(y, 30)
    c.setFont(font_bold, fuente_cuerpo + 1)
    # CONSIDERANDO con espaciado entre letras
    c.drawCentredString(width/2, y, "C O N S I D E R A N D O")
    y -= espaciado_secciones
    
    # Considerando 1
    c.setFont(font_normal, fuente_cuerpo)
    texto_c1 = textos['considerando_1'].replace('{tipo_tramite}', tipo_tramite).replace('{radicado}', radicado)
    lines = simpleSplit(texto_c1, font_normal, fuente_cuerpo, content_width)
    for line in lines:
        y = check_page_break(y, 15)
        c.drawString(left_margin, y, line)
        y -= espaciado_parrafos
    y -= 8
    
    # Considerando 2 - Intro
    y = check_page_break(y, 30)
    lines = simpleSplit(textos['considerando_2_intro'], font_normal, fuente_cuerpo, content_width)
    for line in lines:
        c.drawString(left_margin, y, line)
        y -= espaciado_parrafos
    
    # Lista de documentos
    for doc in textos['considerando_2_docs']:
        y = check_page_break(y, 15)
        doc_texto = doc.replace('{matricula_inmobiliaria}', matricula_inmobiliaria)
        c.drawString(left_margin + 15, y, f"• {doc_texto}")
        y -= espaciado_parrafos
    y -= 8
    
    # Considerando 3 - Ya no usa codigo_catastral_anterior, solo npn
    y = check_page_break(y, 30)
    texto_c3 = textos['considerando_3'].replace('{npn}', npn)
    lines = simpleSplit(texto_c3, font_normal, fuente_cuerpo, content_width)
    for line in lines:
        y = check_page_break(y, 15)
        c.drawString(left_margin, y, line)
        y -= espaciado_parrafos
    y -= 8
    
    # Considerando final
    y = check_page_break(y, 40)
    lines = simpleSplit(textos['considerando_final'], font_normal, fuente_cuerpo, content_width)
    for line in lines:
        y = check_page_break(y, 15)
        c.drawString(left_margin, y, line)
        y -= espaciado_parrafos
    y -= espaciado_secciones
    
    # === RESUELVE ===
    y = check_page_break(y, 30)
    c.setFont(font_bold, fuente_cuerpo + 1)
    # RESUELVE con espaciado entre letras
    c.drawCentredString(width/2, y, "R E S U E L V E")
    y -= espaciado_secciones
    
    # Artículo 01
    y = check_page_break(y, 50)
    c.setFont(font_bold, fuente_cuerpo)
    c.drawString(left_margin, y, "Artículo 01.")
    c.setFont(font_normal, fuente_cuerpo)
    texto_art1 = textos['articulo_1_intro'].replace('{municipio}', municipio)
    lines = simpleSplit(texto_art1, font_normal, fuente_cuerpo, content_width - 70)
    x_offset = left_margin + c.stringWidth("Artículo 01. ", font_bold, fuente_cuerpo)
    if lines:
        c.drawString(x_offset, y, lines[0])
        y -= espaciado_parrafos
        for line in lines[1:]:
            c.drawString(left_margin, y, line)
            y -= espaciado_parrafos
    y -= 10
    
    # ============================================================
    # FUNCIÓN HELPER: Dibujar datos del predio
    # ============================================================
    def dibujar_datos_predio(y_pos):
        """Dibuja la fila de datos del predio (usado en cancelación e inscripción)"""
        y = y_pos
        # Headers: CÓDIGO HOMOLOGADO | DIRECCIÓN O VEREDA | DES | A-TERRENO | A-CONS | AVALÚO | VIGENCIA FISCAL
        y = check_page_break(y, 30)
        c.setFillColor(colors.HexColor('#e8e8e8'))
        c.rect(left_margin, y - 12, content_width, 12, fill=1, stroke=1)
        c.setFillColor(negro)
        c.setFont(font_bold, fuente_tabla - 1)
        
        predio_cols = [content_width * 0.18, content_width * 0.22, content_width * 0.08, content_width * 0.12, content_width * 0.10, content_width * 0.15, content_width * 0.15]
        predio_headers = ["CÓD. HOMOLOGADO", "DIRECCIÓN", "DES", "A-TERRENO", "A-CONS", "AVALÚO", "VIG. FISCAL"]
        x = left_margin
        for i, header in enumerate(predio_headers):
            c.drawCentredString(x + predio_cols[i]/2, y - 9, header)
            c.rect(x, y - 12, predio_cols[i], 12, fill=0, stroke=1)
            x += predio_cols[i]
        y -= 12
        
        # Datos del predio
        y = check_page_break(y, 15)
        c.setFont(font_normal, fuente_tabla - 1)
        x = left_margin
        # CÓDIGO HOMOLOGADO (alfanumérico tipo BPP0002BUUC)
        c.rect(x, y - 12, predio_cols[0], 12, fill=0, stroke=1)
        c.drawString(x + 1, y - 9, codigo_homologado if codigo_homologado else "")
        x += predio_cols[0]
        # DIRECCIÓN O VEREDA
        c.rect(x, y - 12, predio_cols[1], 12, fill=0, stroke=1)
        dir_corta = direccion[:18] if len(direccion) > 18 else direccion
        c.drawString(x + 1, y - 9, dir_corta)
        x += predio_cols[1]
        # DES (Destino Económico - letra: A, B, C, D, etc.)
        c.rect(x, y - 12, predio_cols[2], 12, fill=0, stroke=1)
        c.drawCentredString(x + predio_cols[2]/2, y - 9, destino_economico[:1] if destino_economico else "A")
        x += predio_cols[2]
        # A-TERRENO
        c.rect(x, y - 12, predio_cols[3], 12, fill=0, stroke=1)
        c.drawCentredString(x + predio_cols[3]/2, y - 9, str(area_terreno))
        x += predio_cols[3]
        # A-CONS
        c.rect(x, y - 12, predio_cols[4], 12, fill=0, stroke=1)
        c.drawCentredString(x + predio_cols[4]/2, y - 9, str(area_construida))
        x += predio_cols[4]
        # AVALÚO
        c.rect(x, y - 12, predio_cols[5], 12, fill=0, stroke=1)
        c.drawCentredString(x + predio_cols[5]/2, y - 9, avaluo[:12] if len(avaluo) > 12 else avaluo)
        x += predio_cols[5]
        # VIGENCIA FISCAL
        c.rect(x, y - 12, predio_cols[6], 12, fill=0, stroke=1)
        c.drawCentredString(x + predio_cols[6]/2, y - 9, vigencia_fiscal)
        y -= 12
        
        # Fila MATRÍCULA INMOBILIARIA
        y = check_page_break(y, 15)
        c.setFillColor(colors.HexColor('#e8e8e8'))
        c.rect(left_margin, y - 12, content_width * 0.3, 12, fill=1, stroke=1)
        c.setFillColor(negro)
        c.setFont(font_bold, fuente_tabla - 1)
        c.drawCentredString(left_margin + (content_width * 0.3)/2, y - 9, "MATRÍCULA INMOBILIARIA")
        c.setFont(font_normal, fuente_tabla)
        c.rect(left_margin + content_width * 0.3, y - 12, content_width * 0.7, 12, fill=0, stroke=1)
        c.drawString(left_margin + content_width * 0.3 + 5, y - 9, matricula_inmobiliaria)
        y -= 12
        
        return y
    
    # ============================================================
    # TABLA CANCELACIÓN - Propietarios anteriores
    # ============================================================
    y = check_page_break(y, 80)
    
    # Título CANCELACIÓN
    c.setFillColor(verde_institucional)
    c.rect(left_margin, y - 15, content_width, 15, fill=1, stroke=0)
    c.setFillColor(blanco)
    c.setFont(font_bold, fuente_tabla + 1)
    c.drawCentredString(width/2, y - 12, "CANCELACIÓN")
    y -= 18
    
    # Fila 1: N° PREDIAL | APELLIDOS Y NOMBRES | TIPO DOC. | NRO. DOC. | ESTADO
    c.setFillColor(colors.HexColor('#e8e8e8'))
    c.rect(left_margin, y - 12, content_width, 12, fill=1, stroke=1)
    c.setFillColor(negro)
    c.setFont(font_bold, fuente_tabla - 1)
    
    # Ajustar columnas para NPN de 30 dígitos
    cancel_cols = [content_width * 0.32, content_width * 0.30, content_width * 0.10, content_width * 0.18, content_width * 0.10]
    cancel_headers = ["N° PREDIAL", "APELLIDOS Y NOMBRES", "TIPO DOC.", "NRO. DOC.", "ESTADO"]
    x = left_margin
    for i, header in enumerate(cancel_headers):
        c.drawCentredString(x + cancel_cols[i]/2, y - 9, header)
        c.rect(x, y - 12, cancel_cols[i], 12, fill=0, stroke=1)
        x += cancel_cols[i]
    y -= 12
    
    # Datos de propietarios anteriores (cancelación)
    c.setFont(font_normal, fuente_tabla - 1)
    if propietarios_anteriores:
        for prop in propietarios_anteriores:
            y = check_page_break(y, 15)
            x = left_margin
            # N° PREDIAL (30 dígitos completo)
            c.rect(x, y - 12, cancel_cols[0], 12, fill=0, stroke=1)
            c.drawString(x + 1, y - 9, npn)
            x += cancel_cols[0]
            # APELLIDOS Y NOMBRES
            c.rect(x, y - 12, cancel_cols[1], 12, fill=0, stroke=1)
            nombre = prop.get('nombre', '')[:25]
            c.drawString(x + 1, y - 9, nombre)
            x += cancel_cols[1]
            # TIPO DOC.
            c.rect(x, y - 12, cancel_cols[2], 12, fill=0, stroke=1)
            tipo_doc = prop.get('tipo_documento', 'CC')
            c.drawCentredString(x + cancel_cols[2]/2, y - 9, tipo_doc)
            x += cancel_cols[2]
            # NRO. DOC.
            c.rect(x, y - 12, cancel_cols[3], 12, fill=0, stroke=1)
            nro_doc = prop.get('documento', prop.get('nro_documento', ''))
            c.drawString(x + 1, y - 9, str(nro_doc)[:15])
            x += cancel_cols[3]
            # ESTADO (estado civil: CASADO, SOLTERO, VIUDO, etc.)
            c.rect(x, y - 12, cancel_cols[4], 12, fill=0, stroke=1)
            estado_civil = prop.get('estado_civil', prop.get('estado', ''))
            c.drawCentredString(x + cancel_cols[4]/2, y - 9, estado_civil[:10])
            y -= 12
    else:
        y = check_page_break(y, 15)
        c.rect(left_margin, y - 12, content_width, 12, fill=0, stroke=1)
        c.drawString(left_margin + 5, y - 9, "Sin datos de propietario anterior")
        y -= 12
    y -= 5
    
    # Datos del predio en CANCELACIÓN
    y = dibujar_datos_predio(y)
    y -= 8
    
    # ============================================================
    # TABLA INSCRIPCIÓN - Nuevos propietarios + datos del predio
    # ============================================================
    y = check_page_break(y, 100)
    
    # Título INSCRIPCIÓN
    c.setFillColor(verde_institucional)
    c.rect(left_margin, y - 15, content_width, 15, fill=1, stroke=0)
    c.setFillColor(blanco)
    c.setFont(font_bold, fuente_tabla + 1)
    c.drawCentredString(width/2, y - 12, "INSCRIPCIÓN")
    y -= 18
    
    # Fila 1: N° PREDIAL | APELLIDOS Y NOMBRES | TIPO DOC. | NRO. DOC. | ESTADO
    c.setFillColor(colors.HexColor('#e8e8e8'))
    c.rect(left_margin, y - 12, content_width, 12, fill=1, stroke=1)
    c.setFillColor(negro)
    c.setFont(font_bold, fuente_tabla - 1)
    
    x = left_margin
    for i, header in enumerate(cancel_headers):
        c.drawCentredString(x + cancel_cols[i]/2, y - 9, header)
        c.rect(x, y - 12, cancel_cols[i], 12, fill=0, stroke=1)
        x += cancel_cols[i]
    y -= 12
    
    # Datos de nuevos propietarios (inscripción)
    c.setFont(font_normal, fuente_tabla - 1)
    if propietarios_nuevos:
        for prop in propietarios_nuevos:
            y = check_page_break(y, 15)
            x = left_margin
            # N° PREDIAL (30 dígitos completo)
            c.rect(x, y - 12, cancel_cols[0], 12, fill=0, stroke=1)
            c.drawString(x + 1, y - 9, npn)
            x += cancel_cols[0]
            # APELLIDOS Y NOMBRES
            c.rect(x, y - 12, cancel_cols[1], 12, fill=0, stroke=1)
            nombre = prop.get('nombre', '')[:25]
            c.drawString(x + 1, y - 9, nombre)
            x += cancel_cols[1]
            # TIPO DOC.
            c.rect(x, y - 12, cancel_cols[2], 12, fill=0, stroke=1)
            tipo_doc = prop.get('tipo_documento', 'CC')
            c.drawCentredString(x + cancel_cols[2]/2, y - 9, tipo_doc)
            x += cancel_cols[2]
            # NRO. DOC.
            c.rect(x, y - 12, cancel_cols[3], 12, fill=0, stroke=1)
            nro_doc = prop.get('documento', prop.get('nro_documento', ''))
            c.drawString(x + 1, y - 9, str(nro_doc)[:15])
            x += cancel_cols[3]
            # ESTADO (estado civil: CASADO, SOLTERO, VIUDO, etc.)
            c.rect(x, y - 12, cancel_cols[4], 12, fill=0, stroke=1)
            estado_civil = prop.get('estado_civil', prop.get('estado', ''))
            c.drawCentredString(x + cancel_cols[4]/2, y - 9, estado_civil[:10])
            y -= 12
    else:
        y = check_page_break(y, 15)
        c.rect(left_margin, y - 12, content_width, 12, fill=0, stroke=1)
        c.drawString(left_margin + 5, y - 9, "Sin datos de nuevo propietario")
        y -= 12
    y -= 5
    
    # Datos del predio en INSCRIPCIÓN
    y = dibujar_datos_predio(y)
    
    y -= espaciado_secciones
    
    # Artículo 2
    y = check_page_break(y, 50)
    c.setFont(font_bold, fuente_cuerpo)
    c.drawString(left_margin, y, "Artículo 2.")
    c.setFont(font_normal, fuente_cuerpo)
    texto_art2 = textos['articulo_2']
    lines_art2 = simpleSplit(texto_art2, font_normal, fuente_cuerpo, content_width - 60)
    x_offset = left_margin + c.stringWidth("Artículo 2. ", font_bold, fuente_cuerpo)
    if lines_art2:
        c.drawString(x_offset, y, lines_art2[0])
        y -= espaciado_parrafos
        for line in lines_art2[1:]:
            c.drawString(left_margin, y, line)
            y -= espaciado_parrafos
    y -= 5
    
    # Artículo 3
    y = check_page_break(y, 50)
    c.setFont(font_bold, fuente_cuerpo)
    c.drawString(left_margin, y, "Artículo 3.")
    c.setFont(font_normal, fuente_cuerpo)
    texto_art3 = textos['articulo_3']
    lines_art3 = simpleSplit(texto_art3, font_normal, fuente_cuerpo, content_width - 60)
    x_offset = left_margin + c.stringWidth("Artículo 3. ", font_bold, fuente_cuerpo)
    if lines_art3:
        c.drawString(x_offset, y, lines_art3[0])
        y -= espaciado_parrafos
        for line in lines_art3[1:]:
            c.drawString(left_margin, y, line)
            y -= espaciado_parrafos
    y -= 5
    
    # Artículo 4
    y = check_page_break(y, 30)
    c.setFont(font_bold, fuente_cuerpo)
    c.drawString(left_margin, y, "Artículo 4.")
    c.setFont(font_normal, fuente_cuerpo)
    x_offset = left_margin + c.stringWidth("Artículo 4. ", font_bold, fuente_cuerpo)
    c.drawString(x_offset, y, textos['articulo_4'])
    y -= espaciado_secciones + 5
    
    # === CIERRE ===
    y = check_page_break(y, 30)
    c.setFont(font_bold, fuente_cuerpo)
    # COMUNIQUESE,NOTIFIQUESEYCUMPLASE con espaciado entre letras
    cierre_espaciado = " ".join(textos['cierre'].replace(" ", ""))
    c.drawCentredString(width/2, y, cierre_espaciado)
    y -= espaciado_secciones
    
    # Fecha de expedición - en mayúsculas
    y = check_page_break(y, 20)
    c.setFont(font_bold, fuente_cuerpo)
    meses_may = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 
                 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
    fecha_actual = datetime.now()
    fecha_texto = f"DADA EN OCAÑA A LOS {fecha_actual.day} DÍAS DE {meses_may[fecha_actual.month-1]} DE {fecha_actual.year}"
    c.drawString(left_margin, y, fecha_texto)
    y -= espaciado_secciones + 40
    
    # === FIRMA ===
    y = check_page_break(y, 100)
    
    # Línea encima del nombre
    linea_width = 200
    c.setStrokeColor(negro)
    c.line(width/2 - linea_width/2, y + 5, width/2 + linea_width/2, y + 5)
    
    c.setFont(font_bold, fuente_cuerpo)
    c.drawCentredString(width/2, y - 10, textos['firmante_nombre'])
    y -= espaciado_parrafos + 10
    c.setFont(font_bold, fuente_cuerpo - 1)
    c.drawCentredString(width/2, y - 5, textos['firmante_cargo'])
    y -= espaciado_secciones + 20
    
    # === ELABORÓ / REVISÓ ===
    y = check_page_break(y, 30)
    c.setFont(font_normal, fuente_tabla)
    c.drawString(left_margin, y, f"Elaboró: {elaboro}")
    y -= 12
    c.drawString(left_margin, y, f"Revisó:  {reviso}")
    
    # === PIE DE PÁGINA ===
    draw_footer()
    
    c.save()
    buffer.seek(0)
    return buffer.getvalue()


if __name__ == "__main__":
    # Prueba básica
    pdf_bytes = generate_resolucion_pdf(
        numero_resolucion="RES-54-003-0001-2026",
        fecha_resolucion="19-01-2026",
        municipio="Ábrego",
        tipo_tramite="Cambio de Propietario",
        radicado="RASMGC-5505-30-12-2025",
        codigo_catastral_anterior="000400020197000",
        npn="540030004000000020197000000000",
        matricula_inmobiliaria="270-52528",
        direccion="LO 1 EL DIAMANTE",
        avaluo="$42.023.000",
        vigencia_fiscal="01/01/2026",
        area_terreno="150",
        area_construida="80",
        destino_economico="A",  # A-Habitacional
        codigo_homologado="BPP0002BUUC",
        propietarios_anteriores=[{
            "nombre": "PROPIETARIO ANTERIOR",
            "tipo_documento": "CC",
            "documento": "12345678",
            "estado_civil": "CASADO"
        }],
        propietarios_nuevos=[{
            "nombre": "PROPIETARIO NUEVO",
            "tipo_documento": "CC",
            "documento": "87654321",
            "estado_civil": "SOLTERO"
        }],
        elaboro="Usuario Prueba",
        reviso="Coordinador",
    )
    
    with open("/app/backend/test_resolucion.pdf", "wb") as f:
        f.write(pdf_bytes)
    
    print(f"PDF generado: {len(pdf_bytes)} bytes")
    
    with open("/app/backend/test_resolucion.pdf", "wb") as f:
        f.write(pdf_bytes)
    
    print(f"PDF generado: {len(pdf_bytes)} bytes")
