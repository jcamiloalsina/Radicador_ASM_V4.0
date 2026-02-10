import React, { memo } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Plus, Trash2 } from 'lucide-react';

/**
 * Componente para lista editable de propietarios (formato XTF)
 * 
 * @param {Array} propietarios - Lista de propietarios
 * @param {Function} agregarPropietario - Función para agregar propietario
 * @param {Function} eliminarPropietario - Función para eliminar propietario
 * @param {Function} actualizarPropietario - Función para actualizar propietario
 * @param {Function} formatearNumeroDocumento - Función para formatear número documento
 * @param {Function} generarNombreCompleto - Función para generar nombre completo
 * @param {Object} catalogos - Catálogos (tipo_documento, etc.)
 */
const PropietariosList = memo(({
  propietarios,
  agregarPropietario,
  eliminarPropietario,
  actualizarPropietario,
  formatearNumeroDocumento,
  generarNombreCompleto,
  catalogos
}) => {
  return (
    <div className="space-y-4" data-testid="propietarios-list">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h4 className="font-semibold text-slate-800">Propietarios</h4>
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          onClick={agregarPropietario} 
          className="text-emerald-700"
          data-testid="agregar-propietario-btn"
        >
          <Plus className="w-4 h-4 mr-1" /> Agregar Propietario
        </Button>
      </div>
      
      {/* Lista de propietarios */}
      {propietarios.map((prop, index) => (
        <div 
          key={index} 
          className="border border-slate-200 rounded-lg p-4 bg-slate-50"
          data-testid={`propietario-${index}`}
        >
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-medium text-slate-700">Propietario {index + 1}</span>
            {propietarios.length > 1 && (
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                onClick={() => eliminarPropietario(index)} 
                className="text-red-600 hover:text-red-700"
                data-testid={`eliminar-propietario-${index}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {/* Nombres según formato XTF */}
            <div>
              <Label className="text-xs">Primer Apellido *</Label>
              <Input 
                value={prop.primer_apellido || ''} 
                onChange={(e) => actualizarPropietario(index, 'primer_apellido', e.target.value.toUpperCase())}
                placeholder="PÉREZ"
              />
            </div>
            <div>
              <Label className="text-xs">Segundo Apellido</Label>
              <Input 
                value={prop.segundo_apellido || ''} 
                onChange={(e) => actualizarPropietario(index, 'segundo_apellido', e.target.value.toUpperCase())}
                placeholder="GARCÍA"
              />
            </div>
            <div>
              <Label className="text-xs">Primer Nombre *</Label>
              <Input 
                value={prop.primer_nombre || ''} 
                onChange={(e) => actualizarPropietario(index, 'primer_nombre', e.target.value.toUpperCase())}
                placeholder="JUAN"
              />
            </div>
            <div>
              <Label className="text-xs">Segundo Nombre</Label>
              <Input 
                value={prop.segundo_nombre || ''} 
                onChange={(e) => actualizarPropietario(index, 'segundo_nombre', e.target.value.toUpperCase())}
                placeholder="CARLOS"
              />
            </div>
            
            {/* Estado (campo libre) */}
            <div className="col-span-2">
              <Label className="text-xs">Estado</Label>
              <Input 
                value={prop.estado || ''} 
                onChange={(e) => actualizarPropietario(index, 'estado', e.target.value.toUpperCase())}
                placeholder="Ej: CASADO, SOLTERO, VIUDO, E (Estado), etc."
              />
            </div>
            
            {/* Tipo y Número de Documento */}
            <div>
              <Label className="text-xs mb-2 block">Tipo Documento *</Label>
              <RadioGroup 
                value={prop.tipo_documento} 
                onValueChange={(v) => actualizarPropietario(index, 'tipo_documento', v)}
                className="flex flex-wrap gap-3"
              >
                {catalogos?.tipo_documento && Object.entries(catalogos.tipo_documento).map(([k, v]) => (
                  <div key={k} className="flex items-center space-x-1">
                    <RadioGroupItem value={k} id={`tipo_doc_${index}_${k}`} />
                    <Label htmlFor={`tipo_doc_${index}_${k}`} className="text-xs cursor-pointer">{k}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <div>
              <Label className="text-xs">Número Documento * (máx 12 dígitos)</Label>
              <Input 
                value={prop.numero_documento || ''} 
                onChange={(e) => {
                  // Solo permitir números y máximo 12 dígitos
                  const valor = e.target.value.replace(/\D/g, '').slice(0, 12);
                  actualizarPropietario(index, 'numero_documento', valor);
                }}
                placeholder="Se rellenará con 0s (ej: 001091672736)"
              />
              {prop.numero_documento && (
                <p className="text-xs text-slate-500 mt-1">
                  Formato final: {formatearNumeroDocumento(prop.numero_documento)}
                </p>
              )}
            </div>
            
            {/* Preview del nombre completo */}
            {(prop.primer_apellido || prop.primer_nombre) && (
              <div className="col-span-2 bg-emerald-50 p-2 rounded border border-emerald-200">
                <p className="text-xs text-emerald-700">
                  <strong>Nombre completo:</strong> {generarNombreCompleto(prop) || 'Complete los campos'}
                </p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
});

PropietariosList.displayName = 'PropietariosList';

export default PropietariosList;
