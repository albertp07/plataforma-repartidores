const { leerComprobanteCombustible } = require('../services/comprobanteCombustibleService');

const PRODUCTOS = ['DIESEL', '93', '95', '97'];

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
  // Number(null) y Number('') dan 0: un dato ausente no debe convertirse en 0
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function decimal(valor, decimales = 3) {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? Number(n.toFixed(decimales)) : null;
}

const pesos = (n) => `$${Number(n).toLocaleString('es-CL')}`;

// Analiza el comprobante y devuelve un BORRADOR. No guarda nada en la base de datos.
async function analizarComprobanteCombustible(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Adjunta una imagen (JPG, PNG o WebP)' });
    }
    if (excedeLimite(req.usuario.id)) {
      return res.status(429).json({ error: 'Alcanzaste el límite de análisis por hora. Intenta más tarde.' });
    }

    const lectura = await leerComprobanteCombustible(req.file.buffer, req.file.mimetype);

    if (!lectura.esComprobante) {
      return res.status(422).json({ error: 'La imagen no parece ser un comprobante de compra de combustible.' });
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

    const producto = PRODUCTOS.includes(String(lectura.producto)) ? String(lectura.producto) : null;
    if (!producto) advertencias.push('No se pudo leer el tipo de combustible: selecciónalo manualmente.');

    const litros = decimal(lectura.litros);
    const precioLitro = entero(lectura.precioLitro);
    const subtotal = entero(lectura.subtotal);
    // Los descuentos siempre se tratan como positivos, sin importar el signo con que se lean
    const descuentoCupon = lectura.descuentoCupon == null ? 0 : Math.abs(entero(lectura.descuentoCupon) || 0);
    const descuentoPromocion = lectura.descuentoPromocion == null ? 0 : Math.abs(entero(lectura.descuentoPromocion) || 0);
    const totalLeido = entero(lectura.total);

    if (subtotal == null) advertencias.push('No se pudo leer el subtotal: ingrésalo manualmente.');
    if (litros == null) advertencias.push('No se pudo leer la cantidad de litros.');
    if (precioLitro == null) advertencias.push('No se pudo leer el precio por litro.');

    // Cruce 1: total = subtotal - descuentos (regla de negocio: nunca negativo)
    if (subtotal != null) {
      const totalCalculado = Math.max(subtotal - descuentoCupon - descuentoPromocion, 0);
      if (totalLeido != null && Math.abs(totalCalculado - totalLeido) > 1) {
        advertencias.push(`El total recalculado (${pesos(totalCalculado)}) no coincide con el de la foto (${pesos(totalLeido)}). Revisa los descuentos.`);
      }
    }

    // Cruce 2: litros x precio ≈ subtotal (el surtidor redondea, se tolera 1%)
    if (subtotal != null && litros != null && precioLitro != null) {
      const esperado = litros * precioLitro;
      if (Math.abs(esperado - subtotal) > Math.max(subtotal * 0.01, 5)) {
        advertencias.push(`Litros × precio (${pesos(Math.round(esperado))}) no coincide con el subtotal (${pesos(subtotal)}). Revisa litros y precio.`);
      }
    }

    res.json({
      borrador: { fecha, producto, litros, precioLitro, subtotal, descuentoCupon, descuentoPromocion },
      referencia: { total: totalLeido },
      advertencias,
    });
  } catch (error) {
    console.error('Error al analizar comprobante de combustible:', error?.status, error?.message || error);
    const status = error.status;
    let mensaje = 'No se pudo leer la imagen. Intenta con una captura más nítida.';
    let http = 500;
    if (status === 503) { mensaje = error.message; http = 503; }
    else if (status === 401 || status === 403) mensaje = 'La API key de Anthropic es inválida o fue revocada. Revisa ANTHROPIC_API_KEY en backend/.env y reinicia el backend.';
    else if (status === 404) mensaje = `El modelo de IA no está disponible para tu cuenta (${process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5'}).`;
    else if (status === 400 && /credit balance/i.test(error.message || '')) mensaje = 'Tu cuenta de Anthropic no tiene saldo. Agrega créditos en console.anthropic.com.';
    else if (status === 400) mensaje = 'La API rechazó la solicitud. Revisa la terminal del backend para ver el detalle.';
    else if (status === 429) mensaje = 'Límite de uso de la API alcanzado. Intenta en unos minutos.';
    else if (!status) mensaje = 'No se pudo conectar con el servicio de lectura. Revisa tu conexión a internet.';
    res.status(http).json({ error: mensaje });
  }
}

module.exports = { analizarComprobanteCombustible };
