import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) { }

  async create(createTenantDto: CreateTenantDto) {
    // Verificar que el nombre no exista
    const existing = await this.prisma.tenant.findUnique({
      where: { name: createTenantDto.name },
    });

    if (existing) {
      throw new ConflictException('Ya existe un tenant con ese nombre');
    }

    return await this.prisma.tenant.create({
      data: {
        name: createTenantDto.name,
        plan_type: createTenantDto.plan_type || 'FREE',
      },
    });
  }

  async findAll(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({
        skip,
        take: limit,
        orderBy: { id: 'asc' },
      }),
      this.prisma.tenant.count(),
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

  async findOne(id: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true, products: true },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant no encontrado');
    }

    return tenant;
  }

  async update(id: number, updateTenantDto: UpdateTenantDto) {
    // Verificar que existe
    await this.findOne(id);

    // Si cambia el nombre, verificar que no exista otro con ese nombre
    if (updateTenantDto.name) {
      const existing = await this.prisma.tenant.findFirst({
        where: {
          name: updateTenantDto.name,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException('Ya existe otro tenant con ese nombre');
      }
    }

    return await this.prisma.tenant.update({
      where: { id },
      data: updateTenantDto,
    });
  }

  async remove(id: number) {
    // Verificar que existe
    await this.findOne(id);

    // Nota: Si tiene FK con cascade, se eliminarán productos y usuarios
    return await this.prisma.tenant.delete({
      where: { id },
    });
  }

  async getStats(id: number) {
    const tenant = await this.findOne(id);

    const [usersCount, productsCount] = await Promise.all([
      this.prisma.user.count({ where: { tenant_id: id } }),
      this.prisma.product.count({ where: { tenant_id: id } }),
    ]);

    return {
      ...tenant,
      stats: {
        usersCount,
        productsCount,
      },
    };
  }
}
