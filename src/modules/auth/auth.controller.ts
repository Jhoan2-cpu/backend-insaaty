import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

class LoginDto {
  email: string;
  password: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async signIn(@Body() signInDto: LoginDto) {
    const user = await this.authService.validateUser(signInDto.email, signInDto.password);
    if (!user) throw new UnauthorizedException('Credenciales incorrectas');
    return this.authService.login(user);
  }

  // Endpoint para cuando el Access Token caduca
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: { refresh_token: string }) {
    return this.authService.rotateRefreshToken(body.refresh_token);
  }
}
