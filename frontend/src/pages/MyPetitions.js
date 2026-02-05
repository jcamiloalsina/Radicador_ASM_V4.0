import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';
import { Plus, Search, Eye, FileText, User, Building, Clock, CheckCircle, Loader2, ArrowRight, Edit } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function MyPetitions() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('propias');
  
  // Datos separados por categoría
  const [peticionesPropias, setPeticionesPropias] = useState([]);
  const [peticionesAsignadas, setPeticionesAsignadas] = useState([]);
  const [prediosCreados, setPrediosCreados] = useState([]);

  // Determinar si es usuario ciudadano o personal interno
  const esUsuarioCiudadano = user?.role === 'usuario';
  const esStaffInterno = !['usuario', 'empresa'].includes(user?.role);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (esUsuarioCiudadano) {
        // Para ciudadanos, solo cargar sus peticiones propias
        const response = await axios.get(`${API}/petitions/mis-peticiones`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPeticionesPropias(response.data);
      } else {
        // Para gestores, cargar vista completa
        const response = await axios.get(`${API}/petitions/mis-peticiones-completas`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPeticionesPropias(response.data.peticiones_propias || []);
        setPeticionesAsignadas(response.data.peticiones_asignadas || []);
        setPrediosCreados(response.data.predios_creados || []);
      }
    } catch (error) {
      console.error('Error al cargar datos:', error);
      toast.error('Error al cargar peticiones');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      radicado: { label: 'Radicado', className: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
      asignado: { label: 'Asignado', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      rechazado: { label: 'Rechazado', className: 'bg-red-100 text-red-800 border-red-200' },
      revision: { label: 'En Revisión', className: 'bg-purple-100 text-purple-800 border-purple-200' },
      devuelto: { label: 'Devuelto', className: 'bg-orange-100 text-orange-800 border-orange-200' },
      finalizado: { label: 'Finalizado', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
      // Estados de predios nuevos
      creado: { label: 'Creado', className: 'bg-blue-100 text-blue-800 border-blue-200' },
      digitalizacion: { label: 'En Digitalización', className: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
      aprobado: { label: 'Aprobado', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    };
    const config = statusConfig[status] || { label: status || 'N/A', className: 'bg-slate-100 text-slate-800 border-slate-200' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Filtrar peticiones según búsqueda
  const filterItems = (items, fields) => {
    if (!searchTerm) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(item => 
      fields.some(field => {
        const value = item[field];
        return value && value.toString().toLowerCase().includes(term);
      })
    );
  };

  const filteredPropias = filterItems(peticionesPropias, ['nombre_completo', 'tipo_tramite', 'municipio', 'radicado']);
  const filteredAsignadas = filterItems(peticionesAsignadas, ['nombre_completo', 'tipo_tramite', 'municipio', 'radicado']);
  const filteredPredios = filterItems(prediosCreados, ['municipio', 'radicado_numero', 'codigo_predial_nacional', 'gestor_apoyo_nombre']);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-12 h-12 animate-spin text-emerald-600" />
      </div>
    );
  }

  const pageTitle = esUsuarioCiudadano ? 'Mis Radicados' : 'Mis Peticiones';
  const pageDescription = esUsuarioCiudadano 
    ? 'Consulta el estado de tus trámites catastrales' 
    : 'Gestiona peticiones asignadas y predios en creación';

  // Componente para renderizar una petición
  const PetitionCard = ({ petition, showAssignedBadge = false }) => (
    <Card key={petition.id} className="border-slate-200 hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
          <div>
            <CardTitle className="text-lg font-outfit text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              {petition.radicado}
            </CardTitle>
            <p className="text-sm text-slate-600 mt-1">{petition.nombre_completo}</p>
            <p className="text-xs text-slate-500 mt-1">
              Creada el {formatDate(petition.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {showAssignedBadge && (
              <Badge variant="outline" className="text-purple-600 border-purple-300">
                <User className="w-3 h-3 mr-1" />
                Asignada
              </Badge>
            )}
            {getStatusBadge(petition.estado)}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Tipo de Trámite</p>
            <p className="font-medium text-slate-900">{petition.tipo_tramite}</p>
          </div>
          <div>
            <p className="text-slate-500">Municipio</p>
            <p className="font-medium text-slate-900">{petition.municipio}</p>
          </div>
          <div>
            <p className="text-slate-500">Teléfono</p>
            <p className="font-medium text-slate-900">{petition.telefono || 'N/A'}</p>
          </div>
        </div>
        {petition.estado === 'rechazado' && esUsuarioCiudadano && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800 font-medium">⚠️ Este trámite requiere subsanación</p>
            <p className="text-xs text-red-700 mt-1">Haz clic en "Ver Detalles" para cargar los documentos solicitados</p>
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <Button
            onClick={() => navigate(`/dashboard/peticiones/${petition.id}`)}
            variant="outline"
            size="sm"
            className="text-emerald-700 border-emerald-700 hover:bg-emerald-50"
          >
            <Eye className="w-4 h-4 mr-2" />
            Ver Detalles
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Componente para renderizar un predio en creación
  const PredioCard = ({ predio }) => (
    <Card key={predio.id} className="border-slate-200 hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
          <div>
            <CardTitle className="text-lg font-outfit text-slate-900 flex items-center gap-2">
              <Building className="w-4 h-4 text-slate-500" />
              {predio.codigo_predial_nacional || 'Predio Nuevo'}
            </CardTitle>
            <p className="text-sm text-slate-600 mt-1">
              {predio.municipio || 'Municipio no definido'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Creado el {formatDate(predio.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-blue-600 border-blue-300">
              <User className="w-3 h-3 mr-1" />
              Creador
            </Badge>
            {getStatusBadge(predio.estado_flujo || predio.estado)}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Radicado Asociado</p>
            <p className="font-medium text-slate-900">
              {predio.radicado_numero || 'Sin radicado'}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Gestor de Apoyo</p>
            <p className="font-medium text-slate-900">
              {predio.gestor_apoyo_nombre || 'No asignado'}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Dirección</p>
            <p className="font-medium text-slate-900">
              {predio.datos_predio?.direccion || predio.direccion || 'N/A'}
            </p>
          </div>
        </div>
        
        {/* Información adicional del estado */}
        {(predio.estado_flujo === 'creado' || predio.estado === 'creado') && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800 font-medium">
              <Clock className="w-4 h-4 inline mr-1" />
              Pendiente de digitalización
            </p>
            <p className="text-xs text-blue-700 mt-1">
              El gestor de apoyo debe completar la información y enviar a revisión
            </p>
          </div>
        )}
        
        {(predio.estado_flujo === 'revision' || predio.estado === 'revision') && (
          <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-md">
            <p className="text-sm text-purple-800 font-medium">
              <ArrowRight className="w-4 h-4 inline mr-1" />
              En revisión por coordinador
            </p>
          </div>
        )}
        
        {(predio.estado_flujo === 'aprobado' || predio.estado === 'aprobado') && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-md">
            <p className="text-sm text-emerald-800 font-medium">
              <CheckCircle className="w-4 h-4 inline mr-1" />
              Predio aprobado e incorporado a la base catastral
            </p>
          </div>
        )}
        
        <div className="mt-4 flex justify-end gap-2">
          {/* Botón Editar - visible para el creador en estados editables */}
          {['creado', 'digitalizacion', 'devuelto'].includes(predio.estado_flujo || predio.estado) && (
            <Button
              onClick={() => navigate(`/dashboard/predios?predio_nuevo=${predio.id}`)}
              variant="outline"
              size="sm"
              className="text-blue-700 border-blue-700 hover:bg-blue-50"
              data-testid={`edit-predio-creado-${predio.id}`}
            >
              <Edit className="w-4 h-4 mr-2" />
              Editar
            </Button>
          )}
          <Button
            onClick={() => navigate('/dashboard/pendientes')}
            variant="outline"
            size="sm"
            className="text-emerald-700 border-emerald-700 hover:bg-emerald-50"
          >
            <Eye className="w-4 h-4 mr-2" />
            Ver en Pendientes
          </Button>
          {predio.radicado_id && (
            <Button
              onClick={() => navigate(`/dashboard/peticiones/${predio.radicado_id}`)}
              variant="outline"
              size="sm"
              className="text-blue-700 border-blue-700 hover:bg-blue-50"
            >
              <FileText className="w-4 h-4 mr-2" />
              Ver Radicado
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  // Vista vacía
  const EmptyState = ({ message, showCreateButton = false }) => (
    <Card className="border-slate-200">
      <CardContent className="pt-6 text-center py-12">
        <CheckCircle className="w-12 h-12 mx-auto text-slate-300 mb-4" />
        <p className="text-slate-600">{message}</p>
        {showCreateButton && esUsuarioCiudadano && (
          <Button
            onClick={() => navigate('/dashboard/peticiones/nueva')}
            className="mt-4 bg-emerald-700 hover:bg-emerald-800 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Crear Primera Petición
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6" data-testid="my-petitions-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 font-outfit">
            {pageTitle}
          </h2>
          <p className="text-slate-600 mt-1">{pageDescription}</p>
        </div>
        <Button
          onClick={() => navigate('/dashboard/peticiones/nueva')}
          className="bg-emerald-700 hover:bg-emerald-800 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nueva Petición
        </Button>
      </div>

      {/* Search */}
      <Card className="border-slate-200">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por radicado, nombre, tipo de trámite, municipio..."
              className="pl-10 focus-visible:ring-emerald-600"
            />
          </div>
        </CardContent>
      </Card>

      {/* Contenido - Tabs solo para gestores, lista simple para ciudadanos */}
      {esUsuarioCiudadano ? (
        // Vista simple para ciudadanos
        <div className="space-y-4">
          {filteredPropias.length === 0 ? (
            <EmptyState 
              message={searchTerm ? 'No se encontraron peticiones con ese criterio.' : 'No tienes radicados aún.'} 
              showCreateButton={!searchTerm}
            />
          ) : (
            <div className="grid gap-4">
              {filteredPropias.map(petition => (
                <PetitionCard key={petition.id} petition={petition} />
              ))}
            </div>
          )}
        </div>
      ) : (
        // Vista con tabs para gestores
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full max-w-lg">
            <TabsTrigger value="propias" className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              Mis Radicados
              {peticionesPropias.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{peticionesPropias.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="asignadas" className="flex items-center gap-1">
              <User className="w-4 h-4" />
              Asignadas
              {peticionesAsignadas.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{peticionesAsignadas.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="predios" className="flex items-center gap-1">
              <Building className="w-4 h-4" />
              Predios Creados
              {prediosCreados.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{prediosCreados.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Tab: Mis Radicados (peticiones propias) */}
          <TabsContent value="propias" className="space-y-4">
            {filteredPropias.length === 0 ? (
              <EmptyState message={searchTerm ? 'No se encontraron peticiones.' : 'No has creado peticiones.'} />
            ) : (
              <div className="grid gap-4">
                {filteredPropias.map(petition => (
                  <PetitionCard key={petition.id} petition={petition} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab: Peticiones Asignadas */}
          <TabsContent value="asignadas" className="space-y-4">
            {filteredAsignadas.length === 0 ? (
              <EmptyState message={searchTerm ? 'No se encontraron peticiones.' : 'No tienes peticiones asignadas.'} />
            ) : (
              <div className="grid gap-4">
                {filteredAsignadas.map(petition => (
                  <PetitionCard key={petition.id} petition={petition} showAssignedBadge />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab: Predios Creados */}
          <TabsContent value="predios" className="space-y-4">
            {filteredPredios.length === 0 ? (
              <EmptyState message={searchTerm ? 'No se encontraron predios.' : 'No has creado predios nuevos.'} />
            ) : (
              <div className="grid gap-4">
                {filteredPredios.map(predio => (
                  <PredioCard key={predio.id} predio={predio} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
