import React, { memo } from 'react';
import { Button } from '../ui/button';

/**
 * Componente de paginación reutilizable
 * 
 * @param {number} currentPage - Página actual
 * @param {number} totalItems - Total de items
 * @param {number} pageSize - Items por página
 * @param {function} onPageChange - Callback cuando cambia la página
 * @param {string} itemLabel - Etiqueta para los items (ej: "predios", "registros")
 */
const Pagination = memo(({ 
  currentPage, 
  totalItems, 
  pageSize = 50,
  onPageChange,
  itemLabel = 'items'
}) => {
  const totalPages = Math.ceil(totalItems / pageSize);
  
  if (totalItems <= pageSize) return null;

  const startItem = ((currentPage - 1) * pageSize) + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div 
      className="flex items-center justify-between mt-4 px-4 py-3 bg-slate-50 rounded-lg"
      data-testid="pagination"
    >
      <div className="text-sm text-slate-600">
        Mostrando {startItem.toLocaleString()} - {endItem.toLocaleString()} de {totalItems.toLocaleString()} {itemLabel}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          data-testid="pagination-first"
        >
          Primera
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          data-testid="pagination-prev"
        >
          Anterior
        </Button>
        <span className="px-3 py-1 bg-white border rounded text-sm">
          Página {currentPage} de {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          data-testid="pagination-next"
        >
          Siguiente
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          data-testid="pagination-last"
        >
          Última
        </Button>
      </div>
    </div>
  );
});

Pagination.displayName = 'Pagination';

export default Pagination;
