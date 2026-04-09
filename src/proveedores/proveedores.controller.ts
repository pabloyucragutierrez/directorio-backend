import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe, Query, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { ProveedoresService } from './proveedores.service';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Proveedores')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('proveedores')
export class ProveedoresController {
  constructor(private proveedoresService: ProveedoresService) {}

  @Post()
  @ApiOperation({ summary: 'Crear proveedor' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'copiaRuc', maxCount: 1 },
    { name: 'copiaLicencia', maxCount: 1 },
    { name: 'copiaDni', maxCount: 1 },
  ], { storage: memoryStorage() }))
  create(
    @Body() dto: CreateProveedorDto,
    @UploadedFiles() files: { copiaRuc?: Express.Multer.File[]; copiaLicencia?: Express.Multer.File[]; copiaDni?: Express.Multer.File[] },
  ) {
    return this.proveedoresService.create(dto, files);
  }

  @Get()
  @ApiOperation({ summary: 'Listar proveedores' })
  @ApiQuery({ name: 'search', required: false })
  findAll(@Query('search') search?: string) {
    return this.proveedoresService.findAll(search);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estadísticas del dashboard' })
  getStats() {
    return this.proveedoresService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener proveedor' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.proveedoresService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar proveedor' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'copiaRuc', maxCount: 1 },
    { name: 'copiaLicencia', maxCount: 1 },
    { name: 'copiaDni', maxCount: 1 },
  ], { storage: memoryStorage() }))
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProveedorDto,
    @UploadedFiles() files: { copiaRuc?: Express.Multer.File[]; copiaLicencia?: Express.Multer.File[]; copiaDni?: Express.Multer.File[] },
  ) {
    return this.proveedoresService.update(id, dto, files);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Desactivar proveedor' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.proveedoresService.remove(id);
  }
}