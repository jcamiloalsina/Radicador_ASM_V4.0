import React, { useState, useEffect, useCallback, memo } from 'react';
import { Input } from './ui/input';

/**
 * Input optimizado con debounce para evitar re-renders excesivos
 * Mantiene un estado local y solo actualiza el padre después del debounce
 */
const DebouncedInput = memo(({ 
  value: externalValue, 
  onChange, 
  debounceMs = 150,
  uppercase = false,
  ...props 
}) => {
  const [internalValue, setInternalValue] = useState(externalValue || '');
  
  // Sincronizar con valor externo cuando cambia
  useEffect(() => {
    setInternalValue(externalValue || '');
  }, [externalValue]);
  
  // Debounced update
  useEffect(() => {
    const timer = setTimeout(() => {
      if (internalValue !== externalValue) {
        onChange?.(internalValue);
      }
    }, debounceMs);
    
    return () => clearTimeout(timer);
  }, [internalValue, debounceMs]); // No incluir externalValue ni onChange para evitar loops
  
  const handleChange = useCallback((e) => {
    const val = uppercase ? e.target.value.toUpperCase() : e.target.value;
    setInternalValue(val);
  }, [uppercase]);
  
  return (
    <Input
      {...props}
      value={internalValue}
      onChange={handleChange}
    />
  );
});

DebouncedInput.displayName = 'DebouncedInput';

export default DebouncedInput;
