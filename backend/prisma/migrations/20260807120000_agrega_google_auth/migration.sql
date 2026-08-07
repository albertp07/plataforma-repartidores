-- AlterTable: password deja de ser obligatorio (usuarios que se registran con Google no tienen password local)
ALTER TABLE "Usuario" ALTER COLUMN "password" DROP NOT NULL;

-- AlterTable: se agrega googleId para vincular la cuenta con el login de Google
ALTER TABLE "Usuario" ADD COLUMN "googleId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_googleId_key" ON "Usuario"("googleId");
