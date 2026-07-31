const prisma = require('../config/prisma');

async function crearRepartidor(req, res) {
  try {
    const { telefono, vehiculo } = req.body;
    const usuarioId = req.usuario.id; // viene del token, gracias al middleware

    const repartidorExistente = await prisma.repartidor.findUnique({
      where: { usuarioId },
    });

    if (repartidorExistente) {
      return res.status(409).json({ error: 'Este usuario ya tiene un perfil de repartidor' });
    }

    const repartidor = await prisma.repartidor.create({
      data: {
        usuarioId,
        telefono,
        vehiculo,
      },
    });

    res.status(201).json(repartidor);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear repartidor' });
  }
}

async function listarRepartidores(req, res) {
  try {
    const repartidores = await prisma.repartidor.findMany({
      include: { usuario: { select: { id: true, nombre: true, email: true } } },
    });
    res.json(repartidores);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al listar repartidores' });
  }
}

async function obtenerMiPerfilRepartidor(req, res) {
  try {
    const usuarioId = req.usuario.id;

    const repartidor = await prisma.repartidor.findUnique({
      where: { usuarioId },
      include: { usuario: { select: { id: true, nombre: true, email: true } } },
    });

    if (!repartidor) {
      return res.status(404).json({ error: 'Este usuario no tiene perfil de repartidor' });
    }

    res.json(repartidor);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
}

module.exports = { crearRepartidor, listarRepartidores, obtenerMiPerfilRepartidor };