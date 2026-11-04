const prisma = require('../config/prisma');

const PRECIO_MAXIMO = 99999999;

async function obtenerRepartidor(req, res) {
  const repartidor = await prisma.repartidor.findUnique({ where: { usuarioId: req.usuario.id } });
  if (!repartidor) {
    res.status(404).json({ error: 'No tienes un perfil de repartidor creado' });
    return null;
  }
  return repartidor;
}

// Valida y normaliza los datos de un punto de retiro. Devuelve { datos } o { error }.
function validarDatos({ nombre, zona, precio }) {
  const nombreLimpio = String(nombre ?? '').trim();
  const zonaLimpia = String(zona ?? '').trim();
  const precioNumero = Number(precio);

  if (!nombreLimpio || nombreLimpio.length > 60) {
    return { error: 'El nombre es obligatorio (máximo 60 caracteres)' };
  }
  if (!zonaLimpia || zonaLimpia.length > 40) {
    return { error: 'La zona es obligatoria (máximo 40 caracteres)' };
  }
  if (!Number.isFinite(precioNumero) || precioNumero <= 0 || precioNumero > PRECIO_MAXIMO) {
    return { error: 'El precio debe ser un número mayor a 0' };
  }

  return { datos: { nombre: nombreLimpio, zona: zonaLimpia, precio: Math.round(precioNumero) } };
}

// Lista los retiros activos del repartidor, ordenados por zona y nombre
async function listarPuntosRetiro(req, res) {
  try {
    const repartidor = await obtenerRepartidor(req, res);
    if (!repartidor) return;

    const puntos = await prisma.puntoRetiro.findMany({
      where: { repartidorId: repartidor.id, activo: true },
      orderBy: [{ zona: 'asc' }, { nombre: 'asc' }],
    });

    res.json(puntos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los retiros' });
  }
}

// Crea un retiro. Si ya existía uno desactivado con la misma zona y nombre, lo reactiva con el nuevo precio.
async function crearPuntoRetiro(req, res) {
  try {
    const repartidor = await obtenerRepartidor(req, res);
    if (!repartidor) return;

    const { datos, error } = validarDatos(req.body);
    if (error) return res.status(400).json({ error });

    const existente = await prisma.puntoRetiro.findUnique({
      where: {
        repartidorId_zona_nombre: { repartidorId: repartidor.id, zona: datos.zona, nombre: datos.nombre },
      },
    });

    if (existente && existente.activo) {
      return res.status(409).json({ error: 'Ya existe un retiro con ese nombre en esa zona' });
    }

    const punto = existente
      ? await prisma.puntoRetiro.update({ where: { id: existente.id }, data: { precio: datos.precio, activo: true } })
      : await prisma.puntoRetiro.create({ data: { ...datos, repartidorId: repartidor.id } });

    res.status(201).json(punto);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear el retiro' });
  }
}

// Edita nombre, zona o precio. Los registros ya guardados no cambian (tienen su propia copia del precio).
async function actualizarPuntoRetiro(req, res) {
  try {
    const repartidor = await obtenerRepartidor(req, res);
    if (!repartidor) return;

    const id = Number(req.params.id);
    const punto = await prisma.puntoRetiro.findUnique({ where: { id } });
    if (!punto || punto.repartidorId !== repartidor.id || !punto.activo) {
      return res.status(404).json({ error: 'Retiro no encontrado' });
    }

    const { datos, error } = validarDatos({
      nombre: req.body.nombre ?? punto.nombre,
      zona: req.body.zona ?? punto.zona,
      precio: req.body.precio ?? punto.precio,
    });
    if (error) return res.status(400).json({ error });

    const duplicado = await prisma.puntoRetiro.findFirst({
      where: {
        repartidorId: repartidor.id,
        zona: datos.zona,
        nombre: datos.nombre,
        activo: true,
        NOT: { id },
      },
    });
    if (duplicado) {
      return res.status(409).json({ error: 'Ya existe un retiro con ese nombre en esa zona' });
    }

    const actualizado = await prisma.puntoRetiro.update({ where: { id }, data: datos });
    res.json(actualizado);
  } catch (error) {
    // Puede chocar con un retiro desactivado que tenga el mismo nombre y zona
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un retiro con ese nombre en esa zona' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el retiro' });
  }
}

// Desactiva el retiro (no se borra: el historial conserva su copia)
async function desactivarPuntoRetiro(req, res) {
  try {
    const repartidor = await obtenerRepartidor(req, res);
    if (!repartidor) return;

    const id = Number(req.params.id);
    const punto = await prisma.puntoRetiro.findUnique({ where: { id } });
    if (!punto || punto.repartidorId !== repartidor.id || !punto.activo) {
      return res.status(404).json({ error: 'Retiro no encontrado' });
    }

    await prisma.puntoRetiro.update({ where: { id }, data: { activo: false } });
    res.json({ mensaje: 'Retiro eliminado de tu lista' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el retiro' });
  }
}

module.exports = {
  listarPuntosRetiro,
  crearPuntoRetiro,
  actualizarPuntoRetiro,
  desactivarPuntoRetiro,
};
