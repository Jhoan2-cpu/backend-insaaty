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

    @Get('generate/sales')
    async generateSalesReport(
        @Request() req,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        const start = startDate ? new Date(startDate) : undefined;
        let end = endDate ? new Date(endDate) : undefined;
        if (end) {
            end.setHours(23, 59, 59, 999);
        }

        const salesData = await this.reportsService.getSalesReport(req.user.tenantId, start, end);
        const movementsData = await this.reportsService.getMovements(req.user.tenantId, start, end);

        const dateRange = `${start?.toLocaleDateString() || 'Inicio'} - ${end?.toLocaleDateString() || 'Fin'}`;
        const url = await this.reportsService.generateSalesReport(req.user.tenantId, req.user.id, salesData, movementsData, dateRange);
        return { url };
    }

    @Get('generate/top-products')
    async generateTopProductsReport(
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

        const data = await this.reportsService.getTopProducts(req.user.tenantId, limit, start, end);
        const dateRange = `${start?.toLocaleDateString() || 'Inicio'} - ${end?.toLocaleDateString() || 'Fin'}`;
        const url = await this.reportsService.generateTopProductsReport(req.user.tenantId, req.user.id, data, dateRange);
        return { url };
    }

    @Get('generate/movements')
    async generateMovementsReport(
        @Request() req,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        const start = startDate ? new Date(startDate) : undefined;
        let end = endDate ? new Date(endDate) : undefined;
        if (end) {
            end.setHours(23, 59, 59, 999);
        }

        const data = await this.reportsService.getMovements(req.user.tenantId, start, end);
        const dateRange = `${start?.toLocaleDateString() || 'Inicio'} - ${end?.toLocaleDateString() || 'Fin'}`;
        const url = await this.reportsService.generateMovementsReport(req.user.tenantId, req.user.id, data, dateRange);
        return { url };
    }
    @Get('history')
    async getReportHistory(@Request() req) {
        return this.reportsService.getReportHistory(req.user.tenantId);
    }
}
