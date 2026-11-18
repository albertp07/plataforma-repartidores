-- CreateTable
CREATE TABLE "DireccionGeocodificada" (
    "id" SERIAL NOT NULL,
    "direccionNormalizada" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "encontrada" BOOLEAN NOT NULL DEFAULT false,
    "aproximada" BOOLEAN NOT NULL DEFAULT false,
    "consultadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DireccionGeocodificada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DireccionGeocodificada_direccionNormalizada_key" ON "DireccionGeocodificada"("direccionNormalizada");
