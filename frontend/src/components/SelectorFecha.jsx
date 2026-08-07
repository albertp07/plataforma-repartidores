import { useState, useRef, useEffect } from 'react';

const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function formatearEntradaFecha(valor) {
  const digits = valor.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

function parseDDMMYYYY(texto) {
  const match = (texto || '').match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const fecha = new Date(Number(y), Number(m) - 1, Number(d));
  if (
    fecha.getFullYear() !== Number(y) ||
    fecha.getMonth() !== Number(m) - 1 ||
    fecha.getDate() !== Number(d)
  ) {
    return null;
  }
  return fecha;
}

function formatoDDMMYYYY(fecha) {
  const d = String(fecha.getDate()).padStart(2, '0');
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const y = fecha.getFullYear();
  return `${d}-${m}-${y}`;
}

function mismoDia(a, b) {
  return !!a && !!b
    && a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function SelectorFecha({ value, onChange, id, maxDate, required }) {
  const [abierto, setAbierto] = useState(false);
  const fechaValida = parseDDMMYYYY(value);
  const [mesVisible, setMesVisible] = useState(() => fechaValida || new Date());
  const contenedorRef = useRef(null);

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = maxDate || hoy;

  function abrirPopover() {
    setMesVisible(fechaValida || new Date());
    setAbierto(true);
  }

  useEffect(() => {
    function handleClickFuera(e) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) {
        setAbierto(false);
      }
    }
    function handleEscape(e) {
      if (e.key === 'Escape') setAbierto(false);
    }
    document.addEventListener('mousedown', handleClickFuera);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickFuera);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  function handleInputChange(e) {
    onChange(formatearEntradaFecha(e.target.value));
  }

  function handleSeleccionarDia(dia) {
    if (dia > limite) return;
    onChange(formatoDDMMYYYY(dia));
    setAbierto(false);
  }

  function cambiarMes(delta) {
    setMesVisible((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  const primerDiaMes = new Date(mesVisible.getFullYear(), mesVisible.getMonth(), 1);
  const diasEnMes = new Date(mesVisible.getFullYear(), mesVisible.getMonth() + 1, 0).getDate();
  const offsetInicio = (primerDiaMes.getDay() + 6) % 7; // lunes = 0

  const celdas = [];
  for (let i = 0; i < offsetInicio; i++) celdas.push(null);
  for (let dia = 1; dia <= diasEnMes; dia++) {
    celdas.push(new Date(mesVisible.getFullYear(), mesVisible.getMonth(), dia));
  }

  return (
    <div className="date-field" ref={contenedorRef}>
      <div className="date-input-wrap">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          placeholder="DD-MM-AAAA"
          value={value}
          onChange={handleInputChange}
          onFocus={abrirPopover}
          maxLength={10}
          required={required}
        />
        <button
          type="button"
          className="date-toggle"
          onClick={() => (abierto ? setAbierto(false) : abrirPopover())}
          aria-label="Abrir calendario"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4" />
            <path d="M8 2v4" />
            <path d="M3 10h18" />
          </svg>
        </button>
      </div>

      {abierto && (
        <div className="date-popover">
          <div className="date-popover-header">
            <button type="button" className="date-nav" onClick={() => cambiarMes(-1)} aria-label="Mes anterior">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span className="date-popover-label">
              {MESES[mesVisible.getMonth()]} {mesVisible.getFullYear()}
            </span>
            <button type="button" className="date-nav" onClick={() => cambiarMes(1)} aria-label="Mes siguiente">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          <div className="date-grid date-grid-weekdays">
            {DIAS_SEMANA.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>

          <div className="date-grid">
            {celdas.map((dia, i) => {
              if (!dia) return <span key={i} />;
              const deshabilitado = dia > limite;
              const seleccionado = mismoDia(dia, fechaValida);
              const esHoy = mismoDia(dia, hoy);
              return (
                <button
                  type="button"
                  key={i}
                  className={`date-day ${seleccionado ? 'selected' : ''} ${esHoy && !seleccionado ? 'today' : ''}`}
                  disabled={deshabilitado}
                  onClick={() => handleSeleccionarDia(dia)}
                >
                  {dia.getDate()}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="date-today-btn"
            onClick={() => handleSeleccionarDia(hoy)}
            disabled={hoy > limite}
          >
            Hoy
          </button>
        </div>
      )}
    </div>
  );
}

export default SelectorFecha;
