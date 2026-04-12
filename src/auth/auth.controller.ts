import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginProveedorDto } from './dto/login-proveedor.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login administrador' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('login-proveedor')
  @ApiOperation({ summary: 'Login proveedor' })
  loginProveedor(@Body() dto: LoginProveedorDto) {
    return this.authService.loginProveedor(dto);
  }
}