"""
Script de migración para corregir predios M2 existentes
Ejecutar en servidor de producción: python migracion_m2_produccion.py

Corrige:
1. Predios nuevos con status "pendiente_aprobacion" -> "aprobado"
2. Predios matriz con "pendiente_eliminacion" -> "deleted: true" + mover a predios_eliminados
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import os

# Configurar tu conexión MongoDB aquí
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'asomunicipios_db')

async def migrar_predios_m2():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("=" * 60)
    print("MIGRACIÓN DE PREDIOS M2 - PRODUCCIÓN")
    print("=" * 60)
    
    # ============================================
    # 1. CORREGIR PREDIOS NUEVOS (status -> aprobado)
    # ============================================
    print("\n📋 PASO 1: Corrigiendo predios nuevos...")
    
    # Buscar predios creados por resolución M2 con status pendiente
    filtro_nuevos = {
        "resolucion_creacion": {"$exists": True},
        "status": "pendiente_aprobacion"
    }
    
    count_nuevos = await db.predios.count_documents(filtro_nuevos)
    print(f"   Predios nuevos a corregir: {count_nuevos}")
    
    if count_nuevos > 0:
        result = await db.predios.update_many(
            filtro_nuevos,
            {"$set": {"status": "aprobado"}}
        )
        print(f"   ✅ Predios actualizados: {result.modified_count}")
    
    # ============================================
    # 2. CORREGIR PREDIOS MATRIZ (eliminar correctamente)
    # ============================================
    print("\n📋 PASO 2: Corrigiendo predios matriz...")
    
    # Buscar predios con pendiente_eliminacion pero no deleted
    filtro_matriz = {
        "pendiente_eliminacion": True,
        "deleted": {"$ne": True}
    }
    
    predios_matriz = await db.predios.find(filtro_matriz, {"_id": 0}).to_list(100)
    print(f"   Predios matriz a eliminar: {len(predios_matriz)}")
    
    for predio in predios_matriz:
        predio_id = predio.get('id')
        npn = predio.get('codigo_predial_nacional')
        
        # Crear copia en predios_eliminados
        predio_eliminado = {
            **predio,
            "eliminado_en": datetime.now(timezone.utc).isoformat(),
            "motivo_eliminacion": f"Mutación M2 - Migración",
        }
        
        # Verificar si ya existe en predios_eliminados
        existe = await db.predios_eliminados.find_one({"codigo_predial_nacional": npn})
        if not existe:
            await db.predios_eliminados.insert_one(predio_eliminado)
            print(f"   📁 Movido a predios_eliminados: {npn}")
        
        # Marcar como deleted en predios
        await db.predios.update_one(
            {"id": predio_id},
            {"$set": {"deleted": True, "eliminado_en": datetime.now(timezone.utc).isoformat()}}
        )
        print(f"   ✅ Marcado como deleted: {npn}")
    
    # ============================================
    # 3. VERIFICAR RESOLUCIONES
    # ============================================
    print("\n📋 PASO 3: Verificando resoluciones...")
    
    año_actual = datetime.now().year
    count_resoluciones = await db.resoluciones.count_documents({"año": año_actual})
    print(f"   Resoluciones del año {año_actual}: {count_resoluciones}")
    
    # Verificar si hay resoluciones sin campo año
    sin_año = await db.resoluciones.count_documents({"año": {"$exists": False}})
    if sin_año > 0:
        print(f"   ⚠️  Resoluciones sin campo 'año': {sin_año}")
        # Corregir agregando el año basado en created_at
        resoluciones_sin_año = await db.resoluciones.find(
            {"año": {"$exists": False}},
            {"_id": 0, "id": 1, "created_at": 1, "numero_resolucion": 1}
        ).to_list(100)
        
        for res in resoluciones_sin_año:
            created = res.get('created_at', '')
            if created:
                año_res = int(created[:4]) if len(created) >= 4 else año_actual
            else:
                año_res = año_actual
            
            await db.resoluciones.update_one(
                {"id": res.get('id')},
                {"$set": {"año": año_res}}
            )
        print(f"   ✅ Corregidas {len(resoluciones_sin_año)} resoluciones sin año")
    
    # ============================================
    # RESUMEN FINAL
    # ============================================
    print("\n" + "=" * 60)
    print("✅ MIGRACIÓN COMPLETADA")
    print("=" * 60)
    
    # Verificación final
    nuevos_aprobados = await db.predios.count_documents({
        "resolucion_creacion": {"$exists": True},
        "status": "aprobado"
    })
    print(f"\n📊 Resumen:")
    print(f"   - Predios nuevos con status 'aprobado': {nuevos_aprobados}")
    print(f"   - Resoluciones año {año_actual}: {await db.resoluciones.count_documents({'año': año_actual})}")
    print(f"   - Predios en predios_eliminados: {await db.predios_eliminados.count_documents({})}")

if __name__ == "__main__":
    asyncio.run(migrar_predios_m2())
