import { useState, useEffect, useRef } from 'react';
import '../styles/login-carousel.css';

/* Carrusel "Ruta de funciones": cada funcionalidad es una parada del recorrido.
   Cada tarjeta reproduce su propio paso a paso (coreografía CSS con delays --d) y los
   montos suben con <Contador>. El avance automático lo maneja la animación CSS del tramo
   activo (onAnimationEnd), así que pausar (hover/foco) o reducir movimiento no necesita timers. */

const fmt = new Intl.NumberFormat('es-CL');

// Delay de una animación en segundos (variable CSS --d)
const d = (s) => ({ '--d': `${s}s` });

/* Número que sube (o baja) mientras la slide está activa. delay/dur en ms. */
function Contador({ activa, hasta, desde = 0, delay = 0, dur = 1200, prefijo = '$' }) {
  const [v, setV] = useState(desde);

  useEffect(() => {
    if (!activa) return undefined;
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf;
    let t0;
    const tick = (now) => {
      if (t0 === undefined) t0 = now;
      const p = reducido ? 1 : Math.min(Math.max((now - t0 - delay) / dur, 0), 1);
      const e = 1 - Math.pow(1 - p, 3);
      setV(Math.round(desde + (hasta - desde) * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [activa, hasta, desde, delay, dur]);

  return <>{prefijo}{fmt.format(v)}</>;
}

function Tick({ delay }) {
  return (
    <span className="lc-tick lc-step" style={d(delay)}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg>
    </span>
  );
}

/* Chispas y destellos de la celebración del balance neto (posiciones relativas al centro del número) */
const CHISPAS = Array.from({ length: 22 }, (_, i) => ({
  a: i * (360 / 22) + (i % 2 ? 6 : -6),
  r: [84, 112, 140][i % 3],
  c: ['#F7A600', '#FFC23D', '#16A57A', '#36C096'][i % 4],
  dot: i % 3 === 1,
}));

const ESTRELLAS = [
  { x: -150, y: -34, s: 18, dl: 0.05 }, { x: 148, y: -40, s: 14, dl: 0.18 },
  { x: -96, y: 40, s: 12, dl: 0.3 }, { x: 110, y: 38, s: 20, dl: 0.12 },
  { x: -40, y: -52, s: 12, dl: 0.25 }, { x: 36, y: -50, s: 16, dl: 0.36 },
  { x: -178, y: 6, s: 10, dl: 0.42 }, { x: 176, y: 8, s: 12, dl: 0.5 },
];

/* Versión compacta de la celebración, para totales dentro de una fila (Entregas) */
const CHISPAS_SM = Array.from({ length: 14 }, (_, i) => ({
  a: i * (360 / 14) + (i % 2 ? 5 : -5),
  r: [44, 60, 76][i % 3],
  c: ['#F7A600', '#FFC23D', '#16A57A', '#36C096'][i % 4],
  dot: i % 3 === 1,
}));

const ESTRELLAS_SM = [
  { x: -70, y: -22, s: 12, dl: 0.05 }, { x: 66, y: -26, s: 10, dl: 0.15 },
  { x: -48, y: 24, s: 9, dl: 0.25 }, { x: 52, y: 22, s: 13, dl: 0.1 },
  { x: 0, y: -34, s: 9, dl: 0.3 },
];

/* Anillos + chispas + estrellas. Se centra en su contenedor posicionado; el retraso viene de --d. */
function Explosion({ chispas, estrellas, pequena }) {
  return (
    <span className={`lc-burst${pequena ? ' lc-burst-sm' : ''}`} aria-hidden="true">
      <i className="lc-ring lc-ring-a" />
      <i className="lc-ring lc-ring-b" />
      {chispas.map((c, i) => (
        <i
          key={`c${i}`}
          className={`lc-spark${c.dot ? ' lc-spark-dot' : ''}`}
          style={{ '--a': `${c.a}deg`, '--r': `${c.r}px`, '--c': c.c, '--o': `${(i % 5) * 0.025}s` }}
        />
      ))}
      {estrellas.map((e, i) => (
        <i
          key={`e${i}`}
          className="lc-star"
          style={{ '--x': `${e.x}px`, '--y': `${e.y}px`, '--sz': `${e.s}px`, '--o': `${e.dl}s` }}
        />
      ))}
    </span>
  );
}

/* 1 · Balance: se arma en tres pasos (ingresos → gastos → neto) */
function VisualBalance({ activa }) {
  return (
    <div className="lc-card">
      <div className="lc-card-head lc-step" style={d(0)}>
        <span>Balance de hoy</span>
        <span className="lc-chip lc-chip-ok">En vivo</span>
      </div>

      <div className="lc-line lc-step" style={d(0.3)}>
        <div className="lc-line-top">
          <span><b className="lc-sign lc-sign-ok">+</b>Ingresos brutos</span>
          <span className="lc-num lc-ok lc-bump" style={d(1.95)}><Contador activa={activa} hasta={59976} delay={450} dur={1500} /></span>
        </div>
        <div className="lc-meter-track"><i className="lc-meter-fill lc-fill-ok" style={{ '--w': '100%', ...d(0.45) }} /></div>
      </div>

      <div className="lc-line lc-step" style={d(2.1)}>
        <div className="lc-line-top">
          <span><b className="lc-sign lc-sign-bad">−</b>Gastos</span>
          <span className="lc-num lc-bad lc-bump" style={d(3.25)}><Contador activa={activa} hasta={17000} delay={2250} dur={1000} prefijo="−$" /></span>
        </div>
        <div className="lc-meter-track"><i className="lc-meter-fill lc-fill-bad" style={{ '--w': '28%', ...d(2.25) }} /></div>
      </div>

      <div className="lc-sep lc-step" style={d(3.7)} />

      <div className="lc-result lc-step" style={d(3.8)}>
        <span className="lc-result-label">Balance neto</span>

        {/* El número aterriza a los ~5,2 s: ahí estalla la celebración (--d de este bloque) */}
        <div className="lc-big-wrap" style={d(5.2)}>
          <div className="lc-big">
            <Contador activa={activa} hasta={42976} delay={3950} dur={1300} />
            <i className="lc-glint" aria-hidden="true" />
          </div>

          <Explosion chispas={CHISPAS} estrellas={ESTRELLAS} />
        </div>

        <span className="lc-badge lc-step" style={d(6.1)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 4 22 20H2z" /></svg>
          Te quedó el 72% de tus ingresos
        </span>
      </div>
    </div>
  );
}

/* 2 · Entregas: cada paquete se marca uno a uno; los fallidos no suman */
const FALLIDOS = new Set([11, 26, 37]);

function VisualEntregas({ activa }) {
  return (
    <div className="lc-card">
      <div className="lc-card-head lc-step" style={d(0)}>
        <span>Entregas del día</span>
        <span className="lc-chip">$1.200 / paquete</span>
      </div>

      <div className="lc-pkgs" aria-hidden="true">
        {Array.from({ length: 45 }, (_, i) => (
          <i
            key={i}
            className={`lc-pkg${FALLIDOS.has(i) ? ' is-fail' : ''}`}
            style={d(0.3 + i * 0.04)}
          />
        ))}
      </div>

      <div className="lc-row lc-step" style={d(0.3)}>
        <span><b className="lc-dot lc-dot-ok" />Exitosas</span>
        <span className="lc-row-val"><Contador activa={activa} hasta={42} delay={300} dur={1800} prefijo="" /></span>
      </div>
      {/* Cada fila cuenta DESPUÉS de aparecer (delay del contador = delay de la fila + 0,15 s) */}
      <div className="lc-row lc-row-strike lc-step" style={d(2.1)}>
        <span><b className="lc-dot lc-dot-bad" />Fallidas · no se pagan</span>
        <span className="lc-row-val"><Contador activa={activa} hasta={3} delay={2250} dur={700} prefijo="" /></span>
      </div>
      <div className="lc-row lc-step" style={d(2.7)}>
        <span>Líquido · 42 × $1.200</span>
        <span className="lc-row-val"><Contador activa={activa} hasta={50400} delay={2850} dur={1200} /></span>
      </div>
      <div className="lc-row lc-step" style={d(4.1)}>
        <span>IVA 19%</span>
        <span className="lc-row-val"><Contador activa={activa} hasta={9576} delay={4250} dur={800} /></span>
      </div>
      <div className="lc-sep lc-step" style={d(5.1)} />
      <div className="lc-row lc-row-strong lc-row-ok lc-step" style={d(5.2)}>
        <span>Total bruto</span>
        {/* El total aterriza a los ~6,35 s (5,35 + 1,0): ahí se dispara la celebración compacta */}
        <span className="lc-boomwrap" style={d(6.35)}>
          <span className="lc-row-val lc-boomsm">
            <Contador activa={activa} hasta={59976} delay={5350} dur={1000} />
            <i className="lc-glint" aria-hidden="true" />
          </span>
          <Explosion chispas={CHISPAS_SM} estrellas={ESTRELLAS_SM} pequena />
        </span>
      </div>
    </div>
  );
}

/* 3 · Combustible: se llena el estanque, llega el descuento y el total baja */
function VisualCombustible({ activa }) {
  return (
    <div className="lc-card">
      <div className="lc-card-head lc-step" style={d(0)}>
        <span>Combustible</span>
        <span className="lc-chip">Carga de hoy</span>
      </div>

      {/* Línea de tiempo (s): 0,45–1,95 se llena en rojo con la carga · 2,6 el tramo de $3.000 se vuelve
          verde · 3,0–3,9 retrocede mientras el gasto final baja · 3,95 el monto final cobra su color */}
      <div className="lc-tank lc-step" style={d(0.15)}>
        <i className="lc-tank-fill" style={d(0.45)} />
        <i className="lc-tank-cut" style={d(2.6)} />
      </div>

      <div className="lc-row lc-step" style={d(0.3)}>
        <span>Carga</span>
        <span className="lc-row-val"><Contador activa={activa} hasta={20000} delay={450} dur={1500} /></span>
      </div>
      <div className="lc-row lc-row-ok lc-step" style={d(2.6)}>
        <span>Descuento aplicado</span>
        <span className="lc-row-val"><Contador activa={activa} hasta={3000} delay={3000} dur={900} prefijo="−$" /></span>
      </div>
      <div className="lc-sep lc-step" style={d(1.9)} />
      <div className="lc-row lc-row-strong lc-row-bad lc-step" style={d(2)}>
        <span>Gasto final</span>
        <span className="lc-row-val lc-bump" style={d(3.95)}>
          <Contador activa={activa} hasta={17000} desde={20000} delay={3000} dur={900} />
        </span>
      </div>
    </div>
  );
}

/* 4 · Captura: el escáner recorre la imagen y los datos se escriben con su check */
function CampoDetectado({ etiqueta, valor, ch, delay }) {
  return (
    <div className="lc-xrow lc-step" style={d(delay)}>
      <span>{etiqueta}</span>
      <span className="lc-xval">
        <b className="lc-type" style={{ '--ch': ch, ...d(delay + 0.25) }}>{valor}</b>
        <Tick delay={delay + 0.9} />
      </span>
    </div>
  );
}

function VisualCaptura() {
  return (
    <div className="lc-card lc-card-split">
      <div className="lc-phone" aria-hidden="true">
        <i className="lc-phone-line lc-step" style={{ width: '70%', ...d(0.1) }} />
        <i className="lc-phone-line lc-step" style={{ width: '45%', ...d(0.2) }} />
        <i className="lc-phone-block lc-step" style={d(0.3)} />
        <i className="lc-phone-line lc-step" style={{ width: '60%', ...d(0.4) }} />
        <i className="lc-phone-line lc-step" style={{ width: '82%', ...d(0.5) }} />
        <i className="lc-scan" />
      </div>

      <div className="lc-extract">
        <span className="lc-extract-tag lc-step" style={d(1.6)}>Detectado</span>
        <CampoDetectado etiqueta="Fecha" valor="08-11-2026" ch={11} delay={2} />
        <CampoDetectado etiqueta="Entregas" valor="42" ch={3} delay={2.8} />
        <CampoDetectado etiqueta="Fallidas" valor="3" ch={2} delay={3.6} />
        <CampoDetectado etiqueta="Retiros" valor="6" ch={2} delay={4.4} />
      </div>

      {/* Cierre (s): 5,3 aparece el botón · 6,4 el cursor hace clic · 6,6 el botón pasa a verde
          y "Confirmar movimientos" se reemplaza por "Ruta registrada" con el check dibujándose */}
      <div className="lc-confirm lc-step" style={d(5.3)}>
        <span className="lc-confirm-a">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg>
          Confirmar movimientos
        </span>
        <span className="lc-confirm-b">
          <span className="lc-confirm-check">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <path className="lc-check-path" pathLength="1" d="m5 12 5 5L20 7" />
            </svg>
          </span>
          Ruta registrada
        </span>
      </div>

      <span className="lc-cursor" aria-hidden="true">
        <i className="lc-click" />
        <svg width="22" height="26" viewBox="0 0 22 26">
          <path d="M3 2v18l5-4.4 3.6 7.6 3-1.4-3.6-7.4H18z" fill="#fff" stroke="#1D2229" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  );
}

/* 5 · Asistente: pregunta → "escribiendo…" → respuesta palabra por palabra → gráfico */
const RESPUESTA = [
  { t: 'Los' }, { t: 'viernes:' }, { t: 'en' }, { t: 'promedio' },
  { t: '$64.300', fuerte: true }, { t: 'brutos,' }, { t: 'un' }, { t: '18%' },
  { t: 'sobre' }, { t: 'el' }, { t: 'resto' }, { t: 'de' }, { t: 'la' }, { t: 'semana.' },
];

const DIAS = [
  { l: 'L', h: 30 }, { l: 'M', h: 33 }, { l: 'M', h: 31 }, { l: 'J', h: 35 },
  { l: 'V', h: 46, top: true }, { l: 'S', h: 39 }, { l: 'D', h: 22 },
];

function VisualChat() {
  return (
    <div className="lc-card lc-chat">
      <div className="lc-bubble lc-bubble-user lc-step" style={d(0.3)}>
        ¿Qué día de la semana me rinde más?
      </div>

      <div className="lc-reply">
        <div className="lc-typing" aria-hidden="true"><i /><i /><i /></div>
        <div className="lc-bubble lc-bubble-bot lc-step" style={d(2.9)}>
          {RESPUESTA.map((w, i) => (
            <span
              key={i}
              className={`lc-word${w.fuerte ? ' lc-word-strong' : ''}`}
              style={d(3.05 + i * 0.07)}
            >
              {w.t}{' '}
            </span>
          ))}
        </div>
      </div>

      <div className="lc-minichart lc-step" style={d(4.4)} aria-hidden="true">
        <div className="lc-bars">
          {DIAS.map((x, i) => (
            <div className={`lc-bar${x.top ? ' is-top' : ''}`} key={i}>
              <i style={{ '--h': `${x.h}px`, ...d(4.6 + i * 0.07) }} />
              <span>{x.l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* 6 · Ranking: las semanas llegan por fecha y se reordenan por ingresos */
const SEMANAS = [
  { n: 1, label: 'Sem. 44', val: 312400, w: '100%', from: 2 },
  { n: 2, label: 'Sem. 42', val: 287900, w: '92%', from: 0 },
  { n: 3, label: 'Sem. 45', val: 264150, w: '85%', from: 1 },
  { n: 4, label: 'Sem. 41', val: 241800, w: '77%', from: -3 },
];

function VisualRanking({ activa }) {
  return (
    <div className="lc-card">
      <div className="lc-card-head lc-step" style={d(0)}>
        <span>Mejores semanas</span>
        <span className="lc-chip lc-swap">
          <em className="lc-swap-a">Por fecha</em>
          <em className="lc-swap-b" style={d(2.3)}>Por ingresos</em>
        </span>
      </div>

      <div className="lc-rank-list">
        {SEMANAS.map((s) => (
          <div className="lc-rank" key={s.n} style={{ '--from': s.from }}>
            <span className={`lc-rank-n lc-rank-${s.n}`} style={d(3.3 + s.n * 0.15)}>{s.n}</span>
            <div className="lc-rank-body">
              <div className="lc-rank-top">
                <span>{s.label}</span>
                <span><Contador activa={activa} hasta={s.val} delay={350} dur={1500} /></span>
              </div>
              <div className="lc-meter-track">
                <i className="lc-meter-fill lc-fill-brand" style={{ '--w': s.w, ...d(0.4) }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const SLIDES = [
  {
    id: 'balance',
    corto: 'Balance',
    kicker: 'Balance al instante',
    titulo: 'Sabe cuánto ganaste hoy, sin hacer cuentas.',
    texto: 'Ingresos brutos menos gastos: tu balance neto siempre actualizado.',
    Visual: VisualBalance,
  },
  {
    id: 'entregas',
    corto: 'Entregas',
    kicker: 'Entregas y retiros',
    titulo: 'Solo cuentas lo que se paga.',
    texto: 'Los paquetes fallidos no suman. Rinde calcula el líquido, el IVA y el total bruto.',
    Visual: VisualEntregas,
  },
  {
    id: 'combustible',
    corto: 'Gastos',
    kicker: 'Control de gastos',
    titulo: 'Tu combustible, con descuento incluido.',
    texto: 'Registra la carga y el descuento: el gasto real se calcula solo.',
    Visual: VisualCombustible,
  },
  {
    id: 'captura',
    corto: 'Captura',
    kicker: 'Importar desde captura',
    titulo: 'Sube una foto, olvídate de tipear.',
    texto: 'Lee tus capturas de pantalla y deja los movimientos listos para confirmar.',
    Visual: VisualCaptura,
  },
  {
    id: 'asistente',
    corto: 'Asistente',
    kicker: 'Asistente con IA',
    titulo: 'Pregúntale a tus propios números.',
    texto: 'Consulta qué semanas rinden más o cuánto gastas en combustible, en lenguaje normal.',
    Visual: VisualChat,
  },
  {
    id: 'ranking',
    corto: 'Ranking',
    kicker: 'Ranking de semanas',
    titulo: 'Descubre tus mejores semanas.',
    texto: 'Compara ingresos, gastos y balance para saber cuándo te rinde más la ruta.',
    Visual: VisualRanking,
  },
];

function LoginCarousel() {
  const [activo, setActivo] = useState(0);
  const [pausado, setPausado] = useState(false);
  const inicioX = useRef(null);
  const total = SLIDES.length;

  const ir = (i) => setActivo(((i % total) + total) % total);
  const siguiente = () => ir(activo + 1);
  const anterior = () => ir(activo - 1);

  function handleKeyDown(e) {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      siguiente();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      anterior();
    }
  }

  function handlePointerUp(e) {
    if (inicioX.current === null) return;
    const dx = e.clientX - inicioX.current;
    inicioX.current = null;
    if (Math.abs(dx) > 50) (dx < 0 ? siguiente : anterior)();
  }

  return (
    <section
      className={`lc${pausado ? ' is-paused' : ''}`}
      aria-roledescription="carrusel"
      aria-label="Funcionalidades de Rinde"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
      onKeyDown={handleKeyDown}
    >
      <div
        className="lc-stage"
        aria-live={pausado ? 'polite' : 'off'}
        onPointerDown={(e) => { inicioX.current = e.clientX; }}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => { inicioX.current = null; }}
      >
        {SLIDES.map((s, i) => {
          const estado = i === activo ? 'is-active' : i < activo ? 'is-prev' : 'is-next';
          return (
            <article
              key={s.id}
              className={`lc-slide ${estado}`}
              role="group"
              aria-roledescription="diapositiva"
              aria-label={`${i + 1} de ${total}: ${s.kicker}`}
              aria-hidden={i !== activo}
            >
              <div className="lc-copy">
                <span className="lc-kicker">{s.kicker}</span>
                <h2 className="lc-title">{s.titulo}</h2>
                <p className="lc-text">{s.texto}</p>
              </div>
              <div className="lc-visual" aria-hidden="true">
                <s.Visual activa={i === activo} />
              </div>
            </article>
          );
        })}
      </div>

      <div className="lc-nav">
        <div className="lc-track" role="tablist" aria-label="Elegir funcionalidad">
          {SLIDES.map((s, i) => (
            <div className="lc-stop-wrap" key={s.id}>
              <button
                type="button"
                role="tab"
                aria-selected={i === activo}
                aria-label={s.kicker}
                className={`lc-stop${i === activo ? ' is-active' : i < activo ? ' is-done' : ''}`}
                onClick={() => ir(i)}
                tabIndex={i === activo ? 0 : -1}
              >
                <span className="lc-stop-dot" />
                <span className="lc-stop-label">{s.corto}</span>
              </button>
              <div className={`lc-seg${i < activo ? ' is-done' : ''}${i === activo ? ' is-active' : ''}${i === total - 1 ? ' lc-seg-tail' : ''}`}>
                <i
                  key={i === activo ? `a${activo}` : `i${i}`}
                  className="lc-seg-fill"
                  onAnimationEnd={(e) => {
                    if (i === activo && e.animationName === 'lc-seg-fill') siguiente();
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="lc-arrows">
          <span className="lc-count" aria-hidden="true">
            {String(activo + 1).padStart(2, '0')}<em>/{String(total).padStart(2, '0')}</em>
          </span>
          <button type="button" className="lc-arrow" onClick={anterior} aria-label="Anterior">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button type="button" className="lc-arrow" onClick={siguiente} aria-label="Siguiente">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </div>
      </div>
    </section>
  );
}

export default LoginCarousel;
