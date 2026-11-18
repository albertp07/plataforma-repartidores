// Rangos de fecha para el ranking de paradas. Todas las fechas viajan como 'YYYY-MM-DD'.
// El backend compara contra fechas guardadas a mediodía UTC, así que basta con el día calendario.

function pad(n) {
  return String(n).padStart(2, '0');
}

function aIso(fecha) {
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`;
}

// 'DD-MM-YYYY' -> Date local, o null si está incompleta o no existe (ej. 31-02-2026)
export function parsearFechaDDMMYYYY(texto) {
  const m = (texto || '').match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;
  const [, d, mes, y] = m;
  const fecha = new Date(Number(y), Number(mes) - 1, Number(d));
  if (fecha.getFullYear() !== Number(y) || fecha.getMonth() !== Number(mes) - 1 || fecha.getDate() !== Number(d)) {
    return null;
  }
  return fecha;
}

export function hoyDDMMYYYY() {
  const h = new Date();
  return `${pad(h.getDate())}-${pad(h.getMonth() + 1)}-${h.getFullYear()}`;
}

// modo: 'DIA' | 'SEMANA' (lunes a domingo) | 'MES' | 'TODO'
// Devuelve { desde, hasta } (vacío para TODO) o null si la fecha base no es válida.
export function rangoRanking(modo, fechaBase) {
  if (modo === 'TODO') return {};
  const base = parsearFechaDDMMYYYY(fechaBase);
  if (!base) return null;

  if (modo === 'DIA') return { desde: aIso(base), hasta: aIso(base) };

  if (modo === 'SEMANA') {
    const delta = (base.getDay() + 6) % 7; // lunes = 0
    const lunes = new Date(base.getFullYear(), base.getMonth(), base.getDate() - delta);
    const domingo = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6);
    return { desde: aIso(lunes), hasta: aIso(domingo) };
  }

  // MES
  const primero = new Date(base.getFullYear(), base.getMonth(), 1);
  const ultimo = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return { desde: aIso(primero), hasta: aIso(ultimo) };
}
