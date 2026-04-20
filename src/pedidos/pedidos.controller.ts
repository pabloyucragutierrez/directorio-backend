import { Controller, Get, Post, Body, Patch, Param, UseGuards, ParseIntPipe, Query, Request, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PedidosService } from './pedidos.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { UpdatePedidoDto } from './dto/update-pedido.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Pedidos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pedidos')
export class PedidosController {
  constructor(private pedidosService: PedidosService) {}

  @Post()
  @ApiOperation({ summary: 'Crear pedido' })
  create(@Body() dto: CreatePedidoDto) {
    return this.pedidosService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar pedidos' })
  @ApiQuery({ name: 'search', required: false })
  findAll(@Query('search') search?: string) {
    return this.pedidosService.findAll(search);
  }

  @Get('paged')
  @ApiOperation({ summary: 'Listar pedidos (paginado para scroll)' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'cursor', required: false, description: 'ID del último pedido recibido' })
  @ApiQuery({ name: 'limit', required: false, description: 'Cantidad de items por página (default 20, max 100)' })
  findPaged(
    @Query('search') search?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.pedidosService.findPaged({
      search,
      cursor: cursor ? Number(cursor) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('reporte')
  @ApiOperation({ summary: 'Reporte por proveedor' })
  @ApiQuery({ name: 'desde', required: false })
  @ApiQuery({ name: 'hasta', required: false })
  getReporte(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.pedidosService.getReporte(desde, hasta);
  }

  @Get('reporte-paged')
  @ApiOperation({ summary: 'Reporte por proveedor (paginado para scroll)' })
  @ApiQuery({ name: 'desde', required: false })
  @ApiQuery({ name: 'hasta', required: false })
  @ApiQuery({ name: 'cursor', required: false, description: 'ID del ultimo proveedor recibido' })
  @ApiQuery({ name: 'limit', required: false, description: 'Cantidad de items por pagina (default 20, max 100)' })
  getReportePaged(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.pedidosService.getReportePaged({
      desde,
      hasta,
      cursor: cursor ? Number(cursor) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('mis-pedidos')
  @ApiOperation({ summary: 'Pedidos del proveedor autenticado' })
  misPedidos(@Request() req: any) {
    return this.pedidosService.findByProveedor(req.user.id);
  }

  @Post(':id/responder')
  @ApiOperation({ summary: 'Proveedor acepta o rechaza pedido' })
  responder(
    @Param('id', ParseIntPipe) id: number,
    @Body('accion') accion: 'ACEPTADO' | 'RECHAZADO',
    @Request() req: any,
  ) {
    return this.pedidosService.responderPedido(id, req.user.id, accion);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener pedido' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.pedidosService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar estado y calificación' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePedidoDto) {
    return this.pedidosService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar pedido' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.pedidosService.remove(id);
  }
}
