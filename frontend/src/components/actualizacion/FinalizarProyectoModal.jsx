import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { 
  CheckCircle, XCircle, AlertTriangle, Loader2, 
  FileCheck, MapPin, Users, Building2, ArrowRight 
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const FinalizarProyectoModal = ({ 
  isOpen, 
  onClose, 
  proyectoId, 
  proyectoNombre,
  token,
  onSuccess 
}) => {
  const [loading, setLoading] = useState(false);
  const [loadingResumen, setLoadingResumen] = useState(false);
  const [resumen, setResumen] = useState(null);
  const [forzar, setForzar] = useState(false);
  
  // Cargar resumen al abrir
  useEffect(() => {
    const cargarResumen = async () => {
      if (!isOpen || !proyectoId) return;
      
      setLoadingResumen(true);
      try {
        const response = await fetch(
          `${API_URL}/api/actualizacion/proyectos/${proyectoId}/resumen-finalizacion`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );
        
        if (!response.ok) {
          throw new Error('Error al cargar resumen');
        }
        
        const data = await response.json();
        setResumen(data);
      } catch (error) {
        console.error('Error:', error);
        toast.error('Error al cargar resumen del proyecto');
      } finally {
        setLoadingResumen(false);
      }
    };
    
    cargarResumen();
  }, [isOpen, proyectoId, token]);
  
  // Finalizar proyecto
  const handleFinalizar = async () => {
    if (!resumen?.validaciones?.puede_finalizar && !forzar) {
      toast.error('No se puede finalizar el proyecto. Resuelva los pendientes o marque la opción de forzar.');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/actualizacion/proyectos/${proyectoId}/finalizar`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ forzar })
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Error al finalizar proyecto');
      }
      
      toast.success(
        <div>
          <p className="font-semibold">Proyecto finalizado exitosamente</p>
          <p className="text-sm">Predios nuevos creados: {data.resultados?.predios_nuevos_creados || 0}</p>
          <p className="text-sm">Cambios aplicados: {data.resultados?.cambios_aplicados || 0}</p>
        </div>
      );
      
      onSuccess && onSuccess(data);
      onClose();
      
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al finalizar proyecto');
    } finally {
      setLoading(false);
    }
  };
  
  const ValidationItem = ({ ok, label, count }) => (
    <div className={`flex items-center gap-2 p-2 rounded ${ok ? 'bg-emerald-50' : 'bg-red-50'}`}>
      {ok ? (
        <CheckCircle className="w-4 h-4 text-emerald-600" />
      ) : (
        <XCircle className="w-4 h-4 text-red-600" />
      )}
      <span className={ok ? 'text-emerald-700' : 'text-red-700'}>
        {label}
        {count !== undefined && !ok && <span className="font-bold ml-1">({count})</span>}
      </span>
    </div>
  );
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileCheck className="w-5 h-5 text-emerald-600" />
            Finalizar Proyecto
          </DialogTitle>
        </DialogHeader>
        
        {loadingResumen ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <span className="ml-3 text-slate-600">Cargando resumen...</span>
          </div>
        ) : resumen ? (
          <div className="space-y-6">
            {/* Info del proyecto */}
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-semibold text-slate-700">{proyectoNombre}</h4>
              <p className="text-sm text-slate-500">Municipio: {resumen.proyecto?.municipio}</p>
            </div>
            
            {/* Resumen de predios */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-blue-800">Predios</span>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="flex justify-between">
                    <span className="text-slate-600">Total:</span>
                    <span className="font-bold">{resumen.resumen?.total_predios}</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-slate-600">Nuevos:</span>
                    <span className="font-bold text-emerald-600">{resumen.resumen?.predios_nuevos}</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-slate-600">Existentes:</span>
                    <span className="font-bold">{resumen.resumen?.predios_existentes}</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-slate-600">Visitados:</span>
                    <span className="font-bold text-emerald-600">{resumen.resumen?.predios_visitados}</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-slate-600">Pendientes:</span>
                    <span className={`font-bold ${resumen.resumen?.predios_pendientes > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {resumen.resumen?.predios_pendientes}
                    </span>
                  </p>
                </div>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-purple-600" />
                  <span className="font-semibold text-purple-800">Propuestas</span>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="flex justify-between">
                    <span className="text-slate-600">Total:</span>
                    <span className="font-bold">{resumen.propuestas?.total}</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-slate-600">Aprobadas:</span>
                    <span className="font-bold text-emerald-600">{resumen.propuestas?.aprobadas}</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-slate-600">Pendientes:</span>
                    <span className={`font-bold ${resumen.propuestas?.pendientes > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {resumen.propuestas?.pendientes}
                    </span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-slate-600">Subsanación:</span>
                    <span className={`font-bold ${resumen.propuestas?.subsanacion > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {resumen.propuestas?.subsanacion}
                    </span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-slate-600">Rechazadas:</span>
                    <span className="font-bold text-slate-500">{resumen.propuestas?.rechazadas}</span>
                  </p>
                </div>
              </div>
            </div>
            
            {/* Validaciones */}
            <div className="space-y-2">
              <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Validaciones
              </h4>
              <div className="space-y-2">
                <ValidationItem 
                  ok={resumen.validaciones?.predios_pendientes}
                  label="Todos los predios visitados"
                  count={resumen.resumen?.predios_pendientes}
                />
                <ValidationItem 
                  ok={resumen.validaciones?.propuestas_pendientes}
                  label="Todas las propuestas revisadas"
                  count={resumen.propuestas?.pendientes}
                />
                <ValidationItem 
                  ok={resumen.validaciones?.propuestas_subsanacion}
                  label="Sin propuestas en subsanación"
                  count={resumen.propuestas?.subsanacion}
                />
              </div>
            </div>
            
            {/* Lo que se migrará */}
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg">
              <h4 className="font-semibold text-emerald-800 mb-3 flex items-center gap-2">
                <ArrowRight className="w-4 h-4" />
                Al finalizar se migrarán a Conservación:
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  <span>
                    <strong>{resumen.migracion?.predios_nuevos_a_crear}</strong> predios nuevos
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-emerald-600" />
                  <span>
                    <strong>{resumen.migracion?.cambios_a_aplicar}</strong> cambios aprobados
                  </span>
                </div>
              </div>
            </div>
            
            {/* Opción de forzar si hay pendientes */}
            {!resumen.validaciones?.puede_finalizar && (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <Checkbox 
                    id="forzar"
                    checked={forzar}
                    onCheckedChange={setForzar}
                  />
                  <div>
                    <label htmlFor="forzar" className="font-medium text-amber-800 cursor-pointer">
                      Forzar finalización
                    </label>
                    <p className="text-sm text-amber-700 mt-1">
                      Los predios pendientes de visitar y las propuestas sin revisar NO serán migrados a conservación.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-red-500">
            Error al cargar información del proyecto
          </div>
        )}
        
        <DialogFooter className="mt-4 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleFinalizar}
            disabled={loading || loadingResumen || (!resumen?.validaciones?.puede_finalizar && !forzar)}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Finalizando...
              </>
            ) : (
              <>
                <FileCheck className="w-4 h-4 mr-2" />
                Finalizar y Migrar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FinalizarProyectoModal;
