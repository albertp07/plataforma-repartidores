import { useEstadoServidor } from '../hooks/useEstadoServidor';
import '../styles/estado-servidor.css';

const TEXTOS = {
  activo: { etiqueta: 'Servidor activo', ayuda: 'El servidor responde con normalidad.' },
  verificando: {
    etiqueta: 'Conectando…',
    ayuda: 'Despertando el servidor. Puede tardar hasta 1 minuto.',
  },
  inactivo: {
    etiqueta: 'Servidor inactivo',
    ayuda: 'No hay respuesta del servidor. Toca para reintentar.',
  },
};

function EstadoServidor() {
  const { estado, ultimaRevision, verificar } = useEstadoServidor();
  const { etiqueta, ayuda } = TEXTOS[estado];
  const hora = ultimaRevision
    ? ` Última revisión: ${ultimaRevision.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}.`
    : '';

  return (
    <button
      type="button"
      className={`estado-servidor estado-servidor--${estado}`}
      onClick={verificar}
      title={`${etiqueta}. ${ayuda}${hora}`}
      aria-live="polite"
      aria-label={`${etiqueta}. Toca para volver a comprobar.`}
    >
      <span className="estado-servidor__punto" aria-hidden="true" />
    </button>
  );
}

export default EstadoServidor;
