import React, { memo } from 'react';
import { Card, CardContent } from '../ui/card';
import { Building, DollarSign, MapPin, Map } from 'lucide-react';

/**
 * Formatea un número como moneda colombiana
 */
const formatCurrency = (value) => {
  if (!value && value !== 0) return '$0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

/**
 * Formatea un área en m² a hectáreas si es grande
 */
const formatAreaHectareas = (areaM2) => {
  if (!areaM2 && areaM2 !== 0) return '0 m²';
  const hectareas = areaM2 / 10000;
  if (hectareas >= 1) {
    return `${hectareas.toLocaleString('es-CO', { maximumFractionDigits: 0 })} ha ${(areaM2 % 10000).toLocaleString('es-CO', { maximumFractionDigits: 2 })} m²`;
  }
  return `${areaM2.toLocaleString('es-CO', { maximumFractionDigits: 2 })} m²`;
};

/**
 * Tarjeta individual de estadística
 */
const StatCard = memo(({ 
  title, 
  value, 
  subtitle,
  icon: Icon, 
  colorClass = 'emerald' 
}) => {
  const colorMap = {
    emerald: {
      border: 'border-emerald-200',
      bg: 'bg-gradient-to-br from-emerald-50 to-white',
      title: 'text-emerald-600',
      value: 'text-emerald-800',
      icon: 'text-emerald-300',
      subtitle: 'text-emerald-500'
    },
    blue: {
      border: 'border-blue-200',
      bg: 'bg-gradient-to-br from-blue-50 to-white',
      title: 'text-blue-600',
      value: 'text-blue-800',
      icon: 'text-blue-300',
      subtitle: 'text-blue-500'
    },
    amber: {
      border: 'border-amber-200',
      bg: 'bg-gradient-to-br from-amber-50 to-white',
      title: 'text-amber-600',
      value: 'text-amber-800',
      icon: 'text-amber-300',
      subtitle: 'text-amber-500'
    },
    purple: {
      border: 'border-purple-200',
      bg: 'bg-gradient-to-br from-purple-50 to-white',
      title: 'text-purple-600',
      value: 'text-purple-800',
      icon: 'text-purple-300',
      subtitle: 'text-purple-500'
    }
  };

  const colors = colorMap[colorClass] || colorMap.emerald;

  return (
    <Card className={`${colors.border} ${colors.bg}`}>
      <CardContent className="p-2 md:p-4">
        <div className="flex flex-col">
          <div className="flex items-center justify-between">
            <p className={`text-[10px] md:text-xs ${colors.title} font-medium`}>{title}</p>
            <Icon className={`w-5 h-5 md:w-8 md:h-8 ${colors.icon}`} />
          </div>
          <p className={`text-lg md:text-2xl font-bold ${colors.value}`}>{value}</p>
          {subtitle && (
            <p className={`text-[10px] md:text-xs ${colors.subtitle}`}>{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

StatCard.displayName = 'StatCard';

/**
 * Panel de estadísticas generales del dashboard de Conservación
 * Muestra: Total Predios, Avalúo Total, Área R1, Base Gráfica
 */
const StatsPanel = memo(({ stats }) => {
  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3" data-testid="stats-panel">
      <StatCard
        title="Total Predios"
        value={stats.total_predios?.toLocaleString() || '0'}
        icon={Building}
        colorClass="emerald"
      />
      <StatCard
        title="Avalúo Total"
        value={formatCurrency(stats.total_avaluo)}
        icon={DollarSign}
        colorClass="blue"
      />
      <StatCard
        title="Área R1"
        value={formatAreaHectareas(stats.total_area_terreno)}
        icon={MapPin}
        colorClass="amber"
      />
      <StatCard
        title="Base Gráfica"
        value={(stats.total_con_geometria || 0).toLocaleString()}
        subtitle={stats.total_area_gdb > 0 ? formatAreaHectareas(stats.total_area_gdb) : null}
        icon={Map}
        colorClass="purple"
      />
    </div>
  );
});

StatsPanel.displayName = 'StatsPanel';

export { StatCard, formatCurrency, formatAreaHectareas };
export default StatsPanel;
