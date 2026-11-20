import { useState, useEffect, useRef } from 'react';
import { formatoPeso } from '../utils/resumenSemanal';
import '../styles/meta-semanal.css';

// Meta de la semana: paquetes por día (configurable por el repartidor) × 5 días hábiles,
// expresada en monto. Solo considera ingresos de reparto de paquetes; retiros y gastos no influyen.
const PAQUETES_DIA_DEFAULT = 40;
const DIAS_META_SEMANA = 5;
const VALOR_PAQUETE_META = 1500;
const MAX_PAQUETES_DIA = 500;

// Rojo (hue 0) -> ámbar -> verde (hue 140) según el avance.
function colorAvance(porcentaje) {
  const hue = Math.round((Math.min(Math.max(porcentaje, 0), 100) / 100) * 140);
  return `hsl(${hue}, 72%, 40%)`;
}

// Recibe las transacciones de la semana que se está viendo (lunes a domingo).
function MetaSemanal({
  transacciones,
  rango,
  semanaPasada = false,
  paquetesPorDia = PAQUETES_DIA_DEFAULT,
  onGuardarMeta,
  onSemanaAnterior,
  onSemanaSiguiente,
  onVolverActual,
}) {
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorMeta, setErrorMeta] = useState('');
  const [barraFija, setBarraFija] = useState(false);
  const seccionRef = useRef(null);

  // Al bajar y salir de pantalla la tarjeta, deja fija arriba solo la barra (sin textos).
  useEffect(() => {
    const el = seccionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const observador = new IntersectionObserver(
      ([entrada]) => setBarraFija(!entrada.isIntersecting && entrada.boundingClientRect.top < 0),
      { threshold: 0 }
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const montoMeta = paquetesPorDia * DIAS_META_SEMANA * VALOR_PAQUETE_META;

  // Monto líquido (sin IVA) de los repartos de paquetes, tal como queda guardado en cada registro.
  const montoActual = transacciones.reduce((suma, t) => {
    if (t.tipo !== 'INGRESO' || t.sinActividad || t.categoriaIngreso !== 'PAQUETES') return suma;
    const bruto = Number(t.monto) || 0;
    const neto = t.montoLiquido != null ? Number(t.montoLiquido) : bruto / 1.19;
    return suma + neto;
  }, 0);

  const porcentaje = Math.min((montoActual / montoMeta) * 100, 100);
  const montoFaltante = Math.max(montoMeta - montoActual, 0);
  const paquetesFaltantes = Math.ceil(montoFaltante / VALOR_PAQUETE_META);
  const cumplida = montoActual >= montoMeta;
  const paquetesDeMas = Math.floor((montoActual - montoMeta) / VALOR_PAQUETE_META);
  const plural = (n) => `paquete${n === 1 ? '' : 's'}`;

  // Semana actual: lo que falta para llegar. Semana pasada: balance final de la semana.
  let textoEstado;
  if (semanaPasada) {
    if (!cumplida) textoEstado = `Te faltaron ${paquetesFaltantes} ${plural(paquetesFaltantes)}`;
    else if (paquetesDeMas > 0) textoEstado = `Hiciste ${paquetesDeMas} ${plural(paquetesDeMas)} de más`;
    else textoEstado = 'Cumpliste la meta justo';
  } else {
    textoEstado = cumplida ? '¡Meta cumplida!' : `Faltan ${paquetesFaltantes} ${plural(paquetesFaltantes)}`;
  }
  const color = colorAvance(porcentaje);

  const valorBorrador = Number(borrador);
  const borradorValido = Number.isInteger(valorBorrador) && valorBorrador >= 1 && valorBorrador <= MAX_PAQUETES_DIA;

  function abrirEdicion() {
    setBorrador(String(paquetesPorDia));
    setErrorMeta('');
    setEditando(true);
  }

  async function guardar(e) {
    e.preventDefault();
    if (!borradorValido) {
      setErrorMeta(`Ingresa un número entero entre 1 y ${MAX_PAQUETES_DIA}`);
      return;
    }
    setGuardando(true);
    setErrorMeta('');
    try {
      await onGuardarMeta(valorBorrador);
      setEditando(false);
    } catch (err) {
      setErrorMeta(err.response?.data?.error || 'No se pudo guardar la meta');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
    {barraFija && (
      <div className="meta-sticky" aria-hidden="true">
        <div className="meta-sticky-fill" style={{ width: `${porcentaje}%`, background: color }} />
      </div>
    )}
    <section className="meta" aria-label="Meta de la semana" ref={seccionRef}>
      <div className="meta-head">
        <div>
          <p className="meta-title">{semanaPasada ? 'Meta de la semana (historial)' : 'Meta de la semana'}</p>
          {onSemanaAnterior ? (
            <div className="meta-nav">
              <button type="button" className="week-nav-btn" onClick={onSemanaAnterior} aria-label="Semana anterior">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <span className="meta-sub meta-nav-rango">{rango}</span>
              <button
                type="button"
                className="week-nav-btn"
                onClick={onSemanaSiguiente}
                disabled={!semanaPasada}
                aria-label="Semana siguiente"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
              {semanaPasada && onVolverActual && (
                <button type="button" className="meta-edit" onClick={onVolverActual}>Ir a esta semana</button>
              )}
            </div>
          ) : (
            rango && <p className="meta-sub">{rango}</p>
          )}
        </div>
        <div className="meta-head-right">
          <p className="meta-pct" style={{ color }}>{Math.round(porcentaje)}%</p>
          {onGuardarMeta && !editando && !semanaPasada && (
            <button type="button" className="meta-edit" onClick={abrirEdicion} aria-label="Editar meta">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              Editar meta
            </button>
          )}
        </div>
      </div>

      {editando && (
        <form className="meta-form" onSubmit={guardar}>
          <label className="meta-form-label" htmlFor="meta-paquetes-dia">Paquetes por día</label>
          <div className="meta-form-row">
            <input
              id="meta-paquetes-dia"
              className="meta-input"
              type="number"
              inputMode="numeric"
              min="1"
              max={MAX_PAQUETES_DIA}
              step="1"
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn-primary meta-btn" disabled={guardando || !borradorValido}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
            <button type="button" className="btn-ghost meta-btn" onClick={() => setEditando(false)} disabled={guardando}>
              Cancelar
            </button>
          </div>
          <p className="meta-form-hint">
            {borradorValido
              ? `Meta semanal: $${formatoPeso(valorBorrador * DIAS_META_SEMANA * VALOR_PAQUETE_META)} (${valorBorrador * DIAS_META_SEMANA} paquetes, lunes a viernes)`
              : `Ingresa un número entre 1 y ${MAX_PAQUETES_DIA}`}
          </p>
          {errorMeta && <p className="form-error">{errorMeta}</p>}
        </form>
      )}

      <div
        className="meta-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(porcentaje)}
        aria-label="Avance de la meta semanal"
      >
        <div className="meta-fill" style={{ width: `${porcentaje}%`, background: color }} />
      </div>

      <div className="meta-foot">
        <span className="meta-montos">
          <strong style={{ color }}>${formatoPeso(montoActual)}</strong>
          <span> de ${formatoPeso(montoMeta)}</span>
        </span>
        <span className={cumplida ? 'meta-faltan meta-ok' : 'meta-faltan'}>
          {textoEstado}
        </span>
      </div>
    </section>
    </>
  );
}

export default MetaSemanal;
