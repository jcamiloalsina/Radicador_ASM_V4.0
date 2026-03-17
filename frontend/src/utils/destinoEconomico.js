// Catálogo oficial de destinos económicos
export const DESTINOS_ECONOMICOS = {
  A: 'Habitacional',
  B: 'Industrial',
  C: 'Comercial',
  D: 'Agropecuario',
  E: 'Minero',
  F: 'Cultural',
  G: 'Recreacional',
  H: 'Salubridad',
  I: 'Institucional',
  J: 'Educativo',
  K: 'Religioso',
  L: 'Agrícola',
  M: 'Pecuario',
  N: 'Agroindustrial',
  O: 'Forestal',
  P: 'Uso Público',
  Q: 'Lote Urbanizable No Urbanizado',
  R: 'Lote Urbanizable No Edificado',
  S: 'Lote No Urbanizable',
  T: 'Servicios Especiales',
};

// Retorna "A - Habitacional" o el código solo si no se encuentra
export const getDestinoLabel = (codigo) => {
  if (!codigo) return 'N/A';
  const nombre = DESTINOS_ECONOMICOS[codigo.toUpperCase()];
  return nombre ? `${codigo} - ${nombre}` : codigo;
};

// Array para selects/dropdowns
export const DESTINOS_ECONOMICOS_OPTIONS = Object.entries(DESTINOS_ECONOMICOS).map(([codigo, nombre]) => ({
  value: codigo,
  label: `${codigo} - ${nombre}`,
}));
