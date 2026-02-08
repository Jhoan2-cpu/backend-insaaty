import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { PrismaService } from 'src/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid'; // Para generar el string único del refresh token
// Añade RefreshToken a los imports
import { RefreshToken } from '@prisma/client';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prismaService: PrismaService,
  ) { }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findOneByEmail(email);

    if (
      user &&
      user.password_hash &&
      (await bcrypt.compare(pass, user.password_hash))
    ) {
      const { password_hash, ...result } = user;
      return result;
    }
    return null;
  }

  async register(registerDto: RegisterDto) {
    // 1. Verificar que el email no esté registrado
    const existingUser = await this.usersService.findOneByEmail(registerDto.email);
    if (existingUser) {
      throw new BadRequestException('El email ya está registrado');
    }

    // 2. Crear el Tenant (empresa)
    const tenant = await this.prismaService.tenant.create({
      data: {
        name: registerDto.business_name,
        plan_type: 'FREE',
        is_active: true,
      },
    });

    // 3. Buscar o crear el rol "ADMIN"
    let adminRole = await this.prismaService.role.findUnique({
      where: { name: 'ADMIN' },
    });

    if (!adminRole) {
      adminRole = await this.prismaService.role.create({
        data: {
          name: 'ADMIN',
          description: 'Administrador del sistema',
        },
      });
    }

    // 4. Crear el usuario con contraseña hasheada
    const passwordHash = await bcrypt.hash(registerDto.password, 10);

    const user = await this.prismaService.user.create({
      data: {
        email: registerDto.email,
        password_hash: passwordHash,
        full_name: registerDto.full_name,
        tenant_id: tenant.id,
        role_id: adminRole.id,
      },
    });

    // 5. Auto-login: generar tokens y retornarlos
    return this.login(user);
  }

  async login(user: any) {
    // Payload del token con tus campos
    // Generar el Payload para el JWT (Access Token)
    const payload = {
      email: user.email,
      sub: user.id, // Tu ID es un Int, está bien
      tenantId: user.tenant_id,
      roleId: user.role_id,
    };

    // Generar los dos tokens
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = uuidv4(); // Generamos un UUID único

    // Retornamos ambos al usuario
    await this.storeRefreshToken(user.id, refreshToken);
    // 2. CAMBIO CRÍTICO: Creamos un token compuesto (ID + UUID)
    // Esto permite que al volver, sepamos de qué usuario es el token sin descifrar nada
    const combinedToken = `${user.id}.${refreshToken}`;
    return {
      access_token: accessToken,
      refresh_token: combinedToken, // El frontend guardará esto
    };
  }

  async rotateRefreshToken(combinedToken: string) {
    // 1. Validar formato del token
    if (!combinedToken) throw new UnauthorizedException('Token requerido');

    const splitToken = combinedToken.split('.');
    if (splitToken.length !== 2)
      throw new UnauthorizedException('Token mal formado');

    const [userIdStr, uuid] = splitToken;
    const userId = parseInt(userIdStr);

    // 2. Buscar TODOS los tokens de ese usuario (Es rápido porque buscamos por ID)
    const userTokens = await this.prismaService.refreshToken.findMany({
      where: { user_id: userId },
    });

    // 3. Encontrar cuál coincide con el UUID que nos enviaron
    let tokenDb: RefreshToken | null = null;
    for (const t of userTokens) {
      const isMatch = await bcrypt.compare(uuid, t.token_hash);
      if (isMatch) {
        tokenDb = t;
        break;
      }
    }

    if (!tokenDb)
      throw new UnauthorizedException('Token inválido o no encontrado');

    // 4. Verificaciones de seguridad
    if (tokenDb.is_revoked) {
      // PROTOCOLO DE SEGURIDAD: Si usan un token revocado, borramos TODOS sus tokens
      // porque significa que alguien robó un token viejo y lo está intentando usar.
      await this.prismaService.refreshToken.deleteMany({
        where: { user_id: userId },
      });
      throw new UnauthorizedException(
        'Token revocado. Sesión cerrada por seguridad.',
      );
    }

    if (new Date() > tokenDb.expires_at) {
      // Si expiró, lo borramos y lanzamos error
      await this.prismaService.refreshToken.delete({
        where: { id: tokenDb.id },
      });
      throw new UnauthorizedException(
        'El token ha expirado. Inicia sesión nuevamente.',
      );
    }

    // 5. CONSUMIR EL TOKEN (Rotación)
    // Borramos el token usado para que no se pueda volver a usar jamás
    await this.prismaService.refreshToken.delete({ where: { id: tokenDb.id } });

    // 6. Generar nuevos tokens
    // Necesitamos recuperar al usuario completo para regenerar el payload del JWT
    // IMPORTANTE: Asegúrate de tener implementado findOne en UsersService
    const user = await this.usersService.findOne(userId);

    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    // Llamamos a login recursivamente para crear todo de nuevo
    return this.login(user);
  }

  // -- Métodos privados auxiliares --
  private async storeRefreshToken(userId: number, refreshToken: string) {
    // Guardar el refresh token en la base de datos
    const hash = await bcrypt.hash(refreshToken, 10); // Hasheamos el token antes de guardarlo
    const expireAt = new Date();
    expireAt.setDate(expireAt.getDate() + 7); // Expira en 7 días

    await this.prismaService.refreshToken.create({
      data: {
        user_id: userId,
        token_hash: hash,
        expires_at: expireAt,
      },
    });
  }

  async logout(userId: number, refreshToken?: string) {
    if (refreshToken) {
      // Revocar solo el token especificado
      const splitToken = refreshToken.split('.');
      if (splitToken.length === 2) {
        const [, uuid] = splitToken;
        const userTokens = await this.prismaService.refreshToken.findMany({
          where: { user_id: userId },
        });

        for (const t of userTokens) {
          const isMatch = await bcrypt.compare(uuid, t.token_hash);
          if (isMatch) {
            await this.prismaService.refreshToken.delete({ where: { id: t.id } });
            return;
          }
        }
      }
    } else {
      // Revocar TODOS los tokens del usuario (logout de todas las sesiones)
      await this.prismaService.refreshToken.deleteMany({
        where: { user_id: userId },
      });
    }
  }
}
