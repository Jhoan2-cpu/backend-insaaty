// src/auth/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { Role } from './roles.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Leer qué roles requiere esta ruta (Metadata)
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 2. Si la ruta no tiene el decorador @Roles, dejamos pasar (es pública para cualquier logueado)
    if (!requiredRoles) {
      return true;
    }

    // 3. Obtener el usuario desde la Request (Inyectado por JwtStrategy previamente)
    const { user } = context.switchToHttp().getRequest();
    
    // El user debe tener user.roleId (lo pusimos en el JWT Payload)
    if (!user || !user.roleId) {
       throw new ForbiddenException('No tienes roles asignados');
    }

    // 4. Verificar si el rol del usuario está en la lista de permitidos
    const hasRole = requiredRoles.some((role) => user.roleId === role);
    
    if (!hasRole) {
        throw new ForbiddenException('No tienes permisos suficientes para esta acción');
    }

    return true;
  }
}