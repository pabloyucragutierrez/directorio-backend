import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ARGENTINA_SCOPE = `
  WITH argentina AS (
    SELECT p.*
    FROM "Proveedor" p
    WHERE upper(trim(COALESCE(p."codigoPais", ''))) = 'AR'
       OR regexp_replace(
            translate(lower(trim(COALESCE(p."pais", ''))), 'áéíóúüñ', 'aeiouun'),
            '[^a-z0-9]+', '', 'g'
          ) IN ('argentina', 'republicaargentina')
  )
`;

const OFFICIAL_TAXONOMY = `
  'BEBIDAS ALCOHOLICAS',
  'BEBIDAS FRIAS Y CALIENTES',
  'DESAYUNOS',
  'FLORES',
  'PLATOS A LA CARTA',
  'POSTRES Y SNACKS',
  'TORTAS',
  'TRANSPORTE, TAXIS, DELIVERY Y COURIER'
`;

function emit(label: string, value: unknown): void {
  const serialized = JSON.stringify(value, (_key, item: unknown) =>
    typeof item === 'bigint' ? item.toString() : item,
  );
  console.log(`ARGENTINA_AUDIT_${label}=${serialized}`);
}

async function one(
  tx: Prisma.TransactionClient,
  label: string,
  sql: string,
): Promise<void> {
  const rows = await tx.$queryRawUnsafe<Array<{ result: unknown }>>(sql);
  emit(label, rows[0]?.result ?? null);
}

async function many(
  tx: Prisma.TransactionClient,
  label: string,
  sql: string,
): Promise<void> {
  const rows = await tx.$queryRawUnsafe<Record<string, unknown>[]>(sql);
  emit(label, rows);
}

