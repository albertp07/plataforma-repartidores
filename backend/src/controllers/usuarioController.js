const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');
const jwt = require('jsonwebtoken');

async function registrarUsuario(req, res) {
  try {
    const { nombre, email, password, rol } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Nombre, email y password son obligatorios' });
    }

    const passwordHasheado = await bcrypt.hash(password, 10);

    const usuario = await prisma.usuario.create({
      data: {
        nombre,
        email,
        password: passwordHasheado,
        rol: rol || 'REPARTIDOR',
      },
    });

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

module.exports = { registrarUsuario, login };