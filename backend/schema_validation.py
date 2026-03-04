#!/usr/bin/env python3
"""
Schema Validation for MongoDB Collections
Applies JSON Schema validation to critical collections.
Uses validationAction: "warn" to avoid breaking existing data.
"""

import logging

logger = logging.getLogger(__name__)


async def aplicar_validaciones_schema(db):
    """
    Apply JSON Schema validation to critical MongoDB collections.
    Uses validationAction: "warn" to log validation failures without rejecting documents.
    """
    logger.info("=" * 60)
    logger.info("📋 APLICANDO VALIDACIONES DE SCHEMA")
    logger.info("=" * 60)
    
    try:
        # Schema validation for 'predios' collection
        predios_schema = {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["codigo_predial_nacional", "municipio"],
                "properties": {
                    "codigo_predial_nacional": {
                        "bsonType": "string",
                        "minLength": 30,
                        "maxLength": 30,
                        "description": "NPN debe ser exactamente 30 caracteres"
                    },
                    "municipio": {
                        "bsonType": "string",
                        "description": "Municipio es requerido"
                    },
                    "propietarios": {
                        "bsonType": "array",
                        "items": {
                            "bsonType": "object",
                            "properties": {
                                "tipo_documento": {
                                    "enum": ["C", "E", "N", "T", "P", "X", "c", "e", "n", "t", "p", "x", "", None],
                                    "description": "Tipo documento: C=Cédula, E=Extranjería, N=NIT, T=Tarjeta, P=Pasaporte, X=Otro"
                                },
                                "estado_civil": {
                                    "enum": ["S", "E", "D", "V", "U", "s", "e", "d", "v", "u", "", None],
                                    "description": "Estado civil: S=Soltero, E=Casado, D=Divorciado, V=Viudo, U=Unión libre"
                                }
                            }
                        }
                    }
                }
            }
        }
        
        await db.command({
            "collMod": "predios",
            "validator": predios_schema,
            "validationLevel": "moderate",
            "validationAction": "warn"
        })
        logger.info("✅ Schema validation aplicado a 'predios'")
        
    except Exception as e:
        logger.warning(f"⚠️ No se pudo aplicar schema a 'predios': {e}")
    
    try:
        # Schema validation for 'users' collection
        users_schema = {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["email", "role"],
                "properties": {
                    "email": {
                        "bsonType": "string",
                        "description": "Email es requerido"
                    },
                    "role": {
                        "enum": [
                            "administrador", "coordinador", "gestor", "visor",
                            "atencion_usuario", "empresa", "ciudadano",
                            "admin", "user"  # Legacy roles
                        ],
                        "description": "Rol debe ser uno de los valores permitidos"
                    }
                }
            }
        }
        
        await db.command({
            "collMod": "users",
            "validator": users_schema,
            "validationLevel": "moderate",
            "validationAction": "warn"
        })
        logger.info("✅ Schema validation aplicado a 'users'")
        
    except Exception as e:
        logger.warning(f"⚠️ No se pudo aplicar schema a 'users': {e}")
    
    try:
        # Schema validation for 'petitions' collection
        petitions_schema = {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["radicado", "estado"],
                "properties": {
                    "radicado": {
                        "bsonType": "string",
                        "description": "Radicado es requerido"
                    },
                    "estado": {
                        "enum": [
                            "radicado", "asignado", "en_proceso", "revision",
                            "aprobado", "rechazado", "devuelto", "finalizado",
                            "pendiente", "completado"  # Legacy states
                        ],
                        "description": "Estado debe ser uno de los valores permitidos"
                    }
                }
            }
        }
        
        await db.command({
            "collMod": "petitions",
            "validator": petitions_schema,
            "validationLevel": "moderate",
            "validationAction": "warn"
        })
        logger.info("✅ Schema validation aplicado a 'petitions'")
        
    except Exception as e:
        logger.warning(f"⚠️ No se pudo aplicar schema a 'petitions': {e}")
    
    logger.info("=" * 60)
    logger.info("✅ VALIDACIONES DE SCHEMA COMPLETADAS")
    logger.info("=" * 60)
