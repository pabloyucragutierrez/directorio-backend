import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsPositive, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateProductoProveedorDto {
  @ApiProperty({ example: 'Camisa manga corta' })
  @IsString()
  nombre!: string;

  @ApiPropertyOptional({ example: 'Camisa de algodón 100%, disponible en tallas S, M, L' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  descripcion?: string;

  @ApiProperty({ example: 35.00 })
  @IsNumber()
  @IsPositive()
  @Transform(({ value }) => Number(value))
  precio!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fotoUrl?: string;
}