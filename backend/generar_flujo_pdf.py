#!/usr/bin/env python3
"""
Generador de PDF del Flujo de Radicación de Trámites - Asomunicipios
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Circle
from reportlab.graphics import renderPDF
from io import BytesIO
import os

def create_flow_diagram():
    """Crea un diagrama visual del flujo de estados"""
    drawing = Drawing(500, 120)
    
    # Colores
    colors_map = {
        'radicado': colors.HexColor('#6366f1'),      # Indigo
        'asignado': colors.HexColor('#eab308'),      # Yellow
        'en_proceso': colors.HexColor('#0ea5e9'),    # Sky blue
        'revision': colors.HexColor('#a855f7'),      # Purple
        'aprobado': colors.HexColor('#14b8a6'),      # Teal
        'finalizado': colors.HexColor('#22c55e'),    # Green
    }
    
    estados = ['Radicado', 'Asignado', 'En Proceso', 'En Revisión', 'Aprobado', 'Finalizado']
    keys = ['radicado', 'asignado', 'en_proceso', 'revision', 'aprobado', 'finalizado']
    
    x_start = 20
    y_center = 60
    box_width = 70
    box_height = 35
    spacing = 10
    
    for i, (estado, key) in enumerate(zip(estados, keys)):
        x = x_start + i * (box_width + spacing)
        
        # Rectángulo con bordes redondeados (simulado)
        rect = Rect(x, y_center - box_height/2, box_width, box_height, 
                   fillColor=colors_map[key], strokeColor=colors_map[key], rx=5, ry=5)
        drawing.add(rect)
        
        # Número del paso
        num = String(x + 5, y_center + 5, str(i+1), fontSize=10, fillColor=colors.white, fontName='Helvetica-Bold')
        drawing.add(num)
        
        # Texto del estado
        text = String(x + box_width/2, y_center - 5, estado, fontSize=8, 
                     fillColor=colors.white, fontName='Helvetica-Bold', textAnchor='middle')
        drawing.add(text)
        
        # Flecha hacia el siguiente (excepto el último)
        if i < len(estados) - 1:
            arrow_x = x + box_width + 2
            line = Line(arrow_x, y_center, arrow_x + spacing - 4, y_center, 
                       strokeColor=colors.HexColor('#64748b'), strokeWidth=2)
            drawing.add(line)
            # Punta de flecha
            arrow_head = Line(arrow_x + spacing - 8, y_center - 3, arrow_x + spacing - 4, y_center,
                             strokeColor=colors.HexColor('#64748b'), strokeWidth=2)
            drawing.add(arrow_head)
            arrow_head2 = Line(arrow_x + spacing - 8, y_center + 3, arrow_x + spacing - 4, y_center,
                              strokeColor=colors.HexColor('#64748b'), strokeWidth=2)
            drawing.add(arrow_head2)
    
    # Estados alternativos (Devuelto y Rechazado)
    y_alt = 15
    
    # Devuelto
    rect_dev = Rect(200, y_alt - 12, 60, 24, fillColor=colors.HexColor('#f97316'), 
                   strokeColor=colors.HexColor('#f97316'), rx=3, ry=3)
    drawing.add(rect_dev)
    text_dev = String(230, y_alt - 3, 'Devuelto', fontSize=8, fillColor=colors.white, 
                     fontName='Helvetica-Bold', textAnchor='middle')
    drawing.add(text_dev)
    
    # Rechazado
    rect_rech = Rect(280, y_alt - 12, 60, 24, fillColor=colors.HexColor('#ef4444'), 
                    strokeColor=colors.HexColor('#ef4444'), rx=3, ry=3)
    drawing.add(rect_rech)
    text_rech = String(310, y_alt - 3, 'Rechazado', fontSize=8, fillColor=colors.white, 
                      fontName='Helvetica-Bold', textAnchor='middle')
    drawing.add(text_rech)
    
    # Nota de estados alternativos
    note = String(250, y_alt + 20, '(Estados alternativos)', fontSize=7, 
                 fillColor=colors.HexColor('#64748b'), textAnchor='middle')
    drawing.add(note)
    
    return drawing

def generate_pdf(output_path):
    """Genera el PDF completo del flujo de radicados"""
    
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=50,
        leftMargin=50,
        topMargin=50,
        bottomMargin=50
    )
    
    styles = getSampleStyleSheet()
    
    # Estilos personalizados
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#065f46'),
        alignment=TA_CENTER,
        spaceAfter=20,
        fontName='Helvetica-Bold'
    )
    
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#0f766e'),
        alignment=TA_CENTER,
        spaceAfter=30,
        fontName='Helvetica'
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#1e3a5f'),
        spaceBefore=20,
        spaceAfter=10,
        fontName='Helvetica-Bold'
    )
    
    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#334155'),
        alignment=TA_JUSTIFY,
        spaceAfter=8,
        leading=14
    )
    
    bullet_style = ParagraphStyle(
        'CustomBullet',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#334155'),
        leftIndent=20,
        spaceAfter=4,
        leading=13
    )
    
    # Contenido del documento
    story = []
    
    # Título principal
    story.append(Paragraph("ASOMUNICIPIOS", title_style))
    story.append(Paragraph("Sistema de Gestión Catastral", subtitle_style))
    story.append(Spacer(1, 10))
    story.append(Paragraph("Flujo de Radicación de Trámites", ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#1e293b'),
        alignment=TA_CENTER,
        spaceAfter=30
    )))
    
    # Diagrama de flujo
    story.append(Paragraph("1. Diagrama del Flujo de Estados", heading_style))
    story.append(Spacer(1, 10))
    
    flow_diagram = create_flow_diagram()
    story.append(flow_diagram)
    story.append(Spacer(1, 20))
    
    # Descripción de estados
    story.append(Paragraph("2. Descripción de Estados", heading_style))
    
    estados_data = [
        ['Estado', 'Descripción', 'Responsable'],
        ['Radicado', 'Petición recién creada por el usuario. Pendiente de revisión inicial.', 'Usuario / Sistema'],
        ['Asignado', 'Atención al usuario revisó y asignó uno o más gestores al trámite.', 'Atención al Usuario'],
        ['En Proceso', 'El gestor está trabajando activamente en el trámite.', 'Gestor(es)'],
        ['En Revisión', 'El gestor completó su trabajo y envió para revisión del coordinador.', 'Coordinador'],
        ['Aprobado', 'El coordinador aprobó el trabajo. Pendiente de finalización.', 'Coordinador'],
        ['Finalizado', 'Trámite completado exitosamente. Se notifica al usuario.', 'Staff'],
        ['Devuelto', 'Trámite devuelto al usuario para correcciones o documentos adicionales.', 'Gestor / Coordinador'],
        ['Rechazado', 'Trámite rechazado. No procede.', 'Staff autorizado'],
    ]
    
    estados_table = Table(estados_data, colWidths=[80, 280, 100])
    estados_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#065f46')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#f8fafc'), colors.white]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
    ]))
    story.append(estados_table)
    story.append(Spacer(1, 20))
    
    # Roles y Responsabilidades
    story.append(Paragraph("3. Roles y Responsabilidades", heading_style))
    
    roles_data = [
        ['Rol', 'Acciones Permitidas'],
        ['Usuario', '• Crear peticiones (radicar trámites)\n• Ver estado de sus trámites\n• Subir documentos cuando se solicita\n• Reenviar trámites devueltos'],
        ['Atención al Usuario', '• Ver todas las peticiones\n• Asignar gestores a los trámites\n• Auto-asignarse trámites\n• Actualizar estado de trámites'],
        ['Gestor', '• Ver trámites asignados\n• Procesar trámites (cambiar a "En Proceso")\n• Marcar su trabajo como completado\n• Enviar a revisión del coordinador\n• Asignar gestor de apoyo\n• Devolver trámites para corrección'],
        ['Coordinador', '• Todo lo anterior\n• Aprobar trámites revisados\n• Finalizar trámites\n• Rechazar trámites\n• Ver métricas y estadísticas'],
        ['Administrador', '• Acceso completo al sistema\n• Gestión de usuarios y permisos\n• Configuración del sistema'],
    ]
    
    roles_table = Table(roles_data, colWidths=[100, 360])
    roles_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a5f')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#f1f5f9'), colors.white]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
    ]))
    story.append(roles_table)
    
    # Nueva página
    story.append(PageBreak())
    
    # Flujo paso a paso
    story.append(Paragraph("4. Flujo Detallado Paso a Paso", heading_style))
    story.append(Spacer(1, 10))
    
    pasos = [
        ("Paso 1: Radicación", 
         "El usuario ingresa al sistema y crea una nueva petición proporcionando sus datos personales, "
         "tipo de trámite, municipio y descripción. El sistema genera automáticamente un número de radicado único."),
        
        ("Paso 2: Asignación",
         "El personal de Atención al Usuario revisa la petición radicada y asigna uno o más gestores "
         "para procesarla. También puede auto-asignarse si tiene el permiso. El usuario recibe notificación por correo."),
        
        ("Paso 3: Procesamiento (En Proceso)",
         "El gestor asignado cambia el estado a 'En Proceso' indicando que está trabajando en el trámite. "
         "Puede agregar gestores de apoyo si requiere colaboración. Cada gestor puede marcar su trabajo como completado."),
        
        ("Paso 4: Envío a Revisión",
         "Cuando todos los gestores han completado su trabajo, se envía el trámite a revisión. "
         "El sistema auto-asigna a los coordinadores y personal con permiso de aprobación."),
        
        ("Paso 5: Aprobación",
         "El coordinador revisa el trabajo realizado. Puede aprobar el trámite (pasa a estado 'Aprobado'), "
         "devolverlo para correcciones, o rechazarlo si no procede."),
        
        ("Paso 6: Finalización",
         "Una vez aprobado, el staff autorizado finaliza el trámite. El usuario recibe notificación "
         "de que su trámite fue completado exitosamente, junto con los documentos generados si aplica."),
    ]
    
    for titulo, descripcion in pasos:
        story.append(Paragraph(f"<b>{titulo}</b>", body_style))
        story.append(Paragraph(descripcion, bullet_style))
        story.append(Spacer(1, 8))
    
    # Casos especiales
    story.append(Spacer(1, 10))
    story.append(Paragraph("5. Casos Especiales", heading_style))
    
    story.append(Paragraph("<b>Devolución de Trámite:</b>", body_style))
    story.append(Paragraph(
        "Si el gestor o coordinador detecta que faltan documentos o información, puede devolver el trámite "
        "al usuario indicando las observaciones. El usuario recibe notificación por correo con las instrucciones "
        "para subsanar y puede reenviar el trámite una vez complete los requisitos.",
        bullet_style
    ))
    story.append(Spacer(1, 8))
    
    story.append(Paragraph("<b>Rechazo de Trámite:</b>", body_style))
    story.append(Paragraph(
        "En casos donde el trámite no procede por razones de fondo, el personal autorizado puede rechazarlo. "
        "El usuario recibe notificación explicando el motivo del rechazo.",
        bullet_style
    ))
    story.append(Spacer(1, 8))
    
    story.append(Paragraph("<b>Múltiples Gestores:</b>", body_style))
    story.append(Paragraph(
        "Un trámite puede tener varios gestores asignados trabajando en paralelo. El sistema muestra el progreso "
        "individual de cada gestor. El trámite solo puede pasar a revisión cuando todos han marcado su trabajo como completado.",
        bullet_style
    ))
    
    # Notificaciones
    story.append(Spacer(1, 15))
    story.append(Paragraph("6. Sistema de Notificaciones", heading_style))
    
    notif_data = [
        ['Evento', 'Notificación'],
        ['Nueva radicación', 'Correo al usuario confirmando el radicado'],
        ['Asignación de gestor', 'Correo al gestor con detalles del trámite'],
        ['Cambio de estado', 'Correo al usuario informando el nuevo estado'],
        ['Devolución', 'Correo al usuario con observaciones a subsanar'],
        ['Finalización', 'Correo al usuario con resultado y documentos adjuntos'],
    ]
    
    notif_table = Table(notif_data, colWidths=[150, 310])
    notif_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0891b2')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#f0fdfa'), colors.white]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#99f6e4')),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
    ]))
    story.append(notif_table)
    
    # Pie de página con fecha
    story.append(Spacer(1, 40))
    from datetime import datetime
    fecha_actual = datetime.now().strftime("%d de %B de %Y")
    story.append(Paragraph(
        f"<i>Documento generado el {fecha_actual} - Sistema Asomunicipios</i>",
        ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, 
                      textColor=colors.HexColor('#94a3b8'), alignment=TA_CENTER)
    ))
    
    # Generar PDF
    doc.build(story)
    print(f"✅ PDF generado exitosamente: {output_path}")
    return output_path


if __name__ == "__main__":
    import locale
    try:
        locale.setlocale(locale.LC_TIME, 'es_ES.UTF-8')
    except:
        try:
            locale.setlocale(locale.LC_TIME, 'es_CO.UTF-8')
        except:
            pass
    
    output_file = "/app/backend/static/flujo_radicacion_tramites.pdf"
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    generate_pdf(output_file)
