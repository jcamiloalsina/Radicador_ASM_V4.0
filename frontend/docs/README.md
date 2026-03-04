# Documentación Frontend - Sistema de Gestión Catastral

## Estructura del Proyecto

```
frontend/
├── public/
│   ├── index.html
│   └── resoluciones/       # PDFs generados
├── src/
│   ├── components/
│   │   ├── ui/             # Componentes Shadcn/UI (46)
│   │   ├── Notifications.js
│   │   ├── NuevoPredioModal.js
│   │   └── ...
│   ├── pages/              # Páginas principales (27)
│   │   ├── Login.js
│   │   ├── DashboardLayout.js
│   │   ├── Predios.js
│   │   ├── MutacionesResoluciones.js
│   │   ├── Pendientes.js
│   │   └── ...
│   ├── context/
│   │   └── AuthContext.js  # Contexto de autenticación
│   ├── hooks/
│   │   └── usePermission.js
│   ├── lib/
│   │   └── utils.js        # Utilidades (cn, etc.)
│   ├── App.js              # Router principal
│   └── index.js            # Entry point
└── package.json
```

## Stack Tecnológico

| Tecnología | Versión | Uso |
|------------|---------|-----|
| React | 18.x | Framework UI |
| React Router | 6.x | Routing |
| Tailwind CSS | 3.x | Estilos |
| Shadcn/UI | Latest | Componentes UI |
| Axios | 1.x | HTTP Client |
| Recharts | 2.x | Gráficos |
| Leaflet | 1.9.x | Mapas |
| Dexie.js | 3.x | IndexedDB (offline) |
| Lucide React | Latest | Iconos |
| Sonner | Latest | Toasts |

## Componentes UI (Shadcn)

### Disponibles en `/components/ui/`

```
accordion.jsx      dialog.jsx         radio-group.jsx
alert.jsx          dropdown-menu.jsx  scroll-area.jsx
avatar.jsx         form.jsx           select.jsx
badge.jsx          input.jsx          separator.jsx
button.jsx         label.jsx          sheet.jsx
calendar.jsx       menubar.jsx        skeleton.jsx
card.jsx           navigation-menu.jsx slider.jsx
checkbox.jsx       pagination.jsx     sonner.jsx
collapsible.jsx    popover.jsx        switch.jsx
command.jsx        progress.jsx       table.jsx
                                      tabs.jsx
                                      textarea.jsx
                                      tooltip.jsx
```

### Uso de Componentes

```jsx
// Importar desde la carpeta ui
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader } from '../components/ui/dialog';

// Ejemplo de uso
const MiComponente = () => (
  <Card>
    <CardHeader>
      <h3>Título</h3>
    </CardHeader>
    <CardContent>
      <Input placeholder="Buscar..." />
      <Button>Guardar</Button>
    </CardContent>
  </Card>
);
```

## Páginas Principales

### 1. Login (`Login.js`)
- Formulario de autenticación
- Validación de credenciales
- Redirect a dashboard

### 2. Dashboard Layout (`DashboardLayout.js`)
- Layout principal con sidebar
- Navegación por módulos
- Header con notificaciones
- Menú de usuario

### 3. Predios (`Predios.js`) - 6,356 líneas
- Listado de predios
- Búsqueda y filtros
- CRUD de predios
- Visor de detalles

### 4. Mutaciones (`MutacionesResoluciones.js`) - 4,731 líneas
- Mutaciones M1 (cambio propietario)
- Mutaciones M2 (englobe/desenglobe)
- Carga masiva Excel
- Generación de resoluciones

### 5. Pendientes (`Pendientes.js`) - 3,054 líneas
- Vista unificada de pendientes
- Aprobación de cambios
- Historial de acciones

### 6. Visor de Predios (`VisorPredios.js`)
- Mapa interactivo Leaflet
- Geometrías de predios
- Búsqueda por ubicación

## Contexto de Autenticación

```jsx
// context/AuthContext.js
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const login = async (email, password) => {
    const response = await axios.post('/api/auth/login', { email, password });
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    setUser(user);
    return user;
  };
  
  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };
  
  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Uso
const { user, login, logout } = useAuth();
```

## Hook de Permisos

```jsx
// hooks/usePermission.js
const usePermission = (permission) => {
  const { user } = useAuth();
  
  if (!user) return false;
  if (user.role === 'administrador') return true;
  
  const permisos = user.permisos || [];
  return permisos.includes(permission);
};

// Uso
const MiComponente = () => {
  const canEdit = usePermission('edit_predios');
  const canDelete = usePermission('delete_predios');
  
  return (
    <>
      {canEdit && <Button>Editar</Button>}
      {canDelete && <Button variant="destructive">Eliminar</Button>}
    </>
  );
};
```

## Configuración de Axios

