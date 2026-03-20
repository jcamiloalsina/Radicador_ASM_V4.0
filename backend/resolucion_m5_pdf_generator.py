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
MARGIN_BOTTOM = 50
CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT

# Colores institucionales
VERDE_INSTITUCIONAL = colors.HexColor('#009846')
NEGRO = colors.black
BLANCO = colors.white
ROJO_CANCELACION = colors.HexColor('#C00000')
VERDE_INSCRIPCION = colors.HexColor('#008000')


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


def get_m5_plantilla_cancelacion():
    """Plantilla para Cancelación de Predio"""
    return {
        "tipo": "M5",
        "subtipo": "cancelacion",
        "titulo": "POR LA CUAL SE ORDENAN UNOS CAMBIOS EN EL CATASTRO DEL MUNICIPIO DE {municipio} Y SE RESUELVE UNA SOLICITUD DE CANCELACIÓN DE PREDIO",
        "considerando_intro": (
            "La Asociación de Municipios del Catatumbo, Provincia de Ocaña y Sur del Cesar – Asomunicipios "
            "en calidad de Gestor Catastral, en uso de sus facultades legales "
            "otorgadas por la resolución IGAC 1204 del 2021 en concordancia con la ley 14 de 1983, "
            "el literal c del artículo 2.2.2.2.2 del decreto 148 del 2020 y la resolución IGAC 1040 del 2023: "
            "\"por la cual se actualiza la reglamentación técnica de la formación, actualización, "
            "conservación y difusión catastral con enfoque multipropósito\", y"
        ),
        "considerando_solicitud": (
            "Qué, el/la señor(a) {solicitante_nombre}, identificado(a) con cédula de ciudadanía No. {solicitante_documento}, "
            "radicó una solicitud de trámite catastral atendido bajo el consecutivo de la Asociación de Municipios del Catatumbo, "
            "Provincia de Ocaña y Sur del Cesar – Asomunicipios con el No. {radicado}, "
            "donde solicita la CANCELACIÓN del predio identificado con código predial nacional {codigo_predial}, "
            "lo anterior {calidad_solicitante}."
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
            "La Asociación de Municipios del Catatumbo, Provincia de Ocaña y Sur del Cesar – Asomunicipios "
            "en calidad de Gestor Catastral, en uso de sus facultades legales "
            "otorgadas por la resolución IGAC 1204 del 2021 en concordancia con la ley 14 de 1983, "
            "el literal c del artículo 2.2.2.2.2 del decreto 148 del 2020 y la resolución IGAC 1040 del 2023: "
            "\"por la cual se actualiza la reglamentación técnica de la formación, actualización, "
            "conservación y difusión catastral con enfoque multipropósito\", y"
        ),
        "considerando_solicitud": (
            "Qué, el/la señor(a) {solicitante_nombre}, identificado(a) con cédula de ciudadanía No. {solicitante_documento}, "
            "radicó una solicitud de trámite catastral atendido bajo el consecutivo de la Asociación de Municipios del Catatumbo, "
            "Provincia de Ocaña y Sur del Cesar – Asomunicipios con el No. {radicado}, "
            "donde solicita la INSCRIPCIÓN de un predio nuevo en el catastro municipal, identificado con la matrícula "
            "inmobiliaria No. {matricula_inmobiliaria}, lo anterior {calidad_solicitante}."
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


def generar_resolucion_m5_pdf(data: dict, es_borrador: bool = False) -> bytes:
    """
    Genera el PDF de resolución M5 (Cancelación o Inscripción de Predio)
    Formato IDÉNTICO a M2/M4
    """
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    
    # Obtener datos
    subtipo = data.get('subtipo', 'inscripcion')
    plantilla = get_m5_plantilla_cancelacion() if subtipo == 'cancelacion' else get_m5_plantilla_inscripcion()
    texto_considerando_personalizado = data.get('texto_considerando')  # Texto personalizado de considerandos
    
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
    
    # Datos del predio - OBTENER DE R1/R2
    datos_r1_r2 = obtener_datos_r1_r2_pdf(predio)
    codigo_predial = predio.get('codigo_predial_nacional', predio.get('codigo_predial', ''))
    matricula = datos_r1_r2.get('matricula_inmobiliaria', '') or predio.get('matricula_inmobiliaria', '') or ""
    area_terreno = datos_r1_r2.get('area_terreno', 0)
    area_construida = datos_r1_r2.get('area_construida', 0)
    destino_economico = datos_r1_r2.get('destino_economico', 'A')
    avaluo = datos_r1_r2.get('avaluo', 0) or predio.get('avaluo', predio.get('avaluo_catastral', 0))
    direccion = datos_r1_r2.get('direccion', '')
    codigo_homologado = datos_r1_r2.get('codigo_homologado', '')
    
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
    calidad_solicitante = data.get('calidad_solicitante', 'propietario')
    CALIDADES = {
        'propietario': 'en su calidad de propietario(a) del predio',
        'apoderado': 'en calidad de apoderado del propietario(a) del predio',
        'representante_legal': 'en calidad de representante legal del propietario(a) del predio',
        'poseedor': 'en su calidad de poseedor(a) del predio'
    }
    texto_calidad = CALIDADES.get(calidad_solicitante, CALIDADES['propietario'])

    radicado = data.get('radicado', '')
    motivo_solicitud = data.get('motivo_solicitud', '')
    
    # Elaboró y Aprobó
    elaboro = data.get('elaboro', '')
    aprobo = data.get('aprobo', '')
    
    # Vigencias
    vigencia_cancelacion = data.get('vigencia_cancelacion', fecha_actual.year)
    vigencia_inscripcion = data.get('vigencia_inscripcion', fecha_actual.year)
    
    # Doble inscripción
    es_doble_inscripcion = data.get('es_doble_inscripcion', False)
    codigo_predio_duplicado = data.get('codigo_predio_duplicado', '')
    
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
        firma_img = None
        for fp in ["/app/logos/firma_dalgie_blanco.png", "/app/backend/logos/firma_dalgie_blanco.png"]:
            if os.path.exists(fp):
                firma_img = ImageReader(fp)
                break
        if not firma_img:
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
        """Formatear área: X ha X.XXX m² para áreas grandes, o solo m² para pequeñas"""
        try:
            area = float(valor or 0)
            if area == 0:
                return "0 m²"
            
            hectareas = int(area // 10000)
            metros = area % 10000
            
            if hectareas > 0:
                # Formato: 84 ha 3.750 m²
                metros_fmt = f"{metros:,.0f}".replace(",", ".")
                return f"{hectareas} ha {metros_fmt} m²"
            else:
                # Solo metros cuadrados con separador de miles
                return f"{area:,.0f}".replace(",", ".") + " m²"
        except:
            return str(valor or "0") + " m²"
    
    # ==========================================
    # FUNCIONES DE DIBUJO (IDÉNTICAS A M2/M4)
    # ==========================================
    
    def draw_borrador_watermark():
        """Dibuja marca de agua BORRADOR en diagonal rojo semitransparente"""
        if es_borrador:
            c.saveState()
            c.setFillColor(colors.HexColor('#FF0000'))
            c.setFillAlpha(0.15)
            c.setFont('Helvetica-Bold', 80)
            c.translate(PAGE_WIDTH / 2, PAGE_HEIGHT / 2)
            c.rotate(45)
            c.drawCentredString(0, 0, "BORRADOR")
            c.restoreState()

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

        draw_borrador_watermark()
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
        y_position -= 14

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
        y_position -= 14

    # Helper: dibujar texto adaptativo en celda alta (2 líneas si es necesario)
    def draw_cell_text(c, text, x, col_w, y_top, row_h, default_fs=5):
        fs = default_fs
        text_w = c.stringWidth(text, font_normal, fs)
        if text_w > col_w - 4:
            mid = len(text) // 2
            sp_before = text.rfind(' ', 0, mid + 8)
            sp_after = text.find(' ', max(0, mid - 8))
            split_at = sp_before if sp_before > 0 else (sp_after if sp_after > 0 else -1)
            if split_at > 0:
                line1, line2 = text[:split_at], text[split_at+1:]
                fs2 = default_fs
                while (c.stringWidth(line1, font_normal, fs2) > col_w - 4 or c.stringWidth(line2, font_normal, fs2) > col_w - 4) and fs2 > 4:
                    fs2 -= 0.5
                c.setFont(font_normal, fs2)
                c.drawCentredString(x + col_w/2, y_top - row_h/2 + 2, line1)
                c.drawCentredString(x + col_w/2, y_top - row_h/2 - fs2 - 1, line2)
            else:
                while c.stringWidth(text, font_normal, fs) > col_w - 4 and fs > 4:
                    fs -= 0.5
                c.setFont(font_normal, fs)
                c.drawCentredString(x + col_w/2, y_top - row_h/2 - 2, text)
        else:
            c.setFont(font_normal, fs)
            c.drawCentredString(x + col_w/2, y_top - row_h/2 - 2, text)
        c.setFont(font_normal, default_fs)

    def dibujar_tabla_predio_m5(predio_data, es_cancelacion=False, vigencia=None):
        """
        Dibuja tabla de predio IDÉNTICA a M1
        """
        nonlocal y_position

        verificar_espacio(100)

        fuente_tabla = 8

        # ============================================================
        # BANNER CANCELACIÓN o INSCRIPCIÓN (verde institucional, igual a M1)
        # ============================================================
        banner_text = "CANCELACIÓN" if es_cancelacion else "INSCRIPCIÓN"

        c.setFillColor(VERDE_INSTITUCIONAL)
        c.rect(MARGIN_LEFT, y_position - 15, CONTENT_WIDTH, 15, fill=1, stroke=0)
        c.setFillColor(BLANCO)
        c.setFont(font_bold, fuente_tabla + 1)
        c.drawCentredString(PAGE_WIDTH/2, y_position - 12, banner_text)
        y_position -= 18

        c.setStrokeColor(NEGRO)
        c.setLineWidth(0.5)

        # ============================================================
        # TABLA DE PROPIETARIOS - row height 20
        # N° PREDIAL | APELLIDOS Y NOMBRES | T.D. | NRO. DOC. | E. CIVIL
        # ============================================================
        cancel_row_h = 20
        # Columnas redistribuidas: NPN 42%, Nombre 27%, T.D. 6%, Nro Doc 17%, E. Civil 8%
        cancel_cols = [CONTENT_WIDTH * 0.42, CONTENT_WIDTH * 0.27, CONTENT_WIDTH * 0.06, CONTENT_WIDTH * 0.17, CONTENT_WIDTH * 0.08]
        cancel_headers = ["N° PREDIAL", "APELLIDOS Y NOMBRES", "T.D.", "NRO. DOC.", "E. CIVIL"]

        # Headers
        c.setFillColor(colors.HexColor('#e8e8e8'))
        c.rect(MARGIN_LEFT, y_position - cancel_row_h, CONTENT_WIDTH, cancel_row_h, fill=1, stroke=1)
        c.setFillColor(NEGRO)
        c.setFont(font_bold, fuente_tabla - 1)

        x = MARGIN_LEFT
        for i, header in enumerate(cancel_headers):
            c.drawCentredString(x + cancel_cols[i]/2, y_position - cancel_row_h/2 - 3, header)
            c.rect(x, y_position - cancel_row_h, cancel_cols[i], cancel_row_h, fill=0, stroke=1)
            x += cancel_cols[i]
        y_position -= cancel_row_h

        # Datos de propietarios
        codigo_pred = predio_data.get('codigo_predial_nacional', predio_data.get('codigo_predial', ''))
        props = predio_data.get('propietarios', [])

        c.setFont(font_normal, fuente_tabla - 1)
        if props and len(props) > 0:
            for prop in props:
                verificar_espacio(cancel_row_h + 5)
                x = MARGIN_LEFT

                # N° PREDIAL
                c.rect(x, y_position - cancel_row_h, cancel_cols[0], cancel_row_h, fill=0, stroke=1)
                draw_cell_text(c, str(codigo_pred)[:30], x, cancel_cols[0], y_position, cancel_row_h, default_fs=7)
                x += cancel_cols[0]

                # APELLIDOS Y NOMBRES
                c.rect(x, y_position - cancel_row_h, cancel_cols[1], cancel_row_h, fill=0, stroke=1)
                nombre = prop.get('nombre_propietario', prop.get('nombre', ''))[:40]
                draw_cell_text(c, nombre, x, cancel_cols[1], y_position, cancel_row_h, default_fs=7)
                x += cancel_cols[1]

                # TIPO DOC.
                c.rect(x, y_position - cancel_row_h, cancel_cols[2], cancel_row_h, fill=0, stroke=1)
                tipo_doc = prop.get('tipo_documento', 'C')
                c.setFont(font_normal, fuente_tabla - 1)
                c.drawCentredString(x + cancel_cols[2]/2, y_position - cancel_row_h/2 - 2, tipo_doc)
                x += cancel_cols[2]

                # NRO. DOC.
                c.rect(x, y_position - cancel_row_h, cancel_cols[3], cancel_row_h, fill=0, stroke=1)
                nro_doc = prop.get('numero_documento', '')
                nro_doc_padded = str(nro_doc).replace('.', '').replace(',', '').zfill(12) if nro_doc else ''
                c.setFont(font_normal, fuente_tabla - 1)
                c.drawCentredString(x + cancel_cols[3]/2, y_position - cancel_row_h/2 - 2, nro_doc_padded[:15])
                x += cancel_cols[3]

                # ESTADO CIVIL
                c.rect(x, y_position - cancel_row_h, cancel_cols[4], cancel_row_h, fill=0, stroke=1)
                estado_civil_raw = prop.get('estado_civil', ''); estado_civil = estado_civil_raw if estado_civil_raw.upper() in ['S', 'C', 'V', 'U', 'SOLTERO', 'CASADO', 'VIUDO', 'UNION', ''] else ''
                c.setFont(font_normal, fuente_tabla - 1)
                c.drawCentredString(x + cancel_cols[4]/2, y_position - cancel_row_h/2 - 2, estado_civil[:10])
                y_position -= cancel_row_h
        else:
            # Sin propietario
            verificar_espacio(cancel_row_h + 5)
            c.rect(MARGIN_LEFT, y_position - cancel_row_h, CONTENT_WIDTH, cancel_row_h, fill=0, stroke=1)
            c.drawCentredString(MARGIN_LEFT + CONTENT_WIDTH/2, y_position - cancel_row_h/2 - 2, "Sin datos de propietario")
            y_position -= cancel_row_h

        y_position -= 5

        # ============================================================
        # TABLA DATOS DEL PREDIO - row height 20
        # CÓD. HOMOLOGADO | DIRECCIÓN | D | A-TERRENO | A-CONS | AVALÚO | VIG. FISCAL
        # ============================================================
        verificar_espacio(45)

        predio_row_h = 20
        predio_cols = [CONTENT_WIDTH * 0.16, CONTENT_WIDTH * 0.19, CONTENT_WIDTH * 0.04, CONTENT_WIDTH * 0.17, CONTENT_WIDTH * 0.13, CONTENT_WIDTH * 0.16, CONTENT_WIDTH * 0.15]
        predio_headers = ["CÓD. HOMOLOGADO", "DIRECCIÓN", "D", "A-TERRENO", "A-CONS", "AVALÚO", "VIG. FISCAL"]

        # Headers
        c.setFillColor(colors.HexColor('#e8e8e8'))
        c.rect(MARGIN_LEFT, y_position - predio_row_h, CONTENT_WIDTH, predio_row_h, fill=1, stroke=1)
        c.setFillColor(NEGRO)
        c.setFont(font_bold, fuente_tabla - 1)

        x = MARGIN_LEFT
        for i, header in enumerate(predio_headers):
            c.drawCentredString(x + predio_cols[i]/2, y_position - predio_row_h/2 - 3, header)
            c.rect(x, y_position - predio_row_h, predio_cols[i], predio_row_h, fill=0, stroke=1)
            x += predio_cols[i]
        y_position -= predio_row_h

        # Datos del predio
        verificar_espacio(predio_row_h + 5)
        c.setFont(font_normal, fuente_tabla - 2)

        p_codigo_hom = predio_data.get('codigo_homologado', '')
        p_direccion = predio_data.get('direccion', '')
        p_destino = predio_data.get('destino_economico', 'A')
        p_area_terreno = predio_data.get('area_terreno', 0)
        p_area_construida = predio_data.get('area_construida', 0)
        p_avaluo = predio_data.get('avaluo', predio_data.get('avaluo_catastral', 0))
        vigencia_fiscal = f"01/01/{vigencia or fecha_actual.year}"

        x = MARGIN_LEFT

        # CÓD. HOMOLOGADO
        c.rect(x, y_position - predio_row_h, predio_cols[0], predio_row_h, fill=0, stroke=1)
        draw_cell_text(c, p_codigo_hom[:12] if p_codigo_hom else "", x, predio_cols[0], y_position, predio_row_h)
        x += predio_cols[0]

        # DIRECCIÓN
        c.rect(x, y_position - predio_row_h, predio_cols[1], predio_row_h, fill=0, stroke=1)
        draw_cell_text(c, str(p_direccion) if p_direccion else "", x, predio_cols[1], y_position, predio_row_h)
        x += predio_cols[1]

        # D (Destino Económico - solo letra)
        c.rect(x, y_position - predio_row_h, predio_cols[2], predio_row_h, fill=0, stroke=1)
        c.setFont(font_normal, 5)
        c.drawCentredString(x + predio_cols[2]/2, y_position - predio_row_h/2 - 2, p_destino[:1] if p_destino else "A")
        x += predio_cols[2]

        # A-TERRENO
        c.rect(x, y_position - predio_row_h, predio_cols[3], predio_row_h, fill=0, stroke=1)
        draw_cell_text(c, formatear_area(p_area_terreno), x, predio_cols[3], y_position, predio_row_h)
        x += predio_cols[3]

        # A-CONS
        c.rect(x, y_position - predio_row_h, predio_cols[4], predio_row_h, fill=0, stroke=1)
        draw_cell_text(c, formatear_area(p_area_construida), x, predio_cols[4], y_position, predio_row_h)
        x += predio_cols[4]

        # AVALÚO
        c.rect(x, y_position - predio_row_h, predio_cols[5], predio_row_h, fill=0, stroke=1)
        draw_cell_text(c, formatear_moneda(p_avaluo)[:12], x, predio_cols[5], y_position, predio_row_h)
        x += predio_cols[5]

        # VIG. FISCAL
        c.rect(x, y_position - predio_row_h, predio_cols[6], predio_row_h, fill=0, stroke=1)
        c.setFont(font_normal, 5)
        c.drawCentredString(x + predio_cols[6]/2, y_position - predio_row_h/2 - 2, vigencia_fiscal)
        y_position -= predio_row_h

        # ============================================================
        # FILA MATRÍCULA INMOBILIARIA
        # ============================================================
        verificar_espacio(15)
        p_matricula = predio_data.get('matricula_inmobiliaria', '')

        c.setFillColor(colors.HexColor('#e8e8e8'))
        c.rect(MARGIN_LEFT, y_position - 12, CONTENT_WIDTH * 0.3, 12, fill=1, stroke=1)
        c.setFillColor(NEGRO)
        c.setFont(font_bold, fuente_tabla - 1)
        c.drawCentredString(MARGIN_LEFT + (CONTENT_WIDTH * 0.3)/2, y_position - 9, "MATRÍCULA INMOBILIARIA")

        c.setFont(font_normal, fuente_tabla)
        c.rect(MARGIN_LEFT + CONTENT_WIDTH * 0.3, y_position - 12, CONTENT_WIDTH * 0.7, 12, fill=0, stroke=1)
        c.drawCentredString(MARGIN_LEFT + CONTENT_WIDTH * 0.3 + (CONTENT_WIDTH * 0.7)/2, y_position - 9, p_matricula)
        y_position -= 15

        return y_position
    
    # ==========================================
    # PÁGINA 1 - ENCABEZADO
    # ==========================================
    y_position = draw_header()
    
    # Número de resolución
    c.setFillColor(NEGRO)
    c.setFont(font_bold, 12)
    c.drawCentredString(PAGE_WIDTH/2, y_position, f"RESOLUCIÓN No. {numero_resolucion}")
    y_position -= 16
    
    # Fecha de resolución - Igual a M1
    c.setFont(font_bold, 10)
    c.drawCentredString(PAGE_WIDTH/2, y_position, f"FECHA RESOLUCIÓN: {fecha_resolucion}")
    y_position -= 15
    
    # Título
    titulo_formateado = plantilla["titulo"].format(municipio=municipio)
    c.setFont(font_bold, 10)
    lines = simpleSplit(titulo_formateado, font_bold, 10, CONTENT_WIDTH - 40)
    for line in lines:
        c.drawCentredString(PAGE_WIDTH/2, y_position, line)
        y_position -= 14
    y_position -= 8

    # ==========================================
    # CONSIDERANDOS
    # ==========================================
    dibujar_seccion_titulo("CONSIDERANDO:")
    y_position -= 3
    
    # Si hay texto personalizado de considerandos, usarlo
    if texto_considerando_personalizado:
        # Reemplazar variables en el texto personalizado (usando paréntesis)
        texto_procesado = texto_considerando_personalizado
        try:
            texto_procesado = texto_procesado.replace('(solicitante)', solicitante_nombre or '')
            texto_procesado = texto_procesado.replace('(documento)', solicitante_documento or '')
            texto_procesado = texto_procesado.replace('(municipio)', municipio or '')
            texto_procesado = texto_procesado.replace('(codigo_predial)', codigo_predial or '')
            texto_procesado = texto_procesado.replace('(radicado)', radicado or '')
            texto_procesado = texto_procesado.replace('(matricula)', matricula or '')
            texto_procesado = texto_procesado.replace('(vigencia)', str(vigencia_cancelacion or vigencia_inscripcion or datetime.now().year))
        except Exception:
            pass
        # Inyectar radicado automáticamente si no fue mencionado en el texto
        if radicado and radicado not in texto_procesado:
            texto_procesado = f"Trámite radicado bajo el consecutivo No. {radicado}.\n{texto_procesado}"
        c.setFillColor(NEGRO)
        # Respetar saltos de línea/párrafo tal como fueron escritos
        parrafos = texto_procesado.split('\n')
        for idx_p, parrafo in enumerate(parrafos):
            parrafo_limpio = parrafo.strip()
            if parrafo_limpio:
                dibujar_texto_justificado(parrafo_limpio)
            # Espacio entre párrafos (salto de línea visible)
            if idx_p < len(parrafos) - 1:
                y_position -= 6
        y_position -= 8
    else:
        # Usar plantilla estándar
        # Intro
        c.setFillColor(NEGRO)
        dibujar_texto_justificado(plantilla["considerando_intro"])
        y_position -= 6
        
        # Solicitud
        texto_solicitud = plantilla["considerando_solicitud"].format(
            solicitante_nombre=solicitante_nombre,
            solicitante_documento=solicitante_documento,
            radicado=radicado,
            codigo_predial=codigo_predial,
            matricula_inmobiliaria=matricula,
            calidad_solicitante=texto_calidad
        )
        dibujar_texto_justificado(texto_solicitud)
        y_position -= 6

        # Motivo
        texto_motivo = plantilla["considerando_motivo"].format(motivo_solicitud=motivo_solicitud)
        dibujar_texto_justificado(texto_motivo)
        y_position -= 6

        # Análisis
        dibujar_texto_justificado(plantilla["considerando_analisis"])
        y_position -= 6

        # Doble inscripción (solo para cancelación)
        if subtipo == 'cancelacion' and es_doble_inscripcion and codigo_predio_duplicado:
            texto_doble = plantilla["considerando_doble_inscripcion"].format(
                codigo_predial=codigo_predial,
                codigo_predio_duplicado=codigo_predio_duplicado
            )
            dibujar_texto_justificado(texto_doble)
            y_position -= 6
        
        # Legal
        dibujar_texto_justificado(plantilla["considerando_legal"])
        y_position -= 8
    
    # ==========================================
    # RESUELVE
    # ==========================================
    dibujar_seccion_titulo("RESUELVE:")
    y_position -= 3
    
    # Artículo 001
    c.setFont(font_bold, 10)
    c.drawString(MARGIN_LEFT, y_position, "Artículo 001.")
    y_position -= 14
    
    texto_articulo1 = plantilla["articulo_1_intro"].format(municipio=municipio)
    dibujar_texto_justificado(texto_articulo1)
    y_position -= 6
    
    # Tabla del predio
    if subtipo == 'cancelacion':
        y_position = dibujar_tabla_predio_m5(predio, es_cancelacion=True, vigencia=vigencia_cancelacion)
    else:
        y_position = dibujar_tabla_predio_m5(predio, es_cancelacion=False, vigencia=vigencia_inscripcion)

    # =====================
    # FECHAS DE INSCRIPCIÓN CATASTRAL (si existen)
    # =====================
    fechas_inscripcion = data.get("fechas_inscripcion", [])
    if fechas_inscripcion and len(fechas_inscripcion) > 0:
        verificar_espacio(40 + len(fechas_inscripcion) * 12)

        # Título
        c.setFont(font_bold, 8)
        c.setFillColor(NEGRO)
        c.drawString(MARGIN_LEFT, y_position, "INSCRIPCIÓN CATASTRAL:")
        y_position -= 12

        # Header
        insc_cols = [CONTENT_WIDTH * 0.2, CONTENT_WIDTH * 0.35, CONTENT_WIDTH * 0.45]
        insc_headers = ["AÑO", "AVALÚO", "DECRETO"]
        insc_row_h = 14

        c.setFillColor(colors.HexColor('#e8e8e8'))
        c.rect(MARGIN_LEFT, y_position - insc_row_h, CONTENT_WIDTH, insc_row_h, fill=1, stroke=1)
        c.setFillColor(NEGRO)
        c.setFont(font_bold, 7)
        x = MARGIN_LEFT
        for i, header in enumerate(insc_headers):
            c.drawCentredString(x + insc_cols[i]/2, y_position - insc_row_h/2 - 2, header)
            c.rect(x, y_position - insc_row_h, insc_cols[i], insc_row_h, fill=0, stroke=1)
            x += insc_cols[i]
        y_position -= insc_row_h

        # Data rows
        c.setFont(font_normal, 7)
        for fecha in fechas_inscripcion:
            verificar_espacio(insc_row_h)
            x = MARGIN_LEFT

            # Año
            c.rect(x, y_position - insc_row_h, insc_cols[0], insc_row_h, fill=0, stroke=1)
            c.drawCentredString(x + insc_cols[0]/2, y_position - insc_row_h/2 - 2, str(fecha.get("año", "")))
            x += insc_cols[0]

            # Avalúo
            avaluo_val = fecha.get("avaluo", 0)
            try:
                avaluo_fmt = f"${float(avaluo_val):,.0f}".replace(",", ".") if avaluo_val else "$0"
            except:
                avaluo_fmt = str(avaluo_val)
            c.rect(x, y_position - insc_row_h, insc_cols[1], insc_row_h, fill=0, stroke=1)
            c.drawCentredString(x + insc_cols[1]/2, y_position - insc_row_h/2 - 2, avaluo_fmt)
            x += insc_cols[1]

            # Decreto
            c.rect(x, y_position - insc_row_h, insc_cols[2], insc_row_h, fill=0, stroke=1)
            c.drawCentredString(x + insc_cols[2]/2, y_position - insc_row_h/2 - 2, str(fecha.get("decreto", "")))
            x += insc_cols[2]

            y_position -= insc_row_h

        y_position -= 6

    y_position -= 6

    # Artículo 02
    verificar_espacio(60)
    c.setFillColor(NEGRO)
    c.setFont(font_bold, 10)
    c.drawString(MARGIN_LEFT, y_position, "Artículo 02.")
    y_position -= 14
    dibujar_texto_justificado(plantilla["articulo_2"])
    y_position -= 6

    # Artículo 03
    verificar_espacio(60)
    c.setFont(font_bold, 10)
    c.drawString(MARGIN_LEFT, y_position, "Artículo 03.")
    y_position -= 14
    dibujar_texto_justificado(plantilla["articulo_3"])
    y_position -= 6

    # Artículo 04
    verificar_espacio(40)
    c.setFont(font_bold, 10)
    c.drawString(MARGIN_LEFT, y_position, "Artículo 04.")
    y_position -= 14
    dibujar_texto_justificado(plantilla["articulo_4"])
    y_position -= 6

    # Artículo 05
    verificar_espacio(40)
    c.setFont(font_bold, 10)
    c.drawString(MARGIN_LEFT, y_position, "Artículo 05.")
    y_position -= 14
    dibujar_texto_justificado(plantilla["articulo_5"])
    y_position -= 15
    
    # ==========================================
    # CIERRE Y FIRMA + QR (IDÉNTICO A M1)
    # ==========================================
    verificar_espacio(100)
    
    # Cierre
    c.setFont(font_bold, 11)
    c.drawCentredString(PAGE_WIDTH/2, y_position, plantilla["cierre"])
    y_position -= 10
    
    # Fecha textual
    c.setFont(font_normal, 10)
    c.drawCentredString(PAGE_WIDTH/2, y_position, fecha_texto)
    y_position -= 15
    
    # === GENERAR QR Y HASH (IGUAL A M1) ===
    qr_image = None
    hash_doc = ""
    fecha_hora_gen = fecha_actual.strftime("%d/%m/%Y %H:%M")
    
    # Usar código de verificación pasado desde el servidor
    codigo_verificacion = data.get('codigo_verificacion', '')
    
    # URL base para verificación (usa la misma URL del sistema)
    VERIFICACION_BASE_URL = os.environ.get('VERIFICACION_BASE_URL', 'https://certificados.asomunicipios.gov.co')
    
    try:
        # URL de verificación IGUAL A M1 - usa el código de verificación
        qr_data = f"{VERIFICACION_BASE_URL}/api/verificar/{codigo_verificacion}"
        
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=2,
        )
        qr.add_data(qr_data)
        qr.make(fit=True)
        
        # Color verde institucional idéntico al M1
        qr_img_gen = qr.make_image(fill_color="#009846", back_color="white")
        
        qr_buffer = io.BytesIO()
        qr_img_gen.save(qr_buffer, format='PNG')
        qr_buffer.seek(0)
        qr_image = ImageReader(qr_buffer)
        
        # Hash del documento - IGUAL A M1
        hash_input = f"{codigo_predial}-{codigo_verificacion}-{fecha_hora_gen}"
        hash_doc = hashlib.sha256(hash_input.encode()).hexdigest()
        
    except Exception as e:
        print(f"Error generando QR: {e}")
    
    # === CALCULAR POSICIONES PARA FIRMA Y QR LADO A LADO (IGUAL A M1) ===
    firma_block_width = 200
    verif_block_width = 185
    gap_between = 20
    
    total_blocks_width = firma_block_width + gap_between + verif_block_width
    start_x = MARGIN_LEFT + (CONTENT_WIDTH - total_blocks_width) / 2
    
    block_height = 90
    block_y = y_position - block_height
    
    # === BLOQUE IZQUIERDO: FIRMA DE DALGIE ===
    firma_center_x = start_x + firma_block_width / 2
    
    # Dibujar imagen de firma si existe
    if firma_img:
        try:
            firma_img_width = 100
            firma_img_height = 50
            c.drawImage(firma_img, firma_center_x - firma_img_width/2, block_y + 40,
                       width=firma_img_width, height=firma_img_height, mask='auto')
        except:
            pass
    
    # Línea debajo de la firma
    linea_width = 160
    linea_y = block_y + 35
    c.setStrokeColor(NEGRO)
    c.line(firma_center_x - linea_width/2, linea_y, firma_center_x + linea_width/2, linea_y)
    
    # Nombre del firmante
    c.setFont(font_bold, 10)
    c.setFillColor(NEGRO)
    c.drawCentredString(firma_center_x, linea_y - 12, plantilla["firmante_nombre"])
    
    # Cargo del firmante
    c.setFont(font_bold, 9)
    c.drawCentredString(firma_center_x, linea_y - 24, plantilla["firmante_cargo"])
    
    # === BLOQUE DERECHO: CUADRO DE VERIFICACIÓN (IDÉNTICO A M1) ===
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
        c.setStrokeColor(VERDE_INSTITUCIONAL)
        c.setLineWidth(1.5)
        c.roundRect(marco_x, marco_y, marco_width, marco_height, 5, fill=0, stroke=1)
        
        # QR dentro del marco (izquierda del bloque)
        qr_size = 46
        c.drawImage(qr_image, marco_x + 5, marco_y + 6, width=qr_size, height=qr_size, mask='auto')
        
        # Información de verificación (derecha del QR)
        info_x = marco_x + 55
        
        # Título
        c.setFillColor(VERDE_INSTITUCIONAL)
        c.setFont(font_bold, 8)
        c.drawString(info_x, marco_y + marco_height - 11, "RESOLUCIÓN VERIFICABLE")
        
        # Código de verificación (no número de resolución)
        c.setFillColor(NEGRO)
        c.setFont(font_bold, 7)
        codigo_mostrar = codigo_verificacion if codigo_verificacion else numero_resolucion
        c.drawString(info_x, marco_y + 36, f"Código: {codigo_mostrar}")
        
        # Detalles
        c.setFont(font_normal, 6)
        c.setFillColor(gris_claro)
        c.drawString(info_x, marco_y + 26, f"Generado: {fecha_hora_gen}")
        c.drawString(info_x, marco_y + 17, f"Hash: SHA256:{hash_doc[:12]}...")
        
        # URL de verificación
        c.setFillColor(VERDE_INSTITUCIONAL)
        c.setFont(font_normal, 6)
        c.drawString(info_x, marco_y + 8, "Escanear QR para verificar")
    
    y_position = block_y - 10
    
    # === ELABORÓ / APROBÓ (debajo de la firma y QR) - IGUAL A M1 ===
    verificar_espacio(30)
    c.setFont(font_normal, 8)
    c.setFillColor(NEGRO)
    c.drawString(MARGIN_LEFT, y_position, f"Elaboró: {elaboro}")
    y_position -= 12
    c.drawString(MARGIN_LEFT, y_position, f"Aprobó:  {aprobo}")
    
    # Pie de página final
    draw_footer()
    
    c.save()
    buffer.seek(0)
    return buffer.getvalue()


# Alias para compatibilidad
generate_m5_resolution_pdf = generar_resolucion_m5_pdf

