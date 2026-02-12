import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaService } from '../../prisma.service';
import { OrderStatus, Prisma } from '@prisma/client';

@Injectable()
export class OrdersService {
    constructor(private readonly prisma: PrismaService) { }

    async getPendingCount(tenantId: number) {
        return this.prisma.order.count({
            where: {
                tenant_id: tenantId,
                status: OrderStatus.PENDING,
            },
        });
    }

    async create(createOrderDto: CreateOrderDto, tenantId: number, userId: number) {
        const { items, notes } = createOrderDto;

        // 1. Validate items and stock
        const productIds = items.map((item) => item.product_id);
        const products = await this.prisma.product.findMany({
            where: {
                id: { in: productIds },
                tenant_id: tenantId,
            },
        });

        if (products.length !== productIds.length) {
            throw new BadRequestException('One or more products not found');
        }

        const productMap = new Map(products.map((p) => [p.id, p]));
        let totalAmount = 0;

        // Calculate total and validate stock
        for (const item of items) {
            const product = productMap.get(item.product_id);
            if (!product) continue;

            if (product.current_stock < item.quantity) {
                throw new BadRequestException(`Insufficient stock for product ${product.name} (SKU: ${product.sku})`);
            }

            totalAmount += Number(product.price_sale) * item.quantity;
        }

        // 2. Generate Order Number
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const orderNumber = `ORD-${dateStr}-${randomSuffix}`;

        // 3. Create Order
        return await this.prisma.order.create({
            data: {
                order_number: orderNumber,
                tenant_id: tenantId,
                user_id: userId,
                status: OrderStatus.PENDING,
                total: totalAmount,
                notes: notes,
                order_items: {
                    create: items.map((item) => ({
                        product_id: item.product_id,
                        quantity: item.quantity,
                        unit_price: productMap.get(item.product_id)!.price_sale,
                        subtotal: Number(productMap.get(item.product_id)!.price_sale) * item.quantity,
                    })),
                },
            },
            include: {
                order_items: {
                    include: {
                        product: true,
                    },
                },
            },
        });
    }

    async findAll(
        tenantId: number,
        page: number = 1,
        limit: number = 10,
        status?: OrderStatus,
        search?: string,
        sort?: string,
    ) {
        const skip = (page - 1) * limit;
        const where: Prisma.OrderWhereInput = {
            tenant_id: tenantId,
            ...(status && { status }),
            ...(search && {
                OR: [
                    { order_number: { contains: search, mode: 'insensitive' } },
                    { user: { full_name: { contains: search, mode: 'insensitive' } } },
                ],
            }),
        };

        let orderBy: Prisma.OrderOrderByWithRelationInput = { created_at: 'desc' };

        if (sort) {
            switch (sort) {
                case 'newest':
                    orderBy = { created_at: 'desc' };
                    break;
                case 'oldest':
                    orderBy = { created_at: 'asc' };
                    break;
                case 'highest_total':
                    orderBy = { total: 'desc' };
                    break;
                case 'lowest_total':
                    orderBy = { total: 'asc' };
                    break;
            }
        }

        const [total, data] = await Promise.all([
            this.prisma.order.count({ where }),
            this.prisma.order.findMany({
                where,
                skip,
                take: limit,
                orderBy,
                include: {
                    user: {
                        select: { id: true, full_name: true, email: true },
                    },
                    order_items: true,
                },
            }),
        ]);

        return {
            data,
            meta: {
                total,
                page,
                last_page: Math.ceil(total / limit),
            },
        };
    }

    async findOne(id: number, tenantId: number) {
        const order = await this.prisma.order.findUnique({
            where: { id },
            include: {
                user: {
                    select: { id: true, full_name: true, email: true },
                },
                order_items: {
                    include: {
                        product: true,
                    },
                },
            },
        });

        if (!order || order.tenant_id !== tenantId) {
            throw new NotFoundException('Order not found');
        }

        return order;
    }

    async update(id: number, updateOrderDto: UpdateOrderDto, tenantId: number) {
        const order = await this.findOne(id, tenantId);

        if (updateOrderDto.status && updateOrderDto.status !== order.status) {
            return this.handleStatusChange(order, updateOrderDto.status, updateOrderDto.notes);
        }

        return this.prisma.order.update({
            where: { id },
            data: {
                notes: updateOrderDto.notes,
            },
        });
    }

    private async handleStatusChange(order: any, newStatus: OrderStatus, newNotes?: string) {
        const isNowCompleted = newStatus === OrderStatus.COMPLETED;
        const wasCompleted = order.status === OrderStatus.COMPLETED;
        const isNowCancelled = newStatus === OrderStatus.CANCELLED;

        return await this.prisma.$transaction(async (tx) => {
            if (isNowCompleted && !wasCompleted) {
                for (const item of order.order_items) {
                    const product = await tx.product.findUnique({ where: { id: item.product_id } });
                    // Ensure product exists and check stock again
                    if (!product) {
                        throw new BadRequestException(`Product \${item.product_id} not found`);
                    }
                    if (product.current_stock < item.quantity) {
                        throw new BadRequestException(`Insufficient stock for product ${product.name} to complete order`);
                    }

                    await tx.product.update({
                        where: { id: item.product_id },
                        data: { current_stock: { decrement: item.quantity } },
                    });
                }
            }

            if (isNowCancelled && wasCompleted) {
                for (const item of order.order_items) {
                    await tx.product.update({
                        where: { id: item.product_id },
                        data: { current_stock: { increment: item.quantity } },
                    });
                }
            }

            return await tx.order.update({
                where: { id: order.id },
                data: {
                    status: newStatus,
                    notes: newNotes !== undefined ? newNotes : order.notes,
                },
                include: {
                    order_items: { include: { product: true } }
                }
            });
        });
    }

    async remove(id: number, tenantId: number) {
        const order = await this.findOne(id, tenantId);

        if (order.status !== OrderStatus.PENDING) {
            throw new BadRequestException('Only PENDING orders can be deleted');
        }

        return this.prisma.order.delete({
            where: { id },
        });
    }
}
