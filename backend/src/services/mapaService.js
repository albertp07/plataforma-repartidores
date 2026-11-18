const prisma = require('../config/prisma');
const { ErrorConsulta, rangoFechas } = require('./consultaFinancieraService');
const { iniciarGeocodificacion, necesitaGeocodificar } = require('./geocodificacionService');

const MAX_SIN_UBICAR = 30;

// Puntos para el mapa de calor: una entrada por dirección, con lo entregado y fallido en el período.
// ctx.repartidorId = null para ADMIN (todas las rutas) o el id del repartidor (solo las suyas).
async function obtenerMapaCalor(ctx, { desde, hasta, turno } = {}) {
  const turnoFiltro = turno && turno !== 'TODOS' ? turno : undefined;
  if (turnoFiltro && turnoFiltro !== 'AM' && turnoFiltro !== 'PM') {
    throw new ErrorConsulta('El turno debe ser TODOS, AM o PM');
  }

  const paradas = await prisma.parada.findMany({
    where: {
      transaccion: {
        ...(ctx.repartidorId ? { repartidorId: ctx.repartidorId } : {}),
        fecha: rangoFechas(desde, hasta),
        ...(turnoFiltro ? { turno: turnoFiltro } : {}),
      },
    },
    select: { direccion: true, direccionNormalizada: true, cantidadPaquetes: true, paquetesFallidos: true },
  });

  // Agrupa por dirección: la misma casa se repite en muchas rutas
  const porDireccion = new Map();
  for (const p of paradas) {
    let g = porDireccion.get(p.direccionNormalizada);
    if (!g) {
      g = { direccion: p.direccion, paradas: 0, entregados: 0, fallidos: 0 };
      porDireccion.set(p.direccionNormalizada, g);
    }
    g.paradas += 1;
    g.fallidos += p.paquetesFallidos;
    g.entregados += p.cantidadPaquetes - p.paquetesFallidos;
  }

  const claves = [...porDireccion.keys()];
  const cache = claves.length
    ? await prisma.direccionGeocodificada.findMany({ where: { direccionNormalizada: { in: claves } } })
    : [];
  const cachePorClave = new Map(cache.map((c) => [c.direccionNormalizada, c]));

  const puntos = [];
  const sinUbicar = [];
  let pendientes = 0;
  let aproximadas = 0;

  for (const [clave, g] of porDireccion) {
    const c = cachePorClave.get(clave);
    if (c?.encontrada && c.lat != null && c.lng != null) {
      if (c.aproximada) aproximadas += 1;
      puntos.push({ lat: c.lat, lng: c.lng, aproximada: c.aproximada, ...g });
    } else {
      if (necesitaGeocodificar(c)) pendientes += 1;
      sinUbicar.push({ direccion: g.direccion, paradas: g.paradas, enProceso: necesitaGeocodificar(c) });
    }
  }

  // Si quedan direcciones por ubicar, las procesa en segundo plano. El frontend vuelve a consultar.
  if (pendientes > 0) iniciarGeocodificacion();

  const sumar = (campo) => paradas.reduce((acc, p) => acc + p[campo], 0);
  const totalPaquetes = sumar('cantidadPaquetes');
  const totalFallidos = sumar('paquetesFallidos');

  return {
    puntos,
    sinUbicar: sinUbicar.sort((a, b) => b.paradas - a.paradas).slice(0, MAX_SIN_UBICAR),
    resumen: {
      paradas: paradas.length,
      direcciones: porDireccion.size,
      ubicadas: puntos.length,
      aproximadas,
      sinUbicar: sinUbicar.length,
      pendientes,
      entregados: totalPaquetes - totalFallidos,
      fallidos: totalFallidos,
    },
  };
}

module.exports = { obtenerMapaCalor };
