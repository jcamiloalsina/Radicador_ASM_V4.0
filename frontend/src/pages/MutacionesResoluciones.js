import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  FileText, Plus, Search, Download, History, 
  ArrowRight, X, Check, AlertCircle, Building,
  Users, MapPin, DollarSign, Calendar, Filter,
  ChevronDown, ChevronUp, Trash2, Edit
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Configuración de tipos de mutación
const TIPOS_MUTACION = {
  M1: { 
    codigo: 'M1', 
    nombre: 'Mutación Primera', 
    descripcion: 'Cambio de propietario o poseedor',
    color: 'bg-blue-100 text-blue-800',
    enabled: true
  },
  M2: { 
    codigo: 'M2', 
    nombre: 'Mutación Segunda', 
    descripcion: 'Englobe o Desengloble de terreno',
    color: 'bg-purple-100 text-purple-800',
    enabled: true
  },
  M3: { 
    codigo: 'M3', 
    nombre: 'Mutación Tercera', 
    descripcion: 'Modificación de construcción o destino económico',
    color: 'bg-amber-100 text-amber-800',
    enabled: false
  },
  M4: { 
    codigo: 'M4', 
    nombre: 'Mutación Cuarta', 
    descripcion: 'Auto estimación del avalúo catastral',
    color: 'bg-green-100 text-green-800',
    enabled: false
  },
  M5: { 
    codigo: 'M5', 
    nombre: 'Mutación Quinta', 
    descripcion: 'Inscripción o eliminación de predio',
    color: 'bg-red-100 text-red-800',
    enabled: false
  },
  M6: { 
    codigo: 'M6', 
    nombre: 'Mutación Sexta', 
    descripcion: 'Rectificación de área',
    color: 'bg-cyan-100 text-cyan-800',
    enabled: false
  },
  COMP: { 
    codigo: 'COMP', 
    nombre: 'Complementación', 
    descripcion: 'Complementación de información catastral',
    color: 'bg-slate-100 text-slate-800',
    enabled: false
  }
};

// Municipios disponibles
const MUNICIPIOS = [
  { codigo: '54003', nombre: 'Ábrego' },
  { codigo: '54223', nombre: 'El Carmen' },
  { codigo: '54128', nombre: 'Cachirá' },
  { codigo: '54172', nombre: 'Convención' },
  { codigo: '54239', nombre: 'El Tarra' },
  { codigo: '54245', nombre: 'El Zulia' },
  { codigo: '54250', nombre: 'González' },
  { codigo: '54261', nombre: 'Hacarí' },
  { codigo: '54344', nombre: 'La Esperanza' },
  { codigo: '54377', nombre: 'La Playa' },
  { codigo: '54553', nombre: 'Río de Oro' },
  { codigo: '54599', nombre: 'San Calixto' }
];

