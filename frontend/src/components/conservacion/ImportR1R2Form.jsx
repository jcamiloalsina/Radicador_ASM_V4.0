import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import axios from 'axios';
import { Upload, Loader2, AlertTriangle } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Municipios con sus códigos
const MUNICIPIOS = [
  { codigo: '54003', nombre: 'Ábrego' },
  { codigo: '54109', nombre: 'Bucarasica' },
  { codigo: '54128', nombre: 'Cáchira' },
  { codigo: '54206', nombre: 'Convención' },
  { codigo: '54245', nombre: 'El Carmen' },
  { codigo: '54250', nombre: 'El Tarra' },
  { codigo: '54344', nombre: 'Hacarí' },
  { codigo: '54385', nombre: 'La Esperanza' },
  { codigo: '54398', nombre: 'La Playa' },
  { codigo: '54670', nombre: 'San Calixto' },
  { codigo: '54720', nombre: 'Sardinata' },
  { codigo: '54800', nombre: 'Teorama' },
  { codigo: '20614', nombre: 'Río de Oro' },
];

/**
 * Formulario para importar archivos Excel R1/R2
 * Requiere seleccionar municipio para validación
 * 
 * @param {function} onSuccess - Callback cuando la importación es exitosa
 */
function ImportR1R2Form({ onSuccess }) {
  const [files, setFiles] = useState([]);
  const [vigencia, setVigencia] = useState(new Date().getFullYear().toString());
  const [codigoMunicipio, setCodigoMunicipio] = useState('');
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState([]);
  const [currentFile, setCurrentFile] = useState('');

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const municipioSeleccionado = MUNICIPIOS.find(m => m.codigo === codigoMunicipio);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!codigoMunicipio) {
      toast.error('Debe seleccionar un municipio');
      return;
    }
    
    if (files.length === 0) {
      toast.error('Por favor seleccione al menos un archivo Excel');
      return;
    }

    setUploading(true);
    setResults([]);

    const token = localStorage.getItem('token');
    const vigenciaFormato = `0101${vigencia}`;
    const importResults = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setCurrentFile(`Importando ${file.name} (${i + 1}/${files.length})...`);
      
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await axios.post(
          `${API}/predios/import-excel?vigencia=${vigenciaFormato}&codigo_municipio=${codigoMunicipio}`,
          formData,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        );

        importResults.push({
          fileName: file.name,
          success: true,
          message: response.data.message,
          predios: response.data.predios_importados,
          prediosEliminados: response.data.predios_eliminados,
          prediosNuevos: response.data.predios_nuevos,
          municipio: response.data.municipio
        });
      } catch (error) {
        const errorDetail = error.response?.data?.detail;
        let errorMsg = 'Error al importar';
        
        // Si el error es un objeto con detalles de validación de municipio
        if (typeof errorDetail === 'object' && errorDetail.error) {
          errorMsg = errorDetail.error;
          if (errorDetail.municipios_en_excel) {
            errorMsg += `. Municipios encontrados en Excel: ${errorDetail.municipios_en_excel}`;
          }
        } else if (typeof errorDetail === 'string') {
          errorMsg = errorDetail;
        }
        
        importResults.push({
          fileName: file.name,
          success: false,
          message: errorMsg,
          detail: typeof errorDetail === 'object' ? errorDetail : null
        });
      }
    }

    setResults(importResults);
    setCurrentFile('');
    setUploading(false);
    
    const successCount = importResults.filter(r => r.success).length;
    if (successCount > 0) {
      toast.success(`${successCount} de ${files.length} archivos importados exitosamente`);
      if (onSuccess) onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="import-r1r2-form">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
        <p className="font-medium text-blue-800 mb-2">Instrucciones de Importación:</p>
        <ul className="text-blue-700 space-y-1 text-xs">
          <li>• <strong>Primero seleccione el municipio</strong> al que pertenecen los predios</li>
          <li>• Puede seleccionar <strong>múltiples archivos</strong> .xlsx del mismo municipio</li>
          <li>• Cada archivo debe contener hojas R1 y R2</li>
          <li>• El sistema validará que todos los predios pertenezcan al municipio seleccionado</li>
        </ul>
      </div>

      <div>
        <Label className="text-sm font-medium">Municipio *</Label>
        <select 
          value={codigoMunicipio} 
          onChange={(e) => setCodigoMunicipio(e.target.value)}
          className="flex h-9 w-full mt-1 items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          data-testid="municipio-select"
          required
        >
          <option value="">Seleccione el municipio</option>
          {MUNICIPIOS.map(m => (
            <option key={m.codigo} value={m.codigo}>{m.nombre} ({m.codigo})</option>
          ))}
        </select>
        {municipioSeleccionado && (
          <p className="text-xs text-emerald-600 mt-1 font-medium">
            Solo se importarán predios con código que inicie con {codigoMunicipio}
          </p>
        )}
      </div>

      <div>
        <Label className="text-sm font-medium">Vigencia (Año) *</Label>
        <select 
          value={vigencia} 
          onChange={(e) => setVigencia(e.target.value)}
          className="flex h-9 w-full mt-1 items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          data-testid="vigencia-select"
        >
          <option value="">Seleccione el año</option>
          {years.map(year => (
            <option key={year} value={year.toString()}>{year}</option>
          ))}
        </select>
        <p className="text-xs text-slate-500 mt-1">Se almacenará como vigencia 0101{vigencia}</p>
      </div>

      <div>
        <Label className="text-sm font-medium">Archivos R1-R2 (.xlsx) *</Label>
        <div className="mt-1">
          <Input
            type="file"
            accept=".xlsx"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            className="cursor-pointer"
            data-testid="file-input"
            disabled={!codigoMunicipio}
          />
        </div>
        {!codigoMunicipio && (
          <p className="text-xs text-amber-600 mt-1">Primero seleccione un municipio</p>
        )}
        {files.length > 0 && (
          <div className="mt-2 space-y-1">
            <p className="text-xs font-medium text-emerald-700">{files.length} archivo(s) seleccionado(s):</p>
            {files.map((file, idx) => (
              <p key={idx} className="text-xs text-slate-600">• {file.name}</p>
            ))}
          </div>
        )}
      </div>

      {currentFile && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
            <p className="text-sm text-amber-800">{currentFile}</p>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {results.map((result, idx) => (
            <div key={idx} className={`p-3 rounded-lg text-xs ${result.success ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
              <p className={`font-medium ${result.success ? 'text-emerald-800' : 'text-red-800'}`}>
                {result.success ? '✅' : '❌'} {result.fileName}
              </p>
              {result.success ? (
                <p className="text-emerald-700">
                  {result.municipio}: {result.predios?.toLocaleString()} predios
                  {result.prediosEliminados > 0 && <span className="text-red-600"> · {result.prediosEliminados} eliminados</span>}
                </p>
              ) : (
                <div>
                  <p className="text-red-700">{result.message}</p>
                  {result.detail && result.detail.sugerencia && (
                    <div className="mt-2 p-2 bg-amber-100 rounded text-amber-800 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{result.detail.sugerencia}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button 
          type="submit" 
          disabled={uploading || files.length === 0 || !codigoMunicipio} 
          className="bg-emerald-700 hover:bg-emerald-800"
          data-testid="import-submit-btn"
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Importando...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Importar {files.length > 1 ? `${files.length} Archivos` : 'Archivo'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

export default ImportR1R2Form;
