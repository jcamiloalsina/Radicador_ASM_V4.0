import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Clock, CheckCircle, XCircle, AlertCircle, Send, Eye, Edit, 
  RefreshCw, Loader2, FileText, User, Building, History, ChevronDown, ChevronUp
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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

// Colores y etiquetas para estados
const estadoConfig = {
  creado: { color: 'bg-blue-100 text-blue-800 border-blue-300', label: 'Creado', icon: FileText },
  digitalizacion: { color: 'bg-amber-100 text-amber-800 border-amber-300', label: 'En Digitalización', icon: Edit },
  revision: { color: 'bg-purple-100 text-purple-800 border-purple-300', label: 'En Revisión', icon: Eye },
  aprobado: { color: 'bg-emerald-100 text-emerald-800 border-emerald-300', label: 'Aprobado', icon: CheckCircle },
  devuelto: { color: 'bg-orange-100 text-orange-800 border-orange-300', label: 'Devuelto', icon: RefreshCw },
  rechazado: { color: 'bg-red-100 text-red-800 border-red-300', label: 'Rechazado', icon: XCircle },
};

export default function PrediosEnProceso() {
  const { user } = useAuth();
  const [predios, setPredios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPredio, setSelectedPredio] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState(''); // enviar_revision, aprobar, devolver, rechazar
  const [observaciones, setObservaciones] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [expandedHistorial, setExpandedHistorial] = useState({});

  const isCoordinador = user && ['coordinador', 'administrador'].includes(user.role);

  useEffect(() => {
    fetchPrediosPendientes();
  }, [filtroEstado]);

  const fetchPrediosPendientes = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${API}/predios-nuevos`;
      
      // Si hay filtro de estado, agregarlo
      if (filtroEstado !== 'todos') {
        url += `?estado=${filtroEstado}`;
      }
      
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPredios(res.data.predios || res.data || []);
    } catch (error) {
      console.error('Error cargando predios:', error);
      toast.error('Error al cargar predios en proceso');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!selectedPredio || !actionType) return;
    
    // Validar observaciones para devolver/rechazar
    if (['devolver', 'rechazar'].includes(actionType) && !observaciones.trim()) {
      toast.error('Debe ingresar observaciones para esta acción');
      return;
    }
    
    setProcesando(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/predios-nuevos/${selectedPredio.id}/accion`, {
        accion: actionType,
        observaciones: observaciones.trim() || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const mensajes = {
        enviar_revision: 'Predio enviado a revisión',
        aprobar: 'Predio aprobado e integrado al sistema',
        devolver: 'Predio devuelto para correcciones',
        rechazar: 'Predio rechazado'
      };
      
      toast.success(mensajes[actionType] || 'Acción completada');
      setShowActionDialog(false);
      setObservaciones('');
      setActionType('');
      fetchPrediosPendientes();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al procesar acción');
    } finally {
      setProcesando(false);
    }
  };

  const abrirAccion = (predio, accion) => {
    setSelectedPredio(predio);
    setActionType(accion);
    setObservaciones('');
    setShowActionDialog(true);
  };

  const toggleHistorial = (predioId) => {
    setExpandedHistorial(prev => ({
      ...prev,
      [predioId]: !prev[predioId]
    }));
  };

  // Contar predios por estado
  const contarPorEstado = (estado) => predios.filter(p => p.estado_flujo === estado).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-700" />
        <span className="ml-2 text-slate-600">Cargando predios en proceso...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Predios en Proceso</h1>
          <p className="text-slate-500">Gestión del flujo de trabajo para nuevos predios</p>
        </div>
        <Button onClick={fetchPrediosPendientes} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="cursor-pointer hover:border-slate-400" onClick={() => setFiltroEstado('todos')}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-slate-700">{predios.length}</p>
            <p className="text-xs text-slate-500">Total</p>
          </CardContent>
        </Card>
        {Object.entries(estadoConfig).map(([estado, config]) => (
          <Card 
            key={estado} 
            className={`cursor-pointer hover:border-slate-400 ${filtroEstado === estado ? 'ring-2 ring-emerald-500' : ''}`}
            onClick={() => setFiltroEstado(estado)}
          >
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: config.color.includes('emerald') ? '#059669' : config.color.includes('amber') ? '#d97706' : config.color.includes('purple') ? '#7c3aed' : config.color.includes('blue') ? '#2563eb' : config.color.includes('orange') ? '#ea580c' : '#dc2626' }}>
                {contarPorEstado(estado)}
              </p>
              <p className="text-xs text-slate-500">{config.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtro */}
      <div className="flex items-center gap-4">
        <Label>Filtrar por estado:</Label>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {Object.entries(estadoConfig).map(([estado, config]) => (
              <SelectItem key={estado} value={estado}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista de Predios */}
      {predios.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="w-12 h-12 mx-auto text-emerald-500 mb-4" />
            <p className="text-slate-600 font-medium">No hay predios pendientes</p>
            <p className="text-slate-400 text-sm">Todos los predios han sido procesados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {predios.map(predio => {
            const config = estadoConfig[predio.estado_flujo] || estadoConfig.creado;
            const IconoEstado = config.icon;
            const esMiTarea = predio.gestor_apoyo_id === user?.id || predio.gestor_creador_id === user?.id;
            
            return (
              <Card key={predio.id} className={`border-l-4 ${esMiTarea ? 'border-l-emerald-500' : 'border-l-slate-300'}`}>
                <CardContent className="py-4">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    {/* Info Principal */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge className={`${config.color} flex items-center gap-1`}>
                          <IconoEstado className="w-3 h-3" />
                          {config.label}
                        </Badge>
                        <span className="font-mono text-sm text-slate-700">{predio.codigo_predial_nacional}</span>
                        {esMiTarea && (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
                            Mi tarea
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-slate-400 text-xs">Municipio</p>
                          <p className="font-medium text-slate-700">{predio.municipio}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-xs">Propietario</p>
                          <p className="font-medium text-slate-700">{predio.nombre_propietario || 'Sin asignar'}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-xs">Creado por</p>
                          <p className="font-medium text-slate-700">{predio.gestor_creador_nombre}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-xs">Gestor Apoyo</p>
                          <p className="font-medium text-slate-700">{predio.gestor_apoyo_nombre}</p>
                        </div>
                      </div>
                      
                      {predio.radicado_completo && (
                        <div className="text-sm">
                          <span className="text-slate-400">Radicado: </span>
                          <span className="font-mono text-emerald-700">{predio.radicado_completo}</span>
                        </div>
                      )}
                      
                      {predio.observaciones && (
                        <div className="bg-slate-50 p-2 rounded text-sm">
                          <span className="text-slate-500">Observaciones: </span>
                          <span className="text-slate-700">{predio.observaciones}</span>
                        </div>
                      )}
                      
                      {/* Historial expandible */}
                      {predio.historial_flujo && predio.historial_flujo.length > 0 && (
                        <div className="mt-2">
                          <button 
                            onClick={() => toggleHistorial(predio.id)}
                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                          >
                            <History className="w-3 h-3" />
                            Historial ({predio.historial_flujo.length})
                            {expandedHistorial[predio.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                          {expandedHistorial[predio.id] && (
                            <div className="mt-2 space-y-1 pl-4 border-l-2 border-slate-200">
                              {predio.historial_flujo.map((h, idx) => (
                                <div key={idx} className="text-xs text-slate-600">
                                  <span className="font-medium">{h.accion}</span>
                                  <span className="text-slate-400"> por {h.usuario_nombre} - {formatDate(h.fecha)}</span>
                                  {h.observaciones && <p className="text-slate-500 italic">{h.observaciones}</p>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Acciones */}
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => { setSelectedPredio(predio); setShowDetailDialog(true); }}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Ver
                      </Button>
                      
                      {/* Acciones según estado y rol */}
                      {predio.estado_flujo === 'creado' && predio.gestor_apoyo_id === user?.id && (
                        <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => abrirAccion(predio, 'enviar_revision')}>
                          <Send className="w-4 h-4 mr-1" />
                          Enviar a Revisión
                        </Button>
                      )}
                      
                      {predio.estado_flujo === 'digitalizacion' && predio.gestor_apoyo_id === user?.id && (
                        <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => abrirAccion(predio, 'enviar_revision')}>
                          <Send className="w-4 h-4 mr-1" />
                          Enviar a Revisión
                        </Button>
                      )}
                      
                      {predio.estado_flujo === 'devuelto' && (predio.gestor_apoyo_id === user?.id || predio.gestor_creador_id === user?.id) && (
                        <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => abrirAccion(predio, 'enviar_revision')}>
                          <Send className="w-4 h-4 mr-1" />
                          Reenviar a Revisión
                        </Button>
                      )}
                      
                      {predio.estado_flujo === 'revision' && isCoordinador && (
                        <>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => abrirAccion(predio, 'aprobar')}>
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Aprobar
                          </Button>
                          <Button size="sm" variant="outline" className="text-orange-600 border-orange-300" onClick={() => abrirAccion(predio, 'devolver')}>
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Devolver
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => abrirAccion(predio, 'rechazar')}>
                            <XCircle className="w-4 h-4 mr-1" />
                            Rechazar
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog de Detalle */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle del Predio</DialogTitle>
          </DialogHeader>
          
          {selectedPredio && (
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="propietario">Propietario</TabsTrigger>
                <TabsTrigger value="historial">Historial</TabsTrigger>
              </TabsList>
              
              <TabsContent value="general" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-slate-500">Código Predial</Label>
                    <p className="font-mono text-sm">{selectedPredio.codigo_predial_nacional}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Municipio</Label>
                    <p className="font-medium">{selectedPredio.municipio}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Dirección</Label>
                    <p>{selectedPredio.direccion || 'Sin dirección'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Destino Económico</Label>
                    <p>{selectedPredio.destino_economico}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Área Terreno (m²)</Label>
                    <p>{(selectedPredio.area_terreno || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Área Construida (m²)</Label>
                    <p>{(selectedPredio.area_construida || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Avalúo (COP)</Label>
                    <p>${(selectedPredio.avaluo || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Matrícula Inmobiliaria</Label>
                    <p>{selectedPredio.matricula_inmobiliaria || 'Sin matrícula'}</p>
                  </div>
                </div>
                
                {selectedPredio.radicado_completo && (
                  <div className="bg-emerald-50 p-3 rounded">
                    <Label className="text-xs text-emerald-600">Radicado Relacionado</Label>
                    <p className="font-mono text-emerald-800">{selectedPredio.radicado_completo}</p>
                  </div>
                )}
                
                {selectedPredio.peticiones_relacionadas?.length > 0 && (
                  <div className="bg-blue-50 p-3 rounded">
                    <Label className="text-xs text-blue-600">Peticiones Relacionadas</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedPredio.peticiones_relacionadas.map((p, i) => (
                        <Badge key={i} variant="outline" className="bg-blue-100">{p}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="propietario" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label className="text-xs text-slate-500">Nombre Completo</Label>
                    <p className="font-medium">{selectedPredio.nombre_propietario || 'Sin propietario'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Tipo Documento</Label>
                    <p>{selectedPredio.tipo_documento || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Número Documento</Label>
                    <p>{selectedPredio.numero_documento || 'N/A'}</p>
                  </div>
                </div>
                
                {selectedPredio.propietarios?.length > 1 && (
                  <div className="mt-4">
                    <Label className="text-sm font-medium">Otros Propietarios</Label>
                    <div className="space-y-2 mt-2">
                      {selectedPredio.propietarios.slice(1).map((p, i) => (
                        <div key={i} className="bg-slate-50 p-2 rounded text-sm">
                          <p className="font-medium">{p.nombre_propietario}</p>
                          <p className="text-slate-500">{p.tipo_documento} - {p.numero_documento}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="historial" className="mt-4">
                {selectedPredio.historial_flujo?.length > 0 ? (
                  <div className="space-y-3">
                    {selectedPredio.historial_flujo.map((h, idx) => (
                      <div key={idx} className="flex gap-3 p-3 bg-slate-50 rounded">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-slate-800">{h.accion}</p>
                          <p className="text-sm text-slate-500">
                            Por {h.usuario_nombre} - {formatDate(h.fecha)}
                          </p>
                          {h.observaciones && (
                            <p className="text-sm text-slate-600 mt-1 italic">"{h.observaciones}"</p>
                          )}
                          {h.estado_anterior && h.estado_nuevo && h.estado_anterior !== h.estado_nuevo && (
                            <p className="text-xs text-slate-400 mt-1">
                              {h.estado_anterior} → {h.estado_nuevo}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-slate-400 py-8">Sin historial registrado</p>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Acción */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionType === 'aprobar' && <CheckCircle className="w-5 h-5 text-emerald-600" />}
              {actionType === 'devolver' && <RefreshCw className="w-5 h-5 text-orange-600" />}
              {actionType === 'rechazar' && <XCircle className="w-5 h-5 text-red-600" />}
              {actionType === 'enviar_revision' && <Send className="w-5 h-5 text-amber-600" />}
              {actionType === 'aprobar' && 'Aprobar Predio'}
              {actionType === 'devolver' && 'Devolver para Corrección'}
              {actionType === 'rechazar' && 'Rechazar Predio'}
              {actionType === 'enviar_revision' && 'Enviar a Revisión'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {selectedPredio && (
              <div className="bg-slate-50 p-3 rounded">
                <p className="text-sm text-slate-600">
                  <strong>Código:</strong> {selectedPredio.codigo_predial_nacional}
                </p>
                <p className="text-sm text-slate-600">
                  <strong>Municipio:</strong> {selectedPredio.municipio}
                </p>
              </div>
            )}
            
            <div>
              <Label className={['devolver', 'rechazar'].includes(actionType) ? 'font-medium text-red-700' : ''}>
                Observaciones {['devolver', 'rechazar'].includes(actionType) ? '*' : '(opcional)'}
              </Label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder={
                  actionType === 'devolver' ? 'Indique qué debe corregirse...' :
                  actionType === 'rechazar' ? 'Motivo del rechazo...' :
                  'Observaciones adicionales...'
                }
                className="w-full mt-1 p-2 border rounded text-sm min-h-[100px]"
              />
            </div>
            
            {actionType === 'aprobar' && (
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded text-sm text-emerald-800">
                <p className="font-medium">Al aprobar:</p>
                <ul className="list-disc list-inside mt-1 text-emerald-700">
                  <li>El predio será integrado a la base de datos principal</li>
                  <li>Estará disponible en la lista de predios del municipio</li>
                  <li>Se incluirá en las exportaciones R1/R2</li>
                </ul>
              </div>
            )}
            
            {actionType === 'rechazar' && (
              <div className="bg-red-50 border border-red-200 p-3 rounded text-sm text-red-800">
                <p className="font-medium">⚠️ Atención:</p>
                <p className="mt-1 text-red-700">El rechazo es definitivo y el predio no será creado.</p>
              </div>
            )}
          </div>
          
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowActionDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAction}
              disabled={procesando}
              className={
                actionType === 'aprobar' ? 'bg-emerald-600 hover:bg-emerald-700' :
                actionType === 'rechazar' ? 'bg-red-600 hover:bg-red-700' :
                'bg-amber-600 hover:bg-amber-700'
              }
            >
              {procesando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {actionType === 'aprobar' && 'Confirmar Aprobación'}
              {actionType === 'devolver' && 'Devolver'}
              {actionType === 'rechazar' && 'Confirmar Rechazo'}
              {actionType === 'enviar_revision' && 'Enviar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
