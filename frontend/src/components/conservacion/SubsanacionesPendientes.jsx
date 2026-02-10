import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { 
  Loader2, AlertTriangle, CheckCircle, XCircle, Eye, Edit, 
  RefreshCw, AlertCircle, Trash2 
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Componente para gestionar subsanaciones de reapariciones
 * Para gestores: permite subsanar predios rechazados
 * Para coordinadores: permite aprobar/rechazar subsanaciones
 * 
 * @param {string} municipio - Filtrar por municipio específico
 * @param {function} onUpdate - Callback cuando se actualiza un estado
 */
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
      <div className="flex justify-center py-8" data-testid="subsanaciones-loading">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
      </div>
    );
  }

  const totalItems = subsanaciones.length + reenviadas.length;

  if (totalItems === 0) {
    return (
      <div className="text-center py-8 text-slate-500" data-testid="subsanaciones-empty">
        <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
        <p className="font-medium text-emerald-700">No hay subsanaciones pendientes</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="subsanaciones-pendientes">
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

export default SubsanacionesPendientes;
