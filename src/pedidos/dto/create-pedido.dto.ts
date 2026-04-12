import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsInt, IsArray, ValidateNested, IsNumber, IsPositive, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class ProductoPedidoDto {
  @ApiProperty({ example: 'Camisas manga corta' })
  @IsString()
  nombre!: string;

  @ApiProperty({ example: 50 })
  @IsInt()
  @IsPositive()
  cantidad!: number;

  @ApiProperty({ example: 35.00 })
  @IsNumber()
  @IsPositive()
  precio!: number;
}

export class CreatePedidoDto {
  @ApiPropertyOptional({ example: 'PED-000001' })
  @IsOptional()
  @IsString()
  numero?: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  proveedorId!: number;

  @ApiProperty({ example: '2025-04-01T09:30:00.000Z' })
  @IsString()
  fecha!: string;

  @ApiPropertyOptional({ example: 'Por favor entregar en horario de mañana' })
  @IsOptional()
  @IsString()
  comentario?: string;

  @ApiProperty({ type: [ProductoPedidoDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductoPedidoDto)
  productos!: ProductoPedidoDto[];
}