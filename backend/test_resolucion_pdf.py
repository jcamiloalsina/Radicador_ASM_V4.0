"""
Script de prueba para generar un PDF de Resolución Catastral
Basado en el formato: RES-{depto}-{mpio}-{consecutivo}-{año}
"""
import io
import os
import sys
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import cm, mm
from reportlab.pdfgen import canvas
from reportlab.lib.utils import simpleSplit, ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Importar imágenes embebidas
from certificado_images import get_encabezado_image, get_pie_pagina_image, get_firma_dalgie_image

def generate_resolucion_pdf(
    numero_resolucion: str,
    fecha_resolucion: str,
    municipio: str,
    tipo_tramite: str,
    radicado: str,
    # Datos del predio
    codigo_catastral_anterior: str,
    npn: str,
    matricula_inmobiliaria: str,
    direccion: str,
    avaluo: str,
    vigencia_fiscal: str,
    # Propietarios anteriores
    propietarios_anteriores: list,
    # Propietarios nuevos
    propietarios_nuevos: list,
    # Funcionarios
    elaboro: str,
    reviso: str,
) -> bytes:
    """
    Genera un PDF de resolución catastral.
    """
    
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
    
    # Cargar imágenes
    try:
        encabezado_img = ImageReader(get_encabezado_image())
        pie_pagina_img = ImageReader(get_pie_pagina_image())
        firma_img = ImageReader(get_firma_dalgie_image())
    except Exception as e:
        print(f"Error cargando imágenes: {e}")
        encabezado_img = None
        pie_pagina_img = None
        firma_img = None
    
    # Márgenes
    margin_left = 50
    margin_right = 50
    margin_top = 50
    margin_bottom = 80
    content_width = width - margin_left - margin_right
    
    y = height - margin_top
    
    # === ENCABEZADO ===
    if encabezado_img:
        img_width = 500
        img_height = 60
        c.drawImage(encabezado_img, margin_left, y - img_height, width=img_width, height=img_height, mask='auto')
        y -= img_height + 20
    else:
        # Encabezado de texto
        c.setFont(font_bold, 14)
        c.drawCentredString(width/2, y, "ASOCIACIÓN DE MUNICIPIOS DEL CATATUMBO")
        y -= 15
        c.setFont(font_normal, 10)
        c.drawCentredString(width/2, y, "Provincia de Ocaña y Sur del Cesar - Gestor Catastral")
        y -= 30
    
    # === TÍTULO DE LA RESOLUCIÓN ===
    c.setFont(font_bold, 11)
    c.drawCentredString(width/2, y, f"RESOLUCIÓN No: {numero_resolucion}")
    y -= 15
    c.drawCentredString(width/2, y, f"FECHA RESOLUCIÓN: {fecha_resolucion}")
    y -= 25
    
    # Asunto
    c.setFont(font_bold, 9)
    asunto = f"POR LA CUAL SE ORDENAN UNOS CAMBIOS EN EL CATASTRO DEL MUNICIPIO DE {municipio.upper()}"
    asunto2 = f"Y SE RESUELVE UNA SOLICITUD DE {tipo_tramite.upper()}."
    c.drawCentredString(width/2, y, asunto)
    y -= 12
    c.drawCentredString(width/2, y, asunto2)
    y -= 25
    
    # === PREÁMBULO ===
    c.setFont(font_normal, 9)
    preambulo = (
        "La Asociación de Municipios del Catatumbo, Provincia de Ocaña y Sur del Cesar "
        "(ASOMUNICIPIOS), actuando en calidad de Gestor Catastral, en concordancia con la "
        "ley 14 de 1983 y el decreto 148 del 2020, y la resolución IGAC 1204 del 2021, en uso "
        "de sus facultades legales y,"
    )
    
    # Dividir texto largo en líneas
    lines = simpleSplit(preambulo, font_normal, 9, content_width)
    for line in lines:
        c.drawString(margin_left, y, line)
        y -= 12
    
    y -= 10
    
    # === CONSIDERANDO ===
    c.setFont(font_bold, 10)
    c.drawCentredString(width/2, y, "CONSIDERANDO")
    y -= 20
    
    c.setFont(font_normal, 9)
    
    # Considerando 1
    cons1 = f"Que, ante la oficina de gestión catastral de Asomunicipios, solicitan un trámite catastral de {tipo_tramite.lower()}, radicado bajo el consecutivo {radicado}."
    lines = simpleSplit(cons1, font_normal, 9, content_width)
    for line in lines:
        c.drawString(margin_left, y, line)
        y -= 12
    y -= 5
    
    # Considerando 2
    c.drawString(margin_left, y, "Que, se aportaron como soportes los siguientes documentos:")
    y -= 12
    c.drawString(margin_left + 20, y, "• Oficio de solicitud.")
    y -= 12
    c.drawString(margin_left + 20, y, "• Cédula de ciudadanía.")
    y -= 12
    c.drawString(margin_left + 20, y, f"• Certificado de Tradición y Libertad con número de matrícula inmobiliaria {matricula_inmobiliaria}.")
    y -= 15
    
    # Considerando 3
    cons3 = f"Que, según estudio de oficina se hace necesario efectuar una mutación de primera, para el predio con código catastral anterior número {codigo_catastral_anterior} y NPN {npn}."
    lines = simpleSplit(cons3, font_normal, 9, content_width)
    for line in lines:
        c.drawString(margin_left, y, line)
        y -= 12
    y -= 5
    
    # Considerando final
    cons_final = "En consecuencia y dado que se aportaron y verificaron los soportes pertinentes, amparados en la resolución IGAC 1040 del 2023: 'por la cual se actualiza la reglamentación técnica de la formación, actualización, conservación y difusión catastral con enfoque multipropósito', se:"
    lines = simpleSplit(cons_final, font_normal, 9, content_width)
    for line in lines:
        c.drawString(margin_left, y, line)
        y -= 12
    
    y -= 15
    
    # === RESUELVE ===
    c.setFont(font_bold, 10)
    c.drawCentredString(width/2, y, "RESUELVE")
    y -= 20
    
    c.setFont(font_normal, 9)
    c.drawString(margin_left, y, f"Art. 001. Ordenar la inscripción en el catastro del Municipio de {municipio} los siguientes cambios:")
    y -= 20
    
    # === TABLA DE CANCELACIÓN ===
    c.setFont(font_bold, 8)
    c.setFillColor(colors.Color(0.9, 0.9, 0.9))
    c.rect(margin_left, y - 15, content_width, 15, fill=1)
    c.setFillColor(colors.black)
    c.drawString(margin_left + 5, y - 12, "CANCELACIÓN")
    y -= 20
    
    # Encabezados de tabla
    col_widths = [80, 120, 80, 60, 80, 80]
    headers = ["NPN", "PROPIETARIO", "DOCUMENTO", "DIRECCIÓN", "AVALÚO", "MATRÍCULA"]
    
    c.setFont(font_bold, 7)
    x = margin_left
    for i, header in enumerate(headers):
        c.drawString(x + 2, y, header)
        x += col_widths[i]
    y -= 12
    
    # Datos de cancelación (propietarios anteriores)
    c.setFont(font_normal, 7)
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
        y -= 12
    
    y -= 15
    
    # === TABLA DE INSCRIPCIÓN ===
    c.setFont(font_bold, 8)
    c.setFillColor(colors.Color(0.9, 0.95, 0.9))
    c.rect(margin_left, y - 15, content_width, 15, fill=1)
    c.setFillColor(colors.black)
    c.drawString(margin_left + 5, y - 12, "INSCRIPCIÓN")
    y -= 20
    
    # Encabezados
    c.setFont(font_bold, 7)
    x = margin_left
    for i, header in enumerate(headers):
        c.drawString(x + 2, y, header)
        x += col_widths[i]
    y -= 12
    
    # Datos de inscripción (propietarios nuevos)
    c.setFont(font_normal, 7)
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
        y -= 12
    
    y -= 20
    
    # === ARTÍCULOS ADICIONALES ===
    c.setFont(font_bold, 9)
    c.drawString(margin_left, y, "ARTÍCULO 2.")
    c.setFont(font_normal, 9)
    art2 = " El presente acto administrativo rige a partir de la fecha de su expedición."
    c.drawString(margin_left + 60, y, art2)
    y -= 15
    
    c.setFont(font_bold, 9)
    c.drawString(margin_left, y, "ARTÍCULO 3.")
    c.setFont(font_normal, 9)
    art3 = f" Los avalúos incorporados tienen vigencia fiscal a partir del {vigencia_fiscal}."
    c.drawString(margin_left + 60, y, art3)
    y -= 15
    
    c.setFont(font_bold, 9)
    c.drawString(margin_left, y, "ARTÍCULO 4.")
    c.setFont(font_normal, 9)
    art4 = " Contra el presente acto administrativo no procede recurso alguno."
    c.drawString(margin_left + 60, y, art4)
    y -= 30
    
    # === CIERRE ===
    c.setFont(font_bold, 10)
    c.drawCentredString(width/2, y, "COMUNÍQUESE, NOTIFÍQUESE Y CÚMPLASE")
    y -= 20
    
    c.setFont(font_normal, 9)
    fecha_texto = datetime.strptime(fecha_resolucion, "%d-%m-%Y").strftime("%d DÍAS DE %B DE %Y").upper()
    c.drawCentredString(width/2, y, f"DADA EN OCAÑA A LOS {fecha_texto}")
    y -= 40
    
    # === FIRMA ===
    if firma_img:
        firma_width = 100
        firma_height = 60
        c.drawImage(firma_img, width/2 - firma_width/2, y - firma_height, width=firma_width, height=firma_height, mask='auto')
        y -= firma_height + 10
    
    c.setFont(font_bold, 9)
    c.drawCentredString(width/2, y, "DALGIE ESPERANZA TORRADO RIZO")
    y -= 12
    c.setFont(font_normal, 8)
    c.drawCentredString(width/2, y, "SUBDIRECTORA FINANCIERA Y ADMINISTRATIVA")
    y -= 30
    
    # === ELABORÓ / REVISÓ ===
    c.setFont(font_normal, 7)
    c.drawString(margin_left, y, f"Elaboró: {elaboro}")
    y -= 10
    c.drawString(margin_left, y, f"Revisó: {reviso}")
    
    # === PIE DE PÁGINA ===
    if pie_pagina_img:
        img_width = 500
        img_height = 50
        c.drawImage(pie_pagina_img, margin_left, margin_bottom - 40, width=img_width, height=img_height, mask='auto')
    
    c.save()
    buffer.seek(0)
    return buffer.getvalue()


