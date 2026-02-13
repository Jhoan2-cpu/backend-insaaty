import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Request,
  Query,
  ForbiddenException,
  NotFoundException,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';

import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '../auth/roles.enum';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Get('profile')
  async getProfile(@Request() req) {
    const user = await this.usersService.findOneWithRelations(req.user.id);
    return user;
  }

  @Patch('profile')
  updateProfile(@Request() req, @Body() updateUserDto: UpdateUserDto) {
    // Evitar que cambien su propio tenant_id o role_id a menos que sean admin (lógica compleja, por ahora bloqueamos)
    // Para simplificar, solo permitimos cambiar nombre, email, password
    delete updateUserDto.tenantId;
    delete updateUserDto.roleId;
    return this.usersService.update(req.user.id, updateUserDto);
  }

  @Public()
  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Roles(Role.ADMIN)
  @Get()
  findAll(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    // Validar límites de paginación
    const safeLimit = Math.min(limit, 100); // Máximo 100 items por página
    const safePage = Math.max(page, 1);

    return this.usersService.findAllByTenantPaginated(
      req.user.tenantId,
      safePage,
      safeLimit,
    );
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const user = await this.usersService.findOne(id);

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Validación de tenant cruzado: solo puede ver usuarios de su tenant
    if (user.tenant_id !== req.user.tenantId) {
      throw new ForbiddenException('No tienes acceso a este usuario');
    }

    return user;
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req,
  ) {
    // Primero verificar que el usuario pertenece al mismo tenant
    const existingUser = await this.usersService.findOne(id);

    if (!existingUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (existingUser.tenant_id !== req.user.tenantId) {
      throw new ForbiddenException('No tienes acceso a este usuario');
    }

    return this.usersService.update(id, updateUserDto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const existingUser = await this.usersService.findOne(id);

    if (!existingUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (existingUser.tenant_id !== req.user.tenantId) {
      throw new ForbiddenException('No tienes acceso a este usuario');
    }

    // No permitir eliminarse a sí mismo
    if (existingUser.id === req.user.id) {
      throw new ForbiddenException('No puedes eliminarte a ti mismo');
    }

    return this.usersService.remove(id);
  }
}