import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { obtenerTodasLasTransacciones, eliminarTransaccion } from '../services/transaccionService';
import { obtenerUsuariosPendientes, actualizarEstadoUsuario } from '../services/usuarioService';
import ModalConfirmar from '../components/ModalConfirmar';
import {
  BarChart, Bar, LineChart, Line,
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

function formatoDescripcionMovimiento(m) {
  if (m.categoriaIngreso !== 'PAQUETES' || m.cantidadPaquetes == null) {
    return m.descripcion || '-';
  }
  const partes = [`${m.cantidadPaquetes} entregadas`];
  if (m.paquetesSobredimensionados) partes.push(`${m.paquetesSobredimensionados} S/D`);
  if (m.paquetesFallidos) partes.push(`${m.paquetesFallidos} fallidas`);
  const total = m.paquetesTotalSalida ?? (m.cantidadPaquetes + (m.paquetesFallidos || 0));
  return `Reparto · ${partes.join(' / ')} de ${total} totales`;
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

  const [transaccionAEliminar, setTransaccionAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);
  const [filaExpandida, setFilaExpandida] = useState(null);
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

  // Filtro por período
  const movimientosFiltrados = movimientos.filter((m) => {
    if (periodo === 'TODO') return true;
    const fecha = new Date(m.fecha);
    const limite = periodo === 'SEMANA' ? inicioSemanaActual() : inicioMesActual();
    return fecha >= limite;
  });

  // "Todos los movimientos": navegación semana por semana (lunes a domingo), independiente del filtro de período
  const { inicio: inicioSemanaVista, fin: finSemanaVista } = rangoSemana(semanaOffset);
  const movimientosSemana = movimientos.filter((m) => {
    const fecha = new Date(m.fecha);
    return fecha >= inicioSemanaVista && fecha <= finSemanaVista;
  });

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

            <p className="section-title">Balance por repartidor</p>
            <div className="chart-wrap">
              <ResponsiveContainer>
                <BarChart data={porRepartidor}>
                  <CartesianGrid stroke="#2A3238" strokeDasharray="3 3" />
                  <XAxis dataKey="nombre" stroke="#8B98A1" fontSize={12} />
                  <YAxis stroke="#8B98A1" fontSize={12} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '13px' }} />
                  <Bar dataKey="totalIngresos" fill="#4ADE80" name="Ingresos" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="totalGastos" fill="#FF7A6E" name="Gastos" radius={[4, 4, 0, 0]} />
                </BarChart>
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
                </tr>
              </thead>
              <tbody>
                {porRepartidor.length === 0 ? (
                  <tr><td colSpan={6} className="empty-state">Sin movimientos en este período.</td></tr>
                ) : (
                  porRepartidor.map((r) => (
                    <tr key={r.repartidorId}>
                      <td>{r.nombre}</td>
                      <td>{r.email}</td>
                      <td>${formatoPeso(r.totalIngresos)}</td>
                      <td>${formatoPeso(r.totalGastos)}</td>
                      <td>${formatoPeso(r.balance)}</td>
                      <td>{r.cantidadTransacciones}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '28px', marginBottom: '14px' }}>
              <p className="section-title" style={{ margin: 0 }}>Todos los movimientos</p>
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
            </div>
            {movimientosSemana.length === 0 ? (
              <p className="empty-state">No hay movimientos en esta semana.</p>
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
                  {ordenarMovimientos(movimientosSemana).map((m, idx) => {
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
                          <td><span className={`tag ${m.tipo === 'INGRESO' ? 'ingreso' : 'gasto'}`}>{m.tipo}</span></td>
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
