import { PartialType } from '@nestjs/swagger';
import { CreateProveedorDto } from './create-proveedor.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class UpdateProveedorDto extends PartialType(CreateProveedorDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  activo?: boolean;
}