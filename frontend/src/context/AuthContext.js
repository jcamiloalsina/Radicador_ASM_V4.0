import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { saveOfflineCredentials, authenticateOffline, isOnline, hasOfflineCredentials, getOfflineCredentialsInfo } from '../utils/offlineAuth';

const AuthContext = createContext(null);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Timeout de inactividad: 30 minutos en milisegundos
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const timeoutRef = useRef(null);
  const warningTimeoutRef = useRef(null);

  // Función para cerrar sesión por inactividad
  const logoutByInactivity = useCallback(() => {
    console.log('Sesión cerrada por inactividad');
    setShowTimeoutWarning(false);
    localStorage.removeItem('token');
    localStorage.setItem('session_expired', 'inactivity');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  }, []);

  // Función para reiniciar el timer de inactividad
  const resetInactivityTimer = useCallback(() => {
    // Limpiar timers existentes
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    setShowTimeoutWarning(false);

    if (token && user) {
      // Mostrar advertencia 2 minutos antes del cierre
      warningTimeoutRef.current = setTimeout(() => {
        setShowTimeoutWarning(true);
      }, INACTIVITY_TIMEOUT - 2 * 60 * 1000);

      // Cerrar sesión después del timeout completo
      timeoutRef.current = setTimeout(() => {
        logoutByInactivity();
      }, INACTIVITY_TIMEOUT);
    }
  }, [token, user, logoutByInactivity]);

  // Registrar eventos de actividad del usuario
  useEffect(() => {
    if (!token || !user) return;

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      resetInactivityTimer();
    };

    // Agregar listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Iniciar timer
    resetInactivityTimer();

    // Cleanup
    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    };
  }, [token, user, resetInactivityTimer]);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
    } catch (error) {
      console.error('Error fetching user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    // Verificar si estamos online
    if (!isOnline()) {
      // Intentar autenticación offline
      console.log('🔌 Sin conexión - Intentando login offline...');
      const offlineResult = await authenticateOffline(email, password);
      
      if (offlineResult.success) {
        console.log('✅ Login offline exitoso');
        localStorage.setItem('token', offlineResult.token);
        localStorage.setItem('isOfflineSession', 'true');
        localStorage.removeItem('session_expired');
        setToken(offlineResult.token);
        setUser(offlineResult.user);
        // No configurar axios header porque no hay servidor
        return offlineResult.user;
      } else {
        throw new Error(offlineResult.error);
      }
    }
    
    // Login online normal
    try {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      const { token, user } = response.data;
      
      // Guardar token y usuario
      localStorage.setItem('token', token);
      localStorage.removeItem('session_expired');
      localStorage.removeItem('isOfflineSession');
      setToken(token);
      setUser(user);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Guardar credenciales para uso offline
      await saveOfflineCredentials(email, password, user);
      
      return user;
    } catch (error) {
      // Si falla por problemas de red, intentar offline
      if (!navigator.onLine || error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
        console.log('🔌 Error de red - Intentando login offline...');
        const offlineResult = await authenticateOffline(email, password);
        
        if (offlineResult.success) {
          console.log('✅ Login offline exitoso (fallback)');
          localStorage.setItem('token', offlineResult.token);
          localStorage.setItem('isOfflineSession', 'true');
          localStorage.removeItem('session_expired');
          setToken(offlineResult.token);
          setUser(offlineResult.user);
          return offlineResult.user;
        }
      }
      throw error;
    }
  };

  const register = async (email, password, full_name) => {
    const response = await axios.post(`${API}/auth/register`, {
      email,
      password,
      full_name
    });
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    setToken(token);
    setUser(user);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    return user;
  };

  const logout = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    setShowTimeoutWarning(false);
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  // Función para extender la sesión manualmente
  const extendSession = () => {
    resetInactivityTimer();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      register, 
      logout, 
      token,
      showTimeoutWarning,
      extendSession
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
