import {
    Controller,
    Get,
    Query,
    UseGuards,
    Request,
    ParseIntPipe,
    DefaultValuePipe,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) { }

    @Get('sales')
    async getSalesReport(
        @Request() req,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        const start = startDate ? new Date(startDate) : undefined;
        let end = endDate ? new Date(endDate) : undefined;
        if (end) {
            end.setHours(23, 59, 59, 999);
        }

        return this.reportsService.getSalesReport(req.user.tenantId, start, end);
    }

    @Get('top-products')
    async getTopProducts(
        @Request() req,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        const start = startDate ? new Date(startDate) : undefined;
        let end = endDate ? new Date(endDate) : undefined;
        if (end) {
            end.setHours(23, 59, 59, 999);
        }

        return this.reportsService.getTopProducts(req.user.tenantId, limit, start, end);
    }

    @Get('low-stock')
    async getLowStockProducts(@Request() req) {
        return this.reportsService.getLowStockProducts(req.user.tenantId);
    }

    @Get('kpis')
    async getKPIs(
        @Request() req,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        const start = startDate ? new Date(startDate) : undefined;
        let end = endDate ? new Date(endDate) : undefined;
        if (end) {
            end.setHours(23, 59, 59, 999);
        }

        return this.reportsService.getKPIs(req.user.tenantId, start, end);
    }
}
