import { useState } from 'react';
import { formatoPeso } from '../utils/resumenSemanal';
import '../styles/selector-retiros.css';

const PRECIO_DEFAULT = '1500';

function limitarMonto(valor) {
  return valor.replace(/\D/g, '').slice(0, 8);
}

// Checklist de retiros por zona. `seleccionados` es la lista de ids marcados (estado en el padre).
function SelectorRetiros({
  puntos,
  seleccionados,
  onCambiarSeleccion,
  onCrear,
  onActualizar,
  onQuitar,
  cargando,
  errorCarga,
}) {
  const [zonaElegida, setZonaElegida] = useState('');
  const [gestionando, setGestionando] = useState(false);

  const [creando, setCreando] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [precioNuevo, setPrecioNuevo] = useState(PRECIO_DEFAULT);
  const [zonaNueva, setZonaNueva] = useState('');

  const [editandoId, setEditandoId] = useState(null);
  const [editNombre, setEditNombre] = useState('');
  const [editPrecio, setEditPrecio] = useState('');
  const [quitandoId, setQuitandoId] = useState(null);

  const [errorForm, setErrorForm] = useState('');
  const [guardando, setGuardando] = useState(false);

  const zonas = [...new Set(puntos.map((p) => p.zona))];
  const zonaActiva = zonas.includes(zonaElegida) ? zonaElegida : (zonas[0] || '');
  const puntosZona = puntos.filter((p) => p.zona === zonaActiva);
  const idsZona = puntosZona.map((p) => p.id);
  const todosMarcados = idsZona.length > 0 && idsZona.every((id) => seleccionados.includes(id));

  function alternar(id) {
    onCambiarSeleccion(
      seleccionados.includes(id) ? seleccionados.filter((x) => x !== id) : [...seleccionados, id]
    );
  }

  function alternarTodos() {
    if (todosMarcados) {
      onCambiarSeleccion(seleccionados.filter((id) => !idsZona.includes(id)));
    } else {
      onCambiarSeleccion([...new Set([...seleccionados, ...idsZona])]);
    }
  }

  function alternarGestion() {
    setGestionando((v) => !v);
    setEditandoId(null);
    setQuitandoId(null);
    setCreando(false);
    setErrorForm('');
  }

  function abrirNuevo() {
    setCreando(true);
    setNombreNuevo('');
    setPrecioNuevo(PRECIO_DEFAULT);
    setZonaNueva(zonaActiva);
    setErrorForm('');
  }

  async function guardarNuevo() {
    const nombre = nombreNuevo.trim();
    const zona = zonaNueva.trim();
    const precio = Number(precioNuevo);

    if (!nombre) return setErrorForm('Ingresa el nombre del retiro');
    if (!zona) return setErrorForm('Ingresa la zona');
    if (!precio || precio <= 0) return setErrorForm('Ingresa un precio válido');

    setGuardando(true);
    setErrorForm('');
    try {
      const nuevo = await onCrear({ nombre, zona, precio });
      setZonaElegida(nuevo.zona);
      // Si lo creas mientras registras un turno, queda marcado para ese turno
      if (!gestionando && !seleccionados.includes(nuevo.id)) {
        onCambiarSeleccion([...seleccionados, nuevo.id]);
      }
      setCreando(false);
    } catch (err) {
      setErrorForm(err.response?.data?.error || 'No se pudo crear el retiro');
    } finally {
      setGuardando(false);
    }
  }

  function empezarEdicion(p) {
    setEditandoId(p.id);
    setEditNombre(p.nombre);
    setEditPrecio(String(Math.round(Number(p.precio))));
    setQuitandoId(null);
    setErrorForm('');
  }

  async function guardarEdicion(id) {
    const nombre = editNombre.trim();
    const precio = Number(editPrecio);

    if (!nombre) return setErrorForm('Ingresa el nombre del retiro');
    if (!precio || precio <= 0) return setErrorForm('Ingresa un precio válido');

    setGuardando(true);
    setErrorForm('');
    try {
      await onActualizar(id, { nombre, precio });
      setEditandoId(null);
    } catch (err) {
      setErrorForm(err.response?.data?.error || 'No se pudo actualizar el retiro');
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarQuitar(id) {
    setGuardando(true);
    setErrorForm('');
    try {
      await onQuitar(id);
      onCambiarSeleccion(seleccionados.filter((x) => x !== id));
      setQuitandoId(null);
    } catch (err) {
      setErrorForm(err.response?.data?.error || 'No se pudo quitar el retiro');
    } finally {
      setGuardando(false);
    }
  }

  // Los campos viven dentro del <form> del panel: Enter no debe enviar el registro del turno
  function manejarEnter(e, accion) {
    if (e.key === 'Enter') {
      e.preventDefault();
      accion();
    }
  }

  return (
    <div className="retiros-sel">
      <div className="retiros-head">
        <span className="field-label">Retiros del turno</span>
        {puntos.length > 0 && (
          <button type="button" className="retiros-link" onClick={alternarGestion}>
            {gestionando ? 'Listo' : 'Gestionar'}
          </button>
        )}
      </div>

      {cargando && <p className="retiros-hint">Cargando retiros...</p>}
      {!cargando && errorCarga && <p className="retiros-error">{errorCarga}</p>}

      {!cargando && !errorCarga && puntos.length === 0 && !creando && (
        <p className="retiros-hint">Aún no tienes retiros guardados. Crea el primero para poder marcarlo cada día.</p>
      )}

      {!cargando && zonas.length > 0 && (
        <div className="retiros-zonas" role="tablist" aria-label="Zona">
          {zonas.map((z) => {
            const delaZona = puntos.filter((p) => p.zona === z);
            const marcados = delaZona.filter((p) => seleccionados.includes(p.id)).length;
            return (
              <button
                type="button"
                role="tab"
                key={z}
                aria-selected={z === zonaActiva}
                className={`retiros-zona ${z === zonaActiva ? 'active' : ''}`}
                onClick={() => setZonaElegida(z)}
              >
                {z}
                <span className="retiros-zona-count">{marcados}/{delaZona.length}</span>
              </button>
            );
          })}
        </div>
      )}

      {!cargando && puntosZona.length > 0 && (
        <ul className="retiros-lista">
          {puntosZona.map((p) => {
            if (!gestionando) {
              const marcado = seleccionados.includes(p.id);
              return (
                <li key={p.id}>
                  <label className={`retiro-item ${marcado ? 'marcado' : ''}`}>
                    <input type="checkbox" checked={marcado} onChange={() => alternar(p.id)} />
                    <span className="retiro-nombre">{p.nombre}</span>
                    <span className="retiro-precio">${formatoPeso(p.precio)}</span>
                  </label>
                </li>
              );
            }

            if (editandoId === p.id) {
              return (
                <li key={p.id} className="retiro-item retiro-editando">
                  <input
                    type="text"
                    maxLength={60}
                    value={editNombre}
                    onChange={(e) => setEditNombre(e.target.value)}
                    onKeyDown={(e) => manejarEnter(e, () => guardarEdicion(p.id))}
                    aria-label="Nombre del retiro"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    className="retiro-input-precio"
                    value={editPrecio}
                    onChange={(e) => setEditPrecio(limitarMonto(e.target.value))}
                    onKeyDown={(e) => manejarEnter(e, () => guardarEdicion(p.id))}
                    aria-label="Precio"
                  />
                  <button type="button" className="retiro-accion ok" disabled={guardando} onClick={() => guardarEdicion(p.id)}>Guardar</button>
                  <button type="button" className="retiro-accion" onClick={() => setEditandoId(null)}>Cancelar</button>
                </li>
              );
            }

            return (
              <li key={p.id} className="retiro-item retiro-gestion">
                <span className="retiro-nombre">{p.nombre}</span>
                <span className="retiro-precio">${formatoPeso(p.precio)}</span>
                {quitandoId === p.id ? (
                  <>
                    <span className="retiro-confirma">¿Quitar?</span>
                    <button type="button" className="retiro-accion peligro" disabled={guardando} onClick={() => confirmarQuitar(p.id)}>Sí</button>
                    <button type="button" className="retiro-accion" onClick={() => setQuitandoId(null)}>No</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="retiro-icono" onClick={() => empezarEdicion(p)} aria-label={`Editar ${p.nombre}`} title="Editar">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </button>
                    <button type="button" className="retiro-icono peligro" onClick={() => { setQuitandoId(p.id); setEditandoId(null); }} aria-label={`Quitar ${p.nombre}`} title="Quitar">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 6h18" />
                        <path d="M8 6V4h8v2" />
                        <path d="M19 6l-1 14H6L5 6" />
                      </svg>
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!gestionando && puntosZona.length > 1 && (
        <button type="button" className="retiros-link retiros-todos" onClick={alternarTodos}>
          {todosMarcados ? `Quitar todos de ${zonaActiva}` : `Marcar todos de ${zonaActiva}`}
        </button>
      )}

      {errorForm && !creando && <p className="retiros-error">{errorForm}</p>}

      {!cargando && !errorCarga && !creando && (
        <button type="button" className="btn-sin-actividad retiros-nuevo-btn" onClick={abrirNuevo}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nuevo retiro
        </button>
      )}

      {creando && (
        <div className="retiros-nuevo">
          <div className="field">
            <span className="field-label">Nombre</span>
            <input
              type="text"
              maxLength={60}
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              onKeyDown={(e) => manejarEnter(e, guardarNuevo)}
              placeholder="Ej: Feroz Chocolate"
              autoFocus
            />
          </div>
          <div className="field-row">
            <div className="field">
              <span className="field-label">Precio</span>
              <input
                type="text"
                inputMode="numeric"
                value={precioNuevo}
                onChange={(e) => setPrecioNuevo(limitarMonto(e.target.value))}
                onKeyDown={(e) => manejarEnter(e, guardarNuevo)}
              />
            </div>
            <div className="field">
              <span className="field-label">Zona</span>
              <input
                type="text"
                list="retiros-zonas-lista"
                maxLength={40}
                value={zonaNueva}
                onChange={(e) => setZonaNueva(e.target.value)}
                onKeyDown={(e) => manejarEnter(e, guardarNuevo)}
                placeholder="Ej: Las Condes"
              />
              <datalist id="retiros-zonas-lista">
                {zonas.map((z) => <option key={z} value={z} />)}
              </datalist>
            </div>
          </div>
          {errorForm && <p className="retiros-error">{errorForm}</p>}
          <div className="retiros-nuevo-acciones">
            <button type="button" className="btn-primary" disabled={guardando} onClick={guardarNuevo}>
              {guardando ? 'Guardando...' : 'Guardar retiro'}
            </button>
            <button type="button" className="retiros-link" onClick={() => { setCreando(false); setErrorForm(''); }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SelectorRetiros;
