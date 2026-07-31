-- AlterTable
ALTER TABLE "Transaccion" ADD COLUMN     "cantidadPaquetes" INTEGER,
ADD COLUMN     "montoIva" DECIMAL(10,2),
ADD COLUMN     "montoLiquido" DECIMAL(10,2),
ADD COLUMN     "valorPaquete" DECIMAL(10,2);
