import { Module } from '@nestjs/common';
import { CashRegisterService } from './cash-register.service';
import { CashRegisterController } from './cash-register.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [CashRegisterService],
  controllers: [CashRegisterController],
  exports: [CashRegisterService],
})
export class CashRegisterModule {}
