import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PdfPrinter = require('pdfmake');

@Injectable()
export class ReportsService {
    private printer: any;

    constructor(private prisma: PrismaService) {
        // Use require.resolve to find the fonts relative to the pdfmake package
        const fonts = {
            Roboto: {
                normal: path.join(__dirname, '../../../../node_modules/pdfmake/fonts/Roboto/Roboto-Regular.ttf'),
                bold: path.join(__dirname, '../../../../node_modules/pdfmake/fonts/Roboto/Roboto-Medium.ttf'),
                italics: path.join(__dirname, '../../../../node_modules/pdfmake/fonts/Roboto/Roboto-Italic.ttf'),
                bolditalics: path.join(__dirname, '../../../../node_modules/pdfmake/fonts/Roboto/Roboto-MediumItalic.ttf')
            }
        };

        // Fallback to absolute path check if relative path via __dirname fails
        if (!fs.existsSync(fonts.Roboto.normal)) {
            console.log('Fonts not found at relative path, trying process.cwd()');
            fonts.Roboto = {
                normal: path.join(process.cwd(), 'node_modules/pdfmake/fonts/Roboto/Roboto-Regular.ttf'),
                bold: path.join(process.cwd(), 'node_modules/pdfmake/fonts/Roboto/Roboto-Medium.ttf'),
                italics: path.join(process.cwd(), 'node_modules/pdfmake/fonts/Roboto/Roboto-Italic.ttf'),
                bolditalics: path.join(process.cwd(), 'node_modules/pdfmake/fonts/Roboto/Roboto-MediumItalic.ttf')
            };
        }

        console.log('PDF Fonts paths:', fonts);

        try {
            // Correct import for pdfmake 0.3.x which uses ES modules transpiled to CommonJS
            // The file js/Printer.js exports "default" as the class
            const PrinterModule = require('pdfmake/js/Printer');
            const Printer = PrinterModule.default || PrinterModule;
            this.printer = new Printer(fonts);
            console.log('✅ PdfPrinter initialized successfully (js/Printer).');
        } catch (error) {
            console.error('⚠️ Error initializing PdfPrinter with js/Printer:', error);
            try {
                // Fallback: try the default 'pdfmake' export (though analysis showed it might be an instance)
                // Sometimes standard require('pdfmake') works in different environments
                const Printer = require('pdfmake');
                // If it's a constructor
                if (typeof Printer === 'function') {
                    this.printer = new Printer(fonts);
                    console.log('✅ PdfPrinter initialized successfully (default pdfmake function).');
                } else if (Printer.default) {
                    this.printer = new Printer.default(fonts);
                    console.log('✅ PdfPrinter initialized successfully (default pdfmake.default).');
                } else {
                    // It might be an instance (js/index.js exports new pdfmake())
                    // If so, we can't use it as a Printer class.
                    console.error('❌ CRITICAL: require("pdfmake") is not a constructor. It is type: ' + typeof Printer);
                }
            } catch (fallbackError) {
                console.error('❌ CRITICAL: Failed to initialize PdfPrinter via fallback:', fallbackError);
            }
        }
    }

    private createPdf(docDefinition: TDocumentDefinitions, type: 'SALES' | 'INVENTORY' | 'MOVEMENTS', tenantId: number, userId: number): Promise<string> {
        return new Promise((resolve, reject) => {
            if (!this.printer) {
                const error = new Error('PDF Printer Service not initialized. Check server logs for initialization errors.');
                console.error(error);
                return reject(error);
            }
            try {
                const pdfDoc = this.printer.createPdfKitDocument(docDefinition);
                const fileName = `report-${type.toLowerCase()}-${Date.now()}.pdf`;
                const filePath = path.join(__dirname, '../../..', 'uploads/reports', fileName);

                // Ensure directory exists
                const dir = path.dirname(filePath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }

                const writeStream = fs.createWriteStream(filePath);
                pdfDoc.pipe(writeStream);
                pdfDoc.end();

                writeStream.on('finish', async () => {
                    const url = `/uploads/reports/${fileName}`;

                    // Save to DB
                    await this.prisma.report.create({
                        data: {
                            tenant_id: tenantId,
                            user_id: userId,
                            type: type,
                            url: url
                        }
                    });

                    resolve(url);
                });

                writeStream.on('error', (err) => {
                    console.error('Error writing PDF file:', err);
                    reject(err);
                });
            } catch (err) {
                console.error('Error creating PDF document:', err);
                reject(err);
            }
        });
    }

