import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import axios from 'axios';
import { Plus, Search, Eye, FileText, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function MyPetitions() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [peticionesPropias, setPeticionesPropias] = useState([]);

  // Determinar si es usuario ciudadano
  const esUsuarioCiudadano = user?.role === 'usuario';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      // Solo cargar radicados que el usuario creó
      const response = await axios.get(`${API}/petitions/mis-peticiones`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPeticionesPropias(response.data);
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
      en_revision: { label: 'En Revisión', className: 'bg-purple-100 text-purple-800 border-purple-200' },
      devuelto: { label: 'Devuelto', className: 'bg-orange-100 text-orange-800 border-orange-200' },
      finalizado: { label: 'Finalizado', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
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
  const filterItems = (items) => {
    if (!searchTerm) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(item => 
      ['nombre_completo', 'tipo_tramite', 'municipio', 'radicado'].some(field => {
        const value = item[field];
        return value && value.toString().toLowerCase().includes(term);
      })
    );
  };

  const filteredPeticiones = filterItems(peticionesPropias);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-12 h-12 animate-spin text-emerald-600" />
      </div>
    );
  }

  const pageTitle = 'Mis Peticiones';
  const pageDescription = 'Radicados que has creado para procesar';

  // Componente para renderizar una petición
  const PetitionCard = ({ petition }) => (
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
        
        {/* Mostrar vinculación si existe */}
        {petition.predio_vinculado && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800 font-medium">
              <FileText className="w-4 h-4 inline mr-1" />
              Vinculado a predio: {petition.predio_vinculado.codigo || 'En proceso'}
            </p>
          </div>
        )}
        
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
            data-testid={`ver-peticion-${petition.id}`}
          >
            <Eye className="w-4 h-4 mr-2" />
            Ver Detalles
          </Button>
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
        {showCreateButton && (
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
          data-testid="nueva-peticion-btn"
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
              data-testid="search-peticiones"
            />
          </div>
        </CardContent>
      </Card>

      {/* Lista de peticiones */}
      <div className="space-y-4">
        {filteredPeticiones.length === 0 ? (
          <EmptyState 
            message={searchTerm ? 'No se encontraron peticiones con ese criterio.' : 'No has creado peticiones aún.'} 
            showCreateButton={!searchTerm}
          />
        ) : (
          <div className="grid gap-4">
            {filteredPeticiones.map(petition => (
              <PetitionCard key={petition.id} petition={petition} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
