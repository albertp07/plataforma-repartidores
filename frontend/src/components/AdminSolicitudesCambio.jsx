import { useState, useEffect } from 'react';
import { obtenerSolicitudesCambio, resolverSolicitudCambio } from '../services/solicitudCambioService';
import { formatearFechaLocal } from '../utils/fechas';
import '../styles/admin-usuarios.css';

const ETIQUETA_CAMPO = { nombre: 'Nombre', telefono: 'Teléfono', vehiculo: 'Vehículo' };

const ETIQUETA_ESTADO = {
  PENDIENTE: { texto: 'Pendiente', clase: 'badge-amber' },
  APROBADA: { texto: 'Resuelta', clase: 'badge-green' },
  RECHAZADA: { texto: 'Rechazada', clase: 'badge-red' },
};

function valorActual(solicitud, campo) {
  if (campo === 'nombre') return solicitud.usuario.nombre;
  return solicitud.usuario.repartidor?.[campo] || '';
}

function AdminSolicitudesCambio({ onActualizado }) {
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [procesandoId, setProcesandoId] = useState(null);

  async function cargar() {
    setCargando(true);
    setError('');
    try {
      setSolicitudes(await obtenerSolicitudesCambio());
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar las solicitudes de cambio.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function resolver(id, estado) {
    setProcesandoId(id);
    setError('');
    try {
      const actualizada = await resolverSolicitudCambio(id, { estado });
      setSolicitudes((prev) => prev.map((s) => (s.id === id ? actualizada : s)));
      if (onActualizado) onActualizado();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo resolver la solicitud.');
    } finally {
      setProcesandoId(null);
    }
  }

  const pendientes = solicitudes.filter((s) => s.estado === 'PENDIENTE');
  const resueltas = solicitudes.filter((s) => s.estado !== 'PENDIENTE');

  function renderDetalle(s, mostrarActual) {
    const campos = Object.keys(s.cambios || {});
    return (
      <>
        {campos.length > 0 && (
          <ul className="cambio-lista">
            {campos.map((campo) => (
              <li key={campo}>
                <strong>{ETIQUETA_CAMPO[campo] || campo}:</strong>{' '}
                {mostrarActual && (
                  <>
                    <span className="cambio-viejo">{valorActual(s, campo) || '(vacío)'}</span>
                    {' → '}
                  </>
                )}
                {s.cambios[campo] || '(vacío)'}
              </li>
            ))}
          </ul>
        )}
        {s.mensaje && <p className="cambio-mensaje">“{s.mensaje}”</p>}
      </>
    );
  }

  return (
    <>
      <p className="section-title">Solicitudes de cambio de datos</p>

      {error && <p className="login-error" role="alert" style={{ marginBottom: '12px' }}>{error}</p>}

      {cargando ? (
        <p className="empty-state">Cargando solicitudes...</p>
      ) : (
        <>
          {pendientes.length === 0 ? (
            <p className="empty-state">No hay solicitudes de cambio pendientes.</p>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Repartidor</th>
                    <th>Cambio solicitado</th>
                    <th>Fecha</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pendientes.map((s) => (
                    <tr key={s.id}>
                      <td>
                        {s.usuario.nombre}
                        <br />
                        <small>{s.usuario.email}</small>
                      </td>
                      <td>{renderDetalle(s, true)}</td>
                      <td>{formatearFechaLocal(s.creadoEn)}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="btn-primary"
                            disabled={procesandoId === s.id}
                            onClick={() => resolver(s.id, 'APROBADA')}
                            title={
                              Object.keys(s.cambios || {}).length === 0
                                ? 'Solo trae un mensaje: haz el cambio en la pestaña Usuarios y marca como resuelta'
                                : 'Aplica los cambios al perfil'
                            }
                          >
                            {Object.keys(s.cambios || {}).length === 0 ? 'Marcar resuelta' : 'Aprobar y aplicar'}
                          </button>
                          <button
                            className="btn-danger"
                            disabled={procesandoId === s.id}
                            onClick={() => resolver(s.id, 'RECHAZADA')}
                          >
                            Rechazar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {resueltas.length > 0 && (
            <>
              <p className="section-title" style={{ marginTop: '24px' }}>Resueltas recientemente</p>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Repartidor</th>
                      <th>Cambio solicitado</th>
                      <th>Estado</th>
                      <th>Resuelta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resueltas.map((s) => {
                      const estado = ETIQUETA_ESTADO[s.estado];
                      return (
                        <tr key={s.id}>
                          <td>{s.usuario.nombre}</td>
                          <td>{renderDetalle(s, false)}</td>
                          <td><span className={`badge ${estado.clase}`}>{estado.texto}</span></td>
                          <td>{s.resueltoEn ? formatearFechaLocal(s.resueltoEn) : '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

export default AdminSolicitudesCambio;
