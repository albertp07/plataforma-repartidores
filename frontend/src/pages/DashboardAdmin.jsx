import { useState, useEffect, Fragment } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { obtenerTodasLasTransacciones, eliminarTransaccion } from '../services/transaccionService';
import { obtenerUsuariosPendientes, actualizarEstadoUsuario } from '../services/usuarioService';
import ModalConfirmar from '../components/ModalConfirmar';
import SelectorFecha from '../components/SelectorFecha';
import {
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import '../styles/shared.css';

const chartTooltipStyle = {
  background: '#1B2126',
  border: '1px solid #2A3238',
  borderRadius: '8px',
  fontSize: '13px',
};

const PERIODOS = [
  { id: 'TODO', label: 'Todo' },
  { id: 'SEMANA', label: 'Esta semana' },
  { id: 'MES', label: 'Este mes' },
  { id: 'RANGO', label: 'Rango de fechas' },
];

const TURNOS_FILTRO = [
  { id: 'TODOS', label: 'Todos los turnos' },
  { id: 'AM', label: 'Turno AM' },
  { id: 'PM', label: 'Turno PM' },
];

const TABS = [
  { id: 'RESUMEN', label: 'Resumen' },
  { id: 'PENDIENTES', label: 'Solicitudes Pendientes' },
];

function formatoPeso(valor) {
  return Math.round(valor).toLocaleString('es-CL');
}

function ordenTipoMovimiento(m) {
  if (m.tipo === 'GASTO') return 0;
  if (m.categoriaIngreso === 'PAQUETES') return 1;
  if (m.categoriaIngreso === 'RETIROS') return 2;
  return 3;
}

function ordenarMovimientos(lista) {
  return [...lista].sort((a, b) => {
    const diaA = new Date(a.fecha).toISOString().slice(0, 10);
    const diaB = new Date(b.fecha).toISOString().slice(0, 10);
    if (diaA !== diaB) return diaA < diaB ? 1 : -1;
    return ordenTipoMovimiento(a) - ordenTipoMovimiento(b);
  });
}

function formatoDia(iso) {
  return new Date(`${iso}T12:00:00.000Z`).toLocaleDateString();
}

// Texto de la celda AM/PM del detalle diario de un repartidor
function textoCeldaTurno(dia, turno) {
  if (dia.activos[turno]) return `$${formatoPeso(dia[turno])}`;
  if (dia.sinActividad[turno]) return 'Sin actividad';
  return '—';
}

function etiquetaTipo(t) {
  if (t.sinActividad) {
    return { clase: 'sin-actividad', texto: t.categoriaIngreso === 'RETIROS' ? 'SIN RETIRO' : 'SIN REPARTO' };
  }
  return { clase: t.tipo === 'INGRESO' ? 'ingreso' : 'gasto', texto: t.tipo };
}

function formatoDescripcionMovimiento(m) {
  if (m.sinActividad) return m.descripcion || 'Sin actividad';
  if (m.categoriaIngreso !== 'PAQUETES' || m.cantidadPaquetes == null) {
    return m.descripcion || '-';
  }
  const partes = [`${m.cantidadPaquetes} entregadas`];
  if (m.paquetesSobredimensionados) partes.push(`${m.paquetesSobredimensionados} S/D`);
  if (m.paquetesFallidos) partes.push(`${m.paquetesFallidos} fallidas`);
  const total = m.paquetesTotalSalida ?? (m.cantidadPaquetes + (m.paquetesFallidos || 0));
  return `Reparto · ${partes.join(' / ')} de ${total} totales`;
}

// Convierte "DD-MM-AAAA" en Date local (00:00) o null si no es una fecha válida
function parseDDMMYYYY(texto) {
  const match = (texto || '').match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const fecha = new Date(Number(y), Number(m) - 1, Number(d));
  if (
    fecha.getFullYear() !== Number(y) ||
    fecha.getMonth() !== Number(m) - 1 ||
    fecha.getDate() !== Number(d)
  ) {
    return null;
  }
  return fecha;
}

function inicioSemanaActual() {
  const hoy = new Date();
  const dia = hoy.getDay();
  const diff = (dia === 0 ? -6 : 1) - dia;
  const inicio = new Date(hoy);
  inicio.setDate(hoy.getDate() + diff);
  inicio.setHours(0, 0, 0, 0);
  return inicio;
}

// offset 0 = semana actual, 1 = semana pasada, etc.
function rangoSemana(offset) {
  const inicio = inicioSemanaActual();
  inicio.setDate(inicio.getDate() - offset * 7);
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 6);
  fin.setHours(23, 59, 59, 999);
  return { inicio, fin };
}

