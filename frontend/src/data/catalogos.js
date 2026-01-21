// Catálogo de Tipos de Trámite con sub-opciones
export const TIPOS_TRAMITE = [
  {
    id: 'mutacion_primera',
    nombre: 'Mutación Primera',
    descripcion: 'Cambio de propietario',
    subOpciones: null
  },
  {
    id: 'mutacion_segunda',
    nombre: 'Mutación Segunda',
    descripcion: 'Englobe o Desenglobe',
    subOpciones: [
      { id: 'englobe', nombre: 'Englobe' },
      { id: 'desenglobe', nombre: 'Desenglobe' }
    ]
  },
  {
    id: 'mutacion_tercera',
    nombre: 'Mutación Tercera',
    descripcion: 'Modificación de construcción o destino',
    subOpciones: [
      { id: 'incorporacion_construccion', nombre: 'Incorporación de construcción' },
      { id: 'eliminacion_construccion', nombre: 'Eliminación de construcción' },
      { id: 'cambio_destino', nombre: 'Cambio de destino económico' }
    ]
  },
  {
    id: 'mutacion_cuarta',
    nombre: 'Mutación Cuarta',
    descripcion: 'Auto estimación del avalúo catastral',
    subOpciones: null
  },
  {
    id: 'mutacion_quinta',
    nombre: 'Mutación Quinta',
    descripcion: 'Inscripción o eliminación de predio',
    subOpciones: [
      { id: 'inscribir_predio', nombre: 'Inscribir predio nuevo' },
      { id: 'eliminar_predio', nombre: 'Eliminar predio existente' }
    ]
  },
  {
    id: 'mutacion_sexta',
    nombre: 'Mutación Sexta',
    descripcion: 'Rectificación de área',
    subOpciones: [
      { id: 'rectificacion_catastral', nombre: 'Rectificación de área catastral' },
      { id: 'rectificacion_registral', nombre: 'Rectificación de área registral' }
    ]
  },
  {
    id: 'complementacion',
    nombre: 'Complementación de información catastral',
    descripcion: 'Actualización de datos catastrales',
    subOpciones: null
  },
  {
    id: 'certificado_catastral',
    nombre: 'Certificado catastral sencillo',
    descripcion: 'Certificado de información catastral ($45.000 COP)',
    subOpciones: null,
    costo: 45000
  },
  {
    id: 'certificado_catastral_especial',
    nombre: 'Certificado catastral especial',
    descripcion: 'Certificado especial de colindantes o avalúos',
    subOpciones: [
      { id: 'colindantes', nombre: 'Colindantes' },
      { id: 'ultimos_5_anos', nombre: 'Últimos 5 años de avalúo del predio' }
    ]
  },
  {
    id: 'certificado_plano',
    nombre: 'Certificado plano',
    descripcion: 'Certificado de plano catastral',
    subOpciones: null
  }
];

// Catálogo de Municipios
export const MUNICIPIOS = [
  'Ábrego',
  'Bucarasica',
  'Cáchira',
  'Convención',
  'El Carmen',
  'El Tarra',
  'Hacarí',
  'La Playa',
  'Río de Oro',
  'San Calixto',
  'Sardinata',
  'Teorama'
];

// Función helper para obtener el nombre completo del trámite
export const getTramiteCompleto = (tipoId, subOpcionId) => {
  const tipo = TIPOS_TRAMITE.find(t => t.id === tipoId);
  if (!tipo) return '';
  
  if (subOpcionId && tipo.subOpciones) {
    const subOpcion = tipo.subOpciones.find(s => s.id === subOpcionId);
    if (subOpcion) {
      return `${tipo.nombre} - ${subOpcion.nombre}`;
    }
  }
  
  return tipo.nombre;
};
