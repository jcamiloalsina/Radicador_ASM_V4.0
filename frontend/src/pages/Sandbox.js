import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Search, Database, Play, Trash2, Plus, AlertTriangle, Code,
  ChevronDown, ChevronRight, Copy, CheckCircle, Loader2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function Sandbox() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('consultas');
  const [loading, setLoading] = useState(false);
  
  // Estados para consultas
  const [coleccionSeleccionada, setColeccionSeleccionada] = useState('predios');
  const [queryFilter, setQueryFilter] = useState('{}');
  const [queryLimit, setQueryLimit] = useState(10);
  const [resultados, setResultados] = useState([]);
  const [totalResultados, setTotalResultados] = useState(0);
  const [expandedRows, setExpandedRows] = useState({});
  
  // Estados para sandbox de pruebas
  const [sandboxData, setSandboxData] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sandboxFormData, setSandboxFormData] = useState({
    codigo_predial_nacional: '',
    municipio: '',
    nombre_propietario: '',
    direccion: '',
    area_terreno: '',
    area_construida: '',
    avaluo: ''
  });

  const colecciones = [
    { id: 'predios', nombre: 'Predios', icon: Database },
    { id: 'users', nombre: 'Usuarios', icon: Database },
    { id: 'petitions', nombre: 'Peticiones', icon: Database },
    { id: 'cambios_pendientes', nombre: 'Cambios Pendientes', icon: Database },
    { id: 'predios_eliminados', nombre: 'Predios Eliminados', icon: Database },
  ];

  // Ejecutar consulta
  const ejecutarConsulta = async () => {
    setLoading(true);
    try {
      let filtro = {};
      try {
        filtro = JSON.parse(queryFilter);
      } catch (e) {
        toast.error('Filtro JSON inválido');
        setLoading(false);
        return;
      }

      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/sandbox/consultar`, {
        coleccion: coleccionSeleccionada,
        filtro,
        limite: queryLimit
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setResultados(response.data.resultados);
        setTotalResultados(response.data.total);
        toast.success(`${response.data.mostrando} resultados encontrados`);
      }
    } catch (error) {
      toast.error('Error al ejecutar consulta');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Cargar datos del sandbox
  const cargarDatosSandbox = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/sandbox/datos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setSandboxData(response.data.datos);
      }
    } catch (error) {
      console.error('Error cargando sandbox:', error);
    }
  };

  // Crear predio de prueba
  const crearPredioPrueba = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/sandbox/crear-predio`, {
        codigo_predial_nacional: sandboxFormData.codigo_predial_nacional,
        municipio: sandboxFormData.municipio,
        nombre_propietario: sandboxFormData.nombre_propietario,
        direccion: sandboxFormData.direccion,
        area_terreno: parseFloat(sandboxFormData.area_terreno) || 0,
        area_construida: parseFloat(sandboxFormData.area_construida) || 0,
        avaluo: parseFloat(sandboxFormData.avaluo) || 0
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        toast.success('Predio de prueba creado');
        setShowCreateModal(false);
        cargarDatosSandbox();
        setSandboxFormData({
          codigo_predial_nacional: '',
          municipio: '',
          nombre_propietario: '',
          direccion: '',
          area_terreno: '',
          area_construida: '',
          avaluo: ''
        });
      }
    } catch (error) {
      toast.error('Error al crear predio');
    }
  };

  // Eliminar predio del sandbox
  const eliminarPredioSandbox = async (id) => {
    if (!window.confirm('¿Eliminar este predio de prueba?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/sandbox/predio/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Predio eliminado del sandbox');
      cargarDatosSandbox();
    } catch (error) {
      toast.error('Error al eliminar predio');
    }
  };

  // Limpiar todo el sandbox
  const limpiarSandbox = async () => {
    if (!window.confirm('¿Está seguro de eliminar TODOS los datos del Sandbox?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/sandbox/limpiar`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Sandbox limpiado completamente');
      setSandboxData([]);
    } catch (error) {
      toast.error('Error al limpiar sandbox');
    }
  };

  // Copiar al portapapeles
  const copiarAlPortapapeles = (texto) => {
    navigator.clipboard.writeText(JSON.stringify(texto, null, 2));
    toast.success('Copiado al portapapeles');
  };

  useEffect(() => {
    if (activeTab === 'pruebas') {
      cargarDatosSandbox();
    }
  }, [activeTab]);

  if (user?.role !== 'administrador') {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-800">Acceso Restringido</h2>
        <p className="text-slate-600">Solo los administradores pueden acceder al Sandbox.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-xl p-6 mb-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Code className="w-8 h-8" />
          <h1 className="text-2xl font-bold">Sandbox - Entorno de Pruebas</h1>
        </div>
        <p className="text-purple-100">
          Consulta datos de producción y prueba funcionalidades sin afectar la base de datos real.
        </p>
        <div className="mt-3 flex items-center gap-2 text-amber-200 text-sm">
          <AlertTriangle className="w-4 h-4" />
          <span>Las operaciones de escritura se guardan en colecciones separadas (sandbox)</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm mb-6">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('consultas')}
            className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
              activeTab === 'consultas'
                ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <Database className="w-5 h-5 inline-block mr-2" />
            Consultas BD (Solo Lectura)
          </button>
          <button
            onClick={() => setActiveTab('pruebas')}
            className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
              activeTab === 'pruebas'
                ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <Play className="w-5 h-5 inline-block mr-2" />
            Pruebas (Sandbox)
          </button>
        </div>
      </div>

      {/* Tab: Consultas */}
      {activeTab === 'consultas' && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Search className="w-5 h-5 text-purple-600" />
            Consultar Colecciones de Producción
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            {/* Selector de colección */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Colección</Label>
              <div className="flex flex-wrap gap-2">
                {colecciones.map(col => (
                  <button
                    key={col.id}
                    onClick={() => setColeccionSeleccionada(col.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      coleccionSeleccionada === col.id
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {col.nombre}
                  </button>
                ))}
              </div>
            </div>

            {/* Límite */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Límite</Label>
              <Input
                type="number"
                value={queryLimit}
                onChange={(e) => setQueryLimit(parseInt(e.target.value) || 10)}
                min={1}
                max={100}
              />
            </div>
          </div>

          {/* Filtro JSON */}
          <div className="mb-4">
            <Label className="text-sm font-medium mb-2 block">
              Filtro JSON (opcional)
              <span className="text-slate-400 font-normal ml-2">Ej: {`{"municipio": "Ábrego"}`}</span>
            </Label>
            <Textarea
              value={queryFilter}
              onChange={(e) => setQueryFilter(e.target.value)}
              placeholder="{}"
              rows={2}
              className="font-mono text-sm"
            />
          </div>

          <Button 
            onClick={ejecutarConsulta} 
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Search className="w-4 h-4 mr-2" />
            )}
            Ejecutar Consulta
          </Button>

          {/* Resultados */}
          {resultados.length > 0 && (
            <div className="mt-6">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-medium text-slate-700">
                  Resultados ({resultados.length} de {totalResultados})
                </h4>
              </div>
              
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {resultados.map((item, index) => (
                  <div key={index} className="border rounded-lg p-3 bg-slate-50">
                    <div className="flex justify-between items-start">
                      <button
                        onClick={() => setExpandedRows(prev => ({ ...prev, [index]: !prev[index] }))}
                        className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-purple-600"
                      >
                        {expandedRows[index] ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                        <span className="font-mono text-xs bg-slate-200 px-2 py-0.5 rounded">
                          {item.codigo_predial_nacional || item.id || item.email || `Item ${index + 1}`}
                        </span>
                        <span className="text-slate-400">({Object.keys(item).length} campos)</span>
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copiarAlPortapapeles(item)}
                        className="h-7"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    
                    {expandedRows[index] && (
                      <pre className="mt-2 text-xs bg-slate-900 text-green-400 p-3 rounded overflow-x-auto">
                        {JSON.stringify(item, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Pruebas */}
      {activeTab === 'pruebas' && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Play className="w-5 h-5 text-purple-600" />
              Predios de Prueba (Sandbox)
            </h3>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Crear Predio de Prueba
              </Button>
              <Button
                variant="outline"
                onClick={limpiarSandbox}
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Limpiar Sandbox
              </Button>
            </div>
          </div>

          <p className="text-sm text-slate-500 mb-4">
            Estos datos NO afectan la base de datos de producción. Se guardan en la colección <code className="bg-slate-100 px-1 rounded">predios_sandbox</code>.
          </p>

          {sandboxData.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay predios de prueba en el sandbox</p>
              <p className="text-sm">Crea uno para empezar a experimentar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">Código</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">Municipio</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">Propietario</th>
                    <th className="px-4 py-2 text-right font-medium text-slate-600">Área Terreno</th>
                    <th className="px-4 py-2 text-right font-medium text-slate-600">Avalúo</th>
                    <th className="px-4 py-2 text-center font-medium text-slate-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sandboxData.map(predio => (
                    <tr key={predio.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs">{predio.codigo_predial_nacional}</td>
                      <td className="px-4 py-3">{predio.municipio}</td>
                      <td className="px-4 py-3">{predio.nombre_propietario}</td>
                      <td className="px-4 py-3 text-right">{predio.area_terreno?.toLocaleString()} m²</td>
                      <td className="px-4 py-3 text-right">${predio.avaluo?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => eliminarPredioSandbox(predio.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Info de seguridad */}
          <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-emerald-800">Datos Aislados</h4>
              <p className="text-sm text-emerald-700">
                Todos los datos creados en este Sandbox se almacenan en la colección <code className="bg-emerald-100 px-1 rounded">predios_sandbox</code>, 
                completamente separada de los datos de producción.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear predio */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Predio de Prueba</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <Label>Código Predial Nacional</Label>
              <Input
                value={sandboxFormData.codigo_predial_nacional}
                onChange={(e) => setSandboxFormData({...sandboxFormData, codigo_predial_nacional: e.target.value})}
                placeholder="540030001000000..."
              />
            </div>
            <div>
              <Label>Municipio</Label>
              <Input
                value={sandboxFormData.municipio}
                onChange={(e) => setSandboxFormData({...sandboxFormData, municipio: e.target.value})}
                placeholder="Ábrego"
              />
            </div>
            <div>
              <Label>Propietario</Label>
              <Input
                value={sandboxFormData.nombre_propietario}
                onChange={(e) => setSandboxFormData({...sandboxFormData, nombre_propietario: e.target.value})}
                placeholder="Nombre del propietario"
              />
            </div>
            <div>
              <Label>Dirección</Label>
              <Input
                value={sandboxFormData.direccion}
                onChange={(e) => setSandboxFormData({...sandboxFormData, direccion: e.target.value})}
                placeholder="Dirección del predio"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Área Terreno (m²)</Label>
                <Input
                  type="number"
                  value={sandboxFormData.area_terreno}
                  onChange={(e) => setSandboxFormData({...sandboxFormData, area_terreno: e.target.value})}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Avalúo ($)</Label>
                <Input
                  type="number"
                  value={sandboxFormData.avaluo}
                  onChange={(e) => setSandboxFormData({...sandboxFormData, avaluo: e.target.value})}
                  placeholder="0"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancelar
              </Button>
              <Button onClick={crearPredioPrueba} className="bg-purple-600 hover:bg-purple-700">
                Crear Predio
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
