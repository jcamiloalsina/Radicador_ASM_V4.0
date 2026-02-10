// Componentes de Conservación
// Estos componentes fueron extraídos de Predios.js para mejorar la mantenibilidad

// Componentes de UI
export { default as MunicipioCard } from './MunicipioCard';
export { default as StatsPanel, StatCard, formatCurrency, formatAreaHectareas } from './StatsPanel';
export { default as Pagination } from './Pagination';
export { default as CodigoPredialBuilder } from './CodigoPredialBuilder';
export { default as PropietariosList } from './PropietariosList';

// Componentes de formularios y diálogos
export { default as ImportR1R2Form } from './ImportR1R2Form';
export { default as PrediosEliminadosView } from './PrediosEliminadosView';
export { default as ReaparicionesPendientes } from './ReaparicionesPendientes';
export { default as SubsanacionesPendientes } from './SubsanacionesPendientes';

// Hooks personalizados
export { 
  usePropietarios,
  useZonasTerreno,
  useZonasFisicas,
  useConstrucciones,
  generarIdConstruccion,
  calcularAreasTotales,
  calcularTotalRegistrosR2
} from './hooks/usePredioForm';
