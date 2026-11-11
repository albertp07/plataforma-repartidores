import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import api from '../services/api';

// Consulta /estado del backend (evita el nombre /health, que algunos bloqueadores filtran). Se usa axios directo (sin el token del interceptor)
// y la misma URL base que el resto de la app.
const INTERVALO_MS = 30000;
// El backend gratuito de Render puede tardar hasta ~1 min en despertar
const TIMEOUT_ARRANQUE_MS = 70000;
const TIMEOUT_NORMAL_MS = 15000;

/**
 * Estados: 'verificando' (ámbar) | 'activo' (verde) | 'inactivo' (rojo)
 */
export function useEstadoServidor() {
  const [estado, setEstado] = useState('verificando');
  const [ultimaRevision, setUltimaRevision] = useState(null);
  const estadoRef = useRef('verificando');
  const enCurso = useRef(false);
  const montado = useRef(true);

  const aplicar = useCallback((nuevo) => {
    estadoRef.current = nuevo;
    if (montado.current) setEstado(nuevo);
  }, []);

  const verificar = useCallback(async () => {
    if (enCurso.current) return;
    enCurso.current = true;
    const veniaActivo = estadoRef.current === 'activo';
    if (!veniaActivo) aplicar('verificando');
    try {
      await axios.get(`${api.defaults.baseURL}/estado`, {
        timeout: veniaActivo ? TIMEOUT_NORMAL_MS : TIMEOUT_ARRANQUE_MS,
        // Cualquier respuesta (<500) prueba que el servidor está vivo, aunque no tenga /health
        validateStatus: (codigo) => codigo < 500,
      });
      aplicar('activo');
    } catch {
      aplicar('inactivo');
    } finally {
      enCurso.current = false;
      if (montado.current) setUltimaRevision(new Date());
    }
  }, [aplicar]);

  useEffect(() => {
    montado.current = true;
    verificar();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') verificar();
    }, INTERVALO_MS);
    const alVolver = () => {
      if (document.visibilityState === 'visible') verificar();
    };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('online', verificar);
    return () => {
      montado.current = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('online', verificar);
    };
  }, [verificar]);

  return { estado, ultimaRevision, verificar };
}
