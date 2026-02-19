#!/usr/bin/env python3
"""
Generador de Documentación del Backend - Asomunicipios
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, ListFlowable, ListItem
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from datetime import datetime
import os

def create_api_documentation():
    """Genera el documento PDF con la documentación del backend"""
    
    # Crear el documento
    doc = SimpleDocTemplate(
        "/app/backend/API_Documentation_Asomunicipios.pdf",
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm
    )
    
    # Estilos
    styles = getSampleStyleSheet()
    
    # Estilos personalizados
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        spaceAfter=30,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#1a5f2a')
    )
    
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Heading2'],
        fontSize=14,
        spaceAfter=12,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#333333')
    )
    
    heading1_style = ParagraphStyle(
        'CustomHeading1',
        parent=styles['Heading1'],
        fontSize=16,
        spaceBefore=20,
        spaceAfter=10,
        textColor=colors.HexColor('#1a5f2a')
    )
    
    heading2_style = ParagraphStyle(
        'CustomHeading2',
        parent=styles['Heading2'],
        fontSize=13,
        spaceBefore=15,
        spaceAfter=8,
        textColor=colors.HexColor('#2d7a3e')
    )
    
    heading3_style = ParagraphStyle(
        'CustomHeading3',
        parent=styles['Heading3'],
        fontSize=11,
        spaceBefore=10,
        spaceAfter=6,
        textColor=colors.HexColor('#444444')
    )
    
    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=8,
        alignment=TA_JUSTIFY
    )
    
    code_style = ParagraphStyle(
        'CustomCode',
        parent=styles['Code'],
        fontSize=8,
        backColor=colors.HexColor('#f5f5f5'),
        borderColor=colors.HexColor('#dddddd'),
        borderWidth=1,
        borderPadding=5
    )
    
    # Contenido
    elements = []
    
    # === PORTADA ===
    elements.append(Spacer(1, 2*inch))
    elements.append(Paragraph("DOCUMENTACIÓN TÉCNICA", title_style))
    elements.append(Paragraph("API Backend - Sistema de Gestión Catastral", subtitle_style))
    elements.append(Spacer(1, 0.5*inch))
    elements.append(Paragraph("Asociación de Municipios del Catatumbo", subtitle_style))
    elements.append(Paragraph("Provincia de Ocaña y Sur del Cesar", subtitle_style))
    elements.append(Spacer(1, 1*inch))
    elements.append(Paragraph(f"Fecha de generación: {datetime.now().strftime('%d/%m/%Y')}", body_style))
    elements.append(Paragraph("Versión: 2.0", body_style))
    elements.append(PageBreak())
    
    # === ÍNDICE ===
    elements.append(Paragraph("ÍNDICE", heading1_style))
    toc_items = [
        "1. Descripción General",
        "2. Arquitectura del Sistema",
        "3. Base de Datos (MongoDB)",
        "4. Módulos del Sistema",
        "5. API Endpoints por Módulo",
        "6. Modelos de Datos",
        "7. Flujos de Trabajo",
        "8. Seguridad y Autenticación",
        "9. Guía de Despliegue"
    ]
    for item in toc_items:
        elements.append(Paragraph(item, body_style))
    elements.append(PageBreak())
    
    # === 1. DESCRIPCIÓN GENERAL ===
    elements.append(Paragraph("1. DESCRIPCIÓN GENERAL", heading1_style))
    elements.append(Paragraph(
        "El Sistema de Gestión Catastral de Asomunicipios es una plataforma web integral diseñada para "
        "administrar el proceso catastral de los municipios del Catatumbo. El backend está desarrollado "
        "con FastAPI (Python) y utiliza MongoDB como base de datos principal.",
        body_style
    ))
    
    elements.append(Paragraph("1.1 Tecnologías Utilizadas", heading2_style))
    tech_data = [
        ["Componente", "Tecnología", "Versión"],
        ["Framework Backend", "FastAPI", "0.100+"],
        ["Lenguaje", "Python", "3.11+"],
        ["Base de Datos", "MongoDB", "6.0+"],
        ["Autenticación", "JWT (PyJWT)", "2.8+"],
        ["Validación", "Pydantic", "2.0+"],
        ["Servidor ASGI", "Uvicorn", "0.24+"],
        ["Generación PDF", "ReportLab", "4.0+"],
        ["Procesamiento GIS", "Shapely, Fiona", "2.0+"],
    ]
    tech_table = Table(tech_data, colWidths=[2.5*inch, 2*inch, 1.5*inch])
    tech_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a5f2a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f9f9f9')),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#dddddd')),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
    ]))
    elements.append(tech_table)
    elements.append(Spacer(1, 0.3*inch))
    
    elements.append(Paragraph("1.2 Estadísticas del API", heading2_style))
    stats_data = [
        ["Tipo de Endpoint", "Cantidad"],
        ["GET (Consultas)", "127"],
        ["POST (Creación)", "81"],
        ["PATCH (Actualización)", "18"],
        ["PUT (Reemplazo)", "1"],
        ["DELETE (Eliminación)", "11"],
        ["TOTAL", "238"],
    ]
    stats_table = Table(stats_data, colWidths=[3*inch, 2*inch])
    stats_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a5f2a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e8f5e9')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#dddddd')),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
    ]))
    elements.append(stats_table)
    elements.append(PageBreak())
    
    # === 2. ARQUITECTURA ===
    elements.append(Paragraph("2. ARQUITECTURA DEL SISTEMA", heading1_style))
    elements.append(Paragraph(
        "El sistema sigue una arquitectura de tres capas: Presentación (Frontend React), "
        "Lógica de Negocio (Backend FastAPI), y Datos (MongoDB).",
        body_style
    ))
    
    elements.append(Paragraph("2.1 Estructura del Proyecto", heading2_style))
    structure = """
    /app/
    ├── backend/
    │   ├── server.py          # Servidor principal FastAPI (~21,000 líneas)
    │   ├── requirements.txt   # Dependencias Python
    │   └── .env              # Variables de entorno
    ├── frontend/
    │   ├── src/
    │   │   ├── pages/        # Páginas principales
    │   │   ├── components/   # Componentes reutilizables
    │   │   └── hooks/        # Custom hooks (offline sync)
    │   └── package.json
    └── memory/
        └── PRD.md            # Documentación del producto
    """
    elements.append(Paragraph(structure.replace('\n', '<br/>'), code_style))
    
    elements.append(Paragraph("2.2 Flujo de Datos", heading2_style))
    elements.append(Paragraph(
        "1. El Frontend envía peticiones HTTP al Backend (puerto 8001)<br/>"
        "2. El Backend procesa la petición y consulta MongoDB<br/>"
        "3. Los datos se validan con Pydantic antes de persistirse<br/>"
        "4. Las respuestas se serializan en JSON (excluyendo _id de MongoDB)<br/>"
        "5. Para operaciones offline, el Frontend usa IndexedDB (Dexie.js)",
        body_style
    ))
    elements.append(PageBreak())
    
    # === 3. BASE DE DATOS ===
    elements.append(Paragraph("3. BASE DE DATOS (MongoDB)", heading1_style))
    elements.append(Paragraph(
        "El sistema utiliza MongoDB como base de datos principal. A continuación se detallan "
        "las colecciones principales organizadas por módulo funcional.",
        body_style
    ))
    
    elements.append(Paragraph("3.1 Colecciones del Sistema", heading2_style))
    
    # Colecciones agrupadas por módulo
    collections = {
        "Autenticación y Usuarios": [
            ("users", "Usuarios del sistema con roles y permisos"),
            ("user_permissions", "Permisos específicos por usuario"),
            ("permissions_history", "Historial de cambios de permisos"),
            ("password_resets", "Tokens para recuperación de contraseña"),
        ],
        "Gestión de Peticiones": [
            ("petitions", "Trámites/peticiones de ciudadanos"),
            ("certificados", "Certificados generados"),
            ("certificados_verificables", "Códigos de verificación de certificados"),
        ],
        "Conservación Catastral": [
            ("predios", "Predios activos del sistema catastral"),
            ("predios_eliminados", "Predios dados de baja"),
            ("predios_historico", "Histórico de cambios de predios"),
            ("predios_cambios", "Propuestas de cambio pendientes"),
            ("predios_nuevos", "Predios nuevos en proceso de creación"),
            ("codigos_homologados", "Códigos homologados por municipio"),
        ],
        "Actualización Catastral": [
            ("proyectos_actualizacion", "Proyectos de actualización catastral"),
            ("predios_actualizacion", "Predios dentro de proyectos de actualización"),
            ("propuestas_cambio_actualizacion", "Propuestas de gestores para coordinadores"),
            ("geometrias_actualizacion", "Geometrías GDB del proyecto"),
            ("construcciones_actualizacion", "Construcciones del proyecto"),
            ("etapas_proyecto", "Etapas de cada proyecto"),
            ("actividades_proyecto", "Actividades asignadas en etapas"),
        ],
        "Información Geográfica (GDB)": [
            ("gdb_geometrias", "Geometrías de terrenos importadas de GDB"),
            ("gdb_construcciones", "Construcciones importadas de GDB"),
            ("gdb_cargas", "Historial de cargas de archivos GDB"),
            ("limites_municipales", "Polígonos de límites municipales"),
            ("ortoimagenes", "Ortofotos e imágenes satelitales"),
        ],
        "Sistema y Configuración": [
            ("system_config", "Configuración general del sistema"),
            ("notificaciones", "Notificaciones push a usuarios"),
            ("audit_log", "Log de auditoría de acciones"),
            ("backup_history", "Historial de respaldos de BD"),
        ],
    }
    
    for module, cols in collections.items():
        elements.append(Paragraph(f"<b>{module}</b>", heading3_style))
        col_data = [["Colección", "Descripción"]]
        for col_name, col_desc in cols:
            col_data.append([col_name, col_desc])
        
        col_table = Table(col_data, colWidths=[2.2*inch, 4*inch])
        col_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2d7a3e')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 5),
            ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ]))
        elements.append(col_table)
        elements.append(Spacer(1, 0.15*inch))
    
    elements.append(PageBreak())
    
    # === 4. MÓDULOS DEL SISTEMA ===
    elements.append(Paragraph("4. MÓDULOS DEL SISTEMA", heading1_style))
    
    modules = [
        ("Autenticación", "Registro, login, recuperación de contraseña, verificación de email, gestión de sesiones JWT"),
        ("Usuarios y Permisos", "Gestión de usuarios, roles (administrador, coordinador, gestor, atención_usuario, usuario, empresa), permisos granulares"),
        ("Peticiones/Trámites", "Radicación de trámites ciudadanos, asignación a gestores, seguimiento, generación de certificados"),
        ("Conservación Catastral", "Gestión de predios activos, eliminados, códigos homologados, creación con workflow de aprobación"),
        ("Actualización Catastral", "Proyectos de actualización, visitas en campo, propuestas de cambio, aprobación por coordinador, sincronización offline"),
        ("GDB (Geodatabase)", "Carga de archivos GDB, geometrías de terrenos y construcciones, límites municipales"),
        ("Ortoimágenes", "Carga y visualización de ortofotos georreferenciadas"),
        ("Reportes y Estadísticas", "Dashboards, productividad de gestores, exportación a Excel/PDF"),
        ("Certificados", "Generación de certificados catastrales con códigos de verificación QR"),
        ("Respaldos", "Backup y restauración de base de datos, programación automática"),
    ]
    
    for mod_name, mod_desc in modules:
        elements.append(Paragraph(f"<b>• {mod_name}:</b> {mod_desc}", body_style))
    
    elements.append(PageBreak())
    
    # === 5. API ENDPOINTS POR MÓDULO ===
    elements.append(Paragraph("5. API ENDPOINTS POR MÓDULO", heading1_style))
    
    # Endpoints organizados por módulo
    endpoints_by_module = {
        "Autenticación (/auth)": [
            ("POST", "/auth/register", "Registro de nuevo usuario"),
            ("POST", "/auth/login", "Inicio de sesión"),
            ("GET", "/auth/me", "Obtener usuario actual"),
            ("POST", "/auth/verify-email", "Verificar email"),
            ("POST", "/auth/forgot-password", "Solicitar recuperación"),
            ("POST", "/auth/reset-password", "Restablecer contraseña"),
        ],
        "Usuarios (/users)": [
            ("GET", "/users", "Listar usuarios"),
            ("GET", "/users/gestores-disponibles", "Gestores disponibles"),
            ("PATCH", "/users/role", "Cambiar rol de usuario"),
            ("PATCH", "/users/{id}/gdb-permission", "Permiso de carga GDB"),
        ],
        "Peticiones (/petitions)": [
            ("GET", "/petitions", "Listar peticiones"),
            ("POST", "/petitions", "Crear petición"),
            ("GET", "/petitions/{id}", "Detalle de petición"),
            ("PATCH", "/petitions/{id}", "Actualizar petición"),
            ("POST", "/petitions/{id}/upload", "Subir documentos"),
            ("POST", "/petitions/{id}/assign-gestor", "Asignar gestor"),
            ("POST", "/petitions/{id}/reenviar", "Reenviar subsanación"),
            ("GET", "/petitions/{id}/certificado", "Generar certificado"),
        ],
        "Predios - Conservación (/predios)": [
            ("GET", "/predios", "Listar predios"),
            ("GET", "/predios/{id}", "Detalle de predio"),
            ("POST", "/predios", "Crear predio simple"),
            ("POST", "/predios/crear-con-workflow", "Crear con aprobación"),
            ("PATCH", "/predios/{id}", "Actualizar predio"),
            ("DELETE", "/predios/{id}", "Eliminar predio"),
            ("GET", "/predios/eliminados", "Predios eliminados"),
            ("GET", "/predios/export-excel", "Exportar a Excel"),
            ("GET", "/predios/{id}/certificado", "Certificado catastral"),
        ],
        "Códigos Homologados": [
            ("GET", "/codigos-homologados/stats", "Estadísticas"),
            ("GET", "/codigos-homologados/disponibles/{mun}", "Códigos libres"),
            ("GET", "/codigos-homologados/siguiente/{mun}", "Siguiente código"),
            ("POST", "/codigos-homologados/cargar", "Cargar desde Excel"),
        ],
        "Actualización (/actualizacion)": [
            ("GET", "/actualizacion/proyectos", "Listar proyectos"),
            ("POST", "/actualizacion/proyectos", "Crear proyecto"),
            ("GET", "/actualizacion/proyectos/{id}", "Detalle proyecto"),
            ("GET", "/actualizacion/proyectos/{id}/predios", "Predios del proyecto"),
            ("POST", "/actualizacion/proyectos/{id}/predios-nuevos", "Crear predio nuevo"),
            ("POST", "/.../predios/{cod}/visita", "Guardar visita"),
            ("POST", "/.../predios/{cod}/propuesta", "Proponer cambio"),
            ("POST", "/.../predios/{cod}/proponer-cancelacion", "Proponer eliminación"),
            ("PATCH", "/actualizacion/propuestas/{id}/aprobar", "Aprobar propuesta"),
            ("PATCH", "/actualizacion/propuestas/{id}/rechazar", "Rechazar propuesta"),
            ("POST", "/.../generar-pdf", "Generar PDF de visita"),
        ],
        "GDB (/gdb)": [
            ("POST", "/gdb/upload", "Cargar archivo GDB"),
            ("GET", "/gdb/geometrias", "Listar geometrías"),
            ("GET", "/gdb/construcciones/{codigo}", "Construcciones"),
            ("GET", "/gdb/stats", "Estadísticas GDB"),
            ("GET", "/gdb/limites-municipios", "Límites municipales"),
        ],
        "Reportes (/reports)": [
            ("GET", "/reports/gestor-productivity", "Productividad gestores"),
            ("GET", "/reports/listado-tramites/export-pdf", "Listado PDF"),
            ("GET", "/reports/tramites/export-excel", "Exportar Excel"),
        ],
        "Base de Datos (/database)": [
            ("GET", "/database/status", "Estado de MongoDB"),
            ("POST", "/database/backup", "Crear respaldo"),
            ("GET", "/database/backups", "Listar respaldos"),
            ("POST", "/database/restore/{id}", "Restaurar respaldo"),
        ],
    }
    
    for module_name, endpoints in endpoints_by_module.items():
        elements.append(Paragraph(f"5.x {module_name}", heading2_style))
        
        ep_data = [["Método", "Endpoint", "Descripción"]]
        for method, endpoint, desc in endpoints:
            ep_data.append([method, endpoint, desc])
        
        ep_table = Table(ep_data, colWidths=[0.7*inch, 2.8*inch, 2.7*inch])
        ep_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a5f2a')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (0, 0), (0, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9f9f9')]),
        ]))
        elements.append(ep_table)
        elements.append(Spacer(1, 0.15*inch))
    
    elements.append(PageBreak())
    
    # === 6. MODELOS DE DATOS ===
    elements.append(Paragraph("6. MODELOS DE DATOS PRINCIPALES", heading1_style))
    
    elements.append(Paragraph("6.1 Usuario (users)", heading2_style))
    user_fields = [
        ["Campo", "Tipo", "Descripción"],
        ["id", "string (UUID)", "Identificador único"],
        ["email", "string", "Email (único)"],
        ["password_hash", "string", "Contraseña hasheada (bcrypt)"],
        ["full_name", "string", "Nombre completo"],
        ["role", "enum", "administrador|coordinador|gestor|atencion_usuario|usuario|empresa"],
        ["permissions", "array", "Permisos adicionales"],
        ["municipios", "array", "Municipios asignados"],
        ["is_active", "boolean", "Estado activo"],
        ["email_verified", "boolean", "Email verificado"],
        ["created_at", "datetime", "Fecha de creación"],
    ]
    user_table = Table(user_fields, colWidths=[1.5*inch, 1.5*inch, 3.2*inch])
    user_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2d7a3e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
    ]))
    elements.append(user_table)
    elements.append(Spacer(1, 0.2*inch))
    
    elements.append(Paragraph("6.2 Predio (predios)", heading2_style))
    predio_fields = [
        ["Campo", "Tipo", "Descripción"],
        ["id", "string (UUID)", "Identificador único"],
        ["codigo_predial_nacional", "string(30)", "Código predial de 30 dígitos"],
        ["codigo_homologado", "string", "Código homologado asignado"],
        ["municipio", "string", "Municipio del predio"],
        ["vigencia", "integer", "Año de vigencia"],
        ["direccion", "string", "Dirección del predio"],
        ["destino_economico", "string", "Uso del suelo"],
        ["area_terreno", "float", "Área del terreno (m²)"],
        ["area_construida", "float", "Área construida (m²)"],
        ["avaluo_catastral", "float", "Valor catastral"],
        ["propietarios", "array", "Lista de propietarios"],
        ["matricula_inmobiliaria", "string", "Matrícula inmobiliaria"],
        ["estado", "string", "activo|eliminado"],
        ["historial_cambios", "array", "Historial de modificaciones"],
    ]
    predio_table = Table(predio_fields, colWidths=[1.8*inch, 1.3*inch, 3.1*inch])
    predio_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2d7a3e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
    ]))
    elements.append(predio_table)
    elements.append(Spacer(1, 0.2*inch))
    
    elements.append(Paragraph("6.3 Petición (petitions)", heading2_style))
    petition_fields = [
        ["Campo", "Tipo", "Descripción"],
        ["id", "string (UUID)", "Identificador único"],
        ["radicado", "string", "Número de radicado"],
        ["tipo_tramite", "string", "Tipo de trámite"],
        ["solicitante_nombre", "string", "Nombre del solicitante"],
        ["solicitante_email", "string", "Email del solicitante"],
        ["solicitante_telefono", "string", "Teléfono del solicitante"],
        ["solicitante_origen", "string", "empresa|ciudadano|interno"],
        ["descripcion", "string", "Descripción del trámite"],
        ["municipio", "string", "Municipio"],
        ["estado", "string", "radicado|asignado|en_proceso|completado|subsanar"],
        ["gestor_asignado", "string", "ID del gestor asignado"],
        ["archivos", "array", "Documentos adjuntos"],
        ["created_at", "datetime", "Fecha de radicación"],
    ]
    petition_table = Table(petition_fields, colWidths=[1.8*inch, 1.3*inch, 3.1*inch])
    petition_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2d7a3e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
    ]))
    elements.append(petition_table)
    
    elements.append(PageBreak())
    
    # === 7. FLUJOS DE TRABAJO ===
    elements.append(Paragraph("7. FLUJOS DE TRABAJO", heading1_style))
    
    elements.append(Paragraph("7.1 Creación de Predio con Workflow", heading2_style))
    elements.append(Paragraph(
        "<b>Flujo para GESTOR:</b><br/>"
        "1. Gestor completa formulario de nuevo predio<br/>"
        "2. Sistema valida datos y genera propuesta<br/>"
        "3. Propuesta queda en estado 'pendiente_creacion'<br/>"
        "4. Coordinador recibe notificación<br/>"
        "5. Coordinador aprueba o solicita subsanación<br/>"
        "6. Si aprobado: predio se crea en colección 'predios'<br/>"
        "7. Se asigna código homologado automáticamente",
        body_style
    ))
    elements.append(Spacer(1, 0.15*inch))
    elements.append(Paragraph(
        "<b>Flujo para COORDINADOR/ADMIN:</b><br/>"
        "1. Completa formulario de nuevo predio<br/>"
        "2. Predio se crea directamente (sin aprobación)<br/>"
        "3. Se registra en historial de cambios",
        body_style
    ))
    
    elements.append(Paragraph("7.2 Actualización Catastral", heading2_style))
    elements.append(Paragraph(
        "1. Coordinador crea proyecto de actualización para un municipio<br/>"
        "2. Se cargan predios base desde conservación<br/>"
        "3. Se cargan geometrías GDB del proyecto<br/>"
        "4. Gestores realizan visitas en campo (pueden trabajar offline)<br/>"
        "5. Gestores completan formato de visita con fotos y firmas<br/>"
        "6. Gestores proponen cambios al coordinador<br/>"
        "7. Coordinador revisa y aprueba/rechaza propuestas<br/>"
        "8. Al finalizar proyecto, cambios se sincronizan a conservación",
        body_style
    ))
    
    elements.append(Paragraph("7.3 Sincronización Offline", heading2_style))
    elements.append(Paragraph(
        "El sistema soporta trabajo offline para gestores en campo:<br/><br/>"
        "1. Al cargar el visor, se descargan predios del proyecto a IndexedDB<br/>"
        "2. Cambios se guardan localmente si no hay conexión<br/>"
        "3. Al recuperar conexión, se sincronizan automáticamente<br/>"
        "4. Conflictos se resuelven priorizando el servidor<br/>"
        "5. Se notifica al usuario el estado de sincronización",
        body_style
    ))
    
    elements.append(PageBreak())
    
    # === 8. SEGURIDAD ===
    elements.append(Paragraph("8. SEGURIDAD Y AUTENTICACIÓN", heading1_style))
    
    elements.append(Paragraph("8.1 Autenticación JWT", heading2_style))
    elements.append(Paragraph(
        "• Tokens JWT con expiración de 24 horas<br/>"
        "• Algoritmo: HS256<br/>"
        "• Secret key almacenado en variables de entorno<br/>"
        "• Token incluye: user_id, email, role, permissions",
        body_style
    ))
    
    elements.append(Paragraph("8.2 Roles y Permisos", heading2_style))
    roles_data = [
        ["Rol", "Permisos"],
        ["administrador", "Acceso total al sistema, gestión de usuarios y configuración"],
        ["coordinador", "Gestión de proyectos, aprobación de cambios, asignación de gestores"],
        ["gestor", "Visitas en campo, propuestas de cambio, gestión de trámites asignados"],
        ["atencion_usuario", "Radicación de trámites, atención a ciudadanos"],
        ["usuario", "Consulta de trámites propios, seguimiento"],
        ["empresa", "Radicación masiva de trámites, consultas"],
    ]
    roles_table = Table(roles_data, colWidths=[1.5*inch, 4.7*inch])
    roles_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a5f2a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(roles_table)
    
    elements.append(Paragraph("8.3 Permisos Especiales", heading2_style))
    perms_list = [
        "• <b>approve_changes:</b> Permite aprobar cambios sin ser coordinador",
        "• <b>create_predios:</b> Permite crear predios nuevos",
        "• <b>upload_gdb:</b> Permite cargar archivos GDB",
        "• <b>manage_users:</b> Permite gestionar usuarios",
        "• <b>view_reports:</b> Acceso a reportes avanzados",
    ]
    for perm in perms_list:
        elements.append(Paragraph(perm, body_style))
    
    elements.append(PageBreak())
    
    # === 9. GUÍA DE DESPLIEGUE ===
    elements.append(Paragraph("9. GUÍA DE DESPLIEGUE", heading1_style))
    
    elements.append(Paragraph("9.1 Variables de Entorno Requeridas", heading2_style))
    env_data = [
        ["Variable", "Descripción"],
        ["MONGO_URL", "URL de conexión a MongoDB"],
        ["DB_NAME", "Nombre de la base de datos"],
        ["JWT_SECRET", "Clave secreta para tokens JWT"],
        ["SMTP_HOST", "Servidor SMTP para emails"],
        ["SMTP_PORT", "Puerto SMTP"],
        ["SMTP_USER", "Usuario SMTP"],
        ["SMTP_PASS", "Contraseña SMTP"],
    ]
    env_table = Table(env_data, colWidths=[2*inch, 4.2*inch])
    env_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a5f2a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
    ]))
    elements.append(env_table)
    
    elements.append(Paragraph("9.2 Puertos y Servicios", heading2_style))
    elements.append(Paragraph(
        "• <b>Backend:</b> Puerto 8001 (interno), rutas prefijadas con /api<br/>"
        "• <b>Frontend:</b> Puerto 3000<br/>"
        "• <b>MongoDB:</b> Puerto 27017<br/>"
        "• <b>Documentación API:</b> /docs (Swagger), /redoc (ReDoc)",
        body_style
    ))
    
    elements.append(Paragraph("9.3 Comandos Útiles", heading2_style))
    commands = """
    # Reiniciar servicios
    sudo supervisorctl restart backend
    sudo supervisorctl restart frontend
    
    # Ver logs
    tail -f /var/log/supervisor/backend.err.log
    tail -f /var/log/supervisor/frontend.err.log
    
    # Estado de servicios
    sudo supervisorctl status
    """
    elements.append(Paragraph(commands.replace('\n', '<br/>'), code_style))
    
    # Footer
    elements.append(Spacer(1, 0.5*inch))
    elements.append(Paragraph("—— Fin del Documento ——", subtitle_style))
    
    # Construir PDF
    doc.build(elements)
    print("✅ PDF generado exitosamente: /app/backend/API_Documentation_Asomunicipios.pdf")
    return "/app/backend/API_Documentation_Asomunicipios.pdf"

if __name__ == "__main__":
    create_api_documentation()
