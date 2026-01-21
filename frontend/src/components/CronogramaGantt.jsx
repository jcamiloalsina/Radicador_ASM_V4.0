import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { 
  Calendar, 
  ChevronDown, 
  ChevronRight, 
  AlertCircle, 
  Clock, 
  CheckCircle, 
  Play, 
  Pause,
  Users,
  Plus,
  Edit,
  Filter,
  BarChart3
} from 'lucide-react';
import { format, differenceInDays, isAfter, isBefore, addDays, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, eachMonthOfInterval, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

// Colores por estado
const estadoColores = {
  'pendiente': { bg: 'bg-slate-200', text: 'text-slate-600', bar: 'bg-slate-400' },
  'en_progreso': { bg: 'bg-blue-100', text: 'text-blue-700', bar: 'bg-blue-500' },
  'completada': { bg: 'bg-emerald-100', text: 'text-emerald-700', bar: 'bg-emerald-500' },
  'bloqueada': { bg: 'bg-red-100', text: 'text-red-700', bar: 'bg-red-500' }
};

// Colores por etapa
const etapaColores = {
  'Preoperativa': { bg: 'bg-purple-500', light: 'bg-purple-100', text: 'text-purple-700' },
  'Operativa': { bg: 'bg-amber-500', light: 'bg-amber-100', text: 'text-amber-700' },
  'Post-Operativa': { bg: 'bg-teal-500', light: 'bg-teal-100', text: 'text-teal-700' }
};

// Componente de barra de Gantt para una actividad
const GanttBar = ({ actividad, startDate, endDate, totalDays, onClick }) => {
  const actividadStart = actividad.fecha_inicio ? parseISO(actividad.fecha_inicio) : null;
  const actividadEnd = actividad.fecha_limite ? parseISO(actividad.fecha_limite) : null;
  
  if (!actividadStart || !actividadEnd) return null;
  
  const offsetDays = Math.max(0, differenceInDays(actividadStart, startDate));
  const durationDays = Math.max(1, differenceInDays(actividadEnd, actividadStart) + 1);
  
  const leftPercent = (offsetDays / totalDays) * 100;
  const widthPercent = (durationDays / totalDays) * 100;
  
  const estado = actividad.estado || 'pendiente';
  const colores = estadoColores[estado] || estadoColores.pendiente;
  
  // Verificar si está atrasada
  const hoy = startOfDay(new Date());
  const estaAtrasada = estado !== 'completada' && actividadEnd && isBefore(actividadEnd, hoy);
  
  return (
    <div
      className={`absolute h-6 rounded cursor-pointer transition-all hover:opacity-80 hover:shadow-md ${estaAtrasada ? 'bg-red-500' : colores.bar}`}
      style={{
        left: `${Math.min(leftPercent, 100)}%`,
        width: `${Math.min(widthPercent, 100 - leftPercent)}%`,
        top: '50%',
        transform: 'translateY(-50%)'
      }}
      onClick={() => onClick(actividad)}
      title={`${actividad.nombre}\n${format(actividadStart, 'dd/MM/yyyy')} - ${format(actividadEnd, 'dd/MM/yyyy')}`}
    >
      <span className="text-xs text-white px-2 truncate block leading-6">
        {actividad.nombre}
      </span>
    </div>
  );
};

// Componente principal
export default function CronogramaGantt({ etapas, proyectoId, onUpdate, gestoresDisponibles = [] }) {
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroResponsable, setFiltroResponsable] = useState('todos');
  const [etapasAbiertas, setEtapasAbiertas] = useState(() => {
    const init = {};
    etapas.forEach(e => { init[e.id] = true; });
    return init;
  });
  const [actividadSeleccionada, setActividadSeleccionada] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  
  // Calcular rango de fechas del proyecto
  const { startDate, endDate, totalDays, meses } = useMemo(() => {
    let minDate = new Date();
    let maxDate = new Date();
    
    etapas.forEach(etapa => {
      (etapa.actividades || []).forEach(act => {
        if (act.fecha_inicio) {
          const start = parseISO(act.fecha_inicio);
          if (isBefore(start, minDate)) minDate = start;
        }
        if (act.fecha_limite) {
          const end = parseISO(act.fecha_limite);
          if (isAfter(end, maxDate)) maxDate = end;
        }
      });
    });
    
    // Agregar margen
    minDate = startOfMonth(minDate);
    maxDate = endOfMonth(maxDate);
    
    const days = differenceInDays(maxDate, minDate) + 1;
    const monthsInterval = eachMonthOfInterval({ start: minDate, end: maxDate });
    
    return {
      startDate: minDate,
      endDate: maxDate,
      totalDays: days,
      meses: monthsInterval
    };
  }, [etapas]);
  
  // Estadísticas
  const estadisticas = useMemo(() => {
    let total = 0, completadas = 0, enProgreso = 0, atrasadas = 0, proximas = 0;
    const hoy = startOfDay(new Date());
    const en7Dias = addDays(hoy, 7);
    
    etapas.forEach(etapa => {
      (etapa.actividades || []).forEach(act => {
        total++;
        if (act.estado === 'completada') completadas++;
        else if (act.estado === 'en_progreso') enProgreso++;
        
        if (act.fecha_limite && act.estado !== 'completada') {
          const limite = parseISO(act.fecha_limite);
          if (isBefore(limite, hoy)) atrasadas++;
          else if (isBefore(limite, en7Dias)) proximas++;
        }
      });
    });
    
    return { total, completadas, enProgreso, atrasadas, proximas, porcentaje: total > 0 ? Math.round((completadas / total) * 100) : 0 };
  }, [etapas]);
  
  // Filtrar actividades
  const actividadesFiltradas = useMemo(() => {
    return etapas.map(etapa => ({
      ...etapa,
      actividades: (etapa.actividades || []).filter(act => {
        if (filtroEstado !== 'todos' && act.estado !== filtroEstado) return false;
        if (filtroResponsable !== 'todos') {
          const tieneResponsable = (act.responsables || []).some(r => r.id === filtroResponsable || r.email === filtroResponsable);
          if (!tieneResponsable) return false;
        }
        return true;
      })
    }));
  }, [etapas, filtroEstado, filtroResponsable]);
  
  // Abrir modal de edición
  const handleEditActividad = (actividad) => {
    setActividadSeleccionada(actividad);
    setEditData({
      nombre: actividad.nombre || '',
      descripcion: actividad.descripcion || '',
      fecha_inicio: actividad.fecha_inicio ? actividad.fecha_inicio.split('T')[0] : '',
      fecha_limite: actividad.fecha_limite ? actividad.fecha_limite.split('T')[0] : '',
      prioridad: actividad.prioridad || 'media',
      estado: actividad.estado || 'pendiente'
    });
    setShowEditModal(true);
  };
  
  // Guardar cambios
  const handleSaveActividad = async () => {
    if (!actividadSeleccionada) return;
    
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `${API}/actualizacion/actividades/${actividadSeleccionada.id}`,
        editData,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      toast.success('Actividad actualizada');
      setShowEditModal(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div className="space-y-4">
      {/* Header con estadísticas */}
      <Card className="bg-gradient-to-r from-slate-50 to-slate-100">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Progreso general */}
            <div className="flex items-center gap-4">
              <div className="w-32">
                <p className="text-xs text-slate-500 mb-1">Progreso General</p>
                <Progress value={estadisticas.porcentaje} className="h-3" />
                <p className="text-xs text-slate-600 mt-1 text-right">{estadisticas.porcentaje}%</p>
              </div>
            </div>
            
            {/* Indicadores */}
            <div className="flex gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-medium">{estadisticas.completadas}</span>
                <span className="text-xs text-slate-500">Completadas</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border">
                <Play className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium">{estadisticas.enProgreso}</span>
                <span className="text-xs text-slate-500">En progreso</span>
              </div>
              {estadisticas.atrasadas > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-lg border border-red-200">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-bold text-red-600">{estadisticas.atrasadas}</span>
                  <span className="text-xs text-red-500">Atrasadas</span>
                </div>
              )}
              {estadisticas.proximas > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-lg border border-amber-200">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-bold text-amber-600">{estadisticas.proximas}</span>
                  <span className="text-xs text-amber-500">Próximas</span>
                </div>
              )}
            </div>
            
            {/* Filtros */}
            <div className="flex gap-2">
              <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <Filter className="w-3 h-3 mr-1" />
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  <SelectItem value="pendiente">⚪ Pendiente</SelectItem>
                  <SelectItem value="en_progreso">🔵 En progreso</SelectItem>
                  <SelectItem value="completada">✅ Completada</SelectItem>
                  <SelectItem value="bloqueada">🔴 Bloqueada</SelectItem>
                </SelectContent>
              </Select>
              
              {gestoresDisponibles.length > 0 && (
                <Select value={filtroResponsable} onValueChange={setFiltroResponsable}>
                  <SelectTrigger className="w-[160px] h-8 text-xs">
                    <Users className="w-3 h-3 mr-1" />
                    <SelectValue placeholder="Responsable" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {gestoresDisponibles.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.full_name || g.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Vista Gantt */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-amber-600" />
              Cronograma del Proyecto
            </CardTitle>
            <div className="text-xs text-slate-500">
              {format(startDate, 'MMM yyyy', { locale: es })} - {format(endDate, 'MMM yyyy', { locale: es })}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Encabezado de meses */}
          <div className="flex border-b mb-2">
            <div className="w-64 shrink-0 px-2 py-1 text-xs font-semibold text-slate-600 border-r">
              Actividad
            </div>
            <div className="flex-1 flex">
              {meses.map((mes, idx) => {
                const diasEnMes = differenceInDays(endOfMonth(mes), startOfMonth(mes)) + 1;
                const widthPercent = (diasEnMes / totalDays) * 100;
                return (
                  <div 
                    key={idx} 
                    className="text-center text-xs font-medium text-slate-500 py-1 border-r last:border-r-0"
                    style={{ width: `${widthPercent}%` }}
                  >
                    {format(mes, 'MMM yyyy', { locale: es })}
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Etapas y actividades */}
          <div className="space-y-1">
            {actividadesFiltradas.map((etapa) => {
              const etapaColor = etapaColores[etapa.nombre] || etapaColores['Operativa'];
              const isOpen = etapasAbiertas[etapa.id];
              const actividadesCount = (etapa.actividades || []).length;
              
              return (
                <Collapsible 
                  key={etapa.id} 
                  open={isOpen}
                  onOpenChange={(open) => setEtapasAbiertas(prev => ({ ...prev, [etapa.id]: open }))}
                >
                  {/* Fila de etapa */}
                  <CollapsibleTrigger asChild>
                    <div className={`flex items-center cursor-pointer hover:bg-slate-50 rounded ${etapaColor.light}`}>
                      <div className="w-64 shrink-0 px-2 py-2 flex items-center gap-2 border-r">
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        <div className={`w-3 h-3 rounded ${etapaColor.bg}`}></div>
                        <span className={`font-semibold text-sm ${etapaColor.text}`}>{etapa.nombre}</span>
                        <Badge variant="outline" className="text-xs ml-auto">{actividadesCount}</Badge>
                      </div>
                      <div className="flex-1 relative h-8">
                        {/* Barra de la etapa (si tiene fechas) */}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    {/* Filas de actividades */}
                    {(etapa.actividades || []).map((actividad) => {
                      const estado = actividad.estado || 'pendiente';
                      const colores = estadoColores[estado];
                      const hoy = startOfDay(new Date());
                      const limite = actividad.fecha_limite ? parseISO(actividad.fecha_limite) : null;
                      const estaAtrasada = estado !== 'completada' && limite && isBefore(limite, hoy);
                      
                      return (
                        <div 
                          key={actividad.id} 
                          className="flex items-center hover:bg-slate-50 border-t border-slate-100"
                        >
                          <div className="w-64 shrink-0 px-2 py-2 pl-8 border-r flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${estaAtrasada ? 'bg-red-500' : colores.bar}`}></span>
                            <span className="text-sm truncate flex-1" title={actividad.nombre}>
                              {actividad.nombre}
                            </span>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                              onClick={() => handleEditActividad(actividad)}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                          </div>
                          <div className="flex-1 relative h-10">
                            <GanttBar 
                              actividad={actividad}
                              startDate={startDate}
                              endDate={endDate}
                              totalDays={totalDays}
                              onClick={handleEditActividad}
                            />
                          </div>
                        </div>
                      );
                    })}
                    
                    {actividadesCount === 0 && (
                      <div className="text-center py-4 text-sm text-slate-400 border-t">
                        No hay actividades {filtroEstado !== 'todos' ? 'con este filtro' : 'en esta etapa'}
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
          
          {/* Leyenda */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs text-slate-500">
            <span className="font-medium">Leyenda:</span>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-slate-400"></div>
              <span>Pendiente</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-blue-500"></div>
              <span>En progreso</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-emerald-500"></div>
              <span>Completada</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-red-500"></div>
              <span>Atrasada/Bloqueada</span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Panel de Alertas */}
      {(estadisticas.atrasadas > 0 || estadisticas.proximas > 0) && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-700">
              <AlertCircle className="w-5 h-5" />
              Alertas de Vencimiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {etapas.flatMap(etapa => 
                (etapa.actividades || [])
                  .filter(act => {
                    if (act.estado === 'completada') return false;
                    if (!act.fecha_limite) return false;
                    const limite = parseISO(act.fecha_limite);
                    const hoy = startOfDay(new Date());
                    const en7Dias = addDays(hoy, 7);
                    return isBefore(limite, en7Dias);
                  })
                  .map(act => {
                    const limite = parseISO(act.fecha_limite);
                    const hoy = startOfDay(new Date());
                    const diasRestantes = differenceInDays(limite, hoy);
                    const estaVencida = diasRestantes < 0;
                    
                    return (
                      <div 
                        key={act.id}
                        className={`flex items-center justify-between p-2 rounded-lg ${estaVencida ? 'bg-red-100 border border-red-200' : 'bg-white border border-amber-200'}`}
                      >
                        <div className="flex items-center gap-2">
                          {estaVencida ? (
                            <AlertCircle className="w-4 h-4 text-red-500" />
                          ) : (
                            <Clock className="w-4 h-4 text-amber-500" />
                          )}
                          <span className="text-sm font-medium">{act.nombre}</span>
                          <Badge variant="outline" className="text-xs">{etapa.nombre}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${estaVencida ? 'text-red-600' : 'text-amber-600'}`}>
                            {estaVencida 
                              ? `Vencida hace ${Math.abs(diasRestantes)} día(s)` 
                              : diasRestantes === 0 
                                ? 'Vence hoy' 
                                : `Vence en ${diasRestantes} día(s)`
                            }
                          </span>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6"
                            onClick={() => handleEditActividad(act)}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Modal de edición */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Actividad</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Nombre</Label>
              <Input 
                value={editData.nombre || ''} 
                onChange={(e) => setEditData(prev => ({ ...prev, nombre: e.target.value }))}
              />
            </div>
            
            <div>
              <Label>Descripción</Label>
              <Textarea 
                value={editData.descripcion || ''} 
                onChange={(e) => setEditData(prev => ({ ...prev, descripcion: e.target.value }))}
                rows={2}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fecha Inicio</Label>
                <Input 
                  type="date"
                  value={editData.fecha_inicio || ''} 
                  onChange={(e) => setEditData(prev => ({ ...prev, fecha_inicio: e.target.value }))}
                />
              </div>
              <div>
                <Label>Fecha Límite</Label>
                <Input 
                  type="date"
                  value={editData.fecha_limite || ''} 
                  onChange={(e) => setEditData(prev => ({ ...prev, fecha_limite: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Prioridad</Label>
                <Select value={editData.prioridad || 'media'} onValueChange={(v) => setEditData(prev => ({ ...prev, prioridad: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alta">🔴 Alta</SelectItem>
                    <SelectItem value="media">🟡 Media</SelectItem>
                    <SelectItem value="baja">🟢 Baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={editData.estado || 'pendiente'} onValueChange={(v) => setEditData(prev => ({ ...prev, estado: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">⚪ Pendiente</SelectItem>
                    <SelectItem value="en_progreso">🔵 En progreso</SelectItem>
                    <SelectItem value="completada">✅ Completada</SelectItem>
                    <SelectItem value="bloqueada">🔴 Bloqueada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveActividad} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
