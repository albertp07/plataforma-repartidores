import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from '../pages/Login';
import DashboardAdmin from '../pages/DashboardAdmin';
import PanelRepartidor from '../pages/PanelRepartidor';
import RutaProtegida from '../components/RutaProtegida';

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
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
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;