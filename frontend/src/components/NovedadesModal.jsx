import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Sparkles, CheckCircle, Bug, Wrench, Star } from 'lucide-react';

// ============================================================
// CHANGELOG - Actualizar este array con cada nueva versión
// ============================================================
const CHANGELOG = [
  {
    version: "2.5.0",
    fecha: "16 de Febrero 2026",
    cambios: [
      { tipo: "fix", texto: "Corrección de firmas obligatorias en formulario de visita" },
      { tipo: "fix", texto: "Corrección de creación de predios con permiso de aprobación" },
      { tipo: "fix", texto: "Unificación de colecciones para predios pendientes" },
      { tipo: "mejora", texto: "Protección contra doble clic en todos los botones de acción" },
      { tipo: "mejora", texto: "Toast de notificaciones ahora aparece encima de los modales" },
      { tipo: "mejora", texto: "Diseño responsivo mejorado para pantallas pequeñas" },
      { tipo: "mejora", texto: "Formulario de visita ahora guarda TODOS los campos" },
      { tipo: "mejora", texto: "Carga de datos existentes al abrir visita de predio ya visitado" },
      { tipo: "fix", texto: "Corrección de matrícula inmobiliaria que no aparecía" },
      { tipo: "nuevo", texto: "Sistema de novedades al iniciar sesión" }
    ]
  },
  {
    version: "2.4.0",
    fecha: "15 de Febrero 2026",
    cambios: [
      { tipo: "fix", texto: "Corrección de duplicación de datos en modo offline" },
      { tipo: "fix", texto: "Corrección de sincronización offline-online" },
      { tipo: "mejora", texto: "Mejora en carga de construcciones y mejoras offline" }
    ]
  }
];

// Versión actual del sistema
const VERSION_ACTUAL = CHANGELOG[0].version;

// Iconos por tipo de cambio
const tipoConfig = {
  nuevo: { icon: Star, color: 'text-amber-500', bg: 'bg-amber-50', label: 'Nuevo' },
  mejora: { icon: Sparkles, color: 'text-blue-500', bg: 'bg-blue-50', label: 'Mejora' },
  fix: { icon: Bug, color: 'text-red-500', bg: 'bg-red-50', label: 'Corrección' },
  cambio: { icon: Wrench, color: 'text-slate-500', bg: 'bg-slate-50', label: 'Cambio' }
};

// Roles que pueden ver las novedades
const ROLES_PERMITIDOS = ['coordinador', 'administrador'];

export default function NovedadesModal({ userId, userRole }) {
  const [open, setOpen] = useState(false);
  const [versionesNuevas, setVersionesNuevas] = useState([]);

  useEffect(() => {
    if (!userId || !userRole) return;
    
    // Solo mostrar para roles permitidos (Coordinador y Administrador)
    if (!ROLES_PERMITIDOS.includes(userRole)) return;
    
    // Obtener la última versión vista por este usuario
    const ultimaVersionVista = localStorage.getItem(`novedades_version_${userId}`);
    
    // Si nunca ha visto novedades o hay una versión nueva
    if (!ultimaVersionVista || ultimaVersionVista !== VERSION_ACTUAL) {
      // Encontrar todas las versiones nuevas desde la última vista
      const indexUltimaVista = ultimaVersionVista 
        ? CHANGELOG.findIndex(c => c.version === ultimaVersionVista)
        : CHANGELOG.length;
      
      const nuevas = indexUltimaVista === -1 
        ? [CHANGELOG[0]] // Si no se encuentra, mostrar solo la última
        : CHANGELOG.slice(0, indexUltimaVista === 0 ? 1 : indexUltimaVista);
      
      if (nuevas.length > 0) {
        setVersionesNuevas(nuevas);
        // Pequeño delay para que el login se complete primero
        setTimeout(() => setOpen(true), 500);
      }
    }
  }, [userId, userRole]);

  const handleClose = () => {
    // Guardar que el usuario ya vio esta versión
    localStorage.setItem(`novedades_version_${userId}`, VERSION_ACTUAL);
    setOpen(false);
  };

  if (versionesNuevas.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="w-6 h-6 text-amber-500" />
            Novedades del Sistema
          </DialogTitle>
        </DialogHeader>
        
        <div className="overflow-y-auto flex-1 py-4 space-y-6">
          {versionesNuevas.map((version, idx) => (
            <div key={version.version} className={idx > 0 ? "border-t pt-4" : ""}>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  v{version.version}
                </Badge>
                <span className="text-sm text-slate-500">{version.fecha}</span>
              </div>
              
              <ul className="space-y-2">
                {version.cambios.map((cambio, i) => {
                  const config = tipoConfig[cambio.tipo] || tipoConfig.cambio;
                  const Icon = config.icon;
                  
                  return (
                    <li key={i} className={`flex items-start gap-2 p-2 rounded-lg ${config.bg}`}>
                      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.color}`} />
                      <span className="text-sm text-slate-700">{cambio.texto}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        
        <div className="border-t pt-4 flex justify-end">
          <Button onClick={handleClose} className="bg-emerald-600 hover:bg-emerald-700">
            <CheckCircle className="w-4 h-4 mr-2" />
            Entendido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Exportar la versión actual para uso en otros componentes si es necesario
export { VERSION_ACTUAL, CHANGELOG };
