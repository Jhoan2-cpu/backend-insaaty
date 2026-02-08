import {
    Controller,
    Get,
    Post,
    Patch,
    Body,
    Param,
    Query,
    ParseIntPipe,
    UseGuards,
    Request,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrderStatus } from '@prisma/client';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
    constructor(private readonly ordersService: OrdersService) { }

    @Post()
    create(@Body() createOrderDto: CreateOrderDto, @Request() req) {
        return this.ordersService.create(req.user.tenantId, createOrderDto);
    }

    @Get()
    findAll(
        @Request() req,
        @Query('page', ParseIntPipe) page: number = 1,
        @Query('limit', ParseIntPipe) limit: number = 10,
        @Query('status') status?: OrderStatus,
    ) {
        return this.ordersService.findAll(req.user.tenantId, page, limit, status);
    }

    @Get('stats/pending-count')
    getPendingCount(@Request() req) {
        return this.ordersService.getPendingCount(req.user.tenantId);
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
        return this.ordersService.findOne(id, req.user.tenantId);
    }

    @Patch(':id/status')
    updateStatus(
        @Param('id', ParseIntPipe) id: number,
        @Request() req,
        @Body() updateStatusDto: UpdateOrderStatusDto,
    ) {
        return this.ordersService.updateStatus(id, req.user.tenantId, updateStatusDto);
    }
}
