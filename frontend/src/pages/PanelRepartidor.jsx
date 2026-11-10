import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { obtenerMiPerfil, crearPerfil } from '../services/repartidorService';
import { crearSolicitudCambio, obtenerMisSolicitudes } from '../services/solicitudCambioService';
import {
  obtenerMisTransacciones,
  crearTransaccion,
  eliminarTransaccion,
} from '../services/transaccionService';
import ModalConfirmar from '../components/ModalConfirmar';
import ModalPerfil from '../components/ModalPerfil';
import SelectorFecha from '../components/SelectorFecha';
import SelectorTurno from '../components/SelectorTurno';
import ResumenSemana from '../components/ResumenSemana';
import RankingSemanas from '../components/RankingSemanas';
import SelectorRetiros from '../components/SelectorRetiros';
import ImportarCaptura from '../components/ImportarCaptura';
import ChatAsistente from '../components/ChatAsistente';
import TabSelector from '../components/TabSelector';
import usePuntosRetiro from '../hooks/usePuntosRetiro';
import '../styles/shared.css';
import '../styles/ux-movil.css';
import CantidadStepper from '../components/CantidadStepper';
import BarraResumen from '../components/BarraResumen';
import { formatearFecha, formatearDiaMes } from '../utils/fechas';

const IVA = 0.19;
const VALOR_PAQUETE_DEFAULT = 1500;

const MODOS_INGRESO = [
  { id: 'PAQUETES', icono: 'paquete', label: 'Reparto de Paquetes', sub: 'Entregas del día' },
  { id: 'RETIROS', icono: 'retiro', label: 'Retiros', sub: 'Colecta antes de repartir' },
];

const CATEGORIAS_GASTO = [
  { id: 'BENCINA', icono: 'bencina', label: 'Bencina / Combustible', sub: 'Carga de combustible' },
  { id: 'MANTENCION', icono: 'mantencion', label: 'Mantención Furgón', sub: 'Peajes, lavado, aceite, repuestos' },
  { id: 'OTROS', icono: 'otros', label: 'Otros Gastos', sub: 'Almuerzo, insumos, etc.' },
];

const TRAZOS_ICONO = {
  paquete: <><path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" /><path d="M3 8l9 5 9-5M12 13v8" /></>,
  retiro: <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M4 19h16" /></>,
  bencina: <><path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" /><path d="M3 21h12M14 10h2a2 2 0 0 1 2 2v4a1.5 1.5 0 0 0 3 0V8l-3-3M7 8h4" /></>,
  mantencion: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />,
  otros: <><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2V3z" /><path d="M9 8h6M9 12h6" /></>,
};

function IconoCategoria({ nombre }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {TRAZOS_ICONO[nombre]}
    </svg>
  );
}

const DETALLES_MANTENCION = ['Peajes', 'Lavado', 'Cambio de aceite', 'Repuestos', 'Mecánica', 'Otro'];

const PERIODOS = [
  { id: 'TODO', label: 'Todo' },
  { id: 'SEMANA', label: 'Esta semana' },
  { id: 'MES', label: 'Este mes' },
];

function formatoPeso(valor) {
  return Math.round(valor).toLocaleString('es-CL');
}

