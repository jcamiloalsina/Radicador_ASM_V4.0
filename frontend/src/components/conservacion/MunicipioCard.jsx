import React, { memo } from 'react';
import { Button } from '../ui/button';

/**
 * Tarjeta de municipio para el dashboard de Conservación
 * Muestra el nombre del municipio, conteo de predios y badge de reapariciones
 * 
 * @param {string} municipio - Nombre del municipio
 * @param {number} count - Número de predios
 * @param {number} reaparicionesCount - Número de reapariciones pendientes
 * @param {boolean} showReapariciones - Si mostrar el badge de reapariciones
 * @param {function} onSelect - Callback al seleccionar el municipio
 * @param {function} onReaparicionesClick - Callback al hacer clic en badge de reapariciones
 */
const MunicipioCard = memo(({ 
  municipio, 
  count, 
  reaparicionesCount = 0,
  showReapariciones = false,
  onSelect,
  onReaparicionesClick
}) => {
  return (
    <div className="relative">
      <Button
        variant="outline"
        className="w-full h-auto min-h-[80px] py-3 px-3 flex flex-col items-start justify-center text-left hover:bg-emerald-50 hover:border-emerald-300 overflow-hidden"
        onClick={onSelect}
        data-testid={`municipio-card-${municipio}`}
      >
        <span className="font-medium text-slate-900 text-sm leading-tight truncate w-full">
          {municipio}
        </span>
        <span className="text-lg md:text-xl font-bold text-emerald-700">
          {count?.toLocaleString()}
        </span>
        <span className="text-[10px] md:text-xs text-slate-500 leading-tight">
          predios
        </span>
      </Button>
      
      {/* Badge de reapariciones pendientes */}
      {reaparicionesCount > 0 && showReapariciones && (
        <button
          className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center hover:bg-amber-600 shadow-md"
          onClick={(e) => {
            e.stopPropagation();
            onReaparicionesClick?.();
          }}
          title={`${reaparicionesCount} reapariciones pendientes`}
          data-testid={`reapariciones-badge-${municipio}`}
        >
          {reaparicionesCount}
        </button>
      )}
    </div>
  );
});

MunicipioCard.displayName = 'MunicipioCard';

export default MunicipioCard;
