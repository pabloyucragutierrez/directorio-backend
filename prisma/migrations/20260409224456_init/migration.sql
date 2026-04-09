-- CreateEnum
CREATE TYPE "EstadoPedido" AS ENUM ('PENDIENTE', 'ACEPTADO', 'RECHAZADO', 'AGOTADO');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proveedor" (
    "id" SERIAL NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "pais" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "direccion" TEXT,
    "distrito" TEXT,
    "codigoPostal" TEXT,
    "referencia" TEXT,
    "rubro" TEXT NOT NULL,
    "subrubro" TEXT,
    "entrega" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "licencia" TEXT,
    "copiaRucUrl" TEXT,
    "copiaLicenciaUrl" TEXT,
    "telefono" TEXT,
    "whatsapp" TEXT,
    "formaPago" TEXT,
    "datosPago" TEXT,
    "representante" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "telefonoRep" TEXT,
    "copiaDniUrl" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pedido" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoPedido" NOT NULL DEFAULT 'PENDIENTE',
    "tipoEntrega" TEXT,
    "fechaEntrega" TIMESTAMP(3),
    "entregaPuntual" BOOLEAN,
    "pagoRealizado" BOOLEAN,
    "importePagado" DOUBLE PRECISION,
    "calidad" INTEGER,
    "respuesta" INTEGER,
    "puntualidad" INTEGER,
    "confianza" INTEGER,
    "presentacion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductoPedido" (
    "id" SERIAL NOT NULL,
    "pedidoId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ProductoPedido_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Proveedor_ruc_key" ON "Proveedor"("ruc");

-- CreateIndex
CREATE UNIQUE INDEX "Pedido_numero_key" ON "Pedido"("numero");

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoPedido" ADD CONSTRAINT "ProductoPedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;
