import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { R2Module } from 'src/r2/r2.module';

@Module({
  imports: [PrismaModule, R2Module],
  providers: [ProductService],
  controllers: [ProductController],
})
export class ProductModule {}
