import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsPositive, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateProductoProveedorDto {
  @ApiProperty({ example: 'Camisa manga corta' })
  @IsString()
  nombre!: string;

  @ApiPropertyOptional({ example: 'Camisa de algodón 100%' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    value === '' || value === null ? undefined : value,
  )
  descripcion?: string;

  @ApiPropertyOptional({ example: 120.0 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined
      ? undefined
      : Number(value),
  )
  precioNacional?: number;

  @ApiPropertyOptional({ example: 35.0 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined
      ? undefined
      : Number(value),
  )
  precioDolar?: number;

  @ApiPropertyOptional({ example: 'PEN' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    value === '' || value === null ? undefined : value,
  )
  moneda?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fotoUrl?: string;
}
