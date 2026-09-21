import { Module } from '@nestjs/common';
import { ApartadoService } from './apartado.service';
import { ApartadoController } from './apartado.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ApartadoService],
  controllers: [ApartadoController],
  exports: [ApartadoService],
})
export class ApartadoModule {}
