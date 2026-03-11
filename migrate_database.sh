#!/bin/bash
# Script para migrar datos de catastro_asomunicipios a asomunicipios_db
# Los radicados duplicados reciben un nuevo número consecutivo
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
echo "(Duplicados recibirán nuevo número)"
echo "=============================================="

# Migrar peticiones con reasignación de radicados duplicados
docker exec -it asomunicipios-mongodb mongosh --quiet --eval "
  var source = db.getSiblingDB('catastro_asomunicipios');
  var target = db.getSiblingDB('asomunicipios_db');
  
  // Obtener el contador actual
  var counter = target.counters.findOne({_id: 'radicado_counter'});
  var currentSequence = counter ? counter.sequence : 0;
  
  // Si no hay contador, buscar el máximo radicado existente
  if (currentSequence === 0) {
    var maxPetition = target.petitions.find({radicado: /^RASMGC-/}).sort({radicado: -1}).limit(1).toArray()[0];
    if (maxPetition) {
      var parts = maxPetition.radicado.split('-');
      currentSequence = parseInt(parts[1]) || 0;
    }
  }
  
  print('Contador inicial: ' + currentSequence);
  print('');
  
  var petitions = source.petitions.find({}).toArray();
  var migrated = 0;
  var reasigned = 0;
  
  petitions.forEach(function(p) {
    var originalRadicado = p.radicado;
    var exists = target.petitions.findOne({radicado: p.radicado});
    
    if (exists) {
      // Duplicado - asignar nuevo número
      currentSequence++;
      var today = new Date();
      var day = String(today.getDate()).padStart(2, '0');
      var month = String(today.getMonth() + 1).padStart(2, '0');
      var year = today.getFullYear();
      var newRadicado = 'RASMGC-' + String(currentSequence).padStart(4, '0') + '-' + day + '-' + month + '-' + year;
      
      p.radicado = newRadicado;
      p.radicado_original = originalRadicado;
      p.migrado_el = new Date();
      p.nota_migracion = 'Radicado reasignado por duplicado durante migración';
      
      target.petitions.insertOne(p);
      print('🔄 Reasignado: ' + originalRadicado + ' → ' + newRadicado);
      reasigned++;
    } else {
      // No duplicado - migrar normalmente
      target.petitions.insertOne(p);
      print('✅ Migrado: ' + p.radicado);
      migrated++;
    }
  });
  
  // Actualizar contador
  target.counters.updateOne(
    {_id: 'radicado_counter'},
    {\$set: {sequence: currentSequence}},
    {upsert: true}
  );
  
  print('');
  print('========================================');
  print('Migrados sin cambio: ' + migrated);
  print('Reasignados (duplicados): ' + reasigned);
  print('Contador final: ' + currentSequence);
"

echo ""
echo "=============================================="
echo "📊 ESTADÍSTICAS DESPUÉS DE MIGRAR:"
docker exec -it asomunicipios-mongodb mongosh --quiet --eval "
  print('asomunicipios_db.petitions: ' + db.getSiblingDB('asomunicipios_db').petitions.countDocuments({}));
  var counter = db.getSiblingDB('asomunicipios_db').counters.findOne({_id: 'radicado_counter'});
  print('Contador de radicados: ' + (counter ? counter.sequence : 'N/A'));
"

echo ""
echo "✅ MIGRACIÓN COMPLETADA"
echo "=============================================="
