import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';
import { CreateProductoProveedorDto } from './dto/create-producto-proveedor.dto';
import { UploadService } from '../upload/upload.service';

@Injectable()
export class ProveedoresService {
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
  ) {}

  async create(dto: CreateProveedorDto, files: { copiaRuc?: Express.Multer.File[]; copiaLicencia?: Express.Multer.File[]; copiaDni?: Express.Multer.File[] }) {
    const exists = await this.prisma.proveedor.findUnique({ where: { ruc: dto.ruc } });
    if (exists) throw new ConflictException('Ya existe un proveedor con ese RUC');

    const copiaRucUrl = files?.copiaRuc?.[0] ? await this.uploadService.uploadFile(files.copiaRuc[0], 'proveedores/ruc') : undefined;
    const copiaLicenciaUrl = files?.copiaLicencia?.[0] ? await this.uploadService.uploadFile(files.copiaLicencia[0], 'proveedores/licencias') : undefined;
    const copiaDniUrl = files?.copiaDni?.[0] ? await this.uploadService.uploadFile(files.copiaDni[0], 'proveedores/dni') : undefined;

    return this.prisma.proveedor.create({
      data: { ...dto, copiaRucUrl, copiaLicenciaUrl, copiaDniUrl },
    });
  }

  async findAll(search?: string) {
    return this.prisma.proveedor.findMany({
      where: search ? {
        OR: [
          { razonSocial: { contains: search, mode: 'insensitive' } },
          { pais: { contains: search, mode: 'insensitive' } },
          { ruc: { contains: search } },
        ],
      } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const proveedor = await this.prisma.proveedor.findUnique({
      where: { id },
      include: {
        pedidos: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!proveedor) throw new NotFoundException('Proveedor no encontrado');
    return proveedor;
  }

  async update(id: number, dto: UpdateProveedorDto, files: { copiaRuc?: Express.Multer.File[]; copiaLicencia?: Express.Multer.File[]; copiaDni?: Express.Multer.File[] }) {
    await this.findOne(id);

    const copiaRucUrl = files?.copiaRuc?.[0] ? await this.uploadService.uploadFile(files.copiaRuc[0], 'proveedores/ruc') : undefined;
    const copiaLicenciaUrl = files?.copiaLicencia?.[0] ? await this.uploadService.uploadFile(files.copiaLicencia[0], 'proveedores/licencias') : undefined;
    const copiaDniUrl = files?.copiaDni?.[0] ? await this.uploadService.uploadFile(files.copiaDni[0], 'proveedores/dni') : undefined;

    return this.prisma.proveedor.update({
      where: { id },
      data: {
        ...dto,
        ...(copiaRucUrl && { copiaRucUrl }),
        ...(copiaLicenciaUrl && { copiaLicenciaUrl }),
        ...(copiaDniUrl && { copiaDniUrl }),
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.proveedor.update({ where: { id }, data: { activo: false } });
  }

  async getStats() {
    const totalProveedores = await this.prisma.proveedor.count({ where: { activo: true } });

    const pedidosEsteMes = await this.prisma.pedido.count({
      where: {
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
    });

    const calificaciones = await this.prisma.pedido.findMany({
      where: { calidad: { not: null } },
      select: { calidad: true, respuesta: true, puntualidad: true, confianza: true, presentacion: true },
    });

    let calificacionPromedio = 0;
    if (calificaciones.length > 0) {
      const suma = calificaciones.reduce((acc, p) => {
        return acc + ((p.calidad ?? 0) + (p.respuesta ?? 0) + (p.puntualidad ?? 0) + (p.confianza ?? 0) + (p.presentacion ?? 0)) / 5;
      }, 0);
      calificacionPromedio = Math.round((suma / calificaciones.length) * 10) / 10;
    }

    const pedidosTotales = await this.prisma.pedido.count();
    const pedidosCompletados = await this.prisma.pedido.count({ where: { estado: 'ACEPTADO' } });
    const tasaEntrega = pedidosTotales > 0 ? Math.round((pedidosCompletados / pedidosTotales) * 100) : 0;

    return { totalProveedores, pedidosEsteMes, calificacionPromedio, tasaEntrega };
  }

  // ── Productos del proveedor ────────────────────────────────────────────────

  async getProductos(proveedorId: number) {
    await this.findOne(proveedorId);
    return this.prisma.productoProveedor.findMany({
      where: { proveedorId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createProducto(proveedorId: number, dto: CreateProductoProveedorDto, foto?: Express.Multer.File) {
    await this.findOne(proveedorId);
    const fotoUrl = foto ? await this.uploadService.uploadFile(foto, 'proveedores/productos') : undefined;
    return this.prisma.productoProveedor.create({
      data: {
        proveedorId,
        nombre: dto.nombre,
        descripcion: dto.descripcion ?? null,
        precioNacional: dto.precioNacional ?? null,
        precioDolar: dto.precioDolar ?? null,
        fotoUrl,
      },
    });
  }

  async updateProducto(proveedorId: number, productoId: number, dto: CreateProductoProveedorDto, foto?: Express.Multer.File) {
    const producto = await this.prisma.productoProveedor.findFirst({
      where: { id: productoId, proveedorId },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');

    const fotoUrl = foto ? await this.uploadService.uploadFile(foto, 'proveedores/productos') : undefined;

    return this.prisma.productoProveedor.update({
      where: { id: productoId },
      data: {
        nombre: dto.nombre,
        descripcion: dto.descripcion ?? null,
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