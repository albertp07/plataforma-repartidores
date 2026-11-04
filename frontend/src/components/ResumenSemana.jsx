import { calcularResumenSemanal, formatoPeso } from '../utils/resumenSemanal';
import '../styles/resumen-semana.css';

// Resumen de ingresos de la semana que se está viendo en el historial.
// Recibe solo las transacciones de esa semana.
function ResumenSemana({ transacciones }) {
  const { repartos, retiros, total } = calcularResumenSemanal(transacciones);
  const variasTarifas = retiros.porTarifa.length > 1;

  return (
    <section className="rs" aria-label="Resumen de ingresos de la semana">
      {/* Acumulado semanal: ambos montos juntos, como en la app */}
      <div className="rs-acum">
        <div className="rs-acum-head">
          <span className="rs-acum-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 12V8a2 2 0 0 0-2-2H5a2 2 0 0 1 0-4h12" />
              <path d="M3 5v14a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-4" />
              <path d="M16 13h6v4h-6a2 2 0 0 1 0-4z" />
            </svg>
          </span>
          <div>
            <p className="rs-acum-title">Acumulado semanal</p>
            <p className="rs-acum-sub">Resumen de la semana seleccionada</p>
          </div>
        </div>

        <div className="rs-acum-row"><span>Entregas</span><strong>{repartos.entregados}</strong></div>
        <div className="rs-acum-row">
          <span>Retiros</span>
          <strong>{retiros.cantidad} · ${formatoPeso(retiros.neto)}</strong>
        </div>
        <div className="rs-acum-row">
          <span>Sobredimensionados</span>
          <strong>{repartos.sobredimensionados}</strong>
        </div>
        <div className="rs-acum-row"><span>Neto</span><strong>${formatoPeso(total.neto)}</strong></div>
        <div className="rs-acum-row rs-acum-factura">
          <span>Factura por</span>
          <strong>${formatoPeso(total.bruto)}</strong>
        </div>
      </div>

      {/* Total de la semana */}
      <div className="rs-hero">
        <div>
          <p className="stat-label">Ingresos de la semana</p>
          <p className="rs-hero-value">${formatoPeso(total.bruto)}</p>
        </div>
        <p className="rs-hero-sub">
          Neto ${formatoPeso(total.neto)} + IVA ${formatoPeso(total.iva)}
        </p>
      </div>

      {/* Cantidades */}
      <div className="rs-counts">
        <div className="stat-card neutral">
          <p className="stat-label">Retiros</p>
          <p className="stat-value">{retiros.cantidad}</p>
        </div>
        <div className="stat-card neutral">
          <p className="stat-label">Entregados</p>
          <p className="stat-value">{repartos.entregados}</p>
        </div>
        <div className="stat-card neutral">
          <p className="stat-label">Sobredim.</p>
          <p className="stat-value">{repartos.sobredimensionados}</p>
        </div>
      </div>

      {/* Desglose por tipo */}
      <div className="rs-split">
        <div className="rs-card">
          <h3 className="rs-card-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 8l-9-5-9 5 9 5 9-5z" />
              <path d="M3 8v8l9 5 9-5V8" />
              <path d="M12 13v8" />
            </svg>
            Repartos
          </h3>
          <div className="rs-row"><span>Neto</span><span>${formatoPeso(repartos.neto)}</span></div>
          <div className="rs-row"><span>IVA (19%)</span><span>${formatoPeso(repartos.iva)}</span></div>
          <div className="rs-row rs-row-total"><span>Bruto</span><span>${formatoPeso(repartos.bruto)}</span></div>
        </div>

        <div className="rs-card">
          <h3 className="rs-card-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v12" />
              <path d="M7 10l5 5 5-5" />
              <path d="M4 20h16" />
            </svg>
            Retiros
          </h3>
          <div className="rs-row"><span>Neto</span><span>${formatoPeso(retiros.neto)}</span></div>
          <div className="rs-row"><span>IVA (19%)</span><span>${formatoPeso(retiros.iva)}</span></div>
          <div className="rs-row rs-row-total"><span>Bruto</span><span>${formatoPeso(retiros.bruto)}</span></div>

          {/* Aparece solo cuando en la semana hubo retiros con distinto valor */}
          {variasTarifas && (
            <div className="rs-tarifas">
              {retiros.porTarifa.map((t) => (
                <div className="rs-row" key={t.valor}>
                  <span>{t.cantidad} × ${formatoPeso(t.valor)}</span>
                  <span>${formatoPeso(t.neto)} neto</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default ResumenSemana;
