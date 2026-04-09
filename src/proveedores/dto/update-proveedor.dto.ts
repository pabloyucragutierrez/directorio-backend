import { PartialType } from '@nestjs/swagger';
import { CreateProveedorDto } from './create-proveedor.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProveedorDto extends PartialType(CreateProveedorDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}