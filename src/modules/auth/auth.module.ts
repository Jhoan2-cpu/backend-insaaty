import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from 'src/prisma.module'; // <-- importa el módulo
import { PassportModule } from '@nestjs/passport'; // <--- Importar
import { JwtStrategy } from './jwt.strategy'; // <--- Importar


@Module({
  imports: [
    UsersModule,
    PassportModule, // <--- Agregar
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'secretKey', // Recuerda poner esto en .env luego
      signOptions: { expiresIn: '60m' },
    }),
    PrismaModule, // <-- agrega el módulo aquí
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy], // <--- Agregar JwtStrategy
})
export class AuthModule {}