    async getKPIs(tenantId: number, startDate?: Date, endDate?: Date) {
        const where: any = { tenant_id: tenantId };
        if (startDate && endDate) {
            where.created_at = { gte: startDate, lte: endDate };
        }

        const totalOrders = await this.prisma.order.count({ where });
        const totalSalesAgg = await this.prisma.order.aggregate({
            where,
            _sum: { total: true }
        });
        const totalSales = Number(totalSalesAgg._sum.total || 0);

        // Calculate Average Order Value
        const aov = totalOrders > 0 ? totalSales / totalOrders : 0;

        // Count Low Stock Products
        const lowStockCount = await this.prisma.product.count({
            where: {
                tenant_id: tenantId,
                current_stock: { lte: this.prisma.product.fields.min_stock }
            }
        });

        // New Clients (unique users who placed orders in period - approximation)
        // Ideally we check user creation date, but let's stick to orders for now or just generic user count
        const totalCustomers = await this.prisma.user.count({
            where: { tenant_id: tenantId, role: { name: 'CLIENTE' } } // Assuming CLIENTE role exists, or just users
        });

        return {
            totalSales,
            totalOrders,
            averageOrderValue: aov,
            lowStockCount,
            totalCustomers // Total registered customers
        };
    }

    async getSalesReport(tenantId: number, startDate?: Date, endDate?: Date) {
        const where: any = { tenant_id: tenantId };
        if (startDate && endDate) {
            where.created_at = { gte: startDate, lte: endDate };
        }

        const orders = await this.prisma.order.findMany({
            where,
            select: {
                created_at: true,
                total: true,
                order_items: {
                    select: {
                        unit_price: true,
                        quantity: true,
                        product: { select: { price_cost: true } }
                    }
                }
            },
            orderBy: { created_at: 'asc' }
        });

        // Group by day
        const salesByDay = new Map<string, { date: Date, orderCount: number, totalSales: number, profit: number }>();

        orders.forEach(order => {
            const dateKey = order.created_at.toISOString().split('T')[0];
            if (!salesByDay.has(dateKey)) {
                salesByDay.set(dateKey, { date: order.created_at, orderCount: 0, totalSales: 0, profit: 0 });
            }
            const entry = salesByDay.get(dateKey)!;
            entry.orderCount++;
            entry.totalSales += Number(order.total);

            // Calculate profit (Sale - Cost)
            let orderCost = 0;
            order.order_items.forEach(item => {
                orderCost += Number(item.product.price_cost) * item.quantity;
            });
            entry.profit += Number(order.total) - orderCost;
        });

        return Array.from(salesByDay.values());
    }

    async getTopProducts(tenantId: number, limit: number, startDate?: Date, endDate?: Date) {
        const where: any = { order: { tenant_id: tenantId } };
        if (startDate && endDate) {
            where.order = { ...where.order, created_at: { gte: startDate, lte: endDate } };
        }

        const topProducts = await this.prisma.orderItem.groupBy({
            by: ['product_id'],
            where,
            _sum: {
                quantity: true,
                subtotal: true
            },
            orderBy: {
                _sum: { subtotal: 'desc' }
            },
            take: limit
        });

        // Fetch product details
        const enrichedProducts = await Promise.all(topProducts.map(async (item) => {
            const product = await this.prisma.product.findUnique({
                where: { id: item.product_id }
            });
            return {
                productName: product?.name || 'Unknown',
                sku: product?.sku || 'N/A',
                quantitySold: item._sum.quantity || 0,
                revenue: Number(item._sum.subtotal || 0)
            };
        }));

        return enrichedProducts;
    }

