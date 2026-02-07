import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaService } from './prisma.service';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { APP_GUARD } from '@nestjs/core'; // <--- Importante
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard'; // <--- Importante
import { RolesGuard } from './modules/auth/roles.guard'; // <--- Importante


@Module({
  imports: [AuthModule, TenantsModule, UsersModule],
  controllers: [AppController],
  providers: [AppService, PrismaService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // <--- Esto protege TODA tu app
    },
    // Protección global con RolesGuard
    {
      provide: APP_GUARD,
      useClass: RolesGuard, // <--- Esto protege TODA tu app con roles
    },
  ],
})
export class AppModule {}
