import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import TabSelector from './TabSelector';
import RankingParadas from './RankingParadas';
import { crearCapaCalor } from '../utils/capaCalor';
import { obtenerMapaCalor } from '../services/mapaService';
import '../styles/mapa.css';

// Centro aproximado de Macul
const CENTRO_MACUL = [-33.4925, -70.5985];
const ZOOM_INICIAL = 14;
const ESPERA_REINTENTO_MS = 5000;
const MAX_REINTENTOS = 60; // ~5 minutos esperando que el servidor termine de ubicar direcciones

const PERIODOS = [
  { id: 'SEMANA', label: '7 días' },
  { id: 'MES', label: '30 días' },
  { id: 'TRIMESTRE', label: '90 días' },
  { id: 'TODO', label: 'Todo' },
];
const TURNOS = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'AM', label: 'AM' },
  { id: 'PM', label: 'PM' },
];
const METRICAS = [
  { id: 'ENTREGAS', label: 'Entregas' },
  { id: 'FALLIDAS', label: 'Fallidas' },
  { id: 'PARADAS', label: 'Paradas' },
];

const GRADIENTES = {
  ENTREGAS: { 0.2: '#FFE29A', 0.5: '#F7A600', 0.8: '#E0493D', 1: '#C03328' },
  FALLIDAS: { 0.2: '#FCEAE8', 0.5: '#E0493D', 1: '#7A1A12' },
  PARADAS: { 0.2: '#E5EFFB', 0.5: '#1B6FD1', 1: '#23272E' },
};

