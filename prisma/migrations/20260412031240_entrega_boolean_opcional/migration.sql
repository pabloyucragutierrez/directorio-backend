/*
  Warnings:

  - The `entrega` column on the `Proveedor` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Proveedor" DROP COLUMN "entrega",
ADD COLUMN     "entrega" BOOLEAN DEFAULT false;
