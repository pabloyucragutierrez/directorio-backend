import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BOLIVIA_SCOPE = `
  WITH bolivia AS (
    SELECT p.*
    FROM "Proveedor" p
    WHERE upper(trim(COALESCE(p."codigoPais", ''))) = 'BO'
       OR regexp_replace(
            translate(lower(trim(COALESCE(p."pais", ''))), 'áéíóúüñ', 'aeiouun'),
            '[^a-z0-9]+', '', 'g'
          ) IN ('bolivia', 'estadoplurinacionaldebolivia')
  )
`;

const OFFICIAL_RUBROS = `
  'BEBIDAS ALCOHOLICAS',
  'BEBIDAS FRIAS',
  'BEBIDAS CALIENTES',
  'DESAYUNOS',
  'FLORES',
  'PLATOS A LA CARTA',
  'POSTRES',
  'SNACKS',
  'TORTAS',
  'TRANSPORTES'
`;

function emit(label: string, value: unknown): void {
  const serialized = JSON.stringify(value, (_key, item: unknown) =>
    typeof item === 'bigint' ? item.toString() : item,
  );
  console.log(`BOLIVIA_AUDIT_${label}=${serialized}`);
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
  const mode = await tx.$queryRawUnsafe<Array<{ readOnly: string }>>(
    `SELECT current_setting('transaction_read_only') AS "readOnly"`,
  );
  emit('MODE', {
    country: 'Bolivia',
    countryCode: 'BO',
    readOnly: mode[0]?.readOnly,
    generatedAt: new Date().toISOString(),
  });

  await one(
    tx,
    'SUMMARY',
    `
      ${BOLIVIA_SCOPE},
      states AS (
        SELECT COALESCE(NULLIF(trim("estadoVerificacion"), ''), '<VACIO>') AS estado,
               count(*)::int AS cantidad
        FROM bolivia GROUP BY 1
      )
      SELECT jsonb_build_object(
        'totalProveedores', (SELECT count(*)::int FROM bolivia),
        'activos', (SELECT count(*)::int FROM bolivia WHERE "activo"),
        'inactivos', (SELECT count(*)::int FROM bolivia WHERE NOT "activo"),
        'estados', COALESCE((SELECT jsonb_object_agg(estado, cantidad) FROM states), '{}'::jsonb),
        'razonSocialVacia', (SELECT count(*)::int FROM bolivia
          WHERE NULLIF(trim("razonSocial"), '') IS NULL),
        'ciudadVacia', (SELECT count(*)::int FROM bolivia
          WHERE NULLIF(trim("ciudad"), '') IS NULL),
        'productosVacios', (SELECT count(*)::int FROM bolivia b
          WHERE NULLIF(trim(COALESCE(b."productosComercializa", '')), '') IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM "ProveedorRubro" pr
              WHERE pr."proveedorId" = b."id"
                AND NULLIF(trim(COALESCE(pr."productosComercializa", '')), '') IS NOT NULL
            )),
        'fuenteVacia', (SELECT count(*)::int FROM bolivia b
          WHERE NULLIF(trim(COALESCE(b."fuenteVerificacion", '')), '') IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM "ProveedorRubro" pr
              WHERE pr."proveedorId" = b."id"
                AND NULLIF(trim(COALESCE(pr."fuenteVerificacion", '')), '') IS NOT NULL
            )),
        'sinContacto', (SELECT count(*)::int FROM bolivia
          WHERE NULLIF(trim(COALESCE("telefono", '')), '') IS NULL
            AND NULLIF(trim(COALESCE("whatsapp", '')), '') IS NULL
            AND NULLIF(trim(COALESCE("email", '')), '') IS NULL),
        'veSinContacto', (SELECT count(*)::int FROM bolivia
          WHERE "estadoVerificacion" = 'VE'
            AND NULLIF(trim(COALESCE("telefono", '')), '') IS NULL
            AND NULLIF(trim(COALESCE("whatsapp", '')), '') IS NULL
            AND NULLIF(trim(COALESCE("email", '')), '') IS NULL),
        'veSinFuente', (SELECT count(*)::int FROM bolivia b
          WHERE b."estadoVerificacion" = 'VE'
            AND NULLIF(trim(COALESCE(b."fuenteVerificacion", '')), '') IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM "ProveedorRubro" pr
              WHERE pr."proveedorId" = b."id"
                AND NULLIF(trim(COALESCE(pr."fuenteVerificacion", '')), '') IS NOT NULL
            )),
        'veSinProductos', (SELECT count(*)::int FROM bolivia b
          WHERE b."estadoVerificacion" = 'VE'
            AND NULLIF(trim(COALESCE(b."productosComercializa", '')), '') IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM "ProveedorRubro" pr
              WHERE pr."proveedorId" = b."id"
                AND NULLIF(trim(COALESCE(pr."productosComercializa", '')), '') IS NOT NULL
            )),
        'posiblesDuplicadosMarcados', (SELECT count(*)::int FROM bolivia
          WHERE COALESCE("evidenciaVerificacion"::text, '') ILIKE '%POSSIBLE_DUPLICATE%'),
        'estadoInvalido', (SELECT count(*)::int FROM bolivia
          WHERE "estadoVerificacion" NOT IN ('VE', 'NV'))
      ) AS result
    `,
  );

  await one(
    tx,
    'CODES',
    `
      ${BOLIVIA_SCOPE},
      duplicate_codes AS (
        SELECT trim("codigoProveedor") AS codigo, count(*)::int AS cantidad
        FROM bolivia
        WHERE NULLIF(trim(COALESCE("codigoProveedor", '')), '') IS NOT NULL
        GROUP BY 1 HAVING count(*) > 1
      )
      SELECT jsonb_build_object(
        'sinCodigo', (SELECT count(*)::int FROM bolivia
          WHERE NULLIF(trim(COALESCE("codigoProveedor", '')), '') IS NULL),
        'codigosDistintos', (SELECT count(DISTINCT trim("codigoProveedor"))::int FROM bolivia
          WHERE NULLIF(trim(COALESCE("codigoProveedor", '')), '') IS NOT NULL),
        'formatoBO8', (SELECT count(*)::int FROM bolivia
          WHERE trim("codigoProveedor") ~ '^BO[0-9]{8}$'),
        'formatoBO5', (SELECT count(*)::int FROM bolivia
          WHERE trim("codigoProveedor") ~ '^BO[0-9]{5}$'),
        'otroFormato', (SELECT count(*)::int FROM bolivia
          WHERE NULLIF(trim(COALESCE("codigoProveedor", '')), '') IS NOT NULL
            AND trim("codigoProveedor") !~ '^BO[0-9]{8}$'
            AND trim("codigoProveedor") !~ '^BO[0-9]{5}$'),
        'gruposCodigoDuplicado', (SELECT count(*)::int FROM duplicate_codes),
        'registrosCodigoDuplicado', (SELECT COALESCE(sum(cantidad), 0)::int FROM duplicate_codes),
        'codigoMinimo', (SELECT min(trim("codigoProveedor")) FROM bolivia
          WHERE trim("codigoProveedor") ~ '^BO[0-9]+$'),
        'codigoMaximo', (SELECT max(trim("codigoProveedor")) FROM bolivia
          WHERE trim("codigoProveedor") ~ '^BO[0-9]+$'),
        'maximoNumericoBO8', (SELECT max(substring(trim("codigoProveedor") FROM 3)::bigint)
          FROM bolivia WHERE trim("codigoProveedor") ~ '^BO[0-9]{8}$'),
        'maximoNumericoBO5', (SELECT max(substring(trim("codigoProveedor") FROM 3)::bigint)
          FROM bolivia WHERE trim("codigoProveedor") ~ '^BO[0-9]{5}$'),
        'codigoPaisVacio', (SELECT count(*)::int FROM bolivia
          WHERE NULLIF(trim(COALESCE("codigoPais", '')), '') IS NULL),
        'codigoPaisNoBO', (SELECT count(*)::int FROM bolivia
          WHERE upper(trim(COALESCE("codigoPais", ''))) <> 'BO'),
        'paisNoBolivia', (SELECT count(*)::int FROM bolivia
          WHERE regexp_replace(
            translate(lower(trim(COALESCE("pais", ''))), 'áéíóúüñ', 'aeiouun'),
            '[^a-z0-9]+', '', 'g'
          ) NOT IN ('bolivia', 'estadoplurinacionaldebolivia'))
      ) AS result
    `,
  );

  await one(
    tx,
    'SEQUENCE',
    `
      ${BOLIVIA_SCOPE}
      SELECT jsonb_build_object(
        'secuenciaExiste', EXISTS (
          SELECT 1 FROM "SecuenciaProveedorPais" WHERE "codigoPais" = 'BO'
        ),
        'ultimoNumero', (SELECT "ultimoNumero" FROM "SecuenciaProveedorPais"
          WHERE "codigoPais" = 'BO'),
        'maximoCodigoBO8', (SELECT max(substring(trim("codigoProveedor") FROM 3)::bigint)
          FROM bolivia WHERE trim("codigoProveedor") ~ '^BO[0-9]{8}$'),
        'maximoCodigoBO5', (SELECT max(substring(trim("codigoProveedor") FROM 3)::bigint)
          FROM bolivia WHERE trim("codigoProveedor") ~ '^BO[0-9]{5}$')
      ) AS result
    `,
  );

  await one(
    tx,
    'RELATIONS',
    `
      ${BOLIVIA_SCOPE},
      rel AS (
        SELECT pr.* FROM "ProveedorRubro" pr
        JOIN bolivia b ON b."id" = pr."proveedorId"
      ),
      principal_counts AS (
        SELECT b."id", count(*) FILTER (WHERE r."esPrincipal")::int AS principales,
               count(r."id")::int AS relaciones
        FROM bolivia b LEFT JOIN rel r ON r."proveedorId" = b."id"
        GROUP BY b."id"
      )
      SELECT jsonb_build_object(
        'relaciones', (SELECT count(*)::int FROM rel),
        'proveedoresSinRelacion', (SELECT count(*)::int FROM principal_counts WHERE relaciones = 0),
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
        'sinCodigoRubro', (SELECT count(*)::int FROM rel
          WHERE NULLIF(trim(COALESCE("codigoRubro", '')), '') IS NULL),
        'sinCodigoSubrubro', (SELECT count(*)::int FROM rel
          WHERE NULLIF(trim(COALESCE("codigoSubrubro", '')), '') IS NULL),
        'taxonomiaInvalida', (SELECT count(*)::int FROM rel
          WHERE "rubro" NOT IN (${OFFICIAL_RUBROS})),
        'codigoRubroInvalido', (SELECT count(*)::int FROM rel r
          WHERE r."codigoRubro" IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM "RubroCatalogo" c WHERE c."codigo" = r."codigoRubro")),
        'codigoSubrubroInvalido', (SELECT count(*)::int FROM rel r
          WHERE r."codigoSubrubro" IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM "SubrubroCatalogo" c WHERE c."codigo" = r."codigoSubrubro")),
        'codigosIncoherentes', (SELECT count(*)::int FROM rel r
          JOIN "SubrubroCatalogo" s ON s."codigo" = r."codigoSubrubro"
          WHERE r."codigoRubro" IS DISTINCT FROM s."codigoRubro"),
        'nombreRubroNoCatalogo', (SELECT count(*)::int FROM rel r
          JOIN "RubroCatalogo" c ON c."codigo" = r."codigoRubro"
          WHERE upper(trim(r."rubro")) IS DISTINCT FROM upper(trim(c."nombre"))),
        'nombreSubrubroNoCatalogo', (SELECT count(*)::int FROM rel r
          JOIN "SubrubroCatalogo" s ON s."codigo" = r."codigoSubrubro"
          WHERE upper(trim(r."subrubro")) IS DISTINCT FROM upper(trim(s."nombre"))),
        'nombresCombinadosAntiguos', (SELECT count(*)::int FROM rel
          WHERE "rubro" IN (
            'BEBIDAS FRIAS Y CALIENTES',
            'POSTRES Y SNACKS',
            'TRANSPORTE, TAXIS, DELIVERY Y COURIER'
          ))
      ) AS result
    `,
  );

  await many(
    tx,
    'RUBROS',
    `
      ${BOLIVIA_SCOPE}
      SELECT
        COALESCE(NULLIF(trim(pr."rubro"), ''), '<VACIO>') AS "rubro",
        COALESCE(NULLIF(trim(pr."codigoRubro"), ''), '<SIN_CODIGO>') AS "codigoRubro",
        count(*)::int AS "relaciones",
        count(DISTINCT pr."proveedorId")::int AS "proveedores",
        count(*) FILTER (WHERE pr."esPrincipal")::int AS "principales",
        count(*) FILTER (WHERE NULLIF(trim(COALESCE(pr."subrubro", '')), '') IS NULL)::int
          AS "subrubroVacio",
        count(*) FILTER (WHERE NULLIF(trim(COALESCE(pr."codigoSubrubro", '')), '') IS NULL)::int
          AS "codigoSubrubroVacio"
      FROM "ProveedorRubro" pr
      JOIN bolivia b ON b."id" = pr."proveedorId"
      GROUP BY 1, 2 ORDER BY 1, 2
    `,
  );

  await many(
    tx,
    'SUBRUBROS',
    `
      ${BOLIVIA_SCOPE}
      SELECT
        pr."rubro",
        COALESCE(NULLIF(trim(pr."subrubro"), ''), '<VACIO>') AS "subrubro",
        COALESCE(NULLIF(trim(pr."codigoSubrubro"), ''), '<SIN_CODIGO>') AS "codigoSubrubro",
        count(*)::int AS "relaciones",
        count(DISTINCT pr."proveedorId")::int AS "proveedores"
      FROM "ProveedorRubro" pr
      JOIN bolivia b ON b."id" = pr."proveedorId"
      GROUP BY 1, 2, 3
      ORDER BY 1, count(*) DESC, 2
    `,
  );

  await one(
    tx,
    'DUPLICATES',
    `
      ${BOLIVIA_SCOPE},
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
        FROM bolivia
      ), identity_groups AS (
        SELECT nombre, ciudad, count(*)::int AS cantidad
        FROM identities WHERE nombre <> '' AND ciudad <> ''
        GROUP BY nombre, ciudad HAVING count(*) > 1
      ), contacts AS (
        SELECT "id" AS "proveedorId", 'N:' || regexp_replace("telefono", '[^0-9]+', '', 'g') AS contacto
        FROM bolivia WHERE length(regexp_replace(COALESCE("telefono", ''), '[^0-9]+', '', 'g')) >= 7
        UNION
        SELECT "id", 'N:' || regexp_replace("whatsapp", '[^0-9]+', '', 'g')
        FROM bolivia WHERE length(regexp_replace(COALESCE("whatsapp", ''), '[^0-9]+', '', 'g')) >= 7
        UNION
        SELECT "id", 'E:' || lower(trim("email"))
        FROM bolivia WHERE NULLIF(lower(trim(COALESCE("email", ''))), '') IS NOT NULL
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

  await many(
    tx,
    'DUPLICATE_DETAILS',
    `
      ${BOLIVIA_SCOPE},
      normalized AS (
        SELECT b.*,
          regexp_replace(
            translate(lower(trim(COALESCE(b."razonSocial", ''))), 'áéíóúüñ', 'aeiouun'),
            '[^a-z0-9]+', '', 'g'
          ) AS nombre_normalizado,
          regexp_replace(
            translate(lower(trim(COALESCE(b."ciudad", ''))), 'áéíóúüñ', 'aeiouun'),
            '[^a-z0-9]+', '', 'g'
          ) AS ciudad_normalizada
        FROM bolivia b
      ), duplicate_keys AS (
        SELECT nombre_normalizado, ciudad_normalizada
        FROM normalized
        WHERE nombre_normalizado <> '' AND ciudad_normalizada <> ''
        GROUP BY 1, 2 HAVING count(*) > 1
      )
      SELECT n."id", n."codigoProveedor", n."razonSocial", n."ciudad",
             n."telefono", n."whatsapp", n."email", n."estadoVerificacion"
      FROM normalized n
      JOIN duplicate_keys d
        ON d.nombre_normalizado = n.nombre_normalizado
       AND d.ciudad_normalizada = n.ciudad_normalizada
      ORDER BY n.nombre_normalizado, n.ciudad_normalizada, n."id"
      LIMIT 200
    `,
  );

  await one(
    tx,
    'LEGACY_CONSISTENCY',
    `
      ${BOLIVIA_SCOPE},
      principal AS (
        SELECT DISTINCT ON (pr."proveedorId")
          pr."proveedorId", pr."rubro", pr."subrubro", pr."productosComercializa"
        FROM "ProveedorRubro" pr
        JOIN bolivia b ON b."id" = pr."proveedorId"
        WHERE pr."esPrincipal"
        ORDER BY pr."proveedorId", pr."id"
      )
      SELECT jsonb_build_object(
        'comparables', (SELECT count(*)::int FROM principal),
        'rubroDiferente', (SELECT count(*)::int FROM bolivia b JOIN principal p ON p."proveedorId" = b."id"
          WHERE upper(trim(COALESCE(b."rubro", ''))) IS DISTINCT FROM upper(trim(COALESCE(p."rubro", '')))),
        'subrubroDiferente', (SELECT count(*)::int FROM bolivia b JOIN principal p ON p."proveedorId" = b."id"
          WHERE upper(trim(COALESCE(b."subrubro", ''))) IS DISTINCT FROM upper(trim(COALESCE(p."subrubro", '')))),
        'productosDiferentes', (SELECT count(*)::int FROM bolivia b JOIN principal p ON p."proveedorId" = b."id"
          WHERE trim(COALESCE(b."productosComercializa", '')) IS DISTINCT FROM trim(COALESCE(p."productosComercializa", '')))
      ) AS result
    `,
  );

  await many(
    tx,
    'ANOMALY_EXAMPLES',
    `
      ${BOLIVIA_SCOPE},
      principal_counts AS (
        SELECT b."id", count(pr."id") FILTER (WHERE pr."esPrincipal")::int AS principales,
               count(pr."id")::int AS relaciones
        FROM bolivia b LEFT JOIN "ProveedorRubro" pr ON pr."proveedorId" = b."id"
        GROUP BY b."id"
      ), anomalies AS (
        SELECT 'SIN_CODIGO' AS tipo, b."id", b."codigoProveedor", b."razonSocial"
        FROM bolivia b WHERE NULLIF(trim(COALESCE(b."codigoProveedor", '')), '') IS NULL
        UNION ALL
        SELECT 'CODIGO_OTRO_FORMATO', b."id", b."codigoProveedor", b."razonSocial"
        FROM bolivia b
        WHERE NULLIF(trim(COALESCE(b."codigoProveedor", '')), '') IS NOT NULL
          AND trim(b."codigoProveedor") !~ '^BO[0-9]{8}$'
          AND trim(b."codigoProveedor") !~ '^BO[0-9]{5}$'
        UNION ALL
        SELECT 'CODIGO_PAIS_NO_BO', b."id", b."codigoProveedor", b."razonSocial"
        FROM bolivia b WHERE upper(trim(COALESCE(b."codigoPais", ''))) <> 'BO'
        UNION ALL
        SELECT 'SIN_RELACION', b."id", b."codigoProveedor", b."razonSocial"
        FROM bolivia b JOIN principal_counts pc ON pc."id" = b."id" WHERE pc.relaciones = 0
        UNION ALL
        SELECT 'SIN_PRINCIPAL', b."id", b."codigoProveedor", b."razonSocial"
        FROM bolivia b JOIN principal_counts pc ON pc."id" = b."id" WHERE pc.principales = 0
        UNION ALL
        SELECT 'MULTIPLES_PRINCIPALES', b."id", b."codigoProveedor", b."razonSocial"
        FROM bolivia b JOIN principal_counts pc ON pc."id" = b."id" WHERE pc.principales > 1
        UNION ALL
        SELECT 'SIN_CONTACTO', b."id", b."codigoProveedor", b."razonSocial"
        FROM bolivia b
        WHERE NULLIF(trim(COALESCE(b."telefono", '')), '') IS NULL
          AND NULLIF(trim(COALESCE(b."whatsapp", '')), '') IS NULL
          AND NULLIF(trim(COALESCE(b."email", '')), '') IS NULL
        UNION ALL
        SELECT 'SIN_CODIGOS_CATEGORIA', b."id", b."codigoProveedor", b."razonSocial"
        FROM bolivia b WHERE EXISTS (
          SELECT 1 FROM "ProveedorRubro" pr WHERE pr."proveedorId" = b."id"
            AND (pr."codigoRubro" IS NULL OR pr."codigoSubrubro" IS NULL)
        )
        UNION ALL
        SELECT 'TAXONOMIA_INVALIDA', b."id", b."codigoProveedor", b."razonSocial"
        FROM bolivia b WHERE EXISTS (
          SELECT 1 FROM "ProveedorRubro" pr WHERE pr."proveedorId" = b."id"
            AND pr."rubro" NOT IN (${OFFICIAL_RUBROS})
        )
      ), ranked AS (
        SELECT *, row_number() OVER (PARTITION BY tipo ORDER BY "id") AS posicion
        FROM anomalies
      )
      SELECT tipo, "id", "codigoProveedor", "razonSocial"
      FROM ranked WHERE posicion <= 30
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
  console.error('BOLIVIA_AUDIT_FAILED', error);
  process.exitCode = 1;
});

// Activador temporal de auditoría de solo lectura.
