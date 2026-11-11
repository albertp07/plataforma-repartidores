import { useEffect, useRef, useState } from 'react';
import '../styles/vista-previa-pdf.css';

const DURACION_DESCARGA_MS = 900; // tiempo del anillo de progreso
const DURACION_CHECK_MS = 1400;   // tiempo que se ve el check antes de cerrar

function IconoDescarga({ estado }) {
  if (estado === 'descargando') {
    return (
      <svg className="dl-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className="dl-ring-bg" cx="12" cy="12" r="9" strokeWidth="2.5" />
        <circle className="dl-ring-progress" cx="12" cy="12" r="9" strokeWidth="2.5" strokeLinecap="round" pathLength="100" />
        <path className="dl-arrow" d="M12 7v7M9 11.5l3 3 3-3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (estado === 'listo') {
    return (
      <svg className="dl-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className="dl-ok-ring" cx="12" cy="12" r="9" strokeWidth="2.5" pathLength="100" />
        <path className="dl-ok-check" d="M7.5 12.5l3 3 6-6.5" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" pathLength="100" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="M7 11l5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function ModalVistaPreviaPdf({ vistaPrevia, onCerrar }) {
  const [urlPdf, setUrlPdf] = useState(null);
  const [estado, setEstado] = useState('inactivo'); // inactivo | descargando | listo
  const timers = useRef([]);

  function limpiarTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  // Crea una URL temporal del PDF para mostrarlo y la libera al cerrar
  useEffect(() => {
    if (!vistaPrevia) {
      setUrlPdf(null);
      return undefined;
    }
    setEstado('inactivo');
    const url = URL.createObjectURL(vistaPrevia.doc.output('blob'));
    setUrlPdf(url);
    return () => URL.revokeObjectURL(url);
  }, [vistaPrevia]);

  // Limpia los temporizadores al desmontar
  useEffect(() => limpiarTimers, []);

  // Cerrar con Escape
  useEffect(() => {
    if (!vistaPrevia) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [vistaPrevia, onCerrar]);

  if (!vistaPrevia) return null;

  function handleDescargar() {
    if (estado !== 'inactivo') return;
    setEstado('descargando');
    try {
      vistaPrevia.doc.save(vistaPrevia.nombreArchivo);
    } catch (err) {
      console.error('Error al descargar el PDF', err);
      setEstado('inactivo');
      return;
    }
    timers.current.push(setTimeout(() => setEstado('listo'), DURACION_DESCARGA_MS));
    timers.current.push(setTimeout(() => {
      onCerrar();
    }, DURACION_DESCARGA_MS + DURACION_CHECK_MS));
  }

  const ocupado = estado !== 'inactivo';
  const textoBoton = estado === 'descargando' ? 'Descargando...' : estado === 'listo' ? '¡Descargado!' : 'Descargar PDF';

  return (
    <div className="modal-overlay" onClick={ocupado ? undefined : onCerrar}>
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
          <button type="button" className="btn-ghost" onClick={onCerrar} disabled={ocupado}>
            Cancelar
          </button>
          <button
            type="button"
            className={`btn-primary btn-descarga btn-descarga--${estado}`}
            onClick={handleDescargar}
            disabled={ocupado}
            aria-live="polite"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <IconoDescarga estado={estado} />
            {textoBoton}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ModalVistaPreviaPdf;
