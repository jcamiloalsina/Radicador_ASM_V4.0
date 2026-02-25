"""
SCRIPT PARA REGISTRAR ELIMINACIONES DE PREDIOS EN EL HISTORIAL

Este script busca predios con deleted=true y los registra en predios_eliminados
con la resolución y demás datos que proporciones.

INSTRUCCIONES DE USO:
1. Edita la lista ELIMINACIONES_A_REGISTRAR con los datos de cada predio eliminado
2. Ejecuta: python scripts/registrar_eliminaciones.py
"""

import asyncio
import os
import sys
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import uuid

# ============================================================
# CONFIGURACIÓN - EDITA ESTOS DATOS
# ============================================================

ELIMINACIONES_A_REGISTRAR = [
    # Ejemplo de formato - agrega tantos como necesites:
    {
        "codigo_predial_nacional": "547200001000000010001000000000",  # Código del predio eliminado
        "resolucion": "001-2026",                                      # Número de resolución
        "fecha_resolucion": "2026-01-15",                              # Fecha de la resolución (YYYY-MM-DD)
        "radicado": "RASMGC-1234-01-01-2026",                         # Radicado asociado (opcional)
        "motivo": "Fusión de predios según solicitud del propietario"  # Motivo de la eliminación
    },
    # Agrega más predios aquí:
    # {
    #     "codigo_predial_nacional": "OTRO_CODIGO",
    #     "resolucion": "002-2026",
    #     "fecha_resolucion": "2026-01-20",
    #     "radicado": "",
    #     "motivo": "Motivo de eliminación"
    # },
]

# ============================================================
# NO MODIFICAR A PARTIR DE AQUÍ
# ============================================================

