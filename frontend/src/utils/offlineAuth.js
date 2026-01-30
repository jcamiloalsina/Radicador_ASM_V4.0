/**
 * Utilidad para autenticación offline
 * Permite a usuarios iniciar sesión sin conexión a internet usando credenciales previamente guardadas
 */

// Clave para encriptar las credenciales (simple obfuscation para este caso)
const STORAGE_KEY = 'asm_offline_credentials';
const USER_DATA_KEY = 'asm_offline_user_data';

/**
 * Función simple de hash para las contraseñas (no usar en producción para seguridad real)
 * En un caso real se usaría Web Crypto API con pbkdf2
 */
const simpleHash = async (str) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(str + 'asm_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Guarda las credenciales del usuario para uso offline
 * Se llama después de un login exitoso online
 */
export const saveOfflineCredentials = async (email, password, userData) => {
  try {
    const passwordHash = await simpleHash(password);
    
    const credentials = {
      email: email.toLowerCase(),
      passwordHash,
      savedAt: new Date().toISOString(),
      // Token offline generado localmente (solo para navegación offline)
      offlineToken: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    // Guardar credenciales encriptadas
    localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
    
    // Guardar datos completos del usuario para uso offline
    localStorage.setItem(USER_DATA_KEY, JSON.stringify({
      ...userData,
      isOfflineData: true,
      savedAt: new Date().toISOString()
    }));
    
    console.log('✅ Credenciales offline guardadas para:', email);
    return true;
  } catch (error) {
    console.error('Error guardando credenciales offline:', error);
    return false;
  }
};

/**
 * Intenta autenticar al usuario de forma offline
 * Retorna los datos del usuario si las credenciales coinciden
 */
export const authenticateOffline = async (email, password) => {
  try {
    const storedData = localStorage.getItem(STORAGE_KEY);
    const storedUserData = localStorage.getItem(USER_DATA_KEY);
    
    if (!storedData || !storedUserData) {
      return { success: false, error: 'No hay credenciales offline guardadas. Necesita iniciar sesión online primero.' };
    }
    
    const credentials = JSON.parse(storedData);
    const userData = JSON.parse(storedUserData);
    
    // Verificar email
    if (credentials.email !== email.toLowerCase()) {
      return { success: false, error: 'El email no coincide con las credenciales offline guardadas.' };
    }
    
    // Verificar contraseña
    const inputHash = await simpleHash(password);
    if (credentials.passwordHash !== inputHash) {
      return { success: false, error: 'Contraseña incorrecta.' };
    }
    
    // Verificar que las credenciales no sean muy antiguas (máximo 30 días)
    const savedDate = new Date(credentials.savedAt);
    const daysSinceSaved = (Date.now() - savedDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceSaved > 30) {
      return { 
        success: false, 
        error: 'Las credenciales offline han expirado. Conecte a internet para renovarlas.' 
      };
    }
    
    // Login exitoso offline
    return {
      success: true,
      user: userData,
      token: credentials.offlineToken,
      isOffline: true
    };
  } catch (error) {
    console.error('Error en autenticación offline:', error);
    return { success: false, error: 'Error al verificar credenciales offline.' };
  }
};

/**
 * Verifica si hay credenciales offline disponibles
 */
export const hasOfflineCredentials = () => {
  const storedData = localStorage.getItem(STORAGE_KEY);
  return !!storedData;
};

/**
 * Obtiene información sobre las credenciales offline guardadas
 */
export const getOfflineCredentialsInfo = () => {
  try {
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (!storedData) return null;
    
    const credentials = JSON.parse(storedData);
    return {
      email: credentials.email,
      savedAt: credentials.savedAt
    };
  } catch {
    return null;
  }
};

/**
 * Elimina las credenciales offline
 */
export const clearOfflineCredentials = () => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(USER_DATA_KEY);
  console.log('🗑️ Credenciales offline eliminadas');
};

/**
 * Verifica si el usuario está online
 */
export const isOnline = () => {
  return navigator.onLine;
};
