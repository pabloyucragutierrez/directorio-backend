import { Prisma, PrismaClient } from '@prisma/client';

// Verificación posterior: corrección y ampliación Bolivia, 2026-10-02.
const prisma = new PrismaClient();

type Mode = 'dry-run' | 'apply' | 'verify';

type Category = {
  codigoRubro: string;
  rubro: string;
  codigoSubrubro: string;
  subrubro: string;
  productosComercializa: string;
  fuenteVerificacion?: string;
};

type Candidate = {
  razonSocial: string;
  codigoProveedorExistenteConfirmado?: string;
  ciudad: string;
  direccion?: string;
  telefono?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  fuenteVerificacion: string;
  tipoFuente: 'OFICIAL' | 'DIRECTORIO_PUBLICO';
  archivoCaptacion: string;
  filaCaptacion: number;
  categories: Category[];
};

type ExistingProvider = {
  id: number;
  codigoProveedor: string | null;
  codigoPais: string | null;
  razonSocial: string;
  pais: string;
  ciudad: string;
  direccion: string | null;
  telefono: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  fuenteVerificacion: string | null;
  productosComercializa: string | null;
  evidenciaVerificacion: Prisma.JsonValue | null;
  estadoVerificacion: string;
  activo: boolean;
};

type Match =
  | { kind: 'NEW' }
  | { kind: 'MATCH'; provider: ExistingProvider; reason: string }
  | { kind: 'CONFLICT'; providers: ExistingProvider[]; reason: string };

type Action = {
  razonSocial: string;
  status:
    | 'CREATED'
    | 'ENRICHED'
    | 'ASSOCIATED'
    | 'PRESENT'
    | 'SKIPPED_CONFLICT';
  codigoProveedor: string | null;
  matchReason: string;
  relationsCreated: number;
  relationsUpdated: number;
  conflictProviders?: Array<{
    codigoProveedor: string | null;
    razonSocial: string;
    ciudad: string;
    telefono: string | null;
    whatsapp: string | null;
    email: string | null;
    website: string | null;
  }>;
};

type Summary = {
  totalProveedores: number;
  activos: number;
  inactivos: number;
  verificados: number;
  noVerificados: number;
  relaciones: number;
  codigosProveedorInvalidos: number;
  codigosProveedorDuplicados: number;
  relacionesSinCodigo: number;
  referenciasCatalogoInvalidas: number;
  activosSinRelacion: number;
  activosSinPrincipal: number;
  multiplesPrincipales: number;
  veSinFuente: number;
  veSinProductos: number;
  veSinContacto: number;
  legacyRubroDiferente: number;
  legacySubrubroDiferente: number;
  legacyProductosDiferentes: number;
  secuenciaBO: number | null;
  maximoCodigo: number | null;
};

type CategoryCount = {
  codigoRubro: string;
  rubro: string;
  relaciones: number;
};

type RunResult = {
  mode: Mode;
  actions: Action[];
  before: Summary;
  after: Summary;
  categories: CategoryCount[];
};

const ALCOHOL_FILE =
  'SUPPLIER_SOURCING_v2_BOLIVIA_BEBIDAS_ALCOHOLICAS_700_CONSOLIDADO.xlsx';
const NON_ALCOHOL_FILE =
  'SUPPLIER_SOURCING_v2_BOLIVIA_BEBIDAS_SIN_ALCOHOL_500_CONSOLIDADO.xlsx';
const BREAKFAST_FILE =
  'SUPPLIER_SOURCING_v2_BOLIVIA_DESAYUNOS_700_CONSOLIDADO.xlsx';

const BA003: Omit<Category, 'productosComercializa'> = {
  codigoRubro: 'BA',
  rubro: 'BEBIDAS ALCOHOLICAS',
  codigoSubrubro: 'BA003',
  subrubro: 'LICORES Y DESTILADOS',
};
const BA004: Omit<Category, 'productosComercializa'> = {
  codigoRubro: 'BA',
  rubro: 'BEBIDAS ALCOHOLICAS',
  codigoSubrubro: 'BA004',
  subrubro: 'VARIEDAD DE BEBIDAS ALCOHOLICAS',
};
const BA005: Omit<Category, 'productosComercializa'> = {
  codigoRubro: 'BA',
  rubro: 'BEBIDAS ALCOHOLICAS',
  codigoSubrubro: 'BA005',
  subrubro: 'VINOS',
};
const BA006: Omit<Category, 'productosComercializa'> = {
  codigoRubro: 'BA',
  rubro: 'BEBIDAS ALCOHOLICAS',
  codigoSubrubro: 'BA006',
  subrubro: 'SINGANI',
};
const BC001: Omit<Category, 'productosComercializa'> = {
  codigoRubro: 'BC',
  rubro: 'BEBIDAS CALIENTES',
  codigoSubrubro: 'BC001',
  subrubro: 'CAFE',
};
const DE001: Omit<Category, 'productosComercializa'> = {
  codigoRubro: 'DE',
  rubro: 'DESAYUNOS',
  codigoSubrubro: 'DE001',
  subrubro: 'CAFE Y DESAYUNO',
};
const DE003: Omit<Category, 'productosComercializa'> = {
  codigoRubro: 'DE',
  rubro: 'DESAYUNOS',
  codigoSubrubro: 'DE003',
  subrubro: 'PANADERIA',
};

