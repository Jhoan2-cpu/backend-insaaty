import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import PdfPrinter from 'pdfmake';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ReportsService {
    private printer: PdfPrinter;

    constructor(private prisma: PrismaService) {
        const fonts = {
            Roboto: {
                normal: 'node_modules/pdfmake/build/vfs_fonts.js', // We will use standard fonts for simplicity or configure correctly
                bold: 'node_modules/pdfmake/build/vfs_fonts.js',
                italics: 'node_modules/pdfmake/build/vfs_fonts.js',
                bolditalics: 'node_modules/pdfmake/build/vfs_fonts.js'
            }
        };
        // For standard fonts, we might not need to define this if using standard 14 fonts, but pdfmake requires it.
        // Actually, let's use the standard fonts from pdfmake/src/browser-extensions/virtual-fs.js style if possible,
        // or just use Helvetica which doesn't require font files.
        // Wait, server-side pdfmake requires font files.

        const fontDescriptors = {
            Roboto: {
                normal: path.join(__dirname, '../../..', 'node_modules/roboto-font/fonts/Roboto/roboto-regular-webfont.ttf'),
                bold: path.join(__dirname, '../../..', 'node_modules/roboto-font/fonts/Roboto/roboto-bold-webfont.ttf'),
                italics: path.join(__dirname, '../../..', 'node_modules/roboto-font/fonts/Roboto/roboto-italic-webfont.ttf'),
                bolditalics: path.join(__dirname, '../../..', 'node_modules/roboto-font/fonts/Roboto/roboto-bolditalic-webfont.ttf')
            }
        };
        // Simplification: We will use a default Courier/Helvetica approach if possible or simple font.
        // Actually, easiest way is to install roboto-font or point to the ones in node_modules/pdfmake if they exist.
        // Let's assume for now we use the ones that come with pdfmake or we'll simple install them.

        // BETTER APPROACH: Use standard fonts definition
        this.printer = new PdfPrinter({
            Roboto: {
                normal: 'Helvetica',
                bold: 'Helvetica-Bold',
                italics: 'Helvetica-Oblique',
                bolditalics: 'Helvetica-BoldOblique'
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

    async generateSalesReport(tenantId: number, userId: number, data: any[], dateRange: string) {
        const docDefinition: TDocumentDefinitions = {
            content: [
                { text: 'INSAATY', style: 'header' },
                { text: 'Reporte de Ventas', style: 'subheader' },
                { text: dateRange, style: 'subheader' },
                {
                    table: {
                        headerRows: 1,
                        widths: ['*', 'auto', 'auto', 'auto'],
                        body: [
                            ['Fecha', 'Pedidos', 'Ventas', 'Ganancia'],
                            ...data.map(item => [
                                new Date(item.date).toLocaleDateString(),
                                item.orderCount,
                                `$${item.totalSales}`,
                                `$${item.profit}`
                            ])
                        ]
                    }
                }
            ],
            styles: {
                header: { fontSize: 22, bold: true, color: '#10b981', margin: [0, 0, 0, 10] },
                subheader: { fontSize: 14, margin: [0, 0, 0, 5] }
            },
            defaultStyle: {
                font: 'Roboto'
            }
        };

        return this.createPdf(docDefinition, 'SALES', tenantId, userId);
    }

    async generateTopProductsReport(tenantId: number, userId: number, data: any[], dateRange: string) {
        const docDefinition: TDocumentDefinitions = {
            content: [
                { text: 'INSAATY', style: 'header' },
                { text: 'Productos Más Vendidos', style: 'subheader' },
                { text: dateRange, style: 'subheader' },
                {
                    table: {
                        headerRows: 1,
                        widths: ['auto', '*', 'auto', 'auto', 'auto'],
                        body: [
                            ['#', 'Producto', 'SKU', 'Cant.', 'Ingresos'],
                            ...data.map((item, index) => [
                                index + 1,
                                item.productName,
                                item.sku,
                                item.quantitySold,
                                `$${item.revenue}`
                            ])
                        ]
                    }
                }
            ],
            styles: {
                header: { fontSize: 22, bold: true, color: '#10b981', margin: [0, 0, 0, 10] },
                subheader: { fontSize: 14, margin: [0, 0, 0, 5] }
            },
            defaultStyle: { font: 'Roboto' }
        };
        return this.createPdf(docDefinition, 'INVENTORY', tenantId, userId);
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

    async generateMovementsReport(tenantId: number, userId: number, data: any[], dateRange: string) {
        const docDefinition: TDocumentDefinitions = {
            content: [
                { text: 'INSAATY', style: 'header' },
                { text: 'Reporte de Movimientos', style: 'subheader' },
                { text: dateRange, style: 'subheader' },
                {
                    table: {
                        headerRows: 1,
                        widths: ['auto', '*', 'auto', 'auto', 'auto'],
                        body: [
                            ['Fecha', 'Producto', 'Tipo', 'Cant.', 'Usuario'],
                            ...data.map(item => [
                                new Date(item.created_at).toLocaleDateString(),
                                item.product?.name || '-',
                                item.type,
                                item.quantity,
                                item.user?.full_name || '-'
                            ])
                        ]
                    }
                }
            ],
            styles: {
                header: { fontSize: 22, bold: true, color: '#10b981', margin: [0, 0, 0, 10] },
                subheader: { fontSize: 14, margin: [0, 0, 0, 5] }
            },
            defaultStyle: { font: 'Roboto' }
        };
        return this.createPdf(docDefinition, 'MOVEMENTS', tenantId, userId);
    }

    private createPdf(docDefinition: TDocumentDefinitions, type: 'SALES' | 'INVENTORY' | 'MOVEMENTS', tenantId: number, userId: number): Promise<string> {
        return new Promise((resolve, reject) => {
            const pdfDoc = this.printer.createPdfKitDocument(docDefinition);
            const fileName = `report-${type}-${Date.now()}-${uuidv4()}.pdf`;
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
                reject(err);
            });
        });
    }
}
