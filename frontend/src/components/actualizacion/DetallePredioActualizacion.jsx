import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  MapPin, User, FileText, Building, DollarSign, Eye, EyeOff, 
  Loader2, ClipboardList, Edit, History, CheckCircle, Clock, AlertCircle, Trash2
} from 'lucide-react';

// Helper para formatear área
const formatArea = (area) => {
  if (!area && area !== 0) return 'N/A';
  const num = parseFloat(area);
  if (isNaN(num)) return 'N/A';
  return `${num.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
};

// Helper para formatear moneda
const formatCurrency = (value) => {
  if (!value && value !== 0) return 'N/A';
  const num = parseFloat(value);
  if (isNaN(num)) return 'N/A';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(num);
};

// Helper para obtener zona del código
const getZonaFromCodigo = (codigo) => {
  if (!codigo || codigo.length < 7) return { tipo: 'desconocido', texto: 'Desconocido' };
  const zonaCode = codigo.substring(5, 7);
  if (zonaCode === '00' || zonaCode === '01') return { tipo: 'urbano', texto: 'Urbano' };
  return { tipo: 'rural', texto: 'Rural' };
};

// Helper para obtener color del estado
const getEstadoColor = (estado) => {
  switch (estado) {
    case 'actualizado': return 'bg-green-100 text-green-800 border-green-300';
    case 'visitado': return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'pendiente': 
    default: return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  }
};

const getEstadoIcon = (estado) => {
  switch (estado) {
    case 'actualizado': return <CheckCircle className="w-4 h-4" />;
    case 'visitado': return <Clock className="w-4 h-4" />;
    case 'pendiente': 
    default: return <AlertCircle className="w-4 h-4" />;
  }
};

const DetallePredioActualizacion = ({
  predio,
  geometry,
  construcciones,
  tieneConstrucciones,
  mostrarConstrucciones,
  cargandoConstrucciones,
  onToggleConstrucciones,
  onClose,
  onOpenVisita,
  onOpenVisitaMejora, // Nueva: para visita de mejora específica
  onOpenEdicion,
  onOpenHistorial,
  onOpenCancelar,
  terrenoTieneMejoras, // Nueva: indica si el terreno tiene mejoras
  mejorasDelTerreno, // Nueva: lista de mejoras del terreno
  user,
  prediosR1R2 = [] // Lista de predios para buscar estado de mejoras
}) => {
  if (!predio) return null;

  const estado = predio.estado_visita || 'pendiente';
  const sinCambios = predio.sin_cambios;
  const esGestor = user?.role === 'gestor' || user?.role === 'gestor_auxiliar';
  const esCoordinador = user?.role === 'coordinador' || user?.role === 'administrador';
  
  // Verificar si el predio seleccionado ES una mejora (código termina en != 000)
  const codigoPredio = predio.codigo_predial || predio.codigo_predial_nacional || predio.numero_predial || '';
  const esMejoraDirecta = codigoPredio.length >= 30 && codigoPredio.substring(27, 30) !== '000';
  
  // Ya no usamos esMejora basado en el código del terreno
  // Ahora usamos terrenoTieneMejoras que viene de las construcciones
  const tieneMejoras = terrenoTieneMejoras || false;
  const numMejoras = mejorasDelTerreno?.length || 0;

  return (
    <Card className={`shadow-md ${esMejoraDirecta ? 'border-purple-400 border-2' : tieneMejoras ? 'border-cyan-400 border-2' : 'border-amber-300'}`} data-testid="detalle-predio-actualizacion">
      <CardHeader className={`py-3 ${esMejoraDirecta ? 'bg-purple-100' : tieneMejoras ? 'bg-cyan-100' : 'bg-amber-100'}`}>
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            {esMejoraDirecta ? (
              <Building className="w-4 h-4 text-purple-700" />
            ) : (
              <MapPin className={`w-4 h-4 ${tieneMejoras ? 'text-cyan-700' : 'text-amber-700'}`} />
            )}
            <span className={`font-semibold ${esMejoraDirecta ? 'text-purple-800' : tieneMejoras ? 'text-cyan-800' : 'text-amber-800'}`}>
              {esMejoraDirecta ? 'Mejora Seleccionada' : 'Terreno Seleccionado'}
            </span>
            {esMejoraDirecta && (
              <Badge className="bg-purple-500 text-white text-[10px] px-1.5 py-0">
                MEJORA #{codigoPredio.substring(27, 30)}
              </Badge>
            )}
            {!esMejoraDirecta && tieneMejoras && (
              <Badge className="bg-cyan-500 text-white text-[10px] px-1.5 py-0">
                {numMejoras} MEJORA{numMejoras > 1 ? 'S' : ''}
              </Badge>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 text-xs text-slate-500"
            onClick={onClose}
            data-testid="close-detalle-btn"
          >
            ✕ Cerrar
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-2 text-sm max-h-[55vh] overflow-y-auto">
        {/* Estado de Visita */}
        <div className={`flex items-center justify-between p-2 rounded border ${getEstadoColor(estado)}`}>
          <div className="flex items-center gap-2">
            {getEstadoIcon(estado)}
            <span className="font-medium capitalize">{estado}</span>
            {sinCambios && (
              <Badge variant="outline" className="text-xs bg-gray-50">Sin cambios</Badge>
            )}
            {esMejoraDirecta && (
              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-300">
                <Building className="w-3 h-3 mr-1" />
                Es Mejora
              </Badge>
            )}
            {!esMejoraDirecta && tieneMejoras && (
              <Badge variant="outline" className="text-xs bg-cyan-50 text-cyan-700 border-cyan-300">
                <Building className="w-3 h-3 mr-1" />
                Con Mejoras
              </Badge>
            )}
          </div>
        </div>

        {/* Código Predial */}
        <div className={`p-2 rounded ${esMejoraDirecta ? 'bg-purple-50' : tieneMejoras ? 'bg-cyan-50' : 'bg-slate-50'}`}>
          <p className="text-xs text-slate-500">
            {esMejoraDirecta ? 'Código Predial Nacional (Mejora)' : 'Código Predial Nacional (Terreno)'}
          </p>
          <p className="font-mono text-[10px] font-medium text-slate-800 break-all">
            {predio.codigo_predial || predio.codigo_predial_nacional}
          </p>
        </div>
        
        {/* Lista de Mejoras si las hay */}
        {tieneMejoras && mejorasDelTerreno && mejorasDelTerreno.length > 0 && (
          <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-cyan-800 text-xs flex items-center gap-1">
                <Building className="w-4 h-4" />
                Mejoras del Terreno ({numMejoras})
              </span>
            </div>
            <div className="max-h-[200px] overflow-y-auto space-y-2">
              {mejorasDelTerreno.map((mejora, idx) => {
                const props = mejora.properties || {};
                const codigoMejora = props.codigo || '';
                const numMejoraStr = codigoMejora.substring(27, 30);
                return (
                  <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border border-cyan-200">
                    <div>
                      <Badge className="bg-cyan-500 text-white text-[10px]">Mejora #{numMejoraStr}</Badge>
                      <p className="font-mono text-[9px] text-slate-600 mt-1">{codigoMejora}</p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-6 text-xs border-cyan-300 text-cyan-700 hover:bg-cyan-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onOpenVisitaMejora) {
                          onOpenVisitaMejora(mejora);
                        }
                      }}
                    >
                      <ClipboardList className="w-3 h-3 mr-1" />
                      Visita
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Toggle Construcciones */}
        {tieneConstrucciones && (
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-red-600" />
                <span className="font-semibold text-red-800">Construcciones</span>
              </div>
              <Button
                variant={mostrarConstrucciones ? "default" : "outline"}
                size="sm"
                className={`${mostrarConstrucciones ? 'bg-red-600 hover:bg-red-700 text-white' : 'border-red-400 text-red-600 hover:bg-red-100'}`}
                onClick={onToggleConstrucciones}
                disabled={cargandoConstrucciones}
                data-testid="toggle-construcciones-btn"
              >
                {cargandoConstrucciones ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : mostrarConstrucciones ? (
                  <Eye className="w-4 h-4 mr-1" />
                ) : (
                  <EyeOff className="w-4 h-4 mr-1" />
                )}
                {mostrarConstrucciones ? 'Ocultar en mapa' : 'Ver en mapa'}
              </Button>
            </div>
            
            {/* Lista de construcciones */}
            {mostrarConstrucciones && construcciones && construcciones.length > 0 && (
              <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                {construcciones.map((const_item, idx) => (
                  <div key={idx} className="bg-white rounded p-2 text-xs flex justify-between items-center">
                    <span className="text-red-800">🏠 Construcción {idx + 1}</span>
                    <span className="text-red-600 font-medium">{formatArea(const_item.area_m2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Municipio y Zona */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-xs text-slate-500">Municipio</p>
            <p className="font-medium">{predio.municipio}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Zona</p>
            <p className="font-medium">
              {getZonaFromCodigo(predio.codigo_predial || predio.codigo_predial_nacional).texto}
            </p>
          </div>
        </div>

        {/* Dirección */}
        {predio.direccion && (
          <div className="border-t pt-2">
            <p className="text-xs text-slate-500">Dirección</p>
            <p className="font-medium">{predio.direccion}</p>
          </div>
        )}

        {/* Propietario */}
        <div className="border-t pt-2">
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <User className="w-3 h-3" /> Propietario(s)
          </p>
          {predio.propietarios?.length > 0 ? (
            predio.propietarios.slice(0, 3).map((p, idx) => (
              <p key={idx} className="font-medium text-sm">
                {p.nombre_propietario || p.nombre || 'Sin nombre'}
              </p>
            ))
          ) : (
            <p className="font-medium text-slate-400">No registrado</p>
          )}
          {predio.propietarios?.length > 3 && (
            <p className="text-xs text-slate-500">+{predio.propietarios.length - 3} más...</p>
          )}
        </div>

        {/* Matrícula Inmobiliaria */}
        <div className="border-t pt-2">
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <FileText className="w-3 h-3" /> Matrícula Inmobiliaria
          </p>
          <p className="font-mono font-medium text-slate-800">
            {predio.matricula_inmobiliaria || 'Sin información'}
          </p>
        </div>

        {/* Áreas: R1/R2 vs GDB */}
        <div className="border-t pt-2">
          <p className="text-xs text-slate-500 flex items-center gap-1 mb-2">
            <Building className="w-3 h-3" /> Áreas del Predio
          </p>
          <div className="grid grid-cols-2 gap-2">
            {/* Columna R1/R2 */}
            <div className="bg-blue-50 p-2 rounded border border-blue-200">
              <p className="text-xs font-semibold text-blue-700 mb-1">📋 R1/R2</p>
              <div className="space-y-1">
                <div>
                  <p className="text-[10px] text-blue-600">{esMejoraDirecta ? 'Área Construida' : 'Área Terreno'}</p>
                  <p className="font-bold text-blue-800">
                    {esMejoraDirecta 
                      ? formatArea(predio.area_construida)
                      : formatArea(predio.area_terreno)
                    }
                  </p>
                </div>
                {!esMejoraDirecta && (
                  <div>
                    <p className="text-[10px] text-blue-600">Área Construida</p>
                    <p className="font-medium text-blue-700">{formatArea(predio.area_construida)}</p>
                  </div>
                )}
              </div>
            </div>
            {/* Columna GDB */}
            <div className={`p-2 rounded border ${esMejoraDirecta ? 'bg-purple-50 border-purple-200' : geometry ? 'bg-amber-50 border-amber-200' : 'bg-slate-100 border-slate-200'}`}>
              <p className={`text-xs font-semibold mb-1 ${esMejoraDirecta ? 'text-purple-700' : geometry ? 'text-amber-700' : 'text-slate-500'}`}>🗺️ GDB</p>
              {esMejoraDirecta ? (
                <div>
                  <p className="text-[10px] text-purple-600">Geometría</p>
                  <p className="text-xs text-purple-700">Las mejoras no tienen geometría propia</p>
                  <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 mt-1">
                    Usar geometría del terreno
                  </Badge>
                </div>
              ) : geometry ? (
                <div className="space-y-1">
                  <div>
                    <p className="text-[10px] text-amber-600">Área GDB</p>
                    <p className="font-bold text-amber-800">
                      {formatArea(geometry.properties?.area_m2 || geometry.properties?.Shape_Area)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-emerald-600">Estado</p>
                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700">
                      ✓ Con Base Gráfica
                    </Badge>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-[10px] text-slate-500">Área GDB</p>
                  <p className="text-xs text-slate-400">Sin Base Gráfica</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Avalúo */}
        <div className="border-t pt-2">
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> Avalúo Catastral
          </p>
          <p className="text-lg font-bold text-emerald-700">{formatCurrency(predio.avaluo_catastral || predio.avaluo)}</p>
        </div>

        {/* Destino Económico */}
        {predio.destino_economico && (
          <div className="border-t pt-2">
            <p className="text-xs text-slate-500">Destino Económico</p>
            <p className="font-medium">{predio.destino_economico}</p>
          </div>
        )}
      </CardContent>
      
      {/* Botones de Acción - Siempre visibles fuera del scroll */}
      <div className="border-t p-3 space-y-2 bg-white">
        {/* Formulario de Visita - Solo si está pendiente o visitado */}
        {(estado === 'pendiente' || estado === 'visitado') && (esGestor || esCoordinador) && (
          <Button
            className={`w-full ${esMejoraDirecta ? 'bg-purple-600 hover:bg-purple-700' : 'bg-amber-600 hover:bg-amber-700'}`}
            size="sm"
            onClick={onOpenVisita}
            data-testid="open-visita-btn"
          >
            <ClipboardList className="w-4 h-4 mr-2" />
            {estado === 'visitado' 
              ? (esMejoraDirecta ? 'Ver/Editar Visita Mejora' : 'Ver/Editar Visita') 
              : (esMejoraDirecta ? 'Registrar Visita Mejora' : 'Registrar Visita')
            }
          </Button>
        )}

        {/* Editar Predio */}
        {(esGestor || esCoordinador) && (
          <Button
            className="w-full"
            variant="outline"
            size="sm"
            onClick={onOpenEdicion}
            data-testid="open-edicion-btn"
          >
            <Edit className="w-4 h-4 mr-2" />
            Editar Predio
          </Button>
        )}

        {/* Cancelar Predio - Solo si no está cancelado ni tiene propuesta pendiente */}
        {(esGestor || esCoordinador) && !predio.cancelado && !predio.deleted && !predio.propuesta_cancelacion_pendiente && onOpenCancelar && (
          <Button
            className="w-full border-red-300 text-red-700 hover:bg-red-50"
            variant="outline"
            size="sm"
            onClick={onOpenCancelar}
            data-testid="open-cancelar-btn"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {esCoordinador ? 'Cancelar Predio' : 'Proponer Cancelación'}
          </Button>
        )}
        
        {/* Indicador de propuesta de cancelación pendiente */}
        {predio.propuesta_cancelacion_pendiente && (
          <div className="w-full flex items-center justify-center text-amber-600 text-xs p-2 bg-amber-50 rounded border border-amber-200">
            <AlertCircle className="w-4 h-4 mr-1" />
            Cancelación pendiente de aprobación
          </div>
        )}

        {/* Historial */}
        <Button
          className="w-full"
          variant="ghost"
          size="sm"
          onClick={onOpenHistorial}
          data-testid="open-historial-btn"
        >
          <History className="w-4 h-4 mr-2" />
          Ver Historial
        </Button>
      </div>
    </Card>
  );
};

export default DetallePredioActualizacion;
