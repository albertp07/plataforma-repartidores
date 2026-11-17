const prisma = require('../config/prisma');
const { leerParadasDePdf, normalizarDireccion, ErrorPdf } = require('../services/paradasPdfService');
const { buscarParadas, ErrorConsulta } = require('../services/consultaFinancieraService');

const MAX_PARADAS = 120;
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Busca la ruta (transacción de ingreso por paquetes) y verifica que el usuario pueda tocarla.
// ADMIN puede ver cualquiera; un repartidor solo las suyas.
async function rutaAutorizada(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Ruta inválida' });
    return null;
  }

  const transaccion = await prisma.transaccion.findUnique({ where: { id } });
  if (!transaccion) {
    res.status(404).json({ error: 'Ruta no encontrada' });
    return null;
  }

  if (req.usuario.rol !== 'ADMIN') {
    const repartidor = await prisma.repartidor.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!repartidor || repartidor.id !== transaccion.repartidorId) {
      res.status(403).json({ error: 'No puedes ver las paradas de esta ruta' });
      return null;
    }
  }

  if (transaccion.tipo !== 'INGRESO' || transaccion.categoriaIngreso !== 'PAQUETES' || transaccion.sinActividad) {
    res.status(400).json({ error: 'Las paradas solo se registran en rutas de reparto con actividad' });
    return null;
  }

  return transaccion;
}

function aParadaPublica(p) {
  return {
    id: p.id,
    orden: p.orden,
    direccion: p.direccion,
    hora: p.hora,
    notas: p.notas || '',
    cantidadPaquetes: p.cantidadPaquetes,
    paquetesFallidos: p.paquetesFallidos,
  };
}

// Valida y limpia una parada recibida del cliente. Devuelve { dato } o { error }.
function limpiarParada(p, indice) {
  const fila = indice + 1;
  const direccion = typeof p?.direccion === 'string' ? p.direccion.trim().replace(/\s+/g, ' ') : '';
  if (!direccion) return { error: `La parada ${fila} no tiene dirección` };
  if (direccion.length > 200) return { error: `La dirección de la parada ${fila} es demasiado larga` };

  const hora = p.hora == null || p.hora === '' ? null : String(p.hora).trim();
  if (hora !== null && !HORA_RE.test(hora)) return { error: `La hora de la parada ${fila} debe tener formato HH:mm` };

  const notas = typeof p.notas === 'string' ? p.notas.trim().slice(0, 200) : '';

  const cantidad = Number(p.cantidadPaquetes ?? 1);
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 99) {
    return { error: `La cantidad de paquetes de la parada ${fila} debe estar entre 1 y 99` };
  }
  const fallidos = Number(p.paquetesFallidos ?? 0);
  if (!Number.isInteger(fallidos) || fallidos < 0 || fallidos > cantidad) {
    return { error: `Los fallidos de la parada ${fila} no pueden superar sus paquetes` };
  }

  return {
    dato: {
      orden: fila,
      direccion,
      direccionNormalizada: normalizarDireccion(direccion),
      hora,
      notas: notas || null,
      cantidadPaquetes: cantidad,
      paquetesFallidos: fallidos,
    },
  };
}

