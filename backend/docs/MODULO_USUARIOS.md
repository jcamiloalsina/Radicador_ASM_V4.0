# Módulo de Usuarios y Permisos

## Descripción
El módulo de Usuarios y Permisos gestiona la autenticación, autorización y control de acceso granular al sistema. Implementa un modelo de roles con permisos personalizables.

## Componentes

### 1. Autenticación
**Archivo**: `frontend/src/pages/Login.js`

#### Métodos Soportados
- Login con email/password
- Recuperación de contraseña por email
- Tokens JWT con expiración

### 2. Gestión de Usuarios
**Archivo**: `frontend/src/pages/UsersManagement.js` (en DashboardLayout)

#### Funcionalidades
- Crear usuarios
- Editar información
- Asignar roles
- Activar/Desactivar usuarios
- Resetear contraseñas

### 3. Gestión de Permisos
**Archivo**: `frontend/src/pages/PermissionsManagement.js`

#### Funcionalidades
- Ver permisos por rol
- Personalizar permisos por usuario
- Crear roles personalizados
- Auditoría de cambios

## Modelo de Roles

### Roles Predefinidos

| Rol | Nivel | Descripción |
|-----|-------|-------------|
| administrador | 100 | Acceso total al sistema |
| coordinador | 80 | Gestiona equipos y aprueba cambios |
| gestor | 60 | Trabajo de campo y oficina |
| atencion_usuario | 50 | Gestión de PQRS |
| visor | 30 | Solo lectura |
| empresa | 20 | Acceso limitado para empresas |
| ciudadano | 10 | Portal ciudadano |

### Jerarquía de Roles
```
administrador (100)
      │
      ▼
coordinador (80)
      │
      ▼
gestor (60) ◄───► atencion_usuario (50)
      │
      ▼
visor (30)
      │
      ▼
empresa (20) ◄───► ciudadano (10)
```

## Sistema de Permisos

### Permisos Disponibles

#### Predios
```python
PERMISOS_PREDIOS = {
    'view_predios': 'Ver predios',
    'edit_predios': 'Editar predios',
    'create_predios': 'Crear predios',
    'delete_predios': 'Eliminar predios',
    'export_predios': 'Exportar predios',
    'proponer_cambios': 'Proponer cambios',
    'approve_changes': 'Aprobar cambios',
    'generate_resolutions': 'Generar resoluciones',
    'view_history': 'Ver historial',
}
```

#### Peticiones
```python
PERMISOS_PETICIONES = {
    'view_all_petitions': 'Ver todas las peticiones',
    'view_own_petitions': 'Ver propias peticiones',
    'create_petitions': 'Crear peticiones',
    'edit_petitions': 'Editar peticiones',
    'assign_petitions': 'Asignar peticiones',
    'respond_petitions': 'Responder peticiones',
    'delete_petitions': 'Eliminar peticiones',
}
```

#### Usuarios
```python
PERMISOS_USUARIOS = {
    'view_users': 'Ver usuarios',
    'create_users': 'Crear usuarios',
    'edit_users': 'Editar usuarios',
    'delete_users': 'Eliminar usuarios',
    'manage_permissions': 'Gestionar permisos',
}
```

#### Reportes
```python
PERMISOS_REPORTES = {
    'view_statistics': 'Ver estadísticas',
    'view_reports': 'Ver reportes',
    'export_reports': 'Exportar reportes',
    'view_productivity': 'Ver productividad',
}
```

#### Sistema
```python
PERMISOS_SISTEMA = {
    'view_audit_log': 'Ver log de auditoría',
    'manage_settings': 'Gestionar configuración',
    'manage_templates': 'Gestionar plantillas',
    'view_all_municipalities': 'Ver todos los municipios',
}
```

### Matriz de Permisos por Rol

| Permiso | Admin | Coord | Gestor | Atención | Visor |
|---------|-------|-------|--------|----------|-------|
| view_predios | ✅ | ✅ | ✅ | ✅ | ✅ |
| edit_predios | ✅ | ✅ | ✅ | ❌ | ❌ |
| delete_predios | ✅ | ❌ | ❌ | ❌ | ❌ |
| approve_changes | ✅ | ✅ | ❌ | ❌ | ❌ |
| generate_resolutions | ✅ | ✅ | ✅ | ❌ | ❌ |
| view_all_petitions | ✅ | ✅ | ❌ | ✅ | ❌ |
| assign_petitions | ✅ | ✅ | ❌ | ❌ | ❌ |
| manage_users | ✅ | ❌ | ❌ | ❌ | ❌ |
| view_statistics | ✅ | ✅ | ✅ | ✅ | ✅ |

## API Endpoints

### Autenticación
```
POST   /api/auth/login                   # Iniciar sesión
POST   /api/auth/register                # Registrar usuario
POST   /api/auth/forgot-password         # Solicitar reset
POST   /api/auth/reset-password          # Cambiar contraseña
GET    /api/auth/me                      # Usuario actual
POST   /api/auth/refresh                 # Renovar token
```

### Usuarios
```
GET    /api/users                        # Listar usuarios
POST   /api/users                        # Crear usuario
GET    /api/users/{id}                   # Obtener usuario
PUT    /api/users/{id}                   # Actualizar usuario
DELETE /api/users/{id}                   # Eliminar usuario
PATCH  /api/users/{id}/activate          # Activar/Desactivar
PATCH  /api/users/{id}/role              # Cambiar rol
```

