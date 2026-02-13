import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import { Input } from './ui/input';

/**
 * Input optimizado con debounce para evitar re-renders excesivos
 * Mantiene un estado local y solo actualiza el padre después del debounce
 * 
 * OPTIMIZACIÓN MÓVIL:
 * - Debounce aumentado a 300ms para mejor rendimiento
 * - No sincroniza mientras el input tiene foco (evita saltos de cursor)
 * - Sincroniza al perder foco (blur)
 */
const DebouncedInput = memo(({ 
  value: externalValue, 
  onChange, 
  debounceMs = 300,
  uppercase = false,
  type = 'text',
  ...props 
}) => {
  const [internalValue, setInternalValue] = useState(externalValue || '');
  const inputRef = useRef(null);
  const timeoutRef = useRef(null);
  
  // Sincronizar con valor externo solo cuando el input NO tiene foco
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setInternalValue(externalValue || '');
    }
  }, [externalValue]);
  
  const handleChange = useCallback((e) => {
    const val = uppercase ? e.target.value.toUpperCase() : e.target.value;
    setInternalValue(val);
    
    // Limpiar timeout anterior
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    // Para inputs numéricos, actualizar inmediatamente
    if (type === 'number') {
      onChange?.(val);
    } else {
      // Para texto, usar debounce
      timeoutRef.current = setTimeout(() => {
        onChange?.(val);
      }, debounceMs);
    }
  }, [uppercase, onChange, debounceMs, type]);
  
  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);
  
  // Sincronizar al perder foco
  const handleBlur = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      onChange?.(internalValue);
    }
  }, [internalValue, onChange]);
  
  return (
    <Input
      ref={inputRef}
      type={type}
      {...props}
      value={internalValue}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
});

DebouncedInput.displayName = 'DebouncedInput';

export default DebouncedInput;
