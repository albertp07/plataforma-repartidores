import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../pages/Legal.css';

function LegalLayout({ titulo, tituloPestana, actualizado, children }) {
  useEffect(() => {
    document.title = `Aryal - ${tituloPestana}`;
  }, [tituloPestana]);

  return (
    <div className="legal-screen">
      <article className="legal-card">
        
        <h1 className="legal-title">{titulo}</h1>
        <p className="legal-updated">Última actualización: {actualizado}</p>

        {children}

        <nav className="legal-nav">
          <Link to="/">← Volver al inicio de sesión</Link>
          <span>
            <Link to="/privacidad">Privacidad</Link>
            {' · '}
            <Link to="/terminos">Términos</Link>
          </span>
        </nav>
      </article>
    </div>
  );
}

export default LegalLayout;
