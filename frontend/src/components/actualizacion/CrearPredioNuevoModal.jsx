import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  Plus, Trash2, MapPin, Users, Building2, FileText, 
  Save, Loader2, AlertCircle, CheckCircle 
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Constantes
const TIPOS_DOCUMENTO = [
  { value: 'C', label: 'Cédula de Ciudadanía' },
  { value: 'E', label: 'Cédula de Extranjería' },
  { value: 'N', label: 'NIT' },
  { value: 'T', label: 'Tarjeta de Identidad' },
  { value: 'P', label: 'Pasaporte' }
];

const DESTINOS_ECONOMICOS = [
  { value: 'A', label: 'A - Habitacional' },
  { value: 'B', label: 'B - Industrial' },
  { value: 'C', label: 'C - Comercial' },
  { value: 'D', label: 'D - Agropecuario' },
  { value: 'E', label: 'E - Minero' },
  { value: 'F', label: 'F - Cultural' },
  { value: 'G', label: 'G - Recreacional' },
  { value: 'H', label: 'H - Salubridad' },
  { value: 'I', label: 'I - Institucional' },
  { value: 'J', label: 'J - Educativo' },
  { value: 'K', label: 'K - Religioso' },
  { value: 'L', label: 'L - Agrícola' },
  { value: 'M', label: 'M - Pecuario' },
  { value: 'O', label: 'O - Forestal' },
  { value: 'P', label: 'P - Uso Público' },
  { value: 'Q', label: 'Q - Lote Urbanizable' },
  { value: 'R', label: 'R - Lote Urbanizado' }
];

const TIPOS_CONSTRUCCION = [
  { value: 'C', label: 'Convencional' },
  { value: 'NC', label: 'No Convencional' },
  { value: 'A', label: 'Anexo' }
];

