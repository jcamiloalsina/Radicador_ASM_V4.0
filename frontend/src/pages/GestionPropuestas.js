import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  GitCompare,
  Check,
  X,
  Eye,
  RefreshCw,
  Filter,
  CheckSquare,
  Square,
  ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function GestionPropuestas() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [proyectos, setProyectos] = useState([]);
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState(null);
  const [propuestas, setPropuestas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('pendiente');
  const [propuestaDetalle, setPropuestaDetalle] = useState(null);
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [comentarioRevision, setComentarioRevision] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [seleccionadas, setSeleccionadas] = useState([]);
  
  // Cargar proyectos
  useEffect(() => {
    const fetchProyectos = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API}/actualizacion/proyectos`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setProyectos(response.data.proyectos || []);
        if (response.data.proyectos?.length > 0) {
          setProyectoSeleccionado(response.data.proyectos[0].id);
        }
      } catch (error) {
        console.error('Error cargando proyectos:', error);
      }
    };
    fetchProyectos();
  }, []);
  
  // Cargar propuestas del proyecto seleccionado
  const fetchPropuestas = useCallback(async () => {
    if (!proyectoSeleccionado) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/actualizacion/proyectos/${proyectoSeleccionado}/propuestas?estado=${filtroEstado}`,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setPropuestas(response.data.propuestas || []);
      setSeleccionadas([]);
    } catch (error) {
      console.error('Error cargando propuestas:', error);
      toast.error('Error al cargar propuestas');
    } finally {
      setLoading(false);
    }
  }, [proyectoSeleccionado, filtroEstado]);
  
  useEffect(() => {
    fetchPropuestas();
  }, [fetchPropuestas]);
  
  // Aprobar propuesta individual
  const handleAprobar = async (propuestaId, comentario = '') => {
    setProcesando(true);
    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `${API}/actualizacion/propuestas/${propuestaId}/aprobar`,
        { comentario: comentario || comentarioRevision },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      toast.success('Propuesta aprobada exitosamente');
      setShowDetalleModal(false);
      setComentarioRevision('');
      fetchPropuestas();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al aprobar propuesta');
    } finally {
      setProcesando(false);
    }
  };
  
  // Rechazar propuesta individual
  const handleRechazar = async (propuestaId, comentario = '') => {
    if (!comentarioRevision.trim() && !comentario) {
      toast.error('Debe incluir un comentario para rechazar');
      return;
    }
    
    setProcesando(true);
    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `${API}/actualizacion/propuestas/${propuestaId}/rechazar`,
        { comentario: comentario || comentarioRevision },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      toast.success('Propuesta rechazada');
      setShowDetalleModal(false);
      setComentarioRevision('');
      fetchPropuestas();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al rechazar propuesta');
    } finally {
      setProcesando(false);
    }
  };
  
  // Aprobación masiva
  const handleAprobarMasivo = async () => {
    if (seleccionadas.length === 0) {
      toast.error('Seleccione al menos una propuesta');
      return;
    }
    
    setProcesando(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/actualizacion/proyectos/${proyectoSeleccionado}/propuestas/aprobar-masivo`,
        { 
          propuesta_ids: seleccionadas,
          comentario: 'Aprobación masiva'
        },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      toast.success(response.data.message);
      setSeleccionadas([]);
      fetchPropuestas();
    } catch (error) {
      toast.error('Error en aprobación masiva');
    } finally {
      setProcesando(false);
    }
  };
  
  // Toggle selección
  const toggleSeleccion = (propuestaId) => {
    setSeleccionadas(prev => 
      prev.includes(propuestaId)
        ? prev.filter(id => id !== propuestaId)
        : [...prev, propuestaId]
    );
  };
  
  // Seleccionar todas
  const toggleSeleccionarTodas = () => {
    if (seleccionadas.length === propuestas.length) {
      setSeleccionadas([]);
    } else {
      setSeleccionadas(propuestas.map(p => p.id));
    }
  };
  
  // Ver detalle de propuesta
  const verDetalle = (propuesta) => {
    setPropuestaDetalle(propuesta);
    setComentarioRevision('');
    setShowDetalleModal(true);
  };
  
  // Verificar permisos
  const esCoordinador = user?.role === 'coordinador' || user?.role === 'administrador';
  
  if (!esCoordinador) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">No tiene permiso para acceder a esta página</p>
        <Button onClick={() => navigate('/dashboard')} className="mt-4">
          Volver al Dashboard
        </Button>
      </div>
    );
  }
  
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Gestión de Propuestas</h1>
            <p className="text-sm text-slate-500">Aprueba o rechaza propuestas de cambio de los gestores</p>
          </div>
        </div>
      </div>
      
      {/* Filtros */}
      <div className="bg-white rounded-lg border p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <Label>Proyecto</Label>
            <Select value={proyectoSeleccionado || ''} onValueChange={setProyectoSeleccionado}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar proyecto" />
              </SelectTrigger>
              <SelectContent>
                {proyectos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="w-48">
            <Label>Estado</Label>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendiente">Pendientes</SelectItem>
                <SelectItem value="aprobada">Aprobadas</SelectItem>
                <SelectItem value="rechazada">Rechazadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button onClick={fetchPropuestas} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          
          {filtroEstado === 'pendiente' && seleccionadas.length > 0 && (
            <Button 
              onClick={handleAprobarMasivo}
              disabled={procesando}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {procesando ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Aprobar Seleccionadas ({seleccionadas.length})
            </Button>
          )}
        </div>
      </div>
      
      {/* Tabla de propuestas */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-slate-400" />
            <p className="text-slate-500 mt-2">Cargando propuestas...</p>
          </div>
        ) : propuestas.length === 0 ? (
          <div className="p-8 text-center">
            <GitCompare className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <p className="text-slate-500">No hay propuestas {filtroEstado === 'pendiente' ? 'pendientes' : filtroEstado === 'aprobada' ? 'aprobadas' : 'rechazadas'}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {filtroEstado === 'pendiente' && (
                  <TableHead className="w-12">
                    <button onClick={toggleSeleccionarTodas} className="p-1">
                      {seleccionadas.length === propuestas.length ? (
                        <CheckSquare className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-400" />
                      )}
                    </button>
                  </TableHead>
                )}
                <TableHead>Código Predial</TableHead>
                <TableHead>Justificación</TableHead>
                <TableHead>Creado Por</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {propuestas.map((propuesta) => (
                <TableRow key={propuesta.id}>
                  {filtroEstado === 'pendiente' && (
                    <TableCell>
                      <button onClick={() => toggleSeleccion(propuesta.id)} className="p-1">
                        {seleccionadas.includes(propuesta.id) ? (
                          <CheckSquare className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-400" />
                        )}
                      </button>
                    </TableCell>
                  )}
                  <TableCell className="font-mono text-sm">{propuesta.codigo_predial}</TableCell>
                  <TableCell className="max-w-xs truncate">{propuesta.justificacion}</TableCell>
                  <TableCell>{propuesta.creado_por}</TableCell>
                  <TableCell>{new Date(propuesta.creado_en).toLocaleDateString('es-CO')}</TableCell>
                  <TableCell>
                    <Badge variant={
                      propuesta.estado === 'aprobada' ? 'secondary' :
                      propuesta.estado === 'rechazada' ? 'destructive' :
                      'outline'
                    }>
                      {propuesta.estado}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => verDetalle(propuesta)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      {propuesta.estado === 'pendiente' && (
                        <>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-emerald-600 hover:text-emerald-700"
                            onClick={() => handleAprobar(propuesta.id)}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-red-600 hover:text-red-700"
                            onClick={() => verDetalle(propuesta)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      
      {/* Modal de detalle */}
      <Dialog open={showDetalleModal} onOpenChange={setShowDetalleModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-emerald-600" />
              Detalle de Propuesta
            </DialogTitle>
          </DialogHeader>
          
          {propuestaDetalle && (
            <div className="space-y-4">
              {/* Código predial */}
              <div className="bg-amber-50 p-3 rounded-lg">
                <p className="text-xs text-amber-600 uppercase font-medium">Predio</p>
                <p className="font-mono text-sm font-bold text-amber-800">
                  {propuestaDetalle.codigo_predial}
                </p>
              </div>
              
              {/* Comparativa */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-slate-700 mb-3">Datos Existentes</h4>
                  <div className="space-y-2 text-sm">
                    {Object.entries(propuestaDetalle.datos_existentes || {}).map(([key, val]) => (
                      <div key={key}>
                        <span className="text-slate-500 capitalize">{key.replace(/_/g, ' ')}:</span>
                        <span className="ml-2">{Array.isArray(val) ? `${val.length} registros` : val || '-'}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="bg-emerald-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-emerald-700 mb-3">Propuesta de Cambio</h4>
                  <div className="space-y-2 text-sm">
                    {Object.entries(propuestaDetalle.datos_propuestos || {}).map(([key, val]) => (
                      <div key={key}>
                        <span className="text-slate-500 capitalize">{key.replace(/_/g, ' ')}:</span>
                        <span className="ml-2">{Array.isArray(val) ? `${val.length} registros` : val || '-'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Justificación */}
              <div>
                <Label className="text-slate-600">Justificación del Cambio</Label>
                <p className="mt-1 p-3 bg-slate-50 rounded text-sm">{propuestaDetalle.justificacion}</p>
              </div>
              
              {/* Info de creación */}
              <div className="flex justify-between text-xs text-slate-500">
                <span>Creado por: {propuestaDetalle.creado_por}</span>
                <span>{new Date(propuestaDetalle.creado_en).toLocaleString('es-CO')}</span>
              </div>
              
              {/* Si está revisada, mostrar info */}
              {propuestaDetalle.estado !== 'pendiente' && (
                <div className={`p-3 rounded-lg ${propuestaDetalle.estado === 'aprobada' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <p className="text-sm font-medium">
                    {propuestaDetalle.estado === 'aprobada' ? '✓ Aprobada' : '✗ Rechazada'} por {propuestaDetalle.revisado_por}
                  </p>
                  {propuestaDetalle.comentario_revision && (
                    <p className="text-sm mt-1 italic">{propuestaDetalle.comentario_revision}</p>
                  )}
                </div>
              )}
              
              {/* Acciones si está pendiente */}
              {propuestaDetalle.estado === 'pendiente' && (
                <>
                  <div>
                    <Label>Comentario (requerido para rechazar)</Label>
                    <Textarea
                      value={comentarioRevision}
                      onChange={(e) => setComentarioRevision(e.target.value)}
                      placeholder="Escriba un comentario..."
                      rows={2}
                    />
                  </div>
                  
                  <DialogFooter className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => handleRechazar(propuestaDetalle.id)}
                      disabled={procesando || !comentarioRevision.trim()}
                      className="flex-1 border-red-500 text-red-700 hover:bg-red-50"
                    >
                      {procesando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4 mr-2" />}
                      Rechazar
                    </Button>
                    <Button 
                      onClick={() => handleAprobar(propuestaDetalle.id)}
                      disabled={procesando}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    >
                      {procesando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                      Aprobar
                    </Button>
                  </DialogFooter>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
