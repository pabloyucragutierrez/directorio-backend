import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) throw new ConflictException('El email ya está registrado');

    if (dto.rol === 'proveedor') {
      if (!dto.proveedorId)
        throw new BadRequestException('Debes seleccionar un proveedor');
      const proveedor = await this.prisma.proveedor.findUnique({
        where: { id: dto.proveedorId },
      });
      if (!proveedor) throw new NotFoundException('Proveedor no encontrado');
    }

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        nombre: dto.nombre,
        email: dto.email,
        password: hashed,
        rol: dto.rol ?? 'administrador',
        proveedorId: dto.rol === 'proveedor' ? dto.proveedorId : null,
      },
      include: { proveedor: { select: { id: true, razonSocial: true } } },
    });

    const { password, ...result } = user;
    return result;
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        nombre: true,
        email: true,
        activo: true,
        rol: true,
        proveedorId: true,
        proveedor: { select: { id: true, razonSocial: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { proveedor: { select: { id: true, razonSocial: true } } },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const { password, ...result } = user;
    return result;
  }

  async update(id: number, dto: UpdateUserDto) {
    await this.findOne(id);

    if (dto.rol === 'proveedor' && dto.proveedorId) {
      const proveedor = await this.prisma.proveedor.findUnique({
        where: { id: dto.proveedorId },
      });
      if (!proveedor) throw new NotFoundException('Proveedor no encontrado');
    }

    const data: any = { ...dto };
    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 10);
    }
    if (dto.rol === 'administrador') {
      data.proveedorId = null;
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      include: { proveedor: { select: { id: true, razonSocial: true } } },
    });
    const { password, ...result } = user;
    return result;
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
    return { message: 'Usuario eliminado correctamente' };
  }
}
