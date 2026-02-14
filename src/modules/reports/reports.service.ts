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

    private async createPdf(docDefinition: TDocumentDefinitions, type: 'SALES' | 'INVENTORY' | 'MOVEMENTS', tenantId: number, userId: number): Promise<string> {
        return new Promise(async (resolve, reject) => {
            if (!this.printer) {
                const error = new Error('PDF Printer Service not initialized. Check server logs for initialization errors.');
                console.error(error);
                return reject(error);
            }
            try {
                // In version 0.3.x, createPdfKitDocument is async and returns a promise
                const pdfDoc = await this.printer.createPdfKitDocument(docDefinition);

                const fileName = `report-${type.toLowerCase()}-${Date.now()}.pdf`;
                const filePath = path.join(process.cwd(), 'uploads', 'reports', fileName);

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

                    if (!tenantId || !userId) {
                        console.error('Missing tenantId or userId for DB save:', { tenantId, userId });
                        // Proceed without saving to DB if critical IDs are missing, OR throw.
                        // Since schema requires them, we must throw or skip DB save.
                        // Let's skip DB save to at least return the PDF if possible, but logging the error.
                        console.warn('⚠️ Report not saved to DB due to missing IDs.');
                    } else {
                        // Save to DB
                        await this.prisma.report.create({
                            data: {
                                type: type,
                                url: url,
                                // Use explicit connect syntax for relations
                                tenant: {
                                    connect: { id: Number(tenantId) }
                                },
                                user: {
                                    connect: { id: Number(userId) }
                                }
                            }
                        });
                    }
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

        // If range is provided, use it. If not, default to "Today" for KPI cards
        if (startDate && endDate) {
            where.created_at = { gte: startDate, lte: endDate };
        } else {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            where.created_at = { gte: today, lt: tomorrow };
        }

        const [totalOrders, totalMovements] = await Promise.all([
            this.prisma.order.count({ where }),
            this.prisma.inventoryTransaction.count({ where })
        ]);

        const totalSalesAgg = await this.prisma.order.aggregate({
            where,
            _sum: { total: true }
        });
        const totalSales = Number(totalSalesAgg._sum.total || 0);

        // Calculate Average Order Value
        const aov = totalOrders > 0 ? totalSales / totalOrders : 0;

        // Combine for "Volume" or "Transactions Today"
        const dailyVolume = totalOrders + totalMovements;

        // Count Total Products (this is overall, not filtered by date)
        const productsCount = await this.prisma.product.count({
            where: { tenant_id: tenantId }
        });

        // Count Low Stock Products (overall)
        const lowStockCount = await this.prisma.product.count({
            where: {
                tenant_id: tenantId,
                current_stock: { lte: this.prisma.product.fields.min_stock }
            }
        });

        // Total Customers (overall)
        const totalCustomers = await this.prisma.user.count({
            where: { tenant_id: tenantId }
        });

        // Calculate Total Profit for KPIs if needed
        let totalProfit = 0;
        const ordersWithItems = await this.prisma.order.findMany({
            where,
            include: {
                order_items: {
                    include: { product: { select: { price_cost: true } } }
                }
            }
        });

        ordersWithItems.forEach(order => {
            let orderCost = 0;
            order.order_items.forEach(item => {
                orderCost += (Number(item.product?.price_cost || 0) * item.quantity);
            });
            totalProfit += (Number(order.total) - orderCost);
        });

        return {
            totalSales,
            totalOrders: dailyVolume, // Showing total transactions volume
            averageOrderValue: aov,
            lowStockCount,
            totalCustomers,
            productsCount,
            totalProfit
        };
    }

    async getSalesReport(tenantId: number, startDate?: Date, endDate?: Date) {
        const where: any = { tenant_id: tenantId };
        if (startDate && endDate) {
            where.created_at = { gte: startDate, lte: endDate };
        }

        // Fetch Orders and InventoryTransactions in parallel
        const [orders, movements] = await Promise.all([
            this.prisma.order.findMany({
                where,
                select: {
                    created_at: true,
                    total: true,
                    order_items: {
                        select: {
                            quantity: true,
                            unit_price: true,
                            product: { select: { price_cost: true } }
                        }
                    }
                },
                orderBy: { created_at: 'asc' }
            }),
            this.prisma.inventoryTransaction.findMany({
                where,
                select: { created_at: true, type: true },
                orderBy: { created_at: 'asc' }
            })
        ]);

        const combinedByDay = new Map<string, {
            date: string,
            orderCount: number,
            transactionCount: number,
            totalVolume: number,
            totalSales: number,
            profit: number
        }>();

        // Process Orders
        orders.forEach(order => {
            const dateKey = order.created_at.toISOString().split('T')[0];
            if (!combinedByDay.has(dateKey)) {
                combinedByDay.set(dateKey, { date: dateKey, orderCount: 0, transactionCount: 0, totalVolume: 0, totalSales: 0, profit: 0 });
            }
            const entry = combinedByDay.get(dateKey)!;
            entry.orderCount++;
            entry.totalSales += Number(order.total);
            entry.totalVolume++;

            // Calculate profit for this order
            let orderCost = 0;
            order.order_items.forEach(item => {
                orderCost += (Number(item.product?.price_cost || 0) * item.quantity);
            });
            entry.profit += (Number(order.total) - orderCost);
        });

        // Process Inventory Transactions
        movements.forEach(move => {
            const dateKey = move.created_at.toISOString().split('T')[0];
            if (!combinedByDay.has(dateKey)) {
                combinedByDay.set(dateKey, { date: dateKey, orderCount: 0, transactionCount: 0, totalVolume: 0, totalSales: 0, profit: 0 });
            }
            const entry = combinedByDay.get(dateKey)!;
            entry.transactionCount++;
            entry.totalVolume++;
        });

        return Array.from(combinedByDay.values());
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

    async generateSalesReport(tenantId: number, userId: number, salesData: any[], movementsData: any[], dateRange: string) {

        // --- 1. Calculate KPIs ---
        const totalSales = salesData.reduce((acc, curr) => acc + curr.totalSales, 0);
        const totalProfit = salesData.reduce((acc, curr) => acc + curr.profit, 0);

        // Filter 'IN' movements and positive 'ADJUSTMENT' (Restocks/Purchases)
        const investmentMovements = (movementsData || []).filter(m => m.type === 'IN' || (m.type === 'ADJUSTMENT' && m.quantity > 0));
        const totalInvestment = investmentMovements.reduce((acc, curr) => {
            // Assuming cost is available in product.price_cost
            const cost = curr.product?.price_cost ? Number(curr.product.price_cost) : 0;
            return acc + (cost * curr.quantity);
        }, 0);

        const netBalance = totalSales - totalInvestment;

        // --- 2. Build PDF Content ---
        const content: any[] = [];

        // Executive Summary Section
        content.push({ text: 'Resumen Ejecutivo', style: 'sectionHeader', margin: [0, 10, 0, 10] });
        content.push({
            table: {
                widths: ['*', '*', '*'],
                body: [
                    [
                        { text: 'Ventas Totales', style: 'kpiLabel', alignment: 'center' },
                        { text: 'Inversión en Stock', style: 'kpiLabel', alignment: 'center' },
                        { text: 'Balance Neto', style: 'kpiLabel', alignment: 'center' }
                    ],
                    [
                        { text: `$${totalSales.toFixed(2)}`, style: 'kpiValue', color: '#10b981', alignment: 'center' },
                        { text: `$${totalInvestment.toFixed(2)}`, style: 'kpiValue', color: '#f59e0b', alignment: 'center' }, // Orange for investment
                        { text: `$${netBalance.toFixed(2)}`, style: 'kpiValue', color: netBalance >= 0 ? '#10b981' : '#ef4444', alignment: 'center', bold: true }
                    ]
                ]
            },
            layout: 'noBorders',
            margin: [0, 0, 0, 20]
        });

        // Sales Breakdown Section
        content.push({ text: 'Detalle de Ventas', style: 'sectionHeader', margin: [0, 10, 0, 5] });
        const salesTableBody = [
            [
                { text: 'Fecha', style: 'tableHeader' },
                { text: 'Pedidos', style: 'tableHeader', alignment: 'center' },
                { text: 'Monto', style: 'tableHeader', alignment: 'right' },
                { text: 'Margen Est.', style: 'tableHeader', alignment: 'right' }
            ],
            ...salesData.map(item => [
                { text: new Date(item.date).toLocaleDateString(), style: 'tableCell' },
                { text: item.orderCount, style: 'tableCell', alignment: 'center' },
                { text: `$${item.totalSales.toFixed(2)}`, style: 'tableCell', alignment: 'right' },
                { text: `$${item.profit.toFixed(2)}`, style: 'tableCell', alignment: 'right', color: item.profit >= 0 ? '#10b981' : '#ef4444' }
            ])
        ];
        content.push({
            table: {
                headerRows: 1,
                widths: ['*', 'auto', 'auto', 'auto'],
                body: salesTableBody
            },
            layout: 'lightHorizontalLines',
            margin: [0, 0, 0, 20]
        });

        // Inventory Investments Section
        if (investmentMovements.length > 0) {
            content.push({ text: 'Inversión en Inventario (Entradas)', style: 'sectionHeader', margin: [0, 10, 0, 5] });
            const investmentTableBody = [
                [
                    { text: 'Fecha', style: 'tableHeader' },
                    { text: 'Producto', style: 'tableHeader' },
                    { text: 'Cant.', style: 'tableHeader', alignment: 'center' },
                    { text: 'Costo Unit.', style: 'tableHeader', alignment: 'right' },
                    { text: 'Total', style: 'tableHeader', alignment: 'right' }
                ],
                ...investmentMovements.map(item => {
                    const cost = item.product?.price_cost ? Number(item.product.price_cost) : 0;
                    const total = cost * item.quantity;
                    return [
                        { text: new Date(item.created_at).toLocaleDateString(), style: 'tableCell' },
                        { text: item.product?.name || 'Unknown', style: 'tableCell' },
                        { text: item.quantity, style: 'tableCell', alignment: 'center' },
                        { text: `$${cost.toFixed(2)}`, style: 'tableCell', alignment: 'right' },
                        { text: `$${total.toFixed(2)}`, style: 'tableCell', alignment: 'right' }
                    ];
                })
            ];
            content.push({
                table: {
                    headerRows: 1,
                    widths: ['*', '*', 'auto', 'auto', 'auto'],
                    body: investmentTableBody
                },
                layout: 'lightHorizontalLines'
            });
        } else {
            content.push({ text: 'No hubo movimientos de entrada de inventario en este periodo.', style: 'tableCell', italics: true, color: '#6b7280', margin: [0, 0, 0, 20] });
        }


        // Override common doc definition specifically for this report to handle multiple tables
        const docDefinition = this.getCommonDocDefinition('Reporte de Desempeño Comercial', dateRange, [], '*');
        // Replace the default table content with our custom content stack
        // The common function puts a table at index 3 (Header, Line, Spacer, Table)
        // We will replace elements starting from index 3 with our content
        if (Array.isArray(docDefinition.content)) {
            docDefinition.content.splice(3, 1, ...content);
        }

        // Add new styles
        if (!docDefinition.styles) docDefinition.styles = {};
        docDefinition.styles.sectionHeader = { fontSize: 14, bold: true, color: '#111827', margin: [0, 15, 0, 5] };
        docDefinition.styles.kpiLabel = { fontSize: 10, color: '#6b7280', bold: true };
        docDefinition.styles.kpiValue = { fontSize: 16, bold: true, margin: [0, 5, 0, 0] };

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

    async getReportHistory(tenantId: number, page: number, limit: number, search?: string, type?: string) {
        const where: any = { tenant_id: tenantId };

        if (search) {
            where.OR = [
                { id: !isNaN(Number(search)) ? Number(search) : undefined },
                // { type: { contains: search, mode: 'insensitive' } }, // Enum filtering is strict, handle separately if needed
                { user: { full_name: { contains: search, mode: 'insensitive' } } }
            ];
            // Remove undefined id filter if search is not a number
            where.OR = where.OR.filter(condition => condition.id !== undefined || condition.user);
            if (where.OR.length === 0) delete where.OR;
        }

        if (type && type !== 'ALL') {
            // Validate if type exists in enum if strictly required, or let Prisma handle it (might throw if invalid enum)
            where.type = type;
        }

        const [data, total] = await Promise.all([
            this.prisma.report.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { created_at: 'desc' },
                include: { user: { select: { full_name: true } } }
            }),
            this.prisma.report.count({ where })
        ]);

        return {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        };
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
                        widths: widths === '*' ? (tableBody.length > 0 ? Array(tableBody[0].length).fill('*') : ['*']) : widths,
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
