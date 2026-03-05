"""
Generador de PDF para Resoluciones M4 - Revisión de Avalúo y Autoestimación
Estructura IDÉNTICA a M2 para mantener consistencia visual
"""

import io
import os
import base64
import qrcode
import hashlib
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader, simpleSplit
from reportlab.lib.units import inch, cm

# Importar funciones de imágenes
from certificado_images import get_encabezado_image, get_pie_pagina_image, get_firma_dalgie_image

# Constantes de diseño - IDÉNTICAS a M2
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
    Estructura IDÉNTICA a M2 para consistencia visual
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
    
    # Variables de control
    page_number = 1
    y_position = PAGE_HEIGHT - MARGIN_TOP
    
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
    
    # Extraer datos
    numero_resolucion = data.get('numero_resolucion', 'RES-XX-XXX-XXXX-2026')
    fecha_resolucion = data.get('fecha_resolucion', datetime.now().strftime('%d/%m/%Y'))
    municipio = data.get('municipio', '')
    predio = data.get('predio', {})
    solicitante = data.get('solicitante', {})
    elaboro = data.get('elaborado_por', '')
    aprobo = data.get('revisado_por', plantilla['firmante_nombre'])
    
    # Datos del predio
    codigo_predial = predio.get('codigo_predial_nacional', predio.get('codigo_catastral', ''))
    matricula = predio.get('matricula_inmobiliaria', '')
    area_terreno = predio.get('area_terreno', 0)
    area_construida = predio.get('area_construida', 0)
    destino_economico = predio.get('destino_economico', '')
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
    
    # Generar código de verificación
    fecha_hora_gen = datetime.now().strftime("%Y%m%d%H%M%S")
    codigo_verificacion = f"M4-{numero_resolucion.replace('/', '-')}-{fecha_hora_gen[-6:]}"
    
    def formatear_moneda(valor):
        try:
            return f"${int(valor):,}".replace(",", ".")
        except:
            return f"${valor}"
    
    # ==========================================
    # FUNCIONES DE DIBUJO (IDÉNTICAS A M2)
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
    
    # ==========================================
    # PÁGINA 1 - ENCABEZADO
    # ==========================================
    
    y_position = draw_header()
    
    # Número de resolución y fecha
    c.setFillColor(NEGRO)
    c.setFont(font_bold, 11)
    c.drawCentredString(PAGE_WIDTH/2, y_position, f"RESOLUCIÓN No: {numero_resolucion}")
    y_position -= 14
    c.drawCentredString(PAGE_WIDTH/2, y_position, f"FECHA RESOLUCIÓN: {fecha_resolucion}")
    y_position -= 20
    
    # Título
    titulo = plantilla["titulo"].format(municipio=municipio.upper())
    c.setFont(font_bold, 10)
    lines = simpleSplit(titulo, font_bold, 10, CONTENT_WIDTH)
    for line in lines:
        c.drawCentredString(PAGE_WIDTH/2, y_position, line)
        y_position -= 14
    y_position -= 10
    
    # ==========================================
    # CONSIDERANDO
    # ==========================================
    
    dibujar_seccion_titulo("CONSIDERANDO")
    c.setFillColor(NEGRO)
    
    # Considerando intro
    dibujar_texto_justificado(plantilla['considerando_intro'])
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
    
    dibujar_texto_justificado(texto_solicitud)
    y_position -= 10
    
    # Considerando motivo (solo para revisión de avalúo)
    if subtipo == 'revision_avaluo' and motivo_solicitud:
        texto_motivo = plantilla['considerando_motivo'].format(motivo_solicitud=motivo_solicitud)
        dibujar_texto_justificado(texto_motivo)
        y_position -= 10
    
    # Considerando legal autoestimación
    if subtipo == 'autoestimacion':
        dibujar_texto_justificado(plantilla['considerando_legal_autoestimacion'])
        y_position -= 10
    
    # Considerando análisis
    if subtipo == 'revision_avaluo':
        texto_analisis = plantilla['considerando_analisis'].format(
            area_terreno=area_terreno,
            area_construida=area_construida,
            destino_economico=destino_economico
        )
        dibujar_texto_justificado(texto_analisis)
        y_position -= 10
        
        texto_mod = plantilla['considerando_modificacion'].format(codigo_predial=codigo_predial)
        dibujar_texto_justificado(texto_mod)
        y_position -= 10
        
        dibujar_texto_justificado(plantilla['considerando_legal'])
    else:
        dibujar_texto_justificado(plantilla['considerando_analisis'])
        y_position -= 10
        dibujar_texto_justificado(plantilla['considerando_legal_final'])
    
    y_position -= 15
    
    # ==========================================
    # RESUELVE
    # ==========================================
    
    dibujar_seccion_titulo("RESUELVE")
    c.setFillColor(NEGRO)
    
    # ARTÍCULO 1 - Tablas de cancelación/inscripción
    verificar_espacio(40)
    c.setFont(font_bold, 10)
    c.drawString(MARGIN_LEFT, y_position, "Artículo 1.")
    c.setFont(font_normal, 10)
    texto_art1 = plantilla['articulo_1_intro'].format(municipio=municipio)
    c.drawString(MARGIN_LEFT + 55, y_position, texto_art1)
    y_position -= 20
    
    # Función para dibujar tabla de avalúo
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
        y_position -= 12
        
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
    
    # Solo mostrar tablas si se acepta
    if decision == 'aceptar':
        dibujar_tabla_avaluo("CANCELACIÓN", es_cancelacion=True)
        dibujar_tabla_avaluo("INSCRIPCIÓN", es_cancelacion=False)
    
    y_position -= 10
    
    # Función para dibujar artículo con texto justificado
    def dibujar_articulo(num_articulo, texto):
        nonlocal y_position
        verificar_espacio(60)
        c.setFont(font_bold, 10)
        c.drawString(MARGIN_LEFT, y_position, f"Artículo {num_articulo}.")
        
        # Calcular ancho disponible después de "Artículo X."
        indent = 60
        c.setFont(font_normal, 10)
        
        lines = simpleSplit(texto, font_normal, 10, CONTENT_WIDTH - indent)
        espacio_normal = c.stringWidth(' ', font_normal, 10)
        max_space = espacio_normal * 3
        
        for i, line in enumerate(lines):
            verificar_espacio(14)
            
            if i == 0:
                # Primera línea junto al número de artículo
                c.drawString(MARGIN_LEFT + indent, y_position, line)
            else:
                # Líneas siguientes justificadas
                line_width = c.stringWidth(line, font_normal, 10)
                if i == len(lines) - 1 or line_width < CONTENT_WIDTH * 0.75:
                    c.drawString(MARGIN_LEFT, y_position, line)
                else:
                    words = line.split(' ')
                    if len(words) > 1:
                        total_words_width = sum(c.stringWidth(word, font_normal, 10) for word in words)
                        total_space = CONTENT_WIDTH - total_words_width
                        space_width = total_space / (len(words) - 1)
                        
                        if space_width > max_space:
                            c.drawString(MARGIN_LEFT, y_position, line)
                        else:
                            x = MARGIN_LEFT
                            for j, word in enumerate(words):
                                c.drawString(x, y_position, word)
                                x += c.stringWidth(word, font_normal, 10)
                                if j < len(words) - 1:
                                    x += space_width
                    else:
                        c.drawString(MARGIN_LEFT, y_position, line)
            
            y_position -= 14
        y_position -= 6
    
    # ARTÍCULO 2 - Aceptar/Rechazar
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
    
    dibujar_articulo(2, texto_art2)
    
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
    
    y_position -= 15
    
    # ==========================================
    # CIERRE
    # ==========================================
    
    verificar_espacio(30)
    c.setFont(font_bold, 11)
    c.drawCentredString(PAGE_WIDTH/2, y_position, plantilla['cierre'])
    y_position -= 30
    
    # ==========================================
    # FIRMA Y QR DE VERIFICACIÓN (IDÉNTICO A M2)
    # ==========================================
    
    verificar_espacio(120)
    
    # Generar QR
    qr_image = None
    hash_doc = ""
    try:
        qr_url = f"https://catastro.asomunicipios.gov.co/verificar?codigo={codigo_verificacion}"
        qr = qrcode.QRCode(version=1, box_size=10, border=2)
        qr.add_data(qr_url)
        qr.make(fit=True)
        
        qr_img = qr.make_image(fill_color="#009846", back_color="white")
        
        qr_buffer = io.BytesIO()
        qr_img.save(qr_buffer, format='PNG')
        qr_buffer.seek(0)
        qr_image = ImageReader(qr_buffer)
        
        hash_input = f"{codigo_predial}-{codigo_verificacion}-{fecha_hora_gen}"
        hash_doc = hashlib.sha256(hash_input.encode()).hexdigest()
        
    except Exception as e:
        print(f"Error generando QR: {e}")
    
    # Calcular posiciones para firma y QR lado a lado
    firma_block_width = 200
    verif_block_width = 185
    gap_between = 20
    
    total_blocks_width = firma_block_width + gap_between + verif_block_width
    start_x = MARGIN_LEFT + (CONTENT_WIDTH - total_blocks_width) / 2
    
    block_height = 90
    block_y = y_position - block_height
    
    # BLOQUE IZQUIERDO: FIRMA
    firma_center_x = start_x + firma_block_width / 2
    
    if firma_dalgie:
        firma_img_width = 100
        firma_img_height = 50
        c.drawImage(firma_dalgie, firma_center_x - firma_img_width/2, block_y + 40,
                   width=firma_img_width, height=firma_img_height, mask='auto')
    
    # Línea debajo de la firma
    linea_width = 160
    linea_y = block_y + 35
    c.setStrokeColor(NEGRO)
    c.line(firma_center_x - linea_width/2, linea_y, firma_center_x + linea_width/2, linea_y)
    
    # Nombre del firmante
    c.setFont(font_bold, 9)
    c.setFillColor(NEGRO)
    c.drawCentredString(firma_center_x, linea_y - 12, plantilla["firmante_nombre"])
    
    # Cargo del firmante
    c.setFont(font_bold, 8)
    c.drawCentredString(firma_center_x, linea_y - 24, plantilla["firmante_cargo"])
    
    # BLOQUE DERECHO: QR DE VERIFICACIÓN
    if qr_image:
        gris_claro = colors.HexColor('#666666')
        marco_width = verif_block_width
        marco_height = 58
        marco_x = start_x + firma_block_width + gap_between
        marco_y = block_y + 15
        
        # Fondo del marco
        c.setFillColor(colors.HexColor('#f0fdf4'))
        c.roundRect(marco_x, marco_y, marco_width, marco_height, 5, fill=1, stroke=0)
        
        # Borde verde institucional
        c.setStrokeColor(VERDE_INSTITUCIONAL)
        c.setLineWidth(1.5)
        c.roundRect(marco_x, marco_y, marco_width, marco_height, 5, fill=0, stroke=1)
        
        # QR dentro del marco
        qr_size = 46
        c.drawImage(qr_image, marco_x + 5, marco_y + 6, width=qr_size, height=qr_size, mask='auto')
        
        # Información de verificación
        info_x = marco_x + 55
        
        # Título
        c.setFillColor(VERDE_INSTITUCIONAL)
        c.setFont(font_bold, 8)
        c.drawString(info_x, marco_y + marco_height - 11, "RESOLUCIÓN VERIFICABLE")
        
        # Código
        c.setFillColor(NEGRO)
        c.setFont(font_bold, 7)
        codigo_mostrar = codigo_verificacion or numero_resolucion
        c.drawString(info_x, marco_y + 36, f"Código: {codigo_mostrar[:20]}")
        
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
    
    # ELABORÓ / APROBÓ
    verificar_espacio(30)
    c.setFont(font_normal, 7)
    c.setFillColor(NEGRO)
    c.drawString(MARGIN_LEFT, y_position, f"Elaboró: {elaboro}")
    y_position -= 12
    c.drawString(MARGIN_LEFT, y_position, f"Aprobó:  {aprobo}")
    
    # PIE DE PÁGINA FINAL
    draw_footer()
    
    c.save()
    buffer.seek(0)
    return buffer.getvalue()