### Permisos
```
GET    /api/permissions                  # Listar permisos
GET    /api/permissions/roles            # Permisos por rol
PUT    /api/permissions/user/{id}        # Permisos de usuario
GET    /api/permissions/check/{perm}     # Verificar permiso
```

## Modelo de Datos

### Usuario
```javascript
{
  id: String,
  email: String,              // Único
  password: String,           // Hash bcrypt
  full_name: String,
  role: String,               // administrador, coordinador, etc.
  
  // Datos de contacto
  telefono: String,
  direccion: String,
  
  // Asignación
  municipios: [String],       // Municipios asignados
  departamento: String,
  
  // Permisos personalizados
  permisos_adicionales: [String],  // Permisos extra
  permisos_revocados: [String],    // Permisos removidos
  
  // Estado
  activo: Boolean,
  verificado: Boolean,
  ultimo_login: String,
  
  // Preferencias
  preferencias: {
    tema: String,             // light, dark
    idioma: String,
    notificaciones_email: Boolean
  },
  
  // Auditoría
  creado_por: String,
  created_at: String,
  updated_at: String
}
```

### Sesión/Token
```javascript
{
  // Payload del JWT
  sub: String,                // user_id
  email: String,
  role: String,
  full_name: String,
  municipios: [String],
  permisos: [String],         // Permisos efectivos
  exp: Number,                // Expiración (timestamp)
  iat: Number                 // Emisión (timestamp)
}
```

## Autenticación JWT

### Generación de Token
```python
from jose import jwt
from datetime import datetime, timedelta

SECRET_KEY = os.environ.get("JWT_SECRET")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

def create_access_token(user: dict) -> str:
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    
    permisos = get_permisos_efectivos(user)
    
    payload = {
        "sub": user["id"],
        "email": user["email"],
        "role": user["role"],
        "full_name": user["full_name"],
        "municipios": user.get("municipios", []),
        "permisos": permisos,
        "exp": expire,
        "iat": datetime.utcnow()
    }
    
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
```

### Verificación de Token
```python
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer

security = HTTPBearer()

async def get_current_user(credentials = Depends(security)):
    try:
        payload = jwt.decode(
            credentials.credentials,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token inválido")
        
        # Verificar que el usuario existe y está activo
        user = await db.users.find_one({"id": user_id, "activo": True})
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        
        return {**payload, **user}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")
```

## Verificación de Permisos

### En Backend
```python
async def check_permission(user: dict, permission: str) -> bool:
    # Administrador tiene todos los permisos
    if user.get("role") == "administrador":
        return True
    
    # Verificar permisos efectivos
    permisos = user.get("permisos", [])
    return permission in permisos

def require_permission(permission: str):
    """Decorator para rutas que requieren permiso específico"""
    async def checker(user = Depends(get_current_user)):
        if not await check_permission(user, permission):
            raise HTTPException(
                status_code=403,
                detail=f"Permiso requerido: {permission}"
            )
        return user
    return checker

# Uso
@api_router.delete("/predios/{id}")
async def eliminar_predio(
    id: str,
    user = Depends(require_permission("delete_predios"))
):
    ...
```

### En Frontend
```javascript
// Hook para verificar permisos
const usePermission = (permission) => {
  const { user } = useAuth();
  
  if (!user) return false;
  if (user.role === 'administrador') return true;
  
  return user.permisos?.includes(permission) || false;
};

// Uso en componente
const PredioActions = ({ predio }) => {
  const canEdit = usePermission('edit_predios');
  const canDelete = usePermission('delete_predios');
  
  return (
    <div>
      {canEdit && <Button onClick={handleEdit}>Editar</Button>}
      {canDelete && <Button onClick={handleDelete}>Eliminar</Button>}
    </div>
  );
};
```

## Seguridad

### Hash de Contraseñas
```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)
```

### Validación de Contraseña
```python
def validar_password(password: str) -> tuple[bool, str]:
    if len(password) < 8:
        return False, "Mínimo 8 caracteres"
    if not re.search(r'[A-Z]', password):
        return False, "Debe tener al menos una mayúscula"
    if not re.search(r'[a-z]', password):
        return False, "Debe tener al menos una minúscula"
    if not re.search(r'[0-9]', password):
        return False, "Debe tener al menos un número"
    if not re.search(r'[!@#$%^&*]', password):
        return False, "Debe tener al menos un carácter especial"
    return True, "OK"
```

## Auditoría

### Registro de Acciones
```python
async def registrar_accion(
    user_id: str,
    accion: str,
    entidad: str,
    entidad_id: str,
    detalles: dict = None
):
    await db.audit_log.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "accion": accion,           # CREATE, READ, UPDATE, DELETE, LOGIN, etc.
        "entidad": entidad,         # users, predios, petitions, etc.
        "entidad_id": entidad_id,
        "detalles": detalles,
        "ip": request.client.host,
        "user_agent": request.headers.get("user-agent"),
        "timestamp": datetime.utcnow().isoformat()
    })
```

## Archivos Relacionados

### Backend
- `server.py`: Endpoints de auth y users (líneas 795-1500)
- `schema_validation.py`: Validación de schema para users

### Frontend
- `pages/Login.js`: Formulario de login
- `pages/ForgotPassword.js`: Recuperación de contraseña
- `pages/PermissionsManagement.js`: Gestión de permisos
- `context/AuthContext.js`: Contexto de autenticación
- `hooks/usePermission.js`: Hook de permisos
