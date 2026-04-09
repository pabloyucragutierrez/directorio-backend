import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { UpdatePedidoDto } from './dto/update-pedido.dto';
import { EstadoPedido } from '@prisma/client';

@Injectable()
export class PedidosService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreatePedidoDto) {
    const exists = await this.prisma.pedido.findUnique({ where: { numero: dto.numero } });
    if (exists) throw new ConflictException('Ya existe un pedido con ese número');

    const proveedor = await this.prisma.proveedor.findUnique({ where: { id: dto.proveedorId } });
    if (!proveedor) throw new NotFoundException('Proveedor no encontrado');

    return this.prisma.pedido.create({
      data: {
        numero: dto.numero,
        proveedorId: dto.proveedorId,
        fecha: new Date(dto.fecha),
        productos: { create: dto.productos },
      },
      include: { productos: true, proveedor: true },
    });
  }

  async findAll(search?: string) {
    return this.prisma.pedido.findMany({
      where: search ? {
        OR: [
          { numero: { contains: search, mode: 'insensitive' } },
          { proveedor: { razonSocial: { contains: search, mode: 'insensitive' } } },
        ],
      } : undefined,
      include: { proveedor: { select: { razonSocial: true } }, productos: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id },
      include: { productos: true, proveedor: true },
    });
    if (!pedido) throw new NotFoundException('Pedido no encontrado');
    return pedido;
  }

  async update(id: number, dto: UpdatePedidoDto) {
    await this.findOne(id);

    const { estado, fechaEntrega, ...rest } = dto;

    return this.prisma.pedido.update({
      where: { id },
      data: {
        ...rest,
        ...(estado && { estado: estado as EstadoPedido }),
        ...(fechaEntrega && { fechaEntrega: new Date(fechaEntrega) }),
      },
      include: { productos: true, proveedor: true },
    });
  }

  async getReporte(desde?: string, hasta?: string) {
    const proveedores = await this.prisma.proveedor.findMany({
      include: {
        pedidos: {
          where: (desde || hasta) ? {
            fecha: {
              ...(desde && { gte: new Date(desde) }),
              ...(hasta && { lte: new Date(hasta) }),
            },
          } : undefined,
        },
      },
    });

    return proveedores.map((p) => {
      const total = p.pedidos.length;
      const completados = p.pedidos.filter((ped) => ped.estado === 'ACEPTADO').length;
      const cals = p.pedidos.filter((ped) => ped.calidad !== null);
      const calificacion = cals.length > 0
        ? Math.round((cals.reduce((acc, ped) =>
            acc + ((ped.calidad ?? 0) + (ped.respuesta ?? 0) + (ped.puntualidad ?? 0) + (ped.confianza ?? 0) + (ped.presentacion ?? 0)) / 5, 0
          ) / cals.length) * 10) / 10
        : 0;

      return { proveedor: p.razonSocial, pais: p.pais, total, completados, calificacion };
    });
  }
}