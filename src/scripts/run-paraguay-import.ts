import fs from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { Prisma, PrismaClient } from '@prisma/client';

const RUN_ID = 'paraguay-20260928-v1';
const EXPECTED_SOURCE_ROWS = 1364;
const EXPECTED_PROVIDERS = 1120;
const EXPECTED_RELATIONS = 1565;

const OFFICIAL_RUBROS = [
  'BEBIDAS ALCOHOLICAS',
  'BEBIDAS FRIAS Y CALIENTES',
  'DESAYUNOS',
  'FLORES',
  'PLATOS A LA CARTA',
  'POSTRES Y SNACKS',
  'TORTAS',
  'TRANSPORTE, TAXIS, DELIVERY Y COURIER',
] as const;

type ImportMode = 'dry-run' | 'apply';

type AuditRow = {
  filasFuente: number;
  proveedoresPayload: number;
  creados: number;
  actualizados: number;
  conflictosOmitidos: number;
  relacionesProcesadas: number;
  verificados: number;
  noVerificados: number;
  detalle: Prisma.JsonValue | null;
};

type IntegrityRow = {
  proveedoresImportados: number;
  codigosInvalidos: number;
  estadosInvalidos: number;
  veSinContacto: number;
  sinPrincipal: number;
  multiplesPrincipales: number;
  taxonomiaInvalida: number;
  gruposDuplicadosExactos: number;
  proveedoresMultirubro: number;
  relacionesAsociadas: number;
  codigoMinimo: string | null;
  codigoMaximo: string | null;
};

type RubroRow = {
  rubro: string;
  cantidad: number;
};

type ImportSummary = {
  runId: string;
  audit: AuditRow;
  integrity: IntegrityRow;
  rubros: Record<string, number>;
};

class DryRunRollback extends Error {
  constructor(readonly summary: ImportSummary) {
    super('PARAGUAY_DRY_RUN_ROLLBACK');
  }
}

function importMode(): ImportMode {
  const mode = process.env.PARAGUAY_IMPORT_MODE;
  if (mode !== 'dry-run' && mode !== 'apply') {
    throw new Error(
      'PARAGUAY_IMPORT_MODE debe ser exactamente dry-run o apply',
    );
  }
  return mode;
}

function assertEqual(label: string, actual: number, expected: number): void {
  if (actual !== expected) {
    throw new Error(`${label}: esperado ${expected}, obtenido ${actual}`);
  }
}

function validateSummary(summary: ImportSummary): void {
  const { audit, integrity, rubros } = summary;

  assertEqual('filas fuente', audit.filasFuente, EXPECTED_SOURCE_ROWS);
  assertEqual(
    'proveedores del payload',
    audit.proveedoresPayload,
    EXPECTED_PROVIDERS,
  );
  assertEqual(
    'proveedores procesados',
    audit.creados + audit.actualizados + audit.conflictosOmitidos,
    EXPECTED_PROVIDERS,
  );
  assertEqual('conflictos omitidos', audit.conflictosOmitidos, 0);
  assertEqual(
    'relaciones procesadas',
    audit.relacionesProcesadas,
    EXPECTED_RELATIONS,
  );
  assertEqual(
    'estados procesados',
    audit.verificados + audit.noVerificados,
    EXPECTED_PROVIDERS,
  );
  assertEqual(
    'proveedores identificados por evidencia',
    integrity.proveedoresImportados,
    EXPECTED_PROVIDERS,
  );
  assertEqual('códigos inválidos', integrity.codigosInvalidos, 0);
  assertEqual('estados inválidos', integrity.estadosInvalidos, 0);
  assertEqual('VE sin contacto', integrity.veSinContacto, 0);
  assertEqual('proveedores sin rubro principal', integrity.sinPrincipal, 0);
  assertEqual(
    'proveedores con múltiples rubros principales',
    integrity.multiplesPrincipales,
    0,
  );
  assertEqual('taxonomía inválida', integrity.taxonomiaInvalida, 0);
  assertEqual(
    'grupos duplicados exactos',
    integrity.gruposDuplicadosExactos,
    0,
  );

  for (const rubro of OFFICIAL_RUBROS) {
    if (!rubros[rubro]) {
      throw new Error(`El rubro oficial ${rubro} quedó sin asociaciones`);
    }
  }
}

