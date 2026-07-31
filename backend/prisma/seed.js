const bcrypt = require('bcrypt');
const prisma = require('../src/config/prisma');

const ADMIN_NOMBRE = 'Albert Peña';
const ADMIN_EMAIL = 'albert@aryal.com';
const ADMIN_PASSWORD = 'admin1234'; // Cambiar tras el primer login
const ADMIN_ROL = 'ADMIN';
const ADMIN_ESTADO = 'ACTIVO';

async function main() {
  const passwordHasheado = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const admin = await prisma.usuario.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      nombre: ADMIN_NOMBRE,
      rol: ADMIN_ROL,
      estado: ADMIN_ESTADO,
    },
    create: {
      nombre: ADMIN_NOMBRE,
      email: ADMIN_EMAIL,
      password: passwordHasheado,
      rol: ADMIN_ROL,
      estado: ADMIN_ESTADO,
    },
  });

  console.log(`Cuenta Admin lista: ${admin.email} (id ${admin.id})`);
}

main()
  .catch((error) => {
    console.error('Error al ejecutar el seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
