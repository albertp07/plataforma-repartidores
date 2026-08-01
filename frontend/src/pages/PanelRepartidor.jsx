import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { obtenerMiPerfil, crearPerfil, actualizarMiPerfil } from '../services/repartidorService';
import {
  obtenerMisTransacciones,
  crearTransaccion,
  eliminarTransaccion,
} from '../services/transaccionService';
import ModalConfirmar from '../components/ModalConfirmar';
import ModalPerfil from '../components/ModalPerfil';
import '../styles/shared.css';

const IVA = 0.19;
const VALOR_PAQUETE_DEFAULT = 1350;
const VALOR_RETIRO_DEFAULT = 1500;

const MODOS_INGRESO = [
  { id: 'PAQUETES', icono: '📦', label: 'Reparto de Paquetes', sub: 'Entregas del día' },
  { id: 'RETIROS', icono: '📥', label: 'Retiros', sub: 'Colecta antes de repartir' },
];

const CATEGORIAS_GASTO = [
  { id: 'BENCINA', icono: '⛽', label: 'Bencina / Combustible', sub: 'Carga de combustible' },
  { id: 'MANTENCION', icono: '🔧', label: 'Mantención Furgón', sub: 'Peajes, lavado, aceite, repuestos' },
  { id: 'OTROS', icono: '📦', label: 'Otros Gastos', sub: 'Almuerzo, insumos, etc.' },
];

const DETALLES_MANTENCION = ['Peajes', 'Lavado', 'Cambio de aceite', 'Repuestos', 'Mecánica', 'Otro'];

const PERIODOS = [
  { id: 'TODO', label: 'Todo' },
  { id: 'SEMANA', label: 'Esta semana' },
  { id: 'MES', label: 'Este mes' },
];

function formatoPeso(valor) {
  return Math.round(valor).toLocaleString('es-CL');
}

function hoyISO() {
  return new Date().toISOString().split('T')[0];
}

