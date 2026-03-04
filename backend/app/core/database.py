"""
Conexión y configuración de MongoDB
"""
from motor.motor_asyncio import AsyncIOMotorClient
from .config import settings

# Cliente MongoDB global
client = AsyncIOMotorClient(settings.MONGO_URL)
db = client[settings.DB_NAME]


def get_database():
    """Dependency para obtener la base de datos"""
    return db


async def close_database():
    """Cerrar conexión a la base de datos"""
    client.close()
