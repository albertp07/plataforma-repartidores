import '../styles/animacion-papelera.css';

// Documento que se achica y cae a la papelera. SVG inline puro (sin librerías de íconos).
function AnimacionPapelera({ texto }) {
  return (
    <div className="papelera-escena" role="status" aria-live="polite">
      <svg className="papelera-svg" viewBox="0 0 200 140" fill="none" aria-hidden="true">
        {/* Documento */}
        <g className="papelera-doc">
          <rect x="20" y="30" width="64" height="84" rx="7" className="papelera-doc-hoja" strokeWidth="3" />
          <path d="M66 30h11a7 7 0 0 1 7 7v11H73a7 7 0 0 1-7-7z" className="papelera-doc-esquina" strokeWidth="3" strokeLinejoin="round" />
          <path d="M32 62h40M32 74h40M32 86h40M32 98h22" className="papelera-doc-linea" strokeWidth="3" strokeLinecap="round" />
        </g>

        {/* Papelera (cuerpo + tapa) */}
        <g className="papelera-tacho">
          <path d="M128 62h44l-4 66a5 5 0 0 1-5 4h-26a5 5 0 0 1-5-4z" className="papelera-cuerpo" strokeWidth="3" strokeLinejoin="round" />
          <path d="M140 74v46M150 74v46M160 74v46" className="papelera-franja" strokeWidth="3" strokeLinecap="round" />
        </g>
        <g className="papelera-tapa">
          <rect x="121" y="52" width="58" height="9" rx="4" className="papelera-cuerpo" strokeWidth="3" />
          <path d="M142 52v-5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v5" className="papelera-asa" strokeWidth="3" strokeLinecap="round" />
        </g>
      </svg>
      {texto && <p className="papelera-texto">{texto}</p>}
    </div>
  );
}

export default AnimacionPapelera;
