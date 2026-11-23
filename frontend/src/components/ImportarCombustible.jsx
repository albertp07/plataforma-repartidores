import { useState, useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import SelectorFecha from './SelectorFecha';
import { analizarComprobanteCombustible } from '../services/capturaService';
import { crearTransaccion } from '../services/transaccionService';
import { descripcionCombustible } from '../utils/combustible';
import '../styles/importar-captura.css';
import '../styles/comprobante-combustible.css';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ARCHIVOS = 10;
const CONCURRENCIA = 3;
const PRODUCTOS = ['DIESEL', '93', '95', '97'];

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

function limitarMonto(valor) {
  return String(valor).replace(/\D/g, '').slice(0, 8);
}

// Litros con decimales (ej. "43.541"): máximo 6 dígitos en total
function limitarLitros(valor) {
  let limpio = String(valor).replace(/[^0-9.]/g, '');
  const primerPunto = limpio.indexOf('.');
  if (primerPunto !== -1) {
    limpio = limpio.slice(0, primerPunto + 1) + limpio.slice(primerPunto + 1).replace(/\./g, '');
  }
  const digitos = limpio.replace('.', '');
  if (digitos.length > 6) limpio = limpio.slice(0, limpio.length - (digitos.length - 6));
  return limpio;
}

const claveArchivo = (f) => `${f.name}-${f.size}-${f.lastModified}`;
const textoNumero = (n) => (n == null ? '' : String(n));

// ---------------------------------------------------------------------------
// Tarjeta de una compra: campos editables + guardado individual (para reintentar sin duplicar)
// ---------------------------------------------------------------------------
const CompraCombustible = forwardRef(function CompraCombustible({ datos, abiertoInicial }, ref) {
  const b = datos.borrador;
  const [abierto, setAbierto] = useState(abiertoInicial);
  const [fecha, setFecha] = useState(b.fecha ? isoADDMMYYYY(b.fecha) : '');
  const [producto, setProducto] = useState(b.producto || null);
  const [litros, setLitros] = useState(textoNumero(b.litros));
  const [precioLitro, setPrecioLitro] = useState(textoNumero(b.precioLitro));
  const [subtotal, setSubtotal] = useState(textoNumero(b.subtotal));
  const [cupon, setCupon] = useState(b.descuentoCupon ? String(b.descuentoCupon) : '');
  const [promo, setPromo] = useState(b.descuentoPromocion ? String(b.descuentoPromocion) : '');
  const [error, setError] = useState('');
  const [completo, setCompleto] = useState(false);

  const totalSinDescuento = Number(subtotal) || 0;
  const descuento = (Number(cupon) || 0) + (Number(promo) || 0);
  const totalFinal = Math.max(totalSinDescuento - descuento, 0);

  async function guardar() {
    if (completo) return { ok: true, omitido: true };
    const fallo = (mensaje) => {
      setError(mensaje);
      setAbierto(true);
      return { ok: false };
    };
    setError('');

    const fechaISO = ddmmyyyyAISO(fecha);
    if (!fechaISO) return fallo('Ingresa una fecha válida en formato DD-MM-AAAA');
    if (fechaISO > hoyISO()) return fallo('La fecha no puede ser futura');
    if (totalFinal <= 0) return fallo('Ingresa un subtotal válido');

    try {
      await crearTransaccion({
        tipo: 'GASTO',
        monto: totalFinal,
        descripcion: descripcionCombustible({ producto, litros, precioLitro, descuento }),
        categoriaGasto: 'BENCINA',
        montoSinDescuento: totalSinDescuento,
        descuentoAplicado: descuento > 0 ? descuento : undefined,
        fecha: `${fechaISO}T12:00:00.000Z`,
      });
      setCompleto(true);
      setAbierto(false);
      return { ok: true };
    } catch (err) {
      return fallo(err.response?.data?.error || 'Error al registrar el gasto');
    }
  }

  useImperativeHandle(ref, () => ({ guardar }));

  const estado = completo
    ? { clase: 'ok', texto: 'Guardado' }
    : error
      ? { clase: 'err', texto: 'Con error' }
      : { clase: '', texto: 'Pendiente' };

  const resumen = `${producto === 'DIESEL' ? 'Diésel' : producto || 'Combustible'}${litros ? ` · ${litros} L` : ''}`;

  return (
    <div className={`captura-dia ${completo ? 'guardado' : ''} ${error && !completo ? 'con-error' : ''}`}>
      <button type="button" className="captura-dia-head" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
        <span>
          {fecha || 'Sin fecha'}
          <small>{resumen} · ${formatoPeso(totalFinal)}</small>
        </span>
        <span className={`captura-chip ${estado.clase}`}>{estado.texto}</span>
      </button>

      <div className="captura-dia-body" hidden={!abierto}>
        {error && <p className="form-error">{error}</p>}
        {datos.advertencias.map((a) => <p key={a} className="captura-warn">⚠ {a}</p>)}

        <fieldset disabled={completo}>
          <div className="field">
            <span className="field-label">Fecha</span>
            <SelectorFecha id={`fecha-combustible-${datos.id}`} value={fecha} onChange={setFecha} required />
          </div>

          <div className="field">
            <span className="field-label">Combustible</span>
            <div className="producto-opciones">
              {PRODUCTOS.map((p) => (
                <button
                  type="button"
                  key={p}
                  className={`producto-opcion ${producto === p ? 'active' : ''}`}
                  onClick={() => setProducto(producto === p ? null : p)}
                >
                  {p === 'DIESEL' ? 'Diésel' : p}
                </button>
              ))}
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <span className="field-label">Litros</span>
              <input type="number" min="0" step="any" value={litros} onChange={(e) => setLitros(limitarLitros(e.target.value))} />
            </div>
            <div className="field">
              <span className="field-label">Precio por litro</span>
              <input type="number" min="0" value={precioLitro} onChange={(e) => setPrecioLitro(limitarMonto(e.target.value))} />
            </div>
          </div>

          <div className="field">
            <span className="field-label">Total sin descuento</span>
            <input type="number" min="0" value={subtotal} onChange={(e) => setSubtotal(limitarMonto(e.target.value))} />
          </div>

          <div className="field-row">
            <div className="field">
              <span className="field-label">Descuento cupón</span>
              <input type="number" min="0" value={cupon} onChange={(e) => setCupon(limitarMonto(e.target.value))} />
            </div>
            <div className="field">
              <span className="field-label">Descuento promoción</span>
              <input type="number" min="0" value={promo} onChange={(e) => setPromo(limitarMonto(e.target.value))} />
            </div>
          </div>

          <div className="captura-total">
            <span>Total a pagar</span>
            <strong>${formatoPeso(totalFinal)}</strong>
          </div>
        </fieldset>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Modal: sube hasta 10 comprobantes, los lee y deja revisar cada uno antes de registrar.
// ---------------------------------------------------------------------------
function ImportarCombustible({ onGuardado, onCerrar }) {
  const [archivos, setArchivos] = useState([]);
  const [analizando, setAnalizando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState('');
  const [compras, setCompras] = useState(null); // null = aún no se analiza
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
        mensaje = `Máximo ${MAX_ARCHIVOS} comprobantes por vez`;
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
          const { borrador, advertencias } = await analizarComprobanteCombustible(archivos[i]);
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
      setError(resultados[0]?.error || 'No se pudo leer ningún comprobante');
      return;
    }
    setCompras(buenos);
  }

  async function handleGuardarTodos() {
    setError('');
    setGuardandoTodos(true);
    let guardados = 0;
    let conError = 0;
    for (const compra of compras) {
      const handle = refs.current[compra.id];
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
      setError(`${conError} ${conError === 1 ? 'compra tiene' : 'compras tienen'} errores. Corrígelas y pulsa "Registrar todas" otra vez; lo ya guardado no se repetirá.`);
    }
  }

  // Misma fecha y mismo subtotal en dos fotos: probable comprobante duplicado
  const repetidas = useMemo(() => {
    if (!compras) return [];
    const cuenta = {};
    compras.forEach((c) => {
      if (c.borrador.fecha && c.borrador.subtotal != null) {
        const k = `${c.borrador.fecha}|${c.borrador.subtotal}`;
        cuenta[k] = (cuenta[k] || 0) + 1;
      }
    });
    return Object.entries(cuenta).filter(([, n]) => n > 1).map(([k]) => {
      const [f, s] = k.split('|');
      return `${isoADDMMYYYY(f)} · $${formatoPeso(Number(s))}`;
    });
  }, [compras]);

  const ocupado = analizando || guardandoTodos;

  return (
    <div className="modal-overlay" onClick={ocupado ? undefined : onCerrar}>
      <div className={`modal-box captura-modal ${compras ? 'ancho' : ''}`} onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Registrar combustible con fotos</h3>

        {error && <p className="form-error">{error}</p>}

        {!compras ? (
          <>
            <p className="modal-message">
              Sube los comprobantes de combustible, uno por carga (hasta {MAX_ARCHIVOS}).
              Revisarás cada uno antes de guardar.
            </p>
            <label className="captura-dropzone">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
                <path d="M12 4v12M7 9l5-5 5 5" />
              </svg>
              <span>
                {archivos.length > 0
                  ? `${archivos.length} ${archivos.length === 1 ? 'comprobante seleccionado' : 'comprobantes seleccionados'} · toca para agregar más`
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
              Revisa cada compra (toca una tarjeta para abrirla y corregirla). Nada se guarda hasta que pulses "Registrar todas".
            </p>

            {repetidas.length > 0 && (
              <p className="captura-warn">
                ⚠ Hay comprobantes con la misma fecha y monto ({repetidas.join(', ')}). Si es el mismo, quita uno antes de registrar.
              </p>
            )}
            {fallos.map((f) => (
              <p key={f.nombre} className="form-error">No se pudo leer "{f.nombre}": {f.error}</p>
            ))}

            {compras.map((compra, i) => (
              <CompraCombustible
                key={compra.id}
                ref={(el) => { refs.current[compra.id] = el; }}
                datos={compra}
                abiertoInicial={compras.length === 1 && i === 0}
              />
            ))}

            <div className="captura-actions">
              <button type="button" className="btn-ghost" onClick={onCerrar} disabled={guardandoTodos}>Cerrar</button>
              <button type="button" className="btn-primary" onClick={handleGuardarTodos} disabled={guardandoTodos}>
                {guardandoTodos ? 'Registrando...' : `Registrar ${compras.length === 1 ? 'la compra' : `todas (${compras.length})`}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ImportarCombustible;
