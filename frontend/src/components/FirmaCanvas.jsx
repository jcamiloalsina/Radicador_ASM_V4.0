import React, { useRef, useState, useCallback, useEffect, memo } from 'react';
import { Button } from './ui/button';
import { Eraser } from 'lucide-react';

/**
 * Componente optimizado para captura de firma digital
 * - Usa throttling para eventos de dibujo
 * - Memoizado para evitar re-renders innecesarios
 * - Soporta touch y mouse
 */
const FirmaCanvas = memo(({ 
  width = 400, 
  height = 150, 
  onFirmaChange,
  disabled = false,
  className = ''
}) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPointRef = useRef(null);
  const rafRef = useRef(null);

  // Inicializar canvas con fondo blanco
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  // Obtener coordenadas normalizadas (funciona para touch y mouse)
  const getCoordinates = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }, []);

  // Iniciar trazo
  const handleStart = useCallback((e) => {
    if (disabled) return;
    e.preventDefault();
    
    const coords = getCoordinates(e);
    if (!coords) return;
    
    setIsDrawing(true);
    lastPointRef.current = coords;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  }, [disabled, getCoordinates]);

  // Dibujar trazo (con throttling via requestAnimationFrame)
  const handleMove = useCallback((e) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    
    // Cancelar frame anterior si existe
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    
    // Usar requestAnimationFrame para throttling
    rafRef.current = requestAnimationFrame(() => {
      const coords = getCoordinates(e);
      if (!coords || !lastPointRef.current) return;
      
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
      
      lastPointRef.current = coords;
    });
  }, [isDrawing, disabled, getCoordinates]);

  // Terminar trazo
  const handleEnd = useCallback(() => {
    if (!isDrawing) return;
    
    setIsDrawing(false);
    lastPointRef.current = null;
    
    // Notificar cambio
    if (onFirmaChange && canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      onFirmaChange(dataUrl);
    }
  }, [isDrawing, onFirmaChange]);

  // Limpiar firma
  const limpiarFirma = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      if (onFirmaChange) {
        onFirmaChange(null);
      }
    }
  }, [onFirmaChange]);

  // Obtener firma en base64
  const obtenerFirma = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      return canvas.toDataURL('image/png');
    }
    return null;
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={`border border-gray-300 rounded cursor-crosshair touch-none ${disabled ? 'opacity-50' : ''}`}
        style={{ width: '100%', height: 'auto', maxHeight: `${height}px` }}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={limpiarFirma}
        disabled={disabled}
        className="absolute top-1 right-1 h-7 px-2"
      >
        <Eraser className="w-3 h-3 mr-1" />
        Limpiar
      </Button>
    </div>
  );
});

FirmaCanvas.displayName = 'FirmaCanvas';

export default FirmaCanvas;
