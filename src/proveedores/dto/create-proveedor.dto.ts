import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsBoolean, IsOptional, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateProveedorDto {
  @ApiProperty({ example: 'Importaciones XYZ S.A.' })
  @IsString()
  razonSocial!: string;

  @ApiProperty({ example: 'Perú' })
  @IsString()
  pais!: string;

  @ApiProperty({ example: 'Lima' })
  @IsString()
  ciudad!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  distrito?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  codigoPostal?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referencia?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rubro?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subrubro?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  entrega?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ruc?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  licencia?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  whatsapp?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  formaPago?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  datosPago?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  representante?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dni?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  telefonoRep?: string;

  @ApiPropertyOptional({ example: 'Comentario adicional' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === '' ? undefined : value))
  comentarios?: string;

  // Campos de acceso (legacy). Ya no son obligatorios para crear un proveedor.
  @ApiPropertyOptional({ example: 'IMPO-123456' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === '' ? undefined : value))
  usuarioAcceso?: string;

  @ApiPropertyOptional({ example: 'miPassword123' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @Transform(({ value }) => (value === '' ? undefined : value))
  passwordAcceso?: string;
}
