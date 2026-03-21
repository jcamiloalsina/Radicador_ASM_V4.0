import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Checkbox } from '../components/ui/checkbox';
import { toast } from 'sonner';
import axios from 'axios';
import {
  FolderOpen, File, Download, Trash2, Upload, Search,
  RefreshCw, Loader2, FileSpreadsheet, FileText, Image,
  FileArchive, ChevronRight, Home, HardDrive, Calendar,
  ArrowLeft, Eye, FolderPlus, MoreVertical, Info, Database,
  FolderArchive, Clock, AlertTriangle, Settings, Play, Timer,
  CheckCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Tipos de archivos y sus iconos
const FILE_ICONS = {
  'xlsx': { icon: FileSpreadsheet, color: 'text-emerald-600 bg-emerald-100' },
  'xls': { icon: FileSpreadsheet, color: 'text-emerald-600 bg-emerald-100' },
  'csv': { icon: FileSpreadsheet, color: 'text-emerald-600 bg-emerald-100' },
  'pdf': { icon: FileText, color: 'text-red-600 bg-red-100' },
  'doc': { icon: FileText, color: 'text-blue-600 bg-blue-100' },
  'docx': { icon: FileText, color: 'text-blue-600 bg-blue-100' },
  'png': { icon: Image, color: 'text-purple-600 bg-purple-100' },
  'jpg': { icon: Image, color: 'text-purple-600 bg-purple-100' },
  'jpeg': { icon: Image, color: 'text-purple-600 bg-purple-100' },
  'gif': { icon: Image, color: 'text-purple-600 bg-purple-100' },
  'zip': { icon: FileArchive, color: 'text-amber-600 bg-amber-100' },
  'rar': { icon: FileArchive, color: 'text-amber-600 bg-amber-100' },
  'gdb': { icon: HardDrive, color: 'text-cyan-600 bg-cyan-100' },
  'default': { icon: File, color: 'text-slate-600 bg-slate-100' }
};

// Función para obtener icono según extensión
const getFileIcon = (filename) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  return FILE_ICONS[ext] || FILE_ICONS.default;
};

