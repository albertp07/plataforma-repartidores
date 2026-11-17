import { useEffect, useMemo, useRef, useState } from 'react';
import { obtenerParadas, vistaPreviaParadas, guardarParadas } from '../services/paradaService';
import { formatearFecha } from '../utils/fechas';
import '../styles/paradas.css';

const MAX_BYTES = 5 * 1024 * 1024;

let contadorUid = 0;
function nuevoUid() {
  contadorUid += 1;
  return `parada-${contadorUid}`;
}

function sinTildes(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// "Av Macul 2701" y "Macul Avenue 2701" dan la misma clave (tokens ordenados)
function claveDireccion(texto) {
  return sinTildes(texto)
    .replace(/\b(avenida|avenue|av)\b\.?/g, 'av')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

function aFila(p) {
  return {
    uid: nuevoUid(),
    direccion: p.direccion || '',
    hora: p.hora || '',
    horaEstimada: p.horaEstimada || '',
    horaDudosa: !!p.horaDudosa,
    notas: p.notas || '',
    cantidadPaquetes: p.cantidadPaquetes ?? 1,
    paquetesFallidos: p.paquetesFallidos ?? 0,
    editando: false,
  };
}

function MiniStepper({ etiqueta, valor, min, max, onChange, tono }) {
  return (
    <div className={`mini-stepper ${tono || ''}`} role="group" aria-label={etiqueta}>
      <span className="mini-stepper-etiqueta">{etiqueta}</span>
      <div className="mini-stepper-ctl">
        <button
          type="button"
          className="mini-stepper-btn"
          aria-label={`Restar ${etiqueta.toLowerCase()}`}
          disabled={valor <= min}
          onClick={() => onChange(valor - 1)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true">
            <path d="M5 12h14" />
          </svg>
        </button>
        <span className="mini-stepper-valor">{valor}</span>
        <button
          type="button"
          className="mini-stepper-btn"
          aria-label={`Sumar ${etiqueta.toLowerCase()}`}
          disabled={valor >= max}
          onClick={() => onChange(valor + 1)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Ventana de paradas de una ruta: ver, buscar, agregar, editar, marcar fallidos y subir el PDF de Circuit.
// Todo se edita en memoria y se guarda con "Guardar cambios". No exige que cuadre con los totales de la ruta.
function ModalParadas({ ruta, onGuardado, onCerrar }) {
  const [filas, setFilas] = useState([]);
  const [respaldo, setRespaldo] = useState(null); // filas anteriores a importar un PDF (para deshacer)
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState([]);
  const [exito, setExito] = useState('');
  const [sucio, setSucio] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [confirmandoCierre, setConfirmandoCierre] = useState(false);

  const [agregando, setAgregando] = useState(false);
  const [nueva, setNueva] = useState({ direccion: '', hora: '', notas: '' });
  const [repetida, setRepetida] = useState(null); // uid de la parada que ya tiene esa dirección

  const listaRef = useRef(null);

  const titulo = `${formatearFecha(ruta.fecha)}${ruta.turno ? ` · ${ruta.turno}` : ''}`;

  useEffect(() => {
    let activo = true;
    obtenerParadas(ruta.id)
      .then((data) => {
        if (activo) setFilas(data.paradas.map(aFila));
      })
      .catch((err) => {
        if (activo) setError(err.response?.data?.error || 'No se pudieron cargar las paradas');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => { activo = false; };
  }, [ruta.id]);

  function pedirCierre() {
    if (guardando || subiendo) return;
    if (sucio) setConfirmandoCierre(true);
    else onCerrar();
  }

  useEffect(() => {
    function alTeclear(e) {
      if (e.key === 'Escape') pedirCierre();
    }
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  });

  function cambiar(uid, cambios) {
    setFilas((lista) => lista.map((f) => (f.uid === uid ? { ...f, ...cambios } : f)));
    setSucio(true);
    setExito('');
  }

  function cambiarCantidad(fila, cantidad) {
    cambiar(fila.uid, {
      cantidadPaquetes: cantidad,
      paquetesFallidos: Math.min(fila.paquetesFallidos, cantidad),
    });
  }

  function eliminar(uid) {
    setFilas((lista) => lista.filter((f) => f.uid !== uid));
    setSucio(true);
    setExito('');
  }

  function agregarFila(extra = {}) {
    const fila = aFila({ direccion: nueva.direccion.trim(), hora: nueva.hora, notas: nueva.notas.trim(), ...extra });
    setFilas((lista) => [...lista, fila]);
    setNueva({ direccion: '', hora: '', notas: '' });
    setRepetida(null);
    setSucio(true);
    setExito('');
    setBusqueda('');
    requestAnimationFrame(() => {
      const el = listaRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  function intentarAgregar(e) {
    e.preventDefault();
    const direccion = nueva.direccion.trim();
    if (!direccion) return;
    const clave = claveDireccion(direccion);
    const existente = filas.find((f) => claveDireccion(f.direccion) === clave);
    if (existente) {
      setRepetida(existente.uid);
      return;
    }
    agregarFila();
  }

  function sumarAExistente() {
    const existente = filas.find((f) => f.uid === repetida);
    if (existente) {
      cambiar(existente.uid, { cantidadPaquetes: Math.min(existente.cantidadPaquetes + 1, 99) });
    }
    setNueva({ direccion: '', hora: '', notas: '' });
    setRepetida(null);
  }

  async function handleArchivo(e) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setError('');
    setExito('');
    if (archivo.type !== 'application/pdf') {
      setError('Sube el PDF de la ruta exportado desde Circuit');
      return;
    }
    if (archivo.size > MAX_BYTES) {
      setError('El PDF supera los 5 MB');
      return;
    }
    setSubiendo(true);
    try {
      const data = await vistaPreviaParadas(ruta.id, archivo);
      setRespaldo(filas);
      setFilas(data.paradas.map(aFila));
      setAviso(data.advertencias || []);
      setSucio(true);
      setBusqueda('');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo leer el PDF');
    } finally {
      setSubiendo(false);
    }
  }

  function deshacerImportacion() {
    setFilas(respaldo || []);
    setRespaldo(null);
    setAviso([]);
    setSucio(true);
  }

  async function handleGuardar() {
    setError('');
    const sinDireccion = filas.find((f) => !f.direccion.trim());
    if (sinDireccion) {
      cambiar(sinDireccion.uid, { editando: true });
      setError('Hay una parada sin dirección. Complétala o elimínala.');
      return;
    }
    setGuardando(true);
    try {
      const data = await guardarParadas(
        ruta.id,
        filas.map((f) => ({
          direccion: f.direccion.trim(),
          hora: f.hora || null,
          notas: f.notas.trim(),
          cantidadPaquetes: Number(f.cantidadPaquetes),
          paquetesFallidos: Number(f.paquetesFallidos),
        }))
      );
      setFilas(data.paradas.map(aFila));
      setRespaldo(null);
      setAviso([]);
      setSucio(false);
      setExito('Paradas guardadas');
      onGuardado?.();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudieron guardar las paradas');
    } finally {
      setGuardando(false);
    }
  }

  const resumen = useMemo(() => {
    const paquetes = filas.reduce((s, f) => s + Number(f.cantidadPaquetes || 0), 0);
    const fallidos = filas.reduce((s, f) => s + Number(f.paquetesFallidos || 0), 0);
    return { paradas: filas.length, paquetes, fallidos };
  }, [filas]);

  const visibles = useMemo(() => {
    const indexadas = filas.map((fila, i) => ({ fila, numero: i + 1 }));
    const tokens = sinTildes(busqueda).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return indexadas;
    return indexadas.filter(({ fila }) => {
      const texto = `${claveDireccion(fila.direccion)} ${sinTildes(fila.direccion)} ${sinTildes(fila.notas)}`;
      return tokens.every((t) => texto.includes(t));
    });
  }, [filas, busqueda]);

  return (
    <div className="modal-overlay" onClick={() => !sucio && pedirCierre()}>
      <div
        className="modal-box paradas-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Paradas de la ruta del ${titulo}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="paradas-head">
          <div>
            <h3 className="modal-title" style={{ margin: 0 }}>Paradas · {titulo}</h3>
            <p className="paradas-resumen">
              {resumen.paradas} {resumen.paradas === 1 ? 'parada' : 'paradas'} · {resumen.paquetes} {resumen.paquetes === 1 ? 'paquete' : 'paquetes'}
              {resumen.fallidos > 0 && <> · <span className="paradas-resumen-fallido">{resumen.fallidos} {resumen.fallidos === 1 ? 'fallido' : 'fallidos'}</span></>}
            </p>
          </div>
          <button type="button" className="paradas-cerrar" onClick={pedirCierre} aria-label="Cerrar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="paradas-barra">
          <div className="paradas-buscador">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              type="search"
              placeholder="Buscar dirección o nota"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar parada"
            />
          </div>
          <button type="button" className="btn-ghost paradas-btn" onClick={() => { setAgregando((v) => !v); setRepetida(null); }} aria-expanded={agregando}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Agregar
          </button>
          <label className={`btn-ghost paradas-btn paradas-subir ${subiendo ? 'ocupado' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 16V4" />
              <path d="M7 9l5-5 5 5" />
              <path d="M5 20h14" />
            </svg>
            {subiendo ? 'Leyendo...' : 'Subir PDF'}
            <input type="file" accept="application/pdf" onChange={handleArchivo} disabled={subiendo || guardando} />
          </label>
        </div>

        {agregando && (
          <form className="paradas-nueva" onSubmit={intentarAgregar}>
            <div className="field">
              <span className="field-label">Dirección</span>
              <input
                type="text"
                value={nueva.direccion}
                onChange={(e) => { setNueva({ ...nueva, direccion: e.target.value }); setRepetida(null); }}
                placeholder="Ej. Laguna Centro"
                maxLength={200}
                autoFocus
              />
            </div>
            <div className="paradas-fila-doble">
              <div className="field">
                <span className="field-label">Hora (opcional)</span>
                <input type="time" value={nueva.hora} onChange={(e) => setNueva({ ...nueva, hora: e.target.value })} />
              </div>
              <div className="field">
                <span className="field-label">Notas (opcional)</span>
                <input type="text" value={nueva.notas} onChange={(e) => setNueva({ ...nueva, notas: e.target.value })} maxLength={200} placeholder="Ej. 23 BB M" />
              </div>
            </div>
            {repetida && (
              <p className="paradas-aviso">
                Esa dirección ya está en la lista. ¿Es otro paquete en el mismo punto?
                <span className="paradas-aviso-acciones">
                  <button type="button" className="btn-primary paradas-mini-accion" onClick={sumarAExistente}>Sumar 1 paquete</button>
                  <button type="button" className="btn-ghost paradas-mini-accion" onClick={() => agregarFila()}>Agregar igual</button>
                </span>
              </p>
            )}
            {!repetida && (
              <div className="paradas-nueva-acciones">
                <button type="button" className="btn-ghost paradas-mini-accion" onClick={() => setAgregando(false)}>Cerrar</button>
                <button type="submit" className="btn-primary paradas-mini-accion" disabled={!nueva.direccion.trim()}>Agregar parada</button>
              </div>
            )}
          </form>
        )}

        {respaldo && (
          <div className="paradas-importado">
            <span>PDF leído: {filas.length} paradas. Revísalas y guarda.{respaldo.length > 0 && ` Reemplaza las ${respaldo.length} anteriores.`}</span>
            <button type="button" className="paradas-link" onClick={deshacerImportacion}>Deshacer</button>
          </div>
        )}
        {aviso.map((a) => <p key={a} className="paradas-aviso">⚠ {a}</p>)}
        {error && <p className="form-error" role="alert">{error}</p>}
        {exito && !sucio && <p className="form-success paradas-exito" role="status">✓ {exito}</p>}

        <div className="paradas-lista" ref={listaRef}>
          {cargando ? (
            <p className="empty-state">Cargando paradas...</p>
          ) : filas.length === 0 ? (
            <div className="paradas-vacio">
              <p>Esta ruta aún no tiene paradas.</p>
              <p className="paradas-vacio-sub">Sube el PDF que te da Circuit o agrégalas a mano con el botón "Agregar".</p>
            </div>
          ) : visibles.length === 0 ? (
            <p className="empty-state">Ninguna parada coincide con "{busqueda}".</p>
          ) : (
            <ul>
              {visibles.map(({ fila, numero }) => (
                <li key={fila.uid} className={`parada ${fila.paquetesFallidos > 0 ? 'con-fallidos' : ''}`}>
                  {fila.editando ? (
                    <div className="parada-edicion">
                      <div className="field">
                        <span className="field-label">Dirección</span>
                        <input type="text" value={fila.direccion} maxLength={200} onChange={(e) => cambiar(fila.uid, { direccion: e.target.value })} />
                      </div>
                      <div className="paradas-fila-doble">
                        <div className="field">
                          <span className="field-label">Hora</span>
                          <input type="time" value={fila.hora} onChange={(e) => cambiar(fila.uid, { hora: e.target.value })} />
                        </div>
                        <div className="field">
                          <span className="field-label">Notas</span>
                          <input type="text" value={fila.notas} maxLength={200} onChange={(e) => cambiar(fila.uid, { notas: e.target.value })} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="parada-info">
                      <div className="parada-linea">
                        <span className="parada-n">{numero}</span>
                        <span className="parada-dir">{fila.direccion || 'Sin dirección'}</span>
                      </div>
                      <div className="parada-meta">
                        {fila.hora ? (
                          <span className="parada-hora">{fila.hora}</span>
                        ) : fila.horaDudosa ? (
                          <span className="parada-hora dudosa" title="La hora real del PDF no es confiable">
                            Sin hora{fila.horaEstimada ? ` (estimada ${fila.horaEstimada})` : ''}
                          </span>
                        ) : null}
                        {fila.notas && <span className="parada-notas">{fila.notas}</span>}
                      </div>
                    </div>
                  )}

                  <div className="parada-controles">
                    <MiniStepper
                      etiqueta="Paquetes"
                      valor={fila.cantidadPaquetes}
                      min={1}
                      max={99}
                      onChange={(v) => cambiarCantidad(fila, v)}
                    />
                    <MiniStepper
                      etiqueta="Fallidos"
                      valor={fila.paquetesFallidos}
                      min={0}
                      max={fila.cantidadPaquetes}
                      tono="fallidos"
                      onChange={(v) => cambiar(fila.uid, { paquetesFallidos: v })}
                    />
                    <div className="parada-iconos">
                      <button
                        type="button"
                        className="parada-icono"
                        aria-label={fila.editando ? 'Terminar de editar' : 'Editar parada'}
                        title={fila.editando ? 'Listo' : 'Editar'}
                        onClick={() => setFilas((l) => l.map((f) => (f.uid === fila.uid ? { ...f, editando: !f.editando } : f)))}
                      >
                        {fila.editando ? (
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M5 12.5l4.5 4.5L19 7.5" />
                          </svg>
                        ) : (
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        )}
                      </button>
                      <button type="button" className="parada-icono borrar" aria-label="Eliminar parada" title="Eliminar" onClick={() => eliminar(fila.uid)}>
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M3 6h18" />
                          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {confirmandoCierre ? (
          <div className="paradas-pie paradas-cierre">
            <span>Tienes cambios sin guardar.</span>
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setConfirmandoCierre(false)}>Seguir editando</button>
              <button type="button" className="btn-danger" onClick={onCerrar}>Descartar y cerrar</button>
            </div>
          </div>
        ) : (
          <div className="paradas-pie">
            <button type="button" className="btn-ghost" onClick={pedirCierre} disabled={guardando}>Cerrar</button>
            <button type="button" className="btn-primary" onClick={handleGuardar} disabled={!sucio || guardando || subiendo}>
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ModalParadas;
