import { useState, useRef, useEffect } from 'react';
import { enviarMensaje } from '../services/chatService';
import '../styles/chat-asistente.css';

const SUGERENCIAS = [
  '¿Qué semanas he generado más ingresos?',
  '¿En qué semanas gasté más?',
  '¿Qué día de la semana me rinde más?',
  '¿Cuánto gasté en combustible este mes?',
];

function ChatAsistente() {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState([]); // [{ role, content }]
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const finRef = useRef(null);
  const cajaRef = useRef(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [mensajes, cargando, abierto]);

  // La caja crece con el contenido (hasta el máximo del CSS) y vuelve a su tamaño al enviar
  useEffect(() => {
    const caja = cajaRef.current;
    if (!caja) return;
    caja.style.height = 'auto';
    caja.style.height = `${caja.scrollHeight}px`;
  }, [texto, abierto]);

  const enviar = async (pregunta) => {
    const contenido = pregunta.trim();
    if (!contenido || cargando) return;

    const historial = [...mensajes, { role: 'user', content: contenido }];
    setMensajes(historial);
    setTexto('');
    setError('');
    setCargando(true);

    try {
      const respuesta = await enviarMensaje(historial);
      setMensajes([...historial, { role: 'assistant', content: respuesta }]);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo conectar con el asistente.');
    } finally {
      setCargando(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    enviar(texto);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar(texto);
    }
  };

  return (
    <>
      {!abierto && (
        <button
          type="button"
          className="chat-fab"
          onClick={() => setAbierto(true)}
          aria-label="Abrir asistente financiero"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
          </svg>
        </button>
      )}

      {abierto && (
        <div className="chat-panel" role="dialog" aria-label="Asistente financiero">
          <div className="chat-header">
            <div>
              <strong>Asistente financiero</strong>
              <span>Pregunta por tus ingresos y gastos</span>
            </div>
            <div className="chat-header-actions">
              {mensajes.length > 0 && (
                <button type="button" className="chat-link" onClick={() => { setMensajes([]); setError(''); }}>
                  Nueva
                </button>
              )}
              <button type="button" className="chat-close" onClick={() => setAbierto(false)} aria-label="Cerrar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </div>

          <div className="chat-mensajes">
            {mensajes.length === 0 && (
              <div className="chat-vacio">
                <p>Prueba con alguna de estas preguntas:</p>
                {SUGERENCIAS.map((s) => (
                  <button key={s} type="button" className="chat-sugerencia" onClick={() => enviar(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            {mensajes.map((m, i) => (
              <div key={i} className={`chat-burbuja ${m.role === 'user' ? 'chat-usuario' : 'chat-asistente'}`}>
                {m.content}
              </div>
            ))}

            {cargando && <div className="chat-burbuja chat-asistente chat-escribiendo">Consultando tus datos…</div>}
            {error && <p className="chat-error">{error}</p>}
            <div ref={finRef} />
          </div>

          <form className="chat-form" onSubmit={handleSubmit}>
            <textarea
              ref={cajaRef}
              rows={2}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu pregunta…"
              maxLength={500}
              disabled={cargando}
            />
            <button type="submit" disabled={cargando || !texto.trim()} aria-label="Enviar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13" />
                <path d="M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}

export default ChatAsistente;
