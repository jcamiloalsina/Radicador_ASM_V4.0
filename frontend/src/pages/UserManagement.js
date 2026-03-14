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
import { UserCog, Search, Loader2, AlertTriangle, Settings, MapPin, Building2, Shield, Save, CheckCircle, CheckCircle2, XCircle, User, Clock } from 'lucide-react';
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
  
  // Estados para grupos colapsables
  const [collapsedGroups, setCollapsedGroups] = useState({
    administrador: false,
    coordinador: false,
    gestor: false,
    atencion_usuario: false,
    comunicaciones: false,
    empresa: false,
    usuario: true // Colapsado por defecto
  });

  // Configuración de grupos de roles
  const roleGroups = [
    { key: 'administrador', label: 'Administradores', icon: '👑', color: 'bg-purple-100 border-purple-300' },
    { key: 'coordinador', label: 'Coordinadores', icon: '📊', color: 'bg-blue-100 border-blue-300' },
    { key: 'gestor', label: 'Gestores', icon: '👤', color: 'bg-emerald-100 border-emerald-300' },
    { key: 'atencion_usuario', label: 'Atención al Usuario', icon: '🎧', color: 'bg-amber-100 border-amber-300' },
    { key: 'comunicaciones', label: 'Comunicaciones', icon: '📢', color: 'bg-cyan-100 border-cyan-300' },
    { key: 'empresa', label: 'Empresas', icon: '🏢', color: 'bg-slate-100 border-slate-300' },
    { key: 'usuario', label: 'Usuarios Externos', icon: '👥', color: 'bg-gray-100 border-gray-300' },
  ];

  // Función para agrupar usuarios por rol
  const getUsersByRole = (role) => {
    return filteredUsers.filter(u => u.role === role);
  };

  // Toggle colapsar grupo
  const toggleGroup = (groupKey) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  // Estados para mantenimiento
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceInfo, setMaintenanceInfo] = useState(null);
  const [loadingMaintenance, setLoadingMaintenance] = useState(false);
  const [togglingMaintenance, setTogglingMaintenance] = useState(false);

  // Estados para modal de asignación de municipios a empresas
  const [showMunicipiosModal, setShowMunicipiosModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [municipiosDisponibles, setMunicipiosDisponibles] = useState([]);
  const [municipiosAsignados, setMunicipiosAsignados] = useState([]);
  const [savingMunicipios, setSavingMunicipios] = useState(false);

  // Estados para gestión de permisos
  const [permUsersData, setPermUsersData] = useState([]);
  const [availablePermissions, setAvailablePermissions] = useState([]);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [savingPerms, setSavingPerms] = useState({});
  const [permSearchTerm, setPermSearchTerm] = useState('');
  const [pendingPermChanges, setPendingPermChanges] = useState({});

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (activeTab === 'permisos') {
      fetchPermissionsData();
    }
    if (activeTab === 'mantenimiento') {
      fetchMaintenanceStatus();
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

  // Funciones para gestión de permisos
  const fetchPermissionsData = async () => {
    try {
      setLoadingPerms(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [permissionsRes, usersRes] = await Promise.all([
        axios.get(`${API}/permissions/available`, { headers }),
        axios.get(`${API}/permissions/users`, { headers })
      ]);

      setAvailablePermissions(permissionsRes.data.permissions || []);
      setPermUsersData(usersRes.data.users || []);
    } catch (error) {
      console.error('Error fetching permissions data:', error);
      toast.error('Error al cargar datos de permisos');
    } finally {
      setLoadingPerms(false);
    }
  };

  const handlePermissionToggle = (userId, permissionKey) => {
    const userPermissions = pendingPermChanges[userId] || 
      permUsersData.find(u => u.id === userId)?.permissions || [];
    
    let newPermissions;
    if (userPermissions.includes(permissionKey)) {
      newPermissions = userPermissions.filter(p => p !== permissionKey);
    } else {
      newPermissions = [...userPermissions, permissionKey];
    }

    setPendingPermChanges({
      ...pendingPermChanges,
      [userId]: newPermissions
    });
  };

  const hasPermChanges = (userId) => {
    const original = permUsersData.find(u => u.id === userId)?.permissions || [];
    const pending = pendingPermChanges[userId];
    if (!pending) return false;
    
    if (original.length !== pending.length) return true;
    return !original.every(p => pending.includes(p));
  };

  const getCurrentPermissions = (userId) => {
    return pendingPermChanges[userId] || permUsersData.find(u => u.id === userId)?.permissions || [];
  };

  const saveUserPermissions = async (userId) => {
    if (!hasPermChanges(userId)) return;

    try {
      setSavingPerms({ ...savingPerms, [userId]: true });
      const token = localStorage.getItem('token');
      
      await axios.patch(`${API}/permissions/user`, {
        user_id: userId,
        permissions: pendingPermChanges[userId]
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Permisos actualizados correctamente');
      
      // Actualizar estado local
      setPermUsersData(permUsersData.map(u => 
        u.id === userId 
          ? { ...u, permissions: pendingPermChanges[userId] }
          : u
      ));
      
      // Limpiar cambios pendientes para este usuario
      const newPendingChanges = { ...pendingPermChanges };
      delete newPendingChanges[userId];
      setPendingPermChanges(newPendingChanges);

    } catch (error) {
      console.error('Error saving permissions:', error);
      toast.error(error.response?.data?.detail || 'Error al guardar permisos');
    } finally {
      setSavingPerms({ ...savingPerms, [userId]: false });
    }
  };

  const getPermRoleBadgeColor = (role) => {
    const colors = {
      gestor: 'bg-blue-100 text-blue-800',
      coordinador: 'bg-purple-100 text-purple-800',
      atencion_usuario: 'bg-amber-100 text-amber-800',
      comunicaciones: 'bg-cyan-100 text-cyan-800',
      empresa: 'bg-emerald-100 text-emerald-800',
      administrador: 'bg-red-100 text-red-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const getPermRoleName = (role) => {
    const roles = {
      gestor: 'Gestor',
      coordinador: 'Coordinador',
      atencion_usuario: 'Atención al Usuario',
      comunicaciones: 'Comunicaciones',
      empresa: 'Empresa',
      administrador: 'Administrador',
      usuario: 'Usuario'
    };
    return roles[role] || role;
  };

  const filteredPermUsers = permUsersData.filter(u => 
    u.full_name?.toLowerCase().includes(permSearchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(permSearchTerm.toLowerCase()) ||
    getPermRoleName(u.role).toLowerCase().includes(permSearchTerm.toLowerCase())
  );

  // Funciones para gestión de municipios de usuarios empresa
  const fetchMunicipiosDisponibles = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/admin/municipios-disponibles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMunicipiosDisponibles(response.data.municipios || []);
    } catch (error) {
      console.error('Error cargando municipios:', error);
    }
  };

  const abrirModalMunicipios = async (user) => {
    setSelectedUser(user);
    await fetchMunicipiosDisponibles();
    
    // Obtener municipios actuales del usuario
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/admin/users/${user.id}/municipios`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMunicipiosAsignados(response.data.municipios_asignados || []);
    } catch (error) {
      setMunicipiosAsignados([]);
    }
    
    setShowMunicipiosModal(true);
  };

  const toggleMunicipio = (municipio) => {
    setMunicipiosAsignados(prev => {
      if (prev.includes(municipio)) {
        return prev.filter(m => m !== municipio);
      } else {
        return [...prev, municipio];
      }
    });
  };

  const guardarMunicipios = async () => {
    if (!selectedUser) return;
    
    setSavingMunicipios(true);
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`${API}/admin/users/${selectedUser.id}/municipios`, {
        municipios_asignados: municipiosAsignados
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`Municipios asignados a ${selectedUser.full_name}`);
      setShowMunicipiosModal(false);
      fetchUsers(); // Recargar usuarios para mostrar cambios
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al asignar municipios');
    } finally {
      setSavingMunicipios(false);
    }
  };


  const fetchMaintenanceStatus = async () => {
    setLoadingMaintenance(true);
    try {
      const response = await axios.get(`${API}/maintenance/status`);
      setMaintenanceEnabled(response.data.enabled);
      if (response.data.toggled_by) {
        setMaintenanceInfo({ toggled_by: response.data.toggled_by, toggled_at: response.data.toggled_at });
      }
    } catch (error) {
      console.error('Error al cargar estado de mantenimiento:', error);
    } finally {
      setLoadingMaintenance(false);
    }
  };

  const handleToggleMaintenance = async () => {
    setTogglingMaintenance(true);
    try {
      const response = await axios.put(`${API}/maintenance/toggle`);
      setMaintenanceEnabled(response.data.enabled);
      setMaintenanceInfo({ toggled_by: response.data.toggled_by, toggled_at: response.data.toggled_at });
      toast.success(response.data.enabled ? 'Modo mantenimiento activado' : 'Modo mantenimiento desactivado');
    } catch (error) {
      toast.error('Error al cambiar modo de mantenimiento');
    } finally {
      setTogglingMaintenance(false);
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

  const getRoleBadge = (role) => {
    const roleConfig = {
      administrador: { label: 'Administrador', className: 'bg-rose-100 text-rose-700' },
      coordinador: { label: 'Coordinador', className: 'bg-purple-100 text-purple-700' },
      gestor: { label: 'Gestor', className: 'bg-emerald-100 text-emerald-700' },
      atencion_usuario: { label: 'Atención', className: 'bg-blue-100 text-blue-700' },
      comunicaciones: { label: 'Comunicaciones', className: 'bg-cyan-100 text-cyan-700' },
      empresa: { label: 'Empresa', className: 'bg-amber-100 text-amber-700' },
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
        <p className="text-slate-600 mt-1">Administra usuarios y permisos del sistema</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="usuarios" className="flex items-center gap-2">
            <UserCog className="w-4 h-4" />
            Usuarios
          </TabsTrigger>
          <TabsTrigger value="permisos" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Permisos
          </TabsTrigger>
          <TabsTrigger value="mantenimiento" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Mantenimiento
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

          {/* Users List - Grouped by Role */}
          {filteredUsers.length === 0 ? (
            <Card className="border-slate-200">
              <CardContent className="pt-6 text-center py-12">
                <p className="text-slate-600" data-testid="no-users-message">
                  No se encontraron usuarios.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {roleGroups.map((group) => {
                const groupUsers = getUsersByRole(group.key);
                if (groupUsers.length === 0 && searchTerm) return null; // Ocultar grupos vacíos cuando hay búsqueda
                
                return (
                  <Card key={group.key} className={`border ${group.color}`}>
                    {/* Group Header - Clickable */}
                    <div 
                      className="px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-white/50 transition-colors"
                      onClick={() => toggleGroup(group.key)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{group.icon}</span>
                        <h3 className="font-semibold text-slate-800">{group.label}</h3>
                        <Badge variant="secondary" className="bg-white/80">
                          {groupUsers.length}
                        </Badge>
                      </div>
                      <button className="text-slate-500 hover:text-slate-700 transition-colors">
                        {collapsedGroups[group.key] ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </button>
                    </div>
                    
                    {/* Group Content */}
                    {!collapsedGroups[group.key] && (
                      <CardContent className="pt-0 pb-3">
                        {groupUsers.length === 0 ? (
                          <p className="text-sm text-slate-500 italic py-2 px-2">Sin usuarios en este grupo</p>
                        ) : (
                          <div className="space-y-2">
                            {groupUsers.map((user) => (
                              <div 
                                key={user.id} 
                                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white rounded-lg border border-slate-100 hover:border-slate-200 transition-colors gap-3"
                                data-testid={`user-card-${user.id}`}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-slate-900 truncate" data-testid={`user-name-${user.id}`}>
                                    {user.full_name}
                                  </p>
                                  <p className="text-sm text-slate-500 truncate" data-testid={`user-email-${user.id}`}>
                                    {user.email}
                                  </p>
                                  {/* Mostrar municipios asignados si es usuario empresa */}
                                  {user.role === 'empresa' && (
                                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                                      <MapPin className="w-3 h-3 text-slate-400" />
                                      {user.municipios_asignados?.length > 0 ? (
                                        user.municipios_asignados.map((m, idx) => (
                                          <Badge key={idx} variant="secondary" className="text-[10px] py-0 px-1.5 bg-emerald-100 text-emerald-700">
                                            {m}
                                          </Badge>
                                        ))
                                      ) : (
                                        <span className="text-xs text-amber-600">Sin municipios asignados</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                
                                {user.id !== currentUser.id ? (
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {/* Botón para asignar municipios (solo para empresas) */}
                                    {user.role === 'empresa' && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => abrirModalMunicipios(user)}
                                        className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                        data-testid={`municipios-btn-${user.id}`}
                                      >
                                        <MapPin className="w-3.5 h-3.5 mr-1" />
                                        Municipios
                                      </Button>
                                    )}
                                    <span className="text-xs text-slate-500 hidden sm:inline">Cambiar a:</span>
                                    <select
                                      value={user.role}
                                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                      className="text-sm border border-slate-200 rounded-md px-2 py-1.5 bg-white hover:border-emerald-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                                      data-testid={`role-select-${user.id}`}
                                    >
                                      <option value="usuario">Usuario</option>
                                      <option value="atencion_usuario">Atención al Usuario</option>
                                      <option value="comunicaciones">Comunicaciones</option>
                                      <option value="empresa">Empresa</option>
                                      <option value="gestor">Gestor</option>
                                      <option value="coordinador">Coordinador</option>
                                      <option value="administrador">Administrador</option>
                                    </select>
                                  </div>
                                ) : (
                                  <Badge variant="outline" className="text-xs">Tu cuenta</Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tab Permisos */}
        <TabsContent value="permisos" className="mt-6 space-y-4">
          {/* Leyenda de permisos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-600" />
                Permisos Disponibles
              </CardTitle>
              <p className="text-sm text-slate-500">
                Los administradores y coordinadores tienen todos los permisos por defecto
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <p className="font-semibold text-sm text-blue-800">GDB (Base Gráfica)</p>
                  </div>
                  <p className="text-xs text-blue-600">
                    Permite subir archivos .gdb con las geometrías de los predios al Visor de Predios
                  </p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <p className="font-semibold text-sm text-green-800">R1/R2 (Excel Catastral)</p>
                  </div>
                  <p className="text-xs text-green-600">
                    Permite importar archivos Excel con datos catastrales R1 y R2 por vigencia
                  </p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                    <p className="font-semibold text-sm text-purple-800">Aprobar Cambios Predios</p>
                  </div>
                  <p className="text-xs text-purple-600">
                    Permite aprobar o rechazar solicitudes de creación, modificación o eliminación de predios
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Búsqueda de permisos */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
            <Input
              placeholder="Buscar por nombre, correo o rol..."
              value={permSearchTerm}
              onChange={(e) => setPermSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="search-permissions"
            />
          </div>

          {/* Lista de usuarios con permisos */}
          {loadingPerms ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPermUsers.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-slate-500">
                    No se encontraron usuarios con los criterios de búsqueda
                  </CardContent>
                </Card>
              ) : (
                filteredPermUsers.map(userData => (
                  <Card key={userData.id} className={hasPermChanges(userData.id) ? 'ring-2 ring-amber-400' : ''}>
                    <CardContent className="py-4">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        {/* Info del usuario */}
                        <div className="flex items-center gap-3 min-w-[250px]">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                            <User className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">{userData.full_name}</p>
                            <p className="text-sm text-slate-500">{userData.email}</p>
                            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${getPermRoleBadgeColor(userData.role)}`}>
                              {getPermRoleName(userData.role)}
                            </span>
                          </div>
                        </div>

                        {/* Permisos */}
                        <div className="flex-1 flex flex-wrap gap-4">
                          {availablePermissions.map(perm => {
                            const isChecked = getCurrentPermissions(userData.id).includes(perm.key);
                            const isCoordinador = userData.role === 'coordinador';
                            
                            const getShortLabel = (key) => {
                              const labels = {
                                'upload_gdb': 'GDB (Base Gráfica)',
                                'import_r1r2': 'R1/R2 (Excel Catastral)',
                                'approve_changes': 'Aprobar Cambios Predios',
                                'acceso_actualizacion': 'Acceso a Actualización'
                              };
                              return labels[key] || perm.description;
                            };
                            
                            return (
                              <div key={perm.key} className="flex items-center gap-2">
                                <Checkbox
                                  id={`${userData.id}-${perm.key}`}
                                  checked={isChecked || isCoordinador}
                                  disabled={isCoordinador}
                                  onCheckedChange={() => handlePermissionToggle(userData.id, perm.key)}
                                  data-testid={`perm-${userData.id}-${perm.key}`}
                                />
                                <label 
                                  htmlFor={`${userData.id}-${perm.key}`}
                                  className={`text-sm cursor-pointer ${isCoordinador ? 'text-slate-400' : 'text-slate-700'}`}
                                >
                                  {getShortLabel(perm.key)}
                                  {isCoordinador && (
                                    <span className="ml-1 text-xs text-emerald-600">(por rol)</span>
                                  )}
                                </label>
                              </div>
                            );
                          })}
                        </div>

                        {/* Botón guardar */}
                        <div className="flex items-center gap-2">
                          {hasPermChanges(userData.id) && (
                            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                              Cambios pendientes
                            </span>
                          )}
                          <Button
                            size="sm"
                            onClick={() => saveUserPermissions(userData.id)}
                            disabled={!hasPermChanges(userData.id) || savingPerms[userData.id]}
                            className="bg-emerald-600 hover:bg-emerald-700"
                            data-testid={`save-perm-${userData.id}`}
                          >
                            {savingPerms[userData.id] ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                            <span className="ml-1">Guardar</span>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Resumen de permisos */}
          {permUsersData.length > 0 && (
            <Card className="bg-slate-50">
              <CardContent className="py-4">
                <div className="flex flex-wrap gap-6 justify-center text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-slate-600">
                      <strong>{permUsersData.filter(u => (u.permissions || []).length > 0).length}</strong> usuarios con permisos especiales
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-600">
                      <strong>{permUsersData.filter(u => (u.permissions || []).length === 0 && u.role !== 'coordinador').length}</strong> sin permisos especiales
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab Mantenimiento */}
        <TabsContent value="mantenimiento" className="mt-6 space-y-6">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-outfit">
                <Settings className="w-5 h-5 text-slate-600" />
                Modo Mantenimiento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {loadingMaintenance ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cargando estado...
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border">
                    <div className="space-y-1">
                      <p className="font-medium text-slate-900">Activar modo mantenimiento</p>
                      <p className="text-sm text-slate-500">
                        Al activar, todos los usuarios (excepto administradores) verán una página de mantenimiento.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={maintenanceEnabled ? "destructive" : "secondary"}>
                        {maintenanceEnabled ? "Activo" : "Inactivo"}
                      </Badge>
                      <Switch
                        checked={maintenanceEnabled}
                        onCheckedChange={handleToggleMaintenance}
                        disabled={togglingMaintenance}
                      />
                    </div>
                  </div>

                  {maintenanceInfo && (
                    <div className="flex items-center gap-4 text-sm text-slate-500 px-1">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" />
                        <span>Última acción por: <strong>{maintenanceInfo.toggled_by}</strong></span>
                      </div>
                      {maintenanceInfo.toggled_at && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{new Date(maintenanceInfo.toggled_at).toLocaleString('es-CO')}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {maintenanceEnabled && (
                    <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-amber-800">El sitio está en mantenimiento</p>
                        <p className="text-sm text-amber-700 mt-1">
                          Los usuarios no administradores no pueden acceder al sistema.
                          Desactive el modo mantenimiento cuando termine las tareas de mantenimiento.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal para asignar municipios a usuarios empresa */}
      <Dialog open={showMunicipiosModal} onOpenChange={setShowMunicipiosModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-600" />
              Asignar Municipios
            </DialogTitle>
            <DialogDescription>
              Selecciona los municipios a los que <strong>{selectedUser?.full_name}</strong> tendrá acceso para ver Gestión de Predios y Visor de Predios.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-medium">Municipios Disponibles</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMunicipiosAsignados([...municipiosDisponibles])}
                >
                  Seleccionar todos
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMunicipiosAsignados([])}
                >
                  Limpiar
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto border rounded-lg p-3">
              {municipiosDisponibles.map((municipio) => (
                <div
                  key={municipio}
                  onClick={() => toggleMunicipio(municipio)}
                  className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                    municipiosAsignados.includes(municipio)
                      ? 'bg-emerald-100 border border-emerald-300'
                      : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Checkbox 
                    checked={municipiosAsignados.includes(municipio)}
                    className="pointer-events-none"
                  />
                  <span className={`text-sm ${
                    municipiosAsignados.includes(municipio) ? 'text-emerald-700 font-medium' : 'text-slate-700'
                  }`}>
                    {municipio}
                  </span>
                </div>
              ))}
            </div>
            
            <div className="mt-3 text-sm text-slate-600">
              <MapPin className="w-4 h-4 inline mr-1" />
              {municipiosAsignados.length} municipio(s) seleccionado(s)
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMunicipiosModal(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={guardarMunicipios} 
              disabled={savingMunicipios}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {savingMunicipios ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Guardar Municipios
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
