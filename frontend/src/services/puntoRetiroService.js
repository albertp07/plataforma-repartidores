import api from './api';

export async function listarPuntosRetiro() {
  const response = await api.get('/puntos-retiro');
  return response.data;
}

export async function crearPuntoRetiro(datos) {
  const response = await api.post('/puntos-retiro', datos);
  return response.data;
}

export async function actualizarPuntoRetiro(id, datos) {
  const response = await api.put(`/puntos-retiro/${id}`, datos);
  return response.data;
}

export async function quitarPuntoRetiro(id) {
  const response = await api.delete(`/puntos-retiro/${id}`);
  return response.data;
}
