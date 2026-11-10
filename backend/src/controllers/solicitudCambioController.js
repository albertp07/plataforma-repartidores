const prisma = require('../config/prisma');
const { CAMPOS_PERFIL, limpiarCambios, aplicarCambiosPerfil } = require('../services/perfilAdminService');

const INCLUDE_ADMIN = {
  usuario: {
    select: {
      id: true,
      nombre: true,
      email: true,
      repartidor: { select: { telefono: true, vehiculo: true } },
    },
  },
};

// Repartidor: crea una solicitud de cambio de datos.
// Solo se guardan los campos que realmente difieren de los datos actuales.
async function crearSolicitud(req, res) {
  try {
    const usuarioId = req.usuario.id;
    const mensaje = String(req.body.mensaje || '').trim();
    const propuestos = limpiarCambios(req.body);

    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      include: { repartidor: true },
    });
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const actuales = {
      nombre: usuario.nombre,
      telefono: usuario.repartidor?.telefono || '',
      vehiculo: usuario.repartidor?.vehiculo || '',
    };

    const cambios = {};
    for (const campo of CAMPOS_PERFIL) {
      if (propuestos[campo] !== undefined && propuestos[campo] !== actuales[campo]) {
        cambios[campo] = propuestos[campo];
      }
    }

    if (cambios.nombre === '') {
      return res.status(400).json({ error: 'El nombre no puede estar vacío' });
    }

    if (Object.keys(cambios).length === 0 && !mensaje) {
      return res.status(400).json({ error: 'No indicaste ningún cambio ni escribiste un mensaje' });
    }

    if (mensaje.length > 500) {
      return res.status(400).json({ error: 'El mensaje no puede superar los 500 caracteres' });
    }

    const pendiente = await prisma.solicitudCambio.findFirst({
      where: { usuarioId, estado: 'PENDIENTE' },
    });
    if (pendiente) {
      return res.status(409).json({ error: 'Ya tienes una solicitud pendiente. Espera a que el administrador la resuelva.' });
    }

    const solicitud = await prisma.solicitudCambio.create({
      data: { usuarioId, cambios, mensaje: mensaje || null },
    });

    res.status(201).json(solicitud);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear la solicitud' });
  }
}

// Repartidor: sus últimas solicitudes y el estado de cada una.
async function listarMisSolicitudes(req, res) {
  try {
    const solicitudes = await prisma.solicitudCambio.findMany({
      where: { usuarioId: req.usuario.id },
      orderBy: { creadoEn: 'desc' },
      take: 10,
    });
    res.json(solicitudes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al listar tus solicitudes' });
  }
}

// Admin: todas las solicitudes (pendientes primero, luego las más recientes).
async function listarSolicitudes(req, res) {
  try {
    const pendientes = await prisma.solicitudCambio.findMany({
      where: { estado: 'PENDIENTE' },
      include: INCLUDE_ADMIN,
      orderBy: { creadoEn: 'asc' },
    });
    const resueltas = await prisma.solicitudCambio.findMany({
      where: { estado: { not: 'PENDIENTE' } },
      include: INCLUDE_ADMIN,
      orderBy: { resueltoEn: 'desc' },
      take: 30,
    });
    res.json([...pendientes, ...resueltas]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al listar las solicitudes' });
  }
}

// Admin: aprueba (aplica los cambios) o rechaza una solicitud.
// Al aprobar, el admin puede enviar "cambios" corregidos; si no, se usan los propuestos.
// Una solicitud que solo trae mensaje (ej. cambio de contraseña) se marca como resuelta
// sin tocar datos: el admin hace el cambio en la pestaña Usuarios.
async function resolverSolicitud(req, res) {
  try {
    const id = Number(req.params.id);
    const { estado, respuesta } = req.body;

    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    if (!['APROBADA', 'RECHAZADA'].includes(estado)) {
      return res.status(400).json({ error: "Estado inválido. Debe ser 'APROBADA' o 'RECHAZADA'" });
    }

    const solicitud = await prisma.solicitudCambio.findUnique({ where: { id } });
    if (!solicitud) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    if (solicitud.estado !== 'PENDIENTE') {
      return res.status(409).json({ error: 'Esta solicitud ya fue resuelta' });
    }

    const cambios = limpiarCambios(req.body.cambios || solicitud.cambios);

    await prisma.$transaction(async (tx) => {
      // updateMany con estado PENDIENTE evita resolver dos veces por doble clic / dos admins.
      const resultado = await tx.solicitudCambio.updateMany({
        where: { id, estado: 'PENDIENTE' },
        data: {
          estado,
          respuesta: respuesta ? String(respuesta).trim() : null,
          resueltoEn: new Date(),
        },
      });
      if (resultado.count === 0) {
        const error = new Error('Esta solicitud ya fue resuelta');
        error.status = 409;
        throw error;
      }

      if (estado === 'APROBADA') {
        await aplicarCambiosPerfil(tx, solicitud.usuarioId, cambios);
      }
    });

    const actualizada = await prisma.solicitudCambio.findUnique({
      where: { id },
      include: INCLUDE_ADMIN,
    });
    res.json(actualizada);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al resolver la solicitud' });
  }
}

module.exports = { crearSolicitud, listarMisSolicitudes, listarSolicitudes, resolverSolicitud };
