-- CreateEnum
CREATE TYPE "Turno" AS ENUM ('AM', 'PM');

-- AlterTable
ALTER TABLE "Transaccion" ADD COLUMN     "turno" "Turno";
