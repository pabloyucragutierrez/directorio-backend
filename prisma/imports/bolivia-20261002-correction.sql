INSERT INTO "SubrubroCatalogo" ("codigo", "codigoRubro", "nombre") VALUES
  ('BA006', 'BA', 'SINGANI'),
  ('BF003', 'BF', 'AGUA'),
  ('BF004', 'BF', 'BEBIDAS ENERGETICAS'),
  ('BF005', 'BF', 'GASEOSAS Y REFRESCOS'),
  ('DE005', 'DE', 'DESAYUNOS TIPICOS'),
  ('DE006', 'DE', 'SALTEÑAS'),
  ('DE007', 'DE', 'BRUNCH')
ON CONFLICT ("codigo") DO UPDATE SET
  "codigoRubro" = EXCLUDED."codigoRubro",
  "nombre" = EXCLUDED."nombre",
  "activo" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

-- STATEMENT_BREAK
WITH bolivia AS (
  SELECT p."id"
  FROM "Proveedor" p
  WHERE upper(trim(COALESCE(p."codigoPais", ''))) = 'BO'
     OR regexp_replace(
          translate(lower(trim(COALESCE(p."pais", ''))), 'áéíóúüñ', 'aeiouun'),
          '[^a-z0-9]+', '', 'g'
        ) IN ('bolivia', 'estadoplurinacionaldebolivia')
), mapping (
  "rubroAnterior",
  "subrubroAnterior",
  "codigoRubro",
  "rubroNuevo",
  "codigoSubrubro",
  "subrubroNuevo"
) AS (
  VALUES
    ('BEBIDAS ALCOHOLICAS', 'CERVEZA', 'BA', 'BEBIDAS ALCOHOLICAS', 'BA001', 'CERVEZA'),
    ('BEBIDAS ALCOHOLICAS', 'LICORES Y DESTILADOS', 'BA', 'BEBIDAS ALCOHOLICAS', 'BA003', 'LICORES Y DESTILADOS'),
    ('BEBIDAS ALCOHOLICAS', 'VARIEDAD DE BEBIDAS ALCOHOLICAS', 'BA', 'BEBIDAS ALCOHOLICAS', 'BA004', 'VARIEDAD DE BEBIDAS ALCOHOLICAS'),
    ('BEBIDAS ALCOHOLICAS', 'VINOS', 'BA', 'BEBIDAS ALCOHOLICAS', 'BA005', 'VINOS'),
    ('BEBIDAS ALCOHOLICAS', 'SINGANI', 'BA', 'BEBIDAS ALCOHOLICAS', 'BA006', 'SINGANI'),
    ('BEBIDAS FRIAS Y CALIENTES', 'BATIDOS Y SMOOTHIES', 'BF', 'BEBIDAS FRIAS', 'BF001', 'BATIDOS Y SMOOTHIES'),
    ('BEBIDAS FRIAS Y CALIENTES', 'JUGOS Y LICUADOS', 'BF', 'BEBIDAS FRIAS', 'BF002', 'JUGOS Y LICUADOS'),
    ('BEBIDAS FRIAS Y CALIENTES', 'AGUA', 'BF', 'BEBIDAS FRIAS', 'BF003', 'AGUA'),
    ('BEBIDAS FRIAS Y CALIENTES', 'BEBIDAS ENERGETICAS', 'BF', 'BEBIDAS FRIAS', 'BF004', 'BEBIDAS ENERGETICAS'),
    ('BEBIDAS FRIAS Y CALIENTES', 'GASEOSAS Y REFRESCOS', 'BF', 'BEBIDAS FRIAS', 'BF005', 'GASEOSAS Y REFRESCOS'),
    ('BEBIDAS FRIAS Y CALIENTES', 'CAFE', 'BC', 'BEBIDAS CALIENTES', 'BC001', 'CAFE'),
    ('BEBIDAS FRIAS Y CALIENTES', 'TE E INFUSIONES', 'BC', 'BEBIDAS CALIENTES', 'BC002', 'TE E INFUSIONES'),
    ('DESAYUNOS', 'CAFE Y DESAYUNO', 'DE', 'DESAYUNOS', 'DE001', 'CAFE Y DESAYUNO'),
    ('DESAYUNOS', 'DESAYUNOS EN GENERAL', 'DE', 'DESAYUNOS', 'DE002', 'DESAYUNOS EN GENERAL'),
    ('DESAYUNOS', 'PANADERIA', 'DE', 'DESAYUNOS', 'DE003', 'PANADERIA'),
    ('DESAYUNOS', 'PASTELERIA PARA DESAYUNO', 'DE', 'DESAYUNOS', 'DE004', 'PASTELERIA PARA DESAYUNO'),
    ('DESAYUNOS', 'DESAYUNOS TIPICOS', 'DE', 'DESAYUNOS', 'DE005', 'DESAYUNOS TIPICOS'),
    ('DESAYUNOS', 'SALTENAS', 'DE', 'DESAYUNOS', 'DE006', 'SALTEÑAS'),
    ('DESAYUNOS', 'BRUNCH', 'DE', 'DESAYUNOS', 'DE007', 'BRUNCH'),
    ('FLORES', 'FLORES PARA EVENTOS', 'FL', 'FLORES', 'FL002', 'FLORES PARA EVENTOS'),
    ('PLATOS A LA CARTA', 'COMIDA VARIADA', 'PL', 'PLATOS A LA CARTA', 'PL006', 'COMIDA VARIADA'),
    ('POSTRES Y SNACKS', 'POSTRES', 'PO', 'POSTRES', 'PO007', 'POSTRES'),
    ('TORTAS', 'PANADERIA', 'TO', 'TORTAS', 'TO002', 'PANADERIA'),
    ('TORTAS', 'PASTELES', 'TO', 'TORTAS', 'TO003', 'PASTELES'),
    ('TORTAS', 'TORTAS', 'TO', 'TORTAS', 'TO005', 'TORTAS')
)
UPDATE "ProveedorRubro" pr
SET
  "codigoRubro" = m."codigoRubro",
  "codigoSubrubro" = m."codigoSubrubro",
  "rubro" = m."rubroNuevo",
  "subrubro" = m."subrubroNuevo",
  "updatedAt" = CURRENT_TIMESTAMP
