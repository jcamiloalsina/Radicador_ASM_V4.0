"""
Generador de PDF para Resoluciones de Complementación de Información
Estructura IDÉNTICA a M5 para mantener consistencia visual
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

# Constantes de diseño - IDÉNTICAS a M5
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


def obtener_datos_r1_r2_pdf(predio: dict) -> dict:
    """
    Obtiene datos de R1 y R2 del predio para los cuadros de cancelación/inscripción.
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


def get_complementacion_plantilla():
    """Plantilla para Complementación de Información"""
    return {
        "tipo": "COMPLEMENTACION",
        "titulo": "POR LA CUAL SE ORDENAN UNOS CAMBIOS EN EL CATASTRO DEL MUNICIPIO DE {municipio} Y SE RESUELVE UNA SOLICITUD DE COMPLEMENTACIÓN DE INFORMACIÓN",
        "considerando_intro": (
            "La Asociación de Municipios del Catatumbo, Provincia de Ocaña y Sur del Cesar – Asomunicipios "
            "en calidad de Gestor Catastral, en uso de sus facultades legales "
            "otorgadas por la resolución IGAC 1204 del 2021 en concordancia con la ley 14 de 1983, "
            "el literal c del artículo 2.2.2.2.2 del decreto 148 del 2020 y la resolución IGAC 1040 del 2023: "
            "\"por la cual se actualiza la reglamentación técnica de la formación, actualización, "
            "conservación y difusión catastral con enfoque multipropósito\", y"
        ),
        "considerando_solicitud": (
            "Qué, ante la oficina de gestión catastral de Asomunicipios, solicitan un trámite catastral de "
            "complementación de información, radicado bajo el consecutivo {radicado}."
        ),
        "considerando_documentos": (
            "Qué, se aportaron como soportes los siguientes documentos: {documentos_soporte}"
        ),
        "considerando_estudio": (
            "Qué, según estudio de oficina se hace necesario efectuar una complementación de la información "
            "para el predio con código catastral NPN {codigo_predial}."
        ),
        "considerando_legal": (
            "Qué estas radicaciones implican una complementación y su correspondiente inscripción en el catastro, "
            "conforme lo indican el literal c del artículo 2.2.2.2.2 del decreto 148 de 2020, "
            "los artículos 4.5.1, 4.5.5, 4.7.8 y 4.7.9 de la resolución única 1040 del 2023 "
            "y lo preceptuado en la resolución sobre los requisitos para trámites y otros procedimientos administrativos."
        ),
        "considerando_base": (
            "Qué con base en los documentos aportados y lo dispuesto por las normas anteriormente mencionadas, se"
        ),
        "articulo_1_intro": "Ordenar la inscripción en el catastro del Municipio de {municipio} los siguientes cambios:",
        "articulo_2": (
            "De conformidad con lo dispuesto en el artículo 4.8.2 de la resolución 1040 de 2023 y el artículo 70 "
            "de la ley 1437 de 2011, el presente acto administrativo rige a partir de la fecha de su expedición."
        ),
        "articulo_3": (
            "Los avalúos inscritos con posterioridad al primero de enero tendrán vigencia fiscal para el año siguiente, "
            "ajustados con el índice que determine el gobierno nacional, de conformidad a lo expuesto en los artículos "
            "4.7.13 y 4.7.14 de la resolución 1040 de 2023."
        ),
        "articulo_4": (
            "Contra el presente acto administrativo no procede recurso alguno."
        ),
        "cierre": "COMUNÍQUESE, NOTIFÍQUESE Y CÚMPLASE",
        "firmante_nombre": "DALGIE ESPERANZA TORRADO RIZO",
        "firmante_cargo": "SUBDIRECTORA FINANCIERA Y ADMINISTRATIVA"
    }


