import fs from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
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
  personaContacto?: string;
  website?: string;
  redesSociales?: string;
  comentarios?: string;
  email?: string;
  telefono?: string;
  whatsapp?: string;
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

export function parseBatch(raw: string): ProveedorImportable[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('SUPPLIER_IMPORT_BATCH_JSON debe contener un arreglo JSON');
  }

  return parsed.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`Registro ${index + 1}: formato inválido`);
    }

    const row = item as Record<string, unknown>;
    const email = optionalText(row.email)?.toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(`Registro ${index + 1}: email inválido`);
    }

    const telefono = optionalText(row.telefono);
    const whatsapp = optionalText(row.whatsapp);
    if (!telefono && !whatsapp && !email) {
      throw new Error(
        `Registro ${index + 1}: se requiere teléfono, WhatsApp o email`,
      );
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
      personaContacto: optionalText(row.personaContacto),
      website: optionalText(row.website),
      redesSociales: optionalText(row.redesSociales),
      comentarios: optionalText(row.comentarios),
      email,
      telefono,
      whatsapp,
      fuenteVerificacion: requiredText(row, 'fuenteVerificacion', index + 1),
      fechaDiscovery,
      evidenciaVerificacion: row.evidenciaVerificacion as
        | Prisma.InputJsonValue
        | undefined,
    };
  });
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function contactKeys(value?: string | null): string[] {
  if (!value) return [];
  const keys = value
    .split(/[\n,;|/]+/)
    .map((part) => part.replace(/\D/g, ''))
    .filter((digits) => digits.length >= 7)
    .map((digits) =>
      digits.length === 11 && /^(51|56)/.test(digits)
        ? digits.slice(2)
        : digits,
    );
  return [...new Set(keys)];
}

function websiteKey(value?: string | null): string | undefined {
  if (!value) return undefined;
  const first = value.split(/\s*\|\s*|\n/)[0]?.trim();
  if (!first) return undefined;
  try {
    const parsed = new URL(first);
    return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname}`
      .replace(/\/+$/, '')
      .toLowerCase();
  } catch {
    const normalized = normalizeText(first);
    return normalized || undefined;
  }
}

type ExistingProvider = {
  razonSocial: string;
  codigoPais: string | null;
  codigoProveedor: string | null;
  email: string | null;
  telefono: string | null;
  whatsapp: string | null;
  website: string | null;
};

function registerProvider(
  provider: ExistingProvider,
  indexes: {
    byName: Map<string, ExistingProvider>;
    byEmail: Map<string, ExistingProvider>;
    byContact: Map<string, ExistingProvider>;
    byWebsite: Map<string, ExistingProvider>;
  },
) {
  if (provider.codigoPais) {
    indexes.byName.set(
      `${provider.codigoPais}:${normalizeText(provider.razonSocial)}`,
      provider,
    );
  }
  if (provider.email)
    indexes.byEmail.set(provider.email.toLowerCase(), provider);
  for (const key of [
    ...contactKeys(provider.telefono),
    ...contactKeys(provider.whatsapp),
  ]) {
    indexes.byContact.set(key, provider);
  }
  const web = websiteKey(provider.website);
  if (web) indexes.byWebsite.set(web, provider);
}

function findDuplicate(
  proveedor: ProveedorImportable,
  codigoPais: string,
  indexes: {
    byName: Map<string, ExistingProvider>;
    byEmail: Map<string, ExistingProvider>;
    byContact: Map<string, ExistingProvider>;
    byWebsite: Map<string, ExistingProvider>;
  },
): ExistingProvider | undefined {
  const byName = indexes.byName.get(
    `${codigoPais}:${normalizeText(proveedor.razonSocial)}`,
  );
  if (byName) return byName;

  if (proveedor.email) {
    const byEmail = indexes.byEmail.get(proveedor.email.toLowerCase());
    if (byEmail) return byEmail;
  }

  for (const key of [
    ...contactKeys(proveedor.telefono),
    ...contactKeys(proveedor.whatsapp),
  ]) {
    const byContact = indexes.byContact.get(key);
    if (byContact) return byContact;
  }

  const web = websiteKey(proveedor.website);
  return web ? indexes.byWebsite.get(web) : undefined;
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
  const importFile = process.env.SUPPLIER_IMPORT_BATCH_FILE;
  const compressedPartCount = Number(
    process.env.SUPPLIER_IMPORT_GZIP_PART_COUNT ?? 0,
  );
  let raw: string | undefined;

  if (importFile) {
    raw = await fs.readFile(importFile, 'utf8');
  } else if (compressedPartCount > 0) {
    if (!Number.isInteger(compressedPartCount) || compressedPartCount > 100) {
      throw new Error('SUPPLIER_IMPORT_GZIP_PART_COUNT inválido');
    }

    const parts: string[] = [];
    for (let index = 1; index <= compressedPartCount; index += 1) {
      const name = `SUPPLIER_IMPORT_GZIP_PART_${String(index).padStart(3, '0')}`;
      const part = process.env[name];
      if (!part) throw new Error(`Falta la variable ${name}`);
      parts.push(part);
    }
    raw = gunzipSync(Buffer.from(parts.join(''), 'base64')).toString('utf8');
  } else {
    raw = process.env.SUPPLIER_IMPORT_BATCH_JSON;
  }
  if (!raw?.trim()) {
    console.log('IMPORT_RESULT []');
    return;
  }

  const proveedores = parseBatch(raw);
  if (proveedores.length === 0) {
    console.log('IMPORT_RESULT []');
    return;
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const existing = await tx.proveedor.findMany({
        select: {
          razonSocial: true,
          codigoPais: true,
          codigoProveedor: true,
          email: true,
          telefono: true,
          whatsapp: true,
          website: true,
        },
      });
      const indexes = {
        byName: new Map<string, ExistingProvider>(),
        byEmail: new Map<string, ExistingProvider>(),
        byContact: new Map<string, ExistingProvider>(),
        byWebsite: new Map<string, ExistingProvider>(),
      };
      for (const provider of existing) registerProvider(provider, indexes);

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

        const duplicado = findDuplicate(proveedor, codigoPais, indexes);

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
        registerProvider(
          {
            ...created,
            codigoPais,
            email: proveedor.email ?? null,
            telefono: proveedor.telefono ?? null,
            whatsapp: proveedor.whatsapp ?? null,
            website: proveedor.website ?? null,
          },
          indexes,
        );
      }

      return rows;
    },
    {
      maxWait: 10_000,
      timeout: 300_000,
    },
  );

  const created = result.filter((row) => row.estado === 'CREATED');
  const skipped = result.filter((row) => row.estado === 'SKIPPED');
  console.log(
    `IMPORT_RESULT_SUMMARY ${JSON.stringify({
      received: result.length,
      created: created.length,
      skipped: skipped.length,
      firstCreatedCode: created[0]?.codigoProveedor ?? null,
      lastCreatedCode: created[created.length - 1]?.codigoProveedor ?? null,
    })}`,
  );
}

if (require.main === module) {
  main()
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`IMPORT_ERROR ${message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
