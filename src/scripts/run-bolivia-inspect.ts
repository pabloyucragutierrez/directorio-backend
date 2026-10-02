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

function emit(label: string, value: unknown): void {
  const serialized = JSON.stringify(value, (_key, item: unknown) =>
    typeof item === 'bigint' ? item.toString() : item,
  );
  console.log(`BOLIVIA_INSPECT_${label}=${serialized}`);
}

function emitChunks(label: string, rows: unknown[], size = 25): void {
  for (let index = 0; index < rows.length; index += size) {
    const number = String(index / size + 1).padStart(3, '0');
    emit(`${label}_${number}`, rows.slice(index, index + size));
  }
  emit(`${label}_COUNT`, rows.length);
}

async function many(
  tx: Prisma.TransactionClient,
  sql: string,
): Promise<Record<string, unknown>[]> {
  return tx.$queryRawUnsafe<Record<string, unknown>[]>(sql);
}

async function inspect(tx: Prisma.TransactionClient): Promise<void> {
  const mode = await tx.$queryRawUnsafe<Array<{ readOnly: string }>>(
    `SELECT current_setting('transaction_read_only') AS "readOnly"`,
  );
  emit('MODE', {
    country: 'Bolivia',
    countryCode: 'BO',
    readOnly: mode[0]?.readOnly,
    generatedAt: new Date().toISOString(),
  });

  const identities = await many(
    tx,
    `
      ${BOLIVIA_SCOPE}
      SELECT
        "id", "codigoProveedor", "razonSocial", "ciudad", "distrito",
        "telefono", "whatsapp", "email", "website", "estadoVerificacion", "activo",
        regexp_replace(
          translate(lower(trim(COALESCE("razonSocial", ''))), 'áéíóúüñ', 'aeiouun'),
          '[^a-z0-9]+', '', 'g'
        ) AS "nombreNormalizado",
        regexp_replace(
          translate(lower(trim(COALESCE("ciudad", ''))), 'áéíóúüñ', 'aeiouun'),
          '[^a-z0-9]+', '', 'g'
        ) AS "ciudadNormalizada",
        regexp_replace(COALESCE(NULLIF(trim("telefono"), ''), NULLIF(trim("whatsapp"), ''), ''), '[^0-9]+', '', 'g')
          AS "contactoNormalizado"
      FROM bolivia
      ORDER BY "id"
    `,
  );
  emitChunks('IDENTITIES', identities);

  const relationless = await many(
    tx,
    `
      ${BOLIVIA_SCOPE}
      SELECT
        b."id", b."codigoProveedor", b."razonSocial", b."ciudad", b."direccion",
        b."telefono", b."whatsapp", b."email", b."website", b."redesSociales",
        b."rubro", b."subrubro", b."productosComercializa", b."fuenteVerificacion",
        b."estadoVerificacion", b."activo", b."evidenciaVerificacion"
      FROM bolivia b
      WHERE NOT EXISTS (
        SELECT 1 FROM "ProveedorRubro" pr WHERE pr."proveedorId" = b."id"
      )
      ORDER BY b."id"
    `,
  );
  emitChunks('RELATIONLESS', relationless);

  const combined = await many(
    tx,
    `
      ${BOLIVIA_SCOPE}
      SELECT
        pr."id" AS "relacionId", pr."proveedorId", b."codigoProveedor", b."razonSocial",
        b."estadoVerificacion", pr."rubro", pr."subrubro", pr."productosComercializa",
        pr."fuenteVerificacion", pr."esPrincipal"
      FROM "ProveedorRubro" pr
      JOIN bolivia b ON b."id" = pr."proveedorId"
      WHERE pr."rubro" IN (
        'BEBIDAS FRIAS Y CALIENTES',
        'POSTRES Y SNACKS',
        'TRANSPORTE, TAXIS, DELIVERY Y COURIER'
      )
      ORDER BY pr."rubro", pr."subrubro", pr."id"
    `,
  );
  emitChunks('COMBINED', combined);

  const sharedContacts = await many(
    tx,
    `
      ${BOLIVIA_SCOPE},
      contacts AS (
        SELECT "id" AS "proveedorId", 'N:' || regexp_replace("telefono", '[^0-9]+', '', 'g') AS contacto
        FROM bolivia WHERE length(regexp_replace(COALESCE("telefono", ''), '[^0-9]+', '', 'g')) >= 7
        UNION
        SELECT "id", 'N:' || regexp_replace("whatsapp", '[^0-9]+', '', 'g')
        FROM bolivia WHERE length(regexp_replace(COALESCE("whatsapp", ''), '[^0-9]+', '', 'g')) >= 7
        UNION
        SELECT "id", 'E:' || lower(trim("email"))
        FROM bolivia WHERE NULLIF(lower(trim(COALESCE("email", ''))), '') IS NOT NULL
      ), duplicate_contacts AS (
        SELECT contacto
        FROM contacts GROUP BY contacto HAVING count(DISTINCT "proveedorId") > 1
      )
      SELECT c.contacto, b."id", b."codigoProveedor", b."razonSocial", b."ciudad",
             b."telefono", b."whatsapp", b."email", b."estadoVerificacion"
      FROM contacts c
      JOIN duplicate_contacts d ON d.contacto = c.contacto
      JOIN bolivia b ON b."id" = c."proveedorId"
      ORDER BY c.contacto, b."id"
    `,
  );
  emitChunks('SHARED_CONTACTS', sharedContacts);

  const catalog = await many(
    tx,
    `
      SELECT r."codigo" AS "codigoRubro", r."nombre" AS "rubro",
             s."codigo" AS "codigoSubrubro", s."nombre" AS "subrubro"
      FROM "RubroCatalogo" r
      JOIN "SubrubroCatalogo" s ON s."codigoRubro" = r."codigo"
      WHERE r."activo" AND s."activo"
      ORDER BY r."codigo", s."codigo"
    `,
  );
  emitChunks('CATALOG', catalog);
}

async function main(): Promise<void> {
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        await inspect(tx);
      },
      { maxWait: 30_000, timeout: 600_000 },
    );
    emit('COMPLETE', { status: 'OK', databaseChanges: 0 });
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error('BOLIVIA_INSPECT_FAILED', error);
  process.exitCode = 1;
});
