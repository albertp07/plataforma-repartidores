-- CreateEnum
CREATE TYPE "EstadoUsuario" AS ENUM ('PENDIENTE', 'ACTIVO', 'RECHAZADO');

-- AlterTable: se agrega con default PENDIENTE para que Prisma pueda aplicarla sin error
ALTER TABLE "Usuario" ADD COLUMN "estado" "EstadoUsuario" NOT NULL DEFAULT 'PENDIENTE';

-- Backfill: los usuarios ya existentes (incluida la cuenta Admin) pasan a ACTIVO
-- para no quedar bloqueados por el nuevo flujo de aprobación.
UPDATE "Usuario" SET "estado" = 'ACTIVO';
