-- Un proveedor conserva un solo registro y código, pero puede pertenecer a
-- varios rubros y subrubros. Los campos legacy de Proveedor se mantienen como
-- clasificación principal para compatibilidad durante la transición.
BEGIN;

CREATE TABLE "ProveedorRubro" (
  "id" SERIAL NOT NULL,
  "proveedorId" INTEGER NOT NULL,
  "rubro" TEXT NOT NULL,
  "subrubro" TEXT NOT NULL DEFAULT '',
  "productosComercializa" TEXT,
  "fuenteVerificacion" TEXT,
  "evidenciaVerificacion" JSONB,
  "esPrincipal" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProveedorRubro_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProveedorRubro_proveedorId_fkey"
    FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProveedorRubro_proveedorId_rubro_subrubro_key"
  ON "ProveedorRubro"("proveedorId", "rubro", "subrubro");
CREATE UNIQUE INDEX "ProveedorRubro_un_principal_por_proveedor_key"
  ON "ProveedorRubro"("proveedorId") WHERE "esPrincipal" = true;
CREATE INDEX "ProveedorRubro_proveedorId_idx"
  ON "ProveedorRubro"("proveedorId");
CREATE INDEX "ProveedorRubro_rubro_idx"
  ON "ProveedorRubro"("rubro");
CREATE INDEX "ProveedorRubro_subrubro_idx"
  ON "ProveedorRubro"("subrubro");
CREATE INDEX "ProveedorRubro_rubro_subrubro_idx"
  ON "ProveedorRubro"("rubro", "subrubro");

-- Crea la clasificación principal de todos los proveedores existentes.
-- No modifica el proveedor, su código ni sus demás datos.
INSERT INTO "ProveedorRubro" (
  "proveedorId",
  "rubro",
  "subrubro",
  "productosComercializa",
  "fuenteVerificacion",
  "evidenciaVerificacion",
  "esPrincipal",
  "createdAt",
  "updatedAt"
)
SELECT
  "id",
  trim("rubro"),
  coalesce(trim("subrubro"), ''),
  "productosComercializa",
  "fuenteVerificacion",
  "evidenciaVerificacion",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Proveedor"
WHERE nullif(trim("rubro"), '') IS NOT NULL
ON CONFLICT ("proveedorId", "rubro", "subrubro") DO NOTHING;

COMMIT;