    async getLowStockProducts(tenantId: number) {
        return this.prisma.product.findMany({
            where: {
                tenant_id: tenantId,
                current_stock: { lte: this.prisma.product.fields.min_stock }
            },
            select: {
                name: true,
                sku: true,
                current_stock: true,
                min_stock: true,
                price_sale: true
            },
            take: 10 // Limit to top 10 low stock
        });
    }

    async getMovements(tenantId: number, startDate?: Date, endDate?: Date) {
        const where: any = { tenant_id: tenantId };
        if (startDate && endDate) {
            where.created_at = { gte: startDate, lte: endDate };
        }

        return this.prisma.inventoryTransaction.findMany({
            where,
            include: {
                product: true,
                user: true
            },
            orderBy: { created_at: 'desc' }
        });
    }

    async generateSalesReport(tenantId: number, userId: number, data: any[], dateRange: string) {
        const tableBody: any[] = [
            [
                { text: 'Fecha', style: 'tableHeader' },
                { text: 'Pedidos', style: 'tableHeader', alignment: 'center' },
                { text: 'Ventas', style: 'tableHeader', alignment: 'right' },
                { text: 'Ganancia', style: 'tableHeader', alignment: 'right' }
            ],
            ...data.map(item => [
                { text: new Date(item.date).toLocaleDateString(), style: 'tableCell' },
                { text: item.orderCount, style: 'tableCell', alignment: 'center' },
                { text: `$${item.totalSales.toFixed(2)}`, style: 'tableCell', alignment: 'right' },
                { text: `$${item.profit.toFixed(2)}`, style: 'tableCell', alignment: 'right', color: item.profit >= 0 ? '#10b981' : '#ef4444' }
            ])
        ];

        // Calcular totales
        const totalSales = data.reduce((acc, curr) => acc + curr.totalSales, 0);
        const totalProfit = data.reduce((acc, curr) => acc + curr.profit, 0);

        tableBody.push([
            { text: 'TOTALES', style: 'tableHeader', colSpan: 2, alignment: 'right' },
            {},
            { text: `$${totalSales.toFixed(2)}`, style: 'tableHeader', alignment: 'right' },
            { text: `$${totalProfit.toFixed(2)}`, style: 'tableHeader', alignment: 'right' }
        ]);

        const docDefinition = this.getCommonDocDefinition('Reporte de Ventas', dateRange, tableBody);
        return this.createPdf(docDefinition, 'SALES', tenantId, userId);
    }

    async generateTopProductsReport(tenantId: number, userId: number, data: any[], dateRange: string) {
        const tableBody = [
            [
                { text: '#', style: 'tableHeader' },
                { text: 'Producto', style: 'tableHeader' },
                { text: 'SKU', style: 'tableHeader' },
                { text: 'Cant. Vendida', style: 'tableHeader', alignment: 'center' },
                { text: 'Ingresos', style: 'tableHeader', alignment: 'right' }
            ],
            ...data.map((item, index) => [
                { text: index + 1, style: 'tableCell' },
                { text: item.productName, style: 'tableCell', bold: true },
                { text: item.sku, style: 'tableCell', color: '#6b7280' },
                { text: item.quantitySold, style: 'tableCell', alignment: 'center' },
                { text: `$${item.revenue.toFixed(2)}`, style: 'tableCell', alignment: 'right' }
            ])
        ];

        const docDefinition = this.getCommonDocDefinition('Productos Más Vendidos', dateRange, tableBody, [15, '*', 'auto', 'auto', 'auto']);
        return this.createPdf(docDefinition, 'INVENTORY', tenantId, userId);
    }

