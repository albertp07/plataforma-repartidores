// Convierte direcciones de paradas en coordenadas (lat/lng) usando Nominatim (OpenStreetMap).
// - Cachea el resultado en DireccionGeocodificada: cada dirección se consulta una sola vez.
// - Respeta la política de uso de Nominatim: máximo 1 petición por segundo y User-Agent propio.
// - Corre en segundo plano (un solo proceso a la vez) para no bloquear las respuestas HTTP.
const prisma = require('../config/prisma');

const NOMINATIM_URL = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = `AryalRepartidores/1.0 (${process.env.GEOCODER_CONTACT || 'sin-contacto'})`;
const ESPERA_ENTRE_PETICIONES_MS = 1100;
const TIMEOUT_MS = 10000;
const REINTENTO_NO_ENCONTRADA_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

// Caja que rodea a Macul (con margen). Evita que "Av. Macul 2701" resuelva en otra comuna.
const VIEWBOX = { izquierda: -70.64, arriba: -33.46, derecha: -70.54, abajo: -33.53 };

let corriendo = false;

const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Devuelve { lat, lng } o null si no hay resultado. Lanza error si falla la red o el servicio.
async function consultarNominatim(texto) {
  const params = new URLSearchParams({
    q: `${texto}, Macul, Santiago, Chile`,
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'cl',
    viewbox: `${VIEWBOX.izquierda},${VIEWBOX.arriba},${VIEWBOX.derecha},${VIEWBOX.abajo}`,
    bounded: '1',
  });

  const respuesta = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'es' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!respuesta.ok) throw new Error(`Nominatim respondió ${respuesta.status}`);

  const datos = await respuesta.json();
  if (!Array.isArray(datos) || datos.length === 0) return null;

  const lat = Number.parseFloat(datos[0].lat);
  const lng = Number.parseFloat(datos[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

// "Juan Mitjans 105" -> "Juan Mitjans". Si no hay número devuelve el mismo texto.
function soloCalle(direccion) {
  return direccion.replace(/\s+\d{1,5}\b.*$/, '').trim();
}

// Intenta con el número exacto; si no existe en OSM, cae al centro de la calle (aproximada).
async function geocodificarDireccion(direccion) {
  const exacta = await consultarNominatim(direccion);
  if (exacta) return { ...exacta, encontrada: true, aproximada: false };

  const calle = soloCalle(direccion);
  if (calle && calle !== direccion) {
    await dormir(ESPERA_ENTRE_PETICIONES_MS);
    const aproximada = await consultarNominatim(calle);
    if (aproximada) return { ...aproximada, encontrada: true, aproximada: true };
  }
  return { lat: null, lng: null, encontrada: false, aproximada: false };
}

// ¿Esta dirección necesita (re)consultarse? Sin caché, o no encontrada hace más de 7 días.
function necesitaGeocodificar(cache) {
  if (!cache) return true;
  if (cache.encontrada) return false;
  return Date.now() - cache.consultadoEn.getTime() > REINTENTO_NO_ENCONTRADA_MS;
}

async function direccionesPendientes() {
  const paradas = await prisma.parada.findMany({
    distinct: ['direccionNormalizada'],
    select: { direccionNormalizada: true, direccion: true },
  });
  if (paradas.length === 0) return [];

  const cache = await prisma.direccionGeocodificada.findMany({
    select: { direccionNormalizada: true, encontrada: true, consultadoEn: true },
  });
  const porClave = new Map(cache.map((c) => [c.direccionNormalizada, c]));

  return paradas.filter((p) => p.direccionNormalizada && necesitaGeocodificar(porClave.get(p.direccionNormalizada)));
}

async function procesarPendientes() {
  const pendientes = await direccionesPendientes();
  for (const { direccionNormalizada, direccion } of pendientes) {
    let resultado;
    try {
      resultado = await geocodificarDireccion(direccion);
    } catch (error) {
      // Red caída o servicio con límite: se corta y se reintenta en la próxima consulta del mapa.
      console.error('Geocodificación detenida:', error.message);
      return;
    }

    const datos = {
      lat: resultado.lat,
      lng: resultado.lng,
      encontrada: resultado.encontrada,
      aproximada: resultado.aproximada,
      consultadoEn: new Date(),
    };
    await prisma.direccionGeocodificada.upsert({
      where: { direccionNormalizada },
      create: { direccionNormalizada, ...datos },
      update: datos,
    });
    await dormir(ESPERA_ENTRE_PETICIONES_MS);
  }
}

// Dispara la geocodificación en segundo plano. Es seguro llamarla muchas veces: solo corre una a la vez.
function iniciarGeocodificacion() {
  if (corriendo) return;
  corriendo = true;
  procesarPendientes()
    .catch((error) => console.error('Error al geocodificar direcciones:', error))
    .finally(() => {
      corriendo = false;
    });
}

module.exports = { iniciarGeocodificacion, necesitaGeocodificar };
