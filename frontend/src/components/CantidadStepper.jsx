import { useRef, useEffect, useState } from 'react';

// Contador con dígitos tipo rodillo: cada columna desliza verticalmente hasta su dígito.
// Las columnas se identifican por su posición desde la derecha (unidades, decenas...),
// así al cambiar el valor solo se animan los dígitos que cambian.
function ContadorAnimado({ valor, placeholder }) {
  const hayValor = valor !== '';
  const texto = hayValor ? String(Number(valor)) : placeholder;
  const digitos = texto.split('');

  return (
    <span className={`contador ${hayValor ? '' : 'vacio'}`} aria-hidden="true">
      {digitos.map((d, i) => {
        const posDesdeDerecha = digitos.length - 1 - i;
        return (
          <span className="contador-col" key={posDesdeDerecha}>
            <span className="contador-tira" style={{ '--d': Number(d) }}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <span key={n}>{n}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

// Campo numérico tipo POS: botones -/+ con el valor animado en el centro.
// - Tocar el número lo vuelve editable (teclado numérico).
// - Mantener presionado -/+ repite el cambio (acelera tras unos pasos).
function CantidadStepper({ value, onChange, max = 9999, placeholder = '0', required = false, id, ariaLabel }) {
  const timerRef = useRef(null);
  const pasosRef = useRef(0);
  const valorRef = useRef(value);
  const [editando, setEditando] = useState(false);

  function limpiar() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pasosRef.current = 0;
  }

  useEffect(() => {
    valorRef.current = value;
  }, [value]);

  useEffect(() => limpiar, []);

  function cambiar(delta) {
    const actual = Number(valorRef.current) || 0;
    const siguiente = Math.min(Math.max(actual + delta, 0), max);
    onChange(String(siguiente));
    valorRef.current = String(siguiente);
  }

  function iniciar(delta) {
    limpiar();
    cambiar(delta);
    const repetir = () => {
      pasosRef.current += 1;
      cambiar(delta);
      const espera = pasosRef.current > 8 ? 40 : 110;
      timerRef.current = setTimeout(repetir, espera);
    };
    timerRef.current = setTimeout(repetir, 420);
  }

  const actual = Number(value) || 0;

  return (
    <div className="stepper">
      <button
        type="button"
        className="stepper-btn"
        aria-label="Restar uno"
        disabled={actual <= 0}
        onPointerDown={(e) => { e.preventDefault(); iniciar(-1); }}
        onPointerUp={limpiar}
        onPointerLeave={limpiar}
        onPointerCancel={limpiar}
        onContextMenu={(e) => e.preventDefault()}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true">
          <path d="M5 12h14" />
        </svg>
      </button>

      <div className={`stepper-valor ${editando ? 'editando' : ''}`}>
        <input
          id={id}
          className="stepper-input"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          aria-label={ariaLabel}
          value={value}
          placeholder={placeholder}
          required={required}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, String(max).length))}
          onFocus={(e) => { setEditando(true); e.target.select(); }}
          onBlur={() => setEditando(false)}
        />
        {!editando && <ContadorAnimado valor={value} placeholder={placeholder} />}
      </div>

      <button
        type="button"
        className="stepper-btn"
        aria-label="Sumar uno"
        disabled={actual >= max}
        onPointerDown={(e) => { e.preventDefault(); iniciar(1); }}
        onPointerUp={limpiar}
        onPointerLeave={limpiar}
        onPointerCancel={limpiar}
        onContextMenu={(e) => e.preventDefault()}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
}

export default CantidadStepper;
