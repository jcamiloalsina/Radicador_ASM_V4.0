import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check, CheckCheck, ExternalLink, X, Loader2, AlertCircle, Info, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function NotificacionesDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notificaciones, setNotificaciones] = useState([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [loading, setLoading] = useState(false);
  const [marcandoTodas, setMarcandoTodas] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Cargar notificaciones
  const cargarNotificaciones = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await axios.get(`${API}/notificaciones`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setNotificaciones(response.data.notificaciones || []);
      setNoLeidas(response.data.no_leidas || 0);
    } catch (error) {
      console.error('Error cargando notificaciones:', error);
    }
  }, []);

  // Cargar al montar y cada 30 segundos
  useEffect(() => {
    cargarNotificaciones();
    const interval = setInterval(cargarNotificaciones, 30000);
    return () => clearInterval(interval);
  }, [cargarNotificaciones]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Marcar como leída
  const marcarLeida = async (notificacion) => {
    if (notificacion.leida) return;

    try {
      const token = localStorage.getItem('token');
      await axios.patch(`${API}/notificaciones/${notificacion.id}/leer`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setNotificaciones(prev => prev.map(n => 
        n.id === notificacion.id ? { ...n, leida: true } : n
      ));
      setNoLeidas(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marcando notificación:', error);
    }
  };

  // Marcar todas como leídas
  const marcarTodasLeidas = async () => {
    setMarcandoTodas(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/notificaciones/marcar-todas-leidas`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })));
      setNoLeidas(0);
    } catch (error) {
      console.error('Error marcando todas:', error);
    } finally {
      setMarcandoTodas(false);
    }
  };

  // Navegar al enlace
  const handleNavegar = (notificacion) => {
    marcarLeida(notificacion);
    if (notificacion.enlace) {
      navigate(notificacion.enlace);
      setIsOpen(false);
    }
  };

  // Ícono según tipo
  const getIcono = (tipo) => {
    switch (tipo) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  // Formatear fecha relativa
  const formatearFecha = (fechaISO) => {
    const fecha = new Date(fechaISO);
    const ahora = new Date();
    const diff = ahora - fecha;
    
    const minutos = Math.floor(diff / 60000);
    const horas = Math.floor(diff / 3600000);
    const dias = Math.floor(diff / 86400000);

    if (minutos < 1) return 'Ahora mismo';
    if (minutos < 60) return `Hace ${minutos} min`;
    if (horas < 24) return `Hace ${horas}h`;
    if (dias < 7) return `Hace ${dias}d`;
    return fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botón de campana */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) cargarNotificaciones();
        }}
        className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
        data-testid="notificaciones-btn"
      >
        <Bell className="w-5 h-5 text-slate-600" />
        {noLeidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {noLeidas > 99 ? '99+' : noLeidas}
          </span>
        )}
      </button>

      {/* Panel desplegable */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-slate-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <h3 className="font-semibold text-slate-800">Notificaciones</h3>
            <div className="flex items-center gap-2">
              {noLeidas > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={marcarTodasLeidas}
                  disabled={marcandoTodas}
                  className="text-xs text-emerald-600 hover:text-emerald-700"
                >
                  {marcandoTodas ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <CheckCheck className="w-3 h-3 mr-1" />
                  )}
                  Marcar todas
                </Button>
              )}
              <button 
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lista de notificaciones */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
              </div>
            ) : notificaciones.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-slate-500 text-sm">No tienes notificaciones</p>
              </div>
            ) : (
              notificaciones.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNavegar(notif)}
                  className={`px-4 py-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors ${
                    !notif.leida ? 'bg-blue-50/50' : ''
                  }`}
                  data-testid={`notif-${notif.id}`}
                >
                  <div className="flex gap-3">
                    {/* Ícono */}
                    <div className="flex-shrink-0 mt-0.5">
                      {getIcono(notif.tipo)}
                    </div>
                    
                    {/* Contenido */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium ${!notif.leida ? 'text-slate-900' : 'text-slate-700'}`}>
                          {notif.titulo}
                        </p>
                        {!notif.leida && (
                          <span className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-1.5"></span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 mt-0.5 line-clamp-2">
                        {notif.mensaje}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs text-slate-400">
                          {formatearFecha(notif.fecha)}
                        </span>
                        {notif.enlace && (
                          <span className="text-xs text-emerald-600 flex items-center gap-0.5">
                            <ExternalLink className="w-3 h-3" />
                            Ver detalles
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notificaciones.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
              <p className="text-xs text-slate-500 text-center">
                Mostrando las últimas {notificaciones.length} notificaciones
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
