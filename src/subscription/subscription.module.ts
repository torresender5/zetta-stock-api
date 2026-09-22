import { APP_GUARD } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MailModule } from 'src/email/mail.module';
import { SubscriptionService } from './subscription.service';
import { PlansController } from './plans.controller';
import { SubscriptionController } from './subscription.controller';
import { AdminSubscriptionController } from './admin.controller';
import { SubscriptionGuard } from './subscription.guard';
import { SubscriptionCronService } from './subscription-cron.service';

@Module({
  imports: [PrismaModule, MailModule],
  controllers: [
    PlansController,
    SubscriptionController,
    AdminSubscriptionController,
  ],
  providers: [
    SubscriptionService,
    SubscriptionCronService,
    { provide: APP_GUARD, useClass: SubscriptionGuard },
  ],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
