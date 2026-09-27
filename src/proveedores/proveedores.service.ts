import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';
import { CreateProductoProveedorDto } from './dto/create-producto-proveedor.dto';
import { UploadService } from '../upload/upload.service';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { formarCodigoProveedor, resolverCodigoPais } from './codigo-proveedor';
import { normalizarAsignacionesRubro } from './proveedor-rubros';

function removeDiacritics(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function normalizeSearchTerm(value: string) {
  return removeDiacritics(value).toLowerCase();
}

@Injectable()
export class ProveedoresService {
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
  ) {}

  private obtenerCodigoPais(pais: string): string {
    const codigoPais = resolverCodigoPais(pais);

    if (!codigoPais) {
      throw new BadRequestException(
        `No se pudo identificar el código ISO de país para "${pais}"`,
      );
    }

    return codigoPais;
  }

  private async generarCodigoProveedor(
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
      throw new ConflictException(
        `Se agotó la numeración disponible para el país ${codigoPais}`,
      );
    }

    return formarCodigoProveedor(codigoPais, secuencias[0].ultimoNumero);
  }

  async create(
    dto: CreateProveedorDto,
    files: {
      copiaRuc?: Express.Multer.File[];
      copiaLicencia?: Express.Multer.File[];
      copiaDni?: Express.Multer.File[];
    },
  ) {
    const { rubros: rubrosDto, evidenciaVerificacion, ...dtoRest } = dto;
    const codigoPais = this.obtenerCodigoPais(dto.pais);
    const rubros = normalizarAsignacionesRubro(rubrosDto, {
      rubro: dto.rubro,
      subrubro: dto.subrubro,
      productosComercializa: dto.productosComercializa,
      fuenteVerificacion: dto.fuenteVerificacion,
      evidenciaVerificacion: evidenciaVerificacion as
        | Prisma.InputJsonValue
        | undefined,
    });
    const rubroPrincipal = rubros[0];

    if (
      (dtoRest.usuarioAcceso && !dtoRest.passwordAcceso) ||
      (!dtoRest.usuarioAcceso && dtoRest.passwordAcceso)
    ) {
      throw new BadRequestException(
        'usuarioAcceso y passwordAcceso deben enviarse juntos',
      );
    }

    if (dto.ruc) {
      const existsRuc = await this.prisma.proveedor.findFirst({
        where: { ruc: dto.ruc },
      });
      if (existsRuc)
        throw new ConflictException('Ya existe un proveedor con ese RUC');
    }

    if (dtoRest.usuarioAcceso) {
      const existsUsuario = await this.prisma.proveedor.findUnique({
        where: { usuarioAcceso: dtoRest.usuarioAcceso },
      });
      if (existsUsuario)
        throw new ConflictException('Ese usuario de acceso ya está en uso');
    }

    const copiaRucUrl = files?.copiaRuc?.[0]
      ? await this.uploadService.uploadFile(
          files.copiaRuc[0],
          'proveedores/ruc',
        )
      : undefined;
    const copiaLicenciaUrl = files?.copiaLicencia?.[0]
      ? await this.uploadService.uploadFile(
          files.copiaLicencia[0],
          'proveedores/licencias',
        )
      : undefined;
    const copiaDniUrl = files?.copiaDni?.[0]
      ? await this.uploadService.uploadFile(
          files.copiaDni[0],
          'proveedores/dni',
        )
      : undefined;

    const passwordHash = dtoRest.passwordAcceso
      ? await bcrypt.hash(dtoRest.passwordAcceso, 10)
      : undefined;

    const estadoVerificacion = dto.estadoVerificacion ?? 'NV';
    const fechaVerificacion =
      dto.fechaVerificacion ??
      (estadoVerificacion === 'VE' ? new Date() : undefined);

    return this.prisma.$transaction(async (tx) => {
      const codigoProveedor = await this.generarCodigoProveedor(tx, codigoPais);

      return tx.proveedor.create({
        data: {
          ...dtoRest,
          ...(evidenciaVerificacion !== undefined && {
            evidenciaVerificacion:
              evidenciaVerificacion as Prisma.InputJsonValue,
          }),
          codigoProveedor,
          codigoPais,
          rubro: rubroPrincipal?.rubro ?? dto.rubro,
          subrubro: rubroPrincipal?.subrubro || dto.subrubro,
          productosComercializa:
            rubroPrincipal?.productosComercializa ?? dto.productosComercializa,
          estadoVerificacion,
          fechaVerificacion,
          ...(passwordHash && { passwordAcceso: passwordHash }),
          copiaRucUrl,
          copiaLicenciaUrl,
          copiaDniUrl,
          ...(rubros.length > 0 && {
            rubros: {
              create: rubros.map((item, index) => ({
                ...item,
                esPrincipal: index === 0,
              })),
            },
          }),
        },
        include: {
          rubros: {
            orderBy: [{ esPrincipal: 'desc' }, { id: 'asc' }],
          },
        },
      });
    });
  }

  async findAll(search?: string) {
    return this.prisma.proveedor.findMany({
      where: search
        ? {
            OR: [
              { razonSocial: { contains: search, mode: 'insensitive' } },
              { codigoProveedor: { contains: search, mode: 'insensitive' } },
              { pais: { contains: search, mode: 'insensitive' } },
              { rubro: { contains: search, mode: 'insensitive' } },
              {
                rubros: {
                  some: {
                    OR: [
                      { rubro: { contains: search, mode: 'insensitive' } },
                      { subrubro: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
              { ruc: { contains: search } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        rubros: { orderBy: [{ esPrincipal: 'desc' }, { id: 'asc' }] },
      },
    });
  }

  async findPaged(params: {
    search?: string;
    cursor?: number;
    limit?: number;
  }) {
    const search = params.search?.trim() || undefined;
    const cursor = params.cursor;

    const limit = params.limit ?? 20;
    if (!Number.isFinite(limit) || limit <= 0)
      throw new BadRequestException('limit inválido');
    const take = Math.min(Math.floor(limit), 100);

    if (cursor != null && (!Number.isFinite(cursor) || cursor <= 0)) {
      throw new BadRequestException('cursor inválido');
    }

    const where: Prisma.ProveedorWhereInput | undefined = search
      ? {
          OR: [
            { razonSocial: { contains: search, mode: 'insensitive' } },
            { codigoProveedor: { contains: search, mode: 'insensitive' } },
            { pais: { contains: search, mode: 'insensitive' } },
            { rubro: { contains: search, mode: 'insensitive' } },
            {
              rubros: {
                some: {
                  OR: [
                    { rubro: { contains: search, mode: 'insensitive' } },
                    { subrubro: { contains: search, mode: 'insensitive' } },
                  ],
                },
              },
            },
            { ruc: { contains: search } },
          ],
        }
      : undefined;

    const rows = await this.prisma.proveedor.findMany({
      where,
      orderBy: { id: 'desc' },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: take + 1,
      include: {
        rubros: { orderBy: [{ esPrincipal: 'desc' }, { id: 'asc' }] },
      },
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    const nextCursor = items.length > 0 ? items[items.length - 1].id : null;

    return { items, hasMore, nextCursor };
  }

  async findConsultasPaged(params: {
    search?: string;
    pais?: string;
    rubro?: string;
    ciudad?: string;
    subrubro?: string;
    cursor?: number;
    limit?: number;
  }) {
    const search = params.search?.trim() || undefined;
    const pais = params.pais?.trim() || undefined;
    const rubro = params.rubro?.trim() || undefined;
    const ciudad = params.ciudad?.trim() || undefined;
    const subrubro = params.subrubro?.trim() || undefined;
    const cursor = params.cursor;

    const limit = params.limit ?? 20;
    if (!Number.isFinite(limit) || limit <= 0)
      throw new BadRequestException('limit inválido');
    const take = Math.min(Math.floor(limit), 100);

    if (cursor != null && (!Number.isFinite(cursor) || cursor <= 0)) {
      throw new BadRequestException('cursor inválido');
    }

    // Prisma (contains + insensitive) no es insensible a tildes en Postgres por defecto.
    // Para que "Peru" encuentre también "Perú", normalizamos (lower + sin diacríticos) en SQL usando translate().
    const normalizedSearch = search ? normalizeSearchTerm(search) : undefined;

    const ACCENTED = 'áàäâãéèëêíìïîóòöôõúùüûñç';
    const PLAIN = 'aaaaaeeeeiiiiooooouuuunc';
    const normCol = (col: string) =>
      `translate(lower(${col}), '${ACCENTED}', '${PLAIN}')`;

    const conditions: Prisma.Sql[] = [];

    if (cursor != null) {
      conditions.push(Prisma.sql`p.id < ${cursor}`);
    }

    if (rubro) {
      conditions.push(Prisma.sql`EXISTS (
        SELECT 1
        FROM "ProveedorRubro" pr
        WHERE pr."proveedorId" = p.id
          AND lower(pr."rubro") = lower(${rubro})
      )`);
    }

    if (pais) {
      conditions.push(
        Prisma.sql`${Prisma.raw(normCol('p."pais"'))} = ${normalizeSearchTerm(pais)}`,
      );
    }

    if (ciudad) {
      conditions.push(
        Prisma.sql`${Prisma.raw(normCol('p."ciudad"'))} LIKE '%' || ${normalizeSearchTerm(ciudad)} || '%'`,
      );
    }

    if (subrubro) {
      conditions.push(
        Prisma.sql`EXISTS (
          SELECT 1
          FROM "ProveedorRubro" pr
          WHERE pr."proveedorId" = p.id
            AND ${Prisma.raw(normCol('pr."subrubro"'))} LIKE '%' || ${normalizeSearchTerm(subrubro)} || '%'
        )`,
      );
    }

    if (normalizedSearch) {
      conditions.push(
        Prisma.sql`(
          ${Prisma.raw(normCol('p."razonSocial"'))} LIKE '%' || ${normalizedSearch} || '%'
          OR lower(p."codigoProveedor") LIKE '%' || ${normalizedSearch} || '%'
          OR ${Prisma.raw(normCol('p."pais"'))} LIKE '%' || ${normalizedSearch} || '%'
          OR ${Prisma.raw(normCol('p."ciudad"'))} LIKE '%' || ${normalizedSearch} || '%'
          OR EXISTS (
            SELECT 1
            FROM "ProveedorRubro" pr
            WHERE pr."proveedorId" = p.id
              AND (
                ${Prisma.raw(normCol('pr."rubro"'))} LIKE '%' || ${normalizedSearch} || '%'
                OR ${Prisma.raw(normCol('pr."subrubro"'))} LIKE '%' || ${normalizedSearch} || '%'
              )
          )
          OR p."ruc" LIKE '%' || ${search} || '%'
        )`,
      );
    }

    const whereSql =
      conditions.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
        : null;

    const totalRow = whereSql
      ? await this.prisma.$queryRaw<{ total: number }[]>`
          SELECT COUNT(*)::int AS total
          FROM "Proveedor" p
          ${whereSql}
        `
      : await this.prisma.$queryRaw<{ total: number }[]>`
          SELECT COUNT(*)::int AS total
          FROM "Proveedor" p
        `;

    const total = totalRow?.[0]?.total ?? 0;

    const idRows = whereSql
      ? await this.prisma.$queryRaw<{ id: number }[]>`
          SELECT p.id
          FROM "Proveedor" p
          ${whereSql}
          ORDER BY p.id DESC
          LIMIT ${take + 1}
        `
      : await this.prisma.$queryRaw<{ id: number }[]>`
          SELECT p.id
          FROM "Proveedor" p
          ORDER BY p.id DESC
          LIMIT ${take + 1}
        `;

    const hasMore = idRows.length > take;
    const pageIds = (hasMore ? idRows.slice(0, take) : idRows).map((r) => r.id);

    if (pageIds.length === 0) {
      return { items: [], hasMore: false, nextCursor: null, total };
    }

    const items = await this.prisma.proveedor.findMany({
      where: { id: { in: pageIds } },
      orderBy: { id: 'desc' },
      select: {
        id: true,
        codigoProveedor: true,
        razonSocial: true,
        pais: true,
        rubro: true,
        rubros: {
          orderBy: [{ esPrincipal: 'desc' }, { id: 'asc' }],
          select: {
            id: true,
            rubro: true,
            subrubro: true,
            productosComercializa: true,
            esPrincipal: true,
          },
        },
        estadoVerificacion: true,
        activo: true,
        pedidos: {
          select: {
            calidad: true,
            respuesta: true,
            puntualidad: true,
            confianza: true,
            presentacion: true,
          },
        },
      },
    });

    const nextCursor = items.length > 0 ? items[items.length - 1].id : null;

    return { items, hasMore, nextCursor, total };
  }

  async getRubros() {
    const rows = await this.prisma.proveedorRubro.findMany({
      where: { rubro: { not: '' } },
      select: { rubro: true },
      distinct: ['rubro'],
    });

    return rows
      .map((r) => (r.rubro ?? '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }

  async getSubrubros() {
    const rows = await this.prisma.proveedorRubro.findMany({
      where: { subrubro: { not: '' } },
      select: { subrubro: true },
      distinct: ['subrubro'],
    });

    return rows
      .map((r) => (r.subrubro ?? '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }

  async getCiudades(pais?: string) {
    const rows = await this.prisma.proveedor.findMany({
      where: {
        ...(pais?.trim()
          ? { pais: { equals: pais.trim(), mode: 'insensitive' } }
          : {}),
      },
      select: { ciudad: true },
      distinct: ['ciudad'],
    });

    return rows
      .map((r) => (r.ciudad ?? '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }

  async findOne(id: number) {
    const proveedor = await this.prisma.proveedor.findUnique({
      where: { id },
      include: {
        rubros: { orderBy: [{ esPrincipal: 'desc' }, { id: 'asc' }] },
        pedidos: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!proveedor) throw new NotFoundException('Proveedor no encontrado');
    return proveedor;
  }

  async update(
    id: number,
    dto: UpdateProveedorDto,
    files: {
      copiaRuc?: Express.Multer.File[];
      copiaLicencia?: Express.Multer.File[];
      copiaDni?: Express.Multer.File[];
    },
  ) {
    const proveedorActual = await this.findOne(id);

    const copiaRucUrl = files?.copiaRuc?.[0]
      ? await this.uploadService.uploadFile(
          files.copiaRuc[0],
          'proveedores/ruc',
        )
      : undefined;
    const copiaLicenciaUrl = files?.copiaLicencia?.[0]
      ? await this.uploadService.uploadFile(
          files.copiaLicencia[0],
          'proveedores/licencias',
        )
      : undefined;
    const copiaDniUrl = files?.copiaDni?.[0]
      ? await this.uploadService.uploadFile(
          files.copiaDni[0],
          'proveedores/dni',
        )
      : undefined;

    const { rubros: rubrosDto, evidenciaVerificacion, ...dtoRest } = dto;
    const rubrosFueronEnviados = rubrosDto !== undefined;
    const rubros = rubrosFueronEnviados
      ? normalizarAsignacionesRubro(rubrosDto)
      : [];
    const rubroPrincipal = rubros[0];

    const data: Prisma.ProveedorUpdateInput = {
      ...dtoRest,
      ...(evidenciaVerificacion !== undefined && {
        evidenciaVerificacion: evidenciaVerificacion as Prisma.InputJsonValue,
      }),
      ...(copiaRucUrl && { copiaRucUrl }),
      ...(copiaLicenciaUrl && { copiaLicenciaUrl }),
      ...(copiaDniUrl && { copiaDniUrl }),
    };

    if (rubrosFueronEnviados) {
      data.rubro = rubroPrincipal?.rubro ?? null;
      data.subrubro = rubroPrincipal?.subrubro || null;
      data.productosComercializa =
        rubroPrincipal?.productosComercializa ?? null;
    }

    if (dtoRest.passwordAcceso) {
      data.passwordAcceso = await bcrypt.hash(dtoRest.passwordAcceso, 10);
    }

    let codigoPais = proveedorActual.codigoPais;

    if (dto.pais !== undefined) {
      const nuevoCodigoPais = this.obtenerCodigoPais(dto.pais);

      if (codigoPais && nuevoCodigoPais !== codigoPais) {
        throw new BadRequestException(
          'No se puede cambiar el país porque forma parte del código permanente del proveedor',
        );
      }

      codigoPais = nuevoCodigoPais;
    } else if (!codigoPais) {
      codigoPais = resolverCodigoPais(proveedorActual.pais);
    }

    if (
      dto.estadoVerificacion === 'VE' &&
      !dto.fechaVerificacion &&
      !proveedorActual.fechaVerificacion
    ) {
      data.fechaVerificacion = new Date();
    }

    const cambioRubroLegacy =
      !rubrosFueronEnviados &&
      (dto.rubro !== undefined ||
        dto.subrubro !== undefined ||
        dto.productosComercializa !== undefined);

    return this.prisma.$transaction(async (tx) => {
      if (!proveedorActual.codigoProveedor && codigoPais) {
        const codigoProveedor = await this.generarCodigoProveedor(
          tx,
          codigoPais,
        );
        data.codigoPais = codigoPais;
        data.codigoProveedor = codigoProveedor;
      }

      await tx.proveedor.update({ where: { id }, data });

      if (rubrosFueronEnviados) {
        await tx.proveedorRubro.deleteMany({ where: { proveedorId: id } });
        if (rubros.length > 0) {
          await tx.proveedorRubro.createMany({
            data: rubros.map((item, index) => ({
              proveedorId: id,
              ...item,
              esPrincipal: index === 0,
            })),
          });
        }
      } else if (cambioRubroLegacy) {
        const [principalLegacy] = normalizarAsignacionesRubro(undefined, {
          rubro: dto.rubro ?? proveedorActual.rubro,
          subrubro: dto.subrubro ?? proveedorActual.subrubro,
          productosComercializa:
            dto.productosComercializa ?? proveedorActual.productosComercializa,
          fuenteVerificacion: proveedorActual.fuenteVerificacion,
          evidenciaVerificacion: proveedorActual.evidenciaVerificacion as
            | Prisma.InputJsonValue
            | undefined,
        });

        await tx.proveedorRubro.deleteMany({
          where: { proveedorId: id, esPrincipal: true },
        });

        if (principalLegacy) {
          const existente = await tx.proveedorRubro.findFirst({
            where: {
              proveedorId: id,
              rubro: principalLegacy.rubro,
              subrubro: principalLegacy.subrubro,
            },
            select: { id: true },
          });

          if (existente) {
            await tx.proveedorRubro.update({
              where: { id: existente.id },
              data: { ...principalLegacy, esPrincipal: true },
            });
          } else {
            await tx.proveedorRubro.create({
              data: {
                proveedorId: id,
                ...principalLegacy,
                esPrincipal: true,
              },
            });
          }
        }
      }

      return tx.proveedor.findUnique({
        where: { id },
        include: {
          rubros: { orderBy: [{ esPrincipal: 'desc' }, { id: 'asc' }] },
          pedidos: { orderBy: { createdAt: 'desc' } },
        },
      });
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    // Verificar si tiene pedidos
    const pedidosCount = await this.prisma.pedido.count({
      where: { proveedorId: id },
    });
    if (pedidosCount > 0) {
      throw new ConflictException(
        `Este proveedor tiene ${pedidosCount} pedido(s) asociado(s). Debes eliminar los pedidos antes de eliminar el proveedor.`,
      );
    }

    // Desvincula usuarios asociados antes de eliminar
    await this.prisma.user.updateMany({
      where: { proveedorId: id },
      data: { proveedorId: null },
    });

    try {
      await this.prisma.proveedor.delete({ where: { id } });
      return { message: 'Proveedor eliminado correctamente' };
    } catch (err: unknown) {
      // Respaldo: si por alguna razón falla por una FK (por ejemplo, pedidos creados en paralelo),
      // devolvemos un mensaje claro para el frontend.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2003'
      ) {
        throw new ConflictException(
          'No se puede eliminar el proveedor porque tiene registros asociados (por ejemplo, pedidos).',
        );
      }
      throw err;
    }
  }

  async removePedidos(id: number) {
    await this.findOne(id);
    // Eliminar productos de cada pedido primero (cascade debería manejarlo, pero por seguridad)
    const pedidos = await this.prisma.pedido.findMany({
      where: { proveedorId: id },
      select: { id: true },
    });
    for (const pedido of pedidos) {
      await this.prisma.productoPedido.deleteMany({
        where: { pedidoId: pedido.id },
      });
    }
    const deleted = await this.prisma.pedido.deleteMany({
      where: { proveedorId: id },
    });
    return { message: `${deleted.count} pedido(s) eliminado(s) correctamente` };
  }

  async getStats() {
    const totalProveedores = await this.prisma.proveedor.count({
      where: { activo: true },
    });

    const pedidosEsteMes = await this.prisma.pedido.count({
      where: {
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    });

    const calificaciones = await this.prisma.pedido.findMany({
      where: { calidad: { not: null } },
      select: {
        calidad: true,
        respuesta: true,
        puntualidad: true,
        confianza: true,
        presentacion: true,
      },
    });

    let calificacionPromedio = 0;
    if (calificaciones.length > 0) {
      const suma = calificaciones.reduce(
        (acc, p) =>
          acc +
          ((p.calidad ?? 0) +
            (p.respuesta ?? 0) +
            (p.puntualidad ?? 0) +
            (p.confianza ?? 0) +
            (p.presentacion ?? 0)) /
            5,
        0,
      );
      calificacionPromedio =
        Math.round((suma / calificaciones.length) * 10) / 10;
    }

    const pedidosTotales = await this.prisma.pedido.count();
    const pedidosCompletados = await this.prisma.pedido.count({
      where: { estado: 'ACEPTADO' },
    });
    const tasaEntrega =
      pedidosTotales > 0
        ? Math.round((pedidosCompletados / pedidosTotales) * 100)
        : 0;

    return {
      totalProveedores,
      pedidosEsteMes,
      calificacionPromedio,
      tasaEntrega,
    };
  }

  async getProductos(proveedorId: number) {
    await this.findOne(proveedorId);
    return this.prisma.productoProveedor.findMany({
      where: { proveedorId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createProducto(
    proveedorId: number,
    dto: CreateProductoProveedorDto,
    foto?: Express.Multer.File,
  ) {
    await this.findOne(proveedorId);
    const fotoUrl = foto
      ? await this.uploadService.uploadFile(foto, 'proveedores/productos')
      : undefined;
    return this.prisma.productoProveedor.create({
      data: {
        proveedorId,
        nombre: dto.nombre,
        descripcion: dto.descripcion ?? null,
        moneda: dto.moneda ?? null,
        precioNacional: dto.precioNacional ?? null,
        precioDolar: dto.precioDolar ?? null,
        fotoUrl,
      },
    });
  }

  async updateProducto(
    proveedorId: number,
    productoId: number,
    dto: CreateProductoProveedorDto,
    foto?: Express.Multer.File,
  ) {
    const producto = await this.prisma.productoProveedor.findFirst({
      where: { id: productoId, proveedorId },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');

    const fotoUrl = foto
      ? await this.uploadService.uploadFile(foto, 'proveedores/productos')
      : undefined;

    return this.prisma.productoProveedor.update({
      where: { id: productoId },
      data: {
        nombre: dto.nombre,
        descripcion: dto.descripcion ?? null,
        moneda: dto.moneda ?? null,
        precioNacional: dto.precioNacional ?? null,
        precioDolar: dto.precioDolar ?? null,
        ...(fotoUrl && { fotoUrl }),
      },
    });
  }

  async deleteProducto(proveedorId: number, productoId: number) {
    const producto = await this.prisma.productoProveedor.findFirst({
      where: { id: productoId, proveedorId },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    await this.prisma.productoProveedor.delete({ where: { id: productoId } });
    return { message: 'Producto eliminado' };
  }
}
