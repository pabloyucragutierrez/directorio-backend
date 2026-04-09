import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, IsArray, ValidateNested, IsNumber, IsPositive } from 'class-validator';
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
  @ApiProperty({ example: 'PED-0001' })
  @IsString()
  numero!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  proveedorId!: number;

  @ApiProperty({ example: '2025-04-01T09:30:00.000Z' })
  @IsString()
  fecha!: string;

  @ApiProperty({ type: [ProductoPedidoDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductoPedidoDto)
  productos!: ProductoPedidoDto[];
}