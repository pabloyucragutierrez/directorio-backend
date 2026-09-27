-- Campos para codificación automática, verificación y trazabilidad de la captación.
-- Todos los cambios son aditivos para conservar los proveedores existentes.
BEGIN;

ALTER TABLE "Proveedor"
ADD COLUMN "codigoProveedor" VARCHAR(10),
ADD COLUMN "codigoPais" VARCHAR(2),
ADD COLUMN "productosComercializa" TEXT,
ADD COLUMN "personaContacto" VARCHAR(255),
ADD COLUMN "website" TEXT,
ADD COLUMN "redesSociales" TEXT,
ADD COLUMN "estadoVerificacion" VARCHAR(2) NOT NULL DEFAULT 'NV',
ADD COLUMN "fechaVerificacion" TIMESTAMPTZ(3),
ADD COLUMN "fuenteVerificacion" TEXT,
ADD COLUMN "fechaDiscovery" DATE,
ADD COLUMN "evidenciaVerificacion" JSONB;

CREATE TABLE "SecuenciaProveedorPais" (
  "codigoPais" VARCHAR(2) NOT NULL,
  "ultimoNumero" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecuenciaProveedorPais_pkey" PRIMARY KEY ("codigoPais"),
  CONSTRAINT "SecuenciaProveedorPais_ultimoNumero_check"
    CHECK ("ultimoNumero" BETWEEN 0 AND 99999999)
);

-- Identifica el país de los registros actuales antes de asignarles un correlativo.
UPDATE "Proveedor"
SET "codigoPais" = CASE
  WHEN upper(trim("pais")) ~ '^[A-Z]{2}$' THEN upper(trim("pais"))
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('peru') THEN 'PE'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('argentina') THEN 'AR'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('bolivia') THEN 'BO'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('brasil', 'brazil') THEN 'BR'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('chile') THEN 'CL'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('colombia') THEN 'CO'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('costa rica') THEN 'CR'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('cuba') THEN 'CU'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('ecuador') THEN 'EC'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('el salvador') THEN 'SV'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('guatemala') THEN 'GT'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('haiti') THEN 'HT'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('honduras') THEN 'HN'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('mexico') THEN 'MX'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('nicaragua') THEN 'NI'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('panama') THEN 'PA'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('paraguay') THEN 'PY'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('puerto rico') THEN 'PR'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('republica dominicana') THEN 'DO'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('uruguay') THEN 'UY'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('venezuela') THEN 'VE'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('estados unidos', 'estados unidos de america', 'united states', 'usa', 'eeuu', 'ee uu') THEN 'US'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('canada') THEN 'CA'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('espana', 'spain') THEN 'ES'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('portugal') THEN 'PT'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('francia', 'france') THEN 'FR'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('alemania', 'germany') THEN 'DE'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('italia', 'italy') THEN 'IT'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('reino unido', 'united kingdom', 'gran bretana', 'uk') THEN 'GB'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('paises bajos', 'netherlands', 'holanda') THEN 'NL'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('belgica', 'belgium') THEN 'BE'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('suiza', 'switzerland') THEN 'CH'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('china') THEN 'CN'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('japon', 'japan') THEN 'JP'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('corea del sur', 'south korea') THEN 'KR'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('india') THEN 'IN'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('turquia', 'turkey', 'turkiye') THEN 'TR'
  WHEN translate(lower(trim("pais")), 'áéíóúüñãõç', 'aeiouunaoc') IN ('australia') THEN 'AU'
  ELSE NULL
END;

-- Los registros cuyo país pudo identificarse reciben código en orden de creación.
WITH numerados AS (
  SELECT
    "id",
    "codigoPais",
    row_number() OVER (PARTITION BY "codigoPais" ORDER BY "id") AS correlativo
  FROM "Proveedor"
  WHERE "codigoPais" IS NOT NULL
)
UPDATE "Proveedor" AS proveedor
SET "codigoProveedor" =
  numerados."codigoPais" || lpad(numerados.correlativo::text, 8, '0')
FROM numerados
WHERE proveedor."id" = numerados."id";

-- La secuencia empieza después del último código asignado durante el respaldo.
INSERT INTO "SecuenciaProveedorPais" (
  "codigoPais",
  "ultimoNumero",
  "createdAt",
  "updatedAt"
)
SELECT
  "codigoPais",
  max(substring("codigoProveedor" from 3)::integer),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Proveedor"
WHERE "codigoProveedor" IS NOT NULL
GROUP BY "codigoPais";

CREATE UNIQUE INDEX "Proveedor_codigoProveedor_key"
ON "Proveedor"("codigoProveedor");

ALTER TABLE "Proveedor"
ADD CONSTRAINT "Proveedor_codigoProveedor_formato_check"
  CHECK ("codigoProveedor" IS NULL OR "codigoProveedor" ~ '^[A-Z]{2}[0-9]{8}$'),
ADD CONSTRAINT "Proveedor_codigoPais_formato_check"
  CHECK ("codigoPais" IS NULL OR "codigoPais" ~ '^[A-Z]{2}$'),
ADD CONSTRAINT "Proveedor_estadoVerificacion_check"
  CHECK ("estadoVerificacion" IN ('VE', 'NV', 'NF', 'IN'));

COMMIT;