async function audit(tx: Prisma.TransactionClient): Promise<void> {
  const readOnly = await tx.$queryRawUnsafe<Array<{ readOnly: string }>>(
    `SELECT current_setting('transaction_read_only') AS "readOnly"`,
  );
  emit('MODE', {
    country: 'Argentina',
    countryCode: 'AR',
    readOnly: readOnly[0]?.readOnly,
    generatedAt: new Date().toISOString(),
  });

  await one(
    tx,
    'SCHEMA',
    `
      SELECT jsonb_build_object(
        'codigoProveedor', EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'Proveedor'
            AND column_name = 'codigoProveedor'
        ),
        'codigoPais', EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'Proveedor'
            AND column_name = 'codigoPais'
        ),
        'codigoRubro', EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name IN ('Proveedor', 'ProveedorRubro')
            AND lower(column_name) IN ('codigorubro', 'codigocategoria')
        ),
        'codigoSubrubro', EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name IN ('Proveedor', 'ProveedorRubro')
            AND lower(column_name) IN ('codigosubrubro', 'codigosubcategoria')
        ),
        'matchingColumns', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('table', table_name, 'column', column_name)
                           ORDER BY table_name, ordinal_position)
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name IN ('Proveedor', 'ProveedorRubro')
            AND lower(column_name) IN (
              'codigoproveedor', 'codigopais', 'codigorubro', 'codigocategoria',
              'codigosubrubro', 'codigosubcategoria'
            )
        ), '[]'::jsonb)
      ) AS result
    `,
  );

  await one(
    tx,
    'SUMMARY',
    `
      ${ARGENTINA_SCOPE},
      states AS (
        SELECT COALESCE(NULLIF(trim("estadoVerificacion"), ''), '<VACIO>') AS estado,
               count(*)::int AS cantidad
        FROM argentina
        GROUP BY 1
      )
      SELECT jsonb_build_object(
        'totalProveedores', (SELECT count(*)::int FROM argentina),
        'activos', (SELECT count(*)::int FROM argentina WHERE "activo"),
        'inactivos', (SELECT count(*)::int FROM argentina WHERE NOT "activo"),
        'estados', COALESCE((SELECT jsonb_object_agg(estado, cantidad) FROM states), '{}'::jsonb),
        'razonSocialVacia', (SELECT count(*)::int FROM argentina
          WHERE NULLIF(trim("razonSocial"), '') IS NULL),
        'ciudadVacia', (SELECT count(*)::int FROM argentina
          WHERE NULLIF(trim("ciudad"), '') IS NULL),
        'productosVacios', (SELECT count(*)::int FROM argentina a
          WHERE NULLIF(trim(COALESCE(a."productosComercializa", '')), '') IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM "ProveedorRubro" pr
              WHERE pr."proveedorId" = a."id"
                AND NULLIF(trim(COALESCE(pr."productosComercializa", '')), '') IS NOT NULL
            )),
        'fuenteVacia', (SELECT count(*)::int FROM argentina a
          WHERE NULLIF(trim(COALESCE(a."fuenteVerificacion", '')), '') IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM "ProveedorRubro" pr
              WHERE pr."proveedorId" = a."id"
                AND NULLIF(trim(COALESCE(pr."fuenteVerificacion", '')), '') IS NOT NULL
            )),
        'sinContacto', (SELECT count(*)::int FROM argentina
          WHERE NULLIF(trim(COALESCE("telefono", '')), '') IS NULL
            AND NULLIF(trim(COALESCE("whatsapp", '')), '') IS NULL
            AND NULLIF(trim(COALESCE("email", '')), '') IS NULL),
        'veSinContacto', (SELECT count(*)::int FROM argentina
          WHERE "estadoVerificacion" = 'VE'
            AND NULLIF(trim(COALESCE("telefono", '')), '') IS NULL
            AND NULLIF(trim(COALESCE("whatsapp", '')), '') IS NULL
            AND NULLIF(trim(COALESCE("email", '')), '') IS NULL),
        'veSinFuente', (SELECT count(*)::int FROM argentina a
          WHERE a."estadoVerificacion" = 'VE'
            AND NULLIF(trim(COALESCE(a."fuenteVerificacion", '')), '') IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM "ProveedorRubro" pr
              WHERE pr."proveedorId" = a."id"
                AND NULLIF(trim(COALESCE(pr."fuenteVerificacion", '')), '') IS NOT NULL
            )),
        'veConDuplicidadPendiente', (SELECT count(*)::int FROM argentina
          WHERE "estadoVerificacion" = 'VE'
            AND COALESCE("evidenciaVerificacion"::text, '') ILIKE '%POSSIBLE_DUPLICATE%'),
        'posiblesDuplicadosMarcados', (SELECT count(*)::int FROM argentina
          WHERE COALESCE("evidenciaVerificacion"::text, '') ILIKE '%POSSIBLE_DUPLICATE%'),
        'estadoInvalido', (SELECT count(*)::int FROM argentina
          WHERE "estadoVerificacion" NOT IN ('VE', 'NV'))
      ) AS result
    `,
  );

  await one(
    tx,
    'CODES',
    `
      ${ARGENTINA_SCOPE},
      duplicate_codes AS (
        SELECT trim("codigoProveedor") AS codigo, count(*)::int AS cantidad
        FROM argentina
        WHERE NULLIF(trim(COALESCE("codigoProveedor", '')), '') IS NOT NULL
        GROUP BY 1 HAVING count(*) > 1
      )
      SELECT jsonb_build_object(
        'sinCodigo', (SELECT count(*)::int FROM argentina
          WHERE NULLIF(trim(COALESCE("codigoProveedor", '')), '') IS NULL),
        'codigosDistintos', (SELECT count(DISTINCT trim("codigoProveedor"))::int FROM argentina
          WHERE NULLIF(trim(COALESCE("codigoProveedor", '')), '') IS NOT NULL),
        'formatoAR8', (SELECT count(*)::int FROM argentina
          WHERE trim("codigoProveedor") ~ '^AR[0-9]{8}$'),
        'formatoAR5', (SELECT count(*)::int FROM argentina
          WHERE trim("codigoProveedor") ~ '^AR[0-9]{5}$'),
        'otroFormato', (SELECT count(*)::int FROM argentina
          WHERE NULLIF(trim(COALESCE("codigoProveedor", '')), '') IS NOT NULL
            AND trim("codigoProveedor") !~ '^AR[0-9]{8}$'
            AND trim("codigoProveedor") !~ '^AR[0-9]{5}$'),
        'prefijoNoAR', (SELECT count(*)::int FROM argentina
          WHERE NULLIF(trim(COALESCE("codigoProveedor", '')), '') IS NOT NULL
            AND trim("codigoProveedor") !~ '^AR'),
        'gruposCodigoDuplicado', (SELECT count(*)::int FROM duplicate_codes),
        'registrosCodigoDuplicado', (SELECT COALESCE(sum(cantidad), 0)::int FROM duplicate_codes),
        'codigoMinimo', (SELECT min(trim("codigoProveedor")) FROM argentina
          WHERE trim("codigoProveedor") ~ '^AR[0-9]+$'),
        'codigoMaximo', (SELECT max(trim("codigoProveedor")) FROM argentina
          WHERE trim("codigoProveedor") ~ '^AR[0-9]+$'),
        'maximoNumericoAR8', (SELECT max(substring(trim("codigoProveedor") FROM 3)::bigint)
          FROM argentina WHERE trim("codigoProveedor") ~ '^AR[0-9]{8}$'),
        'maximoNumericoAR5', (SELECT max(substring(trim("codigoProveedor") FROM 3)::bigint)
          FROM argentina WHERE trim("codigoProveedor") ~ '^AR[0-9]{5}$'),
        'codigoPaisVacio', (SELECT count(*)::int FROM argentina
          WHERE NULLIF(trim(COALESCE("codigoPais", '')), '') IS NULL),
        'codigoPaisNoAR', (SELECT count(*)::int FROM argentina
          WHERE upper(trim(COALESCE("codigoPais", ''))) <> 'AR'),
        'paisNoArgentina', (SELECT count(*)::int FROM argentina
          WHERE regexp_replace(
            translate(lower(trim(COALESCE("pais", ''))), 'áéíóúüñ', 'aeiouun'),
            '[^a-z0-9]+', '', 'g'
          ) NOT IN ('argentina', 'republicaargentina'))
      ) AS result
    `,
  );

  await one(
    tx,
    'SEQUENCE',
    `
      ${ARGENTINA_SCOPE}
      SELECT jsonb_build_object(
        'secuenciaExiste', EXISTS (
          SELECT 1 FROM "SecuenciaProveedorPais" WHERE "codigoPais" = 'AR'
        ),
        'ultimoNumero', (SELECT "ultimoNumero" FROM "SecuenciaProveedorPais"
          WHERE "codigoPais" = 'AR'),
        'maximoCodigoAR8', (SELECT max(substring(trim("codigoProveedor") FROM 3)::bigint)
          FROM argentina WHERE trim("codigoProveedor") ~ '^AR[0-9]{8}$'),
        'maximoCodigoAR5', (SELECT max(substring(trim("codigoProveedor") FROM 3)::bigint)
          FROM argentina WHERE trim("codigoProveedor") ~ '^AR[0-9]{5}$')
      ) AS result
    `,
  );

  await one(
    tx,
    'RELATIONS',
    `
      ${ARGENTINA_SCOPE},
      rel AS (
        SELECT pr.* FROM "ProveedorRubro" pr
        JOIN argentina a ON a."id" = pr."proveedorId"
      ),
      principal_counts AS (
        SELECT a."id", count(*) FILTER (WHERE r."esPrincipal")::int AS principales
        FROM argentina a LEFT JOIN rel r ON r."proveedorId" = a."id"
        GROUP BY a."id"
      )
      SELECT jsonb_build_object(
        'relaciones', (SELECT count(*)::int FROM rel),
        'proveedoresSinRelacion', (SELECT count(*)::int FROM argentina a
          WHERE NOT EXISTS (SELECT 1 FROM rel r WHERE r."proveedorId" = a."id")),
        'proveedoresSinPrincipal', (SELECT count(*)::int FROM principal_counts WHERE principales = 0),
        'proveedoresMultiplesPrincipales', (SELECT count(*)::int FROM principal_counts WHERE principales > 1),
        'proveedoresMultirubro', (SELECT count(*)::int FROM (
          SELECT "proveedorId" FROM rel GROUP BY "proveedorId"
          HAVING count(DISTINCT "rubro") > 1
        ) x),
        'proveedoresMultiAsociacion', (SELECT count(*)::int FROM (
          SELECT "proveedorId" FROM rel GROUP BY "proveedorId" HAVING count(*) > 1
        ) x),
        'rubroVacio', (SELECT count(*)::int FROM rel
          WHERE NULLIF(trim(COALESCE("rubro", '')), '') IS NULL),
        'subrubroVacio', (SELECT count(*)::int FROM rel
          WHERE NULLIF(trim(COALESCE("subrubro", '')), '') IS NULL),
        'productosVacios', (SELECT count(*)::int FROM rel
          WHERE NULLIF(trim(COALESCE("productosComercializa", '')), '') IS NULL),
        'fuenteVacia', (SELECT count(*)::int FROM rel
          WHERE NULLIF(trim(COALESCE("fuenteVerificacion", '')), '') IS NULL),
        'taxonomiaInvalida', (SELECT count(*)::int FROM rel
          WHERE "rubro" NOT IN (${OFFICIAL_TAXONOMY}))
      ) AS result
    `,
  );

  await many(
    tx,
    'RUBROS',
    `
      ${ARGENTINA_SCOPE},
      rel AS (
        SELECT pr.* FROM "ProveedorRubro" pr
        JOIN argentina a ON a."id" = pr."proveedorId"
      )
      SELECT
        COALESCE(NULLIF(trim("rubro"), ''), '<VACIO>') AS "rubro",
        count(*)::int AS "relaciones",
        count(DISTINCT "proveedorId")::int AS "proveedores",
        count(*) FILTER (WHERE "esPrincipal")::int AS "principales",
        count(*) FILTER (WHERE NULLIF(trim(COALESCE("subrubro", '')), '') IS NULL)::int
          AS "subrubroVacio",
        count(*) FILTER (WHERE NULLIF(trim(COALESCE("productosComercializa", '')), '') IS NULL)::int
          AS "productosVacios"
      FROM rel
      GROUP BY 1
      ORDER BY 1
    `,
  );

  await many(
    tx,
    'SUBRUBROS_BEBIDAS',
    `
      ${ARGENTINA_SCOPE}
      SELECT
        COALESCE(NULLIF(trim(pr."subrubro"), ''), '<VACIO>') AS "subrubro",
        count(*)::int AS "relaciones",
        count(DISTINCT pr."proveedorId")::int AS "proveedores"
      FROM "ProveedorRubro" pr
      JOIN argentina a ON a."id" = pr."proveedorId"
      WHERE pr."rubro" = 'BEBIDAS FRIAS Y CALIENTES'
      GROUP BY 1
      ORDER BY count(*) DESC, 1
      LIMIT 200
    `,
  );

  await one(
    tx,
    'SPLIT_BEBIDAS',
    `
      ${ARGENTINA_SCOPE},
      signals AS (
        SELECT pr."id", pr."proveedorId",
          lower(translate(
            COALESCE(pr."subrubro", '') || ' ' || COALESCE(pr."productosComercializa", ''),
            'áéíóúüñ', 'aeiouun'
          )) AS texto
        FROM "ProveedorRubro" pr
        JOIN argentina a ON a."id" = pr."proveedorId"
        WHERE pr."rubro" = 'BEBIDAS FRIAS Y CALIENTES'
      ), flags AS (
        SELECT *,
          texto ~ '(cafe|cafeter|espresso|capuccino|cappuccino|latte|chocolate caliente|infusion|mate|submarino|(^|[^a-z])te([^a-z]|$))' AS caliente,
          texto ~ '(jugo|zumo|gaseosa|refresco|agua|limonada|licuado|smoothie|milkshake|bebida fria|soda)' AS fria
        FROM signals
      ), classified AS (
        SELECT *, CASE
          WHEN caliente AND fria THEN 'MIXTO_REQUIERE_REVISION'
          WHEN caliente THEN 'BC_SUGERIDO'
          WHEN fria THEN 'BF_SUGERIDO'
          ELSE 'SIN_CLASIFICAR'
        END AS clasificacion
        FROM flags
      )
      SELECT COALESCE(jsonb_object_agg(clasificacion, cantidad), '{}'::jsonb) AS result
      FROM (
        SELECT clasificacion, count(*)::int AS cantidad
        FROM classified GROUP BY clasificacion ORDER BY clasificacion
      ) x
    `,
  );

  await many(
    tx,
    'SUBRUBROS_POSTRES',
    `
      ${ARGENTINA_SCOPE}
      SELECT
        COALESCE(NULLIF(trim(pr."subrubro"), ''), '<VACIO>') AS "subrubro",
        count(*)::int AS "relaciones",
        count(DISTINCT pr."proveedorId")::int AS "proveedores"
      FROM "ProveedorRubro" pr
      JOIN argentina a ON a."id" = pr."proveedorId"
      WHERE pr."rubro" = 'POSTRES Y SNACKS'
      GROUP BY 1
      ORDER BY count(*) DESC, 1
      LIMIT 200
    `,
  );

  await one(
    tx,
    'SPLIT_POSTRES',
    `
      ${ARGENTINA_SCOPE},
      signals AS (
        SELECT pr."id", pr."proveedorId",
          lower(translate(
            COALESCE(pr."subrubro", '') || ' ' || COALESCE(pr."productosComercializa", ''),
            'áéíóúüñ', 'aeiouun'
          )) AS texto
        FROM "ProveedorRubro" pr
        JOIN argentina a ON a."id" = pr."proveedorId"
        WHERE pr."rubro" = 'POSTRES Y SNACKS'
      ), flags AS (
        SELECT *,
          texto ~ '(postre|helado|pastel|tarta|torta|repost|dulce|alfajor|chocolate|bombon|panader|factura|churro|crepe|waffle|flan|gelatina)' AS postre,
          texto ~ '(snack|picada|fiambre|fruto seco|tabla|aceituna|chips|botana|bocad|aperitivo|sandwich|empanada|galleta)' AS snack
        FROM signals
      ), classified AS (
        SELECT *, CASE
          WHEN postre AND snack THEN 'MIXTO_REQUIERE_REVISION'
          WHEN postre THEN 'PO_SUGERIDO'
          WHEN snack THEN 'SN_SUGERIDO'
          ELSE 'SIN_CLASIFICAR'
        END AS clasificacion
        FROM flags
      )
      SELECT COALESCE(jsonb_object_agg(clasificacion, cantidad), '{}'::jsonb) AS result
      FROM (
        SELECT clasificacion, count(*)::int AS cantidad
        FROM classified GROUP BY clasificacion ORDER BY clasificacion
      ) x
    `,
  );

  await many(
    tx,
    'SUBRUBROS_TRANSPORTE',
    `
      ${ARGENTINA_SCOPE}
      SELECT
        COALESCE(NULLIF(trim(pr."subrubro"), ''), '<VACIO>') AS "subrubro",
        count(*)::int AS "relaciones",
        count(DISTINCT pr."proveedorId")::int AS "proveedores"
      FROM "ProveedorRubro" pr
      JOIN argentina a ON a."id" = pr."proveedorId"
      WHERE pr."rubro" = 'TRANSPORTE, TAXIS, DELIVERY Y COURIER'
      GROUP BY 1
      ORDER BY count(*) DESC, 1
      LIMIT 200
    `,
  );

  await one(
    tx,
    'DUPLICATES',
    `
      ${ARGENTINA_SCOPE},
      identities AS (
        SELECT "id",
          regexp_replace(
            translate(lower(trim(COALESCE("razonSocial", ''))), 'áéíóúüñ', 'aeiouun'),
            '[^a-z0-9]+', '', 'g'
          ) AS nombre,
          regexp_replace(
            translate(lower(trim(COALESCE("ciudad", ''))), 'áéíóúüñ', 'aeiouun'),
            '[^a-z0-9]+', '', 'g'
          ) AS ciudad
        FROM argentina
      ), identity_groups AS (
        SELECT nombre, ciudad, count(*)::int AS cantidad
        FROM identities
        WHERE nombre <> '' AND ciudad <> ''
        GROUP BY nombre, ciudad HAVING count(*) > 1
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
        SELECT contacto, count(DISTINCT "proveedorId")::int AS cantidad
        FROM contacts GROUP BY contacto HAVING count(DISTINCT "proveedorId") > 1
      ), contact_members AS (
        SELECT DISTINCT c."proveedorId"
        FROM contacts c JOIN contact_groups g ON g.contacto = c.contacto
      )
      SELECT jsonb_build_object(
        'gruposNombreCiudad', (SELECT count(*)::int FROM identity_groups),
        'registrosNombreCiudad', (SELECT COALESCE(sum(cantidad), 0)::int FROM identity_groups),
        'gruposContactoCompartido', (SELECT count(*)::int FROM contact_groups),
        'proveedoresContactoCompartido', (SELECT count(*)::int FROM contact_members)
      ) AS result
    `,
  );

  await one(
    tx,
    'LEGACY_CONSISTENCY',
    `
      ${ARGENTINA_SCOPE},
      principal AS (
        SELECT DISTINCT ON (pr."proveedorId")
          pr."proveedorId", pr."rubro", pr."subrubro", pr."productosComercializa"
        FROM "ProveedorRubro" pr
        JOIN argentina a ON a."id" = pr."proveedorId"
        WHERE pr."esPrincipal"
        ORDER BY pr."proveedorId", pr."id"
      )
      SELECT jsonb_build_object(
        'comparables', (SELECT count(*)::int FROM principal),
        'rubroDiferente', (SELECT count(*)::int FROM argentina a JOIN principal p ON p."proveedorId" = a."id"
          WHERE upper(trim(COALESCE(a."rubro", ''))) IS DISTINCT FROM upper(trim(COALESCE(p."rubro", '')))),
        'subrubroDiferente', (SELECT count(*)::int FROM argentina a JOIN principal p ON p."proveedorId" = a."id"
          WHERE upper(trim(COALESCE(a."subrubro", ''))) IS DISTINCT FROM upper(trim(COALESCE(p."subrubro", '')))),
        'productosDiferentes', (SELECT count(*)::int FROM argentina a JOIN principal p ON p."proveedorId" = a."id"
          WHERE trim(COALESCE(a."productosComercializa", '')) IS DISTINCT FROM trim(COALESCE(p."productosComercializa", '')))
      ) AS result
    `,
  );

  await many(
    tx,
    'EXAMPLES',
    `
      ${ARGENTINA_SCOPE},
      principal_counts AS (
        SELECT a."id", count(pr."id") FILTER (WHERE pr."esPrincipal")::int AS principales,
               count(pr."id")::int AS relaciones
        FROM argentina a LEFT JOIN "ProveedorRubro" pr ON pr."proveedorId" = a."id"
        GROUP BY a."id"
      ), anomalies AS (
        SELECT 'SIN_CODIGO' AS tipo, a."id", a."codigoProveedor", a."razonSocial"
        FROM argentina a WHERE NULLIF(trim(COALESCE(a."codigoProveedor", '')), '') IS NULL
        UNION ALL
        SELECT 'CODIGO_OTRO_FORMATO', a."id", a."codigoProveedor", a."razonSocial"
        FROM argentina a
        WHERE NULLIF(trim(COALESCE(a."codigoProveedor", '')), '') IS NOT NULL
          AND trim(a."codigoProveedor") !~ '^AR[0-9]{8}$'
          AND trim(a."codigoProveedor") !~ '^AR[0-9]{5}$'
        UNION ALL
        SELECT 'CODIGO_PAIS_NO_AR', a."id", a."codigoProveedor", a."razonSocial"
        FROM argentina a WHERE upper(trim(COALESCE(a."codigoPais", ''))) <> 'AR'
        UNION ALL
        SELECT 'SIN_RELACION', a."id", a."codigoProveedor", a."razonSocial"
        FROM argentina a JOIN principal_counts pc ON pc."id" = a."id" WHERE pc.relaciones = 0
        UNION ALL
        SELECT 'SIN_PRINCIPAL', a."id", a."codigoProveedor", a."razonSocial"
        FROM argentina a JOIN principal_counts pc ON pc."id" = a."id" WHERE pc.principales = 0
        UNION ALL
        SELECT 'MULTIPLES_PRINCIPALES', a."id", a."codigoProveedor", a."razonSocial"
        FROM argentina a JOIN principal_counts pc ON pc."id" = a."id" WHERE pc.principales > 1
        UNION ALL
        SELECT 'SIN_CONTACTO', a."id", a."codigoProveedor", a."razonSocial"
        FROM argentina a
        WHERE NULLIF(trim(COALESCE(a."telefono", '')), '') IS NULL
          AND NULLIF(trim(COALESCE(a."whatsapp", '')), '') IS NULL
          AND NULLIF(trim(COALESCE(a."email", '')), '') IS NULL
        UNION ALL
        SELECT 'DUPLICIDAD_MARCADA', a."id", a."codigoProveedor", a."razonSocial"
        FROM argentina a WHERE COALESCE(a."evidenciaVerificacion"::text, '') ILIKE '%POSSIBLE_DUPLICATE%'
        UNION ALL
        SELECT 'SUBRUBRO_VACIO', a."id", a."codigoProveedor", a."razonSocial"
        FROM argentina a WHERE EXISTS (
          SELECT 1 FROM "ProveedorRubro" pr WHERE pr."proveedorId" = a."id"
            AND NULLIF(trim(COALESCE(pr."subrubro", '')), '') IS NULL
        )
        UNION ALL
        SELECT 'PRODUCTOS_RELACION_VACIOS', a."id", a."codigoProveedor", a."razonSocial"
        FROM argentina a WHERE EXISTS (
          SELECT 1 FROM "ProveedorRubro" pr WHERE pr."proveedorId" = a."id"
            AND NULLIF(trim(COALESCE(pr."productosComercializa", '')), '') IS NULL
        )
        UNION ALL
        SELECT 'TAXONOMIA_INVALIDA', a."id", a."codigoProveedor", a."razonSocial"
        FROM argentina a WHERE EXISTS (
          SELECT 1 FROM "ProveedorRubro" pr WHERE pr."proveedorId" = a."id"
            AND pr."rubro" NOT IN (${OFFICIAL_TAXONOMY})
        )
      ), ranked AS (
        SELECT *, row_number() OVER (PARTITION BY tipo ORDER BY "id") AS posicion
        FROM anomalies
      )
      SELECT tipo, "id", "codigoProveedor", "razonSocial"
      FROM ranked WHERE posicion <= 20
      ORDER BY tipo, "id"
    `,
  );
}

async function main(): Promise<void> {
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        await audit(tx);
      },
      { maxWait: 30_000, timeout: 600_000 },
    );
    emit('COMPLETE', { status: 'OK', databaseChanges: 0 });
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error('ARGENTINA_AUDIT_FAILED', error);
  process.exitCode = 1;
});
