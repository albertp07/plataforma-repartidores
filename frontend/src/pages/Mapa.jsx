import { useNavigate } from 'react-router-dom';
import MapaCalor from '../components/MapaCalor';
import EstadoServidor from '../components/EstadoServidor';
import '../styles/shared.css';

function Mapa() {
  const navigate = useNavigate();
  const rutaVolver = '/panel';

  return (
    <div className="app-shell">
      <div className="app-container">
        <div className="app-topbar">
          <div className="app-brand">
            <img className="app-brand-logo" src="/favicon-192.png" alt="" width="44" height="44" />
            <div>
              <h1>Mapa de entregas</h1>
              <p className="app-user">Mapa de calor de las paradas en Macul</p>
            </div>
          </div>
          <div className="topbar-actions">
            <EstadoServidor />
            <button className="btn-ghost" onClick={() => navigate(rutaVolver)}>
              Volver
            </button>
          </div>
        </div>

        <MapaCalor />
      </div>
    </div>
  );
}

export default Mapa;
