import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Badge } from '../ui/badge';
import { 
  Plus, Trash2, FileText, Search, MapPin,
  Save, Loader2, AlertCircle, CheckCircle 
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Catálogos
const TIPOS_DOCUMENTO = {
  'C': 'Cédula de Ciudadanía',
  'E': 'Cédula de Extranjería',
  'N': 'NIT',
  'T': 'Tarjeta de Identidad',
  'P': 'Pasaporte'
};

const DESTINOS_ECONOMICOS = {
  'A': 'Habitacional',
  'B': 'Industrial',
  'C': 'Comercial',
  'D': 'Agropecuario',
  'E': 'Minero',
  'F': 'Cultural',
  'G': 'Recreacional',
  'H': 'Salubridad',
  'I': 'Institucional',
  'J': 'Educativo',
  'K': 'Religioso',
  'L': 'Agrícola',
  'M': 'Pecuario',
  'O': 'Forestal',
  'P': 'Uso Público',
  'Q': 'Lote Urbanizable',
  'R': 'Lote Urbanizado'
};

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
  
  // Estructura del código
  const [estructuraCodigo, setEstructuraCodigo] = useState(null);
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
  
  // Código homologado
  const [siguienteCodigoHomologado, setSiguienteCodigoHomologado] = useState(null);
  
  // Info de terreno y manzana
  const [terrenoInfo, setTerrenoInfo] = useState(null);
  const [prediosEnManzana, setPrediosEnManzana] = useState([]);
  const [buscandoPrediosManzana, setBuscandoPrediosManzana] = useState(false);
  const [siguienteTerrenoSugerido, setSiguienteTerrenoSugerido] = useState('0001');
  const [verificacionCodigo, setVerificacionCodigo] = useState(null);
  
  // Datos del formulario
  const [formData, setFormData] = useState({
    direccion: '',
    destino_economico: 'D',
    matricula_inmobiliaria: '',
    avaluo: ''
  });
  
  // Propietarios
  const [propietarios, setPropietarios] = useState([{
    tipo_documento: 'C',
    numero_documento: '',
    primer_nombre: '',
    segundo_nombre: '',
    primer_apellido: '',
    segundo_apellido: '',
    estado: ''
  }]);
  
  // Zonas de terreno
  const [zonasTerreno, setZonasTerreno] = useState([{
    zona_fisica: '',
    zona_economica: '',
    area_terreno: 0
  }]);
  
  // Construcciones
  const [construcciones, setConstrucciones] = useState([]);
  
  // Cargar estructura del código al abrir
  useEffect(() => {
    const cargarEstructura = async () => {
      if (!isOpen || !municipio || !token) return;
      
      try {
        const response = await fetch(`${API_URL}/api/predios/estructura-codigo/${municipio}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setEstructuraCodigo(data);
        }
      } catch (error) {
        console.error('Error cargando estructura:', error);
      }
    };
    
    cargarEstructura();
  }, [isOpen, municipio, token]);
  
  // Cargar siguiente código homologado
  useEffect(() => {
    const cargarCodigoHomologado = async () => {
      if (!isOpen || !municipio || !token) return;
      
      try {
        const response = await fetch(`${API_URL}/api/codigos-homologados/siguiente/${municipio}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setSiguienteCodigoHomologado(data);
        }
      } catch (error) {
        console.error('Error cargando código homologado:', error);
      }
    };
    
    cargarCodigoHomologado();
  }, [isOpen, municipio, token]);
  
  // Buscar predios en manzana cuando cambia
  useEffect(() => {
    const buscarPrediosEnManzana = async () => {
      if (!estructuraCodigo || codigoManual.manzana_vereda === '0000') {
        setPrediosEnManzana([]);
        setSiguienteTerrenoSugerido('0001');
        return;
      }
      
      setBuscandoPrediosManzana(true);
      try {
        const codigoBase = `${estructuraCodigo.prefijo_fijo}${codigoManual.zona}${codigoManual.sector}${codigoManual.comuna}${codigoManual.barrio}${codigoManual.manzana_vereda}`;
        
        const response = await fetch(
          `${API_URL}/api/predios/buscar-por-manzana?codigo_base=${codigoBase}&municipio=${municipio}&limit=10`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        
        if (response.ok) {
          const data = await response.json();
          setPrediosEnManzana(data.predios || []);
          setSiguienteTerrenoSugerido(data.siguiente_terreno || '0001');
        }
      } catch (error) {
        console.error('Error buscando predios:', error);
      } finally {
        setBuscandoPrediosManzana(false);
      }
    };
    
    const timeoutId = setTimeout(buscarPrediosEnManzana, 500);
    return () => clearTimeout(timeoutId);
  }, [estructuraCodigo, codigoManual.zona, codigoManual.sector, codigoManual.comuna, codigoManual.barrio, codigoManual.manzana_vereda, municipio, token]);
  
  // Construir código completo
  const construirCodigoCompleto = useCallback(() => {
    if (!estructuraCodigo) return '';
    return `${estructuraCodigo.prefijo_fijo}${codigoManual.zona}${codigoManual.sector}${codigoManual.comuna}${codigoManual.barrio}${codigoManual.manzana_vereda}${codigoManual.terreno}${codigoManual.condicion}${codigoManual.edificio}${codigoManual.piso}${codigoManual.unidad}`;
  }, [estructuraCodigo, codigoManual]);
  
  // Manejar cambio en código
  const handleCodigoChange = (field, value, maxLen) => {
    const numericValue = value.replace(/\D/g, '').slice(0, maxLen);
    setCodigoManual(prev => ({
      ...prev,
      [field]: numericValue.padStart(maxLen, '0')
    }));
    setVerificacionCodigo(null);
    setTerrenoInfo(null);
  };
  
  // Verificar código completo
  const verificarCodigoCompleto = async () => {
    const codigo = construirCodigoCompleto();
    if (codigo.length !== 30) {
      toast.error('El código debe tener 30 dígitos');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/predios/verificar-codigo/${codigo}?municipio=${municipio}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        setVerificacionCodigo(data);
        setTerrenoInfo(data);
      }
    } catch (error) {
      console.error('Error verificando código:', error);
      toast.error('Error al verificar el código');
    } finally {
      setLoading(false);
    }
  };
  
  // Agregar/eliminar propietarios
  const agregarPropietario = () => {
    setPropietarios(prev => [...prev, {
      tipo_documento: 'C',
      numero_documento: '',
      primer_nombre: '',
      segundo_nombre: '',
      primer_apellido: '',
      segundo_apellido: '',
      estado: ''
    }]);
  };
  
  const eliminarPropietario = (index) => {
    if (propietarios.length > 1) {
      setPropietarios(prev => prev.filter((_, i) => i !== index));
    }
  };
  
  const actualizarPropietario = (index, field, value) => {
    setPropietarios(prev => prev.map((p, i) => 
      i === index ? { ...p, [field]: value } : p
    ));
  };
  
  // Generar nombre completo
  const generarNombreCompleto = (prop) => {
    return [prop.primer_apellido, prop.segundo_apellido, prop.primer_nombre, prop.segundo_nombre]
      .filter(Boolean)
      .join(' ')
      .toUpperCase();
  };
  
  // Formatear número documento (12 dígitos con ceros)
  const formatearNumeroDocumento = (num) => {
    return (num || '').padStart(12, '0');
  };
  
  // Zonas de terreno
  const agregarZonaTerreno = () => {
    setZonasTerreno(prev => [...prev, { zona_fisica: '', zona_economica: '', area_terreno: 0 }]);
  };
  
  const eliminarZonaTerreno = (index) => {
    if (zonasTerreno.length > 1) {
      setZonasTerreno(prev => prev.filter((_, i) => i !== index));
    }
  };
  
  const actualizarZonaTerreno = (index, field, value) => {
    setZonasTerreno(prev => prev.map((z, i) => 
      i === index ? { ...z, [field]: value } : z
    ));
  };
  
  // Construcciones
  const agregarConstruccion = () => {
    const nextId = String.fromCharCode(65 + construcciones.length); // A, B, C...
    setConstrucciones(prev => [...prev, {
      id: nextId,
      piso: 1,
      habitaciones: 0,
      banos: 0,
      locales: 0,
      tipificacion: '',
      uso: '',
      puntaje: 0,
      area_construida: 0
    }]);
  };
  
  const eliminarConstruccion = (index) => {
    setConstrucciones(prev => prev.filter((_, i) => i !== index));
  };
  
  const actualizarConstruccion = (index, field, value) => {
    setConstrucciones(prev => prev.map((c, i) => 
      i === index ? { ...c, [field]: value } : c
    ));
  };
  
  // Calcular áreas totales
  const calcularAreasTotales = () => {
    const areaTerrenoTotal = zonasTerreno.reduce((sum, z) => sum + (parseFloat(z.area_terreno) || 0), 0);
    const areaConstruidaTotal = construcciones.reduce((sum, c) => sum + (parseFloat(c.area_construida) || 0), 0);
    return { areaTerrenoTotal, areaConstruidaTotal };
  };
  
  // Guardar predio
  const handleGuardar = async () => {
    // Validaciones
    if (!formData.direccion.trim()) {
      toast.error('Debe ingresar la dirección del predio');
      setActiveTab('propietario');
      return;
    }
    
    const propValido = propietarios.some(p => p.primer_apellido && p.primer_nombre);
    if (!propValido) {
      toast.error('Debe ingresar al menos un propietario con nombre y apellido');
      setActiveTab('propietario');
      return;
    }
    
    if (verificacionCodigo?.estado === 'existente') {
      toast.error('El código ya existe. Verifique antes de guardar.');
      return;
    }
    
    setLoading(true);
    
    try {
      const codigoCompleto = construirCodigoCompleto();
      const areas = calcularAreasTotales();
      
      const payload = {
        r1: {
          direccion: formData.direccion,
          destino_economico: formData.destino_economico,
          zona: codigoManual.zona,
          sector: codigoManual.sector,
          comuna: codigoManual.comuna,
          barrio: codigoManual.barrio,
          manzana_vereda: codigoManual.manzana_vereda,
          terreno: codigoManual.terreno,
          condicion_predio: codigoManual.condicion,
          predio_horizontal: `${codigoManual.edificio}${codigoManual.piso}${codigoManual.unidad}`,
          area_terreno: areas.areaTerrenoTotal,
          area_construida: areas.areaConstruidaTotal,
          avaluo: parseFloat(formData.avaluo) || 0
        },
        r2: {
          matricula_inmobiliaria: formData.matricula_inmobiliaria
        },
        propietarios: propietarios.map(p => ({
          tipo_documento: p.tipo_documento,
          numero_documento: formatearNumeroDocumento(p.numero_documento),
          nombre_propietario: generarNombreCompleto(p),
          primer_nombre: p.primer_nombre?.toUpperCase() || '',
          segundo_nombre: p.segundo_nombre?.toUpperCase() || '',
          primer_apellido: p.primer_apellido?.toUpperCase() || '',
          segundo_apellido: p.segundo_apellido?.toUpperCase() || '',
          estado: p.estado?.toUpperCase() || ''
        })),
        zonas: zonasTerreno.map(z => ({
          zona_fisica: z.zona_fisica,
          zona_economica: z.zona_economica,
          area_terreno: parseFloat(z.area_terreno) || 0
        })),
        construcciones: construcciones.map(c => ({
          id: c.id,
          piso: parseInt(c.piso) || 1,
          habitaciones: parseInt(c.habitaciones) || 0,
          banos: parseInt(c.banos) || 0,
          locales: parseInt(c.locales) || 0,
          tipificacion: c.tipificacion?.toUpperCase() || '',
          uso: c.uso?.toUpperCase() || '',
          puntaje: parseFloat(c.puntaje) || 0,
          area_construida: parseFloat(c.area_construida) || 0
        })),
        formato_visita: {
          observaciones: '',
          fecha_visita: new Date().toISOString().split('T')[0]
        }
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
      handleClose();
      
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
      zona: '00', sector: '00', comuna: '00', barrio: '00',
      manzana_vereda: '0000', terreno: '0001', condicion: '0',
      edificio: '00', piso: '00', unidad: '0000'
    });
    setFormData({ direccion: '', destino_economico: 'D', matricula_inmobiliaria: '', avaluo: '' });
    setPropietarios([{ tipo_documento: 'C', numero_documento: '', primer_nombre: '', segundo_nombre: '', primer_apellido: '', segundo_apellido: '', estado: '' }]);
    setZonasTerreno([{ zona_fisica: '', zona_economica: '', area_terreno: 0 }]);
    setConstrucciones([]);
    setVerificacionCodigo(null);
    setTerrenoInfo(null);
    setPrediosEnManzana([]);
    setActiveTab('ubicacion');
    onClose();
  };
  
  const areas = calcularAreasTotales();
  
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent 
        className="max-w-4xl max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-outfit">
            Nuevo Predio - {municipio}
          </DialogTitle>
        </DialogHeader>
        
        {/* Información del Código Homologado */}
        {siguienteCodigoHomologado && (
          <div className={`p-3 rounded-lg border ${siguienteCodigoHomologado.codigo ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className={`w-5 h-5 ${siguienteCodigoHomologado.codigo ? 'text-emerald-600' : 'text-amber-600'}`} />
                <div>
                  <p className="text-sm font-medium text-slate-700">Código Homologado Asignado</p>
                  {siguienteCodigoHomologado.codigo ? (
                    <p className="text-lg font-bold text-emerald-700 font-mono">{siguienteCodigoHomologado.codigo}</p>
                  ) : (
                    <p className="text-sm text-amber-700">No hay códigos disponibles - se generará automáticamente</p>
                  )}
                </div>
              </div>
              {siguienteCodigoHomologado.codigo && (
                <Badge className="bg-emerald-100 text-emerald-700">
                  {siguienteCodigoHomologado.disponibles} disponibles
                </Badge>
              )}
            </div>
          </div>
        )}
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ubicacion">Código Nacional (30 dígitos)</TabsTrigger>
            <TabsTrigger value="propietario">Propietario (R1)</TabsTrigger>
            <TabsTrigger value="fisico">Físico (R2)</TabsTrigger>
          </TabsList>
          
          {/* TAB: Código Nacional */}
          <TabsContent value="ubicacion" className="space-y-4 mt-4">
            {estructuraCodigo && (
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Código Predial Nacional (30 dígitos)
                </h4>
                
                {/* Visualización del código completo */}
                <div className="bg-white p-3 rounded border mb-4 font-mono text-lg tracking-wider text-center">
                  <span className="text-blue-600 font-bold" title="Departamento + Municipio">{estructuraCodigo.prefijo_fijo}</span>
                  <span className="text-emerald-600" title="Zona">{codigoManual.zona}</span>
                  <span className="text-amber-600" title="Sector">{codigoManual.sector}</span>
                  <span className="text-purple-600" title="Comuna">{codigoManual.comuna}</span>
                  <span className="text-pink-600" title="Barrio">{codigoManual.barrio}</span>
                  <span className="text-cyan-600" title="Manzana/Vereda">{codigoManual.manzana_vereda}</span>
                  <span className="text-red-600 font-bold" title="Terreno">{codigoManual.terreno}</span>
                  <span className="text-orange-600" title="Condición">{codigoManual.condicion}</span>
                  <span className="text-slate-500" title="Edificio">{codigoManual.edificio}</span>
                  <span className="text-slate-500" title="Piso">{codigoManual.piso}</span>
                  <span className="text-slate-500" title="Unidad">{codigoManual.unidad}</span>
                  <span className="text-xs text-slate-500 ml-2">({construirCodigoCompleto().length}/30)</span>
                </div>
                
                {/* Campos editables - Fila 1 */}
                <div className="grid grid-cols-6 gap-2 mb-3">
                  <div className="bg-blue-100 p-2 rounded">
                    <Label className="text-xs text-blue-700">Dpto+Mpio (1-5)</Label>
                    <Input value={estructuraCodigo.prefijo_fijo} disabled className="font-mono bg-blue-50 text-blue-800 font-bold text-center" />
                  </div>
                  <div>
                    <Label className="text-xs text-emerald-700">Zona (6-7)</Label>
                    <Input 
                      value={codigoManual.zona} 
                      onChange={(e) => handleCodigoChange('zona', e.target.value, 2)}
                      maxLength={2}
                      className="font-mono text-center"
                    />
                    <span className="text-xs text-slate-400">00=Rural, 01=Urbano, 02-99=Correg.</span>
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
                
                {/* Predios en manzana */}
                {codigoManual.manzana_vereda !== '0000' && (
                  <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-cyan-700 flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        Terrenos existentes en manzana {codigoManual.manzana_vereda}
                      </p>
                      {buscandoPrediosManzana && <Loader2 className="w-3 h-3 animate-spin text-cyan-600" />}
                    </div>
                    {prediosEnManzana.length > 0 ? (
                      <div className="space-y-1">
                        {prediosEnManzana.map((p, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs bg-white rounded px-2 py-1.5 border border-cyan-100">
                            <span className="font-mono font-bold text-cyan-700 w-10">{p.terreno}</span>
                            <span className="text-slate-700 truncate flex-1">{p.direccion}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-cyan-200">
                          <p className="text-[10px] text-cyan-600">
                            Mostrando últimos {prediosEnManzana.length} terrenos
                          </p>
                          <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                            💡 Siguiente: <span className="font-mono font-bold">{siguienteTerrenoSugerido}</span>
                          </p>
                        </div>
                      </div>
                    ) : !buscandoPrediosManzana ? (
                      <p className="text-xs text-cyan-600">No hay predios registrados en esta manzana</p>
                    ) : null}
                  </div>
                )}
                
                {/* Campos editables - Fila 2 */}
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
                    <Select value={codigoManual.condicion} onValueChange={(v) => setCodigoManual({...codigoManual, condicion: v})}>
                      <SelectTrigger className="font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0 - NPH</SelectItem>
                        <SelectItem value="2">2 - Informales</SelectItem>
                        <SelectItem value="3">3 - Bienes uso público</SelectItem>
                        <SelectItem value="4">4 - Vías</SelectItem>
                        <SelectItem value="7">7 - Parques/cementerios</SelectItem>
                        <SelectItem value="8">8 - Condominio</SelectItem>
                        <SelectItem value="9">9 - PH</SelectItem>
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
                
                {/* Botón verificar */}
                <div className="mt-4">
                  <Button onClick={verificarCodigoCompleto} variant="outline" className="w-full" disabled={loading}>
                    <Search className="w-4 h-4 mr-2" />
                    Verificar Código
                  </Button>
                </div>
              </div>
            )}
            
            {/* Info del terreno */}
            {terrenoInfo && (
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg">
                <h4 className="font-semibold text-emerald-800 mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Sugerencia para esta Manzana/Vereda
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-slate-500">Predios activos:</span>
                    <p className="font-bold text-emerald-700">{terrenoInfo.total_activos || 0}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Siguiente terreno:</span>
                    <p className="font-bold text-emerald-700 text-lg">{terrenoInfo.siguiente_terreno || siguienteTerrenoSugerido}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Código sugerido:</span>
                    <p className="font-bold text-slate-800 text-xs font-mono">{terrenoInfo.codigo_sugerido || construirCodigoCompleto()}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Base Gráfica:</span>
                    <p className={`font-bold ${terrenoInfo.tiene_geometria_gdb ? 'text-emerald-700' : 'text-amber-600'}`}>
                      {terrenoInfo.tiene_geometria_gdb ? '✅ Disponible' : '⚠️ No disponible'}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Resultado verificación */}
            {verificacionCodigo && (
              <div className={`p-4 rounded-lg border ${
                verificacionCodigo.estado === 'disponible' ? 'bg-emerald-50 border-emerald-300' :
                verificacionCodigo.estado === 'eliminado' ? 'bg-amber-50 border-amber-300' :
                'bg-red-50 border-red-300'
              }`}>
                <p className={`font-semibold ${
                  verificacionCodigo.estado === 'disponible' ? 'text-emerald-800' :
                  verificacionCodigo.estado === 'eliminado' ? 'text-amber-800' :
                  'text-red-800'
                }`}>
                  {verificacionCodigo.mensaje}
                </p>
                {verificacionCodigo.estado === 'existente' && (
                  <p className="mt-2 text-sm text-red-700">No puede crear un predio con este código.</p>
                )}
              </div>
            )}
          </TabsContent>
          
          {/* TAB: Propietario (R1) */}
          <TabsContent value="propietario" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <h4 className="font-semibold text-slate-800">Propietarios</h4>
              <Button type="button" variant="outline" size="sm" onClick={agregarPropietario} className="text-emerald-700">
                <Plus className="w-4 h-4 mr-1" /> Agregar Propietario
              </Button>
            </div>
            
            {propietarios.map((prop, index) => (
              <div key={index} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium text-slate-700">Propietario {index + 1}</span>
                  {propietarios.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => eliminarPropietario(index)} className="text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Primer Apellido *</Label>
                    <Input 
                      value={prop.primer_apellido} 
                      onChange={(e) => actualizarPropietario(index, 'primer_apellido', e.target.value.toUpperCase())}
                      placeholder="PÉREZ"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Segundo Apellido</Label>
                    <Input 
                      value={prop.segundo_apellido} 
                      onChange={(e) => actualizarPropietario(index, 'segundo_apellido', e.target.value.toUpperCase())}
                      placeholder="GARCÍA"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Primer Nombre *</Label>
                    <Input 
                      value={prop.primer_nombre} 
                      onChange={(e) => actualizarPropietario(index, 'primer_nombre', e.target.value.toUpperCase())}
                      placeholder="JUAN"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Segundo Nombre</Label>
                    <Input 
                      value={prop.segundo_nombre} 
                      onChange={(e) => actualizarPropietario(index, 'segundo_nombre', e.target.value.toUpperCase())}
                      placeholder="CARLOS"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Estado</Label>
                    <Input 
                      value={prop.estado} 
                      onChange={(e) => actualizarPropietario(index, 'estado', e.target.value.toUpperCase())}
                      placeholder="Ej: CASADO, SOLTERO, VIUDO, E (Estado)"
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-2 block">Tipo Documento *</Label>
                    <RadioGroup 
                      value={prop.tipo_documento} 
                      onValueChange={(v) => actualizarPropietario(index, 'tipo_documento', v)}
                      className="flex flex-wrap gap-3"
                    >
                      {Object.entries(TIPOS_DOCUMENTO).map(([k, v]) => (
                        <div key={k} className="flex items-center space-x-1">
                          <RadioGroupItem value={k} id={`tipo_doc_${index}_${k}`} />
                          <Label htmlFor={`tipo_doc_${index}_${k}`} className="text-xs cursor-pointer">{k}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                  <div>
                    <Label className="text-xs">Número Documento * (máx 12)</Label>
                    <Input 
                      value={prop.numero_documento} 
                      onChange={(e) => actualizarPropietario(index, 'numero_documento', e.target.value.replace(/\D/g, '').slice(0, 12))}
                      placeholder="12345678"
                    />
                    {prop.numero_documento && (
                      <p className="text-xs text-slate-500 mt-1">
                        Formato: {formatearNumeroDocumento(prop.numero_documento)}
                      </p>
                    )}
                  </div>
                  {(prop.primer_apellido || prop.primer_nombre) && (
                    <div className="col-span-2 bg-emerald-50 p-2 rounded border border-emerald-200">
                      <p className="text-xs text-emerald-700">
                        <strong>Nombre completo:</strong> {generarNombreCompleto(prop) || 'Complete los campos'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {/* Información del predio */}
            <div className="border-t border-slate-200 pt-4 mt-4">
              <h4 className="font-semibold text-slate-800 mb-3">Información del Predio</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Dirección *</Label>
                  <Input 
                    value={formData.direccion} 
                    onChange={(e) => setFormData({...formData, direccion: e.target.value.toUpperCase()})}
                    placeholder="VEREDA, SECTOR O DIRECCIÓN"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="mb-2 block">Destino Económico *</Label>
                  <RadioGroup 
                    value={formData.destino_economico} 
                    onValueChange={(v) => setFormData({...formData, destino_economico: v})}
                    className="flex flex-wrap gap-2"
                  >
                    {Object.entries(DESTINOS_ECONOMICOS).map(([k, v]) => (
                      <div key={k} className="flex items-center space-x-1">
                        <RadioGroupItem value={k} id={`destino_${k}`} />
                        <Label htmlFor={`destino_${k}`} className="text-xs cursor-pointer">{k}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
                <div>
                  <Label>Matrícula Inmobiliaria</Label>
                  <Input 
                    value={formData.matricula_inmobiliaria} 
                    onChange={(e) => setFormData({...formData, matricula_inmobiliaria: e.target.value})}
                    placeholder="Ej: 270-8920"
                  />
                </div>
                <div>
                  <Label>Avalúo (COP) *</Label>
                  <Input 
                    type="number" 
                    value={formData.avaluo} 
                    onChange={(e) => setFormData({...formData, avaluo: e.target.value})}
                  />
                </div>
                
                {/* Áreas calculadas */}
                <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-blue-800">Áreas (calculadas del R2)</span>
                    <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded">Automático</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-blue-700">Área Terreno Total (m²)</Label>
                      <Input 
                        type="number" 
                        value={areas.areaTerrenoTotal.toFixed(2)} 
                        readOnly 
                        className="bg-blue-100 border-blue-300 text-blue-800 font-medium"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-blue-700">Área Construida Total (m²)</Label>
                      <Input 
                        type="number" 
                        value={areas.areaConstruidaTotal.toFixed(2)} 
                        readOnly 
                        className="bg-blue-100 border-blue-300 text-blue-800 font-medium"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-blue-600 mt-2">
                    💡 Modifique los valores en la pestaña "Físico (R2)".
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
          
          {/* TAB: Físico (R2) */}
          <TabsContent value="fisico" className="space-y-4 mt-4">
            {/* Matrícula */}
            <div>
              <Label>Matrícula Inmobiliaria</Label>
              <Input 
                value={formData.matricula_inmobiliaria} 
                onChange={(e) => setFormData({...formData, matricula_inmobiliaria: e.target.value})}
                placeholder="Ej: 270-8920"
              />
            </div>
            
            {/* Zonas de Terreno */}
            <div className="border-t border-slate-200 pt-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-slate-800">Zonas de Terreno</h4>
                <Button type="button" variant="outline" size="sm" onClick={agregarZonaTerreno} className="text-emerald-700">
                  <Plus className="w-4 h-4 mr-1" /> Agregar Zona
                </Button>
              </div>
              
              {zonasTerreno.map((zona, index) => (
                <div key={index} className="border border-slate-200 rounded-lg p-3 bg-slate-50 mb-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-slate-700">Zona {index + 1}</span>
                    {zonasTerreno.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => eliminarZonaTerreno(index)} className="text-red-600 h-6 w-6 p-0">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Zona Física</Label>
                      <Input value={zona.zona_fisica} onChange={(e) => actualizarZonaTerreno(index, 'zona_fisica', e.target.value)} placeholder="03" />
                    </div>
                    <div>
                      <Label className="text-xs">Zona Económica</Label>
                      <Input value={zona.zona_economica} onChange={(e) => actualizarZonaTerreno(index, 'zona_economica', e.target.value)} placeholder="05" />
                    </div>
                    <div>
                      <Label className="text-xs">Área Terreno (m²)</Label>
                      <Input type="number" value={zona.area_terreno} onChange={(e) => actualizarZonaTerreno(index, 'area_terreno', e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="bg-blue-50 border border-blue-200 rounded p-2 mt-2">
                <p className="text-sm text-blue-800">
                  📊 <strong>Subtotal Área Terreno:</strong> {areas.areaTerrenoTotal.toLocaleString('es-CO', {minimumFractionDigits: 2})} m²
                </p>
              </div>
            </div>
            
            {/* Construcciones */}
            <div className="border-t border-slate-200 pt-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-slate-800">Construcciones</h4>
                <Button type="button" variant="outline" size="sm" onClick={agregarConstruccion} className="text-emerald-700">
                  <Plus className="w-4 h-4 mr-1" /> Agregar Construcción
                </Button>
              </div>
              
              {construcciones.length === 0 ? (
                <div className="text-center py-4 bg-slate-50 rounded-lg border-2 border-dashed">
                  <p className="text-slate-500 text-sm">No hay construcciones registradas</p>
                </div>
              ) : (
                construcciones.map((const_, index) => (
                  <div key={index} className="border border-amber-200 rounded-lg p-3 bg-amber-50 mb-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-amber-800">Construcción {const_.id}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => eliminarConstruccion(index)} className="text-red-600 h-6 w-6 p-0">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <Label className="text-xs">Piso</Label>
                        <Input type="number" value={const_.piso} onChange={(e) => actualizarConstruccion(index, 'piso', e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Habitaciones</Label>
                        <Input type="number" value={const_.habitaciones} onChange={(e) => actualizarConstruccion(index, 'habitaciones', e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Baños</Label>
                        <Input type="number" value={const_.banos} onChange={(e) => actualizarConstruccion(index, 'banos', e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Locales</Label>
                        <Input type="number" value={const_.locales} onChange={(e) => actualizarConstruccion(index, 'locales', e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Tipificación</Label>
                        <Input value={const_.tipificacion} onChange={(e) => actualizarConstruccion(index, 'tipificacion', e.target.value.toUpperCase())} />
                      </div>
                      <div>
                        <Label className="text-xs">Uso</Label>
                        <Input value={const_.uso} onChange={(e) => actualizarConstruccion(index, 'uso', e.target.value.toUpperCase())} />
                      </div>
                      <div>
                        <Label className="text-xs">Puntaje</Label>
                        <Input type="number" value={const_.puntaje} onChange={(e) => actualizarConstruccion(index, 'puntaje', e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Área (m²)</Label>
                        <Input type="number" value={const_.area_construida} onChange={(e) => actualizarConstruccion(index, 'area_construida', e.target.value)} />
                      </div>
                    </div>
                  </div>
                ))
              )}
              
              <div className="bg-amber-50 border border-amber-200 rounded p-2 mt-2">
                <p className="text-sm text-amber-800">
                  📊 <strong>Subtotal Área Construida:</strong> {areas.areaConstruidaTotal.toLocaleString('es-CO', {minimumFractionDigits: 2})} m²
                </p>
              </div>
            </div>
            
            {/* Resumen R2 */}
            <div className="border-t border-slate-200 pt-4">
              <div className="bg-slate-100 border border-slate-300 rounded-lg p-3">
                <h4 className="font-semibold text-slate-800 mb-2">Resumen R2</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p>• Zonas de Terreno: <strong>{zonasTerreno.length}</strong></p>
                  <p>• Construcciones: <strong>{construcciones.length}</strong></p>
                  <p className="text-blue-700">• Área Terreno → R1: <strong>{areas.areaTerrenoTotal.toLocaleString('es-CO', {minimumFractionDigits: 2})} m²</strong></p>
                  <p className="text-amber-700">• Área Construida → R1: <strong>{areas.areaConstruidaTotal.toLocaleString('es-CO', {minimumFractionDigits: 2})} m²</strong></p>
                </div>
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
            disabled={loading || verificacionCodigo?.estado === 'existente'}
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
