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

  async findAll() {
    return await this.prisma.user.findMany();
  }

  async findOne(id: number) {
    return await this.prisma.user.findUnique({ where: { id } });
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    return await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });
  }

  async remove(id: number) {
    return await this.prisma.user.delete({ where: { id } });
  }
}
