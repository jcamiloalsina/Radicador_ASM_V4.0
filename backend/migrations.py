#!/usr/bin/env python3
"""
Script de Migración Automática - Asomunicipios
Este script se ejecuta automáticamente al iniciar el servidor.
Solo ejecuta las migraciones que no se han completado previamente.

Migraciones incluidas:
1. Propietarios R1: Separar nombre_propietario en primer_apellido, segundo_apellido, etc.
2. Estructura R2: Separar zonas y construcciones en arrays independientes
"""

import os
import sys
import logging
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import load_dotenv

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - MIGRACION - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Cargar variables de entorno
load_dotenv('/app/backend/.env')

MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'asomunicipios_db')


def conectar_db():
    """Conecta a MongoDB y retorna la base de datos"""
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]


def verificar_migracion_completada(db, nombre_migracion):
    """Verifica si una migración ya fue completada"""
    registro = db.migraciones.find_one({'nombre': nombre_migracion, 'completada': True})
    return registro is not None


def registrar_migracion(db, nombre_migracion, stats):
    """Registra que una migración fue completada"""
    db.migraciones.update_one(
        {'nombre': nombre_migracion},
        {
            '$set': {
                'nombre': nombre_migracion,
                'completada': True,
                'fecha_ejecucion': datetime.now(timezone.utc).isoformat(),
                'estadisticas': stats
            }
        },
        upsert=True
    )


