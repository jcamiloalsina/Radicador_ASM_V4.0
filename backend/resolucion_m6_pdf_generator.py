"""
Generador de PDF para Resolución M6 - Rectificación de Área
"""
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.lib.utils import simpleSplit
from reportlab.platypus import Table, TableStyle
from io import BytesIO
from datetime import datetime
import qrcode
from PIL import Image
import base64

# Colores
NEGRO = HexColor("#000000")
GRIS_OSCURO = HexColor("#333333")
GRIS_CLARO = HexColor("#666666")
AZUL_ENCABEZADO = HexColor("#1a365d")

# Dimensiones
PAGE_WIDTH, PAGE_HEIGHT = letter
MARGIN_LEFT = 2.5 * cm
MARGIN_RIGHT = 2 * cm
MARGIN_TOP = 2.5 * cm
MARGIN_BOTTOM = 2.5 * cm
CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT


def get_m6_plantilla():
    """Plantilla para Rectificación de Área"""
    return {
        "tipo": "M6",
        "titulo": "POR LA CUAL SE ORDENAN UNOS CAMBIOS EN EL CATASTRO DEL MUNICIPIO DE {municipio} Y SE RESUELVE UNA RECTIFICACIÓN DE ÁREA",
        "preambulo": (
            "La Asociación de Municipios del Catatumbo, Provincia de Ocaña y Sur del Cesar – Asomunicipios "
            "en uso de sus facultades legales otorgadas por la resolución IGAC 1204 del 2021 "
            "en concordancia con la ley 14 de 1983 y el decreto 148 del 2020, y la resolución IGAC 1040 del 2023: "
            "\"por la cual se actualiza la reglamentación técnica de la formación, actualización, conservación y "
            "difusión catastral con enfoque multipropósito\", y"
        ),
        "considerando_descubrimiento": (
            "Qué, en el desarrollo de las actividades catastrales de la Asociación de Municipios del Catatumbo, "
            "Provincia de Ocaña y Sur del Cesar – Asomunicipios en el municipio de {municipio}, "
            "se encontró que el predio presenta cambios físicos que deben ser actualizados en la base catastral, "
            "atendido bajo el radicado N° {radicado}, la resolución 1040 del 2023 define el trámite catastral "
            "de rectificación de área."
        ),
        "considerando_solicitud": (
            "Qué, el(la) ciudadano(a) {solicitante_nombre}, identificado(a) con cédula de ciudadanía No. {solicitante_documento}, "
            "en calidad de propietario(a) del predio, solicita la rectificación del área catastral del inmueble."
        ),
        "considerando_predio": (
            "Qué, el predio se encuentra identificado con el NPN {codigo_predial}, radicado {radicado}, "
            "en el municipio de {municipio}."
        ),
        "considerando_documentos": (
            "Qué, el solicitante solicita la corrección del área del predio según el folio de matrícula inmobiliaria "
            "No. {matricula_inmobiliaria}, soportado en los siguientes documentos justificativos:"
        ),
        "documentos_soporte": [
            "Oficio de solicitud",
            "Cédula de ciudadanía",
            "Escritura pública",
            "Certificado de Tradición y Libertad (matrícula {matricula})",
            "Plano en formato DWG o PDF"
        ],
        "considerando_inscripcion_actual": (
            "Qué, actualmente el predio se encuentra inscrito en el catastro con NPN {codigo_predial}, "
            "con área de terreno de {area_terreno_anterior} m², área de construcción de {area_construida_anterior} m², "
            "destino {destino_economico}, matrícula inmobiliaria No. {matricula_inmobiliaria}, "
            "a nombre de {propietario_nombre}."
        ),
        "considerando_visita": (
            "Qué, en la visita técnica se encontró: área de terreno de {area_terreno_nueva} m², "
            "área de construcción de {area_construida_nueva} m², destino {destino_economico}, "
            "matrícula inmobiliaria No. {matricula_inmobiliaria}, a nombre de {propietario_nombre}, "
            "cédula No. {propietario_documento}. Se aclara que la corrección del área del predio es con fines catastrales."
        ),
        "considerando_final": (
            "Qué, por lo anteriormente expuesto, es procedente rectificar el área del predio e inscribirlo "
            "en el catastro, según lo establecido en el literal f del artículo 2.2.2.2.2 del Decreto 148 de 2020 "
            "y los numerales 4.2.2.5 al 4.2.2.7 del capítulo 2, título IV de la resolución 1040 de 2023."
        ),
        "articulo_1": (
            "Ordenar la inscripción de los cambios en el catastro del Municipio de {municipio}, "
            "de la siguiente manera, corregir el área del terreno del predio identificado con código predial "
            "{codigo_predial} perteneciente al(la) ciudadano(a) {propietario_nombre}:"
        ),
        "articulo_2": (
            "El presente acto administrativo se notificará personalmente y subsidiariamente por aviso, "
            "dando cumplimiento al procedimiento contemplado en los artículos 67 y 69 de la ley 1437 de 2011 (CPA y CCA). "
            "Igualmente podrá realizarse la notificación por correo electrónico si el interesado así lo acepta."
        ),
        "articulo_3": (
            "Contra el presente acto administrativo proceden los recursos de reposición y subsidio de apelación, "
            "los cuales deberán interponerse dentro de los diez (10) días siguientes a su notificación personal o "
            "a la finalización del término de publicación del aviso o fijación del edicto cuando haya lugar. "
            "Recursos que se interpondrán ante el director ejecutivo de la Asociación de Municipios del Catatumbo, "
            "Provincia de Ocaña y Sur del Cesar – Asomunicipios."
        ),
        "articulo_4": (
            "Los recursos se concederán en el efecto suspensivo, lo cual indica que la inscripción en los documentos "
            "de las Tesorerías Municipales solo se realizará hasta que el acto quede en firme."
        ),
        "articulo_5": (
            "La vigencia fiscal de los avalúos que se practiquen después del primero (1) de enero de cada año, "
            "tendrán vigencia fiscal para el año siguiente reajustado por el índice que para tal efecto determine "
            "el gobierno nacional."
        ),
        "firmante_nombre": "DALGIE ESPERANZA TORRADO RIZO",
        "firmante_cargo": "SUBDIRECTORA FINANCIERA Y ADMINISTRATIVA"
    }


