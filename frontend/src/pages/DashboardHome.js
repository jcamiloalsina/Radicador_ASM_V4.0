import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  FileText, Clock, CheckCircle, XCircle, Plus, FileCheck,
  Building, Edit, ArrowRight, MapPin, Loader2, RefreshCw,
  AlertCircle, ChevronRight, Layers, TrendingUp, Eye,
  BarChart3, Timer, UserCheck, Send, ChevronDown, ChevronUp, Inbox
} from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function DashboardHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [misPeticiones, setMisPeticiones] = useState(null);
  const [loading, setLoading] = useState(true);
  const [radicadosExpanded, setRadicadosExpanded] = useState(false);

  useEffect(() => {
    fetchStats();

    // Auto-refresh cada 30 segundos
    const interval = setInterval(fetchStats, 30000);

    const handlePendientesUpdated = () => fetchStats();
    window.addEventListener('pendientesUpdated', handlePendientesUpdated);
    return () => {
      clearInterval(interval);
      window.removeEventListener('pendientesUpdated', handlePendientesUpdated);
    };
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [statsRes] = await Promise.all([
        axios.get(`${API}/petitions/stats/dashboard`, { headers }),
      ]);
      setStats(statsRes.data);

      // Para ciudadanos, cargar sus peticiones recientes
      if (user?.role === 'usuario') {
        try {
          const petRes = await axios.get(`${API}/petitions?limit=5&sort=-created_at`, { headers });
          setMisPeticiones(petRes.data?.petitions || petRes.data || []);
        } catch { setMisPeticiones([]); }
      }
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
      toast.error('Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-12 h-12 animate-spin text-emerald-600" />
      </div>
    );
  }

  const esUsuarioCiudadano = user?.role === 'usuario';
  const esGestor = user?.role === 'gestor' || user?.role === 'gestor_auxiliar';
  const esAtencion = user?.role === 'atencion_usuario';
  const esCoordinador = user?.role === 'coordinador';
  const esAdmin = user?.role === 'administrador';
  const esAprobador = stats?.es_aprobador || esCoordinador || esAdmin;
  const veRadicadosTotales = esAtencion || esCoordinador || esAdmin;

  // Calcular resumen urgente para el encabezado
  const getResumenUrgente = () => {
    if (esUsuarioCiudadano) {
      const devueltos = stats?.devuelto || 0;
      if (devueltos > 0) return { text: `Tienes ${devueltos} trámite${devueltos > 1 ? 's' : ''} devuelto${devueltos > 1 ? 's' : ''} que requiere${devueltos > 1 ? 'n' : ''} tu atención`, color: 'text-amber-600', icon: AlertCircle };
      const activos = (stats?.asignado || 0) + (stats?.revision || 0) + (stats?.radicado || 0);
      if (activos > 0) return { text: `${activos} trámite${activos > 1 ? 's' : ''} en proceso`, color: 'text-blue-600', icon: Clock };
      return { text: 'No tienes trámites pendientes', color: 'text-slate-500', icon: CheckCircle };
    }
    if (esGestor) {
      const total = (stats?.predios_creados || 0) + (stats?.predios_asignados || 0) + (stats?.modificaciones_asignadas || 0);
      if (total > 0) return { text: `${total} tarea${total > 1 ? 's' : ''} pendiente${total > 1 ? 's' : ''}`, color: 'text-amber-600', icon: Timer };
      return { text: 'Sin tareas pendientes', color: 'text-emerald-600', icon: CheckCircle };
    }
    if (esAprobador) {
      const total = stats?.mutaciones_pendientes || 0;
      if (total > 0) {
        return { text: `${total} mutacion${total > 1 ? 'es' : ''} pendiente${total > 1 ? 's' : ''} de aprobación`, color: 'text-purple-600', icon: AlertCircle };
      }
      return { text: 'Todo al día, sin pendientes', color: 'text-emerald-600', icon: CheckCircle };
    }
    if (esAtencion) {
      const nuevos = stats?.radicado || 0;
      if (nuevos > 0) return { text: `${nuevos} trámite${nuevos > 1 ? 's' : ''} nuevo${nuevos > 1 ? 's' : ''} sin asignar`, color: 'text-red-600', icon: AlertCircle };
      return { text: 'Todos los trámites están asignados', color: 'text-emerald-600', icon: CheckCircle };
    }
    return null;
  };

  const getSaludo = () => {
    const hora = new Date().getHours();
    if (hora < 12) return 'Buenos días';
    if (hora < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const resumen = getResumenUrgente();

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffHours < 1) return 'Hace un momento';
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  };

  const estadoConfig = {
    'radicado': { label: 'Radicado', color: 'bg-slate-500', badgeColor: 'bg-slate-100 text-slate-700', step: 1 },
    'asignado': { label: 'Asignado', color: 'bg-amber-500', badgeColor: 'bg-amber-100 text-amber-700', step: 2 },
    'en_proceso': { label: 'En proceso', color: 'bg-blue-500', badgeColor: 'bg-blue-100 text-blue-700', step: 2 },
    'revision': { label: 'En revisión', color: 'bg-purple-500', badgeColor: 'bg-purple-100 text-purple-700', step: 3 },
    'devuelto': { label: 'Devuelto', color: 'bg-red-500', badgeColor: 'bg-red-100 text-red-700', step: 2 },
    'finalizado': { label: 'Finalizado', color: 'bg-emerald-500', badgeColor: 'bg-emerald-100 text-emerald-700', step: 4 },
    'rechazado': { label: 'Rechazado', color: 'bg-red-600', badgeColor: 'bg-red-100 text-red-700', step: 4 },
  };

  // Tarjeta de radicados asignados (reutilizable para roles internos)
  const radicadosAsignados = stats?.tareas_urgentes?.peticiones_asignadas || [];
  const renderRadicadosAsignados = () => {
    if (radicadosAsignados.length === 0) return null;
    return (
      <Card className="border-blue-200 bg-blue-50/30">
        <CardContent className="p-0">
          <div
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-blue-50 transition-colors rounded-t-lg"
            onClick={() => setRadicadosExpanded(!radicadosExpanded)}
          >
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Inbox className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">Mis radicados asignados</p>
                <p className="text-xs text-slate-500">{radicadosAsignados.length} radicado{radicadosAsignados.length !== 1 ? 's' : ''} activo{radicadosAsignados.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-600 text-white text-sm px-3">{radicadosAsignados.length}</Badge>
              {radicadosExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </div>
          </div>
          {radicadosExpanded && (
            <div className="border-t border-blue-200 divide-y divide-blue-100">
              {radicadosAsignados.map((pet) => {
                const estado = estadoConfig[pet.estado] || estadoConfig['radicado'];
                return (
                  <div
                    key={pet.id}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-blue-50 transition-colors"
                    onClick={() => navigate(`/dashboard/peticiones/${pet.id}`)}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full ${estado.color} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-slate-900">{pet.radicado || `Trámite ${pet.id?.slice(0,8)}`}</span>
                        <Badge className={`${estado.badgeColor} text-xs`}>{estado.label}</Badge>
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {pet.tipo_tramite || 'Petición'}{pet.municipio ? ` · ${pet.municipio}` : ''}{pet.nombre_completo ? ` · ${pet.nombre_completo}` : ''}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="space-y-6" data-testid="dashboard-home">
      {/* ---- ENCABEZADO UNIVERSAL ---- */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 font-outfit" data-testid="welcome-message">
            {getSaludo()}, {user?.full_name?.split(' ')[0]}
          </h2>
          {resumen && (
            <p className={`mt-1 text-sm font-medium flex items-center gap-1.5 ${resumen.color}`}>
              <resumen.icon className="w-4 h-4" />
              {resumen.text}
            </p>
          )}
        </div>
        {/* CTA principal según rol */}
        {esUsuarioCiudadano && (
          <Button
            onClick={() => navigate('/dashboard/peticiones/nueva')}
            className="bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm"
            data-testid="create-petition-button"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nueva Petición
          </Button>
        )}
        {esAprobador && (stats?.mutaciones_pendientes || 0) > 0 && (
          <Button
            onClick={() => navigate('/dashboard/pendientes')}
            className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
          >
            <Eye className="w-4 h-4 mr-2" />
            Revisar Pendientes
          </Button>
        )}
      </div>

      {/* ===== VISTA CIUDADANO ===== */}
      {esUsuarioCiudadano && (
        <div className="space-y-5">
          {/* Resumen compacto */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-slate-200 cursor-pointer hover:border-blue-400 transition-colors" onClick={() => navigate('/dashboard/peticiones')}>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-slate-900">{stats?.mis_radicados || 0}</p>
                <p className="text-xs text-slate-500 mt-1">Total radicados</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 cursor-pointer hover:border-amber-400 transition-colors" onClick={() => navigate('/dashboard/peticiones')}>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-amber-600">{(stats?.asignado || 0) + (stats?.revision || 0) + (stats?.radicado || 0)}</p>
                <p className="text-xs text-slate-500 mt-1">En proceso</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 cursor-pointer hover:border-emerald-400 transition-colors" onClick={() => navigate('/dashboard/peticiones')}>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-emerald-600">{stats?.finalizado || 0}</p>
                <p className="text-xs text-slate-500 mt-1">Finalizados</p>
              </CardContent>
            </Card>
          </div>

          {/* Timeline de peticiones recientes */}
          {misPeticiones && misPeticiones.length > 0 ? (
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-slate-800">
                  Mis trámites recientes
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1">
                  {misPeticiones.slice(0, 5).map((pet, idx) => {
                    const estado = estadoConfig[pet.estado] || estadoConfig['radicado'];
                    const esDevuelto = pet.estado === 'devuelto';
                    return (
                      <div
                        key={pet.id || idx}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${esDevuelto ? 'bg-red-50 hover:bg-red-100 border border-red-200' : 'bg-slate-50 hover:bg-slate-100'}`}
                        onClick={() => navigate(`/dashboard/peticiones/${pet.id}`)}
                      >
                        {/* Indicador de estado */}
                        <div className="flex flex-col items-center gap-0.5">
                          <div className={`w-3 h-3 rounded-full ${estado.color}`} />
                          {idx < misPeticiones.slice(0, 5).length - 1 && (
                            <div className="w-px h-4 bg-slate-200" />
                          )}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-slate-900">{pet.radicado || `Trámite ${pet.id?.slice(0,8)}`}</span>
                            <Badge className={`${estado.badgeColor} text-xs`}>{estado.label}</Badge>
                          </div>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {pet.tipo_tramite || 'Petición'} {pet.municipio ? `· ${pet.municipio}` : ''}
                          </p>
                        </div>
                        {/* Acción o tiempo */}
                        <div className="text-right shrink-0">
                          {esDevuelto ? (
                            <span className="text-xs font-medium text-red-600 flex items-center gap-1">
                              <Send className="w-3 h-3" /> Subsanar
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">{formatTimeAgo(pet.updated_at || pet.created_at)}</span>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                      </div>
                    );
                  })}
                </div>
                {misPeticiones.length > 5 && (
                  <Button
                    variant="ghost"
                    className="w-full mt-3 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 text-sm"
                    onClick={() => navigate('/dashboard/peticiones')}
                  >
                    Ver todos mis trámites
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed border-slate-300 bg-slate-50">
              <CardContent className="p-8 text-center">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">Aún no tienes trámites</p>
                <p className="text-sm text-slate-400 mt-1">Crea tu primera petición para comenzar</p>
                <Button
                  onClick={() => navigate('/dashboard/peticiones/nueva')}
                  className="mt-4 bg-emerald-700 hover:bg-emerald-800 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Petición
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Devueltos destacados */}
          {(stats?.devuelto || 0) > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="bg-red-500 p-2 rounded-lg shrink-0">
                  <AlertCircle className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-red-800 text-sm">Acción requerida</p>
                  <p className="text-xs text-red-600">Tienes {stats.devuelto} trámite{stats.devuelto > 1 ? 's' : ''} devuelto{stats.devuelto > 1 ? 's' : ''}. Revisa las observaciones y vuelve a enviar.</p>
                </div>
                <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-100 shrink-0" onClick={() => navigate('/dashboard/peticiones')}>
                  Revisar
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ===== VISTA GESTOR ===== */}
      {esGestor && !esAprobador && (
        <div className="space-y-5">
          {/* Radicados asignados */}
          {renderRadicadosAsignados()}
          {/* Barra de carga de trabajo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Predios creados', value: stats?.predios_creados || 0, icon: FileText, iconClass: 'text-blue-500', pulseClass: 'bg-blue-500', hoverBorder: 'hover:border-blue-400' },
              { label: 'Predios apoyo', value: stats?.predios_asignados || 0, icon: MapPin, iconClass: 'text-purple-500', pulseClass: 'bg-purple-500', hoverBorder: 'hover:border-purple-400' },
              { label: 'Modificaciones', value: stats?.modificaciones_asignadas || 0, icon: Edit, iconClass: 'text-amber-500', pulseClass: 'bg-amber-500', hoverBorder: 'hover:border-amber-400' },
              { label: 'Cartografía', value: stats?.tareas_urgentes?.mutaciones_cartografia?.length || 0, icon: Layers, iconClass: 'text-pink-500', pulseClass: 'bg-pink-500', hoverBorder: 'hover:border-pink-400' },
            ].map((item, i) => {
              const ItemIcon = item.icon;
              return (
                <Card
                  key={i}
                  className={`border-slate-200 cursor-pointer hover:shadow-md transition-all ${item.value > 0 ? item.hoverBorder : ''}`}
                  onClick={() => navigate('/dashboard/pendientes')}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <ItemIcon className={`w-4 h-4 ${item.iconClass}`} />
                      {item.value > 0 && <span className={`w-2 h-2 rounded-full ${item.pulseClass} animate-pulse`} />}
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{item.value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.label}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Lista unificada de tareas pendientes */}
          {(() => {
            const allTareas = [
              ...(stats?.tareas_urgentes?.peticiones_asignadas || []).map(t => ({ ...t, _tipo: 'peticion' })),
              ...(stats?.tareas_urgentes?.predios_apoyo || []).map(t => ({ ...t, _tipo: 'predio' })),
              ...(stats?.tareas_urgentes?.mutaciones_cartografia || []).map(t => ({ ...t, _tipo: 'mutacion' })),
            ];
            if (allTareas.length === 0) return (
              <Card className="border-dashed border-slate-300 bg-slate-50">
                <CardContent className="p-6 text-center">
                  <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-slate-600 font-medium">Sin tareas pendientes</p>
                  <p className="text-xs text-slate-400 mt-1">Estás al día con tu trabajo</p>
                </CardContent>
              </Card>
            );

            const tipoConfig = {
              'peticion': { icon: FileText, color: 'bg-emerald-500', label: 'Petición' },
              'predio': { icon: Building, color: 'bg-purple-500', label: 'Predio' },
              'mutacion': { icon: Layers, color: 'bg-pink-500', label: 'Mutación' },
            };

            return (
              <Card className="border-slate-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                      <Timer className="w-4 h-4 text-amber-500" />
                      Próximas tareas
                    </CardTitle>
                    <Badge variant="outline" className="text-slate-500">{allTareas.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {allTareas.slice(0, 8).map((tarea, idx) => {
                      const cfg = tipoConfig[tarea._tipo];
                      const TipoIcon = cfg.icon;
                      return (
                        <div
                          key={tarea.id || idx}
                          className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                          onClick={() => navigate('/dashboard/pendientes')}
                        >
                          <div className={`${cfg.color} p-1.5 rounded shrink-0`}>
                            <TipoIcon className="w-3.5 h-3.5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {tarea.radicado || tarea.codigo_predial_nacional || tarea.tipo || 'Tarea'}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {tarea.tipo_tramite || tarea.direccion || tarea.subtipo || cfg.label}
                              {tarea.municipio || tarea.municipio_nombre ? ` · ${tarea.municipio || tarea.municipio_nombre}` : ''}
                            </p>
                          </div>
                          <span className="text-xs text-slate-400 shrink-0">{formatTimeAgo(tarea.created_at || tarea.fecha_creacion)}</span>
                          <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full mt-3 text-emerald-700 hover:bg-emerald-50 text-sm"
                    onClick={() => navigate('/dashboard/pendientes')}
                  >
                    Ver todas mis tareas <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            );
          })()}

          {/* Mis radicados - compacto */}
          {(stats?.mis_radicados || 0) > 0 && (
            <Card className="border-slate-200 cursor-pointer hover:shadow-md transition-all" onClick={() => navigate('/dashboard/peticiones')}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="bg-emerald-100 p-2 rounded-lg">
                  <FileCheck className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-700">Mis Radicados</p>
                  <p className="text-xs text-slate-500">{stats.mis_radicados} trámites creados por mí</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ===== VISTA ATENCIÓN AL USUARIO ===== */}
      {esAtencion && !esAprobador && (
        <div className="space-y-5">
          {/* Radicados asignados */}
          {renderRadicadosAsignados()}
          {/* Funnel de trámites */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                Estado de trámites del sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {(() => {
                const total = (stats?.radicado || 0) + (stats?.asignado || 0) + (stats?.revision || 0) + (stats?.finalizado || 0);
                const steps = [
                  { label: 'Sin asignar', value: stats?.radicado || 0, color: 'bg-red-500', textColor: 'text-red-700', path: '/dashboard/todas-peticiones?estado=radicado' },
                  { label: 'Asignados', value: stats?.asignado || 0, color: 'bg-amber-500', textColor: 'text-amber-700', path: '/dashboard/todas-peticiones?estado=asignado' },
                  { label: 'En revisión', value: stats?.revision || 0, color: 'bg-purple-500', textColor: 'text-purple-700', path: '/dashboard/todas-peticiones?estado=revision' },
                  { label: 'Finalizados', value: stats?.finalizado || 0, color: 'bg-emerald-500', textColor: 'text-emerald-700', path: '/dashboard/todas-peticiones?estado=finalizado' },
                ];
                return (
                  <div className="space-y-3">
                    {/* Barra de progreso stacked */}
                    <div className="flex h-4 rounded-full overflow-hidden bg-slate-100">
                      {steps.map((step, i) => {
                        const pct = total > 0 ? (step.value / total) * 100 : 0;
                        if (pct === 0) return null;
                        return (
                          <div
                            key={i}
                            className={`${step.color} transition-all cursor-pointer hover:opacity-80`}
                            style={{ width: `${pct}%` }}
                            title={`${step.label}: ${step.value}`}
                            onClick={() => navigate(step.path)}
                          />
                        );
                      })}
                    </div>
                    {/* Detalle */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {steps.map((step, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors text-center"
                          onClick={() => navigate(step.path)}
                        >
                          <p className={`text-xl font-bold ${step.textColor}`}>{step.value}</p>
                          <p className="text-xs text-slate-500">{step.label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-xs text-slate-400">Total activos: {stats?.total || 0}</span>
                      <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:bg-blue-50" onClick={() => navigate('/dashboard/todas-peticiones')}>
                        Ver todos <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Alerta de nuevos sin asignar */}
          {(stats?.radicado || 0) > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="bg-red-500 p-2 rounded-lg shrink-0">
                  <AlertCircle className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-red-800 text-sm">{stats.radicado} trámite{stats.radicado > 1 ? 's' : ''} sin asignar</p>
                  <p className="text-xs text-red-600">Requieren asignación de gestor para avanzar</p>
                </div>
                <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-100 shrink-0" onClick={() => navigate('/dashboard/todas-peticiones?estado=radicado')}>
                  Asignar
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Mis radicados compacto */}
          {(stats?.mis_radicados || 0) > 0 && (
            <Card className="border-slate-200 cursor-pointer hover:shadow-md transition-all" onClick={() => navigate('/dashboard/peticiones')}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="bg-emerald-100 p-2 rounded-lg">
                  <UserCheck className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-700">Radicados por mí</p>
                  <p className="text-xs text-slate-500">{stats.mis_radicados} trámites que creé</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ===== VISTA COORDINADOR / ADMIN / GESTOR CON PERMISO ===== */}
      {esAprobador && (
        <div className="space-y-5">
          {/* Radicados asignados */}
          {renderRadicadosAsignados()}
          {/* Pendientes por tipo de mutación - tarjetas */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-600" />
                Pendientes de aprobación
                {(stats?.mutaciones_pendientes || 0) > 0 && (
                  <Badge className="bg-purple-100 text-purple-700 text-xs">{stats?.mutaciones_pendientes} pendientes</Badge>
                )}
              </h3>
              {(stats?.mutaciones_pendientes || 0) > 0 && (
                <Button variant="ghost" size="sm" className="text-xs text-purple-600 hover:bg-purple-50" onClick={() => navigate('/dashboard/pendientes')}>
                  Ver todos <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {[
                { label: 'M1', desc: 'Transferencia de dominio', tipo: 'M1', value: stats?.mutaciones_por_tipo?.M1 || 0, color: 'border-blue-300 bg-blue-50', iconColor: 'text-blue-600 bg-blue-100' },
                { label: 'M2', desc: 'Desenglobe', tipo: 'M2', value: stats?.mutaciones_por_tipo?.M2 || 0, color: 'border-emerald-300 bg-emerald-50', iconColor: 'text-emerald-600 bg-emerald-100' },
                { label: 'M3', desc: 'Cambio de destino', tipo: 'M3', value: stats?.mutaciones_por_tipo?.M3 || 0, color: 'border-amber-300 bg-amber-50', iconColor: 'text-amber-600 bg-amber-100' },
                { label: 'M4', desc: 'Revisión de avalúo', tipo: 'M4', value: stats?.mutaciones_por_tipo?.M4 || 0, color: 'border-purple-300 bg-purple-50', iconColor: 'text-purple-600 bg-purple-100' },
                { label: 'M5', desc: 'Inscripción / Cancelación', tipo: 'M5', value: stats?.mutaciones_por_tipo?.M5 || 0, color: 'border-indigo-300 bg-indigo-50', iconColor: 'text-indigo-600 bg-indigo-100' },
                { label: 'Rectificación', desc: 'Rectificación de área', tipo: 'RECTIFICACION_AREA', value: stats?.mutaciones_por_tipo?.RECTIFICACION_AREA || 0, color: 'border-orange-300 bg-orange-50', iconColor: 'text-orange-600 bg-orange-100' },
                { label: 'Complementación', desc: 'Complementación catastral', tipo: 'COMP', value: stats?.mutaciones_por_tipo?.COMP || 0, color: 'border-teal-300 bg-teal-50', iconColor: 'text-teal-600 bg-teal-100' },
              ].filter(item => item.value > 0).map((item, i) => {
                return (
                  <Card
                    key={i}
                    className={`cursor-pointer transition-all hover:shadow-md border ${item.color}`}
                    onClick={() => navigate(`/dashboard/pendientes?tipo=${item.tipo}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className={`p-1.5 rounded-lg ${item.iconColor}`}>
                          <Layers className="w-4 h-4" />
                        </div>
                        <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                      </div>
                      <p className="text-2xl font-bold text-slate-900">{item.value}</p>
                      <p className="text-sm font-medium text-slate-700 mt-1">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.desc}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {(stats?.mutaciones_pendientes || 0) === 0 && (
              <div className="flex items-center gap-2 p-4 rounded-lg bg-slate-50 border border-slate-200 mt-3">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                <p className="text-sm text-slate-600">No hay mutaciones pendientes de aprobación</p>
              </div>
            )}
          </div>

          {/* Fila inferior: Trámites del sistema + Actividad del mes */}
          {veRadicadosTotales && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Trámites del sistema - funnel compacto */}
              <Card className="border-slate-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      Trámites del sistema
                    </CardTitle>
                    <span className="text-xs text-slate-400">{stats?.total || 0} total</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {[
                      { label: 'Sin asignar', value: stats?.radicado || 0, color: 'bg-red-500', barBg: 'bg-red-100', path: '/dashboard/todas-peticiones?estado=radicado' },
                      { label: 'Asignados', value: stats?.asignado || 0, color: 'bg-amber-500', barBg: 'bg-amber-100', path: '/dashboard/todas-peticiones?estado=asignado' },
                      { label: 'En revisión', value: stats?.revision || 0, color: 'bg-purple-500', barBg: 'bg-purple-100', path: '/dashboard/todas-peticiones?estado=revision' },
                      { label: 'Finalizados', value: stats?.finalizado || 0, color: 'bg-emerald-500', barBg: 'bg-emerald-100', path: '/dashboard/todas-peticiones?estado=finalizado' },
                    ].map((item, i) => {
                      const maxVal = Math.max(stats?.radicado || 0, stats?.asignado || 0, stats?.revision || 0, stats?.finalizado || 0, 1);
                      const pct = (item.value / maxVal) * 100;
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 rounded p-1 -mx-1 transition-colors"
                          onClick={() => navigate(item.path)}
                        >
                          <span className="text-xs text-slate-500 w-20 shrink-0">{item.label}</span>
                          <div className={`flex-1 h-5 ${item.barBg} rounded-full overflow-hidden`}>
                            <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${Math.max(pct, 2)}%` }} />
                          </div>
                          <span className="text-sm font-semibold text-slate-700 w-8 text-right">{item.value}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Actividad del mes */}
              <Card className="border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    Actividad del mes
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
                      <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                      <p className="text-3xl font-bold text-emerald-700">{stats?.aprobados_mes || 0}</p>
                      <p className="text-xs text-emerald-600 mt-1">Aprobados</p>
                    </div>
                    <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-center">
                      <XCircle className="w-6 h-6 text-red-400 mx-auto mb-1" />
                      <p className="text-3xl font-bold text-red-600">{stats?.rechazados_mes || 0}</p>
                      <p className="text-xs text-red-500 mt-1">Rechazados</p>
                    </div>
                  </div>
                  {(esAdmin || esCoordinador) && (
                    <Button
                      variant="ghost"
                      className="w-full mt-4 text-slate-600 hover:bg-slate-50 text-sm"
                      onClick={() => navigate('/dashboard/estadisticas')}
                    >
                      <BarChart3 className="w-4 h-4 mr-1" /> Ver estadísticas completas
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
