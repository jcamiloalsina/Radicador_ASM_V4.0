import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import {
  MapPin, User, Plus, Trash2, Save, X, Camera, Navigation,
  Compass, Loader2, CheckCircle, Building
} from 'lucide-react';
import { toast } from 'sonner';
import FirmaCanvas from '../FirmaCanvas';

const FormularioVisitaModal = ({
  open,
  onOpenChange,
  predio,
  visitaExistente,
  onGuardar,
  isSaving
}) => {
  // Estado inicial del formulario
  const [formData, setFormData] = useState({
    fecha_visita: new Date().toISOString().split('T')[0],
    hora_visita: new Date().toTimeString().slice(0, 5),
    persona_atiende: '',
    relacion_predio: '',
    acceso_predio: 'si',
    observaciones: '',
    sin_cambios: false
  });

  // Propietarios encontrados en visita
  const [propietarios, setPropietarios] = useState([{
    tipo_documento: '',
    numero_documento: '',
    nombre: '',
    primer_apellido: '',
    segundo_apellido: '',
    estado: '',
    genero: '',
    grupo_etnico: ''
  }]);

  // Linderos
  const [linderos, setLinderos] = useState({
    norte: '',
    sur: '',
    este: '',
    oeste: ''
  });

  // Coordenadas GPS
  const [coordenadas, setCoordenadas] = useState({
    latitud: '',
    longitud: '',
    precision: null,
    fuente: 'manual'
  });
  const [capturandoGPS, setCapturandoGPS] = useState(false);

  // Construcciones observadas
  const [construcciones, setConstrucciones] = useState([
    { unidad: 'A', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' }
  ]);

  // Fotos
  const [fotos, setFotos] = useState([]);
  const fileInputRef = useRef(null);

  // Firma
  const [firma, setFirma] = useState(null);
  const canvasRef = useRef(null);

  // Cargar datos existentes si hay visita previa
  useEffect(() => {
    if (visitaExistente && open) {
      setFormData({
        fecha_visita: visitaExistente.fecha_visita || new Date().toISOString().split('T')[0],
        hora_visita: visitaExistente.hora_visita || new Date().toTimeString().slice(0, 5),
        persona_atiende: visitaExistente.persona_atiende || '',
        relacion_predio: visitaExistente.relacion_predio || '',
        acceso_predio: visitaExistente.acceso_predio || 'si',
        observaciones: visitaExistente.observaciones || visitaExistente.observaciones_generales || '',
        sin_cambios: visitaExistente.sin_cambios || false
      });

      if (visitaExistente.propietarios_visita?.length > 0) {
        setPropietarios(visitaExistente.propietarios_visita);
      }

      if (visitaExistente.linderos) {
        setLinderos(visitaExistente.linderos);
      }

      if (visitaExistente.coordenadas) {
        setCoordenadas(visitaExistente.coordenadas);
      }

      if (visitaExistente.construcciones_visita?.length > 0) {
        setConstrucciones(visitaExistente.construcciones_visita);
      }

      if (visitaExistente.fotos?.length > 0) {
        setFotos(visitaExistente.fotos);
      }
    }
  }, [visitaExistente, open]);

  // Capturar coordenadas GPS del dispositivo
  const capturarGPS = () => {
    if (!navigator.geolocation) {
      toast.error('Tu navegador no soporta geolocalización');
      return;
    }

    setCapturandoGPS(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordenadas({
          latitud: position.coords.latitude.toFixed(6),
          longitud: position.coords.longitude.toFixed(6),
          precision: Math.round(position.coords.accuracy),
          fuente: 'gps'
        });
        setCapturandoGPS(false);
        toast.success(`Ubicación capturada (precisión: ${Math.round(position.coords.accuracy)}m)`);
      },
      (error) => {
        setCapturandoGPS(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error('Permiso de ubicación denegado');
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error('Ubicación no disponible');
            break;
          case error.TIMEOUT:
            toast.error('Tiempo de espera agotado');
            break;
          default:
            toast.error('Error al obtener ubicación');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  // Agregar propietario
  const agregarPropietario = () => {
    setPropietarios([...propietarios, {
      tipo_documento: '',
      numero_documento: '',
      nombre: '',
      primer_apellido: '',
      segundo_apellido: '',
      estado: '',
      genero: '',
      grupo_etnico: ''
    }]);
  };

  // Eliminar propietario
  const eliminarPropietario = (index) => {
    if (propietarios.length > 1) {
      setPropietarios(propietarios.filter((_, i) => i !== index));
    }
  };

  // Actualizar propietario
  const actualizarPropietario = (index, campo, valor) => {
    const nuevos = [...propietarios];
    nuevos[index][campo] = valor;
    setPropietarios(nuevos);
  };

  // Agregar construcción
  const agregarConstruccion = () => {
    const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const siguiente = letras[construcciones.length] || `${construcciones.length + 1}`;
    setConstrucciones([...construcciones, {
      unidad: siguiente,
      codigo_uso: '',
      area: '',
      puntaje: '',
      ano_construccion: '',
      num_pisos: ''
    }]);
  };

  // Eliminar construcción
  const eliminarConstruccion = (index) => {
    if (construcciones.length > 1) {
      setConstrucciones(construcciones.filter((_, i) => i !== index));
    }
  };

  // Manejar fotos
  const handleFotoChange = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFotos(prev => [...prev, {
          nombre: file.name,
          data: reader.result,
          fecha: new Date().toISOString()
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Guardar formulario
  const handleGuardar = () => {
    const datosVisita = {
      ...formData,
      propietarios_visita: propietarios.filter(p => p.nombre || p.numero_documento),
      linderos,
      coordenadas,
      construcciones_visita: construcciones.filter(c => c.area || c.codigo_uso),
      fotos,
      firma_base64: firma
    };

    onGuardar(datosVisita);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-amber-600" />
            Formulario de Visita de Campo
          </DialogTitle>
          <DialogDescription>
            Predio: {predio?.codigo_predial || predio?.codigo_predial_nacional}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="propietarios">Propietarios</TabsTrigger>
            <TabsTrigger value="linderos">Linderos</TabsTrigger>
            <TabsTrigger value="coordenadas">Coordenadas</TabsTrigger>
            <TabsTrigger value="construcciones">Construcciones</TabsTrigger>
          </TabsList>

          {/* Tab General */}
          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fecha de Visita</Label>
                <Input
                  type="date"
                  value={formData.fecha_visita}
                  onChange={(e) => setFormData({...formData, fecha_visita: e.target.value})}
                />
              </div>
              <div>
                <Label>Hora de Visita</Label>
                <Input
                  type="time"
                  value={formData.hora_visita}
                  onChange={(e) => setFormData({...formData, hora_visita: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Persona que Atiende</Label>
                <Input
                  placeholder="Nombre de quien atiende"
                  value={formData.persona_atiende}
                  onChange={(e) => setFormData({...formData, persona_atiende: e.target.value})}
                />
              </div>
              <div>
                <Label>Relación con el Predio</Label>
                <Select 
                  value={formData.relacion_predio}
                  onValueChange={(v) => setFormData({...formData, relacion_predio: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="propietario">Propietario</SelectItem>
                    <SelectItem value="poseedor">Poseedor</SelectItem>
                    <SelectItem value="arrendatario">Arrendatario</SelectItem>
                    <SelectItem value="familiar">Familiar</SelectItem>
                    <SelectItem value="empleado">Empleado</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>¿Se pudo acceder al predio?</Label>
              <Select 
                value={formData.acceso_predio}
                onValueChange={(v) => setFormData({...formData, acceso_predio: v})}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="si">Sí</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="parcial">Parcialmente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Observaciones</Label>
              <Textarea
                placeholder="Observaciones de la visita..."
                rows={4}
                value={formData.observaciones}
                onChange={(e) => setFormData({...formData, observaciones: e.target.value})}
              />
            </div>

            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <Checkbox
                id="sin_cambios"
                checked={formData.sin_cambios}
                onCheckedChange={(checked) => setFormData({...formData, sin_cambios: checked})}
              />
              <Label htmlFor="sin_cambios" className="cursor-pointer">
                <span className="font-medium">Predio sin cambios</span>
                <span className="text-xs text-gray-500 block">
                  Marcar si el predio no requiere actualización
                </span>
              </Label>
            </div>

            {/* Fotos */}
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <Camera className="w-4 h-4" />
                Fotos de la Visita
              </Label>
              <input
                type="file"
                accept="image/*"
                multiple
                ref={fileInputRef}
                onChange={handleFotoChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="w-4 h-4 mr-2" />
                Agregar Fotos
              </Button>
              {fotos.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {fotos.map((foto, idx) => (
                    <div key={idx} className="relative w-20 h-20">
                      <img
                        src={foto.data}
                        alt={foto.nombre}
                        className="w-full h-full object-cover rounded"
                      />
                      <button
                        type="button"
                        onClick={() => setFotos(fotos.filter((_, i) => i !== idx))}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Firma */}
            <div>
              <Label className="flex items-center gap-2 mb-2">
                Firma del Visitado
              </Label>
              <div className="border rounded-lg p-2 bg-white">
                <FirmaCanvas
                  ref={canvasRef}
                  onSave={(firmaBase64) => setFirma(firmaBase64)}
                  initialValue={firma}
                />
              </div>
            </div>
          </TabsContent>

          {/* Tab Propietarios */}
          <TabsContent value="propietarios" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <Label className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Propietarios Encontrados en Visita
              </Label>
              <Button type="button" variant="outline" size="sm" onClick={agregarPropietario}>
                <Plus className="w-4 h-4 mr-1" /> Agregar
              </Button>
            </div>

            {propietarios.map((prop, idx) => (
              <div key={idx} className="border rounded-lg p-4 space-y-3 bg-gray-50">
                <div className="flex justify-between items-center">
                  <Badge variant="outline">Propietario {idx + 1}</Badge>
                  {propietarios.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => eliminarPropietario(idx)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Tipo Documento</Label>
                    <Select
                      value={prop.tipo_documento}
                      onValueChange={(v) => actualizarPropietario(idx, 'tipo_documento', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Tipo..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CC">Cédula Ciudadanía</SelectItem>
                        <SelectItem value="CE">Cédula Extranjería</SelectItem>
                        <SelectItem value="NIT">NIT</SelectItem>
                        <SelectItem value="TI">Tarjeta Identidad</SelectItem>
                        <SelectItem value="PP">Pasaporte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Número Documento</Label>
                    <Input
                      placeholder="Número..."
                      value={prop.numero_documento}
                      onChange={(e) => actualizarPropietario(idx, 'numero_documento', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Nombre</Label>
                    <Input
                      placeholder="Nombre"
                      value={prop.nombre}
                      onChange={(e) => actualizarPropietario(idx, 'nombre', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Primer Apellido</Label>
                    <Input
                      placeholder="Primer apellido"
                      value={prop.primer_apellido}
                      onChange={(e) => actualizarPropietario(idx, 'primer_apellido', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Segundo Apellido</Label>
                    <Input
                      placeholder="Segundo apellido"
                      value={prop.segundo_apellido}
                      onChange={(e) => actualizarPropietario(idx, 'segundo_apellido', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Estado Civil</Label>
                    <Select
                      value={prop.estado}
                      onValueChange={(v) => actualizarPropietario(idx, 'estado', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Estado..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="S">Soltero(a)</SelectItem>
                        <SelectItem value="C">Casado(a)</SelectItem>
                        <SelectItem value="U">Unión Libre</SelectItem>
                        <SelectItem value="D">Divorciado(a)</SelectItem>
                        <SelectItem value="V">Viudo(a)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Género</Label>
                    <Select
                      value={prop.genero}
                      onValueChange={(v) => actualizarPropietario(idx, 'genero', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Género..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M">Masculino</SelectItem>
                        <SelectItem value="F">Femenino</SelectItem>
                        <SelectItem value="O">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Grupo Étnico</Label>
                    <Select
                      value={prop.grupo_etnico}
                      onValueChange={(v) => actualizarPropietario(idx, 'grupo_etnico', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Grupo..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ninguno">Ninguno</SelectItem>
                        <SelectItem value="indigena">Indígena</SelectItem>
                        <SelectItem value="afro">Afrodescendiente</SelectItem>
                        <SelectItem value="raizal">Raizal</SelectItem>
                        <SelectItem value="rom">Rom/Gitano</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>

          {/* Tab Linderos */}
          <TabsContent value="linderos" className="space-y-4 mt-4">
            <Label className="flex items-center gap-2">
              <Compass className="w-4 h-4" />
              Linderos del Predio
            </Label>
            
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label className="text-sm text-gray-600">Norte</Label>
                <Textarea
                  placeholder="Descripción del lindero norte..."
                  value={linderos.norte}
                  onChange={(e) => setLinderos({...linderos, norte: e.target.value})}
                  rows={2}
                />
              </div>
              <div>
                <Label className="text-sm text-gray-600">Sur</Label>
                <Textarea
                  placeholder="Descripción del lindero sur..."
                  value={linderos.sur}
                  onChange={(e) => setLinderos({...linderos, sur: e.target.value})}
                  rows={2}
                />
              </div>
              <div>
                <Label className="text-sm text-gray-600">Este</Label>
                <Textarea
                  placeholder="Descripción del lindero este..."
                  value={linderos.este}
                  onChange={(e) => setLinderos({...linderos, este: e.target.value})}
                  rows={2}
                />
              </div>
              <div>
                <Label className="text-sm text-gray-600">Oeste</Label>
                <Textarea
                  placeholder="Descripción del lindero oeste..."
                  value={linderos.oeste}
                  onChange={(e) => setLinderos({...linderos, oeste: e.target.value})}
                  rows={2}
                />
              </div>
            </div>
          </TabsContent>

          {/* Tab Coordenadas */}
          <TabsContent value="coordenadas" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <Label className="flex items-center gap-2">
                <Navigation className="w-4 h-4" />
                Coordenadas GPS del Predio
              </Label>
              <Button
                type="button"
                variant="default"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={capturarGPS}
                disabled={capturandoGPS}
              >
                {capturandoGPS ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Navigation className="w-4 h-4 mr-2" />
                )}
                {capturandoGPS ? 'Obteniendo...' : '📍 Capturar Mi Ubicación'}
              </Button>
            </div>

            {coordenadas.fuente === 'gps' && coordenadas.precision && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-green-700 text-sm">
                  Ubicación capturada con precisión de {coordenadas.precision} metros
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Latitud</Label>
                <Input
                  type="text"
                  placeholder="Ej: 7.123456"
                  value={coordenadas.latitud}
                  onChange={(e) => setCoordenadas({...coordenadas, latitud: e.target.value, fuente: 'manual'})}
                />
              </div>
              <div>
                <Label>Longitud</Label>
                <Input
                  type="text"
                  placeholder="Ej: -72.654321"
                  value={coordenadas.longitud}
                  onChange={(e) => setCoordenadas({...coordenadas, longitud: e.target.value, fuente: 'manual'})}
                />
              </div>
            </div>

            {coordenadas.latitud && coordenadas.longitud && (
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Vista previa de coordenadas:</p>
                <p className="font-mono text-sm">
                  {coordenadas.latitud}, {coordenadas.longitud}
                </p>
                {coordenadas.fuente === 'manual' && (
                  <Badge variant="outline" className="mt-2 text-xs">Ingreso manual</Badge>
                )}
              </div>
            )}
          </TabsContent>

          {/* Tab Construcciones */}
          <TabsContent value="construcciones" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <Label className="flex items-center gap-2">
                <Building className="w-4 h-4" />
                Construcciones Observadas
              </Label>
              <Button type="button" variant="outline" size="sm" onClick={agregarConstruccion}>
                <Plus className="w-4 h-4 mr-1" /> Agregar
              </Button>
            </div>

            {construcciones.map((const_item, idx) => (
              <div key={idx} className="border rounded-lg p-4 space-y-3 bg-gray-50">
                <div className="flex justify-between items-center">
                  <Badge variant="outline">Unidad {const_item.unidad}</Badge>
                  {construcciones.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => eliminarConstruccion(idx)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Código Uso</Label>
                    <Input
                      placeholder="Ej: 001"
                      value={const_item.codigo_uso}
                      onChange={(e) => {
                        const nuevas = [...construcciones];
                        nuevas[idx].codigo_uso = e.target.value;
                        setConstrucciones(nuevas);
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Área (m²)</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={const_item.area}
                      onChange={(e) => {
                        const nuevas = [...construcciones];
                        nuevas[idx].area = e.target.value;
                        setConstrucciones(nuevas);
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Puntaje</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={const_item.puntaje}
                      onChange={(e) => {
                        const nuevas = [...construcciones];
                        nuevas[idx].puntaje = e.target.value;
                        setConstrucciones(nuevas);
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Año Construcción</Label>
                    <Input
                      type="number"
                      placeholder="Ej: 2010"
                      value={const_item.ano_construccion}
                      onChange={(e) => {
                        const nuevas = [...construcciones];
                        nuevas[idx].ano_construccion = e.target.value;
                        setConstrucciones(nuevas);
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Número de Pisos</Label>
                    <Input
                      type="number"
                      placeholder="1"
                      value={const_item.num_pisos}
                      onChange={(e) => {
                        const nuevas = [...construcciones];
                        nuevas[idx].num_pisos = e.target.value;
                        setConstrucciones(nuevas);
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button 
            onClick={handleGuardar} 
            disabled={isSaving}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {isSaving ? 'Guardando...' : 'Guardar Visita'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FormularioVisitaModal;
