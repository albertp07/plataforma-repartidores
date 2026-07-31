const prisma = require('../config/prisma');

// Registrar un ingreso o gasto
async function crearTransaccion(req, res) {
  try {
    const {
      tipo, monto, descripcion, fecha, categoriaGasto, categoriaIngreso,
      montoSinDescuento, descuentoAplicado,
      cantidadPaquetes, paquetesFallidos, paquetesTotalSalida, paquetesSobredimensionados,
      valorPaquete, montoLiquido, montoIva,
    } = req.body;

    if (!tipo || !monto) {
      return res.status(400).json({ error: 'Tipo y monto son obligatorios' });
    }

    if (!['INGRESO', 'GASTO'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo debe ser INGRESO o GASTO' });
    }

    const repartidor = await prisma.repartidor.findUnique({ where: { usuarioId: req.usuario.id } });

    if (!repartidor) {
      return res.status(404).json({ error: 'No tienes un perfil de repartidor creado' });
    }

    const transaccion = await prisma.transaccion.create({
      data: {
        repartidorId: repartidor.id,
        tipo,
        monto,
        descripcion,
        categoriaGasto: categoriaGasto ?? undefined,
        categoriaIngreso: categoriaIngreso ?? undefined,
        montoSinDescuento: montoSinDescuento ?? undefined,
        descuentoAplicado: descuentoAplicado ?? undefined,
        cantidadPaquetes: cantidadPaquetes ?? undefined,
        paquetesFallidos: paquetesFallidos ?? undefined,
        paquetesTotalSalida: paquetesTotalSalida ?? undefined,
        paquetesSobredimensionados: paquetesSobredimensionados ?? undefined,
        valorPaquete: valorPaquete ?? undefined,
        montoLiquido: montoLiquido ?? undefined,
        montoIva: montoIva ?? undefined,
        fecha: fecha ? new Date(fecha) : undefined,
      },
    });

    res.status(201).json(transaccion);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al registrar transacción' });
  }
}

// Ver mis propias transacciones (repartidor)
async function misTransacciones(req, res) {
  try {
    const usuarioId = req.usuario.id;

    const repartidor = await prisma.repartidor.findUnique({ where: { usuarioId } });

    if (!repartidor) {
      return res.status(404).json({ error: 'No tienes un perfil de repartidor creado' });
    }

    const transacciones = await prisma.transaccion.findMany({
      where: { repartidorId: repartidor.id },
      orderBy: { fecha: 'desc' },
    });

    // Calculamos balance
    const totalIngresos = transacciones
      .filter((t) => t.tipo === 'INGRESO')
      .reduce((sum, t) => sum + Number(t.monto), 0);

    const totalGastos = transacciones
      .filter((t) => t.tipo === 'GASTO')
      .reduce((sum, t) => sum + Number(t.monto), 0);

    res.json({
      transacciones,
      resumen: {
        totalIngresos,
        totalGastos,
        balance: totalIngresos - totalGastos,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener transacciones' });
  }
}

// Ver todas las transacciones (admin) - para el dashboard
async function todasLasTransacciones(req, res) {
  try {
    const transacciones = await prisma.transaccion.findMany({
      include: {
        repartidor: {
          include: { usuario: { select: { nombre: true, email: true } } },
        },
      },
      orderBy: { fecha: 'desc' },
    });

    res.json(transacciones);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener transacciones' });
  }
}

async function eliminarTransaccion(req, res) {
  try {
    const { id } = req.params;

    const transaccion = await prisma.transaccion.findUnique({ where: { id: Number(id) } });

    if (!transaccion) {
      return res.status(404).json({ error: 'Movimiento no encontrado' });
    }

    // Si es ADMIN, puede eliminar cualquier movimiento
    if (req.usuario.rol === 'ADMIN') {
      await prisma.transaccion.delete({ where: { id: Number(id) } });
      return res.json({ mensaje: 'Movimiento eliminado correctamente' });
    }

    // Si no es ADMIN, solo puede eliminar sus propios movimientos
    const repartidor = await prisma.repartidor.findUnique({ where: { usuarioId: req.usuario.id } });

    if (!repartidor) {
      return res.status(404).json({ error: 'No tienes un perfil de repartidor creado' });
    }

    if (transaccion.repartidorId !== repartidor.id) {
      return res.status(403).json({ error: 'No puedes eliminar este movimiento' });
    }

    await prisma.transaccion.delete({ where: { id: Number(id) } });

    res.json({ mensaje: 'Movimiento eliminado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el movimiento' });
  }
}

module.exports = {
  crearTransaccion,
  misTransacciones,
  todasLasTransacciones,
  eliminarTransaccion,
};