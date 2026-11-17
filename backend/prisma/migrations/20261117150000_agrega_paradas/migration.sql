-- CreateTable
CREATE TABLE "Parada" (
    "id" SERIAL NOT NULL,
    "transaccionId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "direccion" TEXT NOT NULL,
    "direccionNormalizada" TEXT NOT NULL,
    "hora" TEXT,
    "notas" TEXT,
    "cantidadPaquetes" INTEGER NOT NULL DEFAULT 1,
    "paquetesFallidos" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Parada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Parada_transaccionId_idx" ON "Parada"("transaccionId");

-- AddForeignKey
ALTER TABLE "Parada" ADD CONSTRAINT "Parada_transaccionId_fkey" FOREIGN KEY ("transaccionId") REFERENCES "Transaccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
