import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import { Download, Loader2, AlertTriangle } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Componente para ver y exportar predios eliminados
 * 
 * @param {string} municipio - Filtrar por municipio específico
 */
function PrediosEliminadosView({ municipio }) {
  const [prediosEliminados, setPrediosEliminados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const fetchEliminados = async () => {
      try {
        const token = localStorage.getItem('token');
        const params = new URLSearchParams();
        if (municipio) params.append('municipio', municipio);
        
        const response = await axios.get(`${API}/predios/eliminados?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPrediosEliminados(response.data.predios || response.data || []);
      } catch (error) {
        console.error('Error loading eliminated predios:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchEliminados();
  }, [municipio]);

  const handleDownloadExcel = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (municipio) params.append('municipio', municipio);
      
      const response = await axios.get(`${API}/predios/eliminados/exportar-excel?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `predios_eliminados_${municipio || 'todos'}_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Excel descargado correctamente');
    } catch (error) {
      toast.error('Error al descargar Excel');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8" data-testid="predios-eliminados-loading">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
      </div>
    );
  }

  if (prediosEliminados.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500" data-testid="predios-eliminados-empty">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p>No hay predios eliminados para {municipio || 'este filtro'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="predios-eliminados-view">
      <div className="flex items-center justify-between">
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex-1">
          <p className="text-sm text-red-800">
            <strong>{prediosEliminados.length}</strong> predios fueron eliminados en {municipio || 'todos los municipios'}
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="ml-3 border-emerald-500 text-emerald-700"
          onClick={handleDownloadExcel}
          disabled={downloading}
          data-testid="export-excel-btn"
        >
          {downloading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
          Exportar Excel
        </Button>
      </div>
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 sticky top-0">
            <tr>
              <th className="text-left py-2 px-3">Código Predial</th>
              <th className="text-left py-2 px-3">Propietario</th>
              <th className="text-left py-2 px-3">Dirección</th>
              <th className="text-right py-2 px-3">Avalúo</th>
              <th className="text-left py-2 px-3">Radicado</th>
              <th className="text-left py-2 px-3">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {prediosEliminados.map((predio, idx) => (
              <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-2 px-3 font-mono text-xs">{predio.codigo_predial_nacional}</td>
                <td className="py-2 px-3">{predio.propietarios?.[0]?.nombre_propietario || 'N/A'}</td>
                <td className="py-2 px-3">{predio.direccion}</td>
                <td className="py-2 px-3 text-right">${(predio.avaluo || 0).toLocaleString()}</td>
                <td className="py-2 px-3 text-emerald-700 font-medium">{predio.radicado_eliminacion || '-'}</td>
                <td className="py-2 px-3 text-slate-500 text-xs">{predio.eliminado_en?.split('T')[0] || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PrediosEliminadosView;
