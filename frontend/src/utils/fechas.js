// Formato único de fechas para toda la app: DD-MM-YYYY
// Las fechas sin hora se guardan a mediodía UTC, por eso se leen en UTC para evitar desfase de día.

function pad(n) {
  return String(n).padStart(2, '0');
}

// 'YYYY-MM-DD' | ISO completo | Date  ->  'DD-MM-YYYY'
export function formatearFecha(valor) {
  if (!valor) return '';
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [y, m, d] = valor.split('-');
    return `${d}-${m}-${y}`;
  }
  const dt = new Date(valor);
  if (Number.isNaN(dt.getTime())) return '';
  return `${pad(dt.getUTCDate())}-${pad(dt.getUTCMonth() + 1)}-${dt.getUTCFullYear()}`;
}

// Para timestamps reales (ej. creadoEn): usa la zona horaria local del navegador
export function formatearFechaLocal(valor) {
  const dt = new Date(valor);
  if (Number.isNaN(dt.getTime())) return '';
  return `${pad(dt.getDate())}-${pad(dt.getMonth() + 1)}-${dt.getFullYear()}`;
}

// Sin año: 'DD-MM'
export function formatearDiaMes(valor) {
  return formatearFecha(valor).slice(0, 5);
}

// Fecha y hora local: 'DD-MM-YYYY HH:mm'
export function formatearFechaHoraLocal(valor) {
  const dt = new Date(valor);
  if (Number.isNaN(dt.getTime())) return '';
  return `${formatearFechaLocal(dt)} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}
