import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter, DialogClose } from '../components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import { ArrowLeft, Save, Mail, Phone, MapPin, FileText, Calendar, Upload, Download, UserPlus, X, XCircle, CheckCircle, Paperclip, Send, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function PetitionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [petition, setPetition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [files, setFiles] = useState([]);
  const [gestores, setGestores] = useState([]);
  const [gestorSearch, setGestorSearch] = useState(''); // Búsqueda de gestores
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showFinalizarDialog, setShowFinalizarDialog] = useState(false);
  const [enviarArchivosFinalizacion, setEnviarArchivosFinalizacion] = useState(false);

  useEffect(() => {
    fetchPetition();
    if (user?.role !== 'usuario') {
      fetchGestores();
    }
  }, [id]);

  const fetchPetition = async () => {
    try {
      const response = await axios.get(`${API}/petitions/${id}`);
      setPetition(response.data);
      setEditData({
        estado: response.data.estado,
        notas: response.data.notas || '',
        nombre_completo: response.data.nombre_completo,
        correo: response.data.correo,
        telefono: response.data.telefono,
        tipo_tramite: response.data.tipo_tramite,
        municipio: response.data.municipio,
        observaciones_devolucion: response.data.observaciones_devolucion || '',
        gestor_id: '',
        comentario_asignacion: ''  // Comentario al asignar gestor
      });
    } catch (error) {
      toast.error('Error al cargar la petición');
      navigate('/dashboard/peticiones');
    } finally {
      setLoading(false);
    }
  };

  const fetchGestores = async () => {
    try {
      const response = await axios.get(`${API}/gestores`);
      setGestores(response.data);
    } catch (error) {
      console.error('Error fetching gestores:', error);
    }
  };

  // Función para verificar si debe mostrar diálogo de finalización
  const handleSaveClick = () => {
    // Si está cambiando a finalizado y hay archivos del staff, mostrar diálogo
    if (editData.estado === 'finalizado' && petition?.archivos_staff?.length > 0) {
      setShowFinalizarDialog(true);
    } else {
      handleUpdate(false);
    }
  };

  const handleUpdate = async (conArchivos = false) => {
    try {
      // Validar que si es devolución, tenga observaciones
      if (editData.estado === 'devuelto' && !editData.observaciones_devolucion?.trim()) {
        toast.error('Debe indicar las observaciones de devolución para que el usuario sepa qué corregir.');
        return;
      }
      
      // Validar que si es asignado y NO hay gestores previos, tenga gestor seleccionado
      const tieneGestoresPrevios = petition.gestores_asignados && petition.gestores_asignados.length > 0;
      if (editData.estado === 'asignado' && !editData.gestor_id && !tieneGestoresPrevios) {
        toast.error('Debe seleccionar un gestor para asignar el trámite.');
        return;
      }
      
      const updatePayload = user.role === 'coordinador' || user.role === 'administrador' ? editData : {
        estado: editData.estado,
        notas: editData.notas,
        observaciones_devolucion: editData.observaciones_devolucion
      };
      
      // Agregar flag de archivos si es finalización
      if (editData.estado === 'finalizado') {
        updatePayload.enviar_archivos_finalizacion = conArchivos;
      }
      
      await axios.patch(`${API}/petitions/${id}`, updatePayload);
      
      // Si hay gestor seleccionado, asignarlo con el comentario
      if (editData.estado === 'asignado' && editData.gestor_id) {
        await axios.post(`${API}/petitions/${id}/assign-gestor`, {
          petition_id: id,
          gestor_id: editData.gestor_id,
          is_auxiliar: false,
          comentario: editData.comentario_asignacion || null
        });
      }
      
      // Mensaje específico para devolución
      if (editData.estado === 'devuelto') {
        toast.success('Trámite devuelto. El usuario será notificado por correo con las observaciones.');
      } else if (editData.estado === 'asignado' && editData.gestor_id) {
        toast.success('Gestor agregado exitosamente al trámite.');
      } else if (editData.estado === 'asignado') {
        toast.success('Trámite actualizado.');
      } else {
        toast.success('¡Petición actualizada exitosamente!');
      }
      
      setEditing(false);
      setShowFinalizarDialog(false);
      // Limpiar el comentario después de guardar
      setEditData(prev => ({ ...prev, gestor_id: '', comentario_asignacion: '' }));
      fetchPetition();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al actualizar la petición');
    }
  };

  const handleFileUpload = async () => {
    if (files.length === 0) {
      toast.error('Selecciona al menos un archivo');
      return;
    }

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });

      await axios.post(`${API}/petitions/${id}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      // Si es staff interno (no usuario), automáticamente finalizar el trámite
      if (user?.role !== 'usuario') {
        try {
          await axios.patch(`${API}/petitions/${id}`, {
            estado: 'finalizado',
            enviar_archivos_finalizacion: true  // Enviar archivos adjuntos en el correo
          });
          toast.success('¡Documento subido y trámite finalizado! Se envió notificación con el archivo adjunto.');
        } catch (finalizarError) {
          toast.success('Archivos subidos exitosamente');
          toast.error('No se pudo finalizar automáticamente. Por favor cambie el estado manualmente.');
        }
      } else {
        toast.success('Archivos subidos exitosamente');
      }
      
      setFiles([]);
      setShowUploadDialog(false);
      fetchPetition();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al subir archivos');
    }
  };

  const handleReenviar = async () => {
    try {
      await axios.post(`${API}/petitions/${id}/reenviar`);
      toast.success('¡Petición reenviada para revisión! El gestor será notificado.');
      fetchPetition();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al reenviar la petición');
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      radicado: { label: 'Radicado', className: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
      asignado: { label: 'Asignado', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      en_proceso: { label: 'En Proceso', className: 'bg-sky-100 text-sky-800 border-sky-200' },
      revision: { label: 'En Revisión', className: 'bg-purple-100 text-purple-800 border-purple-200' },
      aprobado: { label: 'Aprobado', className: 'bg-teal-100 text-teal-800 border-teal-200' },
      rechazado: { label: 'Rechazado', className: 'bg-red-100 text-red-800 border-red-200' },
      devuelto: { label: 'Devuelto', className: 'bg-orange-100 text-orange-800 border-orange-200' },
      finalizado: { label: 'Finalizado', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    };
    const config = statusConfig[status] || statusConfig.radicado;
    return <Badge className={config.className} data-testid="petition-status-badge">{config.label}</Badge>;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const canEdit = user?.role !== 'usuario';
  const canEditAllFields = ['coordinador', 'administrador'].includes(user?.role);
  // Atención al usuario, coordinador y admin pueden asignar gestores
  const canAssignGestores = ['coordinador', 'administrador', 'atencion_usuario'].includes(user?.role);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-700"></div>
      </div>
    );
  }

  if (!petition) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="petition-detail-page">
      <Button
        onClick={() => navigate(-1)}
        variant="ghost"
        className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
        data-testid="back-button"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver
      </Button>

      {/* Header Card */}
      <Card className="border-slate-200">
        <CardHeader className="bg-gradient-to-br from-emerald-800 to-emerald-600 text-white rounded-t-lg">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-2xl font-outfit" data-testid="petition-radicado">
                {petition.radicado}
              </CardTitle>
              <p className="text-emerald-100 text-sm mt-1">Detalles completos de la petición</p>
            </div>
            {getStatusBadge(petition.estado)}
          </div>
        </CardHeader>
      </Card>

      {/* Alert for DEVUELTO petitions - User can resubmit */}
      {petition.estado === 'devuelto' && (petition.user_id === user?.id || ['coordinador', 'atencion_usuario', 'administrador'].includes(user?.role)) && (
        <Card className="border-orange-300 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Send className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-orange-900 mb-2">Trámite Devuelto - Requiere Correcciones</h3>
                <p className="text-sm text-orange-800 mb-3">
                  {petition.user_id === user?.id ? (
                    <>Su trámite ha sido devuelto por <strong>{petition.devuelto_por_nombre || 'el gestor'}</strong> para realizar correcciones. 
                    Por favor, revise las observaciones, realice los ajustes necesarios y reenvíe para revisión.</>
                  ) : (
                    <>Este trámite fue devuelto por <strong>{petition.devuelto_por_nombre || 'el gestor'}</strong>. 
                    Puede cargar documentos en nombre del solicitante y reasignar el trámite.</>
                  )}
                </p>
                {petition.observaciones_devolucion && (
                  <div className="bg-white p-4 rounded-md border border-orange-200 mb-4">
                    <p className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                      <Paperclip className="w-4 h-4" />
                      Observaciones del Gestor:
                    </p>
                    <p className="text-sm text-slate-900 whitespace-pre-line">{petition.observaciones_devolucion}</p>
                  </div>
                )}
                
                {/* Instrucciones claras para el usuario */}
                {petition.user_id === user?.id && (
                  <div className="bg-amber-100 border border-amber-300 rounded-lg p-3 mb-4">
                    <p className="text-sm font-medium text-amber-800">
                      📌 <strong>Pasos para subsanar:</strong>
                    </p>
                    <ol className="text-sm text-amber-700 mt-1 ml-4 list-decimal">
                      <li>Cargue los documentos corregidos usando el botón "Cargar Documentos"</li>
                      <li>Una vez cargados, haga clic en <strong>"Enviar Subsanación"</strong> para notificar al equipo</li>
                    </ol>
                  </div>
                )}
                
                <div className="flex flex-wrap gap-3">
                  <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="border-orange-400 text-orange-700 hover:bg-orange-100" data-testid="upload-correccion-button">
                        <Upload className="w-4 h-4 mr-2" />
                        1. Cargar Documentos
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Subir Documentos de Corrección</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <p className="text-sm text-slate-600">
                          Sube los documentos corregidos o adicionales solicitados.
                        </p>
                        <Input
                          type="file"
                          multiple
                          onChange={(e) => setFiles(Array.from(e.target.files))}
                          data-testid="upload-files-input"
                        />
                        {files.length > 0 && (
                          <div className="space-y-2">
                            {files.map((file, idx) => (
                              <div key={idx} className="text-sm text-slate-700 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                {file.name}
                              </div>
                            ))}
                          </div>
                        )}
                        <Button onClick={handleFileUpload} className="w-full bg-emerald-700 hover:bg-emerald-800" data-testid="confirm-upload-button">
                          Subir Archivos
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  {/* Botón Reenviar para el ciudadano - MÁS DESTACADO */}
                  {petition.user_id === user?.id && (
                    <Button 
                      onClick={handleReenviar}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md" 
                      data-testid="reenviar-button"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      2. Enviar Subsanación
                    </Button>
                  )}
                  
                  {/* Botón Reasignar para roles internos (Coordinador, Atención al Usuario, Admin) */}
                  {petition.user_id !== user?.id && ['coordinador', 'atencion_usuario', 'administrador'].includes(user?.role) && (
                    <Button 
                      onClick={async () => {
                        try {
                          const token = localStorage.getItem('token');
                          await axios.patch(`${API}/petitions/${petition.id}`, 
                            { estado: 'asignado' },
                            { headers: { Authorization: `Bearer ${token}` } }
                          );
                          toast.success('Trámite reasignado correctamente');
                          fetchPetition();
                        } catch (error) {
                          toast.error(error.response?.data?.detail || 'Error al reasignar');
                        }
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white" 
                      data-testid="reasignar-button"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Reasignar Trámite
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alert for rejected petitions - Citizens and internal staff can upload files */}
      {petition.estado === 'rechazado' && (petition.user_id === user?.id || ['coordinador', 'atencion_usuario', 'administrador'].includes(user?.role)) && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-900 mb-2">Trámite Rechazado - Requiere Subsanación</h3>
                <p className="text-sm text-red-800 mb-3">
                  {petition.user_id === user?.id ? (
                    <>Su trámite ha sido rechazado. Por favor, revise las notas del gestor y cargue los documentos solicitados para subsanar.</>
                  ) : (
                    <>Este trámite fue rechazado. Puede cargar documentos en nombre del solicitante y reasignar el trámite.</>
                  )}
                </p>
                {petition.notas && (
                  <div className="bg-white p-3 rounded-md border border-red-200 mb-4">
                    <p className="text-sm font-medium text-slate-700 mb-1">Motivo del Rechazo:</p>
                    <p className="text-sm text-slate-900">{petition.notas}</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-3">
                  <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                    <DialogTrigger asChild>
                      <Button className="bg-red-600 hover:bg-red-700 text-white" data-testid="subsanar-button">
                        <Upload className="w-4 h-4 mr-2" />
                        Cargar Documentos de Subsanación
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Subir Documentos de Subsanación</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <p className="text-sm text-slate-600">
                          Sube los documentos corregidos o adicionales solicitados por el gestor.
                        </p>
                        <Input
                          type="file"
                          multiple
                          onChange={(e) => setFiles(Array.from(e.target.files))}
                          data-testid="upload-files-input"
                        />
                        {files.length > 0 && (
                          <div className="space-y-2">
                            {files.map((file, idx) => (
                              <div key={idx} className="text-sm text-slate-700 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                {file.name}
                              </div>
                            ))}
                          </div>
                        )}
                        <Button onClick={handleFileUpload} className="w-full bg-emerald-700 hover:bg-emerald-800" data-testid="confirm-upload-button">
                          Subir Archivos
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  {/* Botón Reasignar para roles internos en peticiones rechazadas */}
                  {petition.user_id !== user?.id && ['coordinador', 'atencion_usuario', 'administrador'].includes(user?.role) && (
                    <Button 
                      onClick={async () => {
                        try {
                          const token = localStorage.getItem('token');
                          await axios.patch(`${API}/petitions/${petition.id}`, 
                            { estado: 'asignado' },
                            { headers: { Authorization: `Bearer ${token}` } }
                          );
                          toast.success('Trámite reasignado correctamente');
                          fetchPetition();
                        } catch (error) {
                          toast.error(error.response?.data?.detail || 'Error al reasignar');
                        }
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white" 
                      data-testid="reasignar-rechazado-button"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Reasignar Trámite
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {canEdit && !editing && (
        <div className="flex gap-3 flex-wrap">
          <Button
            onClick={() => setEditing(true)}
            className="bg-emerald-700 hover:bg-emerald-800 text-white"
            data-testid="edit-button"
          >
            Editar
          </Button>
        </div>
      )}

      {/* Gestores Asignados */}
      {user?.role !== 'usuario' && (
        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-slate-900 font-outfit">Gestores Asignados</CardTitle>
            <div className="flex gap-2">
              {/* Botón auto-asignarse */}
              {['atencion_usuario', 'coordinador', 'administrador', 'gestor'].includes(user?.role) && 
               !petition.gestores_asignados?.includes(user?.id) && 
               petition.estado !== 'finalizado' && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={async () => {
                    try {
                      const token = localStorage.getItem('token');
                      await axios.post(`${API}/petitions/${petition.id}/auto-asignar`, {}, {
                        headers: { Authorization: `Bearer ${token}` }
                      });
                      toast.success('Te has asignado al trámite');
                      fetchPetition();
                    } catch (error) {
                      toast.error(error.response?.data?.detail || 'Error al auto-asignarse');
                    }
                  }}
                  className="text-emerald-700 border-emerald-700 hover:bg-emerald-50"
                  data-testid="auto-asignar-btn"
                >
                  <UserPlus className="w-4 h-4 mr-1" />
                  Asignarme
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Lista de gestores asignados */}
            {petition.gestores_asignados && petition.gestores_asignados.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {petition.gestores_asignados.map((gestorId, idx) => {
                  const gestor = gestores.find(g => g.id === gestorId);
                  const canRemove = ['administrador', 'coordinador', 'atencion_usuario'].includes(user?.role) && 
                                   petition.estado !== 'finalizado';
                  return gestor ? (
                    <Badge 
                      key={idx} 
                      className="bg-blue-100 text-blue-800 flex items-center gap-1" 
                      data-testid={`gestor-badge-${idx}`}
                    >
                      {gestor.full_name}
                      {canRemove && (
                        <button
                          onClick={async () => {
                            if (!window.confirm(`¿Quitar a ${gestor.full_name} del trámite?`)) return;
                            try {
                              const token = localStorage.getItem('token');
                              await axios.delete(`${API}/petitions/${petition.id}/desasignar/${gestorId}`, {
                                headers: { Authorization: `Bearer ${token}` }
                              });
                              toast.success(`${gestor.full_name} removido del trámite`);
                              fetchPetition();
                            } catch (error) {
                              toast.error(error.response?.data?.detail || 'Error al quitar staff');
                            }
                          }}
                          className="ml-1 text-blue-600 hover:text-red-600 transition-colors"
                          data-testid={`remove-gestor-${idx}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </Badge>
                  ) : null;
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Sin gestores asignados</p>
            )}
            
            {/* Selector para asignar gestor - visible para atencion_usuario, coordinador, admin */}
            {canAssignGestores && petition.estado !== 'finalizado' && (
              <div className="border-t pt-4 mt-4">
                <p className="text-sm font-medium text-slate-700 mb-2">Asignar un gestor:</p>
                <div className="flex gap-2">
                  <Select 
                    onValueChange={async (gestorId) => {
                      if (!gestorId) return;
                      try {
                        const token = localStorage.getItem('token');
                        await axios.post(`${API}/petitions/${petition.id}/asignar/${gestorId}`, {}, {
                          headers: { Authorization: `Bearer ${token}` }
                        });
                        const gestor = gestores.find(g => g.id === gestorId);
                        toast.success(`${gestor?.full_name || 'Gestor'} asignado al trámite`);
                        fetchPetition();
                      } catch (error) {
                        toast.error(error.response?.data?.detail || 'Error al asignar gestor');
                      }
                    }}
                  >
                    <SelectTrigger className="flex-1" data-testid="asignar-gestor-select">
                      <SelectValue placeholder="Seleccionar gestor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {gestores
                        .filter(g => !petition.gestores_asignados?.includes(g.id))
                        .sort((a, b) => a.full_name.localeCompare(b.full_name))
                        .map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.full_name} ({g.role === 'atencion_usuario' ? 'Atención' : g.role === 'coordinador' ? 'Coordinador' : 'Gestor'})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Information Card */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-slate-900 font-outfit">Información del Solicitante</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {editing ? (
            <div className="space-y-4">
              {/* Campos no editables - datos del solicitante */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <p className="text-sm font-medium text-slate-600 mb-3">Datos del Solicitante (No editables)</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="nombre_completo" className="text-slate-500">Nombre Completo</Label>
                    <Input
                      id="nombre_completo"
                      value={editData.nombre_completo}
                      disabled
                      className="bg-slate-100 text-slate-700 cursor-not-allowed"
                      data-testid="edit-nombre-disabled"
                    />
                  </div>
                  <div>
                    <Label htmlFor="correo" className="text-slate-500">Correo Electrónico</Label>
                    <Input
                      id="correo"
                      value={editData.correo}
                      disabled
                      className="bg-slate-100 text-slate-700 cursor-not-allowed"
                      data-testid="edit-correo-disabled"
                    />
                  </div>
                  <div>
                    <Label htmlFor="telefono" className="text-slate-500">Teléfono</Label>
                    <Input
                      id="telefono"
                      value={editData.telefono}
                      disabled
                      className="bg-slate-100 text-slate-700 cursor-not-allowed"
                      data-testid="edit-telefono-disabled"
                    />
                  </div>
                </div>
              </div>

              {/* Campos editables solo para coordinador/admin */}
              {canEditAllFields && (
                <>
                  <div>
                    <Label htmlFor="tipo_tramite">Tipo de Trámite</Label>
                    <Input
                      id="tipo_tramite"
                      value={editData.tipo_tramite}
                      onChange={(e) => setEditData({ ...editData, tipo_tramite: e.target.value })}
                      data-testid="edit-tipo-tramite"
                    />
                  </div>
                  <div>
                    <Label htmlFor="municipio">Municipio</Label>
                    <Input
                      id="municipio"
                      value={editData.municipio}
                      onChange={(e) => setEditData({ ...editData, municipio: e.target.value })}
                      data-testid="edit-municipio"
                    />
                  </div>
                </>
              )}
              <div>
                <Label htmlFor="estado">Estado</Label>
                <Select value={editData.estado} onValueChange={(value) => setEditData({ ...editData, estado: value })}>
                  <SelectTrigger data-testid="edit-estado">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="radicado">Radicado</SelectItem>
                    <SelectItem value="asignado">Asignado</SelectItem>
                    <SelectItem value="en_proceso">En Proceso</SelectItem>
                    <SelectItem value="revision">En Revisión</SelectItem>
                    <SelectItem value="aprobado">Aprobado</SelectItem>
                    <SelectItem value="devuelto">Devuelto</SelectItem>
                    <SelectItem value="rechazado">Rechazado</SelectItem>
                    <SelectItem value="finalizado">Finalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Campo de observaciones para devolución */}
              {editData.estado === 'devuelto' && (
                <div className="border border-orange-200 bg-orange-50 p-4 rounded-lg">
                  <Label htmlFor="observaciones_devolucion" className="text-orange-800 font-medium">
                    Observaciones de Devolución *
                  </Label>
                  <p className="text-xs text-orange-600 mb-2">
                    Indique al usuario qué debe corregir para que pueda reenviar el trámite.
                  </p>
                  <Textarea
                    id="observaciones_devolucion"
                    value={editData.observaciones_devolucion}
                    onChange={(e) => setEditData({ ...editData, observaciones_devolucion: e.target.value })}
                    rows={4}
                    placeholder="Ej: Falta documento de identidad del propietario. Por favor adjuntar copia legible del documento."
                    className="border-orange-300 focus:border-orange-400"
                    data-testid="edit-observaciones-devolucion"
                  />
                </div>
              )}
              
              {/* Selector de Gestor cuando el estado es "asignado" */}
              {editData.estado === 'asignado' && (
                <div className="border border-blue-200 bg-blue-50 p-4 rounded-lg space-y-3">
                  <Label className="text-blue-800 font-medium">
                    Gestores del Trámite
                  </Label>
                  
                  {/* Mostrar gestores ya asignados */}
                  {petition.gestores_asignados && petition.gestores_asignados.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-blue-600 mb-2">Gestores asignados actualmente:</p>
                      <div className="flex flex-wrap gap-2">
                        {petition.gestores_asignados.map((gestorId, idx) => {
                          const gestor = gestores.find(g => g.id === gestorId);
                          return gestor ? (
                            <Badge key={idx} className="bg-blue-100 text-blue-800">
                              {gestor.full_name}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Selector para agregar nuevo gestor */}
                  <div>
                    <p className="text-xs text-blue-600 mb-2">
                      Agregar otro gestor al trámite:
                    </p>
                    <Select 
                      value={editData.gestor_id || ''} 
                      onValueChange={(value) => setEditData({ ...editData, gestor_id: value })}
                    >
                      <SelectTrigger data-testid="edit-gestor-select" className="border-blue-300">
                        <SelectValue placeholder="Seleccionar gestor a agregar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {gestores
                          .filter(g => !petition.gestores_asignados?.includes(g.id))
                          .sort((a, b) => a.full_name.localeCompare(b.full_name))
                          .map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.full_name} ({g.role === 'atencion_usuario' ? 'Atención al Usuario' : 'Gestor'})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {petition.gestores_asignados?.length > 0 && !editData.gestor_id && (
                      <p className="text-xs text-slate-500 mt-1 italic">
                        (Opcional - ya hay gestores asignados)
                      </p>
                    )}
                  </div>
                  
                  {/* Campo de comentario/instrucciones al asignar */}
                  {editData.gestor_id && (
                    <div className="mt-3">
                      <Label className="text-blue-800 text-sm">
                        Comentario o instrucciones (opcional)
                      </Label>
                      <Textarea
                        value={editData.comentario_asignacion || ''}
                        onChange={(e) => setEditData({ ...editData, comentario_asignacion: e.target.value })}
                        placeholder="Ej: Por favor revisar la documentación del predio X, verificar linderos..."
                        rows={2}
                        className="mt-1 border-blue-300 text-sm"
                        data-testid="comentario-asignacion"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Este comentario se guardará en el historial y se notificará al gestor asignado.
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              <div>
                <Label htmlFor="notas">Notas</Label>
                <Textarea
                  id="notas"
                  value={editData.notas}
                  onChange={(e) => setEditData({ ...editData, notas: e.target.value })}
                  rows={4}
                  placeholder="Agregue notas sobre esta petición..."
                  data-testid="edit-notas"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={handleSaveClick}
                  className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white"
                  data-testid="save-button"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Guardar Cambios
                </Button>
                <Button
                  onClick={() => setEditing(false)}
                  variant="outline"
                  className="flex-1"
                  data-testid="cancel-edit-button"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <FileText className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Nombre Completo</p>
                    <p className="font-medium text-slate-900" data-testid="petition-nombre">{petition.nombre_completo}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Mail className="w-5 h-5 text-blue-700" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Correo Electrónico</p>
                    <p className="font-medium text-slate-900" data-testid="petition-correo">{petition.correo}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Phone className="w-5 h-5 text-purple-700" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Teléfono</p>
                    <p className="font-medium text-slate-900" data-testid="petition-telefono">{petition.telefono}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <MapPin className="w-5 h-5 text-orange-700" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Municipio</p>
                    <p className="font-medium text-slate-900" data-testid="petition-municipio">{petition.municipio}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-6">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <FileText className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-500">Tipo de Trámite</p>
                    <p className="font-medium text-slate-900" data-testid="petition-tipo-tramite">{petition.tipo_tramite}</p>
                  </div>
                </div>
              </div>

              {/* Descripción/Notas del Solicitante */}
              {petition.descripcion && (
                <div className="border-t border-slate-200 pt-6">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <FileText className="w-5 h-5 text-amber-700" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-slate-500">Nota del Solicitante</p>
                      <p className="font-medium text-slate-900 whitespace-pre-line" data-testid="petition-descripcion">
                        {petition.descripcion}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Sección de Certificado Catastral - Solo para trámites de certificado */}
              {petition.tipo_tramite?.toLowerCase().includes('certificado') && (
                <div className="border-t border-slate-200 pt-6">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="w-5 h-5 text-emerald-700" />
                      <span className="font-semibold text-emerald-800">Certificado Catastral</span>
                    </div>
                    
                    {/* Si el certificado ya fue generado, mostrar descarga */}
                    {petition.certificado_generado ? (
                      <div className="space-y-3">
                        {petition.predio_relacionado && (
                          <div className="space-y-1 text-sm border-b border-emerald-200 pb-3">
                            <p><span className="text-slate-500">Código Predial:</span> <span className="font-mono font-medium">{petition.predio_relacionado.codigo_predial || 'N/A'}</span></p>
                            {petition.predio_relacionado.matricula && (
                              <p><span className="text-slate-500">Matrícula:</span> <span className="font-medium">{petition.predio_relacionado.matricula}</span></p>
                            )}
                            {petition.predio_relacionado.direccion && (
                              <p><span className="text-slate-500">Dirección:</span> <span className="font-medium">{petition.predio_relacionado.direccion}</span></p>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-3 flex-wrap">
                          <Badge className="bg-emerald-600">
                            <CheckCircle className="w-3 h-3 mr-1" /> Certificado Generado
                          </Badge>
                          <span className="text-xs text-slate-500">Código: {petition.certificado_codigo}</span>
                        </div>
                        <Button
                          variant="outline"
                          className="border-emerald-700 text-emerald-700 hover:bg-emerald-50"
                          onClick={async () => {
                            try {
                              const token = localStorage.getItem('token');
                              const response = await fetch(`${API}/petitions/${petition.id}/descargar-certificado`, {
                                headers: { 'Authorization': `Bearer ${token}` }
                              });
                              if (!response.ok) throw new Error('Error al descargar');
                              const blob = await response.blob();
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `Certificado_${petition.radicado}.pdf`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              window.URL.revokeObjectURL(url);
                            } catch (error) {
                              toast.error('Error al descargar el certificado');
                            }
                          }}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Descargar Certificado PDF
                        </Button>
                        
                        {/* Botón para regenerar certificado (actualizar con nueva fecha) */}
                        {['coordinador', 'administrador', 'atencion_usuario'].includes(user?.role) && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                className="border-amber-600 text-amber-700 hover:bg-amber-50"
                                data-testid="regenerar-certificado-btn"
                              >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Regenerar Certificado
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-amber-700">
                                  <RefreshCw className="w-5 h-5" />
                                  Regenerar Certificado Catastral
                                </DialogTitle>
                                <DialogDescription>
                                  Genera una nueva versión del certificado con fecha actualizada. El certificado anterior quedará inactivo.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                  <p className="text-sm text-amber-800 font-medium">⚠️ ¿Por qué regenerar?</p>
                                  <p className="text-sm text-amber-700 mt-1">
                                    Los certificados catastrales tienen vigencia de <strong>un (1) mes</strong>. Si el certificado original ya venció,
                                    puede generar uno nuevo con fecha actualizada manteniendo el mismo radicado.
                                  </p>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm">
                                  <p className="font-medium text-slate-700 mb-2">Información actual:</p>
                                  <p className="text-slate-600">Radicado: <strong>{petition.radicado}</strong></p>
                                  <p className="text-slate-600">Código anterior: <strong className="font-mono">{petition.certificado_codigo}</strong></p>
                                  <p className="text-slate-600">Fecha generación: <strong>{petition.certificado_fecha ? new Date(petition.certificado_fecha).toLocaleDateString('es-CO') : 'N/A'}</strong></p>
                                  {petition.regeneraciones_count > 0 && (
                                    <p className="text-slate-500 text-xs mt-2">
                                      Este certificado ya ha sido regenerado {petition.regeneraciones_count} vez(es)
                                    </p>
                                  )}
                                </div>
                              </div>
                              <DialogFooter className="gap-2">
                                <DialogClose asChild>
                                  <Button variant="outline">Cancelar</Button>
                                </DialogClose>
                                <Button
                                  className="bg-amber-600 hover:bg-amber-700"
                                  onClick={async () => {
                                    try {
                                      const token = localStorage.getItem('token');
                                      const response = await fetch(`${API}/petitions/${petition.id}/regenerar-certificado`, {
                                        method: 'POST',
                                        headers: { 
                                          'Authorization': `Bearer ${token}`,
                                          'Content-Type': 'application/json'
                                        }
                                      });
                                      if (!response.ok) {
                                        const errorData = await response.json();
                                        throw new Error(errorData.detail || 'Error al regenerar');
                                      }
                                      const blob = await response.blob();
                                      const url = window.URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = `Certificado_Actualizado_${petition.radicado}.pdf`;
                                      document.body.appendChild(a);
                                      a.click();
                                      document.body.removeChild(a);
                                      window.URL.revokeObjectURL(url);
                                      toast.success('Certificado regenerado exitosamente');
                                      // Recargar la petición para ver el nuevo código
                                      window.location.reload();
                                    } catch (error) {
                                      toast.error(error.message || 'Error al regenerar el certificado');
                                    }
                                  }}
                                >
                                  <RefreshCw className="w-4 h-4 mr-2" />
                                  Regenerar y Descargar
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    ) : petition.predio_relacionado ? (
                      <div className="space-y-3">
                        <div className="space-y-1 text-sm">
                          <p><span className="text-slate-500">Código Predial:</span> <span className="font-mono font-medium">{petition.predio_relacionado.codigo_predial || 'N/A'}</span></p>
                          {petition.predio_relacionado.matricula && (
                            <p><span className="text-slate-500">Matrícula:</span> <span className="font-medium">{petition.predio_relacionado.matricula}</span></p>
                          )}
                          {petition.predio_relacionado.direccion && (
                            <p><span className="text-slate-500">Dirección:</span> <span className="font-medium">{petition.predio_relacionado.direccion}</span></p>
                          )}
                        </div>
                        {/* Solo mostrar botón de generar certificado para "Certificado catastral sencillo" */}
                        {['gestor', 'coordinador', 'administrador', 'atencion_usuario'].includes(user?.role) && 
                         petition.tipo_tramite?.toLowerCase().trim().replace(/\s+/g, ' ') === 'certificado catastral sencillo' && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button className="bg-emerald-700 hover:bg-emerald-800" data-testid="generar-certificado-btn">
                                <FileText className="w-4 h-4 mr-2" />
                                Generar Certificado (Radicado: {petition.radicado})
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-emerald-800">
                                  <FileText className="w-5 h-5" />
                                  Generar Certificado Catastral
                                </DialogTitle>
                                <DialogDescription>
                                  El certificado incluye la firma digital de Dalgie Esperanza Torrado Rizo y el código QR de verificación.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                  <p className="text-sm text-blue-800 font-medium">📋 Radicado automático</p>
                                  <p className="text-sm text-blue-700 mt-1">
                                    El certificado se generará con el radicado <strong>{petition.radicado}</strong> de esta petición.
                                  </p>
                                </div>
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                  <p className="text-sm text-amber-800 font-medium">⚠️ Importante</p>
                                  <p className="text-sm text-amber-700 mt-1">
                                    El PDF se <strong>descargará</strong> para que pueda agregar el certificado/sello manual antes de entregarlo al peticionario. <strong>No se enviará automáticamente.</strong>
                                  </p>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                  <p className="text-sm text-slate-700">
                                    <strong>El trámite NO se finalizará</strong> - deberá finalizarlo manualmente después de entregar el certificado.
                                  </p>
                                </div>
                              </div>
                              <DialogFooter className="gap-2">
                                <Button variant="outline">Cancelar</Button>
                                <Button
                                  className="bg-emerald-700 hover:bg-emerald-800"
                                  onClick={async () => {
                                    try {
                                      toast.info('Generando certificado...');
                                      const token = localStorage.getItem('token');
                                      // NO enviar correo, solo descargar
                                      const response = await fetch(`${API}/petitions/${petition.id}/certificado?enviar_correo=false`, {
                                        headers: { 'Authorization': `Bearer ${token}` }
                                      });
                                      if (!response.ok) {
                                        const errorText = await response.text();
                                        let errorMsg = 'Error al generar';
                                        try {
                                          const errorJson = JSON.parse(errorText);
                                          errorMsg = errorJson.detail || errorMsg;
                                        } catch {
                                          errorMsg = errorText || errorMsg;
                                        }
                                        throw new Error(errorMsg);
                                      }
                                      const blob = await response.blob();
                                      const url = window.URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = `Certificado_${petition.radicado}.pdf`;
                                      document.body.appendChild(a);
                                      a.click();
                                      document.body.removeChild(a);
                                      window.URL.revokeObjectURL(url);
                                      toast.success('Certificado descargado. Recuerde agregar el sello/certificado manual y finalizar el trámite.');
                                      fetchPetition();
                                    } catch (error) {
                                      toast.error(error.message || 'Error al generar el certificado');
                                    }
                                  }}
                                >
                                  <Download className="w-4 h-4 mr-2" />
                                  Descargar PDF
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    ) : (
                      <div>
                        {(petition.codigo_predial_buscado || petition.matricula_buscada) ? (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-sm text-red-700 font-medium">❌ Certificado no disponible</p>
                            <p className="text-sm text-red-600 mt-1">
                              No se encontró un predio con {petition.codigo_predial_buscado ? `código predial: ${petition.codigo_predial_buscado}` : `matrícula: ${petition.matricula_buscada}`}
                            </p>
                          </div>
                        ) : (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                            <p className="text-sm text-amber-700">⚠️ No se especificó código predial ni matrícula en esta petición.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {petition.notas && (
                <div className="border-t border-slate-200 pt-6">
                  <p className="text-sm text-slate-500 mb-2">Notas</p>
                  <p className="text-slate-900" data-testid="petition-notas">{petition.notas}</p>
                </div>
              )}

              <div className="border-t border-slate-200 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <div>
                      <p className="text-slate-500">Creada</p>
                      <p className="font-medium text-slate-900" data-testid="petition-created-at">{formatDate(petition.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <div>
                      <p className="text-slate-500">Última actualización</p>
                      <p className="font-medium text-slate-900" data-testid="petition-updated-at">{formatDate(petition.updated_at)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Files Card */}
      <Card className="border-slate-200">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-slate-900 font-outfit">Documentos Adjuntos</CardTitle>
            <div className="flex gap-2">
              {/* Botón para ciudadanos: subir archivos propios */}
              {petition.user_id === user?.id && (
                <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="upload-more-button">
                      <Upload className="w-4 h-4 mr-2" />
                      Subir Más
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Subir Archivos</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <Input
                        type="file"
                        multiple
                        onChange={(e) => setFiles(Array.from(e.target.files))}
                        data-testid="upload-files-input"
                      />
                      {files.length > 0 && (
                        <div className="space-y-2">
                          {files.map((file, idx) => (
                            <div key={idx} className="text-sm text-slate-700">{file.name}</div>
                          ))}
                        </div>
                      )}
                      <Button onClick={handleFileUpload} className="w-full" data-testid="confirm-upload-button">
                        Subir Archivos
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              {/* Botón para personal: subir archivos finales (solo en modo edición o siempre visible) */}
              {user?.role !== 'usuario' && petition.user_id !== user?.id && (
                <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="staff-upload-button">
                      <Upload className="w-4 h-4 mr-2" />
                      Subir Documento Final
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Subir Documento Final</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                        <p className="text-sm text-emerald-800 font-medium">
                          ⚠️ Al subir el documento, el trámite se finalizará automáticamente y se enviará una notificación por correo al solicitante con el archivo adjunto.
                        </p>
                      </div>
                      <Input
                        type="file"
                        multiple
                        onChange={(e) => setFiles(Array.from(e.target.files))}
                        data-testid="staff-upload-input"
                      />
                      {files.length > 0 && (
                        <div className="space-y-2">
                          {files.map((file, idx) => (
                            <div key={idx} className="text-sm text-slate-700 flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              {file.name}
                            </div>
                          ))}
                        </div>
                      )}
                      <Button onClick={handleFileUpload} className="w-full bg-emerald-700 hover:bg-emerald-800" data-testid="confirm-staff-upload">
                        Subir y Finalizar Trámite
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              {user?.role !== 'usuario' && petition.archivos && petition.archivos.some(a => !a.uploaded_by_role || a.uploaded_by_role === 'usuario') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const response = await axios.get(`${API}/petitions/${id}/download-zip`, {
                        responseType: 'blob'
                      });
                      const url = window.URL.createObjectURL(new Blob([response.data]));
                      const link = document.createElement('a');
                      link.href = url;
                      link.setAttribute('download', `${petition.radicado}_archivos.zip`);
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                      window.URL.revokeObjectURL(url);
                      toast.success('ZIP descargado exitosamente');
                    } catch (error) {
                      toast.error(error.response?.data?.detail || 'Error al descargar ZIP');
                    }
                  }}
                  data-testid="download-zip-button"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Descargar ZIP (Usuario)
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {petition.archivos && petition.archivos.length > 0 ? (
            <div className="space-y-2">
              {petition.archivos.map((archivo, idx) => {
                const uploadedByRole = archivo.uploaded_by_role || 'usuario';
                const isCitizen = uploadedByRole === 'usuario';
                const badgeColor = isCitizen ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800';
                const roleLabel = isCitizen ? 'Usuario' : 'Personal';
                // Usar el id del archivo o filename para la descarga
                const fileId = archivo.id || archivo.filename;
                
                return (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-md border border-slate-200" data-testid={`file-${idx}`}>
                    <div className="flex items-center gap-3 flex-1">
                      <FileText className="w-4 h-4 text-slate-500" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-700">{archivo.original_name}</p>
                        {archivo.uploaded_by_name && (
                          <p className="text-xs text-slate-500">
                            Subido por: {archivo.uploaded_by_name}
                            {archivo.upload_date && ` - ${new Date(archivo.upload_date).toLocaleDateString('es-ES')}`}
                          </p>
                        )}
                      </div>
                      <Badge className={badgeColor}>{roleLabel}</Badge>
                    </div>
                    {fileId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          try {
                            const token = localStorage.getItem('token');
                            const response = await axios.get(`${API}/petitions/${id}/archivo/${fileId}`, {
                              headers: { Authorization: `Bearer ${token}` },
                              responseType: 'blob'
                            });
                            const url = window.URL.createObjectURL(new Blob([response.data]));
                            const link = document.createElement('a');
                            link.href = url;
                            link.setAttribute('download', archivo.original_name);
                            document.body.appendChild(link);
                            link.click();
                            link.remove();
                            window.URL.revokeObjectURL(url);
                          } catch (error) {
                            toast.error('Error al descargar el archivo');
                          }
                        }}
                        className="ml-2 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
                        data-testid={`download-file-${idx}`}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No hay archivos adjuntos</p>
          )}
        </CardContent>
      </Card>

      {/* Flujo de Trabajo Card - Solo para staff */}
      {user?.role !== 'usuario' && (
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-900 font-outfit flex items-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              Flujo del Trámite
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Timeline de estados */}
            <div className="flex items-center justify-between mb-6 overflow-x-auto pb-2">
              {['radicado', 'asignado', 'en_proceso', 'revision', 'aprobado', 'finalizado'].map((estado, idx) => {
                const labels = {
                  radicado: 'Radicado',
                  asignado: 'Asignado',
                  en_proceso: 'En Proceso',
                  revision: 'En Revisión',
                  aprobado: 'Aprobado',
                  finalizado: 'Finalizado'
                };
                const estadoActual = petition.estado;
                const estadoIndex = ['radicado', 'asignado', 'en_proceso', 'revision', 'aprobado', 'finalizado'].indexOf(estadoActual);
                const esteIndex = idx;
                const isPast = esteIndex < estadoIndex;
                const isCurrent = estado === estadoActual;
                const isRechazado = estadoActual === 'rechazado' || estadoActual === 'devuelto';
                
                return (
                  <React.Fragment key={estado}>
                    <div className="flex flex-col items-center min-w-[80px]">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        isRechazado && isCurrent ? 'bg-red-500 text-white' :
                        isCurrent ? 'bg-emerald-500 text-white ring-4 ring-emerald-100' :
                        isPast ? 'bg-emerald-200 text-emerald-800' :
                        'bg-slate-200 text-slate-500'
                      }`}>
                        {isPast ? '✓' : idx + 1}
                      </div>
                      <span className={`text-xs mt-1 text-center ${
                        isCurrent ? 'font-bold text-emerald-700' : 
                        isPast ? 'text-emerald-600' : 'text-slate-400'
                      }`}>
                        {labels[estado]}
                      </span>
                    </div>
                    {idx < 5 && (
                      <div className={`flex-1 h-1 mx-1 ${
                        isPast ? 'bg-emerald-300' : 'bg-slate-200'
                      }`}></div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            
            {/* Estado especial si está rechazado o devuelto */}
            {(petition.estado === 'rechazado' || petition.estado === 'devuelto') && (
              <div className={`p-3 rounded-lg mb-4 ${
                petition.estado === 'rechazado' ? 'bg-red-50 border border-red-200' : 'bg-orange-50 border border-orange-200'
              }`}>
                <p className={`text-sm font-medium ${
                  petition.estado === 'rechazado' ? 'text-red-800' : 'text-orange-800'
                }`}>
                  {petition.estado === 'rechazado' ? '❌ Trámite Rechazado' : '↩️ Trámite Devuelto para Correcciones'}
                </p>
              </div>
            )}

            {/* Info de aprobación si existe */}
            {petition.aprobado_por_nombre && (
              <div className="p-3 rounded-lg mb-4 bg-teal-50 border border-teal-200">
                <p className="text-sm text-teal-800">
                  <span className="font-medium">✓ Aprobado por:</span> {petition.aprobado_por_nombre}
                  {petition.fecha_aprobacion && (
                    <span className="text-teal-600 ml-2">
                      ({new Date(petition.fecha_aprobacion).toLocaleDateString('es-ES')})
                    </span>
                  )}
                </p>
                {petition.comentario_aprobacion && (
                  <p className="text-sm text-teal-700 mt-1 italic">"{petition.comentario_aprobacion}"</p>
                )}
              </div>
            )}

            {/* Gestores asignados y su estado */}
            {petition.gestores_asignados?.length > 0 && (
              <div className="border rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Gestores Asignados</h4>
                <div className="space-y-2">
                  {petition.gestores_asignados.map(gestorId => {
                    const gestor = gestores.find(g => g.id === gestorId);
                    const completado = petition.gestores_finalizados?.includes(gestorId);
                    const esUsuarioActual = gestorId === user?.id;
                    
                    return (
                      <div key={gestorId} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${completado ? 'bg-emerald-500' : 'bg-amber-400'}`}></div>
                          <span className="text-sm font-medium text-slate-700">
                            {gestor?.full_name || 'Gestor'}
                            {esUsuarioActual && <span className="text-xs text-blue-600 ml-1">(Tú)</span>}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {completado ? (
                            <Badge className="bg-emerald-100 text-emerald-700">Completado</Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-700">Trabajando</Badge>
                          )}
                          {esUsuarioActual && ['asignado', 'en_proceso'].includes(petition.estado) && (
                            completado ? (
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-xs border-amber-400 text-amber-700 hover:bg-amber-50"
                                onClick={async () => {
                                  try {
                                    await axios.post(`${API}/petitions/${petition.id}/desmarcar-completado`);
                                    toast.success('Trabajo desmarcado');
                                    fetchPetition();
                                  } catch (error) {
                                    toast.error(error.response?.data?.detail || 'Error');
                                  }
                                }}
                              >
                                Retomar
                              </Button>
                            ) : (
                              <Button 
                                size="sm" 
                                className="text-xs bg-emerald-600 hover:bg-emerald-700"
                                onClick={async () => {
                                  try {
                                    await axios.post(`${API}/petitions/${petition.id}/marcar-completado`);
                                    toast.success('Trabajo marcado como completado');
                                    fetchPetition();
                                  } catch (error) {
                                    toast.error(error.response?.data?.detail || 'Error');
                                  }
                                }}
                              >
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Marcar Completado
                              </Button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Resumen del progreso */}
                <div className="mt-3 pt-3 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Progreso de gestores:</span>
                    <span className="font-medium">
                      {petition.gestores_finalizados?.length || 0} / {petition.gestores_asignados.length} completados
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                    <div 
                      className="bg-emerald-500 h-2 rounded-full transition-all" 
                      style={{ width: `${((petition.gestores_finalizados?.length || 0) / petition.gestores_asignados.length) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Historial Card */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-slate-900 font-outfit">Historial del Trámite</CardTitle>
        </CardHeader>
        <CardContent>
          {petition.historial && petition.historial.length > 0 ? (
            <div className="relative space-y-6" data-testid="historial-timeline">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200"></div>
              
              {petition.historial.map((entry, idx) => {
                const fecha = new Date(entry.fecha);
                const fechaFormateada = fecha.toLocaleDateString('es-ES', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });
                
                // Determine icon and color based on action
                let IconComponent = Calendar;
                let iconBgColor = 'bg-blue-100';
                let iconColor = 'text-blue-600';
                
                if (entry.accion.includes('Radicado')) {
                  IconComponent = FileText;
                  iconBgColor = 'bg-indigo-100';
                  iconColor = 'text-indigo-600';
                } else if (entry.accion.includes('asignado') || entry.accion.includes('Asignado')) {
                  IconComponent = UserPlus;
                  iconBgColor = 'bg-yellow-100';
                  iconColor = 'text-yellow-600';
                } else if (entry.estado_nuevo === 'finalizado') {
                  IconComponent = CheckCircle;
                  iconBgColor = 'bg-emerald-100';
                  iconColor = 'text-emerald-600';
                } else if (entry.estado_nuevo === 'rechazado') {
                  IconComponent = XCircle;
                  iconBgColor = 'bg-red-100';
                  iconColor = 'text-red-600';
                } else if (entry.accion.includes('archivos') || entry.accion.includes('Archivos')) {
                  IconComponent = Upload;
                  iconBgColor = 'bg-purple-100';
                  iconColor = 'text-purple-600';
                }
                
                return (
                  <div key={idx} className="relative flex gap-4 pl-10" data-testid={`historial-entry-${idx}`}>
                    {/* Timeline dot/icon */}
                    <div className={`absolute left-0 ${iconBgColor} p-2 rounded-full`}>
                      <IconComponent className={`w-4 h-4 ${iconColor}`} />
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 pb-6">
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <div className="flex justify-between items-start mb-2">
                          <p className="font-medium text-slate-900">{entry.accion}</p>
                          <span className="text-xs text-slate-500">{fechaFormateada}</span>
                        </div>
                        <p className="text-sm text-slate-600 mb-1">
                          Por: <span className="font-medium">{entry.usuario}</span>
                          <span className="text-xs text-slate-500 ml-2">
                            ({entry.usuario_rol === 'atencion_usuario' ? 'Atención al Usuario' : 
                              entry.usuario_rol === 'gestor_auxiliar' ? 'Gestor Auxiliar' : 
                              entry.usuario_rol.charAt(0).toUpperCase() + entry.usuario_rol.slice(1)})
                          </span>
                        </p>
                        {entry.notas && (
                          <p className="text-sm text-slate-700 mt-2 p-2 bg-white rounded border border-slate-200">
                            {entry.notas}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No hay historial disponible</p>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de confirmación de finalización */}
      <Dialog open={showFinalizarDialog} onOpenChange={setShowFinalizarDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <CheckCircle className="w-5 h-5" />
              Finalizar Trámite
            </DialogTitle>
            <DialogDescription>
              El trámite será marcado como finalizado y se notificará al solicitante por correo electrónico.
            </DialogDescription>
          </DialogHeader>
          
          {petition?.archivos_staff?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 my-4">
              <div className="flex items-start gap-3">
                <Paperclip className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">
                    Archivos disponibles para enviar
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    Has cargado {petition.archivos_staff.length} archivo(s) de respuesta. 
                    ¿Deseas enviarlos adjuntos en el correo de finalización?
                  </p>
                  <ul className="mt-2 text-xs text-amber-600 space-y-1">
                    {petition.archivos_staff.slice(0, 3).map((archivo, idx) => (
                      <li key={idx} className="truncate">📎 {archivo.filename}</li>
                    ))}
                    {petition.archivos_staff.length > 3 && (
                      <li>... y {petition.archivos_staff.length - 3} más</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowFinalizarDialog(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            {petition?.archivos_staff?.length > 0 ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleUpdate(false)}
                  className="flex-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Solo Notificar
                </Button>
                <Button
                  onClick={() => handleUpdate(true)}
                  className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white"
                >
                  <Paperclip className="w-4 h-4 mr-2" />
                  Notificar + Archivos
                </Button>
              </>
            ) : (
              <Button
                onClick={() => handleUpdate(false)}
                className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                <Send className="w-4 h-4 mr-2" />
                Finalizar y Notificar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
