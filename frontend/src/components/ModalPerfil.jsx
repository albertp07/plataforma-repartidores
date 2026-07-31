import { useState, useEffect } from 'react';

function ModalPerfil({
  visible,
  usuario,
  telefonoInicial,
  vehiculoInicial,
  onGuardar,
  onCancelar,
  guardando,
  error,
  exito,
}) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [vehiculo, setVehiculo] = useState('');

  useEffect(() => {
    if (visible) {
      setNombre(usuario?.nombre || '');
      setTelefono(telefonoInicial || '');
      setVehiculo(vehiculoInicial || '');
    }
  }, [visible, usuario, telefonoInicial, vehiculoInicial]);

  if (!visible) return null;

  function handleSubmit(e) {
    e.preventDefault();
    onGuardar({ nombre, telefono, vehiculo });
  }

  return (
    <div className="modal-overlay" onClick={onCancelar}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Mi Perfil</h3>
        <p className="modal-message">
          Consulta y actualiza tus datos de contacto.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <span className="field-label">Nombre</span>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
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
            />
          </div>

          <div className="field">
            <span className="field-label">Vehículo / Patente</span>
            <input
              type="text"
              value={vehiculo}
              onChange={(e) => setVehiculo(e.target.value)}
              placeholder="Moto, Auto, Bicicleta..."
            />
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}
          {exito && <p className="form-success" role="status">{exito}</p>}

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onCancelar} disabled={guardando}>
              Cerrar
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

export default ModalPerfil;