function ordenTipoMovimiento(t) {
  if (t.tipo === 'GASTO') return 0;
  if (t.categoriaIngreso === 'PAQUETES') return 1;
  if (t.categoriaIngreso === 'RETIROS') return 2;
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

function etiquetaTipo(t) {
  if (t.sinActividad) {
    return { clase: 'sin-actividad', texto: t.categoriaIngreso === 'RETIROS' ? 'SIN RETIRO' : 'SIN REPARTO' };
  }
  return { clase: t.tipo === 'INGRESO' ? 'ingreso' : 'gasto', texto: t.tipo };
}

function formatoDescripcionMovimiento(t) {
  if (t.sinActividad) return t.descripcion || 'Sin actividad';
  if (t.categoriaIngreso !== 'PAQUETES' || t.cantidadPaquetes == null) {
    return t.descripcion || '-';
  }
  const partes = [`${t.cantidadPaquetes} entregadas`];
  if (t.paquetesSobredimensionados) partes.push(`${t.paquetesSobredimensionados} S/D`);
  if (t.paquetesFallidos) partes.push(`${t.paquetesFallidos} fallidas`);
  const total = t.paquetesTotalSalida ?? (t.cantidadPaquetes + (t.paquetesFallidos || 0));
  return `Reparto · ${partes.join(' / ')} de ${total} totales`;
}

function hoyISO() {
  return new Date().toISOString().split('T')[0];
}

// Antes de las 14:00 se asume turno AM, desde las 14:00 turno PM (el repartidor puede cambiarlo)
const HORA_CORTE_TURNO = 14;

function turnoPorDefecto() {
  return new Date().getHours() < HORA_CORTE_TURNO ? 'AM' : 'PM';
}

// Tras guardar un turno de hoy, sugiere el otro; si era de otro día, vuelve al turno según la hora
function siguienteTurno(actual, fechaISO) {
  if (fechaISO === hoyISO()) return actual === 'AM' ? 'PM' : 'AM';
  return turnoPorDefecto();
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
  const fmt = (d) => formatearDiaMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  return `${fmt(inicio)} al ${fmt(fin)}`;
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
  const { usuario, cerrarSesion } = useAuth();
  const navigate = useNavigate();

  const [perfil, setPerfil] = useState(null);
  const [cargandoPerfil, setCargandoPerfil] = useState(true);

  const [mostrarModalPerfil, setMostrarModalPerfil] = useState(false);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [errorPerfil, setErrorPerfil] = useState('');
  const [exitoPerfil, setExitoPerfil] = useState('');
  const [solicitudesCambio, setSolicitudesCambio] = useState([]);

  const [telefono, setTelefono] = useState('');
  const [vehiculo, setVehiculo] = useState('');

  const [transacciones, setTransacciones] = useState([]);
  const {
    puntos: puntosRetiro,
    cargando: cargandoPuntos,
    errorCarga: errorPuntos,
    crear: crearPunto,
    actualizar: actualizarPunto,
    quitar: quitarPunto,
  } = usePuntosRetiro(!!perfil);
  const [periodo, setPeriodo] = useState('TODO');
  const [semanaOffset, setSemanaOffset] = useState(0);

  const [tipo, setTipo] = useState('INGRESO');
  const [modoIngreso, setModoIngreso] = useState('PAQUETES');

  // Ingreso: Reparto de Paquetes
  const [fechaRuta, setFechaRuta] = useState(() => isoADDMMYYYY(hoyISO()));
  const [entregasExitosas, setEntregasExitosas] = useState('');
  const [entregasFallidas, setEntregasFallidas] = useState('');
  const [paquetesSobredimensionados, setPaquetesSobredimensionados] = useState('');
  const [valorPaquete, setValorPaquete] = useState(VALOR_PAQUETE_DEFAULT);
  const [observacionesRuta, setObservacionesRuta] = useState('');
  const [sinReparto, setSinReparto] = useState(false);
  const [turnoRuta, setTurnoRuta] = useState(turnoPorDefecto);

  // Ingreso: Retiros
  const [fechaRetiro, setFechaRetiro] = useState(() => isoADDMMYYYY(hoyISO()));
  const [retirosSeleccionados, setRetirosSeleccionados] = useState([]);
  const [observacionesRetiro, setObservacionesRetiro] = useState('');
  const [sinRetiro, setSinRetiro] = useState(false);
  const [turnoRetiro, setTurnoRetiro] = useState(turnoPorDefecto);

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
  const [mostrarCaptura, setMostrarCaptura] = useState(false);

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
  const retirosMarcados = puntosRetiro.filter((p) => retirosSeleccionados.includes(p.id));
  const retiros = retirosMarcados.length;
  const liquidoRetiro = retirosMarcados.reduce((suma, p) => suma + Number(p.precio), 0);
  const ivaRetiro = Math.round(liquidoRetiro * IVA);
  const brutoRetiro = liquidoRetiro + ivaRetiro;

  // Cálculo en vivo: descuento de combustible
  const totalSinDescuento = Number(montoSinDescuento) || 0;
  const descuento = Number(descuentoCombustible) || 0;
  const totalConDescuento = Math.max(totalSinDescuento - descuento, 0);

  // Turnos (AM/PM) que ya tienen registro para la fecha y categoría elegidas
  function turnosRegistrados(categoria, fechaDDMMYYYY) {
    const iso = ddmmyyyyAISO(fechaDDMMYYYY);
    if (!iso) return [];
    return transacciones
      .filter((t) => (
        t.tipo === 'INGRESO' &&
        t.categoriaIngreso === categoria &&
        t.turno &&
        new Date(t.fecha).toISOString().slice(0, 10) === iso
      ))
      .map((t) => t.turno);
  }
  const turnosRutaOcupados = turnosRegistrados('PAQUETES', fechaRuta);
  const turnosRetiroOcupados = turnosRegistrados('RETIROS', fechaRetiro);
  const turnoRutaOcupado = turnosRutaOcupados.includes(turnoRuta);
  const turnoRetiroOcupado = turnosRetiroOcupados.includes(turnoRetiro);

  // Filtro por período
  const transaccionesFiltradas = ordenarMovimientos(transacciones.filter((t) => {
    if (periodo === 'TODO') return true;
    const fecha = new Date(t.fecha);
    const limite = periodo === 'SEMANA' ? inicioSemanaActual() : inicioMesActual();
    return fecha >= limite;
  }));

  const resumenMostrado = calcularResumen(transaccionesFiltradas);

  // Historial: navegación semana por semana (lunes a domingo), independiente del filtro de período
  const { inicio: inicioSemanaVista, fin: finSemanaVista } = rangoSemana(semanaOffset);
  const transaccionesSemana = ordenarMovimientos(transacciones.filter((t) => {
    const fecha = new Date(t.fecha);
    return fecha >= inicioSemanaVista && fecha <= finSemanaVista;
  }));

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
    cargarSolicitudesCambio();
  }

  async function cargarSolicitudesCambio() {
    try {
      setSolicitudesCambio(await obtenerMisSolicitudes());
    } catch (err) {
      console.error(err);
    }
  }

  function handleCerrarPerfil() {
    setMostrarModalPerfil(false);
  }

  async function handleSolicitarCambio(datos) {
    setGuardandoPerfil(true);
    setErrorPerfil('');
    setExitoPerfil('');
    try {
      await crearSolicitudCambio(datos);
      await cargarSolicitudesCambio();
      setExitoPerfil('Solicitud enviada. El administrador la revisará.');
      return true;
    } catch (err) {
      setErrorPerfil(err.response?.data?.error || 'Error al enviar la solicitud');
      return false;
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

    if (turnoRutaOcupado) {
      setError(`Ya registraste la ruta ${turnoRuta} de esta fecha`);
      return;
    }

    if (sinReparto) {
      const motivo = observacionesRuta.trim();
      if (!motivo) {
        setError('Indica en observaciones por qué no se repartió ese día');
        return;
      }
      setGuardando(true);
      try {
        await crearTransaccion({
          tipo: 'INGRESO',
          monto: 0,
          descripcion: 'Sin reparto ese día',
          turno: turnoRuta,
          categoriaIngreso: 'PAQUETES',
          cantidadPaquetes: 0,
          paquetesFallidos: 0,
          paquetesTotalSalida: 0,
          valorPaquete: valorUnitario,
          montoLiquido: 0,
          montoIva: 0,
          sinActividad: true,
          observaciones: motivo,
          fecha: `${fechaISO}T12:00:00.000Z`,
        });
        setSinReparto(false);
        setTurnoRuta(siguienteTurno(turnoRuta, fechaISO));
        setObservacionesRuta('');
        setFechaRuta(isoADDMMYYYY(hoyISO()));
        cargarTransacciones();
      } catch (err) {
        setError(err.response?.data?.error || 'Error al registrar el día sin reparto');
      } finally {
        setGuardando(false);
      }
      return;
    }

    if (totalSalida <= 0) {
      setError('Ingresa al menos una entrega (exitosa o fallida)');
      return;
    }

    const descripcionRuta = sobredimensionados > 0
      ? `Reparto · ${exitosas} entregadas / ${sobredimensionados} S/D${fallidas > 0 ? ` / ${fallidas} fallidas` : ''} de ${totalSalida} totales`
      : `Reparto · ${exitosas} entregadas${fallidas > 0 ? ` / ${fallidas} fallidas` : ''} de ${totalSalida} totales`;

    setGuardando(true);
    try {
      await crearTransaccion({
        tipo: 'INGRESO',
        monto: bruto,
        descripcion: descripcionRuta,
        turno: turnoRuta,
        categoriaIngreso: 'PAQUETES',
        cantidadPaquetes: exitosas,
        paquetesFallidos: fallidas,
        paquetesTotalSalida: totalSalida,
        paquetesSobredimensionados: sobredimensionados > 0 ? sobredimensionados : undefined,
        valorPaquete: valorUnitario,
        montoLiquido: liquido,
        montoIva: iva,
        observaciones: observacionesRuta.trim() || undefined,
        fecha: `${fechaISO}T12:00:00.000Z`,
      });
      setEntregasExitosas('');
      setEntregasFallidas('');
      setPaquetesSobredimensionados('');
      setTurnoRuta(siguienteTurno(turnoRuta, fechaISO));
      setObservacionesRuta('');
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

    if (turnoRetiroOcupado) {
      setError(`Ya registraste los retiros ${turnoRetiro} de esta fecha`);
      return;
    }

    if (sinRetiro) {
      const motivo = observacionesRetiro.trim();
      if (!motivo) {
        setError('Indica en observaciones por qué no se hizo retiro ese día');
        return;
      }
      setGuardando(true);
      try {
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
          observaciones: motivo,
          fecha: `${fechaISO}T12:00:00.000Z`,
        });
        setSinRetiro(false);
        setTurnoRetiro(siguienteTurno(turnoRetiro, fechaISO));
        setObservacionesRetiro('');
        setFechaRetiro(isoADDMMYYYY(hoyISO()));
        cargarTransacciones();
      } catch (err) {
        setError(err.response?.data?.error || 'Error al registrar el día sin retiro');
      } finally {
        setGuardando(false);
      }
      return;
    }

    if (retiros <= 0) {
      setError('Marca al menos un retiro');
      return;
    }

    setGuardando(true);
    try {
      await crearTransaccion({
        tipo: 'INGRESO',
        monto: brutoRetiro,
        descripcion: `Retiros · ${retiros} colectas`,
        turno: turnoRetiro,
        categoriaIngreso: 'RETIROS',
        // El servidor recalcula los montos desde los retiros marcados
        puntosRetiroIds: retirosSeleccionados,
        observaciones: observacionesRetiro.trim() || undefined,
        fecha: `${fechaISO}T12:00:00.000Z`,
      });
      setRetirosSeleccionados([]);
      setTurnoRetiro(siguienteTurno(turnoRetiro, fechaISO));
      setObservacionesRetiro('');
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
      <ChatAsistente />
      <div className="app-container">
        <div className="app-topbar">
          <div className="app-brand">
            <img className="app-brand-logo" src="/favicon-192.png" alt="" width="44" height="44" />
            <div>
              <h1>Panel del Repartidor</h1>
              <p className="app-user">Hola, {usuario?.nombre}</p>
            </div>
          </div>
          <div className="topbar-actions">
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
            <TabSelector
              label="Período"
              value={periodo}
              onChange={setPeriodo}
              options={PERIODOS}
            />

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
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ marginBottom: '16px' }}
                    onClick={() => { setError(''); setMostrarCaptura(true); }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '6px', marginTop: '-2px' }}>
                      <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <circle cx="12" cy="13" r="3.5" />
                    </svg>
                    Registrar días con fotos
                  </button>

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
                        <span className="category-icon"><IconoCategoria nombre={modo.icono} /></span>
                        <span className="category-label">{modo.label}</span>
                        <span className="category-sub">{modo.sub}</span>
                      </button>
                    ))}
                  </div>

                  {modoIngreso === 'PAQUETES' ? (
                    <form onSubmit={handleGuardarRuta}>
                      <div className="field">
                        <span className="field-label">Fecha de la ruta</span>
                        <SelectorFecha
                          id="fecha-ruta"
                          value={fechaRuta}
                          onChange={setFechaRuta}
                          required
                        />
                      </div>

                      <div className="field">
                        <span className="field-label">Turno de la ruta</span>
                        <SelectorTurno
                          value={turnoRuta}
                          onChange={setTurnoRuta}
                          ocupados={turnosRutaOcupados}
                          etiqueta="la ruta"
                        />
                      </div>

                      <button
                        type="button"
                        className={`btn-sin-actividad ${sinReparto ? 'active' : ''}`}
                        onClick={() => { setSinReparto((v) => !v); setError(''); }}
                        aria-pressed={sinReparto}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="9" />
                            <path d="M5.6 5.6l12.8 12.8" />
                          </svg>
                        No se repartió ese día
                      </button>

                      {!sinReparto && (
                      <>
                      <div className="field-row field-row-cantidades">
                        <div className="field">
                          <span className="field-label">Entregas exitosas</span>
                          <CantidadStepper
                            ariaLabel="Entregas exitosas"
                            value={entregasExitosas}
                            onChange={(v) => setEntregasExitosas(limitarCantidad(v))}
                            placeholder="0"
                            required
                          />
                        </div>

                        <div className="field">
                          <span className="field-label">Entregas fallidas</span>
                          <CantidadStepper
                            ariaLabel="Entregas fallidas"
                            value={entregasFallidas}
                            onChange={(v) => setEntregasFallidas(limitarCantidad(v))}
                            placeholder="0"
                          />
                        </div>

                        <div className="field">
                          <span className="field-label">Sobredimensionados (opcional)</span>
                          <CantidadStepper
                            ariaLabel="Paquetes sobredimensionados"
                            value={paquetesSobredimensionados}
                            onChange={(v) => setPaquetesSobredimensionados(limitarCantidad(v))}
                            placeholder="0"
                          />
                        </div>
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

                      </>
                      )}

                      <div className="field">
                        <span className="field-label">
                          {sinReparto ? 'Motivo (obligatorio)' : 'Observaciones (opcional)'}
                        </span>
                        <textarea
                          rows="3"
                          maxLength={500}
                          required={sinReparto}
                          value={observacionesRuta}
                          onChange={(e) => setObservacionesRuta(e.target.value)}
                          placeholder={sinReparto ? 'Ej: Furgón en mantención, día libre, sin carga asignada' : 'Ej: 5 paquetes hechos en la mañana'}
                        />
                      </div>

                      <BarraResumen
                        mostrarMontos={!sinReparto}
                        liquido={liquido}
                        iva={iva}
                        bruto={bruto}
                        detalle={`${exitosas + sobredimensionados} entregados × $${formatoPeso(valorUnitario)}`}
                        formato={formatoPeso}
                        guardando={guardando}
                        deshabilitado={turnoRutaOcupado}
                        error={error}
                        textoBoton={sinReparto ? 'Registrar día sin reparto' : 'Guardar ruta'}
                      />
                    </form>
                  ) : (
                    <form onSubmit={handleGuardarRetiro}>
                      <div className="field">
                        <span className="field-label">Fecha del retiro</span>
                        <SelectorFecha
                          id="fecha-retiro"
                          value={fechaRetiro}
                          onChange={setFechaRetiro}
                          required
                        />
                      </div>

                      <div className="field">
                        <span className="field-label">Turno del retiro</span>
                        <SelectorTurno
                          value={turnoRetiro}
                          onChange={setTurnoRetiro}
                          ocupados={turnosRetiroOcupados}
                          etiqueta="los retiros"
                        />
                      </div>

                      <button
                        type="button"
                        className={`btn-sin-actividad ${sinRetiro ? 'active' : ''}`}
                        onClick={() => { setSinRetiro((v) => !v); setError(''); }}
                        aria-pressed={sinRetiro}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="9" />
                            <path d="M5.6 5.6l12.8 12.8" />
                          </svg>
                        No se hizo retiro ese día
                      </button>

                      {!sinRetiro && (
                      <>
                      <SelectorRetiros
                        puntos={puntosRetiro}
                        seleccionados={retirosSeleccionados}
                        onCambiarSeleccion={setRetirosSeleccionados}
                        onCrear={crearPunto}
                        onActualizar={actualizarPunto}
                        onQuitar={quitarPunto}
                        cargando={cargandoPuntos}
                        errorCarga={errorPuntos}
                      />

                      </>
                      )}

                      <div className="field">
                        <span className="field-label">
                          {sinRetiro ? 'Motivo (obligatorio)' : 'Observaciones (opcional)'}
                        </span>
                        <textarea
                          rows="3"
                          maxLength={500}
                          required={sinRetiro}
                          value={observacionesRetiro}
                          onChange={(e) => setObservacionesRetiro(e.target.value)}
                          placeholder={sinRetiro ? 'Ej: No había retiros programados, tienda cerrada' : 'Ej: Retiros hechos en la mañana'}
                        />
                      </div>

                      <BarraResumen
                        mostrarMontos={!sinRetiro}
                        liquido={liquidoRetiro}
                        iva={ivaRetiro}
                        bruto={brutoRetiro}
                        detalle={`${retiros} ${retiros === 1 ? 'retiro' : 'retiros'}`}
                        formato={formatoPeso}
                        guardando={guardando}
                        deshabilitado={turnoRetiroOcupado}
                        error={error}
                        textoBoton={sinRetiro ? 'Registrar día sin retiro' : 'Guardar retiro'}
                      />
                    </form>
                  )}
                </>
              ) : (
                <form onSubmit={handleCrearGasto}>
                  <div className="field">
                    <span className="field-label">Fecha del gasto</span>
                    <SelectorFecha
                      id="fecha-gasto"
                      value={fechaGasto}
                      onChange={setFechaGasto}
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
                        <span className="category-icon"><IconoCategoria nombre={cat.icono} /></span>
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

            <RankingSemanas
              transacciones={transacciones}
              onSeleccionarSemana={(offset) => {
                setSemanaOffset(offset);
                document.getElementById('historial-semana')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            />

            <div id="historial-semana" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <p className="section-title" style={{ margin: 0 }}>Historial</p>
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
            <ResumenSemana transacciones={transaccionesSemana} />

            {transaccionesSemana.length === 0 ? (
              <p className="empty-state">No hay movimientos registrados en esta semana.</p>
            ) : (
              <div className="table-container">
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
                  {transaccionesSemana.map((t, idx) => {
                    const tieneDesglose = t.tipo === 'INGRESO' && t.montoLiquido != null;
                    const expandida = filaExpandida === t.id;
                    const claseFila = [idx % 2 === 1 ? 'row-odd' : '', tieneDesglose ? 'row-clickable' : ''].filter(Boolean).join(' ');
                    return (
                      <>
                        <tr
                          key={t.id}
                          className={claseFila}
                          onClick={() => tieneDesglose && toggleFila(t.id)}
                        >
                          <td>{formatearFecha(t.fecha)}</td>
                          <td>
                            <span className={`tag ${etiquetaTipo(t).clase}`}>{etiquetaTipo(t).texto}</span>
                            {t.turno && <span className={`tag turno-${t.turno.toLowerCase()}`}>{t.turno}</span>}
                          </td>
                          <td>
                            {formatoDescripcionMovimiento(t)}
                            {t.observaciones && (
                              <span className="obs-dot" title="Tiene observaciones">●</span>
                            )}
                          </td>
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
                          <tr className={`row-detail ${idx % 2 === 1 ? 'row-odd' : ''}`}>
                            <td colSpan={6}>
                              <div className="detail-badges">
                                  {t.sinActividad ? (
                                    <span className="badge badge-sky">Sin actividad ese día</span>
                                  ) : (
                                    <>
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
                                    {t.cantidadPaquetes} entregados · {t.paquetesFallidos || 0} fallidos
                                  </span>
                                )}
                                {t.categoriaIngreso === 'PAQUETES' && t.paquetesSobredimensionados != null && t.paquetesSobredimensionados > 0 && (
                                  <span className="badge badge-neutral">
                                    {t.paquetesSobredimensionados} Sobredimensionados
                                  </span>
                                )}
                                {t.categoriaIngreso === 'RETIROS' && t.detallesRetiro?.length > 0 ? (
                                  t.detallesRetiro.map((d) => (
                                    <span className="badge badge-neutral" key={d.id}>
                                      {d.nombre} · ${formatoPeso(d.precio)}
                                    </span>
                                  ))
                                ) : (
                                  t.categoriaIngreso === 'RETIROS' && t.cantidadPaquetes != null && (
                                    <span className="badge badge-neutral">
                                      {t.cantidadPaquetes} retiros
                                    </span>
                                  )
                                )}
                                    </>
                                  )}
                                </div>
                              {t.observaciones && (
                                <p className="detail-note">{t.observaciones}</p>
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

      {mostrarCaptura && (
        <ImportarCaptura
          puntosRetiro={puntosRetiro}
          crearPunto={crearPunto}
          turnosOcupados={(categoria, iso) => turnosRegistrados(categoria, isoADDMMYYYY(iso))}
          onGuardado={cargarTransacciones}
          onCerrar={() => setMostrarCaptura(false)}
        />
      )}

      <ModalConfirmar
        visible={!!transaccionAEliminar}
        titulo="Eliminar movimiento"
        mensaje={
          transaccionAEliminar
            ? `¿Seguro que quieres eliminar el registro del ${formatearFecha(transaccionAEliminar.fecha)} — "${transaccionAEliminar.descripcion || 'sin descripción'}"? Esta acción no se puede deshacer.`
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
        solicitudes={solicitudesCambio}
        onSolicitar={handleSolicitarCambio}
        onCancelar={handleCerrarPerfil}
        enviando={guardandoPerfil}
        error={errorPerfil}
        exito={exitoPerfil}
      />
    </div>
  );
}

export default PanelRepartidor;