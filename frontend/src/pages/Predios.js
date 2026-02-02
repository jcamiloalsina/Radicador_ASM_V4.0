import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Plus, Search, Edit, Trash2, MapPin, FileText, Building, 
  User, DollarSign, LayoutGrid, Eye, History, Download, AlertTriangle, Users,
  Clock, CheckCircle, XCircle, Bell, Map, Upload, Loader2, RefreshCw, AlertCircle, WifiOff, FileEdit, Database
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import PredioMap from '../components/PredioMap';
import useOfflineSync from '../hooks/useOfflineSync';
import { DownloadProgressBar } from '../components/OfflineComponents';
import { clearAllOfflineData } from '../utils/offlineDB';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Helper function para obtener la zona del código predial y formatear texto
const getZonaFromCodigo = (codigoPredial) => {
  if (!codigoPredial || codigoPredial.length < 7) return { codigo: '', texto: 'N/A' };
  const zonaCodigo = codigoPredial.substring(5, 7);
  let texto;
  if (zonaCodigo === '00') {
    texto = 'Rural';
  } else if (zonaCodigo === '01') {
    texto = 'Urbano';
  } else {
    texto = `Corregimiento (${zonaCodigo})`;
  }
  return { codigo: zonaCodigo, texto };
};

// Helper para obtener sector, manzana/vereda, terreno del código predial
const getCodigoPartes = (codigoPredial) => {
  if (!codigoPredial || codigoPredial.length < 21) return {};
  return {
    departamento: codigoPredial.substring(0, 2),
    municipio: codigoPredial.substring(2, 5),
    zona: codigoPredial.substring(5, 7),
    sector: codigoPredial.substring(7, 9),
    comuna: codigoPredial.substring(9, 11),
    barrio: codigoPredial.substring(11, 13),
    manzana_vereda: codigoPredial.substring(13, 17),
    terreno: codigoPredial.substring(17, 21),
  };
};

// Componente para importar archivos R1/R2 (múltiples archivos)
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
    <form onSubmit={handleSubmit} className="space-y-4">
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
        <Button type="submit" disabled={uploading || files.length === 0} className="bg-emerald-700 hover:bg-emerald-800">
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

