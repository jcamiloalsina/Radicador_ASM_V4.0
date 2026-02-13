/**
 * Página 3 del Formulario de Visita
 * Secciones: Información de Construcciones, Calificación
 */
import React, { memo, useCallback } from 'react';
import { Building, FileText, Plus, Trash2 } from 'lucide-react';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';

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
                      <Input 
                        value={cons.codigo_uso} 
                        onChange={(e) => handleConstruccionChange(idx, 'codigo_uso', e.target.value)} 
                        placeholder="Ej: 01" 
                        className="w-20 h-8 text-sm" 
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input 
                        type="number" 
                        value={cons.area} 
                        onChange={(e) => handleConstruccionChange(idx, 'area', e.target.value)} 
                        placeholder="0" 
                        className="w-20 h-8 text-sm" 
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input 
                        type="number" 
                        value={cons.puntaje} 
                        onChange={(e) => handleConstruccionChange(idx, 'puntaje', e.target.value)} 
                        placeholder="0" 
                        className="w-16 h-8 text-sm" 
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input 
                        type="number" 
                        value={cons.ano_construccion} 
                        onChange={(e) => handleConstruccionChange(idx, 'ano_construccion', e.target.value)} 
                        placeholder="2024" 
                        className="w-20 h-8 text-sm" 
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input 
                        type="number" 
                        value={cons.num_pisos} 
                        onChange={(e) => handleConstruccionChange(idx, 'num_pisos', e.target.value)} 
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
                      <Input value={calif.estructura.armazon} onChange={(e) => handleCalificacionChange(califIdx, 'estructura', 'armazon', e.target.value)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Muros</Label>
                      <Input value={calif.estructura.muros} onChange={(e) => handleCalificacionChange(califIdx, 'estructura', 'muros', e.target.value)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Cubierta</Label>
                      <Input value={calif.estructura.cubierta} onChange={(e) => handleCalificacionChange(califIdx, 'estructura', 'cubierta', e.target.value)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Conservación</Label>
                      <Input value={calif.estructura.conservacion} onChange={(e) => handleCalificacionChange(califIdx, 'estructura', 'conservacion', e.target.value)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                  </div>
                </div>

                {/* Acabados */}
                <div className="border rounded-lg p-3 bg-slate-50">
                  <h4 className="font-medium text-slate-700 mb-3">8.2 ACABADOS PRINCIPALES</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs text-slate-500">Fachadas</Label>
                      <Input value={calif.acabados.fachadas} onChange={(e) => handleCalificacionChange(califIdx, 'acabados', 'fachadas', e.target.value)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Cubrim. Muros</Label>
                      <Input value={calif.acabados.cubrim_muros} onChange={(e) => handleCalificacionChange(califIdx, 'acabados', 'cubrim_muros', e.target.value)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Pisos</Label>
                      <Input value={calif.acabados.pisos} onChange={(e) => handleCalificacionChange(califIdx, 'acabados', 'pisos', e.target.value)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Conservación</Label>
                      <Input value={calif.acabados.conservacion} onChange={(e) => handleCalificacionChange(califIdx, 'acabados', 'conservacion', e.target.value)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                  </div>
                </div>

                {/* Baño */}
                <div className="border rounded-lg p-3 bg-slate-50">
                  <h4 className="font-medium text-slate-700 mb-3">8.3 BAÑO</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs text-slate-500">Tamaño</Label>
                      <Input value={calif.bano.tamano} onChange={(e) => handleCalificacionChange(califIdx, 'bano', 'tamano', e.target.value)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Enchape</Label>
                      <Input value={calif.bano.enchape} onChange={(e) => handleCalificacionChange(califIdx, 'bano', 'enchape', e.target.value)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Mobiliario</Label>
                      <Input value={calif.bano.mobiliario} onChange={(e) => handleCalificacionChange(califIdx, 'bano', 'mobiliario', e.target.value)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Conservación</Label>
                      <Input value={calif.bano.conservacion} onChange={(e) => handleCalificacionChange(califIdx, 'bano', 'conservacion', e.target.value)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                  </div>
                </div>

                {/* Cocina */}
                <div className="border rounded-lg p-3 bg-slate-50">
                  <h4 className="font-medium text-slate-700 mb-3">8.4 COCINA</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs text-slate-500">Tamaño</Label>
                      <Input value={calif.cocina.tamano} onChange={(e) => handleCalificacionChange(califIdx, 'cocina', 'tamano', e.target.value)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Enchape</Label>
                      <Input value={calif.cocina.enchape} onChange={(e) => handleCalificacionChange(califIdx, 'cocina', 'enchape', e.target.value)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Mobiliario</Label>
                      <Input value={calif.cocina.mobiliario} onChange={(e) => handleCalificacionChange(califIdx, 'cocina', 'mobiliario', e.target.value)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Conservación</Label>
                      <Input value={calif.cocina.conservacion} onChange={(e) => handleCalificacionChange(califIdx, 'cocina', 'conservacion', e.target.value)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                  </div>
                </div>

                {/* Industria */}
                <div className="border rounded-lg p-3 bg-slate-50">
                  <h4 className="font-medium text-slate-700 mb-3">8.5 COMPLEMENTO INDUSTRIA (si aplica)</h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div>
                      <Label className="text-xs text-slate-500">Cercha Madera</Label>
                      <Input value={calif.industria.cercha_madera} onChange={(e) => handleCalificacionChange(califIdx, 'industria', 'cercha_madera', e.target.value)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">C. Met. Liviana</Label>
                      <Input value={calif.industria.cercha_metalica_liviana} onChange={(e) => handleCalificacionChange(califIdx, 'industria', 'cercha_metalica_liviana', e.target.value)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">C. Met. Mediana</Label>
                      <Input value={calif.industria.cercha_metalica_mediana} onChange={(e) => handleCalificacionChange(califIdx, 'industria', 'cercha_metalica_mediana', e.target.value)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">C. Met. Pesada</Label>
                      <Input value={calif.industria.cercha_metalica_pesada} onChange={(e) => handleCalificacionChange(califIdx, 'industria', 'cercha_metalica_pesada', e.target.value)} placeholder="Código" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Altura (m)</Label>
                      <Input value={calif.industria.altura} onChange={(e) => handleCalificacionChange(califIdx, 'industria', 'altura', e.target.value)} placeholder="0" className="h-8 text-sm" />
                    </div>
                  </div>
                </div>

                {/* Datos Generales */}
                <div className="border rounded-lg p-3 bg-emerald-50 border-emerald-200">
                  <h4 className="font-medium text-emerald-700 mb-3">8.6 DATOS GENERALES</h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div>
                      <Label className="text-xs text-slate-500">Total Pisos</Label>
                      <Input type="number" value={calif.datos_generales.total_pisos} onChange={(e) => handleCalificacionChange(califIdx, 'datos_generales', 'total_pisos', e.target.value)} placeholder="0" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Habitaciones</Label>
                      <Input type="number" value={calif.datos_generales.total_habitaciones} onChange={(e) => handleCalificacionChange(califIdx, 'datos_generales', 'total_habitaciones', e.target.value)} placeholder="0" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Baños</Label>
                      <Input type="number" value={calif.datos_generales.total_banos} onChange={(e) => handleCalificacionChange(califIdx, 'datos_generales', 'total_banos', e.target.value)} placeholder="0" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Locales</Label>
                      <Input type="number" value={calif.datos_generales.total_locales} onChange={(e) => handleCalificacionChange(califIdx, 'datos_generales', 'total_locales', e.target.value)} placeholder="0" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Área Total (m²)</Label>
                      <Input type="number" value={calif.datos_generales.area_total_construida} onChange={(e) => handleCalificacionChange(califIdx, 'datos_generales', 'area_total_construida', e.target.value)} placeholder="0" className="h-8 text-sm" />
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
