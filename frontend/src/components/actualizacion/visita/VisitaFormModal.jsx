/**
 * Modal del Formulario de Visita - COMPLETAMENTE ENCAPSULADO
 * 
 * Este componente maneja TODO el estado del formulario internamente
 * para evitar re-renders del componente padre (VisorActualizacion.js)
 * 
 * OPTIMIZACIONES:
 * - Estado completamente local (no se propaga al padre hasta guardar)
 * - Lazy loading de páginas
 * - DebouncedInput para campos de texto
 * - React.memo en todos los sub-componentes
 */
import React, { useState, useCallback, useEffect, useRef, lazy, Suspense, memo } from 'react';
import { 
  FileText, ChevronLeft, ChevronRight, Save, RefreshCw, X,
  Clock, Building, Home, Mail, Plus, Trash2, Camera, Image as ImageIcon,
  MapPin, Pen, User, CheckCircle, AlertCircle
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import { Textarea } from '../../ui/textarea';
import { toast } from 'sonner';

// Estado inicial del formulario
const getInitialVisitaData = () => ({
  // Datos de visita
  fecha_visita: new Date().toISOString().split('T')[0],
  hora_visita: new Date().toTimeString().slice(0, 5),
  persona_atiende: '',
  relacion_predio: '',
  acceso_predio: 'si',
  // Información básica
  tipo_predio: '',
  direccion_visita: '',
  destino_economico_visita: '',
  area_terreno_visita: '',
  area_construida_visita: '',
  // PH
  ph_area_coeficiente: '',
  ph_area_construida_privada: '',
  ph_area_construida_comun: '',
  ph_copropiedad: '',
  ph_predio_asociado: '',
  ph_torre: '',
  ph_apartamento: '',
  // Condominio
  cond_area_terreno_comun: '',
  cond_area_terreno_privada: '',
  cond_area_construida_privada: '',
  cond_area_construida_comun: '',
  cond_condominio: '',
  cond_predio_asociado: '',
  cond_unidad: '',
  cond_casa: '',
  // Jurídico
  jur_matricula: '',
  jur_tipo_doc: '',
  jur_numero_doc: '',
  jur_notaria: '',
  jur_fecha: '',
  jur_ciudad: '',
  jur_razon_social: '',
  // Notificación
  not_telefono: '',
  not_direccion: '',
  not_correo: '',
  not_autoriza_correo: '',
  not_departamento: 'Norte de Santander',
  not_municipio: '',
  not_vereda: '',
  not_corregimiento: '',
  not_datos_adicionales: '',
  // Áreas
  area_titulo_m2: '', area_titulo_ha: '', area_titulo_desc: '',
  area_base_catastral_m2: '', area_base_catastral_ha: '', area_base_catastral_desc: '',
  area_geografica_m2: '', area_geografica_ha: '', area_geografica_desc: '',
  area_levantamiento_m2: '', area_levantamiento_ha: '', area_levantamiento_desc: '',
  area_identificacion_m2: '', area_identificacion_ha: '', area_identificacion_desc: '',
  // Otros
  fotos_croquis: [],
  observaciones_generales: '',
  firma_visitado_base64: null,
  firma_reconocedor_base64: null,
  nombre_visitado: '',
  nombre_reconocedor: '',
  estado_predio: '',
  servicios_publicos: [],
  sin_cambios: false,
  coordenadas_gps: { latitud: '', longitud: '', precision: null, fecha_captura: null }
});

const getInitialConstrucciones = () => [
  { unidad: 'A', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' },
  { unidad: 'B', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' },
  { unidad: 'C', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' },
  { unidad: 'D', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' },
  { unidad: 'E', codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' }
];

const getInitialCalificaciones = () => [{
  id: 1,
  estructura: { armazon: '', muros: '', cubierta: '', conservacion: '' },
  acabados: { fachadas: '', cubrim_muros: '', pisos: '', conservacion: '' },
  bano: { tamano: '', enchape: '', mobiliario: '', conservacion: '' },
  cocina: { tamano: '', enchape: '', mobiliario: '', conservacion: '' },
  industria: { cercha_madera: '', cercha_metalica_liviana: '', cercha_metalica_mediana: '', cercha_metalica_pesada: '', altura: '' },
  datos_generales: { total_pisos: '', total_habitaciones: '', total_banos: '', total_locales: '', area_total_construida: '' }
}];

const getInitialPropietarios = () => [{
  tipo_documento: 'C', numero_documento: '', nombre: '', primer_apellido: '', 
  segundo_apellido: '', genero: '', genero_otro: '', grupo_etnico: 'Ninguno', estado: ''
}];

// Input con debounce para evitar re-renders - CRÍTICO para rendimiento
const FastInput = memo(({ value, onChange, delay = 150, uppercase, ...props }) => {
  const [localValue, setLocalValue] = useState(value || '');
  const timeoutRef = useRef(null);
  
  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  const handleChange = useCallback((e) => {
    let newVal = e.target.value;
    if (uppercase) newVal = newVal.toUpperCase();
    setLocalValue(newVal);
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onChange(newVal), delay);
  }, [onChange, delay, uppercase]);

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  return <Input {...props} value={localValue} onChange={handleChange} />;
});
FastInput.displayName = 'FastInput';

// Componente de Página 1 optimizado
const Page1 = memo(({ data, setField, predio, proyecto }) => (
  <div className="space-y-4">
    {/* Datos de Visita */}
    <div className="border-2 border-blue-300 rounded-lg overflow-hidden bg-blue-50/50">
      <div className="bg-blue-100 px-4 py-2 border-b border-blue-300">
        <h3 className="font-semibold text-blue-800 flex items-center gap-2">
          <Clock className="w-4 h-4" />1. DATOS DE LA VISITA
        </h3>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-slate-500">Fecha *</Label>
            <Input type="date" value={data.fecha_visita} onChange={e => setField('fecha_visita', e.target.value)} className="bg-white" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">Hora *</Label>
            <Input type="time" value={data.hora_visita} onChange={e => setField('hora_visita', e.target.value)} className="bg-white" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">Persona que Atiende *</Label>
            <FastInput value={data.persona_atiende} onChange={v => setField('persona_atiende', v)} uppercase placeholder="NOMBRE COMPLETO" className="bg-white" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-slate-500 mb-1 block">Relación con el Predio</Label>
            <div className="flex flex-wrap gap-2">
              {['propietario','poseedor','arrendatario','familiar','encargado','otro'].map(v => (
                <label key={v} className="flex items-center gap-1 cursor-pointer text-sm">
                  <input type="radio" checked={data.relacion_predio === v} onChange={() => setField('relacion_predio', v)} />
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-slate-500 mb-1 block">¿Acceso al predio?</Label>
            <div className="flex gap-3">
              {[{v:'si',l:'Sí'},{v:'parcial',l:'Parcial'},{v:'no',l:'No'}].map(i => (
                <label key={i.v} className="flex items-center gap-1 cursor-pointer text-sm">
                  <input type="radio" checked={data.acceso_predio === i.v} onChange={() => setField('acceso_predio', i.v)} />
                  {i.l}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Información Básica */}
    <div className="border border-emerald-200 rounded-lg overflow-hidden">
      <div className="bg-emerald-50 px-4 py-2 border-b border-emerald-200">
        <h3 className="font-semibold text-emerald-800 flex items-center gap-2">
          <Building className="w-4 h-4" />2. INFORMACIÓN BÁSICA
        </h3>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-slate-500">Departamento</Label>
            <Input value="Norte de Santander" disabled className="bg-slate-100" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">Municipio</Label>
            <Input value={proyecto?.municipio || predio?.municipio || ''} disabled className="bg-slate-100" />
          </div>
        </div>
        <div>
          <Label className="text-xs text-slate-500">Número Predial</Label>
          <Input value={predio?.codigo_predial || predio?.numero_predial || ''} disabled className="bg-slate-100 font-mono font-bold" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-slate-500">Código Homologado</Label>
            <Input value={predio?.codigo_homologado || 'Sin código'} disabled className="bg-slate-100 font-mono" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">Tipo</Label>
            <div className="flex gap-3 h-10 items-center">
              {['PH','NPH'].map(t => (
                <label key={t} className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" checked={data.tipo_predio === t} onChange={() => setField('tipo_predio', t)} />
                  <span className="text-sm">{t}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-slate-500">Zona</Label>
            <Input value={predio?.zona || (predio?.codigo_predial?.substring(5,7) === '01' ? 'Urbano' : 'Rural')} disabled className="bg-slate-100" />
          </div>
        </div>
        <div>
          <Label className="text-xs text-slate-500">Dirección</Label>
          <FastInput value={data.direccion_visita} onChange={v => setField('direccion_visita', v)} uppercase placeholder="DIRECCIÓN" />
        </div>
        <div>
          <Label className="text-xs text-slate-500 mb-2 block">Destino Económico</Label>
          <div className="grid grid-cols-4 gap-1 text-xs">
            {['A-Habitacional','B-Industrial','C-Comercial','D-Agropecuario','E-Minero','F-Cultural','G-Recreacional','H-Salubridad','I-Institucional','J-Educativo','K-Religioso','L-Agrícola','M-Pecuario','N-Agroindustrial','O-Forestal','P-Uso Público'].map(d => {
              const [v, l] = d.split('-');
              return (
                <label key={v} className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" checked={data.destino_economico_visita === v} onChange={() => setField('destino_economico_visita', v)} />
                  {d}
                </label>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-slate-500">Área Terreno (m²)</Label>
            <Input type="number" step="0.01" value={data.area_terreno_visita} onChange={e => setField('area_terreno_visita', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs text-slate-500">Área Construida (m²)</Label>
            <Input type="number" step="0.01" value={data.area_construida_visita} onChange={e => setField('area_construida_visita', e.target.value)} />
          </div>
        </div>
      </div>
    </div>

    {/* PH */}
    {data.tipo_predio === 'PH' && (
      <div className="border border-purple-200 rounded-lg overflow-hidden">
        <div className="bg-purple-50 px-4 py-2 border-b border-purple-200">
          <h3 className="font-semibold text-purple-800">3. PH (Propiedad Horizontal)</h3>
        </div>
        <div className="p-4 grid grid-cols-3 gap-3">
          <div><Label className="text-xs">Área Coeficiente</Label><Input type="number" value={data.ph_area_coeficiente} onChange={e => setField('ph_area_coeficiente', e.target.value)} /></div>
          <div><Label className="text-xs">Área Privada</Label><Input type="number" value={data.ph_area_construida_privada} onChange={e => setField('ph_area_construida_privada', e.target.value)} /></div>
          <div><Label className="text-xs">Área Común</Label><Input type="number" value={data.ph_area_construida_comun} onChange={e => setField('ph_area_construida_comun', e.target.value)} /></div>
          <div><Label className="text-xs">Copropiedad</Label><FastInput value={data.ph_copropiedad} onChange={v => setField('ph_copropiedad', v)} uppercase /></div>
          <div><Label className="text-xs">Torre</Label><FastInput value={data.ph_torre} onChange={v => setField('ph_torre', v)} uppercase /></div>
          <div><Label className="text-xs">Apartamento</Label><FastInput value={data.ph_apartamento} onChange={v => setField('ph_apartamento', v)} uppercase /></div>
        </div>
      </div>
    )}

    {/* Condominio */}
    <div className="border border-orange-200 rounded-lg overflow-hidden">
      <div className="bg-orange-50 px-4 py-2 border-b border-orange-200">
        <h3 className="font-semibold text-orange-800 flex items-center gap-2"><Home className="w-4 h-4" />4. Condominio</h3>
      </div>
      <div className="p-4 grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Área Terreno Común</Label><Input type="number" value={data.cond_area_terreno_comun} onChange={e => setField('cond_area_terreno_comun', e.target.value)} /></div>
        <div><Label className="text-xs">Área Terreno Privada</Label><Input type="number" value={data.cond_area_terreno_privada} onChange={e => setField('cond_area_terreno_privada', e.target.value)} /></div>
        <div><Label className="text-xs">Condominio</Label><FastInput value={data.cond_condominio} onChange={v => setField('cond_condominio', v)} uppercase /></div>
        <div><Label className="text-xs">Unidad</Label><FastInput value={data.cond_unidad} onChange={v => setField('cond_unidad', v)} uppercase /></div>
      </div>
    </div>
  </div>
));
Page1.displayName = 'Page1';

// Página 2 - Propietarios y Notificación
const Page2 = memo(({ data, setField, propietarios, setPropietarios }) => {
  const agregarProp = () => setPropietarios(p => [...p, getInitialPropietarios()[0]]);
  const eliminarProp = (i) => setPropietarios(p => p.filter((_, idx) => idx !== i));
  const actualizarProp = (i, campo, valor) => setPropietarios(p => { const n = [...p]; n[i] = {...n[i], [campo]: valor}; return n; });

  return (
    <div className="space-y-4">
      {/* Jurídico */}
      <div className="border border-indigo-200 rounded-lg overflow-hidden">
        <div className="bg-indigo-50 px-4 py-2 border-b border-indigo-200">
          <h3 className="font-semibold text-indigo-800 flex items-center gap-2"><FileText className="w-4 h-4" />5. INFORMACIÓN JURÍDICA</h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Matrícula</Label><FastInput value={data.jur_matricula} onChange={v => setField('jur_matricula', v)} /></div>
            <div>
              <Label className="text-xs">Tipo Doc.</Label>
              <div className="flex gap-2">{['Escritura','Sentencia','Resolución'].map(t => (
                <label key={t} className="flex items-center gap-1 text-xs cursor-pointer">
                  <input type="radio" checked={data.jur_tipo_doc === t} onChange={() => setField('jur_tipo_doc', t)} />{t}
                </label>
              ))}</div>
            </div>
            <div><Label className="text-xs">No. Doc</Label><FastInput value={data.jur_numero_doc} onChange={v => setField('jur_numero_doc', v)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Notaría</Label><FastInput value={data.jur_notaria} onChange={v => setField('jur_notaria', v)} /></div>
            <div><Label className="text-xs">Fecha</Label><Input type="date" value={data.jur_fecha} onChange={e => setField('jur_fecha', e.target.value)} /></div>
            <div><Label className="text-xs">Ciudad</Label><FastInput value={data.jur_ciudad} onChange={v => setField('jur_ciudad', v)} uppercase /></div>
          </div>

          {/* Propietarios */}
          <div className="border-t pt-3 mt-3">
            <div className="flex justify-between items-center mb-2">
              <Label className="font-medium">Propietarios</Label>
              <Button type="button" variant="outline" size="sm" onClick={agregarProp}><Plus className="w-3 h-3 mr-1" />Agregar</Button>
            </div>
            {propietarios.map((p, i) => (
              <div key={i} className="border rounded p-2 mb-2 bg-slate-50">
                <div className="flex justify-between mb-2">
                  <span className="text-xs font-medium">Propietario {i+1}</span>
                  {propietarios.length > 1 && <Button variant="ghost" size="sm" onClick={() => eliminarProp(i)} className="h-5 px-1 text-red-500"><Trash2 className="w-3 h-3" /></Button>}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <Label className="text-xs">Tipo</Label>
                    <div className="flex gap-1">{['C','E','T','N'].map(t => (
                      <label key={t} className="flex items-center gap-0.5 text-xs cursor-pointer">
                        <input type="radio" checked={p.tipo_documento === t} onChange={() => actualizarProp(i, 'tipo_documento', t)} />{t}
                      </label>
                    ))}</div>
                  </div>
                  <div><Label className="text-xs">Número</Label><FastInput value={p.numero_documento} onChange={v => actualizarProp(i, 'numero_documento', v)} className="h-7 text-sm" /></div>
                  <div><Label className="text-xs">Nombre</Label><FastInput value={p.nombre} onChange={v => actualizarProp(i, 'nombre', v)} uppercase className="h-7 text-sm" /></div>
                  <div><Label className="text-xs">Apellido</Label><FastInput value={p.primer_apellido} onChange={v => actualizarProp(i, 'primer_apellido', v)} uppercase className="h-7 text-sm" /></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Notificación */}
      <div className="border border-teal-200 rounded-lg overflow-hidden">
        <div className="bg-teal-50 px-4 py-2 border-b border-teal-200">
          <h3 className="font-semibold text-teal-800 flex items-center gap-2"><Mail className="w-4 h-4" />6. DATOS DE NOTIFICACIÓN</h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Teléfono</Label><FastInput value={data.not_telefono} onChange={v => setField('not_telefono', v)} /></div>
            <div><Label className="text-xs">Correo</Label><FastInput value={data.not_correo} onChange={v => setField('not_correo', v)} /></div>
            <div>
              <Label className="text-xs">¿Autoriza correo?</Label>
              <div className="flex gap-3">{['si','no'].map(v => (
                <label key={v} className="flex items-center gap-1 text-sm cursor-pointer">
                  <input type="radio" checked={data.not_autoriza_correo === v} onChange={() => setField('not_autoriza_correo', v)} />{v === 'si' ? 'Sí' : 'No'}
                </label>
              ))}</div>
            </div>
          </div>
          <div><Label className="text-xs">Dirección Notificación</Label><FastInput value={data.not_direccion} onChange={v => setField('not_direccion', v)} uppercase /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Municipio</Label><FastInput value={data.not_municipio} onChange={v => setField('not_municipio', v)} uppercase /></div>
            <div><Label className="text-xs">Vereda</Label><FastInput value={data.not_vereda} onChange={v => setField('not_vereda', v)} uppercase /></div>
          </div>
        </div>
      </div>
    </div>
  );
});
Page2.displayName = 'Page2';

// Página 3 - Construcciones y Calificación (simplificada)
const Page3 = memo(({ construcciones, setConstrucciones, calificaciones, setCalificaciones }) => {
  const actualizarCons = (i, campo, val) => setConstrucciones(c => { const n = [...c]; n[i] = {...n[i], [campo]: val}; return n; });
  const agregarCons = () => setConstrucciones(c => [...c, { unidad: String.fromCharCode(65 + c.length), codigo_uso: '', area: '', puntaje: '', ano_construccion: '', num_pisos: '' }]);
  
  return (
    <div className="space-y-4">
      <div className="border border-purple-200 rounded-lg overflow-hidden">
        <div className="bg-purple-50 px-4 py-2 border-b border-purple-200 flex justify-between">
          <h3 className="font-semibold text-purple-800 flex items-center gap-2"><Building className="w-4 h-4" />7. CONSTRUCCIONES</h3>
          <Button variant="outline" size="sm" onClick={agregarCons}><Plus className="w-3 h-3 mr-1" />Agregar</Button>
        </div>
        <div className="p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-purple-50">
              <th className="px-2 py-1 text-left">Unidad</th>
              <th className="px-2 py-1">Código</th>
              <th className="px-2 py-1">Área</th>
              <th className="px-2 py-1">Puntaje</th>
              <th className="px-2 py-1">Año</th>
              <th className="px-2 py-1">Pisos</th>
            </tr></thead>
            <tbody>
              {construcciones.map((c, i) => (
                <tr key={i} className="border-b">
                  <td className="px-2 py-1 font-bold text-purple-700">{c.unidad}</td>
                  <td className="px-1"><FastInput value={c.codigo_uso} onChange={v => actualizarCons(i, 'codigo_uso', v)} className="w-16 h-7 text-xs" /></td>
                  <td className="px-1"><FastInput type="number" value={c.area} onChange={v => actualizarCons(i, 'area', v)} className="w-16 h-7 text-xs" /></td>
                  <td className="px-1"><FastInput type="number" value={c.puntaje} onChange={v => actualizarCons(i, 'puntaje', v)} className="w-14 h-7 text-xs" /></td>
                  <td className="px-1"><FastInput type="number" value={c.ano_construccion} onChange={v => actualizarCons(i, 'ano_construccion', v)} className="w-16 h-7 text-xs" /></td>
                  <td className="px-1"><FastInput type="number" value={c.num_pisos} onChange={v => actualizarCons(i, 'num_pisos', v)} className="w-12 h-7 text-xs" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border border-orange-200 rounded-lg overflow-hidden">
        <div className="bg-orange-50 px-4 py-2 border-b border-orange-200">
          <h3 className="font-semibold text-orange-800">8. CALIFICACIÓN</h3>
        </div>
        <div className="p-4 text-sm text-slate-600">
          <p>Complete los datos de calificación según el tipo de construcción.</p>
          {calificaciones.map((cal, i) => (
            <div key={i} className="mt-3 p-3 border rounded bg-slate-50">
              <p className="font-medium mb-2">Calificación #{cal.id}</p>
              <div className="grid grid-cols-4 gap-2">
                {['armazon','muros','cubierta','conservacion'].map(f => (
                  <div key={f}><Label className="text-xs capitalize">{f}</Label><FastInput value={cal.estructura[f]} onChange={v => {
                    setCalificaciones(c => { const n = [...c]; n[i] = {...n[i], estructura: {...n[i].estructura, [f]: v}}; return n; });
                  }} className="h-7 text-xs" /></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
Page3.displayName = 'Page3';

// Página 4 - Áreas
const Page4 = memo(({ data, setField }) => (
  <div className="space-y-4">
    <div className="border border-teal-200 rounded-lg overflow-hidden">
      <div className="bg-teal-50 px-4 py-2 border-b border-teal-200">
        <h3 className="font-semibold text-teal-800">9. ÁREAS DE TERRENO</h3>
      </div>
      <div className="p-4">
        <table className="w-full text-sm">
          <thead><tr className="bg-teal-50">
            <th className="px-2 py-1 text-left">Área según:</th>
            <th className="px-2 py-1">Ha</th>
            <th className="px-2 py-1">m²</th>
            <th className="px-2 py-1">Descripción</th>
          </tr></thead>
          <tbody>
            {[
              ['titulo', 'Área de título', false],
              ['base_catastral', 'Área base catastral (R1)', true],
              ['geografica', 'Área geográfica (GDB)', true],
              ['levantamiento', 'Área levantamiento', false],
              ['identificacion', 'Área identificación', false]
            ].map(([key, label, readOnly]) => (
              <tr key={key} className={readOnly ? 'bg-emerald-50' : ''}>
                <td className="px-2 py-1 font-medium">{label}</td>
                <td className="px-1"><Input type="number" step="0.0001" value={data[`area_${key}_ha`]} onChange={e => {
                  const ha = e.target.value;
                  setField(`area_${key}_ha`, ha);
                  setField(`area_${key}_m2`, ha ? (parseFloat(ha) * 10000).toFixed(2) : '');
                }} disabled={readOnly} className={`h-7 text-xs w-20 ${readOnly ? 'bg-emerald-100' : ''}`} /></td>
                <td className="px-1"><Input value={data[`area_${key}_m2`]} disabled className={`h-7 text-xs w-24 ${readOnly ? 'bg-emerald-100' : 'bg-slate-50'}`} /></td>
                <td className="px-1"><FastInput value={data[`area_${key}_desc`]} onChange={v => setField(`area_${key}_desc`, v)} disabled={readOnly} className={`h-7 text-xs ${readOnly ? 'bg-emerald-100' : ''}`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    
    <div className="border border-indigo-200 rounded-lg overflow-hidden">
      <div className="bg-indigo-50 px-4 py-2 border-b border-indigo-200">
        <h3 className="font-semibold text-indigo-800 flex items-center gap-2"><Camera className="w-4 h-4" />10. CROQUIS / FOTOS</h3>
      </div>
      <div className="p-4">
        <p className="text-sm text-slate-600">Cargue fotos del croquis del terreno.</p>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Button variant="outline" className="border-dashed"><Camera className="w-4 h-4 mr-2" />Tomar Foto</Button>
          <Button variant="outline" className="border-dashed"><ImageIcon className="w-4 h-4 mr-2" />Galería</Button>
        </div>
      </div>
    </div>
  </div>
));
Page4.displayName = 'Page4';

// Página 5 - GPS, Observaciones, Firmas
const Page5 = memo(({ data, setField, fotos, setFotos }) => (
  <div className="space-y-4">
    {/* GPS */}
    <div className="border border-blue-200 rounded-lg overflow-hidden">
      <div className="bg-blue-50 px-4 py-2 border-b border-blue-200">
        <h3 className="font-semibold text-blue-800 flex items-center gap-2"><MapPin className="w-4 h-4" />11. COORDENADAS GPS</h3>
      </div>
      <div className="p-4 space-y-3">
        <Button className="w-full bg-blue-600 hover:bg-blue-700"><MapPin className="w-4 h-4 mr-2" />📍 Capturar Mi Ubicación</Button>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Latitud</Label><FastInput value={data.coordenadas_gps?.latitud || ''} onChange={v => setField('coordenadas_gps', {...data.coordenadas_gps, latitud: v})} /></div>
          <div><Label className="text-xs">Longitud</Label><FastInput value={data.coordenadas_gps?.longitud || ''} onChange={v => setField('coordenadas_gps', {...data.coordenadas_gps, longitud: v})} /></div>
        </div>
      </div>
    </div>

    {/* Observaciones */}
    <div className="border border-amber-200 rounded-lg overflow-hidden">
      <div className="bg-amber-50 px-4 py-2 border-b border-amber-200">
        <h3 className="font-semibold text-amber-800">12. OBSERVACIONES</h3>
      </div>
      <div className="p-4">
        <Textarea value={data.observaciones_generales} onChange={e => setField('observaciones_generales', e.target.value.slice(0, 500))} rows={4} placeholder="Observaciones..." />
        <p className="text-xs text-slate-500 mt-1">{data.observaciones_generales.length}/500</p>
      </div>
    </div>

    {/* Firmas */}
    <div className="border border-purple-200 rounded-lg overflow-hidden">
      <div className="bg-purple-50 px-4 py-2 border-b border-purple-200">
        <h3 className="font-semibold text-purple-800 flex items-center gap-2"><Pen className="w-4 h-4" />13. FIRMAS</h3>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <Label className="text-xs">Nombre Visitado</Label>
          <FastInput value={data.nombre_visitado} onChange={v => setField('nombre_visitado', v)} uppercase placeholder="NOMBRE DEL VISITADO" />
          <div className="h-16 border-2 border-dashed rounded mt-1 flex items-center justify-center text-slate-400 text-sm">
            Firma del visitado
          </div>
        </div>
        <div>
          <Label className="text-xs">Nombre Reconocedor</Label>
          <FastInput value={data.nombre_reconocedor} onChange={v => setField('nombre_reconocedor', v)} uppercase placeholder="NOMBRE DEL RECONOCEDOR" />
          <div className="h-16 border-2 border-dashed rounded mt-1 flex items-center justify-center text-slate-400 text-sm">
            Firma del reconocedor
          </div>
        </div>
      </div>
    </div>

    {/* Estado y servicios */}
    <div className="border border-blue-200 rounded-lg overflow-hidden">
      <div className="bg-blue-50 px-4 py-2 border-b border-blue-200">
        <h3 className="font-semibold text-blue-800">DATOS ADICIONALES</h3>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <Label className="text-xs mb-1 block">Estado del Predio</Label>
          <div className="flex flex-wrap gap-2">
            {['habitado','deshabitado','en_construccion','abandonado','lote_vacio','comercial'].map(e => (
              <label key={e} className="flex items-center gap-1 text-xs cursor-pointer">
                <input type="radio" checked={data.estado_predio === e} onChange={() => setField('estado_predio', e)} />
                {e.replace('_', ' ')}
              </label>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs mb-1 block">Servicios Públicos</Label>
          <div className="flex flex-wrap gap-2">
            {['Agua','Alcantarillado','Energía','Gas','Internet'].map(s => (
              <label key={s} className="flex items-center gap-1 text-xs cursor-pointer">
                <input type="checkbox" checked={data.servicios_publicos.includes(s)} onChange={e => {
                  if (e.target.checked) setField('servicios_publicos', [...data.servicios_publicos, s]);
                  else setField('servicios_publicos', data.servicios_publicos.filter(x => x !== s));
                }} />
                {s}
              </label>
            ))}
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={data.sin_cambios} onChange={e => setField('sin_cambios', e.target.checked)} />
            <span className="font-medium text-blue-800">Visitado sin cambios</span>
          </label>
        </div>
      </div>
    </div>
  </div>
));
Page5.displayName = 'Page5';

// Componente Principal
const VisitaFormModal = ({ 
  open, 
  onClose, 
  onSave, 
  predio, 
  proyecto,
  saving = false 
}) => {
  // Todo el estado es LOCAL - no afecta al padre
  const [pagina, setPagina] = useState(1);
  const [data, setData] = useState(getInitialVisitaData);
  const [construcciones, setConstrucciones] = useState(getInitialConstrucciones);
  const [calificaciones, setCalificaciones] = useState(getInitialCalificaciones);
  const [propietarios, setPropietarios] = useState(getInitialPropietarios);
  const [fotos, setFotos] = useState([]);

  // Resetear cuando se abre
  useEffect(() => {
    if (open && predio) {
      setData(prev => ({
        ...getInitialVisitaData(),
        direccion_visita: predio.direccion || '',
        destino_economico_visita: predio.destino_economico || '',
        area_base_catastral_m2: predio.area_terreno || predio.area_r1 || '',
        area_base_catastral_ha: predio.area_terreno ? (parseFloat(predio.area_terreno) / 10000).toFixed(4) : '',
        area_geografica_m2: predio.area_gdb || '',
        area_geografica_ha: predio.area_gdb ? (parseFloat(predio.area_gdb) / 10000).toFixed(4) : ''
      }));
      setPagina(1);
    }
  }, [open, predio]);

  const setField = useCallback((field, value) => {
    setData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleGuardar = useCallback(() => {
    if (!data.persona_atiende.trim()) {
      toast.error('Ingrese el nombre de la persona que atiende');
      return;
    }
    onSave({
      visitaData: data,
      construcciones,
      calificaciones,
      propietarios,
      fotos
    });
  }, [data, construcciones, calificaciones, propietarios, fotos, onSave]);

  const handleClose = useCallback(() => {
    if (data.persona_atiende) {
      if (!window.confirm('¿Cerrar sin guardar? Los cambios se perderán.')) return;
    }
    onClose();
  }, [data.persona_atiende, onClose]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2"><FileText className="w-5 h-5 text-emerald-600" />Formato de Visita</span>
            <Badge className="bg-emerald-100 text-emerald-700">{pagina}/5</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          {pagina === 1 && <Page1 data={data} setField={setField} predio={predio} proyecto={proyecto} />}
          {pagina === 2 && <Page2 data={data} setField={setField} propietarios={propietarios} setPropietarios={setPropietarios} />}
          {pagina === 3 && <Page3 construcciones={construcciones} setConstrucciones={setConstrucciones} calificaciones={calificaciones} setCalificaciones={setCalificaciones} />}
          {pagina === 4 && <Page4 data={data} setField={setField} />}
          {pagina === 5 && <Page5 data={data} setField={setField} fotos={fotos} setFotos={setFotos} />}
        </div>

        <DialogFooter className="flex justify-between items-center pt-4 border-t">
          <div className="flex gap-1">
            {[1,2,3,4,5].map(p => (
              <button key={p} onClick={() => setPagina(p)} className={`w-8 h-8 rounded-full text-sm font-medium transition ${pagina === p ? 'bg-emerald-600 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>{p}</button>
            ))}
          </div>
          <div className="flex gap-2">
            {pagina > 1 && <Button variant="outline" onClick={() => setPagina(p => p - 1)}><ChevronLeft className="w-4 h-4 mr-1" />Anterior</Button>}
            {pagina < 5 ? (
              <Button onClick={() => setPagina(p => p + 1)} className="bg-emerald-600 hover:bg-emerald-700">Siguiente<ChevronRight className="w-4 h-4 ml-1" /></Button>
            ) : (
              <Button onClick={handleGuardar} disabled={saving || !data.persona_atiende.trim()} className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Guardar
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default memo(VisitaFormModal);
