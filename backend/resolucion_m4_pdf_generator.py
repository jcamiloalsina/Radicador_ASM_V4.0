"""
Generador de PDF para Resoluciones M4 - Revisión de Avalúo y Autoestimación
"""

import io
import os
import base64
import qrcode
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.lib.units import inch

# Importar funciones de imágenes
from certificado_images import get_encabezado_image, get_pie_pagina_image, get_firma_dalgie_image

# Constantes de diseño - IDÉNTICAS a M2/M3
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


def get_m4_plantilla_revision():
    """Plantilla para Revisión de Avalúo"""
    return {
        "tipo": "M4",
        "subtipo": "revision_avaluo",
        "titulo": "POR LA CUAL SE ORDENAN UNOS CAMBIOS EN EL CATASTRO DEL MUNICIPIO DE {municipio} Y SE RESUELVE UNA SOLICITUD DE REVISIÓN DE AVALÚO",
        "considerando_intro": (
            "La Asociación de Municipios del Catatumbo, Provincia de Ocaña y Sur del Cesar "
            "\"ASOMUNICIPIOS\" en calidad de Gestor Catastral, en uso de sus facultades legales "
            "otorgadas por la resolución IGAC 1204 del 2021 en concordancia con la ley 14 de 1983, "
            "el numeral 07 del artículo 30 del decreto 846 del 29 de julio de 2021, el decreto 148 del 2020 "
            "y la resolución IGAC 1040 del 2023: \"por la cual se actualiza la reglamentación técnica de la "
            "formación, actualización, conservación y difusión catastral con enfoque multipropósito\", y"
        ),
        "considerando_solicitud": (
            "Qué, el señor {solicitante_nombre}, identificado con cédula de ciudadanía No. {solicitante_documento}, "
            "radicó una solicitud de trámite catastral atendido bajo el consecutivo de Asomunicipios con el No. {radicado}, "
            "donde solicita una revisión de avalúo catastral, para el código predial nacional {codigo_predial}, "
            "lo anterior en su calidad de propietario del predio."
        ),
        "considerando_motivo": (
            "Qué, la solicitud se centra en: \"{motivo_solicitud}\" argumenta el peticionario."
        ),
        "considerando_analisis": (
            "Qué, teniendo en cuenta los soportes presentados y el análisis realizado se encontró que revisada "
            "la información que reposa en la base catastral y realizada la inspección ocular en terreno y/o "
            "verificada a través de métodos indirectos, declarativos y colaborativos se observó lo siguiente: "
            "el predio cuenta con un área inscrita de terreno de {area_terreno} m² y de construcción de {area_construida} m² "
            "y con destino económico {destino_economico}."
        ),
        "considerando_modificacion": (
            "Por lo anterior el avalúo del predio CPN N°{codigo_predial}, se modifica a partir de la presente inscripción catastral."
        ),
        "considerando_legal": (
            "Qué estas radicaciones implican una rectificación de los datos catastrales y su correspondiente inscripción "
            "en el catastro, conforme lo indican los artículos 17, 27, 30 y 31 de la resolución \"por la cual se actualiza "
            "la reglamentación técnica de la formación, actualización, conservación y difusión catastral con enfoque "
            "multipropósito\" de 2021 del IGAC, el artículo 2.2.2.2.2 literal c del decreto 148 de 2020 y lo preceptuado "
            "en la resolución vigente sobre los requisitos para trámites y otros procedimientos administrativos."
        ),
        "articulo_1_intro": "Ordenar la inscripción en el catastro del Municipio de {municipio}, los siguientes cambios:",
        "articulo_2_aceptar": (
            "Aceptar la solicitud de revisión de avalúo presentada por el señor {solicitante_nombre}, "
            "propietario del predio CPN No. {codigo_predial}, y realizar las correcciones en las bases catastrales."
        ),
        "articulo_2_rechazar": (
            "Rechazar la solicitud de revisión de avalúo presentada por el señor {solicitante_nombre}, "
            "propietario del predio CPN No. {codigo_predial}."
        ),
        "articulo_3": (
            "De conformidad con lo dispuesto en el artículo 4.8.2 de la resolución 1040 de 2023, el presente acto "
            "administrativo se notificará personal y subsidiariamente por aviso siguiendo el procedimiento previsto "
            "en los artículos 67, 68 y 69 de la ley 1437 de 2011 (CPA y CCA), procederá la notificación electrónica "
            "siempre y cuando el interesado acepte ser notificado de esta manera."
        ),
        "articulo_4": (
            "Contra el presente acto administrativo proceden los recursos de reposición y subsidio de apelación, "
            "ante el funcionario que dictó la decisión, podrán interponerse por escrito en la diligencia de notificación "
            "personal, o dentro de los diez (10) días hábiles siguientes a su notificación, de conformidad con lo "
            "preceptuado en el artículo 4.8.4 de la resolución 1040 de 2023 y lo dispuesto en artículo 74 y 76 de la "
            "ley 1437 de 2011 o la norma que la modifique, adicione o sustituya."
        ),
        "articulo_5": (
            "Los recursos se concederán en el efecto suspensivo y por consiguiente la anotación de la inscripción "
            "catastral en los documentos de la tesorería municipal u oficina recaudadora solo se efectuarán hasta "
            "la ejecutoria del acto administrativo."
        ),
        "articulo_6": (
            "Los avalúos inscritos con posterioridad al primero de enero tendrán vigencia fiscal para el año siguiente, "
            "ajustados con el índice que determine el gobierno nacional, de conformidad a lo expuesto en el artículo "
            "4.7.14 de la resolución 1040 de 2023."
        ),
        "cierre": "COMUNÍQUESE, NOTIFÍQUESE Y CÚMPLASE",
        "firmante_nombre": "DALGIE ESPERANZA TORRADO RIZO",
        "firmante_cargo": "SUBDIRECTORA FINANCIERA Y ADMINISTRATIVA"
    }


