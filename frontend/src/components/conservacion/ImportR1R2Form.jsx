import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import axios from 'axios';
import { Upload, Loader2, AlertTriangle, X, FileSpreadsheet, CheckCircle2 } from 'lucide-react';

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
 * Permite cargar múltiples archivos y asignar municipio a cada uno
 * 
 * @param {function} onSuccess - Callback cuando la importación es exitosa
 */
function ImportR1R2Form({ onSuccess }) {
  // Estado para archivos con su municipio asignado
  const [fileConfigs, setFileConfigs] = useState([]);
  const [vigencia, setVigencia] = useState(new Date().getFullYear().toString());
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState([]);
  const [currentFile, setCurrentFile] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // Función para agregar archivos
  const handleFilesSelect = (e) => {
    const newFiles = Array.from(e.target.files || []);
    
    // Crear configuración para cada archivo nuevo
    const newConfigs = newFiles.map(file => {
      // Intentar detectar el municipio desde el nombre del archivo
      let detectedMunicipio = '';
      const fileName = file.name.toLowerCase();
      
      for (const m of MUNICIPIOS) {
        if (fileName.includes(m.nombre.toLowerCase()) || fileName.includes(m.codigo)) {
          detectedMunicipio = m.codigo;
          break;
        }
      }
      
      return {
        file,
        municipio: detectedMunicipio,
        id: `${file.name}-${Date.now()}-${Math.random()}`
      };
    });
    
    setFileConfigs(prev => [...prev, ...newConfigs]);
    
    // Limpiar el input para permitir seleccionar los mismos archivos de nuevo
    e.target.value = '';
  };

  // Función para cambiar el municipio de un archivo
  const updateFileMunicipio = (id, municipio) => {
    setFileConfigs(prev => prev.map(fc => 
      fc.id === id ? { ...fc, municipio } : fc
    ));
  };

  // Función para eliminar un archivo de la lista
  const removeFile = (id) => {
    setFileConfigs(prev => prev.filter(fc => fc.id !== id));
  };

  // Verificar si todos los archivos tienen municipio asignado
  const allFilesConfigured = fileConfigs.length > 0 && fileConfigs.every(fc => fc.municipio);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (fileConfigs.length === 0) {
      toast.error('Por favor seleccione al menos un archivo Excel');
      return;
    }

    const filesWithoutMunicipio = fileConfigs.filter(fc => !fc.municipio);
    if (filesWithoutMunicipio.length > 0) {
      toast.error(`Hay ${filesWithoutMunicipio.length} archivo(s) sin municipio asignado`);
      return;
    }

    setUploading(true);
    setResults([]);
    setProgress({ current: 0, total: fileConfigs.length });

    const token = localStorage.getItem('token');
    const vigenciaFormato = `0101${vigencia}`;
    const importResults = [];

    for (let i = 0; i < fileConfigs.length; i++) {
      const config = fileConfigs[i];
      const municipioNombre = MUNICIPIOS.find(m => m.codigo === config.municipio)?.nombre || config.municipio;
      
      setCurrentFile(`${config.file.name} → ${municipioNombre}`);
      setProgress({ current: i + 1, total: fileConfigs.length });
      
      try {
        const formData = new FormData();
        formData.append('file', config.file);

        const response = await axios.post(
          `${API}/predios/import-excel?vigencia=${vigenciaFormato}&codigo_municipio=${config.municipio}`,
          formData,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        );

        importResults.push({
          fileName: config.file.name,
          municipioAsignado: municipioNombre,
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
        
        if (typeof errorDetail === 'object' && errorDetail.error) {
          errorMsg = errorDetail.error;
          if (errorDetail.municipios_en_excel) {
            errorMsg += `. Encontrados: ${errorDetail.municipios_en_excel}`;
          }
        } else if (typeof errorDetail === 'string') {
          errorMsg = errorDetail;
        }
        
        importResults.push({
          fileName: config.file.name,
          municipioAsignado: municipioNombre,
          success: false,
          message: errorMsg,
          detail: typeof errorDetail === 'object' ? errorDetail : null
        });
      }
    }

    setResults(importResults);
    setCurrentFile('');
    setUploading(false);
    setProgress({ current: 0, total: 0 });
    
    const successCount = importResults.filter(r => r.success).length;
    if (successCount > 0) {
      toast.success(`${successCount} de ${fileConfigs.length} archivos importados exitosamente`);
      // Limpiar archivos exitosos
      const failedIds = importResults.filter(r => !r.success).map((r, i) => fileConfigs[i]?.id).filter(Boolean);
      if (failedIds.length === 0) {
        setFileConfigs([]);
      }
      if (onSuccess) onSuccess();
    } else {
      toast.error('Ningún archivo fue importado exitosamente');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="import-r1r2-form">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
        <p className="font-medium text-blue-800 mb-1">Importación Masiva R1/R2</p>
        <ul className="text-blue-700 space-y-0.5 text-xs">
          <li>• Cargue todos los archivos Excel y asigne cada uno a su municipio</li>
          <li>• El sistema validará que los predios correspondan al municipio asignado</li>
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm font-medium">Vigencia (Año) *</Label>
          <select 
            value={vigencia} 
            onChange={(e) => setVigencia(e.target.value)}
            className="flex h-9 w-full mt-1 items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            data-testid="vigencia-select"
          >
            {years.map(year => (
              <option key={year} value={year.toString()}>{year}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-sm font-medium">Agregar Archivos</Label>
          <div className="mt-1">
            <Input
              type="file"
              accept=".xlsx"
              multiple
              onChange={handleFilesSelect}
              className="cursor-pointer text-xs"
              data-testid="file-input"
            />
          </div>
        </div>
      </div>

      {/* Lista de archivos con selector de municipio */}
      {fileConfigs.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-slate-100 px-3 py-2 border-b">
            <p className="text-xs font-medium text-slate-700">
              {fileConfigs.length} archivo(s) - Asigne el municipio a cada uno:
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y">
            {fileConfigs.map((config) => (
              <div key={config.id} className={`flex items-center gap-2 p-2 ${config.municipio ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                <FileSpreadsheet className={`w-4 h-4 flex-shrink-0 ${config.municipio ? 'text-emerald-600' : 'text-amber-600'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" title={config.file.name}>
                    {config.file.name}
                  </p>
                </div>
                <select
                  value={config.municipio}
                  onChange={(e) => updateFileMunicipio(config.id, e.target.value)}
                  className={`h-7 text-xs rounded border px-2 ${config.municipio ? 'border-emerald-300 bg-white' : 'border-amber-400 bg-amber-100'}`}
                  style={{ minWidth: '140px' }}
                >
                  <option value="">-- Seleccionar --</option>
                  {MUNICIPIOS.map(m => (
                    <option key={m.codigo} value={m.codigo}>{m.nombre}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeFile(config.id)}
                  className="p-1 hover:bg-red-100 rounded text-red-500"
                  title="Eliminar archivo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          {!allFilesConfigured && (
            <div className="bg-amber-100 px-3 py-2 border-t flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <p className="text-xs text-amber-700">
                {fileConfigs.filter(fc => !fc.municipio).length} archivo(s) sin municipio asignado
              </p>
            </div>
          )}
          {allFilesConfigured && (
            <div className="bg-emerald-100 px-3 py-2 border-t flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <p className="text-xs text-emerald-700">
                Todos los archivos tienen municipio asignado
              </p>
            </div>
          )}
        </div>
      )}

      {/* Progreso de importación */}
      {uploading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <p className="text-sm font-medium text-blue-800">
              Importando {progress.current} de {progress.total}
            </p>
          </div>
          <p className="text-xs text-blue-700">{currentFile}</p>
          <div className="mt-2 h-2 bg-blue-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Resultados */}
      {results.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          <p className="text-xs font-medium text-slate-600">Resultados de importación:</p>
          {results.map((result, idx) => (
            <div key={idx} className={`p-2 rounded-lg text-xs ${result.success ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-start gap-2">
                <span>{result.success ? '✅' : '❌'}</span>
                <div className="flex-1">
                  <p className={`font-medium ${result.success ? 'text-emerald-800' : 'text-red-800'}`}>
                    {result.fileName} → {result.municipioAsignado}
                  </p>
                  {result.success ? (
                    <p className="text-emerald-700">
                      {result.predios?.toLocaleString()} predios importados
                      {result.prediosNuevos > 0 && <span className="text-blue-600"> · {result.prediosNuevos} nuevos</span>}
                      {result.prediosEliminados > 0 && <span className="text-red-600"> · {result.prediosEliminados} eliminados</span>}
                    </p>
                  ) : (
                    <p className="text-red-700">{result.message}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center pt-2 border-t">
        <p className="text-xs text-slate-500">
          {fileConfigs.length > 0 
            ? `${fileConfigs.filter(fc => fc.municipio).length}/${fileConfigs.length} archivos listos`
            : 'Seleccione archivos Excel para importar'
          }
        </p>
        <Button 
          type="submit" 
          disabled={uploading || !allFilesConfigured} 
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
              Importar {fileConfigs.length > 0 ? `${fileConfigs.length} Archivo${fileConfigs.length > 1 ? 's' : ''}` : ''}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

export default ImportR1R2Form;
