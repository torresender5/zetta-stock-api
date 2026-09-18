import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class ClientsService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private prisma: PrismaService,
  ) {}

  async findAll(companyId?: number) {
    this.logger.info('Starting findAll function');
    return this.prisma.client.findMany({
      where: companyId ? { companyId } : {},
    });
  }

  async findById(id: number, companyId?: number) {
    this.logger.info(`Finding client by ID: ${id}`);
    try {
      const result = await this.prisma.client.findFirst({
        where: {
          id,
          ...(companyId ? { companyId } : {}),
        },
      });
      return result || null;
    } catch (error) {
      this.logger.error(`Error finding client ${id}:`, error);
      throw error;
    }
  }

  async findByEmail(email: string, companyId?: number) {
    this.logger.info(`Finding client by email: ${email}`);
    try {
      const result = await this.prisma.client.findFirst({
        where: {
          email,
          ...(companyId ? { companyId } : {}),
        },
      });
      return result || null;
    } catch (error) {
      this.logger.error(`Error finding client ${email}:`, error);
      throw error;
    }
  }

  async create(data: any, companyId?: number) {
    try {
      this.logger.info('Creating client:', { name: data.name });
      const createData = {
        ...data,
        companyId,
      };
      return await this.prisma.client.create({
        data: createData,
      });
    } catch (error) {
      this.logger.error('Error creating client:', error);
      throw error;
    }
  }

  async update(id: number, data: any, companyId?: number) {
    try {
      this.logger.info(`Updating client: ${id}`);
      const existing = await this.prisma.client.findFirst({
        where: { id, ...(companyId ? { companyId } : {}) },
      });
      if (!existing) {
        throw new Error('Cliente no encontrado');
      }
      return await this.prisma.client.update({
        where: { id },
        data,
      });
    } catch (error) {
      this.logger.error(`Error updating client ${id}:`, error);
      throw error;
    }
  }

  async delete(id: number, companyId?: number) {
    try {
      this.logger.info(`Deleting client: ${id}`);
      const existing = await this.prisma.client.findFirst({
        where: { id, ...(companyId ? { companyId } : {}) },
      });
      if (!existing) {
        throw new Error('Cliente no encontrado');
      }
      return await this.prisma.client.delete({
        where: { id },
      });
    } catch (error) {
      this.logger.error(`Error deleting client ${id}:`, error);
      throw error;
    }
  }
}
