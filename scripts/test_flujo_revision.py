#!/usr/bin/env python3
"""
Script para probar el flujo de envío a revisión y notificaciones a coordinadores.
Ejecutar en tu servidor de desarrollo con:
    python3 test_flujo_revision.py

Requisitos:
    pip install pymongo
"""

from pymongo import MongoClient
from datetime import datetime, timezone
import uuid

# ============================================
# CONFIGURACIÓN - AJUSTA SEGÚN TU ENTORNO
# ============================================
MONGO_URL = "mongodb://localhost:27017"  # Cambia si es diferente
DB_NAME = "asomunicipios_db"              # Nombre de tu base de datos

# ============================================
# CONEXIÓN A MONGODB
# ============================================
print("=" * 60)
print("TEST DE FLUJO: ENVÍO A REVISIÓN Y NOTIFICACIONES")
print("=" * 60)
print()

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

# ============================================
# PASO 1: Buscar un predio en estado "creado" con gestor de apoyo
# ============================================
print("PASO 1: Buscando predio en estado 'creado' con gestor de apoyo asignado...")
predio = db.predios_nuevos.find_one({
    "estado_flujo": "creado",
    "gestor_apoyo_id": {"$ne": None}
})

if not predio:
    print("❌ No se encontró ningún predio en estado 'creado' con gestor de apoyo.")
    print("   Buscando cualquier predio en estado 'creado'...")
    predio = db.predios_nuevos.find_one({"estado_flujo": "creado"})
    
if not predio:
    print("❌ No hay predios en estado 'creado'. Creando uno de prueba...")
    
    # Buscar un gestor de apoyo
    gestor_apoyo = db.users.find_one({"role": "gestor_apoyo"})
    if not gestor_apoyo:
        gestor_apoyo = db.users.find_one({"role": "gestor"})
    
    # Buscar un gestor creador
    gestor_creador = db.users.find_one({"role": {"$in": ["gestor", "coordinador", "administrador"]}})
    
    predio = {
        "id": str(uuid.uuid4()),
        "departamento": "54",
        "municipio": "Test Municipio",
        "municipio_codigo": "999",
        "codigo_predial_nacional": f"549990001000000{datetime.now().strftime('%H%M%S')}000000000",
        "zona": "00",
        "sector": "01",
        "manzana_vereda": "0001",
        "terreno": "0001",
        "direccion": "CALLE TEST NOTIFICACIONES",
        "nombre_propietario": "PROPIETARIO TEST NOTIFICACIONES",
        "estado_flujo": "creado",
        "gestor_creador_id": gestor_creador["id"] if gestor_creador else None,
        "gestor_creador_nombre": gestor_creador.get("full_name") if gestor_creador else None,
        "gestor_apoyo_id": gestor_apoyo["id"] if gestor_apoyo else None,
        "gestor_apoyo_nombre": gestor_apoyo.get("full_name") if gestor_apoyo else None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "historial_flujo": []
    }
    db.predios_nuevos.insert_one(predio)
    print(f"   ✅ Predio de prueba creado: {predio['id']}")

print(f"   ✅ Predio encontrado:")
print(f"      ID: {predio.get('id')}")
print(f"      Código: {predio.get('codigo_predial_nacional')}")
print(f"      Municipio: {predio.get('municipio')}")
print(f"      Estado actual: {predio.get('estado_flujo')}")
print(f"      Gestor Apoyo: {predio.get('gestor_apoyo_nombre')}")
print()

# ============================================
# PASO 2: Buscar coordinadores y usuarios con permiso de aprobar
# ============================================
print("PASO 2: Buscando usuarios que deben recibir notificación...")

destinatarios = []
municipio_predio = predio.get('municipio')

# 2.1 Buscar coordinadores y administradores
print("   Buscando coordinadores y administradores...")
coordinadores = list(db.users.find({
    "role": {"$in": ["coordinador", "administrador"]},
    "deleted": {"$ne": True}
}, {"id": 1, "full_name": 1, "email": 1, "role": 1, "municipios": 1}))

for coord in coordinadores:
    coord_municipios = coord.get('municipios', [])
    # Si no tiene municipios asignados o el municipio del predio está en su lista
    if not coord_municipios or municipio_predio in coord_municipios:
        destinatarios.append({
            "id": coord["id"],
            "nombre": coord.get("full_name"),
            "email": coord.get("email"),
            "rol": coord.get("role"),
            "razon": "Coordinador/Administrador"
        })
        print(f"      ✅ {coord.get('full_name')} ({coord.get('email')}) - {coord.get('role')}")

# 2.2 Buscar usuarios con permiso de aprobar cambios
print("   Buscando usuarios con permiso 'aprobar_cambios'...")
permisos = list(db.user_permissions.find({
    "permissions.aprobar_cambios": True
}, {"user_id": 1}))

