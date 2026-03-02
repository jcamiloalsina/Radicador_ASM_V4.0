import React, { useState, useRef, useEffect } from 'react';
import { Move, Maximize2, RotateCcw, Save, GripVertical } from 'lucide-react';
import { Button } from '../components/ui/button';

/**
 * Editor Visual de Plantilla de Resolución
 * Permite arrastrar y redimensionar elementos visualmente
 */
const EditorVisualResolucion = ({ configVisual, setConfigVisual, onGuardar }) => {
  const canvasRef = useRef(null);
  const [dragging, setDragging] = useState(null); // 'encabezado', 'firma', 'pie', 'margen-izq', etc.
  const [resizing, setResizing] = useState(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [startConfig, setStartConfig] = useState({});
  
  // Escala para el canvas (el documento real es 612x792 puntos = carta)
  const escala = 0.55;
  const docWidth = 612 * escala;
  const docHeight = 792 * escala;
  
  // Convertir config a posiciones visuales
  const getVisualPositions = () => {
    return {
      margenSuperior: (configVisual.margen_superior || 50) * escala,
      margenInferior: (configVisual.margen_inferior || 80) * escala,
      margenIzquierdo: (configVisual.margen_izquierdo || 50) * escala,
      margenDerecho: (configVisual.margen_derecho || 50) * escala,
      encabezadoAltura: (configVisual.encabezado_altura || 60) * escala,
      firmaAncho: (configVisual.firma_ancho || 100) * escala,
      firmaAltura: (configVisual.firma_altura || 60) * escala,
      firmaOffsetY: (configVisual.firma_offset_y || 40) * escala,
      pieAltura: (configVisual.pie_altura || 50) * escala,
    };
  };
  
  const pos = getVisualPositions();
  
  // Calcular posición X de la firma según configuración
  const getFirmaX = () => {
    const contentWidth = docWidth - pos.margenIzquierdo - pos.margenDerecho;
    switch (configVisual.firma_posicion) {
      case 'izquierda':
        return pos.margenIzquierdo;
      case 'derecha':
        return docWidth - pos.margenDerecho - pos.firmaAncho;
      default: // centro
        return pos.margenIzquierdo + (contentWidth - pos.firmaAncho) / 2;
    }
  };
  
  // Manejar inicio de arrastre
  const handleMouseDown = (e, element, type = 'drag') => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = canvasRef.current.getBoundingClientRect();
    setStartPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setStartConfig({ ...configVisual });
    
    if (type === 'resize') {
      setResizing(element);
    } else {
      setDragging(element);
    }
  };
  
  // Manejar movimiento
  const handleMouseMove = (e) => {
    if (!dragging && !resizing) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    const deltaX = (currentX - startPos.x) / escala;
    const deltaY = (currentY - startPos.y) / escala;
    
    if (dragging === 'encabezado') {
      // Mover encabezado (ajustar margen superior)
      const newMargen = Math.max(10, Math.min(150, startConfig.margen_superior + deltaY));
      setConfigVisual(prev => ({ ...prev, margen_superior: Math.round(newMargen) }));
    }
    else if (dragging === 'firma') {
      // Mover firma horizontalmente para cambiar posición
      const contentWidth = docWidth / escala - startConfig.margen_izquierdo - startConfig.margen_derecho;
      const firmaCenter = startPos.x / escala + deltaX + startConfig.firma_ancho / 2 - startConfig.margen_izquierdo;
      const relativePos = firmaCenter / contentWidth;
      
      let newPosicion = 'centro';
      if (relativePos < 0.33) newPosicion = 'izquierda';
      else if (relativePos > 0.66) newPosicion = 'derecha';
      
      // También ajustar offset vertical
      const newOffsetY = Math.max(20, Math.min(100, startConfig.firma_offset_y - deltaY));
      
      setConfigVisual(prev => ({ 
        ...prev, 
        firma_posicion: newPosicion,
        firma_offset_y: Math.round(newOffsetY)
      }));
    }
    else if (dragging === 'pie') {
      // Mover pie de página (ajustar margen inferior)
      const newMargen = Math.max(30, Math.min(150, startConfig.margen_inferior - deltaY));
      setConfigVisual(prev => ({ ...prev, margen_inferior: Math.round(newMargen) }));
    }
    else if (dragging === 'margen-izq') {
      const newMargen = Math.max(20, Math.min(100, startConfig.margen_izquierdo + deltaX));
      setConfigVisual(prev => ({ ...prev, margen_izquierdo: Math.round(newMargen) }));
    }
    else if (dragging === 'margen-der') {
      const newMargen = Math.max(20, Math.min(100, startConfig.margen_derecho - deltaX));
      setConfigVisual(prev => ({ ...prev, margen_derecho: Math.round(newMargen) }));
    }
    else if (resizing === 'encabezado') {
      const newAltura = Math.max(30, Math.min(120, startConfig.encabezado_altura + deltaY));
      setConfigVisual(prev => ({ ...prev, encabezado_altura: Math.round(newAltura) }));
    }
    else if (resizing === 'firma') {
      const newAncho = Math.max(60, Math.min(200, startConfig.firma_ancho + deltaX));
      const newAltura = Math.max(30, Math.min(100, startConfig.firma_altura + deltaY));
      setConfigVisual(prev => ({ 
        ...prev, 
        firma_ancho: Math.round(newAncho),
        firma_altura: Math.round(newAltura)
      }));
    }
    else if (resizing === 'pie') {
      const newAltura = Math.max(30, Math.min(100, startConfig.pie_altura - deltaY));
      setConfigVisual(prev => ({ ...prev, pie_altura: Math.round(newAltura) }));
    }
  };
  
  // Manejar fin de arrastre
  const handleMouseUp = () => {
    setDragging(null);
    setResizing(null);
  };
  
  // Resetear a valores por defecto
  const resetToDefaults = () => {
    setConfigVisual({
      ...configVisual,
      margen_superior: 50,
      margen_inferior: 80,
      margen_izquierdo: 50,
      margen_derecho: 50,
      encabezado_altura: 60,
      firma_posicion: 'centro',
      firma_ancho: 100,
      firma_altura: 60,
      firma_offset_y: 40,
      pie_altura: 50,
    });
  };
  
  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [dragging, resizing, startPos, startConfig]);
  
  return (
    <div className="space-y-4">
      {/* Instrucciones */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
        <p><strong>Instrucciones:</strong> Arrastra los elementos para moverlos. Usa las esquinas para redimensionar.</p>
      </div>
      
      {/* Canvas del documento */}
      <div 
        ref={canvasRef}
        className="relative bg-white border-2 border-slate-300 rounded-lg shadow-lg mx-auto select-none"
        style={{ 
          width: docWidth, 
          height: docHeight,
          cursor: dragging || resizing ? 'grabbing' : 'default'
        }}
        onMouseMove={handleMouseMove}
      >
        {/* Área de márgenes visuales */}
        <div 
          className="absolute border-2 border-dashed border-slate-200 pointer-events-none"
          style={{
            left: pos.margenIzquierdo,
            top: pos.margenSuperior + pos.encabezadoAltura + 10,
            right: pos.margenDerecho,
            bottom: pos.margenInferior + pos.pieAltura + 10,
          }}
        />
        
        {/* Margen izquierdo - arrastrable */}
        <div
          className={`absolute top-0 bottom-0 w-2 cursor-ew-resize transition-colors ${
            dragging === 'margen-izq' ? 'bg-purple-400' : 'bg-purple-200 hover:bg-purple-300'
          }`}
          style={{ left: pos.margenIzquierdo - 4 }}
          onMouseDown={(e) => handleMouseDown(e, 'margen-izq')}
          title="Arrastrar para ajustar margen izquierdo"
        />
        
        {/* Margen derecho - arrastrable */}
        <div
          className={`absolute top-0 bottom-0 w-2 cursor-ew-resize transition-colors ${
            dragging === 'margen-der' ? 'bg-purple-400' : 'bg-purple-200 hover:bg-purple-300'
          }`}
          style={{ right: pos.margenDerecho - 4 }}
          onMouseDown={(e) => handleMouseDown(e, 'margen-der')}
          title="Arrastrar para ajustar margen derecho"
        />
        
        {/* ENCABEZADO */}
        {configVisual.encabezado_mostrar !== false && (
          <div
            className={`absolute left-0 right-0 mx-4 rounded border-2 transition-colors ${
              dragging === 'encabezado' ? 'border-emerald-500 bg-emerald-100' : 'border-emerald-300 bg-emerald-50 hover:border-emerald-400'
            }`}
            style={{
              top: pos.margenSuperior,
              height: pos.encabezadoAltura,
            }}
          >
            {/* Handle de arrastre */}
            <div 
              className="absolute inset-0 cursor-grab flex items-center justify-center"
              onMouseDown={(e) => handleMouseDown(e, 'encabezado')}
            >
              <div className="flex items-center gap-2 text-emerald-600 text-xs font-medium">
                <GripVertical className="w-4 h-4" />
                <span>ENCABEZADO</span>
                <Move className="w-3 h-3" />
              </div>
            </div>
            
            {/* Handle de redimensionar */}
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-2 bg-emerald-400 rounded cursor-ns-resize hover:bg-emerald-500"
              onMouseDown={(e) => handleMouseDown(e, 'encabezado', 'resize')}
              title="Arrastrar para cambiar altura"
            />
          </div>
        )}
        
        {/* Contenido simulado */}
        <div 
          className="absolute text-center"
          style={{
            top: pos.margenSuperior + pos.encabezadoAltura + 20,
            left: pos.margenIzquierdo,
            right: pos.margenDerecho,
          }}
        >
          <div className="text-[10px] font-bold text-slate-400">RESOLUCIÓN No: RES-XX-XXX-XXXX-2026</div>
          <div className="text-[8px] text-slate-300 mt-1">FECHA: DD-MM-AAAA</div>
          <div className="mt-3 space-y-1">
            <div className="h-1 bg-slate-100 rounded mx-auto" style={{ width: '80%' }}></div>
            <div className="h-1 bg-slate-100 rounded mx-auto" style={{ width: '70%' }}></div>
            <div className="h-1 bg-slate-100 rounded mx-auto" style={{ width: '75%' }}></div>
          </div>
          <div className="text-[8px] text-slate-400 font-bold mt-4">CONSIDERANDO</div>
          <div className="mt-2 space-y-1">
            <div className="h-1 bg-slate-100 rounded mx-auto" style={{ width: '90%' }}></div>
            <div className="h-1 bg-slate-100 rounded mx-auto" style={{ width: '85%' }}></div>
            <div className="h-1 bg-slate-100 rounded mx-auto" style={{ width: '88%' }}></div>
          </div>
          <div className="text-[8px] text-slate-400 font-bold mt-4">RESUELVE</div>
          <div className="mt-2 space-y-1">
            <div className="h-1 bg-slate-100 rounded mx-auto" style={{ width: '95%' }}></div>
            <div className="h-1 bg-slate-100 rounded mx-auto" style={{ width: '90%' }}></div>
          </div>
        </div>
        
        {/* FIRMA */}
        {configVisual.firma_mostrar !== false && (
          <div
            className={`absolute rounded border-2 transition-colors ${
              dragging === 'firma' ? 'border-blue-500 bg-blue-100' : 'border-blue-300 bg-blue-50 hover:border-blue-400'
            }`}
            style={{
              left: getFirmaX(),
              bottom: pos.margenInferior + pos.pieAltura + pos.firmaOffsetY,
              width: pos.firmaAncho,
              height: pos.firmaAltura,
            }}
          >
            {/* Handle de arrastre */}
            <div 
              className="absolute inset-0 cursor-grab flex flex-col items-center justify-center"
              onMouseDown={(e) => handleMouseDown(e, 'firma')}
            >
              <Move className="w-4 h-4 text-blue-500" />
              <span className="text-[8px] text-blue-600 font-medium mt-1">FIRMA</span>
              <span className="text-[6px] text-blue-400">
                {configVisual.firma_posicion === 'izquierda' ? '← Izq' : 
                 configVisual.firma_posicion === 'derecha' ? 'Der →' : '• Centro'}
              </span>
            </div>
            
            {/* Handle de redimensionar (esquina inferior derecha) */}
            <div
              className="absolute bottom-0 right-0 w-3 h-3 bg-blue-400 rounded-tl cursor-nwse-resize hover:bg-blue-500"
              onMouseDown={(e) => handleMouseDown(e, 'firma', 'resize')}
              title="Arrastrar para redimensionar"
            >
              <Maximize2 className="w-2 h-2 text-white m-0.5" />
            </div>
          </div>
        )}
        
        {/* PIE DE PÁGINA */}
        {configVisual.pie_mostrar !== false && (
          <div
            className={`absolute left-0 right-0 mx-4 rounded border-2 transition-colors ${
              dragging === 'pie' ? 'border-amber-500 bg-amber-100' : 'border-amber-300 bg-amber-50 hover:border-amber-400'
            }`}
            style={{
              bottom: pos.margenInferior,
              height: pos.pieAltura,
            }}
          >
            {/* Handle de arrastre */}
            <div 
              className="absolute inset-0 cursor-grab flex items-center justify-center"
              onMouseDown={(e) => handleMouseDown(e, 'pie')}
            >
              <div className="flex items-center gap-2 text-amber-600 text-xs font-medium">
                <GripVertical className="w-4 h-4" />
                <span>PIE DE PÁGINA</span>
                <Move className="w-3 h-3" />
              </div>
            </div>
            
            {/* Handle de redimensionar */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-2 bg-amber-400 rounded cursor-ns-resize hover:bg-amber-500"
              onMouseDown={(e) => handleMouseDown(e, 'pie', 'resize')}
              title="Arrastrar para cambiar altura"
            />
          </div>
        )}
        
        {/* Indicadores de medidas */}
        <div className="absolute -right-16 top-0 bottom-0 flex flex-col justify-between text-[8px] text-slate-400">
          <span>{configVisual.margen_superior}px</span>
          <span>{configVisual.margen_inferior}px</span>
        </div>
        <div className="absolute -bottom-5 left-0 right-0 flex justify-between text-[8px] text-slate-400 px-1">
          <span>{configVisual.margen_izquierdo}px</span>
          <span>{configVisual.margen_derecho}px</span>
        </div>
      </div>
      
      {/* Leyenda */}
      <div className="flex flex-wrap justify-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-emerald-200 border border-emerald-400 rounded"></div>
          <span className="text-slate-600">Encabezado</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-200 border border-blue-400 rounded"></div>
          <span className="text-slate-600">Firma ({configVisual.firma_posicion})</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-amber-200 border border-amber-400 rounded"></div>
          <span className="text-slate-600">Pie de página</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-purple-200 border border-purple-400 rounded"></div>
          <span className="text-slate-600">Márgenes</span>
        </div>
      </div>
      
      {/* Botones de acción */}
      <div className="flex justify-center gap-3 pt-2">
        <Button variant="outline" size="sm" onClick={resetToDefaults}>
          <RotateCcw className="w-4 h-4 mr-2" />
          Restaurar
        </Button>
        <Button className="bg-emerald-600 hover:bg-emerald-700" size="sm" onClick={onGuardar}>
          <Save className="w-4 h-4 mr-2" />
          Guardar Layout
        </Button>
      </div>
    </div>
  );
};

export default EditorVisualResolucion;
