import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MailModule } from 'src/email/mail.module';
import { SubscriptionService } from './subscription.service';
import { PlansController } from './plans.controller';
import { SubscriptionController } from './subscription.controller';
import { AdminSubscriptionController } from './admin.controller';
import { SubscriptionCronService } from './subscription-cron.service';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, MailModule],
  controllers: [
    PlansController,
    SubscriptionController,
    AdminSubscriptionController,
  ],
  providers: [SubscriptionService, SubscriptionCronService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
