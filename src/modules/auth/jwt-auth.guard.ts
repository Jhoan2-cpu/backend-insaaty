import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // 1. Preguntar: ¿Esta ruta tiene el decorador @Public?
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 2. Si es pública, dejamos pasar sin revisar el token
    if (isPublic) {
      return true;
    }

    // 3. Si no es pública, ejecutamos la lógica normal de JWT (padre)
    return super.canActivate(context);
  }
}