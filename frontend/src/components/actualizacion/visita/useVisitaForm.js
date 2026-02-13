/**
 * Hook personalizado para gestionar el estado del formulario de visita
 * Centraliza toda la lógica de estado y funciones auxiliares
 */
import { useState, useCallback, useEffect, startTransition } from 'react';

// Estado inicial del formulario
const getInitialVisitaData = () => ({
  // Sección 2: Información Básica
  tipo_predio: '',
  direccion_visita: '',
  destino_economico_visita: '',
  area_terreno_visita: '',
  area_construida_visita: '',
  // Sección 3: PH (Propiedad Horizontal)
  ph_area_coeficiente: '',
  ph_area_construida_privada: '',
  ph_area_construida_comun: '',
  ph_copropiedad: '',
  ph_predio_asociado: '',
  ph_torre: '',
  ph_apartamento: '',
  // Sección 4: Condominio
  cond_area_terreno_comun: '',
  cond_area_terreno_privada: '',
  cond_area_construida_privada: '',
  cond_area_construida_comun: '',
  cond_condominio: '',
  cond_predio_asociado: '',
  cond_unidad: '',
  cond_casa: '',
  // Sección 5: Información Jurídica
  jur_matricula: '',
  jur_tipo_doc: '',
  jur_numero_doc: '',
  jur_notaria: '',
  jur_fecha: '',
  jur_ciudad: '',
  jur_razon_social: '',
  // Sección 6: Datos de Notificación
  not_telefono: '',
  not_direccion: '',
  not_correo: '',
  not_autoriza_correo: '',
  not_departamento: 'Norte de Santander',
  not_municipio: '',
  not_vereda: '',
  not_corregimiento: '',
  not_datos_adicionales: '',
  // Sección 8: Calificación (legacy - individual)
  calif_estructura: { armazon: '', muros: '', cubierta: '', conservacion: '' },
  calif_acabados: { fachadas: '', cubrim_muros: '', pisos: '', conservacion: '' },
  calif_bano: { tamano: '', enchape: '', mobiliario: '', conservacion: '' },
  calif_cocina: { tamano: '', enchape: '', mobiliario: '', conservacion: '' },
  calif_industria: { cercha_madera: '', cercha_metalica_liviana: '', cercha_metalica_mediana: '', cercha_metalica_pesada: '', altura: '' },
  calif_generales: { total_pisos: '', total_habitaciones: '', total_banos: '', total_locales: '', area_total_construida: '' },
  // Sección 9: Resumen áreas de terreno
  area_titulo_m2: '',
  area_titulo_ha: '',
  area_titulo_desc: '',
  area_base_catastral_m2: '',
  area_base_catastral_ha: '',
  area_base_catastral_desc: '',
  area_geografica_m2: '',
  area_geografica_ha: '',
  area_geografica_desc: '',
  area_levantamiento_m2: '',
  area_levantamiento_ha: '',
  area_levantamiento_desc: '',
  area_identificacion_m2: '',
  area_identificacion_ha: '',
  area_identificacion_desc: '',
  // Sección 10: Fotos croquis
  fotos_croquis: [],
  // Sección 11: Observaciones generales
  observaciones_generales: '',
  // Sección 12: Firmas
  firma_visitado_base64: null,
  firma_reconocedor_base64: null,
  nombre_visitado: '',
  nombre_reconocedor: '',
  // Datos de la visita
  fecha_visita: new Date().toISOString().split('T')[0],
  hora_visita: new Date().toTimeString().slice(0, 5),
  persona_atiende: '',
  relacion_predio: '',
  estado_predio: '',
  acceso_predio: 'si',
  servicios_publicos: [],
  observaciones: '',
  firma_base64: null,
  sin_cambios: false,
  // Coordenadas GPS
  coordenadas_gps: { latitud: '', longitud: '', precision: null, fecha_captura: null }
});

