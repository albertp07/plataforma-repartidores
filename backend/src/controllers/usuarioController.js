const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');
const jwt = require('jsonwebtoken');

async function registrarUsuario(req, res) {
  try {
    const { nombre, email, password, rol, telefono, vehiculo } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Nombre, email y password son obligatorios' });
    }

    const passwordHasheado = await bcrypt.hash(password, 10);
    const creaRepartidor = Boolean(telefono || vehiculo);

    const usuarioExistente = await prisma.usuario.findUnique({ where: { email } });

    let usuario;

    if (usuarioExistente) {
      if (usuarioExistente.estado !== 'RECHAZADO') {
        return res.status(409).json({ error: 'Ese email ya está registrado' });
      }

      // El usuario había sido rechazado: se permite reintentar el registro,
      // actualizando sus datos y devolviéndolo a estado PENDIENTE.
      // El perfil de Repartidor se sincroniza siempre con lo enviado en esta
      // solicitud: si el campo viene vacío, se limpia (null) en vez de
      // conservar el dato de un intento anterior.
      usuario = await prisma.usuario.update({
        where: { email },
        data: {
          nombre,
          password: passwordHasheado,
          rol: rol || 'REPARTIDOR',
          estado: 'PENDIENTE',
          repartidor: {
            upsert: {
              create: { telefono: telefono || null, vehiculo: vehiculo || null },
              update: { telefono: telefono || null, vehiculo: vehiculo || null },
            },
          },
        },
        include: { repartidor: true },
      });
    } else {
      usuario = await prisma.usuario.create({
        data: {
          nombre,
          email,
          password: passwordHasheado,
          rol: rol || 'REPARTIDOR',
          estado: 'PENDIENTE',
          repartidor: creaRepartidor
            ? { create: { telefono: telefono || null, vehiculo: vehiculo || null } }
            : undefined,
        },
        include: { repartidor: true },
      });
    }

    const { password: _, ...usuarioSinPassword } = usuario;

    res.status(201).json(usuarioSinPassword);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ese email ya está registrado' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y password son obligatorios' });
    }

    const usuario = await prisma.usuario.findUnique({ where: { email } });

    if (!usuario) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const passwordCorrecto = await bcrypt.compare(password, usuario.password);

    if (!passwordCorrecto) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    if (usuario.estado === 'PENDIENTE') {
      return res.status(403).json({ error: 'Tu cuenta aún no ha sido aprobada por el administrador' });
    }

    if (usuario.estado === 'RECHAZADO') {
      return res.status(403).json({ error: 'Tu solicitud de acceso fue rechazada' });
    }

    const token = jwt.sign(
      { id: usuario.id, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    const { password: _, ...usuarioSinPassword } = usuario;

    res.json({ usuario: usuarioSinPassword, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
}

async function listarPendientes(req, res) {
  try {
    const usuarios = await prisma.usuario.findMany({
      where: { estado: 'PENDIENTE' },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        estado: true,
        creadoEn: true,
        repartidor: { select: { telefono: true, vehiculo: true } },
      },
      orderBy: { creadoEn: 'asc' },
    });

    res.json(usuarios);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al listar usuarios pendientes' });
  }
}

async function actualizarEstado(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!['ACTIVO', 'RECHAZADO'].includes(estado)) {
      return res.status(400).json({ error: "Estado inválido. Debe ser 'ACTIVO' o 'RECHAZADO'" });
    }

    const usuario = await prisma.usuario.update({
      where: { id: Number(id) },
      data: { estado },
    });

    const { password: _, ...usuarioSinPassword } = usuario;

    res.json(usuarioSinPassword);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar estado del usuario' });
  }
}

module.exports = { registrarUsuario, login, listarPendientes, actualizarEstado };
