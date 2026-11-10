import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import '../styles/password-input.css';

// Máximo de retraso entre caracteres y tope total del efecto "ola".
const PASO_MS = 45;
const TOPE_MS = 450;

/**
 * Input de contraseña con animación de revelado:
 * - El <input> real conserva el texto (transparente) para caret, selección,
 *   autocompletado y gestores de contraseñas.
 * - Un overlay dibuja cada carácter como una carta que gira en 3D entre el
 *   carácter real y el punto "•", con retraso escalonado.
 * - El ojo SVG abre y cierra los párpados (abierto = contraseña visible).
 * API compatible con el input anterior: acepta value/onChange/className/etc.
 */
function PasswordInput({ className = '', value, defaultValue = '', onChange, ...props }) {
  const [visible, setVisible] = useState(false);
  const [interno, setInterno] = useState(String(defaultValue ?? ''));
  const texto = String(value ?? interno);

  const campoRef = useRef(null);
  const overlayRef = useRef(null);
  const pistaRef = useRef(null);

  const sincronizarScroll = useCallback(() => {
    const campo = campoRef.current;
    const pista = pistaRef.current;
    if (campo && pista) pista.style.transform = `translateX(${-campo.scrollLeft}px)`;
  }, []);

  // Copia tipografía y padding del input real para que el overlay calce
  // exacto sin importar el contenedor (login, modal, etc.).
  const copiarEstilos = useCallback(() => {
    const campo = campoRef.current;
    const overlay = overlayRef.current;
    if (!campo || !overlay) return;
    const cs = getComputedStyle(campo);
    overlay.style.paddingLeft = `${(parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.borderLeftWidth) || 0)}px`;
    overlay.style.paddingRight = `${(parseFloat(cs.paddingRight) || 0) + (parseFloat(cs.borderRightWidth) || 0)}px`;
    overlay.style.color = cs.color;
    overlay.style.fontFamily = cs.fontFamily;
    overlay.style.fontSize = cs.fontSize;
    overlay.style.fontWeight = cs.fontWeight;
    overlay.style.letterSpacing = cs.letterSpacing;
    overlay.style.lineHeight = cs.lineHeight;
  }, []);

  useLayoutEffect(() => {
    copiarEstilos();
    sincronizarScroll();
  }, [texto, visible, copiarEstilos, sincronizarScroll]);

  // El scroll interno del input cambia después de teclear/mover el caret,
  // por eso se sincroniza en el siguiente frame.
  useEffect(() => {
    const campo = campoRef.current;
    if (!campo) return undefined;

    let raf = 0;
    const programar = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(sincronizarScroll);
    };
    const alEnfocar = () => {
      copiarEstilos();
      programar();
    };

    campo.addEventListener('scroll', sincronizarScroll, { passive: true });
    ['input', 'keydown', 'keyup', 'select', 'click'].forEach((ev) => campo.addEventListener(ev, programar));
    campo.addEventListener('focus', alEnfocar);

    const observador = new ResizeObserver(() => {
      copiarEstilos();
      programar();
    });
    observador.observe(campo);

    return () => {
      cancelAnimationFrame(raf);
      campo.removeEventListener('scroll', sincronizarScroll);
      ['input', 'keydown', 'keyup', 'select', 'click'].forEach((ev) => campo.removeEventListener(ev, programar));
      campo.removeEventListener('focus', alEnfocar);
      observador.disconnect();
    };
  }, [copiarEstilos, sincronizarScroll]);

  const manejarCambio = (e) => {
    setInterno(e.target.value);
    if (onChange) onChange(e);
  };

  const caracteres = Array.from(texto);
  const paso = Math.min(PASO_MS, TOPE_MS / Math.max(caracteres.length, 1));

  return (
    <span className="password-field">
      <input
        {...props}
        ref={campoRef}
        value={texto}
        onChange={manejarCambio}
        type={visible ? 'text' : 'password'}
        className={`password-field-input ${className}`.trim()}
        spellCheck={false}
      />

      <span className="pw-overlay" ref={overlayRef} aria-hidden="true">
        <span className="pw-clip">
          <span className="pw-track" ref={pistaRef}>
            {caracteres.map((c, i) => (
              <span
                key={i}
                className="pw-char"
                data-visible={visible}
                style={{ '--d': `${Math.round(i * paso)}ms` }}
              >
                <span className="pw-face pw-front">{c === ' ' ? ' ' : c}</span>
                <span className="pw-face pw-back">•</span>
              </span>
            ))}
          </span>
        </span>
      </span>

      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path className="pw-eye-lid-top" d="M1 12s4-8 11-8 11 8 11 8" />
          <path className="pw-eye-lid-bottom" d="M1 12s4 8 11 8 11-8 11-8" />
          <circle className="pw-eye-pupil" cx="12" cy="12" r="3" />
          <g className="pw-eye-lashes">
            <line x1="12" y1="15.5" x2="12" y2="18.5" />
            <line x1="6.5" y1="14.5" x2="5" y2="17.2" />
            <line x1="17.5" y1="14.5" x2="19" y2="17.2" />
          </g>
        </svg>
      </button>
    </span>
  );
}

export default PasswordInput;
