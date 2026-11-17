const prisma = require('../config/prisma');
const { normalizarDireccion } = require('./paradasPdfService');

// Consultas agregadas de solo lectura que usa el chatbot como "herramientas".
// Todos los montos se calculan aquí (nunca el modelo) y se devuelven en pesos CLP enteros.
// Los montos de ingreso son BRUTOS (con IVA), igual que el balance de la plataforma:
// Balance neto = Total ingresos brutos - Total gastos.

const MAX_FILAS = 60;
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const AGRUPACIONES = ['dia', 'semana', 'mes', 'dia_semana'];
const ORDENAR_POR = ['ingresos', 'gastos', 'balance', 'periodo'];

class ErrorConsulta extends Error {}

function pad(n) {
  return String(n).padStart(2, '0');
}

function iso(d) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function ddmm(d) {
  return `${pad(d.getUTCDate())}-${pad(d.getUTCMonth() + 1)}`;
}

// Las fechas sin hora se guardan a mediodía UTC: el rango cubre el día completo en UTC
function rangoFechas(desde, hasta) {
  const where = {};
  const validar = (valor, nombre) => {
    if (valor == null || valor === '') return null;
    if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
      throw new ErrorConsulta(`${nombre} debe tener formato YYYY-MM-DD`);
    }
    return valor;
  };
  const d = validar(desde, 'desde');
  const h = validar(hasta, 'hasta');
  if (d) where.gte = new Date(`${d}T00:00:00.000Z`);
  if (h) where.lte = new Date(`${h}T23:59:59.999Z`);
  if (d && h && d > h) throw new ErrorConsulta('"desde" no puede ser posterior a "hasta"');
  return Object.keys(where).length ? where : undefined;
}

function lunesDe(d) {
  const delta = (d.getUTCDay() + 6) % 7; // semana Lunes-Domingo
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - delta));
}

function clavePeriodo(fecha, agrupar) {
  if (agrupar === 'dia') return { clave: iso(fecha), etiqueta: iso(fecha) };
  if (agrupar === 'mes') {
    const clave = `${fecha.getUTCFullYear()}-${pad(fecha.getUTCMonth() + 1)}`;
    return { clave, etiqueta: clave };
  }
  if (agrupar === 'dia_semana') {
    const n = fecha.getUTCDay();
    return { clave: String((n + 6) % 7), etiqueta: DIAS[n] }; // clave ordena lunes -> domingo
  }
  const lunes = lunesDe(fecha);
  const domingo = new Date(Date.UTC(lunes.getUTCFullYear(), lunes.getUTCMonth(), lunes.getUTCDate() + 6));
  return { clave: iso(lunes), etiqueta: `semana del ${ddmm(lunes)} al ${ddmm(domingo)} (${lunes.getUTCFullYear()})` };
}

function buscarTransacciones(ctx, extra = {}) {
  return prisma.transaccion.findMany({
    where: { ...(ctx.repartidorId ? { repartidorId: ctx.repartidorId } : {}), ...extra },
    select: {
      tipo: true, monto: true, fecha: true, categoriaGasto: true, categoriaIngreso: true,
      cantidadPaquetes: true, paquetesFallidos: true, sinActividad: true,
    },
  });
}

