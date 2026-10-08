import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DataSubjectService } from './data-subject.service';
import { DataSubjectController } from './data-subject.controller';

@Module({
  imports: [PrismaModule],
  providers: [DataSubjectService],
  controllers: [DataSubjectController],
  exports: [DataSubjectService],
})
export class DataSubjectModule {}
