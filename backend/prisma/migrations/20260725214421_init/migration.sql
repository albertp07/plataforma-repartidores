-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'REPARTIDOR');

-- CreateEnum
CREATE TYPE "TipoTransaccion" AS ENUM ('INGRESO', 'GASTO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'REPARTIDOR',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repartidor" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "telefono" TEXT,
    "vehiculo" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Repartidor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaccion" (
    "id" SERIAL NOT NULL,
    "repartidorId" INTEGER NOT NULL,
    "tipo" "TipoTransaccion" NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "descripcion" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaccion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Repartidor_usuarioId_key" ON "Repartidor"("usuarioId");

-- AddForeignKey
ALTER TABLE "Repartidor" ADD CONSTRAINT "Repartidor_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_repartidorId_fkey" FOREIGN KEY ("repartidorId") REFERENCES "Repartidor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
