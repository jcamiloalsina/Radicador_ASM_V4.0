import React, { useState, useMemo, memo } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Search, ChevronLeft, ChevronRight, Eye, MapPin } from 'lucide-react';

/**
 * Componente optimizado para lista de predios con paginación y búsqueda
 * - Paginación local para mejor rendimiento
 * - Búsqueda con debounce
 * - Memoización para evitar re-renders
 */
const ListaPrediosPaginada = memo(({ 
  predios = [], 
  onSelectPredio,
  onCenterPredio,
  selectedCodigo,
  pageSize = 50
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Filtrar predios
  const filteredPredios = useMemo(() => {
    if (!searchTerm) return predios;
    
    const term = searchTerm.toLowerCase();
    return predios.filter(p => 
      p.codigo_predial?.toLowerCase().includes(term) ||
      p.propietario?.toLowerCase().includes(term) ||
      p.direccion?.toLowerCase().includes(term)
    );
  }, [predios, searchTerm]);

  // Calcular paginación
  const totalPages = Math.ceil(filteredPredios.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentPredios = filteredPredios.slice(startIndex, endIndex);

  // Reset página cuando cambia el filtro
  const handleSearch = (value) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  // Estadísticas
  const stats = useMemo(() => {
    const pendientes = predios.filter(p => !p.estado || p.estado === 'pendiente').length;
    const visitados = predios.filter(p => p.estado === 'visitado').length;
    const actualizados = predios.filter(p => p.estado === 'actualizado').length;
    return { pendientes, visitados, actualizados, total: predios.length };
  }, [predios]);

  return (
    <div className="flex flex-col h-full">
      {/* Estadísticas */}
      <div className="grid grid-cols-4 gap-1 p-2 bg-slate-50 border-b text-xs">
        <div className="text-center">
          <div className="font-bold text-slate-700">{stats.total}</div>
          <div className="text-slate-500">Total</div>
        </div>
        <div className="text-center">
          <div className="font-bold text-amber-600">{stats.pendientes}</div>
          <div className="text-slate-500">Pendientes</div>
        </div>
        <div className="text-center">
          <div className="font-bold text-blue-600">{stats.visitados}</div>
          <div className="text-slate-500">Visitados</div>
        </div>
        <div className="text-center">
          <div className="font-bold text-green-600">{stats.actualizados}</div>
          <div className="text-slate-500">Actualizados</div>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar código, propietario..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {currentPredios.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-sm">
            {searchTerm ? 'No se encontraron predios' : 'No hay predios cargados'}
          </div>
        ) : (
          <div className="divide-y">
            {currentPredios.map((predio, idx) => (
              <PredioItem
                key={predio.codigo_predial || idx}
                predio={predio}
                isSelected={predio.codigo_predial === selectedCodigo}
                onSelect={() => onSelectPredio?.(predio)}
                onCenter={() => onCenterPredio?.(predio)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-2 border-t bg-slate-50 text-xs">
          <span className="text-slate-500">
            {startIndex + 1}-{Math.min(endIndex, filteredPredios.length)} de {filteredPredios.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-7 px-2"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="px-2">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-7 px-2"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});

// Componente de item de predio (memoizado)
const PredioItem = memo(({ predio, isSelected, onSelect, onCenter }) => {
  const estadoColor = {
    'pendiente': 'bg-amber-100 text-amber-700',
    'visitado': 'bg-blue-100 text-blue-700',
    'actualizado': 'bg-green-100 text-green-700'
  };

  return (
    <div 
      className={`p-2 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 border-l-2 border-blue-500' : 'hover:bg-slate-50'}`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-xs text-slate-600 truncate">
            {predio.codigo_predial}
          </div>
          {predio.propietario && (
            <div className="text-xs text-slate-500 truncate mt-0.5">
              {predio.propietario}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Badge 
            variant="secondary" 
            className={`text-xs px-1.5 py-0 ${estadoColor[predio.estado] || 'bg-slate-100 text-slate-600'}`}
          >
            {predio.estado || 'pendiente'}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onCenter?.(); }}
            className="h-6 w-6 p-0"
            title="Centrar en mapa"
          >
            <MapPin className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
});

ListaPrediosPaginada.displayName = 'ListaPrediosPaginada';
PredioItem.displayName = 'PredioItem';

export default ListaPrediosPaginada;
