import api from './api';

// Mapa de calor de entregas. params: { desde, hasta, turno } (fechas YYYY-MM-DD, turno TODOS | AM | PM)
// Devuelve:
//   puntos:   [{ lat, lng, direccion, paradas, entregados, fallidos, aproximada }]
//   sinUbicar:[{ direccion, paradas, enProceso }]
//   resumen:  { paradas, direcciones, ubicadas, aproximadas, sinUbicar, pendientes, entregados, fallidos }
// "pendientes" > 0 significa que el servidor aún está ubicando direcciones: conviene volver a consultar.
export async function obtenerMapaCalor(params) {
  const response = await api.get('/mapa/calor', { params });
  return response.data;
}
