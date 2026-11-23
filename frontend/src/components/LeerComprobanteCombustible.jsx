import { useRef, useState } from 'react';
import { analizarComprobanteCombustible } from '../services/capturaService';
import '../styles/comprobante-combustible.css';

// Botón "Leer desde foto": sube el screenshot del comprobante y entrega el borrador al formulario.
export default function LeerComprobanteCombustible({ onLeido, disabled }) {
  const inputRef = useRef(null);
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState('');
  const [advertencias, setAdvertencias] = useState([]);
  const [ok, setOk] = useState(false);

  async function handleArchivo(e) {
    const archivo = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir la misma imagen
    if (!archivo) return;

    setError('');
    setAdvertencias([]);
    setOk(false);
    setLeyendo(true);
    try {
      const { borrador, advertencias: avisos } = await analizarComprobanteCombustible(archivo);
      onLeido(borrador);
      setAdvertencias(avisos || []);
      setOk(true);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo leer la imagen. Intenta con una captura más nítida.');
    } finally {
      setLeyendo(false);
    }
  }

  return (
    <div className="comprobante-lector">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleArchivo}
        hidden
      />
      <button
        type="button"
        className="btn-ghost comprobante-btn"
        onClick={() => inputRef.current?.click()}
        disabled={leyendo || disabled}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        {leyendo ? 'Leyendo comprobante…' : 'Leer desde foto del comprobante'}
      </button>

      {error && <p className="form-error">{error}</p>}
      {ok && !error && (
        <p className="comprobante-ok">Datos cargados. Revísalos antes de registrar.</p>
      )}
      {advertencias.map((a) => <p key={a} className="captura-warn">⚠ {a}</p>)}
    </div>
  );
}
