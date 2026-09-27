import { Prisma, PrismaClient } from '@prisma/client';
import {
  formarCodigoProveedor,
  resolverCodigoPais,
} from '../proveedores/codigo-proveedor';

type ProveedorImportable = {
  razonSocial: string;
  pais: string;
  ciudad: string;
  direccion?: string;
  distrito?: string;
  rubro: string;
  subrubro: string;
  productosComercializa: string;
  personaContacto: string;
  website?: string;
  redesSociales?: string;
  comentarios?: string;
  email: string;
  telefono: string;
  whatsapp: string;
  fuenteVerificacion: string;
  fechaDiscovery?: string;
  evidenciaVerificacion?: Prisma.InputJsonValue;
};

const prisma = new PrismaClient();

function requiredText(
  proveedor: Record<string, unknown>,
  field: keyof ProveedorImportable,
  rowNumber: number,
): string {
  const value = proveedor[field];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(
      `Registro ${rowNumber}: falta el campo obligatorio ${field}`,
    );
  }
  return value.trim();
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parseBatch(raw: string): ProveedorImportable[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('SUPPLIER_IMPORT_BATCH_JSON debe contener un arreglo JSON');
  }

  return parsed.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`Registro ${index + 1}: formato inválido`);
    }

    const row = item as Record<string, unknown>;
    const email = requiredText(row, 'email', index + 1).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(`Registro ${index + 1}: email inválido`);
    }

    const fechaDiscovery = optionalText(row.fechaDiscovery);
    if (fechaDiscovery && !/^\d{4}-\d{2}-\d{2}$/.test(fechaDiscovery)) {
      throw new Error(
        `Registro ${index + 1}: fechaDiscovery debe ser YYYY-MM-DD`,
      );
    }

    return {
      razonSocial: requiredText(row, 'razonSocial', index + 1),
      pais: requiredText(row, 'pais', index + 1),
      ciudad: requiredText(row, 'ciudad', index + 1),
      direccion: optionalText(row.direccion),
      distrito: optionalText(row.distrito),
      rubro: requiredText(row, 'rubro', index + 1),
      subrubro: requiredText(row, 'subrubro', index + 1),
      productosComercializa: requiredText(
        row,
        'productosComercializa',
        index + 1,
      ),
      personaContacto: requiredText(row, 'personaContacto', index + 1),
      website: optionalText(row.website),
      redesSociales: optionalText(row.redesSociales),
      comentarios: optionalText(row.comentarios),
      email,
      telefono: requiredText(row, 'telefono', index + 1),
      whatsapp: requiredText(row, 'whatsapp', index + 1),
      fuenteVerificacion: requiredText(row, 'fuenteVerificacion', index + 1),
      fechaDiscovery,
      evidenciaVerificacion: row.evidenciaVerificacion as
        | Prisma.InputJsonValue
        | undefined,
    };
  });
}

async function generarCodigoProveedor(
  tx: Prisma.TransactionClient,
  codigoPais: string,
): Promise<string> {
  const secuencias = await tx.$queryRaw<{ ultimoNumero: number }[]>`
    INSERT INTO "SecuenciaProveedorPais" (
      "codigoPais",
      "ultimoNumero",
      "createdAt",
      "updatedAt"
    )
    VALUES (${codigoPais}, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("codigoPais") DO UPDATE
    SET
      "ultimoNumero" = "SecuenciaProveedorPais"."ultimoNumero" + 1,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "SecuenciaProveedorPais"."ultimoNumero" < 99999999
    RETURNING "ultimoNumero"
  `;

  if (!secuencias[0]) {
    throw new Error(`Se agotó la numeración para el país ${codigoPais}`);
  }

  return formarCodigoProveedor(codigoPais, secuencias[0].ultimoNumero);
}

async function main() {
  const raw = process.env.SUPPLIER_IMPORT_BATCH_JSON;
  if (!raw?.trim()) {
    console.log('IMPORT_RESULT []');
    return;
  }

  const proveedores = parseBatch(raw);
  if (proveedores.length === 0) {
    console.log('IMPORT_RESULT []');
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const rows: Array<{
      razonSocial: string;
      estado: 'CREATED' | 'SKIPPED';
      codigoProveedor: string | null;
    }> = [];

    for (const proveedor of proveedores) {
      const codigoPais = resolverCodigoPais(proveedor.pais);
      if (!codigoPais) {
        throw new Error(
          `No se pudo identificar el país de ${proveedor.razonSocial}`,
        );
      }

      const duplicado = await tx.proveedor.findFirst({
        where: {
          OR: [
            { email: { equals: proveedor.email, mode: 'insensitive' } },
            ...(proveedor.website
              ? [
                  {
                    website: {
                      equals: proveedor.website,
                      mode: Prisma.QueryMode.insensitive,
                    },
                  },
                ]
              : []),
            {
              AND: [
                {
                  razonSocial: {
                    equals: proveedor.razonSocial,
                    mode: 'insensitive',
                  },
                },
                { codigoPais },
              ],
            },
          ],
        },
        select: { razonSocial: true, codigoProveedor: true },
      });

      if (duplicado) {
        rows.push({
          razonSocial: duplicado.razonSocial,
          estado: 'SKIPPED',
          codigoProveedor: duplicado.codigoProveedor,
        });
        continue;
      }

      const codigoProveedor = await generarCodigoProveedor(tx, codigoPais);
      const created = await tx.proveedor.create({
        data: {
          codigoProveedor,
          codigoPais,
          razonSocial: proveedor.razonSocial,
          pais: proveedor.pais,
          ciudad: proveedor.ciudad,
          direccion: proveedor.direccion,
          distrito: proveedor.distrito,
          rubro: proveedor.rubro,
          subrubro: proveedor.subrubro,
          productosComercializa: proveedor.productosComercializa,
          personaContacto: proveedor.personaContacto,
          website: proveedor.website,
          redesSociales: proveedor.redesSociales,
          comentarios: proveedor.comentarios,
          email: proveedor.email,
          telefono: proveedor.telefono,
          whatsapp: proveedor.whatsapp,
          estadoVerificacion: 'VE',
          fechaVerificacion: new Date(),
          fuenteVerificacion: proveedor.fuenteVerificacion,
          fechaDiscovery: proveedor.fechaDiscovery
            ? new Date(`${proveedor.fechaDiscovery}T00:00:00.000Z`)
            : undefined,
          ...(proveedor.evidenciaVerificacion !== undefined && {
            evidenciaVerificacion: proveedor.evidenciaVerificacion,
          }),
          activo: true,
        },
        select: { razonSocial: true, codigoProveedor: true },
      });

      rows.push({
        razonSocial: created.razonSocial,
        estado: 'CREATED',
        codigoProveedor: created.codigoProveedor,
      });
    }

    return rows;
  });

  console.log(`IMPORT_RESULT ${JSON.stringify(result)}`);
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`IMPORT_ERROR ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
