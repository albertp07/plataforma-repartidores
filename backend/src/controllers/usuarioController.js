const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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

    if (!usuario || !usuario.password) {
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

// Login/registro con Google. Recibe el idToken emitido por Google Identity
// Services (credential), lo verifica contra GOOGLE_CLIENT_ID y:
//  - si ya existe un usuario con ese googleId o email, lo loguea (aplicando
//    las mismas reglas de estado PENDIENTE/RECHAZADO que el login normal),
//  - si no existe, lo crea en estado PENDIENTE, igual que en el registro
//    manual: Google solo verifica la identidad, no autoriza el acceso.
async function loginConGoogle(req, res) {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ error: 'Falta el credential de Google' });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      console.error('GOOGLE_CLIENT_ID no está configurado en el backend');
      return res.status(500).json({ error: 'Login con Google no está configurado' });
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (verificationError) {
      return res.status(401).json({ error: 'Token de Google inválido' });
    }

    const { sub: googleId, email, name, email_verified: emailVerificado } = payload;

    if (!emailVerificado) {
      return res.status(401).json({ error: 'El email de Google no está verificado' });
    }

    let usuario = await prisma.usuario.findUnique({ where: { googleId } });

    if (!usuario) {
      // No hay cuenta vinculada por googleId. Buscamos por email para no
      // duplicar cuentas si la persona ya se había registrado manualmente.
      usuario = await prisma.usuario.findUnique({ where: { email } });

      if (usuario) {
        usuario = await prisma.usuario.update({
          where: { email },
          data: { googleId },
        });
      } else {
        usuario = await prisma.usuario.create({
          data: {
            nombre: name || email,
            email,
            googleId,
            rol: 'REPARTIDOR',
            estado: 'PENDIENTE',
          },
        });
      }
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
    res.status(500).json({ error: 'Error al iniciar sesión con Google' });
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

module.exports = {
  registrarUsuario,
  login,
  loginConGoogle,
  listarPendientes,
  actualizarEstado,
};
