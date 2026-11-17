import api from './api';

// Paradas guardadas de una ruta: { paradas: [{ id, orden, direccion, hora, notas, cantidadPaquetes, paquetesFallidos }] }
export async function obtenerParadas(rutaId) {
  const response = await api.get(`/transacciones/${rutaId}/paradas`);
  return response.data;
}

// Sube el PDF de Circuit y devuelve un BORRADOR { paradas, fechaPdf, advertencias }. No guarda nada.
export async function vistaPreviaParadas(rutaId, archivo) {
  const formData = new FormData();
  formData.append('pdf', archivo);
  const response = await api.post(`/transacciones/${rutaId}/paradas/vista-previa`, formData, { timeout: 60000 });
  return response.data;
}

// Reemplaza todas las paradas de la ruta por la lista enviada (importar, agregar, editar y borrar).
export async function guardarParadas(rutaId, paradas) {
  const response = await api.put(`/transacciones/${rutaId}/paradas`, { paradas });
  return response.data;
}

// Búsqueda entre todas las rutas: { q, desde, hasta, limite }
export async function buscarParadas(params) {
  const response = await api.get('/paradas', { params });
  return response.data;
}
