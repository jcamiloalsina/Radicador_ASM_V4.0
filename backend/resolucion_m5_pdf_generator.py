"""
Generador de PDF para Resoluciones M5 - Cancelación e Inscripción de Predios
Estructura IDÉNTICA a M2/M4 para mantener consistencia visual
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

# Constantes de diseño - IDÉNTICAS a M2/M4
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


def get_m5_plantilla_cancelacion():
    """Plantilla para Cancelación de Predio"""
    return {
        "tipo": "M5",
        "subtipo": "cancelacion",
        "titulo": "POR LA CUAL SE ORDENAN UNOS CAMBIOS EN EL CATASTRO DEL MUNICIPIO DE {municipio} Y SE RESUELVE UNA SOLICITUD DE CANCELACIÓN DE PREDIO",
        "considerando_intro": (
            "La Asociación de Municipios del Catatumbo, Provincia de Ocaña y Sur del Cesar "
            "\"ASOMUNICIPIOS\" en calidad de Gestor Catastral, en uso de sus facultades legales "
            "otorgadas por la resolución IGAC 1204 del 2021 en concordancia con la ley 14 de 1983, "
            "el literal c del artículo 2.2.2.2.2 del decreto 148 del 2020 y la resolución IGAC 1040 del 2023: "
            "\"por la cual se actualiza la reglamentación técnica de la formación, actualización, "
            "conservación y difusión catastral con enfoque multipropósito\", y"
        ),
        "considerando_solicitud": (
            "Qué, el/la señor(a) {solicitante_nombre}, identificado(a) con cédula de ciudadanía No. {solicitante_documento}, "
            "radicó una solicitud de trámite catastral atendido bajo el consecutivo de Asomunicipios con el No. {radicado}, "
            "donde solicita la CANCELACIÓN del predio identificado con código predial nacional {codigo_predial}, "
            "lo anterior en su calidad de propietario(a) del predio."
        ),
        "considerando_motivo": (
            "Qué, la solicitud se centra en: \"{motivo_solicitud}\" argumenta el peticionario."
        ),
        "considerando_analisis": (
            "Qué, teniendo en cuenta los soportes presentados y el estudio jurídico, físico y económico realizado, "
            "así como la visita de campo efectuada, se encontró que la cancelación del predio amerita para dar "
            "cumplimiento al artículo 4.5.1 numeral 5, artículo 4.5.7 y 4.6.10 de la resolución IGAC 1040 de 2023."
        ),
        "considerando_doble_inscripcion": (
            "Qué, realizada la verificación jurídica, física y económica se constató que el predio CPN N°{codigo_predial} "
            "corresponde al mismo inmueble inscrito con el CPN N°{codigo_predio_duplicado}, razón por la cual procede "
            "la cancelación por doble inscripción."
        ),
        "considerando_legal": (
            "Qué estas radicaciones implican una cancelación de los datos catastrales y su correspondiente registro "
            "en el catastro, conforme lo indican los artículos 4.5.1, 4.5.7, 4.6.10, 4.7.13, 4.8.2, 4.8.4 y 4.7.14 "
            "de la resolución IGAC 1040 de 2023, el artículo 2.2.2.2.2 literal c del decreto 148 de 2020 y lo preceptuado "
            "en la resolución vigente sobre los requisitos para trámites y otros procedimientos administrativos."
        ),
        "articulo_1_intro": "Ordenar la CANCELACIÓN en el catastro del Municipio de {municipio}, del siguiente predio:",
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
            "Los recursos se concederán en el efecto suspensivo y por consiguiente la anotación de la cancelación "
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


def get_m5_plantilla_inscripcion():
    """Plantilla para Inscripción de Predio Nuevo"""
    return {
        "tipo": "M5",
        "subtipo": "inscripcion",
        "titulo": "POR LA CUAL SE ORDENAN UNOS CAMBIOS EN EL CATASTRO DEL MUNICIPIO DE {municipio} Y SE RESUELVE UNA SOLICITUD DE INSCRIPCIÓN DE PREDIO NUEVO",
        "considerando_intro": (
            "La Asociación de Municipios del Catatumbo, Provincia de Ocaña y Sur del Cesar "
            "\"ASOMUNICIPIOS\" en calidad de Gestor Catastral, en uso de sus facultades legales "
            "otorgadas por la resolución IGAC 1204 del 2021 en concordancia con la ley 14 de 1983, "
            "el literal c del artículo 2.2.2.2.2 del decreto 148 del 2020 y la resolución IGAC 1040 del 2023: "
            "\"por la cual se actualiza la reglamentación técnica de la formación, actualización, "
            "conservación y difusión catastral con enfoque multipropósito\", y"
        ),
        "considerando_solicitud": (
            "Qué, el/la señor(a) {solicitante_nombre}, identificado(a) con cédula de ciudadanía No. {solicitante_documento}, "
            "radicó una solicitud de trámite catastral atendido bajo el consecutivo de Asomunicipios con el No. {radicado}, "
            "donde solicita la INSCRIPCIÓN de un predio nuevo en el catastro municipal, identificado con la matrícula "
            "inmobiliaria No. {matricula_inmobiliaria}, lo anterior en su calidad de propietario(a) del predio."
        ),
        "considerando_motivo": (
            "Qué, la solicitud se centra en: \"{motivo_solicitud}\" argumenta el peticionario."
        ),
        "considerando_analisis": (
            "Qué, teniendo en cuenta los soportes presentados, el estudio jurídico y técnico realizado, "
            "así como la visita de campo efectuada, se encontró que la inscripción del predio nuevo amerita para dar "
            "cumplimiento al numeral 5 del artículo 4.5.1 y el artículo 4.8.2 de la resolución IGAC 1040 de 2023."
        ),
        "considerando_legal": (
            "Qué estas radicaciones implican una inscripción de los datos catastrales y su correspondiente registro "
            "en el catastro, conforme lo indican los artículos 4.5.1, 4.7.13, 4.8.2, 4.8.4 y 4.7.14 "
            "de la resolución IGAC 1040 de 2023, el artículo 2.2.2.2.2 literal c del decreto 148 de 2020 y lo preceptuado "
            "en la resolución vigente sobre los requisitos para trámites y otros procedimientos administrativos."
        ),
        "articulo_1_intro": "Ordenar la INSCRIPCIÓN en el catastro del Municipio de {municipio}, del siguiente predio nuevo:",
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
            "Los recursos se concederán en el efecto suspensivo y por consiguiente la anotación de la inscripción "
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


def draw_header(c, y_position, numero_resolucion, fecha_resolucion):
    """Dibuja el encabezado institucional"""
    # Logo/Encabezado
    try:
        encabezado_base64 = get_encabezado_image()
        if encabezado_base64:
            encabezado_data = base64.b64decode(encabezado_base64)
            encabezado_image = ImageReader(io.BytesIO(encabezado_data))
            c.drawImage(encabezado_image, MARGIN_LEFT, y_position - 80, 
                       width=CONTENT_WIDTH, height=80, preserveAspectRatio=True)
            y_position -= 100
    except Exception as e:
        print(f"Error cargando encabezado: {e}")
        y_position -= 20
    
    # Número de resolución
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(NEGRO)
    c.drawCentredString(PAGE_WIDTH/2, y_position, f"RESOLUCIÓN No. {numero_resolucion}")
    y_position -= 15
    
    # Fecha
    c.setFont("Helvetica", 10)
    c.drawCentredString(PAGE_WIDTH/2, y_position, f"({fecha_resolucion})")
    y_position -= 25
    
    return y_position


def draw_justified_text(c, text, x, y, width, font_name="Helvetica", font_size=10, leading=12):
    """Dibuja texto justificado"""
    c.setFont(font_name, font_size)
    words = text.split()
    lines = []
    current_line = []
    
    for word in words:
        test_line = ' '.join(current_line + [word])
        if c.stringWidth(test_line, font_name, font_size) <= width:
            current_line.append(word)
        else:
            if current_line:
                lines.append(current_line)
            current_line = [word]
    if current_line:
        lines.append(current_line)
    
    for i, line_words in enumerate(lines):
        if i < len(lines) - 1 and len(line_words) > 1:
            total_word_width = sum(c.stringWidth(w, font_name, font_size) for w in line_words)
            total_space = width - total_word_width
            space_between = total_space / (len(line_words) - 1)
            
            current_x = x
            for j, word in enumerate(line_words):
                c.drawString(current_x, y, word)
                current_x += c.stringWidth(word, font_name, font_size) + space_between
        else:
            c.drawString(x, y, ' '.join(line_words))
        
        y -= leading
    
    return y


def draw_watermark(c):
    """Dibuja marca de agua"""
    c.saveState()
    c.setFillColor(colors.Color(0, 0.6, 0.27, alpha=0.08))
    c.setFont("Helvetica-Bold", 60)
    c.translate(PAGE_WIDTH/2, PAGE_HEIGHT/2)
    c.rotate(45)
    c.drawCentredString(0, 0, "ASOMUNICIPIOS")
    c.restoreState()


def draw_footer(c):
    """Dibuja el pie de página"""
    try:
        pie_base64 = get_pie_pagina_image()
        if pie_base64:
            pie_data = base64.b64decode(pie_base64)
            pie_image = ImageReader(io.BytesIO(pie_data))
            c.drawImage(pie_image, MARGIN_LEFT, 15, 
                       width=CONTENT_WIDTH, height=50, preserveAspectRatio=True)
    except Exception as e:
        print(f"Error cargando pie de página: {e}")
        c.setFont("Helvetica", 8)
        c.setFillColor(VERDE_INSTITUCIONAL)
        c.drawCentredString(PAGE_WIDTH/2, 30, "ASOMUNICIPIOS - Gestor Catastral")


def draw_predio_table_cancelacion(c, y_position, predio_data, vigencia_cancelacion):
    """Dibuja tabla de predio a cancelar"""
    # Encabezado de tabla
    c.setFillColor(VERDE_INSTITUCIONAL)
    c.rect(MARGIN_LEFT, y_position - 18, CONTENT_WIDTH, 18, fill=True, stroke=False)
    c.setFillColor(BLANCO)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(MARGIN_LEFT + 5, y_position - 13, "PREDIO A CANCELAR")
    
    y_position -= 20
    
    # Datos del predio
    c.setStrokeColor(VERDE_INSTITUCIONAL)
    c.setLineWidth(0.5)
    
    # Primera fila - Código y NPN
    row_height = 35
    c.rect(MARGIN_LEFT, y_position - row_height, CONTENT_WIDTH, row_height, stroke=True, fill=False)
    c.setFillColor(NEGRO)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(MARGIN_LEFT + 5, y_position - 12, "Código Predial Nacional:")
    c.setFont("Helvetica", 8)
    c.drawString(MARGIN_LEFT + 5, y_position - 24, predio_data.get('codigo_predial_nacional', predio_data.get('codigo_predial', '')))
    
    # NPN
    c.setFont("Helvetica-Bold", 8)
    c.drawString(MARGIN_LEFT + 270, y_position - 12, "NPN:")
    c.setFont("Helvetica", 8)
    c.drawString(MARGIN_LEFT + 290, y_position - 24, predio_data.get('npn', predio_data.get('NPN', '')))
    
    y_position -= row_height
    
    # Segunda fila - Propietario y Documento
    c.rect(MARGIN_LEFT, y_position - row_height, CONTENT_WIDTH, row_height, stroke=True, fill=False)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(MARGIN_LEFT + 5, y_position - 12, "Propietario:")
    c.setFont("Helvetica", 8)
    propietario = ""
    if predio_data.get('propietarios') and len(predio_data['propietarios']) > 0:
        propietario = predio_data['propietarios'][0].get('nombre_propietario', predio_data['propietarios'][0].get('nombre', ''))
    c.drawString(MARGIN_LEFT + 5, y_position - 24, propietario)
    
    c.setFont("Helvetica-Bold", 8)
    c.drawString(MARGIN_LEFT + 270, y_position - 12, "Documento:")
    c.setFont("Helvetica", 8)
    documento = ""
    if predio_data.get('propietarios') and len(predio_data['propietarios']) > 0:
        tipo_doc = predio_data['propietarios'][0].get('tipo_documento', 'CC')
        num_doc = predio_data['propietarios'][0].get('numero_documento', '')
        documento = f"{tipo_doc} {num_doc}"
    c.drawString(MARGIN_LEFT + 270, y_position - 24, documento)
    
    y_position -= row_height
    
    # Tercera fila - Dirección y Avalúo
    c.rect(MARGIN_LEFT, y_position - row_height, CONTENT_WIDTH, row_height, stroke=True, fill=False)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(MARGIN_LEFT + 5, y_position - 12, "Dirección:")
    c.setFont("Helvetica", 8)
    c.drawString(MARGIN_LEFT + 5, y_position - 24, predio_data.get('direccion', ''))
    
    c.setFont("Helvetica-Bold", 8)
    c.drawString(MARGIN_LEFT + 270, y_position - 12, "Avalúo:")
    c.setFont("Helvetica", 8)
    avaluo = predio_data.get('avaluo', predio_data.get('avaluo_catastral', 0))
    c.drawString(MARGIN_LEFT + 270, y_position - 24, f"$ {int(avaluo):,}".replace(',', '.'))
    
    y_position -= row_height
    
    # Cuarta fila - Vigencia de cancelación
    c.rect(MARGIN_LEFT, y_position - 25, CONTENT_WIDTH, 25, stroke=True, fill=False)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(MARGIN_LEFT + 5, y_position - 15, "Cancelación desde vigencia:")
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(colors.HexColor('#C00000'))
    c.drawString(MARGIN_LEFT + 150, y_position - 15, f"01/01/{vigencia_cancelacion}")
    
    return y_position - 35


def draw_predio_table_inscripcion(c, y_position, predio_data, vigencia_inscripcion):
    """Dibuja tabla de predio a inscribir"""
    # Encabezado de tabla
    c.setFillColor(VERDE_INSTITUCIONAL)
    c.rect(MARGIN_LEFT, y_position - 18, CONTENT_WIDTH, 18, fill=True, stroke=False)
    c.setFillColor(BLANCO)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(MARGIN_LEFT + 5, y_position - 13, "PREDIO A INSCRIBIR")
    
    y_position -= 20
    
    # Datos del predio
    c.setStrokeColor(VERDE_INSTITUCIONAL)
    c.setLineWidth(0.5)
    
    # Primera fila - Código y Matrícula
    row_height = 35
    c.rect(MARGIN_LEFT, y_position - row_height, CONTENT_WIDTH, row_height, stroke=True, fill=False)
    c.setFillColor(NEGRO)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(MARGIN_LEFT + 5, y_position - 12, "Código Predial Nacional (Asignado):")
    c.setFont("Helvetica", 8)
    c.drawString(MARGIN_LEFT + 5, y_position - 24, predio_data.get('codigo_predial_nacional', predio_data.get('codigo_predial', 'Por asignar')))
    
    c.setFont("Helvetica-Bold", 8)
    c.drawString(MARGIN_LEFT + 270, y_position - 12, "Matrícula Inmobiliaria:")
    c.setFont("Helvetica", 8)
    c.drawString(MARGIN_LEFT + 270, y_position - 24, predio_data.get('matricula_inmobiliaria', ''))
    
    y_position -= row_height
    
    # Segunda fila - Propietario y Documento
    c.rect(MARGIN_LEFT, y_position - row_height, CONTENT_WIDTH, row_height, stroke=True, fill=False)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(MARGIN_LEFT + 5, y_position - 12, "Propietario:")
    c.setFont("Helvetica", 8)
    propietario = ""
    if predio_data.get('propietarios') and len(predio_data['propietarios']) > 0:
        propietario = predio_data['propietarios'][0].get('nombre_propietario', predio_data['propietarios'][0].get('nombre', ''))
    c.drawString(MARGIN_LEFT + 5, y_position - 24, propietario)
    
    c.setFont("Helvetica-Bold", 8)
    c.drawString(MARGIN_LEFT + 270, y_position - 12, "Documento:")
    c.setFont("Helvetica", 8)
    documento = ""
    if predio_data.get('propietarios') and len(predio_data['propietarios']) > 0:
        tipo_doc = predio_data['propietarios'][0].get('tipo_documento', 'CC')
        num_doc = predio_data['propietarios'][0].get('numero_documento', '')
        documento = f"{tipo_doc} {num_doc}"
    c.drawString(MARGIN_LEFT + 270, y_position - 24, documento)
    
    y_position -= row_height
    
    # Tercera fila - Dirección y Destino
    c.rect(MARGIN_LEFT, y_position - row_height, CONTENT_WIDTH, row_height, stroke=True, fill=False)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(MARGIN_LEFT + 5, y_position - 12, "Dirección:")
    c.setFont("Helvetica", 8)
    c.drawString(MARGIN_LEFT + 5, y_position - 24, predio_data.get('direccion', ''))
    
    c.setFont("Helvetica-Bold", 8)
    c.drawString(MARGIN_LEFT + 270, y_position - 12, "Destino Económico:")
    c.setFont("Helvetica", 8)
    c.drawString(MARGIN_LEFT + 270, y_position - 24, predio_data.get('destino_economico', ''))
    
    y_position -= row_height
    
    # Cuarta fila - Áreas y Avalúo
    c.rect(MARGIN_LEFT, y_position - row_height, CONTENT_WIDTH, row_height, stroke=True, fill=False)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(MARGIN_LEFT + 5, y_position - 12, "Área Terreno:")
    c.setFont("Helvetica", 8)
    area_terreno = predio_data.get('area_terreno', 0)
    c.drawString(MARGIN_LEFT + 5, y_position - 24, f"{float(area_terreno):,.2f} m²".replace(',', '.'))
    
    c.setFont("Helvetica-Bold", 8)
    c.drawString(MARGIN_LEFT + 150, y_position - 12, "Área Construida:")
    c.setFont("Helvetica", 8)
    area_construida = predio_data.get('area_construida', 0)
    c.drawString(MARGIN_LEFT + 150, y_position - 24, f"{float(area_construida):,.2f} m²".replace(',', '.'))
    
    c.setFont("Helvetica-Bold", 8)
    c.drawString(MARGIN_LEFT + 300, y_position - 12, "Avalúo:")
    c.setFont("Helvetica", 8)
    avaluo = predio_data.get('avaluo', predio_data.get('avaluo_catastral', 0))
    c.drawString(MARGIN_LEFT + 300, y_position - 24, f"$ {int(avaluo):,}".replace(',', '.'))
    
    y_position -= row_height
    
    # Quinta fila - Vigencia de inscripción
    c.rect(MARGIN_LEFT, y_position - 25, CONTENT_WIDTH, 25, stroke=True, fill=False)
    c.setFillColor(NEGRO)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(MARGIN_LEFT + 5, y_position - 15, "Inscripción desde vigencia:")
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(VERDE_INSTITUCIONAL)
    c.drawString(MARGIN_LEFT + 150, y_position - 15, f"01/01/{vigencia_inscripcion}")
    
    return y_position - 35


def generate_qr_code(data_to_encode):
    """Genera código QR"""
    qr = qrcode.QRCode(version=1, box_size=10, border=1)
    qr.add_data(data_to_encode)
    qr.make(fit=True)
    qr_image = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    qr_image.save(buffer, format='PNG')
    buffer.seek(0)
    return buffer


def generate_m5_resolution_pdf(data: dict) -> bytes:
    """
    Genera el PDF de resolución M5 (Cancelación o Inscripción)
    
    Args:
        data: dict con:
            - subtipo: 'cancelacion' | 'inscripcion'
            - numero_resolucion: str
            - fecha_resolucion: str
            - municipio: str
            - radicado: str
            - solicitante: dict con nombre y documento
            - predio: dict con datos del predio
            - vigencia: int (año desde el cual aplica)
            - motivo_solicitud: str
            - es_doble_inscripcion: bool (solo para cancelación)
            - codigo_predio_duplicado: str (solo si es_doble_inscripcion)
    """
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    
    subtipo = data.get('subtipo', 'cancelacion')
    numero_resolucion = data.get('numero_resolucion', 'RES-54-XXX-XXXX-2026')
    fecha_resolucion = data.get('fecha_resolucion', datetime.now(ZoneInfo("America/Bogota")).strftime("%d/%m/%Y"))
    municipio = data.get('municipio', 'MUNICIPIO')
    radicado = data.get('radicado', '')
    solicitante = data.get('solicitante', {})
    predio = data.get('predio', {})
    vigencia = data.get('vigencia', datetime.now(ZoneInfo("America/Bogota")).year)
    motivo_solicitud = data.get('motivo_solicitud', 'Solicitud de trámite catastral')
    es_doble_inscripcion = data.get('es_doble_inscripcion', False)
    codigo_predio_duplicado = data.get('codigo_predio_duplicado', '')
    
    # Obtener plantilla según subtipo
    if subtipo == 'inscripcion':
        plantilla = get_m5_plantilla_inscripcion()
    else:
        plantilla = get_m5_plantilla_cancelacion()
    
    # Variables para reemplazar
    solicitante_nombre = solicitante.get('nombre', solicitante.get('nombre_completo', 'N/A'))
    solicitante_documento = solicitante.get('documento', solicitante.get('numero_documento', 'N/A'))
    codigo_predial = predio.get('codigo_predial_nacional', predio.get('codigo_predial', predio.get('NPN', '')))
    matricula = predio.get('matricula_inmobiliaria', '')
    
    # ========== PÁGINA 1 ==========
    draw_watermark(c)
    y_position = PAGE_HEIGHT - MARGIN_TOP
    
    # Encabezado
    y_position = draw_header(c, y_position, numero_resolucion, fecha_resolucion)
    
    # Título
    titulo = plantilla['titulo'].format(municipio=municipio.upper())
    c.setFont("Helvetica-Bold", 10)
    lines = simpleSplit(titulo, "Helvetica-Bold", 10, CONTENT_WIDTH)
    for line in lines:
        c.drawCentredString(PAGE_WIDTH/2, y_position, line)
        y_position -= 12
    y_position -= 10
    
    # CONSIDERANDO
    c.setFont("Helvetica-Bold", 10)
    c.drawString(MARGIN_LEFT, y_position, "CONSIDERANDO:")
    y_position -= 20
    
    # Introducción
    y_position = draw_justified_text(c, plantilla['considerando_intro'], 
                                     MARGIN_LEFT, y_position, CONTENT_WIDTH, 
                                     "Helvetica", 9, 11)
    y_position -= 10
    
    # Solicitud
    considerando_solicitud = plantilla['considerando_solicitud'].format(
        solicitante_nombre=solicitante_nombre,
        solicitante_documento=solicitante_documento,
        radicado=radicado,
        codigo_predial=codigo_predial,
        matricula_inmobiliaria=matricula
    )
    y_position = draw_justified_text(c, considerando_solicitud,
                                     MARGIN_LEFT, y_position, CONTENT_WIDTH,
                                     "Helvetica", 9, 11)
    y_position -= 10
    
    # Motivo
    considerando_motivo = plantilla['considerando_motivo'].format(
        motivo_solicitud=motivo_solicitud
    )
    y_position = draw_justified_text(c, considerando_motivo,
                                     MARGIN_LEFT, y_position, CONTENT_WIDTH,
                                     "Helvetica", 9, 11)
    y_position -= 10
    
    # Análisis
    y_position = draw_justified_text(c, plantilla['considerando_analisis'],
                                     MARGIN_LEFT, y_position, CONTENT_WIDTH,
                                     "Helvetica", 9, 11)
    y_position -= 10
    
    # Para cancelación por doble inscripción
    if subtipo == 'cancelacion' and es_doble_inscripcion and codigo_predio_duplicado:
        considerando_doble = plantilla['considerando_doble_inscripcion'].format(
            codigo_predial=codigo_predial,
            codigo_predio_duplicado=codigo_predio_duplicado
        )
        y_position = draw_justified_text(c, considerando_doble,
                                         MARGIN_LEFT, y_position, CONTENT_WIDTH,
                                         "Helvetica", 9, 11)
        y_position -= 10
    
    # Legal
    y_position = draw_justified_text(c, plantilla['considerando_legal'],
                                     MARGIN_LEFT, y_position, CONTENT_WIDTH,
                                     "Helvetica", 9, 11)
    y_position -= 15
    
    # RESUELVE
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(PAGE_WIDTH/2, y_position, "RESUELVE:")
    y_position -= 20
    
    # Artículo 1
    c.setFont("Helvetica-Bold", 9)
    articulo_1_intro = plantilla['articulo_1_intro'].format(municipio=municipio.upper())
    c.drawString(MARGIN_LEFT, y_position, f"Artículo 001. {articulo_1_intro}")
    y_position -= 20
    
    # Verificar si necesitamos nueva página
    if y_position < 250:
        draw_footer(c)
        c.showPage()
        draw_watermark(c)
        y_position = PAGE_HEIGHT - MARGIN_TOP - 30
    
    # Tabla del predio
    if subtipo == 'inscripcion':
        y_position = draw_predio_table_inscripcion(c, y_position, predio, vigencia)
    else:
        y_position = draw_predio_table_cancelacion(c, y_position, predio, vigencia)
    
    # ========== PÁGINA 2 (si es necesario) ==========
    if y_position < 200:
        draw_footer(c)
        c.showPage()
        draw_watermark(c)
        y_position = PAGE_HEIGHT - MARGIN_TOP - 30
    
    # Artículos restantes
    articulos = [
        ("Artículo 02", plantilla['articulo_2']),
        ("Artículo 03", plantilla['articulo_3']),
        ("Artículo 04", plantilla['articulo_4']),
        ("Artículo 05", plantilla['articulo_5']),
    ]
    
    for art_num, art_texto in articulos:
        if y_position < 120:
            draw_footer(c)
            c.showPage()
            draw_watermark(c)
            y_position = PAGE_HEIGHT - MARGIN_TOP - 30
        
        c.setFont("Helvetica-Bold", 9)
        c.drawString(MARGIN_LEFT, y_position, f"{art_num}.")
        y_position -= 12
        y_position = draw_justified_text(c, art_texto,
                                         MARGIN_LEFT, y_position, CONTENT_WIDTH,
                                         "Helvetica", 9, 11)
        y_position -= 12
    
    # Cierre
    if y_position < 150:
        draw_footer(c)
        c.showPage()
        draw_watermark(c)
        y_position = PAGE_HEIGHT - MARGIN_TOP - 30
    
    y_position -= 10
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(PAGE_WIDTH/2, y_position, plantilla['cierre'])
    y_position -= 25
    
    # Fecha de expedición
    colombia_tz = ZoneInfo("America/Bogota")
    fecha_expedicion = datetime.now(colombia_tz)
    meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
             'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
    fecha_texto = f"Dada en Ocaña, a los {fecha_expedicion.day} días del mes de {meses[fecha_expedicion.month-1]} de {fecha_expedicion.year}"
    c.setFont("Helvetica", 9)
    c.drawCentredString(PAGE_WIDTH/2, y_position, fecha_texto)
    y_position -= 40
    
    # Firma
    try:
        firma_base64 = get_firma_dalgie_image()
        if firma_base64:
            firma_data = base64.b64decode(firma_base64)
            firma_image = ImageReader(io.BytesIO(firma_data))
            c.drawImage(firma_image, PAGE_WIDTH/2 - 75, y_position - 50,
                       width=150, height=50, preserveAspectRatio=True, mask='auto')
            y_position -= 55
    except:
        y_position -= 30
    
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(PAGE_WIDTH/2, y_position, plantilla['firmante_nombre'])
    y_position -= 12
    c.setFont("Helvetica", 9)
    c.drawCentredString(PAGE_WIDTH/2, y_position, plantilla['firmante_cargo'])
    y_position -= 30
    
    # QR Code
    qr_data = f"RES:{numero_resolucion}|TIPO:M5-{subtipo.upper()}|PREDIO:{codigo_predial}|FECHA:{fecha_resolucion}"
    qr_hash = hashlib.md5(qr_data.encode()).hexdigest()[:8]
    qr_buffer = generate_qr_code(f"{qr_data}|HASH:{qr_hash}")
    qr_image = ImageReader(qr_buffer)
    c.drawImage(qr_image, PAGE_WIDTH - MARGIN_RIGHT - 60, 70, width=50, height=50)
    c.setFont("Helvetica", 6)
    c.drawString(PAGE_WIDTH - MARGIN_RIGHT - 60, 65, f"Verificación: {qr_hash}")
    
    # Footer final
    draw_footer(c)
    
    c.save()
    buffer.seek(0)
    return buffer.getvalue()
