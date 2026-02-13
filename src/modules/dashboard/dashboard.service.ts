import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { TransactionType } from '@prisma/client';

@Injectable()
export class DashboardService {
    constructor(private prisma: PrismaService) { }

    async getSummary(tenantId: number) {
        const [
            totalProducts,
            totalTransactions,
            lowStockProducts,
            inventoryValue,
            recentTransactions,
        ] = await Promise.all([
            // Total de productos
            this.prisma.product.count({ where: { tenant_id: tenantId } }),

            // Total de transacciones
            this.prisma.inventoryTransaction.count({ where: { tenant_id: tenantId } }),

            // Productos con bajo stock (raw query para comparar current_stock < min_stock)
            this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM products 
        WHERE tenant_id = ${tenantId} AND current_stock < min_stock
      `,

            // Valor del inventario
            this.prisma.product.aggregate({
                where: { tenant_id: tenantId },
                _sum: { current_stock: true },
            }),

            // Últimas 5 transacciones
            this.prisma.inventoryTransaction.findMany({
                where: { tenant_id: tenantId },
                orderBy: { created_at: 'desc' },
                take: 5,
                include: {
                    product: { select: { name: true, sku: true } },
                    user: { select: { full_name: true } },
                },
            }),
        ]);

        // Calcular valor total del inventario (costo y venta)
        const products = await this.prisma.product.findMany({
            where: { tenant_id: tenantId },
            select: { current_stock: true, price_cost: true, price_sale: true },
        });

        const totalValueCost = products.reduce(
            (sum, p) => sum + p.current_stock * Number(p.price_cost),
            0,
        );
        const totalValueSale = products.reduce(
            (sum, p) => sum + p.current_stock * Number(p.price_sale),
            0,
        );

        return {
            products: {
                total: totalProducts,
                lowStock: Number(lowStockProducts[0]?.count || 0),
            },
            transactions: {
                total: totalTransactions,
            },
            inventory: {
                totalUnits: inventoryValue._sum.current_stock || 0,
                valueCost: Math.round(totalValueCost * 100) / 100,
                valueSale: Math.round(totalValueSale * 100) / 100,
                potentialProfit: Math.round((totalValueSale - totalValueCost) * 100) / 100,
            },
            recentTransactions,
        };
    }

    async getLowStockProducts(tenantId: number, page: number = 1, limit: number = 10) {
        const skip = (page - 1) * limit;

        const products = await this.prisma.$queryRaw<any[]>`
      SELECT id, sku, name, current_stock, min_stock, 
             (min_stock - current_stock) as deficit
      FROM products 
      WHERE tenant_id = ${tenantId} AND current_stock < min_stock
      ORDER BY (min_stock - current_stock) DESC
      LIMIT ${limit} OFFSET ${skip}
    `;

        const countResult = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM products 
      WHERE tenant_id = ${tenantId} AND current_stock < min_stock
    `;

        const total = Number(countResult[0]?.count || 0);

        return {
            data: products,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
            alert: total > 0 ? `⚠️ ${total} producto(s) con stock bajo` : null,
        };
    }

    async getInventoryValue(tenantId: number) {
        const products = await this.prisma.product.findMany({
            where: { tenant_id: tenantId },
            select: {
                id: true,
                sku: true,
                name: true,
                current_stock: true,
                price_cost: true,
                price_sale: true,
            },
        });

        const breakdown = products.map((p) => ({
            ...p,
            valueCost: Math.round(p.current_stock * Number(p.price_cost) * 100) / 100,
            valueSale: Math.round(p.current_stock * Number(p.price_sale) * 100) / 100,
        }));

        const totals = breakdown.reduce(
            (acc, p) => ({
                totalUnits: acc.totalUnits + p.current_stock,
                totalCost: acc.totalCost + p.valueCost,
                totalSale: acc.totalSale + p.valueSale,
            }),
            { totalUnits: 0, totalCost: 0, totalSale: 0 },
        );

        return {
            breakdown,
            totals: {
                ...totals,
                potentialProfit: Math.round((totals.totalSale - totals.totalCost) * 100) / 100,
            },
        };
    }

    async getTransactionsReport(
        tenantId: number,
        startDate?: Date,
        endDate?: Date,
        type?: TransactionType,
    ) {
        const where: any = { tenant_id: tenantId };

        if (startDate || endDate) {
            where.created_at = {};
            if (startDate) where.created_at.gte = startDate;
            if (endDate) where.created_at.lte = endDate;
        }

        if (type) {
            where.type = type;
        }

        const transactions = await this.prisma.inventoryTransaction.findMany({
            where,
            orderBy: { created_at: 'desc' },
            include: {
                product: { select: { name: true, sku: true } },
                user: { select: { full_name: true } },
            },
        });

        // Agrupar por tipo
        const summary = {
            IN: { count: 0, totalQuantity: 0 },
            OUT: { count: 0, totalQuantity: 0 },
            ADJUSTMENT: { count: 0, totalQuantity: 0 },
        };

        transactions.forEach((t) => {
            summary[t.type].count++;
            summary[t.type].totalQuantity += t.quantity;
        });

        return {
            transactions,
            summary,
            totalTransactions: transactions.length,
        };
    }

    async getTopProducts(tenantId: number, limit: number = 10) {
        // Productos con más movimientos
        const topByMovements = await this.prisma.inventoryTransaction.groupBy({
            by: ['product_id'],
            where: { tenant_id: tenantId },
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: limit,
        });

        // Obtener detalles de los productos
        const productIds = topByMovements.map((t) => t.product_id);
        const products = await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, sku: true, name: true, current_stock: true },
        });

        const result = topByMovements.map((t) => {
            const product = products.find((p) => p.id === t.product_id);
            return {
                ...product,
                transactionCount: t._count.id,
            };
        });

        return result;
    }
}
