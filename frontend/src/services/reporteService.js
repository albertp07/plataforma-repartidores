import api from './api';

export async function obtenerResumenGeneral() {
  const response = await api.get('/reportes/resumen');
  return response.data;
}

export async function obtenerBalancePorRepartidor() {
  const response = await api.get('/reportes/por-repartidor');
  return response.data;
}

export async function obtenerMovimientosPorFecha() {
  const response = await api.get('/reportes/por-fecha');
  return response.data;
}