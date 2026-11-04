import api from './api';

// Sube la captura del detalle diario y devuelve { borrador, referencia, advertencias }.
// No guarda nada: el usuario revisa el borrador antes de registrar.
export async function analizarCaptura(archivo) {
  const formData = new FormData();
  formData.append('imagen', archivo);
  const response = await api.post('/capturas/analizar', formData, { timeout: 60000 });
  return response.data;
}
