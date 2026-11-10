import { useState, useEffect } from 'react';
import PasswordInput from './PasswordInput';
import '../styles/admin-usuarios.css';

function ModalEditarUsuario({ visible, usuario, esMismoUsuario, onGuardar, onEliminar, onCancelar, guardando, eliminando, error }) {
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    telefono: '',
    vehiculo: '',
    rol: 'REPARTIDOR',
    estado: 'ACTIVO',
    password: '',
  });

  useEffect(() => {
    if (visible && usuario) {
      setConfirmandoEliminar(false);
      setForm({
        nombre: usuario.nombre || '',
        email: usuario.email || '',
        telefono: usuario.repartidor?.telefono || '',
        vehiculo: usuario.repartidor?.vehiculo || '',
        rol: usuario.rol,
        estado: usuario.estado,
        password: '',
      });
    }
  }, [visible, usuario]);

  if (!visible || !usuario) return null;

  function cambiar(campo, valor) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const datos = {
      nombre: form.nombre,
      email: form.email,
      telefono: form.telefono,
      vehiculo: form.vehiculo,
      rol: form.rol,
      estado: form.estado,
    };
    if (form.password) datos.password = form.password;
    onGuardar(datos);
  }

  if (confirmandoEliminar) {
    return (
      <div className="modal-overlay" onClick={eliminando ? undefined : onCancelar}>
        <div className="modal-box" onClick={(e) => e.stopPropagation()}>
          <h3 className="modal-title">¿Eliminar usuario?</h3>
          <p className="modal-message">
            ¿Estás seguro de que quieres eliminar a <strong>{usuario.nombre}</strong> ({usuario.email})?
            Esta acción es permanente y no se puede deshacer.
          </p>

          {error && <p className="form-error" role="alert">{error}</p>}

          <div className="modal-actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setConfirmandoEliminar(false)}
              disabled={eliminando}
            >
              No, volver
            </button>
            <button type="button" className="btn-danger" onClick={onEliminar} disabled={eliminando}>
              {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onCancelar}>
      <div className="modal-box modal-box-wide" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Editar usuario</h3>
        <p className="modal-message">
          Los cambios se aplican de inmediato. Deja la contraseña vacía para no modificarla.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <span className="field-label">Nombre</span>
            <input type="text" value={form.nombre} onChange={(e) => cambiar('nombre', e.target.value)} />
          </div>

          <div className="field">
            <span className="field-label">Correo electrónico</span>
            <input type="email" value={form.email} onChange={(e) => cambiar('email', e.target.value)} />
          </div>

          <div className="field">
            <span className="field-label">Teléfono</span>
            <input
              type="tel"
              value={form.telefono}
              onChange={(e) => cambiar('telefono', e.target.value)}
              placeholder="+56 9 1234 5678"
            />
          </div>

          <div className="field">
            <span className="field-label">Vehículo / Patente</span>
            <input
              type="text"
              value={form.vehiculo}
              onChange={(e) => cambiar('vehiculo', e.target.value)}
              placeholder="Moto, Auto, Bicicleta..."
            />
          </div>

          <div className="field">
            <span className="field-label">Rol</span>
            <select
              value={form.rol}
              onChange={(e) => cambiar('rol', e.target.value)}
              disabled={esMismoUsuario}
            >
              <option value="REPARTIDOR">Repartidor</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>

          <div className="field">
            <span className="field-label">Estado de la cuenta</span>
            <select
              value={form.estado}
              onChange={(e) => cambiar('estado', e.target.value)}
              disabled={esMismoUsuario}
            >
              <option value="ACTIVO">Activo</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="RECHAZADO">Rechazado / desactivado</option>
            </select>
            {esMismoUsuario && (
              <span className="field-hint">No puedes cambiar tu propio rol ni estado.</span>
            )}
          </div>

          <div className="field">
            <span className="field-label">Nueva contraseña</span>
            <PasswordInput
              value={form.password}
              onChange={(e) => cambiar('password', e.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
            />
            {usuario.tieneGoogle && (
              <span className="field-hint">Esta cuenta también inicia sesión con Google.</span>
            )}
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}

          <div className="modal-actions">
            {!esMismoUsuario && (
              <button
                type="button"
                className="btn-danger"
                style={{ marginRight: 'auto' }}
                onClick={() => setConfirmandoEliminar(true)}
                disabled={guardando}
              >
                Eliminar usuario
              </button>
            )}
            <button type="button" className="btn-ghost" onClick={onCancelar} disabled={guardando}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ModalEditarUsuario;
