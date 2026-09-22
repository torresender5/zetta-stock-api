import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { SupplierQueryDto } from './dto/supplier.dto';

@Injectable()
export class SupplierService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private prisma: PrismaService,
  ) {}

  async findAll(companyId?: number) {
    this.logger.info('Starting SupplierService findAll');
    return this.prisma.supplier.findMany({
      where: companyId ? { companyId } : {},
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllPaginated(query: SupplierQueryDto, companyId?: number) {
    this.logger.info('Starting SupplierService findAllPaginated');

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { document: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    try {
      const [data, total] = await Promise.all([
        this.prisma.supplier.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.supplier.count({ where }),
      ]);
      return {
        data,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      };
    } catch (error) {
      this.logger.error('Error finding suppliers:', error);
      throw error;
    }
  }

  async findById(id: number, companyId?: number) {
    this.logger.info(`Finding supplier by ID: ${id}`);
    try {
      const result = await this.prisma.supplier.findFirst({
        where: { id, ...(companyId ? { companyId } : {}) },
      });
      return result || null;
    } catch (error) {
      this.logger.error(`Error finding supplier ${id}:`, error);
      throw error;
    }
  }

  async create(data: any, companyId?: number) {
    try {
      this.logger.info('Creating supplier:', { name: data.name });
      return await this.prisma.supplier.create({
        data: { ...data, companyId },
      });
    } catch (error) {
      this.logger.error('Error creating supplier:', error);
      throw error;
    }
  }

  async update(id: number, data: any, companyId?: number) {
    try {
      this.logger.info(`Updating supplier: ${id}`);
      const existing = await this.prisma.supplier.findFirst({
        where: { id, ...(companyId ? { companyId } : {}) },
      });
      if (!existing) {
        throw new Error('Proveedor no encontrado');
      }
      return await this.prisma.supplier.update({
        where: { id },
        data,
      });
    } catch (error) {
      this.logger.error(`Error updating supplier ${id}:`, error);
      throw error;
    }
  }

  async delete(id: number, companyId?: number) {
    try {
      this.logger.info(`Deleting supplier: ${id}`);
      const existing = await this.prisma.supplier.findFirst({
        where: { id, ...(companyId ? { companyId } : {}) },
      });
      if (!existing) {
        throw new Error('Proveedor no encontrado');
      }
      return await this.prisma.supplier.delete({
        where: { id },
      });
    } catch (error) {
      this.logger.error(`Error deleting supplier ${id}:`, error);
      throw error;
    }
  }
}
