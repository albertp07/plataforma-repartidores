import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { obtenerUsuarios, actualizarUsuarioAdmin, eliminarUsuarioAdmin } from '../services/usuarioService';
import ModalEditarUsuario from './ModalEditarUsuario';
import '../styles/admin-usuarios.css';

const ETIQUETA_ESTADO = {
  ACTIVO: { texto: 'Activo', clase: 'badge-green' },
  PENDIENTE: { texto: 'Pendiente', clase: 'badge-amber' },
  RECHAZADO: { texto: 'Rechazado', clase: 'badge-red' },
};

function AdminUsuarios() {
  const { usuario: yo, actualizarUsuario } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorLista, setErrorLista] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState('');
  const [exito, setExito] = useState('');
  const [eliminando, setEliminando] = useState(false);

  async function cargar() {
    setCargando(true);
    setErrorLista('');
    try {
      setUsuarios(await obtenerUsuarios());
    } catch (err) {
      console.error(err);
      setErrorLista('No se pudo cargar la lista de usuarios.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((u) =>
      [u.nombre, u.email, u.repartidor?.telefono, u.repartidor?.vehiculo]
        .filter(Boolean)
        .some((valor) => valor.toLowerCase().includes(q))
    );
  }, [usuarios, busqueda]);

  async function handleGuardar(datos) {
    setGuardando(true);
    setErrorEdicion('');
    try {
      const actualizado = await actualizarUsuarioAdmin(editando.id, datos);
      setUsuarios((prev) => prev.map((u) => (u.id === actualizado.id ? actualizado : u)));
      if (actualizado.id === yo?.id) {
        actualizarUsuario({ nombre: actualizado.nombre, email: actualizado.email });
      }
      setExito(`Datos de ${actualizado.nombre} actualizados.`);
      setEditando(null);
    } catch (err) {
      setErrorEdicion(err.response?.data?.error || 'No se pudo actualizar el usuario.');
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar() {
    setEliminando(true);
    setErrorEdicion('');
    try {
      await eliminarUsuarioAdmin(editando.id);
      setUsuarios((prev) => prev.filter((u) => u.id !== editando.id));
      setExito(`Usuario ${editando.nombre} eliminado.`);
      setEditando(null);
    } catch (err) {
      setErrorEdicion(err.response?.data?.error || 'No se pudo eliminar el usuario.');
    } finally {
      setEliminando(false);
    }
  }

  return (
    <>
      <p className="section-title">Usuarios</p>

      <div className="admin-toolbar">
        <input
          type="search"
          placeholder="Buscar por nombre, email, teléfono o vehículo"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar usuarios"
        />
      </div>

      {exito && <p className="form-success" role="status" style={{ marginBottom: '12px' }}>{exito}</p>}
      {errorLista && <p className="login-error" role="alert" style={{ marginBottom: '12px' }}>{errorLista}</p>}

      {cargando ? (
        <p className="empty-state">Cargando usuarios...</p>
      ) : filtrados.length === 0 ? (
        <p className="empty-state">No se encontraron usuarios.</p>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Teléfono</th>
                <th>Vehículo</th>
                <th>Rol</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((u) => {
                const estado = ETIQUETA_ESTADO[u.estado] || ETIQUETA_ESTADO.PENDIENTE;
                return (
                  <tr key={u.id}>
                    <td>{u.nombre}</td>
                    <td>{u.email}</td>
                    <td>{u.repartidor?.telefono || '-'}</td>
                    <td>{u.repartidor?.vehiculo || '-'}</td>
                    <td>{u.rol === 'ADMIN' ? 'Admin' : 'Repartidor'}</td>
                    <td><span className={`badge ${estado.clase}`}>{estado.texto}</span></td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="btn-ghost"
                          onClick={() => {
                            setExito('');
                            setErrorEdicion('');
                            setEditando(u);
                          }}
                        >
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ModalEditarUsuario
        visible={Boolean(editando)}
        usuario={editando}
        esMismoUsuario={editando?.id === yo?.id}
        onGuardar={handleGuardar}
        onEliminar={handleEliminar}
        eliminando={eliminando}
        onCancelar={() => setEditando(null)}
        guardando={guardando}
        error={errorEdicion}
      />
    </>
  );
}

export default AdminUsuarios;
