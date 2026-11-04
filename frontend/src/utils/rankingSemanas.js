// Agrupa los movimientos por semana (lunes a domingo, hora local) para el ranking del historial.
// Usa la misma definición de semana que el panel (offset 0 = semana actual, 1 = pasada, etc.)
// y los montos guardados en cada registro (ingresos brutos con IVA), igual que el resto de la app.

const DIA_MS = 24 * 60 * 60 * 1000;

function lunesLocal(fecha) {
  const d = new Date(fecha);
  const dia = d.getDay();
  d.setDate(d.getDate() + (dia === 0 ? -6 : 1) - dia);
  d.setHours(0, 0, 0, 0);
  return d;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

export function etiquetaSemana(inicio) {
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 6);
  const fmt = (d) => `${pad(d.getDate())}-${pad(d.getMonth() + 1)}`;
  return `${fmt(inicio)} al ${fmt(fin)}`;
}

export function agruparPorSemana(transacciones) {
  const lunesActual = lunesLocal(new Date());
  const semanas = new Map();

  for (const t of transacciones) {
    const inicio = lunesLocal(t.fecha);
    const clave = inicio.getTime();
    if (!semanas.has(clave)) {
      semanas.set(clave, {
        clave,
        inicio,
        anio: inicio.getFullYear(),
        etiqueta: etiquetaSemana(inicio),
        offset: Math.round((lunesActual - inicio) / (7 * DIA_MS)),
        ingresos: 0,
        gastos: 0,
        entregas: 0,
        retiros: 0,
      });
    }
    const s = semanas.get(clave);
    const monto = Number(t.monto) || 0;

    if (t.tipo === 'INGRESO') {
      s.ingresos += monto;
      if (t.categoriaIngreso === 'PAQUETES') s.entregas += t.cantidadPaquetes || 0;
      if (t.categoriaIngreso === 'RETIROS') s.retiros += t.cantidadPaquetes || 0;
    } else {
      s.gastos += monto;
    }
  }

  return [...semanas.values()].map((s) => ({ ...s, balance: s.ingresos - s.gastos }));
}
