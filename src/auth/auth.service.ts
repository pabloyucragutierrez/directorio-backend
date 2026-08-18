import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // Un solo login para:
  // - Administrador (User) usando email/password
  // - Proveedor (Proveedor) usando usuarioAcceso/passwordAcceso
  async login(dto: LoginDto) {
    const identifier = dto.email?.trim(); // email o usuarioAcceso
    const password = dto.password;

    // 1) Intentar como usuario por email (admin o proveedor "tipo user")
    if (identifier) {
      const user = await this.prisma.user.findUnique({
        where: { email: identifier },
      });
      if (user && user.activo) {
        const valid = await bcrypt.compare(password, user.password);
        if (valid) {
          const userRol = (user.rol ?? '').toLowerCase();

          // Si el usuario está marcado como proveedor, autenticamos como "proveedor" (principal = Proveedor)
          // para que /pedidos/mis-pedidos funcione con proveedorId en el token.
          if (userRol === 'proveedor') {
            if (!user.proveedorId) {
              throw new UnauthorizedException(
                'Usuario proveedor sin proveedor vinculado',
              );
            }

            const proveedor = await this.prisma.proveedor.findUnique({
              where: { id: user.proveedorId },
            });
            if (!proveedor || !proveedor.activo) {
              throw new UnauthorizedException(
                'Proveedor no encontrado o inactivo',
              );
            }

            const token = this.jwtService.sign({
              sub: proveedor.id,
              usuarioAcceso: proveedor.usuarioAcceso,
              role: 'proveedor',
            });

            return {
              access_token: token,
              role: 'proveedor',
              proveedor: {
                id: proveedor.id,
                razonSocial: proveedor.razonSocial,
                usuarioAcceso: proveedor.usuarioAcceso,
              },
            };
          }

          // Caso por defecto: administrador
          const token = this.jwtService.sign({
            sub: user.id,
            email: user.email,
            role: 'admin',
          });

          return {
            access_token: token,
            role: 'admin',
            user: { id: user.id, nombre: user.nombre, email: user.email },
          };
        }
      }
    }

    // 2) Intentar como proveedor por usuarioAcceso (mismo endpoint)
    if (!identifier) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const proveedor = await this.prisma.proveedor.findUnique({
      where: { usuarioAcceso: identifier },
    });

    if (!proveedor || !proveedor.activo || !proveedor.passwordAcceso) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const validProveedor = await bcrypt.compare(
      password,
      proveedor.passwordAcceso,
    );
    if (!validProveedor) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const token = this.jwtService.sign({
      sub: proveedor.id,
      usuarioAcceso: proveedor.usuarioAcceso,
      role: 'proveedor',
    });

    return {
      access_token: token,
      role: 'proveedor',
      proveedor: {
        id: proveedor.id,
        razonSocial: proveedor.razonSocial,
        usuarioAcceso: proveedor.usuarioAcceso,
      },
    };
  }
}
