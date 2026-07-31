const prisma = require('../config/prisma');

// Resumen general: totales de toda la plataforma
async function resumenGeneral(req, res) {
  try {
    const transacciones = await prisma.transaccion.findMany();

    const totalIngresos = transacciones
      .filter((t) => t.tipo === 'INGRESO')
      .reduce((sum, t) => sum + Number(t.monto), 0);

    const totalGastos = transacciones
      .filter((t) => t.tipo === 'GASTO')
      .reduce((sum, t) => sum + Number(t.monto), 0);

    const totalRepartidores = await prisma.repartidor.count();

    res.json({
      totalIngresos,
      totalGastos,
      balance: totalIngresos - totalGastos,
      totalRepartidores,
      totalTransacciones: transacciones.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al generar resumen' });
  }
}

// Balance agrupado por cada repartidor (para tabla/ranking en el dashboard)
async function balancePorRepartidor(req, res) {
  try {
    const repartidores = await prisma.repartidor.findMany({
      include: {
        usuario: { select: { nombre: true, email: true } },
        transacciones: true,
      },
    });

    const resultado = repartidores.map((r) => {
      const totalIngresos = r.transacciones
        .filter((t) => t.tipo === 'INGRESO')
        .reduce((sum, t) => sum + Number(t.monto), 0);

      const totalGastos = r.transacciones
        .filter((t) => t.tipo === 'GASTO')
        .reduce((sum, t) => sum + Number(t.monto), 0);

      return {
        repartidorId: r.id,
        nombre: r.usuario.nombre,
        email: r.usuario.email,
        totalIngresos,
        totalGastos,
        balance: totalIngresos - totalGastos,
        cantidadTransacciones: r.transacciones.length,
      };
    });

    res.json(resultado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al generar reporte por repartidor' });
  }
}

// Ingresos/gastos agrupados por día (para gráfico de línea/barras en el tiempo)
async function movimientosPorFecha(req, res) {
  try {
    const transacciones = await prisma.transaccion.findMany({
      orderBy: { fecha: 'asc' },
    });

    const agrupado = {};

    transacciones.forEach((t) => {
      const fechaKey = t.fecha.toISOString().split('T')[0]; // YYYY-MM-DD

      if (!agrupado[fechaKey]) {
        agrupado[fechaKey] = { fecha: fechaKey, ingresos: 0, gastos: 0 };
      }

      if (t.tipo === 'INGRESO') {
        agrupado[fechaKey].ingresos += Number(t.monto);
      } else {
        agrupado[fechaKey].gastos += Number(t.monto);
      }
    });

    res.json(Object.values(agrupado));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al generar reporte por fecha' });
  }
}

module.exports = { resumenGeneral, balancePorRepartidor, movimientosPorFecha };