    async generateMovementsReport(tenantId: number, userId: number, data: any[], dateRange: string) {
        const tableBody = [
            [
                { text: 'Fecha', style: 'tableHeader' },
                { text: 'Producto', style: 'tableHeader' },
                { text: 'Tipo', style: 'tableHeader', alignment: 'center' },
                { text: 'Cant.', style: 'tableHeader', alignment: 'right' },
                { text: 'Usuario', style: 'tableHeader' }
            ],
            ...data.map(item => [
                { text: new Date(item.created_at).toLocaleDateString() + ' ' + new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), style: 'tableCell', fontSize: 9 },
                { text: item.product?.name || '-', style: 'tableCell' },
                {
                    text: item.type,
                    style: 'tableCell',
                    alignment: 'center',
                    color: item.type === 'IN' ? '#10b981' : (item.type === 'OUT' ? '#ef4444' : '#3b82f6'),
                    bold: true
                },
                { text: item.quantity, style: 'tableCell', alignment: 'right', bold: true },
                { text: item.user?.full_name || '-', style: 'tableCell', color: '#4b5563' }
            ])
        ];

        const docDefinition = this.getCommonDocDefinition('Reporte de Movimientos', dateRange, tableBody, ['auto', '*', 'auto', 'auto', 'auto']);
        return this.createPdf(docDefinition, 'MOVEMENTS', tenantId, userId);
    }

    async getReportHistory(tenantId: number) {
        return this.prisma.report.findMany({
            where: { tenant_id: tenantId },
            orderBy: { created_at: 'desc' },
            include: { user: { select: { full_name: true } } }
        });
    }

    private getCommonDocDefinition(title: string, dateRange: string, tableBody: any[], widths: any = '*'): TDocumentDefinitions {
        return {
            content: [
                // Header
                {
                    columns: [
                        {
                            stack: [
                                { text: 'INSAATY', style: 'brand' },
                                { text: 'Inventory Management', style: 'brandSub' }
                            ]
                        },
                        {
                            stack: [
                                { text: title, style: 'header', alignment: 'right' },
                                { text: dateRange, style: 'subheader', alignment: 'right' }
                            ]
                        }
                    ],
                    margin: [0, 0, 0, 20]
                },
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: '#10b981' }] },
                { text: '', margin: [0, 0, 0, 20] }, // Spacer

                // Table
                {
                    table: {
                        headerRows: 1,
                        widths: widths === '*' ? Array(tableBody[0].length).fill('*') : widths,
                        body: tableBody
                    },
                    layout: {
                        fillColor: (rowIndex) => {
                            return (rowIndex % 2 === 0) ? '#f9fafb' : null;
                        },
                        hLineWidth: (i, node) => {
                            return (i === 0 || i === node.table.body.length) ? 0 : 1;
                        },
                        vLineWidth: () => 0,
                        hLineColor: () => '#e5e7eb',
                        paddingLeft: () => 8,
                        paddingRight: () => 8,
                        paddingTop: () => 8,
                        paddingBottom: () => 8
                    }
                }
            ],
            footer: (currentPage, pageCount) => {
                return {
                    columns: [
                        { text: `Generado el ${new Date().toLocaleDateString()}`, style: 'footer', alignment: 'left', margin: [40, 0] },
                        { text: `Página ${currentPage} de ${pageCount}`, style: 'footer', alignment: 'right', margin: [0, 0, 40, 0] }
                    ]
                };
            },
            styles: {
                brand: { fontSize: 24, bold: true, color: '#10b981' },
                brandSub: { fontSize: 10, color: '#6b7280', margin: [0, -3, 0, 0] },
                header: { fontSize: 18, bold: true, color: '#111827' },
                subheader: { fontSize: 10, color: '#6b7280' },
                tableHeader: { fontSize: 10, bold: true, color: '#374151', fillColor: '#e0e7ff' }, // Fallback fill if layout doesn't override first row
                tableCell: { fontSize: 10, color: '#4b5563' },
                footer: { fontSize: 8, color: '#9ca3af' }
            },
            defaultStyle: {
                font: 'Roboto',
                columnGap: 20
            }
        };
    }


}
