// Componentes de Conservación
// Estos componentes fueron extraídos de Predios.js para mejorar la mantenibilidad

export { default as MunicipioCard } from './MunicipioCard';
export { default as StatsPanel, StatCard, formatCurrency, formatAreaHectareas } from './StatsPanel';
export { default as Pagination } from './Pagination';

// Componentes pendientes de refactorización:
// - PredioCard: Tarjeta individual de predio
// - SearchFilters: Barra de búsqueda y filtros
// - PredioForm: Formulario de creación/edición
// - CodigoPredialBuilder: Constructor del código predial de 30 dígitos
// - PropietariosList: Lista editable de propietarios
