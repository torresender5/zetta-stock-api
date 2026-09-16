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
  ],
  controllers: [],
  providers: [PrismaService],
})
export class AppModule {}
