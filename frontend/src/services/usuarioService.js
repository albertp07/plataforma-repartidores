import api from './api';

export async function obtenerUsuariosPendientes() {
  const response = await api.get('/usuarios/pendientes');
  return response.data;
}

export async function actualizarEstadoUsuario(id, estado) {
  const response = await api.patch(`/usuarios/${id}/estado`, { estado });
  return response.data;
}

export async function obtenerUsuarios() {
  const response = await api.get('/usuarios');
  return response.data;
}

export async function actualizarUsuarioAdmin(id, datos) {
  const response = await api.put(`/usuarios/${id}`, datos);
  return response.data;
}

export async function eliminarUsuarioAdmin(id) {
  const response = await api.delete(`/usuarios/${id}`);
  return response.data;
}
