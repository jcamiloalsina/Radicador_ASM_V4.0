#!/bin/bash
# Script para identificar diferencias entre radicados en BD vs mostrados
# Ejecutar: ./verificar_radicados.sh

echo "=============================================="
echo "VERIFICACIÓN COMPLETA DE RADICADOS"
echo "=============================================="

echo ""
echo "📊 1. TOTAL DE RADICADOS EN BASE DE DATOS:"
echo "----------------------------------------------"
docker exec -it asomunicipios-mongodb mongosh --quiet asomunicipios_db --eval "
  var total = db.petitions.countDocuments({});
  print('Total petitions en BD: ' + total);
"

echo ""
echo "📊 2. RADICADOS POR ESTADO:"
echo "----------------------------------------------"
docker exec -it asomunicipios-mongodb mongosh --quiet asomunicipios_db --eval "
  var estados = db.petitions.aggregate([
    { \$group: { _id: '\$estado', count: { \$sum: 1 } } },
    { \$sort: { count: -1 } }
  ]).toArray();
  
  estados.forEach(function(e) {
    print((e._id || 'SIN ESTADO') + ': ' + e.count);
  });
"

echo ""
echo "📊 3. RADICADOS POR TIPO DE TRÁMITE:"
echo "----------------------------------------------"
docker exec -it asomunicipios-mongodb mongosh --quiet asomunicipios_db --eval "
  var tipos = db.petitions.aggregate([
    { \$group: { _id: '\$tipo_tramite', count: { \$sum: 1 } } },
    { \$sort: { count: -1 } }
  ]).toArray();
  
  tipos.forEach(function(t) {
    print((t._id || 'SIN TIPO') + ': ' + t.count);
  });
"

echo ""
echo "📊 4. RADICADOS CON CAMPO 'activo' = false O 'eliminado' = true:"
echo "----------------------------------------------"
docker exec -it asomunicipios-mongodb mongosh --quiet asomunicipios_db --eval "
  var inactivos = db.petitions.countDocuments({ activo: false });
  var eliminados = db.petitions.countDocuments({ eliminado: true });
  var ocultos = db.petitions.countDocuments({ oculto: true });
  var archivados = db.petitions.countDocuments({ archivado: true });
  
  print('activo=false: ' + inactivos);
  print('eliminado=true: ' + eliminados);
  print('oculto=true: ' + ocultos);
  print('archivado=true: ' + archivados);
"

echo ""
echo "📊 5. RADICADOS POR MUNICIPIO:"
echo "----------------------------------------------"
docker exec -it asomunicipios-mongodb mongosh --quiet asomunicipios_db --eval "
  var municipios = db.petitions.aggregate([
    { \$group: { _id: '\$municipio', count: { \$sum: 1 } } },
    { \$sort: { count: -1 } }
  ]).toArray();
  
  municipios.forEach(function(m) {
    print((m._id || 'SIN MUNICIPIO') + ': ' + m.count);
  });
"

echo ""
echo "📊 6. VERIFICAR RADICADOS DUPLICADOS:"
echo "----------------------------------------------"
docker exec -it asomunicipios-mongodb mongosh --quiet asomunicipios_db --eval "
  var duplicados = db.petitions.aggregate([
    { \$group: { _id: '\$radicado', count: { \$sum: 1 } } },
    { \$match: { count: { \$gt: 1 } } },
    { \$sort: { count: -1 } }
  ]).toArray();
  
  if (duplicados.length === 0) {
    print('✅ No hay radicados duplicados');
  } else {
    print('⚠️ Radicados duplicados encontrados:');
    duplicados.forEach(function(d) {
      print('  ' + d._id + ': ' + d.count + ' veces');
    });
  }
"