def obtener_datos_r1_r2_pdf(predio: dict) -> dict:
    """
    Obtiene datos de R1/R2 con fallback a campos directos del predio.
    R1 contiene: codigo_homologado, area_terreno, area_construida, destino_economico, avaluo
    R2 contiene: matricula_inmobiliaria, propietarios
    """
    resultado = {}
    
    # Obtener datos de R1 (primer registro si existe)
    r1_registros = predio.get('r1_registros', [])
    if r1_registros and len(r1_registros) > 0:
        r1 = r1_registros[0]
        resultado['codigo_homologado'] = r1.get('codigo_homologado') or r1.get('nupre') or ''
        resultado['area_terreno'] = r1.get('area_terreno') or r1.get('area_terreno_alfanumerica') or 0
        resultado['area_construida'] = r1.get('area_construida') or r1.get('area_construida_alfanumerica') or 0
        resultado['destino_economico'] = r1.get('destino_economico') or r1.get('destino_economico_r1') or 'A'
        resultado['avaluo'] = r1.get('avaluo') or r1.get('valor_avaluo') or 0
        resultado['direccion'] = r1.get('direccion') or ''
    else:
        # Fallback a campos directos
        resultado['codigo_homologado'] = predio.get('codigo_homologado') or predio.get('codigo_anterior') or ''
        resultado['area_terreno'] = predio.get('area_terreno') or predio.get('area_terreno_r1') or 0
        resultado['area_construida'] = predio.get('area_construida') or predio.get('area_construida_r1') or 0
        resultado['destino_economico'] = predio.get('destino_economico') or 'A'
        resultado['avaluo'] = predio.get('avaluo') or 0
        resultado['direccion'] = predio.get('direccion') or ''
    
    # Obtener datos de R2 (primer registro si existe)
    r2_registros = predio.get('r2_registros', [])
    if r2_registros and len(r2_registros) > 0:
        r2 = r2_registros[0]
        resultado['matricula_inmobiliaria'] = r2.get('matricula_inmobiliaria') or ''
        resultado['propietarios'] = r2.get('propietarios') or predio.get('propietarios', [])
    else:
        resultado['matricula_inmobiliaria'] = predio.get('matricula_inmobiliaria') or ''
        resultado['propietarios'] = predio.get('propietarios', [])
    
    return resultado


