// Lee el PDF de ruta que exporta Circuit (Spoke) y devuelve un borrador de paradas.
// Solo extrae: dirección, hora de llegada real (HH:mm) y notas. No guarda nada.

const MAX_PAGINAS = 30;
const UMBRAL_ATRASO_DUDOSO_MIN = 180; // más de 3 h de diferencia = parada marcada otro día / fuera de orden

let pdfjs = null;
async function cargarPdfjs() {
  // pdfjs-dist es ESM: se importa dinámicamente desde este módulo CommonJS
  if (!pdfjs) pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjs;
}

class ErrorPdf extends Error {}

// ---------- Utilidades de texto ----------

function quitarTildes(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Clave para buscar: minúsculas, sin tildes, "avenida/avenue/av." -> "av", sin signos
function normalizarDireccion(texto) {
  return quitarTildes(texto)
    .toLowerCase()
    .replace(/\b(avenida|avenue|av)\b\.?/g, 'av')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PARTES_A_DESCARTAR = /^(macul|santiago|region metropolitana|chile|\d{7})$/i;

// "Juan Mitjans 105, Macul, Macul, 7810160" -> "Juan Mitjans 105"
// "Macul Avenue 2701, Avenida Macul, Santiago, 7810656" -> "Avenida Macul 2701"
// "Avenida Doctor Amador Neghme Rodríguez, 3918, Macul, Macul, 7830417" -> "Avenida Doctor Amador Neghme Rodríguez 3918"
function limpiarDireccion(bruta) {
  const partes = String(bruta || '').split(',').map((p) => p.trim()).filter(Boolean);
  const utiles = [];
  for (const parte of partes) {
    if (PARTES_A_DESCARTAR.test(quitarTildes(parte))) break; // desde aquí viene comuna/ciudad/código postal
    utiles.push(parte);
  }
  if (utiles.length === 0) return partes[0] || '';

  let [principal, ...resto] = utiles;
  // Número de calle separado por coma: "Calle X, 3918"
  const numero = resto.find((p) => /^\d{1,5}$/.test(p));
  const extras = resto.filter((p) => p !== numero && /\d/.test(p)); // ej. "depto 12"
  if (numero && !/\d/.test(principal)) principal = `${principal} ${numero}`;

  // Spoke a veces traduce "Avenida Macul 2701" como "Macul Avenue 2701"
  const m = principal.match(/^(.+?)\s+Avenue\s+(\d+.*)$/i);
  if (m) principal = `Avenida ${m[1]} ${m[2]}`;

  return [principal, ...extras].join(', ').replace(/\s+/g, ' ').trim();
}

// Cantidad de paquetes sugerida desde las notas: números sueltos fuera de paréntesis
// "23 BB M □ y 27 □Verde P (G) (Quillin 139 y 123)" -> 2
function sugerirCantidadPaquetes(notas) {
  const sinParentesis = String(notas || '').replace(/\([^)]*\)/g, ' ');
  const numeros = new Set(sinParentesis.match(/(?<![\w.])\d{1,3}(?![\w])/g) || []);
  return Math.min(Math.max(numeros.size, 1), 20);
}

// ---------- Lectura de la tabla ----------

function aMinutos(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// "17:31 (7 min tarde)" / "16:26 (21 h 20 min tard e)" -> { hora, atrasoMin }
function interpretarLlegada(texto) {
  const limpio = String(texto || '').replace(/\s+/g, ' ').trim();
  const h = limpio.match(/^(\d{1,2}):(\d{2})/);
  if (!h) return { hora: null, atrasoMin: null };
  const hora = `${h[1].padStart(2, '0')}:${h[2]}`;

  const a = limpio.match(/(?:(\d+)\s*h\s*)?(\d+)\s*min\s*(tard|antes)/i);
  let atrasoMin = null;
  if (a) {
    atrasoMin = (Number(a[1] || 0) * 60 + Number(a[2])) * (/antes/i.test(a[3]) ? -1 : 1);
  }
  return { hora, atrasoMin };
}

function hallarColumnas(items) {
  // Encabezados de la tabla: "#", "Address", "Estimated Arrival Time", "Actual Arrival Time", "Notes"
  const buscar = (re) => items.find((it) => re.test(it.texto));
  const numero = buscar(/^#$/);
  const address = buscar(/^address$/i);
  const estimated = buscar(/^estimated/i);
  const actual = buscar(/^actual/i);
  const notes = buscar(/^notes$/i);
  if (!numero || !address || !estimated || !actual || !notes) return null;
  return {
    xNumeroMax: numero.x + 15,
    xAddress: numero.x + 15,
    xEstimada: estimated.x - 12,
    xActual: actual.x - 12,
    // La hora real (con "xx min tarde") termina antes de que empiecen las notas
    xNotas: actual.x + (notes.x - actual.x) * 0.56,
    yEncabezado: Math.max(address.y, actual.y, notes.y, estimated.y),
  };
}

function leerPagina(items) {
  const cols = hallarColumnas(items);
  if (!cols) return [];

  // Solo lo que está debajo del encabezado (en pdfjs, y crece hacia arriba)
  const cuerpo = items.filter((it) => it.y < cols.yEncabezado - 4);

  // Filas = números "#" de la primera columna
  const filas = cuerpo
    .filter((it) => it.x < cols.xNumeroMax && /^\d{1,3}$/.test(it.texto))
    .sort((a, b) => b.y - a.y)
    .map((it) => ({ numero: Number(it.texto), y: it.y, items: [] }));
  if (filas.length === 0) return [];

  const separaciones = filas.slice(1).map((f, i) => filas[i].y - f.y).sort((a, b) => a - b);
  const paso = separaciones.length ? separaciones[Math.floor(separaciones.length / 2)] : 30;
  const maxDistancia = paso * 0.7; // ítems más lejos no pertenecen a ninguna parada (ej. fila "Punto de llegada")

  // Cada ítem va a la fila cuyo número está más cerca verticalmente (las celdas están centradas)
  for (const it of cuerpo) {
    if (it.x < cols.xNumeroMax) continue;
    let mejor = null;
    let dist = Infinity;
    for (const f of filas) {
      const d = Math.abs(f.y - it.y);
      if (d < dist) { dist = d; mejor = f; }
    }
    if (mejor && dist <= maxDistancia) mejor.items.push(it);
  }

  return filas.map((f) => {
    const columna = (desde, hasta) => unirTextos(f.items.filter((it) => it.x >= desde && it.x < hasta));
    return {
      numero: f.numero,
      direccion: columna(cols.xAddress, cols.xEstimada),
      estimada: columna(cols.xEstimada, cols.xActual),
      actual: columna(cols.xActual, cols.xNotas),
      notas: columna(cols.xNotas, Infinity),
    };
  });
}

// pdfjs parte el texto en trozos (p. ej. "Fern" + "á" + "ndez"): se pegan si no hay espacio real entre ellos
function unirTextos(items) {
  const lineas = [];
  for (const it of items.slice().sort((a, b) => b.y - a.y)) {
    const linea = lineas.find((l) => Math.abs(l.y - it.y) <= 3);
    if (linea) linea.items.push(it);
    else lineas.push({ y: it.y, items: [it] });
  }
  return lineas
    .sort((a, b) => b.y - a.y)
    .map((l) => {
      let texto = '';
      let finPrevio = null;
      for (const it of l.items.sort((a, b) => a.x - b.x)) {
        if (finPrevio != null && it.x - finPrevio > 1.2) texto += ' ';
        texto += it.texto;
        finPrevio = it.x + it.ancho;
      }
      return texto;
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fechaDelTitulo(texto) {
  const m = String(texto || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  const anio = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${anio}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

async function leerParadasDePdf(buffer) {
  const lib = await cargarPdfjs();
  let doc;
  try {
    doc = await lib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      isEvalSupported: false,
      verbosity: 0,
    }).promise;
  } catch {
    throw new ErrorPdf('No se pudo abrir el PDF. Verifica que sea el archivo exportado desde Circuit.');
  }

  if (doc.numPages > MAX_PAGINAS) throw new ErrorPdf('El PDF tiene demasiadas páginas.');

  const filas = [];
  let titulo = '';
  for (let n = 1; n <= doc.numPages; n += 1) {
    const pagina = await doc.getPage(n);
    const contenido = await pagina.getTextContent();
    const items = contenido.items
      .filter((it) => typeof it.str === 'string' && it.str.trim() !== '')
      .map((it) => ({ texto: it.str.trim(), x: it.transform[4], y: it.transform[5], ancho: it.width || 0 }));
    if (n === 1) {
      const primero = items.slice().sort((a, b) => b.y - a.y || a.x - b.x).slice(0, 6).map((i) => i.texto).join(' ');
      titulo = primero;
    }
    filas.push(...leerPagina(items));
  }
  await doc.destroy();

  if (filas.length === 0) {
    throw new ErrorPdf('No se encontraron paradas. Sube el PDF de la ruta exportado desde Circuit.');
  }

  const advertencias = [];
  let dudosas = 0;
  let conEmoji = 0;

  const paradas = filas
    .sort((a, b) => a.numero - b.numero)
    .map((f, i) => {
      const { hora, atrasoMin } = interpretarLlegada(f.actual);
      const estimada = interpretarLlegada(f.estimada).hora;
      // Hora real fuera de rango (parada marcada al día siguiente o fuera de orden): no es confiable
      const dudosa = hora != null && atrasoMin != null && Math.abs(atrasoMin) > UMBRAL_ATRASO_DUDOSO_MIN;
      if (dudosa) dudosas += 1;
      const notas = f.notas.replace(/\uFFFD+/g, '[emoji]');
      if (notas !== f.notas) conEmoji += 1;
      return {
        orden: i + 1,
        direccion: limpiarDireccion(f.direccion),
        hora: dudosa ? null : hora,
        horaEstimada: estimada,
        horaDudosa: dudosa,
        notas,
        cantidadPaquetes: sugerirCantidadPaquetes(notas),
        paquetesFallidos: 0,
      };
    })
    .filter((p) => p.direccion);

  if (dudosas > 0) {
    advertencias.push(`${dudosas} parada(s) tienen una hora real poco confiable (marcadas otro día o fuera de orden). Complétalas o déjalas sin hora.`);
  }

  if (conEmoji > 0) {
    advertencias.push(`${conEmoji} nota(s) tenían emojis que el PDF no permite leer: quedaron como [emoji]. Puedes corregirlas.`);
  }

  return { fechaPdf: fechaDelTitulo(titulo), paradas, advertencias };
}

module.exports = { leerParadasDePdf, normalizarDireccion, limpiarDireccion, sugerirCantidadPaquetes, ErrorPdf };
