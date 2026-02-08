import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { OrderStatus } from '@prisma/client';

export interface SalesReportData {
    date: string;
    totalSales: number;
    orderCount: number;
    profit: number;
}

export interface TopProduct {
    productId: number;
    productName: string;
    sku: string;
    quantitySold: number;
    revenue: number;
}

export interface LowStockProduct {
    id: number;
    name: string;
    sku: string;
    current_stock: number;
    min_stock: number;
    difference: number;
}

export interface KPIs {
    totalSales: number;
    totalOrders: number;
    completedOrders: number;
    pendingOrders: number;
    totalProfit: number;
    productsCount: number;
    lowStockCount: number;
}

@Injectable()
export class ReportsService {
    constructor(private prisma: PrismaService) { }

    /**
     * Reporte de ventas por período
     */
    async getSalesReport(
        tenantId: number,
        startDate?: Date,
        endDate?: Date,
    ): Promise<SalesReportData[]> {
        const whereClause = {
            tenant_id: tenantId,
            status: { in: [OrderStatus.COMPLETED, OrderStatus.PROCESSING] },
            ...(startDate && endDate && {
                created_at: {
                    gte: startDate,
                    lte: endDate,
                },
            }),
        };

        // Obtener pedidos del período
        const orders = await this.prisma.order.findMany({
            where: whereClause,
            include: {
                order_items: {
                    include: {
                        product: true,
                    },
                },
            },
            orderBy: { created_at: 'asc' },
        });

        // Agrupar por día
        const salesByDay = new Map<string, SalesReportData>();

        for (const order of orders) {
            const date = order.created_at.toISOString().split('T')[0];

            if (!salesByDay.has(date)) {
                salesByDay.set(date, {
                    date,
                    totalSales: 0,
                    orderCount: 0,
                    profit: 0,
                });
            }

            const dayData = salesByDay.get(date)!;
            dayData.totalSales += Number(order.total);
            dayData.orderCount += 1;

            // Calcular ganancia (price_sale - price_cost) * quantity
            for (const item of order.order_items) {
                const profit = (Number(item.product.price_sale) - Number(item.product.price_cost)) * item.quantity;
                dayData.profit += profit;
            }
        }

        return Array.from(salesByDay.values());
    }

    /**
     * Top productos más vendidos
     */
    async getTopProducts(
        tenantId: number,
        limit: number = 10,
        startDate?: Date,
        endDate?: Date,
    ): Promise<TopProduct[]> {
        const whereClause = {
            order: {
                tenant_id: tenantId,
                status: { in: [OrderStatus.COMPLETED, OrderStatus.PROCESSING] },
                ...(startDate && endDate && {
                    created_at: {
                        gte: startDate,
                        lte: endDate,
                    },
                }),
            },
        };

        // Obtener order_items de pedidos completados
        const orderItems = await this.prisma.orderItem.findMany({
            where: whereClause,
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        sku: true,
                        price_sale: true,
                    },
                },
            },
        });

        // Agrupar por producto
        const productSales = new Map<number, TopProduct>();

        for (const item of orderItems) {
            const productId = item.product_id;

            if (!productSales.has(productId)) {
                productSales.set(productId, {
                    productId: item.product.id,
                    productName: item.product.name,
                    sku: item.product.sku,
                    quantitySold: 0,
                    revenue: 0,
                });
            }

            const productData = productSales.get(productId)!;
            productData.quantitySold += item.quantity;
            productData.revenue += Number(item.subtotal);
        }

        // Convertir a array y ordenar por cantidad vendida
        return Array.from(productSales.values())
            .sort((a, b) => b.quantitySold - a.quantitySold)
            .slice(0, limit);
    }

    /**
     * Productos con bajo stock (current_stock < min_stock)
     */
    async getLowStockProducts(tenantId: number): Promise<LowStockProduct[]> {
        const products = await this.prisma.product.findMany({
            where: {
                tenant_id: tenantId,
            },
            select: {
                id: true,
                name: true,
                sku: true,
                current_stock: true,
                min_stock: true,
            },
        });

        return products
            .filter((p) => p.current_stock < p.min_stock)
            .map((p) => ({
                id: p.id,
                name: p.name,
                sku: p.sku,
                current_stock: p.current_stock,
                min_stock: p.min_stock,
                difference: p.min_stock - p.current_stock,
            }))
            .sort((a, b) => b.difference - a.difference);
    }

    /**
     * KPIs generales del negocio
     */
    async getKPIs(
        tenantId: number,
        startDate?: Date,
        endDate?: Date,
    ): Promise<KPIs> {
        const whereClause = {
            tenant_id: tenantId,
            ...(startDate && endDate && {
                created_at: {
                    gte: startDate,
                    lte: endDate,
                },
            }),
        };

        // Total de pedidos por estado
        const [completedOrders, pendingOrders, allOrders] = await Promise.all([
            this.prisma.order.count({
                where: { ...whereClause, status: OrderStatus.COMPLETED },
            }),
            this.prisma.order.count({
                where: { ...whereClause, status: OrderStatus.PENDING },
            }),
            this.prisma.order.findMany({
                where: {
                    ...whereClause,
                    status: { in: [OrderStatus.COMPLETED, OrderStatus.PROCESSING] },
                },
                include: {
                    order_items: {
                        include: {
                            product: true,
                        },
                    },
                },
            }),
        ]);

        // Calcular ventas totales y ganancias
        let totalSales = 0;
        let totalProfit = 0;

        for (const order of allOrders) {
            totalSales += Number(order.total);

            for (const item of order.order_items) {
                const profit = (Number(item.product.price_sale) - Number(item.product.price_cost)) * item.quantity;
                totalProfit += profit;
            }
        }

        // Contar productos totales y con bajo stock
        const [productsCount, lowStockProducts] = await Promise.all([
            this.prisma.product.count({ where: { tenant_id: tenantId } }),
            this.getLowStockProducts(tenantId),
        ]);

        return {
            totalSales,
            totalOrders: allOrders.length,
            completedOrders,
            pendingOrders,
            totalProfit,
            productsCount,
            lowStockCount: lowStockProducts.length,
        };
    }
}
