import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Search, Database, FileText, Building, Users, RefreshCw, 
  Eye, Play, Trash2, Plus, Download, AlertTriangle, Code,
  ChevronDown, ChevronRight, Copy, CheckCircle, Save, FileEdit,
  Loader2
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

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
  
  // Estados para editor de plantillas de resolución
  const [plantilla, setPlantilla] = useState({
    preambulo: '',
    considerando_1: '',
    considerando_2_docs: [],
    considerando_3: '',
    considerando_final: '',
    articulo_2: '',
    articulo_3: '',
    articulo_4: '',
    cierre: '',
    firmante_nombre: '',
    firmante_cargo: ''
  });
  const [prediosPrueba, setPrediosPrueba] = useState([]);
  const [predioSeleccionado, setPredioSeleccionado] = useState(null);
  const [tipoTramite, setTipoTramite] = useState('Cambio de Propietario');
  const [radicadoPrueba, setRadicadoPrueba] = useState('');
  const [propietariosNuevos, setPropietariosNuevos] = useState([{ nombre: '', documento: '' }]);
  const [pdfUrl, setPdfUrl] = useState('');
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false);
  const [plantillaGuardada, setPlantillaGuardada] = useState(false);
  
  // Colecciones disponibles para consulta (solo lectura)
  const colecciones = [
    { id: 'predios', nombre: 'Predios', icono: Building, descripcion: 'Base de datos de predios' },
    { id: 'users', nombre: 'Usuarios', icono: Users, descripcion: 'Usuarios del sistema' },
    { id: 'petitions', nombre: 'Peticiones', icono: FileText, descripcion: 'Peticiones/Radicados' },
    { id: 'predios_cambios', nombre: 'Cambios Pendientes', icono: RefreshCw, descripcion: 'Propuestas de cambios' },
    { id: 'predios_eliminados', nombre: 'Predios Eliminados', icono: Trash2, descripcion: 'Archivo de eliminados' },
  ];

  // Ejecutar consulta a la base de datos (SOLO LECTURA)
  const ejecutarConsulta = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let filterObj = {};
      
      try {
        filterObj = JSON.parse(queryFilter);
      } catch (e) {
        toast.error('Filtro JSON inválido');
        setLoading(false);
        return;
      }
      
      const response = await axios.post(`${API}/sandbox/consultar`, {
        coleccion: coleccionSeleccionada,
        filtro: filterObj,
        limite: queryLimit
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setResultados(response.data.resultados || []);
      setTotalResultados(response.data.total || 0);
      toast.success(`${response.data.resultados?.length || 0} resultados encontrados`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al ejecutar consulta');
    } finally {
      setLoading(false);
    }
  };

  // Cargar datos del sandbox
  const cargarSandboxData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/sandbox/datos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSandboxData(response.data.datos || []);
    } catch (error) {
      console.error('Error cargando sandbox:', error);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'pruebas') {
      cargarSandboxData();
    }
  }, [activeTab, cargarSandboxData]);

  // Crear predio de prueba en sandbox
  const crearPredioSandbox = async () => {
    try {
      const token = localStorage.getItem('token');
      // Convert string values to proper types for the API
      const payload = {
        codigo_predial_nacional: sandboxFormData.codigo_predial_nacional || '',
        municipio: sandboxFormData.municipio || '',
        nombre_propietario: sandboxFormData.nombre_propietario || '',
        direccion: sandboxFormData.direccion || '',
        area_terreno: parseFloat(sandboxFormData.area_terreno) || 0,
        area_construida: parseFloat(sandboxFormData.area_construida) || 0,
        avaluo: parseFloat(sandboxFormData.avaluo) || 0
      };
      await axios.post(`${API}/sandbox/crear-predio`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Predio de prueba creado en Sandbox');
      setShowCreateModal(false);
      setSandboxFormData({
        codigo_predial_nacional: '',
        municipio: '',
        nombre_propietario: '',
        direccion: '',
        area_terreno: '',
        area_construida: '',
        avaluo: ''
      });
      cargarSandboxData();
    } catch (error) {
      // Handle error detail which may be a string or array
      let errorMsg = 'Error al crear predio de prueba';
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        if (typeof detail === 'string') {
          errorMsg = detail;
        } else if (Array.isArray(detail)) {
          errorMsg = detail.map(d => d.msg || d).join(', ');
        }
      }
      toast.error(errorMsg);
    }
  };

  // Eliminar predio del sandbox
  const eliminarPredioSandbox = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/sandbox/predio/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Predio eliminado del Sandbox');
      cargarSandboxData();
    } catch (error) {
      toast.error('Error al eliminar predio del sandbox');
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

  // ===== FUNCIONES PARA EDITOR DE PLANTILLAS =====
  
  // Cargar plantilla guardada o default
  const cargarPlantilla = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/sandbox/plantilla-resolucion/guardada`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setPlantilla(response.data.plantilla);
        setPlantillaGuardada(response.data.guardada);
      }
    } catch (error) {
      console.error('Error cargando plantilla:', error);
      // Cargar plantilla default
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API}/sandbox/plantilla-resolucion/default`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data.success) {
          setPlantilla(response.data.plantilla);
        }
      } catch (e) {
        toast.error('Error cargando plantilla');
      }
    }
  };

  // Cargar predios para prueba
  const cargarPrediosPrueba = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/sandbox/predios-para-prueba?limite=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setPrediosPrueba(response.data.predios);
      }
    } catch (error) {
      console.error('Error cargando predios:', error);
    }
  };

  // Guardar plantilla
  const guardarPlantilla = async () => {
    setGuardandoPlantilla(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/sandbox/plantilla-resolucion/guardar`, plantilla, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Plantilla guardada correctamente');
      setPlantillaGuardada(true);
    } catch (error) {
      toast.error('Error guardando plantilla');
    } finally {
      setGuardandoPlantilla(false);
    }
  };

  // Generar PDF de prueba
  const generarPdfPrueba = async () => {
    setGenerandoPdf(true);
    setPdfUrl('');
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/sandbox/generar-resolucion-prueba`, {
        predio_id: predioSeleccionado?.id || '',
        plantilla: plantilla,
        tipo_tramite: tipoTramite,
        radicado: radicadoPrueba || `RASMGC-XXXX-${new Date().toLocaleDateString('es-CO').replace(/\//g, '-')}`,
        propietarios_nuevos: propietariosNuevos.filter(p => p.nombre)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setPdfUrl(process.env.REACT_APP_BACKEND_URL + response.data.pdf_url);
        toast.success('PDF generado correctamente');
      }
    } catch (error) {
      console.error('Error generando PDF:', error);
      toast.error('Error generando PDF de prueba');
    } finally {
      setGenerandoPdf(false);
    }
  };

  // Agregar propietario nuevo
  const agregarPropietario = () => {
    setPropietariosNuevos([...propietariosNuevos, { nombre: '', documento: '' }]);
  };

  // Eliminar propietario
  const eliminarPropietario = (index) => {
    setPropietariosNuevos(propietariosNuevos.filter((_, i) => i !== index));
  };

  // Actualizar propietario
  const actualizarPropietario = (index, campo, valor) => {
    const nuevos = [...propietariosNuevos];
    nuevos[index][campo] = valor;
    setPropietariosNuevos(nuevos);
  };

  // Cargar datos cuando se activa la pestaña de plantillas
  useEffect(() => {
    if (activeTab === 'plantillas') {
      cargarPlantilla();
      cargarPrediosPrueba();
    }
  }, [activeTab]);

  // Copiar JSON al portapapeles
  const copiarJSON = (data) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    toast.success('JSON copiado al portapapeles');
  };

  // Toggle expandir fila
  const toggleExpandRow = (index) => {
    setExpandedRows(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Verificar permisos (solo admin)
  if (!user || user.role !== 'administrador') {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center">
          <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Acceso Restringido</h2>
          <p className="text-slate-600">Solo los administradores pueden acceder al módulo Sandbox.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 mb-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Code className="w-8 h-8" />
            <h1 className="text-2xl font-bold">Sandbox - Entorno de Pruebas</h1>
          </div>
          <p className="text-purple-100">
            Consulta datos de producción y prueba funcionalidades sin afectar la base de datos real.
          </p>
          <div className="mt-3 flex items-center gap-2 text-sm bg-purple-500/30 rounded-lg px-3 py-2">
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
              Consultas BD
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
            <button
              onClick={() => setActiveTab('plantillas')}
              className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
                activeTab === 'plantillas'
                  ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <FileEdit className="w-5 h-5 inline-block mr-2" />
              Editor de Resoluciones
            </button>
          </div>
        </div>

        {/* Tab: Consultas BD */}
        {activeTab === 'consultas' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Panel de consulta */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white rounded-xl shadow-sm p-4">
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <Database className="w-5 h-5 text-purple-600" />
                  Colección
                </h3>
                <div className="space-y-2">
                  {colecciones.map(col => (
                    <button
                      key={col.id}
                      onClick={() => setColeccionSeleccionada(col.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                        coleccionSeleccionada === col.id
                          ? 'bg-purple-100 text-purple-700 border border-purple-300'
                          : 'hover:bg-slate-100 text-slate-600'
                      }`}
                    >
                      <col.icono className="w-4 h-4" />
                      <div>
                        <p className="font-medium text-sm">{col.nombre}</p>
                        <p className="text-xs text-slate-500">{col.descripcion}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-4">
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <Search className="w-5 h-5 text-purple-600" />
                  Filtro (JSON)
                </h3>
                <textarea
                  value={queryFilter}
                  onChange={(e) => setQueryFilter(e.target.value)}
                  className="w-full h-32 p-2 border rounded-lg font-mono text-sm bg-slate-50"
                  placeholder='{"municipio": "Ábrego"}'
                />
                <div className="mt-3">
                  <Label className="text-xs text-slate-600">Límite de resultados</Label>
                  <Input
                    type="number"
                    value={queryLimit}
                    onChange={(e) => setQueryLimit(parseInt(e.target.value) || 10)}
                    min={1}
                    max={100}
                    className="mt-1"
                  />
                </div>
                <Button 
                  onClick={ejecutarConsulta} 
                  disabled={loading}
                  className="w-full mt-4 bg-purple-600 hover:bg-purple-700"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  Ejecutar Consulta
                </Button>
              </div>

              {/* Ejemplos de filtros */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h4 className="font-medium text-amber-800 mb-2">Ejemplos de filtros:</h4>
                <div className="space-y-2 text-xs font-mono">
                  <button 
                    onClick={() => setQueryFilter('{"municipio": "Ábrego"}')}
                    className="block w-full text-left p-2 bg-white rounded hover:bg-amber-100"
                  >
                    {`{"municipio": "Ábrego"}`}
                  </button>
                  <button 
                    onClick={() => setQueryFilter('{"creado_en_plataforma": true}')}
                    className="block w-full text-left p-2 bg-white rounded hover:bg-amber-100"
                  >
                    {`{"creado_en_plataforma": true}`}
                  </button>
                  <button 
                    onClick={() => setQueryFilter('{"role": "gestor"}')}
                    className="block w-full text-left p-2 bg-white rounded hover:bg-amber-100"
                  >
                    {`{"role": "gestor"}`}
                  </button>
                </div>
              </div>
            </div>

            {/* Resultados */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-slate-800">
                    Resultados ({totalResultados} total, mostrando {resultados.length})
                  </h3>
                  {resultados.length > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => copiarJSON(resultados)}
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Copiar Todo
                    </Button>
                  )}
                </div>

                {resultados.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Ejecuta una consulta para ver resultados</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {resultados.map((item, index) => (
                      <div key={index} className="border rounded-lg overflow-hidden">
                        <div
                          onClick={() => toggleExpandRow(index)}
                          className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            {expandedRows[index] ? (
                              <ChevronDown className="w-4 h-4 text-slate-500" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-500" />
                            )}
                            <span className="font-medium text-sm text-slate-700">
                              {item.codigo_predial_nacional || item.email || item.radicado || item.id || `Registro ${index + 1}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">
                              {Object.keys(item).length} campos
                            </span>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); copiarJSON(item); }}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        {expandedRows[index] && (
                          <pre className="p-3 bg-slate-900 text-green-400 text-xs overflow-x-auto max-h-64">
                            {JSON.stringify(item, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab: Pruebas Sandbox */}
        {activeTab === 'pruebas' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-semibold text-slate-800 text-lg">Predios de Prueba (Sandbox)</h3>
                  <p className="text-sm text-slate-500">Estos datos NO afectan la base de datos de producción</p>
                </div>
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

              {sandboxData.length === 0 ? (
                <div className="text-center py-12 text-slate-500 border-2 border-dashed rounded-xl">
                  <Play className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No hay datos en el Sandbox</p>
                  <p className="text-sm">Crea predios de prueba para experimentar</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-slate-50">
                        <th className="text-left p-3 text-sm font-medium text-slate-600">Código Predial</th>
                        <th className="text-left p-3 text-sm font-medium text-slate-600">Municipio</th>
                        <th className="text-left p-3 text-sm font-medium text-slate-600">Propietario</th>
                        <th className="text-left p-3 text-sm font-medium text-slate-600">Área Terreno</th>
                        <th className="text-left p-3 text-sm font-medium text-slate-600">Avalúo</th>
                        <th className="text-center p-3 text-sm font-medium text-slate-600">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sandboxData.map((predio, index) => (
                        <tr key={index} className="border-b hover:bg-slate-50">
                          <td className="p-3 font-mono text-sm">{predio.codigo_predial_nacional}</td>
                          <td className="p-3 text-sm">{predio.municipio}</td>
                          <td className="p-3 text-sm">{predio.nombre_propietario}</td>
                          <td className="p-3 text-sm">{predio.area_terreno} m²</td>
                          <td className="p-3 text-sm">${predio.avaluo?.toLocaleString('es-CO')}</td>
                          <td className="p-3 text-center">
                            <div className="flex justify-center gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => copiarJSON(predio)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => eliminarPredioSandbox(predio.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Info de seguridad */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-emerald-800">Datos Aislados</h4>
                <p className="text-sm text-emerald-700">
                  Todos los datos creados en este Sandbox se almacenan en la colección <code className="bg-emerald-100 px-1 rounded">predios_sandbox</code>, 
                  completamente separada de los datos de producción. Puedes experimentar libremente.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Editor de Plantillas de Resolución */}
        {activeTab === 'plantillas' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Panel izquierdo: Editor de textos */}
            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-slate-800 text-lg flex items-center gap-2">
                    <FileEdit className="w-5 h-5 text-purple-600" />
                    Editar Plantilla de Resolución
                  </h3>
                  <div className="flex gap-2">
                    {plantillaGuardada && (
                      <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                        Plantilla guardada
                      </span>
                    )}
                    <Button 
                      onClick={guardarPlantilla} 
                      disabled={guardandoPlantilla}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {guardandoPlantilla ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Guardar Plantilla
                    </Button>
                  </div>
                </div>

                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                  {/* Preámbulo */}
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Preámbulo</Label>
                    <Textarea
                      value={plantilla.preambulo}
                      onChange={(e) => setPlantilla({...plantilla, preambulo: e.target.value})}
                      rows={3}
                      className="mt-1"
                    />
                  </div>

                  {/* Considerando 1 */}
                  <div>
                    <Label className="text-sm font-medium text-slate-700">
                      Considerando 1 
                      <span className="text-xs text-slate-400 ml-2">Variables: {'{tipo_tramite}'}, {'{radicado}'}</span>
                    </Label>
                    <Textarea
                      value={plantilla.considerando_1}
                      onChange={(e) => setPlantilla({...plantilla, considerando_1: e.target.value})}
                      rows={2}
                      className="mt-1"
                    />
                  </div>

                  {/* Considerando 3 */}
                  <div>
                    <Label className="text-sm font-medium text-slate-700">
                      Considerando 3 
                      <span className="text-xs text-slate-400 ml-2">Variables: {'{codigo_catastral}'}, {'{npn}'}</span>
                    </Label>
                    <Textarea
                      value={plantilla.considerando_3}
                      onChange={(e) => setPlantilla({...plantilla, considerando_3: e.target.value})}
                      rows={2}
                      className="mt-1"
                    />
                  </div>

                  {/* Considerando final */}
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Considerando Final</Label>
                    <Textarea
                      value={plantilla.considerando_final}
                      onChange={(e) => setPlantilla({...plantilla, considerando_final: e.target.value})}
                      rows={3}
                      className="mt-1"
                    />
                  </div>

                  {/* Artículos */}
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Artículo 2</Label>
                      <Input
                        value={plantilla.articulo_2}
                        onChange={(e) => setPlantilla({...plantilla, articulo_2: e.target.value})}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">
                        Artículo 3 
                        <span className="text-xs text-slate-400 ml-2">Variable: {'{vigencia_fiscal}'}</span>
                      </Label>
                      <Input
                        value={plantilla.articulo_3}
                        onChange={(e) => setPlantilla({...plantilla, articulo_3: e.target.value})}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Artículo 4</Label>
                      <Input
                        value={plantilla.articulo_4}
                        onChange={(e) => setPlantilla({...plantilla, articulo_4: e.target.value})}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {/* Cierre y firmante */}
                  <div className="border-t pt-4 mt-4">
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <Label className="text-sm font-medium text-slate-700">Cierre</Label>
                        <Input
                          value={plantilla.cierre}
                          onChange={(e) => setPlantilla({...plantilla, cierre: e.target.value})}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-slate-700">Nombre del Firmante</Label>
                        <Input
                          value={plantilla.firmante_nombre}
                          onChange={(e) => setPlantilla({...plantilla, firmante_nombre: e.target.value})}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-slate-700">Cargo del Firmante</Label>
                        <Input
                          value={plantilla.firmante_cargo}
                          onChange={(e) => setPlantilla({...plantilla, firmante_cargo: e.target.value})}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Panel derecho: Vista previa y generación */}
            <div className="space-y-4">
              {/* Selector de predio para prueba */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Building className="w-5 h-5 text-purple-600" />
                  Datos de Prueba
                </h3>
                
                <div className="space-y-4">
                  {/* Seleccionar predio */}
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Predio de Prueba</Label>
                    <Select
                      value={predioSeleccionado?.id || ''}
                      onValueChange={(value) => {
                        const predio = prediosPrueba.find(p => p.id === value);
                        setPredioSeleccionado(predio || null);
                      }}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Seleccionar predio..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ejemplo">-- Usar datos de ejemplo --</SelectItem>
                        {prediosPrueba.map(predio => (
                          <SelectItem key={predio.id} value={predio.id}>
                            {predio.codigo_predial_nacional?.substring(0, 15)}... - {predio.municipio}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {predioSeleccionado && (
                      <div className="mt-2 p-2 bg-slate-50 rounded text-xs">
                        <p><strong>Propietario:</strong> {predioSeleccionado.nombre_propietario || predioSeleccionado.propietarios?.[0]?.nombre_propietario}</p>
                        <p><strong>Dirección:</strong> {predioSeleccionado.direccion}</p>
                      </div>
                    )}
                  </div>

                  {/* Tipo de trámite */}
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Tipo de Trámite</Label>
                    <Select value={tipoTramite} onValueChange={setTipoTramite}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cambio de Propietario">Cambio de Propietario</SelectItem>
                        <SelectItem value="Cambio de Dirección">Cambio de Dirección</SelectItem>
                        <SelectItem value="Mutación de Primera">Mutación de Primera</SelectItem>
                        <SelectItem value="Mutación de Segunda">Mutación de Segunda</SelectItem>
                        <SelectItem value="Rectificación de Área">Rectificación de Área</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Radicado */}
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Radicado (opcional)</Label>
                    <Input
                      value={radicadoPrueba}
                      onChange={(e) => setRadicadoPrueba(e.target.value)}
                      placeholder="RASMGC-XXXX-DD-MM-AAAA"
                      className="mt-1"
                    />
                  </div>

                  {/* Propietarios nuevos */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label className="text-sm font-medium text-slate-700">Propietarios Nuevos</Label>
                      <Button variant="ghost" size="sm" onClick={agregarPropietario}>
                        <Plus className="w-4 h-4 mr-1" /> Agregar
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {propietariosNuevos.map((prop, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            placeholder="Nombre completo"
                            value={prop.nombre}
                            onChange={(e) => actualizarPropietario(index, 'nombre', e.target.value)}
                            className="flex-1"
                          />
                          <Input
                            placeholder="Documento"
                            value={prop.documento}
                            onChange={(e) => actualizarPropietario(index, 'documento', e.target.value)}
                            className="w-32"
                          />
                          {propietariosNuevos.length > 1 && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => eliminarPropietario(index)}
                              className="text-red-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={generarPdfPrueba} 
                  disabled={generandoPdf}
                  className="w-full mt-4 bg-purple-600 hover:bg-purple-700"
                >
                  {generandoPdf ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generando PDF...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
                      Generar PDF de Prueba
                    </>
                  )}
                </Button>
              </div>

              {/* Vista previa del PDF */}
              {pdfUrl && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                      <Eye className="w-5 h-5 text-purple-600" />
                      Vista Previa
                    </h3>
                    <a 
                      href={pdfUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-purple-600 hover:text-purple-700 text-sm flex items-center gap-1"
                    >
                      <Download className="w-4 h-4" />
                      Descargar PDF
                    </a>
                  </div>
                  <div className="border rounded-lg overflow-hidden bg-slate-100">
                    <iframe
                      src={pdfUrl}
                      className="w-full h-[500px]"
                      title="Vista previa de resolución"
                    />
                  </div>
                </div>
              )}

              {/* Información */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-800">Modo de Prueba</h4>
                  <p className="text-sm text-amber-700">
                    Los PDFs generados aquí son de prueba con número de resolución "XXXX". 
                    El número real se asignará automáticamente al aprobar cambios en producción.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Crear Predio de Prueba */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-purple-600" />
                Crear Predio de Prueba
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Código Predial Nacional</Label>
                <Input
                  value={sandboxFormData.codigo_predial_nacional}
                  onChange={(e) => setSandboxFormData({...sandboxFormData, codigo_predial_nacional: e.target.value})}
                  placeholder="54003010100000010001000000000"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                    placeholder="Juan Pérez"
                  />
                </div>
              </div>
              <div>
                <Label>Dirección</Label>
                <Input
                  value={sandboxFormData.direccion}
                  onChange={(e) => setSandboxFormData({...sandboxFormData, direccion: e.target.value})}
                  placeholder="Calle 10 # 5-20"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Área Terreno (m²)</Label>
                  <Input
                    type="number"
                    value={sandboxFormData.area_terreno}
                    onChange={(e) => setSandboxFormData({...sandboxFormData, area_terreno: e.target.value})}
                    placeholder="100"
                  />
                </div>
                <div>
                  <Label>Área Construida (m²)</Label>
                  <Input
                    type="number"
                    value={sandboxFormData.area_construida}
                    onChange={(e) => setSandboxFormData({...sandboxFormData, area_construida: e.target.value})}
                    placeholder="80"
                  />
                </div>
                <div>
                  <Label>Avalúo</Label>
                  <Input
                    type="number"
                    value={sandboxFormData.avaluo}
                    onChange={(e) => setSandboxFormData({...sandboxFormData, avaluo: e.target.value})}
                    placeholder="50000000"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancelar
                </Button>
                <Button onClick={crearPredioSandbox} className="bg-purple-600 hover:bg-purple-700">
                  Crear Predio
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
