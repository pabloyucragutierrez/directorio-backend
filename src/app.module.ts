import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProveedoresModule } from './proveedores/proveedores.module';
import { PedidosModule } from './pedidos/pedidos.module';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProveedoresModule,
    PedidosModule,
    UploadModule,
  ],
})
export class AppModule {}