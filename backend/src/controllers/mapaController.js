const prisma = require('../config/prisma');
const { ErrorConsulta } = require('../services/consultaFinancieraService');
const { obtenerMapaCalor } = require('../services/mapaService');

// GET /mapa/calor?desde=2026-11-01&hasta=2026-11-30&turno=TODOS|AM|PM
// ADMIN ve todas las rutas; un repartidor solo las suyas.
async function mapaCalorHandler(req, res) {
  try {
    const ctx = { repartidorId: null };
    if (req.usuario.rol !== 'ADMIN') {
      const repartidor = await prisma.repartidor.findUnique({ where: { usuarioId: req.usuario.id } });
      if (!repartidor) return res.status(404).json({ error: 'No tienes un perfil de repartidor creado' });
      ctx.repartidorId = repartidor.id;
    }

    const { desde, hasta, turno } = req.query;
    res.json(await obtenerMapaCalor(ctx, { desde, hasta, turno }));
  } catch (error) {
    if (error instanceof ErrorConsulta) return res.status(400).json({ error: error.message });
    console.error('Error al generar el mapa de calor:', error);
    res.status(500).json({ error: 'Error al generar el mapa de calor' });
  }
}

module.exports = { mapaCalorHandler };
