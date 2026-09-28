import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

type ImportAuditRow = {
  runId: string;
  pais: string;
  filasFuente: number;
  proveedoresPayload: number;
  creados: number;
  actualizados: number;
  conflictosOmitidos: number;
  relacionesProcesadas: number;
  verificados: number;
  noVerificados: number;
  detalle: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
};

type CountRow = { key: string; count: number };
type DatabaseAuditRow = {
  providers: number;
  relations: number;
  providersWithMultipleRubros: number;
  firstCode: string | null;
  lastCode: string | null;
  sequence: number | null;
  invalidCodes: number;
  invalidStatuses: number;
  missingPrincipal: number;
  multiplePrincipals: number;
  topLevelMismatch: number;
  invalidTaxonomy: number;
  veCriteriaFailures: number;
  duplicateExactNameGroups: number;
};

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('auditoria-carga-paraguay-20260928')
  async getParaguayImportAudit() {
    const [run] = await this.prisma.$queryRawUnsafe<ImportAuditRow[]>(`
      SELECT
        "runId", "pais", "filasFuente", "proveedoresPayload", "creados",
        "actualizados", "conflictosOmitidos", "relacionesProcesadas",
        "verificados", "noVerificados", "detalle", "createdAt", "updatedAt"
      FROM "CargaProveedorAuditoria"
      WHERE "runId" = 'paraguay-20260928-v1'
    `);

    const statuses = await this.prisma.$queryRawUnsafe<CountRow[]>(`
      SELECT "estadoVerificacion" AS key, count(*)::integer AS count
      FROM "Proveedor"
      WHERE "codigoPais" = 'PY'
      GROUP BY "estadoVerificacion"
      ORDER BY key
    `);
    const rubros = await this.prisma.$queryRawUnsafe<CountRow[]>(`
      SELECT pr."rubro" AS key, count(*)::integer AS count
      FROM "ProveedorRubro" pr
      JOIN "Proveedor" p ON p."id" = pr."proveedorId"
      WHERE p."codigoPais" = 'PY'
      GROUP BY pr."rubro"
      ORDER BY pr."rubro"
    `);
    const [database] = await this.prisma.$queryRawUnsafe<DatabaseAuditRow[]>(`
      WITH py AS (
        SELECT * FROM "Proveedor" WHERE "codigoPais" = 'PY'
      ), relation_counts AS (
        SELECT
          py."id",
          count(pr."id")::integer AS relation_count,
          count(DISTINCT pr."rubro")::integer AS rubro_count,
          count(*) FILTER (WHERE pr."esPrincipal")::integer AS principal_count,
          max(pr."rubro") FILTER (WHERE pr."esPrincipal") AS principal_rubro,
          max(pr."subrubro") FILTER (WHERE pr."esPrincipal") AS principal_subrubro
        FROM py
        LEFT JOIN "ProveedorRubro" pr ON pr."proveedorId" = py."id"
        GROUP BY py."id"
      ), duplicate_names AS (
        SELECT regexp_replace(
          translate(lower(trim("razonSocial")), 'áéíóúüñãõç', 'aeiouunaoc'),
          '[^a-z0-9]+', '', 'g'
        ) AS name_key
        FROM py
        GROUP BY name_key
        HAVING count(*) > 1
      )
      SELECT
        (SELECT count(*)::integer FROM py) AS providers,
        (SELECT COALESCE(sum(relation_count), 0)::integer FROM relation_counts) AS relations,
        (SELECT count(*)::integer FROM relation_counts WHERE rubro_count > 1) AS "providersWithMultipleRubros",
        (SELECT min("codigoProveedor") FROM py) AS "firstCode",
        (SELECT max("codigoProveedor") FROM py) AS "lastCode",
        (SELECT "ultimoNumero" FROM "SecuenciaProveedorPais" WHERE "codigoPais" = 'PY') AS "sequence",
        (SELECT count(*)::integer FROM py WHERE "codigoProveedor" !~ '^PY[0-9]{8}$') AS "invalidCodes",
        (SELECT count(*)::integer FROM py WHERE "estadoVerificacion" NOT IN ('VE', 'NV', 'NF', 'IN')) AS "invalidStatuses",
        (SELECT count(*)::integer FROM relation_counts WHERE principal_count = 0) AS "missingPrincipal",
        (SELECT count(*)::integer FROM relation_counts WHERE principal_count > 1) AS "multiplePrincipals",
        (
          SELECT count(*)::integer
          FROM py
          JOIN relation_counts rc ON rc."id" = py."id"
          WHERE rc.principal_count = 1
            AND (py."rubro" IS DISTINCT FROM rc.principal_rubro OR py."subrubro" IS DISTINCT FROM rc.principal_subrubro)
        ) AS "topLevelMismatch",
        (
          SELECT count(*)::integer
          FROM "ProveedorRubro" pr
          JOIN py ON py."id" = pr."proveedorId"
          WHERE pr."rubro" NOT IN (
            'BEBIDAS ALCOHOLICAS', 'BEBIDAS FRIAS Y CALIENTES', 'DESAYUNOS', 'FLORES',
            'PLATOS A LA CARTA', 'POSTRES Y SNACKS', 'TORTAS',
            'TRANSPORTE, TAXIS, DELIVERY Y COURIER'
          ) OR NULLIF(trim(pr."subrubro"), '') IS NULL OR pr."subrubro" <> upper(pr."subrubro")
        ) AS "invalidTaxonomy",
        (
          SELECT count(*)::integer
          FROM py
          WHERE "estadoVerificacion" = 'VE'
            AND (
              COALESCE(NULLIF(trim("telefono"), ''), NULLIF(trim("whatsapp"), ''), NULLIF(trim("email"), '')) IS NULL
              OR NULLIF(trim("fuenteVerificacion"), '') IS NULL
              OR NULLIF(trim("productosComercializa"), '') IS NULL
            )
        ) AS "veCriteriaFailures",
        (SELECT count(*)::integer FROM duplicate_names) AS "duplicateExactNameGroups"
    `);

    return {
      deployment: 'paraguay-20260928-v1',
      run: run ?? null,
      database,
      statuses: Object.fromEntries(statuses.map((row) => [row.key, row.count])),
      rubros: Object.fromEntries(rubros.map((row) => [row.key, row.count])),
    };
  }
}
