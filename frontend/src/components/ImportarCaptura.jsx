import { useState, useEffect, useMemo } from 'react';
import SelectorFecha from './SelectorFecha';
import SelectorTurno from './SelectorTurno';
import { analizarCaptura } from '../services/capturaService';
import { crearTransaccion } from '../services/transaccionService';
import '../styles/importar-captura.css';

const IVA = 0.19;
const MAX_BYTES = 5 * 1024 * 1024;
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

// Registrar el día subiendo una captura del detalle diario.
// Flujo: foto -> borrador editable -> el usuario confirma -> se crean los registros con las reglas de siempre.
function ImportarCaptura({ puntosRetiro, crearPunto, turnosOcupados, onGuardado, onCerrar }) {
  const [archivo, setArchivo] = useState(null);
  const [analizando, setAnalizando] = useState(false);
  const [error, setError] = useState('');
  const [borradorListo, setBorradorListo] = useState(false);
  const [advertencias, setAdvertencias] = useState([]);

  const [fecha, setFecha] = useState(() => isoADDMMYYYY(hoyISO()));
  const [exitosas, setExitosas] = useState('');
  const [fallidas, setFallidas] = useState('0');
  const [sobredimensionados, setSobredimensionados] = useState('0');
  const [valorPaquete, setValorPaquete] = useState(1500);
  const [turnoRuta, setTurnoRuta] = useState('AM');
  const [turnoRetiro, setTurnoRetiro] = useState('AM');
  const [filasRetiro, setFilasRetiro] = useState([]);
  const [obsRuta, setObsRuta] = useState('');
  const [obsRetiro, setObsRetiro] = useState('');

  const [guardando, setGuardando] = useState(false);
  const [paqueteGuardado, setPaqueteGuardado] = useState(false);
  const [retirosGuardados, setRetirosGuardados] = useState(false);

  const vistaPrevia = useMemo(() => (archivo ? URL.createObjectURL(archivo) : ''), [archivo]);
  useEffect(() => () => { if (vistaPrevia) URL.revokeObjectURL(vistaPrevia); }, [vistaPrevia]);

  function handleArchivo(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      setError('Formato no permitido. Usa JPG, PNG o WebP');
      return;
    }
    if (f.size > MAX_BYTES) {
      setError('La imagen supera los 5 MB');
      return;
    }
    setError('');
    setArchivo(f);
  }

  async function handleAnalizar() {
    if (!archivo) return;
    setError('');
    setAnalizando(true);
    try {
      const { borrador, advertencias: adv } = await analizarCaptura(archivo);
      setFecha(borrador.fecha ? isoADDMMYYYY(borrador.fecha) : isoADDMMYYYY(hoyISO()));
      setExitosas(borrador.entregasExitosas != null ? String(borrador.entregasExitosas) : '');
      setSobredimensionados(String(borrador.sobredimensionados.length));
      setValorPaquete(borrador.valorPaquete);
      setFilasRetiro(borrador.retiros.map((r) => {
        const punto = buscarPunto(r.cliente, puntosRetiro);
        return { ...r, puntoId: punto ? String(punto.id) : '', zonaNueva: '' };
      }));
      setAdvertencias(adv || []);
      setBorradorListo(true);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo analizar la imagen');
    } finally {
      setAnalizando(false);
    }
  }

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

  async function handleGuardar() {
    setError('');
    if (!fechaISO) return setError('Ingresa una fecha válida en formato DD-MM-AAAA');
    if (fechaISO > hoyISO()) return setError('La fecha no puede ser futura');

    const hayRuta = nExitosas + nFallidas > 0;
    const hayRetiros = filasAsignadas.length > 0;
    if (!hayRuta && !hayRetiros && !sinRetiro) return setError('No hay nada que registrar');
    if (hayRuta && !paqueteGuardado && ocupadosRuta.includes(turnoRuta)) {
      return setError(`Ya registraste la ruta ${turnoRuta} de esta fecha`);
    }
    if ((hayRetiros || sinRetiro) && !retirosGuardados && ocupadosRetiro.includes(turnoRetiro)) {
      return setError(`Ya registraste los retiros ${turnoRetiro} de esta fecha`);
    }
    if (filasAsignadas.some((f) => f.puntoId === NUEVO && !f.zonaNueva.trim())) {
      return setError('Indica la zona de los retiros nuevos');
    }

    setGuardando(true);
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

      onGuardado();
      onCerrar();
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al registrar';
      setError(paqueteGuardado || retirosGuardados
        ? `${msg}. Lo que ya se guardó no se repetirá si reintentas.`
        : msg);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={guardando ? undefined : onCerrar}>
      <div className="modal-box captura-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Registrar día con una foto</h3>

        {error && <p className="form-error">{error}</p>}

        {!borradorListo ? (
          <>
            <p className="modal-message">
              Sube la captura del detalle del día (la pantalla con la fecha, los retiros y las entregas).
              Revisarás los datos antes de guardar.
            </p>
            <label className="captura-dropzone">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
                <path d="M12 4v12M7 9l5-5 5 5" />
              </svg>
              <span>{archivo ? archivo.name : 'Toca para elegir una imagen (JPG, PNG o WebP, máx. 5 MB)'}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleArchivo} />
            </label>
            {vistaPrevia && <img className="captura-preview" src={vistaPrevia} alt="Vista previa de la captura" />}
            <div className="captura-actions">
              <button type="button" className="btn-ghost" onClick={onCerrar} disabled={analizando}>Cancelar</button>
              <button type="button" className="btn-primary" onClick={handleAnalizar} disabled={!archivo || analizando}>
                {analizando ? 'Analizando...' : 'Analizar foto'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="modal-message">Revisa y corrige los datos leídos. Nada se guarda hasta que confirmes.</p>
            {advertencias.map((a) => <p key={a} className="captura-warn">⚠ {a}</p>)}

            <div className="field">
              <span className="field-label">Fecha</span>
              <SelectorFecha id="fecha-captura" value={fecha} onChange={setFecha} required />
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
              <span>Total a registrar</span>
              <strong>${formatoPeso(brutoRuta + brutoRetiro)}</strong>
            </div>

            <div className="captura-actions">
              <button type="button" className="btn-ghost" onClick={onCerrar} disabled={guardando}>Cancelar</button>
              <button type="button" className="btn-primary" onClick={handleGuardar} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Confirmar y registrar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ImportarCaptura;