if __name__ == "__main__":
    # Datos de prueba basados en el ejemplo del usuario
    pdf_bytes = generate_resolucion_pdf(
        numero_resolucion="RES-54-003-0001-2026",
        fecha_resolucion="19-01-2026",
        municipio="Ábrego",
        tipo_tramite="Cambio de Propietario",
        radicado="RASMGC-5505-30-12-2025",
        codigo_catastral_anterior="000400020197000",
        npn="540030004000000020197000000000",
        matricula_inmobiliaria="270-52528",
        direccion="LO 1 EL DIAMANTE CAMPANARIO",
        avaluo="$42.023.000",
        vigencia_fiscal="01/01/2026",
        propietarios_anteriores=[
            {"nombre": "JACOME CARDENAS ORFAEL ANTONIO", "documento": "C 13357584"},
            {"nombre": "NAVARRO TORRADO HELI", "documento": "C 88287696"},
        ],
        propietarios_nuevos=[
            {"nombre": "NAVARRO TORRADO HELI", "documento": "C 88287696"},
            {"nombre": "TRIGOS BAYONA MARIA DE JESUS", "documento": "C 37312465"},
        ],
        elaboro="Armando Cárdenas",
        reviso="Juan C. Alsina",
    )
    
    # Guardar el PDF
    output_path = "/app/backend/test_resolucion_output.pdf"
    with open(output_path, "wb") as f:
        f.write(pdf_bytes)
    
    print(f"✅ PDF de prueba generado en: {output_path}")
    print(f"   Tamaño: {len(pdf_bytes)} bytes")