// POST /transacciones/:id/paradas/vista-previa  (multipart, campo "pdf")
// Lee el PDF de Circuit y devuelve un BORRADOR. No guarda nada.
async function vistaPreviaParadas(req, res) {
  try {
    const transaccion = await rutaAutorizada(req, res);
    if (!transaccion) return;

    if (!req.file) return res.status(400).json({ error: 'Adjunta el PDF de la ruta' });
    if (req.file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      return res.status(415).json({ error: 'El archivo no es un PDF válido' });
    }

    const lectura = await leerParadasDePdf(req.file.buffer);
    if (lectura.paradas.length > MAX_PARADAS) {
      return res.status(422).json({ error: `El PDF tiene más de ${MAX_PARADAS} paradas` });
    }

    const advertencias = [...lectura.advertencias];
    const fechaRuta = transaccion.fecha.toISOString().slice(0, 10);
    if (lectura.fechaPdf && lectura.fechaPdf !== fechaRuta) {
      advertencias.push(`El PDF es del ${lectura.fechaPdf.split('-').reverse().join('-')} y esta ruta es del ${fechaRuta.split('-').reverse().join('-')}. Verifica que sea el día correcto.`);
    }

    res.json({ paradas: lectura.paradas, fechaPdf: lectura.fechaPdf, advertencias });
  } catch (error) {
    if (error instanceof ErrorPdf) return res.status(422).json({ error: error.message });
    console.error('Error al leer PDF de paradas:', error);
    res.status(500).json({ error: 'No se pudo leer el PDF. Intenta de nuevo.' });
  }
}

// GET /transacciones/:id/paradas
async function listarParadas(req, res) {
  try {
    const transaccion = await rutaAutorizada(req, res);
    if (!transaccion) return;

    const paradas = await prisma.parada.findMany({
      where: { transaccionId: transaccion.id },
      orderBy: { orden: 'asc' },
    });
    res.json({ paradas: paradas.map(aParadaPublica) });
  } catch (error) {
    console.error('Error al listar paradas:', error);
    res.status(500).json({ error: 'Error al obtener las paradas' });
  }
}

// PUT /transacciones/:id/paradas   body: { paradas: [...] }
// Reemplaza todas las paradas de la ruta (sirve para importar, agregar, editar y borrar).
// No se exige que cuadren con los totales de la ruta: Circuit cuenta una sola parada aunque haya varios paquetes.
async function reemplazarParadas(req, res) {
  try {
    const transaccion = await rutaAutorizada(req, res);
    if (!transaccion) return;

    const entrada = req.body?.paradas;
    if (!Array.isArray(entrada)) return res.status(400).json({ error: 'Envía la lista de paradas' });
    if (entrada.length > MAX_PARADAS) return res.status(400).json({ error: `Máximo ${MAX_PARADAS} paradas por ruta` });

    const datos = [];
    for (let i = 0; i < entrada.length; i += 1) {
      const r = limpiarParada(entrada[i], i);
      if (r.error) return res.status(400).json({ error: r.error });
      datos.push({ ...r.dato, transaccionId: transaccion.id });
    }

    await prisma.$transaction([
      prisma.parada.deleteMany({ where: { transaccionId: transaccion.id } }),
      prisma.parada.createMany({ data: datos }),
    ]);

    const paradas = await prisma.parada.findMany({
      where: { transaccionId: transaccion.id },
      orderBy: { orden: 'asc' },
    });
    res.json({ paradas: paradas.map(aParadaPublica) });
  } catch (error) {
    console.error('Error al guardar paradas:', error);
    res.status(500).json({ error: 'Error al guardar las paradas' });
  }
}

// GET /paradas?q=laguna&desde=2026-11-01&hasta=2026-11-30&limite=30
async function buscarParadasHandler(req, res) {
  try {
    const ctx = { repartidorId: null };
    if (req.usuario.rol !== 'ADMIN') {
      const repartidor = await prisma.repartidor.findUnique({ where: { usuarioId: req.usuario.id } });
      if (!repartidor) return res.status(404).json({ error: 'No tienes un perfil de repartidor creado' });
      ctx.repartidorId = repartidor.id;
    }

    const { q, desde, hasta, limite } = req.query;
    const resultado = await buscarParadas(ctx, { texto: q, desde, hasta, limite });
    res.json(resultado);
  } catch (error) {
    if (error instanceof ErrorConsulta) return res.status(400).json({ error: error.message });
    console.error('Error al buscar paradas:', error);
    res.status(500).json({ error: 'Error al buscar paradas' });
  }
}

module.exports = { vistaPreviaParadas, listarParadas, reemplazarParadas, buscarParadasHandler };
