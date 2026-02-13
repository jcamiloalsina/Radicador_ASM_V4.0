/**
 * Página 5 del Formulario de Visita
 * Secciones: Coordenadas GPS, Observaciones, Firmas, Datos de la Visita
 */
import React, { memo, useCallback, useRef } from 'react';
import { 
  MapPin, FileText, Pen, User, Camera, Image as ImageIcon, 
  RefreshCcw, CheckCircle, Trash2, X 
} from 'lucide-react';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';
import { toast } from 'sonner';

const VisitaPagina5 = memo(({ 
  visitaData, 
  setVisitaData,
  fotos,
  setFotos,
  userPosition,
  gpsAccuracy,
  watchingPosition,
  startWatchingPosition,
  // Firma handlers
  canvasVisitadoRef,
  canvasReconocedorRef,
  startDrawingVisitado,
  drawVisitado,
  stopDrawingVisitado,
  startDrawingReconocedor,
  drawReconocedor,
  stopDrawingReconocedor,
  limpiarFirmaVisitado,
  limpiarFirmaReconocedor,
  abrirModalFirma,
  handleFotoChange
}) => {
  const fileInputRef = useRef(null);

  const handleFieldChange = useCallback((field, value) => {
    setVisitaData(prev => ({ ...prev, [field]: value }));
  }, [setVisitaData]);

  // Handler para guardar coordenadas GPS
  const handleGuardarGPS = useCallback(() => {
    if (userPosition) {
      setVisitaData(prev => ({
        ...prev,
        coordenadas_gps: {
          latitud: userPosition[0].toFixed(6),
          longitud: userPosition[1].toFixed(6),
          precision: gpsAccuracy,
          fecha_captura: new Date().toISOString()
        }
      }));
      toast.success('Coordenadas guardadas en el formulario');
    }
  }, [userPosition, gpsAccuracy, setVisitaData]);

  // Handler para servicios públicos
  const handleServicioChange = useCallback((servicio, checked) => {
    setVisitaData(prev => ({
      ...prev,
      servicios_publicos: checked 
        ? [...prev.servicios_publicos, servicio]
        : prev.servicios_publicos.filter(x => x !== servicio)
    }));
  }, [setVisitaData]);

  return (
    <>
      {/* Sección 11: Coordenadas GPS del Predio */}
      <div className="border border-blue-200 rounded-lg overflow-hidden">
        <div className="bg-blue-50 px-4 py-2 border-b border-blue-200">
          <h3 className="font-semibold text-blue-800 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            11. COORDENADAS GPS DEL PREDIO
          </h3>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-sm text-slate-600">
            Capture las coordenadas de ubicación del predio utilizando el GPS del dispositivo.
          </p>
          
          {/* Botón para capturar GPS */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              type="button" 
              onClick={startWatchingPosition}
              disabled={watchingPosition}
              className="bg-blue-600 hover:bg-blue-700 flex-1"
            >
              {watchingPosition ? (
                <>
                  <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                  Obteniendo ubicación...
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4 mr-2" />
                  📍 Capturar Mi Ubicación GPS
                </>
              )}
            </Button>
            
            {userPosition && (
              <Button 
                type="button" 
                variant="outline"
                onClick={handleGuardarGPS}
                className="text-green-600 border-green-300 hover:bg-green-50"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Usar esta ubicación
              </Button>
            )}
          </div>
          
          {/* Indicador de GPS activo */}
          {userPosition && gpsAccuracy && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <span className="text-green-700 text-sm font-medium">
                  Ubicación capturada con precisión de {Math.round(gpsAccuracy)} metros
                </span>
                <p className="text-green-600 text-xs">
                  Lat: {userPosition[0].toFixed(6)}, Lng: {userPosition[1].toFixed(6)}
                </p>
              </div>
            </div>
          )}
          
          {/* Campos de coordenadas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium text-slate-600">Latitud (Y)</Label>
              <Input
                type="text"
                placeholder="Ej: 7.123456"
                value={visitaData.coordenadas_gps?.latitud || ''}
                onChange={(e) => setVisitaData(prev => ({
                  ...prev,
                  coordenadas_gps: { ...prev.coordenadas_gps, latitud: e.target.value }
                }))}
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-600">Longitud (X)</Label>
              <Input
                type="text"
                placeholder="Ej: -72.654321"
                value={visitaData.coordenadas_gps?.longitud || ''}
                onChange={(e) => setVisitaData(prev => ({
                  ...prev,
                  coordenadas_gps: { ...prev.coordenadas_gps, longitud: e.target.value }
                }))}
              />
            </div>
          </div>
          
          {visitaData.coordenadas_gps?.fecha_captura && (
            <p className="text-xs text-slate-500">
              Coordenadas capturadas el: {new Date(visitaData.coordenadas_gps.fecha_captura).toLocaleString('es-CO')}
            </p>
          )}
        </div>
      </div>

      {/* Sección 12: Observaciones */}
      <div className="border border-amber-200 rounded-lg overflow-hidden">
        <div className="bg-amber-50 px-4 py-2 border-b border-amber-200">
          <h3 className="font-semibold text-amber-800 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            12. OBSERVACIONES
          </h3>
        </div>
        <div className="p-4">
          <Textarea
            value={visitaData.observaciones_generales}
            onChange={(e) => {
              if (e.target.value.length <= 500) {
                handleFieldChange('observaciones_generales', e.target.value);
              }
            }}
            rows={6}
            placeholder="Ingrese las observaciones generales de la visita..."
            className="resize-none"
          />
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-slate-500">Máximo 500 caracteres</p>
            <span className={`text-xs ${visitaData.observaciones_generales.length > 450 ? 'text-amber-600 font-medium' : 'text-slate-400'}`}>
              {visitaData.observaciones_generales.length}/500
            </span>
          </div>
        </div>
      </div>

      {/* Sección 13: Firmas */}
      <div className="border border-purple-200 rounded-lg overflow-hidden">
        <div className="bg-purple-50 px-4 py-2 border-b border-purple-200">
          <h3 className="font-semibold text-purple-800 flex items-center gap-2">
            <Pen className="w-4 h-4" />
            13. FIRMAS
          </h3>
        </div>
        <div className="p-4 space-y-6">
          {/* Firma del Visitado */}
          <div>
            <Label className="text-sm font-medium text-slate-700 mb-2 block">Firma del Visitado (Propietario/Atendiente)</Label>
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Nombre</Label>
              <Input value={visitaData.nombre_visitado} onChange={(e) => handleFieldChange('nombre_visitado', e.target.value.toUpperCase())} placeholder="NOMBRE COMPLETO DEL VISITADO" className="uppercase mb-2" />
            </div>
            <div className="flex gap-2 items-center">
              <div className="flex-1 border-2 border-slate-300 rounded-lg bg-white h-20 overflow-hidden touch-none">
                <canvas 
                  ref={canvasVisitadoRef} 
                  width={500} 
                  height={80} 
                  className="w-full h-full cursor-crosshair touch-none" 
                  style={{ backgroundColor: '#ffffff' }}
                  onMouseDown={startDrawingVisitado}
                  onMouseMove={drawVisitado}
                  onMouseUp={stopDrawingVisitado}
                  onMouseLeave={stopDrawingVisitado}
                  onTouchStart={startDrawingVisitado}
                  onTouchMove={drawVisitado}
                  onTouchEnd={stopDrawingVisitado}
                />
              </div>
              <Button type="button" variant="outline" onClick={() => abrirModalFirma('visitado')} className="border-purple-500 text-purple-700 hover:bg-purple-50">
                <Pen className="w-4 h-4 mr-1" /> Firmar
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={limpiarFirmaVisitado} className="text-slate-500">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Firma del Reconocedor */}
          <div>
            <Label className="text-sm font-medium text-slate-700 mb-2 block">Firma del Reconocedor Predial</Label>
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Nombre</Label>
              <Input value={visitaData.nombre_reconocedor} onChange={(e) => handleFieldChange('nombre_reconocedor', e.target.value.toUpperCase())} placeholder="NOMBRE DEL RECONOCEDOR" className="uppercase mb-2" />
            </div>
            <div className="flex gap-2 items-center">
              <div className="flex-1 border-2 border-slate-300 rounded-lg bg-white h-20 overflow-hidden touch-none">
                <canvas 
                  ref={canvasReconocedorRef} 
                  width={500} 
                  height={80} 
                  className="w-full h-full cursor-crosshair touch-none" 
                  style={{ backgroundColor: '#ffffff' }}
                  onMouseDown={startDrawingReconocedor}
                  onMouseMove={drawReconocedor}
                  onMouseUp={stopDrawingReconocedor}
                  onMouseLeave={stopDrawingReconocedor}
                  onTouchStart={startDrawingReconocedor}
                  onTouchMove={drawReconocedor}
                  onTouchEnd={stopDrawingReconocedor}
                />
              </div>
              <Button type="button" variant="outline" onClick={() => abrirModalFirma('reconocedor')} className="border-purple-500 text-purple-700 hover:bg-purple-50">
                <Pen className="w-4 h-4 mr-1" /> Firmar
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={limpiarFirmaReconocedor} className="text-slate-500">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Datos de la Visita */}
      <div className="border border-blue-200 rounded-lg overflow-hidden">
        <div className="bg-blue-50 px-4 py-2 border-b border-blue-200">
          <h3 className="font-semibold text-blue-800 flex items-center gap-2">
            <User className="w-4 h-4" />
            DATOS DE LA VISITA
          </h3>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-slate-500">Fecha de Visita *</Label>
              <Input type="date" value={visitaData.fecha_visita} onChange={(e) => handleFieldChange('fecha_visita', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Hora *</Label>
              <Input type="time" value={visitaData.hora_visita} onChange={(e) => handleFieldChange('hora_visita', e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs text-slate-500">Persona que Atiende *</Label>
            <Input value={visitaData.persona_atiende} onChange={(e) => handleFieldChange('persona_atiende', e.target.value.toUpperCase())} placeholder="NOMBRE COMPLETO" className="uppercase" />
          </div>
          <div>
            <Label className="text-xs text-slate-500 mb-2 block">Relación con el Predio</Label>
            <div className="grid grid-cols-3 gap-2">
              {[{v:'propietario',l:'Propietario'},{v:'poseedor',l:'Poseedor'},{v:'arrendatario',l:'Arrendatario'},{v:'familiar',l:'Familiar'},{v:'encargado',l:'Encargado'},{v:'otro',l:'Otro'}].map(i => (
                <label key={i.v} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="relacion" checked={visitaData.relacion_predio === i.v} onChange={() => handleFieldChange('relacion_predio', i.v)} className="text-blue-600" />
                  <span className="text-sm">{i.l}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-slate-500 mb-2 block">¿Se pudo acceder al predio?</Label>
            <div className="flex gap-4">
              {[{v:'si',l:'Sí, acceso total'},{v:'parcial',l:'Acceso parcial'},{v:'no',l:'No se pudo'}].map(i => (
                <label key={i.v} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="acceso" checked={visitaData.acceso_predio === i.v} onChange={() => handleFieldChange('acceso_predio', i.v)} className="text-blue-600" />
                  <span className="text-sm">{i.l}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-slate-500 mb-2 block">Estado del Predio</Label>
            <div className="grid grid-cols-4 gap-2">
              {[{v:'habitado',l:'Habitado'},{v:'deshabitado',l:'Deshabitado'},{v:'en_construccion',l:'En construcción'},{v:'abandonado',l:'Abandonado'},{v:'lote_vacio',l:'Lote vacío'},{v:'uso_comercial',l:'Comercial'},{v:'uso_mixto',l:'Mixto'}].map(i => (
                <label key={i.v} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="estado" checked={visitaData.estado_predio === i.v} onChange={() => handleFieldChange('estado_predio', i.v)} className="text-blue-600" />
                  <span className="text-sm">{i.l}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-slate-500 mb-2 block">Servicios Públicos</Label>
            <div className="grid grid-cols-3 gap-2">
              {['Agua','Alcantarillado','Energía','Gas','Internet','Teléfono'].map(s => (
                <label key={s} className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={visitaData.servicios_publicos.includes(s)} 
                    onChange={(e) => handleServicioChange(s, e.target.checked)} 
                    className="rounded" 
                  />
                  <span className="text-sm">{s}</span>
                </label>
              ))}
            </div>
          </div>
          
          {/* Resultado */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={visitaData.sin_cambios} onChange={(e) => handleFieldChange('sin_cambios', e.target.checked)} className="rounded mt-1" />
              <div>
                <span className="font-medium text-blue-800">Visitado sin cambios</span>
                <p className="text-xs text-blue-600 mt-1">Marque si el predio no requiere modificación en los datos catastrales.</p>
              </div>
            </label>
          </div>
          
          {/* Fotografías adicionales */}
          <div>
            <Label className="text-xs text-slate-500 flex items-center gap-2 mb-2"><Camera className="w-4 h-4" />Fotografías Adicionales</Label>
            
            <input 
              ref={fileInputRef} 
              type="file" 
              accept="image/*" 
              capture="environment"
              onChange={handleFotoChange} 
              className="hidden" 
              id="camera-input"
            />
            
            <input 
              type="file" 
              accept="image/*" 
              multiple 
              onChange={handleFotoChange} 
              className="hidden" 
              id="gallery-input"
            />
            
            <div className="grid grid-cols-4 gap-2 mb-2">
              {fotos.map((f, i) => (
                <div key={i} className="relative aspect-square rounded overflow-hidden border">
                  <img src={f.preview || f.data || f} alt={`Foto ${i+1}`} className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setFotos(prev => prev.filter((_, j) => j !== i))} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => document.getElementById('camera-input')?.click()} 
                className="border-dashed border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              >
                <Camera className="w-4 h-4 mr-2" />
                Tomar Foto
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => document.getElementById('gallery-input')?.click()} 
                className="border-dashed"
              >
                <ImageIcon className="w-4 h-4 mr-2" />
                Galería
              </Button>
            </div>
          </div>
          
          {userPosition && (
            <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 p-2 rounded">
              <MapPin className="w-3 h-3" />GPS: {userPosition[0].toFixed(6)}, {userPosition[1].toFixed(6)} {gpsAccuracy && `(±${Math.round(gpsAccuracy)}m)`}
            </div>
          )}
        </div>
      </div>
    </>
  );
});

VisitaPagina5.displayName = 'VisitaPagina5';

export default VisitaPagina5;
