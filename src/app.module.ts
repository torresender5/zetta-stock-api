import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { PrismaService } from './prisma/prisma.service';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './config/winston.config';

import { ProductModule } from './product/product.module';
import { ClientsModule } from './client/clients.module';
import { SupplierModule } from './supplier/supplier.module';
import { SaleModule } from './sale/sale.module';
import { PurchaseModule } from './purchase/purchase.module';
import { CashRegisterModule } from './cash-register/cash-register.module';
import { ApartadoModule } from './apartado/apartado.module';
import { ReportModule } from './report/report.module';
import { SubscriptionModule } from './subscription/subscription.module';

@Module({
  imports: [
    UsersModule,
    AuthModule,
    WinstonModule.forRoot(winstonConfig),
    ProductModule,
    ClientsModule,
    SupplierModule,
    SaleModule,
    PurchaseModule,
    CashRegisterModule,
    ApartadoModule,
    ReportModule,
    SubscriptionModule,
  ],
  controllers: [],
  providers: [PrismaService],
})
export class AppModule {}
