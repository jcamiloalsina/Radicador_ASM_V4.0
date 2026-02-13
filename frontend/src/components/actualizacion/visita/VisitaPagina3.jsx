/**
 * Página 3 del Formulario de Visita
 * Secciones: Información de Construcciones, Calificación
 * 
 * OPTIMIZACIÓN DE RENDIMIENTO:
 * - DebouncedTableInput: Input con estado local y debounce para tablas
 * - React.memo() en todo el componente y sub-componentes
 * - useCallback() para handlers
 */
import React, { memo, useCallback, useState, useEffect, useRef } from 'react';
import { Building, FileText, Plus, Trash2 } from 'lucide-react';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';

// Input optimizado para tablas - mantiene estado local y actualiza con debounce
const DebouncedTableInput = memo(({ value, onChange, debounceMs = 200, ...props }) => {
  const [localValue, setLocalValue] = useState(value || '');
  const timeoutRef = useRef(null);
  const isFirstRender = useRef(true);

  // Sincronizar con valor externo solo cuando cambia desde fuera
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setLocalValue(value || '');
  }, [value]);

  const handleChange = useCallback((e) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    
    // Cancelar timeout anterior
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    // Actualizar padre después del debounce
    timeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, debounceMs);
  }, [onChange, debounceMs]);

  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return <Input {...props} value={localValue} onChange={handleChange} />;
});

DebouncedTableInput.displayName = 'DebouncedTableInput';

