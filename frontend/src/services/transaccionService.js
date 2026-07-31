import api from './api';

export async function obtenerMisTransacciones() {
  const response = await api.get('/transacciones/mis-transacciones');
  return response.data; // { transacciones, resumen }
}

export async function crearTransaccion(datos) {
  const response = await api.post('/transacciones', datos);
  return response.data;
}

export async function obtenerTodasLasTransacciones() {
  const response = await api.get('/transacciones');
  return response.data;
}

export async function eliminarTransaccion(id) {
  const response = await api.delete(`/transacciones/${id}`);
  return response.data;
}