function aIso(fecha) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`;
}

function rangoDe(periodo) {
  const dias = { SEMANA: 7, MES: 30, TRIMESTRE: 90 }[periodo];
  if (!dias) return {};
  const hoy = new Date();
  const desde = new Date(hoy);
  desde.setDate(hoy.getDate() - (dias - 1));
  return { desde: aIso(desde), hasta: aIso(hoy) };
}

function pesoDe(punto, metrica) {
  if (metrica === 'FALLIDAS') return punto.fallidos;
  if (metrica === 'PARADAS') return punto.paradas;
  return punto.entregados;
}

function textoTooltip(punto) {
  // Se arma con nodos de texto (no HTML): la dirección viene del PDF y no debe interpretarse como marcado
  const caja = document.createElement('div');
  caja.className = 'mapa-tooltip';
  const titulo = document.createElement('strong');
  titulo.textContent = punto.direccion;
  const detalle = document.createElement('span');
  detalle.textContent = `${punto.entregados} entregados · ${punto.fallidos} fallidos · ${punto.paradas} ${punto.paradas === 1 ? 'visita' : 'visitas'}`;
  caja.append(titulo, detalle);
  if (punto.aproximada) {
    const nota = document.createElement('em');
    nota.textContent = 'Ubicación aproximada (centro de la calle)';
    caja.append(nota);
  }
  return caja;
}

function MapaCalor() {
  const lienzoRef = useRef(null);
  const mapaRef = useRef(null);
  const capaRef = useRef(null);
  const debeAjustarRef = useRef(true);

  const [periodo, setPeriodo] = useState('MES');
  const [turno, setTurno] = useState('TODOS');
  const [metrica, setMetrica] = useState('ENTREGAS');
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [errorDibujo, setErrorDibujo] = useState('');
  const [verSinUbicar, setVerSinUbicar] = useState(false);

  // 1) Crea el mapa una sola vez
  useEffect(() => {
    const mapa = L.map(lienzoRef.current, { center: CENTRO_MACUL, zoom: ZOOM_INICIAL, zoomControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa);
    capaRef.current = L.layerGroup().addTo(mapa);
    mapaRef.current = mapa;

    return () => {
      mapa.remove();
      mapaRef.current = null;
      capaRef.current = null;
    };
  }, []);

  // 2) Trae los datos al cambiar el filtro; mientras el servidor ubica direcciones, vuelve a consultar
  useEffect(() => {
    let cancelado = false;
    let temporizador;
    let reintentos = 0;
    debeAjustarRef.current = true;

    async function cargar(inicial) {
      if (inicial) setCargando(true);
      try {
        const respuesta = await obtenerMapaCalor({ ...rangoDe(periodo), turno });
        if (cancelado) return;
        setDatos(respuesta);
        setError('');
        setErrorDibujo('');
        if (respuesta.resumen.pendientes > 0 && reintentos < MAX_REINTENTOS) {
          reintentos += 1;
          temporizador = setTimeout(() => cargar(false), ESPERA_REINTENTO_MS);
        }
      } catch (err) {
        console.error(err);
        if (!cancelado) setError(err.response?.data?.error || 'No se pudo cargar el mapa.');
      } finally {
        if (!cancelado && inicial) setCargando(false);
      }
    }

    cargar(true);
    return () => {
      cancelado = true;
      clearTimeout(temporizador);
    };
  }, [periodo, turno]);

  // 3) Dibuja el mapa de calor y los puntos cada vez que cambian los datos o la métrica
  useEffect(() => {
    const mapa = mapaRef.current;
    const capa = capaRef.current;
    if (!mapa || !capa || !datos) return;

    capa.clearLayers();
    // Se descartan coordenadas inválidas para que un dato malo no impida dibujar el resto
    const puntos = datos.puntos.filter(
      (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && pesoDe(p, metrica) > 0
    );
    if (puntos.length === 0) return;

    // Puntos pequeños con detalle al pasar el cursor o tocar (se dibujan aunque falle el calor)
    puntos.forEach((p) => {
      L.circleMarker([p.lat, p.lng], {
        radius: 5,
        color: '#23272E',
        weight: 1.5,
        fillColor: '#FFFFFF',
        fillOpacity: 0.85,
      })
        .bindTooltip(textoTooltip(p), { direction: 'top', offset: [0, -4] })
        .addTo(capa);
    });

    try {
      const maximo = Math.max(...puntos.map((p) => pesoDe(p, metrica)));
      crearCapaCalor(
        puntos.map((p) => [p.lat, p.lng, pesoDe(p, metrica)]),
        { max: maximo, gradiente: GRADIENTES[metrica] }
      ).addTo(capa);
    } catch (err) {
      console.error('No se pudo dibujar el mapa de calor:', err);
      queueMicrotask(() => setErrorDibujo('No se pudo dibujar el calor del mapa, pero los puntos sí se muestran.'));
    }

    if (debeAjustarRef.current) {
      debeAjustarRef.current = false;
      mapa.fitBounds(L.latLngBounds(puntos.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 16 });
    }
  }, [datos, metrica]);

  // Centra el mapa en una dirección del ranking
  function verEnMapa(fila) {
    const mapa = mapaRef.current;
    if (!mapa || !Number.isFinite(fila.lat) || !Number.isFinite(fila.lng)) return;
    lienzoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    mapa.flyTo([fila.lat, fila.lng], 18, { duration: 0.8 });
  }

  const resumen = datos?.resumen;
  const sinDatos = !cargando && !error && resumen && resumen.paradas === 0;

  return (
    <div className="mapa">
      <div className="panel mapa-controles">
        <div className="mapa-filtro">
          <span className="field-label">Período</span>
          <TabSelector label="Período del mapa" value={periodo} onChange={setPeriodo} options={PERIODOS} />
        </div>
        <div className="mapa-filtro">
          <span className="field-label">Turno</span>
          <TabSelector label="Turno" value={turno} onChange={setTurno} options={TURNOS} />
        </div>
        <div className="mapa-filtro">
          <span className="field-label">Mostrar</span>
          <TabSelector label="Qué mostrar en el mapa" value={metrica} onChange={setMetrica} options={METRICAS} />
        </div>
      </div>

      {(error || errorDibujo) && (
        <p className="login-error" role="alert">
          {error || errorDibujo}
        </p>
      )}

      <div className="mapa-marco">
        <div ref={lienzoRef} className="mapa-lienzo" role="img" aria-label="Mapa de calor de entregas en Macul" />
        {(cargando || sinDatos) && (
          <div className="mapa-velo">
            <p>
              {cargando
                ? 'Cargando mapa...'
                : 'No hay paradas en este período. Importa el PDF de Circuit en una ruta para verlas aquí.'}
            </p>
          </div>
        )}
      </div>

      <RankingParadas onVerEnMapa={verEnMapa} />

      {resumen && resumen.paradas > 0 && (
        <div className="panel mapa-resumen">
          <p>
            <strong>{resumen.ubicadas}</strong> de <strong>{resumen.direcciones}</strong> direcciones ubicadas
            {resumen.aproximadas > 0 && <> · {resumen.aproximadas} aproximadas (centro de la calle)</>}
            {' · '}
            {resumen.entregados} entregados · <span className="mapa-fallidos">{resumen.fallidos} fallidos</span>
          </p>

          {resumen.pendientes > 0 && (
            <p className="mapa-aviso" role="status">
              Ubicando {resumen.pendientes} {resumen.pendientes === 1 ? 'dirección' : 'direcciones'} en el mapa. Se
              actualiza sola, puede tardar unos minutos.
            </p>
          )}

          {datos.sinUbicar.some((s) => !s.enProceso) && (
            <>
              <button type="button" className="btn-ghost" onClick={() => setVerSinUbicar((v) => !v)}>
                {verSinUbicar ? 'Ocultar' : 'Ver'} direcciones sin ubicar
              </button>
              {verSinUbicar && (
                <ul className="mapa-sin-ubicar">
                  {datos.sinUbicar
                    .filter((s) => !s.enProceso)
                    .map((s) => (
                      <li key={s.direccion}>
                        {s.direccion} <span>({s.paradas} {s.paradas === 1 ? 'visita' : 'visitas'})</span>
                      </li>
                    ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default MapaCalor;
