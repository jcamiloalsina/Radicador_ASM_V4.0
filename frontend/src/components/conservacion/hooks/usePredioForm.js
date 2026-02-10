import { useCallback } from 'react';

/**
 * Hook para manejar la lista de propietarios de un predio
 * 
 * @param {Array} propietarios - Estado de propietarios
 * @param {Function} setPropietarios - Setter del estado
 * @returns {Object} - Funciones para manipular propietarios
 */
export function usePropietarios(propietarios, setPropietarios) {
  const agregarPropietario = useCallback(() => {
    setPropietarios(prev => [...prev, {
      primer_apellido: '',
      segundo_apellido: '',
      primer_nombre: '',
      segundo_nombre: '',
      estado: '',
      tipo_documento: 'C',
      numero_documento: ''
    }]);
  }, [setPropietarios]);

  const eliminarPropietario = useCallback((index) => {
    setPropietarios(prev => {
      if (prev.length > 1) {
        return prev.filter((_, i) => i !== index);
      }
      return prev;
    });
  }, [setPropietarios]);

  const actualizarPropietario = useCallback((index, campo, valor) => {
    setPropietarios(prev => {
      const nuevos = [...prev];
      nuevos[index] = { ...nuevos[index], [campo]: valor };
      return nuevos;
    });
  }, [setPropietarios]);

  // Función para formatear número de documento con padding de 0s (12 dígitos)
  const formatearNumeroDocumento = useCallback((numero) => {
    if (!numero) return '';
    const soloNumeros = numero.replace(/\D/g, '');
    return soloNumeros.padStart(12, '0');
  }, []);

  // Función para generar nombre completo desde campos separados
  const generarNombreCompleto = useCallback((prop) => {
    const partes = [
      prop.primer_apellido,
      prop.segundo_apellido,
      prop.primer_nombre,
      prop.segundo_nombre
    ].filter(p => p && p.trim());
    return partes.join(' ');
  }, []);

  return {
    agregarPropietario,
    eliminarPropietario,
    actualizarPropietario,
    formatearNumeroDocumento,
    generarNombreCompleto
  };
}

/**
 * Hook para manejar zonas de terreno (R2)
 * 
 * @param {Array} zonasTerreno - Estado de zonas
 * @param {Function} setZonasTerreno - Setter del estado
 * @returns {Object} - Funciones para manipular zonas
 */
export function useZonasTerreno(zonasTerreno, setZonasTerreno) {
  const agregarZonaTerreno = useCallback(() => {
    setZonasTerreno(prev => [...prev, {
      zona_fisica: '',
      zona_economica: '',
      area_terreno: '0'
    }]);
  }, [setZonasTerreno]);

  const eliminarZonaTerreno = useCallback((index) => {
    setZonasTerreno(prev => {
      if (prev.length > 1) {
        return prev.filter((_, i) => i !== index);
      }
      return prev;
    });
  }, [setZonasTerreno]);

  const actualizarZonaTerreno = useCallback((index, campo, valor) => {
    setZonasTerreno(prev => {
      const nuevas = [...prev];
      nuevas[index] = { ...nuevas[index], [campo]: valor };
      return nuevas;
    });
  }, [setZonasTerreno]);

  return {
    agregarZonaTerreno,
    eliminarZonaTerreno,
    actualizarZonaTerreno
  };
}

/**
 * Hook para manejar zonas físicas (modal de edición)
 * 
 * @param {Array} zonasFisicas - Estado de zonas físicas
 * @param {Function} setZonasFisicas - Setter del estado
 * @returns {Object} - Funciones para manipular zonas físicas
 */