def generar_id_construccion(index):
    """Genera ID de construcción: A, B, C... Z, AA, AB..."""
    if index < 26:
        return chr(65 + index)
    else:
        first_char = chr(65 + (index - 26) // 26)
        second_char = chr(65 + (index - 26) % 26)
        return first_char + second_char


def migrar_propietarios_r1(db):
    """
    Migración 1: Separar nombre_propietario en campos individuales
    """
    nombre_migracion = 'propietarios_r1_separar_nombres'
    
    if verificar_migracion_completada(db, nombre_migracion):
        logger.info(f"✅ Migración '{nombre_migracion}' ya fue completada anteriormente")
        return True
    
    logger.info(f"🔄 Iniciando migración: {nombre_migracion}")
    
    # Buscar predios que necesitan migración
    query = {
        'nombre_propietario': {'$exists': True, '$ne': ''},
        'primer_apellido': {'$exists': False}
    }
    
    total = db.predios.count_documents(query)
    logger.info(f"   Predios a migrar: {total}")
    
    if total == 0:
        logger.info("   No hay predios para migrar")
        registrar_migracion(db, nombre_migracion, {'migrados': 0, 'mensaje': 'Sin predios para migrar'})
        return True
    
    stats = {'migrados': 0, 'errores': 0}
    
    cursor = db.predios.find(query, {'_id': 1, 'nombre_propietario': 1, 'propietarios': 1})
    
    for predio in cursor:
        try:
            nombre_completo = predio.get('nombre_propietario', '')
            partes = nombre_completo.strip().split() if nombre_completo else []
            
            # Separar en apellidos y nombres
            primer_apellido = partes[0] if len(partes) > 0 else ''
            segundo_apellido = partes[1] if len(partes) > 1 else ''
            primer_nombre = partes[2] if len(partes) > 2 else ''
            segundo_nombre = ' '.join(partes[3:]) if len(partes) > 3 else ''
            
            update_data = {
                '$set': {
                    'primer_apellido': primer_apellido,
                    'segundo_apellido': segundo_apellido,
                    'primer_nombre': primer_nombre,
                    'segundo_nombre': segundo_nombre,
                    'r1_migrado': True
                }
            }
            
            # También actualizar propietarios si existen
            propietarios = predio.get('propietarios', [])
            if propietarios:
                for prop in propietarios:
                    if 'nombre_propietario' in prop and 'primer_apellido' not in prop:
                        nombre = prop.get('nombre_propietario', '')
                        partes_prop = nombre.strip().split() if nombre else []
                        prop['primer_apellido'] = partes_prop[0] if len(partes_prop) > 0 else ''
                        prop['segundo_apellido'] = partes_prop[1] if len(partes_prop) > 1 else ''
                        prop['primer_nombre'] = partes_prop[2] if len(partes_prop) > 2 else ''
                        prop['segundo_nombre'] = ' '.join(partes_prop[3:]) if len(partes_prop) > 3 else ''
                update_data['$set']['propietarios'] = propietarios
            
            db.predios.update_one({'_id': predio['_id']}, update_data)
            stats['migrados'] += 1
            
            if stats['migrados'] % 5000 == 0:
                logger.info(f"   Progreso: {stats['migrados']} predios migrados...")
                
        except Exception as e:
            stats['errores'] += 1
            logger.error(f"   Error en predio {predio.get('_id')}: {e}")
    
    logger.info(f"✅ Migración R1 completada: {stats['migrados']} migrados, {stats['errores']} errores")
    registrar_migracion(db, nombre_migracion, stats)
    return stats['errores'] == 0


def migrar_estructura_r2(db):
    """
    Migración 2: Separar zonas y construcciones en arrays independientes
    """
    nombre_migracion = 'estructura_r2_separar_zonas_construcciones'
    
    if verificar_migracion_completada(db, nombre_migracion):
        logger.info(f"✅ Migración '{nombre_migracion}' ya fue completada anteriormente")
        return True
    
    logger.info(f"🔄 Iniciando migración: {nombre_migracion}")
    
    # Buscar predios con r2_registros que no han sido migrados
    query = {
        'r2_registros': {'$exists': True, '$ne': []},
        'r2_migrado': {'$ne': True}
    }
    
    total = db.predios.count_documents(query)
    logger.info(f"   Predios a migrar: {total}")
    
    if total == 0:
        logger.info("   No hay predios para migrar")
        registrar_migracion(db, nombre_migracion, {'migrados': 0, 'mensaje': 'Sin predios para migrar'})
        return True
    
    stats = {'migrados': 0, 'sin_cambios': 0, 'errores': 0, 'zonas': 0, 'construcciones': 0}
    
    cursor = db.predios.find(query)
    
    for predio in cursor:
        try:
            # Ya tiene el nuevo formato?
            if predio.get('zonas') and predio.get('construcciones'):
                stats['sin_cambios'] += 1
                continue
            
            r2_registros = predio.get('r2_registros', [])
            if not r2_registros:
                stats['sin_cambios'] += 1
                continue
            
            r2 = r2_registros[0]
            matricula = r2.get('matricula_inmobiliaria', '')
            zonas_mixtas = r2.get('zonas', [])
            
            if not zonas_mixtas:
                stats['sin_cambios'] += 1
                continue
            
            # Crear arrays separados
            nuevas_zonas = []
            nuevas_construcciones = []
            
            for zm in zonas_mixtas:
                # Zona de terreno
                nuevas_zonas.append({
                    'zona_fisica': str(zm.get('zona_fisica', 0) or 0),
                    'zona_economica': str(zm.get('zona_economica', 0) or 0),
                    'area_terreno': float(zm.get('area_terreno', 0) or 0)
                })
                
                # Construcción si tiene datos
                area_construida = float(zm.get('area_construida', 0) or 0)
                habitaciones = int(zm.get('habitaciones', 0) or 0)
                banos = int(zm.get('banos', 0) or 0)
                locales = int(zm.get('locales', 0) or 0)
                
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
            
            # Si no hay construcciones, crear una vacía
            if not nuevas_construcciones:
                nuevas_construcciones.append({
                    'id': 'A', 'piso': 1, 'habitaciones': 0, 'banos': 0,
                    'locales': 0, 'tipificacion': '', 'uso': '', 'puntaje': 0, 'area_construida': 0
                })
            
            # Actualizar predio
            db.predios.update_one(
                {'_id': predio['_id']},
                {
                    '$set': {
                        'matricula_inmobiliaria': matricula,
                        'zonas': nuevas_zonas,
                        'construcciones': nuevas_construcciones,
                        'r2_migrado': True,
                        'r2_migracion_fecha': datetime.now(timezone.utc).isoformat()
                    }
                }
            )
            
            stats['migrados'] += 1
            stats['zonas'] += len(nuevas_zonas)
            stats['construcciones'] += len(nuevas_construcciones)
            
            if stats['migrados'] % 5000 == 0:
                logger.info(f"   Progreso: {stats['migrados']} predios migrados...")
                
        except Exception as e:
            stats['errores'] += 1
            logger.error(f"   Error en predio {predio.get('_id')}: {e}")
    
    logger.info(f"✅ Migración R2 completada: {stats['migrados']} migrados, {stats['zonas']} zonas, {stats['construcciones']} construcciones, {stats['errores']} errores")
    registrar_migracion(db, nombre_migracion, stats)
    return stats['errores'] == 0


def migrar_vigencias_incorrectas(db):
    """
    Migración 3: Corregir vigencias con formato incorrecto (ej: "02042026" -> 2026)
    Aplica a predios_nuevos y predios que tengan vigencia en formato string largo
    """
    nombre_migracion = 'corregir_vigencias_formato'
    
    if verificar_migracion_completada(db, nombre_migracion):
        logger.info(f"✅ Migración '{nombre_migracion}' ya fue completada anteriormente")
        return True
    
    logger.info(f"🔄 Iniciando migración: {nombre_migracion}")
    
    stats = {'predios_nuevos': 0, 'predios': 0, 'errores': 0}
    anio_actual = datetime.now().year
    
    # Corregir en predios_nuevos
    for predio in db.predios_nuevos.find({'vigencia': {'$type': 'string'}}):
        try:
            vigencia = predio.get('vigencia', '')
            # Si es string con más de 4 caracteres, es formato incorrecto
            if isinstance(vigencia, str) and len(vigencia) > 4:
                db.predios_nuevos.update_one(
                    {'_id': predio['_id']},
                    {'$set': {'vigencia': anio_actual}}
                )
                stats['predios_nuevos'] += 1
        except Exception as e:
            stats['errores'] += 1
            logger.error(f"   Error en predios_nuevos {predio.get('_id')}: {e}")
    
    # Corregir en predios principal
    for predio in db.predios.find({'vigencia': {'$type': 'string'}}):
        try:
            vigencia = predio.get('vigencia', '')
            # Si es string con más de 4 caracteres, es formato incorrecto
            if isinstance(vigencia, str) and len(vigencia) > 4:
                db.predios.update_one(
                    {'_id': predio['_id']},
                    {'$set': {'vigencia': anio_actual}}
                )
                stats['predios'] += 1
        except Exception as e:
            stats['errores'] += 1
            logger.error(f"   Error en predios {predio.get('_id')}: {e}")
    
    logger.info(f"✅ Migración vigencias completada: {stats['predios_nuevos']} en predios_nuevos, {stats['predios']} en predios, {stats['errores']} errores")
    registrar_migracion(db, nombre_migracion, stats)
    return stats['errores'] == 0


def corregir_codigo_homologado_predio_especifico(db):
    """
    Migración única: Corregir código homologado del predio 541280002000000030236000000000
    Asigna un código homologado disponible de la colección codigos_homologados
    """
    nombre_migracion = 'corregir_homologado_541280002000000030236000000000'
    
    if verificar_migracion_completada(db, nombre_migracion):
        logger.info(f"✅ Migración '{nombre_migracion}' ya fue completada anteriormente")
        return True
    
    logger.info(f"🔄 Iniciando migración: {nombre_migracion}")
    
    codigo_predial = "541280002000000030236000000000"
    
    # Buscar el predio
    predio = db.predios.find_one({"codigo_predial_nacional": codigo_predial})
    
    if not predio:
        logger.info(f"   Predio {codigo_predial} no encontrado en la base de datos")
        registrar_migracion(db, nombre_migracion, {'mensaje': 'Predio no encontrado', 'corregido': False})
        return True
    
    municipio = predio.get('municipio', '')
    codigo_homologado_actual = predio.get('codigo_homologado', '')
    
    logger.info(f"   Predio encontrado: {codigo_predial}")
    logger.info(f"   Municipio: {municipio}")
    logger.info(f"   Código homologado actual: {codigo_homologado_actual}")
    
    # Buscar un código homologado disponible para este municipio
    codigo_disponible = db.codigos_homologados.find_one({
        "municipio": municipio,
        "usado": {"$ne": True}
    })
    
    if not codigo_disponible:
        logger.warning(f"   No hay códigos homologados disponibles para {municipio}")
        registrar_migracion(db, nombre_migracion, {
            'mensaje': f'No hay códigos disponibles para {municipio}',
            'corregido': False,
            'codigo_actual': codigo_homologado_actual
        })
        return True
    
    nuevo_codigo = codigo_disponible.get('codigo', '')
    
    # Actualizar el predio con el nuevo código homologado
    db.predios.update_one(
        {"codigo_predial_nacional": codigo_predial},
        {"$set": {"codigo_homologado": nuevo_codigo}}
    )
    
    # Marcar el código como usado
    db.codigos_homologados.update_one(
        {"_id": codigo_disponible["_id"]},
        {"$set": {"usado": True}}
    )
    
    logger.info(f"   ✅ Código homologado actualizado: {codigo_homologado_actual} → {nuevo_codigo}")
    
    registrar_migracion(db, nombre_migracion, {
        'codigo_predial': codigo_predial,
        'municipio': municipio,
        'codigo_anterior': codigo_homologado_actual,
        'codigo_nuevo': nuevo_codigo,
        'corregido': True
    })
    
    return True


def ejecutar_migraciones():
    """
    Ejecuta todas las migraciones pendientes.
    Esta función es llamada al iniciar el servidor.
    """
    logger.info("=" * 60)
    logger.info("SISTEMA DE MIGRACIONES AUTOMÁTICAS - ASOMUNICIPIOS")
    logger.info("=" * 60)
    
    try:
        db = conectar_db()
        logger.info(f"Conectado a base de datos: {DB_NAME}")
        
        # Ejecutar migraciones en orden
        migrar_propietarios_r1(db)
        migrar_estructura_r2(db)
        migrar_vigencias_incorrectas(db)
        corregir_codigo_homologado_predio_especifico(db)
        
        logger.info("=" * 60)
        logger.info("✅ PROCESO DE MIGRACIONES COMPLETADO")
        logger.info("=" * 60)
        return True
        
    except Exception as e:
        logger.error(f"❌ Error durante las migraciones: {e}")
        return False


if __name__ == '__main__':
    ejecutar_migraciones()
