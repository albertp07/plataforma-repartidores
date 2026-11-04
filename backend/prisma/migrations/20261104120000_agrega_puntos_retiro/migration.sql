-- CreateTable
CREATE TABLE "PuntoRetiro" (
    "id" SERIAL NOT NULL,
    "repartidorId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "zona" TEXT NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PuntoRetiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetalleRetiro" (
    "id" SERIAL NOT NULL,
    "transaccionId" INTEGER NOT NULL,
    "puntoRetiroId" INTEGER,
    "nombre" TEXT NOT NULL,
    "zona" TEXT NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "DetalleRetiro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PuntoRetiro_repartidorId_zona_nombre_key" ON "PuntoRetiro"("repartidorId", "zona", "nombre");

-- CreateIndex
CREATE INDEX "DetalleRetiro_transaccionId_idx" ON "DetalleRetiro"("transaccionId");

-- AddForeignKey
ALTER TABLE "PuntoRetiro" ADD CONSTRAINT "PuntoRetiro_repartidorId_fkey" FOREIGN KEY ("repartidorId") REFERENCES "Repartidor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleRetiro" ADD CONSTRAINT "DetalleRetiro_transaccionId_fkey" FOREIGN KEY ("transaccionId") REFERENCES "Transaccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleRetiro" ADD CONSTRAINT "DetalleRetiro_puntoRetiroId_fkey" FOREIGN KEY ("puntoRetiroId") REFERENCES "PuntoRetiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;