export function useZonasFisicas(zonasFisicas, setZonasFisicas) {
  const agregarZonaFisica = useCallback(() => {
    setZonasFisicas(prev => [...prev, {
      zona_fisica: '0',
      zona_economica: '0',
      area_terreno: '0',
      habitaciones: '0',
      banos: '0',
      locales: '0',
      pisos: '1',
      puntaje: '0',
      area_construida: '0'
    }]);
  }, [setZonasFisicas]);

  const eliminarZonaFisica = useCallback((index) => {
    setZonasFisicas(prev => {
      if (prev.length > 1) {
        return prev.filter((_, i) => i !== index);
      }
      return prev;
    });
  }, [setZonasFisicas]);

  const actualizarZonaFisica = useCallback((index, campo, valor) => {
    setZonasFisicas(prev => {
      const nuevas = [...prev];
      nuevas[index] = { ...nuevas[index], [campo]: valor };
      return nuevas;
    });
  }, [setZonasFisicas]);

  return {
    agregarZonaFisica,
    eliminarZonaFisica,
    actualizarZonaFisica
  };
}

/**
 * Función para generar ID de construcción (A, B, C... Z, AA, AB...)
 * @param {number} index - Índice de la construcción
 * @returns {string} - ID generado
 */
export function generarIdConstruccion(index) {
  if (index < 26) {
    return String.fromCharCode(65 + index); // A-Z
  } else {
    const firstChar = String.fromCharCode(65 + Math.floor((index - 26) / 26));
    const secondChar = String.fromCharCode(65 + ((index - 26) % 26));
    return firstChar + secondChar; // AA, AB, AC...
  }
}

/**
 * Hook para manejar construcciones (R2)
 * 
 * @param {Array} construcciones - Estado de construcciones
 * @param {Function} setConstrucciones - Setter del estado
 * @returns {Object} - Funciones para manipular construcciones
 */
export function useConstrucciones(construcciones, setConstrucciones) {
  const agregarConstruccion = useCallback(() => {
    setConstrucciones(prev => {
      const nuevoId = generarIdConstruccion(prev.length);
      return [...prev, {
        id: nuevoId,
        piso: '1',
        habitaciones: '0',
        banos: '0',
        locales: '0',
        tipificacion: '',
        uso: '',
        puntaje: '0',
        area_construida: '0'
      }];
    });
  }, [setConstrucciones]);

  const eliminarConstruccion = useCallback((index) => {
    setConstrucciones(prev => {
      if (prev.length > 1) {
        const nuevas = prev.filter((_, i) => i !== index);
        // Reasignar IDs
        return nuevas.map((c, i) => ({
          ...c,
          id: generarIdConstruccion(i)
        }));
      }
      return prev;
    });
  }, [setConstrucciones]);

  const actualizarConstruccion = useCallback((index, campo, valor) => {
    setConstrucciones(prev => {
      const nuevas = [...prev];
      nuevas[index] = { ...nuevas[index], [campo]: valor };
      return nuevas;
    });
  }, [setConstrucciones]);

  return {
    agregarConstruccion,
    eliminarConstruccion,
    actualizarConstruccion
  };
}

/**
 * Calcular áreas totales desde zonas y construcciones
 * @param {Array} zonasTerreno - Zonas de terreno
 * @param {Array} construcciones - Construcciones
 * @returns {Object} - Áreas calculadas
 */
export function calcularAreasTotales(zonasTerreno, construcciones) {
  const areaTerrenoTotal = zonasTerreno.reduce((sum, zona) => {
    return sum + (parseFloat(zona.area_terreno) || 0);
  }, 0);
  const areaConstruidaTotal = construcciones.reduce((sum, const_) => {
    return sum + (parseFloat(const_.area_construida) || 0);
  }, 0);
  return { areaTerrenoTotal, areaConstruidaTotal };
}

/**
 * Calcular total de registros R2
 * @param {Array} zonasTerreno - Zonas de terreno
 * @param {Array} construcciones - Construcciones
 * @returns {number} - Total de registros
 */
export function calcularTotalRegistrosR2(zonasTerreno, construcciones) {
  return Math.max(zonasTerreno.length, construcciones.length);
}