// Función para formatear tamaño de archivo
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Función para formatear fecha
const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function FileManager() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('archivos');
  const [loading, setLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState('/');
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [storageInfo, setStorageInfo] = useState(null);

  // Dialogs
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // File input ref
  const fileInputRef = React.useRef(null);

  // ===================== ESTADOS BASE DE DATOS =====================
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
  const [showDbUploadDialog, setShowDbUploadDialog] = useState(false);
  const [uploadingBackup, setUploadingBackup] = useState(false);
  const [uploadAnalysis, setUploadAnalysis] = useState(null);
  const [selectedDbFile, setSelectedDbFile] = useState(null);
  const dbFileInputRef = React.useRef(null);
  const [backupConfig, setBackupConfig] = useState(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configForm, setConfigForm] = useState({
    modo: 'manual', frecuencia: 'diario', hora: '02:00',
    dia_semana: 0, dia_mes: 1, tipo_backup: 'completo',
    colecciones_seleccionadas: [], retener_ultimos: 7, notificar_email: true
  });
  const [backupStatus, setBackupStatus] = useState(null);
  const [currentBackupId, setCurrentBackupId] = useState(null);

  // Cargar contenido del directorio
  const loadDirectory = useCallback(async (path = '/') => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.get(`${API}/files/list`, {
        params: { path },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setItems(response.data.items || []);
      setStorageInfo(response.data.storage_info || null);
      setCurrentPath(path);
      setSelectedItems([]);
    } catch (error) {
      console.error('Error loading directory:', error);
      // Si el endpoint no existe, mostrar datos de ejemplo
      if (error.response?.status === 404) {
        setItems(getMockData(path));
        setStorageInfo({ used: 256000000, total: 1073741824, files_count: 45 });
      } else {
        toast.error('Error al cargar el directorio');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Datos de ejemplo mientras no existe el backend
  const getMockData = (path) => {
    if (path === '/') {
      return [
        { name: 'backups', type: 'folder', modified: new Date().toISOString(), items_count: 12 },
        { name: 'imports', type: 'folder', modified: new Date().toISOString(), items_count: 34 },
        { name: 'exports', type: 'folder', modified: new Date().toISOString(), items_count: 8 },
        { name: 'resoluciones', type: 'folder', modified: new Date().toISOString(), items_count: 156 },
        { name: 'gdb_uploads', type: 'folder', modified: new Date().toISOString(), items_count: 5 },
        { name: 'temp', type: 'folder', modified: new Date().toISOString(), items_count: 3 },
      ];
    }
    
    if (path === '/backups') {
      return [
        { name: 'backup_2025_12_01.zip', type: 'file', size: 52428800, modified: '2025-12-01T10:30:00' },
        { name: 'backup_2025_11_15.zip', type: 'file', size: 48576000, modified: '2025-11-15T08:00:00' },
        { name: 'backup_2025_11_01.zip', type: 'file', size: 45000000, modified: '2025-11-01T09:15:00' },
      ];
    }
    
    if (path === '/imports') {
      return [
        { name: 'R1R2_Abrego_2025.xlsx', type: 'file', size: 2560000, modified: '2025-12-08T14:20:00' },
        { name: 'R1R2_Cachira_2025.xlsx', type: 'file', size: 1890000, modified: '2025-12-07T11:30:00' },
        { name: 'R1R2_Convencion_2025.xlsx', type: 'file', size: 3200000, modified: '2025-12-06T16:45:00' },
        { name: 'R1R2_ElCarmen_2025.xlsx', type: 'file', size: 2100000, modified: '2025-12-05T09:00:00' },
      ];
    }
    
    if (path === '/resoluciones') {
      return [
        { name: 'RES_M1_2025_001.pdf', type: 'file', size: 125000, modified: '2025-12-08T15:30:00' },
        { name: 'RES_M2_2025_002.pdf', type: 'file', size: 156000, modified: '2025-12-07T10:20:00' },
        { name: 'RES_M3_2025_003.pdf', type: 'file', size: 98000, modified: '2025-12-06T14:10:00' },
      ];
    }
    
    return [];
  };

  useEffect(() => {
    loadDirectory('/');
  }, [loadDirectory]);

  // Cargar datos de BD cuando se cambia a la pestaña database
  useEffect(() => {
    if (activeTab === 'database') {
      fetchDbStatus();
      fetchBackups();
      fetchBackupConfig();
    }
  }, [activeTab]);

  // ===================== FUNCIONES BASE DE DATOS =====================
  // Helper para obtener headers de autenticación
  const authHeaders = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  const fetchDbStatus = async () => {
    setLoadingDb(true);
    try {
      const response = await axios.get(`${API}/database/status`, authHeaders());
      setDbStatus(response.data);
    } catch (error) {
      toast.error('Error al cargar estado de la BD');
    } finally {
      setLoadingDb(false);
    }
  };

  const fetchBackups = async () => {
    try {
      const response = await axios.get(`${API}/database/backups`, authHeaders());
      setBackups(response.data.backups || []);
    } catch (error) {
      console.error('Error al cargar backups:', error);
    }
  };

  const fetchBackupConfig = async () => {
    try {
      const response = await axios.get(`${API}/database/config`, authHeaders());
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
      await axios.put(`${API}/database/config?${params.toString()}`, {}, authHeaders());
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
      const response = await axios.post(`${API}/database/backup/ejecutar-programado`, {}, authHeaders());
      toast.success(`Backup programado iniciado (${response.data.colecciones} colecciones)`);
      fetchBackups();
      fetchBackupConfig();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al ejecutar backup');
    }
  };

  const handleCleanOldBackups = async () => {
    if (!window.confirm(`¿Está seguro de eliminar backups antiguos? Se conservarán los últimos ${backupConfig?.retener_ultimos || 7} backups.`)) return;
    try {
      const response = await axios.post(`${API}/database/backup/limpiar-antiguos`, {}, authHeaders());
      toast.success(`${response.data.eliminados} backups eliminados`);
      fetchBackups();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al limpiar backups');
    }
  };

  const handleDbFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.name.endsWith('.zip')) {
        toast.error('Solo se permiten archivos .zip');
        return;
      }
      setSelectedDbFile(file);
      analyzeBackupFile(file);
    }
  };

  const analyzeBackupFile = async (file) => {
    setUploadingBackup(true);
    setUploadAnalysis(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/database/backup/analizar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` }
      });
      setUploadAnalysis(response.data);
      setShowDbUploadDialog(true);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al analizar el backup');
      setSelectedDbFile(null);
    } finally {
      setUploadingBackup(false);
    }
  };

  const handleRestoreFromFile = async () => {
    if (!selectedDbFile || !uploadAnalysis) return;
    const confirmMsg = `⚠️ ADVERTENCIA: Esta acción restaurará la base de datos.\n\nSe modificarán ${uploadAnalysis.total_colecciones} colecciones.\nRegistros en backup: ${uploadAnalysis.total_registros?.toLocaleString()}\n\n¿Está seguro de continuar?`;
    if (!window.confirm(confirmMsg)) return;
    setRestoring(true);
    const formData = new FormData();
    formData.append('file', selectedDbFile);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/database/backup/restaurar-archivo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` }
      });
      toast.success(`Backup restaurado: ${response.data.colecciones_restauradas} colecciones, ${response.data.registros_restaurados?.toLocaleString()} registros`);
      setShowDbUploadDialog(false);
      setSelectedDbFile(null);
      setUploadAnalysis(null);
      fetchDbStatus();
      fetchBackups();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al restaurar el backup');
    } finally {
      setRestoring(false);
    }
  };

  const pollBackupStatus = async (backupId) => {
    try {
      const response = await axios.get(`${API}/database/backup/${backupId}/status`, authHeaders());
      const status = response.data;
      setBackupStatus(status);
      if (status.status === 'completed') {
        toast.success('Backup completado exitosamente');
        setCreatingBackup(false);
        setShowBackupDialog(false);
        setBackupStatus(null);
        fetchBackups();
        fetchDbStatus();
      } else if (status.status === 'error') {
        toast.error(`Error en backup: ${status.error}`);
        setCreatingBackup(false);
        setBackupStatus(null);
      } else {
        // running, starting, o not_found (aún no registrado) → seguir polling
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
      const response = await axios.post(`${API}/database/backup?${params.toString()}`, {}, authHeaders());
      const backupId = response.data.backup_id;
      toast.info('Backup iniciado en segundo plano...');
      setTimeout(() => pollBackupStatus(backupId), 1000);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear backup');
      setCreatingBackup(false);
      setBackupStatus(null);
    }
  };

  const handleDownloadBackup = async (backup) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/database/backup/${backup.id}/download`, {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` }
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
    if (!window.confirm('¿Está seguro de eliminar este backup? Esta acción no se puede deshacer.')) return;
    try {
      await axios.delete(`${API}/database/backup/${backupId}`, authHeaders());
      toast.success('Backup eliminado');
      fetchBackups();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar backup');
    }
  };

  const handlePreviewBackup = async (backup) => {
    try {
      const response = await axios.get(`${API}/database/backup/${backup.id}/preview`, authHeaders());
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
      const response = await axios.post(`${API}/database/restore/${selectedBackup.id}`, {}, authHeaders());
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

  const handleEmptyCollection = async (collectionName) => {
    const confirmMsg = `⚠️ ¿Está seguro de VACIAR la colección "${collectionName}"?\n\nEsto eliminará TODOS los registros pero mantendrá la colección.\n\nEsta acción NO se puede deshacer.`;
    if (!window.confirm(confirmMsg)) return;
    const criticalCollections = ['predios', 'users', 'predios_historico', 'petitions'];
    if (criticalCollections.includes(collectionName)) {
      const secondConfirm = window.prompt(`Esta es una colección CRÍTICA. Escriba "${collectionName}" para confirmar:`);
      if (secondConfirm !== collectionName) {
        toast.error('Operación cancelada - nombre incorrecto');
        return;
      }
    }
    try {
      const response = await axios.post(`${API}/database/collection/${collectionName}/empty`, {}, authHeaders());
      toast.success(`Colección "${collectionName}" vaciada: ${response.data.deleted_count} registros eliminados`);
      fetchDbStatus();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al vaciar colección');
    }
  };

  const handleDropCollection = async (collectionName) => {
    const confirmMsg = `¿Está seguro de ELIMINAR la colección "${collectionName}"?\n\nEsto eliminará la colección COMPLETAMENTE de la base de datos.\n\nEsta acción NO se puede deshacer.`;
    if (!window.confirm(confirmMsg)) return;
    const secondConfirm = window.prompt(`Escriba "${collectionName}" para confirmar la ELIMINACIÓN:`);
    if (secondConfirm !== collectionName) {
      toast.error('Operación cancelada - nombre incorrecto');
      return;
    }
    try {
      await axios.delete(`${API}/database/collection/${collectionName}`, authHeaders());
      toast.success(`Colección "${collectionName}" eliminada completamente`);
      fetchDbStatus();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar colección');
    }
  };

  // Navegación
  const navigateTo = (path) => {
    loadDirectory(path);
  };

  const navigateUp = () => {
    if (currentPath === '/') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const newPath = '/' + parts.join('/');
    loadDirectory(newPath || '/');
  };

  const openFolder = (folderName) => {
    const newPath = currentPath === '/' 
      ? `/${folderName}` 
      : `${currentPath}/${folderName}`;
    loadDirectory(newPath);
  };

  // Breadcrumbs
  const getBreadcrumbs = () => {
    const parts = currentPath.split('/').filter(Boolean);
    const crumbs = [{ name: 'Inicio', path: '/' }];
    let accPath = '';
    
    parts.forEach(part => {
      accPath += '/' + part;
      crumbs.push({ name: part, path: accPath });
    });
    
    return crumbs;
  };

  // Selección
  const toggleSelection = (item) => {
    setSelectedItems(prev => {
      const isSelected = prev.some(i => i.name === item.name);
      if (isSelected) {
        return prev.filter(i => i.name !== item.name);
      }
      return [...prev, item];
    });
  };

  const isSelected = (item) => selectedItems.some(i => i.name === item.name);

  // Subir archivo
  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploading(true);
    const token = localStorage.getItem('token');
    
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', currentPath);
        
        await axios.post(`${API}/files/upload`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
      }
      
      toast.success(`${files.length} archivo(s) subido(s) correctamente`);
      loadDirectory(currentPath);
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('Error al subir archivos');
    } finally {
      setUploading(false);
      setShowUploadDialog(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Descargar archivo
  const downloadFile = async (item) => {
    try {
      const token = localStorage.getItem('token');
      const filePath = currentPath === '/' 
        ? `/${item.name}` 
        : `${currentPath}/${item.name}`;
      
      const response = await axios.get(`${API}/files/download`, {
        params: { path: filePath },
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', item.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Archivo descargado');
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Error al descargar el archivo');
    }
  };

  // Eliminar archivos
  const deleteFiles = async () => {
    try {
      const token = localStorage.getItem('token');
      
      for (const item of selectedItems) {
        const filePath = currentPath === '/' 
          ? `/${item.name}` 
          : `${currentPath}/${item.name}`;
        
        await axios.delete(`${API}/files/delete`, {
          params: { path: filePath },
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      toast.success(`${selectedItems.length} elemento(s) eliminado(s)`);
      setShowDeleteDialog(false);
      setSelectedItems([]);
      loadDirectory(currentPath);
    } catch (error) {
      console.error('Error deleting files:', error);
      toast.error('Error al eliminar archivos');
    }
  };

  // Crear carpeta
  const createFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error('Ingrese un nombre para la carpeta');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const folderPath = currentPath === '/' 
        ? `/${newFolderName}` 
        : `${currentPath}/${newFolderName}`;
      
      await axios.post(`${API}/files/create-folder`, {
        path: folderPath
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Carpeta creada correctamente');
      setShowCreateFolderDialog(false);
      setNewFolderName('');
      loadDirectory(currentPath);
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Error al crear la carpeta');
    }
  };

  // Filtrar items
  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Separar carpetas y archivos
  const folders = filteredItems.filter(item => item.type === 'folder');
  const files = filteredItems.filter(item => item.type === 'file');

  return (
    <div className="space-y-6" data-testid="file-manager">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <FolderOpen className="h-7 w-7 text-emerald-600" />
          Gestor de Recursos
        </h1>
        <p className="text-slate-500 mt-1">
          Archivos del sistema y base de datos
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="archivos" className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            Archivos
          </TabsTrigger>
          <TabsTrigger value="database" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            Base de Datos
          </TabsTrigger>
        </TabsList>

        {/* Tab Archivos */}
        <TabsContent value="archivos" className="mt-6 space-y-6">
      <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadDirectory(currentPath)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreateFolderDialog(true)}
          >
            <FolderPlus className="h-4 w-4 mr-1" />
            Nueva Carpeta
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => setShowUploadDialog(true)}
          >
            <Upload className="h-4 w-4 mr-1" />
            Subir Archivos
          </Button>
      </div>

      {/* Storage Info */}
      {storageInfo && (
        <Card className="bg-gradient-to-r from-slate-50 to-emerald-50">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">Disco del Servidor</p>
                    <p className="text-xs text-slate-500">
                      {formatFileSize(storageInfo.disk_used)} de {formatFileSize(storageInfo.disk_total)} usado
                    </p>
                  </div>
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div>
                  <p className="text-sm font-medium text-emerald-700">{formatFileSize(storageInfo.disk_free)}</p>
                  <p className="text-xs text-slate-500">Disponible</p>
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div>
                  <p className="text-sm font-medium text-slate-700">{storageInfo.uploads_count || 0}</p>
                  <p className="text-xs text-slate-500">Archivos subidos</p>
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div>
                  <p className="text-sm font-medium text-slate-700">{storageInfo.resoluciones_count || 0}</p>
                  <p className="text-xs text-slate-500">Resoluciones PDF</p>
                </div>
              </div>
              <div className="w-48">
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${
                      storageInfo.disk_percent > 90 ? 'bg-red-500' : 
                      storageInfo.disk_percent > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${storageInfo.disk_percent || 0}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1 text-right">
                  {storageInfo.disk_percent || 0}% usado
                </p>
              </div>
            </div>
            {/* Desglose de uso */}
            <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-500">Uploads: </span>
                <span className="font-medium">{formatFileSize(storageInfo.uploads_used || 0)}</span>
              </div>
              <div>
                <span className="text-slate-500">Resoluciones: </span>
                <span className="font-medium">{formatFileSize(storageInfo.resoluciones_used || 0)}</span>
              </div>
              <div>
                <span className="text-slate-500">App Files: </span>
                <span className="font-medium">{formatFileSize(storageInfo.app_files_used || 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Breadcrumbs & Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex items-center gap-2 flex-1 bg-white rounded-lg border px-3 py-2 overflow-x-auto">
          {getBreadcrumbs().map((crumb, idx) => (
            <React.Fragment key={crumb.path}>
              {idx > 0 && <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />}
              <button
                onClick={() => navigateTo(crumb.path)}
                className={`text-sm whitespace-nowrap ${
                  idx === getBreadcrumbs().length - 1 
                    ? 'text-emerald-600 font-medium' 
                    : 'text-slate-600 hover:text-emerald-600'
                }`}
              >
                {idx === 0 ? <Home className="h-4 w-4" /> : crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>
        
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar archivos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="search-files"
          />
        </div>
      </div>

      {/* Action Bar (cuando hay selección) */}
      {selectedItems.length > 0 && (
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-emerald-700">
                {selectedItems.length} elemento(s) seleccionado(s)
              </span>
              <div className="flex items-center gap-2">
                {selectedItems.length === 1 && selectedItems[0].type === 'file' && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => downloadFile(selectedItems[0])}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Descargar
                  </Button>
                )}
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Eliminar
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => setSelectedItems([])}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              {currentPath !== '/' && (
                <Button variant="ghost" size="sm" onClick={navigateUp}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              Contenido de {currentPath === '/' ? 'Raíz' : currentPath.split('/').pop()}
            </CardTitle>
            <Badge variant="outline">
              {folders.length} carpetas · {files.length} archivos
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FolderOpen className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>No hay archivos en este directorio</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Folders */}
              {folders.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Carpetas</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {folders.map(folder => (
                      <div
                        key={folder.name}
                        className={`p-3 border rounded-lg cursor-pointer transition-all hover:border-emerald-300 hover:bg-emerald-50 ${
                          isSelected(folder) ? 'border-emerald-500 bg-emerald-50' : ''
                        }`}
                        onClick={() => toggleSelection(folder)}
                        onDoubleClick={() => openFolder(folder.name)}
                      >
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-lg bg-amber-100">
                            <FolderOpen className="h-5 w-5 text-amber-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{folder.name}</p>
                            <p className="text-xs text-slate-400">{folder.items_count || 0} elementos</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Files */}
              {files.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Archivos</p>
                  <div className="border rounded-lg divide-y">
                    {files.map(file => {
                      const { icon: FileIcon, color } = getFileIcon(file.name);
                      return (
                        <div
                          key={file.name}
                          className={`flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer ${
                            isSelected(file) ? 'bg-emerald-50' : ''
                          }`}
                          onClick={() => toggleSelection(file)}
                        >
                          <input 
                            type="checkbox" 
                            checked={isSelected(file)}
                            onChange={() => {}}
                            className="rounded border-slate-300"
                          />
                          <div className={`p-2 rounded-lg ${color}`}>
                            <FileIcon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                            <div className="flex items-center gap-3 text-xs text-slate-400">
                              <span>{formatFileSize(file.size)}</span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(file.modified)}
                              </span>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => downloadFile(file)}>
                                <Download className="h-4 w-4 mr-2" />
                                Descargar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedFile(file);
                                setShowDetailsDialog(true);
                              }}>
                                <Info className="h-4 w-4 mr-2" />
                                Detalles
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={() => {
                                  setSelectedItems([file]);
                                  setShowDeleteDialog(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

        </TabsContent>

        {/* Tab Base de Datos */}
        <TabsContent value="database" className="mt-6 space-y-6">
          {/* Estado de la BD */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-slate-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-emerald-100">
                    <HardDrive className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Base de Datos</p>
                    <p className="text-lg font-bold text-slate-900">{dbStatus?.total_size_mb || 0} MB</p>
                    <p className="text-xs text-slate-400">{dbStatus?.collections_count || 0} colecciones</p>
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
                    <p className="text-sm text-slate-500">Archivos Adjuntos</p>
                    <p className="text-lg font-bold text-slate-900">{dbStatus?.archivos_adjuntos?.total?.toLocaleString() || 0}</p>
                    <p className="text-xs text-slate-400">{dbStatus?.archivos_adjuntos?.size_mb || 0} MB</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-amber-100">
                    <Database className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Tamaño Total Backup</p>
                    <p className="text-lg font-bold text-slate-900">{((dbStatus?.total_size_mb || 0) + (dbStatus?.archivos_adjuntos?.size_mb || 0)).toLocaleString()} MB</p>
                    <p className="text-xs text-slate-400">BD + Archivos</p>
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

          {/* Indicadores del Sistema */}
          {dbStatus?.indicadores && (
            <Card className="border-slate-200">
              <CardHeader><CardTitle className="text-lg font-outfit">Indicadores del Sistema</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {[
                    { label: 'Predios', value: dbStatus.indicadores.predios, color: 'emerald' },
                    { label: 'Predios Actualización', value: dbStatus.indicadores.predios_actualizacion, color: 'blue' },
                    { label: 'Peticiones', value: dbStatus.indicadores.peticiones, color: 'amber' },
                    { label: 'Resoluciones', value: dbStatus.indicadores.resoluciones, color: 'purple' },
                    { label: 'Usuarios', value: dbStatus.indicadores.usuarios, color: 'slate' },
                    { label: 'Certificados', value: dbStatus.indicadores.certificados, color: 'teal' },
                    { label: 'Mutaciones', value: dbStatus.indicadores.mutaciones, color: 'orange' },
                    { label: 'Histórico Predios', value: dbStatus.indicadores.predios_historico, color: 'indigo' },
                    { label: 'Predios Eliminados', value: dbStatus.indicadores.predios_eliminados, color: 'red' },
                    { label: 'Construcciones Act.', value: dbStatus.indicadores.construcciones_actualizacion, color: 'cyan' },
                    { label: 'Geometrías Act.', value: dbStatus.indicadores.geometrias_actualizacion, color: 'lime' },
                    { label: 'Propuestas Cambio', value: dbStatus.indicadores.propuestas_cambio, color: 'pink' },
                  ].map(ind => (
                    <div key={ind.label} className={`p-3 rounded-lg bg-${ind.color}-50 border border-${ind.color}-200`}>
                      <p className="text-xs text-slate-500">{ind.label}</p>
                      <p className="text-lg font-bold text-slate-800">{(ind.value || 0).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
                {dbStatus?.archivos_adjuntos?.por_tipo && Object.keys(dbStatus.archivos_adjuntos.por_tipo).length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm font-medium text-slate-600 mb-2">Archivos adjuntos por tipo:</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(dbStatus.archivos_adjuntos.por_tipo).map(([ext, count]) => (
                        <span key={ext} className="px-2 py-1 bg-slate-100 rounded text-xs font-mono">{ext}: {count}</span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

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
                <Button onClick={() => { setBackupType('completo'); setShowBackupDialog(true); }} className="bg-emerald-600 hover:bg-emerald-700">
                  <Download className="w-4 h-4 mr-2" />
                  Backup Completo
                </Button>
                <Button variant="outline" onClick={() => { setBackupType('selectivo'); setShowBackupDialog(true); }} className="border-emerald-600 text-emerald-700 hover:bg-emerald-50">
                  <Download className="w-4 h-4 mr-2" />
                  Backup Selectivo
                </Button>
                <Button variant="outline" onClick={() => dbFileInputRef.current?.click()} disabled={uploadingBackup} className="border-blue-600 text-blue-700 hover:bg-blue-50">
                  {uploadingBackup ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  Cargar Backup
                </Button>
                <input ref={dbFileInputRef} type="file" accept=".zip" onChange={handleDbFileSelect} className="hidden" />
                <Button variant="outline" onClick={() => { fetchDbStatus(); fetchBackups(); }} disabled={loadingDb}>
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
                <Button variant="outline" size="sm" onClick={() => setShowConfigDialog(true)}>
                  <Settings className="w-4 h-4 mr-2" />
                  Configurar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Modo</p>
                  <div className="flex items-center gap-2">
                    <Badge className={backupConfig?.modo === 'automatico' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}>
                      {backupConfig?.modo === 'automatico' ? 'Automático' : 'Manual'}
                    </Badge>
                    {backupConfig?.modo === 'automatico' && <Badge className="bg-blue-100 text-blue-700">{backupConfig?.frecuencia}</Badge>}
                  </div>
                </div>
                {backupConfig?.modo === 'automatico' && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Hora de Ejecución</p>
                    <p className="font-medium flex items-center gap-2"><Timer className="w-4 h-4 text-slate-400" />{backupConfig?.hora || '02:00'}</p>
                  </div>
                )}
                {backupConfig?.modo === 'automatico' && backupConfig?.proximo_backup && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Próximo Backup</p>
                    <p className="text-sm font-medium flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-400" />{formatDate(backupConfig.proximo_backup)}</p>
                  </div>
                )}
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Retención</p>
                  <p className="font-medium">Últimos {backupConfig?.retener_ultimos || 7} backups</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t">
                {backupConfig?.modo === 'automatico' && (
                  <Button variant="outline" size="sm" onClick={handleExecuteScheduledBackup} className="border-emerald-600 text-emerald-700 hover:bg-emerald-50">
                    <Play className="w-4 h-4 mr-2" />
                    Ejecutar Backup Programado
                  </Button>
                )}
                {user?.role === 'administrador' && backups.length > (backupConfig?.retener_ultimos || 7) && (
                  <Button variant="outline" size="sm" onClick={handleCleanOldBackups} className="border-amber-600 text-amber-700 hover:bg-amber-50">
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
                <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50">
                        <th className="text-left py-2 px-3 font-medium text-slate-700">Colección</th>
                        <th className="text-right py-2 px-3 font-medium text-slate-700">Registros</th>
                        <th className="text-right py-2 px-3 font-medium text-slate-700">Tamaño</th>
                        {user?.role === 'administrador' && (
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
                          {user?.role === 'administrador' && (
                            <td className="py-2 px-3">
                              <div className="flex items-center justify-center gap-1">
                                <Button variant="ghost" size="sm" onClick={() => handleEmptyCollection(coll.name)} title="Vaciar colección" className="h-7 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50" disabled={coll.count === 0}>
                                  <Trash2 className="w-3.5 h-3.5 mr-1" /><span className="text-xs">Vaciar</span>
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDropCollection(coll.name)} title="Eliminar colección" className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50">
                                  <Trash2 className="w-3.5 h-3.5 mr-1" /><span className="text-xs">Eliminar</span>
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
                <Button variant="outline" size="sm" onClick={fetchBackups}>
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
                              <Button variant="ghost" size="sm" onClick={() => handlePreviewBackup(backup)} title="Vista previa" className="h-8 w-8 p-0">
                                <Eye className="w-4 h-4 text-slate-600" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDownloadBackup(backup)} title="Descargar" className="h-8 w-8 p-0">
                                <Download className="w-4 h-4 text-blue-600" />
                              </Button>
                              {user?.role === 'administrador' && (
                                <>
                                  <Button variant="ghost" size="sm" onClick={() => { setSelectedBackup(backup); setShowRestoreDialog(true); }} title="Restaurar" className="h-8 w-8 p-0">
                                    <Upload className="w-4 h-4 text-amber-600" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleDeleteBackup(backup.id)} title="Eliminar" className="h-8 w-8 p-0">
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

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-emerald-600" />
              Subir Archivos
            </DialogTitle>
            <DialogDescription>
              Seleccione los archivos que desea subir a {currentPath}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div 
              className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-emerald-400 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto text-slate-400 mb-3" />
              <p className="text-sm text-slate-600">
                Haga clic para seleccionar archivos
              </p>
              <p className="text-xs text-slate-400 mt-1">
                o arrastre y suelte aquí
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Confirmar Eliminación
            </DialogTitle>
            <DialogDescription>
              ¿Está seguro que desea eliminar {selectedItems.length} elemento(s)?
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-40 overflow-y-auto">
              {selectedItems.map(item => (
                <div key={item.name} className="flex items-center gap-2 text-sm text-red-700 py-1">
                  {item.type === 'folder' ? (
                    <FolderOpen className="h-4 w-4" />
                  ) : (
                    <File className="h-4 w-4" />
                  )}
                  {item.name}
                </div>
              ))}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={deleteFiles}>
              <Trash2 className="h-4 w-4 mr-1" />
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Folder Dialog */}
      <Dialog open={showCreateFolderDialog} onOpenChange={setShowCreateFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-emerald-600" />
              Nueva Carpeta
            </DialogTitle>
            <DialogDescription>
              Crear una nueva carpeta en {currentPath}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Input
              placeholder="Nombre de la carpeta"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createFolder()}
            />
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateFolderDialog(false);
              setNewFolderName('');
            }}>
              Cancelar
            </Button>
            <Button onClick={createFolder} className="bg-emerald-600 hover:bg-emerald-700">
              <FolderPlus className="h-4 w-4 mr-1" />
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-emerald-600" />
              Detalles del Archivo
            </DialogTitle>
          </DialogHeader>
          
          {selectedFile && (
            <div className="py-4 space-y-4">
              <div className="flex items-center gap-3">
                {(() => {
                  const { icon: FileIcon, color } = getFileIcon(selectedFile.name);
                  return (
                    <div className={`p-3 rounded-lg ${color}`}>
                      <FileIcon className="h-8 w-8" />
                    </div>
                  );
                })()}
                <div>
                  <p className="font-medium text-slate-800">{selectedFile.name}</p>
                  <p className="text-sm text-slate-500">
                    {selectedFile.name.split('.').pop()?.toUpperCase()} File
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Tamaño</p>
                  <p className="font-medium">{formatFileSize(selectedFile.size)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Modificado</p>
                  <p className="font-medium">{formatDate(selectedFile.modified)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-slate-500">Ubicación</p>
                  <p className="font-medium">{currentPath}/{selectedFile.name}</p>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              Cerrar
            </Button>
            {selectedFile && (
              <Button onClick={() => downloadFile(selectedFile)} className="bg-emerald-600 hover:bg-emerald-700">
                <Download className="h-4 w-4 mr-1" />
                Descargar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Crear Backup */}
      <Dialog open={showBackupDialog} onOpenChange={(open) => !creatingBackup && setShowBackupDialog(open)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Download className="w-5 h-5" /> Crear Backup {backupType === 'completo' ? 'Completo' : 'Selectivo'}</DialogTitle>
            <DialogDescription>{backupType === 'completo' ? 'Se respaldará toda la base de datos' : 'Seleccione las colecciones que desea respaldar'}</DialogDescription>
          </DialogHeader>
          {creatingBackup && (
            <div className="space-y-3 py-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                <span className="text-sm font-medium">
                  {(!backupStatus || backupStatus.status === 'starting' || backupStatus.status === 'not_found') && 'Iniciando backup...'}
                  {backupStatus?.status === 'running' && `Procesando: ${backupStatus.current_collection || '...'}`}
                  {backupStatus?.status === 'completed' && 'Backup completado'}
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2.5">
                <div className="bg-emerald-600 h-2.5 rounded-full transition-all duration-500 ease-out" style={{ width: `${backupStatus?.progress || 0}%`, minWidth: backupStatus?.progress === 0 ? '2%' : undefined }} />
              </div>
              <p className="text-xs text-slate-500">
                Progreso: {backupStatus?.progress || 0}% - Este proceso puede tardar varios minutos
              </p>
            </div>
          )}
          {!creatingBackup && backupType === 'selectivo' && dbStatus?.collections && (
            <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-3">
              {dbStatus.collections.filter(c => c.name !== 'backup_history').map((coll) => (
                <label key={coll.name} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer">
                  <Checkbox checked={selectedCollections.includes(coll.name)} onCheckedChange={(checked) => {
                    if (checked) setSelectedCollections([...selectedCollections, coll.name]);
                    else setSelectedCollections(selectedCollections.filter(c => c !== coll.name));
                  }} />
                  <span className="flex-1 font-mono text-sm">{coll.name}</span>
                  <span className="text-xs text-slate-500">{coll.count.toLocaleString()} reg.</span>
                </label>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBackupDialog(false)} disabled={creatingBackup}>{creatingBackup ? 'Procesando...' : 'Cancelar'}</Button>
            <Button onClick={handleCreateBackup} disabled={creatingBackup || (backupType === 'selectivo' && selectedCollections.length === 0)} className="bg-emerald-600 hover:bg-emerald-700">
              {creatingBackup ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creando...</> : <><Download className="w-4 h-4 mr-2" />Crear Backup</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Restaurar Backup */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600"><AlertTriangle className="w-5 h-5" /> Restaurar Backup</DialogTitle>
            <DialogDescription>Esta acción sobrescribirá los datos actuales de las colecciones seleccionadas.</DialogDescription>
          </DialogHeader>
          {selectedBackup && (
            <div className="space-y-3 py-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800"><strong>Fecha:</strong> {formatDate(selectedBackup.fecha)}</p>
                <p className="text-sm text-amber-800"><strong>Colecciones:</strong> {selectedBackup.colecciones_count}</p>
                <p className="text-sm text-amber-800"><strong>Registros:</strong> {selectedBackup.registros_total?.toLocaleString()}</p>
                {selectedBackup.archivos_adjuntos > 0 && (
                  <p className="text-sm text-amber-800"><strong>Archivos adjuntos:</strong> {selectedBackup.archivos_adjuntos} ({selectedBackup.archivos_adjuntos_mb} MB)</p>
                )}
              </div>
              <p className="text-sm text-slate-600">¿Está seguro de que desea restaurar este backup? Los datos actuales serán reemplazados.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestoreDialog(false)}>Cancelar</Button>
            <Button onClick={handleRestoreBackup} disabled={restoring} className="bg-amber-600 hover:bg-amber-700">
              {restoring ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Restaurando...</> : <><Upload className="w-4 h-4 mr-2" />Restaurar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Vista Previa */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Eye className="w-5 h-5" /> Vista Previa del Backup</DialogTitle>
          </DialogHeader>
          {previewData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-slate-500">Fecha:</span><span className="ml-2 font-medium">{formatDate(previewData.backup_info?.fecha)}</span></div>
                <div><span className="text-slate-500">Tipo:</span><span className="ml-2 font-medium">{previewData.backup_info?.tipo}</span></div>
                <div><span className="text-slate-500">Tamaño:</span><span className="ml-2 font-medium">{previewData.backup_info?.size_mb} MB</span></div>
                <div><span className="text-slate-500">Creado por:</span><span className="ml-2 font-medium">{previewData.backup_info?.creado_por}</span></div>
              </div>
              {previewData.archivos_adjuntos && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                  <strong>Archivos adjuntos incluidos:</strong> {previewData.archivos_adjuntos.total} archivos ({previewData.archivos_adjuntos.size_mb} MB)
                </div>
              )}
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
          <DialogFooter><Button variant="outline" onClick={() => setShowPreviewDialog(false)}>Cerrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Configuración de Backups */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog} modal={false}>
        <DialogContent className="max-w-xl" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Settings className="w-5 h-5" /> Configuración de Backups</DialogTitle>
            <DialogDescription>Configure el modo de backup (manual o automático) y las opciones de programación.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Label className="text-base font-medium">Modo de Backup</Label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setConfigForm({...configForm, modo: 'manual'})} className={`p-4 border-2 rounded-lg text-left transition-all ${configForm.modo === 'manual' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <p className="font-medium">Manual</p><p className="text-sm text-slate-500">Ejecutar backups manualmente</p>
                </button>
                <button type="button" onClick={() => setConfigForm({...configForm, modo: 'automatico'})} className={`p-4 border-2 rounded-lg text-left transition-all ${configForm.modo === 'automatico' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <p className="font-medium">Automático</p><p className="text-sm text-slate-500">Programar backups periódicos</p>
                </button>
              </div>
            </div>
            {configForm.modo === 'automatico' && (
              <>
                <div className="space-y-2">
                  <Label>Frecuencia</Label>
                  <select value={configForm.frecuencia} onChange={(e) => setConfigForm({...configForm, frecuencia: e.target.value})} className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="diario">Diario</option><option value="semanal">Semanal</option><option value="mensual">Mensual</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Hora de Ejecución</Label>
                  <Input type="time" value={configForm.hora} onChange={(e) => setConfigForm({...configForm, hora: e.target.value})} className="w-40" />
                  <p className="text-xs text-slate-500">Recomendado: horario de baja actividad (ej: 02:00)</p>
                </div>
                {configForm.frecuencia === 'semanal' && (
                  <div className="space-y-2">
                    <Label>Día de la Semana</Label>
                    <select value={String(configForm.dia_semana)} onChange={(e) => setConfigForm({...configForm, dia_semana: parseInt(e.target.value)})} className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                      <option value="0">Lunes</option><option value="1">Martes</option><option value="2">Miércoles</option><option value="3">Jueves</option><option value="4">Viernes</option><option value="5">Sábado</option><option value="6">Domingo</option>
                    </select>
                  </div>
                )}
                {configForm.frecuencia === 'mensual' && (
                  <div className="space-y-2">
                    <Label>Día del Mes</Label>
                    <select value={String(configForm.dia_mes)} onChange={(e) => setConfigForm({...configForm, dia_mes: parseInt(e.target.value)})} className="flex h-9 w-40 items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                      {[...Array(28)].map((_, i) => (<option key={i+1} value={String(i+1)}>{i+1}</option>))}
                    </select>
                    <p className="text-xs text-slate-500">Se recomienda usar días 1-28 para evitar problemas con meses cortos</p>
                  </div>
                )}
              </>
            )}
            <div className="space-y-2">
              <Label>Tipo de Backup</Label>
              <select value={configForm.tipo_backup} onChange={(e) => setConfigForm({...configForm, tipo_backup: e.target.value})} className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="completo">Completo (todas las colecciones)</option><option value="selectivo">Selectivo (colecciones específicas)</option>
              </select>
            </div>
            {configForm.tipo_backup === 'selectivo' && dbStatus?.collections && (
              <div className="space-y-2">
                <Label>Colecciones a Respaldar</Label>
                <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
                  {dbStatus.collections.filter(c => c.name !== 'backup_history' && c.name !== 'system_config').map((coll) => (
                    <label key={coll.name} className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded cursor-pointer">
                      <Checkbox checked={configForm.colecciones_seleccionadas.includes(coll.name)} onCheckedChange={(checked) => {
                        if (checked) setConfigForm({...configForm, colecciones_seleccionadas: [...configForm.colecciones_seleccionadas, coll.name]});
                        else setConfigForm({...configForm, colecciones_seleccionadas: configForm.colecciones_seleccionadas.filter(c => c !== coll.name)});
                      }} />
                      <span className="flex-1 font-mono text-xs">{coll.name}</span>
                      <span className="text-xs text-slate-400">{coll.count.toLocaleString()}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Retención de Backups</Label>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">Conservar últimos</span>
                <select value={String(configForm.retener_ultimos)} onChange={(e) => setConfigForm({...configForm, retener_ultimos: parseInt(e.target.value)})} className="flex h-9 w-20 items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  {[3, 5, 7, 10, 14, 30].map((n) => (<option key={n} value={String(n)}>{n}</option>))}
                </select>
                <span className="text-sm text-slate-500">backups</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveConfig} disabled={savingConfig || (configForm.tipo_backup === 'selectivo' && configForm.colecciones_seleccionadas.length === 0)} className="bg-emerald-600 hover:bg-emerald-700">
              {savingConfig ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</> : <><CheckCircle className="w-4 h-4 mr-2" />Guardar Configuración</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Cargar Backup desde Archivo */}
      <Dialog open={showDbUploadDialog} onOpenChange={(open) => {
        if (!open && !restoring) { setShowDbUploadDialog(false); setSelectedDbFile(null); setUploadAnalysis(null); }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600"><Upload className="w-5 h-5" /> Cargar Backup desde Archivo</DialogTitle>
            <DialogDescription>Analiza y restaura un backup previamente descargado.</DialogDescription>
          </DialogHeader>
          {uploadAnalysis && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <h4 className="font-medium flex items-center gap-2 mb-3"><FolderArchive className="w-4 h-4" /> Información del Backup</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-slate-500">Archivo:</span><p className="font-mono text-xs">{selectedDbFile?.name}</p></div>
                  <div><span className="text-slate-500">Tamaño:</span><p>{(selectedDbFile?.size / (1024 * 1024)).toFixed(2)} MB</p></div>
                  <div><span className="text-slate-500">Fecha del backup:</span><p>{uploadAnalysis.fecha_backup ? new Date(uploadAnalysis.fecha_backup).toLocaleString() : 'N/A'}</p></div>
                  <div><span className="text-slate-500">Base de datos:</span><p>{uploadAnalysis.db_name || 'N/A'}</p></div>
                </div>
              </div>
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <h4 className="font-medium flex items-center gap-2 text-amber-700 mb-2"><AlertTriangle className="w-4 h-4" /> Advertencia de Cambios</h4>
                <p className="text-sm text-amber-700">Esta operación <strong>reemplazará</strong> los datos existentes en las colecciones incluidas en el backup.</p>
              </div>
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2"><Database className="w-4 h-4" /> Comparación de Datos ({uploadAnalysis.total_colecciones} colecciones)</h4>
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
                            {item.diferencia > 0 ? <Badge className="bg-green-100 text-green-700">+{item.diferencia.toLocaleString()}</Badge>
                            : item.diferencia < 0 ? <Badge className="bg-red-100 text-red-700">{item.diferencia.toLocaleString()}</Badge>
                            : <Badge className="bg-slate-100 text-slate-600">Sin cambio</Badge>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg text-center">
                <div><p className="text-2xl font-bold text-blue-600">{uploadAnalysis.total_colecciones}</p><p className="text-xs text-slate-500">Colecciones</p></div>
                <div><p className="text-2xl font-bold text-emerald-600">{uploadAnalysis.total_registros?.toLocaleString()}</p><p className="text-xs text-slate-500">Registros en Backup</p></div>
                <div><p className="text-2xl font-bold text-amber-600">{uploadAnalysis.registros_actuales?.toLocaleString()}</p><p className="text-xs text-slate-500">Registros Actuales</p></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDbUploadDialog(false); setSelectedDbFile(null); setUploadAnalysis(null); }} disabled={restoring}>Cancelar</Button>
            <Button onClick={handleRestoreFromFile} disabled={restoring || !uploadAnalysis} className="bg-amber-600 hover:bg-amber-700">
              {restoring ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Restaurando...</> : <><Upload className="w-4 h-4 mr-2" />Restaurar Backup</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
