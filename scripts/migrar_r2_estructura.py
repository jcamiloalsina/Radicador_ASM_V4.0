#!/usr/bin/env python3
"""
Script de migración R2 - Separar zonas y construcciones

Este script migra los datos R2 del formato antiguo (zonas mixtas en r2_registros)
al nuevo formato separado (arrays 'zonas' y 'construcciones' a nivel de predio).

Formato antiguo:
{
    "r2_registros": [{
        "matricula_inmobiliaria": "...",
        "zonas": [
            {"zona_fisica": 1, "zona_economica": 2, "area_terreno": 100, 
             "habitaciones": 3, "banos": 2, "area_construida": 80, ...}
        ]
    }]
}

Formato nuevo:
{
    "matricula_inmobiliaria": "...",
    "zonas": [
        {"zona_fisica": "1", "zona_economica": "2", "area_terreno": 100}
    ],
    "construcciones": [
        {"id": "A", "piso": 1, "habitaciones": 3, "banos": 2, 
         "locales": 0, "tipificacion": "", "uso": "", "puntaje": 0, "area_construida": 80}
    ]
}

Uso:
    python migrar_r2_estructura.py [--dry-run] [--municipio MUNICIPIO] [--limit N]
"""

import os
import sys
import argparse
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv('/app/backend/.env')

MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'asomunicipios_db')


def conectar_db():
    """Conecta a MongoDB y retorna la base de datos"""
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]


