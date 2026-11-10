import api from './api';

// Repartidor
export async function crearSolicitudCambio(datos) {
  const response = await api.post('/solicitudes-cambio', datos);
  return response.data;
}

export async function obtenerMisSolicitudes() {
  const response = await api.get('/solicitudes-cambio/mias');
  return response.data;
}

// Admin
export async function obtenerSolicitudesCambio() {
  const response = await api.get('/solicitudes-cambio');
  return response.data;
}

export async function resolverSolicitudCambio(id, { estado, respuesta, cambios }) {
  const response = await api.patch(`/solicitudes-cambio/${id}`, { estado, respuesta, cambios });
  return response.data;
}
