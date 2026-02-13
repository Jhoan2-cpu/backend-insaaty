import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
// import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) { }

  async create(createUserDto: CreateUserDto) {
    // 1. Encriptar la contraseña
    const hash = await bcrypt.hash(createUserDto.password, 10);

    // 2. Guardar usando TU esquema exacto
    // Nota: 'this.prisma.users' (en minúscula y plural porque así llamaste al modelo)
    return await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        password_hash: hash, // Mapeamos password -> password_hash
        full_name: createUserDto.fullName, // Mapeamos fullName -> full_name
        tenant_id: createUserDto.tenantId,
        role_id: createUserDto.roleId, // El ID del rol (ej: 1)
      },
    });
  }

  async findOneByEmail(email: string) {
    return await this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findAllByTenant(tenantId: number) {
    return await this.prisma.user.findMany({
      where: { tenant_id: tenantId },
    });
  }

  async findAllByTenantPaginated(tenantId: number, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { tenant_id: tenantId },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          full_name: true,
          role_id: true,
          tenant_id: true,
          last_login: true,
          // Excluir password_hash por seguridad
        },
        orderBy: { id: 'asc' },
      }),
      this.prisma.user.count({
        where: { tenant_id: tenantId },
      }),
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

  async findAll() {
    return await this.prisma.user.findMany();
  }

  async findOne(id: number) {
    return await this.prisma.user.findUnique({ where: { id } });
  }

  async findOneWithRelations(id: number) {
    return await (this.prisma.user as any).findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        full_name: true,
        bio: true,
        avatar_url: true,
        role_id: true,
        tenant_id: true,
        last_login: true,
        tenant: {
          select: {
            name: true,
            plan_type: true,
          },
        },
        role: {
          select: {
            name: true,
          },
        },
      },
    });
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    // Mapear campos del DTO a campos de la base de datos
    const dataToUpdate: any = {};

    if (updateUserDto.email !== undefined) {
      dataToUpdate.email = updateUserDto.email;
    }
    if (updateUserDto.fullName !== undefined) {
      dataToUpdate.full_name = updateUserDto.fullName;
    }
    if (updateUserDto.password !== undefined) {
      dataToUpdate.password_hash = await bcrypt.hash(updateUserDto.password, 10);
    }
    if (updateUserDto.tenantId !== undefined) {
      dataToUpdate.tenant_id = updateUserDto.tenantId;
    }
    if (updateUserDto.roleId !== undefined) {
      dataToUpdate.role_id = updateUserDto.roleId;
    }
    if (updateUserDto.bio !== undefined) {
      dataToUpdate.bio = updateUserDto.bio;
    }

    return await this.prisma.user.update({
      where: { id },
      data: dataToUpdate,
    });
  }

  async updateAvatarUrl(id: number, avatarUrl: string | null) {
    return await (this.prisma.user as any).update({
      where: { id },
      data: { avatar_url: avatarUrl },
    });
  }

  async remove(id: number) {
    return await this.prisma.user.delete({ where: { id } });
  }
}
