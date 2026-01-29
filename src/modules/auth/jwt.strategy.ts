import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, // Si expiró, lanza error 401 automáticamente
      secretOrKey: process.env.JWT_SECRET || 'secretKey', // ¡Usa variables de entorno!
    });
  }

  // Esto se ejecuta automáticamente si el token es válido
  async validate(payload: any) {
    // Lo que retornes aquí se inyectará en 'req.user' en tus controladores
    return { 
        id: payload.sub, 
        email: payload.email, 
        tenantId: payload.tenantId,
        roleId: payload.roleId 
    };
  }
}