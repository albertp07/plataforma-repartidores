import api from './api';

export async function obtenerUsuariosPendientes() {
  const response = await api.get('/usuarios/pendientes');
  return response.data;
}

export async function actualizarEstadoUsuario(id, estado) {
  const response = await api.patch(`/usuarios/${id}/estado`, { estado });
  return response.data;
}
