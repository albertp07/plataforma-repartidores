import api from './api';

// Envía el historial [{ role: 'user' | 'assistant', content }] y devuelve el texto de respuesta.
export async function enviarMensaje(mensajes) {
  const response = await api.post('/chat', { mensajes }, { timeout: 60000 });
  return response.data.respuesta;
}
