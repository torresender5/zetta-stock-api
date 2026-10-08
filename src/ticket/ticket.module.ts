import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { NotificationModule } from 'src/notification/notification.module';
import { R2Module } from 'src/r2/r2.module';
import { TicketController } from './ticket.controller';
import { TicketAdminController } from './ticket-admin.controller';
import { TicketService } from './ticket.service';

@Module({
  imports: [PrismaModule, NotificationModule, R2Module],
  controllers: [TicketController, TicketAdminController],
  providers: [TicketService],
})
export class TicketModule {}
