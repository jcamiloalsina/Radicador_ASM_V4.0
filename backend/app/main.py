"""
Aplicación FastAPI Modular
Sistema de Gestión Catastral - Asomunicipios

Esta aplicación puede funcionar de dos formas:
1. Standalone: ejecutar directamente este archivo
2. Integrado: importar routers en server.py existente

Para migración gradual, los routers se pueden importar uno a uno
en el server.py principal.
"""
import logging
from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .core.database import db, close_database
from .routers import auth, users, admin, catalogos, predios, petitions, notifications

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    """
    Factory para crear la aplicación FastAPI.
    Útil para testing y configuración flexible.
    """
    app = FastAPI(
        title="Sistema de Gestión Catastral",
        description="API para Asomunicipios - Asociación de Municipios del Catatumbo",
        version="2.0.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json"
    )
    
    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Router principal con prefijo /api
    api_router = APIRouter(prefix="/api")
    
    # Incluir routers modulares
    api_router.include_router(auth.router)
    api_router.include_router(users.router)
    api_router.include_router(admin.router)
    api_router.include_router(catalogos.router)
    api_router.include_router(predios.router)
    api_router.include_router(petitions.router)
    api_router.include_router(notifications.router)
    
    # Montar router en la app
    app.include_router(api_router)
    
    # Health check
    @app.get("/api/health")
    async def health_check():
        return {"status": "healthy", "version": "2.0.0"}
    
    # Eventos de ciclo de vida
    @app.on_event("startup")
    async def startup_event():
        logger.info("Iniciando aplicación modular...")
        logger.info(f"Base de datos: {settings.DB_NAME}")
    
    @app.on_event("shutdown")
    async def shutdown_event():
        logger.info("Cerrando aplicación...")
        await close_database()
    
    return app


# Instancia de la aplicación
app = create_app()


# ============================================================
# ROUTERS DISPONIBLES PARA IMPORTAR EN SERVER.PY
# ============================================================
# 
# Para migración gradual, importar en server.py:
#
# from app.routers import auth, users, admin
# 
# # Reemplazar endpoints de autenticación
# api_router.include_router(auth.router)
#
# # O importar funciones específicas:
# from app.core.security import get_current_user, create_token
# from app.services.email_service import send_email, get_email_template
# from app.utils.helpers import format_nombre_propio, secure_filename
# ============================================================