const VisitaPagina3 = memo(({ 
  visitaConstrucciones,
  setVisitaConstrucciones,
  agregarConstruccion,
  eliminarConstruccion,
  actualizarConstruccion,
  visitaCalificaciones,
  setVisitaCalificaciones,
  agregarCalificacion,
  eliminarCalificacion,
  actualizarCalificacion
}) => {
  // Handler para actualizar construcción de forma directa
  const handleConstruccionChange = useCallback((idx, campo, valor) => {
    setVisitaConstrucciones(prev => {
      const nuevas = [...prev];
      nuevas[idx] = { ...nuevas[idx], [campo]: valor };
      return nuevas;
    });
  }, [setVisitaConstrucciones]);

  // Handler para actualizar calificación
  const handleCalificacionChange = useCallback((califIdx, seccion, campo, valor) => {
    setVisitaCalificaciones(prev => {
      const nuevas = [...prev];
      nuevas[califIdx] = {
        ...nuevas[califIdx],
        [seccion]: { ...nuevas[califIdx][seccion], [campo]: valor }
      };
      return nuevas;
    });
  }, [setVisitaCalificaciones]);

  return (
    <>
      {/* Sección 7: Información de Construcciones */}
      <div className="border border-purple-200 rounded-lg overflow-hidden">
        <div className="bg-purple-50 px-4 py-2 border-b border-purple-200 flex items-center justify-between">
          <h3 className="font-semibold text-purple-800 flex items-center gap-2">
            <Building className="w-4 h-4" />
            7. INFORMACIÓN DE CONSTRUCCIONES
          </h3>
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={agregarConstruccion} 
            className="text-purple-700 border-purple-300 hover:bg-purple-100"
          >
            <Plus className="w-3 h-3 mr-1" /> Agregar Unidad
          </Button>
        </div>
        <div className="p-4 space-y-3">
          <div className="text-xs text-slate-500 mb-2">
            Registre cada unidad de construcción del predio. Use el botón "Agregar Unidad" si necesita más de 5.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-purple-50 text-left">
                  <th className="px-2 py-2 font-medium text-purple-700">Unidad</th>
                  <th className="px-2 py-2 font-medium text-purple-700">Código Uso</th>
                  <th className="px-2 py-2 font-medium text-purple-700">Área (m²)</th>
                  <th className="px-2 py-2 font-medium text-purple-700">Puntaje</th>
                  <th className="px-2 py-2 font-medium text-purple-700">Año Const.</th>
                  <th className="px-2 py-2 font-medium text-purple-700">N° Pisos</th>
                  <th className="px-2 py-2 font-medium text-purple-700"></th>
                </tr>
              </thead>
              <tbody>
                {visitaConstrucciones.map((cons, idx) => (
                  <tr key={idx} className="border-b border-purple-100">
                    <td className="px-2 py-2">
                      <span className="font-bold text-purple-700">{cons.unidad}</span>
                    </td>
                    <td className="px-2 py-2">
                      <DebouncedTableInput 
                        value={cons.codigo_uso} 
                        onChange={(val) => handleConstruccionChange(idx, 'codigo_uso', val)} 
                        placeholder="Ej: 01" 
                        className="w-20 h-8 text-sm" 
                      />
                    </td>
                    <td className="px-2 py-2">
                      <DebouncedTableInput 
                        type="number" 
                        value={cons.area} 
                        onChange={(val) => handleConstruccionChange(idx, 'area', val)} 
                        placeholder="0" 
                        className="w-20 h-8 text-sm" 
                      />
                    </td>
                    <td className="px-2 py-2">
                      <DebouncedTableInput 
                        type="number" 
                        value={cons.puntaje} 
                        onChange={(val) => handleConstruccionChange(idx, 'puntaje', val)} 
                        placeholder="0" 
                        className="w-16 h-8 text-sm" 
                      />
                    </td>
                    <td className="px-2 py-2">
                      <DebouncedTableInput 
                        type="number" 
                        value={cons.ano_construccion} 
                        onChange={(val) => handleConstruccionChange(idx, 'ano_construccion', val)} 
                        placeholder="2024" 
                        className="w-20 h-8 text-sm" 
                      />
                    </td>
                    <td className="px-2 py-2">
                      <DebouncedTableInput 
                        type="number" 
                        value={cons.num_pisos} 
                        onChange={(val) => handleConstruccionChange(idx, 'num_pisos', val)} 
                        placeholder="1" 
                        className="w-16 h-8 text-sm" 
                      />
                    </td>
                    <td className="px-2 py-2">
                      {visitaConstrucciones.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => eliminarConstruccion(idx)} 
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Sección 8: Calificación */}
      <div className="border border-orange-200 rounded-lg overflow-hidden">
        <div className="bg-orange-50 px-4 py-2 border-b border-orange-200 flex items-center justify-between">
          <h3 className="font-semibold text-orange-800 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            8. CALIFICACIÓN
          </h3>
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={agregarCalificacion} 
            className="text-orange-700 border-orange-300 hover:bg-orange-100"
          >
            <Plus className="w-3 h-3 mr-1" /> Agregar Calificación
          </Button>
        </div>
        <div className="p-4 space-y-6">
          <p className="text-xs text-slate-500">
            Registre la calificación de cada unidad de construcción. Use el botón "Agregar Calificación" para múltiples unidades.
          </p>
          
          {visitaCalificaciones.map((calif, califIdx) => (
            <div key={califIdx} className="border border-orange-300 rounded-lg overflow-hidden">
              <div className="bg-orange-100 px-4 py-2 flex items-center justify-between">
                <span className="font-semibold text-orange-800">Calificación #{calif.id}</span>
                {visitaCalificaciones.length > 1 && (
                  <button type="button" onClick={() => eliminarCalificacion(califIdx)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="p-4 space-y-4">
                {/* Estructura */}
                <div className="border rounded-lg p-3 bg-slate-50">
                  <h4 className="font-medium text-slate-700 mb-3">8.1 ESTRUCTURA</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs text-slate-500">Armazón</Label>
                      <DebouncedTableInput value={calif.estructura.armazon} onChange={(val) => handleCalificacionChange(califIdx, 'estructura', 'armazon', val)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Muros</Label>
                      <DebouncedTableInput value={calif.estructura.muros} onChange={(val) => handleCalificacionChange(califIdx, 'estructura', 'muros', val)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Cubierta</Label>
                      <DebouncedTableInput value={calif.estructura.cubierta} onChange={(val) => handleCalificacionChange(califIdx, 'estructura', 'cubierta', val)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Conservación</Label>
                      <DebouncedTableInput value={calif.estructura.conservacion} onChange={(val) => handleCalificacionChange(califIdx, 'estructura', 'conservacion', val)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                  </div>
                </div>

                {/* Acabados */}
                <div className="border rounded-lg p-3 bg-slate-50">
                  <h4 className="font-medium text-slate-700 mb-3">8.2 ACABADOS PRINCIPALES</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs text-slate-500">Fachadas</Label>
                      <DebouncedTableInput value={calif.acabados.fachadas} onChange={(val) => handleCalificacionChange(califIdx, 'acabados', 'fachadas', val)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Cubrim. Muros</Label>
                      <DebouncedTableInput value={calif.acabados.cubrim_muros} onChange={(val) => handleCalificacionChange(califIdx, 'acabados', 'cubrim_muros', val)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Pisos</Label>
                      <DebouncedTableInput value={calif.acabados.pisos} onChange={(val) => handleCalificacionChange(califIdx, 'acabados', 'pisos', val)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Conservación</Label>
                      <DebouncedTableInput value={calif.acabados.conservacion} onChange={(val) => handleCalificacionChange(califIdx, 'acabados', 'conservacion', val)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                  </div>
                </div>

                {/* Baño */}
                <div className="border rounded-lg p-3 bg-slate-50">
                  <h4 className="font-medium text-slate-700 mb-3">8.3 BAÑO</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs text-slate-500">Tamaño</Label>
                      <DebouncedTableInput value={calif.bano.tamano} onChange={(val) => handleCalificacionChange(califIdx, 'bano', 'tamano', val)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Enchape</Label>
                      <DebouncedTableInput value={calif.bano.enchape} onChange={(val) => handleCalificacionChange(califIdx, 'bano', 'enchape', val)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Mobiliario</Label>
                      <DebouncedTableInput value={calif.bano.mobiliario} onChange={(val) => handleCalificacionChange(califIdx, 'bano', 'mobiliario', val)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Conservación</Label>
                      <DebouncedTableInput value={calif.bano.conservacion} onChange={(val) => handleCalificacionChange(califIdx, 'bano', 'conservacion', val)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                  </div>
                </div>

                {/* Cocina */}
                <div className="border rounded-lg p-3 bg-slate-50">
                  <h4 className="font-medium text-slate-700 mb-3">8.4 COCINA</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs text-slate-500">Tamaño</Label>
                      <DebouncedTableInput value={calif.cocina.tamano} onChange={(val) => handleCalificacionChange(califIdx, 'cocina', 'tamano', val)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Enchape</Label>
                      <DebouncedTableInput value={calif.cocina.enchape} onChange={(val) => handleCalificacionChange(califIdx, 'cocina', 'enchape', val)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Mobiliario</Label>
                      <DebouncedTableInput value={calif.cocina.mobiliario} onChange={(val) => handleCalificacionChange(califIdx, 'cocina', 'mobiliario', val)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Conservación</Label>
                      <DebouncedTableInput value={calif.cocina.conservacion} onChange={(val) => handleCalificacionChange(califIdx, 'cocina', 'conservacion', val)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                  </div>
                </div>

                {/* Industria */}
                <div className="border rounded-lg p-3 bg-slate-50">
                  <h4 className="font-medium text-slate-700 mb-3">8.5 COMPLEMENTO INDUSTRIA (si aplica)</h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div>
                      <Label className="text-xs text-slate-500">Cercha Madera</Label>
                      <DebouncedTableInput value={calif.industria.cercha_madera} onChange={(val) => handleCalificacionChange(califIdx, 'industria', 'cercha_madera', val)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">C. Met. Liviana</Label>
                      <DebouncedTableInput value={calif.industria.cercha_metalica_liviana} onChange={(val) => handleCalificacionChange(califIdx, 'industria', 'cercha_metalica_liviana', val)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">C. Met. Mediana</Label>
                      <DebouncedTableInput value={calif.industria.cercha_metalica_mediana} onChange={(val) => handleCalificacionChange(califIdx, 'industria', 'cercha_metalica_mediana', val)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">C. Met. Pesada</Label>
                      <DebouncedTableInput value={calif.industria.cercha_metalica_pesada} onChange={(val) => handleCalificacionChange(califIdx, 'industria', 'cercha_metalica_pesada', val)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Altura (m)</Label>
                      <DebouncedTableInput value={calif.industria.altura} onChange={(val) => handleCalificacionChange(califIdx, 'industria', 'altura', val)} placeholder="0" className="h-8 text-sm" />
                    </div>
                  </div>
                </div>

                {/* Datos Generales */}
                <div className="border rounded-lg p-3 bg-emerald-50 border-emerald-200">
                  <h4 className="font-medium text-emerald-700 mb-3">8.6 DATOS GENERALES</h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div>
                      <Label className="text-xs text-slate-500">Total Pisos</Label>
                      <DebouncedTableInput type="number" value={calif.datos_generales.total_pisos} onChange={(val) => handleCalificacionChange(califIdx, 'datos_generales', 'total_pisos', val)} placeholder="0" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Habitaciones</Label>
                      <DebouncedTableInput type="number" value={calif.datos_generales.total_habitaciones} onChange={(val) => handleCalificacionChange(califIdx, 'datos_generales', 'total_habitaciones', val)} placeholder="0" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Baños</Label>
                      <DebouncedTableInput type="number" value={calif.datos_generales.total_banos} onChange={(val) => handleCalificacionChange(califIdx, 'datos_generales', 'total_banos', val)} placeholder="0" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Locales</Label>
                      <DebouncedTableInput type="number" value={calif.datos_generales.total_locales} onChange={(val) => handleCalificacionChange(califIdx, 'datos_generales', 'total_locales', val)} placeholder="0" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Área Total (m²)</Label>
                      <DebouncedTableInput type="number" value={calif.datos_generales.area_total_construida} onChange={(val) => handleCalificacionChange(califIdx, 'datos_generales', 'area_total_construida', val)} placeholder="0" className="h-8 text-sm" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
});

VisitaPagina3.displayName = 'VisitaPagina3';

export default VisitaPagina3;