export default function MutacionesResoluciones() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('nueva');
  const [tipoMutacionSeleccionado, setTipoMutacionSeleccionado] = useState(null);
  const [showMutacionDialog, setShowMutacionDialog] = useState(false);
  
  // Estado para historial
  const [historialResoluciones, setHistorialResoluciones] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [filtroMunicipio, setFiltroMunicipio] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  
  // Estado para M2
  const [m2Data, setM2Data] = useState({
    subtipo: '', // 'englobe' o 'desengloble'
    municipio: '',
    radicado: '',
    solicitante: {
      nombre: '',
      documento: '',
      tipo_documento: 'C'
    },
    predios_cancelados: [],
    predios_inscritos: [],
    documentos_soporte: []
  });
  
  // Estado para búsqueda de predios
  const [searchPredio, setSearchPredio] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchingPredios, setSearchingPredios] = useState(false);
  
  // Estado para generación
  const [generando, setGenerando] = useState(false);

  // Cargar historial de resoluciones
  const fetchHistorial = useCallback(async () => {
    setLoadingHistorial(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (filtroMunicipio) params.append('codigo_municipio', filtroMunicipio);
      
      const response = await axios.get(`${API}/resoluciones/historial?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setHistorialResoluciones(response.data.resoluciones || []);
      }
    } catch (error) {
      console.error('Error cargando historial:', error);
    } finally {
      setLoadingHistorial(false);
    }
  }, [filtroMunicipio]);

  useEffect(() => {
    if (activeTab === 'historial') {
      fetchHistorial();
    }
  }, [activeTab, fetchHistorial]);

  // Buscar predios
  const buscarPredios = async () => {
    if (!searchPredio || searchPredio.length < 3) {
      toast.error('Ingrese al menos 3 caracteres para buscar');
      return;
    }
    
    setSearchingPredios(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/predios/buscar`, {
        params: { 
          q: searchPredio,
          municipio: m2Data.municipio,
          limit: 20
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSearchResults(response.data.predios || []);
    } catch (error) {
      toast.error('Error buscando predios');
    } finally {
      setSearchingPredios(false);
    }
  };

  // Agregar predio a cancelados (origen)
  const agregarPredioOrigen = (predio) => {
    // Verificar que no esté ya agregado
    if (m2Data.predios_cancelados.find(p => p.id === predio.id)) {
      toast.error('Este predio ya está en la lista');
      return;
    }
    
    const predioFormateado = {
      id: predio.id,
      codigo_predial: predio.codigo_predial_nacional || predio.numero_predio,
      npn: predio.codigo_predial_nacional,
      codigo_homologado: predio.codigo_homologado || '',
      direccion: predio.direccion || '',
      destino_economico: predio.destino_economico || 'A',
      area_terreno: predio.area_terreno || 0,
      area_construida: predio.area_construida || 0,
      avaluo: predio.avaluo || 0,
      matricula_inmobiliaria: predio.matricula_inmobiliaria || '',
      propietarios: predio.propietarios || [{
        nombre_propietario: predio.nombre_propietario || '',
        tipo_documento: predio.tipo_documento || 'C',
        numero_documento: predio.numero_documento || ''
      }]
    };
    
    setM2Data(prev => ({
      ...prev,
      predios_cancelados: [...prev.predios_cancelados, predioFormateado]
    }));
    
    // Limpiar búsqueda
    setSearchPredio('');
    setSearchResults([]);
    toast.success('Predio agregado a la lista de cancelación');
  };

  // Eliminar predio de cancelados
  const eliminarPredioOrigen = (index) => {
    setM2Data(prev => ({
      ...prev,
      predios_cancelados: prev.predios_cancelados.filter((_, i) => i !== index)
    }));
  };

  // Agregar nuevo predio inscrito (destino)
  const agregarPredioDestino = () => {
    const nuevoPredio = {
      id: `nuevo_${Date.now()}`,
      codigo_predial: '',
      npn: '',
      codigo_homologado: '',
      direccion: '',
      destino_economico: 'R',
      area_terreno: 0,
      area_construida: 0,
      avaluo: 0,
      matricula_inmobiliaria: '',
      propietarios: [{
        nombre_propietario: '',
        tipo_documento: 'C',
        numero_documento: ''
      }],
      // Historial de avalúos
      inscripcion_catastral: { valor: 0, fecha: '' },
      decretos: []
    };
    
    setM2Data(prev => ({
      ...prev,
      predios_inscritos: [...prev.predios_inscritos, nuevoPredio]
    }));
  };

  // Actualizar predio inscrito
  const actualizarPredioDestino = (index, campo, valor) => {
    setM2Data(prev => {
      const nuevosInscritos = [...prev.predios_inscritos];
      if (campo.includes('.')) {
        const [parent, child] = campo.split('.');
        nuevosInscritos[index] = {
          ...nuevosInscritos[index],
          [parent]: {
            ...nuevosInscritos[index][parent],
            [child]: valor
          }
        };
      } else {
        nuevosInscritos[index] = {
          ...nuevosInscritos[index],
          [campo]: valor
        };
      }
      return { ...prev, predios_inscritos: nuevosInscritos };
    });
  };

  // Eliminar predio inscrito
  const eliminarPredioDestino = (index) => {
    setM2Data(prev => ({
      ...prev,
      predios_inscritos: prev.predios_inscritos.filter((_, i) => i !== index)
    }));
  };

  // Generar resolución M2
  const generarResolucionM2 = async () => {
    // Validaciones
    if (!m2Data.subtipo) {
      toast.error('Seleccione el tipo: Englobe o Desengloble');
      return;
    }
    if (!m2Data.municipio) {
      toast.error('Seleccione el municipio');
      return;
    }
    if (m2Data.predios_cancelados.length === 0) {
      toast.error('Agregue al menos un predio a cancelar');
      return;
    }
    if (m2Data.predios_inscritos.length === 0) {
      toast.error('Agregue al menos un predio a inscribir');
      return;
    }
    
    setGenerando(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/resoluciones/generar-m2`, m2Data, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        toast.success(`Resolución ${response.data.numero_resolucion} generada exitosamente`);
        
        // Abrir PDF en nueva pestaña
        if (response.data.pdf_url) {
          window.open(response.data.pdf_url, '_blank');
        }
        
        // Limpiar formulario
        resetFormularioM2();
        setShowMutacionDialog(false);
        setTipoMutacionSeleccionado(null);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error generando resolución');
    } finally {
      setGenerando(false);
    }
  };

  // Reset formulario M2
  const resetFormularioM2 = () => {
    setM2Data({
      subtipo: '',
      municipio: '',
      radicado: '',
      solicitante: { nombre: '', documento: '', tipo_documento: 'C' },
      predios_cancelados: [],
      predios_inscritos: [],
      documentos_soporte: []
    });
    setSearchPredio('');
    setSearchResults([]);
  };

  // Renderizar selector de tipo de mutación
  const renderSelectorTipo = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Object.values(TIPOS_MUTACION).map((tipo) => (
        <Card 
          key={tipo.codigo}
          data-testid={`mutacion-card-${tipo.codigo}`}
          className={`cursor-pointer transition-all hover:shadow-lg ${
            !tipo.enabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-emerald-500'
          }`}
          onClick={() => {
            if (tipo.enabled) {
              setTipoMutacionSeleccionado(tipo);
              setShowMutacionDialog(true);
            }
          }}
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <Badge className={tipo.color}>{tipo.codigo}</Badge>
                <h3 className="font-semibold text-lg mt-2">{tipo.nombre}</h3>
                <p className="text-sm text-slate-600 mt-1">{tipo.descripcion}</p>
              </div>
              {tipo.enabled ? (
                <ArrowRight className="w-5 h-5 text-emerald-600" />
              ) : (
                <Badge variant="outline" className="text-xs">Próximamente</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  // Renderizar formulario M2
  const renderFormularioM2 = () => (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
      {/* Tipo de M2 */}
      <div className="grid grid-cols-2 gap-4">
        <Button
          variant={m2Data.subtipo === 'desengloble' ? 'default' : 'outline'}
          className={m2Data.subtipo === 'desengloble' ? 'bg-purple-600 hover:bg-purple-700' : ''}
          onClick={() => setM2Data(prev => ({ ...prev, subtipo: 'desengloble' }))}
        >
          <ChevronDown className="w-4 h-4 mr-2" />
          Desengloble (División)
        </Button>
        <Button
          variant={m2Data.subtipo === 'englobe' ? 'default' : 'outline'}
          className={m2Data.subtipo === 'englobe' ? 'bg-purple-600 hover:bg-purple-700' : ''}
          onClick={() => setM2Data(prev => ({ ...prev, subtipo: 'englobe' }))}
        >
          <ChevronUp className="w-4 h-4 mr-2" />
          Englobe (Fusión)
        </Button>
      </div>

      {/* Municipio y Radicado */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Municipio *</Label>
          <Select 
            value={m2Data.municipio} 
            onValueChange={(v) => setM2Data(prev => ({ ...prev, municipio: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar municipio" />
            </SelectTrigger>
            <SelectContent>
              {MUNICIPIOS.map(m => (
                <SelectItem key={m.codigo} value={m.codigo}>{m.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Número de Radicado</Label>
          <Input
            value={m2Data.radicado}
            onChange={(e) => setM2Data(prev => ({ ...prev, radicado: e.target.value }))}
            placeholder="Ej: RASOGC-3773-28-08-2024"
          />
        </div>
      </div>

      {/* Solicitante */}
      <Card className="border-slate-200">
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="w-4 h-4" />
            Datos del Solicitante
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Label className="text-xs">Nombre Completo</Label>
              <Input
                value={m2Data.solicitante.nombre}
                onChange={(e) => setM2Data(prev => ({
                  ...prev,
                  solicitante: { ...prev.solicitante, nombre: e.target.value.toUpperCase() }
                }))}
                placeholder="NOMBRE COMPLETO"
              />
            </div>
            <div>
              <Label className="text-xs">Cédula</Label>
              <Input
                value={m2Data.solicitante.documento}
                onChange={(e) => setM2Data(prev => ({
                  ...prev,
                  solicitante: { ...prev.solicitante, documento: e.target.value }
                }))}
                placeholder="12345678"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Predios a Cancelar (Origen) */}
      <Card className="border-red-200 bg-red-50/30">
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2 text-red-800">
            <X className="w-4 h-4" />
            Predios a CANCELAR ({m2Data.predios_cancelados.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 space-y-3">
          {/* Buscador */}
          <div className="flex gap-2">
            <Input
              value={searchPredio}
              onChange={(e) => setSearchPredio(e.target.value)}
              placeholder="Buscar por código predial, matrícula o propietario..."
              onKeyDown={(e) => e.key === 'Enter' && buscarPredios()}
            />
            <Button onClick={buscarPredios} disabled={searchingPredios}>
              <Search className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Resultados de búsqueda */}
          {searchResults.length > 0 && (
            <div className="border rounded-lg max-h-40 overflow-y-auto">
              {searchResults.map((predio, idx) => (
                <div 
                  key={idx}
                  className="p-2 hover:bg-slate-100 cursor-pointer border-b last:border-b-0 flex justify-between items-center"
                  onClick={() => agregarPredioOrigen(predio)}
                >
                  <div>
                    <p className="font-medium text-sm">{predio.codigo_predial_nacional || predio.numero_predio}</p>
                    <p className="text-xs text-slate-600">{predio.direccion} - {predio.nombre_propietario}</p>
                  </div>
                  <Plus className="w-4 h-4 text-emerald-600" />
                </div>
              ))}
            </div>
          )}
          
          {/* Lista de predios agregados */}
          {m2Data.predios_cancelados.map((predio, idx) => (
            <div key={idx} className="bg-white p-3 rounded-lg border border-red-200">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{predio.codigo_predial}</p>
                  <p className="text-xs text-slate-600">{predio.direccion}</p>
                  <p className="text-xs text-slate-500">
                    Área: {predio.area_terreno} m² | Matrícula: {predio.matricula_inmobiliaria}
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => eliminarPredioOrigen(idx)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Predios a Inscribir (Destino) */}
      <Card className="border-emerald-200 bg-emerald-50/30">
        <CardHeader className="py-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-sm flex items-center gap-2 text-emerald-800">
              <Check className="w-4 h-4" />
              Predios a INSCRIBIR ({m2Data.predios_inscritos.length})
            </CardTitle>
            <Button size="sm" onClick={agregarPredioDestino} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-1" /> Agregar Predio
            </Button>
          </div>
        </CardHeader>
        <CardContent className="py-2 space-y-4">
          {m2Data.predios_inscritos.map((predio, idx) => (
            <div key={idx} className="bg-white p-4 rounded-lg border border-emerald-200 space-y-3">
              <div className="flex justify-between items-center">
                <Badge className="bg-emerald-100 text-emerald-800">Predio {idx + 1}</Badge>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => eliminarPredioDestino(idx)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Código Predial (20 dígitos)</Label>
                  <Input
                    value={predio.codigo_predial}
                    onChange={(e) => actualizarPredioDestino(idx, 'codigo_predial', e.target.value)}
                    placeholder="54003010100320136000"
                    maxLength={20}
                  />
                </div>
                <div>
                  <Label className="text-xs">NPN (30 dígitos)</Label>
                  <Input
                    value={predio.npn}
                    onChange={(e) => actualizarPredioDestino(idx, 'npn', e.target.value)}
                    placeholder="540030101000000320136000000000"
                    maxLength={30}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Código Homologado</Label>
                  <Input
                    value={predio.codigo_homologado}
                    onChange={(e) => actualizarPredioDestino(idx, 'codigo_homologado', e.target.value)}
                    placeholder="BPP0001BFAD"
                  />
                </div>
                <div>
                  <Label className="text-xs">Matrícula Inmobiliaria</Label>
                  <Input
                    value={predio.matricula_inmobiliaria}
                    onChange={(e) => actualizarPredioDestino(idx, 'matricula_inmobiliaria', e.target.value)}
                    placeholder="270-88010"
                  />
                </div>
                <div>
                  <Label className="text-xs">Destino Económico</Label>
                  <Select 
                    value={predio.destino_economico}
                    onValueChange={(v) => actualizarPredioDestino(idx, 'destino_economico', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A - Habitacional</SelectItem>
                      <SelectItem value="B">B - Industrial</SelectItem>
                      <SelectItem value="C">C - Comercial</SelectItem>
                      <SelectItem value="D">D - Agropecuario</SelectItem>
                      <SelectItem value="E">E - Minero</SelectItem>
                      <SelectItem value="F">F - Cultural</SelectItem>
                      <SelectItem value="G">G - Recreacional</SelectItem>
                      <SelectItem value="H">H - Salubridad</SelectItem>
                      <SelectItem value="I">I - Institucional</SelectItem>
                      <SelectItem value="J">J - Educativo</SelectItem>
                      <SelectItem value="K">K - Religioso</SelectItem>
                      <SelectItem value="L">L - Agrícola</SelectItem>
                      <SelectItem value="M">M - Pecuario</SelectItem>
                      <SelectItem value="N">N - Forestal</SelectItem>
                      <SelectItem value="O">O - Uso Público</SelectItem>
                      <SelectItem value="P">P - Servicios Especiales</SelectItem>
                      <SelectItem value="R">R - Residencial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label className="text-xs">Dirección</Label>
                <Input
                  value={predio.direccion}
                  onChange={(e) => actualizarPredioDestino(idx, 'direccion', e.target.value.toUpperCase())}
                  placeholder="C 14 10 58 72 80 Lo 76 BR SAN ANTONIO"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Área Terreno (m²)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={predio.area_terreno}
                    onChange={(e) => actualizarPredioDestino(idx, 'area_terreno', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Área Construida (m²)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={predio.area_construida}
                    onChange={(e) => actualizarPredioDestino(idx, 'area_construida', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Avalúo ($)</Label>
                  <Input
                    type="number"
                    value={predio.avaluo}
                    onChange={(e) => actualizarPredioDestino(idx, 'avaluo', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
              
              {/* Propietario */}
              <div className="grid grid-cols-3 gap-3 pt-2 border-t">
                <div className="col-span-2">
                  <Label className="text-xs">Propietario</Label>
                  <Input
                    value={predio.propietarios[0]?.nombre_propietario || ''}
                    onChange={(e) => {
                      const nuevos = [...m2Data.predios_inscritos];
                      nuevos[idx].propietarios[0] = {
                        ...nuevos[idx].propietarios[0],
                        nombre_propietario: e.target.value.toUpperCase()
                      };
                      setM2Data(prev => ({ ...prev, predios_inscritos: nuevos }));
                    }}
                    placeholder="NOMBRE COMPLETO"
                  />
                </div>
                <div>
                  <Label className="text-xs">Cédula</Label>
                  <Input
                    value={predio.propietarios[0]?.numero_documento || ''}
                    onChange={(e) => {
                      const nuevos = [...m2Data.predios_inscritos];
                      nuevos[idx].propietarios[0] = {
                        ...nuevos[idx].propietarios[0],
                        numero_documento: e.target.value
                      };
                      setM2Data(prev => ({ ...prev, predios_inscritos: nuevos }));
                    }}
                    placeholder="12345678"
                  />
                </div>
              </div>
            </div>
          ))}
          
          {m2Data.predios_inscritos.length === 0 && (
            <p className="text-center text-slate-500 py-4">
              Haga clic en "Agregar Predio" para añadir predios a inscribir
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // Renderizar historial
  const renderHistorial = () => (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <Label className="text-xs">Filtrar por Municipio</Label>
          <Select value={filtroMunicipio} onValueChange={setFiltroMunicipio}>
            <SelectTrigger>
              <SelectValue placeholder="Todos los municipios" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              {MUNICIPIOS.map(m => (
                <SelectItem key={m.codigo} value={m.codigo}>{m.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={fetchHistorial}>
          <Filter className="w-4 h-4 mr-2" />
          Filtrar
        </Button>
      </div>
      
      {/* Lista de resoluciones */}
      {loadingHistorial ? (
        <div className="text-center py-8">Cargando historial...</div>
      ) : historialResoluciones.length === 0 ? (
        <div className="text-center py-8 text-slate-500">No hay resoluciones en el historial</div>
      ) : (
        <div className="space-y-2">
          {historialResoluciones.map((res, idx) => (
            <Card key={idx} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{res.numero_resolucion}</p>
                    <p className="text-sm text-slate-600">
                      {res.municipio} | {res.tipo_mutacion || 'M1'} | {res.fecha_resolucion || new Date(res.created_at).toLocaleDateString('es-CO')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge className={TIPOS_MUTACION[res.tipo_mutacion]?.color || 'bg-blue-100 text-blue-800'}>
                      {res.tipo_mutacion || 'M1'}
                    </Badge>
                    {res.pdf_path && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.open(res.pdf_path, '_blank')}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        PDF
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mutaciones y Resoluciones</h1>
          <p className="text-slate-600">Gestión centralizada de mutaciones catastrales</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="nueva" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nueva Mutación
          </TabsTrigger>
          <TabsTrigger value="historial" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Historial
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="nueva" className="mt-6">
          {renderSelectorTipo()}
        </TabsContent>
        
        <TabsContent value="historial" className="mt-6">
          {renderHistorial()}
        </TabsContent>
      </Tabs>

      {/* Dialog para crear mutación */}
      <Dialog open={showMutacionDialog} onOpenChange={setShowMutacionDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {tipoMutacionSeleccionado?.nombre} - {tipoMutacionSeleccionado?.descripcion}
            </DialogTitle>
          </DialogHeader>
          
          {tipoMutacionSeleccionado?.codigo === 'M2' && renderFormularioM2()}
          
          {tipoMutacionSeleccionado?.codigo === 'M1' && (
            <div className="py-8 text-center text-slate-500">
              <p>Para M1, use el formulario de edición de predio en Gestión de Predios.</p>
              <p className="text-sm mt-2">Esta funcionalidad se migrará próximamente a este módulo.</p>
            </div>
          )}
          
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => {
              setShowMutacionDialog(false);
              resetFormularioM2();
            }}>
              Cancelar
            </Button>
            {tipoMutacionSeleccionado?.codigo === 'M2' && (
              <Button 
                onClick={generarResolucionM2} 
                disabled={generando}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {generando ? 'Generando...' : 'Generar Resolución M2'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