const candidates: Candidate[] = [
  {
    razonSocial: 'Licobol Ltda.',
    ciudad: 'Santa Cruz de la Sierra',
    direccion: 'Radial 26, 3er anillo externo',
    telefono: '+591 76062529',
    whatsapp: '+591 76062529',
    email: 'marketingscz@licobol.com.bo',
    website: 'https://licobol.com/',
    fuenteVerificacion: 'https://licobol.com/contacto/',
    tipoFuente: 'OFICIAL',
    archivoCaptacion: ALCOHOL_FILE,
    filaCaptacion: 327,
    categories: [{ ...BA003, productosComercializa: 'Licores y destilados' }],
  },
  {
    razonSocial: 'Wine Store',
    ciudad: 'Santa Cruz de la Sierra',
    whatsapp: '+591 75052045',
    website: 'https://winestore.com.bo/',
    fuenteVerificacion: 'https://winestore.com.bo/winestoreexperience/',
    tipoFuente: 'OFICIAL',
    archivoCaptacion: ALCOHOL_FILE,
    filaCaptacion: 348,
    categories: [{ ...BA005, productosComercializa: 'Vinos' }],
  },
  {
    razonSocial: 'La Barrica',
    ciudad: 'Santa Cruz de la Sierra',
    direccion:
      'Av. San Martín entre 2do y 3er Anillo, esquina Calle 6 Oeste, Local 3',
    telefono: '+591 69011091',
    email: 'daira@alltrade.com.bo',
    website: 'https://labarrica.com.bo/',
    fuenteVerificacion: 'https://labarrica.com.bo/',
    tipoFuente: 'OFICIAL',
    archivoCaptacion: ALCOHOL_FILE,
    filaCaptacion: 394,
    categories: [
      { ...BA004, productosComercializa: 'Vinos, aguardientes y licores' },
    ],
  },
  {
    razonSocial: 'Bodegas Aranjuez',
    codigoProveedorExistenteConfirmado: 'BO00000237',
    ciudad: 'Tarija',
    direccion: 'Av. Ángel Baldivieso #1976, Barrio Aranjuez',
    telefono: '+591 6642552',
    website: 'https://www.vinosaranjuez.com/',
    fuenteVerificacion: 'https://www.vinosaranjuez.com/contacto/',
    tipoFuente: 'OFICIAL',
    archivoCaptacion: ALCOHOL_FILE,
    filaCaptacion: 493,
    categories: [{ ...BA005, productosComercializa: 'Vinos de altura' }],
  },
  {
    razonSocial: 'Bodegas Kohlberg',
    ciudad: 'Tarija',
    direccion: 'Av. Jorge Paz Galarza, Zona San Jorge 1',
    telefono: '+591 4 6636366',
    whatsapp: '+591 78709510',
    email: 'info2@kohlberg.com.bo',
    website: 'https://kohlberg.com.bo/',
    fuenteVerificacion: 'https://kohlberg.com.bo/contacto',
    tipoFuente: 'OFICIAL',
    archivoCaptacion: ALCOHOL_FILE,
    filaCaptacion: 494,
    categories: [{ ...BA005, productosComercializa: 'Vinos de altura' }],
  },
  {
    razonSocial: 'Singani Casa Real',
    ciudad: 'Santa Ana',
    direccion: 'Comunidad Santa Ana, Tarija',
    telefono: '+591 4 6645498',
    whatsapp: '+591 800 10 20 20',
    email: 'info@casa-real.com',
    website: 'https://www.singanicasareal.com/',
    fuenteVerificacion: 'https://www.singanicasareal.com/contacto/',
    tipoFuente: 'OFICIAL',
    archivoCaptacion: ALCOHOL_FILE,
    filaCaptacion: 500,
    categories: [{ ...BA006, productosComercializa: 'Singani' }],
  },
  {
    razonSocial: 'Bodegas Magnus',
    ciudad: 'Tarija',
    direccion: 'Zona Torrecillas S/N',
    telefono: '+591 4 6645678',
    website: 'https://bodegasmagnus.com.bo/',
    fuenteVerificacion: 'https://bodegasmagnus.com.bo/contacto/',
    tipoFuente: 'OFICIAL',
    archivoCaptacion: ALCOHOL_FILE,
    filaCaptacion: 496,
    categories: [{ ...BA005, productosComercializa: 'Vinos' }],
  },
  {
    razonSocial: 'Montecito SRL',
    ciudad: 'Tarija',
    direccion: 'Calle Virginio Lema #252, frente a Entel',
    whatsapp: '+591 69130404',
    email: 'info@montecito.com.bo',
    website: 'https://montecito.com.bo/',
    fuenteVerificacion: 'https://montecito.com.bo/',
    tipoFuente: 'OFICIAL',
    archivoCaptacion: ALCOHOL_FILE,
    filaCaptacion: 544,
    categories: [
      {
        ...BA004,
        productosComercializa: 'Vinos, singani, espumantes y licores',
      },
    ],
  },
  {
    razonSocial: 'CELCCAR',
    ciudad: 'Caranavi',
    direccion:
      'Av. Mariscal Santa Cruz N° 148, Esq. Zacarías Tancara, Caranavi',
    telefono: '+591 67300323',
    whatsapp: '+591 73048490',
    email: 'informaciones@celccar.org',
    website: 'https://www.celccar.org/',
    fuenteVerificacion: 'https://www.celccar.org/productos',
    tipoFuente: 'OFICIAL',
    archivoCaptacion: NON_ALCOHOL_FILE,
    filaCaptacion: 43,
    categories: [
      {
        ...BC001,
        productosComercializa: 'Café tostado y molido',
        fuenteVerificacion: 'https://www.celccar.org/productos',
      },
      {
        ...DE001,
        productosComercializa: 'Café, bebidas frías, jugos naturales y masitas',
        fuenteVerificacion: 'https://www.celccar.org/cafeteria',
      },
    ],
  },
  {
    razonSocial: 'Cholopata',
    ciudad: 'Caranavi',
    direccion: 'Comunidad Oro Verde, Central 11 de Febrero, Caranavi',
    telefono: '+591 77734896',
    whatsapp: '+591 75277003',
    email: 'cholopata.bo@gmail.com',
    website: 'https://cholopata.com/',
    fuenteVerificacion: 'https://cholopata.com/contacto2/',
    tipoFuente: 'OFICIAL',
    archivoCaptacion: NON_ALCOHOL_FILE,
    filaCaptacion: 46,
    categories: [{ ...BC001, productosComercializa: 'Café' }],
  },
  {
    razonSocial: 'ASOCAFÉ',
    ciudad: 'Taipiplaya, Caranavi',
    direccion: 'Av. Asunción, Cantón Taipiplaya, Caranavi',
    telefono: '+591 73242258',
    whatsapp: '+591 71542504',
    email: 'info@asocafe.com',
    website: 'https://asocafe.com/',
    fuenteVerificacion: 'https://asocafe.com/contactos/',
    tipoFuente: 'OFICIAL',
    archivoCaptacion: NON_ALCOHOL_FILE,
    filaCaptacion: 45,
    categories: [{ ...BC001, productosComercializa: 'Café' }],
  },
  {
    razonSocial: 'Casa Blanca Distribuidora',
    ciudad: 'Cobija',
    telefono: '75108395',
    fuenteVerificacion:
      'https://bo.todosnegocios.com/casa-blanca-distribuidora-75108395',
    tipoFuente: 'DIRECTORIO_PUBLICO',
    archivoCaptacion: ALCOHOL_FILE,
    filaCaptacion: 695,
    categories: [{ ...BA003, productosComercializa: 'Licores y destilados' }],
  },
  {
    razonSocial: 'Drink House',
    ciudad: 'Cobija',
    direccion: 'Calle Rodolfo Siles N° 40',
    telefono: '67664066',
    email: 'lacasadelabebida@hotmail.com',
    fuenteVerificacion: 'https://bo.todosnegocios.com/drink-house_1M-67664066',
    tipoFuente: 'DIRECTORIO_PUBLICO',
    archivoCaptacion: ALCOHOL_FILE,
    filaCaptacion: 697,
    categories: [{ ...BA003, productosComercializa: 'Licores y destilados' }],
  },
  {
    razonSocial: 'Licorería Acuario',
    ciudad: 'Cobija',
    direccion: 'Centro, lado BancoSol',
    telefono: '3 8429209',
    fuenteVerificacion:
      'https://bo.todosnegocios.com/licoreria-acuario-3-8429209',
    tipoFuente: 'DIRECTORIO_PUBLICO',
    archivoCaptacion: ALCOHOL_FILE,
    filaCaptacion: 698,
    categories: [{ ...BA003, productosComercializa: 'Licores y destilados' }],
  },
  {
    razonSocial: 'Licorería el Cedro',
    ciudad: 'Cobija',
    direccion: 'Av. Chelio Luna Pizarro, X6JR+95J',
    telefono: '79319874',
    fuenteVerificacion:
      'https://bo.todosnegocios.com/licoreria-el-cedro-79319874',
    tipoFuente: 'DIRECTORIO_PUBLICO',
    archivoCaptacion: ALCOHOL_FILE,
    filaCaptacion: 699,
    categories: [{ ...BA003, productosComercializa: 'Licores y destilados' }],
  },
  {
    razonSocial: 'Panadería & Pastelería La Artesana',
    ciudad: 'Cobija',
    direccion: 'Calle Maricnol, esquina 6 de Enero',
    telefono: '68059453',
    email: 'pan.pastelartesana@gmail.com',
    fuenteVerificacion:
      'https://bo.todosnegocios.com/panader%C3%ADa-pasteleria-la-artesana-68059453',
    tipoFuente: 'DIRECTORIO_PUBLICO',
    archivoCaptacion: BREAKFAST_FILE,
    filaCaptacion: 700,
    categories: [
      { ...DE003, productosComercializa: 'Pan, masas y productos horneados' },
    ],
  },
];