// Ingresos, gastos y balance agrupados por día, semana, mes o día de la semana
async function resumenPorPeriodo(ctx, { agrupar, desde, hasta, ordenar_por, orden, limite } = {}) {
  if (!AGRUPACIONES.includes(agrupar)) {
    throw new ErrorConsulta(`agrupar debe ser uno de: ${AGRUPACIONES.join(', ')}`);
  }
  const ordenarPor = ordenar_por || 'periodo';
  if (!ORDENAR_POR.includes(ordenarPor)) {
    throw new ErrorConsulta(`ordenar_por debe ser uno de: ${ORDENAR_POR.join(', ')}`);
  }
  const sentido = orden || (ordenarPor === 'periodo' ? 'asc' : 'desc');
  if (!['asc', 'desc'].includes(sentido)) throw new ErrorConsulta('orden debe ser asc o desc');
  const tope = Math.min(Math.max(parseInt(limite, 10) || 10, 1), MAX_FILAS);

  const transacciones = await buscarTransacciones(ctx, { fecha: rangoFechas(desde, hasta) });

  const grupos = new Map();
  const totales = { ingresos: 0, gastos: 0 };

  for (const t of transacciones) {
    const { clave, etiqueta } = clavePeriodo(t.fecha, agrupar);
    if (!grupos.has(clave)) {
      grupos.set(clave, {
        periodo: clave, etiqueta, ingresos: 0, gastos: 0, entregas: 0, retiros: 0,
        _diasIngreso: new Set(),
      });
    }
    const g = grupos.get(clave);
    const monto = Number(t.monto) || 0;

    if (t.tipo === 'INGRESO') {
      g.ingresos += monto;
      totales.ingresos += monto;
      if (!t.sinActividad && monto > 0) g._diasIngreso.add(iso(t.fecha));
      if (t.categoriaIngreso === 'PAQUETES') g.entregas += t.cantidadPaquetes || 0;
      if (t.categoriaIngreso === 'RETIROS') g.retiros += t.cantidadPaquetes || 0;
    } else {
      g.gastos += monto;
      totales.gastos += monto;
    }
  }

  let filas = [...grupos.values()].map((g) => {
    const fila = {
      periodo: g.periodo,
      etiqueta: g.etiqueta,
      ingresos: Math.round(g.ingresos),
      gastos: Math.round(g.gastos),
      balance: Math.round(g.ingresos - g.gastos),
      entregas: g.entregas,
      retiros: g.retiros,
    };
    if (agrupar === 'dia_semana') {
      fila.diasConIngresos = g._diasIngreso.size;
      fila.promedioIngresoPorDia = g._diasIngreso.size ? Math.round(g.ingresos / g._diasIngreso.size) : 0;
    }
    return fila;
  });

  filas.sort((a, b) => {
    const va = a[ordenarPor];
    const vb = b[ordenarPor];
    const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
    return sentido === 'asc' ? cmp : -cmp;
  });

  const totalPeriodos = filas.length;
  filas = filas.slice(0, tope);

  return {
    agrupadoPor: agrupar,
    moneda: 'CLP',
    nota: 'Ingresos brutos (con IVA). balance = ingresos - gastos.',
    totalPeriodos,
    mostrando: filas.length,
    filas,
    totalesDelRango: {
      ingresos: Math.round(totales.ingresos),
      gastos: Math.round(totales.gastos),
      balance: Math.round(totales.ingresos - totales.gastos),
    },
  };
}

// Totales por categoría de gasto o de ingreso
async function totalesPorCategoria(ctx, { tipo, desde, hasta } = {}) {
  if (!['GASTO', 'INGRESO'].includes(tipo)) throw new ErrorConsulta('tipo debe ser GASTO o INGRESO');

  const transacciones = await buscarTransacciones(ctx, { tipo, fecha: rangoFechas(desde, hasta) });

  const mapa = new Map();
  let total = 0;
  for (const t of transacciones) {
    if (t.sinActividad) continue;
    const categoria = (tipo === 'GASTO' ? t.categoriaGasto : t.categoriaIngreso) || 'SIN_CATEGORIA';
    const monto = Number(t.monto) || 0;
    const actual = mapa.get(categoria) || { categoria, monto: 0, registros: 0 };
    actual.monto += monto;
    actual.registros += 1;
    mapa.set(categoria, actual);
    total += monto;
  }

  const categorias = [...mapa.values()]
    .map((c) => ({ ...c, monto: Math.round(c.monto) }))
    .sort((a, b) => b.monto - a.monto);

  return { tipo, moneda: 'CLP', total: Math.round(total), categorias };
}

