#!/bin/bash
# Script para migrar datos de catastro_asomunicipios a asomunicipios_db
# Ejecutar: ./migrate_database.sh

echo "=============================================="
echo "MIGRACIÓN DE BASE DE DATOS"
echo "De: catastro_asomunicipios"
echo "A:  asomunicipios_db"
echo "=============================================="

# Verificar estadísticas antes
echo ""
echo "📊 ESTADÍSTICAS ANTES DE MIGRAR:"
docker exec -it asomunicipios-mongodb mongosh --quiet --eval "
  print('catastro_asomunicipios.petitions: ' + db.getSiblingDB('catastro_asomunicipios').petitions.countDocuments({}));
  print('asomunicipios_db.petitions: ' + db.getSiblingDB('asomunicipios_db').petitions.countDocuments({}));
"

echo ""
echo "=============================================="
echo "MIGRANDO PETICIONES..."
echo "=============================================="

# Migrar peticiones
docker exec -it asomunicipios-mongodb mongosh --quiet --eval "
  var source = db.getSiblingDB('catastro_asomunicipios');
  var target = db.getSiblingDB('asomunicipios_db');
  
  var petitions = source.petitions.find({}).toArray();
  var migrated = 0;
  var skipped = 0;
  
  petitions.forEach(function(p) {
    if (!target.petitions.findOne({radicado: p.radicado})) {
      target.petitions.insertOne(p);
      print('✅ Migrado: ' + p.radicado);
      migrated++;
    } else {
      skipped++;
    }
  });
  
  print('');
  print('Migrados: ' + migrated);
  print('Omitidos (ya existían): ' + skipped);
"

echo ""
echo "=============================================="
echo "ACTUALIZANDO CONTADOR..."
echo "=============================================="

# Actualizar contador
docker exec -it asomunicipios-mongodb mongosh --quiet asomunicipios_db --eval "
  var maxPetition = db.petitions.find({radicado: /^RASMGC-/}).sort({radicado: -1}).limit(1).toArray()[0];
  if (maxPetition) {
    var parts = maxPetition.radicado.split('-');
    var sequence = parseInt(parts[1]);
    db.counters.updateOne(
      {_id: 'radicado_counter'},
      {\$set: {sequence: sequence}},
      {upsert: true}
    );
    print('Contador actualizado a: ' + sequence);
  }
"

echo ""
echo "=============================================="
echo "📊 ESTADÍSTICAS DESPUÉS DE MIGRAR:"
docker exec -it asomunicipios-mongodb mongosh --quiet --eval "
  print('asomunicipios_db.petitions: ' + db.getSiblingDB('asomunicipios_db').petitions.countDocuments({}));
"

echo ""
echo "✅ MIGRACIÓN COMPLETADA"
echo "=============================================="
