import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Clock, CheckCircle, XCircle, Building, User, MapPin, 
  FileText, Eye, Loader2, AlertTriangle, ArrowRight, Edit, RefreshCw, History, ChevronDown, ChevronUp
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Helper para formatear fecha
const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
};

// Configuración de estados para predios nuevos
const estadoPredioConfig = {
  creado: { color: 'bg-blue-100 text-blue-800 border-blue-300', label: 'Creado', icon: FileText },
  digitalizacion: { color: 'bg-amber-100 text-amber-800 border-amber-300', label: 'En Digitalización', icon: Edit },
  revision: { color: 'bg-purple-100 text-purple-800 border-purple-300', label: 'En Revisión', icon: Eye },
  aprobado: { color: 'bg-emerald-100 text-emerald-800 border-emerald-300', label: 'Aprobado', icon: CheckCircle },
  devuelto: { color: 'bg-orange-100 text-orange-800 border-orange-300', label: 'Devuelto', icon: RefreshCw },
  rechazado: { color: 'bg-red-100 text-red-800 border-red-300', label: 'Rechazado', icon: XCircle },
};

export default function Pendientes() {
  const { user } = useAuth();
  const [cambiosPendientes, setCambiosPendientes] = useState([]);
  const [prediosNuevos, setPrediosNuevos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPredios, setLoadingPredios] = useState(true);
  const [selectedCambio, setSelectedCambio] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [activeTab, setActiveTab] = useState('modificaciones');
  
  // Estados para predios nuevos
  const [selectedPredioNuevo, setSelectedPredioNuevo] = useState(null);
  const [showPredioDetailDialog, setShowPredioDetailDialog] = useState(false);
  const [showPredioActionDialog, setShowPredioActionDialog] = useState(false);
  const [predioActionType, setPredioActionType] = useState('');
  const [predioObservaciones, setPredioObservaciones] = useState('');
  const [expandedHistorial, setExpandedHistorial] = useState({});
  
  // Estados para el modal de rechazo
  const [showRechazarModal, setShowRechazarModal] = useState(false);
  const [cambioArechazar, setCambioArechazar] = useState(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  
  const isCoordinador = user && ['coordinador', 'administrador'].includes(user.role);

  useEffect(() => {
    fetchPendientes();
    fetchPrediosNuevos();
  }, []);

  const fetchPrediosNuevos = async () => {
    setLoadingPredios(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/predios-nuevos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPrediosNuevos(res.data.predios || res.data || []);
    } catch (error) {
      console.error('Error cargando predios nuevos:', error);
      setPrediosNuevos([]);
    } finally {
      setLoadingPredios(false);
    }
  };

  const handlePredioAction = async () => {
    if (!selectedPredioNuevo || !predioActionType) return;
    
    if (['devolver', 'rechazar'].includes(predioActionType) && !predioObservaciones.trim()) {
      toast.error('Debe ingresar observaciones para esta acción');
      return;
    }
    
    setProcesando(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/predios-nuevos/${selectedPredioNuevo.id}/accion`, {
        accion: predioActionType,
        observaciones: predioObservaciones.trim() || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const mensajes = {
        enviar_revision: 'Predio enviado a revisión',
        aprobar: 'Predio aprobado e integrado al sistema',
        devolver: 'Predio devuelto para correcciones',
        rechazar: 'Predio rechazado'
      };
      
      toast.success(mensajes[predioActionType] || 'Acción completada');
      setShowPredioActionDialog(false);
      setPredioObservaciones('');
      setPredioActionType('');
      fetchPrediosNuevos();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al procesar acción');
    } finally {
      setProcesando(false);
    }
  };

  const openPredioActionDialog = (predio, action) => {
    setSelectedPredioNuevo(predio);
    setPredioActionType(action);
    setShowPredioActionDialog(true);
  };

  const toggleHistorial = (predioId) => {
    setExpandedHistorial(prev => ({
      ...prev,
      [predioId]: !prev[predioId]
    }));
  };

  const fetchPendientes = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/predios/cambios/pendientes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = response.data;
      const cambios = data.cambios || (Array.isArray(data) ? data : []);
      setCambiosPendientes(cambios);
    } catch (error) {
      console.error('Error loading pending changes:', error);
      setCambiosPendientes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAprobar = async (cambioId) => {
    setProcesando(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/predios/cambios/aprobar`, 
        { cambio_id: cambioId, aprobado: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Cambio aprobado exitosamente');
      fetchPendientes();
      setSelectedCambio(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al aprobar cambio');
    } finally {
      setProcesando(false);
    }
  };

  const openRechazarModal = (cambio) => {
    setCambioArechazar(cambio);
    setMotivoRechazo('');
    setShowRechazarModal(true);
  };

  const handleConfirmarRechazo = async () => {
    if (!motivoRechazo.trim()) {
      toast.error('Debe indicar el motivo del rechazo');
      return;
    }
    
    setProcesando(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/predios/cambios/aprobar`, 
        { 
          cambio_id: cambioArechazar.id, 
          aprobado: false,
          comentario: motivoRechazo
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Cambio rechazado. Se notificó al gestor.');
      fetchPendientes();
      setSelectedCambio(null);
      setShowRechazarModal(false);
      setCambioArechazar(null);
      setMotivoRechazo('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al rechazar cambio');
    } finally {
      setProcesando(false);
    }
  };

  const getTipoCambioLabel = (tipo) => {
    const labels = {
      'creacion': 'Nuevo Predio',
      'actualizacion': 'Actualización',
      'modificacion': 'Modificación',
      'eliminacion': 'Eliminación'
    };
    return labels[tipo] || tipo;
  };

  const getTipoCambioColor = (tipo) => {
    const colors = {
      'creacion': 'bg-emerald-100 text-emerald-800',
      'actualizacion': 'bg-blue-100 text-blue-800',
      'modificacion': 'bg-amber-100 text-amber-800',
      'eliminacion': 'bg-red-100 text-red-800'
    };
    return colors[tipo] || 'bg-slate-100 text-slate-800';
  };

  // Función para comparar valores y detectar cambios
  const getFieldChanges = (cambio) => {
    const propuesto = cambio.datos_propuestos || {};
    const actual = cambio.predio_actual || {};
    
    // Campos a comparar
    const camposComparar = [
      { key: 'codigo_predial_nacional', label: 'Código Predial Nacional' },
      { key: 'municipio', label: 'Municipio' },
      { key: 'direccion', label: 'Dirección' },
      { key: 'nombre_propietario', label: 'Propietario' },
      { key: 'area_terreno', label: 'Área Terreno', format: (v) => v ? `${v.toLocaleString()} m²` : 'N/A' },
      { key: 'area_construida', label: 'Área Construida', format: (v) => v ? `${v.toLocaleString()} m²` : 'N/A' },
      { key: 'avaluo', label: 'Avalúo', format: (v) => v ? `$${v.toLocaleString()}` : 'N/A' },
      { key: 'destino_economico', label: 'Destino Económico' },
      { key: 'zona', label: 'Zona' },
    ];
    
    return camposComparar.map(campo => {
      let valorActual = actual[campo.key];
      let valorPropuesto = propuesto[campo.key];
      
      // Manejar caso especial de propietarios (array) - mostrar TODOS
      if (campo.key === 'nombre_propietario') {
        if (actual.propietarios && actual.propietarios.length > 0) {
          valorActual = actual.propietarios.map(p => p.nombre_propietario).join(', ');
        }
        if (propuesto.propietarios && propuesto.propietarios.length > 0) {
          valorPropuesto = propuesto.propietarios.map(p => p.nombre_propietario).join(', ');
        }
      }
      
      const format = campo.format || ((v) => v || 'N/A');
      const actualFormatted = format(valorActual);
      const propuestoFormatted = format(valorPropuesto);
      
      const hayCambio = valorActual !== valorPropuesto && 
                       (valorActual || valorPropuesto) && 
                       actualFormatted !== propuestoFormatted;
      
      return {
        label: campo.label,
        valorActual: actualFormatted,
        valorPropuesto: propuestoFormatted,
        hayCambio
      };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  // Contar predios nuevos en revisión (pendientes de aprobación)
  const prediosEnRevision = prediosNuevos.filter(p => p.estado === 'revision').length;
  const totalPendientes = cambiosPendientes.length + prediosEnRevision;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-outfit">Pendientes de Aprobación</h1>
          <p className="text-slate-600 mt-1">Cambios y predios nuevos que requieren aprobación</p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          {totalPendientes} pendientes
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="modificaciones" className="flex items-center gap-2">
            <Edit className="w-4 h-4" />
            Modificaciones
            {cambiosPendientes.length > 0 && (
              <Badge variant="secondary" className="ml-1">{cambiosPendientes.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="predios-nuevos" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Predios Nuevos
            {prediosEnRevision > 0 && (
              <Badge variant="secondary" className="ml-1">{prediosEnRevision}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab: Modificaciones */}
        <TabsContent value="modificaciones">
          {cambiosPendientes.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <CheckCircle className="w-16 h-16 mx-auto text-emerald-500 mb-4" />
                <h3 className="text-xl font-semibold text-slate-700">¡Todo al día!</h3>
                <p className="text-slate-500 mt-2">No hay modificaciones pendientes de aprobación</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {cambiosPendientes.map((cambio) => (
                <Card key={cambio.id} className="hover:border-emerald-300 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-slate-100 rounded-lg">
                          <Building className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge className={getTipoCambioColor(cambio.tipo_cambio)}>
                              {getTipoCambioLabel(cambio.tipo_cambio)}
                            </Badge>
                            <span className="font-mono text-sm text-slate-600 break-all">
                              {cambio.datos_propuestos?.codigo_predial_nacional || 'Nuevo'}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 mt-1">
                            {cambio.datos_propuestos?.municipio || 'N/A'} · 
                            Solicitado por: {cambio.propuesto_por_nombre || 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedCambio(cambio)}
                          data-testid={`view-cambio-${cambio.id}`}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Ver Detalle
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => openRechazarModal(cambio)}
                          disabled={procesando}
                          data-testid={`reject-cambio-${cambio.id}`}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Rechazar
                        </Button>
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => handleAprobar(cambio.id)}
                          disabled={procesando}
                          data-testid={`approve-cambio-${cambio.id}`}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Aprobar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab: Predios Nuevos */}
        <TabsContent value="predios-nuevos">
          {loadingPredios ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
          ) : prediosNuevos.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <CheckCircle className="w-16 h-16 mx-auto text-emerald-500 mb-4" />
                <h3 className="text-xl font-semibold text-slate-700">¡Todo al día!</h3>
                <p className="text-slate-500 mt-2">No hay predios nuevos en proceso</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {prediosNuevos.map((predio) => {
                const estadoInfo = estadoPredioConfig[predio.estado] || estadoPredioConfig.creado;
                const EstadoIcon = estadoInfo.icon;
                
                return (
                  <Card key={predio.id} className="hover:border-emerald-300 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-slate-100 rounded-lg">
                            <EstadoIcon className="w-5 h-5 text-slate-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge className={estadoInfo.color}>
                                {estadoInfo.label}
                              </Badge>
                              <span className="font-mono text-sm text-slate-600 break-all">
                                {predio.datos_predio?.codigo_predial_nacional || 'Nuevo'}
                              </span>
                            </div>
                            <p className="text-sm text-slate-500 mt-1">
                              {predio.datos_predio?.municipio || 'N/A'} · 
                              Creado por: {predio.creado_por_nombre || 'N/A'} · 
                              {formatDate(predio.fecha_creacion)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedPredioNuevo(predio);
                              setShowPredioDetailDialog(true);
                            }}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Ver Detalle
                          </Button>
                          
                          {/* Acciones según estado y rol */}
                          {predio.estado === 'digitalizacion' && (
                            <Button
                              size="sm"
                              className="bg-purple-600 hover:bg-purple-700 text-white"
                              onClick={() => openPredioActionDialog(predio, 'enviar_revision')}
                              disabled={procesando}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Enviar a Revisión
                            </Button>
                          )}
                          
                          {predio.estado === 'revision' && isCoordinador && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-orange-600 border-orange-200 hover:bg-orange-50"
                                onClick={() => openPredioActionDialog(predio, 'devolver')}
                                disabled={procesando}
                              >
                                <RefreshCw className="w-4 h-4 mr-1" />
                                Devolver
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => openPredioActionDialog(predio, 'rechazar')}
                                disabled={procesando}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Rechazar
                              </Button>
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => openPredioActionDialog(predio, 'aprobar')}
                                disabled={procesando}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Aprobar
                              </Button>
                            </>
                          )}
                          
                          {predio.estado === 'devuelto' && (
                            <Badge variant="outline" className="text-orange-600 border-orange-300">
                              Pendiente corrección
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {/* Historial colapsable */}
                      {predio.historial && predio.historial.length > 0 && (
                        <div className="mt-3 border-t pt-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-600 p-0 h-auto"
                            onClick={() => toggleHistorial(predio.id)}
                          >
                            <History className="w-4 h-4 mr-1" />
                            Historial ({predio.historial.length})
                            {expandedHistorial[predio.id] ? (
                              <ChevronUp className="w-4 h-4 ml-1" />
                            ) : (
                              <ChevronDown className="w-4 h-4 ml-1" />
                            )}
                          </Button>
                          
                          {expandedHistorial[predio.id] && (
                            <div className="mt-2 space-y-2 pl-5 border-l-2 border-slate-200">
                              {predio.historial.map((item, idx) => (
                                <div key={idx} className="text-sm">
                                  <span className="text-slate-400">{formatDate(item.fecha)}</span>
                                  <span className="mx-2">·</span>
                                  <span className="font-medium">{item.accion}</span>
                                  {item.usuario_nombre && (
                                    <span className="text-slate-500"> por {item.usuario_nombre}</span>
                                  )}
                                  {item.observaciones && (
                                    <p className="text-slate-500 italic mt-1">"{item.observaciones}"</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs> 
                        Solicitado por: {cambio.propuesto_por_nombre || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedCambio(cambio)}
                      data-testid={`view-cambio-${cambio.id}`}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Ver Detalle
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => openRechazarModal(cambio)}
                      disabled={procesando}
                      data-testid={`reject-cambio-${cambio.id}`}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Rechazar
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleAprobar(cambio.id)}
                      disabled={procesando}
                      data-testid={`approve-cambio-${cambio.id}`}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Aprobar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Detalle del Cambio con Comparación */}
      <Dialog open={!!selectedCambio} onOpenChange={() => setSelectedCambio(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="w-5 h-5" />
              Detalle del Cambio
            </DialogTitle>
            <DialogDescription>
              {selectedCambio?.tipo_cambio === 'modificacion' 
                ? 'Comparación entre valores actuales y propuestos'
                : selectedCambio?.tipo_cambio === 'creacion'
                ? 'Datos del nuevo predio propuesto'
                : 'Datos del cambio propuesto'
              }
            </DialogDescription>
          </DialogHeader>
          {selectedCambio && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge className={getTipoCambioColor(selectedCambio.tipo_cambio)}>
                  {getTipoCambioLabel(selectedCambio.tipo_cambio)}
                </Badge>
                <span className="text-sm text-slate-500">
                  Solicitado por: <strong>{selectedCambio.propuesto_por_nombre || 'N/A'}</strong>
                </span>
              </div>
              
              {/* Tabla Comparativa */}
              {selectedCambio.tipo_cambio === 'modificacion' && selectedCambio.predio_actual ? (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-slate-700">Campo</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-700">Valor Actual</th>
                        <th className="px-4 py-3 text-center w-12"></th>
                        <th className="px-4 py-3 text-left font-medium text-slate-700">Valor Propuesto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {getFieldChanges(selectedCambio).map((field, idx) => (
                        <tr 
                          key={idx} 
                          className={field.hayCambio ? 'bg-amber-50' : ''}
                        >
                          <td className="px-4 py-2 font-medium text-slate-600">
                            {field.label}
                          </td>
                          <td className="px-4 py-2 text-slate-900">
                            {field.valorActual}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {field.hayCambio && (
                              <ArrowRight className="w-4 h-4 text-amber-600 mx-auto" />
                            )}
                          </td>
                          <td className={`px-4 py-2 ${field.hayCambio ? 'text-amber-700 font-medium' : 'text-slate-900'}`}>
                            {field.valorPropuesto}
                            {field.hayCambio && (
                              <span className="ml-2 text-amber-600">⚠</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                // Para creación o cuando no hay predio actual, mostrar solo los datos propuestos
                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="font-medium text-slate-700 mb-3">Datos del Predio</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-slate-500">Código Predial Nacional:</span>
                      <p className="font-mono break-all">{selectedCambio.datos_propuestos?.codigo_predial_nacional || 'Nuevo'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Municipio:</span>
                      <p>{selectedCambio.datos_propuestos?.municipio || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Dirección:</span>
                      <p>{selectedCambio.datos_propuestos?.direccion || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Propietario(s):</span>
                      <p>{selectedCambio.datos_propuestos?.nombre_propietario || 
                          (selectedCambio.datos_propuestos?.propietarios?.length > 0 
                            ? selectedCambio.datos_propuestos.propietarios.map(p => p.nombre_propietario).join(', ')
                            : 'N/A')}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Área Terreno:</span>
                      <p>{selectedCambio.datos_propuestos?.area_terreno?.toLocaleString() || 'N/A'} m²</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Avalúo:</span>
                      <p>${selectedCambio.datos_propuestos?.avaluo?.toLocaleString() || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedCambio.justificacion && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-blue-800 mb-1">Justificación:</p>
                  <p className="text-sm text-blue-700">{selectedCambio.justificacion}</p>
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setSelectedCambio(null)}>
                  Cerrar
                </Button>
                <Button
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => {
                    setSelectedCambio(null);
                    openRechazarModal(selectedCambio);
                  }}
                  disabled={procesando}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Rechazar
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handleAprobar(selectedCambio.id)}
                  disabled={procesando}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Aprobar Cambio
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmación de Rechazo */}
      <Dialog open={showRechazarModal} onOpenChange={setShowRechazarModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              Rechazar Cambio
            </DialogTitle>
            <DialogDescription>
              El gestor que propuso este cambio será notificado con el motivo del rechazo.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {cambioArechazar && (
              <div className="bg-slate-50 rounded-lg p-3 text-sm">
                <p><strong>Tipo:</strong> {getTipoCambioLabel(cambioArechazar.tipo_cambio)}</p>
                <p><strong>Código:</strong> {cambioArechazar.datos_propuestos?.codigo_predial_nacional || 'Nuevo'}</p>
                <p><strong>Solicitado por:</strong> {cambioArechazar.propuesto_por_nombre || 'N/A'}</p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="motivo-rechazo" className="text-slate-700 font-medium">
                Motivo del Rechazo *
              </Label>
              <Textarea
                id="motivo-rechazo"
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                placeholder="Indique el motivo por el cual se rechaza este cambio..."
                rows={4}
                className="resize-none"
                data-testid="motivo-rechazo-input"
              />
              <p className="text-xs text-slate-500">
                Este mensaje será enviado al gestor que solicitó el cambio.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowRechazarModal(false);
                setCambioArechazar(null);
                setMotivoRechazo('');
              }}
            >
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleConfirmarRechazo}
              disabled={procesando || !motivoRechazo.trim()}
              data-testid="confirm-rechazo-btn"
            >
              {procesando ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              Confirmar Rechazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
