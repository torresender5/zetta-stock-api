import { Module } from '@nestjs/common';
import { CashRegisterService } from './cash-register.service';
import { CashRegisterController } from './cash-register.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [PrismaModule, NotificationModule],
  providers: [CashRegisterService],
  controllers: [CashRegisterController],
  exports: [CashRegisterService],
})
export class CashRegisterModule {}