// Cantidad de entregas, fallidas y retiros en un rango (para preguntas de volumen)
async function estadisticasPaquetes(ctx, { desde, hasta } = {}) {
  const transacciones = await buscarTransacciones(ctx, {
    tipo: 'INGRESO',
    fecha: rangoFechas(desde, hasta),
  });

  const r = { entregasExitosas: 0, paquetesFallidos: 0, retiros: 0, diasConActividad: new Set() };
  for (const t of transacciones) {
    if (t.sinActividad) continue;
    if (t.categoriaIngreso === 'PAQUETES') {
      r.entregasExitosas += t.cantidadPaquetes || 0;
      r.paquetesFallidos += t.paquetesFallidos || 0;
      r.diasConActividad.add(iso(t.fecha));
    } else if (t.categoriaIngreso === 'RETIROS') {
      r.retiros += t.cantidadPaquetes || 0;
      r.diasConActividad.add(iso(t.fecha));
    }
  }

  return {
    entregasExitosas: r.entregasExitosas,
    paquetesFallidos: r.paquetesFallidos,
    retiros: r.retiros,
    diasConActividad: r.diasConActividad.size,
  };
}

// Busca paradas por texto (dirección o notas) y rango de fechas. Sin texto, lista las más recientes.
async function buscarParadas(ctx, { texto, desde, hasta, limite } = {}) {
  const tope = Math.min(Math.max(parseInt(limite, 10) || 20, 1), 50);
  const tokens = normalizarDireccion(texto || '').split(' ').filter(Boolean).slice(0, 6);

  const where = {
    transaccion: {
      ...(ctx.repartidorId ? { repartidorId: ctx.repartidorId } : {}),
      fecha: rangoFechas(desde, hasta),
    },
    AND: tokens.map((t) => ({
      OR: [
        { direccionNormalizada: { contains: t } },
        { notas: { contains: t, mode: 'insensitive' } },
      ],
    })),
  };

  const [total, paradas] = await Promise.all([
    prisma.parada.count({ where }),
    prisma.parada.findMany({
      where,
      include: { transaccion: { select: { fecha: true, turno: true } } },
      orderBy: [{ transaccion: { fecha: 'desc' } }, { orden: 'asc' }],
      take: tope,
    }),
  ]);

  return {
    totalCoincidencias: total,
    mostrando: paradas.length,
    paradas: paradas.map((p) => ({
      fecha: iso(p.transaccion.fecha),
      turno: p.transaccion.turno,
      direccion: p.direccion,
      hora: p.hora,
      notas: p.notas,
      cantidadPaquetes: p.cantidadPaquetes,
      paquetesFallidos: p.paquetesFallidos,
    })),
  };
}

function minutosATexto(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

// Duración de cada ruta con paradas: desde la primera hasta la última hora de llegada registrada
async function duracionRutas(ctx, { desde, hasta, limite } = {}) {
  const tope = Math.min(Math.max(parseInt(limite, 10) || 15, 1), MAX_FILAS);

  const rutas = await prisma.transaccion.findMany({
    where: {
      ...(ctx.repartidorId ? { repartidorId: ctx.repartidorId } : {}),
      tipo: 'INGRESO',
      categoriaIngreso: 'PAQUETES',
      fecha: rangoFechas(desde, hasta),
      paradas: { some: {} },
    },
    select: { fecha: true, turno: true, paradas: { select: { hora: true } } },
    orderBy: { fecha: 'desc' },
    take: MAX_FILAS,
  });

  const aMin = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
  const filas = [];
  for (const r of rutas) {
    const horas = r.paradas.map((p) => p.hora).filter(Boolean).sort();
    if (horas.length < 2) continue;
    const minutos = aMin(horas[horas.length - 1]) - aMin(horas[0]);
    filas.push({
      fecha: iso(r.fecha),
      turno: r.turno,
      primeraHora: horas[0],
      ultimaHora: horas[horas.length - 1],
      duracionMinutos: minutos,
      duracion: minutosATexto(minutos),
      paradasConHora: horas.length,
      paradasTotales: r.paradas.length,
    });
  }

  const promedio = filas.length ? Math.round(filas.reduce((s, f) => s + f.duracionMinutos, 0) / filas.length) : null;
  return {
    nota: 'Duración = primera a última hora de llegada registrada. No incluye carga ni regreso. Solo rutas con paradas cargadas.',
    rutasConDatos: filas.length,
    promedioMinutos: promedio,
    promedio: promedio == null ? null : minutosATexto(promedio),
    filas: filas.slice(0, tope),
  };
}

module.exports = { ErrorConsulta, resumenPorPeriodo, totalesPorCategoria, estadisticasPaquetes, buscarParadas, duracionRutas };
