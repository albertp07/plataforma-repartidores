import { useState, useRef, useEffect, useId } from 'react';
import '../styles/select-personalizado.css';

/**
 * Select propio con el sistema de diseño de la app.
 * opciones: [{ value, label }]  ·  value: valor actual  ·  onChange(value)
 */
export default function SelectPersonalizado({ value, onChange, opciones, ariaLabel }) {
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const raiz = useRef(null);
  const idLista = useId();

  const indiceActual = Math.max(opciones.findIndex((o) => o.value === value), 0);
  const actual = opciones[indiceActual];

  useEffect(() => {
    if (!abierto) return undefined;
    const cerrarFuera = (e) => {
      if (raiz.current && !raiz.current.contains(e.target)) setAbierto(false);
    };
    document.addEventListener('mousedown', cerrarFuera);
    document.addEventListener('touchstart', cerrarFuera);
    return () => {
      document.removeEventListener('mousedown', cerrarFuera);
      document.removeEventListener('touchstart', cerrarFuera);
    };
  }, [abierto]);

  const abrir = () => {
    setActivo(indiceActual);
    setAbierto(true);
  };

  const elegir = (i) => {
    onChange(opciones[i].value);
    setAbierto(false);
  };

  const onKeyDown = (e) => {
    if (!abierto) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        abrir();
      }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActivo((a) => Math.min(a + 1, opciones.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(activo); }
    else if (e.key === 'Escape' || e.key === 'Tab') setAbierto(false);
  };

  return (
    <div className={`sel ${abierto ? 'sel-open' : ''}`} ref={raiz}>
      <button
        type="button"
        className="sel-trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={idLista}
        aria-label={ariaLabel}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        onKeyDown={onKeyDown}
      >
        <span className="sel-valor">{actual?.label}</span>
        <svg className="sel-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {abierto && (
        <ul className="sel-menu" role="listbox" id={idLista}>
          {opciones.map((o, i) => {
            const seleccionado = o.value === value;
            return (
              <li
                key={o.value}
                role="option"
                aria-selected={seleccionado}
                className={`sel-opcion ${seleccionado ? 'is-selected' : ''} ${i === activo ? 'is-active' : ''}`}
                onMouseEnter={() => setActivo(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(i)}
              >
                <span>{o.label}</span>
                {seleccionado && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
