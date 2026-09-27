export const ESTADOS_VERIFICACION = ['VE', 'NV', 'NF', 'IN'] as const;

export const ESTADO_VERIFICACION_DESCRIPCION = {
  VE: 'Verificado',
  NV: 'No verificado',
  NF: 'No encontrado',
  IN: 'Inferido',
} as const;

const MAXIMO_CORRELATIVO = 99_999_999;

const CODIGOS_ISO_ALPHA_2 = `
AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ
BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ
DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR
GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY
HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP
KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY
MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY
QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ
TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ
VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW
`
  .trim()
  .split(/\s+/);

function normalizarNombrePais(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function construirIndicePaises(): Map<string, string> {
  const indice = new Map<string, string>();
  const nombresEs = new Intl.DisplayNames(['es'], { type: 'region' });
  const nombresEn = new Intl.DisplayNames(['en'], { type: 'region' });

  for (const codigo of CODIGOS_ISO_ALPHA_2) {
    indice.set(codigo.toLowerCase(), codigo);

    for (const nombre of [nombresEs.of(codigo), nombresEn.of(codigo)]) {
      if (nombre) indice.set(normalizarNombrePais(nombre), codigo);
    }
  }

  const alias: Record<string, string> = {
    'ee uu': 'US',
    eeuu: 'US',
    usa: 'US',
    'u s a': 'US',
    'estados unidos de america': 'US',
    uk: 'GB',
    'gran bretana': 'GB',
    'corea del sur': 'KR',
    'corea del norte': 'KP',
    rusia: 'RU',
    iran: 'IR',
    siria: 'SY',
    taiwan: 'TW',
    palestina: 'PS',
    vaticano: 'VA',
    moldavia: 'MD',
    vietnam: 'VN',
  };

  for (const [nombre, codigo] of Object.entries(alias)) {
    indice.set(normalizarNombrePais(nombre), codigo);
  }

  return indice;
}

const INDICE_PAISES = construirIndicePaises();

export function resolverCodigoPais(pais: string): string | null {
  return INDICE_PAISES.get(normalizarNombrePais(pais)) ?? null;
}

export function formarCodigoProveedor(
  codigoPais: string,
  correlativo: number,
): string {
  const codigoNormalizado = codigoPais.trim().toUpperCase();

  if (!/^[A-Z]{2}$/.test(codigoNormalizado)) {
    throw new Error('El código de país debe contener exactamente dos letras');
  }

  if (
    !Number.isInteger(correlativo) ||
    correlativo < 1 ||
    correlativo > MAXIMO_CORRELATIVO
  ) {
    throw new Error('El correlativo debe estar entre 1 y 99999999');
  }

  return `${codigoNormalizado}${String(correlativo).padStart(8, '0')}`;
}
