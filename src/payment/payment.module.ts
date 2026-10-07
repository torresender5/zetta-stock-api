import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PaymentService } from './payment.service';
import { PaymentWebhookController } from './payment-webhook.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentWebhookController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
