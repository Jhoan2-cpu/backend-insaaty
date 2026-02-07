import {
    Injectable,
    ConflictException,
    NotFoundException,
} from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class ProductsService {
    constructor(private prisma: PrismaService) { }

    async create(tenantId: number, createProductDto: CreateProductDto) {
        // Verificar que el SKU no exista para este tenant
        const existing = await this.prisma.product.findFirst({
            where: {
                tenant_id: tenantId,
                sku: createProductDto.sku,
            },
        });

        if (existing) {
            throw new ConflictException('Ya existe un producto con ese SKU en tu empresa');
        }

        return await this.prisma.product.create({
            data: {
                tenant_id: tenantId,
                sku: createProductDto.sku,
                name: createProductDto.name,
                description: createProductDto.description,
                price_cost: createProductDto.price_cost,
                price_sale: createProductDto.price_sale,
                min_stock: createProductDto.min_stock || 0,
                current_stock: createProductDto.current_stock || 0,
            },
        });
    }

    async findAllByTenant(
        tenantId: number,
        page: number = 1,
        limit: number = 10,
        search?: string,
    ) {
        const skip = (page - 1) * limit;

        const where: any = { tenant_id: tenantId };

        // Búsqueda por nombre o SKU
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [data, total] = await Promise.all([
            this.prisma.product.findMany({
                where,
                skip,
                take: limit,
                orderBy: { id: 'asc' },
            }),
            this.prisma.product.count({ where }),
        ]);

        return {
            data,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasNextPage: page < Math.ceil(total / limit),
                hasPrevPage: page > 1,
            },
        };
    }

    async findOne(id: number, tenantId: number) {
        const product = await this.prisma.product.findFirst({
            where: { id, tenant_id: tenantId },
        });

        if (!product) {
            throw new NotFoundException('Producto no encontrado');
        }

        return product;
    }

    async findBySku(sku: string, tenantId: number) {
        const product = await this.prisma.product.findFirst({
            where: { sku, tenant_id: tenantId },
        });

        if (!product) {
            throw new NotFoundException('Producto no encontrado');
        }

        return product;
    }

    async update(id: number, tenantId: number, updateProductDto: UpdateProductDto) {
        // Verificar que el producto existe y pertenece al tenant
        await this.findOne(id, tenantId);

        // Si cambia el SKU, verificar que no exista otro con ese SKU
        if (updateProductDto.sku) {
            const existing = await this.prisma.product.findFirst({
                where: {
                    tenant_id: tenantId,
                    sku: updateProductDto.sku,
                    NOT: { id },
                },
            });

            if (existing) {
                throw new ConflictException('Ya existe otro producto con ese SKU');
            }
        }

        return await this.prisma.product.update({
            where: { id },
            data: updateProductDto,
        });
    }

    async remove(id: number, tenantId: number) {
        // Verificar que existe y pertenece al tenant
        await this.findOne(id, tenantId);

        return await this.prisma.product.delete({
            where: { id },
        });
    }

    async getLowStockProducts(tenantId: number) {
        return await this.prisma.product.findMany({
            where: {
                tenant_id: tenantId,
                current_stock: {
                    lt: this.prisma.product.fields.min_stock,
                },
            },
            orderBy: { current_stock: 'asc' },
        });
    }

    async getLowStockProductsRaw(tenantId: number) {
        // Alternativa con raw query para comparar current_stock < min_stock
        return await this.prisma.$queryRaw`
      SELECT * FROM products 
      WHERE tenant_id = ${tenantId} 
      AND current_stock < min_stock
      ORDER BY current_stock ASC
    `;
    }
}
