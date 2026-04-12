import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { LoginProveedorDto } from './dto/login-proveedor.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user || !user.activo) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    const token = this.jwtService.sign({ sub: user.id, email: user.email, role: 'admin' });

    return {
      access_token: token,
      user: { id: user.id, nombre: user.nombre, email: user.email },
    };
  }

  async loginProveedor(dto: LoginProveedorDto) {
    const proveedor = await this.prisma.proveedor.findUnique({
      where: { usuarioAcceso: dto.usuarioAcceso },
    });

    if (!proveedor || !proveedor.activo || !proveedor.passwordAcceso) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const valid = await bcrypt.compare(dto.passwordAcceso, proveedor.passwordAcceso);
    if (!valid) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const token = this.jwtService.sign({
      sub: proveedor.id,
      usuarioAcceso: proveedor.usuarioAcceso,
      role: 'proveedor',
    });

    return {
      access_token: token,
      proveedor: {
        id: proveedor.id,
        razonSocial: proveedor.razonSocial,
        usuarioAcceso: proveedor.usuarioAcceso,
      },
    };
  }
}