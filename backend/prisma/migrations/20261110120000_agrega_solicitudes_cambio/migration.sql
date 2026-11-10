-- CreateEnum
CREATE TYPE "EstadoSolicitud" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateTable
CREATE TABLE "SolicitudCambio" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "cambios" JSONB NOT NULL,
    "mensaje" TEXT,
    "estado" "EstadoSolicitud" NOT NULL DEFAULT 'PENDIENTE',
    "respuesta" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resueltoEn" TIMESTAMP(3),

    CONSTRAINT "SolicitudCambio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SolicitudCambio_usuarioId_idx" ON "SolicitudCambio"("usuarioId");

-- CreateIndex
CREATE INDEX "SolicitudCambio_estado_idx" ON "SolicitudCambio"("estado");

-- AddForeignKey
ALTER TABLE "SolicitudCambio" ADD CONSTRAINT "SolicitudCambio_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
