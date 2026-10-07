import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportModule } from '../report/report.module';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [PrismaModule, ReportModule],
  controllers: [DashboardController],
})
export class DashboardModule {}