def get_m4_plantilla_autoestimacion():
    """Plantilla para Autoestimación"""
    return {
        "tipo": "M4",
        "subtipo": "autoestimacion",
        "titulo": "POR LA CUAL SE ORDENAN UNOS CAMBIOS EN EL CATASTRO DEL MUNICIPIO DE {municipio} Y SE RESUELVE UNA SOLICITUD DE AUTOESTIMACIÓN DE AVALÚO",
        "considerando_intro": (
            "La Asociación de Municipios del Catatumbo, Provincia de Ocaña y Sur del Cesar "
            "\"ASOMUNICIPIOS\" en calidad de Gestor Catastral, en uso de sus facultades legales "
            "otorgadas por la resolución IGAC 1204 del 2021 en concordancia con la ley 14 de 1983, "
            "el numeral 07 del artículo 30 del decreto 846 del 29 de julio de 2021, el decreto 148 del 2020 "
            "y la resolución IGAC 1040 del 2023: \"por la cual se actualiza la reglamentación técnica de la "
            "formación, actualización, conservación y difusión catastral con enfoque multipropósito\", y"
        ),
        "considerando_solicitud": (
            "Qué, el señor {solicitante_nombre}, identificado con cédula de ciudadanía No. {solicitante_documento}, "
            "actuando en nombre propio y como propietario del predio, identificado con cédula catastral No. {codigo_predial} "
            "y folio de matrícula inmobiliaria No. {matricula_inmobiliaria}, radicado bajo el consecutivo {radicado} "
            "del Municipio de {municipio}. Presentó una solicitud de autoestimación del inmueble, por un valor de "
            "${valor_autoestimado}, de acuerdo a: La autoestimación presentada por el propietario."
        ),
        "considerando_legal_autoestimacion": (
            "Qué, conforme a lo establecido en los artículos 4.7.6 al 4.7.12 del título IV, capítulo 7, de la "
            "resolución 1040 de 2023, corresponde a gestores catastrales decidir sobre la aceptación o no de la "
            "autoestimación, previa verificación de la información en los registros catastrales y de las pruebas "
            "aportadas por el propietario poseedor o apoderado."
        ),
        "considerando_analisis": (
            "Qué, el profesional especializado en el área de avalúos, inicia el análisis del avalúo comercial junto "
            "con los documentos anexos, para determinar las características económicas, físicas y jurídicas del inmueble; "
            "revisando la documentación aportada por el usuario."
        ),
        "considerando_legal_final": (
            "Se observó qué, de conformidad con los artículos 4.3.1 al 4.3.8 del capítulo 3 de la resolución única "
            "1040 del 2023, los artículos 4.7.7, 4.7.8 y 4.7.9 de la resolución 1040 del 2023, y lo preceptuado en "
            "la resolución sobre los requisitos para trámites y otros procedimientos administrativos,"
        ),
        "articulo_1_intro": "Ordenar la inscripción en el catastro del municipio de: {municipio}, los siguientes cambios:",
        "articulo_2_aceptar": (
            "Aceptar el valor autoestimado presentado por el(la) señor(a) {solicitante_nombre}, para el predio "
            "No. {codigo_predial}, con folio de matrícula No. {matricula_inmobiliaria} del área {zona} del municipio "
            "de {municipio}, por valor de ${valor_autoestimado} y tomar como nuevo valor catastral el valor autoestimado, "
            "en conformidad con el artículo 4.7.9 de la resolución única 1040 de 2023."
        ),
        "articulo_2_rechazar": (
            "Rechazar el valor autoestimado presentado por el(la) señor(a) {solicitante_nombre}, para el predio "
            "No. {codigo_predial}, con folio de matrícula No. {matricula_inmobiliaria} del área {zona} del municipio "
            "de {municipio}, por valor de ${valor_autoestimado}."
        ),
        "articulo_3": (
            "De conformidad con lo dispuesto en el artículo 4.8.2 de la resolución 1040 de 2023, el presente acto "
            "administrativo se entenderá notificado el día en que se efectúe la correspondiente anotación, siguiendo "
            "el procedimiento previsto en el artículo 70 de la ley 1437 de 2011 (CPA y CCA)."
        ),
        "articulo_4": (
            "El avalúo catastral de la autoestimación aceptada permanecerá en el catastro, salvo que se presenten "
            "alguna de las circunstancias descritas en el artículo 4.7.12 de la resolución 1040 de 2023."
        ),
        "articulo_5": (
            "Contra el presente acto administrativo proceden los recursos de reposición y subsidio de apelación, "
            "ante el funcionario que dictó la decisión, podrán interponerse por escrito en la diligencia de notificación "
            "personal, o dentro de los diez (10) días hábiles siguientes a su notificación, de conformidad con lo "
            "preceptuado en el artículo 4.8.4 de la resolución 1040 de 2023 y lo dispuesto en artículo 74 y 76 de la "
            "ley 1437 de 2011 o la norma que la modifique, adicione o sustituya."
        ),
        "articulo_6": (
            "Los recursos se concederán en el efecto suspensivo y por consiguiente la anotación de la inscripción "
            "catastral en los documentos de la tesorería municipal u oficina recaudadora solo se efectuarán hasta "
            "la ejecutoria del acto administrativo."
        ),
        "articulo_7": (
            "Los avalúos inscritos con posterioridad al primero de enero tendrán vigencia fiscal para el año siguiente, "
            "ajustados con el índice que determine el gobierno nacional, de conformidad a lo expuesto en el artículo "
            "4.7.14 de la resolución única 1040 de 2023."
        ),
        "cierre": "NOTIFÍQUESE, COMUNÍQUESE Y CÚMPLASE",
        "firmante_nombre": "DALGIE ESPERANZA TORRADO RIZO",
        "firmante_cargo": "SUBDIRECTORA FINANCIERA Y ADMINISTRATIVA"
    }


