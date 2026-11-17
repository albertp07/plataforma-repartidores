import { useState, useEffect, useRef } from 'react';
import { formatoPeso } from '../utils/resumenSemanal';
import '../styles/meta-semanal.css';

// Meta del mes (vista Administrador): suma, por cada repartidor con movimientos en el mes,
// sus paquetes por día × los días hábiles (lunes a viernes) del mes × valor del paquete.
// Solo considera ingresos de reparto de paquetes; retiros y gastos no influyen.
const PAQUETES_DIA_DEFAULT = 40;
const VALOR_PAQUETE_META = 1500;

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// Rojo (hue 0) -> ámbar -> verde (hue 140) según el avance.
function colorAvance(porcentaje) {
  const hue = Math.round((Math.min(Math.max(porcentaje, 0), 100) / 100) * 140);
  return `hsl(${hue}, 72%, 40%)`;
}

// Cuenta los días de lunes a viernes de un mes (mes base 0).
export function diasHabilesDelMes(anio, mes) {
  const total = new Date(anio, mes + 1, 0).getDate();
  let cuenta = 0;
  for (let d = 1; d <= total; d += 1) {
    const dia = new Date(anio, mes, d).getDay();
    if (dia !== 0 && dia !== 6) cuenta += 1;
  }
  return cuenta;
}

// Recibe las transacciones del mes que se está viendo (con el repartidor incluido en cada una).
function MetaMensual({ transacciones, anio, mes, mesPasado = false }) {
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

  const diasHabiles = diasHabilesDelMes(anio, mes);

  // Meta diaria combinada de los repartidores que tuvieron movimientos en el mes.
  const metasPorRepartidor = new Map();
  transacciones.forEach((t) => {
    if (!metasPorRepartidor.has(t.repartidorId)) {
      metasPorRepartidor.set(t.repartidorId, t.repartidor?.metaPaquetesDia ?? PAQUETES_DIA_DEFAULT);
    }
  });
  const paquetesDiaTotal = [...metasPorRepartidor.values()].reduce((suma, v) => suma + v, 0);
  const montoMeta = paquetesDiaTotal * diasHabiles * VALOR_PAQUETE_META;

  // Monto líquido (sin IVA) de los repartos de paquetes, tal como queda guardado en cada registro.
  const montoActual = transacciones.reduce((suma, t) => {
    if (t.tipo !== 'INGRESO' || t.sinActividad || t.categoriaIngreso !== 'PAQUETES') return suma;
    const bruto = Number(t.monto) || 0;
    const neto = t.montoLiquido != null ? Number(t.montoLiquido) : bruto / 1.19;
    return suma + neto;
  }, 0);

  const sinMeta = montoMeta <= 0;
  const porcentaje = sinMeta ? 0 : Math.min((montoActual / montoMeta) * 100, 100);
  const montoFaltante = Math.max(montoMeta - montoActual, 0);
  const paquetesFaltantes = Math.ceil(montoFaltante / VALOR_PAQUETE_META);
  const cumplida = !sinMeta && montoActual >= montoMeta;
  const paquetesDeMas = Math.floor((montoActual - montoMeta) / VALOR_PAQUETE_META);
  const plural = (n) => `paquete${n === 1 ? '' : 's'}`;

  // Mes actual: lo que falta para llegar. Mes pasado: balance final del mes.
  let textoEstado;
  if (sinMeta) {
    textoEstado = 'Sin repartidores con actividad este mes';
  } else if (mesPasado) {
    if (!cumplida) textoEstado = `Faltaron ${paquetesFaltantes} ${plural(paquetesFaltantes)}`;
    else if (paquetesDeMas > 0) textoEstado = `Se hicieron ${paquetesDeMas} ${plural(paquetesDeMas)} de más`;
    else textoEstado = 'Se cumplió la meta justo';
  } else {
    textoEstado = cumplida ? '¡Meta cumplida!' : `Faltan ${paquetesFaltantes} ${plural(paquetesFaltantes)}`;
  }
  const color = colorAvance(porcentaje);
  const nombreMes = `${MESES[mes].charAt(0).toUpperCase()}${MESES[mes].slice(1)} ${anio}`;
  const nRepartidores = metasPorRepartidor.size;

  return (
    <>
    {barraFija && (
      <div className="meta-sticky" aria-hidden="true">
        <div className="meta-sticky-fill" style={{ width: `${porcentaje}%`, background: color }} />
      </div>
    )}
    <section className="meta" aria-label="Meta del mes" ref={seccionRef}>
      <div className="meta-head">
        <div>
          <p className="meta-title">Meta del mes</p>
          <p className="meta-sub">
            {nombreMes} · {diasHabiles} días hábiles · {nRepartidores} {nRepartidores === 1 ? 'repartidor' : 'repartidores'}
          </p>
        </div>
        <div className="meta-head-right">
          <p className="meta-pct" style={{ color }}>{Math.round(porcentaje)}%</p>
        </div>
      </div>

      <div
        className="meta-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(porcentaje)}
        aria-label="Avance de la meta mensual"
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

export default MetaMensual;
