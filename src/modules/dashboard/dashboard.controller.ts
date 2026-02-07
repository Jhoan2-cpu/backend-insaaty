import {
    Controller,
    Get,
    Query,
    Request,
    ParseIntPipe,
    DefaultValuePipe,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { TransactionType } from '@prisma/client';

@Controller('dashboard')
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) { }

    @Get('summary')
    getSummary(@Request() req) {
        return this.dashboardService.getSummary(req.user.tenantId);
    }

    @Get('low-stock')
    getLowStock(
        @Request() req,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    ) {
        return this.dashboardService.getLowStockProducts(
            req.user.tenantId,
            page,
            Math.min(limit, 100),
        );
    }

    @Get('inventory-value')
    getInventoryValue(@Request() req) {
        return this.dashboardService.getInventoryValue(req.user.tenantId);
    }

    @Get('transactions-report')
    getTransactionsReport(
        @Request() req,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('type') type?: TransactionType,
    ) {
        return this.dashboardService.getTransactionsReport(
            req.user.tenantId,
            startDate ? new Date(startDate) : undefined,
            endDate ? new Date(endDate) : undefined,
            type,
        );
    }

    @Get('top-products')
    getTopProducts(
        @Request() req,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    ) {
        return this.dashboardService.getTopProducts(
            req.user.tenantId,
            Math.min(limit, 50),
        );
    }
}