const CrearPredioNuevoModal = ({ 
  isOpen, 
  onClose, 
  proyectoId, 
  municipio, 
  token,
  onSuccess 
}) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('ubicacion');
  
  // Estado del código predial
  const [codigoManual, setCodigoManual] = useState({
    zona: '00',
    sector: '00',
    comuna: '00',
    barrio: '00',
    manzana_vereda: '0000',
    terreno: '0001',
    condicion: '0',
    edificio: '00',
    piso: '00',
    unidad: '0000'
  });
  
  // Datos R1
  const [r1Data, setR1Data] = useState({
    direccion: '',
    destino_economico: 'D',
    area_terreno: '',
    area_construida: '',
    avaluo: ''
  });
  
  // Datos R2
  const [r2Data, setR2Data] = useState({
    matricula_inmobiliaria: ''
  });
  
  // Propietarios
  const [propietarios, setPropietarios] = useState([{
    tipo_documento: 'C',
    numero_documento: '',
    nombre_propietario: '',
    primer_nombre: '',
    segundo_nombre: '',
    primer_apellido: '',
    segundo_apellido: '',
    porcentaje: 100
  }]);
  
  // Zonas físicas (construcciones)
  const [zonasConstruction, setZonasConstruction] = useState([]);
  
  // Formato visita
  const [formatoVisita, setFormatoVisita] = useState({
    observaciones: '',
    fecha_visita: new Date().toISOString().split('T')[0]
  });
  
  // Prefijo del municipio
  const [prefijo, setPrefijo] = useState('00000');
  
  // Cargar prefijo del municipio
  useEffect(() => {
    const cargarPrefijo = async () => {
      try {
        const response = await fetch(`${API_URL}/api/estructura-codigo/${municipio}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setPrefijo(data.prefijo_fijo || '00000');
        }
      } catch (error) {
        console.error('Error cargando prefijo:', error);
      }
    };
    
    if (isOpen && municipio && token) {
      cargarPrefijo();
    }
  }, [isOpen, municipio, token]);
  
  // Construir código completo
  const construirCodigoCompleto = useCallback(() => {
    return `${prefijo}${codigoManual.zona}${codigoManual.sector}${codigoManual.comuna}${codigoManual.barrio}${codigoManual.manzana_vereda}${codigoManual.terreno}${codigoManual.condicion}${codigoManual.edificio}${codigoManual.piso}${codigoManual.unidad}`;
  }, [prefijo, codigoManual]);
  
  // Manejar cambio en código
  const handleCodigoChange = (field, value, maxLen) => {
    const numericValue = value.replace(/\D/g, '').slice(0, maxLen);
    setCodigoManual(prev => ({
      ...prev,
      [field]: numericValue.padStart(maxLen, '0')
    }));
  };
  
  // Agregar propietario
  const agregarPropietario = () => {
    setPropietarios(prev => [...prev, {
      tipo_documento: 'C',
      numero_documento: '',
      nombre_propietario: '',
      primer_nombre: '',
      segundo_nombre: '',
      primer_apellido: '',
      segundo_apellido: '',
      porcentaje: 0
    }]);
  };
  
  // Eliminar propietario
  const eliminarPropietario = (index) => {
    if (propietarios.length > 1) {
      setPropietarios(prev => prev.filter((_, i) => i !== index));
    }
  };
  
  // Actualizar propietario
  const updatePropietario = (index, field, value) => {
    setPropietarios(prev => prev.map((p, i) => {
      if (i !== index) return p;
      
      const updated = { ...p, [field]: value };
      
      // Auto-construir nombre completo si se modifican los nombres
      if (['primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido'].includes(field)) {
        const nombres = [
          updated.primer_nombre,
          updated.segundo_nombre,
          updated.primer_apellido,
          updated.segundo_apellido
        ].filter(Boolean).join(' ').toUpperCase();
        updated.nombre_propietario = nombres;
      }
      
      return updated;
    }));
  };
  
  // Agregar zona de construcción
  const agregarZonaConstruccion = () => {
    setZonasConstruction(prev => [...prev, {
      tipo_construccion: 'C',
      pisos: 1,
      habitaciones: 0,
      banos: 0,
      locales: 0,
      anio_construccion: '',
      area_construida: 0,
      puntaje: 0
    }]);
  };
  
  // Eliminar zona de construcción
  const eliminarZonaConstruccion = (index) => {
    setZonasConstruction(prev => prev.filter((_, i) => i !== index));
  };
  
  // Actualizar zona de construcción
  const updateZonaConstruccion = (index, field, value) => {
    setZonasConstruction(prev => prev.map((z, i) => 
      i === index ? { ...z, [field]: value } : z
    ));
  };
  
  // Guardar predio
  const handleGuardar = async () => {
    // Validaciones
    if (!r1Data.direccion.trim()) {
      toast.error('Debe ingresar la dirección del predio');
      setActiveTab('ubicacion');
      return;
    }
    
    if (propietarios.length === 0 || !propietarios[0].nombre_propietario.trim()) {
      toast.error('Debe ingresar al menos un propietario');
      setActiveTab('propietarios');
      return;
    }
    
    setLoading(true);
    
    try {
      const codigoCompleto = construirCodigoCompleto();
      
      const payload = {
        r1: {
          ...r1Data,
          zona: codigoManual.zona,
          sector: codigoManual.sector,
          comuna: codigoManual.comuna,
          barrio: codigoManual.barrio,
          manzana_vereda: codigoManual.manzana_vereda,
          terreno: codigoManual.terreno,
          condicion_predio: codigoManual.condicion,
          predio_horizontal: `${codigoManual.edificio}${codigoManual.piso}${codigoManual.unidad}`,
          area_terreno: parseFloat(r1Data.area_terreno) || 0,
          area_construida: parseFloat(r1Data.area_construida) || 0,
          avaluo: parseFloat(r1Data.avaluo) || 0
        },
        r2: r2Data,
        propietarios: propietarios.map(p => ({
          ...p,
          porcentaje: parseFloat(p.porcentaje) || 0
        })),
        zonas_fisicas: zonasConstruction.map(z => ({
          ...z,
          pisos: parseInt(z.pisos) || 1,
          habitaciones: parseInt(z.habitaciones) || 0,
          banos: parseInt(z.banos) || 0,
          locales: parseInt(z.locales) || 0,
          area_construida: parseFloat(z.area_construida) || 0,
          puntaje: parseFloat(z.puntaje) || 0
        })),
        formato_visita: formatoVisita
      };
      
      const response = await fetch(
        `${API_URL}/api/actualizacion/proyectos/${proyectoId}/predios-nuevos`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Error al crear el predio');
      }
      
      toast.success(
        <div>
          <p className="font-semibold">Predio creado exitosamente</p>
          <p className="text-sm">Código: {data.codigo_predial}</p>
          <p className="text-sm">Homologado: {data.codigo_homologado}</p>
        </div>
      );
      
      onSuccess && onSuccess(data);
      onClose();
      
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al crear el predio');
    } finally {
      setLoading(false);
    }
  };
  
  // Reset al cerrar
  const handleClose = () => {
    setCodigoManual({
      zona: '00',
      sector: '00',
      comuna: '00',
      barrio: '00',
      manzana_vereda: '0000',
      terreno: '0001',
      condicion: '0',
      edificio: '00',
      piso: '00',
      unidad: '0000'
    });
    setR1Data({
      direccion: '',
      destino_economico: 'D',
      area_terreno: '',
      area_construida: '',
      avaluo: ''
    });
    setR2Data({ matricula_inmobiliaria: '' });
    setPropietarios([{
      tipo_documento: 'C',
      numero_documento: '',
      nombre_propietario: '',
      primer_nombre: '',
      segundo_nombre: '',
      primer_apellido: '',
      segundo_apellido: '',
      porcentaje: 100
    }]);
    setZonasConstruction([]);
    setFormatoVisita({
      observaciones: '',
      fecha_visita: new Date().toISOString().split('T')[0]
    });
    setActiveTab('ubicacion');
    onClose();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Plus className="w-5 h-5 text-emerald-600" />
            Crear Predio Nuevo - {municipio}
          </DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 mb-4">
            <TabsTrigger value="ubicacion" className="flex items-center gap-1">
              <MapPin className="w-4 h-4" /> Ubicación
            </TabsTrigger>
            <TabsTrigger value="propietarios" className="flex items-center gap-1">
              <Users className="w-4 h-4" /> Propietarios
            </TabsTrigger>
            <TabsTrigger value="construcciones" className="flex items-center gap-1">
              <Building2 className="w-4 h-4" /> Construcciones
            </TabsTrigger>
            <TabsTrigger value="visita" className="flex items-center gap-1">
              <FileText className="w-4 h-4" /> Visita
            </TabsTrigger>
          </TabsList>
          
          {/* TAB: Ubicación y Código Predial */}
          <TabsContent value="ubicacion" className="space-y-4">
            {/* Código Predial */}
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Código Predial Nacional (30 dígitos)
              </h4>
              
              {/* Visualización del código */}
              <div className="bg-white p-3 rounded border mb-4 font-mono text-lg tracking-wider text-center">
                <span className="text-blue-600 font-bold">{prefijo}</span>
                <span className="text-emerald-600">{codigoManual.zona}</span>
                <span className="text-amber-600">{codigoManual.sector}</span>
                <span className="text-purple-600">{codigoManual.comuna}</span>
                <span className="text-pink-600">{codigoManual.barrio}</span>
                <span className="text-cyan-600">{codigoManual.manzana_vereda}</span>
                <span className="text-red-600 font-bold">{codigoManual.terreno}</span>
                <span className="text-orange-600">{codigoManual.condicion}</span>
                <span className="text-slate-500">{codigoManual.edificio}</span>
                <span className="text-slate-500">{codigoManual.piso}</span>
                <span className="text-slate-500">{codigoManual.unidad}</span>
                <span className="text-xs text-slate-500 ml-2">({construirCodigoCompleto().length}/30)</span>
              </div>
              
              {/* Campos del código */}
              <div className="grid grid-cols-6 gap-2 mb-3">
                <div className="bg-blue-100 p-2 rounded">
                  <Label className="text-xs text-blue-700">Dpto+Mpio (1-5)</Label>
                  <Input value={prefijo} disabled className="font-mono bg-blue-50 text-blue-800 font-bold text-center" />
                </div>
                <div>
                  <Label className="text-xs text-emerald-700">Zona (6-7)</Label>
                  <Input 
                    value={codigoManual.zona}
                    onChange={(e) => handleCodigoChange('zona', e.target.value, 2)}
                    maxLength={2}
                    className="font-mono text-center"
                    placeholder="00"
                  />
                  <span className="text-xs text-slate-400">00=Rural</span>
                </div>
                <div>
                  <Label className="text-xs text-amber-700">Sector (8-9)</Label>
                  <Input 
                    value={codigoManual.sector}
                    onChange={(e) => handleCodigoChange('sector', e.target.value, 2)}
                    maxLength={2}
                    className="font-mono text-center"
                  />
                </div>
                <div>
                  <Label className="text-xs text-purple-700">Comuna (10-11)</Label>
                  <Input 
                    value={codigoManual.comuna}
                    onChange={(e) => handleCodigoChange('comuna', e.target.value, 2)}
                    maxLength={2}
                    className="font-mono text-center"
                  />
                </div>
                <div>
                  <Label className="text-xs text-pink-700">Barrio (12-13)</Label>
                  <Input 
                    value={codigoManual.barrio}
                    onChange={(e) => handleCodigoChange('barrio', e.target.value, 2)}
                    maxLength={2}
                    className="font-mono text-center"
                  />
                </div>
                <div>
                  <Label className="text-xs text-cyan-700">Manzana (14-17)</Label>
                  <Input 
                    value={codigoManual.manzana_vereda}
                    onChange={(e) => handleCodigoChange('manzana_vereda', e.target.value, 4)}
                    maxLength={4}
                    className="font-mono text-center"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-5 gap-2">
                <div className="bg-red-50 p-2 rounded border border-red-200">
                  <Label className="text-xs text-red-700 font-semibold">Terreno (18-21) *</Label>
                  <Input 
                    value={codigoManual.terreno}
                    onChange={(e) => handleCodigoChange('terreno', e.target.value, 4)}
                    maxLength={4}
                    className="font-mono font-bold text-red-700 text-center"
                  />
                </div>
                <div>
                  <Label className="text-xs text-orange-700">Condición (22)</Label>
                  <Select value={codigoManual.condicion} onValueChange={(v) => setCodigoManual(prev => ({...prev, condicion: v}))}>
                    <SelectTrigger className="font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 - NPH</SelectItem>
                      <SelectItem value="9">9 - PH</SelectItem>
                      <SelectItem value="8">8 - Condominio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Edificio (23-24)</Label>
                  <Input 
                    value={codigoManual.edificio}
                    onChange={(e) => handleCodigoChange('edificio', e.target.value, 2)}
                    maxLength={2}
                    className="font-mono text-center"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Piso (25-26)</Label>
                  <Input 
                    value={codigoManual.piso}
                    onChange={(e) => handleCodigoChange('piso', e.target.value, 2)}
                    maxLength={2}
                    className="font-mono text-center"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Unidad (27-30)</Label>
                  <Input 
                    value={codigoManual.unidad}
                    onChange={(e) => handleCodigoChange('unidad', e.target.value, 4)}
                    maxLength={4}
                    className="font-mono text-center"
                  />
                </div>
              </div>
            </div>
            
            {/* Datos R1 */}
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg space-y-3">
              <h4 className="font-semibold text-slate-700">Información del Predio</h4>
              
              <div>
                <Label>Dirección *</Label>
                <Input 
                  value={r1Data.direccion}
                  onChange={(e) => setR1Data(prev => ({...prev, direccion: e.target.value.toUpperCase()}))}
                  placeholder="VEREDA, SECTOR O DIRECCIÓN"
                  className="uppercase"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Destino Económico</Label>
                  <Select value={r1Data.destino_economico} onValueChange={(v) => setR1Data(prev => ({...prev, destino_economico: v}))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DESTINOS_ECONOMICOS.map(d => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Matrícula Inmobiliaria</Label>
                  <Input 
                    value={r2Data.matricula_inmobiliaria}
                    onChange={(e) => setR2Data(prev => ({...prev, matricula_inmobiliaria: e.target.value}))}
                    placeholder="Ej: 270-12345"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Área Terreno (m²)</Label>
                  <Input 
                    type="number"
                    value={r1Data.area_terreno}
                    onChange={(e) => setR1Data(prev => ({...prev, area_terreno: e.target.value}))}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Área Construida (m²)</Label>
                  <Input 
                    type="number"
                    value={r1Data.area_construida}
                    onChange={(e) => setR1Data(prev => ({...prev, area_construida: e.target.value}))}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Avalúo ($)</Label>
                  <Input 
                    type="number"
                    value={r1Data.avaluo}
                    onChange={(e) => setR1Data(prev => ({...prev, avaluo: e.target.value}))}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </TabsContent>
          
          {/* TAB: Propietarios */}
          <TabsContent value="propietarios" className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Propietarios ({propietarios.length})
              </h4>
              <Button variant="outline" size="sm" onClick={agregarPropietario}>
                <Plus className="w-4 h-4 mr-1" /> Agregar
              </Button>
            </div>
            
            {propietarios.map((prop, index) => (
              <div key={index} className="bg-slate-50 border rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-slate-600">Propietario {index + 1}</span>
                  {propietarios.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => eliminarPropietario(index)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Tipo Documento</Label>
                    <Select 
                      value={prop.tipo_documento} 
                      onValueChange={(v) => updatePropietario(index, 'tipo_documento', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_DOCUMENTO.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Número Documento</Label>
                    <Input 
                      value={prop.numero_documento}
                      onChange={(e) => updatePropietario(index, 'numero_documento', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">% Propiedad</Label>
                    <Input 
                      type="number"
                      value={prop.porcentaje}
                      onChange={(e) => updatePropietario(index, 'porcentaje', e.target.value)}
                      max={100}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">Primer Nombre *</Label>
                    <Input 
                      value={prop.primer_nombre}
                      onChange={(e) => updatePropietario(index, 'primer_nombre', e.target.value.toUpperCase())}
                      className="uppercase"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Segundo Nombre</Label>
                    <Input 
                      value={prop.segundo_nombre}
                      onChange={(e) => updatePropietario(index, 'segundo_nombre', e.target.value.toUpperCase())}
                      className="uppercase"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Primer Apellido *</Label>
                    <Input 
                      value={prop.primer_apellido}
                      onChange={(e) => updatePropietario(index, 'primer_apellido', e.target.value.toUpperCase())}
                      className="uppercase"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Segundo Apellido</Label>
                    <Input 
                      value={prop.segundo_apellido}
                      onChange={(e) => updatePropietario(index, 'segundo_apellido', e.target.value.toUpperCase())}
                      className="uppercase"
                    />
                  </div>
                </div>
                
                <div className="bg-white p-2 rounded border">
                  <Label className="text-xs text-slate-500">Nombre Completo (auto)</Label>
                  <p className="font-medium">{prop.nombre_propietario || '-'}</p>
                </div>
              </div>
            ))}
          </TabsContent>
          
          {/* TAB: Construcciones */}
          <TabsContent value="construcciones" className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Zonas de Construcción ({zonasConstruction.length})
              </h4>
              <Button variant="outline" size="sm" onClick={agregarZonaConstruccion}>
                <Plus className="w-4 h-4 mr-1" /> Agregar Zona
              </Button>
            </div>
            
            {zonasConstruction.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-lg border-2 border-dashed">
                <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500">No hay construcciones registradas</p>
                <p className="text-sm text-slate-400">Si el predio tiene construcciones, agréguelas aquí</p>
              </div>
            ) : (
              zonasConstruction.map((zona, index) => (
                <div key={index} className="bg-slate-50 border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-slate-600">Zona {index + 1}</span>
                    <Button variant="ghost" size="sm" onClick={() => eliminarZonaConstruccion(index)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs">Tipo</Label>
                      <Select 
                        value={zona.tipo_construccion}
                        onValueChange={(v) => updateZonaConstruccion(index, 'tipo_construccion', v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS_CONSTRUCCION.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Pisos</Label>
                      <Input 
                        type="number"
                        value={zona.pisos}
                        onChange={(e) => updateZonaConstruccion(index, 'pisos', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Área (m²)</Label>
                      <Input 
                        type="number"
                        value={zona.area_construida}
                        onChange={(e) => updateZonaConstruccion(index, 'area_construida', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Año Construcción</Label>
                      <Input 
                        type="number"
                        value={zona.anio_construccion}
                        onChange={(e) => updateZonaConstruccion(index, 'anio_construccion', e.target.value)}
                        placeholder="2020"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs">Habitaciones</Label>
                      <Input 
                        type="number"
                        value={zona.habitaciones}
                        onChange={(e) => updateZonaConstruccion(index, 'habitaciones', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Baños</Label>
                      <Input 
                        type="number"
                        value={zona.banos}
                        onChange={(e) => updateZonaConstruccion(index, 'banos', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Locales</Label>
                      <Input 
                        type="number"
                        value={zona.locales}
                        onChange={(e) => updateZonaConstruccion(index, 'locales', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Puntaje</Label>
                      <Input 
                        type="number"
                        value={zona.puntaje}
                        onChange={(e) => updateZonaConstruccion(index, 'puntaje', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
          
          {/* TAB: Visita */}
          <TabsContent value="visita" className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg space-y-4">
              <h4 className="font-semibold text-emerald-800 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Registro de Visita en Campo
              </h4>
              
              <div>
                <Label>Fecha de Visita</Label>
                <Input 
                  type="date"
                  value={formatoVisita.fecha_visita}
                  onChange={(e) => setFormatoVisita(prev => ({...prev, fecha_visita: e.target.value}))}
                />
              </div>
              
              <div>
                <Label>Observaciones</Label>
                <Textarea 
                  value={formatoVisita.observaciones}
                  onChange={(e) => setFormatoVisita(prev => ({...prev, observaciones: e.target.value}))}
                  placeholder="Registre las observaciones de la visita en campo..."
                  rows={4}
                />
              </div>
              
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                <p className="text-sm text-amber-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  El código homologado se asignará automáticamente al guardar el predio.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="mt-4 pt-4 border-t">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleGuardar} 
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Crear Predio
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CrearPredioNuevoModal;
