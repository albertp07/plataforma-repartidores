import { useEffect, useRef, useState } from 'react';
import AnimacionPapelera from './AnimacionPapelera';

const DURACION_PAPELERA_MS = 1600; // igual que la duración en animacion-papelera.css

function ModalConfirmar({
  visible,
  titulo,
  mensaje,
  onConfirmar,
  onCancelar,
  cargando,
  textoConfirmar = 'Sí, eliminar',
  textoConfirmando = 'Eliminando...',
  claseConfirmar = 'btn-danger',
  animacionPapelera = false, // true: muestra el documento cayendo a la papelera al confirmar
}) {
  const [animando, setAnimando] = useState(false);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  if (!visible) return null;

  async function handleConfirmar() {
    if (!animacionPapelera) {
      onConfirmar();
      return;
    }
    const sinMovimiento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setAnimando(true);
    if (!sinMovimiento) {
      await new Promise((resolver) => setTimeout(resolver, DURACION_PAPELERA_MS));
    }
    try {
      await onConfirmar(); // la eliminación real ocurre cuando termina la animación
    } finally {
      if (montado.current) setAnimando(false); // si falló, el modal vuelve a su estado normal
    }
  }

  const ocupado = cargando || animando;

  return (
    <div className="modal-overlay" onClick={ocupado ? undefined : onCancelar}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        {animando ? (
          <AnimacionPapelera texto={cargando ? textoConfirmando : 'Moviendo a la papelera...'} />
        ) : (
          <>
            <h3 className="modal-title">{titulo}</h3>
            <p className="modal-message">{mensaje}</p>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={onCancelar} disabled={ocupado}>
                Cancelar
              </button>
              <button className={claseConfirmar} onClick={handleConfirmar} disabled={ocupado}>
                {cargando ? textoConfirmando : textoConfirmar}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ModalConfirmar;
