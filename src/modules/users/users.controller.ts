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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, unlinkSync, mkdirSync } from 'fs';

import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '../auth/roles.enum';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';

// Ensure uploads/avatars directory exists
const avatarDir = join(process.cwd(), 'uploads', 'avatars');
if (!existsSync(avatarDir)) {
  mkdirSync(avatarDir, { recursive: true });
}

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
    delete updateUserDto.tenantId;
    delete updateUserDto.roleId;
    return this.usersService.update(req.user.id, updateUserDto);
  }

  @Post('profile/avatar')
  @UseInterceptors(FileInterceptor('avatar', {
    storage: diskStorage({
      destination: avatarDir,
      filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname).toLowerCase();
        cb(null, `avatar-${uniqueSuffix}${ext}`);
      },
    }),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.match(/^image\/(jpeg|png|gif|webp)$/)) {
        cb(new BadRequestException('Only image files are allowed (jpeg, png, gif, webp)'), false);
        return;
      }
      cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  }))
  async uploadAvatar(@Request() req, @UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Delete old avatar if exists
    const currentUser: any = await this.usersService.findOne(req.user.id);
    if (currentUser?.avatar_url) {
      const oldPath = join(process.cwd(), currentUser.avatar_url);
      if (existsSync(oldPath)) {
        try { unlinkSync(oldPath); } catch (e) { /* ignore */ }
      }
    }

    // Save URL path relative to project root
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    await this.usersService.updateAvatarUrl(req.user.id, avatarUrl);

    return { avatar_url: avatarUrl };
  }

  @Delete('profile/avatar')
  async removeAvatar(@Request() req) {
    const currentUser: any = await this.usersService.findOne(req.user.id);
    if (currentUser?.avatar_url) {
      const oldPath = join(process.cwd(), currentUser.avatar_url);
      if (existsSync(oldPath)) {
        try { unlinkSync(oldPath); } catch (e) { /* ignore */ }
      }
    }

    await this.usersService.updateAvatarUrl(req.user.id, null);
    return { avatar_url: null };
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