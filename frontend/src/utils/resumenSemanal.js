// Resumen de ingresos de una semana (Repartos + Retiros).
// Funciona sobre la lista de transacciones ya cargada en el frontend: no necesita endpoint propio.
//
// Los montos se SUMAN desde lo ya guardado en cada registro (montoLiquido, montoIva, monto),
// así el resumen siempre coincide con lo que se ve en el historial.

const IVA = 0.19;

export function formatoPeso(valor) {
  return Math.round(Number(valor) || 0).toLocaleString('es-CL');
}

// Registros antiguos pueden no traer montoLiquido/montoIva: se derivan desde el bruto.
function desglose(t) {
  const bruto = Number(t.monto) || 0;
  const neto = t.montoLiquido != null ? Number(t.montoLiquido) : bruto / (1 + IVA);
  const iva = t.montoIva != null ? Number(t.montoIva) : bruto - neto;
  return { neto, iva, bruto };
}

function bloqueVacio() {
  return { neto: 0, iva: 0, bruto: 0 };
}

export function calcularResumenSemanal(transacciones) {
  const repartos = { ...bloqueVacio(), entregados: 0, sobredimensionados: 0, fallidos: 0 };
  const retiros = { ...bloqueVacio(), cantidad: 0, porTarifa: [] };
  const tarifas = new Map(); // valor unitario -> { valor, cantidad, neto }

  for (const t of transacciones) {
    if (t.tipo !== 'INGRESO' || t.sinActividad) continue;
    const { neto, iva, bruto } = desglose(t);

    if (t.categoriaIngreso === 'PAQUETES') {
      repartos.neto += neto;
      repartos.iva += iva;
      repartos.bruto += bruto;
      repartos.entregados += t.cantidadPaquetes || 0;
      repartos.sobredimensionados += t.paquetesSobredimensionados || 0;
      repartos.fallidos += t.paquetesFallidos || 0;
    } else if (t.categoriaIngreso === 'RETIROS') {
      const cantidad = t.cantidadPaquetes || 0;
      retiros.neto += neto;
      retiros.iva += iva;
      retiros.bruto += bruto;
      retiros.cantidad += cantidad;

      // Agrupa por tarifa (1.500 / 3.000 ...). Los registros nuevos traen cada retiro en detallesRetiro;
      // los antiguos tienen un solo valor unitario en valorPaquete.
      const sumar = (valor, cant, netoParcial) => {
        const actual = tarifas.get(valor) || { valor, cantidad: 0, neto: 0 };
        actual.cantidad += cant;
        actual.neto += netoParcial;
        tarifas.set(valor, actual);
      };

      if (t.detallesRetiro?.length > 0) {
        for (const d of t.detallesRetiro) {
          const precio = Number(d.precio) || 0;
          sumar(precio, 1, precio);
        }
      } else {
        sumar(Number(t.valorPaquete) || 0, cantidad, neto);
      }
    }
  }

  retiros.porTarifa = [...tarifas.values()].sort((a, b) => a.valor - b.valor);

  return {
    repartos,
    retiros,
    total: {
      neto: repartos.neto + retiros.neto,
      iva: repartos.iva + retiros.iva,
      bruto: repartos.bruto + retiros.bruto,
    },
  };
}