function formatoRangoSemana(offset) {
  const { inicio, fin } = rangoSemana(offset);
  const fmt = (d) => d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
  return `${fmt(inicio)} al ${fmt(fin)}`;
}

function inicioMesActual() {
  const hoy = new Date();
  return new Date(hoy.getFullYear(), hoy.getMonth(), 1, 0, 0, 0, 0);
}

function DashboardAdmin() {
  const { usuario, cerrarSesion } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('RESUMEN');

  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [periodo, setPeriodo] = useState('TODO');
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [modoMovimientos, setModoMovimientos] = useState('SEMANA');
  const [movDesde, setMovDesde] = useState('');
  const [movHasta, setMovHasta] = useState('');

  const [transaccionAEliminar, setTransaccionAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);
  const [filaExpandida, setFilaExpandida] = useState(null);
  const [filtroTurno, setFiltroTurno] = useState('TODOS');
  const [repartidorExpandido, setRepartidorExpandido] = useState(null);
  const [mostrarConfirmarLogout, setMostrarConfirmarLogout] = useState(false);

  const [pendientes, setPendientes] = useState([]);
  const [cargandoPendientes, setCargandoPendientes] = useState(true);
  const [procesandoId, setProcesandoId] = useState(null);
  const [errorPendientes, setErrorPendientes] = useState('');

  useEffect(() => {
    document.title = 'Aryal - Dashboard';
  }, []);

  useEffect(() => {
    cargarDatos();
    cargarPendientes();
  }, []);

  async function cargarDatos() {
    try {
      const data = await obtenerTodasLasTransacciones();
      setMovimientos(data);
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  }

  async function cargarPendientes() {
    setCargandoPendientes(true);
    setErrorPendientes('');
    try {
      const data = await obtenerUsuariosPendientes();
      setPendientes(data);
    } catch (err) {
      console.error(err);
      setErrorPendientes('No se pudieron cargar las solicitudes pendientes.');
    } finally {
      setCargandoPendientes(false);
    }
  }

  async function handleAprobar(id) {
    setProcesandoId(id);
    try {
      await actualizarEstadoUsuario(id, 'ACTIVO');
      setPendientes((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      console.error(err);
      setErrorPendientes('No se pudo aprobar la solicitud. Intenta de nuevo.');
    } finally {
      setProcesandoId(null);
    }
  }

  async function handleRechazar(id) {
    setProcesandoId(id);
    try {
      await actualizarEstadoUsuario(id, 'RECHAZADO');
      setPendientes((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      console.error(err);
      setErrorPendientes('No se pudo rechazar la solicitud. Intenta de nuevo.');
    } finally {
      setProcesandoId(null);
    }
  }

  function handleLogout() {
    setMostrarConfirmarLogout(true);
  }

  function handleConfirmarLogout() {
    setMostrarConfirmarLogout(false);
    cerrarSesion();
    navigate('/');
  }

  function toggleFila(id) {
    setFilaExpandida(filaExpandida === id ? null : id);
  }

  async function handleConfirmarEliminar() {
    setEliminando(true);
    try {
      await eliminarTransaccion(transaccionAEliminar.id);
      setTransaccionAEliminar(null);
      cargarDatos();
    } catch (err) {
      console.error(err);
    } finally {
      setEliminando(false);
    }
  }

  // Filtro por período (incluye rango personalizado desde/hasta, ambos días inclusive)
  const desdeDate = parseDDMMYYYY(fechaDesde);
  const hastaDate = parseDDMMYYYY(fechaHasta);
  const rangoInvalido = !!desdeDate && !!hastaDate && desdeDate > hastaDate;

  const movimientosFiltrados = movimientos.filter((m) => {
    if (periodo === 'TODO') return true;
    const fecha = new Date(m.fecha);
    if (periodo === 'RANGO') {
      if (rangoInvalido) return false;
      if (desdeDate && fecha < desdeDate) return false;
      if (hastaDate) {
        const finDia = new Date(hastaDate);
        finDia.setHours(23, 59, 59, 999);
        if (fecha > finDia) return false;
      }
      return true;
    }
    const limite = periodo === 'SEMANA' ? inicioSemanaActual() : inicioMesActual();
    return fecha >= limite;
  });

  // "Todos los movimientos": navegación semana por semana (lunes a domingo), independiente del filtro de período
  const { inicio: inicioSemanaVista, fin: finSemanaVista } = rangoSemana(semanaOffset);
  const movDesdeDate = parseDDMMYYYY(movDesde);
  const movHastaDate = parseDDMMYYYY(movHasta);
  const movRangoInvalido = !!movDesdeDate && !!movHastaDate && movDesdeDate > movHastaDate;

  const movimientosSemana = movimientos.filter((m) => {
    const fecha = new Date(m.fecha);
    if (modoMovimientos === 'RANGO') {
      if (movRangoInvalido) return false;
      if (movDesdeDate && fecha < movDesdeDate) return false;
      if (movHastaDate) {
        const finDia = new Date(movHastaDate);
        finDia.setHours(23, 59, 59, 999);
        if (fecha > finDia) return false;
      }
      return true;
    }
    return fecha >= inicioSemanaVista && fecha <= finSemanaVista;
  });

  // El filtro por turno aplica solo a ingresos (los gastos no se asignan a un turno)
  const movimientosVista = filtroTurno === 'TODOS'
    ? movimientosSemana
    : movimientosSemana.filter((m) => m.turno === filtroTurno);

  // Resumen general (recalculado según el período)
  const totalIngresos = movimientosFiltrados
    .filter((m) => m.tipo === 'INGRESO')
    .reduce((sum, m) => sum + Number(m.monto), 0);
  const totalGastos = movimientosFiltrados
    .filter((m) => m.tipo === 'GASTO')
    .reduce((sum, m) => sum + Number(m.monto), 0);
  const repartidoresUnicos = new Set(movimientosFiltrados.map((m) => m.repartidorId));

  // Balance por repartidor (recalculado según el período)
  const porRepartidorMap = {};
  movimientosFiltrados.forEach((m) => {
    const id = m.repartidorId;
    if (!porRepartidorMap[id]) {
      porRepartidorMap[id] = {
        repartidorId: id,
        nombre: m.repartidor.usuario.nombre,
        email: m.repartidor.usuario.email,
        totalIngresos: 0,
        totalGastos: 0,
        cantidadTransacciones: 0,
      };
    }
    if (m.tipo === 'INGRESO') porRepartidorMap[id].totalIngresos += Number(m.monto);
    else porRepartidorMap[id].totalGastos += Number(m.monto);
    porRepartidorMap[id].cantidadTransacciones += 1;
  });
  const porRepartidor = Object.values(porRepartidorMap).map((r) => ({
    ...r,
    balance: r.totalIngresos - r.totalGastos,
  }));

  // Detalle por repartidor y día, con los ingresos separados por turno (AM / PM)
  const detalleDiasMap = {};
  movimientosFiltrados.forEach((m) => {
    const id = m.repartidorId;
    const key = new Date(m.fecha).toISOString().split('T')[0];
    if (!detalleDiasMap[id]) detalleDiasMap[id] = {};
    if (!detalleDiasMap[id][key]) {
      detalleDiasMap[id][key] = {
        fecha: key,
        AM: 0,
        PM: 0,
        SIN: 0,
        gastos: 0,
        activos: { AM: false, PM: false },
        sinActividad: { AM: false, PM: false },
      };
    }
    const dia = detalleDiasMap[id][key];
    if (m.tipo === 'GASTO') {
      dia.gastos += Number(m.monto);
      return;
    }
    dia[m.turno || 'SIN'] += Number(m.monto);
    if (m.turno) {
      if (m.sinActividad) dia.sinActividad[m.turno] = true;
      else dia.activos[m.turno] = true;
    }
  });
  const detalleDias = (repartidorId) =>
    Object.values(detalleDiasMap[repartidorId] || {}).sort((a, b) => b.fecha.localeCompare(a.fecha));

  // Movimientos por fecha (recalculado según el período)
  const porFechaMap = {};
  movimientosFiltrados.forEach((m) => {
    const key = new Date(m.fecha).toISOString().split('T')[0];
    if (!porFechaMap[key]) {
      porFechaMap[key] = { fecha: key, ingresos: 0, gastos: 0 };
    }
    if (m.tipo === 'INGRESO') porFechaMap[key].ingresos += Number(m.monto);
    else porFechaMap[key].gastos += Number(m.monto);
  });
  const porFecha = Object.values(porFechaMap).sort((a, b) => a.fecha.localeCompare(b.fecha));

  if (cargando) {
    return <div className="app-shell"><p className="empty-state">Cargando...</p></div>;
  }

  return (
    <div className="app-shell">
      <div className="app-container">
        <div className="app-topbar">
          <div>
            <h1>Panel Administrativo</h1>
            <p className="app-user">Bienvenido, {usuario?.nombre}</p>
          </div>
          <div className="topbar-actions">
            <button className="btn-ghost" onClick={() => navigate('/panel')}>
              Ver Panel Repartidor
            </button>
            <button className="btn-ghost" onClick={handleLogout}>Cerrar sesión</button>
          </div>
        </div>

        <div className="period-selector">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`period-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.id === 'PENDIENTES' && pendientes.length > 0 ? ` (${pendientes.length})` : ''}
            </button>
          ))}
        </div>

        {tab === 'PENDIENTES' ? (
          <>
            <p className="section-title">Solicitudes Pendientes</p>
            {errorPendientes && (
              <p className="login-error" role="alert" style={{ marginBottom: '12px' }}>
                {errorPendientes}
              </p>
            )}
            {cargandoPendientes ? (
              <p className="empty-state">Cargando solicitudes...</p>
            ) : pendientes.length === 0 ? (
              <p className="empty-state">No hay solicitudes pendientes.</p>
            ) : (
              <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Teléfono</th>
                    <th>Vehículo</th>
                    <th>Solicitado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pendientes.map((u) => (
                    <tr key={u.id}>
                      <td>{u.nombre}</td>
                      <td>{u.email}</td>
                      <td>{u.repartidor?.telefono || '-'}</td>
                      <td>{u.repartidor?.vehiculo || '-'}</td>
                      <td>{new Date(u.creadoEn).toLocaleDateString()}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="btn-primary"
                            disabled={procesandoId === u.id}
                            onClick={() => handleAprobar(u.id)}
                          >
                            🟢 Aprobar
                          </button>
                          <button
                            className="btn-danger"
                            disabled={procesandoId === u.id}
                            onClick={() => handleRechazar(u.id)}
                          >
                            🔴 Rechazar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="period-selector">
              {PERIODOS.map((p) => (
                <button
                  key={p.id}
                  className={`period-btn ${periodo === p.id ? 'active' : ''}`}
                  onClick={() => setPeriodo(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {periodo === 'RANGO' && (
              <div className="range-filter">
                <div className="field range-field">
                  <label className="field-label" htmlFor="filtro-desde">Desde</label>
                  <SelectorFecha
                    id="filtro-desde"
                    value={fechaDesde}
                    onChange={setFechaDesde}
                    maxDate={hastaDate && !rangoInvalido ? hastaDate : undefined}
                  />
                </div>
                <div className="field range-field">
                  <label className="field-label" htmlFor="filtro-hasta">Hasta</label>
                  <SelectorFecha
                    id="filtro-hasta"
                    value={fechaHasta}
                    onChange={setFechaHasta}
                    minDate={desdeDate || undefined}
                  />
                </div>
                {(fechaDesde || fechaHasta) && (
                  <button
                    type="button"
                    className="btn-ghost range-clear"
                    onClick={() => { setFechaDesde(''); setFechaHasta(''); }}
                  >
                    Limpiar
                  </button>
                )}
                {rangoInvalido && (
                  <p className="login-error range-error" role="alert">
                    La fecha "Desde" no puede ser posterior a "Hasta".
                  </p>
                )}
              </div>
            )}

            <div className="stat-grid">
              <div className="stat-card green">
                <p className="stat-label">Ingresos totales</p>
                <p className="stat-value">${formatoPeso(totalIngresos)}</p>
              </div>
              <div className="stat-card red">
                <p className="stat-label">Gastos totales</p>
                <p className="stat-value">${formatoPeso(totalGastos)}</p>
              </div>
              <div className="stat-card amber">
                <p className="stat-label">Balance</p>
                <p className="stat-value">${formatoPeso(totalIngresos - totalGastos)}</p>
              </div>
              <div className="stat-card neutral">
                <p className="stat-label">Repartidores activos</p>
                <p className="stat-value">{repartidoresUnicos.size}</p>
              </div>
            </div>

            <p className="section-title">Ingresos y gastos en el tiempo</p>
            <div className="chart-wrap">
              <ResponsiveContainer>
                <LineChart data={porFecha}>
                  <CartesianGrid stroke="#2A3238" strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" stroke="#8B98A1" fontSize={12} />
                  <YAxis stroke="#8B98A1" fontSize={12} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '13px' }} />
                  <Line type="monotone" dataKey="ingresos" stroke="#4ADE80" name="Ingresos" strokeWidth={2} />
                  <Line type="monotone" dataKey="gastos" stroke="#FF7A6E" name="Gastos" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <p className="section-title">Detalle por repartidor</p>
            <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Ingresos</th>
                  <th>Gastos</th>
                  <th>Balance</th>
                  <th>Movimientos</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {porRepartidor.length === 0 ? (
                  <tr><td colSpan={7} className="empty-state">Sin movimientos en este período.</td></tr>
                ) : (
                  porRepartidor.map((r) => {
                    const dias = detalleDias(r.repartidorId);
                    const diasDobles = dias.filter((d) => d.activos.AM && d.activos.PM).length;
                    const tieneSinTurno = dias.some((d) => d.SIN > 0);
                    const abierto = repartidorExpandido === r.repartidorId;
                    return (
                      <Fragment key={r.repartidorId}>
                        <tr
                          className="row-clickable"
                          onClick={() => setRepartidorExpandido(abierto ? null : r.repartidorId)}
                        >
                          <td>
                            {r.nombre}
                            {diasDobles > 0 && (
                              <span className="tag turno-doble" title="Días en que hizo ruta AM y PM">
                                AM+PM · {diasDobles}
                              </span>
                            )}
                          </td>
                          <td>{r.email}</td>
                          <td>${formatoPeso(r.totalIngresos)}</td>
                          <td>${formatoPeso(r.totalGastos)}</td>
                          <td>${formatoPeso(r.balance)}</td>
                          <td>{r.cantidadTransacciones}</td>
                          <td><span className={`row-caret ${abierto ? 'open' : ''}`}>▾</span></td>
                        </tr>
                        {abierto && (
                          <tr className="row-detail">
                            <td colSpan={7}>
                              <table className="data-table detalle-turnos">
                                <thead>
                                  <tr>
                                    <th>Fecha</th>
                                    <th>Ruta AM</th>
                                    <th>Ruta PM</th>
                                    {tieneSinTurno && <th>Sin turno</th>}
                                    <th>Total ingresos</th>
                                    <th>Gastos</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {dias.map((d) => (
                                    <tr key={d.fecha}>
                                      <td>
                                        {formatoDia(d.fecha)}
                                        {d.activos.AM && d.activos.PM && (
                                          <span className="tag turno-doble">AM+PM</span>
                                        )}
                                      </td>
                                      <td className={d.activos.AM ? '' : 'celda-muted'}>{textoCeldaTurno(d, 'AM')}</td>
                                      <td className={d.activos.PM ? '' : 'celda-muted'}>{textoCeldaTurno(d, 'PM')}</td>
                                      {tieneSinTurno && (
                                        <td className={d.SIN > 0 ? '' : 'celda-muted'}>
                                          {d.SIN > 0 ? `$${formatoPeso(d.SIN)}` : '—'}
                                        </td>
                                      )}
                                      <td>${formatoPeso(d.AM + d.PM + d.SIN)}</td>
                                      <td>{d.gastos > 0 ? `$${formatoPeso(d.gastos)}` : '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '28px', marginBottom: '14px' }}>
              <p className="section-title" style={{ margin: 0 }}>Todos los movimientos</p>
              <div className="period-selector" style={{ margin: 0 }}>
                <button
                  type="button"
                  className={`period-btn ${modoMovimientos === 'SEMANA' ? 'active' : ''}`}
                  onClick={() => setModoMovimientos('SEMANA')}
                >
                  Por semana
                </button>
                <button
                  type="button"
                  className={`period-btn ${modoMovimientos === 'RANGO' ? 'active' : ''}`}
                  onClick={() => setModoMovimientos('RANGO')}
                >
                  Rango de fechas
                </button>
              </div>
              <div className="period-selector" style={{ margin: 0 }} role="group" aria-label="Filtrar por turno">
                {TURNOS_FILTRO.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`period-btn ${filtroTurno === f.id ? 'active' : ''}`}
                    onClick={() => setFiltroTurno(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {filtroTurno !== 'TODOS' && (
                <span className="turno-nota">Los gastos no se asignan a un turno.</span>
              )}
              {modoMovimientos === 'SEMANA' && (
                <div className="week-nav">
                  <button
                    type="button"
                    className="week-nav-btn"
                    onClick={() => setSemanaOffset((o) => o + 1)}
                    aria-label="Semana anterior"
                  >
                    ‹
                  </button>
                  <span className="week-range">{formatoRangoSemana(semanaOffset)}</span>
                  <button
                    type="button"
                    className="week-nav-btn"
                    onClick={() => setSemanaOffset((o) => Math.max(o - 1, 0))}
                    disabled={semanaOffset === 0}
                    aria-label="Semana siguiente"
                  >
                    ›
                  </button>
                </div>
              )}
            </div>

            {modoMovimientos === 'RANGO' && (
              <div className="range-filter">
                <div className="field range-field">
                  <label className="field-label" htmlFor="mov-desde">Desde</label>
                  <SelectorFecha
                    id="mov-desde"
                    value={movDesde}
                    onChange={setMovDesde}
                    maxDate={movHastaDate && !movRangoInvalido ? movHastaDate : undefined}
                  />
                </div>
                <div className="field range-field">
                  <label className="field-label" htmlFor="mov-hasta">Hasta</label>
                  <SelectorFecha
                    id="mov-hasta"
                    value={movHasta}
                    onChange={setMovHasta}
                    minDate={movDesdeDate || undefined}
                  />
                </div>
                {(movDesde || movHasta) && (
                  <button
                    type="button"
                    className="btn-ghost range-clear"
                    onClick={() => { setMovDesde(''); setMovHasta(''); }}
                  >
                    Limpiar
                  </button>
                )}
                {movRangoInvalido && (
                  <p className="login-error range-error" role="alert">
                    La fecha "Desde" no puede ser posterior a "Hasta".
                  </p>
                )}
              </div>
            )}
            {movimientosVista.length === 0 ? (
              <p className="empty-state">{modoMovimientos === 'RANGO' ? 'No hay movimientos en el rango seleccionado.' : 'No hay movimientos en esta semana.'}</p>
            ) : (
              <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Repartidor</th>
                    <th>Tipo</th>
                    <th>Descripción</th>
                    <th>Monto</th>
                    <th></th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {ordenarMovimientos(movimientosVista).map((m, idx) => {
                    const tieneDesglose = m.tipo === 'INGRESO' && m.montoLiquido != null;
                    const expandida = filaExpandida === m.id;
                    const claseFila = [idx % 2 === 1 ? 'row-odd' : '', tieneDesglose ? 'row-clickable' : ''].filter(Boolean).join(' ');
                    return (
                      <>
                        <tr
                          key={m.id}
                          className={claseFila}
                          onClick={() => tieneDesglose && toggleFila(m.id)}
                        >
                          <td>{new Date(m.fecha).toLocaleDateString()}</td>
                          <td>{m.repartidor.usuario.nombre}</td>
                          <td>
                            <span className={`tag ${etiquetaTipo(m).clase}`}>{etiquetaTipo(m).texto}</span>
                            {m.turno && <span className={`tag turno-${m.turno.toLowerCase()}`}>{m.turno}</span>}
                          </td>
                          <td>
                            {formatoDescripcionMovimiento(m)}
                            {m.observaciones && (
                              <span className="obs-dot" title="Tiene observaciones">●</span>
                            )}
                          </td>
                          <td>${formatoPeso(m.monto)}</td>
                          <td>
                            {tieneDesglose && (
                              <span className={`row-caret ${expandida ? 'open' : ''}`}>▾</span>
                            )}
                          </td>
                          <td>
                            <button
                              className="row-delete"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTransaccionAEliminar(m);
                              }}
                              aria-label="Eliminar movimiento"
                              title="Eliminar"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18" />
                                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                <path d="M10 11v6" />
                                <path d="M14 11v6" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                        {tieneDesglose && expandida && (
                          <tr className={`row-detail ${idx % 2 === 1 ? 'row-odd' : ''}`}>
                            <td colSpan={7}>
                              <div className="detail-badges">
                                  {m.sinActividad ? (
                                    <span className="badge badge-sky">Sin actividad ese día</span>
                                  ) : (
                                    <>
                                <span className="badge badge-neutral">
                                  Líquido: ${formatoPeso(m.montoLiquido)}
                                </span>
                                <span className="badge badge-amber">
                                  IVA (19%): ${formatoPeso(m.montoIva)}
                                </span>
                                <span className="badge badge-green">
                                  Bruto total: ${formatoPeso(m.monto)}
                                </span>
                                {m.cantidadPaquetes != null && (
                                  <span className="badge badge-neutral">
                                    {m.cantidadPaquetes} entregados · {m.paquetesFallidos || 0} fallidos
                                  </span>
                                )}
                                {m.paquetesSobredimensionados != null && m.paquetesSobredimensionados > 0 && (
                                  <span className="badge badge-neutral">
                                    {m.paquetesSobredimensionados} Sobredimensionados
                                  </span>
                                )}
                                    </>
                                  )}
                                </div>
                              {m.observaciones && (
                                <p className="detail-note">{m.observaciones}</p>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </>
        )}
      </div>

      <ModalConfirmar
        visible={!!transaccionAEliminar}
        titulo="Eliminar movimiento"
        mensaje={
          transaccionAEliminar
            ? `¿Seguro que quieres eliminar el registro del ${new Date(transaccionAEliminar.fecha).toLocaleDateString()} de ${transaccionAEliminar.repartidor.usuario.nombre} — "${transaccionAEliminar.descripcion || 'sin descripción'}"? Esta acción no se puede deshacer.`
            : ''
        }
        onConfirmar={handleConfirmarEliminar}
        onCancelar={() => setTransaccionAEliminar(null)}
        cargando={eliminando}
      />

      <ModalConfirmar
        visible={mostrarConfirmarLogout}
        titulo="Cerrar sesión"
        mensaje="¿Seguro que quieres cerrar sesión?"
        onConfirmar={handleConfirmarLogout}
        onCancelar={() => setMostrarConfirmarLogout(false)}
        textoConfirmar="Sí, cerrar sesión"
        textoConfirmando="Cerrando..."
        claseConfirmar="btn-primary"
      />
    </div>
  );
}

export default DashboardAdmin;
