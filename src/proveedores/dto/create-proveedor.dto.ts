import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsBoolean, IsOptional } from 'class-validator';
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

  @ApiProperty({ example: 'Alimentos y Bebidas' })
  @IsString()
  rubro!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subrubro?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  entrega?: boolean;

  @ApiProperty({ example: 'contacto@xyz.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '20512345678' })
  @IsString()
  ruc!: string;

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

  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  representante!: string;

  @ApiProperty({ example: '12345678' })
  @IsString()
  dni!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  telefonoRep?: string;
}