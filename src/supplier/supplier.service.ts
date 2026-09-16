import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class SupplierService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private prisma: PrismaService,
  ) {}

  async findAll() {
    this.logger.info('Starting SupplierService findAll');
    return this.prisma.supplier.findMany();
  }

  async findById(id: number) {
    this.logger.info(`Finding supplier by ID: ${id}`);
    try {
      const result = await this.prisma.supplier.findUnique({
        where: { id },
      });
      return result || null;
    } catch (error) {
      this.logger.error(`Error finding supplier ${id}:`, error);
      throw error;
    }
  }

  async create(data: any) {
    try {
      this.logger.info('Creating supplier:', { name: data.name });
      return await this.prisma.supplier.create({ data });
    } catch (error) {
      this.logger.error('Error creating supplier:', error);
      throw error;
    }
  }

  async update(id: number, data: any) {
    try {
      this.logger.info(`Updating supplier: ${id}`);
      return await this.prisma.supplier.update({
        where: { id },
        data,
      });
    } catch (error) {
      this.logger.error(`Error updating supplier ${id}:`, error);
      throw error;
    }
  }

  async delete(id: number) {
    try {
      this.logger.info(`Deleting supplier: ${id}`);
      return await this.prisma.supplier.delete({
        where: { id },
      });
    } catch (error) {
      this.logger.error(`Error deleting supplier ${id}:`, error);
      throw error;
    }
  }
}
