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

async function actualizarMiPerfil(req, res) {
  try {
    const usuarioId = req.usuario.id;
    const { nombre, telefono, vehiculo } = req.body;

    if (nombre !== undefined && String(nombre).trim() === '') {
      return res.status(400).json({ error: 'El nombre no puede estar vacío' });
    }

    let usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (nombre !== undefined && nombre !== usuario.nombre) {
      usuario = await prisma.usuario.update({
        where: { id: usuarioId },
        data: { nombre },
      });
    }

    // El email nunca se actualiza desde este endpoint por seguridad.
    // El perfil de Repartidor se crea si aún no existe (upsert).
    const repartidor = await prisma.repartidor.upsert({
      where: { usuarioId },
      create: {
        usuarioId,
        telefono: telefono || null,
        vehiculo: vehiculo || null,
      },
      update: {
        telefono: telefono || null,
        vehiculo: vehiculo || null,
      },
    });

    const { password: _, ...usuarioSinPassword } = usuario;

    res.json({ usuario: usuarioSinPassword, repartidor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el perfil' });
  }
}

module.exports = {
  crearRepartidor,
  listarRepartidores,
  obtenerMiPerfilRepartidor,
  actualizarMiPerfil,
};
