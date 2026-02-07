import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';

import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '../auth/roles.enum';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  //Bloquea el endpoint para usuarios no autenticados
  @Public()
  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    console.log('Creating user with data:', createUserDto);
    return this.usersService.create(createUserDto);
  }

  //Bloquea el endpoint para usuarios no autenticados
  // @UseGuards(AuthGuard('jwt'))
  @Roles(Role.ADMIN) // Solo Admins pueden acceder
  @Get()
  findAll(@Request() req) {
    // req.user.tenantId viene del JWT
    console.log('Tenant ID from JWT:', req.user.tenantId);
    return this.usersService.findAllByTenant(req.user.tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(+id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(+id);
  }
}