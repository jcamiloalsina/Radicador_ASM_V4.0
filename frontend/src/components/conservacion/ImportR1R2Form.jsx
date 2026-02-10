import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import axios from 'axios';
import { Upload, Loader2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Formulario para importar archivos Excel R1/R2
 * Permite seleccionar múltiples archivos y una vigencia
 * 
 * @param {function} onSuccess - Callback cuando la importación es exitosa
 */
function ImportR1R2Form({ onSuccess }) {
  const [files, setFiles] = useState([]);
  const [vigencia, setVigencia] = useState(new Date().getFullYear().toString());
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState([]);
  const [currentFile, setCurrentFile] = useState('');

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const handleSubmit = async (e) => {
    e.preventDefault();
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
          `${API}/predios/import-excel?vigencia=${vigenciaFormato}`,
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
        const errorMsg = error.response?.data?.detail || 'Error al importar';
        importResults.push({
          fileName: file.name,
          success: false,
          message: errorMsg
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
          <li>• Puede seleccionar <strong>múltiples archivos</strong> .xlsx</li>
          <li>• Cada archivo debe contener hojas R1 y R2</li>
          <li>• Todos los archivos se importarán con la misma vigencia</li>
          <li>• El sistema detectará automáticamente el municipio de cada archivo</li>
        </ul>
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
          />
        </div>
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
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {results.map((result, idx) => (
            <div key={idx} className={`p-2 rounded-lg text-xs ${result.success ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
              <p className={`font-medium ${result.success ? 'text-emerald-800' : 'text-red-800'}`}>
                {result.success ? '✅' : '❌'} {result.fileName}
              </p>
              {result.success ? (
                <p className="text-emerald-700">
                  {result.municipio}: {result.predios?.toLocaleString()} predios
                  {result.prediosEliminados > 0 && <span className="text-red-600"> · {result.prediosEliminados} eliminados</span>}
                </p>
              ) : (
                <p className="text-red-700">{result.message}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button 
          type="submit" 
          disabled={uploading || files.length === 0} 
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
