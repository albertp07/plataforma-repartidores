import { useEffect, useState } from 'react';
import TabSelector from './TabSelector';
import SelectorFecha from './SelectorFecha';
import { obtenerRankingParadas } from '../services/mapaService';
import { formatearFecha } from '../utils/fechas';
import { hoyDDMMYYYY, rangoRanking } from '../utils/rangoRanking';
import '../styles/mapa.css';

const MODOS = [
  { id: 'DIA', label: 'Día' },
  { id: 'SEMANA', label: 'Semana' },
  { id: 'MES', label: 'Mes' },
  { id: 'TODO', label: 'Todo' },
];

const LIMITE = 10;

const AYUDA_RANGO = {
  DIA: 'Paradas de ese día',
  SEMANA: 'Semana de lunes a domingo que incluye esa fecha',
  MES: 'Mes calendario que incluye esa fecha',
};

// Props: onVerEnMapa(fila) se llama al tocar "Ver en mapa" de una dirección ya ubicada.
function RankingParadas({ onVerEnMapa }) {
  const [modo, setModo] = useState('SEMANA');
  const [fecha, setFecha] = useState(hoyDDMMYYYY);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const rango = rangoRanking(modo, fecha);
  const desde = rango?.desde;
  const hasta = rango?.hasta;
  const fechaInvalida = rango === null;

  useEffect(() => {
    if (fechaInvalida) return undefined;
    let cancelado = false;

    async function cargar() {
      setCargando(true);
      try {
        const respuesta = await obtenerRankingParadas({ desde, hasta, limite: LIMITE });
        if (cancelado) return;
        setDatos(respuesta);
        setError('');
      } catch (err) {
        console.error(err);
        if (!cancelado) setError(err.response?.data?.error || 'No se pudo cargar el ranking.');
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, [desde, hasta, fechaInvalida]);

  const filas = datos?.ranking ?? [];
  const maxVisitas = filas.length ? filas[0].visitas : 0;
  const titulo =
    modo === 'TODO' ? 'Todo el historial' : desde === hasta ? formatearFecha(desde) : `${formatearFecha(desde)} al ${formatearFecha(hasta)}`;

  return (
    <section className="panel rkp" aria-label="Ranking de paradas más visitadas">
      <div className="rkp-header">
        <h2 className="rkp-titulo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 21h8" />
            <path d="M12 17v4" />
            <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
            <path d="M17 5h3v2a3 3 0 0 1-3 3" />
            <path d="M7 5H4v2a3 3 0 0 0 3 3" />
          </svg>
          Paradas más visitadas
        </h2>
        {!fechaInvalida && !cargando && datos && <span className="rkp-periodo">{titulo}</span>}
      </div>

      <div className="rkp-filtros">
        <div className="mapa-filtro">
          <span className="field-label">Período</span>
          <TabSelector label="Período del ranking" value={modo} onChange={setModo} options={MODOS} />
        </div>
        {modo !== 'TODO' && (
          <div className="field mapa-filtro rkp-fecha">
            <label className="field-label" htmlFor="ranking-fecha">
              {modo === 'DIA' ? 'Fecha' : 'Fecha de referencia'}
            </label>
            <SelectorFecha id="ranking-fecha" value={fecha} onChange={setFecha} />
          </div>
        )}
      </div>
      {modo !== 'TODO' && <p className="rkp-ayuda">{AYUDA_RANGO[modo]}</p>}

      {fechaInvalida && (
        <p className="rkp-vacio" role="status">
          Ingresa una fecha válida (DD-MM-AAAA).
        </p>
      )}

      {error && !fechaInvalida && (
        <p className="login-error" role="alert">
          {error}
        </p>
      )}

      {!fechaInvalida && cargando && <p className="rkp-vacio">Cargando ranking...</p>}

      {!fechaInvalida && !cargando && !error && filas.length === 0 && (
        <p className="rkp-vacio">No hay paradas registradas en este período.</p>
      )}

      {!fechaInvalida && !cargando && !error && filas.length > 0 && (
        <ol className="rkp-lista">
          {filas.map((f) => (
            <li key={`${f.posicion}-${f.direccion}`} className={`rkp-fila ${f.posicion <= 3 ? 'rkp-top' : ''}`}>
              <span className="rkp-pos" aria-label={`Puesto ${f.posicion}`}>
                {f.posicion}
              </span>
              <div className="rkp-info">
                <strong className="rkp-direccion">{f.direccion}</strong>
                <span className="rkp-detalle">
                  {f.paquetes} {f.paquetes === 1 ? 'paquete' : 'paquetes'}
                  {f.fallidos > 0 && <span className="mapa-fallidos"> · {f.fallidos} fallidos</span>}
                  {f.ultimaVisita && <> · última: {formatearFecha(f.ultimaVisita)}</>}
                </span>
                <span className="rkp-barra" aria-hidden="true">
                  <span style={{ width: `${maxVisitas ? Math.max((f.visitas / maxVisitas) * 100, 4) : 0}%` }} />
                </span>
              </div>
              <div className="rkp-visitas">
                <strong>{f.visitas}</strong>
                <span>{f.visitas === 1 ? 'visita' : 'visitas'}</span>
              </div>
              {onVerEnMapa && (
                <button
                  type="button"
                  className="rkp-ver"
                  onClick={() => onVerEnMapa(f)}
                  disabled={f.lat == null || f.lng == null}
                  title={f.lat == null ? 'Aún no se ubica en el mapa' : 'Ver en el mapa'}
                  aria-label={`Ver ${f.direccion} en el mapa`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z" />
                    <circle cx="12" cy="10" r="2.5" />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default RankingParadas;
