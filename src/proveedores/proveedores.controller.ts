import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  UseGuards, ParseIntPipe, Query, UseInterceptors, UploadedFiles, UploadedFile,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { ProveedoresService } from './proveedores.service';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';
import { CreateProductoProveedorDto } from './dto/create-producto-proveedor.dto';
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

  // ── Productos del proveedor ────────────────────────────────────────────────

  @Get(':id/productos')
  @ApiOperation({ summary: 'Listar productos del proveedor' })
  getProductos(@Param('id', ParseIntPipe) id: number) {
    return this.proveedoresService.getProductos(id);
  }

  @Post(':id/productos')
  @ApiOperation({ summary: 'Crear producto del proveedor' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('foto', { storage: memoryStorage() }))
  createProducto(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateProductoProveedorDto,
    @UploadedFile() foto?: Express.Multer.File,
  ) {
    return this.proveedoresService.createProducto(id, dto, foto);
  }

  @Patch(':id/productos/:productoId')
  @ApiOperation({ summary: 'Actualizar producto del proveedor' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('foto', { storage: memoryStorage() }))
  updateProducto(
    @Param('id', ParseIntPipe) id: number,
    @Param('productoId', ParseIntPipe) productoId: number,
    @Body() dto: CreateProductoProveedorDto,
    @UploadedFile() foto?: Express.Multer.File,
  ) {
    return this.proveedoresService.updateProducto(id, productoId, dto, foto);
  }

  @Delete(':id/productos/:productoId')
  @ApiOperation({ summary: 'Eliminar producto del proveedor' })
  deleteProducto(
    @Param('id', ParseIntPipe) id: number,
    @Param('productoId', ParseIntPipe) productoId: number,
  ) {
    return this.proveedoresService.deleteProducto(id, productoId);
  }
}