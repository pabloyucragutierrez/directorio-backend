import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, IsNumber, IsOptional, IsInt, Min, Max } from 'class-validator';

export class UpdatePedidoDto {
  @ApiPropertyOptional({ enum: ['PENDIENTE', 'ACEPTADO', 'RECHAZADO', 'AGOTADO'] })
  @IsOptional()
  @IsString()
  estado?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tipoEntrega?: string;

  @ApiPropertyOptional({ example: '2025-04-05T14:00:00.000Z' })
  @IsOptional()
  @IsString()
  fechaEntrega?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  entregaPuntual?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pagoRealizado?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  importePagado?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  calidad?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  respuesta?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  puntualidad?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  confianza?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  presentacion?: number;
}