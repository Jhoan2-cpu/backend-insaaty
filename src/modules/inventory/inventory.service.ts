import {
    Injectable,
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { PrismaService } from 'src/prisma.service';
import { TransactionType } from '@prisma/client';

@Injectable()
export class InventoryService {
    constructor(private prisma: PrismaService) { }

    async createTransaction(
        tenantId: number,
        userId: number,
        createTransactionDto: CreateTransactionDto,
    ) {
        const { product_id, type, quantity, reason } = createTransactionDto;

        // Verificar que el producto existe y pertenece al tenant
        const product = await this.prisma.product.findFirst({
            where: { id: product_id, tenant_id: tenantId },
        });

        if (!product) {
            throw new NotFoundException('Producto no encontrado');
        }

        // Calcular nuevo stock según el tipo de transacción
        let newStock: number;

        switch (type) {
            case TransactionType.IN:
                newStock = product.current_stock + quantity;
                break;
            case TransactionType.OUT:
                newStock = product.current_stock - quantity;
                if (newStock < 0) {
                    throw new BadRequestException(
                        `Stock insuficiente. Stock actual: ${product.current_stock}, cantidad solicitada: ${quantity}`,
                    );
                }
                break;
            case TransactionType.ADJUSTMENT:
                // En ajuste, quantity es el nuevo valor absoluto del stock
                newStock = quantity;
                break;
            default:
                throw new BadRequestException('Tipo de transacción no válido');
        }

        // Usar transacción de Prisma para garantizar atomicidad
        const result = await this.prisma.$transaction(async (tx) => {
            // Crear la transacción de inventario
            const transaction = await tx.inventoryTransaction.create({
                data: {
                    tenant_id: tenantId,
                    product_id,
                    user_id: userId,
                    type,
                    quantity,
                    reason: reason || this.getDefaultReason(type),
                },
            });

            // Actualizar el stock del producto
            const updatedProduct = await tx.product.update({
                where: { id: product_id },
                data: { current_stock: newStock },
            });

            return {
                transaction,
                product: updatedProduct,
                previousStock: product.current_stock,
                newStock,
            };
        });

        return result;
    }

    private getDefaultReason(type: TransactionType): string {
        switch (type) {
            case TransactionType.IN:
                return 'Entrada de inventario';
            case TransactionType.OUT:
                return 'Salida de inventario';
            case TransactionType.ADJUSTMENT:
                return 'Ajuste de inventario';
        }
    }

    async getTransactionsByProduct(
        tenantId: number,
        productId: number,
        page: number = 1,
        limit: number = 10,
    ) {
        const skip = (page - 1) * limit;

        // Verificar que el producto pertenece al tenant
        const product = await this.prisma.product.findFirst({
            where: { id: productId, tenant_id: tenantId },
        });

        if (!product) {
            throw new NotFoundException('Producto no encontrado');
        }

        const [data, total] = await Promise.all([
            this.prisma.inventoryTransaction.findMany({
                where: { product_id: productId, tenant_id: tenantId },
                skip,
                take: limit,
                orderBy: { created_at: 'desc' },
                include: {
                    user: {
                        select: { id: true, full_name: true, email: true },
                    },
                    supplier: {
                        select: { id: true, name: true },
                    },
                },
            }),
            this.prisma.inventoryTransaction.count({
                where: { product_id: productId, tenant_id: tenantId },
            }),
        ]);

        return {
            product: { id: product.id, name: product.name, sku: product.sku },
            data,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async getTransactionsByTenant(
        tenantId: number,
        page: number = 1,
        limit: number = 10,
        type?: TransactionType,
    ) {
        const skip = (page - 1) * limit;

        const where: any = { tenant_id: tenantId };
        if (type) {
            where.type = type;
        }

        const [data, total] = await Promise.all([
            this.prisma.inventoryTransaction.findMany({
                where,
                skip,
                take: limit,
                orderBy: { created_at: 'desc' },
                include: {
                    product: {
                        select: { id: true, name: true, sku: true },
                    },
                    user: {
                        select: { id: true, full_name: true },
                    },
                    supplier: {
                        select: { id: true, name: true },
                    },
                },
            }),
            this.prisma.inventoryTransaction.count({ where }),
        ]);

        return {
            data,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async getInventorySummary(tenantId: number) {
        const [totalProducts, totalTransactions, lowStockCount] = await Promise.all([
            this.prisma.product.count({ where: { tenant_id: tenantId } }),
            this.prisma.inventoryTransaction.count({ where: { tenant_id: tenantId } }),
            this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM products 
        WHERE tenant_id = ${tenantId} AND current_stock < min_stock
      `,
        ]);

        // Valor total del inventario
        const inventoryValue = await this.prisma.product.aggregate({
            where: { tenant_id: tenantId },
            _sum: {
                current_stock: true,
            },
        });

        return {
            totalProducts,
            totalTransactions,
            lowStockCount: Number(lowStockCount[0]?.count || 0),
            totalUnits: inventoryValue._sum.current_stock || 0,
        };
    }
}
