import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderStatus, Prisma } from '@prisma/client';

@Injectable()
export class OrdersService {
    constructor(private prisma: PrismaService) { }

    /**
     * Genera un número de orden único (ORD-0001, ORD-0002, etc.)
     */
    private async generateOrderNumber(): Promise<string> {
        const lastOrder = await this.prisma.order.findFirst({
            orderBy: { id: 'desc' },
            select: { order_number: true },
        });

        if (!lastOrder) {
            return 'ORD-0001';
        }

        const lastNumber = parseInt(lastOrder.order_number.split('-')[1]);
        const newNumber = lastNumber + 1;
        return `ORD-${newNumber.toString().padStart(4, '0')}`;
    }

    /**
     * Crear un nuevo pedido
     */
    async create(tenantId: number, createOrderDto: CreateOrderDto) {
        const { items, notes } = createOrderDto;

        // 1. Validar que todos los productos existan y pertenezcan al tenant
        const productIds = items.map((item) => item.product_id);
        const products = await this.prisma.product.findMany({
            where: {
                id: { in: productIds },
                tenant_id: tenantId,
            },
        });

        if (products.length !== productIds.length) {
            throw new BadRequestException('Uno o más productos no existen o no pertenecen a tu empresa');
        }

        // 2. Crear un mapa de productos para fácil acceso
        const productMap = new Map(products.map((p) => [p.id, p]));

        // 3. Calcular subtotales y total
        let total = 0;
        const orderItems = items.map((item) => {
            const product = productMap.get(item.product_id);
            const unitPrice = Number(product.price_sale);
            const subtotal = unitPrice * item.quantity;
            total += subtotal;

            return {
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: unitPrice,
                subtotal: subtotal,
            };
        });

        // 4. Generar número de orden
        const orderNumber = await this.generateOrderNumber();

        // 5. Crear el pedido con sus items en una transacción
        const order = await this.prisma.order.create({
            data: {
                order_number: orderNumber,
                tenant_id: tenantId,
                status: OrderStatus.PENDING,
                total: total,
                notes: notes || null,
                items: {
                    create: orderItems,
                },
            },
            include: {
                items: {
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
                },
            },
        });

        console.log(`✅ Pedido creado: ${orderNumber} con ${items.length} productos. Total: $${total}`);
        return order;
    }

    /**
     * Listar pedidos con filtros y paginación
     */
    async findAll(
        tenantId: number,
        page: number = 1,
        limit: number = 10,
        status?: OrderStatus,
    ) {
        const skip = (page - 1) * limit;

        const where: Prisma.OrderWhereInput = {
            tenant_id: tenantId,
            ...(status && { status }),
        };

        const [orders, total] = await Promise.all([
            this.prisma.order.findMany({
                where,
                skip,
                take: limit,
                orderBy: { created_at: 'desc' },
                include: {
                    items: {
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
                    },
                },
            }),
            this.prisma.order.count({ where }),
        ]);

        return {
            data: orders,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Obtener un pedido por ID
     */
    async findOne(id: number, tenantId: number) {
        const order = await this.prisma.order.findUnique({
            where: { id },
            include: {
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                sku: true,
                                price_sale: true,
                                current_stock: true,
                            },
                        },
                    },
                },
            },
        });

        if (!order || order.tenant_id !== tenantId) {
            throw new NotFoundException('Pedido no encontrado');
        }

        return order;
    }

    /**
     * Actualizar el estado de un pedido (con lógica de stock)
     */
    async updateStatus(id: number, tenantId: number, updateStatusDto: UpdateOrderStatusDto) {
        const order = await this.findOne(id, tenantId);
        const { status: newStatus } = updateStatusDto;
        const oldStatus = order.status;

        // No hacer nada si el estado es el mismo
        if (oldStatus === newStatus) {
            return order;
        }

        // Lógica de actualización de stock según el cambio de estado
        if (newStatus === OrderStatus.PROCESSING || newStatus === OrderStatus.COMPLETED) {
            // Si va a PROCESSING o COMPLETED, reducir el stock
            if (oldStatus === OrderStatus.PENDING) {
                await this.reduceStock(order.items);
            }
        } else if (newStatus === OrderStatus.CANCELLED) {
            // Si se cancela y ya se había procesado, restaurar el stock
            if (oldStatus === OrderStatus.PROCESSING || oldStatus === OrderStatus.COMPLETED) {
                await this.restoreStock(order.items);
            }
        }

        // Actualizar el estado del pedido
        const updatedOrder = await this.prisma.order.update({
            where: { id },
            data: { status: newStatus },
            include: {
                items: {
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
                },
            },
        });

        console.log(`✅ Pedido ${order.order_number}: ${oldStatus} → ${newStatus}`);
        return updatedOrder;
    }

    /**
     * Reducir el stock de los productos del pedido
     */
    private async reduceStock(items: any[]) {
        for (const item of items) {
            const product = await this.prisma.product.findUnique({
                where: { id: item.product_id },
            });

            if (!product) {
                throw new NotFoundException(`Producto ${item.product_id} no encontrado`);
            }

            if (product.current_stock < item.quantity) {
                throw new BadRequestException(
                    `Stock insuficiente para ${product.name}. Disponible: ${product.current_stock}, Requerido: ${item.quantity}`,
                );
            }

            await this.prisma.product.update({
                where: { id: item.product_id },
                data: { current_stock: { decrement: item.quantity } },
            });

            console.log(`📦 Stock reducido: ${product.name} (-${item.quantity})`);
        }
    }

    /**
     * Restaurar el stock de los productos del pedido (cuando se cancela)
     */
    private async restoreStock(items: any[]) {
        for (const item of items) {
            await this.prisma.product.update({
                where: { id: item.product_id },
                data: { current_stock: { increment: item.quantity } },
            });

            console.log(`📦 Stock restaurado: Producto ${item.product_id} (+${item.quantity})`);
        }
    }

    /**
     * Obtener contador de pedidos pendientes (para badge)
     */
    async getPendingCount(tenantId: number): Promise<number> {
        return this.prisma.order.count({
            where: {
                tenant_id: tenantId,
                status: OrderStatus.PENDING,
            },
        });
    }
}
