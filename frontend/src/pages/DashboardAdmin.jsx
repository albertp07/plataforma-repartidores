import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { obtenerTodasLasTransacciones, eliminarTransaccion } from '../services/transaccionService';
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

function formatoPeso(valor) {
  return Math.round(valor).toLocaleString('es-CL');
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

function inicioMesActual() {
  const hoy = new Date();
  return new Date(hoy.getFullYear(), hoy.getMonth(), 1, 0, 0, 0, 0);
}

function DashboardAdmin() {
  const { usuario, cerrarSesion } = useAuth();
  const navigate = useNavigate();

  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [periodo, setPeriodo] = useState('TODO');

  const [transaccionAEliminar, setTransaccionAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);
  const [filaExpandida, setFilaExpandida] = useState(null);
  const [mostrarConfirmarLogout, setMostrarConfirmarLogout] = useState(false);

  useEffect(() => {
    cargarDatos();
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
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-ghost" onClick={() => navigate('/panel')}>
              Ver Panel Repartidor
            </button>
            <button className="btn-ghost" onClick={handleLogout}>Cerrar sesión</button>
          </div>
        </div>

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

        <p className="section-title" style={{ marginTop: '28px' }}>Todos los movimientos</p>
        {movimientosFiltrados.length === 0 ? (
          <p className="empty-state">No hay movimientos en este período.</p>
        ) : (
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
              {movimientosFiltrados.map((m) => {
                const tieneDesglose = m.tipo === 'INGRESO' && m.montoLiquido != null;
                const expandida = filaExpandida === m.id;
                return (
                  <>
                    <tr
                      key={m.id}
                      className={tieneDesglose ? 'row-clickable' : ''}
                      onClick={() => tieneDesglose && toggleFila(m.id)}
                    >
                      <td>{new Date(m.fecha).toLocaleDateString()}</td>
                      <td>{m.repartidor.usuario.nombre}</td>
                      <td><span className={`tag ${m.tipo === 'INGRESO' ? 'ingreso' : 'gasto'}`}>{m.tipo}</span></td>
                      <td>{m.descripcion || '-'}</td>
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
                      <tr className="row-detail">
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
                                {m.cantidadPaquetes} entregados
                                {m.paquetesFallidos ? ` · ${m.paquetesFallidos} fallidos` : ''}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
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