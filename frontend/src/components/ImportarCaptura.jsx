import { useState, useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import SelectorFecha from './SelectorFecha';
import SelectorTurno from './SelectorTurno';
import { analizarCaptura } from '../services/capturaService';
import { crearTransaccion } from '../services/transaccionService';
import '../styles/importar-captura.css';

const IVA = 0.19;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ARCHIVOS = 10;
const CONCURRENCIA = 3;
const NUEVO = '__nuevo';

function formatoPeso(valor) {
  return Math.round(valor).toLocaleString('es-CL');
}

function isoADDMMYYYY(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

function ddmmyyyyAISO(texto) {
  const match = (texto || '').match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  return `${y}-${m}-${d}`;
}

function hoyISO() {
  return new Date().toISOString().split('T')[0];
}

function limitarCantidad(valor) {
  return valor.replace(/\D/g, '').slice(0, 4);
}

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Busca en el catálogo del repartidor el retiro que corresponde al cliente leído de la foto
function buscarPunto(cliente, puntos) {
  const c = normalizar(cliente);
  if (!c) return null;
  const exacto = puntos.find((p) => normalizar(p.nombre) === c);
  if (exacto) return exacto;
  return puntos.find((p) => {
    const n = normalizar(p.nombre);
    return n.length >= 4 && c.length >= 4 && (n.includes(c) || c.includes(n));
  }) || null;
}

function claveArchivo(f) {
  return `${f.name}|${f.size}|${f.lastModified}`;
}

// ---------------------------------------------------------------------------
// Un día leído de una captura: tarjeta con borrador editable.
// Expone guardar() para que el modal pueda registrar todos los días seguidos.
// ---------------------------------------------------------------------------
const DiaCaptura = forwardRef(function DiaCaptura(
  { datos, puntosRetiro, crearPunto, turnosOcupados, abiertoInicial },
  ref,
) {
  const { borrador, advertencias } = datos;

  const [abierto, setAbierto] = useState(abiertoInicial);
  const [fecha, setFecha] = useState(() => (borrador.fecha ? isoADDMMYYYY(borrador.fecha) : isoADDMMYYYY(hoyISO())));
  const [exitosas, setExitosas] = useState(() => (borrador.entregasExitosas != null ? String(borrador.entregasExitosas) : ''));
  const [fallidas, setFallidas] = useState('0');
  const [sobredimensionados, setSobredimensionados] = useState(() => String(borrador.sobredimensionados.length));
  const [valorPaquete, setValorPaquete] = useState(borrador.valorPaquete);
  const [turnoRuta, setTurnoRuta] = useState('AM');
  const [turnoRetiro, setTurnoRetiro] = useState('AM');
  const [filasRetiro, setFilasRetiro] = useState(() => borrador.retiros.map((r) => {
    const punto = buscarPunto(r.cliente, puntosRetiro);
    return { ...r, puntoId: punto ? String(punto.id) : '', zonaNueva: '' };
  }));
  const [obsRuta, setObsRuta] = useState('');
  const [obsRetiro, setObsRetiro] = useState('');

  const [error, setError] = useState('');
  const [paqueteGuardado, setPaqueteGuardado] = useState(false);
  const [retirosGuardados, setRetirosGuardados] = useState(false);
  const [completo, setCompleto] = useState(false);

  function cambiarFila(indice, cambios) {
    setFilasRetiro((filas) => filas.map((f, i) => (i === indice ? { ...f, ...cambios } : f)));
  }

  // Cálculos en vivo (mismas reglas que el formulario manual)
  const nExitosas = Number(exitosas) || 0;
  const nFallidas = Number(fallidas) || 0;
  const nSobre = Number(sobredimensionados) || 0;
  const valorUnitario = Number(valorPaquete) || 0;
  const liquidoRuta = (nExitosas + nSobre) * valorUnitario;
  const brutoRuta = liquidoRuta + liquidoRuta * IVA;

  const filasAsignadas = filasRetiro.filter((f) => f.puntoId);
  const liquidoRetiro = filasAsignadas.reduce((suma, f) => {
    if (f.puntoId === NUEVO) return suma + (Number(f.monto) || 0);
    const p = puntosRetiro.find((x) => String(x.id) === f.puntoId);
    return suma + (p ? Number(p.precio) : 0);
  }, 0);
  const brutoRetiro = liquidoRetiro + Math.round(liquidoRetiro * IVA);

  // Si la foto no trae retiros, el día se registra como "Sin retiro"
  const sinRetiro = filasRetiro.length === 0;

  const fechaISO = ddmmyyyyAISO(fecha);
  const ocupadosRuta = fechaISO ? turnosOcupados('PAQUETES', fechaISO) : [];
  const ocupadosRetiro = fechaISO ? turnosOcupados('RETIROS', fechaISO) : [];

  // Devuelve { ok, omitido? }. No cierra el modal ni recarga: eso lo hace el padre al final.
  async function guardar() {
    if (completo) return { ok: true, omitido: true };
    setError('');
    const fallo = (msg) => { setError(msg); setAbierto(true); return { ok: false }; };

    if (!fechaISO) return fallo('Ingresa una fecha válida en formato DD-MM-AAAA');
    if (fechaISO > hoyISO()) return fallo('La fecha no puede ser futura');

    const hayRuta = nExitosas + nFallidas > 0;
    const hayRetiros = filasAsignadas.length > 0;
    if (!hayRuta && !hayRetiros && !sinRetiro) return fallo('No hay nada que registrar');
    if (hayRuta && !paqueteGuardado && ocupadosRuta.includes(turnoRuta)) {
      return fallo(`Ya registraste la ruta ${turnoRuta} de esta fecha`);
    }
    if ((hayRetiros || sinRetiro) && !retirosGuardados && ocupadosRetiro.includes(turnoRetiro)) {
      return fallo(`Ya registraste los retiros ${turnoRetiro} de esta fecha`);
    }
    if (filasAsignadas.some((f) => f.puntoId === NUEVO && !f.zonaNueva.trim())) {
      return fallo('Indica la zona de los retiros nuevos');
    }

    try {
      const totalSalida = nExitosas + nFallidas;
      if (hayRuta && !paqueteGuardado) {
        const descripcion = nSobre > 0
          ? `Reparto · ${nExitosas} entregadas / ${nSobre} S/D${nFallidas > 0 ? ` / ${nFallidas} fallidas` : ''} de ${totalSalida} totales`
          : `Reparto · ${nExitosas} entregadas${nFallidas > 0 ? ` / ${nFallidas} fallidas` : ''} de ${totalSalida} totales`;
        await crearTransaccion({
          tipo: 'INGRESO',
          monto: brutoRuta,
          descripcion,
          turno: turnoRuta,
          categoriaIngreso: 'PAQUETES',
          cantidadPaquetes: nExitosas,
          paquetesFallidos: nFallidas,
          paquetesTotalSalida: totalSalida,
          paquetesSobredimensionados: nSobre > 0 ? nSobre : undefined,
          valorPaquete: valorUnitario,
          montoLiquido: liquidoRuta,
          montoIva: liquidoRuta * IVA,
          observaciones: obsRuta.trim() || undefined,
          fecha: `${fechaISO}T12:00:00.000Z`,
        });
        setPaqueteGuardado(true);
      }

      if (hayRetiros && !retirosGuardados) {
        const ids = [];
        for (let i = 0; i < filasRetiro.length; i += 1) {
          const fila = filasRetiro[i];
          if (!fila.puntoId) continue;
          if (fila.puntoId === NUEVO) {
            const nuevo = await crearPunto({ nombre: fila.cliente, zona: fila.zonaNueva.trim(), precio: fila.monto });
            // Si algo falla después, al reintentar no se vuelve a crear
            cambiarFila(i, { puntoId: String(nuevo.id) });
            ids.push(nuevo.id);
          } else {
            ids.push(Number(fila.puntoId));
          }
        }
        await crearTransaccion({
          tipo: 'INGRESO',
          monto: brutoRetiro,
          descripcion: `Retiros · ${ids.length} colectas`,
          turno: turnoRetiro,
          categoriaIngreso: 'RETIROS',
          puntosRetiroIds: ids, // el servidor recalcula los montos desde el catálogo
          observaciones: obsRetiro.trim() || undefined,
          fecha: `${fechaISO}T12:00:00.000Z`,
        });
        setRetirosGuardados(true);
      } else if (sinRetiro && !retirosGuardados) {
        await crearTransaccion({
          tipo: 'INGRESO',
          monto: 0,
          descripcion: 'Sin retiros ese día',
          turno: turnoRetiro,
          categoriaIngreso: 'RETIROS',
          cantidadPaquetes: 0,
          montoLiquido: 0,
          montoIva: 0,
          sinActividad: true,
          observaciones: obsRetiro.trim() || 'Sin retiros ese día (según captura)',
          fecha: `${fechaISO}T12:00:00.000Z`,
        });
        setRetirosGuardados(true);
      }

      setCompleto(true);
      setAbierto(false);
      return { ok: true };
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al registrar';
      return fallo(paqueteGuardado || retirosGuardados
        ? `${msg}. Lo que ya se guardó no se repetirá si reintentas.`
        : msg);
    }
  }

  useImperativeHandle(ref, () => ({ guardar }));

  const estado = completo
    ? { clase: 'ok', texto: 'Guardado' }
    : error
      ? { clase: 'err', texto: 'Con error' }
      : { clase: '', texto: 'Pendiente' };

  const resumen = `${nExitosas} entregas${nSobre > 0 ? ` (${nSobre} S/D)` : ''} · ${sinRetiro ? 'sin retiros' : `${filasAsignadas.length} retiros`}`;

  return (
    <div className={`captura-dia ${completo ? 'guardado' : ''} ${error && !completo ? 'con-error' : ''}`}>
      <button type="button" className="captura-dia-head" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
        <span>
          {fecha}
          <small>{resumen} · ${formatoPeso(brutoRuta + brutoRetiro)}</small>
        </span>
        <span className={`captura-chip ${estado.clase}`}>{estado.texto}</span>
      </button>

      <div className="captura-dia-body" hidden={!abierto}>
        {error && <p className="form-error">{error}</p>}
        {advertencias.map((a) => <p key={a} className="captura-warn">⚠ {a}</p>)}

        <fieldset disabled={completo}>
          <div className="field">
            <span className="field-label">Fecha</span>
            <SelectorFecha id={`fecha-captura-${datos.id}`} value={fecha} onChange={setFecha} required />
          </div>

          <p className="captura-section-title">Reparto</p>
          <div className="field-row">
            <div className="field">
              <span className="field-label">Entregas exitosas</span>
              <input inputMode="numeric" value={exitosas} onChange={(e) => setExitosas(limitarCantidad(e.target.value))} />
            </div>
            <div className="field">
              <span className="field-label">Fallidas</span>
              <input inputMode="numeric" value={fallidas} onChange={(e) => setFallidas(limitarCantidad(e.target.value))} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <span className="field-label">Sobredimensionados</span>
              <input inputMode="numeric" value={sobredimensionados} onChange={(e) => setSobredimensionados(limitarCantidad(e.target.value))} />
            </div>
            <div className="field">
              <span className="field-label">Valor por paquete</span>
              <input inputMode="numeric" value={valorPaquete} onChange={(e) => setValorPaquete(e.target.value.replace(/\D/g, '').slice(0, 8))} />
            </div>
          </div>
          <div className="field">
            <span className="field-label">Turno de la ruta</span>
            <SelectorTurno value={turnoRuta} onChange={setTurnoRuta} ocupados={ocupadosRuta} etiqueta="la ruta" />
          </div>
          <div className="captura-total">
            <span>Reparto (líquido + IVA)</span>
            <strong>${formatoPeso(brutoRuta)}</strong>
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <span className="field-label">Comentario del reparto (opcional)</span>
            <textarea
              rows="2"
              maxLength={500}
              value={obsRuta}
              onChange={(e) => setObsRuta(e.target.value)}
              placeholder="Ej: Ruta con lluvia, 2 direcciones incorrectas"
            />
          </div>

          <p className="captura-section-title">Retiros ({filasRetiro.length})</p>
          {sinRetiro && (
            <p className="captura-warn">
              La foto no tiene retiros: se registrará como <strong>Sin retiro</strong> ese día.
            </p>
          )}
          {filasRetiro.map((fila, i) => {
            const punto = puntosRetiro.find((p) => String(p.id) === fila.puntoId);
            const difiere = punto && fila.monto != null && Number(punto.precio) !== fila.monto;
            return (
              <div className="captura-retiro" key={`${fila.cliente}-${fila.hora}-${i}`}>
                <div className="captura-retiro-head">
                  <span>{fila.cliente}{fila.hora ? ` · ${fila.hora}` : ''}</span>
                  <span>${formatoPeso(fila.monto || 0)}</span>
                </div>
                <select value={fila.puntoId} onChange={(e) => cambiarFila(i, { puntoId: e.target.value })}>
                  <option value="">No registrar este retiro</option>
                  {puntosRetiro.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre} · {p.zona} · ${formatoPeso(Number(p.precio))}</option>
                  ))}
                  <option value={NUEVO}>+ Crear en mi catálogo</option>
                </select>
                {fila.puntoId === NUEVO && (
                  <input
                    placeholder="Zona (ej: Macul)"
                    maxLength={40}
                    value={fila.zonaNueva}
                    onChange={(e) => cambiarFila(i, { zonaNueva: e.target.value })}
                  />
                )}
                {difiere && (
                  <p className="captura-warn" style={{ marginTop: 8, marginBottom: 0 }}>
                    Tu catálogo dice ${formatoPeso(Number(punto.precio))} y la foto ${formatoPeso(fila.monto)}. Se usará el del catálogo.
                  </p>
                )}
              </div>
            );
          })}
          {(filasAsignadas.length > 0 || sinRetiro) && (
            <div className="field">
              <span className="field-label">Turno de los retiros</span>
              <SelectorTurno value={turnoRetiro} onChange={setTurnoRetiro} ocupados={ocupadosRetiro} etiqueta="los retiros" />
            </div>
          )}
          {filasAsignadas.length > 0 && (
            <div className="captura-total">
              <span>Retiros (líquido + IVA)</span>
              <strong>${formatoPeso(brutoRetiro)}</strong>
            </div>
          )}
          {(filasAsignadas.length > 0 || sinRetiro) && (
            <div className="field" style={{ marginTop: 12 }}>
              <span className="field-label">
                {sinRetiro ? 'Motivo / comentario de los retiros' : 'Comentario de los retiros (opcional)'}
              </span>
              <textarea
                rows="2"
                maxLength={500}
                value={obsRetiro}
                onChange={(e) => setObsRetiro(e.target.value)}
                placeholder={sinRetiro ? 'Ej: No había retiros programados (si lo dejas vacío se guarda un texto por defecto)' : 'Ej: Retiros hechos en la mañana'}
              />
            </div>
          )}

          <div className="captura-total">
            <span>Total del día</span>
            <strong>${formatoPeso(brutoRuta + brutoRetiro)}</strong>
          </div>
        </fieldset>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Modal: sube hasta 10 capturas (una por día), las lee y deja revisar cada día antes de registrar.
// ---------------------------------------------------------------------------
function ImportarCaptura({ puntosRetiro, crearPunto, turnosOcupados, onGuardado, onCerrar }) {
  const [archivos, setArchivos] = useState([]);
  const [analizando, setAnalizando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState('');
  const [dias, setDias] = useState(null); // null = aún no se analiza
  const [fallos, setFallos] = useState([]);
  const [guardandoTodos, setGuardandoTodos] = useState(false);
  const refs = useRef({});

  const vistas = useMemo(() => archivos.map((f) => URL.createObjectURL(f)), [archivos]);
  useEffect(() => () => vistas.forEach((u) => URL.revokeObjectURL(u)), [vistas]);

  function handleArchivos(e) {
    const nuevos = Array.from(e.target.files || []);
    e.target.value = '';
    if (nuevos.length === 0) return;

    let mensaje = '';
    const aceptados = [...archivos];
    const claves = new Set(aceptados.map(claveArchivo));
    nuevos.forEach((f) => {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
        mensaje = 'Solo se permiten imágenes JPG, PNG o WebP';
      } else if (f.size > MAX_BYTES) {
        mensaje = `"${f.name}" supera los 5 MB`;
      } else if (claves.has(claveArchivo(f))) {
        mensaje = 'Omití capturas repetidas';
      } else if (aceptados.length >= MAX_ARCHIVOS) {
        mensaje = `Máximo ${MAX_ARCHIVOS} capturas por vez`;
      } else {
        aceptados.push(f);
        claves.add(claveArchivo(f));
      }
    });
    setError(mensaje);
    setArchivos(aceptados);
  }

  function quitarArchivo(indice) {
    setArchivos((lista) => lista.filter((_, i) => i !== indice));
  }

  async function handleAnalizar() {
    if (archivos.length === 0) return;
    setError('');
    setAnalizando(true);
    setProgreso(0);

    const resultados = new Array(archivos.length);
    let siguiente = 0;
    let hechos = 0;

    async function trabajador() {
      for (let i = siguiente; i < archivos.length; i = siguiente) {
        siguiente += 1;
        try {
          const { borrador, advertencias } = await analizarCaptura(archivos[i]);
          resultados[i] = { ok: true, id: `${i}-${claveArchivo(archivos[i])}`, nombre: archivos[i].name, borrador, advertencias: advertencias || [] };
        } catch (err) {
          resultados[i] = { ok: false, nombre: archivos[i].name, error: err.response?.data?.error || 'No se pudo analizar la imagen' };
        }
        hechos += 1;
        setProgreso(hechos);
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCIA, archivos.length) }, trabajador));

    const buenos = resultados.filter((r) => r.ok)
      .sort((a, b) => (a.borrador.fecha || '').localeCompare(b.borrador.fecha || ''));
    setFallos(resultados.filter((r) => !r.ok));
    setAnalizando(false);

    if (buenos.length === 0) {
      setError(resultados[0]?.error || 'No se pudo leer ninguna captura');
      return;
    }
    setDias(buenos);
  }

  async function handleGuardarTodos() {
    setError('');
    setGuardandoTodos(true);
    let guardados = 0;
    let conError = 0;
    for (const dia of dias) {
      const handle = refs.current[dia.id];
      if (!handle) continue;
      const r = await handle.guardar();
      if (r.omitido) continue;
      if (r.ok) guardados += 1;
      else conError += 1;
    }
    setGuardandoTodos(false);
    if (guardados > 0) onGuardado();
    if (conError === 0) {
      onCerrar();
    } else {
      setError(`${conError} ${conError === 1 ? 'día tiene' : 'días tienen'} errores. Corrígelos y pulsa "Registrar todos" otra vez; lo ya guardado no se repetirá.`);
    }
  }

  // Fechas repetidas entre las capturas subidas (probable captura duplicada)
  const fechasRepetidas = useMemo(() => {
    if (!dias) return [];
    const cuenta = {};
    dias.forEach((d) => { if (d.borrador.fecha) cuenta[d.borrador.fecha] = (cuenta[d.borrador.fecha] || 0) + 1; });
    return Object.entries(cuenta).filter(([, n]) => n > 1).map(([f]) => isoADDMMYYYY(f));
  }, [dias]);

  const ocupado = analizando || guardandoTodos;

  return (
    <div className="modal-overlay" onClick={ocupado ? undefined : onCerrar}>
      <div className={`modal-box captura-modal ${dias ? 'ancho' : ''}`} onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Registrar días con fotos</h3>

        {error && <p className="form-error">{error}</p>}

        {!dias ? (
          <>
            <p className="modal-message">
              Sube las capturas del detalle del día, una por cada día (hasta {MAX_ARCHIVOS}).
              Revisarás cada día antes de guardar.
            </p>
            <label className="captura-dropzone">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
                <path d="M12 4v12M7 9l5-5 5 5" />
              </svg>
              <span>
                {archivos.length > 0
                  ? `${archivos.length} ${archivos.length === 1 ? 'captura seleccionada' : 'capturas seleccionadas'} · toca para agregar más`
                  : 'Toca para elegir imágenes (JPG, PNG o WebP, máx. 5 MB c/u)'}
              </span>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleArchivos} disabled={analizando} />
            </label>

            {archivos.length > 0 && (
              <div className="captura-thumbs">
                {archivos.map((f, i) => (
                  <div className="captura-thumb" key={claveArchivo(f)} title={f.name}>
                    <img src={vistas[i]} alt={f.name} />
                    {!analizando && (
                      <button type="button" onClick={() => quitarArchivo(i)} aria-label={`Quitar ${f.name}`}>×</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="captura-actions">
              <button type="button" className="btn-ghost" onClick={onCerrar} disabled={analizando}>Cancelar</button>
              <button type="button" className="btn-primary" onClick={handleAnalizar} disabled={archivos.length === 0 || analizando}>
                {analizando
                  ? `Analizando ${progreso} de ${archivos.length}...`
                  : `Analizar ${archivos.length > 1 ? `${archivos.length} fotos` : 'foto'}`}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="modal-message">
              Revisa cada día (toca una tarjeta para abrirla y corregirla). Nada se guarda hasta que pulses "Registrar todos".
            </p>

            {fechasRepetidas.length > 0 && (
              <p className="captura-warn">
                ⚠ Hay más de una captura con la misma fecha ({fechasRepetidas.join(', ')}). Si es la misma, quita una antes de registrar.
              </p>
            )}
            {fallos.map((f) => (
              <p key={f.nombre} className="form-error">No se pudo leer "{f.nombre}": {f.error}</p>
            ))}

            {dias.map((dia, i) => (
              <DiaCaptura
                key={dia.id}
                ref={(el) => { refs.current[dia.id] = el; }}
                datos={dia}
                puntosRetiro={puntosRetiro}
                crearPunto={crearPunto}
                turnosOcupados={turnosOcupados}
                abiertoInicial={dias.length === 1 && i === 0}
              />
            ))}

            <div className="captura-actions">
              <button type="button" className="btn-ghost" onClick={onCerrar} disabled={guardandoTodos}>Cerrar</button>
              <button type="button" className="btn-primary" onClick={handleGuardarTodos} disabled={guardandoTodos}>
                {guardandoTodos ? 'Registrando...' : `Registrar ${dias.length === 1 ? 'el día' : `todos (${dias.length})`}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ImportarCaptura;
