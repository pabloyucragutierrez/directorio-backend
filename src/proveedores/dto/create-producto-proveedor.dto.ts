import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsPositive, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateProductoProveedorDto {
  @ApiProperty({ example: 'Camisa manga corta' })
  @IsString()
  nombre!: string;

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