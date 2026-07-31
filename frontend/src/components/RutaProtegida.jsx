import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function RutaProtegida({ children, rolRequerido }) {
  const { usuario } = useAuth();

  if (!usuario) {
    return <Navigate to="/" replace />;
  }

  // El ADMIN puede ver cualquier pantalla protegida
  if (usuario.rol === 'ADMIN') {
    return children;
  }

  // Los demás roles deben coincidir exactamente con el requerido
  if (rolRequerido && usuario.rol !== rolRequerido) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default RutaProtegida;