"""
Generador de PDF de Resolución Catastral con configuración visual personalizable
"""
import io
import base64
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.lib.utils import simpleSplit, ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Importar imágenes por defecto
from certificado_images import get_encabezado_image, get_pie_pagina_image, get_firma_dalgie_image


def get_default_config():
    """Retorna la configuración visual por defecto"""
    return {
        "margen_superior": 50,
        "margen_inferior": 80,
        "margen_izquierdo": 50,
        "margen_derecho": 50,
        "encabezado_altura": 60,
        "encabezado_mostrar": True,
        "pie_altura": 50,
        "pie_mostrar": True,
        "firma_posicion": "centro",  # izquierda, centro, derecha
        "firma_altura": 60,
        "firma_ancho": 100,
        "firma_offset_y": 40,
        "firma_mostrar": True,
        "fuente_titulo": 11,
        "fuente_cuerpo": 9,
        "fuente_tabla": 7,
        "espaciado_parrafos": 12,
        "espaciado_secciones": 20
    }


def get_default_plantilla():
    """Retorna la plantilla de textos por defecto"""
    return {
        "preambulo": (
            "La Asociación de Municipios del Catatumbo, Provincia de Ocaña y Sur del Cesar "
            "(ASOMUNICIPIOS), actuando en calidad de Gestor Catastral, en concordancia con la "
            "ley 14 de 1983 y el decreto 148 del 2020, y la resolución IGAC 1204 del 2021, en uso "
            "de sus facultades legales y,"
        ),
        "considerando_1": "Que, ante la oficina de gestión catastral de Asomunicipios, solicitan un trámite catastral de {tipo_tramite}, radicado bajo el consecutivo {radicado}.",
        "considerando_2_intro": "Que, se aportaron como soportes los siguientes documentos:",
        "considerando_2_docs": [
            "Oficio de solicitud.",
            "Cédula de ciudadanía.",
            "Certificado de Tradición y Libertad con número de matrícula inmobiliaria {matricula_inmobiliaria}."
        ],
        "considerando_3": "Que, según estudio de oficina se hace necesario efectuar una mutación de primera, para el predio con código catastral anterior número {codigo_catastral} y NPN {npn}.",
        "considerando_final": (
            "En consecuencia y dado que se aportaron y verificaron los soportes pertinentes, "
            "amparados en la resolución IGAC 1040 del 2023: 'por la cual se actualiza la reglamentación "
            "técnica de la formación, actualización, conservación y difusión catastral con enfoque multipropósito', se:"
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
    propietarios_anteriores: list,
    propietarios_nuevos: list,
    elaboro: str,
    reviso: str,
    # Configuración personalizable
    config_visual: dict = None,
    plantilla: dict = None,
    # Imágenes personalizadas (base64)
    imagen_encabezado_b64: str = None,
    imagen_pie_b64: str = None,
    imagen_firma_b64: str = None,
) -> bytes:
    """
    Genera un PDF de resolución catastral con configuración visual personalizable.
    """
    
    # Usar configuración por defecto si no se proporciona
    config = {**get_default_config(), **(config_visual or {})}
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
    
    # Cargar imágenes (personalizadas o por defecto)
    try:
        if imagen_encabezado_b64:
            encabezado_img = ImageReader(io.BytesIO(base64.b64decode(imagen_encabezado_b64)))
        else:
            encabezado_img = ImageReader(get_encabezado_image())
    except:
        encabezado_img = None
    
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
    
    # Extraer configuración
    margin_left = config['margen_izquierdo']
    margin_right = config['margen_derecho']
    margin_top = config['margen_superior']
    margin_bottom = config['margen_inferior']
    content_width = width - margin_left - margin_right
    
    fuente_titulo = config['fuente_titulo']
    fuente_cuerpo = config['fuente_cuerpo']
    fuente_tabla = config['fuente_tabla']
    espaciado_parrafos = config['espaciado_parrafos']
    espaciado_secciones = config['espaciado_secciones']
    
    y = height - margin_top
    
    # === ENCABEZADO ===
    if config['encabezado_mostrar'] and encabezado_img:
        img_width = 500
        img_height = config['encabezado_altura']
        c.drawImage(encabezado_img, margin_left, y - img_height, width=img_width, height=img_height, mask='auto')
        y -= img_height + 20
    elif config['encabezado_mostrar']:
        c.setFont(font_bold, 14)
        c.drawCentredString(width/2, y, "ASOCIACIÓN DE MUNICIPIOS DEL CATATUMBO")
        y -= 15
        c.setFont(font_normal, 10)
        c.drawCentredString(width/2, y, "Provincia de Ocaña y Sur del Cesar - Gestor Catastral")
        y -= 30
    
    # === TÍTULO DE LA RESOLUCIÓN ===
    c.setFont(font_bold, fuente_titulo)
    c.drawCentredString(width/2, y, f"RESOLUCIÓN No: {numero_resolucion}")
    y -= 15
    c.drawCentredString(width/2, y, f"FECHA RESOLUCIÓN: {fecha_resolucion}")
    y -= espaciado_secciones + 5
    
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
        c.drawString(margin_left, y, line)
        y -= espaciado_parrafos
    y -= 10
    
    # === CONSIDERANDO ===
    c.setFont(font_bold, fuente_cuerpo + 1)
    c.drawCentredString(width/2, y, "CONSIDERANDO")
    y -= espaciado_secciones
    
    c.setFont(font_normal, fuente_cuerpo)
    
    # Considerando 1 - reemplazar variables
    cons1 = textos['considerando_1'].replace('{tipo_tramite}', tipo_tramite.lower()).replace('{radicado}', radicado)
    lines = simpleSplit(cons1, font_normal, fuente_cuerpo, content_width)
    for line in lines:
        c.drawString(margin_left, y, line)
        y -= espaciado_parrafos
    y -= 5
    
    # Considerando 2 - documentos
    c.drawString(margin_left, y, textos.get('considerando_2_intro', "Que, se aportaron como soportes los siguientes documentos:"))
    y -= espaciado_parrafos
    for doc in textos.get('considerando_2_docs', []):
        doc_text = doc.replace('{matricula_inmobiliaria}', matricula_inmobiliaria)
        c.drawString(margin_left + 20, y, f"• {doc_text}")
        y -= espaciado_parrafos
    y -= 5
    
    # Considerando 3
    cons3 = textos['considerando_3'].replace('{codigo_catastral}', codigo_catastral_anterior).replace('{npn}', npn)
    lines = simpleSplit(cons3, font_normal, fuente_cuerpo, content_width)
    for line in lines:
        c.drawString(margin_left, y, line)
        y -= espaciado_parrafos
    y -= 5
    
    # Considerando final
    lines = simpleSplit(textos['considerando_final'], font_normal, fuente_cuerpo, content_width)
    for line in lines:
        c.drawString(margin_left, y, line)
        y -= espaciado_parrafos
    y -= 10
    
    # === RESUELVE ===
    c.setFont(font_bold, fuente_cuerpo + 1)
    c.drawCentredString(width/2, y, "RESUELVE")
    y -= espaciado_secciones
    
    c.setFont(font_normal, fuente_cuerpo)
    art1_intro = textos.get('articulo_1_intro', '').replace('{municipio}', municipio)
    c.drawString(margin_left, y, f"Art. 001. {art1_intro}")
    y -= espaciado_secciones
    
    # === TABLA DE CANCELACIÓN ===
    c.setFont(font_bold, fuente_tabla + 1)
    c.setFillColor(colors.Color(0.9, 0.9, 0.9))
    c.rect(margin_left, y - 15, content_width, 15, fill=1)
    c.setFillColor(colors.black)
    c.drawString(margin_left + 5, y - 12, "CANCELACIÓN")
    y -= 20
    
    col_widths = [80, 120, 80, 60, 80, 80]
    headers = ["NPN", "PROPIETARIO", "DOCUMENTO", "DIRECCIÓN", "AVALÚO", "MATRÍCULA"]
    
    c.setFont(font_bold, fuente_tabla)
    x = margin_left
    for i, header in enumerate(headers):
        c.drawString(x + 2, y, header)
        x += col_widths[i]
    y -= espaciado_parrafos
    
    c.setFont(font_normal, fuente_tabla)
    for prop in propietarios_anteriores:
        x = margin_left
        c.drawString(x + 2, y, npn[:20] + "...")
        x += col_widths[0]
        c.drawString(x + 2, y, prop.get('nombre', '')[:20])
        x += col_widths[1]
        c.drawString(x + 2, y, prop.get('documento', ''))
        x += col_widths[2]
        c.drawString(x + 2, y, direccion[:10])
        x += col_widths[3]
        c.drawString(x + 2, y, avaluo)
        x += col_widths[4]
        c.drawString(x + 2, y, matricula_inmobiliaria)
        y -= espaciado_parrafos
    y -= 10
    
    # === TABLA DE INSCRIPCIÓN ===
    c.setFont(font_bold, fuente_tabla + 1)
    c.setFillColor(colors.Color(0.9, 0.95, 0.9))
    c.rect(margin_left, y - 15, content_width, 15, fill=1)
    c.setFillColor(colors.black)
    c.drawString(margin_left + 5, y - 12, "INSCRIPCIÓN")
    y -= 20
    
    c.setFont(font_bold, fuente_tabla)
    x = margin_left
    for i, header in enumerate(headers):
        c.drawString(x + 2, y, header)
        x += col_widths[i]
    y -= espaciado_parrafos
    
    c.setFont(font_normal, fuente_tabla)
    for prop in propietarios_nuevos:
        x = margin_left
        c.drawString(x + 2, y, npn[:20] + "...")
        x += col_widths[0]
        c.drawString(x + 2, y, prop.get('nombre', '')[:20])
        x += col_widths[1]
        c.drawString(x + 2, y, prop.get('documento', ''))
        x += col_widths[2]
        c.drawString(x + 2, y, direccion[:10])
        x += col_widths[3]
        c.drawString(x + 2, y, avaluo)
        x += col_widths[4]
        c.drawString(x + 2, y, matricula_inmobiliaria)
        y -= espaciado_parrafos
    y -= espaciado_secciones
    
    # === ARTÍCULOS ADICIONALES ===
    c.setFont(font_bold, fuente_cuerpo)
    c.drawString(margin_left, y, "ARTÍCULO 2.")
    c.setFont(font_normal, fuente_cuerpo)
    c.drawString(margin_left + 60, y, f" {textos['articulo_2']}")
    y -= espaciado_parrafos + 3
    
    c.setFont(font_bold, fuente_cuerpo)
    c.drawString(margin_left, y, "ARTÍCULO 3.")
    c.setFont(font_normal, fuente_cuerpo)
    art3 = textos['articulo_3'].replace('{vigencia_fiscal}', vigencia_fiscal)
    c.drawString(margin_left + 60, y, f" {art3}")
    y -= espaciado_parrafos + 3
    
    c.setFont(font_bold, fuente_cuerpo)
    c.drawString(margin_left, y, "ARTÍCULO 4.")
    c.setFont(font_normal, fuente_cuerpo)
    c.drawString(margin_left + 60, y, f" {textos['articulo_4']}")
    y -= espaciado_secciones + 10
    
    # === CIERRE ===
    c.setFont(font_bold, fuente_cuerpo + 1)
    c.drawCentredString(width/2, y, textos['cierre'])
    y -= espaciado_secciones
    
    c.setFont(font_normal, fuente_cuerpo)
    try:
        fecha_dt = datetime.strptime(fecha_resolucion, "%d-%m-%Y")
        meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 
                 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
        fecha_texto = f"{fecha_dt.day} DÍAS DE {meses[fecha_dt.month-1]} DE {fecha_dt.year}"
    except:
        fecha_texto = fecha_resolucion
    c.drawCentredString(width/2, y, f"DADA EN OCAÑA A LOS {fecha_texto}")
    y -= config['firma_offset_y']
    
    # === FIRMA ===
    if config['firma_mostrar'] and firma_img:
        firma_width = config['firma_ancho']
        firma_height = config['firma_altura']
        
        # Calcular posición X según configuración
        if config['firma_posicion'] == 'izquierda':
            firma_x = margin_left
        elif config['firma_posicion'] == 'derecha':
            firma_x = width - margin_right - firma_width
        else:  # centro
            firma_x = width/2 - firma_width/2
        
        c.drawImage(firma_img, firma_x, y - firma_height, width=firma_width, height=firma_height, mask='auto')
        y -= firma_height + 10
    
    # Nombre y cargo del firmante
    c.setFont(font_bold, fuente_cuerpo)
    if config['firma_posicion'] == 'izquierda':
        c.drawString(margin_left, y, textos['firmante_nombre'])
        y -= espaciado_parrafos
        c.setFont(font_normal, fuente_cuerpo - 1)
        c.drawString(margin_left, y, textos['firmante_cargo'])
    elif config['firma_posicion'] == 'derecha':
        c.drawRightString(width - margin_right, y, textos['firmante_nombre'])
        y -= espaciado_parrafos
        c.setFont(font_normal, fuente_cuerpo - 1)
        c.drawRightString(width - margin_right, y, textos['firmante_cargo'])
    else:  # centro
        c.drawCentredString(width/2, y, textos['firmante_nombre'])
        y -= espaciado_parrafos
        c.setFont(font_normal, fuente_cuerpo - 1)
        c.drawCentredString(width/2, y, textos['firmante_cargo'])
    y -= espaciado_secciones + 10
    
    # === ELABORÓ / REVISÓ ===
    c.setFont(font_normal, fuente_tabla)
    c.drawString(margin_left, y, f"Elaboró: {elaboro}")
    y -= 10
    c.drawString(margin_left, y, f"Revisó: {reviso}")
    
    # === PIE DE PÁGINA ===
    if config['pie_mostrar'] and pie_pagina_img:
        img_width = 500
        img_height = config['pie_altura']
        c.drawImage(pie_pagina_img, margin_left, margin_bottom - 40, width=img_width, height=img_height, mask='auto')
    
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
    
    with open("/app/backend/test_resolucion_configurable.pdf", "wb") as f:
        f.write(pdf_bytes)
    
    print(f"PDF generado: {len(pdf_bytes)} bytes")
