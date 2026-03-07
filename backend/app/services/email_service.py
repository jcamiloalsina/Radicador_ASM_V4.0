"""
Servicio de Email
Funciones para enviar correos y templates HTML
"""
import os
import smtplib
import logging
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders

from ..core.config import settings

logger = logging.getLogger(__name__)


async def send_email(
    to_email: str, 
    subject: str, 
    body: str, 
    attachment_path: str = None, 
    attachment_name: str = None, 
    attachments: list = None
):
    """
    Envía un correo electrónico con soporte para múltiples adjuntos.
    
    Args:
        to_email: Correo destino
        subject: Asunto
        body: Cuerpo HTML
        attachment_path: Ruta de un archivo adjunto (compatibilidad)
        attachment_name: Nombre del archivo adjunto (compatibilidad)
        attachments: Lista de diccionarios con {'path': str, 'name': str}
    """
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP credentials not configured, skipping email")
        return
    
    try:
        msg = MIMEMultipart()
        msg['From'] = settings.SMTP_FROM
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'html'))
        
        # Construir lista de adjuntos
        archivos_adjuntar = []
        
        # Adjunto único (compatibilidad)
        if attachment_path and os.path.exists(attachment_path):
            archivos_adjuntar.append({
                'path': attachment_path,
                'name': attachment_name or os.path.basename(attachment_path)
            })
        
        # Múltiples adjuntos
        if attachments:
            for adj in attachments:
                if adj.get('path') and os.path.exists(adj['path']):
                    archivos_adjuntar.append({
                        'path': adj['path'],
                        'name': adj.get('name') or os.path.basename(adj['path'])
                    })
        
        # Adjuntar archivos
        for archivo in archivos_adjuntar:
            with open(archivo['path'], 'rb') as f:
                part = MIMEBase('application', 'octet-stream')
                part.set_payload(f.read())
                encoders.encode_base64(part)
                part.add_header('Content-Disposition', f'attachment; filename="{archivo["name"]}"')
                msg.attach(part)
        
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        logger.info(f"Email sent to {to_email} with {len(archivos_adjuntar)} attachment(s)")
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        raise


def get_email_template(
    titulo: str, 
    contenido: str, 
    radicado: str = None, 
    tipo_notificacion: str = "info", 
    boton_texto: str = None, 
    boton_url: str = None
) -> str:
    """
    Genera una plantilla HTML profesional para correos electrónicos.
    
    Args:
        titulo: Título principal del correo
        contenido: Contenido HTML del mensaje
        radicado: Número de radicado (opcional)
        tipo_notificacion: "info", "success", "warning", "error"
        boton_texto: Texto del botón CTA (opcional)
        boton_url: URL del botón (opcional)
    """
    frontend_url = os.environ.get('FRONTEND_URL', 'https://mutation-m6-styling.preview.emergentagent.com')
    logo_url = f"{frontend_url}/logo-asomunicipios.png"
    
    # Colores según tipo de notificación
    colores = {
        "info": {"bg": "#009846", "accent": "#10b981", "badge": "#0ea5e9"},
        "success": {"bg": "#009846", "accent": "#10b981", "badge": "#22c55e"},
        "warning": {"bg": "#d97706", "accent": "#f59e0b", "badge": "#f59e0b"},
        "error": {"bg": "#dc2626", "accent": "#ef4444", "badge": "#ef4444"}
    }
    color = colores.get(tipo_notificacion, colores["info"])
    
    radicado_html = ""
    if radicado:
        radicado_html = f'''
        <div style="background: linear-gradient(135deg, {color["badge"]} 0%, {color["accent"]} 100%); 
                    color: white; padding: 8px 16px; border-radius: 20px; 
                    display: inline-block; font-size: 14px; font-weight: bold; margin-bottom: 15px;">
            Radicado: {radicado}
        </div>
        '''
    
    boton_html = ""
    if boton_texto and boton_url:
        boton_html = f'''
        <div style="text-align: center; margin: 25px 0;">
            <a href="{boton_url}" style="background: linear-gradient(135deg, {color["bg"]} 0%, {color["accent"]} 100%); 
                      color: white; padding: 14px 30px; border-radius: 8px; 
                      text-decoration: none; font-weight: bold; display: inline-block;
                      box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                {boton_texto}
            </a>
        </div>
        '''
    
    return f'''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <!-- Header -->
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-radius: 16px 16px 0 0; overflow: hidden;">
                <tr>
                    <td bgcolor="{color["bg"]}" 
                        style="background-color: {color["bg"]}; border-radius: 16px 16px 0 0; padding: 30px; text-align: center;">
                        <div style="background: rgba(4, 120, 87, 0.85); padding: 25px; border-radius: 12px;">
                            <img src="{logo_url}" alt="Asomunicipios" style="height: 60px; margin-bottom: 12px; border-radius: 8px; background: white; padding: 6px;">
                            <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600;">
                                Asociación de Municipios del Catatumbo
                            </h1>
                            <p style="color: #a7f3d0; margin: 6px 0 0 0; font-size: 13px;">
                                Provincia de Ocaña y Sur del Cesar
                            </p>
                        </div>
                    </td>
                </tr>
            </table>
            
            <!-- Contenido principal -->
            <div style="background: white; padding: 35px; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
                {radicado_html}
                <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">
                    {titulo}
                </h2>
                <div style="color: #475569; font-size: 15px; line-height: 1.7;">
                    {contenido}
                </div>
                {boton_html}
            </div>
            
            <!-- Footer -->
            <div style="background: #f8fafc; padding: 25px; border-radius: 0 0 16px 16px; 
                        border: 1px solid #e2e8f0; border-top: none; text-align: center;">
                <p style="color: #64748b; font-size: 13px; margin: 0 0 10px 0;">
                    Este es un mensaje automático del Sistema de Gestión Catastral
                </p>
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                    © {datetime.now().year} Asomunicipios - Todos los derechos reservados
                </p>
                <div style="margin-top: 15px;">
                    <a href="{frontend_url}" style="color: {color["bg"]}; text-decoration: none; font-size: 13px;">
                        Acceder al Sistema
                    </a>
                </div>
            </div>
        </div>
    </body>
    </html>
    '''


