#!/usr/bin/env python3
"""
Script de diagnóstico para verificar por qué las notificaciones no llegan al coordinador.
Ejecutar en el servidor de desarrollo del usuario.

Uso: python diagnostico_notificaciones.py <predio_id>
"""

import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
import os

async def diagnosticar(predio_id: str = None):
    # Conectar a la base de datos
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'asomunicipios')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("=" * 60)
    print("DIAGNÓSTICO DE NOTIFICACIONES - ENVIAR A REVISIÓN")
    print("=" * 60)
    
    # 1. Obtener predio (el más reciente en revisión si no se especifica)
    if predio_id:
        predio = await db.predios_nuevos.find_one({'id': predio_id}, {'_id': 0})
    else:
        predio = await db.predios_nuevos.find_one(
            {'estado_flujo': 'revision'}, 
            {'_id': 0},
            sort=[('created_at', -1)]
        )
    
    if not predio:
        print("❌ No se encontró ningún predio en estado 'revision'")
        print("   Intente especificar el ID del predio como argumento")
        return
    
    print(f"\n📋 PREDIO ENCONTRADO:")
    print(f"   ID: {predio.get('id')}")
    print(f"   Código: {predio.get('codigo_predial_nacional')}")
    print(f"   Municipio: {predio.get('municipio')}")
    print(f"   Estado: {predio.get('estado_flujo')}")
    print(f"   Gestor Creador ID: {predio.get('gestor_creador_id')}")
    print(f"   Gestor Apoyo ID: {predio.get('gestor_apoyo_id')}")
    
    municipio_predio = predio.get('municipio')
    
    # 2. Verificar coordinadores/administradores
    print(f"\n👥 USUARIOS COORDINADORES/ADMINISTRADORES:")
    coordinadores_encontrados = 0
    coordinadores_excluidos_municipio = 0
    coordinadores_agregados = 0
    
    async for coord in db.users.find({
        "role": {"$in": ["coordinador", "administrador"]},
        "deleted": {"$ne": True}
    }, {"_id": 0, "id": 1, "email": 1, "municipios": 1, "role": 1, "full_name": 1}):
        coordinadores_encontrados += 1
        coord_municipios = coord.get('municipios', [])
        
        print(f"\n   📧 {coord.get('email')} ({coord.get('role')})")
        print(f"      ID: {coord.get('id')}")
        print(f"      Municipios asignados: {coord_municipios if coord_municipios else 'TODOS (sin restricción)'}")
        
        # Verificar si puede recibir notificación
        if coord_municipios and municipio_predio not in coord_municipios:
            print(f"      ❌ EXCLUIDO: Municipio '{municipio_predio}' NO está en sus municipios")
            coordinadores_excluidos_municipio += 1
        elif coord['id'] == predio.get('gestor_apoyo_id'):
            print(f"      ⚠️  EXCLUIDO: Es el mismo usuario que envió a revisión")
        else:
            print(f"      ✅ INCLUIDO: Recibirá notificación")
            coordinadores_agregados += 1
    
    # 3. Verificar notificaciones existentes
    print(f"\n📬 NOTIFICACIONES DEL PREDIO:")
    notifs = await db.notifications.find(
        {'predio_id': predio.get('id')},
        {'_id': 0}
    ).to_list(20)
    
    if notifs:
        for n in notifs:
            user = await db.users.find_one({'id': n.get('user_id')}, {'_id': 0, 'email': 1})
            print(f"   - {n.get('tipo')}: {user.get('email') if user else 'Usuario no encontrado'}")
            print(f"     Título: {n.get('titulo')}")
            print(f"     Fecha: {n.get('created_at')}")
    else:
        print("   ❌ No se encontraron notificaciones para este predio")
    
    # 4. Resumen
    print(f"\n" + "=" * 60)
    print("📊 RESUMEN:")
    print(f"   Coordinadores/Admins encontrados: {coordinadores_encontrados}")
    print(f"   Excluidos por municipio: {coordinadores_excluidos_municipio}")
    print(f"   Que deberían recibir notificación: {coordinadores_agregados}")
    print(f"   Notificaciones creadas: {len(notifs)}")
    
    if coordinadores_agregados == 0:
        print("\n⚠️  PROBLEMA DETECTADO:")
        if coordinadores_excluidos_municipio > 0:
            print(f"   Los coordinadores tienen municipios asignados que NO incluyen '{municipio_predio}'")
            print("   SOLUCIÓN: Agregar el municipio a los coordinadores o quitar la restricción de municipios")
    
    print("=" * 60)

if __name__ == "__main__":
    predio_id = sys.argv[1] if len(sys.argv) > 1 else None
    asyncio.run(diagnosticar(predio_id))
