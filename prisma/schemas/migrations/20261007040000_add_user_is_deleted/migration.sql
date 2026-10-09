-- Soft-delete de usuarios: el "eliminar" desde el front solo marca el registro
-- (junto con active=false) en lugar de un hard delete (evita FK RESTRICT de CashRegister).
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false;
