/**
 * Página 1 del Formulario de Visita
 * Secciones: Datos de visita, Información básica, PH, Condominio
 * 
 * OPTIMIZACIÓN DE RENDIMIENTO:
 * - React.memo() evita re-renders innecesarios del componente
 * - DebouncedInput mantiene estado local y actualiza el padre después de 150ms de inactividad
 * - useCallback() memoiza handlers para evitar recreación en cada render
 */
import React, { memo, useCallback } from 'react';
import { Clock, Building, Home } from 'lucide-react';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import DebouncedInput from '../../DebouncedInput';

const VisitaPagina1 = memo(({ 
  visitaData, 
  setVisitaData, 
  selectedPredio, 
  proyecto, 
  tipoVisita,
  mejoraSeleccionada,
  predioMejoraSeleccionada
}) => {
  // Handlers memoizados
  const handleFieldChange = useCallback((field, value) => {
    setVisitaData(prev => ({ ...prev, [field]: value }));
  }, [setVisitaData]);

  return (
    <>
      {/* DATOS DE LA VISITA */}
      <div className="border-2 border-blue-300 rounded-lg overflow-hidden bg-blue-50/50">
        <div className="bg-blue-100 px-4 py-2 border-b border-blue-300">
          <h3 className="font-semibold text-blue-800 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            1. DATOS DE LA VISITA
          </h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-slate-500">Fecha de Visita *</Label>
              <Input 
                type="date" 
                value={visitaData.fecha_visita} 
                onChange={(e) => handleFieldChange('fecha_visita', e.target.value)} 
                className="bg-white" 
              />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Hora *</Label>
              <Input 
                type="time" 
                value={visitaData.hora_visita} 
                onChange={(e) => handleFieldChange('hora_visita', e.target.value)} 
                className="bg-white" 
              />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Persona que Atiende *</Label>
              <DebouncedInput 
                value={visitaData.persona_atiende} 
                onChange={(val) => handleFieldChange('persona_atiende', val)} 
                placeholder="NOMBRE COMPLETO" 
                uppercase={true}
                className="uppercase bg-white" 
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Relación con el Predio</Label>
              <div className="flex flex-wrap gap-3">
                {[{v:'propietario',l:'Propietario'},{v:'poseedor',l:'Poseedor'},{v:'arrendatario',l:'Arrendatario'},{v:'familiar',l:'Familiar'},{v:'encargado',l:'Encargado'},{v:'otro',l:'Otro'}].map(i => (
                  <label key={i.v} className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input 
                      type="radio" 
                      name="relacion_p1" 
                      checked={visitaData.relacion_predio === i.v} 
                      onChange={() => handleFieldChange('relacion_predio', i.v)} 
                      className="text-blue-600" 
                    />
                    {i.l}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">¿Se pudo acceder al predio?</Label>
              <div className="flex gap-4">
                {[{v:'si',l:'Sí'},{v:'parcial',l:'Parcial'},{v:'no',l:'No'}].map(i => (
                  <label key={i.v} className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input 
                      type="radio" 
                      name="acceso_p1" 
                      checked={visitaData.acceso_predio === i.v} 
                      onChange={() => handleFieldChange('acceso_predio', i.v)} 
                      className="text-blue-600" 
                    />
                    {i.l}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sección 2: Información Básica */}
      <div className="border border-emerald-200 rounded-lg overflow-hidden">
        <div className="bg-emerald-50 px-4 py-2 border-b border-emerald-200">
          <h3 className="font-semibold text-emerald-800 flex items-center gap-2">
            <Building className="w-4 h-4" />
            2. INFORMACIÓN BÁSICA DEL {tipoVisita === 'mejora' ? 'MEJORA' : 'PREDIO'}
            {tipoVisita === 'mejora' && (
              <Badge className="bg-cyan-500 text-white text-xs ml-2">MEJORA</Badge>
            )}
          </h3>
        </div>
        <div className="p-4 space-y-4">
          {tipoVisita === 'mejora' && (
            <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-cyan-700 font-medium mb-1">Terreno Base:</p>
              <p className="font-mono text-xs text-cyan-800">{selectedPredio?.codigo_predial || selectedPredio?.numero_predial || 'N/A'}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-slate-500">Departamento</Label>
              <Input value="Norte de Santander" disabled className="bg-slate-100 font-medium" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Municipio</Label>
              <Input value={proyecto?.municipio || (tipoVisita === 'mejora' ? predioMejoraSeleccionada?.municipio : selectedPredio?.municipio) || ''} disabled className="bg-slate-100 font-medium" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-slate-500">
              Número Predial (30 dígitos) {tipoVisita === 'mejora' && <span className="text-cyan-600 font-medium">- CÓDIGO DE LA MEJORA</span>}
            </Label>
            <Input 
              value={tipoVisita === 'mejora' 
                ? (mejoraSeleccionada?.properties?.codigo || predioMejoraSeleccionada?.codigo_predial || '') 
                : (selectedPredio?.codigo_predial || selectedPredio?.numero_predial || '')} 
              disabled 
              className={`bg-slate-100 font-mono font-bold tracking-wider ${tipoVisita === 'mejora' ? 'text-cyan-800 border-cyan-300' : 'text-emerald-800'}`} 
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-slate-500">Código Homologado</Label>
              <Input value={(tipoVisita === 'mejora' ? predioMejoraSeleccionada?.codigo_homologado : selectedPredio?.codigo_homologado) || 'Sin código'} disabled className="bg-slate-100 font-mono" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Tipo <span className="text-emerald-600">(verificar)</span></Label>
              <div className="flex items-center gap-4 h-10">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="tipo_predio" checked={visitaData.tipo_predio === 'PH'} onChange={() => handleFieldChange('tipo_predio', 'PH')} className="text-emerald-600" />
                  <span className="text-sm">PH</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="tipo_predio" checked={visitaData.tipo_predio === 'NPH'} onChange={() => handleFieldChange('tipo_predio', 'NPH')} className="text-emerald-600" />
                  <span className="text-sm">NPH</span>
                </label>
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-500">Ubicación</Label>
              <div className="flex items-center gap-4 h-10">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={selectedPredio?.zona === 'urbano' || (selectedPredio?.codigo_predial && selectedPredio.codigo_predial.substring(5, 7) === '01')} disabled className="text-emerald-600" />
                  <span className="text-sm">Urbano</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={selectedPredio?.zona === 'rural' || (selectedPredio?.codigo_predial && selectedPredio.codigo_predial.substring(5, 7) === '00')} disabled className="text-emerald-600" />
                  <span className="text-sm">Rural</span>
                </label>
              </div>
            </div>
          </div>
          <div>
            <Label className="text-xs text-slate-500">Dirección <span className="text-emerald-600">(verificar)</span></Label>
            <DebouncedInput 
              value={visitaData.direccion_visita} 
              onChange={(val) => handleFieldChange('direccion_visita', val)} 
              placeholder="Dirección" 
              uppercase={true}
              className="uppercase" 
            />
          </div>
          <div>
            <Label className="text-xs text-slate-500 mb-2 block">Destino Económico <span className="text-emerald-600">(verificar)</span></Label>
            <div className="grid grid-cols-4 gap-2">
              {[{v:'A',l:'A - Habitacional'},{v:'B',l:'B - Industrial'},{v:'C',l:'C - Comercial'},{v:'D',l:'D - Agropecuario'},{v:'E',l:'E - Minero'},{v:'F',l:'F - Cultural'},{v:'G',l:'G - Recreacional'},{v:'H',l:'H - Salubridad'},{v:'I',l:'I - Institucional'},{v:'J',l:'J - Educativo'},{v:'K',l:'K - Religioso'},{v:'L',l:'L - Agrícola'},{v:'M',l:'M - Pecuario'},{v:'N',l:'N - Agroindustrial'},{v:'O',l:'O - Forestal'},{v:'P',l:'P - Uso Público'},{v:'Q',l:'Q - Lote Urbanizable No Urbanizado'},{v:'R',l:'R - Lote Urbanizado No Edificado'},{v:'S',l:'S - Lote No Urbanizable'},{v:'T',l:'T - Servicios Especiales'}].map(i => (
                <label key={i.v} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="destino" checked={visitaData.destino_economico_visita === i.v} onChange={() => handleFieldChange('destino_economico_visita', i.v)} className="text-emerald-600" />
                  <span className="text-xs">{i.l}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-slate-500">Área Terreno (m²)</Label>
              <Input type="number" step="0.01" value={visitaData.area_terreno_visita} onChange={(e) => handleFieldChange('area_terreno_visita', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Área Construida (m²)</Label>
              <Input type="number" step="0.01" value={visitaData.area_construida_visita} onChange={(e) => handleFieldChange('area_construida_visita', e.target.value)} placeholder="0.00" />
            </div>
          </div>
        </div>
      </div>

      {/* Sección 3: PH */}
      {visitaData.tipo_predio === 'PH' && (
        <div className="border border-purple-200 rounded-lg overflow-hidden">
          <div className="bg-purple-50 px-4 py-2 border-b border-purple-200">
            <h3 className="font-semibold text-purple-800 flex items-center gap-2">
              <Building className="w-4 h-4" />
              3. PH (Propiedad Horizontal)
            </h3>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-slate-500">Área por Coeficiente</Label>
                <Input type="number" step="0.01" value={visitaData.ph_area_coeficiente} onChange={(e) => handleFieldChange('ph_area_coeficiente', e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Área Construida Privada</Label>
                <Input type="number" step="0.01" value={visitaData.ph_area_construida_privada} onChange={(e) => handleFieldChange('ph_area_construida_privada', e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Área Construida Común</Label>
                <Input type="number" step="0.01" value={visitaData.ph_area_construida_comun} onChange={(e) => handleFieldChange('ph_area_construida_comun', e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-slate-500">Copropiedad</Label>
                <Input value={visitaData.ph_copropiedad} onChange={(e) => handleFieldChange('ph_copropiedad', e.target.value.toUpperCase())} className="uppercase" />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Predio Asociado</Label>
                <Input value={visitaData.ph_predio_asociado} onChange={(e) => handleFieldChange('ph_predio_asociado', e.target.value)} className="font-mono" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-slate-500">Torre</Label>
                <Input value={visitaData.ph_torre} onChange={(e) => handleFieldChange('ph_torre', e.target.value.toUpperCase())} />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Apartamento</Label>
                <Input value={visitaData.ph_apartamento} onChange={(e) => handleFieldChange('ph_apartamento', e.target.value.toUpperCase())} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sección 4: Condominio */}
      <div className="border border-orange-200 rounded-lg overflow-hidden">
        <div className="bg-orange-50 px-4 py-2 border-b border-orange-200">
          <h3 className="font-semibold text-orange-800 flex items-center gap-2">
            <Home className="w-4 h-4" />
            4. Condominio
          </h3>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-slate-500">Área Terreno Común</Label>
              <Input type="number" step="0.01" value={visitaData.cond_area_terreno_comun} onChange={(e) => handleFieldChange('cond_area_terreno_comun', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Área de Terreno Privada</Label>
              <Input type="number" step="0.01" value={visitaData.cond_area_terreno_privada} onChange={(e) => handleFieldChange('cond_area_terreno_privada', e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-slate-500">Área Construida Privada</Label>
              <Input type="number" step="0.01" value={visitaData.cond_area_construida_privada} onChange={(e) => handleFieldChange('cond_area_construida_privada', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Área Construida Común</Label>
              <Input type="number" step="0.01" value={visitaData.cond_area_construida_comun} onChange={(e) => handleFieldChange('cond_area_construida_comun', e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-slate-500">Condominio</Label>
              <Input value={visitaData.cond_condominio} onChange={(e) => handleFieldChange('cond_condominio', e.target.value.toUpperCase())} className="uppercase" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Predio Asociado</Label>
              <Input value={visitaData.cond_predio_asociado} onChange={(e) => handleFieldChange('cond_predio_asociado', e.target.value)} className="font-mono" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-slate-500">Unidad</Label>
              <Input value={visitaData.cond_unidad} onChange={(e) => handleFieldChange('cond_unidad', e.target.value.toUpperCase())} />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Casa</Label>
              <Input value={visitaData.cond_casa} onChange={(e) => handleFieldChange('cond_casa', e.target.value.toUpperCase())} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
});

VisitaPagina1.displayName = 'VisitaPagina1';

export default VisitaPagina1;
