import { useState, useMemo } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import { agruparPorSemana } from '../utils/rankingSemanas';
import { formatoPeso } from '../utils/resumenSemanal';
import '../styles/ranking-semanas.css';

const CRITERIOS = [
  { id: 'ingresos', label: 'Ingresos' },
  { id: 'gastos', label: 'Gastos' },
  { id: 'balance', label: 'Balance' },
  { id: 'reciente', label: 'Más reciente' },
];

const EASE = [0.4, 0, 0.2, 1];

const LIMITES = [
  { id: 5, label: 'Top 5' },
  { id: 10, label: 'Top 10' },
  { id: 0, label: 'Todas' },
];

// Ranking de semanas calculado en el navegador con los movimientos ya cargados: no consume la API de IA.
function RankingSemanas({ transacciones, onSeleccionarSemana }) {
  const [abierto, setAbierto] = useState(false);
  const [criterio, setCriterio] = useState('ingresos');
  const [mayorPrimero, setMayorPrimero] = useState(true);
  const [limite, setLimite] = useState(5);

  const semanas = useMemo(() => agruparPorSemana(transacciones), [transacciones]);

  const ordenadas = useMemo(() => {
    const clave = criterio === 'reciente' ? 'clave' : criterio;
    const lista = [...semanas].sort((a, b) => a[clave] - b[clave]);
    if (mayorPrimero) lista.reverse();
    return limite ? lista.slice(0, limite) : lista;
  }, [semanas, criterio, mayorPrimero, limite]);

  // Solo re-mide el layout cuando cambia el orden/lista (evita animaciones falsas por scroll o cambios de altura de la página)
  const claveOrden = ordenadas.map((s) => s.clave).join('|');

  return (
    <MotionConfig reducedMotion="user">
    <section className="rk" aria-label="Ranking de semanas">
      <button type="button" className="rk-toggle" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
        <span className="rk-toggle-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
          </svg>
          Ranking de semanas
        </span>
        <svg className={`rk-chevron ${abierto ? 'rk-abierto' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <AnimatePresence initial={false}>
      {abierto && (
        <motion.div
          key="rk-body"
          className="rk-body"
          style={{ overflow: 'hidden' }}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.28, ease: EASE }}
        >
          {semanas.length === 0 ? (
            <p className="empty-state">Aún no hay movimientos para armar el ranking.</p>
          ) : (
            <>
              <div className="rk-controles">
                <label className="rk-control">
                  <span>Ordenar por</span>
                  <select value={criterio} onChange={(e) => setCriterio(e.target.value)}>
                    {CRITERIOS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </label>
                <label className="rk-control">
                  <span>Mostrar</span>
                  <select value={limite} onChange={(e) => setLimite(Number(e.target.value))}>
                    {LIMITES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                  </select>
                </label>
                <button type="button" className="rk-orden" onClick={() => setMayorPrimero((v) => !v)}>
                  {mayorPrimero ? 'Mayor a menor ↓' : 'Menor a mayor ↑'}
                </button>
              </div>

              <ol className="rk-lista">
                <AnimatePresence initial={false} mode="popLayout">
                {ordenadas.map((s, i) => (
                  <motion.li
                    key={s.clave}
                    layout="position"
                    layoutDependency={claveOrden}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.3, ease: EASE, layout: { type: 'spring', stiffness: 380, damping: 34 } }}
                  >
                    <button type="button" className="rk-fila" onClick={() => onSeleccionarSemana(s.offset)} title="Ver esta semana en el historial">
                      <span className={`rk-pos ${i === 0 && criterio !== 'reciente' ? 'rk-pos-top' : ''}`}>{i + 1}</span>
                      <span className="rk-semana">
                        <strong>{s.etiqueta}</strong>
                        <small>{s.anio} · {s.entregas} entregas · {s.retiros} retiros</small>
                      </span>
                      <span className="rk-montos">
                        <span className={`rk-ingreso ${criterio === 'ingresos' ? 'rk-activa' : ''}`}>${formatoPeso(s.ingresos)}</span>
                        <span className={`rk-gasto ${criterio === 'gastos' ? 'rk-activa' : ''}`}>−${formatoPeso(s.gastos)}</span>
                        <span className={`rk-balance ${s.balance < 0 ? 'rk-negativo' : ''} ${criterio === 'balance' ? 'rk-activa' : ''}`}>
                          {s.balance < 0 ? '−' : ''}${formatoPeso(Math.abs(s.balance))}
                        </span>
                      </span>
                    </button>
                  </motion.li>
                ))}
                </AnimatePresence>
              </ol>
              <p className="rk-leyenda">
                <span className="rk-ingreso">Ingresos brutos</span> · <span className="rk-gasto">Gastos</span> · Balance
              </p>
            </>
          )}
        </motion.div>
      )}
      </AnimatePresence>
    </section>
    </MotionConfig>
  );
}

export default RankingSemanas;
