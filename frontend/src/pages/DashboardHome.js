import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { FileText, Clock, CheckCircle, XCircle, Plus, FileCheck, RotateCcw } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function DashboardHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/petitions/stats/dashboard`);
      setStats(response.data);
    } catch (error) {
      toast.error('Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-700"></div>
      </div>
    );
  }

  // Stats for usuario - only relevant states
  const usuarioStats = [
    {
      title: 'Mis Radicados',
      value: stats?.total || 0,
      icon: FileText,
      color: 'bg-emerald-600',
      testId: 'stat-total'
    },
  ];

  // Stats for staff - all states with filter parameter
  const staffStats = [
    {
      title: 'Total de Peticiones',
      value: stats?.total || 0,
      icon: FileText,
      color: 'bg-blue-500',
      testId: 'stat-total',
      filter: 'todos'
    },
    {
      title: 'Radicado',
      value: stats?.radicado || 0,
      icon: FileCheck,
      color: 'bg-indigo-500',
      testId: 'stat-radicado',
      filter: 'radicado'
    },
    {
      title: 'Asignado',
      value: stats?.asignado || 0,
      icon: Clock,
      color: 'bg-yellow-500',
      testId: 'stat-asignado',
      filter: 'asignado'
    },
    {
      title: 'En Revisión',
      value: stats?.revision || 0,
      icon: FileCheck,
      color: 'bg-purple-500',
      testId: 'stat-revision',
      filter: 'revision'
    },
    {
      title: 'Finalizado',
      value: stats?.finalizado || 0,
      icon: CheckCircle,
      color: 'bg-emerald-500',
      testId: 'stat-finalizado',
      filter: 'finalizado'
    },
    {
      title: 'Rechazado',
      value: stats?.rechazado || 0,
      icon: XCircle,
      color: 'bg-red-500',
      testId: 'stat-rechazado',
      filter: 'rechazado'
    },
    {
      title: 'Devuelto',
      value: stats?.devuelto || 0,
      icon: RotateCcw,
      color: 'bg-orange-500',
      testId: 'stat-devuelto',
      filter: 'devuelto'
    },
  ];

  const statCards = user?.role === 'usuario' ? usuarioStats : staffStats;

  return (
    <div className="space-y-8" data-testid="dashboard-home">
      {/* Welcome Section */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 font-outfit" data-testid="welcome-message">
          Bienvenido, {user?.full_name}
        </h2>
        <p className="text-slate-600 mt-2">
          {user?.role === 'usuario'
            ? 'Gestiona tus radicados y haz seguimiento al estado de tus trámites'
            : 'Panel de control de peticiones catastrales - Asomunicipios'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${user?.role === 'usuario' ? 'lg:grid-cols-1 max-w-md' : 'lg:grid-cols-4'} gap-4`}>
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card 
              key={stat.title} 
              className="border-slate-200 hover:shadow-lg transition-all cursor-pointer hover:border-emerald-500" 
              data-testid={stat.testId}
              onClick={() => navigate(user?.role === 'usuario' ? '/dashboard/peticiones' : `/dashboard/todas-peticiones?estado=${stat.filter || 'todos'}`)}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">{stat.title}</CardTitle>
                <div className={`${stat.color} p-2 rounded-md`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900" data-testid={`${stat.testId}-value`}>{stat.value}</div>
                <p className="text-xs text-slate-500 mt-2">Click para ver detalles</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-slate-900 font-outfit">Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {user?.role === 'usuario' && (
            <Button
              onClick={() => {
                navigate('/dashboard/peticiones/nueva');
              }}
              className="w-full md:w-auto bg-emerald-700 hover:bg-emerald-800 text-white"
              data-testid="create-petition-button"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva Petición
            </Button>
          )}
          <Button
            onClick={() => navigate('/dashboard/peticiones')}
            variant="outline"
            className="w-full md:w-auto ml-0 md:ml-2"
            data-testid="view-petitions-button"
          >
            <FileText className="w-4 h-4 mr-2" />
            {user?.role === 'usuario' ? 'Ver Mis Radicados' : 'Ver Mis Peticiones'}
          </Button>
          {user?.role !== 'usuario' && (
            <Button
              onClick={() => navigate('/dashboard/todas-peticiones')}
              variant="outline"
              className="w-full md:w-auto ml-0 md:ml-2"
              data-testid="view-all-petitions-button"
            >
              <FileText className="w-4 h-4 mr-2" />
              Ver Todas las Peticiones
            </Button>
          )}
          {['administrador', 'coordinador', 'atencion_usuario'].includes(user?.role) && (
            <Button
              onClick={() => navigate('/dashboard/usuarios')}
              variant="outline"
              className="w-full md:w-auto ml-0 md:ml-2"
              data-testid="manage-users-button"
            >
              <FileText className="w-4 h-4 mr-2" />
              Gestionar Usuarios
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-emerald-200 bg-emerald-50">
        <CardContent className="pt-6">
          <p className="text-sm text-emerald-900">
            {user?.role === 'usuario'
              ? 'Puedes crear nuevas peticiones y hacer seguimiento al estado de tus trámites. Si tu trámite es rechazado, podrás cargar documentos para subsanar.'
              : user?.role === 'atencion_usuario'
              ? 'Como personal de atención, puedes revisar, asignar gestores y actualizar el estado de las peticiones.'
              : user?.role === 'gestor' || user?.role === 'gestor_auxiliar'
              ? 'Como gestor, puedes procesar trámites asignados, pedir ayuda a auxiliares y enviar trámites para revisión.'
              : user?.role === 'coordinador'
              ? 'Como coordinador, puedes revisar, aprobar o devolver trámites, y finalizar procesos con firma digital.'
              : user?.role === 'comunicaciones'
              ? 'Como personal de comunicaciones, tienes acceso para gestionar información y visualizar el estado general de las peticiones.'
              : user?.role === 'empresa'
              ? 'Como empresa aliada, puedes consultar información catastral, ver el visor de predios y acceder a los certificados autorizados.'
              : 'Como administrador, tienes acceso completo para gestionar usuarios y todas las peticiones del sistema.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
