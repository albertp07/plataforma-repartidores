// Lógica compartida para aplicar cambios de perfil (nombre, teléfono, vehículo).
// La usan tanto la edición directa del admin como la aprobación de solicitudes.

const CAMPOS_PERFIL = ['nombre', 'telefono', 'vehiculo'];

// Deja solo los campos permitidos y normaliza strings (trim).
function limpiarCambios(entrada = {}) {
  const limpio = {};
  for (const campo of CAMPOS_PERFIL) {
    if (entrada[campo] !== undefined && entrada[campo] !== null) {
      limpio[campo] = String(entrada[campo]).trim();
    }
  }
  return limpio;
}

// Aplica los cambios dentro de una transacción de Prisma (tx).
// - nombre: no puede quedar vacío.
// - telefono / vehiculo: string vacío => null. Se crea el perfil Repartidor si no existe.
async function aplicarCambiosPerfil(tx, usuarioId, cambios) {
  const { nombre, telefono, vehiculo } = cambios;

  if (nombre !== undefined) {
    if (nombre === '') {
      const error = new Error('El nombre no puede estar vacío');
      error.status = 400;
      throw error;
    }
    await tx.usuario.update({ where: { id: usuarioId }, data: { nombre } });
  }

  if (telefono !== undefined || vehiculo !== undefined) {
    const datos = {};
    if (telefono !== undefined) datos.telefono = telefono || null;
    if (vehiculo !== undefined) datos.vehiculo = vehiculo || null;

    await tx.repartidor.upsert({
      where: { usuarioId },
      create: { usuarioId, ...datos },
      update: datos,
    });
  }
}

module.exports = { CAMPOS_PERFIL, limpiarCambios, aplicarCambiosPerfil };
