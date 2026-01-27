import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { UserPlus, Mail, ArrowLeft, RefreshCw } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Register() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: ''
  });
  const [loading, setLoading] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [resending, setResending] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/register`, formData);
      
      if (res.data.requires_verification) {
        setShowVerification(true);
        toast.success('Se ha enviado un código de verificación a tu correo');
      } else if (res.data.token) {
        // Login directo (usuarios internos)
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/verify-email`, {
        email: formData.email,
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
      await axios.post(`${API}/auth/resend-verification`, {
        email: formData.email
      });
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
              className="w-64 mx-auto mb-6 rounded-lg shadow-lg"
            />
            <h2 className="text-xl font-bold font-outfit leading-tight">Asociación de Municipios del Catatumbo,</h2>
            <p className="text-emerald-100 mt-1 text-lg leading-relaxed">Provincia de Ocaña y Sur del Cesar</p>
          </div>
          <div className="relative z-10 text-center">
            <p className="text-emerald-100 text-lg font-semibold">Asomunicipios en Línea</p>
            <p className="text-emerald-200 text-sm mt-1">Tu radicador catastral</p>
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
              <p className="font-semibold text-emerald-700">{formData.email}</p>
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
                Volver al registro
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
            className="w-64 mx-auto mb-6 rounded-lg shadow-lg"
            data-testid="register-logo"
          />
          <h2 className="text-xl font-bold font-outfit leading-tight">Asociación de Municipios del Catatumbo,</h2>
          <p className="text-emerald-100 mt-1 text-lg leading-relaxed">Provincia de Ocaña y Sur del Cesar</p>
          <p className="text-emerald-200 mt-2 text-base font-bold tracking-wide">– Asomunicipios –</p>
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
      <div className="flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 font-outfit" data-testid="register-title">
              Crear Cuenta
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Completa el formulario para registrarte
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6" data-testid="register-form">
            <div className="space-y-4">
              <div>
                <Label htmlFor="full_name" className="text-slate-700">Nombre Completo</Label>
                <Input
                  id="full_name"
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                  className="mt-1 focus-visible:ring-emerald-600"
                  placeholder="Juan Pérez"
                  data-testid="register-name-input"
                />
              </div>
              <div>
                <Label htmlFor="email" className="text-slate-700">Correo Electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="mt-1 focus-visible:ring-emerald-600"
                  placeholder="tu@correo.com"
                  data-testid="register-email-input"
                />
              </div>
              <div>
                <Label htmlFor="password" className="text-slate-700">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="mt-1 focus-visible:ring-emerald-600"
                  placeholder="••••••••"
                  data-testid="register-password-input"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-medium py-2.5 rounded-md transition-all active:scale-95"
              data-testid="register-submit-button"
            >
              {loading ? (
                'Registrando...'
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Crear Cuenta
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-slate-600">
            ¿Ya tienes una cuenta?{' '}
            <Link to="/login" className="text-emerald-700 hover:text-emerald-800 font-medium" data-testid="login-link">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