def generar_resolucion_m6_pdf(data: dict) -> bytes:
    """
    Genera PDF de resolución M6 - Rectificación de Área
    """
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    
    # Fuentes
    font_normal = "Helvetica"
    font_bold = "Helvetica-Bold"
    
    # Obtener datos
    numero_resolucion = data.get("numero_resolucion", "RES-XX-XXX-0000-2026")
    fecha_resolucion = data.get("fecha_resolucion", datetime.now().strftime("%d/%m/%Y"))
    municipio = data.get("municipio", "")
    radicado = data.get("radicado", "")
    predio = data.get("predio", {})
    solicitante = data.get("solicitante", {})
    plantilla = get_m6_plantilla()
    elaboro = data.get("elaborado_por", "")
    aprobo = data.get("revisado_por", "")
    texto_considerando_personalizado = data.get("texto_considerando")
    codigo_verificacion = data.get("codigo_verificacion", "")
    
    # Datos del solicitante
    solicitante_nombre = solicitante.get("nombre", "NO ESPECIFICADO")
    solicitante_documento = solicitante.get("documento", "")
    
    # Datos del predio - ANTERIORES (de R1/R2)
    datos_r1_r2 = obtener_datos_r1_r2_pdf(predio)
    codigo_predial = predio.get("codigo_predial_nacional") or predio.get("NPN") or ""
    codigo_homologado = datos_r1_r2.get("codigo_homologado", "")
    matricula = datos_r1_r2.get("matricula_inmobiliaria", "") or "Sin información"
    direccion = datos_r1_r2.get("direccion", "") or predio.get("direccion", "")
    destino = datos_r1_r2.get("destino_economico", "A")
    
    # Áreas anteriores (de R1/R2)
    area_terreno_anterior = data.get("area_terreno_anterior") or datos_r1_r2.get("area_terreno", 0)
    area_construida_anterior = data.get("area_construida_anterior") or datos_r1_r2.get("area_construida", 0)
    avaluo_anterior = data.get("avaluo_anterior") or datos_r1_r2.get("avaluo", 0)
    
    # Áreas nuevas (del formulario)
    area_terreno_nueva = data.get("area_terreno_nueva", 0)
    area_construida_nueva = data.get("area_construida_nueva", 0)
    avaluo_nuevo = data.get("avaluo_nuevo", 0)
    
    # Propietario
    propietarios = datos_r1_r2.get("propietarios", []) or predio.get("propietarios", [])
    propietario_nombre = propietarios[0].get("nombre_propietario", solicitante_nombre) if propietarios else solicitante_nombre
    propietario_documento = propietarios[0].get("numero_documento", solicitante_documento) if propietarios else solicitante_documento
    
    # Vigencias
    año_actual = datetime.now().year
    vigencia_anterior = data.get("vigencia_anterior", f"01/01/{año_actual - 1}")
    vigencia_nueva = data.get("vigencia_nueva", f"01/01/{año_actual}")
    
    # Variables de posición
    y_position = PAGE_HEIGHT - MARGIN_TOP
    page_num = 1
    
    def verificar_espacio(espacio_necesario):
        nonlocal y_position, page_num
        if y_position < MARGIN_BOTTOM + espacio_necesario:
            c.showPage()
            page_num += 1
            y_position = draw_header()
    
    def draw_header():
        """Dibuja el encabezado de cada página"""
        nonlocal page_num
        c.setFont(font_bold, 8)
        c.setFillColor(AZUL_ENCABEZADO)
        c.drawCentredString(PAGE_WIDTH/2, PAGE_HEIGHT - 1.5 * cm, 
            "Asociación de Municipios del Catatumbo, Provincia de Ocaña y Sur del Cesar – Asomunicipios")
        c.setFont(font_normal, 7)
        c.setFillColor(GRIS_CLARO)
        c.drawCentredString(PAGE_WIDTH/2, PAGE_HEIGHT - 1.8 * cm, "Gestor Catastral")
        
        # Línea separadora
        c.setStrokeColor(AZUL_ENCABEZADO)
        c.setLineWidth(1)
        c.line(MARGIN_LEFT, PAGE_HEIGHT - 2 * cm, PAGE_WIDTH - MARGIN_RIGHT, PAGE_HEIGHT - 2 * cm)
        
        return PAGE_HEIGHT - 2.5 * cm
    
    def draw_footer():
        """Dibuja el pie de página"""
        c.setFont(font_normal, 6)
        c.setFillColor(GRIS_CLARO)
        c.drawCentredString(PAGE_WIDTH/2, 1.2 * cm, "Calle 11 # 12 - 42 Barrio Centro, Ocaña – Norte de Santander")
        c.drawCentredString(PAGE_WIDTH/2, 0.9 * cm, "comunicaciones@asomunicipios.gov.co | www.asomunicipios.gov.co")
        c.setFont(font_normal, 7)
        c.drawRightString(PAGE_WIDTH - MARGIN_RIGHT, 0.9 * cm, f"Página {page_num}")
    
    def dibujar_seccion_titulo(titulo):
        nonlocal y_position
        verificar_espacio(30)
        c.setFont(font_bold, 11)
        c.setFillColor(NEGRO)
        c.drawCentredString(PAGE_WIDTH/2, y_position, titulo)
        y_position -= 20
    
    def dibujar_texto_justificado(texto, font_name=None, font_size=10, line_height=14):
        """Dibuja texto justificado"""
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
                    space_between = total_space / (len(words) - 1)
                    
                    if space_between > max_space:
                        c.drawString(MARGIN_LEFT, y_position, line)
                    else:
                        x = MARGIN_LEFT
                        for j, word in enumerate(words):
                            c.drawString(x, y_position, word)
                            x += c.stringWidth(word, fname, font_size)
                            if j < len(words) - 1:
                                x += space_between
                else:
                    c.drawString(MARGIN_LEFT, y_position, line)
            
            y_position -= line_height
    
    def dibujar_articulo_justificado(numero_articulo, texto, font_size=10, line_height=14):
        """Dibuja un artículo con título en bold y texto justificado"""
        nonlocal y_position
        verificar_espacio(80)
        
        c.setFont(font_bold, font_size)
        c.setFillColor(NEGRO)
        titulo = f"Artículo {numero_articulo}. "
        titulo_width = c.stringWidth(titulo, font_bold, font_size)
        c.drawString(MARGIN_LEFT, y_position, titulo)
        
        c.setFont(font_normal, font_size)
        lines = simpleSplit(texto, font_normal, font_size, CONTENT_WIDTH - titulo_width)
        
        if lines:
            c.drawString(MARGIN_LEFT + titulo_width, y_position, lines[0])
            y_position -= line_height
        
        if len(lines) > 1:
            resto_texto = ' '.join(lines[1:])
            all_lines = simpleSplit(resto_texto, font_normal, font_size, CONTENT_WIDTH)
            
            espacio_normal = c.stringWidth(' ', font_normal, font_size)
            max_space = espacio_normal * 3
            
            for i, line in enumerate(all_lines):
                verificar_espacio(line_height)
                line_width = c.stringWidth(line, font_normal, font_size)
                
                if i == len(all_lines) - 1 or line_width < CONTENT_WIDTH * 0.75:
                    c.drawString(MARGIN_LEFT, y_position, line)
                else:
                    words = line.split(' ')
                    if len(words) > 1:
                        total_words_width = sum(c.stringWidth(word, font_normal, font_size) for word in words)
                        total_space = CONTENT_WIDTH - total_words_width
                        space_between = total_space / (len(words) - 1)
                        
                        if space_between > max_space:
                            c.drawString(MARGIN_LEFT, y_position, line)
                        else:
                            x = MARGIN_LEFT
                            for j, word in enumerate(words):
                                c.drawString(x, y_position, word)
                                x += c.stringWidth(word, font_normal, font_size)
                                if j < len(words) - 1:
                                    x += space_between
                    else:
                        c.drawString(MARGIN_LEFT, y_position, line)
                
                y_position -= line_height
        
        y_position -= 10
    
    def formatear_area(valor):
        """Formatea el área con separador de miles"""
        try:
            return f"{float(valor):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        except:
            return str(valor)
    
    def formatear_moneda(valor):
        """Formatea valores monetarios"""
        try:
            return f"${float(valor):,.0f}".replace(",", ".")
        except:
            return f"${valor}"
    
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
    
    # Título de la resolución
    c.setFont(font_bold, 9)
    titulo = plantilla["titulo"].format(municipio=municipio.upper())
    lines = simpleSplit(titulo, font_bold, 9, CONTENT_WIDTH)
    for line in lines:
        c.drawCentredString(PAGE_WIDTH/2, y_position, line)
        y_position -= 12
    y_position -= 15
    
    # ==========================================
    # CONSIDERANDO
    # ==========================================
    dibujar_seccion_titulo("CONSIDERANDO")
    c.setFillColor(NEGRO)
    
    # Preámbulo
    dibujar_texto_justificado(plantilla["preambulo"], font_size=10, line_height=13)
    y_position -= 10
    
    # Si hay texto personalizado de considerandos, usarlo
    if texto_considerando_personalizado:
        texto_procesado = texto_considerando_personalizado
        try:
            texto_procesado = texto_procesado.replace('(solicitante)', solicitante_nombre)
            texto_procesado = texto_procesado.replace('(documento)', solicitante_documento)
            texto_procesado = texto_procesado.replace('(codigo_predial)', codigo_predial)
            texto_procesado = texto_procesado.replace('(municipio)', municipio)
            texto_procesado = texto_procesado.replace('(radicado)', radicado)
            texto_procesado = texto_procesado.replace('(matricula)', matricula)
            texto_procesado = texto_procesado.replace('(area_terreno_anterior)', str(area_terreno_anterior))
            texto_procesado = texto_procesado.replace('(area_terreno_nueva)', str(area_terreno_nueva))
            texto_procesado = texto_procesado.replace('(area_construida_anterior)', str(area_construida_anterior))
            texto_procesado = texto_procesado.replace('(area_construida_nueva)', str(area_construida_nueva))
        except Exception:
            pass
        dibujar_texto_justificado(texto_procesado, font_size=10, line_height=13)
        y_position -= 10
    else:
        # Considerando descubrimiento
        texto_desc = plantilla["considerando_descubrimiento"].format(
            municipio=municipio,
            radicado=radicado
        )
        dibujar_texto_justificado(texto_desc, font_size=10, line_height=13)
        y_position -= 10
        
        # Considerando solicitud
        texto_sol = plantilla["considerando_solicitud"].format(
            solicitante_nombre=solicitante_nombre,
            solicitante_documento=solicitante_documento
        )
        dibujar_texto_justificado(texto_sol, font_size=10, line_height=13)
        y_position -= 10
        
        # Considerando predio
        texto_predio = plantilla["considerando_predio"].format(
            codigo_predial=codigo_predial,
            radicado=radicado,
            municipio=municipio
        )
        dibujar_texto_justificado(texto_predio, font_size=10, line_height=13)
        y_position -= 10
        
        # Considerando documentos
        texto_docs = plantilla["considerando_documentos"].format(
            matricula_inmobiliaria=matricula
        )
        dibujar_texto_justificado(texto_docs, font_size=10, line_height=13)
        y_position -= 5
        
        # Lista de documentos
        c.setFont(font_normal, 10)
        for doc in plantilla["documentos_soporte"]:
            verificar_espacio(15)
            doc_texto = doc.format(matricula=matricula)
            c.drawString(MARGIN_LEFT + 15, y_position, f"• {doc_texto}")
            y_position -= 14
        y_position -= 10
        
        # Considerando inscripción actual
        texto_insc = plantilla["considerando_inscripcion_actual"].format(
            codigo_predial=codigo_predial,
            area_terreno_anterior=area_terreno_anterior,
            area_construida_anterior=area_construida_anterior,
            destino_economico=destino,
            matricula_inmobiliaria=matricula,
            propietario_nombre=propietario_nombre
        )
        dibujar_texto_justificado(texto_insc, font_size=10, line_height=13)
        y_position -= 10
        
        # Considerando visita
        texto_visita = plantilla["considerando_visita"].format(
            area_terreno_nueva=area_terreno_nueva,
            area_construida_nueva=area_construida_nueva,
            destino_economico=destino,
            matricula_inmobiliaria=matricula,
            propietario_nombre=propietario_nombre,
            propietario_documento=propietario_documento
        )
        dibujar_texto_justificado(texto_visita, font_size=10, line_height=13)
        y_position -= 10
        
        # Considerando final
        dibujar_texto_justificado(plantilla["considerando_final"], font_size=10, line_height=13)
        y_position -= 15
    
    # ==========================================
    # RESUELVE
    # ==========================================
    dibujar_seccion_titulo("RESUELVE")
    
    # Artículo 1
    texto_art1 = plantilla["articulo_1"].format(
        municipio=municipio,
        codigo_predial=codigo_predial,
        propietario_nombre=propietario_nombre
    )
    dibujar_articulo_justificado(1, texto_art1)
    y_position -= 5
    
    # ==========================================
    # TABLA DE CANCELACIÓN E INSCRIPCIÓN
    # ==========================================
    verificar_espacio(180)
    
    # Encabezados de la tabla
    col_widths = [65, 55, 45, 50, 40, 45, 50, 50, 55]
    
    # Datos para CANCELACIÓN
    datos_cancelacion = [
        ["CANCELACIÓN", "", "", "", "", "", "", "", ""],
        ["N° PREDIAL", "COD. HOM.", "MATRÍCULA", "DIRECCIÓN", "DEST.", "ÁREA TER.", "ÁREA CON.", "AVALÚO", "VIG. FISC."],
        [
            codigo_predial[:20] if codigo_predial else "",
            codigo_homologado[:12] if codigo_homologado else "",
            matricula[:10] if matricula else "",
            (direccion or "")[:15],
            destino,
            formatear_area(area_terreno_anterior),
            formatear_area(area_construida_anterior),
            formatear_moneda(avaluo_anterior),
            vigencia_anterior
        ]
    ]
    
    # Datos para INSCRIPCIÓN
    datos_inscripcion = [
        ["INSCRIPCIÓN", "", "", "", "", "", "", "", ""],
        ["N° PREDIAL", "COD. HOM.", "MATRÍCULA", "DIRECCIÓN", "DEST.", "ÁREA TER.", "ÁREA CON.", "AVALÚO", "VIG. FISC."],
        [
            codigo_predial[:20] if codigo_predial else "",
            codigo_homologado[:12] if codigo_homologado else "",
            matricula[:10] if matricula else "",
            (direccion or "")[:15],
            destino,
            formatear_area(area_terreno_nueva),
            formatear_area(area_construida_nueva),
            formatear_moneda(avaluo_nuevo),
            vigencia_nueva
        ]
    ]
    
    # Dibujar tabla CANCELACIÓN
    tabla_cancelacion = Table(datos_cancelacion, colWidths=col_widths)
    tabla_cancelacion.setStyle(TableStyle([
        ('SPAN', (0, 0), (-1, 0)),
        ('BACKGROUND', (0, 0), (-1, 0), HexColor("#FFE4E4")),
        ('BACKGROUND', (0, 1), (-1, 1), HexColor("#F0F0F0")),
        ('TEXTCOLOR', (0, 0), (-1, -1), NEGRO),
        ('FONTNAME', (0, 0), (-1, 0), font_bold),
        ('FONTNAME', (0, 1), (-1, 1), font_bold),
        ('FONTSIZE', (0, 0), (-1, -1), 6),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, NEGRO),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    
    tabla_cancelacion.wrapOn(c, CONTENT_WIDTH, 200)
    tabla_cancelacion.drawOn(c, MARGIN_LEFT, y_position - 50)
    y_position -= 60
    
    # Dibujar tabla INSCRIPCIÓN
    tabla_inscripcion = Table(datos_inscripcion, colWidths=col_widths)
    tabla_inscripcion.setStyle(TableStyle([
        ('SPAN', (0, 0), (-1, 0)),
        ('BACKGROUND', (0, 0), (-1, 0), HexColor("#E4FFE4")),
        ('BACKGROUND', (0, 1), (-1, 1), HexColor("#F0F0F0")),
        ('TEXTCOLOR', (0, 0), (-1, -1), NEGRO),
        ('FONTNAME', (0, 0), (-1, 0), font_bold),
        ('FONTNAME', (0, 1), (-1, 1), font_bold),
        ('FONTSIZE', (0, 0), (-1, -1), 6),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, NEGRO),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    
    tabla_inscripcion.wrapOn(c, CONTENT_WIDTH, 200)
    tabla_inscripcion.drawOn(c, MARGIN_LEFT, y_position - 50)
    y_position -= 70
    
    # Fecha de inscripción catastral
    c.setFont(font_bold, 8)
    c.drawCentredString(PAGE_WIDTH/2, y_position, f"INSCRIPCIÓN CATASTRAL {datetime.now().strftime('%d/%m/%Y')}")
    y_position -= 25
    
    # ==========================================
    # ARTÍCULOS ADICIONALES
    # ==========================================
    dibujar_articulo_justificado(2, plantilla["articulo_2"])
    dibujar_articulo_justificado(3, plantilla["articulo_3"])
    dibujar_articulo_justificado(4, plantilla["articulo_4"])
    dibujar_articulo_justificado(5, plantilla["articulo_5"])
    
    y_position -= 20
    
    # ==========================================
    # COMUNÍQUESE
    # ==========================================
    verificar_espacio(30)
    c.setFont(font_bold, 10)
    c.drawCentredString(PAGE_WIDTH/2, y_position, "COMUNÍQUESE, NOTIFÍQUESE Y CÚMPLASE")
    y_position -= 30
    
    # Fecha de expedición
    c.setFont(font_normal, 10)
    fecha_texto = f"DADA EN OCAÑA, A LOS {datetime.now().strftime('%d')} DÍAS DE {datetime.now().strftime('%B').upper()} DE {datetime.now().year}."
    c.drawCentredString(PAGE_WIDTH/2, y_position, fecha_texto)
    y_position -= 50
    
    # ==========================================
    # FIRMA Y QR
    # ==========================================
    verificar_espacio(120)
    
    # Firma
    c.setFont(font_bold, 10)
    c.drawCentredString(PAGE_WIDTH/2, y_position, plantilla["firmante_nombre"])
    y_position -= 14
    c.setFont(font_normal, 9)
    c.drawCentredString(PAGE_WIDTH/2, y_position, plantilla["firmante_cargo"])
    y_position -= 30
    
    # Elaboró / Revisó
    c.setFont(font_normal, 8)
    c.drawString(MARGIN_LEFT, y_position, f"Elaboró: {elaboro}")
    y_position -= 12
    c.drawString(MARGIN_LEFT, y_position, f"Revisó: {aprobo}")
    y_position -= 30
    
    # QR Code
    if codigo_verificacion:
        try:
            verificacion_url = f"https://m6-area-update.preview.emergentagent.com/verificar/{codigo_verificacion}"
            qr = qrcode.QRCode(version=1, box_size=3, border=1)
            qr.add_data(verificacion_url)
            qr.make(fit=True)
            qr_img = qr.make_image(fill_color="black", back_color="white")
            
            qr_buffer = BytesIO()
            qr_img.save(qr_buffer, format='PNG')
            qr_buffer.seek(0)
            
            from reportlab.lib.utils import ImageReader
            qr_image = ImageReader(qr_buffer)
            qr_size = 60
            c.drawImage(qr_image, PAGE_WIDTH - MARGIN_RIGHT - qr_size, y_position - qr_size + 30, 
                       width=qr_size, height=qr_size)
            
            c.setFont(font_normal, 6)
            c.drawString(PAGE_WIDTH - MARGIN_RIGHT - qr_size, y_position - qr_size + 20, "Verificar resolución:")
            c.setFont(font_normal, 5)
            c.drawString(PAGE_WIDTH - MARGIN_RIGHT - qr_size, y_position - qr_size + 12, codigo_verificacion[:20])
        except Exception as e:
            print(f"Error generando QR: {e}")
    
    # Pie de página
    draw_footer()
    
    c.save()
    buffer.seek(0)
    return buffer.getvalue()


# Alias para compatibilidad
generate_m6_resolution_pdf = generar_resolucion_m6_pdf
