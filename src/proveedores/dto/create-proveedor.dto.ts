import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDate,
  IsString,
  IsEmail,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  MinLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ESTADOS_VERIFICACION } from '../codigo-proveedor';

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rubro?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subrubro?: string;

  @ApiPropertyOptional({
    description: 'Productos o categorías que comercializa el proveedor',
  })
  @IsOptional()
  @IsString()
  productosComercializa?: string;

  @ApiPropertyOptional({ description: 'Persona de contacto comercial' })
  @IsOptional()
  @IsString()
  personaContacto?: string;

  @ApiPropertyOptional({ example: 'https://proveedor.example' })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ description: 'Enlaces a redes sociales' })
  @IsOptional()
  @IsString()
  redesSociales?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  entrega?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ruc?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  representante?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dni?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  telefonoRep?: string;

  @ApiPropertyOptional({ example: 'Comentario adicional' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === '' ? undefined : value))
  comentarios?: string;

  @ApiPropertyOptional({
    enum: ESTADOS_VERIFICACION,
    default: 'NV',
    description:
      'VE=verificado, NV=no verificado, NF=no encontrado, IN=inferido',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn(ESTADOS_VERIFICACION)
  estadoVerificacion?: (typeof ESTADOS_VERIFICACION)[number];

  @ApiPropertyOptional({
    example: '2026-09-27T18:00:00.000Z',
    description: 'Fecha y hora de la verificación',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  fechaVerificacion?: Date;

  @ApiPropertyOptional({
    description: 'Fuente o fuentes utilizadas para la verificación',
  })
  @IsOptional()
  @IsString()
  fuenteVerificacion?: string;

  @ApiPropertyOptional({
    example: '2026-09-27',
    description: 'Fecha de captación inicial del proveedor',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  fechaDiscovery?: Date;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Evidencia y estado de verificación por cada campo importado',
  })
  @IsOptional()
  @Transform(({ value }) => parseJson(value))
  @IsObject()
  evidenciaVerificacion?: Record<string, unknown>;

  // Campos de acceso (legacy). Ya no son obligatorios para crear un proveedor.
  @ApiPropertyOptional({ example: 'IMPO-123456' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === '' ? undefined : value))
  usuarioAcceso?: string;

  @ApiPropertyOptional({ example: 'miPassword123' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @Transform(({ value }) => (value === '' ? undefined : value))
  passwordAcceso?: string;
}
