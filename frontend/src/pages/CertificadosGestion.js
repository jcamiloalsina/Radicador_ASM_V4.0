import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { 
  FileText, Search, XCircle, CheckCircle, ExternalLink, 
  Calendar, User, Hash, MapPin, AlertTriangle, Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function CertificadosGestion() {
  const { user } = useAuth();
  const [certificados, setCertificados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [showAnularDialog, setShowAnularDialog] = useState(false);
  const [certificadoToAnular, setCertificadoToAnular] = useState(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [anulando, setAnulando] = useState(false);

  const canAnular = ['coordinador', 'administrador'].includes(user?.role);

  useEffect(() => {
    fetchCertificados();
  }, [filtroEstado]);

  const fetchCertificados = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const estadoParam = filtroEstado !== 'todos' ? `&estado=${filtroEstado}` : '';
      const response = await fetch(`${API}/certificados/verificables?limit=100${estadoParam}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Error al cargar certificados');
      const data = await response.json();
      setCertificados(data.certificados || []);
    } catch (error) {
      toast.error('Error al cargar los certificados');
    } finally {
      setLoading(false);
    }
  };

  const handleAnular = async () => {
    if (!motivoAnulacion.trim()) {
      toast.error('Debe ingresar un motivo de anulación');
      return;
    }
    setAnulando(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('motivo', motivoAnulacion);
      
      const response = await fetch(`${API}/certificados/${certificadoToAnular.codigo_verificacion}/anular`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Error al anular');
      }
      
      toast.success('Certificado anulado correctamente');
      setShowAnularDialog(false);
      setCertificadoToAnular(null);
      setMotivoAnulacion('');
      fetchCertificados();
    } catch (error) {
      toast.error(error.message || 'Error al anular el certificado');
    } finally {
      setAnulando(false);
    }
  };

  const openAnularDialog = (cert) => {
    setCertificadoToAnular(cert);
    setMotivoAnulacion('');
    setShowAnularDialog(true);
  };

  const formatFecha = (fechaStr) => {
    if (!fechaStr) return 'N/A';
    try {
      const fecha = new Date(fechaStr);
      return fecha.toLocaleDateString('es-CO', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return fechaStr;
    }
  };

  const filteredCertificados = certificados.filter(cert => {
    const matchSearch = searchTerm === '' || 
      cert.codigo_verificacion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cert.codigo_predial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cert.municipio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cert.generado_por_nombre?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchSearch;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestión de Certificados</h1>
          <p className="text-slate-500">Historial y administración de certificados catastrales verificables</p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Buscar por código, predio, municipio..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filtroEstado === 'todos' ? 'default' : 'outline'}
                onClick={() => setFiltroEstado('todos')}
                className={filtroEstado === 'todos' ? 'bg-emerald-700' : ''}
              >
                Todos
              </Button>
              <Button
                variant={filtroEstado === 'activo' ? 'default' : 'outline'}
                onClick={() => setFiltroEstado('activo')}
                className={filtroEstado === 'activo' ? 'bg-emerald-700' : ''}
              >
                <CheckCircle className="w-4 h-4 mr-1" /> Activos
              </Button>
              <Button
                variant={filtroEstado === 'anulado' ? 'default' : 'outline'}
                onClick={() => setFiltroEstado('anulado')}
                className={filtroEstado === 'anulado' ? 'bg-red-600' : ''}
              >
                <XCircle className="w-4 h-4 mr-1" /> Anulados
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Certificados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-700" />
            Certificados Generados ({filteredCertificados.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-700" />
            </div>
          ) : filteredCertificados.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No se encontraron certificados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCertificados.map((cert) => (
                <div 
                  key={cert.id} 
                  className={`border rounded-lg p-4 ${cert.estado === 'anulado' ? 'bg-red-50 border-red-200' : 'bg-white hover:bg-slate-50'}`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <Badge variant={cert.estado === 'activo' ? 'default' : 'destructive'} 
                               className={cert.estado === 'activo' ? 'bg-emerald-600' : ''}>
                          {cert.estado === 'activo' ? (
                            <><CheckCircle className="w-3 h-3 mr-1" /> Válido</>
                          ) : (
                            <><XCircle className="w-3 h-3 mr-1" /> Anulado</>
                          )}
                        </Badge>
                        <span className="font-mono font-bold text-emerald-800">{cert.codigo_verificacion}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <div className="flex items-center gap-1 text-slate-600">
                          <Hash className="w-3 h-3" />
                          <span className="truncate">{cert.codigo_predial || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-600">
                          <MapPin className="w-3 h-3" />
                          <span>{cert.municipio || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-600">
                          <User className="w-3 h-3" />
                          <span>{cert.generado_por_nombre || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-600">
                          <Calendar className="w-3 h-3" />
                          <span>{formatFecha(cert.fecha_generacion)}</span>
                        </div>
                      </div>

                      {cert.estado === 'anulado' && cert.motivo_anulacion && (
                        <div className="mt-2 p-2 bg-red-100 rounded text-sm text-red-700">
                          <strong>Motivo:</strong> {cert.motivo_anulacion}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`${API}/verificar/${cert.codigo_verificacion}`, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Ver Verificación
                      </Button>
                      
                      {canAnular && cert.estado === 'activo' && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => openAnularDialog(cert)}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Anular
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Anulación */}
      <Dialog open={showAnularDialog} onOpenChange={setShowAnularDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Anular Certificado
            </DialogTitle>
          </DialogHeader>
          
          {certificadoToAnular && (
            <div className="space-y-4">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">
                  <strong>¡Atención!</strong> Esta acción es irreversible. El certificado quedará marcado como anulado 
                  y cualquier persona que lo verifique verá que ya no es válido.
                </p>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm"><strong>Código:</strong> {certificadoToAnular.codigo_verificacion}</p>
                <p className="text-sm"><strong>Predio:</strong> {certificadoToAnular.codigo_predial || 'N/A'}</p>
                <p className="text-sm"><strong>Municipio:</strong> {certificadoToAnular.municipio || 'N/A'}</p>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Motivo de Anulación *</label>
                <Textarea
                  placeholder="Ingrese el motivo por el cual se anula este certificado..."
                  value={motivoAnulacion}
                  onChange={(e) => setMotivoAnulacion(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAnularDialog(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleAnular}
              disabled={anulando || !motivoAnulacion.trim()}
            >
              {anulando ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Anulando...</>
              ) : (
                <><XCircle className="w-4 h-4 mr-2" /> Confirmar Anulación</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
