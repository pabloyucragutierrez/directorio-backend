/*
  Warnings:

  - You are about to drop the column `precio` on the `ProductoProveedor` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ProductoProveedor" DROP COLUMN "precio",
ADD COLUMN     "precioDolar" DOUBLE PRECISION,
ADD COLUMN     "precioNacional" DOUBLE PRECISION;
