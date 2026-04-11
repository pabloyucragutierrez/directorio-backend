import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsPositive, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateProductoProveedorDto {
  @ApiPropertyOptional({ example: 'Camisa manga corta' })
  @IsString()
  nombre!: string;

  @ApiPropertyOptional({ example: 'Camisa de algodón 100%, disponible en tallas S, M, L' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  descripcion?: string;

  @ApiPropertyOptional({ example: 120.00 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Transform(({ value }) => (value === '' || value === null || value === undefined ? undefined : Number(value)))
  precioNacional?: number;

  @ApiPropertyOptional({ example: 35.00 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Transform(({ value }) => (value === '' || value === null || value === undefined ? undefined : Number(value)))
  precioDolar?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fotoUrl?: string;
}