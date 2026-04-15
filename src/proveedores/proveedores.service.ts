import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';
import { CreateProductoProveedorDto } from './dto/create-producto-proveedor.dto';
import { UploadService } from '../upload/upload.service';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class ProveedoresService {
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
  ) {}

  async create(
    dto: CreateProveedorDto,
    files: {
      copiaRuc?: Express.Multer.File[];
      copiaLicencia?: Express.Multer.File[];
      copiaDni?: Express.Multer.File[];
    },
  ) {
    const { comentarios, ...dtoRest } = dto as any;

    if ((dtoRest.usuarioAcceso && !dtoRest.passwordAcceso) || (!dtoRest.usuarioAcceso && dtoRest.passwordAcceso)) {
      throw new BadRequestException('usuarioAcceso y passwordAcceso deben enviarse juntos');
    }

    if (dto.ruc) {
      const existsRuc = await this.prisma.proveedor.findFirst({ where: { ruc: dto.ruc } });
      if (existsRuc) throw new ConflictException('Ya existe un proveedor con ese RUC');
    }

    if (dtoRest.usuarioAcceso) {
      const existsUsuario = await this.prisma.proveedor.findUnique({
        where: { usuarioAcceso: dtoRest.usuarioAcceso },
      });
      if (existsUsuario) throw new ConflictException('Ese usuario de acceso ya está en uso');
    }

    const copiaRucUrl = files?.copiaRuc?.[0]
      ? await this.uploadService.uploadFile(files.copiaRuc[0], 'proveedores/ruc')
      : undefined;
    const copiaLicenciaUrl = files?.copiaLicencia?.[0]
      ? await this.uploadService.uploadFile(files.copiaLicencia[0], 'proveedores/licencias')
      : undefined;
    const copiaDniUrl = files?.copiaDni?.[0]
      ? await this.uploadService.uploadFile(files.copiaDni[0], 'proveedores/dni')
      : undefined;

    const passwordHash = dtoRest.passwordAcceso ? await bcrypt.hash(dtoRest.passwordAcceso, 10) : undefined;

    return this.prisma.proveedor.create({
      data: {
        ...dtoRest,
        ...(passwordHash && { passwordAcceso: passwordHash }),
        copiaRucUrl,
        copiaLicenciaUrl,
        copiaDniUrl,
      },
    });
  }

  async findAll(search?: string) {
    return this.prisma.proveedor.findMany({
      where: search
        ? {
            OR: [
              { razonSocial: { contains: search, mode: 'insensitive' } },
              { pais: { contains: search, mode: 'insensitive' } },
              { ruc: { contains: search } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const proveedor = await this.prisma.proveedor.findUnique({
      where: { id },
      include: { pedidos: { orderBy: { createdAt: 'desc' } } },
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
    await this.findOne(id);

    const copiaRucUrl = files?.copiaRuc?.[0]
      ? await this.uploadService.uploadFile(files.copiaRuc[0], 'proveedores/ruc')
      : undefined;
    const copiaLicenciaUrl = files?.copiaLicencia?.[0]
      ? await this.uploadService.uploadFile(files.copiaLicencia[0], 'proveedores/licencias')
      : undefined;
    const copiaDniUrl = files?.copiaDni?.[0]
      ? await this.uploadService.uploadFile(files.copiaDni[0], 'proveedores/dni')
      : undefined;

    const { comentarios, ...dtoRest } = dto as any;

    const data: any = {
      ...dtoRest,
      ...(copiaRucUrl && { copiaRucUrl }),
      ...(copiaLicenciaUrl && { copiaLicenciaUrl }),
      ...(copiaDniUrl && { copiaDniUrl }),
    };

    if (dtoRest.passwordAcceso) {
      data.passwordAcceso = await bcrypt.hash(dtoRest.passwordAcceso, 10);
    }

    return this.prisma.proveedor.update({ where: { id }, data });
  }

  async remove(id: number) {
    await this.findOne(id);

    // Verificar si tiene pedidos
    const pedidosCount = await this.prisma.pedido.count({ where: { proveedorId: id } });
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
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
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
    const pedidos = await this.prisma.pedido.findMany({ where: { proveedorId: id }, select: { id: true } });
    for (const pedido of pedidos) {
      await this.prisma.productoPedido.deleteMany({ where: { pedidoId: pedido.id } });
    }
    const deleted = await this.prisma.pedido.deleteMany({ where: { proveedorId: id } });
    return { message: `${deleted.count} pedido(s) eliminado(s) correctamente` };
  }

  async getStats() {
    const totalProveedores = await this.prisma.proveedor.count({ where: { activo: true } });

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
          ((p.calidad ?? 0) + (p.respuesta ?? 0) + (p.puntualidad ?? 0) +
            (p.confianza ?? 0) + (p.presentacion ?? 0)) / 5,
        0,
      );
      calificacionPromedio = Math.round((suma / calificaciones.length) * 10) / 10;
    }

    const pedidosTotales = await this.prisma.pedido.count();
    const pedidosCompletados = await this.prisma.pedido.count({ where: { estado: 'ACEPTADO' } });
    const tasaEntrega = pedidosTotales > 0
      ? Math.round((pedidosCompletados / pedidosTotales) * 100)
      : 0;

    return { totalProveedores, pedidosEsteMes, calificacionPromedio, tasaEntrega };
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
