import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { toast } from 'sonner';
import axios from 'axios';
import { Shield, Save, Loader2, Search, User, CheckCircle2, XCircle } from 'lucide-react';
import { Input } from '../components/ui/input';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function PermissionsManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [availablePermissions, setAvailablePermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingChanges, setPendingChanges] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [permissionsRes, usersRes] = await Promise.all([
        axios.get(`${API}/permissions/available`, { headers }),
        axios.get(`${API}/permissions/users`, { headers })
      ]);

      setAvailablePermissions(permissionsRes.data.permissions || []);
      setUsers(usersRes.data.users || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar datos de permisos');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionToggle = (userId, permissionKey) => {
    const userPermissions = pendingChanges[userId] || 
      users.find(u => u.id === userId)?.permissions || [];
    
    let newPermissions;
    if (userPermissions.includes(permissionKey)) {
      newPermissions = userPermissions.filter(p => p !== permissionKey);
    } else {
      newPermissions = [...userPermissions, permissionKey];
    }

    setPendingChanges({
      ...pendingChanges,
      [userId]: newPermissions
    });
  };

  const hasChanges = (userId) => {
    const original = users.find(u => u.id === userId)?.permissions || [];
    const pending = pendingChanges[userId];
    if (!pending) return false;
    
    if (original.length !== pending.length) return true;
    return !original.every(p => pending.includes(p));
  };

  const getCurrentPermissions = (userId) => {
    return pendingChanges[userId] || users.find(u => u.id === userId)?.permissions || [];
  };

  const saveUserPermissions = async (userId) => {
    if (!hasChanges(userId)) return;

    try {
      setSaving({ ...saving, [userId]: true });
      const token = localStorage.getItem('token');
      
      await axios.patch(`${API}/permissions/user`, {
        user_id: userId,
        permissions: pendingChanges[userId]
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Permisos actualizados correctamente');
      
      // Actualizar estado local
      setUsers(users.map(u => 
        u.id === userId 
          ? { ...u, permissions: pendingChanges[userId] }
          : u
      ));
      
      // Limpiar cambios pendientes para este usuario
      const newPendingChanges = { ...pendingChanges };
      delete newPendingChanges[userId];
      setPendingChanges(newPendingChanges);

    } catch (error) {
      console.error('Error saving permissions:', error);
      toast.error(error.response?.data?.detail || 'Error al guardar permisos');
    } finally {
      setSaving({ ...saving, [userId]: false });
    }
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      gestor: 'bg-blue-100 text-blue-800',
      coordinador: 'bg-purple-100 text-purple-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const getRoleName = (role) => {
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

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getRoleName(u.role).toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
          <p className="mt-2 text-slate-600">Cargando permisos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="permissions-management">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="h-7 w-7 text-emerald-600" />
            Gestión de Permisos
          </h1>
          <p className="text-slate-500 mt-1">
            Configure los permisos especiales para gestores y coordinadores
          </p>
        </div>
      </div>

      {/* Leyenda de permisos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Permisos Disponibles</CardTitle>
          <CardDescription>
            Los administradores y coordinadores tienen todos los permisos por defecto
          </CardDescription>
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

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
        <Input
          placeholder="Buscar por nombre, correo o rol..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
          data-testid="search-permissions"
        />
      </div>

      {/* Lista de usuarios */}
      <div className="space-y-4">
        {filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-slate-500">
              No se encontraron usuarios con los criterios de búsqueda
            </CardContent>
          </Card>
        ) : (
          filteredUsers.map(userData => (
            <Card key={userData.id} className={hasChanges(userData.id) ? 'ring-2 ring-amber-400' : ''}>
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
                      <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${getRoleBadgeColor(userData.role)}`}>
                        {getRoleName(userData.role)}
                      </span>
                    </div>
                  </div>

                  {/* Permisos */}
                  <div className="flex-1 flex flex-wrap gap-4">
                    {availablePermissions.map(perm => {
                      const isChecked = getCurrentPermissions(userData.id).includes(perm.key);
                      const isCoordinador = userData.role === 'coordinador';
                      
                      // Etiquetas cortas pero claras para cada permiso
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
                    {hasChanges(userData.id) && (
                      <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                        Cambios pendientes
                      </span>
                    )}
                    <Button
                      size="sm"
                      onClick={() => saveUserPermissions(userData.id)}
                      disabled={!hasChanges(userData.id) || saving[userData.id]}
                      className="bg-emerald-600 hover:bg-emerald-700"
                      data-testid={`save-perm-${userData.id}`}
                    >
                      {saving[userData.id] ? (
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

      {/* Resumen */}
      {users.length > 0 && (
        <Card className="bg-slate-50">
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-6 justify-center text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-slate-600">
                  <strong>{users.filter(u => (u.permissions || []).length > 0).length}</strong> usuarios con permisos especiales
                </span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-slate-400" />
                <span className="text-slate-600">
                  <strong>{users.filter(u => (u.permissions || []).length === 0 && u.role !== 'coordinador').length}</strong> sin permisos especiales
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
