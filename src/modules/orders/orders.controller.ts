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
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetTenant } from '../auth/decorators/get-tenant.decorator';
import { OrderStatus } from '@prisma/client';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
    constructor(private readonly ordersService: OrdersService) { }

    @Post()
    create(@GetTenant() tenantId: number, @Body() createOrderDto: CreateOrderDto) {
        return this.ordersService.create(tenantId, createOrderDto);
    }

    @Get()
    findAll(
        @GetTenant() tenantId: number,
        @Query('page', ParseIntPipe) page: number = 1,
        @Query('limit', ParseIntPipe) limit: number = 10,
        @Query('status') status?: OrderStatus,
    ) {
        return this.ordersService.findAll(tenantId, page, limit, status);
    }

    @Get('stats/pending-count')
    getPendingCount(@GetTenant() tenantId: number) {
        return this.ordersService.getPendingCount(tenantId);
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number, @GetTenant() tenantId: number) {
        return this.ordersService.findOne(id, tenantId);
    }

    @Patch(':id/status')
    updateStatus(
        @Param('id', ParseIntPipe) id: number,
        @GetTenant() tenantId: number,
        @Body() updateStatusDto: UpdateOrderStatusDto,
    ) {
        return this.ordersService.updateStatus(id, tenantId, updateStatusDto);
    }
}
