#!/usr/bin/env python3
"""
Script de Migración: Separar nombre_propietario en campos individuales
- primer_apellido
- segundo_apellido
- primer_nombre
- segundo_nombre

Lógica de parsing (estándar colombiano):
- 4+ palabras: primeras 2 son apellidos, resto son nombres
- 3 palabras: 2 apellidos + 1 nombre
- 2 palabras: 1 apellido + 1 nombre  
- 1 palabra: solo apellido
"""

import os
import sys
from datetime import datetime
from pymongo import MongoClient

# Conectar a MongoDB
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'asomunicipios_db')

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

def parsear_nombre(nombre_completo):
    """
    Parsea un nombre completo en sus componentes.
    Retorna: (primer_apellido, segundo_apellido, primer_nombre, segundo_nombre)
    """
    if not nombre_completo:
        return ('', '', '', '')
    
    # Limpiar y dividir
    nombre = nombre_completo.strip().upper()
    partes = [p for p in nombre.split() if p]
    
    if len(partes) == 0:
        return ('', '', '', '')
    elif len(partes) == 1:
        # Solo una palabra: es el apellido
        return (partes[0], '', '', '')
    elif len(partes) == 2:
        # Dos palabras: apellido + nombre
        return (partes[0], '', partes[1], '')
    elif len(partes) == 3:
        # Tres palabras: 2 apellidos + 1 nombre (más común en Colombia)
        return (partes[0], partes[1], partes[2], '')
    else:
        # 4+ palabras: 2 apellidos + resto son nombres
        return (partes[0], partes[1], partes[2], ' '.join(partes[3:]))

def formatear_documento(numero):
    """Formatea número de documento con padding de 0s (12 dígitos)"""
    if not numero:
        return ''
    solo_numeros = ''.join(filter(str.isdigit, str(numero)))
    return solo_numeros.zfill(12) if solo_numeros else ''

def migrar_propietario(prop):
    """Migra un propietario individual al nuevo formato"""
    # Si ya tiene los campos nuevos, no migrar
    if prop.get('primer_apellido') or prop.get('primer_nombre'):
        return prop
    
    nombre = prop.get('nombre_propietario', '') or prop.get('nombre', '')
    if not nombre:
        return prop
    
    primer_apellido, segundo_apellido, primer_nombre, segundo_nombre = parsear_nombre(nombre)
    
    # Actualizar propietario
    prop['primer_apellido'] = primer_apellido
    prop['segundo_apellido'] = segundo_apellido
    prop['primer_nombre'] = primer_nombre
    prop['segundo_nombre'] = segundo_nombre
    prop['nombre_propietario'] = nombre  # Mantener el original
    
    # Migrar estado_civil a estado si existe
    if prop.get('estado_civil') and not prop.get('estado'):
        prop['estado'] = prop['estado_civil']
    
    # Formatear número de documento con padding
    if prop.get('numero_documento'):
        prop['numero_documento'] = formatear_documento(prop['numero_documento'])
    
    return prop