FROM bolivia b, mapping m
WHERE pr."proveedorId" = b."id"
  AND upper(trim(pr."rubro")) = m."rubroAnterior"
  AND upper(trim(pr."subrubro")) = m."subrubroAnterior";

-- STATEMENT_BREAK
WITH bolivia AS (
  SELECT p."id"
  FROM "Proveedor" p
  WHERE upper(trim(COALESCE(p."codigoPais", ''))) = 'BO'
     OR regexp_replace(
          translate(lower(trim(COALESCE(p."pais", ''))), 'áéíóúüñ', 'aeiouun'),
          '[^a-z0-9]+', '', 'g'
        ) IN ('bolivia', 'estadoplurinacionaldebolivia')
)
UPDATE "Proveedor" p
SET
  "rubro" = pr."rubro",
  "subrubro" = pr."subrubro",
  "productosComercializa" = pr."productosComercializa",
  "updatedAt" = CURRENT_TIMESTAMP
FROM bolivia b, "ProveedorRubro" pr
WHERE p."id" = b."id"
  AND pr."proveedorId" = p."id"
  AND pr."esPrincipal";

-- STATEMENT_BREAK
UPDATE "Proveedor" p
SET
  "evidenciaVerificacion" = jsonb_set(
    COALESCE(p."evidenciaVerificacion", '{}'::jsonb),
    '{revisionDuplicidad}',
    jsonb_build_object(
      'estado', 'POSSIBLE_DUPLICATE',
      'fuente', 'AUDITORIA_BOLIVIA_2026-10-02',
      'criterio', 'nombre y ciudad y contacto compartido',
      'accion', 'REQUIERE_REVISION_MANUAL; no fusionado ni eliminado'
    ),
    true
  ),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE p."codigoProveedor" IN (
  'BO00000004',
  'BO00000014',
  'BO00000063',
  'BO00000065'
);

-- STATEMENT_BREAK
UPDATE "Proveedor" p
SET
  "activo" = false,
  "estadoVerificacion" = 'NV',
  "comentarios" = CASE
    WHEN COALESCE(p."comentarios", '') ILIKE '%AUDITORIA BOLIVIA 2026-10-02%'
      THEN p."comentarios"
    ELSE concat_ws(E'\n', NULLIF(p."comentarios", ''),
      'AUDITORIA BOLIVIA 2026-10-02: desactivado temporalmente; sin fuente, productos, rubro ni subrubro. Requiere investigación.')
  END,
  "evidenciaVerificacion" = jsonb_set(
    COALESCE(p."evidenciaVerificacion", '{}'::jsonb),
    '{auditoriaClasificacion}',
    jsonb_build_object(
      'estado', 'PENDIENTE_INFORMACION',
      'fuente', 'AUDITORIA_BOLIVIA_2026-10-02',
      'accion', 'DESACTIVADO_SIN_ELIMINAR'
    ),
    true
  ),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE p."codigoProveedor" IN (
  'BO00000016',
  'BO00000017',
  'BO00000018',
  'BO00000019',
  'BO00000021',
  'BO00000029',
  'BO00000031',
  'BO00000043',
  'BO00000045',
  'BO00000048',
  'BO00000060',
  'BO00000070',
  'BO00000075',
  'BO00000082',
  'BO00000088',
  'BO00000108',
  'BO00000131',
  'BO00000140'
)
  AND NOT EXISTS (
    SELECT 1 FROM "ProveedorRubro" pr WHERE pr."proveedorId" = p."id"
  )
  AND NULLIF(trim(COALESCE(p."fuenteVerificacion", '')), '') IS NULL
  AND NULLIF(trim(COALESCE(p."productosComercializa", '')), '') IS NULL;