def get_finalizacion_email(radicado: str, tipo_tramite: str, nombre_solicitante: str, con_archivos: bool = False) -> str:
    """Genera el correo de finalización de trámite."""
    contenido = f'''
    <p>Estimado(a) <strong>{nombre_solicitante}</strong>,</p>
    
    <p>Nos complace informarle que su trámite ha sido <strong style="color: #22c55e;">finalizado exitosamente</strong>.</p>
    
    <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Tipo de trámite:</strong> {tipo_tramite}</p>
        <p style="margin: 0;"><strong>Estado:</strong> Finalizado</p>
    </div>
    '''
    
    if con_archivos:
        contenido += '''
    <p><strong>Documentos adjuntos:</strong> Se han incluido los documentos de respuesta en este correo. 
    Por favor revise los archivos adjuntos.</p>
    '''
    
    contenido += '''
    <p>Si tiene alguna pregunta o requiere información adicional, no dude en contactarnos.</p>
    
    <p style="margin-top: 25px;">Atentamente,<br>
    <strong>Equipo de Gestión Catastral</strong><br>
    <span style="color: #64748b;">Asomunicipios</span></p>
    '''
    
    frontend_url = os.environ.get('FRONTEND_URL', 'https://mutation-m6-styling.preview.emergentagent.com')
    
    return get_email_template(
        titulo="¡Su trámite ha sido finalizado!",
        contenido=contenido,
        radicado=radicado,
        tipo_notificacion="success",
        boton_texto="Ver Detalles del Trámite",
        boton_url=f"{frontend_url}/mis-peticiones"
    )


def get_nueva_peticion_email(radicado: str, solicitante: str, tipo_tramite: str, municipio: str) -> str:
    """Genera el correo de nueva petición para staff."""
    contenido = f'''
    <p>Se ha recibido una nueva petición en el sistema:</p>
    
    <div style="background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Solicitante:</strong> {solicitante}</p>
        <p style="margin: 0 0 8px 0;"><strong>Tipo de trámite:</strong> {tipo_tramite}</p>
        <p style="margin: 0;"><strong>Municipio:</strong> {municipio}</p>
    </div>
    
    <p>Por favor revise la petición y tome las acciones correspondientes.</p>
    '''
    
    frontend_url = os.environ.get('FRONTEND_URL', 'https://mutation-m6-styling.preview.emergentagent.com')
    
    return get_email_template(
        titulo="Nueva Petición Recibida",
        contenido=contenido,
        radicado=radicado,
        tipo_notificacion="info",
        boton_texto="Ver Petición",
        boton_url=f"{frontend_url}/todas-peticiones"
    )


def get_confirmacion_peticion_email(radicado: str, nombre_solicitante: str, tipo_tramite: str, municipio: str) -> str:
    """Genera el correo de confirmación para el solicitante."""
    contenido = f'''
    <p>Estimado(a) <strong>{nombre_solicitante}</strong>,</p>
    
    <p>Hemos recibido su solicitud exitosamente. A continuación los detalles:</p>
    
    <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Tipo de trámite:</strong> {tipo_tramite}</p>
        <p style="margin: 0;"><strong>Municipio:</strong> {municipio}</p>
    </div>
    
    <p>Conserve su número de radicado para hacer seguimiento a su trámite.</p>
    
    <p style="margin-top: 25px;">Atentamente,<br>
    <strong>Equipo de Gestión Catastral</strong><br>
    <span style="color: #64748b;">Asomunicipios</span></p>
    '''
    
    frontend_url = os.environ.get('FRONTEND_URL', 'https://mutation-m6-styling.preview.emergentagent.com')
    
    return get_email_template(
        titulo="Petición Recibida",
        contenido=contenido,
        radicado=radicado,
        tipo_notificacion="success",
        boton_texto="Consultar Estado",
        boton_url=f"{frontend_url}/mis-peticiones"
    )