def migrar_coleccion(collection_name, dry_run=True):
    """
    Migra todos los documentos de una colección.
    dry_run=True solo muestra lo que haría sin hacer cambios.
    """
    collection = db[collection_name]
    
    # Buscar documentos que necesitan migración
    # (tienen nombre_propietario pero no tienen primer_apellido en el primer propietario)
    query = {
        "$or": [
            # Documentos con nombre_propietario directo
            {
                "nombre_propietario": {"$exists": True, "$ne": ""},
                "primer_apellido": {"$exists": False}
            },
            # Documentos con array de propietarios
            {
                "propietarios.0.nombre_propietario": {"$exists": True, "$ne": ""},
                "propietarios.0.primer_apellido": {"$exists": False}
            },
            # Propietarios con campo 'nombre'
            {
                "propietarios.0.nombre": {"$exists": True, "$ne": ""},
                "propietarios.0.primer_apellido": {"$exists": False}
            }
        ]
    }
    
    documentos = list(collection.find(query))
    total = len(documentos)
    
    print(f"\n{'='*60}")
    print(f"Colección: {collection_name}")
    print(f"Documentos a migrar: {total}")
    print(f"{'='*60}")
    
    if total == 0:
        print("  ✓ No hay documentos que necesiten migración")
        return 0
    
    migrados = 0
    errores = 0
    
    for doc in documentos:
        try:
            doc_id = doc.get('_id')
            codigo = doc.get('codigo_predial_nacional', doc.get('codigo', 'N/A'))[:30]
            
            # Migrar propietarios del array
            propietarios = doc.get('propietarios', [])
            if propietarios:
                nuevos_propietarios = [migrar_propietario(p.copy()) for p in propietarios]
            else:
                # Si no hay array, crear uno desde los campos directos
                prop_directo = {
                    'nombre_propietario': doc.get('nombre_propietario', ''),
                    'nombre': doc.get('nombre', ''),
                    'tipo_documento': doc.get('tipo_documento', 'C'),
                    'numero_documento': doc.get('numero_documento', ''),
                    'estado_civil': doc.get('estado_civil', ''),
                    'estado': doc.get('estado', '')
                }
                nuevos_propietarios = [migrar_propietario(prop_directo)]
            
            # Preparar update
            update_data = {
                'propietarios': nuevos_propietarios,
                # También actualizar campos de nivel raíz (para compatibilidad)
                'primer_apellido': nuevos_propietarios[0].get('primer_apellido', ''),
                'segundo_apellido': nuevos_propietarios[0].get('segundo_apellido', ''),
                'primer_nombre': nuevos_propietarios[0].get('primer_nombre', ''),
                'segundo_nombre': nuevos_propietarios[0].get('segundo_nombre', ''),
                'migrado_fecha': datetime.utcnow()
            }
            
            # También formatear numero_documento a nivel raíz
            if doc.get('numero_documento'):
                update_data['numero_documento'] = formatear_documento(doc['numero_documento'])
            
            if dry_run:
                # Mostrar ejemplo de lo que se haría
                nombre_original = doc.get('nombre_propietario', '') or (propietarios[0].get('nombre_propietario', '') if propietarios else '')
                print(f"\n  Código: {codigo}")
                print(f"    Original: '{nombre_original}'")
                print(f"    → Primer Apellido:  '{update_data['primer_apellido']}'")
                print(f"    → Segundo Apellido: '{update_data['segundo_apellido']}'")
                print(f"    → Primer Nombre:    '{update_data['primer_nombre']}'")
                print(f"    → Segundo Nombre:   '{update_data['segundo_nombre']}'")
                if update_data.get('numero_documento'):
                    print(f"    → Documento:        '{update_data['numero_documento']}' (con padding)")
            else:
                # Ejecutar la actualización
                collection.update_one(
                    {'_id': doc_id},
                    {'$set': update_data}
                )
            
            migrados += 1
            
        except Exception as e:
            errores += 1
            print(f"  ✗ Error en documento {doc.get('_id')}: {str(e)}")
    
    print(f"\n  Resumen {collection_name}:")
    print(f"    - Migrados: {migrados}")
    print(f"    - Errores: {errores}")
    
    return migrados

def main():
    print("\n" + "="*60)
    print("  MIGRACIÓN DE NOMBRES DE PROPIETARIOS")
    print("  Separación: nombre_propietario → 4 campos")
    print("="*60)
    
    # Verificar si es dry_run o ejecución real
    dry_run = '--ejecutar' not in sys.argv
    
    if dry_run:
        print("\n⚠️  MODO SIMULACIÓN (dry run)")
        print("   Para ejecutar la migración real, usa: python migrar_nombres_propietarios.py --ejecutar")
    else:
        print("\n🔄 MODO EJECUCIÓN - Los cambios se guardarán en la base de datos")
        respuesta = input("   ¿Desea continuar? (s/n): ")
        if respuesta.lower() != 's':
            print("   Migración cancelada.")
            return
    
    # Colecciones a migrar
    colecciones = [
        'predios',           # Predios principales
        'predios_nuevos',    # Predios en flujo de aprobación
        'cambios_predios',   # Historial de cambios
    ]
    
    total_migrados = 0
    
    for col in colecciones:
        if col in db.list_collection_names():
            total_migrados += migrar_coleccion(col, dry_run)
        else:
            print(f"\n  Colección '{col}' no existe, saltando...")
    
    print("\n" + "="*60)
    if dry_run:
        print(f"  SIMULACIÓN COMPLETADA")
        print(f"  Total de documentos que se migrarían: {total_migrados}")
        print(f"\n  Para ejecutar la migración real:")
        print(f"  python /app/scripts/migrar_nombres_propietarios.py --ejecutar")
    else:
        print(f"  MIGRACIÓN COMPLETADA")
        print(f"  Total de documentos migrados: {total_migrados}")
    print("="*60 + "\n")

if __name__ == '__main__':
    main()
