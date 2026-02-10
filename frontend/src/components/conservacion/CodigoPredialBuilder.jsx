import React, { memo } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { FileText, Search, Loader2 } from 'lucide-react';

/**
 * Componente para construir y visualizar el Código Predial Nacional de 30 dígitos
 * 
 * @param {Object} estructuraCodigo - Estructura del código (prefijo_fijo, etc.)
 * @param {Object} codigoManual - Estado del código manual
 * @param {Function} handleCodigoChange - Función para manejar cambios en el código
 * @param {Function} setCodigoManual - Setter del estado
 * @param {Function} construirCodigoCompleto - Función para construir el código completo
 * @param {Function} verificarCodigoCompleto - Función para verificar el código
 * @param {boolean} canEditCodigoPredial - Si puede editar el código (permisos)
 * @param {boolean} editingPredioNuevoId - Si está editando un predio existente
 * @param {Object} ultimaManzanaInfo - Info de la última manzana
 * @param {boolean} buscandoPrediosManzana - Si está buscando predios
 * @param {Array} prediosEnManzana - Lista de predios en la manzana
 * @param {string} siguienteTerrenoSugerido - Siguiente terreno sugerido
 */
const CodigoPredialBuilder = memo(({
  estructuraCodigo,
  codigoManual,
  handleCodigoChange,
  setCodigoManual,
  construirCodigoCompleto,
  verificarCodigoCompleto,
  canEditCodigoPredial = true,
  editingPredioNuevoId = null,
  ultimaManzanaInfo = null,
  buscandoPrediosManzana = false,
  prediosEnManzana = [],
  siguienteTerrenoSugerido = ''
}) => {
  if (!estructuraCodigo) return null;

  const isDisabled = editingPredioNuevoId && !canEditCodigoPredial;

  return (
    <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg" data-testid="codigo-predial-builder">
      <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
        <FileText className="w-4 h-4" />
        Código Predial Nacional (30 dígitos)
        {editingPredioNuevoId && !canEditCodigoPredial && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full ml-2">
            🔒 Solo lectura - Solo coordinadores pueden modificar
          </span>
        )}
      </h4>
      
      {/* Visualización del código completo */}
      <div className="bg-white p-3 rounded border mb-4 font-mono text-lg tracking-wider text-center">
        <span className="text-blue-600 font-bold" title="Departamento + Municipio">{estructuraCodigo.prefijo_fijo}</span>
        <span className="text-emerald-600" title="Zona">{codigoManual.zona}</span>
        <span className="text-amber-600" title="Sector">{codigoManual.sector}</span>
        <span className="text-purple-600" title="Comuna">{codigoManual.comuna}</span>
        <span className="text-pink-600" title="Barrio">{codigoManual.barrio}</span>
        <span className="text-cyan-600" title="Manzana/Vereda">{codigoManual.manzana_vereda}</span>
        <span className="text-red-600 font-bold" title="Terreno">{codigoManual.terreno}</span>
        <span className="text-orange-600" title="Condición">{codigoManual.condicion}</span>
        <span className="text-slate-500" title="Edificio">{codigoManual.edificio}</span>
        <span className="text-slate-500" title="Piso">{codigoManual.piso}</span>
        <span className="text-slate-500" title="Unidad">{codigoManual.unidad}</span>
        <span className="text-xs text-slate-500 ml-2">({construirCodigoCompleto().length}/30)</span>
      </div>

      {/* Campos editables - Fila 1: Ubicación geográfica */}
      <div className="grid grid-cols-6 gap-2 mb-3">
        <div className="bg-blue-100 p-2 rounded">
          <Label className="text-xs text-blue-700">Dpto+Mpio (1-5)</Label>
          <Input 
            value={estructuraCodigo.prefijo_fijo} 
            disabled 
            className="font-mono bg-blue-50 text-blue-800 font-bold text-center" 
          />
        </div>
        <div>
          <Label className="text-xs text-emerald-700">Zona (6-7)</Label>
          <Input 
            value={codigoManual.zona} 
            onChange={(e) => handleCodigoChange('zona', e.target.value, 2)}
            maxLength={2}
            className="font-mono text-center"
            placeholder="00"
            disabled={isDisabled}
            data-testid="codigo-zona"
          />
          <span className="text-xs text-slate-400">00=Rural, 01=Urbano, 02-99=Correg.</span>
        </div>
        <div>
          <Label className="text-xs text-amber-700">Sector (8-9)</Label>
          <Input 
            value={codigoManual.sector} 
            onChange={(e) => handleCodigoChange('sector', e.target.value, 2)}
            maxLength={2}
            className="font-mono text-center"
            placeholder="00"
            disabled={isDisabled}
            data-testid="codigo-sector"
          />
          {ultimaManzanaInfo && ultimaManzanaInfo.ultima_manzana && (
            <div className="mt-1 p-1.5 bg-amber-50 border border-amber-200 rounded text-xs">
              <span className="text-amber-700">
                Última manzana: <strong>{ultimaManzanaInfo.ultima_manzana}</strong>
              </span>
            </div>
          )}
          {ultimaManzanaInfo && !ultimaManzanaInfo.ultima_manzana && (
            <span className="text-xs text-slate-400 block mt-1">Sin manzanas registradas</span>
          )}
        </div>
        <div>
          <Label className="text-xs text-purple-700">Comuna (10-11)</Label>
          <Input 
            value={codigoManual.comuna} 
            onChange={(e) => handleCodigoChange('comuna', e.target.value, 2)}
            maxLength={2}
            className="font-mono text-center"
            placeholder="00"
            disabled={isDisabled}
            data-testid="codigo-comuna"
          />
        </div>
        <div>
          <Label className="text-xs text-pink-700">Barrio (12-13)</Label>
          <Input 
            value={codigoManual.barrio} 
            onChange={(e) => handleCodigoChange('barrio', e.target.value, 2)}
            maxLength={2}
            className="font-mono text-center"
            placeholder="00"
            disabled={isDisabled}
            data-testid="codigo-barrio"
          />
        </div>
        <div>
          <Label className="text-xs text-cyan-700">Manzana (14-17)</Label>
          <Input 
            value={codigoManual.manzana_vereda} 
            onChange={(e) => handleCodigoChange('manzana_vereda', e.target.value, 4)}
            maxLength={4}
            className="font-mono text-center"
            placeholder="0000"
            disabled={isDisabled}
            data-testid="codigo-manzana"
          />
        </div>
      </div>

      {/* Mostrar últimos predios existentes en la manzana */}
      {codigoManual.manzana_vereda !== '0000' && (
        <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-cyan-700 flex items-center gap-1">
              <FileText className="w-3 h-3" />
              Terrenos existentes en manzana {codigoManual.manzana_vereda}
            </p>
            {buscandoPrediosManzana && <Loader2 className="w-3 h-3 animate-spin text-cyan-600" />}
          </div>
          {prediosEnManzana.length > 0 ? (
            <div className="space-y-1">
              {prediosEnManzana.map((p, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center gap-2 text-xs bg-white rounded px-2 py-1.5 border border-cyan-100"
                >
                  <span className="font-mono font-bold text-cyan-700 w-10">{p.terreno}</span>
                  <span className="text-slate-700 truncate flex-1">{p.direccion}</span>
                  {p.area_terreno && (
                    <span className="text-slate-500 text-[10px] w-16 text-right">{Number(p.area_terreno).toLocaleString()}m²</span>
                  )}
                  <span className="text-cyan-600 text-[10px] bg-cyan-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                    {p.registros} {p.registros === 1 ? 'reg' : 'regs'}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-cyan-200">
                <p className="text-[10px] text-cyan-600">
                  Mostrando últimos {prediosEnManzana.length} terrenos únicos (Base R1/R2)
                </p>
                <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                  💡 Siguiente: <span className="font-mono font-bold">{siguienteTerrenoSugerido}</span>
                </p>
              </div>
            </div>
          ) : !buscandoPrediosManzana ? (
            <p className="text-xs text-cyan-600">No hay predios registrados en esta manzana</p>
          ) : null}
        </div>
      )}

      {/* Campos editables - Fila 2: Predio y PH */}
      <div className="grid grid-cols-5 gap-2">
        <div className="bg-red-50 p-2 rounded border border-red-200">
          <Label className="text-xs text-red-700 font-semibold">Terreno (18-21) *</Label>
          <Input 
            value={codigoManual.terreno} 
            onChange={(e) => handleCodigoChange('terreno', e.target.value, 4)}
            maxLength={4}
            className="font-mono font-bold text-red-700 text-center"
            placeholder="0001"
            disabled={isDisabled}
            data-testid="codigo-terreno"
          />
        </div>
        <div>
          <Label className="text-xs text-orange-700">Condición (22)</Label>
          <Select 
            value={codigoManual.condicion} 
            onValueChange={(v) => setCodigoManual(prev => ({...prev, condicion: v}))}
            disabled={isDisabled}
          >
            <SelectTrigger className="font-mono" data-testid="codigo-condicion">
              <SelectValue placeholder="0" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">0 - NPH (No Prop. Horizontal)</SelectItem>
              <SelectItem value="2">2 - Informales</SelectItem>
              <SelectItem value="3">3 - Bienes uso público (no vías)</SelectItem>
              <SelectItem value="4">4 - Vías</SelectItem>
              <SelectItem value="7">7 - Parques o cementerios</SelectItem>
              <SelectItem value="8">8 - Condominio</SelectItem>
              <SelectItem value="9">9 - PH (Propiedad Horizontal)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-slate-600">Edificio (23-24)</Label>
          <Input 
            value={codigoManual.edificio} 
            onChange={(e) => handleCodigoChange('edificio', e.target.value, 2)}
            maxLength={2}
            className="font-mono text-center"
            placeholder="00"
            disabled={isDisabled}
            data-testid="codigo-edificio"
          />
        </div>
        <div>
          <Label className="text-xs text-slate-600">Piso (25-26)</Label>
          <Input 
            value={codigoManual.piso} 
            onChange={(e) => handleCodigoChange('piso', e.target.value, 2)}
            maxLength={2}
            className="font-mono text-center"
            placeholder="00"
            disabled={isDisabled}
            data-testid="codigo-piso"
          />
        </div>
        <div>
          <Label className="text-xs text-slate-600">Unidad (27-30)</Label>
          <Input 
            value={codigoManual.unidad} 
            onChange={(e) => handleCodigoChange('unidad', e.target.value, 4)}
            maxLength={4}
            className="font-mono text-center"
            placeholder="0000"
            disabled={isDisabled}
            data-testid="codigo-unidad"
          />
        </div>
      </div>

      {/* Botón de verificar */}
      <div className="mt-4 flex gap-3">
        <Button 
          onClick={verificarCodigoCompleto} 
          variant="outline" 
          className="flex-1"
          data-testid="verificar-codigo-btn"
        >
          <Search className="w-4 h-4 mr-2" />
          Verificar Código
        </Button>
      </div>
    </div>
  );
});

CodigoPredialBuilder.displayName = 'CodigoPredialBuilder';

export default CodigoPredialBuilder;
