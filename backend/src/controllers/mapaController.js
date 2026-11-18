const prisma = require('../config/prisma');
const { ErrorConsulta } = require('../services/consultaFinancieraService');
const { obtenerMapaCalor, obtenerRankingParadas } = require('../services/mapaService');

// ADMIN ve todas las rutas; un repartidor solo las suyas.
// Devuelve el contexto de consulta, o null si el repartidor no tiene perfil (ya respondió 404).
async function resolverContexto(req, res) {
  const ctx = { repartidorId: null };
  if (req.usuario.rol !== 'ADMIN') {
    const repartidor = await prisma.repartidor.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!repartidor) {
      res.status(404).json({ error: 'No tienes un perfil de repartidor creado' });
      return null;
    }
    ctx.repartidorId = repartidor.id;
  }
  return ctx;
}

// GET /mapa/calor?desde=2026-11-01&hasta=2026-11-30&turno=TODOS|AM|PM
async function mapaCalorHandler(req, res) {
  try {
    const ctx = await resolverContexto(req, res);
    if (!ctx) return;

    const { desde, hasta, turno } = req.query;
    res.json(await obtenerMapaCalor(ctx, { desde, hasta, turno }));
  } catch (error) {
    if (error instanceof ErrorConsulta) return res.status(400).json({ error: error.message });
    console.error('Error al generar el mapa de calor:', error);
    res.status(500).json({ error: 'Error al generar el mapa de calor' });
  }
}

// GET /mapa/ranking?desde=2026-11-01&hasta=2026-11-30&turno=TODOS|AM|PM&limite=10
async function rankingParadasHandler(req, res) {
  try {
    const ctx = await resolverContexto(req, res);
    if (!ctx) return;

    const { desde, hasta, turno, limite } = req.query;
    res.json(await obtenerRankingParadas(ctx, { desde, hasta, turno, limite }));
  } catch (error) {
    if (error instanceof ErrorConsulta) return res.status(400).json({ error: error.message });
    console.error('Error al generar el ranking de paradas:', error);
    res.status(500).json({ error: 'Error al generar el ranking de paradas' });
  }
}

module.exports = { mapaCalorHandler, rankingParadasHandler };
