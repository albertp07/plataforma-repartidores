import { useState, useEffect } from 'react';

// Botón multiestado: reposo → guardando → guardado / error → reposo.
// Las 4 etiquetas se apilan en la misma celda de un grid (el ancho del botón no salta)
// y solo la del estado activo se muestra, con transición suave.
function BotonMultiestado({ guardando, deshabilitado, error, textoBoton }) {
  const [estado, setEstado] = useState('idle');
  const [guardandoPrevio, setGuardandoPrevio] = useState(guardando);

  // Ajuste de estado durante el render al cambiar `guardando` (sin efecto intermedio)
  if (guardando !== guardandoPrevio) {
    setGuardandoPrevio(guardando);
    if (guardando) setEstado('guardando');
    else setEstado(error ? 'error' : 'exito');
  }

  // Tras mostrar el resultado, vuelve a reposo
  useEffect(() => {
    if (estado !== 'exito' && estado !== 'error') return undefined;
    const t = setTimeout(() => setEstado('idle'), 1800);
    return () => clearTimeout(t);
  }, [estado]);

  const items = [
    { id: 'idle', texto: textoBoton, icono: null },
    {
      id: 'guardando',
      texto: 'Guardando',
      icono: (
        <svg className="mb-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
          <path d="M12 3a9 9 0 1 0 9 9" />
        </svg>
      ),
    },
    {
      id: 'exito',
      texto: 'Guardado',
      icono: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path className="mb-check" d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      ),
    },
    {
      id: 'error',
      texto: 'No se guardó',
      icono: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      ),
    },
  ];

  return (
    <button
      type="submit"
      className="btn-primary barra-resumen-btn multiestado"
      data-estado={estado}
      disabled={guardando || deshabilitado}
      aria-live="polite"
    >
      {items.map((it) => (
        <span key={it.id} className={`mb-item ${estado === it.id ? 'activo' : ''}`} aria-hidden={estado !== it.id}>
          {it.icono}
          <span>{it.texto}</span>
        </span>
      ))}
    </button>
  );
}

// Barra adherente al pie del formulario: resumen en vivo + botón de guardar.
// Usa position: sticky dentro del <form>, así queda visible mientras se llena
// y se asienta al final del formulario sin tapar nada.
function BarraResumen({ liquido, iva, bruto, detalle, formato, textoBoton, guardando, deshabilitado, error = '', mostrarMontos = true }) {
  return (
    <div className={`barra-resumen ${mostrarMontos ? '' : 'solo-boton'}`}>
      {mostrarMontos && (
        <div className="barra-resumen-montos" aria-live="polite">
          <div className="barra-resumen-bruto">
            <span className="barra-resumen-etiqueta">Bruto total</span>
            <span className="barra-resumen-valor">${formato(bruto)}</span>
          </div>
          <div className="barra-resumen-detalle">
            {detalle && <span>{detalle}</span>}
            <span>Líquido ${formato(liquido)}</span>
            <span>IVA ${formato(iva)}</span>
          </div>
        </div>
      )}
      <BotonMultiestado
        guardando={guardando}
        deshabilitado={deshabilitado}
        error={error}
        textoBoton={textoBoton}
      />
    </div>
  );
}

export default BarraResumen;
