import React, { useState, useMemo } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import axios from 'axios';
import { Upload, Loader2, AlertTriangle, X, FileSpreadsheet, CheckCircle2, Clock, XCircle } from 'lucide-react';

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

// Estados de cada archivo
const FILE_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  ERROR: 'error'
};

/**
 * Formulario para importar archivos Excel R1/R2
 * Permite cargar múltiples archivos y asignar municipio a cada uno
 * Con panel de progreso visual en tiempo real
 */
function ImportR1R2Form({ onSuccess }) {
  // Estado para archivos con su municipio y estado de procesamiento
  const [fileConfigs, setFileConfigs] = useState([]);
  const [vigencia, setVigencia] = useState(new Date().getFullYear().toString());
  const [uploading, setUploading] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // Contadores de estado
  const statusCounts = useMemo(() => {
    return {
      pending: fileConfigs.filter(fc => fc.status === FILE_STATUS.PENDING).length,
      processing: fileConfigs.filter(fc => fc.status === FILE_STATUS.PROCESSING).length,
      success: fileConfigs.filter(fc => fc.status === FILE_STATUS.SUCCESS).length,
      error: fileConfigs.filter(fc => fc.status === FILE_STATUS.ERROR).length,
      total: fileConfigs.length
    };
  }, [fileConfigs]);

  // Función para agregar archivos
  const handleFilesSelect = (e) => {
    const newFiles = Array.from(e.target.files || []);
    
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
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        status: FILE_STATUS.PENDING,
        result: null
      };
    });
    
    setFileConfigs(prev => [...prev, ...newConfigs]);
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
  const canStartImport = allFilesConfigured && !uploading;

  // Actualizar estado de un archivo específico
  const updateFileStatus = (id, status, result = null) => {
    setFileConfigs(prev => prev.map(fc => 
      fc.id === id ? { ...fc, status, result } : fc
    ));
  };

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
    
    // Resetear estados de archivos
    setFileConfigs(prev => prev.map(fc => ({
      ...fc,
      status: FILE_STATUS.PENDING,
      result: null
    })));

    const token = localStorage.getItem('token');
    const vigenciaFormato = `0101${vigencia}`;

    for (let i = 0; i < fileConfigs.length; i++) {
      const config = fileConfigs[i];
      const municipioNombre = MUNICIPIOS.find(m => m.codigo === config.municipio)?.nombre || config.municipio;
      
      // Marcar como procesando
      updateFileStatus(config.id, FILE_STATUS.PROCESSING);
      
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

        updateFileStatus(config.id, FILE_STATUS.SUCCESS, {
          municipioAsignado: municipioNombre,
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
        
        updateFileStatus(config.id, FILE_STATUS.ERROR, {
          municipioAsignado: municipioNombre,
          message: errorMsg,
          detail: typeof errorDetail === 'object' ? errorDetail : null
        });
      }
    }

    setUploading(false);
    
    const successCount = fileConfigs.filter(fc => fc.status === FILE_STATUS.SUCCESS).length;
    if (successCount > 0) {
      toast.success(`${successCount} de ${fileConfigs.length} archivos importados exitosamente`);
      if (onSuccess) onSuccess();
    } else {
      toast.error('Ningún archivo fue importado exitosamente');
    }
  };

  // Renderizar icono de estado
  const renderStatusIcon = (status) => {
    switch (status) {
      case FILE_STATUS.PROCESSING:
        return <Loader2 className="w-4 h-4 animate-spin text-blue-600" />;
      case FILE_STATUS.SUCCESS:
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case FILE_STATUS.ERROR:
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  // Obtener color de fondo según estado
  const getStatusBgColor = (status) => {
    switch (status) {
      case FILE_STATUS.PROCESSING:
        return 'bg-blue-50 border-blue-200';
      case FILE_STATUS.SUCCESS:
        return 'bg-emerald-50 border-emerald-200';
      case FILE_STATUS.ERROR:
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-slate-50 border-slate-200';
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
              disabled={uploading}
            />
          </div>
        </div>
      </div>

      {/* Panel de Progreso Visual - Solo visible cuando hay archivos o está procesando */}
      {fileConfigs.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          {/* Header con estadísticas */}
          <div className="bg-slate-100 px-3 py-2 border-b flex items-center justify-between">
            <p className="text-xs font-medium text-slate-700">
              {fileConfigs.length} archivo(s) cargados
            </p>
            {uploading && (
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-blue-600">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Procesando: {statusCounts.processing}
                </span>
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="w-3 h-3" />
                  Exitosos: {statusCounts.success}
                </span>
                {statusCounts.error > 0 && (
                  <span className="flex items-center gap-1 text-red-600">
                    <XCircle className="w-3 h-3" />
                    Errores: {statusCounts.error}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Barra de progreso global (solo durante importación) */}
          {uploading && (
            <div className="px-3 py-2 bg-blue-50 border-b border-blue-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-blue-800">
                  Progreso general: {statusCounts.success + statusCounts.error} de {statusCounts.total}
                </span>
                <span className="text-xs text-blue-600">
                  {Math.round(((statusCounts.success + statusCounts.error) / statusCounts.total) * 100)}%
                </span>
              </div>
              <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
                  style={{ width: `${((statusCounts.success + statusCounts.error) / statusCounts.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Lista de archivos con estado */}
          <div className="max-h-64 overflow-y-auto divide-y">
            {fileConfigs.map((config) => {
              const municipioNombre = MUNICIPIOS.find(m => m.codigo === config.municipio)?.nombre || '';
              
              return (
                <div 
                  key={config.id} 
                  className={`p-2 transition-colors duration-300 ${
                    uploading 
                      ? getStatusBgColor(config.status)
                      : config.municipio ? 'bg-emerald-50' : 'bg-amber-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {/* Icono de estado */}
                    <div className="flex-shrink-0">
                      {uploading 
                        ? renderStatusIcon(config.status)
                        : <FileSpreadsheet className={`w-4 h-4 ${config.municipio ? 'text-emerald-600' : 'text-amber-600'}`} />
                      }
                    </div>

                    {/* Nombre del archivo */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" title={config.file.name}>
                        {config.file.name}
                      </p>
                      
                      {/* Resultado de la importación */}
                      {config.result && (
                        <p className={`text-xs mt-0.5 ${
                          config.status === FILE_STATUS.SUCCESS ? 'text-emerald-700' : 'text-red-700'
                        }`}>
                          {config.status === FILE_STATUS.SUCCESS 
                            ? `${config.result.predios?.toLocaleString()} predios importados`
                            : config.result.message
                          }
                        </p>
                      )}
                    </div>

                    {/* Selector de municipio o indicador de estado */}
                    {!uploading ? (
                      <>
                        <select
                          value={config.municipio}
                          onChange={(e) => updateFileMunicipio(config.id, e.target.value)}
                          className={`h-7 text-xs rounded border px-2 ${
                            config.municipio 
                              ? 'border-emerald-300 bg-white' 
                              : 'border-amber-400 bg-amber-100'
                          }`}
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
                      </>
                    ) : (
                      <span className={`text-xs px-2 py-1 rounded ${
                        config.status === FILE_STATUS.SUCCESS 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : config.status === FILE_STATUS.ERROR
                            ? 'bg-red-100 text-red-700'
                            : config.status === FILE_STATUS.PROCESSING
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-slate-100 text-slate-600'
                      }`}>
                        {municipioNombre}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer con estado */}
          {!uploading && (
            <>
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
                    Todos los archivos tienen municipio asignado - Listo para importar
                  </p>
                </div>
              )}
            </>
          )}

          {/* Resumen final post-importación */}
          {!uploading && statusCounts.success + statusCounts.error > 0 && (
            <div className={`px-3 py-2 border-t ${
              statusCounts.error === 0 ? 'bg-emerald-100' : 'bg-amber-100'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1 text-emerald-700">
                    <CheckCircle2 className="w-3 h-3" />
                    {statusCounts.success} exitosos
                  </span>
                  {statusCounts.error > 0 && (
                    <span className="flex items-center gap-1 text-red-700">
                      <XCircle className="w-3 h-3" />
                      {statusCounts.error} con errores
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFileConfigs([])}
                  className="text-xs h-7"
                >
                  Limpiar lista
                </Button>
              </div>
            </div>
          )}
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
          disabled={!canStartImport} 
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
