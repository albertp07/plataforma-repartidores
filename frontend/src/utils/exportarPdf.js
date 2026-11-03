import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatearFecha, formatearFechaLocal, formatearDiaMes, formatearFechaHoraLocal } from './fechas';

const COLOR_INGRESO = [22, 163, 74];
const COLOR_GASTO = [220, 70, 55];
const COLOR_AMBAR = [217, 119, 6];
const COLOR_TEXTO = [30, 36, 41];
const COLOR_MUTED = [110, 122, 130];
const COLOR_GRILLA = [220, 224, 228];

function peso(valor) {
  return `$${Math.round(Number(valor) || 0).toLocaleString('es-CL')}`;
}

// Las fechas se guardan a mediodía UTC; formatearFecha las lee en UTC (DD-MM-YYYY)
function fechaCorta(valor) {
  return formatearFecha(valor);
}

function fechaCortaSinAnio(iso) {
  return formatearDiaMes(iso);
}

function textoDescripcion(m) {
  if (m.sinActividad) {
    const base = m.descripcion || 'Sin actividad';
    return m.observaciones ? `${base}: ${m.observaciones}` : base;
  }
  if (m.categoriaIngreso !== 'PAQUETES' || m.cantidadPaquetes == null) return m.descripcion || '-';
  const partes = [`${m.cantidadPaquetes} entregadas`];
  if (m.paquetesSobredimensionados) partes.push(`${m.paquetesSobredimensionados} S/D`);
  if (m.paquetesFallidos) partes.push(`${m.paquetesFallidos} fallidas`);
  const total = m.paquetesTotalSalida ?? (m.cantidadPaquetes + (m.paquetesFallidos || 0));
  return `Reparto: ${partes.join(' / ')} de ${total} totales`;
}

function textoTipo(m) {
  if (m.sinActividad) return m.categoriaIngreso === 'RETIROS' ? 'Sin retiro' : 'Sin reparto';
  return m.tipo === 'INGRESO' ? 'Ingreso' : 'Gasto';
}

// Gráfico de líneas dibujado directamente con jsPDF (nítido, vectorial y apto para imprimir)
function dibujarGrafico(doc, datos, x, y, ancho, alto) {
  const margenIzq = 52;
  const margenInf = 22;
  const margenSup = 8;
  const margenDer = 10;
  const gx = x + margenIzq;
  const gy = y + margenSup;
  const gw = ancho - margenIzq - margenDer;
  const gh = alto - margenSup - margenInf;

  doc.setDrawColor(...COLOR_GRILLA);
  doc.setLineWidth(0.3);
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_MUTED);

  if (datos.length === 0) {
    doc.text('Sin datos en el período.', gx + gw / 2, gy + gh / 2, { align: 'center' });
    return;
  }

  const maxValor = Math.max(1, ...datos.map((d) => Math.max(d.ingresos, d.gastos)));
  const paso = Math.pow(10, Math.floor(Math.log10(maxValor)));
  let techo = Math.ceil(maxValor / paso) * paso;
  if (techo / paso < 3) techo = Math.ceil(maxValor / (paso / 2)) * (paso / 2);
  const divisiones = 5;

  for (let i = 0; i <= divisiones; i++) {
    const valor = (techo / divisiones) * i;
    const py = gy + gh - (valor / techo) * gh;
    doc.line(gx, py, gx + gw, py);
    doc.text(peso(valor), gx - 2, py + 1, { align: 'right' });
  }

  const px = (i) => (datos.length === 1 ? gx + gw / 2 : gx + (i / (datos.length - 1)) * gw);
  const py = (v) => gy + gh - (v / techo) * gh;

  // Etiquetas del eje X (máximo ~10 para que no se pisen)
  const cadaN = Math.max(1, Math.ceil(datos.length / 10));
  datos.forEach((d, i) => {
    if (i % cadaN !== 0 && i !== datos.length - 1) return;
    doc.text(fechaCortaSinAnio(d.fecha), px(i), gy + gh + 6, { align: 'center' });
  });

  function serie(clave, color) {
    doc.setDrawColor(...color);
    doc.setFillColor(...color);
    doc.setLineWidth(0.7);
    for (let i = 1; i < datos.length; i++) {
      doc.line(px(i - 1), py(datos[i - 1][clave]), px(i), py(datos[i][clave]));
    }
    if (datos.length <= 31) {
      datos.forEach((d, i) => doc.circle(px(i), py(d[clave]), 0.9, 'F'));
    }
  }
  serie('ingresos', COLOR_INGRESO);
  serie('gastos', COLOR_GASTO);

  // Leyenda
  const ly = gy + gh + 15;
  doc.setLineWidth(0.7);
  doc.setDrawColor(...COLOR_INGRESO);
  doc.line(gx + gw / 2 - 28, ly, gx + gw / 2 - 20, ly);
  doc.setTextColor(...COLOR_TEXTO);
  doc.text('Ingresos', gx + gw / 2 - 18, ly + 1);
  doc.setDrawColor(...COLOR_GASTO);
  doc.line(gx + gw / 2 + 4, ly, gx + gw / 2 + 12, ly);
  doc.text('Gastos', gx + gw / 2 + 14, ly + 1);
}

