"""
Generador de PDF de Resolución Catastral - Mutación Segunda (M2)
Englobe y Desengloble de terrenos
Incluye encabezado y pie de página institucional idénticos al M1
"""
import io
import os
import base64
import hashlib
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

# Configuración de página
PAGE_WIDTH, PAGE_HEIGHT = letter
MARGIN_LEFT = 2.0 * cm
MARGIN_RIGHT = 2.0 * cm
MARGIN_TOP = 2.8 * cm  # Espacio para encabezado
MARGIN_BOTTOM = 2.5 * cm  # Espacio para pie de página
CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT

# Colores institucionales
VERDE_INSTITUCIONAL = colors.HexColor('#009846')
NEGRO = colors.HexColor('#000000')
BLANCO = colors.HexColor('#FFFFFF')


def get_m2_plantilla():
    """Retorna la plantilla de textos para M2 - Desengloble/Englobe"""
    return {
        "titulo_desengloble": "POR LA CUAL SE ORDENAN UNOS CAMBIOS EN EL CATASTRO DEL MUNICIPIO DE {municipio} Y SE RESUELVE UN DESENGLOBE DE TERRENO",
        "titulo_englobe": "POR LA CUAL SE ORDENAN UNOS CAMBIOS EN EL CATASTRO DEL MUNICIPIO DE {municipio} Y SE RESUELVE UN ENGLOBE DE TERRENO",
        "preambulo": (
            "La Asociación de Municipios del Catatumbo, Provincia de Ocaña y Sur del Cesar – Asomunicipios "
            "en uso de sus facultades legales otorgadas por la Resolución IGAC 1204 del 2021, en "
            "concordancia con la Ley 14 de 1983, el Decreto 148 de 2020 y la Resolución 1040 de 2023 del "
            "Instituto Geográfico Agustín Codazzi \"Por medio de la cual se expide la resolución única de la "
            "gestión catastral multipropósito\", y"
        ),
        "considerando_intro": (
            "Qué, el señor {solicitante_nombre}, identificado con la Cédula de Ciudadanía No. {solicitante_documento}, "
            "en su condición de propietario de un predio que hace parte de uno de mayor "
            "extensión identificado con el código catastral {codigo_origen}, del Municipio de {municipio}, "
            "radicó con el número {radicado}, ante el Gestor catastral de Asociación de Municipios del Catatumbo, "
            "Provincia de Ocaña y Sur del Cesar – Asomunicipios, una solicitud de trámite catastral "
            "con Radicado {radicado} y soportado en los siguientes documentos justificativos:"
        ),
        "documentos_soporte": [
            "Fotocopia cédula de ciudadanía del propietario.",
            "Escritura pública.",
            "Matrícula inmobiliaria {matricula}.",
            "Plano del predio en formato DWG."
        ],
        "considerando_estudio_desengloble": (
            "Qué, con base en los documentos aportados y lo dispuesto por las normas anteriormente "
            "mencionadas, realizado el respectivo estudio de oficina y visita al predio, se procede hacer "
            "mutación de segunda desenglobe al predio matriz identificado con el NPN {npn_origen}."
        ),
        "considerando_estudio_englobe": (
            "Qué, con base en los documentos aportados y lo dispuesto por las normas anteriormente "
            "mencionadas, realizado el respectivo estudio de oficina y visita al predio, se procede hacer "
            "mutación de segunda englobe a los predios identificados."
        ),
        "considerando_final": (
            "Qué, en consecuencia, procede una mutación de segunda y su correspondiente inscripción en el "
            "catastro, conforme lo indican el Literal C del Artículo 2.2.2.2.2 del Decreto 148 de 2020, el Artículo "
            "4.5.1, 4.5.2, 4.6.3, y 4.7.13 de la Resolución 1040 de 2023, y lo preceptuado en la resolución sobre "
            "los requisitos para trámites y otros procedimientos administrativos."
        ),
        "articulo_1": "Ordenar la inscripción en el catastro del Municipio de {municipio} los siguientes cambios:",
        "articulo_2": "De conformidad con lo dispuesto en el artículo 4.8.2 de la resolución 1040 de 2023 y el artículo 70 de la ley 1437 de 2011, el presente acto administrativo rige a partir de la fecha de su expedición.",
        "articulo_3": "Los avalúos inscritos con posterioridad al primero de enero tendrán vigencia fiscal para el año siguiente, ajustados con el índice que determine el gobierno nacional, de conformidad a lo expuesto en los artículos 4.7.13 y 4.7.14 de la resolución 1040 de 2023.",
        "articulo_4": "Contra el presente acto administrativo no procede recurso alguno.",
        "cierre": "COMUNÍQUESE, NOTIFÍQUESE Y CÚMPLASE",
        "firmante_nombre": "DALGIE ESPERANZA TORRADO RIZO",
        "firmante_cargo": "SUBDIRECTORA FINANCIERA Y ADMINISTRATIVA"
    }


