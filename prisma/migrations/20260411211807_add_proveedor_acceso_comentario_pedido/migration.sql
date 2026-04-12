/*
  Warnings:

  - A unique constraint covering the columns `[usuarioAcceso]` on the table `Proveedor` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "comentario" TEXT;

-- AlterTable
ALTER TABLE "Proveedor" ADD COLUMN     "passwordAcceso" TEXT,
ADD COLUMN     "usuarioAcceso" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Proveedor_usuarioAcceso_key" ON "Proveedor"("usuarioAcceso");
