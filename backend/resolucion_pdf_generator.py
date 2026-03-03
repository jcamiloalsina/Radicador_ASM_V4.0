"""
Generador de PDF de Resolución Catastral
Usa los mismos márgenes y posiciones que el Certificado Catastral
"""
import io
import os
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
        "cierre": "COMUNÍQUESE,NOTIFÍQUESEYCÚMPLASE",
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
    elaboro: str = "",      # Nombre del usuario que solicitó el cambio
    aprobo: str = "",       # Nombre del usuario que aprobó el cambio
    plantilla: dict = None,
    imagen_encabezado_b64: str = None,
    imagen_pie_b64: str = None,
    imagen_firma_b64: str = None,
    config_visual: dict = None,
    # Datos anteriores del predio (para la sección CANCELACIÓN)
    area_terreno_anterior: str = None,
    area_construida_anterior: str = None,
    avaluo_anterior: str = None,
    direccion_anterior: str = None,
    destino_economico_anterior: str = None,
    codigo_homologado_anterior: str = None,
    matricula_anterior: str = None,
    # Código de verificación para QR idéntico al certificado catastral
    codigo_verificacion: str = None,
    verificacion_base_url: str = None,
) -> bytes:
    """
    Genera un PDF de resolución catastral usando los mismos márgenes
    y posiciones que el certificado catastral.
    """
    
    # Helper para formatear área con unidades de medida
    def formatear_area(area_str):
        """Convierte área en m² a formato 'X Ha Y m²' """
        try:
            area = float(area_str or 0)
            if area >= 10000:
                ha = int(area // 10000)
                m2 = int(area % 10000)
                if m2 > 0:
                    return f"{ha} Ha {m2:,} m²".replace(",", ".")
                else:
                    return f"{ha} Ha"
            else:
                return f"{int(area):,} m²".replace(",", ".")
        except:
            return str(area_str or "0")
    
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
    
    # Cargar logo para marca de agua
    logo_watermark = None
    try:
        # Usar la imagen de marca de agua en gris
        logo_path = "/app/frontend/public/watermark-gray.png"
        if os.path.exists(logo_path):
            logo_watermark = ImageReader(logo_path)
    except Exception as e:
        print(f"Error cargando logo: {e}")
        logo_watermark = None
    
    # Configuración de fuentes
    fuente_titulo = 11
    fuente_cuerpo = 9
    fuente_tabla = 7
    espaciado_parrafos = 12
    espaciado_secciones = 18
    
    def draw_watermark():
        """Dibuja la marca de agua con el logo de Asomunicipios"""
        if logo_watermark:
            c.saveState()
            # Tamaño y posición del logo (centrado en la página)
            watermark_width = 450
            watermark_height = 180
            watermark_x = (width - watermark_width) / 2
            watermark_y = (height - watermark_height) / 2
            # Aplicar transparencia uniforme (15%)
            c.setFillAlpha(0.15)
            c.drawImage(logo_watermark, watermark_x, watermark_y,
                       width=watermark_width, height=watermark_height,
                       preserveAspectRatio=True, mask='auto')
            c.restoreState()
    
    def draw_header():
        """Dibuja el encabezado IDÉNTICO al certificado catastral"""
        # Primero dibujar la marca de agua (detrás del contenido)
        draw_watermark()
        
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
        doc_texto = doc.replace('{matricula_inmobiliaria}', matricula_inmobiliaria or '---')
        c.drawString(left_margin + 15, y, f"• {doc_texto}")
        y -= espaciado_parrafos
    y -= 8
    
    # Considerando 3 - Ya no usa codigo_catastral_anterior, solo npn
    y = check_page_break(y, 30)
    texto_c3 = textos['considerando_3'].replace('{npn}', npn or '')
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
    def dibujar_datos_predio(y_pos, datos_predio=None, es_cancelacion=False):
        """
        Dibuja la fila de datos del predio (usado en cancelación e inscripción)
        - Para CANCELACIÓN: usa datos_predio con valores anteriores
        - Para INSCRIPCIÓN: usa datos_predio con valores nuevos
        """
        y = y_pos
        
        # Usar datos proporcionados o valores por defecto (nuevos)
        if datos_predio is None:
            datos_predio = {}
        
        # Obtener valores con fallback a los datos actuales
        p_codigo_homologado = datos_predio.get('codigo_homologado', codigo_homologado) or ""
        p_direccion = datos_predio.get('direccion', direccion) or ""
        p_destino = datos_predio.get('destino_economico', destino_economico) or "A"
        p_area_terreno = datos_predio.get('area_terreno', area_terreno)
        p_area_construida = datos_predio.get('area_construida', area_construida)
        p_avaluo = datos_predio.get('avaluo', avaluo) or ""
        p_matricula = datos_predio.get('matricula', matricula_inmobiliaria) or ""
        
        # Headers: CÓDIGO HOMOLOGADO | DIRECCIÓN O VEREDA | DES | A-TERRENO | A-CONS | AVALÚO | VIGENCIA FISCAL
        y = check_page_break(y, 30)
        c.setFillColor(colors.HexColor('#e8e8e8'))
        c.rect(left_margin, y - 12, content_width, 12, fill=1, stroke=1)
        c.setFillColor(negro)
        c.setFont(font_bold, fuente_tabla - 1)
        
        predio_cols = [content_width * 0.15, content_width * 0.17, content_width * 0.06, content_width * 0.18, content_width * 0.14, content_width * 0.15, content_width * 0.15]
        predio_headers = ["CÓD. HOMOLOGADO", "DIRECCIÓN", "DES", "A-TERRENO", "A-CONS", "AVALÚO", "VIG. FISCAL"]
        x = left_margin
        for i, header in enumerate(predio_headers):
            c.drawCentredString(x + predio_cols[i]/2, y - 9, header)
            c.rect(x, y - 12, predio_cols[i], 12, fill=0, stroke=1)
            x += predio_cols[i]
        y -= 12
        
        # Datos del predio - centrados
        y = check_page_break(y, 15)
        c.setFont(font_normal, fuente_tabla - 2)
        x = left_margin
        # CÓDIGO HOMOLOGADO (alfanumérico tipo BPP0002BUUC) - centrado
        c.rect(x, y - 12, predio_cols[0], 12, fill=0, stroke=1)
        c.drawCentredString(x + predio_cols[0]/2, y - 9, p_codigo_homologado[:12] if len(p_codigo_homologado) > 12 else p_codigo_homologado)
        x += predio_cols[0]
        # DIRECCIÓN O VEREDA - centrado
        c.rect(x, y - 12, predio_cols[1], 12, fill=0, stroke=1)
        dir_corta = p_direccion[:15] if len(p_direccion) > 15 else p_direccion
        c.drawCentredString(x + predio_cols[1]/2, y - 9, dir_corta)
        x += predio_cols[1]
        # DES (Destino Económico - letra: A, B, C, D, etc.) - centrado
        c.rect(x, y - 12, predio_cols[2], 12, fill=0, stroke=1)
        c.drawCentredString(x + predio_cols[2]/2, y - 9, p_destino[:1] if p_destino else "A")
        x += predio_cols[2]
        # A-TERRENO - con formato de unidades y centrado
        c.rect(x, y - 12, predio_cols[3], 12, fill=0, stroke=1)
        area_terr_fmt = formatear_area(p_area_terreno)
        c.drawCentredString(x + predio_cols[3]/2, y - 9, area_terr_fmt)
        x += predio_cols[3]
        # A-CONS - con formato de unidades y centrado
        c.rect(x, y - 12, predio_cols[4], 12, fill=0, stroke=1)
        area_cons_fmt = formatear_area(p_area_construida)
        c.drawCentredString(x + predio_cols[4]/2, y - 9, area_cons_fmt)
        x += predio_cols[4]
        # AVALÚO - centrado
        c.rect(x, y - 12, predio_cols[5], 12, fill=0, stroke=1)
        c.drawCentredString(x + predio_cols[5]/2, y - 9, p_avaluo[:12] if len(str(p_avaluo)) > 12 else str(p_avaluo))
        x += predio_cols[5]
        # VIGENCIA FISCAL - centrado
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
        c.drawCentredString(left_margin + content_width * 0.3 + (content_width * 0.7)/2, y - 9, p_matricula)
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
            # N° PREDIAL (30 dígitos completo) - centrado
            c.rect(x, y - 12, cancel_cols[0], 12, fill=0, stroke=1)
            c.setFont(font_normal, fuente_tabla - 2)  # Fuente más pequeña para el código
            c.drawCentredString(x + cancel_cols[0]/2, y - 9, npn[:30])
            c.setFont(font_normal, fuente_tabla - 1)
            x += cancel_cols[0]
            # APELLIDOS Y NOMBRES - centrado
            c.rect(x, y - 12, cancel_cols[1], 12, fill=0, stroke=1)
            nombre = prop.get('nombre', '')[:25]
            c.drawCentredString(x + cancel_cols[1]/2, y - 9, nombre)
            x += cancel_cols[1]
            # TIPO DOC. - centrado
            c.rect(x, y - 12, cancel_cols[2], 12, fill=0, stroke=1)
            tipo_doc = prop.get('tipo_documento', 'CC')
            c.drawCentredString(x + cancel_cols[2]/2, y - 9, tipo_doc)
            x += cancel_cols[2]
            # NRO. DOC. - centrado
            c.rect(x, y - 12, cancel_cols[3], 12, fill=0, stroke=1)
            nro_doc = prop.get('documento', prop.get('nro_documento', ''))
            c.drawCentredString(x + cancel_cols[3]/2, y - 9, str(nro_doc)[:15])
            x += cancel_cols[3]
            # ESTADO (estado civil: CASADO, SOLTERO, VIUDO, etc.) - centrado
            c.rect(x, y - 12, cancel_cols[4], 12, fill=0, stroke=1)
            estado_civil = prop.get('estado_civil', prop.get('estado', ''))
            c.drawCentredString(x + cancel_cols[4]/2, y - 9, estado_civil[:10])
            y -= 12
    else:
        y = check_page_break(y, 15)
        c.rect(left_margin, y - 12, content_width, 12, fill=0, stroke=1)
        c.drawCentredString(left_margin + content_width/2, y - 9, "Sin datos de propietario anterior")
        y -= 12
    y -= 5
    
    # Datos del predio en CANCELACIÓN (usa datos ANTERIORES)
    datos_cancelacion = {
        'codigo_homologado': codigo_homologado_anterior if codigo_homologado_anterior else codigo_homologado,
        'direccion': direccion_anterior if direccion_anterior else direccion,
        'destino_economico': destino_economico_anterior if destino_economico_anterior else destino_economico,
        'area_terreno': area_terreno_anterior if area_terreno_anterior else area_terreno,
        'area_construida': area_construida_anterior if area_construida_anterior else area_construida,
        'avaluo': avaluo_anterior if avaluo_anterior else avaluo,
        'matricula': matricula_anterior if matricula_anterior else matricula_inmobiliaria,
    }
    y = dibujar_datos_predio(y, datos_cancelacion, es_cancelacion=True)
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
            # N° PREDIAL (30 dígitos completo) - centrado
            c.rect(x, y - 12, cancel_cols[0], 12, fill=0, stroke=1)
            c.setFont(font_normal, fuente_tabla - 2)  # Fuente más pequeña para el código
            c.drawCentredString(x + cancel_cols[0]/2, y - 9, npn[:30])
            c.setFont(font_normal, fuente_tabla - 1)
            x += cancel_cols[0]
            # APELLIDOS Y NOMBRES - centrado
            c.rect(x, y - 12, cancel_cols[1], 12, fill=0, stroke=1)
            nombre = prop.get('nombre', '')[:25]
            c.drawCentredString(x + cancel_cols[1]/2, y - 9, nombre)
            x += cancel_cols[1]
            # TIPO DOC. - centrado
            c.rect(x, y - 12, cancel_cols[2], 12, fill=0, stroke=1)
            tipo_doc = prop.get('tipo_documento', 'CC')
            c.drawCentredString(x + cancel_cols[2]/2, y - 9, tipo_doc)
            x += cancel_cols[2]
            # NRO. DOC. - centrado
            c.rect(x, y - 12, cancel_cols[3], 12, fill=0, stroke=1)
            nro_doc = prop.get('documento', prop.get('nro_documento', ''))
            c.drawCentredString(x + cancel_cols[3]/2, y - 9, str(nro_doc)[:15])
            x += cancel_cols[3]
            # ESTADO (estado civil: CASADO, SOLTERO, VIUDO, etc.) - centrado
            c.rect(x, y - 12, cancel_cols[4], 12, fill=0, stroke=1)
            estado_civil = prop.get('estado_civil', prop.get('estado', ''))
            c.drawCentredString(x + cancel_cols[4]/2, y - 9, estado_civil[:10])
            y -= 12
    else:
        y = check_page_break(y, 15)
        c.rect(left_margin, y - 12, content_width, 12, fill=0, stroke=1)
        c.drawCentredString(left_margin + content_width/2, y - 9, "Sin datos de nuevo propietario")
        y -= 12
    y -= 5
    
    # Datos del predio en INSCRIPCIÓN (usa datos NUEVOS/ACTUALES)
    datos_inscripcion = {
        'codigo_homologado': codigo_homologado,
        'direccion': direccion,
        'destino_economico': destino_economico,
        'area_terreno': area_terreno,
        'area_construida': area_construida,
        'avaluo': avaluo,
        'matricula': matricula_inmobiliaria,
    }
    y = dibujar_datos_predio(y, datos_inscripcion, es_cancelacion=False)
    
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
    y = check_page_break(y, 120)
    
    # Cargar imagen de firma de Dalgie
    firma_dalgie = None
    try:
        firma_path = "/app/backend/logos/firma_dalgie_blanco.png"
        if os.path.exists(firma_path):
            firma_dalgie = ImageReader(firma_path)
    except:
        firma_dalgie = None
    
    # === SECCIÓN DE FIRMA Y QR - LADO A LADO (IGUAL QUE CERTIFICADO) ===
    y = check_page_break(y, 120)
    
    # Generar QR de verificación primero
    qr_image = None
    fecha_hora_gen = datetime.now().strftime("%d/%m/%Y %H:%M")
    hash_doc = ""
    
    try:
        import qrcode
        import hashlib
        
        # Determinar URL base de verificación
        base_url = verificacion_base_url or "https://certificados.asomunicipios.gov.co"
        
        # Si hay código de verificación, usar el mismo formato que certificado catastral
        if codigo_verificacion:
            qr_data = f"{base_url}/api/verificar/{codigo_verificacion}"
        else:
            qr_data = f"{base_url}/api/verificar-resolucion/{numero_resolucion}"
        
        # QR con misma configuración que certificado catastral
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=2,
        )
        qr.add_data(qr_data)
        qr.make(fit=True)
        
        # Color verde institucional idéntico al certificado catastral
        qr_img = qr.make_image(fill_color="#009846", back_color="white")
        
        # Convertir a formato compatible con ReportLab
        qr_buffer = io.BytesIO()
        qr_img.save(qr_buffer, format='PNG')
        qr_buffer.seek(0)
        qr_image = ImageReader(qr_buffer)
        
        # Hash del documento
        hash_input = f"{npn}-{codigo_verificacion or numero_resolucion}-{fecha_hora_gen}"
        hash_doc = hashlib.sha256(hash_input.encode()).hexdigest()
        
    except Exception as e:
        print(f"Error generando QR: {e}")
    
    # === CALCULAR POSICIONES PARA FIRMA Y QR LADO A LADO ===
    firma_block_width = 200  # Ancho del bloque de firma
    verif_block_width = 185  # Ancho del bloque de verificación
    gap_between = 20  # Espacio entre ambos bloques
    
    # Calcular inicio para centrar ambos bloques
    total_blocks_width = firma_block_width + gap_between + verif_block_width
    start_x = left_margin + (content_width - total_blocks_width) / 2
    
    # Altura de ambos bloques (para alinearlos)
    block_height = 90
    block_y = y - block_height
    
    # === BLOQUE IZQUIERDO: FIRMA DE DALGIE ===
    firma_center_x = start_x + firma_block_width / 2
    
    # Dibujar imagen de firma si existe
    if firma_dalgie:
        firma_img_width = 100
        firma_img_height = 50
        c.drawImage(firma_dalgie, firma_center_x - firma_img_width/2, block_y + 40,
                   width=firma_img_width, height=firma_img_height, mask='auto')
    
    # Línea debajo de la firma
    linea_width = 160
    linea_y = block_y + 35
    c.setStrokeColor(negro)
    c.line(firma_center_x - linea_width/2, linea_y, firma_center_x + linea_width/2, linea_y)
    
    # Nombre del firmante
    c.setFont(font_bold, fuente_cuerpo)
    c.setFillColor(negro)
    c.drawCentredString(firma_center_x, linea_y - 12, textos['firmante_nombre'])
    
    # Cargo del firmante
    c.setFont(font_bold, fuente_cuerpo - 1)
    c.drawCentredString(firma_center_x, linea_y - 24, textos['firmante_cargo'])
    
    # === BLOQUE DERECHO: CUADRO DE VERIFICACIÓN (IDÉNTICO AL CERTIFICADO) ===
    if qr_image:
        gris_claro = colors.HexColor('#666666')
        marco_width = verif_block_width
        marco_height = 58
        marco_x = start_x + firma_block_width + gap_between
        marco_y = block_y + 15
        
        # Fondo del marco (verde muy claro)
        c.setFillColor(colors.HexColor('#f0fdf4'))
        c.roundRect(marco_x, marco_y, marco_width, marco_height, 5, fill=1, stroke=0)
        
        # Borde verde institucional
        c.setStrokeColor(verde_institucional)
        c.setLineWidth(1.5)
        c.roundRect(marco_x, marco_y, marco_width, marco_height, 5, fill=0, stroke=1)
        
        # QR dentro del marco (izquierda del bloque)
        qr_size = 46
        c.drawImage(qr_image, marco_x + 5, marco_y + 6, width=qr_size, height=qr_size, mask='auto')
        
        # Información de verificación (derecha del QR)
        info_x = marco_x + 55
        
        # Título
        c.setFillColor(verde_institucional)
        c.setFont(font_bold, 8)
        c.drawString(info_x, marco_y + marco_height - 11, "RESOLUCIÓN VERIFICABLE")
        
        # Código
        c.setFillColor(negro)
        c.setFont(font_bold, 7)
        codigo_mostrar = codigo_verificacion or numero_resolucion
        c.drawString(info_x, marco_y + 36, f"Código: {codigo_mostrar}")
        
        # Detalles
        c.setFont(font_normal, 6)
        c.setFillColor(gris_claro)
        c.drawString(info_x, marco_y + 26, f"Generado: {fecha_hora_gen}")
        c.drawString(info_x, marco_y + 17, f"Hash: SHA256:{hash_doc[:12]}...")
        
        # URL de verificación
        c.setFillColor(verde_institucional)
        c.setFont(font_normal, 6)
        c.drawString(info_x, marco_y + 8, "Escanear QR para verificar")
    
    y = block_y - 10
    
    # === ELABORÓ / APROBÓ (debajo de la firma y QR) ===
    y = check_page_break(y, 30)
    c.setFont(font_normal, fuente_tabla)
    c.setFillColor(negro)
    c.drawString(left_margin, y, f"Elaboró: {elaboro}")
    y -= 12
    c.drawString(left_margin, y, f"Aprobó:  {aprobo}")
    
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
        elaboro="Armando Cárdenas",
        aprobo="Juan Carlos Alsina",
    )
    
    with open("/app/backend/test_resolucion.pdf", "wb") as f:
        f.write(pdf_bytes)
    
    print(f"PDF generado: {len(pdf_bytes)} bytes")
    
    with open("/app/backend/test_resolucion.pdf", "wb") as f:
        f.write(pdf_bytes)
    
    print(f"PDF generado: {len(pdf_bytes)} bytes")
