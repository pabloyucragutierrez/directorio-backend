import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('El email ya está registrado');

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { ...dto, password: hashed },
    });

    const { password, ...result } = user;
    return result;
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: { id: true, nombre: true, email: true, activo: true, createdAt: true },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const { password, ...result } = user;
    return result;
  }

  async update(id: number, dto: UpdateUserDto) {
    await this.findOne(id);
    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 10);
    }
    const user = await this.prisma.user.update({ where: { id }, data: dto });
    const { password, ...result } = user;
    return result;
  }
 
  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.user.update({ where: { id }, data: { activo: false } });
    return { message: 'Usuario desactivado correctamente' };
  }
}