// ============================================
// Script MongoDB para probar flujo de notificaciones
// Ejecutar con: mongosh asomunicipios_db test_flujo_revision.js
// O copiar y pegar en MongoDB Compass > mongosh
// ============================================

print("=".repeat(60));
print("TEST DE FLUJO: ENVÍO A REVISIÓN Y NOTIFICACIONES");
print("=".repeat(60));
print("");

// Función para generar UUID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// ============================================
// PASO 1: Buscar predio en estado "creado"
// ============================================
print("PASO 1: Buscando predio en estado 'creado'...");

var predio = db.predios_nuevos.findOne({
    estado_flujo: "creado",
    gestor_apoyo_id: { $ne: null }
});

if (!predio) {
    predio = db.predios_nuevos.findOne({ estado_flujo: "creado" });
}

if (!predio) {
    print("❌ No hay predios en estado 'creado'. Debes crear uno primero.");
    quit();
}

print("   ✅ Predio encontrado:");
print("      ID: " + predio.id);
print("      Código: " + predio.codigo_predial_nacional);
print("      Municipio: " + predio.municipio);
print("      Estado: " + predio.estado_flujo);
print("      Gestor Apoyo: " + predio.gestor_apoyo_nombre);
print("");

// ============================================
// PASO 2: Buscar destinatarios
// ============================================
print("PASO 2: Buscando coordinadores y usuarios con permiso de aprobar...");

var destinatarios = [];
var municipioPredio = predio.municipio;

// Buscar coordinadores y administradores
var coordinadores = db.users.find({
    role: { $in: ["coordinador", "administrador"] },
    deleted: { $ne: true }
}).toArray();

coordinadores.forEach(function(coord) {
    var coordMunicipios = coord.municipios || [];
    if (coordMunicipios.length === 0 || coordMunicipios.includes(municipioPredio)) {
        destinatarios.push({
            id: coord.id,
            nombre: coord.full_name,
            email: coord.email,
            rol: coord.role,
            razon: "Coordinador/Admin"
        });
        print("      ✅ " + coord.full_name + " (" + coord.email + ") - " + coord.role);
    }
});

// Buscar usuarios con permiso aprobar_cambios
var permisos = db.user_permissions.find({
    "permissions.aprobar_cambios": true
}).toArray();

permisos.forEach(function(perm) {
    var yaExiste = destinatarios.some(function(d) { return d.id === perm.user_id; });
    if (!yaExiste) {
        var usuario = db.users.findOne({ id: perm.user_id, deleted: { $ne: true } });
        if (usuario) {
            var userMunicipios = usuario.municipios || [];
            if (userMunicipios.length === 0 || userMunicipios.includes(municipioPredio)) {
                destinatarios.push({
                    id: usuario.id,
                    nombre: usuario.full_name,
                    email: usuario.email,
                    rol: usuario.role,
                    razon: "Permiso aprobar"
                });
                print("      ✅ " + usuario.full_name + " - permiso aprobar_cambios");
            }
        }
    }
});

print("");
print("   Total destinatarios: " + destinatarios.length);
print("");

// ============================================
// PASO 3: Actualizar predio a "revision"
// ============================================
print("PASO 3: Actualizando predio a estado 'revision'...");

var historialEntry = {
    fecha: new Date().toISOString(),
    accion: "enviar_revision",
    estado_anterior: predio.estado_flujo,
    estado_nuevo: "revision",
    usuario_id: "SCRIPT_TEST",
    usuario_nombre: "Script MongoDB",
    observaciones: "Prueba automática de notificaciones"
};

var updateResult = db.predios_nuevos.updateOne(
    { id: predio.id },
    {
        $set: {
            estado_flujo: "revision",
            updated_at: new Date().toISOString()
        },
        $push: { historial_flujo: historialEntry }
    }
);

if (updateResult.modifiedCount > 0) {
    print("   ✅ Predio actualizado a 'revision'");
} else {
    print("   ⚠️ No se pudo actualizar");
}
print("");

// ============================================
// PASO 4: Crear notificaciones
// ============================================
print("PASO 4: Creando notificaciones...");

var mensaje = "El predio " + predio.codigo_predial_nacional + " ha sido enviado para revisión";
var notifCreadas = 0;

destinatarios.forEach(function(dest) {
    var notif = {
        id: generateUUID(),
        user_id: dest.id,
        tipo: "predio_enviar_revision",
        titulo: mensaje,
        mensaje: "Prueba - " + dest.razon,
        predio_id: predio.id,
        codigo_predial: predio.codigo_predial_nacional,
        leida: false,
        created_at: new Date().toISOString()
    };
    db.notifications.insertOne(notif);
    notifCreadas++;
    print("   ✅ Notificación para: " + dest.nombre + " (" + dest.email + ")");
});

print("");
print("   Total notificaciones creadas: " + notifCreadas);
print("");

// ============================================
// PASO 5: Verificar
// ============================================
print("PASO 5: Verificando...");

var predioFinal = db.predios_nuevos.findOne({ id: predio.id });
var notifsVerificar = db.notifications.find({
    predio_id: predio.id,
    tipo: "predio_enviar_revision"
}).toArray();

print("   Estado predio: " + predioFinal.estado_flujo);
print("   Notificaciones en BD: " + notifsVerificar.length);
print("");

print("=".repeat(60));
print("RESUMEN");
print("=".repeat(60));
print("   Predio: " + predio.codigo_predial_nacional);
print("   Estado final: " + predioFinal.estado_flujo);
print("   Notificaciones: " + notifCreadas);
print("");

if (notifCreadas > 0 && predioFinal.estado_flujo === "revision") {
    print("✅ ¡PRUEBA EXITOSA!");
    print("   Los coordinadores deberían ver el predio en 'Predios Nuevos > En Revisión'");
} else {
    print("❌ PRUEBA FALLIDA");
}

print("");
print("=".repeat(60));
