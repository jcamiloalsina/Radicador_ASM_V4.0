import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Checkbox } from '../components/ui/checkbox';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import axios from 'axios';
import { UserCog, Search, Database, Download, Upload, Trash2, RefreshCw, HardDrive, FolderArchive, Clock, User, Eye, AlertTriangle, Loader2, CheckCircle, Settings, Play, Calendar, Timer } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('usuarios');
  
  // Estados para usuarios
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para base de datos
  const [dbStatus, setDbStatus] = useState(null);
  const [backups, setBackups] = useState([]);
  const [loadingDb, setLoadingDb] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [backupType, setBackupType] = useState('completo');
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  // Estados para configuración de backups automáticos
  const [backupConfig, setBackupConfig] = useState(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configForm, setConfigForm] = useState({
    modo: 'manual',
    frecuencia: 'diario',
    hora: '02:00',
    dia_semana: 0,
    dia_mes: 1,
    tipo_backup: 'completo',
    colecciones_seleccionadas: [],
    retener_ultimos: 7,
    notificar_email: true
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (activeTab === 'database') {
      fetchDbStatus();
      fetchBackups();
      fetchBackupConfig();
    }
  }, [activeTab]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = users.filter(
        (u) =>
          u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
  }, [searchTerm, users]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`);
      setUsers(response.data);
      setFilteredUsers(response.data);
    } catch (error) {
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const fetchDbStatus = async () => {
    setLoadingDb(true);
    try {
      const response = await axios.get(`${API}/database/status`);
      setDbStatus(response.data);
    } catch (error) {
      toast.error('Error al cargar estado de la BD');
    } finally {
      setLoadingDb(false);
    }
  };

  const fetchBackups = async () => {
    try {
      const response = await axios.get(`${API}/database/backups`);
      setBackups(response.data.backups || []);
    } catch (error) {
      console.error('Error al cargar backups:', error);
    }
  };

  const fetchBackupConfig = async () => {
    try {
      const response = await axios.get(`${API}/database/config`);
      setBackupConfig(response.data);
      setConfigForm({
        modo: response.data.modo || 'manual',
        frecuencia: response.data.frecuencia || 'diario',
        hora: response.data.hora || '02:00',
        dia_semana: response.data.dia_semana || 0,
        dia_mes: response.data.dia_mes || 1,
        tipo_backup: response.data.tipo_backup || 'completo',
        colecciones_seleccionadas: response.data.colecciones_seleccionadas || [],
        retener_ultimos: response.data.retener_ultimos || 7,
        notificar_email: response.data.notificar_email !== false
      });
    } catch (error) {
      console.error('Error al cargar configuración:', error);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const params = new URLSearchParams();
      params.append('modo', configForm.modo);
      params.append('frecuencia', configForm.frecuencia);
      params.append('hora', configForm.hora);
      params.append('dia_semana', configForm.dia_semana);
      params.append('dia_mes', configForm.dia_mes);
      params.append('tipo_backup', configForm.tipo_backup);
      params.append('retener_ultimos', configForm.retener_ultimos);
      params.append('notificar_email', configForm.notificar_email);
      if (configForm.tipo_backup === 'selectivo') {
        configForm.colecciones_seleccionadas.forEach(c => params.append('colecciones_seleccionadas', c));
      }
      
      await axios.put(`${API}/database/config?${params.toString()}`);
      toast.success('Configuración guardada');
      setShowConfigDialog(false);
      fetchBackupConfig();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al guardar configuración');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleExecuteScheduledBackup = async () => {
    try {
      const response = await axios.post(`${API}/database/backup/ejecutar-programado`);
      toast.success(`Backup programado iniciado (${response.data.colecciones} colecciones)`);
      fetchBackups();
      fetchBackupConfig();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al ejecutar backup');
    }
  };

  const handleCleanOldBackups = async () => {
    if (!window.confirm(`¿Está seguro de eliminar backups antiguos? Se conservarán los últimos ${backupConfig?.retener_ultimos || 7} backups.`)) {
      return;
    }
    try {
      const response = await axios.post(`${API}/database/backup/limpiar-antiguos`);
      toast.success(`${response.data.eliminados} backups eliminados`);
      fetchBackups();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al limpiar backups');
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await axios.patch(`${API}/users/role`, {
        user_id: userId,
        new_role: newRole
      });
      toast.success('Rol actualizado exitosamente');
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al actualizar el rol');
    }
  };

  const [backupStatus, setBackupStatus] = useState(null);
  const [currentBackupId, setCurrentBackupId] = useState(null);

  const pollBackupStatus = async (backupId) => {
    try {
      const response = await axios.get(`${API}/database/backup/${backupId}/status`);
      const status = response.data;
      setBackupStatus(status);
      
      if (status.status === 'completed') {
        toast.success('Backup completado exitosamente');
        setCreatingBackup(false);
        setShowBackupDialog(false);
        setBackupStatus(null);
        setCurrentBackupId(null);
        fetchBackups();
        fetchDbStatus();
      } else if (status.status === 'error') {
        toast.error(`Error en backup: ${status.error}`);
        setCreatingBackup(false);
        setBackupStatus(null);
        setCurrentBackupId(null);
      } else if (status.status === 'running') {
        // Seguir polling cada 2 segundos
        setTimeout(() => pollBackupStatus(backupId), 2000);
      }
    } catch (error) {
      console.error('Error polling backup status:', error);
      setTimeout(() => pollBackupStatus(backupId), 3000);
    }
  };

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    setBackupStatus({ status: 'starting', progress: 0 });
    try {
      const params = new URLSearchParams();
      params.append('tipo', backupType);
      if (backupType === 'selectivo' && selectedCollections.length > 0) {
        selectedCollections.forEach(c => params.append('colecciones', c));
      }
      
      const response = await axios.post(`${API}/database/backup?${params.toString()}`);
      const backupId = response.data.backup_id;
      setCurrentBackupId(backupId);
      toast.info('Backup iniciado en segundo plano...');
      
      // Iniciar polling del estado
      setTimeout(() => pollBackupStatus(backupId), 1000);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear backup');
      setCreatingBackup(false);
      setBackupStatus(null);
    }
  };

  const handleDownloadBackup = async (backup) => {
    try {
      const response = await axios.get(`${API}/database/backup/${backup.id}/download`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', backup.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Descarga iniciada');
    } catch (error) {
      toast.error('Error al descargar backup');
    }
  };

  const handleDeleteBackup = async (backupId) => {
    if (!window.confirm('¿Está seguro de eliminar este backup? Esta acción no se puede deshacer.')) {
      return;
    }
    
    try {
      await axios.delete(`${API}/database/backup/${backupId}`);
      toast.success('Backup eliminado');
      fetchBackups();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar backup');
    }
  };

  const handlePreviewBackup = async (backup) => {
    try {
      const response = await axios.get(`${API}/database/backup/${backup.id}/preview`);
      setPreviewData(response.data);
      setSelectedBackup(backup);
      setShowPreviewDialog(true);
    } catch (error) {
      toast.error('Error al cargar vista previa');
    }
  };

  const handleRestoreBackup = async () => {
    if (!selectedBackup) return;
    
    setRestoring(true);
    try {
      const response = await axios.post(`${API}/database/restore/${selectedBackup.id}`);
      toast.success(`Backup restaurado: ${response.data.total_registros} registros`);
      setShowRestoreDialog(false);
      setSelectedBackup(null);
      fetchDbStatus();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al restaurar backup');
    } finally {
      setRestoring(false);
    }
  };

  const getRoleBadge = (role) => {
    const roleConfig = {
      administrador: { label: 'Administrador', className: 'bg-rose-100 text-rose-700' },
      coordinador: { label: 'Coordinador', className: 'bg-purple-100 text-purple-700' },
      gestor: { label: 'Gestor', className: 'bg-emerald-100 text-emerald-700' },
      atencion_usuario: { label: 'Atención', className: 'bg-blue-100 text-blue-700' },
      comunicaciones: { label: 'Comunicaciones', className: 'bg-cyan-100 text-cyan-700' },
      usuario: { label: 'Usuario', className: 'bg-slate-100 text-slate-700' },
    };
    const config = roleConfig[role] || roleConfig.usuario;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-700"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="user-management-page">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 font-outfit" data-testid="page-heading">
          Gestión de Usuarios
        </h2>
        <p className="text-slate-600 mt-1">Administra usuarios y base de datos del sistema</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="usuarios" className="flex items-center gap-2">
            <UserCog className="w-4 h-4" />
            Usuarios
          </TabsTrigger>
          <TabsTrigger value="database" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            Base de Datos
          </TabsTrigger>
        </TabsList>

        {/* Tab Usuarios */}
        <TabsContent value="usuarios" className="mt-6 space-y-4">
          {/* Search */}
          <Card className="border-slate-200">
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nombre o correo..."
                  className="pl-10 focus-visible:ring-emerald-600"
                  data-testid="search-input"
                />
              </div>
            </CardContent>
          </Card>

          {/* Users List */}
          {filteredUsers.length === 0 ? (
            <Card className="border-slate-200">
              <CardContent className="pt-6 text-center py-12">
                <p className="text-slate-600" data-testid="no-users-message">
                  No se encontraron usuarios.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredUsers.map((user) => (
                <Card key={user.id} className="border-slate-200 hover:shadow-md transition-shadow" data-testid={`user-card-${user.id}`}>
                  <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="flex-1">
                        <CardTitle className="text-lg font-outfit text-slate-900" data-testid={`user-name-${user.id}`}>
                          {user.full_name}
                        </CardTitle>
                        <p className="text-sm text-slate-600 mt-1" data-testid={`user-email-${user.id}`}>
                          {user.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {getRoleBadge(user.role)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {user.id !== currentUser.id ? (
                      <div className="flex items-center gap-4">
                        <Label htmlFor={`role-${user.id}`} className="text-slate-700">Cambiar Rol</Label>
                        <Select 
                          value={user.role} 
                          onValueChange={(newRole) => handleRoleChange(user.id, newRole)}
                        >
                          <SelectTrigger className="focus:ring-emerald-600 w-48" data-testid={`role-select-${user.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="usuario">Usuario</SelectItem>
                            <SelectItem value="atencion_usuario">Atención al Usuario</SelectItem>
                            <SelectItem value="comunicaciones">Comunicaciones</SelectItem>
                            <SelectItem value="gestor">Gestor</SelectItem>
                            <SelectItem value="coordinador">Coordinador</SelectItem>
                            <SelectItem value="administrador">Administrador</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 italic">No puedes cambiar tu propio rol</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab Base de Datos */}
        <TabsContent value="database" className="mt-6 space-y-6">
          {/* Estado de la BD */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-slate-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-emerald-100">
                    <HardDrive className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Base de Datos</p>
                    <p className="text-lg font-bold text-slate-900">{dbStatus?.db_name || '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-slate-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-blue-100">
                    <FolderArchive className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Tamaño Total</p>
                    <p className="text-lg font-bold text-slate-900">{dbStatus?.total_size_mb || 0} MB</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-slate-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-purple-100">
                    <Clock className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Último Backup</p>
                    <p className="text-sm font-medium text-slate-900">
                      {dbStatus?.ultimo_backup ? formatDate(dbStatus.ultimo_backup.fecha) : 'Nunca'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Acciones Rápidas */}
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg font-outfit flex items-center gap-2">
                <Database className="w-5 h-5" />
                Acciones
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button 
                  onClick={() => { setBackupType('completo'); setShowBackupDialog(true); }}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Backup Completo
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => { setBackupType('selectivo'); setShowBackupDialog(true); }}
                  className="border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Backup Selectivo
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => { fetchDbStatus(); fetchBackups(); }}
                  disabled={loadingDb}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loadingDb ? 'animate-spin' : ''}`} />
                  Actualizar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Colecciones */}
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg font-outfit">
                Colecciones ({dbStatus?.collections_count || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingDb ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50">
                        <th className="text-left py-2 px-3 font-medium text-slate-700">Colección</th>
                        <th className="text-right py-2 px-3 font-medium text-slate-700">Registros</th>
                        <th className="text-right py-2 px-3 font-medium text-slate-700">Tamaño</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dbStatus?.collections?.sort((a, b) => b.count - a.count).map((coll) => (
                        <tr key={coll.name} className="border-b hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono text-xs">{coll.name}</td>
                          <td className="py-2 px-3 text-right">{coll.count.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right text-slate-500">{coll.size_mb} MB</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Historial de Backups */}
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg font-outfit flex items-center gap-2">
                <FolderArchive className="w-5 h-5" />
                Historial de Backups
              </CardTitle>
            </CardHeader>
            <CardContent>
              {backups.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No hay backups registrados</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50">
                        <th className="text-left py-2 px-3 font-medium text-slate-700">Fecha</th>
                        <th className="text-left py-2 px-3 font-medium text-slate-700">Tipo</th>
                        <th className="text-right py-2 px-3 font-medium text-slate-700">Tamaño</th>
                        <th className="text-right py-2 px-3 font-medium text-slate-700">Colecciones</th>
                        <th className="text-left py-2 px-3 font-medium text-slate-700">Creado por</th>
                        <th className="text-center py-2 px-3 font-medium text-slate-700">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backups.map((backup) => (
                        <tr key={backup.id} className="border-b hover:bg-slate-50">
                          <td className="py-2 px-3">{formatDate(backup.fecha)}</td>
                          <td className="py-2 px-3">
                            <Badge className={backup.tipo === 'completo' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}>
                              {backup.tipo}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-right">{backup.size_mb} MB</td>
                          <td className="py-2 px-3 text-right">{backup.colecciones_count}</td>
                          <td className="py-2 px-3 text-slate-600">{backup.creado_por}</td>
                          <td className="py-2 px-3">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePreviewBackup(backup)}
                                title="Vista previa"
                              >
                                <Eye className="w-4 h-4 text-slate-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownloadBackup(backup)}
                                title="Descargar"
                              >
                                <Download className="w-4 h-4 text-blue-600" />
                              </Button>
                              {currentUser?.role === 'administrador' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { setSelectedBackup(backup); setShowRestoreDialog(true); }}
                                    title="Restaurar"
                                  >
                                    <Upload className="w-4 h-4 text-amber-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteBackup(backup.id)}
                                    title="Eliminar"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-600" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog Crear Backup */}
      <Dialog open={showBackupDialog} onOpenChange={(open) => !creatingBackup && setShowBackupDialog(open)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              Crear Backup {backupType === 'completo' ? 'Completo' : 'Selectivo'}
            </DialogTitle>
            <DialogDescription>
              {backupType === 'completo' 
                ? 'Se respaldará toda la base de datos' 
                : 'Seleccione las colecciones que desea respaldar'}
            </DialogDescription>
          </DialogHeader>
          
          {/* Mostrar progreso si está creando backup */}
          {creatingBackup && backupStatus && (
            <div className="space-y-3 py-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                <span className="text-sm font-medium">
                  {backupStatus.status === 'starting' && 'Iniciando backup...'}
                  {backupStatus.status === 'running' && `Procesando: ${backupStatus.current_collection}`}
                  {backupStatus.status === 'completed' && 'Backup completado'}
                </span>
              </div>
              {backupStatus.progress > 0 && (
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div 
                    className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${backupStatus.progress}%` }}
                  />
                </div>
              )}
              <p className="text-xs text-slate-500">
                Progreso: {backupStatus.progress}% - Este proceso puede tardar varios minutos
              </p>
            </div>
          )}
          
          {!creatingBackup && backupType === 'selectivo' && dbStatus?.collections && (
            <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-3">
              {dbStatus.collections.filter(c => c.name !== 'backup_history').map((coll) => (
                <label key={coll.name} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer">
                  <Checkbox
                    checked={selectedCollections.includes(coll.name)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedCollections([...selectedCollections, coll.name]);
                      } else {
                        setSelectedCollections(selectedCollections.filter(c => c !== coll.name));
                      }
                    }}
                  />
                  <span className="flex-1 font-mono text-sm">{coll.name}</span>
                  <span className="text-xs text-slate-500">{coll.count.toLocaleString()} reg.</span>
                </label>
              ))}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBackupDialog(false)} disabled={creatingBackup}>
              {creatingBackup ? 'Procesando...' : 'Cancelar'}
            </Button>
            <Button 
              onClick={handleCreateBackup} 
              disabled={creatingBackup || (backupType === 'selectivo' && selectedCollections.length === 0)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {creatingBackup ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Crear Backup
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Restaurar Backup */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              Restaurar Backup
            </DialogTitle>
            <DialogDescription>
              Esta acción sobrescribirá los datos actuales de las colecciones seleccionadas.
            </DialogDescription>
          </DialogHeader>
          
          {selectedBackup && (
            <div className="space-y-3 py-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Fecha:</strong> {formatDate(selectedBackup.fecha)}
                </p>
                <p className="text-sm text-amber-800">
                  <strong>Colecciones:</strong> {selectedBackup.colecciones_count}
                </p>
                <p className="text-sm text-amber-800">
                  <strong>Registros:</strong> {selectedBackup.registros_total?.toLocaleString()}
                </p>
              </div>
              <p className="text-sm text-slate-600">
                ¿Está seguro de que desea restaurar este backup? Los datos actuales serán reemplazados.
              </p>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestoreDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleRestoreBackup} 
              disabled={restoring}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {restoring ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Restaurando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Restaurar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Vista Previa */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Vista Previa del Backup
            </DialogTitle>
          </DialogHeader>
          
          {previewData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Fecha:</span>
                  <span className="ml-2 font-medium">{formatDate(previewData.backup_info?.fecha)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Tipo:</span>
                  <span className="ml-2 font-medium">{previewData.backup_info?.tipo}</span>
                </div>
                <div>
                  <span className="text-slate-500">Tamaño:</span>
                  <span className="ml-2 font-medium">{previewData.backup_info?.size_mb} MB</span>
                </div>
                <div>
                  <span className="text-slate-500">Creado por:</span>
                  <span className="ml-2 font-medium">{previewData.backup_info?.creado_por}</span>
                </div>
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="text-left py-2 px-3">Colección</th>
                      <th className="text-right py-2 px-3">Registros</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.colecciones?.map((coll) => (
                      <tr key={coll.name} className="border-t">
                        <td className="py-2 px-3 font-mono text-xs">{coll.name}</td>
                        <td className="py-2 px-3 text-right">{coll.count.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
