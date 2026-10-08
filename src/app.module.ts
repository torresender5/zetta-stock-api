import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AnyAuthGuard } from './auth/any-auth.guard';
import { envPositiveInt, isRateLimitedRoute } from './auth/auth.throttle';
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
import { DataSubjectModule } from './data-subject/data-subject.module';
import { TicketModule } from './ticket/ticket.module';

@Module({
  imports: [
    // Rate limit de /auth/login y /auth/register (los dos endpoints públicos
    // donde aplica la fuerza bruta). El resto de rutas lo saltan vía skipIf.
    ThrottlerModule.forRoot({
      throttlers: [
        {
          limit: () => envPositiveInt('AUTH_RATE_LIMIT', 10),
          ttl: () => envPositiveInt('AUTH_RATE_TTL_MS', 60_000),
          skipIf: (context) => !isRateLimitedRoute(context),
        },
      ],
      errorMessage:
        'Demasiados intentos. Espera un minuto y vuelve a intentarlo.',
    }),
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
    DataSubjectModule,
    TicketModule,
  ],
  controllers: [],
  providers: [
    PrismaService,
    // El orden importa: primero el límite de tasa (niega antes de gastar CPU
    // en autenticar), luego autenticación (puebla request.user) y por último
    // la suscripción (bloquea planes vencidos / vistas no incluidas).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AnyAuthGuard },
    { provide: APP_GUARD, useClass: SubscriptionGuard },
  ],
})
export class AppModule {}
