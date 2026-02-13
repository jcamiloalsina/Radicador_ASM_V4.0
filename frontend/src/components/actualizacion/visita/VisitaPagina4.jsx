/**
 * Página 4 del Formulario de Visita
 * Secciones: Resumen Áreas de Terreno, Información de Localización (Croquis/Fotos)
 */
import React, { memo, useCallback } from 'react';
import { FileText, Camera, Image as ImageIcon, X } from 'lucide-react';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';

// Función para formatear área
const formatearArea = (m2) => {
  if (!m2) return '0 m²';
  const area = parseFloat(m2);
  if (area >= 10000) {
    const ha = (area / 10000).toFixed(4);
    return `${ha} ha (${area.toLocaleString('es-CO')} m²)`;
  }
  return `${area.toLocaleString('es-CO')} m²`;
};

const VisitaPagina4 = memo(({ 
  visitaData, 
  setVisitaData,
  handleFotoCroquisChange,
  eliminarFotoCroquis
}) => {
  const handleFieldChange = useCallback((field, value) => {
    setVisitaData(prev => ({ ...prev, [field]: value }));
  }, [setVisitaData]);

  // Handler para cambio de área con conversión automática
  const handleAreaChange = useCallback((field, value, multiplier = 10000) => {
    const haField = field;
    const m2Field = field.replace('_ha', '_m2');
    const m2Value = value ? (parseFloat(value) * multiplier).toFixed(2) : '';
    
    setVisitaData(prev => ({
      ...prev,
      [haField]: value,
      [m2Field]: m2Value
    }));
  }, [setVisitaData]);

  return (
    <>
      {/* Sección 9: Resumen áreas de terreno */}
      <div className="border border-teal-200 rounded-lg overflow-hidden">
        <div className="bg-teal-50 px-4 py-2 border-b border-teal-200">
          <h3 className="font-semibold text-teal-800 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            9. RESUMEN ÁREAS DE TERRENO
          </h3>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-teal-50">
                  <th className="px-3 py-2 text-left font-medium text-teal-700 border border-teal-200">Área de terreno según:</th>
                  <th className="px-3 py-2 text-center font-medium text-teal-700 border border-teal-200 w-24">Ha</th>
                  <th className="px-3 py-2 text-center font-medium text-teal-700 border border-teal-200 w-24">m²</th>
                  <th className="px-3 py-2 text-left font-medium text-teal-700 border border-teal-200">Descripción</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-2 border border-teal-200 font-medium text-slate-700">Área de título</td>
                  <td className="px-1 py-1 border border-teal-200">
                    <Input 
                      type="number" 
                      step="0.0001" 
                      value={visitaData.area_titulo_ha} 
                      onChange={(e) => handleAreaChange('area_titulo_ha', e.target.value)} 
                      className="h-8 text-sm text-center" 
                      placeholder="0.0000" 
                    />
                  </td>
                  <td className="px-1 py-1 border border-teal-200">
                    <Input type="text" value={visitaData.area_titulo_m2} readOnly className="h-8 text-sm text-center bg-slate-50" placeholder="0" />
                  </td>
                  <td className="px-1 py-1 border border-teal-200">
                    <Input value={visitaData.area_titulo_desc} onChange={(e) => handleFieldChange('area_titulo_desc', e.target.value)} className="h-8 text-sm" placeholder="Descripción" />
                  </td>
                </tr>
                <tr className="bg-emerald-50">
                  <td className="px-3 py-2 border border-teal-200 font-medium text-emerald-700">Área base catastral (R1)</td>
                  <td className="px-1 py-1 border border-teal-200">
                    <Input type="text" value={visitaData.area_base_catastral_ha} readOnly className="h-8 text-sm text-center bg-emerald-100" />
                  </td>
                  <td className="px-1 py-1 border border-teal-200">
                    <Input type="text" value={visitaData.area_base_catastral_m2} readOnly className="h-8 text-sm text-center bg-emerald-100 font-medium" />
                  </td>
                  <td className="px-1 py-1 border border-teal-200">
                    <Input value={visitaData.area_base_catastral_desc} readOnly className="h-8 text-sm bg-emerald-100 text-emerald-700" />
                  </td>
                </tr>
                <tr className="bg-blue-50">
                  <td className="px-3 py-2 border border-teal-200 font-medium text-blue-700">Área geográfica (GDB)</td>
                  <td className="px-1 py-1 border border-teal-200">
                    <Input type="text" value={visitaData.area_geografica_ha} readOnly className="h-8 text-sm text-center bg-blue-100" />
                  </td>
                  <td className="px-1 py-1 border border-teal-200">
                    <Input type="text" value={visitaData.area_geografica_m2} readOnly className="h-8 text-sm text-center bg-blue-100 font-medium" />
                  </td>
                  <td className="px-1 py-1 border border-teal-200">
                    <Input value={visitaData.area_geografica_desc} readOnly className="h-8 text-sm bg-blue-100 text-blue-700" />
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 border border-teal-200 font-medium text-slate-700">Área levantamiento topográfico</td>
                  <td className="px-1 py-1 border border-teal-200">
                    <Input 
                      type="number" 
                      step="0.0001" 
                      value={visitaData.area_levantamiento_ha} 
                      onChange={(e) => handleAreaChange('area_levantamiento_ha', e.target.value)} 
                      className="h-8 text-sm text-center" 
                      placeholder="0.0000" 
                    />
                  </td>
                  <td className="px-1 py-1 border border-teal-200">
                    <Input type="text" value={visitaData.area_levantamiento_m2} readOnly className="h-8 text-sm text-center bg-slate-50" placeholder="0" />
                  </td>
                  <td className="px-1 py-1 border border-teal-200">
                    <Input value={visitaData.area_levantamiento_desc} onChange={(e) => handleFieldChange('area_levantamiento_desc', e.target.value)} className="h-8 text-sm" placeholder="Descripción" />
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 border border-teal-200 font-medium text-slate-700">Área de la identificación predial</td>
                  <td className="px-1 py-1 border border-teal-200">
                    <Input 
                      type="number" 
                      step="0.0001" 
                      value={visitaData.area_identificacion_ha} 
                      onChange={(e) => handleAreaChange('area_identificacion_ha', e.target.value)} 
                      className="h-8 text-sm text-center" 
                      placeholder="0.0000" 
                    />
                  </td>
                  <td className="px-1 py-1 border border-teal-200">
                    <Input type="text" value={visitaData.area_identificacion_m2} readOnly className="h-8 text-sm text-center bg-slate-50" placeholder="0" />
                  </td>
                  <td className="px-1 py-1 border border-teal-200">
                    <Input value={visitaData.area_identificacion_desc} onChange={(e) => handleFieldChange('area_identificacion_desc', e.target.value)} className="h-8 text-sm" placeholder="Descripción" />
                  </td>
                </tr>
              </tbody>
            </table>
            
            {/* Resumen de áreas */}
            <div className="mt-4 p-3 bg-slate-100 rounded-lg">
              <p className="text-xs font-medium text-slate-700 mb-2">Resumen de Áreas:</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-emerald-700">R1 (Base):</span>
                  <span className="font-mono font-medium">{formatearArea(visitaData.area_base_catastral_m2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">GDB:</span>
                  <span className="font-mono font-medium">{formatearArea(visitaData.area_geografica_m2)}</span>
                </div>
                {visitaData.area_titulo_m2 && (
                  <div className="flex justify-between">
                    <span className="text-slate-700">Título:</span>
                    <span className="font-mono">{formatearArea(visitaData.area_titulo_m2)}</span>
                  </div>
                )}
                {visitaData.area_levantamiento_m2 && (
                  <div className="flex justify-between">
                    <span className="text-slate-700">Levantamiento:</span>
                    <span className="font-mono">{formatearArea(visitaData.area_levantamiento_m2)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">* Los campos de Área base catastral (R1) y Área geográfica (GDB) se pre-llenan automáticamente del sistema.</p>
        </div>
      </div>

      {/* Sección 10: Información de Localización (Croquis/Fotos) */}
      <div className="border border-indigo-200 rounded-lg overflow-hidden">
        <div className="bg-indigo-50 px-4 py-2 border-b border-indigo-200">
          <h3 className="font-semibold text-indigo-800 flex items-center gap-2">
            <Camera className="w-4 h-4" />
            10. INFORMACIÓN DE LOCALIZACIÓN (Croquis del terreno y construcciones)
          </h3>
        </div>
        <div className="p-4">
          <p className="text-sm text-slate-600 mb-3">Cargue fotos del croquis del terreno y las construcciones. Incluya información de colindantes y cotas cuando aplique.</p>
          
          {/* Input para cámara (Android/iOS) */}
          <input 
            type="file" 
            accept="image/*" 
            capture="environment"
            onChange={handleFotoCroquisChange} 
            className="hidden" 
            id="input-croquis-camera" 
          />
          
          {/* Input para galería */}
          <input 
            type="file" 
            accept="image/*" 
            multiple 
            onChange={handleFotoCroquisChange} 
            className="hidden" 
            id="input-croquis-gallery" 
          />
          
          {/* Grid de fotos cargadas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            {visitaData.fotos_croquis.map((foto, idx) => (
              <div key={idx} className="relative aspect-square border rounded-lg overflow-hidden bg-white shadow-sm">
                <img src={foto.preview || foto.data} alt={`Croquis ${idx + 1}`} className="w-full h-full object-cover" />
                <button type="button" onClick={() => eliminarFotoCroquis(idx)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow hover:bg-red-600">
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate">
                  {foto.nombre || `Foto ${idx + 1}`}
                </div>
              </div>
            ))}
          </div>
          
          {/* Botones para agregar fotos */}
          <div className="grid grid-cols-2 gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => document.getElementById('input-croquis-camera')?.click()} 
              className="border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50"
            >
              <Camera className="w-4 h-4 mr-2" />
              Tomar Foto
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => document.getElementById('input-croquis-gallery')?.click()} 
              className="border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50"
            >
              <ImageIcon className="w-4 h-4 mr-2" />
              Galería
            </Button>
          </div>
          
          {/* Indicador de orientación Norte */}
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <div className="w-6 h-6 border border-slate-300 rounded flex items-center justify-center font-bold text-slate-600">N</div>
            <span>Asegúrese de que las fotos incluyan la orientación norte cuando sea relevante.</span>
          </div>
        </div>
      </div>
    </>
  );
});

VisitaPagina4.displayName = 'VisitaPagina4';

export default VisitaPagina4;
