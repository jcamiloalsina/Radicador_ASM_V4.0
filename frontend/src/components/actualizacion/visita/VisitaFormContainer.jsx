/**
 * Contenedor Principal del Formulario de Visita
 * Orquesta la navegación entre páginas y coordina el estado
 */
import React, { memo, lazy, Suspense, useCallback } from 'react';
import { FileText, ChevronLeft, ChevronRight, Save, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';

// Lazy loading de las páginas para optimizar carga inicial
const VisitaPagina1 = lazy(() => import('./VisitaPagina1'));
const VisitaPagina2 = lazy(() => import('./VisitaPagina2'));
const VisitaPagina3 = lazy(() => import('./VisitaPagina3'));
const VisitaPagina4 = lazy(() => import('./VisitaPagina4'));
const VisitaPagina5 = lazy(() => import('./VisitaPagina5'));

// Componente de carga
const PageLoader = () => (
  <div className="flex items-center justify-center py-12">
    <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
    <span className="ml-2 text-slate-600">Cargando...</span>
  </div>
);

const VisitaFormContainer = memo(({
  // Modal control
  open,
  onOpenChange,
  // Estado de página
  visitaPagina,
  setVisitaPagina,
  // Datos principales
  visitaData,
  setVisitaData,
  visitaConstrucciones,
  setVisitaConstrucciones,
  visitaCalificaciones,
  setVisitaCalificaciones,
  visitaPropietarios,
  // Funciones de propietarios
  agregarPropietario,
  eliminarPropietario,
  actualizarPropietario,
  // Funciones de construcciones
  agregarConstruccion,
  eliminarConstruccion,
  // Funciones de calificaciones
  agregarCalificacion,
  eliminarCalificacion,
  // Fotos
  fotos,
  setFotos,
  handleFotoCroquisChange,
  eliminarFotoCroquis,
  handleFotoChange,
  // GPS
  userPosition,
  gpsAccuracy,
  watchingPosition,
  startWatchingPosition,
  // Firmas
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
  // Contexto
  selectedPredio,
  proyecto,
  tipoVisita,
  mejoraSeleccionada,
  predioMejoraSeleccionada,
  // Guardar
  handleGuardarVisita,
  saving
}) => {
  // Handler para cambio de modal con confirmación
  const handleOpenChange = useCallback((newOpen) => {
    if (!newOpen && visitaData.persona_atiende) {
      const confirmar = window.confirm('¿Está seguro de cerrar? Los datos no guardados se perderán pero el borrador se conservará automáticamente.');
      if (!confirmar) return;
    }
    onOpenChange(newOpen);
  }, [visitaData.persona_atiende, onOpenChange]);

  // Navegación
  const irPaginaAnterior = useCallback(() => {
    setVisitaPagina(p => Math.max(1, p - 1));
  }, [setVisitaPagina]);

  const irPaginaSiguiente = useCallback(() => {
    setVisitaPagina(p => Math.min(5, p + 1));
  }, [setVisitaPagina]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              Formato de Visita - Actualización Catastral
            </div>
            <div className="flex items-center gap-2 text-sm font-normal">
              <span className="text-slate-500">Página</span>
              <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold">{visitaPagina}/5</span>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        {selectedPredio && (
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            <Suspense fallback={<PageLoader />}>
              {visitaPagina === 1 && (
                <VisitaPagina1
                  visitaData={visitaData}
                  setVisitaData={setVisitaData}
                  selectedPredio={selectedPredio}
                  proyecto={proyecto}
                  tipoVisita={tipoVisita}
                  mejoraSeleccionada={mejoraSeleccionada}
                  predioMejoraSeleccionada={predioMejoraSeleccionada}
                />
              )}
              
              {visitaPagina === 2 && (
                <VisitaPagina2
                  visitaData={visitaData}
                  setVisitaData={setVisitaData}
                  visitaPropietarios={visitaPropietarios}
                  agregarPropietario={agregarPropietario}
                  eliminarPropietario={eliminarPropietario}
                  actualizarPropietario={actualizarPropietario}
                />
              )}
              
              {visitaPagina === 3 && (
                <VisitaPagina3
                  visitaConstrucciones={visitaConstrucciones}
                  setVisitaConstrucciones={setVisitaConstrucciones}
                  agregarConstruccion={agregarConstruccion}
                  eliminarConstruccion={eliminarConstruccion}
                  visitaCalificaciones={visitaCalificaciones}
                  setVisitaCalificaciones={setVisitaCalificaciones}
                  agregarCalificacion={agregarCalificacion}
                  eliminarCalificacion={eliminarCalificacion}
                />
              )}
              
              {visitaPagina === 4 && (
                <VisitaPagina4
                  visitaData={visitaData}
                  setVisitaData={setVisitaData}
                  handleFotoCroquisChange={handleFotoCroquisChange}
                  eliminarFotoCroquis={eliminarFotoCroquis}
                />
              )}
              
              {visitaPagina === 5 && (
                <VisitaPagina5
                  visitaData={visitaData}
                  setVisitaData={setVisitaData}
                  fotos={fotos}
                  setFotos={setFotos}
                  userPosition={userPosition}
                  gpsAccuracy={gpsAccuracy}
                  watchingPosition={watchingPosition}
                  startWatchingPosition={startWatchingPosition}
                  canvasVisitadoRef={canvasVisitadoRef}
                  canvasReconocedorRef={canvasReconocedorRef}
                  startDrawingVisitado={startDrawingVisitado}
                  drawVisitado={drawVisitado}
                  stopDrawingVisitado={stopDrawingVisitado}
                  startDrawingReconocedor={startDrawingReconocedor}
                  drawReconocedor={drawReconocedor}
                  stopDrawingReconocedor={stopDrawingReconocedor}
                  limpiarFirmaVisitado={limpiarFirmaVisitado}
                  limpiarFirmaReconocedor={limpiarFirmaReconocedor}
                  abrirModalFirma={abrirModalFirma}
                  handleFotoChange={handleFotoChange}
                />
              )}
            </Suspense>
          </div>
        )}
        
        {/* Navegación de páginas */}
        <DialogFooter className="flex justify-between items-center pt-4 border-t">
          <div className="flex gap-2">
            {[1,2,3,4,5].map(p => (
              <button 
                key={p} 
                onClick={() => setVisitaPagina(p)} 
                className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${visitaPagina === p ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {visitaPagina > 1 && (
              <Button variant="outline" onClick={irPaginaAnterior}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
              </Button>
            )}
            {visitaPagina < 5 ? (
              <Button onClick={irPaginaSiguiente} className="bg-emerald-600 hover:bg-emerald-700">
                Siguiente <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button 
                onClick={handleGuardarVisita} 
                disabled={saving || !visitaData.persona_atiende.trim()} 
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Guardar Visita
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

VisitaFormContainer.displayName = 'VisitaFormContainer';

export default VisitaFormContainer;
