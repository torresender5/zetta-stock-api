import { Module } from '@nestjs/common';
import { SaleService } from './sale.service';
import { SaleController, InvoiceController } from './sale.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [SaleService],
  controllers: [SaleController, InvoiceController],
  exports: [SaleService],
})
export class SaleModule {}
