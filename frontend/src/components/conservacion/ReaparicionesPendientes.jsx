import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Loader2, AlertTriangle, CheckCircle, XCircle, Eye, Users 
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Componente para gestionar reapariciones pendientes
 * Permite a coordinadores aprobar o rechazar predios que reaparecen
 * 
 * @param {string} municipio - Filtrar por municipio específico
 * @param {function} onUpdate - Callback cuando se actualiza un estado
 */
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
      <div className="flex justify-center py-8" data-testid="reapariciones-loading">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
      </div>
    );
  }

  const totalPendientes = reapariciones.length + solicitudes.length;

  if (totalPendientes === 0) {
    return (
      <div className="text-center py-8 text-slate-500" data-testid="reapariciones-empty">
        <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
        <p className="font-medium text-emerald-700">No hay reapariciones pendientes{municipio ? ` en ${municipio}` : ''}</p>
        <p className="text-sm">Todos los casos han sido revisados</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="reapariciones-pendientes">
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

export default ReaparicionesPendientes;
