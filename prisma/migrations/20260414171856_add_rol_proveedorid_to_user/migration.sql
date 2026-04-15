-- AlterTable
ALTER TABLE "User" ADD COLUMN     "proveedorId" INTEGER,
ADD COLUMN     "rol" TEXT NOT NULL DEFAULT 'administrador';

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
