import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';
import { Search, Eye, Filter, FileText, FileSpreadsheet, Calendar, Users, MapPin, ChevronDown, ChevronUp, RotateCcw, Download, WifiOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MUNICIPIOS } from '../data/catalogos';
import { SyncPetitionsButton } from '../components/OfflineComponents';
import { useOffline } from '../hooks/useOffline';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AllPetitions() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { isOnline, getPetitionsOffline } = useOffline();
  const [petitions, setPetitions] = useState([]);
  const [filteredPetitions, setFilteredPetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('estado') || 'todos');
  const [municipioFilter, setMunicipioFilter] = useState('todos');
  const [gestorFilter, setGestorFilter] = useState('todos');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [gestores, setGestores] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);

  // Check if user is coordinator or admin (can see advanced filters)
  const isCoordinatorOrAdmin = ['coordinador', 'administrador'].includes(user?.role);

  // Function to fetch all petitions for offline storage
  const fetchAllPetitionsForOffline = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/petitions?limit=1000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data || [];
    } catch (error) {
      console.error('Error fetching petitions for offline:', error);
      return [];
    }
  };

  useEffect(() => {
    if (user?.role === 'usuario') {
      navigate('/dashboard');
    } else {
      fetchPetitions();
      if (isCoordinatorOrAdmin) {
        fetchGestores();
      }
    }
  }, [user]);

  const fetchGestores = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Filter only gestores
      const gestoresList = response.data.filter(u => u.role === 'gestor');
      setGestores(gestoresList);
    } catch (error) {
      console.error('Error fetching gestores:', error);
    }
  };

  const handleStatusFilterChange = (value) => {
    setStatusFilter(value);
    if (value === 'todos') {
      searchParams.delete('estado');
    } else {
      searchParams.set('estado', value);
    }
    setSearchParams(searchParams);
  };

  useEffect(() => {
    const estadoFromUrl = searchParams.get('estado');
    if (estadoFromUrl && estadoFromUrl !== statusFilter) {
      setStatusFilter(estadoFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    let filtered = [...petitions];

    // Text search
    if (searchTerm) {
      filtered = filtered.filter(
        (p) =>
          (p.nombre_completo || p.creator_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (p.tipo_tramite || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (p.municipio || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (p.radicado || p.radicado_id || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'todos') {
      filtered = filtered.filter((p) => p.estado === statusFilter);
    }

    // Municipio filter
    if (municipioFilter !== 'todos') {
      filtered = filtered.filter((p) => p.municipio === municipioFilter);
    }

    // Gestor filter
    if (gestorFilter !== 'todos') {
      filtered = filtered.filter((p) => 
        p.gestores_asignados && p.gestores_asignados.includes(gestorFilter)
      );
    }

    // Date filters
    if (fechaDesde) {
      const desde = new Date(fechaDesde);
      filtered = filtered.filter((p) => new Date(p.created_at) >= desde);
    }
    if (fechaHasta) {
      const hasta = new Date(fechaHasta);
      hasta.setHours(23, 59, 59, 999);
      filtered = filtered.filter((p) => new Date(p.created_at) <= hasta);
    }

    setFilteredPetitions(filtered);
  }, [searchTerm, statusFilter, municipioFilter, gestorFilter, fechaDesde, fechaHasta, petitions]);

  const fetchPetitions = async () => {
    try {
      if (!isOnline) {
        // Try to load from offline storage
        const offlinePetitions = await getPetitionsOffline();
        if (offlinePetitions.length > 0) {
          setPetitions(offlinePetitions);
          setFilteredPetitions(offlinePetitions);
          setOfflineMode(true);
          toast.info('Mostrando peticiones guardadas offline', {
            description: `${offlinePetitions.length} peticiones disponibles`,
            icon: '📴'
          });
        } else {
          toast.error('No hay peticiones guardadas para modo offline');
        }
        setLoading(false);
        return;
      }
      
      const response = await axios.get(`${API}/petitions`);
      // Ordenar por fecha descendente (más recientes primero)
      const sortedPetitions = [...response.data].sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );
      setPetitions(sortedPetitions);
      setFilteredPetitions(sortedPetitions);
      setOfflineMode(false);
    } catch (error) {
      // Try offline as fallback
      const offlinePetitions = await getPetitionsOffline();
      if (offlinePetitions.length > 0) {
        setPetitions(offlinePetitions);
        setFilteredPetitions(offlinePetitions);
        setOfflineMode(true);
        toast.info('Sin conexión - Mostrando datos guardados', {
          description: `${offlinePetitions.length} peticiones disponibles offline`,
          icon: '📴'
        });
      } else {
        toast.error('Error al cargar peticiones');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('todos');
    setMunicipioFilter('todos');
    setGestorFilter('todos');
    setFechaDesde('');
    setFechaHasta('');
    searchParams.delete('estado');
    setSearchParams(searchParams);
  };

  const exportToExcel = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (statusFilter !== 'todos') params.append('estado', statusFilter);
      if (municipioFilter !== 'todos') params.append('municipio', municipioFilter);
      if (gestorFilter !== 'todos') params.append('gestor_id', gestorFilter);
      if (fechaDesde) params.append('fecha_desde', fechaDesde);
      if (fechaHasta) params.append('fecha_hasta', fechaHasta);
      
      const url = `${API}/reports/tramites/export-excel${params.toString() ? '?' + params.toString() : ''}`;
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Error al generar Excel');
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `Historico_Tramites_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success('Histórico exportado a Excel');
    } catch (error) {
      toast.error('Error al exportar a Excel');
    } finally {
      setExporting(false);
    }
  };

  const exportToPDF = async () => {
    try {
      const token = localStorage.getItem('token');
      let url = `${API}/reports/listado-tramites/export-pdf`;
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'todos') {
        params.append('estado', statusFilter);
      }
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Error al generar PDF');
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `Listado_Tramites_${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success('Listado de trámites descargado');
    } catch (error) {
      toast.error('Error al exportar listado de trámites');
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
    };
    const config = statusConfig[status] || statusConfig.radicado;
    return <Badge className={config.className} data-testid={`badge-${status}`}>{config.label}</Badge>;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getGestorName = (gestorId) => {
    const gestor = gestores.find(g => g.id === gestorId);
    return gestor?.full_name || 'Sin asignar';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-700"></div>
      </div>
    );
  }

  const hasActiveFilters = statusFilter !== 'todos' || municipioFilter !== 'todos' || 
    gestorFilter !== 'todos' || fechaDesde || fechaHasta || searchTerm;

  return (
    <div className="space-y-6" data-testid="all-petitions-page">
      {/* Offline Mode Banner */}
      {offlineMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
          <WifiOff className="w-5 h-5 text-amber-600" />
          <div className="flex-1">
            <span className="text-amber-800 font-medium">Modo Offline</span>
            <span className="text-amber-600 text-sm ml-2">
              Mostrando {petitions.length} peticiones guardadas localmente
            </span>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 font-outfit" data-testid="page-heading">
            {isCoordinatorOrAdmin ? 'Histórico de Trámites' : 'Todas las Peticiones'}
          </h2>
          <p className="text-slate-600 mt-1">
            {isCoordinatorOrAdmin 
              ? 'Consulta y exporta el histórico completo de trámites'
              : 'Gestiona todas las peticiones del sistema'}
          </p>
        </div>
        
        {/* Actions: Sync + Export Buttons */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Sync for Offline Button */}
          <SyncPetitionsButton onFetchPetitions={fetchAllPetitionsForOffline} />
          
          {isCoordinatorOrAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="border-emerald-600 text-emerald-700 hover:bg-emerald-50"
              onClick={exportToExcel}
              disabled={exporting}
              data-testid="export-excel-btn"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              {exporting ? 'Exportando...' : 'Exportar Excel'}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="border-slate-300 text-slate-700 hover:bg-slate-50"
            onClick={exportToPDF}
            data-testid="export-pdf-btn"
          >
            <FileText className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Filters Card */}
      <Card className="border-slate-200">
        <CardContent className="pt-6">
          {/* Basic Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por radicado, nombre, tipo de trámite..."
                className="pl-10 focus-visible:ring-emerald-600"
                data-testid="search-input"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                <SelectTrigger className="focus:ring-emerald-600" data-testid="status-filter">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los Estados</SelectItem>
                  <SelectItem value="radicado">Radicado</SelectItem>
                  <SelectItem value="asignado">Asignado</SelectItem>
                  <SelectItem value="rechazado">Rechazado</SelectItem>
                  <SelectItem value="revision">En Revisión</SelectItem>
                  <SelectItem value="devuelto">Devuelto</SelectItem>
                  <SelectItem value="finalizado">Finalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Advanced Filters Toggle (for coordinators/admins) */}
          {isCoordinatorOrAdmin && (
            <>
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="flex items-center gap-2 mt-4 text-sm text-emerald-700 hover:text-emerald-800 font-medium"
                data-testid="toggle-advanced-filters"
              >
                {showAdvancedFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {showAdvancedFilters ? 'Ocultar filtros avanzados' : 'Mostrar filtros avanzados'}
              </button>

              {/* Advanced Filters */}
              {showAdvancedFilters && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-200">
                  {/* Municipio Filter */}
                  <div>
                    <label className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Municipio
                    </label>
                    <Select value={municipioFilter} onValueChange={setMunicipioFilter}>
                      <SelectTrigger className="focus:ring-emerald-600" data-testid="municipio-filter">
                        <SelectValue placeholder="Municipio" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos los Municipios</SelectItem>
                        {MUNICIPIOS.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Gestor Filter */}
                  <div>
                    <label className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                      <Users className="w-3 h-3" /> Gestor Asignado
                    </label>
                    <Select value={gestorFilter} onValueChange={setGestorFilter}>
                      <SelectTrigger className="focus:ring-emerald-600" data-testid="gestor-filter">
                        <SelectValue placeholder="Gestor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos los Gestores</SelectItem>
                        {gestores.map((g) => (
                          <SelectItem key={g.id} value={g.id}>{g.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Fecha Desde */}
                  <div>
                    <label className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Desde
                    </label>
                    <Input
                      type="date"
                      value={fechaDesde}
                      onChange={(e) => setFechaDesde(e.target.value)}
                      className="focus-visible:ring-emerald-600"
                      data-testid="fecha-desde"
                    />
                  </div>

                  {/* Fecha Hasta */}
                  <div>
                    <label className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Hasta
                    </label>
                    <Input
                      type="date"
                      value={fechaHasta}
                      onChange={(e) => setFechaHasta(e.target.value)}
                      className="focus-visible:ring-emerald-600"
                      data-testid="fecha-hasta"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Reset Filters */}
          {hasActiveFilters && (
            <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
              <span className="text-sm text-slate-500">
                {filteredPetitions.length} de {petitions.length} trámites
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="text-slate-600 hover:text-slate-800"
                data-testid="reset-filters-btn"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Limpiar filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="text-sm text-slate-600" data-testid="results-count">
        Mostrando {filteredPetitions.length} de {petitions.length} trámites
      </div>

      {/* Petitions Table */}
      {filteredPetitions.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="pt-6 text-center py-12">
            <p className="text-slate-600" data-testid="no-petitions-message">
              No se encontraron trámites con los criterios de búsqueda.
            </p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetFilters}
                className="mt-4"
              >
                Limpiar filtros
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-slate-200">
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-4 px-4 font-semibold text-slate-700 w-36">Radicado</th>
                  <th className="text-left py-4 px-4 font-semibold text-slate-700 w-48">Solicitante</th>
                  <th className="text-left py-4 px-4 font-semibold text-slate-700 w-32">Municipio</th>
                  <th className="text-left py-4 px-4 font-semibold text-slate-700 w-28">Estado</th>
                  {isCoordinatorOrAdmin && (
                    <th className="text-left py-4 px-4 font-semibold text-slate-700 w-36">Gestor</th>
                  )}
                  <th className="text-left py-4 px-4 font-semibold text-slate-700 w-28">Fecha</th>
                  <th className="text-center py-4 px-4 font-semibold text-slate-700 w-24">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPetitions.map((petition) => (
                  <tr 
                    key={petition.id} 
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/dashboard/peticiones/${petition.id}`)}
                    data-testid={`petition-row-${petition.id}`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-emerald-700" data-testid={`petition-radicado-${petition.id}`}>
                        {petition.radicado || petition.radicado_id}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">
                        {petition.tipo_tramite}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm text-slate-800 font-medium">
                        {petition.nombre_completo || petition.creator_name}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm text-slate-600">
                        {petition.municipio}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(petition.estado)}
                    </td>
                    {isCoordinatorOrAdmin && (
                      <td className="py-3 px-4">
                        <div className="text-sm text-slate-600">
                          {petition.gestores_asignados?.length > 0 
                            ? getGestorName(petition.gestores_asignados[0])
                            : <span className="text-slate-400">Sin asignar</span>}
                        </div>
                      </td>
                    )}
                    <td className="py-3 px-4">
                      <div className="text-sm text-slate-600">
                        {formatDate(petition.created_at)}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/dashboard/peticiones/${petition.id}`);
                        }}
                        variant="outline"
                        size="sm"
                        className="text-emerald-700 border-emerald-700 hover:bg-emerald-50"
                        data-testid={`view-details-${petition.id}`}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Ver
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
