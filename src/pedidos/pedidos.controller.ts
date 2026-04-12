import { Controller, Get, Post, Body, Patch, Param, UseGuards, ParseIntPipe, Query, Request } from '@nestjs/common';
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

  @Get('reporte')
  @ApiOperation({ summary: 'Reporte por proveedor' })
  @ApiQuery({ name: 'desde', required: false })
  @ApiQuery({ name: 'hasta', required: false })
  getReporte(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.pedidosService.getReporte(desde, hasta);
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
}