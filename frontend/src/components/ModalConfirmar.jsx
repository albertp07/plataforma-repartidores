function ModalConfirmar({ visible, titulo, mensaje, onConfirmar, onCancelar, cargando }) {
    if (!visible) return null;
  
    return (
      <div className="modal-overlay" onClick={onCancelar}>
        <div className="modal-box" onClick={(e) => e.stopPropagation()}>
          <h3 className="modal-title">{titulo}</h3>
          <p className="modal-message">{mensaje}</p>
          <div className="modal-actions">
            <button className="btn-ghost" onClick={onCancelar} disabled={cargando}>
              Cancelar
            </button>
            <button className="btn-danger" onClick={onConfirmar} disabled={cargando}>
              {cargando ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  export default ModalConfirmar;