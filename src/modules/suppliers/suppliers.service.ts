import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
    constructor(private readonly prisma: PrismaService) { }

    async create(tenantId: number, createSupplierDto: CreateSupplierDto) {
        return this.prisma.supplier.create({
            data: {
                tenant_id: tenantId,
                ...createSupplierDto,
            },
        });
    }

    async findAll(
        tenantId: number,
        params?: {
            page?: number;
            limit?: number;
            search?: string;
            sortBy?: string;
            sortOrder?: 'asc' | 'desc';
        },
    ) {
        const page = params?.page || 1;
        const limit = params?.limit || 10;
        const skip = (page - 1) * limit;
        const sortBy = params?.sortBy || 'created_at';
        const sortOrder = params?.sortOrder || 'desc';

        const where: any = {
            tenant_id: tenantId,
        };

        // Search in name, email, contact_person
        if (params?.search) {
            where.OR = [
                { name: { contains: params.search, mode: 'insensitive' } },
                { email: { contains: params.search, mode: 'insensitive' } },
                { contact_person: { contains: params.search, mode: 'insensitive' } },
            ];
        }

        const [suppliers, total] = await Promise.all([
            this.prisma.supplier.findMany({
                where,
                skip,
                take: limit,
                orderBy: { [sortBy]: sortOrder },
                include: {
                    _count: {
                        select: { products: true },
                    },
                },
            }),
            this.prisma.supplier.count({ where }),
        ]);

        return {
            data: suppliers,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async findOne(tenantId: number, id: number) {
        const supplier = await this.prisma.supplier.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { products: true },
                },
            },
        });

        if (!supplier) {
            throw new NotFoundException(`Supplier with ID ${id} not found`);
        }

        if (supplier.tenant_id !== tenantId) {
            throw new ForbiddenException('Access denied to this supplier');
        }

        return supplier;
    }

    async update(tenantId: number, id: number, updateSupplierDto: UpdateSupplierDto) {
        const supplier = await this.findOne(tenantId, id);

        return this.prisma.supplier.update({
            where: { id: supplier.id },
            data: updateSupplierDto,
        });
    }

    async remove(tenantId: number, id: number) {
        const supplier = await this.findOne(tenantId, id);

        return this.prisma.supplier.delete({
            where: { id: supplier.id },
        });
    }

    async getProductsBySupplier(tenantId: number, supplierId: number) {
        const supplier = await this.findOne(tenantId, supplierId);

        return this.prisma.product.findMany({
            where: {
                tenant_id: tenantId,
                supplier_id: supplier.id,
            },
            orderBy: { name: 'asc' },
        });
    }
}