```jsx
// Interceptor para agregar token
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar errores 401
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

## Integración con Leaflet

```jsx
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const MapaVisor = () => {
  const mapRef = useRef(null);
  
  useEffect(() => {
    // Inicializar mapa
    const map = L.map('map').setView([8.0, -73.0], 12);
    
    // Capa base
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(map);
    
    mapRef.current = map;
    
    return () => map.remove();
  }, []);
  
  const agregarGeometria = (geojson) => {
    L.geoJSON(geojson, {
      style: { color: '#3388ff', weight: 2 },
      onEachFeature: (feature, layer) => {
        layer.bindPopup(`<b>${feature.properties.codigo}</b>`);
      }
    }).addTo(mapRef.current);
  };
  
  return <div id="map" style={{ height: '500px' }} />;
};
```

## Soporte Offline (Dexie.js)

```jsx
import Dexie from 'dexie';

// Definir base de datos
const db = new Dexie('CatastroOffline');
db.version(1).stores({
  predios: 'id, codigo_predial_nacional, municipio',
  cambiosPendientes: '++id, predio_id, sincronizado'
});

// Guardar para offline
const guardarOffline = async (predio) => {
  await db.predios.put(predio);
};

// Sincronizar cuando hay conexión
const sincronizar = async () => {
  const pendientes = await db.cambiosPendientes
    .where('sincronizado').equals(0)
    .toArray();
  
  for (const cambio of pendientes) {
    await axios.post('/api/predios/cambios', cambio);
    await db.cambiosPendientes.update(cambio.id, { sincronizado: 1 });
  }
};
```

## Toasts con Sonner

```jsx
import { toast } from 'sonner';

// Tipos de toast
toast.success('Predio guardado correctamente');
toast.error('Error al guardar el predio');
toast.warning('Campos incompletos');
toast.info('Procesando...');

// Toast con acción
toast('Cambio pendiente', {
  action: {
    label: 'Deshacer',
    onClick: () => deshacerCambio()
  }
});

// Toast con duración personalizada
toast.success('Guardado', { duration: 5000 });
```

## Estilos con Tailwind

### Clases Comunes

```jsx
// Layout
<div className="flex flex-col min-h-screen">
<div className="container mx-auto px-4">
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

// Tipografía
<h1 className="text-2xl font-bold text-slate-900">
<p className="text-sm text-slate-500">

// Colores del sistema
<Badge className="bg-blue-100 text-blue-800">Modificación</Badge>
<Badge className="bg-green-100 text-green-800">Predio Nuevo</Badge>
<Badge className="bg-purple-100 text-purple-800">Mutación</Badge>
<Badge className="bg-amber-100 text-amber-800">Reaparición</Badge>

// Botones
<Button variant="default">Primario</Button>
<Button variant="outline">Secundario</Button>
<Button variant="destructive">Eliminar</Button>
<Button variant="ghost">Ghost</Button>
```

### Responsive Design

```jsx
// Mobile first
<div className="p-2 md:p-4 lg:p-6">
<div className="text-sm md:text-base lg:text-lg">
<div className="hidden md:block">  // Oculto en mobile
<div className="md:hidden">        // Solo mobile
```

## Variables de Entorno

```bash
# frontend/.env
REACT_APP_BACKEND_URL=https://api.example.com
WDS_SOCKET_PORT=443  # Para hot reload en HTTPS
```

```jsx
// Uso en código
const API = process.env.REACT_APP_BACKEND_URL;

const fetchPredios = async () => {
  const response = await axios.get(`${API}/api/predios`);
  return response.data;
};
```

## Patrones de Código

### Fetching de Datos

```jsx
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/predios');
      setData(response.data.predios);
    } catch (err) {
      setError(err.message);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };
  
  fetchData();
}, []);

if (loading) return <Skeleton />;
if (error) return <Alert variant="destructive">{error}</Alert>;
```

### Formularios Controlados

```jsx
const [formData, setFormData] = useState({
  nombre: '',
  email: '',
  telefono: ''
});

const handleChange = (e) => {
  const { name, value } = e.target;
  setFormData(prev => ({ ...prev, [name]: value }));
};

const handleSubmit = async (e) => {
  e.preventDefault();
  await axios.post('/api/endpoint', formData);
};

return (
  <form onSubmit={handleSubmit}>
    <Input
      name="nombre"
      value={formData.nombre}
      onChange={handleChange}
    />
    <Button type="submit">Guardar</Button>
  </form>
);
```

### Modales

```jsx
const [showModal, setShowModal] = useState(false);
const [selectedItem, setSelectedItem] = useState(null);

const openModal = (item) => {
  setSelectedItem(item);
  setShowModal(true);
};

return (
  <>
    <Button onClick={() => openModal(item)}>Ver</Button>
    
    <Dialog open={showModal} onOpenChange={setShowModal}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Detalle</DialogTitle>
        </DialogHeader>
        {selectedItem && (
          <div>
            <p>{selectedItem.nombre}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  </>
);
```

## Scripts Disponibles

```bash
# Desarrollo
yarn start           # Inicia servidor de desarrollo

# Producción
yarn build          # Genera build de producción

# Testing
yarn test           # Ejecuta tests

# Linting
yarn lint           # Ejecuta ESLint
```
