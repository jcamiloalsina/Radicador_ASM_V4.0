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
        "articulo_2": "El presente acto administrativo rige a partir de la fecha de su expedición.",
        "articulo_3": "Los avalúos incorporados tienen vigencia fiscal a partir del {vigencia_fiscal}.",
        "articulo_4": "Contra el presente acto administrativo no procede recurso alguno.",
        "cierre": "COMUNÍQUESE, NOTIFÍQUESE Y CÚMPLASE",
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
    c.drawCentredString(width/2, y, "RESUELVE")
    y -= espaciado_secciones
    
    # Artículo 1
    y = check_page_break(y, 50)
    c.setFont(font_bold, fuente_cuerpo)
    c.drawString(left_margin, y, "ARTÍCULO 1.")
    c.setFont(font_normal, fuente_cuerpo)
    texto_art1 = textos['articulo_1_intro'].replace('{municipio}', municipio)
    lines = simpleSplit(texto_art1, font_normal, fuente_cuerpo, content_width - 70)
    x_offset = left_margin + c.stringWidth("ARTÍCULO 1. ", font_bold, fuente_cuerpo)
    if lines:
        c.drawString(x_offset, y, lines[0])
        y -= espaciado_parrafos
        for line in lines[1:]:
            c.drawString(left_margin, y, line)
            y -= espaciado_parrafos
    y -= 10
    
    # Tabla de cancelación/inscripción
    y = check_page_break(y, 100)
    
    # --- Tabla CANCELACIÓN ---
    c.setFillColor(verde_institucional)
    c.rect(left_margin, y - 15, content_width, 15, fill=1, stroke=0)
    c.setFillColor(blanco)
    c.setFont(font_bold, fuente_tabla + 1)
    c.drawCentredString(width/2, y - 12, "CANCELACIÓN")
    y -= 20
    
    # Encabezado tabla cancelación
    c.setFillColor(colors.HexColor('#f0f0f0'))
    c.rect(left_margin, y - 12, content_width, 12, fill=1, stroke=0)
    c.setFillColor(negro)
    c.setFont(font_bold, fuente_tabla)
    
    col_widths = [content_width * 0.25, content_width * 0.35, content_width * 0.20, content_width * 0.20]
    headers = ["NPN / CÓDIGO", "PROPIETARIO", "DOCUMENTO", "AVALÚO"]
    x = left_margin
    for i, header in enumerate(headers):
        c.drawCentredString(x + col_widths[i]/2, y - 9, header)
        x += col_widths[i]
    y -= 15
    
    # Datos cancelación
    c.setFont(font_normal, fuente_tabla)
    if propietarios_anteriores:
        for prop in propietarios_anteriores:
            y = check_page_break(y, 20)
            x = left_margin
            c.drawString(x + 2, y - 9, npn[:20] + "..." if len(npn) > 20 else npn)
            x += col_widths[0]
            nombre = prop.get('nombre', '')[:25]
            c.drawString(x + 2, y - 9, nombre)
            x += col_widths[1]
            c.drawString(x + 2, y - 9, prop.get('documento', ''))
            x += col_widths[2]
            c.drawString(x + 2, y - 9, avaluo)
            y -= 12
    else:
        c.drawString(left_margin + 5, y - 9, "Sin datos de propietario anterior")
        y -= 12
    y -= 10
    
    # --- Tabla INSCRIPCIÓN ---
    y = check_page_break(y, 60)
    c.setFillColor(verde_institucional)
    c.rect(left_margin, y - 15, content_width, 15, fill=1, stroke=0)
    c.setFillColor(blanco)
    c.setFont(font_bold, fuente_tabla + 1)
    c.drawCentredString(width/2, y - 12, "INSCRIPCIÓN")
    y -= 20
    
    # Encabezado tabla inscripción
    c.setFillColor(colors.HexColor('#f0f0f0'))
    c.rect(left_margin, y - 12, content_width, 12, fill=1, stroke=0)
    c.setFillColor(negro)
    c.setFont(font_bold, fuente_tabla)
    
    x = left_margin
    for i, header in enumerate(headers):
        c.drawCentredString(x + col_widths[i]/2, y - 9, header)
        x += col_widths[i]
    y -= 15
    
    # Datos inscripción
    c.setFont(font_normal, fuente_tabla)
    if propietarios_nuevos:
        for prop in propietarios_nuevos:
            y = check_page_break(y, 20)
            x = left_margin
            c.drawString(x + 2, y - 9, npn[:20] + "..." if len(npn) > 20 else npn)
            x += col_widths[0]
            nombre = prop.get('nombre', '')[:25]
            c.drawString(x + 2, y - 9, nombre)
            x += col_widths[1]
            c.drawString(x + 2, y - 9, prop.get('documento', ''))
            x += col_widths[2]
            c.drawString(x + 2, y - 9, avaluo)
            y -= 12
    else:
        c.drawString(left_margin + 5, y - 9, "Sin datos de nuevo propietario")
        y -= 12
    y -= espaciado_secciones
    
    # Artículo 2
    y = check_page_break(y, 30)
    c.setFont(font_bold, fuente_cuerpo)
    c.drawString(left_margin, y, "ARTÍCULO 2.")
    c.setFont(font_normal, fuente_cuerpo)
    x_offset = left_margin + c.stringWidth("ARTÍCULO 2. ", font_bold, fuente_cuerpo)
    c.drawString(x_offset, y, textos['articulo_2'])
    y -= espaciado_parrafos + 5
    
    # Artículo 3
    y = check_page_break(y, 30)
    c.setFont(font_bold, fuente_cuerpo)
    c.drawString(left_margin, y, "ARTÍCULO 3.")
    c.setFont(font_normal, fuente_cuerpo)
    texto_art3 = textos['articulo_3'].replace('{vigencia_fiscal}', vigencia_fiscal)
    x_offset = left_margin + c.stringWidth("ARTÍCULO 3. ", font_bold, fuente_cuerpo)
    c.drawString(x_offset, y, texto_art3)
    y -= espaciado_parrafos + 5
    
    # Artículo 4
    y = check_page_break(y, 30)
    c.setFont(font_bold, fuente_cuerpo)
    c.drawString(left_margin, y, "ARTÍCULO 4.")
    c.setFont(font_normal, fuente_cuerpo)
    x_offset = left_margin + c.stringWidth("ARTÍCULO 4. ", font_bold, fuente_cuerpo)
    c.drawString(x_offset, y, textos['articulo_4'])
    y -= espaciado_secciones + 5
    
    # === CIERRE ===
    y = check_page_break(y, 30)
    c.setFont(font_bold, fuente_cuerpo)
    c.drawCentredString(width/2, y, textos['cierre'])
    y -= espaciado_secciones
    
    # Fecha de expedición
    y = check_page_break(y, 20)
    c.setFont(font_normal, fuente_cuerpo)
    meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
             'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
    fecha_actual = datetime.now()
    fecha_texto = f"Dada en Ocaña a los {fecha_actual.day} días del mes de {meses[fecha_actual.month-1]} de {fecha_actual.year}"
    c.drawCentredString(width/2, y, fecha_texto)
    y -= espaciado_secciones + 10
    
    # === FIRMA ===
    y = check_page_break(y, 80)
    if firma_img:
        firma_width = 100
        firma_height = 50
        c.drawImage(firma_img, width/2 - firma_width/2, y - firma_height, 
                    width=firma_width, height=firma_height, mask='auto')
        y -= firma_height + 5
    
    c.setFont(font_bold, fuente_cuerpo)
    c.drawCentredString(width/2, y, textos['firmante_nombre'])
    y -= espaciado_parrafos
    c.setFont(font_normal, fuente_cuerpo - 1)
    c.drawCentredString(width/2, y, textos['firmante_cargo'])
    y -= espaciado_secciones
    
    # === ELABORÓ / REVISÓ ===
    y = check_page_break(y, 30)
    c.setFont(font_normal, fuente_tabla)
    c.drawString(left_margin, y, f"Elaboró: {elaboro}")
    y -= 10
    c.drawString(left_margin, y, f"Revisó: {reviso}")
    
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
        propietarios_anteriores=[{"nombre": "PROPIETARIO ANTERIOR", "documento": "C 12345678"}],
        propietarios_nuevos=[{"nombre": "PROPIETARIO NUEVO", "documento": "C 87654321"}],
        elaboro="Usuario Prueba",
        reviso="Coordinador",
    )
    
    with open("/app/backend/test_resolucion.pdf", "wb") as f:
        f.write(pdf_bytes)
    
    print(f"PDF generado: {len(pdf_bytes)} bytes")