function isoADDMMYYYY(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

function ddmmyyyyAISO(texto) {
  const match = texto.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  return `${y}-${m}-${d}`;
}

function formatearEntradaFecha(valor) {
  const digits = valor.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

// Cantidades (entregas, retiros, etc.): máximo 4 dígitos, sin negativos
function limitarCantidad(valor) {
  return valor.replace(/\D/g, '').slice(0, 4);
}

// Montos / valores monetarios: máximo 8 dígitos, sin negativos
function limitarMonto(valor) {
  return valor.replace(/\D/g, '').slice(0, 8);
}

// Litros (permite un decimal, ej. "8.5"): máximo 6 dígitos en total, sin negativos ni notación científica
function limitarLitros(valor) {
  let limpio = valor.replace(/[^0-9.]/g, '');
  const primerPunto = limpio.indexOf('.');
  if (primerPunto !== -1) {
    limpio = limpio.slice(0, primerPunto + 1) + limpio.slice(primerPunto + 1).replace(/\./g, '');
  }
  const digitos = limpio.replace('.', '');
  if (digitos.length > 6) {
    limpio = limpio.slice(0, limpio.length - (digitos.length - 6));
  }
  return limpio;
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

function calcularResumen(lista) {
  const totalIngresos = lista
    .filter((t) => t.tipo === 'INGRESO')
    .reduce((sum, t) => sum + Number(t.monto), 0);
  const totalGastos = lista
    .filter((t) => t.tipo === 'GASTO')
    .reduce((sum, t) => sum + Number(t.monto), 0);
  return { totalIngresos, totalGastos, balance: totalIngresos - totalGastos };
}

function PanelRepartidor() {
  const { usuario, cerrarSesion, actualizarUsuario } = useAuth();
  const navigate = useNavigate();

  const [perfil, setPerfil] = useState(null);
  const [cargandoPerfil, setCargandoPerfil] = useState(true);

  const [mostrarModalPerfil, setMostrarModalPerfil] = useState(false);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [errorPerfil, setErrorPerfil] = useState('');
  const [exitoPerfil, setExitoPerfil] = useState('');

  const [telefono, setTelefono] = useState('');
  const [vehiculo, setVehiculo] = useState('');

  const [transacciones, setTransacciones] = useState([]);
  const [periodo, setPeriodo] = useState('TODO');

  const [tipo, setTipo] = useState('INGRESO');
  const [modoIngreso, setModoIngreso] = useState('PAQUETES');

  // Ingreso: Reparto de Paquetes
  const [fechaRuta, setFechaRuta] = useState(() => isoADDMMYYYY(hoyISO()));
  const [entregasExitosas, setEntregasExitosas] = useState('');
  const [entregasFallidas, setEntregasFallidas] = useState('');
  const [paquetesSobredimensionados, setPaquetesSobredimensionados] = useState('');
  const [valorPaquete, setValorPaquete] = useState(VALOR_PAQUETE_DEFAULT);

  // Ingreso: Retiros
  const [fechaRetiro, setFechaRetiro] = useState(() => isoADDMMYYYY(hoyISO()));
  const [cantidadRetiros, setCantidadRetiros] = useState('');
  const [valorRetiro, setValorRetiro] = useState(VALOR_RETIRO_DEFAULT);

  // Gasto: categorización rápida
  const [fechaGasto, setFechaGasto] = useState(() => isoADDMMYYYY(hoyISO()));
  const [categoriaGasto, setCategoriaGasto] = useState(null);
  const [montoGasto, setMontoGasto] = useState('');
  const [kilometraje, setKilometraje] = useState('');
  const [litros, setLitros] = useState('');
  const [montoSinDescuento, setMontoSinDescuento] = useState('');
  const [descuentoCombustible, setDescuentoCombustible] = useState('');
  const [detalleMantencion, setDetalleMantencion] = useState(DETALLES_MANTENCION[0]);
  const [descripcionOtros, setDescripcionOtros] = useState('');

  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const [transaccionAEliminar, setTransaccionAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);
  const [filaExpandida, setFilaExpandida] = useState(null);
  const [mostrarConfirmarLogout, setMostrarConfirmarLogout] = useState(false);

  useEffect(() => {
    document.title = 'Aryal - Panel Repartidor';
  }, []);

  // Cálculo en vivo: paquetes
  const exitosas = Number(entregasExitosas) || 0;
  const fallidas = Number(entregasFallidas) || 0;
  const sobredimensionados = Number(paquetesSobredimensionados) || 0;
  const totalSalida = exitosas + fallidas;
  const valorUnitario = Number(valorPaquete) || 0;
  const liquido = (exitosas + sobredimensionados) * valorUnitario;
  const iva = liquido * IVA;
  const bruto = liquido + iva;

  // Cálculo en vivo: retiros
  const retiros = Number(cantidadRetiros) || 0;
  const valorRetiroUnit = Number(valorRetiro) || 0;
  const liquidoRetiro = retiros * valorRetiroUnit;
  const ivaRetiro = liquidoRetiro * IVA;
  const brutoRetiro = liquidoRetiro + ivaRetiro;

  // Cálculo en vivo: descuento de combustible
  const totalSinDescuento = Number(montoSinDescuento) || 0;
  const descuento = Number(descuentoCombustible) || 0;
  const totalConDescuento = Math.max(totalSinDescuento - descuento, 0);

  // Filtro por período
  const transaccionesFiltradas = transacciones.filter((t) => {
    if (periodo === 'TODO') return true;
    const fecha = new Date(t.fecha);
    const limite = periodo === 'SEMANA' ? inicioSemanaActual() : inicioMesActual();
    return fecha >= limite;
  });

  const resumenMostrado = calcularResumen(transaccionesFiltradas);

  useEffect(() => {
    cargarPerfil();
  }, []);

  async function cargarPerfil() {
    try {
      const data = await obtenerMiPerfil();
      setPerfil(data);
      cargarTransacciones();
    } catch (err) {
      setPerfil(null);
    } finally {
      setCargandoPerfil(false);
    }
  }

  async function cargarTransacciones() {
    try {
      const data = await obtenerMisTransacciones();
      setTransacciones(data.transacciones);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCrearPerfil(e) {
    e.preventDefault();
    setError('');
    try {
      const nuevoPerfil = await crearPerfil(telefono, vehiculo);
      setPerfil(nuevoPerfil);
      cargarTransacciones();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear perfil');
    }
  }

  function handleAbrirPerfil() {
    setErrorPerfil('');
    setExitoPerfil('');
    setMostrarModalPerfil(true);
  }

  function handleCerrarPerfil() {
    setMostrarModalPerfil(false);
  }

  async function handleGuardarPerfil(datos) {
    setGuardandoPerfil(true);
    setErrorPerfil('');
    setExitoPerfil('');
    try {
      const resultado = await actualizarMiPerfil(datos);
      actualizarUsuario({ nombre: resultado.usuario.nombre });
      await cargarPerfil();
      setExitoPerfil('Perfil actualizado correctamente');
    } catch (err) {
      setErrorPerfil(err.response?.data?.error || 'Error al actualizar el perfil');
    } finally {
      setGuardandoPerfil(false);
    }
  }

  async function handleGuardarRuta(e) {
    e.preventDefault();
    setError('');

    const fechaISO = ddmmyyyyAISO(fechaRuta);
    if (!fechaISO) {
      setError('Ingresa una fecha válida en formato DD-MM-AAAA');
      return;
    }
    if (fechaISO > hoyISO()) {
      setError('La fecha no puede ser futura');
      return;
    }

    if (totalSalida <= 0) {
      setError('Ingresa al menos una entrega (exitosa o fallida)');
      return;
    }

    const descripcionRuta = sobredimensionados > 0
      ? `Ruta de reparto · ${exitosas} entregadas / ${sobredimensionados} sobredimensionados / ${fallidas} fallidas de ${totalSalida} totales`
      : `Ruta de reparto · ${exitosas} entregadas / ${fallidas} fallidas de ${totalSalida} totales`;

    setGuardando(true);
    try {
      await crearTransaccion({
        tipo: 'INGRESO',
        monto: bruto,
        descripcion: descripcionRuta,
        categoriaIngreso: 'PAQUETES',
        cantidadPaquetes: exitosas,
        paquetesFallidos: fallidas,
        paquetesTotalSalida: totalSalida,
        paquetesSobredimensionados: sobredimensionados > 0 ? sobredimensionados : undefined,
        valorPaquete: valorUnitario,
        montoLiquido: liquido,
        montoIva: iva,
        fecha: `${fechaISO}T12:00:00.000Z`,
      });
      setEntregasExitosas('');
      setEntregasFallidas('');
      setPaquetesSobredimensionados('');
      setFechaRuta(isoADDMMYYYY(hoyISO()));
      cargarTransacciones();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar la ruta');
    } finally {
      setGuardando(false);
    }
  }

  async function handleGuardarRetiro(e) {
    e.preventDefault();
    setError('');

    const fechaISO = ddmmyyyyAISO(fechaRetiro);
    if (!fechaISO) {
      setError('Ingresa una fecha válida en formato DD-MM-AAAA');
      return;
    }
    if (fechaISO > hoyISO()) {
      setError('La fecha no puede ser futura');
      return;
    }

    if (retiros <= 0) {
      setError('Ingresa una cantidad de retiros válida');
      return;
    }

    setGuardando(true);
    try {
      await crearTransaccion({
        tipo: 'INGRESO',
        monto: brutoRetiro,
        descripcion: `Retiros · ${retiros} colectas`,
        categoriaIngreso: 'RETIROS',
        cantidadPaquetes: retiros,
        valorPaquete: valorRetiroUnit,
        montoLiquido: liquidoRetiro,
        montoIva: ivaRetiro,
        fecha: `${fechaISO}T12:00:00.000Z`,
      });
      setCantidadRetiros('');
      setFechaRetiro(isoADDMMYYYY(hoyISO()));
      cargarTransacciones();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar el retiro');
    } finally {
      setGuardando(false);
    }
  }

  function resetearFormularioGasto() {
    setCategoriaGasto(null);
    setMontoGasto('');
    setKilometraje('');
    setLitros('');
    setMontoSinDescuento('');
    setDescuentoCombustible('');
    setDetalleMantencion(DETALLES_MANTENCION[0]);
    setDescripcionOtros('');
    setFechaGasto(isoADDMMYYYY(hoyISO()));
  }

  async function handleCrearGasto(e) {
    e.preventDefault();
    setError('');

    const fechaISO = ddmmyyyyAISO(fechaGasto);
    if (!fechaISO) {
      setError('Ingresa una fecha válida en formato DD-MM-AAAA');
      return;
    }
    if (fechaISO > hoyISO()) {
      setError('La fecha no puede ser futura');
      return;
    }

    const esBencina = categoriaGasto === 'BENCINA';
    const montoFinal = esBencina ? totalConDescuento : Number(montoGasto);

    if (!montoFinal || montoFinal <= 0) {
      setError('Ingresa un monto válido');
      return;
    }

    let descripcion = '';
    if (categoriaGasto === 'BENCINA') {
      descripcion = 'Bencina / Combustible';
      if (litros) descripcion += ` · ${litros} L`;
      if (kilometraje) descripcion += ` · ${kilometraje} km`;
      if (descuento > 0) descripcion += ` · Ahorro $${formatoPeso(descuento)}`;
    } else if (categoriaGasto === 'MANTENCION') {
      descripcion = `Mantención Furgón · ${detalleMantencion}`;
    } else {
      descripcion = descripcionOtros ? `Otros gastos · ${descripcionOtros}` : 'Otros gastos';
    }

    setGuardando(true);
    try {
      await crearTransaccion({
        tipo: 'GASTO',
        monto: montoFinal,
        descripcion,
        categoriaGasto,
        montoSinDescuento: esBencina ? totalSinDescuento : undefined,
        descuentoAplicado: esBencina && descuento > 0 ? descuento : undefined,
        fecha: `${fechaISO}T12:00:00.000Z`,
      });
      resetearFormularioGasto();
      cargarTransacciones();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar el gasto');
    } finally {
      setGuardando(false);
    }
  }

  async function handleConfirmarEliminar() {
    setEliminando(true);
    try {
      await eliminarTransaccion(transaccionAEliminar.id);
      setTransaccionAEliminar(null);
      cargarTransacciones();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar el movimiento');
    } finally {
      setEliminando(false);
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

  function handleCambiarTipo(nuevoTipo) {
    setTipo(nuevoTipo);
    setError('');
  }

  function toggleFila(id) {
    setFilaExpandida(filaExpandida === id ? null : id);
  }

  if (cargandoPerfil) {
    return <div className="app-shell"><p className="empty-state">Cargando...</p></div>;
  }

  return (
    <div className="app-shell">
      <div className="app-container">
        <div className="app-topbar">
          <div>
            <h1>Panel del Repartidor</h1>
            <p className="app-user">Bienvenido, {usuario?.nombre}</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {usuario?.rol === 'ADMIN' && (
              <button className="btn-ghost" onClick={() => navigate('/dashboard')}>
                Ver Dashboard
              </button>
            )}
            <button className="btn-ghost" onClick={handleAbrirPerfil}>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ verticalAlign: 'middle', marginRight: '6px', marginTop: '-2px' }}
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
              </svg>
              Mi Perfil
            </button>
            <button className="btn-ghost" onClick={handleLogout}>Cerrar sesión</button>
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}

        {!perfil ? (
          <div className="panel">
            <h2>Completa tu perfil de repartidor</h2>
            <form onSubmit={handleCrearPerfil}>
              <div className="field">
                <span className="field-label">Teléfono</span>
                <input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
              </div>
              <div className="field">
                <span className="field-label">Vehículo</span>
                <input
                  value={vehiculo}
                  onChange={(e) => setVehiculo(e.target.value)}
                  placeholder="Moto, Bicicleta, Auto..."
                />
              </div>
              <button type="submit" className="btn-primary">Crear perfil</button>
            </form>
          </div>
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
                <p className="stat-label">Ingresos</p>
                <p className="stat-value">${formatoPeso(resumenMostrado.totalIngresos)}</p>
              </div>
              <div className="stat-card red">
                <p className="stat-label">Gastos</p>
                <p className="stat-value">${formatoPeso(resumenMostrado.totalGastos)}</p>
              </div>
              <div className="stat-card amber">
                <p className="stat-label">Balance</p>
                <p className="stat-value">${formatoPeso(resumenMostrado.balance)}</p>
              </div>
            </div>

            <div className="panel">
              <h2>Registrar movimiento</h2>
              <div className="field">
                <span className="field-label">Tipo</span>
                <select value={tipo} onChange={(e) => handleCambiarTipo(e.target.value)}>
                  <option value="INGRESO">Ingreso</option>
                  <option value="GASTO">Gasto</option>
                </select>
              </div>

              {tipo === 'INGRESO' ? (
                <>
                  <p className="field-label" style={{ marginBottom: '14px' }}>
                    Selecciona el modo de ingreso
                  </p>

                  <div className="category-grid">
                    {MODOS_INGRESO.map((modo) => (
                      <button
                        type="button"
                        key={modo.id}
                        className={`category-btn ${modoIngreso === modo.id ? 'active' : ''}`}
                        onClick={() => setModoIngreso(modo.id)}
                      >
                        <span className="category-icon">{modo.icono}</span>
                        <span className="category-label">{modo.label}</span>
                        <span className="category-sub">{modo.sub}</span>
                      </button>
                    ))}
                  </div>

                  {modoIngreso === 'PAQUETES' ? (
                    <form onSubmit={handleGuardarRuta}>
                      <div className="field">
                        <span className="field-label">Fecha de la ruta</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="DD-MM-AAAA"
                          value={fechaRuta}
                          onChange={(e) => setFechaRuta(formatearEntradaFecha(e.target.value))}
                          maxLength={10}
                          required
                        />
                      </div>

                      <div className="field-row">
                        <div className="field">
                          <span className="field-label">Entregas exitosas</span>
                          <input
                            type="number"
                            min="0"
                            max="9999"
                            value={entregasExitosas}
                            onChange={(e) => setEntregasExitosas(limitarCantidad(e.target.value))}
                            placeholder="Ej: 45"
                            required
                          />
                        </div>

                        <div className="field">
                          <span className="field-label">Entregas fallidas</span>
                          <input
                            type="number"
                            min="0"
                            max="9999"
                            value={entregasFallidas}
                            onChange={(e) => setEntregasFallidas(limitarCantidad(e.target.value))}
                            placeholder="Ej: 5"
                          />
                        </div>
                      </div>

                      <div className="field">
                        <span className="field-label">Paquetes sobredimensionados (opcional)</span>
                        <input
                          type="number"
                          min="0"
                          max="9999"
                          value={paquetesSobredimensionados}
                          onChange={(e) => setPaquetesSobredimensionados(limitarCantidad(e.target.value))}
                          placeholder="Ej: 1"
                        />
                      </div>

                      <div className="field">
                        <span className="field-label">Valor por paquete</span>
                        <input
                          type="number"
                          min="0"
                          max="99999999"
                          value={valorPaquete}
                          onChange={(e) => setValorPaquete(limitarMonto(e.target.value))}
                        />
                      </div>

                      <div className="calc-summary">
                        <div className="calc-row">
                          <span>Paquetes totales al salir</span>
                          <span>{totalSalida}</span>
                        </div>
                        <div className="calc-row">
                          <span>
                            Líquido ({exitosas} entregados{sobredimensionados > 0 ? ` + ${sobredimensionados} sobredimensionados` : ''} × ${formatoPeso(valorUnitario)})
                          </span>
                          <span>${formatoPeso(liquido)}</span>
                        </div>
                        <div className="calc-row">
                          <span>IVA (19%)</span>
                          <span>${formatoPeso(iva)}</span>
                        </div>
                        <div className="calc-row calc-total">
                          <span>Bruto total</span>
                          <span>${formatoPeso(bruto)}</span>
                        </div>
                      </div>

                      <button type="submit" className="btn-primary" disabled={guardando}>
                        {guardando ? 'Guardando...' : 'Guardar ruta'}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleGuardarRetiro}>
                      <div className="field">
                        <span className="field-label">Fecha del retiro</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="DD-MM-AAAA"
                          value={fechaRetiro}
                          onChange={(e) => setFechaRetiro(formatearEntradaFecha(e.target.value))}
                          maxLength={10}
                          required
                        />
                      </div>

                      <div className="field">
                        <span className="field-label">Cantidad de retiros</span>
                        <input
                          type="number"
                          min="0"
                          max="9999"
                          value={cantidadRetiros}
                          onChange={(e) => setCantidadRetiros(limitarCantidad(e.target.value))}
                          placeholder="Ej: 20"
                          required
                        />
                      </div>

                      <div className="field">
                        <span className="field-label">Valor por retiro</span>
                        <input
                          type="number"
                          min="0"
                          max="99999999"
                          value={valorRetiro}
                          onChange={(e) => setValorRetiro(limitarMonto(e.target.value))}
                        />
                      </div>

                      <div className="calc-summary">
                        <div className="calc-row">
                          <span>Líquido ({retiros} × ${formatoPeso(valorRetiroUnit)})</span>
                          <span>${formatoPeso(liquidoRetiro)}</span>
                        </div>
                        <div className="calc-row">
                          <span>IVA (19%)</span>
                          <span>${formatoPeso(ivaRetiro)}</span>
                        </div>
                        <div className="calc-row calc-total">
                          <span>Bruto total</span>
                          <span>${formatoPeso(brutoRetiro)}</span>
                        </div>
                      </div>

                      <button type="submit" className="btn-primary" disabled={guardando}>
                        {guardando ? 'Guardando...' : 'Guardar retiro'}
                      </button>
                    </form>
                  )}
                </>
              ) : (
                <form onSubmit={handleCrearGasto}>
                  <div className="field">
                    <span className="field-label">Fecha del gasto</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="DD-MM-AAAA"
                      value={fechaGasto}
                      onChange={(e) => setFechaGasto(formatearEntradaFecha(e.target.value))}
                      maxLength={10}
                      required
                    />
                  </div>

                  <p className="field-label" style={{ marginBottom: '14px' }}>
                    Selecciona el tipo de gasto
                  </p>

                  <div className="category-grid">
                    {CATEGORIAS_GASTO.map((cat) => (
                      <button
                        type="button"
                        key={cat.id}
                        className={`category-btn ${categoriaGasto === cat.id ? 'active' : ''}`}
                        onClick={() => setCategoriaGasto(cat.id)}
                      >
                        <span className="category-icon">{cat.icono}</span>
                        <span className="category-label">{cat.label}</span>
                        <span className="category-sub">{cat.sub}</span>
                      </button>
                    ))}
                  </div>

                  {categoriaGasto && (
                    <>
                      {categoriaGasto === 'BENCINA' ? (
                        <>
                          <div className="field">
                            <span className="field-label">Total sin descuento</span>
                            <input
                              type="number"
                              min="0"
                              max="99999999"
                              value={montoSinDescuento}
                              onChange={(e) => setMontoSinDescuento(limitarMonto(e.target.value))}
                              placeholder="Ej: 20000"
                              required
                            />
                          </div>

                          <div className="field">
                            <span className="field-label">Descuento por cupón (opcional)</span>
                            <input
                              type="number"
                              min="0"
                              max="99999999"
                              value={descuentoCombustible}
                              onChange={(e) => setDescuentoCombustible(limitarMonto(e.target.value))}
                              placeholder="Ej: 1500"
                            />
                          </div>

                          <div className="field-row">
                            <div className="field">
                              <span className="field-label">Litros cargados (opcional)</span>
                              <input
                                type="number"
                                min="0"
                                max="9999"
                                value={litros}
                                onChange={(e) => setLitros(limitarLitros(e.target.value))}
                                placeholder="Ej: 8.5"
                              />
                            </div>
                            <div className="field">
                              <span className="field-label">Kilometraje (opcional)</span>
                              <input
                                type="number"
                                min="0"
                                max="99999999"
                                value={kilometraje}
                                onChange={(e) => setKilometraje(limitarMonto(e.target.value))}
                                placeholder="Ej: 45200"
                              />
                            </div>
                          </div>

                          <div className="calc-summary">
                            <div className="calc-row">
                              <span>Total sin descuento</span>
                              <span>${formatoPeso(totalSinDescuento)}</span>
                            </div>
                            <div className="calc-row">
                              <span>Descuento aplicado</span>
                              <span>-${formatoPeso(descuento)}</span>
                            </div>
                            <div className="calc-row calc-total">
                              <span>Total a pagar</span>
                              <span>${formatoPeso(totalConDescuento)}</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="field">
                          <span className="field-label">Monto</span>
                          <input
                            type="number"
                            min="0"
                            max="99999999"
                            value={montoGasto}
                            onChange={(e) => setMontoGasto(limitarMonto(e.target.value))}
                            required
                          />
                        </div>
                      )}

                      {categoriaGasto === 'MANTENCION' && (
                        <div className="field">
                          <span className="field-label">Detalle</span>
                          <select
                            value={detalleMantencion}
                            onChange={(e) => setDetalleMantencion(e.target.value)}
                          >
                            {DETALLES_MANTENCION.map((d) => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {categoriaGasto === 'OTROS' && (
                        <div className="field">
                          <span className="field-label">Descripción</span>
                          <textarea
                            rows="3"
                            maxLength={500}
                            value={descripcionOtros}
                            onChange={(e) => setDescripcionOtros(e.target.value)}
                            placeholder="Ej: Almuerzo en ruta"
                          />
                        </div>
                      )}

                      <button type="submit" className="btn-primary" disabled={guardando}>
                        {guardando ? 'Guardando...' : 'Guardar gasto'}
                      </button>
                    </>
                  )}
                </form>
              )}
            </div>

            <p className="section-title">Historial</p>
            {transaccionesFiltradas.length === 0 ? (
              <p className="empty-state">No hay movimientos registrados en este período.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Descripción</th>
                    <th>Monto</th>
                    <th></th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {transaccionesFiltradas.map((t) => {
                    const tieneDesglose = t.tipo === 'INGRESO' && t.montoLiquido != null;
                    const expandida = filaExpandida === t.id;
                    return (
                      <>
                        <tr
                          key={t.id}
                          className={tieneDesglose ? 'row-clickable' : ''}
                          onClick={() => tieneDesglose && toggleFila(t.id)}
                        >
                          <td>{new Date(t.fecha).toLocaleDateString()}</td>
                          <td><span className={`tag ${t.tipo === 'INGRESO' ? 'ingreso' : 'gasto'}`}>{t.tipo}</span></td>
                          <td>{t.descripcion || '-'}</td>
                          <td>${formatoPeso(t.monto)}</td>
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
                                setTransaccionAEliminar(t);
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
                            <td colSpan={6}>
                              <div className="detail-badges">
                                <span className="badge badge-neutral">
                                  Líquido: ${formatoPeso(t.montoLiquido)}
                                </span>
                                <span className="badge badge-amber">
                                  IVA (19%): ${formatoPeso(t.montoIva)}
                                </span>
                                <span className="badge badge-green">
                                  Bruto total: ${formatoPeso(t.monto)}
                                </span>
                                {t.categoriaIngreso === 'PAQUETES' && t.cantidadPaquetes != null && (
                                  <span className="badge badge-neutral">
                                    {t.cantidadPaquetes} entregados
                                    {t.paquetesSobredimensionados ? ` · ${t.paquetesSobredimensionados} sobredimensionados` : ''}
                                    {t.paquetesFallidos ? ` · ${t.paquetesFallidos} fallidos` : ''}
                                  </span>
                                )}
                                {t.categoriaIngreso === 'RETIROS' && t.cantidadPaquetes != null && (
                                  <span className="badge badge-neutral">
                                    {t.cantidadPaquetes} retiros
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
          </>
        )}
      </div>

      <ModalConfirmar
        visible={!!transaccionAEliminar}
        titulo="Eliminar movimiento"
        mensaje={
          transaccionAEliminar
            ? `¿Seguro que quieres eliminar el registro del ${new Date(transaccionAEliminar.fecha).toLocaleDateString()} — "${transaccionAEliminar.descripcion || 'sin descripción'}"? Esta acción no se puede deshacer.`
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

      <ModalPerfil
        visible={mostrarModalPerfil}
        usuario={usuario}
        telefonoInicial={perfil?.telefono}
        vehiculoInicial={perfil?.vehiculo}
        onGuardar={handleGuardarPerfil}
        onCancelar={handleCerrarPerfil}
        guardando={guardandoPerfil}
        error={errorPerfil}
        exito={exitoPerfil}
      />
    </div>
  );
}

export default PanelRepartidor;