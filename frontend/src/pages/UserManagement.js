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

  // Estados para cargar backup desde archivo
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadingBackup, setUploadingBackup] = useState(false);
  const [uploadAnalysis, setUploadAnalysis] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = React.useRef(null);

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

  // Funciones para cargar backup desde archivo
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.name.endsWith('.zip')) {
        toast.error('Solo se permiten archivos .zip');
        return;
      }
      setSelectedFile(file);
      analyzeBackupFile(file);
    }
  };

  const analyzeBackupFile = async (file) => {
    setUploadingBackup(true);
    setUploadAnalysis(null);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await axios.post(`${API}/database/backup/analizar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadAnalysis(response.data);
      setShowUploadDialog(true);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al analizar el backup');
      setSelectedFile(null);
    } finally {
      setUploadingBackup(false);
    }
  };

  const handleRestoreFromFile = async () => {
    if (!selectedFile || !uploadAnalysis) return;
    
    const confirmMsg = `⚠️ ADVERTENCIA: Esta acción restaurará la base de datos.\n\n` +
      `Se modificarán ${uploadAnalysis.total_colecciones} colecciones.\n` +
      `Registros en backup: ${uploadAnalysis.total_registros?.toLocaleString()}\n\n` +
      `¿Está seguro de continuar?`;
    
    if (!window.confirm(confirmMsg)) return;
    
    setRestoring(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    
    try {
      const response = await axios.post(`${API}/database/backup/restaurar-archivo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(`Backup restaurado: ${response.data.colecciones_restauradas} colecciones, ${response.data.registros_restaurados?.toLocaleString()} registros`);
      setShowUploadDialog(false);
      setSelectedFile(null);
      setUploadAnalysis(null);
      fetchDbStatus();
      fetchBackups();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al restaurar el backup');
    } finally {
      setRestoring(false);
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

  // Funciones para gestionar colecciones
  const handleEmptyCollection = async (collectionName) => {
    const confirmMsg = `⚠️ ¿Está seguro de VACIAR la colección "${collectionName}"?\n\nEsto eliminará TODOS los registros pero mantendrá la colección.\n\nEsta acción NO se puede deshacer.`;
    if (!window.confirm(confirmMsg)) return;
    
    // Segunda confirmación para colecciones críticas
    const criticalCollections = ['predios', 'users', 'predios_historico', 'petitions'];
    if (criticalCollections.includes(collectionName)) {
      const secondConfirm = window.prompt(`Esta es una colección CRÍTICA. Escriba "${collectionName}" para confirmar:`);
      if (secondConfirm !== collectionName) {
        toast.error('Operación cancelada - nombre incorrecto');
        return;
      }
    }
    
    try {
      const response = await axios.post(`${API}/database/collection/${collectionName}/empty`);
      toast.success(`Colección "${collectionName}" vaciada: ${response.data.deleted_count} registros eliminados`);
      fetchDbStatus();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al vaciar colección');
    }
  };

  const handleDropCollection = async (collectionName) => {
    const confirmMsg = `🚨 ¿Está seguro de ELIMINAR la colección "${collectionName}"?\n\nEsto eliminará la colección COMPLETAMENTE de la base de datos.\n\nEsta acción NO se puede deshacer.`;
    if (!window.confirm(confirmMsg)) return;
    
    const secondConfirm = window.prompt(`Escriba "${collectionName}" para confirmar la ELIMINACIÓN:`);
    if (secondConfirm !== collectionName) {
      toast.error('Operación cancelada - nombre incorrecto');
      return;
    }
    
    try {
      await axios.delete(`${API}/database/collection/${collectionName}`);
      toast.success(`Colección "${collectionName}" eliminada completamente`);
      fetchDbStatus();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar colección');
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
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingBackup}
                  className="border-blue-600 text-blue-700 hover:bg-blue-50"
                >
                  {uploadingBackup ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Cargar Backup
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  onChange={handleFileSelect}
                  className="hidden"
                />
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

          {/* Configuración de Backups Automáticos */}
          <Card className="border-slate-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-outfit flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Configuración de Backups
                </CardTitle>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowConfigDialog(true)}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Configurar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Modo */}
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Modo</p>
                  <div className="flex items-center gap-2">
                    <Badge className={backupConfig?.modo === 'automatico' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}>
                      {backupConfig?.modo === 'automatico' ? 'Automático' : 'Manual'}
                    </Badge>
                    {backupConfig?.modo === 'automatico' && (
                      <Badge className="bg-blue-100 text-blue-700">{backupConfig?.frecuencia}</Badge>
                    )}
                  </div>
                </div>

                {/* Hora */}
                {backupConfig?.modo === 'automatico' && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Hora de Ejecución</p>
                    <p className="font-medium flex items-center gap-2">
                      <Timer className="w-4 h-4 text-slate-400" />
                      {backupConfig?.hora || '02:00'}
                    </p>
                  </div>
                )}

                {/* Próximo Backup */}
                {backupConfig?.modo === 'automatico' && backupConfig?.proximo_backup && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Próximo Backup</p>
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      {formatDate(backupConfig.proximo_backup)}
                    </p>
                  </div>
                )}

                {/* Retención */}
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Retención</p>
                  <p className="font-medium">Últimos {backupConfig?.retener_ultimos || 7} backups</p>
                </div>
              </div>

              {/* Acciones de configuración */}
              <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t">
                {backupConfig?.modo === 'automatico' && (
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={handleExecuteScheduledBackup}
                    className="border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Ejecutar Backup Programado
                  </Button>
                )}
                {currentUser?.role === 'administrador' && backups.length > (backupConfig?.retener_ultimos || 7) && (
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={handleCleanOldBackups}
                    className="border-amber-600 text-amber-700 hover:bg-amber-50"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Limpiar Backups Antiguos ({backups.length - (backupConfig?.retener_ultimos || 7)})
                  </Button>
                )}
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
                        {currentUser?.role === 'administrador' && (
                          <th className="text-center py-2 px-3 font-medium text-slate-700">Acciones</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {dbStatus?.collections?.sort((a, b) => b.count - a.count).map((coll) => (
                        <tr key={coll.name} className="border-b hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono text-xs">{coll.name}</td>
                          <td className="py-2 px-3 text-right">{coll.count.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right text-slate-500">{coll.size_mb} MB</td>
                          {currentUser?.role === 'administrador' && (
                            <td className="py-2 px-3">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEmptyCollection(coll.name)}
                                  title="Vaciar colección (eliminar registros)"
                                  className="h-7 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                  disabled={coll.count === 0}
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                                  <span className="text-xs">Vaciar</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDropCollection(coll.name)}
                                  title="Eliminar colección completamente"
                                  className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                                  <span className="text-xs">Eliminar</span>
                                </Button>
                              </div>
                            </td>
                          )}
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
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-outfit flex items-center gap-2">
                  <FolderArchive className="w-5 h-5" />
                  Historial de Backups ({backups.length})
                </CardTitle>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={fetchBackups}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Actualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {backups.length === 0 ? (
                <div className="text-center py-8">
                  <FolderArchive className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500">No hay backups registrados</p>
                  <p className="text-sm text-slate-400 mt-1">Crea tu primer backup usando los botones de arriba</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50">
                        <th className="text-left py-2 px-3 font-medium text-slate-700">Fecha</th>
                        <th className="text-left py-2 px-3 font-medium text-slate-700">Tipo</th>
                        <th className="text-right py-2 px-3 font-medium text-slate-700">Tamaño</th>
                        <th className="text-right py-2 px-3 font-medium text-slate-700">Registros</th>
                        <th className="text-right py-2 px-3 font-medium text-slate-700">Colecciones</th>
                        <th className="text-left py-2 px-3 font-medium text-slate-700">Creado por</th>
                        <th className="text-center py-2 px-3 font-medium text-slate-700">Estado</th>
                        <th className="text-center py-2 px-3 font-medium text-slate-700">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backups.map((backup) => (
                        <tr key={backup.id} className="border-b hover:bg-slate-50">
                          <td className="py-2 px-3">
                            <div>
                              <p className="font-medium">{formatDate(backup.fecha)}</p>
                              <p className="text-xs text-slate-400 font-mono">{backup.filename}</p>
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <Badge className={
                              backup.tipo === 'completo' ? 'bg-emerald-100 text-emerald-700' : 
                              backup.tipo === 'selectivo' ? 'bg-blue-100 text-blue-700' :
                              backup.tipo === 'restauracion_archivo' ? 'bg-purple-100 text-purple-700' :
                              'bg-slate-100 text-slate-700'
                            }>
                              {backup.tipo === 'restauracion_archivo' ? 'restauración' : backup.tipo}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-right font-mono">{backup.size_mb || '—'} MB</td>
                          <td className="py-2 px-3 text-right font-mono">{backup.registros_total?.toLocaleString() || '—'}</td>
                          <td className="py-2 px-3 text-right">{backup.colecciones_count || backup.colecciones?.length || '—'}</td>
                          <td className="py-2 px-3 text-slate-600 text-xs">{backup.creado_por}</td>
                          <td className="py-2 px-3 text-center">
                            <Badge className={
                              backup.estado === 'completado' ? 'bg-green-100 text-green-700' :
                              backup.estado === 'en_progreso' ? 'bg-yellow-100 text-yellow-700' :
                              backup.estado === 'restaurado' ? 'bg-purple-100 text-purple-700' :
                              backup.estado === 'error' ? 'bg-red-100 text-red-700' :
                              'bg-slate-100 text-slate-600'
                            }>
                              {backup.estado || 'completado'}
                            </Badge>
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePreviewBackup(backup)}
                                title="Vista previa"
                                className="h-8 w-8 p-0"
                              >
                                <Eye className="w-4 h-4 text-slate-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownloadBackup(backup)}
                                title="Descargar backup"
                                className="h-8 w-8 p-0"
                              >
                                <Download className="w-4 h-4 text-blue-600" />
                              </Button>
                              {currentUser?.role === 'administrador' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { setSelectedBackup(backup); setShowRestoreDialog(true); }}
                                    title="Restaurar desde este backup"
                                    className="h-8 w-8 p-0"
                                  >
                                    <Upload className="w-4 h-4 text-amber-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteBackup(backup.id)}
                                    title="Eliminar backup"
                                    className="h-8 w-8 p-0"
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

      {/* Dialog Configuración de Backups */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog} modal={false}>
        <DialogContent className="max-w-xl"  onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Configuración de Backups
            </DialogTitle>
            <DialogDescription>
              Configure el modo de backup (manual o automático) y las opciones de programación.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Modo */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Modo de Backup</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConfigForm({...configForm, modo: 'manual'})}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    configForm.modo === 'manual' 
                      ? 'border-emerald-600 bg-emerald-50' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className="font-medium">Manual</p>
                  <p className="text-sm text-slate-500">Ejecutar backups manualmente</p>
                </button>
                <button
                  type="button"
                  onClick={() => setConfigForm({...configForm, modo: 'automatico'})}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    configForm.modo === 'automatico' 
                      ? 'border-emerald-600 bg-emerald-50' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className="font-medium">Automático</p>
                  <p className="text-sm text-slate-500">Programar backups periódicos</p>
                </button>
              </div>
            </div>

            {/* Opciones de modo automático */}
            {configForm.modo === 'automatico' && (
              <>
                {/* Frecuencia */}
                <div className="space-y-2">
                  <Label>Frecuencia</Label>
                  <select 
                    value={configForm.frecuencia} 
                    onChange={(e) => setConfigForm({...configForm, frecuencia: e.target.value})}
                    className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="diario">Diario</option>
                    <option value="semanal">Semanal</option>
                    <option value="mensual">Mensual</option>
                  </select>
                </div>

                {/* Hora */}
                <div className="space-y-2">
                  <Label>Hora de Ejecución</Label>
                  <Input 
                    type="time"
                    value={configForm.hora}
                    onChange={(e) => setConfigForm({...configForm, hora: e.target.value})}
                    className="w-40"
                  />
                  <p className="text-xs text-slate-500">Recomendado: horario de baja actividad (ej: 02:00)</p>
                </div>

                {/* Día de la semana (para semanal) */}
                {configForm.frecuencia === 'semanal' && (
                  <div className="space-y-2">
                    <Label>Día de la Semana</Label>
                    <select 
                      value={String(configForm.dia_semana)} 
                      onChange={(e) => setConfigForm({...configForm, dia_semana: parseInt(e.target.value)})}
                      className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="0">Lunes</option>
                      <option value="1">Martes</option>
                      <option value="2">Miércoles</option>
                      <option value="3">Jueves</option>
                      <option value="4">Viernes</option>
                      <option value="5">Sábado</option>
                      <option value="6">Domingo</option>
                    </select>
                  </div>
                )}

                {/* Día del mes (para mensual) */}
                {configForm.frecuencia === 'mensual' && (
                  <div className="space-y-2">
                    <Label>Día del Mes</Label>
                    <select 
                      value={String(configForm.dia_mes)} 
                      onChange={(e) => setConfigForm({...configForm, dia_mes: parseInt(e.target.value)})}
                      className="flex h-9 w-40 items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      {[...Array(28)].map((_, i) => (
                        <option key={i+1} value={String(i+1)}>{i+1}</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500">Se recomienda usar días 1-28 para evitar problemas con meses cortos</p>
                  </div>
                )}
              </>
            )}

            {/* Tipo de backup */}
            <div className="space-y-2">
              <Label>Tipo de Backup</Label>
              <select 
                value={configForm.tipo_backup} 
                onChange={(e) => setConfigForm({...configForm, tipo_backup: e.target.value})}
                className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="completo">Completo (todas las colecciones)</option>
                <option value="selectivo">Selectivo (colecciones específicas)</option>
              </select>
            </div>

            {/* Selección de colecciones (para selectivo) */}
            {configForm.tipo_backup === 'selectivo' && dbStatus?.collections && (
              <div className="space-y-2">
                <Label>Colecciones a Respaldar</Label>
                <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
                  {dbStatus.collections.filter(c => c.name !== 'backup_history' && c.name !== 'system_config').map((coll) => (
                    <label key={coll.name} className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded cursor-pointer">
                      <Checkbox
                        checked={configForm.colecciones_seleccionadas.includes(coll.name)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setConfigForm({...configForm, colecciones_seleccionadas: [...configForm.colecciones_seleccionadas, coll.name]});
                          } else {
                            setConfigForm({...configForm, colecciones_seleccionadas: configForm.colecciones_seleccionadas.filter(c => c !== coll.name)});
                          }
                        }}
                      />
                      <span className="flex-1 font-mono text-xs">{coll.name}</span>
                      <span className="text-xs text-slate-400">{coll.count.toLocaleString()}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Retención */}
            <div className="space-y-2">
              <Label>Retención de Backups</Label>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">Conservar últimos</span>
                <select 
                  value={String(configForm.retener_ultimos)} 
                  onChange={(e) => setConfigForm({...configForm, retener_ultimos: parseInt(e.target.value)})}
                  className="flex h-9 w-20 items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {[3, 5, 7, 10, 14, 30].map((n) => (
                    <option key={n} value={String(n)}>{n}</option>
                  ))}
                </select>
                <span className="text-sm text-slate-500">backups</span>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveConfig} 
              disabled={savingConfig || (configForm.tipo_backup === 'selectivo' && configForm.colecciones_seleccionadas.length === 0)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {savingConfig ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Guardar Configuración
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Cargar Backup desde Archivo */}
      <Dialog open={showUploadDialog} onOpenChange={(open) => {
        if (!open && !restoring) {
          setShowUploadDialog(false);
          setSelectedFile(null);
          setUploadAnalysis(null);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600">
              <Upload className="w-5 h-5" />
              Cargar Backup desde Archivo
            </DialogTitle>
            <DialogDescription>
              Analiza y restaura un backup previamente descargado.
            </DialogDescription>
          </DialogHeader>

          {uploadAnalysis && (
            <div className="space-y-4 py-4">
              {/* Información del archivo */}
              <div className="p-4 bg-slate-50 rounded-lg">
                <h4 className="font-medium flex items-center gap-2 mb-3">
                  <FolderArchive className="w-4 h-4" />
                  Información del Backup
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-500">Archivo:</span>
                    <p className="font-mono text-xs">{selectedFile?.name}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Tamaño:</span>
                    <p>{(selectedFile?.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Fecha del backup:</span>
                    <p>{uploadAnalysis.fecha_backup ? new Date(uploadAnalysis.fecha_backup).toLocaleString() : 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Base de datos:</span>
                    <p>{uploadAnalysis.db_name || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Advertencia */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <h4 className="font-medium flex items-center gap-2 text-amber-700 mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  Advertencia de Cambios
                </h4>
                <p className="text-sm text-amber-700 mb-3">
                  Esta operación <strong>reemplazará</strong> los datos existentes en las colecciones incluidas en el backup.
                </p>
              </div>

              {/* Comparación de colecciones */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Comparación de Datos ({uploadAnalysis.total_colecciones} colecciones)
                </h4>
                <div className="max-h-64 overflow-y-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 sticky top-0">
                      <tr>
                        <th className="text-left py-2 px-3 font-medium">Colección</th>
                        <th className="text-right py-2 px-3 font-medium">En Backup</th>
                        <th className="text-right py-2 px-3 font-medium">Actual</th>
                        <th className="text-center py-2 px-3 font-medium">Cambio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploadAnalysis.comparacion?.map((item) => (
                        <tr key={item.coleccion} className="border-b hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono text-xs">{item.coleccion}</td>
                          <td className="py-2 px-3 text-right">{item.en_backup?.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right">{item.actual?.toLocaleString()}</td>
                          <td className="py-2 px-3 text-center">
                            {item.diferencia > 0 ? (
                              <Badge className="bg-green-100 text-green-700">+{item.diferencia.toLocaleString()}</Badge>
                            ) : item.diferencia < 0 ? (
                              <Badge className="bg-red-100 text-red-700">{item.diferencia.toLocaleString()}</Badge>
                            ) : (
                              <Badge className="bg-slate-100 text-slate-600">Sin cambio</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Resumen */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg text-center">
                <div>
                  <p className="text-2xl font-bold text-blue-600">{uploadAnalysis.total_colecciones}</p>
                  <p className="text-xs text-slate-500">Colecciones</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600">{uploadAnalysis.total_registros?.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">Registros en Backup</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{uploadAnalysis.registros_actuales?.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">Registros Actuales</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => { setShowUploadDialog(false); setSelectedFile(null); setUploadAnalysis(null); }}
              disabled={restoring}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleRestoreFromFile}
              disabled={restoring || !uploadAnalysis}
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
                  Restaurar Backup
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