def generar_id_construccion(index):
    """Genera ID de construcción: A, B, C... Z, AA, AB..."""
    if index < 26:
        return chr(65 + index)  # A-Z
    else:
        first_char = chr(65 + (index - 26) // 26)
        second_char = chr(65 + (index - 26) % 26)
        return first_char + second_char


def migrar_predio(predio, dry_run=False):
    """
    Migra un predio del formato antiguo al nuevo.
    Retorna el documento actualizado y un resumen de cambios.
    """
    cambios = {
        'codigo': predio.get('codigo_predial_nacional', 'N/A'),
        'tenia_r2': False,
        'zonas_creadas': 0,
        'construcciones_creadas': 0,
        'migrado': False
    }
    
    # Ya tiene el nuevo formato?
    if predio.get('zonas') and predio.get('construcciones'):
        cambios['migrado'] = False
        cambios['razon'] = 'Ya tiene formato nuevo'
        return None, cambios
    
    # Obtener r2_registros
    r2_registros = predio.get('r2_registros', [])
    if not r2_registros:
        cambios['migrado'] = False
        cambios['razon'] = 'Sin datos R2'
        return None, cambios
    
    cambios['tenia_r2'] = True
    
    # Extraer datos del primer r2_registro
    r2 = r2_registros[0]
    matricula = r2.get('matricula_inmobiliaria', '')
    zonas_mixtas = r2.get('zonas', [])
    
    if not zonas_mixtas:
        cambios['migrado'] = False
        cambios['razon'] = 'R2 sin zonas'
        return None, cambios
    
    # Crear arrays separados
    nuevas_zonas = []
    nuevas_construcciones = []
    
    for i, zm in enumerate(zonas_mixtas):
        # Extraer zona de terreno
        nuevas_zonas.append({
            'zona_fisica': str(zm.get('zona_fisica', 0) or 0),
            'zona_economica': str(zm.get('zona_economica', 0) or 0),
            'area_terreno': float(zm.get('area_terreno', 0) or 0)
        })
        
        # Extraer construcción si tiene datos
        area_construida = float(zm.get('area_construida', 0) or 0)
        habitaciones = int(zm.get('habitaciones', 0) or 0)
        banos = int(zm.get('banos', 0) or 0)
        locales = int(zm.get('locales', 0) or 0)
        
        # Solo crear construcción si tiene al menos un dato relevante
        if area_construida > 0 or habitaciones > 0 or banos > 0 or locales > 0:
            nuevas_construcciones.append({
                'id': generar_id_construccion(len(nuevas_construcciones)),
                'piso': int(zm.get('pisos', zm.get('piso', 1)) or 1),
                'habitaciones': habitaciones,
                'banos': banos,
                'locales': locales,
                'tipificacion': str(zm.get('tipificacion', '') or ''),
                'uso': str(zm.get('uso', '') or ''),
                'puntaje': float(zm.get('puntaje', 0) or 0),
                'area_construida': area_construida
            })
    
    # Si no se crearon construcciones, crear una vacía
    if not nuevas_construcciones:
        nuevas_construcciones.append({
            'id': 'A',
            'piso': 1,
            'habitaciones': 0,
            'banos': 0,
            'locales': 0,
            'tipificacion': '',
            'uso': '',
            'puntaje': 0,
            'area_construida': 0
        })
    
    cambios['zonas_creadas'] = len(nuevas_zonas)
    cambios['construcciones_creadas'] = len(nuevas_construcciones)
    cambios['migrado'] = True
    
    # Preparar actualización
    update_data = {
        '$set': {
            'matricula_inmobiliaria': matricula,
            'zonas': nuevas_zonas,
            'construcciones': nuevas_construcciones,
            'r2_migrado': True,
            'r2_migracion_fecha': datetime.now(timezone.utc).isoformat()
        }
    }
    
    return update_data, cambios


def ejecutar_migracion(db, dry_run=False, municipio=None, limit=None):
    """Ejecuta la migración de todos los predios"""
    
    print("=" * 60)
    print("MIGRACIÓN R2 - Separar Zonas y Construcciones")
    print("=" * 60)
    print(f"Modo: {'DRY RUN (sin cambios)' if dry_run else 'PRODUCCIÓN'}")
    print(f"Municipio: {municipio or 'Todos'}")
    print(f"Límite: {limit or 'Sin límite'}")
    print("=" * 60)
    
    # Construir query
    query = {
        'r2_registros': {'$exists': True, '$ne': []},
        'r2_migrado': {'$ne': True}  # No migrar los ya migrados
    }
    
    if municipio:
        query['municipio'] = {'$regex': municipio, '$options': 'i'}
    
    # Contar total
    total = db.predios.count_documents(query)
    print(f"\nPredios a procesar: {total}")
    
    if total == 0:
        print("No hay predios para migrar.")
        return
    
    # Procesar
    cursor = db.predios.find(query)
    if limit:
        cursor = cursor.limit(limit)
    
    stats = {
        'procesados': 0,
        'migrados': 0,
        'sin_cambios': 0,
        'errores': 0,
        'zonas_total': 0,
        'construcciones_total': 0
    }
    
    for predio in cursor:
        stats['procesados'] += 1
        
        try:
            update_data, cambios = migrar_predio(predio, dry_run)
            
            if cambios['migrado']:
                stats['migrados'] += 1
                stats['zonas_total'] += cambios['zonas_creadas']
                stats['construcciones_total'] += cambios['construcciones_creadas']
                
                if not dry_run and update_data:
                    db.predios.update_one(
                        {'_id': predio['_id']},
                        update_data
                    )
                
                if stats['migrados'] % 1000 == 0:
                    print(f"  Progreso: {stats['migrados']} predios migrados...")
            else:
                stats['sin_cambios'] += 1
                
        except Exception as e:
            stats['errores'] += 1
            print(f"  ERROR en {predio.get('codigo_predial_nacional', 'N/A')}: {e}")
    
    # Resumen
    print("\n" + "=" * 60)
    print("RESUMEN DE MIGRACIÓN")
    print("=" * 60)
    print(f"Predios procesados: {stats['procesados']}")
    print(f"Predios migrados:   {stats['migrados']}")
    print(f"Sin cambios:        {stats['sin_cambios']}")
    print(f"Errores:            {stats['errores']}")
    print(f"Zonas creadas:      {stats['zonas_total']}")
    print(f"Construcciones:     {stats['construcciones_total']}")
    print("=" * 60)
    
    if dry_run:
        print("\n⚠️  Este fue un DRY RUN. No se realizaron cambios.")
        print("    Ejecute sin --dry-run para aplicar los cambios.")
    else:
        print("\n✅ Migración completada exitosamente.")
    
    return stats


def main():
    parser = argparse.ArgumentParser(
        description='Migra datos R2 al nuevo formato separado (zonas + construcciones)'
    )
    parser.add_argument(
        '--dry-run', 
        action='store_true',
        help='Simular migración sin hacer cambios'
    )
    parser.add_argument(
        '--municipio',
        type=str,
        help='Filtrar por municipio específico'
    )
    parser.add_argument(
        '--limit',
        type=int,
        help='Limitar número de predios a procesar'
    )
    
    args = parser.parse_args()
    
    # Conectar a la base de datos
    print("Conectando a MongoDB...")
    db = conectar_db()
    print(f"Conectado a: {DB_NAME}")
    
    # Ejecutar migración
    ejecutar_migracion(
        db, 
        dry_run=args.dry_run,
        municipio=args.municipio,
        limit=args.limit
    )


if __name__ == '__main__':
    main()
