import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';
import { ArrowLeft, Send, Upload, X, FileText, Info, Building2 } from 'lucide-react';
import { TIPOS_TRAMITE, MUNICIPIOS, getTramiteCompleto } from '../data/catalogos';
import { useAuth } from '../context/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Tipos de trámite para empresas
const TIPOS_TRAMITE_EMPRESA = [
  {
    id: 'certificado_catastral',
    nombre: 'Certificado Catastral',
    descripcion: 'Solicitud de certificado catastral del predio'
  },
  {
    id: 'otro_tramite',
    nombre: 'Otro Trámite',
    descripcion: 'Especifique el trámite que necesita realizar'
  }
];

export default function CreatePetition() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre_completo: '',
    correo: '',
    telefono: '',
    tipo_tramite: '',
    sub_tipo_tramite: '',
    municipio: '',
    descripcion: '',
    // Campos para certificado catastral
    codigo_predial: '',
    matricula_inmobiliaria: '',
    busqueda_tipo: 'codigo', // 'codigo' o 'matricula'
    // Campos para empresa - otro trámite
    otro_tramite_cual: ''
  });
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  // Verificar si es rol empresa
  const isEmpresa = user?.role === 'empresa';
  
  // Lista de tipos de trámite según el rol
  const tiposTramiteDisponibles = isEmpresa ? TIPOS_TRAMITE_EMPRESA : TIPOS_TRAMITE;

  // Obtener el tipo de trámite seleccionado
  const selectedTipoTramite = tiposTramiteDisponibles.find(t => t.id === formData.tipo_tramite);
  const hasSubOpciones = selectedTipoTramite?.subOpciones?.length > 0;
  
  // Verificar si es un trámite de certificado
  const esCertificado = ['certificado_catastral', 'certificado_catastral_especial', 'certificado_plano'].includes(formData.tipo_tramite);
  
  // Verificar si es "otro trámite"
  const esOtroTramite = formData.tipo_tramite === 'otro_tramite';

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles([...files, ...selectedFiles]);
  };

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  // Funciones para Drag and Drop
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Solo salir si realmente sale del área
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      setFiles([...files, ...droppedFiles]);
      toast.success(`${droppedFiles.length} archivo(s) agregado(s)`);
    }
  };

  const handleTipoTramiteChange = (value) => {
    setFormData({ 
      ...formData, 
      tipo_tramite: value,
      sub_tipo_tramite: '', // Reset sub-opción cuando cambia el tipo
      codigo_predial: '',
      matricula_inmobiliaria: '',
      otro_tramite_cual: '' // Reset campo de otro trámite
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validar que si hay sub-opciones, se haya seleccionado una
    if (hasSubOpciones && !formData.sub_tipo_tramite) {
      toast.error('Por favor seleccione la sub-opción del trámite');
      return;
    }
    
    // Validar campos de certificado
    if (esCertificado) {
      if (formData.busqueda_tipo === 'codigo' && !formData.codigo_predial.trim()) {
        toast.error('Debe ingresar el Código Predial Nacional');
        return;
      }
      if (formData.busqueda_tipo === 'matricula' && !formData.matricula_inmobiliaria.trim()) {
        toast.error('Debe ingresar la Matrícula Inmobiliaria');
        return;
      }
    }
    
    // Validar "otro trámite" para empresas
    if (esOtroTramite && !formData.otro_tramite_cual.trim()) {
      toast.error('Debe especificar qué trámite necesita');
      return;
    }
    
    setLoading(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('nombre_completo', formData.nombre_completo);
      formDataToSend.append('correo', formData.correo);
      formDataToSend.append('telefono', formData.telefono);
      
      // Construir el tipo de trámite completo
      let tipoTramiteCompleto;
      if (esOtroTramite) {
        // Para "otro trámite", incluir la especificación
        tipoTramiteCompleto = `Otro trámite: ${formData.otro_tramite_cual}`;
      } else if (isEmpresa && formData.tipo_tramite === 'certificado_catastral') {
        tipoTramiteCompleto = 'Certificado Catastral (Empresa)';
      } else {
        tipoTramiteCompleto = getTramiteCompleto(formData.tipo_tramite, formData.sub_tipo_tramite);
      }
      formDataToSend.append('tipo_tramite', tipoTramiteCompleto);
      formDataToSend.append('municipio', formData.municipio);
      formDataToSend.append('descripcion', formData.descripcion);
      
      // Agregar campos de certificado si aplica
      if (esCertificado) {
        if (formData.busqueda_tipo === 'codigo') {
          formDataToSend.append('codigo_predial', formData.codigo_predial.trim());
        } else {
          formDataToSend.append('matricula_inmobiliaria', formData.matricula_inmobiliaria.trim());
        }
      }
      
      files.forEach((file) => {
        formDataToSend.append('files', file);
      });

      await axios.post(`${API}/petitions`, formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      toast.success('¡Petición creada exitosamente!');
      navigate('/dashboard/peticiones');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear la petición');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto" data-testid="create-petition-page">
      <Button
        onClick={() => navigate('/dashboard')}
        variant="ghost"
        className="mb-6 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
        data-testid="back-button"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver
      </Button>

      <Card className="border-slate-200">
        <CardHeader className="bg-gradient-to-br from-emerald-800 to-emerald-600 text-white rounded-t-lg">
          <CardTitle className="text-2xl font-outfit" data-testid="form-title">Nueva Petición de Trámite</CardTitle>
          <p className="text-emerald-100 text-sm mt-1">Complete el formulario con los datos del trámite catastral</p>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Banner informativo para empresas */}
          {isEmpresa && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
              <Building2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-800">Solicitud para Empresas</p>
                <p className="text-sm text-blue-700 mt-1">
                  Puede solicitar certificados catastrales u otros trámites. Su solicitud será procesada por nuestro equipo y recibirá notificación al correo registrado.
                </p>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6" data-testid="petition-form">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="nombre_completo" className="text-slate-700">Nombre Completo *</Label>
                <Input
                  id="nombre_completo"
                  value={formData.nombre_completo}
                  onChange={(e) => setFormData({ ...formData, nombre_completo: e.target.value })}
                  required
                  className="focus-visible:ring-emerald-600"
                  placeholder="Juan Pérez Gómez"
                  data-testid="input-nombre"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="correo" className="text-slate-700">Correo Electrónico *</Label>
                <Input
                  id="correo"
                  type="email"
                  value={formData.correo}
                  onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                  required
                  className="focus-visible:ring-emerald-600"
                  placeholder="correo@ejemplo.com"
                  data-testid="input-correo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefono" className="text-slate-700">Teléfono *</Label>
                <Input
                  id="telefono"
                  type="tel"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  required
                  className="focus-visible:ring-emerald-600"
                  placeholder="3001234567"
                  data-testid="input-telefono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="municipio" className="text-slate-700">Municipio *</Label>
                <Select value={formData.municipio} onValueChange={(value) => setFormData({ ...formData, municipio: value })} required>
                  <SelectTrigger className="focus:ring-emerald-600" data-testid="select-municipio">
                    <SelectValue placeholder="Seleccione el municipio" />
                  </SelectTrigger>
                  <SelectContent>
                    {MUNICIPIOS.map((municipio) => (
                      <SelectItem key={municipio} value={municipio}>
                        {municipio}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo_tramite" className="text-slate-700">Tipo de Trámite *</Label>
              <Select value={formData.tipo_tramite} onValueChange={handleTipoTramiteChange} required>
                <SelectTrigger className="focus:ring-emerald-600" data-testid="select-tipo-tramite">
                  <SelectValue placeholder="Seleccione el tipo de trámite" />
                </SelectTrigger>
                <SelectContent>
                  {tiposTramiteDisponibles.map((tipo) => (
                    <SelectItem key={tipo.id} value={tipo.id} data-testid={`tramite-${tipo.id}`}>
                      {tipo.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTipoTramite && (
                <p className="text-xs text-slate-500 mt-1">{selectedTipoTramite.descripcion}</p>
              )}
            </div>

            {/* Campo "¿Cuál trámite?" cuando se selecciona "Otros" */}
            {esOtroTramite && (
              <div className="space-y-2">
                <Label htmlFor="otro_tramite_cual" className="text-slate-700">¿Cuál trámite necesita? *</Label>
                <Input
                  id="otro_tramite_cual"
                  value={formData.otro_tramite_cual}
                  onChange={(e) => setFormData({ ...formData, otro_tramite_cual: e.target.value })}
                  required
                  className="focus-visible:ring-emerald-600"
                  placeholder="Especifique el trámite que necesita..."
                  data-testid="input-otro-tramite"
                />
              </div>
            )}

            {/* Sub-tipo de trámite (si aplica) */}
            {hasSubOpciones && (
              <div className="space-y-2">
                <Label htmlFor="sub_tipo_tramite" className="text-slate-700">Especifique el tipo *</Label>
                <Select value={formData.sub_tipo_tramite} onValueChange={(value) => setFormData({ ...formData, sub_tipo_tramite: value })} required>
                  <SelectTrigger className="focus:ring-emerald-600" data-testid="select-sub-tipo-tramite">
                    <SelectValue placeholder="Seleccione una opción" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedTipoTramite.subOpciones.map((subOpcion) => (
                      <SelectItem key={subOpcion.id} value={subOpcion.id}>
                        {subOpcion.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Campos para identificar el predio (solo para certificados) */}
            {esCertificado && (
              <div className="space-y-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="flex items-center gap-2 text-emerald-800">
                  <FileText className="w-5 h-5" />
                  <span className="font-semibold">Identificación del Predio</span>
                </div>
                <p className="text-sm text-slate-600">
                  Para generar el certificado, ingrese el Código Predial Nacional o la Matrícula Inmobiliaria del predio.
                </p>
                
                <div className="flex gap-4 mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="busqueda_tipo"
                      value="codigo"
                      checked={formData.busqueda_tipo === 'codigo'}
                      onChange={(e) => setFormData({ ...formData, busqueda_tipo: e.target.value, matricula_inmobiliaria: '' })}
                      className="text-emerald-700 focus:ring-emerald-600"
                    />
                    <span className="text-sm">Por Código Predial Nacional</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="busqueda_tipo"
                      value="matricula"
                      checked={formData.busqueda_tipo === 'matricula'}
                      onChange={(e) => setFormData({ ...formData, busqueda_tipo: e.target.value, codigo_predial: '' })}
                      className="text-emerald-700 focus:ring-emerald-600"
                    />
                    <span className="text-sm">Por Matrícula Inmobiliaria</span>
                  </label>
                </div>
                
                {formData.busqueda_tipo === 'codigo' ? (
                  <div className="space-y-2">
                    <Label htmlFor="codigo_predial" className="text-slate-700">Código Predial Nacional (30 dígitos) *</Label>
                    <Input
                      id="codigo_predial"
                      value={formData.codigo_predial}
                      onChange={(e) => setFormData({ ...formData, codigo_predial: e.target.value })}
                      placeholder="Ej: 546780100010000000100000000001"
                      maxLength={30}
                      className="focus-visible:ring-emerald-600 font-mono"
                      data-testid="input-codigo-predial"
                    />
                    <p className="text-xs text-slate-500">Ingrese los 30 dígitos del código predial nacional</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="matricula" className="text-slate-700">Matrícula Inmobiliaria *</Label>
                    <Input
                      id="matricula"
                      value={formData.matricula_inmobiliaria}
                      onChange={(e) => setFormData({ ...formData, matricula_inmobiliaria: e.target.value })}
                      placeholder="Ej: 270-12345"
                      className="focus-visible:ring-emerald-600"
                      data-testid="input-matricula"
                    />
                    <p className="text-xs text-slate-500">Formato: Círculo registral - Número (Ej: 270-12345)</p>
                  </div>
                )}
              </div>
            )}

            {/* Campo de descripción de la petición */}
            <div className="space-y-2">
              <Label htmlFor="descripcion" className="text-slate-700">Descripción de la Petición *</Label>
              <textarea
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                required
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent resize-none"
                placeholder="Describa detalladamente su petición o trámite catastral. Incluya información relevante como el predio, la ubicación, o cualquier detalle que facilite el procesamiento de su solicitud..."
                data-testid="input-descripcion"
              />
              <p className="text-xs text-slate-500">Especifique claramente qué solicita y cualquier información adicional relevante.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="files" className="text-slate-700">Documentos Adjuntos</Label>
              <div 
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                  isDragging 
                    ? 'border-emerald-500 bg-emerald-50' 
                    : 'border-slate-300 hover:border-emerald-500'
                }`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => document.getElementById('files').click()}
              >
                <Upload className={`w-8 h-8 mx-auto mb-2 ${isDragging ? 'text-emerald-500' : 'text-slate-400'}`} />
                <p className={`text-sm mb-2 ${isDragging ? 'text-emerald-600 font-medium' : 'text-slate-600'}`}>
                  {isDragging ? 'Suelta los archivos aquí' : 'Arrastra archivos aquí o haz clic para seleccionar'}
                </p>
                <Input
                  id="files"
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  data-testid="input-files"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    document.getElementById('files').click();
                  }}
                  data-testid="select-files-button"
                >
                  Seleccionar Archivos
                </Button>
              </div>
              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-md" data-testid={`file-item-${index}`}>
                      <span className="text-sm text-slate-700">{file.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        data-testid={`remove-file-${index}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white"
                data-testid="submit-petition-button"
              >
                {loading ? (
                  'Enviando...'
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Enviar Petición
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="flex-1"
                data-testid="cancel-button"
              >
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