class DryRunRollback extends Error {
  constructor(readonly result: RunResult) {
    super('BOLIVIA_EXPANSION_DRY_RUN_ROLLBACK');
  }
}

function selectedMode(): Mode {
  const value = process.env.BOLIVIA_EXPANSION_MODE;
  if (value !== 'dry-run' && value !== 'apply' && value !== 'verify') {
    throw new Error('BOLIVIA_EXPANSION_MODE debe ser dry-run, apply o verify');
  }
  return value;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeName(value: string): string {
  const legal = new Set([
    'sa',
    'srl',
    'ltda',
    'rl',
    'cia',
    'compania',
    'limitada',
  ]);
  return normalizeText(value)
    .split(/\s+/)
    .map((token) => {
      if (token === 'bodegas') return 'bodega';
      if (token === 'licorerias') return 'licoreria';
      if (token === 'vinedos') return 'vinedo';
      return token;
    })
    .filter((token) => token && !legal.has(token))
    .join('');
}

function normalizeCity(value: string): string {
  return normalizeText(value).replace(/\s+/g, '');
}

function websiteKey(value?: string | null): string | undefined {
  if (!value) return undefined;
  const first = value.split(/\s*\|\s*|\n/)[0]?.trim();
  if (!first) return undefined;
  try {
    const parsed = new URL(first);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, '').toLowerCase();
    const sharedHosts = new Set([
      'facebook.com',
      'instagram.com',
      'todosnegocios.com',
      'bo.todosnegocios.com',
      'maps.google.com',
      'maps.app.goo.gl',
    ]);
    return sharedHosts.has(host) ? `${host}${path}` : host;
  } catch {
    return normalizeText(first).replace(/\s+/g, '') || undefined;
  }
}

