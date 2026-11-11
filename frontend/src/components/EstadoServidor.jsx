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
      title={ayuda + hora}
      aria-live="polite"
      aria-label={`${etiqueta}. Toca para volver a comprobar.`}
    >
      <span className="estado-servidor__punto" aria-hidden="true" />
      <span className="estado-servidor__texto">{etiqueta}</span>
      <svg
        className="estado-servidor__refrescar"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 4v5h-5" />
      </svg>
    </button>
  );
}

export default EstadoServidor;
