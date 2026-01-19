import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Plus, Search, Edit, Trash2, MapPin, FileText, Building, 
  User, DollarSign, LayoutGrid, Eye, History, Download, AlertTriangle, Users,
  Clock, CheckCircle, XCircle, Bell, Map, Upload, Loader2, RefreshCw, AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import PredioMap from '../components/PredioMap';

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
        <Select value={vigencia} onValueChange={setVigencia}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Seleccione el año" />
          </SelectTrigger>
          <SelectContent>
            {years.map(year => (
              <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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

export default function Predios() {
  const { user } = useAuth();
  
  // Comunicaciones solo puede ver, no puede crear/editar/eliminar predios
  const canModifyPredios = user && !['usuario', 'comunicaciones'].includes(user.role);
  
  const [predios, setPredios] = useState([]);
  const [catalogos, setCatalogos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [filterMunicipio, setFilterMunicipio] = useState('');
  const [filterVigencia, setFilterVigencia] = useState('');
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
  const [reaparicionesConteo, setReaparicionesConteo] = useState({});
  const [gdbStats, setGdbStats] = useState(null); // Estadísticas de geometrías GDB
  const [revinculandoGdb, setRevinculandoGdb] = useState(false); // Estado de revinculación GDB
  const [selectedPredio, setSelectedPredio] = useState(null);
  const [prediosEliminados, setPrediosEliminados] = useState([]);
  const [cambiosPendientes, setCambiosPendientes] = useState([]);
  const [cambiosStats, setCambiosStats] = useState(null);
  const [terrenoInfo, setTerrenoInfo] = useState(null);
  const [estructuraCodigo, setEstructuraCodigo] = useState(null);
  const [verificacionCodigo, setVerificacionCodigo] = useState(null);
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
    const nuevos = [...propietarios];
    nuevos[index][campo] = valor;
    setPropietarios(nuevos);
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
    const nuevas = [...zonasFisicas];
    nuevas[index][campo] = valor;
    setZonasFisicas(nuevas);
  };

  // Estado para asignar a otro gestor
  const [gestoresDisponibles, setGestoresDisponibles] = useState([]);
  const [gestorAsignado, setGestorAsignado] = useState('');

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

  useEffect(() => {
    fetchCatalogos();
    fetchVigencias();
    fetchPrediosStats();
    fetchCambiosStats();
    fetchReaparicionesConteo();
    fetchGdbStats();
    fetchGestoresDisponibles();
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

  const fetchPredios = async () => {
    try {
      setLoading(true);
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
      setPredios(res.data.predios);
      setTotal(res.data.total);
    } catch (error) {
      toast.error('Error al cargar predios');
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
      
      toast.info('Iniciando revinculación de geometrías GDB. Este proceso puede tardar unos minutos...');
      
      const response = await axios.post(`${API}/gdb/revincular-predios${params}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 300000 // 5 minutos de timeout
      });
      
      const data = response.data;
      const totalVinculados = data.total_vinculados || 0;
      
      if (totalVinculados > 0) {
        toast.success(`¡Revinculación completada! ${totalVinculados.toLocaleString()} predios vinculados con geometría GDB`);
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
      toast.error(error.response?.data?.detail || 'Error al revincular geometrías GDB');
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

    try {
      const token = localStorage.getItem('token');
      
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
      fetchPredios();
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
      fetchPredios();
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
      
      fetchPredios();
      fetchCambiosStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar predio');
    }
  };

  const openEditDialog = (predio) => {
    setSelectedPredio(predio);
    
    // Cargar propietarios del predio (si existen)
    if (predio.propietarios && predio.propietarios.length > 0) {
      setPropietarios(predio.propietarios.map(p => ({
        nombre_propietario: p.nombre_propietario || '',
        tipo_documento: p.tipo_documento || 'C',
        numero_documento: p.numero_documento || '',
        estado_civil: p.estado_civil || ''
      })));
    } else if (predio.nombre_propietario) {
      // Fallback a campos legacy si no hay array de propietarios
      setPropietarios([{
        nombre_propietario: predio.nombre_propietario || '',
        tipo_documento: predio.tipo_documento || 'C',
        numero_documento: predio.numero_documento || '',
        estado_civil: predio.estado_civil || ''
      }]);
    } else {
      setPropietarios([{
        nombre_propietario: '',
        tipo_documento: 'C',
        numero_documento: '',
        estado_civil: ''
      }]);
    }
    
    // Obtener datos R2 (puede estar en r2 o r2_registros)
    const r2Data = predio.r2 || (predio.r2_registros && predio.r2_registros[0]) || {};
    const zonasData = r2Data.zonas || [];
    
    // Cargar zonas físicas del predio
    if (zonasData.length > 0) {
      setZonasFisicas(zonasData.map(z => ({
        zona_fisica: z.zona_fisica?.toString() || '0',
        zona_economica: z.zona_economica?.toString() || '0',
        area_terreno: z.area_terreno?.toString() || '0',
        habitaciones: z.habitaciones?.toString() || '0',
        banos: z.banos?.toString() || '0',
        locales: z.locales?.toString() || '0',
        pisos: z.pisos?.toString() || '1',
        puntaje: z.puntaje?.toString() || '0',
        area_construida: z.area_construida?.toString() || '0'
      })));
    } else {
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
    }
    
    // Obtener matrícula inmobiliaria (puede estar en r2, r2_registros, o raíz)
    const matricula = r2Data.matricula_inmobiliaria || 
                      predio.matricula_inmobiliaria || 
                      '';
    
    setFormData({
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
    });
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
        <div className="flex gap-2 flex-wrap">
          {/* Botón Exportar Excel - solo cuando está dentro de un municipio */}
          {!showDashboard && (
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-emerald-600 font-medium">Total Predios</p>
                      <p className="text-3xl font-bold text-emerald-800">{prediosStats.total_predios?.toLocaleString()}</p>
                    </div>
                    <Building className="w-10 h-10 text-emerald-300" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-600 font-medium">Avalúo Total</p>
                      <p className="text-2xl font-bold text-blue-800">{formatCurrency(prediosStats.total_avaluo)}</p>
                    </div>
                    <DollarSign className="w-10 h-10 text-blue-300" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-amber-600 font-medium">Área Total (R1)</p>
                      <p className="text-2xl font-bold text-amber-800">{formatAreaHectareas(prediosStats.total_area_terreno)}</p>
                    </div>
                    <MapPin className="w-10 h-10 text-amber-300" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-600 font-medium">Base Gráfica</p>
                      <p className="text-3xl font-bold text-purple-800">{(prediosStats.total_con_geometria || 0).toLocaleString()}</p>
                      {prediosStats.total_area_gdb > 0 && (
                        <p className="text-xs text-purple-500 mt-1">
                          {formatAreaHectareas(prediosStats.total_area_gdb)}
                        </p>
                      )}
                    </div>
                    <Map className="w-10 h-10 text-purple-300" />
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
                  {/* Botón de importar R1/R2 solo para coordinadores y admins */}
                  {user && ['coordinador', 'administrador'].includes(user.role) && (
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
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                          className="w-full h-auto py-4 flex flex-col items-start justify-start text-left hover:bg-emerald-50 hover:border-emerald-300"
                          onClick={() => {
                            setFilterMunicipio(item.municipio);
                            setFilterVigencia(String(vigenciaReciente || '2025'));
                          }}
                        >
                          <span className="font-medium text-slate-900">{item.municipio}</span>
                          <span className="text-xl font-bold text-emerald-700">{item.count?.toLocaleString()}</span>
                          <span className="text-xs text-slate-500">predios · vigencia {vigenciaYear}</span>
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
                {/* Filtro de geometría GDB */}
                <Select value={filterGeometria} onValueChange={setFilterGeometria}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Geometría GDB" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="con">Con geometría</SelectItem>
                    <SelectItem value="sin">Sin geometría</SelectItem>
                  </SelectContent>
                </Select>
                {gdbStats?.por_municipio?.[filterMunicipio] && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                    <Map className="w-3 h-3 mr-1" />
                    {gdbStats.por_municipio[filterMunicipio]?.total || 0} geometrías GDB
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
                {/* Botón de Reapariciones - Solo para coordinadores */}
                {user && ['coordinador', 'administrador'].includes(user.role) && (
                  <Button 
                    variant="outline" 
                    className="border-amber-400 text-amber-700 hover:bg-amber-50 relative"
                    onClick={() => setShowReaparicionesDialog(true)}
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Reapariciones
                    {(reaparicionesConteo[filterMunicipio] || 0) > 0 && (
                      <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {reaparicionesConteo[filterMunicipio]}
                      </span>
                    )}
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
            <Badge variant="outline">{total} predios</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700"></div>
            </div>
          ) : (
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
                  predios.map((predio) => (
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
                  ))
                )}
              </tbody>
            </table>
          </div>
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
                      <span className="text-slate-500">Info. Gráfica (GDB):</span>
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
                      <Label className="text-xs">Tipo Documento *</Label>
                      <Select value={prop.tipo_documento} onValueChange={(v) => actualizarPropietario(index, 'tipo_documento', v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {catalogos?.tipo_documento && Object.entries(catalogos.tipo_documento).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{k} - {v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Número Documento *</Label>
                      <Input 
                        value={prop.numero_documento} 
                        onChange={(e) => actualizarPropietario(index, 'numero_documento', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Estado Civil</Label>
                      <Select value={prop.estado_civil || "none"} onValueChange={(v) => actualizarPropietario(index, 'estado_civil', v === "none" ? "" : v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin especificar</SelectItem>
                          {catalogos?.estado_civil && Object.entries(catalogos.estado_civil).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{k} - {v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                  <div>
                    <Label>Destino Económico *</Label>
                    <Select value={formData.destino_economico} onValueChange={(v) => setFormData({...formData, destino_economico: v})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {catalogos?.destino_economico && Object.entries(catalogos.destino_economico).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{k} - {v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
          
          {/* Opción para asignar a otro gestor */}
          <div className="border-t border-slate-200 pt-4 mt-4">
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
            
            {gestoresDisponibles.length > 0 && (
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
          </div>
          
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => handleCloseDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreate} className="bg-emerald-700 hover:bg-emerald-800">
              {gestorAsignado ? 'Guardar y Asignar' : 'Crear Predio'}
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
                      <Label className="text-xs">Tipo Documento *</Label>
                      <Select value={prop.tipo_documento} onValueChange={(v) => actualizarPropietario(index, 'tipo_documento', v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {catalogos?.tipo_documento && Object.entries(catalogos.tipo_documento).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{k} - {v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Número Documento *</Label>
                      <Input 
                        value={prop.numero_documento} 
                        onChange={(e) => actualizarPropietario(index, 'numero_documento', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Estado Civil</Label>
                      <Select value={prop.estado_civil || "none"} onValueChange={(v) => actualizarPropietario(index, 'estado_civil', v === "none" ? "" : v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin especificar</SelectItem>
                          {catalogos?.estado_civil && Object.entries(catalogos.estado_civil).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{k} - {v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                <div>
                  <Label>Destino Económico *</Label>
                  <Select value={formData.destino_economico} onValueChange={(v) => setFormData({...formData, destino_economico: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {catalogos?.destino_economico && Object.entries(catalogos.destino_economico).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{k} - {v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                      <Select value={zona.zona_fisica} onValueChange={(v) => actualizarZonaFisica(index, 'zona_fisica', v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {catalogos?.zona_fisica && Object.entries(catalogos.zona_fisica).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{k} - {v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Zona Económica</Label>
                      <Select value={zona.zona_economica} onValueChange={(v) => actualizarZonaFisica(index, 'zona_economica', v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {catalogos?.zona_economica && Object.entries(catalogos.zona_economica).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{k}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
          
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
            <Button onClick={handleUpdate} className="bg-emerald-700 hover:bg-emerald-800">
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

      {/* Reapariciones Pendientes Dialog */}
      <Dialog open={showReaparicionesDialog} onOpenChange={(open) => { 
        setShowReaparicionesDialog(open); 
        if (!open && !filterVigencia) setFilterMunicipio(''); // Reset municipio solo si no estamos dentro de uno
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-outfit flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
              Reapariciones Pendientes {filterMunicipio ? `- ${filterMunicipio}` : '(Todos los municipios)'}
            </DialogTitle>
          </DialogHeader>
          <ReaparicionesPendientes 
            municipio={filterMunicipio || null} 
            onUpdate={() => { fetchReaparicionesConteo(); fetchPredios(); }}
          />
        </DialogContent>
      </Dialog>

      {/* Cambios Pendientes Dialog */}
      <Dialog open={showPendientesDialog} onOpenChange={setShowPendientesDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-outfit flex items-center gap-2 text-amber-700">
              <Bell className="w-5 h-5" />
              Cambios Pendientes de Aprobación
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
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

                        {/* Datos propuestos expandibles */}
                        <details className="bg-slate-50 rounded-lg p-3">
                          <summary className="cursor-pointer font-medium text-sm text-slate-700 flex items-center gap-2">
                            <Eye className="w-4 h-4" />
                            Ver datos propuestos
                          </summary>
                          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                            {cambio.datos_propuestos.municipio && (
                              <div><span className="text-slate-500">Municipio:</span> <strong>{cambio.datos_propuestos.municipio}</strong></div>
                            )}
                            {cambio.datos_propuestos.nombre_propietario && (
                              <div><span className="text-slate-500">Propietario:</span> <strong>{cambio.datos_propuestos.nombre_propietario}</strong></div>
                            )}
                            {cambio.datos_propuestos.direccion && (
                              <div><span className="text-slate-500">Dirección:</span> <strong>{cambio.datos_propuestos.direccion}</strong></div>
                            )}
                            {cambio.datos_propuestos.destino_economico && (
                              <div><span className="text-slate-500">Destino:</span> <strong>{cambio.datos_propuestos.destino_economico}</strong></div>
                            )}
                            {cambio.datos_propuestos.area_terreno !== undefined && (
                              <div><span className="text-slate-500">Área Terreno:</span> <strong>{cambio.datos_propuestos.area_terreno?.toLocaleString()} m²</strong></div>
                            )}
                            {cambio.datos_propuestos.area_construida !== undefined && (
                              <div><span className="text-slate-500">Área Construida:</span> <strong>{cambio.datos_propuestos.area_construida?.toLocaleString()} m²</strong></div>
                            )}
                            {cambio.datos_propuestos.avaluo !== undefined && (
                              <div><span className="text-slate-500">Avalúo:</span> <strong className="text-emerald-700">{formatCurrency(cambio.datos_propuestos.avaluo)}</strong></div>
                            )}
                            {cambio.datos_propuestos.tipo_documento && (
                              <div><span className="text-slate-500">Tipo Doc:</span> <strong>{cambio.datos_propuestos.tipo_documento}</strong></div>
                            )}
                            {cambio.datos_propuestos.numero_documento && (
                              <div><span className="text-slate-500">Nro. Doc:</span> <strong>{cambio.datos_propuestos.numero_documento}</strong></div>
                            )}
                            {/* Mostrar todos los campos adicionales */}
                            {Object.entries(cambio.datos_propuestos)
                              .filter(([key]) => !['municipio', 'nombre_propietario', 'direccion', 'destino_economico', 'area_terreno', 'area_construida', 'avaluo', 'tipo_documento', 'numero_documento', 'codigo_homologado'].includes(key))
                              .map(([key, value]) => (
                                value !== null && value !== undefined && value !== '' && (
                                  <div key={key}><span className="text-slate-500">{key.replace(/_/g, ' ')}:</span> <strong>{String(value)}</strong></div>
                                )
                              ))
                            }
                          </div>
                        </details>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
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
              {/* Botón Generar Certificado */}
              {['coordinador', 'administrador', 'atencion_usuario'].includes(user?.role) && (
                <div className="flex justify-end">
                  <Button
                    variant="default"
                    className="bg-emerald-700 hover:bg-emerald-800"
                    onClick={async () => {
                      try {
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
                        a.click();
                        window.URL.revokeObjectURL(url);
                        toast.success('Certificado generado correctamente');
                      } catch (error) {
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
                      <p className="text-xs text-slate-500">Matrícula Inmobiliaria</p>
                      <p className="font-medium text-slate-700">{selectedPredio.r2_registros?.[0]?.matricula_inmobiliaria || selectedPredio.matricula_inmobiliaria || 'Sin matrícula'}</p>
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
                    <div><span className="text-slate-500">GDB:</span> <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700">✓ Con geometría</Badge></div>
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
    </div>
  );
}
