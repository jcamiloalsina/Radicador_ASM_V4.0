"""
Generador de PDF de Resolución Catastral - Mutación Segunda (M2)
Englobe y Desengloble de terrenos
"""
import io
import os
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
MARGIN_LEFT = 2.5 * cm
MARGIN_RIGHT = 2.5 * cm
MARGIN_TOP = 2 * cm
MARGIN_BOTTOM = 2.5 * cm
CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT


def get_m2_plantilla():
    """Retorna la plantilla de textos para M2 - Desengloble/Englobe"""
    return {
        "titulo_desengloble": "POR LA CUAL SE ORDENAN UNOS CAMBIOS EN EL CATASTRO DEL MUNICIPIO DE {municipio} Y SE RESUELVE UN DESENGLOBE DE TERRENO",
        "titulo_englobe": "POR LA CUAL SE ORDENAN UNOS CAMBIOS EN EL CATASTRO DEL MUNICIPIO DE {municipio} Y SE RESUELVE UN ENGLOBE DE TERRENO",
        "preambulo": (
            "La Asociación de Municipios del Catatumbo, Provincia de Ocaña y Sur del Cesar – Asomunicipios "
            "en uso de sus facultades legales otorgadas por la por la Resolución IGAC 1204 del 2021, en "
            "concordancia con la Ley 14 de 1983, el Decreto 148 de 2020 y la Resolución 1040 de 2023 del "
            "Instituto Geográfico Agustín Codazzi \"Por medio de la cual se expide la resolución única de la "
            "gestión catastral multipropósito\", y"
        ),
        "considerando_intro": (
            "Que el señor {solicitante_nombre}, identificado con la Cédula de Ciudadanía. No. {solicitante_documento} "
            "Expedida en {municipio}; en su condición de propietario de un predio que hace parte de uno de mayor "
            "extensión identificado con el código catastral {codigo_origen}, del Municipio de {municipio}, "
            "Radicó con el número {radicado}, ante el Gestor catastral de Asociación de Municipios del Catatumbo, "
            "Provincia de Ocaña y Sur del Cesar – Asomunicipios Catatumbo, una solicitud de trámite catastral "
            "con Radicado {radicado} y soportado en los siguientes documentos justificativos:"
        ),
        "documentos_soporte": [
            "Fotocopia cédula de ciudadanía del propietario.",
            "Escritura pública número {escritura} de fecha de {fecha_escritura} de la Notaria {notaria} y debidamente registrada en el folio de matrícula inmobiliaria del respectivo predio {matricula}.",
            "Constancia de calificación del folio de matrícula inmobiliaria {matricula}.",
            "Plano del predio en formato DWG."
        ],
        "considerando_estudio_desengloble": (
            "Que con base en los documentos aportados y lo dispuesto por las normas anteriormente "
            "mencionadas, realizado el respectivo estudio de oficina y visita al predio, se procede hacer "
            "mutación de segunda desenglobe al predio identificado con el No. {codigo_origen} y "
            "NPN {npn_origen}."
        ),
        "considerando_estudio_englobe": (
            "Que con base en los documentos aportados y lo dispuesto por las normas anteriormente "
            "mencionadas, realizado el respectivo estudio de oficina y visita al predio, se procede hacer "
            "mutación de segunda englobe a los predios identificados."
        ),
        "considerando_final": (
            "Que, en consecuencia, procede una mutación de segunda y su correspondiente inscripción en el "
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
) -> bytes:
    """
    Genera un PDF de resolución M2 (Englobe/Desengloble)
    """
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    
    plantilla = get_m2_plantilla()
    
    # Configuración de fuentes
    try:
        pdfmetrics.registerFont(TTFont('Arial', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
        pdfmetrics.registerFont(TTFont('Arial-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
    except:
        pass
    
    y_position = PAGE_HEIGHT - MARGIN_TOP
    page_number = 1
    total_pages = 1  # Se calculará después
    
    def nueva_pagina():
        nonlocal y_position, page_number
        # Pie de página
        c.setFont("Helvetica", 8)
        c.drawRightString(PAGE_WIDTH - MARGIN_RIGHT, MARGIN_BOTTOM - 0.5*cm, 
                         f"{page_number} | P á g i n a")
        c.showPage()
        page_number += 1
        y_position = PAGE_HEIGHT - MARGIN_TOP
        # Encabezado en nueva página
        dibujar_encabezado_simple()
    
    def verificar_espacio(necesario):
        nonlocal y_position
        if y_position - necesario < MARGIN_BOTTOM + 1*cm:
            nueva_pagina()
    
    def dibujar_encabezado_simple():
        nonlocal y_position
        # Número de resolución en esquina superior derecha
        c.setFont("Helvetica-Bold", 9)
        c.drawRightString(PAGE_WIDTH - MARGIN_RIGHT, PAGE_HEIGHT - MARGIN_TOP + 0.5*cm, 
                         numero_resolucion)
        y_position = PAGE_HEIGHT - MARGIN_TOP - 1*cm
    
    def dibujar_texto_justificado(texto, font_name="Helvetica", font_size=10, line_height=14):
        nonlocal y_position
        c.setFont(font_name, font_size)
        lines = simpleSplit(texto, font_name, font_size, CONTENT_WIDTH)
        for line in lines:
            verificar_espacio(line_height)
            c.drawString(MARGIN_LEFT, y_position, line)
            y_position -= line_height
    
    def dibujar_seccion_titulo(titulo):
        nonlocal y_position
        verificar_espacio(30)
        c.setFont("Helvetica-Bold", 11)
        c.drawCentredString(PAGE_WIDTH/2, y_position, titulo)
        y_position -= 20
    
    # =====================
    # PÁGINA 1 - ENCABEZADO
    # =====================
    
    # Logo/Encabezado
    try:
        if imagen_encabezado_b64:
            import base64
            encabezado_data = base64.b64decode(imagen_encabezado_b64)
            encabezado_img = ImageReader(io.BytesIO(encabezado_data))
        else:
            encabezado_b64 = get_encabezado_image()
            encabezado_data = __import__('base64').b64decode(encabezado_b64)
            encabezado_img = ImageReader(io.BytesIO(encabezado_data))
        c.drawImage(encabezado_img, MARGIN_LEFT, PAGE_HEIGHT - 3*cm, width=CONTENT_WIDTH, height=2.5*cm, preserveAspectRatio=True)
    except Exception as e:
        print(f"Error cargando encabezado: {e}")
    
    y_position = PAGE_HEIGHT - 4*cm
    
    # Número de resolución y fecha
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(PAGE_WIDTH - MARGIN_RIGHT, y_position + 2*cm, numero_resolucion)
    
    c.setFont("Helvetica-Bold", 11)
    c.drawString(MARGIN_LEFT, y_position, f"RESOLUCIÓN No: {numero_resolucion}")
    c.drawString(MARGIN_LEFT + 250, y_position, f"FECHA RESOLUCIÓN: {fecha_resolucion}")
    y_position -= 25
    
    # Título
    titulo = plantilla["titulo_desengloble" if subtipo == "desengloble" else "titulo_englobe"].format(municipio=municipio.upper())
    c.setFont("Helvetica-Bold", 10)
    lines = simpleSplit(titulo, "Helvetica-Bold", 10, CONTENT_WIDTH)
    for line in lines:
        c.drawCentredString(PAGE_WIDTH/2, y_position, line)
        y_position -= 14
    y_position -= 10
    
    # Preámbulo
    dibujar_texto_justificado(plantilla["preambulo"], font_size=10)
    y_position -= 15
    
    # CONSIDERANDO
    dibujar_seccion_titulo("C O N S I D E R A N D O")
    
    # Considerando intro
    codigo_origen = predios_cancelados[0]["codigo_predial"] if predios_cancelados else ""
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
    c.setFont("Helvetica", 10)
    for doc in plantilla["documentos_soporte"]:
        verificar_espacio(20)
        doc_formateado = doc.format(
            escritura="___",
            fecha_escritura="___",
            notaria="___",
            matricula=matricula_origen
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
    dibujar_seccion_titulo("R E S U E L V E:")
    
    # Artículo 1
    c.setFont("Helvetica-Bold", 10)
    c.drawString(MARGIN_LEFT, y_position, "Artículo 1.")
    c.setFont("Helvetica", 10)
    art1_texto = plantilla["articulo_1"].format(municipio=municipio)
    c.drawString(MARGIN_LEFT + 55, y_position, art1_texto)
    y_position -= 20
    
    # =====================
    # TABLA DE PREDIOS
    # =====================
    
    def dibujar_separador():
        nonlocal y_position
        verificar_espacio(15)
        c.setStrokeColor(colors.black)
        c.setLineWidth(0.5)
        c.line(MARGIN_LEFT, y_position, PAGE_WIDTH - MARGIN_RIGHT, y_position)
        y_position -= 5
    
    def dibujar_predio(predio, tipo="C"):
        """Dibuja un predio en formato tabla. tipo: C=Cancelación, I=Inscripción"""
        nonlocal y_position
        
        verificar_espacio(120)  # Espacio mínimo para un predio
        
        # Encabezado de sección
        c.setFont("Helvetica-Bold", 10)
        if tipo == "C":
            c.drawString(MARGIN_LEFT, y_position, "CANCELACIÓN")
        else:
            c.drawString(MARGIN_LEFT, y_position, "INSCRIPCIÓN")
        y_position -= 15
        
        # Fila 1: Art, C/I, N° Predial, Propietario
        c.setFont("Helvetica", 9)
        
        # Columna Art
        c.drawString(MARGIN_LEFT, y_position, "1")
        
        # Columna C/I
        c.drawString(MARGIN_LEFT + 20, y_position, tipo)
        
        # Columna N° Predial
        c.drawString(MARGIN_LEFT + 40, y_position, predio.get("codigo_predial", "")[:20])
        
        # Columna Propietario
        propietario = predio.get("propietarios", [{}])[0]
        nombre_prop = propietario.get("nombre_propietario", "")[:40]
        c.drawString(MARGIN_LEFT + 180, y_position, nombre_prop)
        y_position -= 12
        
        # Fila 2: Tipo Doc, Nro Doc
        tipo_doc = propietario.get("tipo_documento", "C")
        nro_doc = str(propietario.get("numero_documento", "")).zfill(10) if propietario.get("numero_documento") else ""
        c.drawString(MARGIN_LEFT + 180, y_position, f"{tipo_doc}    {nro_doc}")
        y_position -= 12
        
        # Fila 3: NPN
        c.drawString(MARGIN_LEFT, y_position, f"NPN {predio.get('npn', '')}")
        y_position -= 12
        
        # Fila 4: Dirección
        c.drawString(MARGIN_LEFT, y_position, predio.get("direccion", "")[:60])
        
        # Destino económico
        c.drawString(MARGIN_LEFT + 350, y_position, predio.get("destino_economico", "R"))
        y_position -= 12
        
        # Fila 5: Área terreno, Área construida, Avalúo, Vigencia
        area_terreno = predio.get("area_terreno", 0)
        area_construida = predio.get("area_construida", 0)
        avaluo = predio.get("avaluo", 0)
        
        c.drawString(MARGIN_LEFT, y_position, f"{area_terreno}")
        c.drawString(MARGIN_LEFT + 80, y_position, f"{area_construida}")
        c.drawString(MARGIN_LEFT + 150, y_position, f"${avaluo:,.0f}".replace(",", "."))
        c.drawString(MARGIN_LEFT + 250, y_position, "01/01/2026")
        y_position -= 12
        
        # Fila 6: Código homologado, Matrícula
        c.drawString(MARGIN_LEFT, y_position, predio.get("codigo_homologado", ""))
        c.drawString(MARGIN_LEFT + 150, y_position, predio.get("matricula_inmobiliaria", ""))
        y_position -= 15
        
        # Si es inscripción, agregar historial de avalúos
        if tipo == "I":
            inscripcion = predio.get("inscripcion_catastral", {})
            if inscripcion.get("valor"):
                c.setFont("Helvetica", 8)
                c.drawString(MARGIN_LEFT, y_position, 
                           f"INSCRIPCIÓN CATASTRAL         ${inscripcion.get('valor', 0):,.0f}".replace(",", ".") + 
                           f"        {inscripcion.get('fecha', '')}")
                y_position -= 10
            
            for decreto in predio.get("decretos", []):
                c.drawString(MARGIN_LEFT, y_position,
                           f"DCTO {decreto.get('numero', '')}      ${decreto.get('valor', 0):,.0f}".replace(",", ".") +
                           f"      {decreto.get('fecha', '')}")
                y_position -= 10
        
        dibujar_separador()
    
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
    c.setFont("Helvetica-Bold", 10)
    c.drawString(MARGIN_LEFT, y_position, "Artículo 2.")
    y_position -= 14
    dibujar_texto_justificado(plantilla["articulo_2"], font_size=10)
    y_position -= 10
    
    # Artículo 3
    c.setFont("Helvetica-Bold", 10)
    c.drawString(MARGIN_LEFT, y_position, "Artículo 3.")
    y_position -= 14
    dibujar_texto_justificado(plantilla["articulo_3"], font_size=10)
    y_position -= 10
    
    # Artículo 4
    c.setFont("Helvetica-Bold", 10)
    c.drawString(MARGIN_LEFT, y_position, "Artículo 4.")
    y_position -= 14
    dibujar_texto_justificado(plantilla["articulo_4"], font_size=10)
    y_position -= 20
    
    # CIERRE
    verificar_espacio(50)
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(PAGE_WIDTH/2, y_position, plantilla["cierre"])
    y_position -= 40
    
    # =====================
    # FIRMA Y QR
    # =====================
    verificar_espacio(120)
    
    # Firma
    firma_x = MARGIN_LEFT + 50
    try:
        if imagen_firma_b64:
            import base64
            firma_data = base64.b64decode(imagen_firma_b64)
            firma_img = ImageReader(io.BytesIO(firma_data))
        else:
            firma_b64 = get_firma_dalgie_image()
            firma_data = __import__('base64').b64decode(firma_b64)
            firma_img = ImageReader(io.BytesIO(firma_data))
        c.drawImage(firma_img, firma_x, y_position - 50, width=150, height=60, preserveAspectRatio=True)
    except Exception as e:
        print(f"Error cargando firma: {e}")
    
    # QR Code (si hay código de verificación)
    if codigo_verificacion and verificacion_base_url:
        try:
            import qrcode
            qr_url = f"{verificacion_base_url}/api/verificar/{codigo_verificacion}"
            qr = qrcode.QRCode(version=1, box_size=3, border=1)
            qr.add_data(qr_url)
            qr.make(fit=True)
            qr_img = qr.make_image(fill_color="#009846", back_color="white")
            
            qr_buffer = io.BytesIO()
            qr_img.save(qr_buffer, format='PNG')
            qr_buffer.seek(0)
            qr_reader = ImageReader(qr_buffer)
            
            qr_x = PAGE_WIDTH - MARGIN_RIGHT - 80
            c.drawImage(qr_reader, qr_x, y_position - 50, width=70, height=70)
            
            # Texto de verificación
            c.setFont("Helvetica", 6)
            c.drawString(qr_x, y_position - 55, f"Código: {codigo_verificacion}")
        except Exception as e:
            print(f"Error generando QR: {e}")
    
    y_position -= 70
    
    # Nombre y cargo del firmante
    c.setFont("Helvetica-Bold", 10)
    c.drawString(firma_x, y_position, plantilla["firmante_nombre"])
    y_position -= 14
    c.setFont("Helvetica", 9)
    c.drawString(firma_x, y_position, plantilla["firmante_cargo"])
    
    # Número de página final
    c.setFont("Helvetica", 8)
    c.drawRightString(PAGE_WIDTH - MARGIN_RIGHT, MARGIN_BOTTOM - 0.5*cm, 
                     f"{page_number} | P á g i n a")
    
    c.save()
    buffer.seek(0)
    return buffer.getvalue()
