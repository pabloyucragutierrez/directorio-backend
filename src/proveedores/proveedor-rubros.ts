import { Prisma } from '@prisma/client';

export type AsignacionRubroInput = {
  rubro?: string | null;
  subrubro?: string | null;
  productosComercializa?: string | null;
  fuenteVerificacion?: string | null;
  evidenciaVerificacion?: Prisma.InputJsonValue | null;
};

export type AsignacionRubroNormalizada = {
  rubro: string;
  subrubro: string;
  productosComercializa?: string;
  fuenteVerificacion?: string;
  evidenciaVerificacion?: Prisma.InputJsonValue;
};

function optionalText(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function categoryKey(rubro: string, subrubro: string): string {
  return `${rubro
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()}::${subrubro
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()}`;
}

/**
 * Limpia y deduplica las clasificaciones antes de guardarlas. La primera
 * clasificación conservada es la principal y alimenta los campos legacy.
 */
export function normalizarAsignacionesRubro(
  asignaciones: AsignacionRubroInput[] | undefined,
  fallback?: AsignacionRubroInput,
): AsignacionRubroNormalizada[] {
  const source =
    asignaciones && asignaciones.length > 0
      ? asignaciones
      : fallback?.rubro
        ? [fallback]
        : [];

  const result: AsignacionRubroNormalizada[] = [];
  const seen = new Set<string>();

  for (const item of source) {
    const rubro = optionalText(item.rubro);
    if (!rubro) continue;

    const subrubro = optionalText(item.subrubro) ?? '';
    const key = categoryKey(rubro, subrubro);
    if (seen.has(key)) continue;
    seen.add(key);

    result.push({
      rubro,
      subrubro,
      productosComercializa: optionalText(item.productosComercializa),
      fuenteVerificacion: optionalText(item.fuenteVerificacion),
      ...(item.evidenciaVerificacion != null && {
        evidenciaVerificacion: item.evidenciaVerificacion,
      }),
    });
  }

  return result;
}
