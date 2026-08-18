import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
  Query,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
} from '@nestjs/common';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiQuery,
} from '@nestjs/swagger';
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
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'copiaRuc', maxCount: 1 },
        { name: 'copiaLicencia', maxCount: 1 },
        { name: 'copiaDni', maxCount: 1 },
      ],
      { storage: memoryStorage() },
    ),
  )
  create(
    @Body() dto: CreateProveedorDto,
    @UploadedFiles()
    files: {
      copiaRuc?: Express.Multer.File[];
      copiaLicencia?: Express.Multer.File[];
      copiaDni?: Express.Multer.File[];
    },
  ) {
    return this.proveedoresService.create(dto, files);
  }

  @Get()
  @ApiOperation({ summary: 'Listar proveedores' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({
    name: 'rubro',
    required: false,
    description: 'Filtro exacto por rubro',
  })
  findAll(@Query('search') search?: string) {
    return this.proveedoresService.findAll(search);
  }

  @Get('paged')
  @ApiOperation({ summary: 'Listar proveedores (paginado para scroll)' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'ID del último proveedor recibido',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Cantidad de items por página (default 20, max 100)',
  })
  findPaged(
    @Query('search') search?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.proveedoresService.findPaged({
      search,
      cursor: cursor ? Number(cursor) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('consultas-paged')
  @ApiOperation({
    summary: 'Listar proveedores para consultas (paginado para scroll)',
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'ciudad', required: false, description: 'Filtro parcial por ciudad' })
  @ApiQuery({ name: 'subrubro', required: false, description: 'Filtro parcial por subrubro' })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'ID del último proveedor recibido',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Cantidad de items por página (default 20, max 100)',
  })
  findConsultasPaged(
    @Query('search') search?: string,
    @Query('rubro') rubro?: string,
    @Query('ciudad') ciudad?: string,
    @Query('subrubro') subrubro?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.proveedoresService.findConsultasPaged({
      search,
      rubro,
      ciudad,
      subrubro,
      cursor: cursor ? Number(cursor) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('rubros')
  @ApiOperation({ summary: 'Listar rubros disponibles (distinct)' })
  getRubros() {
    return this.proveedoresService.getRubros();
  }

  @Get('stats')
  @ApiOperation({ summary: 'EstadÃ­sticas del dashboard' })
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
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'copiaRuc', maxCount: 1 },
        { name: 'copiaLicencia', maxCount: 1 },
        { name: 'copiaDni', maxCount: 1 },
      ],
      { storage: memoryStorage() },
    ),
  )
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProveedorDto,
    @UploadedFiles()
    files: {
      copiaRuc?: Express.Multer.File[];
      copiaLicencia?: Express.Multer.File[];
      copiaDni?: Express.Multer.File[];
    },
  ) {
    return this.proveedoresService.update(id, dto, files);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar proveedor' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.proveedoresService.remove(id);
  }

  @Delete(':id/pedidos')
  @ApiOperation({ summary: 'Eliminar todos los pedidos de un proveedor' })
  removePedidos(@Param('id', ParseIntPipe) id: number) {
    return this.proveedoresService.removePedidos(id);
  }

  // â”€â”€ Productos del proveedor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