def generate_resolucion_m4_pdf(data: dict) -> bytes:
    """
    Genera un PDF de resolución M4 (Revisión de Avalúo o Autoestimación)
    
    Args:
        data: Diccionario con los datos de la resolución
            - subtipo: 'revision_avaluo' o 'autoestimacion'
            - decision: 'aceptar' o 'rechazar'
            - numero_resolucion, fecha_resolucion, municipio
            - predio: dict con datos del predio
            - solicitante: dict con nombre y documento
            - avaluo_anterior, avaluo_nuevo
            - motivo_solicitud (para revision_avaluo)
            - valor_autoestimado (para autoestimacion)
    
    Returns:
        bytes del PDF generado
    """
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    
    # Obtener plantilla según subtipo
    subtipo = data.get('subtipo', 'revision_avaluo')
    plantilla = get_m4_plantilla_revision() if subtipo == 'revision_avaluo' else get_m4_plantilla_autoestimacion()
    
    # Decisión (aceptar/rechazar)
    decision = data.get('decision', 'aceptar')
    
    # Fuentes
    font_normal = "Helvetica"
    font_bold = "Helvetica-Bold"
    
    # Cargar imágenes
    encabezado_img = None
    pie_pagina_img = None
    firma_dalgie = None
    logo_watermark = None
    
    try:
        encabezado_img = ImageReader(get_encabezado_image())
    except Exception as e:
        print(f"Error cargando encabezado: {e}")
    
    try:
        pie_pagina_img = ImageReader(get_pie_pagina_image())
    except Exception as e:
        print(f"Error cargando pie de página: {e}")
    
    try:
        firma_dalgie = ImageReader(get_firma_dalgie_image())
    except Exception as e:
        print(f"Error cargando firma: {e}")
    
    try:
        logo_path = "/app/frontend/public/watermark-gray.png"
        if os.path.exists(logo_path):
            logo_watermark = ImageReader(logo_path)
    except Exception as e:
        print(f"Error cargando marca de agua: {e}")
    
    # Variables de posición
    y_position = PAGE_HEIGHT - MARGIN_TOP - 80
    page_number = 1
    
    # Extraer datos
    numero_resolucion = data.get('numero_resolucion', 'RES-XX-XXX-XXXX-2026')
    fecha_resolucion = data.get('fecha_resolucion', datetime.now().strftime('%d/%m/%Y'))
    municipio = data.get('municipio', '')
    predio = data.get('predio', {})
    solicitante = data.get('solicitante', {})
    
    # Datos del predio
    codigo_predial = predio.get('codigo_predial_nacional', predio.get('codigo_catastral', ''))
    matricula = predio.get('matricula_inmobiliaria', '')
    area_terreno = predio.get('area_terreno', 0)
    area_construida = predio.get('area_construida', 0)
    destino_economico = predio.get('destino_economico', '')
    direccion = predio.get('direccion', '')
    zona = 'rural' if predio.get('zona', '').lower() in ['rural', 'r', '00'] else 'urbana'
    
    # Datos del solicitante
    solicitante_nombre = solicitante.get('nombre', '')
    solicitante_documento = solicitante.get('documento', '')
    
    # Datos de avalúo
    avaluo_anterior = data.get('avaluo_anterior', 0)
    avaluo_nuevo = data.get('avaluo_nuevo', 0)
    radicado = data.get('radicado', '')
    motivo_solicitud = data.get('motivo_solicitud', '')
    valor_autoestimado = data.get('valor_autoestimado', avaluo_nuevo)
    
    # Funciones auxiliares
    def draw_header():
        if encabezado_img:
            c.drawImage(encabezado_img, MARGIN_LEFT, PAGE_HEIGHT - 75, 
                       width=CONTENT_WIDTH, height=60, preserveAspectRatio=True, mask='auto')
    
    def draw_footer():
        if pie_pagina_img:
            c.drawImage(pie_pagina_img, MARGIN_LEFT, 15, 
                       width=CONTENT_WIDTH, height=50, preserveAspectRatio=True, mask='auto')
        c.setFont(font_normal, 8)
        c.setFillColor(colors.gray)
        c.drawCentredString(PAGE_WIDTH/2, 10, f"Página {page_number}")
        c.setFillColor(NEGRO)
    
    def draw_watermark():
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
    
    def new_page():
        nonlocal y_position, page_number
        c.showPage()
        page_number += 1
        draw_header()
        draw_footer()
        draw_watermark()
        y_position = PAGE_HEIGHT - MARGIN_TOP - 80
    
    def verificar_espacio(altura_necesaria):
        nonlocal y_position
        if y_position - altura_necesaria < MARGIN_BOTTOM + 60:
            new_page()
    
    def draw_wrapped_text(text, x, max_width, font_name, font_size, line_height=14):
        nonlocal y_position
        c.setFont(font_name, font_size)
        words = text.split()
        lines = []
        current_line = ""
        
        for word in words:
            test_line = current_line + " " + word if current_line else word
            if c.stringWidth(test_line, font_name, font_size) < max_width:
                current_line = test_line
            else:
                if current_line:
                    lines.append(current_line)
                current_line = word
        if current_line:
            lines.append(current_line)
        
        for line in lines:
            verificar_espacio(line_height)
            c.drawString(x, y_position, line)
            y_position -= line_height
        
        return len(lines)
    
    def formatear_moneda(valor):
        try:
            return f"${int(valor):,}".replace(",", ".")
        except:
            return f"${valor}"
    
    # ==========================================
    # INICIO DEL DOCUMENTO
    # ==========================================
    
    draw_header()
    draw_footer()
    draw_watermark()
    
    # Número de resolución (esquina derecha)
    c.setFont(font_bold, 10)
    c.setFillColor(VERDE_INSTITUCIONAL)
    c.drawRightString(PAGE_WIDTH - MARGIN_RIGHT, PAGE_HEIGHT - MARGIN_TOP - 90, numero_resolucion)
    c.setFillColor(NEGRO)
    
    y_position = PAGE_HEIGHT - MARGIN_TOP - 110
    
    # Título de la resolución
    c.setFont(font_bold, 10)
    c.drawCentredString(PAGE_WIDTH/2, y_position, f"RESOLUCIÓN No: {numero_resolucion}")
    y_position -= 15
    c.drawCentredString(PAGE_WIDTH/2, y_position, f"FECHA RESOLUCIÓN: {fecha_resolucion}")
    y_position -= 20
    
    # Título del documento
    titulo = plantilla['titulo'].format(municipio=municipio.upper())
    c.setFont(font_bold, 9)
    
    # Dividir título en líneas
    titulo_lines = []
    words = titulo.split()
    current_line = ""
    for word in words:
        test_line = current_line + " " + word if current_line else word
        if c.stringWidth(test_line, font_bold, 9) < CONTENT_WIDTH - 40:
            current_line = test_line
        else:
            titulo_lines.append(current_line)
            current_line = word
    if current_line:
        titulo_lines.append(current_line)
    
    for line in titulo_lines:
        c.drawCentredString(PAGE_WIDTH/2, y_position, line)
        y_position -= 12
    
    y_position -= 15
    
    # ==========================================
    # CONSIDERANDO
    # ==========================================
    
    verificar_espacio(30)
    c.setFont(font_bold, 11)
    c.drawCentredString(PAGE_WIDTH/2, y_position, "CONSIDERANDO")
    y_position -= 25
    
    # Considerando intro
    c.setFillColor(NEGRO)
    draw_wrapped_text(plantilla['considerando_intro'], MARGIN_LEFT, CONTENT_WIDTH, font_normal, 10)
    y_position -= 10
    
    # Considerando solicitud
    if subtipo == 'revision_avaluo':
        texto_solicitud = plantilla['considerando_solicitud'].format(
            solicitante_nombre=solicitante_nombre,
            solicitante_documento=solicitante_documento,
            radicado=radicado,
            codigo_predial=codigo_predial
        )
    else:
        texto_solicitud = plantilla['considerando_solicitud'].format(
            solicitante_nombre=solicitante_nombre,
            solicitante_documento=solicitante_documento,
            codigo_predial=codigo_predial,
            matricula_inmobiliaria=matricula,
            radicado=radicado,
            municipio=municipio,
            valor_autoestimado=formatear_moneda(valor_autoestimado)
        )
    
    draw_wrapped_text(texto_solicitud, MARGIN_LEFT, CONTENT_WIDTH, font_normal, 10)
    y_position -= 10
    
    # Considerando motivo (solo para revisión de avalúo)
    if subtipo == 'revision_avaluo' and motivo_solicitud:
        texto_motivo = plantilla['considerando_motivo'].format(motivo_solicitud=motivo_solicitud)
        draw_wrapped_text(texto_motivo, MARGIN_LEFT, CONTENT_WIDTH, font_normal, 10)
        y_position -= 10
    
    # Considerando legal autoestimación
    if subtipo == 'autoestimacion':
        draw_wrapped_text(plantilla['considerando_legal_autoestimacion'], MARGIN_LEFT, CONTENT_WIDTH, font_normal, 10)
        y_position -= 10
    
    # Considerando análisis
    if subtipo == 'revision_avaluo':
        texto_analisis = plantilla['considerando_analisis'].format(
            area_terreno=area_terreno,
            area_construida=area_construida,
            destino_economico=destino_economico
        )
        draw_wrapped_text(texto_analisis, MARGIN_LEFT, CONTENT_WIDTH, font_normal, 10)
        y_position -= 10
        
        # Considerando modificación
        texto_mod = plantilla['considerando_modificacion'].format(codigo_predial=codigo_predial)
        draw_wrapped_text(texto_mod, MARGIN_LEFT, CONTENT_WIDTH, font_normal, 10)
        y_position -= 10
        
        # Considerando legal
        draw_wrapped_text(plantilla['considerando_legal'], MARGIN_LEFT, CONTENT_WIDTH, font_normal, 10)
    else:
        draw_wrapped_text(plantilla['considerando_analisis'], MARGIN_LEFT, CONTENT_WIDTH, font_normal, 10)
        y_position -= 10
        draw_wrapped_text(plantilla['considerando_legal_final'], MARGIN_LEFT, CONTENT_WIDTH, font_normal, 10)
    
    y_position -= 20
    
    # ==========================================
    # RESUELVE
    # ==========================================
    
    verificar_espacio(30)
    c.setFont(font_bold, 11)
    c.drawCentredString(PAGE_WIDTH/2, y_position, "RESUELVE")
    y_position -= 25
    
    # Función para dibujar tabla de cancelación/inscripción
    def dibujar_tabla_avaluo(titulo_seccion, es_cancelacion=True):
        nonlocal y_position
        
        verificar_espacio(80)
        
        # Título de sección con fondo verde
        c.setFillColor(VERDE_INSTITUCIONAL)
        c.rect(MARGIN_LEFT, y_position - 12, CONTENT_WIDTH, 15, fill=1, stroke=0)
        c.setFillColor(BLANCO)
        c.setFont(font_bold, 10)
        c.drawCentredString(PAGE_WIDTH/2, y_position - 9, titulo_seccion)
        y_position -= 20
        
        c.setFillColor(NEGRO)
        
        # Headers de la tabla
        col_widths = [CONTENT_WIDTH * 0.35, CONTENT_WIDTH * 0.35, CONTENT_WIDTH * 0.30]
        headers = ["CÓDIGO PREDIAL", "PROPIETARIO", "AVALÚO"]
        
        c.setFillColor(VERDE_INSTITUCIONAL)
        c.rect(MARGIN_LEFT, y_position - 12, CONTENT_WIDTH, 12, fill=1, stroke=0)
        c.setFillColor(BLANCO)
        c.setFont(font_bold, 8)
        
        x = MARGIN_LEFT
        for i, header in enumerate(headers):
            c.drawCentredString(x + col_widths[i]/2, y_position - 9, header)
            x += col_widths[i]
        y_position -= 12
        
        # Fila de datos
        c.setFillColor(NEGRO)
        c.setFont(font_normal, 8)
        c.setStrokeColor(colors.lightgrey)
        c.rect(MARGIN_LEFT, y_position - 12, CONTENT_WIDTH, 12, stroke=1, fill=0)
        
        valor = avaluo_anterior if es_cancelacion else avaluo_nuevo
        
        x = MARGIN_LEFT
        c.drawCentredString(x + col_widths[0]/2, y_position - 9, codigo_predial[:30] if codigo_predial else "")
        x += col_widths[0]
        c.drawCentredString(x + col_widths[1]/2, y_position - 9, solicitante_nombre[:25] if solicitante_nombre else "")
        x += col_widths[1]
        c.drawCentredString(x + col_widths[2]/2, y_position - 9, formatear_moneda(valor))
        y_position -= 15
        
        # Fila de matrícula
        c.setFillColor(colors.HexColor('#e8e8e8'))
        c.rect(MARGIN_LEFT, y_position - 12, CONTENT_WIDTH * 0.3, 12, fill=1, stroke=1)
        c.setFillColor(NEGRO)
        c.setFont(font_bold, 7)
        c.drawCentredString(MARGIN_LEFT + (CONTENT_WIDTH * 0.3)/2, y_position - 9, "MATRÍCULA INMOBILIARIA")
        c.setFont(font_normal, 7)
        c.rect(MARGIN_LEFT + CONTENT_WIDTH * 0.3, y_position - 12, CONTENT_WIDTH * 0.7, 12, fill=0, stroke=1)
        c.drawCentredString(MARGIN_LEFT + CONTENT_WIDTH * 0.3 + (CONTENT_WIDTH * 0.7)/2, y_position - 9, matricula)
        y_position -= 20
    
    # ARTÍCULO 1 - Tablas de cancelación/inscripción
    verificar_espacio(40)
    c.setFont(font_bold, 10)
    c.drawString(MARGIN_LEFT, y_position, "Artículo 1.")
    c.setFont(font_normal, 10)
    texto_art1 = plantilla['articulo_1_intro'].format(municipio=municipio)
    c.drawString(MARGIN_LEFT + 55, y_position, texto_art1)
    y_position -= 20
    
    # Solo mostrar tablas si se acepta
    if decision == 'aceptar':
        dibujar_tabla_avaluo("CANCELACIÓN", es_cancelacion=True)
        dibujar_tabla_avaluo("INSCRIPCIÓN", es_cancelacion=False)
    
    y_position -= 10
    
    # ARTÍCULO 2 - Aceptar/Rechazar
    verificar_espacio(60)
    c.setFont(font_bold, 10)
    c.drawString(MARGIN_LEFT, y_position, "Artículo 2.")
    c.setFont(font_normal, 10)
    
    if decision == 'aceptar':
        if subtipo == 'revision_avaluo':
            texto_art2 = plantilla['articulo_2_aceptar'].format(
                solicitante_nombre=solicitante_nombre,
                codigo_predial=codigo_predial
            )
        else:
            texto_art2 = plantilla['articulo_2_aceptar'].format(
                solicitante_nombre=solicitante_nombre,
                codigo_predial=codigo_predial,
                matricula_inmobiliaria=matricula,
                zona=zona,
                municipio=municipio,
                valor_autoestimado=formatear_moneda(valor_autoestimado)
            )
    else:
        if subtipo == 'revision_avaluo':
            texto_art2 = plantilla['articulo_2_rechazar'].format(
                solicitante_nombre=solicitante_nombre,
                codigo_predial=codigo_predial
            )
        else:
            texto_art2 = plantilla['articulo_2_rechazar'].format(
                solicitante_nombre=solicitante_nombre,
                codigo_predial=codigo_predial,
                matricula_inmobiliaria=matricula,
                zona=zona,
                municipio=municipio,
                valor_autoestimado=formatear_moneda(valor_autoestimado)
            )
    
    # Dibujar texto del artículo 2
    art2_lines = []
    words = texto_art2.split()
    current_line = ""
    for word in words:
        test_line = current_line + " " + word if current_line else word
        if c.stringWidth(test_line, font_normal, 10) < (CONTENT_WIDTH - 60):
            current_line = test_line
        else:
            art2_lines.append(current_line)
            current_line = word
    if current_line:
        art2_lines.append(current_line)
    
    c.drawString(MARGIN_LEFT + 55, y_position, art2_lines[0] if art2_lines else "")
    y_position -= 14
    for line in art2_lines[1:]:
        c.drawString(MARGIN_LEFT, y_position, line)
        y_position -= 14
    y_position -= 10
    
    # Función para dibujar artículo con texto largo
    def dibujar_articulo(num_articulo, texto):
        nonlocal y_position
        verificar_espacio(60)
        c.setFont(font_bold, 10)
        c.drawString(MARGIN_LEFT, y_position, f"Artículo {num_articulo}.")
        c.setFont(font_normal, 10)
        
        lines = []
        words = texto.split()
        current_line = ""
        for word in words:
            test_line = current_line + " " + word if current_line else word
            if c.stringWidth(test_line, font_normal, 10) < (CONTENT_WIDTH - 60):
                current_line = test_line
            else:
                lines.append(current_line)
                current_line = word
        if current_line:
            lines.append(current_line)
        
        c.drawString(MARGIN_LEFT + 60, y_position, lines[0] if lines else "")
        y_position -= 14
        for line in lines[1:]:
            c.drawString(MARGIN_LEFT, y_position, line)
            y_position -= 14
        y_position -= 10
    
    # Artículos restantes según subtipo
    if subtipo == 'revision_avaluo':
        dibujar_articulo(3, plantilla['articulo_3'])
        dibujar_articulo(4, plantilla['articulo_4'])
        dibujar_articulo(5, plantilla['articulo_5'])
        dibujar_articulo(6, plantilla['articulo_6'])
    else:
        dibujar_articulo(3, plantilla['articulo_3'])
        dibujar_articulo(4, plantilla['articulo_4'])
        dibujar_articulo(5, plantilla['articulo_5'])
        dibujar_articulo(6, plantilla['articulo_6'])
        dibujar_articulo(7, plantilla['articulo_7'])
    
    y_position -= 20
    
    # ==========================================
    # FIRMA Y QR DE VERIFICACIÓN
    # ==========================================
    
    verificar_espacio(150)
    
    c.setFont(font_bold, 10)
    c.drawCentredString(PAGE_WIDTH/2, y_position, plantilla['cierre'])
    y_position -= 30
    
    # Generar QR de verificación
    qr_data = f"ASOMUNICIPIOS|{numero_resolucion}|{fecha_resolucion}|M4-{subtipo.upper()}"
    qr = qrcode.QRCode(version=1, box_size=10, border=2)
    qr.add_data(qr_data)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")
    qr_buffer = io.BytesIO()
    qr_img.save(qr_buffer, format='PNG')
    qr_buffer.seek(0)
    qr_image = ImageReader(qr_buffer)
    
    # Calcular posiciones para firma y QR
    firma_center_x = PAGE_WIDTH / 2
    qr_size = 60
    
    # Dibujar firma
    if firma_dalgie:
        firma_img_width = 120
        firma_img_height = 50
        c.drawImage(firma_dalgie, firma_center_x - firma_img_width/2, y_position - 40,
                   width=firma_img_width, height=firma_img_height,
                   preserveAspectRatio=True, mask='auto')
    
    y_position -= 50
    
    # Línea de firma
    linea_y = y_position
    c.setStrokeColor(NEGRO)
    c.line(firma_center_x - 100, linea_y, firma_center_x + 100, linea_y)
    
    # Nombre y cargo
    c.setFont(font_bold, 10)
    c.drawCentredString(firma_center_x, linea_y - 12, plantilla["firmante_nombre"])
    c.setFont(font_normal, 9)
    c.drawCentredString(firma_center_x, linea_y - 24, plantilla["firmante_cargo"])
    
    # QR code a la derecha
    qr_x = PAGE_WIDTH - MARGIN_RIGHT - qr_size - 10
    qr_y = linea_y - 30
    c.drawImage(qr_image, qr_x, qr_y, width=qr_size, height=qr_size)
    
    # Texto de verificación bajo el QR
    c.setFont(font_normal, 6)
    c.drawCentredString(qr_x + qr_size/2, qr_y - 8, "Código de verificación")
    
    # ==========================================
    # FINALIZAR DOCUMENTO
    # ==========================================
    
    c.save()
    buffer.seek(0)
    return buffer.getvalue()
