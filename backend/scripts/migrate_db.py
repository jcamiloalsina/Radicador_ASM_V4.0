#!/usr/bin/env python3
"""
Script de migración de datos de catastro_asomunicipios a asomunicipios_db

Ejecutar con:
  python3 migrate_db.py

O dentro de Docker:
  docker exec -it asomunicipios-backend python3 /app/backend/scripts/migrate_db.py
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

# Configuración
MONGO_URL = "mongodb://mongodb:27017"  # URL dentro de Docker
SOURCE_DB = "catastro_asomunicipios"
TARGET_DB = "asomunicipios_db"

# Colecciones a migrar
COLLECTIONS_TO_MIGRATE = [
    "petitions",
    "counters",
    "users",
    "predios",
    "resoluciones",
    "certificados",
    "notificaciones",
    "logs",
]

async def migrate():
    print("=" * 60)
    print("MIGRACIÓN DE BASE DE DATOS")
    print(f"Origen: {SOURCE_DB}")
    print(f"Destino: {TARGET_DB}")
    print("=" * 60)
    
    client = AsyncIOMotorClient(MONGO_URL)
    source = client[SOURCE_DB]
    target = client[TARGET_DB]
    
    # Verificar conexión
    try:
        await client.admin.command('ping')
        print("✅ Conexión a MongoDB exitosa\n")
    except Exception as e:
        print(f"❌ Error de conexión: {e}")
        return
    
    # Mostrar estadísticas antes de migrar
    print("📊 ESTADÍSTICAS ANTES DE MIGRAR:")
    print("-" * 40)
    
    for collection_name in COLLECTIONS_TO_MIGRATE:
        source_count = await source[collection_name].count_documents({})
        target_count = await target[collection_name].count_documents({})
        print(f"  {collection_name}:")
        print(f"    - {SOURCE_DB}: {source_count}")
        print(f"    - {TARGET_DB}: {target_count}")
    
    print("\n" + "=" * 60)
    print("INICIANDO MIGRACIÓN...")
    print("=" * 60 + "\n")
    
    total_migrated = 0
    total_skipped = 0
    
    for collection_name in COLLECTIONS_TO_MIGRATE:
        print(f"\n📁 Migrando colección: {collection_name}")
        print("-" * 40)
        
        source_docs = await source[collection_name].find({}).to_list(None)
        migrated = 0
        skipped = 0
        
        for doc in source_docs:
            # Determinar campo único para evitar duplicados
            if collection_name == "petitions":
                unique_field = "radicado"
            elif collection_name == "users":
                unique_field = "email"
            elif collection_name == "counters":
                unique_field = "_id"
            elif collection_name == "predios":
                unique_field = "codigo_predial_nacional"
            elif collection_name == "resoluciones":
                unique_field = "numero_resolucion"
            elif collection_name == "certificados":
                unique_field = "numero_certificado"
            else:
                unique_field = "id"
            
            # Verificar si ya existe
            unique_value = doc.get(unique_field)
            if unique_value:
                exists = await target[collection_name].find_one({unique_field: unique_value})
                if exists:
                    skipped += 1
                    continue
            
            # Insertar en destino
            try:
                await target[collection_name].insert_one(doc)
                migrated += 1
                if collection_name == "petitions":
                    print(f"  ✅ Migrado: {doc.get('radicado', 'N/A')}")
            except Exception as e:
                print(f"  ❌ Error migrando documento: {e}")
        
        print(f"  📈 Migrados: {migrated}, Omitidos (ya existían): {skipped}")
        total_migrated += migrated
        total_skipped += skipped
    
    # Actualizar contador si es necesario
    print("\n" + "=" * 60)
    print("ACTUALIZANDO CONTADOR DE RADICADOS...")
    print("=" * 60)
    
    # Obtener el máximo radicado en destino
    max_radicado = await target.petitions.find_one(
        {"radicado": {"$regex": "^RASMGC-"}},
        sort=[("radicado", -1)]
    )
    
    if max_radicado:
        # Extraer el número del radicado (RASMGC-XXXX-DD-MM-YYYY)
        radicado_parts = max_radicado['radicado'].split('-')
        if len(radicado_parts) >= 2:
            try:
                max_sequence = int(radicado_parts[1])
                print(f"  Máximo radicado encontrado: {max_radicado['radicado']}")
                print(f"  Secuencia máxima: {max_sequence}")
                
                # Actualizar contador
                await target.counters.update_one(
                    {"_id": "radicado_counter"},
                    {"$set": {"sequence": max_sequence}},
                    upsert=True
                )
                print(f"  ✅ Contador actualizado a: {max_sequence}")
            except ValueError:
                print("  ⚠️ No se pudo extraer el número de secuencia")
    
    # Resumen final
    print("\n" + "=" * 60)
    print("📊 RESUMEN DE MIGRACIÓN")
    print("=" * 60)
    print(f"  Total documentos migrados: {total_migrated}")
    print(f"  Total documentos omitidos: {total_skipped}")
    
    # Estadísticas después de migrar
    print("\n📊 ESTADÍSTICAS DESPUÉS DE MIGRAR:")
    print("-" * 40)
    
    for collection_name in COLLECTIONS_TO_MIGRATE:
        target_count = await target[collection_name].count_documents({})
        print(f"  {collection_name} en {TARGET_DB}: {target_count}")
    
    print("\n✅ MIGRACIÓN COMPLETADA")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(migrate())
