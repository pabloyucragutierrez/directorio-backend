import fs from 'node:fs/promises';
import path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Mode = 'dry-run' | 'verify';

type Summary = {
  totalProveedores: number;
  activos: number;
  inactivos: number;
  verificados: number;
  noVerificados: number;
  codigosProveedorInvalidos: number;
  codigosProveedorDuplicados: number;
  codigoPaisInvalido: number;
  relaciones: number;
  relacionesCodificadas: number;
  relacionesSinCodigo: number;
  codigosIncoherentes: number;
  referenciasCatalogoInvalidas: number;
  rubrosCatalogo: number;
  subrubrosCatalogo: number;
  rubrosAnteriores: number;
  taxonomiaInvalida: number;
  activosSinRelacion: number;
  activosSinPrincipal: number;
  multiplesPrincipales: number;
  inactivosSinRelacion: number;
  posiblesDuplicadosMarcados: number;
  legacyRubroDiferente: number;
  legacySubrubroDiferente: number;
  legacyProductosDiferentes: number;
  proveedoresSinFuente: number;
  proveedoresSinProductos: number;
  relacionesSinFuente: number;
  relacionesSinProductos: number;
  secuenciaAR: number | null;
  maximoCodigo: number | null;
};

type CategoryRow = {
  codigoRubro: string;
  rubro: string;
  relaciones: number;
};

type AuditResult = {
  summary: Summary;
  categories: CategoryRow[];
};

class DryRunRollback extends Error {
  constructor(readonly result: AuditResult) {
    super('ARGENTINA_CORRECTION_DRY_RUN_ROLLBACK');
  }
}

function mode(): Mode {
  const value = process.env.ARGENTINA_CORRECTION_MODE;
  if (value !== 'dry-run' && value !== 'verify') {
    throw new Error('ARGENTINA_CORRECTION_MODE debe ser dry-run o verify');
  }
  return value;
}

function emit(label: string, value: unknown): void {
  console.log(
    `ARGENTINA_CORRECTION_${label}=${JSON.stringify(
      value,
      (_key, item: unknown) =>
        typeof item === 'bigint' ? item.toString() : item,
    )}`,
  );
}

function assertEqual(label: string, actual: number, expected: number): void {
  if (actual !== expected) {
    throw new Error(`${label}: esperado ${expected}, obtenido ${actual}`);
  }
}

function validate(result: AuditResult): void {
  const { summary, categories } = result;
  assertEqual('proveedores', summary.totalProveedores, 2747);
  assertEqual('proveedores activos', summary.activos, 2745);
  assertEqual('proveedores inactivos', summary.inactivos, 2);
  assertEqual('proveedores VE', summary.verificados, 2189);
  assertEqual('proveedores NV', summary.noVerificados, 558);
  assertEqual(
    'códigos proveedor inválidos',
    summary.codigosProveedorInvalidos,
    0,
  );
  assertEqual(
    'códigos proveedor duplicados',
    summary.codigosProveedorDuplicados,
    0,
  );
  assertEqual('códigos país inválidos', summary.codigoPaisInvalido, 0);
  assertEqual('relaciones', summary.relaciones, 5815);
  assertEqual('relaciones codificadas', summary.relacionesCodificadas, 5815);
  assertEqual('relaciones sin código', summary.relacionesSinCodigo, 0);
  assertEqual(
    'códigos rubro/subrubro incoherentes',
    summary.codigosIncoherentes,
    0,
  );
  assertEqual(
    'referencias de catálogo inválidas',
    summary.referenciasCatalogoInvalidas,
    0,
  );
  assertEqual('rubros de catálogo', summary.rubrosCatalogo, 10);
  assertEqual('subrubros de catálogo', summary.subrubrosCatalogo, 55);
  assertEqual('rubros anteriores', summary.rubrosAnteriores, 0);
  assertEqual('taxonomía inválida', summary.taxonomiaInvalida, 0);
  assertEqual('activos sin relación', summary.activosSinRelacion, 0);
  assertEqual('activos sin principal', summary.activosSinPrincipal, 0);
  assertEqual('múltiples principales', summary.multiplesPrincipales, 0);
  assertEqual('inactivos sin relación', summary.inactivosSinRelacion, 2);
  assertEqual(
    'posibles duplicados marcados',
    summary.posiblesDuplicadosMarcados,
    14,
  );
  assertEqual('rubro legado diferente', summary.legacyRubroDiferente, 0);
  assertEqual('subrubro legado diferente', summary.legacySubrubroDiferente, 0);
  assertEqual(
    'productos legados diferentes',
    summary.legacyProductosDiferentes,
    0,
  );
  assertEqual('proveedores sin fuente', summary.proveedoresSinFuente, 558);
  assertEqual(
    'proveedores sin productos',
    summary.proveedoresSinProductos,
    558,
  );
  assertEqual('relaciones sin fuente', summary.relacionesSinFuente, 561);
  assertEqual('relaciones sin productos', summary.relacionesSinProductos, 561);
  assertEqual('secuencia AR', summary.secuenciaAR ?? -1, 2747);
  assertEqual('máximo código AR', summary.maximoCodigo ?? -1, 2747);

  const expected = new Map<string, number>([
    ['BA', 336],
    ['BF', 10],
    ['BC', 285],
    ['DE', 617],
    ['FL', 1614],
    ['PL', 1492],
    ['PO', 505],
    ['SN', 46],
    ['TO', 736],
    ['TR', 174],
  ]);
  assertEqual('categorías presentes', categories.length, expected.size);
  for (const row of categories) {
    const count = expected.get(row.codigoRubro);
    if (count === undefined)
      throw new Error(`Código de rubro inesperado: ${row.codigoRubro}`);
    assertEqual(`relaciones ${row.codigoRubro}`, row.relaciones, count);
  }
}

