import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from 'src/prisma.module'; // <-- importa el módulo

@Module({
  imports: [
    UsersModule,
    JwtModule.register({
      global: true,
      secret: 'SECRET_KEY_TEMPORAL', // Recuerda poner esto en .env luego
      signOptions: { expiresIn: '60m' },
    }),
    PrismaModule, // <-- agrega el módulo aquí
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