// Componente para ver predios eliminados
function PrediosEliminadosView({ municipio }) {
  const [prediosEliminados, setPrediosEliminados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const fetchEliminados = async () => {
      try {
        const token = localStorage.getItem('token');
        const params = new URLSearchParams();
        if (municipio) params.append('municipio', municipio);
        
        const response = await axios.get(`${API}/predios/eliminados?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPrediosEliminados(response.data.predios || response.data || []);
      } catch (error) {
        console.error('Error loading eliminated predios:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchEliminados();
  }, [municipio]);

  const handleDownloadExcel = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (municipio) params.append('municipio', municipio);
      
      const response = await axios.get(`${API}/predios/eliminados/exportar-excel?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `predios_eliminados_${municipio || 'todos'}_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Excel descargado correctamente');
    } catch (error) {
      toast.error('Error al descargar Excel');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
      </div>
    );
  }

  if (prediosEliminados.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p>No hay predios eliminados para {municipio || 'este filtro'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex-1">
          <p className="text-sm text-red-800">
            <strong>{prediosEliminados.length}</strong> predios fueron eliminados en {municipio || 'todos los municipios'}
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="ml-3 border-emerald-500 text-emerald-700"
          onClick={handleDownloadExcel}
          disabled={downloading}
        >
          {downloading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
          Exportar Excel
        </Button>
      </div>
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 sticky top-0">
            <tr>
              <th className="text-left py-2 px-3">Código Predial</th>
              <th className="text-left py-2 px-3">Propietario</th>
              <th className="text-left py-2 px-3">Dirección</th>
              <th className="text-right py-2 px-3">Avalúo</th>
              <th className="text-left py-2 px-3">Radicado</th>
              <th className="text-left py-2 px-3">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {prediosEliminados.map((predio, idx) => (
              <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-2 px-3 font-mono text-xs">{predio.codigo_predial_nacional}</td>
                <td className="py-2 px-3">{predio.propietarios?.[0]?.nombre_propietario || 'N/A'}</td>
                <td className="py-2 px-3">{predio.direccion}</td>
                <td className="py-2 px-3 text-right">${(predio.avaluo || 0).toLocaleString()}</td>
                <td className="py-2 px-3 text-emerald-700 font-medium">{predio.radicado_eliminacion || '-'}</td>
                <td className="py-2 px-3 text-slate-500 text-xs">{predio.eliminado_en?.split('T')[0] || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Componente para gestionar reapariciones de predios
function ReaparicionesPendientes({ municipio = null, onUpdate }) {
  const [reapariciones, setReapariciones] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(null);
  const [justificacion, setJustificacion] = useState('');
  const [selectedReaparicion, setSelectedReaparicion] = useState(null);
  const [activeTab, setActiveTab] = useState('reapariciones');

  useEffect(() => {
    fetchReapariciones();
    fetchSolicitudes();
  }, [municipio]);

  const fetchReapariciones = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = municipio ? `?municipio=${encodeURIComponent(municipio)}` : '';
      const response = await axios.get(`${API}/predios/reapariciones/pendientes${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReapariciones(response.data.reapariciones || []);
    } catch (error) {
      console.error('Error loading reapariciones:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSolicitudes = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = municipio ? `?municipio=${encodeURIComponent(municipio)}` : '';
      const response = await axios.get(`${API}/predios/reapariciones/solicitudes-pendientes${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSolicitudes(response.data.solicitudes || []);
    } catch (error) {
      console.error('Error loading solicitudes:', error);
    }
  };

  const handleAprobar = async (reaparicion) => {
    if (!justificacion.trim()) {
      toast.error('Debe ingresar una justificación');
      return;
    }
    
    setProcesando(reaparicion.codigo_predial_nacional);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('codigo_predial', reaparicion.codigo_predial_nacional);
      formData.append('municipio', reaparicion.municipio);
      formData.append('justificacion', justificacion);
      
      await axios.post(`${API}/predios/reapariciones/aprobar`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Reaparición aprobada correctamente');
      setJustificacion('');
      setSelectedReaparicion(null);
      fetchReapariciones();
      fetchSolicitudes();
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al aprobar');
    } finally {
      setProcesando(null);
    }
  };

  const handleRechazar = async (reaparicion) => {
    if (!justificacion.trim()) {
      toast.error('Debe ingresar una justificación');
      return;
    }
    
    setProcesando(reaparicion.codigo_predial_nacional);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('codigo_predial', reaparicion.codigo_predial_nacional);
      formData.append('municipio', reaparicion.municipio);
      formData.append('justificacion', justificacion);
      
      await axios.post(`${API}/predios/reapariciones/rechazar`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Reaparición rechazada - Predio eliminado');
      setJustificacion('');
      setSelectedReaparicion(null);
      fetchReapariciones();
      fetchSolicitudes();
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al rechazar');
    } finally {
      setProcesando(null);
    }
  };

  // Aprobar solicitud de gestor
  const handleAprobarSolicitud = async (solicitud) => {
    if (!justificacion.trim()) {
      toast.error('Debe ingresar una justificación del coordinador');
      return;
    }
    
    setProcesando(solicitud.codigo_predial_nacional);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('codigo_predial', solicitud.codigo_predial_nacional);
      formData.append('municipio', solicitud.municipio);
      formData.append('justificacion', justificacion);
      
      await axios.post(`${API}/predios/reapariciones/aprobar`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Actualizar estado de la solicitud
      await axios.post(`${API}/predios/reapariciones/solicitud-responder`, {
        solicitud_id: solicitud.id,
        aprobado: true,
        comentario: justificacion
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Solicitud aprobada - Predio autorizado para creación');
      setJustificacion('');
      setSelectedReaparicion(null);
      fetchSolicitudes();
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al aprobar solicitud');
    } finally {
      setProcesando(null);
    }
  };

  const handleRechazarSolicitud = async (solicitud) => {
    if (!justificacion.trim()) {
      toast.error('Debe ingresar una justificación');
      return;
    }
    
    setProcesando(solicitud.codigo_predial_nacional);
    try {
      const token = localStorage.getItem('token');
      
      await axios.post(`${API}/predios/reapariciones/solicitud-responder`, {
        solicitud_id: solicitud.id,
        aprobado: false,
        comentario: justificacion
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Solicitud rechazada');
      setJustificacion('');
      setSelectedReaparicion(null);
      fetchSolicitudes();
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al rechazar solicitud');
    } finally {
      setProcesando(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
      </div>
    );
  }

  const totalPendientes = reapariciones.length + solicitudes.length;

  if (totalPendientes === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
        <p className="font-medium text-emerald-700">No hay reapariciones pendientes{municipio ? ` en ${municipio}` : ''}</p>
        <p className="text-sm">Todos los casos han sido revisados</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tabs para Reapariciones y Solicitudes */}
      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={activeTab === 'reapariciones' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('reapariciones')}
          className={activeTab === 'reapariciones' ? 'bg-amber-600 hover:bg-amber-700' : ''}
        >
          Reapariciones ({reapariciones.length})
        </Button>
        <Button
          variant={activeTab === 'solicitudes' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('solicitudes')}
          className={activeTab === 'solicitudes' ? 'bg-blue-600 hover:bg-blue-700' : ''}
        >
          Solicitudes de Gestores ({solicitudes.length})
        </Button>
      </div>

      {activeTab === 'reapariciones' && (
        <>
          {reapariciones.length === 0 ? (
            <div className="text-center py-6 text-slate-500">
              <CheckCircle className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
              <p className="text-sm">No hay reapariciones detectadas automáticamente</p>
            </div>
          ) : (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  <AlertTriangle className="w-4 h-4 inline mr-2" />
                  <strong>{reapariciones.length}</strong> predios eliminados reaparecieron en importaciones y requieren análisis técnico
                </p>
              </div>
              
              <div className="space-y-3">
                {reapariciones.map((reaparicion, idx) => (
                  <Card key={idx} className={`border-l-4 ${selectedReaparicion?.codigo_predial_nacional === reaparicion.codigo_predial_nacional && selectedReaparicion?.tipo === 'reaparicion' ? 'border-l-emerald-500 bg-emerald-50' : 'border-l-amber-500'}`}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="bg-amber-100 text-amber-800">Reaparición Automática</Badge>
                            <span className="font-mono text-sm">{reaparicion.codigo_predial_nacional}</span>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <p className="text-slate-500 text-xs">Municipio</p>
                              <p className="font-medium">{reaparicion.municipio}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 text-xs">Eliminado en</p>
                              <p className="font-medium text-red-600">Vigencia {reaparicion.vigencia_eliminacion}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 text-xs">Reapareció en</p>
                              <p className="font-medium text-emerald-600">Vigencia {reaparicion.vigencia_reaparicion}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 text-xs">Dirección</p>
                              <p className="font-medium">{reaparicion.direccion || 'N/A'}</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 mt-2 text-sm">
                            <div className="bg-slate-50 rounded p-2">
                              <p className="text-xs text-slate-500">Propietario anterior</p>
                              <p className="font-medium">{reaparicion.propietario_anterior}</p>
                              <p className="text-xs text-slate-400">Avalúo: ${(reaparicion.avaluo_anterior || 0).toLocaleString()}</p>
                            </div>
                            <div className="bg-emerald-50 rounded p-2">
                              <p className="text-xs text-emerald-600">Propietario actual</p>
                              <p className="font-medium">{reaparicion.propietario_actual}</p>
                              <p className="text-xs text-emerald-500">Avalúo: ${(reaparicion.avaluo_actual || 0).toLocaleString()}</p>
                            </div>
                          </div>
                          
                          {selectedReaparicion?.codigo_predial_nacional === reaparicion.codigo_predial_nacional && selectedReaparicion?.tipo === 'reaparicion' && (
                            <div className="mt-3 p-3 bg-white rounded border">
                              <Label className="text-sm">Justificación del análisis técnico *</Label>
                              <textarea
                                className="w-full mt-1 p-2 border rounded text-sm"
                                rows={2}
                                placeholder="Ingrese la justificación del análisis técnico realizado..."
                                value={justificacion}
                                onChange={(e) => setJustificacion(e.target.value)}
                              />
                              <div className="flex gap-2 mt-2">
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700"
                                  onClick={() => handleAprobar(reaparicion)}
                                  disabled={procesando === reaparicion.codigo_predial_nacional}
                                >
                                  {procesando === reaparicion.codigo_predial_nacional ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                                  Aprobar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleRechazar(reaparicion)}
                                  disabled={procesando === reaparicion.codigo_predial_nacional}
                                >
                                  {procesando === reaparicion.codigo_predial_nacional ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <XCircle className="w-4 h-4 mr-1" />}
                                  Rechazar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => { setSelectedReaparicion(null); setJustificacion(''); }}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {(selectedReaparicion?.codigo_predial_nacional !== reaparicion.codigo_predial_nacional || selectedReaparicion?.tipo !== 'reaparicion') && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="ml-3"
                            onClick={() => setSelectedReaparicion({ ...reaparicion, tipo: 'reaparicion' })}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Revisar
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {activeTab === 'solicitudes' && (
        <>
          {solicitudes.length === 0 ? (
            <div className="text-center py-6 text-slate-500">
              <CheckCircle className="w-10 h-10 mx-auto mb-2 text-blue-500" />
              <p className="text-sm">No hay solicitudes pendientes de gestores</p>
            </div>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <Users className="w-4 h-4 inline mr-2" />
                  <strong>{solicitudes.length}</strong> solicitudes de gestores para reutilizar códigos de predios eliminados
                </p>
              </div>
              
              <div className="space-y-3">
                {solicitudes.map((solicitud, idx) => (
                  <Card key={idx} className={`border-l-4 ${selectedReaparicion?.id === solicitud.id ? 'border-l-blue-500 bg-blue-50' : 'border-l-blue-300'}`}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="bg-blue-100 text-blue-800">Solicitud de Gestor</Badge>
                            <span className="font-mono text-sm">{solicitud.codigo_predial_nacional}</span>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                            <div>
                              <p className="text-slate-500 text-xs">Municipio</p>
                              <p className="font-medium">{solicitud.municipio}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 text-xs">Solicitado por</p>
                              <p className="font-medium">{solicitud.solicitado_por_nombre}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 text-xs">Fecha</p>
                              <p className="font-medium">{new Date(solicitud.fecha_solicitud).toLocaleDateString('es-CO')}</p>
                            </div>
                          </div>
                          
                          <div className="mt-2 p-2 bg-slate-50 rounded">
                            <p className="text-xs text-slate-500">Justificación del gestor:</p>
                            <p className="text-sm font-medium">{solicitud.justificacion_gestor}</p>
                          </div>
                          
                          {solicitud.datos_predio_eliminado && (
                            <div className="mt-2 p-2 bg-red-50 rounded">
                              <p className="text-xs text-red-600">Datos del predio cuando fue eliminado:</p>
                              <p className="text-sm">Dirección: {solicitud.datos_predio_eliminado.direccion || 'N/A'}</p>
                              <p className="text-sm">Avalúo: ${(solicitud.datos_predio_eliminado.avaluo || 0).toLocaleString()}</p>
                            </div>
                          )}
                          
                          {selectedReaparicion?.id === solicitud.id && (
                            <div className="mt-3 p-3 bg-white rounded border">
                              <Label className="text-sm">Respuesta del coordinador *</Label>
                              <textarea
                                className="w-full mt-1 p-2 border rounded text-sm"
                                rows={2}
                                placeholder="Ingrese la justificación de aprobación o rechazo..."
                                value={justificacion}
                                onChange={(e) => setJustificacion(e.target.value)}
                              />
                              <div className="flex gap-2 mt-2">
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700"
                                  onClick={() => handleAprobarSolicitud(solicitud)}
                                  disabled={procesando === solicitud.codigo_predial_nacional}
                                >
                                  {procesando === solicitud.codigo_predial_nacional ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                                  Aprobar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleRechazarSolicitud(solicitud)}
                                  disabled={procesando === solicitud.codigo_predial_nacional}
                                >
                                  {procesando === solicitud.codigo_predial_nacional ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <XCircle className="w-4 h-4 mr-1" />}
                                  Rechazar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => { setSelectedReaparicion(null); setJustificacion(''); }}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {selectedReaparicion?.id !== solicitud.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="ml-3"
                            onClick={() => setSelectedReaparicion(solicitud)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Revisar
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// Componente para gestionar subsanaciones de reapariciones (para gestores)
function SubsanacionesPendientes({ municipio = null, onUpdate }) {
  const { user } = useAuth();
  const [subsanaciones, setSubsanaciones] = useState([]);
  const [reenviadas, setReenviadas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [justificacion, setJustificacion] = useState('');
  const [formData, setFormData] = useState({
    direccion: '',
    avaluo: '',
    area_terreno: '',
    area_construida: ''
  });
  const [activeTab, setActiveTab] = useState('pendientes');

  const isCoordinador = user && ['coordinador', 'administrador'].includes(user.role);

  useEffect(() => {
    fetchSubsanaciones();
    if (isCoordinador) {
      fetchReenviadas();
    }
  }, [municipio]);

  const fetchSubsanaciones = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = municipio ? `?municipio=${encodeURIComponent(municipio)}` : '';
      const response = await axios.get(`${API}/predios/reapariciones/subsanaciones-pendientes${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSubsanaciones(response.data.subsanaciones || []);
    } catch (error) {
      console.error('Error loading subsanaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReenviadas = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = municipio ? `?municipio=${encodeURIComponent(municipio)}` : '';
      const response = await axios.get(`${API}/predios/reapariciones/reenviadas${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReenviadas(response.data.reenviadas || []);
    } catch (error) {
      console.error('Error loading reenviadas:', error);
    }
  };

  const handleSubsanar = async (subsanacion) => {
    if (!justificacion.trim()) {
      toast.error('Debe ingresar una justificación de la subsanación');
      return;
    }

    setProcesando(subsanacion.id);
    try {
      const token = localStorage.getItem('token');
      const formDataToSend = new FormData();
      formDataToSend.append('subsanacion_id', subsanacion.id);
      formDataToSend.append('justificacion_subsanacion', justificacion);
      if (formData.direccion) formDataToSend.append('direccion', formData.direccion);
      if (formData.avaluo) formDataToSend.append('avaluo', formData.avaluo);
      if (formData.area_terreno) formDataToSend.append('area_terreno', formData.area_terreno);
      if (formData.area_construida) formDataToSend.append('area_construida', formData.area_construida);

      await axios.post(`${API}/predios/reapariciones/subsanar`, formDataToSend, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Subsanación enviada correctamente');
      setJustificacion('');
      setFormData({ direccion: '', avaluo: '', area_terreno: '', area_construida: '' });
      setSelectedItem(null);
      fetchSubsanaciones();
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al subsanar');
    } finally {
      setProcesando(null);
    }
  };

  const handleAprobarSubsanacion = async (item) => {
    if (!justificacion.trim()) {
      toast.error('Debe ingresar una justificación');
      return;
    }

    setProcesando(item.id);
    try {
      const token = localStorage.getItem('token');
      const formDataToSend = new FormData();
      formDataToSend.append('subsanacion_id', item.id);
      formDataToSend.append('justificacion', justificacion);

      await axios.post(`${API}/predios/reapariciones/aprobar-subsanacion`, formDataToSend, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Reaparición APROBADA definitivamente');
      setJustificacion('');
      setSelectedItem(null);
      fetchReenviadas();
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al aprobar');
    } finally {
      setProcesando(null);
    }
  };

  const handleRechazarSubsanacion = async (item, definitivo = false) => {
    if (!justificacion.trim()) {
      toast.error('Debe ingresar una justificación');
      return;
    }

    setProcesando(item.id);
    try {
      const token = localStorage.getItem('token');
      const formDataToSend = new FormData();
      formDataToSend.append('subsanacion_id', item.id);
      formDataToSend.append('justificacion', justificacion);
      formDataToSend.append('rechazo_definitivo', definitivo);

      await axios.post(`${API}/predios/reapariciones/rechazar-subsanacion`, formDataToSend, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success(definitivo ? 'Reaparición RECHAZADA definitivamente' : 'Enviado a nueva subsanación');
      setJustificacion('');
      setSelectedItem(null);
      fetchReenviadas();
      fetchSubsanaciones();
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al rechazar');
    } finally {
      setProcesando(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
      </div>
    );
  }

  const totalItems = subsanaciones.length + reenviadas.length;

  if (totalItems === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
        <p className="font-medium text-emerald-700">No hay subsanaciones pendientes</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={activeTab === 'pendientes' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('pendientes')}
          className={activeTab === 'pendientes' ? 'bg-orange-600 hover:bg-orange-700' : ''}
        >
          <AlertTriangle className="w-4 h-4 mr-1" />
          Por Subsanar ({subsanaciones.length})
        </Button>
        {isCoordinador && (
          <Button
            variant={activeTab === 'reenviadas' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('reenviadas')}
            className={activeTab === 'reenviadas' ? 'bg-blue-600 hover:bg-blue-700' : ''}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Reenviadas ({reenviadas.length})
          </Button>
        )}
      </div>

      {/* Tab: Por Subsanar (Gestores) */}
      {activeTab === 'pendientes' && (
        <>
          {subsanaciones.length === 0 ? (
            <div className="text-center py-6 text-slate-500">
              <CheckCircle className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
              <p className="text-sm">No tiene subsanaciones pendientes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {subsanaciones.map((item) => (
                <Card key={item.id} className={`border-l-4 ${selectedItem?.id === item.id ? 'border-l-orange-500 bg-orange-50' : 'border-l-red-500'}`}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="bg-red-100 text-red-800">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Requiere Subsanación
                          </Badge>
                          <Badge variant="outline">Intento {item.intentos}/3</Badge>
                          <span className="font-mono text-sm">{item.codigo_predial_nacional}</span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                          <div>
                            <p className="text-slate-500 text-xs">Municipio</p>
                            <p className="font-medium">{item.municipio}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 text-xs">Rechazado por</p>
                            <p className="font-medium">{item.rechazado_por_nombre}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 text-xs">Fecha Rechazo</p>
                            <p className="font-medium">{new Date(item.fecha_rechazo).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 text-xs">Dirección</p>
                            <p className="font-medium">{item.datos_predio?.direccion || 'N/A'}</p>
                          </div>
                        </div>

                        {/* Motivo del rechazo */}
                        <div className="bg-red-50 border border-red-200 rounded p-3 mb-3">
                          <p className="text-xs text-red-600 font-medium mb-1">Motivo del Rechazo:</p>
                          <p className="text-sm text-red-800">{item.motivo_rechazo}</p>
                        </div>

                        {/* Formulario de subsanación */}
                        {selectedItem?.id === item.id && (
                          <div className="bg-white border rounded-lg p-4 mt-3 space-y-3">
                            <h4 className="font-medium text-slate-700">Subsanar y Reenviar</h4>
                            
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs">Dirección (opcional)</Label>
                                <Input
                                  value={formData.direccion}
                                  onChange={(e) => setFormData({...formData, direccion: e.target.value})}
                                  placeholder={item.datos_predio?.direccion || 'Nueva dirección'}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Avalúo (opcional)</Label>
                                <Input
                                  type="number"
                                  value={formData.avaluo}
                                  onChange={(e) => setFormData({...formData, avaluo: e.target.value})}
                                  placeholder={item.datos_predio?.avaluo?.toString() || '0'}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Área Terreno (opcional)</Label>
                                <Input
                                  type="number"
                                  value={formData.area_terreno}
                                  onChange={(e) => setFormData({...formData, area_terreno: e.target.value})}
                                  placeholder={item.datos_predio?.area_terreno?.toString() || '0'}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Área Construida (opcional)</Label>
                                <Input
                                  type="number"
                                  value={formData.area_construida}
                                  onChange={(e) => setFormData({...formData, area_construida: e.target.value})}
                                  placeholder={item.datos_predio?.area_construida?.toString() || '0'}
                                />
                              </div>
                            </div>

                            <div>
                              <Label className="text-xs">Justificación de la Subsanación *</Label>
                              <textarea
                                className="w-full border rounded p-2 text-sm min-h-[80px]"
                                value={justificacion}
                                onChange={(e) => setJustificacion(e.target.value)}
                                placeholder="Explique las correcciones realizadas y por qué el predio debe ser aprobado..."
                              />
                            </div>

                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => handleSubsanar(item)}
                                disabled={procesando === item.id}
                              >
                                {procesando === item.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                                Enviar Subsanación
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setSelectedItem(null); setJustificacion(''); setFormData({ direccion: '', avaluo: '', area_terreno: '', area_construida: '' }); }}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      {selectedItem?.id !== item.id && (
                        <Button
                          size="sm"
                          className="bg-orange-600 hover:bg-orange-700 ml-3"
                          onClick={() => setSelectedItem(item)}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Subsanar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Tab: Reenviadas (Coordinadores) */}
      {activeTab === 'reenviadas' && isCoordinador && (
        <>
          {reenviadas.length === 0 ? (
            <div className="text-center py-6 text-slate-500">
              <CheckCircle className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
              <p className="text-sm">No hay reapariciones reenviadas pendientes de revisión</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reenviadas.map((item) => (
                <Card key={item.id} className={`border-l-4 ${selectedItem?.id === item.id ? 'border-l-blue-500 bg-blue-50' : 'border-l-blue-400'}`}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="bg-blue-100 text-blue-800">
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Reenviado - Intento {item.intentos + 1}/3
                          </Badge>
                          <span className="font-mono text-sm">{item.codigo_predial_nacional}</span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                          <div>
                            <p className="text-slate-500 text-xs">Municipio</p>
                            <p className="font-medium">{item.municipio}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 text-xs">Subsanado por</p>
                            <p className="font-medium">{item.subsanado_por_nombre}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 text-xs">Fecha Subsanación</p>
                            <p className="font-medium">{new Date(item.fecha_subsanacion).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 text-xs">Dirección</p>
                            <p className="font-medium">{item.datos_predio?.direccion || 'N/A'}</p>
                          </div>
                        </div>

                        {/* Justificación de subsanación */}
                        <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3">
                          <p className="text-xs text-blue-600 font-medium mb-1">Justificación de Subsanación:</p>
                          <p className="text-sm text-blue-800">{item.justificacion_subsanacion}</p>
                        </div>

                        {/* Historial */}
                        {item.historial && item.historial.length > 0 && (
                          <details className="mb-3">
                            <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                              Ver historial ({item.historial.length} acciones)
                            </summary>
                            <div className="mt-2 space-y-1">
                              {item.historial.map((h, idx) => (
                                <div key={idx} className="text-xs bg-slate-50 p-2 rounded">
                                  <span className="font-medium">{h.accion}</span> - {h.usuario} ({new Date(h.fecha).toLocaleString()})
                                  {h.motivo && <p className="text-slate-600 mt-1">{h.motivo}</p>}
                                </div>
                              ))}
                            </div>
                          </details>
                        )}

                        {/* Formulario de revisión */}
                        {selectedItem?.id === item.id && (
                          <div className="bg-white border rounded-lg p-4 mt-3 space-y-3">
                            <h4 className="font-medium text-slate-700">Revisar Subsanación</h4>

                            <div>
                              <Label className="text-xs">Justificación del análisis técnico *</Label>
                              <textarea
                                className="w-full border rounded p-2 text-sm min-h-[80px]"
                                value={justificacion}
                                onChange={(e) => setJustificacion(e.target.value)}
                                placeholder="Ingrese la justificación de su decisión..."
                              />
                            </div>

                            <div className="flex gap-2 flex-wrap">
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => handleAprobarSubsanacion(item)}
                                disabled={procesando === item.id}
                              >
                                {procesando === item.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                                Aprobar
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRechazarSubsanacion(item, false)}
                                disabled={procesando === item.id}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Rechazar (nueva subsanación)
                              </Button>
                              {item.intentos >= 2 && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="bg-red-800 hover:bg-red-900"
                                  onClick={() => handleRechazarSubsanacion(item, true)}
                                  disabled={procesando === item.id}
                                >
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  Rechazar DEFINITIVO
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setSelectedItem(null); setJustificacion(''); }}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      {selectedItem?.id !== item.id && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-3"
                          onClick={() => setSelectedItem(item)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Revisar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function Predios() {
  const { user } = useAuth();
  const { addListener, isConnected } = useWebSocket() || {};
  
  // Hook de sincronización offline para Conservación
  const { 
    isOnline, 
    isSyncing, 
    offlineStats, 
    downloadForOffline, 
    saveOfflineChange,
    forceSync,
    getPrediosOffline
  } = useOfflineSync(null, 'conservacion');
  
  // Estado para la barra de progreso de descarga offline
  const [downloadProgress, setDownloadProgress] = useState({
    isDownloading: false,
    current: 0,
    total: 0,
    label: ''
  });
  
  // Comunicaciones y Empresa solo pueden ver, no pueden crear/editar/eliminar predios
  const canModifyPredios = user && !['usuario', 'comunicaciones', 'empresa'].includes(user.role);
  
  const [predios, setPredios] = useState([]);
  const [catalogos, setCatalogos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [filterMunicipio, setFilterMunicipio] = useState('');
  const [filterVigencia, setFilterVigencia] = useState(String(new Date().getFullYear()));
  const [filterGeometria, setFilterGeometria] = useState(''); // '', 'con', 'sin'
  const [vigenciasData, setVigenciasData] = useState({});
  const [showDashboard, setShowDashboard] = useState(true);
  const [prediosStats, setPrediosStats] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showDeletedDialog, setShowDeletedDialog] = useState(false);
  const [showPendientesDialog, setShowPendientesDialog] = useState(false);
  const [showReaparicionesDialog, setShowReaparicionesDialog] = useState(false);
  const [showSubsanacionesDialog, setShowSubsanacionesDialog] = useState(false);
  const [subsanacionesConteo, setSubsanacionesConteo] = useState(0);
  const [reaparicionesConteo, setReaparicionesConteo] = useState({});
  const [gdbStats, setGdbStats] = useState(null); // Estadísticas de geometrías GDB
  const [revinculandoGdb, setRevinculandoGdb] = useState(false); // Estado de revinculación GDB
  const [selectedPredio, setSelectedPredio] = useState(null);
  const [prediosEliminados, setPrediosEliminados] = useState([]);
  const [cambiosPendientes, setCambiosPendientes] = useState([]);
  const [cambiosHistorial, setCambiosHistorial] = useState([]);
  const [historialTab, setHistorialTab] = useState('pendientes');
  const [cambiosStats, setCambiosStats] = useState(null);
  const [terrenoInfo, setTerrenoInfo] = useState(null);
  const [estructuraCodigo, setEstructuraCodigo] = useState(null);
  const [verificacionCodigo, setVerificacionCodigo] = useState(null);
  const [ultimaManzanaInfo, setUltimaManzanaInfo] = useState(null); // Info de última manzana por sector
  
  // Paginación del lado del cliente para mejorar rendimiento
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100; // Mostrar 100 predios por página
  
  const [codigoManual, setCodigoManual] = useState({
    zona: '00',          // Posición 6-7 (2 dígitos) - 00=rural, 01=urbano, 02-99=corregimiento
    sector: '00',        // Posición 8-9 (2 dígitos)
    comuna: '00',        // Posición 10-11 (2 dígitos)
    barrio: '00',        // Posición 12-13 (2 dígitos)
    manzana_vereda: '0000', // Posición 14-17 (4 dígitos)
    terreno: '0001',     // Posición 18-21 (4 dígitos)
    condicion: '0',      // Posición 22 (1 dígito)
    edificio: '00',      // Posición 23-24 (2 dígitos)
    piso: '00',          // Posición 25-26 (2 dígitos)
    unidad: '0000'       // Posición 27-30 (4 dígitos)
  });
  
  // Estado para códigos homologados
  const [showCodigosDialog, setShowCodigosDialog] = useState(false);
  const [codigosStats, setCodigosStats] = useState([]);
  const [loadingCodigos, setLoadingCodigos] = useState(false);
  const [uploadingCodigos, setUploadingCodigos] = useState(false);
  const [siguienteCodigoHomologado, setSiguienteCodigoHomologado] = useState(null);
  const [codigosMunicipioSeleccionado, setCodigosMunicipioSeleccionado] = useState('');
  const [codigosFileSelected, setCodigosFileSelected] = useState(null);
  const [codigosUsados, setCodigosUsados] = useState([]);
  const [loadingCodigosUsados, setLoadingCodigosUsados] = useState(false);
  const [codigosUsadosMunicipio, setCodigosUsadosMunicipio] = useState('');
  const [recalculandoCodigos, setRecalculandoCodigos] = useState(false);
  const [diagnosticoCodigos, setDiagnosticoCodigos] = useState(null);
  const [loadingDiagnostico, setLoadingDiagnostico] = useState(false);
  const [showDiagnosticoDialog, setShowDiagnosticoDialog] = useState(false);
  const [forzarDisponibles, setForzarDisponibles] = useState(false);
  
  // Estado para múltiples propietarios
  const [propietarios, setPropietarios] = useState([{
    nombre_propietario: '',
    tipo_documento: 'C',
    numero_documento: '',
    estado_civil: ''
  }]);
  
  // Estado para mostrar diálogo de confirmación al cerrar sin completar
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  
  // Estado para múltiples zonas físicas (R2)
  const [zonasFisicas, setZonasFisicas] = useState([{
    zona_fisica: '0',
    zona_economica: '0',
    area_terreno: '0',
    habitaciones: '0',
    banos: '0',
    locales: '0',
    pisos: '1',
    puntaje: '0',
    area_construida: '0'
  }]);
  
  // Estados para el nuevo flujo "Crear Predio" con workflow
  const [radicadoNumero, setRadicadoNumero] = useState(''); // Solo los 4 dígitos (XXXX)
  const [radicadoInfo, setRadicadoInfo] = useState(null); // Info del radicado buscado
  const [buscandoRadicado, setBuscandoRadicado] = useState(false);
  const [peticionesRelacionadas, setPeticionesRelacionadas] = useState([]); // IDs de peticiones
  const [peticionesDisponibles, setPeticionesDisponibles] = useState([]); // Lista de peticiones para seleccionar
  const [observacionesCreacion, setObservacionesCreacion] = useState('');
  const [usarNuevoFlujo, setUsarNuevoFlujo] = useState(false); // Toggle para usar el nuevo flujo
  
  const [formData, setFormData] = useState({
    municipio: '',
    zona: '00',
    sector: '01',
    manzana_vereda: '0000',
    condicion_predio: '0000',
    predio_horizontal: '0000',
    nombre_propietario: '',
    tipo_documento: 'C',
    numero_documento: '',
    estado_civil: '',
    direccion: '',
    comuna: '0',
    destino_economico: 'A',
    area_terreno: '',
    area_construida: '0',
    avaluo: '',
    tipo_mutacion: '',
    numero_resolucion: '',
    fecha_resolucion: '',
    // R2
    matricula_inmobiliaria: '',
    zona_fisica_1: '0',
    zona_economica_1: '0',
    area_terreno_1: '0',
    habitaciones_1: '0',
    banos_1: '0',
    locales_1: '0',
    pisos_1: '1',
    puntaje_1: '0',
    area_construida_1: '0'
  });
  
  // Funciones para manejar múltiples propietarios
  const agregarPropietario = () => {
    setPropietarios([...propietarios, {
      nombre_propietario: '',
      tipo_documento: 'C',
      numero_documento: '',
      estado_civil: ''
    }]);
  };
  
  const eliminarPropietario = (index) => {
    if (propietarios.length > 1) {
      setPropietarios(propietarios.filter((_, i) => i !== index));
    }
  };
  
  const actualizarPropietario = (index, campo, valor) => {
    setPropietarios(prev => {
      const nuevos = [...prev];
      nuevos[index] = { ...nuevos[index], [campo]: valor };
      return nuevos;
    });
  };
  
  // Funciones para manejar múltiples zonas físicas
  const agregarZonaFisica = () => {
    setZonasFisicas([...zonasFisicas, {
      zona_fisica: '0',
      zona_economica: '0',
      area_terreno: '0',
      habitaciones: '0',
      banos: '0',
      locales: '0',
      pisos: '1',
      puntaje: '0',
      area_construida: '0'
    }]);
  };
  
  const eliminarZonaFisica = (index) => {
    if (zonasFisicas.length > 1) {
      setZonasFisicas(zonasFisicas.filter((_, i) => i !== index));
    }
  };
  
  const actualizarZonaFisica = (index, campo, valor) => {
    setZonasFisicas(prev => {
      const nuevas = [...prev];
      nuevas[index] = { ...nuevas[index], [campo]: valor };
      return nuevas;
    });
  };

  // Estado para asignar a otro gestor
  const [gestoresDisponibles, setGestoresDisponibles] = useState([]);
  const [gestorAsignado, setGestorAsignado] = useState('');
  
  // Estado para seleccionar radicado asociado a modificaciones
  const [peticionesDisponibles, setPeticionesDisponibles] = useState([]);
  const [radicadoSeleccionado, setRadicadoSeleccionado] = useState('');

  // Cargar gestores disponibles
  const fetchGestoresDisponibles = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Filtrar solo gestores y staff
      const gestores = res.data.filter(u => 
        ['gestor', 'gestor_auxiliar', 'atencion_usuario', 'coordinador'].includes(u.role) && 
        u.id !== user?.id
      );
      setGestoresDisponibles(gestores);
    } catch (error) {
      console.log('Error cargando gestores');
    }
  };
  
  // Cargar peticiones disponibles para asociar a modificaciones
  const fetchPeticionesDisponibles = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/petitions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Filtrar peticiones en estado asignado o en_revision (activas)
      const peticiones = res.data.filter(p => 
        ['asignado', 'en_revision'].includes(p.estado)
      ).sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion));
      setPeticionesDisponibles(peticiones);
    } catch (error) {
      console.log('Error cargando peticiones');
    }
  };

  useEffect(() => {
    fetchCatalogos();
    fetchVigencias();
    fetchPrediosStats();
    fetchCambiosStats();
    fetchReaparicionesConteo();
    fetchSubsanacionesConteo();
    fetchGdbStats();
    fetchGestoresDisponibles();
    fetchPeticionesDisponibles();
  }, []);

  useEffect(() => {
    if (filterMunicipio && filterVigencia) {
      fetchPredios();
      setShowDashboard(false);
    }
  }, [filterMunicipio, filterVigencia, filterGeometria]);

  // Auto-seleccionar municipio cuando se abre el diálogo
  useEffect(() => {
    if (showCreateDialog && filterMunicipio) {
      setFormData(prev => ({ ...prev, municipio: filterMunicipio }));
    }
  }, [showCreateDialog, filterMunicipio]);

  // Obtener info del terreno cuando cambia la ubicación
  useEffect(() => {
    if (formData.municipio && showCreateDialog) {
      fetchTerrenoInfo();
      fetchEstructuraCodigo();
    }
  }, [formData.municipio, showCreateDialog]);

  // Sugerir código cuando cambian los campos del código manual
  useEffect(() => {
    if (formData.municipio && showCreateDialog && codigoManual.zona && codigoManual.manzana_vereda) {
      fetchSugerenciaCodigo();
    }
  }, [codigoManual.zona, codigoManual.sector, codigoManual.comuna, codigoManual.barrio, codigoManual.manzana_vereda, formData.municipio, showCreateDialog]);

  // Obtener última manzana cuando cambia zona o sector
  useEffect(() => {
    if (formData.municipio && showCreateDialog && codigoManual.zona && codigoManual.sector) {
      fetchUltimaManzana();
    }
  }, [codigoManual.zona, codigoManual.sector, formData.municipio, showCreateDialog]);

  // === WEBSOCKET LISTENER FOR REAL-TIME SYNC ===
  // Escuchar notificaciones de cambios en predios para sincronización automática
  useEffect(() => {
    if (!addListener) return;
    
    const handleWebSocketMessage = (message) => {
      if (message.type === 'cambio_predio') {
        console.log('[Predios] WebSocket: Cambio de predio notificado', message);
        
        // Si el cambio es del municipio actual, actualizar datos
        if (message.municipio === filterMunicipio || !filterMunicipio) {
          // Actualizar estadísticas de cambios
          fetchCambiosStats();
          
          // Si estamos viendo el historial, actualizarlo también
          if (showPendientesDialog && historialTab === 'historial') {
            fetchCambiosHistorial();
          }
          
          // Si el cambio fue aprobado y estamos en el municipio afectado, sugerir sincronizar
          if (message.action === 'aprobado' && message.municipio === filterMunicipio) {
            // Auto-sincronizar los datos del municipio
            fetchPredios();
          }
        }
      }
    };
    
    // Agregar listener
    const removeListener = addListener(handleWebSocketMessage);
    
    // También escuchar el evento personalizado desde el toast
    const handleSyncEvent = (e) => {
      if (e.detail?.municipio === filterMunicipio) {
        fetchPredios();
        toast.success('Datos sincronizados');
      }
    };
    window.addEventListener('syncPredios', handleSyncEvent);
    
    return () => {
      removeListener();
      window.removeEventListener('syncPredios', handleSyncEvent);
    };
  }, [addListener, filterMunicipio, showPendientesDialog, historialTab]);

  // Función para obtener la última manzana de un sector
  const fetchUltimaManzana = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        zona: codigoManual.zona,
        sector: codigoManual.sector
      });
      const res = await axios.get(`${API}/predios/ultima-manzana/${formData.municipio}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUltimaManzanaInfo(res.data);
    } catch (error) {
      console.log('Error obteniendo última manzana');
      setUltimaManzanaInfo(null);
    }
  };

  // Función para obtener la estructura del código según el municipio
  const fetchEstructuraCodigo = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios/estructura-codigo/${formData.municipio}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEstructuraCodigo(res.data);
    } catch (error) {
      console.log('Error obteniendo estructura de código');
    }
  };

  // Función para obtener sugerencia de próximo código disponible
  const fetchSugerenciaCodigo = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        zona: codigoManual.zona,
        sector: codigoManual.sector,
        comuna: codigoManual.comuna,
        barrio: codigoManual.barrio,
        manzana_vereda: codigoManual.manzana_vereda
      });
      const res = await axios.get(`${API}/predios/sugerir-codigo/${formData.municipio}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTerrenoInfo(res.data);
      // Auto-llenar el terreno sugerido
      if (res.data.siguiente_terreno) {
        setCodigoManual(prev => ({ ...prev, terreno: res.data.siguiente_terreno }));
      }
    } catch (error) {
      console.log('Error obteniendo sugerencia de código');
    }
  };

  // Función para verificar el código completo
  const verificarCodigoCompleto = async () => {
    if (!estructuraCodigo) return;
    
    const codigoCompleto = construirCodigoCompleto();
    if (codigoCompleto.length !== 30) {
      toast.error('El código debe tener exactamente 30 dígitos');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios/verificar-codigo-completo/${codigoCompleto}?municipio=${formData.municipio}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVerificacionCodigo(res.data);
    } catch (error) {
      toast.error('Error al verificar código');
    }
  };

  // Construir el código completo de 30 dígitos
  const construirCodigoCompleto = () => {
    if (!estructuraCodigo) return '';
    const prefijo = estructuraCodigo.prefijo_fijo; // 5 dígitos (depto + muni)
    return `${prefijo}${codigoManual.zona}${codigoManual.sector}${codigoManual.comuna}${codigoManual.barrio}${codigoManual.manzana_vereda}${codigoManual.terreno}${codigoManual.condicion}${codigoManual.edificio}${codigoManual.piso}${codigoManual.unidad}`;
  };
  
  // Función para manejar cambios en campos del código con validación
  const handleCodigoChange = (campo, valor, maxLength) => {
    // Solo permitir números
    const soloNumeros = valor.replace(/[^0-9]/g, '');
    // Limitar al máximo de dígitos
    const valorFinal = soloNumeros.slice(0, maxLength);
    setCodigoManual(prev => ({ ...prev, [campo]: valorFinal }));
  };

  // Verificar si hay datos ingresados en el formulario
  const tieneDatasSinGuardar = () => {
    // Verificar si se ha modificado algo del código
    const codigoModificado = codigoManual.zona !== '00' || 
                             codigoManual.sector !== '00' || 
                             codigoManual.comuna !== '00' ||
                             codigoManual.barrio !== '00' ||
                             codigoManual.manzana_vereda !== '0000' ||
                             codigoManual.terreno !== '0001';
    
    // Verificar si hay datos de propietario
    const tienePropietario = propietarios[0]?.nombre_propietario?.trim() || 
                             propietarios[0]?.numero_documento?.trim();
    
    // Verificar si hay datos del predio
    const tieneDatosPredio = formData.direccion?.trim() || 
                             formData.area_terreno || 
                             formData.avaluo;
    
    return codigoModificado || tienePropietario || tieneDatosPredio;
  };

  // Manejar intento de cerrar el diálogo
  const handleCloseDialog = (open) => {
    if (!open && tieneDatasSinGuardar() && !gestorAsignado) {
      // Hay datos sin guardar y no se ha asignado a otro gestor
      setShowConfirmClose(true);
    } else {
      setShowCreateDialog(open);
      if (!open) {
        resetForm();
      }
    }
  };

  // Confirmar cierre sin guardar
  const confirmarCierreSinGuardar = () => {
    setShowConfirmClose(false);
    setShowCreateDialog(false);
    resetForm();
  };

  // Asignar a gestor y cerrar
  const asignarYCerrar = () => {
    setShowConfirmClose(false);
    // Enfocar en el selector de gestor
    toast.info('Por favor seleccione un gestor para continuar con el diligenciamiento', { duration: 4000 });
  };

  // === FUNCIONES PARA CÓDIGOS HOMOLOGADOS ===
  
  // Cargar estadísticas de códigos homologados
  const fetchCodigosStats = async () => {
    setLoadingCodigos(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/codigos-homologados/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCodigosStats(res.data.stats || []);
    } catch (error) {
      console.error('Error cargando stats de códigos:', error);
    } finally {
      setLoadingCodigos(false);
    }
  };
  
  // Cargar archivo Excel de códigos homologados
  const handleUploadCodigos = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Guardar el archivo seleccionado y mostrar el selector de municipio
    setCodigosFileSelected(file);
    e.target.value = '';
  };
  
  // Confirmar carga del archivo con el municipio seleccionado
  const confirmarCargaCodigos = async () => {
    if (!codigosFileSelected) return;
    
    setUploadingCodigos(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', codigosFileSelected);
      
      // Si hay un municipio seleccionado, agregarlo
      if (codigosMunicipioSeleccionado) {
        formData.append('municipio', codigosMunicipioSeleccionado);
      }
      
      const res = await axios.post(`${API}/codigos-homologados/cargar`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        timeout: 300000 // 5 minutos de timeout para archivos grandes
      });
      
      toast.success(`${res.data.codigos_insertados.toLocaleString()} códigos cargados`, { duration: 5000 });
      toast.info(
        `${res.data.codigos_usados?.toLocaleString() || 0} ya asignados a predios, ${res.data.codigos_disponibles?.toLocaleString() || 0} disponibles`,
        { duration: 8000 }
      );
      if (res.data.codigos_duplicados > 0) {
        toast.warning(`${res.data.codigos_duplicados.toLocaleString()} códigos duplicados ignorados`);
      }
      
      // Limpiar estado y recargar estadísticas
      setCodigosFileSelected(null);
      setCodigosMunicipioSeleccionado('');
      fetchCodigosStats();
    } catch (error) {
      console.error('Error cargando códigos:', error);
      
      // Mejor manejo de errores
      let errorMessage = 'Error cargando códigos';
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMessage = 'El archivo es muy grande o el servidor tardó demasiado. Por favor intente nuevamente.';
      } else if (!error.response) {
        errorMessage = 'Error de conexión. Verifique su conexión a internet.';
      }
      
      toast.error(errorMessage);
    } finally {
      setUploadingCodigos(false);
    }
  };
  
  // Recalcular códigos de un municipio
  const recalcularCodigosMunicipio = async (municipio) => {
    if (!municipio) {
      toast.error('Seleccione un municipio');
      return;
    }
    
    setRecalculandoCodigos(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API}/codigos-homologados/recalcular/${encodeURIComponent(municipio)}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 180000 // 3 minutos
      });
      
      toast.success(`${res.data.codigos_liberados} códigos liberados correctamente`, { duration: 5000 });
      if (res.data.codigos_marcados_usados > 0) {
        toast.info(`${res.data.codigos_marcados_usados} códigos marcados como usados`);
      }
      
      // Recargar estadísticas
      fetchCodigosStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error recalculando códigos');
    } finally {
      setRecalculandoCodigos(false);
    }
  };
  
  // Diagnosticar códigos de un municipio
  const diagnosticarCodigosMunicipio = async (municipio) => {
    if (!municipio) {
      toast.error('Seleccione un municipio');
      return;
    }
    
    setLoadingDiagnostico(true);
    setDiagnosticoCodigos(null);
    setShowDiagnosticoDialog(true);
    
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/codigos-homologados/diagnostico/${encodeURIComponent(municipio)}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 120000
      });
      
      setDiagnosticoCodigos(res.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error obteniendo diagnóstico');
      setShowDiagnosticoDialog(false);
    } finally {
      setLoadingDiagnostico(false);
    }
  };
  
  // Cancelar carga de archivo
  const cancelarCargaCodigos = () => {
    setCodigosFileSelected(null);
    setCodigosMunicipioSeleccionado('');
    setForzarDisponibles(false);
  };
  
  // Obtener códigos usados por municipio
  const fetchCodigosUsados = async (municipio) => {
    if (!municipio) {
      setCodigosUsados([]);
      return;
    }
    
    setLoadingCodigosUsados(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/codigos-homologados/usados/${encodeURIComponent(municipio)}?limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCodigosUsados(res.data.codigos || []);
    } catch (error) {
      console.error('Error obteniendo códigos usados:', error);
      setCodigosUsados([]);
    } finally {
      setLoadingCodigosUsados(false);
    }
  };
  
  // Obtener siguiente código homologado para un municipio
  const fetchSiguienteCodigoHomologado = async (municipio) => {
    if (!municipio) {
      setSiguienteCodigoHomologado(null);
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/codigos-homologados/siguiente/${encodeURIComponent(municipio)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSiguienteCodigoHomologado(res.data);
    } catch (error) {
      console.error('Error obteniendo siguiente código:', error);
      setSiguienteCodigoHomologado(null);
    }
  };
  
  // Efecto para cargar el siguiente código cuando cambia el municipio en el formulario de creación
  useEffect(() => {
    if (showCreateDialog && formData.municipio) {
      fetchSiguienteCodigoHomologado(formData.municipio);
    }
  }, [showCreateDialog, formData.municipio]);

  // === FUNCIONES PARA EL NUEVO FLUJO "CREAR PREDIO" ===
  
  // Buscar radicado por número (solo los 4 dígitos)
  const buscarRadicado = async (numero) => {
    if (!numero || numero.length < 1) {
      setRadicadoInfo(null);
      return;
    }
    
    setBuscandoRadicado(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios-nuevos/buscar-radicado/${numero}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRadicadoInfo(res.data);
      if (res.data.encontrado) {
        toast.success('Radicado encontrado');
      }
    } catch (error) {
      setRadicadoInfo({ encontrado: false, mensaje: 'Error al buscar radicado' });
    } finally {
      setBuscandoRadicado(false);
    }
  };
  
  // Cargar peticiones disponibles para vincular
  const fetchPeticionesDisponibles = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/petitions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Filtrar solo peticiones activas (no finalizadas)
      const peticionesActivas = (res.data || []).filter(p => 
        p.estado !== 'finalizado' && p.estado !== 'rechazado'
      );
      setPeticionesDisponibles(peticionesActivas);
    } catch (error) {
      console.log('Error cargando peticiones');
    }
  };
  
  // Efecto para cargar peticiones cuando se abre el diálogo de crear
  useEffect(() => {
    if (showCreateDialog && usarNuevoFlujo) {
      fetchPeticionesDisponibles();
    }
  }, [showCreateDialog, usarNuevoFlujo]);
  
  // Toggle petición relacionada
  const togglePeticionRelacionada = (peticionId) => {
    setPeticionesRelacionadas(prev => {
      if (prev.includes(peticionId)) {
        return prev.filter(id => id !== peticionId);
      } else {
        return [...prev, peticionId];
      }
    });
  };

  const fetchCatalogos = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios/catalogos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCatalogos(res.data);
    } catch (error) {
      toast.error('Error al cargar catálogos');
    }
  };

  const fetchVigencias = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios/vigencias`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVigenciasData(res.data);
    } catch (error) {
      console.log('Vigencias no disponibles');
    }
  };

  const fetchPrediosStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios/stats/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPrediosStats(res.data);
    } catch (error) {
      console.log('Stats no disponibles');
    } finally {
      setLoading(false);
    }
  };

  // Función para sincronizar - BORRA TODO EL CACHE y guarda solo los datos nuevos
  const syncMunicipioManual = async (municipio) => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      params.append('municipio', municipio);
      // SIEMPRE filtrar por vigencia actual
      const vigenciaActual = filterVigencia || String(new Date().getFullYear());
      params.append('vigencia', vigenciaActual);
      
      setDownloadProgress({
        isDownloading: true,
        current: 0,
        total: 100,
        label: `Limpiando cache anterior...`
      });
      
      // PASO 1: Borrar TODO el cache offline primero
      await clearAllOfflineData();
      
      setDownloadProgress({
        isDownloading: true,
        current: 20,
        total: 100,
        label: `Descargando ${municipio} (Vigencia ${vigenciaActual})...`
      });
      
      // PASO 2: Descargar datos del servidor
      const res = await axios.get(`${API}/predios?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const serverPredios = res.data.predios || [];
      const totalPredios = serverPredios.length;
      
      setDownloadProgress({
        isDownloading: true,
        current: 60,
        total: 100,
        label: `Guardando ${totalPredios.toLocaleString()} predios...`
      });
      
      // PASO 3: Guardar solo los datos nuevos
      await downloadForOffline(serverPredios, null, municipio);
      
      // Actualizar la UI
      if (filterMunicipio === municipio) {
        let filtered = serverPredios;
        if (search) {
          const searchLower = search.toLowerCase();
          filtered = filtered.filter(p => 
            p.codigo_predial_nacional?.toLowerCase().includes(searchLower) ||
            p.direccion?.toLowerCase().includes(searchLower) ||
            p.propietarios?.some(prop => prop.nombre_propietario?.toLowerCase().includes(searchLower))
          );
        }
        if (filterGeometria === 'con') {
          filtered = filtered.filter(p => p.tiene_geometria_gdb === true);
        } else if (filterGeometria === 'sin') {
          filtered = filtered.filter(p => p.tiene_geometria_gdb !== true);
        }
        
        setPredios(filtered);
        setTotal(filtered.length);
      }
      
      setDownloadProgress({ isDownloading: false, current: 100, total: 100, label: '' });
      toast.success(`✅ ${municipio} (${vigenciaActual}): ${totalPredios.toLocaleString()} predios sincronizados`, { duration: 3000 });
      
    } catch (error) {
      console.error('Error sincronizando:', error);
      setDownloadProgress({ isDownloading: false, current: 0, total: 0, label: '' });
      toast.error('Error al sincronizar');
    }
  };

  // Función helper para ordenar predios por código predial nacional
  const sortPrediosByCNP = (prediosArray) => {
    return [...prediosArray].sort((a, b) => {
      const cnpA = a.codigo_predial_nacional || '';
      const cnpB = b.codigo_predial_nacional || '';
      return cnpA.localeCompare(cnpB);
    });
  };

  // Función para forzar recarga desde servidor (ignora caché)
  const forceRefreshPredios = async () => {
    await fetchPrediosFromServer();
  };

  // Función interna que carga desde el servidor
  const fetchPrediosFromServer = async () => {
    try {
      setLoading(true);
      
      // Si está offline, mostrar mensaje
      if (!navigator.onLine) {
        toast.warning('No hay conexión. Use los datos offline disponibles.');
        setLoading(false);
        return;
      }
      
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (filterMunicipio) params.append('municipio', filterMunicipio);
      if (filterVigencia) params.append('vigencia', filterVigencia);
      if (search) params.append('search', search);
      if (filterGeometria === 'con') params.append('tiene_geometria', 'true');
      if (filterGeometria === 'sin') params.append('tiene_geometria', 'false');
      
      const res = await axios.get(`${API}/predios?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const prediosRecibidos = res.data.predios || [];
      const prediosFiltrados = filterMunicipio 
        ? prediosRecibidos.filter(p => p.municipio === filterMunicipio || p.nombre_municipio === filterMunicipio)
        : prediosRecibidos;
      
      // Ordenar por CNP antes de guardar
      const prediosOrdenados = sortPrediosByCNP(prediosFiltrados);
      setPredios(prediosOrdenados);
      setTotal(prediosOrdenados.length);
      setCurrentPage(1); // Resetear a página 1
      
      // IMPORTANTE: Solo actualizar caché offline para la vigencia ACTUAL (año actual)
      // Las vigencias anteriores se consultan del servidor pero NO se guardan en caché
      const vigenciaActual = String(new Date().getFullYear());
      const esVigenciaActual = !filterVigencia || String(filterVigencia) === vigenciaActual;
      
      if (filterMunicipio && prediosOrdenados.length > 0 && esVigenciaActual) {
        await downloadForOffline(prediosOrdenados, null, filterMunicipio);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error cargando predios desde servidor:', error);
      setLoading(false);
    }
  };

  const fetchPredios = async () => {
    try {
      // OPTIMIZACIÓN: Si hay municipio filtrado, primero mostrar datos del cache
      if (filterMunicipio) {
        const cachedPredios = await getPrediosOffline(filterMunicipio);
        if (cachedPredios && cachedPredios.length > 0) {
          // Aplicar filtros localmente
          let filtered = cachedPredios;
          if (filterVigencia) {
            filtered = filtered.filter(p => String(p.vigencia) === String(filterVigencia));
          }
          if (search) {
            const searchLower = search.toLowerCase();
            filtered = filtered.filter(p => 
              p.codigo_predial_nacional?.toLowerCase().includes(searchLower) ||
              p.codigo_homologado?.toLowerCase().includes(searchLower) ||
              p.direccion?.toLowerCase().includes(searchLower) ||
              p.propietarios?.some(prop => prop.nombre_propietario?.toLowerCase().includes(searchLower)) ||
              p.propietarios?.some(prop => prop.numero_documento?.toLowerCase().includes(searchLower)) ||
              p.r2_registros?.some(r2 => r2.matricula_inmobiliaria?.toLowerCase().includes(searchLower))
            );
          }
          if (filterGeometria === 'con') {
            filtered = filtered.filter(p => p.tiene_geometria_gdb === true);
          } else if (filterGeometria === 'sin') {
            filtered = filtered.filter(p => p.tiene_geometria_gdb !== true);
          }
          
          // Ordenar por CNP antes de mostrar
          const prediosOrdenados = sortPrediosByCNP(filtered);
          
          // Mostrar datos del cache inmediatamente - SIN sincronizar automáticamente
          setPredios(prediosOrdenados);
          setTotal(prediosOrdenados.length);
          setLoading(false);
          
          // Si está offline, terminar aquí
          if (!navigator.onLine) {
            toast.info(`Modo offline: ${prediosOrdenados.length} predios desde cache`, { duration: 2000 });
          }
          // Ya NO sincronizamos en segundo plano automáticamente
          // El usuario puede usar el botón "Sincronizar" cuando quiera
          return;
        }
      }
      
      // Si no hay cache o no hay filtro de municipio, cargar normalmente
      setLoading(true);
      
      // Si está offline y no hay cache, mostrar mensaje
      if (!navigator.onLine) {
        toast.warning('No hay datos offline disponibles para este municipio');
        setPredios([]);
        setTotal(0);
        return;
      }
      
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (filterMunicipio) params.append('municipio', filterMunicipio);
      if (filterVigencia) params.append('vigencia', filterVigencia);
      if (search) params.append('search', search);
      if (filterGeometria === 'con') params.append('tiene_geometria', 'true');
      if (filterGeometria === 'sin') params.append('tiene_geometria', 'false');
      
      const res = await axios.get(`${API}/predios?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Verificar que los datos correspondan al municipio filtrado
      const prediosRecibidos = res.data.predios || [];
      
      // Filtrar solo predios del municipio correcto (protección adicional)
      const prediosFiltrados = filterMunicipio 
        ? prediosRecibidos.filter(p => p.municipio === filterMunicipio || p.nombre_municipio === filterMunicipio)
        : prediosRecibidos;
      
      // Ordenar por CNP
      const prediosOrdenados = sortPrediosByCNP(prediosFiltrados);
      
      setPredios(prediosOrdenados);
      setTotal(prediosOrdenados.length);
      
      // IMPORTANTE: Solo guardar en caché si es la vigencia ACTUAL
      // Las vigencias anteriores se consultan del servidor pero NO se guardan en caché
      const vigenciaActual = String(new Date().getFullYear());
      const esVigenciaActual = !filterVigencia || String(filterVigencia) === vigenciaActual;
      
      // Guardar automáticamente para modo offline si hay municipio filtrado Y es vigencia actual
      if (filterMunicipio && prediosOrdenados.length > 0 && esVigenciaActual) {
        // Mostrar barra de progreso de descarga
        const totalPredios = prediosOrdenados.length;
        setDownloadProgress({
          isDownloading: true,
          current: 0,
          total: totalPredios,
          label: `Guardando ${filterMunicipio} (${totalPredios.toLocaleString()} predios)...`
        });
        
        // Simular progreso mientras se guarda
        const progressInterval = setInterval(() => {
          setDownloadProgress(prev => ({
            ...prev,
            current: Math.min(prev.current + Math.ceil(totalPredios / 10), totalPredios)
          }));
        }, 100);
        
        await downloadForOffline(prediosOrdenados, null, filterMunicipio);
        
        clearInterval(progressInterval);
        setDownloadProgress({
          isDownloading: false,
          current: totalPredios,
          total: totalPredios,
          label: ''
        });
        
        toast.success(`✅ ${filterMunicipio}: ${totalPredios.toLocaleString()} predios disponibles offline`, { duration: 3000 });
      }
    } catch (error) {
      console.error('Error cargando predios:', error);
      setDownloadProgress({ isDownloading: false, current: 0, total: 0, label: '' });
      
      // Si hay error y está offline, intentar cargar desde IndexedDB
      if (!navigator.onLine) {
        const offlinePredios = await getPrediosOffline(filterMunicipio);
        if (offlinePredios.length > 0) {
          // Ordenar por CNP
          const prediosOrdenados = sortPrediosByCNP(offlinePredios);
          setPredios(prediosOrdenados);
          setTotal(prediosOrdenados.length);
          toast.info(`Modo offline: ${prediosOrdenados.length} predios cargados`);
        } else {
          toast.warning('No hay datos offline disponibles');
          setPredios([]);
          setTotal(0);
        }
      } else {
        toast.error('Error al cargar predios');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchGdbStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/gdb/geometrias-disponibles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGdbStats(res.data);
    } catch (error) {
      console.log('GDB stats no disponibles');
    }
  };

  const fetchTerrenoInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(
        `${API}/predios/terreno-info/${encodeURIComponent(formData.municipio)}?zona=${formData.zona}&sector=${formData.sector}&manzana_vereda=${formData.manzana_vereda}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTerrenoInfo(res.data);
    } catch (error) {
      setTerrenoInfo(null);
    }
  };

  const fetchPrediosEliminados = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios/eliminados`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPrediosEliminados(res.data.predios);
      setShowDeletedDialog(true);
    } catch (error) {
      toast.error('Error al cargar predios eliminados');
    }
  };

  const fetchCambiosStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios/cambios/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCambiosStats(res.data);
    } catch (error) {
      console.log('Stats no disponibles');
    }
  };

  const fetchReaparicionesConteo = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios/reapariciones/conteo-por-municipio`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReaparicionesConteo(res.data.conteo || {});
    } catch (error) {
      console.log('Conteo de reapariciones no disponible');
    }
  };

  const fetchSubsanacionesConteo = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios/reapariciones/subsanaciones-pendientes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const subsanaciones = res.data.subsanaciones || [];
      // También obtener reenviadas si es coordinador
      let reenviadas = [];
      if (user && ['coordinador', 'administrador'].includes(user.role)) {
        const res2 = await axios.get(`${API}/predios/reapariciones/reenviadas`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        reenviadas = res2.data.reenviadas || [];
      }
      setSubsanacionesConteo(subsanaciones.length + reenviadas.length);
    } catch (error) {
      console.log('Conteo de subsanaciones no disponible');
    }
  };

  const fetchCambiosPendientes = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios/cambios/pendientes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCambiosPendientes(res.data.cambios);
      setShowPendientesDialog(true);
    } catch (error) {
      toast.error('Error al cargar cambios pendientes');
    }
  };

  const fetchCambiosHistorial = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios/cambios/historial?limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCambiosHistorial(res.data.cambios || []);
    } catch (error) {
      console.log('Historial no disponible');
    }
  };

  const handleAprobarRechazar = async (cambioId, aprobado, comentario = '') => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/predios/cambios/aprobar`, {
        cambio_id: cambioId,
        aprobado,
        comentario
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(aprobado ? 'Cambio aprobado exitosamente' : 'Cambio rechazado');
      fetchCambiosPendientes();
      fetchCambiosStats();
      fetchPredios();
    } catch (error) {
      toast.error('Error al procesar el cambio');
    }
  };

  // Revincular geometrías GDB con predios usando algoritmo mejorado
  const handleRevincularGdb = async (municipioParam = null) => {
    setRevinculandoGdb(true);
    try {
      const token = localStorage.getItem('token');
      const params = municipioParam ? `?municipio=${encodeURIComponent(municipioParam)}` : '';
      
      toast.info('Iniciando revinculación de Base Gráfica GDB. Este proceso puede tardar unos minutos...');
      
      const response = await axios.post(`${API}/gdb/revincular-predios${params}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 300000 // 5 minutos de timeout
      });
      
      const data = response.data;
      const totalVinculados = data.total_vinculados || 0;
      
      if (totalVinculados > 0) {
        toast.success(`¡Revinculación completada! ${totalVinculados.toLocaleString()} predios vinculados con Base Gráfica GDB`);
        // Refrescar estadísticas
        fetchGdbStats();
        fetchPrediosStats();
      } else {
        toast.info('Revinculación completada. No se encontraron nuevos predios para vincular.');
      }
      
      // Mostrar detalle por municipio
      if (data.municipios_procesados && data.municipios_procesados.length > 0) {
        console.log('Detalle de revinculación:', data.municipios_procesados);
      }
      
      if (data.errores && data.errores.length > 0) {
        console.warn('Errores durante revinculación:', data.errores);
      }
      
    } catch (error) {
      console.error('Error en revinculación:', error);
      toast.error(error.response?.data?.detail || 'Error al revincular Base Gráfica GDB');
    } finally {
      setRevinculandoGdb(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Construir parámetros de consulta
      const params = new URLSearchParams();
      if (filterMunicipio !== 'todos' && filterMunicipio) {
        params.append('municipio', filterMunicipio);
      }
      if (filterVigencia) {
        params.append('vigencia', filterVigencia);
      }
      
      const queryString = params.toString() ? `?${params.toString()}` : '';
      
      const response = await axios.get(`${API}/predios/export-excel${queryString}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // Nombre del archivo con vigencia incluida
      const fecha = new Date().toISOString().split('T')[0];
      const vigenciaStr = filterVigencia ? `_Vigencia${String(filterVigencia).slice(-4)}` : '';
      link.setAttribute('download', `Predios_${filterMunicipio !== 'todos' && filterMunicipio ? filterMunicipio : 'Todos'}${vigenciaStr}_${fecha}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Excel exportado exitosamente');
    } catch (error) {
      toast.error('Error al exportar Excel');
    }
  };

  const handleSearch = () => {
    fetchPredios();
  };

  // Verificar si el usuario necesita aprobación
  const necesitaAprobacion = user && ['gestor', 'gestor_auxiliar', 'atencion_usuario'].includes(user.role);

  const handleCreate = async () => {
    // Validar que el código esté completo
    const codigoCompleto = construirCodigoCompleto();
    if (codigoCompleto.length !== 30) {
      toast.error('El código predial debe tener exactamente 30 dígitos');
      return;
    }

    // Verificar el código antes de crear
    if (!verificacionCodigo) {
      toast.error('Por favor verifique el código antes de continuar');
      return;
    }

    if (verificacionCodigo.estado === 'existente') {
      toast.error('Este código ya existe en la base de datos');
      return;
    }

    // Validar que haya al menos un propietario con datos
    if (!propietarios[0].nombre_propietario || !propietarios[0].numero_documento) {
      toast.error('Debe ingresar al menos un propietario con nombre y número de documento');
      return;
    }

    // Si se usa el nuevo flujo, validar gestor de apoyo
    if (usarNuevoFlujo && !gestorAsignado) {
      toast.error('Debe seleccionar un Gestor de Apoyo para el flujo de trabajo');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      
      // === NUEVO FLUJO CON WORKFLOW ===
      if (usarNuevoFlujo) {
        const predioNuevoData = {
          r1: {
            municipio: formData.municipio || filterMunicipio,
            zona: codigoManual.zona,
            sector: codigoManual.sector,
            manzana_vereda: codigoManual.manzana_vereda,
            terreno: codigoManual.terreno,
            condicion_predio: `${codigoManual.condicion}${codigoManual.edificio}${codigoManual.piso}${codigoManual.unidad}`.padEnd(9, '0').substring(0, 9),
            predio_horizontal: '0000',
            nombre_propietario: propietarios[0].nombre_propietario,
            tipo_documento: propietarios[0].tipo_documento,
            numero_documento: propietarios[0].numero_documento,
            estado_civil: propietarios[0].estado_civil || null,
            direccion: formData.direccion,
            comuna: codigoManual.comuna,
            destino_economico: formData.destino_economico,
            area_terreno: parseFloat(formData.area_terreno) || 0,
            area_construida: parseFloat(formData.area_construida) || 0,
            avaluo: parseFloat(formData.avaluo) || 0,
          },
          r2: {
            matricula_inmobiliaria: formData.matricula_inmobiliaria || null,
            zona_fisica_1: parseFloat(zonasFisicas[0]?.zona_fisica) || 0,
            zona_economica_1: parseFloat(zonasFisicas[0]?.zona_economica) || 0,
            area_terreno_1: parseFloat(zonasFisicas[0]?.area_terreno) || 0,
            habitaciones_1: parseInt(zonasFisicas[0]?.habitaciones) || 0,
            banos_1: parseInt(zonasFisicas[0]?.banos) || 0,
            locales_1: parseInt(zonasFisicas[0]?.locales) || 0,
            pisos_1: parseInt(zonasFisicas[0]?.pisos) || 1,
            puntaje_1: parseFloat(zonasFisicas[0]?.puntaje) || 0,
            area_construida_1: parseFloat(zonasFisicas[0]?.area_construida) || 0,
          },
          gestor_apoyo_id: gestorAsignado,
          radicado_numero: radicadoNumero || null,
          peticiones_ids: peticionesRelacionadas,
          observaciones: observacionesCreacion || null,
        };
        
        const res = await axios.post(`${API}/predios-nuevos`, predioNuevoData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        toast.success('Predio creado y asignado al Gestor de Apoyo para digitalización');
        const gestorNombre = gestoresDisponibles.find(g => g.id === gestorAsignado)?.full_name;
        toast.info(`Asignado a ${gestorNombre}. El predio aparecerá en "Predios en Proceso".`, { duration: 5000 });
        
        setShowCreateDialog(false);
        resetForm();
        fetchPredios();
        fetchCambiosStats();
        return;
      }
      
      // === FLUJO ORIGINAL ===
      const predioData = {
        codigo_predial_nacional: codigoCompleto,
        municipio: formData.municipio || filterMunicipio,
        es_reactivacion: verificacionCodigo.estado === 'eliminado',
        justificacion: verificacionCodigo.estado === 'eliminado' 
          ? 'Reactivación de predio eliminado' 
          : 'Creación de nuevo predio',
        // Usar el primer propietario como principal (para compatibilidad)
        nombre_propietario: propietarios[0].nombre_propietario,
        tipo_documento: propietarios[0].tipo_documento,
        numero_documento: propietarios[0].numero_documento,
        // Lista completa de propietarios
        propietarios: propietarios.filter(p => p.nombre_propietario && p.numero_documento),
        // Información del predio
        direccion: formData.direccion,
        destino_economico: formData.destino_economico,
        matricula_inmobiliaria: formData.matricula_inmobiliaria,
        area_terreno: parseFloat(formData.area_terreno) || 0,
        area_construida: parseFloat(formData.area_construida) || 0,
        avaluo: parseFloat(formData.avaluo) || 0,
        // Zonas físicas múltiples
        zonas_fisicas: zonasFisicas.map(z => ({
          zona_fisica: parseFloat(z.zona_fisica) || 0,
          zona_economica: parseFloat(z.zona_economica) || 0,
          area_terreno: parseFloat(z.area_terreno) || 0,
          habitaciones: parseInt(z.habitaciones) || 0,
          banos: parseInt(z.banos) || 0,
          locales: parseInt(z.locales) || 0,
          pisos: parseInt(z.pisos) || 1,
          puntaje: parseFloat(z.puntaje) || 0,
          area_construida: parseFloat(z.area_construida) || 0
        })),
        // Gestor asignado para continuar
        gestor_asignado_id: gestorAsignado || null
      };

      const res = await axios.post(`${API}/predios/crear-con-workflow`, predioData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.requiere_aprobacion) {
        toast.success('Predio propuesto. Pendiente de aprobación del coordinador.');
      } else {
        toast.success('Predio creado exitosamente');
      }

      if (gestorAsignado) {
        const gestorNombre = gestoresDisponibles.find(g => g.id === gestorAsignado)?.full_name;
        toast.info(`Asignado a ${gestorNombre} para continuar el diligenciamiento.`, { duration: 4000 });
      }

      if (!res.data.tiene_geometria) {
        toast.info('⚠️ Este predio no tiene información gráfica (GDB). Se relacionará cuando se cargue el archivo GDB.', { duration: 5000 });
      }
      
      setShowCreateDialog(false);
      resetForm();
      // Forzar recarga desde servidor para ver el nuevo predio
      await forceRefreshPredios();
      fetchCambiosStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear predio');
    }
  };

  const handleUpdate = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Filtrar propietarios válidos
      const propietariosValidos = propietarios.filter(p => p.nombre_propietario && p.numero_documento);
      
      if (propietariosValidos.length === 0) {
        toast.error('Debe ingresar al menos un propietario con nombre y documento');
        return;
      }
      
      // Filtrar zonas físicas válidas
      const zonasValidas = zonasFisicas.filter(z => 
        z.zona_fisica !== '0' || z.area_terreno !== '0' || z.area_construida !== '0'
      );
      
      const updateData = {
        // Datos del primer propietario (campos legacy para compatibilidad)
        nombre_propietario: propietariosValidos[0].nombre_propietario,
        tipo_documento: propietariosValidos[0].tipo_documento,
        numero_documento: propietariosValidos[0].numero_documento,
        estado_civil: propietariosValidos[0].estado_civil || null,
        // Array completo de propietarios
        propietarios: propietariosValidos,
        // Otros campos
        direccion: formData.direccion,
        comuna: formData.comuna,
        destino_economico: formData.destino_economico,
        area_terreno: parseFloat(formData.area_terreno) || 0,
        area_construida: parseFloat(formData.area_construida) || 0,
        avaluo: parseFloat(formData.avaluo) || 0,
        tipo_mutacion: formData.tipo_mutacion || null,
        numero_resolucion: formData.numero_resolucion || null,
        matricula_inmobiliaria: formData.matricula_inmobiliaria || null
      };
      
      // Agregar zonas R2 si hay datos válidos
      if (zonasValidas.length > 0) {
        updateData.r2 = {
          matricula_inmobiliaria: formData.matricula_inmobiliaria || null,
          zonas: zonasValidas.map(z => ({
            zona_fisica: z.zona_fisica,
            zona_economica: z.zona_economica,
            area_terreno: parseFloat(z.area_terreno) || 0,
            habitaciones: parseInt(z.habitaciones) || 0,
            banos: parseInt(z.banos) || 0,
            locales: parseInt(z.locales) || 0,
            pisos: parseInt(z.pisos) || 1,
            puntaje: parseFloat(z.puntaje) || 0,
            area_construida: parseFloat(z.area_construida) || 0
          }))
        };
      }
      
      // Usar sistema de aprobación
      const res = await axios.post(`${API}/predios/cambios/proponer`, {
        predio_id: selectedPredio.id,
        tipo_cambio: 'modificacion',
        datos_propuestos: updateData,
        justificacion: 'Modificación de datos del predio'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.requiere_aprobacion) {
        toast.success('Modificación propuesta. Pendiente de aprobación del coordinador.');
      } else {
        toast.success('Predio actualizado exitosamente');
      }
      
      setShowEditDialog(false);
      // Forzar recarga desde servidor para ver cambios inmediatamente
      await forceRefreshPredios();
      fetchCambiosStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al actualizar predio');
    }
  };

  const handleDelete = async (predio) => {
    if (!window.confirm(`¿Está seguro de eliminar el predio ${predio.codigo_homologado}?`)) return;
    
    try {
      const token = localStorage.getItem('token');
      
      // Usar sistema de aprobación
      const res = await axios.post(`${API}/predios/cambios/proponer`, {
        predio_id: predio.id,
        tipo_cambio: 'eliminacion',
        datos_propuestos: { codigo_homologado: predio.codigo_homologado, nombre_propietario: predio.nombre_propietario },
        justificacion: 'Eliminación de predio'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.requiere_aprobacion) {
        toast.success('Eliminación propuesta. Pendiente de aprobación del coordinador.');
      } else {
        toast.success('Predio eliminado exitosamente');
      }
      
      // Forzar recarga desde servidor para ver cambios inmediatamente
      await forceRefreshPredios();
      fetchCambiosStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar predio');
    }
  };

  const openEditDialog = (predio) => {
    // Preparar todos los datos antes de hacer setState
    let newPropietarios;
    if (predio.propietarios && predio.propietarios.length > 0) {
      newPropietarios = predio.propietarios.map(p => ({
        nombre_propietario: p.nombre_propietario || '',
        tipo_documento: p.tipo_documento || 'C',
        numero_documento: p.numero_documento || '',
        estado_civil: p.estado_civil || ''
      }));
    } else if (predio.nombre_propietario) {
      newPropietarios = [{
        nombre_propietario: predio.nombre_propietario || '',
        tipo_documento: predio.tipo_documento || 'C',
        numero_documento: predio.numero_documento || '',
        estado_civil: predio.estado_civil || ''
      }];
    } else {
      newPropietarios = [{
        nombre_propietario: '',
        tipo_documento: 'C',
        numero_documento: '',
        estado_civil: ''
      }];
    }
    
    // Obtener datos R2
    const r2Data = predio.r2 || (predio.r2_registros && predio.r2_registros[0]) || {};
    const zonasData = r2Data.zonas || [];
    
    let newZonasFisicas;
    if (zonasData.length > 0) {
      newZonasFisicas = zonasData.map(z => ({
        zona_fisica: z.zona_fisica?.toString() || '0',
        zona_economica: z.zona_economica?.toString() || '0',
        area_terreno: z.area_terreno?.toString() || '0',
        habitaciones: z.habitaciones?.toString() || '0',
        banos: z.banos?.toString() || '0',
        locales: z.locales?.toString() || '0',
        pisos: z.pisos?.toString() || '1',
        puntaje: z.puntaje?.toString() || '0',
        area_construida: z.area_construida?.toString() || '0'
      }));
    } else {
      newZonasFisicas = [{
        zona_fisica: '0',
        zona_economica: '0',
        area_terreno: '0',
        habitaciones: '0',
        banos: '0',
        locales: '0',
        pisos: '1',
        puntaje: '0',
        area_construida: '0'
      }];
    }
    
    const matricula = r2Data.matricula_inmobiliaria || predio.matricula_inmobiliaria || '';
    
    const newFormData = {
      ...formData,
      municipio: predio.municipio,
      zona: predio.zona,
      sector: predio.sector,
      manzana_vereda: predio.manzana_vereda,
      nombre_propietario: predio.propietarios?.[0]?.nombre_propietario || predio.nombre_propietario || '',
      tipo_documento: predio.propietarios?.[0]?.tipo_documento || predio.tipo_documento || 'C',
      numero_documento: predio.propietarios?.[0]?.numero_documento || predio.numero_documento || '',
      estado_civil: predio.propietarios?.[0]?.estado_civil || predio.estado_civil || '',
      direccion: predio.direccion || '',
      comuna: predio.comuna || '0',
      destino_economico: predio.destino_economico || 'A',
      area_terreno: predio.area_terreno?.toString() || '0',
      area_construida: predio.area_construida?.toString() || '0',
      avaluo: predio.avaluo?.toString() || '0',
      tipo_mutacion: predio.tipo_mutacion || '',
      numero_resolucion: predio.numero_resolucion || '',
      matricula_inmobiliaria: matricula
    };
    
    // Hacer todos los setState juntos - React los batcha automáticamente
    setSelectedPredio(predio);
    setPropietarios(newPropietarios);
    setZonasFisicas(newZonasFisicas);
    setFormData(newFormData);
    setShowEditDialog(true);
  };

  const openDetailDialog = (predio) => {
    setSelectedPredio(predio);
    setShowDetailDialog(true);
  };

  const resetForm = () => {
    setFormData({
      municipio: filterMunicipio || '', // Mantener el municipio si está seleccionado
      zona: '00',
      sector: '01',
      manzana_vereda: '0000',
      condicion_predio: '0000',
      predio_horizontal: '0000',
      nombre_propietario: '',
      tipo_documento: 'C',
      numero_documento: '',
      estado_civil: '',
      direccion: '',
      comuna: '0',
      destino_economico: 'A',
      area_terreno: '',
      area_construida: '0',
      avaluo: '',
      tipo_mutacion: '',
      numero_resolucion: '',
      fecha_resolucion: '',
      matricula_inmobiliaria: '',
      zona_fisica_1: '0',
      zona_economica_1: '0',
      area_terreno_1: '0',
      habitaciones_1: '0',
      banos_1: '0',
      locales_1: '0',
      pisos_1: '1',
      puntaje_1: '0',
      area_construida_1: '0'
    });
    setCodigoManual({
      zona: '00',
      sector: '00',
      comuna: '00',
      barrio: '00',
      manzana_vereda: '0000',
      terreno: '0001',
      condicion: '0',
      edificio: '00',
      piso: '00',
      unidad: '0000'
    });
    setPropietarios([{
      nombre_propietario: '',
      tipo_documento: 'C',
      numero_documento: '',
      estado_civil: ''
    }]);
    setZonasFisicas([{
      zona_fisica: '0',
      zona_economica: '0',
      area_terreno: '0',
      habitaciones: '0',
      banos: '0',
      locales: '0',
      pisos: '1',
      puntaje: '0',
      area_construida: '0'
    }]);
    setEstructuraCodigo(null);
    setVerificacionCodigo(null);
    setTerrenoInfo(null);
    setGestorAsignado('');
    // Limpiar estados del nuevo flujo
    setRadicadoNumero('');
    setRadicadoInfo(null);
    setPeticionesRelacionadas([]);
    setObservacionesCreacion('');
    setUsarNuevoFlujo(false);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0);
  };

  // Formato de área: X ha X.XXX m²
  const formatAreaHectareas = (m2) => {
    if (!m2 || m2 === 0) return '0 m²';
    const hectareas = Math.floor(m2 / 10000);
    const metros = m2 % 10000;
    if (hectareas > 0) {
      return `${hectareas} ha ${metros.toLocaleString('es-CO')} m²`;
    }
    return `${m2.toLocaleString('es-CO')} m²`;
  };

  if (loading && !prediosStats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-700"></div>
      </div>
    );
  }

  // Obtener vigencias disponibles para el municipio seleccionado
  const vigenciasDelMunicipio = filterMunicipio ? vigenciasData[filterMunicipio] || [] : [];
  
  // Función para volver al dashboard
  const volverAlDashboard = () => {
    setShowDashboard(true);
    setFilterMunicipio('');
    setFilterVigencia('');
    setPredios([]);
    setSearch('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-outfit">Gestión de Predios</h1>
          <p className="text-sm text-slate-500">Sistema de información catastral - Código Nacional Catastral</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {/* Indicador Offline */}
          {!isOnline && (
            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
              <WifiOff className="w-3 h-3 mr-1" />
              Sin conexión
            </Badge>
          )}
          {offlineStats.cambiosPendientes > 0 && (
            <Badge 
              variant="outline" 
              className="bg-blue-100 text-blue-700 border-blue-300 cursor-pointer"
              onClick={forceSync}
              title="Click para sincronizar"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
              {offlineStats.cambiosPendientes} pendientes
            </Badge>
          )}
          
          {/* Botón Exportar Excel - solo cuando está dentro de un municipio y NO para roles usuario/empresa */}
          {!showDashboard && !['usuario', 'empresa'].includes(user?.role) && (
            <Button variant="outline" onClick={handleExportExcel}>
              <Download className="w-4 h-4 mr-2" />
              Exportar Excel
            </Button>
          )}
          {/* Botón Revincular GDB - solo admin/coordinador en dashboard */}
          {showDashboard && (user?.role === 'administrador' || user?.role === 'coordinador') && (
            <Button 
              variant="outline" 
              onClick={() => handleRevincularGdb()}
              disabled={revinculandoGdb}
              className="border-amber-500 text-amber-700 hover:bg-amber-50"
            >
              {revinculandoGdb ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              {revinculandoGdb ? 'Revinculando...' : 'Revincular GDB'}
            </Button>
          )}
        </div>
      </div>

      {/* Info banner para gestores */}
      {necesitaAprobacion && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-800">Sistema de Aprobación Activo</p>
            <p className="text-xs text-blue-600">Los cambios que realice (crear, modificar, eliminar) quedarán pendientes hasta que un Coordinador los apruebe.</p>
          </div>
        </div>
      )}

      {/* Dashboard de Selección */}
      {showDashboard ? (
        <div className="space-y-6">
          {/* Estadísticas Generales - Solo 4 tarjetas: Total Predios, Avalúo Total, Área R1, Geometrías GDB */}
          {prediosStats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
              <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
                <CardContent className="p-2 md:p-4">
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] md:text-xs text-emerald-600 font-medium">Total Predios</p>
                      <Building className="w-5 h-5 md:w-8 md:h-8 text-emerald-300" />
                    </div>
                    <p className="text-lg md:text-2xl font-bold text-emerald-800">{prediosStats.total_predios?.toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
                <CardContent className="p-2 md:p-4">
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] md:text-xs text-blue-600 font-medium">Avalúo Total</p>
                      <DollarSign className="w-5 h-5 md:w-8 md:h-8 text-blue-300" />
                    </div>
                    <p className="text-sm md:text-xl font-bold text-blue-800">{formatCurrency(prediosStats.total_avaluo)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
                <CardContent className="p-2 md:p-4">
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] md:text-xs text-amber-600 font-medium">Área R1</p>
                      <MapPin className="w-5 h-5 md:w-8 md:h-8 text-amber-300" />
                    </div>
                    <p className="text-sm md:text-xl font-bold text-amber-800">{formatAreaHectareas(prediosStats.total_area_terreno)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
                <CardContent className="p-2 md:p-4">
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] md:text-xs text-purple-600 font-medium">Base Gráfica</p>
                      <Map className="w-5 h-5 md:w-8 md:h-8 text-purple-300" />
                    </div>
                    <p className="text-lg md:text-2xl font-bold text-purple-800">{(prediosStats.total_con_geometria || 0).toLocaleString()}</p>
                    {prediosStats.total_area_gdb > 0 && (
                      <p className="text-[10px] md:text-xs text-purple-500">{formatAreaHectareas(prediosStats.total_area_gdb)}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Predios por Municipio - PRIMERO (ordenados alfabéticamente) */}
          {prediosStats?.by_municipio && (
            <Card className="border-slate-200">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg font-outfit">Predios por Municipio</CardTitle>
                    <p className="text-sm text-slate-500">Haga clic en un municipio para ver los predios de la vigencia más reciente</p>
                  </div>
                  {/* Botones de importar R1/R2 y Homologados solo para coordinadores y admins */}
                  {user && ['coordinador', 'administrador'].includes(user.role) && (
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="border-emerald-600 text-emerald-700 hover:bg-emerald-50">
                            <Plus className="w-4 h-4 mr-2" />
                            Importar R1/R2
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle className="text-lg font-outfit">Importar Predios R1/R2</DialogTitle>
                          </DialogHeader>
                          <ImportR1R2Form onSuccess={() => { fetchPrediosStats(); fetchVigencias(); fetchReaparicionesConteo(); }} />
                        </DialogContent>
                      </Dialog>
                      <Button 
                        variant="outline" 
                        className="border-blue-600 text-blue-700 hover:bg-blue-50"
                        onClick={() => { fetchCodigosStats(); setShowCodigosDialog(true); }}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Importar Homologados
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3">
                  {[...prediosStats.by_municipio].sort((a, b) => a.municipio.localeCompare(b.municipio, 'es')).map((item) => {
                    // Obtener la vigencia más reciente del municipio (ordenadas de más nueva a más vieja)
                    const vigencias = vigenciasData[item.municipio] || [];
                    const vigenciaReciente = vigencias.length > 0 ? vigencias[0].vigencia : null;
                    // Extraer el año de la vigencia (puede ser 2025 o 01012025 o 1012025)
                    const vigenciaYear = vigenciaReciente ? (String(vigenciaReciente).length >= 7 ? String(vigenciaReciente).slice(-4) : vigenciaReciente) : '---';
                    // Conteo de reapariciones para este municipio
                    const reaparicionesCount = reaparicionesConteo[item.municipio] || 0;
                    
                    return (
                      <div key={item.municipio} className="relative">
                        <Button
                          variant="outline"
                          className="w-full h-auto min-h-[80px] py-3 px-3 flex flex-col items-start justify-center text-left hover:bg-emerald-50 hover:border-emerald-300 overflow-hidden"
                          onClick={() => {
                            setFilterMunicipio(item.municipio);
                            setFilterVigencia(String(vigenciaReciente || '2025'));
                          }}
                        >
                          <span className="font-medium text-slate-900 text-sm leading-tight truncate w-full">{item.municipio}</span>
                          <span className="text-lg md:text-xl font-bold text-emerald-700">{item.count?.toLocaleString()}</span>
                          <span className="text-[10px] md:text-xs text-slate-500 leading-tight">predios</span>
                        </Button>
                        {/* Badge de reapariciones pendientes */}
                        {reaparicionesCount > 0 && user && ['coordinador', 'administrador'].includes(user.role) && (
                          <button
                            className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center hover:bg-amber-600 shadow-md"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFilterMunicipio(item.municipio);
                              setShowReaparicionesDialog(true);
                            }}
                            title={`${reaparicionesCount} reapariciones pendientes`}
                          >
                            {reaparicionesCount}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Selección de Vigencia y Municipio - DESPUÉS */}
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg font-outfit flex items-center gap-2">
                <Search className="w-5 h-5 text-emerald-700" />
                Búsqueda Avanzada
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-500">
                O seleccione manualmente el municipio y vigencia para una búsqueda específica.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Municipio *</Label>
                  <Select value={filterMunicipio} onValueChange={(v) => { setFilterMunicipio(v); setFilterVigencia(''); }}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Seleccione un municipio" />
                    </SelectTrigger>
                    <SelectContent>
                      {catalogos?.municipios?.slice().sort((a, b) => a.localeCompare(b, 'es')).map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Vigencia (Año) *</Label>
                  <Select 
                    value={filterVigencia} 
                    onValueChange={setFilterVigencia}
                    disabled={!filterMunicipio}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder={filterMunicipio ? "Seleccione vigencia" : "Primero seleccione municipio"} />
                    </SelectTrigger>
                    <SelectContent>
                      {vigenciasDelMunicipio.length > 0 ? (
                        vigenciasDelMunicipio.map(v => {
                          // Mostrar solo el año (extraer de formato 0101YYYY, 1012024 o usar directamente si es número)
                          const vigStr = String(v.vigencia);
                          const yearDisplay = vigStr.length >= 7 ? vigStr.slice(-4) : vigStr;
                          return (
                            <SelectItem key={v.vigencia} value={String(v.vigencia)}>
                              {yearDisplay} ({v.predios?.toLocaleString()} predios) {v.historico && '(histórico)'}
                            </SelectItem>
                          );
                        })
                      ) : (
                        <SelectItem value="2025">2025 (vigencia actual)</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          {/* Vista de Predios (después de seleccionar filtros) */}
          
          {/* Barra de navegación */}
          <div className="flex items-center gap-4 bg-emerald-50 p-4 rounded-lg border border-emerald-200">
            <Button variant="ghost" onClick={volverAlDashboard} className="text-emerald-700 hover:text-emerald-800">
              ← Volver al Dashboard
            </Button>
            <div className="h-6 border-l border-emerald-300"></div>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-100 text-emerald-800">
                {filterMunicipio}
              </Badge>
              <Badge variant="outline" className="border-emerald-300">
                Vigencia {String(filterVigencia).length >= 7 ? String(filterVigencia).slice(-4) : filterVigencia}
              </Badge>
              <Badge variant="secondary">
                {total.toLocaleString()} predios
              </Badge>
            </div>
          </div>

          {/* Filters */}
          <Card className="border-slate-200">
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Buscar por código, propietario, documento, matrícula..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button onClick={handleSearch} variant="outline">
                      <Search className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {/* Filtro de Base Gráfica */}
                <Select value={filterGeometria} onValueChange={setFilterGeometria}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Base Gráfica" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="con">Con Base Gráfica</SelectItem>
                    <SelectItem value="sin">Sin Base Gráfica</SelectItem>
                  </SelectContent>
                </Select>
                {gdbStats?.por_municipio?.[filterMunicipio] && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                    <Map className="w-3 h-3 mr-1" />
                    {gdbStats.por_municipio[filterMunicipio]?.total || 0} en Base Gráfica
                  </Badge>
                )}
                {canModifyPredios && (
                  <Button onClick={() => { resetForm(); setTerrenoInfo(null); setShowCreateDialog(true); }} className="bg-emerald-700 hover:bg-emerald-800">
                    <Plus className="w-4 h-4 mr-2" />
                    Nuevo Predio
                  </Button>
                )}
                {canModifyPredios && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-50">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Predios Eliminados
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Predios Eliminados - {filterMunicipio}</DialogTitle>
                    </DialogHeader>
                    <PrediosEliminadosView municipio={filterMunicipio} />
                  </DialogContent>
                </Dialog>
                )}
                {/* Botón de Subsanaciones - Para gestores y coordinadores */}
                {user && ['gestor', 'coordinador', 'administrador'].includes(user.role) && subsanacionesConteo > 0 && (
                  <Button 
                    variant="outline" 
                    className="border-orange-400 text-orange-700 hover:bg-orange-50 relative"
                    onClick={() => setShowSubsanacionesDialog(true)}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Subsanaciones
                    <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {subsanacionesConteo}
                    </span>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

      {/* Results */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-slate-900 font-outfit flex items-center justify-between">
            <span>Predios Registrados</span>
            <div className="flex items-center gap-2">
              {filterMunicipio && (
                <>
                  {/* Indicador de datos desde caché */}
                  {!loading && predios.length > 0 && (
                    <span className="text-xs text-amber-600 flex items-center gap-1" title="Los datos pueden estar desactualizados. Haga clic en Sincronizar para obtener la última versión.">
                      <Database className="w-3 h-3" />
                      Caché local
                    </span>
                  )}
                  <Button
                    variant={navigator.onLine ? "default" : "outline"}
                    size="sm"
                    onClick={() => syncMunicipioManual(filterMunicipio)}
                    disabled={downloadProgress.isDownloading || !navigator.onLine}
                    className={`text-xs ${navigator.onLine ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                    title="Actualizar datos desde el servidor"
                  >
                    <RefreshCw className={`w-3 h-3 mr-1 ${downloadProgress.isDownloading ? 'animate-spin' : ''}`} />
                    Sincronizar
                  </Button>
                </>
              )}
              <Badge variant="outline">{total.toLocaleString()} predios</Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700"></div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Código Nacional</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Matrícula</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Propietario(s)</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Dirección</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-700">Destino</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-700">Avalúo</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-700">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {predios.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="py-8 text-center text-slate-500">
                          No hay predios registrados para este municipio y vigencia
                        </td>
                      </tr>
                    ) : (
                      // Paginación: mostrar solo los predios de la página actual
                      (() => {
                        const startIndex = (currentPage - 1) * pageSize;
                        const endIndex = startIndex + pageSize;
                        const paginatedPredios = predios.slice(startIndex, endIndex);
                        
                        return paginatedPredios.map((predio) => (
                        <tr key={predio.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-mono text-xs font-medium text-emerald-800">{predio.codigo_predial_nacional}</p>
                              <p className="text-xs text-slate-500">Homologado: {predio.codigo_homologado}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {predio.r2_registros?.[0]?.matricula_inmobiliaria ? (
                              <span className="font-medium text-slate-800">{predio.r2_registros[0].matricula_inmobiliaria}</span>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Sin información de matrícula</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium text-slate-900">
                                {predio.propietarios?.[0]?.nombre_propietario || predio.nombre_propietario}
                              </p>
                              {(predio.propietarios?.length > 1) && (
                                <Badge variant="secondary" className="text-xs mt-1">
                                  <Users className="w-3 h-3 mr-1" />
                                  +{predio.propietarios.length - 1} más
                                </Badge>
                              )}
                              <p className="text-xs text-slate-500">
                                {catalogos?.tipo_documento?.[predio.propietarios?.[0]?.tipo_documento || predio.tipo_documento]}: {predio.propietarios?.[0]?.numero_documento || predio.numero_documento}
                              </p>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-700 max-w-[200px] truncate">{predio.direccion}</td>
                          <td className="py-3 px-4 text-center">
                            <Badge className="bg-emerald-100 text-emerald-800">
                              {predio.destino_economico}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-900">
                            {formatCurrency(predio.avaluo)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openDetailDialog(predio)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              {canModifyPredios && (
                                <>
                                  <Button variant="ghost" size="sm" onClick={() => openEditDialog(predio)}>
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleDelete(predio)} className="text-red-600 hover:text-red-700">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ));
                      })()
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Controles de Paginación */}
              {predios.length > pageSize && (
                <div className="flex items-center justify-between mt-4 px-4 py-3 bg-slate-50 rounded-lg">
                  <div className="text-sm text-slate-600">
                    Mostrando {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, predios.length)} de {predios.length.toLocaleString()} predios
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    >
                      Primera
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Anterior
                    </Button>
                    <span className="px-3 py-1 bg-white border rounded text-sm">
                      Página {currentPage} de {Math.ceil(predios.length / pageSize)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(Math.ceil(predios.length / pageSize), p + 1))}
                      disabled={currentPage >= Math.ceil(predios.length / pageSize)}
                    >
                      Siguiente
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.ceil(predios.length / pageSize))}
                      disabled={currentPage >= Math.ceil(predios.length / pageSize)}
                    >
                      Última
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-outfit">
              Nuevo Predio {filterMunicipio && `- ${filterMunicipio}`}
            </DialogTitle>
          </DialogHeader>
          
          {/* Información del Código Homologado */}
          {siguienteCodigoHomologado && (
            <div className={`p-3 rounded-lg border ${siguienteCodigoHomologado.codigo ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className={`w-5 h-5 ${siguienteCodigoHomologado.codigo ? 'text-emerald-600' : 'text-amber-600'}`} />
                  <div>
                    <p className="text-sm font-medium text-slate-700">Código Homologado Asignado</p>
                    {siguienteCodigoHomologado.codigo ? (
                      <p className="text-lg font-bold text-emerald-700 font-mono">{siguienteCodigoHomologado.codigo}</p>
                    ) : (
                      <p className="text-sm text-amber-700">No hay códigos disponibles - se generará automáticamente</p>
                    )}
                  </div>
                </div>
                {siguienteCodigoHomologado.codigo && (
                  <Badge className="bg-emerald-100 text-emerald-700">
                    {siguienteCodigoHomologado.disponibles} disponibles
                  </Badge>
                )}
              </div>
            </div>
          )}
          
          <Tabs defaultValue="ubicacion" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="ubicacion">Código Nacional (30 dígitos)</TabsTrigger>
              <TabsTrigger value="propietario">Propietario (R1)</TabsTrigger>
              <TabsTrigger value="fisico">Físico (R2)</TabsTrigger>
            </TabsList>
            
            <TabsContent value="ubicacion" className="space-y-4 mt-4">
              {/* Municipio - Solo mostrar si no está pre-seleccionado */}
              {!filterMunicipio && (
                <div>
                  <Label>Municipio *</Label>
                  <Select value={formData.municipio} onValueChange={(v) => setFormData({...formData, municipio: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione municipio" />
                    </SelectTrigger>
                    <SelectContent>
                      {catalogos?.municipios?.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Estructura del Código Predial Nacional - 30 dígitos */}
              {estructuraCodigo && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Código Predial Nacional (30 dígitos)
                  </h4>
                  
                  {/* Visualización del código completo */}
                  <div className="bg-white p-3 rounded border mb-4 font-mono text-lg tracking-wider text-center">
                    <span className="text-blue-600 font-bold" title="Departamento + Municipio">{estructuraCodigo.prefijo_fijo}</span>
                    <span className="text-emerald-600" title="Zona">{codigoManual.zona}</span>
                    <span className="text-amber-600" title="Sector">{codigoManual.sector}</span>
                    <span className="text-purple-600" title="Comuna">{codigoManual.comuna}</span>
                    <span className="text-pink-600" title="Barrio">{codigoManual.barrio}</span>
                    <span className="text-cyan-600" title="Manzana/Vereda">{codigoManual.manzana_vereda}</span>
                    <span className="text-red-600 font-bold" title="Terreno">{codigoManual.terreno}</span>
                    <span className="text-orange-600" title="Condición">{codigoManual.condicion}</span>
                    <span className="text-slate-500" title="Edificio">{codigoManual.edificio}</span>
                    <span className="text-slate-500" title="Piso">{codigoManual.piso}</span>
                    <span className="text-slate-500" title="Unidad">{codigoManual.unidad}</span>
                    <span className="text-xs text-slate-500 ml-2">({construirCodigoCompleto().length}/30)</span>
                  </div>

                  {/* Campos editables - Fila 1: Ubicación geográfica */}
                  <div className="grid grid-cols-6 gap-2 mb-3">
                    <div className="bg-blue-100 p-2 rounded">
                      <Label className="text-xs text-blue-700">Dpto+Mpio (1-5)</Label>
                      <Input value={estructuraCodigo.prefijo_fijo} disabled className="font-mono bg-blue-50 text-blue-800 font-bold text-center" />
                    </div>
                    <div>
                      <Label className="text-xs text-emerald-700">Zona (6-7)</Label>
                      <Input 
                        value={codigoManual.zona} 
                        onChange={(e) => handleCodigoChange('zona', e.target.value, 2)}
                        maxLength={2}
                        className="font-mono text-center"
                        placeholder="00"
                      />
                      <span className="text-xs text-slate-400">00=Rural, 01=Urbano, 02-99=Correg.</span>
                    </div>
                    <div>
                      <Label className="text-xs text-amber-700">Sector (8-9)</Label>
                      <Input 
                        value={codigoManual.sector} 
                        onChange={(e) => handleCodigoChange('sector', e.target.value, 2)}
                        maxLength={2}
                        className="font-mono text-center"
                        placeholder="00"
                      />
                      {ultimaManzanaInfo && ultimaManzanaInfo.ultima_manzana && (
                        <div className="mt-1 p-1.5 bg-amber-50 border border-amber-200 rounded text-xs">
                          <span className="text-amber-700">
                            Última manzana: <strong>{ultimaManzanaInfo.ultima_manzana}</strong>
                          </span>
                        </div>
                      )}
                      {ultimaManzanaInfo && !ultimaManzanaInfo.ultima_manzana && (
                        <span className="text-xs text-slate-400 block mt-1">Sin manzanas registradas</span>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-purple-700">Comuna (10-11)</Label>
                      <Input 
                        value={codigoManual.comuna} 
                        onChange={(e) => handleCodigoChange('comuna', e.target.value, 2)}
                        maxLength={2}
                        className="font-mono text-center"
                        placeholder="00"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-pink-700">Barrio (12-13)</Label>
                      <Input 
                        value={codigoManual.barrio} 
                        onChange={(e) => handleCodigoChange('barrio', e.target.value, 2)}
                        maxLength={2}
                        className="font-mono text-center"
                        placeholder="00"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-cyan-700">Manzana (14-17)</Label>
                      <Input 
                        value={codigoManual.manzana_vereda} 
                        onChange={(e) => handleCodigoChange('manzana_vereda', e.target.value, 4)}
                        maxLength={4}
                        className="font-mono text-center"
                        placeholder="0000"
                      />
                    </div>
                  </div>

                  {/* Campos editables - Fila 2: Predio y PH */}
                  <div className="grid grid-cols-5 gap-2">
                    <div className="bg-red-50 p-2 rounded border border-red-200">
                      <Label className="text-xs text-red-700 font-semibold">Terreno (18-21) *</Label>
                      <Input 
                        value={codigoManual.terreno} 
                        onChange={(e) => handleCodigoChange('terreno', e.target.value, 4)}
                        maxLength={4}
                        className="font-mono font-bold text-red-700 text-center"
                        placeholder="0001"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-orange-700">Condición (22)</Label>
                      <Select 
                        value={codigoManual.condicion} 
                        onValueChange={(v) => setCodigoManual({...codigoManual, condicion: v})}
                      >
                        <SelectTrigger className="font-mono">
                          <SelectValue placeholder="0" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0 - NPH (No Prop. Horizontal)</SelectItem>
                          <SelectItem value="2">2 - Informales</SelectItem>
                          <SelectItem value="3">3 - Bienes uso público (no vías)</SelectItem>
                          <SelectItem value="4">4 - Vías</SelectItem>
                          <SelectItem value="7">7 - Parques o cementerios</SelectItem>
                          <SelectItem value="8">8 - Condominio</SelectItem>
                          <SelectItem value="9">9 - PH (Propiedad Horizontal)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Edificio (23-24)</Label>
                      <Input 
                        value={codigoManual.edificio} 
                        onChange={(e) => handleCodigoChange('edificio', e.target.value, 2)}
                        maxLength={2}
                        className="font-mono text-center"
                        placeholder="00"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Piso (25-26)</Label>
                      <Input 
                        value={codigoManual.piso} 
                        onChange={(e) => handleCodigoChange('piso', e.target.value, 2)}
                        maxLength={2}
                        className="font-mono text-center"
                        placeholder="00"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Unidad (27-30)</Label>
                      <Input 
                        value={codigoManual.unidad} 
                        onChange={(e) => handleCodigoChange('unidad', e.target.value, 4)}
                        maxLength={4}
                        className="font-mono text-center"
                        placeholder="0000"
                      />
                    </div>
                  </div>

                  {/* Botón de verificar */}
                  <div className="mt-4 flex gap-3">
                    <Button onClick={verificarCodigoCompleto} variant="outline" className="flex-1">
                      <Search className="w-4 h-4 mr-2" />
                      Verificar Código
                    </Button>
                  </div>
                </div>
              )}

              {/* Info del terreno disponible */}
              {terrenoInfo && (
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg">
                  <h4 className="font-semibold text-emerald-800 mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Sugerencia para esta Manzana/Vereda
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-slate-500">Predios activos:</span>
                      <p className="font-bold text-emerald-700">{terrenoInfo.total_activos}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Siguiente terreno:</span>
                      <p className="font-bold text-emerald-700 text-lg">{terrenoInfo.siguiente_terreno}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Código sugerido:</span>
                      <p className="font-bold text-slate-800 text-xs font-mono">{terrenoInfo.codigo_sugerido}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Base Gráfica:</span>
                      <p className={`font-bold ${terrenoInfo.tiene_geometria_gdb ? 'text-emerald-700' : 'text-amber-600'}`}>
                        {terrenoInfo.tiene_geometria_gdb ? '✅ Disponible' : '⚠️ No disponible'}
                      </p>
                    </div>
                  </div>
                  {terrenoInfo.terrenos_eliminados?.length > 0 && (
                    <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700">
                      <span className="font-medium">⚠️ Terrenos eliminados (no reutilizables sin aprobación): </span>
                      {terrenoInfo.terrenos_eliminados.map(t => t.numero).join(', ')}
                    </div>
                  )}
                  {!terrenoInfo.tiene_geometria_gdb && (
                    <p className="mt-2 text-xs text-amber-700">{terrenoInfo.mensaje_geometria}</p>
                  )}
                </div>
              )}

              {/* Resultado de verificación */}
              {verificacionCodigo && (
                <div className={`p-4 rounded-lg border ${
                  verificacionCodigo.estado === 'disponible' ? 'bg-emerald-50 border-emerald-300' :
                  verificacionCodigo.estado === 'eliminado' ? 'bg-amber-50 border-amber-300' :
                  'bg-red-50 border-red-300'
                }`}>
                  <p className={`font-semibold ${
                    verificacionCodigo.estado === 'disponible' ? 'text-emerald-800' :
                    verificacionCodigo.estado === 'eliminado' ? 'text-amber-800' :
                    'text-red-800'
                  }`}>
                    {verificacionCodigo.mensaje}
                  </p>
                  
                  {verificacionCodigo.estado === 'eliminado' && (
                    <div className="mt-2 text-sm text-amber-700">
                      <p>Vigencia eliminación: {verificacionCodigo.detalles_eliminacion?.vigencia_eliminacion}</p>
                      <p>Motivo: {verificacionCodigo.detalles_eliminacion?.motivo}</p>
                      <p className="mt-2 font-medium">Si continúa, se creará una solicitud de reactivación para aprobación del coordinador.</p>
                    </div>
                  )}
                  
                  {verificacionCodigo.estado === 'existente' && (
                    <div className="mt-2 text-sm text-red-700">
                      <p>Propietario actual: {verificacionCodigo.predio?.nombre_propietario}</p>
                      <p>No puede crear un predio con este código.</p>
                    </div>
                  )}
                  
                  {verificacionCodigo.tiene_geometria !== undefined && (
                    <p className={`mt-2 text-sm ${verificacionCodigo.tiene_geometria ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {verificacionCodigo.tiene_geometria 
                        ? `✅ Tiene información gráfica (GDB) - Área: ${(verificacionCodigo.area_gdb || 0).toLocaleString()} m²`
                        : verificacionCodigo.mensaje_geometria || '⚠️ Sin información gráfica'
                      }
                    </p>
                  )}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="propietario" className="space-y-4 mt-4">
              {/* Sección de Propietarios - Múltiples */}
              <div className="flex justify-between items-center">
                <h4 className="font-semibold text-slate-800">Propietarios</h4>
                <Button type="button" variant="outline" size="sm" onClick={agregarPropietario} className="text-emerald-700">
                  <Plus className="w-4 h-4 mr-1" /> Agregar Propietario
                </Button>
              </div>
              
              {propietarios.map((prop, index) => (
                <div key={index} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-medium text-slate-700">Propietario {index + 1}</span>
                    {propietarios.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => eliminarPropietario(index)} className="text-red-600 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label className="text-xs">Nombre Completo *</Label>
                      <Input 
                        value={prop.nombre_propietario} 
                        onChange={(e) => actualizarPropietario(index, 'nombre_propietario', e.target.value.toUpperCase())}
                        placeholder="NOMBRE COMPLETO DEL PROPIETARIO"
                      />
                    </div>
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
                      <Label className="text-xs">Número Documento *</Label>
                      <Input 
                        value={prop.numero_documento} 
                        onChange={(e) => actualizarPropietario(index, 'numero_documento', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-2 block">Estado Civil</Label>
                      <RadioGroup 
                        value={prop.estado_civil || ""} 
                        onValueChange={(v) => actualizarPropietario(index, 'estado_civil', v)}
                        className="flex flex-wrap gap-3"
                      >
                        <div className="flex items-center space-x-1">
                          <RadioGroupItem value="" id={`estado_civil_${index}_none`} />
                          <Label htmlFor={`estado_civil_${index}_none`} className="text-xs cursor-pointer text-slate-500">Sin especificar</Label>
                        </div>
                        {catalogos?.estado_civil && Object.entries(catalogos.estado_civil).map(([k, v]) => (
                          <div key={k} className="flex items-center space-x-1">
                            <RadioGroupItem value={k} id={`estado_civil_${index}_${k}`} />
                            <Label htmlFor={`estado_civil_${index}_${k}`} className="text-xs cursor-pointer">{v}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Información general del predio */}
              <div className="border-t border-slate-200 pt-4 mt-4">
                <h4 className="font-semibold text-slate-800 mb-3">Información del Predio</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Dirección *</Label>
                    <Input value={formData.direccion} onChange={(e) => setFormData({...formData, direccion: e.target.value.toUpperCase()})} />
                  </div>
                  <div className="col-span-2">
                    <Label className="mb-2 block">Destino Económico *</Label>
                    <RadioGroup 
                      value={formData.destino_economico} 
                      onValueChange={(v) => setFormData({...formData, destino_economico: v})}
                      className="flex flex-wrap gap-3"
                    >
                      {catalogos?.destino_economico && Object.entries(catalogos.destino_economico).map(([k, v]) => (
                        <div key={k} className="flex items-center space-x-1">
                          <RadioGroupItem value={k} id={`destino_${k}`} />
                          <Label htmlFor={`destino_${k}`} className="text-xs cursor-pointer">{k} - {v}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                  <div>
                    <Label>Matrícula Inmobiliaria</Label>
                    <Input value={formData.matricula_inmobiliaria} onChange={(e) => setFormData({...formData, matricula_inmobiliaria: e.target.value})} placeholder="Ej: 270-8920" />
                  </div>
                  <div>
                    <Label>Área Terreno (m²) *</Label>
                    <Input type="number" value={formData.area_terreno} onChange={(e) => setFormData({...formData, area_terreno: e.target.value})} />
                  </div>
                  <div>
                    <Label>Área Construida (m²)</Label>
                    <Input type="number" value={formData.area_construida} onChange={(e) => setFormData({...formData, area_construida: e.target.value})} />
                  </div>
                  <div className="col-span-2">
                    <Label>Avalúo (COP) *</Label>
                    <Input type="number" value={formData.avaluo} onChange={(e) => setFormData({...formData, avaluo: e.target.value})} />
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="fisico" className="space-y-4 mt-4">
              {/* Sección de Zonas Físicas - Múltiples */}
              <div className="flex justify-between items-center">
                <h4 className="font-semibold text-slate-800">Zonas Físicas (R2)</h4>
                <Button type="button" variant="outline" size="sm" onClick={agregarZonaFisica} className="text-emerald-700">
                  <Plus className="w-4 h-4 mr-1" /> Agregar Zona
                </Button>
              </div>
              
              {zonasFisicas.map((zona, index) => (
                <div key={index} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-medium text-slate-700">Zona Física {index + 1}</span>
                    {zonasFisicas.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => eliminarZonaFisica(index)} className="text-red-600 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Zona Física</Label>
                      <Input type="number" value={zona.zona_fisica} onChange={(e) => actualizarZonaFisica(index, 'zona_fisica', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Zona Económica</Label>
                      <Input type="number" value={zona.zona_economica} onChange={(e) => actualizarZonaFisica(index, 'zona_economica', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Área Terreno (m²)</Label>
                      <Input type="number" value={zona.area_terreno} onChange={(e) => actualizarZonaFisica(index, 'area_terreno', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Habitaciones</Label>
                      <Input type="number" value={zona.habitaciones} onChange={(e) => actualizarZonaFisica(index, 'habitaciones', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Baños</Label>
                      <Input type="number" value={zona.banos} onChange={(e) => actualizarZonaFisica(index, 'banos', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Locales</Label>
                      <Input type="number" value={zona.locales} onChange={(e) => actualizarZonaFisica(index, 'locales', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Pisos</Label>
                      <Input type="number" value={zona.pisos} onChange={(e) => actualizarZonaFisica(index, 'pisos', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Puntaje</Label>
                      <Input type="number" value={zona.puntaje} onChange={(e) => actualizarZonaFisica(index, 'puntaje', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Área Construida (m²)</Label>
                      <Input type="number" value={zona.area_construida} onChange={(e) => actualizarZonaFisica(index, 'area_construida', e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
          
          {/* Toggle para usar el nuevo flujo de trabajo */}
          <div className="border-t border-slate-200 pt-4 mt-4">
            <div className="flex items-center gap-2 mb-4">
              <input 
                type="checkbox" 
                id="usar-nuevo-flujo" 
                checked={usarNuevoFlujo}
                onChange={(e) => setUsarNuevoFlujo(e.target.checked)}
                className="rounded border-emerald-300 text-emerald-600"
              />
              <Label htmlFor="usar-nuevo-flujo" className="text-sm font-medium text-emerald-700 cursor-pointer">
                📋 Usar flujo de trabajo con Gestor de Apoyo (Conservación)
              </Label>
            </div>
            
            {usarNuevoFlujo ? (
              <div className="space-y-4 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="text-sm text-emerald-800 mb-3">
                  <p className="font-medium mb-1">Flujo de Trabajo:</p>
                  <p className="text-xs text-emerald-600">
                    Creado → Digitalización (Gestor Apoyo) → Revisión → Aprobado/Devuelto/Rechazado
                  </p>
                </div>
                
                {/* Gestor de Apoyo (Obligatorio) */}
                <div>
                  <Label className="text-sm font-medium">Gestor de Apoyo *</Label>
                  <p className="text-xs text-slate-500 mb-1">Responsable de completar la digitalización del predio</p>
                  <Select 
                    value={gestorAsignado || "seleccionar"} 
                    onValueChange={(v) => setGestorAsignado(v === "seleccionar" ? "" : v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccione un gestor de apoyo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seleccionar" disabled>Seleccione un gestor...</SelectItem>
                      {gestoresDisponibles.map(g => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.full_name} ({g.role === 'gestor' ? 'Gestor' : g.role === 'coordinador' ? 'Coordinador' : 'Atención'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Radicado relacionado */}
                <div>
                  <Label className="text-sm font-medium">Radicado Relacionado (Opcional)</Label>
                  <p className="text-xs text-slate-500 mb-1">Formato: RASMGC-XXXX-DD-MM-AAAA (solo ingrese XXXX)</p>
                  <div className="flex gap-2">
                    <div className="flex items-center bg-slate-100 px-3 py-2 rounded-l border border-r-0 text-sm text-slate-600">
                      RASMGC-
                    </div>
                    <Input 
                      type="text"
                      value={radicadoNumero}
                      onChange={(e) => {
                        const valor = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
                        setRadicadoNumero(valor);
                      }}
                      placeholder="5511"
                      maxLength={4}
                      className="w-24 text-center font-mono"
                    />
                    <div className="flex items-center bg-slate-100 px-3 py-2 border text-sm text-slate-600">
                      -{radicadoInfo?.encontrado ? radicadoInfo.fecha : 'DD-MM-AAAA'}
                    </div>
                    <Button 
                      type="button" 
                      variant="outline"
                      size="sm"
                      onClick={() => buscarRadicado(radicadoNumero)}
                      disabled={buscandoRadicado || !radicadoNumero}
                    >
                      {buscandoRadicado ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </Button>
                  </div>
                  {radicadoInfo && (
                    <div className={`mt-2 p-2 rounded text-xs ${radicadoInfo.encontrado ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {radicadoInfo.encontrado ? (
                        <>
                          <p><strong>Radicado:</strong> {radicadoInfo.radicado_completo}</p>
                          {radicadoInfo.solicitante && <p><strong>Solicitante:</strong> {radicadoInfo.solicitante}</p>}
                          {radicadoInfo.tipo_tramite && <p><strong>Tipo:</strong> {radicadoInfo.tipo_tramite}</p>}
                        </>
                      ) : (
                        <p>{radicadoInfo.mensaje}</p>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Peticiones relacionadas (Multi-select) */}
                <div>
                  <Label className="text-sm font-medium">Peticiones Relacionadas (Opcional)</Label>
                  <p className="text-xs text-slate-500 mb-1">Vincule trámites existentes a este predio</p>
                  {peticionesDisponibles.length > 0 ? (
                    <div className="max-h-32 overflow-y-auto border rounded p-2 bg-white">
                      {peticionesDisponibles.slice(0, 10).map(p => (
                        <div key={p.id} className="flex items-center gap-2 py-1">
                          <input
                            type="checkbox"
                            id={`peticion-${p.id}`}
                            checked={peticionesRelacionadas.includes(p.id)}
                            onChange={() => togglePeticionRelacionada(p.id)}
                            className="rounded border-slate-300"
                          />
                          <label htmlFor={`peticion-${p.id}`} className="text-xs cursor-pointer flex-1">
                            <span className="font-mono text-emerald-700">{p.radicado}</span>
                            <span className="text-slate-500 ml-2">{p.nombre_completo}</span>
                          </label>
                        </div>
                      ))}
                      {peticionesDisponibles.length > 10 && (
                        <p className="text-xs text-slate-400 mt-1">+{peticionesDisponibles.length - 10} más...</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No hay peticiones activas disponibles</p>
                  )}
                  {peticionesRelacionadas.length > 0 && (
                    <p className="text-xs text-emerald-600 mt-1">
                      ✓ {peticionesRelacionadas.length} petición(es) seleccionada(s)
                    </p>
                  )}
                </div>
                
                {/* Observaciones */}
                <div>
                  <Label className="text-sm font-medium">Observaciones (Opcional)</Label>
                  <textarea
                    value={observacionesCreacion}
                    onChange={(e) => setObservacionesCreacion(e.target.value)}
                    placeholder="Instrucciones especiales para el Gestor de Apoyo..."
                    className="w-full mt-1 p-2 border rounded text-sm min-h-[60px]"
                  />
                </div>
              </div>
            ) : (
              <>
                {/* Opción original para asignar a otro gestor */}
                <div className="flex items-center gap-2 mb-3">
                  <input 
                    type="checkbox" 
                    id="asignar-gestor" 
                    checked={!!gestorAsignado}
                    onChange={(e) => !e.target.checked && setGestorAsignado('')}
                    className="rounded border-slate-300"
                  />
                  <Label htmlFor="asignar-gestor" className="text-sm text-slate-700 cursor-pointer">
                    Asignar a otro gestor para que continúe/termine el diligenciamiento
                  </Label>
                </div>
                
                {gestorAsignado && gestoresDisponibles.length > 0 && (
                  <Select value={gestorAsignado || "sin_asignar"} onValueChange={(v) => setGestorAsignado(v === "sin_asignar" ? "" : v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccione un gestor para asignar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sin_asignar">Sin asignar (yo lo completo)</SelectItem>
                      {gestoresDisponibles.map(g => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.full_name} ({g.role === 'gestor' ? 'Gestor' : g.role === 'gestor_auxiliar' ? 'Gestor Auxiliar' : g.role === 'coordinador' ? 'Coordinador' : 'Atención al Usuario'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                
                {gestorAsignado && (
                  <p className="text-xs text-amber-600 mt-2">
                    ⚠️ El gestor asignado recibirá una notificación y podrá continuar con el diligenciamiento.
                  </p>
                )}
              </>
            )}
          </div>
          
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => handleCloseDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreate} className="bg-emerald-700 hover:bg-emerald-800">
              {usarNuevoFlujo ? 'Crear y Asignar a Flujo' : (gestorAsignado ? 'Guardar y Asignar' : 'Crear Predio')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación al cerrar sin completar */}
      <Dialog open={showConfirmClose} onOpenChange={setShowConfirmClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-amber-700 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Predio sin completar
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-slate-700 mb-4">
              Has iniciado el registro de un nuevo predio pero no lo has completado ni enviado para revisión.
            </p>
            <p className="text-slate-600 text-sm mb-4">
              <strong>¿Deseas asignar a otro gestor</strong> para que continúe con el diligenciamiento?
            </p>
            
            {gestoresDisponibles.length > 0 && (
              <Select value={gestorAsignado || "sin_asignar"} onValueChange={(v) => setGestorAsignado(v === "sin_asignar" ? "" : v)}>
                <SelectTrigger className="w-full mb-4">
                  <SelectValue placeholder="Seleccione un gestor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sin_asignar">No asignar a nadie</SelectItem>
                  {gestoresDisponibles.map(g => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.full_name} ({g.role === 'gestor' ? 'Gestor' : g.role === 'gestor_auxiliar' ? 'Auxiliar' : 'Coordinador'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={confirmarCierreSinGuardar} className="text-red-600 hover:text-red-700">
              Descartar cambios
            </Button>
            {gestorAsignado ? (
              <Button onClick={handleCreate} className="bg-emerald-700 hover:bg-emerald-800">
                Guardar y Asignar
              </Button>
            ) : (
              <Button onClick={() => setShowConfirmClose(false)} className="bg-blue-600 hover:bg-blue-700">
                Continuar editando
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-outfit">Editar Predio - {selectedPredio?.codigo_predial_nacional}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-sm text-slate-600">
                <strong>Código Predial Nacional:</strong> {selectedPredio?.codigo_predial_nacional}
              </p>
              {(selectedPredio?.r2_registros?.[0]?.matricula_inmobiliaria || selectedPredio?.matricula_inmobiliaria) && (
                <p className="text-sm text-slate-600 mt-1">
                  <strong>Matrícula Inmobiliaria:</strong> {selectedPredio?.r2_registros?.[0]?.matricula_inmobiliaria || selectedPredio?.matricula_inmobiliaria}
                </p>
              )}
            </div>
            
            {/* Sección de Propietarios */}
            <div className="border border-slate-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-slate-800">Propietarios</h4>
                <Button type="button" variant="outline" size="sm" onClick={agregarPropietario} className="text-emerald-700">
                  <Plus className="w-4 h-4 mr-1" /> Agregar Propietario
                </Button>
              </div>
              
              {propietarios.map((prop, index) => (
                <div key={index} className="border border-slate-200 rounded-lg p-4 bg-slate-50 mb-3">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-medium text-slate-700">Propietario {index + 1}</span>
                    {propietarios.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => eliminarPropietario(index)} className="text-red-600 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label className="text-xs">Nombre Completo *</Label>
                      <Input 
                        value={prop.nombre_propietario} 
                        onChange={(e) => actualizarPropietario(index, 'nombre_propietario', e.target.value.toUpperCase())}
                        placeholder="NOMBRE COMPLETO DEL PROPIETARIO"
                      />
                    </div>
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
                      <Label className="text-xs">Número Documento *</Label>
                      <Input 
                        value={prop.numero_documento} 
                        onChange={(e) => actualizarPropietario(index, 'numero_documento', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-2 block">Estado Civil</Label>
                      <RadioGroup 
                        value={prop.estado_civil || ""} 
                        onValueChange={(v) => actualizarPropietario(index, 'estado_civil', v)}
                        className="flex flex-wrap gap-3"
                      >
                        <div className="flex items-center space-x-1">
                          <RadioGroupItem value="" id={`estado_civil_${index}_none`} />
                          <Label htmlFor={`estado_civil_${index}_none`} className="text-xs cursor-pointer text-slate-500">Sin especificar</Label>
                        </div>
                        {catalogos?.estado_civil && Object.entries(catalogos.estado_civil).map(([k, v]) => (
                          <div key={k} className="flex items-center space-x-1">
                            <RadioGroupItem value={k} id={`estado_civil_${index}_${k}`} />
                            <Label htmlFor={`estado_civil_${index}_${k}`} className="text-xs cursor-pointer">{v}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Información del Predio */}
            <div className="border border-slate-200 rounded-lg p-4">
              <h4 className="font-semibold text-slate-800 mb-3">Información del Predio</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Dirección *</Label>
                  <Input value={formData.direccion} onChange={(e) => setFormData({...formData, direccion: e.target.value.toUpperCase()})} />
                </div>
                <div className="col-span-2">
                  <Label className="mb-2 block">Destino Económico *</Label>
                  <RadioGroup 
                    value={formData.destino_economico} 
                    onValueChange={(v) => setFormData({...formData, destino_economico: v})}
                    className="flex flex-wrap gap-3"
                  >
                    {catalogos?.destino_economico && Object.entries(catalogos.destino_economico).map(([k, v]) => (
                      <div key={k} className="flex items-center space-x-1">
                        <RadioGroupItem value={k} id={`destino_edit_${k}`} />
                        <Label htmlFor={`destino_edit_${k}`} className="text-xs cursor-pointer">{k} - {v}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
                <div>
                  <Label>Avalúo (COP) *</Label>
                  <Input type="number" value={formData.avaluo} onChange={(e) => setFormData({...formData, avaluo: e.target.value})} />
                </div>
                <div>
                  <Label>Área Terreno (m²)</Label>
                  <Input type="number" value={formData.area_terreno} onChange={(e) => setFormData({...formData, area_terreno: e.target.value})} />
                </div>
                <div>
                  <Label>Área Construida (m²)</Label>
                  <Input type="number" value={formData.area_construida} onChange={(e) => setFormData({...formData, area_construida: e.target.value})} />
                </div>
                <div>
                  <Label>Matrícula Inmobiliaria</Label>
                  <Input value={formData.matricula_inmobiliaria} onChange={(e) => setFormData({...formData, matricula_inmobiliaria: e.target.value})} />
                </div>
              </div>
            </div>
            
            {/* Zonas Físicas R2 */}
            <div className="border border-slate-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-slate-800">Zonas Físicas (R2)</h4>
                <Button type="button" variant="outline" size="sm" onClick={agregarZonaFisica} className="text-emerald-700">
                  <Plus className="w-4 h-4 mr-1" /> Agregar Zona
                </Button>
              </div>
              
              {zonasFisicas.map((zona, index) => (
                <div key={index} className="border border-slate-200 rounded-lg p-3 bg-slate-50 mb-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-slate-700">Zona {index + 1}</span>
                    {zonasFisicas.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => eliminarZonaFisica(index)} className="text-red-600 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Zona Física</Label>
                      <Input type="text" className="h-8 text-xs" value={zona.zona_fisica} onChange={(e) => actualizarZonaFisica(index, 'zona_fisica', e.target.value)} placeholder="Ej: 01, 02..." />
                    </div>
                    <div>
                      <Label className="text-xs">Zona Económica</Label>
                      <Input type="text" className="h-8 text-xs" value={zona.zona_economica} onChange={(e) => actualizarZonaFisica(index, 'zona_economica', e.target.value)} placeholder="Ej: A, B, C..." />
                    </div>
                    <div>
                      <Label className="text-xs">Área Terreno</Label>
                      <Input type="number" className="h-8 text-xs" value={zona.area_terreno} onChange={(e) => actualizarZonaFisica(index, 'area_terreno', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Habitaciones</Label>
                      <Input type="number" className="h-8 text-xs" value={zona.habitaciones} onChange={(e) => actualizarZonaFisica(index, 'habitaciones', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Baños</Label>
                      <Input type="number" className="h-8 text-xs" value={zona.banos} onChange={(e) => actualizarZonaFisica(index, 'banos', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Pisos</Label>
                      <Input type="number" className="h-8 text-xs" value={zona.pisos} onChange={(e) => actualizarZonaFisica(index, 'pisos', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Área Construida</Label>
                      <Input type="number" className="h-8 text-xs" value={zona.area_construida} onChange={(e) => actualizarZonaFisica(index, 'area_construida', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Puntaje</Label>
                      <Input type="number" className="h-8 text-xs" value={zona.puntaje} onChange={(e) => actualizarZonaFisica(index, 'puntaje', e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Selector de Radicado Asociado - Solo para gestores (no coordinadores/admin que aprueban directamente) */}
          {!['coordinador', 'administrador'].includes(user?.role) && (
            <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 mt-4">
              <Label className="text-blue-800 font-medium flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Radicado Asociado (Requerido)
              </Label>
              <p className="text-xs text-blue-600 mt-1 mb-2">
                Seleccione la petición/radicado que justifica esta modificación
              </p>
              <Select value={radicadoSeleccionado} onValueChange={setRadicadoSeleccionado}>
                <SelectTrigger className="border-blue-300">
                  <SelectValue placeholder="Seleccione un radicado..." />
                </SelectTrigger>
                <SelectContent>
                  {peticionesDisponibles.length === 0 ? (
                    <SelectItem value="none" disabled>No hay peticiones disponibles</SelectItem>
                  ) : (
                    peticionesDisponibles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.radicado} - {p.tipo_tramite} ({p.nombre_completo})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {!radicadoSeleccionado && (
                <p className="text-xs text-amber-600 mt-2">
                  ⚠️ Debe seleccionar un radicado para justificar la modificación
                </p>
              )}
            </div>
          )}
          
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => { setShowEditDialog(false); setRadicadoSeleccionado(''); }}>Cancelar</Button>
            <Button 
              onClick={handleUpdate} 
              className="bg-emerald-700 hover:bg-emerald-800"
              disabled={!['coordinador', 'administrador'].includes(user?.role) && !radicadoSeleccionado}
            >
              Guardar Cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deleted Predios Dialog */}
      <Dialog open={showDeletedDialog} onOpenChange={setShowDeletedDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-outfit flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              Predios Eliminados
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Los siguientes predios han sido eliminados del sistema. Sus números de terreno no pueden ser reutilizados.
            </p>
            
            {prediosEliminados.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                No hay predios eliminados
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-red-50">
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Código</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Propietario</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Municipio</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Terreno</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Fecha Eliminación</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Eliminado Por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prediosEliminados.map((predio) => (
                      <tr key={predio.id} className="border-b border-slate-100 hover:bg-red-50/50">
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-900">{predio.codigo_homologado}</p>
                        </td>
                        <td className="py-3 px-4 text-slate-700">{predio.nombre_propietario}</td>
                        <td className="py-3 px-4 text-slate-700">{predio.municipio}</td>
                        <td className="py-3 px-4">
                          <Badge variant="destructive">{predio.terreno}</Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {predio.deleted_at ? new Date(predio.deleted_at).toLocaleDateString('es-CO') : 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-slate-500">{predio.deleted_by_name || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg text-sm">
              <p className="font-semibold text-amber-800">Importante:</p>
              <p className="text-amber-700">
                Los números de terreno de predios eliminados no pueden ser reutilizados para mantener la integridad del sistema catastral.
              </p>
            </div>
          </div>
          
          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={() => setShowDeletedDialog(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Subsanaciones Pendientes Dialog */}
      <Dialog open={showSubsanacionesDialog} onOpenChange={(open) => { 
        setShowSubsanacionesDialog(open);
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-outfit flex items-center gap-2 text-orange-700">
              <RefreshCw className="w-5 h-5" />
              Subsanaciones de Reapariciones {filterMunicipio ? `- ${filterMunicipio}` : ''}
            </DialogTitle>
          </DialogHeader>
          <SubsanacionesPendientes 
            municipio={filterMunicipio || null} 
            onUpdate={() => { fetchReaparicionesConteo(); fetchSubsanacionesConteo(); fetchPredios(); }}
          />
        </DialogContent>
      </Dialog>

      {/* Pending Changes Dialog with History Tabs */}
      <Dialog open={showPendientesDialog} onOpenChange={(open) => {
        setShowPendientesDialog(open);
        if (open && historialTab === 'historial') {
          fetchCambiosHistorial();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-outfit flex items-center gap-2">
              <FileEdit className="w-5 h-5 text-amber-600" />
              Gestión de Cambios
            </DialogTitle>
            <DialogDescription>
              Revise y procese las solicitudes de cambios de predios
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Tabs for Pending and History */}
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => setHistorialTab('pendientes')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  historialTab === 'pendientes' 
                    ? 'border-amber-500 text-amber-700' 
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Pendientes ({cambiosStats?.total_pendientes || 0})
              </button>
              <button
                onClick={() => {
                  setHistorialTab('historial');
                  fetchCambiosHistorial();
                }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  historialTab === 'historial' 
                    ? 'border-emerald-500 text-emerald-700' 
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Historial {cambiosStats?.total_historial > 0 && (
                  <span className="ml-1 px-2 py-0.5 text-xs bg-slate-200 text-slate-600 rounded-full">
                    {cambiosStats.total_historial}
                  </span>
                )}
              </button>
            </div>

            {/* Stats only shown in pendientes tab */}
            {historialTab === 'pendientes' && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-emerald-700">{cambiosStats?.pendientes_creacion || 0}</p>
                  <p className="text-xs text-slate-500">Creaciones</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-700">{cambiosStats?.pendientes_modificacion || 0}</p>
                  <p className="text-xs text-slate-500">Modificaciones</p>
                </div>
                <div className="bg-red-50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-red-700">{cambiosStats?.pendientes_eliminacion || 0}</p>
                  <p className="text-xs text-slate-500">Eliminaciones</p>
                </div>
              </div>
            )}

            {/* Pendientes Tab Content */}
            {historialTab === 'pendientes' && (
              <>
                {cambiosPendientes.length === 0 ? (
                  <div className="py-8 text-center text-slate-500">
                    No hay cambios pendientes de aprobación
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cambiosPendientes.map((cambio) => (
                      <Card key={cambio.id} className="border-l-4 border-l-amber-400">
                        <CardContent className="pt-4">
                          <div className="space-y-4">
                            {/* Header */}
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant={
                                    cambio.tipo_cambio === 'creacion' ? 'default' :
                                    cambio.tipo_cambio === 'modificacion' ? 'secondary' : 'destructive'
                                  }>
                                    {cambio.tipo_cambio === 'creacion' ? 'Nuevo Predio' :
                                     cambio.tipo_cambio === 'modificacion' ? 'Modificación' : 'Eliminación'}
                                  </Badge>
                                  <span className="text-xs text-slate-500">
                                    {new Date(cambio.fecha_propuesta).toLocaleString('es-CO')}
                                  </span>
                                </div>
                                
                                {cambio.predio_actual && (
                                  <p className="text-sm"><strong>Predio actual:</strong> {cambio.predio_actual.codigo_homologado} - {cambio.predio_actual.nombre_propietario}</p>
                                )}
                                <p className="text-sm"><strong>Propuesto por:</strong> {cambio.propuesto_por_nombre} ({cambio.propuesto_por_rol})</p>
                                {cambio.justificacion && (
                                  <p className="text-sm text-slate-600"><strong>Justificación:</strong> {cambio.justificacion}</p>
                                )}
                              </div>
                              
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  className="bg-emerald-600 hover:bg-emerald-700"
                                  onClick={() => handleAprobarRechazar(cambio.id, true, 'Aprobado')}
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Aprobar
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  onClick={() => {
                                    const comentario = window.prompt('Motivo del rechazo:');
                                    if (comentario !== null) {
                                      handleAprobarRechazar(cambio.id, false, comentario);
                                    }
                                  }}
                                >
                                  <XCircle className="w-4 h-4 mr-1" />
                                  Rechazar
                                </Button>
                              </div>
                            </div>

                            {/* Datos propuestos expandibles - Solo muestra campos que realmente cambiaron */}
                            <details className="bg-slate-50 rounded-lg p-3">
                              <summary className="cursor-pointer font-medium text-sm text-slate-700 flex items-center gap-2">
                                <Eye className="w-4 h-4" />
                                Ver cambios propuestos
                              </summary>
                              <div className="mt-3 space-y-2 text-sm">
                                {(() => {
                                  const propuestos = cambio.datos_propuestos || {};
                                  const original = cambio.predio_actual || {};
                                  const cambiosReales = [];

                                  // Comparar nombre_propietario
                                  if (propuestos.nombre_propietario !== undefined && propuestos.nombre_propietario !== original.nombre_propietario) {
                                    cambiosReales.push({
                                      label: 'Propietario',
                                      antes: original.nombre_propietario || 'N/A',
                                      despues: propuestos.nombre_propietario
                                    });
                                  }
                                  // Comparar direccion
                                  if (propuestos.direccion !== undefined && propuestos.direccion !== original.direccion) {
                                    cambiosReales.push({
                                      label: 'Dirección',
                                      antes: original.direccion || 'N/A',
                                      despues: propuestos.direccion
                                    });
                                  }
                                  // Comparar destino_economico
                                  if (propuestos.destino_economico !== undefined && propuestos.destino_economico !== original.destino_economico) {
                                    cambiosReales.push({
                                      label: 'Destino Económico',
                                      antes: original.destino_economico || 'N/A',
                                      despues: propuestos.destino_economico
                                    });
                                  }
                                  // Comparar area_terreno
                                  if (propuestos.area_terreno !== undefined && propuestos.area_terreno !== original.area_terreno) {
                                    cambiosReales.push({
                                      label: 'Área Terreno',
                                      antes: original.area_terreno ? `${original.area_terreno.toLocaleString()} m²` : 'N/A',
                                      despues: `${propuestos.area_terreno?.toLocaleString()} m²`
                                    });
                                  }
                                  // Comparar area_construida
                                  if (propuestos.area_construida !== undefined && propuestos.area_construida !== original.area_construida) {
                                    cambiosReales.push({
                                      label: 'Área Construida',
                                      antes: original.area_construida ? `${original.area_construida.toLocaleString()} m²` : 'N/A',
                                      despues: `${propuestos.area_construida?.toLocaleString()} m²`
                                    });
                                  }
                                  // Comparar avaluo
                                  if (propuestos.avaluo !== undefined && propuestos.avaluo !== original.avaluo) {
                                    cambiosReales.push({
                                      label: 'Avalúo',
                                      antes: original.avaluo ? formatCurrency(original.avaluo) : 'N/A',
                                      despues: formatCurrency(propuestos.avaluo),
                                      highlight: true
                                    });
                                  }
                                  // Comparar tipo_documento
                                  if (propuestos.tipo_documento !== undefined && propuestos.tipo_documento !== original.tipo_documento) {
                                    cambiosReales.push({
                                      label: 'Tipo Documento',
                                      antes: original.tipo_documento || 'N/A',
                                      despues: propuestos.tipo_documento
                                    });
                                  }
                                  // Comparar numero_documento
                                  if (propuestos.numero_documento !== undefined && propuestos.numero_documento !== original.numero_documento) {
                                    cambiosReales.push({
                                      label: 'Nro. Documento',
                                      antes: original.numero_documento || 'N/A',
                                      despues: propuestos.numero_documento
                                    });
                                  }

                                  if (cambiosReales.length === 0) {
                                    return <p className="text-slate-500 italic">No se detectaron cambios en los campos comparables</p>;
                                  }

                                  return cambiosReales.map((c, idx) => (
                                    <div key={idx} className="bg-white rounded p-2 border border-slate-200">
                                      <span className="font-medium text-slate-700">{c.label}:</span>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-red-600 line-through text-xs">{c.antes}</span>
                                        <span className="text-slate-400">→</span>
                                        <strong className={c.highlight ? 'text-emerald-700' : 'text-blue-700'}>{c.despues}</strong>
                                      </div>
                                    </div>
                                  ));
                                })()}
                              </div>
                            </details>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Historial Tab Content */}
            {historialTab === 'historial' && (
              <>
                {cambiosHistorial.length === 0 ? (
                  <div className="py-8 text-center text-slate-500">
                    No hay historial de cambios procesados
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cambiosHistorial.map((cambio) => (
                      <Card key={cambio.id} className={`border-l-4 ${
                        cambio.estado === 'aprobado' ? 'border-l-emerald-500 bg-emerald-50/50' : 'border-l-red-500 bg-red-50/50'
                      }`}>
                        <CardContent className="py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant={cambio.estado === 'aprobado' ? 'default' : 'destructive'} className={
                                  cambio.estado === 'aprobado' ? 'bg-emerald-600' : ''
                                }>
                                  {cambio.estado === 'aprobado' ? '✓ Aprobado' : '✗ Rechazado'}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {cambio.tipo_cambio === 'creacion' ? 'Creación' :
                                   cambio.tipo_cambio === 'modificacion' ? 'Modificación' : 'Eliminación'}
                                </Badge>
                              </div>
                              {cambio.predio_actual && (
                                <p className="text-sm text-slate-700">
                                  <strong>{cambio.predio_actual.codigo_homologado || cambio.predio_actual.codigo_predial_nacional}</strong>
                                  {cambio.predio_actual.nombre_propietario && ` - ${cambio.predio_actual.nombre_propietario}`}
                                </p>
                              )}
                              <p className="text-xs text-slate-500 mt-1">
                                Solicitado por: {cambio.propuesto_por_nombre}
                              </p>
                              {cambio.comentario_aprobacion && (
                                <p className="text-xs text-slate-600 mt-1 italic">
                                  &ldquo;{cambio.comentario_aprobacion}&rdquo;
                                </p>
                              )}
                            </div>
                            <div className="text-right text-xs text-slate-500">
                              <p>{cambio.fecha_decision ? new Date(cambio.fecha_decision).toLocaleDateString('es-CO') : 'N/A'}</p>
                              <p className="text-slate-400">{cambio.decidido_por_nombre || 'Sistema'}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          
          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={() => setShowPendientesDialog(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-outfit flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-700" />
              Detalle del Predio - {selectedPredio?.codigo_predial_nacional}
            </DialogTitle>
          </DialogHeader>
          
          {selectedPredio && (
            <div className="space-y-6">
              {/* Botón Generar Certificado Catastral */}
              {['coordinador', 'administrador', 'atencion_usuario'].includes(user?.role) && (
                <div className="flex justify-end">
                  <Button
                    variant="default"
                    className="bg-emerald-700 hover:bg-emerald-800"
                    onClick={async () => {
                      try {
                        toast.info('Generando certificado catastral...');
                        const token = localStorage.getItem('token');
                        const response = await fetch(`${API}/predios/${selectedPredio.id}/certificado`, {
                          headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (!response.ok) throw new Error('Error generando certificado');
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `Certificado_Catastral_${selectedPredio.codigo_predial_nacional}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                        toast.success('Certificado descargado correctamente');
                      } catch (error) {
                        console.error('Error:', error);
                        toast.error('Error al generar el certificado');
                      }
                    }}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Generar Certificado Catastral
                  </Button>
                </div>
              )}
              
              {/* Códigos - Orden: CPN, Matrícula, Homologado */}
              <div className="bg-emerald-50 p-4 rounded-lg">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <p className="text-xs text-slate-500">Código Predial Nacional (30 dígitos)</p>
                    <p className="font-mono text-lg font-bold text-emerald-800">{selectedPredio.codigo_predial_nacional}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500">Matrícula Inmobiliaria</p>
                      <p className="font-medium text-slate-700">
                        {selectedPredio.r2_registros?.[0]?.matricula_inmobiliaria || (
                          <span className="text-slate-400 italic">Sin información de matrícula</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Código Homologado</p>
                      <p className="font-medium text-slate-700">{selectedPredio.codigo_homologado || selectedPredio.codigo_anterior || 'Sin código homologado'}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Ubicación */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4" /> Ubicación - Código Nacional Predial
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-4 text-sm">
                  <div className="col-span-3 bg-emerald-50 p-2 rounded">
                    <span className="text-slate-500">CPN:</span> <strong className="text-emerald-800">{selectedPredio.codigo_predial_nacional}</strong>
                  </div>
                  <div><span className="text-slate-500">Departamento:</span> <strong>{selectedPredio.departamento || getCodigoPartes(selectedPredio.codigo_predial_nacional).departamento}</strong></div>
                  <div><span className="text-slate-500">Municipio:</span> <strong>{selectedPredio.municipio}</strong></div>
                  <div><span className="text-slate-500">Zona:</span> <strong>{getZonaFromCodigo(selectedPredio.codigo_predial_nacional).texto}</strong></div>
                  <div><span className="text-slate-500">Sector:</span> <strong>{selectedPredio.sector || getCodigoPartes(selectedPredio.codigo_predial_nacional).sector}</strong></div>
                  <div><span className="text-slate-500">Manzana/Vereda:</span> <strong>{selectedPredio.manzana_vereda || getCodigoPartes(selectedPredio.codigo_predial_nacional).manzana_vereda}</strong></div>
                  <div><span className="text-slate-500">Terreno:</span> <strong>{selectedPredio.terreno || getCodigoPartes(selectedPredio.codigo_predial_nacional).terreno}</strong></div>
                </CardContent>
              </Card>
              
              {/* Propietarios (R1) */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4" /> 
                    Propietarios (R1)
                    {selectedPredio.propietarios?.length > 1 && (
                      <Badge variant="secondary">{selectedPredio.propietarios.length} propietarios</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedPredio.propietarios && selectedPredio.propietarios.length > 0 ? (
                    <div className="space-y-3">
                      {selectedPredio.propietarios.map((prop, idx) => (
                        <div key={idx} className={`grid grid-cols-2 gap-4 text-sm ${idx > 0 ? 'border-t pt-3' : ''}`}>
                          <div className="col-span-2 flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{idx + 1}/{selectedPredio.propietarios.length}</Badge>
                            <strong>{prop.nombre_propietario}</strong>
                          </div>
                          <div><span className="text-slate-500">Documento:</span> <strong>{catalogos?.tipo_documento?.[prop.tipo_documento]} {prop.numero_documento}</strong></div>
                          <div><span className="text-slate-500">Estado Civil:</span> <strong>{catalogos?.estado_civil?.[prop.estado_civil] || 'N/A'}</strong></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="col-span-2"><span className="text-slate-500">Nombre:</span> <strong>{selectedPredio.nombre_propietario}</strong></div>
                      <div><span className="text-slate-500">Documento:</span> <strong>{catalogos?.tipo_documento?.[selectedPredio.tipo_documento]} {selectedPredio.numero_documento}</strong></div>
                      <div><span className="text-slate-500">Estado Civil:</span> <strong>{catalogos?.estado_civil?.[selectedPredio.estado_civil] || 'N/A'}</strong></div>
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t">
                    <span className="text-slate-500 text-sm">Dirección:</span> <strong className="text-sm">{selectedPredio.direccion}</strong>
                  </div>
                </CardContent>
              </Card>
              
              {/* Características */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building className="w-4 h-4" /> Características Generales
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-4 text-sm">
                  <div><span className="text-slate-500">Destino:</span> <strong>{selectedPredio.destino_economico} - {catalogos?.destino_economico?.[selectedPredio.destino_economico]}</strong></div>
                  <div>
                    <span className="text-slate-500">Área Terreno (R1):</span> <strong>{formatAreaHectareas(selectedPredio.area_terreno)}</strong>
                  </div>
                  <div><span className="text-slate-500">Área Construida:</span> <strong>{formatAreaHectareas(selectedPredio.area_construida)}</strong></div>
                  
                  {/* Área GDB en fila separada con comparación */}
                  {selectedPredio.area_gdb > 0 && (
                    <div className="col-span-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                          <div>
                            <span className="text-blue-600 text-xs font-medium">Área GDB (Base Gráfica)</span>
                            <p className="font-bold text-blue-800">{formatAreaHectareas(selectedPredio.area_gdb)}</p>
                          </div>
                          <div className="text-slate-400">vs</div>
                          <div>
                            <span className="text-slate-500 text-xs font-medium">Área R1 (Catastral)</span>
                            <p className="font-bold text-slate-700">{formatAreaHectareas(selectedPredio.area_terreno)}</p>
                          </div>
                        </div>
                        {selectedPredio.area_terreno > 0 && (
                          <div className="text-right">
                            <span className="text-xs text-slate-500">Diferencia</span>
                            {(() => {
                              const diff = selectedPredio.area_gdb - selectedPredio.area_terreno;
                              const pct = (diff / selectedPredio.area_terreno) * 100;
                              const isPositive = diff > 0;
                              const color = Math.abs(pct) < 5 ? 'text-green-600' : Math.abs(pct) < 15 ? 'text-amber-600' : 'text-red-600';
                              return (
                                <p className={`font-bold ${color}`}>
                                  {isPositive ? '+' : ''}{pct.toFixed(1)}%
                                  <span className="text-xs font-normal ml-1">({isPositive ? '+' : ''}{diff.toFixed(0)} m²)</span>
                                </p>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="col-span-2"><span className="text-slate-500">Avalúo:</span> <strong className="text-emerald-700">{formatCurrency(selectedPredio.avaluo)}</strong></div>
                  {selectedPredio.tiene_geometria && !selectedPredio.area_gdb && (
                    <div><span className="text-slate-500">GDB:</span> <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700">✓ Con Base Gráfica</Badge></div>
                  )}
                </CardContent>
              </Card>

              {/* Datos R2 - Información Física */}
              {selectedPredio.r2_registros && selectedPredio.r2_registros.length > 0 && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4" /> 
                      Información Física (R2)
                      {selectedPredio.r2_registros.length > 1 && (
                        <Badge variant="secondary">{selectedPredio.r2_registros.length} registros</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {selectedPredio.r2_registros.map((r2, r2Idx) => (
                      <div key={r2Idx} className={r2Idx > 0 ? 'border-t pt-4' : ''}>
                        <div className="flex items-center gap-2 mb-4">
                          <Badge variant="outline" className="bg-emerald-50">Registro {r2Idx + 1}</Badge>
                          {r2.matricula_inmobiliaria && (
                            <span className="text-sm text-slate-600">
                              Matrícula: <strong>{r2.matricula_inmobiliaria}</strong>
                            </span>
                          )}
                        </div>
                        
                        {r2.zonas && r2.zonas.length > 0 && (
                          <div className="space-y-4">
                            {/* Tabla 1: Zonas Físicas, Económicas y Área Terreno */}
                            <div>
                              <p className="text-sm font-semibold text-slate-700 mb-2">Información de Zonas y Terreno ({r2.zonas.length} {r2.zonas.length === 1 ? 'registro' : 'registros'})</p>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm border rounded-lg">
                                  <thead>
                                    <tr className="bg-emerald-50 border-b">
                                      <th className="py-2 px-3 text-left">Registro</th>
                                      <th className="py-2 px-3 text-center">Zona Física</th>
                                      <th className="py-2 px-3 text-center">Zona Económica</th>
                                      <th className="py-2 px-3 text-right">Área Terreno</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {r2.zonas.map((zona, zIdx) => (
                                      <tr key={zIdx} className="border-b last:border-b-0 hover:bg-slate-50">
                                        <td className="py-2 px-3 font-medium">{zIdx + 1}</td>
                                        <td className="py-2 px-3 text-center">{zona.zona_fisica || '0'}</td>
                                        <td className="py-2 px-3 text-center">{zona.zona_economica || '0'}</td>
                                        <td className="py-2 px-3 text-right font-medium">
                                          {formatAreaHectareas(zona.area_terreno)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            
                            {/* Tabla 2: Construcción */}
                            <div>
                              <p className="text-sm font-semibold text-slate-700 mb-2">Información de Construcción ({r2.zonas.length} {r2.zonas.length === 1 ? 'registro' : 'registros'})</p>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm border rounded-lg">
                                  <thead>
                                    <tr className="bg-blue-50 border-b">
                                      <th className="py-2 px-3 text-left">Registro</th>
                                      <th className="py-2 px-3 text-center">Habitaciones</th>
                                      <th className="py-2 px-3 text-center">Baños</th>
                                      <th className="py-2 px-3 text-center">Locales</th>
                                      <th className="py-2 px-3 text-center">Pisos</th>
                                      <th className="py-2 px-3 text-center">Uso</th>
                                      <th className="py-2 px-3 text-center">Puntaje</th>
                                      <th className="py-2 px-3 text-right">Área Construida</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {r2.zonas.map((zona, zIdx) => (
                                      <tr key={zIdx} className="border-b last:border-b-0 hover:bg-slate-50">
                                        <td className="py-2 px-3 font-medium">{zIdx + 1}</td>
                                        <td className="py-2 px-3 text-center">{zona.habitaciones || '0'}</td>
                                        <td className="py-2 px-3 text-center">{zona.banos || '0'}</td>
                                        <td className="py-2 px-3 text-center">{zona.locales || '0'}</td>
                                        <td className="py-2 px-3 text-center">{zona.pisos || '1'}</td>
                                        <td className="py-2 px-3 text-center">{zona.uso || '-'}</td>
                                        <td className="py-2 px-3 text-center">{zona.puntaje || '0'}</td>
                                        <td className="py-2 px-3 text-right font-medium">
                                          {formatAreaHectareas(zona.area_construida)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
              
              {/* Historial */}
              {selectedPredio.historial && selectedPredio.historial.length > 0 && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <History className="w-4 h-4" /> Historial
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selectedPredio.historial.map((h, idx) => (
                        <div key={idx} className="text-sm border-l-2 border-emerald-200 pl-3 py-1">
                          <p className="font-medium">{h.accion}</p>
                          <p className="text-xs text-slate-500">{h.usuario} - {new Date(h.fecha).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Mapa del Predio (Opción C) */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Map className="w-4 h-4" /> Ubicación Geográfica
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PredioMap 
                    codigoPredial={selectedPredio.codigo_predial_nacional}
                    predioData={selectedPredio}
                    height={250}
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Barra de progreso de descarga offline */}
      <DownloadProgressBar
        isDownloading={downloadProgress.isDownloading}
        progress={downloadProgress.total > 0 ? (downloadProgress.current / downloadProgress.total) * 100 : 0}
        total={downloadProgress.total}
        current={downloadProgress.current}
        label={downloadProgress.label}
        onCancel={() => setDownloadProgress({ isDownloading: false, current: 0, total: 0, label: '' })}
      />
      
      {/* Dialog de Códigos Homologados */}
      <Dialog open={showCodigosDialog} onOpenChange={(open) => {
        setShowCodigosDialog(open);
        if (!open) {
          cancelarCargaCodigos();
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Gestión de Códigos Homologados
            </DialogTitle>
            <DialogDescription>
              Cargue y administre los códigos homologados por municipio
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Cargar archivo */}
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-4">
              {!codigosFileSelected ? (
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-slate-900">Cargar Códigos desde Excel</h4>
                    <p className="text-sm text-slate-500">
                      Puede ser un archivo con solo códigos (seleccione el municipio) o con columnas <code className="bg-slate-100 px-1 rounded">Municipio</code> y <code className="bg-slate-100 px-1 rounded">Codigo_Homologado</code>
                    </p>
                  </div>
                  <div>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleUploadCodigos}
                      className="hidden"
                      id="upload-codigos"
                      disabled={uploadingCodigos}
                    />
                    <label htmlFor="upload-codigos">
                      <Button asChild disabled={uploadingCodigos} className="bg-blue-600 hover:bg-blue-700">
                        <span>
                          <Upload className="w-4 h-4 mr-2" />
                          Seleccionar Excel
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-blue-800">{codigosFileSelected.name}</span>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Municipio para estos códigos *</Label>
                    <p className="text-xs text-slate-500 mb-2">
                      Seleccione el municipio al que pertenecen estos códigos
                    </p>
                    <select 
                      value={codigosMunicipioSeleccionado} 
                      onChange={(e) => setCodigosMunicipioSeleccionado(e.target.value)}
                      className="w-full h-10 px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <option value="">-- Seleccione un municipio --</option>
                      {catalogos?.municipios?.slice().sort((a, b) => a.localeCompare(b, 'es')).map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Nota informativa */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <strong>Nota:</strong> Al cargar, cada código se compara con los predios existentes. 
                      Los códigos que ya están asignados a un predio se marcan como <span className="font-semibold text-amber-700">"usados"</span>, 
                      los demás quedan <span className="font-semibold text-emerald-700">"disponibles"</span>.
                    </p>
                  </div>
                  
                  <div className="flex gap-2 justify-end">
                    <Button 
                      variant="outline" 
                      onClick={cancelarCargaCodigos}
                      disabled={uploadingCodigos}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      onClick={confirmarCargaCodigos}
                      disabled={uploadingCodigos || !codigosMunicipioSeleccionado}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {uploadingCodigos ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Cargando...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Cargar Códigos
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Estadísticas por municipio */}
            <div>
              <h4 className="font-medium text-slate-900 mb-3">Códigos por Municipio</h4>
              {loadingCodigos ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : codigosStats.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <FileText className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  <p>No hay códigos homologados cargados</p>
                  <p className="text-sm">Cargue un archivo Excel para comenzar</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border rounded-lg">
                    <thead>
                      <tr className="bg-slate-100 border-b">
                        <th className="py-2 px-4 text-left">Municipio</th>
                        <th className="py-2 px-4 text-center">Total</th>
                        <th className="py-2 px-4 text-center">Usados</th>
                        <th className="py-2 px-4 text-center">Disponibles</th>
                        <th className="py-2 px-4 text-center">Estado</th>
                        <th className="py-2 px-4 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {codigosStats.map((stat) => (
                        <tr key={stat.municipio} className="border-b last:border-b-0 hover:bg-slate-50">
                          <td className="py-2 px-4 font-medium">{stat.municipio}</td>
                          <td className="py-2 px-4 text-center">{stat.total.toLocaleString()}</td>
                          <td className="py-2 px-4 text-center text-amber-600">{stat.usados.toLocaleString()}</td>
                          <td className="py-2 px-4 text-center font-bold text-emerald-600">{stat.disponibles.toLocaleString()}</td>
                          <td className="py-2 px-4 text-center">
                            {stat.disponibles === 0 ? (
                              <Badge className="bg-red-100 text-red-700">Agotados</Badge>
                            ) : stat.disponibles < 10 ? (
                              <Badge className="bg-amber-100 text-amber-700">Pocos</Badge>
                            ) : (
                              <Badge className="bg-emerald-100 text-emerald-700">OK</Badge>
                            )}
                          </td>
                          <td className="py-2 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {stat.usados > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                  onClick={() => {
                                    setCodigosUsadosMunicipio(stat.municipio);
                                    fetchCodigosUsados(stat.municipio);
                                  }}
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  Ver
                                </Button>
                              )}
                              {(user?.role === 'administrador' || user?.role === 'coordinador') && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                    onClick={() => diagnosticarCodigosMunicipio(stat.municipio)}
                                    disabled={loadingDiagnostico}
                                    title="Diagnosticar inconsistencias"
                                  >
                                    {loadingDiagnostico ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Search className="w-4 h-4" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-amber-600 hover:text-amber-800 hover:bg-amber-50"
                                    onClick={() => recalcularCodigosMunicipio(stat.municipio)}
                                    disabled={recalculandoCodigos}
                                    title="Recalcular códigos usados vs disponibles"
                                  >
                                    {recalculandoCodigos ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <RefreshCw className="w-4 h-4" />
                                    )}
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            {/* Códigos usados por municipio seleccionado */}
            {codigosUsadosMunicipio && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-slate-900 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-amber-600" />
                    Códigos Usados - {codigosUsadosMunicipio}
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCodigosUsadosMunicipio('');
                      setCodigosUsados([]);
                    }}
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
                
                {loadingCodigosUsados ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  </div>
                ) : codigosUsados.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">No hay códigos usados para este municipio</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-amber-50 sticky top-0">
                        <tr className="border-b">
                          <th className="py-2 px-3 text-left font-medium text-amber-800">Código</th>
                          <th className="py-2 px-3 text-left font-medium text-amber-800">Código Predial</th>
                          <th className="py-2 px-3 text-left font-medium text-amber-800">Propietario</th>
                        </tr>
                      </thead>
                      <tbody>
                        {codigosUsados.map((c, idx) => (
                          <tr key={idx} className="border-b last:border-b-0 hover:bg-amber-50/50">
                            <td className="py-2 px-3 font-mono text-xs font-medium text-amber-700">{c.codigo}</td>
                            <td className="py-2 px-3 font-mono text-xs">{c.codigo_predial || '-'}</td>
                            <td className="py-2 px-3 text-xs truncate max-w-[200px]" title={c.propietario}>{c.propietario || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            
            {/* Resumen */}
            {codigosStats.length > 0 && (
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-slate-800">
                      {codigosStats.reduce((acc, s) => acc + s.total, 0).toLocaleString()}
                    </p>
                    <p className="text-sm text-slate-500">Total Códigos</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-600">
                      {codigosStats.reduce((acc, s) => acc + s.usados, 0).toLocaleString()}
                    </p>
                    <p className="text-sm text-slate-500">Usados</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-emerald-600">
                      {codigosStats.reduce((acc, s) => acc + s.disponibles, 0).toLocaleString()}
                    </p>
                    <p className="text-sm text-slate-500">Disponibles</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Diagnóstico de Códigos */}
      <Dialog open={showDiagnosticoDialog} onOpenChange={setShowDiagnosticoDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-600" />
              Diagnóstico de Códigos - {diagnosticoCodigos?.municipio}
            </DialogTitle>
            <DialogDescription>
              Análisis de inconsistencias entre códigos cargados y predios asignados
            </DialogDescription>
          </DialogHeader>
          
          {loadingDiagnostico ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
              <p className="text-slate-600">Analizando códigos...</p>
              <p className="text-sm text-slate-400">Esto puede tomar unos segundos</p>
            </div>
          ) : diagnosticoCodigos && (
            <div className="space-y-6">
              {/* Resumen de la colección */}
              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  En Colección de Códigos
                </h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-slate-700">{diagnosticoCodigos.en_coleccion?.total?.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">Total</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-600">{diagnosticoCodigos.en_coleccion?.usados?.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">Marcados Usados</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-emerald-600">{diagnosticoCodigos.en_coleccion?.disponibles?.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">Disponibles</p>
                  </div>
                </div>
              </div>
              
              {/* Predios reales */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-3 flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  Predios con Código Asignado (Realidad)
                </h4>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-blue-700">{diagnosticoCodigos.en_predios?.predios_con_codigo_homologado?.toLocaleString()}</p>
                    <p className="text-xs text-blue-600">Predios con código_homologado</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-700">{diagnosticoCodigos.en_predios?.codigos_unicos?.toLocaleString()}</p>
                    <p className="text-xs text-blue-600">Códigos únicos en predios</p>
                  </div>
                </div>
              </div>
              
              {/* Inconsistencias */}
              {(diagnosticoCodigos.inconsistencias?.codigos_huerfanos_en_coleccion > 0) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-medium text-red-800 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    ¡Inconsistencias Detectadas!
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-white rounded p-3">
                      <div>
                        <p className="font-medium text-red-700">Códigos marcados como "usados" sin predio real</p>
                        <p className="text-sm text-red-600">Estos códigos se liberarán al recalcular</p>
                      </div>
                      <p className="text-3xl font-bold text-red-600">
                        {diagnosticoCodigos.inconsistencias?.codigos_huerfanos_en_coleccion?.toLocaleString()}
                      </p>
                    </div>
                    
                    {diagnosticoCodigos.inconsistencias?.ejemplos_huerfanos?.length > 0 && (
                      <div className="text-sm">
                        <p className="text-red-700 font-medium mb-1">Ejemplos de códigos huérfanos:</p>
                        <div className="flex flex-wrap gap-1">
                          {diagnosticoCodigos.inconsistencias.ejemplos_huerfanos.slice(0, 5).map((c, i) => (
                            <Badge key={i} variant="outline" className="text-red-600 border-red-300">{c}</Badge>
                          ))}
                          {diagnosticoCodigos.inconsistencias.ejemplos_huerfanos.length > 5 && (
                            <Badge variant="outline" className="text-slate-500">+{diagnosticoCodigos.inconsistencias.ejemplos_huerfanos.length - 5} más</Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Sin inconsistencias */}
              {diagnosticoCodigos.inconsistencias?.codigos_huerfanos_en_coleccion === 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
                  <CheckCircle className="w-12 h-12 mx-auto text-emerald-500 mb-2" />
                  <p className="font-medium text-emerald-800">¡Sin inconsistencias!</p>
                  <p className="text-sm text-emerald-600">Los códigos están correctamente sincronizados con los predios</p>
                </div>
              )}
              
              {/* Recomendación y botón de acción */}
              {diagnosticoCodigos.inconsistencias?.codigos_huerfanos_en_coleccion > 0 && (
                <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div>
                    <p className="font-medium text-amber-800">Recomendación</p>
                    <p className="text-sm text-amber-700">
                      Ejecute "Recalcular" para liberar {diagnosticoCodigos.inconsistencias?.codigos_huerfanos_en_coleccion?.toLocaleString()} códigos
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setShowDiagnosticoDialog(false);
                      recalcularCodigosMunicipio(diagnosticoCodigos.municipio);
                    }}
                    className="bg-amber-600 hover:bg-amber-700"
                    disabled={recalculandoCodigos}
                  >
                    {recalculandoCodigos ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Recalcular Ahora
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