async def registrar_eliminaciones():
    """Registra las eliminaciones en la base de datos"""
    
    # Conectar a MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'catastro_app')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("=" * 60)
    print("REGISTRO DE ELIMINACIONES DE PREDIOS")
    print("=" * 60)
    print(f"Base de datos: {db_name}")
    print(f"Eliminaciones a procesar: {len(ELIMINACIONES_A_REGISTRAR)}")
    print("=" * 60)
    
    resultados = {
        "registrados": 0,
        "ya_existentes": 0,
        "no_encontrados": 0,
        "errores": 0
    }
    
    for eliminacion in ELIMINACIONES_A_REGISTRAR:
        codigo = eliminacion.get("codigo_predial_nacional")
        
        if not codigo:
            print(f"[ERROR] Entrada sin código predial: {eliminacion}")
            resultados["errores"] += 1
            continue
        
        print(f"\nProcesando: {codigo}")
        
        # Verificar si ya existe en predios_eliminados
        existe = await db.predios_eliminados.find_one({"codigo_predial_nacional": codigo})
        if existe:
            print(f"  -> Ya existe en predios_eliminados, actualizando datos de resolución...")
            # Actualizar con los nuevos datos de resolución
            await db.predios_eliminados.update_one(
                {"codigo_predial_nacional": codigo},
                {
                    "$set": {
                        "resolucion": eliminacion.get("resolucion", ""),
                        "fecha_resolucion": eliminacion.get("fecha_resolucion", ""),
                        "radicado_eliminacion": eliminacion.get("radicado", ""),
                        "motivo": eliminacion.get("motivo", ""),
                        "actualizado_script": datetime.now(timezone.utc).isoformat()
                    }
                }
            )
            resultados["ya_existentes"] += 1
            print(f"  -> Actualizado con resolución: {eliminacion.get('resolucion')}")
            continue
        
        # Buscar el predio en la colección predios (puede estar con deleted=true)
        predio = await db.predios.find_one(
            {"codigo_predial_nacional": codigo},
            {"_id": 0}
        )
        
        if not predio:
            # Intentar buscar por otros campos
            predio = await db.predios.find_one(
                {"$or": [
                    {"codigo_predial": codigo},
                    {"codigo_homologado": codigo}
                ]},
                {"_id": 0}
            )
        
        if not predio:
            print(f"  -> [ADVERTENCIA] Predio no encontrado en la base de datos")
            print(f"     Creando registro mínimo en predios_eliminados...")
            
            # Crear registro mínimo
            eliminado_doc = {
                "id": str(uuid.uuid4()),
                "codigo_predial_nacional": codigo,
                "codigo_homologado": "",
                "municipio": "",
                "direccion": "",
                "nombre_propietario": "",
                "propietarios": [],
                "area_terreno": 0,
                "area_construida": 0,
                "avaluo": 0,
                "destino_economico": "",
                "vigencia_origen": None,
                "vigencia_eliminacion": datetime.now().year,
                "radicado_eliminacion": eliminacion.get("radicado", ""),
                "resolucion": eliminacion.get("resolucion", ""),
                "fecha_resolucion": eliminacion.get("fecha_resolucion", ""),
                "motivo": eliminacion.get("motivo", ""),
                "eliminado_en": datetime.now(timezone.utc).isoformat(),
                "eliminado_por": "Script de corrección",
                "predio_id_original": None,
                "registro_script": True,
                "fecha_registro_script": datetime.now(timezone.utc).isoformat()
            }
            
            await db.predios_eliminados.insert_one(eliminado_doc)
            resultados["no_encontrados"] += 1
            print(f"  -> Registro mínimo creado")
            continue
        
        # Crear documento completo para predios_eliminados
        eliminado_doc = {
            "id": str(uuid.uuid4()),
            "codigo_predial_nacional": codigo,
            "codigo_homologado": predio.get("codigo_homologado", ""),
            "municipio": predio.get("municipio", ""),
            "direccion": predio.get("direccion", ""),
            "nombre_propietario": predio.get("nombre_propietario", ""),
            "propietarios": predio.get("propietarios", []),
            "area_terreno": predio.get("area_terreno", 0),
            "area_construida": predio.get("area_construida", 0),
            "avaluo": predio.get("avaluo", 0),
            "destino_economico": predio.get("destino_economico", ""),
            "vigencia_origen": predio.get("vigencia"),
            "vigencia_eliminacion": datetime.now().year,
            # Datos de la eliminación proporcionados
            "radicado_eliminacion": eliminacion.get("radicado", ""),
            "resolucion": eliminacion.get("resolucion", ""),
            "fecha_resolucion": eliminacion.get("fecha_resolucion", ""),
            "motivo": eliminacion.get("motivo", ""),
            # Metadatos
            "eliminado_en": predio.get("deleted_at", datetime.now(timezone.utc).isoformat()),
            "eliminado_por": predio.get("deleted_by_name", "Script de corrección"),
            "eliminado_por_id": predio.get("deleted_by"),
            "predio_id_original": predio.get("id"),
            "registro_script": True,
            "fecha_registro_script": datetime.now(timezone.utc).isoformat()
        }
        
        await db.predios_eliminados.insert_one(eliminado_doc)
        resultados["registrados"] += 1
        
        # También actualizar el predio original con los datos de resolución
        if predio.get("id"):
            await db.predios.update_one(
                {"id": predio.get("id")},
                {
                    "$set": {
                        "radicado_eliminacion": eliminacion.get("radicado", ""),
                        "resolucion_eliminacion": eliminacion.get("resolucion", ""),
                        "fecha_resolucion_eliminacion": eliminacion.get("fecha_resolucion", ""),
                        "motivo_eliminacion": eliminacion.get("motivo", "")
                    },
                    "$push": {
                        "historial": {
                            "fecha": datetime.now(timezone.utc).isoformat(),
                            "accion": "eliminacion_registrada",
                            "descripcion": f"Eliminación registrada con resolución {eliminacion.get('resolucion', 'N/A')}",
                            "resolucion": eliminacion.get("resolucion", ""),
                            "radicado": eliminacion.get("radicado", ""),
                            "motivo": eliminacion.get("motivo", ""),
                            "registrado_por": "Script de corrección"
                        }
                    }
                }
            )
        
        print(f"  -> Registrado exitosamente con resolución: {eliminacion.get('resolucion')}")
    
    # Resumen final
    print("\n" + "=" * 60)
    print("RESUMEN")
    print("=" * 60)
    print(f"Registrados nuevos:     {resultados['registrados']}")
    print(f"Ya existentes (actualiz): {resultados['ya_existentes']}")
    print(f"No encontrados (mínimo): {resultados['no_encontrados']}")
    print(f"Errores:                {resultados['errores']}")
    print("=" * 60)
    
    client.close()
    return resultados


if __name__ == "__main__":
    if len(ELIMINACIONES_A_REGISTRAR) == 0:
        print("No hay eliminaciones configuradas.")
        print("Edita la lista ELIMINACIONES_A_REGISTRAR en este archivo.")
        sys.exit(1)
    
    # Confirmar antes de ejecutar
    print("\n¿Deseas procesar las siguientes eliminaciones?")
    for e in ELIMINACIONES_A_REGISTRAR[:5]:
        print(f"  - {e.get('codigo_predial_nacional')}: Resolución {e.get('resolucion')}")
    if len(ELIMINACIONES_A_REGISTRAR) > 5:
        print(f"  ... y {len(ELIMINACIONES_A_REGISTRAR) - 5} más")
    
    respuesta = input("\nEscribe 'SI' para continuar: ")
    if respuesta.upper() != "SI":
        print("Operación cancelada.")
        sys.exit(0)
    
    asyncio.run(registrar_eliminaciones())
