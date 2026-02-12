"""
Generador de PDF para Informe de Visita - EXACTO al formulario web
Contiene 5 páginas y 13 secciones como el formulario
"""
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
import io
import base64
import logging

logger = logging.getLogger(__name__)

def generar_pdf_visita_completo(proyecto, predio, visita, propietarios, construcciones, current_user_email):
    """
    Genera el PDF del informe de visita EXACTO al formulario web
    
    Args:
        proyecto: dict con datos del proyecto
        predio: dict con datos del predio
        visita: dict con datos de la visita (visitaData del frontend)
        propietarios: list de propietarios (visitaPropietarios del frontend)
        construcciones: list de construcciones (visitaConstrucciones del frontend)
        current_user_email: email del usuario actual
    
    Returns:
        bytes: contenido del PDF
    """
    # Importar imágenes del certificado
    try:
        from certificado_images import get_encabezado_image, get_pie_pagina_image
        encabezado_img = ImageReader(get_encabezado_image())
        pie_pagina_img = ImageReader(get_pie_pagina_image())
        imagenes_ok = True
    except Exception as e:
        logger.warning(f"No se pudieron cargar imágenes embebidas: {e}")
        imagenes_ok = False
    
    # Crear PDF
    buffer = io.BytesIO()
    width, height = letter
    c = canvas.Canvas(buffer, pagesize=letter)
    
    # Colores
    azul = colors.HexColor('#1e40af')  # Sección 1
    verde = colors.HexColor('#059669')  # Sección 2
    morado = colors.HexColor('#7c3aed')  # Sección 3, 7, 13
    naranja = colors.HexColor('#ea580c')  # Sección 4, 8
    indigo = colors.HexColor('#4338ca')  # Sección 5, 10
    teal = colors.HexColor('#0d9488')   # Sección 6, 9
    azul_claro = colors.HexColor('#0284c7')  # Sección 11
    ambar = colors.HexColor('#d97706')  # Sección 12
    gris = colors.HexColor('#6b7280')
    negro = colors.black
    blanco = colors.white
    
    # Márgenes
    left = 1.2 * cm
    right_margin = width - 1.2 * cm
    content_width = right_margin - left
    top = height - 2.5 * cm
    footer_limit = 2.2 * cm
    
    page_num = 1
    
    def draw_header():
        """Dibuja encabezado institucional"""
        if imagenes_ok:
            c.drawImage(encabezado_img, left - 0.3*cm, height - 2*cm, 
                       width=content_width + 0.6*cm, height=1.8*cm, 
                       preserveAspectRatio=True, mask='auto')
        else:
            c.setFillColor(verde)
            c.setFont("Helvetica-Bold", 12)
            c.drawCentredString(width/2, height - 1.2*cm, "ASOMUNICIPIOS - Gestor Catastral")
        return height - 2.5*cm
    
    def draw_footer():
        """Dibuja pie de página"""
        if imagenes_ok:
            c.drawImage(pie_pagina_img, 0, 0, width=width, height=1.8*cm, 
                       preserveAspectRatio=False, mask='auto')
        else:
            c.setFillColor(verde)
            c.rect(0, 0, width, 22, fill=1, stroke=0)
        # Número de página
        c.setFont("Helvetica", 8)
        c.setFillColor(gris)
        c.drawRightString(right_margin, 0.8*cm, f"Página {page_num}/5")
    
    def new_page():
        """Crear nueva página"""
        nonlocal page_num
        draw_footer()
        c.showPage()
        page_num += 1
        return draw_header()
    
    def section_header(y, num, title, color):
        """Dibuja encabezado de sección con color"""
        c.setFillColor(color)
        c.rect(left, y - 14, content_width, 16, fill=1, stroke=0)
        c.setFillColor(blanco)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(left + 4, y - 10, f"{num}. {title}")
        return y - 22
    
    def field_label(x, y, label):
        """Dibuja etiqueta de campo"""
        c.setFont("Helvetica", 7)
        c.setFillColor(gris)
        c.drawString(x, y, label)
    
    def field_value(x, y, value, bold=False):
        """Dibuja valor de campo"""
        c.setFont("Helvetica-Bold" if bold else "Helvetica", 9)
        c.setFillColor(negro)
        c.drawString(x, y - 10, str(value) if value else "-")
    
    def draw_box(x, y, w, h, label, value, bg_color=None):
        """Dibuja caja con label y valor"""
        if bg_color:
            c.setFillColor(bg_color)
            c.rect(x, y - h, w, h, fill=1, stroke=0)
        c.setStrokeColor(colors.HexColor('#e5e7eb'))
        c.rect(x, y - h, w, h, fill=0, stroke=1)
        field_label(x + 3, y - 3, label)
        c.setFont("Helvetica", 8)
        c.setFillColor(negro)
        val_str = str(value)[:int(w/4)] if value else "-"
        c.drawString(x + 3, y - h + 4, val_str)
        return y - h
    
    # ==================== PÁGINA 1 ====================
    y = draw_header()
    
    # Título principal
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(negro)
    c.drawCentredString(width/2, y, "INFORME DE VISITA DE CAMPO")
    y -= 12
    c.setFont("Helvetica", 9)
    c.drawCentredString(width/2, y, f"Actualización Catastral - Municipio de {proyecto.get('municipio', '').upper()}")
    y -= 8
    c.setFont("Helvetica", 7)
    c.setFillColor(gris)
    c.drawRightString(right_margin, y, "FO-FAC-PC01-02 v2")
    y -= 18
    
    # === SECCIÓN 1: DATOS DE LA VISITA ===
    y = section_header(y, "1", "DATOS DE LA VISITA", azul)
    
    # Fila 1: Fecha, Hora, Persona
    col_w = content_width / 3
    c.setStrokeColor(colors.HexColor('#bfdbfe'))
    for i, (lbl, val) in enumerate([
        ("Fecha de Visita *", visita.get('fecha_visita', '')),
        ("Hora *", visita.get('hora_visita', '')),
        ("Persona que Atiende *", visita.get('persona_atiende', ''))
    ]):
        x = left + i * col_w
        c.rect(x, y - 28, col_w - 2, 28, stroke=1, fill=0)
        field_label(x + 3, y - 3, lbl)
        c.setFont("Helvetica", 9)
        c.setFillColor(negro)
        c.drawString(x + 3, y - 18, str(val) if val else "-")
    y -= 32
    
    # Fila 2: Relación y Acceso
    c.setFont("Helvetica", 7)
    c.setFillColor(gris)
    c.drawString(left, y, "Relación con el Predio:")
    relacion = visita.get('relacion_predio', '')
    c.setFont("Helvetica", 8)
    c.setFillColor(negro)
    for i, r in enumerate(['propietario', 'poseedor', 'arrendatario', 'familiar', 'encargado', 'otro']):
        x = left + 90 + i * 60
        marker = "●" if relacion == r else "○"
        c.drawString(x, y, f"{marker} {r.capitalize()}")
    y -= 14
    
    c.setFont("Helvetica", 7)
    c.setFillColor(gris)
    c.drawString(left, y, "¿Se pudo acceder al predio?")
    acceso = visita.get('acceso_predio', 'si')
    c.setFont("Helvetica", 8)
    c.setFillColor(negro)
    for i, a in enumerate(['si', 'parcial', 'no']):
        x = left + 130 + i * 50
        marker = "●" if acceso == a else "○"
        label = "Sí" if a == 'si' else ("Parcial" if a == 'parcial' else "No")
        c.drawString(x, y, f"{marker} {label}")
    y -= 20
    
    # === SECCIÓN 2: INFORMACIÓN BÁSICA DEL PREDIO ===
    y = section_header(y, "2", "INFORMACIÓN BÁSICA DEL PREDIO", verde)
    
    # Departamento y Municipio
    half_w = content_width / 2
    c.setStrokeColor(colors.HexColor('#d1fae5'))
    for i, (lbl, val, disabled) in enumerate([
        ("Departamento", "Norte de Santander", True),
        ("Municipio", proyecto.get('municipio', ''), True)
    ]):
        x = left + i * half_w
        bg = colors.HexColor('#f1f5f9') if disabled else None
        if bg:
            c.setFillColor(bg)
            c.rect(x, y - 28, half_w - 2, 28, fill=1, stroke=1)
        else:
            c.rect(x, y - 28, half_w - 2, 28, fill=0, stroke=1)
        field_label(x + 3, y - 3, lbl)
        c.setFont("Helvetica-Bold" if disabled else "Helvetica", 9)
        c.setFillColor(negro)
        c.drawString(x + 3, y - 18, str(val))
    y -= 32
    
    # Número Predial
    c.rect(left, y - 28, content_width, 28, stroke=1, fill=0)
    field_label(left + 3, y - 3, "Número Predial (30 dígitos)")
    c.setFont("Courier-Bold", 10)
    c.setFillColor(colors.HexColor('#065f46'))
    c.drawString(left + 3, y - 18, predio.get('codigo_predial', predio.get('numero_predial', '')))
    y -= 32
    
    # Código Homologado, Tipo, Ubicación
    third_w = content_width / 3
    for i, (lbl, val) in enumerate([
        ("Código Homologado", predio.get('codigo_homologado', 'Sin código')),
        ("Tipo (verificar)", visita.get('tipo_predio', 'NPH')),
        ("Ubicación", "Rural" if predio.get('codigo_predial', '')[5:7] == '00' else "Urbano")
    ]):
        x = left + i * third_w
        c.rect(x, y - 28, third_w - 2, 28, stroke=1, fill=0)
        field_label(x + 3, y - 3, lbl)
        c.setFont("Helvetica", 9)
        c.setFillColor(negro)
        c.drawString(x + 3, y - 18, str(val))
    y -= 32
    
    # Dirección
    c.rect(left, y - 28, content_width, 28, stroke=1, fill=0)
    field_label(left + 3, y - 3, "Dirección (verificar)")
    c.setFont("Helvetica", 9)
    c.setFillColor(negro)
    direccion = visita.get('direccion_visita', predio.get('direccion', ''))
    c.drawString(left + 3, y - 18, str(direccion)[:80] if direccion else "-")
    y -= 32
    
    # Destino Económico
    c.setFont("Helvetica", 7)
    c.setFillColor(gris)
    c.drawString(left, y, "Destino Económico (verificar):")
    y -= 10
    destino = visita.get('destino_economico_visita', '')
    destinos = [
        ('A', 'Habitacional'), ('B', 'Industrial'), ('C', 'Comercial'), ('D', 'Agropecuario'),
        ('E', 'Minero'), ('F', 'Cultural'), ('G', 'Recreacional'), ('H', 'Salubridad'),
        ('I', 'Institucional'), ('J', 'Educativo'), ('K', 'Religioso'), ('L', 'Agrícola')
    ]
    c.setFont("Helvetica", 7)
    c.setFillColor(negro)
    for i, (cod, desc) in enumerate(destinos):
        row = i // 4
        col = i % 4
        x = left + col * (content_width / 4)
        ypos = y - row * 10
        marker = "●" if destino == cod else "○"
        c.drawString(x, ypos, f"{marker} {cod}-{desc}")
    y -= 35
    
    # Áreas
    for i, (lbl, val) in enumerate([
        ("Área Terreno (m²)", visita.get('area_terreno_visita', predio.get('area_terreno', ''))),
        ("Área Construida (m²)", visita.get('area_construida_visita', predio.get('area_construida', '')))
    ]):
        x = left + i * half_w
        c.rect(x, y - 28, half_w - 2, 28, stroke=1, fill=0)
        field_label(x + 3, y - 3, lbl)
        c.setFont("Helvetica", 9)
        c.setFillColor(negro)
        c.drawString(x + 3, y - 18, str(val) if val else "-")
    y -= 32
    
    # === SECCIÓN 3: PH (si aplica) ===
    if visita.get('tipo_predio') == 'PH':
        if y < footer_limit + 120:
            y = new_page()
        y = section_header(y, "3", "PH (Propiedad Horizontal)", morado)
        
        # Primera fila PH
        for i, (lbl, val) in enumerate([
            ("Área por Coeficiente", visita.get('ph_area_coeficiente', '')),
            ("Área Construida Privada", visita.get('ph_area_construida_privada', '')),
            ("Área Construida Común", visita.get('ph_area_construida_comun', ''))
        ]):
            x = left + i * third_w
            c.rect(x, y - 28, third_w - 2, 28, stroke=1, fill=0)
            field_label(x + 3, y - 3, lbl)
            c.setFont("Helvetica", 9)
            c.setFillColor(negro)
            c.drawString(x + 3, y - 18, str(val) if val else "-")
        y -= 32
        
        # Segunda fila PH
        for i, (lbl, val) in enumerate([
            ("Copropiedad", visita.get('ph_copropiedad', '')),
            ("Predio Asociado", visita.get('ph_predio_asociado', ''))
        ]):
            x = left + i * half_w
            c.rect(x, y - 28, half_w - 2, 28, stroke=1, fill=0)
            field_label(x + 3, y - 3, lbl)
            c.setFont("Helvetica", 9)
            c.setFillColor(negro)
            c.drawString(x + 3, y - 18, str(val) if val else "-")
        y -= 32
        
        # Tercera fila PH
        for i, (lbl, val) in enumerate([
            ("Torre", visita.get('ph_torre', '')),
            ("Apartamento", visita.get('ph_apartamento', ''))
        ]):
            x = left + i * half_w
            c.rect(x, y - 28, half_w - 2, 28, stroke=1, fill=0)
            field_label(x + 3, y - 3, lbl)
            c.setFont("Helvetica", 9)
            c.setFillColor(negro)
            c.drawString(x + 3, y - 18, str(val) if val else "-")
        y -= 35
    
    # === SECCIÓN 4: CONDOMINIO ===
    if y < footer_limit + 140:
        y = new_page()
    y = section_header(y, "4", "Condominio", naranja)
    
    # Primera fila Condominio
    for i, (lbl, val) in enumerate([
        ("Área Terreno Común", visita.get('cond_area_terreno_comun', '')),
        ("Área Terreno Privada", visita.get('cond_area_terreno_privada', ''))
    ]):
        x = left + i * half_w
        c.rect(x, y - 28, half_w - 2, 28, stroke=1, fill=0)
        field_label(x + 3, y - 3, lbl)
        c.setFont("Helvetica", 9)
        c.setFillColor(negro)
        c.drawString(x + 3, y - 18, str(val) if val else "-")
    y -= 32
    
    for i, (lbl, val) in enumerate([
        ("Área Construida Privada", visita.get('cond_area_construida_privada', '')),
        ("Área Construida Común", visita.get('cond_area_construida_comun', ''))
    ]):
        x = left + i * half_w
        c.rect(x, y - 28, half_w - 2, 28, stroke=1, fill=0)
        field_label(x + 3, y - 3, lbl)
        c.setFont("Helvetica", 9)
        c.setFillColor(negro)
        c.drawString(x + 3, y - 18, str(val) if val else "-")
    y -= 32
    
    for i, (lbl, val) in enumerate([
        ("Condominio", visita.get('cond_condominio', '')),
        ("Predio Asociado", visita.get('cond_predio_asociado', ''))
    ]):
        x = left + i * half_w
        c.rect(x, y - 28, half_w - 2, 28, stroke=1, fill=0)
        field_label(x + 3, y - 3, lbl)
        c.setFont("Helvetica", 9)
        c.setFillColor(negro)
        c.drawString(x + 3, y - 18, str(val) if val else "-")
    y -= 32
    
    for i, (lbl, val) in enumerate([
        ("Unidad", visita.get('cond_unidad', '')),
        ("Casa", visita.get('cond_casa', ''))
    ]):
        x = left + i * half_w
        c.rect(x, y - 28, half_w - 2, 28, stroke=1, fill=0)
        field_label(x + 3, y - 3, lbl)
        c.setFont("Helvetica", 9)
        c.setFillColor(negro)
        c.drawString(x + 3, y - 18, str(val) if val else "-")
    y -= 35
    
    # ==================== PÁGINA 2 ====================
    y = new_page()
    
    # === SECCIÓN 5: INFORMACIÓN JURÍDICA Y PROPIETARIOS ===
    y = section_header(y, "5", "INFORMACIÓN JURÍDICA Y PROPIETARIOS", indigo)
    
    # Matrícula, Tipo Doc, No. Documento
    for i, (lbl, val) in enumerate([
        ("Matrícula Inmobiliaria", visita.get('jur_matricula', '')),
        ("Tipo Doc.", visita.get('jur_tipo_doc', '')),
        ("No. Documento", visita.get('jur_numero_doc', ''))
    ]):
        x = left + i * third_w
        c.rect(x, y - 28, third_w - 2, 28, stroke=1, fill=0)
        field_label(x + 3, y - 3, lbl)
        c.setFont("Helvetica", 9)
        c.setFillColor(negro)
        c.drawString(x + 3, y - 18, str(val) if val else "-")
    y -= 32
    
    # Notaría, Fecha, Ciudad
    for i, (lbl, val) in enumerate([
        ("Notaría", visita.get('jur_notaria', '')),
        ("Fecha", visita.get('jur_fecha', '')),
        ("Ciudad", visita.get('jur_ciudad', ''))
    ]):
        x = left + i * third_w
        c.rect(x, y - 28, third_w - 2, 28, stroke=1, fill=0)
        field_label(x + 3, y - 3, lbl)
        c.setFont("Helvetica", 9)
        c.setFillColor(negro)
        c.drawString(x + 3, y - 18, str(val) if val else "-")
    y -= 32
    
    # Razón Social
    c.rect(left, y - 28, content_width, 28, stroke=1, fill=0)
    field_label(left + 3, y - 3, "Razón Social (si aplica)")
    c.setFont("Helvetica", 9)
    c.setFillColor(negro)
    c.drawString(left + 3, y - 18, visita.get('jur_razon_social', '') or "-")
    y -= 35
    
    # Tabla de Propietarios
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(indigo)
    c.drawString(left, y, "Propietarios / Poseedores")
    y -= 15
    
    # Encabezado tabla
    cols = [30, 100, 50, 80, 80, 70, 80]
    headers = ["#", "Nombre Completo", "Tipo", "Documento", "Estado", "Género", "Grupo Étnico"]
    c.setFillColor(colors.HexColor('#e0e7ff'))
    c.rect(left, y - 14, content_width, 14, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 7)
    c.setFillColor(indigo)
    x_pos = left
    for i, (col_w, header) in enumerate(zip(cols, headers)):
        c.drawString(x_pos + 2, y - 10, header)
        x_pos += col_w
    y -= 16
    
    # Filas de propietarios
    c.setFont("Helvetica", 7)
    c.setFillColor(negro)
    for idx, prop in enumerate(propietarios[:6], 1):
        nombre = f"{prop.get('nombre', '')} {prop.get('primer_apellido', '')} {prop.get('segundo_apellido', '')}".strip()
        row_data = [
            str(idx),
            nombre[:20] if nombre else "-",
            prop.get('tipo_documento', '-'),
            prop.get('numero_documento', '-'),
            prop.get('estado', '-'),
            prop.get('genero', '-'),
            prop.get('grupo_etnico', '-')
        ]
        c.setStrokeColor(colors.HexColor('#c7d2fe'))
        c.rect(left, y - 12, content_width, 12, stroke=1, fill=0)
        x_pos = left
        for col_w, val in zip(cols, row_data):
            c.drawString(x_pos + 2, y - 9, str(val)[:int(col_w/4)])
            x_pos += col_w
        y -= 12
    y -= 10
    
    # === SECCIÓN 6: DATOS DE NOTIFICACIÓN ===
    if y < footer_limit + 120:
        y = new_page()
    y = section_header(y, "6", "DATOS DE NOTIFICACIÓN", teal)
    
    for i, (lbl, val) in enumerate([
        ("Teléfono", visita.get('not_telefono', '')),
        ("Correo Electrónico", visita.get('not_correo', '')),
        ("¿Autoriza notif. correo?", "Sí" if visita.get('not_autoriza_correo') == 'si' else "No")
    ]):
        x = left + i * third_w
        c.rect(x, y - 28, third_w - 2, 28, stroke=1, fill=0)
        field_label(x + 3, y - 3, lbl)
        c.setFont("Helvetica", 9)
        c.setFillColor(negro)
        c.drawString(x + 3, y - 18, str(val) if val else "-")
    y -= 32
    
    c.rect(left, y - 28, content_width, 28, stroke=1, fill=0)
    field_label(left + 3, y - 3, "Dirección de Notificación")
    c.setFont("Helvetica", 9)
    c.setFillColor(negro)
    c.drawString(left + 3, y - 18, visita.get('not_direccion', '') or "-")
    y -= 32
    
    for i, (lbl, val) in enumerate([
        ("Departamento", visita.get('not_departamento', 'Norte de Santander')),
        ("Municipio", visita.get('not_municipio', ''))
    ]):
        x = left + i * half_w
        c.rect(x, y - 28, half_w - 2, 28, stroke=1, fill=0)
        field_label(x + 3, y - 3, lbl)
        c.setFont("Helvetica", 9)
        c.setFillColor(negro)
        c.drawString(x + 3, y - 18, str(val) if val else "-")
    y -= 32
    
    for i, (lbl, val) in enumerate([
        ("Vereda", visita.get('not_vereda', '')),
        ("Corregimiento", visita.get('not_corregimiento', ''))
    ]):
        x = left + i * half_w
        c.rect(x, y - 28, half_w - 2, 28, stroke=1, fill=0)
        field_label(x + 3, y - 3, lbl)
        c.setFont("Helvetica", 9)
        c.setFillColor(negro)
        c.drawString(x + 3, y - 18, str(val) if val else "-")
    y -= 32
    
    c.rect(left, y - 40, content_width, 40, stroke=1, fill=0)
    field_label(left + 3, y - 3, "Datos Adicionales")
    c.setFont("Helvetica", 8)
    c.setFillColor(negro)
    datos_adic = visita.get('not_datos_adicionales', '')
    if datos_adic:
        lines = [datos_adic[i:i+90] for i in range(0, len(datos_adic), 90)]
        for i, line in enumerate(lines[:2]):
            c.drawString(left + 3, y - 15 - i*10, line)
    y -= 45
    
    # ==================== PÁGINA 3 ====================
    y = new_page()
    
    # === SECCIÓN 7: INFORMACIÓN DE CONSTRUCCIONES ===
    y = section_header(y, "7", "INFORMACIÓN DE CONSTRUCCIONES", morado)
    
    # Tabla de construcciones
    cons_cols = [40, 70, 70, 60, 70, 50]
    cons_headers = ["Unidad", "Código Uso", "Área (m²)", "Puntaje", "Año Const.", "N° Pisos"]
    c.setFillColor(colors.HexColor('#f3e8ff'))
    c.rect(left, y - 14, sum(cons_cols), 14, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 7)
    c.setFillColor(morado)
    x_pos = left
    for col_w, header in zip(cons_cols, cons_headers):
        c.drawString(x_pos + 2, y - 10, header)
        x_pos += col_w
    y -= 16
    
    c.setFont("Helvetica", 8)
    c.setFillColor(negro)
    for cons in construcciones[:8]:
        if cons.get('codigo_uso') or cons.get('area'):
            c.setStrokeColor(colors.HexColor('#e9d5ff'))
            c.rect(left, y - 12, sum(cons_cols), 12, stroke=1, fill=0)
            row_data = [
                cons.get('unidad', '-'),
                cons.get('codigo_uso', '-'),
                cons.get('area', '-'),
                cons.get('puntaje', '-'),
                cons.get('ano_construccion', '-'),
                cons.get('num_pisos', '-')
            ]
            x_pos = left
            for col_w, val in zip(cons_cols, row_data):
                c.drawString(x_pos + 2, y - 9, str(val))
                x_pos += col_w
            y -= 12
    y -= 15
    
    # === SECCIÓN 8: CALIFICACIÓN ===
    if y < footer_limit + 200:
        y = new_page()
    y = section_header(y, "8", "CALIFICACIÓN", naranja)
    
    # 8.1 ESTRUCTURA
    c.setFillColor(colors.HexColor('#f1f5f9'))
    c.rect(left, y - 55, content_width, 55, fill=1, stroke=1)
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(gris)
    c.drawString(left + 3, y - 10, "8.1 ESTRUCTURA")
    
    calif_est = visita.get('calif_estructura', {})
    quarter_w = content_width / 4
    for i, (lbl, key) in enumerate([
        ("Armazón", "armazon"), ("Muros", "muros"), ("Cubierta", "cubierta"), ("Conservación", "conservacion")
    ]):
        x = left + i * quarter_w
        field_label(x + 3, y - 22, lbl)
        c.setFont("Helvetica", 9)
        c.setFillColor(negro)
        c.drawString(x + 3, y - 35, str(calif_est.get(key, '')) or "-")
    y -= 60
    
    # 8.2 ACABADOS
    c.setFillColor(colors.HexColor('#f1f5f9'))
    c.rect(left, y - 55, content_width, 55, fill=1, stroke=1)
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(gris)
    c.drawString(left + 3, y - 10, "8.2 ACABADOS PRINCIPALES")
    
    calif_acab = visita.get('calif_acabados', {})
    for i, (lbl, key) in enumerate([
        ("Fachadas", "fachadas"), ("Cubrim. Muros", "cubrim_muros"), ("Pisos", "pisos"), ("Conservación", "conservacion")
    ]):
        x = left + i * quarter_w
        field_label(x + 3, y - 22, lbl)
        c.setFont("Helvetica", 9)
        c.setFillColor(negro)
        c.drawString(x + 3, y - 35, str(calif_acab.get(key, '')) or "-")
    y -= 60
    
    # 8.3 BAÑO
    c.setFillColor(colors.HexColor('#f1f5f9'))
    c.rect(left, y - 55, content_width, 55, fill=1, stroke=1)
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(gris)
    c.drawString(left + 3, y - 10, "8.3 BAÑO")
    
    calif_bano = visita.get('calif_bano', {})
    for i, (lbl, key) in enumerate([
        ("Tamaño", "tamano"), ("Enchape", "enchape"), ("Mobiliario", "mobiliario"), ("Conservación", "conservacion")
    ]):
        x = left + i * quarter_w
        field_label(x + 3, y - 22, lbl)
        c.setFont("Helvetica", 9)
        c.setFillColor(negro)
        c.drawString(x + 3, y - 35, str(calif_bano.get(key, '')) or "-")
    y -= 60
    
    # 8.4 COCINA
    c.setFillColor(colors.HexColor('#f1f5f9'))
    c.rect(left, y - 55, content_width, 55, fill=1, stroke=1)
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(gris)
    c.drawString(left + 3, y - 10, "8.4 COCINA")
    
    calif_cocina = visita.get('calif_cocina', {})
    for i, (lbl, key) in enumerate([
        ("Tamaño", "tamano"), ("Enchape", "enchape"), ("Mobiliario", "mobiliario"), ("Conservación", "conservacion")
    ]):
        x = left + i * quarter_w
        field_label(x + 3, y - 22, lbl)
        c.setFont("Helvetica", 9)
        c.setFillColor(negro)
        c.drawString(x + 3, y - 35, str(calif_cocina.get(key, '')) or "-")
    y -= 60
    
    # 8.5 INDUSTRIA (si aplica)
    if y < footer_limit + 60:
        y = new_page()
    c.setFillColor(colors.HexColor('#f1f5f9'))
    c.rect(left, y - 55, content_width, 55, fill=1, stroke=1)
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(gris)
    c.drawString(left + 3, y - 10, "8.5 COMPLEMENTO INDUSTRIA (si aplica)")
    
    calif_ind = visita.get('calif_industria', {})
    fifth_w = content_width / 5
    for i, (lbl, key) in enumerate([
        ("Cercha Mad.", "cercha_madera"), ("C.Met.Liv.", "cercha_metalica_liviana"), 
        ("C.Met.Med.", "cercha_metalica_mediana"), ("C.Met.Pes.", "cercha_metalica_pesada"), ("Altura", "altura")
    ]):
        x = left + i * fifth_w
        field_label(x + 2, y - 22, lbl)
        c.setFont("Helvetica", 9)
        c.setFillColor(negro)
        c.drawString(x + 2, y - 35, str(calif_ind.get(key, '')) or "-")
    y -= 60
    
    # 8.6 DATOS GENERALES
    c.setFillColor(colors.HexColor('#d1fae5'))
    c.rect(left, y - 55, content_width, 55, fill=1, stroke=1)
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(colors.HexColor('#065f46'))
    c.drawString(left + 3, y - 10, "8.6 DATOS GENERALES DE CONSTRUCCIÓN")
    
    calif_gen = visita.get('calif_generales', {})
    for i, (lbl, key) in enumerate([
        ("Total Pisos", "total_pisos"), ("Habitaciones", "total_habitaciones"), 
        ("Baños", "total_banos"), ("Locales", "total_locales"), ("Área Total (m²)", "area_total_construida")
    ]):
        x = left + i * fifth_w
        field_label(x + 2, y - 22, lbl)
        c.setFont("Helvetica", 9)
        c.setFillColor(negro)
        c.drawString(x + 2, y - 35, str(calif_gen.get(key, '')) or "-")
    y -= 65
    
    # ==================== PÁGINA 4 ====================
    y = new_page()
    
    # === SECCIÓN 9: RESUMEN ÁREAS DE TERRENO ===
    y = section_header(y, "9", "RESUMEN ÁREAS DE TERRENO", teal)
    
    # Tabla de áreas
    area_cols = [180, 80, 80, 160]
    area_headers = ["Área de terreno según:", "Ha", "m²", "Descripción"]
    c.setFillColor(colors.HexColor('#ccfbf1'))
    c.rect(left, y - 16, sum(area_cols), 16, fill=1, stroke=1)
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(teal)
    x_pos = left
    for col_w, header in zip(area_cols, area_headers):
        c.drawString(x_pos + 3, y - 12, header)
        x_pos += col_w
    y -= 18
    
    areas_data = [
        ("Área de título", visita.get('area_titulo_ha', ''), visita.get('area_titulo_m2', ''), visita.get('area_titulo_desc', ''), None),
        ("Área base catastral (R1)", visita.get('area_base_catastral_ha', ''), visita.get('area_base_catastral_m2', ''), visita.get('area_base_catastral_desc', 'Datos del R1'), colors.HexColor('#d1fae5')),
        ("Área geográfica (GDB)", visita.get('area_geografica_ha', ''), visita.get('area_geografica_m2', ''), visita.get('area_geografica_desc', 'Calculado del GDB'), colors.HexColor('#dbeafe')),
        ("Área levantamiento topográfico", visita.get('area_levantamiento_ha', ''), visita.get('area_levantamiento_m2', ''), visita.get('area_levantamiento_desc', ''), None),
        ("Área identificación predial", visita.get('area_identificacion_ha', ''), visita.get('area_identificacion_m2', ''), visita.get('area_identificacion_desc', ''), None),
    ]
    
    c.setFont("Helvetica", 8)
    for concepto, ha, m2, desc, bg in areas_data:
        if bg:
            c.setFillColor(bg)
            c.rect(left, y - 16, sum(area_cols), 16, fill=1, stroke=0)
        c.setStrokeColor(colors.HexColor('#99f6e4'))
        c.rect(left, y - 16, sum(area_cols), 16, stroke=1, fill=0)
        c.setFillColor(negro)
        x_pos = left
        for col_w, val in zip(area_cols, [concepto, ha, m2, desc]):
            c.drawString(x_pos + 3, y - 12, str(val)[:int(col_w/4.5)] if val else "-")
            x_pos += col_w
        y -= 16
    y -= 20
    
    # === SECCIÓN 10: INFORMACIÓN DE LOCALIZACIÓN ===
    y = section_header(y, "10", "INFORMACIÓN DE LOCALIZACIÓN (Croquis del terreno y construcciones)", indigo)
    
    fotos = visita.get('fotos_croquis', [])
    if fotos:
        c.setFont("Helvetica", 8)
        c.setFillColor(gris)
        c.drawString(left, y, f"Se adjuntan {len(fotos)} foto(s) del croquis:")
        y -= 15
        
        # Mostrar hasta 4 fotos
        foto_w = 120
        foto_h = 90
        for i, foto in enumerate(fotos[:4]):
            if y < footer_limit + foto_h + 20:
                y = new_page()
            
            try:
                foto_data = foto.get('data', '')
                if foto_data and ',' in foto_data:
                    foto_data = foto_data.split(',')[1]
                if foto_data:
                    img_bytes = base64.b64decode(foto_data)
                    img_reader = ImageReader(io.BytesIO(img_bytes))
                    
                    x = left + (i % 2) * (foto_w + 20)
                    c.drawImage(img_reader, x, y - foto_h, width=foto_w, height=foto_h, preserveAspectRatio=True)
                    
                    c.setFont("Helvetica", 7)
                    c.setFillColor(gris)
                    c.drawString(x, y - foto_h - 10, f"Foto {i+1}: {foto.get('nombre', 'Sin nombre')[:20]}")
                    
                    if i % 2 == 1:
                        y -= foto_h + 25
            except Exception as e:
                logger.warning(f"Error procesando foto {i+1}: {e}")
        
        if len(fotos) % 2 == 1:
            y -= foto_h + 25
    else:
        c.setFont("Helvetica-Oblique", 9)
        c.setFillColor(gris)
        c.drawString(left, y, "No se adjuntaron fotos del croquis.")
        y -= 20
    
    # ==================== PÁGINA 5 ====================
    y = new_page()
    
    # === SECCIÓN 11: COORDENADAS GPS ===
    y = section_header(y, "11", "COORDENADAS GPS DEL PREDIO", azul_claro)
    
    coords = visita.get('coordenadas_gps', {})
    for i, (lbl, val) in enumerate([
        ("Latitud (Y)", coords.get('latitud', '')),
        ("Longitud (X)", coords.get('longitud', ''))
    ]):
        x = left + i * half_w
        c.rect(x, y - 28, half_w - 2, 28, stroke=1, fill=0)
        field_label(x + 3, y - 3, lbl)
        c.setFont("Helvetica", 9)
        c.setFillColor(negro)
        c.drawString(x + 3, y - 18, str(val) if val else "-")
    y -= 32
    
    if coords.get('precision') or coords.get('fecha_captura'):
        c.setFont("Helvetica", 8)
        c.setFillColor(gris)
        prec = f"Precisión: ±{coords.get('precision')}m" if coords.get('precision') else ""
        fecha = f"Capturado: {coords.get('fecha_captura', '')[:19]}" if coords.get('fecha_captura') else ""
        c.drawString(left, y, f"{prec}  {fecha}")
        y -= 15
    y -= 10
    
    # === SECCIÓN 12: OBSERVACIONES ===
    y = section_header(y, "12", "OBSERVACIONES", ambar)
    
    c.rect(left, y - 80, content_width, 80, stroke=1, fill=0)
    obs = visita.get('observaciones_generales', '') or visita.get('observaciones', '')
    if obs:
        c.setFont("Helvetica", 9)
        c.setFillColor(negro)
        # Dividir en líneas
        words = obs.split()
        lines = []
        current_line = ""
        for word in words:
            test = current_line + " " + word if current_line else word
            if c.stringWidth(test, "Helvetica", 9) < content_width - 10:
                current_line = test
            else:
                lines.append(current_line)
                current_line = word
        if current_line:
            lines.append(current_line)
        
        for i, line in enumerate(lines[:6]):
            c.drawString(left + 5, y - 15 - i*12, line)
    else:
        c.setFont("Helvetica-Oblique", 9)
        c.setFillColor(gris)
        c.drawString(left + 5, y - 25, "Sin observaciones")
    
    c.setFont("Helvetica", 7)
    c.setFillColor(gris)
    obs_len = len(obs) if obs else 0
    c.drawRightString(right_margin - 5, y - 75, f"{obs_len}/500 caracteres")
    y -= 90
    
    # === SECCIÓN 13: FIRMAS ===
    if y < footer_limit + 180:
        y = new_page()
    y = section_header(y, "13", "FIRMAS", morado)
    
    firma_h = 70
    
    # Firma del Visitado
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(negro)
    c.drawString(left, y, "Firma del Visitado (Propietario/Atendiente)")
    y -= 12
    
    c.rect(left, y - 20, content_width, 20, stroke=1, fill=0)
    field_label(left + 3, y - 3, "Nombre")
    c.setFont("Helvetica", 9)
    c.setFillColor(negro)
    c.drawString(left + 50, y - 15, visita.get('nombre_visitado', '') or "-")
    y -= 25
    
    # Área de firma visitado
    c.rect(left, y - firma_h, half_w - 5, firma_h, stroke=1, fill=0)
    firma_visitado = visita.get('firma_visitado_base64')
    if firma_visitado:
        try:
            if ',' in firma_visitado:
                firma_visitado = firma_visitado.split(',')[1]
            img_bytes = base64.b64decode(firma_visitado)
            img_reader = ImageReader(io.BytesIO(img_bytes))
            c.drawImage(img_reader, left + 5, y - firma_h + 5, width=half_w - 20, height=firma_h - 10, preserveAspectRatio=True)
        except:
            c.setFont("Helvetica-Oblique", 8)
            c.setFillColor(gris)
            c.drawCentredString(left + half_w/2 - 2, y - firma_h/2, "[Firma digital capturada]")
    else:
        c.setFont("Helvetica-Oblique", 8)
        c.setFillColor(gris)
        c.drawCentredString(left + half_w/2 - 2, y - firma_h/2, "Sin firma")
    
    # Firma del Reconocedor
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(negro)
    c.drawString(left + half_w + 5, y + firma_h + 25, "Firma del Reconocedor de Campo")
    
    c.rect(left + half_w + 5, y - 20 + firma_h + 25, half_w - 5, 20, stroke=1, fill=0)
    field_label(left + half_w + 8, y - 3 + firma_h + 25, "Nombre")
    c.setFont("Helvetica", 9)
    c.setFillColor(negro)
    reconocedor = visita.get('nombre_reconocedor', '') or current_user_email
    c.drawString(left + half_w + 55, y - 15 + firma_h + 25, reconocedor[:30])
    
    # Área de firma reconocedor
    c.rect(left + half_w + 5, y - firma_h, half_w - 5, firma_h, stroke=1, fill=0)
    firma_reconocedor = visita.get('firma_reconocedor_base64')
    if firma_reconocedor:
        try:
            if ',' in firma_reconocedor:
                firma_reconocedor = firma_reconocedor.split(',')[1]
            img_bytes = base64.b64decode(firma_reconocedor)
            img_reader = ImageReader(io.BytesIO(img_bytes))
            c.drawImage(img_reader, left + half_w + 10, y - firma_h + 5, width=half_w - 20, height=firma_h - 10, preserveAspectRatio=True)
        except:
            c.setFont("Helvetica-Oblique", 8)
            c.setFillColor(gris)
            c.drawCentredString(left + half_w + half_w/2, y - firma_h/2, "[Firma digital capturada]")
    else:
        c.setFont("Helvetica-Oblique", 8)
        c.setFillColor(gris)
        c.drawCentredString(left + half_w + half_w/2, y - firma_h/2, "Sin firma")
    
    # Pie de página final
    draw_footer()
    
    # Guardar
    c.save()
    return buffer.getvalue()