echo ""
echo "📊 7. RADICADOS CON CAMPOS NULOS O VACÍOS:"
echo "----------------------------------------------"
docker exec -it asomunicipios-mongodb mongosh --quiet asomunicipios_db --eval "
  var sinRadicado = db.petitions.countDocuments({ radicado: { \$in: [null, ''] } });
  var sinMunicipio = db.petitions.countDocuments({ municipio: { \$in: [null, ''] } });
  var sinTipo = db.petitions.countDocuments({ tipo_tramite: { \$in: [null, ''] } });
  var sinFecha = db.petitions.countDocuments({ created_at: null });
  
  print('Sin radicado: ' + sinRadicado);
  print('Sin municipio: ' + sinMunicipio);
  print('Sin tipo_tramite: ' + sinTipo);
  print('Sin created_at: ' + sinFecha);
"

echo ""
echo "📊 8. LISTA COMPLETA DE RADICADOS (exportar a archivo):"
echo "----------------------------------------------"
docker exec -it asomunicipios-mongodb mongosh --quiet asomunicipios_db --eval "
  var radicados = db.petitions.find({}, {
    radicado: 1, 
    municipio: 1, 
    tipo_tramite: 1, 
    estado: 1,
    created_at: 1,
    activo: 1,
    eliminado: 1,
    _id: 0
  }).sort({created_at: -1}).toArray();
  
  print('Exportando ' + radicados.length + ' radicados...');
  printjson(radicados);
" > /tmp/lista_radicados.json

echo "Lista exportada a: /tmp/lista_radicados.json"

echo ""
echo "📊 9. RESUMEN DE CONTEOS:"
echo "----------------------------------------------"
docker exec -it asomunicipios-mongodb mongosh --quiet asomunicipios_db --eval "
  var total = db.petitions.countDocuments({});
  var activos = db.petitions.countDocuments({ \$or: [{ activo: { \$ne: false } }, { activo: { \$exists: false } }] });
  var noEliminados = db.petitions.countDocuments({ \$or: [{ eliminado: { \$ne: true } }, { eliminado: { \$exists: false } }] });
  var visibles = db.petitions.countDocuments({
    \$and: [
      { \$or: [{ activo: { \$ne: false } }, { activo: { \$exists: false } }] },
      { \$or: [{ eliminado: { \$ne: true } }, { eliminado: { \$exists: false } }] },
      { \$or: [{ oculto: { \$ne: true } }, { oculto: { \$exists: false } }] }
    ]
  });
  
  print('Total en BD: ' + total);
  print('Activos (activo != false): ' + activos);
  print('No eliminados (eliminado != true): ' + noEliminados);
  print('Visibles (sin filtros negativos): ' + visibles);
  print('');
  print('Diferencia (posibles ocultos): ' + (total - visibles));
"

echo ""
echo "📊 10. RADICADOS CREADOS HOY:"
echo "----------------------------------------------"
docker exec -it asomunicipios-mongodb mongosh --quiet asomunicipios_db --eval "
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  
  var radicadosHoy = db.petitions.find({
    created_at: { \$gte: today }
  }, { radicado: 1, created_at: 1, municipio: 1, _id: 0 }).sort({ created_at: -1 }).toArray();
  
  print('Radicados creados hoy: ' + radicadosHoy.length);
  radicadosHoy.forEach(function(r) {
    print('  ' + r.radicado + ' | ' + r.municipio + ' | ' + r.created_at);
  });
"

echo ""
echo "📊 11. COMPARAR CON LO QUE MUESTRA LA API:"
echo "----------------------------------------------"
echo "Para comparar con la API, ejecute:"
echo "  curl -s http://localhost:8001/api/petitions | python3 -c \"import sys,json; d=json.load(sys.stdin); print('API retorna:', len(d) if isinstance(d, list) else d.get('total', 'N/A'))\""

echo ""
echo "=============================================="
echo "VERIFICACIÓN COMPLETADA"
echo "=============================================="
echo ""
echo "Si el total en BD es mayor que lo que ve en la interfaz,"
echo "revise los campos: estado, activo, eliminado, oculto"
echo "=============================================="
