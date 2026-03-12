/**
 * Página 2 del Formulario de Visita
 * Secciones: Información Jurídica, Propietarios, Datos de Notificación
 * 
 * OPTIMIZACIÓN DE RENDIMIENTO:
 * - React.memo() evita re-renders innecesarios
 * - DebouncedInput para campos de texto con estado local
 */
import React, { memo, useCallback } from 'react';
import { FileText, Mail, Plus, Trash2 } from 'lucide-react';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';
import DebouncedInput from '../../DebouncedInput';

const VisitaPagina2 = memo(({ 
  visitaData, 
  setVisitaData,
  visitaPropietarios,
  agregarPropietario,
  eliminarPropietario,
  actualizarPropietario
}) => {
  const handleFieldChange = useCallback((field, value) => {
    setVisitaData(prev => ({ ...prev, [field]: value }));
  }, [setVisitaData]);

  return (
    <>
      {/* Sección 5: Información Jurídica */}
      <div className="border border-indigo-200 rounded-lg overflow-hidden">
        <div className="bg-indigo-50 px-4 py-2 border-b border-indigo-200">
          <h3 className="font-semibold text-indigo-800 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            5. INFORMACIÓN JURÍDICA Y PROPIETARIOS
          </h3>
        </div>
        <div className="p-4 space-y-4">
          {/* Datos del documento */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-slate-500">Matrícula Inmobiliaria</Label>
              <Input value={visitaData.jur_matricula} onChange={(e) => handleFieldChange('jur_matricula', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Tipo Doc.</Label>
              <div className="flex gap-2 flex-wrap">
                {['Escritura','Sentencia','Resolución'].map(t => (
                  <label key={t} className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" name="jur_tipo_doc" checked={visitaData.jur_tipo_doc === t} onChange={() => handleFieldChange('jur_tipo_doc', t)} className="text-indigo-600" />
                    <span className="text-xs">{t}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-500">No. Documento</Label>
              <Input value={visitaData.jur_numero_doc} onChange={(e) => handleFieldChange('jur_numero_doc', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-slate-500">Notaría</Label>
              <Input value={visitaData.jur_notaria} onChange={(e) => handleFieldChange('jur_notaria', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Fecha</Label>
              <Input type="date" value={visitaData.jur_fecha} onChange={(e) => handleFieldChange('jur_fecha', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Ciudad</Label>
              <Input value={visitaData.jur_ciudad} onChange={(e) => handleFieldChange('jur_ciudad', e.target.value.toUpperCase())} className="uppercase" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-slate-500">Razón Social (si aplica)</Label>
            <Input value={visitaData.jur_razon_social} onChange={(e) => handleFieldChange('jur_razon_social', e.target.value.toUpperCase())} className="uppercase" />
          </div>

          {/* Lista de Propietarios */}
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-medium text-indigo-800">Propietarios / Poseedores</Label>
              <Button type="button" variant="outline" size="sm" onClick={agregarPropietario} className="text-indigo-600 border-indigo-300">
                <Plus className="w-4 h-4 mr-1" /> Agregar
              </Button>
            </div>
            
            {visitaPropietarios.map((prop, idx) => (
              <div key={idx} className="border border-slate-200 rounded-lg p-3 mb-3 bg-slate-50">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-medium text-slate-600">Propietario {idx + 1}</span>
                  {visitaPropietarios.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => eliminarPropietario(idx)} className="text-red-500 h-6 px-2">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <Label className="text-xs text-slate-500">Tipo Doc.</Label>
                    <div className="flex gap-2">
                      {['C','E','T','N'].map(t => (
                        <label key={t} className="flex items-center gap-1 cursor-pointer">
                          <input type="radio" name={`tipo_doc_${idx}`} checked={prop.tipo_documento === t} onChange={() => actualizarPropietario(idx, 'tipo_documento', t)} className="text-indigo-600" />
                          <span className="text-xs">{t}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Número</Label>
                    <Input value={prop.numero_documento} onChange={(e) => actualizarPropietario(idx, 'numero_documento', e.target.value.replace(/\D/g, '').slice(0, 12))} onBlur={(e) => { if (e.target.value) actualizarPropietario(idx, 'numero_documento', e.target.value.replace(/\D/g, '').padStart(12, '0')); }} className="h-8 text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3 mb-2">
                  <div>
                    <Label className="text-xs text-slate-500">Nombre</Label>
                    <Input value={prop.nombre} onChange={(e) => actualizarPropietario(idx, 'nombre', e.target.value.toUpperCase())} className="h-8 text-sm uppercase" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Primer Apellido</Label>
                    <Input value={prop.primer_apellido} onChange={(e) => actualizarPropietario(idx, 'primer_apellido', e.target.value.toUpperCase())} className="h-8 text-sm uppercase" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Segundo Apellido</Label>
                    <Input value={prop.segundo_apellido} onChange={(e) => actualizarPropietario(idx, 'segundo_apellido', e.target.value.toUpperCase())} className="h-8 text-sm uppercase" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Estado</Label>
                    <Input value={prop.estado || ''} onChange={(e) => actualizarPropietario(idx, 'estado', e.target.value.toUpperCase())} placeholder="Ej: E, CASADO" className="h-8 text-sm uppercase" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-slate-500">Género</Label>
                    <div className="flex flex-wrap gap-2">
                      {[{v:'masculino',l:'Masculino'},{v:'femenino',l:'Femenino'},{v:'lgbtq',l:'LGBTQ+'},{v:'otro',l:'Otro'}].map(g => (
                        <label key={g.v} className="flex items-center gap-1 cursor-pointer">
                          <input type="radio" name={`genero_${idx}`} checked={prop.genero === g.v} onChange={() => actualizarPropietario(idx, 'genero', g.v)} className="text-indigo-600" />
                          <span className="text-xs">{g.l}</span>
                        </label>
                      ))}
                    </div>
                    {prop.genero === 'otro' && (
                      <Input value={prop.genero_otro} onChange={(e) => actualizarPropietario(idx, 'genero_otro', e.target.value)} placeholder="¿Cuál?" className="h-7 text-xs mt-1" />
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Grupo Étnico</Label>
                    <div className="flex flex-wrap gap-2">
                      {['Ninguno','Indígena','Afro','ROM','Otro'].map(g => (
                        <label key={g} className="flex items-center gap-1 cursor-pointer">
                          <input type="radio" name={`etnico_${idx}`} checked={prop.grupo_etnico === g} onChange={() => actualizarPropietario(idx, 'grupo_etnico', g)} className="text-indigo-600" />
                          <span className="text-xs">{g}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sección 6: Datos de Notificación */}
      <div className="border border-teal-200 rounded-lg overflow-hidden">
        <div className="bg-teal-50 px-4 py-2 border-b border-teal-200">
          <h3 className="font-semibold text-teal-800 flex items-center gap-2">
            <Mail className="w-4 h-4" />
            6. DATOS DE NOTIFICACIÓN
          </h3>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-slate-500">Teléfono</Label>
              <DebouncedInput value={visitaData.not_telefono} onChange={(val) => handleFieldChange('not_telefono', val)} placeholder="3001234567" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Correo Electrónico</Label>
              <DebouncedInput type="email" value={visitaData.not_correo} onChange={(val) => handleFieldChange('not_correo', val)} placeholder="correo@ejemplo.com" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">¿Autoriza notificación por correo?</Label>
              <div className="flex gap-4 h-10 items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="autoriza_correo" checked={visitaData.not_autoriza_correo === 'si'} onChange={() => handleFieldChange('not_autoriza_correo', 'si')} className="text-teal-600" />
                  <span className="text-sm">Sí</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="autoriza_correo" checked={visitaData.not_autoriza_correo === 'no'} onChange={() => handleFieldChange('not_autoriza_correo', 'no')} className="text-teal-600" />
                  <span className="text-sm">No</span>
                </label>
              </div>
            </div>
          </div>
          <div>
            <Label className="text-xs text-slate-500">Dirección de Notificación</Label>
            <DebouncedInput value={visitaData.not_direccion} onChange={(val) => handleFieldChange('not_direccion', val)} uppercase={true} className="uppercase" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-slate-500">Departamento</Label>
              <Input value={visitaData.not_departamento} disabled className="bg-slate-100" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Municipio</Label>
              <DebouncedInput value={visitaData.not_municipio} onChange={(val) => handleFieldChange('not_municipio', val)} uppercase={true} className="uppercase" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-slate-500">Vereda</Label>
              <DebouncedInput value={visitaData.not_vereda} onChange={(val) => handleFieldChange('not_vereda', val)} uppercase={true} className="uppercase" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Corregimiento</Label>
              <DebouncedInput value={visitaData.not_corregimiento} onChange={(val) => handleFieldChange('not_corregimiento', val)} uppercase={true} className="uppercase" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-slate-500">Datos Adicionales</Label>
            <Textarea value={visitaData.not_datos_adicionales} onChange={(e) => handleFieldChange('not_datos_adicionales', e.target.value)} rows={2} />
          </div>
        </div>
      </div>
    </>
  );
});

VisitaPagina2.displayName = 'VisitaPagina2';

export default VisitaPagina2;
