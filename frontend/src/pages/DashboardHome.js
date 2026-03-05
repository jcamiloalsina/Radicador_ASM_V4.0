import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { 
  FileText, Clock, CheckCircle, XCircle, Plus, FileCheck, RotateCcw,
  Building, Edit, Users, ArrowRight, MapPin, Loader2, RefreshCw,
  AlertCircle, ChevronRight, Calendar, User, Layers
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    
    // Listener para actualizar cuando se aprueba/rechaza un pendiente
    const handlePendientesUpdated = () => {
      fetchStats();
    };
    
    window.addEventListener('pendientesUpdated', handlePendientesUpdated);
    return () => window.removeEventListener('pendientesUpdated', handlePendientesUpdated);
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/petitions/stats/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data);
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

  // Determinar el tipo de vista según el rol
  const esUsuarioCiudadano = user?.role === 'usuario';
  const esGestor = user?.role === 'gestor' || user?.role === 'gestor_auxiliar';
  const esAtencion = user?.role === 'atencion_usuario';
  const esCoordinador = user?.role === 'coordinador';
  const esAdmin = user?.role === 'administrador';
  const esAprobador = stats?.es_aprobador || esCoordinador || esAdmin;
  const veRadicadosTotales = esAtencion || esCoordinador || esAdmin;

  // Componente de tarjeta de estadística
  const StatCard = ({ title, value, icon: Icon, color, onClick, subtitle, badge }) => (
    <Card 
      className={`border-slate-200 hover:shadow-lg transition-all cursor-pointer hover:border-emerald-500 ${onClick ? '' : 'cursor-default'}`}
      onClick={onClick}
      data-testid={`stat-${title.toLowerCase().replace(/\s/g, '-')}`}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
        <div className={`${color} p-2 rounded-md`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <span className="text-3xl font-bold text-slate-900">{value}</span>
          {badge && (
            <Badge className={badge.color}>{badge.text}</Badge>
          )}
        </div>
        {subtitle && <p className="text-xs text-slate-500 mt-2">{subtitle}</p>}
      </CardContent>
    </Card>
  );

  // Componente de lista de tareas urgentes
  const TareasList = ({ titulo, icon: Icon, color, tareas, tipo, emptyText }) => {
    if (!tareas || tareas.length === 0) return null;
    
    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now - date;
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffHours < 1) return 'Hace menos de 1 hora';
      if (diffHours < 24) return `Hace ${diffHours} horas`;
      if (diffDays === 1) return 'Ayer';
      if (diffDays < 7) return `Hace ${diffDays} días`;
      return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
    };

    const getItemContent = (tarea) => {
      switch(tipo) {
        case 'peticion':
          return {
            titulo: tarea.radicado || `Trámite ${tarea.id?.slice(0,8)}`,
            subtitulo: tarea.tipo_tramite || 'Petición',
            ubicacion: tarea.municipio,
            fecha: tarea.created_at,
            estado: tarea.estado
          };
        case 'predio_apoyo':
          return {
            titulo: tarea.codigo_predial_nacional || 'Sin código',
            subtitulo: tarea.direccion || 'Predio asignado',
            ubicacion: tarea.municipio,
            fecha: tarea.created_at,
            estado: tarea.estado_flujo
          };
        case 'mutacion_cartografia':
          return {
            titulo: tarea.radicado || `${tarea.tipo} - ${tarea.subtipo}`,
            subtitulo: tarea.subtipo === 'desengloble' ? 'Desenglobe' : 'Englobe',
            ubicacion: tarea.municipio_nombre,
            fecha: tarea.fecha_creacion,
            estado: 'cartografia'
          };
        case 'modificacion_aprobar':
          return {
            titulo: tarea.codigo_predial || 'Modificación',
            subtitulo: `${tarea.tipo_cambio} - ${tarea.solicitante_nombre || 'Sin nombre'}`,
            ubicacion: tarea.municipio,
            fecha: tarea.created_at,
            estado: 'pendiente'
          };
        case 'mutacion_aprobar':
          return {
            titulo: tarea.radicado || `${tarea.tipo}`,
            subtitulo: `${tarea.subtipo === 'desengloble' ? 'Desenglobe' : 'Englobe'} - ${tarea.creado_por_nombre || ''}`,
            ubicacion: tarea.municipio_nombre,
            fecha: tarea.fecha_creacion,
            estado: 'aprobacion'
          };
        case 'predio_aprobar':
          return {
            titulo: tarea.codigo_predial_nacional || 'Predio nuevo',
            subtitulo: `Creado por ${tarea.gestor_creador_nombre || 'Gestor'}`,
            ubicacion: tarea.municipio,
            fecha: tarea.created_at,
            estado: 'revision'
          };
        default:
          return { titulo: 'Tarea', subtitulo: '', ubicacion: '', fecha: '', estado: '' };
      }
    };

    const getEstadoBadge = (estado) => {
      const estados = {
        'asignado': { color: 'bg-amber-100 text-amber-800', text: 'Asignado' },
        'en_proceso': { color: 'bg-blue-100 text-blue-800', text: 'En proceso' },
        'creado': { color: 'bg-slate-100 text-slate-800', text: 'Creado' },
        'digitalizacion': { color: 'bg-cyan-100 text-cyan-800', text: 'Digitalizando' },
        'devuelto': { color: 'bg-red-100 text-red-800', text: 'Devuelto' },
        'revision': { color: 'bg-purple-100 text-purple-800', text: 'En revisión' },
        'cartografia': { color: 'bg-purple-100 text-purple-800', text: 'Cartografía' },
        'pendiente': { color: 'bg-amber-100 text-amber-800', text: 'Pendiente' },
        'aprobacion': { color: 'bg-orange-100 text-orange-800', text: 'Por aprobar' }
      };
      return estados[estado] || { color: 'bg-slate-100 text-slate-800', text: estado };
    };
    
    return (
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <div className={`${color} p-1.5 rounded-md`}>
              <Icon className="w-4 h-4 text-white" />
            </div>
            {titulo}
            <Badge variant="outline" className="ml-auto">{tareas.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            {tareas.map((tarea, idx) => {
              const item = getItemContent(tarea);
              const badge = getEstadoBadge(item.estado);
              return (
                <div 
                  key={tarea.id || idx}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer group"
                  onClick={() => navigate('/dashboard/pendientes')}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 text-sm truncate">
                        {item.titulo}
                      </span>
                      <Badge className={`${badge.color} text-xs`}>{badge.text}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span className="truncate">{item.subtitulo}</span>
                      {item.ubicacion && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {item.ubicacion}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {formatDate(item.fecha)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
          <Button 
            variant="ghost" 
            className="w-full mt-3 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
            onClick={() => navigate('/dashboard/pendientes')}
          >
            Ver todas las tareas
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    );
  };

  // Función para obtener el saludo según la hora
  const getSaludo = () => {
    const hora = new Date().getHours();
    if (hora < 12) return '¡Buenos días';
    if (hora < 18) return '¡Buenas tardes';
    return '¡Buenas noches';
  };

  // Función para obtener la descripción del rol
  const getRoleDescription = () => {
    if (esUsuarioCiudadano) return 'Gestiona tus radicados y haz seguimiento al estado de tus trámites';
    if (esGestor) return 'Resumen de tu actividad - Predios y trámites asignados';
    if (esAtencion) return 'Centro de Atención - Gestión de trámites radicados';
    if (esCoordinador) return 'Panel de Coordinación - Aprobación y supervisión';
    if (esAdmin) return 'Panel Administrativo - Control total del sistema';
    return 'Panel de control - Asomunicipios';
  };

  return (
    <div className="space-y-8" data-testid="dashboard-home">
      {/* Welcome Section */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 font-outfit" data-testid="welcome-message">
          {getSaludo()}, {user?.full_name}!
        </h2>
        <p className="text-slate-600 mt-2">{getRoleDescription()}</p>
      </div>

      {/* ===== VISTA PARA USUARIO CIUDADANO ===== */}
      {esUsuarioCiudadano && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <StatCard
              title="Mis Radicados"
              value={stats?.mis_radicados || 0}
              icon={FileText}
              color="bg-emerald-600"
              onClick={() => navigate('/dashboard/peticiones')}
              subtitle="Click para ver detalles"
            />
            <StatCard
              title="En Proceso"
              value={(stats?.asignado || 0) + (stats?.revision || 0)}
              icon={Clock}
              color="bg-blue-500"
              onClick={() => navigate('/dashboard/peticiones')}
              subtitle="Trámites activos"
            />
          </div>
        </div>
      )}

      {/* ===== VISTA PARA GESTOR ===== */}
      {esGestor && !esAprobador && (
        <div className="space-y-6">
          {/* Sección: Mis Asignaciones - Estadísticas */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Building className="w-5 h-5 text-emerald-600" />
              Resumen de Asignaciones
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                title="Predios Creados"
                value={stats?.predios_creados || 0}
                icon={FileText}
                color="bg-blue-600"
                onClick={() => navigate('/dashboard/pendientes')}
                subtitle="Predios nuevos que creé"
              />
              <StatCard
                title="Predios Apoyo"
                value={stats?.predios_asignados || 0}
                icon={MapPin}
                color="bg-purple-600"
                onClick={() => navigate('/dashboard/pendientes')}
                subtitle="Asignados para digitalizar"
              />
              <StatCard
                title="Modificaciones"
                value={stats?.modificaciones_asignadas || 0}
                icon={Edit}
                color="bg-amber-600"
                onClick={() => navigate('/dashboard/pendientes')}
                subtitle="Cambios por completar"
              />
              <StatCard
                title="Mutaciones"
                value={stats?.tareas_urgentes?.mutaciones_cartografia?.length || 0}
                icon={Layers}
                color="bg-pink-600"
                onClick={() => navigate('/dashboard/pendientes')}
                subtitle="Cartografía pendiente"
              />
            </div>
          </div>

          {/* Sección: Tareas Urgentes */}
          {(stats?.tareas_urgentes?.peticiones_asignadas?.length > 0 ||
            stats?.tareas_urgentes?.predios_apoyo?.length > 0 ||
            stats?.tareas_urgentes?.mutaciones_cartografia?.length > 0) && (
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                Tareas Pendientes
                <Badge className="bg-red-100 text-red-800 ml-2">
                  {(stats?.tareas_urgentes?.peticiones_asignadas?.length || 0) +
                   (stats?.tareas_urgentes?.predios_apoyo?.length || 0) +
                   (stats?.tareas_urgentes?.mutaciones_cartografia?.length || 0)} pendientes
                </Badge>
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                <TareasList
                  titulo="Peticiones Asignadas"
                  icon={FileText}
                  color="bg-emerald-600"
                  tareas={stats?.tareas_urgentes?.peticiones_asignadas}
                  tipo="peticion"
                />
                <TareasList
                  titulo="Predios como Apoyo"
                  icon={MapPin}
                  color="bg-purple-600"
                  tareas={stats?.tareas_urgentes?.predios_apoyo}
                  tipo="predio_apoyo"
                />
                <TareasList
                  titulo="Mutaciones - Cartografía"
                  icon={Layers}
                  color="bg-pink-600"
                  tareas={stats?.tareas_urgentes?.mutaciones_cartografia}
                  tipo="mutacion_cartografia"
                />
              </div>
            </div>
          )}

          {/* Sección: Mis Radicados */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              Mis Radicados
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md">
              <StatCard
                title="Radicados Activos"
                value={stats?.mis_radicados || 0}
                icon={FileCheck}
                color="bg-emerald-600"
                onClick={() => navigate('/dashboard/peticiones')}
                subtitle="Trámites que creé"
              />
            </div>
          </div>
        </div>
      )}

      {/* ===== VISTA PARA ATENCIÓN AL USUARIO ===== */}
      {esAtencion && !esAprobador && (
        <div className="space-y-6">
          {/* Sección: Trámites Radicados del Sistema */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Trámites Radicados (Total del Sistema)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                title="Nuevos"
                value={stats?.radicado || 0}
                icon={FileCheck}
                color="bg-red-500"
                onClick={() => navigate('/dashboard/todas-peticiones?estado=radicado')}
                subtitle="Sin asignar"
                badge={stats?.radicado > 0 ? { text: 'Pendiente', color: 'bg-red-100 text-red-800' } : null}
              />
              <StatCard
                title="Asignados"
                value={stats?.asignado || 0}
                icon={Clock}
                color="bg-amber-500"
                onClick={() => navigate('/dashboard/todas-peticiones?estado=asignado')}
                subtitle="En proceso"
              />
              <StatCard
                title="En Revisión"
                value={stats?.revision || 0}
                icon={FileCheck}
                color="bg-purple-500"
                onClick={() => navigate('/dashboard/todas-peticiones?estado=revision')}
                subtitle="Por aprobar"
              />
              <StatCard
                title="Finalizados"
                value={stats?.finalizado || 0}
                icon={CheckCircle}
                color="bg-emerald-500"
                onClick={() => navigate('/dashboard/todas-peticiones?estado=finalizado')}
                subtitle="Completados"
              />
            </div>
          </div>

          {/* Sección: Mis Radicados */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              Mis Radicados (los que yo creé)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md">
              <StatCard
                title="Radicados Activos"
                value={stats?.mis_radicados || 0}
                icon={FileCheck}
                color="bg-emerald-600"
                onClick={() => navigate('/dashboard/peticiones')}
                subtitle="Trámites que creé"
              />
            </div>
          </div>
        </div>
      )}

      {/* ===== VISTA PARA COORDINADOR / APROBADOR ===== */}
      {esAprobador && (
        <div className="space-y-6">
          {/* Sección: Pendientes por Aprobar - Estadísticas */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-600" />
              Pendientes por Aprobar
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                title="Predios Nuevos"
                value={stats?.predios_revision || 0}
                icon={Building}
                color="bg-purple-600"
                onClick={() => navigate('/dashboard/pendientes')}
                subtitle="En revisión"
                badge={stats?.predios_revision > 0 ? { text: 'Urgente', color: 'bg-purple-100 text-purple-800' } : null}
              />
              <StatCard
                title="Modificaciones"
                value={stats?.modificaciones_pendientes || 0}
                icon={Edit}
                color="bg-amber-600"
                onClick={() => navigate('/dashboard/pendientes')}
                subtitle="Cambios pendientes"
              />
              <StatCard
                title="Mutaciones"
                value={stats?.mutaciones_pendientes || 0}
                icon={Layers}
                color="bg-pink-600"
                onClick={() => navigate('/dashboard/pendientes')}
                subtitle="M2 por aprobar"
                badge={stats?.mutaciones_pendientes > 0 ? { text: 'Nuevo', color: 'bg-pink-100 text-pink-800' } : null}
              />
              <StatCard
                title="Reapariciones"
                value={stats?.reapariciones_pendientes || 0}
                icon={RefreshCw}
                color="bg-red-500"
                onClick={() => navigate('/dashboard/pendientes')}
                subtitle="Por revisar"
              />
            </div>
          </div>

          {/* Sección: Tareas Urgentes para Aprobar */}
          {(stats?.tareas_urgentes?.modificaciones_aprobar?.length > 0 ||
            stats?.tareas_urgentes?.mutaciones_aprobar?.length > 0 ||
            stats?.tareas_urgentes?.predios_aprobar?.length > 0) && (
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                Requieren tu Atención
                <Badge className="bg-red-100 text-red-800 ml-2">
                  {(stats?.tareas_urgentes?.modificaciones_aprobar?.length || 0) +
                   (stats?.tareas_urgentes?.mutaciones_aprobar?.length || 0) +
                   (stats?.tareas_urgentes?.predios_aprobar?.length || 0)} items
                </Badge>
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <TareasList
                  titulo="Modificaciones"
                  icon={Edit}
                  color="bg-amber-600"
                  tareas={stats?.tareas_urgentes?.modificaciones_aprobar}
                  tipo="modificacion_aprobar"
                />
                <TareasList
                  titulo="Mutaciones (M2)"
                  icon={Layers}
                  color="bg-pink-600"
                  tareas={stats?.tareas_urgentes?.mutaciones_aprobar}
                  tipo="mutacion_aprobar"
                />
                <TareasList
                  titulo="Predios Nuevos"
                  icon={Building}
                  color="bg-purple-600"
                  tareas={stats?.tareas_urgentes?.predios_aprobar}
                  tipo="predio_aprobar"
                />
              </div>
            </div>
          )}

          {/* Sección: Trámites Radicados del Sistema (solo coordinador/admin) */}
          {veRadicadosTotales && (
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Trámites Radicados (Total del Sistema)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  title="Nuevos"
                  value={stats?.radicado || 0}
                  icon={FileCheck}
                  color="bg-red-500"
                  onClick={() => navigate('/dashboard/todas-peticiones?estado=radicado')}
                  subtitle="Sin asignar"
                />
                <StatCard
                  title="Asignados"
                  value={stats?.asignado || 0}
                  icon={Clock}
                  color="bg-amber-500"
                  onClick={() => navigate('/dashboard/todas-peticiones?estado=asignado')}
                  subtitle="En proceso"
                />
                <StatCard
                  title="En Revisión"
                  value={stats?.revision || 0}
                  icon={FileCheck}
                  color="bg-purple-500"
                  onClick={() => navigate('/dashboard/todas-peticiones?estado=revision')}
                  subtitle="Por aprobar"
                />
                <StatCard
                  title="Total Activos"
                  value={stats?.total || 0}
                  icon={FileText}
                  color="bg-blue-600"
                  onClick={() => navigate('/dashboard/todas-peticiones')}
                  subtitle="Todos los trámites"
                />
              </div>
            </div>
          )}

          {/* Sección: Estadísticas del Mes */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              Estadísticas del Mes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg">
              <StatCard
                title="Aprobados"
                value={stats?.aprobados_mes || 0}
                icon={CheckCircle}
                color="bg-emerald-600"
                subtitle="Este mes"
              />
              <StatCard
                title="Rechazados"
                value={stats?.rechazados_mes || 0}
                icon={XCircle}
                color="bg-red-500"
                subtitle="Este mes"
              />
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-slate-900 font-outfit">Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {esUsuarioCiudadano && (
            <Button
              onClick={() => navigate('/dashboard/peticiones/nueva')}
              className="bg-emerald-700 hover:bg-emerald-800 text-white"
              data-testid="create-petition-button"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva Petición
            </Button>
          )}
          
          <Button
            onClick={() => navigate('/dashboard/peticiones')}
            variant="outline"
            data-testid="view-petitions-button"
          >
            <FileText className="w-4 h-4 mr-2" />
            {esUsuarioCiudadano ? 'Ver Mis Radicados' : 'Mis Peticiones'}
          </Button>
          
          {esGestor && (
            <Button
              onClick={() => navigate('/dashboard/pendientes')}
              variant="outline"
              className="border-purple-300 text-purple-700 hover:bg-purple-50"
            >
              <Building className="w-4 h-4 mr-2" />
              Mis Asignaciones
            </Button>
          )}
          
          {esAprobador && (
            <Button
              onClick={() => navigate('/dashboard/pendientes')}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              Ir a Pendientes
            </Button>
          )}
          
          {veRadicadosTotales && (
            <Button
              onClick={() => navigate('/dashboard/todas-peticiones')}
              variant="outline"
            >
              <FileText className="w-4 h-4 mr-2" />
              Ver Todos los Radicados
            </Button>
          )}
          
          {(esCoordinador || esAdmin) && (
            <Button
              onClick={() => navigate('/dashboard/usuarios')}
              variant="outline"
            >
              <Users className="w-4 h-4 mr-2" />
              Gestionar Usuarios
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Info Card con descripción según rol */}
      <Card className="border-emerald-200 bg-emerald-50">
        <CardContent className="pt-6">
          <p className="text-sm text-emerald-900">
            {esUsuarioCiudadano
              ? 'Puedes crear nuevas peticiones y hacer seguimiento al estado de tus trámites. Si tu trámite es rechazado, podrás cargar documentos para subsanar.'
              : esGestor
              ? 'Gestiona los predios que creaste y los que te asignaron. Completa la digitalización y envía a revisión cuando estén listos.'
              : esAtencion
              ? 'Revisa los trámites radicados, asigna gestores y actualiza el estado de las peticiones. Todos los trámites del sistema están disponibles.'
              : esCoordinador
              ? 'Revisa y aprueba los predios nuevos, modificaciones y reapariciones. Tienes visibilidad completa de todos los trámites del sistema.'
              : 'Como administrador, tienes acceso completo para gestionar usuarios, aprobar cambios y supervisar todas las operaciones del sistema.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