def generar_resolucion_complementacion_pdf(data: dict) -> bytes:
    """
    Genera el PDF de resolución de Complementación de Información
    Formato IDÉNTICO a M5
    """
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    
    # Obtener datos
    plantilla = get_complementacion_plantilla()
    texto_considerando_personalizado = data.get('texto_considerando')
    
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
    
    fecha_hora_gen = fecha_actual.strftime("%d/%m/%Y %H:%M")
    
    # Predio
    predio = data.get('predio', {})
    solicitante = data.get('solicitante', {})
    
    # Datos del predio - OBTENER DE R1/R2
    datos_r1_r2 = obtener_datos_r1_r2_pdf(predio)
    codigo_predial = predio.get('codigo_predial_nacional', predio.get('codigo_predial', ''))
    matricula = datos_r1_r2.get('matricula_inmobiliaria', '') or predio.get('matricula_inmobiliaria', '') or "Sin información"
    area_terreno = datos_r1_r2.get('area_terreno', 0)
    area_construida = datos_r1_r2.get('area_construida', 0)
    destino_economico = datos_r1_r2.get('destino_economico', 'A')
    avaluo = datos_r1_r2.get('avaluo', 0) or predio.get('avaluo', predio.get('avaluo_catastral', 0))
    direccion = datos_r1_r2.get('direccion', '')
    codigo_homologado = datos_r1_r2.get('codigo_homologado', '')
    
    # Datos nuevos para complementación
    area_terreno_nueva = data.get('area_terreno_nueva', area_terreno)
    area_construida_nueva = data.get('area_construida_nueva', area_construida)
    avaluo_nuevo = data.get('avaluo_nuevo', avaluo)
    
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
    documentos_soporte = data.get('documentos_soporte', 'Oficio de solicitud, Cédula del propietario, Certificado de libertad y tradición')
    
    # Elaboró y Aprobó
    elaboro = data.get('elaboro', data.get('elaborado_por', ''))
    aprobo = data.get('aprobo', data.get('revisado_por', ''))
    
    # Vigencias
    vigencia_cancelacion = data.get('vigencia_cancelacion', fecha_actual.year)
    vigencia_inscripcion = data.get('vigencia_inscripcion', fecha_actual.year)
    
    # Código de verificación
    codigo_verificacion = data.get('codigo_verificacion', '')
    
    # Cargar imágenes - IGUAL A M5
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
    
    # Generar QR
    qr_image = None
    hash_doc = ""
    
    try:
        VERIFICACION_BASE_URL = os.environ.get('VERIFICACION_BASE_URL', 'https://certificados.asomunicipios.gov.co')
        qr_data = f"{VERIFICACION_BASE_URL}/api/verificar/{codigo_verificacion}"
        
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=2,
        )
        qr.add_data(qr_data)
        qr.make(fit=True)
        
        # Color verde institucional idéntico al M5
        qr_img_gen = qr.make_image(fill_color="#009846", back_color="white")
        
        qr_buffer = io.BytesIO()
        qr_img_gen.save(qr_buffer, format='PNG')
        qr_buffer.seek(0)
        qr_image = ImageReader(qr_buffer)
        
        # Hash del documento
        hash_input = f"{codigo_predial}-{codigo_verificacion}-{fecha_hora_gen}"
        hash_doc = hashlib.sha256(hash_input.encode()).hexdigest()
        
    except Exception as e:
        print(f"Error generando QR: {e}")
    
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
    # FUNCIONES DE DIBUJO (IDÉNTICAS A M5)
    # ==========================================
    
    def draw_header():
        """Dibuja el encabezado institucional - IDÉNTICO a M5"""
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
        """Dibuja el pie de página institucional - IDÉNTICO a M5"""
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
        """Dibuja texto justificado (alineado a ambos márgenes) - IDÉNTICO a M5"""
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
    
    def dibujar_tabla_predio_complementacion(predio_data, es_cancelacion=False, vigencia=None, 
                                              area_terreno_val=None, area_construida_val=None, avaluo_val=None):
        """
        Dibuja tabla de predio IDÉNTICA a M5
        """
        nonlocal y_position
        
        verificar_espacio(120)
        
        fuente_tabla = 8
        
        # BANNER CANCELACIÓN o INSCRIPCIÓN (verde institucional)
        banner_text = "CANCELACIÓN" if es_cancelacion else "INSCRIPCIÓN"
        
        c.setFillColor(VERDE_INSTITUCIONAL)
        c.rect(MARGIN_LEFT, y_position - 15, CONTENT_WIDTH, 15, fill=1, stroke=0)
        c.setFillColor(BLANCO)
        c.setFont(font_bold, fuente_tabla + 1)
        c.drawCentredString(PAGE_WIDTH/2, y_position - 12, banner_text)
        y_position -= 18
        
        c.setStrokeColor(NEGRO)
        c.setLineWidth(0.5)
        
        # TABLA DE PROPIETARIOS - IGUAL A M5
        cancel_cols = [CONTENT_WIDTH * 0.32, CONTENT_WIDTH * 0.30, CONTENT_WIDTH * 0.10, CONTENT_WIDTH * 0.18, CONTENT_WIDTH * 0.10]
        cancel_headers = ["N° PREDIAL", "APELLIDOS Y NOMBRES", "TIPO DOC.", "NRO. DOC.", "ESTADO"]
        
        # Headers
        c.setFillColor(colors.HexColor('#e8e8e8'))
        c.rect(MARGIN_LEFT, y_position - 12, CONTENT_WIDTH, 12, fill=1, stroke=1)
        c.setFillColor(NEGRO)
        c.setFont(font_bold, fuente_tabla - 1)
        
        x = MARGIN_LEFT
        for i, header in enumerate(cancel_headers):
            c.drawCentredString(x + cancel_cols[i]/2, y_position - 9, header)
            c.rect(x, y_position - 12, cancel_cols[i], 12, fill=0, stroke=1)
            x += cancel_cols[i]
        y_position -= 12
        
        # Datos de propietarios
        codigo_pred = predio_data.get('codigo_predial_nacional', predio_data.get('codigo_predial', codigo_predial))
        props = predio_data.get('propietarios', [])
        
        c.setFont(font_normal, fuente_tabla - 1)
        if props and len(props) > 0:
            for prop in props:
                verificar_espacio(15)
                x = MARGIN_LEFT
                
                # N° PREDIAL
                c.rect(x, y_position - 12, cancel_cols[0], 12, fill=0, stroke=1)
                c.setFont(font_normal, fuente_tabla - 2)
                c.drawCentredString(x + cancel_cols[0]/2, y_position - 9, str(codigo_pred)[:30])
                c.setFont(font_normal, fuente_tabla - 1)
                x += cancel_cols[0]
                
                # APELLIDOS Y NOMBRES
                c.rect(x, y_position - 12, cancel_cols[1], 12, fill=0, stroke=1)
                nombre = prop.get('nombre_propietario', prop.get('nombre', ''))[:40]
                if len(nombre) > 28:
                    c.setFont(font_normal, fuente_tabla - 2)
                c.drawCentredString(x + cancel_cols[1]/2, y_position - 9, nombre)
                c.setFont(font_normal, fuente_tabla - 1)
                x += cancel_cols[1]
                
                # TIPO DOC.
                c.rect(x, y_position - 12, cancel_cols[2], 12, fill=0, stroke=1)
                tipo_doc_prop = prop.get('tipo_documento', 'C')
                c.drawCentredString(x + cancel_cols[2]/2, y_position - 9, tipo_doc_prop)
                x += cancel_cols[2]
                
                # NRO. DOC.
                c.rect(x, y_position - 12, cancel_cols[3], 12, fill=0, stroke=1)
                nro_doc = prop.get('numero_documento', '')
                nro_doc_padded = str(nro_doc).zfill(12) if nro_doc else ''
                c.drawCentredString(x + cancel_cols[3]/2, y_position - 9, nro_doc_padded[:15])
                x += cancel_cols[3]
                
                # ESTADO
                c.rect(x, y_position - 12, cancel_cols[4], 12, fill=0, stroke=1)
                estado_civil = prop.get('estado_civil', '')
                c.drawCentredString(x + cancel_cols[4]/2, y_position - 9, estado_civil[:10])
                y_position -= 12
        else:
            # Sin propietario
            verificar_espacio(15)
            x = MARGIN_LEFT
            
            c.rect(x, y_position - 12, cancel_cols[0], 12, fill=0, stroke=1)
            c.setFont(font_normal, fuente_tabla - 2)
            c.drawCentredString(x + cancel_cols[0]/2, y_position - 9, str(codigo_pred)[:30])
            x += cancel_cols[0]
            
            c.rect(x, y_position - 12, cancel_cols[1], 12, fill=0, stroke=1)
            c.setFont(font_normal, fuente_tabla - 1)
            c.drawCentredString(x + cancel_cols[1]/2, y_position - 9, solicitante_nombre[:40])
            x += cancel_cols[1]
            
            c.rect(x, y_position - 12, cancel_cols[2], 12, fill=0, stroke=1)
            c.drawCentredString(x + cancel_cols[2]/2, y_position - 9, "C")
            x += cancel_cols[2]
            
            c.rect(x, y_position - 12, cancel_cols[3], 12, fill=0, stroke=1)
            c.drawCentredString(x + cancel_cols[3]/2, y_position - 9, str(solicitante_documento)[:15])
            x += cancel_cols[3]
            
            c.rect(x, y_position - 12, cancel_cols[4], 12, fill=0, stroke=1)
            c.drawCentredString(x + cancel_cols[4]/2, y_position - 9, "")
            y_position -= 12
        
        y_position -= 5
        
        # TABLA DATOS DEL PREDIO - IGUAL A M5
        verificar_espacio(30)
        
        predio_cols = [CONTENT_WIDTH * 0.15, CONTENT_WIDTH * 0.17, CONTENT_WIDTH * 0.06, CONTENT_WIDTH * 0.18, CONTENT_WIDTH * 0.14, CONTENT_WIDTH * 0.15, CONTENT_WIDTH * 0.15]
        predio_headers = ["CÓD. HOMOLOGADO", "DIRECCIÓN", "DES", "A-TERRENO", "A-CONS", "AVALÚO", "VIG. FISCAL"]
        
        # Headers
        c.setFillColor(colors.HexColor('#e8e8e8'))
        c.rect(MARGIN_LEFT, y_position - 12, CONTENT_WIDTH, 12, fill=1, stroke=1)
        c.setFillColor(NEGRO)
        c.setFont(font_bold, fuente_tabla - 1)
        
        x = MARGIN_LEFT
        for i, header in enumerate(predio_headers):
            c.drawCentredString(x + predio_cols[i]/2, y_position - 9, header)
            c.rect(x, y_position - 12, predio_cols[i], 12, fill=0, stroke=1)
            x += predio_cols[i]
        y_position -= 12
        
        # Datos del predio
        verificar_espacio(15)
        c.setFont(font_normal, fuente_tabla - 2)
        
        p_codigo_hom = predio_data.get('codigo_homologado', codigo_homologado)
        p_direccion = predio_data.get('direccion', direccion)
        p_destino = predio_data.get('destino_economico', destino_economico)
        p_area_terreno = area_terreno_val if area_terreno_val is not None else predio_data.get('area_terreno', 0)
        p_area_construida = area_construida_val if area_construida_val is not None else predio_data.get('area_construida', 0)
        p_avaluo = avaluo_val if avaluo_val is not None else predio_data.get('avaluo', predio_data.get('avaluo_catastral', 0))
        vigencia_fiscal = f"01/01/{vigencia or fecha_actual.year}"
        
        x = MARGIN_LEFT
        
        # CÓD. HOMOLOGADO
        c.rect(x, y_position - 12, predio_cols[0], 12, fill=0, stroke=1)
        c.drawCentredString(x + predio_cols[0]/2, y_position - 9, str(p_codigo_hom)[:12] if p_codigo_hom else "")
        x += predio_cols[0]
        
        # DIRECCIÓN
        c.rect(x, y_position - 12, predio_cols[1], 12, fill=0, stroke=1)
        c.drawCentredString(x + predio_cols[1]/2, y_position - 9, str(p_direccion)[:15] if p_direccion else "")
        x += predio_cols[1]
        
        # DES
        c.rect(x, y_position - 12, predio_cols[2], 12, fill=0, stroke=1)
        c.drawCentredString(x + predio_cols[2]/2, y_position - 9, str(p_destino)[:1] if p_destino else "A")
        x += predio_cols[2]
        
        # A-TERRENO
        c.rect(x, y_position - 12, predio_cols[3], 12, fill=0, stroke=1)
        c.drawCentredString(x + predio_cols[3]/2, y_position - 9, formatear_area(p_area_terreno))
        x += predio_cols[3]
        
        # A-CONS
        c.rect(x, y_position - 12, predio_cols[4], 12, fill=0, stroke=1)
        c.drawCentredString(x + predio_cols[4]/2, y_position - 9, formatear_area(p_area_construida))
        x += predio_cols[4]
        
        # AVALÚO
        c.rect(x, y_position - 12, predio_cols[5], 12, fill=0, stroke=1)
        c.drawCentredString(x + predio_cols[5]/2, y_position - 9, formatear_moneda(p_avaluo)[:12])
        x += predio_cols[5]
        
        # VIG. FISCAL
        c.rect(x, y_position - 12, predio_cols[6], 12, fill=0, stroke=1)
        c.drawCentredString(x + predio_cols[6]/2, y_position - 9, vigencia_fiscal)
        y_position -= 12
        
        # FILA MATRÍCULA INMOBILIARIA - IGUAL A M5
        verificar_espacio(15)
        p_matricula = predio_data.get('matricula_inmobiliaria', matricula)
        
        c.setFillColor(colors.HexColor('#e8e8e8'))
        c.rect(MARGIN_LEFT, y_position - 12, CONTENT_WIDTH * 0.3, 12, fill=1, stroke=1)
        c.setFillColor(NEGRO)
        c.setFont(font_bold, fuente_tabla - 1)
        c.drawCentredString(MARGIN_LEFT + (CONTENT_WIDTH * 0.3)/2, y_position - 9, "MATRÍCULA INMOBILIARIA")
        
        c.setFont(font_normal, fuente_tabla)
        c.rect(MARGIN_LEFT + CONTENT_WIDTH * 0.3, y_position - 12, CONTENT_WIDTH * 0.7, 12, fill=0, stroke=1)
        c.drawCentredString(MARGIN_LEFT + CONTENT_WIDTH * 0.3 + (CONTENT_WIDTH * 0.7)/2, y_position - 9, str(p_matricula))
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
    
    # Fecha de resolución
    c.setFont(font_bold, 10)
    c.drawCentredString(PAGE_WIDTH/2, y_position, f"FECHA RESOLUCIÓN: {fecha_resolucion}")
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
    
    # Si hay texto personalizado de considerandos, usarlo
    if texto_considerando_personalizado:
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
        c.setFillColor(NEGRO)
        dibujar_texto_justificado(texto_procesado)
        y_position -= 15
    else:
        # Usar plantilla estándar
        c.setFillColor(NEGRO)
        dibujar_texto_justificado(plantilla["considerando_intro"])
        y_position -= 10
        
        # Solicitud
        texto_solicitud = plantilla["considerando_solicitud"].format(radicado=radicado)
        dibujar_texto_justificado(texto_solicitud)
        y_position -= 10
        
        # Documentos
        texto_documentos = plantilla["considerando_documentos"].format(documentos_soporte=documentos_soporte)
        dibujar_texto_justificado(texto_documentos)
        y_position -= 10
        
        # Estudio
        texto_estudio = plantilla["considerando_estudio"].format(codigo_predial=codigo_predial)
        dibujar_texto_justificado(texto_estudio)
        y_position -= 10
        
        # Legal
        dibujar_texto_justificado(plantilla["considerando_legal"])
        y_position -= 10
        
        # Base
        dibujar_texto_justificado(plantilla["considerando_base"])
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
    
    # Tabla CANCELACIÓN (Datos anteriores)
    y_position = dibujar_tabla_predio_complementacion(
        predio, 
        es_cancelacion=True, 
        vigencia=vigencia_cancelacion,
        area_terreno_val=area_terreno,
        area_construida_val=area_construida,
        avaluo_val=avaluo
    )
    y_position -= 10
    
    # Tabla INSCRIPCIÓN (Datos nuevos/complementados)
    y_position = dibujar_tabla_predio_complementacion(
        predio, 
        es_cancelacion=False, 
        vigencia=vigencia_inscripcion,
        area_terreno_val=area_terreno_nueva,
        area_construida_val=area_construida_nueva,
        avaluo_val=avaluo_nuevo
    )
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
    y_position -= 20
    
    # ==========================================
    # CIERRE Y FIRMA + QR (IDÉNTICO A M5)
    # ==========================================
    verificar_espacio(150)
    
    # Cierre
    c.setFont(font_bold, 11)
    c.drawCentredString(PAGE_WIDTH/2, y_position, plantilla["cierre"])
    y_position -= 20
    
    # Fecha textual
    c.setFont(font_normal, 10)
    c.drawCentredString(PAGE_WIDTH/2, y_position, fecha_texto)
    y_position -= 30
    
    # === CALCULAR POSICIONES PARA FIRMA Y QR LADO A LADO (IGUAL A M5) ===
    firma_block_width = 200
    verif_block_width = 185
    gap_between = 20
    
    total_blocks_width = firma_block_width + gap_between + verif_block_width
    start_x = MARGIN_LEFT + (CONTENT_WIDTH - total_blocks_width) / 2
    
    block_height = 90
    block_y = y_position - block_height
    
    # === BLOQUE IZQUIERDO: FIRMA DE DALGIE ===
    firma_center_x = start_x + firma_block_width / 2
    
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
    
    # === BLOQUE DERECHO: CUADRO DE VERIFICACIÓN (IDÉNTICO A M5) ===
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
        
        # QR dentro del marco
        qr_size = 46
        c.drawImage(qr_image, marco_x + 5, marco_y + 6, width=qr_size, height=qr_size, mask='auto')
        
        # Información de verificación
        info_x = marco_x + 55
        
        # Título
        c.setFillColor(VERDE_INSTITUCIONAL)
        c.setFont(font_bold, 8)
        c.drawString(info_x, marco_y + marco_height - 11, "RESOLUCIÓN VERIFICABLE")
        
        # Código de verificación
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
    
    # === ELABORÓ / APROBÓ ===
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
generate_complementacion_resolution_pdf = generar_resolucion_complementacion_pdf