function sourceKey(value?: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    return `${parsed.hostname.replace(/^www\./, '').toLowerCase()}${parsed.pathname
      .replace(/\/+$/, '')
      .toLowerCase()}`;
  } catch {
    return normalizeText(value).replace(/\s+/g, '') || undefined;
  }
}

function contactKeys(value?: string | null): string[] {
  if (!value) return [];
  return [
    ...new Set(
      value
        .split(/[\n,;|/]+/)
        .map((part) => part.replace(/\D/g, ''))
        .filter((digits) => digits.length >= 7)
        .map((digits) => {
          if (digits.startsWith('00591') && digits.length >= 12) {
            return digits.slice(5);
          }
          if (digits.startsWith('591') && digits.length >= 10) {
            return digits.slice(3);
          }
          return digits;
        }),
    ),
  ];
}

function hasContact(candidate: Candidate): boolean {
  return Boolean(candidate.telefono || candidate.whatsapp || candidate.email);
}

function addIndex(
  index: Map<string, ExistingProvider[]>,
  key: string | undefined,
  provider: ExistingProvider,
): void {
  if (!key) return;
  const rows = index.get(key) ?? [];
  if (!rows.some((row) => row.id === provider.id)) rows.push(provider);
  index.set(key, rows);
}

function uniqueProviders(rows: ExistingProvider[]): ExistingProvider[] {
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

function similarName(left: string, right: string): boolean {
  const a = normalizeName(left);
  const b = normalizeName(right);
  return (
    a === b ||
    (a.length >= 6 && b.length >= 6 && (a.includes(b) || b.includes(a)))
  );
}

function buildIndexes(existing: ExistingProvider[]) {
  const byNameCity = new Map<string, ExistingProvider[]>();
  const byName = new Map<string, ExistingProvider[]>();
  const byEmail = new Map<string, ExistingProvider[]>();
  const byContact = new Map<string, ExistingProvider[]>();
  const byWebsite = new Map<string, ExistingProvider[]>();
  const bySource = new Map<string, ExistingProvider[]>();

  for (const provider of existing) {
    const name = normalizeName(provider.razonSocial);
    addIndex(byName, name, provider);
    addIndex(byNameCity, `${name}:${normalizeCity(provider.ciudad)}`, provider);
    addIndex(byEmail, provider.email?.trim().toLowerCase(), provider);
    for (const key of [
      ...contactKeys(provider.telefono),
      ...contactKeys(provider.whatsapp),
    ]) {
      addIndex(byContact, key, provider);
    }
    addIndex(byWebsite, websiteKey(provider.website), provider);
    addIndex(bySource, sourceKey(provider.fuenteVerificacion), provider);
  }

  return { byNameCity, byName, byEmail, byContact, byWebsite, bySource };
}

function findMatch(
  candidate: Candidate,
  indexes: ReturnType<typeof buildIndexes>,
): Match {
  const name = normalizeName(candidate.razonSocial);
  const exact = uniqueProviders(
    indexes.byNameCity.get(`${name}:${normalizeCity(candidate.ciudad)}`) ?? [],
  );
  const uniqueName = uniqueProviders(indexes.byName.get(name) ?? []);
  const identity = uniqueProviders([
    ...(candidate.email
      ? (indexes.byEmail.get(candidate.email.toLowerCase()) ?? [])
      : []),
    ...contactKeys(candidate.telefono).flatMap(
      (key) => indexes.byContact.get(key) ?? [],
    ),
    ...contactKeys(candidate.whatsapp).flatMap(
      (key) => indexes.byContact.get(key) ?? [],
    ),
    ...(websiteKey(candidate.website)
      ? (indexes.byWebsite.get(websiteKey(candidate.website)!) ?? [])
      : []),
    ...(sourceKey(candidate.fuenteVerificacion)
      ? (indexes.bySource.get(sourceKey(candidate.fuenteVerificacion)!) ?? [])
      : []),
  ]);

  if (exact.length > 1) {
    return { kind: 'CONFLICT', providers: exact, reason: 'multiple-name-city' };
  }
  if (exact.length === 1) {
    const contradictions = identity.filter((row) => row.id !== exact[0].id);
    if (contradictions.length > 0) {
      return {
        kind: 'CONFLICT',
        providers: uniqueProviders([exact[0], ...contradictions]),
        reason: 'name-city-versus-contact',
      };
    }
    return { kind: 'MATCH', provider: exact[0], reason: 'name-city' };
  }

  if (uniqueName.length === 1) {
    const contradictions = identity.filter(
      (row) => row.id !== uniqueName[0].id,
    );
    if (contradictions.length > 0) {
      return {
        kind: 'CONFLICT',
        providers: uniqueProviders([uniqueName[0], ...contradictions]),
        reason: 'name-versus-contact',
      };
    }
    return { kind: 'MATCH', provider: uniqueName[0], reason: 'unique-name' };
  }

  if (identity.length === 1) {
    if (similarName(candidate.razonSocial, identity[0].razonSocial)) {
      return { kind: 'MATCH', provider: identity[0], reason: 'contact-or-web' };
    }
    return {
      kind: 'CONFLICT',
      providers: identity,
      reason: 'contact-or-web-different-name',
    };
  }
  if (identity.length > 1) {
    return {
      kind: 'CONFLICT',
      providers: identity,
      reason: 'multiple-contact-or-web',
    };
  }
  return { kind: 'NEW' };
}

function mergeEvidence(
  current: Prisma.JsonValue | null | undefined,
  candidate: Candidate,
): Prisma.InputJsonValue {
  const base =
    current && typeof current === 'object' && !Array.isArray(current)
      ? current
      : {};
  return {
    ...base,
    ampliacionBolivia20261002: {
      estado: 'VERIFICADO',
      fecha: '2026-10-02',
      tipoFuente: candidate.tipoFuente,
      fuente: candidate.fuenteVerificacion,
      archivoCaptacion: candidate.archivoCaptacion,
      filaCaptacion: candidate.filaCaptacion,
      criterio:
        'nombre, ubicación, rubro, subrubro, productos, fuente pública, contacto y deduplicación',
    },
  };
}

function relationEvidence(
  current: Prisma.JsonValue | null | undefined,
  candidate: Candidate,
  category: Category,
): Prisma.InputJsonValue {
  const base =
    current && typeof current === 'object' && !Array.isArray(current)
      ? current
      : {};
  return {
    ...base,
    ampliacionBolivia20261002: {
      estado: 'VERIFICADO',
      fecha: '2026-10-02',
      tipoFuente: candidate.tipoFuente,
      fuente: category.fuenteVerificacion ?? candidate.fuenteVerificacion,
      archivoCaptacion: candidate.archivoCaptacion,
      filaCaptacion: candidate.filaCaptacion,
      codigoRubro: category.codigoRubro,
      codigoSubrubro: category.codigoSubrubro,
    },
  };
}

async function generarCodigoProveedor(
  tx: Prisma.TransactionClient,
): Promise<string> {
  const rows = await tx.$queryRaw<{ ultimoNumero: number }[]>`
    INSERT INTO "SecuenciaProveedorPais" (
      "codigoPais", "ultimoNumero", "createdAt", "updatedAt"
    )
    VALUES ('BO', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("codigoPais") DO UPDATE
    SET
      "ultimoNumero" = "SecuenciaProveedorPais"."ultimoNumero" + 1,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "SecuenciaProveedorPais"."ultimoNumero" < 99999999
    RETURNING "ultimoNumero"
  `;
  if (!rows[0]) throw new Error('Se agotó la numeración de Bolivia');
  return `BO${String(rows[0].ultimoNumero).padStart(8, '0')}`;
}

async function validateCatalog(tx: Prisma.TransactionClient): Promise<void> {
  const expected = new Map<string, { codigoRubro: string; nombre: string }>();
  for (const candidate of candidates) {
    if (!hasContact(candidate)) {
      throw new Error(`${candidate.razonSocial}: no tiene contacto`);
    }
    for (const category of candidate.categories) {
      const previous = expected.get(category.codigoSubrubro);
      if (
        previous &&
        (previous.codigoRubro !== category.codigoRubro ||
          previous.nombre !== category.subrubro)
      ) {
        throw new Error(`Taxonomía contradictoria: ${category.codigoSubrubro}`);
      }
      expected.set(category.codigoSubrubro, {
        codigoRubro: category.codigoRubro,
        nombre: category.subrubro,
      });
    }
  }

  const rows = await tx.subrubroCatalogo.findMany({
    where: { codigo: { in: [...expected.keys()] } },
    select: { codigo: true, codigoRubro: true, nombre: true, activo: true },
  });
  if (rows.length !== expected.size) {
    throw new Error('Faltan subrubros requeridos en el catálogo');
  }
  for (const row of rows) {
    const wanted = expected.get(row.codigo)!;
    if (
      !row.activo ||
      row.codigoRubro !== wanted.codigoRubro ||
      row.nombre !== wanted.nombre
    ) {
      throw new Error(`Catálogo incoherente para ${row.codigo}`);
    }
  }
}

async function inspect(
  tx: Prisma.TransactionClient,
): Promise<{ summary: Summary; categories: CategoryCount[] }> {
  const rows = await tx.$queryRawUnsafe<Summary[]>(`
    WITH bolivia AS (
      SELECT p.* FROM "Proveedor" p
      WHERE upper(trim(COALESCE(p."codigoPais", ''))) = 'BO'
    ), rel AS (
      SELECT pr.* FROM "ProveedorRubro" pr
      JOIN bolivia b ON b."id" = pr."proveedorId"
    ), principal_counts AS (
      SELECT b."id",
             count(r."id") FILTER (WHERE r."esPrincipal")::int AS principales,
             count(r."id")::int AS relaciones
      FROM bolivia b LEFT JOIN rel r ON r."proveedorId" = b."id"
      GROUP BY b."id"
    ), principal AS (
      SELECT DISTINCT ON (r."proveedorId") r.*
      FROM rel r WHERE r."esPrincipal"
      ORDER BY r."proveedorId", r."id"
    ), duplicate_codes AS (
      SELECT trim("codigoProveedor") AS codigo
      FROM bolivia GROUP BY 1 HAVING count(*) > 1
    )
    SELECT
      (SELECT count(*)::int FROM bolivia) AS "totalProveedores",
      (SELECT count(*)::int FROM bolivia WHERE "activo") AS "activos",
      (SELECT count(*)::int FROM bolivia WHERE NOT "activo") AS "inactivos",
      (SELECT count(*)::int FROM bolivia WHERE "estadoVerificacion" = 'VE') AS "verificados",
      (SELECT count(*)::int FROM bolivia WHERE "estadoVerificacion" = 'NV') AS "noVerificados",
      (SELECT count(*)::int FROM rel) AS "relaciones",
      (SELECT count(*)::int FROM bolivia
        WHERE trim(COALESCE("codigoProveedor", '')) !~ '^BO[0-9]{8}$') AS "codigosProveedorInvalidos",
      (SELECT count(*)::int FROM duplicate_codes) AS "codigosProveedorDuplicados",
      (SELECT count(*)::int FROM rel
        WHERE "codigoRubro" IS NULL OR "codigoSubrubro" IS NULL) AS "relacionesSinCodigo",
      (SELECT count(*)::int FROM rel r
        LEFT JOIN "RubroCatalogo" rc ON rc."codigo" = r."codigoRubro"
        LEFT JOIN "SubrubroCatalogo" sc ON sc."codigo" = r."codigoSubrubro"
        WHERE rc."codigo" IS NULL OR sc."codigo" IS NULL
           OR sc."codigoRubro" <> r."codigoRubro") AS "referenciasCatalogoInvalidas",
      (SELECT count(*)::int FROM principal_counts pc JOIN bolivia b ON b."id" = pc."id"
        WHERE b."activo" AND pc.relaciones = 0) AS "activosSinRelacion",
      (SELECT count(*)::int FROM principal_counts pc JOIN bolivia b ON b."id" = pc."id"
        WHERE b."activo" AND pc.principales = 0) AS "activosSinPrincipal",
      (SELECT count(*)::int FROM principal_counts WHERE principales > 1) AS "multiplesPrincipales",
      (SELECT count(*)::int FROM bolivia WHERE "estadoVerificacion" = 'VE'
        AND NULLIF(trim(COALESCE("fuenteVerificacion", '')), '') IS NULL) AS "veSinFuente",
      (SELECT count(*)::int FROM bolivia WHERE "estadoVerificacion" = 'VE'
        AND NULLIF(trim(COALESCE("productosComercializa", '')), '') IS NULL) AS "veSinProductos",
      (SELECT count(*)::int FROM bolivia WHERE "estadoVerificacion" = 'VE'
        AND NULLIF(trim(COALESCE("telefono", '')), '') IS NULL
        AND NULLIF(trim(COALESCE("whatsapp", '')), '') IS NULL
        AND NULLIF(trim(COALESCE("email", '')), '') IS NULL) AS "veSinContacto",
      (SELECT count(*)::int FROM bolivia b JOIN principal p ON p."proveedorId" = b."id"
        WHERE upper(trim(COALESCE(b."rubro", ''))) IS DISTINCT FROM upper(trim(COALESCE(p."rubro", '')))) AS "legacyRubroDiferente",
      (SELECT count(*)::int FROM bolivia b JOIN principal p ON p."proveedorId" = b."id"
        WHERE upper(trim(COALESCE(b."subrubro", ''))) IS DISTINCT FROM upper(trim(COALESCE(p."subrubro", '')))) AS "legacySubrubroDiferente",
      (SELECT count(*)::int FROM bolivia b JOIN principal p ON p."proveedorId" = b."id"
        WHERE trim(COALESCE(b."productosComercializa", '')) IS DISTINCT FROM trim(COALESCE(p."productosComercializa", ''))) AS "legacyProductosDiferentes",
      (SELECT "ultimoNumero" FROM "SecuenciaProveedorPais" WHERE "codigoPais" = 'BO') AS "secuenciaBO",
      (SELECT max(substring(trim("codigoProveedor") FROM 3)::int) FROM bolivia
        WHERE trim("codigoProveedor") ~ '^BO[0-9]{8}$') AS "maximoCodigo"
  `);
  if (rows.length !== 1) throw new Error('La auditoría no devolvió un resumen');

  const categories = await tx.$queryRawUnsafe<CategoryCount[]>(`
    SELECT pr."codigoRubro", pr."rubro", count(*)::int AS "relaciones"
    FROM "ProveedorRubro" pr
    JOIN "Proveedor" p ON p."id" = pr."proveedorId"
    WHERE p."codigoPais" = 'BO'
    GROUP BY pr."codigoRubro", pr."rubro"
    ORDER BY pr."codigoRubro"
  `);
  return { summary: rows[0], categories };
}

function validateSummary(summary: Summary): void {
  const zeroFields: Array<keyof Summary> = [
    'codigosProveedorInvalidos',
    'codigosProveedorDuplicados',
    'relacionesSinCodigo',
    'referenciasCatalogoInvalidas',
    'activosSinRelacion',
    'activosSinPrincipal',
    'multiplesPrincipales',
    'veSinFuente',
    'veSinProductos',
    'veSinContacto',
    'legacyRubroDiferente',
    'legacySubrubroDiferente',
    'legacyProductosDiferentes',
  ];
  for (const field of zeroFields) {
    if (summary[field] !== 0) {
      throw new Error(`${field}: esperado 0, obtenido ${summary[field]}`);
    }
  }
  if (summary.secuenciaBO !== summary.maximoCodigo) {
    throw new Error(
      `Secuencia BO ${summary.secuenciaBO} distinta del máximo ${summary.maximoCodigo}`,
    );
  }
}

function providersChanged(
  before: ExistingProvider,
  after: ExistingProvider,
): boolean {
  return JSON.stringify(before) !== JSON.stringify(after);
}

async function applyCandidate(
  tx: Prisma.TransactionClient,
  candidate: Candidate,
  existing: ExistingProvider[],
): Promise<Action> {
  const confirmed = candidate.codigoProveedorExistenteConfirmado
    ? existing.find(
        (provider) =>
          provider.codigoProveedor ===
          candidate.codigoProveedorExistenteConfirmado,
      )
    : undefined;
  if (candidate.codigoProveedorExistenteConfirmado && !confirmed) {
    throw new Error(
      `${candidate.razonSocial}: no existe el código confirmado ${candidate.codigoProveedorExistenteConfirmado}`,
    );
  }
  const match: Match = confirmed
    ? {
        kind: 'MATCH',
        provider: confirmed,
        reason: 'razon-social-y-marca-confirmadas',
      }
    : findMatch(candidate, buildIndexes(existing));
  if (match.kind === 'CONFLICT') {
    return {
      razonSocial: candidate.razonSocial,
      status: 'SKIPPED_CONFLICT',
      codigoProveedor: null,
      matchReason: match.reason,
      relationsCreated: 0,
      relationsUpdated: 0,
      conflictProviders: match.providers.map((provider) => ({
        codigoProveedor: provider.codigoProveedor,
        razonSocial: provider.razonSocial,
        ciudad: provider.ciudad,
        telefono: provider.telefono,
        whatsapp: provider.whatsapp,
        email: provider.email,
        website: provider.website,
      })),
    };
  }

  let provider: ExistingProvider;
  let created = false;
  let providerWasChanged = false;

  if (match.kind === 'NEW') {
    const primary = candidate.categories[0];
    const codigoProveedor = await generarCodigoProveedor(tx);
    provider = await tx.proveedor.create({
      data: {
        codigoProveedor,
        codigoPais: 'BO',
        razonSocial: candidate.razonSocial,
        pais: 'Bolivia',
        ciudad: candidate.ciudad,
        direccion: candidate.direccion,
        telefono: candidate.telefono,
        whatsapp: candidate.whatsapp,
        email: candidate.email?.toLowerCase(),
        website: candidate.website,
        rubro: primary.rubro,
        subrubro: primary.subrubro,
        productosComercializa: primary.productosComercializa,
        estadoVerificacion: 'VE',
        fechaVerificacion: new Date(),
        fuenteVerificacion: candidate.fuenteVerificacion,
        fechaDiscovery: new Date('2026-10-02T00:00:00.000Z'),
        evidenciaVerificacion: mergeEvidence(null, candidate),
        activo: true,
      },
      select: {
        id: true,
        codigoProveedor: true,
        codigoPais: true,
        razonSocial: true,
        pais: true,
        ciudad: true,
        direccion: true,
        telefono: true,
        whatsapp: true,
        email: true,
        website: true,
        fuenteVerificacion: true,
        productosComercializa: true,
        evidenciaVerificacion: true,
        estadoVerificacion: true,
        activo: true,
      },
    });
    created = true;
    providerWasChanged = true;
  } else {
    const before = match.provider;
    provider = await tx.proveedor.update({
      where: { id: before.id },
      data: {
        codigoPais: 'BO',
        pais: before.pais.trim() || 'Bolivia',
        direccion: before.direccion?.trim() || candidate.direccion,
        telefono: before.telefono?.trim() || candidate.telefono,
        whatsapp: before.whatsapp?.trim() || candidate.whatsapp,
        email: before.email?.trim() || candidate.email?.toLowerCase(),
        website: before.website?.trim() || candidate.website,
        fuenteVerificacion:
          before.fuenteVerificacion?.trim() || candidate.fuenteVerificacion,
        productosComercializa:
          before.productosComercializa?.trim() ||
          candidate.categories[0].productosComercializa,
        estadoVerificacion: 'VE',
        fechaVerificacion: new Date(),
        evidenciaVerificacion: mergeEvidence(
          before.evidenciaVerificacion,
          candidate,
        ),
        activo: true,
      },
      select: {
        id: true,
        codigoProveedor: true,
        codigoPais: true,
        razonSocial: true,
        pais: true,
        ciudad: true,
        direccion: true,
        telefono: true,
        whatsapp: true,
        email: true,
        website: true,
        fuenteVerificacion: true,
        productosComercializa: true,
        evidenciaVerificacion: true,
        estadoVerificacion: true,
        activo: true,
      },
    });
    providerWasChanged = providersChanged(before, provider);
  }

  let relationsCreated = 0;
  let relationsUpdated = 0;
  let principalCount = await tx.proveedorRubro.count({
    where: { proveedorId: provider.id, esPrincipal: true },
  });

  for (const category of candidate.categories) {
    const found = await tx.proveedorRubro.findUnique({
      where: {
        proveedorId_rubro_subrubro: {
          proveedorId: provider.id,
          rubro: category.rubro,
          subrubro: category.subrubro,
        },
      },
    });
    const source = category.fuenteVerificacion ?? candidate.fuenteVerificacion;
    if (!found) {
      const esPrincipal = principalCount === 0;
      await tx.proveedorRubro.create({
        data: {
          proveedorId: provider.id,
          codigoRubro: category.codigoRubro,
          rubro: category.rubro,
          codigoSubrubro: category.codigoSubrubro,
          subrubro: category.subrubro,
          productosComercializa: category.productosComercializa,
          fuenteVerificacion: source,
          evidenciaVerificacion: relationEvidence(null, candidate, category),
          esPrincipal,
        },
      });
      relationsCreated += 1;
      if (esPrincipal) principalCount += 1;
    } else {
      const shouldUpdate =
        found.codigoRubro !== category.codigoRubro ||
        found.codigoSubrubro !== category.codigoSubrubro ||
        !found.productosComercializa?.trim() ||
        !found.fuenteVerificacion?.trim();
      await tx.proveedorRubro.update({
        where: { id: found.id },
        data: {
          codigoRubro: category.codigoRubro,
          codigoSubrubro: category.codigoSubrubro,
          productosComercializa:
            found.productosComercializa?.trim() ||
            category.productosComercializa,
          fuenteVerificacion: found.fuenteVerificacion?.trim() || source,
          evidenciaVerificacion: relationEvidence(
            found.evidenciaVerificacion,
            candidate,
            category,
          ),
        },
      });
      if (shouldUpdate) relationsUpdated += 1;
    }
  }

  const principals = await tx.proveedorRubro.findMany({
    where: { proveedorId: provider.id, esPrincipal: true },
    orderBy: { id: 'asc' },
  });
  if (principals.length !== 1) {
    throw new Error(
      `${candidate.razonSocial}: cantidad inválida de relaciones principales (${principals.length})`,
    );
  }
  const primary = principals[0];
  await tx.proveedor.update({
    where: { id: provider.id },
    data: {
      rubro: primary.rubro,
      subrubro: primary.subrubro,
      productosComercializa: primary.productosComercializa,
    },
  });

  const refreshed = await tx.proveedor.findUniqueOrThrow({
    where: { id: provider.id },
    select: {
      id: true,
      codigoProveedor: true,
      codigoPais: true,
      razonSocial: true,
      pais: true,
      ciudad: true,
      direccion: true,
      telefono: true,
      whatsapp: true,
      email: true,
      website: true,
      fuenteVerificacion: true,
      productosComercializa: true,
      evidenciaVerificacion: true,
      estadoVerificacion: true,
      activo: true,
    },
  });
  const existingIndex = existing.findIndex((row) => row.id === refreshed.id);
  if (existingIndex >= 0) existing.splice(existingIndex, 1, refreshed);
  else existing.push(refreshed);

  const status: Action['status'] = created
    ? 'CREATED'
    : relationsCreated > 0
      ? 'ASSOCIATED'
      : providerWasChanged || relationsUpdated > 0
        ? 'ENRICHED'
        : 'PRESENT';
  return {
    razonSocial: candidate.razonSocial,
    status,
    codigoProveedor: refreshed.codigoProveedor,
    matchReason: match.kind === 'NEW' ? 'new' : match.reason,
    relationsCreated,
    relationsUpdated,
  };
}

async function runWrite(
  tx: Prisma.TransactionClient,
  mode: 'dry-run' | 'apply',
): Promise<RunResult> {
  await validateCatalog(tx);
  const before = (await inspect(tx)).summary;
  validateSummary(before);
  const existing = await tx.proveedor.findMany({
    where: { codigoPais: 'BO' },
    select: {
      id: true,
      codigoProveedor: true,
      codigoPais: true,
      razonSocial: true,
      pais: true,
      ciudad: true,
      direccion: true,
      telefono: true,
      whatsapp: true,
      email: true,
      website: true,
      fuenteVerificacion: true,
      productosComercializa: true,
      evidenciaVerificacion: true,
      estadoVerificacion: true,
      activo: true,
    },
  });

  const actions: Action[] = [];
  for (const candidate of candidates) {
    actions.push(await applyCandidate(tx, candidate, existing));
  }
  const inspected = await inspect(tx);
  validateSummary(inspected.summary);
  return {
    mode,
    actions,
    before,
    after: inspected.summary,
    categories: inspected.categories,
  };
}

function emit(label: string, result: unknown): void {
  if (
    result &&
    typeof result === 'object' &&
    'actions' in result &&
    Array.isArray((result as RunResult).actions)
  ) {
    const run = result as RunResult;
    const statusCounts = Object.fromEntries(
      [...new Set(run.actions.map((action) => action.status))].map((status) => [
        status,
        run.actions.filter((action) => action.status === status).length,
      ]),
    );
    console.log(
      `BOLIVIA_EXPANSION_${label}_SUMMARY=${JSON.stringify({
        mode: run.mode,
        candidates: run.actions.length,
        statusCounts,
        before: run.before,
        after: run.after,
      })}`,
    );
    for (const action of run.actions) {
      console.log(
        `BOLIVIA_EXPANSION_${label}_ACTION=${JSON.stringify(action)}`,
      );
    }
    console.log(
      `BOLIVIA_EXPANSION_${label}_CATEGORIES=${JSON.stringify(run.categories)}`,
    );
    return;
  }
  console.log(
    `BOLIVIA_EXPANSION_${label}=${JSON.stringify(
      result,
      (_key, item: unknown) =>
        typeof item === 'bigint' ? item.toString() : item,
    )}`,
  );
}

async function main(): Promise<void> {
  const mode = selectedMode();
  if (mode === 'verify') {
    const inspected = await prisma.$transaction(
      async (tx) => {
        await validateCatalog(tx);
        const result = await inspect(tx);
        validateSummary(result.summary);
        return result;
      },
      { maxWait: 30_000, timeout: 600_000 },
    );
    emit('VERIFIED', { mode, ...inspected });
    return;
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const run = await runWrite(tx, mode);
        if (mode === 'dry-run') throw new DryRunRollback(run);
        return run;
      },
      {
        maxWait: 30_000,
        timeout: 600_000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
    emit('APPLIED', result);
  } catch (error) {
    if (error instanceof DryRunRollback) {
      emit('DRY_RUN_OK', error.result);
      return;
    }
    throw error;
  }
}

void main()
  .catch((error: unknown) => {
    console.error('BOLIVIA_EXPANSION_FAILED', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
