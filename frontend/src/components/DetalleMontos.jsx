import { formatoPeso } from '../utils/resumenSemanal';

// Tooltip con el detalle de una tarjeta de resumen (neto / IVA / bruto).
// Se muestra al pasar el mouse o enfocar/tocar la .stat-card.has-tip que lo contiene.
function DetalleMontos({ filas }) {
  return (
    <div className="stat-tip" role="tooltip">
      {filas.map((f) => (
        <div key={f.label} className={`stat-tip-row ${f.destacado ? 'strong' : ''}`}>
          <span>{f.label}</span>
          <span>${formatoPeso(f.valor)}</span>
        </div>
      ))}
    </div>
  );
}

export default DetalleMontos;
