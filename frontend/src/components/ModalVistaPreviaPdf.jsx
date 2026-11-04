import { useEffect, useState } from 'react';
import '../styles/vista-previa-pdf.css';

function ModalVistaPreviaPdf({ vistaPrevia, onCerrar }) {
  const [urlPdf, setUrlPdf] = useState(null);

  // Crea una URL temporal del PDF para mostrarlo y la libera al cerrar
  useEffect(() => {
    if (!vistaPrevia) {
      setUrlPdf(null);
      return undefined;
    }
    const url = URL.createObjectURL(vistaPrevia.doc.output('blob'));
    setUrlPdf(url);
    return () => URL.revokeObjectURL(url);
  }, [vistaPrevia]);

  // Cerrar con Escape
  useEffect(() => {
    if (!vistaPrevia) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [vistaPrevia, onCerrar]);

  if (!vistaPrevia) return null;

  function handleDescargar() {
    vistaPrevia.doc.save(vistaPrevia.nombreArchivo);
    onCerrar();
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="pdf-preview-box" onClick={(e) => e.stopPropagation()}>
        <div className="pdf-preview-head">
          <h3 className="modal-title" style={{ margin: 0 }}>Vista previa del PDF</h3>
          <span className="pdf-preview-name">{vistaPrevia.nombreArchivo}</span>
        </div>

        <div className="pdf-preview-body">
          {urlPdf && (
            <iframe
              className="pdf-preview-frame"
              src={urlPdf}
              title="Vista previa del reporte PDF"
            />
          )}
        </div>

        <div className="modal-actions">
          {urlPdf && (
            <a className="btn-ghost pdf-preview-link" href={urlPdf} target="_blank" rel="noreferrer">
              Abrir en pestaña nueva
            </a>
          )}
          <button type="button" className="btn-ghost" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleDescargar}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v12" />
              <path d="M7 11l5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
            Descargar PDF
          </button>
        </div>
      </div>
    </div>
  );
}

export default ModalVistaPreviaPdf;
