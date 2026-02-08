import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async signIn(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(loginDto.email, loginDto.password);
    if (!user) throw new UnauthorizedException('Credenciales incorrectas');
    return this.authService.login(user);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.rotateRefreshToken(refreshTokenDto.refresh_token);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req, @Body() body: { refresh_token?: string }) {
    // Revocar todos los tokens del usuario o solo el especificado
    await this.authService.logout(req.user.id, body.refresh_token);
    return { message: 'Sesión cerrada exitosamente' };
  }
}
