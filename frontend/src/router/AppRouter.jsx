import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from '../pages/Login';
import Privacidad from '../pages/Privacidad';
import Terminos from '../pages/Terminos';
import DashboardAdmin from '../pages/DashboardAdmin';
import PanelRepartidor from '../pages/PanelRepartidor';
import RutaProtegida from '../components/RutaProtegida';
import NotFound from '../pages/NotFound';

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/privacidad" element={<Privacidad />} />
        <Route path="/terminos" element={<Terminos />} />
        <Route
          path="/dashboard"
          element={
            <RutaProtegida rolRequerido="ADMIN">
              <DashboardAdmin />
            </RutaProtegida>
          }
        />
        <Route
          path="/panel"
          element={
            <RutaProtegida rolRequerido="REPARTIDOR">
              <PanelRepartidor />
            </RutaProtegida>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;