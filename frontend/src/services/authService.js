import api from './api';

export async function login(email, password) {
  const response = await api.post('/usuarios/login', { email, password });
  return response.data; // { usuario, token }
}

export async function registrar({ nombre, email, password, rol, telefono, vehiculo }) {
  const response = await api.post('/usuarios', { nombre, email, password, rol, telefono, vehiculo });
  return response.data;
}
