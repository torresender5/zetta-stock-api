import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { NotificationController } from './notification.controller';
import { AdminNotificationController } from './admin-notification.controller';
import { NotificationService } from './notification.service';
import { NotificationCronService } from './notification-cron.service';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationController, AdminNotificationController],
  providers: [NotificationService, NotificationCronService],
  exports: [NotificationService],
})
export class NotificationModule {}
