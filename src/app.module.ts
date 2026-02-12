import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaService } from './prisma.service';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { RolesGuard } from './modules/auth/roles.guard';
import { OrdersModule } from './modules/orders/orders.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';

import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'), // Go up one level from dist/src to root/uploads ?? No, dist is parallel to uploads usually if uploads is in root.
      // If uploads is in project root.
      // dist/src/main.js -> __dirname is dist/src.
      // uploads is in root. so ../../uploads ?
      // Let's assume standard nest structure: /dist/main.js.
      // __dirname in main.ts is /dist.
      // So join(__dirname, '..', 'uploads') works if uploads is in project root.
      serveRoot: '/uploads',
    }),
    AuthModule, TenantsModule, UsersModule, ProductsModule, InventoryModule, DashboardModule, OrdersModule, ReportsModule, SuppliersModule],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule { }

