import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  FolderOpen, File, Download, Trash2, Upload, Search, 
  RefreshCw, Loader2, FileSpreadsheet, FileText, Image, 
  FileArchive, ChevronRight, Home, HardDrive, Calendar,
  ArrowLeft, Eye, FolderPlus, MoreVertical, Info
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FolderOpen className="h-7 w-7 text-emerald-600" />
            Gestor de Recursos
          </h1>
          <p className="text-slate-500 mt-1">
            Explorador de archivos del sistema
          </p>
        </div>
        
        <div className="flex items-center gap-2">
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
    </div>
  );
}
