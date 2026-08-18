import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LoginProveedorDto {
  @ApiProperty({ example: 'PROV-123456' })
  @IsString()
  usuarioAcceso!: string;

  @ApiProperty({ example: 'abc123' })
  @IsString()
  @MinLength(6)
  passwordAcceso!: string;
}
