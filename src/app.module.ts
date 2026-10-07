import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AnyAuthGuard } from './auth/any-auth.guard';
import { SubscriptionGuard } from './subscription/subscription.guard';
import { PrismaService } from './prisma/prisma.service';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './config/winston.config';

import { ProductModule } from './product/product.module';
import { CategoryModule } from './category/category.module';
import { ClientsModule } from './client/clients.module';
import { SupplierModule } from './supplier/supplier.module';
import { SaleModule } from './sale/sale.module';
import { PurchaseModule } from './purchase/purchase.module';
import { CashRegisterModule } from './cash-register/cash-register.module';
import { ApartadoModule } from './apartado/apartado.module';
import { ReportModule } from './report/report.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { AdminModule } from './admin/admin.module';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    UsersModule,
    AuthModule,
    WinstonModule.forRoot(winstonConfig),
    ProductModule,
    CategoryModule,
    ClientsModule,
    SupplierModule,
    SaleModule,
    PurchaseModule,
    CashRegisterModule,
    ApartadoModule,
    ReportModule,
    DashboardModule,
    SubscriptionModule,
    AdminModule,
    NotificationModule,
  ],
  controllers: [],
  providers: [
    PrismaService,
    // El orden importa: primero autenticación (puebla request.user),
    // después la suscripción (bloquea planes vencidos / vistas no incluidas).
    { provide: APP_GUARD, useClass: AnyAuthGuard },
    { provide: APP_GUARD, useClass: SubscriptionGuard },
  ],
})
export class AppModule {}
