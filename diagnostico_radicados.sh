#!/bin/bash
# Script de diagnóstico para radicados faltantes
# Ejecutar: ./diagnostico_radicados.sh

echo "=============================================="
echo "DIAGNÓSTICO DE RADICADOS"
echo "=============================================="

echo ""
echo "📊 1. COMPARACIÓN DE BASES DE DATOS:"
echo "----------------------------------------------"
docker exec -it asomunicipios-mongodb mongosh --quiet --eval "
  var dbs = ['asomunicipios_db', 'catastro_asomunicipios'];
  
  dbs.forEach(function(dbName) {
    var database = db.getSiblingDB(dbName);
    var petCount = database.petitions.countDocuments({});
    print(dbName + '.petitions: ' + petCount);
  });
"

echo ""
echo "📊 2. CONTADOR DE RADICADOS:"
echo "----------------------------------------------"
docker exec -it asomunicipios-mongodb mongosh --quiet asomunicipios_db --eval "
  var counter = db.counters.findOne({_id: 'radicado_counter'});
  print('Contador actual: ' + (counter ? counter.sequence : 'NO EXISTE'));
"

echo ""
echo "📊 3. ÚLTIMOS 20 RADICADOS EN asomunicipios_db:"
echo "----------------------------------------------"
docker exec -it asomunicipios-mongodb mongosh --quiet asomunicipios_db --eval "
  db.petitions.find({}, {radicado: 1, created_at: 1, _id: 0})
    .sort({created_at: -1})
    .limit(20)
    .forEach(function(p) {
      print(p.radicado + ' | ' + p.created_at);
    });
"

echo ""
echo "📊 4. RADICADOS EN catastro_asomunicipios (si existen):"
echo "----------------------------------------------"
docker exec -it asomunicipios-mongodb mongosh --quiet --eval "
  var petitions = db.getSiblingDB('catastro_asomunicipios').petitions.find({}, {radicado: 1, created_at: 1, _id: 0}).sort({created_at: -1}).limit(20).toArray();
  if (petitions.length === 0) {
    print('(vacío - no hay radicados)');
  } else {
    petitions.forEach(function(p) {
      print(p.radicado + ' | ' + p.created_at);
    });
  }
"

echo ""
echo "📊 5. RANGO DE RADICADOS:"
echo "----------------------------------------------"
docker exec -it asomunicipios-mongodb mongosh --quiet asomunicipios_db --eval "
  var min = db.petitions.find({radicado: /^RASMGC-/}).sort({radicado: 1}).limit(1).toArray()[0];
  var max = db.petitions.find({radicado: /^RASMGC-/}).sort({radicado: -1}).limit(1).toArray()[0];
  print('Mínimo: ' + (min ? min.radicado : 'N/A'));
  print('Máximo: ' + (max ? max.radicado : 'N/A'));
"

echo ""
echo "📊 6. RADICADOS POR FECHA (últimos 7 días):"
echo "----------------------------------------------"
docker exec -it asomunicipios-mongodb mongosh --quiet asomunicipios_db --eval "
  var now = new Date();
  var sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  var result = db.petitions.aggregate([
    { \$match: { created_at: { \$gte: sevenDaysAgo } } },
    { \$group: { 
        _id: { \$dateToString: { format: '%Y-%m-%d', date: '\$created_at' } },
        count: { \$sum: 1 }
    }},
    { \$sort: { _id: -1 } }
  ]).toArray();
  
  if (result.length === 0) {
    print('No hay radicados en los últimos 7 días');
  } else {
    result.forEach(function(r) {
      print(r._id + ': ' + r.count + ' radicados');
    });
  }
"

echo ""
echo "📊 7. BUSCAR HUECOS EN LA SECUENCIA:"
echo "----------------------------------------------"
docker exec -it asomunicipios-mongodb mongosh --quiet asomunicipios_db --eval "
  var radicados = db.petitions.find({radicado: /^RASMGC-/}, {radicado: 1}).toArray();
  var numeros = radicados.map(function(r) {
    var parts = r.radicado.split('-');
    return parseInt(parts[1]);
  }).filter(function(n) { return !isNaN(n); }).sort(function(a, b) { return a - b; });
  
  if (numeros.length < 2) {
    print('No hay suficientes radicados para analizar');
  } else {
    var huecos = [];
    for (var i = 1; i < numeros.length; i++) {
      var diff = numeros[i] - numeros[i-1];
      if (diff > 1) {
        for (var j = numeros[i-1] + 1; j < numeros[i]; j++) {
          huecos.push(j);
        }
      }
    }
    
    if (huecos.length === 0) {
      print('✅ No se encontraron huecos en la secuencia');
    } else {
      print('⚠️ Números faltantes en la secuencia:');
      // Mostrar solo los últimos 50 huecos
      var mostrar = huecos.slice(-50);
      print(mostrar.join(', '));
      if (huecos.length > 50) {
        print('... y ' + (huecos.length - 50) + ' más');
      }
      print('Total huecos: ' + huecos.length);
    }
  }
"

echo ""
echo "📊 8. TODAS LAS BASES DE DATOS:"
echo "----------------------------------------------"
docker exec -it asomunicipios-mongodb mongosh --quiet --eval "
  db.adminCommand('listDatabases').databases.forEach(function(d) {
    print(d.name + ': ' + (d.sizeOnDisk / 1024 / 1024).toFixed(2) + ' MB');
  });
"

echo ""
echo "=============================================="
echo "DIAGNÓSTICO COMPLETADO"
echo "=============================================="
