CREATE TABLE IF NOT EXISTS "RubroCatalogo" (
  "codigo" VARCHAR(2) PRIMARY KEY,
  "nombre" VARCHAR(100) NOT NULL UNIQUE,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "SubrubroCatalogo" (
  "codigo" VARCHAR(5) PRIMARY KEY,
  "codigoRubro" VARCHAR(2) NOT NULL,
  "nombre" VARCHAR(150) NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubrubroCatalogo_codigoRubro_nombre_key" UNIQUE ("codigoRubro", "nombre"),
  CONSTRAINT "SubrubroCatalogo_codigoRubro_fkey"
    FOREIGN KEY ("codigoRubro") REFERENCES "RubroCatalogo"("codigo")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "ProveedorRubro"
  ADD COLUMN IF NOT EXISTS "codigoRubro" VARCHAR(2),
  ADD COLUMN IF NOT EXISTS "codigoSubrubro" VARCHAR(5);

INSERT INTO "RubroCatalogo" ("codigo", "nombre") VALUES
  ('BA', 'BEBIDAS ALCOHOLICAS'),
  ('BF', 'BEBIDAS FRIAS'),
  ('BC', 'BEBIDAS CALIENTES'),
  ('DE', 'DESAYUNOS'),
  ('FL', 'FLORES'),
  ('PL', 'PLATOS A LA CARTA'),
  ('PO', 'POSTRES'),
  ('SN', 'SNACKS'),
  ('TO', 'TORTAS'),
  ('TR', 'TRANSPORTES')
ON CONFLICT ("codigo") DO UPDATE SET
  "nombre" = EXCLUDED."nombre",
  "activo" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "SubrubroCatalogo" ("codigo", "codigoRubro", "nombre") VALUES
  ('BA001', 'BA', 'CERVEZA'),
  ('BA002', 'BA', 'ESPUMANTES'),
  ('BA003', 'BA', 'LICORES Y DESTILADOS'),
  ('BA004', 'BA', 'VARIEDAD DE BEBIDAS ALCOHOLICAS'),
  ('BA005', 'BA', 'VINOS'),
  ('BF001', 'BF', 'BATIDOS Y SMOOTHIES'),
  ('BF002', 'BF', 'JUGOS Y LICUADOS'),
  ('BC001', 'BC', 'CAFE'),
  ('BC002', 'BC', 'TE E INFUSIONES'),
  ('DE001', 'DE', 'CAFE Y DESAYUNO'),
  ('DE002', 'DE', 'DESAYUNOS EN GENERAL'),
  ('DE003', 'DE', 'PANADERIA'),
  ('DE004', 'DE', 'PASTELERIA PARA DESAYUNO'),
  ('FL001', 'FL', 'ARREGLOS FLORALES'),
  ('FL002', 'FL', 'FLORES PARA EVENTOS'),
  ('FL003', 'FL', 'PLANTAS ORNAMENTALES'),
  ('FL004', 'FL', 'RAMOS'),
  ('FL005', 'FL', 'VIVEROS'),
  ('PL001', 'PL', 'CARNES Y PARRILLAS'),
  ('PL002', 'PL', 'CATERING PARA EVENTOS'),
  ('PL003', 'PL', 'COMIDA ARGENTINA'),
  ('PL004', 'PL', 'COMIDA MEXICANA'),
  ('PL005', 'PL', 'COMIDA RAPIDA'),
  ('PL006', 'PL', 'COMIDA VARIADA'),
  ('PL007', 'PL', 'EMPANADAS'),
  ('PL008', 'PL', 'HAMBURGUESAS'),
  ('PL009', 'PL', 'PASTAS'),
  ('PL010', 'PL', 'PIZZAS'),
  ('PL011', 'PL', 'POLLO'),
  ('PL012', 'PL', 'SANDWICHES'),
  ('PO001', 'PO', 'ALFAJORES'),
  ('PO002', 'PO', 'CHOCOLATES Y BOMBONES'),
  ('PO003', 'PO', 'CHURROS'),
  ('PO004', 'PO', 'DULCES Y CONFITERIA'),
  ('PO005', 'PO', 'HELADOS'),
  ('PO006', 'PO', 'PASTELERIA Y TORTAS'),
  ('PO007', 'PO', 'POSTRES'),
  ('PO008', 'PO', 'POSTRES TIPICOS'),
  ('PO009', 'PO', 'REPOSTERIA'),
  ('PO010', 'PO', 'WAFFLES Y CREPES'),
  ('SN001', 'SN', 'SNACKS'),
  ('SN002', 'SN', 'TABLAS Y PICADAS'),
  ('TO001', 'TO', 'COMPLEMENTOS PARA TORTAS'),
  ('TO002', 'TO', 'PANADERIA'),
  ('TO003', 'TO', 'PASTELES'),
  ('TO004', 'TO', 'REPOSTERIA'),
  ('TO005', 'TO', 'TORTAS'),
  ('TO006', 'TO', 'TORTAS PARA EVENTOS'),
  ('TO007', 'TO', 'TORTAS PERSONALIZADAS'),
  ('TR001', 'TR', 'COURIER'),
  ('TR002', 'TR', 'ENCOMIENDAS'),
  ('TR003', 'TR', 'LOGISTICA Y DISTRIBUCION'),
  ('TR004', 'TR', 'PAQUETERIA'),
  ('TR005', 'TR', 'TAXIS'),
  ('TR006', 'TR', 'TRANSPORTE DE CARGA')
ON CONFLICT ("codigo") DO UPDATE SET
  "codigoRubro" = EXCLUDED."codigoRubro",
  "nombre" = EXCLUDED."nombre",
  "activo" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

WITH argentina AS (
  SELECT p."id"
  FROM "Proveedor" p
  WHERE upper(trim(COALESCE(p."codigoPais", ''))) = 'AR'
     OR regexp_replace(
          translate(lower(trim(COALESCE(p."pais", ''))), 'áéíóúüñ', 'aeiouun'),
          '[^a-z0-9]+', '', 'g'
        ) IN ('argentina', 'republicaargentina')
), mapping ("rubroAnterior", "subrubro", "codigoRubro", "rubroNuevo", "codigoSubrubro") AS (
  VALUES
    ('BEBIDAS ALCOHOLICAS', 'CERVEZA', 'BA', 'BEBIDAS ALCOHOLICAS', 'BA001'),
    ('BEBIDAS ALCOHOLICAS', 'ESPUMANTES', 'BA', 'BEBIDAS ALCOHOLICAS', 'BA002'),
    ('BEBIDAS ALCOHOLICAS', 'LICORES Y DESTILADOS', 'BA', 'BEBIDAS ALCOHOLICAS', 'BA003'),
    ('BEBIDAS ALCOHOLICAS', 'VARIEDAD DE BEBIDAS ALCOHOLICAS', 'BA', 'BEBIDAS ALCOHOLICAS', 'BA004'),
    ('BEBIDAS ALCOHOLICAS', 'VINOS', 'BA', 'BEBIDAS ALCOHOLICAS', 'BA005'),
    ('BEBIDAS FRIAS Y CALIENTES', 'BATIDOS Y SMOOTHIES', 'BF', 'BEBIDAS FRIAS', 'BF001'),
    ('BEBIDAS FRIAS Y CALIENTES', 'JUGOS Y LICUADOS', 'BF', 'BEBIDAS FRIAS', 'BF002'),
    ('BEBIDAS FRIAS Y CALIENTES', 'CAFE', 'BC', 'BEBIDAS CALIENTES', 'BC001'),
    ('BEBIDAS FRIAS Y CALIENTES', 'TE E INFUSIONES', 'BC', 'BEBIDAS CALIENTES', 'BC002'),
    ('DESAYUNOS', 'CAFE Y DESAYUNO', 'DE', 'DESAYUNOS', 'DE001'),
    ('DESAYUNOS', 'DESAYUNOS EN GENERAL', 'DE', 'DESAYUNOS', 'DE002'),
    ('DESAYUNOS', 'PANADERIA', 'DE', 'DESAYUNOS', 'DE003'),
    ('DESAYUNOS', 'PASTELERIA PARA DESAYUNO', 'DE', 'DESAYUNOS', 'DE004'),
    ('FLORES', 'ARREGLOS FLORALES', 'FL', 'FLORES', 'FL001'),
    ('FLORES', 'FLORES PARA EVENTOS', 'FL', 'FLORES', 'FL002'),
    ('FLORES', 'PLANTAS ORNAMENTALES', 'FL', 'FLORES', 'FL003'),
    ('FLORES', 'RAMOS', 'FL', 'FLORES', 'FL004'),
    ('FLORES', 'VIVEROS', 'FL', 'FLORES', 'FL005'),
    ('PLATOS A LA CARTA', 'CARNES Y PARRILLAS', 'PL', 'PLATOS A LA CARTA', 'PL001'),
    ('PLATOS A LA CARTA', 'CATERING PARA EVENTOS', 'PL', 'PLATOS A LA CARTA', 'PL002'),
    ('PLATOS A LA CARTA', 'COMIDA ARGENTINA', 'PL', 'PLATOS A LA CARTA', 'PL003'),
    ('PLATOS A LA CARTA', 'COMIDA MEXICANA', 'PL', 'PLATOS A LA CARTA', 'PL004'),
    ('PLATOS A LA CARTA', 'COMIDA RAPIDA', 'PL', 'PLATOS A LA CARTA', 'PL005'),
    ('PLATOS A LA CARTA', 'COMIDA VARIADA', 'PL', 'PLATOS A LA CARTA', 'PL006'),
    ('PLATOS A LA CARTA', 'EMPANADAS', 'PL', 'PLATOS A LA CARTA', 'PL007'),
    ('PLATOS A LA CARTA', 'HAMBURGUESAS', 'PL', 'PLATOS A LA CARTA', 'PL008'),
    ('PLATOS A LA CARTA', 'PASTAS', 'PL', 'PLATOS A LA CARTA', 'PL009'),
    ('PLATOS A LA CARTA', 'PIZZAS', 'PL', 'PLATOS A LA CARTA', 'PL010'),
    ('PLATOS A LA CARTA', 'POLLO', 'PL', 'PLATOS A LA CARTA', 'PL011'),
    ('PLATOS A LA CARTA', 'SANDWICHES', 'PL', 'PLATOS A LA CARTA', 'PL012'),
    ('POSTRES Y SNACKS', 'ALFAJORES', 'PO', 'POSTRES', 'PO001'),
    ('POSTRES Y SNACKS', 'CHOCOLATES Y BOMBONES', 'PO', 'POSTRES', 'PO002'),
    ('POSTRES Y SNACKS', 'CHURROS', 'PO', 'POSTRES', 'PO003'),
    ('POSTRES Y SNACKS', 'DULCES Y CONFITERIA', 'PO', 'POSTRES', 'PO004'),
    ('POSTRES Y SNACKS', 'HELADOS', 'PO', 'POSTRES', 'PO005'),
    ('POSTRES Y SNACKS', 'PASTELERIA Y TORTAS', 'PO', 'POSTRES', 'PO006'),
    ('POSTRES Y SNACKS', 'POSTRES', 'PO', 'POSTRES', 'PO007'),
    ('POSTRES Y SNACKS', 'POSTRES TIPICOS', 'PO', 'POSTRES', 'PO008'),
    ('POSTRES Y SNACKS', 'REPOSTERIA', 'PO', 'POSTRES', 'PO009'),
    ('POSTRES Y SNACKS', 'WAFFLES Y CREPES', 'PO', 'POSTRES', 'PO010'),
    ('POSTRES Y SNACKS', 'SNACKS', 'SN', 'SNACKS', 'SN001'),
    ('POSTRES Y SNACKS', 'TABLAS Y PICADAS', 'SN', 'SNACKS', 'SN002'),
    ('TORTAS', 'COMPLEMENTOS PARA TORTAS', 'TO', 'TORTAS', 'TO001'),
    ('TORTAS', 'PANADERIA', 'TO', 'TORTAS', 'TO002'),
    ('TORTAS', 'PASTELES', 'TO', 'TORTAS', 'TO003'),
    ('TORTAS', 'REPOSTERIA', 'TO', 'TORTAS', 'TO004'),
    ('TORTAS', 'TORTAS', 'TO', 'TORTAS', 'TO005'),
    ('TORTAS', 'TORTAS PARA EVENTOS', 'TO', 'TORTAS', 'TO006'),
    ('TORTAS', 'TORTAS PERSONALIZADAS', 'TO', 'TORTAS', 'TO007'),
    ('TRANSPORTE, TAXIS, DELIVERY Y COURIER', 'COURIER', 'TR', 'TRANSPORTES', 'TR001'),
    ('TRANSPORTE, TAXIS, DELIVERY Y COURIER', 'ENCOMIENDAS', 'TR', 'TRANSPORTES', 'TR002'),
    ('TRANSPORTE, TAXIS, DELIVERY Y COURIER', 'LOGISTICA Y DISTRIBUCION', 'TR', 'TRANSPORTES', 'TR003'),
    ('TRANSPORTE, TAXIS, DELIVERY Y COURIER', 'PAQUETERIA', 'TR', 'TRANSPORTES', 'TR004'),
    ('TRANSPORTE, TAXIS, DELIVERY Y COURIER', 'TAXIS', 'TR', 'TRANSPORTES', 'TR005'),
    ('TRANSPORTE, TAXIS, DELIVERY Y COURIER', 'TRANSPORTE DE CARGA', 'TR', 'TRANSPORTES', 'TR006')
)
UPDATE "ProveedorRubro" pr
SET
  "codigoRubro" = m."codigoRubro",
  "codigoSubrubro" = m."codigoSubrubro",
  "rubro" = m."rubroNuevo",
  "updatedAt" = CURRENT_TIMESTAMP
FROM argentina a, mapping m
WHERE pr."proveedorId" = a."id"
  AND pr."rubro" = m."rubroAnterior"
  AND pr."subrubro" = m."subrubro";

WITH argentina AS (
  SELECT p."id"
  FROM "Proveedor" p
  WHERE upper(trim(COALESCE(p."codigoPais", ''))) = 'AR'
     OR regexp_replace(
          translate(lower(trim(COALESCE(p."pais", ''))), 'áéíóúüñ', 'aeiouun'),
          '[^a-z0-9]+', '', 'g'
        ) IN ('argentina', 'republicaargentina')
)
UPDATE "Proveedor" p
SET
  "rubro" = pr."rubro",
  "subrubro" = pr."subrubro",
  "productosComercializa" = pr."productosComercializa",
  "updatedAt" = CURRENT_TIMESTAMP
FROM argentina a, "ProveedorRubro" pr
WHERE p."id" = a."id"
  AND pr."proveedorId" = p."id"
  AND pr."esPrincipal";

WITH argentina AS (
  SELECT p.*
  FROM "Proveedor" p
  WHERE upper(trim(COALESCE(p."codigoPais", ''))) = 'AR'
     OR regexp_replace(
          translate(lower(trim(COALESCE(p."pais", ''))), 'áéíóúüñ', 'aeiouun'),
          '[^a-z0-9]+', '', 'g'
        ) IN ('argentina', 'republicaargentina')
), normalized AS (
  SELECT a."id",
    regexp_replace(
      translate(lower(trim(COALESCE(a."razonSocial", ''))), 'áéíóúüñ', 'aeiouun'),
      '[^a-z0-9]+', '', 'g'
    ) AS nombre_key,
    regexp_replace(
      translate(lower(trim(COALESCE(a."ciudad", ''))), 'áéíóúüñ', 'aeiouun'),
      '[^a-z0-9]+', '', 'g'
    ) AS ciudad_key
  FROM argentina a
), identity_groups AS (
  SELECT nombre_key, ciudad_key
  FROM normalized
  WHERE nombre_key <> '' AND ciudad_key <> ''
  GROUP BY nombre_key, ciudad_key HAVING count(*) > 1
), identity_candidates AS (
  SELECT n."id"
  FROM normalized n JOIN identity_groups g USING (nombre_key, ciudad_key)
), contacts AS (
  SELECT "id" AS "proveedorId", 'N:' || regexp_replace("telefono", '[^0-9]+', '', 'g') AS contacto
  FROM argentina WHERE length(regexp_replace(COALESCE("telefono", ''), '[^0-9]+', '', 'g')) >= 7
  UNION
  SELECT "id", 'N:' || regexp_replace("whatsapp", '[^0-9]+', '', 'g')
  FROM argentina WHERE length(regexp_replace(COALESCE("whatsapp", ''), '[^0-9]+', '', 'g')) >= 7
  UNION
  SELECT "id", 'E:' || lower(trim("email"))
  FROM argentina WHERE NULLIF(lower(trim(COALESCE("email", ''))), '') IS NOT NULL
), contact_groups AS (
  SELECT contacto FROM contacts GROUP BY contacto
  HAVING count(DISTINCT "proveedorId") > 1
), contact_candidates AS (
  SELECT DISTINCT c."proveedorId" AS "id"
  FROM contacts c JOIN contact_groups g ON g.contacto = c.contacto
), candidates AS (
  SELECT "id" FROM identity_candidates
  UNION
  SELECT "id" FROM contact_candidates
)
UPDATE "Proveedor" p
SET
  "evidenciaVerificacion" = jsonb_set(
    COALESCE(p."evidenciaVerificacion", '{}'::jsonb),
    '{revisionDuplicidad}',
    jsonb_build_object(
      'estado', 'POSSIBLE_DUPLICATE',
      'fuente', 'AUDITORIA_ARGENTINA_2026-10-02',
      'criterio', 'nombre y ciudad o contacto compartido',
      'accion', 'REQUIERE_REVISION_MANUAL; no fusionado ni eliminado'
    ),
    true
  ),
  "updatedAt" = CURRENT_TIMESTAMP
FROM candidates c
WHERE p."id" = c."id";

UPDATE "Proveedor" p
SET
  "activo" = false,
  "estadoVerificacion" = 'NV',
  "comentarios" = CASE
    WHEN COALESCE(p."comentarios", '') ILIKE '%AUDITORIA ARGENTINA 2026-10-02%'
      THEN p."comentarios"
    ELSE concat_ws(E'\n', NULLIF(p."comentarios", ''),
      'AUDITORIA ARGENTINA 2026-10-02: desactivado temporalmente; sin fuente, productos, rubro ni subrubro. Requiere investigación.')
  END,
  "evidenciaVerificacion" = jsonb_set(
    COALESCE(p."evidenciaVerificacion", '{}'::jsonb),
    '{auditoriaClasificacion}',
    jsonb_build_object(
      'estado', 'PENDIENTE_INFORMACION',
      'fuente', 'AUDITORIA_ARGENTINA_2026-10-02',
      'accion', 'DESACTIVADO_SIN_ELIMINAR'
    ),
    true
  ),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE p."codigoProveedor" IN ('AR00000258', 'AR00000379')
  AND NOT EXISTS (
    SELECT 1 FROM "ProveedorRubro" pr WHERE pr."proveedorId" = p."id"
  )
  AND NULLIF(trim(COALESCE(p."fuenteVerificacion", '')), '') IS NULL
  AND NULLIF(trim(COALESCE(p."productosComercializa", '')), '') IS NULL;

CREATE INDEX IF NOT EXISTS "SubrubroCatalogo_codigoRubro_idx"
  ON "SubrubroCatalogo"("codigoRubro");
CREATE INDEX IF NOT EXISTS "ProveedorRubro_codigoRubro_idx"
  ON "ProveedorRubro"("codigoRubro");
CREATE INDEX IF NOT EXISTS "ProveedorRubro_codigoSubrubro_idx"
  ON "ProveedorRubro"("codigoSubrubro");

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ProveedorRubro_codigoRubro_fkey'
  ) THEN
    ALTER TABLE "ProveedorRubro"
      ADD CONSTRAINT "ProveedorRubro_codigoRubro_fkey"
      FOREIGN KEY ("codigoRubro") REFERENCES "RubroCatalogo"("codigo")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ProveedorRubro_codigoSubrubro_fkey'
  ) THEN
    ALTER TABLE "ProveedorRubro"
      ADD CONSTRAINT "ProveedorRubro_codigoSubrubro_fkey"
      FOREIGN KEY ("codigoSubrubro") REFERENCES "SubrubroCatalogo"("codigo")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ProveedorRubro_codigos_coherentes_check'
  ) THEN
    ALTER TABLE "ProveedorRubro"
      ADD CONSTRAINT "ProveedorRubro_codigos_coherentes_check"
      CHECK (
        "codigoSubrubro" IS NULL
        OR ("codigoRubro" IS NOT NULL AND left("codigoSubrubro", 2) = "codigoRubro")
      );
  END IF;
END
$constraints$;
