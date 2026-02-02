import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import { ScrollArea } from '../components/ui/scroll-area';
import { toast } from 'sonner';
import { LogIn, Mail, ArrowLeft, RefreshCw, AlertTriangle, Eye, EyeOff, WifiOff, Wifi, FileText, Phone, MessageCircle, CheckCircle2, X } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

// Datos de trámites catastrales
const TRAMITES_CATASTRALES = [
  {
    id: 1,
    nombre: "Cambio de Propietario o Poseedor (Mutación Primera)",
    descripcion: "Modificación de la titularidad de un bien inmueble.",
    requisitos: [
      "Oficio sencillo solicitando CAMBIO DE NOMBRE con: nombre completo, cédula, número predial, dirección, celular, correo y firma",
      "Poder (si aplica) - Autorización del propietario",
      "Cédula del propietario (copia)",
      "Escritura Pública (para predios registrados) o Carta Venta (para poseedores)",
      "Certificado de tradición"
    ]
  },
  {
    id: 2,
    nombre: "Englobe o Desenglobe (Mutación Segunda)",
    descripcion: "División de un predio en varias partes o unión de varios predios en uno solo.",
    requisitos: [
      "Oficio sencillo solicitando DESENGLOBE O ENGLOBE con datos personales y firma",
      "Poder (si aplica)",
      "Cédula del propietario (copia)",
      "Título de dominio registrado (Escritura Pública, Acto administrativo o Sentencia)",
      "Plano del levantamiento planimétrico en formato digital (dwg, dxf o shapefile) con coordenadas origen único Colombia",
      "Certificado de tradición"
    ],
    nota: "Para Propiedad Horizontal: Incluir escritura del reglamento con modificaciones y planos en escala original."
  },
  {
    id: 3,
    nombre: "Construcciones Nuevas o Demolición (Mutación Tercera)",
    descripcion: "Registro de nuevas edificaciones o eliminación de construcciones existentes.",
    requisitos: [
      "Oficio sencillo solicitando el TRÁMITE CATASTRAL con datos personales y firma",
      "Poder (si aplica)",
      "Cédula del propietario (copia)",
      "Licencia de construcción que apruebe la construcción",
      "O Certificación juramentada (si no hay licencia) con planos de áreas construidas",
      "Certificado de tradición"
    ],
    nota: "Para Propiedad Horizontal: Incluir escritura del reglamento, relación de unidades prediales y plano de localización digital."
  },
  {
    id: 4,
    nombre: "Cambio Destino Económico (Mutación Tercera)",
    descripcion: "Modificación del uso principal del predio (ej: residencial a comercial).",
    requisitos: [
      "Oficio sencillo solicitando MODIFICACIÓN DE DESTINO ECONÓMICO con datos personales y firma",
      "Poder (si aplica)",
      "Cédula del propietario (copia)",
      "Medio probatorio que sustente la solicitud",
      "Certificado de tradición"
    ],
    nota: "Para predios de interés histórico/cultural: Requiere Acto administrativo de la autoridad competente."
  },
  {
    id: 5,
    nombre: "Auto Estimación del Avalúo Catastral (Mutación Cuarta)",
    descripcion: "Propuesta del propietario sobre el valor catastral de su predio.",
    requisitos: [
      "Oficio sencillo solicitando AUTOESTIMACIÓN DEL AVALÚO con datos personales y firma",
      "Poder (si aplica)",
      "Cédula del propietario (copia)",
      "Título de dominio registrado",
      "Documentos de soporte según el caso (escrituras, certificaciones de la Alcaldía, avalúo comercial)",
      "Certificado de tradición"
    ],
    nota: "Incluir área de terreno, área de construcción y autoestimación del avalúo por separado."
  },
  {
    id: 6,
    nombre: "Inscripción de Predios Nuevos u Omitidos (Mutación Quinta)",
    descripcion: "Registro de predios no inscritos previamente o que fueron omitidos.",
    requisitos: [
      "Oficio sencillo solicitando INSCRIPCIÓN DE PREDIO con datos personales y firma",
      "Poder (si aplica)",
      "Cédula del propietario (copia)",
      "Título de dominio registrado",
      "Plano del levantamiento planimétrico en formato digital (dwg, dxf o shapefile)",
      "Certificado de tradición"
    ],
    nota: "Para mejoras en predio ajeno: Acreditar existencia y propiedad de la mejora."
  },
  {
    id: 7,
    nombre: "Revisión de Avalúos",
    descripcion: "Solicitud para revisar el valor catastral por inconformidades.",
    requisitos: [
      "Oficio sencillo solicitando REVISIÓN DE AVALÚOS, indicando motivos y vigencias solicitadas",
      "Poder (si aplica)",
      "Cédula del propietario (copia)",
      "Pruebas documentales que sustenten la inconformidad para cada vigencia",
      "Certificado de tradición"
    ],
    nota: "Medios de prueba: Registro fotográfico, avalúo comercial, ofertas de mercado, planos, aerofotografías, etc."
  },
  {
    id: 8,
    nombre: "Complementación de Información Catastral",
    descripcion: "Adición o mejora de datos en la información catastral de un predio.",
    requisitos: [
      "Oficio sencillo solicitando COMPLEMENTACIÓN con datos personales y firma",
      "Poder (si aplica)",
      "Cédula del propietario (copia)",
      "Documentos que justifiquen la complementación",
      "Certificado de tradición"
    ],
    nota: "Para complementar dirección: Incluir boletín de nomenclatura de la autoridad municipal."
  },
  {
    id: 9,
    nombre: "Rectificación Área y/o Linderos (Fines Catastrales)",
    descripcion: "Corrección del área o límites de un terreno para fines catastrales.",
    requisitos: [
      "Oficio sencillo solicitando RECTIFICACIÓN DE ÁREA con datos personales y firma",
      "Poder (si aplica)",
      "Cédula del propietario (copia)",
      "Título de dominio registrado",
      "Plano del levantamiento planimétrico en formato digital",
      "Información de contacto de los colindantes (celular y correo)",
      "Certificado de tradición"
    ]
  },
  {
    id: 10,
    nombre: "Rectificación Área y/o Linderos (Fines Registrales)",
    descripcion: "Corrección del área o límites con implicaciones legales y de registro.",
    requisitos: [
      "Oficio sencillo solicitando RECTIFICACIÓN DE ÁREA con datos y firma de todos los propietarios",
      "Poder (si aplica)",
      "Cédula de todos los propietarios (copia)",
      "Título de dominio registrado",
      "Plano topográfico en formato Shape, Geopackage o DWG (EPSG 9377) con cuadro de coordenadas",
      "Títulos de dominio de los colindantes",
      "Información de contacto de los colindantes",
      "Certificado de tradición",
      "Estudio de títulos de dominio (si lo tiene)"
    ]
  },
  {
    id: 11,
    nombre: "Cancelación Inscripción Catastral",
    descripcion: "Eliminación de un predio del registro catastral.",
    requisitos: [
      "Oficio sencillo solicitando CANCELACIÓN DEL PREDIO con datos personales y firma",
      "Poder (si aplica)",
      "Cédula del propietario (copia)",
      "Orden legal, judicial o administrativa que soporte el cambio",
      "Certificado de tradición"
    ],
    nota: "Para doble inscripción: Plano protocolizado y recibos de impuesto predial. Para causas naturales: Documento que demuestre la desaparición del predio."
  },
  {
    id: 12,
    nombre: "Certificado Catastral",
    descripcion: "Documento con la información general de un predio registrada en el catastro.",
    requisitos: [
      "Oficio solicitando CERTIFICADO CATASTRAL con: nombre, cédula, número predial, matrícula inmobiliaria, dirección, celular, correo y firma",
      "Poder (si aplica)",
      "Cédula del propietario (copia)",
      "Certificado de tradición"
    ]
  },
  {
    id: 13,
    nombre: "Certificado de Avalúo",
    descripcion: "Documento que certifica el valor catastral de un predio.",
    requisitos: [
      "Oficio solicitando CERTIFICADO DE AVALÚO con: nombre, cédula, número predial, matrícula inmobiliaria, dirección, celular, correo y firma",
      "Poder (si aplica)",
      "Cédula del propietario (copia)",
      "Certificado de tradición"
    ]
  },
  {
    id: 14,
    nombre: "Certificado Catastral Especial",
    descripcion: "Certificado con información catastral específica, no general.",
    requisitos: [
      "Oficio solicitando CERTIFICADO CATASTRAL ESPECIAL con datos personales completos",
      "Poder (si aplica)",
      "Cédula del propietario (copia)",
      "Certificado de tradición"
    ]
  },
  {
    id: 15,
    nombre: "Certificado Plano Predial Catastral",
    descripcion: "Certificado que incluye el plano catastral de un predio.",
    requisitos: [
      "Oficio solicitando CERTIFICADO PLANO PREDIAL CATASTRAL con datos personales completos",
      "Poder (si aplica)",
      "Cédula del propietario (copia)",
      "Certificado de tradición"
    ]
  },
  {
    id: 16,
    nombre: "Fotocopia de la Ficha Predial con Croquis",
    descripcion: "Copia de la ficha catastral de un predio incluyendo croquis del mismo.",
    requisitos: [
      "Oficio solicitando FICHA PREDIAL con: nombre, cédula, número predial, matrícula inmobiliaria, dirección, celular, correo y firma",
      "Poder (si aplica)",
      "Cédula del propietario (copia)",
      "Certificado de tradición"
    ]
  }
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [resending, setResending] = useState(false);
  const [sessionExpiredMsg, setSessionExpiredMsg] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showTramitesModal, setShowTramitesModal] = useState(false);
  const { login, hasOfflineCredentials, offlineCredentialsInfo } = useAuth();
  const navigate = useNavigate();

  // Escuchar cambios de conexión
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Verificar si la sesión expiró por inactividad
  useEffect(() => {
    const expired = localStorage.getItem('session_expired');
    if (expired === 'inactivity') {
      setSessionExpiredMsg('Su sesión se cerró automáticamente por inactividad.');
      localStorage.removeItem('session_expired');
    }
  }, []);

  // Pre-llenar email si hay credenciales offline
  useEffect(() => {
    if (!isOnline && offlineCredentialsInfo?.email) {
      setEmail(offlineCredentialsInfo.email);
    }
  }, [isOnline, offlineCredentialsInfo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      if (!isOnline) {
        toast.success('¡Sesión offline iniciada!');
      } else {
        toast.success('¡Bienvenido!');
      }
      navigate('/dashboard');
    } catch (error) {
      // Verificar si el error es por email no verificado
      if (error.response?.data?.detail === 'email_not_verified') {
        setShowVerification(true);
        toast.info('Tu correo no está verificado. Se ha enviado un nuevo código.');
      } else {
        toast.error(error.response?.data?.detail || error.message || 'Error al iniciar sesión');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/verify-email`, {
        email: email,
        code: verificationCode
      });
      
      if (res.data.token) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        toast.success('¡Cuenta verificada exitosamente!');
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Código inválido');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResending(true);
    try {
      await axios.post(`${API}/auth/resend-verification`, { email });
      toast.success('Se ha enviado un nuevo código a tu correo');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al reenviar código');
    } finally {
      setResending(false);
    }
  };

  // Pantalla de verificación de código
  if (showVerification) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 h-screen w-full">
        {/* Left Panel - Image */}
        <div className="hidden lg:flex flex-col justify-between bg-emerald-900 p-12 text-white relative overflow-hidden">
          <div className="absolute inset-0">
            <img
              src="https://images.unsplash.com/photo-1662140246046-fc44f41e4362?q=85&w=1920"
              alt="Mapa Catastral"
              className="w-full h-full object-cover opacity-20"
            />
          </div>
          <div className="relative z-10 text-center">
            <img 
              src="/logo-asomunicipios.png" 
              alt="Asomunicipios Logo" 
              className="w-40 mx-auto mb-4 rounded-lg shadow-lg"
            />
            <h2 className="text-2xl font-bold font-outfit leading-tight">Asociación de Municipios del Catatumbo,</h2>
            <p className="text-emerald-100 mt-1 text-xl leading-relaxed">Provincia de Ocaña y Sur del Cesar</p>
          </div>
          <div className="relative z-10 text-center">
            <p className="text-emerald-100 text-lg font-semibold">Tu radicador catastral</p>
          </div>
        </div>

        {/* Right Panel - Verification */}
        <div className="flex items-center justify-center p-8 bg-slate-50">
          <div className="w-full max-w-md space-y-8">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <Mail className="w-8 h-8 text-emerald-700" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-outfit">
                Verifica tu correo
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Hemos enviado un código de 6 dígitos a
              </p>
              <p className="font-semibold text-emerald-700">{email}</p>
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-700">
                  <strong>¿No lo encuentras?</strong> Revisa tu carpeta de <strong>Spam</strong> o <strong>Correo no deseado</strong>
                </p>
              </div>
            </div>

            <form onSubmit={handleVerifyCode} className="mt-8 space-y-6">
              <div>
                <Label htmlFor="code" className="text-slate-700">Código de verificación</Label>
                <Input
                  id="code"
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  maxLength={6}
                  className="mt-1 text-center text-2xl tracking-[0.5em] font-mono focus-visible:ring-emerald-600"
                  placeholder="000000"
                  data-testid="verification-code-input"
                />
                <p className="mt-2 text-xs text-slate-500 text-center">
                  El código expira en 30 minutos
                </p>
              </div>

              <Button
                type="submit"
                disabled={loading || verificationCode.length !== 6}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-medium py-2.5 rounded-md transition-all active:scale-95"
                data-testid="verify-button"
              >
                {loading ? 'Verificando...' : 'Verificar Código'}
              </Button>
            </form>

            <div className="text-center space-y-4">
              <p className="text-sm text-slate-600">
                ¿No recibiste el código?{' '}
                <button
                  onClick={handleResendCode}
                  disabled={resending}
                  className="text-emerald-700 hover:text-emerald-800 font-medium inline-flex items-center gap-1"
                >
                  {resending ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Reenviando...
                    </>
                  ) : (
                    'Reenviar código'
                  )}
                </button>
              </p>
              
              <button
                onClick={() => setShowVerification(false)}
                className="text-slate-500 hover:text-slate-700 text-sm inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver al login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 h-screen w-full">
      {/* Left Panel - Image */}
      <div className="hidden lg:flex flex-col justify-between bg-emerald-900 p-12 text-white relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1662140246046-fc44f41e4362?q=85&w=1920"
            alt="Mapa Catastral"
            className="w-full h-full object-cover opacity-20"
          />
        </div>
        <div className="relative z-10 text-center">
          <img 
            src="/logo-asomunicipios.png" 
            alt="Asomunicipios Logo" 
            className="w-40 mx-auto mb-4 rounded-lg shadow-lg"
            data-testid="login-logo"
          />
          <h2 className="text-2xl font-bold font-outfit leading-tight">Asociación de Municipios del Catatumbo,</h2>
          <p className="text-emerald-100 mt-1 text-xl leading-relaxed">Provincia de Ocaña y Sur del Cesar</p>
          <p className="text-emerald-200 mt-3 text-lg font-bold tracking-wide">– Asomunicipios –</p>
        </div>
        <div className="relative z-10 text-center">
          <p className="text-emerald-100 text-lg font-semibold">
            Asomunicipios en Línea
          </p>
          <p className="text-emerald-200 text-sm mt-1">
            Tu radicador catastral
          </p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex items-center justify-center p-6 md:p-8 bg-slate-50 relative min-h-screen lg:min-h-0">
        {/* Imagen de fondo para móvil */}
        <div className="lg:hidden absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1662140246046-fc44f41e4362?q=85&w=1920"
            alt="Mapa Catastral"
            className="w-full h-full object-cover opacity-10"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-50/80 to-slate-50/95"></div>
        </div>
        
        <div className="w-full max-w-md space-y-6 relative z-10">
          {/* Logo para móvil - solo visible en pantallas pequeñas */}
          <div className="lg:hidden text-center">
            <img 
              src="/logo-asomunicipios.png" 
              alt="Asomunicipios Logo" 
              className="w-24 mx-auto mb-2 rounded-lg shadow-md"
              data-testid="login-logo-mobile"
            />
            <h2 className="text-base font-bold text-emerald-800 font-outfit">Asomunicipios</h2>
            <p className="text-xs text-slate-500">Sistema de Gestión Catastral</p>
          </div>
          
          <div className="text-center">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 font-outfit" data-testid="login-title">
              Iniciar Sesión
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Ingresa tus credenciales para acceder
            </p>
          </div>

          {/* Indicador de estado de conexión */}
          {!isOnline && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4" data-testid="offline-indicator">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <WifiOff className="w-6 h-6 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-amber-800">Modo Sin Conexión</p>
                  {hasOfflineCredentials ? (
                    <p className="text-sm text-amber-700 mt-1">
                      Puede iniciar sesión con las credenciales guardadas localmente.
                      {offlineCredentialsInfo?.email && (
                        <span className="block mt-1 font-medium">{offlineCredentialsInfo.email}</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-sm text-amber-700 mt-1">
                      No hay credenciales guardadas. Necesita conectarse a internet para iniciar sesión por primera vez.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {isOnline && (
            <div className="flex items-center justify-center gap-2 text-emerald-600 text-sm">
              <Wifi className="w-4 h-4" />
              <span>Conectado</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-6" data-testid="login-form">
            {/* Mensaje de sesión expirada */}
            {sessionExpiredMsg && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2 text-amber-800">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">{sessionExpiredMsg}</p>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-slate-700">Correo Electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1 focus-visible:ring-emerald-600"
                  placeholder="tu@correo.com"
                  data-testid="login-email-input"
                />
              </div>
              <div>
                <Label htmlFor="password" className="text-slate-700">Contraseña</Label>
                <div className="relative mt-1">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pr-10 focus-visible:ring-emerald-600"
                    placeholder="••••••••"
                    data-testid="login-password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-medium py-2.5 rounded-md transition-all active:scale-95"
              data-testid="login-submit-button"
            >
              {loading ? (
                'Iniciando sesión...'
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  Iniciar Sesión
                </>
              )}
            </Button>

            <div className="text-center">
              <Link to="/forgot-password" className="text-sm text-emerald-700 hover:text-emerald-800 font-medium" data-testid="forgot-password-link">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          </form>

          {/* Botón para ver trámites y requisitos */}
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowTramitesModal(true)}
              className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300"
              data-testid="ver-tramites-btn"
            >
              <FileText className="w-4 h-4 mr-2" />
              Ver Trámites y Requisitos
            </Button>
          </div>

          <p className="text-center text-sm text-slate-600">
            ¿No tienes una cuenta?{' '}
            <Link to="/register" className="text-emerald-700 hover:text-emerald-800 font-medium" data-testid="register-link">
              Regístrate aquí
            </Link>
          </p>
        </div>
      </div>

      {/* Modal de Trámites y Requisitos */}
      <Dialog open={showTramitesModal} onOpenChange={setShowTramitesModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 bg-emerald-700 text-white sticky top-0 z-10">
            <DialogTitle className="flex items-center gap-2 text-xl font-outfit">
              <FileText className="w-6 h-6" />
              Trámites Catastrales y Requisitos
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="h-[calc(90vh-180px)] px-6">
            <div className="py-4">
              <Accordion type="single" collapsible className="space-y-2">
                {TRAMITES_CATASTRALES.map((tramite) => (
                  <AccordionItem 
                    key={tramite.id} 
                    value={`tramite-${tramite.id}`}
                    className="border border-slate-200 rounded-lg px-4 data-[state=open]:border-emerald-300 data-[state=open]:bg-emerald-50/30"
                  >
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-start gap-3 text-left">
                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold">
                          {tramite.id}
                        </span>
                        <span className="font-medium text-slate-800 text-sm leading-tight">
                          {tramite.nombre}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <div className="ml-10 space-y-3">
                        <p className="text-sm text-slate-600 italic">
                          {tramite.descripcion}
                        </p>
                        
                        <div>
                          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
                            Requisitos:
                          </p>
                          <ul className="space-y-1.5">
                            {tramite.requisitos.map((req, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                                <span>{req}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        {tramite.nota && (
                          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mt-2">
                            <p className="text-xs text-amber-800">
                              <strong>Nota:</strong> {tramite.nota}
                            </p>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </ScrollArea>
          
          {/* Footer con información de contacto */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 sticky bottom-0">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="w-4 h-4" />
                <span className="text-sm">Consultar costos:</span>
                <a 
                  href="https://wa.me/573102327647" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-700 font-semibold hover:text-emerald-800"
                >
                  <MessageCircle className="w-4 h-4" />
                  310 232 76 47
                </a>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTramitesModal(false)}
                className="text-slate-600"
              >
                <X className="w-4 h-4 mr-1" />
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