async function inspect(tx: Prisma.TransactionClient): Promise<AuditResult> {
  const summaryRows = await tx.$queryRawUnsafe<Summary[]>(`
    WITH argentina AS (
      SELECT p.* FROM "Proveedor" p
      WHERE upper(trim(COALESCE(p."codigoPais", ''))) = 'AR'
         OR regexp_replace(
              translate(lower(trim(COALESCE(p."pais", ''))), 'áéíóúüñ', 'aeiouun'),
              '[^a-z0-9]+', '', 'g'
            ) IN ('argentina', 'republicaargentina')
    ), rel AS (
      SELECT pr.* FROM "ProveedorRubro" pr
      JOIN argentina a ON a."id" = pr."proveedorId"
    ), principal_counts AS (
      SELECT a."id", count(r."id") FILTER (WHERE r."esPrincipal")::int AS principales,
             count(r."id")::int AS relaciones
      FROM argentina a LEFT JOIN rel r ON r."proveedorId" = a."id"
      GROUP BY a."id"
    ), principal AS (
      SELECT DISTINCT ON (r."proveedorId") r.*
      FROM rel r WHERE r."esPrincipal"
      ORDER BY r."proveedorId", r."id"
    ), duplicate_codes AS (
      SELECT trim("codigoProveedor") AS codigo
      FROM argentina GROUP BY 1 HAVING count(*) > 1
    )
    SELECT
      (SELECT count(*)::int FROM argentina) AS "totalProveedores",
      (SELECT count(*)::int FROM argentina WHERE "activo") AS "activos",
      (SELECT count(*)::int FROM argentina WHERE NOT "activo") AS "inactivos",
      (SELECT count(*)::int FROM argentina WHERE "estadoVerificacion" = 'VE') AS "verificados",
      (SELECT count(*)::int FROM argentina WHERE "estadoVerificacion" = 'NV') AS "noVerificados",
      (SELECT count(*)::int FROM argentina WHERE trim(COALESCE("codigoProveedor", '')) !~ '^AR[0-9]{8}$') AS "codigosProveedorInvalidos",
      (SELECT count(*)::int FROM duplicate_codes) AS "codigosProveedorDuplicados",
      (SELECT count(*)::int FROM argentina WHERE upper(trim(COALESCE("codigoPais", ''))) <> 'AR') AS "codigoPaisInvalido",
      (SELECT count(*)::int FROM rel) AS "relaciones",
      (SELECT count(*)::int FROM rel WHERE "codigoRubro" IS NOT NULL AND "codigoSubrubro" IS NOT NULL) AS "relacionesCodificadas",
      (SELECT count(*)::int FROM rel WHERE "codigoRubro" IS NULL OR "codigoSubrubro" IS NULL) AS "relacionesSinCodigo",
      (SELECT count(*)::int FROM rel WHERE "codigoSubrubro" IS NOT NULL AND left("codigoSubrubro", 2) <> "codigoRubro") AS "codigosIncoherentes",
      (SELECT count(*)::int FROM rel r
        LEFT JOIN "RubroCatalogo" rc ON rc."codigo" = r."codigoRubro"
        LEFT JOIN "SubrubroCatalogo" sc ON sc."codigo" = r."codigoSubrubro"
        WHERE rc."codigo" IS NULL OR sc."codigo" IS NULL OR sc."codigoRubro" <> r."codigoRubro"
      ) AS "referenciasCatalogoInvalidas",
      (SELECT count(*)::int FROM "RubroCatalogo" WHERE "activo") AS "rubrosCatalogo",
      (SELECT count(*)::int FROM "SubrubroCatalogo" WHERE "activo") AS "subrubrosCatalogo",
      (SELECT count(*)::int FROM rel WHERE "rubro" IN (
        'BEBIDAS FRIAS Y CALIENTES', 'POSTRES Y SNACKS',
        'TRANSPORTE, TAXIS, DELIVERY Y COURIER'
      )) AS "rubrosAnteriores",
      (SELECT count(*)::int FROM rel WHERE "rubro" NOT IN (
        'BEBIDAS ALCOHOLICAS', 'BEBIDAS FRIAS', 'BEBIDAS CALIENTES',
        'DESAYUNOS', 'FLORES', 'PLATOS A LA CARTA', 'POSTRES', 'SNACKS',
        'TORTAS', 'TRANSPORTES'
      )) AS "taxonomiaInvalida",
      (SELECT count(*)::int FROM principal_counts pc JOIN argentina a ON a."id" = pc."id"
        WHERE a."activo" AND pc.relaciones = 0) AS "activosSinRelacion",
      (SELECT count(*)::int FROM principal_counts pc JOIN argentina a ON a."id" = pc."id"
        WHERE a."activo" AND pc.principales = 0) AS "activosSinPrincipal",
      (SELECT count(*)::int FROM principal_counts WHERE principales > 1) AS "multiplesPrincipales",
      (SELECT count(*)::int FROM principal_counts pc JOIN argentina a ON a."id" = pc."id"
        WHERE NOT a."activo" AND pc.relaciones = 0) AS "inactivosSinRelacion",
      (SELECT count(*)::int FROM argentina
        WHERE COALESCE("evidenciaVerificacion"::text, '') ILIKE '%POSSIBLE_DUPLICATE%') AS "posiblesDuplicadosMarcados",
      (SELECT count(*)::int FROM argentina a JOIN principal p ON p."proveedorId" = a."id"
        WHERE upper(trim(COALESCE(a."rubro", ''))) IS DISTINCT FROM upper(trim(COALESCE(p."rubro", '')))) AS "legacyRubroDiferente",
      (SELECT count(*)::int FROM argentina a JOIN principal p ON p."proveedorId" = a."id"
        WHERE upper(trim(COALESCE(a."subrubro", ''))) IS DISTINCT FROM upper(trim(COALESCE(p."subrubro", '')))) AS "legacySubrubroDiferente",
      (SELECT count(*)::int FROM argentina a JOIN principal p ON p."proveedorId" = a."id"
        WHERE trim(COALESCE(a."productosComercializa", '')) IS DISTINCT FROM trim(COALESCE(p."productosComercializa", ''))) AS "legacyProductosDiferentes",
      (SELECT count(*)::int FROM argentina a
        WHERE NULLIF(trim(COALESCE(a."fuenteVerificacion", '')), '') IS NULL
          AND NOT EXISTS (SELECT 1 FROM rel r WHERE r."proveedorId" = a."id"
            AND NULLIF(trim(COALESCE(r."fuenteVerificacion", '')), '') IS NOT NULL)) AS "proveedoresSinFuente",
      (SELECT count(*)::int FROM argentina a
        WHERE NULLIF(trim(COALESCE(a."productosComercializa", '')), '') IS NULL
          AND NOT EXISTS (SELECT 1 FROM rel r WHERE r."proveedorId" = a."id"
            AND NULLIF(trim(COALESCE(r."productosComercializa", '')), '') IS NOT NULL)) AS "proveedoresSinProductos",
      (SELECT count(*)::int FROM rel WHERE NULLIF(trim(COALESCE("fuenteVerificacion", '')), '') IS NULL) AS "relacionesSinFuente",
      (SELECT count(*)::int FROM rel WHERE NULLIF(trim(COALESCE("productosComercializa", '')), '') IS NULL) AS "relacionesSinProductos",
      (SELECT "ultimoNumero" FROM "SecuenciaProveedorPais" WHERE "codigoPais" = 'AR') AS "secuenciaAR",
      (SELECT max(substring(trim("codigoProveedor") FROM 3)::int) FROM argentina
        WHERE trim("codigoProveedor") ~ '^AR[0-9]{8}$') AS "maximoCodigo"
  `);
  if (summaryRows.length !== 1)
    throw new Error('La auditoría no devolvió un resumen único');

  const categories = await tx.$queryRawUnsafe<CategoryRow[]>(`
    WITH argentina AS (
      SELECT p."id" FROM "Proveedor" p
      WHERE upper(trim(COALESCE(p."codigoPais", ''))) = 'AR'
         OR regexp_replace(
              translate(lower(trim(COALESCE(p."pais", ''))), 'áéíóúüñ', 'aeiouun'),
              '[^a-z0-9]+', '', 'g'
            ) IN ('argentina', 'republicaargentina')
    )
    SELECT pr."codigoRubro", pr."rubro", count(*)::int AS "relaciones"
    FROM "ProveedorRubro" pr JOIN argentina a ON a."id" = pr."proveedorId"
    GROUP BY pr."codigoRubro", pr."rubro"
    ORDER BY pr."codigoRubro"
  `);
  return { summary: summaryRows[0], categories };
}

async function main(): Promise<void> {
  const selectedMode = mode();
  const sql = await fs.readFile(
    path.resolve(
      process.cwd(),
      'prisma/imports/argentina-20261002-correction.sql',
    ),
    'utf8',
  );

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        if (selectedMode === 'dry-run') await tx.$executeRawUnsafe(sql);
        const inspected = await inspect(tx);
        validate(inspected);
        if (selectedMode === 'dry-run') throw new DryRunRollback(inspected);
        return inspected;
      },
      { maxWait: 30_000, timeout: 600_000 },
    );
    emit('VERIFIED', result);
  } catch (error) {
    if (error instanceof DryRunRollback) {
      emit('DRY_RUN_OK', error.result);
      return;
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error('ARGENTINA_CORRECTION_FAILED', error);
  process.exitCode = 1;
});
