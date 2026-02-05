import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { 
  FileText, Clock, CheckCircle, XCircle, Plus, FileCheck, RotateCcw,
  Building, Edit, Users, ArrowRight, MapPin, Loader2, RefreshCw
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
          {/* Sección: Mis Asignaciones */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Building className="w-5 h-5 text-emerald-600" />
              Mis Asignaciones
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                title="Predios Creados"
                value={stats?.predios_creados || 0}
                icon={FileText}
                color="bg-blue-600"
                onClick={() => navigate('/dashboard/pendientes')}
                subtitle="Predios nuevos que creé"
              />
              <StatCard
                title="Predios Asignados"
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
            </div>
          </div>

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
          {/* Sección: Pendientes por Aprobar */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-600" />
              Pendientes por Aprobar
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                title="Reapariciones"
                value={stats?.reapariciones_pendientes || 0}
                icon={RefreshCw}
                color="bg-red-500"
                onClick={() => navigate('/dashboard/pendientes')}
                subtitle="Por revisar"
              />
            </div>
          </div>

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
