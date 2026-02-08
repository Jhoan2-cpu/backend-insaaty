import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Query,
    ParseIntPipe,
    Req,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { GetTenantId } from '../auth/decorators/get-tenant-id.decorator';
import { OrderStatus } from '@prisma/client';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
    constructor(private readonly ordersService: OrdersService) { }

    @Get('stats/pending-count')
    getPendingCount(@GetTenantId() tenantId: number) {
        return this.ordersService.getPendingCount(tenantId);
    }

    @Post()
    create(
        @Body() createOrderDto: CreateOrderDto,
        @GetTenantId() tenantId: number,
        @GetUser('id') userId: number,
    ) {
        return this.ordersService.create(createOrderDto, tenantId, userId);
    }

    @Get()
    findAll(
        @GetTenantId() tenantId: number,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('status') status?: OrderStatus,
        @Query('search') search?: string,
    ) {
        return this.ordersService.findAll(
            tenantId,
            page ? +page : 1,
            limit ? +limit : 10,
            status,
            search,
        );
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number, @GetTenantId() tenantId: number) {
        return this.ordersService.findOne(id, tenantId);
    }

    @Patch(':id')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateOrderDto: UpdateOrderDto,
        @GetTenantId() tenantId: number,
    ) {
        return this.ordersService.update(id, updateOrderDto, tenantId);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number, @GetTenantId() tenantId: number) {
        return this.ordersService.remove(id, tenantId);
    }
}