for perm in permisos:
    user_id = perm.get("user_id")
    # Evitar duplicados
    if any(d["id"] == user_id for d in destinatarios):
        continue
    
    usuario = db.users.find_one({"id": user_id, "deleted": {"$ne": True}})
    if usuario:
        user_municipios = usuario.get('municipios', [])
        if not user_municipios or municipio_predio in user_municipios:
            destinatarios.append({
                "id": usuario["id"],
                "nombre": usuario.get("full_name"),
                "email": usuario.get("email"),
                "rol": usuario.get("role"),
                "razon": "Permiso aprobar_cambios"
            })
            print(f"      ✅ {usuario.get('full_name')} ({usuario.get('email')}) - permiso aprobar_cambios")

# 2.3 Agregar gestor creador y apoyo
if predio.get('gestor_creador_id'):
    if not any(d["id"] == predio['gestor_creador_id'] for d in destinatarios):
        creador = db.users.find_one({"id": predio['gestor_creador_id']})
        if creador:
            destinatarios.append({
                "id": creador["id"],
                "nombre": creador.get("full_name"),
                "email": creador.get("email"),
                "rol": creador.get("role"),
                "razon": "Gestor creador"
            })

if predio.get('gestor_apoyo_id'):
    if not any(d["id"] == predio['gestor_apoyo_id'] for d in destinatarios):
        apoyo = db.users.find_one({"id": predio['gestor_apoyo_id']})
        if apoyo:
            destinatarios.append({
                "id": apoyo["id"],
                "nombre": apoyo.get("full_name"),
                "email": apoyo.get("email"),
                "rol": apoyo.get("role"),
                "razon": "Gestor apoyo"
            })

print()
print(f"   Total destinatarios encontrados: {len(destinatarios)}")
print()

# ============================================
# PASO 3: Simular envío a revisión
# ============================================
print("PASO 3: Simulando envío a revisión...")

# Actualizar estado del predio
historial_entry = {
    "fecha": datetime.now(timezone.utc).isoformat(),
    "accion": "enviar_revision",
    "estado_anterior": predio.get("estado_flujo"),
    "estado_nuevo": "revision",
    "usuario_id": "SCRIPT_TEST",
    "usuario_nombre": "Script de Prueba",
    "observaciones": "Prueba automática de notificaciones"
}

result = db.predios_nuevos.update_one(
    {"id": predio["id"]},
    {
        "$set": {
            "estado_flujo": "revision",
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        "$push": {"historial_flujo": historial_entry}
    }
)

if result.modified_count > 0:
    print(f"   ✅ Predio actualizado a estado 'revision'")
else:
    print(f"   ⚠️ No se pudo actualizar el predio")

print()

# ============================================
# PASO 4: Crear notificaciones
# ============================================
print("PASO 4: Creando notificaciones...")

notificaciones_creadas = 0
mensaje = f"El predio {predio.get('codigo_predial_nacional')} ha sido enviado para revisión"

for dest in destinatarios:
    notif = {
        "id": str(uuid.uuid4()),
        "user_id": dest["id"],
        "tipo": "predio_enviar_revision",
        "titulo": mensaje,
        "mensaje": f"Prueba de notificación - {dest['razon']}",
        "predio_id": predio["id"],
        "codigo_predial": predio.get("codigo_predial_nacional"),
        "leida": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    db.notifications.insert_one(notif)
    notificaciones_creadas += 1
    print(f"   ✅ Notificación creada para: {dest['nombre']} ({dest['email']})")

print()
print(f"   Total notificaciones creadas: {notificaciones_creadas}")
print()

# ============================================
# PASO 5: Verificar resultados
# ============================================
print("PASO 5: Verificando resultados...")
print()

# Verificar predio actualizado
predio_actualizado = db.predios_nuevos.find_one({"id": predio["id"]})
print(f"   Estado del predio: {predio_actualizado.get('estado_flujo')}")

# Verificar notificaciones creadas
notifs_verificar = list(db.notifications.find({
    "predio_id": predio["id"],
    "tipo": "predio_enviar_revision"
}))
print(f"   Notificaciones en BD: {len(notifs_verificar)}")

print()
print("=" * 60)
print("RESUMEN")
print("=" * 60)
print(f"   Predio ID: {predio['id']}")
print(f"   Código: {predio.get('codigo_predial_nacional')}")
print(f"   Estado: {predio_actualizado.get('estado_flujo')}")
print(f"   Notificaciones enviadas a:")
for dest in destinatarios:
    print(f"      - {dest['nombre']} ({dest['email']}) [{dest['razon']}]")
print()

if notificaciones_creadas > 0 and predio_actualizado.get('estado_flujo') == 'revision':
    print("✅ ¡PRUEBA EXITOSA! El flujo funciona correctamente.")
    print("   Los coordinadores deberían ver el predio en 'Predios Nuevos > En Revisión'")
else:
    print("❌ PRUEBA FALLIDA. Revisa los errores anteriores.")

print()
print("=" * 60)

# Cerrar conexión
client.close()
