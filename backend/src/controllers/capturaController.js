const { leerCapturaDia } = require('../services/capturaService');

const VALOR_PAQUETE_DEFAULT = 1500;

// Rate limit simple en memoria: máximo 40 análisis por usuario cada hora
const VENTANA_MS = 60 * 60 * 1000;
const MAX_POR_VENTANA = 40;
const usos = new Map();

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

function entero(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n) : null;
}

// Analiza la captura y devuelve un BORRADOR. No guarda nada en la base de datos.
async function analizarCaptura(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Adjunta una imagen (JPG, PNG o WebP)' });
    }
    if (excedeLimite(req.usuario.id)) {
      return res.status(429).json({ error: 'Alcanzaste el límite de análisis por hora. Intenta más tarde.' });
    }

    const lectura = await leerCapturaDia(req.file.buffer, req.file.mimetype);

    if (!lectura.esDetalleDia) {
      return res.status(422).json({ error: 'La imagen no parece ser el detalle de un día. Sube la pantalla con la fecha y el "Total a cobrar del día".' });
    }

    const advertencias = [...(lectura.advertencias || [])];

    // Fecha
    let fecha = null;
    if (typeof lectura.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(lectura.fecha)) {
      const d = new Date(`${lectura.fecha}T12:00:00.000Z`);
      if (!Number.isNaN(d.getTime())) fecha = lectura.fecha;
    }
    if (!fecha) advertencias.push('No se pudo leer la fecha: ingrésala manualmente.');
    else if (fecha > new Date().toISOString().slice(0, 10)) {
      advertencias.push('La fecha leída es futura: revísala.');
    }

    const retiros = (lectura.retiros || []).map((r) => ({
      cliente: String(r.cliente || '').trim(),
      hora: r.hora || null,
      monto: entero(r.monto),
    })).filter((r) => r.cliente);

    const sobredimensionados = (lectura.sobredimensionados || []).map((s) => ({
      tracking: s.tracking ? String(s.tracking).replace(/^#/, '') : null,
      talla: s.talla || null,
      monto: entero(s.monto),
    }));

    const entregasExitosas = entero(lectura.entregasExitosas);
    if (entregasExitosas == null) advertencias.push('No se pudo leer la cantidad de entregas: ingrésala manualmente.');

    // Valor por paquete inferido: netoEntregas = (exitosas + sobredimensionados) × valor
    let valorPaquete = VALOR_PAQUETE_DEFAULT;
    const netoEntregas = entero(lectura.netoEntregas);
    if (entregasExitosas != null && netoEntregas != null) {
      const unidades = entregasExitosas + sobredimensionados.length;
      if (unidades > 0 && netoEntregas % unidades === 0) {
        valorPaquete = netoEntregas / unidades;
      } else {
        advertencias.push('El neto de entregas de la foto no cuadra con la cantidad de entregas: revisa los datos.');
      }
    }

    // Cruce del total: neto + IVA 19% vs lo que muestra la foto
    const totalLeido = entero(lectura.totalACobrar);
    const netoLeido = entero(lectura.neto);
    const sumaRetiros = retiros.reduce((s, r) => s + (r.monto || 0), 0);
    if (entregasExitosas != null) {
      const liquido = (entregasExitosas + sobredimensionados.length) * valorPaquete + sumaRetiros;
      const total = liquido + Math.round(liquido * 0.19);
      if (totalLeido != null && Math.abs(total - totalLeido) > 1) {
        advertencias.push(`El total recalculado ($${total.toLocaleString('es-CL')}) no coincide con el de la foto ($${totalLeido.toLocaleString('es-CL')}). Revisa retiros y sobredimensionados.`);
      }
    }

    res.json({
      borrador: {
        fecha,
        entregasExitosas,
        sobredimensionados,
        retiros,
        valorPaquete,
      },
      referencia: { totalACobrar: totalLeido, neto: netoLeido, netoEntregas, netoRetiros: entero(lectura.netoRetiros) },
      advertencias,
    });
  } catch (error) {
    console.error('Error al analizar captura:', error?.status, error?.message || error, error?.cause || '');
    const status = error.status;
    let mensaje = 'No se pudo leer la imagen. Intenta con una captura más nítida.';
    let http = 500;
    if (status === 503) { mensaje = error.message; http = 503; }
    else if (status === 401 || status === 403) mensaje = 'La API key de Anthropic es inválida o fue revocada. Revisa ANTHROPIC_API_KEY en backend/.env y reinicia el backend.';
    else if (status === 404) mensaje = `El modelo de IA no está disponible para tu cuenta (${process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5'}).`;
    else if (status === 400 && /credit balance/i.test(error.message || '')) mensaje = 'Tu cuenta de Anthropic no tiene saldo. Agrega créditos en console.anthropic.com.';
    else if (status === 400) mensaje = 'La API rechazó la solicitud. Revisa la terminal del backend para ver el detalle.';
    else if (status === 429) mensaje = 'Límite de uso de la API alcanzado. Intenta en unos minutos.';
    else if (!status) mensaje = 'No se pudo conectar con el servicio de lectura. Revisa tu conexión a internet.';
    res.status(http).json({ error: mensaje });
  }
}

module.exports = { analizarCaptura };
