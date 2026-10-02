import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function emit(label: string, value: unknown): void {
  console.log(
    `ARGENTINA_CORRECTION_INSPECT_${label}=${JSON.stringify(
      value,
      (_key, item: unknown) =>
        typeof item === 'bigint' ? item.toString() : item,
    )}`,
  );
}

async function inspect(tx: Prisma.TransactionClient): Promise<void> {
  const scope = `
    WITH argentina AS (
      SELECT p.* FROM "Proveedor" p
      WHERE upper(trim(COALESCE(p."codigoPais", ''))) = 'AR'
         OR regexp_replace(
              translate(lower(trim(COALESCE(p."pais", ''))), 'áéíóúüñ', 'aeiouun'),
              '[^a-z0-9]+', '', 'g'
            ) IN ('argentina', 'republicaargentina')
    )
  `;

  const mixed = await tx.$queryRawUnsafe<Record<string, unknown>[]>(`
    ${scope}, signals AS (
      SELECT pr.*, a."codigoProveedor", a."razonSocial",
        lower(translate(
          COALESCE(pr."subrubro", '') || ' ' || COALESCE(pr."productosComercializa", ''),
          'áéíóúüñ', 'aeiouun'
        )) AS texto
      FROM "ProveedorRubro" pr
      JOIN argentina a ON a."id" = pr."proveedorId"
      WHERE pr."rubro" = 'POSTRES Y SNACKS'
    )
    SELECT "id" AS "relacionId", "proveedorId", "codigoProveedor", "razonSocial",
           "subrubro", "productosComercializa", "esPrincipal", "fuenteVerificacion"
    FROM signals
    WHERE texto ~ '(postre|helado|pastel|tarta|torta|repost|dulce|alfajor|chocolate|bombon|panader|factura|churro|crepe|waffle|flan|gelatina)'
      AND texto ~ '(snack|picada|fiambre|fruto seco|tabla|aceituna|chips|botana|bocad|aperitivo|sandwich|empanada|galleta)'
    ORDER BY "proveedorId", "id"
  `);
  emit('MIXED_POSTRES_SNACKS', mixed);

  const relationless = await tx.$queryRawUnsafe<Record<string, unknown>[]>(`
    ${scope}
    SELECT a."id", a."codigoProveedor", a."razonSocial", a."ciudad",
           a."rubro", a."subrubro", a."productosComercializa",
           a."fuenteVerificacion", a."estadoVerificacion",
           a."evidenciaVerificacion"
    FROM argentina a
    WHERE NOT EXISTS (
      SELECT 1 FROM "ProveedorRubro" pr WHERE pr."proveedorId" = a."id"
    )
    ORDER BY a."id"
  `);
  emit('RELATIONLESS', relationless);

  const nameDuplicates = await tx.$queryRawUnsafe<Record<string, unknown>[]>(`
    ${scope}, normalized AS (
      SELECT a.*,
        regexp_replace(
          translate(lower(trim(COALESCE(a."razonSocial", ''))), 'áéíóúüñ', 'aeiouun'),
          '[^a-z0-9]+', '', 'g'
        ) AS nombre_key,
        regexp_replace(
          translate(lower(trim(COALESCE(a."ciudad", ''))), 'áéíóúüñ', 'aeiouun'),
          '[^a-z0-9]+', '', 'g'
        ) AS ciudad_key
      FROM argentina a
    ), groups AS (
      SELECT nombre_key, ciudad_key
      FROM normalized
      WHERE nombre_key <> '' AND ciudad_key <> ''
      GROUP BY nombre_key, ciudad_key HAVING count(*) > 1
    )
    SELECT md5(n.nombre_key || '|' || n.ciudad_key) AS "grupo",
           n."id", n."codigoProveedor", n."razonSocial", n."ciudad",
           n."estadoVerificacion", n."fuenteVerificacion"
    FROM normalized n
    JOIN groups g USING (nombre_key, ciudad_key)
    ORDER BY "grupo", n."id"
  `);
  emit('NAME_DUPLICATES', nameDuplicates);

  const contactDuplicates = await tx.$queryRawUnsafe<
    Record<string, unknown>[]
  >(`
    ${scope}, contacts AS (
      SELECT "id" AS "proveedorId", 'N:' || regexp_replace("telefono", '[^0-9]+', '', 'g') AS contacto
      FROM argentina WHERE length(regexp_replace(COALESCE("telefono", ''), '[^0-9]+', '', 'g')) >= 7
      UNION
      SELECT "id", 'N:' || regexp_replace("whatsapp", '[^0-9]+', '', 'g')
      FROM argentina WHERE length(regexp_replace(COALESCE("whatsapp", ''), '[^0-9]+', '', 'g')) >= 7
      UNION
      SELECT "id", 'E:' || lower(trim("email"))
      FROM argentina WHERE NULLIF(lower(trim(COALESCE("email", ''))), '') IS NOT NULL
    ), groups AS (
      SELECT contacto FROM contacts GROUP BY contacto
      HAVING count(DISTINCT "proveedorId") > 1
    )
    SELECT md5(c.contacto) AS "grupo",
           CASE WHEN c.contacto LIKE 'E:%' THEN 'EMAIL' ELSE 'TELEFONO_WHATSAPP' END AS "tipoContacto",
           a."id", a."codigoProveedor", a."razonSocial", a."ciudad",
           a."estadoVerificacion", a."fuenteVerificacion"
    FROM contacts c
    JOIN groups g ON g.contacto = c.contacto
    JOIN argentina a ON a."id" = c."proveedorId"
    ORDER BY "grupo", a."id"
  `);
  emit('CONTACT_DUPLICATES', contactDuplicates);

  const subrubros = await tx.$queryRawUnsafe<Record<string, unknown>[]>(`
    ${scope}
    SELECT pr."rubro", pr."subrubro", count(*)::int AS "relaciones"
    FROM "ProveedorRubro" pr
    JOIN argentina a ON a."id" = pr."proveedorId"
    GROUP BY pr."rubro", pr."subrubro"
    ORDER BY pr."rubro", pr."subrubro"
  `);
  emit('ALL_SUBRUBROS', subrubros);
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
  console.error('ARGENTINA_CORRECTION_INSPECT_FAILED', error);
  process.exitCode = 1;
});
