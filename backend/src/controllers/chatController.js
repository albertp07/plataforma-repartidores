const prisma = require('../config/prisma');
const { responderPregunta } = require('../services/chatService');

// Rate limit simple en memoria: máximo 60 preguntas por usuario cada hora
const VENTANA_MS = 60 * 60 * 1000;
const MAX_POR_VENTANA = 60;
const usos = new Map();

const MAX_MENSAJES = 12; // historial que se reenvía al modelo
const MAX_LARGO = 1000;

function excedeLimite(usuarioId) {
  const ahora = Date.now();
  const recientes = (usos.get(usuarioId) || []).filter((t) => ahora - t < VENTANA_MS);
  if (recientes.length >= MAX_POR_VENTANA) {
    usos.set(usuarioId, recientes);
    return true;
  }
  recientes.push(ahora);
  usos.set(usuarioId, recientes);
  return false;
}

// Solo texto de usuario/asistente, acotado en cantidad y largo. Debe empezar y terminar con el usuario.
function limpiarMensajes(entrada) {
  if (!Array.isArray(entrada)) return [];
  const mensajes = entrada
    .filter((m) => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_LARGO) }))
    .slice(-MAX_MENSAJES);
  while (mensajes.length && mensajes[0].role !== 'user') mensajes.shift();
  return mensajes;
}

async function conversar(req, res) {
  try {
    const mensajes = limpiarMensajes(req.body?.mensajes);
    if (mensajes.length === 0 || mensajes[mensajes.length - 1].role !== 'user') {
      return res.status(400).json({ error: 'Escribe una pregunta' });
    }
    if (excedeLimite(req.usuario.id)) {
      return res.status(429).json({ error: 'Alcanzaste el límite de preguntas por hora. Intenta más tarde.' });
    }

    // El alcance de los datos sale del token, nunca de lo que envíe el cliente o decida el modelo
    const ctx = { repartidorId: null };
    if (req.usuario.rol !== 'ADMIN') {
      const repartidor = await prisma.repartidor.findUnique({ where: { usuarioId: req.usuario.id } });
      if (!repartidor) {
        return res.status(404).json({ error: 'No tienes un perfil de repartidor creado' });
      }
      ctx.repartidorId = repartidor.id;
    }

    const respuesta = await responderPregunta(mensajes, ctx);
    res.json({ respuesta });
  } catch (error) {
    console.error('Error en chat:', error?.status, error?.message || error);
    const status = error.status;
    let mensaje = 'No pude responder en este momento. Intenta de nuevo.';
    let http = 500;
    if (status === 503) { mensaje = error.message; http = 503; }
    else if (status === 401 || status === 403) mensaje = 'La API key de Anthropic es inválida o fue revocada.';
    else if (status === 404) mensaje = 'El modelo de IA no está disponible para tu cuenta.';
    else if (status === 400 && /credit balance/i.test(error.message || '')) mensaje = 'La cuenta de Anthropic no tiene saldo.';
    else if (status === 429) mensaje = 'Límite de uso de la API alcanzado. Intenta en unos minutos.';
    else if (!status) mensaje = 'No se pudo conectar con el asistente. Revisa tu conexión a internet.';
    res.status(http).json({ error: mensaje });
  }
}

module.exports = { conversar };