/**
 * Genera y descarga un PDF con el resumen, el gráfico de ingresos/gastos en el tiempo
 * y el detalle de todos los movimientos del período filtrado.
 */
export function exportarDashboardPdf({
  movimientos,
  porFecha,
  totalIngresos,
  totalGastos,
  etiquetaPeriodo,
  generadoPor,
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const anchoPagina = doc.internal.pageSize.getWidth();
  const margen = 14;

  // Encabezado
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLOR_TEXTO);
  doc.text('Reporte de ingresos y gastos', margen, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(`Período: ${etiquetaPeriodo}`, margen, 25);
  const generado = formatearFechaHoraLocal(new Date());
  doc.text(
    `Generado el ${generado}${generadoPor ? ` por ${generadoPor}` : ''}`,
    margen,
    30,
  );

  // Tarjetas de resumen
  const balance = totalIngresos - totalGastos;
  const tarjetas = [
    { titulo: 'Ingresos totales', valor: peso(totalIngresos), color: COLOR_INGRESO },
    { titulo: 'Gastos totales', valor: peso(totalGastos), color: COLOR_GASTO },
    { titulo: 'Balance', valor: peso(balance), color: COLOR_AMBAR },
  ];
  const anchoTarjeta = (anchoPagina - margen * 2 - 8 * 2) / 3;
  tarjetas.forEach((t, i) => {
    const tx = margen + i * (anchoTarjeta + 8);
    doc.setDrawColor(...COLOR_GRILLA);
    doc.setFillColor(248, 249, 250);
    doc.roundedRect(tx, 36, anchoTarjeta, 18, 2, 2, 'FD');
    doc.setFillColor(...t.color);
    doc.rect(tx, 36, 1.5, 18, 'F');
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(t.titulo, tx + 5, 43);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...COLOR_TEXTO);
    doc.text(t.valor, tx + 5, 50);
    doc.setFont('helvetica', 'normal');
  });

  // Gráfico
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLOR_TEXTO);
  doc.text('Ingresos y gastos en el tiempo', margen, 63);
  doc.setFont('helvetica', 'normal');
  dibujarGrafico(doc, porFecha, margen, 66, anchoPagina - margen * 2, 105);

  // Detalle de movimientos (en página nueva)
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLOR_TEXTO);
  doc.text(`Detalle de movimientos (${movimientos.length})`, margen, 16);

  const ordenados = [...movimientos].sort((a, b) => {
    const dif = new Date(a.fecha) - new Date(b.fecha);
    if (dif !== 0) return dif;
    return (a.tipo === 'GASTO' ? 0 : 1) - (b.tipo === 'GASTO' ? 0 : 1);
  });

  const filas = ordenados.map((m) => {
    const esIngreso = m.tipo === 'INGRESO';
    return [
      fechaCorta(m.fecha),
      m.repartidor?.usuario?.nombre || '-',
      textoTipo(m),
      m.turno || '-',
      textoDescripcion(m),
      esIngreso && m.montoLiquido != null ? peso(m.montoLiquido) : '-',
      esIngreso && m.montoIva != null ? peso(m.montoIva) : '-',
      `${esIngreso ? '' : '-'}${peso(m.monto)}`,
    ];
  });

  autoTable(doc, {
    startY: 20,
    margin: { left: margen, right: margen },
    head: [['Fecha', 'Repartidor', 'Tipo', 'Turno', 'Descripción', 'Líquido', 'IVA (19%)', 'Monto']],
    body: filas,
    foot: [[
      { content: 'Totales', colSpan: 5, styles: { halign: 'right' } },
      { content: '', colSpan: 2 },
      { content: `Balance ${peso(balance)}`, styles: { halign: 'right' } },
    ]],
    styles: { fontSize: 8, cellPadding: 1.8, textColor: COLOR_TEXTO },
    headStyles: { fillColor: [38, 50, 56], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [238, 241, 243], textColor: COLOR_TEXTO, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    columnStyles: {
      4: { cellWidth: 80 },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 2) {
        const t = data.cell.raw;
        if (t === 'Ingreso') data.cell.styles.textColor = COLOR_INGRESO;
        else if (t === 'Gasto') data.cell.styles.textColor = COLOR_GASTO;
      }
      if (data.section === 'body' && data.column.index === 7) {
        data.cell.styles.textColor = String(data.cell.raw).startsWith('-') ? COLOR_GASTO : COLOR_INGRESO;
      }
    },
  });

  // Número de página
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(
      `Página ${i} de ${total}`,
      anchoPagina - margen,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'right' },
    );
  }

  const hoy = formatearFechaLocal(new Date());
  doc.save(`reporte-ingresos-gastos-${hoy}.pdf`);
}