const getInitialConstrucciones = () => [
  { unidad: 'A', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' },
  { unidad: 'B', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' },
  { unidad: 'C', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' },
  { unidad: 'D', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' },
  { unidad: 'E', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' }
];

const getInitialCalificaciones = () => [{
  id: 1,
  estructura: { armazon: '', muros: '', cubierta: '', conservacion: '' },
  acabados: { fachadas: '', cubrim_muros: '', pisos: '', conservacion: '' },
  bano: { tamano: '', enchape: '', mobiliario: '', conservacion: '' },
  cocina: { tamano: '', enchape: '', mobiliario: '', conservacion: '' },
  industria: { cercha_madera: '', cercha_metalica_liviana: '', cercha_metalica_mediana: '', cercha_metalica_pesada: '', altura: '' },
  datos_generales: { total_pisos: '', total_habitaciones: '', total_banos: '', total_locales: '', area_total_construida: '' }
}];

const getInitialPropietarios = () => [{
  tipo_documento: 'C',
  numero_documento: '',
  nombre: '',
  primer_apellido: '',
  segundo_apellido: '',
  genero: '',
  genero_otro: '',
  grupo_etnico: 'Ninguno',
  estado: ''
}];

export const useVisitaForm = ({ proyectoId, selectedPredio, showVisitaModal }) => {
  // Estados principales
  const [visitaPagina, setVisitaPagina] = useState(1);
  const [visitaDataRaw, setVisitaDataRaw] = useState(getInitialVisitaData);
  const [visitaConstruccionesRaw, setVisitaConstruccionesRaw] = useState(getInitialConstrucciones);
  const [visitaCalificacionesRaw, setVisitaCalificacionesRaw] = useState(getInitialCalificaciones);
  const [visitaPropietariosRaw, setVisitaPropietariosRaw] = useState(getInitialPropietarios);
  const [fotos, setFotos] = useState([]);

  // Setters optimizados con startTransition
  const setVisitaData = useCallback((updater) => {
    startTransition(() => {
      setVisitaDataRaw(updater);
    });
  }, []);

  const setVisitaConstrucciones = useCallback((updater) => {
    startTransition(() => {
      setVisitaConstruccionesRaw(updater);
    });
  }, []);

  const setVisitaCalificaciones = useCallback((updater) => {
    startTransition(() => {
      setVisitaCalificacionesRaw(updater);
    });
  }, []);

  const setVisitaPropietarios = useCallback((updater) => {
    startTransition(() => {
      setVisitaPropietariosRaw(updater);
    });
  }, []);

  // Clave para localStorage
  const getVisitaStorageKey = useCallback(() => {
    const codigo = selectedPredio?.codigo_predial || selectedPredio?.numero_predial;
    return codigo ? `visita_draft_${proyectoId}_${codigo}` : null;
  }, [selectedPredio, proyectoId]);

  // Auto-guardado
  useEffect(() => {
    const storageKey = getVisitaStorageKey();
    if (!storageKey || !showVisitaModal) return;

    const timeoutId = setTimeout(() => {
      try {
        const draftData = {
          visitaData: visitaDataRaw,
          visitaPropietarios: visitaPropietariosRaw,
          visitaConstrucciones: visitaConstruccionesRaw,
          visitaCalificaciones: visitaCalificacionesRaw,
          visitaPagina: visitaPagina,
          fotos: fotos,
          savedAt: new Date().toISOString()
        };
        localStorage.setItem(storageKey, JSON.stringify(draftData));
        console.log('[Visita] Borrador auto-guardado');
      } catch (e) {
        console.warn('[Visita] Error guardando borrador:', e);
      }
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [visitaDataRaw, visitaPropietariosRaw, visitaConstruccionesRaw, visitaCalificacionesRaw, visitaPagina, fotos, getVisitaStorageKey, showVisitaModal]);

  // Funciones auxiliares para propietarios
  const agregarPropietario = useCallback(() => {
    setVisitaPropietarios(prev => [...prev, {
      tipo_documento: 'C',
      numero_documento: '',
      nombre: '',
      primer_apellido: '',
      segundo_apellido: '',
      genero: '',
      genero_otro: '',
      grupo_etnico: 'Ninguno',
      estado: ''
    }]);
  }, [setVisitaPropietarios]);

  const eliminarPropietario = useCallback((idx) => {
    setVisitaPropietarios(prev => prev.filter((_, i) => i !== idx));
  }, [setVisitaPropietarios]);

  const actualizarPropietario = useCallback((idx, campo, valor) => {
    setVisitaPropietarios(prev => {
      const nuevos = [...prev];
      nuevos[idx] = { ...nuevos[idx], [campo]: valor };
      return nuevos;
    });
  }, [setVisitaPropietarios]);

  // Funciones auxiliares para construcciones
  const agregarConstruccion = useCallback(() => {
    setVisitaConstrucciones(prev => {
      const nextLetter = String.fromCharCode(65 + prev.length);
      return [...prev, { unidad: nextLetter, codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' }];
    });
  }, [setVisitaConstrucciones]);

  const eliminarConstruccion = useCallback((idx) => {
    setVisitaConstrucciones(prev => prev.filter((_, i) => i !== idx));
  }, [setVisitaConstrucciones]);

  const actualizarConstruccion = useCallback((idx, campo, valor) => {
    setVisitaConstrucciones(prev => {
      const nuevas = [...prev];
      nuevas[idx] = { ...nuevas[idx], [campo]: valor };
      return nuevas;
    });
  }, [setVisitaConstrucciones]);

  // Funciones auxiliares para calificaciones
  const agregarCalificacion = useCallback(() => {
    setVisitaCalificaciones(prev => [...prev, {
      id: prev.length + 1,
      estructura: { armazon: '', muros: '', cubierta: '', conservacion: '' },
      acabados: { fachadas: '', cubrim_muros: '', pisos: '', conservacion: '' },
      bano: { tamano: '', enchape: '', mobiliario: '', conservacion: '' },
      cocina: { tamano: '', enchape: '', mobiliario: '', conservacion: '' },
      industria: { cercha_madera: '', cercha_metalica_liviana: '', cercha_metalica_mediana: '', cercha_metalica_pesada: '', altura: '' },
      datos_generales: { total_pisos: '', total_habitaciones: '', total_banos: '', total_locales: '', area_total_construida: '' }
    }]);
  }, [setVisitaCalificaciones]);

  const eliminarCalificacion = useCallback((idx) => {
    setVisitaCalificaciones(prev => prev.filter((_, i) => i !== idx));
  }, [setVisitaCalificaciones]);

  const actualizarCalificacion = useCallback((califIdx, seccion, campo, valor) => {
    setVisitaCalificaciones(prev => {
      const nuevas = [...prev];
      nuevas[califIdx] = {
        ...nuevas[califIdx],
        [seccion]: { ...nuevas[califIdx][seccion], [campo]: valor }
      };
      return nuevas;
    });
  }, [setVisitaCalificaciones]);

  // Reset del formulario
  const resetForm = useCallback(() => {
    setVisitaDataRaw(getInitialVisitaData());
    setVisitaConstruccionesRaw(getInitialConstrucciones());
    setVisitaCalificacionesRaw(getInitialCalificaciones());
    setVisitaPropietariosRaw(getInitialPropietarios());
    setFotos([]);
    setVisitaPagina(1);
  }, []);

  // Recuperar borrador
  const recuperarBorrador = useCallback(() => {
    const storageKey = getVisitaStorageKey();
    if (!storageKey) return null;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('[Visita] Error recuperando borrador:', e);
    }
    return null;
  }, [getVisitaStorageKey]);

  // Aplicar borrador recuperado
  const aplicarBorrador = useCallback((borrador) => {
    if (borrador.visitaData) setVisitaDataRaw(borrador.visitaData);
    if (borrador.visitaPropietarios) setVisitaPropietariosRaw(borrador.visitaPropietarios);
    if (borrador.visitaConstrucciones) setVisitaConstruccionesRaw(borrador.visitaConstrucciones);
    if (borrador.visitaCalificaciones) setVisitaCalificacionesRaw(borrador.visitaCalificaciones);
    if (borrador.visitaPagina) setVisitaPagina(borrador.visitaPagina);
    if (borrador.fotos) setFotos(borrador.fotos);
  }, []);

  // Eliminar borrador
  const eliminarBorrador = useCallback(() => {
    const storageKey = getVisitaStorageKey();
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
  }, [getVisitaStorageKey]);

  return {
    // Estados
    visitaPagina,
    setVisitaPagina,
    visitaData: visitaDataRaw,
    setVisitaData,
    visitaConstrucciones: visitaConstruccionesRaw,
    setVisitaConstrucciones,
    visitaCalificaciones: visitaCalificacionesRaw,
    setVisitaCalificaciones,
    visitaPropietarios: visitaPropietariosRaw,
    setVisitaPropietarios,
    fotos,
    setFotos,
    // Funciones propietarios
    agregarPropietario,
    eliminarPropietario,
    actualizarPropietario,
    // Funciones construcciones
    agregarConstruccion,
    eliminarConstruccion,
    actualizarConstruccion,
    // Funciones calificaciones
    agregarCalificacion,
    eliminarCalificacion,
    actualizarCalificacion,
    // Utilidades
    resetForm,
    recuperarBorrador,
    aplicarBorrador,
    eliminarBorrador,
    getVisitaStorageKey
  };
};

export default useVisitaForm;
