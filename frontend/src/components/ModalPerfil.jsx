import { useState, useEffect } from 'react';
import { formatearFechaLocal } from '../utils/fechas';
import '../styles/admin-usuarios.css';

const ETIQUETA_ESTADO = {
  PENDIENTE: { texto: 'Pendiente', clase: 'badge-amber' },
  APROBADA: { texto: 'Aplicada', clase: 'badge-green' },
  RECHAZADA: { texto: 'Rechazada', clase: 'badge-red' },
};

const ETIQUETA_CAMPO = { nombre: 'Nombre', telefono: 'Teléfono', vehiculo: 'Vehículo' };

// Los datos del perfil son de solo lectura: para cambiarlos el repartidor
// envía una solicitud y un administrador la aprueba o rechaza.
function ModalPerfil({
  visible,
  usuario,
  telefonoInicial,
  vehiculoInicial,
  solicitudes = [],
  onSolicitar,
  onCancelar,
  enviando,
  error,
  exito,
}) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [vehiculo, setVehiculo] = useState('');
  const [mensaje, setMensaje] = useState('');

  const hayPendiente = solicitudes.some((s) => s.estado === 'PENDIENTE');

  useEffect(() => {
    if (visible) {
      setEditando(false);
      setNombre(usuario?.nombre || '');
      setTelefono(telefonoInicial || '');
      setVehiculo(vehiculoInicial || '');
      setMensaje('');
    }
  }, [visible, usuario, telefonoInicial, vehiculoInicial]);

  if (!visible) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    const enviada = await onSolicitar({ nombre, telefono, vehiculo, mensaje });
    if (enviada) {
      setEditando(false);
      setMensaje('');
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancelar}>
      <div className="modal-box modal-box-wide" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Mi Perfil</h3>
        <p className="modal-message">
          Para modificar tus datos (o pedir un cambio de contraseña o correo) envía una solicitud al administrador.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <span className="field-label">Nombre</span>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              disabled={!editando}
            />
          </div>

          <div className="field">
            <span className="field-label">Correo electrónico</span>
            <input type="email" value={usuario?.email || ''} disabled />
          </div>

          <div className="field">
            <span className="field-label">Teléfono</span>
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+56 9 1234 5678"
              disabled={!editando}
            />
          </div>

          <div className="field">
            <span className="field-label">Vehículo / Patente</span>
            <input
              type="text"
              value={vehiculo}
              onChange={(e) => setVehiculo(e.target.value)}
              placeholder="Moto, Auto, Bicicleta..."
              disabled={!editando}
            />
          </div>

          {editando && (
            <div className="field">
              <span className="field-label">Mensaje para el administrador (opcional)</span>
              <textarea
                rows={3}
                maxLength={500}
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                placeholder="Ej: necesito cambiar mi contraseña / mi correo"
              />
            </div>
          )}

          {hayPendiente && !editando && (
            <p className="form-success" role="status">
              Tienes una solicitud pendiente. El administrador la revisará pronto.
            </p>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          {exito && <p className="form-success" role="status">{exito}</p>}

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onCancelar} disabled={enviando}>
              Cerrar
            </button>
            {editando ? (
              <>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setEditando(false)}
                  disabled={enviando}
                >
                  Cancelar cambio
                </button>
                <button type="submit" className="btn-primary" disabled={enviando}>
                  {enviando ? 'Enviando...' : 'Enviar solicitud'}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn-primary"
                onClick={() => setEditando(true)}
                disabled={hayPendiente}
                title={hayPendiente ? 'Ya tienes una solicitud pendiente' : ''}
              >
                Solicitar cambio de datos
              </button>
            )}
          </div>
        </form>

        {solicitudes.length > 0 && (
          <div className="solicitud-historial">
            <h4>Mis solicitudes</h4>
            {solicitudes.map((s) => {
              const estado = ETIQUETA_ESTADO[s.estado];
              const campos = Object.keys(s.cambios || {});
              return (
                <div className="solicitud-item" key={s.id}>
                  <span className={`badge ${estado.clase}`}>{estado.texto}</span>{' '}
                  {formatearFechaLocal(s.creadoEn)}
                  {campos.length > 0 && (
                    <div>
                      {campos.map((c) => `${ETIQUETA_CAMPO[c] || c}: ${s.cambios[c] || '(vacío)'}`).join(' · ')}
                    </div>
                  )}
                  {s.mensaje && <div className="cambio-mensaje">“{s.mensaje}”</div>}
                  {s.respuesta && <div>Respuesta del admin: {s.respuesta}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default ModalPerfil;
