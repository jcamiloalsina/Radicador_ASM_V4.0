"""
Generador de PDF para Informe de Visita - EXACTO al formulario web
Contiene 5 páginas y 13 secciones como el formulario
Color consistente: Verde Emerald (#00b855) de la plataforma
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

# Color principal de la plataforma (Emerald)
VERDE_PRINCIPAL = colors.HexColor('#00b855')  # emerald-600
VERDE_CLARO = colors.HexColor('#e6f7ed')      # emerald-50
VERDE_MEDIO = colors.HexColor('#99dfb7')      # emerald-200
VERDE_OSCURO = colors.HexColor('#007a38')     # emerald-800
GRIS = colors.HexColor('#6b7280')
GRIS_CLARO = colors.HexColor('#f1f5f9')
NEGRO = colors.black
BLANCO = colors.white

def generar_pdf_visita_completo(proyecto, predio, visita, propietarios, construcciones, current_user_email, current_user_name=None):
    """
    Genera el PDF del informe de visita EXACTO al formulario web
    
    Args:
        proyecto: dict con datos del proyecto
        predio: dict con datos del predio (incluye visitado_por, visitado_por_nombre, codigo_homologado)
        visita: dict con datos de la visita (visitaData del frontend)
        propietarios: list de propietarios (visitaPropietarios del frontend)
        construcciones: list de construcciones (visitaConstrucciones del frontend)
        current_user_email: email del usuario actual (NO usar para reconocedor, solo como último fallback)
        current_user_name: nombre del usuario actual (NO usar para reconocedor, solo como último fallback)
    
    Returns:
        bytes: contenido del PDF
    
    IMPORTANTE: El nombre del reconocedor debe obtenerse de los datos guardados en la visita/predio,
    NO del usuario que genera el PDF. Esto permite que un coordinador genere el PDF 
    mostrando el nombre del gestor que realizó la visita.
    """
    # Asegurar que los parámetros no sean None
    visita = visita or {}
    propietarios = propietarios or []
    construcciones = construcciones or []
    proyecto = proyecto or {}
    predio = predio or {}

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
    
    # Márgenes
    left = 1.2 * cm
    right_margin = width - 1.2 * cm
    content_width = right_margin - left
    footer_limit = 2.2 * cm
    
    page_num = 1
    
    def draw_header():
        """Dibuja encabezado institucional"""
        if imagenes_ok:
            c.drawImage(encabezado_img, left - 0.3*cm, height - 2*cm, 
                       width=content_width + 0.6*cm, height=1.8*cm, 
                       preserveAspectRatio=True, mask='auto')
        else:
            c.setFillColor(VERDE_PRINCIPAL)
            c.setFont("Helvetica-Bold", 12)
            c.drawCentredString(width/2, height - 1.2*cm, "Asociación de Municipios del Catatumbo, Provincia de Ocaña y Sur del Cesar – Asomunicipios")
        return height - 2.5*cm
    
    def draw_footer():
        """Dibuja pie de página"""
        if imagenes_ok:
            c.drawImage(pie_pagina_img, 0, 0, width=width, height=1.8*cm, 
                       preserveAspectRatio=False, mask='auto')
        else:
            c.setFillColor(VERDE_PRINCIPAL)
            c.rect(0, 0, width, 22, fill=1, stroke=0)
        # Número de página
        c.setFont("Helvetica", 8)
        c.setFillColor(GRIS)
        c.drawRightString(right_margin, 0.8*cm, f"Página {page_num}/5")
    
    def new_page():
        """Crear nueva página"""
        nonlocal page_num
        draw_footer()
        c.showPage()
        page_num += 1
        return draw_header()
    
    def section_header(y, num, title):
        """Dibuja encabezado de sección con color verde teal"""
        if y < footer_limit + 30:
            y = new_page()
        c.setFillColor(VERDE_PRINCIPAL)
        c.rect(left, y - 14, content_width, 16, fill=1, stroke=0)
        c.setFillColor(BLANCO)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(left + 4, y - 10, f"{num}. {title}")
        return y - 20
    
    def field_row(y, fields, col_widths=None):
        """Dibuja una fila de campos con labels y valores"""
        if y < footer_limit + 35:
            y = new_page()
        
        n = len(fields)
        if col_widths is None:
            col_widths = [content_width / n] * n
        
        c.setStrokeColor(VERDE_MEDIO)
        x = left
        for i, (label, value) in enumerate(fields):
            w = col_widths[i] if i < len(col_widths) else col_widths[-1]
            # Caja
            c.rect(x, y - 26, w - 2, 26, stroke=1, fill=0)
            # Label
            c.setFont("Helvetica", 7)
            c.setFillColor(GRIS)
            c.drawString(x + 3, y - 8, label)
            # Valor
            c.setFont("Helvetica", 9)
            c.setFillColor(NEGRO)
            val_str = str(value)[:int(w/4.5)] if value else "-"
            c.drawString(x + 3, y - 20, val_str)
            x += w
        return y - 30
    
    def field_row_disabled(y, fields, col_widths=None):
        """Fila con fondo gris (campos deshabilitados)"""
        if y < footer_limit + 35:
            y = new_page()
        
        n = len(fields)
        if col_widths is None:
            col_widths = [content_width / n] * n
        
        c.setStrokeColor(VERDE_MEDIO)
        x = left
        for i, (label, value) in enumerate(fields):
            w = col_widths[i] if i < len(col_widths) else col_widths[-1]
            # Fondo gris
            c.setFillColor(GRIS_CLARO)
            c.rect(x, y - 26, w - 2, 26, fill=1, stroke=1)
            # Label
            c.setFont("Helvetica", 7)
            c.setFillColor(GRIS)
            c.drawString(x + 3, y - 8, label)
            # Valor
            c.setFont("Helvetica-Bold", 9)
            c.setFillColor(NEGRO)
            val_str = str(value)[:int(w/4.5)] if value else "-"
            c.drawString(x + 3, y - 20, val_str)
            x += w
        return y - 30
    
    def full_width_field(y, label, value, highlight=False):
        """Campo de ancho completo"""
        if y < footer_limit + 35:
            y = new_page()
        
        c.setStrokeColor(VERDE_MEDIO)
        if highlight:
            c.setFillColor(VERDE_CLARO)
            c.rect(left, y - 26, content_width, 26, fill=1, stroke=1)
        else:
            c.rect(left, y - 26, content_width, 26, stroke=1, fill=0)
        
        c.setFont("Helvetica", 7)
        c.setFillColor(GRIS)
        c.drawString(left + 3, y - 8, label)
        
        c.setFont("Helvetica-Bold" if highlight else "Helvetica", 9)
        c.setFillColor(colors.HexColor('#065f46') if highlight else NEGRO)
        c.drawString(left + 3, y - 20, str(value)[:90] if value else "-")
        return y - 30
    
    # ==================== PÁGINA 1 ====================
    y = draw_header()
    
    # Título principal
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(NEGRO)
    c.drawCentredString(width/2, y, "INFORME DE VISITA DE CAMPO")
    y -= 12
    c.setFont("Helvetica", 9)
    c.drawCentredString(width/2, y, f"Actualización Catastral - Municipio de {proyecto.get('municipio', '').upper()}")
    y -= 8
    c.setFont("Helvetica", 7)
    c.setFillColor(GRIS)
    c.drawRightString(right_margin, y, "FO-FAC-PC01-02 v2")
    y -= 16
    
    # === SECCIÓN 1: DATOS DE LA VISITA ===
    y = section_header(y, "1", "DATOS DE LA VISITA")
    
    third_w = content_width / 3
    y = field_row(y, [
        ("Fecha de Visita *", visita.get('fecha_visita', '')),
        ("Hora *", visita.get('hora_visita', '')),
        ("Persona que Atiende *", visita.get('persona_atiende', ''))
    ], [third_w, third_w, third_w])
    
    # Relación con el predio
    c.setFont("Helvetica", 7)
    c.setFillColor(GRIS)
    c.drawString(left, y, "Relación con el Predio:")
    relacion = visita.get('relacion_predio', '')
    c.setFont("Helvetica", 8)
    c.setFillColor(NEGRO)
    opciones_rel = ['propietario', 'poseedor', 'arrendatario', 'familiar', 'encargado', 'otro']
    for i, r in enumerate(opciones_rel):
        x = left + 90 + i * 65
        marker = "●" if relacion == r else "○"
        c.drawString(x, y, f"{marker} {r.capitalize()}")
    y -= 14
    
    # Acceso
    c.setFont("Helvetica", 7)
    c.setFillColor(GRIS)
    c.drawString(left, y, "¿Se pudo acceder al predio?")
    acceso = visita.get('acceso_predio', 'si')
    c.setFont("Helvetica", 8)
    c.setFillColor(NEGRO)
    for i, (val, label) in enumerate([('si', 'Sí'), ('parcial', 'Parcial'), ('no', 'No')]):
        x = left + 130 + i * 55
        marker = "●" if acceso == val else "○"
        c.drawString(x, y, f"{marker} {label}")
    y -= 18
    
    # === SECCIÓN 2: INFORMACIÓN BÁSICA DEL PREDIO ===
    y = section_header(y, "2", "INFORMACIÓN BÁSICA DEL PREDIO")
    
    half_w = content_width / 2
    y = field_row_disabled(y, [
        ("Departamento", "Norte de Santander"),
        ("Municipio", proyecto.get('municipio', ''))
    ], [half_w, half_w])
    
    # Número Predial (destacado)
    y = full_width_field(y, "Número Predial (30 dígitos)", 
                         predio.get('codigo_predial', predio.get('numero_predial', '')), 
                         highlight=True)
    
    # Código Homologado, Tipo, Ubicación
    zona = "Rural" if str(predio.get('codigo_predial', ''))[5:7] == '00' else "Urbano"
    y = field_row(y, [
        ("Código Homologado", predio.get('codigo_homologado', '')),
        ("Tipo (verificar)", visita.get('tipo_predio', 'NPH')),
        ("Ubicación", zona)
    ], [third_w, third_w, third_w])
    
    # Dirección
    direccion = visita.get('direccion_visita', predio.get('direccion', ''))
    y = full_width_field(y, "Dirección (verificar)", direccion)
    
    # Destino Económico - Solo mostrar el seleccionado
    destino = visita.get('destino_economico_visita', predio.get('destino_economico', ''))
    destinos_map = {
        'A': 'Habitacional', 'B': 'Industrial', 'C': 'Comercial', 'D': 'Agropecuario',
        'E': 'Minero', 'F': 'Cultural', 'G': 'Recreacional', 'H': 'Salubridad',
        'I': 'Institucional', 'J': 'Educativo', 'K': 'Religioso', 'L': 'Agrícola'
    }
    destino_texto = f"{destino} - {destinos_map.get(destino, 'No especificado')}" if destino else "No especificado"
    y = full_width_field(y, "Destino Económico", destino_texto)
    
    # Áreas
    y = field_row(y, [
        ("Área Terreno (m²)", visita.get('area_terreno_visita', predio.get('area_terreno', ''))),
        ("Área Construida (m²)", visita.get('area_construida_visita', predio.get('area_construida', '')))
    ], [half_w, half_w])
    
    # === SECCIÓN 3: PH === (Solo mostrar si tiene datos)
    ph_fields = ['ph_area_coeficiente', 'ph_area_construida_privada', 'ph_area_construida_comun', 
                 'ph_copropiedad', 'ph_predio_asociado', 'ph_torre', 'ph_apartamento']
    has_ph_data = any(visita.get(f) for f in ph_fields)
    
    if has_ph_data:
        y = section_header(y, "3", "PH (Propiedad Horizontal)")
        
        y = field_row(y, [
            ("Área por Coeficiente", visita.get('ph_area_coeficiente', '')),
            ("Área Construida Privada", visita.get('ph_area_construida_privada', '')),
            ("Área Construida Común", visita.get('ph_area_construida_comun', ''))
        ], [third_w, third_w, third_w])
        
        y = field_row(y, [
            ("Copropiedad", visita.get('ph_copropiedad', '')),
            ("Predio Asociado", visita.get('ph_predio_asociado', ''))
        ], [half_w, half_w])
        
        y = field_row(y, [
            ("Torre", visita.get('ph_torre', '')),
            ("Apartamento", visita.get('ph_apartamento', ''))
        ], [half_w, half_w])
    
    # === SECCIÓN 4: CONDOMINIO === (Solo mostrar si tiene datos)
    cond_fields = ['cond_area_terreno_comun', 'cond_area_terreno_privada', 'cond_area_construida_privada',
                   'cond_area_construida_comun', 'cond_condominio', 'cond_predio_asociado', 'cond_unidad', 'cond_casa']
    has_cond_data = any(visita.get(f) for f in cond_fields)
    
    if has_cond_data:
        y = section_header(y, "4", "Condominio")
        
        y = field_row(y, [
            ("Área Terreno Común", visita.get('cond_area_terreno_comun', '')),
            ("Área Terreno Privada", visita.get('cond_area_terreno_privada', ''))
        ], [half_w, half_w])
        
        y = field_row(y, [
            ("Área Construida Privada", visita.get('cond_area_construida_privada', '')),
            ("Área Construida Común", visita.get('cond_area_construida_comun', ''))
        ], [half_w, half_w])
        
        y = field_row(y, [
            ("Condominio", visita.get('cond_condominio', '')),
            ("Predio Asociado", visita.get('cond_predio_asociado', ''))
        ], [half_w, half_w])
        
        y = field_row(y, [
            ("Unidad", visita.get('cond_unidad', '')),
            ("Casa", visita.get('cond_casa', ''))
        ], [half_w, half_w])
    
    # === SECCIÓN 5: INFORMACIÓN JURÍDICA Y PROPIETARIOS ===
    # Verificar si hay espacio suficiente para la sección 5, sino crear nueva página
    if y < footer_limit + 150:  # Necesita espacio para header + algunos campos
        y = new_page()
    
    y = section_header(y, "5", "INFORMACIÓN JURÍDICA Y PROPIETARIOS")
    
    y = field_row(y, [
        ("Matrícula Inmobiliaria", visita.get('jur_matricula', predio.get('matricula_inmobiliaria', ''))),
        ("Tipo Doc.", visita.get('jur_tipo_doc', '')),
        ("No. Documento", visita.get('jur_numero_doc', ''))
    ], [third_w, third_w, third_w])
    
    y = field_row(y, [
        ("Notaría", visita.get('jur_notaria', '')),
        ("Fecha", visita.get('jur_fecha', '')),
        ("Ciudad", visita.get('jur_ciudad', ''))
    ], [third_w, third_w, third_w])
    
    y = full_width_field(y, "Razón Social (si aplica)", visita.get('jur_razon_social', ''))
    
    # Tabla de Propietarios
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(VERDE_PRINCIPAL)
    c.drawString(left, y, "Propietarios / Poseedores")
    y -= 12
    
    # Encabezado tabla
    cols = [25, 110, 45, 75, 65, 55, 75]
    headers = ["#", "Nombre Completo", "Tipo", "Documento", "Estado", "Género", "Grupo Étnico"]
    c.setFillColor(VERDE_CLARO)
    c.rect(left, y - 14, sum(cols), 14, fill=1, stroke=0)
    c.setStrokeColor(VERDE_MEDIO)
    c.rect(left, y - 14, sum(cols), 14, stroke=1, fill=0)
    c.setFont("Helvetica-Bold", 6)
    c.setFillColor(VERDE_PRINCIPAL)
    x_pos = left
    for col_w, header in zip(cols, headers):
        c.drawString(x_pos + 2, y - 10, header)
        x_pos += col_w
    y -= 16
    
    # Filas de propietarios
    c.setFont("Helvetica", 7)
    c.setFillColor(NEGRO)
    # Usar propietarios de la visita o del predio
    props_list = propietarios if propietarios else predio.get('propietarios', [])
    for idx, prop in enumerate(props_list[:6], 1):
        nombre = f"{prop.get('nombre', '')} {prop.get('primer_apellido', '')} {prop.get('segundo_apellido', '')}".strip()
        if not nombre:
            nombre = prop.get('nombre_completo', prop.get('razon_social', '-'))
        row_data = [
            str(idx),
            nombre[:22] if nombre else "-",
            prop.get('tipo_documento', '-')[:4],
            prop.get('numero_documento', prop.get('documento', '-')),
            prop.get('estado', prop.get('estado_civil', '-'))[:10],
            prop.get('genero', '-')[:6],
            prop.get('grupo_etnico', '-')[:12]
        ]
        c.setStrokeColor(VERDE_MEDIO)
        c.rect(left, y - 11, sum(cols), 11, stroke=1, fill=0)
        x_pos = left
        for col_w, val in zip(cols, row_data):
            c.drawString(x_pos + 2, y - 8, str(val))
            x_pos += col_w
        y -= 11
    y -= 8
    
    # === SECCIÓN 6: DATOS DE NOTIFICACIÓN ===
    y = section_header(y, "6", "DATOS DE NOTIFICACIÓN")
    
    y = field_row(y, [
        ("Teléfono", visita.get('not_telefono', '')),
        ("Correo Electrónico", visita.get('not_correo', '')),
        ("¿Autoriza notif. correo?", "Sí" if visita.get('not_autoriza_correo') == 'si' else "No")
    ], [third_w, third_w, third_w])
    
    y = full_width_field(y, "Dirección de Notificación", visita.get('not_direccion', ''))
    
    y = field_row(y, [
        ("Departamento", visita.get('not_departamento', 'Norte de Santander')),
        ("Municipio", visita.get('not_municipio', ''))
    ], [half_w, half_w])
    
    y = field_row(y, [
        ("Vereda", visita.get('not_vereda', '')),
        ("Corregimiento", visita.get('not_corregimiento', ''))
    ], [half_w, half_w])
    
    # Datos adicionales (más espacio)
    c.setStrokeColor(VERDE_MEDIO)
    c.rect(left, y - 40, content_width, 40, stroke=1, fill=0)
    c.setFont("Helvetica", 7)
    c.setFillColor(GRIS)
    c.drawString(left + 3, y - 8, "Datos Adicionales")
    c.setFont("Helvetica", 8)
    c.setFillColor(NEGRO)
    datos_adic = visita.get('not_datos_adicionales', '')
    if datos_adic:
        lines = [datos_adic[i:i+95] for i in range(0, min(len(datos_adic), 190), 95)]
        for i, line in enumerate(lines[:2]):
            c.drawString(left + 3, y - 20 - i*10, line)
    y -= 45
    
    # ==================== PÁGINA 3 ====================
    y = new_page()
    
    # === SECCIÓN 7: INFORMACIÓN DE CONSTRUCCIONES === (Solo si hay construcciones)
    if construcciones and any(c.get('codigo_uso') or c.get('area') for c in construcciones):
        y = section_header(y, "7", "INFORMACIÓN DE CONSTRUCCIONES")
        
        # Tabla de construcciones
        cons_cols = [40, 75, 70, 60, 70, 55]
        cons_headers = ["Unidad", "Código Uso", "Área (m²)", "Puntaje", "Año Const.", "N° Pisos"]
        c.setFillColor(VERDE_CLARO)
        c.rect(left, y - 14, sum(cons_cols), 14, fill=1, stroke=0)
        c.setStrokeColor(VERDE_MEDIO)
        c.rect(left, y - 14, sum(cons_cols), 14, stroke=1, fill=0)
        c.setFont("Helvetica-Bold", 7)
        c.setFillColor(VERDE_PRINCIPAL)
        x_pos = left
        for col_w, header in zip(cons_cols, cons_headers):
            c.drawString(x_pos + 2, y - 10, header)
            x_pos += col_w
        y -= 16
        
        c.setFont("Helvetica", 8)
        c.setFillColor(NEGRO)
        for cons in construcciones[:8]:
            if cons.get('codigo_uso') or cons.get('area'):
                c.setStrokeColor(VERDE_MEDIO)
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
        y -= 5
    
    # === SECCIÓN 8: CALIFICACIÓN === (Solo si hay datos de calificación)
    calif_est = visita.get('calif_estructura', {})
    calif_acab = visita.get('calif_acabados', {})
    calif_bano = visita.get('calif_bano', {})
    calif_cocina = visita.get('calif_cocina', {})
    calif_ind = visita.get('calif_industria', {})
    calif_gen = visita.get('calif_generales', {})
    
    has_calificacion = any([
        any(calif_est.values()),
        any(calif_acab.values()),
        any(calif_bano.values()),
        any(calif_cocina.values()),
        any(calif_ind.values()),
        any(calif_gen.values())
    ])
    
    if has_calificacion:
        y = section_header(y, "8", "CALIFICACIÓN")
        
        quarter_w = content_width / 4
        
        # Helper para dibujar subsección de calificación (compacta)
        def draw_calif_subsection(y_pos, title, data, fields):
            # Solo mostrar si hay datos
            has_data = any(data.get(key) for _, key in fields)
            if not has_data:
                return y_pos
            
            box_height = 35
            c.setFillColor(GRIS_CLARO)
            c.rect(left, y_pos - box_height, content_width, box_height, fill=1, stroke=1)
            c.setFont("Helvetica-Bold", 7)
            c.setFillColor(VERDE_PRINCIPAL)
            c.drawString(left + 3, y_pos - 10, title)
            
            c.setFont("Helvetica", 7)
            c.setFillColor(GRIS)
            col_w = content_width / len(fields)
            for i, (lbl, key) in enumerate(fields):
                x = left + i * col_w
                c.drawString(x + 3, y_pos - 20, lbl)
                c.setFont("Helvetica", 8)
                c.setFillColor(NEGRO)
                c.drawString(x + 3, y_pos - 30, str(data.get(key, '')) or "-")
                c.setFont("Helvetica", 7)
                c.setFillColor(GRIS)
            return y_pos - box_height - 3
        
        # 8.1 ESTRUCTURA
        y = draw_calif_subsection(y, "8.1 ESTRUCTURA", calif_est, 
            [("Armazón", "armazon"), ("Muros", "muros"), ("Cubierta", "cubierta"), ("Conservación", "conservacion")])
        
        # 8.2 ACABADOS
        y = draw_calif_subsection(y, "8.2 ACABADOS PRINCIPALES", calif_acab,
            [("Fachadas", "fachadas"), ("Cubrim. Muros", "cubrim_muros"), ("Pisos", "pisos"), ("Conservación", "conservacion")])
        
        # 8.3 BAÑO
        y = draw_calif_subsection(y, "8.3 BAÑO", calif_bano,
            [("Tamaño", "tamano"), ("Enchape", "enchape"), ("Mobiliario", "mobiliario"), ("Conservación", "conservacion")])
        
        # 8.4 COCINA
        y = draw_calif_subsection(y, "8.4 COCINA", calif_cocina,
            [("Tamaño", "tamano"), ("Enchape", "enchape"), ("Mobiliario", "mobiliario"), ("Conservación", "conservacion")])
        
        # 8.5 INDUSTRIA (solo si aplica)
        y = draw_calif_subsection(y, "8.5 COMPLEMENTO INDUSTRIA", calif_ind,
            [("Cercha Mad.", "cercha_madera"), ("C.Met.Liv.", "cercha_metalica_liviana"), 
             ("C.Met.Med.", "cercha_metalica_mediana"), ("C.Met.Pes.", "cercha_metalica_pesada"), ("Altura", "altura")])
        
        # 8.6 DATOS GENERALES
        fifth_w = content_width / 5
        has_gen_data = any(calif_gen.get(k) for k in ['total_pisos', 'total_habitaciones', 'total_banos', 'total_locales', 'area_total_construida'])
        
        if has_gen_data:
            c.setFillColor(VERDE_CLARO)
            c.rect(left, y - 35, content_width, 35, fill=1, stroke=1)
            c.setFont("Helvetica-Bold", 7)
            c.setFillColor(VERDE_PRINCIPAL)
            c.drawString(left + 3, y - 10, "8.6 DATOS GENERALES DE CONSTRUCCIÓN")
            
            c.setFont("Helvetica", 7)
            c.setFillColor(GRIS)
            for i, (lbl, key) in enumerate([("Total Pisos", "total_pisos"), ("Habitaciones", "total_habitaciones"), 
                                             ("Baños", "total_banos"), ("Locales", "total_locales"), ("Área Total", "area_total_construida")]):
                x = left + i * fifth_w
                c.drawString(x + 2, y - 20, lbl)
                c.setFont("Helvetica", 8)
                c.setFillColor(NEGRO)
                c.drawString(x + 2, y - 30, str(calif_gen.get(key, '')) or "-")
                c.setFont("Helvetica", 7)
                c.setFillColor(GRIS)
            y -= 40
    
    # === SECCIÓN 9: RESUMEN ÁREAS DE TERRENO === (Solo si hay datos)
    areas_terreno = visita.get('areas_terreno', [])
    has_areas = areas_terreno and any(a.get('hectareas') or a.get('metros') for a in areas_terreno)
    
    if has_areas or visita.get('area_terreno_visita') or predio.get('area_terreno'):
        if y < footer_limit + 120:
            y = new_page()
        
        y = section_header(y, "9", "RESUMEN ÁREAS DE TERRENO")
        
        # Tabla de áreas
        area_cols = [170, 80, 80, 170]
        area_headers = ["Área de terreno según:", "Ha", "m²", "Descripción"]
        c.setFillColor(VERDE_CLARO)
        c.rect(left, y - 14, sum(area_cols), 14, fill=1, stroke=0)
        c.setStrokeColor(VERDE_MEDIO)
        c.rect(left, y - 14, sum(area_cols), 14, stroke=1, fill=0)
        c.setFont("Helvetica-Bold", 7)
        c.setFillColor(VERDE_PRINCIPAL)
        x_pos = left
        for col_w, header in zip(area_cols, area_headers):
            c.drawString(x_pos + 3, y - 10, header)
            x_pos += col_w
        y -= 16
        
        areas_data = [
            ("Área de título", visita.get('area_titulo_ha', ''), visita.get('area_titulo_m2', ''), visita.get('area_titulo_desc', ''), None),
            ("Área base catastral (R1)", visita.get('area_base_catastral_ha', ''), visita.get('area_base_catastral_m2', predio.get('area_terreno', '')), "Datos del R1", VERDE_CLARO),
            ("Área geográfica (GDB)", visita.get('area_geografica_ha', ''), visita.get('area_geografica_m2', ''), "Calculado del GDB", colors.HexColor('#dbeafe')),
            ("Área levantamiento topográfico", visita.get('area_levantamiento_ha', ''), visita.get('area_levantamiento_m2', ''), visita.get('area_levantamiento_desc', ''), None),
            ("Área identificación predial", visita.get('area_identificacion_ha', ''), visita.get('area_identificacion_m2', ''), visita.get('area_identificacion_desc', ''), None),
        ]
        
        c.setFont("Helvetica", 8)
        for concepto, ha, m2, desc, bg in areas_data:
            if bg:
                c.setFillColor(bg)
                c.rect(left, y - 14, sum(area_cols), 14, fill=1, stroke=0)
            c.setStrokeColor(VERDE_MEDIO)
            c.rect(left, y - 14, sum(area_cols), 14, stroke=1, fill=0)
            c.setFillColor(NEGRO)
            x_pos = left
            for col_w, val in zip(area_cols, [concepto, ha, m2, desc]):
                c.drawString(x_pos + 3, y - 10, str(val)[:int(col_w/4.5)] if val else "-")
                x_pos += col_w
            y -= 14
        y -= 10
    
    # === SECCIÓN 10: INFORMACIÓN DE LOCALIZACIÓN ===
    fotos = visita.get('fotos_croquis', [])
    if fotos:
        if y < footer_limit + 150:
            y = new_page()
        y = section_header(y, "10", "INFORMACIÓN DE LOCALIZACIÓN (Croquis del terreno y construcciones)")
        
        c.setFont("Helvetica", 8)
        c.setFillColor(GRIS)
        c.drawString(left, y, f"Se adjuntan {len(fotos)} foto(s) del croquis:")
        y -= 12
        
        # Mostrar hasta 4 fotos (2x2)
        foto_w = 140
        foto_h = 100
        for i, foto in enumerate(fotos[:4]):
            if y < footer_limit + foto_h + 25:
                y = new_page()
            
            try:
                foto_data = foto.get('data', '')
                if foto_data and ',' in foto_data:
                    foto_data = foto_data.split(',')[1]
                if foto_data:
                    img_bytes = base64.b64decode(foto_data)
                    img_reader = ImageReader(io.BytesIO(img_bytes))
                    
                    col = i % 2
                    x = left + col * (foto_w + 15)
                    c.drawImage(img_reader, x, y - foto_h, width=foto_w, height=foto_h, preserveAspectRatio=True)
                    
                    c.setFont("Helvetica", 7)
                    c.setFillColor(GRIS)
                    c.drawString(x, y - foto_h - 10, f"Foto {i+1}: {foto.get('nombre', 'Sin nombre')[:25]}")
                    
                    if col == 1:
                        y -= foto_h + 20
            except Exception as e:
                logger.warning(f"Error procesando foto {i+1}: {e}")
        
        if len(fotos) % 2 == 1:
            y -= foto_h + 20
    
    # === SECCIÓN 11: COORDENADAS GPS ===
    coords = visita.get('coordenadas_gps', {})
    if coords.get('latitud') or coords.get('longitud'):
        if y < footer_limit + 50:
            y = new_page()
        y = section_header(y, "11", "COORDENADAS GPS DEL PREDIO")
        
        y = field_row(y, [
            ("Latitud (Y)", coords.get('latitud', '')),
            ("Longitud (X)", coords.get('longitud', ''))
        ], [half_w, half_w])
    
    if coords.get('precision') or coords.get('fecha_captura'):
        c.setFont("Helvetica", 8)
        c.setFillColor(GRIS)
        info_parts = []
        if coords.get('precision'):
            info_parts.append(f"Precisión: ±{coords.get('precision')}m")
        if coords.get('fecha_captura'):
            info_parts.append(f"Capturado: {str(coords.get('fecha_captura'))[:19]}")
        c.drawString(left, y, "  |  ".join(info_parts))
        y -= 12
    y -= 8
    
    # === SECCIÓN 12: OBSERVACIONES ===
    y = section_header(y, "12", "OBSERVACIONES")
    
    c.setStrokeColor(VERDE_MEDIO)
    c.rect(left, y - 75, content_width, 75, stroke=1, fill=0)
    obs = visita.get('observaciones_generales', '') or visita.get('observaciones', '')
    if obs:
        c.setFont("Helvetica", 9)
        c.setFillColor(NEGRO)
        # Dividir en líneas
        words = obs.split()
        lines = []
        current_line = ""
        for word in words:
            test = current_line + " " + word if current_line else word
            if c.stringWidth(test, "Helvetica", 9) < content_width - 15:
                current_line = test
            else:
                lines.append(current_line)
                current_line = word
        if current_line:
            lines.append(current_line)
        
        for i, line in enumerate(lines[:5]):
            c.drawString(left + 5, y - 15 - i*12, line)
    else:
        c.setFont("Helvetica-Oblique", 9)
        c.setFillColor(GRIS)
        c.drawString(left + 5, y - 25, "Sin observaciones")
    
    c.setFont("Helvetica", 7)
    c.setFillColor(GRIS)
    obs_len = len(obs) if obs else 0
    c.drawRightString(right_margin - 5, y - 70, f"{obs_len}/500 caracteres")
    y -= 85
    
    # === SECCIÓN 13: FIRMAS ===
    y = section_header(y, "13", "FIRMAS")
    
    firma_h = 65
    
    # Dos columnas para firmas
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(NEGRO)
    c.drawString(left, y, "Firma del Visitado (Propietario/Atendiente)")
    c.drawString(left + half_w + 5, y, "Firma del Reconocedor de Campo")
    y -= 12
    
    # Nombre del visitado
    c.setStrokeColor(VERDE_MEDIO)
    c.rect(left, y - 18, half_w - 5, 18, stroke=1, fill=0)
    c.setFont("Helvetica", 7)
    c.setFillColor(GRIS)
    c.drawString(left + 3, y - 6, "Nombre")
    c.setFont("Helvetica", 9)
    c.setFillColor(NEGRO)
    # Obtener nombre del visitado con fallback seguro
    nombre_visitado = visita.get('nombre_visitado') or visita.get('persona_atiende') or "-"
    c.drawString(left + 45, y - 13, (nombre_visitado[:30] if nombre_visitado else "-"))
    
    # Nombre del reconocedor
    c.rect(left + half_w + 5, y - 18, half_w - 5, 18, stroke=1, fill=0)
    c.setFont("Helvetica", 7)
    c.setFillColor(GRIS)
    c.drawString(left + half_w + 8, y - 6, "Nombre")
    c.setFont("Helvetica", 9)
    c.setFillColor(NEGRO)
    # IMPORTANTE: Prioridad de reconocedor debe ser desde los datos guardados, NO el usuario actual
    # Esto permite que un coordinador genere el PDF mostrando el nombre del gestor que hizo la visita
    # Prioridad: 
    #   1. nombre_reconocedor de visita (ingresado manualmente)
    #   2. nombre_reconocedor del predio (guardado al registrar visita)
    #   3. visitado_por_nombre del predio (guardado al cambiar estado a visitado)
    #   4. visitado_por del predio (email del gestor que visitó)
    #   5. Solo como ÚLTIMO recurso: nombre/email actual (raramente debería usarse)
    reconocedor = (
        visita.get('nombre_reconocedor', '') or 
        predio.get('nombre_reconocedor', '') or
        predio.get('visitado_por_nombre', '') or
        predio.get('visitado_por', '') or
        current_user_name or 
        current_user_email
    )
    c.drawString(left + half_w + 50, y - 13, str(reconocedor)[:30])
    y -= 22
    
    # Áreas de firma
    c.rect(left, y - firma_h, half_w - 5, firma_h, stroke=1, fill=0)
    c.rect(left + half_w + 5, y - firma_h, half_w - 5, firma_h, stroke=1, fill=0)
    
    # Firma visitado
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
            c.setFillColor(GRIS)
            c.drawCentredString(left + (half_w - 5)/2, y - firma_h/2, "[Firma digital capturada]")
    else:
        c.setFont("Helvetica-Oblique", 8)
        c.setFillColor(GRIS)
        c.drawCentredString(left + (half_w - 5)/2, y - firma_h/2, "Sin firma")
    
    # Firma reconocedor
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
            c.setFillColor(GRIS)
            c.drawCentredString(left + half_w + 5 + (half_w - 5)/2, y - firma_h/2, "[Firma digital capturada]")
    else:
        c.setFont("Helvetica-Oblique", 8)
        c.setFillColor(GRIS)
        c.drawCentredString(left + half_w + 5 + (half_w - 5)/2, y - firma_h/2, "Sin firma")
    
    # Pie de página final
    draw_footer()
    
    # Guardar
    c.save()
    return buffer.getvalue()
