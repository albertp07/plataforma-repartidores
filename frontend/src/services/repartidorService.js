import api from './api';

export async function obtenerMiPerfil() {
  const response = await api.get('/repartidores/mi-perfil');
  return response.data;
}

export async function crearPerfil(telefono, vehiculo) {
  const response = await api.post('/repartidores', { telefono, vehiculo });
  return response.data;
}

export async function actualizarMiPerfil(datos) {
  const response = await api.put('/repartidores/mi-perfil', datos);
  return response.data; // { usuario, repartidor }
}
