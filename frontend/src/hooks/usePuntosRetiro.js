import { useState, useEffect } from 'react';
import {
  listarPuntosRetiro,
  crearPuntoRetiro,
  actualizarPuntoRetiro,
  quitarPuntoRetiro,
} from '../services/puntoRetiroService';

// Catálogo de retiros del repartidor. Solo carga cuando `habilitado` es true (perfil de repartidor creado).
function usePuntosRetiro(habilitado) {
  const [puntos, setPuntos] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [errorCarga, setErrorCarga] = useState('');

  useEffect(() => {
    if (!habilitado) return undefined;
    let activo = true;

    listarPuntosRetiro()
      .then((lista) => {
        if (!activo) return;
        setPuntos(lista);
        setErrorCarga('');
        setCargado(true);
      })
      .catch(() => {
        if (!activo) return;
        setErrorCarga('No se pudieron cargar tus retiros');
        setCargado(true);
      });

    return () => { activo = false; };
  }, [habilitado]);

  async function refrescar() {
    setPuntos(await listarPuntosRetiro());
  }

  // Tras crear se vuelve a leer la lista (el servidor puede reactivar un retiro quitado antes)
  async function crear(datos) {
    const nuevo = await crearPuntoRetiro(datos);
    await refrescar();
    return nuevo;
  }

  async function actualizar(id, datos) {
    const actualizado = await actualizarPuntoRetiro(id, datos);
    await refrescar();
    return actualizado;
  }

  async function quitar(id) {
    await quitarPuntoRetiro(id);
    await refrescar();
  }

  return { puntos, cargando: habilitado && !cargado, errorCarga, crear, actualizar, quitar };
}

export default usePuntosRetiro;
