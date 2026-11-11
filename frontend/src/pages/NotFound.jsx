import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './NotFound.css';

function NotFound() {
  const { usuario } = useAuth();

  useEffect(() => {
    document.title = 'Aryal - Página no encontrada';
  }, []);

  // Si hay sesión activa, el "home" es su panel según el rol; si no, el login.
  const rutaHome = usuario ? (usuario.rol === 'ADMIN' ? '/dashboard' : '/panel') : '/';
  const textoHome = usuario ? 'Ir a mi panel' : 'Ir al inicio de sesión';

  return (
    <div className="nf-screen">
      <main className="nf-card">
        <div className="nf-escena" aria-hidden="true">
          <svg viewBox="0 0 480 280" xmlns="http://www.w3.org/2000/svg" className="nf-svg">
            {/* Pin de ubicación perdida */}
            <g className="nf-pin">
              <path
                d="M240 34c-17 0-30 13-30 29 0 22 30 50 30 50s30-28 30-50c0-16-13-29-30-29z"
                fill="#F7A600"
                stroke="#23272E"
                strokeWidth="4"
                strokeLinejoin="round"
              />
              <text x="240" y="73" textAnchor="middle" className="nf-pin-q">?</text>
            </g>
            <ellipse className="nf-pin-sombra" cx="240" cy="124" rx="16" ry="4" fill="#23272E" opacity="0.18" />

            {/* 4 0 4 */}
            <text x="92" y="214" textAnchor="middle" className="nf-num">4</text>
            <text x="388" y="214" textAnchor="middle" className="nf-num">4</text>
            {/* El 0 es una caja de entrega */}
            <g className="nf-caja">
              <rect x="190" y="132" width="100" height="82" rx="8" fill="#F7A600" stroke="#23272E" strokeWidth="6" />
              <path d="M190 160h100" stroke="#23272E" strokeWidth="6" />
              <rect x="228" y="132" width="24" height="28" fill="#FFF1D1" stroke="#23272E" strokeWidth="6" />
              <path d="M214 184h52" stroke="#23272E" strokeWidth="5" strokeLinecap="round" opacity="0.55" />
            </g>

            {/* Calle */}
            <rect x="0" y="228" width="480" height="30" fill="#23272E" />
            <line x1="0" y1="243" x2="480" y2="243" className="nf-linea" />

            {/* Furgón de reparto */}
            <g className="nf-moto">
              <g className="nf-rebote">
                {/* cargo */}
                <rect x="0" y="184" width="74" height="42" rx="5" fill="#F7A600" stroke="#23272E" strokeWidth="3" />
                <rect x="10" y="194" width="24" height="20" rx="2" fill="#FFF1D1" stroke="#23272E" strokeWidth="3" />
                <path d="M10 204h24M22 194v20" stroke="#23272E" strokeWidth="2" />
                <path d="M44 198h22M44 206h16" stroke="#23272E" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
                {/* cabina */}
                <path d="M74 226v-34h20l16 18v16z" fill="#E29600" stroke="#23272E" strokeWidth="3" strokeLinejoin="round" />
                <path d="M81 198h11l11 12H81z" fill="#E5EFFB" stroke="#23272E" strokeWidth="3" strokeLinejoin="round" />
                {/* conductor */}
                <circle cx="87" cy="204" r="5" fill="#F2C9A0" stroke="#23272E" strokeWidth="2" />
                <path d="M82 202c1-5 9-6 11-1z" fill="#1B6FD1" stroke="#23272E" strokeWidth="2" strokeLinejoin="round" />
                <path d="M86 207q2 1.5 4 0" fill="none" stroke="#23272E" strokeWidth="1.5" strokeLinecap="round" />
                {/* mano saludando (solo cuando pasa por el medio) */}
                <g className="nf-saludo">
                  <g className="nf-mano" style={{ transformOrigin: '92px 209px' }}>
                    <path d="M92 209l5-16" stroke="#23272E" strokeWidth="6" strokeLinecap="round" />
                    <path d="M92 209l5-16" stroke="#F2C9A0" strokeWidth="3" strokeLinecap="round" />
                    <circle cx="97.5" cy="190" r="5" fill="#F2C9A0" stroke="#23272E" strokeWidth="2" />
                  </g>
                </g>
                {/* faro y parachoques */}
                <circle cx="106" cy="216" r="3.5" fill="#FFF1D1" stroke="#23272E" strokeWidth="2" />
                <path d="M0 226h112" stroke="#23272E" strokeWidth="4" strokeLinecap="round" />
              </g>
              {/* ruedas */}
              <g className="nf-rueda" style={{ transformOrigin: '24px 230px' }}>
                <circle cx="24" cy="230" r="13" fill="#fff" stroke="#23272E" strokeWidth="4" />
                <path d="M24 219v22M13 230h22" stroke="#23272E" strokeWidth="3" />
              </g>
              <g className="nf-rueda" style={{ transformOrigin: '88px 230px' }}>
                <circle cx="88" cy="230" r="13" fill="#fff" stroke="#23272E" strokeWidth="4" />
                <path d="M88 219v22M77 230h22" stroke="#23272E" strokeWidth="3" />
              </g>
            </g>
          </svg>
        </div>

        <span className="nf-eyebrow">Error 404</span>
        <h1 className="nf-titulo">Ups, esta ruta no existe</h1>
        <p className="nf-texto">
          La dirección que buscas no está registrada en la plataforma. Puede que el enlace esté
          mal escrito o que la página ya no exista.
        </p>

        <div className="nf-acciones">
          <Link to={rutaHome} className="nf-btn nf-btn-primario">
            {textoHome}
          </Link>
          {usuario && (
            <Link to="/" className="nf-btn nf-btn-secundario">
              Ir al login
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}

export default NotFound;
