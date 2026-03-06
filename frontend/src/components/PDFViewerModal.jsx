import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Download, X, Printer, Mail, ExternalLink, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Componente para visualizar PDFs en un popup/modal
 * Con opciones de descarga, impresión y envío por correo
 */
export default function PDFViewerModal({ 
  isOpen, 
  onClose, 
  pdfUrl, 
  title = "Vista Previa del Documento",
  fileName = "documento.pdf",
  showEmailOption = false,
  onSendEmail = null,
  emailSent = false
}) {
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Descargar PDF
  const handleDownload = async () => {
    try {
      const response = await fetch(pdfUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('PDF descargado correctamente');
    } catch (error) {
      console.error('Error descargando PDF:', error);
      toast.error('Error al descargar el PDF');
    }
  };

  // Imprimir PDF
  const handlePrint = () => {
    const printWindow = window.open(pdfUrl, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  // Abrir en nueva pestaña
  const handleOpenInNewTab = () => {
    window.open(pdfUrl, '_blank');
  };

  // Enviar por correo
  const handleSendEmail = async () => {
    if (!onSendEmail) return;
    
    setSendingEmail(true);
    try {
      await onSendEmail();
      toast.success('PDF enviado por correo correctamente');
    } catch (error) {
      toast.error('Error al enviar el correo');
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] flex flex-col" data-testid="pdf-viewer-modal">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <span>{title}</span>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        {/* Contenedor del PDF */}
        <div className="flex-1 min-h-0 relative bg-slate-100 rounded-lg overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                <span className="text-sm text-slate-600">Cargando documento...</span>
              </div>
            </div>
          )}
          <iframe
            src={`${pdfUrl}#toolbar=1&navpanes=0`}
            className="w-full h-full min-h-[60vh]"
            title="Vista previa del PDF"
            onLoad={() => setLoading(false)}
            onError={() => setLoading(false)}
            style={{ border: 'none' }}
          />
        </div>

        {/* Botones de acción */}
        <DialogFooter className="flex-shrink-0 flex flex-wrap gap-2 justify-between sm:justify-end">
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleOpenInNewTab}
              data-testid="pdf-open-new-tab"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Abrir en pestaña
            </Button>
            <Button 
              variant="outline" 
              onClick={handlePrint}
              data-testid="pdf-print-btn"
            >
              <Printer className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
          </div>
          
          <div className="flex gap-2">
            {showEmailOption && onSendEmail && (
              <Button 
                variant="outline"
                onClick={handleSendEmail}
                disabled={sendingEmail || emailSent}
                className={emailSent ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : ''}
                data-testid="pdf-send-email-btn"
              >
                {sendingEmail ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : emailSent ? (
                  <CheckCircle className="w-4 h-4 mr-2" />
                ) : (
                  <Mail className="w-4 h-4 mr-2" />
                )}
                {emailSent ? 'Correo enviado' : 'Enviar por correo'}
              </Button>
            )}
            <Button 
              onClick={handleDownload}
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="pdf-download-btn"
            >
              <Download className="w-4 h-4 mr-2" />
              Descargar PDF
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
