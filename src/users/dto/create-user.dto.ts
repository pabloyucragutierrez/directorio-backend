import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsOptional, IsInt } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Administrador' })
  @IsString()
  nombre!: string;

  @ApiProperty({ example: 'admin@empresa.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiPropertyOptional({ example: 'administrador', enum: ['administrador', 'proveedor'] })
  @IsOptional()
  @IsString()
  rol?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  proveedorId?: number;
}