async function inspectImport(
  tx: Prisma.TransactionClient,
): Promise<ImportSummary> {
  const auditRows = await tx.$queryRawUnsafe<AuditRow[]>(`
    SELECT
      "filasFuente",
      "proveedoresPayload",
      "creados",
      "actualizados",
      "conflictosOmitidos",
      "relacionesProcesadas",
      "verificados",
      "noVerificados",
      "detalle"
    FROM "CargaProveedorAuditoria"
    WHERE "runId" = '${RUN_ID}'
  `);
  if (auditRows.length !== 1) {
    throw new Error(`No se encontró una auditoría única para ${RUN_ID}`);
  }

  const integrityRows = await tx.$queryRawUnsafe<IntegrityRow[]>(`
    WITH imported AS (
      SELECT p.*
      FROM "Proveedor" p
      WHERE p."evidenciaVerificacion"->>'runId' = '${RUN_ID}'
    ), exact_name_groups AS (
      SELECT regexp_replace(
        translate(lower(trim(i."razonSocial")), 'áéíóúüñãõç', 'aeiouunaoc'),
        '[^a-z0-9]+', '', 'g'
      ) AS name_key
      FROM imported i
      GROUP BY 1
      HAVING count(*) > 1
    )
    SELECT
      (SELECT count(*)::int FROM imported) AS "proveedoresImportados",
      (SELECT count(*)::int FROM imported
        WHERE "codigoProveedor" !~ '^PY[0-9]{8}$') AS "codigosInvalidos",
      (SELECT count(*)::int FROM imported
        WHERE "estadoVerificacion" NOT IN ('VE', 'NV')) AS "estadosInvalidos",
      (SELECT count(*)::int FROM imported
        WHERE "estadoVerificacion" = 'VE'
          AND COALESCE(
            NULLIF(trim("telefono"), ''),
            NULLIF(trim("whatsapp"), ''),
            NULLIF(trim("email"), '')
          ) IS NULL) AS "veSinContacto",
      (SELECT count(*)::int FROM imported i
        WHERE (SELECT count(*) FROM "ProveedorRubro" pr
          WHERE pr."proveedorId" = i."id" AND pr."esPrincipal") = 0
      ) AS "sinPrincipal",
      (SELECT count(*)::int FROM imported i
        WHERE (SELECT count(*) FROM "ProveedorRubro" pr
          WHERE pr."proveedorId" = i."id" AND pr."esPrincipal") > 1
      ) AS "multiplesPrincipales",
      (SELECT count(*)::int
        FROM "ProveedorRubro" pr
        JOIN imported i ON i."id" = pr."proveedorId"
        WHERE pr."rubro" NOT IN (
          'BEBIDAS ALCOHOLICAS',
          'BEBIDAS FRIAS Y CALIENTES',
          'DESAYUNOS',
          'FLORES',
          'PLATOS A LA CARTA',
          'POSTRES Y SNACKS',
          'TORTAS',
          'TRANSPORTE, TAXIS, DELIVERY Y COURIER'
        )
      ) AS "taxonomiaInvalida",
      (SELECT count(*)::int FROM exact_name_groups) AS "gruposDuplicadosExactos",
      (SELECT count(*)::int FROM imported i
        WHERE (SELECT count(*) FROM "ProveedorRubro" pr
          WHERE pr."proveedorId" = i."id") > 1
      ) AS "proveedoresMultirubro",
      (SELECT count(*)::int
        FROM "ProveedorRubro" pr
        JOIN imported i ON i."id" = pr."proveedorId"
      ) AS "relacionesAsociadas",
      (SELECT min("codigoProveedor") FROM imported) AS "codigoMinimo",
      (SELECT max("codigoProveedor") FROM imported) AS "codigoMaximo"
  `);
  if (integrityRows.length !== 1) {
    throw new Error('La consulta de integridad no devolvió una fila');
  }

  const rubroRows = await tx.$queryRawUnsafe<RubroRow[]>(`
    WITH imported AS (
      SELECT p."id"
      FROM "Proveedor" p
      WHERE p."evidenciaVerificacion"->>'runId' = '${RUN_ID}'
    )
    SELECT pr."rubro", count(*)::int AS "cantidad"
    FROM "ProveedorRubro" pr
    JOIN imported i ON i."id" = pr."proveedorId"
    GROUP BY pr."rubro"
    ORDER BY pr."rubro"
  `);

  return {
    runId: RUN_ID,
    audit: auditRows[0],
    integrity: integrityRows[0],
    rubros: Object.fromEntries(
      rubroRows.map((row) => [row.rubro, row.cantidad]),
    ),
  };
}

async function main(): Promise<void> {
  const mode = importMode();
  const importDirectory = path.resolve(process.cwd(), 'prisma/imports');
  const [template, compressedPayload] = await Promise.all([
    fs.readFile(
      path.join(importDirectory, 'paraguay-20260928.template.sql'),
      'utf8',
    ),
    fs.readFile(
      path.join(importDirectory, 'paraguay-20260928.payload.json.gz.b64'),
      'utf8',
    ),
  ]);
  const payloadJson = gunzipSync(
    Buffer.from(compressedPayload.trim(), 'base64'),
  ).toString('utf8');
  const payload: unknown = JSON.parse(payloadJson);
  if (!Array.isArray(payload) || payload.length !== EXPECTED_PROVIDERS) {
    throw new Error(
      'El payload comprimido de Paraguay no superó la validación',
    );
  }

  const marker = '__PARAGUAY_PAYLOAD_JSON__';
  if (template.split(marker).length !== 2) {
    throw new Error(
      'La plantilla SQL no contiene un único marcador de payload',
    );
  }
  const sql = template.replace(marker, payloadJson);
  const prisma = new PrismaClient();

  try {
    const summary = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(sql);
        const result = await inspectImport(tx);
        validateSummary(result);

        if (mode === 'dry-run') {
          throw new DryRunRollback(result);
        }
        return result;
      },
      { maxWait: 30_000, timeout: 300_000 },
    );

    console.log(`PARAGUAY_IMPORT_APPLIED=${JSON.stringify(summary)}`);
  } catch (error) {
    if (error instanceof DryRunRollback) {
      console.log(
        `PARAGUAY_IMPORT_DRY_RUN_OK=${JSON.stringify(error.summary)}`,
      );
      return;
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error('PARAGUAY_IMPORT_FAILED', error);
  process.exitCode = 1;
});
