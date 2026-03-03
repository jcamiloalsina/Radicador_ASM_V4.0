import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  FileText, Save, Eye, Settings, RefreshCw, AlertTriangle,
  ChevronDown, ChevronRight, Loader2, Hash
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function ConfiguracionResoluciones() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('plantillas');
  
  // Estados para plantillas
  const [plantillas, setPlantillas] = useState([]);
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState(null);
  const [textoPlantilla, setTextoPlantilla] = useState('');
  const [firmante, setFirmante] = useState({ nombre: '', cargo: '' });
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false);
  const [generandoPreview, setGenerandoPreview] = useState(false);
  
  // Estados para configuración de numeración
  const [configuracion, setConfiguracion] = useState({
    año_actual: new Date().getFullYear(),
    ultimo_numero_2026: 0,
  });
  const [guardandoConfig, setGuardandoConfig] = useState(false);

  // Cargar plantillas
  const cargarPlantillas = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/resoluciones/plantillas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setPlantillas(response.data.plantillas);
        if (response.data.plantillas.length > 0 && !plantillaSeleccionada) {
          seleccionarPlantilla(response.data.plantillas[0]);
        }
      }
    } catch (error) {
      console.error('Error cargando plantillas:', error);
      toast.error('Error al cargar plantillas');
    }
  };

  // Cargar configuración
  const cargarConfiguracion = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/resoluciones/configuracion`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setConfiguracion(response.data.configuracion);
      }
    } catch (error) {
      console.error('Error cargando configuración:', error);
    }
  };

  const seleccionarPlantilla = (plantilla) => {
    setPlantillaSeleccionada(plantilla);
    setTextoPlantilla(plantilla.texto || '');
    setFirmante({
      nombre: plantilla.firmante_nombre || '',
      cargo: plantilla.firmante_cargo || ''
    });
  };

  const guardarPlantilla = async () => {
    if (!plantillaSeleccionada) return;
    
    setGuardandoPlantilla(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/resoluciones/plantillas/${plantillaSeleccionada.tipo}`, {
        texto: textoPlantilla,
        firmante_nombre: firmante.nombre,
        firmante_cargo: firmante.cargo
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Plantilla guardada correctamente');
      cargarPlantillas();
    } catch (error) {
      console.error('Error guardando plantilla:', error);
      toast.error('Error al guardar plantilla');
    } finally {
      setGuardandoPlantilla(false);
    }
  };

  const guardarConfiguracion = async () => {
    setGuardandoConfig(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/resoluciones/configuracion`, configuracion, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Configuración guardada correctamente');
    } catch (error) {
      console.error('Error guardando configuración:', error);
      toast.error('Error al guardar configuración');
    } finally {
      setGuardandoConfig(false);
    }
  };

  const generarPreviewPdf = async () => {
    if (!plantillaSeleccionada) return;
    
    setGenerandoPreview(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/resoluciones/generar-preview?tipo=${plantillaSeleccionada.tipo}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        const pdfBase64 = response.data.pdf_base64;
        const byteCharacters = atob(pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        toast.success('Preview generado exitosamente');
      }
    } catch (error) {
      console.error('Error generando preview:', error);
      toast.error('Error al generar preview del PDF');
    } finally {
      setGenerandoPreview(false);
    }
  };

  useEffect(() => {
    cargarPlantillas();
    cargarConfiguracion();
  }, []);

  // Verificar permisos
  if (user?.role !== 'administrador') {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-4" />
        <h2 className="text-xl font-semibold text-slate-700">Acceso Restringido</h2>
        <p className="text-slate-500">Solo los administradores pueden acceder a esta configuración.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="config-resoluciones-page">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
          <Settings className="w-7 h-7 text-purple-600" />
          Configuración de Resoluciones
        </h1>
        <p className="text-slate-500 mt-1">
          Configure las plantillas de texto legal y la numeración de resoluciones
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm mb-6">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('plantillas')}
            className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
              activeTab === 'plantillas'
                ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
            }`}
            data-testid="tab-plantillas"
          >
            <FileText className="w-5 h-5 inline-block mr-2" />
            Plantillas de Texto
          </button>
          <button
            onClick={() => setActiveTab('numeracion')}
            className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
              activeTab === 'numeracion'
                ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
            }`}
            data-testid="tab-numeracion"
          >
            <Hash className="w-5 h-5 inline-block mr-2" />
            Numeración 2026
          </button>
        </div>
      </div>

      {/* Tab: Plantillas */}
      {activeTab === 'plantillas' && (
        <div className="bg-white rounded-xl shadow-sm p-6" data-testid="plantillas-content">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              Plantillas de Resolución
            </h3>
            <Button variant="outline" onClick={cargarPlantillas} size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Recargar
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Lista de plantillas */}
            <div className="lg:col-span-1">
              <Label className="text-sm font-medium mb-3 block">Tipo de Resolución</Label>
              <div className="space-y-2">
                {plantillas.length === 0 ? (
                  <p className="text-sm text-slate-500">Cargando plantillas...</p>
                ) : (
                  plantillas.map(p => (
                    <button
                      key={p.tipo}
                      onClick={() => seleccionarPlantilla(p)}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                        plantillaSeleccionada?.tipo === p.tipo
                          ? 'bg-purple-50 border-purple-300 text-purple-700'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                      data-testid={`plantilla-btn-${p.tipo}`}
                    >
                      <div className="font-medium">{p.nombre}</div>
                      <div className="text-xs text-slate-500 mt-1">{p.descripcion}</div>
                    </button>
                  ))
                )}
              </div>

              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-amber-800">
                    <p className="font-medium">Variables Disponibles</p>
                    <ul className="mt-2 space-y-1">
                      <li><code>{'{tipo_tramite}'}</code></li>
                      <li><code>{'{radicado}'}</code></li>
                      <li><code>{'{matricula_inmobiliaria}'}</code></li>
                      <li><code>{'{npn}'}</code></li>
                      <li><code>{'{municipio}'}</code></li>
                      <li><code>{'{vigencia_fiscal}'}</code></li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Editor de plantilla */}
            <div className="lg:col-span-3">
              {plantillaSeleccionada ? (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium mb-2 block">
                      Texto de la Plantilla: {plantillaSeleccionada.nombre}
                    </Label>
                    <Textarea
                      value={textoPlantilla}
                      onChange={(e) => setTextoPlantilla(e.target.value)}
                      rows={14}
                      className="font-mono text-sm"
                      placeholder="Ingrese el texto legal de la resolución..."
                      data-testid="textarea-plantilla"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Nombre del Firmante</Label>
                      <Input
                        value={firmante.nombre}
                        onChange={(e) => setFirmante({...firmante, nombre: e.target.value})}
                        placeholder="NOMBRE COMPLETO"
                        data-testid="input-firmante-nombre"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Cargo del Firmante</Label>
                      <Input
                        value={firmante.cargo}
                        onChange={(e) => setFirmante({...firmante, cargo: e.target.value})}
                        placeholder="CARGO"
                        data-testid="input-firmante-cargo"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t">
                    <Button
                      onClick={guardarPlantilla}
                      disabled={guardandoPlantilla}
                      className="bg-purple-600 hover:bg-purple-700"
                      data-testid="btn-guardar-plantilla"
                    >
                      {guardandoPlantilla ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Guardar Plantilla
                    </Button>
                    <Button
                      variant="outline"
                      onClick={generarPreviewPdf}
                      disabled={generandoPreview}
                      data-testid="btn-preview-pdf"
                    >
                      {generandoPreview ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Eye className="w-4 h-4 mr-2" />
                      )}
                      Ver Preview PDF
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Seleccione una plantilla para editar</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Numeración */}
      {activeTab === 'numeracion' && (
        <div className="bg-white rounded-xl shadow-sm p-6" data-testid="numeracion-content">
          <div className="max-w-xl">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-6">
              <Hash className="w-5 h-5 text-purple-600" />
              Configuración de Numeración 2026
            </h3>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                <strong>Nota:</strong> Si ya ha generado resoluciones manualmente en 2026, 
                ingrese el último número utilizado. El sistema continuará desde el siguiente número.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Último número de resolución generado manualmente en 2026
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={configuracion.ultimo_numero_2026}
                  onChange={(e) => setConfiguracion({
                    ...configuracion,
                    ultimo_numero_2026: parseInt(e.target.value) || 0
                  })}
                  placeholder="Ej: 50"
                  className="max-w-xs"
                  data-testid="input-ultimo-numero"
                />
                <p className="text-xs text-slate-500 mt-2">
                  La próxima resolución automática será: <strong>RES-XXXX-{(configuracion.ultimo_numero_2026 || 0) + 1}</strong>
                </p>
              </div>

              <div className="pt-4 border-t">
                <Button
                  onClick={guardarConfiguracion}
                  disabled={guardandoConfig}
                  className="bg-purple-600 hover:bg-purple-700"
                  data-testid="btn-guardar-config"
                >
                  {guardandoConfig ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Guardar Configuración
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