def generate_resolucion_m2_pdf(
    numero_resolucion: str,
    fecha_resolucion: str,
    municipio: str,
    subtipo: str,  # 'desengloble' o 'englobe'
    radicado: str,
    solicitante: dict,  # {nombre, documento, tipo_documento}
    predios_cancelados: list,  # Lista de predios a cancelar
    predios_inscritos: list,   # Lista de predios a inscribir
    documentos_soporte: list = None,
    codigo_verificacion: str = None,
    verificacion_base_url: str = None,
    imagen_encabezado_b64: str = None,
    imagen_pie_b64: str = None,
    imagen_firma_b64: str = None,
    elaboro: str = "",
    aprobo: str = "",
) -> bytes:
    """
    Genera un PDF de resolución M2 (Englobe/Desengloble)
    Con encabezado y pie de página institucional idénticos al M1
    """
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    
    plantilla = get_m2_plantilla()
    
    # Helper para formatear área con unidades de medida
    def formatear_area(area_valor):
        """Formatear área con formato colombiano: punto para miles, coma para decimales"""
        try:
            area = float(area_valor or 0)
            # Formato colombiano: 1.044,70 m²
            parte_entera = int(area)
            parte_decimal = area - parte_entera
            
            # Formatear parte entera con puntos como separador de miles
            parte_entera_str = f"{parte_entera:,}".replace(",", ".")
            
            # Formatear parte decimal con coma (2 decimales)
            parte_decimal_str = f"{parte_decimal:.2f}"[1:].replace(".", ",")
            
            return f"{parte_entera_str}{parte_decimal_str} m²"
        except:
            return str(area_valor or "0")
    
    # Registrar fuentes
    try:
        pdfmetrics.registerFont(TTFont('Carlito', '/usr/share/fonts/truetype/crosextra/Carlito-Regular.ttf'))
        pdfmetrics.registerFont(TTFont('Carlito-Bold', '/usr/share/fonts/truetype/crosextra/Carlito-Bold.ttf'))
        font_normal = 'Carlito'
        font_bold = 'Carlito-Bold'
    except Exception:
        font_normal = 'Helvetica'
        font_bold = 'Helvetica-Bold'
    
    y_position = PAGE_HEIGHT - MARGIN_TOP
    page_number = 1
    
    # Cargar imágenes
    encabezado_img = None
    pie_pagina_img = None
    logo_watermark = None
    
    try:
        if imagen_encabezado_b64:
            encabezado_img = ImageReader(io.BytesIO(base64.b64decode(imagen_encabezado_b64)))
        else:
            encabezado_img = ImageReader(get_encabezado_image())
    except Exception as e:
        print(f"Error cargando encabezado: {e}")
    
    try:
        if imagen_pie_b64:
            pie_pagina_img = ImageReader(io.BytesIO(base64.b64decode(imagen_pie_b64)))
        else:
            pie_pagina_img = ImageReader(get_pie_pagina_image())
    except Exception as e:
        print(f"Error cargando pie de página: {e}")
    
    try:
        logo_path = "/app/frontend/public/watermark-gray.png"
        if os.path.exists(logo_path):
            logo_watermark = ImageReader(logo_path)
    except Exception as e:
        print(f"Error cargando marca de agua: {e}")
    
    def draw_watermark():
        """Dibuja la marca de agua con el logo de Asomunicipios"""
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
    
    def draw_header():
        """Dibuja el encabezado institucional idéntico al M1"""
        nonlocal y_position
        # Marca de agua
        draw_watermark()
        
        if encabezado_img:
            encabezado_width = CONTENT_WIDTH + 1 * cm
            encabezado_height = 2.0 * cm
            encabezado_x = MARGIN_LEFT - 0.5 * cm
            encabezado_y = PAGE_HEIGHT - 2.2 * cm
            c.drawImage(encabezado_img, encabezado_x, encabezado_y, 
                        width=encabezado_width, height=encabezado_height, 
                        preserveAspectRatio=True, mask='auto')
        else:
            c.setFillColor(VERDE_INSTITUCIONAL)
            c.setFont(font_bold, 14)
            c.drawCentredString(PAGE_WIDTH/2, PAGE_HEIGHT - 1.5 * cm, "ASOMUNICIPIOS - Gestor Catastral")
        
        y_position = PAGE_HEIGHT - 2.8 * cm
        return y_position
    
    def draw_footer():
        """Dibuja el pie de página institucional idéntico al M1"""
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
        """Dibuja texto justificado (alineado a ambos márgenes) con límite de espaciado"""
        nonlocal y_position
        fname = font_name or font_normal
        c.setFont(fname, font_size)
        lines = simpleSplit(texto, fname, font_size, CONTENT_WIDTH)
        
        # Calcular espacio normal de referencia
        espacio_normal = c.stringWidth(' ', fname, font_size)
        # Límite máximo de espacio entre palabras (máx 3x el espacio normal)
        max_space = espacio_normal * 3
        
        for i, line in enumerate(lines):
            verificar_espacio(line_height)
            
            # Si es la última línea o línea corta, no justificar (alinear a la izquierda)
            line_width = c.stringWidth(line, fname, font_size)
            if i == len(lines) - 1 or line_width < CONTENT_WIDTH * 0.75:
                c.drawString(MARGIN_LEFT, y_position, line)
            else:
                # Justificar: distribuir espacios extra entre palabras
                words = line.split(' ')
                if len(words) > 1:
                    # Calcular el ancho total de las palabras sin espacios
                    total_words_width = sum(c.stringWidth(word, fname, font_size) for word in words)
                    # Espacio total disponible para distribuir
                    total_space = CONTENT_WIDTH - total_words_width
                    # Espacio entre cada palabra
                    space_width = total_space / (len(words) - 1)
                    
                    # Limitar el espacio máximo para evitar texto "estirado"
                    if space_width > max_space:
                        # Si el espacio es excesivo, usar alineación normal
                        c.drawString(MARGIN_LEFT, y_position, line)
                    else:
                        # Dibujar cada palabra con el espaciado calculado
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
    
    # =====================
    # PÁGINA 1 - ENCABEZADO
    # =====================
    
    # Dibujar encabezado institucional
    y_position = draw_header()
    
    # Número de resolución y fecha
    c.setFillColor(NEGRO)
    c.setFont(font_bold, 11)
    c.drawCentredString(PAGE_WIDTH/2, y_position, f"RESOLUCIÓN No: {numero_resolucion}")
    y_position -= 14
    c.drawCentredString(PAGE_WIDTH/2, y_position, f"FECHA RESOLUCIÓN: {fecha_resolucion}")
    y_position -= 20
    
    # Título
    titulo = plantilla["titulo_desengloble" if subtipo == "desengloble" else "titulo_englobe"].format(municipio=municipio.upper())
    c.setFont(font_bold, 10)
    lines = simpleSplit(titulo, font_bold, 10, CONTENT_WIDTH)
    for line in lines:
        c.drawCentredString(PAGE_WIDTH/2, y_position, line)
        y_position -= 14
    y_position -= 10
    
    # Preámbulo
    c.setFont(font_normal, 10)
    dibujar_texto_justificado(plantilla["preambulo"], font_size=10)
    y_position -= 15
    
    # CONSIDERANDO
    dibujar_seccion_titulo("CONSIDERANDO")
    
    # Considerando intro
    codigo_origen = predios_cancelados[0].get("codigo_predial") or predios_cancelados[0].get("codigo_predial_nacional", "") if predios_cancelados else ""
    npn_origen = predios_cancelados[0].get("npn", "") if predios_cancelados else ""
    matricula_origen = predios_cancelados[0].get("matricula_inmobiliaria", "") if predios_cancelados else ""
    
    considerando_intro = plantilla["considerando_intro"].format(
        solicitante_nombre=solicitante.get("nombre", ""),
        solicitante_documento=solicitante.get("documento", ""),
        municipio=municipio,
        codigo_origen=codigo_origen,
        radicado=radicado
    )
    dibujar_texto_justificado(considerando_intro, font_size=10)
    y_position -= 10
    
    # Documentos soporte (bullets)
    # Obtener las matrículas de los predios a inscribir (los nuevos)
    matriculas_inscritos = []
    for predio in predios_inscritos:
        mat = predio.get("matricula_inmobiliaria", "")
        if mat and mat not in matriculas_inscritos:
            matriculas_inscritos.append(mat)
    matriculas_texto = ", ".join(matriculas_inscritos) if matriculas_inscritos else matricula_origen
    
    c.setFont(font_normal, 10)
    for doc in plantilla["documentos_soporte"]:
        verificar_espacio(20)
        doc_formateado = doc.format(
            matricula=matriculas_texto
        )
        c.drawString(MARGIN_LEFT + 10, y_position, f"• {doc_formateado}")
        y_position -= 14
    y_position -= 10
    
    # Considerando estudio
    if subtipo == "desengloble":
        considerando_estudio = plantilla["considerando_estudio_desengloble"].format(
            codigo_origen=codigo_origen,
            npn_origen=npn_origen
        )
    else:
        considerando_estudio = plantilla["considerando_estudio_englobe"]
    dibujar_texto_justificado(considerando_estudio, font_size=10)
    y_position -= 10
    
    # Considerando final
    dibujar_texto_justificado(plantilla["considerando_final"], font_size=10)
    y_position -= 15
    
    # RESUELVE
    dibujar_seccion_titulo("RESUELVE")
    
    # Artículo 1
    c.setFont(font_bold, 10)
    c.drawString(MARGIN_LEFT, y_position, "Artículo 1.")
    c.setFont(font_normal, 10)
    art1_texto = plantilla["articulo_1"].format(municipio=municipio)
    c.drawString(MARGIN_LEFT + 55, y_position, art1_texto)
    y_position -= 20
    
    # =====================
    # TABLA DE PREDIOS
    # =====================
    
    def dibujar_predio(predio, tipo="C"):
        """Dibuja un predio en formato tabla. tipo: C=Cancelación, I=Inscripción"""
        nonlocal y_position
        
        verificar_espacio(120)  # Espacio mínimo para un predio
        
        # Encabezado de sección con color verde institucional
        if tipo == "C":
            c.setFillColor(VERDE_INSTITUCIONAL)
            c.rect(MARGIN_LEFT, y_position - 12, CONTENT_WIDTH, 15, fill=1, stroke=0)
            c.setFillColor(BLANCO)
            c.setFont(font_bold, 10)
            c.drawCentredString(PAGE_WIDTH/2, y_position - 9, "CANCELACIÓN")
        else:
            c.setFillColor(VERDE_INSTITUCIONAL)
            c.rect(MARGIN_LEFT, y_position - 12, CONTENT_WIDTH, 15, fill=1, stroke=0)
            c.setFillColor(BLANCO)
            c.setFont(font_bold, 10)
            c.drawCentredString(PAGE_WIDTH/2, y_position - 9, "INSCRIPCIÓN")
        y_position -= 20
        
        c.setFillColor(NEGRO)
        
        # Headers de la tabla
        c.setFillColor(colors.HexColor('#e8e8e8'))
        c.rect(MARGIN_LEFT, y_position - 12, CONTENT_WIDTH, 12, fill=1, stroke=1)
        c.setFillColor(NEGRO)
        c.setFont(font_bold, 7)
        
        # Definir columnas
        col_widths = [CONTENT_WIDTH * 0.32, CONTENT_WIDTH * 0.30, CONTENT_WIDTH * 0.10, CONTENT_WIDTH * 0.18, CONTENT_WIDTH * 0.10]
        headers = ["N° PREDIAL", "APELLIDOS Y NOMBRES", "TIPO DOC.", "NRO. DOC.", "DESTINO"]
        x = MARGIN_LEFT
        for i, header in enumerate(headers):
            c.drawCentredString(x + col_widths[i]/2, y_position - 9, header)
            c.rect(x, y_position - 12, col_widths[i], 12, fill=0, stroke=1)
            x += col_widths[i]
        y_position -= 12
        
        # Datos del propietario
        c.setFont(font_normal, 7)
        propietario = predio.get("propietarios", [{}])[0]
        nombre_prop = propietario.get("nombre_propietario", propietario.get("nombre", ""))[:40]
        tipo_doc = propietario.get("tipo_documento", "CC")
        nro_doc = str(propietario.get("numero_documento", propietario.get("documento", ""))).zfill(10)
        destino = predio.get("destino_economico", "R")
        codigo_predial = (predio.get("codigo_predial") or predio.get("codigo_predial_nacional") or predio.get("npn", ""))[:30]
        
        # Fila de datos
        x = MARGIN_LEFT
        c.rect(x, y_position - 12, col_widths[0], 12, fill=0, stroke=1)
        c.setFont(font_normal, 6)
        c.drawCentredString(x + col_widths[0]/2, y_position - 9, codigo_predial)
        x += col_widths[0]
        
        c.setFont(font_normal, 7)
        c.rect(x, y_position - 12, col_widths[1], 12, fill=0, stroke=1)
        c.drawCentredString(x + col_widths[1]/2, y_position - 9, nombre_prop[:28])
        x += col_widths[1]
        
        c.rect(x, y_position - 12, col_widths[2], 12, fill=0, stroke=1)
        c.drawCentredString(x + col_widths[2]/2, y_position - 9, tipo_doc)
        x += col_widths[2]
        
        c.rect(x, y_position - 12, col_widths[3], 12, fill=0, stroke=1)
        c.drawCentredString(x + col_widths[3]/2, y_position - 9, nro_doc[:15])
        x += col_widths[3]
        
        c.rect(x, y_position - 12, col_widths[4], 12, fill=0, stroke=1)
        c.drawCentredString(x + col_widths[4]/2, y_position - 9, destino)
        y_position -= 12
        
        # Fila de datos del predio: Código homologado, Dirección, Área Terreno, Área Construida, Avalúo
        c.setFillColor(colors.HexColor('#e8e8e8'))
        c.rect(MARGIN_LEFT, y_position - 12, CONTENT_WIDTH, 12, fill=1, stroke=1)
        c.setFillColor(NEGRO)
        c.setFont(font_bold, 7)
        
        col_widths2 = [CONTENT_WIDTH * 0.15, CONTENT_WIDTH * 0.25, CONTENT_WIDTH * 0.15, CONTENT_WIDTH * 0.15, CONTENT_WIDTH * 0.15, CONTENT_WIDTH * 0.15]
        headers2 = ["CÓD. HOMOLOGADO", "DIRECCIÓN", "A-TERRENO", "A-CONS", "AVALÚO", "VIG. FISCAL"]
        x = MARGIN_LEFT
        for i, header in enumerate(headers2):
            c.drawCentredString(x + col_widths2[i]/2, y_position - 9, header)
            c.rect(x, y_position - 12, col_widths2[i], 12, fill=0, stroke=1)
            x += col_widths2[i]
        y_position -= 12
        
        # Valores
        c.setFont(font_normal, 7)
        codigo_hom = predio.get("codigo_homologado", "")
        direccion = predio.get("direccion", "")[:20]
        area_terreno = predio.get("area_terreno", 0)
        area_construida = predio.get("area_construida", 0)
        avaluo = predio.get("avaluo", 0)
        
        # Formatear áreas con unidades
        area_terreno_fmt = formatear_area(area_terreno)
        area_construida_fmt = formatear_area(area_construida)
        
        x = MARGIN_LEFT
        c.rect(x, y_position - 12, col_widths2[0], 12, fill=0, stroke=1)
        c.drawCentredString(x + col_widths2[0]/2, y_position - 9, codigo_hom[:12])
        x += col_widths2[0]
        
        c.rect(x, y_position - 12, col_widths2[1], 12, fill=0, stroke=1)
        c.drawCentredString(x + col_widths2[1]/2, y_position - 9, direccion)
        x += col_widths2[1]
        
        c.rect(x, y_position - 12, col_widths2[2], 12, fill=0, stroke=1)
        c.setFont(font_normal, 5)  # Reducir tamaño para que quepa
        c.drawCentredString(x + col_widths2[2]/2, y_position - 9, area_terreno_fmt)
        x += col_widths2[2]
        
        c.rect(x, y_position - 12, col_widths2[3], 12, fill=0, stroke=1)
        c.drawCentredString(x + col_widths2[3]/2, y_position - 9, area_construida_fmt)
        c.setFont(font_normal, 7)  # Restaurar tamaño
        x += col_widths2[3]
        
        c.rect(x, y_position - 12, col_widths2[4], 12, fill=0, stroke=1)
        c.drawCentredString(x + col_widths2[4]/2, y_position - 9, f"${avaluo:,.0f}".replace(",", "."))
        x += col_widths2[4]
        
        c.rect(x, y_position - 12, col_widths2[5], 12, fill=0, stroke=1)
        c.drawCentredString(x + col_widths2[5]/2, y_position - 9, "01/01/2026")
        y_position -= 12
        
        # Fila de Matrícula inmobiliaria
        c.setFillColor(colors.HexColor('#e8e8e8'))
        c.rect(MARGIN_LEFT, y_position - 12, CONTENT_WIDTH * 0.3, 12, fill=1, stroke=1)
        c.setFillColor(NEGRO)
        c.setFont(font_bold, 7)
        c.drawCentredString(MARGIN_LEFT + (CONTENT_WIDTH * 0.3)/2, y_position - 9, "MATRÍCULA INMOBILIARIA")
        c.setFont(font_normal, 7)
        c.rect(MARGIN_LEFT + CONTENT_WIDTH * 0.3, y_position - 12, CONTENT_WIDTH * 0.7, 12, fill=0, stroke=1)
        c.drawCentredString(MARGIN_LEFT + CONTENT_WIDTH * 0.3 + (CONTENT_WIDTH * 0.7)/2, y_position - 9, predio.get("matricula_inmobiliaria", ""))
        y_position -= 15
        
        # =====================
        # FECHAS DE INSCRIPCIÓN CATASTRAL (si existen)
        # =====================
        fechas_inscripcion = predio.get("fechas_inscripcion", [])
        if fechas_inscripcion and len(fechas_inscripcion) > 0:
            verificar_espacio(40 + len(fechas_inscripcion) * 12)
            
            # Título de la sección
            c.setFillColor(colors.HexColor('#e8f5e9'))  # Verde claro
            c.rect(MARGIN_LEFT, y_position - 12, CONTENT_WIDTH, 12, fill=1, stroke=1)
            c.setFillColor(NEGRO)
            c.setFont(font_bold, 7)
            c.drawCentredString(PAGE_WIDTH/2, y_position - 9, "VIGENCIAS FISCALES DE INSCRIPCIÓN")
            y_position -= 12
            
            # Headers de la tabla de vigencias
            c.setFillColor(colors.HexColor('#e8e8e8'))
            c.rect(MARGIN_LEFT, y_position - 12, CONTENT_WIDTH, 12, fill=1, stroke=1)
            c.setFillColor(NEGRO)
            c.setFont(font_bold, 7)
            
            col_widths_vig = [CONTENT_WIDTH * 0.25, CONTENT_WIDTH * 0.35, CONTENT_WIDTH * 0.40]
            headers_vig = ["AÑO VIGENCIA", "AVALÚO CATASTRAL", "FUENTE"]
            x = MARGIN_LEFT
            for i, header in enumerate(headers_vig):
                c.drawCentredString(x + col_widths_vig[i]/2, y_position - 9, header)
                c.rect(x, y_position - 12, col_widths_vig[i], 12, fill=0, stroke=1)
                x += col_widths_vig[i]
            y_position -= 12
            
            # Filas de datos de vigencias
            c.setFont(font_normal, 7)
            for fecha in fechas_inscripcion:
                año = str(fecha.get("año", ""))
                avaluo_fecha = fecha.get("avaluo", 0)
                fuente = fecha.get("avaluo_source", "manual")
                
                # Formatear avalúo
                try:
                    avaluo_fmt = f"${float(avaluo_fecha):,.0f}".replace(",", ".")
                except:
                    avaluo_fmt = str(avaluo_fecha)
                
                # Traducir fuente
                fuente_texto = {
                    "manual": "Ingreso manual",
                    "sistema": "Sistema catastral",
                    "actual": "Vigencia actual"
                }.get(fuente, fuente)
                
                x = MARGIN_LEFT
                c.rect(x, y_position - 12, col_widths_vig[0], 12, fill=0, stroke=1)
                c.drawCentredString(x + col_widths_vig[0]/2, y_position - 9, año)
                x += col_widths_vig[0]
                
                c.rect(x, y_position - 12, col_widths_vig[1], 12, fill=0, stroke=1)
                c.drawCentredString(x + col_widths_vig[1]/2, y_position - 9, avaluo_fmt)
                x += col_widths_vig[1]
                
                c.rect(x, y_position - 12, col_widths_vig[2], 12, fill=0, stroke=1)
                c.drawCentredString(x + col_widths_vig[2]/2, y_position - 9, fuente_texto[:25])
                y_position -= 12
            
            y_position -= 5  # Espacio adicional después de las vigencias
        
        y_position -= 5  # Espacio entre predios
    
    # Dibujar predios cancelados
    for predio in predios_cancelados:
        dibujar_predio(predio, "C")
    
    # Dibujar predios inscritos
    for predio in predios_inscritos:
        dibujar_predio(predio, "I")
    
    # =====================
    # ARTÍCULOS FINALES
    # =====================
    verificar_espacio(100)
    y_position -= 20
    
    # Artículo 2
    c.setFont(font_bold, 10)
    c.drawString(MARGIN_LEFT, y_position, "Artículo 2.")
    y_position -= 14
    dibujar_texto_justificado(plantilla["articulo_2"], font_size=10)
    y_position -= 10
    
    # Artículo 3
    c.setFont(font_bold, 10)
    c.drawString(MARGIN_LEFT, y_position, "Artículo 3.")
    y_position -= 14
    dibujar_texto_justificado(plantilla["articulo_3"], font_size=10)
    y_position -= 10
    
    # Artículo 4
    c.setFont(font_bold, 10)
    c.drawString(MARGIN_LEFT, y_position, "Artículo 4.")
    y_position -= 14
    dibujar_texto_justificado(plantilla["articulo_4"], font_size=10)
    y_position -= 20
    
    # CIERRE
    verificar_espacio(50)
    c.setFont(font_bold, 11)
    c.drawCentredString(PAGE_WIDTH/2, y_position, plantilla["cierre"])
    y_position -= 20
    
    # Fecha de expedición
    verificar_espacio(20)
    c.setFont(font_bold, 9)
    meses_may = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 
                 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
    fecha_actual = datetime.now()
    fecha_texto = f"DADA EN OCAÑA A LOS {fecha_actual.day} DÍAS DE {meses_may[fecha_actual.month-1]} DE {fecha_actual.year}"
    c.drawString(MARGIN_LEFT, y_position, fecha_texto)
    y_position -= 50
    
    # =====================
    # FIRMA Y QR
    # =====================
    verificar_espacio(120)
    
    # Cargar imagen de firma de Dalgie
    firma_dalgie = None
    try:
        firma_path = "/app/backend/logos/firma_dalgie_blanco.png"
        if os.path.exists(firma_path):
            firma_dalgie = ImageReader(firma_path)
        elif imagen_firma_b64:
            firma_dalgie = ImageReader(io.BytesIO(base64.b64decode(imagen_firma_b64)))
        else:
            firma_data = get_firma_dalgie_image()
            firma_dalgie = ImageReader(io.BytesIO(base64.b64decode(firma_data)))
    except Exception as e:
        print(f"Error cargando firma: {e}")
    
    # Generar QR de verificación
    qr_image = None
    fecha_hora_gen = datetime.now().strftime("%d/%m/%Y %H:%M")
    hash_doc = ""
    
    try:
        import qrcode
        
        base_url = verificacion_base_url or "https://certificados.asomunicipios.gov.co"
        
        if codigo_verificacion:
            qr_data = f"{base_url}/api/verificar/{codigo_verificacion}"
        else:
            qr_data = f"{base_url}/api/verificar-resolucion/{numero_resolucion}"
        
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=2,
        )
        qr.add_data(qr_data)
        qr.make(fit=True)
        
        qr_img = qr.make_image(fill_color="#009846", back_color="white")
        
        qr_buffer = io.BytesIO()
        qr_img.save(qr_buffer, format='PNG')
        qr_buffer.seek(0)
        qr_image = ImageReader(qr_buffer)
        
        hash_input = f"{predios_cancelados[0].get('npn', '') if predios_cancelados else ''}-{codigo_verificacion or numero_resolucion}-{fecha_hora_gen}"
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
