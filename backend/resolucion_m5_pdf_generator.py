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
ROJO_CANCELACION = colors.HexColor('#C00000')
VERDE_INSCRIPCION = colors.HexColor('#008000')


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


def generar_resolucion_m5_pdf(data: dict) -> bytes:
    """
    Genera el PDF de resolución M5 (Cancelación o Inscripción de Predio)
    Formato IDÉNTICO a M2/M4
    """
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    
    # Obtener datos
    subtipo = data.get('subtipo', 'inscripcion')
    plantilla = get_m5_plantilla_cancelacion() if subtipo == 'cancelacion' else get_m5_plantilla_inscripcion()
    
    municipio = data.get('municipio', '').upper()
    numero_resolucion = data.get('numero_resolucion', '')
    
    # Fecha con timezone Colombia
    try:
        colombia_tz = ZoneInfo("America/Bogota")
        fecha_actual = datetime.now(colombia_tz)
        fecha_resolucion = fecha_actual.strftime("%d/%m/%Y")
        fecha_texto = f"Dada en Ocaña, a los {fecha_actual.day} días del mes de {['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][fecha_actual.month-1]} de {fecha_actual.year}"
    except:
        fecha_actual = datetime.now()
        fecha_resolucion = fecha_actual.strftime("%d/%m/%Y")
        fecha_texto = f"Dada en Ocaña, a los {fecha_actual.day} días del mes de {['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][fecha_actual.month-1]} de {fecha_actual.year}"
    
    # Predio
    predio = data.get('predio_m5', data.get('predio', {}))
    solicitante = data.get('solicitante', {})
    
    # Datos del predio
    codigo_predial = predio.get('codigo_predial_nacional', predio.get('codigo_predial', ''))
    matricula = predio.get('matricula_inmobiliaria', '')
    area_terreno = predio.get('area_terreno', 0)
    area_construida = predio.get('area_construida', 0)
    destino_economico = predio.get('destino_economico', 'A')
    avaluo = predio.get('avaluo', predio.get('avaluo_catastral', 0))
    direccion = predio.get('direccion', '')
    codigo_homologado = predio.get('codigo_homologado', '')
    
    # Propietarios
    propietarios = predio.get('propietarios', [])
    if propietarios and len(propietarios) > 0:
        propietario_principal = propietarios[0]
        nombre_propietario = propietario_principal.get('nombre_propietario', propietario_principal.get('nombre', ''))
        tipo_doc = propietario_principal.get('tipo_documento', 'C')
        num_doc = propietario_principal.get('numero_documento', '')
    else:
        nombre_propietario = solicitante.get('nombre', '')
        tipo_doc = 'C'
        num_doc = solicitante.get('documento', '')
    
    # Datos del solicitante
    solicitante_nombre = solicitante.get('nombre', nombre_propietario)
    solicitante_documento = solicitante.get('documento', num_doc)
    
    radicado = data.get('radicado', '')
    motivo_solicitud = data.get('motivo_solicitud', '')
    
    # Vigencias
    vigencia_cancelacion = data.get('vigencia_cancelacion', fecha_actual.year)
    vigencia_inscripcion = data.get('vigencia_inscripcion', fecha_actual.year)
    
    # Doble inscripción
    es_doble_inscripcion = data.get('es_doble_inscripcion', False)
    codigo_predio_duplicado = data.get('codigo_predio_duplicado', '')
    
    # Código verificación
    codigo_verificacion = hashlib.md5(f"{numero_resolucion}{fecha_resolucion}".encode()).hexdigest()[:8]
    
    # Cargar imágenes - IGUAL A M4
    encabezado_img = None
    pie_pagina_img = None
    logo_watermark = None
    firma_img = None
    
    try:
        encabezado_img = ImageReader(get_encabezado_image())
    except Exception as e:
        print(f"Error cargando encabezado: {e}")
    
    try:
        pie_pagina_img = ImageReader(get_pie_pagina_image())
    except Exception as e:
        print(f"Error cargando pie de página: {e}")
    
    try:
        firma_img = ImageReader(get_firma_dalgie_image())
    except Exception as e:
        print(f"Error cargando firma: {e}")
    
    try:
        logo_path = "/app/frontend/public/watermark-gray.png"
        if os.path.exists(logo_path):
            logo_watermark = ImageReader(logo_path)
    except Exception as e:
        print(f"Error cargando marca de agua: {e}")
    
    # Fuentes
    font_normal = "Helvetica"
    font_bold = "Helvetica-Bold"
    
    # Variables de estado
    y_position = PAGE_HEIGHT - MARGIN_TOP
    page_number = 1
    
    def formatear_moneda(valor):
        try:
            return f"${int(float(valor)):,}".replace(",", ".")
        except:
            return f"${valor}"
    
    def formatear_area(valor):
        try:
            return f"{float(valor):,.2f} m²".replace(",", "X").replace(".", ",").replace("X", ".")
        except:
            return f"{valor} m²"
    
    # ==========================================
    # FUNCIONES DE DIBUJO (IDÉNTICAS A M2/M4)
    # ==========================================
    
    def draw_header():
        """Dibuja el encabezado institucional - IDÉNTICO a M2"""
        nonlocal y_position
        if encabezado_img:
            header_height = 2.5 * cm
            c.drawImage(encabezado_img, 0, PAGE_HEIGHT - header_height, 
                       width=PAGE_WIDTH, height=header_height, 
                       preserveAspectRatio=False, mask='auto')
        
        # Marca de agua
        if logo_watermark:
            c.saveState()
            watermark_width = 450
            watermark_height = 180
            watermark_x = (PAGE_WIDTH - watermark_width) / 2
            watermark_y = (PAGE_HEIGHT - watermark_height) / 2
            c.setFillAlpha(0.08)
            c.drawImage(logo_watermark, watermark_x, watermark_y,
                       width=watermark_width, height=watermark_height,
                       preserveAspectRatio=True, mask='auto')
            c.restoreState()
        
        return PAGE_HEIGHT - 3*cm
    
    def draw_footer():
        """Dibuja el pie de página institucional - IDÉNTICO a M2"""
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
        """Dibuja texto justificado (alineado a ambos márgenes) - IDÉNTICO a M2"""
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
                    space_width = total_space / (len(words) - 1)
                    
                    if space_width > max_space:
                        c.drawString(MARGIN_LEFT, y_position, line)
                    else:
                        x = MARGIN_LEFT
                        for j, word in enumerate(words):
                            c.drawString(x, y_position, word)
                            x += c.stringWidth(word, fname, font_size)
                            if j < len(words) - 1:
                                x += space_width
                else:
                    c.drawString(MARGIN_LEFT, y_position, line)
            
            y_position -= line_height
    
    def dibujar_seccion_titulo(titulo):
        nonlocal y_position
        verificar_espacio(30)
        c.setFont(font_bold, 11)
        c.drawCentredString(PAGE_WIDTH/2, y_position, titulo)
        y_position -= 20
    
    def dibujar_tabla_predio_m5(predio_data, es_cancelacion=False, vigencia=None):
        """Dibuja tabla de predio estilo M2 con banner de CANCELACIÓN o INSCRIPCIÓN"""
        nonlocal y_position
        
        verificar_espacio(120)
        
        # Banner de tipo (CANCELACIÓN o INSCRIPCIÓN)
        if es_cancelacion:
            banner_color = ROJO_CANCELACION
            banner_text = "PREDIO A CANCELAR"
        else:
            banner_color = VERDE_INSCRIPCION
            banner_text = "PREDIO A INSCRIBIR"
        
        c.setFillColor(banner_color)
        c.rect(MARGIN_LEFT, y_position - 15, CONTENT_WIDTH, 15, fill=1, stroke=0)
        c.setFillColor(BLANCO)
        c.setFont(font_bold, 9)
        c.drawCentredString(PAGE_WIDTH/2, y_position - 11, banner_text)
        y_position -= 18
        
        c.setStrokeColor(colors.HexColor('#333333'))
        c.setLineWidth(0.5)
        
        # Fila 1: Código Predial Nacional + Matrícula Inmobiliaria
        col_widths1 = [CONTENT_WIDTH * 0.5, CONTENT_WIDTH * 0.5]
        headers1 = ["Código Predial Nacional (Asignado):", "Matrícula Inmobiliaria:"]
        
        c.setFillColor(colors.HexColor('#e8e8e8'))
        c.rect(MARGIN_LEFT, y_position - 12, CONTENT_WIDTH, 12, fill=1, stroke=1)
        c.setFillColor(NEGRO)
        c.setFont(font_bold, 7)
        x = MARGIN_LEFT
        for i, header in enumerate(headers1):
            c.drawCentredString(x + col_widths1[i]/2, y_position - 9, header)
            c.rect(x, y_position - 12, col_widths1[i], 12, fill=0, stroke=1)
            x += col_widths1[i]
        y_position -= 12
        
        # Valores
        codigo_pred = predio_data.get('codigo_predial_nacional', predio_data.get('codigo_predial', ''))
        matricula_val = predio_data.get('matricula_inmobiliaria', '')
        
        c.setFont(font_normal, 7)
        x = MARGIN_LEFT
        c.rect(x, y_position - 12, col_widths1[0], 12, fill=0, stroke=1)
        c.drawCentredString(x + col_widths1[0]/2, y_position - 9, codigo_pred)
        x += col_widths1[0]
        c.rect(x, y_position - 12, col_widths1[1], 12, fill=0, stroke=1)
        c.drawCentredString(x + col_widths1[1]/2, y_position - 9, matricula_val)
        y_position -= 12
        
        # Fila 2: Propietario + Documento
        c.setFillColor(colors.HexColor('#e8e8e8'))
        c.rect(MARGIN_LEFT, y_position - 12, CONTENT_WIDTH, 12, fill=1, stroke=1)
        c.setFillColor(NEGRO)
        c.setFont(font_bold, 7)
        x = MARGIN_LEFT
        c.drawCentredString(x + col_widths1[0]/2, y_position - 9, "Propietario:")
        c.rect(x, y_position - 12, col_widths1[0], 12, fill=0, stroke=1)
        x += col_widths1[0]
        c.drawCentredString(x + col_widths1[1]/2, y_position - 9, "Documento:")
        c.rect(x, y_position - 12, col_widths1[1], 12, fill=0, stroke=1)
        y_position -= 12
        
        # Valores propietario
        props = predio_data.get('propietarios', [])
        if props and len(props) > 0:
            prop_nombre = props[0].get('nombre_propietario', props[0].get('nombre', ''))
            prop_tipo = props[0].get('tipo_documento', 'C')
            prop_num = props[0].get('numero_documento', '')
            prop_doc = f"{prop_tipo} {prop_num}"
        else:
            prop_nombre = ""
            prop_doc = ""
        
        c.setFont(font_normal, 7)
        x = MARGIN_LEFT
        c.rect(x, y_position - 12, col_widths1[0], 12, fill=0, stroke=1)
        c.drawCentredString(x + col_widths1[0]/2, y_position - 9, prop_nombre[:40])
        x += col_widths1[0]
        c.rect(x, y_position - 12, col_widths1[1], 12, fill=0, stroke=1)
        c.drawCentredString(x + col_widths1[1]/2, y_position - 9, prop_doc)
        y_position -= 12
        
        # Fila 3: Dirección + Destino Económico
        c.setFillColor(colors.HexColor('#e8e8e8'))
        c.rect(MARGIN_LEFT, y_position - 12, CONTENT_WIDTH, 12, fill=1, stroke=1)
        c.setFillColor(NEGRO)
        c.setFont(font_bold, 7)
        x = MARGIN_LEFT
        c.drawCentredString(x + col_widths1[0]/2, y_position - 9, "Dirección:")
        c.rect(x, y_position - 12, col_widths1[0], 12, fill=0, stroke=1)
        x += col_widths1[0]
        c.drawCentredString(x + col_widths1[1]/2, y_position - 9, "Destino Económico:")
        c.rect(x, y_position - 12, col_widths1[1], 12, fill=0, stroke=1)
        y_position -= 12
        
        # Valores
        dir_val = predio_data.get('direccion', '')
        dest_val = predio_data.get('destino_economico', 'A')
        
        c.setFont(font_normal, 7)
        x = MARGIN_LEFT
        c.rect(x, y_position - 12, col_widths1[0], 12, fill=0, stroke=1)
        c.drawCentredString(x + col_widths1[0]/2, y_position - 9, dir_val[:45])
        x += col_widths1[0]
        c.rect(x, y_position - 12, col_widths1[1], 12, fill=0, stroke=1)
        c.drawCentredString(x + col_widths1[1]/2, y_position - 9, dest_val)
        y_position -= 12
        
        # Fila 4: Área Terreno + Área Construida + Avalúo
        col_widths2 = [CONTENT_WIDTH * 0.33, CONTENT_WIDTH * 0.33, CONTENT_WIDTH * 0.34]
        
        c.setFillColor(colors.HexColor('#e8e8e8'))
        c.rect(MARGIN_LEFT, y_position - 12, CONTENT_WIDTH, 12, fill=1, stroke=1)
        c.setFillColor(NEGRO)
        c.setFont(font_bold, 7)
        x = MARGIN_LEFT
        for i, header in enumerate(["Área Terreno:", "Área Construida:", "Avalúo:"]):
            c.drawCentredString(x + col_widths2[i]/2, y_position - 9, header)
            c.rect(x, y_position - 12, col_widths2[i], 12, fill=0, stroke=1)
            x += col_widths2[i]
        y_position -= 12
        
        # Valores áreas
        area_ter = predio_data.get('area_terreno', 0)
        area_con = predio_data.get('area_construida', 0)
        avaluo_val = predio_data.get('avaluo', predio_data.get('avaluo_catastral', 0))
        
        c.setFont(font_normal, 7)
        x = MARGIN_LEFT
        c.rect(x, y_position - 12, col_widths2[0], 12, fill=0, stroke=1)
        c.drawCentredString(x + col_widths2[0]/2, y_position - 9, formatear_area(area_ter))
        x += col_widths2[0]
        c.rect(x, y_position - 12, col_widths2[1], 12, fill=0, stroke=1)
        c.drawCentredString(x + col_widths2[1]/2, y_position - 9, formatear_area(area_con))
        x += col_widths2[1]
        c.rect(x, y_position - 12, col_widths2[2], 12, fill=0, stroke=1)
        c.drawCentredString(x + col_widths2[2]/2, y_position - 9, formatear_moneda(avaluo_val))
        y_position -= 12
        
        # Fila 5: Vigencia (Cancelación desde / Inscripción desde)
        if es_cancelacion:
            vigencia_label = "Cancelación desde vigencia:"
            vigencia_color = ROJO_CANCELACION
        else:
            vigencia_label = "Inscripción desde vigencia:"
            vigencia_color = VERDE_INSCRIPCION
        
        c.setFillColor(colors.HexColor('#e8e8e8'))
        c.rect(MARGIN_LEFT, y_position - 15, CONTENT_WIDTH * 0.5, 15, fill=1, stroke=1)
        c.setFillColor(NEGRO)
        c.setFont(font_bold, 8)
        c.drawCentredString(MARGIN_LEFT + (CONTENT_WIDTH * 0.5)/2, y_position - 11, vigencia_label)
        
        c.setFillColor(vigencia_color)
        c.rect(MARGIN_LEFT + CONTENT_WIDTH * 0.5, y_position - 15, CONTENT_WIDTH * 0.5, 15, fill=1, stroke=1)
        c.setFillColor(BLANCO)
        c.setFont(font_bold, 10)
        c.drawCentredString(MARGIN_LEFT + CONTENT_WIDTH * 0.75, y_position - 11, f"01/01/{vigencia or fecha_actual.year}")
        
        y_position -= 20
        
        return y_position
    
    # ==========================================
    # PÁGINA 1 - ENCABEZADO
    # ==========================================
    y_position = draw_header()
    
    # Número de resolución y fecha
    c.setFillColor(NEGRO)
    c.setFont(font_bold, 12)
    c.drawCentredString(PAGE_WIDTH/2, y_position, f"RESOLUCIÓN No. {numero_resolucion}")
    y_position -= 16
    
    c.setFont(font_normal, 10)
    c.drawCentredString(PAGE_WIDTH/2, y_position, f"({fecha_resolucion})")
    y_position -= 25
    
    # Título
    titulo_formateado = plantilla["titulo"].format(municipio=municipio)
    c.setFont(font_bold, 10)
    lines = simpleSplit(titulo_formateado, font_bold, 10, CONTENT_WIDTH - 40)
    for line in lines:
        c.drawCentredString(PAGE_WIDTH/2, y_position, line)
        y_position -= 14
    y_position -= 15
    
    # ==========================================
    # CONSIDERANDOS
    # ==========================================
    dibujar_seccion_titulo("CONSIDERANDO:")
    y_position -= 5
    
    # Intro
    c.setFillColor(NEGRO)
    dibujar_texto_justificado(plantilla["considerando_intro"])
    y_position -= 10
    
    # Solicitud
    texto_solicitud = plantilla["considerando_solicitud"].format(
        solicitante_nombre=solicitante_nombre,
        solicitante_documento=solicitante_documento,
        radicado=radicado,
        codigo_predial=codigo_predial,
        matricula_inmobiliaria=matricula
    )
    dibujar_texto_justificado(texto_solicitud)
    y_position -= 10
    
    # Motivo
    texto_motivo = plantilla["considerando_motivo"].format(motivo_solicitud=motivo_solicitud)
    dibujar_texto_justificado(texto_motivo)
    y_position -= 10
    
    # Análisis
    dibujar_texto_justificado(plantilla["considerando_analisis"])
    y_position -= 10
    
    # Doble inscripción (solo para cancelación)
    if subtipo == 'cancelacion' and es_doble_inscripcion and codigo_predio_duplicado:
        texto_doble = plantilla["considerando_doble_inscripcion"].format(
            codigo_predial=codigo_predial,
            codigo_predio_duplicado=codigo_predio_duplicado
        )
        dibujar_texto_justificado(texto_doble)
        y_position -= 10
    
    # Legal
    dibujar_texto_justificado(plantilla["considerando_legal"])
    y_position -= 15
    
    # ==========================================
    # RESUELVE
    # ==========================================
    dibujar_seccion_titulo("RESUELVE:")
    y_position -= 5
    
    # Artículo 001
    c.setFont(font_bold, 10)
    c.drawString(MARGIN_LEFT, y_position, "Artículo 001.")
    y_position -= 14
    
    texto_articulo1 = plantilla["articulo_1_intro"].format(municipio=municipio)
    dibujar_texto_justificado(texto_articulo1)
    y_position -= 10
    
    # Tabla del predio
    if subtipo == 'cancelacion':
        y_position = dibujar_tabla_predio_m5(predio, es_cancelacion=True, vigencia=vigencia_cancelacion)
    else:
        y_position = dibujar_tabla_predio_m5(predio, es_cancelacion=False, vigencia=vigencia_inscripcion)
    
    y_position -= 10
    
    # Artículo 02
    verificar_espacio(60)
    c.setFillColor(NEGRO)
    c.setFont(font_bold, 10)
    c.drawString(MARGIN_LEFT, y_position, "Artículo 02.")
    y_position -= 14
    dibujar_texto_justificado(plantilla["articulo_2"])
    y_position -= 10
    
    # Artículo 03
    verificar_espacio(60)
    c.setFont(font_bold, 10)
    c.drawString(MARGIN_LEFT, y_position, "Artículo 03.")
    y_position -= 14
    dibujar_texto_justificado(plantilla["articulo_3"])
    y_position -= 10
    
    # Artículo 04
    verificar_espacio(40)
    c.setFont(font_bold, 10)
    c.drawString(MARGIN_LEFT, y_position, "Artículo 04.")
    y_position -= 14
    dibujar_texto_justificado(plantilla["articulo_4"])
    y_position -= 10
    
    # Artículo 05
    verificar_espacio(40)
    c.setFont(font_bold, 10)
    c.drawString(MARGIN_LEFT, y_position, "Artículo 05.")
    y_position -= 14
    dibujar_texto_justificado(plantilla["articulo_5"])
    y_position -= 20
    
    # ==========================================
    # CIERRE Y FIRMA
    # ==========================================
    verificar_espacio(150)
    
    # Cierre
    c.setFont(font_bold, 11)
    c.drawCentredString(PAGE_WIDTH/2, y_position, plantilla["cierre"])
    y_position -= 20
    
    # Fecha textual
    c.setFont(font_normal, 10)
    c.drawCentredString(PAGE_WIDTH/2, y_position, fecha_texto)
    y_position -= 40
    
    # Firma
    if firma_img:
        try:
            firma_width = 150
            firma_height = 50
            firma_x = (PAGE_WIDTH - firma_width) / 2
            c.drawImage(firma_img, firma_x, y_position - firma_height,
                       width=firma_width, height=firma_height,
                       preserveAspectRatio=True, mask='auto')
            y_position -= firma_height + 10
        except:
            y_position -= 30
    else:
        y_position -= 30
    
    # Nombre y cargo
    c.setFont(font_bold, 10)
    c.drawCentredString(PAGE_WIDTH/2, y_position, plantilla["firmante_nombre"])
    y_position -= 14
    c.setFont(font_normal, 9)
    c.drawCentredString(PAGE_WIDTH/2, y_position, plantilla["firmante_cargo"])
    y_position -= 30
    
    # QR de verificación
    verificar_espacio(80)
    try:
        qr = qrcode.QRCode(version=1, box_size=3, border=1)
        qr.add_data(f"M5-{numero_resolucion}-{codigo_verificacion}")
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="black", back_color="white")
        
        qr_buffer = io.BytesIO()
        qr_img.save(qr_buffer, format='PNG')
        qr_buffer.seek(0)
        qr_reader = ImageReader(qr_buffer)
        
        qr_size = 50
        c.drawImage(qr_reader, PAGE_WIDTH - MARGIN_RIGHT - qr_size, y_position - qr_size,
                   width=qr_size, height=qr_size)
        
        c.setFont(font_normal, 7)
        c.drawString(PAGE_WIDTH - MARGIN_RIGHT - qr_size - 80, y_position - 30, f"Verificación: {codigo_verificacion}")
    except Exception as e:
        print(f"Error generando QR: {e}")
    
    # Pie de página final
    draw_footer()
    
    c.save()
    buffer.seek(0)
    return buffer.getvalue()


# Alias para compatibilidad
generate_m5_resolution_pdf = generar_resolucion_m5_pdf

